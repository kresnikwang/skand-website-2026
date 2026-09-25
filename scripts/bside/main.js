/**
 * SKAND B-Side — entry point.
 *
 * Owns lifecycle (fonts → targets → scene → particles), the pointer→world
 * projection, the render loop, the HUD binding, and the back-navigation. The
 * charge bar, the phase steps and the scene all read from the same state
 * machine (phases.js), so the UI is always telling the truth about what's on
 * screen.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { detectTier, reducedMotion, I18N, PHASE_LABEL, PHASE_ORDER, PALETTE } from './config.js?v=20260925d';
import { createScene } from './scene.js?v=20260925d';
import { createParticleSystem } from './particles.js?v=20260925d';
import { buildTargets } from './targets.js';
import { createPhases } from './phases.js?v=20260925d';
import { createAudio } from './audio.js';

/* ---------- language ---------- */
const urlParams = new URLSearchParams(window.location.search);
let lang = urlParams.get('lang') || localStorage.getItem('skand-lang') || 'en';
if (lang !== 'zh' && lang !== 'en') lang = 'en';
document.documentElement.lang = lang;
const t = (key) => I18N[key][lang] || I18N[key].en;

/* ---------- dom ---------- */
const shell = document.getElementById('bSideShell');
const canvas = document.getElementById('glCanvas');
const intro = document.getElementById('intro');
const startBtn = document.getElementById('startBtn');
const introKicker = document.getElementById('introKicker');
const hud = document.getElementById('hud');
const chargeFill = document.getElementById('chargeFill');
const chargePct = document.getElementById('chargePct');
const chargeLabel = document.getElementById('chargeLabel');
const hintEl = document.getElementById('hint');
const phaseRow = document.getElementById('phaseRow');
const soundBtn = document.getElementById('soundBtn');
const resetBtn = document.getElementById('resetBtn');

/* ---------- state ---------- */
const tier = detectTier();
const audio = createAudio();
let scene = null;
let particles = null;
let phases = null;
let clock = null;
let running = false;
let started = false;

// Pointer, in CSS pixels and normalized device coords.
let px = window.innerWidth / 2;
let py = window.innerHeight / 2;
let lastPx = px;
let lastPy = py;
let pointerSpeed = 0;
let pointerDown = false;
let pointerInside = false;

// World-space pointer on the z=0 plane, consumed by the velocity shader.
const pointerWorld = new THREE.Vector3();
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

/* ---------- custom cursor (carried over from the old page) ---------- */
const dot = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');
let mx = px;
let my = py;
let rx = mx;
let ry = my;
const finePointer = window.matchMedia('(pointer: fine)');

if (dot && ring) {
  const follow = () => {
    rx += (mx - rx) * 0.14;
    ry += (my - ry) * 0.14;
    dot.style.transform = `translate(${mx - 3.5}px, ${my - 3.5}px)`;
    ring.style.transform = `translate(${rx - 21}px, ${ry - 21}px)`;
    requestAnimationFrame(follow);
  };
  follow();
  document.querySelectorAll('a, button').forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
  });
}

/* ---------- HUD build ---------- */
function buildPhaseSteps() {
  if (!phaseRow) return;
  phaseRow.innerHTML = '';
  PHASE_ORDER.forEach((key, i) => {
    const step = document.createElement('span');
    step.className = 'phase-step';
    step.dataset.phase = key;
    step.innerHTML = `<b>${i + 1}</b><span>${PHASE_LABEL[key][lang]}</span>`;
    phaseRow.appendChild(step);
  });
}

function localizeHud() {
  chargeLabel.textContent = t('charge');
  hintEl.textContent = t('hint');
  document.getElementById('backBtn').textContent = t('back');
  startBtn.textContent = t('start');
  introKicker.textContent = t('kicker');
  soundBtn.setAttribute('aria-label', t('sound'));
  soundBtn.title = t('sound');
  resetBtn.setAttribute('aria-label', t('reset'));
  resetBtn.title = t('reset');
  buildPhaseSteps();
}

function updateHud() {
  const pct = Math.round(phases.charge * 100);
  chargeFill.style.transform = `scaleX(${Math.min(1, phases.charge)})`;
  chargePct.textContent = `${pct}%`;
  document.querySelectorAll('.phase-step').forEach((el) => {
    const idx = PHASE_ORDER.indexOf(el.dataset.phase);
    const cur = PHASE_ORDER.indexOf(phases.phase);
    el.classList.toggle('is-active', idx === cur);
    el.classList.toggle('is-done', idx < cur);
  });
  if (phases.ignited) {
    hintEl.textContent = t('revealed');
    hintEl.classList.add('is-revealed');
  } else if (phases.phase === 'attract' || phases.phase === 'converge') {
    hintEl.classList.remove('is-revealed');
    hintEl.textContent = t('hintReady');
  } else {
    hintEl.classList.remove('is-revealed');
    hintEl.textContent = t('hint');
  }
}

/* ---------- pointer → world ---------- */
function updatePointer() {
  ndc.x = (px / window.innerWidth) * 2 - 1;
  ndc.y = -(py / window.innerHeight) * 2 + 1;
  if (scene) {
    raycaster.setFromCamera(ndc, scene.camera);
    raycaster.ray.intersectPlane(zPlane, pointerWorld);
  }
}

/* ---------- world scale (fit the mark to the viewport) ---------- */
function computeWorldScale() {
  // Visible height at z=0 for the current camera.
  const cam = scene ? scene.camera : null;
  const dist = tier.name === 'mobile' ? 13.5 : 11;
  const fov = 40;
  const visH = 2 * dist * Math.tan((fov * Math.PI) / 180 / 2);
  const visW = visH * (window.innerWidth / window.innerHeight);
  // The frame is 2.0 wide in normalized space; fit it to ~62% of the width.
  let scale = (visW * (tier.name === 'mobile' ? 0.76 : 0.62)) / 2.0;
  // On very tall/narrow screens, cap by height so the frame never crops.
  const frameH = 0.8 * scale;
  if (frameH > visH * 0.5) scale = (visH * 0.5) / 0.8;
  return scale;
}

/* ---------- fallback (no WebGL / no float RT) ---------- */
function mountFallback(message) {
  if (!shell) return;
  const c = document.createElement('canvas');
  const size = Math.min(window.innerWidth * 0.7, 900);
  const scale = 2;
  c.width = size * scale;
  c.height = size * 0.4 * scale;
  c.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:${size}px;height:${size * 0.4}px;z-index:2;`;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, c.width, 0);
  grad.addColorStop(0, '#e8563a');
  grad.addColorStop(0.3, '#f0ede8');
  grad.addColorStop(0.7, '#f0ede8');
  grad.addColorStop(1, '#e8563a');
  ctx.fillStyle = grad;
  ctx.font = `700 ${c.height * 0.4}px Outfit, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${c.height * 0.04}px`;
  ctx.fillText('SKAND', c.width / 2, c.height / 2);
  shell.appendChild(c);
  if (hintEl) {
    hintEl.textContent = message;
    hintEl.classList.add('is-error');
  }
  if (hud) hud.style.display = 'none';
  introKicker.textContent = message;
  intro.style.pointerEvents = 'none';
  startBtn.hidden = true;
}

/* ---------- init ---------- */
function init() {
  localizeHud();

  scene = createScene({ canvas, tier, reduced: reducedMotion });
  if (!scene) {
    mountFallback(t('fail'));
    return;
  }

  const total = tier.count * tier.count;
  const targets = buildTargets(total, tier.frameShare);
  const worldScale = computeWorldScale();
  const bounds = 6.5; // half-extent of the initial chaos cloud

  particles = createParticleSystem(scene.renderer, {
    size: tier.count,
    targets,
    worldScale,
    bounds,
    pixelRatio: scene.renderer.getPixelRatio(),
    height: window.innerHeight,
  });
  if (!particles) {
    mountFallback(t('fail'));
    return;
  }

  scene.scene.add(particles.points);

  phases = createPhases({
    onPhaseChange: (phase) => {
      audio.onPhase(phase);
      updateHud();
    },
    onIgnite: () => {
      audio.onIgnite();
      shell.classList.add('is-revealed');
      hud.setAttribute('aria-hidden', 'true');
      updateHud();
    },
  });

  clock = new THREE.Clock();
  startBtn.classList.add('ready');

  // First resize pass to sync pixel ratio / world scale with the real viewport.
  handleResize();
  running = true;
  requestAnimationFrame(loop);
}

function loop() {
  // Re-schedule first so the loop is self-sustaining: the scene runs behind
  // the intro overlay from boot, and simply idles (no render) until started.
  requestAnimationFrame(loop);
  if (!running) return;
  if (document.hidden) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // Pointer speed, normalized for the charge curve.
  const ddx = px - lastPx;
  const ddy = py - lastPy;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  pointerSpeed = Math.min(1, dist / 34);
  lastPx = px;
  lastPy = py;

  updatePointer();

  // State machine → uniforms.
  if (started && !phases.ignited) {
    phases.update(dt, pointerDown, pointerSpeed);
  } else if (phases.ignited) {
    phases.update(dt, false, 0);
  }
  const u = phases.uniforms(pointerWorld, pointerDown);
  if (!pointerInside || !started) u.pointerForce = 0;
  particles.setState(u);
  scene.setIgnite(u.ignite);
  scene.setParallaxTarget(pointerInside ? ndc.x : 0, pointerInside ? ndc.y : 0);

  scene.updateCamera(dt);
  particles.update(dt, time);
  scene.render();

  // HUD, throttled to every other frame to avoid layout thrash.
  if (Math.floor(time * 60) % 2 === 0) updateHud();
}

function handleResize() {
  if (!scene) return;
  const { pixelRatio, height } = scene.resize();
  particles.setPixelRatio(pixelRatio);
  particles.setHeight(height);
  particles.setWorldScale(computeWorldScale());
}

/* ---------- input ---------- */
window.addEventListener('pointermove', (e) => {
  px = e.clientX;
  py = e.clientY;
  mx = e.clientX;
  my = e.clientY;
  pointerInside = true;
  document.documentElement.classList.toggle('custom-cursor-enabled', finePointer.matches && window.innerWidth > 768);
}, { passive: true });

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button')) return;
  px = e.clientX;
  py = e.clientY;
  pointerDown = true;
  audio.unlock();
}, { passive: true });

window.addEventListener('pointerup', () => { pointerDown = false; }, { passive: true });
window.addEventListener('pointercancel', () => { pointerDown = false; }, { passive: true });
document.addEventListener('mouseleave', () => { pointerInside = false; });

/* ---------- controls ---------- */
startBtn.addEventListener('click', () => {
  if (startBtn.disabled) return;
  started = true;
  running = true;
  audio.unlock();
  audio.onStart();
  intro.classList.add('is-hidden');
  intro.setAttribute('aria-hidden', 'true');
  startBtn.tabIndex = -1;
  hud.classList.add('visible');
  shell.classList.add('is-live');
});

resetBtn.addEventListener('click', () => {
  phases.reset();
  shell.classList.remove('is-revealed');
  hud.removeAttribute('aria-hidden');
  audio.onReset();
  updateHud();
});

soundBtn.addEventListener('click', () => {
  const on = audio.toggle();
  soundBtn.classList.toggle('is-active', on);
  soundBtn.setAttribute('aria-label', on ? t('sound') : t('muted'));
  soundBtn.title = on ? t('sound') : t('muted');
});

// Back to home, preserving the page-flip and language handoff the site uses.
document.querySelectorAll('a[href^="index.html"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    shell.classList.remove('is-live');
    audio.onReset();
    setTimeout(() => { window.location.href = `index.html?lang=${lang}`; }, 420);
  });
});

/* ---------- resize ---------- */
let resizeTimer;
window.addEventListener('resize', () => {
  if (window.innerWidth <= 768) document.documentElement.classList.remove('custom-cursor-enabled');
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(handleResize, 140);
});

document.addEventListener('visibilitychange', () => {
  running = !document.hidden && Boolean(scene && particles);
});

/* ---------- boot ---------- */
function boot() {
  requestAnimationFrame(() => shell.classList.add('ready'));
  init();
}

// Letter sampling needs Outfit metrics, so wait for the font before building
// targets. A timeout failsafe covers a blocked/slow font CDN.
if (document.fonts && document.fonts.ready) {
  let booted = false;
  const go = () => { if (!booted) { booted = true; boot(); } };
  document.fonts.ready.then(go);
  setTimeout(go, 1200);
} else {
  window.addEventListener('load', boot);
}
