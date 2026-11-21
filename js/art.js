// ブロックとアイテムのドット絵（8x8）を作る

const P = 8;

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
export const ITEM_NAMES = { wood: 'き', stone: 'いし', flower: 'はな', gem: 'ほうせき' };
export const ITEM_COLORS = { wood: '#e0b97a', stone: '#c3c9cd', flower: '#ff6fa3', gem: '#4fe0ee' };

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

// HTML の <img> 用
export function itemIconURL(type, size = 48) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(itemSprites[type], 0, 0, size, size);
  return c.toDataURL();
}
