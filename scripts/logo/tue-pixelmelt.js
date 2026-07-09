// Tuesday — Pixel Melt.
// SKAND is sliced into a grid of tiles. Hovering over the logo makes the
// pixels "melt" downward and drip (liquid-metal feel); moving away reconstructs it.
import {
  Application,
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import {
  isMobile, prepareHeroForPixi, makeApp, bindPixi, createTextCanvas,
  makeTexture, subTexture, trackPointer, pointerOverSprite, onResize,
} from './shared.js';

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  // Build the SKAND wordmark and a sliced grid of tiles.
  const logo = createTextCanvas({ text: 'SKAND', size: 200, weight: 500, letterSpacing: 8 });
  const baseTex = makeTexture(logo.canvas);

  const cols = isMobile ? 34 : 52;
  const rows = isMobile ? 12 : 18;
  const tw = Math.ceil(logo.width / cols);
  const th = Math.ceil(logo.height / rows);

  const container = new Container();
  container.x = app.screen.width / 2;
  container.y = app.screen.height / 2;
  app.stage.addChild(container);

  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.min(c * tw, logo.width - tw);
      const y = Math.min(r * th, logo.height - th);
      const tex = subTexture(baseTex, x, y, tw, th);
      const spr = new Sprite(tex);
      spr.anchor.set(0.5);
      spr.x = x + tw / 2;
      spr.y = y + th / 2;
      // per-column drip phase for organic melt
      spr._col = c;
      spr._baseY = spr.y;
      spr._phase = Math.random() * Math.PI * 2;
      container.addChild(spr);
      tiles.push(spr);
    }
  }

  const scaleFit = () => {
    const maxW = app.screen.width * 0.72;
    const s = maxW / logo.width;
    container.scale.set(s);
  };
  onResize(app, scaleFit);

  // Invisible full-logo hit sprite for hover detection.
  const hit = new Sprite(baseTex);
  hit.anchor.set(0.5);
  hit.alpha = 0.0001;
  container.addChildAt(hit, 0);

  let melt = 0; // eased 0..1
  const dropMax = th * 6;     // how far pixels fall at full melt
  const stretch = 1.8;       // vertical drip elongation
  const radius = () => logo.width * container.scale.x * 0.55;

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    const hovering = pointerOverSprite(ptr, hit);
    melt += ((hovering ? 1 : 0) - melt) * 0.08 * dt;

    const cx = container.x;
    const cy = container.y;
    const s = container.scale.x;
    const rad = radius();

    const now = performance.now();
    for (const spr of tiles) {
      // local tile position -> stage position
      const sx = cx + spr.x * s;
      const sy = cy + spr._baseY * s;
      const dx = ptr.x - sx;
      const dy = ptr.y - sy;
      const dist = Math.hypot(dx, dy);
      const falloff = Math.max(0, 1 - dist / rad);

      const m = melt * falloff;
      if (m > 0.001) {
        const wobble = Math.sin(now * 0.004 + spr._phase) * 0.5 + 0.5;
        const drop = m * dropMax * (0.6 + 0.4 * wobble);
        spr.y = spr._baseY + drop / s; // convert local
        spr.scale.y = 1 + m * stretch;
        spr.alpha = 1 - m * 0.15 * wobble;
      } else {
        spr.y += (spr._baseY - spr.y) * 0.2 * dt;
        spr.scale.y += (1 - spr.scale.y) * 0.2 * dt;
        spr.alpha += (1 - spr.alpha) * 0.2 * dt;
      }
    }
  });
}
