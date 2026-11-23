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
  place() {
    tone(520, 0, 0.07, 0.18);
  },
  erase() {
    tone(320, 0, 0.09, 0.16, 'triangle', 180);
  },
  lack() {
    tone(220, 0, 0.15, 0.15, 'square');
  },
  // ともだちの なき声
  voice(id, at = 0) {
    if (id === 'dog') {
      tone(330, at, 0.05, 0.18, 'square', 520);
      tone(520, at + 0.04, 0.13, 0.16, 'square', 280);
    } else if (id === 'cat') {
      tone(720, at, 0.12, 0.16, 'sine', 980);
      tone(980, at + 0.1, 0.32, 0.16, 'sine', 560);
    } else if (id === 'rabbit') {
      tone(560, at, 0.1, 0.16, 'sine', 400);
      tone(520, at + 0.14, 0.14, 0.16, 'sine', 360);
    } else if (id === 'fox') {
      tone(1050, at, 0.07, 0.14, 'triangle', 760);
      tone(1050, at + 0.15, 0.07, 0.14, 'triangle', 760);
    } else if (id === 'squirrel') {
      tone(1700, at, 0.05, 0.14, 'sine', 2400);
      tone(1900, at + 0.09, 0.05, 0.14, 'sine', 2600);
    }
  },
  // ことりの なき声
  chirp() {
    tone(2500, 0, 0.05, 0.1, 'sine', 3300);
    tone(2700, 0.08, 0.06, 0.1, 'sine', 3500);
  },
  // ちょうちょや ほたるに さわったとき
  twinkle() {
    tone(1568, 0, 0.12, 0.1, 'sine');
    tone(2093, 0.06, 0.16, 0.1, 'sine');
  },
  // おきゃくさんが はじめて きたとき
  visit() {
    [659, 880, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.15));
  },
  // ともだちに なったとき
  friend(id) {
    this.voice(id);
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35 + i * 0.08, 0.2, 0.18));
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
