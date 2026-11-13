/**
 * SKAND B-Side — Three.js r187 WebGPU Compute Particle System.
 *
 * Up to 129,600 particles (WebGPU desktop) / 65,536 (WebGL2 fallback) whose
 * physics runs on-GPU via TSL compute shaders (`Fn(...).compute(total)`) over
 * storage buffers (`instancedArray`), rendered with `PointsNodeMaterial` on an
 * instanced `THREE.Sprite` so particles scale cleanly past WebGPU's 1px point
 * limit. Automatically runs as native WGSL compute on WebGPU or double-buffered
 * Transform Feedback on WebGL2 fallback.
 */

import * as THREE from 'https://esm.sh/three@0.187.0/webgpu';
import {
  Fn,
  If,
  Discard,
  float,
  vec3,
  vec4,
  uniform,
  uv,
  length,
  distance,
  normalize,
  sin,
  cos,
  abs,
  sign,
  max,
  mix,
  clamp,
  smoothstep,
  instancedArray,
  instanceIndex,
} from 'https://esm.sh/three@0.187.0/tsl';
import { PALETTE, LETTER_COLORS } from './config.js?v=20261113';

/**
 * @param {WebGPURenderer} renderer
 * @param {object} opts { size, targets, worldScale, bounds }
 * @returns particle system handle with .points, .setState(), .update(), .dispose()
 */
export function createParticleSystem(renderer, opts) {
  const { size, targets, worldScale, bounds } = opts;
  const total = size * size;

  const data = buildParticles(size, targets, bounds);

  // Storage buffers (instancedArray).
  const positionBuffer = instancedArray(data.position, 'vec4');
  const velocityBuffer = instancedArray(data.velocity, 'vec4');
  const targetBuffer = instancedArray(data.targetData, 'vec4'); // xyz = normalized target, w = stagger
  const metaBuffer = instancedArray(data.metaData, 'vec4');     // x = random, y = group, z = seed, w = letterIdx
  const colorBuffer = instancedArray(data.aColor, 'vec3');

  // Uniforms driven by JS each frame.
  const uDt = uniform(0.016);
  const uTime = uniform(0);
  const uMorph = uniform(0);
  const uChaos = uniform(1);
  const uImpulse = uniform(0);
  const uPointer = uniform(new THREE.Vector3(0, 0, 0));
  const uPointerForce = uniform(0);
  const uRevealed = uniform(0);
  const uBounds = uniform(bounds);
  const uWorldScale = uniform(worldScale);
  const uSqueeze = uniform(0);
  const uPress = uniform(new THREE.Vector3(0, 0, 0));
  const uPressRadius = uniform(1);
  const uIgnite = uniform(0);
  const uSize = uniform(size >= 256 ? 3.8 : 5.0);
  const uIdleColor = uniform(new THREE.Color(PALETTE.white).lerp(new THREE.Color(PALETTE.dim), 0.35));

  /* ---------- GPU Compute: Velocity ---------- */
  const computeVelocity = Fn(() => {
    const posData = positionBuffer.element(instanceIndex);
    const pos = posData.xyz;
    const vel = velocityBuffer.element(instanceIndex).xyz.toVar();
    const tgt = targetBuffer.element(instanceIndex);
    const meta = metaBuffer.element(instanceIndex);

    const group = meta.y;     // 0 = frame, 1 = letters
    const seed = meta.z;
    const stagger = tgt.w;

    const groupDelay = group.mul(0.30);
    const mRaw = clamp(uMorph.sub(groupDelay).sub(stagger.mul(0.30)).div(0.40), 0.0, 1.0);
    const m = mRaw.mul(mRaw).mul(float(3.0).sub(mRaw.mul(2.0)));

    const target = tgt.xyz.mul(uWorldScale);

    // Divergence-free-ish flow for the chaos cloud.
    const sAngle = seed.mul(6.2831);
    const flow = vec3(
      sin(pos.y.mul(0.55).add(uTime.mul(0.7)).add(sAngle)),
      cos(pos.z.mul(0.55).add(uTime.mul(0.55)).add(sAngle.mul(1.7))),
      sin(pos.x.mul(0.55).add(uTime.mul(0.8)).add(sAngle.mul(2.3)))
    );

    // Spring toward target, gated by morph.
    const toTarget = target.sub(pos);
    vel.addAssign(toTarget.mul(m.mul(2.8)));

    // Squeeze mode: global anisotropic compression + high-frequency shiver.
    If(uSqueeze.greaterThan(0.001), () => {
      const sq = target.toVar();
      sq.x.mulAssign(float(1.0).sub(uSqueeze.mul(0.13)));
      sq.y.mulAssign(float(1.0).add(uSqueeze.mul(0.17)));
      sq.z.mulAssign(float(1.0).add(uSqueeze.mul(0.12)));
      const s2 = uSqueeze.mul(uSqueeze);
      sq.y.addAssign(sin(uTime.mul(34.0).add(seed.mul(21.0))).mul(0.035).mul(s2));
      sq.x.addAssign(sin(uTime.mul(27.0).add(seed.mul(13.0))).mul(0.020).mul(s2));
      vel.addAssign(sq.sub(pos).mul(m.mul(uSqueeze).mul(7.5)));
    });

    // Squeeze mode: local fingertip dent + rim bulge.
    If(uPress.z.greaterThan(0.001), () => {
      const rel = target.sub(uPress);
      const d = length(rel);
      const t = d.div(uPressRadius);
      If(t.lessThan(2.0), () => {
        const k = uPress.z.mul(m);
        const bowl = float(0.0).toVar();
        If(t.lessThan(1.0), () => {
          bowl.assign(float(0.5).add(float(0.5).mul(cos(t.mul(3.14159265)))));
        });
        const rim = smoothstep(0.85, 1.15, t).mul(float(1.0).sub(smoothstep(1.15, 2.0, t)));
        const dir = rel.div(max(d, 0.001));
        const to = uPress.add(dir.mul(d).mul(float(1.0).sub(bowl.mul(0.42).mul(k)))).toVar();
        to.addAssign(dir.mul(rim).mul(uPressRadius).mul(0.10).mul(k));
        vel.addAssign(to.sub(pos).mul(m.mul(uPress.z).mul(7.0)));
      });
    });

    // Chaos flow.
    vel.addAssign(flow.mul(uChaos.mul(1.5)));

    // Pointer wake: attract while dragging, repel otherwise.
    const toPointer = uPointer.sub(pos);
    const pd = length(toPointer);
    const pointerRadius = uRevealed.greaterThan(0.5).select(float(0.9), float(6.5));
    If(pd.lessThan(pointerRadius).and(pd.greaterThan(0.001)), () => {
      const f = pointerRadius.sub(pd).div(pointerRadius);
      const f2 = f.mul(f);
      vel.addAssign(toPointer.div(pd).mul(f2).mul(uPointerForce));
      If(uPointerForce.greaterThan(0.0), () => {
        const tangent = normalize(vec3(
          toPointer.y.negate(),
          toPointer.x,
          sin(uTime.mul(3.0).add(seed.mul(6.28))).mul(0.35)
        ));
        vel.addAssign(tangent.mul(f2).mul(float(1.15).add(uChaos.mul(0.75))));
      });
    });

    // Ignition: radial burst from center.
    If(uImpulse.greaterThan(0.001), () => {
      const dir = normalize(pos.add(vec3(0.0001)));
      vel.addAssign(dir.mul(uImpulse).mul(float(0.4).add(seed.mul(1.2))));
    });

    // Damping.
    vel.mulAssign(mix(0.945, 0.86, m));

    // Soft containment of the chaos volume.
    If(m.lessThan(0.5), () => {
      const over = max(abs(pos).sub(uBounds), 0.0).mul(sign(pos));
      vel.subAssign(over.mul(0.9));
    });

    velocityBuffer.element(instanceIndex).assign(vec4(vel, 0.0));
  })().compute(total);

  /* ---------- GPU Compute: Position ---------- */
  const computePosition = Fn(() => {
    const posData = positionBuffer.element(instanceIndex);
    const vel = velocityBuffer.element(instanceIndex).xyz;
    const nextPos = posData.xyz.add(vel.mul(uDt));
    positionBuffer.element(instanceIndex).assign(vec4(nextPos, posData.w));
  })().compute(total);

  /* ---------- Render Material (PointsNodeMaterial on instanced Sprite) ---------- */
  const posNode = positionBuffer.element(instanceIndex).xyz;
  const metaNode = metaBuffer.element(instanceIndex);
  const aRandom = metaNode.x;
  const aSeed = metaNode.z;
  const aColor = colorBuffer.element(instanceIndex);

  const hotFactor = Fn(([pos]) => {
    const hot = float(0.0).toVar();
    If(uPress.z.greaterThan(0.001), () => {
      hot.assign(
        uPress.z.mul(float(1.0).sub(smoothstep(uPressRadius.mul(0.2), uPressRadius.mul(1.1), distance(pos, uPress))))
      );
    });
    return hot;
  });

  const particleSize = Fn(() => {
    const pos = posNode;
    const hot = hotFactor(pos);
    const base = uSize
      .mul(float(0.65).add(aRandom.mul(0.7)))
      .mul(mix(1.0, 0.58, uMorph))
      .mul(float(1.0).add(uIgnite.mul(0.65)))
      .mul(float(1.0).add(hot.mul(0.3)));
    // PointsNodeMaterial multiplies sizeNode by screenDPR * (0.5 * height / -mv.z).
    return base.mul(0.02);
  })();

  const spriteDist = length(uv().sub(0.5)).mul(2.0);

  const particleColor = Fn(() => {
    If(spriteDist.greaterThan(1.0), () => {
      Discard();
    });

    const pos = posNode;
    const mixT = clamp(uMorph.mul(1.2), 0.0, 1.0);
    const col = mix(uIdleColor, aColor, mixT).toVar();

    If(mixT.greaterThan(0.08), () => {
      const wave = sin(pos.x.mul(2.2).add(pos.y.mul(2.8)).sub(uTime.mul(3.4)).add(aSeed.mul(3.1415)));
      const pulse = smoothstep(0.68, 1.0, wave);
      const energyColor = mix(vec3(0.91, 0.34, 0.23), vec3(1.0, 0.88, 0.72), aRandom);
      col.assign(mix(col, energyColor, pulse.mul(0.58).mul(mixT)));
    });

    col.assign(mix(col, vec3(1.0, 0.95, 0.90), uIgnite.mul(0.85)));

    const hot = hotFactor(pos);
    col.assign(mix(col, vec3(1.0, 0.93, 0.86), hot.mul(0.45)));

    const tw = float(0.85).add(float(0.15).mul(sin(uTime.mul(2.0).add(aSeed.mul(40.0)))));
    const chaosT = float(1.0).sub(clamp(uMorph, 0.0, 1.0));
    col.mulAssign(mix(1.0, tw, chaosT.mul(0.6)));

    const body = float(1.0).sub(smoothstep(0.12, 1.0, spriteDist));
    const core = float(1.0).sub(smoothstep(0.0, 0.28, spriteDist));
    const spark = float(1.0).sub(smoothstep(0.0, 0.09, spriteDist));
    const vCore = float(0.5).add(aRandom.mul(0.5));

    const outCol = col.mul(body.mul(0.78).add(core.mul(0.95).mul(vCore))).toVar();
    outCol.addAssign(vec3(1.0, 0.98, 0.95).mul(spark).mul(0.65));
    return outCol;
  })();

  const particleAlpha = Fn(() => {
    const pos = posNode;
    const mixT = clamp(uMorph.mul(1.2), 0.0, 1.0);
    const hot = hotFactor(pos);
    const vAlpha = mix(0.62, 1.0, mixT).add(hot.mul(0.12));
    const body = float(1.0).sub(smoothstep(0.12, 1.0, spriteDist));
    return vAlpha.mul(body);
  })();

  const material = new THREE.PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  material.positionNode = posNode;
  material.sizeNode = particleSize;
  material.colorNode = particleColor;
  material.opacityNode = particleAlpha;

  const points = new THREE.Sprite(material);
  points.count = total;
  points.renderOrder = 2;
  points.frustumCulled = false;

  function setState(s) {
    if (s.morph !== undefined) uMorph.value = s.morph;
    if (s.chaos !== undefined) uChaos.value = s.chaos;
    if (s.impulse !== undefined) uImpulse.value = s.impulse;
    if (s.pointerForce !== undefined) uPointerForce.value = s.pointerForce;
    if (s.revealed !== undefined) uRevealed.value = s.revealed ? 1 : 0;
    if (s.squeeze !== undefined) uSqueeze.value = s.squeeze;
    if (s.press) {
      uPress.value.set(s.press.x, s.press.y, s.press.strength);
    }
    if (s.pressRadius !== undefined) uPressRadius.value = s.pressRadius;
    if (s.ignite !== undefined) uIgnite.value = s.ignite;
    if (s.pointer) uPointer.value.copy(s.pointer);
  }

  function update(dt, time) {
    uDt.value = dt;
    uTime.value = time;
    renderer.compute([computeVelocity, computePosition]);
  }

  function setPixelRatio() {
    // Handled natively by PointsNodeMaterial screenDPR node.
  }

  function setHeight() {
    // Handled natively by PointsNodeMaterial viewport height node.
  }

  function setWorldScale(v) {
    uWorldScale.value = v;
  }

  function dispose() {
    material.dispose();
    computeVelocity.dispose();
    computePosition.dispose();
  }

  return { points, setState, update, setPixelRatio, setHeight, setWorldScale, dispose, total, size };
}

function buildParticles(size, targets, bounds) {
  const total = size * size;
  const frameCount = targets.frame.count;
  const letterCount = targets.letters.count;

  const position = new Float32Array(total * 4);
  const velocity = new Float32Array(total * 4);
  const targetData = new Float32Array(total * 4);
  const metaData = new Float32Array(total * 4);
  const aColor = new Float32Array(total * 3);
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

    const col = rnd > 0.985 ? PALETTE.coral : (letterIdx >= 0 ? LETTER_COLORS[letterIdx % LETTER_COLORS.length] : PALETTE.dim);
    tmp.setHex(col);
    aColor[i * 3] = tmp.r;
    aColor[i * 3 + 1] = tmp.g;
    aColor[i * 3 + 2] = tmp.b;
  }

  return { position, velocity, targetData, metaData, aColor, total };
}
