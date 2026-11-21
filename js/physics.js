// ボール（円）と マス目のかべ（四角）の あたり判定

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// かべから押し出して はねかえす。ぶつかった強さを返す
export function collideCircle(b, r, isSolid, bounce) {
  let hit = 0;
  for (let ty = Math.floor(b.y - r); ty <= Math.floor(b.y + r); ty++) {
    for (let tx = Math.floor(b.x - r); tx <= Math.floor(b.x + r); tx++) {
      if (!isSolid(tx, ty)) continue;
      let dx = b.x - clamp(b.x, tx, tx + 1);
      let dy = b.y - clamp(b.y, ty, ty + 1);
      const d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d < 1e-6) {
        // 中心がかべの中に入ってしまったときは、いちばん近い面から外へ出す
        const left = b.x - tx;
        const right = tx + 1 - b.x;
        const top = b.y - ty;
        const bottom = ty + 1 - b.y;
        const m = Math.min(left, right, top, bottom);
        dx = m === left ? -1 : m === right ? 1 : 0;
        dy = m === top ? -1 : m === bottom ? 1 : 0;
        if (dx && dy) dy = 0;
        b.x += dx * (m + r);
        b.y += dy * (m + r);
      } else {
        dx /= d;
        dy /= d;
        b.x += dx * (r - d);
        b.y += dy * (r - d);
      }
      const vn = b.vx * dx + b.vy * dy;
      if (vn < 0) {
        b.vx -= (1 + bounce) * vn * dx;
        b.vy -= (1 + bounce) * vn * dy;
        hit = Math.max(hit, -vn);
      }
    }
  }
  return hit;
}
