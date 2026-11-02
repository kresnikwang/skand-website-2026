// 60FPS Arcade Brawler Engine - Enhanced Feel, Phased Hitbox, Sweet-Spot Crits, Scaled Sprites & SKAND Aesthetic

import {
  GameDimensions,
  computeDynamicDimensions,
  COMBAT_PARAMS,
  RunStats,
  PALETTE,
  computeWeaponLevel,
} from './spec';
import {
  StageId,
  StageConfig,
  SceneTheme,
  BASE_THEMES,
  getStageConfig,
} from './stages';
import {
  ParallaxCity,
  drawPixelMatrix,
  drawContactShadow,
  drawRepairBattery,
  HERO_IDLE_1,
  HERO_IDLE_2,
  HERO_RUN_1,
  HERO_RUN_2,
  HERO_JUMP,
  HERO_LAND_SQUASH,
  HERO_SLASH_START,
  HERO_SLASH_ACTIVE,
  HERO_SLASH_RECOVER,
  HERO_AERIAL_SLASH,
  HERO_PAL,
  SHIELD_SHARD_DEBRIS,
  SHIELD_SHARD_PAL,
  BARRICADE_FULL,
  BARRICADE_PAL,
  BARRICADE_DEBRIS_A,
  BARRICADE_DEBRIS_B,
  DRONE_IDLE,
  DRONE_PAL,
  DRONE_BOMB_SPRITE,
  DRONE_BOMB_PAL,
  SHIELD_BOT_WALK,
  SHIELD_BOT_PAL,
  BOSS_CORE,
  BOSS_CORE_PAL,
  INSPIRATION_SHARD,
  SHARD_PAL,
  LASER_HAZARD_EMITTER,
  LASER_HAZARD_PAL,
} from './sprites';
import { FxManager } from './fxManager';
import { audio } from './audio';

export type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER' | 'VICTORY';
export type AttackState = 'IDLE' | 'STARTUP' | 'ACTIVE' | 'RECOVERY';

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Debris {
  matrix: string[];
  palette: Record<string, string>;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  scale: number;
}

export interface ShardItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface PickupFlash {
  x: number;
  y: number;
  timer: number;
}

export interface BarricadeEntity {
  id: number;
  x: number;
  y: number;
  speed: number;
  alive: boolean;
}

export interface DroneEntity {
  id: number;
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  hoverBaseY: number;
  time: number;
  alive: boolean;
  warningTimer: number;

  // Progressive Ordnance Bomb Drop
  bombsAllowed: number;
  bombsDropped: number;
  bombDropCooldown: number;
  bombChargeTimer: number;
  isChargingBomb: boolean;
}

export interface DroneBombEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetGroundY: number;
  state: 'FALLING' | 'EXPLODED';
  blastRadius: number;
  alive: boolean;
  time: number;
}

export interface ShieldBotEntity {
  id: number;
  x: number;
  y: number;
  speed: number;
  hitsLeft: number;
  staggerTimer: number;
  alive: boolean;
}

export interface LaserGridHazard {
  id: number;
  x: number;
  y: number;
  speed: number;
  alive: boolean;
}

export interface RepairPickupEntity {
  id: number;
  slot: 'first' | 'second' | 'clear';
  x: number;
  y: number;
  targetY: number;
  state: 'TELEGRAPH' | 'DROP' | 'AVAILABLE' | 'ATTRACTING';
  stateTimer: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

export interface GhostTrail {
  x: number;
  y: number;
  alpha: number;
  matrix: string[];
  flipX: boolean;
}

export class GameEngine {
  public config: GameDimensions;
  public fx: FxManager;
  public city: ParallaxCity;

  // Loop & state
  public state: GameState = 'MENU';
  public isPaused = false;
  private animId = 0;
  private lastTime = 0;
  public gameTimer = 0; // 0 to 75s

  // Canvas context
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;

  // Combat stats
  public stats: RunStats = {
    slashHits: 0,
    sweetSpotCrits: 0,
    aerialKills: 0,
    shieldBreaks: 0,
    critHits: 0,
    whiffCount: 0,
    totalHits: 0,
    maxCombo: 0,
    shieldsLeft: COMBAT_PARAMS.initialShields,
    score: 0,
    timeSurvived: 0,
    bossDefeated: false,
    stagesCleared: 0,
    highestStageReached: 1,
    loopCount: 1,
    damageTaken: 0,
    repairsCollected: 0,
    shieldsRestored: 0,
    rightHits: 0,
    leftParries: 0,
    perfectHits: 0,
    rightMisses: 0,
    leftMisses: 0,
  };

  public combo = 0;
  public comboTier = 1; // 1 to 5
  private comboDecayTimer = COMBAT_PARAMS.comboDecayGracePeriod;

  // Hero Position, Movement & Physics
  public heroX = 80;
  public heroFacing: 'RIGHT' | 'LEFT' = 'RIGHT';
  public inputLeft = false;
  public inputRight = false;

  // Multi-Phase Attack Mechanics
  public attackState: AttackState = 'IDLE';
  private attackPhaseTimer = 0;
  private attackInAir = false;
  private hitEntitiesInCurrentSlash = new Set<number>();
  private attackBufferTimer = 0;
  private jumpBufferTimer = 0;

  // Landing squash & Run animation
  public heroYOffset = 0; // 0 on ground, negative in air
  public heroVy = 0;
  public isGrounded = true;
  private landingSquashTimer = 0;
  private runAnimTimer = 0;
  private runFrame = 0;
  private idleAnimTimer = 0;

  // Invulnerability & Hit Flashing
  public invulnerableTimer = 0;
  private damageFlashTimer = 0;

  // Combat feel trinity
  private hitStopTimer = 0;
  private screenShakeTimer = 0;
  private screenShakeMagnitude = 3;
  private shakeOffset = { x: 0, y: 0 };

  // Entities
  private barricades: BarricadeEntity[] = [];
  private drones: DroneEntity[] = [];
  private droneBombs: DroneBombEntity[] = [];
  private shieldBots: ShieldBotEntity[] = [];
  private laserGrids: LaserGridHazard[] = [];
  private shards: ShardItem[] = [];
  private debrisList: Debris[] = [];
  private floatTexts: FloatingText[] = [];
  private ghostTrails: GhostTrail[] = [];
  private pickupFlashes: PickupFlash[] = [];

  // Interactive 3-stage guided tutorial gate (Task-driven: Slash Barrier -> Jump Laser -> Aerial Cleave)
  public tutorialGate: 'SLASH' | 'JUMP' | 'AERIAL' | 'DONE' = 'SLASH';
  public activeTutorialText: string | null = null;
  private tutorialTimer = 0;
  private tutorialShown = {
    slash: false,
    jump: false,
    aerial: false,
  };

  // Climax Boss Duel
  public bossActive = false;
  public bossHp = COMBAT_PARAMS.bossMaxHp;
  public bossMaxHp = COMBAT_PARAMS.bossMaxHp;
  public bossX = 160;
  public bossY = -120;
  public bossTargetY = 35;

  // Stage & Endless Progression System (Megacity Run)
  public runPhase: 'TUTORIAL' | 'RUN' | 'RESULT' = 'RUN';
  public survivalTimer = 0; // Continuous count-up survival time (seconds)
  public currentStageNumber = 1; // 1, 2, 3, 4, 5, 6...
  public currentStage: StageConfig = getStageConfig(1);
  public stageProgress = 0; // Targets defeated in current stage
  public stageClearing = false;
  public stageClearTimer = 0;
  private transitionTimer = 0;
  private fromTheme: SceneTheme = BASE_THEMES.tokyo;
  private toTheme: SceneTheme = BASE_THEMES.tokyo;
  private ambientFxTimer = 0;

  // === 优化方案 1: Victory Gate (关卡清除仪式) ===
  public clearFlagTimer = 0; // 旗帜升起动画时间
  public clearFlyScoreTimer = 0; // 得分飞入计时
  public clearScanTimer = 0; // 扫光计时
  public clearScoreFlyX = 0; // 得分飞入起点
  public clearScoreFlyY = 0; // 得分飞入起点
  public clearScoreValue = 0; // 飞入得分值

  // === 优化方案 2 & 3: Transit (穿越通道) + Entrance (入场仪式) ===
  public transitTimer = 0; // 穿越通道计时
  public entranceTimer = 0; // 新关卡入场计时
  public entranceDelayDone = false; // 入场安全观察完成标志

  public currentStageId: StageId = 'tokyo';
  public stageBannerText: string | null = null;
  public stageBannerTimer = 0;
  private stageWaveIndex = 0;
  private stageWaveActionIndex = 0;

  // Supply Repair Pickups (Triggered on stage clears or transition drops)
  public activeRepairPickup: RepairPickupEntity | null = null;
  private usedRepairSlots = new Set<'first' | 'second'>();

  // Spawner & wave rhythm
  private spawnTimer = 0;
  private nextEntityId = 1;
  private waveStep = 0;

  // Callbacks to React UI
  public onStateChange?: (state: GameState, stats: RunStats) => void;
  public onStatsUpdate?: (
    stats: RunStats,
    combo: number,
    comboTier: number,
    survivalTime: number,
    stageNumber: number,
    stageProgress: number,
    stageTargetCount: number,
    stageId: StageId,
    stageTitle: string
  ) => void;
  public onTutorialComplete?: () => void;
  public onBannerNotice?: (banner: { title: string; subtitle?: string } | null) => void;
  public onTutorialNotice?: (text: string | null) => void;

  constructor(canvas: HTMLCanvasElement, viewportWidth: number, viewportHeight: number) {
    this.mainCanvas = canvas;
    this.mainCtx = canvas.getContext('2d')!;
    this.config = computeDynamicDimensions(viewportWidth, viewportHeight);
    this.heroX = Math.round(this.config.width * 0.25);
    this.bossX = Math.round(this.config.width * 0.68);
    this.bossTargetY = Math.round(this.config.groundY - 34 * this.config.scale);
    this.fx = new FxManager(this.config.width, this.config.height);
    this.city = new ParallaxCity();

    this.mainCanvas.width = this.config.width;
    this.mainCanvas.height = this.config.height;
  }

  public resize(viewportWidth: number, viewportHeight: number) {
    const oldGroundY = this.config.groundY;
    this.config = computeDynamicDimensions(viewportWidth, viewportHeight);
    const deltaY = this.config.groundY - oldGroundY;

    this.mainCanvas.width = this.config.width;
    this.mainCanvas.height = this.config.height;
    this.fx.resize(this.config.width, this.config.height);
    this.bossX = Math.round(this.config.width * 0.68);
    this.bossTargetY = Math.round(this.config.groundY - 34 * this.config.scale);

    // Re-map existing live entities so they remain firmly anchored to the road after orientation change
    if (deltaY !== 0) {
      for (const b of this.barricades) b.y += deltaY;
      for (const d of this.drones) {
        d.hoverBaseY += deltaY;
        d.y += deltaY;
      }
      for (const bot of this.shieldBots) bot.y += deltaY;
      for (const l of this.laserGrids) l.y += deltaY;
      for (const s of this.shards) s.y += deltaY;
      if (this.activeRepairPickup) {
        this.activeRepairPickup.y += deltaY;
        this.activeRepairPickup.targetY += deltaY;
      }
      if (this.bossActive) {
        this.bossY += deltaY;
      }
    }
  }

  public startMenuPreview() {
    this.state = 'MENU';
    this.isPaused = false;
    cancelAnimationFrame(this.animId);
    this.lastTime = performance.now();
    this.city.setTheme(BASE_THEMES.tokyo);
    this.menuPreviewLoop(this.lastTime);
  }

  private menuPreviewLoop = (time: number) => {
    if (this.state !== 'MENU') return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    // Smooth ambient background parallax scrolling (Tokyo neon theme)
    this.city.update(dt, 0.08 * this.config.width, 0, false);
    this.idleAnimTimer = (this.idleAnimTimer + dt) % 0.8;
    this.fx.update(dt);

    this.renderMenuPreview();
    this.animId = requestAnimationFrame(this.menuPreviewLoop);
  };

  private renderMenuPreview() {
    const ctx = this.mainCtx;
    const { width, height, groundY, scale } = this.config;

    // 1. Dark foundational backdrop
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, width, height);

    // 2. Parallax Cyber City (Tokyo baseline theme with authentic skyline, signs, and weather)
    this.city.draw(ctx, width, height, groundY);

    // 3. pixelfx back layer
    this.fx.drawBack(ctx);

    // 4. Hero standing quietly on the street with contact shadow and breathing pose
    const sc = scale;
    drawContactShadow(ctx, this.heroX, groundY, 14 * sc, 0.45);

    const sprMatrix = this.idleAnimTimer > 0.4 ? HERO_IDLE_2 : HERO_IDLE_1;
    const sprH = sprMatrix.length;
    const sprOffsetX = 8;
    const drawHeroX = Math.round(this.heroX - sprOffsetX * sc);
    const drawHeroY = Math.round(this.config.heroY - (sprH - 1) * sc);
    drawPixelMatrix(ctx, sprMatrix, HERO_PAL, drawHeroX, drawHeroY, sc, false);

    // 5. pixelfx front layer
    this.fx.drawFront(ctx);

    // 6. Ambient Cyberpunk Vignette (Top and Bottom soft gradient shadows for menu readability)
    const topGradientHeight = Math.min(140, height * 0.35);
    const gradTop = ctx.createLinearGradient(0, 0, 0, topGradientHeight);
    gradTop.addColorStop(0, 'rgba(8, 8, 16, 0.80)');
    gradTop.addColorStop(1, 'rgba(8, 8, 16, 0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, width, topGradientHeight);

    const bottomGradientHeight = Math.min(160, height * 0.45);
    const gradBottom = ctx.createLinearGradient(0, height - bottomGradientHeight, 0, height);
    gradBottom.addColorStop(0, 'rgba(8, 8, 16, 0)');
    gradBottom.addColorStop(1, 'rgba(8, 8, 16, 0.88)');
    ctx.fillStyle = gradBottom;
    ctx.fillRect(0, height - bottomGradientHeight, width, bottomGradientHeight);
  }

  public start(phase: 'TUTORIAL' | 'RUN' = 'RUN') {
    audio.unlock();
    this.resetGame();
    this.state = 'PLAYING';
    this.isPaused = false;
    this.lastTime = performance.now();

    if (phase === 'TUTORIAL') {
      this.runPhase = 'TUTORIAL';
      this.tutorialGate = 'SLASH';
      this.gameTimer = 0;
      this.showTutorial('[TUTORIAL 1/3] SLASH: PRESS [J / Z / F] TO CUT BARRICADES');
    } else {
      this.startFormalChallenge();
    }

    cancelAnimationFrame(this.animId);
    this.loop(this.lastTime);
    this.onStateChange?.(this.state, this.stats);
  }

  public startFormalChallenge() {
    this.runPhase = 'RUN';
    this.tutorialGate = 'DONE';
    this.activeTutorialText = null;
    this.tutorialTimer = 0;
    this.onTutorialNotice?.(null);
    this.stageBannerText = null;
    this.stageBannerTimer = 0;
    this.onBannerNotice?.(null);

    // Reset stats to formal challenge initial state
    this.stats = {
      slashHits: 0,
      sweetSpotCrits: 0,
      aerialKills: 0,
      shieldBreaks: 0,
      critHits: 0,
      whiffCount: 0,
      totalHits: 0,
      maxCombo: 0,
      shieldsLeft: COMBAT_PARAMS.initialShields,
      score: 0,
      timeSurvived: 0,
      bossDefeated: false,
      stagesCleared: 0,
      highestStageReached: 1,
      loopCount: 1,
      damageTaken: 0,
      repairsCollected: 0,
      shieldsRestored: 0,
      rightHits: 0,
      leftParries: 0,
      perfectHits: 0,
      rightMisses: 0,
      leftMisses: 0,
    };
    this.combo = 0;
    this.comboTier = 1;
    this.comboDecayTimer = COMBAT_PARAMS.comboDecayGracePeriod;
    this.survivalTimer = 0;
    this.currentStageNumber = 1;
    this.currentStage = getStageConfig(1);
    this.currentStageId = this.currentStage.id;
    this.stageProgress = 0;
    this.stageClearing = false;
    this.stageClearTimer = 0;
    this.transitionTimer = 0;
    this.fromTheme = this.currentStage.theme;
    this.toTheme = this.currentStage.theme;
    this.bossActive = false;

    // Clear tutorial entities & active hazards
    this.barricades = [];
    this.drones = [];
    this.droneBombs = [];
    this.shieldBots = [];
    this.laserGrids = [];
    this.shards = [];
    this.debrisList = [];
    this.floatTexts = [];
    this.ghostTrails = [];
    this.activeRepairPickup = null;
    this.usedRepairSlots.clear();
    this.fx.clear();

    // Stage reset
    this.stageWaveIndex = 0;
    this.stageWaveActionIndex = 0;
    this.spawnTimer = 1.0;
    this.city.setTheme(this.currentStage.theme);
    this.showStageBanner(this.currentStage.bannerName);
    audio.playStageTransition();
  }

  public skipTutorial() {
    if (this.runPhase === 'TUTORIAL') {
      this.startFormalChallenge();
      this.onTutorialComplete?.();
    }
  }

  public setPaused(paused: boolean) {
    if (this.state !== 'PLAYING') return;
    this.isPaused = paused;
    audio.playBeep(!paused);
    if (!paused) {
      this.lastTime = performance.now();
    }
  }

  public togglePause(): boolean {
    this.setPaused(!this.isPaused);
    return this.isPaused;
  }

  public resetGame() {
    this.stats = {
      slashHits: 0,
      sweetSpotCrits: 0,
      aerialKills: 0,
      shieldBreaks: 0,
      critHits: 0,
      whiffCount: 0,
      totalHits: 0,
      maxCombo: 0,
      shieldsLeft: COMBAT_PARAMS.initialShields,
      score: 0,
      timeSurvived: 0,
      bossDefeated: false,
      stagesCleared: 0,
      highestStageReached: 1,
      loopCount: 1,
      damageTaken: 0,
      repairsCollected: 0,
      shieldsRestored: 0,
      rightHits: 0,
      leftParries: 0,
      perfectHits: 0,
      rightMisses: 0,
      leftMisses: 0,
    };
    this.combo = 0;
    this.comboTier = 1;
    this.comboDecayTimer = COMBAT_PARAMS.comboDecayGracePeriod;
    this.gameTimer = 0;
    this.hitStopTimer = 0;
    this.screenShakeTimer = 0;
    this.attackState = 'IDLE';
    this.attackPhaseTimer = 0;
    this.attackBufferTimer = 0;
    this.jumpBufferTimer = 0;
    this.hitEntitiesInCurrentSlash.clear();
    this.invulnerableTimer = 0;
    this.damageFlashTimer = 0;
    this.landingSquashTimer = 0;

    // Movement & Jump reset
    this.heroX = Math.round(this.config.width * 0.25);
    this.heroFacing = 'RIGHT';
    this.inputLeft = false;
    this.inputRight = false;
    this.heroYOffset = 0;
    this.heroVy = 0;
    this.isGrounded = true;

    this.barricades = [];
    this.drones = [];
    this.droneBombs = [];
    this.shieldBots = [];
    this.laserGrids = [];
    this.shards = [];
    this.debrisList = [];
    this.floatTexts = [];
    this.ghostTrails = [];
    this.pickupFlashes = [];
    this.waveStep = 0;
    this.stageWaveIndex = 0;
    this.stageWaveActionIndex = 0;
    this.activeRepairPickup = null;
    this.usedRepairSlots.clear();
    this.tutorialGate = 'SLASH';
    this.stageBannerText = null;
    this.stageBannerTimer = 0;
    this.onBannerNotice?.(null);

    this.tutorialShown = {
      slash: false,
      jump: false,
      aerial: false,
    };
    this.activeTutorialText = null;
    this.tutorialTimer = 0;
    this.onTutorialNotice?.(null);

    this.bossActive = false;
    this.bossHp = COMBAT_PARAMS.bossMaxHp;
    this.bossY = -120;
    this.spawnTimer = 0;
    this.fx.clear();
  }

  // ================= MOVEMENT INPUTS =================
  public setMoveLeft(active: boolean) {
    this.inputLeft = active;
    if (active) this.heroFacing = 'LEFT';
  }

  public setMoveRight(active: boolean) {
    this.inputRight = active;
    if (active) this.heroFacing = 'RIGHT';
  }

  public handleJump() {
    if (this.state !== 'PLAYING') return;
    audio.unlock();

    if (this.isGrounded) {
      this.isGrounded = false;
      this.heroVy = COMBAT_PARAMS.jumpForce;
      this.landingSquashTimer = 0;
      audio.playJump();

      // Cyber Jetpack thruster spark at feet
      this.fx.spawn(
        'scifi/jetpack',
        {
          x: this.heroX,
          y: this.config.heroY + 4,
          palette: ['#FF4D3D', '#00F0FF', '#FFFFFF'],
        },
        'back'
      );
    } else {
      // Buffer jump input if pressed just before landing
      this.jumpBufferTimer = COMBAT_PARAMS.inputBufferDuration;
    }
  }

  // ================= ATTACK / SLASH WITH MULTI-PHASE HITBOX =================
  public handleAttack() {
    if (this.state !== 'PLAYING') return;
    audio.unlock();

    // If currently in attack, buffer the next attack command!
    if (this.attackState !== 'IDLE') {
      this.attackBufferTimer = COMBAT_PARAMS.inputBufferDuration;
      return;
    }

    this.startAttackPhase();
  }

  private startAttackPhase(carryOverDt = 0) {
    this.attackInAir = !this.isGrounded;
    this.attackState = 'STARTUP';
    this.attackPhaseTimer = Math.max(0.005, COMBAT_PARAMS.attackStartupDuration - carryOverDt);
    this.hitEntitiesInCurrentSlash.clear();
    this.attackBufferTimer = 0;
  }

  private activateAttackHitbox(carryOverDt = 0) {
    this.attackState = 'ACTIVE';
    this.attackPhaseTimer = Math.max(0.005, COMBAT_PARAMS.attackActiveDuration - carryOverDt);

    // Slight physical forward dash nudge (power feel), but ONLY if hero is not pushed too far right!
    // Keeps player centered in the screen rather than pushing them into the spawn wall
    if (this.isGrounded) {
      if (this.heroFacing === 'RIGHT' && this.heroX < this.config.width * 0.40) {
        this.heroX = Math.min(this.config.width * 0.40, this.heroX + 2);
      } else if (this.heroFacing === 'LEFT' && this.heroX > 20) {
        this.heroX = Math.max(20, this.heroX - 2);
      }
    }

    // Ghost trail
    this.ghostTrails.push({
      x: this.heroX,
      y: this.config.heroY + this.heroYOffset,
      alpha: 0.55,
      matrix: this.attackInAir ? HERO_AERIAL_SLASH : HERO_SLASH_ACTIVE,
      flipX: this.heroFacing === 'LEFT',
    });

    // Spawn tiered visual slash fx
    this.spawnSlashFx(this.attackInAir);
    audio.playSlash(this.comboTier);

    // Initial instant check on active frame
    this.checkAttackCollisions();
  }

  private checkAttackCollisions() {
    const isLeft = this.heroFacing === 'LEFT';
    const heroY = this.config.heroY + this.heroYOffset;

    // Attack dimensions calibrated with pixel art sprite
    // Tangible Weapon Perks:
    // Tier 4 Cyber Light Blade: +6px logical forward reach
    // Tier 5 SKAND OVERDRIVE: +12px logical forward reach + 8px vertical tolerance!
    const reachBonus = this.comboTier >= 5 ? 12 : this.comboTier >= 4 ? 6 : 0;
    const heightBonus = this.comboTier >= 5 ? 8 : 0;
    const reachFwd = ((this.attackInAir ? 32 : 36) + reachBonus) * this.config.scale;
    const reachBack = (this.attackInAir ? 24 : 6) * this.config.scale;
    const minX = isLeft ? this.heroX - reachFwd : this.heroX - reachBack;
    const maxX = isLeft ? this.heroX + reachBack : this.heroX + reachFwd;
    const heightTolerance = ((this.attackInAir ? 30 : 20) + heightBonus) * this.config.scale;

    // 1. Check Climax Boss Core
    if (this.bossActive && !this.hitEntitiesInCurrentSlash.has(-999)) {
      // Must face boss and be within reach
      const facingBoss = (isLeft && this.heroX > this.bossX) || (!isLeft && this.heroX < this.bossX);
      const bossDistX = Math.abs(this.heroX - this.bossX);
      const bossDistY = Math.abs(heroY - (this.bossY + 14));

      if (facingBoss && bossDistX < 48 * this.config.scale && bossDistY < 36 * this.config.scale) {
        this.hitEntitiesInCurrentSlash.add(-999);
        this.strikeBossCore();
      }
    }

    // 2. Check Aerial Drones
    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];
      if (!d.alive || this.hitEntitiesInCurrentSlash.has(d.id)) continue;
      if (d.x >= minX && d.x <= maxX) {
        const dy = Math.abs(d.y - heroY);
        if (dy <= heightTolerance + 10) {
          this.hitEntitiesInCurrentSlash.add(d.id);
          this.executeDrone(d, this.attackInAir);
        }
      }
    }

    // 3. Check Barricades
    for (let i = 0; i < this.barricades.length; i++) {
      const b = this.barricades[i];
      if (!b.alive || this.hitEntitiesInCurrentSlash.has(b.id)) continue;
      if (b.x >= minX && b.x <= maxX) {
        const dy = Math.abs(b.y - heroY);
        if (dy <= heightTolerance) {
          this.hitEntitiesInCurrentSlash.add(b.id);
          this.executeBarricade(b);
        }
      }
    }

    // 4. Check Shield Bots
    for (let i = 0; i < this.shieldBots.length; i++) {
      const bot = this.shieldBots[i];
      if (!bot.alive || this.hitEntitiesInCurrentSlash.has(bot.id)) continue;
      if (bot.x >= minX && bot.x <= maxX) {
        const dy = Math.abs(bot.y - heroY);
        if (dy <= heightTolerance) {
          this.hitEntitiesInCurrentSlash.add(bot.id);
          this.executeShieldBot(bot);
        }
      }
    }

    // 5. Check Drone Bombs (Mid-air or Ground Defusal / Slash)
    for (let i = 0; i < this.droneBombs.length; i++) {
      const bomb = this.droneBombs[i];
      if (!bomb.alive || this.hitEntitiesInCurrentSlash.has(bomb.id)) continue;
      if (bomb.x >= minX - 6 && bomb.x <= maxX + 6) {
        const dy = Math.abs(bomb.y - heroY);
        if (dy <= heightTolerance + 14) {
          this.hitEntitiesInCurrentSlash.add(bomb.id);
          this.defuseDroneBomb(bomb);
        }
      }
    }
  }

  // ================= COMBO & EVOLUTION =================
  private addHit(isCrit: boolean, scoreVal: number) {
    this.combo++;
    this.comboDecayTimer = COMBAT_PARAMS.comboDecayGracePeriod;
    this.stats.totalHits++;
    if (isCrit) {
      this.stats.critHits++;
      this.stats.perfectHits++;
    }
    if (this.combo > this.stats.maxCombo) {
      this.stats.maxCombo = this.combo;
    }

    const prevTier = this.comboTier;
    // Single source of truth for weapon evolution
    this.comboTier = computeWeaponLevel(this.combo);

    if (this.comboTier > prevTier) {
      audio.playOverdrive();
      this.addFloatText(
        this.comboTier === 5 ? '★ OVERDRIVE ★' : `TIER UP! ×${this.comboTier}`,
        this.heroX,
        this.config.heroY + this.heroYOffset - 32,
        PALETTE.critGold,
        14
      );
      this.fx.spawn('holy/sunburst', { x: this.heroX, y: this.config.heroY + this.heroYOffset - 10 }, 'front', 0.45);
      this.fx.spawn('lightning/lightning-strike', { x: this.heroX, y: this.config.heroY + this.heroYOffset }, 'front', 0.35);
    }

    const multiplier = 1 + (this.comboTier - 1) * 0.5;
    this.stats.score += Math.round(scoreVal * multiplier * (isCrit ? 1.8 : 1));
  }

  // ================= COMBAT EXECUTIONS =================
  private executeBarricade(b: BarricadeEntity) {
    b.alive = false;
    this.stats.slashHits++;
    this.stats.rightHits++;

    // Deterministic Blade-Tip Sweet-Spot Precision Strike:
    // Struck at the outer blade tip (distance between sweetSpotMinDist and sweetSpotMaxDist)
    const strikeDist = Math.abs(b.x - this.heroX);
    const minD = COMBAT_PARAMS.sweetSpotMinDist * this.config.scale;
    const maxD = COMBAT_PARAMS.sweetSpotMaxDist * this.config.scale;
    const isSweetSpot = strikeDist >= minD && strikeDist <= maxD;

    if (isSweetSpot) {
      this.stats.sweetSpotCrits++;
      this.fx.spawn('impacts/crit-hit', { x: b.x, y: b.y }, 'front', 0.25);
      this.fx.spawn('ui/crit-number', { x: b.x, y: b.y - 12 }, 'front', 0.35);
    }

    this.addHit(isSweetSpot, 100);
    this.onTargetCleared();

    // If currently in tutorial gate SLASH, advance to JUMP!
    if (this.tutorialGate === 'SLASH') {
      this.tutorialGate = 'JUMP';
      this.spawnTimer = 1.0;
      this.addFloatText('SLASH CLEAR!', this.heroX, this.config.heroY + this.heroYOffset - 25, PALETTE.neonGreen, 8);
      audio.playPowerUp();
    }

    // Hitstop & screen shake grading
    this.triggerHitStop(isSweetSpot ? COMBAT_PARAMS.hitStopMedium : COMBAT_PARAMS.hitStopLight);
    this.triggerScreenShake(isSweetSpot ? COMBAT_PARAMS.shakeMedium : COMBAT_PARAMS.shakeLight, isSweetSpot ? 4 : 2);
    audio.playHit(isSweetSpot);

    this.addFloatText(
      isSweetSpot ? 'SWEET SPOT!' : 'SLASH!',
      b.x,
      b.y - 15,
      isSweetSpot ? PALETTE.critGold : PALETTE.white,
      isSweetSpot ? 12 : 10
    );

    // Physical metallic debris flying along slash direction
    const dir = this.heroFacing === 'RIGHT' ? 1 : -1;
    this.debrisList.push({
      matrix: BARRICADE_DEBRIS_A,
      palette: BARRICADE_PAL,
      x: b.x,
      y: b.y,
      vx: dir * (170 + Math.random() * 50),
      vy: -130 - Math.random() * 30,
      rot: 0,
      rotSpeed: dir * 9,
      scale: this.config.scale,
    });
    this.debrisList.push({
      matrix: BARRICADE_DEBRIS_B,
      palette: BARRICADE_PAL,
      x: b.x + 8,
      y: b.y + 4,
      vx: dir * (230 + Math.random() * 50),
      vy: -90 - Math.random() * 40,
      rot: 0,
      rotSpeed: -dir * 11,
      scale: this.config.scale,
    });

    // Physical forward background propulsion pulse on impact
    this.city.triggerHitPulse();

    // Small blue shards flying out with bounded lifetime (0.45s max)
    for (let s = 0; s < 3; s++) {
      this.shards.push({
        x: b.x + (s - 1) * 6,
        y: b.y - 4,
        vx: -dir * (40 + Math.random() * 50),
        vy: -70 - Math.random() * 40,
        life: 0.45,
        maxLife: 0.45,
      });
    }

    // Clean hit spark (white/silver spark, NO ice sculpture shatter-death, NO flame pillar!)
    this.fx.spawn('impacts/hit-spark', { x: b.x, y: b.y }, 'front', 0.14);
    if (this.comboTier >= 3) {
      this.fx.spawn('explosions/small-explosion', { x: b.x, y: b.y }, 'front', 0.18);
    }
  }

  private executeDrone(d: DroneEntity, inAir: boolean) {
    d.alive = false;
    if (inAir) {
      this.stats.aerialKills++;
      this.stats.leftParries++;
      // Aerial kill counts for score & combo, but does NOT falsely inflate blade-tip sweet spot crits
      this.addHit(false, 180);
    } else {
      this.stats.slashHits++;
      this.stats.rightHits++;
      this.addHit(false, 120);
    }

    // Physical forward background propulsion pulse on impact
    this.city.triggerHitPulse();

    // Advance tutorial gate if in AERIAL stage
    if (this.tutorialGate === 'AERIAL' && inAir) {
      this.tutorialGate = 'DONE';
      this.addFloatText('TUTORIAL CLEAR!', this.heroX, this.config.heroY + this.heroYOffset - 30, PALETTE.critGold, 8);
      audio.playOverdrive();
      this.onTutorialComplete?.();

      setTimeout(() => {
        if (this.state === 'PLAYING') {
          this.startFormalChallenge();
        }
      }, 1000);
    }

    this.triggerHitStop(COMBAT_PARAMS.hitStopMedium);
    this.triggerScreenShake(COMBAT_PARAMS.shakeMedium, 4);
    audio.playHit(inAir);

    this.addFloatText(
      inAir ? 'AERIAL CLEAVE!' : 'DRONE DOWN!',
      d.x,
      d.y - 15,
      inAir ? PALETTE.critGold : '#00F0FF',
      12
    );

    // Falling drone scrap parts
    this.debrisList.push({
      matrix: BARRICADE_DEBRIS_B,
      palette: DRONE_PAL,
      x: d.x,
      y: d.y,
      vx: -40 - Math.random() * 40,
      vy: -80,
      rot: 0,
      rotSpeed: 8,
      scale: this.config.scale,
    });

    // Clean explosion & lightning effects
    if (inAir) {
      this.fx.spawn('explosions/plasma-explosion', { x: d.x, y: d.y }, 'front', 0.28);
      this.fx.spawn('lightning/zap-hit', { x: d.x, y: d.y }, 'front', 0.22);
    } else {
      this.fx.spawn('explosions/small-explosion', { x: d.x, y: d.y }, 'front', 0.20);
    }
    this.onTargetCleared();

    for (let s = 0; s < 3; s++) {
      this.shards.push({
        x: d.x + (s - 1) * 6,
        y: d.y,
        vx: -50 - Math.random() * 60,
        vy: -40 - Math.random() * 40,
        life: 0.45,
        maxLife: 0.45,
      });
    }
  }

  private executeShieldBot(bot: ShieldBotEntity) {
    // Tangible Tier 3 Weapon Perk: Coral Flame Blade melts guard in 1 single hit!
    if (this.comboTier >= 3 || bot.hitsLeft === 1) {
      bot.alive = false;
      this.stats.shieldBreaks++;
      this.stats.slashHits++;
      this.stats.rightHits++;
      this.addHit(false, 200);

      const msg = this.comboTier >= 3 ? 'FLAME CRUSH! 1-HIT GUARD BREAK' : 'CRUSHED!';
      this.addFloatText(msg, bot.x, bot.y - 15, PALETTE.coral, 12);
      this.triggerHitStop(COMBAT_PARAMS.hitStopMedium);
      this.triggerScreenShake(COMBAT_PARAMS.shakeMedium, 4);
      audio.playHit(true);
      this.city.triggerHitPulse();

      this.debrisList.push({
        matrix: BARRICADE_DEBRIS_A,
        palette: SHIELD_BOT_PAL,
        x: bot.x,
        y: bot.y,
        vx: this.heroFacing === 'RIGHT' ? 220 : -220,
        vy: -140,
        rot: 0,
        rotSpeed: 12,
        scale: this.config.scale,
      });

      for (let s = 0; s < 4; s++) {
        this.shards.push({
          x: bot.x + s * 4,
          y: bot.y - 8,
          vx: -60 - Math.random() * 60,
          vy: -70 - Math.random() * 40,
          life: 0.45,
          maxLife: 0.45,
        });
      }

      this.fx.spawn('impacts/hit-spark', { x: bot.x, y: bot.y }, 'front', 0.14);
      this.fx.spawn('spawn/poof', { x: bot.x, y: bot.y }, 'front', 0.25);
      this.fx.spawn(this.comboTier >= 3 ? 'fire/flame-pillar' : 'explosions/small-explosion', { x: bot.x, y: bot.y }, 'front', 0.22);
      this.onTargetCleared();
    } else {
      bot.hitsLeft = 1;
      bot.staggerTimer = 0.22;
      bot.x += this.heroFacing === 'RIGHT' ? 20 : -20;
      this.stats.slashHits++;
      this.stats.rightHits++;
      this.addHit(false, 80);

      this.triggerHitStop(COMBAT_PARAMS.hitStopMedium);
      audio.playHit(false);
      this.addFloatText('GUARD BREAK!', bot.x, bot.y - 15, PALETTE.electricBlue, 11);
      this.fx.spawn('impacts/shield-block', { x: bot.x, y: bot.y }, 'front', 0.25);
      this.fx.spawn('impacts/hit-spark', { x: bot.x, y: bot.y }, 'front', 0.14);
    }
  }

  public onTargetCleared() {
    if (this.runPhase === 'TUTORIAL' || this.stageClearing) return;
    if (this.currentStage.id === 'core') return;

    this.stageProgress++;
    if (this.stageProgress >= this.currentStage.targetCount) {
      this.triggerStageClear();
    }
  }

  public triggerStageClear() {
    if (this.stageClearing) return;
    this.stageClearing = true;
    this.stageClearTimer = 1.8;

    this.stats.stagesCleared++;
    const bonus = 1000 * this.currentStage.loop;
    this.stats.score += bonus;

    // Clear active obstacles safely (reward window)
    this.barricades = [];
    this.drones = [];
    this.droneBombs = [];
    this.shieldBots = [];
    this.laserGrids = [];

    // Drop guaranteed supply battery
    this.spawnRepairBattery('clear');

    // Grand Stage Clear Fanfare
    audio.playPowerUp();
    this.addFloatText(
      `STAGE ${this.currentStageNumber} CLEAR! +${bonus}PT`,
      this.heroX,
      this.config.heroY + this.heroYOffset - 32,
      PALETTE.critGold,
      14
    );

    this.fx.spawn('holy/sunburst', { x: this.config.width / 2, y: this.config.height / 2 - 10 }, 'front', 0.65);
    this.fx.spawn('ui/confetti', { x: this.config.width / 2, y: this.config.height / 2 - 25 }, 'front', 0.90);
    this.fx.spawn('scifi/teleporter-pad', { x: this.heroX, y: this.config.heroY + 4 }, 'back', 0.45);

    // === 方案1: Victory Gate (关卡清除仪式) ===
    // 旗帜升起动画 (1.2秒)
    this.clearFlagTimer = 1.2;
    // 扫光效果 (从左到右扫过屏幕，持续0.6秒)
    this.clearScanTimer = 0.6;
    // 得分飞入：从英雄位置飞向计分板
    this.clearFlyScoreTimer = 1.0;
    this.clearScoreFlyX = this.heroX;
    this.clearScoreFlyY = this.config.heroY + this.heroYOffset - 32;
    this.clearScoreValue = bonus;
  }

  public advanceToNextStage() {
    this.currentStageNumber++;
    this.stats.highestStageReached = Math.max(this.stats.highestStageReached, this.currentStageNumber);

    const nextStage = getStageConfig(this.currentStageNumber);
    this.stats.loopCount = nextStage.loop;
    this.fromTheme = this.currentStage.theme;
    this.toTheme = nextStage.theme;
    this.currentStage = nextStage;
    this.currentStageId = nextStage.id;
    this.stageProgress = 0;
    this.stageWaveIndex = 0;
    this.stageWaveActionIndex = 0;
    this.transitionTimer = 0.8; // 过渡时间增加到0.8秒（戏剧化切换）

    // === 方案2: Transit (穿越通道) ===
    // 穿越期间英雄自动向前奔跑
    this.transitTimer = 0.8;

    // === 方案3: Entrance (入场仪式) ===
    // 新关卡入场：安全观察时间（1.0秒内无敌人出现）
    this.entranceTimer = 1.0;
    this.entranceDelayDone = false;

    this.showStageBanner(nextStage.bannerName);
    audio.playStageTransition();
    this.fx.spawn('transitions/glitch-wipe', { x: this.config.width / 2, y: this.config.height / 2 }, 'front', 0.45);

    if (nextStage.id === 'core') {
      this.bossActive = true;
      this.bossHp = nextStage.bossHp ?? 18;
      this.bossMaxHp = this.bossHp;
      this.bossTargetY = Math.round(this.config.groundY - 34 * this.config.scale);
      this.bossY = this.bossTargetY - 90;
      this.triggerScreenShake(COMBAT_PARAMS.shakeHeavy, 5);
      audio.playOverdrive();
      this.showStageBanner('BOSS ALERT // ROGUE PROTO-CORE', 'CLIMAX DUEL · DESTROY CORE TO ADVANCE');
      this.fx.spawn('holy/sunburst', { x: this.bossX, y: this.bossTargetY + 14 }, 'front', 0.65);
      this.fx.spawn('lightning/lightning-strike', { x: this.bossX, y: this.bossTargetY }, 'front', 0.45);
    } else {
      this.bossActive = false;
      this.spawnTimer = 0.6;
    }
  }

  private strikeBossCore() {
    this.bossHp--;
    this.stats.slashHits++;
    this.stats.rightHits++;
    this.addHit(false, 250);

    this.triggerHitStop(COMBAT_PARAMS.hitStopLight);
    this.triggerScreenShake(COMBAT_PARAMS.shakeLight, 3);
    audio.playBossHit();
    this.city.triggerHitPulse();

    this.addFloatText(
      'CORE HIT! -1',
      this.bossX + (Math.random() * 40 - 20),
      this.bossY + 20 + Math.random() * 20,
      PALETTE.critGold,
      12
    );

    this.fx.spawn('impacts/hit-spark', { x: this.bossX, y: this.bossY + 24 }, 'front', 0.14);

    // Boss Defeated by player skill: Disintegrate immediately into 8 core debris pieces
    if (this.bossHp <= 0) {
      this.bossActive = false;
      this.stats.bossDefeated = true;
      this.stats.score += 5000;
      this.triggerHitStop(COMBAT_PARAMS.hitStopHeavy);
      this.triggerScreenShake(COMBAT_PARAMS.shakeHeavy, 6);

      const sc = this.config.scale;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.4;
        const speed = 160 + Math.random() * 100;
        this.debrisList.push({
          matrix: i % 2 === 0 ? BARRICADE_DEBRIS_A : BARRICADE_DEBRIS_B,
          palette: BOSS_CORE_PAL,
          x: this.bossX,
          y: this.bossY + 14 * sc,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 80,
          rot: 0,
          rotSpeed: 10 + Math.random() * 15,
          scale: sc,
        });
      }

      this.fx.spawn('explosions/big-explosion', { x: this.bossX, y: this.bossY + 20 }, 'front', 0.55);
      this.fx.spawn('holy/sunburst', { x: this.bossX, y: this.bossY + 20 }, 'front', 0.65);
      this.fx.spawn('pickups/collect-burst', { x: this.bossX, y: this.bossY + 20 }, 'front', 0.45);
      this.triggerStageClear();
    }
  }

  private spawnSlashFx(inAir: boolean) {
    const isLeft = this.heroFacing === 'LEFT';
    const hy = this.config.heroY + this.heroYOffset;
    const offset = 22 * this.config.scale;
    const hx = isLeft ? this.heroX - offset : this.heroX + offset;

    const followTarget = () => ({
      x: this.heroFacing === 'LEFT' ? this.heroX - offset : this.heroX + offset,
      y: this.config.heroY + this.heroYOffset,
    });

    if (inAir) {
      this.fx.spawn('melee/spin-slash', { x: hx, y: hy, flip: isLeft, palette: ['#212F6B', '#4A7CFF', '#FFFFFF'] }, 'front', 0.14, followTarget);
      return;
    }

    if (this.comboTier === 1) {
      this.fx.spawn('melee/sword-slash', { x: hx, y: hy, flip: isLeft, palette: ['#212F6B', '#4A7CFF', '#FFFFFF'] }, 'front', 0.12, followTarget);
    } else if (this.comboTier === 2) {
      this.fx.spawn('melee/sword-slash', { x: hx, y: hy, flip: isLeft, palette: ['#003E7E', '#00F0FF', '#FFFFFF'] }, 'front', 0.12, followTarget);
    } else if (this.comboTier === 3) {
      this.fx.spawn('melee/sword-slash', { x: hx, y: hy, flip: isLeft, palette: ['#8B1E14', '#FF4D3D', '#FFD166'] }, 'front', 0.12, followTarget);
    } else if (this.comboTier === 4) {
      this.fx.spawn('melee/double-slash', { x: hx, y: hy, flip: isLeft, palette: ['#005533', '#06D6A0', '#FFFFFF'] }, 'front', 0.14, followTarget);
    } else {
      // Tier 5 Overdrive: Heavy Cleave with full animation window (0.40s) + auxiliary shockwave
      this.fx.spawn('melee/heavy-cleave', { x: hx, y: hy, flip: isLeft, palette: ['#8F6B00', '#FFD166', '#FFFFFF'] }, 'front', 0.40, followTarget);
      this.fx.spawn('scifi/emp-blast', { x: hx + (isLeft ? -10 : 10) * this.config.scale, y: hy }, 'front', 0.22);
    }
  }

  private takeDamage(reason: string) {
    if (this.invulnerableTimer > 0) return; // i-frames protection

    // Safe training-wheel protection during interactive tutorial gates!
    if (this.runPhase === 'TUTORIAL') {
      this.invulnerableTimer = 1.0;
      this.damageFlashTimer = 0.15;
      this.triggerScreenShake(COMBAT_PARAMS.shakeLight, 2);
      audio.playShieldLost();

      if (this.tutorialGate === 'SLASH') {
        this.showTutorial('[RETRY] SLASH: PRESS [J / Z / F]');
      } else if (this.tutorialGate === 'JUMP') {
        this.showTutorial('[RETRY] VAULT: PRESS [SPACE / W]');
      } else if (this.tutorialGate === 'AERIAL') {
        this.showTutorial('[RETRY] AERIAL: [SPACE / W] + [J / Z / F]');
      }
      return;
    }

    this.stats.shieldsLeft--;
    this.stats.damageTaken++; // Record genuine damage for flawless validation!

    // Drop combo and recompute weapon tier strictly from combo!
    this.combo = Math.max(0, this.combo - 8);
    this.comboTier = computeWeaponLevel(this.combo);
    this.comboDecayTimer = COMBAT_PARAMS.comboDecayGracePeriod;

    // Set i-frames and flash
    this.invulnerableTimer = COMBAT_PARAMS.invulnerabilityDuration;
    this.damageFlashTimer = 0.14;

    this.triggerScreenShake(COMBAT_PARAMS.shakeMedium, 4);
    this.triggerHitStop(COMBAT_PARAMS.hitStopMedium);
    audio.playShieldLost();

    // Spawn physical glowing shield fragments flying outward
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.4;
      const speed = 140 + Math.random() * 80;
      this.debrisList.push({
        matrix: SHIELD_SHARD_DEBRIS,
        palette: SHIELD_SHARD_PAL,
        x: this.heroX,
        y: this.config.heroY + this.heroYOffset - 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        rot: 0,
        rotSpeed: 10 + Math.random() * 12,
        scale: this.config.scale,
      });
    }

    this.addFloatText(
      this.stats.shieldsLeft > 0 ? 'SHIELD CRACK!' : 'SYSTEM CRITICAL!',
      this.heroX,
      this.config.heroY + this.heroYOffset - 22,
      PALETTE.coral,
      12
    );

    this.fx.spawn('impacts/hit-spark', { x: this.heroX, y: this.config.heroY + this.heroYOffset }, 'front', 0.14);
    this.fx.spawn('ui/heart-lost', { x: this.heroX, y: this.config.heroY + this.heroYOffset - 16 }, 'front', 0.40);
    this.fx.spawn('impacts/impact-frame', { x: this.heroX, y: this.config.heroY + this.heroYOffset }, 'front', 0.12);

    if (this.stats.shieldsLeft <= 0) {
      this.gameOverSequence();
    }
  }

  private victorySequence() {
    this.state = 'VICTORY';
    this.stats.timeSurvived = Math.round(this.survivalTimer);
    audio.playForgeRelic();
    this.fx.spawn('pickups/collect-burst', { x: this.config.width / 2, y: this.config.height / 2 }, 'front', 0.35);
    this.onStateChange?.(this.state, this.stats);
  }

  private gameOverSequence() {
    this.state = 'GAMEOVER';
    this.stats.timeSurvived = Math.round(this.survivalTimer);
    this.fx.spawn('transitions/glitch-wipe', { x: this.config.width / 2, y: this.config.height / 2 }, 'front', 0.45);
    this.onStateChange?.(this.state, this.stats);
  }

  private triggerHitStop(duration: number) {
    this.hitStopTimer = duration;
  }

  private triggerScreenShake(duration: number, magnitude = 3) {
    this.screenShakeTimer = duration;
    this.screenShakeMagnitude = magnitude;
  }

  private addFloatText(text: string, x: number, y: number, color: string, size = 8) {
    this.floatTexts.push({
      text,
      x,
      y,
      vy: -25,
      life: 0.65,
      maxLife: 0.65,
      color,
      size,
    });
  }

  private showTutorial(tip: string) {
    this.activeTutorialText = tip;
    this.tutorialTimer = 3.2;
    this.onTutorialNotice?.(tip);
  }

  public showStageBanner(text: string, subtitle?: string) {
    this.stageBannerText = text;
    this.stageBannerTimer = 2.4;
    this.onBannerNotice?.({
      title: text,
      subtitle: subtitle !== undefined ? subtitle : (this.currentStage?.subtitleZh || ''),
    });
  }

  // ================= MAIN GAME LOOP =================
  private loop = (time: number) => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    if (!this.isPaused) {
      this.update(dt);
    }
    this.render();

    if (this.state === 'PLAYING') {
      this.animId = requestAnimationFrame(this.loop);
    }
  };

  public update(dt: number) {
    if (this.isPaused) return;

    this.fx.update(dt);

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= dt;
      const mag = this.screenShakeMagnitude;
      this.shakeOffset.x = (Math.random() * 2 - 1) * mag;
      this.shakeOffset.y = (Math.random() * 2 - 1) * mag;
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }

    if (this.state !== 'PLAYING') return;

    // === 方案1: Victory Gate 计时处理 ===
    if (this.clearFlagTimer > 0) {
      this.clearFlagTimer -= dt;
    }
    if (this.clearScanTimer > 0) {
      this.clearScanTimer -= dt;
    }
    if (this.clearFlyScoreTimer > 0) {
      this.clearFlyScoreTimer -= dt;
    }

    // Update Timers
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
    }
    if (this.landingSquashTimer > 0) {
      this.landingSquashTimer -= dt;
    }
    if (this.tutorialTimer > 0) {
      this.tutorialTimer -= dt;
      if (this.tutorialTimer <= 0) {
        this.activeTutorialText = null;
        this.onTutorialNotice?.(null);
      }
    }

    // Input buffer expiration
    if (this.attackBufferTimer > 0) {
      this.attackBufferTimer -= dt;
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
    }

    // Gradual Combo Decay
    if (this.combo > 0) {
      this.comboDecayTimer -= dt;
      if (this.comboDecayTimer <= 0) {
        this.combo = Math.max(0, this.combo - 1);
        this.comboDecayTimer = 0.6; // step decay
        this.comboTier = computeWeaponLevel(this.combo);
      }
    }

    // ================= HERO MOVEMENT =================
    let heroVx = 0;
    if (this.inputLeft && !this.inputRight) {
      heroVx = -COMBAT_PARAMS.heroSpeed;
    } else if (this.inputRight && !this.inputLeft) {
      heroVx = COMBAT_PARAMS.heroSpeed;
    }

    this.heroX += heroVx * dt;
    this.heroX = Math.max(16, Math.min(this.config.width - 24, this.heroX));

    // ================= JUMP PHYSICS =================
    if (!this.isGrounded) {
      this.heroVy += COMBAT_PARAMS.gravity * dt;
      this.heroYOffset += this.heroVy * dt;

      if (this.heroYOffset >= 0) {
        this.heroYOffset = 0;
        this.heroVy = 0;
        this.isGrounded = true;
        this.landingSquashTimer = 0.08; // 80ms landing impact compression
        audio.playLanding();
        this.fx.spawn('impacts/heavy-landing', { x: this.heroX, y: this.config.heroY + 4 }, 'back', 0.20);

        // Check buffered jump
        if (this.jumpBufferTimer > 0) {
          this.jumpBufferTimer = 0;
          this.handleJump();
        }
      }
    }

    // ================= ATTACK STATE MACHINE (WITH SUB-FRAME OVERFLOW CARRY-OVER) =================
    if (this.attackState === 'STARTUP') {
      this.attackPhaseTimer -= dt;
      if (this.attackPhaseTimer <= 0) {
        const overflow = -this.attackPhaseTimer;
        this.activateAttackHitbox(overflow);
      }
    } else if (this.attackState === 'ACTIVE') {
      this.attackPhaseTimer -= dt;
      // Continuously sweep for enemies throughout active window
      this.checkAttackCollisions();

      if (this.attackPhaseTimer <= 0) {
        const overflow = -this.attackPhaseTimer;
        this.attackState = 'RECOVERY';
        this.attackPhaseTimer = Math.max(0.005, COMBAT_PARAMS.attackRecoveryDuration - overflow);

        // If no enemies were struck, this was an empty swing (whiff)
        if (this.hitEntitiesInCurrentSlash.size === 0) {
          this.stats.whiffCount++;
          this.stats.rightMisses++;
          audio.playWhiff();
        }
      }
    } else if (this.attackState === 'RECOVERY') {
      this.attackPhaseTimer -= dt;
      if (this.attackPhaseTimer <= 0) {
        const overflow = -this.attackPhaseTimer;
        this.attackState = 'IDLE';

        // Check buffered attack
        if (this.attackBufferTimer > 0) {
          this.attackBufferTimer = 0;
          this.startAttackPhase(overflow);
        }
      }
    }

    // Run & Idle animation timers
    if (heroVx !== 0 && this.isGrounded) {
      this.runAnimTimer += dt;
      this.idleAnimTimer = 0;
      if (this.runAnimTimer > 0.12) {
        this.runAnimTimer = 0;
        this.runFrame = (this.runFrame + 1) % 2;
      }
    } else {
      this.runAnimTimer = 0;
      if (this.isGrounded && this.attackState === 'IDLE') {
        this.idleAnimTimer += dt;
        if (this.idleAnimTimer > 0.8) {
          this.idleAnimTimer = 0;
        }
      } else {
        this.idleAnimTimer = 0;
      }
    }

    // Ghost trails update
    for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
      const g = this.ghostTrails[i];
      g.alpha -= dt * 3.5;
      if (g.alpha <= 0) {
        this.ghostTrails.splice(i, 1);
      }
    }

    // ================= PROGRESSION & ENDLESS STAGE SYSTEM =================
    if (this.runPhase === 'TUTORIAL') {
      // Safe Guided Tutorial: survivalTimer remains 0, formal stages and boss never trigger!
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTutorialWaves();
      }
      this.city.setTheme(BASE_THEMES.tokyo);
      this.city.update(dt, 0.12 * this.config.width, heroVx);
    } else {
      // Endless Stage-Clear Challenge: Count-up survival timer!
      this.survivalTimer += dt;
      this.gameTimer = this.survivalTimer;
      this.stats.timeSurvived = Math.floor(this.survivalTimer);

      const stage = this.currentStage;
      const isCore = stage.id === 'core';

      // === 方案2: Transit (穿越通道) - 过渡期间英雄自动向前奔跑 ===
      if (this.transitTimer > 0) {
        this.transitTimer -= dt;
        // 英雄自动向右奔跑（穿越通道感）
        this.heroX += COMBAT_PARAMS.heroSpeed * 2.5 * dt;
        this.heroX = Math.min(this.config.width * 0.78, this.heroX);
        this.heroFacing = 'RIGHT';
        // 背景加速滚动（模拟高速穿越）
        this.city.update(dt, stage.scrollScreensPerSecond * this.config.width * 2.5, 0, isCore);
        // 在穿越期间保持过渡混合（戏剧化主题切换）
        if (this.transitionTimer > 0) {
          this.transitionTimer -= dt;
          const progress = 1 - Math.max(0, this.transitionTimer / 0.8);
          this.city.setTheme(this.fromTheme, this.toTheme, progress);
        } else {
          this.city.setTheme(this.toTheme);
        }
      }

      // === 方案3: Entrance (入场仪式) - 新关卡安全观察时间 ===
      if (this.entranceTimer > 0) {
        this.entranceTimer -= dt;
        if (this.entranceTimer <= 0) {
          this.entranceDelayDone = true;
        }
        // 在入场期间不生成敌人（安全观察）
      } else {
        this.entranceDelayDone = true;
      }

      // Smooth theme color transition (非穿越状态下)
      if (this.transitTimer <= 0) {
        if (this.transitionTimer > 0) {
          this.transitionTimer -= dt;
          const progress = 1 - Math.max(0, this.transitionTimer / 0.8);
          this.city.setTheme(this.fromTheme, this.toTheme, progress);
        } else {
          this.city.setTheme(stage.theme);
        }
      }

      // Parallax city propulsion (正常状态)
      if (this.transitTimer <= 0) {
        this.city.update(dt, stage.scrollScreensPerSecond * this.config.width, heroVx, isCore);
      }

      // Handle Stage Clear Breather Window (Combo decay paused)
      if (this.stageClearing) {
        this.comboDecayTimer = Math.max(this.comboDecayTimer, COMBAT_PARAMS.comboDecayGracePeriod);
        this.stageClearTimer -= dt;
        if (this.stageClearTimer <= 0) {
          this.stageClearing = false;
          this.advanceToNextStage();
        }
      } else if (this.bossActive) {
        if (this.bossY < this.bossTargetY) {
          this.bossY = Math.min(this.bossTargetY, this.bossY + dt * 140);
        }
      } else {
        // 方案3: 入场期间不生成敌人（安全观察时间）
        if (this.entranceDelayDone && this.transitTimer <= 0) {
          this.spawnTimer -= dt;
          if (this.spawnTimer <= 0) {
            this.spawnStageWavePattern(stage);
          }
        } else if (!this.entranceDelayDone && this.transitTimer <= 0) {
          // 入场计时中，不生成敌人但计时器继续走
          this.spawnTimer -= dt;
        }
      }

      // Update Repair Pickup Battery
      this.updateRepairPickups(dt);
    }

    // Stage banner decay
    if (this.stageBannerTimer > 0) {
      this.stageBannerTimer -= dt;
      if (this.stageBannerTimer <= 0) {
        this.stageBannerText = null;
        this.onBannerNotice?.(null);
      }
    }

    // Update Entities
    this.updateBarricades(dt);
    this.updateDrones(dt);
    this.updateDroneBombs(dt);
    this.updateShieldBots(dt);
    this.updateLaserGrids(dt);
    this.updateShards(dt);
    this.updateDebris(dt);
    this.updateFloatingTexts(dt);

    // Update micro pickup flashes
    for (let i = this.pickupFlashes.length - 1; i >= 0; i--) {
      this.pickupFlashes[i].timer -= dt;
      if (this.pickupFlashes[i].timer <= 0) {
        this.pickupFlashes.splice(i, 1);
      }
    }

    this.onStatsUpdate?.(
      this.stats,
      this.combo,
      this.comboTier,
      Math.floor(this.survivalTimer),
      this.currentStageNumber,
      this.stageProgress,
      this.currentStage.targetCount,
      this.currentStage.id,
      this.currentStage.titleZh
    );
  }

  private spawnTutorialWaves() {
    // 3-Stage Sequential Guided Tutorial:
    // Stage 1: SLASH BARRIER -> Must slash barricade
    if (this.tutorialGate === 'SLASH') {
      if (this.barricades.length === 0) {
        this.showTutorial('[STEP 1/3] SLASH: PRESS [J / Z / F] TO CUT BARRICADES');
        this.spawnBarricade();
        this.spawnTimer = 2.4;
      }
      return;
    }

    // Stage 2: JUMP LASER -> Must jump clear over low laser grid
    if (this.tutorialGate === 'JUMP') {
      if (this.laserGrids.length === 0) {
        this.showTutorial('[STEP 2/3] VAULT: PRESS [SPACE / W] OVER GROUND LASERS');
        this.spawnLaserGrid();
        this.spawnTimer = 2.4;
      }
      return;
    }

    // Stage 3: AERIAL CLEAVE -> Must jump and slash hovering drone in air
    if (this.tutorialGate === 'AERIAL') {
      if (this.drones.length === 0) {
        this.showTutorial('[STEP 3/3] AERIAL: [SPACE / W] + [J / Z / F] TO CLEAVE DRONES');
        this.spawnDrone();
        this.spawnTimer = 2.6;
      }
      return;
    }
  }

  private spawnStageWavePattern(stage: StageConfig) {
    if (stage.waves.length === 0) return;

    const wave = stage.waves[this.stageWaveIndex % stage.waves.length];
    const action = wave.actions[this.stageWaveActionIndex % wave.actions.length];

    if (action.type === 'BARRICADE') {
      this.spawnBarricade();
    } else if (action.type === 'DRONE') {
      this.spawnDrone();
    } else if (action.type === 'SHIELD_BOT') {
      this.spawnShieldBot();
    } else if (action.type === 'LASER_GRID') {
      this.spawnLaserGrid();
    }

    this.spawnTimer = action.delayAfter;
    this.stageWaveActionIndex++;
    if (this.stageWaveActionIndex >= wave.actions.length) {
      this.stageWaveActionIndex = 0;
      this.stageWaveIndex++;
    }
  }

  private spawnRepairBattery(slot: 'first' | 'second' | 'clear' = 'clear') {
    // Drop at player's visible forward horizon
    const dropX = Math.min(
      this.config.width * 0.75,
      Math.max(this.config.width * 0.38, this.heroX + 0.20 * this.config.width)
    );
    const targetY = this.config.groundY - 10 * this.config.scale;

    this.activeRepairPickup = {
      id: this.nextEntityId++,
      slot,
      x: dropX,
      y: targetY - 24 * this.config.scale,
      targetY,
      state: 'TELEGRAPH',
      stateTimer: COMBAT_PARAMS.repairTelegraphDuration,
      life: COMBAT_PARAMS.repairLifespan,
      maxLife: COMBAT_PARAMS.repairLifespan,
      vx: 0,
      vy: 0,
    };
  }

  private updateRepairPickups(dt: number) {
    const p = this.activeRepairPickup;
    if (!p) return;

    if (p.state === 'TELEGRAPH') {
      p.stateTimer -= dt;
      if (p.stateTimer <= 0) {
        p.state = 'DROP';
        p.stateTimer = COMBAT_PARAMS.repairDropDuration;
      }
      return;
    }

    if (p.state === 'DROP') {
      p.stateTimer -= dt;
      const progress = 1 - Math.max(0, p.stateTimer / COMBAT_PARAMS.repairDropDuration);
      p.y = p.targetY - (1 - progress) * 24 * this.config.scale;
      if (p.stateTimer <= 0) {
        p.y = p.targetY;
        p.state = 'AVAILABLE';
      }
      return;
    }

    if (p.state === 'AVAILABLE') {
      p.life -= dt;
      if (p.life <= 0) {
        this.activeRepairPickup = null;
        return;
      }

      // Distance to hero
      const heroCenterY = this.config.heroY + this.heroYOffset - 8;
      const dx = this.heroX - p.x;
      const dy = heroCenterY - p.y;
      const dist = Math.hypot(dx, dy);

      // Check proximity attraction (within 0.12 screen width)
      if (dist < 0.12 * this.config.width && Math.abs(dy) < 30 * this.config.scale) {
        p.state = 'ATTRACTING';
      }
    }

    if (p.state === 'ATTRACTING') {
      const heroCenterY = this.config.heroY + this.heroYOffset - 8;
      const dx = this.heroX - p.x;
      const dy = heroCenterY - p.y;
      const dist = Math.hypot(dx, dy);

      // Fast magnetic pull to hero within ~0.15s
      const speed = 400 * this.config.scale;
      p.x += (dx / Math.max(1, dist)) * speed * dt;
      p.y += (dy / Math.max(1, dist)) * speed * dt;

      // Pickup trigger (survivors only, priority over death)
      if (dist < 14 * this.config.scale && this.stats.shieldsLeft > 0) {
        this.collectRepairBattery(p);
      }
    }
  }

  private collectRepairBattery(p: RepairPickupEntity) {
    this.stats.repairsCollected++;

    if (this.stats.shieldsLeft < COMBAT_PARAMS.maxShields) {
      this.stats.shieldsLeft++;
      this.stats.shieldsRestored++;
      this.addFloatText(
        'SHIELD +1 / RESTORED!',
        this.heroX,
        this.config.heroY + this.heroYOffset - 24,
        PALETTE.neonGreen,
        12
      );
      this.fx.spawn('pickups/collect-burst', { x: this.heroX, y: this.config.heroY + this.heroYOffset - 6 }, 'front', 0.28);
      this.fx.spawn('scifi/force-field', { x: this.heroX, y: this.config.heroY + this.heroYOffset - 8 }, 'front', 0.22);
    } else {
      this.stats.score += COMBAT_PARAMS.repairFullShieldScore;
      this.addFloatText(
        'MAX SHIELD! +250PT',
        this.heroX,
        this.config.heroY + this.heroYOffset - 24,
        PALETTE.critGold,
        12
      );
      this.fx.spawn('pickups/collect-burst', { x: this.heroX, y: this.config.heroY + this.heroYOffset - 6 }, 'front', 0.28);
      this.fx.spawn('holy/sunburst', { x: this.heroX, y: this.config.heroY + this.heroYOffset - 6 }, 'front', 0.40);
    }

    audio.playRepair();
    this.activeRepairPickup = null;
  }

  private spawnBarricade() {
    this.barricades.push({
      id: this.nextEntityId++,
      x: this.config.width + 15,
      y: this.config.groundY - 16,
      speed: 95,
      alive: true,
    });
  }

  private spawnDrone() {
    // Relative height calibration across landscape (scale 1.0) and portrait (scale 1.6):
    // Standing attack reach: 20 * scale.
    // Setting hover altitude to: 34 * scale + 10 + random ensures it is strictly above standing reach on ALL screen ratios,
    // mandating an aerial jump slash!
    const baseAltitude = 34 * this.config.scale + 10;
    const hoverY = this.config.groundY - baseAltitude - Math.random() * (12 * this.config.scale);

    const isTutorial = this.runPhase === 'TUTORIAL';
    const loop = this.currentStage.loop;
    const subIndex = this.currentStage.subIndex;

    // Difficulty scaling:
    // Tutorial: 0 bombs (learn jump slash safely)
    // Stage 1 (Tokyo): 1 bomb, generous telegraph warning (0.75s)
    // Stage 2 (Paris): 1 bomb, 0.60s telegraph
    // Stage 3 (Shanghai): 1 bomb, 0.48s telegraph, faster drop
    // Stage 4 (London): 2 bombs sequence (spread out)
    // Stage 5 (New York): 2 bombs sequence, rapid delivery
    // Stage 6 / LOOP 2+: 2 to 3 bombs
    let bombsAllowed = 0;
    if (!isTutorial) {
      if (subIndex === 1 || subIndex === 2 || subIndex === 3) {
        bombsAllowed = loop > 1 ? 2 : 1;
      } else {
        bombsAllowed = loop > 1 ? 3 : 2;
      }
    }

    this.drones.push({
      id: this.nextEntityId++,
      x: this.config.width + 12,
      y: hoverY,
      speedX: 75 + Math.random() * 25,
      speedY: 20,
      hoverBaseY: hoverY,
      time: Math.random() * 10,
      alive: true,
      warningTimer: 0.35,
      bombsAllowed,
      bombsDropped: 0,
      bombDropCooldown: 0.4,
      bombChargeTimer: 0,
      isChargingBomb: false,
    });
  }

  private spawnShieldBot() {
    this.shieldBots.push({
      id: this.nextEntityId++,
      x: this.config.width + 15,
      y: this.config.groundY - 22,
      speed: 80,
      hitsLeft: 2,
      staggerTimer: 0,
      alive: true,
    });
  }

  private spawnLaserGrid() {
    this.laserGrids.push({
      id: this.nextEntityId++,
      x: this.config.width + 10,
      y: this.config.groundY - 6,
      speed: 105,
      alive: true,
    });
  }

  private updateBarricades(dt: number) {
    for (let i = this.barricades.length - 1; i >= 0; i--) {
      const b = this.barricades[i];
      if (!b.alive) {
        this.barricades.splice(i, 1);
        continue;
      }
      b.x -= b.speed * dt;

      // Contact with hero
      if (Math.abs(b.x - this.heroX) < 14 * this.config.scale && this.heroYOffset >= -14) {
        this.barricades.splice(i, 1);
        this.takeDamage('Barricade Collide');
        if (this.tutorialGate === 'SLASH') {
          this.spawnTimer = 0.8;
        }
      }

      if (b.x < -30) {
        this.barricades.splice(i, 1);
        if (this.tutorialGate === 'SLASH') {
          this.spawnTimer = 0.8;
        }
      }
    }
  }

  private updateDrones(dt: number) {
    const isTutorial = this.runPhase === 'TUTORIAL';
    const subIndex = this.currentStage.subIndex;
    const loop = this.currentStage.loop;

    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      if (!d.alive) {
        this.drones.splice(i, 1);
        continue;
      }

      if (d.warningTimer > 0) {
        d.warningTimer -= dt;
      }

      d.time += dt;
      d.x -= d.speedX * dt;
      d.y = d.hoverBaseY + Math.sin(d.time * 4) * 8;

      // Progressive Drone Ordnance Drop
      if (!isTutorial && d.bombsDropped < d.bombsAllowed) {
        if (d.bombDropCooldown > 0) {
          d.bombDropCooldown -= dt;
        }

        // Trigger bomb drop charge when nearing the hero
        if (!d.isChargingBomb && d.bombDropCooldown <= 0) {
          const triggerMinX = d.bombsDropped === 0 ? this.heroX + 35 : this.heroX - 15;
          const triggerMaxX = d.bombsDropped === 0 ? this.heroX + 105 : this.heroX + 45;

          if (d.x >= triggerMinX && d.x <= triggerMaxX) {
            d.isChargingBomb = true;
            const baseCharge = Math.max(0.38, 0.75 - (subIndex - 1) * 0.08 - (loop - 1) * 0.05);
            d.bombChargeTimer = baseCharge;
          }
        }

        // Charging countdown
        if (d.isChargingBomb) {
          d.bombChargeTimer -= dt;
          if (d.bombChargeTimer <= 0) {
            d.isChargingBomb = false;
            d.bombsDropped++;
            d.bombDropCooldown = 0.85;

            const fallSpeed = 110 + (subIndex - 1) * 20 + (loop - 1) * 25;

            this.droneBombs.push({
              id: this.nextEntityId++,
              x: d.x,
              y: d.y + 6 * this.config.scale,
              vx: -d.speedX * 0.30,
              vy: fallSpeed,
              targetGroundY: this.config.groundY - 3 * this.config.scale,
              state: 'FALLING',
              blastRadius: (18 + Math.min(6, (subIndex - 1) * 1.2)) * this.config.scale,
              alive: true,
              time: 0,
            });

            audio.playBombDrop();
            this.fx.spawn('impacts/hit-spark', { x: d.x, y: d.y + 6 * this.config.scale }, 'front', 0.15);
          }
        }
      }

      // Contact with player
      if (Math.abs(d.x - this.heroX) < 14 * this.config.scale) {
        const dy = Math.abs(d.y - (this.config.heroY + this.heroYOffset));
        if (dy < 18 * this.config.scale) {
          this.drones.splice(i, 1);
          this.takeDamage('Drone Collision');
          if (this.tutorialGate === 'AERIAL') {
            this.spawnTimer = 0.8;
          }
        }
      }

      if (d.x < -30) {
        this.drones.splice(i, 1);
        if (this.tutorialGate === 'AERIAL') {
          this.spawnTimer = 0.8;
        }
      }
    }
  }

  private updateDroneBombs(dt: number) {
    const sc = this.config.scale;

    for (let i = this.droneBombs.length - 1; i >= 0; i--) {
      const bomb = this.droneBombs[i];
      if (!bomb.alive) {
        this.droneBombs.splice(i, 1);
        continue;
      }

      bomb.time += dt;
      bomb.x += bomb.vx * dt;
      bomb.y += bomb.vy * dt;
      bomb.vy += 220 * dt; // Gravity acceleration

      // 1. Direct mid-air impact with hero (if player jumps into the falling bomb)
      if (Math.abs(bomb.x - this.heroX) < 12 * sc) {
        const dy = Math.abs(bomb.y - (this.config.heroY + this.heroYOffset));
        if (dy < 14 * sc) {
          bomb.alive = false;
          this.triggerBombDetonation(bomb, true);
          continue;
        }
      }

      // 2. Ground impact
      if (bomb.y >= bomb.targetGroundY) {
        bomb.alive = false;
        this.triggerBombDetonation(bomb, false);
      }
    }
  }

  private triggerBombDetonation(bomb: DroneBombEntity, directHeroHit: boolean) {
    const impactX = bomb.x;
    const impactY = bomb.targetGroundY;

    audio.playBombExplode();
    this.triggerScreenShake(COMBAT_PARAMS.shakeLight, 3);
    this.fx.spawn('explosions/small-explosion', { x: impactX, y: impactY - 6 }, 'front', 0.28);
    this.fx.spawn('impacts/hit-spark', { x: impactX, y: impactY - 4 }, 'front', 0.18);

    if (directHeroHit) {
      this.takeDamage('Direct Bomb Strike');
      return;
    }

    // Blast radius check on ground
    const distX = Math.abs(impactX - this.heroX);
    if (distX < bomb.blastRadius) {
      if (this.isGrounded) {
        // Hero is caught on the ground in the blast!
        this.takeDamage('Bomb Blast Wave');
      } else if (this.heroYOffset < -12) {
        // Hero successfully jumped over the blast!
        this.stats.score += 50;
        this.addFloatText('JUMP DODGE! +50PT', this.heroX, this.config.heroY + this.heroYOffset - 16, '#00F0FF', 11);
      }
    }
  }

  private defuseDroneBomb(bomb: DroneBombEntity) {
    bomb.alive = false;
    audio.playHit(true);
    this.triggerHitStop(COMBAT_PARAMS.hitStopLight);
    this.triggerScreenShake(COMBAT_PARAMS.shakeLight, 2);
    this.addHit(true, 180);

    this.addFloatText('BOMB DEFUSED! +180PT', bomb.x, bomb.y - 14, PALETTE.critGold, 12);
    this.fx.spawn('explosions/small-explosion', { x: bomb.x, y: bomb.y }, 'front', 0.25);
    this.fx.spawn('impacts/shield-block', { x: bomb.x, y: bomb.y }, 'front', 0.20);
  }

  private updateShieldBots(dt: number) {
    for (let i = this.shieldBots.length - 1; i >= 0; i--) {
      const bot = this.shieldBots[i];
      if (!bot.alive) {
        this.shieldBots.splice(i, 1);
        continue;
      }

      if (bot.staggerTimer > 0) {
        bot.staggerTimer -= dt;
      } else {
        bot.x -= bot.speed * dt;
      }

      if (Math.abs(bot.x - this.heroX) < 14 * this.config.scale && this.heroYOffset >= -16) {
        this.shieldBots.splice(i, 1);
        this.takeDamage('Shield Bot Collide');
      }

      if (bot.x < -30) {
        this.shieldBots.splice(i, 1);
      }
    }
  }

  private updateLaserGrids(dt: number) {
    for (let i = this.laserGrids.length - 1; i >= 0; i--) {
      const l = this.laserGrids[i];
      if (!l.alive) {
        this.laserGrids.splice(i, 1);
        continue;
      }
      l.x -= l.speed * dt;

      if (Math.abs(l.x - this.heroX) < 10 * this.config.scale) {
        if (this.isGrounded) {
          l.alive = false;
          this.takeDamage('Laser Grid Sweep');
          if (this.tutorialGate === 'JUMP') {
            this.spawnTimer = 0.8;
          }
        } else if (this.heroYOffset <= -16) {
          l.alive = false;
          this.stats.score += 50;
          this.addFloatText('JUMP CLEAR!', this.heroX, this.config.heroY + this.heroYOffset - 12, '#00F0FF', 8);
          this.onTargetCleared();

          // Advance tutorial gate if in JUMP stage
          if (this.tutorialGate === 'JUMP') {
            this.tutorialGate = 'AERIAL';
            this.spawnTimer = 1.0;
            this.addFloatText('VAULT CLEAR!', this.heroX, this.config.heroY + this.heroYOffset - 25, PALETTE.electricBlue, 8);
            audio.playPowerUp();
          }
        }
      }

      if (l.x < -20) {
        this.laserGrids.splice(i, 1);
        if (this.tutorialGate === 'JUMP') {
          this.spawnTimer = 0.8;
        }
      }
    }
  }

  private updateShards(dt: number) {
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.life -= dt;
      const targetX = this.heroX;
      const targetY = this.config.heroY + this.heroYOffset - 8;
      const dx = targetX - s.x;
      const dy = targetY - s.y;
      const dist = Math.hypot(dx, dy);

      // Collect when close or when life expires (damped attraction guarantees arrival)
      if (dist < 14 * this.config.scale || s.life <= 0) {
        this.shards.splice(i, 1);
        this.stats.score += 25;
        audio.playShard(i);
        // Clean micro pickup spark, ABSOLUTELY NO looping crystal-shard!
        this.pickupFlashes.push({
          x: targetX + (Math.random() * 8 - 4),
          y: targetY + (Math.random() * 8 - 4),
          timer: 0.10,
        });
        continue;
      }

      // Smooth attraction with damping and velocity cap (prevents slingshot/orbiting)
      s.vx = s.vx * 0.90 + (dx / dist) * 550 * dt;
      s.vy = s.vy * 0.90 + (dy / dist) * 550 * dt;
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > 360) {
        s.vx = (s.vx / speed) * 360;
        s.vy = (s.vy / speed) * 360;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
  }

  private updateDebris(dt: number) {
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const deb = this.debrisList[i];
      deb.vy += 500 * dt;
      deb.x += deb.vx * dt;
      deb.y += deb.vy * dt;
      deb.rot += deb.rotSpeed * dt;

      if (deb.y > this.config.height + 40 || deb.x > this.config.width + 100 || deb.x < -100) {
        this.debrisList.splice(i, 1);
      }
    }
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const t = this.floatTexts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.life <= 0) {
        this.floatTexts.splice(i, 1);
      }
    }
  }

  // ================= RENDER =================
  public render() {
    const ctx = this.mainCtx;
    const { width, height, groundY, scale } = this.config;

    // Base fill preventing ghosting on screen shake margins
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(Math.round(this.shakeOffset.x), Math.round(this.shakeOffset.y));

    // 1. Cyberpunk Parallax Night Street (Darker backdrop)
    this.city.draw(ctx, width, height, groundY);

    // 2. Render pixelfx Back Layer
    this.fx.render();
    this.fx.drawBack(ctx);

    // 3. Contact Shadows for Player and Entities on the Road (Scaled & Depth-Aware)
    const jumpProgress = Math.min(1, Math.abs(this.heroYOffset) / 60);
    const heroShadowR = (10 - jumpProgress * 4.5) * scale;
    const heroShadowAlpha = 0.55 - jumpProgress * 0.32;
    drawContactShadow(ctx, this.heroX, groundY + 1, heroShadowR, heroShadowAlpha);

    for (const b of this.barricades) {
      if (b.alive) drawContactShadow(ctx, b.x, groundY + 1, 9 * scale, 0.5);
    }
    for (const bot of this.shieldBots) {
      if (bot.alive) drawContactShadow(ctx, bot.x, groundY + 1, 12 * scale, 0.55);
    }
    if (this.bossActive) {
      drawContactShadow(ctx, this.bossX, groundY + 1, 24 * scale, 0.65);
    }
    if (this.activeRepairPickup && this.activeRepairPickup.state !== 'TELEGRAPH') {
      const p = this.activeRepairPickup;
      const dropProgress = Math.min(1, Math.max(0, (p.targetY - p.y) / (24 * scale)));
      const batShadowR = (8 - dropProgress * 4) * scale;
      const batShadowAlpha = 0.48 - dropProgress * 0.28;
      drawContactShadow(ctx, p.x, groundY + 1, batShadowR, batShadowAlpha);
    }

    // 4. Ghost Trails (Aligned to same grounded foot anchor)
    for (const g of this.ghostTrails) {
      const gH = g.matrix.length;
      const gW = g.matrix[0]?.length || 16;
      const gOffsetX = 8;
      const gx = g.flipX ? Math.round(g.x - (gW - 1 - gOffsetX) * scale) : Math.round(g.x - gOffsetX * scale);
      const gy = Math.round(g.y - (gH - 1) * scale);
      drawPixelMatrix(ctx, g.matrix, HERO_PAL, gx, gy, scale, g.flipX, g.alpha);
    }

    // 5. Hero Sprite
    this.drawHero(ctx);

    // 6. Enemies & Boss
    this.drawEnemies(ctx);

    // 7. Pickups & Debris
    this.drawPickupsAndDebris(ctx);

    // 8. pixelfx Front Layer
    this.fx.drawFront(ctx);

    // 9. Floating Combat Popups
    this.drawFloatingTexts(ctx);

    // 9.5 Victory Gate 效果渲染 (方案1)
    this.drawVictoryGateEffects(ctx);

    ctx.restore();

    // 10. Pause Overlay
    if (this.isPaused) {
      this.drawPauseOverlay(ctx);
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D) {
    const x = this.heroX;
    const y = this.config.heroY + this.heroYOffset;
    const flipX = this.heroFacing === 'LEFT';
    const sc = this.config.scale;

    // Cyber Phase-Shift Invulnerability (holographic transparency rather than complete frame drop)
    const isPhaseShifting = this.invulnerableTimer > 0 && Math.sin(this.invulnerableTimer * 30) > 0.1;
    if (isPhaseShifting) {
      ctx.save();
      ctx.globalAlpha = 0.38;
    }

    // Damage flash white tint
    const flashWhite = this.damageFlashTimer > 0;

    let spriteMatrix: string[];

    if (!this.isGrounded) {
      if (this.attackState === 'ACTIVE') {
        spriteMatrix = HERO_AERIAL_SLASH;
      } else {
        spriteMatrix = HERO_JUMP;
      }
    } else {
      if (this.landingSquashTimer > 0) {
        spriteMatrix = HERO_LAND_SQUASH;
      } else if (this.attackState === 'STARTUP') {
        spriteMatrix = HERO_SLASH_START;
      } else if (this.attackState === 'ACTIVE') {
        spriteMatrix = HERO_SLASH_ACTIVE;
      } else if (this.attackState === 'RECOVERY') {
        spriteMatrix = HERO_SLASH_RECOVER;
      } else if (this.inputLeft || this.inputRight) {
        spriteMatrix = this.runFrame === 0 ? HERO_RUN_1 : HERO_RUN_2;
      } else {
        spriteMatrix = this.idleAnimTimer > 0.4 ? HERO_IDLE_2 : HERO_IDLE_1;
      }
    }

    // Palette with damage flash support
    const pal = flashWhite
      ? {
          ...HERO_PAL,
          w: '#FFFFFF',
          c: '#FFFFFF',
          b: '#FFFFFF',
          s: '#FFFFFF',
        }
      : HERO_PAL;

    // Symmetrical body-centered horizontal anchoring & ground-pinned vertical alignment
    // (Feet touch the pavement row regardless of animation frame height)
    const sprH = spriteMatrix.length;
    const sprW = spriteMatrix[0]?.length || 16;
    const sprOffsetX = 8;
    const drawHeroX = flipX ? Math.round(x - (sprW - 1 - sprOffsetX) * sc) : Math.round(x - sprOffsetX * sc);
    const drawHeroY = Math.round(y - (sprH - 1) * sc);

    drawPixelMatrix(ctx, spriteMatrix, pal, drawHeroX, drawHeroY, sc, flipX);

    // Draw dynamic bright blade light arc during 80ms ACTIVE attack window
    // Physically follows hero symmetrically whether facing left or right
    if (this.attackState === 'ACTIVE') {
      const isLeft = this.heroFacing === 'LEFT';
      const bladeY = Math.round(y - (this.attackInAir ? 8 : 12) * sc);
      const arcColor = this.comboTier === 5 ? PALETTE.critGold :
                       this.comboTier === 4 ? PALETTE.neonGreen :
                       this.comboTier === 3 ? PALETTE.coral :
                       this.comboTier === 2 ? '#00F0FF' : '#FFFFFF';

      ctx.save();
      ctx.fillStyle = arcColor;
      ctx.globalAlpha = 0.95;
      if (!isLeft) {
        const bx = Math.round(x + 12 * sc);
        ctx.fillRect(bx, bladeY, 8 * sc, 2 * sc);
        ctx.fillRect(bx + 4 * sc, bladeY + 2 * sc, 6 * sc, 4 * sc);
        ctx.fillRect(bx + 1 * sc, bladeY + 6 * sc, 4 * sc, 2 * sc);
      } else {
        const bx = Math.round(x - 12 * sc);
        ctx.fillRect(bx - 8 * sc, bladeY, 8 * sc, 2 * sc);
        ctx.fillRect(bx - 10 * sc, bladeY + 2 * sc, 6 * sc, 4 * sc);
        ctx.fillRect(bx - 5 * sc, bladeY + 6 * sc, 4 * sc, 2 * sc);
      }
      ctx.restore();
    }

    if (isPhaseShifting) {
      ctx.restore();
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D) {
    const sc = this.config.scale;

    // Barricades
    for (const b of this.barricades) {
      if (b.alive) {
        drawPixelMatrix(ctx, BARRICADE_FULL, BARRICADE_PAL, Math.round(b.x - 8 * sc), Math.round(b.y - 14 * sc), sc);
      }
    }

    // Shield Bots
    for (const bot of this.shieldBots) {
      if (bot.alive) {
        drawPixelMatrix(ctx, SHIELD_BOT_WALK, SHIELD_BOT_PAL, Math.round(bot.x - 10 * sc), Math.round(bot.y - 18 * sc), sc);
      }
    }

    // Laser Grid Hazard: Dual balanced emitter pylons with pulsating energy beam
    for (const l of this.laserGrids) {
      if (l.alive) {
        drawPixelMatrix(ctx, LASER_HAZARD_EMITTER, LASER_HAZARD_PAL, Math.round(l.x - 16 * sc), Math.round(l.y - 4 * sc), sc);
        drawPixelMatrix(ctx, LASER_HAZARD_EMITTER, LASER_HAZARD_PAL, Math.round(l.x + 8 * sc), Math.round(l.y - 4 * sc), sc);
        const beamPulse = 0.75 + 0.25 * Math.sin(this.survivalTimer * 24);
        ctx.fillStyle = `rgba(255, 77, 61, ${beamPulse})`;
        ctx.fillRect(Math.floor(l.x - 12 * sc), Math.floor(l.y - 1), 22 * sc, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(Math.floor(l.x - 10 * sc), Math.floor(l.y - 0.5), 18 * sc, 1);
      }
    }

    // Hover Drones
    for (const d of this.drones) {
      if (d.alive) {
        drawPixelMatrix(ctx, DRONE_IDLE, DRONE_PAL, Math.round(d.x - 9 * sc), Math.round(d.y - 6 * sc), sc);

        // Warning indicator on the right edge when drone is entering
        if (d.warningTimer > 0) {
          ctx.save();
          ctx.fillStyle = PALETTE.coral;
          ctx.fillRect(this.config.width - 6, Math.round(d.y - 2), 4, 4);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(this.config.width - 4, Math.round(d.y - 1), 2, 2);
          ctx.restore();
        }

        // Bomb Targeting Laser & Ground Crosshair when drone is charging a bomb drop
        if (d.isChargingBomb) {
          ctx.save();
          const pulse = Math.sin(this.survivalTimer * 22) > 0;
          ctx.strokeStyle = pulse ? 'rgba(255, 77, 61, 0.70)' : 'rgba(255, 209, 102, 0.40)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(d.x, d.y + 6 * sc);
          ctx.lineTo(d.x, this.config.groundY);
          ctx.stroke();

          // Charging ground target mark
          ctx.fillStyle = pulse ? PALETTE.coral : PALETTE.critGold;
          ctx.fillRect(Math.round(d.x - 5 * sc), this.config.groundY - 2, Math.round(10 * sc), 2);
          ctx.restore();
        }
      }
    }

    // Drone Falling Bombs & Ground Warning Markers
    for (const bomb of this.droneBombs) {
      if (bomb.alive) {
        // 1. Ground landing prediction warning mark
        const groundPulse = 0.5 + 0.5 * Math.sin(bomb.time * 16);
        ctx.fillStyle = groundPulse > 0.4 ? 'rgba(255, 77, 61, 0.75)' : 'rgba(255, 209, 102, 0.75)';
        ctx.fillRect(Math.round(bomb.x - 6 * sc), Math.round(bomb.targetGroundY - 2), Math.round(12 * sc), 2);

        // 2. Trailing heat spark
        ctx.fillStyle = '#FFD166';
        ctx.fillRect(Math.round(bomb.x - 1), Math.round(bomb.y - 4 * sc), 2, 3);

        // 3. Bomb Sprite
        drawPixelMatrix(ctx, DRONE_BOMB_SPRITE, DRONE_BOMB_PAL, Math.round(bomb.x - 3 * sc), Math.round(bomb.y - 3 * sc), sc);
      }
    }

    // Boss Giant Blind Box Core
    if (this.bossActive) {
      drawPixelMatrix(ctx, BOSS_CORE, BOSS_CORE_PAL, Math.round(this.bossX - 14 * sc), Math.floor(this.bossY), sc);

      // Clean boss health bar
      const barW = 75 * sc;
      const barH = 3;
      const barX = this.bossX - barW / 2;
      const barY = this.bossY - 8;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = PALETTE.critGold;
      ctx.fillRect(barX, barY, (this.bossHp / this.bossMaxHp) * barW, barH);
    }
  }

  private drawPickupsAndDebris(ctx: CanvasRenderingContext2D) {
    const sc = this.config.scale;

    // Repair Battery Supply Pickup
    if (this.activeRepairPickup) {
      const p = this.activeRepairPickup;
      drawRepairBattery(ctx, p.x, p.y, sc, p.state, this.survivalTimer, p.targetY);
    }

    // Blue shards
    for (const s of this.shards) {
      drawPixelMatrix(ctx, INSPIRATION_SHARD, SHARD_PAL, Math.floor(s.x), Math.floor(s.y), sc);
    }

    // Micro pickup flashes (subtle cyan gleam on absorption)
    for (const pf of this.pickupFlashes) {
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(Math.round(pf.x - 2), Math.round(pf.y - 2), 4, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(Math.round(pf.x - 1), Math.round(pf.y - 1), 2, 2);
    }

    // Debris
    for (const deb of this.debrisList) {
      ctx.save();
      ctx.translate(deb.x, deb.y);
      ctx.rotate(deb.rot);
      drawPixelMatrix(ctx, deb.matrix, deb.palette, Math.round(-4 * deb.scale), Math.round(-4 * deb.scale), deb.scale);
      ctx.restore();
    }
  }

  private drawStageBanner(ctx: CanvasRenderingContext2D) {
    if (!this.stageBannerText || this.stageBannerTimer <= 0) return;

    ctx.save();
    const cx = this.config.width / 2;
    const cy = 48;
    const sc = this.config.scale;

    // Fade out in last 0.4s
    const alpha = Math.min(1, this.stageBannerTimer / 0.4);
    ctx.globalAlpha = alpha;

    const mainText = this.stageBannerText;
    const subText = this.currentStage?.subtitleZh || '';

    ctx.font = 'bold 11px Silkscreen, "PingFang SC", monospace';
    const mainW = ctx.measureText(mainText).width;
    ctx.font = '8px "PingFang SC", "Microsoft YaHei", sans-serif';
    const subW = subText ? ctx.measureText(subText).width : 0;

    const boxW = Math.max(mainW, subW) + 28 * sc;
    const boxH = subText ? 32 : 18;

    // Dark cyber backdrop with theme accent border
    ctx.fillStyle = 'rgba(7, 10, 18, 0.92)';
    ctx.strokeStyle = this.currentStage?.theme?.accentColor || '#00F0FF';
    ctx.lineWidth = 1;

    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    // Accent corner notches
    const accentCol = this.currentStage?.theme?.accentColor || '#06D6A0';
    ctx.fillStyle = accentCol;
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, 3, 3);
    ctx.fillRect(cx + boxW / 2 - 3, cy - boxH / 2, 3, 3);
    ctx.fillRect(cx - boxW / 2, cy + boxH / 2 - 3, 3, 3);
    ctx.fillRect(cx + boxW / 2 - 3, cy + boxH / 2 - 3, 3, 3);

    // Main stage banner text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px Silkscreen, "PingFang SC", monospace';
    const mainY = subText ? cy - 6 : cy;
    ctx.fillText(mainText, cx, mainY);

    // Subtitle text (Landmarks, Weather, Storytelling detail)
    if (subText) {
      ctx.fillStyle = this.currentStage?.theme?.accentColor || '#00F0FF';
      ctx.font = '8px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(subText, cx, cy + 8);
    }

    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D) {
    for (const t of this.floatTexts) {
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      const sz = Math.min(t.size, 8);
      ctx.font = `bold ${sz}px Silkscreen, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, Math.floor(t.x), Math.floor(t.y));
      ctx.restore();
    }
  }

  private drawTutorialOverlay(ctx: CanvasRenderingContext2D) {
    if (!this.activeTutorialText) return;

    ctx.save();
    const cx = this.config.width / 2;
    const cy = 24;
    ctx.font = 'bold 9px Silkscreen, "PingFang SC", monospace';
    const textWidth = ctx.measureText(this.activeTutorialText).width;

    ctx.fillStyle = 'rgba(13, 13, 20, 0.85)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.fillRect(cx - textWidth / 2 - 8, cy - 10, textWidth + 16, 18);
    ctx.strokeRect(cx - textWidth / 2 - 8, cy - 10, textWidth + 16, 18);

    ctx.fillStyle = '#00F0FF';
    ctx.textAlign = 'center';
    ctx.fillText(this.activeTutorialText, cx, cy + 3);
    ctx.restore();
  }

  // === 方案1: Victory Gate 视觉效果渲染 ===
  private drawVictoryGateEffects(ctx: CanvasRenderingContext2D) {
    const sc = this.config.scale;
    const w = this.config.width;
    const h = this.config.height;

    // 1. 旗帜升起动画
    if (this.clearFlagTimer > 0) {
      const progress = 1 - (this.clearFlagTimer / 1.2); // 0 -> 1
      const flagH = Math.min(36, progress * 48) * sc;
      const flagY = 60 - progress * 30; // 从上方降下
      const flagX = w / 2 - 6 * sc;

      ctx.save();
      // 旗杆
      ctx.fillStyle = '#FFD166';
      ctx.fillRect(flagX, flagY, 2 * sc, flagH);
      // 旗帜
      ctx.fillStyle = '#FF2A6D';
      ctx.fillRect(flagX + 2 * sc, flagY + 4 * sc, 12 * sc, 10 * sc);
      // 旗帜装饰
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.min(6, 3 + progress * 3)}px Silkscreen`;
      ctx.textAlign = 'center';
      ctx.fillText('★', flagX + 8 * sc, flagY + 10 * sc);
      ctx.restore();
    }

    // 2. 扫光效果 (从左到右扫过)
    if (this.clearScanTimer > 0) {
      const progress = 1 - (this.clearScanTimer / 0.6);
      const scanX = w * progress;
      ctx.save();
      const grad = ctx.createLinearGradient(scanX - 40 * sc, 0, scanX + 40 * sc, 0);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(scanX - 60 * sc, 0, 120 * sc, h);
      ctx.restore();
    }

    // 3. 得分飞入动画 (从英雄位置飞向计分板方向)
    if (this.clearFlyScoreTimer > 0) {
      const progress = 1 - (this.clearFlyScoreTimer / 1.0);
      const flyX = this.clearScoreFlyX + (w - this.clearScoreFlyX - 30) * progress;
      const flyY = this.clearScoreFlyY - 60 * progress;

      ctx.save();
      ctx.font = `bold ${12 + 4 * (1 - progress)}px Silkscreen`;
      ctx.fillStyle = PALETTE.critGold;
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillText(`+${this.clearScoreValue}PT`, flyX, flyY);
      ctx.restore();
    }
  }

  private drawPauseOverlay(ctx: CanvasRenderingContext2D) {
    const { width, height } = this.config;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 8, 14, 0.7)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', width / 2, height / 2 - 10);

    ctx.fillStyle = PALETTE.critGold;
    ctx.font = '10px Silkscreen, monospace';
    ctx.fillText('PRESS ESC OR CLICK TO RESUME', width / 2, height / 2 + 10);
    ctx.restore();
  }

  public stop() {
    cancelAnimationFrame(this.animId);
  }
}
