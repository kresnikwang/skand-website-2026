/**
 * SKAND B-Side — "Squish" mode: tactile 3D soft-silicone / mochi decompression toy.
 *
 * Completely distinct from the brittle Voronoi glass shards in Gather & Squeeze:
 * renders a welded-manifold matte platinum-silicone cushion with embossed puffy
 * "SKAND" lettering & piping, wrapped in powdered peach-cream subsurface lighting.
 *
 * Pressing & dragging indents a deep shaded thumbprint crater + lagging knead trail
 * while volume conservation swells displaced silicone into plump rim rolls, opposing
 * cheek lobes, and shear ooze. Releasing triggers juicy underdamped jelly wobbles &
 * a bouncy Boing count; over-squishing triggers a soft elastic "splat & bounce".
 */

import * as THREE from 'https://esm.sh/three@0.187.0/webgpu';
import {
  Fn,
  float,
  vec2,
  vec3,
  vec4,
  uniform,
  attribute,
  positionLocal,
  normalLocal,
  positionViewDirection,
  transformNormalToView,
  length,
  normalize,
  cross,
  dot,
  sin,
  cos,
  exp,
  pow,
  mix,
  clamp,
  smoothstep,
  max,
  min,
  abs,
} from 'https://esm.sh/three@0.187.0/tsl';
import { LETTERS } from './config.js?v=20261115h';

const PRESS_RADIUS = 0.56;
const TRAIL_RADIUS = 0.50;
const MARK_HALF_W = 1.06;
const MARK_HALF_H = 0.46;
const MARK_R = 0.16;

export const SQUISH_ORDER = ['poke', 'bulge', 'boing'];
const SQUISH_STOPS = { poke: 0.34, bulge: 0.82 };

export function createSquish({ reduced = false } = {}) {
  const group = new THREE.Group();
  group.visible = false;

  const { geometry } = buildSiliconePillowGeometry();

  // Soft-body state uniforms driven by viscoelastic spring-damper physics on CPU.
  const uTime = uniform(0);
  const uWorldScale = uniform(2.5);
  const uHand = uniform(new THREE.Vector4(0, 0, 0, PRESS_RADIUS));  // xy pos, z dentAmt, w radius
  const uTrail = uniform(new THREE.Vector4(0, 0, 0, TRAIL_RADIUS)); // xy lagging knead groove, z trailAmt, w radius
  const uDrag = uniform(new THREE.Vector2(0, 0));                   // directional ooze flow & shear
  const uGlobal = uniform(new THREE.Vector4(0, 0, 0, 0));           // x squashAmt, y idleBreath, z splatAmt, w boingGlobal
  const uRipple = uniform(new THREE.Vector4(0, 0, 0, 0));           // xy origin, z amp, w phase

  const aRelief = attribute('aRelief', 'float');
  const aShellS = attribute('aShellS', 'float');

  /**
   * Analytic normalized distance to the pillow rim for a given resting local point,
   * so tangent finite-differences in normalNode capture accurate curvature everywhere.
   */
  function analyticShellS(xy) {
    return max(abs(xy.x).div(MARK_HALF_W), abs(xy.y).div(MARK_HALF_H));
  }

  /**
   * Pure-TSL soft-body displacement in normalized SKAND space.
   * Evaluated at positionLocal and two tangent-offset neighbors so dynamic
   * lighting curves naturally into every thumb crater, fat roll, and jelly wobble.
   */
  function deformLocal(pIn) {
    const p = pIn.toVar();

    const sAnalytic = clamp(analyticShellS(pIn.xy), 0.0, 1.0);
    const restThickness = smoothstep(0.0, 0.22, abs(pIn.z));
    const rimMask = float(1.0).sub(smoothstep(0.58, 1.0, sAnalytic));

    // 1. Aggressive Poisson volume-preserving pancake squash + waist belly + splat.
    // Expand wider horizontally (screen has room) while capping vertical swell cleanly.
    const sq = uGlobal.x;
    const breath = uGlobal.y;
    const splat = uGlobal.z;
    const boingZ = uGlobal.w;

    const waist = float(1.0).sub(clamp(abs(p.z).mul(2.1), 0.0, 0.72));
    const latX = float(1.0)
      .add(sq.mul(0.24).mul(float(0.55).add(waist.mul(0.70))))
      .add(splat.mul(0.34))
      .sub(boingZ.mul(0.09))
      .add(breath.mul(0.012));
    const latY = float(1.0)
      .add(sq.mul(0.20).mul(float(0.55).add(waist.mul(0.65))))
      .add(splat.mul(0.28))
      .sub(boingZ.mul(0.08))
      .add(breath.mul(0.012));
    p.x.mulAssign(latX);
    p.y.mulAssign(latY);
    p.z.mulAssign(
      max(float(0.28), float(1.0).sub(sq.mul(0.36)).sub(splat.mul(0.46)).add(boingZ.mul(0.28)).sub(breath.mul(0.015)))
    );

    // Taffy-like elastic shear & whole-block drag pull across the silicone cushion.
    const frontShear = clamp(pIn.z.div(0.24), -1.0, 1.0);
    p.xy.addAssign(uDrag.mul(frontShear).mul(0.065));
    p.xy.addAssign(uDrag.mul(float(0.052).mul(float(1.0).sub(sAnalytic.mul(0.35)))));

    // 2. Deep palm/thumbprint abyss + wide fat donut bulge + opposing cheek swell.
    const dent = uHand.z;
    const rad = max(uHand.w, float(0.1));
    const rel = p.xy.sub(uHand.xy);
    const d = length(rel);
    const t = d.div(rad);
    const dir = rel.div(max(d, float(0.0005)));

    const innerBowl = cos(clamp(t.mul(1.42), 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.56, 0.76, t)));
    const outerBowl = cos(clamp(t, 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.84, 1.02, t)));
    const bowl = outerBowl.mul(0.62).add(innerBowl.mul(0.50));

    // Multiplicative thickness crush: front skin collapses deeply toward a thin ~12% floor above z=0,
    // so it NEVER pierces through the back surface or flips inside-out at any dent depth!
    const trailRel = p.xy.sub(uTrail.xy);
    const trailT = length(trailRel).div(max(uTrail.w, float(0.1)));
    const trailBowl = cos(clamp(trailT, 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.84, 1.02, trailT)));

    const sinkFrac = clamp(bowl.mul(dent).mul(0.56), 0.0, 0.86);
    const trailFrac = clamp(trailBowl.mul(uTrail.z).mul(0.42), 0.0, 0.72);
    const crush = max(sinkFrac, trailFrac).mul(rimMask);
    const frontFactor = smoothstep(-0.02, 0.04, pIn.z);
    p.z.assign(mix(p.z, p.z.mul(0.12), frontFactor.mul(crush)));
    // Back face yields softly upward under massive crush without inverting sign.
    p.z.assign(mix(p.z, p.z.mul(float(1.0).sub(crush.mul(0.32))), float(1.0).sub(frontFactor)));

    // Gentle skin pinch tugs nearby cushion toward the thumb trough without folding.
    const pinchPull = smoothstep(0.06, 0.40, t).mul(float(1.0).sub(smoothstep(0.40, 0.92, t)));
    p.xy.subAssign(dir.mul(pinchPull).mul(min(dent, float(1.4))).mul(0.045));

    // Wide smooth extruded fat-rim ("狠狠挤出肥厚一圈") without Jacobian fold overhangs.
    const rim = smoothstep(0.34, 1.18, t).mul(float(1.0).sub(smoothstep(1.18, 3.15, t)));
    const dragPush = max(float(0.0), dot(dir, uDrag)).mul(0.85);
    const dragBack = max(float(0.0), dot(dir, uDrag.negate())).mul(0.25);
    const ooze = clamp(float(1.0).add(dragPush).sub(dragBack), 0.68, 1.72);

    const zSign = clamp(pIn.z.div(0.06), -1.0, 1.0);
    p.z.addAssign(zSign.mul(rim).mul(dent).mul(0.115).mul(ooze));
    p.xy.addAssign(dir.mul(rim).mul(dent).mul(0.090).mul(ooze));

    // Monotonic heavy cheek & corner bloat when smashed down hard.
    const farWeight = smoothstep(0.48, 1.50, d);
    const edgeBelly = smoothstep(0.35, 1.0, sAnalytic);
    const nearGain = float(1.0).sub(smoothstep(0.15, 1.48, d));
    p.xy.addAssign(dir.mul(edgeBelly).mul(dent).mul(nearGain.mul(0.145).add(farWeight.mul(0.075))).mul(clamp(float(1.0).add(dragPush.mul(0.65)), 0.7, 1.72)));
    p.z.addAssign(zSign.mul(farWeight).mul(dent).mul(0.042).mul(rimMask));

    // 4. Release / Splat dual-harmonic jelly wobble wave rippling across cushion.
    const ripRel = p.xy.sub(uRipple.xy);
    const ripD = length(ripRel);
    const ripAmp = uRipple.z;
    const ripPhase = uRipple.w;
    const wave1 = sin(ripPhase.sub(ripD.mul(8.2))).mul(exp(ripD.negate().mul(1.05)));
    const wave2 = sin(ripPhase.mul(1.65).sub(ripD.mul(13.0))).mul(exp(ripD.negate().mul(1.75))).mul(0.38);
    const wave = wave1.add(wave2);
    p.z.addAssign(wave.mul(ripAmp).mul(0.088).mul(restThickness));
    p.xy.addAssign(ripRel.mul(wave).mul(ripAmp).mul(0.046));

    return p.mul(uWorldScale);
  }

  /**
   * Fine procedural cornstarch-dusted matte silicone grain so lighting never
   * reads as slick plastic CGI.
   */
  function siliconeGrain(xy) {
    const g1 = sin(xy.x.mul(74.0).add(sin(xy.y.mul(52.0)).mul(1.4)));
    const g2 = cos(xy.y.mul(88.0).sub(cos(xy.x.mul(63.0)).mul(1.3)));
    return g1.mul(g2).mul(0.5).add(0.5);
  }

  function deformNormalView(posLocal) {
    const N0 = normalize(normalLocal);
    // Use X-axis test so tangent basis never flips anywhere across the front dome, letters, or piping.
    const upRef = abs(N0.x).lessThan(0.90).select(vec3(1, 0, 0), vec3(0, 1, 0));
    const T = normalize(cross(upRef, N0));
    const B = normalize(cross(N0, T));
    const eps = float(0.006);

    const p0 = deformLocal(posLocal);
    const pT = deformLocal(posLocal.add(T.mul(eps)));
    const pB = deformLocal(posLocal.add(B.mul(eps)));

    const rotN = normalize(cross(pT.sub(p0), pB.sub(p0)));
    // Add ultra-subtle matte silicone powder micro-tooth to break up harsh specular edges.
    const grain = siliconeGrain(posLocal.xy).sub(0.5).mul(0.010);
    const texturedN = normalize(rotN.add(vec3(grain, grain.negate().mul(0.8), float(0.0))));
    return normalize(transformNormalToView(texturedN));
  }

  const material = new THREE.MeshPhysicalNodeMaterial({
    roughness: 0.40,
    metalness: 0.0,
    clearcoat: 0.38,
    clearcoatRoughness: 0.26,
    sheen: 1.0,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffe4dc),
    ior: 1.40,
    transmission: 0.06,
    thickness: 0.92,
    attenuationColor: new THREE.Color(0xff7258),
    attenuationDistance: 1.15,
    side: THREE.FrontSide,
  });

  material.positionNode = Fn(() => {
    return deformLocal(positionLocal);
  })();

  material.normalNode = Fn(() => {
    return deformNormalView(positionLocal);
  })();

  material.roughnessNode = Fn(() => {
    const grain = siliconeGrain(positionLocal.xy);
    const d = length(positionLocal.xy.sub(uHand.xy));
    const stretchMask = float(1.0).sub(smoothstep(0.0, uHand.w.mul(1.15), d)).mul(uHand.z);
    // Powder-matte at rest (~0.42), warming slightly glossier when taut under thumbprint (~0.28).
    return clamp(float(0.41).add(grain.sub(0.5).mul(0.06)).sub(stretchMask.mul(0.14)), 0.22, 0.52);
  })();

  // Creamy mochi cushion + coral-peach SKAND lettering + shaded concave thumb crater AO.
  material.colorNode = Fn(() => {
    const cream = vec3(0.99, 0.91, 0.87);
    const blush = vec3(0.98, 0.68, 0.64);
    const juicyCoral = vec3(0.93, 0.39, 0.32);
    const craterBerry = vec3(0.81, 0.34, 0.34);
    const rimHighlight = vec3(1.0, 0.96, 0.93);

    const baseCol = mix(cream, blush, smoothstep(0.30, 1.0, aShellS).mul(0.54));
    const col = mix(baseCol, juicyCoral, smoothstep(0.14, 0.86, aRelief)).toVar();

    // Concave fingertip bowl + lagging knead groove deepen with soft self-shadowed berry-peach AO.
    const d = length(positionLocal.xy.sub(uHand.xy));
    const dTrail = length(positionLocal.xy.sub(uTrail.xy));
    const coreCrater = float(1.0).sub(smoothstep(0.0, uHand.w.mul(0.95), d));
    const trailMask = float(1.0).sub(smoothstep(0.0, uTrail.w.mul(0.98), dTrail));
    const aoAmt = min(float(1.0), coreCrater.mul(uHand.z).mul(0.56).add(trailMask.mul(uTrail.z).mul(0.30)));
    col.assign(mix(col, craterBerry, aoAmt));

    // Plump displaced donut ring catches warm creamy subsurface highlight.
    const t = d.div(max(uHand.w, 0.1));
    const rimRing = smoothstep(0.56, 1.04, t).mul(float(1.0).sub(smoothstep(1.04, 1.98, t)));
    col.assign(mix(col, rimHighlight, rimRing.mul(uHand.z).mul(0.28)));
    return col;
  })();

  // True subsurface glow: darkens slightly inside occluded dimple pit, glows at stretched rim & edges!
  material.emissiveNode = Fn(() => {
    const V = normalize(positionViewDirection);
    const nView = deformNormalView(positionLocal);
    const fresnel = pow(float(1.0).sub(clamp(abs(dot(nView, V)), 0.0, 1.0)), 2.25);

    const d = length(positionLocal.xy.sub(uHand.xy));
    const t = d.div(max(uHand.w, 0.1));
    const craterSuppress = float(1.0).sub(
      float(1.0).sub(smoothstep(0.0, uHand.w.mul(0.85), d)).mul(clamp(uHand.z, 0.0, 1.0)).mul(0.85)
    );
    const sssBase = vec3(0.96, 0.48, 0.40).mul(float(0.048).add(fresnel.mul(0.24))).mul(craterSuppress);

    const rimGlow = smoothstep(0.56, 1.08, t).mul(float(1.0).sub(smoothstep(1.08, 2.2, t))).mul(uHand.z);
    const sssHot = vec3(0.99, 0.54, 0.40).mul(rimGlow.mul(0.24));
    const splatGlow = vec3(0.98, 0.64, 0.52).mul(uGlobal.z.mul(0.18));
    return sssBase.add(sssHot).add(splatGlow);
  })();

  const pillowMesh = new THREE.Mesh(geometry, material);
  pillowMesh.renderOrder = 3;
  pillowMesh.frustumCulled = false;
  group.add(pillowMesh);

  // Viscoelastic spring-damper physical state.
  let worldScale = 2.5;
  let pressure = 0;
  let pops = 0;
  let phase = 'poke';
  let wasDragging = false;
  let splatT = -1;
  let flightT = -1;
  let flightLanded = true;
  let releaseCooldown = 0;

  const hand = new THREE.Vector2(0, 0);
  const trailHand = new THREE.Vector2(0, 0);
  const targetHand = new THREE.Vector2(0, 0);
  const lastHand = new THREE.Vector2(0, 0);
  const dragVec = new THREE.Vector2(0, 0);
  let dent = 0;
  let dentVel = 0;
  let trailDent = 0;
  let squash = 0;
  let squashVel = 0;
  let boingZ = 0;
  let boingVel = 0;
  let popX = 0;
  let popY = 0;
  let popVX = 0;
  let popVY = 0;
  let ripAmp = 0;
  let ripPhase = 0;
  const ripOrigin = new THREE.Vector2(0, 0);

  // Soft 3D whole-cushion spring tilt when poking off-center or hovering.
  let tiltX = 0;
  let tiltY = 0;
  let tiltZ = 0;
  let tiltVX = 0;
  let tiltVY = 0;
  let tiltVZ = 0;

  const hud = { pressure: 0, phase: 'poke', pops: 0, pressing: false };

  function insideRatio(nx, ny) {
    const ax = Math.abs(nx) - MARK_HALF_W;
    const ay = Math.abs(ny) - MARK_HALF_H;
    const out = Math.hypot(Math.max(ax, 0), Math.max(ay, 0));
    const ins = Math.min(Math.max(ax, ay), 0);
    const d = out + ins;
    const t = Math.max(0, Math.min(1, (0.28 - d) / 0.42));
    return t * t * (3 - 2 * t);
  }

  function reset(clearPops = false) {
    pressure = 0;
    if (clearPops) pops = 0;
    phase = 'poke';
    wasDragging = false;
    splatT = -1;
    flightT = -1;
    flightLanded = true;
    releaseCooldown = 0;
    dent = 0;
    dentVel = 0;
    trailDent = 0;
    squash = 0;
    squashVel = 0;
    boingZ = 0;
    boingVel = 0;
    popX = popY = popVX = popVY = 0;
    ripAmp = 0;
    ripPhase = 0;
    tiltX = tiltY = tiltZ = tiltVX = tiltVY = tiltVZ = 0;
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    hand.set(0, 0);
    trailHand.set(0, 0);
    targetHand.set(0, 0);
    lastHand.set(0, 0);
    dragVec.set(0, 0);
    uHand.value.set(0, 0, 0, PRESS_RADIUS);
    uTrail.value.set(0, 0, 0, TRAIL_RADIUS);
    uDrag.value.set(0, 0);
    uGlobal.value.set(0, 0, 0, 0);
    uRipple.value.set(0, 0, 0, 0);
    hud.pressure = 0;
    hud.phase = 'poke';
    hud.pops = pops;
    hud.pressing = false;
  }

  function setWorldScale(v) {
    worldScale = v;
    uWorldScale.value = v;
  }

  function update(dt, time, input, hooks = {}) {
    uTime.value = time;
    if (releaseCooldown > 0) releaseCooldown = Math.max(0, releaseCooldown - dt);

    // Track pointer relative to the cushion's live bouncing center so mid-rebound catches work cleanly.
    const nx = (input.pointer.x - group.position.x) / Math.max(0.1, worldScale);
    const ny = (input.pointer.y - group.position.y) / Math.max(0.1, worldScale);
    const hoverGrip = insideRatio(nx, ny);
    const airborneSlip = flightT >= 0 && flightT < 0.72;
    const grip = (input.dragging && !airborneSlip) ? hoverGrip : 0;
    const activePress = input.dragging && !airborneSlip && grip > 0.04;

    if (activePress) {
      targetHand.set(
        Math.max(-MARK_HALF_W * 0.94, Math.min(MARK_HALF_W * 0.94, nx)),
        Math.max(-MARK_HALF_H * 0.92, Math.min(MARK_HALF_H * 0.92, ny))
      );
      if (!wasDragging) {
        hand.copy(targetHand);
        trailHand.copy(targetHand);
        lastHand.copy(targetHand);
        // Immediate palm/thumb slam impulse so pressing feels snappy and heavy.
        dentVel += 4.6 * grip;
        squashVel += 3.8 * grip;
        boingVel -= 3.2 * grip;
        hooks.onPress?.();
      } else {
        hand.lerp(targetHand, 1 - Math.exp(-18.0 * dt));
        // Heavy slow-rise knead groove trails lazily behind the dragging thumb.
        trailHand.lerp(hand, 1 - Math.exp(-2.8 * dt));
      }
      const dx = (hand.x - lastHand.x) / Math.max(dt, 0.008);
      const dy = (hand.y - lastHand.y) / Math.max(dt, 0.008);
      lastHand.copy(hand);
      dragVec.lerp(new THREE.Vector2(
        Math.max(-1.85, Math.min(1.85, dx * 0.62)),
        Math.max(-1.85, Math.min(1.85, dy * 0.62))
      ), 1 - Math.exp(-13.0 * dt));
    } else {
      dragVec.multiplyScalar(Math.exp(-6.5 * dt));
      if (wasDragging && flightT < 0) {
        // Charged mid-squish release REBOUND! Springs outward, hops opposite pinch, & jiggles back.
        const releaseEnergy = Math.max(0.32, dent * 0.75 + pressure * 0.95);
        boingVel += releaseEnergy * 11.5;
        dentVel -= releaseEnergy * 4.2;
        squashVel -= releaseEnergy * 4.8;
        if (!reduced) {
          popVY += releaseEnergy * 2.1;
          popVX += -hand.x * releaseEnergy * 0.85;
          tiltVX += hand.y * releaseEnergy * 2.4;
          tiltVY += -hand.x * releaseEnergy * 2.0;
          tiltVZ += (-hand.x * 1.4 - dragVec.x * 0.45) * releaseEnergy;
        }
        ripOrigin.copy(hand);
        ripAmp = Math.min(1.75, ripAmp + releaseEnergy * 1.45);
        ripPhase = 0;
        if (dent >= 0.42 && splatT < 0 && releaseCooldown <= 0) {
          pops++;
          releaseCooldown = 0.25;
        }
        hooks.onRelease?.(releaseEnergy);
      }
    }
    wasDragging = activePress;

    // Pressure ramp for HUD beats + max-pressure "pop upward & drift home" climax.
    if (splatT >= 0) {
      splatT += dt;
      if (splatT > 1.35) {
        splatT = -1;
      }
    } else if (activePress) {
      const gain = 0.26 + (input.speed || 0) * 0.36;
      pressure = Math.min(1, pressure + gain * grip * dt);
      if (pressure >= 1) {
        pressure = 0;
        splatT = 0;
        flightT = 0;
        flightLanded = false;
        pops++;
        releaseCooldown = 0.45;
        boingVel += 12.0;
        dentVel -= 5.8;
        squashVel -= 6.5;
        if (!reduced) {
          // Squeeze to the limit -> pops right UP within viewport framing, then drifts gently back!
          popVY = 3.7;
          popVX = -hand.x * 0.85;
          tiltVX += -2.4;
          tiltVZ += (-hand.x * 2.0 + (Math.random() - 0.5) * 1.4);
        }
        ripOrigin.copy(hand);
        ripAmp = 1.95;
        ripPhase = 0;
        hooks.onPop?.();
      }
    } else {
      pressure = Math.max(0, pressure - 0.58 * dt);
    }

    const nextPhase = pressure >= SQUISH_STOPS.bulge
      ? 'boing'
      : pressure >= SQUISH_STOPS.poke ? 'bulge' : 'poke';
    if (nextPhase !== phase) {
      phase = nextPhase;
      if (activePress && (phase === 'bulge' || phase === 'boing')) {
        hooks.onPhase?.(phase);
      }
    }

    // Viscoelastic spring-mass physics: sinks deeply under touch, rebounds slowly like memory mochi then wobbles.
    const dentTarget = activePress ? (1.12 + pressure * 0.68) * grip : 0;
    const dentK = activePress ? 135 : 92;
    const dentDamp = activePress ? 12.5 : 6.4;
    dentVel += ((dentTarget - dent) * dentK - dentVel * dentDamp) * dt;
    dent = Math.max(-0.34, dent + dentVel * dt);

    const trailTarget = activePress ? dent * 0.84 : 0;
    trailDent += (trailTarget - trailDent) * (1 - Math.exp((activePress ? -6.5 : -1.55) * dt));

    const sqTarget = activePress ? 0.56 + pressure * 0.88 : 0;
    squashVel += ((sqTarget - squash) * 155 - squashVel * 7.6) * dt;
    squash = Math.max(-0.38, squash + squashVel * dt);

    boingVel += (-boingZ * 175 - boingVel * 3.8) * dt;
    boingZ += boingVel * dt;

    // Cushion flight & gentle slow return to center after popping out or recoil-hopping.
    if (flightT >= 0) {
      flightT += dt;
      if (flightT < 0.52) {
        // Soaring upward pop with gentle hangtime gravity before floating back down.
        popVY -= 8.4 * dt;
        popVX *= Math.exp(-2.4 * dt);
      } else {
        // Slowly & softly glides home so player is ready for the next squish.
        popVY += (-popY * 18.0 - popVY * 6.8) * dt;
        popVX += (-popX * 18.0 - popVX * 6.8) * dt;
        if (!flightLanded && flightT > 0.92 && Math.abs(popY) < 0.08 && Math.abs(popVY) < 0.45) {
          flightLanded = true;
          boingVel -= 4.2;
          hooks.onLand?.();
        }
      }
      if (flightT > 1.55) {
        flightT = -1;
      }
    } else {
      // Mid-squish recoil hop & soft spring settle back to (0, 0).
      popVX += (-popX * 52.0 - popVX * 7.4) * dt;
      popVY += (-popY * 52.0 - popVY * 7.4) * dt;
    }
    popX += popVX * dt;
    popY += popVY * dt;
    group.position.set(
      reduced ? 0 : popX * worldScale,
      reduced ? 0 : popY * worldScale,
      0
    );

    // 3D cushion tilt: pressing off-center tips the pillow physically; popping adds playful tumble.
    const targetTiltX = reduced ? 0 : (activePress
      ? -hand.y * (0.34 + dent * 0.16)
      : hoverGrip * -Math.max(-MARK_HALF_H, Math.min(MARK_HALF_H, ny)) * 0.09);
    const targetTiltY = reduced ? 0 : (activePress
      ? hand.x * (0.24 + dent * 0.12)
      : hoverGrip * Math.max(-MARK_HALF_W, Math.min(MARK_HALF_W, nx)) * 0.06);
    const targetTiltZ = reduced ? 0 : (dragVec.x * 0.055 - boingZ * 0.038);
    tiltVX += ((targetTiltX - tiltX) * 135 - tiltVX * 8.2) * dt;
    tiltVY += ((targetTiltY - tiltY) * 135 - tiltVY * 8.2) * dt;
    tiltVZ += ((targetTiltZ - tiltZ) * 115 - tiltVZ * 6.8) * dt;
    tiltX += tiltVX * dt;
    tiltY += tiltVY * dt;
    tiltZ += tiltVZ * dt;
    group.rotation.set(tiltX, tiltY, tiltZ);

    if (ripAmp > 0.002) {
      ripPhase += dt * 26.0;
      ripAmp *= Math.exp(-2.8 * dt);
    } else {
      ripAmp = 0;
    }

    const splatAmt = splatT >= 0 ? Math.sin(Math.min(1, splatT / 0.45) * Math.PI) * Math.exp(-splatT * 2.4) : 0;
    const idleBreath = reduced ? 0 : Math.sin(time * 1.9);

    // Whole-body volume-preserving squash & stretch overshoot during boings, pop-flight & mega-splat.
    if (!reduced) {
      const flightStretch = flightT >= 0 && flightT < 0.55 ? Math.max(0, popVY) * 0.032 : 0;
      const stretchZ = Math.max(0.55, Math.min(1.52, 1 + boingZ * 0.25 - splatAmt * 0.22));
      const invXY = 1 / Math.sqrt(stretchZ);
      group.scale.set(
        invXY * (1 - flightStretch * 0.45),
        invXY * (1 + flightStretch + splatAmt * 0.04),
        stretchZ
      );
    }

    uHand.value.set(hand.x, hand.y, Math.max(0, dent), PRESS_RADIUS);
    uTrail.value.set(trailHand.x, trailHand.y, Math.max(0, trailDent), TRAIL_RADIUS);
    uDrag.value.copy(dragVec);
    uGlobal.value.set(Math.max(-0.15, squash), idleBreath, splatAmt, reduced ? 0 : boingZ);
    uRipple.value.set(ripOrigin.x, ripOrigin.y, reduced ? 0 : ripAmp, ripPhase);

    hud.pressure = pressure;
    hud.phase = phase;
    hud.pops = pops;
    hud.pressing = activePress;

    return {
      pressure,
      phase,
      pops,
      squash: Math.max(0, squash),
      splat: splatAmt,
      boing: Math.abs(boingZ),
      kneadSpeed: dragVec.length(),
      pressing: activePress,
    };
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { group, hud, reset, setWorldScale, update, dispose };
}

/* ================================================================== */
/* Welded-Manifold Silicone Cushion + Crisp Puffy SKAND Relief        */
/* ================================================================== */

function buildSiliconePillowGeometry() {
  const maskW = 720;
  const maskH = 320;
  const reliefField = buildReliefHeightField(maskW, maskH);

  const nx = 180;
  const ny = 84;
  const row = nx + 1;
  const gridVertCount = row * (ny + 1);
  const vertices = [];
  const uvs = [];
  const reliefs = [];
  const shellSs = [];
  const indices = [];

  function mapToRoundedRect(u, v) {
    const s = Math.max(Math.abs(u), Math.abs(v));
    if (s < 1e-6) return { x: 0, y: 0, s: 0 };

    const px = (u / s) * MARK_HALF_W;
    const py = (v / s) * MARK_HALF_H;
    const ax = MARK_HALF_W - MARK_R;
    const ay = MARK_HALF_H - MARK_R;
    const dx = Math.max(0, Math.abs(px) - ax);
    const dy = Math.max(0, Math.abs(py) - ay);

    let bx = px;
    let by = py;
    if (dx > 0 && dy > 0) {
      const len = Math.hypot(dx, dy) || 1;
      bx = Math.sign(px) * (ax + (dx / len) * MARK_R);
      by = Math.sign(py) * (ay + (dy / len) * MARK_R);
    }
    return { x: s * bx, y: s * by, s };
  }

  function sampleRelief(x, y) {
    const fx = ((x / MARK_HALF_W) * 0.5 + 0.5) * (maskW - 1);
    const fy = (0.5 - (y / MARK_HALF_H) * 0.5) * (maskH - 1);
    const ix = Math.max(0, Math.min(maskW - 2, Math.floor(fx)));
    const iy = Math.max(0, Math.min(maskH - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - ix));
    const ty = Math.max(0, Math.min(1, fy - iy));
    const i00 = iy * maskW + ix;
    const i10 = i00 + 1;
    const i01 = i00 + maskW;
    const i11 = i01 + 1;
    const a = reliefField[i00] * (1 - tx) + reliefField[i10] * tx;
    const b = reliefField[i01] * (1 - tx) + reliefField[i11] * tx;
    return a * (1 - ty) + b * ty;
  }

  function pushGridVertices(zSign, reliefAmp) {
    for (let j = 0; j <= ny; j++) {
      const v = (j / ny) * 2 - 1;
      for (let i = 0; i <= nx; i++) {
        const u = (i / nx) * 2 - 1;
        const { x, y, s } = mapToRoundedRect(u, v);
        const r = sampleRelief(x, y);
        const rimProfile = Math.pow(Math.max(0, 1 - Math.pow(s, 2.85)), 0.50);
        const thickness = 0.24 * rimProfile + reliefAmp * r * smoothstepScalar(0.98, 0.84, s);
        vertices.push(x, y, zSign * thickness);
        uvs.push(u * 0.5 + 0.5, v * 0.5 + 0.5);
        reliefs.push(zSign > 0 ? r : 0);
        shellSs.push(s);
      }
    }
  }

  pushGridVertices(1, 0.086);
  pushGridVertices(-1, 0.016);

  function vid(isBack, i, j) {
    const isBoundary = i === 0 || i === nx || j === 0 || j === ny;
    const base = (!isBack || isBoundary) ? 0 : gridVertCount;
    return base + j * row + i;
  }

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = vid(false, i, j);
      const b = vid(false, i + 1, j);
      const c = vid(false, i, j + 1);
      const d = vid(false, i + 1, j + 1);
      indices.push(a, b, d, a, d, c);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = vid(true, i, j);
      const b = vid(true, i + 1, j);
      const c = vid(true, i, j + 1);
      const d = vid(true, i + 1, j + 1);
      indices.push(a, d, b, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aRelief', new THREE.Float32BufferAttribute(reliefs, 1));
  geometry.setAttribute('aShellS', new THREE.Float32BufferAttribute(shellSs, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry };
}

function smoothstepScalar(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function buildReliefHeightField(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const pxPerNorm = w / (MARK_HALF_W * 2);
  const toPx = (nx, ny) => [
    w * 0.5 + nx * pxPerNorm,
    h * 0.5 - ny * pxPerNorm,
  ];

  // Draw rounded border piping.
  const [left, top] = toPx(-0.96, 0.36);
  const fw = 1.92 * pxPerNorm;
  const fh = 0.72 * pxPerNorm;
  const fr = 0.115 * pxPerNorm;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.058 * pxPerNorm;
  ctx.beginPath();
  ctx.roundRect(left, top, fw, fh, fr);
  ctx.stroke();

  // Draw bold Outfit 800 SKAND letters cleanly inside.
  const fontPx = Math.round(0.32 * pxPerNorm);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${fontPx}px Outfit, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const span = 1.38 * pxPerNorm;
  const x0 = w * 0.5 - span * 0.5;
  const step = span / (LETTERS.length - 1);
  for (let i = 0; i < LETTERS.length; i++) {
    ctx.fillText(LETTERS[i], x0 + i * step, h * 0.5 + fontPx * 0.04);
  }

  const raw = ctx.getImageData(0, 0, w, h).data;
  let field = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    field[i] = raw[i * 4 + 3] / 255;
  }

  field = boxBlur(field, w, h, 5);
  field = boxBlur(field, w, h, 4);
  field = boxBlur(field, w, h, 2);

  for (let i = 0; i < field.length; i++) {
    field[i] = Math.min(1, Math.pow(field[i], 0.78) * 1.24);
  }
  return field;
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  const k = 2 * r + 1;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let d = -r; d <= r; d++) {
        sum += src[row + Math.max(0, Math.min(w - 1, x + d))];
      }
      tmp[row + x] = sum / k;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let d = -r; d <= r; d++) {
        sum += tmp[Math.max(0, Math.min(h - 1, y + d)) * w + x];
      }
      dst[y * w + x] = sum / k;
    }
  }
  return dst;
}
