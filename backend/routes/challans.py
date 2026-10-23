import json
import hashlib
from fastapi import APIRouter, HTTPException, Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from decimal import Decimal

from backend.db import get_db, increment_state_version
from backend.models import (
    WaterfallPreviewRequest,
    ChallanStageRequest,
    ChallanStageManualRequest,
    ExceptionOtpRequest,
    OtpVerifyRequest,
    ScanLineRequest
)
from backend.fifo import allocate_fifo, check_fifo_violation, ShortfallError, get_age_days
from backend.audit import log_audit_event, canonical_json
from backend.otp import create_otp_request, verify_otp_attempt
from backend.config import to_db_commodity, REQUIRED_OTP_APPROVERS

router = APIRouter(prefix="/api/challans", tags=["challans"])

def compute_crypto_token(payload: Dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()

@router.post("/preview-waterfall")
def preview_waterfall(payload: WaterfallPreviewRequest):
    comm = to_db_commodity(payload.commodity)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM batches WHERE commodity = ?", (comm,))
        batch_rows = [dict(r) for r in cursor.fetchall()]

    try:
        result = allocate_fifo(batch_rows, comm, payload.requested_qty)
        return {
            "success": True,
            "commodity": comm,
            "requested_qty": payload.requested_qty,
            "waterfall_steps": result["waterfall_steps"],
            "allocated_batches": result["allocated_batches"],
            "skipped_holds": result["skipped_holds"],
            "total_allocated": result["total_allocated"],
            "is_fifo_compliant": True
        }
    except ShortfallError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "STOCK_SHORTFALL", "message": e.message, "shortfall": e.shortfall, "available": e.available}}
        )

@router.post("/stage")
def stage_challan(payload: ChallanStageRequest):
    comm = to_db_commodity(payload.commodity)

    with get_db() as conn:
        cursor = conn.cursor()
        # BEGIN IMMEDIATE ensures atomic reservation check without race conditions
        cursor.execute("BEGIN IMMEDIATE")

        cursor.execute("SELECT id, shop_name FROM fps_stores WHERE fps_code = ?", (payload.fps_code,))
        fps_row = cursor.fetchone()
        if not fps_row:
            conn.rollback()
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "FPS_NOT_FOUND", "message": f"FPS {payload.fps_code} not found"}}
            )
        fps_id = fps_row["id"]
        fps_name = fps_row["shop_name"]

        cursor.execute("SELECT * FROM batches WHERE commodity = ?", (comm,))
        batches = [dict(r) for r in cursor.fetchall()]

        try:
            alloc_result = allocate_fifo(batches, comm, payload.requested_qty)
        except ShortfallError as e:
            conn.rollback()
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "STOCK_SHORTFALL", "message": e.message, "shortfall": e.shortfall, "available": e.available}}
            )

        # Increment reserved_qty on each allocated batch
        for line in alloc_result["allocated_batches"]:
            cursor.execute(
                """
                UPDATE batches
                SET reserved_qty = reserved_qty + ?
                WHERE id = ? AND (current_qty - reserved_qty) >= ?
                """,
                (line["allocated_qty"], line["batch_id"], line["allocated_qty"])
            )
            if cursor.rowcount == 0:
                conn.rollback()
                raise HTTPException(
                    status_code=409,
                    detail={"error": {"code": "CONCURRENT_ALLOCATION_CONFLICT", "message": f"Stock in batch {line['batch_code']} was reserved by a concurrent transaction"}}
                )

        now = datetime.now(timezone.utc)
        year = now.year
        cursor.execute("SELECT COUNT(*) as count FROM delivery_challans")
        challan_count = cursor.fetchone()["count"]
        challan_no = f"GBN-iPDS-{year}-{challan_count + 1:04d}"
        now_iso = now.isoformat()

        token_payload = {
            "challanNo": challan_no,
            "fps": payload.fps_code,
            "commodity": comm,
            "qty": payload.requested_qty,
            "lines": alloc_result["allocated_batches"],
            "issuedAt": now_iso,
            "deviceId": payload.device_id or "DEVICE_PORTAL_01",
            "localSeq": payload.local_seq or 1,
            "prevTokenHash": payload.prev_token_hash or "GENESIS_TOKEN_ROOT"
        }
        crypto_token = compute_crypto_token(token_payload)

        cursor.execute(
            """
            INSERT INTO delivery_challans (
                challan_no, indent_id, fps_id, commodity, total_qty,
                allocated_batches, is_fifo_compliant, dso_otp_verified,
                crypto_token, prev_token_hash, device_id, local_seq,
                status, issued_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, 'STAGED', ?)
            """,
            (
                challan_no, payload.indent_id, fps_id, comm, payload.requested_qty,
                json.dumps(alloc_result["allocated_batches"]), crypto_token,
                payload.prev_token_hash, payload.device_id, payload.local_seq, now_iso
            )
        )
        challan_id = cursor.lastrowid

        if payload.indent_id:
            cursor.execute(
                "UPDATE fps_indents SET status = 'CHALLAN_ISSUED' WHERE id = ?",
                (payload.indent_id,)
            )

        # Audit log WATERFALL_ALLOCATION
        log_audit_event(
            conn,
            "WATERFALL_ALLOCATION",
            {
                "challanNo": challan_no,
                "fpsId": payload.fps_code,
                "fpsName": fps_name,
                "commodity": comm,
                "quantity": payload.requested_qty,
                "tokenPrefix": crypto_token[:16],
                "linesCount": len(alloc_result["allocated_batches"]),
                "isFifoCompliant": True
            },
            timestamp=now_iso
        )

        increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "id": challan_id,
            "challan_no": challan_no,
            "fps_code": payload.fps_code,
            "fps_name": fps_name,
            "commodity": comm,
            "total_qty": payload.requested_qty,
            "allocated_batches": alloc_result["allocated_batches"],
            "waterfall_steps": alloc_result["waterfall_steps"],
            "skipped_holds": alloc_result["skipped_holds"],
            "is_fifo_compliant": True,
            "dso_otp_verified": True,
            "crypto_token": crypto_token,
            "token_prefix": crypto_token[:16],
            "status": "STAGED",
            "issued_at": now_iso
        }

@router.post("/stage-manual")
def stage_manual_challan(payload: ChallanStageManualRequest):
    comm = to_db_commodity(payload.commodity)

    total_picked = sum(p.qty for p in payload.selected_picks)
    if abs(total_picked - payload.requested_qty) > 0.01:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "SUM_MISMATCH", "message": f"Sum of manual picks ({total_picked} Qtl) must equal requested quantity ({payload.requested_qty} Qtl)"}}
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")

        cursor.execute("SELECT id, shop_name FROM fps_stores WHERE fps_code = ?", (payload.fps_code,))
        fps_row = cursor.fetchone()
        if not fps_row:
            conn.rollback()
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "FPS_NOT_FOUND", "message": f"FPS {payload.fps_code} not found"}}
            )
        fps_id = fps_row["id"]
        fps_name = fps_row["shop_name"]

        cursor.execute("SELECT * FROM batches WHERE commodity = ?", (comm,))
        batches = [dict(r) for r in cursor.fetchall()]

        picks_dicts = [{"batch_code": p.batch_code, "qty": p.qty} for p in payload.selected_picks]
        is_violation, skipped_codes, reason = check_fifo_violation(batches, comm, picks_dicts)

        # Build lines
        lines = []
        batch_map = {b["batch_code"]: b for b in batches}
        for p in payload.selected_picks:
            if p.qty > 0:
                b = batch_map.get(p.batch_code)
                if not b:
                    conn.rollback()
                    raise HTTPException(status_code=404, detail={"error": {"code": "BATCH_NOT_FOUND", "message": f"Batch {p.batch_code} not found"}})
                avail = b["current_qty"] - b["reserved_qty"]
                if avail < p.qty:
                    conn.rollback()
                    raise HTTPException(status_code=400, detail={"error": {"code": "INSUFFICIENT_BATCH_STOCK", "message": f"Batch {p.batch_code} has only {avail} Qtl available"}})

                lines.append({
                    "batch_id": b["id"],
                    "batch_code": b["batch_code"],
                    "stack_bay": b["stack_bay"],
                    "allocated_qty": p.qty,
                    "batch_age_days": get_age_days(b["receipt_date"])
                })

        # Reserve stock
        for line in lines:
            cursor.execute(
                "UPDATE batches SET reserved_qty = reserved_qty + ? WHERE id = ?",
                (line["allocated_qty"], line["batch_id"])
            )

        now = datetime.now(timezone.utc)
        year = now.year
        cursor.execute("SELECT COUNT(*) as count FROM delivery_challans")
        challan_count = cursor.fetchone()["count"]
        challan_no = f"GBN-iPDS-{year}-{challan_count + 1:04d}"
        now_iso = now.isoformat()

        token_payload = {
            "challanNo": challan_no,
            "fps": payload.fps_code,
            "commodity": comm,
            "qty": payload.requested_qty,
            "lines": lines,
            "issuedAt": now_iso,
            "deviceId": payload.device_id or "DEVICE_PORTAL_01",
            "localSeq": payload.local_seq or 1,
            "prevTokenHash": payload.prev_token_hash or "GENESIS_TOKEN_ROOT"
        }
        crypto_token = compute_crypto_token(token_payload)

        is_fifo_compliant = 0 if is_violation else 1
        dso_otp_verified = 0 if is_violation else 1

        cursor.execute(
            """
            INSERT INTO delivery_challans (
                challan_no, indent_id, fps_id, commodity, total_qty,
                allocated_batches, is_fifo_compliant, exception_reason,
                dso_otp_verified, crypto_token, prev_token_hash, device_id,
                local_seq, status, issued_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STAGED', ?)
            """,
            (
                challan_no, payload.indent_id, fps_id, comm, payload.requested_qty,
                json.dumps(lines), is_fifo_compliant, reason if is_violation else None,
                dso_otp_verified, crypto_token, payload.prev_token_hash,
                payload.device_id, payload.local_seq, now_iso
            )
        )
        challan_id = cursor.lastrowid

        if is_violation:
            log_audit_event(
                conn,
                "FIFO_VIOLATION_DETECTED",
                {
                    "challanNo": challan_no,
                    "fpsId": payload.fps_code,
                    "commodity": comm,
                    "skippedBatches": skipped_codes,
                    "reason": reason,
                    "tokenPrefix": crypto_token[:16]
                },
                timestamp=now_iso
            )
        else:
            log_audit_event(
                conn,
                "WATERFALL_ALLOCATION",
                {
                    "challanNo": challan_no,
                    "fpsId": payload.fps_code,
                    "commodity": comm,
                    "quantity": payload.requested_qty,
                    "tokenPrefix": crypto_token[:16],
                    "isFifoCompliant": True
                },
                timestamp=now_iso
            )

        increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "id": challan_id,
            "challan_no": challan_no,
            "fps_code": payload.fps_code,
            "fps_name": fps_name,
            "commodity": comm,
            "total_qty": payload.requested_qty,
            "allocated_batches": lines,
            "is_fifo_compliant": not is_violation,
            "requires_exception": is_violation,
            "skipped_batches": skipped_codes,
            "violation_reason": reason if is_violation else None,
            "dso_otp_verified": not is_violation,
            "crypto_token": crypto_token,
            "token_prefix": crypto_token[:16],
            "status": "STAGED",
            "issued_at": now_iso
        }

@router.post("/{id}/exception/request-otp")
def request_exception_otp(id: int = Path(...), payload: ExceptionOtpRequest = None):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_challans WHERE id = ?", (id,))
        challan = cursor.fetchone()
        if not challan:
            raise HTTPException(status_code=404, detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan #{id} not found"}})

        cursor.execute("BEGIN IMMEDIATE")
        exc_str = f"{payload.reason} | Officer: {payload.operator_name} | Remarks: {payload.remarks}"
        cursor.execute(
            "UPDATE delivery_challans SET exception_reason = ? WHERE id = ?",
            (exc_str, id)
        )

        roles = ["SUPERVISOR", "DSO"]
        for role in roles:
            create_otp_request(conn, id, role, expiry_seconds=120)

        now_iso = datetime.now(timezone.utc).isoformat()
        log_audit_event(
            conn,
            "OTP_REQUESTED",
            {
                "challanNo": challan["challan_no"],
                "reason": payload.reason,
                "operatorName": payload.operator_name,
                "requiredApprovers": REQUIRED_OTP_APPROVERS,
                "expirySeconds": 120
            },
            timestamp=now_iso
        )

        conn.commit()

        return {
            "success": True,
            "challan_id": id,
            "challan_no": challan["challan_no"],
            "roles": roles,
            "required_approvers": REQUIRED_OTP_APPROVERS,
            "expires_in_seconds": 120,
            "message": "OTPs dispatched to Approver rugged handsets (Simulated SMS view)"
        }

@router.post("/{id}/exception/verify-otp")
def verify_exception_otp(id: int = Path(...), payload: OtpVerifyRequest = None):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_challans WHERE id = ?", (id,))
        challan = cursor.fetchone()
        if not challan:
            raise HTTPException(status_code=404, detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan #{id} not found"}})

        cursor.execute("BEGIN IMMEDIATE")
        success, code, msg = verify_otp_attempt(conn, id, payload.role, payload.otp)
        now_iso = datetime.now(timezone.utc).isoformat()

        if not success:
            event_type = "OTP_LOCKED" if code == "LOCKED" else "OTP_FAILED"
            log_audit_event(
                conn,
                event_type,
                {
                    "challanNo": challan["challan_no"],
                    "role": payload.role,
                    "reason": msg
                },
                timestamp=now_iso
            )
            conn.commit()

            status_code = 423 if code == "LOCKED" else 400
            raise HTTPException(
                status_code=status_code,
                detail={"error": {"code": code, "message": msg}}
            )

        log_audit_event(
            conn,
            "OTP_VERIFIED",
            {
                "challanNo": challan["challan_no"],
                "role": payload.role
            },
            timestamp=now_iso
        )

        # Check total verified distinct roles for this challan
        cursor.execute(
            """
            SELECT COUNT(DISTINCT role) as count
            FROM otp_requests
            WHERE challan_id = ? AND used = 1 AND status = 'VERIFIED'
            """,
            (id,)
        )
        verified_count = cursor.fetchone()["count"]

        fully_authorized = verified_count >= REQUIRED_OTP_APPROVERS
        if fully_authorized:
            cursor.execute(
                "UPDATE delivery_challans SET dso_otp_verified = 1 WHERE id = ?",
                (id,)
            )
            log_audit_event(
                conn,
                "FIFO_SKIP_EXCEPTION",
                {
                    "challanNo": challan["challan_no"],
                    "approvedBy": f"{verified_count} approvers (SUPERVISOR + DSO)",
                    "exceptionReason": challan["exception_reason"]
                },
                timestamp=now_iso
            )

        increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "role": payload.role,
            "verified_approvers": verified_count,
            "required_approvers": REQUIRED_OTP_APPROVERS,
            "fully_authorized": fully_authorized,
            "message": "Dual-OTP verification complete. Dispatch unlocked" if fully_authorized else f"{payload.role} verified. Awaiting second approver"
        }

@router.post("/{id}/scan")
def scan_challan_line(id: int = Path(...), payload: ScanLineRequest = None):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_challans WHERE id = ?", (id,))
        challan = cursor.fetchone()
        if not challan:
            raise HTTPException(status_code=404, detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan #{id} not found"}})

        lines = json.loads(challan["allocated_batches"])
        if payload.line_no < 1 or payload.line_no > len(lines):
            raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_LINE_NO", "message": f"Line {payload.line_no} out of range (1-{len(lines)})"}})

        target_line = lines[payload.line_no - 1]

        # Determine scanned batch code
        scanned_code = payload.batch_code
        if payload.qr_payload:
            try:
                parsed = json.loads(payload.qr_payload)
                if parsed.get("t") == "BATCH":
                    scanned_code = parsed.get("batchId")
                elif parsed.get("t") == "CHALLAN_LINE":
                    scanned_code = parsed.get("batchCode")
                else:
                    scanned_code = None
            except Exception:
                scanned_code = None

            if not scanned_code:
                return {
                    "status": "INVALID",
                    "line_no": payload.line_no,
                    "message": "Unrecognized or foreign QR payload format"
                }

        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("BEGIN IMMEDIATE")

        # 1. Correct line
        if scanned_code == target_line["batch_code"]:
            log_audit_event(
                conn,
                "SCAN_VERIFIED",
                {
                    "challanNo": challan["challan_no"],
                    "lineNo": payload.line_no,
                    "batchCode": scanned_code,
                    "bay": target_line["stack_bay"],
                    "quantity": target_line["allocated_qty"]
                },
                timestamp=now_iso
            )
            conn.commit()
            return {
                "status": "VERIFIED",
                "line_no": payload.line_no,
                "batch_code": scanned_code,
                "allocated_qty": target_line["allocated_qty"],
                "bay": target_line["stack_bay"],
                "total_lines": len(lines),
                "is_last_line": payload.line_no == len(lines)
            }

        # 2. Check if scanned code belongs to a different line in this challan
        other_lines = [l["batch_code"] for idx, l in enumerate(lines) if idx != (payload.line_no - 1)]
        if scanned_code in other_lines:
            log_audit_event(
                conn,
                "SCAN_REJECTED",
                {
                    "challanNo": challan["challan_no"],
                    "lineNo": payload.line_no,
                    "expected": target_line["batch_code"],
                    "scanned": scanned_code,
                    "reason": "Scanned line out of sequence"
                },
                timestamp=now_iso
            )
            conn.commit()
            return {
                "status": "WRONG_BATCH",
                "line_no": payload.line_no,
                "expected": target_line["batch_code"],
                "scanned": scanned_code,
                "message": f"Wrong sequence: Expected batch {target_line['batch_code']} for step {payload.line_no}"
            }

        # 3. Completely wrong or newer batch
        log_audit_event(
            conn,
            "SCAN_REJECTED",
            {
                "challanNo": challan["challan_no"],
                "lineNo": payload.line_no,
                "expected": target_line["batch_code"],
                "scanned": scanned_code,
                "reason": "Unassigned or newer batch scanned at loading gate"
            },
            timestamp=now_iso
        )
        conn.commit()
        return {
            "status": "WRONG_BATCH",
            "line_no": payload.line_no,
            "expected": target_line["batch_code"],
            "scanned": scanned_code,
            "message": f"FIFO Violation: Batch {scanned_code} does not match active line {target_line['batch_code']}"
        }

@router.post("/{id}/dispatch")
def complete_dispatch(id: int = Path(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_challans WHERE id = ?", (id,))
        challan = cursor.fetchone()
        if not challan:
            raise HTTPException(status_code=404, detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan #{id} not found"}})

        if challan["status"] != "STAGED":
            raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_STATUS", "message": f"Challan #{id} is already in status {challan['status']}"}})

        # Security check: must be FIFO compliant or OTP verified
        if not challan["is_fifo_compliant"] and not challan["dso_otp_verified"]:
            raise HTTPException(
                status_code=403,
                detail={"error": {"code": "EXCEPTION_NOT_AUTHORIZED", "message": "Statutory Exception requires dual-OTP authorization before dispatch"}}
            )

        cursor.execute("BEGIN IMMEDIATE")
        lines = json.loads(challan["allocated_batches"])

        # Deduct from current_qty and reserved_qty atomically
        for line in lines:
            cursor.execute(
                """
                UPDATE batches
                SET current_qty = current_qty - ?,
                    reserved_qty = max(0, reserved_qty - ?)
                WHERE id = ?
                """,
                (line["allocated_qty"], line["allocated_qty"], line["batch_id"])
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "UPDATE delivery_challans SET status = 'IN_TRANSIT', issued_at = ? WHERE id = ?",
            (now_iso, id)
        )

        cursor.execute("SELECT shop_name, fps_code FROM fps_stores WHERE id = ?", (challan["fps_id"],))
        fps_info = cursor.fetchone()

        log_audit_event(
            conn,
            "DISPATCH_COMPLETED",
            {
                "challanNo": challan["challan_no"],
                "fpsId": fps_info["fps_code"] if fps_info else str(challan["fps_id"]),
                "fpsName": fps_info["shop_name"] if fps_info else "",
                "commodity": challan["commodity"],
                "quantity": challan["total_qty"],
                "token": challan["crypto_token"][:16]
            },
            timestamp=now_iso
        )

        increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "challan_id": id,
            "challan_no": challan["challan_no"],
            "status": "IN_TRANSIT",
            "message": "Stock officially deducted and dispatched"
        }

@router.post("/{id}/cancel")
def cancel_challan(id: int = Path(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_challans WHERE id = ?", (id,))
        challan = cursor.fetchone()
        if not challan:
            raise HTTPException(status_code=404, detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan #{id} not found"}})

        if challan["status"] != "STAGED":
            raise HTTPException(status_code=400, detail={"error": {"code": "CANNOT_CANCEL", "message": f"Cannot cancel challan in status {challan['status']}"}})

        cursor.execute("BEGIN IMMEDIATE")
        lines = json.loads(challan["allocated_batches"])

        # Release reservations
        for line in lines:
            cursor.execute(
                "UPDATE batches SET reserved_qty = max(0, reserved_qty - ?) WHERE id = ?",
                (line["allocated_qty"], line["batch_id"])
            )

        cursor.execute("UPDATE delivery_challans SET status = 'CANCELLED' WHERE id = ?", (id,))

        if challan["indent_id"]:
            cursor.execute("UPDATE fps_indents SET status = 'PENDING_AT_GODOWN' WHERE id = ?", (challan["indent_id"],))

        increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "challan_id": id,
            "status": "CANCELLED",
            "message": "Challan cancelled and stock reservations released"
        }

@router.post("/{id}/receive")
def receive_at_fps(id: int = Path(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_challans WHERE id = ?", (id,))
        challan = cursor.fetchone()
        if not challan:
            raise HTTPException(status_code=404, detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan #{id} not found"}})

        if challan["status"] != "IN_TRANSIT":
            raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_STATE", "message": f"Challan status is {challan['status']}, expected IN_TRANSIT"}})

        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT * FROM fps_stores WHERE id = ?", (challan["fps_id"],))
        fps_store = cursor.fetchone()
        inventory = json.loads(fps_store["stock_inventory"])

        comm = challan["commodity"]
        inventory[comm] = float(Decimal(str(inventory.get(comm, 0))) + Decimal(str(challan["total_qty"])))

        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "UPDATE fps_stores SET stock_inventory = ? WHERE id = ?",
            (json.dumps(inventory), challan["fps_id"])
        )

        cursor.execute(
            "UPDATE delivery_challans SET status = 'RECEIVED_AT_FPS', received_at = ? WHERE id = ?",
            (now_iso, id)
        )

        if challan["indent_id"]:
            cursor.execute(
                "UPDATE fps_indents SET status = 'DELIVERED_TO_FPS' WHERE id = ?",
                (challan["indent_id"],)
            )

        log_audit_event(
            conn,
            "FPS_EPOS_RECEIPT",
            {
                "challanNo": challan["challan_no"],
                "fpsId": fps_store["fps_code"],
                "fpsName": fps_store["shop_name"],
                "commodity": comm,
                "quantity": challan["total_qty"],
                "receivedAt": now_iso
            },
            timestamp=now_iso
        )

        increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "challan_id": id,
            "status": "RECEIVED_AT_FPS",
            "fps_code": fps_store["fps_code"],
            "updated_fps_inventory": inventory
        }

@router.get("/{challan_no}/verify")
def verify_challan_token(challan_no: str = Path(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM delivery_challans WHERE challan_no = ?", (challan_no,))
        challan = cursor.fetchone()
        if not challan:
            raise HTTPException(status_code=404, detail={"error": {"code": "CHALLAN_NOT_FOUND", "message": f"Challan {challan_no} not found"}})

        cursor.execute("SELECT fps_code FROM fps_stores WHERE id = ?", (challan["fps_id"],))
        fps_code = cursor.fetchone()["fps_code"]

        token_payload = {
            "challanNo": challan["challan_no"],
            "fps": fps_code,
            "commodity": challan["commodity"],
            "qty": challan["total_qty"],
            "lines": json.loads(challan["allocated_batches"]),
            "issuedAt": challan["issued_at"],
            "deviceId": challan["device_id"],
            "localSeq": challan["local_seq"],
            "prevTokenHash": challan["prev_token_hash"]
        }
        recomputed = compute_crypto_token(token_payload)
        is_valid = (recomputed == challan["crypto_token"])

        return {
            "status": "VERIFIED" if is_valid else "TAMPERED",
            "is_valid": is_valid,
            "challan_no": challan_no,
            "stored_token": challan["crypto_token"],
            "computed_token": recomputed
        }
