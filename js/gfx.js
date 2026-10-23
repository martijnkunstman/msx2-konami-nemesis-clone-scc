'use strict';
// ---------------------------------------------------------------------------
// MSX2-style graphics: 256x212 screen, 3-bit-per-channel palette (512 colours),
// pixel-art sprites defined as strings, 5x7 bitmap font.
// ---------------------------------------------------------------------------
const SCREEN_W = 256, SCREEN_H = 212, PLAY_H = 192, TILE = 8, ROWS = 24;

function msxRGB(r, g, b) {
  const c = v => Math.round(v * 255 / 7);
  return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
}

// Every colour below is reachable on a real MSX2 VDP (V9938) palette.
const PAL = {
  '0': msxRGB(0, 0, 0), '1': msxRGB(2, 2, 2), '2': msxRGB(4, 4, 4), '3': msxRGB(7, 7, 7),
  '4': msxRGB(4, 0, 0), '5': msxRGB(7, 1, 1), '6': msxRGB(7, 4, 0), '7': msxRGB(7, 7, 2),
  '8': msxRGB(0, 3, 0), '9': msxRGB(2, 6, 2), 'a': msxRGB(0, 0, 4), 'b': msxRGB(2, 3, 7),
  'c': msxRGB(3, 7, 7), 'd': msxRGB(6, 2, 6), 'e': msxRGB(4, 2, 1), 'f': msxRGB(7, 5, 4),
  'g': msxRGB(5, 6, 7), 'h': msxRGB(3, 1, 5), 'i': msxRGB(7, 7, 5), 'j': msxRGB(5, 5, 5),
  'k': msxRGB(1, 1, 2), 'l': msxRGB(6, 3, 4), 'm': msxRGB(3, 1, 2), 'n': msxRGB(5, 1, 3),
  'o': msxRGB(1, 0, 1), 'p': msxRGB(0, 1, 2),
};
const pc = c => PAL[c] || c;

// --- drawing helpers --------------------------------------------------------
function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = pc(c);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function disc(ctx, cx, cy, r, c) {
  ctx.fillStyle = pc(c);
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3);
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}
function oval(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = pc(c);
  const n = Math.max(12, Math.round((rx + ry) * 1.8));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}
function spr(ctx, img, x, y) { ctx.drawImage(img, Math.round(x), Math.round(y)); }

// --- sprites ----------------------------------------------------------------
function makeSprite(rows, swap) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      let ch = rows[y][x];
      if (swap && swap[ch]) ch = swap[ch];
      if (ch === '.' || ch === ' ' || !PAL[ch]) continue;
      cx.fillStyle = PAL[ch];
      cx.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}
function flipped(cv, h, v) {
  const o = document.createElement('canvas');
  o.width = cv.width; o.height = cv.height;
  const cx = o.getContext('2d');
  cx.translate(h ? cv.width : 0, v ? cv.height : 0);
  cx.scale(h ? -1 : 1, v ? -1 : 1);
  cx.drawImage(cv, 0, 0);
  return o;
}

const SHIP_ROWS = [
  '....jj..........',
  '...jg3j.........',
  '..1jjjjj3.......',
  'xx6bbgjjjjj33...',
  'x6bbbbbjjjjjjj3c',
  '..1jjjjjj1111...',
  '...j11j.........',
  '....11..........',
];
const OPTION_ROWS = [
  '..4554..',
  '.456654.',
  '456xx654',
  '56xxxx65',
  '56xxxx65',
  '456xx654',
  '.456654.',
  '..4554..',
];
const CAPSULE_ROWS = [
  '..2222..',
  '.2xxxx2.',
  '2xx3xxx2',
  '2x3xxxx2',
  '2xxxxxy2',
  '2xxxxyy2',
  '.2yyyy2.',
  '..2222..',
];
const FAN_A = [
  '...cc...',
  '..cbbc..',
  '.cb33bc.',
  'cb3003bc',
  'cb3003bc',
  '.cb33bc.',
  '..cbbc..',
  '...cc...',
];
const FAN_B = [
  'c......c',
  '.cb..bc.',
  '..b33b..',
  '..3003..',
  '..3003..',
  '..b33b..',
  '.cb..bc.',
  'c......c',
];
const RUGAL_ROWS = [
  '......99....',
  '....998899..',
  '..9988888899',
  '993388888889',
  '990088888889',
  '..9988888899',
  '....998899..',
  '......99....',
];
const DUCKER_A = [
  '...2222...',
  '..2jjjj2..',
  '22jj3jjj2.',
  '2jjjjjjj2.',
  '.2222222..',
  '..1...1...',
  '.1.....1..',
  '1.......1.',
];
const DUCKER_B = [
  '...2222...',
  '..2jjjj2..',
  '22jj3jjj2.',
  '2jjjjjjj2.',
  '.2222222..',
  '...1.1....',
  '...1.1....',
  '..1...1...',
];
const TURRET_ROWS = [
  '...11...',
  '..1jj1..',
  '.1j33j1.',
  '1jjjjjj1',
  '1j2222j1',
  '12111121',
  '11111111',
  '1.1..1.1',
];
const MINI_ROWS = [
  '..3.......',
  '.jj3......',
  '6bjjj33c..',
  '.jj11.....',
  '..1.......',
];
const TILESETS = {
  1: {
    inner: ['eeee4eee', 'e44eeee4', 'eeeeeeee', '4ee1ee4e', 'ee4eeeee', 'eeeee44e', 'e4eeeeee', 'eeee1ee4'],
    inner2: ['ee4eeeee', 'eeeeee4e', '4eeeeeee', 'eee44eee', 'eeeeeee4', 'e1eeeeee', 'eeee4eee', '4eeeeeee'],
    up: ['9.99..9.', '99999999', '89989998', 'e88e88e8', 'eeee4eee', 'e4eeeee4', 'eee1eeee', '4eeee4ee'],
  },
  2: {
    inner: ['llnlllml', 'lnnllmll', 'llllnlll', 'mlllnnll', 'llmllllm', 'llnllnll', 'lllmllll', 'nllllnll'],
    inner2: ['lllnllll', 'llnnllml', 'mlllllll', 'lllmllnl', 'nlllllnl', 'llllmlll', 'llnlllll', 'mllnllll'],
    up: ['.nn..nn.', 'nffnnffn', 'lllllfll', 'lnllllnl', 'llmllllm', 'llnllnll', 'lllmllll', 'nllllnll'],
  },
};
const CELL_ROWS = [
  '.dddddd.',
  'dff3llld',
  'df3llllm',
  'dlllllld',
  'dlllllmd',
  'dlllllmd',
  'dmllmmmd',
  '.dmmmmd.',
];

const SPR = {};
function initSprites() {
  SPR.ship = [makeSprite(SHIP_ROWS, { x: '6' }), makeSprite(SHIP_ROWS, { x: '7' })];
  SPR.option = [makeSprite(OPTION_ROWS, { x: '7' }), makeSprite(OPTION_ROWS, { x: '3' })];
  SPR.cap = makeSprite(CAPSULE_ROWS, { x: '5', y: '4' });
  SPR.capB = makeSprite(CAPSULE_ROWS, { x: 'b', y: 'a' });
  SPR.capG = makeSprite(CAPSULE_ROWS, { x: '9', y: '8' });
  SPR.capO = makeSprite(CAPSULE_ROWS, { x: '6', y: '4' });
  SPR.fan = [makeSprite(FAN_A), makeSprite(FAN_B)];
  SPR.fan2 = [makeSprite(FAN_A, { b: 'd', c: 'l' }), makeSprite(FAN_B, { b: 'd', c: 'l' })];
  SPR.rugal = [makeSprite(RUGAL_ROWS), makeSprite(RUGAL_ROWS, { '3': '7' })];
  SPR.rugal2 = [makeSprite(RUGAL_ROWS, { '9': 'd', '8': 'h' }), makeSprite(RUGAL_ROWS, { '9': 'd', '8': 'h', '3': '7' })];
  SPR.rugalRed = [makeSprite(RUGAL_ROWS, { '9': '6', '8': '5' }), makeSprite(RUGAL_ROWS, { '9': '7', '8': '5' })];
  const dk = [makeSprite(DUCKER_A), makeSprite(DUCKER_B)];
  // [ground][facingRight][frame]
  SPR.ducker = {
    floor: [dk, dk.map(s => flipped(s, true, false))],
    ceil: [dk.map(s => flipped(s, false, true)), dk.map(s => flipped(s, true, true))],
  };
  SPR.turret = makeSprite(TURRET_ROWS);
  SPR.turretC = flipped(SPR.turret, false, true);
  SPR.mini = makeSprite(MINI_ROWS);
  SPR.tiles = {};
  for (const k of Object.keys(TILESETS)) {
    const t = TILESETS[k];
    const up = makeSprite(t.up);
    SPR.tiles[k] = { inner: makeSprite(t.inner), inner2: makeSprite(t.inner2), up, down: flipped(up, false, true) };
  }
  SPR.cell = [makeSprite(CELL_ROWS), makeSprite(CELL_ROWS, { l: 'n' })];
}

// --- 5x7 font (MSX-like) ---------------------------------------------------
const FONT = {
  '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E], '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F], '3': [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02], '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E], '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E], '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11], 'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E], 'D': [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
  'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F], 'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F], 'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E], 'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], 'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11], 'N': [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D], 'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  'S': [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E], 'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A], 'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x11, 0x0A, 0x04, 0x04, 0x04], 'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0x0C, 0x0C], ',': [0, 0, 0, 0, 0x0C, 0x04, 0x08],
  ':': [0, 0x0C, 0x0C, 0, 0x0C, 0x0C, 0], '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0E, 0x11, 0x01, 0x02, 0x04, 0, 0x04], '-': [0, 0, 0, 0x1F, 0, 0, 0],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10], "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '%': [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03], '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08], '+': [0, 0x04, 0x04, 0x1F, 0x04, 0x04, 0],
  '=': [0, 0, 0x1F, 0, 0x1F, 0, 0], '*': [0, 0x04, 0x15, 0x0E, 0x15, 0x04, 0],
  '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08], '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  '#': [0x0A, 0x0A, 0x1F, 0x0A, 0x1F, 0x0A, 0x0A], '"': [0x0A, 0x0A, 0, 0, 0, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 0x1F],
};
const glyphCache = {};
function glyph(ch, color) {
  const key = ch + '|' + color;
  if (glyphCache[key]) return glyphCache[key];
  const rows = FONT[ch];
  if (!rows) return null;
  const g = document.createElement('canvas');
  g.width = 5; g.height = 7;
  const x = g.getContext('2d');
  x.fillStyle = pc(color);
  rows.forEach((bits, y) => { for (let i = 0; i < 5; i++) if (bits & (16 >> i)) x.fillRect(i, y, 1, 1); });
  return (glyphCache[key] = g);
}
function textWidth(str, adv = 8, sc = 1) { return (String(str).length * adv - (adv - 5)) * sc; }
function drawText(ctx, str, x, y, color = '3', o = {}) {
  str = String(str).toUpperCase();
  const adv = o.adv || 8, sc = o.scale || 1;
  if (o.center) x = Math.round(x - textWidth(str, adv, sc) / 2);
  if (o.shadow) drawText(ctx, str, x + sc, y + sc, o.shadow, { adv, scale: sc });
  for (let i = 0; i < str.length; i++) {
    const g = glyph(str[i], color);
    if (g) ctx.drawImage(g, x + i * adv * sc, y, 5 * sc, 7 * sc);
  }
}
// Text with MSX "raster bar" colour gradient, used for the logo.
function makeLogo(str, scale, colors) {
  const w = textWidth(str, 8, scale), h = 7 * scale;
  const cv = document.createElement('canvas');
  cv.width = w + scale; cv.height = h + scale;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = false;
  drawText(cx, str, scale, scale, '1', { scale });
  const fg = document.createElement('canvas');
  fg.width = cv.width; fg.height = cv.height;
  const fx = fg.getContext('2d');
  fx.imageSmoothingEnabled = false;
  const band = h / colors.length;
  colors.forEach((c, i) => { fx.fillStyle = pc(c); fx.fillRect(0, Math.floor(i * band), fg.width, Math.ceil(band)); });
  fx.globalCompositeOperation = 'destination-in';
  drawText(fx, str, 0, 0, '3', { scale });
  cx.drawImage(fg, 0, 0);
  return cv;
}
