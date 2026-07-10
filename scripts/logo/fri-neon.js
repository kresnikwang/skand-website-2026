// Friday — Neon 霓虹
// SKAND is shown as a dim flickering outline (描边线稿). A glowing coral-filled
// version sits beneath, masked by a radial spotlight that follows the cursor
// (鼠标径向遮罩扫过点亮). Subtle electric-current displacement adds a buzzing
// neon-sign feel (电流噪波). The mask expands when over the text and shrinks
// when the cursor leaves.
import {
  Application,
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
  Graphics,
  DisplacementFilter,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import { GlowFilter } from 'https://cdn.jsdelivr.net/npm/pixi-filters@6/dist/pixi-filters.mjs';
import {
  prepareHeroForPixi, makeApp, createTextCanvas, brandTextCanvas,
  fitAndCenter, trackPointer, onResize, isMobile,
} from './shared.js';

/* ---------- procedural noise for electric-current displacement ---------- */
function makeNoiseCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // neutral grey base (zero displacement)
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  // overlay soft radial blobs of varying brightness for organic displacement
  for (let i = 0; i < 60; i++) {
    const r = 12 + Math.random() * 60;
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const v = Math.floor(Math.random() * 255);
    g.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  const ptr = trackPointer(hero);

  /* ------------------------------------------------------------------ */
  /*  Layer 1 — dim stroke outline (line art base)                      */
  /* ------------------------------------------------------------------ */
  const outlineData = createTextCanvas({
    text: 'SKAND', size: 210, weight: 600, mode: 'stroke',
    strokeWidth: 2.5, strokeColor: '#f0ede8', letterSpacing: 8,
    pad: 30,
  });
  const outlineTex = new Texture({ source: new CanvasSource({ resource: outlineData.canvas }) });
  const baseSpr = new Sprite(outlineTex);
  baseSpr.alpha = 0.4;
  app.stage.addChild(baseSpr);

  // Faint ambient glow on outline — suggests residual charge in the tubes
  const ambientGlow = new GlowFilter({
    distance: 8,
    outerStrength: 1.0,
    innerStrength: 0,
    color: 0xe8563a,
    quality: 0.25,
  });
  baseSpr.filters = [ambientGlow];

  /* ------------------------------------------------------------------ */
  /*  Layer 2 — coral-gradient filled text with GlowFilter              */
  /* ------------------------------------------------------------------ */
  const fillData = brandTextCanvas({
    text: 'SKAND', size: 210, weight: 500, letterSpacing: 8,
  });
  const fillTex = new Texture({ source: new CanvasSource({ resource: fillData.canvas }) });
  const glowSpr = new Sprite(fillTex);
  app.stage.addChild(glowSpr);

  const glow = new GlowFilter({
    distance: 20,
    outerStrength: 3.5,
    innerStrength: 0.5,
    color: 0xe8563a,
    quality: 0.3,
  });

  /* ------------------------------------------------------------------ */
  /*  Electric-current displacement                                      */
  /* ------------------------------------------------------------------ */
  const noiseCanvas = makeNoiseCanvas(256);
  const dispTex = new Texture({ source: new CanvasSource({ resource: noiseCanvas }) });
  const dispSprite = new Sprite(dispTex);
  dispSprite.width = app.screen.width;
  dispSprite.height = app.screen.height;
  app.stage.addChild(dispSprite);
  const turbulence = new DisplacementFilter({ sprite: dispSprite, scale: 4 });

  glowSpr.filters = [glow, turbulence];

  /* ------------------------------------------------------------------ */
  /*  Radial mask — follows cursor with easing                          */
  /* ------------------------------------------------------------------ */
  const mask = new Graphics();
  const BASE_RADIUS = isMobile ? 100 : 90;
  const EXPANDED_RADIUS = isMobile ? 160 : 160;
  mask.circle(0, 0, BASE_RADIUS).fill(0xffffff);
  app.stage.addChild(mask);
  glowSpr.mask = mask;

  // Eased mask position
  let maskX = app.screen.width / 2;
  let maskY = app.screen.height / 2;
  let currentRadius = BASE_RADIUS;

  /* ------------------------------------------------------------------ */
  /*  Resize handler                                                     */
  /* ------------------------------------------------------------------ */
  onResize(app, () => {
    fitAndCenter(baseSpr, app, 0.7);
    fitAndCenter(glowSpr, app, 0.7);
    dispSprite.width = app.screen.width;
    dispSprite.height = app.screen.height;
  });

  /* ------------------------------------------------------------------ */
  /*  Animation loop                                                     */
  /* ------------------------------------------------------------------ */
  let lit = 0;       // eased 0→1: how much the cursor is "over" the text
  let elapsed = 0;   // total elapsed time for oscillations

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    elapsed += dt / 60; // accumulate seconds

    /* --- determine if pointer is over the text bounds --- */
    const b = glowSpr.getBounds();
    const overText = ptr.inside &&
      ptr.x >= b.x && ptr.x <= b.x + b.width &&
      ptr.y >= b.y && ptr.y <= b.y + b.height;

    // smooth ease toward target
    const target = overText ? 1 : 0;
    lit += (target - lit) * 0.08 * dt;

    /* --- mask position: ease toward pointer --- */
    if (ptr.inside) {
      maskX += (ptr.x - maskX) * 0.15 * dt;
      maskY += (ptr.y - maskY) * 0.15 * dt;
    }
    mask.x = maskX;
    mask.y = maskY;

    /* --- mask radius: expand when over text, shrink when leaving --- */
    const targetRadius = BASE_RADIUS + lit * (EXPANDED_RADIUS - BASE_RADIUS);
    currentRadius += (targetRadius - currentRadius) * 0.1 * dt;
    mask.clear();
    mask.circle(0, 0, currentRadius).fill(0xffffff);

    /* --- outline flicker: warm old gas lamp (very subtle alpha drift) --- */
    const flicker1 = Math.sin(elapsed * 3.2) * 0.025;
    const flicker2 = Math.sin(elapsed * 7.1) * 0.01;
    baseSpr.alpha = 0.4 + flicker1 + flicker2;

    // Ambient glow pulses very gently — warm residual charge
    ambientGlow.outerStrength = 0.7 + Math.sin(elapsed * 1.8) * 0.2;

    /* --- GlowFilter pulse: gentle warm breathing like old gas lamp --- */
    const glowPulse = Math.sin(elapsed * 1.5) * 0.3;
    glow.outerStrength = 3.0 + lit * 1.5 + glowPulse;
    glow.distance = 18 + lit * 3 + Math.sin(elapsed * 2.0) * 0.8;

    /* --- displacement: gentle slow drift — old gas lamp warmth --- */
    dispSprite.x += 0.6 * dt;
    dispSprite.y += 0.3 * dt;

    // Very gentle displacement — just enough to suggest warmth/heat shimmer
    const baseDisp = 2;
    const litDisp = lit * 4;
    const shimmerX = Math.sin(elapsed * 3.5) * 0.8;
    const shimmerY = Math.cos(elapsed * 2.8) * 0.6;
    turbulence.scale.x = baseDisp + litDisp + shimmerX;
    turbulence.scale.y = baseDisp + litDisp + shimmerY;
  });
}
