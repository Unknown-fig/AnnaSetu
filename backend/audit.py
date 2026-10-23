import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from typing import Dict, Any, Optional

GENESIS_HASH = "0" * 64

def canonical_json(data: Any) -> str:
    """Deterministic JSON string for cryptographic hashing."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

def compute_audit_hash(prev_hash: str, timestamp: str, event_type: str, details: Dict[str, Any]) -> str:
    payload = prev_hash + timestamp + event_type + canonical_json(details)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def log_audit_event(
    conn: sqlite3.Connection,
    event_type: str,
    details: Dict[str, Any],
    timestamp: Optional[str] = None
) -> Dict[str, Any]:
    """Logs an audit event inside an ongoing transaction."""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).isoformat()

    cursor = conn.cursor()
    cursor.execute("SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1")
    last_row = cursor.fetchone()
    prev_hash = last_row["hash"] if last_row else GENESIS_HASH

    event_hash = compute_audit_hash(prev_hash, timestamp, event_type, details)
    details_json = canonical_json(details)

    cursor.execute(
        """
        INSERT INTO audit_logs (event_type, details, timestamp, prev_hash, hash)
        VALUES (?, ?, ?, ?, ?)
        """,
        (event_type, details_json, timestamp, prev_hash, event_hash)
    )
    new_id = cursor.lastrowid

    return {
        "id": new_id,
        "event_type": event_type,
        "details": details,
        "timestamp": timestamp,
        "prev_hash": prev_hash,
        "hash": event_hash
    }

def verify_hash_chain(conn: sqlite3.Connection) -> Dict[str, Any]:
    """Verifies the complete cryptographically linked SHA-256 audit chain."""
    cursor = conn.cursor()
    cursor.execute("SELECT id, event_type, details, timestamp, prev_hash, hash FROM audit_logs ORDER BY id ASC")
    rows = cursor.fetchall()

    expected_prev = GENESIS_HASH
    for idx, row in enumerate(rows, start=1):
        # 1. Check prev_hash linkage
        if row["prev_hash"] != expected_prev:
            return {
                "valid": False,
                "events": len(rows),
                "broken_at": idx,
                "reason": f"Broken linkage at event #{idx} (ID {row['id']}): prev_hash {row['prev_hash']} != expected {expected_prev}"
            }

        # 2. Recompute hash
        try:
            details_obj = json.loads(row["details"])
        except Exception:
            return {
                "valid": False,
                "events": len(rows),
                "broken_at": idx,
                "reason": f"Corrupted JSON in details at event #{idx} (ID {row['id']})"
            }

        recomputed = compute_audit_hash(expected_prev, row["timestamp"], row["event_type"], details_obj)
        if recomputed != row["hash"]:
            return {
                "valid": False,
                "events": len(rows),
                "broken_at": idx,
                "reason": f"Hash mismatch at event #{idx} (ID {row['id']}): computed {recomputed} != stored {row['hash']}"
            }

        expected_prev = row["hash"]

    return {
        "valid": True,
        "events": len(rows),
        "broken_at": None
    }
