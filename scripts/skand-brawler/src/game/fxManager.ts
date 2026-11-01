// Offscreen Dual-Canvas Renderer & pixelfx Lifecycle Manager
// Enforces zero-black-box transparent compositing and depth sorting

import {
  createFrame,
  clearFrame,
  createFx,
  composite,
} from '../vendor/pixelfx/core/index.js';
import { effects } from '../vendor/pixelfx/fx/index.js';

export interface Frame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  color: Uint32Array;
  light: Uint32Array;
}

export interface FxInstance {
  meta: any;
  options: any;
  readonly t: number;
  update(dt: number): void;
  draw(frame: Frame, layer?: 'back' | 'front'): void;
  stop(): void;
  done(): boolean;
}

export interface ActiveFx {
  id: string;
  fx: FxInstance;
  layer?: 'back' | 'front' | 'both';
  elapsed: number;
  maxLife: number;
  followTarget?: () => { x: number; y: number } | null;
}

// Catalog of calibrated maximum lifetimes for combat & environmental effects (in seconds)
// Ensures effects finish their core strike/burst frames without being prematurely clipped
const EFFECT_MAX_LIFETIMES: Record<string, number> = {
  'impacts/hit-spark': 0.16,
  'impacts/heavy-landing': 0.22,
  'impacts/crit-hit': 0.25,
  'impacts/impact-frame': 0.12,
  'impacts/shield-block': 0.25,
  'melee/sword-slash': 0.15,
  'melee/spin-slash': 0.22,
  'melee/double-slash': 0.24,
  'melee/heavy-cleave': 0.40,
  'fire/flame-pillar': 0.35,
  'explosions/small-explosion': 0.25,
  'explosions/plasma-explosion': 0.32,
  'explosions/big-explosion': 0.55,
  'lightning/zap-hit': 0.22,
  'lightning/lightning-strike': 0.35,
  'scifi/emp-blast': 0.30,
  'scifi/jetpack': 0.20,
  'scifi/force-field': 0.25,
  'scifi/teleporter-pad': 0.45,
  'scifi/energy-core': 0.80,
  'holy/heal': 0.40,
  'holy/divine-shield': 0.40,
  'holy/sunburst': 0.65,
  'ui/level-up': 0.45,
  'ui/crit-number': 0.38,
  'ui/heart-lost': 0.45,
  'ui/quest-complete': 0.85,
  'ui/confetti': 0.90,
  'spawn/poof': 0.30,
  'water/rain-splash': 0.50,
  'weather/shooting-stars': 0.75,
  'weather/fog': 0.65,
  'pickups/collect-burst': 0.28,
  'transitions/glitch-wipe': 0.45,
};

export class FxManager {
  private width: number;
  private height: number;

  // Offscreen frames & canvases for Back and Front layers
  private backCanvas: HTMLCanvasElement;
  private backCtx: CanvasRenderingContext2D;
  private backFrame: Frame;
  private backImageData: ImageData;

  private frontCanvas: HTMLCanvasElement;
  private frontCtx: CanvasRenderingContext2D;
  private frontFrame: Frame;
  private frontImageData: ImageData;

  // Active instances pool
  private activeList: ActiveFx[] = [];

  constructor(width = 320, height = 180) {
    this.width = width;
    this.height = height;

    // Back canvas setup
    this.backCanvas = document.createElement('canvas');
    this.backCanvas.width = width;
    this.backCanvas.height = height;
    this.backCtx = this.backCanvas.getContext('2d', { willReadFrequently: true })!;
    this.backFrame = createFrame(width, height);
    this.backImageData = this.backCtx.createImageData(width, height);

    // Front canvas setup
    this.frontCanvas = document.createElement('canvas');
    this.frontCanvas.width = width;
    this.frontCanvas.height = height;
    this.frontCtx = this.frontCanvas.getContext('2d', { willReadFrequently: true })!;
    this.frontFrame = createFrame(width, height);
    this.frontImageData = this.frontCtx.createImageData(width, height);
  }

  public resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    this.backCanvas.width = width;
    this.backCanvas.height = height;
    this.backFrame = createFrame(width, height);
    this.backImageData = this.backCtx.createImageData(width, height);

    this.frontCanvas.width = width;
    this.frontCanvas.height = height;
    this.frontFrame = createFrame(width, height);
    this.frontImageData = this.frontCtx.createImageData(width, height);
  }

  // Spawn an effect by catalog id with strict lifecycle bounds & target tracking
  public spawn(
    effectId: string,
    options: Record<string, any> = {},
    layer: 'back' | 'front' | 'both' = 'front',
    overrideMaxLife?: number,
    followTarget?: () => { x: number; y: number } | null
  ): FxInstance | null {
    const mod = (effects as Record<string, any>)[effectId];
    if (!mod) {
      console.warn(`[pixelfx] Effect "${effectId}" not found in catalog.`);
      return null;
    }

    // Pool capping: strictly prevent accumulation of effects on screen (max 20 active across layers)
    if (this.activeList.length >= 20) {
      const oldest = this.activeList.shift();
      if (oldest) {
        try {
          oldest.fx.stop();
        } catch (_) {}
      }
    }

    try {
      // Suppress built-in pixelfx dummy stockActor (HERO2) overlay unless explicitly passed
      const safeOptions = {
        actor: {
          mask: { w: 0, h: 0, data: new Uint8Array(0) },
          pixels: new Uint32Array(0),
          x: 0,
          y: 0,
          w: 0,
          h: 0,
          k: 1,
          head: [0, 0],
          chest: [0, 0],
        },
        ...options,
      };

      const fx = createFx(mod, safeOptions);
      const maxLife = overrideMaxLife ?? EFFECT_MAX_LIFETIMES[effectId] ?? 0.25;

      this.activeList.push({
        id: effectId,
        fx,
        layer,
        elapsed: 0,
        maxLife,
        followTarget,
      });
      return fx;
    } catch (err) {
      console.error(`[pixelfx] Failed to spawn effect "${effectId}":`, err);
      return null;
    }
  }

  // Update active effects physics, follow targets, and enforce hard lifetimes
  public update(dt: number) {
    for (let i = this.activeList.length - 1; i >= 0; i--) {
      const item = this.activeList[i];
      item.elapsed += dt;

      // Follow target position if attached (e.g. hero blade slash following hero movement)
      if (item.followTarget) {
        const targetPos = item.followTarget();
        if (targetPos && item.fx.options) {
          item.fx.options.x = targetPos.x;
          item.fx.options.y = targetPos.y;
        }
      }

      item.fx.update(dt);

      // Clean up if done or if exceeding strict maximum lifetime
      if (item.fx.done() || item.elapsed >= item.maxLife) {
        try {
          item.fx.stop();
        } catch (_) {}
        this.activeList.splice(i, 1);
      }
    }
  }

  // Render both offscreen buffers
  public render() {
    clearFrame(this.backFrame);
    clearFrame(this.frontFrame);

    for (const item of this.activeList) {
      if (item.layer === 'back') {
        item.fx.draw(this.backFrame, 'back');
      } else if (item.layer === 'front') {
        item.fx.draw(this.frontFrame, 'front');
      } else {
        // both
        item.fx.draw(this.backFrame, 'back');
        item.fx.draw(this.frontFrame, 'front');
      }
    }

    // Composite with null background so output is transparent
    composite(this.backFrame, this.backImageData.data, null, 1.2);
    this.backCtx.putImageData(this.backImageData, 0, 0);

    composite(this.frontFrame, this.frontImageData.data, null, 1.2);
    this.frontCtx.putImageData(this.frontImageData, 0, 0);
  }

  // Draw back buffer to main canvas
  public drawBack(mainCtx: CanvasRenderingContext2D) {
    mainCtx.drawImage(this.backCanvas, 0, 0);
  }

  // Draw front buffer to main canvas
  public drawFront(mainCtx: CanvasRenderingContext2D) {
    mainCtx.drawImage(this.frontCanvas, 0, 0);
  }

  // Clear all live fx (e.g. on restart)
  public clear() {
    this.activeList = [];
    clearFrame(this.backFrame);
    clearFrame(this.frontFrame);
    this.backCtx.clearRect(0, 0, this.width, this.height);
    this.frontCtx.clearRect(0, 0, this.width, this.height);
  }

  public getActiveCount(): number {
    return this.activeList.length;
  }
}
