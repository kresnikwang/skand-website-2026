// Daily logo effect dispatcher — its own full-screen section below Contact.
//
// The hero is a permanent Three.js exploded-view project showcase
// (scripts/hero/explode.js). These day effects live in their own 100vh section,
// but they still lazy-load on approach rather than on page load: the hero is the
// LCP path and should not share the main thread and GPU with a decorative effect
// that is four sections away. Once loaded, shared.js's makeApp stops the Pixi
// ticker whenever the section scrolls out of view.
//
// China local day (UTC+8): Mon=1 .. Sun=7.
// URL override: ?fx=1..7 or ?fx=monday..sunday
import('./shared.js')
  .then((shared) => {
    const stage = document.getElementById('dailyLogoStage');
    if (!stage) return;

    const day = shared.getEffectiveDay();
    const map = {
      2: 'tue-pixelmelt',
      3: 'wed-inkbloom',
      4: 'thu-parallax3d',
      5: 'fri-neon',
      6: 'sat-physics',
      7: 'sun-ascii',
    };

    // Start loading well before the section arrives, so the effect is already
    // built by the time it is on screen rather than snapping into life on
    // arrival. Generous, because the alternative is a blank full-screen section
    // for a beat.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();

        const mod = map[day];
        // Monday has no Pixi module — a static gradient wordmark is the point.
        if (!mod) {
          shared.mountStaticWordmark(stage);
          return;
        }
        // Cache-bust only the day module (never shared.js — it must stay a
        // single instance, and the day modules import it without a query).
        import(`./${mod}.js?v=17`)
          .then((m) => {
            if (!m.init) {
              shared.mountStaticWordmark(stage);
              return;
            }
            m.init(stage).catch((e) => {
              console.error('[logo-effect] init failed:', e);
              shared.mountStaticWordmark(stage);
            });
          })
          .catch((e) => {
            console.error('[logo-effect] load failed:', e);
            shared.mountStaticWordmark(stage);
          });
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(stage);
  })
  .catch((e) => {
    console.error('[logo-effect] shared failed:', e);
  });
