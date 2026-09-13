// Web Audio API Synthesizer - 100% Offline, Zero Bandwidth, No Audio Files Needed
let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play high-priority tactical chime (Two-tone: 880Hz -> 660Hz)
 * Perfect for incident dispatches and incoming emergency warnings.
 */
export function playTacticalChime(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // Tone 1: A5 (880Hz)
    osc.frequency.setValueAtTime(659.25, now + 0.16); // Tone 2: E5 (659Hz)

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(volume * 0.8, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (err) {
    console.warn('[AUDIO] Failed to play tactical chime:', err);
  }
}

/**
 * Play modulated evacuation / dam alert siren (440Hz <-> 880Hz sweep)
 */
export function playEvacuationSiren(durationSeconds = 1.8, volume = 0.25) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    
    // Sweep frequency up and down
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.45);
    osc.frequency.linearRampToValueAtTime(520, now + 0.9);
    osc.frequency.linearRampToValueAtTime(880, now + 1.35);
    osc.frequency.linearRampToValueAtTime(440, now + durationSeconds);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.setValueAtTime(volume, now + durationSeconds - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSeconds);
  } catch (err) {
    console.warn('[AUDIO] Failed to play evacuation siren:', err);
  }
}
