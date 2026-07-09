// Saturday — 物理积木 (Physics Blocks).
// SKAND is split into a grid of blocks (matter.js bodies). On page load they
// fall from above and spring-assemble into the logo; afterwards they freeze
// and can be dragged, dropped and stacked on an invisible floor.
import {
  Application,
  Texture,
  CanvasSource,
  Rectangle,
  Sprite,
  Container,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
import Matter from 'https://esm.sh/matter-js@0.20.0';
import {
  isMobile, prepareHeroForPixi, makeApp, bindPixi, brandTextCanvas,
  makeTexture, subTexture, trackPointer,
} from './shared.js';

const { Engine, Bodies, Composite, Body, Constraint } = Matter;

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero, { pointerEvents: true });
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  /* ---- logo texture ---- */
  const logo = brandTextCanvas({
    text: 'SKAND', size: 200, weight: 500, letterSpacing: 8,
  });
  const baseTex = makeTexture(logo.canvas);

  /* ---- grid sampling ---- */
  const ctx = logo.canvas.getContext('2d');
  const cols = isMobile ? 28 : 40;
  const rows = isMobile ? 11 : 15;
  const tw = Math.ceil(logo.width / cols);
  const th = Math.ceil(logo.height / rows);

  /* ---- physics engine ---- */
  const engine = Engine.create();
  engine.gravity.y = 0.8;

  /* ---- scale helper ---- */
  const scaleFit = () => (app.screen.width * 0.72) / logo.width;
  let scale = scaleFit();

  /* ---- walls & floor (invisible boundaries) ---- */
  const WALL_T = 80;
  let W = app.screen.width;
  let H = app.screen.height;

  const floorBody = Bodies.rectangle(W / 2, H + WALL_T / 2 - 5, W * 4, WALL_T, {
    isStatic: true, friction: 0.6, restitution: 0.1,
  });
  const leftBody = Bodies.rectangle(-WALL_T / 2, H / 2, WALL_T, H * 4, {
    isStatic: true, friction: 0.4, restitution: 0.15,
  });
  const rightBody = Bodies.rectangle(W + WALL_T / 2, H / 2, WALL_T, H * 4, {
    isStatic: true, friction: 0.4, restitution: 0.15,
  });
  Composite.add(engine.world, [floorBody, leftBody, rightBody]);

  /* ---- container for sprites ---- */
  const stage = new Container();
  app.stage.addChild(stage);

  /* ---- build blocks ---- */
  const blocks = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = Math.min(c * tw + tw / 2, logo.width - 1);
      const py = Math.min(r * th + th / 2, logo.height - 1);
      const a = ctx.getImageData(px, py, 1, 1).data[3];
      if (a < 60) continue;

      const sx = Math.min(c * tw, logo.width - tw);
      const sy = Math.min(r * th, logo.height - th);
      const tex = subTexture(baseTex, sx, sy, tw, th);
      const spr = new Sprite(tex);
      spr.anchor.set(0.5);
      stage.addChild(spr);

      const bw = tw * scale;
      const bh = th * scale;

      // Target position centred in hero
      const targetX = (sx + tw / 2 - logo.width / 2) * scale + W / 2;
      const targetY = (sy + th / 2 - logo.height / 2) * scale + H / 2;

      // Stagger drop heights for a rain-like assembly
      const stagger = (c / cols) * 300 + (r / rows) * 120 + Math.random() * 100;
      const startX = W * (0.15 + Math.random() * 0.7);
      const startY = -50 - stagger;

      const body = Bodies.rectangle(startX, startY, bw, bh, {
        friction: 0.6,
        restitution: 0.1,
        frictionAir: 0.015,
        collisionFilter: { group: -1 },
      });
      Composite.add(engine.world, body);

      // Spring to pull toward target
      const cons = Constraint.create({
        bodyA: body,
        pointB: { x: targetX, y: targetY },
        stiffness: 0.12,
        damping: 0.04,
        length: 0,
      });
      Composite.add(engine.world, cons);

      // Store texel coordinates for resize recalculation
      blocks.push({ spr, body, cons, bw, bh, targetX, targetY, sx, sy });
    }
  }

  /* ---- manual drag ---- */
  let dragged = null;
  let offX = 0, offY = 0;

  const pickBlock = () => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      const x = b.body.position.x, y = b.body.position.y;
      if (Math.abs(ptr.x - x) < b.bw / 2 + 6 && Math.abs(ptr.y - y) < b.bh / 2 + 6) return b;
    }
    return null;
  };

  const startDrag = () => {
    if (!ptr.inside) return;
    const b = pickBlock();
    if (b) {
      dragged = b;
      Body.setStatic(b.body, false);
      b.body.collisionFilter.group = 0;
      offX = ptr.x - b.body.position.x;
      offY = ptr.y - b.body.position.y;
    }
  };
  const endDrag = () => { dragged = null; };
  hero.addEventListener('mousedown', startDrag);
  window.addEventListener('mouseup', endDrag);
  hero.addEventListener('touchstart', startDrag, { passive: true });
  window.addEventListener('touchend', endDrag);

  /* ---- assembly timeline ---- */
  const assembleEnd = performance.now() + 2200;
  let assembled = false;

  /* ---- resize ---- */
  app.renderer.on('resize', () => {
    scale = scaleFit();
    W = app.screen.width;
    H = app.screen.height;

    // Reposition walls
    Body.setPosition(floorBody, { x: W / 2, y: H + WALL_T / 2 - 5 });
    Body.setPosition(leftBody, { x: -WALL_T / 2, y: H / 2 });
    Body.setPosition(rightBody, { x: W + WALL_T / 2, y: H / 2 });

    for (const b of blocks) {
      b.bw = tw * scale;
      b.bh = th * scale;
      Body.setVertices(b.body, Bodies.rectangle(0, 0, b.bw, b.bh, {}).vertices);
      // Recalculate target positions using stored texel coords
      b.targetX = (b.sx + tw / 2 - logo.width / 2) * scale + W / 2;
      b.targetY = (b.sy + th / 2 - logo.height / 2) * scale + H / 2;
    }
  });

  /* ---- tick ---- */
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaTime, 3);

    if (!assembled && performance.now() > assembleEnd) {
      assembled = true;
      for (const b of blocks) {
        Composite.remove(engine.world, b.cons);
        Body.setStatic(b.body, true);
        b.body.collisionFilter.group = 0;
      }
    }

    if (dragged) {
      Body.setPosition(dragged.body, { x: ptr.x - offX, y: ptr.y - offY });
      Body.setVelocity(dragged.body, { x: 0, y: 0 });
      Body.setAngularVelocity(dragged.body, 0);
    }

    Engine.update(engine, 16.666 * dt);

    for (const b of blocks) {
      b.spr.x = b.body.position.x;
      b.spr.y = b.body.position.y;
      b.spr.rotation = b.body.angle;
      b.spr.scale.set(scale);
    }
  });
}
