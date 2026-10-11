# Portfolio Replacement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the live portfolio with all 66 supplied images in the five source-folder categories.

**Architecture:** Keep the existing desktop gallery and mobile work index. OCR the supplied image captions and review against the images and informative filenames; store a source-to-project catalog. Produce full-resolution lossless WebP images plus smaller gallery previews, with a shared manifest and blur placeholders. Publish through the existing server deployment script after content and browser checks.

**Tech Stack:** Static HTML/CSS/JavaScript, Sharp, macOS Vision OCR, SSH/rsync.

---

### Task 1: Identify content
- Read `index.html`, `scripts/gallery/gallery.js`, and `DEPLOYMENT.md`.
- OCR every file under `portfolio assets/`, keeping source paths and text coordinates in local review data.
- Review names/brands; use meaningful filenames when image captions are absent. Do not invent years or project claims.
- Create `scripts/portfolio/catalog.json` with exactly one entry per source image, grouped in Brand IMC, Consumer, Design, Digital, Product order.

### Task 2: Convert and integrate
- Create `scripts/portfolio/build.js` to generate lossless full-resolution WebP, responsive previews, blur placeholders, and `scripts/portfolio/data.js`.
- Verify decoded full-resolution pixels match source pixels and record byte totals.
- Modify `index.html` to load the generated data and replace old categories/catalog/manifest.
- Preserve existing color, typography, hall composition, mobile selection and index. Ensure the viewer loads full resolution, and all five filters use source folder names in English with Chinese translations.

### Task 3: Verify
- Check 66 unique sources, nonempty brands/titles, five category counts, output paths, dimensions, and JavaScript syntax.
- Preview desktop/mobile gallery, each category, load more, image viewer, and language switching. Check console/runtime errors and missing images.

### Task 4: Publish
- Exclude original `portfolio assets/`, local plans, and review data from deployment in `scripts/deploy.sh`.
- Check remote connectivity and create a recoverable backup of the existing deployment.
- Run `./scripts/deploy.sh` and verify live HTML, generated data, and representative WebP files match local outputs.

### Task 5: Requested ordering, divider removal, and cursor fix
- Reorder catalog categories: Brand IMC, Product, Digital, Design, Consumer.
- Remove Consumer/Consumer.006.jpeg from publication, retaining the source original.
- Add an explicit exclusion and image reuse flag to the builder; validate all reused full-resolution pixels.
- Place the custom cursor above the work overlays and restore the native cursor when the custom cursor is disabled by viewport/pointer changes.
- Verify 65 works, five ordered categories, overlay cursor layering and native fallback; deploy and verify live outputs.

### Task 6: Gallery interaction and chapter headings
- Remove the unused floating arrows beside the viewer image, retaining panel navigation and keyboard controls.
- Complete the intro fade over the first 10% of the camera walk (previously 15%).
- Give all five categories a compact name/count heading above their first frame, also in filtered views, replacing standalone sign columns.
- Verify headings, intro fade, image navigation and desktop/mobile layouts; publish and check live files.
