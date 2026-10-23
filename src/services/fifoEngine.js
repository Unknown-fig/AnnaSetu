import { QUALITY_STATUS, calculateAgeDays, round2 } from '../types/models';

/**
 * Pure function: Allocates stock using strict First-In-First-Out (FIFO) logic.
 * 
 * Rules:
 * 1. Filter batches matching commodity AND qualityStatus === 'Eligible' AND remainingQtl > 0.
 * 2. "Hold - High Moisture" batches are strictly ignored.
 * 3. Sort ascending by receiptDate (oldest first). Tie-break by batchId alphabetically.
 * 4. Cascade allocations taking min(remaining, stillNeeded), rounded to 2 decimal places.
 * 5. Return allocations or shortfall error.
 */
export function allocateFIFO(batches, commodity, requestedQty, reservations = []) {
  const qty = round2(requestedQty);

  if (!commodity) {
    return {
      success: false,
      error: 'Please select a commodity.',
      shortfall: 0,
      totalAvailable: 0,
      waterfallSteps: [],
      skippedHoldBatches: [],
    };
  }

  if (isNaN(qty) || qty <= 0) {
    return {
      success: false,
      error: 'Dispatch quantity must be greater than 0 Quintals.',
      shortfall: 0,
      totalAvailable: 0,
      waterfallSteps: [],
      skippedHoldBatches: [],
    };
  }

  // Build reservation lookup map by batchId
  const reservationMap = new Map();
  if (Array.isArray(reservations)) {
    reservations.forEach(r => {
      reservationMap.set(r.batchId, round2((reservationMap.get(r.batchId) || 0) + (Number(r.qty) || 0)));
    });
  }

  // 1. Identify all commodity batches and record skipped Hold batches
  const allCommodityBatches = batches
    .filter(b => b.commodity === commodity && (b.remainingQtl || 0) > 0)
    .sort((a, b) => {
      const diff = new Date(a.receiptDate).getTime() - new Date(b.receiptDate).getTime();
      if (diff !== 0) return diff;
      return a.batchId.localeCompare(b.batchId);
    });

  const skippedHoldBatches = [];
  const eligibleBatches = [];

  for (const b of allCommodityBatches) {
    const ageDays = calculateAgeDays(b.receiptDate);
    if (b.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE) {
      skippedHoldBatches.push({
        batchId: b.batchId,
        bay: b.bay,
        ageDays,
        balance: round2(b.remainingQtl),
        supplier: b.supplier,
        reason: 'Hold: High Moisture (no penalty)',
        reasonHi: 'रोका गया: अधिक नमी (कोई दंड नहीं)',
      });
    } else if (b.qualityStatus === QUALITY_STATUS.ELIGIBLE) {
      // Deduct active reservations
      const reservedQty = reservationMap.get(b.batchId) || 0;
      const unreservedBalance = Math.max(0, round2(b.remainingQtl - reservedQty));
      if (unreservedBalance > 0) {
        eligibleBatches.push({
          ...b,
          availableQtl: unreservedBalance,
          actualRemainingQtl: round2(b.remainingQtl),
          reservedQtl: reservedQty,
        });
      }
    }
  }

  const totalAvailable = round2(eligibleBatches.reduce((acc, b) => acc + (b.availableQtl || 0), 0));

  // 2. Shortfall Detection
  if (totalAvailable < qty) {
    const shortfall = round2(qty - totalAvailable);
    return {
      success: false,
      error: `Shortfall of ${shortfall} Qtl detected! Total available eligible unreserved stock is only ${totalAvailable} Qtl. Dispatch blocked.`,
      shortfall,
      totalAvailable,
      requestedQty: qty,
      commodity,
      allocations: [],
      waterfallSteps: [],
      skippedHoldBatches,
    };
  }

  // 3. FIFO Cascade Allocation with Step-by-Step Waterfall
  let stillNeeded = qty;
  const allocations = [];
  const waterfallSteps = [];
  let stepIndex = 1;

  for (const batch of eligibleBatches) {
    if (stillNeeded <= 0) break;

    const take = round2(Math.min(batch.availableQtl, stillNeeded));
    const ageDays = calculateAgeDays(batch.receiptDate);
    const remainingBefore = round2(batch.availableQtl);
    const remainingAfter = round2(batch.availableQtl - take);
    const stillNeededAfter = round2(Math.max(0, stillNeeded - take));

    allocations.push({
      batchId: batch.batchId,
      bay: batch.bay,
      supplier: batch.supplier,
      receiptDate: batch.receiptDate,
      ageDays,
      take,
      remainingBefore,
      remainingAfter,
      isExhausted: remainingAfter === 0,
    });

    waterfallSteps.push({
      stepNumber: stepIndex++,
      batchId: batch.batchId,
      bay: batch.bay,
      ageDays,
      balanceBefore: remainingBefore,
      take,
      balanceAfter: remainingAfter,
      stillNeeded: stillNeededAfter,
    });

    stillNeeded = stillNeededAfter;
  }

  return {
    success: true,
    commodity,
    requestedQty: qty,
    allocations,
    waterfallSteps,
    skippedHoldBatches,
    totalAvailable,
    totalAllocated: qty,
    splitCount: allocations.length,
    oldestBatchDate: eligibleBatches[0]?.receiptDate,
  };
}

/**
 * Validates manual batch allocations against strict FIFO rules.
 * Rule: Violation if any selected batch is newer than an eligible older batch that still has balance and isn't fully taken.
 * Also checks if sum of picks equals requested quantity.
 */
export function checkManualFifoViolation(batches, commodity, manualPicks, requestedQty) {
  const targetQty = requestedQty ? round2(requestedQty) : null;
  const eligibleBatches = batches
    .filter(b => b.commodity === commodity && b.qualityStatus === QUALITY_STATUS.ELIGIBLE && b.remainingQtl > 0)
    .sort((a, b) => {
      const diff = new Date(a.receiptDate).getTime() - new Date(b.receiptDate).getTime();
      if (diff !== 0) return diff;
      return a.batchId.localeCompare(b.batchId);
    });

  let totalManualPicked = 0;
  for (const batch of eligibleBatches) {
    totalManualPicked = round2(totalManualPicked + (Number(manualPicks[batch.batchId]) || 0));
  }

  // 1. Single-pass O(N) check for FIFO skip violation
  // Since eligibleBatches is sorted chronologically ascending (oldest first):
  // Find the first older batch that was NOT fully exhausted (olderUnpicked > 0).
  // Then check if any subsequent newer batch has newerPick > 0.
  let firstUnexhaustedBatch = null;

  for (let i = 0; i < eligibleBatches.length; i++) {
    const batch = eligibleBatches[i];
    const pick = round2(Number(manualPicks[batch.batchId]) || 0);
    const unpicked = round2(batch.remainingQtl - pick);

    if (!firstUnexhaustedBatch) {
      if (unpicked > 0) {
        firstUnexhaustedBatch = { batch, unpicked };
      }
    } else {
      // An older eligible batch was not fully exhausted
      const isNewer = new Date(batch.receiptDate).getTime() > new Date(firstUnexhaustedBatch.batch.receiptDate).getTime();
      if (isNewer && pick > 0) {
        const olderAge = calculateAgeDays(firstUnexhaustedBatch.batch.receiptDate);
        const newerAge = calculateAgeDays(batch.receiptDate);

        return {
          isViolation: true,
          olderBatchId: firstUnexhaustedBatch.batch.batchId,
          olderBay: firstUnexhaustedBatch.batch.bay,
          olderAge,
          olderUnpicked: firstUnexhaustedBatch.unpicked,
          newerBatchId: batch.batchId,
          newerBay: batch.bay,
          newerAge,
          newerPick: pick,
          totalPicked: totalManualPicked,
          targetQty,
          message: `FIFO VIOLATION: Newer Batch #${batch.batchId} (${newerAge}d old in Bay ${batch.bay}) was allocated ${pick} Qtl, while older Batch #${firstUnexhaustedBatch.batch.batchId} (${olderAge}d old in Bay ${firstUnexhaustedBatch.batch.bay}) still has ${firstUnexhaustedBatch.unpicked} Qtl unexhausted stock balance!`,
        };
      }
    }
  }

  // 2. Sum matching check
  const sumMatches = targetQty ? totalManualPicked === targetQty : true;

  return {
    isViolation: false,
    totalPicked: totalManualPicked,
    targetQty,
    sumMatches,
    shortfallOrSurplus: targetQty ? round2(targetQty - totalManualPicked) : 0,
  };
}

/**
 * Re-validates batch availability at actual dispatch time to prevent double allocation.
 */
export function revalidateDispatchAllocations(currentBatches, stagedAllocations) {
  for (const alloc of stagedAllocations) {
    const batch = currentBatches.find(b => b.batchId === alloc.batchId);
    if (!batch) {
      return {
        isValid: false,
        error: `Batch #${alloc.batchId} was not found in godown stock!`,
      };
    }
    if (round2(batch.remainingQtl) < round2(alloc.take)) {
      return {
        isValid: false,
        error: `Double allocation detected! Batch #${alloc.batchId} has only ${batch.remainingQtl} Qtl remaining, but staged challan requires ${alloc.take} Qtl.`,
      };
    }
  }
  return { isValid: true };
}
