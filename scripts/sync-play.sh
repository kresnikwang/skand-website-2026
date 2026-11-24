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

# Cache busting: every build gets a unique version. Each deploy is a new URL,
# so WeChat/mobile browsers cannot serve an older /play/ page from cache.
BUILD_VERSION="$(date -u +%Y%m%d%H%M%S)-$(python3 -c 'import time; print(f"{time.time_ns()%100000000:08d}")')-$(shasum -a 256 "$SRC" | cut -c1-8)"
python3 - "$BUILD_VERSION" "$DEST" <<'PY'
import re, sys
from pathlib import Path
version, path = sys.argv[1], Path(sys.argv[2])
text = path.read_text()
text = re.sub(r'(/play/vendor/)([^?"\']+)', rf'\1\2?v={version}', text)
text = text.replace('<meta charset="UTF-8">',
    f'<meta charset="UTF-8">\n<meta name="vg-build" content="{version}">', 1)
path.write_text(text)
PY
printf '%s\n' "$BUILD_VERSION" > play/version.txt

# Keep the homepage entry in sync so visitors always open the current build.
python3 - "$BUILD_VERSION" <<'PY'
import re, sys
from pathlib import Path

version = sys.argv[1]
path = Path('index.html')
text = path.read_text()
updated = re.sub(r'href="/play/(?:\?v=[^"]*)?"', f'href="/play/?v={version}"', text, count=1)
if updated == text:
    updated = re.sub(r'(<a\s+href=")/play/"(?=[^>]*id="playGameBtn")', rf'\1/play/?v={version}"', text, count=1)
path.write_text(updated)
PY

# Add site favicon + description if the source doesn't have them.
if ! grep -q 'rel="icon"' "$DEST"; then
  perl -0pi -e 's#(</title>)#$1\n<meta name="description" content="梵高世界 · Starry Wanderer — 走进梵高画布的第一人称开放世界探索游戏 | SKAND STUDIO">\n<link rel="icon" type="image/png" href="/favicon.png">#' "$DEST"
fi

if grep -qE 'miaoda\.feishu\.cn|fastly\.jsdelivr\.net' "$DEST"; then
  echo "Warning: some CDN URLs were not rewritten (source format changed?)" >&2
fi
echo "Synced $SRC -> $DEST ($(du -h "$DEST" | cut -f1)) · build ${BUILD_VERSION}"
