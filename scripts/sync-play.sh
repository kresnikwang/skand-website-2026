#!/usr/bin/env bash
# Publish the VG World game (scripts/vgworld/vgworld.html) as /play/.
# External CDNs (three.js / Noto SC fonts) are rewritten to self-hosted copies
# in play/vendor/ so the game loads reliably from mainland China.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="scripts/vgworld/vgworld.html"
DEST="play/index.html"
VENDOR="play/vendor"

for f in "$VENDOR/three/three.module.min.js" "$VENDOR/three/three.core.js" "$VENDOR/fonts/noto-sc.css"; do
  [[ -f "$f" ]] || { echo "Missing vendor file: $f" >&2; exit 1; }
done

mkdir -p play
cp "$SRC" "$DEST"

# Fonts: Feishu font CSS -> self-hosted subset CSS.
perl -pi -e 's#https://miaoda\.feishu\.cn/fonts/css2\?[^"]*#/play/vendor/fonts/noto-sc.css#g' "$DEST"
# three.js: source already points at /play/vendor. Rewrite a leftover CDN import if one returns.
perl -pi -e 's#https://fastly\.jsdelivr\.net/npm/three\@0\.187\.0/build/three\.module\.js#/play/vendor/three/three.module.min.js#g' "$DEST"

# Add site favicon + description if the source doesn't have them.
if ! grep -q 'rel="icon"' "$DEST"; then
  perl -0pi -e 's#(</title>)#$1\n<meta name="description" content="梵高世界 · Starry Wanderer — 走进梵高画布的第一人称开放世界探索游戏 | SKAND STUDIO">\n<link rel="icon" type="image/png" href="/favicon.png">#' "$DEST"
fi

if grep -qE 'miaoda\.feishu\.cn|fastly\.jsdelivr\.net' "$DEST"; then
  echo "Warning: some CDN URLs were not rewritten (source format changed?)" >&2
fi
echo "Synced $SRC -> $DEST ($(du -h "$DEST" | cut -f1))"
