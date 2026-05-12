#!/usr/bin/env node
/**
 * Image Optimization Pipeline
 * 1. Converts all pdf_images/*.jpg to WebP (quality 82)
 * 2. Generates tiny blur placeholder JPGs (20px wide, base64)
 * 3. Outputs to images/ folder
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const srcDir = path.join(ROOT, 'pdf_images');
const outDir = path.join(ROOT, 'images');
const BLUR_SIZE = 20; // tiny blur placeholder width
const WEBP_QUALITY = 82;

// Ensure output dir exists
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(f => /\.jpg$/i.test(f));
console.log(`Found ${files.length} JPG files to process...`);

// Build a manifest of all converted images
const manifest = {};

async function processAll() {
  for (const file of files) {
    const base = path.parse(file).name;
    const srcPath = path.join(srcDir, file);
    const webpPath = path.join(outDir, `${base}.webp`);
    const blurPath = path.join(outDir, `${base}_blur.jpg`);

    try {
      const img = sharp(srcPath);
      const meta = await img.metadata();
      const origSize = fs.statSync(srcPath).size;

      // 1. WebP conversion (82 quality)
      await img
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toFile(webpPath);

      // 2. Blur placeholder (tiny JPG, dataURL-ready)
      const blurBuf = await sharp(srcPath)
        .resize(BLUR_SIZE)
        .jpeg({ quality: 40 })
        .toBuffer();

      fs.writeFileSync(blurPath, blurBuf);

      // Store in manifest
      const webpSize = fs.statSync(webpPath).size;
      manifest[base] = {
        webp: `images/${base}.webp`,
        blur: blurBuf.toString('base64'),
        width: meta.width,
        height: meta.height,
        origKb: (origSize / 1024).toFixed(0),
        webpKb: (webpSize / 1024).toFixed(0),
        saved: ((1 - webpSize / origSize) * 100).toFixed(0),
      };

      console.log(`  ✅ ${base}: ${manifest[base].origKb}KB → ${manifest[base].webpKb}KB (${manifest[base].saved}% smaller)`);
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message}`);
    }
  }

  // Write manifest
  const manifestPath = path.join(outDir, '_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const totalOrig = Object.values(manifest).reduce((s, m) => s + parseInt(m.origKb) * 1024, 0);
  const totalWebp = Object.values(manifest).reduce((s, m) => s + parseFloat(m.webpKb) * 1024, 0);
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${(totalOrig/1024).toFixed(0)}KB → ${(totalWebp/1024).toFixed(0)}KB`);
  console.log(`   Saved: ${((1 - totalWebp/totalOrig)*100).toFixed(0)}%`);
  console.log(`   Manifest: ${manifestPath}`);
}

processAll().catch(console.error);
