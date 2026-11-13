/**
 * SKAND B-Side — Three.js r187 WebGPURenderer scene, camera & TSL RenderPipeline.
 *
 * Uses WebGPURenderer (with automatic WebGL2 backend fallback), TSL RenderPipeline
 * with HDR BloomNode + AfterImageNode, and camera parallax drift.
 */

import * as THREE from 'https://esm.sh/three@0.187.0/webgpu';
import { pass, uniform } from 'https://esm.sh/three@0.187.0/tsl';
import { bloom } from 'https://esm.sh/three@0.187.0/examples/jsm/tsl/display/BloomNode.js';
import { afterImage } from 'https://esm.sh/three@0.187.0/examples/jsm/tsl/display/AfterImageNode.js';
import { createBackground } from './background.js?v=20261113';

export async function createScene({ canvas, tier, reduced }) {
  let renderer;
  try {
    renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: tier.name !== 'mobile',
      alpha: false,
      powerPreference: tier.name === 'desktop' ? 'high-performance' : 'low-power',
    });
    await renderer.init();
  } catch (e) {
    console.error('[bside] Renderer init failed', e);
    return null;
  }

  const isWebGPU = Boolean(renderer.backend?.isWebGPUBackend);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
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

  // TSL RenderPipeline: HDR pass + BloomNode + AfterImageNode (unless reduced motion).
  let renderPipeline = null;
  const bloomStrength = uniform(0.36);
  const bloomRadius = uniform(0.42);
  const bloomThreshold = uniform(0.65);
  const afterImageDamp = uniform(0.0);

  if (tier.bloom) {
    try {
      renderPipeline = new THREE.RenderPipeline(renderer);
      const scenePass = pass(scene, camera);
      const scenePassColor = scenePass.getTextureNode('output');
      const bloomNode = bloom(scenePassColor, bloomStrength, bloomRadius, bloomThreshold);
      let outputNode = scenePassColor.add(bloomNode);
      if (!reduced) {
        outputNode = afterImage(outputNode, afterImageDamp);
      }
      renderPipeline.outputNode = outputNode;
    } catch (e) {
      console.warn('[bside] RenderPipeline unavailable, rendering direct', e);
      renderPipeline = null;
    }
  }

  // Camera parallax state.
  let parallaxX = 0;
  let parallaxY = 0;
  let targetPX = 0;
  let targetPY = 0;
  let shakeAmt = 0;
  let shakeT = 0;

  function setShake(v) {
    shakeAmt = Math.max(0, Math.min(1, v || 0));
  }

  function setParallaxTarget(nx, ny) {
    targetPX = nx;
    targetPY = ny;
  }

  function updateCamera(dt) {
    const k = reduced ? 1 : 1 - Math.pow(0.001, dt);
    parallaxX += (targetPX - parallaxX) * k;
    parallaxY += (targetPY - parallaxY) * k;
    camera.position.x = parallaxX * 0.9;
    camera.position.y = -parallaxY * 0.6;
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
    bloomStrength.value = 0.36 + heat * 1.35;
    if (!reduced) {
      afterImageDamp.value = heat * 0.88;
    }
  }

  function setBloomBase(v) {
    if (bloomStrength.value < 0.65 + 0.0001) {
      bloomStrength.value = v;
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxPixelRatio));
    renderer.setSize(w, h, false);
    background.resize(renderer.getPixelRatio(), h);
    return { w, h, height: h, pixelRatio: renderer.getPixelRatio() };
  }

  function render() {
    if (renderPipeline) renderPipeline.render();
    else renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    renderPipeline,
    isWebGPU,
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
