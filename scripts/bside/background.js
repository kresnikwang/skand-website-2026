/**
 * SKAND B-Side — Aesthetic Environment & Visual FX (Three.js r187 TSL).
 *
 * Implements:
 *   1. Ethereal Cosmic Nebula Dome — TSL procedural FBM nebula & twinkling starfield
 *   2. Floating Bokeh Stardust Motes — PointsNodeMaterial instanced Sprites with harmonic drift
 *   3. 3D Expanding Shockwave System — TSL shockwaves on Ignite & Pop
 *   4. Gravitational Pointer Ripple — interactive energy aura under pointer drag
 */

import * as THREE from 'https://esm.sh/three@0.187.0/webgpu';
import {
  Fn,
  If,
  Discard,
  float,
  vec2,
  vec3,
  uniform,
  uv,
  positionWorld,
  cameraPosition,
  normalize,
  length,
  dot,
  floor,
  fract,
  sin,
  cos,
  pow,
  mix,
  clamp,
  smoothstep,
  abs,
  max,
  instancedArray,
  instanceIndex,
  mx_noise_float,
  sRGBTransferEOTF,
} from 'https://esm.sh/three@0.187.0/tsl';
import { PALETTE } from './config.js?v=20261113';

/* ================================================================== */
/* Public Background Controller                                        */
/* ================================================================== */

export function createBackground(scene, tier, reduced) {
  const isMobile = tier.name === 'mobile';

  /* --- Shared Uniforms --- */
  const uTime = uniform(0);
  const uEnergy = uniform(0);
  const uIgnite = uniform(0);
  const uTension = uniform(0);
  const uPop = uniform(0);
  const uPointer = uniform(new THREE.Vector2(0, 0));

  /* --- 1. Nebula Sky Dome (TSL MeshBasicNodeMaterial) --- */
  const fbm = Fn(([p_immutable]) => {
    const p = p_immutable.toVar();
    const val = float(0.0).toVar();
    const amp = float(0.5).toVar();
    val.addAssign(amp.mul(mx_noise_float(p)));
    p.mulAssign(2.02);
    amp.mulAssign(0.5);
    val.addAssign(amp.mul(mx_noise_float(p)));
    if (!isMobile) {
      p.mulAssign(2.04);
      amp.mulAssign(0.5);
      val.addAssign(amp.mul(mx_noise_float(p)));
    }
    return val;
  });

  const starField = Fn(([dir, scale, threshold]) => {
    const p = dir.mul(scale);
    const id = floor(p);
    const f = fract(p).sub(0.5);
    const n = fract(sin(dot(id, vec3(12.9898, 78.233, 45.164))).mul(43758.5453));
    const result = float(0.0).toVar();
    If(n.greaterThanEqual(threshold), () => {
      const dist = length(f);
      const brightness = smoothstep(0.42, 0.0, dist);
      const twinkle = float(0.75).add(float(0.25).mul(sin(uTime.mul(float(3.0).add(n.mul(6.0))).add(n.mul(6.28)))));
      result.assign(brightness.mul(twinkle).mul(pow(n, 4.0)));
    });
    return result;
  });

  const nebulaColor = Fn(() => {
    const dir = normalize(positionWorld.sub(cameraPosition));

    // Palette authored in sRGB (matching the original pre-OutputPass shader),
    // converted to linear working space via sRGBTransferEOTF for RenderPipeline.
    const deepVoid = sRGBTransferEOTF(vec3(0.024, 0.026, 0.038));
    const midnightIndigo = sRGBTransferEOTF(vec3(0.045, 0.055, 0.11));
    const coralGlow = sRGBTransferEOTF(vec3(0.91, 0.34, 0.23));
    const etherealBlue = sRGBTransferEOTF(vec3(0.25, 0.38, 0.88));
    const paleGold = sRGBTransferEOTF(vec3(1.0, 0.88, 0.70));

    const rotSpeed = float(0.028).add(uEnergy.mul(0.065));
    const angle = uTime.mul(rotSpeed);
    const cosR = cos(angle);
    const sinR = sin(angle);
    const rotDir = vec3(
      dir.x.mul(cosR).sub(dir.z.mul(sinR)),
      dir.y,
      dir.x.mul(sinR).add(dir.z.mul(cosR))
    );

    const coord1 = rotDir.mul(1.35).add(vec3(0.0, uTime.mul(0.035), 0.0));
    const coord2 = rotDir.mul(2.1).sub(vec3(uTime.mul(0.025), 0.0, uTime.mul(0.02)));

    const n1 = fbm(coord1);
    const n2 = fbm(coord2.add(vec3(n1.mul(0.7))));

    const nebulaA = smoothstep(-0.15, 0.65, n1);
    const nebulaB = smoothstep(0.0, 0.75, n2);

    const sky = mix(deepVoid, midnightIndigo, clamp(dir.z.mul(0.5).add(0.5), 0.0, 1.0)).toVar();

    const cloudBlue = mix(midnightIndigo, etherealBlue, nebulaA);
    sky.assign(mix(sky, cloudBlue, nebulaA.mul(0.55)));

    const cloudCoral = mix(etherealBlue.mul(0.6), coralGlow, nebulaB);
    sky.assign(mix(sky, cloudCoral, nebulaB.mul(0.42).mul(float(0.6).add(uEnergy.mul(0.65)))));

    const centerProximity = float(1.0).sub(smoothstep(0.0, 1.25, length(dir.xy)));
    const coreShine = centerProximity.mul(float(0.15).add(uEnergy.mul(0.45)).add(uTension.mul(0.35)));
    sky.addAssign(paleGold.mul(coreShine).mul(float(0.35).add(n1.mul(0.4))));

    sky.addAssign(coralGlow.mul(uIgnite.mul(0.75).add(uPop.mul(0.95))));
    sky.addAssign(paleGold.mul(uIgnite.mul(0.45)));

    const starsFine = starField(rotDir, 42.0, 0.94);
    const starsBright = starField(rotDir.add(vec3(13.4, 7.1, 9.8)), 24.0, 0.985);
    const starColor = mix(vec3(0.85, 0.92, 1.0), paleGold, n2.mul(0.5));
    sky.addAssign(
      starsFine.mul(0.75).add(starsBright.mul(1.6)).mul(starColor).mul(float(1.0).sub(coreShine.mul(0.5)))
    );

    const pointerDist = length(dir.xy.sub(uPointer.mul(0.35)));
    const pointerAura = smoothstep(0.85, 0.0, pointerDist);
    sky.addAssign(coralGlow.mul(pointerAura).mul(0.12).mul(float(1.0).add(uEnergy)));

    const vignette = float(1.0).sub(smoothstep(0.5, 1.5, length(dir.xy)));
    sky.mulAssign(clamp(float(0.72).add(vignette.mul(0.35)), 0.0, 1.0));

    return sky;
  });

  const skyGeo = new THREE.SphereGeometry(65, isMobile ? 24 : 40, isMobile ? 18 : 28);
  const skyMat = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  skyMat.colorNode = nebulaColor();
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.renderOrder = -100;
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  /* --- 2. Ambient Stardust Bokeh (PointsNodeMaterial on instanced Sprite) --- */
  const stardustCount = isMobile ? 550 : 1300;
  const starBasePosBuf = instancedArray(stardustCount, 'vec3');
  const starMetaBuf = instancedArray(stardustCount, 'vec2'); // x = size, y = seed
  const starColorBuf = instancedArray(stardustCount, 'vec3');

  const posArr = starBasePosBuf.value.array;
  const metaArr = starMetaBuf.value.array;
  const colArr = starColorBuf.value.array;

  const colCoral = new THREE.Color(PALETTE.coral);
  const colBlue = new THREE.Color(PALETTE.blue);
  const colWhite = new THREE.Color(PALETTE.white);
  const colGold = new THREE.Color(0xffd166);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < stardustCount; i++) {
    posArr[i * 3] = (Math.random() - 0.5) * 28.0;
    posArr[i * 3 + 1] = (Math.random() - 0.5) * 18.0;
    posArr[i * 3 + 2] = (Math.random() - 0.5) * 14.0;

    metaArr[i * 2] = Math.random() < 0.15 ? 14.0 + Math.random() * 16.0 : 4.0 + Math.random() * 8.0;
    metaArr[i * 2 + 1] = Math.random();

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

    colArr[i * 3] = tmpCol.r;
    colArr[i * 3 + 1] = tmpCol.g;
    colArr[i * 3 + 2] = tmpCol.b;
  }

  const starMeta = starMetaBuf.element(instanceIndex);
  const starSeed = starMeta.y;
  const starBasePos = starBasePosBuf.element(instanceIndex);

  const starPosNode = Fn(() => {
    const pos = starBasePos.toVar();
    const t = uTime.mul(0.22).add(starSeed.mul(6.2831));
    pos.x.addAssign(sin(t.mul(1.1).add(starSeed.mul(12.0))).mul(1.25).add(cos(t.mul(0.45).add(starSeed.mul(5.0))).mul(0.65)));
    pos.y.addAssign(cos(t.mul(0.9).add(starSeed.mul(8.0))).mul(0.95).add(sin(t.mul(0.35).add(starSeed.mul(7.0))).mul(0.45)));
    pos.z.addAssign(sin(t.mul(0.8).add(starSeed.mul(15.0))).mul(1.1));
    If(uEnergy.greaterThan(0.01), () => {
      pos.mulAssign(mix(1.0, 0.84, uEnergy.mul(0.4)));
    });
    return pos;
  })();

  const starDist = length(uv().sub(0.5).mul(2.0));
  const starDisc = Fn(() => {
    If(starDist.greaterThan(1.0), () => {
      Discard();
    });
    const halo = float(1.0).sub(smoothstep(0.0, 1.0, starDist));
    const core = float(1.0).sub(smoothstep(0.0, 0.28, starDist));
    return starColorBuf.element(instanceIndex).mul(halo.mul(0.6).add(core.mul(0.85)));
  });

  const starAlpha = Fn(() => {
    const halo = float(1.0).sub(smoothstep(0.0, 1.0, starDist));
    const pulse = float(0.75).add(float(0.25).mul(sin(uTime.mul(1.8).add(starSeed.mul(20.0)))));
    return pulse.mul(float(0.35).add(starSeed.mul(0.55))).mul(halo);
  });

  const starMat = new THREE.PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  starMat.positionNode = starPosNode;
  // PointsNodeMaterial multiplies sizeNode by screenDPR * (0.5 * height / -mv.z).
  starMat.sizeNode = starMeta.x.mul(0.03);
  starMat.colorNode = starDisc();
  starMat.opacityNode = starAlpha();

  const starPoints = new THREE.Sprite(starMat);
  starPoints.count = stardustCount;
  starPoints.renderOrder = -50;
  starPoints.frustumCulled = false;
  scene.add(starPoints);

  /* --- 3. Expanding Shockwave Mesh --- */
  const uShockProgress = uniform(1.0);
  const uShockColor = uniform(new THREE.Color(PALETTE.coral));
  const uShockIntensity = uniform(0);

  const shockCalc = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2.0);
    const ringRadius = clamp(uShockProgress.mul(1.15), 0.0, 1.2);
    const thickness = mix(0.18, 0.06, uShockProgress);
    const ring = smoothstep(thickness, 0.0, abs(d.sub(ringRadius)));
    const fade = float(1.0).sub(uShockProgress).pow(2.0);
    const alpha = ring.mul(fade).mul(uShockIntensity);
    If(alpha.lessThanEqual(0.001), () => {
      Discard();
    });
    const col = mix(vec3(1.0, 0.95, 0.85), uShockColor, smoothstep(0.0, thickness, abs(d.sub(ringRadius))));
    return { col: col.mul(alpha).mul(1.8), alpha };
  });

  const shockGeo = new THREE.PlaneGeometry(16, 16);
  const shockMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  shockMat.colorNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2.0);
    const ringRadius = clamp(uShockProgress.mul(1.15), 0.0, 1.2);
    const thickness = mix(0.18, 0.06, uShockProgress);
    const ring = smoothstep(thickness, 0.0, abs(d.sub(ringRadius)));
    const fade = float(1.0).sub(uShockProgress).mul(float(1.0).sub(uShockProgress));
    const alpha = ring.mul(fade).mul(uShockIntensity);
    If(alpha.lessThanEqual(0.001), () => {
      Discard();
    });
    const col = mix(vec3(1.0, 0.95, 0.85), uShockColor, smoothstep(0.0, thickness, abs(d.sub(ringRadius))));
    return col.mul(alpha).mul(1.8);
  })();
  shockMat.opacityNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2.0);
    const ringRadius = clamp(uShockProgress.mul(1.15), 0.0, 1.2);
    const thickness = mix(0.18, 0.06, uShockProgress);
    const ring = smoothstep(thickness, 0.0, abs(d.sub(ringRadius)));
    const fade = float(1.0).sub(uShockProgress).mul(float(1.0).sub(uShockProgress));
    return ring.mul(fade).mul(uShockIntensity);
  })();
  void shockCalc;

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
    uShockColor.value.setHex(colorHex);
    uShockIntensity.value = intensity;
    uShockProgress.value = 0.0;
    shockwaveTimer = 0;
    shockwaveActive = true;
    shockMesh.visible = true;
    shockMesh.scale.set(1, 1, 1);
  }

  function reset() {
    shockwaveActive = false;
    shockMesh.visible = false;
    uShockProgress.value = 1.0;
    rippleTargetStrength = 0;
    rippleCurrentStrength = 0;
    uRippleStrength.value = 0;
  }

  /* --- 4. Interactive Gravity Ripple --- */
  const uRippleStrength = uniform(0);
  const uRippleColor = uniform(new THREE.Color(PALETTE.coral));

  const rippleGeo = new THREE.PlaneGeometry(3.6, 3.6);
  const rippleMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  rippleMat.colorNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2.0);
    If(d.greaterThan(1.0).or(uRippleStrength.lessThanEqual(0.001)), () => {
      Discard();
    });
    const waves = sin(d.mul(18.0).sub(uTime.mul(6.5))).mul(0.5).add(0.5);
    const falloff = float(1.0).sub(d).mul(float(1.0).sub(d));
    const glow = waves.mul(falloff).mul(uRippleStrength);
    return uRippleColor.mul(glow).mul(1.5);
  })();
  rippleMat.opacityNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2.0);
    const waves = sin(d.mul(18.0).sub(uTime.mul(6.5))).mul(0.5).add(0.5);
    const falloff = float(1.0).sub(d).mul(float(1.0).sub(d));
    return waves.mul(falloff).mul(uRippleStrength).mul(0.7);
  })();

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
    if (state.camera) {
      skyMesh.position.copy(state.camera.position);
      shockMesh.quaternion.copy(state.camera.quaternion);
      rippleMesh.quaternion.copy(state.camera.quaternion);
    }

    uTime.value = time;
    if (state.energy !== undefined) uEnergy.value = state.energy;
    if (state.ignite !== undefined) uIgnite.value = state.ignite;
    if (state.tension !== undefined) uTension.value = state.tension;
    if (state.pop !== undefined) uPop.value = state.pop;
    if (state.ndc) uPointer.value.set(state.ndc.x, state.ndc.y);

    if (shockwaveActive) {
      shockwaveTimer += dt;
      const progress = shockwaveTimer / SHOCKWAVE_DURATION;
      if (progress >= 1.0) {
        shockwaveActive = false;
        shockMesh.visible = false;
      } else {
        uShockProgress.value = progress;
        const scale = 1.0 + progress * 1.6;
        shockMesh.scale.set(scale, scale, 1);
      }
    }

    rippleCurrentStrength += (rippleTargetStrength - rippleCurrentStrength) * (dt * 12.0);
    uRippleStrength.value = rippleCurrentStrength;
  }

  function resize() {
    // PointsNodeMaterial handles screenDPR and viewport height automatically.
  }

  function dispose() {
    skyGeo.dispose();
    skyMat.dispose();
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
