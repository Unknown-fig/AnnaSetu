/**
 * Web Audio API Sound Synthesizer
 * Uses AudioContext and OscillatorNode without external audio files.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Short warning alert beep (used on FIFO manual violation trigger)
 */
export function playWarningBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    // Second pulse for urgent double beep
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(750, ctx.currentTime);
        gain2.gain.setValueAtTime(0.25, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.22);
      } catch (e) {
        // ignore
      }
    }, 180);
  } catch (err) {
    console.warn('AudioContext playback warning:', err);
  }
}

/**
 * Loud warehouse emergency siren (used on Wrong Newer Batch QR scan)
 * Plays alternating high-low alarm pulses for ~2 seconds
 */
export function playEmergencySiren() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const duration = 1.8;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    
    // Siren alternating modulation
    const now = ctx.currentTime;
    for (let t = 0; t < duration; t += 0.2) {
      const isHigh = Math.floor(t / 0.2) % 2 === 0;
      osc.frequency.setValueAtTime(isHigh ? 920 : 540, now + t);
    }

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.35, now + duration - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {
    console.warn('Emergency siren playback failed:', err);
  }
}

/**
 * Verified FIFO Success Chime (pleasant rising major chord)
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  } catch (err) {
    console.warn('Success chime playback failed:', err);
  }
}

/**
 * Soft subtle notification chime for incoming events (e.g. new indents)
 */
export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch (err) {
    console.warn('Notification chime playback failed:', err);
  }
}
