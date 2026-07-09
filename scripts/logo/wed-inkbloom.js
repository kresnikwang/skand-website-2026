// Wednesday — 墨滴入水 (Ink Drop in Water).
// SKAND logo with subtle ink-wash (水墨) aesthetic. Gentle bloom, soft
// displacement drift, and delicate ink-drop ripples on hover. The overall
// feel is calm, meditative, and understated — like calligraphy ink
// dissolving slowly in still water.

import {
  Application,
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
  TilingSprite,
  DisplacementFilter,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import { AdvancedBloomFilter } from 'https://cdn.jsdelivr.net/npm/pixi-filters@6/dist/pixi-filters.mjs';
import {
  isMobile, prepareHeroForPixi, makeApp, bindPixi, brandTextCanvas,
  makeTexture, fitAndCenter, trackPointer, pointerOverSprite, onResize,
} from './shared.js';

/* --------------------------------------------------------------------------
 * Procedural noise texture — very soft, low-contrast cloudy blobs.
 * Kept gentle so displacement doesn't warp the text too aggressively.
 * ----------------------------------------------------------------------- */
function createNoiseCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // neutral grey baseline
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // soft, low-contrast blobs
  for (let i = 0; i < 35; i++) {
    const r = 40 + Math.random() * 100;
    const gx = Math.random() * size;
    const gy = Math.random() * size;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    // narrow grey range: 100–156 (close to neutral 128) for subtle displacement
    const v = Math.floor(100 + Math.random() * 56);
    g.addColorStop(0, `rgba(${v},${v},${v},0.3)`);
    g.addColorStop(0.6, `rgba(${v},${v},${v},0.1)`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

/* --------------------------------------------------------------------------
 * Soft radial ripple texture — translucent disc with gentle falloff.
 * ----------------------------------------------------------------------- */
function createRippleCanvas(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const half = size / 2;

  // Soft ring + inner glow
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, 'rgba(255,255,255,0.4)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.25)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  return c;
}

/* --------------------------------------------------------------------------
 * Main init.
 * ----------------------------------------------------------------------- */
export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  /* ---- Logo ---- */
  const logo = brandTextCanvas({ text: 'SKAND', size: 210, weight: 500, letterSpacing: 8 });
  const logoTex = makeTexture(logo.canvas);
  const logoSpr = new Sprite(logoTex);
  fitAndCenter(logoSpr, app, 0.7);
  app.stage.addChild(logoSpr);

  /* ---- AdvancedBloom — very gentle, subtle glow ---- */
  const bloom = new AdvancedBloomFilter({
    threshold: 0.45,       // higher threshold = less blooms
    bloomScale: 0.6,       // low bloom scale for subtlety
    brightness: 1.0,       // no brightness boost
    blur: 4,               // soft blur
    quality: isMobile ? 2 : 3,
  });

  /* ---- Displacement — gentle ink-wash drift ---- */
  const dispCanvas = createNoiseCanvas(256);
  const dispTex = makeTexture(dispCanvas);
  const dispSprite = new TilingSprite({
    texture: dispTex,
    width: app.screen.width,
    height: app.screen.height,
  });
  app.stage.addChild(dispSprite);
  const dispFilter = new DisplacementFilter({ sprite: dispSprite, scale: 2 });

  logoSpr.filters = [bloom, dispFilter];

  /* ---- Ripple layer ---- */
  const rippleTex = makeTexture(createRippleCanvas(128));
  const rippleContainer = new Container();
  app.stage.addChild(rippleContainer);
  const ripples = [];

  /* ---- Resize ---- */
  onResize(app, () => {
    dispSprite.width = app.screen.width;
    dispSprite.height = app.screen.height;
    fitAndCenter(logoSpr, app, 0.7);
  });

  /* ---- State ---- */
  let intensity = 0;
  let lastSpawn = 0;
  let elapsed = 0;

  // Muted brand palette for ripples
  const TINTS = [0xe8563a, 0x4052b5, 0xf0ede8];

  // Slower spawn, fewer ripples — subtle
  const SPAWN_INTERVAL = isMobile ? 350 : 240;
  const RIPPLES_PER_SPAWN = isMobile ? 1 : 2;
  const MAX_RIPPLES = isMobile ? 12 : 25;

  /* ---- Tick ---- */
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    elapsed += dt;

    const hovering = pointerOverSprite(ptr, logoSpr) && ptr.inside;
    const target = hovering ? 1 : 0;

    // Gentle ease: slow rise, slow fall
    const easeRate = hovering ? 0.04 : 0.025;
    intensity += (target - intensity) * easeRate * dt;

    /* ---- Displacement: gentle ambient drift ---- */
    // Subtle at rest (~2), modest increase on hover (~10 max)
    const dispScale = 2 + intensity * 8;
    dispFilter.scale.x = dispScale;
    dispFilter.scale.y = dispScale;

    // Very slow drift for living feel
    dispSprite.tilePosition.x += (0.15 + intensity * 0.2) * dt;
    dispSprite.tilePosition.y += (0.1 + intensity * 0.15) * dt;

    /* ---- Bloom: barely perceptible ambient pulse ---- */
    const pulse = Math.sin(elapsed * 0.02) * 0.08;
    bloom.bloomScale = 0.6 + pulse + intensity * 0.35;
    bloom.brightness = 1.0 + intensity * 0.05;

    /* ---- Spawn ink ripples on hover ---- */
    const now = performance.now();
    if (hovering && now - lastSpawn > SPAWN_INTERVAL && ripples.length < MAX_RIPPLES) {
      lastSpawn = now;
      for (let n = 0; n < RIPPLES_PER_SPAWN; n++) {
        const jitterX = (Math.random() - 0.5) * 40;
        const jitterY = (Math.random() - 0.5) * 30;
        const tint = TINTS[(Math.random() * TINTS.length) | 0];

        const sp = new Sprite(rippleTex);
        sp.anchor.set(0.5);
        sp.x = ptr.x + jitterX;
        sp.y = ptr.y + jitterY;
        sp.tint = tint;
        sp.alpha = 0.3;           // start very translucent
        sp.scale.set(0.06 + Math.random() * 0.08);
        rippleContainer.addChild(sp);

        ripples.push({
          sprite: sp,
          age: 0,
          speed: 0.3 + Math.random() * 0.25,
          maxAge: 100 + Math.random() * 60,
          initAlpha: 0.25 + Math.random() * 0.1,
        });
      }
    }

    /* ---- Update ripples — slow organic expansion ---- */
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.age += dt;
      const t = Math.min(rp.age / rp.maxAge, 1);

      // Slow, decelerating expansion
      const growRate = rp.speed * (1 - t * 0.9) * 0.35;
      rp.sprite.scale.x += growRate * dt;
      rp.sprite.scale.y += growRate * dt;

      // Gentle fade
      const alphaT = t < 0.25 ? 1 : 1 - ((t - 0.25) / 0.75);
      rp.sprite.alpha = rp.initAlpha * alphaT * alphaT;

      if (t >= 1) {
        rippleContainer.removeChild(rp.sprite);
        rp.sprite.destroy();
        ripples.splice(i, 1);
      }
    }
  });
}
