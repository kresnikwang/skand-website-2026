/**
 * SKAND B-Side — shared configuration.
 *
 * All three.js imports in this folder are absolute esm.sh URLs pinned to
 * three@0.187.0 (WebGPURenderer + TSL, with automatic WebGL2 backend fallback).
 * Pinning matters: a bare esm.sh spec for any package that has `three` as a
 * peer dep can resolve a mismatched instance.
 */

export const THREE_VERSION = '0.187.0';
export const THREE_URL = `https://esm.sh/three@${THREE_VERSION}`;
export const THREE_WEBGPU_URL = `https://esm.sh/three@${THREE_VERSION}/webgpu`;
export const THREE_TSL_URL = `https://esm.sh/three@${THREE_VERSION}/tsl`;
export const JSM = (p) => `https://esm.sh/three@${THREE_VERSION}/examples/jsm/${p}`;

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
   `count` is the particle grid edge length; particles = count^2.
   `shardCount` is the number of 3D Voronoi glass shards forming the mark. */
export function detectTier() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const touch = coarse || narrow;
  if (touch) return { name: 'mobile', count: 96, webgpuCount: 128, shardCount: 240, bloom: true, maxPixelRatio: 1.5, frameShare: 0.24 };
  if (cores <= 4) return { name: 'low', count: 128, webgpuCount: 160, shardCount: 360, bloom: true, maxPixelRatio: 1.25, frameShare: 0.24 };
  return { name: 'desktop', count: 192, webgpuCount: 256, shardCount: 540, bloom: true, maxPixelRatio: 1.75, frameShare: 0.24 };
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
  kicker: { en: 'End of the Page · B-Side', zh: '恭喜滑到尽头 · B-Side' },
  kickerSqueeze: { en: 'B-Side · Stress Test', zh: 'B-Side · 解压现场' },
  kickerSquish: { en: 'B-Side · Soft Toy', zh: 'B-Side · 捏捏乐' },
  introSub: {
    en: 'Serious work stays upstairs. Down here, consider this digital bubble wrap.',
    zh: '认真作品留在上面。滑到这里，当个电子捏捏乐。',
  },
  modeGather: { en: 'Gather', zh: '聚形' },
  modeSqueeze: { en: 'Squeeze', zh: '捏碎' },
  modeSquish: { en: 'Squish', zh: '捏捏' },
  start: { en: 'Break In', zh: '溜进来' },
  back: { en: 'Back', zh: '返回' },
  charge: { en: 'Charge', zh: '聚力' },
  hint: {
    en: 'Swirl the shards. Strangely soothing.',
    zh: '划两下把碎玻璃聚起来，莫名解压。',
  },
  hintAttract: {
    en: 'Pulling right into place…',
    zh: '一块块吸回去了……',
  },
  hintReady: {
    en: 'Almost snapped shut.',
    zh: '就差最后一下对齐。',
  },
  revealed: {
    en: 'Satisfying. Try Squeeze or Squish ↑',
    zh: '齐活。试试上面「捏碎」或「捏捏」↑',
  },
  tension: { en: 'Pressure', zh: '压力' },
  hintSqueeze: {
    en: 'Pinch it hard. Like bubble wrap.',
    zh: '按住使劲捏，当气泡膜踩。',
  },
  hintSqueezeStrain: {
    en: 'Hear that crunch? Keep going.',
    zh: '咯吱响了，继续加把劲。',
  },
  hintSqueezeTight: {
    en: 'Careful…',
    zh: '快撑不住了……',
  },
  popped: { en: 'Satisfying, isn’t it?', zh: '是不是还挺爽？' },
  poppedList: {
    en: [
      'Satisfying, isn’t it?',
      'Built to break.',
      'Better than bubble wrap.',
      'One more?',
    ],
    zh: [
      '是不是还挺爽？',
      '本来就是做给你捏爆的。',
      '比捏气泡膜还得劲。',
      '再来一发？',
    ],
  },
  squishLabel: { en: 'Squish', zh: 'Q弹度' },
  poke: { en: 'Poke', zh: '按捏' },
  bulge: { en: 'Bulge', zh: '挤出' },
  boing: { en: 'Boing', zh: '回弹' },
  hintSquish: {
    en: 'Poke & drag. Soft silicone, zero glass.',
    zh: '戳一戳、揉一揉，这次是软软的捏捏乐。',
  },
  hintSquishBulge: {
    en: 'Feel it ooze sideways? Keep kneading.',
    zh: '挤出来了——多揉几下还挺 Q 弹。',
  },
  hintSquishBoing: {
    en: 'Let go to watch it boing—or push till it splats.',
    zh: '松手看它回弹——或者干脆压到底！',
  },
  squishPoppedList: {
    en: [
      'Pure silicone bliss.',
      '100% bounce back.',
      'Squishy level: mochi.',
      'Okay, one more poke.',
    ],
    zh: [
      '软乎乎，真解压。',
      '弹回去那一下最爽。',
      '手感堪比刚出炉的麻薯。',
      '再戳最后一下？',
    ],
  },
  pops: { en: 'Pops', zh: '捏爆' },
  boings: { en: 'Boings', zh: '回弹' },
  press: { en: 'Press', zh: '按压' },
  strain: { en: 'Strain', zh: '形变' },
  burst: { en: 'Burst', zh: '爆裂' },
  replay: { en: 'Replay', zh: '重玩' },
  sound: { en: 'Sound', zh: '音效' },
  muted: { en: 'Unmute', zh: '开启音效' },
  reset: { en: 'Reset', zh: '重置' },
  loading: { en: 'Gathering shards…', zh: '碎玻璃集结中…' },
  fail: { en: 'Could not start 3D on this device', zh: '此设备无法启动 3D 效果' },
};
