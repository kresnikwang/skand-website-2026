// Saturday — Physics Blocks.
// SKAND is split into blocks (matter.js). On load they fall and assemble
// into the logo (落下拼装); afterwards they can be dragged, dropped and
// stacked. Dragging is handled manually in stage coordinates for reliability.
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
  isMobile, prepareHeroForPixi, makeApp, bindPixi, createTextCanvas,
  makeTexture, subTexture, trackPointer,
} from './shared.js';

const { Engine, Bodies, Composite, Body, Constraint } = Matter;

export async function init() {
  prepareHeroForPixi();
  const hero = document.getElementById('hero');
  const app = await makeApp(hero, { pointerEvents: true });
  bindPixi(Texture, CanvasSource, Rectangle);
  const ptr = trackPointer(hero);

  const logo = createTextCanvas({ text: 'SKAND', size: 200, weight: 500, letterSpacing: 8 });
  const baseTex = makeTexture(logo.canvas);

  // Sample the logo alpha on a grid to decide which cells are filled.
  const ctx = logo.canvas.getContext('2d');
  const cols = isMobile ? 28 : 40;
  const rows = isMobile ? 11 : 15;
  const tw = Math.ceil(logo.width / cols);
  const th = Math.ceil(logo.height / rows);

  const engine = Engine.create();
  engine.gravity.y = 0.6; // fall during assemble

  const blocks = [];
  const stage = new Container();
  stage.x = app.screen.width / 2;
  stage.y = app.screen.height / 2;
  app.stage.addChild(stage);

  const scaleFit = () => (app.screen.width * 0.72) / logo.width;
  let scale = scaleFit();

  let idx = 0;
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
      // target (local stage coords) so logo is centered
      const targetX = (sx + tw / 2 - logo.width / 2) * scale;
      const targetY = (sy + th / 2 - logo.height / 2) * scale;

      const body = Bodies.rectangle(
        app.screen.width * (0.2 + Math.random() * 0.6),
        -100 - Math.random() * app.screen.height,
        bw,
        bh,
        { friction: 0.5, restitution: 0.15, frictionAir: 0.02 }
      );
      Composite.add(engine.world, body);

      const cons = Constraint.create({
        bodyA: body,
        pointB: { x: targetX, y: targetY },
        stiffness: 0.02,
        damping: 0.08,
        length: 0,
      });
      Composite.add(engine.world, cons);

      blocks.push({ spr, body, cons, bw, bh });
      idx++;
    }
  }

  // Manual drag (reliable stage-coordinate dragging)
  let dragged = null;
  let offX = 0, offY = 0;
  let down = false;

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
      offX = ptr.x - b.body.position.x;
      offY = ptr.y - b.body.position.y;
    }
  };
  const endDrag = () => { dragged = null; };
  hero.addEventListener('mousedown', () => { down = true; startDrag(); });
  window.addEventListener('mouseup', () => { down = false; endDrag(); });
  hero.addEventListener('touchstart', () => { down = true; startDrag(); }, { passive: true });
  window.addEventListener('touchend', () => { down = false; endDrag(); });

  app.renderer.on('resize', () => {
    scale = scaleFit();
    for (const b of blocks) {
      b.bw = tw * scale;
      b.bh = th * scale;
      Body.setVertices(b.body, Bodies.rectangle(0, 0, b.bw, b.bh, {}).vertices);
    }
  });

  const assembleEnd = performance.now() + 2400;
  let assembled = false;

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaTime, 3);

    if (!assembled && performance.now() > assembleEnd) {
      assembled = true;
      engine.gravity.y = 0; // hold the assembled shape; drag/stack from here
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
      b.spr.scale.set(scale); // texture source px -> css px
    }
  });
}
