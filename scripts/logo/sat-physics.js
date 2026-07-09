// Saturday — 体积光 / God Rays · 从顶部向下打在 Logo 上
// Volumetric light beams cascade from above, illuminating the SKAND wordmark.
// Mouse movement shifts the light source horizontally; dust motes drift
// downward within the light cone. Built with PixiJS v8 — beams are
// radial-gradient trapezoid sprites with additive blending.
import {
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
  Graphics,
  BlurFilter,
  ColorMatrixFilter,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import {
  isMobile, prepareHeroForPixi, makeApp, bindPixi, createTextCanvas,
  brandTextCanvas, makeTexture, trackPointer, onResize,
} from './shared.js';

/* ── helper: seeded pseudo-random ──────────────────────────────────── */
function seededRand(i) {
  let x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ── helper: single ray beam texture (downward cone) ──────────────── */
function raySliceTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // Linear gradient — bright at origin (top), fading down
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,250,235,0.92)');
  g.addColorStop(0.05, 'rgba(255,235,210,0.6)');
  g.addColorStop(0.15, 'rgba(255,200,160,0.3)');
  g.addColorStop(0.35, 'rgba(240,150,100,0.12)');
  g.addColorStop(0.6, 'rgba(232,100,58,0.04)');
  g.addColorStop(1, 'rgba(232,86,58,0)');
  ctx.fillStyle = g;

  // Trapezoid — narrow at top (source), spreading wider at bottom
  ctx.beginPath();
  ctx.moveTo(w * 0.42, 0);
  ctx.lineTo(w * 0.58, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  return c;
}

/* ── helper: wide ambient beam (central fill) ─────────────────────── */
function wideBeamTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const cx = w / 2;
  // Radial from top-center
  const g = ctx.createRadialGradient(cx, 0, 0, cx, h * 0.5, w * 0.6);
  g.addColorStop(0, 'rgba(255,245,225,0.7)');
  g.addColorStop(0.1, 'rgba(255,220,185,0.35)');
  g.addColorStop(0.3, 'rgba(240,160,110,0.12)');
  g.addColorStop(0.55, 'rgba(232,86,58,0.04)');
  g.addColorStop(1, 'rgba(200,60,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/* ── helper: soft dust particle texture ───────────────────────────── */
function dustTexture(size = 10) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,240,225,0.9)');
  g.addColorStop(0.5, 'rgba(255,210,180,0.4)');
  g.addColorStop(1, 'rgba(255,180,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/* ── helper: top-glow haze texture ────────────────────────────────── */
function hazeTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  // Elliptical glow from top-center
  const g = ctx.createRadialGradient(w / 2, 0, 0, w / 2, h * 0.3, w * 0.5);
  g.addColorStop(0, 'rgba(255,235,210,0.45)');
  g.addColorStop(0.2, 'rgba(255,200,160,0.2)');
  g.addColorStop(0.5, 'rgba(232,120,80,0.06)');
  g.addColorStop(1, 'rgba(200,60,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/* ── helper: logo top-edge highlight texture ──────────────────────── */
function edgeHighlightTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,250,240,0.6)');
  g.addColorStop(0.15, 'rgba(255,230,210,0.25)');
  g.addColorStop(0.4, 'rgba(255,200,170,0.05)');
  g.addColorStop(1, 'rgba(255,200,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/* ── main ─────────────────────────────────────────────────────────── */

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');

  const app = await makeApp(hero);
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  const LOGO_SIZE = 210;
  const LOGO_SPACING = 8;

  /* ── Logo textures ──────────────────────────────────────────────── */
  const filled = brandTextCanvas({
    text: 'SKAND', size: LOGO_SIZE, weight: 600, letterSpacing: LOGO_SPACING,
  });
  const outline = createTextCanvas({
    text: 'SKAND', size: LOGO_SIZE, weight: 600, mode: 'stroke',
    strokeWidth: 1.8, strokeColor: '#f0ede8', letterSpacing: LOGO_SPACING,
  });

  const filledTex = makeTexture(filled.canvas);
  const outlineTex = makeTexture(outline.canvas);

  /* ── Root container (centered on logo position) ─────────────────── */
  const root = new Container();
  app.stage.addChild(root);

  /* Light source sits above the logo in local coords.
     In the root container, (0,0) = logo center.
     Light origin is at (lightX, lightY) above. */
  const LIGHT_Y_OFFSET = -380; // well above logo center (in logo-space units)

  /* ── LAYER 0: Wide ambient beam (behind everything) ─────────────── */
  const ambientLayer = new Container();
  ambientLayer.blendMode = 'add';
  root.addChild(ambientLayer);

  const AMB_W = 900;
  const AMB_H = 1100;
  const ambTex = makeTexture(wideBeamTexture(AMB_W, AMB_H));
  const ambSpr = new Sprite(ambTex);
  ambSpr.anchor.set(0.5, 0);
  ambSpr.alpha = 0;
  ambientLayer.addChild(ambSpr);

  /* ── LAYER 1: Individual ray beams ──────────────────────────────── */
  const lightLayer = new Container();
  lightLayer.blendMode = 'add';
  root.addChild(lightLayer);

  const NUM_RAYS = isMobile ? 8 : 14;
  const RAY_W = isMobile ? 220 : 340;
  const RAY_H = isMobile ? 650 : 1000;

  const rayTex = makeTexture(raySliceTexture(RAY_W, RAY_H));
  const rays = [];

  for (let i = 0; i < NUM_RAYS; i++) {
    const spr = new Sprite(rayTex);
    spr.anchor.set(0.5, 0);  // pivot at top-center = light source point
    spr.alpha = 0;
    lightLayer.addChild(spr);

    // Spread rays in a fan from roughly -40° to +40°
    const spread = isMobile ? 0.7 : 0.75;
    const baseAngle = ((i / (NUM_RAYS - 1)) - 0.5) * Math.PI * spread;
    const baseScale = 0.4 + seededRand(i * 37) * 0.45;
    const phase = seededRand(i * 73) * Math.PI * 2;
    const speed = 0.25 + seededRand(i * 113) * 0.35;
    const baseAlpha = 0.06 + seededRand(i * 29) * 0.1;

    rays.push({ spr, baseAngle, baseScale, phase, speed, baseAlpha });
  }

  /* ── LAYER 2: Top haze glow ─────────────────────────────────────── */
  const HAZE_W = 800;
  const HAZE_H = 600;
  const hazeTex = makeTexture(hazeTexture(HAZE_W, HAZE_H));
  const haze = new Sprite(hazeTex);
  haze.anchor.set(0.5, 0);
  haze.blendMode = 'add';
  haze.alpha = 0;
  root.addChild(haze);

  /* ── LAYER 3: Ghost filled logo ─────────────────────────────────── */
  const filledSpr = new Sprite(filledTex);
  filledSpr.anchor.set(0.5);
  filledSpr.alpha = 0.72;
  root.addChild(filledSpr);

  /* ── LAYER 4: Edge highlight on top of logo (lit from above) ────── */
  const edgeTex = makeTexture(edgeHighlightTexture(filled.width, filled.height));
  const edgeSpr = new Sprite(edgeTex);
  edgeSpr.anchor.set(0.5);
  edgeSpr.blendMode = 'add';
  edgeSpr.alpha = 0;
  root.addChild(edgeSpr);

  /* ── LAYER 5: Outline overlay ───────────────────────────────────── */
  const outlineSpr = new Sprite(outlineTex);
  outlineSpr.anchor.set(0.5);
  outlineSpr.alpha = 0.85;
  root.addChild(outlineSpr);

  /* ── LAYER 6: Dust particles drifting down in the light cone ────── */
  const dustLayer = new Container();
  dustLayer.blendMode = 'add';
  root.addChild(dustLayer);

  const dustBlur = new BlurFilter({ strength: 1.2, quality: 2 });
  dustLayer.filters = [dustBlur];

  const NUM_DUST = isMobile ? 45 : 110;
  const dustTex = makeTexture(dustTexture(isMobile ? 8 : 12));
  const dustParticles = [];

  for (let i = 0; i < NUM_DUST; i++) {
    const spr = new Sprite(dustTex);
    spr.anchor.set(0.5);
    spr.alpha = 0;
    dustLayer.addChild(spr);

    // Dust spawns in the vertical column from above to below the logo
    const startY = LIGHT_Y_OFFSET + seededRand(i * 59) * (Math.abs(LIGHT_Y_OFFSET) + RAY_H * 0.5);
    const startX = (seededRand(i * 31) - 0.5) * filled.width * 1.2;
    const baseScale = 0.12 + seededRand(i * 97) * 0.5;

    dustParticles.push({
      spr,
      x: startX,
      y: startY,
      baseScale,
      // Drift velocities — mainly downward, slight horizontal drift
      vy: 0.12 + seededRand(i * 67) * 0.25,
      vx: (seededRand(i * 41) - 0.5) * 0.08,
      // Oscillation
      phase: seededRand(i * 83) * Math.PI * 2,
      wobbleAmp: 8 + seededRand(i * 101) * 25,
      wobbleSpeed: 0.0008 + seededRand(i * 107) * 0.002,
      // Opacity
      baseAlpha: 0.1 + seededRand(i * 127) * 0.35,
      // Twinkle
      twinkleSpeed: 0.001 + seededRand(i * 139) * 0.003,
    });
  }

  /* ── State ──────────────────────────────────────────────────────── */
  let lightX = 0;             // horizontal offset of light source
  let targetLightX = 0;
  let lightIntensity = 1;
  let targetIntensity = 1;
  let introProgress = 0;      // 0→1 entrance animation

  /* ── Layout ─────────────────────────────────────────────────────── */
  const layout = () => {
    const maxW = app.screen.width * 0.72;
    const s = maxW / filled.width;
    root.scale.set(s);
    root.x = app.screen.width / 2;
    root.y = app.screen.height / 2;
  };
  layout();
  onResize(app, layout);

  /* ── Animation loop ─────────────────────────────────────────────── */
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaTime, 3);
    const now = performance.now();
    const s = root.scale.x;

    // Intro fade-in (~2.5 seconds)
    if (introProgress < 1) {
      introProgress = Math.min(1, introProgress + dt * 0.01);
    }
    const easeIntro = 1 - Math.pow(1 - introProgress, 3);

    /* ── Mouse → light source position ─────────────────────────────── */
    if (ptr.inside && ptr.x > 0 && ptr.y > 0) {
      // Mouse X maps to light source X offset (in logo-space units)
      const mx = (ptr.x - root.x) / s;
      targetLightX = mx * 0.35; // subtle shift, not too extreme
      // Mouse higher = brighter light
      const my = (ptr.y - root.y) / s;
      const heightFactor = Math.max(0, -my / Math.abs(LIGHT_Y_OFFSET));
      targetIntensity = 1 + heightFactor * 0.25 + Math.abs(mx / filled.width) * 0.1;
    } else {
      // Idle: gentle horizontal sway
      targetLightX = Math.sin(now * 0.0003) * 30;
      targetIntensity = 1;
    }

    lightX += (targetLightX - lightX) * 0.035 * dt;
    lightIntensity += (targetIntensity - lightIntensity) * 0.04 * dt;

    const srcX = lightX;
    const srcY = LIGHT_Y_OFFSET;

    /* ── Update ambient beam ───────────────────────────────────────── */
    ambSpr.x = srcX;
    ambSpr.y = srcY;
    const ambPulse = 0.88 + 0.12 * Math.sin(now * 0.0008);
    ambSpr.alpha = 0.12 * ambPulse * lightIntensity * easeIntro;

    /* ── Update rays ───────────────────────────────────────────────── */
    for (const ray of rays) {
      // All rays originate from the light source
      ray.spr.x = srcX;
      ray.spr.y = srcY;

      // Rotate around the source point; mouse offset shifts the fan center
      const mouseAngleShift = (lightX / (filled.width * 0.5)) * 0.15;
      const sway = Math.sin(now * 0.0008 * ray.speed + ray.phase) * 0.03;
      ray.spr.rotation = ray.baseAngle + mouseAngleShift + sway;

      // Scale with gentle pulsing
      const pulse = 0.92 + 0.08 * Math.sin(now * 0.0012 * ray.speed + ray.phase);
      ray.spr.scale.set(
        ray.baseScale * pulse * 0.75,
        ray.baseScale * 1.05
      );

      // Opacity: center beams brighter
      const angleNorm = Math.abs(ray.baseAngle) / (Math.PI * 0.375);
      const centerBias = Math.max(0, 1 - angleNorm * 0.6);
      const alphaPulse = 0.85 + 0.15 * Math.sin(now * 0.0018 * ray.speed + ray.phase * 2);
      ray.spr.alpha = ray.baseAlpha * (0.6 + 0.4 * centerBias) * alphaPulse * lightIntensity * easeIntro;
    }

    /* ── Update haze ───────────────────────────────────────────────── */
    haze.x = srcX;
    haze.y = srcY;
    const hazePulse = 0.85 + 0.15 * Math.sin(now * 0.001);
    haze.alpha = 0.22 * hazePulse * lightIntensity * easeIntro;

    /* ── Update edge highlight (follows light direction) ───────────── */
    edgeSpr.alpha = 0.25 * lightIntensity * easeIntro;
    // Slight horizontal shift to match light direction
    edgeSpr.x = lightX * 0.05;

    /* ── Update dust particles ─────────────────────────────────────── */
    const beamHalfWidth = filled.width * 0.8; // visible zone width at logo level
    const beamTop = srcY;
    const beamBottom = -srcY + RAY_H * 0.35;

    for (const p of dustParticles) {
      // Drift downward
      p.y += p.vy * dt;
      p.x += p.vx * dt;

      // Wobble horizontally
      const wobble = Math.sin(now * p.wobbleSpeed + p.phase) * p.wobbleAmp;

      // Reset when below the visible beam zone
      if (p.y > beamBottom) {
        p.y = beamTop + seededRand(p.phase * 1000 + now * 0.001) * Math.abs(beamTop) * 0.3;
        p.x = (seededRand(p.phase * 2000 + now * 0.002) - 0.5) * filled.width * 1.0;
      }

      // Actual position (follow light source X slightly)
      const displayX = p.x + wobble + lightX * 0.2;
      const displayY = p.y;

      p.spr.x = displayX;
      p.spr.y = displayY;

      // Compute how far the particle is from the beam center axis
      // The beam fans out from srcX: at distance d below source, the beam is wider
      const distFromSrc = displayY - srcY;
      const beamWidthAtY = Math.abs(distFromSrc) * 0.8 + 40; // cone geometry
      const distFromAxis = Math.abs(displayX - srcX);
      const inBeam = distFromAxis < beamWidthAtY;

      // Edge fade — smooth falloff at beam edges
      const edgeFade = inBeam
        ? Math.pow(Math.max(0, 1 - distFromAxis / beamWidthAtY), 0.6)
        : 0;

      // Vertical fade — brighter near light source, fading as it falls
      const verticalSpan = beamBottom - beamTop;
      const vertPos = (displayY - beamTop) / verticalSpan;
      const vertFade = Math.max(0, 1 - vertPos * 0.7);

      // Twinkle
      const twinkle = 0.45 + 0.55 * Math.sin(now * p.twinkleSpeed + p.phase);

      p.spr.alpha = p.baseAlpha * twinkle * edgeFade * vertFade * lightIntensity * easeIntro;
      p.spr.scale.set(p.baseScale * (0.6 + vertFade * 0.4));
    }
  });
}
