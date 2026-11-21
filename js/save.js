// セーブ（localStorage）。使えない環境でもゲームは動くようにする

const KEY = 'korokoro-block';

function blank() {
  return {
    version: 1,
    cleared: [], // クリアしたステージ番号
    perfect: [], // アイテムをぜんぶ集めたステージ番号
    items: { wood: 0, stone: 0, flower: 0, gem: 0 },
  };
}

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version === 1) return { ...blank(), ...s, items: { ...blank().items, ...s.items } };
  } catch (_) {}
  return blank();
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (_) {}
}
