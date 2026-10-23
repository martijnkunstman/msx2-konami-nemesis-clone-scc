'use strict';
// ---------------------------------------------------------------------------
// Original compositions in the style of Konami's SCC soundtracks:
// brass lead + delayed echo channel, octave bass, fast arpeggio, organ pad,
// PSG noise drums. Lead melodies are hand-written; accompaniment is derived
// from the chord progressions.
// ---------------------------------------------------------------------------
const CHORD_IV = { '': [0, 4, 7], m: [0, 3, 7] };
function chordMidi(name, oct) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  const root = 12 * (oct + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return CHORD_IV[m[3]].map(i => root + i);
}
const rep = (str, n) => Array(n).fill(str).join(' ');
// pattern: [semitones above root | null for rest, steps]
function bassLine(chords, pattern, oct = 2) {
  return chords.map(ch => {
    const r = chordMidi(ch, oct)[0];
    return pattern.map(([o, d]) => (o === null ? 'r:' + d : 'm' + (r + o) + ':' + d)).join(' ');
  }).join(' ');
}
function arpLine(chords, oct = 5, order = [0, 1, 2, 3]) {
  return chords.map(ch => {
    const n = chordMidi(ch, oct), tones = [n[0], n[1], n[2], n[0] + 12], out = [];
    for (let i = 0; i < 16; i++) out.push('m' + tones[order[i % order.length]] + ':1');
    return out.join(' ');
  }).join(' ');
}
function padLine(chords, oct = 4) {
  return chords.map(ch => { const n = chordMidi(ch, oct); return 'm' + n[1] + ':8 m' + n[2] + ':8'; }).join(' ');
}
const drumLine = (bar, fill, bars) => rep(bar, bars - 1) + ' ' + fill;

// --- Stage 1: "Volcanic Frontier" (A minor, 150 bpm) -----------------------
const S1_CH = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'Dm', 'E', 'F', 'G', 'Am', 'E'];
const S1_LEAD =
  'e5:2 a5:2 b5:2 c6:4 b5:2 a5:2 e5:2  f5:2 a5:2 c6:2 a5:2 f5:2 e5:2 f5:2 a5:2 ' +
  'g5:6 d5:2 g5:2 a5:2 b5:4  b5:6 g5:2 e5:8 ' +
  'e5:2 a5:2 b5:2 c6:4 d6:2 e6:4  f6:4 e6:2 d6:2 c6:4 a5:4 ' +
  'b5:2 c6:2 d6:4 g5:2 a5:2 b5:4  g#5:8 b5:4 e6:4 ' +
  'a5:4 f5:2 d5:2 a5:4 c6:4  e6:6 d6:2 c6:4 b5:4 ' +
  'd6:4 c6:2 a5:2 f5:4 a5:4  g#5:4 a5:2 b5:2 e6:8 ' +
  'c6:2 f6:2 c6:2 a5:2 f6:4 e6:4  d6:2 g6:2 d6:2 b5:2 g6:4 f6:4 ' +
  'e6:4 c6:2 a5:2 e6:4 a6:4  g#6:8 e6:4 b5:4';
const DR1 = 'k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2';
const DR1F = 'k:2 h:2 s:2 h:2 s:1 s:1 s:2 s:1 s:1 s:2';

// --- Stage 2: "Bio Hive" (D minor, 140 bpm, syncopated) --------------------
const S2_CH = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'];
const S2_LEAD =
  'd5:3 f5:3 a5:2 d6:4 c6:2 a5:2  bb5:6 a5:2 f5:4 d5:4 ' +
  'e5:3 g5:3 c6:2 e6:4 d6:2 c6:2  c#6:8 e6:4 a5:4 ' +
  'd6:3 a5:3 f5:2 d6:3 e6:3 f6:2  g6:4 f6:2 d6:2 bb5:4 d6:4 ' +
  'a6:3 g6:3 f6:2 d6:4 bb5:4  a5:4 c#6:4 e6:4 g6:4 ' +
  'f6:4 e6:2 d6:2 a5:8  bb5:2 d6:2 f6:2 d6:2 bb5:2 f5:2 d5:4 ' +
  'g5:4 c6:2 e6:2 g6:4 e6:4  e6:6 c#6:2 a5:8 ' +
  'd6:2 f6:2 a6:4 g6:2 f6:2 e6:4  d6:4 bb5:4 f5:4 bb5:4 ' +
  'g5:2 bb5:2 d6:2 g6:2 f6:4 d6:4  c#6:4 e6:4 a6:8';
const DR2 = 'k:3 k:3 s:2 h:2 k:2 s:2 h:2';
const DR2F = 'k:3 k:3 s:2 s:1 s:1 s:1 s:1 s:2 o:2';

// --- Boss: "Core Alert" (E minor, 165 bpm) ---------------------------------
const B_CH = ['Em', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'];
const B_HEAD = 'e5:2 e5:2 g5:2 e5:2 b5:4 a#5:2 a5:2  g5:2 g5:2 c6:2 g5:2 e6:4 d#6:2 d6:2  f#5:2 a5:2 d6:2 f#6:2 a6:4 f#6:4';
const B_LEAD = B_HEAD + ' d#6:4 f#6:4 b6:8 ' + B_HEAD + ' b5:2 a5:2 g5:2 f#5:2 d#5:8';
const DRB = 'k:2 h:1 h:1 s:2 h:2 k:1 k:1 h:2 s:2 h:2';
const BASS16 = [[0, 1], [0, 1], [12, 1], [0, 1]];

// --- Secret bonus stage (C major, 160 bpm) ---------------------------------
const BON_CH = ['C', 'Am', 'F', 'G'];
const BON_LEAD = 'c6:2 e6:2 g6:2 e6:2 c6:2 e6:2 g6:4  a6:2 e6:2 c6:2 e6:2 a5:4 c6:4  f6:2 a6:2 c7:2 a6:2 f6:4 c6:4  d6:2 g6:2 b6:2 g6:2 f6:4 d6:4';

// --- Title ------------------------------------------------------------------
const T_CH = ['Am', 'F', 'G', 'E'];
const T_LEAD = 'e5:4 a5:4 c6:4 e6:4  f6:8 e6:4 c6:4  d6:4 b5:4 g5:4 b5:4  g#5:8 e6:8';

const LEAD = { wave: 'brass', vol: 0.2, decay: 0.25, sus: 0.6, vib: 10, transpose: -12 };
const ECHO = { echo: 0, delay: 3, wave: 'brass', vol: 0.07, decay: 0.25, sus: 0.6, transpose: -12, detune: 8 };
const BASS = { wave: 'bass', vol: 0.22, decay: 0.08, sus: 0.45, gate: 0.8 };
const ARP = { wave: 'pulse25', vol: 0.05, decay: 0.04, sus: 0.3, gate: 0.6 };
const PAD = { wave: 'organ', vol: 0.06, decay: 0.5, sus: 0.8 };
const trk = (base, extra) => Object.assign({}, base, extra);

const SONGS = {
  title: {
    bpm: 112, loop: true, tracks: [
      trk(LEAD, { wave: 'bell', data: T_LEAD + ' ' + T_LEAD }),
      trk(ECHO, { wave: 'bell', delay: 4 }),
      trk(BASS, { data: bassLine(T_CH.concat(T_CH), [[0, 4], [7, 4], [12, 4], [7, 4]]) }),
      trk(ARP, { data: arpLine(T_CH.concat(T_CH), 5, [0, 1, 2, 3, 2, 1]) }),
      trk(PAD, { data: padLine(T_CH.concat(T_CH)) }),
      { drums: true, vol: 0.3, data: rep('k:4 h:4 s:4 h:4', 8) },
    ],
  },
  stage1: {
    bpm: 150, loop: true, tracks: [
      trk(LEAD, { data: S1_LEAD }),
      trk(ECHO, {}),
      trk(BASS, { data: bassLine(S1_CH, [[0, 2], [12, 2], [0, 2], [12, 2], [0, 2], [12, 2], [0, 2], [12, 2]]) }),
      trk(ARP, { data: arpLine(S1_CH, 5) }),
      trk(PAD, { data: padLine(S1_CH) }),
      { drums: true, vol: 0.45, data: drumLine(DR1, DR1F, 8) + ' ' + drumLine(DR1, DR1F, 8) },
    ],
  },
  stage2: {
    bpm: 140, loop: true, tracks: [
      trk(LEAD, { wave: 'saw', vib: 16, data: S2_LEAD }),
      trk(ECHO, { wave: 'saw', delay: 2, vol: 0.06 }),
      trk(BASS, { data: bassLine(S2_CH, [[0, 3], [0, 3], [12, 2], [0, 2], [7, 2], [10, 2], [12, 2]]) }),
      trk(ARP, { wave: 'pulse12', data: arpLine(S2_CH, 5, [0, 2, 1, 3]) }),
      trk(PAD, { wave: 'vox', vol: 0.05, data: padLine(S2_CH) }),
      { drums: true, vol: 0.45, data: drumLine(DR2, DR2F, 8) + ' ' + drumLine(DR2, DR2F, 8) },
    ],
  },
  boss: {
    bpm: 165, loop: true, tracks: [
      trk(LEAD, { wave: 'square', vib: 6, data: B_LEAD }),
      trk(ECHO, { wave: 'square', delay: 2 }),
      trk(BASS, { data: bassLine(B_CH, [].concat(BASS16, BASS16, BASS16, BASS16)) }),
      trk(ARP, { data: arpLine(B_CH, 5, [3, 2, 1, 0]) }),
      trk(PAD, { wave: 'saw', vol: 0.05, data: padLine(B_CH) }),
      { drums: true, vol: 0.5, data: rep(DRB, 8) },
    ],
  },
  bonus: {
    bpm: 160, loop: true, tracks: [
      trk(LEAD, { wave: 'bell', data: BON_LEAD }),
      trk(ECHO, { wave: 'bell', delay: 3 }),
      trk(BASS, { data: bassLine(BON_CH, [[0, 2], [7, 2], [12, 2], [7, 2], [0, 2], [7, 2], [12, 2], [7, 2]]) }),
      trk(ARP, { data: arpLine(BON_CH, 5) }),
      trk(PAD, { data: padLine(BON_CH) }),
      { drums: true, vol: 0.4, data: rep('k:2 h:2 s:2 h:2', 8) },
    ],
  },
  start: {
    bpm: 150, loop: false, tracks: [
      trk(LEAD, { data: 'e5:2 a5:2 c6:2 e6:6 d6:2 e6:2 a6:12' }),
      trk(LEAD, { vol: 0.12, vib: 0, data: 'c5:2 e5:2 a5:2 c6:6 b5:2 c6:2 e6:12' }),
      trk(BASS, { data: 'a2:6 f2:6 g2:4 a2:12' }),
      { drums: true, vol: 0.45, data: 'k:2 h:2 s:2 h:2 k:2 s:2 k:2 s:1 s:1 x:12' },
    ],
  },
  clear: {
    bpm: 140, loop: false, tracks: [
      trk(LEAD, { data: 'g5:2 c6:2 e6:2 g6:4 e6:2 g6:6 c7:12' }),
      trk(LEAD, { vol: 0.12, vib: 0, data: 'e5:2 g5:2 c6:2 e6:4 c6:2 e6:6 g6:12' }),
      trk(BASS, { data: 'c3:6 g2:6 c3:18' }),
      { drums: true, vol: 0.45, data: 'k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 k:2 x:12' },
    ],
  },
  gameover: {
    bpm: 84, loop: false, tracks: [
      trk(LEAD, { wave: 'bell', data: 'a5:4 g5:4 f5:4 e5:4 d5:4 c5:4 b4:4 a4:16' }),
      trk(BASS, { data: 'a2:8 f2:8 e2:8 a1:16' }),
      trk(PAD, { data: 'c5:8 a4:8 g#4:8 e4:16' }),
    ],
  },
};
