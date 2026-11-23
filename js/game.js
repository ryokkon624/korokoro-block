// ゲーム本体（うごき と えがく）
// 位置や速さは「マス」単位で計算し、えがくときにピクセルへ直す

import { STAGES } from './stages.js';
import { tileTex, itemSprites, ITEM_NAMES, ITEM_COLORS, ITEM_AMOUNT, FONT, hash, drawBall } from './art.js';
import { collideCircle } from './physics.js';
import { FRIENDS, POSE, drawFriend, drawFriendHead, drawBush, drawHeart } from './friends.js';
import { sfx, buzz } from './sound.js';

const BALL_R = 0.36;
const ACCEL = 40; // いっぱいに傾けたときの加速（マス/秒²）。テストページで「ちょうどいい」だった感度
const KEEP = { grass: 0.5, ice: 0.85 }; // 1秒あたりに残る速さ（こおりは すべる）
const MAX_SPEED = 14;
const BOUNCE = 0.4;
const HUD = 0.9; // 上の表示のたかさ（マス）
const FOLLOW_GAP = 0.85; // ともだちが ころんの どれだけ後ろを ついてくるか（マス）

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
    this.onFriend = null; // ともだちを見つけたときに呼ぶ（すぐセーブするため）
    this.load(0);
  }

  // ---------- ステージ ----------
  // found: もう ともだちに なっている どうぶつ（その子は もう かくれていない）
  load(index, found = []) {
    const stage = STAGES[index];
    this.index = index;
    this.name = stage.name;
    this.rows = stage.map.length;
    this.cols = stage.map[0].length;
    this.cells = [];
    this.items = [];
    this.bush = null;
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        const ch = stage.map[y][x];
        row.push({ wall: WALLS[ch] || null, floor: FLOORS[ch] || null, hole: ch === 'o', goal: ch === 'G' });
        if (ITEMS[ch]) this.items.push({ type: ITEMS[ch], x: x + 0.5, y: y + 0.5, taken: false });
        if (ch === 'S') this.start = { x: x + 0.5, y: y + 0.5 };
        if (ch === 'G') this.goal = { x: x + 0.5, y: y + 0.5 };
        if (ch === 'a') this.bush = { x: x + 0.5, y: y + 0.5 };
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
    this.friendId = stage.friend || null;
    this.friendKnown = !!this.friendId && found.includes(this.friendId);
    this.friend =
      this.bush && this.friendId && !this.friendKnown
        ? { id: this.friendId, x: this.bush.x, y: this.bush.y, z: 0, state: 'hide', t: 0, dir: 1, peek: 0, walking: false }
        : null;
    this.trail = [];
    this.banner = null;
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
    this.updateFriend(dt);
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

    const f = this.friend;
    if (f && f.state === 'hide' && Math.hypot(f.x - b.x, f.y - b.y) < BALL_R + 0.45) this.meetFriend();

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
    // ともだちも いっしょに スタートへ
    const f = this.friend;
    if (f && f.state !== 'hide') {
      Object.assign(f, { x: b.x, y: b.y, z: 0, state: 'follow' });
      this.trail = [{ x: b.x, y: b.y }];
    }
  }

  // ---------- ともだち ----------
  meetFriend() {
    const f = this.friend;
    f.state = 'jump';
    f.t = 0;
    sfx.friend(f.id);
    buzz(80);
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        heart: true,
        x: f.x + (Math.random() - 0.5) * 0.6,
        y: f.y - 0.2,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.2 - Math.random() * 1.2,
        g: 0,
        life: 1.2,
        max: 1.2,
        size: 0.05,
      });
    }
    this.banner = { id: f.id, text: `${FRIENDS[f.id].name}が ともだちに なった！`, life: 3 };
    this.trail = [{ x: f.x, y: f.y }];
    if (this.onFriend) this.onFriend(f.id);
  }

  updateFriend(dt) {
    if (this.banner && (this.banner.life -= dt) <= 0) this.banner = null;
    const f = this.friend;
    if (!f) return;
    const b = this.ball;
    f.t += dt;

    if (f.state === 'hide') {
      // ときどき しげみから 顔を出す。ころんが近くに来たら ずっと見ている
      f.dir = b.x < f.x ? -1 : 1;
      const near = Math.hypot(b.x - f.x, b.y - f.y) < 3;
      const want = near || (this.time + 0.7) % 3.4 < 2 ? 1 : 0;
      f.peek += (want - f.peek) * Math.min(1, dt * 8);
      return;
    }

    // ころんの 通ったあとを おぼえて、そのあとを ついていく
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(b.x - last.x, b.y - last.y) > 0.08) {
      this.trail.push({ x: b.x, y: b.y });
      if (this.trail.length > 80) this.trail.shift();
    }

    if (f.state === 'jump') {
      const k = Math.min(1, f.t / 0.55);
      f.z = Math.sin(Math.PI * k) * 0.9;
      if (k >= 1) f.state = 'follow';
      return;
    }

    const to = this.followPoint();
    const dx = to.x - f.x;
    const dy = to.y - f.y;
    const k = Math.min(1, dt * 8);
    f.x += dx * k;
    f.y += dy * k;
    f.walking = (Math.hypot(dx, dy) * k) / dt > 0.6;
    if (Math.abs(dx) > 0.02) f.dir = Math.sign(dx);
    f.z = this.phase === 'cleared' ? Math.abs(Math.sin(this.time * 7)) * 0.3 : 0;
  }

  // ころんから 通ったあとを FOLLOW_GAP だけ さかのぼった点
  followPoint() {
    let need = FOLLOW_GAP;
    let px = this.ball.x;
    let py = this.ball.y;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      const d = Math.hypot(px - p.x, py - p.y);
      if (d >= need) return { x: px + ((p.x - px) * need) / d, y: py + ((p.y - py) * need) / d };
      need -= d;
      px = p.x;
      py = p.y;
    }
    return { x: px, y: py };
  }

  result() {
    const got = {};
    const total = {};
    for (const it of this.items) {
      total[it.type] = (total[it.type] || 0) + ITEM_AMOUNT[it.type];
      if (it.taken) got[it.type] = (got[it.type] || 0) + ITEM_AMOUNT[it.type];
    }
    const friend = this.friend && this.friend.state !== 'hide' ? this.friend.id : null;
    return { index: this.index, got, total, all: this.items.every((it) => it.taken), friend };
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

    this.drawFriendArea(ctx, X, Y, t);
    drawBall(ctx, X(this.ball.x), Y(this.ball.y), BALL_R * t * this.ball.scale, this.ball, this.time);

    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      const s = p.size * t;
      if (p.heart) {
        drawHeart(ctx, X(p.x), Y(p.y), s);
        continue;
      }
      ctx.fillStyle = p.color;
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
    if (this.banner) this.drawBanner(ctx);
  }

  drawFriendArea(ctx, X, Y, t) {
    const f = this.friend;
    const blink = this.time % 3.1 < 0.12;
    if (this.bush) {
      const bx = X(this.bush.x);
      const bottom = Y(this.bush.y) + t * 0.42;
      const size = t * 0.92;
      let tilt = 0;
      if (f && f.state === 'hide') {
        // 顔は しげみの うしろから 出たり入ったりする（大きさは 歩いているときと同じ）
        const px = (t * 0.85 * FRIENDS[f.id].size) / 16;
        drawFriendHead(ctx, f.id, bx, bottom - size + t * (0.34 - 0.32 * f.peek), px, f.dir < 0, blink);
        tilt = f.peek > 0.05 && f.peek < 0.95 ? Math.sin(this.time * 40) * 0.06 : 0;
      }
      drawBush(ctx, bx, bottom, size, tilt);
    }
    if (!f || f.state === 'hide') return;
    const x = X(f.x);
    const y = Y(f.y) + t * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.ellipse(x, y, t * 0.3, t * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    const hopping = f.state === 'jump' || f.z > 0.05;
    const pose = hopping || (f.walking && Math.floor(this.time / 0.14) % 2) ? POSE.walk : POSE.stand;
    drawFriend(ctx, f.id, x, y - f.z * t, t * 0.85 * FRIENDS[f.id].size, { flip: f.dir < 0, pose, blink });
  }

  drawBanner(ctx) {
    const t = this.tile;
    const { text, id, life } = this.banner;
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
    drawFriend(ctx, id, x + t * 0.35 + icon / 2, y + h / 2 + icon * 0.36, icon);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e0457b';
    ctx.fillText(text, x + t * 0.5 + icon, y + h / 2);
    ctx.globalAlpha = 1;
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

    // ともだちが かくれているステージは、見つけるまで かげだけ
    if (this.friendId) {
      const met = this.friendKnown || (this.friend && this.friend.state !== 'hide');
      const w = s * 1.3;
      drawFriend(ctx, this.friendId, x + s * 0.35, cy + w * 0.36, w, { shadow: !met });
    }
  }
}
