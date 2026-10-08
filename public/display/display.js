// New ArcheryClock — display host.
// Connects to the server (SSE), loads/hot-swaps the theme, renders snapshots, plays signals,
// maps the PC keyboard to commands and keeps the screen awake.
//
// URL options:
//   ?preview=1          embedded preview (no sound, no keys, no wake lock)
//   ?mock=1             no server: cycle built-in sample snapshots every 2 s
//   ?mock=1&sample=N    freeze on sample N
//   ?theme=<id>         force a theme (ignores snapshot.display.theme)

import { createFlag } from './flag.js';
import { createSoundPlayer } from '../shared/sound.js';

const params = new URLSearchParams(location.search);
const PREVIEW = params.get('preview') === '1';
const MOCK = params.get('mock') === '1';
const FORCED_THEME = sanitizeId(params.get('theme'));
const DEFAULT_THEME = 'classic';

const stage = document.getElementById('stage');
const badge = document.getElementById('badge');
const hintEl = document.getElementById('hint');
const themeCss = document.getElementById('theme-css');
if (PREVIEW) document.body.classList.add('preview');

// ---------------------------------------------------------------- formatting

function pad(n, w) { return String(n).padStart(w, '0'); }

/** formatTime(snapshot) or formatTime(seconds, "sec"|"min"). Returns '' for null. */
export function formatTime(x, fmt) {
  let s = x;
  if (x && typeof x === 'object') {
    s = x.seconds;
    fmt = x.phase === 'countdown' ? 'min' : x.timeFormat;
  }
  if (s == null || !Number.isFinite(s)) return '';
  s = Math.max(0, Math.floor(s));
  if (fmt === 'min') return `${Math.floor(s / 60) % 10}:${pad(s % 60, 2)}`;
  return pad(Math.min(s, 999), 3);
}

function sanitizeId(id) {
  return id && /^[a-z0-9_-]+$/i.test(id) ? id : null;
}

// ---------------------------------------------------------------- theme handling

let theme = null;          // { id, module }
let themeRoot = null;
let loadingThemeId = null;
let lastSnapshot = null;
let lastSnapshotAt = Date.now();

async function ensureTheme(id) {
  id = sanitizeId(id) || DEFAULT_THEME;
  if ((theme && theme.id === id) || loadingThemeId === id) return;
  loadingThemeId = id;
  try {
    const url = new URL(`../themes/${id}/theme.js`, import.meta.url);
    const cssUrl = new URL(`../themes/${id}/theme.css`, import.meta.url).href;
    const mod = (await import(url.href)).default;
    if (loadingThemeId !== id) return;              // superseded by a newer request
    await loadCss(cssUrl);
    if (loadingThemeId !== id) return;
    if (theme) { try { theme.module.unmount(); } catch (e) { console.error(e); } }
    stage.textContent = '';
    themeRoot = document.createElement('div');
    themeRoot.className = `theme-root theme-${id}`;
    themeRoot.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
    stage.appendChild(themeRoot);
    document.body.dataset.theme = id;
    mod.mount(themeRoot, { formatTime, preview: PREVIEW });
    theme = { id, module: mod };
    if (lastSnapshot) safeRender(lastSnapshot);
  } catch (err) {
    console.error(`Theme "${id}" failed to load`, err);
    if (id !== DEFAULT_THEME && !theme) { loadingThemeId = null; return ensureTheme(DEFAULT_THEME); }
  } finally {
    if (loadingThemeId === id) loadingThemeId = null;
  }
}

let themeLink = themeCss;
function loadCss(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
    // the old theme's stylesheet is removed only once the new one is ready (no flash)
    const old = themeLink;
    themeLink = link;
    link.dataset.pending = '1';
    const done = () => { if (old && old !== link) old.remove(); delete link.dataset.pending; };
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
  });
}

function safeRender(snap) {
  if (!theme) return;
  try { theme.module.render(snap); } catch (e) { console.error('theme render failed', e); }
}

// ---------------------------------------------------------------- snapshots

function isRunning(s) {
  if (!s) return false;
  if (s.phase === 'emergency' || s.emergency) return true;
  return ['red', 'green', 'orange', 'countdown'].includes(s.phase) && !s.paused && !s.hold;
}

let loadedVersion = null;
function onSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return;
  // after a self-update the server reports a new version: reload to pick up the new display and themes
  if (snap.version && !MOCK) {
    if (loadedVersion && snap.version !== loadedVersion) { location.reload(); return; }
    loadedVersion = snap.version;
  }
  if (lastSnapshot && !MOCK && typeof snap.seq === 'number' && typeof lastSnapshot.seq === 'number'
      && snap.seq < lastSnapshot.seq && snap.serverTime <= lastSnapshot.serverTime) return; // stale
  lastSnapshot = snap;
  lastSnapshotAt = Date.now();
  const wanted = FORCED_THEME || (snap.display && snap.display.theme) || DEFAULT_THEME;
  ensureTheme(wanted);
  const d = snap.display || {};
  const showHint = d.showHints && !d.hideIcons && snap.hint;
  hintEl.hidden = !showHint || !!(snap.anthem && snap.anthem.playing);   // the anthem banner takes the hint's place
  if (showHint) hintEl.textContent = snap.hint;
  safeRender(snap);
  if (isRunning(snap)) startLoop();
  updateAnthem(snap.anthem);
}

// ---------------------------------------------------------------- national anthem
// The server says what should be playing; every display (not previews) plays it. A display that
// (re)connects mid-anthem joins at the right point.
const anthemEl = document.getElementById('anthem');
const flag = createFlag(anthemEl);
let anthemAudio = null, anthemKey = null;
function updateAnthem(a) {
  const playing = !!(a && a.playing);
  if (anthemEl.hidden === playing) {           // the screen is just the waving flag while it plays
    anthemEl.hidden = !playing;
    if (playing) flag.start(); else flag.stop();
  }
  const key = playing ? `${a.id}@${a.startedAt}` : null;
  if (key === anthemKey) { if (anthemAudio && playing) anthemAudio.volume = clamp01(a.volume); return; }
  anthemKey = key;
  if (anthemAudio) { anthemAudio.pause(); anthemAudio.removeAttribute('src'); anthemAudio.load(); anthemAudio = null; }
  if (!playing || PREVIEW || MOCK) return;
  const audio = new Audio(`/anthem/${encodeURIComponent(a.file)}`);
  audio.volume = clamp01(a.volume);
  const elapsed = (Date.now() - a.startedAt) / 1000;
  if (elapsed > 1.5) audio.addEventListener('loadedmetadata', () => { audio.currentTime = Math.min(elapsed, audio.duration || elapsed); }, { once: true });
  audio.play().catch((e) => console.warn('anthem could not play', e));
  anthemAudio = audio;
}
function clamp01(v) { v = Number(v); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1; }

// time-of-day display: the clock face changes every minute even while nothing else does
setInterval(() => {
  if (lastSnapshot && !isRunning(lastSnapshot) && lastSnapshot.display && lastSnapshot.display.clock && lastSnapshot.display.clock !== 'off') safeRender(lastSnapshot);
}, 250);   // 4x a second so a seconds display ticks over on time

let rafId = 0;
function startLoop() {
  if (rafId) return;
  const tick = () => {
    rafId = 0;
    if (!lastSnapshot || !isRunning(lastSnapshot)) return;
    safeRender(lastSnapshot);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- sound

const sound = PREVIEW ? null : createSoundPlayer();
let soundSettings = { enabled: true, sound: 'buzzer', volume: 0.8 };

function applySettings(settings) {
  if (!settings || !settings.sound || !sound) return;
  soundSettings = { ...soundSettings, ...settings.sound };
  sound.setSound(soundSettings.sound);
  sound.setVolume(soundSettings.volume);
}

function onSignal(sig) {
  if (!sound || !sig) return;
  if (!soundSettings.enabled && !sig.test) return;   // server already drops non-test signals when disabled
  const n = Math.max(0, Math.min(10, sig.count | 0));
  if (n > 0) sound.play(n);
}

// ---------------------------------------------------------------- server connection

let es = null;
let reconnectTimer = 0;
let badgeTimer = 0;

function setBadge(show) {
  clearTimeout(badgeTimer);
  if (show) badgeTimer = setTimeout(() => { badge.hidden = false; }, 800);   // ignore blips
  else badge.hidden = true;
}

function connect() {
  clearTimeout(reconnectTimer);
  if (es) es.close();
  es = new EventSource('/events');
  es.addEventListener('open', () => setBadge(false));
  es.addEventListener('state', (e) => { setBadge(false); try { onSnapshot(JSON.parse(e.data)); } catch (err) { console.error(err); } });
  es.addEventListener('signal', (e) => { try { onSignal(JSON.parse(e.data)); } catch (err) { console.error(err); } });
  es.addEventListener('settings', (e) => { try { applySettings(JSON.parse(e.data)); } catch (err) { console.error(err); } });
  es.addEventListener('error', () => {
    setBadge(true);
    // EventSource retries by itself unless it gave up (CLOSED); then retry manually.
    if (es.readyState === EventSource.CLOSED) reconnectTimer = setTimeout(connect, 2000);
  });
}

// If the stream goes silent while running (server froze / network half-open), force a reconnect.
setInterval(() => {
  if (MOCK || !es) return;
  if (lastSnapshot && isRunning(lastSnapshot) && Date.now() - lastSnapshotAt > 5000) {
    setBadge(true);
    connect();
    lastSnapshotAt = Date.now();
  }
}, 1000);

// ---------------------------------------------------------------- keyboard

async function send(cmd, arg) {
  if (MOCK) { console.log('[mock] command', cmd, arg); return; }
  try {
    const body = arg === undefined ? { cmd } : { cmd, arg };
    const r = await fetch('/api/command', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (j && j.ok && j.snapshot) onSnapshot(j.snapshot);
  } catch (err) { console.warn('command failed', cmd, err); }
}

function keyToCommand(e) {
  const s = lastSnapshot || {};
  const finals = s.system === 'finals';
  const k = e.key;

  const f = /^F([1-9]|1[0-2])$/.exec(k);
  if (f) return e.shiftKey ? ['loadPreset', `shiftF${f[1]}`] : ['loadScenario', `F${f[1]}`];

  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  switch (k) {
    case ' ': case 'Spacebar': return ['next'];
    case 'PageDown': return ['pageDown'];   // server resolves finals/non-finals meaning
    case 'PageUp': return ['pageUp'];
    case 'ArrowUp': return ['endUp'];
    case 'ArrowDown': return ['endDown'];
    case 'ArrowLeft': return finals ? ['finalsSide', 'left'] : ['turnDown'];
    case 'ArrowRight': return finals ? ['finalsSide', 'right'] : ['turnUp'];
    case 'Escape': case 'Esc': return [];   // kiosk: swallow
  }
  switch (k.toLowerCase()) {
    case 'p': return ['pause'];
    case 's': return ['stop'];
    case 'e': return ['emergency'];
    case 'c': return ['countdown'];
    case 'h': return ['toggleIcons'];
    case 'm': return ['toggleFormat'];
    case 'r': return ['manualLight', 'red'];       // manual mode lights (ignored in other modes)
    case 'y': case 'o': return ['manualLight', 'orange'];
    case 'g': return ['manualLight', 'green'];
  }
  if (/^[1-6]$/.test(k)) return ['shootoff', Number(k)];   // manual mode: 1-3 = that many signals
  return null;
}

const PREVENT = /^(F([1-9]|1[0-2])|PageUp|PageDown|Arrow(Up|Down|Left|Right)|Escape| |Spacebar)$/;

if (!PREVIEW) {
  window.addEventListener('keydown', (e) => {
    if (PREVENT.test(e.key)) e.preventDefault();
    if (e.repeat) return;
    const c = keyToCommand(e);
    if (!c) return;
    e.preventDefault();
    if (c.length) send(c[0], c[1]);
  });
}

// ---------------------------------------------------------------- wake lock

let wakeLock = null;
async function keepAwake() {
  if (PREVIEW || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) { /* not allowed yet (needs a gesture on some browsers) */ }
}
if (!PREVIEW) {
  document.addEventListener('visibilitychange', () => { if (!wakeLock) keepAwake(); });
  ['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, () => { if (!wakeLock) keepAwake(); }));
  keepAwake();
}

// ---------------------------------------------------------------- mock samples

function mockBase(over = {}) {
  const b = {
    seq: 1, serverTime: Date.now(),
    system: 'fita', phase: 'wait', paused: false, hold: false, timeFormat: 'sec',
    seconds: 0, remainingMs: 0, phaseTotalMs: 0, digitColor: 'idle', light: 'red',
    end: { number: 1, label: 'End', practice: false, visible: true },
    turn: { number: 1, total: 2, visible: true },
    details: {
      kind: 'letters',
      slots: [{ letter: 'A', active: true }, { letter: 'B', active: true },
              { letter: 'C', active: false }, { letter: 'D', active: false }],
      topbottom: null, archer: null, next: null,
    },
    shootoff: null, finals: null, emergency: false,
    hint: 'Press Space to start the end.',
    canNext: true, canPause: false, canStop: true,
    display: { theme: 'classic', trafficLight: true, trafficSide: 'right',
               showHints: false, hideIcons: false, bannerText: '' },
  };
  const out = { ...b, ...over };
  for (const k of ['end', 'turn', 'details', 'display']) if (over[k]) out[k] = { ...b[k], ...over[k] };
  return out;
}
const CD_ACTIVE = [{ letter: 'C', active: true }, { letter: 'D', active: true },
                   { letter: 'A', active: false }, { letter: 'B', active: false }];
const run = (phase, sec, total, color, light = color) => ({
  phase, seconds: sec, remainingMs: sec * 1000 - 400, phaseTotalMs: total * 1000,
  digitColor: color, light, canPause: true, hint: 'Press Space for the next detail.',
});
const finalsBase = (over) => ({
  mode: 'perArrow', view: 'both', chosen: 'left', active: 'left', primary: 'left',
  arrow: 2, turns: 3, showTargets: true, targets: { left: 7, right: 8 },
  left: { seconds: 14, color: 'green', light: 'green' },
  right: { seconds: 20, color: 'red', light: 'red' }, ...over,
});

const SAMPLES = [
  ['wait AB-CD end 1 practice', mockBase({
    end: { number: 1, practice: true },
    details: { next: 'AB' },
    display: { showHints: true, bannerText: 'Lower Providence Rod & Gun Club' } })],
  ['red prep 10', mockBase({ ...run('red', 10, 10, 'red'), end: { number: 2 } })],
  ['green 87 CD active', mockBase({ ...run('green', 87, 120, 'green'), end: { number: 2 },
    details: { slots: CD_ACTIVE } })],
  ['orange 25', mockBase({ ...run('orange', 25, 120, 'orange'), end: { number: 4 },
    turn: { number: 2, total: 2 },
    details: { slots: [{ letter: 'A', active: false }, { letter: 'B', active: false },
                       { letter: 'C', active: true }, { letter: 'D', active: true }] } })],
  ['paused green 64', mockBase({ ...run('green', 64, 120, 'green'), paused: true, end: { number: 5 } })],
  ['hold red', mockBase({ ...run('red', 0, 0, 'red'), hold: true, end: { number: 3 },
    hint: 'Hold — press Space to continue.' })],
  ['countdown 3:12', mockBase({ phase: 'countdown', seconds: 192, remainingMs: 191600, phaseTotalMs: 240000,
    digitColor: 'blue', light: 'red', canPause: true, details: { next: 'AB' } })],
  ['emergency', mockBase({ phase: 'emergency', emergency: true, seconds: null, remainingMs: null,
    digitColor: 'red', light: 'red', end: { number: 6 } })],
  ['25m1P archer 3', mockBase({ ...run('green', 22, 45, 'green'), system: '25m1p',
    end: { number: 4, label: 'Arrow' }, turn: { number: 3, total: 6, visible: false },
    details: { kind: 'archer', slots: [], archer: 3 } })],
  ['Top-Bottom', mockBase({ ...run('green', 75, 120, 'green'), end: { number: 3 },
    details: { kind: 'topbottom', slots: [], topbottom: { big: 'T', small: 'op' } } })],
  ['finals both, left active', mockBase({ ...run('green', 14, 20, 'green'), system: 'finals',
    end: { number: 2, label: 'Arrow', visible: true }, turn: { number: 1, total: 3, visible: false },
    details: { kind: 'none', slots: [] }, finals: finalsBase({}) })],
  ['finals right view', mockBase({ ...run('orange', 8, 20, 'orange'), system: 'finals',
    end: { number: 3, label: 'Arrow' }, turn: { visible: false }, details: { kind: 'none', slots: [] },
    finals: finalsBase({ view: 'right', active: 'right', arrow: 3, showTargets: false,
      left: { seconds: 20, color: 'red', light: 'red' },
      right: { seconds: 8, color: 'orange', light: 'orange' } }) })],
  ['manual green', mockBase({ system: 'manual', phase: 'wait', seconds: null, digitColor: 'idle',
    light: 'green', end: { visible: false }, turn: { visible: false },
    details: { kind: 'none', slots: [] }, hint: '' })],
  ['minutes 1:45', mockBase({ ...run('green', 105, 120, 'green'), timeFormat: 'min', end: { number: 7 } })],
  ['wait + clock datetime 12h', mockBase({ end: { number: 3 }, details: { next: 'CD' },
    display: { bannerText: 'Lower Providence Rod & Gun Club', clock: 'datetime', clock24h: false } })],
  ['finals wait + clock time 24h', mockBase({ system: 'finals', phase: 'wait', seconds: 0,
    end: { number: 1, label: 'Arrow' }, turn: { visible: false }, details: { kind: 'none', slots: [] },
    hint: 'Choose the starting side (← / →).',
    finals: finalsBase({ chosen: null, active: null, primary: null, arrow: 1, showTargets: false,
      left: { seconds: 20, color: 'idle', light: 'red' }, right: { seconds: 20, color: 'idle', light: 'red' } }),
    display: { clock: 'time', clock24h: true } })],
];
export const MOCK_SAMPLES = SAMPLES;

function startMock() {
  const fixed = params.has('sample') ? Number(params.get('sample')) : null;
  let i = Number.isInteger(fixed) && fixed >= 0 && fixed < SAMPLES.length ? fixed : 0;
  let seq = 1;
  const show = () => {
    const [name, s] = SAMPLES[i];
    const snap = JSON.parse(JSON.stringify(s));
    snap.seq = seq++;
    snap.serverTime = Date.now();
    document.title = `ArcheryClock mock ${i}: ${name}`;
    onSnapshot(snap);
  };
  show();
  if (fixed == null) setInterval(() => { i = (i + 1) % SAMPLES.length; show(); }, 2000);
}

// ---------------------------------------------------------------- go

if (MOCK) startMock();
else {
  // Render something before the first event arrives (and if the server is down at start).
  ensureTheme(FORCED_THEME || DEFAULT_THEME);
  fetch('/api/settings').then((r) => r.json()).then(applySettings).catch(() => {});
  connect();
}
