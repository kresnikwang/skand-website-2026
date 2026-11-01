// Game Specifications, Palettes, Relics, and Combat Tuning

export const PALETTE = {
  bgDark: '#0D0D11',
  bgMidnight: '#141824',
  coral: '#FF4D3D',
  electricBlue: '#4A7CFF',
  white: '#F4F6F8',
  critGold: '#FFD166',
  purple: '#9D4EDD',
  neonGreen: '#06D6A0',
  darkGrey: '#2A2C38',
  midGrey: '#5B6075',
  lightGrey: '#9EA4B8',
};

export interface GameDimensions {
  width: number;
  height: number;
  heroX: number;
  heroY: number;
  groundY: number;
  isPortrait: boolean;
  scale: number;
}

export function computeDynamicDimensions(vw: number, vh: number): GameDimensions {
  const aspect = vw / vh;
  if (aspect >= 1) {
    // Landscape / Desktop: target height 200px
    const h = 200;
    const w = Math.max(320, Math.round(h * aspect));
    // Ground line at ~75% of screen height
    const groundY = Math.round(h * 0.75);
    const heroX = Math.round(w * 0.28);
    return {
      width: w,
      height: h,
      heroX,
      heroY: groundY - 2,
      groundY,
      isPortrait: false,
      scale: 1, // 1x crisp pixel scale
    };
  } else {
    // Portrait / Mobile: target width 190px for bold, legible arcade brawler sizing
    const w = 190;
    const h = Math.round(w / aspect);
    // Ground line raised to 72% of screen height, leaving bottom 28% for touch controls
    const groundY = Math.round(h * 0.72);
    const heroX = Math.round(w * 0.28);
    return {
      width: w,
      height: h,
      heroX,
      heroY: groundY - 2,
      groundY,
      isPortrait: true,
      scale: 1.6, // 1.6x bold enlarged characters & enemies in portrait
    };
  }
}

export const COMBAT_PARAMS = {
  // Movement & Jump Kinematics
  heroSpeed: 140, // px/s
  gravity: 800, // px/s^2
  jumpForce: -300, // px/s
  // Sweet spot range for learnable precision crits (outer blade tip region: 24px - 36px)
  sweetSpotMinDist: 24, // px from hero center to obstacle center
  sweetSpotMaxDist: 36, // px (outer blade tip)
  // Timing windows
  inputBufferDuration: 0.14, // 140ms input buffer for jump/attack
  attackStartupDuration: 0.03, // 30ms startup
  attackActiveDuration: 0.08, // 80ms active hitbox window
  attackRecoveryDuration: 0.08, // 80ms recovery
  invulnerabilityDuration: 0.85, // 850ms i-frames after taking damage
  comboDecayGracePeriod: 3.0, // 3.0s before combo decays
  // Hitstop & Shake Tiers
  hitStopLight: 0.025, // 25ms normal hit
  hitStopMedium: 0.055, // 55ms crit / guard break / aerial kill
  hitStopHeavy: 0.08, // 80ms boss / finish
  shakeLight: 0.06, // 60ms
  shakeMedium: 0.09, // 90ms
  shakeHeavy: 0.14, // 140ms
  // Game progression
  totalGameTime: 75, // seconds
  bossPhaseStart: 68, // seconds
  bossMaxHp: 20, // Hits required to defeat boss within 7 seconds
  initialShields: 3,
  maxShields: 3,

  // Repair Battery Supply Mechanics
  repairTelegraphDuration: 0.35, // 350ms ground target telegraph before drop
  repairDropDuration: 0.25, // 250ms descent from sky
  repairLifespan: 6.0, // 6.0s on the ground before disappearing
  repairHealAmount: 1, // Restores 1 shield grid (max 3)
  repairFullShieldScore: 250, // +250 points when collected at full 3 shields
  hitPropulsionDuration: 0.12, // 120ms background speed surge on hit
  hitPropulsionBoost: 0.10, // +0.10 screen-width/s during pulse
};

// Single source of truth for weapon evolution tier based on combo count
// Tuned to 4 / 10 / 18 / 28 thresholds so skilled players can achieve Tier 5 Overdrive during regular waves!
export function computeWeaponLevel(combo: number): number {
  if (combo >= 28) return 5; // SKAND OVERDRIVE: Extended shockwave cleave + Overdrive aura
  if (combo >= 18) return 4; // Cyber Light Blade: Extended reach
  if (combo >= 10) return 3; // Coral Flame Blade: One-hit instant shield break!
  if (combo >= 4) return 2; // Steel Blue Lightning: Faster rhythm + electric glow
  return 1; // Basic Cyber Blade
}

export interface RelicConfig {
  id: string;
  number: string;
  name: string;
  enName: string;
  titleZh: string;
  titleEn: string;
  quoteZh: string;
  unlockConditionZh: string;
  primaryFx: string;
  secondaryFx: string;
  palette: string[];
}

export const RELICS: RelicConfig[] = [
  {
    id: 'golden_stick',
    number: '#01',
    name: 'Golden Stick',
    enName: 'Golden Stick',
    titleZh: 'UNTOUCHABLE ACE',
    titleEn: 'UNTOUCHABLE ACE',
    quoteZh: 'Strike like tempest, defend like iron. Zero shield lost against Rogue Proto-Core.',
    unlockConditionZh: 'Flawless run (3/3 Shields) & defeat Rogue Proto-Core',
    primaryFx: 'holy/sunburst',
    secondaryFx: 'pickups/collect-burst',
    palette: ['#0D0D11', '#8F6B00', '#D4AF37', '#FFD166', '#FFFFFF'],
  },
  {
    id: 'quantum_metronome',
    number: '#02',
    name: 'Quantum Metronome',
    enName: 'Quantum Metronome',
    titleZh: 'CRIT TYRANT',
    titleEn: 'CRIT TYRANT',
    quoteZh: 'Blade-tip precision tears open every vulnerability. Weak spot crit rate exceeds 30%.',
    unlockConditionZh: 'Land >= 5 sweet-spot crits with >= 30% crit accuracy',
    primaryFx: 'arcane/magic-circle-cast',
    secondaryFx: 'ui/crit-number',
    palette: ['#0D0D11', '#480CA8', '#7209B7', '#B5179E', '#FFD166'],
  },
  {
    id: 'aegis_shield',
    number: '#03',
    name: 'Aegis Aerial Crest',
    enName: 'Aegis Crest',
    titleZh: 'AERIAL INTERCEPTOR',
    titleEn: 'AERIAL INTERCEPTOR',
    quoteZh: 'The ground is never your ceiling. Mid-air vaults and aerial cleaves shatter all airborne drones.',
    unlockConditionZh: 'Cleave >= 5 flying drones mid-air',
    primaryFx: 'lightning/spark-arc',
    secondaryFx: 'scifi/force-field',
    palette: ['#0D0D11', '#212F6B', '#4A7CFF', '#62C8F4', '#F4F6F8'],
  },
  {
    id: 'nitro_deck',
    number: '#04',
    name: 'Nitro Deck',
    enName: 'Nitro Deck',
    titleZh: 'DEADLINE CRUSHER',
    titleEn: 'DEADLINE CRUSHER',
    quoteZh: 'No hesitation, only relentless forward cleaving. Barricades and hazards erased on contact.',
    unlockConditionZh: 'Land >= 18 ground slashes with max combo >= 15',
    primaryFx: 'fire/flame-pillar',
    secondaryFx: 'moves/dash-strike',
    palette: ['#0D0D11', '#FF4D3D', '#FF8A2A', '#FFD166', '#F4F6F8'],
  },
  {
    id: 'overdrive_espresso',
    number: '#05',
    name: 'Overdrive Espresso',
    enName: 'Overdrive Espresso',
    titleZh: '1% HP SURVIVOR',
    titleEn: '1% HP SURVIVOR',
    quoteZh: 'Clawing back from the brink of total system collapse with 1 shield remaining.',
    unlockConditionZh: 'Survive 45+ seconds under critical alert (1 shield left)',
    primaryFx: 'shadow/shadow-flames',
    secondaryFx: 'impacts/hit-spark',
    palette: ['#0D0D11', '#3D0C02', '#8B2500', '#FF4D3D', '#FFD166'],
  },
  {
    id: 'glitch_cube',
    number: '#06',
    name: 'Glitch Cube',
    enName: 'Glitch Cube',
    titleZh: 'CHAOS VANGUARD',
    titleEn: 'CHAOS VANGUARD',
    quoteZh: 'Unpredictable, intuitive, boundless. Raw creative momentum born of free exploration.',
    unlockConditionZh: 'Clear initial combat waves and safely extract',
    primaryFx: 'transitions/pixel-dissolve',
    secondaryFx: 'weather/fireflies',
    palette: ['#0D0D11', '#1E1E2F', '#06D6A0', '#4A7CFF', '#F4F6F8'],
  },
];

export interface RunStats {
  slashHits: number; // Ground slashes
  sweetSpotCrits: number; // Pure blade-tip precision sweet spot strikes
  aerialKills: number; // Drones intercepted in air
  shieldBreaks: number; // Shield bots crushed
  whiffCount: number; // Empty swings
  totalHits: number;
  maxCombo: number;
  shieldsLeft: number;
  score: number;
  timeSurvived: number;
  bossDefeated: boolean;

  // Endless stage progression tracking
  stagesCleared: number; // Number of stages cleared in this run
  highestStageReached: number; // Highest stage reached (1, 2, 3...)
  loopCount: number; // Current cycle loop (Loop 1, Loop 2...)

  // Strict damage & repair tracking
  damageTaken: number; // Actual shields lost in combat (flawless requires damageTaken === 0)
  repairsCollected: number; // Number of repair batteries picked up
  shieldsRestored: number; // Number of shield points actually restored (max 3)

  // Compatibility aliases
  critHits: number;
  rightHits: number;
  leftParries: number;
  perfectHits: number;
  rightMisses: number;
  leftMisses: number;
}

// Relic appraisal algorithm: Rarest / Flawless achievements evaluated FIRST!
export function evaluateRelic(stats: RunStats): RelicConfig {
  const sweetCrits = stats.sweetSpotCrits ?? stats.critHits ?? 0;
  const aerial = stats.aerialKills ?? 0;
  const slashes = stats.slashHits ?? 0;
  // Sweet spot crit rate is strictly calculated from ground slashes:
  const sweetSpotRate = slashes > 0 ? sweetCrits / slashes : 0;

  // #01 Priority: Golden Stick (Flawless untouchable ace + boss core defeated)
  // Strict condition: damageTaken must be 0! (Repairing back to 3 after being hit is NOT flawless)
  const isFlawless = stats.damageTaken !== undefined ? stats.damageTaken === 0 : stats.shieldsLeft === 3;
  if (isFlawless && (stats.bossDefeated || (stats.stagesCleared ?? 0) >= 4)) {
    return RELICS[0];
  }

  // #02 Priority: Quantum Metronome (High precision blade-tip sweet spot master)
  // Must have at least 5 sweet-spot strikes AND >= 30% sweet spot accuracy
  if (sweetCrits >= 5 && sweetSpotRate >= 0.30) {
    return RELICS[1];
  }

  // #03 Priority: Aegis Crest (Aerial interceptor)
  if (aerial >= 5) {
    return RELICS[2];
  }

  // #04 Priority: Nitro Deck (High damage ground crusher)
  if (slashes >= 18 && (stats.maxCombo >= 15 || (stats.stagesCleared ?? 0) >= 2)) {
    return RELICS[3];
  }

  // #05 Priority: Overdrive Espresso (1 HP clutched survival)
  if (stats.shieldsLeft === 1 && (stats.timeSurvived >= 45 || (stats.stagesCleared ?? 0) >= 2)) {
    return RELICS[4];
  }

  // #06 Priority: Glitch Cube (Balanced / Chaos exploration fallback)
  return RELICS[5];
}

// Compute deterministic seed and hexadecimal display
export function computeSoulSeed(stats: RunStats): { seed: number; hash: string } {
  const aerial = stats.aerialKills ?? stats.leftParries ?? 0;
  const crits = stats.critHits ?? stats.perfectHits ?? 0;
  const seed = Math.abs(stats.score * 31 + aerial * 19 + crits * 13 + stats.maxCombo) || 12345;
  const hex = (seed % 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return { seed, hash: `SOUL SEED #${hex}` };
}
