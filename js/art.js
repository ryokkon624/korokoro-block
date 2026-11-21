// ブロックとアイテムのドット絵（8x8）と、ころん（ボール）をえがく

const P = 8;

export const FONT = '"M PLUS Rounded 1c", system-ui, sans-serif';

// マスごとに模様をかえるための数
export const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const choose = (list, rnd) => list[Math.floor(rnd() * list.length)];

// ---------- ブロック ----------
const TEXTURES = {
  grass: (x, y, rnd) => choose(['#5fa84f', '#68b357', '#579c47', '#71bb5f'], rnd),
  ice: (x, y, rnd) =>
    (x + y) % 6 === 0 && rnd() < 0.7 ? '#f4fcff' : choose(['#bfe9f7', '#cdeefa', '#b2e2f3'], rnd),
  stone: (x, y, rnd) => (rnd() < 0.12 ? '#626262' : choose(['#8c8c8c', '#9a9a9a', '#7f7f7f', '#a5a5a5'], rnd)),
  plank: (x, y, rnd) => {
    if (y % 4 === 3) return '#6b4a26';
    if (x === (y < 4 ? 5 : 1)) return '#7d5730';
    return choose(['#b07c43', '#a8733b', '#bb874d'], rnd);
  },
  leaves: (x, y, rnd) => (rnd() < 0.12 ? '#1f4f21' : choose(['#2f7d32', '#3a8f3c', '#28692b', '#46a048'], rnd)),
  // ここから下は おうちづくり用
  bricks: (x, y, rnd) => {
    if (y % 4 === 3 || x === (y < 4 ? 3 : 7)) return '#6e6e6e';
    return choose(['#a3a3a3', '#989898', '#adadad'], rnd);
  },
  roof: (x, y, rnd) => (y % 3 === 2 ? '#7d2620' : choose(['#c8463d', '#b83c34', '#d1534a'], rnd)),
  grassSide: (x, y, rnd) => {
    if (y < 2 || (y === 2 && rnd() < 0.5)) return choose(['#5fa84f', '#68b357', '#579c47'], rnd);
    return choose(['#8a5a32', '#7a4f2b', '#94643a'], rnd);
  },
  dirt: (x, y, rnd) => (rnd() < 0.08 ? '#8f8f8f' : choose(['#8a5a32', '#7a4f2b', '#94643a'], rnd)),
};

function noiseTile(seed, pick) {
  const c = makeCanvas(P, P);
  const g = c.getContext('2d');
  const rnd = rng(seed);
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      g.fillStyle = pick(x, y, rnd);
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// 種類ごとに4パターン（同じ模様が並ばないように）
export const tileTex = {};
Object.entries(TEXTURES).forEach(([name, pick], n) => {
  tileTex[name] = [0, 1, 2, 3].map((i) => noiseTile(1000 + n * 131 + i * 17, pick));
});

// ---------- アイテム ----------
function sprite(rows, palette) {
  const c = makeCanvas(P, P);
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

export const ITEM_ORDER = ['wood', 'stone', 'flower', 'gem'];
export const ITEM_NAMES = { wood: '木', stone: '石', flower: '花', gem: 'ほうせき' };
export const ITEM_COLORS = { wood: '#e0b97a', stone: '#c3c9cd', flower: '#ff6fa3', gem: '#4fe0ee' };
// 1こ ひろうと もらえる数
export const ITEM_AMOUNT = { wood: 5, stone: 5, flower: 3, gem: 2 };

export const itemSprites = {
  wood: sprite(
    ['..bbbb..', '.bBBBBb.', 'bBllllBb', 'bBlrrlBb', 'bBlrrlBb', 'bBllllBb', '.bBBBBb.', '..bbbb..'],
    { b: '#5a3a1a', B: '#8a5a2b', l: '#e0b97a', r: '#b98a4f' },
  ),
  stone: sprite(
    ['........', '..gggg..', '.gGGGGg.', 'gGhhGGGg', 'gGhGGGGg', 'gGGGGGGg', '.gggggg.', '........'],
    { g: '#555b60', G: '#8f979d', h: '#c3c9cd' },
  ),
  flower: sprite(
    ['...pp...', '..pyyp..', '..pyyp..', '...pp...', '...g..g.', '..gg.gg.', '...ggg..', '....g...'],
    { p: '#ff6fa3', y: '#ffd84a', g: '#3c9a3c' },
  ),
  gem: sprite(
    ['........', '..cccc..', '.cCwCCc.', 'cCwCCCCc', '.cCCCCc.', '..cCCc..', '...cc...', '........'],
    { c: '#1b8a9a', C: '#4fe0ee', w: '#ffffff' },
  ),
};

// おうちづくりのブロック
export const houseSprites = {
  door: sprite(
    ['.bbbbbb.', 'bBBBBBBb', 'bBbBBbBb', 'bBbBBbBb', 'bBBBBBBb', 'bBBBByBb', 'bBBBBBBb', 'bBBBBBBb'],
    { b: '#5a3a1a', B: '#a8733b', y: '#ffd84a' },
  ),
  window: sprite(
    ['ffffffff', 'fggwfggf', 'fgwgfggf', 'ffffffff', 'fgggfggf', 'fgggfgwf', 'fgggfwgf', 'ffffffff'],
    { f: '#8c8c8c', g: '#a9e2f5', w: '#ffffff' },
  ),
  gem: sprite(
    ['cccccccc', 'cCCCCwCc', 'cCCCwCCc', 'cCCCCCCc', 'cCwCCCCc', 'cwCCCCCc', 'cCCCCCCc', 'cccccccc'],
    { c: '#1b8a9a', C: '#4fe0ee', w: '#ffffff' },
  ),
};

// HTML の <img> 用
export function itemIconURL(type, size = 48) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(itemSprites[type], 0, 0, size, size);
  return c.toDataURL();
}

// ころん（進む方向を見る目つきのボール）
export function drawBall(ctx, x, y, r, b, time) {
  if (r < 0.5) return;
  if (b.blink > 0 && Math.floor(b.blink * 10) % 2 === 0) return;

  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y + r * 0.78, r * 0.85, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff6c8');
  g.addColorStop(0.45, '#ffc93c');
  g.addColorStop(1, '#e08a00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  const sp = Math.hypot(b.vx, b.vy);
  const look = Math.min(1, sp / 3);
  const lx = sp > 0.01 ? (b.vx / sp) * look : 0;
  const ly = sp > 0.01 ? (b.vy / sp) * look : 0;
  const ex = x + lx * r * 0.25;
  const ey = y - r * 0.12 + ly * r * 0.2;
  const closed = time % 3.2 < 0.12;
  for (const side of [-1, 1]) {
    const cx = ex + side * r * 0.3;
    if (closed) {
      ctx.strokeStyle = '#3b2a17';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1, ey);
      ctx.lineTo(cx + r * 0.1, ey);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3b2a17';
      ctx.beginPath();
      ctx.ellipse(cx, ey, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - r * 0.03, ey - r * 0.06, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,120,.55)';
    ctx.beginPath();
    ctx.ellipse(ex + side * r * 0.55, ey + r * 0.25, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
