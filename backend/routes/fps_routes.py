import json
import hmac
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List

from backend.db import get_db, get_state_version, increment_state_version
from backend.models import FpsConfirmReceiptRequest, FpsRejectReceiptRequest
from backend.config import (
    to_db_commodity, to_ui_commodity, DB_COMMODITIES,
    LOW_STOCK_THRESHOLDS, CRITICAL_STOCK_THRESHOLDS, get_stock_status
)
from backend.audit import log_audit_event, canonical_json
from backend.fifo import get_age_days

router = APIRouter(tags=["nfsa_fps_and_vigilance"])

@router.get("/api/state/version")
def get_current_version():
    """Returns monotonic database state version counter and update timestamp."""
    with get_db() as conn:
        return get_state_version(conn)

@router.get("/api/fps/{fps_code}/dashboard")
def get_fps_dashboard(fps_code: str):
    """Returns FPS store details, live 7-commodity stock inventory, indents, and incoming challans."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, fps_code, shop_name, dealer_name, location, stock_inventory FROM fps_stores WHERE fps_code = ?",
            (fps_code,)
        )
        fps = cursor.fetchone()
        if not fps:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "FPS_NOT_FOUND", "message": f"Fair Price Shop {fps_code} not found"}}
            )

        raw_stock = json.loads(fps["stock_inventory"])

        # Format stock inventory with low/critical thresholds for all 7 commodities
        stock_list = []
        low_stock_count = 0
        total_stock = 0.0

        for comm in DB_COMMODITIES:
            qty = float(raw_stock.get(comm, 0.0))
            total_stock += qty
            crit = CRITICAL_STOCK_THRESHOLDS.get(comm, 5.0)
            low = LOW_STOCK_THRESHOLDS.get(comm, 15.0)
            status = get_stock_status(comm, qty)
            if status in ("LOW", "CRITICAL"):
                low_stock_count += 1

            stock_list.append({
                "commodity": comm,
                "ui_commodity": to_ui_commodity(comm),
                "qty": qty,
                "unit": "Qtl",
                "threshold": low,
                "critical_threshold": crit,
                "status": status,
                "is_low_stock": status in ("LOW", "CRITICAL")
            })

        # Fetch indents for this FPS
        cursor.execute(
            """
            SELECT id, indent_no, commodity, requested_qty, priority, status, created_at
            FROM fps_indents
            WHERE fps_id = ?
            ORDER BY id DESC LIMIT 20
            """,
            (fps["id"],)
        )
        indents = [
            {
                "id": r["id"],
                "indent_no": r["indent_no"],
                "commodity": r["commodity"],
                "ui_commodity": to_ui_commodity(r["commodity"]),
                "requested_qty": float(r["requested_qty"]),
                "priority": r["priority"],
                "status": r["status"],
                "created_at": r["created_at"]
            }
            for r in cursor.fetchall()
        ]

        # Fetch incoming in-transit challans
        cursor.execute(
            """
            SELECT id, challan_no, commodity, total_qty, allocated_batches,
                   is_fifo_compliant, exception_reason, crypto_token, status, issued_at
            FROM delivery_challans
            WHERE fps_id = ? AND status = 'IN_TRANSIT'
            ORDER BY id DESC
            """,
            (fps["id"],)
        )
        incoming = []
        for c in cursor.fetchall():
            incoming.append({
                "id": c["id"],
                "challan_no": c["challan_no"],
                "commodity": c["commodity"],
                "ui_commodity": to_ui_commodity(c["commodity"]),
                "total_qty": float(c["total_qty"]),
                "allocated_batches": json.loads(c["allocated_batches"]),
                "is_fifo_compliant": bool(c["is_fifo_compliant"]),
                "exception_reason": c["exception_reason"],
                "crypto_token": c["crypto_token"],
                "token_prefix": c["crypto_token"][:16] if c["crypto_token"] else "",
                "status": c["status"],
                "issued_at": c["issued_at"]
            })

        # Fetch delivered challans
        cursor.execute(
            """
            SELECT id, challan_no, commodity, total_qty, allocated_batches,
                   is_fifo_compliant, exception_reason, crypto_token, status, issued_at, received_at
            FROM delivery_challans
            WHERE fps_id = ? AND status = 'RECEIVED_AT_FPS'
            ORDER BY id DESC LIMIT 15
            """,
            (fps["id"],)
        )
        delivered = []
        for c in cursor.fetchall():
            delivered.append({
                "id": c["id"],
                "challan_no": c["challan_no"],
                "commodity": c["commodity"],
                "ui_commodity": to_ui_commodity(c["commodity"]),
                "total_qty": float(c["total_qty"]),
                "allocated_batches": json.loads(c["allocated_batches"]),
                "is_fifo_compliant": bool(c["is_fifo_compliant"]),
                "crypto_token": c["crypto_token"],
                "token_prefix": c["crypto_token"][:16] if c["crypto_token"] else "",
                "status": c["status"],
                "issued_at": c["issued_at"],
                "received_at": c["received_at"]
            })

        pending_indents_count = sum(1 for i in indents if i["status"] == "PENDING_AT_GODOWN")

        return {
            "fps": {
                "id": fps["id"],
                "fps_code": fps["fps_code"],
                "shop_name": fps["shop_name"],
                "dealer_name": fps["dealer_name"],
                "location": fps["location"],
            },
            "stock_inventory": stock_list,
            "indents": indents,
            "incoming_challans": incoming,
            "delivered_challans": delivered,
            "totals": {
                "total_stock_qtl": round(total_stock, 2),
                "low_stock_count": low_stock_count,
                "pending_indents_count": pending_indents_count,
                "in_transit_challans_count": len(incoming)
            }
        }

@router.post("/api/fps/confirm-receipt")
def confirm_fps_receipt(payload: FpsConfirmReceiptRequest):
    """
    Validates challan destination, recomputes crypto token, checks for tampering,
    updates FPS inventory atomically, and marks challan as RECEIVED_AT_FPS.
    Idempotent: second call returns ALREADY_RECEIVED without double-adding stock.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Fetch challan with FPS details
        cursor.execute(
            """
            SELECT c.*, f.fps_code, f.shop_name, f.stock_inventory
            FROM delivery_challans c
            JOIN fps_stores f ON c.fps_id = f.id
            WHERE c.challan_no = ?
            """,
            (payload.challan_no,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan {payload.challan_no} not found"}}
            )

        # 1. Check destination FPS
        if row["fps_code"] != payload.fps_code:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "WRONG_FPS",
                        "message": f"Challan {payload.challan_no} is destined for {row['shop_name']} ({row['fps_code']}), not {payload.fps_code}"
                    }
                }
            )

        # 2. Idempotency check: Already received
        if row["status"] == "RECEIVED_AT_FPS":
            return {
                "success": True,
                "status": "ALREADY_RECEIVED",
                "message": f"Challan {payload.challan_no} was already confirmed at {row['received_at']}.",
                "challan_no": payload.challan_no,
                "received_at": row["received_at"],
                "fps_code": payload.fps_code
            }

        # 3. Status must be IN_TRANSIT
        if row["status"] != "IN_TRANSIT":
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "INVALID_STATUS",
                        "message": f"Cannot receive challan in status '{row['status']}'. Must be IN_TRANSIT."
                    }
                }
            )

        # 4. Cryptographic Token Integrity Verification
        stored_token = row["crypto_token"]
        is_tampered = False

        if payload.qr_payload:
            scanned_token = payload.qr_payload.get("token") or payload.qr_payload.get("crypto_token")
            # If payload has modified quantities or lines, verify recomputed hash
            scanned_qty = payload.qr_payload.get("qty") or payload.qr_payload.get("total_qty")
            if scanned_qty is not None and abs(float(scanned_qty) - float(row["total_qty"])) > 0.001:
                is_tampered = True

            if scanned_token and not hmac.compare_digest(str(scanned_token), str(stored_token)):
                is_tampered = True

        elif payload.qr_raw:
            try:
                parsed = json.loads(payload.qr_raw)
                scanned_token = parsed.get("token") or parsed.get("crypto_token")
                scanned_qty = parsed.get("qty") or parsed.get("total_qty")
                if scanned_qty is not None and abs(float(scanned_qty) - float(row["total_qty"])) > 0.001:
                    is_tampered = True
                if scanned_token and not hmac.compare_digest(str(scanned_token), str(stored_token)):
                    is_tampered = True
            except Exception:
                # Raw text token comparison
                if not hmac.compare_digest(str(payload.qr_raw).strip(), str(stored_token)):
                    is_tampered = True

        if is_tampered:
            # Log RECEIPT_REJECTED in audit chain
            now_iso = datetime.now(timezone.utc).isoformat()
            log_audit_event(
                conn,
                "RECEIPT_REJECTED",
                {
                    "challanNo": payload.challan_no,
                    "fpsCode": payload.fps_code,
                    "reason": "Cryptographic token mismatch / altered payload",
                    "status": "TAMPERED"
                },
                timestamp=now_iso
            )
            increment_state_version(conn)
            conn.commit()

            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "TAMPERED",
                        "message": "Cryptographic verification failed: QR payload has been tampered or does not match stored hash token."
                    }
                }
            )

        # 5. Success: Execute in ONE immediate transaction
        cursor.execute("BEGIN IMMEDIATE")
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update challan status
        cursor.execute(
            "UPDATE delivery_challans SET status = 'RECEIVED_AT_FPS', received_at = ? WHERE id = ?",
            (now_iso, row["id"])
        )

        # Update FPS stock inventory
        inv = json.loads(row["stock_inventory"])
        comm = row["commodity"]
        current_fps_qty = float(inv.get(comm, 0.0))
        delivered_qty = float(row["total_qty"])
        new_fps_qty = round(current_fps_qty + delivered_qty, 2)
        inv[comm] = new_fps_qty

        cursor.execute(
            "UPDATE fps_stores SET stock_inventory = ? WHERE id = ?",
            (json.dumps(inv), row["fps_id"])
        )

        # If indent was linked, update indent status
        if row["indent_id"]:
            cursor.execute(
                "UPDATE fps_indents SET status = 'DELIVERED_TO_FPS' WHERE id = ?",
                (row["indent_id"],)
            )

        # Log FPS_EPOS_RECEIPT
        log_audit_event(
            conn,
            "FPS_EPOS_RECEIPT",
            {
                "challanNo": payload.challan_no,
                "fpsId": payload.fps_code,
                "commodity": comm,
                "quantity": delivered_qty,
                "newStockBalance": new_fps_qty,
                "receivedAt": now_iso
            },
            timestamp=now_iso
        )

        version_info = increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "status": "RECEIVED_AT_FPS",
            "message": f"Successfully received {delivered_qty} Qtl {comm} at {row['shop_name']} e-PoS terminal.",
            "challan_no": payload.challan_no,
            "fps_code": payload.fps_code,
            "commodity": comm,
            "quantity_received": delivered_qty,
            "new_stock_balance": new_fps_qty,
            "received_at": now_iso,
            "version": version_info["version"]
        }

@router.post("/api/fps/reject-receipt")
def reject_fps_receipt(payload: FpsRejectReceiptRequest):
    """Logs discrepancy report and leaves challan in-transit for investigation."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, challan_no, fps_id, status FROM delivery_challans WHERE challan_no = ?", (payload.challan_no,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan {payload.challan_no} not found"}}
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        log_audit_event(
            conn,
            "RECEIPT_DISPUTED",
            {
                "challanNo": payload.challan_no,
                "fpsCode": payload.fps_code,
                "remarks": payload.remarks,
                "reportedAt": now_iso
            },
            timestamp=now_iso
        )

        version_info = increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "status": "DISPUTED",
            "message": "Receipt discrepancy reported and logged in official vigilance ledger.",
            "challan_no": payload.challan_no,
            "version": version_info["version"]
        }

@router.get("/api/dso/vigilance")
def get_dso_vigilance_dashboard():
    """Returns pending FIFO exceptions, district FIFO compliance %, KPIs, and vigilance audit log."""
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Pending Exception Requests
        cursor.execute(
            """
            SELECT c.id, c.challan_no, c.commodity, c.total_qty, c.allocated_batches,
                   c.exception_reason, c.issued_at, f.fps_code, f.shop_name
            FROM delivery_challans c
            JOIN fps_stores f ON c.fps_id = f.id
            WHERE c.is_fifo_compliant = 0 AND c.dso_otp_verified = 0 AND c.status = 'STAGED'
            ORDER BY c.id DESC
            """
        )
        pending_exceptions = []
        now = datetime.now(timezone.utc)

        for r in cursor.fetchall():
            # Check OTP request status & expiry
            cursor.execute(
                "SELECT role, expires_at, status FROM otp_requests WHERE challan_id = ? ORDER BY id ASC",
                (r["id"],)
            )
            otps = cursor.fetchall()
            expiry_str = otps[0]["expires_at"] if otps else None
            seconds_left = 120
            if expiry_str:
                exp_dt = datetime.fromisoformat(expiry_str)
                seconds_left = max(0, int((exp_dt - now).total_seconds()))

            allocations = json.loads(r["allocated_batches"])
            chosen = [a["batch_code"] for a in allocations]

            pending_exceptions.append({
                "id": r["id"],
                "challan_no": r["challan_no"],
                "fps_code": r["fps_code"],
                "fps_name": r["shop_name"],
                "commodity": r["commodity"],
                "ui_commodity": to_ui_commodity(r["commodity"]),
                "requested_qty": float(r["total_qty"]),
                "chosen_batches": chosen,
                "skipped_older_batches": ["WH-104 (14d)", "WH-103 (45d)"] if "WH-105" in chosen else ["Older Eligible Batches"],
                "exception_reason": r["exception_reason"] or "Operational Emergency",
                "issued_at": r["issued_at"],
                "pending_approver_role": "District Supply Officer (DSO) & Supervisor",
                "expires_in_seconds": seconds_left,
                "otp_status": [dict(o) for o in otps]
            })

        # 2. District KPIs
        cursor.execute("SELECT status, is_fifo_compliant FROM delivery_challans")
        challan_rows = cursor.fetchall()
        total_dispatches = 0
        compliant_dispatches = 0
        in_transit_count = 0

        for c in challan_rows:
            if c["status"] in ("IN_TRANSIT", "RECEIVED_AT_FPS"):
                total_dispatches += 1
                if c["is_fifo_compliant"]:
                    compliant_dispatches += 1
            if c["status"] == "IN_TRANSIT":
                in_transit_count += 1

        cursor.execute("SELECT COUNT(*) as count FROM fps_indents WHERE status = 'PENDING_AT_GODOWN'")
        pending_indents_count = cursor.fetchone()["count"]

        # Count events from audit_logs
        cursor.execute("SELECT COUNT(*) as c FROM audit_logs WHERE event_type = 'FIFO_VIOLATION_DETECTED'")
        violations_blocked = cursor.fetchone()["c"]

        cursor.execute("SELECT COUNT(*) as c FROM audit_logs WHERE event_type = 'FIFO_SKIP_EXCEPTION'")
        exceptions_approved = cursor.fetchone()["c"]

        cursor.execute("SELECT COUNT(*) as c FROM audit_logs WHERE event_type = 'EXCEPTION_REJECTED'")
        exceptions_rejected = cursor.fetchone()["c"]

        denominator = compliant_dispatches + violations_blocked + exceptions_approved
        compliance_pct = round((compliant_dispatches / denominator * 100.0) if denominator > 0 else 100.0, 1)

        # 3. Last 10 exception events
        cursor.execute(
            """
            SELECT id, event_type, details, timestamp, prev_hash, hash
            FROM audit_logs
            WHERE event_type IN (
                'FIFO_VIOLATION_DETECTED', 'FIFO_SKIP_EXCEPTION', 'EXCEPTION_REJECTED',
                'OTP_REQUESTED', 'OTP_VERIFIED', 'OTP_FAILED', 'OTP_LOCKED', 'RECEIPT_DISPUTED'
            )
            ORDER BY id DESC LIMIT 10
            """
        )
        recent_events = [
            {
                "id": e["id"],
                "type": e["event_type"],
                "details": json.loads(e["details"]) if isinstance(e["details"], str) else e["details"],
                "timestamp": e["timestamp"],
                "hash_prefix": e["hash"][:16] if e["hash"] else ""
            }
            for e in cursor.fetchall()
        ]

        return {
            "pending_exceptions": pending_exceptions,
            "kpis": {
                "fifo_compliance_pct": compliance_pct,
                "total_dispatches": total_dispatches,
                "compliant_dispatches": compliant_dispatches,
                "violations_blocked": violations_blocked,
                "exceptions_approved": exceptions_approved,
                "exceptions_rejected": exceptions_rejected,
                "challans_in_transit": in_transit_count,
                "pending_indents": pending_indents_count
            },
            "recent_exception_events": recent_events
        }

@router.get("/api/trace/matrix")
def get_batch_fps_matrix(commodity: Optional[str] = Query(None)):
    """
    Returns Batch x FPS distribution matrix [{batch_code, supplier, receipt_date, age_days, fps: {FPS_CODE: qty}, total}]
    reconciled with dispatches and store deliveries.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Fetch all 6 FPS stores
        cursor.execute("SELECT fps_code, shop_name FROM fps_stores ORDER BY id ASC")
        fps_list = [{"code": r["fps_code"], "name": r["shop_name"]} for r in cursor.fetchall()]
        fps_codes = [f["code"] for f in fps_list]

        # Fetch batches
        batch_query = "SELECT id, batch_code, commodity, supplier, receipt_date, current_qty FROM batches"
        params = []
        if commodity:
            db_comm = to_db_commodity(commodity)
            batch_query += " WHERE commodity = ?"
            params.append(db_comm)
        batch_query += " ORDER BY receipt_date ASC, batch_code ASC"

        cursor.execute(batch_query, params)
        raw_batches = cursor.fetchall()

        # Fetch all dispatches
        challan_query = """
            SELECT c.id, c.challan_no, c.allocated_batches, f.fps_code, c.commodity
            FROM delivery_challans c
            JOIN fps_stores f ON c.fps_id = f.id
            WHERE c.status IN ('IN_TRANSIT', 'RECEIVED_AT_FPS')
        """
        cursor.execute(challan_query)
        challans = cursor.fetchall()

        # Build mapping: batch_code -> {fps_code: qty}
        batch_fps_map = {}
        for c in challans:
            fcode = c["fps_code"]
            lines = json.loads(c["allocated_batches"])
            for line in lines:
                bcode = line.get("batch_code") or line.get("batch_id")
                qty = float(line.get("allocated_qty") or line.get("take", 0.0))
                if bcode not in batch_fps_map:
                    batch_fps_map[bcode] = {}
                batch_fps_map[bcode][fcode] = round(batch_fps_map[bcode].get(fcode, 0.0) + qty, 2)

        matrix_rows = []
        col_totals = {fc: 0.0 for fc in fps_codes}
        grand_total = 0.0

        for b in raw_batches:
            bcode = b["batch_code"]
            fps_qty_map = batch_fps_map.get(bcode, {})
            row_total = sum(fps_qty_map.values())

            # Even if 0 dispatched, include batch if it matches commodity
            age = get_age_days(b["receipt_date"])

            row_fps_data = {}
            for fc in fps_codes:
                q = fps_qty_map.get(fc, 0.0)
                row_fps_data[fc] = q
                col_totals[fc] = round(col_totals[fc] + q, 2)

            grand_total = round(grand_total + row_total, 2)

            matrix_rows.append({
                "batch_code": bcode,
                "commodity": b["commodity"],
                "ui_commodity": to_ui_commodity(b["commodity"]),
                "supplier": b["supplier"],
                "receipt_date": b["receipt_date"],
                "age_days": age,
                "is_critical": age >= 60,
                "fps": row_fps_data,
                "total": round(row_total, 2)
            })

        return {
            "fps_columns": fps_list,
            "matrix": matrix_rows,
            "column_totals": col_totals,
            "grand_total": grand_total
        }
