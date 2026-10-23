'use strict';
// ---------------------------------------------------------------------------
// Konami SCC emulation (5 wavetable channels, 32 x 8-bit samples each) plus
// PSG-style square/noise for drums and sound effects, built on Web Audio.
// ---------------------------------------------------------------------------
const SND = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let muted = false, wanted = null, current = null, timer = null;
  const waveCache = {};

  // 32-sample SCC waveforms (signed 8-bit, -128..127).
  const WAVE_FN = {
    saw: n => 127 - n * 8,
    square: n => (n < 16 ? 110 : -110),
    pulse25: n => (n < 8 ? 110 : -110),
    pulse12: n => (n < 4 ? 110 : -110),
    tri: n => (n < 16 ? -120 + n * 15 : 120 - (n - 16) * 15),
    brass: n => 0.6 * (127 - n * 8) + 0.4 * (n < 12 ? 110 : -110),
    bell: n => 80 * Math.sin(2 * Math.PI * n / 32) + 45 * Math.sin(6 * Math.PI * n / 32),
    organ: n => 70 * Math.sin(2 * Math.PI * n / 32) + 40 * Math.sin(4 * Math.PI * n / 32) + 30 * Math.sin(8 * Math.PI * n / 32),
    bass: n => 0.5 * (n < 16 ? 120 : -120) + 0.5 * (127 - n * 8),
    vox: n => (n < 10 ? 120 : n < 20 ? -40 : -100),
  };

  // Turn a 32-step table into a PeriodicWave. The table is upsampled with a
  // zero-order hold first, so the stair-step harmonics that give the SCC its
  // bright, gritty sound are kept.
  function getWave(name) {
    if (waveCache[name]) return waveCache[name];
    const fn = WAVE_FN[name] || WAVE_FN.square;
    const s = [];
    for (let n = 0; n < 32; n++) s.push(Math.max(-128, Math.min(127, Math.round(fn(n)))));
    const UP = 16, M = 32 * UP, H = 160;
    const real = new Float32Array(H), imag = new Float32Array(H);
    for (let k = 1; k < H; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < M; n++) {
        const x = s[(n / UP) | 0] / 128, a = 2 * Math.PI * k * n / M;
        re += x * Math.cos(a); im += x * Math.sin(a);
      }
      real[k] = re * 2 / M; imag[k] = im * 2 / M;
    }
    return (waveCache[name] = ctx.createPeriodicWave(real, imag));
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.45; sfxBus.connect(master);
    // 17-bit LFSR noise, like the AY-3-8910 PSG
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let lfsr = 1, v = 1;
    for (let i = 0; i < d.length; i++) {
      if (i % 3 === 0) {
        const bit = (lfsr ^ (lfsr >> 3)) & 1;
        lfsr = (lfsr >> 1) | (bit << 16);
        v = (lfsr & 1) ? 1 : -1;
      }
      d[i] = v * 0.7;
    }
    if (wanted) play(wanted, true);
  }

  // --- music notation -------------------------------------------------------
  // Tokens: "c#5:2" (note:steps), "r:4" (rest), "m45:2" (MIDI number),
  // "[ ... ]3" (repeat). Drum tracks use k/s/h/o/x. One step = a 16th note.
  const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function parseNote(name, drums) {
    if (name === 'r') return null;
    if (drums) return name;
    if (name[0] === 'm') return +name.slice(1);
    const m = /^([a-g])([#b]?)(\d)$/.exec(name);
    if (!m) return null;
    return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function parseTrack(str, drums) {
    const stack = [[]];
    for (const tok of str.trim().split(/\s+/)) {
      if (tok === '[') { stack.push([]); continue; }
      const m = /^\](\d+)$/.exec(tok);
      if (m) {
        const grp = stack.pop();
        for (let i = 0; i < +m[1]; i++) stack[stack.length - 1].push(...grp);
        continue;
      }
      stack[stack.length - 1].push(tok);
    }
    const events = [];
    let t = 0;
    for (const tok of stack[0]) {
      const [name, durS] = tok.split(':');
      const dur = parseFloat(durS || '1');
      events.push({ t, dur, note: parseNote(name, drums) });
      t += dur;
    }
    return { events, len: t };
  }

  function startTrack(def, defs, t0, step) {
    const src = def.echo !== undefined ? defs[def.echo] : def;
    const parsed = parseTrack(src.data, def.drums);
    const tr = { def, events: parsed.events, len: parsed.len, idx: 0, base: t0 + (def.delay || 0) * step };
    if (!def.drums) {
      tr.osc = ctx.createOscillator();
      tr.osc.setPeriodicWave(getWave(def.wave));
      if (def.detune) tr.osc.detune.value = def.detune;
      tr.gain = ctx.createGain();
      tr.gain.gain.value = 0;
      tr.osc.connect(tr.gain); tr.gain.connect(musicBus);
      tr.osc.start(t0);
      if (def.vib) {
        tr.lfo = ctx.createOscillator(); tr.lfo.frequency.value = 5.5;
        const lg = ctx.createGain(); lg.gain.value = def.vib;
        tr.lfo.connect(lg); lg.connect(tr.osc.detune); tr.lfo.start(t0);
      }
    }
    return tr;
  }

  function playNote(tr, note, t, dur) {
    const d = tr.def, g = tr.gain.gain;
    const freq = 440 * Math.pow(2, (note + (d.transpose || 0) - 69) / 12);
    tr.osc.frequency.setValueAtTime(freq, t);
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(d.vol, t + 0.004);
    g.setTargetAtTime(d.vol * (d.sus ?? 0.6), t + 0.004, d.decay ?? 0.15);
    g.setTargetAtTime(0, t + dur * (d.gate ?? 0.92), 0.012);
  }

  function noiseSrc(t) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.start(t, Math.random() * 1.5);
    return s;
  }
  function drum(name, t, vol, bus) {
    if (name === 'k') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.2);
      return;
    }
    const spec = {
      s: { type: 'bandpass', f: 1800, dur: 0.14, v: 0.8 },
      h: { type: 'highpass', f: 7000, dur: 0.035, v: 0.45 },
      o: { type: 'highpass', f: 6000, dur: 0.18, v: 0.4 },
      x: { type: 'highpass', f: 3500, dur: 0.7, v: 0.5 },
    }[name];
    if (!spec) return;
    const s = noiseSrc(t), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = spec.type; f.frequency.value = spec.f;
    g.gain.setValueAtTime(vol * spec.v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + spec.dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.stop(t + spec.dur + 0.05);
    if (name === 's') {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
      og.gain.setValueAtTime(vol * 0.5, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.1);
    }
  }

  function schedule() {
    if (!current) return;
    const horizon = ctx.currentTime + 0.15, step = current.step;
    for (const tr of current.tracks) {
      for (;;) {
        if (tr.idx >= tr.events.length) {
          if (!current.song.loop) break;
          tr.idx = 0; tr.base += tr.len * step;
        }
        const ev = tr.events[tr.idx], t = tr.base + ev.t * step;
        if (t > horizon) break;
        if (ev.note !== null) {
          if (tr.def.drums) drum(ev.note, t, tr.def.vol, musicBus);
          else playNote(tr, ev.note, t, ev.dur * step);
        }
        tr.idx++;
      }
    }
  }

  function stop() {
    wanted = null;
    if (timer) { clearInterval(timer); timer = null; }
    if (!current || !ctx) { current = null; return; }
    const now = ctx.currentTime;
    for (const tr of current.tracks) {
      if (!tr.osc) continue;
      tr.gain.gain.cancelScheduledValues(now);
      tr.gain.gain.setTargetAtTime(0, now, 0.01);
      tr.osc.stop(now + 0.1);
      if (tr.lfo) tr.lfo.stop(now + 0.1);
    }
    current = null;
  }

  function play(name, force) {
    if (!force && current && current.name === name && current.song.loop) return;
    stop();
    wanted = name;
    if (!ctx || ctx.state === 'closed') return;
    const song = SONGS[name];
    if (!song) return;
    const step = 60 / song.bpm / 4, t0 = ctx.currentTime + 0.06;
    current = { name, song, step, tracks: song.tracks.map(d => startTrack(d, song.tracks, t0, step)) };
    schedule();
    timer = setInterval(schedule, 25);
  }

  // --- sound effects (PSG style) -------------------------------------------
  function tone(f0, f1, dur, type = 'square', vol = 0.2, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, f0 = 3000, f1 = 300, delay = 0, type = 'lowpass') {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = noiseSrc(t), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.stop(t + dur + 0.05);
  }
  const seq = (notes, len, type, vol) => notes.forEach((f, i) => tone(f, f, len, type, vol, i * len));
  const sfx = {
    shoot() { tone(1400, 700, 0.05, 'square', 0.06); },
    laser() { tone(2200, 1400, 0.09, 'square', 0.06); tone(1100, 700, 0.09, 'square', 0.04); },
    ripple() { tone(500, 1500, 0.12, 'triangle', 0.14); },
    fire() { noise(0.12, 0.18, 1500, 300); tone(300, 120, 0.1, 'square', 0.05); },
    missile() { noise(0.06, 0.08, 6000, 2000, 0, 'highpass'); },
    hit() { noise(0.04, 0.12, 6000, 3000, 0, 'highpass'); },
    tink() { tone(3200, 3000, 0.03, 'square', 0.05); },
    explode() { noise(0.35, 0.32, 2500, 120); },
    bigExplode() { noise(1.2, 0.5, 2200, 50); tone(140, 35, 1.0, 'square', 0.1); },
    capsule() { seq([988, 1319, 1976], 0.045, 'square', 0.08); },
    power() { seq([523, 659, 784, 1047, 1319], 0.045, 'square', 0.09); },
    select() { tone(880, 880, 0.04, 'square', 0.07); },
    death() { noise(1.3, 0.5, 3000, 60); tone(800, 50, 1.1, 'square', 0.1); },
    oneup() { seq([784, 988, 1175, 1568, 1175, 1568], 0.08, 'square', 0.1); },
    cheat() { seq([1568, 1319, 1568, 2093, 2637], 0.06, 'triangle', 0.16); },
    warp() { tone(150, 2600, 1.0, 'sawtooth', 0.08); noise(1.0, 0.15, 500, 8000, 0, 'bandpass'); },
    blue() { noise(0.9, 0.45, 5000, 80); tone(1600, 80, 0.7, 'square', 0.09); },
    beam() { tone(900, 300, 0.15, 'sawtooth', 0.05); },
    shield() { tone(500, 1000, 0.07, 'triangle', 0.14); },
    warning() { for (let i = 0; i < 4; i++) { tone(660, 660, 0.18, 'square', 0.11, i * 0.4); tone(440, 440, 0.18, 'square', 0.11, i * 0.4 + 0.2); } },
  };

  return {
    init, play, stop, sfx,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.02);
      return muted;
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
})();
