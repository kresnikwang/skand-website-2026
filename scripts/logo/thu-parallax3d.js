// Thursday — 3D Parallax.
// SKAND uses BevelFilter for an embossed metal/relief look. A specular
// highlight follows the cursor (高光跟随) and the logo tilts with the
// pointer for a pseudo-3D (伪3D) feel.
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
  prepareHeroForPixi, makeApp, bindPixi, createTextCanvas,
  makeTexture, fitAndCenter, trackPointer, onResize,
} from './shared.js';

// Radial highlight used as a moving specular glint.
function highlightTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return c;
}

export async function init() {
  window.__debugSteps = ['init-start'];
  prepareHeroForPixi();
  window.__debugSteps.push('prepared');
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  window.__debugSteps.push('app-created');
  window.__pixiAppType = typeof app;
  window.__pixiApp = app;
  bindPixi(Texture, CanvasSource, Rectangle);
  window.__debugSteps.push('bound');
  const ptr = trackPointer(hero);
  window.__debugSteps.push('pointer');

  const logo = createTextCanvas({ text: 'SKAND', size: 210, weight: 500, letterSpacing: 8 });
  const logoTex = makeTexture(logo.canvas);
  const logoSpr = new Sprite(logoTex);
  fitAndCenter(logoSpr, app, 0.68);

  const box = new Container();
  box.x = app.screen.width / 2;
  box.y = app.screen.height / 2;
  box.addChild(logoSpr);
  app.stage.addChild(box);
  
  // 调整 logo 精灵的位置，使其相对于容器中心
  logoSpr.x -= app.screen.width / 2;
  logoSpr.y -= app.screen.height / 2;

  // Embossed metal relief
  const bevel = new BevelFilter({
    thickness: 4,
    lightColor: 0xffffff,
    lightAlpha: 0.9,
    shadowColor: 0x000000,
    shadowAlpha: 0.8,
    rotation: 45,
    kernelSize: 5,
  });
  box.filters = [bevel];

  // Specular highlight (screen blend) following the cursor
  const hlTex = makeTexture(highlightTexture());
  const hl = new Sprite(hlTex);
  hl.anchor.set(0.5);
  hl.blendMode = 'screen';
  hl.alpha = 0;
  app.stage.addChild(hl);

  onResize(app, () => {
    fitAndCenter(logoSpr, app, 0.68);
  });

  // Debug exposure
  window.__pixiApp = app;
  window.__pixiStage = app.stage;
  window.__pixiLogo = logoSpr;

  let tlx = 0, tly = 0; // eased tilt

  app.ticker.add(() => {
    const cx = app.screen.width / 2;
    const cy = app.screen.height / 2;
    const ox = (ptr.x - cx) / cx; // -1..1
    const oy = (ptr.y - cy) / cy;

    // tilt toward pointer (parallax)
    tlx += (oy * 0.07 - tlx) * 0.08;
    tly += (ox * 0.07 - tly) * 0.08;
    box.rotation = tlx;
    box.skew.x = -tly * 0.5;
    box.skew.y = tlx * 0.5;
    const sc = 1 + oy * 0.012 - ox * 0.012;
    box.scale.set(sc, 1 - oy * 0.012);

    // highlight follows pointer, fades with proximity to logo
    const b = logoSpr.getBounds();
    const near = ptr.inside && ptr.x >= b.x && ptr.x <= b.x + b.width && ptr.y >= b.y && ptr.y <= b.y + b.height;
    hl.x += (ptr.x - hl.x) * 0.18;
    hl.y += (ptr.y - hl.y) * 0.18;
    const targetA = near ? 0.85 : 0.0;
    hl.alpha += (targetA - hl.alpha) * 0.1;
    const hs = 1.4 + (near ? 0.6 : 0);
    hl.scale.x += (hs * (1 + ox * 0.2) - hl.scale.x) * 0.1;
    hl.scale.y += (hs * (1 - oy * 0.2) - hl.scale.y) * 0.1;
  });
}
