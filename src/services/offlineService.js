import { round2 } from '../types/models';

const DEVICE_ID_KEY = 'annasetu_device_id';

/**
 * Returns a persistent hardware device ID for the warehouse terminal.
 */
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'DEV-UP-GBN-04-LOCAL';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      id = `DEV-UP-GBN-04-${rand}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'DEV-UP-GBN-04-FALLBACK';
  }
}

/**
 * Computes canonical SHA-256 offline token:
 * token = SHA-256(canonical JSON of {challanNo, fps, commodity, qty, lines, issuedAt, deviceId, localSeq, prevTokenHash})
 */
export async function computeOfflineToken({
  challanNo,
  fps,
  commodity,
  requestedQty,
  allocations = [],
  issuedAt,
  deviceId,
  localSeq,
  prevTokenHash = '0000000000000000000000000000000000000000000000000000000000000000',
}) {
  const canonical = {
    challanNo,
    fpsId: typeof fps === 'string' ? fps : (fps?.id || fps?.name || 'FPS-UNKNOWN'),
    commodity,
    qty: round2(requestedQty),
    lines: (allocations || []).map(a => ({
      batchId: a.batchId,
      bay: a.bay,
      take: round2(a.take),
    })),
    issuedAt: issuedAt || new Date().toISOString(),
    deviceId: deviceId || getOrCreateDeviceId(),
    localSeq: Number(localSeq) || 1,
    prevTokenHash: prevTokenHash || '0000000000000000000000000000000000000000000000000000000000000000',
  };

  const jsonStr = JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns formatted 16-character token prefix for print, handset, and cards.
 */
export function formatTokenPrefix(token) {
  if (!token) return 'OFFL-PENDING-TOK';
  return token.substring(0, 16).toUpperCase();
}
