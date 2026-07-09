// Sunday — ASCII / Dot Matrix.
// SKAND is rendered as a character matrix. The cursor acts as a scan line:
// swept cells light up and switch to a denser/higher character (极客风).
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
} from './shared.js';

const RAMP = ' .:-=+*#%@';

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

  // Pre-render SKAND to sample its alpha per cell.
  const sample = document.createElement('canvas');
  sample.width = W; sample.height = H;
  const sx = sample.getContext('2d');
  sx.fillStyle = '#000'; sx.fillRect(0, 0, W, H);
  sx.fillStyle = '#fff';
  sx.textAlign = 'center';
  sx.textBaseline = 'middle';
  const fpx = Math.floor(H * 0.62);
  sx.font = `500 ${fpx}px 'Cormorant Garamond', Georgia, serif`;
  sx.fillText('SKAND', W / 2, H / 2);
  const data = sx.getImageData(0, 0, W, H).data;

  const alpha = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = Math.min(W - 1, c * cell + (cell >> 1));
      const py = Math.min(H - 1, r * cell + (cell >> 1));
      alpha[r * cols + c] = data[(py * W + px) * 4] / 255;
    }
  }

  // ASCII canvas (updated every frame)
  const ascii = document.createElement('canvas');
  ascii.width = W; ascii.height = H;
  const actx = ascii.getContext('2d');
  actx.textAlign = 'center';
  actx.textBaseline = 'middle';
  actx.font = `${cell}px ui-monospace, Menlo, Consolas, monospace`;

  const tex = new Texture({ source: new CanvasSource({ resource: ascii }) });
  const spr = new Sprite(tex);
  fitAndCenter(spr, app, 0.8);
  app.stage.addChild(spr);

  onResize(app, () => fitAndCenter(spr, app, 0.8));

  const lit = new Float32Array(cols * rows); // scan-line trail
  let cursorX = W / 2, cursorY = H / 2;

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaTime, 3);
    // map pointer (stage coords) into ascii-canvas px
    const scale = spr.scale.x;
    const mx = (ptr.x - spr.x) / scale;
    const my = (ptr.y - spr.y) / scale;
    if (ptr.inside) { cursorX = mx; cursorY = my; }

    const scanR = 95;
    const scanR2 = scanR * scanR;

    actx.clearRect(0, 0, W, H);
    actx.fillStyle = '#000';
    actx.fillRect(0, 0, W, H);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const a = alpha[i];
        if (a < 0.25) { lit[i] *= 0.9; continue; }

        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        const dx = cx - cursorX, dy = cy - cursorY;
        const d2 = dx * dx + dy * dy;
        if (d2 < scanR2) lit[i] = 1;
        else lit[i] *= 0.93;

        const bright = Math.min(1, a * 0.75 + lit[i] * 0.6);
        const ci = Math.min(RAMP.length - 1, Math.floor(bright * (RAMP.length - 1)));
        const ch = RAMP[ci];
        if (ch === ' ') { lit[i] *= 0.9; continue; }

        // coral -> white by brightness
        const rr = Math.round(232 + (240 - 232) * bright);
        const gg = Math.round(86 + (237 - 86) * bright);
        const bb = Math.round(58 + (232 - 58) * bright);
        actx.fillStyle = `rgb(${rr},${gg},${bb})`;
        actx.fillText(ch, cx, cy);
      }
    }

    // scan-line cursor indicator
    actx.strokeStyle = 'rgba(240, 237, 232, 0.35)';
    actx.lineWidth = 2;
    actx.beginPath();
    actx.moveTo(cursorX, 0);
    actx.lineTo(cursorX, H);
    actx.stroke();

    tex.source.update();
  });
}
