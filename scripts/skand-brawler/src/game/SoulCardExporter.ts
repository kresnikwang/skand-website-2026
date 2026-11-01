// Soul Card Exporter: Generates 1200x630 High-Definition Arcade Soul Record Card
// Pixel-perfect typography, four-dimensional combat stats, relic snapshot, and one-click PNG download

import { RelicConfig, RunStats, computeSoulSeed, PALETTE } from './spec';
import { RELIC_SPRITES, drawPixelMatrix } from './sprites';
import { getStageConfig } from './stages';
import { createFrame, clearFrame, createFx, composite } from '../vendor/pixelfx/core/index.js';
import { effects } from '../vendor/pixelfx/fx/index.js';

export class SoulCardExporter {
  public static async generateCard(relic: RelicConfig, stats: RunStats): Promise<Blob | null> {
    const W = 1200;
    const H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { hash, seed } = computeSoulSeed(stats);

    // 1. Deep Arcade Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#090A0F');
    bgGrad.addColorStop(0.5, '#101320');
    bgGrad.addColorStop(1, '#0C0D14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle background cyber grid
    ctx.strokeStyle = 'rgba(74, 124, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Outer framing double border
    ctx.strokeStyle = relic.palette[1] || PALETTE.coral;
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.strokeStyle = 'rgba(244, 246, 248, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    // Header: Studio & Seed
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Silkscreen, monospace';
    ctx.fillText('SKAND STUDIO', 56, 76);

    ctx.fillStyle = PALETTE.coral;
    ctx.font = '14px Silkscreen, monospace';
    ctx.fillText('ARCADE BRAWLER // SOUL CARD', 240, 75);

    ctx.fillStyle = PALETTE.critGold;
    ctx.font = 'bold 18px Silkscreen, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(hash, W - 56, 76);
    ctx.textAlign = 'left';

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(56, 96);
    ctx.lineTo(W - 56, 96);
    ctx.stroke();

    // 2. Left Column: Relic Visual & Live Glow Snapshot
    const relicBoxX = 56;
    const relicBoxY = 126;
    const relicBoxW = 420;
    const relicBoxH = 420;

    // Relic box background
    const relicGrad = ctx.createRadialGradient(
      relicBoxX + relicBoxW / 2,
      relicBoxY + relicBoxH / 2,
      20,
      relicBoxX + relicBoxW / 2,
      relicBoxY + relicBoxH / 2,
      200
    );
    relicGrad.addColorStop(0, `${relic.palette[1]}33`);
    relicGrad.addColorStop(1, 'rgba(13, 13, 17, 0.8)');
    ctx.fillStyle = relicGrad;
    ctx.fillRect(relicBoxX, relicBoxY, relicBoxW, relicBoxH);

    ctx.strokeStyle = `${relic.palette[1]}88`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(relicBoxX, relicBoxY, relicBoxW, relicBoxH);

    // Render pixelfx snapshot at t=40
    try {
      const fxMod = (effects as Record<string, any>)[relic.primaryFx];
      if (fxMod) {
        const fw = 140;
        const fh = 140;
        const fxFrame = createFrame(fw, fh);
        clearFrame(fxFrame);
        const fxInst = createFx(fxMod, {
          x: fw / 2,
          y: fh / 2,
          seed,
          palette: relic.palette,
          light: 1.5,
        });
        for (let i = 0; i < 40; i++) {
          fxInst.update(1 / 60);
        }
        fxInst.draw(fxFrame);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = fw;
        offCanvas.height = fh;
        const offCtx = offCanvas.getContext('2d')!;
        const imgData = offCtx.createImageData(fw, fh);
        composite(fxFrame, imgData.data, null, 1.3);
        offCtx.putImageData(imgData, 0, 0);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offCanvas, relicBoxX + 60, relicBoxY + 60, 300, 300);
      }
    } catch (e) {
      console.warn('Fx snapshot render in card failed:', e);
    }

    // Render Relic Matrix Sprite on top
    const relicSprite = RELIC_SPRITES[relic.id];
    if (relicSprite) {
      ctx.imageSmoothingEnabled = false;
      const sprScale = 7;
      const sprW = (relicSprite.matrix[0]?.length || 24) * sprScale;
      const sprH = relicSprite.matrix.length * sprScale;
      const sprX = relicBoxX + (relicBoxW - sprW) / 2;
      const sprY = relicBoxY + (relicBoxH - sprH) / 2;
      drawPixelMatrix(ctx, relicSprite.matrix, relicSprite.palette, sprX, sprY, sprScale);
    }

    // Relic Serial & Name Pill
    ctx.fillStyle = relic.palette[1] || PALETTE.coral;
    ctx.fillRect(relicBoxX + 16, relicBoxY + 16, 68, 26);
    ctx.fillStyle = '#0D0D11';
    ctx.font = 'bold 14px Silkscreen, monospace';
    ctx.fillText(relic.number, relicBoxX + 26, relicBoxY + 34);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Silkscreen, monospace';
    ctx.fillText(relic.enName.toUpperCase(), relicBoxX + 96, relicBoxY + 35);

    // 3. Right Column: Title, Critique, and Stats
    const rightX = 520;

    // Pure English Soul Title
    ctx.fillStyle = PALETTE.critGold;
    ctx.font = 'bold 30px Silkscreen, monospace';
    ctx.fillText(relic.titleEn, rightX, 160);

    ctx.fillStyle = 'rgba(244, 246, 248, 0.7)';
    ctx.font = 'bold 15px Silkscreen, monospace';
    ctx.fillText(`${relic.enName.toUpperCase()} · ${relic.number}`, rightX, 192);

    // Quote Box
    ctx.fillStyle = 'rgba(26, 30, 48, 0.6)';
    ctx.fillRect(rightX, 214, W - rightX - 56, 78);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(rightX, 214, W - rightX - 56, 78);

    ctx.fillStyle = '#F4F6F8';
    ctx.font = '13px Silkscreen, monospace';

    // Multi-line word-wrapping preventing long critique quotes from clipping quote box
    const maxQuoteW = W - rightX - 96;
    const words = relic.quoteZh.split(' ');
    const quoteLines: string[] = [];
    let curLine = '';
    for (const word of words) {
      const test = curLine ? `${curLine} ${word}` : word;
      if (ctx.measureText(test).width > maxQuoteW && curLine.length > 0) {
        quoteLines.push(curLine);
        curLine = word;
      } else {
        curLine = test;
      }
    }
    if (curLine) quoteLines.push(curLine);

    const startQuoteY = quoteLines.length <= 1 ? 258 : 246;
    quoteLines.forEach((line, i) => {
      ctx.fillText(line, rightX + 20, startQuoteY + i * 20);
    });

    // Stats Grid - Modern Brawler Metrics
    const statTopY = 316;
    const statRowH = 46;
    const statW = W - rightX - 56;

    const slashes = stats.slashHits ?? stats.rightHits ?? 0;
    const aerials = stats.aerialKills ?? stats.leftParries ?? 0;
    const sweetCrits = stats.sweetSpotCrits ?? stats.critHits ?? 0;
    const sweetRate = slashes > 0 ? Math.round((sweetCrits / slashes) * 100) : 0;

    const statRows = [
      { label: 'GROUND SLASHES', val: `${slashes} HITS`, bar: Math.min(slashes / 30, 1), color: PALETTE.coral },
      { label: 'AERIAL CLEAVES', val: `${aerials} KILLS`, bar: Math.min(aerials / 8, 1), color: PALETTE.electricBlue },
      { label: 'SWEET SPOT ACCURACY', val: `${sweetRate}% (${sweetCrits})`, bar: Math.min(sweetRate / 100, 1), color: PALETTE.critGold },
      { label: 'MAX COMBO REACHED', val: `x${stats.maxCombo}`, bar: Math.min(stats.maxCombo / 28, 1), color: PALETTE.neonGreen },
    ];

    statRows.forEach((row, idx) => {
      const y = statTopY + idx * statRowH;

      ctx.fillStyle = 'rgba(244, 246, 248, 0.7)';
      ctx.font = '12px Silkscreen, monospace';
      ctx.fillText(row.label, rightX, y + 14);

      ctx.fillStyle = row.color;
      ctx.font = 'bold 15px Silkscreen, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(row.val, W - 56, y + 14);
      ctx.textAlign = 'left';

      // Bar background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(rightX, y + 22, statW, 8);

      // Bar fill
      ctx.fillStyle = row.color;
      ctx.fillRect(rightX, y + 22, statW * row.bar, 8);
    });

    // Score & Shield Breakdown Row
    const scoreY = 502;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Silkscreen, monospace';
    ctx.fillText(`TOTAL SCORE: ${stats.score} PT`, rightX, scoreY);

    ctx.fillStyle = '#9EA4B8';
    ctx.font = '12px Silkscreen, monospace';
    ctx.textAlign = 'right';
    const repText = `REPAIRED: ${stats.repairsCollected ?? 0} | DAMAGE: ${stats.damageTaken ?? 0} | SHIELDS: ${stats.shieldsLeft}/3`;
    ctx.fillText(repText, W - 56, scoreY);
    ctx.textAlign = 'left';

    // Endless Run Global World City Breakthrough Badge Pill
    const badgeY = 522;
    const isCleared = (stats.stagesCleared ?? 0) > 0;
    const badgeColor = isCleared ? PALETTE.neonGreen : PALETTE.coral;

    ctx.fillStyle = isCleared ? 'rgba(6, 214, 160, 0.12)' : 'rgba(255, 77, 61, 0.12)';
    ctx.fillRect(rightX, badgeY, statW, 24);
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(rightX, badgeY, statW, 24);

    const reachedStage = getStageConfig(stats.highestStageReached ?? 1);
    const flawless = stats.damageTaken === 0;
    const badgeTitle = isCleared
      ? (flawless
          ? `* FLAWLESS: ${stats.stagesCleared} CLEARED // ${reachedStage.titleZh} *`
          : `* CLEARED ${stats.stagesCleared} STAGES // ${reachedStage.titleZh} *`)
      : `CRITICAL ALERT // TERMINATED IN ${reachedStage.titleZh}`;

    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 11px Silkscreen, monospace';
    ctx.fillText(badgeTitle, rightX + 10, badgeY + 16);

    ctx.fillStyle = PALETTE.critGold;
    ctx.font = '11px Silkscreen, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`TIME: ${stats.timeSurvived}s · LOOP ${stats.loopCount ?? 1}`, W - 66, badgeY + 16);
    ctx.textAlign = 'left';

    // Footer Branding
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(56, 560);
    ctx.lineTo(W - 56, 560);
    ctx.stroke();

    ctx.fillStyle = 'rgba(244, 246, 248, 0.5)';
    ctx.font = '12px Silkscreen, monospace';
    ctx.fillText('SKAND STUDIO · CREATIVE TECH & GAME LAB · 2026', 56, 588);

    ctx.textAlign = 'right';
    ctx.fillText('SKANDSTUDIO.COM/PLAY', W - 56, 588);
    ctx.textAlign = 'left';

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  public static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
