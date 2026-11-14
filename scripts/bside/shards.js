/**
 * SKAND B-Side — 3D Voronoi Cut-Crystal Glass Shards (Three.js r187 WebGPU + TSL).
 *
 * Fractures the true SKAND lockup (rounded frame + Outfit 800 wordmark) into
 * hundreds of interlocking 3D faceted crystal prisms with angled bevels.
 *
 *   • Gather mode  — shards drift weightlessly in 3D orbital space, swirl into
 *                    magnetic alignment as charge builds, and lock together into
 *                    a single refractive, dispersive glass mark on Ignite.
 *   • Squeeze mode — shards flex and dent under the fingertip bowl, glow with
 *                    molten coral-gold fracture energy along seams as pressure
 *                    rises, shatter violently in 3D on Pop, and re-assemble.
 */

import * as THREE from 'https://esm.sh/three@0.187.0/webgpu';
import {
  Fn,
  If,
  attribute,
  uniform,
  float,
  vec3,
  vec4,
  sin,
  cos,
  pow,
  abs,
  max,
  min,
  mix,
  clamp,
  smoothstep,
  length,
  distance,
  normalize,
  dot,
  cross,
  positionLocal,
  normalLocal,
  normalView,
  positionViewDirection,
  transformNormalToView,
} from 'https://esm.sh/three@0.187.0/tsl';
import { LETTERS } from './config.js?v=20261115';

// Normalized logo proportions — kept identical to targets.js so glass shards
// and GPU stardust particles align seamlessly.
const FRAME_W = 2.0;
const FRAME_H = 0.8;
const FRAME_R = 0.13;
const FRAME_T = 0.056;
const FRAME_INSET = 0.085;

/**
 * Create the 3D faceted glass shard system.
 * @param {object} opts { shardCount, worldScale, bounds, reduced }
 */
export function createGlassShards({ shardCount = 520, worldScale = 2.8, bounds = 6.5, reduced = false } = {}) {
  const geometry = buildVoronoiShardGeometry(shardCount, bounds);

  /* --- Shared Uniforms --- */
  const uTime = uniform(0);
  const uMorph = uniform(0);
  const uChaos = uniform(1);
  const uImpulse = uniform(0);
  const uIgnite = uniform(0);
  const uSqueeze = uniform(0);
  const uShatter = uniform(0);
  const uSqueezeMode = uniform(0);
  const uRevealed = uniform(0);
  const uModeMix = uniform(0);
  const uWorldScale = uniform(worldScale);
  const uPointer = uniform(new THREE.Vector3(0, 0, 0));
  const uPointerForce = uniform(0);
  const uPress = uniform(new THREE.Vector3(0, 0, 0));
  const uPressRadius = uniform(1.0);
  const uReduced = uniform(reduced ? 1 : 0);

  /* --- Per-Vertex Shard Attributes --- */
  const aHome = attribute('aHome', 'vec3');       // xyz: normalized logo centroid
  const aScatter = attribute('aScatter', 'vec3'); // xyz: orbital cloud position
  const aAxis = attribute('aAxis', 'vec3');       // xyz: normalized tumble axis
  const aMeta = attribute('aMeta', 'vec4');       // x: seed, y: group (0=frame, 1=letter), z: stagger, w: letterIdx

  /* --- Rodrigues Rotation Helper in TSL --- */
  const rotateAroundAxis = Fn(([v, axis, angle]) => {
    const c = cos(angle);
    const s = sin(angle);
    const k = axis;
    return v.mul(c)
      .add(cross(k, v).mul(s))
      .add(k.mul(dot(k, v)).mul(float(1.0).sub(c)));
  });

  /* --- Shared Shard Kinematics (plain JS node-builder called inside Fn) --- */
  function computeShardMotion() {
    const seed = aMeta.x;
    const group = aMeta.y;
    const stagger = aMeta.z;

    // Frame locks slightly ahead of the inner letters, matching targets.js rhythm.
    const groupDelay = group.mul(0.24);
    const mRaw = clamp(uMorph.sub(groupDelay).sub(stagger.mul(0.28)).div(0.48), 0.0, 1.0);
    const m = mRaw.mul(mRaw).mul(float(3.0).sub(mRaw.mul(2.0)));

    const homePos = aHome.mul(uWorldScale);

    // Weightless orbital drift while scattered.
    const t = uTime.mul(float(0.32).add(seed.mul(0.25))).add(seed.mul(6.2831));
    const motionScale = float(1.0).sub(uReduced.mul(0.8));
    const drift = vec3(
      sin(t.mul(0.9).add(seed.mul(9.0))).mul(0.42),
      cos(t.mul(0.75).add(seed.mul(13.0))).mul(0.34),
      sin(t.mul(0.6).add(seed.mul(19.0))).mul(0.45)
    ).mul(motionScale);

    const scatterPos = aScatter.add(drift).toVar();

    // Subtle pointer pull / wake while gathering in chaos.
    const toPtr = uPointer.sub(scatterPos);
    const ptrDist = length(toPtr);
    const pullMask = smoothstep(5.5, 0.2, ptrDist).mul(float(1.0).sub(m));
    const ptrPull = clamp(uPointerForce, -2.0, 6.0).mul(0.08).mul(pullMask);
    scatterPos.addAssign(toPtr.mul(ptrPull));

    // Helical swirl arc during assembly so shards glide gracefully into place.
    const arc = sin(m.mul(3.14159265)).mul(float(1.0).sub(uSqueezeMode));
    const swirl = vec3(
      cos(seed.mul(12.56).add(m.mul(4.2))).mul(0.55),
      sin(seed.mul(12.56).add(m.mul(4.2))).mul(0.42),
      float(0.45).add(seed.mul(0.85))
    ).mul(arc).mul(motionScale);

    const shardPos = mix(scatterPos, homePos, m).add(swirl).toVar();

    // Gentle living breathing ripple once assembled in Gather mode.
    const idleFloat = sin(uTime.mul(1.35).add(aHome.x.mul(3.4)).add(seed.mul(6.28)))
      .mul(0.024)
      .mul(m)
      .mul(float(1.0).sub(uSqueezeMode))
      .mul(motionScale);
    shardPos.z.addAssign(idleFloat);

    // Tactile hover ripple over assembled glass in Gather mode.
    const hoverDelta = shardPos.sub(uPointer);
    const hoverDist = length(hoverDelta.xy);
    const hoverRadius = uWorldScale.mul(0.42);
    const hoverMask = smoothstep(hoverRadius, 0.0, hoverDist)
      .mul(uRevealed)
      .mul(float(1.0).sub(uSqueezeMode))
      .mul(m);
    shardPos.z.addAssign(hoverMask.mul(0.24));

    // Squeeze mode: global anisotropic compression, widening cracks & strain quiver.
    If(uSqueeze.greaterThan(0.001), () => {
      const sq = shardPos.toVar();
      sq.x.mulAssign(float(1.0).sub(uSqueeze.mul(0.12)));
      sq.y.mulAssign(float(1.0).add(uSqueeze.mul(0.15)));
      sq.z.mulAssign(float(1.0).add(uSqueeze.mul(0.18)));
      const s2 = uSqueeze.mul(uSqueeze);
      sq.x.addAssign(sin(uTime.mul(31.0).add(seed.mul(17.0))).mul(0.025).mul(s2).mul(motionScale));
      sq.y.addAssign(cos(uTime.mul(37.0).add(seed.mul(23.0))).mul(0.028).mul(s2).mul(motionScale));
      sq.z.addAssign(sin(uTime.mul(29.0).add(seed.mul(11.0))).mul(0.045).mul(s2).mul(motionScale));
      shardPos.assign(mix(shardPos, sq, m));
    });

    // Squeeze mode: fingertip contact dent + outer rim bulge.
    If(uPress.z.greaterThan(0.001), () => {
      const rel = shardPos.xy.sub(uPress.xy);
      const d = length(rel);
      const nt = d.div(max(uPressRadius, 0.001));
      If(nt.lessThan(2.0), () => {
        const k = uPress.z.mul(m);
        const bowl = float(0.0).toVar();
        If(nt.lessThan(1.0), () => {
          bowl.assign(float(0.5).add(float(0.5).mul(cos(nt.mul(3.14159265)))));
        });
        const rim = smoothstep(0.85, 1.15, nt).mul(float(1.0).sub(smoothstep(1.15, 2.0, nt)));
        const dir2 = rel.div(max(d, 0.001));
        shardPos.x.addAssign(dir2.x.mul(rim.mul(0.14).sub(bowl.mul(0.12))).mul(uPressRadius).mul(k));
        shardPos.y.addAssign(dir2.y.mul(rim.mul(0.14).sub(bowl.mul(0.12))).mul(uPressRadius).mul(k));
        shardPos.z.addAssign(rim.mul(0.22).sub(bowl.mul(0.55)).mul(k));
      });
    });

    // Squeeze mode: 3D violent shatter explosion & mid-air crystal suspension.
    const burst = clamp(uShatter, 0.0, 1.0);
    If(burst.greaterThan(0.001), () => {
      const outDir = normalize(vec3(
        aHome.x.add((seed.sub(0.5)).mul(0.55)),
        aHome.y.add((stagger.sub(0.5)).mul(0.55)),
        float(0.35).add(seed.mul(0.95))
      ));
      const speed = float(2.2).add(seed.mul(3.4));
      shardPos.addAssign(outDir.mul(burst).mul(speed));
    });

    // Tumble rotation angle: spins gently in chaos, locks cleanly to 0 at assembly,
    // tilts subtly on hover or strain, and tumbles wildly on shatter.
    const chaosAngle = uTime.mul(float(0.45).add(seed.mul(0.65))).add(seed.mul(6.2831));
    const scatterRot = chaosAngle.mul(float(1.0).sub(m)).mul(motionScale);
    const hoverTilt = hoverMask.mul(0.45);
    const squeezeTilt = uSqueeze.mul(seed.sub(0.5)).mul(0.55).mul(m);
    const shatterRot = burst.mul(float(4.5).add(seed.mul(8.5))).mul(motionScale);
    const angle = scatterRot.add(hoverTilt).add(squeezeTilt).add(shatterRot);

    // Shard scale: slightly larger jewel presence while drifting/shattering, exact lock when assembled.
    const shardScale = uWorldScale
      .mul(mix(1.24, 1.0, m))
      .mul(float(1.0).sub(uSqueeze.mul(0.05).mul(m)))
      .mul(float(1.0).add(uIgnite.mul(0.04)));

    return { shardPos, angle, shardScale, m };
  }

  /* --- Glass Material (MeshPhysicalNodeMaterial) --- */
  const material = new THREE.MeshPhysicalNodeMaterial({
    color: 0xf4f9ff,
    roughness: 0.04,
    metalness: 0.06,
    transmission: 0.86,
    ior: 1.56,
    dispersion: 0.95,
    thickness: 0.65,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    iridescence: 1.0,
    iridescenceIOR: 1.42,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 560,
    envMapIntensity: 2.8,
    attenuationColor: new THREE.Color(0xc7e0ff),
    attenuationDistance: 1.6,
    side: THREE.DoubleSide,
  });

  material.positionNode = Fn(() => {
    const motion = computeShardMotion();
    const localScaled = positionLocal.mul(motion.shardScale);
    const rotated = rotateAroundAxis(localScaled, aAxis, motion.angle);
    return motion.shardPos.add(rotated);
  })();

  material.normalNode = Fn(() => {
    const motion = computeShardMotion();
    const rotN = normalize(rotateAroundAxis(normalLocal, aAxis, motion.angle));
    return normalize(transformNormalToView(rotN));
  })();

  // Subtle per-shard optical crystal tint (ice quartz, lavender, champagne, rose-coral).
  material.colorNode = Fn(() => {
    const seed = aMeta.x;
    const group = aMeta.y;
    const ice = vec3(0.92, 0.96, 1.0);
    const lavender = vec3(0.86, 0.86, 1.0);
    const roseGold = vec3(1.0, 0.88, 0.85);
    const opalAqua = vec3(0.82, 0.98, 0.96);

    const gatherTint = mix(ice, mix(lavender, roseGold, smoothstep(0.65, 0.98, seed)), smoothstep(0.25, 0.85, seed));
    const squeezeTint = mix(opalAqua, mix(roseGold, lavender, seed), smoothstep(0.3, 0.9, seed));
    const tint = mix(gatherTint, squeezeTint, uModeMix).toVar();

    // Frame shards get a cool smoky-quartz contrast so the inner wordmark pops.
    tint.assign(mix(tint.mul(vec3(0.86, 0.90, 0.98)), tint, group));
    return tint;
  })();

  // Luminous edge fresnel, assembly wave, ignition sheen & molten squeeze fracture glow.
  material.emissiveNode = Fn(() => {
    const seed = aMeta.x;
    const group = aMeta.y;
    const motion = computeShardMotion();
    const V = normalize(positionViewDirection);
    const N = normalize(normalView);
    const fresnel = pow(float(1.0).sub(clamp(abs(dot(N, V)), 0.0, 1.0)), 2.8);

    // Rainbow thin-film prism dispersion across crystal bevels + mode accent rim.
    const specPhase = fresnel.mul(5.2).add(seed.mul(6.2831)).add(uTime.mul(0.45));
    const prismSpectrum = vec3(
      cos(specPhase).mul(0.5).add(0.5),
      cos(specPhase.add(2.0944)).mul(0.5).add(0.5),
      cos(specPhase.add(4.1888)).mul(0.5).add(0.5)
    );
    const rimGather = mix(vec3(0.32, 0.72, 1.0), vec3(1.0, 0.56, 0.45), seed);
    const rimSqueeze = mix(vec3(0.28, 0.94, 0.92), vec3(1.0, 0.38, 0.32), seed);
    const rimCol = mix(mix(rimGather, rimSqueeze, uModeMix), prismSpectrum, 0.48);

    const scatterGlint = float(1.0).sub(motion.m).mul(0.38);
    const out = rimCol.mul(fresnel).mul(float(0.62).add(motion.m.mul(0.24)).add(scatterGlint)).toVar();

    // Traveling light pulse sweeping across the glass mark as it converges.
    const sweep = sin(aHome.x.mul(4.5).sub(uTime.mul(2.8)).add(aHome.y.mul(2.0)));
    const pulse = smoothstep(0.74, 1.0, sweep).mul(motion.m);
    const waveCol = mix(vec3(0.95, 0.55, 0.35), vec3(1.0, 0.88, 0.65), seed);
    out.addAssign(waveCol.mul(pulse).mul(float(0.24).add(uIgnite.mul(0.45))).mul(float(1.0).sub(uSqueezeMode.mul(0.5))));

    // Frame gets a subtle rose-coral edge glow when assembled.
    out.addAssign(vec3(0.91, 0.34, 0.23).mul(fresnel).mul(float(1.0).sub(group)).mul(motion.m).mul(0.32));

    // Gather Ignite flash across all crystal facets.
    out.addAssign(vec3(1.0, 0.86, 0.68).mul(uIgnite).mul(float(0.32).add(fresnel.mul(0.95))));

    // Squeeze mode: molten coral-gold heat beneath the fingertip & along straining fractures.
    If(uSqueezeMode.greaterThan(0.01), () => {
      const shardWorld = aHome.mul(uWorldScale);
      const pressHot = float(0.0).toVar();
      If(uPress.z.greaterThan(0.001), () => {
        pressHot.assign(
          uPress.z.mul(float(1.0).sub(smoothstep(uPressRadius.mul(0.15), uPressRadius.mul(1.25), distance(shardWorld.xy, uPress.xy))))
        );
      });
      const strainGlow = uSqueeze.mul(uSqueeze).mul(float(0.35).add(fresnel.mul(1.15)));
      const fractureHeat = vec3(1.0, 0.44, 0.22).mul(strainGlow).add(vec3(1.0, 0.82, 0.52).mul(pressHot).mul(0.75));
      out.addAssign(fractureHeat);

      // Pop flash on the flying shards.
      out.addAssign(vec3(1.0, 0.55, 0.32).mul(uImpulse).mul(float(0.4).add(fresnel.mul(1.2))));
    });

    return out;
  })();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;

  function setState(s = {}) {
    if (s.morph !== undefined) uMorph.value = s.morph;
    if (s.chaos !== undefined) uChaos.value = s.chaos;
    if (s.impulse !== undefined) uImpulse.value = s.impulse;
    if (s.ignite !== undefined) uIgnite.value = s.ignite;
    if (s.squeeze !== undefined) uSqueeze.value = s.squeeze;
    if (s.shatter !== undefined) uShatter.value = s.shatter;
    if (s.squeezeMode !== undefined) uSqueezeMode.value = s.squeezeMode ? 1 : 0;
    if (s.modeMix !== undefined) uModeMix.value = s.modeMix;
    if (s.revealed !== undefined) uRevealed.value = s.revealed ? 1 : 0;
    if (s.pointerForce !== undefined) uPointerForce.value = s.pointerForce;
    if (s.pointer) uPointer.value.copy(s.pointer);
    if (s.press) {
      uPress.value.set(s.press.x, s.press.y, s.press.strength);
    } else {
      uPress.value.set(0, 0, 0);
    }
    if (s.pressRadius !== undefined) uPressRadius.value = s.pressRadius;
  }

  function update(_dt, time) {
    uTime.value = time;
  }

  function setWorldScale(v) {
    uWorldScale.value = v;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { mesh, setState, update, setWorldScale, dispose };
}

/* ================================================================== */
/* Procedural Voronoi Cut-Crystal Shard Geometry Builder              */
/* ================================================================== */

function buildVoronoiShardGeometry(totalTargetShards, bounds) {
  const maskW = 960;
  const maskH = 384;
  const { letterAlpha, letterIndexMap, normToPx, pxToNorm } = rasterizeMarkMasks(maskW, maskH);

  // Sample seeds for frame and Outfit 800 letters.
  const frameTarget = Math.max(44, Math.round(totalTargetShards * 0.20));
  const letterTarget = Math.max(120, totalTargetShards - frameTarget);

  const shards = [];

  // 1. Frame: irregular organically-fractured glass prism bars along the rounded rect.
  buildFrameShards(frameTarget, shards);

  // 2. Letters: crisp high-res Voronoi crystal cells inside the Outfit 800 wordmark.
  const letterSeeds = sampleMaskSeeds(letterAlpha, letterIndexMap, maskW, maskH, pxToNorm, letterTarget);
  buildCellsForGroup({
    seeds: letterSeeds,
    group: 1,
    maxR: 0.064,
    seamGap: 0.00045,
    isInMask: (nx, ny) => sampleAlpha(letterAlpha, maskW, maskH, normToPx(nx, ny)) > 110,
    out: shards,
  });

  // Extrude each polygon into a sharp 3D beveled crystal prism.
  const posArr = [];
  const normArr = [];
  const homeArr = [];
  const scatterArr = [];
  const axisArr = [];
  const metaArr = [];

  const golden = 0.61803398875;
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fNorm = new THREE.Vector3();

  function pushTri(ax, ay, az, bx, by, bz, cx, cy, cz, home, scatter, axis, meta) {
    vA.set(ax, ay, az);
    vB.set(bx, by, bz);
    vC.set(cx, cy, cz);
    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    fNorm.crossVectors(e1, e2);
    const len = fNorm.length();
    if (len < 1e-7) return;
    fNorm.divideScalar(len);

    const verts = [vA, vB, vC];
    for (let i = 0; i < 3; i++) {
      posArr.push(verts[i].x, verts[i].y, verts[i].z);
      normArr.push(fNorm.x, fNorm.y, fNorm.z);
      homeArr.push(home[0], home[1], home[2]);
      scatterArr.push(scatter[0], scatter[1], scatter[2]);
      axisArr.push(axis[0], axis[1], axis[2]);
      metaArr.push(meta[0], meta[1], meta[2], meta[3]);
    }
  }

  for (let sIdx = 0; sIdx < shards.length; sIdx++) {
    const sh = shards[sIdx];
    const poly = sh.poly;
    const n = poly.length;
    if (n < 3) continue;

    const cx = sh.cx;
    const cy = sh.cy;
    const seed = ((sIdx * golden) % 1);
    const rnd1 = Math.abs(Math.sin(sIdx * 12.9898 + 1.23)) % 1;
    const rnd2 = Math.abs(Math.sin(sIdx * 78.233 + 4.56)) % 1;
    const rnd3 = Math.abs(Math.sin(sIdx * 37.719 + 7.89)) % 1;

    const halfDepth = 0.022 + rnd1 * 0.018;
    const backDepth = halfDepth * (0.78 + rnd2 * 0.25);
    const tiltX = (rnd2 - 0.5) * 0.22;
    const tiltY = (rnd3 - 0.5) * 0.22;

    // Scatter position in 3D dreamy orbital halo around the viewer.
    const ang = rnd1 * Math.PI * 2;
    const rad = (0.35 + Math.pow(rnd2, 0.65) * 0.85) * bounds;
    const sx = Math.cos(ang) * rad * 1.15;
    const sy = Math.sin(ang) * rad * 0.72 + (rnd3 - 0.5) * 1.6;
    const sz = (rnd3 - 0.5) * bounds * 1.15 - 0.5;

    // Normalized random rotation axis.
    let ax = rnd1 - 0.5;
    let ay = rnd2 - 0.5;
    let az = rnd3 - 0.5;
    const alen = Math.hypot(ax, ay, az) || 1;
    ax /= alen; ay /= alen; az /= alen;

    const zRelief = (rnd1 - 0.5) * 0.014;
    const home = [cx, cy, zRelief];
    const scatter = [sx, sy, sz];
    const axis = [ax, ay, az];
    const meta = [seed, sh.group, rnd2, sh.letterIdx];

    // Local coordinates around shard centroid (cx, cy).
    const outer = [];
    const front = [];
    const back = [];
    for (let i = 0; i < n; i++) {
      const dx = poly[i].x - cx;
      const dy = poly[i].y - cy;
      outer.push([dx, dy, 0]);
      const fz = halfDepth + dx * tiltX + dy * tiltY;
      const bz = -backDepth - dx * tiltX * 0.5 - dy * tiltY * 0.5;
      front.push([dx * 0.85, dy * 0.85, fz]);
      back.push([dx * 0.86, dy * 0.86, bz]);
    }

    // Center apexes for faceted crystal front & back caps.
    const frontCenterZ = halfDepth * (1.06 + rnd3 * 0.15);
    const backCenterZ = -backDepth * 1.04;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const o0 = outer[i], o1 = outer[j];
      const f0 = front[i], f1 = front[j];
      const b0 = back[i], b1 = back[j];

      // Front faceted crystal cap (triangle fan around elevated crystal apex).
      pushTri(0, 0, frontCenterZ, f0[0], f0[1], f0[2], f1[0], f1[1], f1[2], home, scatter, axis, meta);
      // Front angled bevel quad (2 triangles).
      pushTri(f0[0], f0[1], f0[2], o0[0], o0[1], o0[2], o1[0], o1[1], o1[2], home, scatter, axis, meta);
      pushTri(f0[0], f0[1], f0[2], o1[0], o1[1], o1[2], f1[0], f1[1], f1[2], home, scatter, axis, meta);
      // Back angled bevel quad (2 triangles).
      pushTri(o0[0], o0[1], o0[2], b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], home, scatter, axis, meta);
      pushTri(o0[0], o0[1], o0[2], b1[0], b1[1], b1[2], o1[0], o1[1], o1[2], home, scatter, axis, meta);
      // Back crystal cap.
      pushTri(0, 0, backCenterZ, b1[0], b1[1], b1[2], b0[0], b0[1], b0[2], home, scatter, axis, meta);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  geo.setAttribute('aHome', new THREE.Float32BufferAttribute(homeArr, 3));
  geo.setAttribute('aScatter', new THREE.Float32BufferAttribute(scatterArr, 3));
  geo.setAttribute('aAxis', new THREE.Float32BufferAttribute(axisArr, 3));
  geo.setAttribute('aMeta', new THREE.Float32BufferAttribute(metaArr, 4));
  geo.computeBoundingSphere();
  return geo;
}

/* ---------- 2D Mark Rasterization ---------- */

function rasterizeMarkMasks(w, h) {
  // 1. Frame mask in normalized [-1, 1] x [-0.4, 0.4] -> [0..w, 0..h]
  const fc = document.createElement('canvas');
  fc.width = w;
  fc.height = h;
  const fctx = fc.getContext('2d', { willReadFrequently: true });
  const scaleX = w / FRAME_W;
  const scaleY = h / FRAME_H;
  const insetPx = 6;
  const rw = w - insetPx * 2;
  const rh = h - insetPx * 2;
  const rr = FRAME_R * scaleX;
  const lw = Math.max(4, FRAME_T * scaleX);

  fctx.strokeStyle = '#fff';
  fctx.lineWidth = lw;
  roundRectPath(fctx, insetPx + lw * 0.5, insetPx + lw * 0.5, rw - lw, rh - lw, rr);
  fctx.stroke();
  const frameImg = fctx.getImageData(0, 0, w, h).data;
  const frameAlpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) frameAlpha[i] = frameImg[i * 4 + 3];

  // 2. Outfit 800 "SKAND" letters mask, measured & mapped cleanly inside frame interior.
  const lc = document.createElement('canvas');
  lc.width = w;
  lc.height = h;
  const lctx = lc.getContext('2d', { willReadFrequently: true });

  const fontPx = 280;
  const tracking = fontPx * 0.1;
  const font = `800 ${fontPx}px Outfit, "Helvetica Neue", sans-serif`;

  const mc = document.createElement('canvas').getContext('2d');
  mc.font = font;
  try { mc.letterSpacing = tracking + 'px'; } catch (_) { /* older Safari */ }
  const widths = LETTERS.map((ch) => mc.measureText(ch).width);
  const totalW = widths.reduce((s, v) => s + v, 0) + tracking * (LETTERS.length - 1);

  const pad = Math.ceil(fontPx * 0.35);
  const tmpC = document.createElement('canvas');
  tmpC.width = Math.ceil(totalW + pad * 2);
  tmpC.height = Math.ceil(fontPx * 1.4 + pad * 2);
  const tctx = tmpC.getContext('2d', { willReadFrequently: true });
  tctx.font = font;
  try { tctx.letterSpacing = tracking + 'px'; } catch (_) { /* noop */ }
  tctx.textBaseline = 'alphabetic';
  tctx.fillStyle = '#fff';

  let penX = pad;
  const baseline = Math.round(tmpC.height * 0.5 + fontPx * 0.35);
  const glyphSpans = [];
  LETTERS.forEach((ch, idx) => {
    glyphSpans.push([penX, penX + widths[idx]]);
    tctx.fillText(ch, penX, baseline);
    penX += widths[idx] + tracking;
  });

  const tImg = tctx.getImageData(0, 0, tmpC.width, tmpC.height).data;
  let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
  for (let y = 0; y < tmpC.height; y++) {
    for (let x = 0; x < tmpC.width; x++) {
      if (tImg[(y * tmpC.width + x) * 4 + 3] > 40) {
        if (x < ix0) ix0 = x;
        if (x > ix1) ix1 = x;
        if (y < iy0) iy0 = y;
        if (y > iy1) iy1 = y;
      }
    }
  }
  if (ix0 === Infinity) {
    ix0 = pad; ix1 = pad + totalW;
    iy0 = baseline - fontPx * 0.7; iy1 = baseline;
  }

  const boxW = FRAME_W - FRAME_INSET * 2;
  const boxH = FRAME_H - FRAME_INSET * 2;
  const inkW = Math.max(1, ix1 - ix0);
  const inkH = Math.max(1, iy1 - iy0);
  const fit = Math.min(boxW / inkW, boxH / inkH);
  const inkCX = (ix0 + ix1) / 2;
  const inkCY = (iy0 + iy1) / 2;

  const letterAlpha = new Uint8Array(w * h);
  const letterIndexMap = new Int8Array(w * h);
  letterIndexMap.fill(-1);

  for (let py = 0; py < h; py++) {
    const ny = (0.5 - (py + 0.5) / h) * FRAME_H;
    const srcY = Math.round(inkCY - ny / fit);
    if (srcY < 0 || srcY >= tmpC.height) continue;
    for (let px = 0; px < w; px++) {
      const nx = ((px + 0.5) / w - 0.5) * FRAME_W;
      const srcX = Math.round(inkCX + nx / fit);
      if (srcX < 0 || srcX >= tmpC.width) continue;
      const a = tImg[(srcY * tmpC.width + srcX) * 4 + 3];
      const dstIdx = py * w + px;
      letterAlpha[dstIdx] = a;
      if (a > 40) {
        let li = 0;
        for (let k = glyphSpans.length - 1; k >= 0; k--) {
          if (srcX >= glyphSpans[k][0]) { li = k; break; }
        }
        letterIndexMap[dstIdx] = li;
      }
    }
  }
  void lctx;

  const normToPx = (nx, ny) => [
    (nx / FRAME_W + 0.5) * w,
    (0.5 - ny / FRAME_H) * h,
  ];
  const pxToNorm = (px, py) => [
    (px / w - 0.5) * FRAME_W,
    (0.5 - py / h) * FRAME_H,
  ];

  return { frameAlpha, letterAlpha, letterIndexMap, normToPx, pxToNorm };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function sampleAlpha(alpha, w, h, [px, py]) {
  const x = Math.round(px);
  const y = Math.round(py);
  if (x < 0 || x >= w || y < 0 || y >= h) return 0;
  return alpha[y * w + x];
}

function buildFrameShards(count, out) {
  const halfT = FRAME_T * 0.5;
  const rw = FRAME_W - FRAME_T;
  const rh = FRAME_H - FRAME_T;
  const r = Math.max(0.02, FRAME_R - halfT);
  const sx = rw - r * 2;
  const sy = rh - r * 2;
  const arc = (Math.PI / 2) * r;
  const perim = 2 * sx + 2 * sy + 4 * arc;
  const x0 = -rw / 2;
  const y0 = -rh / 2;

  function sampleEdge(dist) {
    let d = ((dist % perim) + perim) % perim;
    let x = 0, y = 0, nx = 0, ny = 0;
    if (d < sx) {
      x = x0 + r + d; y = y0; nx = 0; ny = -1;
    } else if ((d -= sx) < arc) {
      const a = -Math.PI / 2 + (d / arc) * (Math.PI / 2);
      nx = Math.cos(a); ny = Math.sin(a);
      x = x0 + rw - r + r * nx; y = y0 + r + r * ny;
    } else if ((d -= arc) < sy) {
      x = x0 + rw; y = y0 + r + d; nx = 1; ny = 0;
    } else if ((d -= sy) < arc) {
      const a = (d / arc) * (Math.PI / 2);
      nx = Math.cos(a); ny = Math.sin(a);
      x = x0 + rw - r + r * nx; y = y0 + rh - r + r * ny;
    } else if ((d -= arc) < sx) {
      x = x0 + rw - r - d; y = y0 + rh; nx = 0; ny = 1;
    } else if ((d -= sx) < arc) {
      const a = Math.PI / 2 + (d / arc) * (Math.PI / 2);
      nx = Math.cos(a); ny = Math.sin(a);
      x = x0 + r + r * nx; y = y0 + rh - r + r * ny;
    } else if ((d -= arc) < sy) {
      x = x0; y = y0 + rh - r - d; nx = -1; ny = 0;
    } else {
      d -= sy;
      const a = Math.PI + (d / arc) * (Math.PI / 2);
      nx = Math.cos(a); ny = Math.sin(a);
      x = x0 + r + r * nx; y = y0 + r + r * ny;
    }
    return { x, y, nx, ny };
  }

  // Irregular cut lengths along perimeter for authentic shattered-glass variation.
  const weights = [];
  let weightSum = 0;
  for (let i = 0; i < count; i++) {
    const w = 0.65 + 0.85 * Math.abs(Math.sin(i * 19.37 + 0.7));
    weights.push(w);
    weightSum += w;
  }
  const cuts = [0];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    acc += (weights[i] / weightSum) * perim;
    cuts.push(acc);
  }
  cuts[count] = perim;

  const avgSeg = perim / count;
  const gap = 0.0011;
  const skewAt = (idx) => {
    if (idx <= 0 || idx >= count) return 0;
    const sign = idx % 2 === 0 ? 1 : -1;
    const mag = 0.20 + 0.16 * Math.abs(Math.cos(idx * 7.13));
    return sign * mag * avgSeg;
  };
  for (let i = 0; i < count; i++) {
    const skew0 = skewAt(i);
    const skew1 = skewAt(i + 1);
    const d0 = cuts[i] + gap;
    const d1 = cuts[i + 1] - gap;

    const pOut0 = sampleEdge(d0 + skew0 * 0.5);
    const pOut1 = sampleEdge(d1 + skew1 * 0.5);
    const pIn0 = sampleEdge(d0 - skew0 * 0.5);
    const pIn1 = sampleEdge(d1 - skew1 * 0.5);

    const poly = [
      { x: pOut0.x + pOut0.nx * halfT, y: -(pOut0.y + pOut0.ny * halfT) },
      { x: pOut1.x + pOut1.nx * halfT, y: -(pOut1.y + pOut1.ny * halfT) },
      { x: pIn1.x - pIn1.nx * halfT, y: -(pIn1.y - pIn1.ny * halfT) },
      { x: pIn0.x - pIn0.nx * halfT, y: -(pIn0.y - pIn0.ny * halfT) },
    ];

    let cx = 0, cy = 0;
    for (let k = 0; k < 4; k++) { cx += poly[k].x; cy += poly[k].y; }
    cx *= 0.25; cy *= 0.25;

    let area2 = 0;
    for (let k = 0; k < 4; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % 4];
      area2 += (a.x - cx) * (b.y - cy) - (b.x - cx) * (a.y - cy);
    }
    if (area2 < 0) poly.reverse();
    out.push({ poly, cx, cy, group: 0, letterIdx: -1 });
  }
}

function sampleMaskSeeds(alpha, letterIndexMap, w, h, pxToNorm, targetCount) {
  const candidates = [];
  const step = 3;
  for (let py = 2; py < h - 2; py += step) {
    for (let px = 2; px < w - 2; px += step) {
      const idx = py * w + px;
      if (alpha[idx] > 160) {
        const jx = px + (Math.random() - 0.5) * 2.5;
        const jy = py + (Math.random() - 0.5) * 2.5;
        const cIdx = Math.round(jy) * w + Math.round(jx);
        if (alpha[cIdx] > 130) {
          const [nx, ny] = pxToNorm(jx, jy);
          candidates.push({ x: nx, y: ny, letterIdx: Math.max(0, letterIndexMap[cIdx]) });
        }
      }
    }
  }
  if (candidates.length <= targetCount) return candidates;

  // Stratified golden-ratio selection after shuffling within local buckets so
  // every glyph gets crisp, even Voronoi shard coverage.
  const out = [];
  const stride = candidates.length / targetCount;
  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(candidates.length - 1, Math.floor((i + 0.5) * stride));
    out.push(candidates[idx]);
  }
  return out;
}

/* ---------- Voronoi Half-Plane Clipper + Mask Clamper ---------- */

function buildCellsForGroup({ seeds, group, maxR, seamGap, isInMask, out }) {
  const n = seeds.length;
  for (let i = 0; i < n; i++) {
    const si = seeds[i];

    // Start with a 10-sided bounding polygon around seed `si`.
    let poly = [];
    const sides = 10;
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      poly.push({ x: si.x + Math.cos(a) * maxR, y: si.y + Math.sin(a) * maxR });
    }

    // Collect nearest neighbors within 2.4 * maxR.
    const cutoffSq = (maxR * 2.4) * (maxR * 2.4);
    const neighbors = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const sj = seeds[j];
      const dx = sj.x - si.x;
      const dy = sj.y - si.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < cutoffSq && d2 > 1e-8) {
        neighbors.push({ dx, dy, d2 });
      }
    }
    neighbors.sort((a, b) => a.d2 - b.d2);
    const clipCount = Math.min(18, neighbors.length);

    for (let c = 0; c < clipCount; c++) {
      const nb = neighbors[c];
      const dist = Math.sqrt(nb.d2);
      const nx = nb.dx / dist;
      const ny = nb.dy / dist;
      // Half-plane offset: dot(p - si, n) <= dist * 0.5 - seamGap
      const limit = dist * 0.5 - seamGap;
      poly = clipPolyHalfPlane(poly, si.x, si.y, nx, ny, limit);
      if (poly.length < 3) break;
    }

    if (poly.length < 3) continue;

    // Clamp vertices onto the ink contour via binary search along ray from seed.
    const clamped = [];
    for (let k = 0; k < poly.length; k++) {
      let vx = poly[k].x;
      let vy = poly[k].y;
      if (!isInMask(vx, vy)) {
        let lo = 0;
        let hi = 1;
        for (let it = 0; it < 7; it++) {
          const mid = (lo + hi) * 0.5;
          const tx = si.x + (vx - si.x) * mid;
          const ty = si.y + (vy - si.y) * mid;
          if (isInMask(tx, ty)) lo = mid;
          else hi = mid;
        }
        vx = si.x + (vx - si.x) * lo;
        vy = si.y + (vy - si.y) * lo;
      }
      if (
        clamped.length === 0 ||
        Math.hypot(vx - clamped[clamped.length - 1].x, vy - clamped[clamped.length - 1].y) > 0.0022
      ) {
        clamped.push({ x: vx, y: vy });
      }
    }
    if (
      clamped.length > 2 &&
      Math.hypot(clamped[0].x - clamped[clamped.length - 1].x, clamped[0].y - clamped[clamped.length - 1].y) < 0.0022
    ) {
      clamped.pop();
    }
    if (clamped.length < 3) continue;

    // Centroid + CCW winding check.
    let cx = 0;
    let cy = 0;
    for (let k = 0; k < clamped.length; k++) {
      cx += clamped[k].x;
      cy += clamped[k].y;
    }
    cx /= clamped.length;
    cy /= clamped.length;

    let area2 = 0;
    for (let k = 0; k < clamped.length; k++) {
      const p0 = clamped[k];
      const p1 = clamped[(k + 1) % clamped.length];
      area2 += (p0.x - cx) * (p1.y - cy) - (p1.x - cx) * (p0.y - cy);
    }
    if (Math.abs(area2) < 1e-6) continue;
    if (area2 < 0) clamped.reverse();

    out.push({ poly: clamped, cx, cy, group, letterIdx: si.letterIdx });
  }
}

function clipPolyHalfPlane(poly, ox, oy, nx, ny, limit) {
  const out = [];
  const len = poly.length;
  for (let i = 0; i < len; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % len];
    const da = (a.x - ox) * nx + (a.y - oy) * ny - limit;
    const db = (b.x - ox) * nx + (b.y - oy) * ny - limit;
    const ina = da <= 0;
    const inb = db <= 0;
    if (ina && inb) {
      out.push(b);
    } else if (ina && !inb) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    } else if (!ina && inb) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      out.push(b);
    }
  }
  return out;
}
