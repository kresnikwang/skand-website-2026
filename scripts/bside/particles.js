/**
 * SKAND B-Side — GPU particle system.
 *
 * 65,536 particles (desktop) whose physics runs entirely in a fragment shader
 * on ping-pong float render targets via GPUComputationRenderer. The CPU only
 * pushes a handful of uniforms per frame; per-particle motion, the chaos flow,
 * the target spring, the pointer wake and the ignition burst are all computed
 * on-GPU. That's the leap from the old 2D version, which ran every particle's
 * integration in a JS forEach each frame.
 *
 * Per-particle data lives in two places, kept in lockstep by construction:
 *   • a texture (targetTex / metaTex) the COMPUTE shaders sample by gl_FragCoord
 *   • matching geometry attributes the RENDER vertex shader samples by aRef
 * buildParticles lays both down from the same arrays, so index i always maps
 * to texel (i % W, floor(i / W)) in the compute texture AND to aRef in the
 * geometry. The compute shader derives that same uv from gl_FragCoord /
 * resolution, so the two views never diverge.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { GPUComputationRenderer } from 'https://esm.sh/three@0.170.0/examples/jsm/misc/GPUComputationRenderer.js';
import { PALETTE, LETTER_COLORS } from './config.js';

/* ---------- compute shaders ---------- */

const positionShader = /* glsl */ `
  uniform float dt;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 posData = texture2D(texturePosition, uv);
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    vec3 pos = posData.xyz + vel * dt;
    gl_FragColor = vec4(pos, posData.w);
  }
`;

const velocityShader = /* glsl */ `
  uniform float dt;
  uniform float time;
  uniform float uMorph;        // 0 → 1 global assemble progress
  uniform float uChaos;        // 1 → 0 chaos strength
  uniform float uImpulse;      // ignition radial burst (decays in JS)
  uniform vec3  uPointer;      // world-space pointer on the z=0 plane
  uniform float uPointerForce; // signed: + attract (dragging), − repel
  uniform float uBounds;       // half-extent of the chaos volume
  uniform float uWorldScale;   // normalized target → world units
  uniform sampler2D uTarget;  // xyz = target, w = stagger 0..1
  uniform sampler2D uMeta;    // x = random, y = group, z = seed, w = letterIdx

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    vec4 tgt = texture2D(uTarget, uv);
    vec4 meta = texture2D(uMeta, uv);

    float group   = meta.y;   // 0 = frame, 1 = letters
    float seed    = meta.z;
    float stagger = tgt.w;

    // Per-particle effective morph. The frame leads (group 0, no delay);
    // letters wait for the frame to draw before they fill in. The stagger
    // term makes particles arrive in a wave, never as one block. The 0.40
    // divisor is sized so that at uMorph = 1.0 even the most-delayed letter
    // (groupDelay 0.30 + stagger 0.30 = 0.60) reaches m = 1.0 exactly — the
    // settled mark has to be crisp, not soft.
    float groupDelay = group * 0.30;
    float m = clamp((uMorph - groupDelay - stagger * 0.30) / 0.40, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m); // smoothstep

    vec3 target = tgt.xyz * uWorldScale;

    // Cheap divergence-free-ish flow for the chaos cloud. Three offset sines
    // per axis read as turbulent drift at this scale; a real curl-noise texture
    // isn't worth the extra fetch for a background cloud.
    float s = seed * 6.2831;
    vec3 flow = vec3(
      sin(pos.y * 0.55 + time * 0.7 + s),
      cos(pos.z * 0.55 + time * 0.55 + s * 1.7),
      sin(pos.x * 0.55 + time * 0.8 + s * 2.3)
    );

    // Spring toward the target, gated by morph.
    vec3 toTarget = target - pos;
    vel += toTarget * (m * 2.8);

    // Chaos flow.
    vel += flow * (uChaos * 1.5);

    // Pointer wake. Attract while dragging (builds charge), repel otherwise.
    vec3 toPointer = uPointer - pos;
    float pd = length(toPointer);
    if (pd < 6.5 && pd > 0.001) {
      float f = (6.5 - pd) / 6.5;
      f *= f;
      vel += (toPointer / pd) * f * uPointerForce;
    }

    // Ignition: radial burst from the centre.
    if (uImpulse > 0.001) {
      vec3 dir = normalize(pos + vec3(0.0001));
      vel += dir * uImpulse * (0.4 + seed * 1.2);
    }

    // Damping: floaty while chaotic, heavy as it locks in, so it settles crisp.
    vel *= mix(0.945, 0.86, m);

    // Soft containment of the chaos volume (skip once mostly assembled).
    if (m < 0.5) {
      vec3 over = max(abs(pos) - uBounds, 0.0) * sign(pos);
      vel -= over * 0.9;
    }

    gl_FragColor = vec4(vel, 0.0);
  }
`;

/* ---------- render shaders ---------- */

const renderVertex = /* glsl */ `
  uniform sampler2D uPositions;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uHeight;      // css pixels, for size attenuation
  uniform float uMorph;
  uniform float uIgnite;
  uniform vec3  uIdleColor;
  uniform float uTime;

  attribute vec2  aRef;       // uv into the compute position texture
  attribute vec3  aColor;     // per-letter accent
  attribute float aRandom;
  attribute float aSeed;

  varying vec3  vColor;
  varying float vAlpha;
  varying float vCore;

  void main() {
    vec3 pos = texture2D(uPositions, aRef).xyz;

    // Colour: idle grey → per-letter accent as it locks in → hot on ignite.
    float mixT = clamp(uMorph * 1.2, 0.0, 1.0);
    vec3 col = mix(uIdleColor, aColor, mixT);
    col = mix(col, vec3(1.0, 0.94, 0.88), uIgnite * 0.8);

    // Twinkle: subtle per-particle flicker, stronger in chaos.
    float tw = 0.85 + 0.15 * sin(uTime * 2.0 + aSeed * 40.0);
    float chaosT = 1.0 - clamp(uMorph, 0.0, 1.0);
    col *= mix(1.0, tw, chaosT * 0.6);

    vColor = col;
    vAlpha = mix(0.35, 1.0, mixT) * mix(0.7, 1.0, chaosT * 0.5 + 0.5);
    vCore = 0.5 + 0.5 * aRandom;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.65 + aRandom * 0.7) * (1.0 + uIgnite * 0.5);
    gl_PointSize = size * uPixelRatio * (uHeight / -mv.z) * 0.01;
  }
`;

const renderFragment = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;
  varying float vCore;

  void main() {
    // Soft circular sprite: bright core, feathered edge, additive-friendly.
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float glow = pow(1.0 - d, 2.2);
    float core = pow(max(0.0, 1.0 - d * 2.2), 3.0);
    vec3 col = vColor * (glow * 0.7 + core * 0.9 * vCore);
    gl_FragColor = vec4(col, vAlpha * (glow * 0.6 + core * 0.8));
  }
`;

/* ---------- public factory ---------- */

/**
 * @param {WebGLRenderer} renderer
 * @param {object} opts { size, targets, worldScale, bounds, pixelRatio, height }
 * @returns particle system handle with .points, .setState(), .update(), .dispose()
 */
export function createParticleSystem(renderer, opts) {
  const { size, targets, worldScale, bounds, pixelRatio, height } = opts;
  const total = size * size;

  const data = buildParticles(size, targets, worldScale, bounds);

  const gpu = new GPUComputationRenderer(size, size, renderer);
  // Half-float keeps us safe on devices without full float render targets;
  // position magnitudes (~±12) are well inside half-float's usable range.
  gpu.setDataType(THREE.HalfFloatType);

  const posTex = gpu.createTexture();
  const velTex = gpu.createTexture();
  for (let i = 0; i < total; i++) {
    posTex.image.data[i * 4] = data.position[i * 4];
    posTex.image.data[i * 4 + 1] = data.position[i * 4 + 1];
    posTex.image.data[i * 4 + 2] = data.position[i * 4 + 2];
    posTex.image.data[i * 4 + 3] = data.position[i * 4 + 3];
    velTex.image.data[i * 4] = data.velocity[i * 4];
    velTex.image.data[i * 4 + 1] = data.velocity[i * 4 + 1];
    velTex.image.data[i * 4 + 2] = data.velocity[i * 4 + 2];
    velTex.image.data[i * 4 + 3] = 0;
  }

  const posVar = gpu.addVariable('texturePosition', positionShader, posTex);
  const velVar = gpu.addVariable('textureVelocity', velocityShader, velTex);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);

  // Static per-particle textures the velocity shader samples.
  const targetTex = new THREE.DataTexture(
    data.targetData, size, size, THREE.RGBAFormat, THREE.FloatType
  );
  targetTex.needsUpdate = true;
  const metaTex = new THREE.DataTexture(
    data.metaData, size, size, THREE.RGBAFormat, THREE.FloatType
  );
  metaTex.needsUpdate = true;

  // Shared uniforms driven by JS each frame.
  const shared = {
    dt: { value: 0.016 },
    time: { value: 0 },
    uMorph: { value: 0 },
    uChaos: { value: 1 },
    uImpulse: { value: 0 },
    uPointer: { value: new THREE.Vector3(0, 0, 0) },
    uPointerForce: { value: 0 },
    uBounds: { value: bounds },
    uWorldScale: { value: worldScale },
    uTarget: { value: targetTex },
    uMeta: { value: metaTex },
  };
  Object.assign(posVar.material.uniforms, { dt: shared.dt, time: shared.time });
  Object.assign(velVar.material.uniforms, shared);

  const err = gpu.init();
  if (err) {
    console.error('[bside] GPUComputationRenderer init failed:', err);
    return null;
  }

  // Render geometry / material.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
  geometry.setAttribute('aRef', new THREE.BufferAttribute(data.aRef, 2));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(data.aColor, 3));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(data.aRandom, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(data.aSeed, 1));
  // Give the frustum a sane bounding sphere so it isn't culled when settled.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), bounds * 2);

  const idleColor = new THREE.Color(PALETTE.white).lerp(new THREE.Color(PALETTE.dim), 0.35);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPositions: { value: null },
      uSize: { value: 2.2 },
      uPixelRatio: { value: pixelRatio },
      uHeight: { value: height },
      uMorph: shared.uMorph,
      uIgnite: { value: 0 },
      uIdleColor: { value: idleColor },
      uTime: shared.time,
    },
    vertexShader: renderVertex,
    fragmentShader: renderFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  function setState(s) {
    if (s.morph !== undefined) shared.uMorph.value = s.morph;
    if (s.chaos !== undefined) shared.uChaos.value = s.chaos;
    if (s.impulse !== undefined) shared.uImpulse.value = s.impulse;
    if (s.pointerForce !== undefined) shared.uPointerForce.value = s.pointerForce;
    if (s.ignite !== undefined) material.uniforms.uIgnite.value = s.ignite;
    if (s.pointer) shared.uPointer.value.copy(s.pointer);
  }

  function update(dt, time) {
    shared.dt.value = dt;
    shared.time.value = time;
    gpu.compute();
    material.uniforms.uPositions.value = gpu.getCurrentRenderTarget(posVar).texture;
  }

  function setPixelRatio(pr) { material.uniforms.uPixelRatio.value = pr; }
  function setHeight(h) { material.uniforms.uHeight.value = h; }
  // Targets are baked in normalized space; the shader scales them, so the logo
  // can be re-fitted to a new viewport on resize without rebuilding textures.
  function setWorldScale(v) { shared.uWorldScale.value = v; }

  function dispose() {
    geometry.dispose();
    material.dispose();
    targetTex.dispose();
    metaTex.dispose();
    posTex.dispose();
    velTex.dispose();
    gpu.dispose();
  }

  return { points, setState, update, setPixelRatio, setHeight, setWorldScale, dispose, gpu, total, size };
}

function buildParticles(size, targets, worldScale, bounds) {
  const total = size * size;
  const frameCount = targets.frame.count;
  const letterCount = targets.letters.count;

  const position = new Float32Array(total * 4);
  const velocity = new Float32Array(total * 4);
  const targetData = new Float32Array(total * 4);
  const metaData = new Float32Array(total * 4);
  const aRef = new Float32Array(total * 2);
  const aColor = new Float32Array(total * 3);
  const aRandom = new Float32Array(total);
  const aSeed = new Float32Array(total);
  const tmp = new THREE.Color();

  let fCursor = 0;
  let lCursor = 0;
  const frameWant = frameCount;
  const golden = 0.61803398875;

  for (let i = 0; i < total; i++) {
    const isFrame = ((i * golden) % 1) < (frameWant / total);
    let tx = 0;
    let ty = 0;
    let letterIdx = -1;
    let group = 0;

    if (isFrame && fCursor < frameWant) {
      const k = Math.floor(((fCursor++ * golden) % 1) * frameCount);
      tx = targets.frame.xy[k * 2];
      ty = targets.frame.xy[k * 2 + 1];
    } else {
      const k = Math.floor(((lCursor++ * golden) % 1) * letterCount);
      tx = targets.letters.xy[k * 2];
      ty = targets.letters.xy[k * 2 + 1];
      letterIdx = targets.letters.letterIndex[k];
      group = 1;
    }

    const rnd = Math.random();
    const seed = Math.random();
    const stagger = Math.random();

    // Store the target NORMALIZED (targets.js space). The velocity shader
    // scales it by uWorldScale — that single application is what lets
    // setWorldScale re-fit the mark to a new viewport without rebuilding this
    // texture. Do not pre-multiply here, or the scale is applied twice.
    targetData[i * 4] = tx;
    targetData[i * 4 + 1] = ty;
    targetData[i * 4 + 2] = (Math.random() - 0.5) * 0.12;
    targetData[i * 4 + 3] = stagger;

    metaData[i * 4] = rnd;
    metaData[i * 4 + 1] = group;
    metaData[i * 4 + 2] = seed;
    metaData[i * 4 + 3] = letterIdx;

    position[i * 4] = (Math.random() - 0.5) * 2 * bounds;
    position[i * 4 + 1] = (Math.random() - 0.5) * 2 * bounds * 0.7;
    position[i * 4 + 2] = (Math.random() - 0.5) * 2 * bounds * 0.8;
    position[i * 4 + 3] = seed;

    velocity[i * 4] = (Math.random() - 0.5) * 0.4;
    velocity[i * 4 + 1] = (Math.random() - 0.5) * 0.4;
    velocity[i * 4 + 2] = (Math.random() - 0.5) * 0.4;
    velocity[i * 4 + 3] = 0;

    // Texel-center UVs. The compute shader derives its uv from
    // gl_FragCoord/resolution, which lands on texel centers; matching that
    // here keeps the render-side lookup on exactly the same texel.
    aRef[i * 2] = ((i % size) + 0.5) / size;
    aRef[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
    aRandom[i] = rnd;
    aSeed[i] = seed;

    const col = letterIdx >= 0 ? LETTER_COLORS[letterIdx % LETTER_COLORS.length] : PALETTE.dim;
    tmp.setHex(col);
    aColor[i * 3] = tmp.r;
    aColor[i * 3 + 1] = tmp.g;
    aColor[i * 3 + 2] = tmp.b;
  }

  return { position, velocity, targetData, metaData, aRef, aColor, aRandom, aSeed, total };
}
