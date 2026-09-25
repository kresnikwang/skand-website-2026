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
import { PALETTE } from './config.js';

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
  scene.background = new THREE.Color(PALETTE.black);
  // Depth fog so the far side of the chaos cloud falls away instead of
  // stacking into a flat wall of dots.
  scene.fog = new THREE.FogExp2(PALETTE.black, tier.name === 'desktop' ? 0.03 : 0.04);

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
        0.55, // strength — pushed higher at ignition
        0.7,  // radius
        0.2   // threshold; low so the particles bloom generously
      );
      composer.addPass(bloomPass);
      if (!reduced) {
        afterimagePass = new AfterimagePass(0.82);
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
    camera.lookAt(0, 0, 0);
  }

  function setIgnite(heat) {
    if (bloomPass) {
      // Bloom ramps hard at the ignition beat then relaxes.
      bloomPass.strength = 0.55 + heat * 1.1;
    }
    if (afterimagePass) {
      // 0.0 disables the trail effect; hold damp high only while igniting.
      afterimagePass.uniforms.damp.value = 0.82 - heat * 0.34;
    }
  }

  function setBloomBase(v) {
    if (bloomPass && bloomPass.strength < 0.55 + 0.0001) {
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
    return { w, h, pixelRatio: renderer.getPixelRatio() };
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
    setParallaxTarget,
    setIgnite,
    setBloomBase,
    updateCamera,
    resize,
    render,
  };
}
