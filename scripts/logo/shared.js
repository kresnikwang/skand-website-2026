// Shared helpers for SKAND daily hero logo effects.
// All effects are PixiJS v8 (WebGL renderer for cross-browser filter support).

export const PIXI_URL = 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
export const FILTERS_URL = 'https://cdn.jsdelivr.net/npm/pixi-filters@6/dist/pixi-filters.mjs';
export const MATTER_URL = 'https://esm.sh/matter-js@0.20.0';

export const isMobile =
  window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;

// China day-of-week based on UTC+8 (no DST). Mon=1 ... Sun=7.
export function getChinaDay() {
  const now = new Date();
  const cn = new Date(now.getTime() + (480 + now.getTimezoneOffset()) * 60000);
  const d = cn.getDay(); // 0 Sun .. 6 Sat
  return d === 0 ? 7 : d;
}

const DAY_ALIASES = {
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  sunday: 7, sun: 7,
};

// Support ?fx=1..7 or ?fx=monday..sunday to preview any day's effect.
export function getEffectiveDay() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('fx')) return getChinaDay();
  const raw = params.get('fx').toLowerCase().trim();
  if (DAY_ALIASES[raw]) return DAY_ALIASES[raw];
  const n = parseInt(raw, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 7) return n;
  return getChinaDay();
}

const HIDE =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';

// Hide the original HTML SKAND title (replaced by the Pixi logo), but keep the
// company slogan + Chinese line visible and position them below the logo.
export function prepareHeroForPixi() {
  const ht = document.getElementById('heroTitle');
  if (ht) ht.style.cssText = HIDE;

  const tagline = document.querySelector('.hero-tagline');
  if (tagline) {
    tagline.style.cssText =
      'position:absolute;left:50%;top:calc(50% + 150px);transform:translateX(-50%);opacity:0;margin:0;z-index:3;pointer-events:none;transition:opacity .8s ease;';
    setTimeout(() => (tagline.style.opacity = '1'), 900);
  }
  const cn = document.querySelector('.hero-cn');
  if (cn) {
    cn.style.cssText =
      'position:absolute;left:50%;top:calc(50% + 210px);transform:translateX(-50%);opacity:0;margin:0;z-index:3;pointer-events:none;transition:opacity .8s ease;';
    setTimeout(() => (cn.style.opacity = '1'), 1100);
  }

  document.querySelectorAll('.hero-bg-line').forEach((e) => (e.style.display = 'none'));
  const hc = document.getElementById('heroCanvas');
  if (hc) hc.style.display = 'none';

  const scroll = document.querySelector('.hero-scroll');
  if (scroll) {
    scroll.style.transition = 'opacity .8s ease';
    setTimeout(() => (scroll.style.opacity = '1'), 700);
  }
  const btn = document.getElementById('findBSideBtn');
  if (btn) setTimeout(() => btn.classList.add('visible'), 900);
}

// Fallback: show the static SKAND title with entrance animation if a Pixi effect fails.
export function revealStaticTitle() {
  const ht = document.getElementById('heroTitle');
  if (ht) {
    ht.style.cssText =
      'opacity:1;transform:translateY(0) scale(1);filter:blur(0px);transition:opacity .8s ease, transform .8s cubic-bezier(0.2, 0, 0.2, 1), filter .8s ease;';
  }
  document
    .querySelectorAll('.hero-tagline, .hero-cn')
    .forEach((e) => {
      e.style.cssText =
        'opacity:1;transform:translateY(0);transition:opacity .8s ease, transform .8s ease;';
    });
  document.querySelectorAll('.hero-bg-line').forEach((e) => (e.style.display = ''));
  const hc = document.getElementById('heroCanvas');
  if (hc) hc.style.display = 'none';
  const scroll = document.querySelector('.hero-scroll');
  if (scroll) {
    scroll.style.transition = 'opacity .8s ease';
    scroll.style.opacity = '1';
  }
  const btn = document.getElementById('findBSideBtn');
  if (btn) btn.classList.add('visible');
}

// Create a Pixi Application. We target Pixi v8 (dual WebGPU/WebGL capable),
// but pin WebGL: pixi-filters v6 ships no WebGPU programs, so its filters
// (AdvancedBloom/Glow/Bevel) would crash on Chrome's default WebGPU.
// WebGL keeps every filter working across all browsers.
export async function makeApp(hero, { pointerEvents = false } = {}) {
  const { Application } = await import(PIXI_URL);
  const app = new Application();
  await app.init({
    resizeTo: hero,
    backgroundAlpha: 0,
    antialias: true,
    preference: 'webgl',
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  const cv = app.canvas;
  cv.style.position = 'absolute';
  cv.style.top = '0';
  cv.style.left = '0';
  cv.style.width = '100%';
  cv.style.height = '100%';
  cv.style.zIndex = '2';
  cv.style.pointerEvents = pointerEvents ? 'auto' : 'none';
  hero.appendChild(cv);
  return app;
}

// Fit a sprite to a fraction of the hero width and center it.
export function fitAndCenter(sprite, app, ratio = 0.7) {
  const maxW = app.screen.width * ratio;
  const s = maxW / sprite.texture.width;
  sprite.scale.set(s);
  sprite.anchor.set(0.5);
  sprite.x = app.screen.width / 2;
  sprite.y = app.screen.height / 2;
  return sprite;
}

// Render the SKAND wordmark to a 2D canvas. mode 'fill' or 'stroke'.
export function createTextCanvas(opts = {}) {
  const {
    text = 'SKAND',
    fontFamily = "'Cormorant Garamond', Georgia, serif",
    weight = 500,
    size = 200,
    color = '#f0ede8',
    letterSpacing = 6,
    mode = 'fill',
    strokeColor = '#f0ede8',
    strokeWidth = 3,
    supersample = 2,
    pad = (opts.mode === 'stroke' ? (opts.strokeWidth || 3) * supersample * 3 : 30 * supersample) / supersample,
  } = opts;

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fpx = size * supersample;
  const font = `${weight} ${fpx}px ${fontFamily}`;
  ctx.font = font;
  try {
    ctx.letterSpacing = letterSpacing * supersample + 'px';
  } catch (e) {}
  const m = ctx.measureText(text);
  const padPx = pad * supersample;
  const w = Math.ceil(m.width) + padPx * 2;
  const h = Math.ceil(fpx * 1.5) + padPx * 2;
  c.width = w;
  c.height = h;

  const x2 = c.getContext('2d');
  x2.font = font;
  try {
    x2.letterSpacing = letterSpacing * supersample + 'px';
  } catch (e) {}
  x2.textAlign = 'center';
  x2.textBaseline = 'middle';
  if (mode === 'stroke') {
    x2.lineJoin = 'round';
    x2.lineWidth = strokeWidth * supersample;
    x2.strokeStyle = strokeColor;
    x2.strokeText(text, w / 2, h / 2);
  } else {
    x2.fillStyle = color;
    x2.fillText(text, w / 2, h / 2);
  }
  return { canvas: c, width: w, height: h, cssWidth: w / supersample, cssHeight: h / supersample };
}

// Same as above, but with the brand coral->white horizontal gradient used by
// .hero-title. Use this for all daily Pixi effects so the logo keeps its color.
export function brandTextCanvas(opts = {}) {
  const text = opts.text || 'SKAND';
  const fontFamily = opts.fontFamily || "'Cormorant Garamond', Georgia, serif";
  const weight = opts.weight || 500;
  const size = opts.size || 200;
  const letterSpacing = opts.letterSpacing != null ? opts.letterSpacing : 6;
  const supersample = opts.supersample || 2;

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fpx = size * supersample;
  const font = `${weight} ${fpx}px ${fontFamily}`;
  ctx.font = font;
  try {
    ctx.letterSpacing = letterSpacing * supersample + 'px';
  } catch (e) {}
  const m = ctx.measureText(text);
  const pad = 30 * supersample;
  const w = Math.ceil(m.width) + pad * 2;
  const h = Math.ceil(fpx * 1.5) + pad * 2;
  c.width = w;
  c.height = h;

  const x2 = c.getContext('2d');
  x2.font = font;
  try {
    x2.letterSpacing = letterSpacing * supersample + 'px';
  } catch (e) {}
  x2.textAlign = 'center';
  x2.textBaseline = 'middle';

  const grad = x2.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0.0, '#e8563a');
  grad.addColorStop(0.3, '#f0ede8');
  grad.addColorStop(0.7, '#f0ede8');
  grad.addColorStop(1.0, '#e8563a');
  x2.fillStyle = grad;
  x2.fillText(text, w / 2, h / 2);

  return { canvas: c, width: w, height: h, cssWidth: w / supersample, cssHeight: h / supersample };
}

export function onResize(app, cb) {
  const handler = () => cb(app.screen.width, app.screen.height);
  app.renderer.on('resize', handler);
  handler();
  return handler;
}

// Track pointer position in hero-local CSS px (= Pixi stage coords thanks to autoDensity).
export function trackPointer(hero) {
  const s = { x: -9999, y: -9999, inside: false, moved: false };
  const upd = (cx, cy) => {
    const r = hero.getBoundingClientRect();
    s.x = cx - r.left;
    s.y = cy - r.top;
    s.inside = s.x >= 0 && s.y >= 0 && s.x <= r.width && s.y <= r.height;
    s.moved = true;
  };
  window.addEventListener('mousemove', (e) => upd(e.clientX, e.clientY), { passive: true });
  hero.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches[0]) upd(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  hero.addEventListener('touchend', () => (s.inside = false), { passive: true });
  return s;
}

// Is the pointer inside a sprite's bounds (in stage coords)?
export function pointerOverSprite(s, sprite) {
  const b = sprite.getBounds();
  return s.x >= b.x && s.x <= b.x + b.width && s.y >= b.y && s.y <= b.y + b.height;
}
