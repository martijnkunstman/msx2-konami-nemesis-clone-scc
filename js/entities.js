'use strict';
// ---------------------------------------------------------------------------
// Enemies and bosses. Each type: size/hp/score + init/update/draw, and
// optionally hitShot(e, shot) -> 'hit' | 'custom' | 'block' | null and
// hitPlayer(e, rect) for non-rectangular shapes.
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = (x, y, w, h) => ({ x, y, w, h });
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function circRect(cx, cy, r, b) {
  const dx = cx - clamp(cx, b.x, b.x + b.w), dy = cy - clamp(cy, b.y, b.y + b.h);
  return dx * dx + dy * dy < r * r;
}
function aimAt(x, y, speed) {
  const p = G.player, dx = p.x + 8 - x, dy = p.y + 4 - y, d = Math.hypot(dx, dy) || 1;
  return [dx / d * speed, dy / d * speed];
}
const bulletSpeed = s => s * (1 + 0.2 * G.loop);
const canShoot = x => G.player.alive && G.state === 'play' && x > 4 && x < SCREEN_W - 4;
function enemyShot(x, y, speed = 1.6) {
  if (!canShoot(x)) return;
  const [vx, vy] = aimAt(x, y, bulletSpeed(speed));
  G.eshots.push({ type: 'ball', x: x - 2, y: y - 2, w: 4, h: 4, vx, vy, t: 0 });
}
function enemySpread(x, y, n, spread, speed) {
  if (!canShoot(x)) return;
  const p = G.player, base = Math.atan2(p.y + 4 - y, p.x + 8 - x), sp = bulletSpeed(speed);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread;
    G.eshots.push({ type: 'ball', x: x - 2, y: y - 2, w: 4, h: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 });
  }
}
function groundAlign(e) {
  const cx = e.x + e.w / 2;
  e.y = e.ground === 'ceil' ? ceilY(cx) : floorY(cx) - e.h;
}
const fireRate = base => base - 20 * Math.min(G.loop, 3);

const EN = {};

// --- shared air enemies -----------------------------------------------------
EN.fan = {
  w: 8, h: 8, hp: 1, score: 100,
  init(e) { e.st = 0; e.vx = e.pat === 'fan' ? -3 : -1.8; e.vy = 0; e.by = e.y; e.turnX = e.turnX || 90; },
  update(e) {
    if (e.pat === 'fan') {
      if (e.st === 0) {
        e.x += e.vx;
        if (e.x < e.turnX) { e.st = 1; e.vy = (G.player.y > e.y ? 1 : -1) * 2.2; e.vx = -0.5; e.tt = 0; }
      } else if (e.st === 1) {
        e.x += e.vx; e.y += e.vy;
        if (++e.tt > 36 || Math.abs(G.player.y - e.y) < 4) e.st = 2;
      } else {
        e.vx = Math.min(3.2, e.vx + 0.2); e.vy *= 0.9;
        e.x += e.vx; e.y += e.vy;
      }
    } else {
      e.x += e.vx;
      if (e.pat === 'wave') e.y = e.by + Math.sin(e.t * 0.07 + e.ph) * 26;
    }
  },
  draw(e, ctx) { spr(ctx, (G.level.theme === 2 ? SPR.fan2 : SPR.fan)[(e.t >> 3) & 1], e.x, e.y); },
};

EN.rugal = {
  w: 12, h: 8, hp: 1, score: 100,
  init(e) { e.vx = e.vx || -1.6; e.vy = e.vy || 0; e.by = e.y; },
  update(e) {
    e.x += e.vx;
    if (e.vy) { e.y += e.vy; e.vy *= 0.94; if (Math.abs(e.vy) < 0.05) e.vy = 0; }
    else if (e.pat === 'wave') e.y = e.by + Math.sin(e.t * 0.06 + e.ph) * 24;
    else if (e.home) e.y += clamp((G.player.y - e.y) * 0.03, -0.7, 0.7);
  },
  draw(e, ctx) {
    const set = e.red ? SPR.rugalRed : G.level.theme === 2 ? SPR.rugal2 : SPR.rugal;
    spr(ctx, set[(e.t >> 4) & 1], e.x, e.y);
  },
};

EN.zub = {
  w: 6, h: 6, hp: 1, score: 50,
  init(e) { e.vx = e.vx ?? -1.2; e.vy = e.vy ?? 0; },
  update(e) {
    if (G.player.alive) { const [ax, ay] = aimAt(e.x + 3, e.y + 3, 0.05); e.vx += ax; e.vy += ay; }
    const m = 1.4 + 0.25 * G.loop, sp = Math.hypot(e.vx, e.vy);
    if (sp > m) { e.vx *= m / sp; e.vy *= m / sp; }
    e.x += e.vx; e.y += e.vy;
    if (e.t > 600) e.remove = true;
  },
  draw(e, ctx) { disc(ctx, e.x + 3, e.y + 3, 3, '4'); disc(ctx, e.x + 3, e.y + 3, 2, (e.t >> 2) & 1 ? '5' : 'd'); },
};

// --- stage 1 ground enemies -------------------------------------------------
EN.ducker = {
  w: 10, h: 8, hp: 2, score: 200,
  init(e) { groundAlign(e); e.fireT = 30 + (Math.random() * 60 | 0); e.dir = -1; },
  update(e) {
    e.dir = G.player.x + 8 < e.x + 5 ? -1 : 1;
    e.x += e.dir * 0.6;
    groundAlign(e);
    if (--e.fireT <= 0) { e.fireT = fireRate(100); enemyShot(e.x + 5, e.y + 4); }
  },
  draw(e, ctx) { spr(ctx, SPR.ducker[e.ground === 'ceil' ? 'ceil' : 'floor'][e.dir > 0 ? 1 : 0][(e.t >> 3) & 1], e.x, e.y); },
};

EN.turret = {
  w: 8, h: 8, hp: 3, score: 200,
  init(e) { groundAlign(e); e.fireT = 40 + (Math.random() * 80 | 0); },
  update(e) {
    if (--e.fireT <= 0) { e.fireT = fireRate(110); enemyShot(e.x + 4, e.ground === 'ceil' ? e.y + 7 : e.y + 1, 1.5); }
  },
  draw(e, ctx) { spr(ctx, e.ground === 'ceil' ? SPR.turretC : SPR.turret, e.x, e.y); },
};

EN.hatch = {
  w: 16, h: 8, hp: 10, score: 1000,
  init(e) { groundAlign(e); },
  update(e) {
    const c = e.t % 170;
    e.open = c > 90 && c < 160;
    if (e.open && c % 14 === 0 && e.x < 240 && e.x > 0) {
      const up = e.ground !== 'ceil';
      spawnEnemy('rugal', { x: e.x + 2, y: up ? e.y - 6 : e.y + 6, vx: -1.1, vy: up ? -2.2 : 2.2, home: true, score: 50 });
    }
  },
  draw(e, ctx) {
    const f = e.ground === 'ceil';
    rect(ctx, e.x, e.y, 16, 8, '1');
    rect(ctx, e.x + 1, e.y + 1, 14, 6, 'j');
    rect(ctx, e.x + 1, f ? e.y + 6 : e.y + 1, 14, 1, '2');
    rect(ctx, e.x + 3, f ? e.y + 4 : e.y + 2, 10, 2, e.open ? ((G.t & 4) ? '5' : '6') : '2');
  },
};

EN.volcano = {
  w: 8, h: 8, hp: 1, score: 0,
  init(e) { e.noHit = true; e.noPlayer = true; e.dir = e.ground === 'ceil' ? -1 : 1; groundAlign(e); },
  update(e) {
    if (e.x > 250 || e.x < -8) return;
    const c = e.t % 160;
    if (c < 70 && c % 9 === 0) {
      spawnEnemy('rock', {
        x: e.x + 1, y: e.dir > 0 ? e.y + 2 : e.y,
        vx: -0.4 - Math.random() * 1.4, vy: -(3 + Math.random() * 1.6) * e.dir, g: 0.075 * e.dir,
      });
    }
  },
  draw(e, ctx) { rect(ctx, e.x + 1, e.dir > 0 ? e.y + 6 : e.y, 6, 2, (e.t >> 2) & 1 ? '5' : '6'); },
};

EN.rock = {
  w: 6, h: 6, hp: 2, score: 50,
  update(e) {
    e.vy += e.g; e.x += e.vx; e.y += e.vy;
    if (e.t > 15 && solidAt(e.x + 3, e.y + 3)) { e.remove = true; boom(e.x + 3, e.y + 3, 's'); }
  },
  draw(e, ctx) {
    disc(ctx, e.x + 3, e.y + 3, 3, '4');
    disc(ctx, e.x + 3, e.y + 3, 2, (e.t >> 2) & 1 ? '6' : 'e');
    rect(ctx, e.x + 2, e.y + 2, 1, 1, '7');
  },
};

// Secret: invisible target under the cave ceiling, reveals an extra life.
EN.hidden = {
  w: 12, h: 10, hp: 3, score: 0,
  init(e) { e.noPlayer = true; e.y = ceilY(e.x + 6); },
  onDeath(e) { spawnItem('1up', e.x + 2, e.y + 1, true); msg('SECRET 1UP FOUND!', 'c'); SND.sfx.oneup(); },
  draw(e, ctx) { if (e.flash) rect(ctx, e.x, e.y, 12, 10, 'g'); },
};

// --- stage 2 organic enemies ------------------------------------------------
EN.bubble = {
  w: 20, h: 20, hp: 4, score: 200,
  init(e) {
    if (e.small) { e.w = e.h = 10; e.hp = 1; e.score = 50; }
    e.vx = e.vx ?? -0.7; e.vy = e.vy ?? 0; e.by = e.y;
  },
  update(e) {
    e.x += e.vx;
    if (e.small) { e.y += e.vy; if (e.y < 0 || e.y > PLAY_H - e.h) e.vy = -e.vy; }
    else e.y = e.by + Math.sin(e.t * 0.05) * 18;
  },
  onDeath(e) {
    if (!e.small) for (const s of [-1, 1]) spawnEnemy('bubble', { x: e.x + 5, y: e.y + 5, small: true, vx: -1.2, vy: s * 1.1 });
  },
  draw(e, ctx) {
    const r = e.w / 2, cx = e.x + r, cy = e.y + r;
    disc(ctx, cx, cy, r, 'h');
    disc(ctx, cx, cy, r - 1, (e.t >> 4) & 1 ? 'd' : 'n');
    disc(ctx, cx - r / 3, cy - r / 3, Math.max(1, r / 4 | 0), 'f');
  },
};

EN.tentacle = {
  w: 8, h: 8, hp: 8, score: 500,
  init(e) { e.segs = []; e.n = 7; e.fireT = 60 + (Math.random() * 60 | 0); this.calc(e); },
  calc(e) {
    const bx = e.x + 4, by = e.ground === 'ceil' ? ceilY(bx) : floorY(bx);
    let a = e.ground === 'ceil' ? Math.PI / 2 : -Math.PI / 2, px = bx, py = by;
    e.segs.length = 0;
    for (let i = 0; i < e.n; i++) {
      a += Math.sin(e.t * 0.045 + i * 0.7) * 0.3;
      px += Math.cos(a) * 7; py += Math.sin(a) * 7;
      e.segs.push([px, py]);
    }
    e.tip = e.segs[e.n - 1];
  },
  update(e) {
    this.calc(e);
    if (--e.fireT <= 0) { e.fireT = fireRate(120); enemyShot(e.tip[0], e.tip[1], 1.5); }
  },
  hitShot(e, s) {
    if (circRect(e.tip[0], e.tip[1], 6, s)) return 'hit';
    for (let i = 0; i < e.n - 1; i++) if (circRect(e.segs[i][0], e.segs[i][1], 4, s)) return 'block';
    return null;
  },
  hitPlayer(e, r) { return e.segs.some(([x, y]) => circRect(x, y, 4, r)); },
  onDeath(e) { e.segs.forEach(([x, y], i) => { if (i % 2) boom(x, y, 's'); }); },
  draw(e, ctx) {
    for (let i = 0; i < e.n - 1; i++) {
      const [x, y] = e.segs[i];
      disc(ctx, x, y, 4, 'm'); disc(ctx, x, y, 3, 'n');
    }
    const [tx, ty] = e.tip;
    disc(ctx, tx, ty, 6, 'm'); disc(ctx, tx, ty, 5, 'd'); disc(ctx, tx - 1, ty, 2, '5');
  },
};

EN.pod = {
  w: 16, h: 10, hp: 12, score: 1000,
  init(e) { groundAlign(e); },
  update(e) {
    const c = e.t % 180;
    e.open = c > 100 && c < 170;
    if (e.open && c % 16 === 0 && e.x < 244 && e.x > 0) {
      const f = e.ground !== 'ceil';
      spawnEnemy('zub', { x: e.x + 5, y: f ? e.y - 6 : e.y + e.h, vx: -0.5, vy: f ? -1.5 : 1.5 });
    }
  },
  draw(e, ctx) {
    const f = e.ground === 'ceil';
    for (let dy = 0; dy < 10; dy++) {
      const hw = Math.round(8 * Math.sqrt(1 - (dy / 10) ** 2));
      rect(ctx, e.x + 8 - hw, f ? e.y + dy : e.y + e.h - 1 - dy, hw * 2, 1, dy > 6 ? 'n' : 'm');
    }
    rect(ctx, e.x + 5, f ? e.y + 6 : e.y + 2, 6, 2, e.open ? ((G.t & 4) ? '5' : '7') : 'h');
  },
};

// Moai-style stone head; destroy all four for a secret weapon.
EN.stonehead = {
  w: 16, h: 24, hp: 24, score: 3000,
  init(e) { groundAlign(e); },
  mouthY(e) { return e.ground === 'ceil' ? e.y + 6 : e.y + 18; },
  update(e) {
    const c = e.t % 170;
    e.open = c > 95 && c < 165;
    if (e.open && c >= 100 && c <= 140 && (c - 100) % 20 === 0 && e.x < 244) spawnEnemy('ring', { x: e.x - 6, y: this.mouthY(e) - 4 });
  },
  hitShot(e, s) { return overlap(s, e) ? (e.open ? 'hit' : 'block') : null; },
  onDeath(e) {
    G.secretHeads++;
    if (G.secretHeads === 4) {
      spawnItem('fire', e.x + 4, e.ground === 'ceil' ? e.y + 30 : e.y - 14, false);
      msg('SECRET WEAPON APPEARED!', '7');
      SND.sfx.oneup();
    }
  },
  draw(e, ctx) {
    const c = e.ground === 'ceil';
    const r = (x, y, w, h, col) => rect(ctx, e.x + x, c ? e.y + 24 - y - h : e.y + y, w, h, col);
    r(2, 0, 14, 24, '1');
    r(3, 1, 12, 22, '2');
    r(0, 5, 10, 3, 'j');
    r(4, 9, 4, 2, e.open ? ((G.t & 4) ? '5' : '7') : '0');
    r(0, 9, 3, 6, 'j');
    r(1, 16, 8, e.open ? 5 : 2, e.open ? '0' : '1');
    r(2, 21, 10, 3, 'j');
    r(12, 3, 2, 18, '1');
  },
};

EN.ring = {
  w: 8, h: 8, hp: 1, score: 10,
  init(e) { [e.vx, e.vy] = aimAt(e.x + 4, e.y + 4, bulletSpeed(1.3)); e.r = 3; },
  update(e) {
    e.x += e.vx; e.y += e.vy;
    if (e.r < 6 && e.t % 6 === 0) { e.r++; e.x--; e.y--; e.w += 2; e.h += 2; }
  },
  draw(e, ctx) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    oval(ctx, cx, cy, e.r, e.r, (e.t >> 2) & 1 ? '6' : '7');
    oval(ctx, cx, cy, e.r - 1, e.r - 1, '5');
  },
};

// --- Boss 1: GRAND CORE (Big Core homage) ----------------------------------
EN.boss1 = {
  w: 64, h: 48, hp: 999, score: 10000,
  init(e) {
    e.boss = true; e.x = 270; e.y = 72; e.ph = 'enter';
    const wh = 6 + 2 * G.loop;
    e.walls = [wh, wh, wh]; e.core = 14 + 4 * G.loop; e.timer = 60 * 50; e.fireT = 0; e.wflash = 0;
  },
  parts(e) {
    const x = e.x, y = e.y;
    return [R(x + 6, y, 54, 12), R(x + 6, y + 36, 54, 12), R(x + 22, y + 12, 42, 6), R(x + 22, y + 30, 42, 6), R(x + 44, y + 18, 20, 12)];
  },
  update(e) {
    if (e.wflash > 0) e.wflash--;
    if (e.ph === 'enter') { e.x -= 1; if (e.x <= 180) e.ph = 'fight'; return; }
    if (e.ph === 'escape') { e.x += 2.5; if (e.x > 280) { e.remove = true; stageClear(false); } return; }
    const ty = G.player.y + 4 - e.h / 2;
    e.y = clamp(e.y + clamp(ty - e.y, -0.9, 0.9), 4, PLAY_H - e.h - 4);
    if (++e.fireT >= Math.max(40, 80 - 15 * G.loop)) {
      e.fireT = 0;
      for (const oy of [3, 9, 39, 45]) G.eshots.push({ type: 'beam', x: e.x, y: e.y + oy - 1, w: 16, h: 2, vx: -(4 + G.loop), vy: 0, t: 0 });
      SND.sfx.beam();
    }
    if (--e.timer <= 0) { e.ph = 'escape'; msg('THE CORE ESCAPED...', '2'); }
  },
  hitShot(e, s) {
    if (e.ph === 'escape') return null;
    if (overlap(s, R(e.x + 4, e.y + 18, 44, 12))) {
      const i = e.walls.findIndex(h => h > 0);
      if (i >= 0) {
        const wx = e.x + 12 + i * 6;
        if (s.x + s.w < wx) return null;
        e.walls[i] = Math.max(0, e.walls[i] - s.dmg); e.wflash = 3;
        if (e.walls[i] === 0) { boom(wx + 1, e.y + 24, 's'); SND.sfx.explode(); addScore(500); }
        else SND.sfx.hit();
        return 'custom';
      }
      if (s.x + s.w < e.x + 30) return null;
      e.core -= s.dmg; e.flash = 3;
      if (e.core <= 0) bossDefeated(e); else SND.sfx.hit();
      return 'custom';
    }
    return this.parts(e).some(r => overlap(s, r)) ? 'block' : null;
  },
  hitPlayer(e, r) { return this.parts(e).some(p => overlap(r, p)) || overlap(r, R(e.x + 30, e.y + 18, 14, 12)); },
  draw(e, ctx) {
    const x = Math.round(e.x), y = Math.round(e.y), t = G.t;
    const fl = (t & 2) ? '6' : '7';
    rect(ctx, x + 60, y + 2, 4, 8, fl); rect(ctx, x + 60, y + 38, 4, 8, fl);
    for (const ay of [0, 36]) {
      rect(ctx, x + 6, y + ay, 54, 12, '1');
      rect(ctx, x + 7, y + ay + 1, 52, 10, 'b');
      rect(ctx, x + 7, y + ay + 1, 52, 2, 'g');
      rect(ctx, x + 7, y + ay + 9, 52, 2, 'a');
      rect(ctx, x + 2, y + ay + 2, 6, 3, 'j'); rect(ctx, x + 2, y + ay + 7, 6, 3, 'j');
      for (let i = 0; i < 4; i++) rect(ctx, x + 20 + i * 10, y + ay + 4, 6, 3, 'a');
    }
    rect(ctx, x + 22, y + 12, 42, 6, '1'); rect(ctx, x + 23, y + 12, 40, 5, 'j');
    rect(ctx, x + 22, y + 30, 42, 6, '1'); rect(ctx, x + 23, y + 31, 40, 5, 'j');
    rect(ctx, x + 44, y + 18, 20, 12, '2'); rect(ctx, x + 50, y + 20, 10, 8, '1');
    rect(ctx, x + 8, y + 18, 36, 12, 'k');
    e.walls.forEach((h, i) => {
      if (h > 0) rect(ctx, x + 12 + i * 6, y + 18, 3, 12, e.wflash && e.walls.findIndex(v => v > 0) === i ? '3' : h > 4 ? 'j' : h > 2 ? '2' : '1');
    });
    const cc = e.flash > 0 ? '3' : ['b', 'g', 'c', 'g'][(t >> 3) & 3];
    disc(ctx, x + 37, y + 24, 6, '1'); disc(ctx, x + 37, y + 24, 5, cc); disc(ctx, x + 35, y + 22, 1, '3');
  },
};

// --- Boss 2: GORGON EYE (organic, Golem / Zelos Force homage) --------------
EN.boss2 = {
  w: 80, h: 100, hp: 999, score: 20000,
  init(e) {
    e.boss = true; e.x = 300; e.y = 46; e.cy = 96; e.ph = 'enter';
    e.eye = 50 + 15 * G.loop; e.st = 'closed'; e.stT = 0; e.lid = 0; e.timer = 60 * 70;
    e.tents = [-1, 1].map(side => ({ side, hp: 18 + 6 * G.loop, segs: [], alive: true, fireT: side > 0 ? 40 : 0, flash: 0 }));
    this.calcTents(e);
  },
  eyeX(e) { return e.x + 26; },
  calcTents(e) {
    for (const tn of e.tents) {
      let a = Math.PI - tn.side * 0.5, px = e.x + 40, py = e.cy + tn.side * 30;
      tn.segs.length = 0;
      for (let i = 0; i < 10; i++) {
        a += Math.sin(e.t * 0.035 + i * 0.55 + tn.side) * 0.22;
        px += Math.cos(a) * 7; py += Math.sin(a) * 7;
        tn.segs.push([px, py]);
      }
    }
  },
  update(e) {
    e.cy = 96 + Math.sin(e.t * 0.018) * 34;
    e.y = e.cy - 50;
    this.calcTents(e);
    if (e.ph === 'enter') { e.x -= 0.8; if (e.x <= 168) e.ph = 'fight'; return; }
    if (e.ph === 'escape') { e.x += 1.5; if (e.x > 300) { e.remove = true; stageClear(false); } return; }
    const cx = this.eyeX(e);
    e.stT++;
    if (e.st === 'closed') {
      e.lid = 0;
      if (e.stT % 45 === 20 && G.enemies.filter(z => z.kind === 'zub').length < 6)
        spawnEnemy('zub', { x: cx - 26, y: e.cy - 3, vx: -1.5, vy: (Math.random() - 0.5) * 2 });
      if (e.stT > 120) { e.st = 'opening'; e.stT = 0; }
    } else if (e.st === 'opening') {
      e.lid = e.stT / 16;
      if (e.stT >= 16) { e.st = 'open'; e.stT = 0; }
    } else if (e.st === 'open') {
      e.lid = 1;
      if (e.stT % 40 === 20) enemySpread(cx - 20, e.cy, 5, 0.35, 1.7);
      if (e.stT > 150) { e.st = 'closing'; e.stT = 0; }
    } else {
      e.lid = 1 - e.stT / 16;
      if (e.stT >= 16) { e.st = 'closed'; e.stT = 0; }
    }
    for (const tn of e.tents) {
      if (tn.flash > 0) tn.flash--;
      if (!tn.alive) continue;
      if (++tn.fireT >= fireRate(90)) { tn.fireT = 0; const [x, y] = tn.segs[9]; enemyShot(x, y, 1.6); }
    }
    if (--e.timer <= 0) { e.ph = 'escape'; msg('THE EYE RETREATED...', '2'); }
  },
  hitShot(e, s) {
    if (e.ph === 'escape') return null;
    for (const tn of e.tents) {
      if (!tn.alive) continue;
      const [tx, ty] = tn.segs[9];
      if (circRect(tx, ty, 6, s)) {
        tn.hp -= s.dmg; tn.flash = 3;
        if (tn.hp <= 0) {
          tn.alive = false; addScore(3000); SND.sfx.explode();
          tn.segs.forEach(([x, y], i) => { if (i % 2) boom(x, y, 'm'); });
        } else SND.sfx.hit();
        return 'custom';
      }
      if (tn.segs.some(([x, y]) => circRect(x, y, 4, s))) return 'block';
    }
    if (circRect(this.eyeX(e), e.cy, 20, s)) {
      if (e.lid < 0.6) return 'block';
      e.eye -= s.dmg; e.flash = 3;
      if (e.eye <= 0) {
        if (e.tents.every(tn => !tn.alive)) { addScore(10000); msg('TENTACLE BONUS 10000', '7'); }
        bossDefeated(e);
      } else SND.sfx.hit();
      return 'custom';
    }
    return overlap(s, R(e.x + 30, e.cy - 44, 300, 88)) ? 'block' : null;
  },
  hitPlayer(e, r) {
    for (const tn of e.tents) if (tn.alive && tn.segs.some(([x, y]) => circRect(x, y, 4, r))) return true;
    return circRect(this.eyeX(e), e.cy, 20, r) || overlap(r, R(e.x + 36, e.cy - 44, 300, 88));
  },
  draw(e, ctx) {
    const x = e.x, cy = e.cy, cx = this.eyeX(e), t = G.t;
    // flesh mass
    disc(ctx, x + 84, cy, 50, 'm');
    disc(ctx, x + 64, cy - 32, 24, 'n'); disc(ctx, x + 64, cy + 32, 24, 'n');
    disc(ctx, x + 56, cy, 30, 'l');
    for (let i = 0; i < 5; i++) rect(ctx, x + 50 + i * 7, cy - 20 + ((i * 13 + (t >> 4)) % 40), 5, 1, 'm');
    // tentacles
    for (const tn of e.tents) {
      if (!tn.alive) continue;
      tn.segs.forEach(([sx, sy], i) => {
        if (i === 9) { disc(ctx, sx, sy, 6, 'm'); disc(ctx, sx, sy, 5, tn.flash ? '3' : 'd'); disc(ctx, sx - 1, sy, 2, '5'); }
        else { disc(ctx, sx, sy, 4, 'm'); disc(ctx, sx, sy, 3, 'n'); }
      });
    }
    // eye
    disc(ctx, cx, cy, 22, 'm');
    disc(ctx, cx, cy, 20, e.flash ? '5' : '3');
    const p = G.player, ix = cx + clamp((p.x + 8 - cx) * 0.06, -8, 0), iy = cy + clamp((p.y + 4 - cy) * 0.06, -7, 7);
    disc(ctx, ix, iy, 9, (t >> 3) & 1 ? '5' : 'n');
    disc(ctx, ix, iy, 4, '0');
    rect(ctx, ix - 3, iy - 4, 2, 2, '3');
    // eyelids cover rows outside the open band
    const open = e.lid * 20;
    for (let dy = -20; dy <= 20; dy++) {
      if (Math.abs(dy) <= open) continue;
      const hw = Math.floor(Math.sqrt(400 - dy * dy));
      rect(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, Math.abs(Math.abs(dy) - open) < 1.5 ? 'm' : 'l');
    }
  },
};
