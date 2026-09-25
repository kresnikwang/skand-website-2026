/**
 * SKAND B-Side — shared configuration.
 *
 * All three.js imports in this folder are absolute esm.sh URLs pinned to the
 * same three@0.170.0 the hero (explode.js) and the easter egg (egg/scene.js)
 * already load. Pinning matters: a bare esm.sh spec for any package that has
 * `three` as a peer dep resolves to the LATEST three and hands you a second,
 * incompatible three instance. examples/jsm modules import three relatively
 * (`../../../three.mjs`), so esm.sh dedupes them onto our pin with no query.
 */

export const THREE_URL = 'https://esm.sh/three@0.170.0';
export const JSM = (p) => `https://esm.sh/three@0.170.0/examples/jsm/${p}`;

// Brand palette — kept byte-identical to the CSS custom properties in
// b-side.html and index.html so the particle colors read as the same brand.
export const PALETTE = {
  black: 0x0a0a0a,
  white: 0xf0ede8,
  coral: 0xe8563a,
  blue: 0x4052b5,
  green: 0x7bbf9c,
  pink: 0xffb5a7,
  dim: 0x8a8580,
};

// Per-letter accent, mirrors the accentColors array the old Pixi version used.
export const LETTER_COLORS = [0xf0ede8, 0xf0ede8, 0xf0ede8, 0xf0ede8, 0xf0ede8];
export const LETTERS = ['S', 'K', 'A', 'N', 'D'];

// Pentatonic-ish charge notes, one per phase, reused by audio.js.
export const PHASE_NOTES = { chaos: 110, attract: 165, converge: 262, ignite: 440 };

/* Quality tiers.
   `count` is the compute-texture edge length; particles = count^2.
   Desktop 256^2 = 65,536 particles. Mobile 128^2 = 16,384. The floor is 96^2
   for low-core machines, which still reads as a dense cloud. */
export function detectTier() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const touch = coarse || narrow;
  if (touch) return { name: 'mobile', count: 128, bloom: true, maxPixelRatio: 1.5, frameShare: 0.22 };
  if (cores <= 4) return { name: 'low', count: 128, bloom: true, maxPixelRatio: 1.25, frameShare: 0.22 };
  return { name: 'desktop', count: 256, bloom: true, maxPixelRatio: 1.75, frameShare: 0.22 };
}

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Charge → phase thresholds. Charge is the single source of truth for the
   whole experience: it drives the HUD bar, the shader uniforms, and the
   phase label, so the UI can never disagree with what the scene is doing. */
export const PHASE_STOPS = { chaos: 0.0, attract: 0.24, converge: 0.56, ignite: 0.9 };

export const PHASE_ORDER = ['chaos', 'attract', 'converge', 'ignite'];

export const PHASE_LABEL = {
  chaos: { en: 'Chaos', zh: '混沌' },
  attract: { en: 'Attract', zh: '吸引' },
  converge: { en: 'Converge', zh: '聚拢' },
  ignite: { en: 'Ignite', zh: '点亮' },
};

export const I18N = {
  kicker: { en: 'B-Side — Form the Mark', zh: 'B-Side — 聚成形' },
  start: { en: 'Start', zh: '开始' },
  back: { en: 'Back', zh: '返回' },
  charge: { en: 'Charge', zh: '充能' },
  hint: {
    en: 'Click and drag to gather the particles',
    zh: '点击并拖拽，把粒子聚起来',
  },
  hintReady: {
    en: 'Keep going — the mark is forming',
    zh: '继续 — 标志正在成形',
  },
  revealed: { en: 'The mark is yours', zh: '标志已成形' },
  replay: { en: 'Replay', zh: '重玩' },
  sound: { en: 'Sound', zh: '音效' },
  muted: { en: 'Unmute', zh: '开启音效' },
  reset: { en: 'Reset', zh: '重置' },
  loading: { en: 'Gathering particles…', zh: '粒子聚集中…' },
  fail: { en: 'Could not start 3D on this device', zh: '此设备无法启动 3D 效果' },
};
