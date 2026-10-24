import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
if os.getenv("VERCEL"):
    DB_PATH = Path(os.getenv("DB_PATH", "/tmp/annasetu.db"))
else:
    DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR / "annasetu.db")))

# Approver security configuration (single-line switch)
REQUIRED_OTP_APPROVERS = int(os.getenv("REQUIRED_OTP_APPROVERS", "2"))

# Godown Bays
VALID_BAYS = {
    f"{row}{col}" for row in ["A", "B", "C", "D"] for col in [1, 2, 3, 4]
}

# Commodities in DB
DB_COMMODITIES = [
    "Wheat",
    "Rice",
    "Sugar",
    "Salt",
    "Edible Oil",
    "Chana",
    "Tuvar Dal",
]

# Naming mapping: DB name -> Frontend name
COMMODITY_DB_TO_UI = {
    "Edible Oil": "Mustard Oil",
}

COMMODITY_UI_TO_DB = {
    "Mustard Oil": "Edible Oil",
}

STATUS_DB_TO_UI = {
    "QUALITY_HOLD": "Hold - High Moisture",
    "ELIGIBLE": "Eligible",
}

STATUS_UI_TO_DB = {
    "Hold - High Moisture": "QUALITY_HOLD",
    "Eligible": "ELIGIBLE",
}

MAX_INDENT_QTL = 500.0
POLL_INTERVAL_MS = 2000

# Per-commodity low stock thresholds (in Quintals)
LOW_STOCK_THRESHOLDS = {
    "Wheat": 25.0,
    "Rice": 25.0,
    "Sugar": 12.0,
    "Salt": 8.0,
    "Edible Oil": 10.0,
    "Chana": 10.0,
    "Tuvar Dal": 10.0,
}

CRITICAL_STOCK_THRESHOLDS = {
    "Wheat": 10.0,
    "Rice": 10.0,
    "Sugar": 5.0,
    "Salt": 4.0,
    "Edible Oil": 5.0,
    "Chana": 5.0,
    "Tuvar Dal": 5.0,
}

def get_stock_status(commodity: str, qty: float) -> str:
    db_comm = to_db_commodity(commodity)
    crit = CRITICAL_STOCK_THRESHOLDS.get(db_comm, 5.0)
    low = LOW_STOCK_THRESHOLDS.get(db_comm, 15.0)
    if qty <= crit:
        return "CRITICAL"
    elif qty <= low:
        return "LOW"
    return "NORMAL"

def is_low_stock(commodity: str, qty: float) -> bool:
    return get_stock_status(commodity, qty) in ("CRITICAL", "LOW")

def to_db_commodity(comm: str) -> str:
    return COMMODITY_UI_TO_DB.get(comm, comm)

def to_ui_commodity(comm: str) -> str:
    return COMMODITY_DB_TO_UI.get(comm, comm)

def to_db_status(status: str) -> str:
    return STATUS_UI_TO_DB.get(status, status)

def to_ui_status(status: str) -> str:
    return STATUS_DB_TO_UI.get(status, status)
