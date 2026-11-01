// Software 2D Canvas & Visual Inspection Generator using Sharp
import sharp from 'sharp';

class SoftwareContext {
  public width: number;
  public height: number;
  public buffer: Uint8ClampedArray;
  public fillStyle: any = '#000000';
  public strokeStyle: any = '#000000';
  public lineWidth = 1;
  public globalAlpha = 1;
  public font = '';
  public textAlign = 'left';

  private stack: any[] = [];
  private transX = 0;
  private transY = 0;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.buffer = new Uint8ClampedArray(w * h * 4);
  }

  save() {
    this.stack.push({
      transX: this.transX,
      transY: this.transY,
      globalAlpha: this.globalAlpha,
      fillStyle: this.fillStyle,
    });
  }

  restore() {
    if (this.stack.length > 0) {
      const s = this.stack.pop();
      this.transX = s.transX;
      this.transY = s.transY;
      this.globalAlpha = s.globalAlpha;
      this.fillStyle = s.fillStyle;
    }
  }

  translate(x: number, y: number) {
    this.transX += x;
    this.transY += y;
  }

  rotate() {}

  clearRect(x: number, y: number, w: number, h: number) {
    for (let r = Math.max(0, y); r < Math.min(this.height, y + h); r++) {
      for (let c = Math.max(0, x); c < Math.min(this.width, x + w); c++) {
        const idx = (r * this.width + c) * 4;
        this.buffer[idx] = 0;
        this.buffer[idx + 1] = 0;
        this.buffer[idx + 2] = 0;
        this.buffer[idx + 3] = 0;
      }
    }
  }

  private parseColor(col: any, yNorm = 0): [number, number, number, number] {
    if (typeof col === 'object' && col && col._isGrad) {
      return col.sample(yNorm);
    }
    if (typeof col !== 'string') return [255, 255, 255, 255];
    col = col.trim();
    if (col.startsWith('#')) {
      if (col.length === 4) {
        const r = parseInt(col[1] + col[1], 16);
        const g = parseInt(col[2] + col[2], 16);
        const b = parseInt(col[3] + col[3], 16);
        return [r, g, b, 255];
      }
      if (col.length >= 7) {
        const r = parseInt(col.slice(1, 3), 16);
        const g = parseInt(col.slice(3, 5), 16);
        const b = parseInt(col.slice(5, 7), 16);
        const a = col.length === 9 ? parseInt(col.slice(7, 9), 16) : 255;
        return [r, g, b, a];
      }
    }
    if (col.startsWith('rgba')) {
      const m = col.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
      if (m) {
        return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), Math.round(parseFloat(m[4]) * 255)];
      }
    }
    if (col.startsWith('rgb')) {
      const m = col.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (m) {
        return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), 255];
      }
    }
    return [255, 255, 255, 255];
  }

  fillRect(x: number, y: number, w: number, h: number) {
    const rx = Math.round(x + this.transX);
    const ry = Math.round(y + this.transY);
    const x0 = Math.max(0, rx);
    const y0 = Math.max(0, ry);
    const x1 = Math.min(this.width, rx + Math.round(w));
    const y1 = Math.min(this.height, ry + Math.round(h));

    for (let py = y0; py < y1; py++) {
      const yNorm = (py - ry) / Math.max(1, h);
      const [cr, cg, cb, ca] = this.parseColor(this.fillStyle, yNorm);
      const alpha = (ca / 255) * this.globalAlpha;
      if (alpha <= 0) continue;

      for (let px = x0; px < x1; px++) {
        const idx = (py * this.width + px) * 4;
        const bgR = this.buffer[idx];
        const bgG = this.buffer[idx + 1];
        const bgB = this.buffer[idx + 2];
        const bgA = this.buffer[idx + 3] / 255;

        const outA = alpha + bgA * (1 - alpha);
        if (outA > 0) {
          this.buffer[idx] = Math.round((cr * alpha + bgR * bgA * (1 - alpha)) / outA);
          this.buffer[idx + 1] = Math.round((cg * alpha + bgG * bgA * (1 - alpha)) / outA);
          this.buffer[idx + 2] = Math.round((cb * alpha + bgB * bgA * (1 - alpha)) / outA);
          this.buffer[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  }

  strokeRect(x: number, y: number, w: number, h: number) {
    const prev = this.fillStyle;
    this.fillStyle = this.strokeStyle;
    this.fillRect(x, y, w, 1);
    this.fillRect(x, y + h - 1, w, 1);
    this.fillRect(x, y, 1, h);
    this.fillRect(x + w - 1, y, 1, h);
    this.fillStyle = prev;
  }

  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  fill() {}

  ellipse(cx: number, cy: number, rx: number, ry: number) {
    const minX = Math.max(0, Math.round(cx - rx + this.transX));
    const maxX = Math.min(this.width, Math.round(cx + rx + this.transX));
    const minY = Math.max(0, Math.round(cy - ry + this.transY));
    const maxY = Math.min(this.height, Math.round(cy + ry + this.transY));

    const [cr, cg, cb, ca] = this.parseColor(this.fillStyle);
    const alpha = (ca / 255) * this.globalAlpha;

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const dx = (x - (cx + this.transX)) / rx;
        const dy = (y - (cy + this.transY)) / ry;
        if (dx * dx + dy * dy <= 1) {
          const idx = (y * this.width + x) * 4;
          this.buffer[idx] = cr;
          this.buffer[idx + 1] = cg;
          this.buffer[idx + 2] = cb;
          this.buffer[idx + 3] = Math.round(alpha * 255);
        }
      }
    }
  }

  fillText(text: string, x: number, y: number) {
    // Render high-contrast pixelated text representation
    const tx = Math.round(x + this.transX - (this.textAlign === 'center' ? text.length * 3 : 0));
    const ty = Math.round(y + this.transY - 6);
    const prev = this.fillStyle;
    this.fillRect(tx, ty, text.length * 6, 8);
    this.fillStyle = prev;
  }

  measureText(text: string) {
    return { width: text.length * 6 };
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    const stops: any[] = [];
    return {
      _isGrad: true,
      addColorStop: (pos: number, col: string) => stops.push({ pos, col }),
      sample: (n: number) => {
        if (stops.length === 0) return [10, 10, 20, 255];
        return [20, 15, 35, 255];
      },
    };
  }

  createRadialGradient() {
    return {
      _isGrad: true,
      addColorStop: () => {},
      sample: () => [20, 15, 35, 255],
    };
  }

  createImageData(w: number, h: number) {
    return { data: new Uint8ClampedArray((w || 10) * (h || 10) * 4) };
  }

  drawImage() {}
  getImageData() {
    return { data: new Uint8ClampedArray(400) };
  }
  putImageData() {}
}

// Set up globals for Engine
const width = 240;
const height = 520;
const softwareCtx = new SoftwareContext(width, height);

(global as any).window = {
  innerWidth: 390,
  innerHeight: 844,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(global as any).document = {
  createElement: () => ({
    width: 200,
    height: 200,
    getContext: () => softwareCtx,
  }),
};
(global as any).performance = { now: () => 1000 };
(global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

const { GameEngine } = await import('./src/game/engine');

console.log('Rendering Portrait Gameplay Screenshot (Mobile Layout)...');
const mockCanvas: any = {
  width,
  height,
  getContext: () => softwareCtx,
};

const portraitEngine = new GameEngine(mockCanvas as HTMLCanvasElement, 390, 844);
portraitEngine.start();
// Spawn elements
portraitEngine.heroX = 70;
(portraitEngine as any).spawnBarricade();
(portraitEngine as any).spawnDrone();
(portraitEngine as any).spawnLaserGrid();

// Render frame
portraitEngine.render();

// Write portrait image using sharp
await sharp(Buffer.from(softwareCtx.buffer), {
  raw: {
    width,
    height,
    channels: 4,
  },
})
  .png()
  .toFile('visual-check-portrait.png');

console.log('✓ visual-check-portrait.png generated successfully.');

// Now render Desktop layout
const deskW = 360;
const deskH = 200;
const deskCtx = new SoftwareContext(deskW, deskH);
const deskCanvas: any = {
  width: deskW,
  height: deskH,
  getContext: () => deskCtx,
};
const desktopEngine = new GameEngine(deskCanvas as HTMLCanvasElement, 1440, 900);
desktopEngine.start();
desktopEngine.heroX = 90;
(desktopEngine as any).spawnBarricade();
(desktopEngine as any).spawnDrone();
desktopEngine.render();

await sharp(Buffer.from(deskCtx.buffer), {
  raw: {
    width: deskW,
    height: deskH,
    channels: 4,
  },
})
  .png()
  .toFile('visual-check-desktop.png');

console.log('✓ visual-check-desktop.png generated successfully.');
