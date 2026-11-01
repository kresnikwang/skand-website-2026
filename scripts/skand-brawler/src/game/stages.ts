// Stage Configurations, Themes, and Wave Orchestration
// Global Megacity Endless Progression System + Climax Core Boss Duels

export type StageId = 'tokyo' | 'paris' | 'shanghai' | 'london' | 'newyork' | 'core';
export type CityId = StageId;

export type RoadType =
  | 'wet_asphalt'
  | 'parisian_stone'
  | 'neon_conduits'
  | 'cobblestone'
  | 'steel_plates'
  | 'core_platform';

export interface SceneTheme {
  cityId: CityId;
  nameZh: string;
  nameEn: string;
  landmarkZh: string;
  landmarkEn: string;
  skyGradient: [string, string, string]; // Top, Mid, Horizon
  farBuildingColor: string;
  midBuildingColor: string;
  accentColor: string;
  signPalette: string[];
  signs: string[];
  roadBaseGrad: [string, string, string];
  curbColor: string;
  roadMarkColor: string;
  roadType: RoadType;
  envEffect: 'rain' | 'steam' | 'wind' | 'stars' | 'core_pulse';
  ambientFxId?: string;
}

export type EnemySpawnAction = 'BARRICADE' | 'DRONE' | 'SHIELD_BOT' | 'LASER_GRID';

export interface WaveStep {
  actions: Array<{ type: EnemySpawnAction; delayAfter: number }>;
}

export interface StageConfig {
  id: StageId;
  stageNumber: number; // 1, 2, 3, 4, 5, 6...
  loop: number; // 1, 2, 3...
  subIndex: number; // 1 to 6
  titleZh: string;
  subtitleZh: string;
  bannerName: string;
  scrollScreensPerSecond: number;
  theme: SceneTheme;
  targetCount: number; // Targets needed to clear stage
  bossHp?: number;
  waves: WaveStep[];
  ambientFxId?: string;
}

// Six Curated World City & Cyber Core Themes
export const BASE_THEMES: Record<StageId, SceneTheme> = {
  tokyo: {
    cityId: 'tokyo',
    nameZh: 'TOKYO · SHINJUKU NIGHT',
    nameEn: 'TOKYO · SHINJUKU NIGHT',
    landmarkZh: 'TOKYO TOWER',
    landmarkEn: 'Tokyo Tower Lattice Spire',
    skyGradient: ['#05030C', '#120824', '#28103C'],
    farBuildingColor: '#0E0A1E',
    midBuildingColor: '#1A102E',
    accentColor: '#FF2A6D',
    signPalette: ['#FF2A6D', '#00F0FF', '#FFD166', '#05FFA1'],
    signs: ['NEO-TOKYO', 'RAMEN', 'CYBER', 'SKAND', 'SHINJUKU', '2026', 'IZAKAYA', 'SHIBUYA'],
    roadBaseGrad: ['#090714', '#110C22', '#080510'],
    curbColor: '#FF2A6D',
    roadMarkColor: 'rgba(255, 42, 109, 0.45)',
    roadType: 'wet_asphalt',
    envEffect: 'rain',
  },
  paris: {
    cityId: 'paris',
    nameZh: 'PARIS · SEINE NIGHT GLOW',
    nameEn: 'PARIS · SEINE NIGHT GLOW',
    landmarkZh: 'EIFFEL TOWER',
    landmarkEn: 'Eiffel Tower Beacon Beam',
    skyGradient: ['#03050F', '#091428', '#18263E'],
    farBuildingColor: '#0B1422',
    midBuildingColor: '#122033',
    accentColor: '#FFD166',
    signPalette: ['#FFD166', '#4A7CFF', '#F4A261', '#E0FBFC'],
    signs: ['PARIS', 'METRO', 'CAFÉ', 'SKAND', 'LUMIÈRE', 'SEINE', 'BISTRO', '2026'],
    roadBaseGrad: ['#0B121C', '#121C2A', '#080C14'],
    curbColor: '#FFD166',
    roadMarkColor: 'rgba(255, 209, 102, 0.40)',
    roadType: 'parisian_stone',
    envEffect: 'stars',
  },
  shanghai: {
    cityId: 'shanghai',
    nameZh: 'SHANGHAI · THE BUND & LIFT',
    nameEn: 'SHANGHAI · THE BUND & LIFT',
    landmarkZh: 'ORIENTAL PEARL',
    landmarkEn: 'Oriental Pearl & Shanghai Tower',
    skyGradient: ['#05030A', '#1A081C', '#330E30'],
    farBuildingColor: '#180B1C',
    midBuildingColor: '#28112C',
    accentColor: '#FF3366',
    signPalette: ['#FF3366', '#00F0FF', '#FFD166', '#7000FF'],
    signs: ['THE BUND', 'PUDONG', 'SHANGHAI', 'SKAND', 'NANJING RD', '2026', 'TOWER', 'LIFT'],
    roadBaseGrad: ['#120914', '#1C0E20', '#0C060E'],
    curbColor: '#FF3366',
    roadMarkColor: 'rgba(255, 51, 102, 0.45)',
    roadType: 'neon_conduits',
    envEffect: 'rain',
  },
  london: {
    cityId: 'london',
    nameZh: 'LONDON · THAMES MIST',
    nameEn: 'LONDON · THAMES MIST',
    landmarkZh: 'BIG BEN & LONDON EYE',
    landmarkEn: 'Big Ben & London Eye',
    skyGradient: ['#03090C', '#071820', '#102832'],
    farBuildingColor: '#0A171E',
    midBuildingColor: '#122630',
    accentColor: '#FF9E00',
    signPalette: ['#FF9E00', '#00F0FF', '#FF4D3D', '#E2E8F0'],
    signs: ['LONDON', 'THAMES', 'BIG BEN', 'SKAND', 'PUNK', 'SOHO', '2026', 'SUBWAY'],
    roadBaseGrad: ['#0A141A', '#101F28', '#060D12'],
    curbColor: '#FF9E00',
    roadMarkColor: 'rgba(255, 158, 0, 0.40)',
    roadType: 'cobblestone',
    envEffect: 'steam',
  },
  newyork: {
    cityId: 'newyork',
    nameZh: 'NEW YORK · TIMES SQUARE',
    nameEn: 'NEW YORK · TIMES SQUARE',
    landmarkZh: 'EMPIRE STATE',
    landmarkEn: 'Empire State Art-Deco Spire',
    skyGradient: ['#02050E', '#081226', '#142442'],
    farBuildingColor: '#091322',
    midBuildingColor: '#102035',
    accentColor: '#FFCC00',
    signPalette: ['#FFCC00', '#00F0FF', '#FF4D3D', '#3A86FF'],
    signs: ['NY 24/7', 'TIMES SQ', 'BROADWAY', 'SKAND', '5TH AVE', 'TAXI', '2026', 'MANHATTAN'],
    roadBaseGrad: ['#08101C', '#0E1A2C', '#060B14'],
    curbColor: '#FFCC00',
    roadMarkColor: 'rgba(255, 204, 0, 0.45)',
    roadType: 'steel_plates',
    envEffect: 'wind',
  },
  core: {
    cityId: 'core',
    nameZh: 'NEO-CORE · MONOLITH',
    nameEn: 'NEO-CORE · MONOLITH',
    landmarkZh: 'PLANETARY NEXUS',
    landmarkEn: 'Planetary Monolith Nexus',
    skyGradient: ['#06060A', '#100C16', '#1C1224'],
    farBuildingColor: '#16131F',
    midBuildingColor: '#251E33',
    accentColor: '#FFD166',
    signPalette: ['#FFD166', '#FF4D3D'],
    signs: ['CORE 01', 'CRITICAL', 'OVERRIDE', 'SKAND', 'SYSTEM', 'ACTIVE', '2026', 'BREACH'],
    roadBaseGrad: ['#12101A', '#1A1624', '#0D0B14'],
    curbColor: '#FFD166',
    roadMarkColor: 'rgba(255, 209, 102, 0.45)',
    roadType: 'core_platform',
    envEffect: 'core_pulse',
  },
};

// Curated Wave Patterns with distinct combat rhythm for each world city
const WAVES_TOKYO: WaveStep[] = [
  { actions: [{ type: 'BARRICADE', delayAfter: 1.2 }] },
  { actions: [{ type: 'BARRICADE', delayAfter: 2.0 }] },
  { actions: [{ type: 'LASER_GRID', delayAfter: 1.3 }] },
  { actions: [{ type: 'LASER_GRID', delayAfter: 2.1 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.3 }] },
  { actions: [{ type: 'BARRICADE', delayAfter: 1.1 }, { type: 'LASER_GRID', delayAfter: 2.3 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.2 }, { type: 'BARRICADE', delayAfter: 2.4 }] },
];

const WAVES_PARIS: WaveStep[] = [
  { actions: [{ type: 'DRONE', delayAfter: 1.3 }] },
  { actions: [{ type: 'BARRICADE', delayAfter: 1.2 }, { type: 'DRONE', delayAfter: 2.2 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.1 }, { type: 'DRONE', delayAfter: 2.3 }] },
  { actions: [{ type: 'LASER_GRID', delayAfter: 1.2 }, { type: 'DRONE', delayAfter: 2.4 }] },
  { actions: [{ type: 'BARRICADE', delayAfter: 1.0 }, { type: 'BARRICADE', delayAfter: 2.2 }] },
];

const WAVES_SHANGHAI: WaveStep[] = [
  { actions: [{ type: 'SHIELD_BOT', delayAfter: 1.4 }] },
  { actions: [{ type: 'LASER_GRID', delayAfter: 1.2 }, { type: 'SHIELD_BOT', delayAfter: 2.4 }] },
  { actions: [{ type: 'BARRICADE', delayAfter: 1.1 }, { type: 'SHIELD_BOT', delayAfter: 2.3 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.3 }, { type: 'SHIELD_BOT', delayAfter: 2.5 }] },
  { actions: [{ type: 'LASER_GRID', delayAfter: 1.1 }, { type: 'DRONE', delayAfter: 2.3 }] },
];

const WAVES_LONDON: WaveStep[] = [
  { actions: [{ type: 'SHIELD_BOT', delayAfter: 1.3 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.2 }, { type: 'SHIELD_BOT', delayAfter: 2.3 }] },
  { actions: [{ type: 'LASER_GRID', delayAfter: 1.2 }, { type: 'BARRICADE', delayAfter: 2.2 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.1 }, { type: 'DRONE', delayAfter: 2.2 }] },
  { actions: [{ type: 'SHIELD_BOT', delayAfter: 1.2 }, { type: 'LASER_GRID', delayAfter: 2.4 }] },
];

const WAVES_NEWYORK: WaveStep[] = [
  { actions: [{ type: 'BARRICADE', delayAfter: 1.0 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.1 }, { type: 'BARRICADE', delayAfter: 2.0 }] },
  { actions: [{ type: 'SHIELD_BOT', delayAfter: 1.2 }, { type: 'LASER_GRID', delayAfter: 2.2 }] },
  { actions: [{ type: 'DRONE', delayAfter: 1.0 }, { type: 'DRONE', delayAfter: 1.8 }] },
  { actions: [{ type: 'BARRICADE', delayAfter: 1.0 }, { type: 'SHIELD_BOT', delayAfter: 2.3 }] },
  { actions: [{ type: 'LASER_GRID', delayAfter: 1.1 }, { type: 'DRONE', delayAfter: 2.1 }] },
];

// Dynamic Infinite World City Stage Generator
export function getStageConfig(stageNumber: number): StageConfig {
  const num = Math.max(1, stageNumber);
  const loop = Math.floor((num - 1) / 6) + 1;
  const subIndex = ((num - 1) % 6) + 1; // 1 to 6

  const speedScale = 1 + (loop - 1) * 0.08;

  switch (subIndex) {
    case 1:
      return {
        id: 'tokyo',
        stageNumber: num,
        loop,
        subIndex: 1,
        titleZh: loop > 1 ? `TOKYO · SHINJUKU (LOOP ${loop})` : 'TOKYO · SHINJUKU',
        subtitleZh: 'TOKYO TOWER // NEON RAIN // WET ASPHALT',
        bannerName: `STAGE 0${num} // TOKYO`,
        scrollScreensPerSecond: 0.25 * speedScale,
        theme: BASE_THEMES.tokyo,
        targetCount: 7 + (loop - 1) * 2,
        waves: WAVES_TOKYO,
      };

    case 2:
      return {
        id: 'paris',
        stageNumber: num,
        loop,
        subIndex: 2,
        titleZh: loop > 1 ? `PARIS · SEINE (LOOP ${loop})` : 'PARIS · SEINE',
        subtitleZh: 'EIFFEL BEACON // HAUSSMANN NIGHT // STARRY SKY',
        bannerName: `STAGE 0${num} // PARIS`,
        scrollScreensPerSecond: 0.28 * speedScale,
        theme: BASE_THEMES.paris,
        targetCount: 8 + (loop - 1) * 2,
        waves: WAVES_PARIS,
      };

    case 3:
      return {
        id: 'shanghai',
        stageNumber: num,
        loop,
        subIndex: 3,
        titleZh: loop > 1 ? `SHANGHAI · THE BUND (LOOP ${loop})` : 'SHANGHAI · THE BUND',
        subtitleZh: 'ORIENTAL PEARL // LIFT TRANSIT // NEON CONDUITS',
        bannerName: `STAGE 0${num} // SHANGHAI`,
        scrollScreensPerSecond: 0.31 * speedScale,
        theme: BASE_THEMES.shanghai,
        targetCount: 9 + (loop - 1) * 2,
        waves: WAVES_SHANGHAI,
      };

    case 4:
      return {
        id: 'london',
        stageNumber: num,
        loop,
        subIndex: 4,
        titleZh: loop > 1 ? `LONDON · THAMES (LOOP ${loop})` : 'LONDON · THAMES',
        subtitleZh: 'BIG BEN & LONDON EYE // INDUSTRIAL STEAM // COBBLESTONE',
        bannerName: `STAGE 0${num} // LONDON`,
        scrollScreensPerSecond: 0.33 * speedScale,
        theme: BASE_THEMES.london,
        targetCount: 10 + (loop - 1) * 2,
        waves: WAVES_LONDON,
      };

    case 5:
      return {
        id: 'newyork',
        stageNumber: num,
        loop,
        subIndex: 5,
        titleZh: loop > 1 ? `NEW YORK · TIMES SQ (LOOP ${loop})` : 'NEW YORK · TIMES SQ',
        subtitleZh: 'EMPIRE STATE // CYBER BILLBOARDS // HIGHWAY WIND',
        bannerName: `STAGE 0${num} // NEW YORK`,
        scrollScreensPerSecond: 0.35 * speedScale,
        theme: BASE_THEMES.newyork,
        targetCount: 11 + (loop - 1) * 2,
        waves: WAVES_NEWYORK,
      };

    case 6:
    default:
      // Climax Boss Monolith Core (Every 6th stage)
      return {
        id: 'core',
        stageNumber: num,
        loop,
        subIndex: 6,
        titleZh: loop > 1 ? `NEO-CORE · PROTO-BOSS (LOOP ${loop})` : 'NEO-CORE · PROTO-BOSS',
        subtitleZh: 'PLANETARY NEXUS // ROGUE PROTO-CORE // CLIMAX DUEL',
        bannerName: `STAGE 0${num} // PROTO-CORE (BOSS)`,
        scrollScreensPerSecond: 0.04,
        theme: BASE_THEMES.core,
        targetCount: 1, // Destroy Boss Core to clear
        bossHp: 18 + (loop - 1) * 6,
        waves: [],
      };
  }
}

// Backward compatibility array
export const STAGES: StageConfig[] = [
  getStageConfig(1),
  getStageConfig(2),
  getStageConfig(3),
  getStageConfig(4),
  getStageConfig(5),
  getStageConfig(6),
];

export function getStageForTime(gameTimer: number): StageConfig {
  if (gameTimer >= 100) return STAGES[5];
  if (gameTimer >= 80) return STAGES[4];
  if (gameTimer >= 60) return STAGES[3];
  if (gameTimer >= 40) return STAGES[2];
  if (gameTimer >= 20) return STAGES[1];
  return STAGES[0];
}

export function getStageTransitionInfo(gameTimer: number) {
  const currentStage = getStageForTime(gameTimer);
  return {
    inTransition: false,
    progress: 1,
    fromTheme: currentStage.theme,
    toTheme: currentStage.theme,
    currentStage,
  };
}
