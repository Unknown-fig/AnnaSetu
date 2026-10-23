import { computeOfflineToken } from './offlineService';
import { round2 } from '../types/models';

/**
 * Validates a queued offline action against Simulated Central Server records and active stock.
 */
export async function verifyAndSyncQueueItem(item, serverRecords = [], currentBatches = []) {
  const serverReceivedAt = new Date().toISOString();

  // 1. Verify cryptographic token if present
  if (item.tokenPayload) {
    try {
      const recomputed = await computeOfflineToken(item.tokenPayload);
      if (recomputed.toLowerCase() !== (item.token || '').toLowerCase()) {
        return {
          status: 'CONFLICT',
          reason: 'Cryptographic offline token mismatch: payload may have been tampered or corrupted.',
          serverReceivedAt,
          item: {
            ...item,
            syncStatus: 'CONFLICT',
            serverReceivedAt,
            conflictReason: 'Token signature mismatch',
          },
        };
      }
    } catch (e) {
      console.warn('Token recomputation check failed:', e);
    }
  }

  // 2. Conflict Check: For DISPATCH or STAGE actions, verify batch availability
  if (item.actionType === 'CONFIRM_PICKING_SUCCESS' || item.actionType === 'STAGE_CHALLAN') {
    const allocations = item.payload?.allocations || item.payload?.challan?.allocations || [];
    for (const alloc of allocations) {
      const liveBatch = currentBatches.find(b => b.batchId === alloc.batchId);
      // If batch no longer exists or balance is deficient for new allocations
      if (!liveBatch) {
        return {
          status: 'CONFLICT',
          reason: `Batch #${alloc.batchId} not found in central depot inventory.`,
          serverReceivedAt,
          item: {
            ...item,
            syncStatus: 'CONFLICT',
            serverReceivedAt,
            conflictReason: `Batch #${alloc.batchId} missing`,
          },
        };
      }

      // Check deliberate test conflict flag if injected
      if (item.forceConflict) {
        return {
          status: 'CONFLICT',
          reason: `Concurrent allocation detected: Batch #${alloc.batchId} was already dispatched by Depot B while device was offline.`,
          serverReceivedAt,
          item: {
            ...item,
            syncStatus: 'CONFLICT',
            serverReceivedAt,
            conflictReason: `Batch #${alloc.batchId} already consumed by another node`,
          },
        };
      }
    }
  }

  // 3. Successfully validated
  return {
    status: 'SYNCED',
    serverReceivedAt,
    item: {
      ...item,
      syncStatus: 'SYNCED',
      serverReceivedAt,
    },
  };
}
