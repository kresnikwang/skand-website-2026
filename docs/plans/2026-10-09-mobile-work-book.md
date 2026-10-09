# Mobile Work Book Implementation Plan

**Goal:** Replace the mobile list of every work with six curated works and a separate, expandable work index.

**Architecture:** Reuse PROJECTS, IMAGE_MANIFEST, the existing hall artwork, and the full-image viewer. Below 1024px, only explicitly featured projects appear on the home page. A fixed work-index dialog owns its category filter and 12-item batches; the viewer receives a navigation list for the selected context. Shared scroll locking and browser-history handling let visitors return to the same index position.

**Tech Stack:** Static HTML, scoped CSS, vanilla JavaScript.

---

### Design direction

- Retain the existing black #0a0a0a, white #f0ede8, dark #131313, blue #4052B5, and coral #E8563A.
- Retain Cormorant Garamond headings and Outfit labels; no new fonts or decorative motion.
- Home: current brand introduction → Selected work / six → six full-width framed images with captions below → View all works / dynamic count → About.
- Index: fixed title, language and close controls → horizontally scrollable category chips → two-column thumbnails and readable labels → Load more / displayed count.
- Use six different brands across all five categories. Preserve complete images. The index can grow without growing the home page.

### Task 1: Content and structure

**Files:** `index.html`.

Mark six PROJECTS as featured. Add a work-index dialog outside pageWrapper, plus index entry controls and a selected-work heading inside the gallery. Add bilingual copy and version the gallery CSS/JS references.

### Task 2: Responsive presentation

**Files:** `styles/gallery.css`.

Hide mobile-only controls on desktop. On mobile hide hall filters/progress, keep six large frames, and move captions below images. Style the index with two columns, 44px controls, safe-area spacing, readable metadata, visible focus, and reduced-motion support. Check 320px, 390px, tablet, and desktop sizes.

### Task 3: Index and viewer behavior

**Files:** `scripts/gallery/gallery.js`, `index.html` language URL handling.

Use featured work on mobile and existing category plans on desktop. Build index cards in batches of 12, filter from the shared dataset, and lazy-load thumbnails. Pass featured/index/hall lists to the viewer. Share scroll locking across both overlays; make background inert; trap focus; preserve index position; support Escape and browser Back. Relabel existing nodes when language changes. Restore the desktop hall on resize without losing the mobile index state.

### Validation

Check six featured works, complete category counts, load-more batches, filtered viewer stepping, index scroll restoration, nested Escape/Back, language changes, keyboard focus, scroll locking, and resizing across 1024px. Inspect home/index screenshots. Parse inline and external JavaScript and run `git diff --check`.

### Verified results

- 320px and 390px mobile layouts: six featured works, no horizontal overflow; index stays two columns.
- 768px tablet: six works in two columns; switching from the desktop hall restores the mobile captions.
- 1440px desktop: all 45 works in the 3D hall; category filtering and mouse/keyboard opening work.
- Complete index: 12 → 24 → 36 → 45 unique cards; the final batch hides Load more.
- Content filter: 12 → 18; viewer stays within the 18 works. Digital filter viewer has eight works.
- Featured viewer: six works; Next moves from Jordan to Salomon.
- Closing a work restores index scroll exactly (1119.5px in the check). Closing the index restores page scrolling and removes inert attributes.
- Escape, Back/Forward, refresh restoration, bilingual labels, and focus wrapping passed.
- Temporary 70-work fixture: home stays at six works; index loads 12 → 24 → 36 → 48 → 60 → 70 unique cards.
- External/inline JavaScript syntax, unique HTML IDs, and `git diff --check` passed; no browser console errors captured.

### Final bug review

- Fixed the reduced-motion hall transform overriding the mobile list; a forced reduced-motion fixture retains six works below the heading without horizontal overflow.
- Fixed full-image viewing in short landscape and portrait viewports. At 844×390 and 390×600, the complete image stays within its stage and navigation remains accessible.
- Prevented a late thumbnail from replacing an already loaded original, and verified both out-of-order and stale image responses with a mocked Image loader.
- Clear cancelled swipe gestures, guard pending viewer entry, and resume the desktop camera after back-forward cache restoration.
- Rechecked all 45 unique index cards, final batch visibility, Digital viewer navigation, nested Back, and language switching.
- Syntax, HTML IDs, and whitespace checks passed. Gallery assets use v6 to refresh browser caches.
