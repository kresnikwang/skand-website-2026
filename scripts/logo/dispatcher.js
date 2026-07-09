// Daily hero logo effect dispatcher.
// China local day (UTC+8): Mon=1 .. Sun=7.
// Monday keeps the existing 2D canvas effect in index.html.
// Tue..Sun are loaded lazily (only the current day's module + Pixi).
// URL override: ?fx=1..7 or ?fx=monday..sunday
window.__dispatcherSteps = ['start'];

function showDbg(msg) {
  window.__dispatcherSteps.push(msg);
  var box = document.getElementById('__skandDebugBox');
  if (box) box.textContent += (box.textContent ? '\n' : '') + '[DISP] ' + msg;
}

showDbg('before-import-shared');

import('./shared.js')
  .then((shared) => {
    showDbg('shared-ok');
    const day = shared.getEffectiveDay();
    showDbg('day=' + day);
    const map = {
      2: 'tue-pixelmelt',
      3: 'wed-inkbloom',
      4: 'thu-parallax3d',
      5: 'fri-neon',
      6: 'sat-physics',
      7: 'sun-ascii',
    };

    if (day === 1) {
      showDbg('monday-skip');
      return;
    }
    const mod = map[day];
    if (!mod) {
      showDbg('no-mod-fallback');
      shared.revealStaticTitle();
      return;
    }
    showDbg('import-' + mod);
    import(`./${mod}.js`)
      .then((m) => {
        showDbg('mod-loaded');
        if (!m.init) {
          showDbg('no-init');
          shared.revealStaticTitle();
          return;
        }
        m.init()
          .then(() => showDbg('init-done'))
          .catch((e) => {
            showDbg('init-err:' + (e && e.message));
            console.error('[logo-effect] init failed:', e);
            shared.revealStaticTitle();
          });
      })
      .catch((e) => {
        showDbg('mod-err:' + (e && e.message));
        console.error('[logo-effect] load failed:', e);
        shared.revealStaticTitle();
      });
  })
  .catch((e) => {
    showDbg('shared-err:' + (e && e.message));
    console.error('[logo-effect] shared failed:', e);
  });
