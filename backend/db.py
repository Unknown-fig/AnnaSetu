import sqlite3
import json
from contextlib import contextmanager
from typing import Generator
from backend import config

def init_db(db_path=None):
    if db_path is None:
        db_path = config.DB_PATH
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")

    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_code TEXT UNIQUE NOT NULL,
            commodity TEXT NOT NULL,
            supplier TEXT NOT NULL,
            receipt_date TEXT NOT NULL,
            stack_bay TEXT NOT NULL CHECK(stack_bay IN (
                'A1','A2','A3','A4','B1','B2','B3','B4',
                'C1','C2','C3','C4','D1','D2','D3','D4'
            )),
            stack_position INTEGER NOT NULL,
            initial_qty REAL NOT NULL,
            current_qty REAL NOT NULL CHECK(current_qty >= 0),
            reserved_qty REAL NOT NULL DEFAULT 0 CHECK(reserved_qty >= 0),
            status TEXT NOT NULL CHECK(status IN ('ELIGIBLE', 'QUALITY_HOLD')),
            moisture_pct REAL NOT NULL,
            sha256_hash TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fps_stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fps_code TEXT UNIQUE NOT NULL,
            shop_name TEXT NOT NULL,
            dealer_name TEXT NOT NULL,
            location TEXT NOT NULL,
            stock_inventory TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS fps_indents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            indent_no TEXT UNIQUE NOT NULL,
            fps_id INTEGER NOT NULL REFERENCES fps_stores(id),
            commodity TEXT NOT NULL,
            requested_qty REAL NOT NULL,
            priority TEXT NOT NULL CHECK(priority IN ('NORMAL', 'HIGH', 'URGENT')),
            status TEXT NOT NULL CHECK(status IN ('PENDING_AT_GODOWN', 'CHALLAN_ISSUED', 'DELIVERED_TO_FPS')),
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS delivery_challans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challan_no TEXT UNIQUE NOT NULL,
            indent_id INTEGER REFERENCES fps_indents(id),
            fps_id INTEGER NOT NULL REFERENCES fps_stores(id),
            commodity TEXT NOT NULL,
            total_qty REAL NOT NULL,
            allocated_batches TEXT NOT NULL DEFAULT '[]',
            is_fifo_compliant INTEGER NOT NULL DEFAULT 1,
            exception_reason TEXT,
            dso_otp_verified INTEGER NOT NULL DEFAULT 0,
            crypto_token TEXT NOT NULL,
            prev_token_hash TEXT,
            device_id TEXT,
            local_seq INTEGER,
            status TEXT NOT NULL CHECK(status IN ('STAGED', 'IN_TRANSIT', 'RECEIVED_AT_FPS', 'CANCELLED')),
            issued_at TEXT NOT NULL,
            received_at TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '{}',
            timestamp TEXT NOT NULL,
            prev_hash TEXT NOT NULL,
            hash TEXT NOT NULL
        );

        CREATE TRIGGER IF NOT EXISTS block_audit_update
        BEFORE UPDATE ON audit_logs
        BEGIN
            SELECT RAISE(FAIL, 'audit_logs table is append-only: UPDATE prohibited');
        END;

        CREATE TRIGGER IF NOT EXISTS block_audit_delete
        BEFORE DELETE ON audit_logs
        BEGIN
            SELECT RAISE(FAIL, 'audit_logs table is append-only: DELETE prohibited');
        END;

        CREATE TABLE IF NOT EXISTS otp_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challan_id INTEGER NOT NULL REFERENCES delivery_challans(id),
            role TEXT NOT NULL CHECK(role IN ('SUPERVISOR', 'DSO')),
            otp_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            used INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'PENDING'
        );

        CREATE TABLE IF NOT EXISTS sync_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            local_seq INTEGER NOT NULL,
            payload TEXT NOT NULL DEFAULT '{}',
            status TEXT NOT NULL CHECK(status IN ('SYNCED', 'CONFLICT')),
            conflict_reason TEXT,
            server_received_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS system_state (
            key TEXT PRIMARY KEY,
            version INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL
        );
        """)

    conn.close()

def get_connection(db_path=None) -> sqlite3.Connection:
    if db_path is None:
        db_path = config.DB_PATH
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

@contextmanager
def get_db(db_path=None) -> Generator[sqlite3.Connection, None, None]:
    if db_path is None:
        db_path = config.DB_PATH
    conn = get_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()

def get_state_version(conn: sqlite3.Connection) -> dict:
    from datetime import datetime, timezone
    cursor = conn.cursor()
    cursor.execute("SELECT version, updated_at FROM system_state WHERE key = 'global'")
    row = cursor.fetchone()
    if row:
        return {"version": int(row["version"]), "updated_at": row["updated_at"]}
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        "INSERT INTO system_state (key, version, updated_at) VALUES ('global', 1, ?)",
        (now,)
    )
    return {"version": 1, "updated_at": now}

def increment_state_version(conn: sqlite3.Connection) -> dict:
    from datetime import datetime, timezone
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO system_state (key, version, updated_at)
        VALUES ('global', 1, ?)
        ON CONFLICT(key) DO UPDATE SET
            version = system_state.version + 1,
            updated_at = excluded.updated_at
    """, (now,))
    cursor.execute("SELECT version, updated_at FROM system_state WHERE key = 'global'")
    row = cursor.fetchone()
    return {"version": int(row["version"]), "updated_at": row["updated_at"]}

