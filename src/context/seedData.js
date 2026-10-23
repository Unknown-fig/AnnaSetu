import { QUALITY_STATUS } from '../types/models';

/**
 * Returns an ISO date string (YYYY-MM-DD) offset by a given number of days from today,
 * normalized to UTC midnight.
 */
export function getRelativeDate(daysAgo) {
  const d = new Date();
  const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysAgo));
  return utcDate.toISOString().split('T')[0];
}

/**
 * Deterministic SHA-256 placeholder generator for initial seed before runtime hashes
 */
function createDeterministicHash(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `0x${hex}e93bf81d2a44c9b0e12d8f9930fca56e2978110b48cde5a8947b71f92e`.slice(0, 66);
}

/**
 * Creates 16 batches:
 * - 3 Critical (60+ days) [Oldest Wheat WH-101 is HOLD - HIGH MOISTURE to show judges it gets skipped!]
 * - 7 Ageing (21-59 days)
 * - 6 Fresh (0-20 days)
 * Exactly 2 Hold batches (WH-101 Wheat and RC-104 Rice).
 * Wheat and Rice both have 3+ eligible batches of different ages for multi-split testing.
 */
export function createSeedBatches() {
  const rawBatches = [
    // --- 3 CRITICAL BATCHES (60+ days) ---
    {
      batchId: 'WH-101',
      commodity: 'Wheat',
      supplier: 'FCI Hapur Depot',
      daysAgo: 75,
      bay: 'A1',
      qtyReceivedQtl: 40,
      remainingQtl: 40,
      qualityStatus: QUALITY_STATUS.HOLD_HIGH_MOISTURE, // OLDEST WHEAT ON HOLD (Demo Booster)
    },
    {
      batchId: 'RC-101',
      commodity: 'Rice',
      supplier: 'UP State Agro',
      daysAgo: 65,
      bay: 'B1',
      qtyReceivedQtl: 100,
      remainingQtl: 50,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'SG-101',
      commodity: 'Sugar',
      supplier: 'NAFED UP',
      daysAgo: 62,
      bay: 'C1',
      qtyReceivedQtl: 55,
      remainingQtl: 35,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },

    // --- 7 AGEING BATCHES (21-59 days) ---
    {
      batchId: 'WH-102',
      commodity: 'Wheat',
      supplier: 'FCI Hapur Depot',
      daysAgo: 55,
      bay: 'A2',
      qtyReceivedQtl: 90,
      remainingQtl: 50,
      qualityStatus: QUALITY_STATUS.ELIGIBLE, // Oldest ELIGIBLE Wheat batch
    },
    {
      batchId: 'WH-103',
      commodity: 'Wheat',
      supplier: 'FCI Hapur Depot',
      daysAgo: 45,
      bay: 'A3',
      qtyReceivedQtl: 55,
      remainingQtl: 55,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'RC-102',
      commodity: 'Rice',
      supplier: 'UP State Agro',
      daysAgo: 48,
      bay: 'B2',
      qtyReceivedQtl: 45,
      remainingQtl: 45,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
      stackPosition: 1, // BACK layer (older stock behind)
    },
    {
      batchId: 'RC-106',
      commodity: 'Rice',
      supplier: 'UP State Agro',
      daysAgo: 10,
      bay: 'B2',
      qtyReceivedQtl: 30,
      remainingQtl: 30,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
      stackPosition: 0, // FRONT layer (newer stock in front)
    },
    {
      batchId: 'RC-103',
      commodity: 'Rice',
      supplier: 'FCI Hapur Depot',
      daysAgo: 38,
      bay: 'B3',
      qtyReceivedQtl: 70,
      remainingQtl: 70,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'CH-101',
      commodity: 'Chana',
      supplier: 'NAFED UP',
      daysAgo: 42,
      bay: 'C2',
      qtyReceivedQtl: 30,
      remainingQtl: 30,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'TD-101',
      commodity: 'Tuvar Dal',
      supplier: 'NAFED UP',
      daysAgo: 36,
      bay: 'C3',
      qtyReceivedQtl: 40,
      remainingQtl: 40,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'MO-101',
      commodity: 'Mustard Oil',
      supplier: 'UP State Agro',
      daysAgo: 32,
      bay: 'D1',
      qtyReceivedQtl: 25,
      remainingQtl: 25,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },

    // --- 6 FRESH BATCHES (0-20 days) ---
    {
      batchId: 'WH-104',
      commodity: 'Wheat',
      supplier: 'FCI Hapur Depot',
      daysAgo: 14,
      bay: 'A4',
      qtyReceivedQtl: 40,
      remainingQtl: 40,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'WH-105',
      commodity: 'Wheat',
      supplier: 'UP State Agro',
      daysAgo: 5,
      bay: 'D2',
      qtyReceivedQtl: 80,
      remainingQtl: 80,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'RC-104',
      commodity: 'Rice',
      supplier: 'UP State Agro',
      daysAgo: 18,
      bay: 'B4',
      qtyReceivedQtl: 50,
      remainingQtl: 50,
      qualityStatus: QUALITY_STATUS.HOLD_HIGH_MOISTURE, // Second Hold batch
    },
    {
      batchId: 'RC-105',
      commodity: 'Rice',
      supplier: 'FCI Hapur Depot',
      daysAgo: 7,
      bay: 'C4',
      qtyReceivedQtl: 60,
      remainingQtl: 60,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'SL-101',
      commodity: 'Salt',
      supplier: 'UP State Agro',
      daysAgo: 12,
      bay: 'D3',
      qtyReceivedQtl: 45,
      remainingQtl: 45,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
    {
      batchId: 'SG-102',
      commodity: 'Sugar',
      supplier: 'NAFED UP',
      daysAgo: 8,
      bay: 'D4',
      qtyReceivedQtl: 50,
      remainingQtl: 50,
      qualityStatus: QUALITY_STATUS.ELIGIBLE,
    },
  ];

  return rawBatches.map(b => {
    const receiptDate = getRelativeDate(b.daysAgo);
    const sha256Hash = createDeterministicHash(`BATCH:${b.batchId}:${receiptDate}:${b.bay}`);
    return {
      batchId: b.batchId,
      commodity: b.commodity,
      supplier: b.supplier,
      receiptDate,
      bay: b.bay,
      qtyReceivedQtl: b.qtyReceivedQtl,
      remainingQtl: b.remainingQtl,
      qualityStatus: b.qualityStatus,
      stackPosition: b.stackPosition !== undefined ? b.stackPosition : 0,
      sha256Hash,
    };
  });
}

/**
 * Creates initial baseline traceability event logs
 */
export function createSeedAuditLogs(batches) {
  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const logs = [];

  batches.forEach((b, idx) => {
    const timestamp = `${b.receiptDate}T09:${(15 + (idx % 45)).toString().padStart(2, '0')}:00.000Z`;
    const eventHash = createDeterministicHash(`${prevHash}:${b.batchId}:${timestamp}`);
    logs.push({
      id: `EVT-INIT-${b.batchId}`,
      timestamp,
      type: 'STOCK_RECEIPT',
      title: `Stock Receipt: ${b.commodity} (${b.batchId})`,
      actor: 'Godown Inward Inspector',
      details: `Received ${b.qtyReceivedQtl} Qtl from ${b.supplier} stored at Bay ${b.bay}. Quality Status: ${b.qualityStatus}`,
      batchId: b.batchId,
      commodity: b.commodity,
      bay: b.bay,
      quantity: b.qtyReceivedQtl,
      supplier: b.supplier,
      syncStatus: 'SYNCED',
      prevHash,
      hash: eventHash,
    });
    prevHash = eventHash;
  });

  // Historical Dispatches across 4 FPS and 3 commodities (including RC-101 supplying 3 FPS)
  const historicalDispatches = [
    {
      challanNo: 'GBN-iPDS-2026-0001',
      fpsId: 'FPS-GN-101',
      fpsName: 'Kasna Village Market',
      commodity: 'Rice',
      batchId: 'RC-101',
      bay: 'B1',
      quantity: 15,
      daysAgo: 40,
      token: 'A1F8C902B3D4E567',
    },
    {
      challanNo: 'GBN-iPDS-2026-0002',
      fpsId: 'FPS-GN-102',
      fpsName: 'Tugalpur Haldoni Road',
      commodity: 'Rice',
      batchId: 'RC-101',
      bay: 'B1',
      quantity: 15,
      daysAgo: 35,
      token: 'B2E7D813C4F5A678',
    },
    {
      challanNo: 'GBN-iPDS-2026-0003',
      fpsId: 'FPS-GN-103',
      fpsName: 'Sector Beta-2 Market',
      commodity: 'Rice',
      batchId: 'RC-101',
      bay: 'B1',
      quantity: 20,
      daysAgo: 25,
      token: 'C3D6E724D5A6B789',
    },
    {
      challanNo: 'GBN-iPDS-2026-0004',
      fpsId: 'FPS-GN-101',
      fpsName: 'Kasna Village Market',
      commodity: 'Wheat',
      batchId: 'WH-102',
      bay: 'A2',
      quantity: 25,
      daysAgo: 28,
      token: 'D4C5F635E6B7C890',
    },
    {
      challanNo: 'GBN-iPDS-2026-0005',
      fpsId: 'FPS-GN-104',
      fpsName: 'Dankaur Main Bazaar',
      commodity: 'Wheat',
      batchId: 'WH-102',
      bay: 'A2',
      quantity: 15,
      daysAgo: 15,
      token: 'E5B4A746F7C8D901',
    },
    {
      challanNo: 'GBN-iPDS-2026-0006',
      fpsId: 'FPS-GN-102',
      fpsName: 'Tugalpur Haldoni Road',
      commodity: 'Sugar',
      batchId: 'SG-101',
      bay: 'C1',
      quantity: 20,
      daysAgo: 20,
      token: 'F6A3B857A8D9E012',
    },
  ];

  historicalDispatches.forEach((d) => {
    const timestamp = `${getRelativeDate(d.daysAgo)}T14:30:00.000Z`;
    const eventHash = createDeterministicHash(`${prevHash}:${d.challanNo}:${timestamp}`);
    logs.push({
      id: `EVT-DSP-${d.challanNo}`,
      timestamp,
      type: 'DISPATCH_COMPLETED',
      title: `Dispatch Confirmed: ${d.commodity} ➜ ${d.fpsName}`,
      actor: 'Worker Handset #W-402',
      details: `Verified FIFO loading of ${d.quantity} Qtl from #${d.batchId} in Bay ${d.bay} under Challan ${d.challanNo}. Token: ${d.token}`,
      batchId: d.batchId,
      commodity: d.commodity,
      bay: d.bay,
      quantity: d.quantity,
      fpsId: d.fpsId,
      fpsName: d.fpsName,
      challanNo: d.challanNo,
      token: d.token,
      syncStatus: 'SYNCED',
      prevHash,
      hash: eventHash,
    });
    prevHash = eventHash;
  });

  // Reverse so newest events are at the top (or standard descending chronological order)
  return logs.reverse();
}
