/**
 * SKAND Easter Egg — Three.js r187 WebGPURenderer spatial logo (no troika).
 * Letters scatter → assemble, pointer disturbance, orbit, TSL bloom & reflector.
 * The logo lives in five procedural worlds (see WORLDS below).
 *
 * Upgraded to Three.js 0.187.0 (`WebGPURenderer` with automatic WebGL2 fallback,
 * TSL shaders, `RenderPipeline` + `BloomNode`, `ReflectorNode`, EON `diffuseRoughness`,
 * GPU-driven `SpriteNodeMaterial` particles, cube-RT `PMREMGenerator`, and `Timer`).
 */
import * as THREE from 'https://esm.sh/three@0.187.0/webgpu';
import {
  Fn,
  If,
  Loop,
  Discard,
  float,
  vec2,
  vec3,
  vec4,
  uniform,
  attribute,
  uv,
  screenUV,
  positionWorld,
  cameraPosition,
  normalize,
  length,
  dot,
  cross,
  floor,
  fract,
  sin,
  cos,
  exp,
  pow,
  abs,
  sqrt,
  atan,
  sign,
  step,
  max,
  min,
  mix,
  clamp,
  smoothstep,
  pass,
  reflector,
  instancedArray,
  instanceIndex,
} from 'https://esm.sh/three@0.187.0/tsl';
import { bloom } from 'https://esm.sh/three@0.187.0/examples/jsm/tsl/display/BloomNode.js';
import { OrbitControls } from 'https://esm.sh/three@0.187.0/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'https://esm.sh/three@0.187.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://esm.sh/three@0.187.0/examples/jsm/geometries/TextGeometry.js';

const LETTERS = ['S', 'K', 'A', 'N', 'D'];
const FONT_URL = 'fonts/helvetiker_regular.typeface.json';
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
  soundOn: { en: '♪ Sound', zh: '♪ 配乐' },
  soundOff: { en: '♪ Muted', zh: '♪ 静音' },
  bgLabel: { en: 'World', zh: '世界' },
  fail: {
    en: 'Failed to load the egg. Please refresh.',
    zh: '彩蛋加载失败，请刷新重试',
  },
};

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
const soundBtn = document.getElementById('soundBtn');
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

// —— Worlds ——
const WORLDS = [
  {
    id: 'mirror',
    label: { en: 'Mirror', zh: '天空之镜' },
    caption: { en: 'Dusk on the flooded salt flats', zh: '黄昏 · 盐沼如镜' },
    bgm: 'audio/egg/mirror.mp3',
    sun: [-0.34, 0.05, -1],
    groundMode: 1,
    groundColor: [1, 1, 1],
    water: { y: -0.62, ripple: 0.004, reflect: 0.82, frost: 0, flow: 1, deep: [0.015, 0.015, 0.04] },
    fog: null,
    ambient: 0.05,
    key: [0xff9a5c, 3.0],
    fill: [0x7f8cff, 0.08],
    rim: [0xff8050, 0.25],
    exposure: 1.0,
    bloom: [0.32, 0.7, 1.25],
    env: 1.25,
    particles: null,
    grounded: true,
    bob: 0,
    maxPolar: 1.52,
    front: { color: 0xffffff, metalness: 1, roughness: 0.08 },
    edge: { color: 0xffb48a, metalness: 1, roughness: 0.25, emissive: CORAL, emissiveIntensity: 0.15 },
  },
  {
    id: 'aurora',
    label: { en: 'Aurora', zh: '极光' },
    caption: { en: 'A frozen fjord, a sky that moves', zh: '冰封峡湾 · 流动的天' },
    bgm: 'audio/egg/aurora.mp3',
    sun: [0.3, 0.6, 0.5],
    groundMode: 1,
    groundColor: [0.75, 0.9, 0.95],
    water: { y: -0.69, ripple: 0.006, reflect: 0.5, frost: 0.8, flow: 0, deep: [0.012, 0.04, 0.06] },
    fog: [[0.008, 0.025, 0.04], 0.004],
    ambient: 0.08,
    key: [0x9fdcff, 0.6],
    fill: [0x38ffb0, 1.2],
    rim: [0x40ffc8, 1.5],
    exposure: 1.15,
    bloom: [0.6, 0.9, 0.9],
    env: 1.6,
    particles: { mode: 'snow', color: 0xffffff, size: 0.09, opacity: 0.8 },
    grounded: true,
    bob: 0,
    maxPolar: 1.52,
    front: {
      color: 0xdff6ff,
      metalness: 0,
      roughness: 0.12,
      clearcoat: 1,
      transmission: 0.85,
      thickness: 0.7,
      ior: 1.31,
      dispersion: 0.25,
      emissive: 0x1cffb0,
      emissiveIntensity: 0.05,
    },
    edge: null,
  },
  {
    id: 'lanterns',
    label: { en: 'Lanterns', zh: '灯海' },
    caption: { en: 'A thousand wishes over still water', zh: '千灯入夜 · 一湖心愿' },
    bgm: 'audio/egg/lanterns.mp3',
    sun: [0.45, 0.42, -0.8],
    groundMode: 1,
    groundColor: [0.9, 0.9, 1],
    water: { y: -1.5, ripple: 0.007, reflect: 0.7, frost: 0, flow: 1, deep: [0.004, 0.006, 0.016] },
    fog: [[0.008, 0.01, 0.026], 0.006],
    ambient: 0.05,
    key: [0xbfd0ff, 0.5],
    fill: [0xff9040, 0.5],
    rim: [0xff8a30, 2.0],
    exposure: 1.1,
    bloom: [0.55, 0.8, 1.0],
    env: 1.0,
    particles: { mode: 'rise', color: 0xffa040, size: 0.55, opacity: 0.9 },
    grounded: true,
    bob: 0.12,
    maxPolar: 1.6,
    front: {
      color: 0xffe2b8,
      metalness: 0,
      roughness: 0.9,
      diffuseRoughness: 0.88,
      emissive: 0xff8a2a,
      emissiveIntensity: 1.6,
    },
    edge: {
      color: 0x7a2a08,
      metalness: 0,
      roughness: 0.8,
      diffuseRoughness: 0.85,
      emissive: 0xff5a10,
      emissiveIntensity: 0.5,
    },
  },
  {
    id: 'dunes',
    label: { en: 'Dunes', zh: '沙丘' },
    caption: {
      en: 'Arrakis — spice in the wind, monoliths in the haze',
      zh: '厄拉科斯 · 香料随风，巨构隐现',
    },
    bgm: 'audio/egg/dunes.mp3',
    sun: [-0.82, 0.18, 0.18],
    groundMode: 2,
    groundColor: [0.78, 0.45, 0.22],
    water: null,
    fog: [[0.78, 0.45, 0.22], 0.0052],
    ambient: 0.12,
    key: [0xffba78, 4.4],
    fill: [0xd89860, 0.62],
    rim: [0xff7a28, 1.35],
    exposure: 0.98,
    bloom: [0.36, 0.68, 0.92],
    env: 1.15,
    shadows: true,
    particles: { mode: 'dust', color: 0xffcf8c, size: 0.06, opacity: 0.62 },
    grounded: true,
    bob: 0,
    maxPolar: 1.5,
    front: {
      color: 0xe8c396,
      metalness: 0.36,
      roughness: 0.46,
      diffuseRoughness: 0.9,
      clearcoat: 0.26,
      emissive: 0x3a1605,
      emissiveIntensity: 0.12,
    },
    edge: {
      color: 0xffa850,
      metalness: 0.92,
      roughness: 0.22,
      emissive: 0xff5e14,
      emissiveIntensity: 0.34,
    },
  },
  {
    id: 'nebula',
    label: { en: 'Nebula', zh: '星云' },
    caption: { en: 'Adrift beside a ringed giant', zh: '星环之侧 · 漂流' },
    bgm: 'audio/egg/nebula.mp3',
    sun: [0.6, 0.3, 0.7],
    groundMode: 0,
    groundColor: [0, 0, 0],
    water: null,
    fog: null,
    ambient: 0.05,
    key: [0xffe0d0, 2.0],
    fill: [0x40b0ff, 0.6],
    rim: [CORAL, 0.35],
    exposure: 1.05,
    bloom: [0.55, 0.8, 0.95],
    env: 1.6,
    particles: { mode: 'stars', color: 0xffffff, size: 0.12, opacity: 0.85 },
    grounded: false,
    bob: 0.1,
    maxPolar: Math.PI,
    front: { color: 0xffffff, metalness: 1, roughness: 0.06 },
    edge: { color: 0x1a1a1a, metalness: 1, roughness: 0.2, emissive: CORAL, emissiveIntensity: 0.35 },
  },
];
const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w]));
let world = WORLDS[0];

// —— Three (WebGPURenderer + WebGL2 fallback) ——
const renderer = new THREE.WebGPURenderer({
  canvas,
  antialias: !lowPower,
  alpha: false,
  powerPreference: lowPower ? 'low-power' : 'high-performance',
});
const pixelRatio = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1400);
camera.position.set(0, 1.25, isTouch ? 12 : 10.5);

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

const ambient = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xfff2ea, 1.2);
key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
key.shadow.camera.left = -14;
key.shadow.camera.right = 14;
key.shadow.camera.top = 14;
key.shadow.camera.bottom = -14;
key.shadow.camera.near = 1;
key.shadow.camera.far = 90;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.03;
scene.add(key);
const fill = new THREE.DirectionalLight(BLUE, 0.55);
fill.position.set(4, 3, 9);
scene.add(fill);
const rim = new THREE.PointLight(CORAL, 1.5, 40, 2);
rim.position.set(0, 1.2, 3.5);
scene.add(rim);

// —— Shared TSL Noise ——
const uTime = uniform(0);
const OCT = lowPower ? 3 : 5;
const AUR = lowPower ? 7 : 18;

const hash21 = Fn(([p]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33)));
  return fract(p3.x.add(p3.y).mul(p3.z));
});

const hash31 = Fn(([p3_in]) => {
  const p3 = fract(p3_in.mul(0.1031)).toVar();
  p3.addAssign(dot(p3, vec3(p3.y, p3.z, p3.x).add(31.32)));
  return fract(p3.x.add(p3.y).mul(p3.z));
});

const noise2 = Fn(([p]) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(float(3.0).sub(fRaw.mul(2.0)));
  return mix(
    mix(hash21(i), hash21(i.add(vec2(1.0, 0.0))), f.x),
    mix(hash21(i.add(vec2(0.0, 1.0))), hash21(i.add(vec2(1.0, 1.0))), f.x),
    f.y
  );
});

const noise3 = Fn(([p]) => {
  const i = floor(p);
  const fRaw = fract(p);
  const f = fRaw.mul(fRaw).mul(float(3.0).sub(fRaw.mul(2.0)));
  const z0 = mix(
    mix(hash31(i), hash31(i.add(vec3(1.0, 0.0, 0.0))), f.x),
    mix(hash31(i.add(vec3(0.0, 1.0, 0.0))), hash31(i.add(vec3(1.0, 1.0, 0.0))), f.x),
    f.y
  );
  const z1 = mix(
    mix(hash31(i.add(vec3(0.0, 0.0, 1.0))), hash31(i.add(vec3(1.0, 0.0, 1.0))), f.x),
    mix(hash31(i.add(vec3(0.0, 1.0, 1.0))), hash31(i.add(vec3(1.0, 1.0, 1.0))), f.x),
    f.y
  );
  return mix(z0, z1, f.z);
});

const fbm2 = Fn(([p_in]) => {
  const p = p_in.toVar();
  const a = float(0.5).toVar();
  const s = float(0.0).toVar();
  for (let i = 0; i < OCT; i++) {
    s.addAssign(a.mul(noise2(p)));
    p.assign(p.mul(2.02).add(vec2(13.1, 7.7)));
    a.mulAssign(0.5);
  }
  return s;
});

const fbm3 = Fn(([p_in]) => {
  const p = p_in.toVar();
  const a = float(0.5).toVar();
  const s = float(0.0).toVar();
  for (let i = 0; i < OCT; i++) {
    s.addAssign(a.mul(noise3(p)));
    p.assign(p.mul(2.02).add(vec3(13.1, 7.7, 3.3)));
    a.mulAssign(0.5);
  }
  return s;
});

const starsFn = Fn(([d, scale, density]) => {
  const g = d.mul(scale);
  const id = floor(g);
  const f = fract(g).sub(0.5);
  const hsh = hash31(id);
  const out = float(0.0).toVar();
  If(hsh.greaterThanEqual(float(1.0).sub(density)), () => {
    const off = vec3(
      hash31(id.add(7.1)),
      hash31(id.add(13.7)),
      hash31(id.add(23.3))
    ).sub(0.5).mul(0.6);
    const tw = float(0.72).add(float(0.28).mul(sin(uTime.mul(float(1.0).add(hsh.mul(3.0))).add(hsh.mul(40.0)))));
    out.assign(smoothstep(0.1, 0.0, length(f.sub(off))).mul(tw).mul(float(0.35).add(float(0.65).mul(fract(hsh.mul(91.7))))));
  });
  return out;
});

// —— Sky: one dome, one TSL node material per world ——
function buildSkyColorFn(worldId, uSunDir, uGroundColor) {
  if (worldId === 'mirror') {
    return Fn(([d]) => {
      const h = clamp(d.y, 0.0, 1.0);
      const zen = vec3(0.002, 0.004, 0.026);
      const mid = vec3(0.045, 0.017, 0.095);
      const hor = vec3(0.6, 0.17, 0.06);
      const col = mix(hor, mid, smoothstep(0.0, 0.17, h)).toVar();
      col.assign(mix(col, zen, smoothstep(0.12, 0.7, h)));
      const sdRaw = dot(d, uSunDir);
      const sd = max(sdRaw, 0.0);
      col.assign(
        mix(
          col,
          mix(vec3(0.055, 0.028, 0.1), col, smoothstep(0.0, 0.4, h)),
          float(1.0).sub(smoothstep(-0.4, 0.75, sdRaw)).mul(0.7)
        )
      );
      col.addAssign(vec3(1.0, 0.5, 0.25).mul(pow(sd, 10.0)).mul(0.22));
      col.addAssign(vec3(1.0, 0.65, 0.4).mul(pow(sd, 160.0)).mul(0.8));
      col.addAssign(vec3(1.0, 0.86, 0.7).mul(smoothstep(0.99935, 0.9997, sd)).mul(5.0));

      const cp = d.xz.div(h.add(0.14));
      const cRaw = fbm2(cp.mul(vec2(0.55, 1.5)).add(vec2(uTime.mul(0.004), 3.0)));
      const c = smoothstep(0.46, 0.78, cRaw).mul(smoothstep(0.01, 0.1, h)).mul(float(1.0).sub(smoothstep(0.3, 0.62, h)));
      const lit = mix(vec3(1.0, 0.32, 0.26), vec3(1.0, 0.7, 0.4), pow(sd, 5.0));
      const cc = mix(lit.mul(0.8), vec3(0.05, 0.025, 0.09), smoothstep(0.04, 0.36, h));
      col.assign(mix(col, cc, c.mul(0.75)));
      col.addAssign(starsFn(d, 120.0, 0.1).mul(vec3(0.9, 0.92, 1.0)).mul(smoothstep(0.28, 0.72, h)));
      return col;
    });
  }

  if (worldId === 'aurora') {
    return Fn(([d]) => {
      const h = clamp(d.y, 0.0, 1.0);
      const col = mix(vec3(0.012, 0.04, 0.07), vec3(0.002, 0.006, 0.02), smoothstep(0.0, 0.6, h)).toVar();
      col.addAssign(vec3(0.02, 0.09, 0.08).mul(exp(h.mul(-7.0))));
      col.addAssign(starsFn(d, 110.0, 0.11).mul(vec3(0.8, 0.9, 1.0)).mul(smoothstep(0.03, 0.2, h)));

      const au = vec3(0.0).toVar();
      const haze = float(0.0).toVar();
      Loop({ start: 0, end: AUR, type: 'int', condition: '<' }, ({ i }) => {
        const fi = float(i).div(float(AUR));
        const hg = float(1.0).add(fi.mul(0.32));
        const p = d.xz.mul(hg.div(h.add(0.08)));
        const n = fbm2(p.mul(0.3).add(vec2(uTime.mul(0.014), uTime.mul(-0.009))));
        const rib = smoothstep(0.05, 0.0, abs(n.sub(0.5)));
        const rays = float(0.3).add(float(0.7).mul(noise2(vec2(p.x.mul(7.0).add(uTime.mul(0.2)), p.y.mul(7.0).sub(uTime.mul(0.12))))));
        const c = mix(vec3(0.08, 1.0, 0.45), vec3(0.5, 0.12, 1.0), fi.mul(fi));
        au.addAssign(c.mul(rib).mul(rays).mul(float(1.0).sub(fi.mul(0.55))));
        haze.addAssign(smoothstep(0.22, 0.0, abs(n.sub(0.5))));
      });
      au.mulAssign(float(5.0 / AUR));
      au.addAssign(vec3(0.04, 0.5, 0.3).mul(haze).mul(float(0.12 / AUR)));
      au.mulAssign(smoothstep(0.0, 0.1, h).mul(float(1.0).sub(smoothstep(0.75, 1.0, h).mul(0.6))));
      col.addAssign(au);

      const a = normalize(d.xz.add(1e-5));
      const r1 = float(0.035).add(float(0.13).mul(fbm2(a.mul(2.6).add(3.0))).mul(float(0.6).add(float(0.4).mul(noise2(a.mul(1.2).add(9.0))))));
      const r2 = float(0.02).add(float(0.075).mul(fbm2(a.mul(5.0).add(20.0))));
      const m1 = vec3(0.02, 0.05, 0.075).add(vec3(0.06, 0.14, 0.14).mul(smoothstep(r1.mul(0.45), r1, h)));
      col.assign(mix(col, m1, smoothstep(r1.add(0.004), r1.sub(0.004), h)));
      col.assign(mix(col, vec3(0.005, 0.014, 0.024), smoothstep(r2.add(0.003), r2.sub(0.003), h)));
      return col;
    });
  }

  if (worldId === 'lanterns') {
    return Fn(([d]) => {
      const h = clamp(d.y, 0.0, 1.0);
      const col = mix(vec3(0.014, 0.018, 0.055), vec3(0.002, 0.004, 0.016), smoothstep(0.0, 0.55, h)).toVar();
      col.addAssign(vec3(0.3, 0.11, 0.03).mul(exp(h.mul(-10.0))).mul(0.4));
      const md = max(dot(d, uSunDir), 0.0);
      col.addAssign(
        vec3(0.9, 0.85, 0.7).mul(
          smoothstep(0.9988, 0.9992, md).mul(1.5).add(pow(md, 400.0).mul(0.3)).add(pow(md, 30.0).mul(0.06))
        )
      );
      col.addAssign(starsFn(d, 120.0, 0.1).mul(vec3(1.0, 0.95, 0.85)).mul(smoothstep(0.05, 0.3, h)));
      const cp = d.xz.div(h.add(0.2));
      const c = smoothstep(0.5, 0.8, fbm2(cp.mul(0.8).add(vec2(uTime.mul(0.003), 0.0))));
      col.addAssign(vec3(0.03, 0.035, 0.06).mul(c).mul(smoothstep(0.02, 0.2, h)).mul(float(1.0).add(float(3.0).mul(pow(md, 12.0)))));
      const a = normalize(d.xz.add(1e-5));
      const r = float(0.015).add(float(0.06).mul(fbm2(a.mul(3.0).add(5.0))));
      col.assign(mix(col, vec3(0.004, 0.005, 0.012), smoothstep(r.add(0.003), r.sub(0.003), h)));
      return col;
    });
  }

  if (worldId === 'dunes') {
    const arrakisMoon = Fn(([d, mDir, rad, seed]) => {
      const out = vec4(0.0).toVar();
      If(dot(d, mDir).greaterThan(0.0), () => {
        const mxv = normalize(cross(vec3(0.0, 1.0, 0.0), mDir));
        const myv = cross(mDir, mxv);
        const muv = vec2(dot(d, mxv), dot(d, myv)).div(rad);
        const r2 = dot(muv, muv);
        If(r2.lessThan(1.0), () => {
          const z = sqrt(max(1e-4, float(1.0).sub(r2)));
          const n = normalize(mxv.mul(muv.x).add(myv.mul(muv.y)).add(mDir.mul(z)));
          const moonSun = normalize(vec3(-0.85, 0.28, 0.42));
          const lit = smoothstep(-0.12, 0.78, dot(n, moonSun));
          const maria = fbm2(muv.mul(3.0).add(seed)).mul(0.62).add(fbm2(muv.mul(8.0).add(seed.mul(2.1))).mul(0.38));
          const crater = smoothstep(0.05, 0.0, abs(length(muv.sub(vec2(0.16, -0.1))).sub(0.25)));
          const darkSide = vec3(0.16, 0.09, 0.06);
          const brightSide = mix(vec3(0.78, 0.50, 0.28), vec3(1.35, 1.05, 0.74), maria.sub(crater.mul(0.22)));
          const rimFactor = pow(max(1e-4, float(1.0).sub(z)), 2.2);
          const col = mix(darkSide, brightSide, lit).add(vec3(1.4, 0.92, 0.52).mul(rimFactor).mul(pow(max(1e-4, lit), 0.6)).mul(0.75));
          const aa = smoothstep(1.0, 0.94, sqrt(r2));
          out.assign(vec4(col, aa.mul(float(0.42).add(lit.mul(0.52)))));
        });
      });
      return out;
    });

    const guildHeighliner = Fn(([d]) => {
      const cDir = normalize(vec3(-0.25, 0.185, -0.950));
      const out = vec4(0.0).toVar();
      If(dot(d, cDir).greaterThan(0.0), () => {
        const ux = normalize(cross(vec3(0.16, 1.0, 0.0), cDir));
        const uy = cross(cDir, ux);
        const p = vec2(dot(d, ux), dot(d, uy));
        const q = vec2(p.x.div(0.034), p.y.div(0.0105));
        const hull = length(vec2(max(abs(q.x).sub(0.45), 0.0), q.y));
        If(hull.lessThan(1.0), () => {
          const edge = smoothstep(1.0, 0.88, hull);
          const bayDist = length(q.sub(vec2(0.38, 0.0)).mul(vec2(1.15, 0.82)));
          const bay = smoothstep(0.30, 0.18, bayDist);
          const bayRim = smoothstep(0.33, 0.27, bayDist).mul(float(1.0).sub(bay));
          const sunRim = smoothstep(-0.15, 0.78, q.x.mul(-0.55).add(q.y.mul(0.83))).mul(pow(clamp(hull, 1e-4, 1.0), 1.6));
          const bodyCol = vec3(0.06, 0.036, 0.026).add(vec3(1.35, 0.88, 0.48).mul(sunRim.mul(0.95).add(bayRim.mul(0.45)))).toVar();
          bodyCol.assign(mix(bodyCol, vec3(0.015, 0.009, 0.01), bay));
          out.assign(vec4(bodyCol, edge.mul(0.58)));
        });
      });
      return out;
    });

    return Fn(([d]) => {
      const h = clamp(d.y, 0.0, 1.0);
      const haze = uGroundColor;
      const low = vec3(0.58, 0.31, 0.14);
      const mid = vec3(0.20, 0.11, 0.08);
      const zen = vec3(0.036, 0.028, 0.042);
      const col = mix(haze, low, smoothstep(0.0, 0.09, h)).toVar();
      col.assign(mix(col, mid, smoothstep(0.06, 0.24, h)));
      col.assign(mix(col, zen, smoothstep(0.18, 0.58, h)));

      col.addAssign(starsFn(d, 115.0, 0.09).mul(vec3(1.0, 0.86, 0.68)).mul(smoothstep(0.16, 0.48, h)));

      const sd = max(dot(d, uSunDir), 1e-4);
      col.addAssign(vec3(1.0, 0.50, 0.18).mul(pow(sd, 4.5)).mul(0.62));
      col.addAssign(vec3(1.0, 0.76, 0.42).mul(pow(sd, 48.0)).mul(1.45));
      col.addAssign(vec3(1.0, 0.94, 0.82).mul(smoothstep(0.9986, 0.9995, sd)).mul(8.5));
      const halo = exp(pow(sd.sub(0.955).mul(28.0), 2.0).negate()).mul(0.16);
      col.addAssign(vec3(1.0, 0.68, 0.36).mul(halo));

      const moonFade = smoothstep(0.03, 0.11, h);
      const m1 = arrakisMoon(d, normalize(vec3(-0.03, 0.165, -0.986)), 0.034, 4.1);
      col.assign(mix(col, m1.rgb, m1.a.mul(moonFade)));
      const m2 = arrakisMoon(d, normalize(vec3(0.09, 0.202, -0.975)), 0.014, 11.7);
      col.assign(mix(col, m2.rgb, m2.a.mul(moonFade)));
      const ship = guildHeighliner(d);
      col.assign(mix(col, ship.rgb, ship.a.mul(smoothstep(0.04, 0.13, h))));

      const cp = d.xz.div(h.add(0.22));
      const c = smoothstep(0.48, 0.84, fbm2(cp.mul(vec2(0.36, 1.65)).add(vec2(uTime.mul(0.011), 8.0))))
        .mul(smoothstep(0.03, 0.14, h))
        .mul(float(1.0).sub(smoothstep(0.24, 0.55, h)));
      const cloudCol = mix(vec3(0.72, 0.40, 0.19), vec3(1.0, 0.80, 0.52), pow(sd, 2.5));
      col.assign(mix(col, cloudCol, c.mul(0.34)));

      const a = normalize(d.xz.add(1e-5));
      const ang = atan(a.y, a.x);
      const storm = fbm2(vec2(ang.mul(2.4).add(uTime.mul(0.018)), h.mul(14.0)));
      col.assign(mix(col, uGroundColor.mul(1.05), smoothstep(0.07, 0.0, h).mul(storm).mul(0.42)));
      return col;
    });
  }

  // nebula
  return Fn(([d]) => {
    const p = d.mul(2.2);
    const q = p.add(
      vec3(
        fbm3(p.add(vec3(0.0, 1.7, 9.2))),
        fbm3(p.add(vec3(8.3, 2.8, 1.1))),
        fbm3(p.add(vec3(3.1, 7.7, 4.4)))
      ).mul(1.6)
    );
    const n = fbm3(q.add(uTime.mul(0.004)));
    const n2 = fbm3(q.mul(1.9).add(11.0));
    const col = vec3(0.003, 0.005, 0.018).toVar();
    const cloud = smoothstep(0.4, 0.86, n);
    const neb = mix(vec3(0.04, 0.3, 0.55), vec3(0.5, 0.07, 0.42), smoothstep(0.32, 0.68, n2)).toVar();
    neb.assign(mix(neb, vec3(1.0, 0.5, 0.22), smoothstep(0.62, 0.9, n).mul(0.85)));
    col.addAssign(neb.mul(cloud).mul(cloud).mul(1.15));
    col.mulAssign(float(1.0).sub(float(0.65).mul(smoothstep(0.5, 0.78, fbm3(p.mul(3.0).add(20.0))))));
    const s1 = starsFn(d, 130.0, 0.16);
    const s2 = starsFn(d.zxy, 60.0, 0.05);
    col.addAssign(s1.mul(mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash31(floor(d.mul(130.0))))));
    col.addAssign(s2.mul(vec3(1.0, 0.95, 0.9)).mul(2.2));
    return col;
  });
}

const skyMats = {};
function getSkyMat(w) {
  if (!skyMats[w.id]) {
    const uSunDir = uniform(new THREE.Vector3(...w.sun).normalize());
    const uGroundMode = uniform(w.groundMode);
    const uGroundColor = uniform(new THREE.Vector3(...w.groundColor));
    const skyFn = buildSkyColorFn(w.id, uSunDir, uGroundColor);

    const mat = new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    mat.colorNode = Fn(() => {
      const d = normalize(positionWorld.sub(cameraPosition));
      const col = vec3(0.0).toVar();
      if (w.groundMode < 0.5) {
        col.assign(skyFn(d));
      } else if (w.groundMode < 1.5) {
        col.assign(skyFn(vec3(d.x, abs(d.y), d.z)));
        If(d.y.lessThan(0.0), () => {
          col.mulAssign(uGroundColor);
        });
      } else {
        col.assign(d.y.lessThan(0.0).select(uGroundColor, skyFn(d)));
      }
      return col;
    })();
    void uGroundMode;
    skyMats[w.id] = mat;
  }
  return skyMats[w.id];
}

const skyGeo = new THREE.SphereGeometry(600, 48, 32);
const sky = new THREE.Mesh(skyGeo, getSkyMat(world));
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

// Image-based lighting via r187 cube-RT PMREMGenerator from the active sky dome.
const envScene = new THREE.Scene();
const envSky = new THREE.Mesh(skyGeo, sky.material);
envSky.frustumCulled = false;
envScene.add(envSky);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function refreshEnvironment() {
  envSky.material = sky.material;
  const next = pmrem.fromScene(envScene, 0, 0.1, 1400);
  scene.environment = next.texture;
  envRT?.dispose();
  envRT = next;
}

// —— Water / ice: r187 TSL ReflectorNode with ripple, mipmap frost & Fresnel ——
const uWaterRipple = uniform(0.01);
const uWaterReflect = uniform(0.8);
const uWaterFrost = uniform(0);
const uWaterFlow = uniform(1);
const uWaterRadius = uniform(420);
const uWaterDeep = uniform(new THREE.Vector3());

const waterReflector = reflector({
  resolutionScale: lowPower ? 0.5 : 0.75,
  bounces: false,
  generateMipmaps: true,
  samples: lowPower ? 0 : 4,
});
waterReflector.target.rotation.x = -Math.PI / 2;
scene.add(waterReflector.target);

const waterPerturbedUV = Fn(() => {
  const p = positionWorld.xz;
  const t = uTime.mul(uWaterFlow);
  const dist = length(cameraPosition.sub(positionWorld));
  const n = vec2(
    noise2(p.mul(1.3).add(vec2(t.mul(0.22), t.mul(0.1)))).sub(noise2(p.mul(1.3).add(vec2(t.mul(-0.17), t.mul(0.19))).add(17.3))),
    noise2(p.mul(1.9).add(vec2(t.mul(0.09), t.mul(-0.21))).add(41.7)).sub(noise2(p.mul(1.9).add(vec2(t.mul(0.15), t.mul(0.13))).add(73.1)))
  ).add(
    vec2(
      noise2(p.mul(5.1).add(vec2(t.mul(0.4), 0.0))).sub(0.5),
      noise2(p.mul(5.1).add(vec2(31.0, t.mul(-0.35)))).sub(0.5)
    ).mul(0.45)
  );
  const att = float(1.0).div(float(1.0).add(dist.mul(0.035)));
  const off = n.mul(vec2(1.0, 2.2)).mul(uWaterRipple).mul(att);
  return screenUV.flipX().add(off);
})();

waterReflector.uvNode = waterPerturbedUV;
waterReflector.levelNode = uWaterFrost.mul(3.2);

const waterMat = new THREE.MeshBasicNodeMaterial({ transparent: true });
waterMat.colorNode = Fn(() => {
  const p = positionWorld.xz;
  const toCam = cameraPosition.sub(positionWorld);
  const dist = length(toCam);
  const V = toCam.div(max(dist, 1e-4));
  const att = float(1.0).div(float(1.0).add(dist.mul(0.035)));
  const refl = waterReflector.rgb;
  const fres = pow(float(1.0).sub(clamp(V.y, 0.0, 1.0)), 4.0);
  const col = mix(uWaterDeep, refl, mix(uWaterReflect, 1.0, fres)).toVar();
  If(uWaterFrost.greaterThan(0.0), () => {
    const fr = fbm2(p.mul(2.4));
    const crack = smoothstep(0.006, 0.0, abs(noise2(p.mul(1.7).add(50.0)).sub(0.5))).mul(step(0.5, noise2(p.mul(0.35).add(3.0))));
    col.addAssign(
      uWaterFrost.mul(vec3(0.45, 0.7, 0.8)).mul(fr.mul(fr).mul(0.09).add(crack.mul(0.1))).mul(float(1.0).sub(fres.mul(0.8))).mul(att).mul(2.0)
    );
  });
  return col;
})();
waterMat.opacityNode = Fn(() => {
  const p = positionWorld.xz;
  return float(1.0).sub(smoothstep(uWaterRadius.mul(0.5), uWaterRadius.mul(0.97), length(p)));
})();

const water = new THREE.Mesh(new THREE.CircleGeometry(430, 72), waterMat);
water.rotation.x = -Math.PI / 2;
water.visible = false;
scene.add(water);

// —— Soft round sprite & GPU-driven weather particles ——
function makeSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const spriteTex = makeSpriteTexture();

const particleCount = lowPower ? 260 : 900;
const pBaseBuf = instancedArray(particleCount, 'vec3');
const pMode = uniform(0); // 0=stars, 1=snow, 2=rise, 3=dust
const pColor = uniform(new THREE.Color(WHITE));
const pOpacity = uniform(0.5);
const pSize = uniform(0.05);

const pMat = new THREE.SpriteNodeMaterial({
  map: spriteTex,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
});

pMat.positionNode = Fn(() => {
  const base = pBaseBuf.element(instanceIndex);
  const idx = float(instanceIndex);
  const pos = base.toVar();
  If(pMode.greaterThan(0.5).and(pMode.lessThan(1.5)), () => {
    // snow
    const sp = float(0.5).add(idx.mod(9.0).mul(0.09));
    pos.x.assign(base.x.add(sin(uTime.mul(0.5).add(idx)).mul(0.5)));
    pos.y.assign(float(16.0).sub(base.y.add(uTime.mul(sp)).mod(17.0)));
    pos.z.assign(base.z.add(cos(uTime.mul(0.4).add(idx.mul(1.3))).mul(0.5)));
  }).ElseIf(pMode.greaterThan(1.5).and(pMode.lessThan(2.5)), () => {
    // rise
    const sp = float(0.25).add(idx.mod(7.0).mul(0.05));
    pos.y.assign(float(-1.0).add(base.y.add(uTime.mul(sp)).mod(70.0)));
  }).ElseIf(pMode.greaterThan(2.5), () => {
    // dust
    const gust = float(2.2).add(idx.mod(7.0).mul(0.65));
    pos.x.assign(float(-34.0).add(base.x.add(uTime.mul(gust)).mod(68.0)));
    pos.y.assign(base.y.add(sin(uTime.mul(1.3).add(idx.mul(0.7))).mul(0.22)));
    pos.z.assign(base.z.add(cos(uTime.mul(0.9).add(idx.mul(1.1))).mul(0.35)));
  });
  return pos;
})();

const pDist = length(uv().sub(0.5)).mul(2.0);
pMat.colorNode = Fn(() => {
  If(pDist.greaterThan(1.0), () => {
    Discard();
  });
  const falloff = float(1.0).sub(smoothstep(0.0, 1.0, pDist));
  return pColor.mul(falloff);
})();
pMat.opacityNode = Fn(() => {
  const falloff = float(1.0).sub(smoothstep(0.0, 1.0, pDist));
  return pOpacity.mul(falloff);
})();
pMat.scaleNode = pSize;

const particles = new THREE.Sprite(pMat);
particles.count = particleCount;
particles.frustumCulled = false;
particles.visible = false;
scene.add(particles);
let particleMode = 'none';

function reshapeParticles(mode) {
  particleMode = mode;
  particles.rotation.set(0, 0, 0);
  pMode.value = mode === 'snow' ? 1 : mode === 'rise' ? 2 : mode === 'dust' ? 3 : 0;
  const arr = pBaseBuf.value.array;
  for (let i = 0; i < particleCount; i++) {
    const ix = i * 3;
    if (mode === 'snow') {
      arr[ix] = (Math.random() - 0.5) * 44;
      arr[ix + 1] = Math.random() * 17;
      arr[ix + 2] = (Math.random() - 0.5) * 44;
    } else if (mode === 'rise') {
      const r = 60 + Math.random() * 240;
      const a = Math.random() * Math.PI * 2;
      arr[ix] = Math.cos(a) * r;
      arr[ix + 1] = Math.random() * 70;
      arr[ix + 2] = Math.sin(a) * r;
    } else if (mode === 'dust') {
      arr[ix] = Math.random() * 68;
      arr[ix + 1] = -0.52 + Math.pow(Math.random(), 2.1) * 7.5;
      arr[ix + 2] = (Math.random() - 0.5) * 68;
    } else {
      const r = 22 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[ix] = r * Math.sin(phi) * Math.cos(theta);
      arr[ix + 1] = r * Math.cos(phi);
      arr[ix + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
  }
  pBaseBuf.value.needsUpdate = true;
}

function updateParticles(t, dt) {
  if (!particles.visible) return;
  if (particleMode === 'stars') {
    particles.rotation.y += dt * 0.006;
  }
}

// —— Per-world props (built once, on first visit) ——
const props = {};

function jsHash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function jsNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = jsHash(xi, yi);
  const b = jsHash(xi + 1, yi);
  const c = jsHash(xi, yi + 1);
  const d = jsHash(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function jsFbm(x, y, oct) {
  let a = 0.5;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * jsNoise(x, y);
    x = x * 2.02 + 13.1;
    y = y * 2.02 + 7.7;
    a *= 0.5;
  }
  return s;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function buildLanterns() {
  const group = new THREE.Group();
  const count = lowPower ? 150 : 460;
  const geo = new THREE.CylinderGeometry(0.2, 0.14, 0.44, 8, 1, false);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) + 0.22) / 0.44;
    colors[i * 3] = 2.0 - 0.9 * k;
    colors[i * 3 + 1] = 1.05 - 0.75 * k;
    colors[i * 3 + 2] = 0.3 - 0.25 * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicNodeMaterial({ vertexColors: true }), count);
  mesh.frustumCulled = false;
  const data = [];
  for (let i = 0; i < count; i++) {
    const r = 5 + Math.pow(Math.random(), 1.5) * 115;
    const a = Math.random() * Math.PI * 2;
    data.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y0: Math.random() * 48,
      speed: 0.14 + Math.random() * 0.3,
      phase: Math.random() * 20,
      scale: 0.7 + Math.random() * 0.8,
      rot: Math.random() * 6.28,
    });
  }
  const dummy = new THREE.Object3D();
  group.add(mesh);
  return {
    group,
    update(t) {
      for (let i = 0; i < count; i++) {
        const d = data[i];
        const yy = (d.y0 + t * d.speed) % 48;
        const born = smooth(0, 1.6, yy) * (1 - smooth(43, 48, yy));
        dummy.position.set(
          d.x + Math.sin(t * 0.2 + d.phase) * 1.2,
          -1.3 + yy,
          d.z + Math.cos(t * 0.17 + d.phase) * 1.2
        );
        dummy.rotation.set(Math.sin(t * 0.5 + d.phase) * 0.08, d.rot + t * 0.1, Math.cos(t * 0.4 + d.phase) * 0.08);
        dummy.scale.setScalar(d.scale * born + 0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildDunes() {
  const group = new THREE.Group();
  const baseGroundY = -0.62;

  const duneProfile = (u) => {
    const f = u - Math.floor(u);
    const k = 0.72;
    const tri = f < k ? f / k : (1 - f) / (1 - k);
    return Math.pow(Math.max(0, tri), 1.55);
  };

  const sampleDuneInfo = (x, z) => {
    const r = Math.hypot(x, z);
    const warp1 = jsFbm(x * 0.011 + 19.3, z * 0.011 + 7.1, 3);
    const warp2 = jsFbm(x * 0.024 - 11.4, z * 0.024 + 31.8, 2);
    const phase1 = x * 0.021 + z * 0.014 + warp1 * 1.85;
    const phase2 = -x * 0.013 + z * 0.025 + warp2 * 1.35;
    const d1 = duneProfile(phase1);
    const d2 = duneProfile(phase2);
    const macro = Math.pow(1 - Math.abs(2 * jsFbm(x * 0.0085 + 40, z * 0.0085 + 12, 4) - 1), 2.0);

    const nearMask = smooth(5.2, 22, r) * (1 - smooth(22, 34, r) * 0.35);
    const midMask = smooth(25, 68, r);
    const farMask = smooth(58, 155, r);

    const micro = (jsNoise(x * 0.14, z * 0.14) - 0.5) * 0.09 * smooth(3.5, 10, r);
    const centerSaddle = Math.exp(-z * z * 0.14) * 0.04 * (1 - smooth(3.5, 8.5, r));

    const y =
      centerSaddle +
      micro +
      (d1 * 0.48 + d2 * 0.20 - 0.10) * nearMask +
      (d1 * 3.8 + d2 * 1.8) * midMask +
      macro * 14.5 * farMask;

    const crest = Math.min(1, Math.max(d1 * smooth(6, 20, r), macro * farMask));
    return { y, crest };
  };

  const size = 640;
  const seg = lowPower ? 128 : 220;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const crests = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const { y, crest } = sampleDuneInfo(x, z);
    pos.setY(i, y);
    crests[i] = crest;

    const spicePatch = smooth(0.58, 0.85, jsFbm(x * 0.035 + 5.2, z * 0.035 - 8.4, 2));
    const cMix = Math.min(1, crest * 0.85 + 0.15);
    colors[i * 3] = 0.72 + cMix * 0.34 + spicePatch * 0.18;
    colors[i * 3 + 1] = 0.48 + cMix * 0.28 - spicePatch * 0.04;
    colors[i * 3 + 2] = 0.30 + cMix * 0.18 - spicePatch * 0.10;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aCrest', new THREE.BufferAttribute(crests, 1));
  geo.computeVertexNormals();

  // Tileable wind ripples bump map
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 256;
      const v = y / 256;
      const w = Math.sin(
        Math.PI * 2 * (16 * v + 0.32 * Math.sin(Math.PI * 2 * 2 * u) + 0.12 * Math.sin(Math.PI * 2 * 5 * u + 1.3))
      );
      const sharp = Math.pow(0.5 + 0.5 * w, 1.45) * 2 - 1;
      const g = 128 + sharp * 86 + (Math.random() - 0.5) * 36;
      const k = (y * 256 + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = g;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const bump = new THREE.CanvasTexture(c);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(185, 185);
  bump.anisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 8);

  const sandMat = new THREE.MeshPhysicalNodeMaterial({
    color: 0xd49456,
    vertexColors: true,
    roughness: 0.92,
    diffuseRoughness: 0.92, // r187 EON rough diffuse BRDF for powdery sand
    metalness: 0.04,
    bumpMap: bump,
    bumpScale: 0.68,
    envMapIntensity: 0.62,
  });

  // TSL wind-driven sand streamers over dune crests & twinkling Spice Melange glints
  const aCrest = attribute('aCrest', 'float');
  sandMat.emissiveNode = Fn(() => {
    const dFade = float(1.0).sub(smoothstep(18.0, 130.0, length(positionWorld.xz)));
    const wp = positionWorld.xz.mul(vec2(0.16, 0.52)).add(vec2(uTime.mul(-0.95), uTime.mul(0.14)));
    const wisp = noise2(wp).mul(noise2(wp.mul(2.2).add(vec2(uTime.mul(-0.65), 4.7))));
    const crestMist = smoothstep(0.32, 0.88, aCrest).mul(smoothstep(0.24, 0.72, wisp)).mul(dFade);
    const out = vec3(0.58, 0.30, 0.11).mul(crestMist).mul(0.45).toVar();

    const sg = positionWorld.xz.mul(24.0);
    const si = floor(sg);
    const sf = fract(sg).sub(0.5);
    const sSeed = hash21(si);
    If(sSeed.greaterThan(0.86), () => {
      const off = vec2(fract(sSeed.mul(31.7)), fract(sSeed.mul(73.1))).sub(0.5).mul(0.52);
      const pt = smoothstep(0.14, 0.0, length(sf.sub(off)));
      const tw = pow(float(0.5).add(float(0.5).mul(sin(uTime.mul(float(2.2).add(sSeed.mul(4.5))).add(sSeed.mul(67.0))))), 5.0);
      out.addAssign(vec3(2.2, 0.58, 0.12).mul(pt).mul(tw).mul(dFade).mul(float(0.4).add(aCrest.mul(0.6))));
    });
    return out;
  })();

  const sand = new THREE.Mesh(geo, sandMat);
  sand.position.y = baseGroundY;
  sand.receiveShadow = true;
  group.add(sand);

  const groundYAt = (x, z) => baseGroundY + sampleDuneInfo(x, z).y;

  // —— Shared materials for futuristic Arrakis architecture & vehicles ——
  const brutalistMat = new THREE.MeshPhysicalNodeMaterial({
    color: 0x4a3525,
    roughness: 0.86,
    diffuseRoughness: 0.88,
    metalness: 0.22,
    envMapIntensity: 0.7,
  });
  const darkHullMat = new THREE.MeshStandardNodeMaterial({
    color: 0x241b16,
    roughness: 0.52,
    metalness: 0.78,
    envMapIntensity: 0.95,
  });
  const amberGlowMat = new THREE.MeshBasicNodeMaterial({
    color: new THREE.Color(2.6, 1.15, 0.32),
  });
  const spiceBeaconMat = new THREE.MeshBasicNodeMaterial({
    color: new THREE.Color(3.2, 0.95, 0.22),
  });

  const makeTrapezoidGeo = (wBot, dBot, wTop, dTop, h) => {
    const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const py = p.getY(i) + 0.5;
      const wx = wBot + (wTop - wBot) * py;
      const dz = dBot + (dTop - dBot) * py;
      p.setX(i, p.getX(i) * wx);
      p.setY(i, py * h);
      p.setZ(i, p.getZ(i) * dz);
    }
    g.computeVertexNormals();
    return g;
  };

  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 64;
  beamCanvas.height = 128;
  const bctx = beamCanvas.getContext('2d');
  const bimg = bctx.createImageData(64, 128);
  for (let y = 0; y < 128; y++) {
    const v = 1 - y / 127;
    const vFade = Math.pow(v, 1.35) * smooth(0, 0.38, v) * smooth(1, 0.9, v);
    for (let x = 0; x < 64; x++) {
      const u = (x / 63) * 2 - 1;
      const hFade = Math.pow(Math.max(0, 1 - u * u), 2.2);
      const val = Math.round(255 * vFade * hFade);
      const k = (y * 64 + x) * 4;
      bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = val;
      bimg.data[k + 3] = val;
    }
  }
  bctx.putImageData(bimg, 0, 0);
  const beamTex = new THREE.CanvasTexture(beamCanvas);

  const makeBeamMesh = (rTop, rBot, h, colHex, maxAlpha) => {
    const beamGroup = new THREE.Group();
    const w = (rTop + rBot) * 1.35;
    const pg = new THREE.PlaneGeometry(w, h, 1, 8);
    pg.translate(0, -h * 0.5, 0);
    const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const k = 1 + pp.getY(i) / h;
      const halfW = rTop + (rBot - rTop) * (1 - k);
      pp.setX(i, Math.sign(pp.getX(i)) * halfW);
    }
    pg.computeVertexNormals();
    const mat = new THREE.MeshBasicNodeMaterial({
      map: beamTex,
      color: colHex,
      transparent: true,
      opacity: maxAlpha,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const p1 = new THREE.Mesh(pg, mat);
    const p2 = new THREE.Mesh(pg, mat);
    p2.rotation.y = Math.PI / 2;
    beamGroup.add(p1, p2);
    return beamGroup;
  };

  // —— 1. Arrakeen Brutalist Citadel ——
  const citadel = new THREE.Group();
  const cx = 56;
  const cz = -142;
  citadel.position.set(cx, groundYAt(cx, cz) - 7.5, cz);
  citadel.rotation.y = -0.36;

  const tier1 = new THREE.Mesh(makeTrapezoidGeo(42, 28, 30, 19.5, 12.5), brutalistMat);
  citadel.add(tier1);
  for (let b = -3; b <= 3; b++) {
    const rib = new THREE.Mesh(makeTrapezoidGeo(1.3, 2.2, 0.8, 1.2, 12.2), darkHullMat);
    rib.position.set(b * 4.6, 0, 11.2);
    citadel.add(rib);
  }
  const recess = new THREE.Mesh(makeTrapezoidGeo(28.5, 18.2, 28.5, 18.2, 1.4), darkHullMat);
  recess.position.y = 12.5;
  citadel.add(recess);
  const tier2 = new THREE.Mesh(makeTrapezoidGeo(29.5, 19.0, 19.5, 12.5, 9.8), brutalistMat);
  tier2.position.y = 13.6;
  citadel.add(tier2);
  const visor = new THREE.Mesh(makeTrapezoidGeo(22, 14.5, 24.5, 16.2, 1.9), darkHullMat);
  visor.position.set(-2.2, 20.2, 2.0);
  citadel.add(visor);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(makeTrapezoidGeo(13, 17, 8, 11, 15.5), brutalistMat);
    wing.position.set(side * 22.5, 0, 2.5);
    wing.rotation.z = -side * 0.06;
    citadel.add(wing);
  }
  const slit1 = new THREE.Mesh(new THREE.BoxGeometry(19.5, 0.34, 0.45), amberGlowMat);
  slit1.position.set(0, 13.1, 9.4);
  citadel.add(slit1);
  const slit2 = new THREE.Mesh(new THREE.BoxGeometry(13, 0.26, 0.45), amberGlowMat);
  slit2.position.set(-1.5, 19.8, 9.8);
  citadel.add(slit2);
  const citadelBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), spiceBeaconMat);
  citadelBeacon.position.set(3.5, 23.6, 0);
  citadel.add(citadelBeacon);
  group.add(citadel);

  // —— 2. Arrakis Windtrap & Holtzman Sensor Monoliths ——
  const monolithSpecs = [
    { x: -56, z: -122, h: 20, w: 4.6, tilt: 0.12, rotY: 0.42 },
    { x: -86, z: -98, h: 15.5, w: 3.6, tilt: 0.16, rotY: 0.55 },
    { x: 96, z: -102, h: 17.5, w: 4.2, tilt: -0.12, rotY: -0.48 },
    { x: -12, z: -148, h: 22.5, w: 5.2, tilt: 0.08, rotY: 0.15 },
  ];
  monolithSpecs.forEach((m) => {
    const mg = new THREE.Group();
    mg.position.set(m.x, groundYAt(m.x, m.z) - 5.0, m.z);
    mg.rotation.y = m.rotY;
    mg.rotation.z = m.tilt;
    const body = new THREE.Mesh(makeTrapezoidGeo(m.w, m.w * 0.62, m.w * 0.52, m.w * 0.36, m.h), brutalistMat);
    mg.add(body);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.22, m.h * 0.52, m.w * 0.54), amberGlowMat);
    slot.position.set(0, m.h * 0.6, 0);
    mg.add(slot);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(m.w * 0.36, 0.5, m.w * 0.3), spiceBeaconMat);
    tip.position.set(0, m.h + 0.22, 0);
    mg.add(tip);
    group.add(mg);
  });

  // —— 3. Colossal Crawler Spice Harvester ——
  const carrier = new THREE.Group();
  const hx = -32;
  const hz = -96;
  const carrierBasePos = new THREE.Vector3(hx, groundYAt(hx, hz) - 2.2, hz);
  carrier.position.copy(carrierBasePos);
  carrier.rotation.set(0.04, 0.42, -0.04);

  const crawlerBase = new THREE.Mesh(makeTrapezoidGeo(17.5, 9.2, 15.2, 7.8, 2.6), darkHullMat);
  carrier.add(crawlerBase);
  const carapace = new THREE.Mesh(makeTrapezoidGeo(14.6, 7.2, 11.2, 5.4, 2.4), brutalistMat);
  carapace.position.y = 2.5;
  carrier.add(carapace);
  for (let r = -2; r <= 2; r++) {
    const duct = new THREE.Mesh(makeTrapezoidGeo(1.4, 7.5, 1.1, 5.8, 2.6), darkHullMat);
    duct.position.set(r * 2.6, 2.5, 0);
    carrier.add(duct);
  }
  const harvSlit = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.42, 4.8), amberGlowMat);
  harvSlit.position.set(7.4, 2.1, 0);
  carrier.add(harvSlit);
  const harvBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), spiceBeaconMat);
  harvBeacon.position.set(-3.5, 5.1, 0);
  carrier.add(harvBeacon);

  const scanBeam1 = makeBeamMesh(0.45, 3.8, 14.0, 0xff9838, 0.42);
  scanBeam1.rotation.z = Math.PI / 2 - 0.22;
  scanBeam1.position.set(7.4, 2.1, -1.4);
  carrier.add(scanBeam1);
  const scanBeam2 = makeBeamMesh(0.45, 3.8, 14.0, 0xff9838, 0.42);
  scanBeam2.rotation.z = Math.PI / 2 - 0.22;
  scanBeam2.position.set(7.4, 2.1, 1.4);
  carrier.add(scanBeam2);
  group.add(carrier);

  // —— 4. Articulated Atreides Ornithopter Squadron ——
  const thopters = [];
  const wingGeo = new THREE.BoxGeometry(2.45, 0.022, 0.15);
  wingGeo.translate(1.225, 0, 0);

  for (let i = 0; i < 3; i++) {
    const tg = new THREE.Group();
    const fuselage = new THREE.Mesh(makeTrapezoidGeo(0.52, 1.9, 0.28, 1.15, 0.38), darkHullMat);
    tg.add(fuselage);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 2.0, 5), darkHullMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0.2, -1.7);
    tg.add(tail);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.62), amberGlowMat);
    canopy.position.set(0, 0.22, 0.55);
    tg.add(canopy);
    const searchLight = makeBeamMesh(0.05, 1.25, 5.8, 0xffb868, 0.24);
    searchLight.rotation.x = Math.PI / 2 - 0.26;
    searchLight.position.set(0, 0.08, 0.95);
    tg.add(searchLight);

    const wings = [];
    for (const side of [-1, 1]) {
      for (let w = 0; w < 4; w++) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.2, 0.32, 0.34 - w * 0.23);
        pivot.rotation.y = side * ((w - 1.5) * 0.16);
        const wingMesh = new THREE.Mesh(wingGeo, darkHullMat);
        if (side < 0) wingMesh.scale.x = -1;
        pivot.add(wingMesh);
        tg.add(pivot);
        wings.push({ pivot, side, idx: w });
      }
    }

    const scale = 0.58 + i * 0.14;
    tg.scale.setScalar(scale);
    group.add(tg);
    thopters.push({
      group: tg,
      wings,
      cx: -10 + i * 18,
      cz: -48 - i * 16,
      rx: 24 + i * 7,
      rz: 11 + i * 4,
      yBase: 5.2 + i * 2.1,
      speed: 0.23 + i * 0.05,
      phase: i * 2.1,
    });
  }

  // —— 5. Foreground-Midground Fremen Thumper & Seismic Waves ——
  const thumperGroup = new THREE.Group();
  const tx = -7.4;
  const tz = -6.2;
  const ty = groundYAt(tx, tz);
  thumperGroup.position.set(tx, ty - 0.08, tz);
  thumperGroup.rotation.z = -0.05;

  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.016, 1.05, 8), darkHullMat);
  stake.position.y = 0.32;
  stake.castShadow = true;
  thumperGroup.add(stake);

  const thumperCore = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.22, 8), spiceBeaconMat);
  thumperCore.position.y = 0.62;
  thumperGroup.add(thumperCore);

  const thumperHammer = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.072, 0.2, 8), brutalistMat);
  thumperHammer.position.y = 0.74;
  thumperHammer.castShadow = true;
  thumperGroup.add(thumperHammer);

  const rc = document.createElement('canvas');
  rc.width = rc.height = 128;
  const rctx = rc.getContext('2d');
  const rg = rctx.createRadialGradient(64, 64, 18, 64, 64, 62);
  rg.addColorStop(0, 'rgba(255,180,90,0)');
  rg.addColorStop(0.45, 'rgba(255,175,85,0.65)');
  rg.addColorStop(0.7, 'rgba(255,140,50,0.25)');
  rg.addColorStop(1, 'rgba(255,120,30,0)');
  rctx.fillStyle = rg;
  rctx.fillRect(0, 0, 128, 128);
  const ringTex = new THREE.CanvasTexture(rc);

  const seismicRings = [];
  const ringPlaneGeo = new THREE.PlaneGeometry(0.9, 0.9);
  ringPlaneGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 2; i++) {
    const rMat = new THREE.MeshBasicNodeMaterial({
      map: ringTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rMesh = new THREE.Mesh(ringPlaneGeo, rMat);
    rMesh.position.y = 0.09;
    thumperGroup.add(rMesh);
    seismicRings.push(rMesh);
  }
  group.add(thumperGroup);

  // —— 6. Airborne Spice Melange thermal vortex particles (GPU-driven SpriteNodeMaterial) ——
  const spiceCount = lowPower ? 120 : 320;
  const spiceBaseBuf = instancedArray(spiceCount, 'vec3');
  const spiceArr = spiceBaseBuf.value.array;
  for (let i = 0; i < spiceCount; i++) {
    const ix = i * 3;
    const r = 3 + Math.pow(Math.random(), 1.4) * 42;
    const a = Math.random() * Math.PI * 2;
    spiceArr[ix] = Math.cos(a) * r;
    spiceArr[ix + 1] = -0.35 + Math.pow(Math.random(), 1.8) * 5.5;
    spiceArr[ix + 2] = Math.sin(a) * r;
  }

  const spiceMotionScale = uniform(prefersReduced ? 0.2 : 1.0);
  const spiceMat = new THREE.SpriteNodeMaterial({
    map: spriteTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  spiceMat.positionNode = Fn(() => {
    const base = spiceBaseBuf.element(instanceIndex);
    const idx = float(instanceIndex);
    const speed = float(1.5).add(idx.mod(5.0).mul(0.4)).mul(spiceMotionScale);
    const driftX = base.x.add(uTime.mul(speed)).add(45.0).mod(90.0).sub(45.0);
    const driftY = base.y.add(sin(uTime.mul(1.1).add(idx.mul(0.9))).mul(0.32));
    const driftZ = base.z.add(cos(uTime.mul(0.85).add(idx.mul(0.6))).mul(0.45));
    return vec3(driftX, driftY, driftZ);
  })();
  const spiceDist = length(uv().sub(0.5)).mul(2.0);
  spiceMat.colorNode = Fn(() => {
    If(spiceDist.greaterThan(1.0), () => {
      Discard();
    });
    return vec3(1.0, 0.408, 0.094).mul(float(1.0).sub(smoothstep(0.0, 1.0, spiceDist)));
  })();
  spiceMat.opacityNode = Fn(() => float(0.78).mul(float(1.0).sub(smoothstep(0.0, 1.0, spiceDist))))();
  spiceMat.scaleNode = float(0.095);

  const spicePoints = new THREE.Sprite(spiceMat);
  spicePoints.count = spiceCount;
  spicePoints.frustumCulled = false;
  group.add(spicePoints);

  return {
    group,
    update(t) {
      const motionScale = prefersReduced ? 0.2 : 1;
      spiceMotionScale.value = motionScale;

      carrier.position.x = carrierBasePos.x + Math.sin(t * 0.08 * motionScale) * 1.2;
      scanBeam1.rotation.y = Math.sin(t * 0.55 * motionScale) * 0.14;
      scanBeam2.rotation.y = -Math.cos(t * 0.5 * motionScale) * 0.14;

      for (let i = 0; i < thopters.length; i++) {
        const th = thopters[i];
        const u = t * th.speed * motionScale + th.phase;
        const x = th.cx + Math.cos(u) * th.rx;
        const z = th.cz + Math.sin(u * 2) * th.rz * 0.55;
        const y = th.yBase + Math.sin(u * 1.7) * 0.75;
        const dx = -Math.sin(u) * th.rx;
        const dz = Math.cos(u * 2) * 2 * th.rz * 0.55;
        th.group.position.set(x, y, z);
        th.group.rotation.y = Math.atan2(dx, dz);
        th.group.rotation.z = -Math.cos(u) * 0.26;
        th.group.rotation.x = 0.08 + Math.sin(u * 1.7) * 0.06;

        const wingFreq = prefersReduced ? 6 : 52;
        for (let w = 0; w < th.wings.length; w++) {
          const wg = th.wings[w];
          const flap = Math.sin(t * wingFreq + wg.idx * 0.85 + th.phase) * 0.42;
          wg.pivot.rotation.z = wg.side * flap;
        }
      }

      const cycle = (t * 0.34 * motionScale) % 1;
      let hammerY = 0.48;
      if (cycle < 0.82) {
        hammerY = 0.48 + (cycle / 0.82) * 0.34;
      } else if (cycle < 0.88) {
        const drop = (cycle - 0.82) / 0.06;
        hammerY = 0.82 - drop * drop * 0.34;
      }
      thumperHammer.position.y = hammerY;

      for (let rIdx = 0; rIdx < seismicRings.length; rIdx++) {
        const ring = seismicRings[rIdx];
        const waveAge = (cycle - 0.86 + 1 + rIdx * 0.16) % 1;
        if (waveAge < 0.68) {
          const prog = waveAge / 0.68;
          const sc = 0.6 + prog * 9.5;
          ring.scale.setScalar(sc);
          ring.material.opacity = Math.sin(prog * Math.PI) * (1 - prog) * 0.48;
        } else {
          ring.material.opacity = 0;
        }
      }

      const pulse = 0.75 + 0.25 * Math.sin(t * 2.6);
      spiceBeaconMat.color.setRGB(3.2 * pulse, 0.95 * pulse, 0.22 * pulse);
    },
  };
}

function buildPlanet() {
  const group = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const bands = [
    [226, 190, 160],
    [196, 130, 120],
    [236, 214, 190],
    [150, 110, 130],
    [214, 160, 130],
    [110, 120, 150],
    [228, 200, 176],
  ];
  for (let y = 0; y < 256; y++) {
    const f = (y / 256) * (bands.length - 1) + (jsNoise(y * 0.09, 3) - 0.5) * 1.4;
    const i = Math.min(bands.length - 2, Math.max(0, Math.floor(f)));
    const k = Math.min(1, Math.max(0, f - i));
    const a = bands[i];
    const b = bands[i + 1];
    for (let x = 0; x < 512; x += 4) {
      const j = (jsFbm(x * 0.02, y * 0.12, 3) - 0.5) * 34;
      ctx.fillStyle = `rgb(${a[0] + (b[0] - a[0]) * k + j},${a[1] + (b[1] - a[1]) * k + j},${a[2] + (b[2] - a[2]) * k + j})`;
      ctx.fillRect(x, y, 4, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(20, 64, 48),
    new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 1, metalness: 0, envMapIntensity: 0.25 })
  );
  group.add(planet);

  const rc = document.createElement('canvas');
  rc.width = 256;
  rc.height = 4;
  const rctx = rc.getContext('2d');
  for (let x = 0; x < 256; x++) {
    const u = x / 256;
    let a = smooth(0, 0.06, u) * (1 - smooth(0.9, 1, u));
    a *= 0.35 + 0.65 * jsNoise(u * 38, 1.7);
    if (u > 0.52 && u < 0.58) a *= 0.08;
    rctx.fillStyle = `rgba(${235 - u * 40},${205 - u * 50},${180 - u * 20},${a * 0.85})`;
    rctx.fillRect(x, 0, 1, 4);
  }
  const rtex = new THREE.CanvasTexture(rc);
  rtex.colorSpace = THREE.SRGBColorSpace;
  const inner = 26;
  const outer = 44;
  const ringGeo = new THREE.RingGeometry(inner, outer, 160, 1);
  const rp = ringGeo.attributes.position;
  const ruv = ringGeo.attributes.uv;
  for (let i = 0; i < rp.count; i++) {
    ruv.setXY(i, (Math.hypot(rp.getX(i), rp.getY(i)) - inner) / (outer - inner), 0.5);
  }
  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicNodeMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  group.position.set(-46, 16, -96);
  group.rotation.set(0.42, 0, -0.3);
  return {
    group,
    update(t, dt) {
      planet.rotation.y += dt * 0.01;
    },
  };
}

const PROP_BUILDERS = { lanterns: buildLanterns, dunes: buildDunes, nebula: buildPlanet };
function getProps(id) {
  if (props[id] === undefined) {
    const build = PROP_BUILDERS[id];
    props[id] = build ? build() : null;
    if (props[id]) scene.add(props[id].group);
  }
  return props[id];
}

// —— Letters (MeshPhysicalNodeMaterial with EON diffuseRoughness & ice dispersion) ——
const LETTER_DEFAULTS = {
  color: 0xffffff,
  emissive: 0x000000,
  emissiveIntensity: 0,
  metalness: 0.5,
  roughness: 0.3,
  diffuseRoughness: 0,
  clearcoat: 0,
  transmission: 0,
  thickness: 0,
  ior: 1.5,
  dispersion: 0,
};
const frontMat = new THREE.MeshPhysicalNodeMaterial({ color: WHITE });
const edgeMat = new THREE.MeshPhysicalNodeMaterial({ color: CORAL });
frontMat.attenuationColor = new THREE.Color(0xc8f4ff);
frontMat.attenuationDistance = 5;

function applyMat(mat, spec) {
  const s = { ...LETTER_DEFAULTS, ...spec };
  mat.color.setHex(s.color);
  mat.emissive.setHex(s.emissive);
  mat.emissiveIntensity = s.emissiveIntensity;
  mat.metalness = s.metalness;
  mat.roughness = s.roughness;
  mat.diffuseRoughness = s.diffuseRoughness;
  mat.clearcoat = s.clearcoat;
  mat.clearcoatRoughness = 0.15;
  mat.transmission = lowPower ? 0 : s.transmission;
  mat.thickness = s.thickness;
  mat.ior = s.ior;
  mat.dispersion = lowPower ? 0 : s.dispersion;
  mat.needsUpdate = true;
}

function applyLetterTheme(w) {
  applyMat(frontMat, w.front);
  if (w.edge) applyMat(edgeMat, w.edge);
  letterMeshes.forEach((group) => {
    group.userData.edge.visible = !!w.edge;
  });
}

// —— World switching ——
let rimBaseIntensity = 1.5;
let renderPipeline = null;
const bloomStrength = uniform(0.5);
const bloomRadius = uniform(0.8);
const bloomThreshold = uniform(1.0);
const captionEl = document.getElementById('worldCaption');
let captionTimer = 0;

function showCaption(w) {
  if (!captionEl) return;
  captionEl.innerHTML = '';
  const name = document.createElement('span');
  name.className = 'world-name';
  name.textContent = w.label[lang] || w.label.en;
  const line = document.createElement('span');
  line.className = 'world-line';
  line.textContent = w.caption[lang] || w.caption.en;
  captionEl.append(name, line);
  captionEl.classList.add('visible');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => captionEl.classList.remove('visible'), 3600);
}

function applyWorld(id) {
  const w = WORLD_BY_ID[id] || WORLDS[0];
  world = w;

  sky.material = getSkyMat(w);
  refreshEnvironment();
  scene.environmentIntensity = w.env;

  scene.fog = w.fog ? new THREE.FogExp2(new THREE.Color().setRGB(...w.fog[0]), w.fog[1]) : null;

  water.visible = !!w.water;
  if (w.water) {
    water.position.y = w.water.y;
    waterReflector.target.position.y = w.water.y;
    uWaterRipple.value = prefersReduced ? w.water.ripple * 0.4 : w.water.ripple;
    uWaterReflect.value = w.water.reflect;
    uWaterFrost.value = w.water.frost;
    uWaterFlow.value = w.water.flow;
    uWaterDeep.value.set(...w.water.deep);
  }

  Object.keys(PROP_BUILDERS).forEach((pid) => {
    if (pid === w.id) getProps(pid).group.visible = true;
    else if (props[pid]) props[pid].group.visible = false;
  });

  particles.visible = !!w.particles;
  if (w.particles) {
    pColor.value.setHex(w.particles.color);
    pOpacity.value = w.particles.opacity;
    pSize.value = w.particles.size;
    reshapeParticles(w.particles.mode);
  } else {
    particleMode = 'none';
  }

  const sunDir = new THREE.Vector3(...w.sun).normalize();
  key.position.copy(sunDir).multiplyScalar(40);
  key.color.setHex(w.key[0]);
  key.intensity = w.key[1];
  key.castShadow = !!w.shadows;
  ambient.intensity = w.ambient;
  fill.color.setHex(w.fill[0]);
  fill.intensity = w.fill[1];
  rim.color.setHex(w.rim[0]);
  rimBaseIntensity = w.rim[1];
  rim.intensity = rimBaseIntensity;
  renderer.toneMappingExposure = w.exposure;

  bloomStrength.value = w.bloom[0];
  bloomRadius.value = w.bloom[1];
  bloomThreshold.value = w.bloom[2];

  controls.maxPolarAngle = w.maxPolar;
  applyLetterTheme(w);
  if (mode === 'scatter') setScatterTargets();

  document.querySelectorAll('.hud-bg').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.bg === w.id);
  });
}

// —— Per-world Soundtrack ——
const bgmPlayers = {};
let soundEnabled = true;
const BGM_MAX_VOL = 0.65;

function getBgmPlayer(w) {
  if (!w?.bgm) return null;
  if (!bgmPlayers[w.id]) {
    const audio = new Audio(w.bgm);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    bgmPlayers[w.id] = audio;
  }
  return bgmPlayers[w.id];
}

function playActiveBgm(targetWorld = world) {
  if (!soundEnabled || !introDone || document.hidden) return;
  const player = getBgmPlayer(targetWorld);
  if (player && player.paused) {
    player.play().catch(() => {});
  }
}

function updateBgmCrossfade(dt) {
  const step = Math.min(1, dt * 1.35);
  WORLDS.forEach((w) => {
    const player = bgmPlayers[w.id];
    if (!player) return;
    const isActive = soundEnabled && introDone && !document.hidden && world.id === w.id;
    const target = isActive ? BGM_MAX_VOL : 0;
    const nextVol = player.volume + (target - player.volume) * step;
    player.volume = Math.max(0, Math.min(1, Math.abs(nextVol - target) < 0.004 ? target : nextVol));
    if (target === 0 && player.volume <= 0.005 && !player.paused) {
      player.pause();
    }
  });
}

function updateSoundBtnUI() {
  if (!soundBtn) return;
  soundBtn.classList.toggle('active', soundEnabled);
  soundBtn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
  soundBtn.dataset.tk = soundEnabled ? 'soundOn' : 'soundOff';
  soundBtn.textContent = t(soundEnabled ? 'soundOn' : 'soundOff');
}

let switchToken = 0;
function setWorld(id, instant) {
  if (!instant && id === world.id) return;
  const nextW = WORLD_BY_ID[id] || WORLDS[0];
  playActiveBgm(nextW);
  const token = ++switchToken;
  if (instant || prefersReduced) {
    applyWorld(id);
    if (introDone) showCaption(world);
    return;
  }
  canvas.style.opacity = '0';
  setTimeout(() => {
    if (token !== switchToken) return;
    applyWorld(id);
    playActiveBgm(world);
    canvas.style.opacity = '1';
    if (introDone) showCaption(world);
  }, 460);
}

function initBgButtons() {
  const row = document.getElementById('bgRow');
  if (!row) return;
  WORLDS.forEach((w) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hud-btn hud-bg';
    btn.dataset.bg = w.id;
    btn.textContent = w.label[lang] || w.label.en;
    btn.addEventListener('click', () => setWorld(w.id));
    btn.addEventListener('mouseenter', () => cursorRing?.classList.add('hovering'));
    btn.addEventListener('mouseleave', () => cursorRing?.classList.remove('hovering'));
    row.appendChild(btn);
  });
}

function initRenderPipeline() {
  if (!lowPower && !prefersReduced) {
    try {
      renderPipeline = new THREE.RenderPipeline(renderer);
      const scenePass = pass(scene, camera);
      const scenePassColor = scenePass.getTextureNode('output');
      const bloomNode = bloom(scenePassColor, bloomStrength, bloomRadius, bloomThreshold);
      renderPipeline.outputNode = scenePassColor.add(bloomNode);
    } catch (e) {
      console.warn('[egg] bloom disabled', e);
      renderPipeline = null;
    }
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
  const y = r * Math.sin(phi) * Math.sin(theta) * 0.7;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    world.grounded ? Math.abs(y) + 0.3 : y,
    r * Math.cos(phi)
  );
}

function buildLetters(font) {
  LETTERS.forEach((ch, i) => {
    const geo = new TextGeometry(ch, {
      font,
      size: 1.35,
      depth: lowPower ? 0.28 : 0.42,
      curveSegments: lowPower ? 6 : 12,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelOffset: 0,
      bevelSegments: lowPower ? 2 : 4,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    geo.translate(-cx, -cy, -cz);

    const mesh = new THREE.Mesh(geo, frontMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edge = new THREE.Mesh(geo, edgeMat);
    edge.scale.setScalar(1.03);
    edge.position.z = -0.02;

    const group = new THREE.Group();
    group.add(edge);
    group.add(mesh);
    group.userData.edge = edge;

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

function updateLetters(dt, tNow) {
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
      const wave = prefersReduced ? 0 : Math.sin(tNow * 1.1 + i * 0.7) * world.bob;
      targetX = home.x;
      targetY = home.y + world.bob + wave;
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

    if (world.grounded && mesh.position.y < 0) {
      mesh.position.y = 0;
      if (vel.y < 0) vel.y = 0;
    }

    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, pointer.x * 0.15, 0.04);
    const tilt = world.grounded && world.bob === 0 ? 0.03 : 0.1;
    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, -pointer.y * tilt, 0.04);
  }
}

const timer = new THREE.Timer();
function animate(timestamp) {
  if (!running) return;
  requestAnimationFrame(animate);
  timer.update(timestamp);
  const dt = Math.min(0.033, timer.getDelta());
  const t = timer.getElapsed();
  uTime.value = t;

  if (introDone) {
    updateLetters(dt, t);
    controls.autoRotate = mode === 'assemble' && !isDragging;
  }

  updateParticles(t, dt);
  props[world.id]?.update(t, dt);
  updateBgmCrossfade(dt);
  rim.intensity = rimBaseIntensity * (1 + Math.sin(t * 2.0) * 0.15);

  controls.update();
  if (renderPipeline) renderPipeline.render();
  else renderer.render(scene, camera);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (document.hidden) {
    Object.values(bgmPlayers).forEach((p) => p.pause());
  } else if (running) {
    playActiveBgm(world);
    timer.reset();
    requestAnimationFrame(animate);
  }
});

async function boot() {
  try {
    initBgButtons();
    updateSoundBtnUI();
    getBgmPlayer(WORLDS[0]);
    const [, font] = await Promise.all([
      renderer.init(),
      new FontLoader().loadAsync(FONT_URL),
    ]);
    initRenderPipeline();
    buildLetters(font);
    setWorld(WORLDS[0].id, true);
    loading?.classList.add('is-hidden');
    shell?.classList.add('ready');
    startBtn?.classList.add('ready');
    requestAnimationFrame(animate);
  } catch (e) {
    showFatal(e);
  }
}

startBtn?.addEventListener('click', () => {
  intro?.classList.add('is-hidden');
  hud?.classList.add('visible');
  introDone = true;
  playActiveBgm(world);
  setMode('assemble');
  for (let i = 0; i < letterMeshes.length; i++) {
    letterMeshes[i].position.copy(scatterPositions[i]);
    velocities[i].set(0, 0, 0);
  }
  controls.autoRotate = true;
  showCaption(world);
});

soundBtn?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  updateSoundBtnUI();
  if (soundEnabled) playActiveBgm(world);
});

assembleBtn?.addEventListener('click', () => setMode('assemble'));
scatterBtn?.addEventListener('click', () => setMode('scatter'));
canvas.addEventListener('dblclick', () => {
  if (!introDone) return;
  setMode(mode === 'assemble' ? 'scatter' : 'assemble');
});

boot();
