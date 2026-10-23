/**
 * Cross-Tab Broadcast Synchronization Channel
 * Broadcasts lightweight invalidation notices ({type: "INVALIDATE", version, reason})
 * across browser tabs so all portals update within <300ms without waiting for polling.
 * Zero data payload: state is always pulled directly from the single source of truth (FastAPI backend).
 */

const CHANNEL_NAME = 'annasetu-sync';

let channel = null;

function getChannel() {
  if (typeof window === 'undefined') return null;
  if (!channel && 'BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (err) {
      console.warn('BroadcastChannel not supported or failed to initialize:', err);
    }
  }
  return channel;
}

export function broadcastInvalidation(version = null, reason = 'mutation') {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage({
        type: 'INVALIDATE',
        version,
        reason,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn('Failed to broadcast invalidation:', err);
    }
  }
}

export function subscribeToSync(callback) {
  const ch = getChannel();
  if (!ch) return () => {};

  const handler = (event) => {
    if (event.data && event.data.type === 'INVALIDATE') {
      callback(event.data);
    }
  };

  ch.addEventListener('message', handler);

  return () => {
    ch.removeEventListener('message', handler);
  };
}
