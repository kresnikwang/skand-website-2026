# skand website

## Updating the /play/ game (VG World · 梵高世界)

`https://skandstudio.com/play/` serves **梵高世界 · Starry Wanderer**.

| What | Where |
| --- | --- |
| Game source (edit this) | `scripts/vgworld/vgworld.html` (+ design notes `vgworld.md`) |
| Generated page (do not edit by hand) | `play/index.html` |
| Self-hosted three.js r187 | `play/vendor/three/` |
| Self-hosted Noto Serif/Sans SC fonts | `play/vendor/fonts/` |
| Source -> page sync script | `scripts/sync-play.sh` (`npm run build:play`) |

`scripts/sync-play.sh` stamps every build with a timestamp/hash version. It writes
`play/version.txt`, adds `<meta name="vg-build">` to `play/index.html`, appends `?v=`
to local fonts/three.js, and updates the homepage `/play/?v=...` link so WeChat does
not keep serving an old cached page.

`scripts/sync-play.sh` copies the source to `play/index.html`. three.js is imported
from `/play/vendor/three/` in the source. The script rewrites the Feishu font CDN to
`/play/vendor/fonts/`, rewrites a leftover jsDelivr three.js URL if one comes back,
then adds the site favicon. It warns if a CDN URL could not be rewritten.

### Workflow

```bash
# 1. edit the game
$EDITOR scripts/vgworld/vgworld.html

# 2. regenerate /play/ and preview locally
npm run build:play
python3 -m http.server 8766    # open http://localhost:8766/play/

# 3. commit + push (game source and generated page together)
git add scripts/vgworld play
git commit -m "vgworld: ..."
git push origin main

# 4. deploy (also re-runs sync-play.sh and smoke-tests the live site)
./scripts/deploy.sh
```

### Notes

- Player progress is saved in the browser (`localStorage` key `vg_save_v1`).
  If a change makes old saves incompatible, bump the key / `v` field in the
  save module (search `vg_save_v1`) instead of breaking existing players.
- Debug URLs such as `/play/#auto&paint=all` or `#at=x,z,yaw,pitch` never read
  or write the save.
- The old SKAND BRAWLER game source is kept in `scripts/skand-brawler/`
  (`npm run build:brawler` writes to `play/` and would overwrite VG World).
- `scripts/vgworld/` and `scripts/skand-brawler/` are excluded from the server
  upload; only `play/` is published.
