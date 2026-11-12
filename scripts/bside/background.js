/**
 * SKAND B-Side — Aesthetic Environment & Visual FX.
 *
 * Implements:
 *   1. Ethereal Cosmic Nebula Dome — continuous procedural FBM nebula & twinkling starfield
 *   2. Floating Bokeh Stardust Motes — 3D volumetric ambient light particles with parallax depth
 *   3. 3D Expanding Shockwave System — visceral chromatic aberration shockwaves on Ignite & Pop
 *   4. Gravitational Pointer Ripple — interactive energy aura under pointer drag
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { PALETTE } from './config.js?v=20260929b';

/* ---------- 1. Nebula Sky Shader ---------- */

const nebulaVert = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const nebulaFrag = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;     // 0.0 -> 1.0 (phase charge progress)
  uniform float uIgnite;     // 0.0 -> 1.0 (ignition flash & corona)
  uniform float uTension;    // 0.0 -> 1.0 (squeeze pressure)
  uniform float uPop;        // 0.0 -> 1.0 (burst impulse decay)
  uniform vec2  uPointer;    // normalized pointer position (-1 to 1)
  uniform float uIsMobile;

  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Compact 3D hash & simplex-ish noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // Fast 2-to-3 octave FBM
  float fbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    val += amp * snoise(p);
    p *= 2.02;
    amp *= 0.5;
    val += amp * snoise(p);
    if (uIsMobile < 0.5) {
      p *= 2.04;
      amp *= 0.5;
      val += amp * snoise(p);
    }
    return val;
  }

  // Procedural twinkling star generator
  float starField(vec3 dir, float scale, float threshold) {
    vec3 p = dir * scale;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;
    // pseudo-random per grid cell
    float n = fract(sin(dot(id, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    if (n < threshold) return 0.0;
    float dist = length(f);
    float brightness = smoothstep(0.42, 0.0, dist);
    // twinkle phase
    float twinkle = 0.75 + 0.25 * sin(uTime * (3.0 + n * 6.0) + n * 6.28);
    return brightness * twinkle * pow(n, 4.0);
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);

    // Deep obsidian & midnight blue foundation
    vec3 deepVoid = vec3(0.024, 0.026, 0.038);
    vec3 midnightIndigo = vec3(0.045, 0.055, 0.11);
    
    // Core brand hues
    vec3 coralGlow = vec3(0.91, 0.34, 0.23);      // SKAND Coral (#e8563a)
    vec3 etherealBlue = vec3(0.25, 0.38, 0.88);   // SKAND Blue (#4052b5)
    vec3 paleGold = vec3(1.0, 0.88, 0.70);        // Hot star core

    // Slow celestial rotation + energy vortex acceleration
    float rotSpeed = 0.028 + uEnergy * 0.065;
    float cosR = cos(uTime * rotSpeed);
    float sinR = sin(uTime * rotSpeed);
    vec3 rotDir = vec3(dir.x * cosR - dir.z * sinR, dir.y, dir.x * sinR + dir.z * cosR);

    // Dynamic nebula layers
    vec3 coord1 = rotDir * 1.35 + vec3(0.0, uTime * 0.035, 0.0);
    vec3 coord2 = rotDir * 2.1 - vec3(uTime * 0.025, 0.0, uTime * 0.02);

    float n1 = fbm(coord1);
    float n2 = fbm(coord2 + vec3(n1 * 0.7));

    // Nebula density masks
    float nebulaA = smoothstep(-0.15, 0.65, n1);
    float nebulaB = smoothstep(0.0, 0.75, n2);

    // Blend sky base
    vec3 sky = mix(deepVoid, midnightIndigo, clamp(dir.z * 0.5 + 0.5, 0.0, 1.0));

    // Layer the ethereal blue and twilight coral clouds
    vec3 cloudBlue = mix(midnightIndigo, etherealBlue, nebulaA);
    sky = mix(sky, cloudBlue, nebulaA * 0.55);

    vec3 cloudCoral = mix(etherealBlue * 0.6, coralGlow, nebulaB);
    sky = mix(sky, cloudCoral, nebulaB * 0.42 * (0.6 + uEnergy * 0.65));

    // Energy core convergence: as mark assembles or charges, center grows luminous
    float centerProximity = 1.0 - smoothstep(0.0, 1.25, length(dir.xy));
    float coreShine = centerProximity * (0.15 + uEnergy * 0.45 + uTension * 0.35);
    sky += paleGold * coreShine * (0.35 + n1 * 0.4);

    // Ignite & Pop shock flashes in the sky
    sky += coralGlow * (uIgnite * 0.75 + uPop * 0.95);
    sky += paleGold * (uIgnite * 0.45);

    // Twinkling stars in deep space
    float starsFine = starField(rotDir, 42.0, 0.94);
    float starsBright = starField(rotDir + vec3(13.4, 7.1, 9.8), 24.0, 0.985);
    vec3 starColor = mix(vec3(0.85, 0.92, 1.0), paleGold, n2 * 0.5);
    sky += (starsFine * 0.75 + starsBright * 1.6) * starColor * (1.0 - coreShine * 0.5);

    // Pointer aura projection on the sky
    float pointerDist = length(dir.xy - uPointer * 0.35);
    float pointerAura = smoothstep(0.85, 0.0, pointerDist);
    sky += coralGlow * pointerAura * 0.12 * (1.0 + uEnergy);

    // Natural theatrical vignette
    float vignette = 1.0 - smoothstep(0.5, 1.5, length(dir.xy));
    sky *= clamp(0.72 + vignette * 0.35, 0.0, 1.0);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

/* ---------- 2. Ambient Floating Stardust Bokeh ---------- */

const stardustVert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHeight;
  uniform float uEnergy;
  uniform vec3  uPointer;

  attribute float aSize;
  attribute float aSeed;
  attribute vec3  aColor;
  attribute vec3  aVelocity;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    // Smooth, multi-frequency continuous harmonic drift (no pops, no boundary wraps)
    vec3 pos = position;
    float t = uTime * 0.22 + aSeed * 6.2831;

    pos.x += sin(t * 1.1 + aSeed * 12.0) * 1.25 + cos(t * 0.45 + aSeed * 5.0) * 0.65;
    pos.y += cos(t * 0.9 + aSeed * 8.0) * 0.95 + sin(t * 0.35 + aSeed * 7.0) * 0.45;
    pos.z += sin(t * 0.8 + aSeed * 15.0) * 1.1;

    // Subtle attraction toward center when energy builds
    if (uEnergy > 0.01) {
      pos *= mix(1.0, 0.84, uEnergy * 0.4);
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Breathing pulse
    float pulse = 0.75 + 0.25 * sin(uTime * 1.8 + aSeed * 20.0);
    vAlpha = pulse * (0.35 + aSeed * 0.55);

    // Point size with camera depth attenuation
    float pointSize = aSize * uPixelRatio * (uHeight / max(1.0, -mv.z)) * 0.015;
    gl_PointSize = clamp(pointSize, 1.5, 36.0);
  }
`;

const stardustFrag = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // Soft gaussian-like circular bokeh disc
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord) * 2.0;
    if (dist > 1.0) discard;

    float halo = 1.0 - smoothstep(0.0, 1.0, dist);
    float core = 1.0 - smoothstep(0.0, 0.28, dist);

    vec3 col = vColor * (halo * 0.6 + core * 0.85);
    gl_FragColor = vec4(col, vAlpha * halo);
  }
`;

/* ---------- 3. 3D Expanding Shockwave System ---------- */

const shockwaveVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shockwaveFrag = /* glsl */ `
  uniform float uProgress;   // 0.0 -> 1.0 expansion
  uniform vec3  uColor;
  uniform float uIntensity;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0; // 0 at center, 1 at quad edge

    // Ring position moves outward with uProgress
    float ringRadius = clamp(uProgress * 1.15, 0.0, 1.2);
    float thickness = mix(0.18, 0.06, uProgress);

    float ring = smoothstep(thickness, 0.0, abs(d - ringRadius));

    // Chromatic edge tint (coral on outer rim, gold/white at core)
    vec3 col = mix(vec3(1.0, 0.95, 0.85), uColor, smoothstep(0.0, thickness, abs(d - ringRadius)));

    // Fade out as it expands
    float fade = (1.0 - uProgress) * (1.0 - uProgress);
    float alpha = ring * fade * uIntensity;

    if (alpha <= 0.001) discard;

    gl_FragColor = vec4(col * alpha * 1.8, alpha);
  }
`;

/* ---------- 4. Gravitational Pointer Wave Ripple ---------- */

const rippleVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rippleFrag = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform vec3  uColor;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0 || uStrength <= 0.001) discard;

    // Harmonic radiating waves
    float waves = sin(d * 18.0 - uTime * 6.5) * 0.5 + 0.5;
    float falloff = (1.0 - d) * (1.0 - d);

    float glow = waves * falloff * uStrength;
    gl_FragColor = vec4(uColor * glow * 1.5, glow * 0.7);
  }
`;

/* ================================================================== */
/* Public Background Controller                                        */
/* ================================================================== */

export function createBackground(scene, tier, reduced) {
  const isMobile = tier.name === 'mobile';

  /* --- 1. Nebula Sky Dome --- */
  const skyGeo = new THREE.SphereGeometry(65, isMobile ? 24 : 40, isMobile ? 18 : 28);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: nebulaVert,
    fragmentShader: nebulaFrag,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uIgnite: { value: 0 },
      uTension: { value: 0 },
      uPop: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uIsMobile: { value: isMobile ? 1.0 : 0.0 },
    },
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.renderOrder = -100;
  scene.add(skyMesh);

  /* --- 2. Ambient Stardust Bokeh --- */
  const stardustCount = isMobile ? 550 : 1300;
  const starGeo = new THREE.BufferGeometry();

  const posArr = new Float32Array(stardustCount * 3);
  const sizeArr = new Float32Array(stardustCount);
  const seedArr = new Float32Array(stardustCount);
  const colArr = new Float32Array(stardustCount * 3);
  const velArr = new Float32Array(stardustCount * 3);

  const colCoral = new THREE.Color(PALETTE.coral);
  const colBlue = new THREE.Color(PALETTE.blue);
  const colWhite = new THREE.Color(PALETTE.white);
  const colGold = new THREE.Color(0xffd166);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < stardustCount; i++) {
    posArr[i * 3]     = (Math.random() - 0.5) * 28.0;
    posArr[i * 3 + 1] = (Math.random() - 0.5) * 18.0;
    posArr[i * 3 + 2] = (Math.random() - 0.5) * 14.0;

    sizeArr[i] = Math.random() < 0.15 ? 14.0 + Math.random() * 16.0 : 4.0 + Math.random() * 8.0;
    seedArr[i] = Math.random();

    // Color distribution: mostly white/starlight, accents of coral, blue and warm gold
    const pick = Math.random();
    if (pick < 0.55) {
      tmpCol.copy(colWhite);
    } else if (pick < 0.75) {
      tmpCol.copy(colBlue).lerp(colWhite, 0.4);
    } else if (pick < 0.90) {
      tmpCol.copy(colCoral).lerp(colWhite, 0.3);
    } else {
      tmpCol.copy(colGold);
    }

    colArr[i * 3]     = tmpCol.r;
    colArr[i * 3 + 1] = tmpCol.g;
    colArr[i * 3 + 2] = tmpCol.b;

    velArr[i * 3]     = (Math.random() - 0.5) * 0.3;
    velArr[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
    velArr[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
  starGeo.setAttribute('aVelocity', new THREE.BufferAttribute(velArr, 3));

  const starMat = new THREE.ShaderMaterial({
    vertexShader: stardustVert,
    fragmentShader: stardustFrag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1.0 },
      uHeight: { value: 800 },
      uEnergy: { value: 0 },
      uPointer: { value: new THREE.Vector3(0, 0, 0) },
    },
  });

  const starPoints = new THREE.Points(starGeo, starMat);
  starPoints.renderOrder = -50;
  scene.add(starPoints);

  /* --- 3. Expanding Shockwave Mesh --- */
  const shockGeo = new THREE.PlaneGeometry(16, 16);
  const shockMat = new THREE.ShaderMaterial({
    vertexShader: shockwaveVert,
    fragmentShader: shockwaveFrag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 1.0 }, // 1.0 means inactive
      uColor: { value: new THREE.Color(PALETTE.coral) },
      uIntensity: { value: 0 },
    },
  });
  const shockMesh = new THREE.Mesh(shockGeo, shockMat);
  shockMesh.position.set(0, 0, 0.05);
  shockMesh.renderOrder = 10;
  shockMesh.visible = false;
  scene.add(shockMesh);

  let shockwaveActive = false;
  let shockwaveTimer = 0;
  const SHOCKWAVE_DURATION = 0.95;

  function triggerShockwave(colorHex = PALETTE.coral, intensity = 1.2) {
    if (reduced) return;
    shockMat.uniforms.uColor.value.setHex(colorHex);
    shockMat.uniforms.uIntensity.value = intensity;
    shockMat.uniforms.uProgress.value = 0.0;
    shockwaveTimer = 0;
    shockwaveActive = true;
    shockMesh.visible = true;
    shockMesh.scale.set(1, 1, 1);
  }

  function reset() {
    shockwaveActive = false;
    shockMesh.visible = false;
    shockMat.uniforms.uProgress.value = 1.0;
    rippleTargetStrength = 0;
    rippleCurrentStrength = 0;
    rippleMat.uniforms.uStrength.value = 0;
  }

  /* --- 4. Interactive Gravity Ripple --- */
  const rippleGeo = new THREE.PlaneGeometry(3.6, 3.6);
  const rippleMat = new THREE.ShaderMaterial({
    vertexShader: rippleVert,
    fragmentShader: rippleFrag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.coral) },
    },
  });
  const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
  rippleMesh.position.set(0, 0, 0.02);
  rippleMesh.renderOrder = 5;
  scene.add(rippleMesh);

  let rippleTargetStrength = 0;
  let rippleCurrentStrength = 0;

  function setPointerRipple(worldPos, dragging, speed) {
    if (dragging) {
      rippleMesh.position.x = worldPos.x;
      rippleMesh.position.y = worldPos.y;
      rippleTargetStrength = Math.min(1.2, 0.5 + speed * 0.7);
    } else {
      rippleTargetStrength = 0;
    }
  }

  /* --- Lifecycle & Per-Frame Updates --- */
  function update(dt, time, state = {}) {
    // 0. Camera Alignment
    if (state.camera) {
      skyMesh.position.copy(state.camera.position);
      shockMesh.quaternion.copy(state.camera.quaternion);
      rippleMesh.quaternion.copy(state.camera.quaternion);
    }

    // 1. Sky Uniforms
    skyMat.uniforms.uTime.value = time;
    if (state.energy !== undefined) skyMat.uniforms.uEnergy.value = state.energy;
    if (state.ignite !== undefined) skyMat.uniforms.uIgnite.value = state.ignite;
    if (state.tension !== undefined) skyMat.uniforms.uTension.value = state.tension;
    if (state.pop !== undefined) skyMat.uniforms.uPop.value = state.pop;
    if (state.ndc) skyMat.uniforms.uPointer.value.set(state.ndc.x, state.ndc.y);

    // 2. Stardust Uniforms
    starMat.uniforms.uTime.value = time;
    if (state.energy !== undefined) starMat.uniforms.uEnergy.value = state.energy;

    // 3. Shockwave Animation
    if (shockwaveActive) {
      shockwaveTimer += dt;
      const progress = shockwaveTimer / SHOCKWAVE_DURATION;
      if (progress >= 1.0) {
        shockwaveActive = false;
        shockMesh.visible = false;
      } else {
        shockMat.uniforms.uProgress.value = progress;
        const scale = 1.0 + progress * 1.6;
        shockMesh.scale.set(scale, scale, 1);
      }
    }

    // 4. Gravity Ripple Animation
    rippleCurrentStrength += (rippleTargetStrength - rippleCurrentStrength) * (dt * 12.0);
    rippleMat.uniforms.uTime.value = time;
    rippleMat.uniforms.uStrength.value = rippleCurrentStrength;
  }

  function resize(pixelRatio, height) {
    starMat.uniforms.uPixelRatio.value = pixelRatio;
    starMat.uniforms.uHeight.value = height;
  }

  function dispose() {
    skyGeo.dispose();
    skyMat.dispose();
    starGeo.dispose();
    starMat.dispose();
    shockGeo.dispose();
    shockMat.dispose();
    rippleGeo.dispose();
    rippleMat.dispose();
  }

  return {
    update,
    resize,
    triggerShockwave,
    setPointerRipple,
    reset,
    dispose,
  };
}
