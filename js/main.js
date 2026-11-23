// がめんの きりかえ（タイトル → ステージえらび → プレイ → クリア / おうちづくり）

import { Game } from './game.js';
import { House, BLOCKS, BLOCK_ORDER, blockIconURL } from './house.js';
import { STAGES } from './stages.js';
import {
  readTilt,
  bindMouse,
  setMouseTilt,
  requestSensorPermission,
  enterFullscreenLandscape,
  keepScreenOn,
} from './sensor.js';
import { initAudio, sfx } from './sound.js';
import { loadSave, writeSave } from './save.js';
import { ITEM_ORDER, itemIconURL } from './art.js';
import { FRIENDS, friendIconURL } from './friends.js';

// はじめて おうちづくりを開いたときの プレゼント
const GIFT = { wood: 20, stone: 20, flower: 5, gem: 3 };

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const game = new Game();
const house = new House();
const icons = Object.fromEntries(ITEM_ORDER.map((type) => [type, itemIconURL(type)]));
// ともだちの絵（見つけた子は色つき、まだの子は かげ）
const friendIcons = Object.fromEntries(
  Object.keys(FRIENDS).map((id) => [id, { on: friendIconURL(id), off: friendIconURL(id, 48, true) }]),
);
let save = loadSave();
let current = 'title';

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const W = innerWidth;
  const H = innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.resize(W, H, dpr);
  house.resize(W, H);
  layoutPalette();
}

function show(name) {
  current = name;
  for (const id of ['title', 'select', 'clear']) $(id).classList.toggle('hidden', id !== name);
  $('bBack').classList.toggle('hidden', name !== 'play' && name !== 'house');
  $('palette').classList.toggle('hidden', name !== 'house');
  setMouseTilt(name !== 'house');
}

// ボタンを押すたびに呼ぶ（音・センサー・全画面はタップのあとでないと使えない）
function tapped() {
  initAudio();
  sfx.tap();
  requestSensorPermission()
    .then(enterFullscreenLandscape)
    .then(keepScreenOn);
}

const isOpen = (i) => i === 0 || save.cleared.includes(i - 1);

const invHTML = (counts) =>
  ITEM_ORDER.filter((type) => counts[type])
    .map((type) => `<span class="inv"><img src="${icons[type]}" alt="">×${counts[type]}</span>`)
    .join('');

function showSelect() {
  const list = $('stageList');
  list.innerHTML = '';
  STAGES.forEach((stage, i) => {
    const open = isOpen(i);
    const btn = document.createElement('button');
    btn.className = open ? 'stage' : 'stage locked';
    btn.disabled = !open;
    const stars = (save.cleared.includes(i) ? '★' : '☆') + (save.perfect.includes(i) ? '★' : '☆');
    const friend =
      open && stage.friend
        ? `<img src="${friendIcons[stage.friend][save.friends.includes(stage.friend) ? 'on' : 'off']}" alt="">`
        : '';
    btn.innerHTML =
      `<span class="num">${open ? i + 1 : '🔒'}</span>` +
      `<span class="name">${stage.name}</span>` +
      `<span class="stars">${stars}${friend}</span>`;
    btn.onclick = () => startStage(i);
    list.appendChild(btn);
  });
  const inv = invHTML(save.items);
  $('inventory').innerHTML = inv ? `<span>もってる もの</span>${inv}` : '';
  show('select');
}

function startStage(i) {
  tapped();
  game.load(i, save.friends);
  show('play');
}

// ともだちは クリアする前に もどっても いなくならないように、見つけたら すぐセーブする
game.onFriend = (id) => {
  if (save.friends.includes(id)) return;
  save.friends.push(id);
  writeSave(save);
};

game.onClear = (res) => {
  if (!save.cleared.includes(res.index)) save.cleared.push(res.index);
  if (res.all && !save.perfect.includes(res.index)) save.perfect.push(res.index);
  for (const [type, n] of Object.entries(res.got)) save.items[type] += n;
  writeSave(save);

  const last = res.index === STAGES.length - 1;
  $('clearTitle').textContent = last ? 'ぜんぶ クリア！ すごい！' : 'クリア！';
  const got = invHTML(res.got);
  $('clearItems').innerHTML = got ? `<span>もちかえった もの</span>${got}` : '';
  $('clearFriend').innerHTML = res.friend
    ? `<span class="inv"><img src="${friendIcons[res.friend].on}" alt="">${FRIENDS[res.friend].name}が おうちで まってるよ！</span>`
    : '';
  $('clearNote').textContent = res.all ? 'ぜんぶ あつめた！ ★★' : got ? '' : 'こんどは アイテムも あつめてみよう！';
  $('bNext').classList.toggle('hidden', last);
  show('clear');
};

// ---------- おうちづくり ----------
function showHouse() {
  tapped();
  house.setup(save.house, save.items, save.friends);
  show('house');
  if (!save.houseGift) {
    for (const [type, n] of Object.entries(GIFT)) save.items[type] += n;
    save.houseGift = true;
    writeSave(save);
    $('giftItems').innerHTML = invHTML(GIFT);
    $('gift').classList.remove('hidden');
  }
  updatePalette();
}

house.onChange = () => {
  save.house = house.rows();
  writeSave(save);
  updatePalette();
};

function buildPalette() {
  const pal = $('palette');
  for (const code of BLOCK_ORDER) {
    const btn = document.createElement('button');
    btn.className = 'pal';
    btn.dataset.code = code;
    btn.innerHTML =
      `<img class="blk" src="${blockIconURL(code)}" alt="">` +
      `<span class="cnt"><img src="${icons[BLOCKS[code].material]}" alt="">×<b>0</b></span>`;
    btn.onclick = () => {
      sfx.tap();
      house.selected = code;
      updatePalette();
    };
    pal.appendChild(btn);
  }
}

function updatePalette() {
  for (const btn of $('palette').children) {
    const n = save.items[BLOCKS[btn.dataset.code].material];
    btn.classList.toggle('on', btn.dataset.code === house.selected);
    btn.classList.toggle('empty', n <= 0);
    btn.querySelector('b').textContent = n;
  }
}

function layoutPalette() {
  const r = house.paletteRect();
  const pal = $('palette');
  Object.assign(pal.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  pal.style.setProperty('--t', `${r.t}px`);
}

// ひとさし指 1本だけで おく
let paintPointer = null;
cv.addEventListener('pointerdown', (e) => {
  if (current !== 'house' || paintPointer !== null) return;
  paintPointer = e.pointerId;
  cv.setPointerCapture(e.pointerId);
  house.pointerDown(e.clientX, e.clientY);
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId === paintPointer) house.pointerMove(e.clientX, e.clientY);
});
const endPaint = (e) => {
  if (e.pointerId !== paintPointer) return;
  paintPointer = null;
  house.pointerUp();
};
cv.addEventListener('pointerup', endPaint);
cv.addEventListener('pointercancel', endPaint);
// 指でなぞったときに ブラウザがスクロールなどとして横取りし、pointercancel で止まってしまわないように
cv.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// ---------- ボタン ----------
$('bPlay').onclick = () => {
  tapped();
  showSelect();
};
$('bBack').onclick = () => {
  tapped();
  showSelect();
};
$('bRetry').onclick = () => startStage(game.index);
$('bNext').onclick = () => startStage(game.index + 1);
$('bToSelect').onclick = () => {
  tapped();
  showSelect();
};
$('bHouse').onclick = showHouse;
$('bGiftOk').onclick = () => {
  sfx.tap();
  $('gift').classList.add('hidden');
  updatePalette();
};

addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('resize', resize);
bindMouse(cv);
buildPalette();
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (current === 'house') {
    house.update(dt, readTilt());
    house.render(ctx);
  } else {
    if (current === 'play') game.update(dt, readTilt());
    else if (current === 'clear') game.update(dt, { x: 0, y: 0 });
    game.render(ctx);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// デバッグ用（PC で動作確認するときに使う）
window.korokoro = { game, house, get save() { return save; }, resetSave() { save = loadSave(); } };
