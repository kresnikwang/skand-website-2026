/**
 * SKAND B-Side — audio.
 *
 * The same tiny Web Audio synth the previous Pixi version used (oscillator +
 * exponential gain ramp, no samples, no library), kept deliberately minimal so
 * the page ships no audio payload. One tone per phase change, a rising arpeggio
 * when the mark is revealed, and a soft tick when a drag contributes charge.
 */

import { PHASE_NOTES } from './config.js';

export function createAudio() {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, { duration = 0.14, type = 'sine', volume = 0.05, delay = 0 } = {}) {
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) { /* audio is decorative; never let it break the page */ }
  }

  return {
    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = v;
      if (!v && ctx) ctx.suspend();
      if (v) ensure();
    },
    unlock: ensure,
    onPhase(phase) {
      const f = PHASE_NOTES[phase];
      if (!f) return;
      tone(f, { duration: 0.16, type: 'triangle', volume: 0.045 });
    },
    onIgnite() {
      // Rising major arpeggio — the payoff.
      [0, 0.09, 0.18, 0.30].forEach((d, i) => {
        tone(PHASE_NOTES.ignite * [1, 1.25, 1.5, 2][i], {
          duration: 0.3,
          type: i === 3 ? 'sine' : 'triangle',
          volume: 0.05 - i * 0.006,
          delay: d,
        });
      });
      // A soft sub for weight.
      tone(PHASE_NOTES.chaos, { duration: 0.5, type: 'sine', volume: 0.05, delay: 0 });
    },
    onStart() {
      tone(PHASE_NOTES.attract, { duration: 0.2, type: 'triangle', volume: 0.04 });
    },
    onReset() {
      tone(PHASE_NOTES.chaos, { duration: 0.18, type: 'sine', volume: 0.04 });
    },

    /* ---- Squeeze mode ---- */

    /**
     * Squeeze mode pressure, 0..1. Rather than a held drone (which fights the
     * reveal tone and gets tedious within seconds) this fires a short tick that
     * climbs in pitch as the mark compresses, so the pressure is audible as a
     * rising line the player is authoring themselves. Silent below 0.12 so
     * an idle mark costs nothing.
     */
    onTension(level) {
      if (level < 0.12) return;
      const f = 180 + level * level * 900;
      tone(f, { duration: 0.06, type: 'square', volume: 0.012 + level * 0.018 });
    },

    /** The mark letting go: a downward body plus a bright transient. */
    onPop() {
      tone(320, { duration: 0.5, type: 'sawtooth', volume: 0.06 });
      tone(96, { duration: 0.7, type: 'sine', volume: 0.09 });
      tone(1400, { duration: 0.16, type: 'square', volume: 0.03, delay: 0.01 });
    },
    toggle() {
      this.setEnabled(!enabled);
      if (enabled) tone(330, { duration: 0.1 });
      return enabled;
    },
  };
}
