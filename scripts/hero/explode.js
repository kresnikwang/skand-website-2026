/**
 * SKAND hero — exploded-view project showcase.
 *
 * The SKAND wordmark is the core part; 12 selected project plates float around it
 * across four z-depths, inside a set of concentric guide rings, wired together
 * with hairline leader lines and projected HUD callouts. Scrolling pulls the
 * assembly apart, then dives straight through the guide rings and into the plates
 * as they close on the lens and dissolve — handing off to the Work section below.
 *
 * Engineering notes:
 * - All imports are absolute esm.sh URLs so nested `from 'three'` gets rewritten
 *   by esm.sh — same reason as scripts/egg/scene.js, and it avoids depending on
 *   an importmap that nothing in this repo actually hits.
 * - Plates use MeshBasicMaterial on purpose: they are printed slices, not solids.
 *   Uniform brightness per plate + FogExp2 gives clean aerial perspective, which
 *   is the depth cue a technical exploded drawing wants. MeshStandardMaterial
 *   would light each plate independently and break that read.
 * - No EffectComposer/UnrealBloomPass (unlike egg/scene.js, where bloom IS the
 *   visual). Bloom would smear the 1px leader lines and HUD text.
 * - shared.js is imported without a `?v=` query on purpose — dispatcher.js relies
 *   on that to keep a single instance, and this module must join the same one.
 */
import * as THREE from 'https://esm.sh/three@0.170.0';
import { brandTextCanvas } from '../logo/shared.js';

const CORAL = 0xe8563a;
const BLUE = 0x4052b5;

const HERO = document.getElementById('hero');
const STAGE = document.getElementById('heroStage');
const HUD = document.getElementById('heroHud');
const GRID = document.getElementById('heroStaticGrid');

/* ------------------------------------------------------------------ */
/*  Layout — 12 plates across 4 z-depths                                */
/* ------------------------------------------------------------------ */

// [angleDeg, z, rotY, rotX, scale, leaderSignX]
//
// The ring is described in POLAR + NORMALISED form on purpose. A hardcoded
// world-x like 6.3 looks fine at exactly one aspect ratio and camera distance
// and falls apart at every other one: the horizontal room available at a given
// z is (CAM_Z - z) * tan(fov/2) * aspect, so a near plate (z = +2.6) only gets
// ~4.9 units of half-width while a far one (z = -5.0) gets ~9.5. Absolute
// coordinates that look right on a wide desktop therefore push near plates
// clean off the side on a narrower window. Resolving the ring against the live
// frustum instead keeps every plate inside the frame at any aspect.
//
// radius is a fraction of the *safe* half-extent at that plate's own depth —
// the frustum extent minus the plate's own half-size and a margin — so a plate
// can never overlap the frame edge no matter how wide it gets.
//
// Angles run 0deg = +x, 90deg = up, and are spread across the 220deg of ring
// that the bottom-centre wedge does not steal: .hero-meta (tagline, button,
// scroll cue) owns roughly 200deg-340deg, and no plate is aimed into it.
// Roughly 20deg apart keeps neighbours distinguishable without going
// mechanical — the spacing should read as a drawing, not a clock face. Depths
// alternate around the ring so adjacent plates layer in z instead of stacking
// into one flat pile.
//
// The plate at each position changes daily (see heroIdxForDay in index.html), so
// this table is deliberately described by angle and depth rather than by project
// name — it is a composition, not a cast list. Its length is the hero's plate
// count: it is indexed positionally against the picked items, so the two have to
// agree.
//
// Eleven slots, and the split is deliberate: five on the left, five on the
// right, one on the axis behind the wordmark. It used to be six/five/one, and the
// sixth left slot — 160° — sat in the middle of the left-hand stack, where it was
// the least separable plate in the frame. With the near, big plates (150° and
// 130°, both at z = 2.6) above it and the wide 175° plate below, there was no gap
// anywhere on that side, and the eye read the whole left third as one mass. The
// right had three plates with clean air between them and did not need the extra.
const LAYOUT = [
  [ 150,  2.6, -0.30,  0.06, 1.00, -1],
  [  40,  2.6,  0.30, -0.05, 1.00,  1],
  [  10,  0.7,  0.34,  0.07, 0.94,  1],
  [ 175,  0.7,  0.32, -0.06, 0.94, -1],
  [ 195, -2.2,  0.26,  0.05, 0.86, -1],
  [ 350,  0.7, -0.26, -0.07, 0.94,  1],
  [  90, -5.0, -0.22,  0.05, 0.76,  1],
  [  70, -2.2,  0.36,  0.04, 0.86,  1],
  [ 130,  2.6, -0.34, -0.06, 1.00, -1],
  [ 110, -5.0,  0.26,  0.05, 0.76,  1],
  [  30, -5.0,  0.32,  0.04, 0.76,  1],
];

const PLATE_W = 2.0;
const PLATE_H = PLATE_W / 1.776; // all 52 webp assets are 1000x563
const LEADER_LEN = 1.05;

// The frustum is much wider than it is tall, so the ring is a wide ellipse and
// the two axes get separate factors. Horizontally there is room to genuinely
// come apart; vertically there is not — a near plate (z = +2.6) only has ~3.0
// units of half-height, so pushing it further up would just push it off the top.
// Compressing x at rest and opening it up is what makes the scroll read as an
// explosion instead of a slow zoom.
const RING_REST_X = 0.60;
const RING_REST_Y = 0.86;
const RING_OUT_X = 1.00;
const RING_OUT_Y = 0.97;
const EDGE_MARGIN = 0.34; // world units of breathing room at the frame edge

// The ring may not reach the top 22% of the frame. That band belongs to the
// site header, and plates landing under it turn the nav into unreadable
// overlapping text. Expressed in NDC-y so it holds at any viewport height.
const TOP_CLEAR_NDC = 0.78;

const CAM_Z = 10.5;
const CAM_Y = 0.4;
// Where the plates end up, resolved on resize (see resolveDive) rather than
// hardcoded: a fixed "just in front of the lens" put them three frame-widths
// wide, so they had left the screen entirely before the fade finished and the
// last fifth of the scroll was a black screen. Arrival now means *one plate
// fills the frame* — the closest thing to looking at a case full-screen, which
// is the handoff into the Work section below.
let diveZ = CAM_Z - 1.5;

// The wordmark dives like everything else. It starts nearer the lens than the
// plates (it has to read over them at rest) and arrives at the depth where it
// spans this fraction of the frame width — 1.15 so it is a little wider than
// the screen at the moment it goes, which is the whole point of it charging the
// camera instead of dissolving.
const WM_Z0 = 1.6;
const WM_SPAN_FRAC = 1.15;
let wmDiveZ = CAM_Z - 0.5;

// How far the plates drift outward from their own screen position during the
// dive, on top of the magnification. Holding position exactly (1.0) is the
// cleanest tunnel, but by the end twelve plates each the size of the frame are
// all arriving at full strength at once, and twelve full-frame transparent
// images stacked on the same pixels is the mess the eye reads as cheap. A small
// spread cannot de-overlap that — the magnification factor is around seven, so
// nothing short of 7 would — but it does pull the outer plates past the frame
// edge early enough to stop the rim of the collage, which is most of what
// makes a stack look like a stack. Applied in NDC, and eased from 1, so it is
// the growth rate that falls, not the arrival.
const DIVE_SPREAD = 1.16;

// How big a plate is when it arrives, as a fraction of the frame width. The
// arrival used to be "wider than the screen" (a factor of 0.92, i.e. 109% of
// the frame). Twelve plates each bigger than the frame do not compose: they
// cover every pixel, so the last third of the dive is one flat collage of
// overlapping screenshots with no depth order and no focal point, and opacity
// does not save it because transparent plates accumulate. A plate that lands at
// roughly two-thirds of the frame is still four times its size at rest, which is
// the whole charge, but leaves air around itself — so what the eye reads at the
// end is several distinct cases rushing past rather than a wall.
const DIVE_ARRIVE = 1.5;

/* ------------------------------------------------------------------ */
/*  Capability detection                                                */
/* ------------------------------------------------------------------ */

const mq = (q) => window.matchMedia(q).matches;
// Stricter than egg/scene.js: the hero is on every visitor's critical path,
// and pointer:coarse alone would wrongly demote high-DPI iPads and touch
// laptops that can comfortably run the full scene.
const measureLowPower = () =>
  mq('(pointer: coarse)') ||
  mq('(max-width: 768px)') ||
  (navigator.hardwareConcurrency || 8) <= 4 ||
  (navigator.deviceMemory || 8) <= 4;

const measureWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (_) {
    return false;
  }
};

// Whether this device gets the full scene. index.html's head answers this before
// the first paint, because the answer's only job is to let CSS hide the H1 that
// the scene's own wordmark replaces — and a deferred module waiting on
// document.fonts.ready cannot get there before the first frame. So read its
// answer. Re-deriving it here would mean two implementations of one gate, and
// the failure mode of that is a device that ends up with neither a scene nor a
// heading, with nothing in the console to say why.
const flag = (k) => (typeof window[k] === 'boolean' ? window[k] : undefined);
const lowPower = flag('__HERO_LOWPOWER') ?? measureLowPower();
const tier0 = flag('__HERO_TIER0') ??
  (!mq('(prefers-reduced-motion: reduce)') && !lowPower && measureWebGL());

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ------------------------------------------------------------------ */
/*  Tier 1 — static grid (no canvas)                                    */
/* ------------------------------------------------------------------ */

function mountStaticGrid(items) {
  if (!GRID) return;
  HERO.classList.add('has-static-grid');
  // This is also the destination for a lost WebGL context, where the 3D layer
  // has already been torn down but left its classes and projected callouts
  // behind. Strip them so the grid is the only thing on screen, and release the
  // scroll travel the scene had reserved — otherwise the visitor is left with
  // 100vh of dead space and frozen labels floating over the fallback.
  HERO.classList.remove('has-stage');
  STAGE?.classList.remove('is-live');
  STAGE?.classList.remove('is-clickable');
  // The grid is headed by the H1, so hand the heading back if we are arriving
  // here from a lost context — the 3D layer hides it on boot and nothing else
  // would ever bring it back. The pre-paint hiding in index.html's head goes too:
  // it hid the H1 on a prediction that the scene would run, and here the scene is
  // not running. (From the tier-1 boot path the class was never added, so this is
  // a no-op; from context loss it is the only thing that gives the heading back.)
  document.documentElement.classList.remove('hero-3d');
  document.getElementById('heroTitle')?.classList.remove('is-replaced');
  document.getElementById('heroTitle')?.removeAttribute('aria-hidden');
  HUD?.classList.remove('is-live');
  HUD?.replaceChildren();

  // Cells are buttons, exactly like the 3D callouts: tier 1 is what every
  // phone and every reduced-motion visitor sees, so if the plates are clickable
  // in one tier they have to be clickable here too.
  GRID.innerHTML = items
    .map((it) => {
      const num = String(it.n + 1).padStart(2, '0');
      const label = window.__HERO_MEDIA.catLabel(it.cat);
      return `<button type="button" class="hero-static-cell" data-src="${it.srcIdx}"
          style="background-image:url(${it.blur || 'none'})"
          aria-label="${escapeHtml(it.brand)} — ${escapeHtml(it.name)}">
          <img src="${it.webp}" alt="" loading="lazy" decoding="async" draggable="false">
          <span><i>${num}</i>${escapeHtml(it.brand)} · ${escapeHtml(label)}</span>
        </button>`;
    })
    .join('');

  GRID.querySelectorAll('.hero-static-cell').forEach((cell) => {
    cell.addEventListener('click', () =>
      window.__skandFocusProject?.(Number(cell.dataset.src))
    );
  });

  GRID.querySelectorAll('img').forEach((img) => {
    const cell = img.parentElement;
    const done = () => cell.classList.add('loaded');
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });

  fitStaticGrid();
  window.addEventListener('resize', fitStaticGrid, { passive: true });

  // Still hand off to Work on scroll, just without any 3D in between.
  window.addEventListener('scroll', () => markDone(true), { passive: true });
  announceHandoff(true);
}

// Cell size is a width-driven layout, which is fine until it isn't: at 2
// columns a phone gets six rows, and six rows of 16:9 plates are taller than
// the viewport — the grid runs off the bottom and collides with the meta block.
// So the row height is solved against the space actually left between the top
// of the grid and the top of the meta cluster, both measured live. The grid's
// own top does not depend on its row height (it simply follows the wordmark),
// so it can be measured before the rows are set.
function fitStaticGrid() {
  if (!GRID || !HERO.classList.contains('has-static-grid')) return;

  const style = getComputedStyle(GRID);
  const cols = style.gridTemplateColumns.split(' ').filter(Boolean).length || 4;
  const rows = Math.ceil(GRID.children.length / cols);
  const gap = parseFloat(style.rowGap) || 10;

  const heroRect = HERO.getBoundingClientRect();
  const gridTop = GRID.getBoundingClientRect().top - heroRect.top;
  const meta = HERO.querySelector('.hero-meta');
  // Fall back to the scroll cue's neighbourhood if the meta is ever absent.
  const limitEdge = meta
    ? meta.getBoundingClientRect().top - heroRect.top
    : heroRect.height - 120;

  const room = limitEdge - gridTop - gap * (rows - 1);
  const rowH = clamp(Math.floor(room / rows), 60, 240);
  GRID.style.gridTemplateRows = `repeat(${rows}, ${rowH}px)`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/* ------------------------------------------------------------------ */
/*  Tier 0 — Three.js scene                                             */
/* ------------------------------------------------------------------ */

let disposed = false;
let rafId = 0;

async function initThree(items) {
  const renderer = new THREE.WebGLRenderer({
    antialias: !lowPower,
    alpha: false,
    powerPreference: lowPower ? 'low-power' : 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  STAGE.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.FogExp2(0x0a0a0a, lowPower ? 0.028 : 0.02);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, CAM_Y, CAM_Z);
  camera.lookAt(0, 0, 0);

  // Every plate, the leader-line mesh, the guide rings and the wordmark live under
  // this one group, so the whole assembly can be handled as a unit. It is
  // currently never offset — the group earns its keep as a single teardown
  // boundary and as the place the wordmark belongs. The wordmark is a member like
  // any other: it used to sit outside and be animated on its own, which is what
  // made it read as caption copy fading out under the images instead of another
  // piece being carried at the camera.
  const assembly = new THREE.Group();
  scene.add(assembly);

  // Plates are MeshBasic so these only light the wordmark rim and the frames.
  scene.add(new THREE.AmbientLight(0xffffff, 0.38));
  const key = new THREE.DirectionalLight(0xfff2ea, 1.2);
  key.position.set(4, 6, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(BLUE, 0.55);
  fill.position.set(-6, -2, 4);
  scene.add(fill);
  const rim = new THREE.PointLight(CORAL, 1.5, 30);
  rim.position.set(0, 0, 4);
  scene.add(rim);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ---- wordmark: Canvas2D -> CanvasTexture, not TextGeometry ----
     The brand face is Cormorant Garamond (--font-display). Loading helvetiker
     like egg/scene.js does would swap in a Helvetica and contradict the whole
     "the wordmark is the core part" premise. Two triangles also beat a
     triangulated glyph outline on a first-screen budget. */
  const wm = brandTextCanvas({ text: 'SKAND', size: 210, weight: 500, letterSpacing: 8 });
  const wmTex = new THREE.CanvasTexture(wm.canvas);
  wmTex.colorSpace = THREE.SRGBColorSpace;
  wmTex.anisotropy = maxAniso;
  const wmH = 1.5;
  const wmW = (wmH * wm.width) / wm.height;
  const wordmark = new THREE.Mesh(
    new THREE.PlaneGeometry(wmW, wmH),
    new THREE.MeshBasicMaterial({ map: wmTex, transparent: true, depthWrite: false })
  );
  wordmark.position.set(0, 0.15, WM_Z0);
  // depthWrite is off on both the wordmark and the plates, so scene-graph
  // order decides the composite. Draw the core last — the whole composition
  // reads off it, so it should never be clipped by a plate that happens to
  // share its screen space.
  wordmark.renderOrder = 10;
  assembly.add(wordmark);

  /* ---- plates ---- */
  const plateGeo = new THREE.PlaneGeometry(PLATE_W, PLATE_H);
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(PLATE_W, PLATE_H));
  const loader = new THREE.TextureLoader();
  const plates = [];

  items.forEach((it, i) => {
    const [deg, z, ry, rx, sc, sign] = LAYOUT[i];
    const group = new THREE.Group();
    group.position.set(0, 0, z);
    group.rotation.set(rx, ry, 0);
    group.scale.setScalar(sc);
    assembly.add(group);

    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(plateGeo, mat);
    group.add(mesh);

    const frame = new THREE.LineSegments(
      frameGeo,
      new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.18 })
    );
    group.add(frame);

    const rad = (deg * Math.PI) / 180;

    plates.push({
      item: it, group, mesh, mat, frame, sign,
      // Polar spec, resolved to world units by resolveRing() on every resize.
      cos: Math.cos(rad), sin: Math.sin(rad), z, sc,
      home: new THREE.Vector3(),
      out: new THREE.Vector3(),
      // Outward unit direction, i.e. the ray the leader line extends along.
      dir: new THREE.Vector2(Math.cos(rad), Math.sin(rad)),
      // Where the leader line ends and the callout sits, relative to the plate.
      anchorOff: new THREE.Vector3(),
      rotHome: group.rotation.clone(),
      blurTex: null,
      loaded: false,
      depth: z,
    });
  });

  /* ---- guide rings ---------------------------------------------------- */
  // The old 2D hero had a set of concentric hairlines behind the wordmark. They
  // were lost when the 3D scene replaced it — the WebGL canvas is opaque, so it
  // simply drew over the DOM versions. They are rebuilt here as real geometry
  // rather than restored as divs, because the dive needs them to move: they sit
  // between the lens and the plates and rush past the camera, so the scroll
  // reads as passing *through* something instead of watching a collage get
  // bigger. Opacities and colours match the CSS they replace.
  //
  // Geometry is a unit circle and the radius is applied as a scale, resolved
  // against the live frustum on every resize for the same reason the plates are:
  // a fixed world radius is off-frame at some aspect ratios and tiny at others.
  // `frac` reproduces the old circles' size relative to the frame width.
  const RING_SPEC = [
    { z: 4.0, c: BLUE, o: 0.17, frac: 0.347 },
    { z: 1.0, c: CORAL, o: 0.12, frac: 0.486 },
    { z: -2.0, c: BLUE, o: 0.08, frac: 0.625 },
  ];
  const rings = RING_SPEC.map(({ z, c, o, frac }) => {
    const pts = [];
    for (let a = 0; a <= 96; a++) {
      const th = (a / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(th), Math.sin(th), 0));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0 })
    );
    line.position.z = z;
    line.userData = { base: o, z, frac, r: 0, reach: 1 };
    assembly.add(line);
    return line;
  });

  // The rings sit slightly in front of the plate plane, so the dive sweeps them
  // past the lens before the plates arrive.
  assembly.position.z = 0.6;

  function resolveRings() {
    const ref = frustumHalf(RING_SPEC[RING_SPEC.length - 1].z, CAM_Z).w;
    for (const ring of rings) {
      const { z, frac } = ring.userData;
      const w = frustumHalf(z, CAM_Z).w;
      ring.userData.r = w * frac;
      // How much extra this ring needs to cover the same screen area as the far
      // one — so all three swell past the frame edges together instead of the
      // near ring leaving long before the far one arrives.
      ring.userData.reach = w / ref;
    }
  }

  /* ---- leader lines: one LineSegments for the whole set ---- */
  const leaderPos = new Float32Array(items.length * 6);
  const leaderGeo = new THREE.BufferGeometry();
  leaderGeo.setAttribute('position', new THREE.BufferAttribute(leaderPos, 3));
  const leaderMat = new THREE.LineBasicMaterial({
    color: BLUE, transparent: true, opacity: 0,
  });
  const leaders = new THREE.LineSegments(leaderGeo, leaderMat);
  leaders.frustumCulled = false;
  assembly.add(leaders);

  /* ---- HUD callouts ---- */
  // A <button>, not a <div>: the plates are painted into a canvas, so the
  // callout is the only part of a project the keyboard and a screen reader can
  // actually reach. It also gives each plate a small, always-legible hit target
  // next to the artwork for anyone who finds the 3D pick fiddly.
  const tags = items.map((it) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hero-hud-tag';
    el.innerHTML =
      `<span class="hero-hud-num">${String(it.n + 1).padStart(2, '0')}</span>` +
      `<span class="hero-hud-brand">${escapeHtml(it.brand)}</span>` +
      `<span class="hero-hud-cat"></span>`;
    el.setAttribute('aria-label', `${it.brand} — ${it.name}`);
    el.title = it.name;
    el.addEventListener('click', () => window.__skandFocusProject?.(it.srcIdx));
    // The site's cursor is a custom ring that only "lights up" over elements
    // registered with it at load; these are created later, so wire it here.
    el.addEventListener('mouseenter', () => document.querySelector('.cursor-ring')?.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.querySelector('.cursor-ring')?.classList.remove('hovering'));
    HUD.appendChild(el);
    return el;
  });
  const catSpans = tags.map((t) => t.querySelector('.hero-hud-cat'));

  function relabel() {
    items.forEach((it, i) => {
      catSpans[i].textContent = window.__HERO_MEDIA.catLabel(it.cat);
    });
  }
  relabel();
  window.addEventListener('skand:lang', relabel);

  // Tag widths are needed to keep every callout fully inside the viewport.
  // Measuring here is deliberate: the tags start at opacity 0, and reading
  // offsetWidth on a frame-1 loop before layout settles returns 0.
  const tagW = tags.map(() => 0);
  function measureTags() {
    tags.forEach((t, i) => { tagW[i] = t.offsetWidth; });
  }

  /* ---- textures: blur-up, 4 eager + a throttled queue ---- */
  let inflight = 0;
  const queue = [];

  function pump() {
    while (inflight < 4 && queue.length) {
      const p = queue.shift();
      inflight++;
      loader
        .loadAsync(p.item.webp)
        .then((tex) => {
          if (disposed) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAniso;
          p.mat.map = tex;
          p.mat.needsUpdate = true;
          if (p.blurTex) { p.blurTex.dispose(); p.blurTex = null; }
        })
        .catch(() => {
          // A missing plate keeps its blur wash — the HUD callout still carries
          // the information, so a failed image is never a blank hole.
        })
        .finally(() => { inflight--; pump(); });
    }
  }

  const byDepth = plates.slice().sort((a, b) => b.depth - a.depth);
  // The four nearest plates are the ones a visitor reads first, so only those
  // compete for bandwidth during load. The rest wait for the main thread to go
  // idle — or for the first scroll, whichever comes first, so a visitor who
  // dives straight into the explosion never sees a half-resolved ring.
  const deferred = [];
  let released = false;
  const releaseDeferred = () => {
    if (released || disposed) return;
    released = true;
    while (deferred.length) queue.push(deferred.pop());
    pump();
  };
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  idle(releaseDeferred, { timeout: 3000 });

  byDepth.forEach((p, i) => {
    // Blur first: 20px base64, effectively free, screen is never empty.
    loader
      .loadAsync(p.item.blur)
      .then((tex) => {
        if (disposed) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        p.mat.map = tex;
        p.mat.needsUpdate = true;
        p.blurTex = tex;
      })
      .catch(() => {})
      .finally(() => {
        if (i < 4) queue.push(p);
        else deferred.push(p);
        pump();
      });
  });

  /* ---- ring + grid geometry, both resolved against the live frustum ---- */

  const TAN_HALF_FOV = Math.tan((camera.fov * Math.PI) / 360);

  // Frustum half-extents, in world units, at a given z with the camera at camZ.
  function frustumHalf(z, camZ) {
    const d = camZ - z;
    const halfH = d * TAN_HALF_FOV;
    return { w: halfH * camera.aspect, h: halfH };
  }

  // The camera is pitched — it sits at CAM_Y and looks down at the origin — so
  // the frustum's centre line is NOT the world y axis. At depth z the axis
  // passes through y = CAM_Y * z / CAM_Z, which is nowhere near 0 once a plate
  // is close to the lens: at the arrival depth it is 0.6 of the frame's
  // half-height. Normalising a plate's offset by frustumHalf alone measures it
  // against the wrong origin, and the dive pays for the error exactly where it
  // can least afford it — by the end every plate is dragged below the frame.
  const axisY = (z) => (CAM_Y * z) / CAM_Z;

  // Where .hero-meta actually sits, in the same screen space the HUD projects
  // into. Read from the live element rather than hardcoded so it stays honest
  // if the tagline wraps to two lines or the font size changes.
  let metaRect = null;
  function readMetaRect() {
    const el = HERO.querySelector('.hero-meta');
    if (!el) { metaRect = null; return; }
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { metaRect = null; return; }
    const h = STAGE.clientHeight || window.innerHeight;
    metaRect = {
      x0: r.left, x1: r.right,
      y0: r.top, y1: r.bottom,
      // Convert to the ±1 NDC-ish space the projection math below uses.
      nx0: (r.left / h) * 2 * camera.aspect - camera.aspect,
      nx1: (r.right / h) * 2 * camera.aspect - camera.aspect,
      ny0: 1 - (r.top / h) * 2,
      ny1: 1 - (r.bottom / h) * 2,
    };
  }

  // Resolve every plate's rest and exploded world positions. Recomputed on
  // resize only — it depends on the frustum and the DOM, neither of which
  // changes per frame.
  function resolveRing() {
    readMetaRect();
    for (const pl of plates) {
      const { w: hw, h: hh } = frustumHalf(pl.z, CAM_Z);
      const halfH = (PLATE_H / 2) * pl.sc;
      // Safe extents: the frame minus the plate's own footprint, so a plate at
      // full radius sits inside rather than hanging off the edge. Vertically
      // the ceiling is the site header, not the frame edge.
      const ax = Math.max(0.2, hw - (PLATE_W / 2) * pl.sc - EDGE_MARGIN);
      const ay = Math.max(0.2, Math.min(hh - halfH - EDGE_MARGIN, hh * TOP_CLEAR_NDC - halfH));
      pl.ax = ax;
      pl.ay = ay;

      // A plate aimed at the bottom-centre would land on .hero-meta. Push it
      // out along its own angle until it clears, rather than hand-tuning
      // twelve coordinates around a constraint that shifts with the viewport.
      // Tested at the rest scale; the explosion only moves plates outward,
      // away from the centre-bottom block, so clearing at rest is enough.
      let bump = 0;
      for (let guard = 0; guard < 10 && metaRect; guard++) {
        const x = pl.cos * ax * (RING_REST_X + bump);
        const y = pl.sin * ay * (RING_REST_Y + bump * 0.4);
        const ndx = x / hw, ndy = y / hh;
        const halfNdx = (PLATE_W / 2) * pl.sc / hw;
        const halfNdy = (PLATE_H / 2) * pl.sc / hh;
        const clearX = ndx - halfNdx > metaRect.nx1 || ndx + halfNdx < metaRect.nx0;
        const clearY = ndy - halfNdy > metaRect.ny1 || ndy + halfNdy < metaRect.ny0;
        if (clearX || clearY) break;
        bump += 0.1;
      }

      const rx = Math.min(RING_REST_X + bump, RING_OUT_X);
      const ry = Math.min(RING_REST_Y + bump * 0.4, RING_OUT_Y);
      pl.home.set(pl.cos * ax * rx, pl.sin * ay * ry, pl.z);
      pl.out.set(pl.cos * ax * RING_OUT_X, pl.sin * ay * RING_OUT_Y, pl.z);

      // Anchor sits above the plate, offset to the leader side. Stored as a
      // relative offset, pre-multiplied by the plate's own scale, so the callout
      // and its leader line follow the plate everywhere it goes — including the
      // extra growth of the final fly-through.
      pl.anchorOff.set(
        pl.sign * LEADER_LEN * pl.sc,
        (PLATE_H * 0.5 + 0.42) * pl.sc,
        0
      );
    }
  }

  // The travel distance at which a plate exactly spans the frame, times
  // DIVE_ARRIVE. Deriving it from the live frustum means the arrival stays the
  // same size on a phone and on an ultrawide alike, instead of only at the
  // aspect the constant was tuned against.
  function resolveDive() {
    const spanAt = (d) => 2 * d * TAN_HALF_FOV * camera.aspect;
    diveZ = CAM_Z - PLATE_W / spanAt(1) * DIVE_ARRIVE;
    // Same construction for the wordmark, from its own measured width.
    wmDiveZ = CAM_Z - wmW / spanAt(1) * WM_SPAN_FRAC;
  }

  function resize() {
    const w = STAGE.clientWidth || window.innerWidth;
    const h = STAGE.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    resolveDive();
    resolveRing();
    resolveRings();
    measureTags();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---- picking a plate ---- */
  // Raycasting is the only way to hit-test a canvas, and the plates are moving
  // every frame, so this has to run against live world matrices rather than the
  // rest layout — which is exactly what intersectObjects uses once a frame has
  // been rendered.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plateMeshes = plates.map((pl) => pl.mesh);
  let hovered = -1;

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return -1;
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(plateMeshes, false);
    return hits.length ? plates.findIndex((pl) => pl.mesh === hits[0].object) : -1;
  }

  function setHovered(i) {
    if (i === hovered) return;
    if (hovered >= 0) plates[hovered].mat.color.setScalar(1);
    hovered = i;
    if (hovered >= 0) plates[hovered].mat.color.setScalar(1.16); // gentle lift
    STAGE.classList.toggle('is-clickable', hovered >= 0);
    document.querySelector('.cursor-ring')?.classList.toggle('hovering', hovered >= 0);
  }

  const onMove = (ev) => setHovered(pick(ev));
  const onLeave = () => setHovered(-1);
  const onClick = (ev) => {
    const i = pick(ev);
    if (i >= 0) window.__skandFocusProject?.(items[i].srcIdx);
  };
  renderer.domElement.addEventListener('pointermove', onMove, { passive: true });
  renderer.domElement.addEventListener('pointerleave', onLeave, { passive: true });
  renderer.domElement.addEventListener('click', onClick);

  /* ---- scroll progress ---- */
  let targetP = 0;
  let p = 0;
  let heroInView = true;
  let running = true;
  let last = performance.now();

  function readScroll() {
    // Travel is whatever the pin has left to give: .hero is 200vh and the
    // sticky viewport is 100vh, so the scene animates across the 100vh in
    // between. Using the hero's full height here would finish the whole
    // sequence only after the scene had already scrolled out of frame.
    const span = Math.max(1, HERO.offsetHeight - (STAGE.clientHeight || window.innerHeight));
    targetP = clamp(window.scrollY / span, 0, 1);
    // Scrolling means they are looking at the plates, so stop making them wait
    // for an idle callback that may never be idle in a long scroll.
    if (targetP > 0.12) releaseDeferred();
    // Hysteresis around the end of the travel. Without a dead zone the flag
    // chatters on and off for a pixel or two of scroll at the boundary, which
    // reads as the hero blinking.
    if (targetP >= 0.995) markDone(true);
    else if (targetP < 0.94) markDone(false);
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  // Once the hero scrolls away there is nothing left to render — hand the GPU
  // back entirely rather than ticking an offscreen scene.
  const heroIo = new IntersectionObserver(
    ([e]) => {
      heroInView = e.isIntersecting;
      if (heroInView && running && !rafId) kick();
    },
    { threshold: 0 }
  );
  heroIo.observe(HERO);

  const projV = new THREE.Vector3();
  const plateV = new THREE.Vector3();

  // The tagline / B-Side button / scroll cue are hero-intro copy. Once the
  // assembly has collapsed into the contact sheet they are just clutter
  // sitting under it — and a full-width grid physically overlaps that band —
  // so they retire together with the wordmark.
  const heroMeta = HERO.querySelector('.hero-meta');
  const heroScroll = HERO.querySelector('.hero-scroll');

  function frame(now) {
    // The chain is re-armed at the *bottom* of frame, conditionally. Re-arming
    // at the top made the loop unconditional: the IntersectionObserver could
    // flip heroInView to false but nothing ever cancelled the pending frame, so
    // the scene kept rendering from the Work section onward.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    p += (targetP - p) * 0.12;

    // Two gestures, deliberately overlapped rather than staged. The assembly
    // blows apart, then — without changing shape or spinning — every plate
    // squares up to the lens and travels straight at it, while the guide rings
    // rush outward past. An earlier pass put a rotation between the two, and it
    // read as the hero changing its mind: it had just celebrated the work apart,
    // then showily turned to face another direction before growing. Going
    // straight at the viewer instead reads as *entering* the work, which is the
    // handoff the scroll is actually for.
    const tExplode = easeOutCubic(seg(p, 0.12, 0.50));
    // The dive lands at 0.90 and the fade runs to the very end of the travel
    // rather than both ending at 1.0. They used to share an end point, which
    // meant the last of the scroll was spent fading geometry that had already
    // flown past the lens — and stopping the fade at 0.96 left the pinned stage
    // sitting there empty and opaque for the last few percent, which is the
    // beat right before the pin starts its exit.
    const tDive = easeInOutQuad(seg(p, 0.44, 0.90));
    // How far along the exit is, as a fraction — a single curve for the things
    // that leave together (the HUD callouts, the leader lines). The plates get
    // their own staggered version inside the loop below.
    //
    // The plates used to share one window starting at 0.76, when the travel was
    // already ~86% done, so the last stretch of scroll was twelve frame-sized
    // plates at full strength on the same pixels: a pile-up, not a composition,
    // which is what "no premium quality" actually is. Moving the whole thing
    // earlier fixed the pile-up and created a different problem — the pin is a
    // black plane that has to scroll a full viewport before Work clears it, so
    // anything that clears the stage early leaves ~300px of nothing on screen.
    // The answer is not to choose between the two but to stop having all twelve
    // plates leave on the same frame: see the stagger in the loop.
    const tOut = easeInOutQuad(seg(p, 0.68, 0.99));
    // Leader lines and callouts are the "technical drawing" signature, so they
    // are already legible at rest and firm up as the assembly opens — fading in
    // from nothing at scroll would mean the first frame reads as a plain collage.
    const tHud = 0.75 + 0.25 * seg(p, 0, 0.12);
    // …and they are gone before the plates arrive. Once each case is filling the
    // frame there is no dark ground left to read type against, and callouts left
    // floating over a full-bleed image are both illegible and noise.
    const tCallout = 1 - seg(p, 0.48, 0.66);

    // The assembly does not move at all before the dive. It used to ease down a
    // world unit into the space the tagline vacates, which put a visible downward
    // drift in front of the zoom — the eye read it as the whole composition
    // sliding rather than the cases coming at you, and it delayed the dive by
    // putting a translation in front of it. The ring's vertical balance is a
    // layout question (see RING_REST_Y), not something to animate.
    assembly.position.set(0, 0, 0);

    // The camera never moves. A dolly would fight the plates for the same
    // "coming at you" effect and halve it; letting the geometry do the travelling
    // is what sells the dive, and it keeps the projection maths honest.
    camera.position.z = CAM_Z;
    camera.lookAt(0, 0, 0);

    // Guide rings: present and quiet at rest like the old background circles,
    // then expanding outward past the lens. They are the only thing that passes
    // *the camera* rather than approaching it, which is what makes the last
    // stretch read as motion through space instead of a zoom, and they are what
    // gives the dark centre of the dive a far wall to be a tunnel mouth against.
    //
    // The expansion is deliberately unhurried — quadratic, and stopping at about
    // 2.4x. A linear sweep fast enough to feel like a rush put every ring past the
    // frame edge by p=0.7, so the dive played out with no circles in it at all,
    // which is the one thing the dive cannot spare.
    const tRing = easeInOutQuad(seg(p, 0.40, 0.96));
    for (const ring of rings) {
      const { base, r, reach } = ring.userData;
      ring.scale.setScalar(r * (1 + tRing * tRing * reach * 1.4));
      // The rings outlive the plates. They are the one element that is pure
      // line, so a frame holding nothing but two or three concentric circles
      // and a last case dissolving out of the corner reads as a drawn
      // technical study rather than as a screen that ran out of content — and
      // they are what the eye follows on the final pixels of scroll, when the
      // pin is still covering Work.
      ring.material.opacity = base * (1 + tRing * 1.6) * (1 - seg(p, 0.90, 1));
    }

    // The wordmark charges the lens with everything else. It used to recede and
    // fade out across 0.34–0.56, i.e. it left on the same beat as the tagline and
    // read as caption copy dissolving under the images; now it holds full
    // strength through the explosion, comes at the camera on the same tDive, and
    // only goes once it is wider than the screen and there is nothing left to
    // read. It is also back at its rest scale throughout — the old gentle pull
    // back was fighting the charge.
    //
    // It leaves ahead of the plates rather than with them. A full-width SKAND
    // sitting on top of the arriving collage is the single busiest thing in the
    // densest moment; taking it out first leaves the dive as pictures only,
    // which is the shot that leads into Work.
    wordmark.position.z = WM_Z0 + (wmDiveZ - WM_Z0) * tDive;
    wordmark.material.opacity = 1 - clamp(seg(p, 0.60, 0.82), 0, 1);
    rim.intensity = 1.5 * (1 - tDive * 0.8);

    // Intro copy clears out as the ring opens, so the two are never on screen
    // together fighting for the lower third.
    const copyOut = 1 - seg(p, 0.28, 0.52);
    if (heroMeta) {
      heroMeta.style.opacity = copyOut.toFixed(3);
      heroMeta.style.pointerEvents = copyOut < 0.05 ? 'none' : '';
    }
    if (heroScroll) {
      heroScroll.style.opacity = (copyOut * (1 - seg(p, 0.12, 0.34))).toFixed(3);
    }

    for (let i = 0; i < plates.length; i++) {
      const pl = plates[i];

      // home -> exploded, and it stays out there. Nothing about the arrangement
      // changes from here on: the dive is pure translation toward the viewer.
      plateV.lerpVectors(pl.home, pl.out, tExplode);
      pl.group.position.copy(plateV);

      // A slow idle breath so the resting hero is never fully static.
      const bob = Math.sin(now * 0.0006 + i * 1.7) * 0.04 * (1 - tExplode);
      pl.group.position.y += bob;

      // The dive. Each plate runs its own distance to the lens so they all arrive
      // together rather than the near ones parking on it first.
      //
      // The travel is expressed as pure MAGNIFICATION about the frame centre: a
      // plate's offset is measured in units of the frustum at its own depth, then
      // re-expressed in units of the frustum at its current depth. Its position
      // on the screen therefore does not change at all — only its size does. That
      // is the tunnel: the wordmark in the middle is coming straight at you, and
      // the cases to either side stay put and grow past you like scenery.
      //
      // It has to be done in normalised units, and about the camera's axis rather
      // than the world origin. The z travel magnifies each plate by a different
      // factor — set by the depth it started at — so converging in world units
      // was undone by that magnification, unevenly: the ring's top plates were
      // flung clean off the top of the screen while nothing remained below the
      // centre. And because the camera is pitched, the frustum axis is not the
      // world y axis; measuring against the origin drags the whole arrangement
      // below the frame by the time it arrives. At tDive = 0 this reduces to
      // plateV exactly, so the handoff into the dive is still seamless.
      //
      // The one thing it does not do is hold the offset still to the very end:
      // see DIVE_SPREAD.
      if (tDive > 0) {
        const zAt = pl.z + (diveZ - pl.z) * tDive;
        const f0 = frustumHalf(pl.z, CAM_Z);
        const fAt = frustumHalf(zAt, CAM_Z);
        const spread = 1 + (DIVE_SPREAD - 1) * tDive;
        pl.group.position.x = (plateV.x / f0.w) * fAt.w * spread;
        pl.group.position.y = axisY(zAt) + ((plateV.y - axisY(pl.z)) / f0.h) * fAt.h * spread;
        pl.group.position.z = zAt;
      }

      // The tilt is part of the exploded look, so it relaxes a little as the
      // assembly opens and squares up to the lens for the dive.
      const settle = 1 - tExplode * 0.4;
      pl.group.rotation.set(pl.rotHome.x * settle, pl.rotHome.y * settle, 0);

      // The plates leave as a wave around the ring rather than on one frame.
      // Ordering by index follows the LAYOUT table, which is built in ring
      // order, so neighbours leave together and the wave reads as the ring
      // emptying — not twelve images blinking out in a scatter. The overlap is
      // the point: with a 0.20 window spread over 0.14 of stagger, there are
      // always some plates leaving and some still arriving, so the collage is
      // never twelve-at-once (the wall) and never empty (the black pin).
      // Linear, not eased, on purpose: the pin is a black plane that has to
      // scroll a full viewport before Work clears it, so what the hero shows in
      // its last tenth of travel is the only thing on screen there, and an
      // eased fade is flat at both ends and gone well before the pin is.
      const k = plates.length > 1 ? i / (plates.length - 1) : 0;
      const tOutPlate = seg(p, 0.60 + 0.14 * k, 0.80 + 0.20 * k);

      // Depth dimming stays for the whole gesture — it is the only thing still
      // telling the eye which plate is in front once they are all rushing.
      const depthDim = 0.55 + 0.45 * (1 - seg(pl.depth, -6, 3));
      const vis = (1 - tOutPlate) * depthDim;
      pl.mat.opacity = vis;
      pl.frame.material.opacity = 0.18 * vis;

      // Leader line: plate corner -> annotation anchor, both in the assembly's
      // local space (the leaders mesh is a child of the rotating group, so these
      // coordinates must not be pre-transformed to world or the line would peel
      // away from its plate as the assembly turns).
      const ai = i * 6;
      const sc = pl.group.scale.x;
      leaderPos[ai] = pl.group.position.x - pl.sign * (PLATE_W / 2) * sc;
      leaderPos[ai + 1] = pl.group.position.y + (PLATE_H / 2) * sc;
      leaderPos[ai + 2] = pl.group.position.z;
      // anchorOff is pre-multiplied by the plate's rest scale, so re-apply the
      // growth to keep the callout riding on the plate rather than lagging it.
      const sMul = sc / pl.sc;
      plateV.set(
        pl.group.position.x + pl.anchorOff.x * sMul,
        pl.group.position.y + pl.anchorOff.y * sMul,
        pl.group.position.z
      );
      leaderPos[ai + 3] = plateV.x;
      leaderPos[ai + 4] = plateV.y;
      leaderPos[ai + 5] = plateV.z;
      leaderGeo.attributes.position.needsUpdate = true;

      // HUD: the leader endpoint lives in assembly space, so it has to be
      // carried into world space through the group's matrix before projecting.
      projV.copy(plateV);
      assembly.localToWorld(projV);
      projV.project(camera);
      const vw = renderer.domElement.clientWidth;
      const vh = renderer.domElement.clientHeight;
      let sx = (projV.x * 0.5 + 0.5) * vw;
      const sy = (-projV.y * 0.5 + 0.5) * vh;
      const off = projV.z > 1 || sx < -100 || sy < -60;
      const tag = tags[i];

      // Keep the whole callout inside the viewport. The tag extends to the
      // leader side, so a plate near the right edge would otherwise push half
      // its label off-screen.
      const gap = 14 * pl.sign;
      const w = tagW[i];
      if (sx + gap + w > vw - 10) sx = vw - 10 - w - gap;
      if (sx + gap < 10) sx = 10 - gap;

      tag.style.transform =
        `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) ` +
        `translate(${gap}px,-50%) scale(${(1 - tHud * 0.08).toFixed(3)})`;
      // Callouts ride along with their plates through the explosion, and clear
      // on tCallout — before the arriving artwork is big enough to have no dark
      // ground left under the type. The depth weighting is deliberately shallow:
      // the near plates are the big ones the eye lands on, and weighting them
      // down for being near made the most prominent labels the hardest to read.
      tag.style.opacity = off
        ? '0'
        : (tHud * tCallout * (1 - tOut) * (0.68 + 0.32 * (1 - seg(pl.depth, -6, 3)))).toFixed(3);
      // Once the pointer is busy elsewhere (or the plate is dissolving) the
      // callout must not be a click target any more.
      tag.style.pointerEvents = tCallout > 0.4 && vis > 0.3 ? '' : 'none';
    }

    // Leader lines belong to the assembled, annotated state. They are the wrong
    // idea once everything is flying at the lens — a callout frame streaking past
    // the viewer stops being a drawing and starts being noise. Driven off the
    // same curve as the tags: when these two retired on different timings, the
    // leader lines vanished under plates that still had labels floating on them.
    leaderMat.opacity = (0.20 + 0.16 * seg(p, 0.12, 0.42)) * tCallout;

    renderer.render(scene, camera);

    // Only stay alive while the hero is actually on screen. Once it scrolls
    // away the loop parks itself (rafId = 0) and the IntersectionObserver
    // resumes it when the hero comes back.
    if (running && heroInView) rafId = requestAnimationFrame(frame);
    else rafId = 0;
  }

  function kick() {
    if (rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function teardown() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    window.removeEventListener('scroll', readScroll);
    window.removeEventListener('resize', resize);
    window.removeEventListener('skand:lang', relabel);
    renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerleave', onLeave);
    renderer.domElement.removeEventListener('click', onClick);
    STAGE.classList.remove('is-clickable');
    heroIo.disconnect();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  }

  function onLost(e) {
    // A black first screen is the worst failure mode here, so bail to the
    // static grid rather than attempt a rebuild that will likely fail too.
    e.preventDefault();
    teardown();
    disposed = true;
    mountStaticGrid(items);
  }
  renderer.domElement.addEventListener('webglcontextlost', onLost, false);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { if (heroInView) kick(); }
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  });

  STAGE.classList.add('is-live');
  HUD.classList.add('is-live');
  announceHandoff(false);
  HERO.classList.add('has-stage');
  // The scene draws its own wordmark, so the H1 is redundant from here on and
  // has to actually go — not just be marked redundant to a screen reader. It was
  // only ever sitting behind the canvas, coinciding with the 3D wordmark, and
  // the moment the stage faded out at the end of the dive it was left standing
  // alone: a second full-bleed SKAND occupying the whole screen between the
  // hero and the Work section. Tiers 1 and 2 keep the H1 — it is their heading.
  document.getElementById('heroTitle')?.setAttribute('aria-hidden', 'true');
  document.getElementById('heroTitle')?.classList.add('is-replaced');
  kick();
}

/* ------------------------------------------------------------------ */
/*  Hand off to the Work section                                        */
/* ------------------------------------------------------------------ */

// The hero's pinned stage outlives its own travel by a full viewport — the pin
// has to scroll off the top before the Work section is clear of it — and Work is
// pulled up to close that gap. The page's reveal-on-scroll runs inside that
// overlap, so without a signal its heading fades up *through* the plates that
// are still flying past and reads as a layering fault. This is the cue that says
// "the screen is yours", so Work holds its lead-in until it fires. Anything that
// does not put a 3D stage on screen says done immediately, so the fallback tiers
// are unaffected.
function announceHandoff(done) {
  document.dispatchEvent(new CustomEvent('skand:hero-handoff', { detail: { done } }));
}

let markedDone = false;
// Bidirectional on purpose. This used to latch on the first time the hero
// reached the end and never release, which meant scrolling back up left an empty
// first screen: the stage and its callouts stayed at opacity 0 forever.
function markDone(on) {
  // The static-grid tier hands this straight to a scroll listener, so the flag
  // arrives as an event object rather than a boolean.
  const done = on === true || on?.done === true;
  if (markedDone === done) return;
  markedDone = done;
  STAGE?.classList.toggle('is-done', done);
  HUD?.classList.toggle('is-done', done);
  announceHandoff(done);
}

/* ------------------------------------------------------------------ */
/*  Boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  const media = window.__HERO_MEDIA;
  const items = media?.items;
  if (!HERO || !items?.length) { announceHandoff(true); return; } // tier 2: plain text hero, untouched

  // LAYOUT owns the plate count — it is what the ring is built from, positionally.
  // index.html picks the same number of projects, but that is two files agreeing
  // on a number, and a disagreement here would be a destructuring of undefined
  // rather than a visible mistake. Clamp to the layout so the worst case is a
  // shorter ring, and so the static-grid tier shows the same count as the 3D one.
  const plates = items.slice(0, LAYOUT.length);

  // Fonts must be ready or the Canvas2D wordmark rasterises in a fallback face.
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  } catch (_) { /* proceed with fallback metrics */ }

  if (!tier0) {
    mountStaticGrid(plates);
    return;
  }
  // The head script hid the H1 on the strength of a prediction about this
  // device, and starts a 4s clock to put it back if the module does not get
  // this far. It has. The failsafe can stop watching now.
  document.documentElement.classList.add('hero-3d-ready');
  try {
    await initThree(plates);
  } catch (err) {
    console.error('[hero] scene failed, falling back to static grid:', err);
    mountStaticGrid(plates);
  }
}

boot();
