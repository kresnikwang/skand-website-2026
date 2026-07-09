// Wednesday — Ink Bloom.
// SKAND glows via AdvancedBloomFilter. On hover, ink-drop ripples
// expand from the cursor (墨滴入水) and a smoke-like displacement
// disperses the edges (烟雾扩散).
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
  isMobile, prepareHeroForPixi, makeApp, bindPixi, createTextCanvas,
  makeTexture, fitAndCenter, trackPointer, pointerOverSprite, onResize,
} from './shared.js';

// Soft cloudy noise used as a displacement map for the smoke effect.
function noiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    const r = 20 + Math.random() * 80;
    const gx = Math.random() * 256;
    const gy = Math.random() * 256;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    const v = Math.floor(Math.random() * 255);
    g.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(gx, gy, r, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

// Radial soft circle used for ink ripples.
function rippleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return c;
}

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  // Logo
  const logo = createTextCanvas({ text: 'SKAND', size: 210, weight: 500, letterSpacing: 8 });
  const logoTex = makeTexture(logo.canvas);
  const logoSpr = new Sprite(logoTex);
  fitAndCenter(logoSpr, app, 0.7);
  const logoBox = new Container();
  logoBox.x = app.screen.width / 2;
  logoBox.y = app.screen.height / 2;
  logoBox.addChild(logoSpr);
  app.stage.addChild(logoBox);
  
  // 调整 logo 精灵的位置，使其相对于容器中心
  logoSpr.x -= app.screen.width / 2;
  logoSpr.y -= app.screen.height / 2;

  // Glow
  const bloom = new AdvancedBloomFilter({
    threshold: 0.25,
    bloomScale: 1.3,
    brightness: 1.0,
    blur: 6,
    quality: 4,
  });

  // Smoke displacement
  const dispTex = makeTexture(noiseTexture());
  const disp = new TilingSprite({ texture: dispTex, width: app.screen.width, height: app.screen.height });
  app.stage.addChild(disp);
  const dispFilter = new DisplacementFilter({ sprite: disp, scale: 8 });
  logoBox.filters = [bloom, dispFilter];

  onResize(app, () => {
    disp.width = app.screen.width;
    disp.height = app.screen.height;
    fitAndCenter(logoSpr, app, 0.7);
  });

  // Ripples
  const rippleTex = makeTexture(rippleTexture());
  const rippleBox = new Container();
  app.stage.addChild(rippleBox);
  const ripples = [];
  let lastSpawn = 0;

  let intensity = 0; // eased hover intensity

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    const hovering = pointerOverSprite(ptr, logoSpr) && ptr.inside;
    intensity += ((hovering ? 1 : 0) - intensity) * 0.06 * dt;

    // smoke strength follows hover
    if (dispFilter) dispFilter.scale = 6 + intensity * 26;
    disp.tilePosition.x += 0.4 * dt;
    disp.tilePosition.y += 0.25 * dt;
    bloom.bloomScale = 1.3 + intensity * 0.8;

    // spawn ink ripples while hovering
    const now = performance.now();
    if (hovering && now - lastSpawn > 170) {
      lastSpawn = now;
      const tints = [0xe8563a, 0x4052b5, 0xf0ede8];
      const sp = new Sprite(rippleTex);
      sp.anchor.set(0.5);
      sp.x = ptr.x;
      sp.y = ptr.y;
      sp.tint = tints[(Math.random() * tints.length) | 0];
      sp.alpha = 0.55;
      sp.scale.set(0.2);
      rippleBox.addChild(sp);
      ripples.push(sp);
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const sp = ripples[i];
      sp.scale.x += 0.9 * dt;
      sp.scale.y += 0.9 * dt;
      sp.alpha -= 0.012 * dt;
      if (sp.alpha <= 0) {
        rippleBox.removeChild(sp);
        sp.destroy();
        ripples.splice(i, 1);
      }
    }
  });
}
