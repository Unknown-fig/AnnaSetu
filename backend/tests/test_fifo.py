import pytest
from datetime import date
from backend.fifo import allocate_fifo, check_fifo_violation, ShortfallError

def test_waterfall_allocation_multi_batch():
    batches = [
        {"id": 1, "batch_code": "WH-101", "commodity": "Wheat", "receipt_date": "2026-08-09", "stack_bay": "A1", "current_qty": 40.0, "reserved_qty": 0.0, "status": "QUALITY_HOLD", "moisture_pct": 16.5},
        {"id": 2, "batch_code": "WH-102", "commodity": "Wheat", "receipt_date": "2026-08-29", "stack_bay": "A2", "current_qty": 50.0, "reserved_qty": 0.0, "status": "ELIGIBLE", "moisture_pct": 11.8},
        {"id": 3, "batch_code": "WH-103", "commodity": "Wheat", "receipt_date": "2026-09-08", "stack_bay": "A3", "current_qty": 55.0, "reserved_qty": 0.0, "status": "ELIGIBLE", "moisture_pct": 12.0},
        {"id": 4, "batch_code": "WH-104", "commodity": "Wheat", "receipt_date": "2026-10-09", "stack_bay": "A4", "current_qty": 40.0, "reserved_qty": 0.0, "status": "ELIGIBLE", "moisture_pct": 11.5},
    ]

    # Allocate 120 Qtl of Wheat
    res = allocate_fifo(batches, "Wheat", 120.0, as_of=date(2026, 10, 23))

    # 1. WH-101 (Hold) must be skipped
    assert len(res["skipped_holds"]) == 1
    assert res["skipped_holds"][0]["batch_code"] == "WH-101"

    # 2. Multi-batch split: 50 from WH-102 + 55 from WH-103 + 15 from WH-104
    allocs = res["allocated_batches"]
    assert len(allocs) == 3
    assert allocs[0]["batch_code"] == "WH-102"
    assert allocs[0]["allocated_qty"] == 50.0

    assert allocs[1]["batch_code"] == "WH-103"
    assert allocs[1]["allocated_qty"] == 55.0

    assert allocs[2]["batch_code"] == "WH-104"
    assert allocs[2]["allocated_qty"] == 15.0

    assert res["total_allocated"] == 120.0

def test_shortfall_detection():
    batches = [
        {"id": 1, "batch_code": "RC-101", "commodity": "Rice", "receipt_date": "2026-08-19", "stack_bay": "B1", "current_qty": 50.0, "reserved_qty": 0.0, "status": "ELIGIBLE", "moisture_pct": 12.0},
    ]

    with pytest.raises(ShortfallError) as exc_info:
        allocate_fifo(batches, "Rice", 100.0, as_of=date(2026, 10, 23))

    assert exc_info.value.shortfall == 50.0
    assert exc_info.value.available == 50.0

def test_manual_violation_detection():
    batches = [
        {"id": 1, "batch_code": "WH-102", "commodity": "Wheat", "receipt_date": "2026-08-29", "stack_bay": "A2", "current_qty": 50.0, "reserved_qty": 0.0, "status": "ELIGIBLE", "moisture_pct": 11.8},
        {"id": 2, "batch_code": "WH-105", "commodity": "Wheat", "receipt_date": "2026-10-18", "stack_bay": "D2", "current_qty": 80.0, "reserved_qty": 0.0, "status": "ELIGIBLE", "moisture_pct": 11.2},
    ]

    # Picking newer WH-105 before exhausting older WH-102
    picks = [{"batch_code": "WH-105", "qty": 30.0}]
    is_violation, skipped, reason = check_fifo_violation(batches, "Wheat", picks, as_of=date(2026, 10, 23))

    assert is_violation is True
    assert "WH-102" in skipped

    # Picking older WH-102 first is NOT a violation
    compliant_picks = [{"batch_code": "WH-102", "qty": 50.0}, {"batch_code": "WH-105", "qty": 10.0}]
    is_v2, skipped2, _ = check_fifo_violation(batches, "Wheat", compliant_picks, as_of=date(2026, 10, 23))
    assert is_v2 is False
    assert len(skipped2) == 0
