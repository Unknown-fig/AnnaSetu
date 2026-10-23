import pytest
import tempfile
import json
from pathlib import Path
from starlette.testclient import TestClient

from backend import config
from backend.main import app
from backend.db import init_db, get_db, get_state_version
from backend.seed import seed_database

@pytest.fixture
def client_with_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = Path(f.name)

    orig_db_path = config.DB_PATH
    config.DB_PATH = temp_db_path

    init_db(temp_db_path)
    with get_db(temp_db_path) as conn:
        seed_database(conn)

    client = TestClient(app)
    yield client, temp_db_path

    config.DB_PATH = orig_db_path
    try:
        temp_db_path.unlink()
    except Exception:
        pass

def test_state_version_and_monotonic_increment(client_with_db):
    client, db_path = client_with_db

    res = client.get("/api/state/version")
    assert res.status_code == 200
    v1 = res.json()
    assert "version" in v1
    assert "updated_at" in v1
    initial_version = v1["version"]

    # State endpoint also includes version
    res_state = client.get("/api/state")
    assert res_state.status_code == 200
    assert res_state.json()["version"] == initial_version

    # Raising an indent should increment version
    res_indent = client.post("/api/indents", json={
        "fps_code": "FPS-GN-103",
        "commodity": "Chana",
        "requested_qty": 30.0,
        "priority": "HIGH",
        "force": True
    })
    assert res_indent.status_code == 200
    assert res_indent.json()["version"] > initial_version

    # Verify version increased in /api/state/version
    res_v2 = client.get("/api/state/version")
    assert res_v2.json()["version"] == res_indent.json()["version"]

def test_fps_dashboard_and_low_stock_flags(client_with_db):
    client, db_path = client_with_db

    # FPS-GN-101 has Salt at 3.5 Qtl (critical threshold 4.0) and Chana at 8.0 Qtl (low threshold 10.0)
    res = client.get("/api/fps/FPS-GN-101/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data["fps"]["fps_code"] == "FPS-GN-101"
    assert data["fps"]["shop_name"] == "Kasna Village Market"

    # All 7 commodities present
    commodities = {s["commodity"]: s for s in data["stock_inventory"]}
    assert len(commodities) == 7
    assert "Wheat" in commodities
    assert "Salt" in commodities

    salt = commodities["Salt"]
    assert salt["qty"] == 3.5
    assert salt["status"] == "CRITICAL"
    assert salt["is_low_stock"] is True

    chana = commodities["Chana"]
    assert chana["qty"] == 8.0
    assert chana["status"] == "LOW"
    assert chana["is_low_stock"] is True

    # Incoming challans present
    assert len(data["incoming_challans"]) >= 1
    assert data["incoming_challans"][0]["status"] == "IN_TRANSIT"

def test_duplicate_pending_indent_validation(client_with_db):
    client, db_path = client_with_db

    # Seed has pending indent for FPS-GN-101 Wheat (IND-2026-0001)
    res_dup = client.post("/api/indents", json={
        "fps_code": "FPS-GN-101",
        "commodity": "Wheat",
        "requested_qty": 50.0,
        "priority": "NORMAL",
        "force": False
    })
    assert res_dup.status_code == 409
    err = res_dup.json()["error"]
    assert err["code"] == "DUPLICATE_PENDING"
    assert "already exists" in err["message"]

    # When force=True, it succeeds
    res_forced = client.post("/api/indents", json={
        "fps_code": "FPS-GN-101",
        "commodity": "Wheat",
        "requested_qty": 50.0,
        "priority": "NORMAL",
        "force": True
    })
    assert res_forced.status_code == 200
    assert res_forced.json()["success"] is True

    # Qty > 500 should be rejected
    res_over = client.post("/api/indents", json={
        "fps_code": "FPS-GN-101",
        "commodity": "Wheat",
        "requested_qty": 999.0,
        "priority": "NORMAL",
        "force": True
    })
    assert res_over.status_code in (400, 422)

def test_confirm_receipt_happy_path_and_idempotency(client_with_db):
    client, db_path = client_with_db

    # GBN-iPDS-2026-0007 is seeded IN_TRANSIT for FPS-GN-101 (Wheat 20.0 Qtl)
    dash_before = client.get("/api/fps/FPS-GN-101/dashboard").json()
    wheat_before = next(s["qty"] for s in dash_before["stock_inventory"] if s["commodity"] == "Wheat")

    # Get crypto token for this challan
    challan = dash_before["incoming_challans"][0]
    cno = challan["challan_no"]
    token = challan["crypto_token"]

    # Confirm receipt with matching payload
    res = client.post("/api/fps/confirm-receipt", json={
        "challan_no": cno,
        "fps_code": "FPS-GN-101",
        "qr_payload": {
            "challanNo": cno,
            "fps": "FPS-GN-101",
            "qty": challan["total_qty"],
            "token": token
        }
    })
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "RECEIVED_AT_FPS"

    # Check that stock inventory increased
    dash_after = client.get("/api/fps/FPS-GN-101/dashboard").json()
    wheat_after = next(s["qty"] for s in dash_after["stock_inventory"] if s["commodity"] == "Wheat")
    assert wheat_after == wheat_before + challan["total_qty"]

    # Idempotent double confirm returns ALREADY_RECEIVED without adding stock again
    res_repeat = client.post("/api/fps/confirm-receipt", json={
        "challan_no": cno,
        "fps_code": "FPS-GN-101",
        "qr_payload": {"token": token}
    })
    assert res_repeat.status_code == 200
    assert res_repeat.json()["status"] == "ALREADY_RECEIVED"

    # Stock should remain unchanged
    dash_repeat = client.get("/api/fps/FPS-GN-101/dashboard").json()
    wheat_repeat = next(s["qty"] for s in dash_repeat["stock_inventory"] if s["commodity"] == "Wheat")
    assert wheat_repeat == wheat_after

def test_confirm_receipt_tamper_rejection(client_with_db):
    client, db_path = client_with_db

    # GBN-iPDS-2026-0008 is seeded IN_TRANSIT for FPS-GN-104 (Rice 15.0 Qtl)
    dash_before = client.get("/api/fps/FPS-GN-104/dashboard").json()
    challan = dash_before["incoming_challans"][0]
    cno = challan["challan_no"]
    token = challan["crypto_token"]
    rice_before = next(s["qty"] for s in dash_before["stock_inventory"] if s["commodity"] == "Rice")

    # Deliberate tamper: quantity modified from 15.0 to 99.0
    res_tamper = client.post("/api/fps/confirm-receipt", json={
        "challan_no": cno,
        "fps_code": "FPS-GN-104",
        "qr_payload": {
            "challanNo": cno,
            "fps": "FPS-GN-104",
            "qty": 99.0, # TAMPERED
            "token": token
        }
    })
    assert res_tamper.status_code == 400
    assert res_tamper.json()["error"]["code"] == "TAMPERED"

    # Stock must NOT be modified
    dash_after = client.get("/api/fps/FPS-GN-104/dashboard").json()
    rice_after = next(s["qty"] for s in dash_after["stock_inventory"] if s["commodity"] == "Rice")
    assert rice_after == rice_before

    # Wrong FPS rejection
    res_wrong_fps = client.post("/api/fps/confirm-receipt", json={
        "challan_no": cno,
        "fps_code": "FPS-GN-101", # Wrong FPS
        "qr_payload": {"token": token}
    })
    assert res_wrong_fps.status_code == 400
    assert res_wrong_fps.json()["error"]["code"] == "WRONG_FPS"

def test_dso_vigilance_and_matrix_reconciliation(client_with_db):
    client, db_path = client_with_db

    # 1. DSO Vigilance Dashboard
    res_vig = client.get("/api/dso/vigilance")
    assert res_vig.status_code == 200
    vig_data = res_vig.json()
    assert "pending_exceptions" in vig_data
    assert "kpis" in vig_data
    assert "recent_exception_events" in vig_data

    # Seeded pending exception GBN-iPDS-2026-0009 present with timer
    assert len(vig_data["pending_exceptions"]) >= 1
    exc = vig_data["pending_exceptions"][0]
    assert exc["challan_no"] == "GBN-iPDS-2026-0009"
    assert exc["expires_in_seconds"] > 0
    assert "WH-105" in exc["chosen_batches"]

    # 2. Batch-to-FPS Traceability Matrix
    res_mat = client.get("/api/trace/matrix")
    assert res_mat.status_code == 200
    mat_data = res_mat.json()
    assert len(mat_data["fps_columns"]) == 6
    assert len(mat_data["matrix"]) > 0

    # Batch RC-101 was dispatched to 3 FPS (Kasna 15, Tugalpur 15, Sector Beta-2 20 = 50 total)
    rc101 = next((r for r in mat_data["matrix"] if r["batch_code"] == "RC-101"), None)
    assert rc101 is not None
    assert rc101["fps"]["FPS-GN-101"] == 15.0
    assert rc101["fps"]["FPS-GN-102"] == 15.0
    assert rc101["fps"]["FPS-GN-103"] == 20.0
    assert rc101["total"] == 50.0

    # Grand total matches column totals sum
    col_sum = sum(mat_data["column_totals"].values())
    assert abs(col_sum - mat_data["grand_total"]) < 0.01
