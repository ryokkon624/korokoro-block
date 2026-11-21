// 傾きセンサーと、全画面・画面固定・スリープ防止
// （sensor-test.html で X108 の実機確認ずみの方式）

const state = { motion: null, orient: null, mouse: null };

addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity;
  if (a && a.x != null && a.y != null) state.motion = { x: a.x, y: a.y };
});
addEventListener('deviceorientation', (e) => {
  if (e.beta != null && e.gamma != null) state.orient = { b: e.beta, g: e.gamma };
});

// PC での確認用: マウスでドラッグした方向にかたむける（タッチは無視する）
export function bindMouse(el) {
  const set = (e) => {
    const m = Math.min(innerWidth, innerHeight) / 2;
    state.mouse = { x: (e.clientX - innerWidth / 2) / m, y: (e.clientY - innerHeight / 2) / m };
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') set(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && e.buttons) set(e);
  });
  el.addEventListener('pointerup', () => {
    state.mouse = null;
  });
}

function screenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  if (typeof window.orientation === 'number') return window.orientation;
  return 0;
}

const DEAD_ZONE = 0.04;

// ボールが転がる向き（画面座標、長さ 0〜1）
export function readTilt() {
  let x, y;
  if (state.mouse) {
    ({ x, y } = state.mouse);
  } else {
    // 端末の座標: x=右, y=上
    let dx, dy;
    if (state.motion) {
      dx = -state.motion.x / 9.81;
      dy = -state.motion.y / 9.81;
    } else if (state.orient) {
      const r = Math.PI / 180;
      dx = Math.sin(state.orient.g * r);
      dy = -Math.sin(state.orient.b * r);
    } else {
      return { x: 0, y: 0 };
    }
    // 画面の回転にあわせる
    const t = (screenAngle() * Math.PI) / 180;
    x = dx * Math.cos(t) - dy * Math.sin(t);
    y = -(dx * Math.sin(t) + dy * Math.cos(t));
  }
  const len = Math.hypot(x, y);
  if (len < DEAD_ZONE) return { x: 0, y: 0 };
  const k = (Math.min(1, len) - DEAD_ZONE) / (1 - DEAD_ZONE) / len;
  return { x: x * k, y: y * k };
}

// iPad/iPhone 用（Android では何もしない）
export async function requestSensorPermission() {
  for (const Ev of [window.DeviceMotionEvent, window.DeviceOrientationEvent]) {
    if (Ev && typeof Ev.requestPermission === 'function') {
      try {
        await Ev.requestPermission();
      } catch (_) {}
    }
  }
}

// 'landscape' だと左右どちらの横向きにもセンサーで回ってしまう（本体の回転ロックより優先される）ので、
// 押した時点の横向きのまま固定する
export async function enterFullscreenLandscape() {
  if (document.fullscreenElement) return;
  try {
    const cur = screen.orientation.type;
    const target = cur.startsWith('landscape') ? cur : 'landscape-primary';
    await document.documentElement.requestFullscreen();
    await screen.orientation.lock(target);
  } catch (_) {}
}

// 傾けるだけで画面にさわらないので、暗くならないようにする
let wakeLock = null;
export async function keepScreenOn() {
  if (wakeLock || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch (_) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepScreenOn();
});
