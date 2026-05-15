// ============================================================================
// SOUND FX — Web Audio API generated tones (no audio files needed)
// ----------------------------------------------------------------------------
// Each tier has a distinctive tonal signature:
//   jackpot:   Triumphant arpeggio C5-E5-G5-C6 + sparkle
//   jackpot2:  Arpeggio E5-G5-B5 + double-hit
//   first:     Two ascending tones
//   second:    Single bright bell
//   third:     Short happy beep
// ============================================================================

let _ctx = null;
function getCtx() {
    if (typeof window === 'undefined') return null;
    if (!_ctx) {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) _ctx = new AC();
        } catch {}
    }
    return _ctx;
}

/**
 * Play a single tone.
 *   freq: Hz
 *   duration: seconds
 *   delay: seconds from now
 *   type: 'sine' | 'square' | 'triangle' | 'sawtooth'
 *   volume: 0..1
 */
function tone(freq, duration, delay = 0, type = 'sine', volume = 0.5) {
    const ctx = getCtx();
    if (!ctx) return;
    const startTime = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // ADSR-ish envelope: quick attack, smooth decay
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
}

/**
 * Resume AudioContext if it's suspended (browsers require user-gesture).
 * Call this from a click handler before playing if not already started.
 */
export async function unlockAudio() {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
    }
}

/**
 * Play prize sound based on tier id.
 */
export function playPrizeSound(tierId, volume = 0.5) {
    if (!getCtx()) return;
    const v = Math.max(0, Math.min(1, volume));

    switch (tierId) {
        case 'jackpot': {
            // Triumphant rising arpeggio + sparkle on top
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
            notes.forEach((f, i) => tone(f, 0.35, i * 0.12, 'triangle', v));
            // Sparkle high frequency at the end
            tone(2093, 0.4, 0.55, 'sine', v * 0.6);
            tone(2637, 0.5, 0.65, 'sine', v * 0.5);
            break;
        }
        case 'jackpot2': {
            // E5 G5 B5 arpeggio + double-hit ending
            const notes = [659.25, 783.99, 987.77];
            notes.forEach((f, i) => tone(f, 0.32, i * 0.1, 'triangle', v));
            tone(1318.5, 0.35, 0.45, 'sine', v * 0.7);
            tone(1318.5, 0.35, 0.55, 'sine', v * 0.7);
            break;
        }
        case 'first': {
            // Two-tone rising
            tone(523.25, 0.25, 0,   'triangle', v);
            tone(659.25, 0.35, 0.2, 'triangle', v);
            break;
        }
        case 'second': {
            tone(659.25, 0.4, 0, 'sine', v);
            break;
        }
        case 'third': {
            tone(523.25, 0.18, 0, 'sine', v * 0.8);
            break;
        }
        default:
            break;
    }
}

/**
 * Lightweight UI click feedback.
 */
export function playClick(volume = 0.3) {
    tone(1200, 0.06, 0, 'sine', volume);
}
