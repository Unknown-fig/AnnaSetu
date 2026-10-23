import pytest
import sqlite3
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from backend.main import app
from backend.audit import canonical_json
from backend.db import get_connection

client = TestClient(app)

def test_otp_lockout_and_expiry(test_db):
    # Stage manual violation
    res = client.post(
        "/api/challans/stage-manual",
        json={
            "fps_code": "FPS-GN-101",
            "commodity": "Wheat",
            "requested_qty": 20.0,
            "selected_picks": [{"batch_code": "WH-105", "qty": 20.0}]
        }
    )
    challan_id = res.json()["id"]

    # Request OTP
    client.post(
        f"/api/challans/{challan_id}/exception/request-otp",
        json={
            "reason": "Emergency Directive by District Magistrate / Dy. Director",
            "operator_name": "Suresh Gupta",
            "remarks": "Order from DM office #UP-GBN-EM-2026 for urgent relief distribution"
        }
    )

    # Wrong attempt 1
    r1 = client.post(f"/api/challans/{challan_id}/exception/verify-otp", json={"role": "SUPERVISOR", "otp": "111111"})
    assert r1.status_code == 400

    # Wrong attempt 2
    r2 = client.post(f"/api/challans/{challan_id}/exception/verify-otp", json={"role": "SUPERVISOR", "otp": "222222"})
    assert r2.status_code == 400

    # Wrong attempt 3 -> Lockout!
    r3 = client.post(f"/api/challans/{challan_id}/exception/verify-otp", json={"role": "SUPERVISOR", "otp": "333333"})
    assert r3.status_code == 423
    assert "locked" in r3.json()["error"]["message"].lower()

    # Manually expire in DB to test expiry
    conn = get_connection(test_db)
    past_iso = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    conn.execute("UPDATE otp_requests SET expires_at = ? WHERE challan_id = ?", (past_iso, challan_id))
    conn.commit()
    conn.close()

    r4 = client.post(f"/api/challans/{challan_id}/exception/verify-otp", json={"role": "DSO", "otp": "123456"})
    assert r4.status_code == 400
    assert "expired" in r4.json()["error"]["message"].lower()

def test_dispatch_atomicity_and_rollback(test_db):
    conn = get_connection(test_db)
    cursor = conn.cursor()

    # Stage a valid challan
    res = client.post(
        "/api/challans/stage",
        json={
            "fps_code": "FPS-GN-101",
            "commodity": "Rice",
            "requested_qty": 30.0
        }
    )
    challan_id = res.json()["id"]

    cursor.execute("SELECT current_qty, reserved_qty FROM batches WHERE batch_code = 'RC-101'")
    b_before = cursor.fetchone()

    # Simulate transaction rollback by attempting an illegal dispatch
    # Force check: dispatch without line scan / without verification
    # delivery_challans has dso_otp_verified = 1 for compliant challans,
    # let's set is_fifo_compliant = 0 and dso_otp_verified = 0 directly in DB to test authorization block
    cursor.execute("UPDATE delivery_challans SET is_fifo_compliant = 0, dso_otp_verified = 0 WHERE id = ?", (challan_id,))
    conn.commit()

    # Dispatch must fail with 403 Forbidden
    fail_res = client.post(f"/api/challans/{challan_id}/dispatch")
    assert fail_res.status_code == 403

    # Confirm stock was untouched (rollback guarantee)
    cursor.execute("SELECT current_qty, reserved_qty FROM batches WHERE batch_code = 'RC-101'")
    b_after = cursor.fetchone()
    assert b_after["current_qty"] == b_before["current_qty"]
    conn.close()

def test_sync_conflict_and_idempotency(test_db):
    payload_valid = {
        "challanNo": "GBN-OFFLINE-001",
        "fps": "FPS-GN-101",
        "commodity": "Wheat",
        "lines": [{"batch_code": "WH-102", "allocated_qty": 10.0}]
    }
    token_valid = hashlib.sha256(canonical_json(payload_valid).encode("utf-8")).hexdigest()

    sync_body = [
        {
            "device_id": "HANDSET_RUGGED_01",
            "local_seq": 1,
            "token": token_valid,
            "type": "CHALLAN_STAGED",
            "payload": payload_valid
        }
    ]

    # First sync: SYNCED
    r1 = client.post("/api/sync", json=sync_body)
    assert r1.status_code == 200
    res1 = r1.json()["results"][0]
    assert res1["status"] == "SYNCED"
    assert res1["idempotent"] is False

    # Second sync: Idempotent return of same record
    r2 = client.post("/api/sync", json=sync_body)
    assert r2.status_code == 200
    res2 = r2.json()["results"][0]
    assert res2["status"] == "SYNCED"
    assert res2["idempotent"] is True

    # Third sync: Conflicting batch (non-existent batch or depleted)
    payload_conflict = {
        "challanNo": "GBN-OFFLINE-002",
        "fps": "FPS-GN-101",
        "commodity": "Wheat",
        "lines": [{"batch_code": "WH-999_NONEXISTENT", "allocated_qty": 500.0}]
    }
    token_conflict = hashlib.sha256(canonical_json(payload_conflict).encode("utf-8")).hexdigest()
    sync_conflict = [
        {
            "device_id": "HANDSET_RUGGED_01",
            "local_seq": 2,
            "token": token_conflict,
            "type": "CHALLAN_STAGED",
            "payload": payload_conflict
        }
    ]
    r3 = client.post("/api/sync", json=sync_conflict)
    assert r3.status_code == 200
    res3 = r3.json()["results"][0]
    assert res3["status"] == "CONFLICT"
    assert "Central Server" in res3["conflict_reason"]
