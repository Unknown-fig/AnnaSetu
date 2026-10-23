from fastapi import APIRouter, HTTPException, Path
from typing import Dict, Any, List
from datetime import datetime, timezone

from backend.db import get_db, increment_state_version
from backend.models import ApproverDecisionRequest
from backend.otp import get_simulated_sms_otp
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
            WHERE o.status IN ('PENDING', 'LOCKED') AND o.used = 0
            ORDER BY o.id DESC
            """
        )
        rows = cursor.fetchall()
        now_iso = datetime.now(timezone.utc).isoformat()

        results = []
        for r in rows:
            is_expired = r["expires_at"] < now_iso
            otp_val = get_simulated_sms_otp(r["id"]) if not is_expired else None
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
            SELECT o.id, o.challan_id, o.role, o.status, c.challan_no
            FROM otp_requests o
            JOIN delivery_challans c ON o.challan_id = c.id
            WHERE o.id = ?
            """,
            (id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail={"error": {"code": "OTP_REQUEST_NOT_FOUND", "message": f"OTP request #{id} not found"}})

        now_iso = datetime.now(timezone.utc).isoformat()

        if payload.action == "APPROVE":
            otp_val = get_simulated_sms_otp(id)
            return {
                "success": True,
                "action": "APPROVED",
                "role": row["role"],
                "simulated_sms_otp": otp_val,
                "label": "SIMULATED SMS - demo only"
            }
        else:
            cursor.execute("BEGIN IMMEDIATE")
            cursor.execute("UPDATE otp_requests SET status = 'REJECTED' WHERE id = ?", (id,))
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
