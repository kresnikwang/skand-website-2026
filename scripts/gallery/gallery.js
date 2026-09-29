/* ============================================================
   SKAND — THE GALLERY HALL
   ------------------------------------------------------------
   A classic script (not a module) on purpose: PROJECTS,
   IMAGE_MANIFEST, T and `lang` live in the top-level lexical
   scope of the inline script in index.html, and a classic
   script can read them directly. A module would force us to
   move the data out first.
   ============================================================ */
(() => {
  'use strict';

  const gallery = document.getElementById('work');
  if (!gallery) return;

  const room      = document.getElementById('galleryRoom');
  const scene     = document.getElementById('galleryScene');
  const railFill  = document.getElementById('galleryRailFill');
  const railKnob  = document.getElementById('galleryRailKnob');
  const railTrack = document.getElementById('galleryRailTrack');
  const railCount = document.getElementById('galleryRailCount');
  const railTotal = document.getElementById('galleryRailTotal');
  const railTicks = document.getElementById('galleryRailTicks');
  const hintEl    = document.getElementById('galleryHint');

  const LQIP = m => (m && m.blur) || '';
  const basename = img => img.split('/').pop().replace(/\.[^.]+$/, '');
  const pad2 = n => String(n).padStart(2, '0');

  /* ---------- layout ----------
     Derived from the viewport rather than hard-coded: the wall has to leave
     room for a visible floor beneath it, or the hall reads as a flat
     billboard instead of a room. */
  const ROWS = 3;
  const L = { COL_W: 320, ART_W: 264, ROW_GAP: 148, ROW_TOP: 30, PAD_X: 760, END_W: 460, wallH: 504, hallW: 6200 };

  const total   = PROJECTS.length;
  const cols    = Math.ceil(total / ROWS);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* 3D hall is desktop-only; below 1024px the CSS turns the same DOM
     into a plain grid, and the camera machinery has to stand down. */
  const isHall = () => window.innerWidth >= 1024;

  function computeLayout() {
    const pinH = gallery.querySelector('.gallery-pin').offsetHeight || window.innerHeight;
    const pinW = window.innerWidth;
    L.wallH   = Math.round(pinH * 0.65);
    L.COL_W   = Math.round(Math.min(352, Math.max(248, pinW / 4.25)));
    L.ART_W   = L.COL_W - 54;
    L.ROW_GAP = Math.round((L.wallH * 0.90) / ROWS);
    L.ROW_TOP = Math.round(L.wallH * 0.06);
    // a 16:9 frame has to fit the row pitch or the three rows collide; on a
    // short viewport the frame (not the bay) has to give
    const fitW = Math.round((L.ROW_GAP - 14) * 16 / 9);
    if (L.ART_W > fitW) { L.ART_W = fitW; L.COL_W = L.ART_W + 54; }
    // enough clear wall before the first bay that the headline never sits on art
    L.PAD_X   = Math.round(Math.min(780, Math.max(400, pinW * 0.53)));
    // the back wall stops here so the end wall is not painted over
    L.END_W   = Math.round(Math.min(460, Math.max(280, pinW * 0.32)));
    L.hallW   = L.PAD_X * 2 + cols * L.COL_W;
  }

  function applyLayout() {
    computeLayout();
    gallery.style.setProperty('--hall-w', L.hallW + 'px');
    gallery.style.setProperty('--art-w', L.ART_W + 'px');
    gallery.style.setProperty('--wall-h', L.wallH + 'px');
    gallery.style.setProperty('--end-w', L.END_W + 'px');

    room.querySelectorAll('.hall-pilaster').forEach((p) => {
      p.style.left = (L.PAD_X + Number(p.dataset.col) * L.COL_W) + 'px';
    });
    room.querySelectorAll('.hall-beam').forEach((b) => {
      // 105 = half of the 210px shaft in gallery.css, so it hangs over the
      // centre of its bay rather than 10px left of it
      b.style.left = (L.PAD_X + Number(b.dataset.col) * L.COL_W + L.COL_W / 2 - 105) + 'px';
    });
    const end = room.querySelector('.hall-endwall');
    if (end) end.style.height = (L.wallH + 40) + 'px';

    arts.forEach((rec) => {
      const col = Math.floor(rec.i / ROWS);
      const row = rec.i % ROWS;
      rec.el.style.left = (L.PAD_X + col * L.COL_W + (L.COL_W - L.ART_W) / 2) + 'px';
      rec.el.style.top  = (L.ROW_TOP + row * L.ROW_GAP) + 'px';
      /* a little depth and a hair of rotation so the hang doesn't read as a
         spreadsheet — deterministic, so it survives re-layout */
      rec.el.style.transform =
        'translateZ(' + (((col * 7 + row * 13) % 5) * 7) + 'px) rotateZ(' +
        (((col + row) % 2 ? 0.55 : -0.55)) + 'deg)';
      rec.centre = L.PAD_X + col * L.COL_W + L.COL_W / 2;
    });
  }

  /* ============================================================
     BUILD THE HALL
     ============================================================ */
  const arts = [];

  function buildRoom() {
    room.innerHTML = '';

    const wall = document.createElement('div');
    wall.className = 'hall-wall';
    room.appendChild(wall);

    for (let c = 0; c <= cols; c++) {
      const p = document.createElement('div');
      p.className = 'hall-pilaster';
      p.dataset.col = c;
      room.appendChild(p);
    }

    const floor = document.createElement('div');
    floor.className = 'hall-floor';
    room.appendChild(floor);

    const seam = document.createElement('div');
    seam.className = 'hall-seam';
    room.appendChild(seam);

    for (let c = 0; c < cols; c += 2) {
      const beam = document.createElement('div');
      beam.className = 'hall-beam';
      beam.dataset.col = c;
      room.appendChild(beam);
    }

    const end = document.createElement('div');
    end.className = 'hall-endwall';
    // The end wall is a threshold, not a pitch. It used to carry the video
    // portfolio CTA and repeated the studio tagline; both moved — the CTA to
    // the first screen, the tagline is already the hero and the footer. What
    // is left is just the line that hands you off to About.
    end.innerHTML =
      '<div class="hall-endwall-glow"></div>' +
      '<div class="hall-endwall-title">Our Story<br><em>Starts</em></div>' +
      '<div class="hall-endwall-coords">31°13′49.4″N<br>121°28′25.7″E</div>';
    room.appendChild(end);

    const frag = document.createDocumentFragment();

    PROJECTS.forEach((p, i) => {
      const col = Math.floor(i / ROWS);
      const row = i % ROWS;

      const art = document.createElement('div');
      art.className = 'hall-art';

      const key = basename(p.img);
      const man = IMAGE_MANIFEST[key] || {};

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hall-art-btn';
      btn.dataset.idx = i;
      btn.setAttribute('aria-label', p.brand + ' — ' + p.name);

      // The caption sits INSIDE the frame and rides its hover lift, the way a
      // wall label sits on the work itself. Overlaying it is also what lets
      // three rows of 16:9 frames fit in a wall that still leaves floor below.
      btn.innerHTML =
        '<span class="hall-art-frame">' +
          '<i class="hall-art-lqip" style="background-image:url(' + LQIP(man) + ')"></i>' +
          // draggable="false": a press on an <img> otherwise starts a native
          // image drag, which swallows every pointermove after it — the hall
          // would stop following the cursor 40px in and the drag would commit
          '<img alt="" decoding="async" draggable="false" width="1000" height="563">' +
          '<span class="hall-art-tag">SK / ' + pad2(i + 1) + '</span>' +
          '<span class="hall-art-caption">' +
            '<span class="hall-art-brand"></span>' +
            '<span class="hall-art-name"></span>' +
          '</span>' +
        '</span>';

      art.appendChild(btn);
      frag.appendChild(art);

      const rec = { i, el: art, btn, img: btn.querySelector('img'), centre: 0, shown: false, opacity: -1 };
      rec.brandEl = btn.querySelector('.hall-art-brand');
      rec.nameEl  = btn.querySelector('.hall-art-name');
      arts.push(rec);
    });

    room.appendChild(frag);

    if (railTotal) railTotal.textContent = pad2(total);
    if (railCount) railCount.textContent = pad2(1);
    if (viewer.total) viewer.total.textContent = pad2(total);
    if (railTrack) {
      railTrack.setAttribute('aria-valuemax', String(total));
      railTrack.setAttribute('aria-valuenow', '1');
    }
    if (railTicks) {
      // one tick per five works — 45 hairline marks reads as noise
      const stepN = Math.max(1, Math.round(total / 9));
      let ticks = '';
      for (let i = 0; i < total; i += stepN) ticks += '<i></i>';
      railTicks.innerHTML = ticks;
    }

    applyLayout();
    renderCaptions();
    observeArtwork();
  }

  function renderCaptions() {
    arts.forEach((rec, i) => {
      const p = PROJECTS[i];
      rec.brandEl.textContent = p.brand;
      rec.nameEl.textContent = p.name;
      const cat = FILTER_LABELS[p.cat];
      rec.btn.setAttribute('aria-label', p.brand + ' — ' + p.name + (cat ? ' — ' + cat[lang] : ''));
    });
  }

  /* ---------- load the 1000x563 webp only as the camera nears it ---------- */
  let io = null;
  function observeArtwork() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) { loadAllArtwork(); return; }
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const rec = arts.find(r => r.el === e.target);
        if (rec && !rec.shown) { loadArtwork(rec); io.unobserve(e.target); }
      });
    }, { rootMargin: '600px 0px' });
    arts.forEach(r => io.observe(r.el));
  }
  function loadAllArtwork() { arts.forEach(loadArtwork); }
  function loadArtwork(rec) {
    if (rec.shown) return;
    rec.shown = true;
    const p = PROJECTS[rec.i];
    const man = IMAGE_MANIFEST[basename(p.img)] || {};
    const frame = rec.img.closest('.hall-art-frame');
    const settle = () => frame.classList.add('is-loaded');
    rec.img.addEventListener('load', settle, { once: true });
    rec.img.addEventListener('error', settle, { once: true });
    rec.img.src = man.webp || p.img;
    rec.img.alt = p.brand + ' — ' + p.name;
  }

  /* ============================================================
     CAMERA
     ============================================================ */
  let maxCam = 0, travel = 1, sectionTop = 0, overlap = 0;
  let cam = 0, targetCam = 0, dragOffset = 0;
  let frozenScrollY = null;   // set while the viewer holds the page still
  let focused = -1, rafId = 0, pinned = true;

  /* The room is tilted (rotateY) under a perspective, so a hall coordinate
     does NOT land at cam + x on screen: the far end is both compressed and
     pushed away. maxCam therefore has to be solved against the projection,
     otherwise the walk stops short and the end wall never arrives. These
     three values are read back off the CSS so there is one source of truth. */
  let persp = 1200, originX = 0, tiltRad = 0, lastFade = -1;

  function readPerspective() {
    const cs = getComputedStyle(scene);
    persp = parseFloat(cs.getPropertyValue('--hall-persp')) || 1200;
    const pct = parseFloat(cs.getPropertyValue('--hall-origin-x')) || 42;
    originX = (pct / 100) * scene.clientWidth;
    // the reduced-motion stylesheet drops the room's rotateY, so the camera
    // maths has to drop it too or maxCam and the falloff solve a tilt that
    // isn't being applied
    tiltRad = reduced.matches
      ? 0
      : (parseFloat(cs.getPropertyValue('--hall-tilt')) || 4) * Math.PI / 180;
  }

  /* Screen x of hall coordinate x, given the room's translateX (always <= 0).
     `cam` elsewhere is the positive distance walked, hence the negation. */
  function projectX(x, camX) {
    const cos = Math.cos(tiltRad), sin = Math.sin(tiltRad);
    const z = -x * sin;                     // positive tilt recedes to the right
    return originX + (camX + x * cos - originX) * (persp / (persp - z));
  }

  /* inverse: the translateX that puts hall x at screenX */
  function camFor(x, screenX) {
    const cos = Math.cos(tiltRad), sin = Math.sin(tiltRad);
    const m = persp / (persp + x * sin);
    return (screenX - originX) / m - x * cos + originX;
  }

  function measure() {
    sectionTop = gallery.offsetTop;
    const pin = gallery.querySelector('.gallery-pin');
    travel = Math.max(1, gallery.offsetHeight - pin.offsetHeight);
    // .gallery pulls the next section up by this much; the hall fades out
    // across exactly that range so the handover is a crossfade, not a stack.
    overlap = Math.min(travel, -parseFloat(getComputedStyle(gallery).marginBottom) || 0);
    readPerspective();
    // the end wall sits 18px proud of the back wall, so it projects slightly
    // wider than a flush edge would — leave that much off the right edge
    maxCam = Math.max(0, -camFor(L.hallW, scene.clientWidth - 26));
  }

  function scrollCam() {
    // The viewer's scroll lock pins body with position:fixed, which collapses
    // the document — window.scrollY reads 0 while it is held. Without this the
    // hall would snap back to work 01 behind the overlay and jump on close.
    const y = frozenScrollY !== null ? frozenScrollY : window.scrollY;
    const p = Math.min(1, Math.max(0, (y - sectionTop) / travel));
    return p * maxCam;
  }

  function focusIndexFor(c) {
    if (maxCam <= 0) return 0;
    return Math.min(total - 1, Math.round((c / maxCam) * (total - 1)));
  }

  function render() {
    room.style.setProperty('--cam-x', -cam + 'px');

    if (isHall()) {
      const vw = window.innerWidth;
      const half = vw * 0.62;
      for (let i = 0; i < arts.length; i++) {
        const rec = arts[i];
        // project, don't subtract — under the tilt, distance down the hall is
        // not distance from the centre of the screen
        const sx = projectX(rec.centre, -cam);
        const d = Math.abs(sx - vw / 2) / half;
        const o = Math.max(0.1, Math.min(1, 1.12 - d * 1.12));
        if (Math.abs(o - rec.opacity) > 0.02) {
          rec.el.style.opacity = o;
          rec.opacity = o;
        }
        const live = o > 0.3;
        if (rec.btn.style.pointerEvents !== (live ? '' : 'none')) {
          rec.btn.style.pointerEvents = live ? '' : 'none';
        }
      }
    }

    const f = focusIndexFor(cam);
    if (f !== focused) {
      focused = f;
      if (railCount) railCount.textContent = pad2(f + 1);
      if (railTrack) railTrack.setAttribute('aria-valuenow', String(f + 1));
    }
    const frac = maxCam > 0 ? Math.min(1, Math.max(0, cam / maxCam)) : 0;
    if (railFill) railFill.style.width = (frac * 100) + '%';
    if (railKnob) railKnob.style.left = (frac * 100) + '%';

    const y = frozenScrollY !== null ? frozenScrollY : window.scrollY;
    gallery.classList.toggle('is-walking', (y - sectionTop) > travel * 0.03);

    // black the hall out across the overlap so the incoming section never
    // renders on top of live artwork
    const over = overlap > 0 ? Math.min(1, Math.max(0, (y - sectionTop - travel) / overlap)) : 0;
    if (Math.abs(over - lastFade) > 0.004) {
      lastFade = over;
      gallery.style.setProperty('--hall-fade', isHall() ? over.toFixed(3) : '0');
    }
  }

  function tick() {
    const base = scrollCam();
    targetCam = Math.min(maxCam, Math.max(0, base + dragOffset));
    cam = reduced.matches ? targetCam : cam + (targetCam - cam) * 0.12;
    if (Math.abs(targetCam - cam) < 0.4) cam = targetCam;
    render();
    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* ============================================================
     INPUT — scroll position is the single source of truth.
     Keys and the rail scroll the page; drag previews live and
     commits on release. Nothing fights the scroll position.
     ============================================================ */
  function scrollToCam(c, smooth = true) {
    const frac = maxCam > 0 ? Math.min(1, Math.max(0, c / maxCam)) : 0;
    window.scrollTo({ top: sectionTop + frac * travel, behavior: smooth ? 'smooth' : 'auto' });
  }

  let dragging = false, dragX = 0, dragMoved = 0;

  const DRAG_SLOP = 6;   // px before a press is a drag rather than a click

  scene.addEventListener('pointerdown', (e) => {
    if (!isHall() || e.button !== 0) return;
    dragging = true;
    dragX = e.clientX;
    dragMoved = 0;
    // No setPointerCapture anywhere in this drag. Capturing on press retargets
    // pointerup/click to .gallery-scene, so a tap on a work never opens it;
    // capturing later (once past the slop) silently starves pointermove of
    // everything after the first event. The scene fills the viewport, so
    // moves stay inside it anyway and pointercancel covers the edges.
  });

  scene.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragX;
    dragX = e.clientX;
    dragMoved += Math.abs(dx);
    if (dragMoved > DRAG_SLOP) scene.classList.add('is-dragging');
    if (dragMoved <= DRAG_SLOP) return;   // don't pan on a jittery press
    dragOffset -= dx;
    const raw = scrollCam() + dragOffset;
    if (raw < 0) dragOffset -= raw;
    if (raw > maxCam) dragOffset -= raw - maxCam;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    scene.classList.remove('is-dragging');
    try { scene.releasePointerCapture(e.pointerId); } catch (_) {}
    const committed = Math.min(maxCam, Math.max(0, scrollCam() + dragOffset));
    dragOffset = 0;
    if (dragMoved > DRAG_SLOP) scrollToCam(committed);
  }
  scene.addEventListener('pointerup', endDrag);
  scene.addEventListener('pointercancel', endDrag);

  // a click on an artwork is a click, not a 3px drag
  scene.addEventListener('click', (e) => {
    if (dragMoved > DRAG_SLOP) return;
    const btn = e.target.closest('.hall-art-btn');
    if (!btn) return;
    openViewer(Number(btn.dataset.idx));
  });

  document.addEventListener('keydown', (e) => {
    if (!isHall() || gallery.hidden) return;
    if (viewer.isOpen) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const step = maxCam / Math.max(1, total - 1) * 3;
    scrollToCam(scrollCam() + (e.key === 'ArrowRight' ? step : -step));
  });

  /* ---------- progress rail: click and drag ---------- */
  if (railTrack) {
    let railDrag = false;
    const railTo = (clientX) => {
      const r = railTrack.getBoundingClientRect();
      scrollToCam(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * maxCam);
    };
    railTrack.addEventListener('pointerdown', (e) => {
      railDrag = true;
      railTrack.setPointerCapture(e.pointerId);
      railTo(e.clientX);
    });
    railTrack.addEventListener('pointermove', (e) => { if (railDrag) railTo(e.clientX); });
    railTrack.addEventListener('pointerup', (e) => {
      railDrag = false;
      try { railTrack.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  }

  /* ============================================================
     WORK VIEWER — full-res 3840x2160 original, contain, no crop
     ============================================================ */
  const viewer = {
    el: document.getElementById('viewer'),
    frame: document.getElementById('viewerFrame'),
    img: document.getElementById('viewerImage'),
    lqip: document.getElementById('viewerLqip'),
    loading: document.getElementById('viewerLoading'),
    kicker: document.getElementById('viewerKicker'),
    brand: document.getElementById('viewerBrand'),
    name: document.getElementById('viewerName'),
    client: document.getElementById('viewerClient'),
    cat: document.getElementById('viewerCategory'),
    index: document.getElementById('viewerIndex'),
    current: document.getElementById('viewerCurrent'),
    total: document.getElementById('viewerTotal'),
    close: document.getElementById('viewerClose'),
    prev: document.getElementById('viewerPrev'),
    next: document.getElementById('viewerNext'),
    idx: 0,
    open: false,
    scrollY: 0,
    prevScrollBehavior: '',
    lastFocus: null
  };

  /* Three stages, so the picture is on screen almost immediately and then
     sharpens, instead of showing a stall until a 2.4MB original lands:
       1. LQIP  — already inline, zero network
       2. webp  — 1000px, usually warm from the wall
       3. jpg   — the 3840x2160 original, so it is never upscaled
     The token guards against a slow stage-3 decode landing on a newer index
     when someone mashes the arrow keys. */
  let loadToken = 0;

  function paintPanel() {
    const p = PROJECTS[viewer.idx];
    viewer.kicker.textContent = T.gallery.kicker[lang] + ' / ' + pad2(viewer.idx + 1);
    viewer.brand.textContent = p.brand;
    viewer.client.textContent = p.brand;
    viewer.name.textContent = p.name;
    viewer.cat.textContent = (FILTER_LABELS[p.cat] || {})[lang] || p.cat;
    viewer.index.textContent = 'SK / ' + pad2(viewer.idx + 1);
    viewer.current.textContent = pad2(viewer.idx + 1);
    viewer.img.alt = p.brand + ' — ' + p.name;
  }

  function fillViewer(i) {
    viewer.idx = (i + total) % total;
    const p = PROJECTS[viewer.idx];
    const man = IMAGE_MANIFEST[basename(p.img)] || {};
    const token = ++loadToken;

    viewer.frame.classList.remove('is-loaded');
    viewer.img.classList.remove('is-loaded');
    viewer.img.removeAttribute('src');
    viewer.lqip.src = LQIP(man);
    viewer.loading.hidden = true;
    paintPanel();

    const settle = () => {
      if (token !== loadToken) return;
      viewer.frame.classList.add('is-loaded');
      viewer.img.classList.add('is-loaded');
    };

    // stage 2 — the 1000px webp, so there is something sharp-ish fast
    const warm = new Image();
    warm.decoding = 'async';
    warm.onload = () => {
      if (token !== loadToken) return;
      viewer.img.src = warm.src;
      settle();
    };
    warm.onerror = () => {};
    warm.src = man.webp || p.img;

    // stage 3 — the original. Skipped for save-data / 2G, where the webp is
    // the honest thing to show rather than a 2.4MB stall.
    const conn = navigator.connection || {};
    if (conn.saveData || /^(slow-2g|2g)$/.test(conn.effectiveType || '')) return;

    viewer.loading.hidden = false;
    const full = new Image();
    full.decoding = 'async';
    full.onload = () => {
      if (token !== loadToken) return;
      viewer.img.src = full.src;
      viewer.loading.hidden = true;
      requestAnimationFrame(settle);
    };
    full.onerror = () => { if (token === loadToken) viewer.loading.hidden = true; };
    full.src = p.img;
  }

  function openViewer(i) {
    if (!viewer.el) return;
    fillViewer(i);
    viewer.lastFocus = document.activeElement;
    viewer.el.hidden = false;
    requestAnimationFrame(() => viewer.el.classList.add('is-open'));

    // Lock the page without breaking the sticky pin: position:fixed on body
    // plus a negative top. html carries overflow-x (not body), so html stays
    // the scroller and this is the correct iOS workaround rather than a trap.
    // scroll-behavior must go to auto for the restore, or html's smooth
    // scrolling animates the page back up from the viewer.
    viewer.scrollY = window.scrollY;
    frozenScrollY = viewer.scrollY;
    viewer.prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + viewer.scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // The nav and every section go inert, so Tab and clicks cannot escape.
    // The viewer sits outside #pageWrapper, so its own buttons still work.
    const wrap = document.getElementById('pageWrapper');
    if (wrap) wrap.inert = true;

    viewer.open = true;
    viewer.close.focus();
  }

  function closeViewer() {
    if (!viewer.open) return;
    viewer.open = false;
    loadToken++;   // abandon any in-flight original
    viewer.el.classList.remove('is-open');

    const wrap = document.getElementById('pageWrapper');
    if (wrap) wrap.inert = false;

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.documentElement.style.scrollBehavior = viewer.prevScrollBehavior || '';
    window.scrollTo(0, viewer.scrollY);
    frozenScrollY = null;

    if (viewer.lastFocus && viewer.lastFocus.focus) viewer.lastFocus.focus();
    setTimeout(() => { if (!viewer.open) viewer.el.hidden = true; }, 320);
  }

  function step(dir) { if (viewer.open) fillViewer(viewer.idx + dir); }

  if (viewer.el) {
    viewer.close.addEventListener('click', closeViewer);
    viewer.prev.addEventListener('click', () => step(-1));
    viewer.next.addEventListener('click', () => step(1));
    // Close on any click that is not on the picture, the panel or a control.
    // Testing e.target === viewer.el was not enough: .viewer-stage sits
    // between them and swallowed every click on the backdrop.
    viewer.el.addEventListener('click', (e) => {
      if (e.target.closest('.viewer-frame, .viewer-panel, .viewer-arrow, .viewer-close')) return;
      closeViewer();
    });

    document.addEventListener('keydown', (e) => {
      if (!viewer.open) return;
      if (e.key === 'Escape') { closeViewer(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); return; }
      if (e.key !== 'Tab') return;
      // focus trap
      const f = [viewer.close, viewer.prev, viewer.next].filter(Boolean);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // swipe between works
    let sx = 0, sy = 0, swiping = false;
    viewer.el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      swiping = true; sx = e.clientX; sy = e.clientY;
    });
    viewer.el.addEventListener('pointerup', (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.25) step(dx < 0 ? 1 : -1);
    });
  }

  /* ============================================================
     i18n — captions and the viewer panel follow the language toggle
     ============================================================ */
  const _applyLang = window.applyLang;
  if (typeof _applyLang === 'function') {
    window.applyLang = function () {
      _applyLang();
      renderCaptions();
      // relabel only — re-running fillViewer would restart the image fetch
      if (viewer.open) paintPanel();
    };
  }
  if (hintEl) hintEl.textContent = T.gallery.hint[lang];

  /* ============================================================
     BOOT
     ============================================================ */
  buildRoom();
  measure();
  cam = targetCam = scrollCam();
  render();
  startLoop();

  // Stop the rAF loop whenever the hall is off-screen. scripts/logo/* runs a
  // Pixi app with its own ticker, and the two must not compete for the frame.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      pinned = entries[0].isIntersecting;
      if (pinned) startLoop(); else stopLoop();
    }, { rootMargin: '200px 0px' }).observe(gallery);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else if (pinned) { cam = targetCam = scrollCam(); startLoop(); }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applyLayout();
      measure();
      if (!isHall()) {
        // the CSS drops the 3D and lays the same DOM out as a grid
        arts.forEach(r => { r.el.style.opacity = ''; r.btn.style.pointerEvents = ''; });
        loadAllArtwork();
      }
      cam = targetCam = scrollCam();
      render();
    }, 140);
  }, { passive: true });

  window.addEventListener('pagehide', stopLoop);
})();
