import QRCode from 'qrcode';
import { round2 } from '../types/models';

/**
 * Formats a sequential counter into GBN-iPDS-YYYY-NNNN
 */
export function formatChallanNo(counter) {
  const year = new Date().getFullYear();
  const seq = (Number(counter) || 1).toString().padStart(4, '0');
  return `GBN-iPDS-${year}-${seq}`;
}

/**
 * Computes canonical SHA-256 hash over challan contents and previous challan hash
 */
export async function computeChallanHash(challanData, prevHash = '0000000000000000000000000000000000000000000000000000000000000000') {
  const canonical = {
    challanNo: challanData.challanNo,
    fpsId: challanData.fps?.id || challanData.fps,
    commodity: challanData.commodity,
    requestedQty: round2(challanData.requestedQty),
    lines: (challanData.allocations || []).map(a => ({
      batchId: a.batchId,
      bay: a.bay,
      take: round2(a.take),
    })),
    issuedAt: challanData.issuedAt || challanData.stagedAt,
    prevHash,
  };

  const jsonStr = JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates data URL QR code (SVG or PNG) for the challan payload
 */
export async function generateQrDataUrl(payloadObject) {
  try {
    const text = typeof payloadObject === 'string' ? payloadObject : JSON.stringify(payloadObject);
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#0B2A5B',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return '';
  }
}

/**
 * Verifies a Challan payload hash against recomputed hash
 */
export async function verifyChallanIntegrity(challan, prevHash) {
  if (!challan) return { isValid: false, reason: 'No challan data' };
  
  const recomputed = await computeChallanHash(challan, prevHash);
  const isValid = recomputed.toLowerCase() === (challan.hash || '').toLowerCase();
  
  return {
    isValid,
    computedHash: recomputed,
    expectedHash: challan.hash,
  };
}
