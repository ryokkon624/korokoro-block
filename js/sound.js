// こうかおんと バイブ

let ac = null;

// ブラウザの決まりで、タップのあとでないと音が出せない
export function initAudio() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch (_) {
    ac = null;
  }
}

function tone(freq, at, dur, vol, type = 'triangle', toFreq = null) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tap() {
    tone(660, 0, 0.08, 0.15, 'square');
  },
  pickup() {
    tone(988, 0, 0.12, 0.2);
    tone(1319, 0.08, 0.2, 0.2);
  },
  bump(power) {
    tone(150, 0, 0.07, Math.min(0.25, 0.05 + power * 0.3), 'square');
  },
  fall() {
    tone(700, 0, 0.5, 0.2, 'sine', 120);
  },
  respawn() {
    tone(523, 0, 0.1, 0.18);
    tone(784, 0.08, 0.15, 0.18);
  },
  goal() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.3, 0.22));
    tone(1047, 0.45, 0.6, 0.22);
    tone(1319, 0.45, 0.6, 0.15);
  },
};

export function buzz(ms) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (_) {}
}
