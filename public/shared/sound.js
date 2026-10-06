// New ArcheryClock — signal sounds, synthesised with Web Audio (no sample files needed).
//
//   const p = createSoundPlayer();
//   p.setSound('buzzer'); p.setVolume(0.8); p.play(3); p.test(); p.listSounds();
//
// play(count) plays `count` signals spaced 1.5 s apart; a new play() cancels the rest of a
// group that is still running. Ids "file:<name>.wav" play /sounds/custom/<name>.wav.

const SPACING_MS = 1500;

/** Each synth gets (ctx, out, t0) and schedules its nodes; returns the stop time. */
const SYNTHS = {
  buzzer: {
    name: 'Range buzzer',
    play(ctx, out, t) {
      const dur = 0.75;
      const env = gainEnv(ctx, out, t, 0.005, dur, 0.03, 0.55);
      const shaper = ctx.createWaveShaper();
      shaper.curve = distortionCurve(18);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3800;
      const am = ctx.createGain(); am.gain.value = 0.75;
      shaper.connect(lp).connect(am).connect(env);
      // two slightly detuned square waves + a sub-octave give the harsh beating buzz
      for (const [f, type, g] of [[196, 'square', 0.5], [203, 'square', 0.45], [98, 'sawtooth', 0.35]]) {
        const o = osc(ctx, type, f, t, t + dur);
        const gg = ctx.createGain(); gg.gain.value = g;
        o.connect(gg).connect(shaper);
      }
      // 50 Hz amplitude chatter like an electromechanical buzzer
      const lfo = osc(ctx, 'square', 50, t, t + dur);
      const depth = ctx.createGain(); depth.gain.value = 0.25;
      lfo.connect(depth).connect(am.gain);
      return t + dur;
    },
  },
  beep: {
    name: 'Beep',
    play(ctx, out, t) {
      const dur = 0.45;
      const env = gainEnv(ctx, out, t, 0.005, dur, 0.02, 0.45);
      osc(ctx, 'square', 1000, t, t + dur).connect(lowpass(ctx, 4000)).connect(env);
      return t + dur;
    },
  },
  horn: {
    name: 'Air horn',
    play(ctx, out, t) {
      const dur = 0.85;
      const env = gainEnv(ctx, out, t, 0.03, dur, 0.08, 0.5);
      const lp = lowpass(ctx, 2200); lp.Q.value = 2;
      lp.connect(env);
      for (const f of [311, 370, 466]) {
        const o = osc(ctx, 'sawtooth', f * 0.97, t, t + dur);
        o.frequency.linearRampToValueAtTime(f, t + 0.08);
        const g = ctx.createGain(); g.gain.value = 0.33;
        o.connect(g).connect(lp);
      }
      return t + dur;
    },
  },
  whistle: {
    name: 'Referee whistle',
    play(ctx, out, t) {
      const dur = 0.6;
      const env = gainEnv(ctx, out, t, 0.01, dur, 0.04, 0.45);
      const o = osc(ctx, 'sine', 2900, t, t + dur);
      const vib = osc(ctx, 'sine', 32, t, t + dur);
      const vd = ctx.createGain(); vd.gain.value = 180;
      vib.connect(vd).connect(o.frequency);
      o.connect(env);
      // breath noise
      const n = noise(ctx, t, t + dur);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2900; bp.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0.25;
      n.connect(bp).connect(ng).connect(env);
      return t + dur;
    },
  },
  bell: {
    name: 'Bell',
    play(ctx, out, t) {
      const dur = 1.4;
      for (const [ratio, amp, decay] of [[1, 0.5, 1.3], [2.0, 0.25, 0.9], [2.76, 0.2, 0.6], [5.4, 0.12, 0.35], [8.9, 0.06, 0.2]]) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        g.connect(out);
        osc(ctx, 'sine', 880 * ratio, t, t + dur).connect(g);
      }
      return t + dur;
    },
  },
  soft: {
    name: 'Soft chime',
    play(ctx, out, t) {
      const dur = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(out);
      osc(ctx, 'sine', 660, t, t + dur).connect(g);
      const g2 = ctx.createGain(); g2.gain.value = 0.2; g2.connect(g);
      osc(ctx, 'triangle', 990, t, t + dur).connect(g2);
      return t + dur;
    },
  },
};

// ---------------------------------------------------------------- node helpers

function osc(ctx, type, freq, t0, t1) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  o.start(t0); o.stop(t1 + 0.05);
  return o;
}
function lowpass(ctx, f) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; return lp;
}
function gainEnv(ctx, out, t, attack, dur, release, peak) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + dur - release);
  g.gain.linearRampToValueAtTime(0, t + dur);
  g.connect(out);
  return g;
}
function noise(ctx, t0, t1) {
  const len = Math.ceil(ctx.sampleRate * (t1 - t0 + 0.1));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  src.start(t0); src.stop(t1 + 0.05);
  return src;
}
function distortionCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return c;
}

// ---------------------------------------------------------------- player

export function createSoundPlayer() {
  let ctx = null;
  let master = null;
  let fileOut = null;           // recordings: volume only, no limiter, so they sound as recorded
  let current = 'buzzer';
  let volume = 0.8;
  let timers = [];
  let voices = [];              // { gain, end } for voices that may still be sounding
  const fileCache = new Map();  // name -> Promise<AudioBuffer|null>

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    // gentle limiter so stacked synths never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6; comp.ratio.value = 8;
    master.connect(comp).connect(ctx.destination);
    fileOut = ctx.createGain();
    fileOut.gain.value = volume;
    fileOut.connect(ctx.destination);
    return ctx;
  }

  // Browsers may start the context suspended until a user gesture: resume on the first one.
  const unlock = () => {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    if (c && c.state === 'running') {
      ['pointerdown', 'keydown', 'touchstart'].forEach((t) => globalThis.removeEventListener?.(t, unlock, true));
    }
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => globalThis.addEventListener?.(t, unlock, true));

  function loadFile(name) {
    if (!fileCache.has(name)) {
      const p = fetch(`/sounds/custom/${encodeURIComponent(name)}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((ab) => new Promise((res, rej) => ensureCtx().decodeAudioData(ab, res, rej)))
        .catch((e) => { console.warn('sound file failed', name, e); fileCache.delete(name); return null; });
      fileCache.set(name, p);
    }
    return fileCache.get(name);
  }

  function playOne() {
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const voice = c.createGain();
    const isFile = current.startsWith('file:');
    voice.connect(isFile ? fileOut : master);
    const t = c.currentTime + 0.02;
    if (isFile) {
      const name = current.slice(5);
      loadFile(name).then((buf) => {
        if (!buf) { voice.disconnect(); voice.connect(master); SYNTHS.buzzer.play(c, voice, c.currentTime + 0.01); return; }
        const src = c.createBufferSource();
        src.buffer = buf; src.connect(voice); src.start();
      });
      voices.push({ gain: voice, end: t + 10 });
    } else {
      const synth = SYNTHS[current] || SYNTHS.buzzer;
      voices.push({ gain: voice, end: synth.play(c, voice, t) });
    }
    voices = voices.filter((v) => v.end > c.currentTime - 1);
  }

  function cancel() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  return {
    play(count = 1) {
      cancel();
      const n = Math.max(0, Math.floor(count));
      for (let i = 0; i < n; i++) {
        if (i === 0) playOne();
        else timers.push(setTimeout(playOne, i * SPACING_MS));
      }
    },
    test() { this.play(1); },
    stop() {
      cancel();
      if (ctx) voices.forEach((v) => { try { v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02); } catch (_) {} });
      voices = [];
    },
    setSound(id) {
      if (typeof id !== 'string') return;
      current = (SYNTHS[id] || /^file:[\w .-]+\.wav$/i.test(id)) ? id : 'buzzer';
      if (current.startsWith('file:') && ensureCtx()) loadFile(current.slice(5));
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v)));
      if (!Number.isFinite(volume)) volume = 0.8;
      if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
      if (fileOut) fileOut.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
    },
    listSounds() {
      return Object.entries(SYNTHS).map(([id, s]) => ({ id, name: s.name }));
    },
    get sound() { return current; },
    get volume() { return volume; },
  };
}

export const SOUND_IDS = Object.keys(SYNTHS);
