/**
 * SKAND Easter Egg — Three.js spatial logo (no troika).
 * Letters scatter → assemble, pointer disturbance, orbit, bloom.
 * The logo lives in five procedural worlds (see WORLDS below).
 *
 * All imports are absolute esm.sh URLs so nested `from 'three'` is rewritten
 * by esm.sh — avoids broken bare importmap resolution in the browser.
 */
import * as THREE from 'https://esm.sh/three@0.170.0';
import { OrbitControls } from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/OutputPass.js';
import { Reflector } from 'https://esm.sh/three@0.170.0/examples/jsm/objects/Reflector.js';
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
/**
 * Five places rather than five colour schemes. Each world owns its sky shader,
 * ground, weather, light rig and the material the letters are made of, so the
 * logo is built out of the scene it stands in:
 *   mirror   — chrome standing in a flooded salt flat at dusk
 *   aurora   — ice on a frozen fjord under moving aurora
 *   lanterns — paper lanterns hovering over a night lake
 *   dunes    — sandstone monoliths at golden hour, casting long shadows
 *   nebula   — black mirror adrift beside a ringed planet
 */
const WORLDS = [
  {
    id: 'mirror',
    label: { en: 'Mirror', zh: '天空之镜' },
    caption: { en: 'Dusk on the flooded salt flats', zh: '黄昏 · 盐沼如镜' },
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
      emissive: 0x1cffb0,
      emissiveIntensity: 0.05,
    },
    edge: null,
  },
  {
    id: 'lanterns',
    label: { en: 'Lanterns', zh: '灯海' },
    caption: { en: 'A thousand wishes over still water', zh: '千灯入夜 · 一湖心愿' },
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
    front: { color: 0xffe2b8, metalness: 0, roughness: 0.9, emissive: 0xff8a2a, emissiveIntensity: 1.6 },
    edge: { color: 0x7a2a08, metalness: 0, roughness: 0.8, emissive: 0xff5a10, emissiveIntensity: 0.5 },
  },
  {
    id: 'dunes',
    label: { en: 'Dunes', zh: '沙丘' },
    caption: {
      en: 'Arrakis — spice in the wind, monoliths in the haze',
      zh: '厄拉科斯 · 香料随风，巨构隐现',
    },
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

// —— Three ——
const renderer = new THREE.WebGLRenderer({
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
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

// —— Shared GLSL ——
const uTime = { value: 0 };
const OCT = lowPower ? 3 : 5;
const GLSL_NOISE = /* glsl */ `
#define OCT ${OCT}
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
}
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1., 0., 0.)), f.x), mix(hash31(i + vec3(0., 1., 0.)), hash31(i + vec3(1., 1., 0.)), f.x), f.y),
    mix(mix(hash31(i + vec3(0., 0., 1.)), hash31(i + vec3(1., 0., 1.)), f.x), mix(hash31(i + vec3(0., 1., 1.)), hash31(i + vec3(1., 1., 1.)), f.x), f.y),
    f.z);
}
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < OCT; i++) { s += a * noise(p); p = p * 2.02 + vec2(13.1, 7.7); a *= .5; } return s; }
float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < OCT; i++) { s += a * noise3(p); p = p * 2.02 + vec3(13.1, 7.7, 3.3); a *= .5; } return s; }
`;

// —— Sky: one dome, one fragment shader per world ——
const SKY_VERT = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SKY_BODY = {
  mirror: /* glsl */ `
vec3 skyColor(vec3 d){
  float h = clamp(d.y, 0., 1.);
  vec3 zen = vec3(.002, .004, .026);
  vec3 mid = vec3(.045, .017, .095);
  vec3 hor = vec3(.6, .17, .06);
  vec3 col = mix(hor, mid, smoothstep(0., .17, h));
  col = mix(col, zen, smoothstep(.12, .7, h));
  float sd = max(dot(d, uSunDir), 0.);
  // away from the sun the horizon cools into a rose belt
  col = mix(col, mix(vec3(.055, .028, .1), col, smoothstep(.0, .4, h)), (1. - smoothstep(-.4, .75, dot(d, uSunDir))) * .7);
  col += vec3(1., .5, .25) * pow(sd, 10.) * .22 + vec3(1., .65, .4) * pow(sd, 160.) * .8;
  col += vec3(1., .86, .7) * smoothstep(.99935, .9997, sd) * 5.;
  vec2 cp = d.xz / (h + .14);
  float c = fbm(cp * vec2(.55, 1.5) + vec2(uTime * .004, 3.));
  c = smoothstep(.46, .78, c) * smoothstep(.01, .1, h) * (1. - smoothstep(.3, .62, h));
  vec3 lit = mix(vec3(1., .32, .26), vec3(1., .7, .4), pow(sd, 5.));
  vec3 cc = mix(lit * .8, vec3(.05, .025, .09), smoothstep(.04, .36, h));
  col = mix(col, cc, c * .75);
  col += stars(d, 120., .1) * vec3(.9, .92, 1.) * smoothstep(.28, .72, h);
  return col;
}`,
  aurora: /* glsl */ `
#define AUR ${lowPower ? 7 : 18}
vec3 skyColor(vec3 d){
  float h = clamp(d.y, 0., 1.);
  vec3 col = mix(vec3(.012, .04, .07), vec3(.002, .006, .02), smoothstep(0., .6, h));
  col += vec3(.02, .09, .08) * exp(-h * 7.);
  col += stars(d, 110., .11) * vec3(.8, .9, 1.) * smoothstep(.03, .2, h);
  // curtains: one winding curve in the sky plane, extruded upward through AUR thin layers
  vec3 au = vec3(0.);
  float haze = 0.;
  for (int i = 0; i < AUR; i++) {
    float fi = float(i) / float(AUR);
    float hg = 1. + fi * .32;
    vec2 p = d.xz * (hg / (h + .08));
    float n = fbm(p * .3 + vec2(uTime * .014, -uTime * .009));
    float rib = smoothstep(.05, 0., abs(n - .5));
    float rays = .3 + .7 * noise(vec2(p.x * 7. + uTime * .2, p.y * 7. - uTime * .12));
    vec3 c = mix(vec3(.08, 1., .45), vec3(.5, .12, 1.), fi * fi);
    au += c * rib * rays * (1. - .55 * fi);
    haze += smoothstep(.22, 0., abs(n - .5));
  }
  au *= 5. / float(AUR);
  au += vec3(.04, .5, .3) * haze * .12 / float(AUR);
  au *= smoothstep(0., .1, h) * (1. - smoothstep(.75, 1., h) * .6);
  col += au;
  vec2 a = normalize(d.xz + 1e-5);
  float r1 = .035 + .13 * fbm(a * 2.6 + 3.) * (.6 + .4 * noise(a * 1.2 + 9.));
  float r2 = .02 + .075 * fbm(a * 5. + 20.);
  vec3 m1 = vec3(.02, .05, .075) + vec3(.06, .14, .14) * smoothstep(r1 * .45, r1, h);
  col = mix(col, m1, smoothstep(r1 + .004, r1 - .004, h));
  col = mix(col, vec3(.005, .014, .024), smoothstep(r2 + .003, r2 - .003, h));
  return col;
}`,
  lanterns: /* glsl */ `
vec3 skyColor(vec3 d){
  float h = clamp(d.y, 0., 1.);
  vec3 col = mix(vec3(.014, .018, .055), vec3(.002, .004, .016), smoothstep(0., .55, h));
  col += vec3(.3, .11, .03) * exp(-h * 10.) * .4;
  float md = max(dot(d, uSunDir), 0.);
  col += vec3(.9, .85, .7) * (smoothstep(.9988, .9992, md) * 1.5 + pow(md, 400.) * .3 + pow(md, 30.) * .06);
  col += stars(d, 120., .1) * vec3(1., .95, .85) * smoothstep(.05, .3, h);
  vec2 cp = d.xz / (h + .2);
  float c = smoothstep(.5, .8, fbm(cp * .8 + vec2(uTime * .003, 0.)));
  col += vec3(.03, .035, .06) * c * smoothstep(.02, .2, h) * (1. + 3. * pow(md, 12.));
  vec2 a = normalize(d.xz + 1e-5);
  float r = .015 + .06 * fbm(a * 3. + 5.);
  col = mix(col, vec3(.004, .005, .012), smoothstep(r + .003, r - .003, h));
  return col;
}`,
  dunes: /* glsl */ `
vec4 arrakisMoon(vec3 d, vec3 mDir, float rad, float seed){
  if (dot(d, mDir) <= 0.) return vec4(0.);
  vec3 mx = normalize(cross(vec3(0., 1., 0.), mDir));
  vec3 my = cross(mDir, mx);
  vec2 uv = vec2(dot(d, mx), dot(d, my)) / rad;
  float r2 = dot(uv, uv);
  if (r2 >= 1.) return vec4(0.);
  float z = sqrt(max(1e-4, 1. - r2));
  vec3 n = normalize(uv.x * mx + uv.y * my + z * mDir);
  // Warm crescent lighting from the low Arrakis sun
  vec3 moonSun = normalize(vec3(-.85, .28, .42));
  float lit = smoothstep(-.12, .78, dot(n, moonSun));
  float maria = fbm(uv * 3.0 + seed) * .62 + fbm(uv * 8.0 + seed * 2.1) * .38;
  float crater = smoothstep(.05, 0., abs(length(uv - vec2(.16, -.1)) - .25));
  vec3 darkSide = vec3(.16, .09, .06);
  vec3 brightSide = mix(vec3(.78, .50, .28), vec3(1.35, 1.05, .74), maria - crater * .22);
  float rim = pow(max(1e-4, 1. - z), 2.2);
  vec3 col = mix(darkSide, brightSide, lit) + vec3(1.4, .92, .52) * rim * pow(max(1e-4, lit), .6) * .75;
  float aa = smoothstep(1., .94, sqrt(r2));
  return vec4(col, aa * (.42 + .52 * lit));
}
vec4 guildHeighliner(vec3 d){
  vec3 cDir = normalize(vec3(-.25, .185, -.950));
  if (dot(d, cDir) <= 0.) return vec4(0.);
  vec3 ux = normalize(cross(vec3(.16, 1., 0.), cDir));
  vec3 uy = cross(cDir, ux);
  vec2 p = vec2(dot(d, ux), dot(d, uy));
  vec2 q = vec2(p.x / .034, p.y / .0105);
  float hull = length(vec2(max(abs(q.x) - .45, 0.), q.y));
  if (hull >= 1.) return vec4(0.);
  float edge = smoothstep(1., .88, hull);
  // Deep hollow portal bay on the right end (Villeneuve Heighliner cylinder)
  float bay = smoothstep(.30, .18, length((q - vec2(.38, 0.)) * vec2(1.15, .82)));
  float bayRim = smoothstep(.33, .27, length((q - vec2(.38, 0.)) * vec2(1.15, .82))) * (1. - bay);
  // Smooth matte-obsidian cylinder with a razor-thin golden solar crescent rim
  float sunRim = smoothstep(-.15, .78, -q.x * .55 + q.y * .83) * pow(clamp(hull, 1e-4, 1.), 1.6);
  vec3 bodyCol = vec3(.06, .036, .026) + vec3(1.35, .88, .48) * (sunRim * .95 + bayRim * .45);
  bodyCol = mix(bodyCol, vec3(.015, .009, .01), bay);
  return vec4(bodyCol, edge * .58);
}
vec3 skyColor(vec3 d){
  float h = clamp(d.y, 0., 1.);
  // Arrakis ochre-amber dust horizon into roasted bronze mid-sky and deep obsidian-sepia zenith
  vec3 haze = uGroundColor;
  vec3 low = vec3(.58, .31, .14);
  vec3 mid = vec3(.20, .11, .08);
  vec3 zen = vec3(.036, .028, .042);
  vec3 col = mix(haze, low, smoothstep(0., .09, h));
  col = mix(col, mid, smoothstep(.06, .24, h));
  col = mix(col, zen, smoothstep(.18, .58, h));

  // Faint desert stars & high-orbit spice glints in the upper sky
  col += stars(d, 115., .09) * vec3(1., .86, .68) * smoothstep(.16, .48, h);

  // Scorching veiled Arrakis sun & parhelic dust halo
  float sd = max(dot(d, uSunDir), 1e-4);
  col += vec3(1., .50, .18) * pow(sd, 4.5) * .62 + vec3(1., .76, .42) * pow(sd, 48.) * 1.45;
  col += vec3(1., .94, .82) * smoothstep(.9986, .9995, sd) * 8.5;
  float halo = exp(-pow((sd - .955) * 28., 2.)) * .16;
  col += vec3(1., .68, .36) * halo;

  // Twin Moons of Arrakis (Krelln & Muad'Dib) framed in the open sky valley + Orbital Guild Heighliner
  vec4 m1 = arrakisMoon(d, normalize(vec3(-.03, .165, -.986)), .034, 4.1);
  col = mix(col, m1.rgb, m1.a * smoothstep(.03, .11, h));
  vec4 m2 = arrakisMoon(d, normalize(vec3(.09, .202, -.975)), .014, 11.7);
  col = mix(col, m2.rgb, m2.a * smoothstep(.03, .11, h));
  vec4 ship = guildHeighliner(d);
  col = mix(col, ship.rgb, ship.a * smoothstep(.04, .13, h));

  // Wind-sheared spice & dust stratus bands
  vec2 cp = d.xz / (h + .22);
  float c = smoothstep(.48, .84, fbm(cp * vec2(.36, 1.65) + vec2(uTime * .011, 8.)));
  c *= smoothstep(.03, .14, h) * (1. - smoothstep(.24, .55, h));
  vec3 cloudCol = mix(vec3(.72, .40, .19), vec3(1., .80, .52), pow(sd, 2.5));
  col = mix(col, cloudCol, c * .34);

  // Rolling Coriolis sandstorm haze along the horizon
  vec2 a = normalize(d.xz + 1e-5);
  float ang = atan(a.y, a.x);
  float storm = fbm(vec2(ang * 2.4 + uTime * .018, h * 14.));
  col = mix(col, uGroundColor * 1.05, smoothstep(.07, 0., h) * storm * .42);
  return col;
}`,
  nebula: /* glsl */ `
vec3 skyColor(vec3 d){
  vec3 p = d * 2.2;
  vec3 q = p + 1.6 * vec3(fbm3(p + vec3(0., 1.7, 9.2)), fbm3(p + vec3(8.3, 2.8, 1.1)), fbm3(p + vec3(3.1, 7.7, 4.4)));
  float n = fbm3(q + uTime * .004);
  float n2 = fbm3(q * 1.9 + 11.);
  vec3 col = vec3(.003, .005, .018);
  float cloud = smoothstep(.4, .86, n);
  vec3 neb = mix(vec3(.04, .3, .55), vec3(.5, .07, .42), smoothstep(.32, .68, n2));
  neb = mix(neb, vec3(1., .5, .22), smoothstep(.62, .9, n) * .85);
  col += neb * cloud * cloud * 1.15;
  col *= 1. - .65 * smoothstep(.5, .78, fbm3(p * 3. + 20.));
  float s1 = stars(d, 130., .16);
  float s2 = stars(d.zxy, 60., .05);
  col += s1 * mix(vec3(.7, .85, 1.), vec3(1., .85, .7), hash31(floor(d * 130.)));
  col += s2 * vec3(1., .95, .9) * 2.2;
  return col;
}`,
};

function skyFrag(body) {
  return /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform float uGroundMode;
uniform vec3 uGroundColor;
varying vec3 vWorld;
${GLSL_NOISE}
float stars(vec3 d, float scale, float density){
  vec3 g = d * scale; vec3 id = floor(g); vec3 f = fract(g) - .5;
  float hsh = hash31(id);
  if (hsh < 1. - density) return 0.;
  vec3 off = (vec3(hash31(id + 7.1), hash31(id + 13.7), hash31(id + 23.3)) - .5) * .6;
  float tw = .72 + .28 * sin(uTime * (1. + hsh * 3.) + hsh * 40.);
  return smoothstep(.1, 0., length(f - off)) * tw * (.35 + .65 * fract(hsh * 91.7));
}
${body}
void main(){
  vec3 d = normalize(vWorld - cameraPosition);
  vec3 col;
  if (uGroundMode < .5) {
    col = skyColor(d);
  } else if (uGroundMode < 1.5) {
    // below the horizon: the sky again, as the far water would return it
    col = skyColor(vec3(d.x, abs(d.y), d.z));
    if (d.y < 0.) col *= uGroundColor;
  } else {
    col = d.y < 0. ? uGroundColor : skyColor(d);
  }
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
}

const skyMats = {};
function getSkyMat(w) {
  if (!skyMats[w.id]) {
    skyMats[w.id] = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: skyFrag(SKY_BODY[w.id]),
      uniforms: {
        uTime,
        uSunDir: { value: new THREE.Vector3(...w.sun).normalize() },
        uGroundMode: { value: w.groundMode },
        uGroundColor: { value: new THREE.Vector3(...w.groundColor) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
  }
  return skyMats[w.id];
}

const skyGeo = new THREE.SphereGeometry(600, 48, 32);
const sky = new THREE.Mesh(skyGeo, getSkyMat(world));
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

// Image-based lighting comes from the very sky each world draws, so the
// letters carry the place on their surface.
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

// —— Water / ice: a real planar reflection with a shader on top ——
const WATER_SHADER = {
  name: 'EggWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uRipple: { value: 0.01 },
    uReflect: { value: 0.8 },
    uFrost: { value: 0 },
    uFlow: { value: 1 },
    uRadius: { value: 420 },
    uDeep: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec3 vWorld;
void main(){
  vUv = textureMatrix * vec4(position, 1.);
  vec4 w = modelMatrix * vec4(position, 1.);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
  fragmentShader: /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform float uTime, uRipple, uReflect, uFrost, uFlow, uRadius;
uniform vec3 uDeep;
varying vec4 vUv;
varying vec3 vWorld;
${GLSL_NOISE}
void main(){
  vec2 p = vWorld.xz;
  float t = uTime * uFlow;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 n = vec2(
    noise(p * 1.3 + vec2(t * .22, t * .1)) - noise(p * 1.3 + vec2(-t * .17, t * .19) + 17.3),
    noise(p * 1.9 + vec2(t * .09, -t * .21) + 41.7) - noise(p * 1.9 + vec2(t * .15, t * .13) + 73.1));
  n += .45 * vec2(noise(p * 5.1 + vec2(t * .4, 0.)) - .5, noise(p * 5.1 + vec2(31., -t * .35)) - .5);
  float att = 1. / (1. + dist * .035);
  vec4 uv = vUv;
  uv.xy += n * vec2(1., 2.2) * uRipple * att * uv.w;
  vec3 refl = texture2DProj(tDiffuse, uv).rgb;
  if (uFrost > 0.) {
    float r = uFrost * .012 * uv.w;
    refl += texture2DProj(tDiffuse, uv + vec4(r, 0., 0., 0.)).rgb;
    refl += texture2DProj(tDiffuse, uv - vec4(r, 0., 0., 0.)).rgb;
    refl += texture2DProj(tDiffuse, uv + vec4(0., r * 1.6, 0., 0.)).rgb;
    refl += texture2DProj(tDiffuse, uv - vec4(0., r * 1.6, 0., 0.)).rgb;
    refl *= .2;
  }
  float fres = pow(1. - clamp(V.y, 0., 1.), 4.);
  vec3 col = mix(uDeep, refl, mix(uReflect, 1., fres));
  if (uFrost > 0.) {
    float fr = fbm(p * 2.4);
    float crack = smoothstep(.006, 0., abs(noise(p * 1.7 + 50.) - .5)) * step(.5, noise(p * .35 + 3.));
    col += uFrost * vec3(.45, .7, .8) * (fr * fr * .09 + crack * .1) * (1. - fres * .8) * att * 2.;
  }
  float a = 1. - smoothstep(uRadius * .5, uRadius * .97, length(p));
  gl_FragColor = vec4(col * color, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
};

const waterRes = lowPower ? 512 : 1024;
const water = new Reflector(new THREE.CircleGeometry(430, 72), {
  textureWidth: waterRes,
  textureHeight: waterRes,
  clipBias: 0.003,
  multisample: lowPower ? 0 : 4,
  color: 0xffffff,
  shader: WATER_SHADER,
});
water.rotation.x = -Math.PI / 2;
water.material.transparent = true;
water.material.uniforms.uTime = uTime;
water.visible = false;
scene.add(water);

// —— Soft round sprite for all weather ——
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

const particleCount = lowPower ? 260 : 900;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(particleCount * 3);
const pBase = new Float32Array(particleCount * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: WHITE,
  size: 0.05,
  map: makeSpriteTexture(),
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
});
const particles = new THREE.Points(pGeo, pMat);
particles.frustumCulled = false;
particles.visible = false;
scene.add(particles);
let particleMode = 'none';

function reshapeParticles(mode) {
  particleMode = mode;
  particles.rotation.set(0, 0, 0);
  for (let i = 0; i < particleCount; i++) {
    const ix = i * 3;
    if (mode === 'snow') {
      pBase[ix] = (Math.random() - 0.5) * 44;
      pBase[ix + 1] = Math.random() * 17;
      pBase[ix + 2] = (Math.random() - 0.5) * 44;
    } else if (mode === 'rise') {
      // far field of lanterns, beyond the instanced ones
      const r = 60 + Math.random() * 240;
      const a = Math.random() * Math.PI * 2;
      pBase[ix] = Math.cos(a) * r;
      pBase[ix + 1] = Math.random() * 70;
      pBase[ix + 2] = Math.sin(a) * r;
    } else if (mode === 'dust') {
      pBase[ix] = Math.random() * 68;
      pBase[ix + 1] = -0.52 + Math.pow(Math.random(), 2.1) * 7.5;
      pBase[ix + 2] = (Math.random() - 0.5) * 68;
    } else {
      const r = 22 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pBase[ix] = r * Math.sin(phi) * Math.cos(theta);
      pBase[ix + 1] = r * Math.cos(phi);
      pBase[ix + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    pPos[ix] = pBase[ix];
    pPos[ix + 1] = pBase[ix + 1];
    pPos[ix + 2] = pBase[ix + 2];
  }
  pGeo.attributes.position.needsUpdate = true;
}

function updateParticles(t, dt) {
  if (!particles.visible) return;
  const arr = pPos;
  if (particleMode === 'snow') {
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3;
      const sp = 0.5 + (i % 9) * 0.09;
      arr[ix] = pBase[ix] + Math.sin(t * 0.5 + i) * 0.5;
      arr[ix + 1] = 16 - ((pBase[ix + 1] + t * sp) % 17);
      arr[ix + 2] = pBase[ix + 2] + Math.cos(t * 0.4 + i * 1.3) * 0.5;
    }
  } else if (particleMode === 'rise') {
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3;
      arr[ix + 1] = -1 + ((pBase[ix + 1] + t * (0.25 + (i % 7) * 0.05)) % 70);
    }
  } else if (particleMode === 'dust') {
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3;
      const gust = 2.2 + (i % 7) * 0.65;
      arr[ix] = -34 + ((pBase[ix] + t * gust) % 68);
      arr[ix + 1] = pBase[ix + 1] + Math.sin(t * 1.3 + i * 0.7) * 0.22;
      arr[ix + 2] = pBase[ix + 2] + Math.cos(t * 0.9 + i * 1.1) * 0.35;
    }
  } else {
    particles.rotation.y += dt * 0.006;
    return;
  }
  pGeo.attributes.position.needsUpdate = true;
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
    const k = (pos.getY(i) + 0.22) / 0.44; // 0 at the flame, 1 at the crown
    colors[i * 3] = 2.0 - 0.9 * k;
    colors[i * 3 + 1] = 1.05 - 0.75 * k;
    colors[i * 3 + 2] = 0.3 - 0.25 * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }), count);
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

  // Asymmetrical wind-carved barchan dune profile: gentle windward ramp, sharp leeward slip-face
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

    // Keep camera orbit zone (r <= 25) low so the camera never clips, while sculpting sharp crests
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

    // Vertex color grades from deep roasted umber troughs to sunlit golden-ochre & cinnamon Spice crests
    const spicePatch = smooth(0.58, 0.85, jsFbm(x * 0.035 + 5.2, z * 0.035 - 8.4, 2));
    const cMix = Math.min(1, crest * 0.85 + 0.15);
    let cr = 0.72 + cMix * 0.34 + spicePatch * 0.18;
    let cg = 0.48 + cMix * 0.28 - spicePatch * 0.04;
    let cb = 0.30 + cMix * 0.18 - spicePatch * 0.10;
    colors[i * 3] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;
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
  bump.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xd49456,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.04,
    bumpMap: bump,
    bumpScale: 0.68,
    envMapIntensity: 0.62,
  });

  // Inject wind-driven sand streamers over dune crests & circular pinpoint Spice Melange glints
  sandMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader =
      `attribute float aCrest;\nvarying vec3 vDuneWorld;\nvarying float vDuneCrest;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvDuneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDuneCrest = aCrest;`
      );
    shader.fragmentShader =
      `uniform float uTime;\nvarying vec3 vDuneWorld;\nvarying float vDuneCrest;\n` +
      `float duneH21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n` +
      `float duneN2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(duneH21(i), duneH21(i + vec2(1., 0.)), f.x), mix(duneH21(i + vec2(0., 1.)), duneH21(i + vec2(1., 1.)), f.x), f.y); }\n` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float dFade = 1.0 - smoothstep(18.0, 130.0, length(vDuneWorld.xz));
        vec2 wp = vDuneWorld.xz * vec2(0.16, 0.52) + vec2(-uTime * 0.95, uTime * 0.14);
        float wisp = duneN2(wp) * duneN2(wp * 2.2 + vec2(-uTime * 0.65, 4.7));
        float crestMist = smoothstep(0.32, 0.88, vDuneCrest) * smoothstep(0.24, 0.72, wisp) * dFade;
        totalEmissiveRadiance += vec3(0.58, 0.30, 0.11) * crestMist * 0.45;
        vec2 sg = vDuneWorld.xz * 24.0;
        vec2 si = floor(sg);
        vec2 sf = fract(sg) - 0.5;
        float sSeed = duneH21(si);
        if (sSeed > 0.86) {
          vec2 off = (vec2(fract(sSeed * 31.7), fract(sSeed * 73.1)) - 0.5) * 0.52;
          float pt = smoothstep(0.14, 0.0, length(sf - off));
          float tw = pow(0.5 + 0.5 * sin(uTime * (2.2 + sSeed * 4.5) + sSeed * 67.0), 5.0);
          totalEmissiveRadiance += vec3(2.2, 0.58, 0.12) * pt * tw * dFade * (0.4 + 0.6 * vDuneCrest);
        }`
      );
  };

  const sand = new THREE.Mesh(geo, sandMat);
  sand.position.y = baseGroundY;
  sand.receiveShadow = true;
  group.add(sand);

  const groundYAt = (x, z) => baseGroundY + sampleDuneInfo(x, z).y;

  // —— Shared materials for futuristic Arrakis architecture & vehicles ——
  const brutalistMat = new THREE.MeshStandardMaterial({
    color: 0x4a3525,
    roughness: 0.86,
    metalness: 0.22,
    envMapIntensity: 0.7,
  });
  const darkHullMat = new THREE.MeshStandardMaterial({
    color: 0x241b16,
    roughness: 0.52,
    metalness: 0.78,
    envMapIntensity: 0.95,
  });
  const amberGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.6, 1.15, 0.32),
  });
  const spiceBeaconMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(3.2, 0.95, 0.22),
  });

  // Helper: battered trapezoidal prism (Villeneuve brutalist monolith geometry)
  const makeTrapezoidGeo = (wBot, dBot, wTop, dTop, h) => {
    const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const py = p.getY(i) + 0.5; // 0 at base, 1 at top
      const wx = wBot + (wTop - wBot) * py;
      const dz = dBot + (dTop - dBot) * py;
      p.setX(i, p.getX(i) * wx);
      p.setY(i, py * h);
      p.setZ(i, p.getZ(i) * dz);
    }
    g.computeVertexNormals();
    return g;
  };

  // Helper: soft feathered volumetric light beam (canvas-textured crossed planes — zero hard edges or NaNs)
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 64;
  beamCanvas.height = 128;
  const bctx = beamCanvas.getContext('2d');
  const bimg = bctx.createImageData(64, 128);
  for (let y = 0; y < 128; y++) {
    const v = 1 - y / 127; // 1 at apex (top), 0 at base (bottom)
    const vFade = Math.pow(v, 1.35) * smooth(0, 0.38, v) * smooth(1, 0.9, v);
    for (let x = 0; x < 64; x++) {
      const u = (x / 63) * 2 - 1; // -1..1 across width
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
      const k = 1 + pp.getY(i) / h; // 1 at top, 0 at bottom
      const halfW = rTop + (rBot - rTop) * (1 - k);
      pp.setX(i, Math.sign(pp.getX(i)) * halfW);
    }
    pg.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
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

  // —— 1. Arrakeen Brutalist Citadel / Imperial Spaceport Bastion (distant right horizon) ——
  const citadel = new THREE.Group();
  const cx = 56;
  const cz = -142;
  citadel.position.set(cx, groundYAt(cx, cz) - 7.5, cz);
  citadel.rotation.y = -0.36;

  // Lower stepped ziggurat base deeply embedded in the dune ridge
  const tier1 = new THREE.Mesh(makeTrapezoidGeo(42, 28, 30, 19.5, 12.5), brutalistMat);
  citadel.add(tier1);
  // Brutalist exterior buttress ribs along the front facade
  for (let b = -3; b <= 3; b++) {
    const rib = new THREE.Mesh(makeTrapezoidGeo(1.3, 2.2, 0.8, 1.2, 12.2), darkHullMat);
    rib.position.set(b * 4.6, 0, 11.2);
    citadel.add(rib);
  }
  // Shadow recess band
  const recess = new THREE.Mesh(makeTrapezoidGeo(28.5, 18.2, 28.5, 18.2, 1.4), darkHullMat);
  recess.position.y = 12.5;
  citadel.add(recess);
  // Upper monumental keep
  const tier2 = new THREE.Mesh(makeTrapezoidGeo(29.5, 19.0, 19.5, 12.5, 9.8), brutalistMat);
  tier2.position.y = 13.6;
  citadel.add(tier2);
  // Cantilevered flight-deck visor
  const visor = new THREE.Mesh(makeTrapezoidGeo(22, 14.5, 24.5, 16.2, 1.9), darkHullMat);
  visor.position.set(-2.2, 20.2, 2.0);
  citadel.add(visor);
  // Flanking sloped bastion wings
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(makeTrapezoidGeo(13, 17, 8, 11, 15.5), brutalistMat);
    wing.position.set(side * 22.5, 0, 2.5);
    wing.rotation.z = -side * 0.06;
    citadel.add(wing);
  }
  // Glowing horizontal observation & hangar slits
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
  const monolithBeacons = [];
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
    monolithBeacons.push(tip);
    group.add(mg);
  });

  // —— 3. Colossal Crawler Spice Harvester on the left dune field + Spotter Carrier ——
  const carrier = new THREE.Group();
  const hx = -32;
  const hz = -96;
  const carrierBasePos = new THREE.Vector3(hx, groundYAt(hx, hz) - 2.2, hz);
  carrier.position.copy(carrierBasePos);
  carrier.rotation.set(0.04, 0.42, -0.04);

  // Heavy industrial crawler chassis & ribbed refinery carapace
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
  // Harvester front floodlight slit & soft volumetric dust headlamp beams
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

  // —— 4. Articulated Atreides Ornithopter Squadron (3 patrolling craft) ——
  const thopters = [];
  const wingGeo = new THREE.BoxGeometry(2.45, 0.022, 0.15);
  wingGeo.translate(1.225, 0, 0); // pivot at wing root

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
    // Forward searchlight cone with soft fade
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

  // —— 5. Foreground-Midground Fremen Thumper (沙槌) & Soft Radial Seismic Waves ——
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

  // Soft radial ring texture for organic sand shockwaves
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
    const rMat = new THREE.MeshBasicMaterial({
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

  // —— 6. Airborne Spice Melange (香料) thermal vortex particles ——
  const spiceCount = lowPower ? 120 : 320;
  const spiceGeo = new THREE.BufferGeometry();
  const spicePos = new Float32Array(spiceCount * 3);
  const spiceBase = new Float32Array(spiceCount * 3);
  for (let i = 0; i < spiceCount; i++) {
    const ix = i * 3;
    const r = 3 + Math.pow(Math.random(), 1.4) * 42;
    const a = Math.random() * Math.PI * 2;
    spiceBase[ix] = Math.cos(a) * r;
    spiceBase[ix + 1] = -0.35 + Math.pow(Math.random(), 1.8) * 5.5;
    spiceBase[ix + 2] = Math.sin(a) * r;
    spicePos[ix] = spiceBase[ix];
    spicePos[ix + 1] = spiceBase[ix + 1];
    spicePos[ix + 2] = spiceBase[ix + 2];
  }
  spiceGeo.setAttribute('position', new THREE.BufferAttribute(spicePos, 3));
  const spiceMat = new THREE.PointsMaterial({
    color: 0xff6818,
    size: 0.095,
    map: pMat.map,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const spicePoints = new THREE.Points(spiceGeo, spiceMat);
  spicePoints.frustumCulled = false;
  group.add(spicePoints);

  return {
    group,
    update(t) {
      const motionScale = prefersReduced ? 0.2 : 1;

      // Crawler Spice Harvester subtle crawl & headlamp sweep
      carrier.position.x = carrierBasePos.x + Math.sin(t * 0.08 * motionScale) * 1.2;
      scanBeam1.rotation.y = Math.sin(t * 0.55 * motionScale) * 0.14;
      scanBeam2.rotation.y = -Math.cos(t * 0.5 * motionScale) * 0.14;

      // Ornithopter patrol flight + high-frequency articulated wing beat
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

      // Fremen Thumper rhythmic mechanical strike & expanding seismic sand rings
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

      // Monolith beacon subtle pulse
      const pulse = 0.75 + 0.25 * Math.sin(t * 2.6);
      spiceBeaconMat.color.setRGB(3.2 * pulse, 0.95 * pulse, 0.22 * pulse);

      // Swirling Spice Melange particles
      for (let i = 0; i < spiceCount; i++) {
        const ix = i * 3;
        const drift = ((spiceBase[ix] + t * (1.5 + (i % 5) * 0.4) * motionScale + 45) % 90) - 45;
        spicePos[ix] = drift;
        spicePos[ix + 1] = spiceBase[ix + 1] + Math.sin(t * 1.1 + i * 0.9) * 0.32;
        spicePos[ix + 2] = spiceBase[ix + 2] + Math.cos(t * 0.85 + i * 0.6) * 0.45;
      }
      spiceGeo.attributes.position.needsUpdate = true;
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
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, envMapIntensity: 0.25 })
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
    if (u > 0.52 && u < 0.58) a *= 0.08; // the gap
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
    new THREE.MeshBasicMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
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

// —— Letters ——
const LETTER_DEFAULTS = {
  color: 0xffffff,
  emissive: 0x000000,
  emissiveIntensity: 0,
  metalness: 0.5,
  roughness: 0.3,
  clearcoat: 0,
  transmission: 0,
  thickness: 0,
  ior: 1.5,
};
const frontMat = new THREE.MeshPhysicalMaterial({ color: WHITE });
const edgeMat = new THREE.MeshPhysicalMaterial({ color: CORAL });
frontMat.attenuationColor = new THREE.Color(0xc8f4ff);
frontMat.attenuationDistance = 5;

function applyMat(mat, spec) {
  const s = { ...LETTER_DEFAULTS, ...spec };
  mat.color.setHex(s.color);
  mat.emissive.setHex(s.emissive);
  mat.emissiveIntensity = s.emissiveIntensity;
  mat.metalness = s.metalness;
  mat.roughness = s.roughness;
  mat.clearcoat = s.clearcoat;
  mat.clearcoatRoughness = 0.15;
  // true refraction needs an extra scene pass; phones get a clear-coated solid instead
  mat.transmission = lowPower ? 0 : s.transmission;
  mat.thickness = s.thickness;
  mat.ior = s.ior;
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
let bloomPass = null;
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
    const u = water.material.uniforms;
    water.position.y = w.water.y;
    u.uRipple.value = prefersReduced ? w.water.ripple * 0.4 : w.water.ripple;
    u.uReflect.value = w.water.reflect;
    u.uFrost.value = w.water.frost;
    u.uFlow.value = w.water.flow;
    u.uDeep.value.set(...w.water.deep);
  }

  Object.keys(PROP_BUILDERS).forEach((pid) => {
    if (pid === w.id) getProps(pid).group.visible = true;
    else if (props[pid]) props[pid].group.visible = false;
  });

  particles.visible = !!w.particles;
  if (w.particles) {
    pMat.color.setHex(w.particles.color);
    pMat.opacity = w.particles.opacity;
    pMat.size = w.particles.size;
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

  if (bloomPass) {
    bloomPass.strength = w.bloom[0];
    bloomPass.radius = w.bloom[1];
    bloomPass.threshold = w.bloom[2];
  }

  controls.maxPolarAngle = w.maxPolar;
  applyLetterTheme(w);
  if (mode === 'scatter') setScatterTargets();

  document.querySelectorAll('.hud-bg').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.bg === w.id);
  });
}

let switchToken = 0;
function setWorld(id, instant) {
  if (!instant && id === world.id) return;
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

let composer = null;
if (!lowPower && !prefersReduced) {
  try {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.8, 1.0);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
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
  const y = r * Math.sin(phi) * Math.sin(theta) * 0.7;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    // worlds with a ground keep the letters above it
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
    // Accent edge via a slightly larger second mesh
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

    // the ground is solid: letters rest on it, never sink through it
    if (world.grounded && mesh.position.y < 0) {
      mesh.position.y = 0;
      if (vel.y < 0) vel.y = 0;
    }

    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, pointer.x * 0.15, 0.04);
    const tilt = world.grounded && world.bob === 0 ? 0.03 : 0.1;
    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, -pointer.y * tilt, 0.04);
  }
}

const startTime = performance.now();
let last = startTime;
function animate() {
  if (!running) return;
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const t = (now - startTime) * 0.001;
  uTime.value = t;

  if (introDone) {
    updateLetters(dt);
    controls.autoRotate = mode === 'assemble' && !isDragging;
  }

  updateParticles(t, dt);
  props[world.id]?.update(t, dt);
  rim.intensity = rimBaseIntensity * (1 + Math.sin(now * 0.002) * 0.15);

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
    setWorld(WORLDS[0].id, true);
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
  showCaption(world);
});

assembleBtn?.addEventListener('click', () => setMode('assemble'));
scatterBtn?.addEventListener('click', () => setMode('scatter'));
canvas.addEventListener('dblclick', () => {
  if (!introDone) return;
  setMode(mode === 'assemble' ? 'scatter' : 'assemble');
});

boot();
