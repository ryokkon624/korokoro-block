// おきゃくさん: おうちに すきな ブロックを おくと あそびに くる 生きもの
// 花 → ちょうちょ、やね → ことり、ほたる → ほうせき
//
// world（おうちや ずかんの ばめん）に ひつようなもの:
//   cols, rows: ひろさ（マス）、minY: とんでいい いちばん上
//   code(x, y): そのマスの ブロックの 文字（なにもなければ '.'）、isSolid(x, y)
//   ball: ころん（{ x, y }。いなければ null）、say(text, x, y): 文字を 出す

import { paint, silhouette, outline } from './friends.js';
import { sfx } from './sound.js';

export const VISITORS = {
  butterfly: {
    name: 'ちょうちょ',
    block: 'f',
    blockName: '花',
    note: '花が 大すき。花の まわりを ひらひら とんで、ときどき 花に とまるよ。',
  },
  bird: {
    name: 'ことり',
    block: 'y',
    blockName: 'やね',
    note: 'やねの 上が おきにいり。ころんが ちかづくと とんでいくよ。',
  },
  firefly: {
    name: 'ほたる',
    block: 'g',
    blockName: 'ほうせき',
    note: 'きらきらの ほうせきが 大すき。まわりで ふわふわ ひかるよ。',
  },
};
// ずかんの じゅん
export const VISITOR_ORDER = ['butterfly', 'bird', 'firefly'];

// ---------- ドット絵 ----------
const BUTTERFLY_ROWS = [
  // はねを ひらく
  [
    '.k.....k.',
    '..k...k..',
    'WWW.b.WWW',
    'WSWWbWWSW',
    'WWWWbWWWW',
    '.WWWbWWW.',
    '..WWbWW..',
    '.WWW.WWW.',
  ],
  // はねを とじる
  [
    '.k.....k.',
    '..k...k..',
    '...WbW...',
    '..WSbSW..',
    '..WWbWW..',
    '...WbW...',
    '...WbW...',
    '.........',
  ],
];
// 空でも 見えるように、はねの ふちは こい色
const BUTTERFLY_COLORS = [
  { W: '#ffd84a', S: '#d9781a' },
  { W: '#8fd0ff', S: '#2c64b0' },
  { W: '#ffa6d4', S: '#c9407e' },
];
const butterflySpr = BUTTERFLY_COLORS.map((c) =>
  BUTTERFLY_ROWS.map((rows) => paint(outline(rows, ['W', 'S']), { ...c, b: '#3b2a17', k: '#3b2a17' })),
);

// ことり（右むき、いちばん下の行が 足もと）
const BIRD_ROWS = {
  stand: [
    '...BBBB..',
    '..BBBBkBo',
    '..BBBBBB.',
    'TBDDBBww.',
    '.TDDDBww.',
    '..BDDBw..',
    '...BBB...',
    '...l.l...',
  ],
  up: [
    '.DDBBBB..',
    '.DDBBBkBo',
    '..DBBBBB.',
    'TBBBBBww.',
    '.TBBBBww.',
    '..BBBBw..',
    '...BBB...',
    '.........',
  ],
  down: [
    '...BBBB..',
    '..BBBBkBo',
    '..BBBBBB.',
    'TBBBBBww.',
    '.TDDBBww.',
    '..DDDBw..',
    '..DDBB...',
    '..D......',
  ],
};
const BIRD_PALETTE = {
  B: '#9ad6ff',
  E: '#2f6fb0',
  D: '#3f86d0',
  T: '#3f86d0',
  w: '#ffffff',
  k: '#1d2433',
  o: '#ffa53a',
  l: '#e08a2a',
};
const birdSpr = Object.fromEntries(
  Object.entries(BIRD_ROWS).map(([k, rows]) => [k, paint(outline(rows, ['B', 'E']), BIRD_PALETTE)]),
);

// ほたる（右むき。あたまは 赤く、おしりが ひかる）
const fireflySpr = paint(['......kk.', '..wwwwrrk', 'YYkkkkrr.', 'YYkkkk...', '..k.k.k..'], {
  w: 'rgba(255,255,255,.85)',
  Y: '#eaff6a',
  k: '#2b2b2b',
  r: '#e0452c',
});

const SPR = { butterfly: butterflySpr[0][0], bird: birdSpr.stand, firefly: fireflySpr };
const SHADOW = Object.fromEntries(Object.entries(SPR).map(([id, img]) => [id, silhouette(img)]));
const SIZE = { butterfly: 0.5, bird: 0.55, firefly: 0.42 }; // よこはば（マス）

// cx, cy: まんなか、w: よこはば（ピクセル）
function drawSprite(ctx, img, cx, cy, w, flip = false) {
  const h = (w * img.height) / img.width;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ほたるの ひかり（a: あかるさ 0〜1）。あかるい 空でも 見えるように こい 黄色
function drawGlow(ctx, x, y, r, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,200,${a})`);
  g.addColorStop(0.35, `rgba(240,235,40,${0.8 * a})`);
  g.addColorStop(1, 'rgba(240,235,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ずかんや「あそびに きた！」の 絵。t: 1マスの 大きさ（ピクセル）
export function drawVisitor(ctx, id, cx, cy, t, shadow = false) {
  const w = SIZE[id] * t;
  if (id === 'firefly' && !shadow) drawGlow(ctx, cx - w * 0.38, cy + w * 0.06, w * 0.8, 1);
  drawSprite(ctx, shadow ? SHADOW[id] : SPR[id], cx, cy, w);
}

// HTML の <img> 用（正方形）
export function visitorIconURL(id, size = 48, shadow = false) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  drawVisitor(c.getContext('2d'), id, size / 2, size / 2, (size * 0.9) / SIZE[id] / (id === 'firefly' ? 1.4 : 1), shadow);
  return c.toDataURL();
}

// ---------- うごき ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function cellsOf(world, ch) {
  const out = [];
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) if (world.code(x, y) === ch) out.push({ x, y });
  }
  return out;
}

// とおくから とんでくる ところ
function offscreen(world) {
  const left = Math.random() < 0.5;
  return { x: left ? -0.8 : world.cols + 0.8, y: world.minY + Math.random() * 1.5 };
}

const REST_Y = -0.1; // 花に とまる たかさ（マスの 上から。花びらの 上に のる）

class Butterfly {
  constructor(world, place) {
    this.id = 'butterfly';
    this.color = Math.floor(Math.random() * butterflySpr.length);
    this.t = Math.random() * 10;
    this.leaving = false;
    this.done = false;
    this.goFlower(world);
    if (place && this.cell) {
      this.x = this.tx;
      this.y = this.ty;
      this.state = 'rest';
      this.rest = 1 + Math.random() * 2;
    } else {
      Object.assign(this, offscreen(world));
      this.state = 'fly';
    }
  }

  goFlower(world) {
    const flowers = cellsOf(world, 'f');
    if (!flowers.length) {
      this.leave(world);
      return;
    }
    this.cell = pick(flowers);
    this.tx = this.cell.x + 0.5;
    this.ty = this.cell.y + REST_Y;
  }

  // 花の 上の ほうを ふらっと とぶ
  wander(world) {
    this.state = 'fly';
    this.cell = null;
    this.tx = clamp(this.x + (Math.random() - 0.5) * 3, 0.4, world.cols - 0.4);
    this.ty = clamp(this.y - 0.6 - Math.random() * 1.4, world.minY, world.rows - 0.6);
  }

  leave(world) {
    this.leaving = true;
    this.state = 'fly';
    this.cell = null;
    this.tx = this.x < world.cols / 2 ? -1 : world.cols + 1;
    this.ty = world.minY - 1;
  }

  update(dt, world) {
    this.t += dt;
    const lost = this.cell && world.code(this.cell.x, this.cell.y) !== 'f';
    if (this.state === 'rest') {
      const b = world.ball;
      if (lost || (b && Math.hypot(b.x - this.x, b.y - this.y) < 1.2) || (this.rest -= dt) <= 0) this.wander(world);
      return;
    }
    if (lost) this.goFlower(world);
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = (this.leaving ? 3 : 1.6) * dt;
    if (d > step) {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      return;
    }
    this.x = this.tx;
    this.y = this.ty;
    if (this.leaving) this.done = true;
    else if (this.cell) {
      this.state = 'rest';
      this.rest = 2 + Math.random() * 3;
    } else this.goFlower(world);
  }

  tap(world) {
    if (!this.leaving) this.wander(world);
  }

  hits(x, y) {
    return Math.hypot(x - this.x, y - this.y) < 0.45;
  }

  draw(ctx, ox, oy, t) {
    const flying = this.state === 'fly';
    // とぶときは パタパタ、とまっているときは ときどき はねを とじる
    const frame = flying ? Math.floor(this.t / 0.09) % 2 : this.t % 1.6 < 0.3 ? 1 : 0;
    const bob = flying ? Math.sin(this.t * 6) * 0.12 : 0;
    drawSprite(ctx, butterflySpr[this.color][frame], ox + this.x * t, oy + (this.y + bob) * t, t * SIZE.butterfly);
  }
}

// ことりが とまれる ところ（上が あいている やね）。x, y は 足もと
function perches(world) {
  const out = [];
  for (const c of cellsOf(world, 'y')) {
    if (world.code(c.x, c.y - 1) !== '.') continue;
    const left = world.code(c.x - 1, c.y) === 'y';
    const right = world.code(c.x + 1, c.y) === 'y';
    // ななめの やねは 高い ほうの はしに とまる
    let x = c.x + 0.5;
    let y = c.y;
    if (right && !left) {
      x = c.x + 0.78;
      y = c.y + 0.22;
    } else if (left && !right) {
      x = c.x + 0.22;
      y = c.y + 0.22;
    }
    out.push({ cx: c.x, cy: c.y, x, y });
  }
  return out;
}

const FLEE = 1.8; // ころんが これより ちかいと にげる

class Bird {
  // perch: とまる ところ
  constructor(world, perch, place) {
    this.id = 'bird';
    this.perch = perch;
    this.t = Math.random() * 10;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.timer = 1;
    this.hopT = 0;
    this.peckT = 0;
    this.leaving = false;
    this.done = false;
    this.tx = perch.x;
    this.ty = perch.y;
    if (place) {
      this.x = perch.x;
      this.y = perch.y;
      this.state = 'perch';
    } else {
      Object.assign(this, offscreen(world));
      this.y -= 1;
      this.state = 'in';
    }
  }

  perchOK(world) {
    const p = this.perch;
    return world.code(p.cx, p.cy) === 'y' && world.code(p.cx, p.cy - 1) === '.';
  }

  leave(world) {
    this.leaving = true;
    this.state = 'away';
    this.tx = this.x < world.cols / 2 ? -1.2 : world.cols + 1.2;
    this.ty = world.minY - 1.5;
  }

  chirp(world) {
    sfx.chirp();
    world.say('ちゅん', this.x + this.dir * 0.6, this.y - 0.55);
  }

  update(dt, world) {
    this.t += dt;
    this.hopT = Math.max(0, this.hopT - dt);
    this.peckT = Math.max(0, this.peckT - dt);

    if (this.state === 'perch') {
      const b = world.ball;
      if (!this.perchOK(world) || (b && Math.hypot(b.x - this.x, b.y - (this.y - 0.3)) < FLEE)) {
        this.leave(world);
        return;
      }
      // つつく・はねる・なく・むきを かえる
      if ((this.timer -= dt) <= 0) {
        this.timer = 0.8 + Math.random() * 1.6;
        const r = Math.random();
        if (r < 0.3) this.peckT = 0.35;
        else if (r < 0.55) this.hopT = 0.3;
        else if (r < 0.75) this.chirp(world);
        else this.dir *= -1;
      }
      return;
    }

    if (this.state === 'in' && !this.perchOK(world)) this.leave(world);
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = 4 * dt;
    if (Math.abs(dx) > 0.05) this.dir = Math.sign(dx);
    if (d > step) {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      return;
    }
    this.x = this.tx;
    this.y = this.ty;
    if (this.state === 'away') this.done = true;
    else {
      this.state = 'perch';
      this.timer = 0.6;
    }
  }

  tap(world) {
    if (this.state !== 'perch') return;
    this.hopT = 0.3;
    this.chirp(world);
  }

  hits(x, y) {
    return Math.hypot(x - this.x, y - (this.y - 0.3)) < 0.5;
  }

  draw(ctx, ox, oy, t) {
    let img = Math.floor(this.t / 0.1) % 2 ? birdSpr.up : birdSpr.down;
    let lift = 0;
    let tilt = 0;
    if (this.state === 'perch') {
      img = birdSpr.stand;
      if (this.hopT > 0) lift = Math.sin((this.hopT / 0.3) * Math.PI) * 0.16;
      if (this.peckT > 0) tilt = 0.5;
    }
    const w = t * SIZE.bird;
    const h = (w * img.height) / img.width;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(ox + this.x * t, oy + (this.y - lift) * t);
    if (this.dir < 0) ctx.scale(-1, 1);
    ctx.rotate(tilt); // つつくときは まえに かたむく
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
}

class Firefly {
  constructor(world, gem, place) {
    this.id = 'firefly';
    this.gem = gem;
    this.t = Math.random() * 10;
    this.dir = 1;
    this.boost = 0;
    this.leaving = false;
    this.done = false;
    this.alpha = place ? 1 : 0;
    this.x = gem.x + 0.5 + (Math.random() - 0.5) * 1.5;
    this.y = gem.y - 0.2 - Math.random() * 0.8;
    this.aim(world, 1);
  }

  // ほうせきの まわりで つぎに むかう ところ（spread: ひろがり）
  aim(world, spread) {
    this.tx = clamp(this.gem.x + 0.5 + (Math.random() - 0.5) * 2.4 * spread, 0.2, world.cols - 0.2);
    this.ty = clamp(this.gem.y + 0.6 - Math.random() * 2 * spread, world.minY, world.rows - 0.2);
  }

  leave() {
    this.leaving = true;
  }

  update(dt, world) {
    this.t += dt;
    if (this.leaving) {
      if ((this.alpha -= dt) <= 0) this.done = true;
    } else {
      this.alpha = Math.min(1, this.alpha + dt * 0.8);
      if (world.code(this.gem.x, this.gem.y) !== 'g') {
        const gems = cellsOf(world, 'g');
        if (gems.length) {
          this.gem = pick(gems);
          this.aim(world, 1);
        } else this.leave();
      }
    }
    this.boost = Math.max(0, this.boost - dt);
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = (0.6 + this.boost * 3) * dt;
    if (Math.abs(dx) > 0.02) this.dir = Math.sign(dx);
    if (d > step) {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
    } else this.aim(world, 1);
  }

  // さわると ぱっと ちらばる
  tap(world) {
    this.boost = 1;
    this.aim(world, 1.6);
  }

  hits(x, y) {
    return Math.hypot(x - this.x, y - this.y) < 0.4;
  }

  draw(ctx, ox, oy, t) {
    const glow = 0.55 + 0.45 * Math.sin(this.t * 3);
    const x = ox + this.x * t;
    const y = oy + this.y * t;
    const w = t * SIZE.firefly;
    ctx.globalAlpha = this.alpha;
    drawGlow(ctx, x - this.dir * w * 0.38, y + w * 0.06, t * (0.22 + 0.18 * glow), 0.4 + 0.6 * glow);
    drawSprite(ctx, fireflySpr, x, y, w, this.dir < 0);
    ctx.globalAlpha = 1;
  }
}

// 1ぴき よぶ（よべない ときは null）。place: さいしょから その場に いる（ずかん用）
export function spawnVisitor(id, world, list, place = false) {
  if (id === 'butterfly') return cellsOf(world, 'f').length ? new Butterfly(world, place) : null;
  if (id === 'bird') {
    // ほかの ことりが いない、ころんから はなれた やね
    const b = world.ball;
    const free = perches(world).filter(
      (p) =>
        !list.some((v) => v.id === 'bird' && !v.leaving && v.perch.cx === p.cx && v.perch.cy === p.cy) &&
        !(b && Math.hypot(b.x - p.x, b.y - p.y) < FLEE + 0.5),
    );
    return free.length ? new Bird(world, pick(free), place) : null;
  }
  if (id === 'firefly') {
    // ほたるが いちばん すくない ほうせきへ
    const gems = cellsOf(world, 'g');
    if (!gems.length) return null;
    const n = (g) => list.filter((v) => v.id === 'firefly' && !v.leaving && v.gem.x === g.x && v.gem.y === g.y).length;
    const fewest = Math.min(...gems.map(n));
    return new Firefly(world, pick(gems.filter((g) => n(g) === fewest)), place);
  }
  return null;
}

// おいた ブロックの 数で、くる数が きまる
const WANT = {
  butterfly: (w) => Math.min(3, Math.ceil(cellsOf(w, 'f').length / 2)),
  bird: (w) => Math.min(2, Math.ceil(perches(w).length / 3)),
  firefly: (w) => Math.min(6, cellsOf(w, 'g').length * 2),
};

// おうちに いる おきゃくさん みんな
export class Visitors {
  constructor() {
    this.list = [];
    this.wait = {};
    this.onArrive = null; // 1ぴき よんだら 呼ぶ
    this.reset();
  }

  reset() {
    this.list = [];
    for (const id of VISITOR_ORDER) this.wait[id] = 1 + Math.random() * 2;
  }

  update(dt, world) {
    for (const id of VISITOR_ORDER) {
      const here = this.list.filter((v) => v.id === id && !v.leaving);
      const want = WANT[id](world);
      // ブロックが へったら かえる。たりなければ すこし まってから くる
      if (here.length > want) here[here.length - 1].leave(world);
      if (here.length >= want) {
        if (this.wait[id] < 1.5) this.wait[id] = 1.5 + Math.random() * 2;
        continue;
      }
      if ((this.wait[id] -= dt) > 0) continue;
      this.wait[id] = 1.5 + Math.random() * 2.5;
      const v = spawnVisitor(id, world, this.list);
      if (!v) continue;
      this.list.push(v);
      if (this.onArrive) this.onArrive(id);
    }
    for (const v of this.list) v.update(dt, world);
    this.list = this.list.filter((v) => !v.done);
  }

  hit(x, y) {
    return this.list.find((v) => !v.leaving && v.hits(x, y));
  }

  draw(ctx, ox, oy, t) {
    for (const v of this.list) v.draw(ctx, ox, oy, t);
  }
}
