'use strict';
// ---------------------------------------------------------------------------
// Main game: states, player, weapons, power meter, collisions, HUD, cheats.
// ---------------------------------------------------------------------------
const SCROLL_SPEED = 0.625;              // exact binary fraction: no jitter between terrain and sprites
const SPEEDS = [1.2, 1.6, 2.0, 2.4, 2.8, 3.2];
const SHIELD_MAX = 10;
const SLOT_LABELS = ['SPEED', 'MISSILE', 'DOUBLE', 'LASER', 'OPTION', '?'];
const HI_KEY = 'scc-strike-hi';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const G = {
  state: 'title', t: 0, stage: 0, loop: 0, selStage: 0, level: null,
  scrollX: 0, scrollDX: 0, spawnIdx: 0, player: null,
  shots: [], eshots: [], enemies: [], items: [], fx: [], msgs: [], stars: [], regrow: [],
  squads: {}, squadId: 0, score: 0, hi: 50000, lives: 3, nextExtend: 20000,
  cheats: { inf: false, keep: false }, gHold: 0, konami: false, paused: false,
  bossSpawned: false, bossWarn: 0, boss: null, bossDeath: null, bonus: null, bonusUsed: false,
  secretHeads: 0, banner: null, musicDelay: 0, flashT: 0, clearT: 0, endT: 0, goT: 0,
};
try { G.hi = Math.max(G.hi, +localStorage.getItem(HI_KEY) || 0); } catch (e) { /* storage unavailable */ }

// --- input ------------------------------------------------------------------
const keys = {}, pressed = {};
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  fire: ['KeyZ', 'Space', 'KeyK'], power: ['KeyX', 'KeyL'], weapon: ['KeyC'],
  pause: ['KeyP', 'Escape'], start: ['Enter', 'Space'],
};
const pad = { held: {}, prev: {} };
const held = a => KEYMAP[a].some(k => keys[k]) || !!pad.held[a];
const hit = a => KEYMAP[a].some(k => pressed[k]) || (!!pad.held[a] && !pad.prev[a]);
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let codeBuf = [];

addEventListener('keydown', e => {
  SND.init();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    pressed[e.code] = true;
    if (G.state === 'title') {
      codeBuf = codeBuf.concat(e.code).slice(-KONAMI.length);
      if (!G.konami && codeBuf.join() === KONAMI.join()) { G.konami = true; SND.sfx.cheat(); }
    }
  }
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousedown', () => SND.init());
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G.state === 'play') G.paused = true; SND.suspend(); }
  else if (!G.paused) SND.resume();
});

function pollPad() {
  pad.prev = pad.held; pad.held = {};
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
  if (!gp) return;
  const b = i => gp.buttons[i] && gp.buttons[i].pressed, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  Object.assign(pad.held, {
    left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), up: ay < -0.4 || b(12), down: ay > 0.4 || b(13),
    fire: b(0), power: b(1), weapon: b(2) || b(3), pause: b(9), start: b(9) || b(0),
  });
  if (Object.values(pad.held).some(v => v)) SND.init();
}

// --- helpers ----------------------------------------------------------------
const pad0 = (n, w) => String(Math.floor(n)).padStart(w, '0');
function msg(text, color = '3') { G.msgs.push({ text, color, t: 150 }); if (G.msgs.length > 3) G.msgs.shift(); }
function addScore(n) {
  if (!n) return;
  G.score += n;
  if (G.score >= G.nextExtend) {
    G.lives++; G.nextExtend += 50000;
    msg('EXTEND! 1UP', '9'); SND.sfx.oneup();
  }
  if (G.score > G.hi) G.hi = G.score;
}
function saveHi() { try { localStorage.setItem(HI_KEY, String(G.hi)); } catch (e) { /* ignore */ } }
function boom(x, y, size = 'm') {
  const r = size === 'l' ? 18 : size === 's' ? 6 : 10, life = size === 'l' ? 34 : size === 's' ? 14 : 22;
  G.fx.push({ type: 'boom', x, y, r, life, t: 0 });
  const n = size === 'l' ? 14 : size === 's' ? 3 : 7;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * (size === 'l' ? 3 : 2);
    G.fx.push({ type: 'deb', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 14 + Math.random() * 16 | 0, t: 0, c: ['7', '6', '5', '3'][i % 4] });
  }
  if (G.fx.length > 400) G.fx.splice(0, G.fx.length - 400);
}
const spark = (x, y) => G.fx.push({ type: 'spark', x, y, t: 0, life: 6 });
const floatText = (text, x, y, c = '3') => G.fx.push({ type: 'text', text, x, y, c, t: 0, life: 50 });

function spawnEnemy(kind, p) {
  const d = EN[kind];
  const e = Object.assign({ kind, x: 0, y: 0, w: d.w, h: d.h, hp: d.hp, score: d.score, t: 0, flash: 0 }, p);
  if (d.init) d.init(e);
  G.enemies.push(e);
  return e;
}
function spawnItem(type, x, y, attached) { G.items.push({ type, x, y, w: 8, h: 8, attached }); }
function dropCapsule(x, y) { spawnItem(Math.random() < 0.12 ? 'blue' : 'cap', x - 4, y - 4, false); }

function damageEnemy(e, n) {
  e.hp -= n; e.flash = 3;
  if (e.hp <= 0) killEnemy(e); else SND.sfx.hit();
}
function killEnemy(e, silent) {
  if (e.dead) return;
  e.dead = true;
  const d = EN[e.kind];
  if (!silent) {
    addScore(e.score);
    boom(e.x + e.w / 2, e.y + e.h / 2, e.w > 14 ? 'm' : 's');
    SND.sfx.explode();
  }
  if (d.onDeath) d.onDeath(e);
  if (silent) return;
  if (e.drop) dropCapsule(e.x + e.w / 2, e.y + e.h / 2);
  if (e.squad) {
    const s = G.squads[e.squad];
    if (++s.killed === s.n && !s.failed) dropCapsule(e.x + e.w / 2, e.y + e.h / 2);
  }
  // Konami's "revenge bullets" from the second loop on
  if (G.loop > 0 && e.kind !== 'rock' && e.kind !== 'ring' && Math.random() < 0.5) enemyShot(e.x + e.w / 2, e.y + e.h / 2, 1.4);
}
function bossDefeated(e) {
  if (e.dying) return;
  e.dying = true; e.remove = true; e.dead = true;
  G.bossDeath = { x: e.kind === 'boss2' ? e.x : e.x, y: e.kind === 'boss2' ? e.cy - 40 : e.y, w: 64, h: e.kind === 'boss2' ? 80 : 48, t: 0 };
  addScore(e.score);
  G.eshots = [];
  for (const o of G.enemies) if (o !== e) killEnemy(o, true);
  SND.stop(); SND.sfx.bigExplode();
  G.flashT = 10;
}

// --- player -----------------------------------------------------------------
function newPlayer() {
  return {
    x: 32, y: 88, alive: true, inv: 120, respawnT: 0, fireCd: 0, hist: [],
    speed: 0, missile: 0, double: 0, laser: 0, options: 0, shield: 0, ripple: false, fire: false,
    mode: 'normal', cursor: -1,
  };
}
function resetWeapons(p) {
  Object.assign(p, { speed: 0, missile: 0, double: 0, laser: 0, options: 0, shield: 0, ripple: false, fire: false, mode: 'normal', cursor: -1 });
}
function maxOut(p) {
  Object.assign(p, { speed: Math.max(p.speed, 3), missile: 2, double: 2, laser: 2, options: 4, shield: SHIELD_MAX, ripple: true, fire: true, mode: 'laser', cursor: -1 });
}
function slotLevel(p, i) { return [p.speed, p.missile, p.double, p.laser, p.options, p.shield > 0 ? 1 : 0][i]; }
function slotMaxed(p, i) { return i === 5 ? p.shield > 0 : slotLevel(p, i) >= [5, 2, 2, 2, 4][i]; }
function ownedModes(p) {
  const m = ['normal'];
  if (p.double) m.push('double');
  if (p.laser) m.push('laser');
  if (p.ripple) m.push('ripple');
  if (p.fire) m.push('fire');
  return m;
}
function modeLabel(p) {
  return { normal: 'NORMAL', double: 'DOUBLE' + p.double, laser: 'LASER' + p.laser, ripple: 'RIPPLE', fire: 'FIRE' }[p.mode];
}
function usePower() {
  const p = G.player, i = p.cursor;
  if (i < 0) return;
  if (slotMaxed(p, i)) { SND.sfx.tink(); return; }
  if (i === 0) p.speed++;
  else if (i === 1) p.missile++;
  else if (i === 2) { p.double++; p.mode = 'double'; }
  else if (i === 3) { p.laser++; p.mode = 'laser'; }
  else if (i === 4) p.options++;
  else p.shield = SHIELD_MAX;
  p.cursor = -1;
  SND.sfx.power();
}
function cycleMode() {
  const p = G.player, m = ownedModes(p);
  p.mode = m[(m.indexOf(p.mode) + 1) % m.length];
  SND.sfx.select();
  floatText(modeLabel(p), p.x, p.y - 8, '7');
}
function optionPos(i) {
  const p = G.player, h = p.hist;
  if (!h.length) return [p.x, p.y];
  return h[Math.min(h.length - 1, (i + 1) * 12)];
}
function srcPos(src) {
  if (src === 0) return [G.player.x + 16, G.player.y + 4];
  const [x, y] = optionPos(src - 1);
  return [x + 8, y + 4];
}

function fireFrom(src, x, y) {
  const p = G.player, mine = G.shots.filter(s => s.src === src);
  const n = type => mine.filter(s => s.type === type).length;
  let fired = false;
  if (p.mode === 'laser') {
    if (!n('laser')) {
      const lv = p.laser, h = lv > 1 ? 4 : 2;
      G.shots.push({ type: 'laser', src, x, y: y - h / 2, w: 6, h, maxW: lv > 1 ? 72 : 40, growing: true, dmg: 1, pierce: lv > 1, hits: new Set() });
      fired = true;
    }
  } else if (p.mode === 'ripple') {
    if (n('ripple') < 2) { G.shots.push({ type: 'ripple', src, x, y: y - 4, cy: y, w: 4, h: 8, vx: 5, dmg: 1, pierce: true, hits: new Set(), t: 0 }); fired = true; }
  } else if (p.mode === 'fire') {
    if (!n('fire')) {
      for (const a of [-0.25, 0, 0.25]) G.shots.push({ type: 'fire', src, x, y: y - 3, w: 6, h: 6, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, dmg: 2, pierce: true, hits: new Set(), t: 0, life: 24 });
      fired = true;
    }
  } else {
    if (n('bullet') < 2) { G.shots.push({ type: 'bullet', src, x, y: y - 1, w: 8, h: 2, vx: 7, vy: 0, dmg: 1 }); fired = true; }
    if (p.mode === 'double' && !n('dbl')) {
      G.shots.push({ type: 'dbl', src, x: x - 4, y: y - 3, w: 4, h: 4, vx: 5, vy: -5, dmg: 1 });
      if (p.double >= 2) G.shots.push({ type: 'dbl', src, x: x - 16, y: y - 1, w: 6, h: 2, vx: -6, vy: 0, dmg: 1 });
      fired = true;
    }
  }
  if (p.missile > 0 && !n('missile')) {
    G.shots.push({ type: 'missile', src, x: x - 8, y: y + 2, w: 6, h: 4, vx: 1.2, vy: 2.2, dir: 1, ph: 0, dmg: 2 });
    if (p.missile >= 2) G.shots.push({ type: 'missile', src, x: x - 8, y: y - 6, w: 6, h: 4, vx: 1.2, vy: 2.2, dir: -1, ph: 0, dmg: 2 });
    if (src === 0) SND.sfx.missile();
  }
  return fired;
}
function fireAll() {
  const p = G.player;
  const fired = fireFrom(0, p.x + 16, p.y + 4);
  for (let i = 0; i < p.options; i++) { const [ox, oy] = optionPos(i); fireFrom(i + 1, ox + 8, oy + 4); }
  if (fired) ({ laser: SND.sfx.laser, ripple: SND.sfx.ripple, fire: SND.sfx.fire }[p.mode] || SND.sfx.shoot)();
}

function killPlayer() {
  const p = G.player;
  if (!p.alive || p.inv > 0 || G.state !== 'play') return;
  p.alive = false; p.respawnT = 150;
  boom(p.x + 8, p.y + 4, 'l'); boom(p.x + 2, p.y + 2, 'm');
  SND.sfx.death();
  G.flashT = 4;
}
function respawn() {
  const p = G.player;
  if (G.lives <= 0 && !G.cheats.inf) { gameOver(); return; }
  if (!G.cheats.inf) G.lives--;
  if (!G.cheats.keep) resetWeapons(p);
  p.alive = true; p.inv = 150; p.x = 32; p.y = safeY(p.x + 8) - 4; p.hist = [];
}

function updatePlayer() {
  const p = G.player;
  if (!p.alive) { if (--p.respawnT <= 0) respawn(); return; }
  if (p.inv > 0) p.inv--;
  const sp = SPEEDS[p.speed];
  let dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0), dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  const ox = p.x, oy = p.y;
  p.x = clamp(p.x + dx * sp, 0, SCREEN_W - 16);
  p.y = clamp(p.y + dy * sp, 0, PLAY_H - 8);
  if (p.x !== ox || p.y !== oy) { p.hist.unshift([p.x, p.y]); if (p.hist.length > 60) p.hist.pop(); }
  if (p.fireCd > 0) p.fireCd--;
  if (held('fire') && p.fireCd === 0) { p.fireCd = 5; fireAll(); }
  if (hit('power')) usePower();
  if (hit('weapon')) cycleMode();
  if (G.state !== 'play') return;
  const pts = [[p.x + 15, p.y + 4], [p.x + 7, p.y + 2], [p.x + 7, p.y + 6], [p.x + 2, p.y + 4]];
  if (pts.some(([x, y]) => solidAt(x, y))) {
    if (p.inv > 0) p.y += clamp(safeY(p.x + 8) - 4 - p.y, -2, 2);
    else killPlayer();
  }
  // Secret warp: dive into the bottomless pit in stage 1's cave.
  const c = colAt(p.x + 8);
  if (!G.bonus && !G.bonusUsed && G.level.T.warp[c] && p.y >= PLAY_H - 10) enterBonus();
}

// --- shots --------------------------------------------------------------------
function hitTerrain(x, y, dmg) {
  const k = terrainAt(x, y);
  if (k === 2) damageCell(x, y, dmg);
  return k !== 0;
}
function damageCell(x, y, dmg) {
  const T = G.level.T, idx = colAt(x) * ROWS + Math.floor(y / TILE);
  T.cells[idx] = Math.max(0, T.cells[idx] - dmg);
  if (T.cells[idx] === 0) {
    G.regrow.push({ idx, t: 420 });
    boom(Math.floor((x + G.scrollX) / TILE) * TILE - G.scrollX + 4, Math.floor(y / TILE) * TILE + 4, 's');
    addScore(10);
  }
  SND.sfx.hit();
}
function updateMissile(s) {
  const d = s.dir;
  if (s.ph === 0) {
    s.x += s.vx; s.y += s.vy * d;
    const k = terrainAt(s.x + 3, d > 0 ? s.y + s.h : s.y - 1);
    if (k === 2) { damageCell(s.x + 3, d > 0 ? s.y + s.h : s.y - 1, s.dmg); s.dead = true; }
    else if (k === 1) s.ph = 1;
  } else {
    s.x += 2.6;
    const edge = () => (d > 0 ? s.y + s.h - 1 : s.y);
    if (!solidAt(s.x + 3, edge() + d * 2)) s.y += 1.5 * d;
    let k = 0;
    while (solidAt(s.x + 3, edge()) && k++ < 6) s.y -= d;
    if (k >= 6 || hitTerrain(s.x + s.w + 1, s.y + s.h / 2, s.dmg)) s.dead = true;
  }
  if (s.y > PLAY_H || s.y < -8) s.dead = true;
}
function updateShots() {
  for (const s of G.shots) {
    if (s.type === 'laser') {
      const [sx, sy] = srcPos(s.src);
      s.y = sy - s.h / 2;
      if (s.growing) { s.x = sx; s.w += 8; if (s.w >= s.maxW) { s.w = s.maxW; s.growing = false; } }
      else s.x += 8;
    } else if (s.type === 'ripple') {
      s.t++; s.x += s.vx;
      s.w = Math.min(14, 4 + s.t); s.h = Math.min(40, 8 + s.t * 3); s.y = s.cy - s.h / 2;
    } else if (s.type === 'fire') {
      s.t++; s.x += s.vx; s.y += s.vy;
      s.w = s.h = 6 + (s.t / 6 | 0);
      if (s.t > s.life) s.dead = true;
    } else if (s.type === 'missile') {
      updateMissile(s);
      continue;
    } else { s.x += s.vx; s.y += s.vy; }
    if (s.x > SCREEN_W || s.x + s.w < 0 || s.y + s.h < 0 || s.y > PLAY_H) { s.dead = true; continue; }
    const fx = s.vx < 0 ? s.x : s.x + s.w;
    if (hitTerrain(fx, s.y + s.h / 2, s.dmg)) { s.dead = true; spark(fx, s.y); }
  }
  G.shots = G.shots.filter(s => !s.dead);
}

// --- enemies, items -----------------------------------------------------------
function doSpawn(sp) {
  const x = sp.c * TILE - G.scrollX;
  if (sp.t === 'squad') {
    const id = ++G.squadId;
    G.squads[id] = { n: sp.n, killed: 0, failed: false };
    for (let i = 0; i < sp.n; i++) spawnEnemy(sp.kind, { x: 260 + i * 16, y: sp.y, pat: sp.pat, squad: id, ph: i * 0.6 });
  } else if (sp.t === 'redrugal') spawnEnemy('rugal', { x: 260, y: sp.y, red: true, drop: true, home: true });
  else if (sp.t === 'bubble') spawnEnemy('bubble', { x: 260, y: sp.y });
  else if (sp.t === 'item') spawnItem(sp.item, x, sp.row * TILE, true);
  else spawnEnemy(sp.t, { x, attached: true, ground: sp.g === 'c' ? 'ceil' : 'floor' });
}
function updateEnemies() {
  for (const e of G.enemies) {
    e.t++;
    if (e.flash > 0) e.flash--;
    if (e.attached) e.x -= G.scrollDX;
    const d = EN[e.kind];
    if (d.update) d.update(e);
    if (!e.boss && (e.x < -48 || e.x > 360 || e.y < -60 || e.y > PLAY_H + 60)) {
      e.remove = true;
      if (e.squad) G.squads[e.squad].failed = true;
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead && !e.remove);
}
function collectItem(it) {
  const p = G.player;
  switch (it.type) {
    case 'cap': p.cursor = (p.cursor + 1) % 6; SND.sfx.capsule(); addScore(10); break;
    case 'blue':
      SND.sfx.blue(); G.flashT = 8; G.eshots = [];
      for (const e of G.enemies) if (!e.boss && !e.noHit && e.x < SCREEN_W) killEnemy(e);
      break;
    case 'coin': addScore(500); floatText('500', it.x, it.y, '7'); SND.sfx.select(); break;
    case '1up': G.lives++; msg('1UP!', '9'); SND.sfx.oneup(); break;
    case 'ripple': p.ripple = true; p.mode = 'ripple'; msg('RIPPLE LASER!', 'c'); SND.sfx.power(); break;
    case 'fire': p.fire = true; p.mode = 'fire'; msg('FIRE BLASTER!', '6'); SND.sfx.power(); break;
  }
}
function updateItems() {
  const p = G.player, body = R(p.x, p.y, 16, 8);
  for (const it of G.items) {
    it.x += it.attached ? -G.scrollDX : (it.vx ?? -0.6);
    if (it.x < -16) it.dead = true;
    if (p.alive && overlap(body, it)) { it.dead = true; collectItem(it); }
  }
  G.items = G.items.filter(it => !it.dead);
}
function collisions() {
  for (const e of G.enemies) {
    if (e.dead || e.noHit) continue;
    const d = EN[e.kind];
    for (const s of G.shots) {
      if (s.dead || (s.hits && s.hits.has(e))) continue;
      const res = d.hitShot ? d.hitShot(e, s) : (overlap(s, e) ? 'hit' : null);
      if (!res) continue;
      if (res === 'block') { spark(s.x + s.w, s.y); SND.sfx.tink(); s.dead = true; continue; }
      if (res === 'hit') damageEnemy(e, s.dmg);
      if (s.pierce) s.hits.add(e); else s.dead = true;
      if (e.dead) break;
    }
  }
  const p = G.player;
  if (!p.alive || G.state !== 'play') return;
  const hb = R(p.x + 4, p.y + 2, 9, 4);
  for (const e of G.enemies) {
    if (e.dead || e.noPlayer) continue;
    const d = EN[e.kind];
    if (!(d.hitPlayer ? d.hitPlayer(e, hb) : overlap(hb, e))) continue;
    if (p.shield > 0 && !e.boss) { p.shield = Math.max(0, p.shield - 3); damageEnemy(e, 5); SND.sfx.shield(); }
    else killPlayer();
  }
  for (const s of G.eshots) {
    if (!overlap(hb, s)) continue;
    if (p.shield > 0) { p.shield--; s.dead = true; SND.sfx.shield(); }
    else if (p.inv === 0) { s.dead = true; killPlayer(); }
  }
}
function updateEShots() {
  for (const s of G.eshots) {
    s.x += s.vx; s.y += s.vy; s.t++;
    if (s.x < -20 || s.x > SCREEN_W + 20 || s.y < -10 || s.y > PLAY_H + 10) s.dead = true;
  }
  G.eshots = G.eshots.filter(s => !s.dead);
}
function updateRegrow() {
  if (!G.level) return;
  const T = G.level.T, p = G.player;
  for (const r of G.regrow) {
    if (--r.t > 0) continue;
    const c = Math.floor(r.idx / ROWS), row = r.idx % ROWS;
    const tile = R(c * TILE - G.scrollX, row * TILE, TILE, TILE);
    if (p.alive && overlap(tile, R(p.x, p.y, 16, 8))) { r.t = 30; continue; }
    T.cells[r.idx] = 3; r.done = true;
  }
  G.regrow = G.regrow.filter(r => !r.done);
}
function updateFx() {
  for (const f of G.fx) {
    f.t++;
    if (f.type === 'deb') { f.x += f.vx; f.y += f.vy; f.vx *= 0.96; f.vy *= 0.96; }
    if (f.type === 'text') f.y -= 0.4;
  }
  G.fx = G.fx.filter(f => f.t < f.life);
  for (const m of G.msgs) m.t--;
  G.msgs = G.msgs.filter(m => m.t > 0);
  if (G.flashT > 0) G.flashT--;
}

function initStars() {
  const theme = G.bonus ? 'b' : G.level && G.state !== 'title' ? G.level.theme : 1;
  const cols = { 1: ['3', 'g', 'b', '2'], 2: ['d', 'h', 'l', 'm'], b: ['7', '3', 'c', '6'] }[theme];
  G.stars = [];
  for (let i = 0; i < 50; i++) G.stars.push({ x: Math.random() * SCREEN_W, y: Math.random() * PLAY_H, s: [0.25, 0.5, 1][i % 3], c: cols[i % cols.length] });
}
function updateStars() {
  const k = G.bonus ? 6 : 1;
  for (const s of G.stars) { s.x -= s.s * k; if (s.x < 0) { s.x += SCREEN_W; s.y = Math.random() * PLAY_H; } }
}

// --- flow ---------------------------------------------------------------------
function startGame() {
  G.score = 0; G.lives = G.konami ? 30 : 3; G.loop = 0; G.nextExtend = 20000;
  G.player = newPlayer();
  startStage(G.selStage);
}
function startStage(i) {
  G.stage = i; G.level = buildLevel(i);
  Object.assign(G, {
    scrollX: 0, scrollDX: 0, spawnIdx: 0, enemies: [], shots: [], eshots: [], items: [], fx: [], squads: {}, regrow: [],
    bossSpawned: false, bossWarn: 0, boss: null, bossDeath: null, bonus: null, bonusUsed: false, secretHeads: 0,
    state: 'play', paused: false, banner: { t: 220, l1: 'STAGE ' + (i + 1), l2: G.level.name }, musicDelay: 200,
  });
  const p = G.player;
  Object.assign(p, { x: 32, y: 88, alive: true, inv: 120, hist: [] });
  initStars();
  SND.play('start');
}
function enterBonus() {
  G.bonusUsed = true;
  G.bonus = { t: 60 * 13 };
  G.enemies = []; G.eshots = []; G.items = []; G.flashT = 8;
  SND.sfx.warp(); SND.play('bonus');
  msg('SECRET BONUS STAGE!', '7');
  Object.assign(G.player, { x: 40, y: 90, inv: 60, hist: [] });
  for (let i = 0; i < 28; i++) {
    const type = i === 22 ? 'ripple' : i % 6 === 5 ? 'cap' : 'coin';
    G.items.push({ type, x: 270 + i * 26, y: 92 + Math.sin(i * 0.55) * 60, w: 8, h: 8, vx: -1.4 });
  }
  initStars();
}
function exitBonus() {
  const L = G.level;
  G.bonus = null;
  G.scrollX = L.warpTo * TILE;
  G.items = []; G.enemies = []; G.eshots = [];
  while (G.spawnIdx < L.spawns.length && L.spawns[G.spawnIdx].c * TILE - G.scrollX <= 264) G.spawnIdx++;
  const p = G.player;
  Object.assign(p, { x: 32, inv: 120, hist: [] });
  p.y = safeY(p.x + 8) - 4;
  SND.play(L.song);
  msg('WARP!', 'c');
  initStars();
}
function stageClear(killed) {
  if (G.state !== 'play') return;
  G.state = 'clear'; G.clearT = 0;
  const bonus = killed ? 10000 * (G.stage + 1) : 0;
  addScore(bonus);
  G.banner = { t: 999, l1: 'STAGE ' + (G.stage + 1) + ' CLEAR', l2: bonus ? 'BONUS ' + bonus : '' };
  G.enemies = []; G.eshots = [];
  SND.play('clear');
}
function gameOver() {
  G.state = 'gameover'; G.goT = 0;
  saveHi();
  SND.play('gameover');
}
function toTitle() {
  G.state = 'title'; G.level = null; G.paused = false;
  initStars();
  SND.play('title');
}

function updateCheats() {
  const p = G.player;
  // G (hold ~1s): infinite lives
  if (keys.KeyG) {
    if (++G.gHold === 60) {
      G.cheats.inf = !G.cheats.inf;
      msg(G.cheats.inf ? 'CHEAT: INFINITE LIVES ON' : 'INFINITE LIVES OFF', G.cheats.inf ? '7' : '2');
      SND.sfx.cheat();
    }
  } else G.gHold = 0;
  // H: keep weapons and power-ups after losing a ship
  if (pressed.KeyH) {
    G.cheats.keep = !G.cheats.keep;
    msg(G.cheats.keep ? 'CHEAT: KEEP WEAPONS ON' : 'KEEP WEAPONS OFF', G.cheats.keep ? '7' : '2');
    SND.sfx.cheat();
  }
  // J: every weapon and upgrade at once
  if (pressed.KeyJ && p.alive) {
    maxOut(p);
    msg('CHEAT: FULL POWER!', '7');
    SND.sfx.cheat();
  }
}

function updatePlay() {
  const L = G.level;
  if (G.musicDelay > 0 && --G.musicDelay === 0 && !G.bossSpawned && !G.bonus && G.state === 'play') SND.play(L.song);
  if (G.banner && G.state === 'play' && --G.banner.t <= 0) G.banner = null;
  G.scrollDX = G.bossSpawned || G.bonus || G.state !== 'play' ? 0 : SCROLL_SPEED;
  G.scrollX += G.scrollDX;
  if (!G.bonus && !G.bossSpawned) {
    while (G.spawnIdx < L.spawns.length && L.spawns[G.spawnIdx].c * TILE - G.scrollX <= 264) doSpawn(L.spawns[G.spawnIdx++]);
    if (G.scrollX >= L.bossScroll) { G.bossSpawned = true; G.bossWarn = 170; SND.stop(); SND.sfx.warning(); }
  }
  if (G.bossWarn > 0 && --G.bossWarn === 0 && G.state === 'play') {
    G.boss = spawnEnemy(L.boss, {});
    SND.play('boss');
    msg(L.bossName, '5');
  }
  if (G.bossDeath) {
    const b = G.bossDeath;
    if (++b.t % 5 === 0) boom(b.x + Math.random() * b.w, b.y + Math.random() * b.h, b.t % 20 === 0 ? 'l' : 'm');
    if (b.t % 20 === 0) SND.sfx.explode();
    if (b.t >= 150) { G.bossDeath = null; stageClear(true); }
  }
  if (G.bonus && --G.bonus.t <= 0) exitBonus();
  updateStars();
  updatePlayer();
  updateShots();
  updateEnemies();
  updateEShots();
  updateItems();
  collisions();
  updateFx();
  updateRegrow();
  if (G.state === 'clear' && ++G.clearT > 380) {
    G.banner = null;
    if (G.stage === 0) startStage(1);
    else { G.state = 'ending'; G.endT = 0; saveHi(); SND.play('title'); initStars(); }
  }
}

function update() {
  G.t++;
  pollPad();
  if (pressed.KeyM) SND.toggleMute();
  switch (G.state) {
    case 'title':
      updateStars();
      // arrow keys only, so typing the Konami code doesn't flip the selection
      if (pressed.ArrowLeft || pressed.ArrowRight || (pad.held.left && !pad.prev.left) || (pad.held.right && !pad.prev.right)) { G.selStage ^= 1; SND.sfx.select(); }
      if (hit('start')) { SND.init(); startGame(); }
      break;
    case 'play': case 'clear':
      if (hit('pause') && G.state === 'play') {
        G.paused = !G.paused;
        if (G.paused) SND.suspend(); else SND.resume();
      }
      if (!G.paused) { updateCheats(); updatePlay(); }
      break;
    case 'gameover':
      updateFx(); updateStars();
      if (++G.goT > 90 && hit('start')) toTitle();
      if (G.goT > 900) toTitle();
      break;
    case 'ending':
      updateStars();
      if (++G.endT > 120 && hit('start')) {
        G.loop++;
        startStage(0);
        msg('LOOP ' + (G.loop + 1) + ' - ENEMIES ARE STRONGER', '5');
      }
      break;
  }
  for (const k in pressed) delete pressed[k];
}

// --- rendering ----------------------------------------------------------------
function drawStars() {
  G.stars.forEach((s, i) => {
    if (((G.t + i * 7) >> 4) % 7 === 0) return;
    rect(ctx, s.x, s.y, s.s >= 1 || G.bonus ? 2 : 1, 1, s.c);
  });
}
function drawTerrain() {
  const T = G.level.T, tiles = SPR.tiles[G.level.theme], c0 = Math.floor(G.scrollX / TILE);
  for (let c = c0; c <= c0 + 32; c++) {
    if (c < 0 || c >= T.N) continue;
    const px = Math.round(c * TILE - G.scrollX), ce = T.ceil[c], fl = T.floor[c];
    for (let r = 0; r < ce; r++) ctx.drawImage(r === ce - 1 ? tiles.down : (c * 7 + r * 3) % 4 ? tiles.inner : tiles.inner2, px, r * TILE);
    for (let r = ROWS - fl; r < ROWS; r++) ctx.drawImage(r === ROWS - fl ? tiles.up : (c * 7 + r * 3) % 4 ? tiles.inner : tiles.inner2, px, r * TILE);
    for (let r = ce; r < ROWS - fl; r++) if (T.cells[c * ROWS + r]) ctx.drawImage(SPR.cell[((c + r + (G.t >> 4)) & 1)], px, r * TILE);
    // a faint glimmer at the bottom of the secret pit
    if (T.warp[c] && ((G.t >> 3) + c) % 5 === 0) rect(ctx, px + 3, PLAY_H - 3, 1, 1, '7');
  }
}
function drawItem(it) {
  const x = Math.round(it.x), y = Math.round(it.y);
  switch (it.type) {
    case 'cap': spr(ctx, SPR.cap, x, y); break;
    case 'blue': spr(ctx, SPR.capB, x, y); break;
    case 'ripple': spr(ctx, SPR.capG, x, y); drawText(ctx, 'R', x + 2, y + 1, '3'); break;
    case 'fire': spr(ctx, SPR.capO, x, y); drawText(ctx, 'F', x + 2, y + 1, '3'); break;
    case 'coin': { const w = [6, 4, 2, 4][(G.t >> 3) & 3]; rect(ctx, x + 4 - w / 2, y, w, 8, '6'); rect(ctx, x + 4 - w / 2, y + 1, Math.max(1, w - 1), 6, '7'); break; }
    case '1up':
      if ((G.t >> 3) & 1) rect(ctx, x - 2, y - 1, 12, 7, 'b');
      spr(ctx, SPR.mini, x - 1, y);
      break;
  }
}
function drawShot(s) {
  switch (s.type) {
    case 'bullet': rect(ctx, s.x, s.y, s.w, s.h, 'c'); rect(ctx, s.x + s.w - 3, s.y, 3, s.h, '3'); break;
    case 'dbl': rect(ctx, s.x, s.y, s.w, s.h, '3'); break;
    case 'laser': rect(ctx, s.x, s.y, s.w, s.h, 'c'); rect(ctx, s.x, s.y + (s.h > 2 ? 1 : 0), s.w, s.h > 2 ? 2 : 1, '3'); break;
    case 'missile': rect(ctx, s.x, s.y + 1, s.w, 2, '6'); rect(ctx, s.x + s.w - 2, s.y, 2, 4, '7'); break;
    case 'ripple': oval(ctx, s.x + s.w / 2, s.cy, s.w / 2, s.h / 2, (G.t & 2) ? 'c' : 'g'); oval(ctx, s.x + s.w / 2 + 1, s.cy, s.w / 2, s.h / 2, 'b'); break;
    case 'fire': disc(ctx, s.x + s.w / 2, s.y + s.h / 2, s.w / 2, (s.t >> 2) & 1 ? '6' : '5'); disc(ctx, s.x + s.w / 2, s.y + s.h / 2, s.w / 4, '7'); break;
  }
}
function drawPlayer() {
  const p = G.player;
  for (let i = p.options - 1; i >= 0; i--) { const [ox, oy] = optionPos(i); spr(ctx, SPR.option[(G.t >> 2) & 1], ox + 4, oy); }
  if (!p.alive || (p.inv > 0 && (G.t & 2))) return;
  spr(ctx, SPR.ship[(G.t >> 2) & 1], p.x, p.y);
  if (p.shield > 0) {
    const c = (G.t >> 2) & 1 ? 'b' : 'g', layers = Math.ceil(p.shield / (SHIELD_MAX / 3));
    for (let k = 0; k < layers; k++) { rect(ctx, p.x + 18 + k * 2, p.y - 2 + k, 1, 12 - k * 2, c); rect(ctx, p.x + 16 + k * 2, p.y - 3 + k, 2, 1, c); rect(ctx, p.x + 16 + k * 2, p.y + 10 - k, 2, 1, c); }
  }
}
function drawEShot(s) {
  if (s.type === 'beam') { rect(ctx, s.x, s.y, s.w, s.h, (G.t & 2) ? 'g' : '3'); return; }
  rect(ctx, s.x, s.y, 4, 4, (s.t >> 2) & 1 ? '5' : '7');
  rect(ctx, s.x + 1, s.y + 1, 2, 2, '3');
}
function drawFx() {
  for (const f of G.fx) {
    if (f.type === 'boom') {
      const p = f.t / f.life, rad = f.r * (0.35 + 0.65 * p), c = p < 0.2 ? '3' : p < 0.45 ? '7' : p < 0.7 ? '6' : '4';
      if (p < 0.5) { disc(ctx, f.x, f.y, rad, c); disc(ctx, f.x, f.y, rad * 0.5, p < 0.3 ? '3' : '7'); }
      else { oval(ctx, f.x, f.y, rad, rad, c); oval(ctx, f.x, f.y, rad - 2, rad - 2, '4'); }
    } else if (f.type === 'deb') rect(ctx, f.x, f.y, 1, 1, f.c);
    else if (f.type === 'spark') rect(ctx, f.x - 1, f.y - 1, 2, 2, (f.t & 1) ? 'c' : '3');
    else if (f.type === 'text') drawText(ctx, f.text, f.x, f.y, f.c, { adv: 6 });
  }
}
function drawHUD() {
  const p = G.player;
  rect(ctx, 0, PLAY_H, SCREEN_W, SCREEN_H - PLAY_H, '0');
  rect(ctx, 0, PLAY_H, SCREEN_W, 1, 'a');
  let x = 2;
  for (let i = 0; i < 6; i++) {
    const lab = SLOT_LABELS[i], w = textWidth(lab, 6) + 4, sel = p.cursor === i, max = slotMaxed(p, i);
    rect(ctx, x, PLAY_H + 2, w, 9, sel ? ((G.t >> 3) & 1 ? '5' : '4') : 'a');
    drawText(ctx, lab, x + 2, PLAY_H + 3, sel ? '7' : max ? '1' : 'g', { adv: 6 });
    const lv = slotLevel(p, i);
    for (let k = 0; k < lv; k++) rect(ctx, x + 1 + k * 3, PLAY_H + 11, 2, 1, '7');
    x += w + 1;
  }
  spr(ctx, SPR.mini, 212, PLAY_H + 4);
  drawText(ctx, 'X' + pad0(Math.min(G.lives, 99), 2), 224, PLAY_H + 3, '3', { adv: 6 });
  const y2 = PLAY_H + 13;
  drawText(ctx, '1P', 2, y2, '5', { adv: 6 });
  drawText(ctx, pad0(G.score, 7), 16, y2, '3', { adv: 6 });
  drawText(ctx, 'HI', 64, y2, '6', { adv: 6 });
  drawText(ctx, pad0(G.hi, 7), 78, y2, '3', { adv: 6 });
  drawText(ctx, 'ST' + (G.stage + 1) + (G.loop ? '.' + (G.loop + 1) : ''), 124, y2, 'c', { adv: 6 });
  drawText(ctx, modeLabel(p), 156, y2, '7', { adv: 6 });
  drawText(ctx, 'G', 222, y2, G.cheats.inf ? '7' : '1', { adv: 6 });
  drawText(ctx, 'H', 230, y2, G.cheats.keep ? '7' : '1', { adv: 6 });
  if (G.gHold > 0 && G.gHold < 60) rect(ctx, 222, y2 - 2, Math.round(G.gHold / 60 * 13), 1, '7');
  if (SND.muted) drawText(ctx, 'M', 240, y2, '5', { adv: 6 });
}
function drawOverlayText() {
  G.msgs.forEach((m, i) => { if (m.t > 30 || (m.t & 4)) drawText(ctx, m.text, SCREEN_W / 2, 24 + i * 11, m.color, { center: true, shadow: '0' }); });
  if (G.banner) {
    drawText(ctx, G.banner.l1, SCREEN_W / 2, 78, '3', { center: true, scale: 2, shadow: '4' });
    if (G.banner.l2) drawText(ctx, G.banner.l2, SCREEN_W / 2, 100, '7', { center: true, shadow: '0' });
  }
  if (G.bossWarn > 0 && (G.t & 16)) {
    drawText(ctx, 'WARNING!', SCREEN_W / 2, 80, '5', { center: true, scale: 2, shadow: '0' });
    drawText(ctx, 'A HUGE BATTLESHIP APPROACHES', SCREEN_W / 2, 102, '3', { center: true, adv: 7 });
  }
  if (G.bonus) drawText(ctx, 'BONUS ' + pad0(G.bonus.t / 60, 2), SCREEN_W - 4 - textWidth('BONUS 00', 6), 4, '7', { adv: 6 });
  if (G.paused) {
    rect(ctx, 80, 84, 96, 22, '0');
    drawText(ctx, 'PAUSE', SCREEN_W / 2, 92, '3', { center: true });
  }
}
function renderWorld() {
  const L = G.level;
  rect(ctx, 0, 0, SCREEN_W, PLAY_H, G.bonus ? 'p' : L.bg);
  drawStars();
  G.items.forEach(drawItem);
  if (!G.bonus) drawTerrain();
  for (const e of G.enemies) {
    if (e.flash > 0 && (G.t & 1) && !e.boss) continue;
    EN[e.kind].draw(e, ctx);
  }
  G.shots.forEach(drawShot);
  drawPlayer();
  G.eshots.forEach(drawEShot);
  drawFx();
  if (G.flashT > 0 && (G.flashT & 2)) { ctx.globalAlpha = 0.6; rect(ctx, 0, 0, SCREEN_W, PLAY_H, '3'); ctx.globalAlpha = 1; }
  drawOverlayText();
  drawHUD();
}

let logo = null, logoSmall = null;
function renderTitle() {
  if (!logo) { logo = makeLogo('SCC STRIKE', 3, ['7', '7', '6', '6', '5', '5', '4']); logoSmall = makeLogo('MSX2', 2, ['g', 'b', 'a']); }
  rect(ctx, 0, 0, SCREEN_W, SCREEN_H, '0');
  drawStars();
  spr(ctx, logoSmall, (SCREEN_W - logoSmall.width) / 2, 12);
  spr(ctx, logo, (SCREEN_W - logo.width) / 2, 32);
  drawText(ctx, 'A NEMESIS SERIES TRIBUTE', SCREEN_W / 2, 60, 'g', { center: true });
  const sx = (G.t * 1.5) % (SCREEN_W + 80) - 40;
  spr(ctx, SPR.ship[(G.t >> 2) & 1], sx, 72);
  for (let i = 0; i < 2; i++) spr(ctx, SPR.option[(G.t >> 2) & 1], sx - 14 - i * 14, 72 + Math.sin(G.t * 0.1 + i) * 3);
  if ((G.t >> 5) & 1) drawText(ctx, 'PUSH SPACE KEY', SCREEN_W / 2, 92, '3', { center: true });
  drawText(ctx, 'STAGE SELECT  < ' + (G.selStage + 1) + ' >', SCREEN_W / 2, 108, '7', { center: true });
  drawText(ctx, 'ARROWS MOVE   Z/SPACE SHOT', SCREEN_W / 2, 126, 'j', { center: true, adv: 7 });
  drawText(ctx, 'X POWER-UP   C WEAPON SWITCH', SCREEN_W / 2, 136, 'j', { center: true, adv: 7 });
  drawText(ctx, 'P PAUSE   M MUTE', SCREEN_W / 2, 146, 'j', { center: true, adv: 7 });
  drawText(ctx, 'CHEATS: HOLD G / H / J', SCREEN_W / 2, 160, '2', { center: true, adv: 7 });
  drawText(ctx, 'HI-SCORE ' + pad0(G.hi, 7), SCREEN_W / 2, 176, '6', { center: true });
  if (G.konami) drawText(ctx, '30 SHIPS!', SCREEN_W / 2, 186, (G.t & 8) ? '5' : '7', { center: true });
  drawText(ctx, 'FAN GAME - NOT AFFILIATED WITH KONAMI', SCREEN_W / 2, 200, '1', { center: true, adv: 6 });
}
function renderGameOver() {
  rect(ctx, 0, 0, SCREEN_W, SCREEN_H, '0');
  drawStars();
  drawText(ctx, 'GAME OVER', SCREEN_W / 2, 70, '5', { center: true, scale: 2, shadow: '4' });
  drawText(ctx, 'SCORE ' + pad0(G.score, 7), SCREEN_W / 2, 104, '3', { center: true });
  drawText(ctx, 'HI    ' + pad0(G.hi, 7), SCREEN_W / 2, 116, '6', { center: true });
  if (G.goT > 90 && (G.t & 32)) drawText(ctx, 'PUSH SPACE KEY', SCREEN_W / 2, 150, '3', { center: true });
}
function renderEnding() {
  rect(ctx, 0, 0, SCREEN_W, SCREEN_H, '0');
  drawStars();
  const lines = [['CONGRATULATIONS!', '7'], ['', ''], ['THE GRAND CORE AND THE', '3'], ['GORGON EYE ARE DESTROYED.', '3'], ['', ''],
    ['BUT THE NEMESIS FLEET', 'g'], ['WILL RETURN...', 'g'], ['', ''], ['SCORE ' + pad0(G.score, 7), '6']];
  lines.forEach(([l, c], i) => { if (G.endT > i * 12) drawText(ctx, l, SCREEN_W / 2, 30 + i * 13, c, { center: true }); });
  if (G.endT > 120 && (G.t & 32)) drawText(ctx, 'PUSH SPACE FOR NEXT LOOP', SCREEN_W / 2, 170, '3', { center: true });
}
function render() {
  if (G.state === 'title') renderTitle();
  else if (G.state === 'gameover') renderGameOver();
  else if (G.state === 'ending') renderEnding();
  else renderWorld();
}

// --- boot -----------------------------------------------------------------------
function fit() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_W, innerHeight / SCREEN_H)));
  canvas.style.width = SCREEN_W * s + 'px';
  canvas.style.height = SCREEN_H * s + 'px';
}
addEventListener('resize', fit);
fit();
initSprites();
G.player = newPlayer();
toTitle();
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
