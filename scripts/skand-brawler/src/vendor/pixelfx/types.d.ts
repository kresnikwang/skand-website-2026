declare module '*/vendor/pixelfx/core/index.js' {
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

  export function createFrame(w: number, h: number, ox?: number, oy?: number): Frame;
  export function clearFrame(f: Frame): Frame;
  export function createFx(mod: any, options?: any): FxInstance;
  export function composite(f: Frame, out: Uint8ClampedArray, bg?: number | Uint32Array | null, lightK?: number): void;
  export function painterFor(frame: Frame): any;
  export function resolveOptions(meta: any, o?: any): any;
  export * from './math.js';
  export * from './color.js';
}

declare module '*/vendor/pixelfx/fx/index.js' {
  export const effects: Record<string, any>;
  export const categories: any[];
}
