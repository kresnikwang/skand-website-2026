/**
 * SKAND B-Side — "Squeeze" mode: crush the mark with your hand.
 *
 * The second B-Side game, and the inverse of the first. In Gather the visitor
 * assembles the mark; here the mark is already whole and the job is to take it
 * apart. Press anywhere on it and hold: the mark dents inward under the
 * contact point, the displaced material piles up around the rim, and the
 * pressure builds until it lets go all at once.
 *
 * This mode used to be a cord game — a verlet rope the visitor wound around
 * the letters and pulled. The rope was dropped because it read as a plastic
 * tube laid over a particle mark: a foreign object in a language made of
 * points. A hand has no such problem. There is nothing to render for a hand;
 * the mark itself deforms, heats and shakes, and that is the whole effect.
 * So this file is now ~200 lines instead of ~620, and the distance field, the
 * verlet solver and the ribbon geometry are all gone.
 *
 * Three pieces:
 *   • PRESS     — where the hand is. Eases toward the pointer rather than
 *                 snapping, because a hand has mass; the lag is what makes a
 *                 fast drag feel like it is dragging something.
 *   • TENSION   — the single number the HUD reads, and the only thing that can
 *                 trigger the pop. Earned by pressing ON the mark, and earned
 *                 faster the harder you work it.
 *   • POP       — the burst/reform timeline, unchanged in spirit from the
 *                 cord version: out, hold, reform.
 *
 * It drives the SAME particle system as Gather (particles.js) — same mark, same
 * targets, same renderer. Squeeze arrives as `uSqueeze` (the whole mark
 * contracting) plus `uPress` (a local dent plus a rim bulge), and the pop is
 * the same radial `uImpulse` burst the original ignition used. One mark, two
 * games.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { PALETTE } from './config.js?v=20260929b';

/* ------------------------------------------------------------------ */
/* tuning                                                              */
/* ------------------------------------------------------------------ */

/* The contact patch, in units of worldScale. Sized against the mark: the
   letterforms are ~0.35 normalised wide, so a 0.62 radius covers roughly one
   letter stem with a soft margin — big enough to grab, small enough that
   pressing feels like a fingertip rather than a whole-hand grab. */
const PRESS = {
  radius: 0.62,      // contact radius, × worldScale
  follow: 9.0,       // how fast the hand catches up to the pointer, 1/s
  // Pressure builds only while the hand is actually on the mark. Off-mark
  // presses fade in over this fraction of the mark's half-height.
  edgeSoft: 0.34,
};

/* Tension gains, per second.
   holdGain is the floor for simply keeping a hand on the mark; workGain is the
   extra from moving the pointer across it. Sizing: a steady centred press
   alone reaches 1.0 in about 9s, and a player working the mark hard reaches
   it in roughly 3.75s. That spread is deliberate — it rewards engagement
   without making the deliberate, slow version feel like it is broken.

   There is no separate "how central am I" gain here; that is folded into
   `centre` in update(), which scales by both the hand's engagement and its
   position. Two multipliers doing one job made the numbers impossible to
   reason about. */
const TENSION = {
  holdGain: 0.083 * 4 / 3, // 0.1107 — was 0.083; charge window cut by a quarter
  workGain: 0.117 * 4 / 3, // 0.156  — was 0.117
  decay: 0.20,
};

/* Pop timeline, in seconds. out = the burst, hold = the mark hanging apart,
   reform = the mark re-forming itself. */
const POP = { out: 0.5, hold: 0.3, reform: 1.6 };
const POP_LEN = POP.out + POP.hold + POP.reform;

/* HUD thresholds, mirroring the Gather phase steps so both modes read the
   same at a glance. */
export const SQUEEZE_STOPS = { press: 0.34, strain: 0.82 };
export const SQUEEZE_ORDER = ['press', 'strain', 'burst'];
/* ------------------------------------------------------------------ */
/* the contact patch                                                   */
/* ------------------------------------------------------------------ */

/**
 * A soft additive glow that sits under the hand.
 *
 * This exists for one reason: the mark is a field of loose points, and once it
 * is deforming there is no longer any hard surface for the eye to read as
 * "the thing I am holding". A soft radial bloom plus a thin bright contact
 * ring gives the press a location and an edge, which is all the feedback the
 * gesture needs. Deliberately NOT a line or a sprite of a hand — the effect
 * has to belong to the same particle language as the mark.
 *
 * The ring is a separate draw from the glow so it can hold a crisp edge while
 * the glow stays soft; a single sprite cannot do both without the ring
 * dissolving into the bloom.
 */
function createContactPatch(scene) {
  const geo = new THREE.PlaneGeometry(1, 1);

  // Soft core: a wide falloff, additive, no depth interaction.
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.coral) },
      uStrength: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        if (d > 1.0) discard;
        // Two-stop falloff: a tight bright centre inside a narrow halo. The
        // halo term is deliberately weak — anything broader stops reading as
        // a glow around a contact point and starts reading as a coloured
        // wash over the whole mark.
        float core = pow(1.0 - d, 4.0);
        float halo = pow(1.0 - d, 2.2) * 0.18;
        float a = (core + halo) * uStrength;
        gl_FragColor = vec4(uColor * (0.45 + core * 0.7), a);
      }
    `,
  });
  const glow = new THREE.Mesh(geo, glowMat);
  glow.renderOrder = 3;
  glow.frustumCulled = false;
  scene.add(glow);

  // Contact ring: a thin annulus at the edge of the press. Brightens and
  // contracts as pressure rises, so the ring itself is a tension read-out.
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.white) },
      uStrength: { value: 0 },
      uTension: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uTension;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        if (d > 1.0) discard;
        // The rim sits at 0.78 of the quad and tightens toward 0.66 as the mark
        // strains — the hand closing, made visible. Thin on purpose: this is
        // additive and then goes through bloom, so a wide band blows out to a
        // solid white hoop and buries the mark underneath it.
        float r = mix(0.78, 0.66, uTension);
        float w = mix(0.075, 0.04, uTension);
        float band = smoothstep(r - w, r, d) * (1.0 - smoothstep(r, r + w, d));
        float a = band * uStrength;
        gl_FragColor = vec4(uColor * (0.55 + band * 0.5), a);
      }
    `,
  });
  const ring = new THREE.Mesh(geo, ringMat);
  ring.renderOrder = 4;
  ring.frustumCulled = false;
  scene.add(ring);

  const world = new THREE.Vector3();

  /**
   * @param x,y    contact point in world units
   * @param radius contact radius in world units
   * @param press  0..1 how firmly the hand is down
   * @param tension 0..1 current tension
   */
  function sync(x, y, radius, press, tension) {
    /* The glow is a soft bloom AROUND the contact, not a disc over it. At 5.2×
       the radius it was wide enough to tint the whole viewport coral and the
       mark stopped reading as white particles at all; 3.2× keeps it local.

       The ring is scaled so its drawn edge lands ON the dent's rim (the shader
       puts the band at 0.78 of the quad half-width). At 2.0× it came out
       three times the width of the actual deformation and read as a separate
       circular control sitting on top of the logo rather than the boundary of
       a hand pressing it. */
    const s = radius * 3.2;
    glow.position.set(x, y, 0.03);
    glow.scale.set(s, s, 1);
    glowMat.uniforms.uStrength.value = press * 0.30;

    ring.position.set(x, y, 0.04);
    ring.scale.set(radius * 1.28, radius * 1.28, 1);
    ringMat.uniforms.uStrength.value = press * 0.45;
    ringMat.uniforms.uTension.value = tension;

    // Rises white as the mark strains: coral says "hand", white says "hot".
    const hot = new THREE.Color(PALETTE.coral).lerp(new THREE.Color(PALETTE.white), tension * 0.8);
    glowMat.uniforms.uColor.value.copy(hot);
  }

  function setVisible(v) { glow.visible = v; ring.visible = v; }
  function dispose() { geo.dispose(); glowMat.dispose(); ringMat.dispose(); }

  return { sync, setVisible, dispose, world };
}



/* ------------------------------------------------------------------ */
/* the game                                                            */
/* ------------------------------------------------------------------ */

export function createSqueeze({ reduced }) {
  const scene = new THREE.Scene();
  const patch = createContactPatch(scene);

  let worldScale = 2.7;
  let visW = 14;
  let visH = 8;

  let tension = 0;
  let popT = -1;   // seconds since the pop; < 0 means not popping
  let pops = 0;
  let morph = 1;
  let heat = 0;
  let shake = 0;
  let phase = 'press';

  // The hand. `hand` is where it has actually got to (it lags the pointer),
  // `pressAmt` is how firmly it is down, and `grip` is how well-centred it is
  // on the mark — pressing the middle of the frame counts for more than
  // pressing the far edge, which is what makes aim matter.
  const hand = new THREE.Vector2();
  const target = new THREE.Vector2();
  let pressAmt = 0;
  let grip = 0;
  let hasPointer = false;

  /* Half-extents of the mark in normalised logo space, matching the frame box
     the targets are built in. Used to decide whether a press is actually ON
     the mark, and to score how central it is. */
  const MARK = { halfW: 1.0, halfH: 0.4 };

  function resize(w, h) {
    visW = w;
    visH = h;
    // With the cord gone there is nothing swinging out to the left, so the
    // mark can sit larger in frame than it used to. Capped by height on
    // portrait screens so the frame never crops.
    let scale = (visW * 0.52) / 2.0;
    if (MARK.halfH * 2 * scale > visH * 0.52) scale = (visH * 0.52) / (MARK.halfH * 2);
    worldScale = scale;
  }

  function reset() {
    tension = 0;
    popT = -1;
    morph = 1;
    heat = 0;
    shake = 0;
    pressAmt = 0;
    grip = 0;
    hasPointer = false;
    phase = 'press';
  }

  /**
   * How well a normalised point sits on the mark: 0 off the mark entirely,
   * ramping to 1 well inside it. Uses a rounded-box falloff so the corners of
   * the frame are not unfairly harder to grab than the middle of a stem.
   */
  function gripAt(nx, ny) {
    const ax = Math.abs(nx) - MARK.halfW;
    const ay = Math.abs(ny) - MARK.halfH;
    /* Signed distance to the mark's box: NEGATIVE inside, positive outside.
       Standard rounded-box form — outside the two clamped terms give the
       euclidean distance to the nearest edge, inside it gives how deep past
       that edge the point sits. */
    const outside = Math.hypot(Math.max(ax, 0), Math.max(ay, 0));
    const inside = Math.min(Math.max(ax, ay), 0);
    const d = outside + inside;
    /* Offset the band by half of edgeSoft so pressing exactly ON the outline
       already reads as ~0.5. The frame stroke is the most natural thing to aim
       at and it must not feel dead; full grip needs the point genuinely
       inside the letters. Smoothstep rather than a linear ramp, so the edges
       of the grabbable area do not have a visible seam. */
    const t = Math.max(0, Math.min(1, (PRESS.edgeSoft * 0.5 - d) / PRESS.edgeSoft));
    return t * t * (3 - 2 * t);
  }

  /**
   * Advance one frame.
   *
   * @param dt    seconds
   * @param input { pointer: THREE.Vector3, dragging: boolean, speed: 0..1 }
   * @param hooks { onPop, onPhase } — onPop fires on the frame the mark lets go
   */
  function update(dt, input, hooks) {
    let squeeze = 0;
    let pressOut = null;
    const pressRadius = PRESS.radius * worldScale;

    if (popT >= 0) {
      popT += dt;
      if (popT < POP.out) {
        // The burst.
        const e = 1 - Math.pow(1 - popT / POP.out, 3);
        morph = 1 - 0.82 * e;
        heat = e;
        shake = reduced ? 0 : e;
      } else if (popT < POP.out + POP.hold) {
        // Hanging apart.
        morph = 0.18;
        heat = 1 - (popT - POP.out) / POP.hold;
        shake *= 0.9;
      } else if (popT < POP_LEN) {
        // Re-forming. The spring in the shader does the work; the morph ramp
        // just hands the target back to it.
        const t = (popT - POP.out - POP.hold) / POP.reform;
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        morph = 0.18 + 0.82 * e;
        heat = Math.max(0, 1 - t * 1.6);
        shake *= 0.86;
      } else {
        popT = -1;
        morph = 1;
      }
      // Nothing is being held while the mark is coming apart, and the hand
      // lifts off fast so a held pointer does not re-grip mid-burst.
      pressAmt = Math.max(0, pressAmt - dt * 6);
    } else {
      /* --- the hand ------------------------------------------------------ */
      target.set(input.pointer.x, input.pointer.y);
      hasPointer = true;
      // Frame-rate independent ease, so the hand's lag feels the same at 60
      // and at 120.
      hand.lerp(target, 1 - Math.exp(-PRESS.follow * dt));

      const nx = hand.x / worldScale;
      const ny = hand.y / worldScale;
      grip = input.dragging ? gripAt(nx, ny) : 0;

      // Pressing down is a ramp, not a switch: a hand closes over ~120ms.
      const want = input.dragging && grip > 0.02 ? grip : 0;
      const rate = want > pressAmt ? 9.0 : 5.0;
      pressAmt += (want - pressAmt) * (1 - Math.exp(-rate * dt));
      pressAmt = Math.max(0, Math.min(1, pressAmt));

      /* --- tension ------------------------------------------------------- */
      if (pressAmt > 0.02) {
        // Working the mark — moving the hand across it while held — builds
        // pressure much faster than holding still. Same reward structure as
        // Gather's drag-to-charge, so the two games feel like one hand.
        const work = Math.min(1, input.speed || 0);
        // `centre` rewards grabbing the middle of the mark over the outer edge,
        // so where you press matters as much as how long.
        const centre = 0.55 + 0.45 * grip;
        const gain = TENSION.holdGain + TENSION.workGain * work;
        tension += gain * pressAmt * centre * dt;
      } else {
        tension -= TENSION.decay * dt;
      }
      tension = Math.max(0, Math.min(1, tension));

      const next = tension >= SQUEEZE_STOPS.strain
        ? 'burst'
        : tension >= SQUEEZE_STOPS.press ? 'strain' : 'press';
      if (next !== phase) {
        phase = next;
        hooks?.onPhase?.(phase);
      }

      if (tension >= 1) {
        tension = 0;
        popT = 0;
        pops++;
        hooks?.onPop?.();
      }

      // The whole mark contracts as it is squeezed, scaled by how hard the
      // hand is actually down rather than by tension alone, so letting go
      // visibly relaxes it.
      squeeze = tension * (0.35 + 0.65 * pressAmt);
      heat = tension * tension;
      shake = reduced ? 0 : tension * 0.1 * pressAmt;

      if (pressAmt > 0.01) {
        pressOut = { x: hand.x, y: hand.y, strength: pressAmt };
      }
    }

    patch.sync(hand.x, hand.y, pressRadius, pressAmt, tension);
    patch.setVisible(hasPointer && pressAmt > 0.01);

    hud.tension = tension;
    hud.phase = phase;
    hud.pops = pops;
    hud.pressing = pressAmt > 0.01;

    return {
      morph,
      chaos: 0,
      impulse: popT < 0 ? 0 : 0.35 + 0.65 * (1 - Math.min(1, popT / POP.out)),
      ignite: heat,
      pointerForce: 0,
      revealed: 1,
      squeeze,
      press: pressOut,
      pressRadius,
      shake,
      tension,
      phase,
      pops,
      popping: popT >= 0,
    };
  }

  // A flat snapshot for the HUD, so the DOM reads one object per mode instead
  // of reaching into the game's internals. Kept deliberately small.
  const hud = { tension: 0, phase: 'press', pops: 0, pressing: false };

  return {
    scene, update, resize, reset, hud,
    get worldScale() { return worldScale; },
    dispose: patch.dispose,
  };
}
