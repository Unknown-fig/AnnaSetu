import secrets
import hashlib
import hmac
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Tuple, Optional

# In-memory store for simulated SMS view ONLY (never saved to database or logs)
_SIMULATED_SMS_CACHE: Dict[int, str] = {}

def generate_otp() -> str:
    """Generates a cryptographically random 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000:06d}"

def hash_otp(otp: str, salt: str) -> str:
    return hashlib.sha256((salt + otp).encode("utf-8")).hexdigest()

def create_otp_request(
    conn: sqlite3.Connection,
    challan_id: int,
    role: str,
    expiry_seconds: int = 120
) -> Tuple[int, str]:
    """
    Creates an OTP record in DB with salted hash.
    Caches plaintext ONLY in memory for the simulated SMS viewer.
    """
    cursor = conn.cursor()
    # Invalidate previous unverified OTPs for this challan & role
    cursor.execute(
        """
        UPDATE otp_requests
        SET status = 'SUPERSEDED'
        WHERE challan_id = ? AND role = ? AND used = 0
        """,
        (challan_id, role)
    )

    otp_plain = generate_otp()
    salt = secrets.token_hex(16)
    otp_hashed = hash_otp(otp_plain, salt)
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=expiry_seconds)).isoformat()

    cursor.execute(
        """
        INSERT INTO otp_requests (challan_id, role, otp_hash, salt, expires_at, attempts, used, status)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'PENDING')
        """,
        (challan_id, role, otp_hashed, salt, expires_at)
    )
    req_id = cursor.lastrowid
    _SIMULATED_SMS_CACHE[req_id] = otp_plain

    return req_id, otp_plain

def get_simulated_sms_otp(req_id: int) -> Optional[str]:
    return _SIMULATED_SMS_CACHE.get(req_id)

def verify_otp_attempt(
    conn: sqlite3.Connection,
    challan_id: int,
    role: str,
    candidate_otp: str
) -> Tuple[bool, str, str]:
    """
    Validates a submitted OTP for a given role and challan.
    Returns (success: bool, status_code: str, message: str).
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, otp_hash, salt, expires_at, attempts, locked_until, used, status
        FROM otp_requests
        WHERE challan_id = ? AND role = ? AND status IN ('PENDING', 'LOCKED')
        ORDER BY id DESC LIMIT 1
        """,
        (challan_id, role)
    )
    row = cursor.fetchone()
    if not row:
        return False, "NO_PENDING_OTP", "No active OTP request found for this role"

    req_id = row["id"]
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # 1. Check lock
    if row["locked_until"] and row["locked_until"] > now_iso:
        return False, "LOCKED", "Security Lockout: Too many failed attempts. Try again in 30 seconds"

    # 2. Check expiry
    if row["expires_at"] < now_iso:
        cursor.execute("UPDATE otp_requests SET status = 'EXPIRED' WHERE id = ?", (req_id,))
        return False, "EXPIRED", "OTP has expired (120s limit). Please request a new OTP"

    # 3. Check already used
    if row["used"] == 1:
        return False, "ALREADY_USED", "This OTP has already been verified and consumed"

    # 4. Constant-time hash check
    candidate_hash = hash_otp(candidate_otp.strip(), row["salt"])
    match = hmac.compare_digest(candidate_hash, row["otp_hash"])

    if match:
        cursor.execute(
            """
            UPDATE otp_requests
            SET used = 1, status = 'VERIFIED'
            WHERE id = ?
            """,
            (req_id,)
        )
        return True, "VERIFIED", f"{role} OTP verified successfully"
    else:
        new_attempts = row["attempts"] + 1
        locked_until_iso = None
        new_status = "PENDING"
        if new_attempts >= 3:
            locked_until_iso = (now + timedelta(seconds=30)).isoformat()
            new_status = "LOCKED"

        cursor.execute(
            """
            UPDATE otp_requests
            SET attempts = ?, locked_until = ?, status = ?
            WHERE id = ?
            """,
            (new_attempts, locked_until_iso, new_status, req_id)
        )
        if new_attempts >= 3:
            return False, "LOCKED", "Maximum 3 failed attempts exceeded. Locked out for 30 seconds"
        return False, "INVALID_OTP", f"Invalid OTP code. {3 - new_attempts} attempt(s) remaining"
