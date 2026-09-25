# B-Side Polish Implementation Plan

**Goal:** Make the particle experience visible, more expressive, and interactive after reveal.

**Architecture:** Keep the existing Three.js GPU particle system and phase state machine. Correct viewport sizing, tune shader motion and colors, and simplify the DOM overlay without adding dependencies.

**Tech Stack:** Static HTML/CSS, JavaScript modules, Three.js 0.170.0.

---

### Task 1: Restore and stage the scene

**Files:** `scripts/bside/scene.js`, `scripts/bside/main.js`, `b-side.html`

1. Correct the resize return value consumed by the particle size uniform.
2. Render the idle cloud under a translucent intro before Start.
3. Verify nonblack canvas pixels on desktop and mobile.

### Task 2: Improve motion and reveal

**Files:** `scripts/bside/particles.js`, `scripts/bside/phases.js`, `scripts/bside/scene.js`, `scripts/bside/main.js`, `b-side.html`

1. Add directional swirl on drag and a responsive localized force after ignition.
2. Adjust particle contrast, bloom, and reveal pulse so the mark reads clearly.
3. Verify drag charge, ignition, pointer response, and reset in browser.

### Task 3: Simplify controls

**Files:** `b-side.html`, `scripts/bside/main.js`

1. Replace the large panel with a compact progress strip.
2. Move sound and reset controls away from the charge display.
3. Check desktop/mobile fit and keyboard-accessible controls.
