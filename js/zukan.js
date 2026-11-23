// ずかん（ともだち・おきゃくさん を ならべて見る）

import { FRIENDS, FRIEND_ORDER, Pet, drawFriend, drawHeart, friendIconURL } from './friends.js';
import { VISITORS, VISITOR_ORDER, spawnVisitor, drawVisitor, visitorIconURL } from './visitors.js';
import { BLOCKS, drawBlock } from './house.js';
import { STAGES } from './stages.js';
import { FONT, hash } from './art.js';
import { sfx } from './sound.js';

// 大きく見せる ばめん（マス）: よこ 4マス、ゆかは y = 3 から下（キャンバスは 10:7 = 4 x 2.8マス）
const COLS = 4;
const FLOOR = 3;
const GROUND = 0.35; // ゆかの 土の あつさ
const TOP = FLOOR + GROUND - 2.8; // キャンバスに うつる いちばん上

// おきゃくさんの ページに おく ブロック（y = 0〜2）と、よぶ数。shadow: まだの子の かげの いち
const SCENES = {
  butterfly: { rows: ['....', '....', 'f..f'], count: 1, shadow: { x: 2, y: 1.5 } },
  bird: { rows: ['....', '.yy.', '.wd.'], count: 1, shadow: { x: 1.78, y: 0.98 } },
  firefly: { rows: ['....', '....', '.gg.'], count: 4, shadow: { x: 2, y: 1.5 } },
};

const TABS = {
  friend: { order: FRIEND_ORDER, data: FRIENDS },
  visitor: { order: VISITOR_ORDER, data: VISITORS },
};

const $ = (id) => document.getElementById(id);
const stageOf = (id) => STAGES.findIndex((s) => s.friend === id);
const clampX = (x) => Math.min(COLS - 0.6, Math.max(0.6, x));

export class Zukan {
  constructor() {
    this.cv = $('zukanCv');
    this.ctx = this.cv.getContext('2d');
    const icons = (order, url) => Object.fromEntries(order.map((id) => [id, { on: url(id), off: url(id, 48, true) }]));
    this.icons = { friend: icons(FRIEND_ORDER, friendIconURL), visitor: icons(VISITOR_ORDER, visitorIconURL) };
    this.tab = 'friend';
    this.known = { friend: [], visitor: [] };
    this.id = null;
    this.pet = null;
    this.guests = [];
    this.world = null;
    this.fx = [];
    this.time = 0;
    this.cv.addEventListener('pointerdown', () => this.cheer());
    for (const b of this.tabs()) {
      b.onclick = () => {
        sfx.tap();
        this.show(b.dataset.tab);
      };
    }
  }

  tabs() {
    return $('zukanTabs').children;
  }

  // friends: ともだちに なった どうぶつ、visitors: おうちに きた おきゃくさん
  open(friends, visitors) {
    this.known = { friend: friends, visitor: visitors };
    for (const b of this.tabs()) {
      const { order } = TABS[b.dataset.tab];
      const n = order.filter((id) => this.known[b.dataset.tab].includes(id)).length;
      const all = n === order.length;
      b.querySelector('b').textContent = `${all ? '★' : ''}${n}/${order.length}`;
      b.classList.toggle('done', all);
    }
    this.show(this.tab);
  }

  show(tab) {
    this.tab = tab;
    for (const b of this.tabs()) b.classList.toggle('on', b.dataset.tab === tab);
    const { order, data } = TABS[tab];
    const known = this.known[tab];
    const list = $('zukanList');
    list.innerHTML = '';
    order.forEach((id, i) => {
      const ok = known.includes(id);
      const card = document.createElement('button');
      card.className = ok ? 'card' : 'card unknown';
      card.dataset.id = id;
      card.innerHTML =
        `<span class="no">No.${i + 1}</span>` +
        `<img src="${this.icons[tab][id][ok ? 'on' : 'off']}" alt="">` +
        `<span class="name">${ok ? data[id].name : '？？？'}</span>`;
      card.onclick = () => this.select(id, true);
      list.appendChild(card);
    });
    this.select(order.find((id) => known.includes(id)) || order[0], false);
  }

  // voice: えらんだときに なくか（ひらいた ばかりの ときは なかない）
  select(id, voice) {
    this.id = id;
    for (const card of $('zukanList').children) card.classList.toggle('on', card.dataset.id === id);
    const { order, data } = TABS[this.tab];
    const known = this.known[this.tab].includes(id);
    $('zukanName').textContent = `No.${order.indexOf(id) + 1} ${known ? data[id].name : '？？？'}`;
    this.fx = [];
    this.pet = null;
    this.guests = [];
    this.world = null;

    if (this.tab === 'friend') {
      const si = stageOf(id);
      $('zukanNote').textContent = known ? data[id].note : si >= 0 ? `ステージ${si + 1}の しげみに かくれているよ` : '';
      $('zukanWhere').textContent = known ? (si >= 0 ? `ステージ${si + 1}で 見つけたよ` : '') : 'まだ 見つけて いないよ';
      if (known) this.pet = new Pet(id, COLS / 2, FLOOR);
    } else {
      const v = data[id];
      $('zukanNote').textContent = known ? v.note : `おうちに ${v.blockName}を おくと くるかも`;
      $('zukanWhere').textContent = known ? `${v.blockName}を おいたら きたよ` : 'まだ きて いないよ';
      this.world = this.makeWorld(SCENES[id].rows);
      if (known) {
        for (let i = 0; i < SCENES[id].count; i++) {
          const g = spawnVisitor(id, this.world, this.guests, true);
          if (g) this.guests.push(g);
        }
      }
    }
    if (!voice) return;
    if (known) this.cheer();
    else sfx.tap();
  }

  // おきゃくさんの ページの 小さな おうち
  makeWorld(rows) {
    const code = (x, y) => (rows[y] && rows[y][x]) || '.';
    return {
      cols: COLS,
      rows: FLOOR,
      minY: TOP + 0.35,
      code,
      isSolid: (x, y) => y >= FLOOR || x < 0 || x >= COLS || !!(BLOCKS[code(x, y)] && BLOCKS[code(x, y)].solid),
      ball: null,
      say: (text, x, y) => this.fx.push({ text, x, y, life: 1 }),
    };
  }

  // さわると はねて なく（おきゃくさんは とんだり ちらばったり）
  cheer() {
    const p = this.pet;
    if (p) {
      if (p.cool > 0) return;
      p.hop();
      sfx.voice(p.id);
      // ジャンプしても かさならないように、どうぶつに ついていく（rel）
      this.fx.push({ heart: true, rel: true, x: -0.35, y: -1.2, life: 1 });
      this.fx.push({ text: FRIENDS[p.id].voice, rel: true, x: 0.45, y: -1.4, life: 1 });
      return;
    }
    if (!this.guests.length) return;
    for (const g of this.guests) g.tap(this.world);
    if (this.id !== 'bird') sfx.twinkle();
  }

  update(dt) {
    this.time += dt;
    if (this.pet) this.pet.update(dt, (x, y) => y >= FLOOR || x < 0 || x >= COLS);
    for (const g of this.guests) g.update(dt, this.world);
    for (const e of this.fx) {
      e.y -= 0.6 * dt;
      e.life -= dt;
    }
    this.fx = this.fx.filter((e) => e.life > 0);
  }

  render() {
    const cv = this.cv;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(cv.clientWidth * dpr);
    const H = Math.round(cv.clientHeight * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const ctx = this.ctx;
    const t = W / COLS;
    const oy = H - (FLOOR + GROUND) * t; // y = 0 の いち（上は すこし きれる）
    const fy = oy + FLOOR * t; // ゆかの いち

    const sky = ctx.createLinearGradient(0, 0, 0, fy);
    sky.addColorStop(0, '#79c8f2');
    sky.addColorStop(1, '#d9f2ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, fy, W, H - fy);
    ctx.fillStyle = '#6fb35c';
    ctx.fillRect(0, fy, W, t * 0.12);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const question = (x, y) => {
      ctx.font = `800 ${Math.round(t * 0.7)}px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText('？', x + Math.sin(this.time * 3) * t * 0.05, y);
    };

    if (this.tab === 'friend') {
      if (this.pet) this.pet.draw(ctx, 0, oy, t);
      else if (this.id) {
        drawFriend(ctx, this.id, W / 2, fy, t * 1.25 * FRIENDS[this.id].size, { shadow: true });
        question(W / 2, fy - t * 1.6);
      }
    } else if (this.world) {
      SCENES[this.id].rows.forEach((row, y) =>
        [...row].forEach((code, x) => {
          if (code === '.') return;
          drawBlock(ctx, code, x * t, oy + y * t, t, hash(x, y) % 4, row[x - 1] === 'y', row[x + 1] === 'y');
        }),
      );
      if (this.guests.length) for (const g of this.guests) g.draw(ctx, 0, oy, t);
      else {
        const s = SCENES[this.id].shadow;
        drawVisitor(ctx, this.id, s.x * t, oy + s.y * t, t * 1.4, true);
        question((s.x + 0.75) * t, oy + (s.y - 0.45) * t);
      }
    }

    ctx.lineJoin = 'round';
    ctx.font = `800 ${Math.round(t * 0.32)}px ${FONT}`;
    for (const e of this.fx) {
      ctx.globalAlpha = Math.min(1, e.life * 3);
      const x = clampX((e.rel ? this.pet.x : 0) + e.x) * t;
      const y = oy + Math.max(TOP + 0.3, (e.rel ? this.pet.y : 0) + e.y) * t; // 上で きれないように
      if (e.heart) {
        drawHeart(ctx, x, y, t * 0.06);
        continue;
      }
      ctx.lineWidth = t * 0.08;
      ctx.strokeStyle = '#fff';
      ctx.strokeText(e.text, x, y);
      ctx.fillStyle = '#3b2a17';
      ctx.fillText(e.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
