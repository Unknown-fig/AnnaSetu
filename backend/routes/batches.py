from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
import hashlib
from datetime import datetime, timezone

from backend.db import get_db, increment_state_version
from backend.models import BatchCreate
from backend.audit import log_audit_event
from backend.config import to_db_commodity, DB_COMMODITIES

router = APIRouter(prefix="/api/batches", tags=["batches"])

@router.post("")
def create_batch(payload: BatchCreate):
    comm = to_db_commodity(payload.commodity)
    if comm not in DB_COMMODITIES:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "INVALID_COMMODITY", "message": f"Commodity must be one of {DB_COMMODITIES}"}}
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM batches WHERE batch_code = ?", (payload.batch_code,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "DUPLICATE_BATCH", "message": f"Batch {payload.batch_code} already exists"}}
            )

        batch_hash = hashlib.sha256(
            f"BATCH:{payload.batch_code}:{payload.receipt_date}:{payload.stack_bay}".encode("utf-8")
        ).hexdigest()

        status = payload.status
        if payload.moisture_pct > 14.0:
            status = "QUALITY_HOLD"

        now_iso = datetime.now(timezone.utc).isoformat()

        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute(
            """
            INSERT INTO batches (
                batch_code, commodity, supplier, receipt_date, stack_bay,
                stack_position, initial_qty, current_qty, reserved_qty,
                status, moisture_pct, sha256_hash
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
            """,
            (
                payload.batch_code, comm, payload.supplier, payload.receipt_date,
                payload.stack_bay, payload.stack_position, payload.initial_qty,
                payload.initial_qty, status, payload.moisture_pct, batch_hash
            )
        )
        batch_id = cursor.lastrowid

        # Log audit event
        log_audit_event(
            conn,
            "CONSIGNMENT_RECEIPT",
            {
                "batchId": payload.batch_code,
                "commodity": comm,
                "supplier": payload.supplier,
                "receiptDate": payload.receipt_date,
                "bay": payload.stack_bay,
                "quantity": payload.initial_qty,
                "status": status,
                "moisturePct": payload.moisture_pct
            },
            timestamp=now_iso
        )
        version_info = increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "batch_id": batch_id,
            "batch_code": payload.batch_code,
            "status": status,
            "sha256_hash": batch_hash,
            "version": version_info["version"]
        }

@router.get("")
def list_batches(commodity: Optional[str] = None, status: Optional[str] = None):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM batches"
        params = []
        conditions = []
        if commodity:
            comm = to_db_commodity(commodity)
            conditions.append("commodity = ?")
            params.append(comm)
        if status:
            conditions.append("status = ?")
            params.append(status)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY receipt_date ASC, batch_code ASC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        from backend.fifo import get_age_days
        from backend.config import to_ui_commodity, to_ui_status
        result = []
        for r in rows:
            age = get_age_days(r["receipt_date"])
            curr = float(r["current_qty"])
            res = float(r["reserved_qty"])
            result.append({
                "id": r["id"],
                "batch_code": r["batch_code"],
                "batchId": r["batch_code"],
                "commodity": r["commodity"],
                "ui_commodity": to_ui_commodity(r["commodity"]),
                "supplier": r["supplier"],
                "receipt_date": r["receipt_date"],
                "receiptDate": r["receipt_date"],
                "stack_bay": r["stack_bay"],
                "bay": r["stack_bay"],
                "stack_position": r["stack_position"],
                "initial_qty": float(r["initial_qty"]),
                "current_qty": curr,
                "reserved_qty": res,
                "available_qty": max(0.0, curr - res),
                "status": r["status"],
                "qualityStatus": to_ui_status(r["status"]),
                "moisture_pct": float(r["moisture_pct"]),
                "sha256_hash": r["sha256_hash"],
                "age_days": age
            })
        return result
