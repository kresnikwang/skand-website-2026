import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, GameState } from './game/engine';
import { getStageConfig } from './game/stages';
import {
  RELICS,
  RelicConfig,
  RunStats,
  evaluateRelic,
  computeSoulSeed,
  PALETTE,
} from './game/spec';
import { SoulCardExporter } from './game/SoulCardExporter';
import { RELIC_SPRITES, drawPixelMatrix } from './game/sprites';
import { audio } from './game/audio';
import { createFrame, clearFrame, createFx, composite } from './vendor/pixelfx/core/index.js';
import { effects } from './vendor/pixelfx/fx/index.js';

const STORAGE_KEY = 'SKAND_BRAWLER_UNLOCKED_RELICS';
const TUTORIAL_STORAGE_KEY = 'SKAND_BRAWLER_TUTORIAL_DONE';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const relicPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // States
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [runPhase, setRunPhase] = useState<'TUTORIAL' | 'RUN' | 'RESULT'>('RUN');
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(false);
  const [currentStageId, setCurrentStageId] = useState<string>('tokyo');
  const [stageNumber, setStageNumber] = useState<number>(1);
  const [stageProgress, setStageProgress] = useState<number>(0);
  const [stageTargetCount, setStageTargetCount] = useState<number>(7);
  const [stageTitle, setStageTitle] = useState<string>('TOKYO · SHINJUKU');
  const [survivalTime, setSurvivalTime] = useState<number>(0);
  const [stats, setStats] = useState<RunStats>({
    slashHits: 0,
    sweetSpotCrits: 0,
    aerialKills: 0,
    shieldBreaks: 0,
    critHits: 0,
    whiffCount: 0,
    totalHits: 0,
    maxCombo: 0,
    shieldsLeft: 3,
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
  });
  const [combo, setCombo] = useState<number>(0);
  const [comboTier, setComboTier] = useState<number>(1);

  // End game relic & archive
  const [awardedRelic, setAwardedRelic] = useState<RelicConfig | null>(null);
  const [unlockedRelicIds, setUnlockedRelicIds] = useState<string[]>([]);
  const [showArchive, setShowArchive] = useState<boolean>(false);
  const [selectedRelic, setSelectedRelic] = useState<RelicConfig | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // In-Game Crisp Notifications (Stage banners & Tutorial guide)
  const [bannerNotice, setBannerNotice] = useState<{ title: string; subtitle?: string } | null>(null);
  const [tutorialNotice, setTutorialNotice] = useState<string | null>(null);

  // Load unlocked relics and tutorial status on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUnlockedRelicIds(JSON.parse(stored));
      }
      const tutDone = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (tutDone === 'true') {
        setTutorialCompleted(true);
      }
    } catch (e) {
      console.warn('Failed to read localStorage:', e);
    }
  }, []);

  const saveRelicUnlock = (relicId: string) => {
    setUnlockedRelicIds((prev) => {
      if (!prev.includes(relicId)) {
        const next = [...prev, relicId];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn('Failed to save to localStorage:', e);
        }
        return next;
      }
      return prev;
    });
  };

  // Initialize engine and dynamic resize handler
  useEffect(() => {
    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    if (canvasRef.current && !engineRef.current) {
      const engine = new GameEngine(canvasRef.current, window.innerWidth, window.innerHeight);
      engine.onStateChange = (newState, finalStats) => {
        setGameState(newState);
        setStats(finalStats);
        if (newState === 'VICTORY' || newState === 'GAMEOVER') {
          const relic = evaluateRelic(finalStats);
          setAwardedRelic(relic);
          setSelectedRelic(relic);
          if (newState === 'VICTORY') {
            saveRelicUnlock(relic.id);
          }
        }
      };

      engine.onStatsUpdate = (
        currentStats,
        curCombo,
        curTier,
        curSurvivalTime,
        curStageNum,
        curProgress,
        curTargetCount,
        curStageId,
        curStageTitle
      ) => {
        setStats({ ...currentStats });
        setCombo(curCombo);
        setComboTier(curTier);
        setSurvivalTime(curSurvivalTime);
        setStageNumber(curStageNum);
        setStageProgress(curProgress);
        setStageTargetCount(curTargetCount);
        if (curStageId) setCurrentStageId(curStageId);
        if (curStageTitle) setStageTitle(curStageTitle);
        setRunPhase(engine.runPhase);
      };

      engine.onTutorialComplete = () => {
        try {
          localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
        } catch {}
        setTutorialCompleted(true);
        setRunPhase('RUN');
      };

      engine.onBannerNotice = (banner) => {
        setBannerNotice(banner);
      };

      engine.onTutorialNotice = (notice) => {
        setTutorialNotice(notice);
      };

      engineRef.current = engine;
      engine.startMenuPreview();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
  }, []);

  // Window Focus, Visibility & Interruption Handling (Auto-Pause)
  useEffect(() => {
    const handleBlur = () => {
      if (engineRef.current && engineRef.current.state === 'PLAYING') {
        engineRef.current.setMoveLeft(false);
        engineRef.current.setMoveRight(false);
        engineRef.current.setPaused(true);
        setIsPaused(true);
      }
    };

    const handleVisibility = () => {
      if (document.hidden && engineRef.current && engineRef.current.state === 'PLAYING') {
        engineRef.current.setMoveLeft(false);
        engineRef.current.setMoveRight(false);
        engineRef.current.setPaused(true);
        setIsPaused(true);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Keyboard controls: Move Left/Right, Jump, Attack, Pause, Mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        const p = engineRef.current.togglePause();
        setIsPaused(p);
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        const muted = audio.toggleMute();
        setIsMuted(muted);
        return;
      }

      if (gameState !== 'PLAYING' || engineRef.current.isPaused) return;

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        engineRef.current.setMoveLeft(true);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        engineRef.current.setMoveRight(true);
      } else if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        engineRef.current.handleJump();
      } else if (e.code === 'KeyJ' || e.code === 'KeyF' || e.code === 'KeyZ' || e.code === 'Enter') {
        e.preventDefault();
        engineRef.current.handleAttack();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        engineRef.current.setMoveLeft(false);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        engineRef.current.setMoveRight(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Live 120Hz Relic Preview Loop in Endgame / Archive
  useEffect(() => {
    const canvas = relicPreviewCanvasRef.current;
    if (!canvas || !selectedRelic) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const fw = 180;
    const fh = 180;
    canvas.width = fw;
    canvas.height = fh;

    const frame = createFrame(fw, fh);
    const allEffects = effects as Record<string, any>;
    const fxMod = allEffects[selectedRelic.primaryFx] || allEffects['holy/sunburst'];
    const { seed } = computeSoulSeed(stats);

    const fxInst = fxMod
      ? createFx(fxMod, {
          x: fw / 2,
          y: fh / 2,
          seed,
          palette: selectedRelic.palette,
          light: 1.5,
        })
      : null;

    const imgData = ctx.createImageData(fw, fh);
    let lastT = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastT) / 1000;
      lastT = time;

      if (fxInst) {
        fxInst.update(dt);
        clearFrame(frame);
        fxInst.draw(frame);
      }

      composite(frame, imgData.data, null, 1.4);
      ctx.putImageData(imgData, 0, 0);

      const spr = RELIC_SPRITES[selectedRelic.id];
      if (spr) {
        const sprScale = 3;
        const w = (spr.matrix[0]?.length || 24) * sprScale;
        const h = spr.matrix.length * sprScale;
        const sx = (fw - w) / 2;
        const sy = (fh - h) / 2;
        drawPixelMatrix(ctx, spr.matrix, spr.palette, sx, sy, sprScale);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [selectedRelic, gameState, showArchive]);

  // Handlers
  const handleStartFormal = () => {
    if (engineRef.current) {
      engineRef.current.start('RUN');
      setRunPhase('RUN');
      setGameState('PLAYING');
      setIsPaused(false);
    }
  };

  const handleStartTutorial = () => {
    if (engineRef.current) {
      engineRef.current.start('TUTORIAL');
      setRunPhase('TUTORIAL');
      setGameState('PLAYING');
      setIsPaused(false);
    }
  };

  const handleSkipTutorial = () => {
    if (engineRef.current) {
      engineRef.current.skipTutorial();
      try {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      } catch {}
      setTutorialCompleted(true);
      setRunPhase('RUN');
    }
  };

  const handleStartGame = handleStartFormal;

  const handleTogglePause = () => {
    if (engineRef.current) {
      const p = engineRef.current.togglePause();
      setIsPaused(p);
    }
  };

  const handleToggleMute = () => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  const handleReturnToMenu = () => {
    setGameState('MENU');
    setIsPaused(false);
    engineRef.current?.startMenuPreview();
  };

  const handleReturnHome = () => {
    window.location.href = '/';
  };

  const handleDownloadCard = async () => {
    if (!awardedRelic || isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = await SoulCardExporter.generateCard(awardedRelic, stats);
      if (blob) {
        const { hash } = computeSoulSeed(stats);
        SoulCardExporter.downloadBlob(blob, `SKAND-SOUL-CARD-${hash.replace(/[^a-zA-Z0-9]/g, '')}.png`);
      }
    } catch (e) {
      console.error('Failed to generate soul card:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && gameState === 'PLAYING' && engineRef.current && !isPaused) {
      engineRef.current.handleAttack();
    }
  };

  return (
    <div className="game-viewport" onContextMenu={handleContextMenu}>
      {/* Scanline CRT overlay */}
      <div className="scanlines" />

      {/* Main Fullscreen 2D Pixel Canvas */}
      <canvas
        ref={canvasRef}
        className="pixel-canvas"
        onPointerDown={handleCanvasPointerDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'fill',
        }}
      />

      {/* Virtual Arcade Gamepad with Pointer Capture */}
      {gameState === 'PLAYING' && (
        <div className="arcade-touch-overlay">
          {/* Left / Right Movement D-Pad */}
          <div className="arcade-touch-group">
            <button
              type="button"
              className="arcade-touch-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                try {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                } catch {}
                engineRef.current?.setMoveLeft(true);
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                try {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {}
                engineRef.current?.setMoveLeft(false);
              }}
              onPointerCancel={(e) => {
                try {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {}
                engineRef.current?.setMoveLeft(false);
              }}
            >
              ◀<span className="arcade-btn-label">LEFT</span>
            </button>

            <button
              type="button"
              className="arcade-touch-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                try {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                } catch {}
                engineRef.current?.setMoveRight(true);
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                try {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {}
                engineRef.current?.setMoveRight(false);
              }}
              onPointerCancel={(e) => {
                try {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {}
                engineRef.current?.setMoveRight(false);
              }}
            >
              ▶<span className="arcade-btn-label">RIGHT</span>
            </button>
          </div>

          {/* Staggered Jump & Larger Slash Action Pad */}
          <div className="arcade-touch-group-actions">
            <button
              type="button"
              className="arcade-touch-btn arcade-touch-btn-jump"
              onPointerDown={(e) => {
                e.preventDefault();
                engineRef.current?.handleJump();
              }}
            >
              ↑<span className="arcade-btn-label">JUMP</span>
            </button>

            <button
              type="button"
              className="arcade-touch-btn arcade-touch-btn-slash"
              onPointerDown={(e) => {
                e.preventDefault();
                engineRef.current?.handleAttack();
              }}
            >
              ⚔<span className="arcade-btn-label">SLASH</span>
            </button>
          </div>
        </div>
      )}

      {/* START MENU SCREEN */}
      {gameState === 'MENU' && (
        <div className="ui-layer interactive arcade-title-overlay">
          {/* 1. Top Arcade Cabinet Header Bar */}
          <div className="arcade-header-bar">
            <span>🕹️ SKAND ARCADE // SYSTEM 2026</span>
            <span className="arcade-coin-tag">● INSERT COIN ● CREDITS: 01</span>
            <span>1P READY // 60 FPS</span>
          </div>

          {/* 2. Main Arcade Hero Card */}
          <div className="arcade-hero-card">
            <div className="arcade-brand-subtitle">
              SKAND STUDIO // 2026
            </div>

            <h1 className="arcade-grand-title">
              SKAND BRAWLER
            </h1>

            {/* 3. Arcade Primary & Secondary CTA Action Buttons */}
            <div className="arcade-cta-group">
              {tutorialCompleted ? (
                <>
                  <button
                    className="arcade-start-btn"
                    onClick={() => {
                      audio.unlock();
                      audio.playPowerUp();
                      handleStartFormal();
                    }}
                  >
                    <span>🕹️</span>
                    <span>INSERT COIN</span>
                  </button>

                  <div className="arcade-sub-btns">
                    <button
                      className="arcade-btn arcade-btn-secondary"
                      style={{ flex: 1, fontSize: '11px', padding: '9px' }}
                      onClick={() => {
                        audio.unlock();
                        handleStartTutorial();
                      }}
                    >
                      🔰 PRACTICE MODE
                    </button>
                    <button
                      className="arcade-btn arcade-btn-secondary"
                      style={{ flex: 1, fontSize: '11px', padding: '9px' }}
                      onClick={() => {
                        audio.unlock();
                        setShowArchive(true);
                      }}
                    >
                      🏆 RELIC VAULT ({unlockedRelicIds.length}/6)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    className="arcade-start-btn"
                    onClick={() => {
                      audio.unlock();
                      audio.playPowerUp();
                      handleStartTutorial();
                    }}
                  >
                    <span>🕹️</span>
                    <span>INSERT COIN</span>
                  </button>

                  <div className="arcade-sub-btns">
                    <button
                      className="arcade-btn arcade-btn-secondary"
                      style={{ flex: 1, fontSize: '11px', padding: '9px' }}
                      onClick={() => {
                        audio.unlock();
                        handleStartFormal();
                      }}
                    >
                      SKIP TUTORIAL ⏭
                    </button>
                    <button
                      className="arcade-btn arcade-btn-secondary"
                      style={{ flex: 1, fontSize: '11px', padding: '9px' }}
                      onClick={() => {
                        audio.unlock();
                        setShowArchive(true);
                      }}
                    >
                      🏆 RELIC VAULT ({unlockedRelicIds.length}/6)
                    </button>
                  </div>
                </>
              )}

              <button
                className="arcade-btn arcade-btn-secondary"
                style={{ width: '100%', fontSize: '11px', color: PALETTE.coral, padding: '8px' }}
                onClick={handleReturnHome}
              >
                ← Back to SKANDSTUDIO
              </button>
            </div>

            {/* 4. Arcade Keyboard Controls Guide Bar */}
            <div className="arcade-controls-guide-bar">
              <span><span className="arcade-keycap">A / D</span> MOVE</span>
              <span><span className="arcade-keycap">SPACE / W</span> VAULT</span>
              <span><span className="arcade-keycap">J / Z / F</span> SLASH</span>
              <span><span className="arcade-keycap">P</span> PAUSE</span>
              <span><span className="arcade-keycap">M</span> MUTE</span>
            </div>
          </div>

          {/* 7. Bottom Arcade Machine Footer Bar */}
          <div className="arcade-footer-meta">
            <span>© 2026 SKAND STUDIO · COIN-OP EDITION</span>
            <span>CYBERPUNK RETRO ARCADE BRAWLER</span>
            <span>SHANGHAI // TOKYO</span>
          </div>
        </div>
      )}

      {/* BATTLE HUD */}
      {gameState === 'PLAYING' && (
        <div className="ui-layer" style={{ padding: '12px 16px', justifyContent: 'space-between' }}>
          {/* Top HUD Layout - Two Dedicated Rows preventing overlaps on mobile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {/* Row 1: Shields & Stage (Left) & Controls (Right) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(8, 8, 16, 0.75)', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '10px', color: '#9EA4B8' }}>SHIELDS</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[1, 2, 3].map((idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-block',
                          width: '11px',
                          height: '11px',
                          background: idx <= stats.shieldsLeft ? PALETTE.neonGreen : '#34384A',
                          boxShadow: idx <= stats.shieldsLeft ? `0 0 6px ${PALETTE.neonGreen}` : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Stage Indicator Badge */}
                {runPhase === 'TUTORIAL' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 240, 255, 0.12)', border: '1px solid #00F0FF', padding: '4px 8px' }}>
                    <span style={{ fontSize: '10px', color: '#00F0FF', fontWeight: 'bold' }}>
                      TUTORIAL
                    </span>
                    <button
                      type="button"
                      onClick={handleSkipTutorial}
                      style={{
                        background: 'rgba(255, 77, 61, 0.3)',
                        border: '1px solid #FF4D3D',
                        color: '#FFF',
                        fontSize: '9px',
                        padding: '2px 6px',
                        cursor: 'pointer',
                      }}
                    >
                      SKIP ⏭
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: currentStageId === 'core' ? 'rgba(255, 209, 102, 0.15)' : 'rgba(8, 8, 16, 0.75)',
                    border: `1px solid ${currentStageId === 'core' ? PALETTE.critGold : 'rgba(255,255,255,0.15)'}`,
                    padding: '5px 10px',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <span style={{ color: currentStageId === 'core' ? PALETTE.critGold : '#00F0FF', fontWeight: 'bold' }}>
                      STAGE {stageNumber}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '10px' }}>
                      {stageTitle}
                    </span>
                    {currentStageId !== 'core' && (
                      <span style={{ color: PALETTE.critGold, fontSize: '9px', marginLeft: '2px', background: 'rgba(255,209,102,0.12)', padding: '1px 5px', border: '1px solid rgba(255,209,102,0.25)' }}>
                        PROGRESS: {stageProgress}/{stageTargetCount}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Pause & Mute buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="hud-icon-btn"
                  onClick={handleTogglePause}
                  title="Pause (P / ESC)"
                >
                  {isPaused ? '▶' : '⏸'}
                </button>

                <button
                  type="button"
                  className="hud-icon-btn"
                  onClick={handleToggleMute}
                  title="Mute (M)"
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
              </div>
            </div>

            {/* Row 2: Dynamic Combo Multiplier Badge (Left) & Timer/Score (Right) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {combo > 0 ? (
                  <div style={{ background: 'rgba(8, 8, 16, 0.85)', border: `1px solid ${comboTier >= 5 ? PALETTE.critGold : PALETTE.coral}`, padding: '3px 10px', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: comboTier >= 5 ? PALETTE.critGold : PALETTE.white, marginRight: '8px' }}>
                      COMBO ×{combo}
                    </span>
                    <span style={{ fontSize: '9px', color: comboTier >= 5 ? PALETTE.critGold : comboTier >= 3 ? PALETTE.coral : '#00F0FF' }}>
                      {comboTier === 5
                        ? '★ SKAND OVERDRIVE ★'
                        : comboTier === 4
                        ? 'TIER 4 CYBER LIGHT BLADE'
                        : comboTier === 3
                        ? 'TIER 3 FLAME SLASH'
                        : comboTier === 2
                        ? 'TIER 2 LIGHTNING'
                        : 'TIER 1 MELEE'}
                    </span>
                  </div>
                ) : (
                  <div style={{ height: '24px' }} />
                )}
              </div>

              <div style={{ textAlign: 'right', background: 'rgba(8, 8, 16, 0.75)', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '10px', color: '#06D6A0', marginRight: '8px', fontWeight: 'bold' }}>
                  CLEARED: {stats.stagesCleared ?? 0}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: PALETTE.white, marginRight: '8px' }}>
                  TIME: {survivalTime}s
                </span>
                <span style={{ fontSize: '10px', color: PALETTE.critGold }}>
                  SCORE: {stats.score}
                </span>
              </div>
            </div>

            {/* High-DPI Crisp Toast Notifications (Stage banners & Tutorial guide) */}
            {bannerNotice && (
              <div className="hud-toast-banner">
                <div className="hud-toast-title">{bannerNotice.title}</div>
                {bannerNotice.subtitle && (
                  <div className="hud-toast-sub">{bannerNotice.subtitle}</div>
                )}
              </div>
            )}

            {tutorialNotice && (
              <div className="hud-toast-tutorial">
                <span className="hud-toast-badge">GUIDE</span>
                <span className="hud-toast-text">{tutorialNotice}</span>
              </div>
            )}
          </div>

          {/* Desktop compact control hint banner (centered bottom) */}
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '3px' }}>
              [A / D MOVE] [SPACE / W VAULT] [J / Z / F SLASH] [P PAUSE]
            </span>
          </div>
        </div>
      )}

      {/* ENDGAME / VICTORY / RESULT SCREEN */}
      {(gameState === 'VICTORY' || gameState === 'GAMEOVER') && awardedRelic && (
        <div className="settlement-overlay interactive">
          <div
            className="settlement-card"
            style={{ borderColor: awardedRelic.palette[1] || PALETTE.coral }}
          >
            {/* Header: Status & Seed */}
            <div className="settlement-header">
              <div>
                <span className="settlement-kicker" style={{ color: awardedRelic.palette[1] || PALETTE.coral }}>
                  {gameState === 'VICTORY' ? 'MISSION ACCOMPLISHED' : 'MISSION REPORT'}
                </span>
                <h2 className="settlement-title">
                  {awardedRelic.number} {awardedRelic.titleEn}
                </h2>
              </div>
              <span className="settlement-seed-pill">
                {computeSoulSeed(stats).hash}
              </span>
            </div>

            {/* Performance Summary Banner */}
            <div
              className="settlement-summary-bar"
              style={{
                borderColor: (stats.stagesCleared ?? 0) > 0 ? PALETTE.neonGreen : PALETTE.coral,
                background: (stats.stagesCleared ?? 0) > 0 ? 'rgba(6, 214, 160, 0.12)' : 'rgba(255, 77, 61, 0.12)',
                color: (stats.stagesCleared ?? 0) > 0 ? PALETTE.neonGreen : PALETTE.coral,
              }}
            >
              <span>
                {(stats.stagesCleared ?? 0) > 0
                  ? `★ CLEARED ${stats.stagesCleared ?? 0} STAGES · ${getStageConfig(stats.highestStageReached ?? 1).titleZh} ★`
                  : `FALLEN IN ${getStageConfig(stats.highestStageReached ?? 1).titleZh}`}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.75)' }}>{stats.timeSurvived}s</span>
            </div>

            {/* 4 Core KPI Stat Tiles (Clean 2x2 Grid) */}
            <div className="settlement-stats-grid">
              <div className="settlement-stat-tile">
                <span className="settlement-stat-label">TOTAL SCORE</span>
                <span className="settlement-stat-val" style={{ color: PALETTE.neonGreen }}>
                  {stats.score.toLocaleString()} PT
                </span>
              </div>
              <div className="settlement-stat-tile">
                <span className="settlement-stat-label">MAX COMBO</span>
                <span className="settlement-stat-val" style={{ color: PALETTE.critGold }}>
                  ×{stats.maxCombo} {stats.maxCombo >= 28 ? '★' : ''}
                </span>
              </div>
              <div className="settlement-stat-tile">
                <span className="settlement-stat-label">SLASH HITS</span>
                <span className="settlement-stat-val" style={{ color: PALETTE.coral }}>
                  {(stats.slashHits ?? stats.rightHits)} HITS
                </span>
              </div>
              <div className="settlement-stat-tile">
                <span className="settlement-stat-label">SWEET CRITS</span>
                <span className="settlement-stat-val" style={{ color: PALETTE.critGold }}>
                  {stats.sweetSpotCrits ?? 0} ({stats.slashHits > 0 ? Math.round(((stats.sweetSpotCrits ?? 0) / stats.slashHits) * 100) : 0}%)
                </span>
              </div>
            </div>

            {/* Forged Relic Showcase Badge (Compact & Visual) */}
            <div className="settlement-relic-box">
              <div className="settlement-relic-canvas-wrap">
                <canvas ref={relicPreviewCanvasRef} style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: awardedRelic.palette[1] || PALETTE.coral, fontWeight: 'bold' }}>
                    RELIC {awardedRelic.number}
                  </span>
                  <span style={{ fontSize: '9px', color: PALETTE.critGold }}>
                    {awardedRelic.enName.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {awardedRelic.titleEn}
                </div>
                <div style={{ fontSize: '10px', color: '#9EA4B8', fontStyle: 'italic', lineHeight: 1.3 }}>
                  “{awardedRelic.quoteZh}”
                </div>
              </div>
            </div>

            {/* Actions: Primary Start, Secondary Save, Bottom Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button
                className="arcade-btn arcade-btn-primary"
                style={{ width: '100%', fontSize: '13px', padding: '11px' }}
                onClick={handleStartFormal}
              >
                PLAY AGAIN
              </button>

              <button
                className="arcade-btn arcade-btn-secondary"
                style={{ width: '100%', fontSize: '11px', padding: '9px' }}
                onClick={handleDownloadCard}
                disabled={isDownloading}
              >
                {isDownloading ? 'FORGING SOUL CARD...' : 'SAVE SOUL CARD ↓'}
              </button>

              <div className="settlement-sub-actions">
                <button
                  className="arcade-btn arcade-btn-secondary"
                  style={{ fontSize: '10px', padding: '7px', color: '#00F0FF' }}
                  onClick={handleReturnToMenu}
                >
                  TITLE MENU
                </button>

                <button
                  className="arcade-btn arcade-btn-secondary"
                  style={{ fontSize: '10px', padding: '7px' }}
                  onClick={() => setShowArchive(true)}
                >
                  RELICS ({unlockedRelicIds.length}/6)
                </button>

                <button
                  className="arcade-btn arcade-btn-secondary"
                  style={{ fontSize: '10px', padding: '7px', color: PALETTE.coral }}
                  onClick={handleReturnHome}
                >
                  ← Back to SKANDSTUDIO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RELIC ARCHIVE MODAL WITH UNLOCK CONDITIONS */}
      {showArchive && (
        <div className="modal-backdrop interactive" onClick={() => setShowArchive(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '16px', color: PALETTE.white }}>
                RELIC VAULT // ARTIFACT ARCHIVE ({unlockedRelicIds.length}/6)
              </h2>
              <button
                style={{ background: 'none', border: 'none', color: '#9EA4B8', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setShowArchive(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '11px', color: '#9EA4B8', lineHeight: '1.5' }}>
              Master distinct combat disciplines across world waves to forge relics. Select any unlocked relic to inspect dynamic particle shader fx.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
              {RELICS.map((r) => {
                const unlocked = unlockedRelicIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (unlocked) setSelectedRelic(r);
                    }}
                    style={{
                      background: unlocked ? 'rgba(26, 20, 48, 0.75)' : 'rgba(15, 12, 26, 0.45)',
                      border: `1px solid ${unlocked ? r.palette[1] || PALETTE.coral : 'rgba(255,255,255,0.1)'}`,
                      padding: '10px',
                      cursor: unlocked ? 'pointer' : 'default',
                      opacity: unlocked ? 1 : 0.65,
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ width: '44px', height: '44px', background: '#0D0D11', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                      {unlocked ? (
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: r.palette[1] }}>
                          {r.number}
                        </span>
                      ) : (
                        <span style={{ fontSize: '16px', color: '#5B6075' }}>?</span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10px', color: r.palette[1] }}>{r.number} {r.enName}</span>
                        <span style={{ fontSize: '9px', color: unlocked ? PALETTE.neonGreen : '#5B6075' }}>
                          {unlocked ? '✓ UNLOCKED' : 'LOCKED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: unlocked ? PALETTE.white : '#9EA4B8', marginTop: '2px' }}>
                        {unlocked ? `${r.titleEn} · ${r.name.toUpperCase()}` : '??? CLASSIFIED RELIC'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9EA4B8', marginTop: '3px' }}>
                        CRITERIA: {r.unlockConditionZh}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button className="arcade-btn arcade-btn-secondary" onClick={() => setShowArchive(false)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
