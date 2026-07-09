// Sunday — ASCII 点阵 (Dot Matrix).
// SKAND is rendered as a character matrix with a hacker/geek aesthetic.
// The cursor acts as a vertical + horizontal scan line crosshair.
// Swept cells light up and switch to denser/brighter characters.
// Features: scan-line glow, CRT lines, background noise flicker, persistence trail.
import {
  Application,
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import {
  isMobile, prepareHeroForPixi, makeApp, bindPixi,
  fitAndCenter, trackPointer, onResize,
} from './shared.js?v=13';

const RAMP = ' .:-=+*#%@';
const NOISE_CHARS = '.:;|/\\~*+-';

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero);
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  const W = 960, H = 320;
  const cell = isMobile ? 16 : 12;
  const cols = Math.floor(W / cell);
  const rows = Math.floor(H / cell);

  /* ── Pre-render SKAND to sample alpha per cell ── */
  // Use a larger supersample canvas for better stroke coverage, especially
  // for serif characters like A and N where thin strokes may be missed
  // by single-pixel sampling.
  const SS = 2; // supersample factor
  const sampleW = W * SS, sampleH = H * SS;
  const sample = document.createElement('canvas');
  sample.width = sampleW; sample.height = sampleH;
  const sx = sample.getContext('2d');
  sx.fillStyle = '#000'; sx.fillRect(0, 0, sampleW, sampleH);
  sx.fillStyle = '#fff';
  sx.textAlign = 'center';
  sx.textBaseline = 'middle';
  const fpx = Math.floor(sampleH * 0.62);
  sx.font = `500 ${fpx}px 'Cormorant Garamond', Georgia, serif`;
  try { sx.letterSpacing = (7 * SS) + 'px'; } catch (_) {}
  sx.fillText('SKAND', sampleW / 2, sampleH / 2);
  const data = sx.getImageData(0, 0, sampleW, sampleH).data;

  // Sample alpha using area averaging (multi-sample per cell) for accurate
  // coverage of thin strokes in A and N.
  const alpha = new Float32Array(cols * rows);
  const cellSS = cell * SS;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      // Sample a 3x3 grid within each cell for better coverage
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const spx = Math.min(sampleW - 1, c * cellSS + Math.floor(cellSS * (dx + 0.5) / 3));
          const spy = Math.min(sampleH - 1, r * cellSS + Math.floor(cellSS * (dy + 0.5) / 3));
          sum += data[(spy * sampleW + spx) * 4];
          count++;
        }
      }
      alpha[r * cols + c] = (sum / count) / 255;
    }
  }

  /* ── ASCII output canvas ── */
  const ascii = document.createElement('canvas');
  ascii.width = W; ascii.height = H;
  const actx = ascii.getContext('2d');
  const monoFont = `${cell}px ui-monospace, Menlo, Consolas, monospace`;
  actx.textAlign = 'center';
  actx.textBaseline = 'middle';
  actx.font = monoFont;

  const tex = new Texture({ source: new CanvasSource({ resource: ascii }) });
  const spr = new Sprite(tex);
  fitAndCenter(spr, app, 0.8);
  app.stage.addChild(spr);

  onResize(app, () => fitAndCenter(spr, app, 0.8));

  /* ── State ── */
  const lit = new Float32Array(cols * rows);
  let cursorX = -200, cursorY = H / 2;

  // Brand colours
  const C_REST = { r: 100, g: 42, b: 30 };     // very dim coral for unlit text
  const C_CORAL = { r: 232, g: 86, b: 58 };     // #e8563a for lit transition
  const C_WHITE = { r: 240, g: 237, b: 232 };   // #f0ede8 fully scanned

  /* ── Scan parameters ── */
  const SCAN_R = 100;
  const HSCAN_R = 140;
  const DECAY = 0.935;

  /* ── CRT overlay ── */
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = W; crtCanvas.height = H;
  const cctx = crtCanvas.getContext('2d');
  cctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
  for (let y = 0; y < H; y += 3) {
    cctx.fillRect(0, y, W, 1);
  }

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaTime, 3);

    /* ── Map pointer into ascii-canvas coords ── */
    const scl = spr.scale.x;
    const ox = spr.x - (spr.anchor?.x ?? 0.5) * spr.width;
    const oy = spr.y - (spr.anchor?.y ?? 0.5) * spr.height;
    const mx = (ptr.x - ox) / scl;
    const my = (ptr.y - oy) / scl;
    if (ptr.inside) {
      cursorX = mx;
      cursorY = my;
    }

    /* ── Clear to dark background — use a very dark grey instead of pure
         black to help the interactive area blend with the site background ── */
    actx.clearRect(0, 0, W, H);
    actx.fillStyle = '#0a0a0a';
    actx.fillRect(0, 0, W, H);
    actx.font = monoFont;

    /* ── Render characters ── */
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const a = alpha[i];
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;

        // Distance from scan lines
        const dxAbs = Math.abs(cx - cursorX);
        const dyAbs = Math.abs(cy - cursorY);

        // Scan influence
        const vInfluence = dxAbs < SCAN_R ? 1 - (dxAbs / SCAN_R) : 0;
        const hInfluence = dyAbs < HSCAN_R ? (1 - (dyAbs / HSCAN_R)) * 0.3 : 0;
        const scanInfluence = Math.min(1, vInfluence + hInfluence);

        if (scanInfluence > 0.01) {
          lit[i] = Math.max(lit[i], scanInfluence);
        }

        // Lower threshold for text detection — catch thin strokes
        const isTextCell = a >= 0.08;

        if (isTextCell) {
          lit[i] *= DECAY;

          const bright = Math.min(1, a * 0.55 + lit[i] * 0.75);
          const ci = Math.min(RAMP.length - 1, Math.floor(bright * (RAMP.length - 1)));
          const ch = RAMP[ci];
          if (ch === ' ') continue;

          // Colour blend: dim rest → coral → white as lit increases
          const t = Math.min(1, lit[i] * 1.2);
          let rr, gg, bb;
          if (t < 0.5) {
            // rest → coral
            const t2 = t * 2;
            rr = Math.round(C_REST.r + (C_CORAL.r - C_REST.r) * t2);
            gg = Math.round(C_REST.g + (C_CORAL.g - C_REST.g) * t2);
            bb = Math.round(C_REST.b + (C_CORAL.b - C_REST.b) * t2);
          } else {
            // coral → white
            const t2 = (t - 0.5) * 2;
            rr = Math.round(C_CORAL.r + (C_WHITE.r - C_CORAL.r) * t2);
            gg = Math.round(C_CORAL.g + (C_WHITE.g - C_CORAL.g) * t2);
            bb = Math.round(C_CORAL.b + (C_WHITE.b - C_CORAL.b) * t2);
          }
          const aa = Math.min(1, 0.4 + bright * 0.6);
          actx.fillStyle = `rgba(${rr},${gg},${bb},${aa})`;
          actx.fillText(ch, cx, cy);
        } else {
          // Background noise — very sparse and dim
          lit[i] *= 0.88;
          const nearScan = scanInfluence > 0.15;
          const doFlicker = nearScan ? Math.random() < 0.06 : Math.random() < 0.008;

          if (doFlicker || lit[i] > 0.1) {
            const nch = NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
            const na = nearScan ? 0.08 + scanInfluence * 0.12 : 0.03;
            actx.fillStyle = `rgba(${C_REST.r},${C_REST.g},${C_REST.b},${na})`;
            actx.fillText(nch, cx, cy);
          }
        }
      }
    }

    /* ── Scan-line glow ── */
    if (ptr.inside || cursorX > 0) {
      const glowW = 50;
      const grad = actx.createLinearGradient(cursorX - glowW, 0, cursorX + glowW, 0);
      grad.addColorStop(0, 'rgba(232, 86, 58, 0)');
      grad.addColorStop(0.35, 'rgba(240, 237, 232, 0.025)');
      grad.addColorStop(0.5, 'rgba(240, 237, 232, 0.05)');
      grad.addColorStop(0.65, 'rgba(240, 237, 232, 0.025)');
      grad.addColorStop(1, 'rgba(232, 86, 58, 0)');
      actx.fillStyle = grad;
      actx.fillRect(cursorX - glowW, 0, glowW * 2, H);

      // Thin vertical scan line
      actx.strokeStyle = 'rgba(240, 237, 232, 0.2)';
      actx.lineWidth = 1;
      actx.beginPath();
      actx.moveTo(cursorX, 0);
      actx.lineTo(cursorX, H);
      actx.stroke();

      // Thin horizontal scan line (subtler)
      actx.strokeStyle = 'rgba(240, 237, 232, 0.08)';
      actx.lineWidth = 1;
      actx.beginPath();
      actx.moveTo(0, cursorY);
      actx.lineTo(W, cursorY);
      actx.stroke();
    }

    /* ── CRT overlay ── */
    actx.globalAlpha = 0.35;
    actx.drawImage(crtCanvas, 0, 0);
    actx.globalAlpha = 1;

    tex.source.update();
  });
}
