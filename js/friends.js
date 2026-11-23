// ともだち（どうぶつ）: ステージで見つけると、おうちに すんでくれる
// ドット絵は 16x12 で、右むき。いちばん下の行が 足もと

const SW = 16;
const SH = 12;

// climb: のぼれる かべの高さ（マス）、hop: あるきながら はねる強さ、pounce: ときどき 大ジャンプ
// note: ずかんの せつめい（小1の漢字だけ）
export const FRIENDS = {
  dog: {
    name: '犬',
    voice: 'わん！',
    speed: 1.8,
    climb: 1,
    size: 1.05,
    note: 'はしるのが 大すき。1マスの かべなら ジャンプで のぼれるよ。',
  },
  cat: {
    name: 'ねこ',
    voice: 'にゃー',
    speed: 1.3,
    climb: 2,
    size: 1,
    note: '2マスの かべも ひょいっと のぼるよ。つかれたら すわって ひと休み。',
  },
  rabbit: {
    name: 'うさぎ',
    voice: 'ぷう',
    speed: 1.5,
    climb: 3,
    size: 1,
    hop: 6,
    note: 'ながい 耳が じまん。3マスの かべも ぴょんと のぼれるよ。',
  },
  fox: {
    name: 'きつね',
    voice: 'こんこん',
    speed: 2,
    climb: 2,
    size: 1.05,
    pounce: true,
    note: 'ふさふさの しっぽ。ときどき 上に 大ジャンプ！',
  },
  squirrel: {
    name: 'りす',
    voice: 'きゅっ',
    speed: 2,
    climb: 2,
    size: 0.9,
    hop: 4.5,
    note: '大きな しっぽで いつも ぴょこぴょこ はねているよ。',
  },
};
// ずかんの じゅん（ステージの じゅん）
export const FRIEND_ORDER = ['dog', 'cat', 'rabbit', 'fox', 'squirrel'];

// rows: 頭とからだ（10行）、legs: 足（2行）の たち・あるき、sit: すわったときの足（1行）
// fur: まばたきで目をうめる色、eyes: 目の場所、head: しげみから のぞくときに見せる はんい [x, y, w, h]
const ART = {
  dog: {
    rows: [
      '................',
      '........bbbbbbb.',
      '.b.....BbbbbbbbB',
      '.b.....BbkbbbkbB',
      '..b....BbbckcbbB',
      '..b....B.bcpcb.B',
      '...bbbbbbbcccb..',
      '..bbbbbbbbbccb..',
      '..bbbbbbbbbbbb..',
      '..bcccccccccbb..',
    ],
    legs: [
      ['...bb.....bb....', '...cc.....cc....'],
      ['..bb.bb..bb.bb..', '..cc.cc..cc.cc..'],
    ],
    sit: '..cccc....cccc..',
    palette: { b: '#e6c08e', B: '#8f5a2e', c: '#fff6e6', k: '#3b2a17', p: '#ff7f96' },
    fur: 'b',
    eyes: [[9, 3], [13, 3]],
    head: [7, 1, 9, 5],
  },
  cat: {
    rows: [
      '........o.....o.',
      'O.......oo...oo.',
      'o.......ooOoOoo.',
      'o.......okoookoo',
      '.o......owwpwwo.',
      '..o......owwwo..',
      '...ooOooOoooww..',
      '..oooOooOoooww..',
      '..ooooooooooo...',
      '..owwwwwwwwwo...',
    ],
    legs: [
      ['...oo.....oo....', '...ww.....ww....'],
      ['..oo.oo.oo.oo...', '..ww.ww.ww.ww...'],
    ],
    sit: '..wwww...wwww...',
    palette: { o: '#f2a541', O: '#c9772a', w: '#fff4e2', k: '#3b2a17', p: '#ff8fa0' },
    fur: 'o',
    eyes: [[9, 3], [13, 3]],
    head: [8, 0, 8, 6],
  },
  squirrel: {
    rows: [
      '.rrr............',
      'rrrrr.....r...r.',
      'rrRrrr...rrrrrrr',
      'rrRRrr...rkrrrkr',
      '.rrRrr...rcckccr',
      '..rrrr....ccccc.',
      '...rrr.rrrrcccr.',
      '....rrrrrrrcccr.',
      '.....rrrrrrccrr.',
      '......rrrrrrrr..',
    ],
    legs: [
      ['.......rr...rr..', '.......RR...RR..'],
      ['......rr.rr..rr.', '......RR.RR..RR.'],
    ],
    sit: '......RRRR..RRR.',
    palette: { r: '#c0642c', R: '#7a3a15', c: '#ffe9c7', k: '#3b2a17' },
    fur: 'r',
    eyes: [[10, 3], [14, 3]],
    head: [9, 1, 7, 5],
  },
  rabbit: {
    rows: [
      '.........uu.uu..',
      '.........up.pu..',
      '.........up.pu..',
      '.........up.pu..',
      '........uuuuuuu.',
      '........ukuuuku.',
      '...uuuu.uuupuuu.',
      '.uuuuuuuuuuuuu..',
      'wwuuuuuuuuuuu...',
      'ww.uuuuuuuuuu...',
    ],
    legs: [
      ['...uuu....uu....', '..uuuu....uu....'],
      ['.uuu.......uu...', 'uuu.........uu..'],
    ],
    sit: '..uuuuu..uuu....',
    palette: { u: '#f6f3ee', U: '#b8afa6', w: '#ffffff', p: '#ff9fb2', k: '#3b2a17' },
    edge: ['u', 'U'], // 白いので、ふちを はい色にして 空でも見えるようにする
    fur: 'u',
    eyes: [[9, 5], [13, 5]],
    head: [8, 0, 7, 7],
  },
  fox: {
    rows: [
      '........k.....k.',
      '........fk...kf.',
      '........fffffff.',
      '........fkfffkf.',
      '........wwfffww.',
      '.ff......wwkww..',
      'ffff.fffffwww...',
      'wffffffffffww...',
      'wwfffffffffff...',
      '.ww.ffffffffff..',
    ],
    legs: [
      ['....ff.....ff...', '....kk.....kk...'],
      ['...ff.ff..ff.ff.', '...kk.kk..kk.kk.'],
    ],
    sit: '....kkkk..kkkk..',
    palette: { f: '#ec7330', w: '#fff6ea', k: '#3b2a17' },
    fur: 'f',
    eyes: [[9, 3], [13, 3]],
    head: [8, 0, 7, 6],
  },
};

// edge: [もとの色, ふちの色]。すきま（.）に となりあう ドットを ふちの色にする
function outline(rows, [from, to]) {
  const at = (x, y) => (rows[y] && rows[y][x]) || '.';
  return rows.map((row, y) =>
    [...row]
      .map((ch, x) => (ch === from && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === '.') ? to : ch))
      .join(''),
  );
}

function paint(rows, palette) {
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!palette[ch]) return;
      g.fillStyle = palette[ch];
      g.fillRect(x, y, 1, 1);
    });
  });
  return c;
}

// まだ見つけていない子は かげだけ見せる
function silhouette(src) {
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#2b2b2b';
  g.fillRect(0, 0, SW, SH);
  return c;
}

// frames[ポーズ][まばたき] ポーズ: 0=たち 1=あるき 2=すわり
const SPR = {};
for (const [id, a] of Object.entries(ART)) {
  const poses = [
    [...a.rows, ...a.legs[0]],
    [...a.rows, ...a.legs[1]],
    ['.'.repeat(SW), ...a.rows, a.sit],
  ].map((rows) => (a.edge ? outline(rows, a.edge) : rows));
  const frame = (rows, blink, dy) =>
    paint(
      rows.map((row, y) =>
        [...row].map((ch, x) => (blink && a.eyes.some(([ex, ey]) => ex === x && ey + dy === y) ? a.fur : ch)).join(''),
      ),
      a.palette,
    );
  SPR[id] = {
    frames: poses.map((rows, i) => [frame(rows, false, i === 2 ? 1 : 0), frame(rows, true, i === 2 ? 1 : 0)]),
    head: a.head,
  };
  SPR[id].shadow = silhouette(SPR[id].frames[0][0]);
}

export const POSE = { stand: 0, walk: 1, sit: 2 };

// x: まんなか、bottom: 足もと、w: よこはば（ピクセル）
export function drawFriend(ctx, id, x, bottom, w, { flip = false, pose = 0, blink = false, shadow = false } = {}) {
  const img = shadow ? SPR[id].shadow : SPR[id].frames[pose][blink ? 1 : 0];
  const h = (w * SH) / SW;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, bottom - h);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, 0, w, h);
  ctx.restore();
}

// しげみから 頭だけ のぞかせる。cx: 頭のまんなか、bottom: 頭の下、px: ドット1つの大きさ
export function drawFriendHead(ctx, id, cx, bottom, px, flip, blink) {
  const [sx, sy, sw, sh] = SPR[id].head;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, bottom - sh * px);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(SPR[id].frames[0][blink ? 1 : 0], sx, sy, sw, sh, (-sw * px) / 2, 0, sw * px, sh * px);
  ctx.restore();
}

// HTML の <img> 用（正方形）
export function friendIconURL(id, size = 48, shadow = false) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  drawFriend(g, id, size / 2, size - (size - (size * SH) / SW) / 2, size, { shadow });
  return c.toDataURL();
}

// しげみ（ともだちが かくれている）
const BUSH = [
  '..gGGg..',
  '.gGhGGg.',
  'gGhGGgGg',
  'GGGgGGhG',
  'gGgGGGgG',
  'GGGGgGGg',
  '.gGGGGg.',
  '..dddd..',
];
const bushSprite = paint(BUSH, { g: '#2f7d32', G: '#46a048', h: '#6cc46a', d: '#1f4f21' });

export function drawBush(ctx, cx, bottom, size, tilt = 0) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, bottom);
  ctx.rotate(tilt);
  ctx.drawImage(bushSprite, 0, 0, 8, 8, -size / 2, -size, size, size);
  ctx.restore();
}

const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
// px: ドット1つの大きさ
export function drawHeart(ctx, cx, cy, px, color = '#ff5c8a') {
  ctx.fillStyle = color;
  HEART.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === 'X') ctx.fillRect(cx + (x - 2.5) * px, cy + (y - 2.5) * px, px, px);
    });
  });
}

// ---------- おうちで くらす ----------
const GRAVITY = 30;
const PET_W = 0.85; // あたり判定の よこ（マス）
const PET_H = 0.75; // あたり判定の たて（マス）。1マスの すきまは とおれる
const PET_SCALE = 1.25; // ブロックと ならんでも 小さすぎないように、ステージより 大きめに えがく

export class Pet {
  // x: まんなか、y: 足もと（マス）
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.state = 'sit';
    this.timer = 0.5 + Math.random() * 1.5;
    this.ground = false;
    this.anim = Math.random() * 3;
    this.cool = 0;
  }

  // からだの まんなかの たかさ
  get cy() {
    return this.y - PET_H / 2;
  }

  update(dt, isSolid) {
    const f = FRIENDS[this.id];
    this.anim += dt;
    this.cool -= dt;
    if (this.overlaps(isSolid)) this.unstuck(isSolid);

    // あるく ↔ すわって休む
    this.timer -= dt;
    if (this.ground && this.timer <= 0) {
      if (this.state === 'walk') {
        this.state = 'sit';
        this.timer = 1 + Math.random() * 2.5;
      } else {
        this.state = 'walk';
        this.timer = 2 + Math.random() * 4;
        if (Math.random() < 0.5) this.dir *= -1;
      }
    }

    const want = this.state === 'walk' ? this.dir * f.speed : 0;
    this.vx += (want - this.vx) * Math.min(1, dt * 10);

    if (this.state === 'walk' && this.ground) {
      // まえに かべ → のぼれる高さなら ジャンプ、むりなら ひきかえす
      const front = Math.floor(this.x + this.dir * (PET_W / 2 + 0.08));
      const feet = Math.floor(this.y - 0.01);
      if (isSolid(front, feet)) {
        let h = 1;
        while (h <= f.climb && isSolid(front, feet - h)) h++;
        if (h <= f.climb && this.roomAbove(isSolid, feet, h)) {
          this.vy = -Math.sqrt(2 * GRAVITY * (h + 0.35));
          this.ground = false;
        } else {
          this.dir *= -1;
          this.vx = 0;
        }
      } else if (f.hop) {
        this.vy = -f.hop;
        this.ground = false;
      } else if (f.pounce && Math.random() < dt * 0.35) {
        this.vy = -9;
        this.ground = false;
      }
    }

    this.vy = Math.min(this.vy + GRAVITY * dt, 14);
    const n = Math.max(1, Math.ceil((Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt) / 0.25));
    this.ground = false;
    for (let i = 0; i < n; i++) {
      this.moveX((this.vx * dt) / n, isSolid);
      this.moveY((this.vy * dt) / n, isSolid);
    }
  }

  roomAbove(isSolid, feet, h) {
    for (let tx = Math.floor(this.x - PET_W / 2); tx <= Math.floor(this.x + PET_W / 2 - 1e-6); tx++) {
      for (let k = 1; k <= h; k++) if (isSolid(tx, feet - k)) return false;
    }
    return true;
  }

  moveX(dx, isSolid) {
    if (!dx) return;
    this.x += dx;
    const tx = dx > 0 ? Math.floor(this.x + PET_W / 2 - 1e-6) : Math.floor(this.x - PET_W / 2);
    for (let ty = Math.floor(this.y - PET_H); ty <= Math.floor(this.y - 1e-6); ty++) {
      if (!isSolid(tx, ty)) continue;
      this.x = dx > 0 ? tx - PET_W / 2 : tx + 1 + PET_W / 2;
      this.vx = 0;
      return;
    }
  }

  moveY(dy, isSolid) {
    if (!dy) return;
    this.y += dy;
    const ty = dy > 0 ? Math.floor(this.y - 1e-6) : Math.floor(this.y - PET_H);
    for (let tx = Math.floor(this.x - PET_W / 2); tx <= Math.floor(this.x + PET_W / 2 - 1e-6); tx++) {
      if (!isSolid(tx, ty)) continue;
      if (dy > 0) {
        this.y = ty;
        this.ground = true;
      } else {
        this.y = ty + 1 + PET_H;
      }
      this.vy = 0;
      return;
    }
  }

  overlaps(isSolid) {
    for (let ty = Math.floor(this.y - PET_H); ty <= Math.floor(this.y - 1e-6); ty++) {
      for (let tx = Math.floor(this.x - PET_W / 2); tx <= Math.floor(this.x + PET_W / 2 - 1e-6); tx++) {
        if (isSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  // ブロックで うまってしまったら、上の あいているところへ出る
  unstuck(isSolid) {
    const col = Math.floor(this.x);
    let y = Math.floor(this.y - 1e-6);
    for (let i = 0; i < 40 && isSolid(col, y); i++) y--;
    this.x = col + 0.5;
    this.y = y + 1;
    this.vy = -3;
    this.ground = false;
  }

  // タップされた・ころんが ぶつかった → ぴょんと はねる
  hop() {
    if (this.ground) {
      this.vy = -7;
      this.ground = false;
    }
    this.state = 'sit';
    this.timer = 0.8 + Math.random();
    this.cool = 1.2;
  }

  hits(x, y) {
    return Math.abs(x - this.x) < PET_W / 2 + 0.2 && y > this.y - PET_H - 0.4 && y < this.y + 0.15;
  }

  draw(ctx, ox, oy, t) {
    const f = FRIENDS[this.id];
    let pose = POSE.stand;
    if (!this.ground) pose = POSE.walk;
    else if (this.state === 'sit' && Math.abs(this.vx) < 0.3) pose = POSE.sit;
    else if (Math.abs(this.vx) > 0.3) pose = Math.floor(this.anim / 0.14) % 2 ? POSE.walk : POSE.stand;
    drawFriend(ctx, this.id, ox + this.x * t, oy + this.y * t, t * PET_SCALE * f.size, {
      flip: this.dir < 0,
      pose,
      blink: this.anim % 3.3 < 0.12,
    });
  }
}
