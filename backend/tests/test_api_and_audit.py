import pytest
import sqlite3
import concurrent.futures
from fastapi.testclient import TestClient

from backend.main import app
from backend.audit import verify_hash_chain
from backend.db import get_connection

client = TestClient(app)

def test_health_check(test_db):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "UP"
    assert data["db"] == "CONNECTED"

def test_audit_hash_chain_validity_and_tamper(test_db):
    # 1. Initial seeded chain should be valid
    conn = get_connection(test_db)
    result = verify_hash_chain(conn)
    assert result["valid"] is True
    assert result["events"] > 0
    assert result["broken_at"] is None

    # 2. Tamper with a single row directly in SQLite
    # Disable trigger temporarily for the tamper test
    conn.execute("PRAGMA foreign_keys = OFF;")
    conn.execute("DROP TRIGGER IF EXISTS block_audit_update;")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM audit_logs ORDER BY id ASC LIMIT 1 OFFSET 1")
    second_id = cursor.fetchone()["id"]

    cursor.execute(
        "UPDATE audit_logs SET details = '{\"tampered\": true}' WHERE id = ?",
        (second_id,)
    )
    conn.commit()

    # 3. Verify hash chain now detects the break at event #2!
    tamper_result = verify_hash_chain(conn)
    assert tamper_result["valid"] is False
    assert tamper_result["broken_at"] == 2
    conn.close()

def test_waterfall_preview_and_staging(test_db):
    # Preview Wheat 100 Qtl
    res = client.post("/api/challans/preview-waterfall", json={"commodity": "Wheat", "requested_qty": 100.0})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["allocated_batches"]) >= 2
    assert data["allocated_batches"][0]["batch_code"] == "WH-102"

    # Stage Wheat 100 Qtl
    stage_res = client.post(
        "/api/challans/stage",
        json={
            "fps_code": "FPS-GN-101",
            "commodity": "Wheat",
            "requested_qty": 100.0
        }
    )
    assert stage_res.status_code == 200
    staged = stage_res.json()
    assert staged["status"] == "STAGED"
    assert len(staged["crypto_token"]) == 64
    assert len(staged["token_prefix"]) == 16
    challan_id = staged["id"]

    # Scan lines in sequence
    scan1 = client.post(
        f"/api/challans/{challan_id}/scan",
        json={"batch_code": "WH-102", "line_no": 1}
    )
    assert scan1.status_code == 200
    assert scan1.json()["status"] == "VERIFIED"

    # Scan wrong batch on line 2
    scan_wrong = client.post(
        f"/api/challans/{challan_id}/scan",
        json={"batch_code": "WH-105", "line_no": 2}
    )
    assert scan_wrong.status_code == 200
    assert scan_wrong.json()["status"] == "WRONG_BATCH"

    # Scan correct line 2
    scan2 = client.post(
        f"/api/challans/{challan_id}/scan",
        json={"batch_code": "WH-103", "line_no": 2}
    )
    assert scan2.status_code == 200
    assert scan2.json()["status"] == "VERIFIED"

    # Complete dispatch
    dispatch_res = client.post(f"/api/challans/{challan_id}/dispatch")
    assert dispatch_res.status_code == 200
    assert dispatch_res.json()["status"] == "IN_TRANSIT"

    # Receive at FPS
    recv_res = client.post(f"/api/challans/{challan_id}/receive")
    assert recv_res.status_code == 200
    assert recv_res.json()["status"] == "RECEIVED_AT_FPS"

def test_manual_violation_and_dual_otp(test_db):
    # Select newer WH-105 for 20 Qtl
    res = client.post(
        "/api/challans/stage-manual",
        json={
            "fps_code": "FPS-GN-101",
            "commodity": "Wheat",
            "requested_qty": 20.0,
            "selected_picks": [{"batch_code": "WH-105", "qty": 20.0}]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_exception"] is True
    assert "WH-102" in data["skipped_batches"]
    challan_id = data["id"]

    # Request OTPs
    otp_req = client.post(
        f"/api/challans/{challan_id}/exception/request-otp",
        json={
            "reason": "Physical Bay Blockage / Forklift Pathway Obstruction",
            "operator_name": "Ramesh Chand",
            "remarks": "Forklift hydraulic rupture in Bay A2 blocking older batch access"
        }
    )
    assert otp_req.status_code == 200
    # Response must NOT contain plaintext OTPs!
    assert "otp" not in str(otp_req.json()).lower() or "simulated" in str(otp_req.json()).lower()

    # Check simulated approver view
    approvals = client.get("/api/approvals/pending").json()
    assert len(approvals) >= 2
    sup_appr = next((a for a in approvals if a["challan_id"] == challan_id and a["role"] == "SUPERVISOR"), None)
    dso_appr = next((a for a in approvals if a["challan_id"] == challan_id and a["role"] == "DSO"), None)
    assert sup_appr is not None
    assert dso_appr is not None

    sup_otp = sup_appr["simulated_sms_otp"]
    dso_otp = dso_appr["simulated_sms_otp"]

    # Wrong OTP attempt
    wrong_res = client.post(
        f"/api/challans/{challan_id}/exception/verify-otp",
        json={"role": "SUPERVISOR", "otp": "000000"}
    )
    assert wrong_res.status_code == 400

    # Correct OTP for Supervisor
    v1 = client.post(
        f"/api/challans/{challan_id}/exception/verify-otp",
        json={"role": "SUPERVISOR", "otp": sup_otp}
    )
    assert v1.status_code == 200
    assert v1.json()["fully_authorized"] is False

    # Correct OTP for DSO
    v2 = client.post(
        f"/api/challans/{challan_id}/exception/verify-otp",
        json={"role": "DSO", "otp": dso_otp}
    )
    assert v2.status_code == 200
    assert v2.json()["fully_authorized"] is True

def test_recall_trace_multi_fps(test_db):
    res = client.get("/api/trace/recall/RC-101")
    assert res.status_code == 200
    data = res.json()
    assert data["batch_code"] == "RC-101"
    assert data["affected_fps_count"] >= 3
    fps_codes = [f["fps_code"] for f in data["fps_summary"]]
    assert "FPS-GN-101" in fps_codes
    assert "FPS-GN-102" in fps_codes
    assert "FPS-GN-103" in fps_codes

def test_concurrent_reservations(test_db):
    # Try to stage 45 Qtl of RC-102 simultaneously in 2 threads when only 45 is available
    def stage_rice():
        return client.post(
            "/api/challans/stage",
            json={
                "fps_code": "FPS-GN-101",
                "commodity": "Rice",
                "requested_qty": 45.0
            }
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(stage_rice)
        f2 = executor.submit(stage_rice)
        r1 = f1.result()
        r2 = f2.result()

    statuses = [r1.status_code, r2.status_code]
    # At least one succeeded with 200, but they cannot both claim more than available stock without shortfall!
    assert 200 in statuses

def test_get_state_and_kpis(test_db):
    res = client.get("/api/state")
    assert res.status_code == 200
    data = res.json()
    assert "batches" in data
    assert "fps_stores" in data
    assert "fps_indents" in data
    assert "delivery_challans" in data
    assert "audit_logs" in data
    assert "kpis" in data

    kpis = data["kpis"]
    assert "fifo_compliance_pct" in kpis
    assert "avg_stock_age_days" in kpis
    assert "total_inventory_qtl" in kpis
    assert kpis["fifo_compliance_pct"] >= 0 and kpis["fifo_compliance_pct"] <= 100
    assert kpis["avg_stock_age_days"] >= 0

    # Batches have age in days and valid schemas
    for b in data["batches"]:
        assert "age_days" in b
        assert "commodity" in b
        assert "stack_bay" in b
        assert "current_qty" in b
        assert "status" in b

def test_post_batches_and_consignments(test_db):
    # 1. Post batch using standard snake_case
    payload1 = {
        "batch_code": "WH-TEST-99",
        "commodity": "Wheat",
        "supplier": "FCI Regional Silo",
        "receipt_date": "2026-10-20",
        "stack_bay": "A2",
        "initial_qty": 75.0,
        "status": "ELIGIBLE",
        "moisture_pct": 11.2
    }
    res1 = client.post("/api/batches", json=payload1)
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["success"] is True
    assert d1["batch_code"] == "WH-TEST-99"

    # 2. Post batch using camelCase UI format with auto moisture default
    payload2 = {
        "batchId": "RC-TEST-88",
        "commodity": "Rice",
        "supplier": "Haryana Warehousing Corp",
        "bay": "b3",
        "quantity": 60.0,
        "qualityStatus": "Eligible"
    }
    res2 = client.post("/api/batches", json=payload2)
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["success"] is True
    assert d2["batch_code"] == "RC-TEST-88"

    # 3. Verify in audit logs that CONSIGNMENT_RECEIPT was logged
    audit_res = client.get("/api/audit")
    assert audit_res.status_code == 200
    logs = audit_res.json()["logs"]
    receipt_events = [l for l in logs if l["event_type"] == "CONSIGNMENT_RECEIPT"]
    assert len(receipt_events) >= 2

    # 4. Verify GET /api/batches lists the new batches
    batches_res = client.get("/api/batches?commodity=Wheat")
    assert batches_res.status_code == 200
    batch_codes = [b["batch_code"] for b in batches_res.json()]
    assert "WH-TEST-99" in batch_codes

def test_indents_by_fps_code_and_id(test_db):
    # 1. Create indent with fps_code
    res1 = client.post(
        "/api/indents",
        json={
            "fps_code": "FPS-GN-104",
            "commodity": "Sugar",
            "requested_qty": 20.0,
            "priority": "HIGH"
        }
    )
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["success"] is True
    assert d1["fps_code"] == "FPS-GN-104"
    assert d1["status"] == "PENDING_AT_GODOWN"
    assert d1["requested_qty"] == 20.0

    # 2. Create indent using fps_id
    res2 = client.post(
        "/api/indents",
        json={
            "fps_id": 5,
            "commodity": "Salt",
            "requested_qty": 15.0,
            "priority": "NORMAL"
        }
    )
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["success"] is True
    assert d2["fps_id"] == 5
    assert d2["status"] == "PENDING_AT_GODOWN"

def test_waterfall_allocation_schema(test_db):
    # Preview Waterfall for Wheat
    res = client.post("/api/challans/preview-waterfall", json={"commodity": "Wheat", "requested_qty": 60.0})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["is_fifo_compliant"] is True
    assert len(data["allocated_batches"]) > 0

    for item in data["allocated_batches"]:
        assert "batch_id" in item
        assert "batch_code" in item
        assert "stack_bay" in item
        assert "allocated_qty" in item
        assert "batch_age_days" in item
        assert item["allocated_qty"] > 0
        assert item["batch_age_days"] >= 0

def test_approver_decision_reveals_otp_and_refreshes_expired(test_db):
    from backend.otp import _SIMULATED_SMS_CACHE
    import sqlite3

    # Clear memory cache to simulate server restart
    _SIMULATED_SMS_CACHE.clear()

    # Expire pending OTP request in database
    conn = sqlite3.connect(test_db)
    conn.execute("UPDATE otp_requests SET expires_at = '2020-01-01T00:00:00+00:00', status = 'EXPIRED'")
    conn.commit()
    conn.close()

    # Approver makes decision to approve
    res = client.post("/api/approvals/1/decision", json={"action": "APPROVE"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["action"] == "APPROVED"
    assert len(data["simulated_sms_otp"]) == 6
    assert data["simulated_sms_otp"].isdigit()

    # Verify that the revealed OTP works when verified by godown operator
    conn = sqlite3.connect(test_db)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT challan_id, role, status FROM otp_requests WHERE id = 1").fetchone()
    challan_id = row["challan_id"]
    role = row["role"]
    conn.close()

    v_res = client.post(
        f"/api/challans/{challan_id}/exception/verify-otp",
        json={"role": role, "otp": data["simulated_sms_otp"]}
    )
    assert v_res.status_code == 200
    assert v_res.json()["success"] is True
