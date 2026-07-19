/**
 * SKAND Easter Egg — Three.js spatial logo (no troika).
 * Letters scatter → assemble, pointer disturbance, orbit, bloom.
 *
 * All imports are absolute esm.sh URLs so nested `from 'three'` is rewritten
 * by esm.sh — avoids broken bare importmap resolution in the browser.
 */
import * as THREE from 'https://esm.sh/three@0.170.0';
import { OrbitControls } from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FontLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://esm.sh/three@0.170.0/examples/jsm/geometries/TextGeometry.js';

const LETTERS = ['S', 'K', 'A', 'N', 'D'];
const FONT_URL =
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/fonts/helvetiker_regular.typeface.json';
const CORAL = 0xe8563a;
const WHITE = 0xf0ede8;
const BLUE = 0x4052b5;

const I18N = {
  loading: { en: 'Warming the egg…', zh: '彩蛋预热中…' },
  mark: { en: 'Easter Egg', zh: '彩蛋' },
  back: { en: 'Back', zh: '返回' },
  thanks: {
    en: 'Wow. Almost nobody finds this page.',
    zh: '哇。几乎没人会发现这个页面。',
  },
  titleHtml: {
    en: 'See the <em>Egg</em>',
    zh: '看看<em>彩蛋</em>',
  },
  sub: {
    en: 'You scrolled past the work, past the clients, past the goodbye — and still kept going. Consider this our quiet high-five. Play with the letters; switch the worlds.',
    zh: '作品看完了，客户看完了，告别页都过了，你还在往下翻。算我们偷偷击个掌。去玩玩字母，换换世界。',
  },
  enter: { en: 'Enter', zh: '进入' },
  hint: {
    en: 'Drag to orbit · Move to disturb · Scroll to zoom',
    zh: '拖动环绕 · 移动扰动 · 滚轮缩放',
  },
  assemble: { en: 'Assemble', zh: '聚合' },
  scatter: { en: 'Scatter', zh: '打散' },
  bgLabel: { en: 'Background', zh: '背景' },
  fail: {
    en: 'Failed to load the egg. Please refresh.',
    zh: '彩蛋加载失败，请刷新重试',
  },
};

/**
 * Highly distinct backdrop presets.
 * Each one changes sky look, fog, particles, floor prop, lights, AND letter tint.
 */
const BG_PRESETS = [
  {
    id: 'void',
    label: { en: 'Void', zh: '深空' },
    sky: 'void',
    bg: 0x000000,
    fog: 0x000000,
    fogDensity: 0.012,
    particle: 0xffffff,
    particleOpacity: 0.55,
    particleSize: 0.028,
    particleMode: 'stars',
    ambient: 0.22,
    rimColor: CORAL,
    rimIntensity: 1.1,
    keyIntensity: 0.85,
    fillColor: 0x1a2240,
    fillIntensity: 0.35,
    exposure: 0.95,
    grid: false,
    floor: 'none',
    letterFront: 0xf0ede8,
    letterEdge: 0xe8563a,
    letterEmissive: 0xe8563a,
    letterEmissiveIntensity: 0.12,
    letterMetal: 0.7,
    letterRough: 0.25,
    bloom: 0.35,
  },
  {
    id: 'aurora',
    label: { en: 'Aurora', zh: '极光' },
    sky: 'aurora',
    bg: 0x021018,
    fog: 0x042028,
    fogDensity: 0.014,
    particle: 0xa8ffe8,
    particleOpacity: 0.65,
    particleSize: 0.07,
    particleMode: 'drift',
    ambient: 0.45,
    rimColor: 0x5fffd0,
    rimIntensity: 2.4,
    keyIntensity: 0.7,
    fillColor: 0x4060ff,
    fillIntensity: 1.15,
    exposure: 1.18,
    grid: false,
    floor: 'aurora',
    letterFront: 0xe8fff8,
    letterEdge: 0x2ec4a0,
    letterEmissive: 0x3dffe0,
    letterEmissiveIntensity: 0.35,
    letterMetal: 0.45,
    letterRough: 0.35,
    bloom: 0.55,
  },
  {
    id: 'neon',
    label: { en: 'Neon', zh: '霓虹' },
    sky: 'neon',
    bg: 0x000000,
    fog: 0x0a0014,
    fogDensity: 0.01,
    particle: 0xff2d9b,
    particleOpacity: 0.7,
    particleSize: 0.035,
    particleMode: 'spark',
    ambient: 0.18,
    rimColor: 0xff2d6a,
    rimIntensity: 2.8,
    keyIntensity: 0.55,
    fillColor: 0x6b5cff,
    fillIntensity: 1.3,
    exposure: 1.22,
    grid: true,
    gridColor: 0xff2d6a,
    floor: 'neon',
    letterFront: 0xffe6f2,
    letterEdge: 0xff2d6a,
    letterEmissive: 0xff2d9b,
    letterEmissiveIntensity: 0.45,
    letterMetal: 0.35,
    letterRough: 0.2,
    bloom: 0.72,
  },
  {
    id: 'ember',
    label: { en: 'Ember', zh: '余烬' },
    sky: 'ember',
    bg: 0x1a0804,
    fog: 0x2a1008,
    fogDensity: 0.02,
    particle: 0xffb070,
    particleOpacity: 0.72,
    particleSize: 0.06,
    particleMode: 'rise',
    ambient: 0.4,
    rimColor: 0xff5a1f,
    rimIntensity: 2.6,
    keyIntensity: 1.15,
    fillColor: 0xff9040,
    fillIntensity: 0.75,
    exposure: 1.14,
    grid: false,
    floor: 'ember',
    letterFront: 0xfff0e4,
    letterEdge: 0xff5a1f,
    letterEmissive: 0xff6a20,
    letterEmissiveIntensity: 0.4,
    letterMetal: 0.55,
    letterRough: 0.32,
    bloom: 0.5,
  },
  {
    id: 'studio',
    label: { en: 'Studio', zh: '影棚' },
    sky: 'studio',
    bg: 0xd8d4ce,
    fog: 0xcfcbc4,
    fogDensity: 0.006,
    particle: 0xffffff,
    particleOpacity: 0,
    particleSize: 0.02,
    particleMode: 'stars',
    ambient: 0.95,
    rimColor: 0xffffff,
    rimIntensity: 0.35,
    keyIntensity: 1.7,
    fillColor: 0xffffff,
    fillIntensity: 0.9,
    exposure: 1.05,
    grid: false,
    floor: 'studio',
    letterFront: 0x1a1a1a,
    letterEdge: 0xe8563a,
    letterEmissive: 0x000000,
    letterEmissiveIntensity: 0,
    letterMetal: 0.25,
    letterRough: 0.45,
    bloom: 0.15,
  },
];

const params = new URLSearchParams(window.location.search);
let lang = params.get('lang') || localStorage.getItem('skand-lang') || 'en';
if (lang !== 'zh' && lang !== 'en') lang = 'en';
document.documentElement.lang = lang;

function t(key) {
  return I18N[key]?.[lang] || I18N[key]?.en || key;
}

function applyI18n() {
  document.querySelectorAll('[data-tk]').forEach((el) => {
    const key = el.dataset.tk;
    if (key === 'title') {
      el.innerHTML = I18N.titleHtml[lang] || I18N.titleHtml.en;
      return;
    }
    if (I18N[key]) el.textContent = t(key);
  });
  document.title = lang === 'zh' ? 'SKAND — 看看彩蛋' : 'SKAND — See the Egg';
}

applyI18n();

function showFatal(err) {
  console.error('[egg]', err);
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.remove('is-hidden');
  loading.innerHTML = `<div class="loading-text" style="max-width:340px;text-align:center;line-height:1.7">
    ${t('fail')}<br><span style="opacity:.55;font-size:10px;letter-spacing:0">${String(err?.message || err)}</span>
    <br><br>
    <a href="index.html?lang=${lang}" style="color:#e8563a;letter-spacing:2px;text-transform:uppercase;font-size:11px;text-decoration:none">
      ${lang === 'zh' ? '返回主站' : 'Back to site'}
    </a>
  </div>`;
}

// —— DOM ——
const canvas = document.getElementById('eggCanvas');
const shell = document.getElementById('shell');
const loading = document.getElementById('loading');
const intro = document.getElementById('intro');
const startBtn = document.getElementById('startBtn');
const hud = document.getElementById('hud');
const assembleBtn = document.getElementById('assembleBtn');
const scatterBtn = document.getElementById('scatterBtn');
const cursorDot = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');

if (!canvas) {
  showFatal(new Error('Canvas #eggCanvas not found'));
  throw new Error('Canvas missing');
}

const isTouch =
  window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = isTouch || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

// —— Cursor ——
let mx = 0;
let my = 0;
let rx = 0;
let ry = 0;
if (!isTouch) {
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (cursorDot) cursorDot.style.opacity = '1';
    if (cursorRing) cursorRing.style.opacity = '1';
  });
  const loopCursor = () => {
    rx += (mx - rx) * 0.14;
    ry += (my - ry) * 0.14;
    if (cursorDot) {
      cursorDot.style.left = mx - 3.5 + 'px';
      cursorDot.style.top = my - 3.5 + 'px';
    }
    if (cursorRing) {
      cursorRing.style.left = rx - 21 + 'px';
      cursorRing.style.top = ry - 21 + 'px';
    }
    requestAnimationFrame(loopCursor);
  };
  loopCursor();
  document.querySelectorAll('a,button').forEach((el) => {
    el.addEventListener('mouseenter', () => cursorRing?.classList.add('hovering'));
    el.addEventListener('mouseleave', () => cursorRing?.classList.remove('hovering'));
  });
}

document.querySelectorAll('[data-back]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'index.html?lang=' + lang + '#contact';
  });
});

// —— Three ——
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !lowPower,
  alpha: false,
  powerPreference: lowPower ? 'low-power' : 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.FogExp2(0x0a0a0a, lowPower ? 0.028 : 0.02);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0.4, isTouch ? 12 : 10.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 24;
controls.enablePan = false;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.45;
let isDragging = false;
controls.addEventListener('start', () => {
  isDragging = true;
});
controls.addEventListener('end', () => {
  isDragging = false;
});

const ambient = new THREE.AmbientLight(0xffffff, 0.38);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xfff2ea, 1.2);
key.position.set(4, 6, 8);
scene.add(key);
const fill = new THREE.DirectionalLight(BLUE, 0.55);
fill.position.set(-6, -2, 4);
scene.add(fill);
const rim = new THREE.PointLight(CORAL, 1.5, 40, 2);
rim.position.set(0, 1.2, 3.5);
scene.add(rim);

// —— Sky textures (each style looks very different) ——
function makeSkyTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  if (kind === 'void') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 1.2;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.75})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'aurora') {
    const base = ctx.createLinearGradient(0, 0, 0, 512);
    base.addColorStop(0, '#010610');
    base.addColorStop(0.45, '#042028');
    base.addColorStop(1, '#020812');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      const y0 = 40 + i * 48;
      const g = ctx.createLinearGradient(0, y0, 512, y0 + 90);
      const a = 0.18 + (i % 3) * 0.08;
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.25, `rgba(40, ${160 + i * 8}, ${200 - i * 10}, ${a})`);
      g.addColorStop(0.45, `rgba(${60 + i * 12}, 255, ${170 - i * 8}, ${a + 0.12})`);
      g.addColorStop(0.7, `rgba(90, 120, 255, ${a * 0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    }
  } else if (kind === 'neon') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);
    // Magenta / violet vignette + scan feel
    const g = ctx.createRadialGradient(256, 420, 20, 256, 300, 380);
    g.addColorStop(0, 'rgba(255, 40, 120, 0.45)');
    g.addColorStop(0.35, 'rgba(90, 40, 255, 0.28)');
    g.addColorStop(0.7, 'rgba(20, 0, 40, 0.5)');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(255, 45, 150, 0.12)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
  } else if (kind === 'ember') {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#2a0c04');
    g.addColorStop(0.35, '#5a1808');
    g.addColorStop(0.55, '#c43a10');
    g.addColorStop(0.75, '#ff6a20');
    g.addColorStop(1, '#1a0804');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // Soft heat blobs
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 512;
      const y = 200 + Math.random() * 250;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, 40 + Math.random() * 80);
      rg.addColorStop(0, 'rgba(255, 200, 80, 0.35)');
      rg.addColorStop(0.5, 'rgba(255, 80, 20, 0.15)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, 512, 512);
    }
  } else if (kind === 'studio') {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#f2efe9');
    g.addColorStop(0.55, '#e4e0d8');
    g.addColorStop(0.85, '#cfc9bf');
    g.addColorStop(1, '#b8b2a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // Soft corner shadows like a cyclorama
    const vg = ctx.createRadialGradient(256, 200, 80, 256, 280, 420);
    vg.addColorStop(0, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(80,70,60,0.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 512, 512);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const skyGeo = new THREE.SphereGeometry(70, 48, 32);
const skyMat = new THREE.MeshBasicMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Neon grid floor
const grid = new THREE.GridHelper(48, 48, 0xff2d6a, 0x401020);
grid.position.y = -2.35;
grid.visible = false;
if (Array.isArray(grid.material)) {
  grid.material.forEach((m) => {
    m.transparent = true;
    m.opacity = 0.55;
  });
} else {
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
}
scene.add(grid);

// Theme floor props
const floorGroup = new THREE.Group();
scene.add(floorGroup);

function clearFloor() {
  for (let i = floorGroup.children.length - 1; i >= 0; i--) {
    const ch = floorGroup.children[i];
    floorGroup.remove(ch);
    ch.geometry?.dispose?.();
    if (Array.isArray(ch.material)) ch.material.forEach((m) => m.dispose?.());
    else ch.material?.dispose?.();
  }
}

function buildFloor(kind) {
  clearFloor();
  if (kind === 'none' || !kind) return;

  if (kind === 'aurora') {
    // Soft glowing disc
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3dffe0,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(new THREE.RingGeometry(1.5, 9, 64), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -2.1;
    floorGroup.add(disc);
    // Vertical aurora sheets
    for (let i = 0; i < 4; i++) {
      const sheet = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 10 + i),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0x5fffd0 : 0x6080ff,
          transparent: true,
          opacity: 0.06 + i * 0.02,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      sheet.position.set((i - 1.5) * 3.2, 1.5, -8 - i);
      sheet.rotation.y = (i - 1.5) * 0.15;
      floorGroup.add(sheet);
    }
  } else if (kind === 'neon') {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 3.65, 64),
      new THREE.MeshBasicMaterial({
        color: 0xff2d6a,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.2;
    floorGroup.add(ring);
    const ring2 = ring.clone();
    ring2.scale.setScalar(1.35);
    ring2.material = ring.material.clone();
    ring2.material.color.setHex(0x6b5cff);
    ring2.material.opacity = 0.45;
    floorGroup.add(ring2);
  } else if (kind === 'ember') {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff4a10,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -2.15;
    floorGroup.add(glow);
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffc060,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = -2.12;
    floorGroup.add(core);
  } else if (kind === 'studio') {
    // Light cyclorama floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshStandardMaterial({
        color: 0xddd8d0,
        roughness: 0.85,
        metalness: 0.05,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.0;
    floorGroup.add(floor);
  }
}

// Particles
const particleCount = lowPower ? 180 : 520;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(particleCount * 3);
const pBase = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 30;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
  pBase[i * 3] = pPos[i * 3];
  pBase[i * 3 + 1] = pPos[i * 3 + 1];
  pBase[i * 3 + 2] = pPos[i * 3 + 2];
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: WHITE,
  size: lowPower ? 0.03 : 0.045,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  sizeAttenuation: true,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

let currentBgId = 'void';
let rimBaseIntensity = 1.5;
let particleMode = 'stars';
let bloomPass = null;

function applyLetterTheme(preset) {
  letterMeshes.forEach((group) => {
    group.children.forEach((child, idx) => {
      if (!child.isMesh || !child.material) return;
      // edge mesh is first, front is second
      const isFront = idx === 1 || group.children.length === 1;
      const mat = child.material;
      if (!mat.color) return;
      mat.color.setHex(isFront ? preset.letterFront : preset.letterEdge);
      if (mat.emissive) {
        mat.emissive.setHex(isFront ? preset.letterEmissive : 0x000000);
        mat.emissiveIntensity = isFront ? preset.letterEmissiveIntensity : 0;
      }
      if (mat.metalness !== undefined) mat.metalness = preset.letterMetal;
      if (mat.roughness !== undefined) mat.roughness = preset.letterRough;
      mat.needsUpdate = true;
    });
  });
}

function reshapeParticles(mode) {
  particleMode = mode;
  for (let i = 0; i < particleCount; i++) {
    if (mode === 'rise') {
      // Dense near bottom, rise like sparks
      pBase[i * 3] = (Math.random() - 0.5) * 22;
      pBase[i * 3 + 1] = -3 + Math.random() * 10;
      pBase[i * 3 + 2] = (Math.random() - 0.5) * 22;
    } else if (mode === 'drift') {
      pBase[i * 3] = (Math.random() - 0.5) * 26;
      pBase[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pBase[i * 3 + 2] = (Math.random() - 0.5) * 26;
    } else if (mode === 'spark') {
      // Near a mid plane + some vertical
      pBase[i * 3] = (Math.random() - 0.5) * 24;
      pBase[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pBase[i * 3 + 2] = (Math.random() - 0.5) * 24;
    } else {
      // stars — far scatter
      pBase[i * 3] = (Math.random() - 0.5) * 36;
      pBase[i * 3 + 1] = (Math.random() - 0.5) * 24;
      pBase[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    pPos[i * 3] = pBase[i * 3];
    pPos[i * 3 + 1] = pBase[i * 3 + 1];
    pPos[i * 3 + 2] = pBase[i * 3 + 2];
  }
  pGeo.attributes.position.needsUpdate = true;
}

function setBackground(id) {
  const preset = BG_PRESETS.find((p) => p.id === id) || BG_PRESETS[0];
  currentBgId = preset.id;

  if (skyMat.map) skyMat.map.dispose();
  skyMat.map = makeSkyTexture(preset.sky);
  skyMat.needsUpdate = true;
  sky.visible = true;
  scene.background = new THREE.Color(preset.bg);

  const fogDensity = lowPower ? preset.fogDensity * 1.2 : preset.fogDensity;
  scene.fog = new THREE.FogExp2(preset.fog, fogDensity);

  pMat.color.setHex(preset.particle);
  pMat.opacity = preset.particleOpacity;
  pMat.size = lowPower ? preset.particleSize * 0.75 : preset.particleSize;
  pMat.needsUpdate = true;
  particles.visible = preset.particleOpacity > 0.04;
  reshapeParticles(preset.particleMode || 'stars');

  ambient.intensity = preset.ambient;
  key.intensity = preset.keyIntensity;
  fill.color.setHex(preset.fillColor);
  fill.intensity = preset.fillIntensity;
  rim.color.setHex(preset.rimColor);
  rimBaseIntensity = preset.rimIntensity;
  rim.intensity = rimBaseIntensity;
  renderer.toneMappingExposure = preset.exposure;

  grid.visible = !!preset.grid;
  if (preset.grid) {
    const gc = preset.gridColor || CORAL;
    if (Array.isArray(grid.material)) {
      grid.material[0].color.setHex(gc);
      grid.material[1].color.setHex(0x2a1020);
      grid.material.forEach((m) => {
        m.opacity = 0.55;
      });
    }
  }

  buildFloor(preset.floor);
  applyLetterTheme(preset);

  if (bloomPass) {
    bloomPass.strength = lowPower ? Math.min(0.35, preset.bloom) : preset.bloom;
  }

  document.querySelectorAll('.hud-bg').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.bg === preset.id);
  });
}

function initBgButtons() {
  const row = document.getElementById('bgRow');
  if (!row) return;
  BG_PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hud-btn hud-bg';
    btn.dataset.bg = preset.id;
    btn.textContent = preset.label[lang] || preset.label.en;
    btn.addEventListener('click', () => setBackground(preset.id));
    row.appendChild(btn);
  });
}

let composer = null;
if (!lowPower && !prefersReduced) {
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4,
      0.65,
      0.82
    );
    composer.addPass(bloomPass);
  } catch (e) {
    console.warn('[egg] bloom disabled', e);
    composer = null;
    bloomPass = null;
  }
}

const letterMeshes = [];
const homePositions = [];
const scatterPositions = [];
const velocities = [];
const letterSpacing = 1.65;
const totalWidth = (LETTERS.length - 1) * letterSpacing;
const pointer = new THREE.Vector2(0, 0);
const pointerWorld = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let mode = 'assemble';
let introDone = false;
let running = true;

function randomScatter() {
  const r = 3.2 + Math.random() * 5.5;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta) * 0.7,
    r * Math.cos(phi)
  );
}

function makeLetterMaterial(front) {
  return new THREE.MeshStandardMaterial({
    color: front ? WHITE : CORAL,
    emissive: front ? CORAL : 0x000000,
    emissiveIntensity: front ? 0.18 : 0,
    metalness: 0.62,
    roughness: 0.28,
  });
}

function buildLetters(font) {
  LETTERS.forEach((ch, i) => {
    const geo = new TextGeometry(ch, {
      font,
      size: 1.35,
      depth: lowPower ? 0.28 : 0.42,
      curveSegments: lowPower ? 6 : 10,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelOffset: 0,
      bevelSegments: lowPower ? 2 : 3,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    geo.translate(-cx, -cy, -cz);

    const mesh = new THREE.Mesh(geo, makeLetterMaterial(true));
    // Coral edge via slightly larger second mesh
    const edge = new THREE.Mesh(geo.clone(), makeLetterMaterial(false));
    edge.scale.setScalar(1.03);
    edge.position.z = -0.02;

    const group = new THREE.Group();
    group.add(edge);
    group.add(mesh);

    const home = new THREE.Vector3(i * letterSpacing - totalWidth / 2, 0, 0);
    homePositions.push(home.clone());
    scatterPositions.push(randomScatter());
    velocities.push(new THREE.Vector3());
    group.position.copy(scatterPositions[i]);
    group.userData.index = i;
    scene.add(group);
    letterMeshes.push(group);
  });
}

function setScatterTargets() {
  for (let i = 0; i < LETTERS.length; i++) scatterPositions[i] = randomScatter();
}

function setMode(next) {
  mode = next;
  assembleBtn?.classList.toggle('active', mode === 'assemble');
  scatterBtn?.classList.toggle('active', mode === 'scatter');
  if (mode === 'scatter') setScatterTargets();
}

function onPointerMove(e) {
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  pointer.x = (x / window.innerWidth) * 2 - 1;
  pointer.y = -(y / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(plane, pointerWorld);
}
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('touchmove', onPointerMove, { passive: true });

function updateLetters(dt) {
  const tNow = performance.now() * 0.001;
  for (let i = 0; i < letterMeshes.length; i++) {
    const mesh = letterMeshes[i];
    const vel = velocities[i];
    const home = homePositions[i];
    const scatter = scatterPositions[i];

    let targetX;
    let targetY;
    let targetZ;
    if (mode === 'scatter') {
      targetX = scatter.x;
      targetY = scatter.y;
      targetZ = scatter.z;
    } else {
      const wave = prefersReduced ? 0 : Math.sin(tNow * 1.1 + i * 0.7) * 0.08;
      targetX = home.x;
      targetY = home.y + wave;
      targetZ = home.z;
    }

    if (introDone && mode !== 'scatter') {
      const dx = mesh.position.x - pointerWorld.x;
      const dy = mesh.position.y - pointerWorld.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001;
      const radius = 2.8;
      if (dist < radius) {
        const force = (1 - dist / radius) * 2.4;
        targetX += (dx / dist) * force;
        targetY += (dy / dist) * force;
        targetZ += force * 0.35;
      }
    }

    const stiffness = mode === 'scatter' ? 1.8 : 3.4;
    const damping = 0.82;
    vel.x += (targetX - mesh.position.x) * stiffness * dt;
    vel.y += (targetY - mesh.position.y) * stiffness * dt;
    vel.z += (targetZ - mesh.position.z) * stiffness * dt;
    vel.multiplyScalar(damping);
    mesh.position.addScaledVector(vel, 60 * dt);

    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, pointer.x * 0.15, 0.04);
    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, -pointer.y * 0.1, 0.04);
  }
}

let last = performance.now();
function animate() {
  if (!running) return;
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (introDone) {
    updateLetters(dt);
    controls.autoRotate = mode === 'assemble' && !isDragging;
  }

  // Particle motion per theme
  if (particles.visible) {
    const arr = pGeo.attributes.position.array;
    const t = now * 0.001;
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3;
      if (particleMode === 'rise') {
        arr[ix + 1] = pBase[ix + 1] + ((t * (0.4 + (i % 7) * 0.08) + i) % 12);
        if (arr[ix + 1] > 9) arr[ix + 1] -= 12;
        arr[ix] = pBase[ix] + Math.sin(t * 0.7 + i) * 0.15;
      } else if (particleMode === 'drift') {
        arr[ix] = pBase[ix] + Math.sin(t * 0.35 + i * 0.2) * 1.2;
        arr[ix + 1] = pBase[ix + 1] + Math.cos(t * 0.25 + i * 0.15) * 0.8;
        arr[ix + 2] = pBase[ix + 2] + Math.sin(t * 0.2 + i) * 0.9;
      } else if (particleMode === 'spark') {
        arr[ix] = pBase[ix] + Math.sin(t * 2.2 + i) * 0.25;
        arr[ix + 1] = pBase[ix + 1] + Math.abs(Math.sin(t * 3 + i * 0.5)) * 0.4;
        arr[ix + 2] = pBase[ix + 2] + Math.cos(t * 1.8 + i) * 0.25;
      } else {
        // stars — slow rotate field via group
      }
    }
    if (particleMode !== 'stars') pGeo.attributes.position.needsUpdate = true;
    else particles.rotation.y += dt * 0.015;
  }

  if (sky.visible) {
    sky.rotation.y += dt * (currentBgId === 'aurora' ? 0.03 : 0.008);
  }
  if (grid.visible) grid.rotation.y += dt * 0.04;
  if (floorGroup.children.length && currentBgId === 'neon') {
    floorGroup.rotation.y += dt * 0.15;
  }
  rim.intensity = rimBaseIntensity + Math.sin(now * 0.002) * 0.3;

  controls.update();
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer?.setSize(w, h);
}
window.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) {
    last = performance.now();
    animate();
  }
});

async function boot() {
  try {
    initBgButtons();
    const font = await new FontLoader().loadAsync(FONT_URL);
    buildLetters(font);
    setBackground('void');
    loading?.classList.add('is-hidden');
    shell?.classList.add('ready');
    startBtn?.classList.add('ready');
    animate();
  } catch (e) {
    showFatal(e);
  }
}

startBtn?.addEventListener('click', () => {
  intro?.classList.add('is-hidden');
  hud?.classList.add('visible');
  introDone = true;
  setMode('assemble');
  for (let i = 0; i < letterMeshes.length; i++) {
    letterMeshes[i].position.copy(scatterPositions[i]);
    velocities[i].set(0, 0, 0);
  }
  controls.autoRotate = true;
});

assembleBtn?.addEventListener('click', () => setMode('assemble'));
scatterBtn?.addEventListener('click', () => setMode('scatter'));
canvas.addEventListener('dblclick', () => {
  if (!introDone) return;
  setMode(mode === 'assemble' ? 'scatter' : 'assemble');
});

boot();
