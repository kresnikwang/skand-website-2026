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

---

# Wrap Mode Implementation Plan

**Goal:** A second B-Side game on the same mark: wind a cord around the assembled
logo until it bursts.

**Architecture:** Reuse everything. `particles.js` already models the mark and
already has a radial burst uniform, so Wrap only needed one new shader input
(`squeeze`) and one new module. The mode switch swaps which state machine feeds
the particle uniforms; nothing is rebuilt and no GPU resource is recreated.

**Tech Stack:** Static HTML/CSS, ES modules, Three.js 0.170.0, no new dependencies.

### Task 1: Logo collision field

**Files:** `scripts/bside/wrap.js`

1. Rasterise the frame + letter target sets into a 220×102 grid.
2. Dilate one cell so thin strokes cannot leave pinholes, without closing the
   letter counters.
3. Chamfer distance transform (free cells seeded at 0) over the whole grid.
4. Expose `sample(x, y)` returning distance-to-air plus its gradient.

**Why:** The mark is ~50k points; per-node point collision is hopeless. A
distance field answers the only two questions the cord asks — how far am I from
the surface, and which way is out — in O(1). Measured afterwards: 0 of 120,000
cord node samples ever sank inside the mark.

### Task 2: The cord

**Files:** `scripts/bside/wrap.js`

1. Verlet chain, 108 nodes, distance constraints over 10 relaxation passes.
2. Push out of the field inside the relaxation loop so tight wraps ease off a
   stem progressively instead of snapping.
3. Tangential friction on contacting nodes only — the line that makes wraps
   stick instead of creeping off.
4. Clamp the handle's per-step travel so a fast flick cannot tunnel the end
   through the mark.
5. Render as a 4-ray ribbon with a raised-cosine width falloff, behind the mark.

### Task 3: Tension and the pop

**Files:** `scripts/bside/wrap.js`, `scripts/bside/particles.js`, `scripts/bside/scene.js`, `scripts/bside/audio.js`

1. Tension rises with contact ratio and hard stretch, decays when released.
2. Feed it to the shader as `squeeze`: compress X, bulge Y/Z, add a per-seed
   shiver that tightens as it nears failure.
3. At 1.0 run the pop timeline — burst, hold, re-form — and hand the cord back.
4. Camera shake on the pop, coral flash, and a tension riser plus a pop sound.
5. Tune gains against a simulated player: first pop at ~8s of deliberate wrap.

### Task 4: Mode switching and HUD

**Files:** `b-side.html`, `scripts/bside/main.js`, `scripts/bside/config.js`

1. Gather/Wrap segmented control at the top; the bottom already holds the
   centred hint, the charge bar and the phase steps.
2. Swap the bar's label, the phase steps, the hint line and the pops counter.
3. Reset routes to the active mode; switching back to Gather preserves the
   reveal's charge.
4. Guard `updateHud()` — it is reachable before either state machine exists.
5. Add `data-t`-free i18n keys for both modes and both languages.

### Task 5: Verify

1. Headless sim: loop stays finite, pop → re-form cycle completes.
2. Penetration check against an independent higher-resolution SDF.
3. Chromium: mode switch, drag builds tension, pop fires, counter increments,
   switching back to Gather leaves no console errors.

