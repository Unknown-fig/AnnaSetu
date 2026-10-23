from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone

from backend.db import get_db
from backend.models import IndentCreate
from backend.config import to_db_commodity, DB_COMMODITIES

router = APIRouter(prefix="/api/indents", tags=["indents"])

@router.get("")
def list_indents(status: Optional[str] = Query(None)):
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT i.id, i.indent_no, i.fps_id, f.fps_code, f.shop_name,
                   i.commodity, i.requested_qty, i.priority, i.status, i.created_at
            FROM fps_indents i
            JOIN fps_stores f ON i.fps_id = f.id
        """
        params = []
        if status:
            query += " WHERE i.status = ?"
            params.append(status)
        query += " ORDER BY i.id DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [
            {
                "id": r["id"],
                "indent_no": r["indent_no"],
                "fps_id": r["fps_id"],
                "fps_code": r["fps_code"],
                "fps_name": r["shop_name"],
                "commodity": r["commodity"],
                "requested_qty": r["requested_qty"],
                "priority": r["priority"],
                "status": r["status"],
                "created_at": r["created_at"]
            }
            for r in rows
        ]

@router.post("")
def create_indent(payload: IndentCreate):
    comm = to_db_commodity(payload.commodity)
    if comm not in DB_COMMODITIES:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "INVALID_COMMODITY", "message": f"Commodity must be one of {DB_COMMODITIES}"}}
        )

    if payload.requested_qty <= 0 or payload.requested_qty > 500.0:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "INVALID_QTY", "message": "Requested quantity must be between 0.01 and 500.00 Qtl"}}
        )

    with get_db() as conn:
        cursor = conn.cursor()
        fps_row = None
        if payload.fps_code:
            cursor.execute("SELECT id, shop_name, fps_code FROM fps_stores WHERE fps_code = ?", (payload.fps_code,))
            fps_row = cursor.fetchone()
        if not fps_row and payload.fps_id is not None:
            cursor.execute("SELECT id, shop_name, fps_code FROM fps_stores WHERE id = ?", (payload.fps_id,))
            fps_row = cursor.fetchone()

        if not fps_row:
            identifier = payload.fps_code or payload.fps_id
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "FPS_NOT_FOUND", "message": f"FPS {identifier} not found"}}
            )
        fps_code = fps_row["fps_code"]

        cursor.execute("BEGIN IMMEDIATE")

        # Duplicate pending check
        if not payload.force:
            cursor.execute(
                """
                SELECT indent_no FROM fps_indents
                WHERE fps_id = ? AND commodity = ? AND status = 'PENDING_AT_GODOWN'
                LIMIT 1
                """,
                (fps_row["id"], comm)
            )
            existing = cursor.fetchone()
            if existing:
                conn.rollback()
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": {
                            "code": "DUPLICATE_PENDING",
                            "message": f"A pending indent ({existing['indent_no']}) already exists for {fps_row['shop_name']} ({comm}).",
                            "details": {
                                "existing_indent_no": existing["indent_no"],
                                "commodity": comm,
                                "fps_code": fps_code,
                                "fps_name": fps_row["shop_name"]
                            }
                        }
                    }
                )

        cursor.execute("SELECT COUNT(*) as count FROM fps_indents")
        count = cursor.fetchone()["count"]
        now = datetime.now(timezone.utc)
        year = now.year
        indent_no = f"IND-{year}-{count + 1:04d}"
        now_iso = now.isoformat()

        cursor.execute(
            """
            INSERT INTO fps_indents (indent_no, fps_id, commodity, requested_qty, priority, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'PENDING_AT_GODOWN', ?)
            """,
            (indent_no, fps_row["id"], comm, payload.requested_qty, payload.priority, now_iso)
        )
        new_id = cursor.lastrowid

        from backend.audit import log_audit_event
        from backend.db import increment_state_version

        log_audit_event(
            conn,
            "INDENT_RAISED",
            {
                "indentNo": indent_no,
                "fpsCode": fps_code,
                "fpsName": fps_row["shop_name"],
                "commodity": comm,
                "quantity": payload.requested_qty,
                "priority": payload.priority,
                "remarks": payload.remarks or ""
            },
            timestamp=now_iso
        )

        version_info = increment_state_version(conn)
        conn.commit()

        return {
            "success": True,
            "id": new_id,
            "indent_no": indent_no,
            "fps_id": fps_row["id"],
            "fps_code": fps_code,
            "fps_name": fps_row["shop_name"],
            "commodity": comm,
            "requested_qty": payload.requested_qty,
            "priority": payload.priority,
            "status": "PENDING_AT_GODOWN",
            "created_at": now_iso,
            "version": version_info["version"]
        }

