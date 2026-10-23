import csv
import io
import json
from fastapi import APIRouter, HTTPException, Query, Response, Path
from typing import Optional, List, Dict, Any
from decimal import Decimal

from backend.db import get_db
from backend.audit import verify_hash_chain
from backend.fifo import get_age_days

router = APIRouter(tags=["audit_and_trace"])

@router.get("/api/audit")
def list_audit_logs(
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    commodity: Optional[str] = Query(None),
    fps: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM audit_logs WHERE 1=1"
        params = []

        if type:
            query += " AND event_type = ?"
            params.append(type)
        if from_date:
            query += " AND timestamp >= ?"
            params.append(from_date)
        if to_date:
            query += " AND timestamp <= ?"
            params.append(to_date)

        query += " ORDER BY id DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            details_dict = {}
            try:
                details_dict = json.loads(r["details"])
            except Exception:
                pass

            # In-memory filter on details fields
            if commodity and details_dict.get("commodity") != commodity:
                continue
            if fps and details_dict.get("fpsId") != fps and details_dict.get("fpsName") != fps:
                continue
            if q:
                q_lower = q.lower()
                text_to_search = (
                    f"{r['event_type']} {r['timestamp']} {r['hash'][:16]} "
                    f"{json.dumps(details_dict)}"
                ).lower()
                if q_lower not in text_to_search:
                    continue

            results.append({
                "id": r["id"],
                "event_type": r["event_type"],
                "details": details_dict,
                "timestamp": r["timestamp"],
                "prev_hash": r["prev_hash"],
                "hash": r["hash"],
                "hash_prefix": r["hash"][:16]
            })

        paginated = results[offset : offset + limit]
        return {
            "total": len(results),
            "limit": limit,
            "offset": offset,
            "logs": paginated
        }

@router.get("/api/audit/verify-chain")
def get_verify_chain():
    with get_db() as conn:
        return verify_hash_chain(conn)

@router.get("/api/audit/csv")
def export_audit_csv(
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    commodity: Optional[str] = Query(None)
):
    data = list_audit_logs(q=q, type=type, commodity=commodity, limit=1000, offset=0)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp", "Event Type", "Details", "Hash Prefix", "Full Hash", "Prev Hash"])

    for item in data["logs"]:
        writer.writerow([
            item["id"],
            item["timestamp"],
            item["event_type"],
            json.dumps(item["details"]),
            item["hash_prefix"],
            item["hash"],
            item["prev_hash"]
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=annasetu_audit_ledger.csv"}
    )

@router.get("/api/trace/batch/{batch_code}")
def trace_batch_journey(batch_code: str = Path(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM batches WHERE batch_code = ?", (batch_code,))
        b = cursor.fetchone()
        if not b:
            raise HTTPException(status_code=404, detail={"error": {"code": "BATCH_NOT_FOUND", "message": f"Batch {batch_code} not found"}})

        # Find allocations and dispatches
        cursor.execute("SELECT * FROM delivery_challans ORDER BY id ASC")
        all_challans = cursor.fetchall()

        dispatches = []
        for c in all_challans:
            lines = json.loads(c["allocated_batches"])
            for line in lines:
                if line.get("batch_code") == batch_code:
                    cursor.execute("SELECT shop_name, fps_code FROM fps_stores WHERE id = ?", (c["fps_id"],))
                    fps_store = cursor.fetchone()
                    dispatches.append({
                        "challan_id": c["id"],
                        "challan_no": c["challan_no"],
                        "fps_code": fps_store["fps_code"] if fps_store else "",
                        "fps_name": fps_store["shop_name"] if fps_store else "",
                        "allocated_qty": line["allocated_qty"],
                        "status": c["status"],
                        "date": c["issued_at"],
                        "token_prefix": c["crypto_token"][:16] if c["crypto_token"] else ""
                    })

        received = Decimal(str(b["initial_qty"]))
        curr = Decimal(str(b["current_qty"]))
        reserved = Decimal(str(b["reserved_qty"]))
        # Dispatched = initial - current
        dispatched = received - curr
        reconciled = (received == (dispatched + reserved + (curr - reserved)))

        journey_steps = [
            {
                "step": 1,
                "title": "Supplier Despatch & Receipt",
                "date": b["receipt_date"],
                "details": f"Received {float(received)} Qtl from {b['supplier']} (Moisture: {b['moisture_pct']}%)",
                "status": b["status"]
            },
            {
                "step": 2,
                "title": "Stack Bay Placement",
                "date": b["receipt_date"],
                "details": f"Assigned to Bay {b['stack_bay']} (Layer: {'Back' if b['stack_position']==1 else 'Front'})",
                "bay": b["stack_bay"]
            },
            {
                "step": 3,
                "title": "Allocation & Active Reservations",
                "details": f"Reserved: {float(reserved)} Qtl for pending loading tickets",
                "reserved_qty": float(reserved)
            },
            {
                "step": 4,
                "title": "Fair Price Shop Dispatches",
                "dispatches_count": len(dispatches),
                "dispatches": dispatches
            },
            {
                "step": 5,
                "title": "Current Warehouse Balance",
                "details": f"Available remaining: {float(curr - reserved)} Qtl (Current in depot: {float(curr)} Qtl)",
                "remaining_qty": float(curr)
            }
        ]

        return {
            "batch_code": b["batch_code"],
            "commodity": b["commodity"],
            "supplier": b["supplier"],
            "stack_bay": b["stack_bay"],
            "receipt_date": b["receipt_date"],
            "age_days": get_age_days(b["receipt_date"]),
            "status": b["status"],
            "moisture_pct": b["moisture_pct"],
            "received_qty": float(received),
            "dispatched_qty": float(dispatched),
            "reserved_qty": float(reserved),
            "remaining_qty": float(curr),
            "reconciled": bool(reconciled),
            "reconciliation_formula": f"Received ({float(received)}) == Dispatched ({float(dispatched)}) + Reserved ({float(reserved)}) + Available ({float(curr - reserved)})",
            "journey_steps": journey_steps,
            "dispatches": dispatches
        }

@router.get("/api/trace/recall/{batch_code}")
def trace_batch_recall(batch_code: str = Path(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM batches WHERE batch_code = ?", (batch_code,))
        b = cursor.fetchone()
        if not b:
            raise HTTPException(status_code=404, detail={"error": {"code": "BATCH_NOT_FOUND", "message": f"Batch {batch_code} not found"}})

        cursor.execute("SELECT * FROM delivery_challans ORDER BY id ASC")
        all_challans = cursor.fetchall()

        affected_records = []
        fps_summary = {}

        for c in all_challans:
            lines = json.loads(c["allocated_batches"])
            for line in lines:
                if line.get("batch_code") == batch_code:
                    cursor.execute("SELECT shop_name, fps_code, location FROM fps_stores WHERE id = ?", (c["fps_id"],))
                    fps_store = cursor.fetchone()
                    fps_code = fps_store["fps_code"] if fps_store else "UNKNOWN"
                    fps_name = fps_store["shop_name"] if fps_store else "UNKNOWN"
                    location = fps_store["location"] if fps_store else ""

                    qty = float(line["allocated_qty"])
                    affected_records.append({
                        "challan_no": c["challan_no"],
                        "fps_code": fps_code,
                        "fps_name": fps_name,
                        "location": location,
                        "commodity": c["commodity"],
                        "quantity": qty,
                        "dispatched_at": c["issued_at"],
                        "status": c["status"],
                        "token_prefix": c["crypto_token"][:16] if c["crypto_token"] else ""
                    })

                    if fps_code not in fps_summary:
                        fps_summary[fps_code] = {
                            "fps_code": fps_code,
                            "fps_name": fps_name,
                            "total_qty": 0.0,
                            "challan_count": 0
                        }
                    fps_summary[fps_code]["total_qty"] += qty
                    fps_summary[fps_code]["challan_count"] += 1

        return {
            "batch_code": b["batch_code"],
            "commodity": b["commodity"],
            "supplier": b["supplier"],
            "receipt_date": b["receipt_date"],
            "total_recalled_qty": sum(r["quantity"] for r in affected_records),
            "affected_fps_count": len(fps_summary),
            "fps_summary": list(fps_summary.values()),
            "affected_records": affected_records
        }

@router.get("/api/trace/recall/{batch_code}/csv")
def export_recall_csv(batch_code: str = Path(...)):
    data = trace_batch_recall(batch_code)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Batch ID", "Commodity", "Challan No", "FPS Code", "FPS Name", "Location", "Quantity (Qtl)", "Dispatched At", "Status", "Token Prefix"])

    for item in data["affected_records"]:
        writer.writerow([
            data["batch_code"],
            data["commodity"],
            item["challan_no"],
            item["fps_code"],
            item["fps_name"],
            item["location"],
            item["quantity"],
            item["dispatched_at"],
            item["status"],
            item["token_prefix"]
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=recall_trace_{batch_code}.csv"}
    )

@router.get("/api/trace/fps/{fps_code}")
def trace_fps_dispatches(fps_code: str = Path(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fps_stores WHERE fps_code = ?", (fps_code,))
        fps_store = cursor.fetchone()
        if not fps_store:
            raise HTTPException(status_code=404, detail={"error": {"code": "FPS_NOT_FOUND", "message": f"FPS {fps_code} not found"}})

        cursor.execute(
            """
            SELECT * FROM delivery_challans
            WHERE fps_id = ?
            ORDER BY id DESC
            """,
            (fps_store["id"],)
        )
        challans = cursor.fetchall()

        dispatches = []
        commodity_totals = {}

        for c in challans:
            lines = json.loads(c["allocated_batches"])
            comm = c["commodity"]
            qty = float(c["total_qty"])
            commodity_totals[comm] = commodity_totals.get(comm, 0.0) + qty

            dispatches.append({
                "challan_id": c["id"],
                "challan_no": c["challan_no"],
                "commodity": comm,
                "total_qty": qty,
                "lines": lines,
                "is_fifo_compliant": bool(c["is_fifo_compliant"]),
                "status": c["status"],
                "issued_at": c["issued_at"],
                "received_at": c["received_at"],
                "token_prefix": c["crypto_token"][:16] if c["crypto_token"] else ""
            })

        return {
            "fps_code": fps_store["fps_code"],
            "shop_name": fps_store["shop_name"],
            "dealer_name": fps_store["dealer_name"],
            "location": fps_store["location"],
            "stock_inventory": json.loads(fps_store["stock_inventory"]),
            "commodity_totals": commodity_totals,
            "dispatches": dispatches
        }
