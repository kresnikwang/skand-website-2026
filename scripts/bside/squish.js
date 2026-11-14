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
import { LETTERS } from './config.js?v=20261115e';

const PRESS_RADIUS = 0.50;
const TRAIL_RADIUS = 0.42;
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
    const restThickness = smoothstep(0.0, 0.14, abs(pIn.z));
    const rimMask = float(1.0).sub(smoothstep(0.55, 1.0, sAnalytic));

    // 1. Global Poisson volume-preserving squash + waist belly + splat + idle breath.
    const sq = uGlobal.x;
    const breath = uGlobal.y;
    const splat = uGlobal.z;
    const boingZ = uGlobal.w;

    const waist = float(1.0).sub(clamp(abs(p.z).mul(3.0), 0.0, 0.72));
    const latSpread = float(1.0)
      .add(sq.mul(0.21).mul(float(0.62).add(waist.mul(0.58))))
      .add(splat.mul(0.32))
      .sub(boingZ.mul(0.095))
      .add(breath.mul(0.010));
    p.x.mulAssign(latSpread);
    p.y.mulAssign(latSpread.add(sq.mul(0.055)));
    p.z.mulAssign(
      max(float(0.29), float(1.0).sub(sq.mul(0.35)).sub(splat.mul(0.43)).add(boingZ.mul(0.25)).sub(breath.mul(0.015)))
    );

    // Subtle elastic shear from dragging across the tacky silicone surface.
    const frontShear = clamp(pIn.z.div(0.145), -1.0, 1.0);
    p.xy.addAssign(uDrag.mul(frontShear).mul(0.032));

    // 2. Dual-zone thumbprint crater + extruded donut fat-rim + opposing cheek inflation.
    const dent = uHand.z;
    const rad = max(uHand.w, float(0.1));
    const rel = p.xy.sub(uHand.xy);
    const d = length(rel);
    const t = d.div(rad);
    const dir = rel.div(max(d, float(0.0005)));

    // Tight fingertip center core + soft outer pillow slope for crisp 3D thumb concavity.
    const innerBowl = cos(clamp(t.mul(1.45), 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.56, 0.74, t)));
    const outerBowl = cos(clamp(t, 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.84, 1.02, t)));
    const bowl = outerBowl.mul(0.62).add(innerBowl.mul(0.48));

    const frontFactor = smoothstep(-0.04, 0.06, pIn.z);
    const frontDepth = bowl.mul(dent).mul(0.195).mul(rimMask).mul(float(0.20).add(restThickness.mul(0.80)));
    const backBow = bowl.mul(dent).mul(0.062).mul(rimMask);
    p.z.subAssign(mix(backBow, frontDepth, frontFactor));

    // Skin pinch fold pulls nearby lettering slightly inward toward the fingertip trough.
    const pinchPull = smoothstep(0.04, 0.36, t).mul(float(1.0).sub(smoothstep(0.36, 0.88, t)));
    p.xy.subAssign(dir.mul(pinchPull).mul(dent).mul(0.058));

    // Extruded donut bulge ("捏挤出来的 Q 弹肉感") outside the fingertip crater.
    // Smooth wide slope + capped ooze so silicone rolls softly without steep cliffs or self-folds.
    const rim = smoothstep(0.32, 1.15, t).mul(float(1.0).sub(smoothstep(1.15, 2.85, t)));
    const dragPush = max(float(0.0), dot(dir, uDrag)).mul(0.82);
    const dragBack = max(float(0.0), dot(dir, uDrag.negate())).mul(0.26);
    const ooze = clamp(float(1.0).add(dragPush).sub(dragBack), 0.68, 1.75);

    const zSign = clamp(pIn.z.div(0.055), -1.0, 1.0);
    p.z.addAssign(zSign.mul(rim).mul(dent).mul(0.115).mul(ooze));
    p.xy.addAssign(dir.mul(rim).mul(dent).mul(0.105).mul(ooze));

    // Monotonic opposing-cheek & edge herniation: expands outer rim smoothly without folding inside.
    const farWeight = smoothstep(0.55, 1.55, d);
    const edgeBelly = smoothstep(0.38, 1.0, sAnalytic);
    const nearGain = float(1.0).sub(smoothstep(0.12, 1.45, d));
    p.xy.addAssign(dir.mul(edgeBelly).mul(dent).mul(nearGain.mul(0.165).add(farWeight.mul(0.065))).mul(clamp(float(1.0).add(dragPush.mul(0.65)), 0.7, 1.75)));
    p.z.addAssign(zSign.mul(farWeight).mul(dent).mul(0.032).mul(rimMask));

    // 3. Viscoelastic slow-rise finger trail ("揉捏慢回弹指印").
    const trailRel = p.xy.sub(uTrail.xy);
    const trailT = length(trailRel).div(max(uTrail.w, float(0.1)));
    const trailBowl = cos(clamp(trailT, 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.84, 1.02, trailT)));
    p.z.subAssign(trailBowl.mul(uTrail.z).mul(0.092).mul(rimMask).mul(frontFactor));

    // 4. Release / Splat dual-harmonic jelly wobble wave rippling across cushion.
    const ripRel = p.xy.sub(uRipple.xy);
    const ripD = length(ripRel);
    const ripAmp = uRipple.z;
    const ripPhase = uRipple.w;
    const wave1 = sin(ripPhase.sub(ripD.mul(8.8))).mul(exp(ripD.negate().mul(1.15)));
    const wave2 = sin(ripPhase.mul(1.65).sub(ripD.mul(13.5))).mul(exp(ripD.negate().mul(1.85))).mul(0.35);
    const wave = wave1.add(wave2);
    p.z.addAssign(wave.mul(ripAmp).mul(0.078).mul(float(0.25).add(restThickness.mul(0.75))));
    p.xy.addAssign(ripRel.mul(wave).mul(ripAmp).mul(0.044));

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
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.34,
    sheen: 1.0,
    sheenRoughness: 0.58,
    sheenColor: new THREE.Color(0xffe4dc),
    ior: 1.40,
    transmission: 0.04,
    thickness: 0.78,
    attenuationColor: new THREE.Color(0xff967d),
    attenuationDistance: 1.35,
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
    const craterBerry = vec3(0.86, 0.42, 0.39);
    const rimHighlight = vec3(1.0, 0.96, 0.93);

    const baseCol = mix(cream, blush, smoothstep(0.30, 1.0, aShellS).mul(0.54));
    const col = mix(baseCol, juicyCoral, smoothstep(0.14, 0.86, aRelief)).toVar();

    // Concave fingertip bowl + lagging knead groove deepen with soft self-shadowed berry-peach AO.
    const d = length(positionLocal.xy.sub(uHand.xy));
    const dTrail = length(positionLocal.xy.sub(uTrail.xy));
    const coreCrater = float(1.0).sub(smoothstep(0.0, uHand.w.mul(0.92), d));
    const trailMask = float(1.0).sub(smoothstep(0.0, uTrail.w.mul(0.95), dTrail));
    const aoAmt = min(float(1.0), coreCrater.mul(uHand.z).mul(0.54).add(trailMask.mul(uTrail.z).mul(0.28)));
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
  let ripAmp = 0;
  let ripPhase = 0;
  const ripOrigin = new THREE.Vector2(0, 0);

  // Soft 3D whole-cushion spring tilt when poking off-center or hovering.
  let tiltX = 0;
  let tiltY = 0;
  let tiltVX = 0;
  let tiltVY = 0;

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
    releaseCooldown = 0;
    dent = 0;
    dentVel = 0;
    trailDent = 0;
    squash = 0;
    squashVel = 0;
    boingZ = 0;
    boingVel = 0;
    ripAmp = 0;
    ripPhase = 0;
    tiltX = tiltY = tiltVX = tiltVY = 0;
    group.rotation.set(0, 0, 0);
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

    const nx = input.pointer.x / Math.max(0.1, worldScale);
    const ny = input.pointer.y / Math.max(0.1, worldScale);
    const hoverGrip = insideRatio(nx, ny);
    const grip = input.dragging ? hoverGrip : 0;
    const activePress = input.dragging && grip > 0.04;

    if (activePress) {
      targetHand.set(
        Math.max(-MARK_HALF_W * 0.94, Math.min(MARK_HALF_W * 0.94, nx)),
        Math.max(-MARK_HALF_H * 0.92, Math.min(MARK_HALF_H * 0.92, ny))
      );
      if (!wasDragging) {
        hand.copy(targetHand);
        trailHand.copy(targetHand);
        lastHand.copy(targetHand);
        hooks.onPress?.();
      } else {
        hand.lerp(targetHand, 1 - Math.exp(-16.0 * dt));
        // Viscoelastic knead trail lags smoothly behind the fingertip.
        trailHand.lerp(hand, 1 - Math.exp(-3.8 * dt));
      }
      const dx = (hand.x - lastHand.x) / Math.max(dt, 0.008);
      const dy = (hand.y - lastHand.y) / Math.max(dt, 0.008);
      lastHand.copy(hand);
      dragVec.lerp(new THREE.Vector2(
        Math.max(-1.6, Math.min(1.6, dx * 0.50)),
        Math.max(-1.6, Math.min(1.6, dy * 0.50))
      ), 1 - Math.exp(-12.0 * dt));
    } else {
      dragVec.multiplyScalar(Math.exp(-7.5 * dt));
      if (wasDragging) {
        // Elastic release BOING! Deep enough pokes also reward a Boing count on release.
        const releaseEnergy = Math.max(0.28, dent * 0.9 + pressure * 0.45);
        boingVel += releaseEnergy * 6.0;
        ripOrigin.copy(hand);
        ripAmp = Math.min(1.4, ripAmp + releaseEnergy * 1.2);
        ripPhase = 0;
        if (dent >= 0.42 && splatT < 0 && releaseCooldown <= 0) {
          pops++;
          releaseCooldown = 0.25;
        }
        hooks.onRelease?.(releaseEnergy);
      }
    }
    wasDragging = activePress;

    // Pressure ramp for HUD beats + mega-splat climax.
    if (splatT >= 0) {
      splatT += dt;
      if (splatT > 1.15) {
        splatT = -1;
      }
    } else if (activePress) {
      const gain = 0.24 + (input.speed || 0) * 0.34;
      pressure = Math.min(1, pressure + gain * grip * dt);
      if (pressure >= 1) {
        pressure = 0;
        splatT = 0;
        pops++;
        releaseCooldown = 0.35;
        boingVel -= 8.4;
        ripOrigin.copy(hand);
        ripAmp = 1.65;
        ripPhase = 0;
        hooks.onPop?.();
      }
    } else {
      pressure = Math.max(0, pressure - 0.30 * dt);
    }

    const nextPhase = pressure >= SQUISH_STOPS.bulge
      ? 'boing'
      : pressure >= SQUISH_STOPS.poke ? 'bulge' : 'poke';
    if (nextPhase !== phase) {
      phase = nextPhase;
    }

    // Viscoelastic spring-mass physics: sinks deeply under touch, rebounds slowly like memory mochi then ripples.
    const dentTarget = activePress ? (0.80 + pressure * 0.46) * grip : 0;
    const dentK = activePress ? 118 : 92;
    const dentDamp = activePress ? 13.0 : 7.8;
    dentVel += ((dentTarget - dent) * dentK - dentVel * dentDamp) * dt;
    dent = Math.max(-0.22, dent + dentVel * dt);

    const trailTarget = activePress ? dent * 0.76 : 0;
    trailDent += (trailTarget - trailDent) * (1 - Math.exp((activePress ? -6.0 : -2.3) * dt));

    const sqTarget = activePress ? 0.40 + pressure * 0.64 : 0;
    squashVel += ((sqTarget - squash) * 145 - squashVel * 8.6) * dt;
    squash = Math.max(-0.26, squash + squashVel * dt);

    boingVel += (-boingZ * 165 - boingVel * 5.0) * dt;
    boingZ += boingVel * dt;

    // 3D cushion tilt: pressing off-center tips the pillow physically into your desk/hand.
    const targetTiltX = reduced ? 0 : (activePress
      ? -hand.y * (0.28 + dent * 0.14)
      : hoverGrip * -Math.max(-MARK_HALF_H, Math.min(MARK_HALF_H, ny)) * 0.08);
    const targetTiltY = reduced ? 0 : (activePress
      ? hand.x * (0.18 + dent * 0.10)
      : hoverGrip * Math.max(-MARK_HALF_W, Math.min(MARK_HALF_W, nx)) * 0.05);
    tiltVX += ((targetTiltX - tiltX) * 120 - tiltVX * 9.5) * dt;
    tiltVY += ((targetTiltY - tiltY) * 120 - tiltVY * 9.5) * dt;
    tiltX += tiltVX * dt;
    tiltY += tiltVY * dt;
    group.rotation.x = tiltX;
    group.rotation.y = tiltY;
    group.rotation.z = reduced ? 0 : (dragVec.x * 0.038 - boingZ * 0.028);

    if (ripAmp > 0.002) {
      ripPhase += dt * 24.0;
      ripAmp *= Math.exp(-3.1 * dt);
    } else {
      ripAmp = 0;
    }

    const splatAmt = splatT >= 0 ? Math.sin(Math.min(1, splatT / 0.55) * Math.PI) * Math.exp(-splatT * 2.4) : 0;
    const idleBreath = reduced ? 0 : Math.sin(time * 1.9);

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
        const thickness = 0.145 * rimProfile + reliefAmp * r * smoothstepScalar(0.98, 0.84, s);
        vertices.push(x, y, zSign * thickness);
        uvs.push(u * 0.5 + 0.5, v * 0.5 + 0.5);
        reliefs.push(zSign > 0 ? r : 0);
        shellSs.push(s);
      }
    }
  }

  pushGridVertices(1, 0.066);
  pushGridVertices(-1, 0.012);

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
