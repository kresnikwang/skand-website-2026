# Navigation and Favicon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the desktop Tool dropdown an opaque background, expose the mobile language switch, and use the supplied square favicon.

**Architecture:** Keep the existing static HTML and styling. Remove blending from the navigation ancestor, put the existing language control outside the collapsible link list, and share a dedicated favicon across all three pages.

**Tech Stack:** Static HTML, CSS, JavaScript.

---

### Task 1: Desktop dropdown

**Files:** Modify `index.html` navigation CSS.

1. Use normal blending on `nav`; retain difference blending only on individual top-level controls.
2. Give `.nav-dropdown-menu` the existing solid `var(--dark)` background and border. Keep the hover bridge above the panel using a transparent pseudo-element.
3. Check desktop opening, pointer movement into the panel, outside-click closing, and Escape.

### Task 2: Mobile language access

**Files:** Modify `index.html` navigation markup, responsive CSS, and language accessibility label.

1. Group the links, existing language button, and hamburger in `.nav-actions`; keep `#langToggle` outside `#navLinks`.
2. Preserve desktop spacing. On mobile, use an 8px gap and 44px touch targets for the language and menu buttons, above the menu overlay.
3. Check both language directions with the menu closed and open, narrow screens, URL/localStorage persistence, and the desktop/mobile breakpoint.

### Task 3: Square favicon

**Files:** Create `favicon.png`; modify `index.html`, `b-side.html`, and `egg.html`.

1. Copy the user-provided 64×64 PNG unchanged into the project root.
2. Reference `favicon.png` with `sizes="64x64"` on all pages.
3. Verify PNG dimensions and served favicon URLs.

### Validation

Use local browser checks at desktop and mobile sizes, inspect screenshots, check HTML/inline JavaScript syntax, and run `git diff --check`. Following the user's commit/push/deploy request, commit the changes, push the current branch, deploy with `scripts/deploy.sh`, and verify the live HTML and favicon.
