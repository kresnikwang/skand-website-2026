// Tuesday — 像素熔化 (Pixel Melt).
// SKAND is sliced into a grid of tiles. Hovering near the logo causes
// nearby pixels to melt downward like dripping liquid with radial falloff;
// moving the cursor away triggers a satisfying snap-back reconstruction
// with overshoot bounce and subtle shimmer.
import {
  Application,
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import {
  isMobile, prepareHeroForPixi, makeApp, bindPixi, brandTextCanvas,
  makeTexture, subTexture, trackPointer, pointerOverSprite, onResize,
} from './shared.js?v=13';

/* ── helpers ──────────────────────────────────────────────────────── */

// Attempt deterministic pseudo-random per tile for consistent wobble.
function seededRand(i) {
  let x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Soft cubic ease-out for snap-back overshoot.
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/* ── main ─────────────────────────────────────────────────────────── */

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  // ── Build the SKAND wordmark texture ──
  const logo = brandTextCanvas({
    text: 'SKAND',
    size: 200,
    weight: 500,
    letterSpacing: 8,
  });
  const baseTex = makeTexture(logo.canvas);

  // ── Slice into tile grid ──
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
      // Center entire grid around container origin.
      spr.x = x + tw / 2 - logo.width / 2;
      spr.y = y + th / 2 - logo.height / 2;

      const idx = r * cols + c;
      // Per-tile properties for organic variation.
      spr._baseX = spr.x;
      spr._baseY = spr.y;
      spr._row = r;
      spr._col = c;
      // Randomised per-tile characteristics (deterministic via index).
      spr._phase = seededRand(idx) * Math.PI * 2;
      spr._dripSpeed = 0.6 + seededRand(idx + 500) * 0.8;   // 0.6–1.4×
      spr._wobbleAmp = 0.3 + seededRand(idx + 1000) * 0.7;  // horizontal wobble amplitude
      spr._stretchMax = 1.4 + seededRand(idx + 1500) * 1.0;  // max vertical stretch 1.4–2.4×
      // Gravity bias: bottom rows fall faster (row-normalised 0..1).
      spr._gravity = 0.7 + 0.3 * (r / (rows - 1));
      // Per-tile melt state (smoothed independently for cascade).
      spr._melt = 0;
      // Snap-back animation progress (0 = melted, 1 = home).
      spr._snap = 1;
      spr._snapVel = 0;
      // Track whether this tile is currently reconstructing.
      spr._wasActive = false;

      container.addChild(spr);
      tiles.push(spr);
    }
  }

  // ── Scale container to fit hero ──
  const scaleFit = () => {
    const maxW = app.screen.width * 0.72;
    const s = maxW / logo.width;
    container.scale.set(s);
    container.x = app.screen.width / 2;
    container.y = app.screen.height / 2;
  };
  scaleFit();
  onResize(app, scaleFit);

  // ── Invisible hit sprite for hover detection ──
  const hit = new Sprite(baseTex);
  hit.anchor.set(0.5);
  hit.alpha = 0.0001;
  container.addChildAt(hit, 0);

  // ── Melt parameters ──
  const dropMax = th * 7;           // max fall distance (local units)
  const meltRadius = () => logo.width * container.scale.x * 0.52; // proximity radius in stage px
  const wobbleSpeed = 0.003;        // horizontal wobble frequency
  const fadeMin = 0.15;             // minimum alpha when fully melted

  // Smoothed global hover state.
  let hoverEase = 0;

  /* ── Animation loop ─────────────────────────────────────────────── */
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    const now = performance.now();
    const hovering = pointerOverSprite(ptr, hit) && ptr.inside;

    // Smooth global hover blend (used as overall gate).
    hoverEase += ((hovering ? 1 : 0) - hoverEase) * 0.07 * dt;

    const cx = container.x;
    const cy = container.y;
    const s = container.scale.x;
    const rad = meltRadius();

    for (const spr of tiles) {
      // ── Proximity calculation ──
      // Convert tile base position to stage coords.
      const sx = cx + spr._baseX * s;
      const sy = cy + spr._baseY * s;
      const dx = ptr.x - sx;
      const dy = ptr.y - sy;
      const dist = Math.hypot(dx, dy);

      // Radial falloff: closer = stronger, with smooth cubic curve.
      const rawFalloff = Math.max(0, 1 - dist / rad);
      const falloff = rawFalloff * rawFalloff * (3 - 2 * rawFalloff); // smoothstep

      // Target melt for this tile: global hover × local proximity.
      const targetMelt = hoverEase * falloff;

      // Smoothly approach target melt. Melting is faster than reconstructing
      // to create a snappy melt + slow reconstruct feel.
      const meltRate = targetMelt > spr._melt ? 0.12 : 0.045;
      spr._melt += (targetMelt - spr._melt) * meltRate * dt;

      const m = spr._melt;
      const active = m > 0.005;

      if (active) {
        // ── MELT STATE ──
        // Drip downward: distance scales with per-tile drip speed and gravity.
        const dripFactor = spr._dripSpeed * spr._gravity;
        const wobble = Math.sin(now * wobbleSpeed + spr._phase);
        const drop = m * dropMax * dripFactor;

        // Horizontal wobble increases with melt intensity.
        const hWobble = wobble * spr._wobbleAmp * m * (tw * 0.3);

        spr.x = spr._baseX + hWobble / s;
        spr.y = spr._baseY + drop / s;

        // Vertical stretch for liquid drip appearance.
        const stretch = 1 + m * (spr._stretchMax - 1);
        spr.scale.set(1, stretch);

        // Alpha fades with melt intensity; wobble adds organic variation.
        const alphaWobble = 0.5 + 0.5 * Math.sin(now * 0.005 + spr._phase * 2);
        spr.alpha = 1 - m * (1 - fadeMin) * (0.7 + 0.3 * alphaWobble);

        // Reset snap state while melting.
        spr._snap = 0;
        spr._snapVel = 0;
        spr._wasActive = true;
      } else if (spr._wasActive && spr._snap < 0.999) {
        // ── RECONSTRUCT STATE (snap-back with overshoot) ──
        // Spring-like snap: accelerate toward 1.0 with overshoot.
        spr._snapVel += (1 - spr._snap) * 0.08 * dt;
        spr._snapVel *= 0.82; // damping
        spr._snap += spr._snapVel * dt;

        if (spr._snap > 0.999) {
          spr._snap = 1;
          spr._wasActive = false;
        }

        const t = Math.min(spr._snap, 1);
        const e = easeOutBack(t);

        // Interpolate from last melted position back to base.
        // The easeOutBack overshoots slightly past 1.0 for the bounce.
        spr.x = spr._baseX + (spr.x - spr._baseX) * (1 - e);
        spr.y = spr._baseY + (spr.y - spr._baseY) * (1 - e);

        // Scale snaps back with slight overshoot.
        spr.scale.set(1, 1 + (spr.scale.y - 1) * (1 - e));

        // Alpha recovers.
        spr.alpha = Math.min(1, 0.3 + t * 0.7);

        // Shimmer/glow effect: brief brightness pulse during reconstruction.
        // Achieved by briefly pushing alpha above 1 is not possible, so we
        // use a subtle tint flash by adjusting alpha rhythm.
        const shimmer = Math.sin(t * Math.PI) * 0.25; // peaks at t=0.5
        spr.alpha = Math.min(1, spr.alpha + shimmer);
      } else {
        // ── IDLE STATE ── (ensure clean rest position)
        if (spr._wasActive) {
          spr._wasActive = false;
        }
        spr.x = spr._baseX;
        spr.y = spr._baseY;
        spr.scale.set(1, 1);
        spr.alpha = 1;
      }
    }
  });
}
