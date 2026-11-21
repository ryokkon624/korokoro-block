// ゲーム本体（うごき と えがく）
// 位置や速さは「マス」単位で計算し、えがくときにピクセルへ直す

import { STAGES } from './stages.js';
import { tileTex, itemSprites, ITEM_NAMES, ITEM_COLORS, ITEM_AMOUNT, FONT, hash, drawBall } from './art.js';
import { collideCircle } from './physics.js';
import { sfx, buzz } from './sound.js';

const BALL_R = 0.36;
const ACCEL = 40; // いっぱいに傾けたときの加速（マス/秒²）。テストページで「ちょうどいい」だった感度
const KEEP = { grass: 0.5, ice: 0.85 }; // 1秒あたりに残る速さ（こおりは すべる）
const MAX_SPEED = 14;
const BOUNCE = 0.4;
const HUD = 0.9; // 上の表示のたかさ（マス）

const WALLS = { '#': 'stone', '=': 'plank', T: 'leaves' };
const FLOORS = { '.': 'grass', '~': 'ice' };
const ITEMS = { w: 'wood', r: 'stone', f: 'flower', d: 'gem' };

export class Game {
  constructor() {
    this.W = 0;
    this.H = 0;
    this.dpr = 1;
    this.time = 0;
    this.onClear = null;
    this.load(0);
  }

  // ---------- ステージ ----------
  load(index) {
    const stage = STAGES[index];
    this.index = index;
    this.name = stage.name;
    this.rows = stage.map.length;
    this.cols = stage.map[0].length;
    this.cells = [];
    this.items = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        const ch = stage.map[y][x];
        row.push({ wall: WALLS[ch] || null, floor: FLOORS[ch] || null, hole: ch === 'o', goal: ch === 'G' });
        if (ITEMS[ch]) this.items.push({ type: ITEMS[ch], x: x + 0.5, y: y + 0.5, taken: false });
        if (ch === 'S') this.start = { x: x + 0.5, y: y + 0.5 };
        if (ch === 'G') this.goal = { x: x + 0.5, y: y + 0.5 };
      }
      this.cells.push(row);
    }
    // スタートやアイテムのマスの床は、まわりの床にあわせる
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y][x];
        if (cell.wall || cell.floor) continue;
        let ice = 0;
        let grass = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const f = this.cells[y + dy] && this.cells[y + dy][x + dx] && FLOORS[stage.map[y + dy][x + dx]];
          if (f === 'ice') ice++;
          if (f === 'grass') grass++;
        }
        cell.floor = ice > grass ? 'ice' : 'grass';
      }
    }
    this.ball = { x: this.start.x, y: this.start.y, vx: 0, vy: 0, scale: 1, blink: 0 };
    this.phase = 'play';
    this.timer = 0;
    this.reported = false;
    this.particles = [];
    this.texts = [];
    this.lastBump = 0;
    if (this.W) this.layout();
  }

  resize(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.layout();
  }

  layout() {
    this.tile = Math.floor(Math.min(this.W / this.cols, this.H / (this.rows + HUD)));
    this.ox = Math.floor((this.W - this.cols * this.tile) / 2);
    this.oy = Math.floor((this.H - (this.rows + HUD) * this.tile) / 2 + HUD * this.tile);
    this.bg = this.renderMap();
  }

  isWall(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return true;
    return !!this.cells[y][x].wall;
  }

  cellAt(x, y) {
    const row = this.cells[Math.floor(y)];
    return row && row[Math.floor(x)];
  }

  // ---------- うごき ----------
  update(dt, tilt) {
    this.time += dt;
    this.updateEffects(dt);
    const b = this.ball;
    if (b.blink > 0) b.blink -= dt;

    if (this.phase === 'play') {
      this.step(dt, tilt);
    } else if (this.phase === 'falling') {
      this.timer -= dt;
      b.x += (this.fallAt.x - b.x) * Math.min(1, dt * 14);
      b.y += (this.fallAt.y - b.y) * Math.min(1, dt * 14);
      b.scale = Math.max(0, this.timer / 0.5);
      if (this.timer <= 0) this.respawn();
    } else if (this.phase === 'sinking') {
      this.timer -= dt;
      b.x += (this.goal.x - b.x) * Math.min(1, dt * 14);
      b.y += (this.goal.y - b.y) * Math.min(1, dt * 14);
      b.scale = Math.max(0, this.timer / 0.45);
      if (this.timer <= 0) {
        this.phase = 'cleared';
        this.timer = 1.0;
        sfx.goal();
        buzz(150);
        this.confetti();
      }
    } else if (this.phase === 'cleared') {
      this.timer -= dt;
      if (this.timer <= 0 && !this.reported) {
        this.reported = true;
        if (this.onClear) this.onClear(this.result());
      }
    }
  }

  step(dt, tilt) {
    const b = this.ball;
    b.vx += tilt.x * ACCEL * dt;
    b.vy += tilt.y * ACCEL * dt;

    // ゴールの近くでは すいこまれる
    let gx = this.goal.x - b.x;
    let gy = this.goal.y - b.y;
    if (Math.hypot(gx, gy) < 0.75) {
      b.vx += gx * 30 * dt;
      b.vy += gy * 30 * dt;
    }

    const keep = Math.pow(KEEP[this.cellAt(b.x, b.y).floor] || KEEP.grass, dt);
    b.vx *= keep;
    b.vy *= keep;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) {
      b.vx *= MAX_SPEED / sp;
      b.vy *= MAX_SPEED / sp;
    }

    // 速いときは こまかく分けて動かし、かべをすりぬけないようにする
    const n = Math.max(1, Math.ceil((Math.min(sp, MAX_SPEED) * dt) / (BALL_R * 0.4)));
    let hit = 0;
    for (let i = 0; i < n; i++) {
      b.x += (b.vx * dt) / n;
      b.y += (b.vy * dt) / n;
      hit = Math.max(hit, collideCircle(b, BALL_R, (x, y) => this.isWall(x, y), BOUNCE));
    }
    if (hit > 2.5 && this.time - this.lastBump > 0.08) {
      this.lastBump = this.time;
      sfx.bump(hit / MAX_SPEED);
    }

    for (const it of this.items) {
      if (it.taken || Math.hypot(it.x - b.x, it.y - b.y) > BALL_R + 0.28) continue;
      it.taken = true;
      sfx.pickup();
      this.sparkle(it.x, it.y, ITEM_COLORS[it.type]);
      this.texts.push({ text: `${ITEM_NAMES[it.type]} ×${ITEM_AMOUNT[it.type]} ゲット！`, x: it.x, y: it.y - 0.4, life: 1.2 });
    }

    const cell = this.cellAt(b.x, b.y);
    const cx = Math.floor(b.x) + 0.5;
    const cy = Math.floor(b.y) + 0.5;
    if (cell && cell.hole && b.blink <= 0 && Math.hypot(cx - b.x, cy - b.y) < 0.36) {
      this.phase = 'falling';
      this.timer = 0.5;
      this.fallAt = { x: cx, y: cy };
      sfx.fall();
      buzz(60);
      this.texts.push({ text: 'おっと！', x: cx, y: cy - 0.6, life: 1.0 });
      return;
    }

    gx = this.goal.x - b.x;
    gy = this.goal.y - b.y;
    if (Math.hypot(gx, gy) < 0.3) {
      this.phase = 'sinking';
      this.timer = 0.45;
    }
  }

  respawn() {
    const b = this.ball;
    b.x = this.start.x;
    b.y = this.start.y;
    b.vx = 0;
    b.vy = 0;
    b.scale = 1;
    b.blink = 0.8;
    this.phase = 'play';
    sfx.respawn();
  }

  result() {
    const got = {};
    const total = {};
    for (const it of this.items) {
      total[it.type] = (total[it.type] || 0) + ITEM_AMOUNT[it.type];
      if (it.taken) got[it.type] = (got[it.type] || 0) + ITEM_AMOUNT[it.type];
    }
    return { index: this.index, got, total, all: this.items.every((it) => it.taken) };
  }

  // ---------- こうか ----------
  sparkle(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = 1.5 + Math.random() * 1.5;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0, life: 0.6, max: 0.6, color, size: 0.09 });
    }
  }

  confetti() {
    const colors = ['#ff5a5a', '#ffd23f', '#7ed957', '#4fc3f7', '#ff8fd0', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      this.particles.push({
        x: this.goal.x,
        y: this.goal.y,
        vx: (Math.random() - 0.5) * 9,
        vy: -3 - Math.random() * 6,
        g: 9,
        life: 1.8,
        max: 1.8,
        color: colors[i % colors.length],
        size: 0.1 + Math.random() * 0.06,
      });
    }
  }

  updateEffects(dt) {
    for (const p of this.particles) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.y -= 0.6 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  // ---------- えがく ----------
  // うごかないもの（床・かべ・あな）は先に1枚の絵にしておく
  renderMap() {
    const t = this.tile;
    const c = document.createElement('canvas');
    c.width = Math.round(this.cols * t * this.dpr);
    c.height = Math.round(this.rows * t * this.dpr);
    const g = c.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y][x];
        const px = x * t;
        const py = y * t;
        const v = hash(x, y) % 4;
        if (cell.wall) {
          g.drawImage(tileTex[cell.wall][v], px, py, t, t);
          if (!this.isWall(x, y - 1)) {
            g.fillStyle = 'rgba(255,255,255,.2)';
            g.fillRect(px, py, t, t * 0.08);
          }
          if (!this.isWall(x, y + 1)) {
            g.fillStyle = 'rgba(0,0,0,.3)';
            g.fillRect(px, py + t * 0.78, t, t * 0.22);
          }
        } else {
          g.drawImage(tileTex[cell.floor][v], px, py, t, t);
          g.fillStyle = 'rgba(0,0,0,.14)';
          if (this.isWall(x, y - 1)) g.fillRect(px, py, t, t * 0.18);
          if (this.isWall(x - 1, y)) g.fillRect(px, py, t * 0.14, t);
          if (cell.hole || cell.goal) this.drawHole(g, px + t / 2, py + t / 2, t * 0.42, cell.goal);
        }
      }
    }
    return c;
  }

  drawHole(g, cx, cy, r, isGoal) {
    const grd = g.createRadialGradient(cx, cy - r * 0.25, r * 0.1, cx, cy, r);
    grd.addColorStop(0, '#000');
    grd.addColorStop(0.7, '#140d07');
    grd.addColorStop(1, '#3d2a17');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = r * 0.16;
    g.strokeStyle = isGoal ? '#f2c230' : '#6e5133';
    g.stroke();
  }

  render(ctx) {
    const { W, H, tile: t, ox, oy } = this;
    const X = (x) => ox + x * t;
    const Y = (y) => oy + y * t;

    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.bg, ox, oy, this.cols * t, this.rows * t);

    this.drawFlag(ctx, X(this.goal.x), Y(this.goal.y), t);

    ctx.imageSmoothingEnabled = false;
    for (const it of this.items) {
      if (it.taken) continue;
      const bob = Math.sin(this.time * 3 + it.x * 1.7) * 0.06;
      const s = 0.62 * t;
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath();
      ctx.ellipse(X(it.x), Y(it.y) + 0.26 * t, 0.22 * t, 0.07 * t, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(itemSprites[it.type], X(it.x) - s / 2, Y(it.y + bob - 0.06) - s / 2, s, s);
    }

    drawBall(ctx, X(this.ball.x), Y(this.ball.y), BALL_R * t * this.ball.scale, this.ball, this.time);

    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      ctx.fillStyle = p.color;
      const s = p.size * t;
      ctx.fillRect(X(p.x) - s / 2, Y(p.y) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `800 ${Math.round(t * 0.45)}px ${FONT}`;
    for (const tx of this.texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      ctx.lineWidth = t * 0.1;
      ctx.strokeStyle = '#3b2a17';
      ctx.strokeText(tx.text, X(tx.x), Y(tx.y));
      ctx.fillStyle = '#fff';
      ctx.fillText(tx.text, X(tx.x), Y(tx.y));
    }
    ctx.globalAlpha = 1;

    this.drawHud(ctx);
  }

  drawFlag(ctx, x, y, t) {
    const px = x + t * 0.2;
    const top = y - t * 0.95;
    ctx.strokeStyle = '#3b2a17';
    ctx.lineWidth = t * 0.09;
    ctx.beginPath();
    ctx.moveTo(px, y - t * 0.1);
    ctx.lineTo(px, top);
    ctx.stroke();
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = t * 0.05;
    ctx.stroke();
    const wave = Math.sin(this.time * 5) * t * 0.05;
    ctx.fillStyle = '#e8413c';
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px + t * 0.5, top + t * 0.14 + wave);
    ctx.lineTo(px, top + t * 0.3);
    ctx.closePath();
    ctx.fill();
    // きらきら
    for (let i = 0; i < 2; i++) {
      const a = this.time * 2 + i * Math.PI;
      const s = (0.5 + 0.5 * Math.sin(this.time * 4 + i * 2)) * t * 0.12;
      ctx.fillStyle = '#fff6b0';
      ctx.save();
      ctx.translate(x + Math.cos(a) * t * 0.5, y + Math.sin(a) * t * 0.3);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  drawHud(ctx) {
    const t = this.tile;
    const hh = HUD * t;
    const cy = this.oy - hh / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(hh * 0.48)}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${this.index + 1}. ${this.name}`, this.W / 2, cy);

    // ひろったアイテムは明るく、まだのものはうすく
    const s = hh * 0.62;
    let x = this.ox + this.cols * t - s;
    ctx.imageSmoothingEnabled = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      ctx.globalAlpha = it.taken ? 1 : 0.28;
      ctx.drawImage(itemSprites[it.type], x, cy - s / 2, s, s);
      x -= s * 1.15;
    }
    ctx.globalAlpha = 1;
  }
}
