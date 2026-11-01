// ASCII Pixel Grid Sprites & SKAND Cyberpunk Night Street Parallax
// Procedural pixel rendering for hero (multi-pose walk/run, 3-phase slash, jump/landing squash), enemies, relics, and SKAND Studio night street

import { PALETTE } from './spec';
import { SceneTheme, STAGES } from './stages';

export type PixelMatrix = string[];

export function drawPixelMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: PixelMatrix,
  palette: Record<string, string>,
  x: number,
  y: number,
  scale = 1,
  flipX = false,
  alpha = 1
) {
  if (alpha <= 0) return;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * alpha;

  const h = matrix.length;
  const w = matrix[0]?.length || 0;

  for (let r = 0; r < h; r++) {
    const row = matrix[r];
    const y0 = Math.round(y + r * scale);
    const y1 = Math.round(y + (r + 1) * scale);
    const rh = Math.max(1, y1 - y0);

    for (let c = 0; c < w; c++) {
      const char = row[c];
      if (char === '.' || char === ' ') continue;
      const color = palette[char];
      if (!color) continue;

      ctx.fillStyle = color;
      const curCol = flipX ? w - 1 - c : c;
      const x0 = Math.round(x + curCol * scale);
      const x1 = Math.round(x + (curCol + 1) * scale);
      const rw = Math.max(1, x1 - x0);

      ctx.fillRect(x0, y0, rw, rh);
    }
  }

  ctx.globalAlpha = prevAlpha;
}

export function drawContactShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  radius = 10,
  alpha = 0.55
) {
  if (radius <= 0 || alpha <= 0) return;
  const ry = Math.max(1, radius * 0.35);
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(groundY), Math.max(1, radius), ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ================= HERO PALETTES & MULTI-ACTION SPRITES =================
export const HERO_PAL = {
  k: '#080811', // dark crisp outline
  w: '#FFFFFF', // high-contrast white cyber jacket
  c: '#FF4D3D', // coral red scarf
  b: '#3A6BE8', // steel blue cyber pants
  s: '#FFD166', // visor / blade gold spark
  d: '#1E202B', // armored boots
  g: '#7E86A0', // metallic joint
  n: '#00F0FF', // cyber cyan blade edge
};

// Hero Idle 1 (16 x 19)
export const HERO_IDLE_1: PixelMatrix = [
  '....kkkkkk......',
  '...kccccwsk.....',
  '..kccccccwsk....',
  '..kcsssssssk....',
  '..kcsksksssk....',
  '...kcssssssk....',
  '....kwwwwwk.....',
  '...kwccwwwwk....',
  '..kwccccwwwwk...',
  '..kwwccwwwwwk...',
  '..kwwwwwwwwwk...',
  '...kbbbbbbbk....',
  '...kbb...bbk....',
  '...kbb...bbk....',
  '...kbb...bbk....',
  '...kdd...ddk....',
  '...kdd...ddk....',
  '..kddk...kddk...',
  '..kkkk...kkkk...',
];

// Hero Idle 2 (Subtle breathing/bobbing)
export const HERO_IDLE_2: PixelMatrix = [
  '....kkkkkk......',
  '...kccccwsk.....',
  '..kccccccwsk....',
  '..kcsssssssk....',
  '..kcsksksssk....',
  '...kcssssssk....',
  '....kwwwwwk.....',
  '...kwccwwwwk....',
  '..kwccccwwwwk...',
  '..kwwccwwwwwk...',
  '..kwwwwwwwwwk...',
  '...kbbbbbbbk....',
  '....kbb..kbbk...',
  '....kbb..kbbk...',
  '....kdd..kddk...',
  '....kdd..kddk...',
  '...kddk..kddk...',
  '...kkkk..kkkk...',
];

// Hero Run Frame 1 (18 x 19, forward stride with scarf billowing)
export const HERO_RUN_1: PixelMatrix = [
  '..kk..kkkkkk......',
  '.kcckkccccwsk.....',
  '..kccccccwwsk.....',
  '...kcsssssssk.....',
  '...kcsksksssk.....',
  '....kcssssssk.....',
  '.....kwwwwwk......',
  '....kwccwwwwkk....',
  '...kwccccwwwwsk...',
  '...kwwccwwwwwsk...',
  '...kwwwwwwwwwwk...',
  '....kbbbbbbbbk....',
  '..kbbk....kbbk....',
  '.kbbk......kbbk...',
  '.kddk.......kddk..',
  'kddk.........kddk.',
  'kkkk..........kkk.',
];

// Hero Run Frame 2 (Opposite stride)
export const HERO_RUN_2: PixelMatrix = [
  '..kk..kkkkkk......',
  '.kcckkccccwsk.....',
  '..kccccccwwsk.....',
  '...kcsssssssk.....',
  '...kcsksksssk.....',
  '....kcssssssk.....',
  '.....kwwwwwk......',
  '....kwccwwwwk.....',
  '...kwccccwwwwk....',
  '...kwwccwwwwwk....',
  '...kwwwwwwwwwk....',
  '....kbbbbbbbk.....',
  '.....kbb..kbbk....',
  '....kbbk...kbbk...',
  '...kddk.....kddk..',
  '..kddk.......kddk.',
  '..kkkk.......kkkk.',
];

// Hero Jump Upwards (16 x 17, knees tucked, scarf fluttering)
export const HERO_JUMP: PixelMatrix = [
  '....kkkkkk......',
  '...kccccwsk..kk.',
  '..kccccccwskkcck',
  '..kcssssssskkcck',
  '..kcsksksssk.kk.',
  '...kcssssssk....',
  '....kwwwwwk.....',
  '...kwccwwwwk....',
  '..kwccccwwwwk...',
  '..kwwccwwwwwk...',
  '..kwwwwwwwwwk...',
  '...kbbbbbbbk....',
  '...kbbbbkbbk....',
  '..kbbkkk.kbbk...',
  '..kddk...kddk...',
  '...kk.....kk....',
];

// Hero Landing Squash (18 x 15, knees bent wide on ground contact)
export const HERO_LAND_SQUASH: PixelMatrix = [
  '......kkkkkk......',
  '.....kccccwsk.....',
  '....kccccccwsk....',
  '....kcsssssssk....',
  '....kcsksksssk....',
  '.....kcssssssk....',
  '......kwwwwwk.....',
  '.....kwccwwwwk....',
  '...kkwccccwwwwkk..',
  '..kwwwwwwwwwwwwwk.',
  '..kbbbbbbbbbbbbk..',
  '.kbbkk.......kkbbk',
  '.kddk.........kddk',
  '.kkk...........kkk',
];

// Hero Slash Phase 1: STARTUP (20 x 18, coiling back, blade primed)
export const HERO_SLASH_START: PixelMatrix = [
  '....kkk.kkkkkk......',
  '...kssskccccwsk.....',
  '..ksssskcccccwsk....',
  '..kssskcsssssssk....',
  '...kkk.kcsksksssk...',
  '.......kcssssssk....',
  '........kwwwwwk.....',
  '.......kwccwwwwk....',
  '......kwccccwwwwk...',
  '......kwwccwwwwwk...',
  '......kwwwwwwwwwk...',
  '.......kbbbbbbbk....',
  '......kbbk...kbbk...',
  '......kddk...kddk...',
  '.....kddk.....kddk..',
  '.....kkkk.....kkkk..',
];

// Hero Slash Phase 2: ACTIVE LUNGE (24 x 17, forward thrust with gleaming cyber blade)
export const HERO_SLASH_ACTIVE: PixelMatrix = [
  '........kkkkkk..........',
  '.......kccccwsk.........',
  '......kccccccwsk........',
  '......kcsssssssk........',
  '......kcsksksssk........',
  '.......kcssssssk........',
  '....kkk.kwwwwwk..kkk....',
  '...kcccwccwwwwkkkcccsk..',
  '..kccccccccwwwwssscsssk.',
  '..kwccwccccwwwwssssssssk',
  '..kwwwwwwwwwwk.kcssssssk',
  '...kbbbbbbbbk...kkkkkkk.',
  '..kbbbbbbbbk............',
  '.kbbk...kbbk............',
  '.kddk....kddk...........',
  'kddk......kddk..........',
  'kkkk......kkkk..........',
];

// Hero Slash Phase 3: RECOVERY (22 x 18, blade swung forward, weight centered)
export const HERO_SLASH_RECOVER: PixelMatrix = [
  '.......kkkkkk.........',
  '......kccccwsk........',
  '.....kccccccwsk.......',
  '.....kcsssssssk.......',
  '.....kcsksksssk.......',
  '......kcssssssk.......',
  '.......kwwwwwk...kkk..',
  '......kwccwwwwkkkcccsk',
  '.....kwccccwwwwssscssk',
  '.....kwwccwwwwwssssssk',
  '.....kwwwwwwwwwk.kkkk.',
  '......kbbbbbbbk.......',
  '.....kbbk...kbbk......',
  '.....kbbk...kbbk......',
  '.....kddk...kddk......',
  '....kddk.....kddk.....',
  '....kkkk.....kkkk.....',
];

// Hero Aerial Spin Slash (24 x 18, 360-degree mid-air crescent)
export const HERO_AERIAL_SLASH: PixelMatrix = [
  '........kkkkkk..........',
  '.......kccccwsk...kk....',
  '......kccccccwsk.kcck...',
  '......kcssssssskkccck...',
  '......kcsksksssk.kkk....',
  '..kkk..kcssssssk....kkk.',
  '.kcccsk.kwwwwwk..kssscsk',
  'kccccccccwwwwwwsssssssck',
  'kccwccwwwwwwwwssssssssck',
  '.kwwwwwwwwwwwwkkkcsssk..',
  '..kbbbbbbbbbbk...kkkk...',
  '..kbbbb..kbbbk..........',
  '..kddk....kddk..........',
  '...kk......kk...........',
];

// Shield Shatter Glass Debris (flung when player takes damage)
export const SHIELD_SHARD_PAL = {
  k: '#080811',
  c: '#00F0FF',
  w: '#FFFFFF',
  b: '#4A7CFF',
};

export const SHIELD_SHARD_DEBRIS: PixelMatrix = [
  '..kw..',
  '.kcck.',
  'kcccbk',
  '.kcwwk',
  '..kk..',
];

// ================= ENEMY SPRITES =================
// 1. Ground Barricade (16 x 16 hazard obstacle)
export const BARRICADE_PAL = {
  k: '#080811',
  r: '#FF4D3D',
  d: '#8B1E14',
  y: '#FFD166',
  g: '#34384A',
};

export const BARRICADE_FULL: PixelMatrix = [
  '....kkkkkkkk....',
  '...krryyyyrrk...',
  '..krrddrrrddrk..',
  '.krrrddrrrddrrk.',
  '.kyyrrddrrrddyk.',
  'kyyyrrddrrrddyyk',
  'kddyyyrrddrrrddk',
  'krddyyyrrddrrrkk',
  'krrddyyyrrddrrkk',
  'krrrddyyyrrddrrk',
  '.krrrddyyyrrddk.',
  '.krdddyyyyrrddk.',
  '..kdddrrrrdddk..',
  '...kggggggggk...',
  '...kggggggggk...',
  '...kkkkkkkkkk...',
];

export const BARRICADE_DEBRIS_A: PixelMatrix = [
  '..kkkk....',
  '.krryyk...',
  'krrddrk...',
  'kyyrrdk...',
  'kddyyyk...',
  '.kkkkk....',
];

export const BARRICADE_DEBRIS_B: PixelMatrix = [
  '....kkkk..',
  '...kyyrrk.',
  '..kddrrrkk',
  '.kyyrrddrk',
  'kddyyyrrdk',
  '..kkkkkk..',
];

// 2. Aerial Drone (18 x 12 hover flyer)
export const DRONE_PAL = {
  k: '#080811',
  g: '#4A5068',
  w: '#FFFFFF',
  r: '#FF4D3D',
  c: '#00F0FF',
  y: '#FFD166',
};

export const DRONE_IDLE: PixelMatrix = [
  '..kk..........kk..',
  '.kcck........kcck.',
  '..kkggk....kggkk..',
  '..kggggkkkkggggk..',
  '.kgggggwwwwgggggk.',
  'kgggggwrryrwgggggk',
  'kgggggwrryrwgggggk',
  '.kgggggwwwwgggggk.',
  '..kggggkkkkggggk..',
  '...kggk.kk.kggk...',
  '....kk..kk..kk....',
];

// Drone Cyber Bomb (6x6 compact payload)
export const DRONE_BOMB_PAL = {
  k: '#080811',
  r: '#FF4D3D',
  y: '#FFD166',
  w: '#FFFFFF',
  c: '#00F0FF',
};

export const DRONE_BOMB_SPRITE: PixelMatrix = [
  '..kk..',
  '.krrk.',
  'krwwrk',
  'kryyrk',
  '.krrk.',
  '..kk..',
];

// 3. Heavy Shield Walker (20 x 22 armored walker)
export const SHIELD_BOT_PAL = {
  k: '#080811',
  g: '#3B4158',
  m: '#6B728E',
  b: '#4A7CFF',
  c: '#00F0FF',
  w: '#FFFFFF',
};

export const SHIELD_BOT_WALK: PixelMatrix = [
  '......kkkkkkkk......',
  '....kkggmmmmggbb....',
  '...kggmmmmmmmmggbb..',
  '..kggmmmmccmmmmggbb.',
  '..kggmmmccccmmmmggb.',
  '..kggmmmmccmmmmggbb.',
  '.kggmmmmmmmmmmmmggb.',
  '.kgggggggggggggggbk.',
  'kggggkkkkkkkkkkgggbk',
  'kgggkbccccccccbkkggk',
  'kggkbbccccccccbbkggk',
  'kggkbbccccccccbbkggk',
  'kggkbbccccccccbbkggk',
  'kgggkbccccccccbkkggk',
  '.kggggkkkkkkkkkgggk.',
  '..kggggggggggggggk..',
  '...kggk.kggk.kggk...',
  '...kggk.kggk.kggk...',
  '..kggk...kk...kggk..',
  '..kggk........kggk..',
  '..kkkk........kkkk..',
];

// 4. Low Laser Hazard (Emitter box)
export const LASER_HAZARD_PAL = {
  k: '#080811',
  r: '#FF4D3D',
  c: '#00F0FF',
  w: '#FFFFFF',
};

export const LASER_HAZARD_EMITTER: PixelMatrix = [
  '..kkkk..',
  '.krrrrk.',
  'krcwwcrk',
  'krrrrrrk',
  '.kkkkkk.',
];

// 5. Climax Boss: Blind Box Monolith (28 x 28)
export const BOSS_CORE_PAL = {
  k: '#080811',
  m: '#1C1F2E',
  p: '#3A405E',
  r: '#FF4D3D',
  g: '#FFD166',
  c: '#4A7CFF',
  w: '#FFFFFF',
};

export const BOSS_CORE: PixelMatrix = [
  '.......kkkkkkkkkkkkkk.......',
  '.....kkppppppppppppppkk.....',
  '....kppmmmmmmmmmmmmmmppk....',
  '...kppmmmmmmmmmmmmmmmmppk...',
  '..kppmmmmkkkkkkkkmmmmmmppk..',
  '.kppmmmmkrggggggrkmmmmmmppk.',
  '.kppmmmmkrgwwwwgrkmmmmmmppk.',
  'kppmmmmmkrgwrrrwgrkmmmmmmppk',
  'kppmmmmmkrgwrrrwgrkmmmmmmppk',
  'kppmmmmmkrgwwwwgrkmmmmmmppk.',
  'kppmmmmmkrcggggcrkmmmmmmppk.',
  'kppmmmmmkrcggggcrkmmmmmmppk.',
  'kppmmmmmkrcgrrgcrkmmmmmmppk.',
  'kppmmmmmkrcgrrgcrkmmmmmmppk.',
  'kppmmmmmkrcggggcrkmmmmmmppk.',
  'kppmmmmmkrcggggcrkmmmmmmppk.',
  'kppmmmmmkrcwwwwcrkmmmmmmppk.',
  'kppmmmmmkrcwrrwcrkmmmmmmppk.',
  'kppmmmmmkrcwrrwcrkmmmmmmppk.',
  'kppmmmmmkrcwwwwcrkmmmmmmppk.',
  '.kppmmmmkkkkkkkkkmmmmmmppk..',
  '.kppmmmmmmmmmmmmmmmmmmmmppk.',
  '..kppmmmmmmmmmmmmmmmmmmppk..',
  '...kppmmmmmmmmmmmmmmmmppk...',
  '....kppmmmmmmmmmmmmmmppk....',
  '.....kkppppppppppppppkk.....',
  '.......kkkkkkkkkkkkkk.......',
];

// Inspiration Shard
export const SHARD_PAL = {
  k: '#080811',
  b: '#4A7CFF',
  c: '#00F0FF',
  w: '#FFFFFF',
};

export const INSPIRATION_SHARD: PixelMatrix = [
  '..kwk..',
  '.kcwck.',
  'kccbckk',
  '.kccbk.',
  '..kbk..',
];

// ================= SIX RELIC SPRITES (24x24) =================
export const RELIC_01_DECK: PixelMatrix = [
  '........................',
  '........................',
  '.....kkkkkkkkkkkk.......',
  '...kkrrrrrrrrrrrrkk.....',
  '..krrrrrrrrrrrrrrrrk....',
  '.krrrrryyyyyyyyrrrrrk...',
  'krrrrryywwwwwwyyrrrrrk..',
  'krrrryywwwwwwwwyyrrrrk..',
  'krrrrryywwwwwwyyrrrrrk..',
  '.krrrrryyyyyyyyrrrrrk...',
  '..krrrrrrrrrrrrrrrrk....',
  '...kkrrrrrrrrrrrrkk.....',
  '.....kkkkkkkkkkkk.......',
  '.....kggk....kggk.......',
  '....kggggk..kggggk......',
  '....kggggk..kggggk......',
  '.....kggk....kggk.......',
  '......kk......kk........',
];

export const RELIC_02_SHIELD: PixelMatrix = [
  '........kkkkkk..........',
  '......kkcccccckk........',
  '....kkccccccccwwkk......',
  '...kccccccccccccwwk.....',
  '..kcccckkkkkkccccwwk....',
  '..kccckyyyyyykccccwk....',
  '..kcckyyyyyyyykcccwk....',
  '..kcckyyy..yyykcccwk....',
  '..kcckyy....yykcccwk....',
  '..kcckyyyyyyyykcccwk....',
  '..kccckyyyyyykccccwk....',
  '...kcccckkkkccccwwk.....',
  '....kccccccccccwwk......',
  '.....kccccccccwwk.......',
  '......kccccccwwk........',
  '.......kccccwwk.........',
  '........kccwwk..........',
  '.........kwwk...........',
  '..........kk............',
];

export const RELIC_03_METRONOME: PixelMatrix = [
  '..........kk............',
  '.........kppk...........',
  '........kppppk..........',
  '........kppppk..........',
  '.......kppmmppk.........',
  '......kppmmmmppk........',
  '.....kppmmmmmmppk.......',
  '....kppmmmmmmmmppk......',
  '...kppmmmmgygmmmppk.....',
  '..kppmmmmgywygmmmppk....',
  '.kppmmmmmmgygmmmmmppk...',
  'kppmmmmmmmmmmmmmmmmppk..',
  'kppppppppppppppppppppk..',
  'kkkkkkkkkkkkkkkkkkkkkk..',
];

export const RELIC_04_ESPRESSO: PixelMatrix = [
  '......kk......kk........',
  '.....krrk....krrk.......',
  '......kk......kk........',
  '.....kkkkkkkkkk.........',
  '....krrrrrrrrrrk..kkk...',
  '...krrrrrrrrrrrrkkrrrk..',
  '...krrddddddddrrk...rk..',
  '...krrddssssddrrk...rk..',
  '...krrddssssddrrkkrrk...',
  '...krrddddddddrrkkkk....',
  '....krrrrrrrrrrk........',
  '.....krrrrrrrrk.........',
  '......krrrrrrk..........',
  '.......krrrrk...........',
  '......kkkkkkkk..........',
  '....kkrrrrrrrrkk........',
  '....kkkkkkkkkkkk........',
];

export const RELIC_05_STICK: PixelMatrix = [
  '.........kkkk...........',
  '........kyyyyk..........',
  '.......kyywwyyk.........',
  '.......kyywwyyk.........',
  '........kyyyyk..........',
  '.........kkkk...........',
  '..........kk............',
  '..........kk............',
  '..........kk............',
  '..........kk............',
  '......kkkkkkkkkk........',
  '....kkyyyyyyyyyykk......',
  '...kyyyyyyyyyyyyyyk.....',
  '..kyyykkyyyykkkkyyyk....',
  '..kyykkrkkkkrkkkyyyk....',
  '..kyyykkyyyykkkkyyyk....',
  '...kyyyyyyyyyyyyyyk.....',
  '....kkkkkkkkkkkkkk......',
];

export const RELIC_06_CUBE: PixelMatrix = [
  '........kkkkkk..........',
  '......kkccccggkk........',
  '....kkccccccccggkk......',
  '..kkccccccccccccggkk....',
  '..krrrkkkkkkkkkkrrgk....',
  '..krrrkkcccccckkrrgk....',
  '..krrrkkcccccckkrrgk....',
  '..krrrkkcccccckkrrgk....',
  '..krrrkkcccccckkrrgk....',
  '..krrrkkkkkkkkkkrrgk....',
  '..krrrrrrrrrrrrrrrgg....',
  '..krrrrrrrrrrrrrrrgg....',
  '....kkrrrrrrrrrrgg......',
  '......kkrrrrrrgg........',
  '........kkkkkk..........',
];

export const RELIC_SPRITES: Record<string, { matrix: PixelMatrix; palette: Record<string, string> }> = {
  golden_stick: {
    matrix: RELIC_05_STICK,
    palette: { k: '#080811', y: '#FFD166', w: '#FFFFFF', r: '#FF4D3D' },
  },
  quantum_metronome: {
    matrix: RELIC_03_METRONOME,
    palette: { k: '#080811', p: '#7209B7', m: '#3A0CA3', g: '#FFD166', y: '#F72585', w: '#FFFFFF' },
  },
  aegis_shield: {
    matrix: RELIC_02_SHIELD,
    palette: { k: '#080811', c: '#4A7CFF', w: '#FFFFFF', y: '#FFD166' },
  },
  nitro_deck: {
    matrix: RELIC_01_DECK,
    palette: { k: '#080811', r: '#FF4D3D', y: '#FFD166', w: '#FFFFFF', g: '#3B4158' },
  },
  overdrive_espresso: {
    matrix: RELIC_04_ESPRESSO,
    palette: { k: '#080811', r: '#FF4D3D', d: '#540B0E', s: '#9E2A2B', y: '#FFD166' },
  },
  glitch_cube: {
    matrix: RELIC_06_CUBE,
    palette: { k: '#080811', c: '#00F0FF', g: '#06D6A0', r: '#FF4D3D' },
  },
};

// ================= REPAIR BATTERY SPRITE (12x12) =================
// Distinct from blue shards (triangular/diamond) and gold relics
// Pale cyber housing with glowing emerald energy cells
export const BATTERY_PAL = {
  k: '#080811',
  w: '#FFFFFF',
  g: '#06D6A0', // Neon emerald energy core
  c: '#00F0FF', // Cyan rim / anode
  d: '#0B6E4F', // Dark emerald divider
  s: '#E2E8F0', // Pale metallic housing
  a: '#94A3B8', // Shadowed housing
};

export const REPAIR_BATTERY_SPRITE: PixelMatrix = [
  '....kkkk....',
  '...kcccck...',
  '..kwwwwwwk..',
  '.kssssssssk.',
  '.kssggggsssk',
  '.kssggggsssk',
  '.kssddddsssk',
  '.kssggggsssk',
  '.kssggggsssk',
  '.kssaaaasssk',
  '..kssssssk..',
  '...kkkkkk...',
];

export function drawRepairBattery(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  state: 'TELEGRAPH' | 'DROP' | 'AVAILABLE' | 'ATTRACTING',
  time: number,
  targetY?: number
) {
  const sc = scale;

  if (state === 'TELEGRAPH') {
    // Ground arrival telegraph circle firmly on the ground pavement
    const groundTelegraphY = targetY !== undefined ? targetY : y;
    const pulse = 0.5 + 0.5 * Math.sin(time * 16);
    ctx.save();
    ctx.strokeStyle = '#06D6A0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, groundTelegraphY + 2, 12 * sc, 5 * sc, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(6, 214, 160, ${0.15 + pulse * 0.25})`;
    ctx.fill();

    // Cross reticle
    ctx.fillStyle = '#06D6A0';
    ctx.fillRect(x - 6 * sc, groundTelegraphY + 1, 12 * sc, 1);
    ctx.fillRect(x, groundTelegraphY - 3 * sc, 1, 7 * sc);
    ctx.restore();
    return;
  }

  // Floating bob animation during AVAILABLE state
  const bobY = state === 'AVAILABLE' ? Math.sin(time * 6) * 2 * sc : 0;
  const drawY = Math.round(y + bobY);

  // Soft emerald energy aura
  ctx.save();
  const glowGrad = ctx.createRadialGradient(x, drawY, 2, x, drawY, 14 * sc);
  glowGrad.addColorStop(0, 'rgba(6, 214, 160, 0.45)');
  glowGrad.addColorStop(1, 'rgba(6, 214, 160, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(x - 14 * sc, drawY - 14 * sc, 28 * sc, 28 * sc);

  // Draw battery matrix
  drawPixelMatrix(ctx, REPAIR_BATTERY_SPRITE, BATTERY_PAL, Math.round(x - 6 * sc), Math.round(drawY - 6 * sc), sc);
  ctx.restore();
}

// ================= SKAND DYNAMIC FOUR-LAYER PARALLAX CITY =================
// Four independent layers:
// 1. Far (0.10x): Skylines & distant chimneys/towers
// 2. Mid (0.42x): Themed building structures, signages & industrial frameworks
// 3. Road (0.90x): Crisp moving seams, rivets, asphalt cracks & reflections
// 4. Near (1.25x): Sparse low-contrast bollards / lampposts passing below ground every 2-3s

function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (c: string): [number, number, number] => {
    if (c.startsWith('#')) {
      if (c.length === 4) {
        return [
          parseInt(c[1] + c[1], 16),
          parseInt(c[2] + c[2], 16),
          parseInt(c[3] + c[3], 16),
        ];
      }
      if (c.length >= 7) {
        return [
          parseInt(c.slice(1, 3), 16),
          parseInt(c.slice(3, 5), 16),
          parseInt(c.slice(5, 7), 16),
        ];
      }
    }
    return [10, 10, 16];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const clampT = Math.max(0, Math.min(1, t));
  const r = Math.round(r1 + (r2 - r1) * clampT);
  const g = Math.round(g1 + (g2 - g1) * clampT);
  const b = Math.round(b1 + (b2 - b1) * clampT);
  return `rgb(${r},${g},${b})`;
}

interface HoverVehicle {
  x: number;
  y: number;
  speed: number;
  color: string;
  size: number;
}

export class ParallaxCity {
  // Continuous cumulative offsets (never % 1000 to eliminate seam jump artifacts)
  private offsetFar = 0;
  private offsetMid = 0;
  private offsetRoad = 0;
  private offsetNear = 0;

  private currentSpeed = 80;
  private targetSpeed = 80;
  private hitPulseTimer = 0;
  private time = 0;

  // Active theme and optional transition interpolation
  private activeTheme: SceneTheme = STAGES[0].theme;
  private nextTheme: SceneTheme | null = null;
  private transitionP = 1;

  // Sky vehicles
  private vehicles: HoverVehicle[] = [
    { x: 50, y: 35, speed: 45, color: '#00F0FF', size: 3 },
    { x: 180, y: 55, speed: -60, color: '#FF4D3D', size: 2 },
    { x: 290, y: 25, speed: 30, color: '#FFD166', size: 3 },
  ];

  // Stage 1: Rain
  private rainDrops = Array.from({ length: 36 }, () => ({
    x: Math.random() * 800,
    y: Math.random() * 300,
    len: 5 + Math.random() * 5,
    speed: 360 + Math.random() * 100,
  }));

  // Stage 2: Steam puffs
  private steamPuffs = Array.from({ length: 8 }, (_, i) => ({
    x: i * 110 + 40,
    y: 0,
    life: Math.random(),
    maxLife: 1.2 + Math.random() * 0.6,
    radius: 3 + Math.random() * 3,
  }));

  // Stage 3: Highline wind streaks
  private windStreaks = Array.from({ length: 12 }, () => ({
    x: Math.random() * 800,
    y: 20 + Math.random() * 70,
    len: 18 + Math.random() * 24,
    speed: 280 + Math.random() * 120,
  }));

  public setTheme(theme: SceneTheme, nextTheme: SceneTheme | null = null, progress = 1) {
    this.activeTheme = theme;
    this.nextTheme = nextTheme;
    this.transitionP = progress;
  }

  public triggerHitPulse() {
    this.hitPulseTimer = 0.12; // 120ms forward pulse
  }

  public update(dt: number, baseRefSpeed: number, heroVx = 0, isCore = false) {
    this.time += dt;

    if (this.hitPulseTimer > 0) {
      this.hitPulseTimer -= dt;
    }

    // Velocity target calculation:
    // Base ref speed + player forward/backward move nudge + hit pulse
    let desired = baseRefSpeed;
    if (!isCore) {
      if (heroVx > 0) desired += baseRefSpeed * 0.32;
      else if (heroVx < 0) desired -= baseRefSpeed * 0.16;
    }

    if (this.hitPulseTimer > 0) {
      desired += baseRefSpeed * 0.40; // +10% to 15% pulse boost on hit
    }

    // Clamp speed range [10, 180]
    desired = Math.max(10, Math.min(180, desired));
    this.targetSpeed = desired;

    // Smooth speed response using 1 - exp(-dt / tau)
    const tau = this.targetSpeed > this.currentSpeed ? 0.12 : 0.20;
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * (1 - Math.exp(-dt / tau));

    // Continuous float advancement for all 4 layers
    this.offsetFar += this.currentSpeed * 0.10 * dt;
    this.offsetMid += this.currentSpeed * 0.42 * dt;
    this.offsetRoad += this.currentSpeed * 0.90 * dt;
    this.offsetNear += this.currentSpeed * 1.25 * dt;

    // Hover vehicles
    for (const v of this.vehicles) {
      v.x += v.speed * dt;
      if (v.speed > 0 && v.x > 800) v.x = -50;
      if (v.speed < 0 && v.x < -50) v.x = 800;
    }

    // Rain
    if (this.activeTheme.envEffect === 'rain') {
      for (const r of this.rainDrops) {
        r.y += r.speed * dt;
        r.x -= r.speed * 0.22 * dt;
        if (r.y > 450) {
          r.y = -10;
          r.x = Math.random() * 800;
        }
      }
    }

    // Steam puffs
    if (this.activeTheme.envEffect === 'steam') {
      for (const s of this.steamPuffs) {
        s.life += dt;
        if (s.life > s.maxLife) {
          s.life = 0;
          s.radius = 3 + Math.random() * 3;
        }
      }
    }

    // Wind streaks
    if (this.activeTheme.envEffect === 'wind') {
      for (const w of this.windStreaks) {
        w.x -= w.speed * dt;
        if (w.x < -60) {
          w.x = 800 + Math.random() * 100;
          w.y = 20 + Math.random() * 70;
        }
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, width: number, height: number, groundY: number) {
    const inTransition = this.nextTheme !== null && this.transitionP < 1;
    const drawTheme = inTransition && this.transitionP >= 0.5 ? this.nextTheme! : this.activeTheme;

    // 1. Dynamic Cyberpunk Sky Gradient (Smooth color blend during stage handoff)
    const skyGrad = ctx.createLinearGradient(0, -20, 0, groundY);
    if (inTransition && this.nextTheme) {
      skyGrad.addColorStop(0, lerpColor(this.activeTheme.skyGradient[0], this.nextTheme.skyGradient[0], this.transitionP));
      skyGrad.addColorStop(0.55, lerpColor(this.activeTheme.skyGradient[1], this.nextTheme.skyGradient[1], this.transitionP));
      skyGrad.addColorStop(1, lerpColor(this.activeTheme.skyGradient[2], this.nextTheme.skyGradient[2], this.transitionP));
    } else {
      skyGrad.addColorStop(0, drawTheme.skyGradient[0]);
      skyGrad.addColorStop(0.55, drawTheme.skyGradient[1]);
      skyGrad.addColorStop(1, drawTheme.skyGradient[2]);
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-20, -20, width + 40, height + 40);

    // 2. Far Skyline & World City Landmarks (Layer 1: 0.10x)
    this.drawFarSkyline(ctx, width, height, groundY, drawTheme);

    // 3. Iconic Hover vehicles in the night sky (Double-decker / Yellow cab / Maglev train)
    this.drawSkyVehicles(ctx, width, drawTheme);

    // 4. Mid Skyline & Themed Architecture (Layer 2: 0.42x)
    this.drawMidSkyline(ctx, width, height, groundY, drawTheme);

    // 5. Road Surface & Ground Markings (Layer 3: 0.90x)
    this.drawThemedRoad(ctx, width, height, groundY, drawTheme);

    // 6. Near Layer: Sparse Bollards & Low Posts (Layer 4: 1.25x)
    this.drawNearLayer(ctx, width, height, groundY, drawTheme);

    // 7. Atmospheric Environmental FX (Rain / Steam / Wind / Stars / Core)
    this.drawEnvironmentOverlay(ctx, width, groundY, drawTheme);
  }

  private drawSkyVehicles(ctx: CanvasRenderingContext2D, width: number, theme: SceneTheme) {
    for (const v of this.vehicles) {
      const vx = ((v.x % (width + 120)) + width + 120) % (width + 120) - 60;
      const vy = Math.floor(v.y);

      if (theme.cityId === 'london') {
        // Red Double-Decker Hover Bus (London)
        ctx.fillStyle = '#E53E3E';
        ctx.fillRect(Math.floor(vx), vy, 24, 11);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(Math.floor(vx + 3), vy + 2, 4, 2);
        ctx.fillRect(Math.floor(vx + 10), vy + 2, 4, 2);
        ctx.fillRect(Math.floor(vx + 17), vy + 2, 4, 2);
        ctx.fillRect(Math.floor(vx + 3), vy + 6, 4, 2);
        ctx.fillRect(Math.floor(vx + 10), vy + 6, 4, 2);
        ctx.fillRect(Math.floor(vx + 17), vy + 6, 4, 2);
        // Thruster glow
        ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.fillRect(Math.floor(v.speed > 0 ? vx - 6 : vx + 24), vy + 8, 6, 2);
      } else if (theme.cityId === 'newyork') {
        // Yellow Times Square Hover-Cab (New York)
        ctx.fillStyle = '#FFD166';
        ctx.fillRect(Math.floor(vx), vy, 19, 7);
        ctx.fillStyle = '#FF4D3D';
        ctx.fillRect(Math.floor(vx + 7), vy - 2, 5, 2);
        // Checkerboard stripe
        ctx.fillStyle = '#0D0D11';
        ctx.fillRect(Math.floor(vx + 3), vy + 4, 2, 1);
        ctx.fillRect(Math.floor(vx + 7), vy + 4, 2, 1);
        ctx.fillRect(Math.floor(vx + 11), vy + 4, 2, 1);
        ctx.fillRect(Math.floor(vx + 15), vy + 4, 2, 1);
        // Windows
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(Math.floor(vx + 3), vy + 1, 4, 2);
        ctx.fillRect(Math.floor(vx + 9), vy + 1, 6, 2);
        // Thruster
        ctx.fillStyle = 'rgba(255, 77, 61, 0.4)';
        ctx.fillRect(Math.floor(v.speed > 0 ? vx - 6 : vx + 19), vy + 5, 6, 2);
      } else if (theme.cityId === 'shanghai') {
        // Streamlined Maglev Bullet Skytrain (Shanghai)
        ctx.fillStyle = '#F4F6F8';
        ctx.fillRect(Math.floor(vx), vy, 34, 5);
        ctx.fillStyle = '#FF3366';
        ctx.fillRect(Math.floor(vx), vy + 2, 34, 1);
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(Math.floor(vx + 4), vy + 1, 26, 1);
        // High-speed light trail
        ctx.fillStyle = 'rgba(255, 51, 102, 0.35)';
        ctx.fillRect(Math.floor(v.speed > 0 ? vx - 16 : vx + 34), vy + 1, 16, 3);
      } else {
        // High-tech Cyber Speeder (Tokyo / Paris / Core)
        ctx.fillStyle = v.color;
        ctx.fillRect(Math.floor(vx), vy, v.size * 2, v.size);
        ctx.fillStyle = `${v.color}40`;
        ctx.fillRect(Math.floor(v.speed > 0 ? vx - 8 : vx + v.size * 2), vy + 1, 8, 1);
      }
    }
  }

  private drawFarSkyline(ctx: CanvasRenderingContext2D, width: number, height: number, groundY: number, theme: SceneTheme) {
    const buildings = [
      { id: 1, w: 46, h: 95, spire: true, isLandmark: false },
      { id: 2, w: 36, h: 72, spire: false, isLandmark: false },
      { id: 3, w: 78, h: 145, spire: false, isLandmark: true }, // The City Landmark
      { id: 4, w: 42, h: 84, spire: false, isLandmark: false },
      { id: 5, w: 58, h: 115, spire: true, isLandmark: false },
      { id: 6, w: 38, h: 68, spire: false, isLandmark: false },
      { id: 7, w: 64, h: 122, spire: true, isLandmark: false },
      { id: 8, w: 40, h: 88, spire: false, isLandmark: false },
    ];

    const bScale = height > 220 ? Math.min(2.2, height / 200) : 1;
    const totalW = buildings.reduce((s, b) => s + b.w, 0);

    ctx.fillStyle = theme.farBuildingColor;

    // True mathematical modulo alignment eliminating seam jumping
    const normOffset = ((this.offsetFar % totalW) + totalW) % totalW;
    const startX = -normOffset;

    for (let curX = startX - totalW; curX < width + totalW; ) {
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (curX + b.w > -40 && curX < width + 40) {
          if (b.isLandmark) {
            // Draw Distinctive City Landmark
            this.drawCityLandmark(ctx, curX, groundY, bScale, theme);
          } else {
            // Regular Far Skyline High-rise
            const bH = Math.round(b.h * bScale);
            const top = groundY - bH;
            ctx.fillStyle = theme.farBuildingColor;
            ctx.fillRect(Math.floor(curX), top, b.w, bH + 2);

            if (b.spire) {
              ctx.fillStyle = `${theme.farBuildingColor}EE`;
              ctx.fillRect(Math.floor(curX + b.w / 2), top - 14, 1, 14);
              const pulse = (Math.sin(this.time * 4 + i * 2) + 1) / 2;
              ctx.fillStyle = pulse > 0.4 ? theme.accentColor : '#FF4D3D';
              ctx.fillRect(Math.floor(curX + b.w / 2), top - 15, 2, 2);
            }
          }
        }
        curX += b.w;
      }
    }
  }

  // ================= WORLD-FAMOUS CITY LANDMARKS (PIXEL ART) =================
  private drawCityLandmark(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    bScale: number,
    theme: SceneTheme
  ) {
    const cid = theme.cityId;
    const cx = Math.floor(x + 38);

    if (cid === 'tokyo') {
      // TOKYO TOWER
      const h = Math.round(140 * bScale);
      const top = groundY - h;

      // Base Arch & Spread Legs
      ctx.fillStyle = '#1A102E';
      ctx.fillRect(cx - 16, groundY - 26, 32, 26);
      ctx.fillStyle = theme.skyGradient[1];
      ctx.beginPath();
      ctx.arc(cx, groundY, 10, Math.PI, 0);
      ctx.fill();

      // Lower Main Observation Deck
      ctx.fillStyle = '#FF2A6D';
      ctx.fillRect(cx - 13, groundY - 50, 26, 6);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 10, groundY - 48, 20, 2);

      // Upper Observation Deck
      ctx.fillStyle = '#FF2A6D';
      ctx.fillRect(cx - 7, groundY - 84, 14, 5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 5, groundY - 82, 10, 2);

      // Alternating Red & White Lattice Spire Bands
      for (let y = groundY - 50; y > top + 14; y -= 4) {
        const prog = (groundY - 50 - y) / (groundY - 50 - top);
        const halfW = Math.max(1, Math.round(12 * (1 - prog)));
        ctx.fillStyle = Math.floor(y / 8) % 2 === 0 ? '#FF2A6D' : '#FFFFFF';
        ctx.fillRect(cx - halfW, y, halfW * 2, 3);
      }

      // Antenna Spire & Pulsing Red Summit Beacon
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 1, top, 2, 14);
      const beaconPulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      ctx.fillStyle = beaconPulse > 0.4 ? '#FF2A6D' : '#FFFFFF';
      ctx.fillRect(cx - 2, top - 3, 4, 3);

    } else if (cid === 'paris') {
      // EIFFEL TOWER
      const h = Math.round(145 * bScale);
      const top = groundY - h;

      // Base Pillars & Classic Arch
      ctx.fillStyle = '#122033';
      ctx.fillRect(cx - 18, groundY - 32, 36, 32);
      ctx.fillStyle = theme.skyGradient[1];
      ctx.beginPath();
      ctx.arc(cx, groundY, 12, Math.PI, 0);
      ctx.fill();

      // First Platform
      ctx.fillStyle = '#FFD166';
      ctx.fillRect(cx - 15, groundY - 34, 30, 4);

      // Second Platform
      ctx.fillStyle = '#FFD166';
      ctx.fillRect(cx - 9, groundY - 70, 18, 4);

      // Tapering Golden Lattice Tower Shaft
      for (let y = groundY - 34; y > top + 12; y -= 4) {
        const prog = (groundY - 34 - y) / (groundY - 34 - top);
        const halfW = Math.max(1, Math.round(14 * (1 - prog)));
        ctx.fillStyle = '#F4A261';
        ctx.fillRect(cx - halfW, y, halfW * 2, 3);
      }

      // Lantern Cupola & Spire
      ctx.fillStyle = '#FFD166';
      ctx.fillRect(cx - 3, top + 6, 6, 6);
      ctx.fillRect(cx - 1, top, 2, 6);

      // Sweeping Golden Searchlight Beacon in the Night Sky
      const beamAngle = Math.sin(this.time * 0.75) * 0.55;
      ctx.save();
      ctx.translate(cx, top);
      ctx.rotate(beamAngle);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-45, -95);
      ctx.lineTo(45, -95);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

    } else if (cid === 'shanghai') {
      // ORIENTAL PEARL TOWER & SHANGHAI TOWER
      const h = Math.round(145 * bScale);
      const top = groundY - h;

      // Shanghai Tower Spiral Silhouette
      ctx.fillStyle = '#1C0E22';
      ctx.fillRect(cx + 14, groundY - Math.round(135 * bScale), 20, Math.round(135 * bScale));
      ctx.fillStyle = 'rgba(255, 51, 102, 0.25)';
      ctx.fillRect(cx + 18, groundY - Math.round(130 * bScale), 3, Math.round(120 * bScale));

      // Oriental Pearl 3 Support Columns
      ctx.fillStyle = '#220F26';
      ctx.fillRect(cx - 12, groundY - 32, 3, 32);
      ctx.fillRect(cx - 1, groundY - 32, 2, 32);
      ctx.fillRect(cx + 9, groundY - 32, 3, 32);

      // Lower Giant Ruby Sphere (Diameter 16)
      ctx.fillStyle = '#FF3366';
      ctx.beginPath();
      ctx.arc(cx - 1, groundY - 42, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 3, groundY - 44, 4, 3);

      // Connecting Shafts
      ctx.fillStyle = '#33112E';
      ctx.fillRect(cx - 3, groundY - 80, 5, 30);

      // Upper Ruby Sphere (Diameter 12)
      ctx.fillStyle = '#FF3366';
      ctx.beginPath();
      ctx.arc(cx - 1, groundY - 86, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 2, groundY - 88, 3, 2);

      // Top Capsule & Needle Spire
      ctx.fillStyle = '#FFD166';
      ctx.fillRect(cx - 2, groundY - 102, 3, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 1, top, 2, groundY - 102 - top);
      ctx.fillStyle = Math.sin(this.time * 6) > 0 ? '#FF3366' : '#FFFFFF';
      ctx.fillRect(cx - 2, top - 3, 4, 3);

    } else if (cid === 'london') {
      // BIG BEN & LONDON EYE
      const h = Math.round(140 * bScale);
      const top = groundY - h;

      // London Eye Silhouette (Glowing teal wheel positioned on left)
      const eyeX = cx - 14;
      const eyeY = groundY - 48;
      const eyeR = 20;

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
      ctx.stroke();
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(eyeX, eyeY);
        ctx.lineTo(eyeX + Math.cos(a) * eyeR, eyeY + Math.sin(a) * eyeR);
        ctx.stroke();
      }
      ctx.restore();

      // Big Ben Tower (Positioned on right, cleanly framed within landmark width)
      const bx = cx + 12;

      // Big Ben Tower Shaft (Victorian Gothic Brick)
      ctx.fillStyle = '#10222B';
      ctx.fillRect(bx - 9, groundY - 85, 18, 85);
      ctx.fillStyle = '#18303C';
      ctx.fillRect(bx - 8, groundY - 85, 2, 85);
      ctx.fillRect(bx + 6, groundY - 85, 2, 85);

      // Clock Room & Luminous Clock Face
      ctx.fillStyle = '#142C38';
      ctx.fillRect(bx - 10, groundY - 105, 20, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(bx, groundY - 95, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#081218';
      ctx.fillRect(bx, groundY - 98, 1, 4);
      ctx.fillRect(bx, groundY - 95, 3, 1);

      // Gothic Pyramid Roof & Spire Finial
      for (let y = groundY - 105; y > top + 10; y -= 3) {
        const prog = (groundY - 105 - y) / (groundY - 105 - top);
        const halfW = Math.max(1, Math.round(10 * (1 - prog)));
        ctx.fillStyle = '#FF9E00';
        ctx.fillRect(bx - halfW, y, halfW * 2, 2);
      }
      ctx.fillStyle = '#FF9E00';
      ctx.fillRect(bx - 1, top, 2, 10);
      ctx.fillRect(bx - 2, top - 2, 4, 2);

    } else if (cid === 'newyork') {
      // EMPIRE STATE BUILDING & CHRYSLER
      const h = Math.round(148 * bScale);
      const top = groundY - h;

      // Chrysler Building Sunburst Spire (Left of Empire State)
      ctx.fillStyle = '#0F1E32';
      ctx.fillRect(cx - 28, groundY - Math.round(120 * bScale), 16, Math.round(120 * bScale));
      ctx.fillStyle = '#FFD166';
      ctx.fillRect(cx - 26, groundY - Math.round(120 * bScale), 12, 3);
      ctx.fillRect(cx - 24, groundY - Math.round(124 * bScale), 8, 3);
      ctx.fillRect(cx - 22, groundY - Math.round(128 * bScale), 4, 3);
      ctx.fillRect(cx - 21, groundY - Math.round(138 * bScale), 2, 10);

      // Empire State Tier 1 Base
      ctx.fillStyle = '#14253E';
      ctx.fillRect(cx - 16, groundY - 45, 32, 45);

      // Tier 2 Setback
      ctx.fillStyle = '#162C4A';
      ctx.fillRect(cx - 12, groundY - 80, 24, 35);

      // Tier 3 Setback
      ctx.fillStyle = '#1A3356';
      ctx.fillRect(cx - 8, groundY - 110, 16, 30);

      // Mooring Mast & Circular Observation Crown
      ctx.fillStyle = '#FFCC00';
      ctx.fillRect(cx - 5, groundY - 122, 10, 12);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 4, groundY - 118, 8, 2);

      // Antenna Spire & Blinking Red Beacon
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - 1, top, 2, groundY - 122 - top);
      const beaconPulse = Math.sin(this.time * 5) > 0;
      ctx.fillStyle = beaconPulse ? '#FF4D3D' : '#FFCC00';
      ctx.fillRect(cx - 2, top - 3, 4, 3);

    } else {
      // PLANETARY MONOLITH NEXUS
      const h = Math.round(145 * bScale);
      const top = groundY - h;

      ctx.fillStyle = '#1C1528';
      ctx.fillRect(cx - 18, top, 36, h);

      const t = this.time * 8;
      for (let i = -12; i <= 12; i += 6) {
        ctx.fillStyle = ((Math.floor(t + i) % 3 === 0) ? '#FFD166' : '#FF4D3D');
        ctx.fillRect(cx + i, top + 10, 2, h - 20);
      }
      ctx.fillStyle = '#FFD166';
      ctx.fillRect(cx - 6, top - 4, 12, 4);
    }
  }

  private drawMidSkyline(ctx: CanvasRenderingContext2D, width: number, height: number, groundY: number, theme: SceneTheme) {
    const signs = theme.signs && theme.signs.length > 0 ? theme.signs : ['SKAND', 'STUDIO'];

    const buildings = [
      { id: 1, w: 48, h: 82 },
      { id: 2, w: 56, h: 100 },
      { id: 3, w: 46, h: 68 },
      { id: 4, w: 64, h: 110 },
      { id: 5, w: 50, h: 76 },
      { id: 6, w: 46, h: 90 },
      { id: 7, w: 62, h: 104 },
      { id: 8, w: 52, h: 94 },
    ];

    const bScale = height > 220 ? Math.min(2.2, height / 200) : 1;
    const totalW = buildings.reduce((s, b) => s + b.w, 0);

    const normOffset = ((this.offsetMid % totalW) + totalW) % totalW;
    const startX = -normOffset;

    for (let curX = startX - totalW; curX < width + totalW; ) {
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (curX + b.w > -40 && curX < width + 40) {
          const bH = Math.round(b.h * bScale);
          const top = groundY - bH;

          // Building Body
          ctx.fillStyle = theme.midBuildingColor;
          ctx.fillRect(Math.floor(curX), top, b.w, bH);

          // Subtle side highlight
          ctx.fillStyle = `${theme.accentColor}25`;
          ctx.fillRect(Math.floor(curX), top, 1, bH);
          ctx.fillRect(Math.floor(curX + b.w - 1), top, 1, bH);

          // City-Specific Architectural Features
          if (theme.cityId === 'tokyo') {
            // Tokyo: Japanese roof gables / Pagoda eaves
            ctx.fillStyle = '#2A103D';
            ctx.fillRect(Math.floor(curX - 3), top - 3, b.w + 6, 3);
            ctx.fillStyle = theme.accentColor;
            ctx.fillRect(Math.floor(curX - 4), top - 4, 3, 2);
            ctx.fillRect(Math.floor(curX + b.w + 1), top - 4, 3, 2);
          } else if (theme.cityId === 'paris') {
            // Paris: Classic Mansard slate roofs with attic dormer windows
            ctx.fillStyle = '#18263E';
            ctx.fillRect(Math.floor(curX + 2), top - 8, b.w - 4, 8);
            ctx.fillStyle = '#FFD166';
            ctx.fillRect(Math.floor(curX + 8), top - 6, 6, 6);
            if (b.w > 48) ctx.fillRect(Math.floor(curX + b.w - 14), top - 6, 6, 6);
          } else if (theme.cityId === 'shanghai') {
            // Shanghai: Bund Art-Deco stepped stone crown & high-tech neon spire
            ctx.fillStyle = '#220D28';
            ctx.fillRect(Math.floor(curX + 4), top - 6, b.w - 8, 6);
            ctx.fillStyle = theme.accentColor;
            ctx.fillRect(Math.floor(curX + b.w / 2 - 1), top - 12, 2, 6);
            ctx.fillRect(Math.floor(curX + b.w / 2 - 2), top - 13, 4, 2);
          } else if (theme.cityId === 'london') {
            // London: Victorian brick chimneys with rising smoke wisps
            ctx.fillStyle = '#1A3340';
            ctx.fillRect(Math.floor(curX + 6), top - 12, 5, 12);
            ctx.fillRect(Math.floor(curX + 13), top - 10, 4, 10);
          } else if (theme.cityId === 'newyork') {
            // New York: Exterior metal fire escapes on building facades
            ctx.strokeStyle = 'rgba(255, 204, 0, 0.35)';
            ctx.lineWidth = 1;
            for (let fy = top + 20; fy < groundY - 15; fy += 20) {
              ctx.strokeRect(Math.floor(curX + 3), fy, 10, 4);
              ctx.beginPath();
              ctx.moveTo(Math.floor(curX + 13), fy);
              ctx.lineTo(Math.floor(curX + 3), fy + 16);
              ctx.stroke();
            }
          }

          // Deterministic steady window lighting (tied strictly to building id & window grid)
          for (let wy = top + 14; wy < groundY - 10; wy += 10) {
            for (let wx = 8; wx < b.w - 8; wx += 8) {
              const hash = Math.sin(b.id * 71.3 + wx * 19.1 + wy * 31.7);
              if (hash > 0.40) {
                ctx.fillStyle = hash > 0.85 ? theme.accentColor : 'rgba(255, 255, 255, 0.22)';
                ctx.fillRect(Math.floor(curX + wx), Math.floor(wy), 3, 4);
              }
            }
          }

          // Authentic City Neon Signs
          const signText = signs[i % signs.length];
          const signColor = theme.signPalette[i % theme.signPalette.length] || '#FFFFFF';

          const signY = top + 12;
          const signH = 15;
          const signW = Math.min(b.w - 6, Math.max(34, signText.length * 9 + 8));
          const signX = Math.floor(curX + (b.w - signW) / 2);

          ctx.fillStyle = 'rgba(8, 8, 16, 0.90)';
          ctx.fillRect(signX, signY, signW, signH);
          ctx.strokeStyle = `${signColor}88`;
          ctx.lineWidth = 1;
          ctx.strokeRect(signX, signY, signW, signH);

          ctx.fillStyle = signColor;
          ctx.font = 'bold 8px Silkscreen, "PingFang SC", "Microsoft YaHei", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(signText, Math.floor(curX + b.w / 2), signY + 11);
        }
        curX += b.w;
      }
    }
  }

  private drawThemedRoad(ctx: CanvasRenderingContext2D, width: number, height: number, groundY: number, theme: SceneTheme) {
    const roadH = height - groundY;

    // Road base gradient
    const roadGrad = ctx.createLinearGradient(0, groundY, 0, height + 20);
    roadGrad.addColorStop(0, theme.roadBaseGrad[0]);
    roadGrad.addColorStop(0.45, theme.roadBaseGrad[1]);
    roadGrad.addColorStop(1, theme.roadBaseGrad[2]);
    ctx.fillStyle = roadGrad;
    ctx.fillRect(-20, groundY, width + 40, roadH + 20);

    // Curb edge neon strip
    ctx.fillStyle = theme.curbColor;
    ctx.fillRect(-20, groundY, width + 40, 1);
    ctx.fillStyle = `${theme.curbColor}33`;
    ctx.fillRect(-20, groundY + 1, width + 40, 2);

    // Layer 3 (0.90x): Crisp, continuous road surface markings
    const step = 45;
    const normRoadOffset = ((this.offsetRoad % step) + step) % step;
    const startX = -normRoadOffset;

    ctx.fillStyle = theme.roadMarkColor;
    for (let rx = startX - step; rx < width + step; rx += step) {
      if (theme.roadType === 'wet_asphalt') {
        // Tokyo: Wet asphalt reflective dashes
        ctx.fillRect(Math.floor(rx), groundY + 4, 18, 2);
        ctx.fillRect(Math.floor(rx + 6), groundY + 9, 12, 1);
      } else if (theme.roadType === 'parisian_stone') {
        // Paris: Elegant cut stone paving joints
        ctx.fillRect(Math.floor(rx), groundY + 3, 28, 2);
        ctx.fillRect(Math.floor(rx + 14), groundY + 8, 2, roadH - 10);
      } else if (theme.roadType === 'neon_conduits') {
        // Shanghai: Dual power conduits embedded in polished granite
        ctx.fillRect(Math.floor(rx), groundY + 3, 24, 2);
        ctx.fillRect(Math.floor(rx + 4), groundY + 7, 16, 2);
      } else if (theme.roadType === 'cobblestone') {
        // London: Wet rounded cobblestones
        ctx.fillRect(Math.floor(rx), groundY + 3, 14, 2);
        ctx.fillRect(Math.floor(rx + 8), groundY + 7, 14, 2);
      } else if (theme.roadType === 'steel_plates') {
        // New York: Subway ventilation grates & diamond steel plates
        ctx.fillRect(Math.floor(rx), groundY + 2, 2, roadH - 4);
        ctx.fillRect(Math.floor(rx + 6), groundY + 5, 2, 2);
        ctx.fillRect(Math.floor(rx + 6), groundY + 11, 2, 2);
      } else {
        // Core: Golden hex energy platform
        ctx.fillRect(Math.floor(rx), groundY + 4, 26, 2);
        ctx.fillRect(Math.floor(rx + 12), groundY + 7, 6, 2);
      }
    }
  }

  private drawNearLayer(ctx: CanvasRenderingContext2D, width: number, height: number, groundY: number, theme: SceneTheme) {
    // Layer 4 (1.25x): Sparse low-contrast bollards & street furniture
    const bollardStep = 160;
    const normNearOffset = ((this.offsetNear % bollardStep) + bollardStep) % bollardStep;
    const startX = -normNearOffset;

    for (let bx = startX - bollardStep; bx < width + bollardStep; bx += bollardStep) {
      const px = Math.floor(bx);
      const py = groundY + 4;

      if (theme.cityId === 'paris' || theme.cityId === 'london') {
        // Vintage street gaslamp post
        ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
        ctx.fillRect(px + 2, py, 3, 16);
        ctx.fillStyle = theme.accentColor;
        ctx.fillRect(px + 1, py + 1, 5, 3);
      } else {
        // Cyber bollard
        ctx.fillStyle = 'rgba(10, 10, 18, 0.75)';
        ctx.fillRect(px, py, 6, 12);
        ctx.fillStyle = `${theme.accentColor}44`;
        ctx.fillRect(px + 1, py + 1, 4, 2);
      }
    }
  }

  private drawEnvironmentOverlay(ctx: CanvasRenderingContext2D, width: number, groundY: number, theme: SceneTheme) {
    // Stage 1 & 3: Rain (Tokyo & Shanghai)
    if (theme.envEffect === 'rain') {
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const r of this.rainDrops) {
        const rx = (r.x % (width + 60)) - 30;
        ctx.moveTo(rx, r.y);
        ctx.lineTo(rx - r.len * 0.22, r.y + r.len);
      }
      ctx.stroke();
    }

    // Stage 2: Shimmering Stars (Paris)
    if (theme.envEffect === 'stars') {
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 47) % width);
        const sy = 12 + ((i * 29) % Math.round(groundY * 0.55));
        const pulse = 0.4 + 0.6 * Math.sin(this.time * 3 + i);
        ctx.fillStyle = `rgba(255, 209, 102, ${pulse * 0.45})`;
        ctx.fillRect(Math.floor(sx), Math.floor(sy), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
      }
    }

    // Stage 4: Industrial Thames Steam puffs (London)
    if (theme.envEffect === 'steam') {
      ctx.fillStyle = 'rgba(230, 220, 200, 0.08)';
      for (const s of this.steamPuffs) {
        const sx = ((s.x % (width + 80)) + width + 80) % (width + 80) - 40;
        const progress = s.life / s.maxLife;
        const rad = s.radius * (1 + progress * 1.5);
        const sy = groundY - progress * 24;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Stage 5: Manhattan High-Rise Wind streaks (New York)
    if (theme.envEffect === 'wind') {
      ctx.strokeStyle = 'rgba(180, 230, 240, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const w of this.windStreaks) {
        const wx = ((w.x % (width + 80)) + width + 80) % (width + 80) - 40;
        ctx.moveTo(wx, w.y);
        ctx.lineTo(wx - w.len, w.y);
      }
      ctx.stroke();
    }

    // Stage 6: Planetary Monolith Nexus Data Particles (Neo-Core)
    if (theme.envEffect === 'core_pulse') {
      for (let i = 0; i < 20; i++) {
        const dx = ((i * 37 + this.time * 24) % (width + 40)) - 20;
        const progress = ((this.time * 0.7 + i * 0.17) % 1);
        const dy = groundY - progress * (groundY * 0.75);
        const col = i % 2 === 0 ? 'rgba(255, 209, 102, 0.30)' : 'rgba(255, 77, 61, 0.30)';
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(dx), Math.floor(dy), 2, 4);
      }
    }
  }
}

