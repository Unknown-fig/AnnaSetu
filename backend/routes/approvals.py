import secrets
from fastapi import APIRouter, HTTPException, Path
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta

from backend.db import get_db, increment_state_version
from backend.models import ApproverDecisionRequest
from backend.otp import get_simulated_sms_otp, generate_otp, hash_otp, _SIMULATED_SMS_CACHE
from backend.audit import log_audit_event

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

@router.get("/pending")
def list_pending_approvals():
    """Returns active pending OTP requests with simulated SMS access for judges and demo."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT o.id, o.challan_id, o.role, o.expires_at, o.attempts, o.locked_until, o.status,
                   c.challan_no, c.commodity, c.total_qty, c.exception_reason
            FROM otp_requests o
            JOIN delivery_challans c ON o.challan_id = c.id
            WHERE o.status IN ('PENDING', 'LOCKED', 'EXPIRED') AND o.used = 0
            ORDER BY o.id DESC
            """
        )
        rows = cursor.fetchall()
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        results = []
        for r in rows:
            is_expired = r["expires_at"] < now_iso
            otp_val = get_simulated_sms_otp(r["id"]) if not is_expired else None

            # If not in cache and not expired (e.g. server restart), regenerate to ensure demo SMS access
            if not otp_val and not is_expired:
                otp_val = generate_otp()
                salt = secrets.token_hex(16)
                hashed = hash_otp(otp_val, salt)
                cursor.execute(
                    "UPDATE otp_requests SET otp_hash = ?, salt = ? WHERE id = ?",
                    (hashed, salt, r["id"])
                )
                conn.commit()
                _SIMULATED_SMS_CACHE[r["id"]] = otp_val

            results.append({
                "id": r["id"],
                "challan_id": r["challan_id"],
                "challan_no": r["challan_no"],
                "role": r["role"],
                "commodity": r["commodity"],
                "total_qty": r["total_qty"],
                "exception_reason": r["exception_reason"],
                "expires_at": r["expires_at"],
                "is_expired": is_expired,
                "is_locked": bool(r["locked_until"] and r["locked_until"] > now_iso),
                "attempts": r["attempts"],
                "status": "EXPIRED" if is_expired else r["status"],
                "simulated_sms_otp": otp_val,
                "label": "SIMULATED SMS - demo only"
            })

        return results

@router.post("/{id}/decision")
def make_approver_decision(id: int = Path(...), payload: ApproverDecisionRequest = None):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT o.id, o.challan_id, o.role, o.status, o.expires_at, c.challan_no
            FROM otp_requests o
            JOIN delivery_challans c ON o.challan_id = c.id
            WHERE o.id = ?
            """,
            (id,)
        )
        row = cursor.fetchone()
        if not row:
            # Fallback: check if id is a challan_id
            cursor.execute(
                """
                SELECT o.id, o.challan_id, o.role, o.status, o.expires_at, c.challan_no
                FROM otp_requests o
                JOIN delivery_challans c ON o.challan_id = c.id
                WHERE o.challan_id = ?
                ORDER BY o.id DESC LIMIT 1
                """,
                (id,)
            )
            row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail={"error": {"code": "OTP_REQUEST_NOT_FOUND", "message": f"OTP request #{id} not found"}})

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        req_id = row["id"]

        if payload.action == "APPROVE":
            otp_val = get_simulated_sms_otp(req_id)
            is_expired = row["expires_at"] < now_iso

            # If not in memory cache or expired, refresh simulated OTP with fresh 120s TTL
            if not otp_val or is_expired:
                otp_val = generate_otp()
                salt = secrets.token_hex(16)
                hashed = hash_otp(otp_val, salt)
                new_expiry = (now + timedelta(seconds=120)).isoformat()

                cursor.execute(
                    """
                    UPDATE otp_requests
                    SET otp_hash = ?, salt = ?, expires_at = ?, attempts = 0, locked_until = NULL, status = 'PENDING'
                    WHERE id = ?
                    """,
                    (hashed, salt, new_expiry, req_id)
                )
                _SIMULATED_SMS_CACHE[req_id] = otp_val

            log_audit_event(
                conn,
                "EXCEPTION_APPROVED",
                {
                    "challanNo": row["challan_no"],
                    "approvedBy": row["role"],
                    "remarks": payload.remarks or f"Statutory exception authorized by {row['role']}"
                },
                timestamp=now_iso
            )
            increment_state_version(conn)
            conn.commit()

            return {
                "success": True,
                "action": "APPROVED",
                "role": row["role"],
                "simulated_sms_otp": otp_val,
                "simulated_otp": otp_val,
                "label": "SIMULATED SMS - demo only"
            }
        else:
            cursor.execute("BEGIN IMMEDIATE")
            cursor.execute("UPDATE otp_requests SET status = 'REJECTED' WHERE id = ?", (req_id,))
            cursor.execute("UPDATE delivery_challans SET status = 'CANCELLED' WHERE id = ?", (row["challan_id"],))
            log_audit_event(
                conn,
                "EXCEPTION_REJECTED",
                {
                    "challanNo": row["challan_no"],
                    "rejectedBy": row["role"],
                    "remarks": payload.remarks or "Rejected by Approver"
                },
                timestamp=now_iso
            )
            increment_state_version(conn)
            conn.commit()

            return {
                "success": True,
                "action": "REJECTED",
                "role": row["role"],
                "message": f"Exception approval rejected by {row['role']}"
            }
