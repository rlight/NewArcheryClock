'use strict';
// Settings: defaults, validation, built-in presets and persistence (data/settings.json,
// data/scenarios/<slot>.json). Every value coming from a client goes through validate().

const fs = require('fs');
const path = require('path');
const { LAYOUTS } = require('./engine');

const DATA_DIR = process.env.ARCHERYCLOCK_DATA || path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SCENARIO_DIR = path.join(DATA_DIR, 'scenarios');
const SLOTS = Array.from({ length: 12 }, (_, i) => 'F' + (i + 1));

const DEFAULT_ROUND = {
  system: 'fita',
  fita: {
    layout: 'AB-CD', red: 10, green: 90, orange: 30, practiceEnds: 2,
    doubleEnds: false, doubleMode: 'turns', countDoubleAsTwo: true, startEveryEndWithAB: false,
    shootoff: { red: 10, green: 30, orange: 10 },
  },
  finals: {
    mode: 'perArrow', view: 'both', showTargets: false, targets: { left: 1, right: 2 },
    perArrow: { turns: 3, red: 10, green: 20, orange: 0 },
    perEnd: { turns: 2, red: 10, green: 120, orange: 0 },
  },
  oneArrow: { archers: 6, red: 15, green: 30, orange: 15, practiceArrows: 5, alwaysStartWithArcher1: true },
  manual: { redSignals: 2, orangeSignals: 0, greenSignals: 1 },
};

const DEFAULTS = {
  version: 1,
  server: { port: 8765 },
  display: {
    theme: 'classic', timeFormat: 'sec', trafficLight: true, trafficSide: 'right',
    showHints: true, hideIcons: false, bannerText: '',
    clock: 'off', clock24h: false, clockSeconds: true,
  },
  sound: { enabled: true, sound: 'file:Default.wav', volume: 1 },
  anthem: { choice: 'navy-solo', volume: 1 },
  // 'private' shows the music controls (operator's choice; see README for the licensing note)
  venue: 'public',
  start: { scenario: 'shiftF5', countdownMinutes: 4, countdownBetweenEnds: false },
  round: DEFAULT_ROUND,
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- presets (Shift+F1…F12)

function fitaPreset(layout, extra = {}) {
  const r = clone(DEFAULT_ROUND);
  r.system = 'fita';
  Object.assign(r.fita, { layout, red: 10, green: 90, orange: 30, practiceEnds: 2, startEveryEndWithAB: false,
    shootoff: { red: 10, green: 30, orange: 10 } }, extra);
  return r;
}
function finalsPreset(mode) {
  const r = clone(DEFAULT_ROUND);
  r.system = 'finals';
  r.finals.mode = mode; r.finals.view = 'both';
  r.finals.perArrow = { turns: 3, red: 10, green: 20, orange: 0 };
  r.finals.perEnd = { turns: 2, red: 10, green: 120, orange: 0 };
  return r;
}
function oneArrowPreset(archers) {
  const r = clone(DEFAULT_ROUND);
  r.system = '25m1p';
  Object.assign(r.oneArrow, { archers, red: 15, green: 30, orange: 15 });
  return r;
}

const PRESETS = [
  ['shiftF1', 'Single archer', '1 archer per target, 2 minute ends.', fitaPreset('A')],
  ['shiftF2', 'A then B', '1 archer per detail, 2 details per end (A-B, then B-A).', fitaPreset('A-B')],
  ['shiftF3', 'A, B, C', '1 archer per detail, 3 details per end.', fitaPreset('A-B-C')],
  ['shiftF4', 'A, B, C, D', '1 archer per detail, 4 details per end.', fitaPreset('A-B-C-D')],
  ['shiftF5', 'AB-CD', '2 archers per detail, 2 details per end (AB-CD, then CD-AB). The standard target round.', fitaPreset('AB-CD')],
  ['shiftF6', 'AB-CD double (long distance)', 'AB-CD-AB-CD: each detail shoots twice before scoring. Each pass counts as an end.', fitaPreset('AB-CD', { doubleEnds: true, doubleMode: 'turns' })],
  ['shiftF7', 'AB-CD, double time', 'Each detail shoots all its arrows in one go with double the time (4 minutes).', fitaPreset('AB-CD', { doubleEnds: true, doubleMode: 'time' })],
  ['shiftF8', 'Individual final', 'Alternating shooting, 20 seconds per arrow, 3 arrows.', finalsPreset('perArrow')],
  ['shiftF9', 'Team final', 'Alternating shooting, 2 minutes per team per end; the clock pauses while the other team shoots.', finalsPreset('perEnd')],
  ['shiftF10', '25m one arrow, 4 archers', '25m1P: each archer shoots one arrow in turn, 4 archers per target.', oneArrowPreset(4)],
  ['shiftF11', '25m one arrow, 5 archers', '25m1P with 5 archers per target.', oneArrowPreset(5)],
  ['shiftF12', '25m one arrow, 6 archers', '25m1P with 6 archers per target.', oneArrowPreset(6)],
].map(([id, name, description, round], i) => ({ id, key: 'Shift+F' + (i + 1), name, description, round }));

function presetById(id) { return PRESETS.find((p) => p.id === id) || null; }

// What F1-F4 load until the club saves its own round into that slot (deleting the saved one
// brings these back). F5-F12 fall back to the built-in Shift preset with the same number.
const DEFAULT_SLOTS = {
  F1: { name: 'Single archer', round: fitaPreset('A') },
  F2: { name: 'AB-CD', round: fitaPreset('AB-CD') },
  // NFAA 5-arrow ends: 240 s to shoot (yellow for the last 30)
  F3: { name: 'NFAA 5-arrow, single archer', round: fitaPreset('A', { green: 210, orange: 30 }) },
  F4: { name: 'NFAA 5-arrow, AB-CD', round: fitaPreset('AB-CD', { green: 210, orange: 30 }) },
};

// ---------------------------------------------------------------- validation

const int = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const str = (v, max, d) => (typeof v === 'string' ? v.slice(0, max) : d);

function validateRound(r, d = DEFAULT_ROUND) {
  r = r || {};
  const f = r.fita || {}, df = d.fita;
  const fin = r.finals || {}, dfin = d.finals;
  const o = r.oneArrow || {}, dO = d.oneArrow;
  const m = r.manual || {}, dm = d.manual;
  const so = f.shootoff || {};
  const finTimes = (t = {}, dt) => ({
    turns: int(t.turns, 1, 99, dt.turns), red: int(t.red, 0, 150, dt.red),
    green: int(t.green, 0, 450, dt.green), orange: int(t.orange, 0, 150, dt.orange),
  });
  return {
    system: oneOf(r.system, ['fita', 'finals', '25m1p', 'manual'], d.system),
    fita: {
      layout: oneOf(f.layout, Object.keys(LAYOUTS), df.layout),
      red: int(f.red, -1, 150, df.red), green: int(f.green, -1, 450, df.green), orange: int(f.orange, -1, 150, df.orange),
      practiceEnds: int(f.practiceEnds, 0, 10, df.practiceEnds),
      doubleEnds: bool(f.doubleEnds, df.doubleEnds),
      doubleMode: oneOf(f.doubleMode, ['turns', 'time'], df.doubleMode),
      countDoubleAsTwo: bool(f.countDoubleAsTwo, df.countDoubleAsTwo),
      startEveryEndWithAB: bool(f.startEveryEndWithAB, df.startEveryEndWithAB),
      shootoff: {
        red: int(so.red, 0, 150, df.shootoff.red), green: int(so.green, 0, 450, df.shootoff.green),
        orange: int(so.orange, 0, 150, df.shootoff.orange),
      },
    },
    finals: {
      mode: oneOf(fin.mode, ['perArrow', 'perEnd'], dfin.mode),
      view: oneOf(fin.view, ['both', 'left', 'right'], dfin.view),
      showTargets: bool(fin.showTargets, dfin.showTargets),
      targets: { left: int((fin.targets || {}).left, 0, 999, dfin.targets.left), right: int((fin.targets || {}).right, 0, 999, dfin.targets.right) },
      perArrow: finTimes(fin.perArrow, dfin.perArrow),
      perEnd: finTimes(fin.perEnd, dfin.perEnd),
    },
    oneArrow: {
      archers: int(o.archers, 1, 6, dO.archers), red: int(o.red, 0, 150, dO.red), green: int(o.green, 0, 450, dO.green),
      orange: int(o.orange, 0, 150, dO.orange), practiceArrows: int(o.practiceArrows, 0, 10, dO.practiceArrows),
      alwaysStartWithArcher1: bool(o.alwaysStartWithArcher1, dO.alwaysStartWithArcher1),
    },
    manual: {
      redSignals: int(m.redSignals, 0, 3, dm.redSignals), orangeSignals: int(m.orangeSignals, 0, 3, dm.orangeSignals),
      greenSignals: int(m.greenSignals, 0, 3, dm.greenSignals),
    },
  };
}

function validate(s, d = DEFAULTS) {
  s = s || {};
  const disp = s.display || {}, snd = s.sound || {}, st = s.start || {}, srv = s.server || {}, an = s.anthem || {};
  const scenarioIds = ['--', ...SLOTS, ...PRESETS.map((p) => p.id)];
  return {
    version: 1,
    server: { port: int(srv.port, 1, 65535, d.server.port) },
    display: {
      theme: typeof disp.theme === 'string' && /^[a-z0-9-]{1,40}$/.test(disp.theme) ? disp.theme : d.display.theme,
      timeFormat: oneOf(disp.timeFormat, ['sec', 'min'], d.display.timeFormat),
      trafficLight: bool(disp.trafficLight, d.display.trafficLight),
      trafficSide: oneOf(disp.trafficSide, ['left', 'right'], d.display.trafficSide),
      showHints: bool(disp.showHints, d.display.showHints),
      hideIcons: bool(disp.hideIcons, d.display.hideIcons),
      bannerText: str(disp.bannerText, 120, d.display.bannerText),
      clock: oneOf(disp.clock, ['off', 'time', 'datetime'], d.display.clock),
      clock24h: bool(disp.clock24h, d.display.clock24h),
      clockSeconds: bool(disp.clockSeconds, d.display.clockSeconds),
    },
    sound: {
      enabled: bool(snd.enabled, d.sound.enabled),
      sound: typeof snd.sound === 'string' && /^(file:[\w .-]{1,80}\.wav|[a-z0-9-]{1,30})$/i.test(snd.sound) ? snd.sound : d.sound.sound,
      volume: Math.min(1, Math.max(0, Number.isFinite(Number(snd.volume)) ? Number(snd.volume) : d.sound.volume)),
    },
    venue: oneOf(s.venue, ['public', 'private'], d.venue),
    anthem: {
      choice: typeof an.choice === 'string' && /^[a-z0-9-]{1,40}$/.test(an.choice) ? an.choice : d.anthem.choice,
      volume: Math.min(1, Math.max(0, Number.isFinite(Number(an.volume)) ? Number(an.volume) : d.anthem.volume)),
    },
    start: {
      scenario: oneOf(st.scenario, scenarioIds, d.start.scenario),
      countdownMinutes: int(st.countdownMinutes, 0, 10, d.start.countdownMinutes),
      countdownBetweenEnds: bool(st.countdownBetweenEnds, d.start.countdownBetweenEnds),
    },
    round: validateRound(s.round, d.round),
  };
}

function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

// ---------------------------------------------------------------- persistence

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function loadSettings() {
  const raw = readJson(SETTINGS_FILE);
  const s = validate(raw ? deepMerge(clone(DEFAULTS), raw) : clone(DEFAULTS));
  if (!raw) {
    // first run: apply the start-up preset, like the original's factory shift-F5
    const p = presetById(s.start.scenario);
    if (p) s.round = clone(p.round);
    writeJson(SETTINGS_FILE, s);
  } else {
    const startRound = startupRound(s);
    if (startRound) s.round = startRound;
  }
  return s;
}

// Round to load at start-up: a preset, a user scenario, or the saved round ("--").
function startupRound(s) {
  const id = s.start.scenario;
  if (id === '--') return null;
  if (SLOTS.includes(id)) {
    const sc = readScenario(id);
    if (sc) return sc.round;
    const p = presetById('shift' + id);
    return p ? clone(p.round) : null;
  }
  const p = presetById(id);
  return p ? clone(p.round) : null;
}

function saveSettings(s) { writeJson(SETTINGS_FILE, s); }

function scenarioFile(slot) { return path.join(SCENARIO_DIR, slot + '.json'); }
function readScenario(slot) {
  if (!SLOTS.includes(slot)) return null;
  const raw = readJson(scenarioFile(slot));
  if (!raw) {
    const def = DEFAULT_SLOTS[slot];
    return def ? { slot, name: def.name, savedAt: null, builtIn: true, round: validateRound(def.round) } : null;
  }
  return { slot, name: str(raw.name, 60, slot), savedAt: raw.savedAt || null, round: validateRound(raw.round) };
}
function writeScenario(slot, name, round) {
  if (!SLOTS.includes(slot)) throw new Error('bad slot');
  const sc = { slot, name: str(name, 60, slot) || slot, savedAt: new Date().toISOString(), round: validateRound(round) };
  writeJson(scenarioFile(slot), sc);
  return sc;
}
function deleteScenario(slot) {
  if (!SLOTS.includes(slot)) throw new Error('bad slot');
  try { fs.unlinkSync(scenarioFile(slot)); } catch { /* already gone */ }
}
function listScenarios() {
  return SLOTS.map((slot) => {
    const sc = readScenario(slot);
    return sc ? { ...sc, summary: summarize(sc.round) } : { slot, empty: true };
  });
}

// ---------------------------------------------------------------- plain-English summary

function t(v) { return v === -1 ? 'hold' : v + ' s'; }
function summarize(r) {
  if (r.system === 'fita') {
    const f = r.fita;
    const order = LAYOUTS[f.layout] && LAYOUTS[f.layout].topBottom ? 'Top-Bottom' : f.layout;
    const dbl = f.doubleEnds ? (f.doubleMode === 'time' ? ', double time' : ', double ends') : '';
    const shoot = (f.green === -1 ? 0 : f.green) + (f.orange === -1 ? 0 : f.orange);
    const total = f.doubleEnds && f.doubleMode === 'time' ? shoot * 2 : shoot;
    return `${order}${dbl}, ${f.practiceEnds} practice end${f.practiceEnds === 1 ? '' : 's'}, ${t(f.red)} walk-up + ${f.green === -1 ? 'held' : total + ' s'} shooting, warning at ${t(f.orange)}`;
  }
  if (r.system === 'finals') {
    const fm = r.finals.mode === 'perEnd' ? r.finals.perEnd : r.finals.perArrow;
    return r.finals.mode === 'perEnd'
      ? `Team final: ${fm.green + fm.orange} s per team per end, ${fm.turns} turns each`
      : `Individual final: ${fm.green + fm.orange} s per arrow, ${fm.turns} arrows each`;
  }
  if (r.system === '25m1p') {
    const o = r.oneArrow;
    return `25m one arrow: ${o.archers} archers, ${o.red} s + ${o.green + o.orange} s per arrow, ${o.practiceArrows} practice arrows`;
  }
  return 'Manual lights and signals';
}

module.exports = {
  DEFAULTS, DEFAULT_ROUND, PRESETS, SLOTS, DATA_DIR, DEFAULT_SLOTS,
  validate, validateRound, deepMerge, clone, presetById,
  loadSettings, saveSettings, readScenario, writeScenario, deleteScenario, listScenarios, summarize,
};
