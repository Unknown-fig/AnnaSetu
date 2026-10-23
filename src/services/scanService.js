import { calculateAgeDays, round2 } from '../types/models';

/**
 * Shared scan validation engine for both Loading Gate Scanner and Worker Handset
 */
export function validateBatchScan({
  qrPayload,
  activeChallan,
  batches = [],
  currentStepIndex = 0,
  completedScans = [],
}) {
  if (!activeChallan) {
    return {
      status: 'NO_ACTIVE_CHALLAN',
      isValid: false,
      message: 'No active staged challan. Stage a delivery challan before scanning loading gate.',
    };
  }

  // 1. Parse payload if string
  let parsed = qrPayload;
  if (typeof qrPayload === 'string') {
    try {
      parsed = JSON.parse(qrPayload.trim());
    } catch (e) {
      // If it's a simple batch string e.g. "WH-102"
      const matched = batches.find(b => b.batchId === qrPayload.trim());
      if (matched) {
        parsed = {
          t: 'BATCH',
          batchId: matched.batchId,
          bay: matched.bay,
          commodity: matched.commodity,
          hashPrefix: (matched.sha256Hash || '').substring(0, 10),
        };
      } else {
        return {
          status: 'INVALID',
          isValid: false,
          message: 'INVALID / TAMPERED: QR payload is not a valid JSON structure or recognized token.',
        };
      }
    }
  }

  // Check structure: must have batchId and optionally type 'BATCH'
  const scannedBatchId = parsed.batchId || parsed.bId;
  if (!scannedBatchId) {
    return {
      status: 'INVALID',
      isValid: false,
      message: 'INVALID / TAMPERED: Unrecognized QR format. Missing batch identification.',
    };
  }

  // Verify batch exists in depot store
  const storedBatch = batches.find(b => b.batchId === scannedBatchId);
  if (!storedBatch) {
    return {
      status: 'INVALID',
      isValid: false,
      message: `INVALID / TAMPERED: Batch #${scannedBatchId} does not exist in depot registry.`,
    };
  }

  // Hash prefix verification if provided
  if (parsed.hashPrefix) {
    const expectedPrefix = (storedBatch.sha256Hash || '').substring(0, 10);
    if (expectedPrefix && parsed.hashPrefix !== expectedPrefix) {
      return {
        status: 'INVALID',
        isValid: false,
        message: `INVALID / TAMPERED: Cryptographic hash prefix mismatch for Batch #${scannedBatchId}. Security alert triggered.`,
      };
    }
  }

  const allocations = activeChallan.allocations || [];
  if (allocations.length === 0) {
    return {
      status: 'NO_ACTIVE_CHALLAN',
      isValid: false,
      message: 'Active challan has no allocated batch lines.',
    };
  }

  const expectedAlloc = allocations[currentStepIndex];

  // 2. Check for Duplicate Scan (already scanned in prior steps)
  if (completedScans.includes(scannedBatchId)) {
    return {
      status: 'DUPLICATE',
      isValid: false,
      batchId: scannedBatchId,
      message: `Duplicate scan: Batch #${scannedBatchId} has already been verified and loaded.`,
    };
  }

  // 3. Check if Scanned Batch matches Current Expected Step
  if (expectedAlloc && scannedBatchId === expectedAlloc.batchId) {
    const isLastStep = currentStepIndex + 1 >= allocations.length;
    return {
      status: 'VERIFIED',
      isValid: true,
      batchId: scannedBatchId,
      bay: expectedAlloc.bay,
      takeQty: expectedAlloc.take,
      currentStep: currentStepIndex + 1,
      totalSteps: allocations.length,
      isComplete: isLastStep,
      message: `VERIFIED - load ${expectedAlloc.take} Qtl of ${storedBatch.commodity} from Bay ${expectedAlloc.bay} (${currentStepIndex + 1}/${allocations.length})`,
    };
  }

  // 4. Valid Batch but WRONG LINE (Newer or different batch scanned out of sequence)
  const scannedAge = calculateAgeDays(storedBatch.receiptDate);
  const expectedAge = expectedAlloc ? calculateAgeDays(expectedAlloc.receiptDate) : 0;
  const ageDelta = Math.abs(expectedAge - scannedAge);

  return {
    status: 'WRONG_LINE',
    isValid: false,
    batchId: scannedBatchId,
    scannedBatch: storedBatch,
    expectedBatchId: expectedAlloc?.batchId,
    expectedBay: expectedAlloc?.bay,
    message: `CRITICAL FIFO MISMATCH: Scanned Batch #${scannedBatchId} (${scannedAge}d in Bay ${storedBatch.bay}) is ${ageDelta} days newer/different than required oldest Batch #${expectedAlloc?.batchId} (${expectedAge}d in Bay ${expectedAlloc?.bay})! Loading blocked.`,
  };
}
