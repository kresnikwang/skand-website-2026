/**
 * SKAND B-Side — phase state machine.
 *
 * The single source of truth for the experience. It owns `charge` (0→1) and
 * derives from it: the shader uniforms (morph / chaos / impulse / ignite), the
 * current phase label, and whether the mark has been revealed. The HUD reads
 * its bar straight off this, so the UI can never disagree with the scene.
 *
 * The four beats, and what the user is actually doing in each:
 *   chaos    — a drifting particle cloud; the pointer carves a wake through it
 *   attract  — dragging pulls particles inward and starts charging
 *   converge — charge is high, particles stream into frame-then-letters
 *   ignite   — charge hits 1, a bloom burst fires, the mark locks in
 *
 * Charge is earned by *dragging* (pointer down + motion), not by idling, so the
 * reveal is something the visitor assembles. A small passive trickle keeps it
 * from feeling like a chore, and idle decay means letting go drops the bar.
 */

import { PHASE_STOPS, PHASE_ORDER } from './config.js';

const CHARGE_PER_SEC_DRAG = 0.62;   // full charge in ~1.6s of active dragging
const CHARGE_PER_SEC_PASSIVE = 0.05; // gentle trickle from moving the pointer
const IDLE_DECAY = 0.10;            // charge bleeds away when you stop
const IGNITE_HOLD = 0.06;           // charge must exceed 1 by this to fire
const IMPULSE_DECAY = 2.6;          // how fast the ignition burst dies down
const IGNITE_FADE = 0.55;           // how fast the ignite heat fades after burst

export function createPhases({ onPhaseChange, onIgnite } = {}) {
  let charge = 0;
  let phase = 'chaos';
  let ignited = false;
  // Ignition transient, driven by the frame loop.
  let impulse = 0;
  let igniteHeat = 0;

  function phaseFor(c) {
    if (c >= PHASE_STOPS.ignite) return 'ignite';
    if (c >= PHASE_STOPS.converge) return 'converge';
    if (c >= PHASE_STOPS.attract) return 'attract';
    return 'chaos';
  }

  function setCharge(next) {
    charge = Math.max(0, Math.min(1.2, next));
    const p = phaseFor(charge);
    if (p !== phase) {
      phase = p;
      onPhaseChange?.(phase, charge);
    }
  }

  return {
    get charge() { return charge; },
    get phase() { return phase; },
    get ignited() { return ignited; },

    /**
     * Advance one frame.
     * @param dt      seconds
     * @param dragging bool  — pointer is down
     * @param speed   number — normalized pointer speed 0..1
     */
    update(dt, dragging, speed) {
      if (ignited) {
        // Post-reveal: let the burst decay, keep the mark locked.
        impulse *= Math.max(0, 1 - IMPULSE_DECAY * dt);
        igniteHeat = Math.max(0, igniteHeat - IGNITE_FADE * dt);
        if (impulse < 0.01) impulse = 0;
        return;
      }

      if (dragging) {
        // Reward movement, not just holding still.
        const gain = CHARGE_PER_SEC_DRAG * (0.25 + speed * 0.75) * dt;
        setCharge(charge + gain);
      } else if (speed > 0.02) {
        setCharge(charge + CHARGE_PER_SEC_PASSIVE * speed * dt);
      } else {
        setCharge(charge - IDLE_DECAY * dt);
      }

      if (charge >= 1 + IGNITE_HOLD) {
        ignited = true;
        setCharge(1);
        impulse = 1.0;
        igniteHeat = 1.0;
        onIgnite?.();
      }
    },

    /** Uniform bundle for the particle system. */
    uniforms(pointer, pointerDown) {
      // morph: charge maps to assemble progress, but only after attract starts,
      // so the first moments are pure chaos. Held at 1 once revealed.
      const base = ignited ? 1 : charge;
      const morph = ignited ? 1 : Math.max(0, (base - 0.08) / 0.92);
      // chaos fades as morph rises; keep a whisper of it until the very end.
      const chaos = ignited ? 0 : Math.max(0, 1 - morph * 1.15) * (1 - morph * 0.4);
      // Pointer pulls while dragging (builds the mark), pushes otherwise.
      const pointerForce = ignited ? 0 : (pointerDown ? 5.5 : -1.6);
      return {
        morph,
        chaos,
        impulse,
        ignite: igniteHeat,
        pointerForce,
        pointer,
      };
    },

    /** Restart from chaos. */
    reset() {
      charge = 0;
      phase = 'chaos';
      ignited = false;
      impulse = 0;
      igniteHeat = 0;
      onPhaseChange?.(phase, charge);
    },
  };
}

export { PHASE_ORDER };
