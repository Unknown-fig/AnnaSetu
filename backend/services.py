"""
Shared service functions for AnnaSetu backend operations.
"""
import json
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException
from backend.audit import log_audit_event
from backend.db import increment_state_version

def receive_challan_service(conn, challan_id: int | None = None, challan_no: str | None = None) -> dict:
    """
    Executes FPS delivery challan receipt in ONE immediate atomic transaction:
    1. Sets delivery_challans.status = 'RECEIVED_AT_FPS' and received_at.
    2. Adds delivered quantity to fps_stores.stock_inventory[commodity] with 2-decimal rounding.
    3. Sets linked fps_indents.status = 'DELIVERED_TO_FPS'.
    4. Writes the FPS_EPOS_RECEIPT audit event.
    5. Increments the system state version.

    Idempotent: A second call returns status ALREADY_RECEIVED and never double-adds stock.
    """
    cursor = conn.cursor()

    if challan_id is not None:
        cursor.execute(
            """
            SELECT c.*, f.fps_code, f.shop_name, f.stock_inventory
            FROM delivery_challans c
            JOIN fps_stores f ON c.fps_id = f.id
            WHERE c.id = ?
            """,
            (challan_id,)
        )
    elif challan_no is not None:
        cursor.execute(
            """
            SELECT c.*, f.fps_code, f.shop_name, f.stock_inventory
            FROM delivery_challans c
            JOIN fps_stores f ON c.fps_id = f.id
            WHERE c.challan_no = ?
            """,
            (challan_no,)
        )
    else:
        raise ValueError("Either challan_id or challan_no must be provided")

    row = cursor.fetchone()
    if not row:
        identifier = challan_id if challan_id is not None else challan_no
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan {identifier} not found"}}
        )

    # Idempotency check: Already received
    if row["status"] == "RECEIVED_AT_FPS":
        inv = json.loads(row["stock_inventory"])
        return {
            "success": True,
            "status": "ALREADY_RECEIVED",
            "already_received": True,
            "challan_id": row["id"],
            "challan_no": row["challan_no"],
            "received_at": row["received_at"],
            "fps_code": row["fps_code"],
            "updated_fps_inventory": inv,
            "message": f"Challan {row['challan_no']} was already confirmed at {row['received_at']}."
        }

    # Status must be IN_TRANSIT
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

    cursor.execute("BEGIN IMMEDIATE")
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Update delivery challan
    cursor.execute(
        "UPDATE delivery_challans SET status = 'RECEIVED_AT_FPS', received_at = ? WHERE id = ?",
        (now_iso, row["id"])
    )

    # 2. Update FPS stock inventory with 2-decimal rounding
    inv = json.loads(row["stock_inventory"])
    comm = row["commodity"]
    current_fps_qty = float(inv.get(comm, 0.0))
    delivered_qty = float(row["total_qty"])
    new_fps_qty = round(float(Decimal(str(current_fps_qty)) + Decimal(str(delivered_qty))), 2)
    inv[comm] = new_fps_qty

    cursor.execute(
        "UPDATE fps_stores SET stock_inventory = ? WHERE id = ?",
        (json.dumps(inv), row["fps_id"])
    )

    # 3. If indent was linked, update indent status
    if row["indent_id"]:
        cursor.execute(
            "UPDATE fps_indents SET status = 'DELIVERED_TO_FPS' WHERE id = ?",
            (row["indent_id"],)
        )

    # 4. Log FPS_EPOS_RECEIPT audit event
    log_audit_event(
        conn,
        "FPS_EPOS_RECEIPT",
        {
            "challanNo": row["challan_no"],
            "fpsId": row["fps_code"],
            "commodity": comm,
            "quantity": delivered_qty,
            "newStockBalance": new_fps_qty,
            "receivedAt": now_iso
        },
        timestamp=now_iso
    )

    # 5. Increment state version
    version_info = increment_state_version(conn)
    conn.commit()

    return {
        "success": True,
        "status": "RECEIVED_AT_FPS",
        "already_received": False,
        "challan_id": row["id"],
        "challan_no": row["challan_no"],
        "fps_code": row["fps_code"],
        "commodity": comm,
        "quantity_received": delivered_qty,
        "new_stock_balance": new_fps_qty,
        "received_at": now_iso,
        "updated_fps_inventory": inv,
        "version": version_info["version"] if isinstance(version_info, dict) else version_info,
        "message": f"Successfully received {delivered_qty} Qtl {comm} at {row['shop_name']} e-PoS terminal."
    }
