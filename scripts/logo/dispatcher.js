// Daily hero logo effect dispatcher.
// China local day (UTC+8): Mon=1 .. Sun=7.
// Monday keeps the existing 2D canvas effect in index.html.
// Tue..Sun are loaded lazily (only the current day's module + Pixi).
// URL override: ?fx=1..7 or ?fx=monday..sunday
import('./shared.js')
  .then((shared) => {
    const day = shared.getEffectiveDay();
    const map = {
      2: 'tue-pixelmelt',
      3: 'wed-inkbloom',
      4: 'thu-parallax3d',
      5: 'fri-neon',
      6: 'sat-physics',
      7: 'sun-ascii',
    };

    if (day === 1) return; // Monday: built-in canvas effect handles it

    const mod = map[day];
    if (!mod) {
      shared.revealStaticTitle();
      return;
    }
    // Cache-bust only the day module (never shared.js — it must stay a single
    // instance, and the day modules import it without a query).
    import(`./${mod}.js?v=7`)
      .then((m) => {
        if (!m.init) {
          shared.revealStaticTitle();
          return;
        }
        m.init().catch((e) => {
          console.error('[logo-effect] init failed:', e);
          shared.revealStaticTitle();
        });
      })
      .catch((e) => {
        console.error('[logo-effect] load failed:', e);
        shared.revealStaticTitle();
      });
  })
  .catch((e) => {
    console.error('[logo-effect] shared failed:', e);
  });
