import json
import hashlib
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from backend.audit import log_audit_event, canonical_json
from backend.config import to_db_commodity

def get_relative_date(days_ago: int) -> str:
    now = datetime.now(timezone.utc)
    return (now - timedelta(days=days_ago)).date().isoformat()

def get_relative_datetime(days_ago: int, hour: int = 10, minute: int = 0) -> str:
    now = datetime.now(timezone.utc)
    target = now - timedelta(days=days_ago)
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()

def compute_challan_token(payload: Dict[str, Any]) -> str:
    canonical = canonical_json(payload)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

def seed_database(conn: sqlite3.Connection):
    cursor = conn.cursor()

    # Disable foreign keys temporarily during drop/truncate
    conn.execute("PRAGMA foreign_keys = OFF;")

    # Drop triggers first to allow truncate of audit_logs
    cursor.execute("DROP TRIGGER IF EXISTS block_audit_update;")
    cursor.execute("DROP TRIGGER IF EXISTS block_audit_delete;")

    cursor.execute("DELETE FROM sync_records;")
    cursor.execute("DELETE FROM otp_requests;")
    cursor.execute("DELETE FROM audit_logs;")
    cursor.execute("DELETE FROM delivery_challans;")
    cursor.execute("DELETE FROM fps_indents;")
    cursor.execute("DELETE FROM fps_stores;")
    cursor.execute("DELETE FROM batches;")
    cursor.execute("DELETE FROM system_state;")

    # Reset SQLite autoincrement sequence
    cursor.execute("DELETE FROM sqlite_sequence;")

    # Re-enable triggers and foreign keys
    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS block_audit_update
        BEFORE UPDATE ON audit_logs
        BEGIN
            SELECT RAISE(FAIL, 'audit_logs table is append-only: UPDATE prohibited');
        END;
    """)
    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS block_audit_delete
        BEFORE DELETE ON audit_logs
        BEGIN
            SELECT RAISE(FAIL, 'audit_logs table is append-only: DELETE prohibited');
        END;
    """)
    conn.execute("PRAGMA foreign_keys = ON;")

    # Initialize system_state
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        "INSERT INTO system_state (key, version, updated_at) VALUES ('global', 1, ?)",
        (now_iso,)
    )

    # 1. Seed Fair Price Shops (with multiple stores below low-stock / critical thresholds)
    fps_data = [
        ("FPS-GN-101", "Kasna Village Market", "Ramesh Kumar", "Kasna Zone", {
            "Wheat": 120.0, "Rice": 80.0, "Sugar": 30.0, "Salt": 3.5, "Edible Oil": 15.0, "Chana": 8.0, "Tuvar Dal": 20.0
        }),
        ("FPS-GN-102", "Tugalpur Haldoni Road", "Suresh Verma", "Haldoni Sector", {
            "Wheat": 100.0, "Rice": 70.0, "Sugar": 25.0, "Salt": 20.0, "Edible Oil": 12.0, "Chana": 15.0, "Tuvar Dal": 15.0
        }),
        ("FPS-GN-103", "Sector Beta-2 Market", "Mohan Lal", "Beta-2 Commercial", {
            "Wheat": 110.0, "Rice": 90.0, "Sugar": 35.0, "Salt": 30.0, "Edible Oil": 18.0, "Chana": 25.0, "Tuvar Dal": 25.0
        }),
        ("FPS-GN-104", "Dankaur Main Bazaar", "Rajesh Sharma", "Dankaur Rural", {
            "Wheat": 80.0, "Rice": 60.0, "Sugar": 20.0, "Salt": 15.0, "Edible Oil": 6.0, "Chana": 10.0, "Tuvar Dal": 7.0
        }),
        ("FPS-GN-105", "Alpha-1 Commercial Belt", "Priya Singh", "Alpha-1 Central", {
            "Wheat": 95.0, "Rice": 75.0, "Sugar": 28.0, "Salt": 22.0, "Edible Oil": 14.0, "Chana": 18.0, "Tuvar Dal": 18.0
        }),
        ("FPS-GN-106", "Rabupura Gram Panchayat", "Harish Yadav", "Rabupura Outpost", {
            "Wheat": 70.0, "Rice": 50.0, "Sugar": 9.0, "Salt": 15.0, "Edible Oil": 4.5, "Chana": 12.0, "Tuvar Dal": 12.0
        }),
    ]

    fps_id_map = {}
    for code, name, dealer, location, stock in fps_data:
        cursor.execute(
            """
            INSERT INTO fps_stores (fps_code, shop_name, dealer_name, location, stock_inventory)
            VALUES (?, ?, ?, ?, ?)
            """,
            (code, name, dealer, location, json.dumps(stock))
        )
        fps_id_map[code] = cursor.lastrowid

    # 2. Seed 16 Batches matching frontend specification
    batch_specs = [
        # --- 3 CRITICAL (60+ days) ---
        ("WH-101", "Wheat", "FCI Hapur Depot", 75, "A1", 0, 40.0, 40.0, 0.0, "QUALITY_HOLD", 16.2),
        ("RC-101", "Rice", "UP State Agro", 65, "B1", 0, 100.0, 50.0, 0.0, "ELIGIBLE", 12.1),
        ("SG-101", "Sugar", "NAFED UP", 62, "C1", 0, 55.0, 35.0, 0.0, "ELIGIBLE", 9.5),

        # --- 7 AGEING (21-59 days) ---
        ("WH-102", "Wheat", "FCI Hapur Depot", 55, "A2", 0, 90.0, 50.0, 0.0, "ELIGIBLE", 11.8),
        ("WH-103", "Wheat", "FCI Hapur Depot", 45, "A3", 0, 55.0, 55.0, 0.0, "ELIGIBLE", 12.3),
        ("RC-102", "Rice", "UP State Agro", 48, "B2", 1, 45.0, 45.0, 0.0, "ELIGIBLE", 12.0),
        ("RC-106", "Rice", "UP State Agro", 10, "B2", 0, 30.0, 30.0, 0.0, "ELIGIBLE", 11.5),
        ("RC-103", "Rice", "FCI Hapur Depot", 38, "B3", 0, 70.0, 70.0, 0.0, "ELIGIBLE", 12.4),
        ("CH-101", "Chana", "NAFED UP", 42, "C2", 0, 30.0, 30.0, 0.0, "ELIGIBLE", 10.2),
        ("TD-101", "Tuvar Dal", "NAFED UP", 36, "C3", 0, 40.0, 40.0, 0.0, "ELIGIBLE", 10.8),
        ("MO-101", "Edible Oil", "UP State Agro", 32, "D1", 0, 25.0, 25.0, 0.0, "ELIGIBLE", 0.5),

        # --- 6 FRESH (0-20 days) ---
        ("WH-104", "Wheat", "FCI Hapur Depot", 14, "A4", 0, 40.0, 40.0, 0.0, "ELIGIBLE", 12.0),
        ("WH-105", "Wheat", "UP State Agro", 5, "D2", 0, 80.0, 80.0, 0.0, "ELIGIBLE", 11.2),
        ("RC-104", "Rice", "UP State Agro", 18, "B4", 0, 50.0, 50.0, 0.0, "QUALITY_HOLD", 15.8),
        ("RC-105", "Rice", "FCI Hapur Depot", 7, "C4", 0, 60.0, 60.0, 0.0, "ELIGIBLE", 11.9),
        ("SL-101", "Salt", "UP State Agro", 12, "D3", 0, 45.0, 45.0, 0.0, "ELIGIBLE", 3.1),
        ("SG-102", "Sugar", "NAFED UP", 8, "D4", 0, 50.0, 50.0, 0.0, "ELIGIBLE", 8.7),
    ]

    batch_id_map = {}
    for code, comm, supp, days_ago, bay, pos, init_q, curr_q, res_q, status, moist in batch_specs:
        receipt_date = get_relative_date(days_ago)
        batch_hash = hashlib.sha256(f"BATCH:{code}:{receipt_date}:{bay}".encode("utf-8")).hexdigest()
        cursor.execute(
            """
            INSERT INTO batches (
                batch_code, commodity, supplier, receipt_date, stack_bay,
                stack_position, initial_qty, current_qty, reserved_qty,
                status, moisture_pct, sha256_hash
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (code, comm, supp, receipt_date, bay, pos, init_q, curr_q, res_q, status, moist, batch_hash)
        )
        batch_id_map[code] = cursor.lastrowid

        # Log CONSIGNMENT_RECEIPT in the audit chain
        log_audit_event(
            conn,
            "CONSIGNMENT_RECEIPT",
            {
                "batchId": code,
                "commodity": comm,
                "supplier": supp,
                "receiptDate": receipt_date,
                "bay": bay,
                "quantity": init_q,
                "status": status,
                "moisturePct": moist
            },
            timestamp=get_relative_datetime(days_ago, 9, 30)
        )

    # 3. Seed 5 Pending Indents
    indents = [
        ("IND-2026-0001", "FPS-GN-101", "Wheat", 120.0, "URGENT", "PENDING_AT_GODOWN", 2),
        ("IND-2026-0002", "FPS-GN-102", "Rice", 80.0, "HIGH", "PENDING_AT_GODOWN", 3),
        ("IND-2026-0003", "FPS-GN-103", "Sugar", 25.0, "NORMAL", "PENDING_AT_GODOWN", 4),
        ("IND-2026-0004", "FPS-GN-104", "Edible Oil", 15.0, "NORMAL", "PENDING_AT_GODOWN", 1),
        ("IND-2026-0005", "FPS-GN-105", "Chana", 20.0, "HIGH", "PENDING_AT_GODOWN", 5),
    ]

    for ino, fps_code, comm, rqty, prio, st, days_ago in indents:
        cursor.execute(
            """
            INSERT INTO fps_indents (indent_no, fps_id, commodity, requested_qty, priority, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (ino, fps_id_map[fps_code], comm, rqty, prio, st, get_relative_datetime(days_ago, 8, 15))
        )

    # 4. Seed Historical Dispatches across 4+ FPS and 3+ commodities (RC-101 supplied 3 FPS)
    historical_dispatches = [
        ("GBN-iPDS-2026-0001", "FPS-GN-101", "Rice", "RC-101", "B1", 15.0, 40, "A1F8C902B3D4E567"),
        ("GBN-iPDS-2026-0002", "FPS-GN-102", "Rice", "RC-101", "B1", 15.0, 35, "B2E7D813C4F5A678"),
        ("GBN-iPDS-2026-0003", "FPS-GN-103", "Rice", "RC-101", "B1", 20.0, 25, "C3D6E724D5A6B789"),
        ("GBN-iPDS-2026-0004", "FPS-GN-101", "Wheat", "WH-102", "A2", 25.0, 28, "D4C5F635E6B7C890"),
        ("GBN-iPDS-2026-0005", "FPS-GN-104", "Wheat", "WH-102", "A2", 15.0, 15, "E5B4A746F7C8D901"),
        ("GBN-iPDS-2026-0006", "FPS-GN-102", "Sugar", "SG-101", "C1", 20.0, 20, "F6A3B857A8D9E012"),
    ]

    prev_token_hash = "GENESIS_TOKEN_ROOT"
    for idx, (cno, fps_code, comm, bcode, bay, qty, days_ago, tok_prefix) in enumerate(historical_dispatches, start=1):
        issued_at = get_relative_datetime(days_ago, 14, 0)
        received_at = get_relative_datetime(days_ago, 16, 30)
        lines = [{
            "batch_id": batch_id_map[bcode],
            "batch_code": bcode,
            "stack_bay": bay,
            "allocated_qty": qty,
            "batch_age_days": days_ago + 10
        }]

        token_payload = {
            "challanNo": cno,
            "fps": fps_code,
            "commodity": comm,
            "qty": qty,
            "lines": lines,
            "issuedAt": issued_at,
            "deviceId": "DEVICE_CENTRAL_SRV_01",
            "localSeq": idx,
            "prevTokenHash": prev_token_hash
        }
        crypto_token = compute_challan_token(token_payload)

        cursor.execute(
            """
            INSERT INTO delivery_challans (
                challan_no, fps_id, commodity, total_qty, allocated_batches,
                is_fifo_compliant, dso_otp_verified, crypto_token, prev_token_hash,
                device_id, local_seq, status, issued_at, received_at
            )
            VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, 'DEVICE_CENTRAL_SRV_01', ?, 'RECEIVED_AT_FPS', ?, ?)
            """,
            (
                cno, fps_id_map[fps_code], comm, qty, json.dumps(lines),
                crypto_token, prev_token_hash, idx, issued_at, received_at
            )
        )

        prev_token_hash = crypto_token

        # Audit log DISPATCH_COMPLETED
        log_audit_event(
            conn,
            "DISPATCH_COMPLETED",
            {
                "challanNo": cno,
                "fpsId": fps_code,
                "commodity": comm,
                "batchId": bcode,
                "bay": bay,
                "quantity": qty,
                "token": crypto_token[:16]
            },
            timestamp=issued_at
        )

        # Audit log FPS_EPOS_RECEIPT
        log_audit_event(
            conn,
            "FPS_EPOS_RECEIPT",
            {
                "challanNo": cno,
                "fpsId": fps_code,
                "commodity": comm,
                "quantity": qty,
                "receivedAt": received_at
            },
            timestamp=received_at
        )

    # 5. Seed 2 IN_TRANSIT Challans for different Fair Price Shops
    now_dt = datetime.now(timezone.utc)
    in_transit_challans = [
        ("GBN-iPDS-2026-0007", "FPS-GN-101", "Wheat", "WH-103", "A2", 20.0, 7, now_dt - timedelta(hours=2)),
        ("GBN-iPDS-2026-0008", "FPS-GN-104", "Rice", "RC-103", "B3", 15.0, 8, now_dt - timedelta(hours=4)),
    ]

    for cno, fps_code, comm, bcode, bay, qty, seq, issued_dt in in_transit_challans:
        issued_at = issued_dt.isoformat()
        lines = [{
            "batch_id": batch_id_map[bcode],
            "batch_code": bcode,
            "stack_bay": bay,
            "allocated_qty": qty,
            "batch_age_days": 40
        }]
        token_payload = {
            "challanNo": cno,
            "fps": fps_code,
            "commodity": comm,
            "qty": qty,
            "lines": lines,
            "issuedAt": issued_at,
            "deviceId": "DEVICE_CENTRAL_SRV_01",
            "localSeq": seq,
            "prevTokenHash": prev_token_hash
        }
        crypto_token = compute_challan_token(token_payload)

        cursor.execute(
            """
            INSERT INTO delivery_challans (
                challan_no, fps_id, commodity, total_qty, allocated_batches,
                is_fifo_compliant, dso_otp_verified, crypto_token, prev_token_hash,
                device_id, local_seq, status, issued_at, received_at
            )
            VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, 'DEVICE_CENTRAL_SRV_01', ?, 'IN_TRANSIT', ?, NULL)
            """,
            (
                cno, fps_id_map[fps_code], comm, qty, json.dumps(lines),
                crypto_token, prev_token_hash, seq, issued_at
            )
        )
        prev_token_hash = crypto_token

        log_audit_event(
            conn,
            "DISPATCH_COMPLETED",
            {
                "challanNo": cno,
                "fpsId": fps_code,
                "commodity": comm,
                "batchId": bcode,
                "bay": bay,
                "quantity": qty,
                "token": crypto_token[:16]
            },
            timestamp=issued_at
        )

    # 6. Seed 1 STAGED Challan with Pending FIFO Exception (for DSO Vigilance demo)
    exc_cno = "GBN-iPDS-2026-0009"
    exc_fps = "FPS-GN-102"
    exc_comm = "Wheat"
    exc_qty = 20.0
    exc_lines = [{
        "batch_id": batch_id_map["WH-105"],
        "batch_code": "WH-105",
        "stack_bay": "D2",
        "allocated_qty": 20.0,
        "batch_age_days": 5
    }]
    exc_issued_at = (now_dt - timedelta(minutes=15)).isoformat()
    exc_token_payload = {
        "challanNo": exc_cno,
        "fps": exc_fps,
        "commodity": exc_comm,
        "qty": exc_qty,
        "lines": exc_lines,
        "issuedAt": exc_issued_at,
        "deviceId": "DEVICE_CENTRAL_SRV_01",
        "localSeq": 9,
        "prevTokenHash": prev_token_hash
    }
    exc_token = compute_challan_token(exc_token_payload)

    cursor.execute(
        """
        INSERT INTO delivery_challans (
            challan_no, fps_id, commodity, total_qty, allocated_batches,
            is_fifo_compliant, exception_reason, dso_otp_verified, crypto_token, prev_token_hash,
            device_id, local_seq, status, issued_at, received_at
        )
        VALUES (?, ?, ?, ?, ?, 0, 'Drought emergency relief order #GBN-2026-DM-4', 0, ?, ?, 'DEVICE_CENTRAL_SRV_01', 9, 'STAGED', ?, NULL)
        """,
        (
            exc_cno, fps_id_map[exc_fps], exc_comm, exc_qty, json.dumps(exc_lines),
            exc_token, prev_token_hash, exc_issued_at
        )
    )
    exc_challan_id = cursor.lastrowid

    # Seed 2 OTP Requests (Supervisor + DSO) for this exception
    from backend.otp import hash_otp, _SIMULATED_SMS_CACHE
    sup_salt = "seed_salt_sup"
    dso_salt = "seed_salt_dso"
    sup_otp = "482910"
    dso_otp = "482910"
    expiry = (now_dt + timedelta(seconds=120)).isoformat()

    cursor.execute(
        """
        INSERT INTO otp_requests (challan_id, role, otp_hash, salt, expires_at, attempts, locked_until, used, status)
        VALUES (?, 'SUPERVISOR', ?, ?, ?, 0, NULL, 0, 'PENDING')
        """,
        (exc_challan_id, hash_otp(sup_otp, sup_salt), sup_salt, expiry)
    )
    sup_req_id = cursor.lastrowid
    _SIMULATED_SMS_CACHE[sup_req_id] = sup_otp

    cursor.execute(
        """
        INSERT INTO otp_requests (challan_id, role, otp_hash, salt, expires_at, attempts, locked_until, used, status)
        VALUES (?, 'DSO', ?, ?, ?, 0, NULL, 0, 'PENDING')
        """,
        (exc_challan_id, hash_otp(dso_otp, dso_salt), dso_salt, expiry)
    )
    dso_req_id = cursor.lastrowid
    _SIMULATED_SMS_CACHE[dso_req_id] = dso_otp

    log_audit_event(
        conn,
        "FIFO_VIOLATION_DETECTED",
        {
            "challanNo": exc_cno,
            "fpsId": exc_fps,
            "commodity": exc_comm,
            "chosenBatch": "WH-105",
            "olderEligibleBatch": "WH-104",
            "quantity": exc_qty,
            "reason": "Drought emergency relief order #GBN-2026-DM-4"
        },
        timestamp=exc_issued_at
    )

    conn.commit()

