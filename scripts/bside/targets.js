/**
 * SKAND B-Side — logo target sampler.
 *
 * Produces the two point sets the particle system morphs toward:
 *   • frame  — the rounded-rectangle outline of the real SKAND lockup
 *   • letters — "SKAND" sampled from the brand font (Outfit 800)
 *
 * Both are returned in a normalized 2D space where the frame's OUTER box is
 * x ∈ [-1, 1] and y ∈ [-H/2, H/2]. main.js scales that to world units, so
 * nothing here needs to know the viewport size.
 *
 * Why a 2D canvas for the letters and not TextGeometry: the target points are
 * the brand wordmark in the actual brand face. TextGeometry would need a
 * pre-baked typeface.json (a Node build step, which this buildless site can't
 * do) and would render helvetiker, the three.js demo font. Reading the real
 * glyph outlines off a canvas keeps the reveal unmistakably on-brand.
 *
 * The letter mapping is driven by the MEASURED ink bounding box of the
 * rendered glyphs, not by the nominal canvas box. Canvas text has padding and
 * a baseline offset, so assuming the ink is centered in the canvas mis-maps it
 * (it previously collapsed every glyph to its bottom edge). Measuring first
 * and then fitting that box into the letter box is robust to any font metrics.
 */

import { LETTERS } from './config.js';

// Frame geometry, in the normalized space.
const FRAME_W = 2.0;
const FRAME_H = 0.8;          // matches the ~600x240 proportions of logo_white.png
const FRAME_R = 0.13;         // corner radius
const FRAME_T = 0.05;         // stroke thickness
const FRAME_INSET = 0.085;    // padding between frame and letters

/**
 * Sample a rounded-rectangle outline at a given inward inset, evenly by
 * arc length. The four corner arcs each sweep exactly +90°, which is what
 * makes the outline close cleanly on itself.
 */
function roundedRectOutline(inset = 0) {
  const w = Math.max(0.02, FRAME_W - inset * 2);
  const h = Math.max(0.02, FRAME_H - inset * 2);
  const r = Math.max(0.005, Math.min(FRAME_R - inset, w / 2, h / 2));
  const x0 = -w / 2;
  const y0 = -h / 2;

  const straightX = w - r * 2;
  const straightY = h - r * 2;
  const arc = (Math.PI / 2) * r;
  const total = 2 * straightX + 2 * straightY + 4 * arc;
  const n = 720;

  const pts = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * total;
    let x;
    let y;
    if (d < straightX) {                        // top edge, left→right
      x = x0 + r + d; y = y0;
    } else if ((d -= straightX) < arc) {        // top-right corner: −90°→0°
      const a = -Math.PI / 2 + (d / arc) * (Math.PI / 2);
      x = x0 + w - r + r * Math.cos(a);
      y = y0 + r + r * Math.sin(a);
    } else if ((d -= arc) < straightY) {        // right edge, top→bottom
      x = x0 + w; y = y0 + r + d;
    } else if ((d -= straightY) < arc) {        // bottom-right corner: 0°→90°
      const a = (d / arc) * (Math.PI / 2);
      x = x0 + w - r + r * Math.cos(a);
      y = y0 + h - r + r * Math.sin(a);
    } else if ((d -= arc) < straightX) {        // bottom edge, right→left
      x = x0 + w - r - d; y = y0 + h;
    } else if ((d -= straightX) < arc) {        // bottom-left corner: 90°→180°
      const a = Math.PI / 2 + (d / arc) * (Math.PI / 2);
      x = x0 + r + r * Math.cos(a);
      y = y0 + h - r + r * Math.sin(a);
    } else if ((d -= arc) < straightY) {        // left edge, bottom→top
      x = x0; y = y0 + h - r - d;
    } else {                                     // top-left corner: 180°→270°
      const a = Math.PI + (d / arc) * (Math.PI / 2);
      x = x0 + r + r * Math.cos(a);
      y = y0 + r + r * Math.sin(a);
    }
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Frame points: the rounded-rect outline sampled across FRAME_T so the stroke
 * has real thickness and catches bloom on its edges. Returns a flat Float32Array
 * of [x0, y0, x1, y1, ...].
 */
function buildFrame() {
  const layers = Math.max(3, Math.round(FRAME_T * 320));
  const xy = [];
  for (let l = 0; l < layers; l++) {
    const t = layers === 1 ? 0.5 : l / (layers - 1);
    const outline = roundedRectOutline(t * FRAME_T);
    // Slightly reduce the sample count on inner layers to keep density even.
    const step = l === 0 || l === layers - 1 ? 1 : 2;
    for (let i = 0; i < outline.length; i += step) {
      xy.push(outline[i].x, outline[i].y);
    }
  }
  return new Float32Array(xy);
}

/**
 * Letter points: render "SKAND" in Outfit 800, find the real ink bounding box,
 * then jittered-grid sample the ink and map it (centered, aspect-fit) into the
 * frame's interior box.
 *
 * Returns { xy: Float32Array, letterIndex: Int8Array }.
 */
function buildLetters() {
  // The letter box: centered inside the frame with FRAME_INSET padding.
  const boxW = FRAME_W - FRAME_INSET * 2;
  const boxH = FRAME_H - FRAME_INSET * 2;

  const fontPx = 256;
  const tracking = fontPx * 0.1;
  const font = `800 ${fontPx}px Outfit, "Helvetica Neue", sans-serif`;

  // Measure to size the canvas.
  const mc = document.createElement('canvas').getContext('2d');
  mc.font = font;
  try { mc.letterSpacing = tracking + 'px'; } catch (e) { /* older Safari */ }
  const widths = LETTERS.map((ch) => mc.measureText(ch).width);
  const totalW = widths.reduce((s, w) => s + w, 0) + tracking * (LETTERS.length - 1);

  const pad = Math.ceil(fontPx * 0.4);
  const c = document.createElement('canvas');
  c.width = Math.ceil(totalW + pad * 2);
  c.height = Math.ceil(fontPx * 1.4 + pad * 2);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.font = font;
  try { ctx.letterSpacing = tracking + 'px'; } catch (e) { /* noop */ }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';

  // Lay the five glyphs out left→right.
  let penX = pad;
  const baseline = Math.round(c.height * 0.5 + fontPx * 0.35);
  const glyphSpans = [];
  LETTERS.forEach((ch, i) => {
    glyphSpans.push([penX, penX + widths[i]]);
    ctx.fillText(ch, penX, baseline);
    penX += widths[i] + tracking;
  });

  const img = ctx.getImageData(0, 0, c.width, c.height).data;

  // Measure the actual ink bounding box.
  let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (img[(y * c.width + x) * 4 + 3] > 40) {
        if (x < ix0) ix0 = x;
        if (x > ix1) ix1 = x;
        if (y < iy0) iy0 = y;
        if (y > iy1) iy1 = y;
      }
    }
  }
  // If nothing registered (font failed to load), fall back to the nominal box.
  if (ix0 === Infinity) {
    ix0 = pad; ix1 = pad + totalW;
    iy0 = baseline - fontPx * 0.7; iy1 = baseline;
  }

  // Fit the measured ink box into the letter box, preserving aspect, centered.
  const inkW = Math.max(1, ix1 - ix0);
  const inkH = Math.max(1, iy1 - iy0);
  const fit = Math.min(boxW / inkW, boxH / inkH);
  const inkCX = (ix0 + ix1) / 2;
  const inkCY = (iy0 + iy1) / 2;

  // Map a canvas point to normalized space (canvas y is down, world y is up).
  const mapX = (px) => (px - inkCX) * fit;
  const mapY = (py) => -(py - inkCY) * fit;

  // Which glyph does a pixel column belong to? Tags each point with its letter
  // index for per-letter color.
  const letterAtPx = (px) => {
    for (let i = glyphSpans.length - 1; i >= 0; i--) {
      if (px >= glyphSpans[i][0]) return i;
    }
    return 0;
  };

  // Jittered grid: one point per inked cell, jittered inside the cell so the
  // grid never shows. At this cell size we get ~45k base letter points, dense
  // enough that the wordmark reads as solid rather than as separate dots.
  const cell = 2;
  const xy = [];
  const letterIndex = [];
  for (let py = 0; py < c.height; py += cell) {
    for (let px = 0; px < c.width; px += cell) {
      let inked = false;
      for (let sy = 0; sy < cell && !inked; sy++) {
        for (let sx = 0; sx < cell && !inked; sx++) {
          const idx = ((py + sy) * c.width + (px + sx)) * 4;
          if (img[idx + 3] > 110) inked = true;
        }
      }
      if (!inked) continue;
      const jx = px + Math.random() * cell;
      const jy = py + Math.random() * cell;
      xy.push(mapX(jx), mapY(jy));
      letterIndex.push(letterAtPx(jx));
    }
  }
  return { xy: new Float32Array(xy), letterIndex: new Int8Array(letterIndex) };
}

/**
 * Build every target set, allocating the total particle budget between the
 * frame and the letters and resampling each to its share.
 */
export function buildTargets(totalParticles, frameShare) {
  const frame = buildFrame();
  const letters = buildLetters();

  const frameCount = Math.max(64, Math.round(totalParticles * frameShare));
  const letterCount = Math.max(64, totalParticles - frameCount);

  return {
    frame: { xy: resample(frame, frameCount), count: frameCount },
    letters: {
      xy: resample(letters.xy, letterCount),
      count: letterCount,
      letterIndex: resampleIndex(letters.letterIndex, letterCount),
    },
  };
}

/**
 * Uniform-stride resample of a flat [x,y,...] array to exactly `count` points.
 * A golden-ratio stride walks the source evenly without the banding of a plain
 * modulo, and reuses each source point a near-equal number of times when the
 * requested count exceeds the source length.
 */
function resample(src, count) {
  const srcCount = Math.floor(src.length / 2);
  const out = new Float32Array(count * 2);
  if (srcCount === 0) return out;
  const golden = 0.61803398875;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(((i * golden) % 1) * srcCount);
    out[i * 2] = src[idx * 2];
    out[i * 2 + 1] = src[idx * 2 + 1];
  }
  return out;
}

/** Resample a parallel index array with the same stride as `resample`. */
function resampleIndex(src, count) {
  const srcCount = src.length;
  const out = new Int8Array(count);
  if (srcCount === 0) return out;
  const golden = 0.61803398875;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(((i * golden) % 1) * srcCount);
    out[i] = src[idx];
  }
  return out;
}
