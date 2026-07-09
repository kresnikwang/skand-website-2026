// Friday — Neon.
// SKAND is shown as a dim outline (描边线稿). A glowing coral fill with
// GlowFilter is revealed by a radial mask that follows the cursor (鼠标扫过
// 点亮), with a subtle displacement turbulence for an electric-current feel.
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
  prepareHeroForPixi, makeApp, bindPixi, brandTextCanvas,
  makeTexture, fitAndCenter, trackPointer, onResize,
} from './shared.js';

function noiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 50; i++) {
    const r = 16 + Math.random() * 70;
    const gx = Math.random() * 256;
    const gy = Math.random() * 256;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    const v = Math.floor(Math.random() * 255);
    g.addColorStop(0, `rgba(${v},${v},${v},0.6)`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(gx, gy, r, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  // Dim outline base (line art)
  const outline = createTextCanvas({ text: 'SKAND', size: 210, weight: 600, mode: 'stroke', strokeWidth: 3, letterSpacing: 8 });
  const outlineTex = makeTexture(outline.canvas);
  const baseSpr = new Sprite(outlineTex);
  fitAndCenter(baseSpr, app, 0.7);
  baseSpr.alpha = 0.45;
  app.stage.addChild(baseSpr);

  // Glowing coral fill (revealed by mask)
  const fill = brandTextCanvas({ text: 'SKAND', size: 210, weight: 500, letterSpacing: 8 });
  const fillTex = makeTexture(fill.canvas);
  const glowSpr = new Sprite(fillTex);
  fitAndCenter(glowSpr, app, 0.7);
  glowSpr.tint = 0xe8563a;
  app.stage.addChild(glowSpr);

  const glow = new GlowFilter({
    distance: 18,
    outerStrength: 3,
    innerStrength: 0,
    color: 0xe8563a,
    quality: 0.3,
  });
  glowSpr.filters = [glow];

  // Electric-current turbulence
  const dispTex = makeTexture(noiseTexture());
  const disp = new Sprite(dispTex);
  disp.width = app.screen.width;
  disp.height = app.screen.height;
  app.stage.addChild(disp);
  const turb = new DisplacementFilter({ sprite: disp, scale: 5 });
  glowSpr.filters = [glow, turb];

  // Radial mask following the cursor
  const mask = new Graphics();
  mask.circle(0, 0, 120).fill(0xffffff);
  app.stage.addChild(mask);
  glowSpr.mask = mask;

  onResize(app, () => {
    fitAndCenter(baseSpr, app, 0.7);
    fitAndCenter(glowSpr, app, 0.7);
    disp.width = app.screen.width;
    disp.height = app.screen.height;
  });

  let lit = 0;
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    const b = glowSpr.getBounds();
    const over = ptr.inside && ptr.x >= b.x && ptr.x <= b.x + b.width && ptr.y >= b.y && ptr.y <= b.y + b.height;
    lit += ((over ? 1 : 0) - lit) * 0.12 * dt;

    mask.x += (ptr.x - mask.x) * 0.25;
    mask.y += (ptr.y - mask.y) * 0.25;
    const rad = 90 + lit * 70;
    mask.clear();
    mask.circle(0, 0, rad).fill(0xffffff);

    glow.outerStrength = 2 + lit * 3;
    // DisplacementFilter.scale is a Point in Pixi v8 (getter-only).
    turb.scale.x = 3 + lit * 10;
    turb.scale.y = 3 + lit * 10;
    disp.x += 2 * dt;
    disp.y += 1 * dt;
  });
}
