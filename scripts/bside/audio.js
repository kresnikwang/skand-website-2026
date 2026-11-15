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
  let noiseBuf = null;
  let kneadIdx = 0;

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

  function getNoiseBuffer(ac) {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(ac.sampleRate * 0.25);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBuf = buf;
    return buf;
  }

  function squelchPuff(ac, t0, { startFreq = 950, endFreq = 320, q = 3.2, duration = 0.06, volume = 0.03 } = {}) {
    const src = ac.createBufferSource();
    src.buffer = getNoiseBuffer(ac);
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(q, t0);
    filter.frequency.setValueAtTime(startFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, endFreq), t0 + duration);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.01);
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

  function playSquishBoing(energy = 0.5, delay = 0) {
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + delay;
      const clampedE = Math.min(1.5, Math.max(0.25, energy));
      const baseF = 145 + clampedE * 88;
      const dur = 0.36 + clampedE * 0.08;

      // Cartoon rubber spring with real damped LFO pitch wobble ("bwoooing-oing-oing~").
      const osc = ac.createOscillator();
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      const filt = ac.createBiquadFilter();
      const gain = ac.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseF * 0.85, t0);
      osc.frequency.exponentialRampToValueAtTime(baseF * 2.15, t0 + 0.065);
      osc.frequency.exponentialRampToValueAtTime(baseF * 1.48, t0 + dur);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(16.5, t0);
      lfoGain.gain.setValueAtTime(52 * clampedE, t0);
      lfoGain.gain.exponentialRampToValueAtTime(3.0, t0 + dur);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      filt.type = 'lowpass';
      filt.Q.setValueAtTime(3.8, t0);
      filt.frequency.setValueAtTime(1450, t0);
      filt.frequency.exponentialRampToValueAtTime(480, t0 + dur);

      gain.gain.setValueAtTime(0.075, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + dur + 0.02);
      lfo.stop(t0 + dur + 0.02);
    } catch (e) {}
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

    /* ---- Squish mode (quirky wet-silicone squelches, bubbles & cartoon LFO boings) ---- */
    onSquishPress() {
      const ac = ensure();
      if (!ac) return;
      try {
        const t0 = ac.currentTime;
        // 1. Heavy silicone meat thud.
        const sub = ac.createOscillator();
        const subG = ac.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(235, t0);
        sub.frequency.exponentialRampToValueAtTime(58, t0 + 0.14);
        subG.gain.setValueAtTime(0.09, t0);
        subG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
        sub.connect(subG);
        subG.connect(ac.destination);
        sub.start(t0);
        sub.stop(t0 + 0.17);

        // 2. Quirky gummy suction "puchii~" formant blip.
        const blip = ac.createOscillator();
        const filt = ac.createBiquadFilter();
        const blipG = ac.createGain();
        blip.type = 'triangle';
        blip.frequency.setValueAtTime(190, t0);
        blip.frequency.exponentialRampToValueAtTime(510, t0 + 0.045);
        blip.frequency.exponentialRampToValueAtTime(295, t0 + 0.11);
        filt.type = 'bandpass';
        filt.Q.setValueAtTime(4.8, t0);
        filt.frequency.setValueAtTime(340, t0);
        filt.frequency.exponentialRampToValueAtTime(780, t0 + 0.055);
        filt.frequency.exponentialRampToValueAtTime(420, t0 + 0.12);
        blipG.gain.setValueAtTime(0.065, t0);
        blipG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
        blip.connect(filt);
        filt.connect(blipG);
        blipG.connect(ac.destination);
        blip.start(t0);
        blip.stop(t0 + 0.14);

        // 3. Soft suction air-pocket puff.
        squelchPuff(ac, t0, { startFreq: 1100, endFreq: 340, q: 3.4, duration: 0.055, volume: 0.028 });
      } catch (e) {}
    },
    onSquishKnead(speed = 0.5) {
      const ac = ensure();
      if (!ac) return;
      try {
        const t0 = ac.currentTime;
        const ratios = [1, 1.12, 1.26, 0.94, 1.42, 1.18];
        const ratio = ratios[kneadIdx++ % ratios.length];
        const base = (155 + Math.min(1.6, speed) * 145) * ratio;

        // Rubbery "gu-ji" squeeze squeak.
        const osc = ac.createOscillator();
        const filt = ac.createBiquadFilter();
        const gain = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(base, t0);
        osc.frequency.exponentialRampToValueAtTime(base * 1.48, t0 + 0.035);
        osc.frequency.exponentialRampToValueAtTime(base * 0.92, t0 + 0.085);
        filt.type = 'bandpass';
        filt.Q.setValueAtTime(4.5, t0);
        filt.frequency.setValueAtTime(base * 2.1, t0);
        filt.frequency.exponentialRampToValueAtTime(base * 3.1, t0 + 0.05);
        gain.gain.setValueAtTime(0.022, t0);
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.09);
        osc.connect(filt);
        filt.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + 0.1);

        // Occasional tiny trapped micro-bubble "bloop!" while kneading rapidly.
        if (speed > 0.55 && kneadIdx % 3 === 0) {
          const bub = ac.createOscillator();
          const bubG = ac.createGain();
          bub.type = 'sine';
          const bf = 420 + (kneadIdx % 5) * 65;
          bub.frequency.setValueAtTime(bf, t0 + 0.015);
          bub.frequency.exponentialRampToValueAtTime(bf * 1.95, t0 + 0.055);
          bubG.gain.setValueAtTime(0.026, t0 + 0.015);
          bubG.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.065);
          bub.connect(bubG);
          bubG.connect(ac.destination);
          bub.start(t0 + 0.015);
          bub.stop(t0 + 0.075);
        }
      } catch (e) {}
    },
    onSquishPhase(phaseName) {
      const ac = ensure();
      if (!ac) return;
      try {
        const t0 = ac.currentTime;
        const f0 = phaseName === 'boing' ? 480 : 320;
        const f1 = phaseName === 'boing' ? 760 : 510;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(f1, t0 + 0.065);
        gain.gain.setValueAtTime(0.032, t0);
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.08);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + 0.09);
      } catch (e) {}
    },
    onSquishRelease(energy = 0.5) {
      playSquishBoing(energy, 0);
    },
    onSquishPop() {
      const ac = ensure();
      if (!ac) return;
      try {
        const t0 = ac.currentTime;
        // 1. Fat pancake smash + wet splat squelch.
        tone(145, { duration: 0.28, type: 'sine', volume: 0.10 });
        squelchPuff(ac, t0, { startFreq: 1600, endFreq: 260, q: 2.4, duration: 0.12, volume: 0.055 });

        // 2. Cartoon upward launch "SCHWOOOP~!" as it slips out and shoots up.
        const zip = ac.createOscillator();
        const zipG = ac.createGain();
        zip.type = 'sine';
        zip.frequency.setValueAtTime(210, t0 + 0.02);
        zip.frequency.exponentialRampToValueAtTime(920, t0 + 0.24);
        zipG.gain.setValueAtTime(0.055, t0 + 0.02);
        zipG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.27);
        zip.connect(zipG);
        zipG.connect(ac.destination);
        zip.start(t0 + 0.02);
        zip.stop(t0 + 0.28);

        // 3. Rapid bubbly pop-pop-pop cascade + elastic boing tail!
        [310, 465, 620, 890].forEach((f, i) => {
          const d = 0.025 + i * 0.032;
          const b = ac.createOscillator();
          const bg = ac.createGain();
          b.type = 'sine';
          b.frequency.setValueAtTime(f, t0 + d);
          b.frequency.exponentialRampToValueAtTime(f * 1.75, t0 + d + 0.05);
          bg.gain.setValueAtTime(0.045 - i * 0.006, t0 + d);
          bg.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.075);
          b.connect(bg);
          bg.connect(ac.destination);
          b.start(t0 + d);
          b.stop(t0 + d + 0.085);
        });
      } catch (e) {}
      playSquishBoing(1.35, 0.095);
    },
    onSquishLand() {
      const ac = ensure();
      if (!ac) return;
      try {
        const t0 = ac.currentTime;
        // Soft pillow "plop~" when drifting gently back to rest.
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(165, t0);
        osc.frequency.exponentialRampToValueAtTime(86, t0 + 0.11);
        gain.gain.setValueAtTime(0.048, t0);
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.13);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + 0.14);
      } catch (e) {}
    },
    toggle() {
      this.setEnabled(!enabled);
      if (enabled) tone(330, { duration: 0.1 });
      return enabled;
    },
  };
}
