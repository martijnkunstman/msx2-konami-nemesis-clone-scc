'use strict';
// ---------------------------------------------------------------------------
// Level data: terrain is stored per 8px column as ceiling/floor heights (in
// tiles) plus a grid of destructible, regrowing cells. Spawns trigger when
// their column scrolls into view.
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function newTerrain(N) {
  return { N, ceil: new Uint8Array(N), floor: new Uint8Array(N), cells: new Uint8Array(N * ROWS), warp: new Uint8Array(N) };
}
function walkHeights(rnd, arr, a, b, min, max, h, every) {
  for (let c = a; c < b; c++) {
    if ((c - a) % every === 0) h += rnd() < 0.5 ? -1 : 1;
    h = Math.max(min, Math.min(max, h));
    arr[c] = h;
  }
  return h;
}
function ramp(arr, a, b, from, to) {
  for (let c = a; c < b; c++) arr[c] = Math.round(from + (to - from) * (c - a) / (b - a));
}
function keepGap(T, minGap) {
  for (let c = 0; c < T.N; c++) {
    while (T.ceil[c] + T.floor[c] > ROWS - minGap) {
      if (T.ceil[c] > T.floor[c]) T.ceil[c]--; else T.floor[c]--;
    }
  }
}
function volcano(arr, c0) {
  for (let d = -7; d <= 7; d++) arr[c0 + d] = Math.max(arr[c0 + d], 2 + 7 - Math.abs(d));
}
function cellWall(T, c0, w) {
  for (let c = c0; c < c0 + w; c++)
    for (let r = T.ceil[c]; r < ROWS - T.floor[c]; r++) T.cells[c * ROWS + r] = 3;
}

// --- Stage 1: Volcanic Frontier (classic Gradius/Nemesis planet surface) ----
function buildStage1() {
  const T = newTerrain(640), rnd = mulberry32(1985);
  ramp(T.floor, 40, 52, 0, 3);
  walkHeights(rnd, T.floor, 52, 206, 2, 6, 3, 3);
  ramp(T.ceil, 206, 216, 0, 3);
  walkHeights(rnd, T.ceil, 216, 386, 2, 6, 3, 3);
  walkHeights(rnd, T.floor, 206, 386, 2, 6, T.floor[205], 3);
  ramp(T.ceil, 386, 392, T.ceil[385], 3);
  ramp(T.floor, 386, 392, T.floor[385], 3);
  for (let c = 392; c < 496; c++) { T.ceil[c] = 3; T.floor[c] = 3; }
  ramp(T.ceil, 496, 520, 3, 0);
  ramp(T.floor, 496, 520, 3, 0);
  keepGap(T, 10);
  volcano(T.floor, 100); volcano(T.floor, 160);
  volcano(T.ceil, 420); volcano(T.ceil, 468);
  // Secret: a pit in the cave floor leads to the bonus stage.
  T.floor[329] = Math.max(T.floor[329], 4); T.floor[334] = Math.max(T.floor[334], 4);
  for (let c = 330; c < 334; c++) { T.floor[c] = 0; T.warp[c] = 1; }

  const sq = (c, kind, y, pat, n = 5) => ({ c, t: 'squad', kind, n, y, pat });
  const spawns = [
    sq(36, 'fan', 50, 'fan'), sq(44, 'fan', 130, 'fan'), { c: 52, t: 'redrugal', y: 80 },
    { c: 58, t: 'turret' }, sq(62, 'rugal', 60, 'wave', 4), { c: 70, t: 'ducker' }, { c: 76, t: 'ducker' },
    sq(84, 'fan', 40, 'fan'), { c: 100, t: 'volcano' }, { c: 112, t: 'redrugal', y: 40 },
    sq(120, 'rugal', 50, 'wave'), { c: 130, t: 'turret' }, { c: 138, t: 'turret' },
    sq(146, 'fan', 30, 'fan'), { c: 160, t: 'volcano' }, { c: 176, t: 'ducker' }, { c: 181, t: 'ducker' },
    sq(190, 'fan', 40, 'fan'), { c: 200, t: 'redrugal', y: 60 },
    { c: 220, t: 'hatch' }, { c: 228, t: 'hatch', g: 'c' }, { c: 234, t: 'ducker', g: 'c' }, { c: 240, t: 'ducker' },
    sq(248, 'rugal', 90, 'wave'), { c: 255, t: 'turret', g: 'c' }, { c: 262, t: 'turret' },
    { c: 266, t: 'hidden' }, { c: 275, t: 'redrugal', y: 100 }, { c: 285, t: 'hatch' }, { c: 292, t: 'hatch', g: 'c' },
    sq(300, 'fan', 90, 'fan'), { c: 310, t: 'ducker' }, { c: 315, t: 'ducker' }, { c: 319, t: 'ducker', g: 'c' },
    { c: 326, t: 'redrugal', y: 90 }, sq(345, 'rugal', 80, 'wave'), { c: 360, t: 'hatch' },
    sq(372, 'fan', 100, 'fan'), { c: 380, t: 'redrugal', y: 96 },
    sq(400, 'fan', 80, 'fan'), { c: 420, t: 'volcano', g: 'c' }, sq(440, 'rugal', 110, 'wave'),
    { c: 450, t: 'turret' }, { c: 456, t: 'turret' }, { c: 468, t: 'volcano', g: 'c' }, { c: 485, t: 'redrugal', y: 96 },
    sq(505, 'fan', 60, 'fan'), sq(515, 'fan', 130, 'fan'), sq(525, 'rugal', 90, 'wave'),
    { c: 535, t: 'redrugal', y: 70 }, sq(545, 'fan', 96, 'fan'),
  ];
  return {
    id: 1, theme: 1, name: 'VOLCANIC FRONTIER', song: 'stage1', bg: '0', T, spawns,
    bossScroll: 560 * TILE, boss: 'boss1', bossName: 'GRAND CORE', warpTo: 372,
  };
}

// --- Stage 2: Bio Hive (Salamander / Nemesis 3 organic stage) --------------
function buildStage2() {
  const T = newTerrain(620), rnd = mulberry32(1988);
  for (let c = 30; c < 160; c++) {
    const k = Math.min(1, (c - 30) / 10);
    T.ceil[c] = Math.round(k * (4 + 2 * Math.sin(c / 6) + (rnd() < 0.3 ? 1 : 0)));
    T.floor[c] = Math.round(k * (4 + 2 * Math.sin(c / 8 + 1.5) + (rnd() < 0.3 ? 1 : 0)));
  }
  for (let c = 160; c < 270; c++) { T.ceil[c] = 3; T.floor[c] = 3; }
  for (let c = 270; c < 370; c++) { T.ceil[c] = 4; T.floor[c] = 4; }
  walkHeights(rnd, T.ceil, 370, 500, 3, 7, 4, 4);
  walkHeights(rnd, T.floor, 370, 500, 3, 7, 4, 4);
  ramp(T.ceil, 500, 520, T.ceil[499], 0);
  ramp(T.floor, 500, 520, T.floor[499], 0);
  keepGap(T, 9);
  cellWall(T, 178, 2); cellWall(T, 204, 2); cellWall(T, 230, 3);
  // Secret: a blob of cells hanging from the ceiling hides an extra life.
  for (let c = 248; c < 256; c++) for (let r = 3; r < 9; r++) T.cells[c * ROWS + r] = 3;

  const sq = (c, kind, y, pat, n = 5) => ({ c, t: 'squad', kind, n, y, pat });
  const spawns = [
    sq(20, 'fan', 70, 'fan'), { c: 28, t: 'bubble', y: 60 }, { c: 34, t: 'bubble', y: 120 },
    { c: 45, t: 'tentacle' }, { c: 58, t: 'tentacle', g: 'c' }, sq(66, 'zub', 96, 'wave', 6),
    { c: 75, t: 'redrugal', y: 96 }, { c: 80, t: 'bubble', y: 90 }, { c: 88, t: 'tentacle' },
    { c: 96, t: 'pod', g: 'c' }, { c: 104, t: 'tentacle', g: 'c' }, { c: 112, t: 'bubble', y: 70 },
    { c: 118, t: 'bubble', y: 120 }, { c: 126, t: 'redrugal', y: 90 }, { c: 136, t: 'pod' },
    sq(144, 'fan', 90, 'fan'), { c: 150, t: 'tentacle' },
    { c: 165, t: 'bubble', y: 90 }, sq(185, 'fan', 96, 'fan'), { c: 192, t: 'redrugal', y: 70 },
    { c: 210, t: 'bubble', y: 60 }, { c: 216, t: 'bubble', y: 120 }, sq(238, 'rugal', 110, 'wave'),
    { c: 251, t: 'item', item: '1up', row: 5 }, { c: 262, t: 'redrugal', y: 100 },
    { c: 285, t: 'stonehead' }, { c: 300, t: 'stonehead', g: 'c' }, sq(310, 'fan', 96, 'fan'),
    { c: 325, t: 'stonehead' }, { c: 335, t: 'redrugal', y: 96 }, { c: 345, t: 'stonehead', g: 'c' },
    sq(360, 'rugal', 90, 'wave'),
    { c: 380, t: 'pod' }, { c: 395, t: 'pod', g: 'c' }, { c: 405, t: 'bubble', y: 96 }, { c: 415, t: 'tentacle' },
    { c: 430, t: 'redrugal', y: 96 }, { c: 440, t: 'pod', g: 'c' }, { c: 455, t: 'tentacle', g: 'c' },
    { c: 465, t: 'bubble', y: 90 }, sq(475, 'zub', 96, 'wave', 6), { c: 490, t: 'redrugal', y: 90 },
    sq(510, 'fan', 60, 'fan'), sq(520, 'fan', 130, 'fan'), { c: 530, t: 'bubble', y: 96 },
  ];
  return {
    id: 2, theme: 2, name: 'BIO HIVE', song: 'stage2', bg: 'o', T, spawns,
    bossScroll: 545 * TILE, boss: 'boss2', bossName: 'GORGON EYE', warpTo: 0,
  };
}
function buildLevel(i) { return i === 0 ? buildStage1() : buildStage2(); }

// --- terrain queries (screen coordinates) -----------------------------------
function colAt(x) { return Math.floor((x + G.scrollX) / TILE); }
// 0 = empty, 1 = rock, 2 = destructible cell
function terrainAt(x, y) {
  if (G.bonus || !G.level) return 0;
  const T = G.level.T, c = colAt(x), r = Math.floor(y / TILE);
  if (c < 0 || c >= T.N || r < 0 || r >= ROWS) return 0;
  if (r < T.ceil[c] || r >= ROWS - T.floor[c]) return 1;
  return T.cells[c * ROWS + r] > 0 ? 2 : 0;
}
function solidAt(x, y) { return terrainAt(x, y) !== 0; }
function ceilY(x) {
  if (G.bonus) return 0;
  const T = G.level.T, c = colAt(x);
  return (c >= 0 && c < T.N ? T.ceil[c] : 0) * TILE;
}
function floorY(x) {
  if (G.bonus) return PLAY_H;
  const T = G.level.T, c = colAt(x);
  return PLAY_H - (c >= 0 && c < T.N ? T.floor[c] : 0) * TILE;
}
function safeY(x) { return (ceilY(x) + floorY(x)) / 2; }
