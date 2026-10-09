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
  const catsEl    = document.getElementById('galleryCats');
  const railCat   = document.getElementById('galleryRailCat');

  const LQIP = m => (m && m.blur) || '';
  const basename = img => img.split('/').pop().replace(/\.[^.]+$/, '');
  const pad2 = n => String(n).padStart(2, '0');

  /* ---------- layout ----------
     Derived from the viewport rather than hard-coded: the wall has to leave
     room for a visible floor beneath it, or the hall reads as a flat
     billboard instead of a room. */
  const ROWS = 3;
  const L = { COL_W: 320, ART_W: 264, ROW_GAP: 148, ROW_TOP: 30, PAD_X: 760, END_W: 460, SIGN_W: 256, wallH: 504, hallW: 6200 };

  const total   = PROJECTS.length;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- categories ----------
     The hall shows either everything (`all`, hung as one chapter per category)
     or one category. What is on the wall is a list, `visArts`, in hang order;
     every loop below walks that list rather than the 45 works, and the works
     that are off the wall are display:none. */
  const CATS = [];
  PROJECTS.forEach((p) => { if (!CATS.includes(p.cat)) CATS.push(p.cat); });
  const catCount = {};
  PROJECTS.forEach((p) => { catCount[p.cat] = (catCount[p.cat] || 0) + 1; });
  let activeCat = 'all';
  let visArts = [];
  let chapters = [];
  const catName  = (c) => ((FILTER_LABELS[c] || {})[lang]) || c;
  const catShort = (c) => ((FILTER_SHORT[c] || {})[lang]) || catName(c);
  const worksLabel = (n) => n + ' ' + T.gallery[n === 1 ? 'work1' : 'works'][lang];

  /* Rotate six works daily, covering categories and favouring distinct brands.
     The local calendar date seeds the shuffle, so reload, language changes,
     resizing and returning from a work keep today's selection stable. */
  function selectDailyWorks(projects, day) {
    let seed = 2166136261;
    for (const char of 'SKAND-mobile-' + day) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
    const random = () => {
      seed += 0x6D2B79F5;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pool = projects.map((_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = [], brands = new Set();
    const take = candidates => {
      const i = candidates.find(i => !brands.has(projects[i].brand)) ?? candidates[0];
      if (i === undefined) return;
      selected.push(i);
      brands.add(projects[i].brand);
    };
    const categories = [...new Set(pool.map(i => projects[i].cat))];
    categories.slice(0, 6).forEach(cat => take(pool.filter(i => projects[i].cat === cat)));
    while (selected.length < Math.min(6, projects.length)) take(pool.filter(i => !selected.includes(i)));
    // Keep visual, keyboard and viewer navigation in the dataset's reading order.
    return selected.sort((a, b) => a - b);
  }
  const selectionDate = new Date();
  const selectionDay = selectionDate.getFullYear() + '-' + pad2(selectionDate.getMonth() + 1) + '-' + pad2(selectionDate.getDate());
  const dailySelection = new Set(selectDailyWorks(PROJECTS, selectionDay));
  const isHall = () => window.innerWidth >= 1024;
  const featuredArts = () => arts.filter(r => dailySelection.has(r.i));
  const archive = {
    el: document.getElementById('workIndex'),
    close: document.getElementById('workIndexClose'),
    language: document.getElementById('workIndexLanguage'),
    filters: document.getElementById('workIndexFilters'),
    grid: document.getElementById('workIndexGrid'),
    scroll: document.getElementById('workIndexScroll'),
    more: document.getElementById('workIndexMore'),
    status: document.getElementById('workIndexStatus'),
    cat: 'all', items: [], shown: 0, built: false, open: false, lastFocus: null
  };
  const ARCHIVE_BATCH = 12;

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
    // a chapter sign takes a little less than a bay of wall
    L.SIGN_W  = Math.round(L.COL_W * 0.8);
  }

  /* Decide what hangs where. In `all` mode each category is a chapter that
     starts on a fresh bay, and every chapter after the first is announced by a
     sign on the wall in front of it. The first chapter has no sign: its wall is
     where the headline stands, and the first screen should not change. Filtered,
     the hall is one chapter. Position is stored on each work (col, row, x);
     nothing else in the file derives it from the work's index any more. */
  function planWall() {
    if (!isHall()) {
      visArts = featuredArts();
      chapters = [];
      arts.forEach(r => {
        r.on = visArts.includes(r);
        r.el.classList.toggle('is-off', !r.on);
      });
      return;
    }
    const all = activeCat === 'all';
    const groups = [];
    if (all) {
      CATS.forEach((c) => {
        const m = arts.filter(r => PROJECTS[r.i].cat === c);
        if (m.length) groups.push({ cat: c, arts: m });
      });
    } else {
      groups.push({ cat: activeCat, arts: arts.filter(r => PROJECTS[r.i].cat === activeCat) });
    }
    chapters = groups;
    visArts = [];
    arts.forEach((r) => { r.on = false; });

    let x = L.PAD_X, colNo = 0;
    chapters.forEach((ch, ci) => {
      ch.hasSign = all && ci > 0;
      if (ch.hasSign) { ch.signX = x; x += L.SIGN_W; }
      ch.bayX = x;
      ch.cols = Math.ceil(ch.arts.length / ROWS);
      ch.firstCol = colNo;
      ch.arts.forEach((r, j) => {
        r.on = true;
        r.col = colNo + Math.floor(j / ROWS);
        r.row = j % ROWS;
        r.x = x + Math.floor(j / ROWS) * L.COL_W;
        visArts.push(r);
      });
      colNo += ch.cols;
      x += ch.cols * L.COL_W;
    });
    L.hallW = x + L.PAD_X;
    arts.forEach((r) => r.el.classList.toggle('is-off', !r.on));
  }

  /* pilasters, lamps and signs depend on the plan, so they are rebuilt with it */
  let dyn = [];
  function applyLayout() {
    computeLayout();
    planWall();
    if (!isHall()) {
      dyn.forEach(el => el.remove());
      dyn = [];
      beams.length = 0;
      arts.forEach(r => {
        r.el.style.opacity = ''; r.btn.style.pointerEvents = ''; r.opacity = -1;
        if (r.captionEl.parentElement !== r.btn) r.btn.appendChild(r.captionEl);
      });
      return;
    }
    arts.forEach(r => { if (r.captionEl.parentElement !== r.frame) r.frame.appendChild(r.captionEl); });
    gallery.style.setProperty('--hall-w', L.hallW + 'px');
    gallery.style.setProperty('--art-w', L.ART_W + 'px');
    gallery.style.setProperty('--wall-h', L.wallH + 'px');
    gallery.style.setProperty('--end-w', L.END_W + 'px');
    gallery.style.setProperty('--sign-w', L.SIGN_W + 'px');

    const end = room.querySelector('.hall-endwall');
    dyn.forEach((el) => el.remove());
    dyn = [];
    const add = (el) => { room.insertBefore(el, end); dyn.push(el); };
    const div = (cls, left) => {
      const el = document.createElement('div');
      el.className = cls;
      el.style.left = left + 'px';
      return el;
    };

    // The beam is a cone from a lamp, wider than a bay. It is centred on the
    // bay's centre (the same x the works use) and its width is shared with CSS
    // through --beam-w, so positioning and drawing cannot drift apart.
    const beamW = Math.round(L.wallH * 1.5 * 0.62);
    gallery.style.setProperty('--beam-w', beamW + 'px');
    beams.length = 0;

    chapters.forEach((ch) => {
      for (let k = 0; k <= ch.cols; k++) add(div('hall-pilaster', ch.bayX + k * L.COL_W));
      // one lamp per bay
      for (let k = 0; k < ch.cols; k++) {
        const centre = ch.bayX + k * L.COL_W + L.COL_W / 2;
        const el = div('hall-beam', centre - beamW / 2);
        add(el);
        beams.push({ el, centre, opacity: -1 });
      }
      if (ch.hasSign) {
        const sign = div('hall-sign', ch.signX);
        sign.innerHTML = '<span class="hall-sign-no"></span><span class="hall-sign-name"></span><span class="hall-sign-count"></span>';
        ch.signEl = sign;
        add(sign);
      }
    });
    paintSigns();

    if (end) end.style.height = (L.wallH + 40) + 'px';

    visArts.forEach((rec) => {
      rec.el.style.left = (rec.x + (L.COL_W - L.ART_W) / 2) + 'px';
      rec.el.style.top  = (L.ROW_TOP + rec.row * L.ROW_GAP) + 'px';
      /* a little depth and a hair of rotation so the hang doesn't read as a
         spreadsheet — deterministic, so it survives re-layout */
      rec.el.style.transform =
        'translateZ(' + (((rec.col * 7 + rec.row * 13) % 5) * 7) + 'px) rotateZ(' +
        (((rec.col + rec.row) % 2 ? 0.55 : -0.55)) + 'deg)';
      rec.centre = rec.x + L.COL_W / 2;
    });
  }

  function paintSigns() {
    chapters.forEach((ch, ci) => {
      if (!ch.signEl) return;
      ch.signEl.querySelector('.hall-sign-no').textContent = pad2(ci + 1);
      ch.signEl.querySelector('.hall-sign-name').textContent = catName(ch.cat);
      ch.signEl.querySelector('.hall-sign-count').textContent = worksLabel(ch.arts.length);
    });
  }

  /* ============================================================
     BUILD THE HALL
     ============================================================ */
  const arts = [];
  const beams = [];
  function buildRoom() {
    room.innerHTML = '';

    const wall = document.createElement('div');
    wall.className = 'hall-wall';
    room.appendChild(wall);

    const floor = document.createElement('div');
    floor.className = 'hall-floor';
    room.appendChild(floor);

    const seam = document.createElement('div');
    seam.className = 'hall-seam';
    room.appendChild(seam);

    // pilasters, lamps and chapter signs are added by applyLayout(), which
    // knows what is on the wall

    const end = document.createElement('div');
    end.className = 'hall-endwall';
    // The end wall is a threshold, not a pitch. It used to carry the video
    // portfolio CTA and repeated the studio tagline; both moved — the CTA to
    // the first screen, the tagline is already the hero and the footer. What
    // is left is just the line that hands you off to About.
    end.innerHTML =
      '<div class="hall-endwall-glow"></div>' +
      '<div class="hall-endwall-title">Our Story<br><em>Starts</em></div>';
    room.appendChild(end);

    const frag = document.createDocumentFragment();

    PROJECTS.forEach((p, i) => {
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
          '<span class="hall-art-tag">SK / ' + pad2(i + 1) + '<b></b></span>' +
          '<span class="hall-art-caption">' +
            '<span class="hall-art-brand"></span>' +
            '<span class="hall-art-name"></span>' +
          '</span>' +
        '</span>';

      art.appendChild(btn);
      frag.appendChild(art);

      const rec = { i, el: art, btn, img: btn.querySelector('img'), centre: 0, x: 0, col: 0, row: 0, key: 0, on: true, shown: false, opacity: -1 };
      rec.brandEl = btn.querySelector('.hall-art-brand');
      rec.nameEl  = btn.querySelector('.hall-art-name');
      rec.tagCat  = btn.querySelector('.hall-art-tag b');
      rec.frame = btn.querySelector('.hall-art-frame');
      rec.captionEl = btn.querySelector('.hall-art-caption');
      arts.push(rec);
    });

    room.appendChild(frag);

    buildChips();
    applyLayout();
    renderCaptions();
    observeArtwork();
  }

  /* ---------- category chips ---------- */
  function buildChips() {
    if (!catsEl) return;
    const list = ['all'].concat(CATS);
    catsEl.innerHTML = list.map((c) =>
      '<button type="button" class="gallery-cat" data-cat="' + c + '" aria-pressed="false">' +
        '<span class="gallery-cat-name"></span><span class="gallery-cat-n">' +
        (c === 'all' ? total : catCount[c]) + '</span>' +
      '</button>').join('');
    catsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.gallery-cat');
      if (b) setCategory(b.dataset.cat);
    });
  }

  function paintChips() {
    if (!catsEl) return;
    catsEl.setAttribute('aria-label', T.gallery.filter[lang]);
    catsEl.querySelectorAll('.gallery-cat').forEach((b) => {
      const c = b.dataset.cat;
      b.querySelector('.gallery-cat-name').textContent = c === 'all' ? FILTER_LABELS.all[lang] : catShort(c);
      b.classList.toggle('is-active', c === activeCat);
      b.setAttribute('aria-pressed', c === activeCat ? 'true' : 'false');
    });
  }

  function renderCaptions() {
    arts.forEach((rec, i) => {
      const p = PROJECTS[i];
      rec.brandEl.textContent = p.brand;
      rec.nameEl.textContent = p.name;
      rec.tagCat.textContent = catShort(p.cat);
      rec.btn.setAttribute('aria-label', p.brand + ' — ' + p.name + ' — ' + catName(p.cat));
    });
    paintSigns();
    paintChips();
    paintMobileLabels();
    focused = -1;
    shownCat = null;   // relabel the rail's category name in the next frame
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
  function loadAllArtwork() { arts.forEach((r) => { if (r.on) loadArtwork(r); }); }
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
     MOBILE WORK BOOK / COMPLETE INDEX
     ============================================================ */
  function paintMobileLabels() {
    document.getElementById('mobileWorkTitle').textContent = T.gallery.selected[lang];
    document.getElementById('mobileWorkCount').textContent = worksLabel(featuredArts().length);
    document.querySelectorAll('.mobile-work-entry-label').forEach(el => { el.textContent = T.gallery.viewAll[lang]; });
    document.querySelectorAll('.mobile-work-entry-count').forEach(el => { el.textContent = pad2(total); });
    document.getElementById('workIndexTitleLabel').textContent = T.gallery.allWork[lang];
    document.getElementById('workIndexTotal').textContent = pad2(total);
    archive.close.setAttribute('aria-label', T.gallery.closeIndex[lang]);
    archive.language.textContent = lang === 'en' ? '中文' : 'EN';
    archive.language.setAttribute('aria-label', lang === 'en' ? 'Switch to Chinese' : '切换到英文');
    archive.language.lang = lang === 'en' ? 'zh' : 'en';
    archive.more.textContent = T.gallery.loadMore[lang];
    archive.filters.setAttribute('aria-label', T.gallery.filter[lang]);
    archive.filters.querySelectorAll('[data-cat]').forEach(b => {
      const c = b.dataset.cat;
      b.querySelector('.work-index-filter-label').textContent = c === 'all' ? FILTER_LABELS.all[lang] : catShort(c);
      b.classList.toggle('is-active', c === archive.cat);
      b.setAttribute('aria-pressed', String(c === archive.cat));
    });
    archive.grid.querySelectorAll('[data-idx]').forEach(b => {
      const p = PROJECTS[Number(b.dataset.idx)];
      b.setAttribute('aria-label', p.brand + ' — ' + p.name + ' — ' + catName(p.cat));
      b.querySelector('.work-index-category').textContent = catShort(p.cat);
    });
    if (archive.built) {
      archive.status.textContent = T.gallery.showing[lang].replace('{shown}', archive.shown).replace('{total}', archive.items.length);
      archive.more.hidden = archive.shown >= archive.items.length;
    }
  }

  function buildArchiveFilters() {
    archive.filters.innerHTML = ['all'].concat(CATS).map(c =>
      '<button type="button" class="work-index-filter" data-cat="' + c + '" aria-pressed="false">' +
      '<span class="work-index-filter-label"></span><span class="work-index-filter-count">' +
      (c === 'all' ? total : catCount[c]) + '</span></button>').join('');
  }

  function resetArchive() {
    archive.items = arts.filter(r => archive.cat === 'all' || PROJECTS[r.i].cat === archive.cat);
    archive.grid.replaceChildren();
    archive.shown = 0;
    archive.scroll.scrollTop = 0;
    archive.built = true;
    appendArchive();
  }

  function appendArchive() {
    const next = archive.items.slice(archive.shown, archive.shown + ARCHIVE_BATCH);
    const frag = document.createDocumentFragment();
    next.forEach(rec => {
      const p = PROJECTS[rec.i];
      const man = IMAGE_MANIFEST[basename(p.img)] || {};
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'work-index-card';
      b.dataset.idx = rec.i;
      b.innerHTML = '<span class="work-index-frame"><img alt="" loading="lazy" decoding="async" draggable="false" width="1000" height="563"></span>' +
        '<span class="work-index-brand"></span><span class="work-index-name"></span><span class="work-index-category"></span>';
      b.querySelector('img').src = man.webp || p.img;
      b.querySelector('.work-index-brand').textContent = p.brand;
      b.querySelector('.work-index-name').textContent = p.name;
      frag.appendChild(b);
    });
    archive.grid.appendChild(frag);
    archive.shown += next.length;
    paintMobileLabels();
    return next;
  }

  // Both overlays share one iOS-safe scroll lock. Closing a work leaves the
  // index locked and keeps its own scroll position until the index closes.
  let lockDepth = 0, lockedY = 0, previousScrollBehavior = '';
  function lockPage() {
    if (lockDepth++ > 0) return;
    lockedY = window.scrollY;
    frozenScrollY = lockedY;
    previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    Object.assign(document.body.style, { position: 'fixed', top: '-' + lockedY + 'px', left: '0', right: '0', width: '100%', overflow: 'hidden' });
  }
  function unlockPage() {
    if (!lockDepth || --lockDepth > 0) return;
    ['position', 'top', 'left', 'right', 'width', 'overflow'].forEach(k => { document.body.style[k] = ''; });
    window.scrollTo(0, lockedY);
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
    frozenScrollY = null;
  }
  function syncOverlayInert() {
    document.getElementById('pageWrapper').inert = archive.open || viewer.open;
    document.querySelector('nav').inert = archive.open || viewer.open;
    archive.el.inert = viewer.open;
  }
  function pushOverlay(kind, source, i) {
    history.pushState({ ...history.state, skandWorkOverlay: kind, skandWorkSource: source, skandWorkId: i,
      skandWorkSelection: source === 'featured' ? viewer.items.map(r => r.i) : null,
      skandWorkCategory: source === 'hall' ? activeCat : archive.cat }, '', location.href);
  }
  function openArchive(push = true) {
    if (archive.open) return;
    if (typeof closeMobileNav === 'function') closeMobileNav();
    archive.lastFocus = document.activeElement?.matches('button, a')
      ? document.activeElement
      : document.querySelector(isHall() ? '.nav-logo a' : '.mobile-work-entry-top');
    if (!archive.built) resetArchive();
    archive.open = true;
    archive.el.hidden = false;
    lockPage();
    syncOverlayInert();
    if (push) pushOverlay('index', 'index');
    archive.close.focus({ preventScroll: true });
  }
  function closeArchive(fromHistory = false) {
    if (!archive.open || viewer.open) return;
    if (!fromHistory && history.state?.skandWorkOverlay === 'index') { history.back(); return; }
    archive.open = false;
    archive.el.hidden = true;
    syncOverlayInert();
    unlockPage();
    const returnFocus = archive.lastFocus?.getClientRects().length ? archive.lastFocus
      : document.querySelector(isHall() ? '.nav-logo a' : '.mobile-work-entry-top');
    returnFocus?.focus({ preventScroll: true });
  }

  document.querySelectorAll('[data-open-work-index]').forEach(b => b.addEventListener('click', () => openArchive()));
  archive.close.addEventListener('click', () => closeArchive());
  archive.language.addEventListener('click', () => setLang(lang === 'en' ? 'zh' : 'en'));
  archive.more.addEventListener('click', () => {
    const added = appendArchive();
    // Move keyboard focus into the new batch, rather than leave it on a
    // button that moves down or disappears after the final batch.
    if (added.length) archive.grid.querySelector('[data-idx="' + added[0].i + '"]').focus({ preventScroll: true });
  });
  archive.filters.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b || b.dataset.cat === archive.cat) return;
    archive.cat = b.dataset.cat;
    resetArchive();
    history.replaceState({ ...history.state, skandWorkCategory: archive.cat }, '', location.href);
  });
  archive.grid.addEventListener('click', e => {
    const b = e.target.closest('[data-idx]');
    if (b) openViewer(Number(b.dataset.idx), 'index');
  });
  document.addEventListener('keydown', e => {
    if (!archive.open || viewer.open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeArchive(); return; }
    if (e.key !== 'Tab') return;
    const buttons = Array.from(archive.el.querySelectorAll('button')).filter(b => !b.hidden);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ============================================================
     CAMERA
     ============================================================ */
  let maxCam = 0, walkTravel = 1, sectionTop = 0;
  let cam = 0, targetCam = 0, dragOffset = 0;
  let frozenScrollY = null;   // set while the viewer holds the page still
  let focused = -1, shownCat = null, rafId = 0, pinned = true;

  /* The room is tilted (rotateY) under a perspective, so a hall coordinate
     does NOT land at cam + x on screen: the far end is both compressed and
     pushed away. maxCam therefore has to be solved against the projection,
     otherwise the walk stops short and the end wall never arrives. These
     three values are read back off the CSS so there is one source of truth. */
  let persp = 1200, originX = 0, tiltRad = 0, lastWalk = -1, lastEnd = -1;

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
    readPerspective();
    // the end wall sits 18px proud of the back wall, so it projects slightly
    // wider than a flush edge would — leave that much off the right edge
    maxCam = Math.max(0, -camFor(L.hallW, scene.clientWidth - 26));

    // Scroll length follows the walk length, at a constant pace of about a
    // tenth of a screen of scrolling per bay. A fixed 280dvh made the hall fly
    // when 45 works + chapter signs were on the wall and crawl when one
    // category of 3 was. Below 1024 the section is a grid and sizes itself.
    if (isHall()) {
      const pinH = pin.offsetHeight;
      const walk = maxCam <= 1
        ? pinH * 0.25
        : Math.min(pinH * 3.6, Math.max(pinH * 0.9, (maxCam / L.COL_W) * pinH * 0.118));
      // Let the end wall settle before normal scroll lifts the whole hall.
      const endHold = Math.round(pinH * 0.2);
      walkTravel = Math.round(walk);
      gallery.style.height = (pinH + walkTravel + endHold) + 'px';
    } else {
      gallery.style.height = '';
      walkTravel = Math.max(1, gallery.offsetHeight - pin.offsetHeight);
    }
    // When each work becomes "the current one": the camera position that puts
    // its bay under the middle of the screen, staggered by row so the counter
    // moves work by work instead of three at a time. Clamped, and kept
    // non-decreasing, so the last work is reachable at the end of the walk and
    // the counter can only move forward as the camera does.
    const mid = scene.clientWidth / 2;
    let prev = 0;
    visArts.forEach((r) => {
      const k = -camFor(r.centre, mid) + r.row * L.COL_W / 3;
      prev = Math.max(prev, Math.min(maxCam, Math.max(0, k)));
      r.key = prev;
    });
    paintRail();
  }

  function scrollCam() {
    // The viewer's scroll lock pins body with position:fixed, which collapses
    // the document — window.scrollY reads 0 while it is held. Without this the
    // hall would snap back to work 01 behind the overlay and jump on close.
    const y = frozenScrollY !== null ? frozenScrollY : window.scrollY;
    const p = Math.min(1, Math.max(0, (y - sectionTop) / walkTravel));
    return p * maxCam;
  }

  /* index into visArts of the work the camera has most recently reached */
  function focusIndexFor(c) {
    let f = 0;
    for (let k = 0; k < visArts.length; k++) {
      if (visArts[k].key <= c + 0.5) f = k; else break;
    }
    return f;
  }

  /* the parts of the rail that depend on what is on the wall: totals, the
     tick marks, and where each chapter begins along the track */
  function paintRail() {
    const n = visArts.length;
    if (railTotal) railTotal.textContent = pad2(n);
    if (viewer.total && !viewer.open) viewer.total.textContent = pad2(n);
    if (railTrack) railTrack.setAttribute('aria-valuemax', String(n));
    if (!railTicks) return;
    const at = (c) => (maxCam > 0 ? Math.min(100, Math.max(0, c / maxCam * 100)) : 0);
    const mid = scene.clientWidth / 2;
    let html = '';
    if (activeCat === 'all') {
      // chapter boundaries, so the rail reads as a table of contents
      chapters.forEach((ch) => {
        if (!ch.hasSign) return;
        const c = -camFor(ch.signX + L.SIGN_W / 2, mid);
        html += '<i class="is-chapter" style="left:' + at(c).toFixed(2) + '%"></i>';
      });
    } else {
      // one tick per few works — 45 hairline marks reads as noise
      const stepN = Math.max(1, Math.round(n / 9));
      for (let k = 0; k < n; k += stepN) html += '<i style="left:' + at(visArts[k].key).toFixed(2) + '%"></i>';
    }
    railTicks.innerHTML = html;
  }

  function render() {
    room.style.setProperty('--cam-x', -cam + 'px');

    if (isHall()) {
      const vw = window.innerWidth;
      const half = vw * 0.62;
      for (let i = 0; i < visArts.length; i++) {
        const rec = visArts[i];
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

      // Only the lamp nearest the middle of the screen is lit, and the light
      // hands over smoothly (smoothstep of the projected distance). The reach is
      // 1.5 bays, so at most two beams are visible during a handover.
      const reach = L.COL_W * 1.5;
      for (let i = 0; i < beams.length; i++) {
        const b = beams[i];
        const k = Math.max(0, 1 - Math.abs(projectX(b.centre, -cam) - vw / 2) / reach);
        const o = k * k * (3 - 2 * k);
        if (Math.abs(o - b.opacity) > 0.01) {
          b.el.style.opacity = o.toFixed(3);
          b.opacity = o;
        }
      }
    }

    const f = focusIndexFor(cam);
    if (f !== focused) {
      focused = f;
      if (railCount) railCount.textContent = pad2(f + 1);
      if (railTrack) railTrack.setAttribute('aria-valuenow', String(f + 1));
    }
    // Show the next chapter's tag shortly before its first work reaches the
    // centre. Keep the work count tied to the actual camera position.
    const tagCam = Math.min(maxCam, cam + (isHall() ? L.COL_W * 0.4 : 0));
    const tagIndex = focusIndexFor(tagCam);
    const showHere = activeCat === 'all' && visArts.length ? PROJECTS[visArts[tagIndex].i].cat : '';
    if (showHere !== shownCat) {
      shownCat = showHere;
      if (railCat) railCat.textContent = showHere ? catName(showHere) : '';
      if (catsEl) {
        catsEl.querySelectorAll('.gallery-cat').forEach((b) => b.classList.toggle('is-here', !!showHere && b.dataset.cat === showHere));
      }
    }
    const frac = maxCam > 0 ? Math.min(1, Math.max(0, cam / maxCam)) : 0;
    if (railFill) railFill.style.width = (frac * 100) + '%';
    if (railKnob) railKnob.style.left = (frac * 100) + '%';

    // First-screen copy leaves over the first 15% of the walk. Keyed to the
    // camera (not to raw scroll px against the walk distance) and fed to
    // CSS as a continuous --walk, so it dissolves as you go instead of snapping.
    // Desktop only: below 1024 the copy is an ordinary block in the grid.
    const walk = isHall() ? Math.min(1, Math.max(0, frac / 0.15)) : 0;
    if (Math.abs(walk - lastWalk) > 0.004 || (walk === 0) !== (lastWalk === 0)) {
      lastWalk = walk;
      gallery.style.setProperty('--walk', walk.toFixed(3));
      gallery.classList.toggle('is-away', walk >= 0.98);
    }
    gallery.classList.toggle('is-walking', isHall() && frac > 0.02);

    // last 12% of the walk: the right-hand shade lifts so the end wall can read
    const endT = isHall() ? Math.min(1, Math.max(0, (frac - 0.88) / 0.12)) : 0;
    const end = endT * endT * (3 - 2 * endT);
    if (Math.abs(end - lastEnd) > 0.004) {
      lastEnd = end;
      gallery.style.setProperty('--end', end.toFixed(3));
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
    if (!isHall()) return;
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
  /* `smooth: false` must be 'instant', not 'auto': 'auto' defers to the CSS
     scroll-behavior, and html sets `scroll-behavior: smooth` (index.html:33),
     so 'auto' would still animate. */
  function scrollToCam(c, smooth = true) {
    const frac = maxCam > 0 ? Math.min(1, Math.max(0, c / maxCam)) : 0;
    window.scrollTo({ top: sectionTop + frac * walkTravel, behavior: smooth ? 'smooth' : 'instant' });
  }

  let dragging = false, dragX = 0, startX = 0, startY = 0, didDrag = false;

  const DRAG_SLOP = 8;   // px from the press point before it is a drag, not a click

  scene.addEventListener('pointerdown', (e) => {
    if (!isHall() || e.button !== 0) return;
    dragging = true;
    dragX = startX = e.clientX;
    startY = e.clientY;
    didDrag = false;
    // No setPointerCapture anywhere in this drag. Capturing on press retargets
    // pointerup/click to .gallery-scene, so a tap on a work never opens it;
    // capturing later (once past the slop) silently starves pointermove of
    // everything after the first event. Release is listened for on window
    // instead (below), so letting go over the nav or outside the page still
    // ends the drag.
  });

  scene.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (!didDrag) {
      // straight-line distance from the press, not accumulated movement: a slow
      // press with a little hand jitter must still count as a click
      if (Math.hypot(e.clientX - startX, e.clientY - startY) <= DRAG_SLOP) return;
      didDrag = true;
      dragX = startX;   // pan from the press point so the hall tracks the cursor 1:1
      scene.classList.add('is-dragging');
    }
    const dx = e.clientX - dragX;
    dragX = e.clientX;
    dragOffset -= dx;
    const raw = scrollCam() + dragOffset;
    if (raw < 0) dragOffset -= raw;
    if (raw > maxCam) dragOffset -= raw - maxCam;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    scene.classList.remove('is-dragging');
    // didDrag must outlive this pointerup so the click that follows it can be
    // recognised as the tail of a drag, but not longer: a later keyboard
    // Enter on a work is also a click and must open it.
    setTimeout(() => { didDrag = false; }, 0);
    if (!didDrag || dragOffset === 0) { dragOffset = 0; return; }
    // Hand the drag over to the page scroll in the same frame. The old smooth
    // scroll ran with dragOffset already zeroed, so the target fell back to the
    // pre-drag scroll position and then crawled forward again: the rebound.
    // An instant scroll plus a zeroed offset leaves the target unchanged, and
    // the camera's own easing does the settling.
    const committed = Math.min(maxCam, Math.max(0, scrollCam() + dragOffset));
    scrollToCam(committed, false);
    dragOffset = 0;
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);

  // a click on an artwork is a click, not a drag (dragging back to the press
  // point is still a drag, hence a latched flag rather than a distance test)
  scene.addEventListener('click', (e) => {
    if (didDrag) return;
    const btn = e.target.closest('.hall-art-btn');
    if (!btn) return;
    openViewer(Number(btn.dataset.idx));
  });

  document.addEventListener('keydown', (e) => {
    if (!pinned || !isHall() || gallery.hidden) return;
    if (viewer.open || archive.open) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    // one bay of walk per press (about three works)
    const step = L.COL_W;
    scrollToCam(scrollCam() + (e.key === 'ArrowRight' ? step : -step));
  });

  /* ---------- progress rail: click and drag ---------- */
  if (railTrack) {
    let railDrag = false;
    // a tap glides; a drag follows the pointer exactly, otherwise every move
    // restarts a smooth scroll and the knob trails the cursor
    const railTo = (clientX, smooth) => {
      const r = railTrack.getBoundingClientRect();
      scrollToCam(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * maxCam, smooth);
    };
    const railEnd = (e) => {
      railDrag = false;
      try { railTrack.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    railTrack.addEventListener('pointerdown', (e) => {
      railDrag = true;
      railTrack.setPointerCapture(e.pointerId);
      railTo(e.clientX, true);
    });
    railTrack.addEventListener('pointermove', (e) => { if (railDrag) railTo(e.clientX, false); });
    railTrack.addEventListener('pointerup', railEnd);
    railTrack.addEventListener('pointercancel', railEnd);
  }

  /* ---------- category filter ----------
     Fade the wall out, re-hang it, walk back to the entrance, fade in. The
     fade is on the works (the room itself cannot take an opacity: anything
     below 1 flattens preserve-3d and the hall would pop flat for a moment). */
  let switchTimer = 0;
  function setCategory(cat) {
    if (cat === activeCat || (cat !== 'all' && !catCount[cat])) return;
    activeCat = cat;
    paintChips();
    focused = -1;
    shownCat = null;

    const relayout = () => {
      applyLayout();
      measure();
      dragOffset = 0;
      if (isHall()) window.scrollTo({ top: sectionTop, behavior: 'instant' });
      cam = targetCam = scrollCam();
      lastWalk = lastEnd = -1;
      render();
      room.classList.remove('is-out');
    };

    clearTimeout(switchTimer);
    if (!isHall() || reduced.matches) { relayout(); return; }
    room.classList.add('is-out');
    switchTimer = setTimeout(relayout, 220);
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
    items: [],
    source: 'hall',
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

  /* viewer.idx is an index into PROJECTS (so the 'SK / NN' id is stable); the
     counter and the arrows work on the works currently on the wall, so a
     filtered visitor never gets walked out of the category they chose */
  const viewerPos = () => Math.max(0, viewer.items.findIndex(r => r.i === viewer.idx));

  function paintPanel() {
    const p = PROJECTS[viewer.idx];
    const pos = viewerPos() + 1;
    viewer.kicker.textContent = (viewer.source === 'index' ? catName(PROJECTS[viewer.idx].cat) : T.gallery.kicker[lang]) + ' / ' + pad2(pos);
    viewer.brand.textContent = p.brand;
    viewer.client.textContent = p.brand;
    viewer.name.textContent = p.name;
    viewer.cat.textContent = catName(p.cat);
    viewer.index.textContent = 'SK / ' + pad2(viewer.idx + 1);
    viewer.current.textContent = pad2(pos);
    viewer.total.textContent = pad2(viewer.items.length);
    viewer.img.alt = p.brand + ' — ' + p.name;
  }

  function fillViewer(i) {
    viewer.idx = i;
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
    let fullLoaded = false;
    const warm = new Image();
    warm.decoding = 'async';
    warm.onload = () => {
      if (token !== loadToken || fullLoaded) return;
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
      fullLoaded = true;
      viewer.img.src = full.src;
      viewer.loading.hidden = true;
      requestAnimationFrame(settle);
    };
    full.onerror = () => { if (token === loadToken) viewer.loading.hidden = true; };
    full.src = p.img;
  }

  function openViewer(i, source = isHall() ? 'hall' : 'featured', push = true) {
    if (!viewer.el || viewer.open) return;
    viewer.source = source;
    viewer.items = (source === 'index' ? archive.items : source === 'featured' ? featuredArts() : visArts).slice();
    // Reopening history on a later day keeps the original six-work context.
    const saved = history.state?.skandWorkSelection;
    if (!push && source === 'featured' && Array.isArray(saved) && saved.length <= 6 &&
        saved.includes(i) && new Set(saved).size === saved.length &&
        saved.every(id => Number.isInteger(id) && arts[id])) {
      viewer.items = saved.map(id => arts[id]);
    }
    fillViewer(i);
    viewer.lastFocus = source === 'index'
      ? archive.grid.querySelector('[data-idx="' + i + '"]') || archive.close
      : arts[i].btn;
    viewer.el.hidden = false;
    requestAnimationFrame(() => { if (viewer.open) viewer.el.classList.add('is-open'); });

    viewer.open = true;
    lockPage();
    syncOverlayInert();
    if (push) pushOverlay('viewer', source, i);
    viewer.close.focus({ preventScroll: true });
  }

  function closeViewer(fromHistory = false) {
    if (!viewer.open) return;
    if (!fromHistory && history.state?.skandWorkOverlay === 'viewer') { history.back(); return; }
    viewer.open = false;
    loadToken++;   // abandon any in-flight original
    viewer.el.classList.remove('is-open');

    syncOverlayInert();
    unlockPage();
    const returnFocus = viewer.lastFocus?.getClientRects().length ? viewer.lastFocus
      : archive.open ? archive.close : document.querySelector('.nav-logo a');
    returnFocus?.focus({ preventScroll: true });
    setTimeout(() => { if (!viewer.open) viewer.el.hidden = true; }, 320);
  }

  function step(dir) {
    if (!viewer.open || !viewer.items.length) return;
    const n = viewer.items.length;
    fillViewer(viewer.items[(viewerPos() + dir + n) % n].i);
    if (history.state?.skandWorkOverlay === 'viewer') {
      history.replaceState({ ...history.state, skandWorkId: viewer.idx }, '', location.href);
    }
  }

  if (viewer.el) {
    viewer.close.addEventListener('click', () => closeViewer());
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
      swiping = false;
      if (e.target.closest('button') || !e.isPrimary || e.button !== 0) return;
      swiping = true; sx = e.clientX; sy = e.clientY;
    });
    viewer.el.addEventListener('pointercancel', () => { swiping = false; });
    viewer.el.addEventListener('pointerup', (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.25) step(dx < 0 ? 1 : -1);
    });
  }

  // Browser Back dismisses one layer at a time; Forward can reopen it.
  function restoreOverlayHistory() {
    const state = history.state || {};
    const target = state.skandWorkOverlay;
    // Language changes inside an overlay remain selected when Back closes it.
    if (archive.open || viewer.open || target) {
      const url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(state, '', url);
    }
    if (viewer.open && target !== 'viewer') closeViewer(true);
    const needsIndex = target === 'index' || (target === 'viewer' && state.skandWorkSource === 'index');
    if (needsIndex) {
      const cat = catCount[state.skandWorkCategory] ? state.skandWorkCategory : 'all';
      if (archive.cat !== cat) { archive.cat = cat; if (archive.built) resetArchive(); }
    }
    if (archive.open && !needsIndex) closeArchive(true);
    if (!archive.open && needsIndex) openArchive(false);
    if (target === 'viewer' && !viewer.open && PROJECTS[state.skandWorkId]) {
      if (state.skandWorkSource === 'hall' && isHall()) {
        activeCat = catCount[state.skandWorkCategory] ? state.skandWorkCategory : 'all';
        applyLayout(); measure(); paintChips();
      }
      openViewer(state.skandWorkId, state.skandWorkSource, false);
    }
  }
  window.addEventListener('popstate', restoreOverlayHistory);

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
  buildArchiveFilters();
  buildRoom();
  measure();
  cam = targetCam = scrollCam();
  render();
  startLoop();
  restoreOverlayHistory();

  // Stop the rAF loop whenever the hall is off-screen. scripts/logo/* runs a
  // Pixi app with its own ticker, and the two must not compete for the frame.
  // While the hall is on screen the page must not snap: html carries
  // `scroll-snap-type: y proximity`, and a snap point near the pin fights both
  // the wheel walk and the scroll a drag hands over to.
  const hasIO = 'IntersectionObserver' in window;
  function syncHallActive() {
    document.documentElement.classList.toggle('hall-active', hasIO && pinned && isHall());
  }
  if (hasIO) {
    new IntersectionObserver((entries) => {
      pinned = entries[0].isIntersecting;
      syncHallActive();
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
        stopLoop();
        arts.forEach(r => { r.el.style.opacity = ''; r.btn.style.pointerEvents = ''; });
      } else if (pinned) startLoop();
      cam = targetCam = scrollCam();
      syncHallActive();
      render();
    }, 140);
  }, { passive: true });

  window.addEventListener('pagehide', stopLoop);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && pinned && !document.hidden) { measure(); startLoop(); }
  });
})();
