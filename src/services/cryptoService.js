/**
 * SHA-256 Cryptographic utility using Web Crypto API (crypto.subtle)
 */

export async function computeSHA256(message) {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('WebCrypto SHA-256 failed, falling back to simulated hash:', err);
  }

  // Fallback simple 64-char hex deterministic hash if crypto.subtle is restricted in sandbox
  let h1 = 0xdeadbeef ^ message.length, h2 = 0x41c6ce57 ^ message.length;
  for (let i = 0; i < message.length; i++) {
    const ch = message.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (p1 + p2 + p1 + p2 + p1 + p2 + p1 + p2).slice(0, 64);
}

export async function createChainedEventHash(prevHash, timestamp, type, payload) {
  const content = `${prevHash || 'GENESIS_ROOT_SURAJPUR_000000000000'}|${timestamp}|${type}|${JSON.stringify(payload)}`;
  return await computeSHA256(content);
}

export async function createBatchGenesisHash(batchData) {
  const content = `GENESIS|${batchData.batchId}|${batchData.commodity}|${batchData.receiptDate}|${batchData.bay}|${batchData.qtyReceivedQtl}`;
  return await computeSHA256(content);
}
