/**
 * SKAND B-Side — Dreamy Twin Realms & Optical Environment (Three.js r187 TSL).
 *
 * Replaces the single dark nebula sphere with two lush, dreamy, multi-layered
 * atmospheric realms that smoothly crossfade when switching modes:
 *
 *   • Gather Realm ("Celestial Aurora Silk")
 *       Iridescent twilight-violet sky, flowing aurora silk curtains, soft
 *       volumetric light veils in 3D parallax depth, dreamy caustic halo, and
 *       pastel bokeh + diamond starlight motes.
 *
 *   • Squeeze Realm ("Abyssal Opal & Molten Prism")
 *       Deep obsidian-plum cosmos with opalescent cyan/orchid/coral liquid-light
 *       veins, reactive pressure furnace behind the mark, contracting energy
 *       interference rings, and ember-prism stardust.
 *
 * Also exposes pure sky materials for PMREMGenerator so the 3D Voronoi glass
 * shards catch real reflections and refractions from each realm.
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
  exp,
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
import { PALETTE } from './config.js?v=20261115';

export function createBackground(scene, tier, reduced) {
  const isMobile = tier.name === 'mobile';

  /* --- Shared Uniforms --- */
  const uTime = uniform(0);
  const uEnergy = uniform(0);
  const uIgnite = uniform(0);
  const uTension = uniform(0);
  const uPop = uniform(0);
  const uModeMix = uniform(0); // 0 = Gather (Aurora Silk), 1 = Squeeze (Abyssal Opal)
  const uPointer = uniform(new THREE.Vector2(0, 0));

  let targetModeMix = 0;

  /* --- Procedural Noise Helpers (TSL) --- */
  const fbm = Fn(([p_in]) => {
    const p = p_in.toVar();
    const val = float(0.0).toVar();
    const amp = float(0.5).toVar();
    val.addAssign(amp.mul(mx_noise_float(p)));
    p.mulAssign(2.03);
    amp.mulAssign(0.5);
    val.addAssign(amp.mul(mx_noise_float(p)));
    if (!isMobile) {
      p.mulAssign(2.05);
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
      const off = vec3(
        fract(n.mul(17.3)).sub(0.5),
        fract(n.mul(41.9)).sub(0.5),
        fract(n.mul(73.1)).sub(0.5)
      ).mul(0.5);
      const dist = length(f.sub(off));
      const brightness = smoothstep(0.36, 0.0, dist);
      const twinkle = float(0.72).add(float(0.28).mul(sin(uTime.mul(float(2.4).add(n.mul(5.0))).add(n.mul(6.283)))));
      result.assign(brightness.mul(twinkle).mul(pow(n, 3.5)));
    });
    return result;
  });

  /* --- Shared Sky Shader Builder (parameterized by mode mix node) --- */
  function buildSkyColorNode(modeMixNode) {
    return Fn(() => {
      const dir = normalize(positionWorld.sub(cameraPosition));

      const rotSpeed = float(0.018).add(uEnergy.mul(0.032));
      const angle = uTime.mul(rotSpeed);
      const cosR = cos(angle);
      const sinR = sin(angle);
      const rotDir = vec3(
        dir.x.mul(cosR).sub(dir.z.mul(sinR)),
        dir.y,
        dir.x.mul(sinR).add(dir.z.mul(cosR))
      );

      // Domain-warped coordinates for silky aurora curtains & opalescent nebula.
      const q1 = fbm(rotDir.mul(1.35).add(vec3(0.0, uTime.mul(0.028), uTime.mul(0.015))));
      const q2 = fbm(rotDir.mul(2.15).sub(vec3(uTime.mul(0.022), 0.0, uTime.mul(0.018))).add(vec3(q1.mul(0.85))));

      const vGrad = clamp(dir.y.mul(0.5).add(0.5), 0.0, 1.0);

      /* === REALM 0: GATHER — Celestial Aurora Silk & Dreamy Twilight === */
      const gZenith = sRGBTransferEOTF(vec3(0.010, 0.014, 0.044));
      const gMid = sRGBTransferEOTF(vec3(0.028, 0.026, 0.098));
      const gHoriz = sRGBTransferEOTF(vec3(0.068, 0.028, 0.112));
      const gAqua = sRGBTransferEOTF(vec3(0.18, 0.88, 0.78));
      const gLavender = sRGBTransferEOTF(vec3(0.46, 0.44, 1.0));
      const gRoseCoral = sRGBTransferEOTF(vec3(0.95, 0.36, 0.42));
      const gChampagne = sRGBTransferEOTF(vec3(1.0, 0.82, 0.56));

      const gSky = mix(gHoriz, mix(gMid, gZenith, smoothstep(0.35, 0.9, vGrad)), smoothstep(0.0, 0.55, vGrad)).toVar();

      // Volumetric aurora silk curtains with soft vertical shimmer rays.
      const curtain1 = exp(abs(sin(dir.x.mul(1.9).add(q1.mul(2.4)).sub(uTime.mul(0.05)))).negate().mul(4.2))
        .mul(smoothstep(-0.35, 0.55, dir.y.add(q2.mul(0.35))));
      const curtain2 = exp(abs(sin(dir.x.mul(1.35).sub(dir.y.mul(1.6)).add(q2.mul(2.6)).add(uTime.mul(0.04)))).negate().mul(5.0))
        .mul(smoothstep(-0.55, 0.65, dir.y));
      const shimmerRays = float(0.65).add(float(0.35).mul(sin(dir.x.mul(16.0).add(q1.mul(8.0)).add(uTime.mul(0.35)))));

      const auroraCol1 = mix(gLavender, gAqua, smoothstep(-0.25, 0.55, q2));
      const auroraCol2 = mix(gRoseCoral, gChampagne, smoothstep(0.0, 0.75, q1));

      const energyBoost = float(0.55).add(uEnergy.mul(0.45));
      gSky.addAssign(auroraCol1.mul(curtain1).mul(shimmerRays).mul(0.24).mul(energyBoost));
      gSky.addAssign(auroraCol2.mul(curtain2).mul(0.18).mul(energyBoost));

      // Dreamy nebula mist & subtle core aura behind the assembling crystal mark.
      const nebMist = smoothstep(-0.1, 0.7, q1.mul(0.6).add(q2.mul(0.4)));
      gSky.addAssign(mix(gLavender, gRoseCoral, q2.mul(0.5).add(0.5)).mul(nebMist).mul(0.08));

      const centerProx = float(1.0).sub(smoothstep(0.0, 1.05, length(dir.xy)));
      const gHalo = centerProx.mul(centerProx).mul(float(0.05).add(uEnergy.mul(0.13)));
      gSky.addAssign(mix(gLavender, gChampagne, uEnergy).mul(gHalo));
      gSky.addAssign(mix(gRoseCoral, gChampagne, 0.5).mul(uIgnite.mul(0.10)));

      /* === REALM 1: SQUEEZE — Abyssal Opal & Caustic Prism Void === */
      const sZenith = sRGBTransferEOTF(vec3(0.008, 0.006, 0.026));
      const sMid = sRGBTransferEOTF(vec3(0.022, 0.018, 0.068));
      const sHoriz = sRGBTransferEOTF(vec3(0.065, 0.014, 0.072));
      const sOpalCyan = sRGBTransferEOTF(vec3(0.14, 0.84, 0.96));
      const sOrchid = sRGBTransferEOTF(vec3(0.72, 0.22, 0.94));
      const sMolten = sRGBTransferEOTF(vec3(0.96, 0.30, 0.22));
      const sGold = sRGBTransferEOTF(vec3(1.0, 0.74, 0.38));

      const sSky = mix(sHoriz, mix(sMid, sZenith, smoothstep(0.3, 0.9, vGrad)), smoothstep(0.0, 0.52, vGrad)).toVar();

      // Iridescent opal caustic ribbons & deep plasma veins.
      const vein1 = exp(abs(q1.sub(0.12)).negate().mul(9.5));
      const vein2 = exp(abs(q2.sub(0.20)).negate().mul(11.0));
      const caustic = pow(clamp(float(1.0).sub(abs(sin(q1.mul(6.0).add(q2.mul(5.0)).add(uTime.mul(0.25))))), 0.0, 1.0), 4.0);
      sSky.addAssign(mix(sOpalCyan, sOrchid, smoothstep(-0.3, 0.5, dir.x)).mul(vein1).mul(0.20));
      sSky.addAssign(mix(sOrchid, sMolten, uTension).mul(vein2).mul(float(0.15).add(uTension.mul(0.26))));
      sSky.addAssign(mix(sOpalCyan, sGold, uTension).mul(caustic).mul(0.075));

      // Reactive pressure furnace behind the crystal mark.
      const pulseWave = float(0.85).add(float(0.15).mul(sin(uTime.mul(float(3.0).add(uTension.mul(9.0))).sub(length(dir.xy).mul(8.0)))));
      const sCore = centerProx.mul(centerProx).mul(float(0.05).add(uTension.mul(0.22))).mul(pulseWave);
      sSky.addAssign(mix(sOpalCyan, sMolten, clamp(uTension.mul(1.2), 0.0, 1.0)).mul(sCore));
      sSky.addAssign(mix(sMolten, sGold, 0.45).mul(uPop.mul(0.09)));

      /* === Blend Realms + Shared Starlight, Pointer Aura & Vignette === */
      const sky = mix(gSky, sSky, modeMixNode).toVar();

      const starsFine = starField(rotDir, 46.0, 0.935);
      const starsBright = starField(rotDir.add(vec3(11.7, 5.3, 19.1)), 22.0, 0.985);
      const starCol = mix(
        mix(vec3(0.82, 0.94, 1.0), gChampagne, q2.mul(0.6)),
        mix(sOpalCyan, sGold, q1.mul(0.7)),
        modeMixNode
      );
      sky.addAssign(starsFine.mul(0.7).add(starsBright.mul(1.75)).mul(starCol));

      // Interactive pointer light bloom in the sky behind the cursor.
      const ptrDist = length(dir.xy.sub(uPointer.mul(0.38)));
      const ptrAura = smoothstep(0.95, 0.0, ptrDist);
      const ptrTint = mix(mix(gAqua, gRoseCoral, uEnergy), mix(sOpalCyan, sMolten, uTension), modeMixNode);
      sky.addAssign(ptrTint.mul(ptrAura).mul(0.14).mul(float(1.0).add(uEnergy.mul(0.5))));

      // Gentle optical vignette so the mark holds center stage.
      const vignette = float(1.0).sub(smoothstep(0.45, 1.55, length(dir.xy)));
      sky.mulAssign(clamp(float(0.76).add(vignette.mul(0.32)), 0.0, 1.0));

      return sky;
    })();
  }

  /* --- 1. Live Sky Dome --- */
  const skyGeo = new THREE.SphereGeometry(65, isMobile ? 24 : 44, isMobile ? 18 : 30);
  const skyMat = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  skyMat.colorNode = buildSkyColorNode(uModeMix);
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.renderOrder = -100;
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  // Pure static-mode sky materials for baking crisp PMREM environment maps.
  const envGatherMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  envGatherMat.colorNode = buildSkyColorNode(float(0.0));
  const envSqueezeMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  envSqueezeMat.colorNode = buildSkyColorNode(float(1.0));

  function getEnvSkyMaterial(mode = 'gather') {
    return mode === 'squeeze' ? envSqueezeMat : envGatherMat;
  }

  /* --- 2. 3D Volumetric Aurora Silk Veils (Parallax Depth Layers) --- */
  const veilConfigs = [
    { z: -11.5, y: 0.9, w: 32, h: 12, speed: 0.42, phase: 0.0, tiltZ: 0.07 },
    { z: -16.5, y: -0.7, w: 38, h: 14, speed: -0.34, phase: 2.1, tiltZ: -0.06 },
    { z: -22.0, y: 0.3, w: 46, h: 16, speed: 0.25, phase: 4.3, tiltZ: 0.04 },
  ];
  const veilMeshes = [];

  veilConfigs.forEach((cfg, idx) => {
    const geo = new THREE.PlaneGeometry(cfg.w, cfg.h, 32, 8);
    // Curve the silk plane gently into a panoramic concave arc.
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i);
      const normX = px / (cfg.w * 0.5);
      posAttr.setZ(i, normX * normX * 2.8);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const uPhase = float(cfg.phase);
    const uSpeed = float(cfg.speed);
    const uLayer = float(idx);

    const silkAlphaFn = Fn(() => {
      const vUv = uv();
      const xEdge = smoothstep(0.0, 0.22, vUv.x).mul(float(1.0).sub(smoothstep(0.78, 1.0, vUv.x)));
      const yEdge = smoothstep(0.0, 0.3, vUv.y).mul(float(1.0).sub(smoothstep(0.7, 1.0, vUv.y)));

      const wave = sin(vUv.x.mul(7.0).add(uTime.mul(uSpeed)).add(uPhase))
        .mul(0.5)
        .add(sin(vUv.x.mul(13.0).sub(uTime.mul(uSpeed.mul(1.4))).add(uLayer.mul(2.0))).mul(0.28));
      const bandPos = vUv.y.sub(0.5).add(wave.mul(0.22));
      const curtain = exp(abs(bandPos).negate().mul(7.5));
      const shimmer = float(0.65).add(float(0.35).mul(sin(vUv.x.mul(18.0).add(uTime.mul(1.2)).add(uPhase))));

      const intensity = float(0.065).add(uEnergy.mul(0.045)).add(uTension.mul(0.065));
      return xEdge.mul(yEdge).mul(curtain).mul(shimmer).mul(intensity);
    });

    mat.colorNode = Fn(() => {
      const vUv = uv();
      const gColA = sRGBTransferEOTF(vec3(0.26, 0.88, 0.80));
      const gColB = sRGBTransferEOTF(vec3(0.50, 0.44, 0.98));
      const gColC = sRGBTransferEOTF(vec3(0.96, 0.46, 0.36));
      const gGrad = mix(
        mix(gColA, gColB, smoothstep(0.1, 0.7, vUv.x)),
        gColC,
        smoothstep(0.4, 0.95, sin(vUv.x.mul(4.0).add(uTime.mul(0.3)).add(uPhase)).mul(0.5).add(0.5)).mul(0.45).add(uEnergy.mul(0.35))
      );

      const sColA = sRGBTransferEOTF(vec3(0.18, 0.82, 0.95));
      const sColB = sRGBTransferEOTF(vec3(0.74, 0.24, 0.90));
      const sColC = sRGBTransferEOTF(vec3(0.98, 0.34, 0.20));
      const sGrad = mix(
        mix(sColA, sColB, smoothstep(0.1, 0.8, vUv.x)),
        sColC,
        uTension.mul(0.75).add(uPop.mul(0.25))
      );

      return mix(gGrad, sGrad, uModeMix).mul(0.85);
    })();
    mat.opacityNode = silkAlphaFn();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, cfg.y, cfg.z);
    mesh.rotation.z = cfg.tiltZ;
    mesh.renderOrder = -70 + idx;
    mesh.frustumCulled = false;
    scene.add(mesh);
    veilMeshes.push(mesh);
  });

  /* --- 3. 3D Prismatic Caustic Halo (Behind the Mark) --- */
  const haloGeo = new THREE.PlaneGeometry(11.5, 11.5);
  const haloMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  haloMat.colorNode = Fn(() => {
    const p = uv().sub(0.5).mul(2.0);
    const d = length(p);
    If(d.greaterThan(1.0), () => {
      Discard();
    });

    const ringRadius = mix(
      mix(0.68, 0.54, uEnergy),
      mix(0.62, 0.42, uTension),
      uModeMix
    );
    const ring1 = smoothstep(0.11, 0.0, abs(d.sub(ringRadius)));
    const ring2 = smoothstep(0.06, 0.0, abs(d.sub(ringRadius.mul(0.76))));
    const softCore = pow(float(1.0).sub(d), 3.2).mul(0.32);

    const angleVal = sin(p.x.mul(5.0).add(p.y.mul(4.0)).add(uTime.mul(1.4))).mul(0.5).add(0.5);
    const gRingCol = mix(vec3(0.35, 0.88, 0.92), vec3(1.0, 0.65, 0.55), angleVal);
    const sRingCol = mix(vec3(0.45, 0.85, 1.0), vec3(1.0, 0.36, 0.24), clamp(uTension.mul(1.15), 0.0, 1.0));
    const col = mix(gRingCol, sRingCol, uModeMix);

    const fade = smoothstep(1.0, 0.25, d);
    const strength = float(0.08).add(uEnergy.mul(0.12)).add(uTension.mul(0.24)).add(uIgnite.mul(0.32)).add(uPop.mul(0.42));
    return col.mul(ring1.mul(0.55).add(ring2.mul(0.35)).add(softCore)).mul(fade).mul(strength);
  })();

  haloMat.opacityNode = Fn(() => {
    const p = uv().sub(0.5).mul(2.0);
    const d = length(p);
    const ringRadius = mix(
      mix(0.68, 0.54, uEnergy),
      mix(0.62, 0.42, uTension),
      uModeMix
    );
    const ring1 = smoothstep(0.11, 0.0, abs(d.sub(ringRadius)));
    const ring2 = smoothstep(0.06, 0.0, abs(d.sub(ringRadius.mul(0.76))));
    const softCore = pow(float(1.0).sub(d), 3.2).mul(0.32);
    const fade = smoothstep(1.0, 0.25, d);
    const strength = float(0.10).add(uEnergy.mul(0.12)).add(uTension.mul(0.22)).add(uIgnite.mul(0.28)).add(uPop.mul(0.38));
    return ring1.mul(0.55).add(ring2.mul(0.35)).add(softCore).mul(fade).mul(strength);
  })();

  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.set(0, 0, -1.8);
  haloMesh.renderOrder = -20;
  haloMesh.frustumCulled = false;
  scene.add(haloMesh);

  /* --- 4. Dual-Tier Dreamy Bokeh Orbs & 4-Point Diamond Sparkles --- */
  const stardustCount = isMobile ? 620 : 1450;
  const starBasePosBuf = instancedArray(stardustCount, 'vec3');
  const starMetaBuf = instancedArray(stardustCount, 'vec3'); // x = size, y = seed, z = kind (0=dust, 1=bokeh, 2=diamond)
  const starGatherColBuf = instancedArray(stardustCount, 'vec3');
  const starSqueezeColBuf = instancedArray(stardustCount, 'vec3');

  const posArr = starBasePosBuf.value.array;
  const metaArr = starMetaBuf.value.array;
  const gColArr = starGatherColBuf.value.array;
  const sColArr = starSqueezeColBuf.value.array;

  const colAqua = new THREE.Color(0x63f5dc);
  const colLavender = new THREE.Color(0x9ca6ff);
  const colRose = new THREE.Color(0xff8e7a);
  const colChampagne = new THREE.Color(0xffe5a8);
  const colOrchid = new THREE.Color(0xd56cff);
  const colCoral = new THREE.Color(PALETTE.coral);
  const colWhite = new THREE.Color(PALETTE.white);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < stardustCount; i++) {
    posArr[i * 3] = (Math.random() - 0.5) * 30.0;
    posArr[i * 3 + 1] = (Math.random() - 0.5) * 19.0;
    posArr[i * 3 + 2] = -14.0 + Math.random() * 19.0;

    const rKind = Math.random();
    let kind = 0;
    let sz = 4.0 + Math.random() * 6.5;
    if (rKind < 0.18) {
      kind = 1; // large dreamy bokeh orb
      sz = 18.0 + Math.random() * 24.0;
    } else if (rKind < 0.36) {
      kind = 2; // 4-point diamond starlight
      sz = 10.0 + Math.random() * 14.0;
    }

    metaArr[i * 3] = sz;
    metaArr[i * 3 + 1] = Math.random();
    metaArr[i * 3 + 2] = kind;

    // Gather color palette (pastel aurora silk)
    const p1 = Math.random();
    if (p1 < 0.32) tmpCol.copy(colWhite);
    else if (p1 < 0.55) tmpCol.copy(colAqua).lerp(colWhite, 0.25);
    else if (p1 < 0.78) tmpCol.copy(colLavender).lerp(colWhite, 0.2);
    else if (p1 < 0.90) tmpCol.copy(colRose);
    else tmpCol.copy(colChampagne);
    gColArr[i * 3] = tmpCol.r;
    gColArr[i * 3 + 1] = tmpCol.g;
    gColArr[i * 3 + 2] = tmpCol.b;

    // Squeeze color palette (opal cyan, orchid, molten coral, champagne)
    const p2 = Math.random();
    if (p2 < 0.25) tmpCol.copy(colWhite);
    else if (p2 < 0.50) tmpCol.copy(colAqua);
    else if (p2 < 0.72) tmpCol.copy(colOrchid);
    else if (p2 < 0.88) tmpCol.copy(colCoral);
    else tmpCol.copy(colChampagne);
    sColArr[i * 3] = tmpCol.r;
    sColArr[i * 3 + 1] = tmpCol.g;
    sColArr[i * 3 + 2] = tmpCol.b;
  }

  const starMeta = starMetaBuf.element(instanceIndex);
  const starSize = starMeta.x;
  const starSeed = starMeta.y;
  const starKind = starMeta.z;
  const starBasePos = starBasePosBuf.element(instanceIndex);

  const starPosNode = Fn(() => {
    const pos = starBasePos.toVar();
    const t = uTime.mul(0.20).add(starSeed.mul(6.2831));
    pos.x.addAssign(sin(t.mul(1.05).add(starSeed.mul(12.0))).mul(1.3).add(cos(t.mul(0.4).add(starSeed.mul(5.0))).mul(0.6)));
    pos.y.addAssign(cos(t.mul(0.85).add(starSeed.mul(8.0))).mul(0.95).add(sin(t.mul(0.32).add(starSeed.mul(7.0))).mul(0.4)));
    pos.z.addAssign(sin(t.mul(0.75).add(starSeed.mul(15.0))).mul(1.0));

    // Gentle orbital draw-in during Gather energy rise, and jitter/burst in Squeeze.
    If(uModeMix.lessThan(0.5), () => {
      pos.mulAssign(mix(1.0, 0.82, uEnergy.mul(0.42)));
    }).Else(() => {
      pos.mulAssign(mix(1.0, 0.85, uTension.mul(0.35)));
      pos.mulAssign(float(1.0).add(uPop.mul(0.35)));
    });
    return pos;
  })();

  const starUvCentered = uv().sub(0.5).mul(2.0);
  const starDist = length(starUvCentered);

  const starShape = Fn(() => {
    const s = float(0.0).toVar();
    If(starKind.greaterThan(1.5), () => {
      // 4-point optical diamond star flare
      const ax = abs(starUvCentered.x);
      const ay = abs(starUvCentered.y);
      const crossFlare = max(
        exp(ax.mul(12.0).negate()).mul(smoothstep(1.0, 0.0, ay)),
        exp(ay.mul(12.0).negate()).mul(smoothstep(1.0, 0.0, ax))
      );
      const core = float(1.0).sub(smoothstep(0.0, 0.35, starDist));
      s.assign(clamp(crossFlare.mul(0.75).add(core.mul(0.85)), 0.0, 1.0));
    }).ElseIf(starKind.greaterThan(0.5), () => {
      // Soft creamy optical camera-lens bokeh orb (gentle luminous disc, subtle outer glow)
      const disc = float(1.0).sub(smoothstep(0.0, 0.95, starDist));
      const softOrb = pow(disc, 1.5);
      const subtleRim = smoothstep(0.5, 0.82, starDist).mul(float(1.0).sub(smoothstep(0.82, 1.0, starDist))).mul(0.22);
      s.assign(softOrb.mul(0.48).add(subtleRim));
    }).Else(() => {
      // Fine stardust mote
      const halo = float(1.0).sub(smoothstep(0.0, 1.0, starDist));
      const core = float(1.0).sub(smoothstep(0.0, 0.30, starDist));
      s.assign(halo.mul(0.48).add(core.mul(0.85)));
    });
    return s;
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
  starMat.sizeNode = starSize.mul(0.032);
  starMat.colorNode = Fn(() => {
    If(starDist.greaterThan(1.0), () => {
      Discard();
    });
    const col = mix(starGatherColBuf.element(instanceIndex), starSqueezeColBuf.element(instanceIndex), uModeMix);
    return col.mul(starShape());
  })();
  starMat.opacityNode = Fn(() => {
    const pulse = float(0.68).add(float(0.32).mul(sin(uTime.mul(float(1.4).add(starSeed.mul(2.2))).add(starSeed.mul(24.0)))));
    const baseOpacity = starKind.greaterThan(0.5).select(float(0.32), float(0.65));
    return pulse.mul(float(0.42).add(starSeed.mul(0.55))).mul(starShape()).mul(baseOpacity);
  })();

  const starPoints = new THREE.Sprite(starMat);
  starPoints.count = stardustCount;
  starPoints.renderOrder = -45;
  starPoints.frustumCulled = false;
  scene.add(starPoints);

  /* --- 5. Chromatic Dispersion Shockwave Mesh --- */
  const uShockProgress = uniform(1.0);
  const uShockColor = uniform(new THREE.Color(PALETTE.coral));
  const uShockIntensity = uniform(0);

  const shockGeo = new THREE.PlaneGeometry(18, 18);
  const shockMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  function shockSignal() {
    const d = length(uv().sub(0.5)).mul(2.0);
    const ringR = clamp(uShockProgress.mul(1.12), 0.0, 1.2);
    const thick = mix(0.048, 0.016, uShockProgress);
    const rBand = smoothstep(thick, 0.0, abs(d.sub(ringR)));
    const gBand = smoothstep(thick, 0.0, abs(d.sub(ringR.sub(0.022))));
    const bBand = smoothstep(thick, 0.0, abs(d.sub(ringR.sub(0.044))));
    const fade = float(1.0).sub(uShockProgress).mul(float(1.0).sub(uShockProgress));
    return { rBand, gBand, bBand, fade };
  }

  shockMat.colorNode = Fn(() => {
    const sig = shockSignal();
    const total = sig.rBand.add(sig.gBand).add(sig.bBand);
    const alpha = total.mul(sig.fade).mul(uShockIntensity);
    If(alpha.lessThanEqual(0.001), () => {
      Discard();
    });
    const prism = vec3(1.0, 0.42, 0.32).mul(sig.rBand)
      .add(vec3(1.0, 0.88, 0.56).mul(sig.gBand))
      .add(vec3(0.40, 0.85, 1.0).mul(sig.bBand));
    return mix(prism, uShockColor, 0.3).mul(sig.fade).mul(uShockIntensity).mul(0.32);
  })();

  shockMat.opacityNode = Fn(() => {
    const sig = shockSignal();
    return sig.rBand.add(sig.gBand.mul(0.75)).add(sig.bBand.mul(0.65)).mul(sig.fade).mul(uShockIntensity).mul(0.36);
  })();

  const shockMesh = new THREE.Mesh(shockGeo, shockMat);
  shockMesh.position.set(0, 0, 0.08);
  shockMesh.renderOrder = 10;
  shockMesh.visible = false;
  scene.add(shockMesh);

  let shockwaveActive = false;
  let shockwaveTimer = 0;
  const SHOCKWAVE_DURATION = 1.05;

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

  /* --- 6. Iridescent Caustic Pointer Ripple --- */
  const uRippleStrength = uniform(0);

  const rippleGeo = new THREE.PlaneGeometry(4.0, 4.0);
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
    const w1 = sin(d.mul(16.0).sub(uTime.mul(6.0))).mul(0.5).add(0.5);
    const w2 = sin(d.mul(22.0).sub(uTime.mul(8.5)).add(1.2)).mul(0.5).add(0.5);
    const falloff = float(1.0).sub(d).mul(float(1.0).sub(d));
    const gPrism = mix(vec3(0.45, 0.92, 0.88), vec3(1.0, 0.62, 0.52), w2);
    const sPrism = mix(vec3(0.40, 0.88, 1.0), vec3(1.0, 0.36, 0.24), w1);
    const col = mix(gPrism, sPrism, uModeMix);
    return col.mul(w1.mul(0.65).add(w2.mul(0.45))).mul(falloff).mul(uRippleStrength).mul(1.35);
  })();

  rippleMat.opacityNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2.0);
    const w1 = sin(d.mul(16.0).sub(uTime.mul(6.0))).mul(0.5).add(0.5);
    const falloff = float(1.0).sub(d).mul(float(1.0).sub(d));
    return w1.mul(falloff).mul(uRippleStrength).mul(0.65);
  })();

  const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
  rippleMesh.position.set(0, 0, 0.04);
  rippleMesh.renderOrder = 6;
  scene.add(rippleMesh);

  let rippleTargetStrength = 0;
  let rippleCurrentStrength = 0;

  function setPointerRipple(worldPos, dragging, speed) {
    if (dragging) {
      rippleMesh.position.x = worldPos.x;
      rippleMesh.position.y = worldPos.y;
      rippleTargetStrength = Math.min(1.15, 0.45 + speed * 0.7);
    } else {
      rippleTargetStrength = 0;
    }
  }

  function setMode(modeName, instant = false) {
    targetModeMix = modeName === 'squeeze' ? 1 : 0;
    if (instant || reduced) {
      uModeMix.value = targetModeMix;
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
    if (state.ndc) {
      uPointer.value.set(state.ndc.x, state.ndc.y);
      // Gentle parallax shift on volumetric veils for dreamy 3D depth.
      veilMeshes.forEach((m, idx) => {
        const depthFactor = 0.45 + idx * 0.35;
        m.position.x = -state.ndc.x * depthFactor;
      });
    }

    // Smoothly crossfade between Gather & Squeeze realms.
    const mixStep = 1 - Math.exp(-3.2 * dt);
    uModeMix.value += (targetModeMix - uModeMix.value) * mixStep;

    if (shockwaveActive) {
      shockwaveTimer += dt;
      const progress = shockwaveTimer / SHOCKWAVE_DURATION;
      if (progress >= 1.0) {
        shockwaveActive = false;
        shockMesh.visible = false;
      } else {
        uShockProgress.value = progress;
        const scale = 1.0 + progress * 1.65;
        shockMesh.scale.set(scale, scale, 1);
      }
    }

    rippleCurrentStrength += (rippleTargetStrength - rippleCurrentStrength) * (dt * 12.0);
    uRippleStrength.value = rippleCurrentStrength;
  }

  function resize() {}

  function dispose() {
    skyGeo.dispose();
    skyMat.dispose();
    envGatherMat.dispose();
    envSqueezeMat.dispose();
    veilMeshes.forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
    });
    haloGeo.dispose();
    haloMat.dispose();
    starMat.dispose();
    shockGeo.dispose();
    shockMat.dispose();
    rippleGeo.dispose();
    rippleMat.dispose();
  }

  return {
    update,
    resize,
    setMode,
    getModeMix: () => uModeMix.value,
    getEnvSkyMaterial,
    triggerShockwave,
    setPointerRipple,
    reset,
    dispose,
  };
}
