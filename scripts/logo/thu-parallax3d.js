// Thursday — 3D Parallax metal logo.
// SKAND is rendered with a chrome/steel gradient (so it reads as metal, not
// flat text), given an embossed BevelFilter relief, and a specular glint that
// follows the cursor (高光跟随). The whole logo plate tilts / shifts with the
// pointer for a pseudo-3D (伪3D) parallax feel. WebGL-safe (no custom shaders).
import {
  Application,
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
  Graphics,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import { BevelFilter } from 'https://cdn.jsdelivr.net/npm/pixi-filters@6/dist/pixi-filters.mjs';
import {
  prepareHeroForPixi, makeApp, trackPointer, onResize,
} from './shared.js';

// Chrome / brushed-steel gradient wordmark -> reads as metal under BevelFilter.
function metallicTextCanvas({ text = 'SKAND', size = 210, weight = 600, letterSpacing = 8, supersample = 2 } = {}) {
  const fpx = size * supersample;
  const font = `${weight} ${fpx}px 'Cormorant Garamond', Georgia, serif`;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = font;
  try { meas.letterSpacing = letterSpacing * supersample + 'px'; } catch (e) {}
  const m = meas.measureText(text);
  const padX = 40 * supersample;
  const padY = 34 * supersample;
  const w = Math.ceil(m.width) + padX * 2;
  const h = Math.ceil(fpx * 1.42) + padY * 2;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.font = font;
  try { x.letterSpacing = letterSpacing * supersample + 'px'; } catch (e) {}
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  const grad = x.createLinearGradient(0, padY, 0, h - padY);
  const stops = [
    [0.0, '#6a2a1d'],
    [0.12, '#ffeae5'],
    [0.28, '#e0725b'],
    [0.46, '#ffffff'],
    [0.52, '#fff6f4'],
    [0.68, '#d45f46'],
    [0.84, '#ffcfc4'],
    [1.0, '#5c2419'],
  ];
  stops.forEach(([o, col]) => grad.addColorStop(o, col));

  // crisp dark rim under the fill for definition
  x.lineJoin = 'round';
  x.lineWidth = 2 * supersample;
  x.strokeStyle = 'rgba(18,20,26,0.65)';
  x.strokeText(text, w / 2, h / 2);
  x.fillStyle = grad;
  x.fillText(text, w / 2, h / 2);

  return { canvas: c, width: w, height: h, cssWidth: w / supersample, cssHeight: h / supersample };
}

// Soft radial specular glint (white core -> transparent).
function glintTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return c;
}

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  const ptr = trackPointer(hero);

  const logo = metallicTextCanvas({ text: 'SKAND', size: 210, weight: 600, letterSpacing: 8 });
  const logoTex = new Texture({ source: new CanvasSource({ resource: logo.canvas }) });

  // Group holds the logo + its masked glint; parallax transforms apply to it.
  const group = new Container();
  app.stage.addChild(group);

  // The metallic wordmark
  const logoSpr = new Sprite(logoTex);
  logoSpr.anchor.set(0.5);
  group.addChild(logoSpr);

  // Embossed metal relief
  const bevel = new BevelFilter({
    thickness: 6,
    lightColor: 0xffffff,
    lightAlpha: 1.0,
    shadowColor: 0x000000,
    shadowAlpha: 0.9,
    rotation: 135,
    kernelSize: 5,
  });
  logoSpr.filters = [bevel];

  // Specular glint, clipped to the letters so it looks like a reflection.
  const glintTex = new Texture({ source: new CanvasSource({ resource: glintTexture() }) });
  const glint = new Sprite(glintTex);
  glint.anchor.set(0.5);
  glint.blendMode = 'add';
  const maskSpr = new Sprite(logoTex);
  maskSpr.anchor.set(0.5);
  group.addChild(maskSpr);
  glint.mask = maskSpr;
  group.addChild(glint);

  let baseScale = 1;
  const layout = () => {
    const maxW = app.screen.width * 0.72;
    baseScale = maxW / logo.width;
    logoSpr.scale.set(baseScale);
    maskSpr.scale.set(baseScale);
    const gh = logo.height * baseScale;
    const gs = gh * 0.7 / 256;
    glint.scale.set(gs);
    group.x = app.screen.width / 2;
    group.y = app.screen.height / 2;
  };
  onResize(app, layout);

  let tlx = 0, tly = 0; // eased tilt (skew)
  let gx = 0, gy = 0; // eased glint position (group-local)
  const MAX_TILT = 0.24; // ~14°

  app.ticker.add(() => {
    const cx = app.screen.width / 2;
    const cy = app.screen.height / 2;
    const ox = (ptr.x - cx) / cx; // -1..1
    const oy = (ptr.y - cy) / cy;
    const t = performance.now() * 0.001;

    // ---- Pseudo-3D parallax: shear + foreshorten + positional shift ----
    tlx += ((-oy) * MAX_TILT - tlx) * 0.07;
    tly += (ox * MAX_TILT - tly) * 0.07;
    group.skew.x = tly * 0.55;
    group.skew.y = tlx * 0.55;
    group.scale.x = 1 + Math.abs(tlx) * 0.04;
    group.scale.y = 1 - Math.abs(tlx) * 0.16; // foreshorten top/bottom
    // logo leans away from cursor -> depth illusion
    group.x = cx - ox * 18;
    group.y = cy - oy * 12;

    // ---- Specular glint: cursor-follow + constant shimmer drift ----
    const driftX = Math.sin(t * 0.7) * (app.screen.width * 0.22);
    const driftY = Math.cos(t * 0.5) * (app.screen.height * 0.14);
    const localX = ptr.inside ? ptr.x - cx : driftX;
    const localY = ptr.inside ? ptr.y - cy : driftY;
    gx += (localX - gx) * 0.08;
    gy += (localY - gy) * 0.08;
    glint.x = gx;
    glint.y = gy;
    // always a faint living sheen, brighter when pointer drives it
    const shimmer = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.1));
    glint.alpha += ((ptr.inside ? 0.95 : shimmer) - glint.alpha) * 0.1;
  });

}
