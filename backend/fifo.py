from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Tuple

class ShortfallError(Exception):
    def __init__(self, message: str, shortfall: float, available: float):
        super().__init__(message)
        self.message = message
        self.shortfall = shortfall
        self.available = available

def get_age_days(receipt_date_str: str, as_of: date = None) -> int:
    if as_of is None:
        as_of = datetime.now(timezone.utc).date()
    try:
        r_date = date.fromisoformat(receipt_date_str)
        return max(0, (as_of - r_date).days)
    except Exception:
        return 0

def allocate_fifo(
    batches: List[Dict[str, Any]],
    commodity: str,
    requested_qty: float,
    as_of: date = None
) -> Dict[str, Any]:
    """
    Pure, deterministic FIFO allocation algorithm.
    - Filters commodity, status == 'ELIGIBLE', available > 0
    - Skips and tracks QUALITY_HOLD batches
    - Sorts oldest-first by receipt_date ASC, then batch_code ASC
    - Cascades allocation step by step
    - Raises ShortfallError if total eligible available < requested_qty
    """
    if as_of is None:
        as_of = datetime.now(timezone.utc).date()

    needed = Decimal(str(requested_qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if needed <= Decimal("0"):
        raise ValueError("Requested quantity must be strictly greater than 0")

    skipped_holds = []
    candidates = []

    for b in batches:
        b_comm = b.get("commodity")
        if b_comm != commodity:
            continue

        curr = Decimal(str(b.get("current_qty", 0)))
        res = Decimal(str(b.get("reserved_qty", 0)))
        avail = curr - res
        age = get_age_days(b["receipt_date"], as_of)

        if b.get("status") == "QUALITY_HOLD" or b.get("moisture_pct", 0) > 14.0:
            if avail > Decimal("0"):
                skipped_holds.append({
                    "batch_code": b["batch_code"],
                    "bay": b.get("stack_bay", ""),
                    "age_days": age,
                    "reason": "Hold: High Moisture (no penalty)",
                    "moisture_pct": b.get("moisture_pct", 0),
                    "available": float(avail.quantize(Decimal("0.01")))
                })
            continue

        if b.get("status") == "ELIGIBLE" and avail > Decimal("0"):
            candidates.append({
                "id": b.get("id"),
                "batch_code": b["batch_code"],
                "stack_bay": b.get("stack_bay", ""),
                "receipt_date": b["receipt_date"],
                "age_days": age,
                "available": avail
            })

    # Sort oldest-first by receipt_date, tie-break batch_code alphabetically
    candidates.sort(key=lambda x: (x["receipt_date"], x["batch_code"]))

    total_available = sum(c["available"] for c in candidates)
    if total_available < needed:
        shortfall = float((needed - total_available).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        avail_float = float(total_available.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        raise ShortfallError(
            f"Stock Shortfall: Requested {float(needed)} Qtl exceeds available eligible stock {avail_float} Qtl (Deficit: {shortfall} Qtl)",
            shortfall=shortfall,
            available=avail_float
        )

    allocated_batches = []
    waterfall_steps = []
    step_num = 1
    remaining_needed = needed

    for c in candidates:
        if remaining_needed <= Decimal("0"):
            break

        take = min(c["available"], remaining_needed)
        batch_after = c["available"] - take
        remaining_needed -= take

        step_dict = {
            "step": step_num,
            "batch_code": c["batch_code"],
            "batch_id": c["id"],
            "bay": c["stack_bay"],
            "age_days": c["age_days"],
            "available": float(c["available"].quantize(Decimal("0.01"))),
            "take": float(take.quantize(Decimal("0.01"))),
            "batch_after": float(batch_after.quantize(Decimal("0.01"))),
            "still_needed": float(remaining_needed.quantize(Decimal("0.01")))
        }
        waterfall_steps.append(step_dict)

        allocated_batches.append({
            "batch_id": c["id"],
            "batch_code": c["batch_code"],
            "stack_bay": c["stack_bay"],
            "allocated_qty": float(take.quantize(Decimal("0.01"))),
            "batch_age_days": c["age_days"]
        })

        step_num += 1

    total_allocated = float(sum(Decimal(str(a["allocated_qty"])) for a in allocated_batches))

    return {
        "allocated_batches": allocated_batches,
        "waterfall_steps": waterfall_steps,
        "skipped_holds": skipped_holds,
        "total_allocated": total_allocated,
        "is_fifo_compliant": True
    }

def check_fifo_violation(
    batches: List[Dict[str, Any]],
    commodity: str,
    selected_picks: List[Dict[str, Any]],
    as_of: date = None
) -> Tuple[bool, List[str], str]:
    """
    Checks if a manual selection violates FIFO statutory rules:
    A selection is a violation if a picked batch is newer than an eligible older
    batch whose available balance was not fully exhausted.
    """
    if as_of is None:
        as_of = datetime.now(timezone.utc).date()

    picks_by_code = {
        p["batch_code"]: Decimal(str(p.get("qty", 0))).quantize(Decimal("0.01"))
        for p in selected_picks if float(p.get("qty", 0)) > 0
    }

    if not picks_by_code:
        return False, [], ""

    eligible = []
    for b in batches:
        if b.get("commodity") != commodity:
            continue
        curr = Decimal(str(b.get("current_qty", 0)))
        res = Decimal(str(b.get("reserved_qty", 0)))
        avail = curr - res
        if b.get("status") == "ELIGIBLE" and avail > Decimal("0"):
            eligible.append({
                "batch_code": b["batch_code"],
                "receipt_date": b["receipt_date"],
                "available": avail,
                "picked": picks_by_code.get(b["batch_code"], Decimal("0")),
                "age_days": get_age_days(b["receipt_date"], as_of)
            })

    eligible.sort(key=lambda x: (x["receipt_date"], x["batch_code"]))

    skipped = []
    # Check each picked batch against older batches
    for picked_code, picked_qty in picks_by_code.items():
        picked_batch = next((e for e in eligible if e["batch_code"] == picked_code), None)
        if not picked_batch:
            continue

        for older in eligible:
            # If older comes before picked in FIFO sort order
            is_older = (older["receipt_date"], older["batch_code"]) < (picked_batch["receipt_date"], picked_batch["batch_code"])
            if is_older:
                unpicked = older["available"] - older["picked"]
                if unpicked > Decimal("0.01"):
                    if older["batch_code"] not in skipped:
                        skipped.append(older["batch_code"])

    if skipped:
        reason = f"Out-of-turn dispatch: selected newer batch while older eligible stock in batch(es) {', '.join(skipped)} remains unexhausted."
        return True, skipped, reason

    return False, [], ""
