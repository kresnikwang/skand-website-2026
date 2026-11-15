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

const PRESS_RADIUS = 0.48;
const TRAIL_RADIUS = 0.42;
const BALL_R = 0.72;
const BALL_Z = 0.69;

export const SQUISH_ORDER = ['poke', 'bulge', 'boing'];
const SQUISH_STOPS = { poke: 0.34, bulge: 0.82 };

export function createSquish({ reduced = false } = {}) {
  const group = new THREE.Group();
  group.visible = false;

  const { geometry } = buildSiliconeSphereGeometry();

  // Soft-body state uniforms driven by viscoelastic spring-damper physics on CPU.
  const uTime = uniform(0);
  const uWorldScale = uniform(2.5);
  const uHand = uniform(new THREE.Vector4(0, 0, 0, PRESS_RADIUS));  // xy pos, z dentAmt, w radius
  const uTrail = uniform(new THREE.Vector4(0, 0, 0, TRAIL_RADIUS)); // xy lagging knead groove, z trailAmt, w radius
  const uDrag = uniform(new THREE.Vector2(0, 0));                   // directional ooze flow & shear
  const uGlobal = uniform(new THREE.Vector4(0, 0, 0, 0));           // x squashAmt, y idleBreath, z splatAmt, w boingGlobal
  const uRipple = uniform(new THREE.Vector4(0, 0, 0, 0));           // xy origin, z amp, w phase
  const uFx = uniform(new THREE.Vector4(0, 0, 0, 0));               // x heat (held pressure), y tap flash, z throb 0..1

  const aRelief = attribute('aRelief', 'float');
  const aShellS = attribute('aShellS', 'float');

  /**
   * Analytic normalized radial distance to the sphere equator for tangent finite differences.
   */
  function analyticShellS(xy) {
    return length(xy).div(BALL_R);
  }

  /**
   * Pure-TSL soft-body displacement in normalized sphere space.
   * Evaluated at positionLocal and two tangent-offset neighbors so dynamic
   * lighting curves naturally into every thumb crater, fat cheek, and jelly wobble.
   */
  function deformLocal(pIn) {
    const p = pIn.toVar();

    const sAnalytic = clamp(analyticShellS(pIn.xy), 0.0, 1.0);
    const domeMask = smoothstep(0.02, 0.30, pIn.z);
    const frontFactor = smoothstep(-0.08, 0.14, pIn.z);
    const rimMask = float(1.0).sub(smoothstep(0.68, 1.0, sAnalytic));

    // 1. Aggressive Poisson volume-preserving pancake squash + spherical equator belly + splat.
    const sq = uGlobal.x;
    const breath = uGlobal.y;
    const splat = uGlobal.z;
    const boingZ = uGlobal.w;

    const waist = float(1.0).sub(clamp(abs(p.z).div(BALL_Z).mul(0.85), 0.0, 0.75));
    const latXY = float(1.0)
      .add(sq.mul(0.24).mul(float(0.55).add(waist.mul(0.68))))
      .add(splat.mul(0.32))
      .sub(boingZ.mul(0.028))
      .add(breath.mul(0.012));
    p.x.mulAssign(latXY);
    p.y.mulAssign(latXY);
    p.z.mulAssign(
      max(float(0.32), float(1.0).sub(sq.mul(0.36)).sub(splat.mul(0.42)).add(boingZ.mul(0.22)).sub(breath.mul(0.015)))
    );

    // Taffy-like elastic shear & whole-ball drag pull across the silicone sphere.
    const frontShear = clamp(pIn.z.div(BALL_Z), -1.0, 1.0);
    p.xy.addAssign(uDrag.mul(frontShear).mul(0.068));
    p.xy.addAssign(uDrag.mul(float(0.052).mul(float(1.0).sub(sAnalytic.mul(0.35)))));

    // 2. Deep palm/thumbprint bowl + fat donut ring + plump spherical cheek swell.
    // Evaluate rel & trailRel in resting coordinates (pIn.xy) so the crater,
    // shading nodes, and pointer raycast stay aligned to the exact same pixel.
    const dent = uHand.z;
    const rad = max(uHand.w, float(0.1));
    const rel = pIn.xy.sub(uHand.xy);
    const d = length(rel);
    const t = d.div(rad);
    const dir = rel.div(max(d, float(0.0005)));

    const innerBowl = cos(clamp(t.mul(1.38), 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.56, 0.78, t)));
    const outerBowl = cos(clamp(t, 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.84, 1.02, t)));
    const bowl = outerBowl.mul(0.62).add(innerBowl.mul(0.50));

    // Multiplicative spherical crush: front dome sinks deep toward ~40% core depth,
    // staying curved and smooth with zero self-intersection or back perforation.
    const trailRel = pIn.xy.sub(uTrail.xy);
    const trailT = length(trailRel).div(max(uTrail.w, float(0.1)));
    const trailBowl = cos(clamp(trailT, 0.0, 1.0).mul(3.14159265)).mul(0.5).add(0.5)
      .mul(float(1.0).sub(smoothstep(0.84, 1.02, trailT)));

    const sinkFrac = clamp(bowl.mul(dent).mul(0.50), 0.0, 0.82);
    const trailFrac = clamp(trailBowl.mul(uTrail.z).mul(0.24), 0.0, 0.52);
    const crush = max(sinkFrac, trailFrac).mul(domeMask);
    p.z.assign(mix(p.z, p.z.mul(0.38), frontFactor.mul(crush)));
    p.z.assign(mix(p.z, p.z.mul(float(1.0).sub(crush.mul(0.18))), float(1.0).sub(frontFactor)));

    // Gentle skin pinch tugs nearby dome softly toward the thumb trough without folding over letters.
    const pinchPull = smoothstep(0.08, 0.42, t).mul(float(1.0).sub(smoothstep(0.42, 0.92, t))).mul(domeMask);
    p.xy.subAssign(dir.mul(pinchPull).mul(min(dent, float(1.2))).mul(0.016));

    // Wide smooth extruded fat-rim around crater without seam discontinuity at equator.
    const rim = smoothstep(0.34, 1.15, t).mul(float(1.0).sub(smoothstep(1.15, 2.95, t)));
    const dragPush = max(float(0.0), dot(dir, uDrag)).mul(0.85);
    const dragBack = max(float(0.0), dot(dir, uDrag.negate())).mul(0.25);
    const ooze = clamp(float(1.0).add(dragPush).sub(dragBack), 0.68, 1.72);

    const zSign = clamp(pIn.z.div(0.14), -1.0, 1.0);
    p.z.addAssign(zSign.mul(rim).mul(dent).mul(0.095).mul(ooze).mul(rimMask));
    p.xy.addAssign(dir.mul(rim).mul(dent).mul(0.088).mul(ooze));

    // Monotonic spherical belly & cheek bloat when smashed down hard.
    const farWeight = smoothstep(0.38, 1.25, d);
    const edgeBelly = smoothstep(0.28, 1.0, sAnalytic);
    const nearGain = float(1.0).sub(smoothstep(0.15, 1.28, d));
    p.xy.addAssign(dir.mul(edgeBelly).mul(dent).mul(nearGain.mul(0.13).add(farWeight.mul(0.07))).mul(clamp(float(1.0).add(dragPush.mul(0.65)), 0.7, 1.72)));
    p.z.addAssign(zSign.mul(farWeight).mul(dent).mul(0.048).mul(rimMask));

    // Continuous peristaltic mochi churn while holding down: concentric waves keep radiating
    // outward from the thumb and speed up as pressure approaches 100%, so holding never feels static.
    const holdHeat = clamp(uFx.x, 0.0, 1.0);
    const holdWave = sin(uTime.mul(float(12.0).add(holdHeat.mul(15.0))).sub(d.mul(10.5)))
      .mul(smoothstep(0.10, 0.52, d))
      .mul(float(1.0).sub(smoothstep(0.85, 1.55, d)));
    const holdPulse = dent.mul(float(0.32).add(holdHeat.mul(0.88)));
    p.z.addAssign(zSign.mul(holdWave).mul(holdPulse).mul(0.034).mul(rimMask));
    p.xy.addAssign(dir.mul(holdWave).mul(holdPulse).mul(0.028));

    // 3D pudding bell-mode harmonic wobble: bottom flares while top narrows (and reverses on rebound).
    const jellyMode = uFx.w;
    const bellY = clamp(pIn.y.div(BALL_R), -1.0, 1.0);
    p.x.mulAssign(float(1.0).sub(jellyMode.mul(bellY).mul(0.13)));
    p.x.addAssign(sin(pIn.y.mul(5.2).add(uTime.mul(18.0))).mul(jellyMode).mul(0.032));

    // 4. Release / Splat dual-harmonic jelly wobble wave rippling across the ball.
    const restThickness = smoothstep(0.0, 0.25, abs(pIn.z));
    const ripRel = pIn.xy.sub(uRipple.xy);
    const ripD = length(ripRel);
    const ripAmp = uRipple.z;
    const ripPhase = uRipple.w;
    const wave1 = sin(ripPhase.sub(ripD.mul(8.6))).mul(exp(ripD.negate().mul(1.15)));
    const wave2 = sin(ripPhase.mul(1.65).sub(ripD.mul(13.5))).mul(exp(ripD.negate().mul(1.85))).mul(0.38);
    const wave = wave1.add(wave2);
    p.z.addAssign(wave.mul(ripAmp).mul(0.085).mul(restThickness));
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
    const aoAmt = min(float(1.0), coreCrater.mul(uHand.z).mul(0.58).add(trailMask.mul(uTrail.z).mul(0.18)));
    col.assign(mix(col, craterBerry, aoAmt));

    // Plump displaced donut ring catches warm creamy subsurface highlight (capped cleanly).
    const t = d.div(max(uHand.w, 0.1));
    const rimRing = smoothstep(0.56, 1.04, t).mul(float(1.0).sub(smoothstep(1.04, 1.98, t)));
    col.assign(mix(col, rimHighlight, rimRing.mul(min(float(1.0), uHand.z)).mul(0.16)));

    // Held pressure flushes the whole ball a juicier strawberry blush that throbs like a heartbeat,
    // and every tap flashes it creamy-bright for an instant.
    const heat = clamp(uFx.x, 0.0, 1.0);
    const blushHot = vec3(1.0, 0.56, 0.52);
    col.assign(mix(col, blushHot, heat.mul(heat).mul(0.34).mul(float(0.7).add(uFx.z.mul(0.3)))));
    col.assign(mix(col, vec3(1.0, 0.97, 0.94), clamp(uFx.y, 0.0, 1.0).mul(0.22)));
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
    const heatGlow = vec3(1.0, 0.42, 0.34).mul(
      uFx.x.mul(uFx.x).mul(float(0.10).add(fresnel.mul(0.30))).mul(float(0.55).add(uFx.z.mul(0.45)))
    );
    const tapGlow = vec3(1.0, 0.80, 0.66).mul(uFx.y.mul(float(0.06).add(fresnel.mul(0.42))));
    return sssBase.add(sssHot).add(splatGlow).add(heatGlow).add(tapGlow);
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
  let isGrabbed = false;
  let splatT = -1;
  let flightT = -1;
  let flightLanded = true;
  let releaseCooldown = 0;

  const raycaster = new THREE.Raycaster();
  const invGroupMat = new THREE.Matrix4();
  const localRayOrigin = new THREE.Vector3();
  const localRayDir = new THREE.Vector3();
  const localHit = new THREE.Vector3();

  const hand = new THREE.Vector2(0, 0);
  const trailHand = new THREE.Vector2(0, 0);
  const targetHand = new THREE.Vector2(0, 0);
  const lastHand = new THREE.Vector2(0, 0);
  const dragVec = new THREE.Vector2(0, 0);
  const tmpDragVec = new THREE.Vector2(0, 0);
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

  // Screen-plane jelly spring (+ = squashed wide & short, - = stretched tall & thin).
  // The camera looks down Z, so this is the wobble the eye actually reads as "Q弹".
  let jelly = 0;
  let jellyVel = 0;
  // Rapid-tap combo + held-squeeze heartbeat state.
  let combo = 0;
  let sinceRelease = 9;
  let holdT = 0;
  let holdPulseTick = 0;
  let flash = 0;

  // Soft 3D whole-cushion spring tilt when poking off-center or hovering.
  let tiltX = 0;
  let tiltY = 0;
  let tiltZ = 0;
  let tiltVX = 0;
  let tiltVY = 0;
  let tiltVZ = 0;

  const hud = { pressure: 0, phase: 'poke', pops: 0, pressing: false };

  function insideRatio(nx, ny) {
    const d = Math.hypot(nx, ny) - BALL_R;
    const t = Math.max(0, Math.min(1, (0.24 - d) / 0.36));
    return t * t * (3 - 2 * t);
  }

  function reset(clearPops = false) {
    pressure = 0;
    if (clearPops) pops = 0;
    phase = 'poke';
    wasDragging = false;
    isGrabbed = false;
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
    jelly = jellyVel = 0;
    combo = 0;
    sinceRelease = 9;
    holdT = 0;
    holdPulseTick = 0;
    flash = 0;
    uFx.value.set(0, 0, 0, 0);
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

  function fitViewport(visW, visH) {
    const targetDiameter = Math.min(visW * 0.58, visH * 0.43);
    setWorldScale(targetDiameter / (BALL_R * 2));
  }

  function update(dt, time, input, hooks = {}) {
    uTime.value = time;
    if (releaseCooldown > 0) releaseCooldown = Math.max(0, releaseCooldown - dt);

    // Analytic ray-ellipsoid intersection in group-local space maps cursor pixels directly
    // onto resting sphere coords (nx, ny) across curved cheeks, 3D tilt, squash, and bounce.
    group.updateMatrixWorld(true);
    const prevSplat = splatT >= 0
      ? Math.sin(Math.min(1, splatT / 0.45) * Math.PI) * Math.exp(-splatT * 2.4)
      : 0;
    const latFrontXY = Math.max(0.78, 1 + squash * 0.175 + prevSplat * 0.32 - boingZ * 0.028);
    const deformZScale = Math.max(0.32, 1 - Math.max(0, squash) * 0.36 - prevSplat * 0.42 + boingZ * 0.22);

    let nx;
    let ny;
    if (input.camera && input.ndc) {
      input.camera.updateMatrixWorld();
      raycaster.setFromCamera(input.ndc, input.camera);
      invGroupMat.copy(group.matrixWorld).invert();
      localRayOrigin.copy(raycaster.ray.origin).applyMatrix4(invGroupMat);
      localRayDir.copy(raycaster.ray.direction).transformDirection(invGroupMat);

      const sInv = 1 / Math.max(0.1, worldScale);
      const rx = BALL_R * latFrontXY;
      const ry = BALL_R * latFrontXY;
      const rz = BALL_Z * deformZScale;
      const ox = (localRayOrigin.x * sInv - dragVec.x * 0.085) / rx;
      const oy = (localRayOrigin.y * sInv - dragVec.y * 0.085) / ry;
      const oz = (localRayOrigin.z * sInv) / rz;
      const dx = localRayDir.x / rx;
      const dy = localRayDir.y / ry;
      const dz = localRayDir.z / rz;
      const a = dx * dx + dy * dy + dz * dz;
      const b = ox * dx + oy * dy + oz * dz;
      const c = ox * ox + oy * oy + oz * oz - 1;
      const disc = b * b - a * c;
      const hitT = a > 1e-6 ? (disc >= 0 ? (-b - Math.sqrt(disc)) / a : -b / a) : 0;
      nx = (ox + hitT * dx) * BALL_R;
      ny = (oy + hitT * dy) * BALL_R;
    } else {
      const ux = (input.pointer.x - group.position.x) / Math.max(0.1, worldScale);
      const uy = (input.pointer.y - group.position.y) / Math.max(0.1, worldScale);
      nx = (ux - dragVec.x * 0.085) / latFrontXY;
      ny = (uy - dragVec.y * 0.085) / latFrontXY;
    }

    const hoverGrip = insideRatio(nx, ny);
    const airborneSlip = flightT >= 0 && flightT < 0.44;
    if (!input.dragging || airborneSlip) {
      isGrabbed = false;
    } else if (!isGrabbed && hoverGrip > 0.08) {
      isGrabbed = true;
    }

    const activePress = input.dragging && !airborneSlip && isGrabbed;
    const grip = activePress ? Math.max(0.68, hoverGrip) : 0;

    if (activePress) {
      const nr = Math.hypot(nx, ny);
      const maxR = BALL_R * 0.90;
      if (nr > maxR && nr > 1e-5) {
        targetHand.set((nx / nr) * maxR, (ny / nr) * maxR);
      } else {
        targetHand.set(nx, ny);
      }
      const tugX = Math.max(-0.55, Math.min(0.55, nx - targetHand.x)) * 1.45;
      const tugY = Math.max(-0.55, Math.min(0.55, ny - targetHand.y)) * 1.45;
      if (!wasDragging) {
        hand.copy(targetHand);
        trailHand.copy(targetHand);
        lastHand.copy(targetHand);
        // Rapid taps chain into a combo: each quick re-press hits harder and wobbles wilder.
        combo = sinceRelease < 0.55 ? combo + 1 : 1;
        const c = Math.min(combo, 10);
        holdT = 0;
        holdPulseTick = 0;
        flash = Math.min(1, 0.55 + c * 0.05);
        // Immediate palm/thumb slam impulse + radial ripple + alternating pudding dance on combo!
        dentVel += (5.2 + c * 0.38) * grip;
        squashVel += (4.2 + c * 0.22) * grip;
        boingVel -= (2.2 + c * 0.25) * grip;
        jellyVel += (6.2 + c * 0.85) * (combo > 2 && combo % 2 === 0 ? -0.85 : 1);
        ripOrigin.copy(targetHand);
        ripAmp = Math.min(1.8, Math.max(ripAmp, 0.72 + c * 0.11));
        ripPhase = 0;
        if (!reduced) {
          const dirSign = combo % 2 === 0 ? 1 : -1;
          tiltVZ += dirSign * (0.35 + c * 0.20);
          popVX += dirSign * (0.22 + c * 0.07);
          popVY += 0.28 + c * 0.06;
        }
        // Tapping fast also charges the squish meter, so spamming is a real way to the pop.
        if (combo > 1) pressure = Math.min(0.995, pressure + 0.07 + c * 0.012);
        hooks.onPress?.(combo);
      } else {
        hand.lerp(targetHand, 1 - Math.exp(-38.0 * dt));
        // Soft-memory knead groove trails gently behind the dragging thumb.
        trailHand.lerp(hand, 1 - Math.exp(-6.8 * dt));
      }
      const stepDt = Math.max(dt, 0.01);
      const dx = (hand.x - lastHand.x) / stepDt;
      const dy = (hand.y - lastHand.y) / stepDt;
      lastHand.copy(hand);
      tmpDragVec.set(
        Math.max(-1.85, Math.min(1.85, dx * 0.56 + tugX)),
        Math.max(-1.85, Math.min(1.85, dy * 0.56 + tugY))
      );
      dragVec.lerp(tmpDragVec, 1 - Math.exp(-16.0 * dt));
    } else {
      dragVec.multiplyScalar(Math.exp(-6.5 * dt));
      if (wasDragging && flightT < 0) {
        // Charged mid-squish release REBOUND! Springs outward, hops opposite pinch, & jiggles back.
        const releaseEnergy = Math.max(0.14, dent * 0.72 + pressure * 0.90);
        const comboBoost = 1 + Math.min(combo, 10) * 0.09;
        boingVel += releaseEnergy * 9.6;
        dentVel -= releaseEnergy * 4.4;
        squashVel -= releaseEnergy * 2.2;
        // Snap from wide-squashed to tall-stretched, then jiggle back and forth like pudding.
        jellyVel -= (3.2 + releaseEnergy * 7.5) * comboBoost;
        if (!reduced) {
          popVY += releaseEnergy * 2.1 * comboBoost;
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
    if (activePress) {
      sinceRelease = 0;
      holdT += dt;
      holdPulseTick += dt * (2.1 + pressure * 3.2);
      if (holdPulseTick >= 1.0) {
        holdPulseTick -= 1.0;
        // Rhythmic heartbeat thump while holding: sends a fresh ripple & pudding pulse!
        jellyVel += (1.9 + pressure * 2.6) * (Math.random() > 0.5 ? 1 : -0.8);
        dentVel += 1.4 + pressure * 1.8;
        ripOrigin.copy(hand);
        ripAmp = Math.max(ripAmp, 0.48 + pressure * 0.65);
        ripPhase = 0;
        flash = Math.max(flash, 0.28 + pressure * 0.35);
        hooks.onHoldPulse?.(pressure);
      }
    } else {
      sinceRelease += dt;
      if (sinceRelease > 0.55) combo = 0;
    }

    // Purely visual pancake/glow decay timer; never locks out pressure once catchable.
    if (splatT >= 0) {
      splatT += dt;
      if (splatT > 1.15) {
        splatT = -1;
      }
    }

    // Pressure ramp for HUD beats + max-pressure "pop upward & drift home" climax.
    if (activePress) {
      const gain = 0.28 + (input.speed || 0) * 0.38;
      pressure = Math.min(1, pressure + gain * grip * dt);
      if (pressure >= 1) {
        pressure = 0;
        splatT = 0;
        flightT = 0;
        flightLanded = false;
        isGrabbed = false;
        pops++;
        releaseCooldown = 0.45;
        boingVel += 10.2;
        dentVel -= 5.8;
        squashVel -= 3.2;
        jellyVel -= 14.0;
        flash = 1;
        combo = 0;
        if (!reduced) {
          // Squeeze to the limit -> pops right UP below top controls, then drifts gently back!
          popVY = 2.35;
          popVX = -hand.x * 0.78;
          tiltVX += -2.2;
          tiltVZ += (-hand.x * 1.8 + (Math.random() - 0.5) * 1.2);
        }
        ripOrigin.copy(hand);
        ripAmp = 1.95;
        ripPhase = 0;
        hooks.onPop?.();
      }
    } else {
      // Mid-combo the meter barely leaks, so a fast tap streak genuinely climbs toward the pop.
      pressure = Math.max(0, pressure - (combo > 1 ? 0.12 : 0.58) * dt);
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

    // Held squeeze heartbeat: the longer & harder you hold, the faster and stronger the ball
    // throbs against your thumb, so a long press keeps building visibly toward the pop.
    const throbRate = 6.5 + pressure * 13.0;
    const throb = activePress && !reduced ? Math.sin(holdT * throbRate) : 0;
    const throb01 = throb * 0.5 + 0.5;
    const throbAmp = activePress ? 0.25 + pressure * 0.75 : 0;

    // Viscoelastic spring-mass physics: sinks deeply under touch, rebounds slowly like memory mochi then wobbles.
    const dentTarget = activePress ? ((1.12 + pressure * 0.68) * grip + throb * 0.11 * throbAmp) : 0;
    const dentK = activePress ? 145 : 92;
    const dentDamp = activePress ? 13.5 : 6.4;
    dentVel += ((dentTarget - dent) * dentK - dentVel * dentDamp) * dt;
    dent = Math.max(-0.28, dent + dentVel * dt);

    const trailTarget = activePress ? dent * 0.84 : 0;
    trailDent += (trailTarget - trailDent) * (1 - Math.exp((activePress ? -6.5 : -1.55) * dt));

    const sqTarget = activePress ? 0.58 + pressure * 0.88 + throb * 0.07 * throbAmp : 0;
    squashVel += ((sqTarget - squash) * 165 - squashVel * (activePress ? 10.5 : 8.2)) * dt;
    squash = Math.max(-0.14, squash + squashVel * dt);

    const boingDamp = activePress ? 14.0 : 4.6;
    const boingK = activePress ? 145 : 205;
    boingVel += (-boingZ * boingK - boingVel * boingDamp) * dt;
    boingZ += boingVel * dt;

    // Jelly: spreads wide under the thumb (more with pressure), then a lightly damped spring
    // on release so it overshoots tall, wide, tall... several visible wobbles before settling.
    const jellyTarget = activePress ? 0.22 + pressure * 0.10 + throb * 0.08 * throbAmp : 0;
    const jellyK = activePress ? 195 : 265;
    const jellyDamp = activePress ? 9.2 : 2.85;
    jellyVel += ((jellyTarget - jelly) * jellyK - jellyVel * jellyDamp) * dt;
    jelly = Math.max(-0.62, Math.min(0.88, jelly + jellyVel * dt));

    flash *= Math.exp(-5.5 * dt);

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
    // Near-pop tremble: past ~55% pressure the ball starts shivering under the thumb.
    const shiver = activePress && !reduced ? Math.max(0, pressure - 0.55) * 0.030 : 0;
    group.position.set(
      reduced ? 0 : (popX + Math.sin(time * 61.0) * shiver) * worldScale,
      reduced ? 0 : (popY + Math.cos(time * 53.0) * shiver) * worldScale,
      0
    );

    // 3D sphere tilt: pressing off-center rolls & tips the mochi ball physically.
    const clampedNx = Math.max(-BALL_R, Math.min(BALL_R, nx));
    const clampedNy = Math.max(-BALL_R, Math.min(BALL_R, ny));
    const targetTiltX = reduced ? 0 : (activePress
      ? -hand.y * (0.28 + dent * 0.12)
      : hoverGrip * -clampedNy * 0.08);
    const targetTiltY = reduced ? 0 : (activePress
      ? hand.x * (0.28 + dent * 0.12)
      : hoverGrip * clampedNx * 0.08);
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
      const stretchZ = Math.max(0.72, Math.min(1.34, 1 + boingZ * 0.22 - splatAmt * 0.20));
      const invXY = 1 / Math.sqrt(stretchZ);
      const jx = 1 + jelly * 0.21;
      const jy = 1 - jelly * 0.18;
      group.scale.set(
        invXY * jx * (1 - flightStretch * 0.42),
        invXY * jy * (1 + flightStretch + splatAmt * 0.04),
        stretchZ
      );
    }

    uHand.value.set(hand.x, hand.y, Math.max(0, dent), PRESS_RADIUS);
    uTrail.value.set(trailHand.x, trailHand.y, Math.max(0, trailDent), TRAIL_RADIUS);
    uDrag.value.copy(dragVec);
    uGlobal.value.set(Math.max(-0.14, squash), idleBreath, splatAmt, reduced ? 0 : boingZ);
    uRipple.value.set(ripOrigin.x, ripOrigin.y, reduced ? 0 : ripAmp, ripPhase);
    uFx.value.set(activePress ? pressure : pressure * 0.6, flash, throb01, reduced ? 0 : jelly);

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
      combo,
      throb: activePress ? throb01 * throbAmp : 0,
    };
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { group, hud, reset, setWorldScale, fitViewport, update, dispose };
}

/* ================================================================== */
/* Welded-Manifold Silicone Mochi Sphere + Crisp Puffy SKAND Relief   */
/* ================================================================== */

function buildSiliconeSphereGeometry() {
  const maskSize = 640;
  const reliefField = buildReliefHeightField(maskSize, maskSize);

  const n = 152;
  const row = n + 1;
  const gridVertCount = row * row;
  const vertices = [];
  const uvs = [];
  const reliefs = [];
  const shellSs = [];
  const indices = [];

  function mapToUnitDisk(u, v) {
    const xd = u * Math.sqrt(Math.max(0, 1 - v * v * 0.5));
    const yd = v * Math.sqrt(Math.max(0, 1 - u * u * 0.5));
    const s = Math.min(1, Math.hypot(xd, yd));
    const ux = s > 1e-6 ? xd / s : 0;
    const uy = s > 1e-6 ? yd / s : 0;
    return { ux, uy, s };
  }

  function sampleRelief(x, y) {
    const fx = ((x / BALL_R) * 0.5 + 0.5) * (maskSize - 1);
    const fy = (0.5 - (y / BALL_R) * 0.5) * (maskSize - 1);
    const ix = Math.max(0, Math.min(maskSize - 2, Math.floor(fx)));
    const iy = Math.max(0, Math.min(maskSize - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - ix));
    const ty = Math.max(0, Math.min(1, fy - iy));
    const i00 = iy * maskSize + ix;
    const i10 = i00 + 1;
    const i01 = i00 + maskSize;
    const i11 = i01 + 1;
    const a = reliefField[i00] * (1 - tx) + reliefField[i10] * tx;
    const b = reliefField[i01] * (1 - tx) + reliefField[i11] * tx;
    return a * (1 - ty) + b * ty;
  }

  function pushGridVertices(zSign, reliefAmp) {
    for (let j = 0; j <= n; j++) {
      const v = (j / n) * 2 - 1;
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1;
        const { ux, uy, s } = mapToUnitDisk(u, v);
        // Constant-arc-length spherical dome mapping so poles & equator share uniform quad density.
        const theta = s * (Math.PI * 0.5);
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        const baseX = BALL_R * sinT * ux;
        const baseY = BALL_R * sinT * uy;
        const baseZ = zSign * BALL_Z * cosT;

        const r = zSign > 0 ? sampleRelief(baseX, baseY) : 0;
        const fade = smoothstepScalar(0.95, 0.72, s);
        const amp = reliefAmp * r * fade;
        const nxNorm = sinT * ux;
        const nyNorm = sinT * uy;
        const nzNorm = zSign * cosT;

        vertices.push(baseX + nxNorm * amp, baseY + nyNorm * amp, baseZ + nzNorm * amp);
        uvs.push(u * 0.5 + 0.5, v * 0.5 + 0.5);
        reliefs.push(r);
        shellSs.push(s);
      }
    }
  }

  pushGridVertices(1, 0.044);
  pushGridVertices(-1, 0.0);

  function vid(isBack, i, j) {
    const isBoundary = i === 0 || i === n || j === 0 || j === n;
    const base = (!isBack || isBoundary) ? 0 : gridVertCount;
    return base + j * row + i;
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = vid(false, i, j);
      const b = vid(false, i + 1, j);
      const c = vid(false, i, j + 1);
      const d = vid(false, i + 1, j + 1);
      indices.push(a, b, d, a, d, c);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
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

  const pxPerNorm = w / (BALL_R * 2);

  // Subtle circular piping ring framing the embossed mark on the front dome.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.040 * pxPerNorm;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 0.57 * pxPerNorm, 0, Math.PI * 2);
  ctx.stroke();

  // Draw bold Outfit 800 SKAND letters cleanly centered inside the sphere badge.
  const fontPx = Math.round(0.22 * pxPerNorm);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${fontPx}px Outfit, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const span = 0.78 * pxPerNorm;
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
  field = boxBlur(field, w, h, 3);
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
