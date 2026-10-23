import json
import hashlib
from fastapi import APIRouter
from typing import List, Dict, Any
from datetime import datetime, timezone

from backend.db import get_db, increment_state_version
from backend.models import SyncEventItem
from backend.audit import log_audit_event, canonical_json

router = APIRouter(prefix="/api/sync", tags=["sync"])

@router.post("")
def process_sync_queue(items: List[SyncEventItem]):
    results = []
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()

        for item in items:
            # 1. Idempotency check: already processed?
            cursor.execute(
                """
                SELECT id, status, conflict_reason, server_received_at
                FROM sync_records
                WHERE device_id = ? AND local_seq = ?
                """,
                (item.device_id, item.local_seq)
            )
            existing = cursor.fetchone()
            if existing:
                results.append({
                    "device_id": item.device_id,
                    "local_seq": item.local_seq,
                    "status": existing["status"],
                    "conflict_reason": existing["conflict_reason"],
                    "server_received_at": existing["server_received_at"],
                    "idempotent": True
                })
                continue

            # 2. Token hash verification
            expected_token = hashlib.sha256(canonical_json(item.payload).encode("utf-8")).hexdigest()
            is_token_valid = (expected_token.lower() == item.token.lower())

            status = "SYNCED"
            conflict_reason = None

            if not is_token_valid:
                status = "CONFLICT"
                conflict_reason = f"Cryptographic token verification failed: expected {expected_token[:16]}..., received {item.token[:16]}..."

            # 3. Contiguity check
            if status == "SYNCED":
                cursor.execute(
                    """
                    SELECT MAX(local_seq) as max_seq
                    FROM sync_records
                    WHERE device_id = ? AND status = 'SYNCED'
                    """,
                    (item.device_id,)
                )
                last_seq_row = cursor.fetchone()
                last_seq = last_seq_row["max_seq"] if last_seq_row and last_seq_row["max_seq"] is not None else 0
                if last_seq > 0 and item.local_seq != last_seq + 1:
                    status = "CONFLICT"
                    conflict_reason = f"Non-contiguous sequence: expected local_seq {last_seq + 1}, received {item.local_seq}"

            # 4. Stock validation check
            if status == "SYNCED":
                lines = item.payload.get("lines") or []
                for line in lines:
                    bcode = line.get("batch_code") or line.get("batchId")
                    alloc_q = float(line.get("allocated_qty") or line.get("quantity") or 0)
                    if bcode and alloc_q > 0:
                        cursor.execute("SELECT current_qty, reserved_qty FROM batches WHERE batch_code = ?", (bcode,))
                        b_row = cursor.fetchone()
                        if not b_row:
                            status = "CONFLICT"
                            conflict_reason = f"Batch {bcode} does not exist on Central Server"
                            break
                        avail = b_row["current_qty"] - b_row["reserved_qty"]
                        if avail < alloc_q:
                            status = "CONFLICT"
                            conflict_reason = f"Batch {bcode} was depleted on Central Server (available {avail} Qtl < needed {alloc_q} Qtl)"
                            break

            # 5. Record result
            cursor.execute("BEGIN IMMEDIATE")
            cursor.execute(
                """
                INSERT INTO sync_records (
                    device_id, local_seq, payload, status, conflict_reason, server_received_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (item.device_id, item.local_seq, json.dumps(item.payload), status, conflict_reason, now_iso)
            )

            if status == "SYNCED":
                log_audit_event(
                    conn,
                    "SYNC_COMPLETED",
                    {
                        "deviceId": item.device_id,
                        "localSeq": item.local_seq,
                        "eventType": item.type,
                        "tokenPrefix": item.token[:16]
                    },
                    timestamp=now_iso
                )
            else:
                log_audit_event(
                    conn,
                    "SYNC_CONFLICT",
                    {
                        "deviceId": item.device_id,
                        "localSeq": item.local_seq,
                        "eventType": item.type,
                        "reason": conflict_reason,
                        "tokenPrefix": item.token[:16]
                    },
                    timestamp=now_iso
                )

            increment_state_version(conn)
            conn.commit()

            results.append({
                "device_id": item.device_id,
                "local_seq": item.local_seq,
                "status": status,
                "conflict_reason": conflict_reason,
                "server_received_at": now_iso,
                "idempotent": False
            })

    return {
        "processed_count": len(results),
        "results": results
    }
