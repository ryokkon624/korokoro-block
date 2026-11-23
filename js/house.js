// おうちづくり（横から見た世界に、あつめた素材でブロックをおく）
// ころんは 左右に傾けると転がる（重力あり）

import { tileTex, itemSprites, houseSprites, ITEM_NAMES, FONT, hash, drawBall } from './art.js';
import { collideCircle } from './physics.js';
import { sfx } from './sound.js';
import { FRIENDS, Pet, drawHeart } from './friends.js';
import { VISITORS, Visitors, drawVisitor } from './visitors.js';

export const COLS = 20;
export const ROWS = 9;
const TOP = 0.9; // 上の表示のたかさ（マス）
const GROUND = 1;
const PALETTE = 1.9; // 下のボタンのならびのたかさ（マス）

const BALL_R = 0.36;
const GRAVITY = 30;
const ACCEL = 30;
const KEEP = 0.6;
const BOUNCE = 0.15;
const MAX_SPEED = 12;

// ブロック: 文字 → 情報（ドアと花は通りぬけられる）
export const BLOCKS = {
  w: { material: 'wood', solid: true },
  s: { material: 'stone', solid: true },
  d: { material: 'wood', solid: false },
  m: { material: 'stone', solid: true },
  y: { material: 'wood', solid: true },
  f: { material: 'flower', solid: false },
  g: { material: 'gem', solid: true },
};
export const BLOCK_ORDER = ['w', 's', 'd', 'm', 'y', 'f', 'g'];

const blankRows = () => Array.from({ length: ROWS }, () => '.'.repeat(COLS));

// やねの形: となりにやねがあるかで きめる
function roofPath(g, x, y, t, left, right) {
  g.beginPath();
  if (left && right) {
    g.rect(x, y, t, t);
  } else if (right) {
    g.moveTo(x, y + t);
    g.lineTo(x + t, y);
    g.lineTo(x + t, y + t);
  } else if (left) {
    g.moveTo(x, y);
    g.lineTo(x + t, y + t);
    g.lineTo(x, y + t);
  } else {
    g.moveTo(x, y + t);
    g.lineTo(x + t / 2, y);
    g.lineTo(x + t, y + t);
  }
  g.closePath();
}

// ブロックを1つえがく（left/right は やねの形のため）。ずかんでも つかう
export function drawBlock(g, code, x, y, t, variant, left = false, right = false) {
  g.imageSmoothingEnabled = false;
  if (code === 'w') g.drawImage(tileTex.plank[variant], x, y, t, t);
  else if (code === 's') g.drawImage(tileTex.bricks[variant], x, y, t, t);
  else if (code === 'd') g.drawImage(houseSprites.door, x, y, t, t);
  else if (code === 'm') g.drawImage(houseSprites.window, x, y, t, t);
  else if (code === 'g') g.drawImage(houseSprites.gem, x, y, t, t);
  else if (code === 'f') g.drawImage(itemSprites.flower, x, y, t, t);
  else if (code === 'y') {
    g.save();
    roofPath(g, x, y, t, left, right);
    g.clip();
    g.drawImage(tileTex.roof[variant], x, y, t, t);
    g.restore();
    roofPath(g, x, y, t, left, right);
    g.strokeStyle = 'rgba(80,20,15,.6)';
    g.lineWidth = t * 0.05;
    g.stroke();
  }
}

// パレットのボタン用の絵
export function blockIconURL(code, size = 48) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  drawBlock(c.getContext('2d'), code, 0, 0, size, 0);
  return c.toDataURL();
}

export class House {
  constructor() {
    this.W = 0;
    this.H = 0;
    this.time = 0;
    this.items = { wood: 0, stone: 0, flower: 0, gem: 0 };
    this.selected = 'w';
    this.onChange = null; // ブロックをおいた・けしたときに呼ぶ（セーブ用）
    this.stroke = null;
    this.toast = null;
    this.banners = []; // 「あそびに きた！」は いちどに きても 1つずつ じゅんばんに 出す
    this.onVisitor = null; // おきゃくさんが はじめて きたときに呼ぶ（すぐセーブするため）
    this.visitors = new Visitors();
    this.visitors.onArrive = (id) => this.arrive(id);
    // おきゃくさんから 見た おうち
    const house = this;
    this.world = {
      cols: COLS,
      rows: ROWS,
      minY: 0.4,
      code: (x, y) => (this.grid[y] && this.grid[y][x]) || '.',
      isSolid: (x, y) => this.isSolid(x, y),
      get ball() {
        return house.ball;
      },
      say: (text, x, y) => this.fx.push({ text, x, y, life: 1 }),
    };
    this.setup(null, this.items);
  }

  // rows: セーブした家（なければ空き地）、items: 素材の数（そのまま増やしたり減らしたりする）
  // friends: ともだちに なった どうぶつ（おうちを 歩きまわる）
  // seen: きたことが ある おきゃくさん（はじめての子だけ「あそびに きた！」を出す）
  setup(rows, items, friends = [], seen = []) {
    const ok = Array.isArray(rows) && rows.length === ROWS && rows.every((r) => r.length === COLS);
    this.grid = (ok ? rows : blankRows()).map((r) => r.split(''));
    this.items = items;
    this.toast = null;
    this.banners = [];
    this.seen = [...seen];
    this.visitors.reset();
    // ころんは 地面の 左のほうの あいているところに
    let x = 0;
    while (x < COLS - 1 && this.isSolid(x, ROWS - 1)) x++;
    this.ball = { x: x + 0.5, y: ROWS - BALL_R, vx: 0, vy: 0, blink: 0 };
    this.fx = [];
    // ともだちは 横に ならべて、それぞれ いちばん下の あいているところに
    const ids = friends.filter((id) => FRIENDS[id]);
    this.pets = ids.map((id, i) => {
      const col = Math.floor(((i + 1) * COLS) / (ids.length + 1));
      let y = ROWS - 1;
      while (y > 0 && this.isSolid(col, y)) y--;
      return new Pet(id, col + 0.5, y + 1);
    });
  }

  rows() {
    return this.grid.map((r) => r.join(''));
  }

  resize(W, H) {
    this.W = W;
    this.H = H;
    const t = Math.floor(Math.min(W / COLS, H / (TOP + ROWS + GROUND + PALETTE)));
    this.tile = t;
    this.ox = Math.floor((W - COLS * t) / 2);
    this.oy = Math.floor((H - (TOP + ROWS + GROUND + PALETTE) * t) / 2 + TOP * t);
  }

  // 下のボタンをならべる場所（HTML 側で使う）
  paletteRect() {
    const t = this.tile;
    return { x: this.ox, y: this.oy + (ROWS + GROUND) * t, w: COLS * t, h: PALETTE * t, t };
  }

  isSolid(x, y) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) return false;
    const b = BLOCKS[this.grid[y][x]];
    return !!(b && b.solid);
  }

  // ---------- うごき ----------
  update(dt, tilt) {
    this.time += dt;
    if (this.toast && (this.toast.life -= dt) <= 0) this.toast = null;

    const b = this.ball;
    b.vx += tilt.x * ACCEL * dt;
    b.vy += GRAVITY * dt;
    b.vx *= Math.pow(KEEP, dt);
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) {
      b.vx *= MAX_SPEED / sp;
      b.vy *= MAX_SPEED / sp;
    }
    const n = Math.max(1, Math.ceil((Math.min(sp, MAX_SPEED) * dt) / (BALL_R * 0.4)));
    for (let i = 0; i < n; i++) {
      b.x += (b.vx * dt) / n;
      b.y += (b.vy * dt) / n;
      collideCircle(b, BALL_R, (x, y) => this.isSolid(x, y), BOUNCE);
    }

    const solid = (x, y) => this.isSolid(x, y);
    for (const p of this.pets) {
      p.update(dt, solid);
      // ころんが ころがって ぶつかったら よろこぶ
      if (p.cool <= 0 && Math.abs(b.vx) > 1 && Math.hypot(b.x - p.x, b.y - p.cy) < BALL_R + 0.4) this.cheer(p);
    }
    for (const e of this.fx) {
      e.y -= 0.8 * dt;
      e.life -= dt;
    }
    this.fx = this.fx.filter((e) => e.life > 0);

    this.visitors.update(dt, this.world);
    const top = this.banners[0];
    if (top) {
      if (!top.shown) {
        top.shown = true;
        sfx.visit();
        this.toast = null;
      }
      if ((top.life -= dt) <= 0) this.banners.shift();
    }
  }

  arrive(id) {
    if (this.seen.includes(id)) return;
    this.seen.push(id);
    this.banners.push({ id, text: `${VISITORS[id].name}が あそびに きた！`, life: 3 });
    if (this.onVisitor) this.onVisitor(id);
  }

  // ぴょんと はねて、なき声と ハート
  cheer(p) {
    p.hop();
    sfx.voice(p.id);
    this.fx.push({ heart: true, x: p.x - 0.25, y: p.y - 0.9, life: 1 });
    this.fx.push({ text: FRIENDS[p.id].voice, x: p.x + 0.3, y: p.y - 1, life: 1 });
  }

  // ---------- さわる ----------
  cellAt(px, py) {
    const x = Math.floor((px - this.ox) / this.tile);
    const y = Math.floor((py - this.oy) / this.tile);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x, y };
  }

  // さいしょにさわったマスが あいていれば「おく」、ブロックがあれば「けす」で なぞっていく
  pointerDown(px, py) {
    // ともだちを タップしたときは、ブロックは おかない
    const tx = (px - this.ox) / this.tile;
    const ty = (py - this.oy) / this.tile;
    const pet = this.pets.find((p) => p.hits(tx, ty));
    if (pet) {
      this.cheer(pet);
      return;
    }
    const v = this.visitors.hit(tx, ty);
    if (v) {
      v.tap(this.world);
      if (v.id !== 'bird') sfx.twinkle();
      return;
    }
    const c = this.cellAt(px, py);
    if (!c) return;
    this.stroke = { mode: this.grid[c.y][c.x] === '.' ? 'place' : 'erase', last: null, warned: false };
    this.apply(c);
  }

  pointerMove(px, py) {
    if (!this.stroke) return;
    const c = this.cellAt(px, py);
    if (!c) return;
    const from = this.stroke.last;
    if (!from) {
      this.apply(c);
      return;
    }
    // 指が速く動いても マスをとばさないように、前のマスとのあいだを うめる
    const n = Math.max(Math.abs(c.x - from.x), Math.abs(c.y - from.y));
    for (let i = 1; i <= n; i++) {
      this.apply({
        x: Math.round(from.x + ((c.x - from.x) * i) / n),
        y: Math.round(from.y + ((c.y - from.y) * i) / n),
      });
    }
  }

  pointerUp() {
    this.stroke = null;
  }

  apply(c) {
    const s = this.stroke;
    if (s.last && s.last.x === c.x && s.last.y === c.y) return;
    s.last = c;
    const cur = this.grid[c.y][c.x];

    if (s.mode === 'erase') {
      if (cur === '.') return;
      this.grid[c.y][c.x] = '.';
      this.items[BLOCKS[cur].material]++;
      sfx.erase();
      if (this.onChange) this.onChange();
      return;
    }

    if (cur !== '.') return;
    const block = BLOCKS[this.selected];
    if (this.items[block.material] <= 0) {
      if (!s.warned) {
        s.warned = true;
        sfx.lack();
        this.toast = { text: `${ITEM_NAMES[block.material]}が たりないよ！ ステージで あつめよう`, life: 2 };
      }
      return;
    }
    // ころんが うまらないように
    if (block.solid && this.touchesBall(c.x, c.y)) return;
    this.grid[c.y][c.x] = this.selected;
    this.items[block.material]--;
    sfx.place();
    if (this.onChange) this.onChange();
  }

  touchesBall(x, y) {
    const b = this.ball;
    const dx = b.x - Math.min(Math.max(b.x, x), x + 1);
    const dy = b.y - Math.min(Math.max(b.y, y), y + 1);
    return Math.hypot(dx, dy) < BALL_R;
  }

  // ---------- えがく ----------
  render(ctx) {
    const { W, H, tile: t, ox, oy } = this;

    const sky = ctx.createLinearGradient(0, 0, 0, oy + ROWS * t);
    sky.addColorStop(0, '#79c8f2');
    sky.addColorStop(1, '#d9f2ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    this.drawClouds(ctx);

    // マス目のめやす
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x++) {
      ctx.moveTo(ox + x * t + 0.5, oy);
      ctx.lineTo(ox + x * t + 0.5, oy + ROWS * t);
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.moveTo(ox, oy + y * t + 0.5);
      ctx.lineTo(ox + COLS * t, oy + y * t + 0.5);
    }
    ctx.stroke();

    // 地面（画面のはしから はしまで）
    ctx.imageSmoothingEnabled = false;
    const gy = oy + ROWS * t;
    for (let x = Math.floor(-ox / t) - 1; x * t + ox < W; x++) {
      const v = hash(x + 50, 0) % 4;
      ctx.drawImage(tileTex.grassSide[v], ox + x * t, gy, t, t);
      for (let y = 1; gy + y * t < H; y++) ctx.drawImage(tileTex.dirt[hash(x + 50, y) % 4], ox + x * t, gy + y * t, t, t);
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const code = this.grid[y][x];
        if (code === '.') continue;
        const left = this.grid[y][x - 1] === 'y';
        const right = this.grid[y][x + 1] === 'y';
        drawBlock(ctx, code, ox + x * t, oy + y * t, t, hash(x, y) % 4, left, right);
        if (code === 'g') this.drawTwinkle(ctx, x, y);
      }
    }

    for (const p of this.pets) p.draw(ctx, ox, oy, t);

    const b = this.ball;
    drawBall(ctx, ox + b.x * t, oy + b.y * t, BALL_R * t, b, this.time);
    this.visitors.draw(ctx, ox, oy, t);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `800 ${Math.round(t * 0.4)}px ${FONT}`;
    for (const e of this.fx) {
      ctx.globalAlpha = Math.min(1, e.life * 3);
      const x = ox + e.x * t;
      const y = oy + e.y * t;
      if (e.heart) {
        drawHeart(ctx, x, y, t * 0.07);
        continue;
      }
      ctx.lineWidth = t * 0.1;
      ctx.strokeStyle = '#fff';
      ctx.strokeText(e.text, x, y);
      ctx.fillStyle = '#3b2a17';
      ctx.fillText(e.text, x, y);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(TOP * t * 0.48)}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(59,42,23,.6)';
    ctx.lineWidth = t * 0.08;
    ctx.lineJoin = 'round';
    ctx.strokeText('おうちづくり', W / 2, oy - (TOP * t) / 2);
    ctx.fillText('おうちづくり', W / 2, oy - (TOP * t) / 2);

    if (this.toast) this.drawToast(ctx);
    if (this.banners.length) this.drawBanner(ctx, this.banners[0]);
  }

  // 「〇〇が あそびに きた！」
  drawBanner(ctx, { text, id, life }) {
    const t = this.tile;
    ctx.globalAlpha = Math.min(1, life * 3);
    ctx.font = `800 ${Math.round(t * 0.5)}px ${FONT}`;
    const icon = t * 0.9;
    const w = ctx.measureText(text).width + icon + t * 0.9;
    const h = t * 1.05;
    const x = this.W / 2 - w / 2;
    const y = this.oy + t * 0.3;
    ctx.fillStyle = 'rgba(255,255,255,.93)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    drawVisitor(ctx, id, x + t * 0.35 + icon / 2, y + h / 2, icon * 1.1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e0457b';
    ctx.fillText(text, x + t * 0.5 + icon, y + h / 2);
    ctx.globalAlpha = 1;
  }

  drawClouds(ctx) {
    const t = this.tile;
    const span = this.W + t * 6;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    [
      [0.4, 0.8, 0.1],
      [3.5, 2.0, 0.06],
      [11, 1.2, 0.08],
    ].forEach(([x0, y, speed]) => {
      const x = ((x0 * t + this.time * speed * t) % span) - t * 3;
      const cy = this.oy + y * t;
      ctx.fillRect(x, cy, t * 2.2, t * 0.5);
      ctx.fillRect(x + t * 0.4, cy - t * 0.3, t * 1.2, t * 0.4);
    });
  }

  drawTwinkle(ctx, x, y) {
    const phase = (this.time + (hash(x, y) % 100) / 37) % 2.2;
    if (phase > 0.5) return;
    const t = this.tile;
    const s = Math.sin((phase / 0.5) * Math.PI) * t * 0.22;
    ctx.save();
    ctx.translate(this.ox + (x + 0.7) * t, this.oy + (y + 0.3) * t);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  drawToast(ctx) {
    const t = this.tile;
    ctx.globalAlpha = Math.min(1, this.toast.life * 3);
    ctx.font = `800 ${Math.round(t * 0.42)}px ${FONT}`;
    const w = ctx.measureText(this.toast.text).width + t * 0.8;
    const h = t * 0.85;
    const x = this.W / 2 - w / 2;
    const y = this.oy + t * 0.4;
    ctx.fillStyle = 'rgba(40,28,16,.85)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#ffe14a';
    ctx.fillText(this.toast.text, this.W / 2, y + h / 2);
    ctx.globalAlpha = 1;
  }
}
