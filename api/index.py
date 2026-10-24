import sys
import os
import shutil
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Ensure writable DB in /tmp on Vercel serverless environment
if os.getenv("VERCEL"):
    tmp_db = Path("/tmp/annasetu.db")
    src_db = root_dir / "backend" / "annasetu.db"
    if not tmp_db.exists() and src_db.exists():
        try:
            shutil.copy2(src_db, tmp_db)
        except Exception as e:
            print(f"Error copying database to /tmp: {e}")
    os.environ["DB_PATH"] = str(tmp_db)

from backend.main import app
from backend.db import init_db, get_db
from backend.seed import seed_database

# Ensure database is initialized even if lifespan is deferred by ASGI bridge
try:
    init_db()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM batches")
        if cursor.fetchone()["count"] == 0:
            seed_database(conn)
except Exception as e:
    print(f"DB startup check notice: {e}")
