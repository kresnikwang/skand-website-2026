/**
 * SKAND B-Side — three scene, camera and post-processing.
 *
 * Mirrors scripts/egg/scene.js: same three@0.170.0 pin via absolute esm.sh
 * URLs, same renderer settings, same EffectComposer + UnrealBloomPass stack.
 * The one deliberate difference is the camera — no OrbitControls here. Letting
 * the visitor fly the camera would let them tumble the composition apart and
 * lose the reveal; instead the camera does a slow parallax drift that follows
 * the pointer, which reads as depth without ever handing over control.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { EffectComposer } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/AfterimagePass.js';
import { PALETTE } from './config.js?v=20260925d';
import { createBackground } from './background.js?v=20261112';

export function createScene({ canvas, tier, reduced }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier.name !== 'mobile',
      alpha: false,
      powerPreference: tier.name === 'desktop' ? 'high-performance' : 'low-power',
    });
  } catch (e) {
    console.error('[bside] WebGL init failed', e);
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // Depth fog blended with deep cosmic void so the far side of the chaos
  // cloud melts into the ethereal nebula.
  scene.fog = new THREE.FogExp2(0x060810, tier.name === 'desktop' ? 0.016 : 0.022);

  // Ethereal cosmic nebula dome, ambient stardust bokeh & shockwaves.
  const background = createBackground(scene, tier, reduced);

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  const camBaseZ = tier.name === 'mobile' ? 13.5 : 11;
  camera.position.set(0, 0, camBaseZ);

  // Post-processing. Bloom is the whole point of the upgrade; Afterimage only
  // rides along for the ignition trails and is skipped under reduced motion.
  let composer = null;
  let bloomPass = null;
  let afterimagePass = null;
  if (tier.bloom) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.36,
        0.42,
        0.65
      );
      composer.addPass(bloomPass);
      if (!reduced) {
        afterimagePass = new AfterimagePass(0.0);
        composer.addPass(afterimagePass);
      }
    } catch (e) {
      console.warn('[bside] post-processing unavailable, rendering direct', e);
      composer = null;
      bloomPass = null;
      afterimagePass = null;
    }
  }

  // Camera parallax state.
  let parallaxX = 0;
  let parallaxY = 0;
  let targetPX = 0;
  let targetPY = 0;
  // Impact shake, 0..1. Squeeze mode kicks this on every pop and the pop timeline
  // decays it; at that magnitude the kick is large enough to feel in the frame
  // edges but small enough that nothing on screen goes unreadable.
  let shakeAmt = 0;
  let shakeT = 0;

  function setShake(v) {
    shakeAmt = Math.max(0, Math.min(1, v || 0));
  }

  function setParallaxTarget(nx, ny) {
    // nx, ny are normalized device coords (-1..1) from the pointer.
    targetPX = nx;
    targetPY = ny;
  }

  function updateCamera(dt) {
    const k = reduced ? 1 : 1 - Math.pow(0.001, dt); // frame-rate independent ease
    parallaxX += (targetPX - parallaxX) * k;
    parallaxY += (targetPY - parallaxY) * k;
    camera.position.x = parallaxX * 0.9;
    camera.position.y = -parallaxY * 0.6;
    // A slow idle breathing on z keeps the frame alive when the pointer is still.
    const t = performance.now() * 0.001;
    camera.position.z = camBaseZ + (reduced ? 0 : Math.sin(t * 0.25) * 0.25);
    if (shakeAmt > 0.0001) {
      shakeT += dt;
      const s = shakeAmt * shakeAmt * 0.5;
      camera.position.x += Math.sin(shakeT * 61) * s;
      camera.position.y += Math.sin(shakeT * 47 + 1.3) * s;
      camera.rotation.z = Math.sin(shakeT * 53) * s * 0.02;
    } else {
      camera.rotation.z *= 0.9;
    }
    camera.lookAt(0, 0, 0);
  }

  function setIgnite(heat) {
    if (bloomPass) {
      // Bloom ramps hard at the ignition beat then relaxes.
      bloomPass.strength = 0.36 + heat * 1.35;
    }
    if (afterimagePass) {
      afterimagePass.uniforms.damp.value = heat * 0.88;
    }
  }

  function setBloomBase(v) {
    if (bloomPass && bloomPass.strength < 0.65 + 0.0001) {
      bloomPass.strength = v;
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxPixelRatio));
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    if (bloomPass) bloomPass.resolution.set(w, h);
    background.resize(renderer.getPixelRatio(), h);
    return { w, h, height: h, pixelRatio: renderer.getPixelRatio() };
  }

  function render() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    composer,
    bloomPass,
    background,
    setParallaxTarget,
    setIgnite,
    setShake,
    setBloomBase,
    updateCamera,
    resize,
    render,
  };
}
