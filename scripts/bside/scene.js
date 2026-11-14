/**
 * SKAND B-Side — Three.js r187 WebGPURenderer scene, IBL lighting & TSL RenderPipeline.
 *
 * Uses WebGPURenderer (with automatic WebGL2 backend fallback), live PMREM
 * environment cubemaps from the active dreamy realm for 3D glass refraction,
 * 3-point + reactive rim lighting, TSL RenderPipeline with HDR BloomNode +
 * AfterImageNode, and smooth camera parallax.
 */

import * as THREE from 'https://esm.sh/three@0.187.0/webgpu';
import { pass, uniform } from 'https://esm.sh/three@0.187.0/tsl';
import { bloom } from 'https://esm.sh/three@0.187.0/examples/jsm/tsl/display/BloomNode.js';
import { afterImage } from 'https://esm.sh/three@0.187.0/examples/jsm/tsl/display/AfterImageNode.js';
import { createBackground } from './background.js?v=20261115';

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
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060714, tier.name === 'desktop' ? 0.014 : 0.020);

  // Dreamy twin-realm backgrounds (Gather Aurora Silk & Squeeze Abyssal Opal).
  const background = createBackground(scene, tier, reduced);

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  const camBaseZ = tier.name === 'mobile' ? 13.5 : 11;
  camera.position.set(0, 0, camBaseZ);

  // 3-Point + Reactive Rim Lighting for 3D Voronoi glass shards.
  const ambientLight = new THREE.AmbientLight(0xdbe8ff, 0.28);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.3);
  keyLight.position.set(-6, 8, 9);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x7ab4ff, 1.25);
  fillLight.position.set(7, -4, 6);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xff785a, 2.4, 30, 1.6);
  rimLight.position.set(0, 0.6, 4.2);
  scene.add(rimLight);

  // Bake PMREM environment cubemaps from both dreamy realms so glass shards
  // catch real aurora & opalescent reflections.
  let envGatherRT = null;
  let envSqueezeRT = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envGeo = new THREE.SphereGeometry(50, 32, 20);
    const envScene = new THREE.Scene();
    const envMesh = new THREE.Mesh(envGeo, background.getEnvSkyMaterial('gather'));
    envMesh.frustumCulled = false;
    envScene.add(envMesh);

    envGatherRT = pmrem.fromScene(envScene, 0, 0.1, 100);
    envMesh.material = background.getEnvSkyMaterial('squeeze');
    envSqueezeRT = pmrem.fromScene(envScene, 0, 0.1, 100);

    scene.environment = envGatherRT.texture;
    envGeo.dispose();
    pmrem.dispose();
  } catch (e) {
    console.warn('[bside] PMREM environment bake skipped', e);
  }

  // TSL RenderPipeline: HDR pass + BloomNode + AfterImageNode.
  let renderPipeline = null;
  const bloomStrength = uniform(0.32);
  const bloomRadius = uniform(0.48);
  const bloomThreshold = uniform(0.78);
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

  // Camera parallax & shake state.
  let parallaxX = 0;
  let parallaxY = 0;
  let targetPX = 0;
  let targetPY = 0;
  let shakeAmt = 0;
  let shakeT = 0;
  let currentMode = 'gather';

  function setMode(modeName) {
    currentMode = modeName === 'squeeze' ? 'squeeze' : 'gather';
    background.setMode(currentMode);
    if (currentMode === 'squeeze') {
      if (envSqueezeRT) scene.environment = envSqueezeRT.texture;
      fillLight.color.setHex(0x4be8ff);
      rimLight.color.setHex(0xff5a36);
    } else {
      if (envGatherRT) scene.environment = envGatherRT.texture;
      fillLight.color.setHex(0x7ab4ff);
      rimLight.color.setHex(0xff8e7a);
    }
  }

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
    camera.position.x = parallaxX * 0.95;
    camera.position.y = -parallaxY * 0.65;
    const t = performance.now() * 0.001;
    camera.position.z = camBaseZ + (reduced ? 0 : Math.sin(t * 0.25) * 0.25);

    // Subtle rim light breathing.
    rimLight.position.x = parallaxX * 2.2 + Math.sin(t * 0.6) * 1.4;
    rimLight.position.y = -parallaxY * 1.4 + Math.cos(t * 0.5) * 0.8;

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
    bloomStrength.value = 0.30 + heat * 0.62;
    rimLight.intensity = 2.4 + heat * 3.5;
    if (!reduced) {
      afterImageDamp.value = heat * 0.52;
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
    setMode,
    setParallaxTarget,
    setIgnite,
    setShake,
    setBloomBase,
    updateCamera,
    resize,
    render,
  };
}
