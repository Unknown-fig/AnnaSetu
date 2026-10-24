import pytest
import json
from starlette.testclient import TestClient
from backend.main import app
from backend.db import get_connection

client = TestClient(app)

@pytest.fixture
def staged_in_transit_challan(test_db):
    """
    Sets up a deterministic in-transit delivery challan with a linked pending indent
    in a fresh test database copy.
    """
    conn = get_connection(test_db)
    cursor = conn.cursor()

    # Link indent #1 to in-transit challan GBN-iPDS-2026-0007
    cursor.execute("UPDATE fps_indents SET status = 'CHALLAN_ISSUED' WHERE id = 1")
    cursor.execute(
        """
        UPDATE delivery_challans
        SET indent_id = 1, status = 'IN_TRANSIT', received_at = NULL
        WHERE challan_no = 'GBN-iPDS-2026-0007'
        """
    )
    conn.commit()

    # Fetch initial state
    cursor.execute(
        """
        SELECT c.id, c.challan_no, c.commodity, c.total_qty, c.crypto_token,
               f.id as fps_id, f.fps_code, f.stock_inventory,
               i.id as indent_id
        FROM delivery_challans c
        JOIN fps_stores f ON c.fps_id = f.id
        LEFT JOIN fps_indents i ON c.indent_id = i.id
        WHERE c.challan_no = 'GBN-iPDS-2026-0007'
        """
    )
    challan_row = cursor.fetchone()

    cursor.execute("SELECT version FROM system_state WHERE key = 'global'")
    row = cursor.fetchone()
    init_version = row["version"] if row else 1

    conn.close()

    inv = json.loads(challan_row["stock_inventory"])
    comm = challan_row["commodity"]

    return {
        "db_path": test_db,
        "challan_id": challan_row["id"],
        "challan_no": challan_row["challan_no"],
        "fps_id": challan_row["fps_id"],
        "fps_code": challan_row["fps_code"],
        "commodity": comm,
        "total_qty": float(challan_row["total_qty"]),
        "crypto_token": challan_row["crypto_token"],
        "indent_id": challan_row["indent_id"],
        "initial_stock": float(inv.get(comm, 0.0)),
        "initial_version": init_version,
    }


@pytest.mark.parametrize("endpoint_type", ["challans_receive", "fps_confirm_receipt"])
def test_receive_endpoint_parity_and_idempotency(endpoint_type, staged_in_transit_challan):
    """
    Parametrised parity check asserting that both POST /api/challans/{id}/receive
    and POST /api/fps/confirm-receipt produce IDENTICAL database rows:
    - delivery_challans: status = 'RECEIVED_AT_FPS', received_at is set
    - fps_indents: status = 'DELIVERED_TO_FPS'
    - fps_stores: stock_inventory incremented with 2-decimal rounding
    - audit_logs: latest event is 'FPS_EPOS_RECEIPT' with matching payload
    - system_state: version incremented by exactly 1
    
    Also asserts double-call idempotency:
    - Second call returns 200 (ALREADY_RECEIVED)
    - Stock inventory is NOT double-added
    - Version is NOT incremented again
    - No duplicate audit event is logged
    """
    setup = staged_in_transit_challan
    c_id = setup["challan_id"]
    c_no = setup["challan_no"]
    fps_code = setup["fps_code"]
    token = setup["crypto_token"]
    comm = setup["commodity"]
    total_qty = setup["total_qty"]
    expected_stock = round(setup["initial_stock"] + total_qty, 2)
    expected_version = setup["initial_version"] + 1

    # 1. Execute first call against specified endpoint
    if endpoint_type == "challans_receive":
        res1 = client.post(f"/api/challans/{c_id}/receive")
    else:
        res1 = client.post(
            "/api/fps/confirm-receipt",
            json={
                "challan_no": c_no,
                "fps_code": fps_code,
                "qr_payload": {
                    "challanNo": c_no,
                    "fps": fps_code,
                    "qty": total_qty,
                    "token": token
                }
            }
        )

    assert res1.status_code == 200, f"First call failed: {res1.text}"
    data1 = res1.json()
    assert data1["status"] in ("RECEIVED_AT_FPS", "ALREADY_RECEIVED")

    # 2. Assert identical resulting database rows
    conn = get_connection(setup["db_path"])
    cursor = conn.cursor()

    # (a) Challan status and received_at
    cursor.execute("SELECT status, received_at FROM delivery_challans WHERE id = ?", (c_id,))
    c_row = cursor.fetchone()
    assert c_row["status"] == "RECEIVED_AT_FPS"
    assert c_row["received_at"] is not None
    first_received_at = c_row["received_at"]

    # (b) Linked indent status
    cursor.execute("SELECT status FROM fps_indents WHERE id = ?", (setup["indent_id"],))
    i_row = cursor.fetchone()
    assert i_row["status"] == "DELIVERED_TO_FPS"

    # (c) FPS stock inventory incremented with 2-decimal rounding
    cursor.execute("SELECT stock_inventory FROM fps_stores WHERE id = ?", (setup["fps_id"],))
    f_row = cursor.fetchone()
    inv1 = json.loads(f_row["stock_inventory"])
    assert inv1[comm] == expected_stock

    # (d) Audit event type and metadata
    cursor.execute("SELECT event_type, details FROM audit_logs ORDER BY id DESC LIMIT 1")
    audit_row = cursor.fetchone()
    assert audit_row["event_type"] == "FPS_EPOS_RECEIPT"
    details = json.loads(audit_row["details"])
    assert details["challanNo"] == c_no
    assert details["fpsId"] == fps_code
    assert details["commodity"] == comm
    assert float(details["quantity"]) == total_qty

    # (e) State version increment
    cursor.execute("SELECT version FROM system_state WHERE key = 'global'")
    v_row = cursor.fetchone()
    assert v_row["version"] == expected_version

    # Count audit rows before second call
    cursor.execute("SELECT COUNT(*) as cnt FROM audit_logs")
    audit_count_before = cursor.fetchone()["cnt"]

    conn.close()

    # 3. Double-call idempotency check
    if endpoint_type == "challans_receive":
        res2 = client.post(f"/api/challans/{c_id}/receive")
    else:
        res2 = client.post(
            "/api/fps/confirm-receipt",
            json={
                "challan_no": c_no,
                "fps_code": fps_code,
                "qr_payload": {"token": token}
            }
        )

    assert res2.status_code == 200, f"Second call failed: {res2.text}"
    data2 = res2.json()
    assert data2["status"] in ("ALREADY_RECEIVED", "RECEIVED_AT_FPS")

    # Verify database state remained unchanged
    conn2 = get_connection(setup["db_path"])
    cursor2 = conn2.cursor()

    # Challan received_at timestamp should not have been overwritten
    cursor2.execute("SELECT status, received_at FROM delivery_challans WHERE id = ?", (c_id,))
    c_row2 = cursor2.fetchone()
    assert c_row2["status"] == "RECEIVED_AT_FPS"
    assert c_row2["received_at"] == first_received_at

    # Stock inventory must NOT have been double-added
    cursor2.execute("SELECT stock_inventory FROM fps_stores WHERE id = ?", (setup["fps_id"],))
    f_row2 = cursor2.fetchone()
    inv2 = json.loads(f_row2["stock_inventory"])
    assert inv2[comm] == expected_stock

    # Version must NOT have incremented again
    cursor2.execute("SELECT version FROM system_state WHERE key = 'global'")
    v_row2 = cursor2.fetchone()
    assert v_row2["version"] == expected_version

    # No new audit events logged on idempotent repeat
    cursor2.execute("SELECT COUNT(*) as cnt FROM audit_logs")
    audit_count_after = cursor2.fetchone()["cnt"]
    assert audit_count_after == audit_count_before

    conn2.close()
