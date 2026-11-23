// ともだち ずかん（見つけた どうぶつを ならべて見る）

import { FRIENDS, FRIEND_ORDER, Pet, drawFriend, drawHeart, friendIconURL } from './friends.js';
import { STAGES } from './stages.js';
import { FONT } from './art.js';
import { sfx } from './sound.js';

// 大きく見せる ばめん（マス）: よこ 4マス、ゆかは y = 3 から下（キャンバスは 10:7 = 4 x 2.8マス）
const COLS = 4;
const FLOOR = 3;
const GROUND = 0.35; // ゆかの 土の あつさ
const isSolid = (x, y) => y >= FLOOR || x < 0 || x >= COLS;

const $ = (id) => document.getElementById(id);
const stageOf = (id) => STAGES.findIndex((s) => s.friend === id);

export class Zukan {
  constructor() {
    this.cv = $('zukanCv');
    this.ctx = this.cv.getContext('2d');
    this.icons = Object.fromEntries(
      FRIEND_ORDER.map((id) => [id, { on: friendIconURL(id), off: friendIconURL(id, 48, true) }]),
    );
    this.found = [];
    this.id = null;
    this.pet = null;
    this.fx = [];
    this.time = 0;
    this.cv.addEventListener('pointerdown', () => this.tap());
  }

  // found: ともだちに なった どうぶつ
  open(found) {
    this.found = found;
    const n = FRIEND_ORDER.filter((id) => found.includes(id)).length;
    $('zukanCount').textContent =
      n === FRIEND_ORDER.length ? 'ぜんぶ 見つけた！ すごい！' : `見つけた ${n} / ${FRIEND_ORDER.length}`;

    const list = $('zukanList');
    list.innerHTML = '';
    FRIEND_ORDER.forEach((id, i) => {
      const known = found.includes(id);
      const card = document.createElement('button');
      card.className = known ? 'card' : 'card unknown';
      card.dataset.id = id;
      card.innerHTML =
        `<span class="no">No.${i + 1}</span>` +
        `<img src="${this.icons[id][known ? 'on' : 'off']}" alt="">` +
        `<span class="name">${known ? FRIENDS[id].name : '？？？'}</span>`;
      card.onclick = () => this.select(id, true);
      list.appendChild(card);
    });
    this.select(FRIEND_ORDER.find((id) => found.includes(id)) || FRIEND_ORDER[0], false);
  }

  // voice: えらんだときに なくか（ひらいた ばかりの ときは なかない）
  select(id, voice) {
    this.id = id;
    for (const card of $('zukanList').children) card.classList.toggle('on', card.dataset.id === id);
    const known = this.found.includes(id);
    const f = FRIENDS[id];
    const no = FRIEND_ORDER.indexOf(id) + 1;
    const si = stageOf(id);
    $('zukanName').textContent = `No.${no} ${known ? f.name : '？？？'}`;
    $('zukanNote').textContent = known ? f.note : si >= 0 ? `ステージ${si + 1}の しげみに かくれているよ` : '';
    $('zukanWhere').textContent = known ? (si >= 0 ? `ステージ${si + 1}で 見つけたよ` : '') : 'まだ 見つけて いないよ';
    this.fx = [];
    this.pet = known ? new Pet(id, COLS / 2, FLOOR) : null;
    if (!voice) return;
    if (known) this.cheer();
    else sfx.tap();
  }

  // ぴょんと はねて、なき声と ハート
  cheer() {
    const p = this.pet;
    if (!p || p.cool > 0) return;
    p.hop();
    sfx.voice(p.id);
    // ジャンプしても かさならないように、どうぶつに ついていく（dx, dy は どうぶつから の ずれ）
    this.fx.push({ heart: true, dx: -0.35, dy: -1.2, life: 1 });
    this.fx.push({ text: FRIENDS[p.id].voice, dx: 0.45, dy: -1.4, life: 1 });
  }

  tap() {
    if (this.pet) this.cheer();
  }

  update(dt) {
    this.time += dt;
    if (this.pet) this.pet.update(dt, isSolid);
    for (const e of this.fx) {
      e.dy -= 0.6 * dt;
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

    const known = this.found.includes(this.id);
    if (this.pet) {
      this.pet.draw(ctx, 0, oy, t);
    } else if (this.id) {
      drawFriend(ctx, this.id, W / 2, fy, t * 1.25 * FRIENDS[this.id].size, { shadow: true });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(t * 0.7)}px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText('？', W / 2 + Math.sin(this.time * 3) * t * 0.05, fy - t * 1.6);
    }
    if (!known) return;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `800 ${Math.round(t * 0.32)}px ${FONT}`;
    const p = this.pet;
    for (const e of this.fx) {
      ctx.globalAlpha = Math.min(1, e.life * 3);
      const x = Math.min(COLS - 0.6, Math.max(0.6, p.x + e.dx)) * t;
      const y = oy + (p.y + e.dy) * t;
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
