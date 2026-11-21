// がめんの きりかえ（タイトル → ステージえらび → プレイ → クリア）

import { Game } from './game.js';
import { STAGES } from './stages.js';
import { readTilt, bindMouse, requestSensorPermission, enterFullscreenLandscape, keepScreenOn } from './sensor.js';
import { initAudio, sfx } from './sound.js';
import { loadSave, writeSave } from './save.js';
import { ITEM_ORDER, itemIconURL } from './art.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const game = new Game();
const icons = Object.fromEntries(ITEM_ORDER.map((type) => [type, itemIconURL(type)]));
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
}

function show(name) {
  current = name;
  for (const id of ['title', 'select', 'clear']) $(id).classList.toggle('hidden', id !== name);
  $('bBack').classList.toggle('hidden', name !== 'play');
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
    btn.innerHTML =
      `<span class="num">${open ? i + 1 : '🔒'}</span>` +
      `<span class="name">${stage.name}</span>` +
      `<span class="stars">${stars}</span>`;
    btn.onclick = () => startStage(i);
    list.appendChild(btn);
  });
  const inv = invHTML(save.items);
  $('inventory').innerHTML = inv ? `<span>もってる もの</span>${inv}` : '';
  show('select');
}

function startStage(i) {
  tapped();
  game.load(i);
  show('play');
}

game.onClear = (res) => {
  if (!save.cleared.includes(res.index)) save.cleared.push(res.index);
  if (res.all && !save.perfect.includes(res.index)) save.perfect.push(res.index);
  for (const [type, n] of Object.entries(res.got)) save.items[type] += n;
  writeSave(save);

  const last = res.index === STAGES.length - 1;
  $('clearTitle').textContent = last ? 'ぜんぶ クリア！ すごい！' : 'クリア！';
  const got = invHTML(res.got);
  $('clearItems').innerHTML = got ? `<span>もちかえった もの</span>${got}` : '';
  $('clearNote').textContent = res.all ? 'ぜんぶ あつめた！ ★★' : got ? '' : 'こんどは アイテムも あつめてみよう！';
  $('bNext').classList.toggle('hidden', last);
  show('clear');
};

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

addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('resize', resize);
bindMouse(cv);
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (current === 'play') game.update(dt, readTilt());
  else if (current === 'clear') game.update(dt, { x: 0, y: 0 });
  game.render(ctx);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// デバッグ用（PC で動作確認するときに使う）
window.korokoro = { game, get save() { return save; }, resetSave() { save = loadSave(); } };
