import pytest
import sqlite3
from pathlib import Path
from backend.db import init_db, get_connection
from backend.seed import seed_database
import backend.config as config

@pytest.fixture
def test_db(tmp_path):
    test_db_path = tmp_path / "test_annasetu.db"
    orig_path = config.DB_PATH
    config.DB_PATH = test_db_path

    init_db(test_db_path)
    conn = get_connection(test_db_path)
    seed_database(conn)
    conn.close()

    yield test_db_path

    config.DB_PATH = orig_path
