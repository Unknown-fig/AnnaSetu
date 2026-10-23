import json
from fastapi import APIRouter
from typing import Dict, Any

from backend.db import get_db, get_state_version, increment_state_version
from backend.seed import seed_database
from backend.fifo import get_age_days
from backend.config import to_ui_commodity, to_ui_status

router = APIRouter(tags=["admin_and_state"])

@router.post("/api/admin/reset")
def reset_database():
    with get_db() as conn:
        seed_database(conn)
        version_info = increment_state_version(conn)
    return {
        "success": True,
        "message": "Database successfully reseeded with relative age distribution and cryptographic audit chain",
        "version": version_info["version"]
    }

@router.get("/api/state/version")
def get_version():
    with get_db() as conn:
        return get_state_version(conn)

@router.get("/api/state")
def get_full_state():
    with get_db() as conn:
        version_info = get_state_version(conn)
        cursor = conn.cursor()


        # 1. Batches
        cursor.execute("SELECT * FROM batches ORDER BY receipt_date ASC, batch_code ASC")
        raw_batches = cursor.fetchall()
        batches = []
        total_inv = 0.0
        critical_count = 0

        for r in raw_batches:
            age = get_age_days(r["receipt_date"])
            curr = float(r["current_qty"])
            res = float(r["reserved_qty"])
            total_inv += curr

            if age >= 60 and curr > 0:
                critical_count += 1

            if age <= 20:
                bucket = "Fresh (0-20)"
            elif age < 60:
                bucket = "Moderate (21-59)"
            else:
                bucket = "Critical (60+)"

            batches.append({
                "id": r["id"],
                "batchId": r["batch_code"],
                "batch_code": r["batch_code"],
                "commodity": r["commodity"],
                "ui_commodity": to_ui_commodity(r["commodity"]),
                "supplier": r["supplier"],
                "receiptDate": r["receipt_date"],
                "receipt_date": r["receipt_date"],
                "bay": r["stack_bay"],
                "stack_bay": r["stack_bay"],
                "stackPosition": r["stack_position"],
                "stack_position": r["stack_position"],
                "qtyReceivedQtl": float(r["initial_qty"]),
                "initial_qty": float(r["initial_qty"]),
                "remainingQtl": curr,
                "current_qty": curr,
                "reservedQtl": res,
                "reserved_qty": res,
                "availableQtl": max(0.0, curr - res),
                "qualityStatus": to_ui_status(r["status"]),
                "status": r["status"],
                "moisturePct": float(r["moisture_pct"]),
                "moisture_pct": float(r["moisture_pct"]),
                "sha256Hash": r["sha256_hash"],
                "sha256_hash": r["sha256_hash"],
                "age_days": age,
                "ageDays": age,
                "age_bucket": bucket
            })

        # 2. FPS Stores
        cursor.execute("SELECT * FROM fps_stores ORDER BY id ASC")
        raw_fps = cursor.fetchall()
        fps_stores = []
        for f in raw_fps:
            fps_stores.append({
                "id": f["id"],
                "fps_code": f["fps_code"],
                "fpsId": f["fps_code"],
                "name": f["shop_name"],
                "shop_name": f["shop_name"],
                "dealer_name": f["dealer_name"],
                "location": f["location"],
                "stock_inventory": json.loads(f["stock_inventory"])
            })

        # 3. FPS Indents
        cursor.execute(
            """
            SELECT i.*, f.fps_code, f.shop_name
            FROM fps_indents i
            JOIN fps_stores f ON i.fps_id = f.id
            ORDER BY i.id DESC
            """
        )
        raw_indents = cursor.fetchall()
        indents = []
        pending_indents_count = 0
        for i in raw_indents:
            if i["status"] == "PENDING_AT_GODOWN":
                pending_indents_count += 1
            indents.append({
                "id": i["id"],
                "indent_no": i["indent_no"],
                "fps_id": i["fps_id"],
                "fps_code": i["fps_code"],
                "fps_name": i["shop_name"],
                "commodity": i["commodity"],
                "ui_commodity": to_ui_commodity(i["commodity"]),
                "requested_qty": float(i["requested_qty"]),
                "priority": i["priority"],
                "status": i["status"],
                "created_at": i["created_at"]
            })

        # 4. Delivery Challans
        cursor.execute(
            """
            SELECT c.*, f.fps_code, f.shop_name
            FROM delivery_challans c
            JOIN fps_stores f ON c.fps_id = f.id
            ORDER BY c.id DESC
            """
        )
        raw_challans = cursor.fetchall()
        challans = []
        compliant_dispatches = 0
        total_dispatches = 0

        for c in raw_challans:
            is_done = c["status"] in ("IN_TRANSIT", "RECEIVED_AT_FPS")
            if is_done:
                total_dispatches += 1
                if c["is_fifo_compliant"]:
                    compliant_dispatches += 1

            challans.append({
                "id": c["id"],
                "challanNo": c["challan_no"],
                "challan_no": c["challan_no"],
                "indent_id": c["indent_id"],
                "fps_id": c["fps_id"],
                "fps_code": c["fps_code"],
                "fps_name": c["shop_name"],
                "commodity": c["commodity"],
                "ui_commodity": to_ui_commodity(c["commodity"]),
                "total_qty": float(c["total_qty"]),
                "allocated_batches": json.loads(c["allocated_batches"]),
                "is_fifo_compliant": bool(c["is_fifo_compliant"]),
                "exception_reason": c["exception_reason"],
                "dso_otp_verified": bool(c["dso_otp_verified"]),
                "crypto_token": c["crypto_token"],
                "token_prefix": c["crypto_token"][:16] if c["crypto_token"] else "",
                "status": c["status"],
                "issued_at": c["issued_at"],
                "received_at": c["received_at"]
            })

        # 5. Audit Logs (latest 200)
        cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200")
        raw_logs = cursor.fetchall()
        logs = []
        violations_count = 0
        exceptions_count = 0

        for l in raw_logs:
            if l["event_type"] == "FIFO_VIOLATION_DETECTED":
                violations_count += 1
            elif l["event_type"] == "FIFO_SKIP_EXCEPTION":
                exceptions_count += 1

            details_dict = {}
            try:
                details_dict = json.loads(l["details"])
            except Exception:
                pass

            logs.append({
                "id": l["id"],
                "event_type": l["event_type"],
                "type": l["event_type"],
                "details": details_dict,
                "timestamp": l["timestamp"],
                "prev_hash": l["prev_hash"],
                "prevHash": l["prev_hash"],
                "hash": l["hash"],
                "hash_prefix": l["hash"][:16],
                "hashPrefix": l["hash"][:16]
            })

        # FIFO Compliance Rate
        denom = total_dispatches + violations_count + exceptions_count
        compliance_pct = round((compliant_dispatches / denom * 100), 1) if denom > 0 else 100.0

        # Stock Age KPI calculations
        active_batches = [b for b in batches if b["current_qty"] > 0]
        total_active_age = sum(b["age_days"] for b in active_batches)
        active_count = len(active_batches)
        avg_age = round(total_active_age / active_count, 1) if active_count > 0 else 0.0
        max_age = max((b["age_days"] for b in active_batches), default=0)

        return {
            "version": version_info["version"],
            "updated_at": version_info["updated_at"],
            "batches": batches,
            "fps_stores": fps_stores,
            "fps_indents": indents,
            "delivery_challans": challans,
            "audit_logs": logs,
            "kpis": {
                "total_inventory_qtl": round(total_inv, 2),
                "fifo_compliance_pct": compliance_pct,
                "fifo_compliance_rate": compliance_pct,
                "critical_batches": critical_count,
                "total_dispatches": total_dispatches,
                "pending_indents": pending_indents_count,
                "avg_stock_age_days": avg_age,
                "average_stock_age_days": avg_age,
                "max_stock_age_days": max_age,
                "active_batch_count": active_count
            }
        }

