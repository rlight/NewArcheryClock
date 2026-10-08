// New ArcheryClock — control GUI (vanilla ES module, no dependencies).
import { api, connect } from '../shared/api.js';

/* ------------------------------------------------------------------ helpers */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}
const svg = (markup, cls = '') => {
  const span = document.createElement('span');
  span.innerHTML = markup.trim();
  const el = span.firstElementChild;
  if (cls) el.setAttribute('class', cls);
  return el;
};
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[keys.at(-1)] = value;
}
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad2 = (n) => String(n).padStart(2, '0');
const mmss = (sec) => `${Math.floor(sec / 60)}:${pad2(sec % 60)}`;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ state */

const S = {
  snap: null,
  settings: null,
  presets: [],
  scenarios: [],
  themes: [],
  info: null,
  conn: 'connecting',
  view: 'run',
  built: false,
};

const SYSTEMS = {
  fita: { name: 'Target round', short: 'Target' },
  finals: { name: 'Finals (alternating)', short: 'Finals' },
  '25m1p': { name: '25m one arrow (25m1P)', short: '25m1P' },
  manual: { name: 'Manual', short: 'Manual' },
};
const PHASES = {
  wait: { name: 'Waiting', chip: 'Wait' },
  red: { name: 'Get ready', chip: 'Red' },
  green: { name: 'Shooting', chip: 'Green' },
  orange: { name: 'Warning', chip: 'Yellow' },
  countdown: { name: 'Match countdown', chip: 'Countdown' },
  emergency: { name: 'EMERGENCY', chip: 'Stop' },
};

const LAYOUTS = [
  { id: 'A', groups: ['A'], title: 'Single archer', sub: '1 archer per target' },
  { id: 'A-B', groups: ['A', 'B'], title: 'A · B', sub: '2 archers, one at a time' },
  { id: 'A-B-C', groups: ['A', 'B', 'C'], title: 'A · B · C', sub: '3 archers, one at a time' },
  { id: 'A-B-C-D', groups: ['A', 'B', 'C', 'D'], title: 'A · B · C · D', sub: '4 archers, one at a time' },
  { id: 'AB-CD', groups: ['AB', 'CD'], title: 'AB · CD', sub: '4 archers, two at a time' },
  { id: 'A-B-C-D-E', groups: ['A', 'B', 'C', 'D', 'E'], title: 'A · B · C · D · E', sub: '5 archers, one at a time' },
  { id: 'A-B-C-D-E-F', groups: ['A', 'B', 'C', 'D', 'E', 'F'], title: 'A – F', sub: '6 archers, one at a time' },
  { id: 'AB-CD-EF', groups: ['AB', 'CD', 'EF'], title: 'AB · CD · EF', sub: '6 archers, two at a time' },
  { id: 'ABC-DEF', groups: ['ABC', 'DEF'], title: 'ABC · DEF', sub: '6 archers, three at a time' },
  { id: 'TOP-BOTTOM', groups: ['Top', 'Bottom'], title: 'Top / Bottom', sub: '2 archers; shows “Top” / “Bottom” instead of letters' },
];
const layoutInfo = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[4];
const rotate = (arr, k) => { const n = arr.length; k = ((k % n) + n) % n; return k ? [...arr.slice(n - k), ...arr.slice(0, n - k)] : [...arr]; };

const SOUNDS = [
  { id: 'buzzer', title: 'Buzzer', sub: 'Classic range buzzer' },
  { id: 'beep', title: 'Beep', sub: 'Electronic beep' },
  { id: 'horn', title: 'Horn', sub: 'Loud air horn — outdoors' },
  { id: 'whistle', title: 'Whistle', sub: 'Referee whistle' },
  { id: 'bell', title: 'Bell', sub: 'Bright bell' },
  { id: 'soft', title: 'Soft', sub: 'Gentle chime — indoors' },
];

/* ------------------------------------------------------------------ toasts & modal */

const toastHost = $('#toasts');
function toast(msg, kind = 'ok', ms = 1700) {
  // Collapse repeated identical toasts ("Saved") instead of stacking them.
  let el = $$('.toast', toastHost).find((t) => t.dataset.msg === msg && !t.classList.contains('out'));
  if (!el) {
    el = h('div', { class: `toast ${kind}`, dataset: { msg } }, msg);
    toastHost.append(el);
    while (toastHost.children.length > 3) toastHost.firstElementChild.remove();
  }
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, ms);
}

const modal = $('#modal');
function ask({ title, text = '', ok = 'OK', cancel = 'Cancel', danger = false, input = null }) {
  return new Promise((resolve) => {
    $('#modal-title').textContent = title;
    $('#modal-text').textContent = text;
    $('#modal-text').hidden = !text;
    const inp = $('#modal-input');
    inp.hidden = input == null;
    inp.value = input ?? '';
    const okBtn = $('#modal-ok');
    okBtn.textContent = ok;
    okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    $('#modal-cancel').textContent = cancel;
    modal.returnValue = '';
    modal.addEventListener('close', () => {
      if (modal.returnValue !== 'ok') return resolve(false);
      resolve(input != null ? inp.value.trim() : true);
    }, { once: true });
    modal.showModal();
    if (input != null) { inp.focus(); inp.select(); } else okBtn.focus();
  });
}
$('#modal-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); modal.close('ok'); }
});

/* ------------------------------------------------------------------ commands */

let loadedVersion = null;
function applySnap(snap) {
  if (!snap || typeof snap !== 'object') return;
  if (snap.version) {   // the clock was updated: reload this page to get the matching control page
    if (loadedVersion && snap.version !== loadedVersion) { location.reload(); return; }
    loadedVersion = snap.version;
  }
  if (S.snap && typeof snap.seq === 'number' && typeof S.snap.seq === 'number' && snap.seq < S.snap.seq) return;
  const prevSystem = S.snap && S.snap.system;
  S.snap = snap;
  feedPreviews();
  renderHeader();
  renderRun();
  renderAnthem();
  if (prevSystem !== snap.system) renderSlotsAndPresets();
}

async function send(cmd, arg) {
  try {
    const res = await api.command(cmd, arg);
    if (res && res.snapshot) applySnap(res.snapshot);
    return true;
  } catch (e) {
    toast(e.message || String(e), 'err', 2600);
    return false;
  }
}

const isBusy = () => !!(S.snap && S.snap.phase && S.snap.phase !== 'wait');

/* ------------------------------------------------------------------ settings save */

const syncers = new Set();
const onSync = (fn) => { syncers.add(fn); return fn; };
function syncAll() {
  if (!S.settings) return;
  for (const fn of syncers) { try { fn(S.settings); } catch (e) { console.error(e); } }
}

const dirty = new Set();
let saveTimer = null;
let saveInFlight = null;

function setValue(path, value, delay = 450) {
  if (!S.settings) return;
  setPath(S.settings, path, value);
  dirty.add(path.split('.')[0]);
  syncAll();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, delay);
}

async function flushSave() {
  saveTimer = null;
  if (!dirty.size) return;
  const patch = {};
  for (const top of dirty) patch[top] = clone(S.settings[top]);
  dirty.clear();
  const p = (async () => {
    try {
      const saved = await api.put('/api/settings', patch);
      if (saved && typeof saved === 'object' && !saveTimer && !dirty.size) {
        S.settings = saved;
        syncAll();
      }
      toast('Saved');
    } catch (e) {
      toast(`Not saved: ${e.message}`, 'err', 3500);
      try { S.settings = await api.get('/api/settings'); syncAll(); } catch {}
    }
  })();
  saveInFlight = p;
  await p;
  if (saveInFlight === p) saveInFlight = null;
}

let roundConfirmedAt = 0;
async function setRound(path, value) {
  if (getPath(S.settings, path) === value) return;
  if (isBusy() && Date.now() - roundConfirmedAt > 15000) {
    const ok = await ask({
      title: 'Stop the running end?',
      text: 'Changing the round stops the clock and puts it back to end 1.',
      ok: 'Change and reset',
      danger: true,
    });
    if (!ok) { syncAll(); return; }
    roundConfirmedAt = Date.now();
  }
  setValue(path, value);
}

function onSettingsEvent(s) {
  // Don't clobber edits the user is still making.
  if (saveTimer || dirty.size || saveInFlight) return;
  S.settings = s;
  if (!S.built) buildForms();
  syncAll();
  renderRun();
}

/* ------------------------------------------------------------------ form widgets */

function attachRepeat(btn, fn) {
  // Tap = one step; press and hold = auto-repeat (handy for 90 → 120).
  let t1 = null, t2 = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || btn.disabled) return;
    e.preventDefault();
    fn();
    let n = 0;
    t1 = setTimeout(() => { t2 = setInterval(() => fn(++n > 15 ? 5 : 1), 70); }, 420);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener('click', (e) => { if (e.detail === 0) fn(); }); // keyboard activation
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function numberField({ label, path, min = 0, max = 999, unit = 's', hold = false, help, dot, set = setRound, holdDefault = 0, step = 1 }) {
  const input = h('input', { type: 'number', inputmode: 'numeric', min, max, step, 'aria-label': label });
  const minus = h('button', { class: 'btn', type: 'button', 'aria-label': `Decrease ${label}` }, '−');
  const plus = h('button', { class: 'btn', type: 'button', 'aria-label': `Increase ${label}` }, '+');
  const field = h('div', { class: 'field' },
    h('label', { class: 'field-label' }, dot && h('span', { class: 'dot', style: `background:${dot}` }), label),
    h('div', { class: 'stepper-wrap' }, h('div', { class: 'stepper' }, minus, input, plus), unit && h('span', { class: 'unit' }, unit)));
  let lastReal = null;
  let holdBox = null;
  const cur = () => getPath(S.settings, path);
  const base = () => { const v = parseInt(input.value, 10); return Number.isFinite(v) ? v : (lastReal ?? min); };
  const commit = (v) => {
    v = clamp(Math.round(v), min, max);
    input.value = v;
    if (v !== cur()) set(path, v);
  };
  attachRepeat(minus, (k = 1) => commit(base() - step * k));
  attachRepeat(plus, (k = 1) => commit(base() + step * k));
  input.addEventListener('input', () => {
    const v = parseInt(input.value, 10);
    if (Number.isFinite(v) && v >= min && v <= max && v !== cur()) set(path, v);
  });
  input.addEventListener('change', () => commit(base()));
  input.addEventListener('focus', () => input.select());
  if (hold) {
    holdBox = h('input', { type: 'checkbox' });
    field.append(h('label', { class: 'toggle small' }, holdBox, h('span', { class: 'sw' }),
      h('span', { class: 'toggle-text' }, h('b', {}, 'Hold — wait for operator'))));
    holdBox.addEventListener('change', () => {
      if (holdBox.checked) set(path, -1);
      else set(path, lastReal ?? holdDefault);
    });
  }
  if (help) field.append(h('p', { class: 'field-help' }, help));
  onSync(() => {
    const v = cur();
    const isHold = hold && v === -1;
    field.classList.toggle('is-hold', isHold);
    if (holdBox) holdBox.checked = isHold;
    if (isHold) { input.value = ''; input.placeholder = 'hold'; return; }
    if (typeof v === 'number') lastReal = v;
    if (document.activeElement !== input) input.value = v ?? '';
  });
  return field;
}

function toggleField({ label, sub, path, set = setValue, invert = false }) {
  const box = h('input', { type: 'checkbox' });
  const el = h('label', { class: 'toggle' }, box, h('span', { class: 'sw' }),
    h('span', { class: 'toggle-text' }, h('b', {}, label), sub && h('span', {}, sub)));
  box.addEventListener('change', () => set(path, invert ? !box.checked : box.checked));
  onSync(() => { const v = !!getPath(S.settings, path); box.checked = invert ? !v : v; });
  return el;
}

function segmented({ path, options, set = setValue, label }) {
  const el = h('div', { class: 'segmented', role: 'group', 'aria-label': label || path });
  for (const o of options) {
    const b = h('button', { type: 'button', dataset: { v: JSON.stringify(o.value) } }, o.label);
    b.addEventListener('click', () => set(path, o.value));
    el.append(b);
  }
  onSync(() => {
    const v = JSON.stringify(getPath(S.settings, path));
    for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
  });
  return el;
}

function choiceCards({ path, options, set = setValue, cls = '' }) {
  const el = h('div', { class: `choices ${cls}` });
  for (const o of options) {
    const b = h('button', { type: 'button', class: 'choice', dataset: { v: JSON.stringify(o.value) } },
      o.icon && h('span', { class: 'choice-icon', html: o.icon }),
      h('span', { class: 'choice-title' }, o.title),
      o.sub && h('span', { class: 'choice-sub' }, o.sub),
      o.extra);
    b.addEventListener('click', () => set(path, o.value));
    el.append(b);
  }
  onSync(() => {
    const v = JSON.stringify(getPath(S.settings, path));
    for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
  });
  return el;
}

const field = (label, control, help) => h('div', { class: 'field' },
  h('span', { class: 'field-label' }, label), control, help && h('p', { class: 'field-help' }, help));
const card = (title, sub, ...kids) => h('div', { class: 'form-card' }, h('h2', {}, title), sub && h('p', { class: 'card-sub' }, sub), ...kids);
const showWhen = (el, pred) => { onSync((s) => { el.hidden = !pred(s); }); return el; };

/* ------------------------------------------------------------------ summaries */

const secs = (v) => (v === -1 ? 0 : v || 0);
function timeWords(red, green, orange, mult = 1) {
  const parts = [];
  parts.push(red === -1 ? 'preparation held until you press Next' : `${red} s preparation`);
  if (green === -1) parts.push(`shooting held until Next, then ${secs(orange)} s`);
  else {
    const total = (secs(green) + secs(orange)) * mult;
    parts.push(`${total} s to shoot`);
  }
  if (orange === -1) parts.push('holds at the end of green');
  else if (orange > 0) parts.push(`yellow at ${orange} s`);
  return parts;
}

function summarize(round, short = false) {
  if (!round) return '';
  const sys = round.system;
  if (sys === 'fita') {
    const f = round.fita || {};
    const L = layoutInfo(f.layout);
    const seq = L.id === 'TOP-BOTTOM' ? 'Top/Bottom' : L.id;
    const dbl = f.doubleEnds ? (f.doubleMode === 'time' ? 'double time' : 'double turns') : null;
    if (short) {
      const tot = (secs(f.green) + secs(f.orange)) * (f.doubleEnds && f.doubleMode === 'time' ? 2 : 1);
      return [seq, dbl, `${f.red === -1 ? 'hold' : f.red} + ${f.green === -1 ? 'hold' : tot} s`, f.practiceEnds ? `${f.practiceEnds} practice` : null].filter(Boolean).join(' · ');
    }
    const bits = [`<b>Target round</b> — ${escapeHtml(seq)} (${escapeHtml(L.sub)})`];
    if (dbl) bits.push(f.doubleMode === 'time' ? 'double time: each detail shoots all its arrows in one go' : `double ends: ${escapeHtml(L.groups.concat(L.groups).join('-'))}`);
    bits.push(f.practiceEnds ? plural(f.practiceEnds, 'practice end') : 'no practice ends');
    bits.push(timeWords(f.red, f.green, f.orange, f.doubleEnds && f.doubleMode === 'time' ? 2 : 1).join(', '));
    if (f.startEveryEndWithAB) bits.push('same order every end');
    return bits.join(' · ') + '.';
  }
  if (sys === 'finals') {
    const fi = round.finals || {};
    const per = fi.mode === 'perEnd';
    const t = (per ? fi.perEnd : fi.perArrow) || {};
    if (short) return `${per ? 'Team, per end' : 'Individual, per arrow'} · ${t.red} + ${secs(t.green) + secs(t.orange)} s · ${t.turns} ${per ? 'turns' : 'arrows'}`;
    const view = { both: 'both sides on one screen', left: 'this screen shows the left side only', right: 'this screen shows the right side only' }[fi.view] || '';
    const total = secs(t.green) + secs(t.orange);
    return [
      `<b>Finals</b> — ${per ? 'team, time per end' : 'individual, time per arrow'}`,
      per ? `${plural(t.turns, 'turn')} per side, ${total} s budget per side per end` : `${plural(t.turns, 'arrow')} each, ${total} s per arrow`,
      `${t.red} s preparation${t.orange > 0 ? `, yellow at ${t.orange} s` : ''}`,
      view,
    ].filter(Boolean).join(' · ') + '.';
  }
  if (sys === '25m1p') {
    const o = round.oneArrow || {};
    if (short) return `${o.archers} archers · ${o.red} + ${secs(o.green) + secs(o.orange)} s · ${o.practiceArrows} practice`;
    return [
      `<b>25m one arrow</b> — ${o.archers} archers shoot one arrow each in turn`,
      o.practiceArrows ? plural(o.practiceArrows, 'practice arrow') : 'no practice arrows',
      timeWords(o.red, o.green, o.orange).join(', '),
      o.alwaysStartWithArcher1 ? 'always starts with archer 1' : 'starting archer rotates each arrow',
    ].join(' · ') + '.';
  }
  if (sys === 'manual') {
    const m = round.manual || {};
    const sig = (n) => (n ? plural(n, 'signal') : 'no signal');
    if (short) return `Lights by hand · ${m.redSignals}/${m.orangeSignals}/${m.greenSignals} signals`;
    return `<b>Manual</b> — you switch the lights by hand · red gives ${sig(m.redSignals)}, yellow ${sig(m.orangeSignals)}, green ${sig(m.greenSignals)}.`;
  }
  return '';
}

/* ------------------------------------------------------------------ ROUND tab */

const ICONS = {
  fita: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f5c518"/><circle cx="12" cy="12" r="7" fill="#ef4444"/><circle cx="12" cy="12" r="4" fill="#3b8cff"/><circle cx="12" cy="12" r="1.5" fill="#fff"/></svg>',
  finals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z" fill="#f5c518" stroke="#f5c518"/><path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4" stroke="#f5c518"/><path d="M12 13v4M8.5 20h7" stroke="#f5c518"/></svg>',
  '25m1p': '<svg viewBox="0 0 24 24" fill="none" stroke="#8bd450" stroke-width="2.2" stroke-linecap="round"><path d="M3 20 19 4"/><path d="M14 4h5v5"/><path d="M3 20l1.5-4.5M3 20l4.5-1.5"/></svg>',
  manual: '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="3" fill="#2a3340"/><circle cx="12" cy="7" r="2.4" fill="#ef4444"/><circle cx="12" cy="12" r="2.4" fill="#f5c518"/><circle cx="12" cy="17" r="2.4" fill="#6ee05a"/></svg>',
};

function orderRows(L, f) {
  const n = L.groups.length;
  const dblTurns = f.doubleEnds && f.doubleMode !== 'time';
  const seqFor = (k) => {
    const g = f.startEveryEndWithAB ? L.groups : rotate(L.groups, k);
    return dblTurns ? g.concat(g) : g;
  };
  const row = (label, groups) => h('div', { class: 'order-row' }, h('span', {}, label),
    groups.map((g, i) => [i ? h('span', { class: 'arrow' }, '→') : null, h('span', { class: `grp${i === 0 ? ' first' : ''}` }, g)]));
  if (n === 1) return [row('Every', L.groups)];
  if (f.startEveryEndWithAB) return [row('Every', seqFor(0))];
  const lab = (i) => (dblTurns ? `${2 * i + 1}–${2 * i + 2}` : `End ${i + 1}`);
  const rows = [row(lab(0), seqFor(0)), row(lab(1), seqFor(1))];
  if (n >= 3) rows.push(h('div', { class: 'order-row' }, h('span', {}, ''), h('span', { class: 'arrow' }, `…rotates each end, back to the start after ${n} ends`)));
  return rows;
}

function timeBar(get) {
  const bar = h('div', { class: 'timebar' });
  const text = h('span', {});
  const el = h('div', { class: 'total-line' }, text, bar);
  onSync((s) => {
    const { red, green, orange, mult = 1, label = 'Per detail' } = get(s);
    const r = secs(red), g = secs(green) * mult, o = orange === -1 ? 0 : secs(orange);
    const tot = r + g + o * (mult);
    const shoot = g + o * mult;
    text.innerHTML = `${label}: <b>${red === -1 ? 'hold' : r + ' s'}</b> + <b>${green === -1 ? 'hold + ' + o + ' s' : shoot + ' s'}</b> shooting`;
    bar.replaceChildren(
      h('i', { style: `flex:${r || 0.0001};background:var(--red)` }),
      h('i', { style: `flex:${g || 0.0001};background:var(--green)` }),
      h('i', { style: `flex:${o * mult || 0.0001};background:var(--yellow)` }));
    bar.title = `${tot} s`;
  });
  return el;
}

function buildRound() {
  const root = $('#round-form');
  root.replaceChildren();
  const summary = $('#round-summary');
  onSync((s) => { summary.innerHTML = summarize(s.round); });

  root.append(card('Timing system', null, choiceCards({
    path: 'round.system', set: setRound, cls: 'systems',
    options: [
      { value: 'fita', title: 'Target round', sub: 'Details shoot in turn (AB / CD …). Most WA and club rounds.', icon: ICONS.fita },
      { value: 'finals', title: 'Finals (alternating)', sub: 'Two archers or teams shoot alternately, each with their own clock.', icon: ICONS.finals },
      { value: '25m1p', title: '25m one arrow', sub: '25m1P: each archer on the target shoots one arrow in turn.', icon: ICONS['25m1p'] },
      { value: 'manual', title: 'Manual', sub: 'No timer — you switch the lights and signals by hand.', icon: ICONS.manual },
    ],
  })));

  /* ---- FITA ---- */
  const fita = h('div', {});
  // F-key rounds first: tap to use, pencil to edit. The plain layouts follow under "More layouts".
  const keyBoxes = h('div', { class: 'choices layouts fkeys' });
  onSync(() => renderKeyBoxes(keyBoxes));
  const layoutCards = h('div', { class: 'choices layouts' });
  for (const L of LAYOUTS) {
    const order = h('div', { class: 'order' });
    const b = h('button', { type: 'button', class: 'choice', dataset: { v: L.id } },
      h('span', { class: 'choice-title' }, L.title), h('span', { class: 'choice-sub' }, L.sub), order);
    b.addEventListener('click', () => setRound('round.fita.layout', L.id));
    layoutCards.append(b);
    onSync((s) => {
      b.setAttribute('aria-pressed', String(s.round.fita.layout === L.id));
      order.replaceChildren(...orderRows(L, s.round.fita));
    });
  }
  const more = h('details', { class: 'more-layouts' }, h('summary', {}, 'More layouts'), layoutCards);
  fita.append(card('Detail order', 'Who shoots when. Tap a box to use it (or press its F-key on the clock); tap ✎ to change it.', keyBoxes, more));

  fita.append(card('Times', 'Shooting time is green + yellow: with 90 + 30 the clock shows 120 and turns yellow at 30.',
    h('div', { class: 'fields' },
      numberField({ label: 'Preparation (red)', path: 'round.fita.red', min: 0, max: 150, hold: true, holdDefault: 10, dot: 'var(--red)' }),
      numberField({ label: 'Shooting (green)', path: 'round.fita.green', min: 0, max: 450, hold: true, holdDefault: 90, dot: 'var(--green)', help: '0 = go straight to yellow.' }),
      numberField({ label: 'Warning (yellow)', path: 'round.fita.orange', min: 0, max: 150, hold: true, holdDefault: 30, dot: 'var(--yellow)' })),
    timeBar((s) => ({ ...s.round.fita, mult: s.round.fita.doubleEnds && s.round.fita.doubleMode === 'time' ? 2 : 1 })),
    h('p', { class: 'field-help', style: 'margin-top:10px' }, '“Hold” stops the clock in that phase until you press Next — useful when you need to wait for the field to clear.')));

  const dblExplain = h('div', { class: 'explain' });
  const dblBlock = h('div', { class: 'subgrid' },
    segmented({ path: 'round.fita.doubleMode', set: setRound, label: 'Double ends type', options: [{ value: 'turns', label: 'Double turns' }, { value: 'time', label: 'Double time' }] }),
    dblExplain,
    showWhen(toggleField({ label: 'Count each double-time end as two ends', sub: 'End numbers go 1, 3, 5… (World Archery 2 × 3-arrow style, as in the original). Off: 1, 2, 3.', path: 'round.fita.countDoubleAsTwo', set: setRound }),
      (s) => s.round.fita.doubleEnds && s.round.fita.doubleMode === 'time'));
  onSync((s) => {
    const f = s.round.fita; const L = layoutInfo(f.layout);
    const tot = secs(f.green) + secs(f.orange);
    dblBlock.hidden = !f.doubleEnds;
    dblExplain.innerHTML = f.doubleMode === 'time'
      ? `<b>Double time</b> — each detail shoots all its arrows in one go with double the time (${tot} × 2 = ${tot * 2} s, still yellow at ${secs(f.orange)} s).`
      : `<b>Double turns</b> — every detail shoots twice per end (${escapeHtml(L.groups.concat(L.groups).join(' → '))}), each with the normal time. The end counter counts 3-arrow halves, so one real end shows as ends 1 and 2.`;
  });
  fita.append(card('Ends', null,
    h('div', { class: 'fields' },
      numberField({ label: 'Practice ends', path: 'round.fita.practiceEnds', min: 0, max: 10, unit: 'ends', help: 'Shown with a “P”. Scoring ends then start at 1.' })),
    h('div', { class: 'subgrid' },
      toggleField({ label: 'Start every end with AB', sub: 'Keep the same order every end instead of rotating.', path: 'round.fita.startEveryEndWithAB', set: setRound }),
      toggleField({ label: 'Double ends', sub: 'Double time: all arrows in one go with twice the time. Double turns: each detail shoots twice before fetching arrows.', path: 'round.fita.doubleEnds', set: setRound })),
    dblBlock));

  fita.append(card('Shoot-off', 'Started from the Run page (1–6 arrows). Shooting time is multiplied by the number of arrows.',
    h('div', { class: 'fields' },
      numberField({ label: 'Preparation (red)', path: 'round.fita.shootoff.red', min: 0, max: 150, dot: 'var(--red)' }),
      numberField({ label: 'Green per arrow', path: 'round.fita.shootoff.green', min: 0, max: 450, dot: 'var(--green)' }),
      numberField({ label: 'Yellow per arrow', path: 'round.fita.shootoff.orange', min: 0, max: 150, dot: 'var(--yellow)' }))));
  root.append(showWhen(fita, (s) => s.round.system === 'fita'));

  /* ---- Finals ---- */
  const fin = h('div', {});
  fin.append(card('Finals type', null, choiceCards({
    path: 'round.finals.mode', set: setRound,
    options: [
      { value: 'perArrow', title: 'Individual — time per arrow', sub: 'A side’s clock resets to full every time it is their turn.' },
      { value: 'perEnd', title: 'Team — time per end', sub: 'Each side has a time budget for the whole end; it pauses while the other side shoots.' },
    ],
  })));
  for (const mode of ['perArrow', 'perEnd']) {
    const p = `round.finals.${mode}`;
    const c = card('Times', mode === 'perArrow' ? 'Per arrow, for each side.' : 'Time budget per side for the whole end.',
      h('div', { class: 'fields' },
        numberField({ label: mode === 'perArrow' ? 'Arrows per archer' : 'Turns per end', path: `${p}.turns`, min: 1, max: 99, unit: mode === 'perArrow' ? 'arrows' : 'turns' }),
        numberField({ label: 'Preparation (red)', path: `${p}.red`, min: 0, max: 150, dot: 'var(--red)' }),
        numberField({ label: mode === 'perArrow' ? 'Shooting per arrow (green)' : 'Shooting budget (green)', path: `${p}.green`, min: 0, max: 450, dot: 'var(--green)' }),
        numberField({ label: 'Warning (yellow)', path: `${p}.orange`, min: 0, max: 150, dot: 'var(--yellow)', help: '0 = no yellow warning.' })),
      timeBar((s) => ({ ...s.round.finals[mode], label: mode === 'perArrow' ? 'Per arrow' : 'Per side' })));
    fin.append(showWhen(c, (s) => s.round.finals.mode === mode));
  }
  const targetsRow = h('div', { class: 'fields' },
    numberField({ label: 'Left target number', path: 'round.finals.targets.left', min: 0, max: 999, unit: '' }),
    numberField({ label: 'Right target number', path: 'round.finals.targets.right', min: 0, max: 999, unit: '' }));
  showWhen(targetsRow, (s) => s.round.finals.showTargets && s.round.finals.view === 'both');
  fin.append(card('Screen', 'Use “left only” / “right only” when each side has its own screen.',
    segmented({ path: 'round.finals.view', set: setRound, label: 'Finals view', options: [{ value: 'both', label: 'Both sides' }, { value: 'left', label: 'Left only' }, { value: 'right', label: 'Right only' }] }),
    h('div', { class: 'subgrid' },
      showWhen(toggleField({ label: 'Show target numbers', sub: 'Shows which target is shooting (both-sides view only).', path: 'round.finals.showTargets', set: setRound }), (s) => s.round.finals.view === 'both'),
      targetsRow)));
  root.append(showWhen(fin, (s) => s.round.system === 'finals'));

  /* ---- 25m1P ---- */
  const one = h('div', {});
  one.append(card('Archers', 'Each archer on the target shoots one arrow, one after the other. The end counter shows the arrow number.',
    h('div', { class: 'subgrid', style: 'margin-top:0' },
      field('Archers per target', segmented({ path: 'round.oneArrow.archers', set: setRound, label: 'Archers per target', options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })) })),
      toggleField({ label: 'Always start with archer 1', sub: 'Off: the starting archer moves along by one every arrow.', path: 'round.oneArrow.alwaysStartWithArcher1', set: setRound }),
      h('div', { class: 'fields' }, numberField({ label: 'Practice arrows', path: 'round.oneArrow.practiceArrows', min: 0, max: 10, unit: 'arrows' })))));
  one.append(card('Times', 'For each archer’s arrow.',
    h('div', { class: 'fields' },
      numberField({ label: 'Preparation (red)', path: 'round.oneArrow.red', min: 0, max: 150, dot: 'var(--red)' }),
      numberField({ label: 'Shooting (green)', path: 'round.oneArrow.green', min: 0, max: 450, dot: 'var(--green)' }),
      numberField({ label: 'Warning (yellow)', path: 'round.oneArrow.orange', min: 0, max: 150, dot: 'var(--yellow)' })),
    timeBar((s) => ({ ...s.round.oneArrow, label: 'Per archer' }))));
  root.append(showWhen(one, (s) => s.round.system === '25m1p'));

  /* ---- Manual ---- */
  const sigOpts = [0, 1, 2, 3].map((n) => ({ value: n, label: n === 0 ? 'None' : String(n) }));
  const man = card('Signals', 'How many signals sound when you switch to each light on the Run page.',
    h('div', { class: 'subgrid', style: 'margin-top:0' },
      field(h('span', {}, h('span', { class: 'dot', style: 'background:var(--red);display:inline-block;margin-right:8px' }), 'Red'), segmented({ path: 'round.manual.redSignals', set: setRound, options: sigOpts })),
      field(h('span', {}, h('span', { class: 'dot', style: 'background:var(--yellow);display:inline-block;margin-right:8px' }), 'Yellow'), segmented({ path: 'round.manual.orangeSignals', set: setRound, options: sigOpts })),
      field(h('span', {}, h('span', { class: 'dot', style: 'background:var(--green);display:inline-block;margin-right:8px' }), 'Green'), segmented({ path: 'round.manual.greenSignals', set: setRound, options: sigOpts }))));
  root.append(showWhen(man, (s) => s.round.system === 'manual'));
}

/* ------------------------------------------------------------------ SCENARIOS tab */

const PENCIL = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

/* ---- F-key round boxes in Detail order ---- */

const KEY_FIELDS = ['layout', 'red', 'green', 'orange', 'practiceEnds', 'doubleEnds', 'doubleMode'];
function sameFita(a, b) { return KEY_FIELDS.every((k) => a[k] === b[k]); }
function fitaTimeText(f) {
  const shoot = (secs(f.green) + secs(f.orange)) * (f.doubleEnds && f.doubleMode === 'time' ? 2 : 1);
  const mins = shoot % 60 ? `${shoot} s` : `${shoot / 60} min`;
  return `${f.red === -1 ? 'hold' : secs(f.red) + ' s'} + ${f.green === -1 ? 'hold' : mins}` +
    (f.doubleEnds ? (f.doubleMode === 'time' ? ' · double time' : ' · double turns') : '');
}

function renderKeyBoxes(box) {
  const cur = S.settings.round;
  const slots = (S.scenarios || []).filter((x) => !x.empty && x.round && x.round.system === 'fita');
  const items = slots.map((sc) => {
    const f = sc.round.fita, L = layoutInfo(f.layout);
    const active = cur.system === 'fita' && sameFita(cur.fita, f);
    const edit = h('span', { class: 'icon-btn', role: 'button', tabindex: 0, title: `Edit ${sc.slot}`, html: PENCIL });
    const b = h('button', { type: 'button', class: 'choice fkey', 'aria-pressed': String(active) },
      h('span', { class: 'fkey-head' }, h('span', { class: 'keycap' }, sc.slot), edit),
      h('span', { class: 'choice-title' }, sc.name || sc.slot),
      h('span', { class: 'choice-sub' }, `${L.title} · ${fitaTimeText(f)}`),
      h('div', { class: 'order' }, ...orderRows(L, f)));
    const openEdit = (e) => { e.stopPropagation(); e.preventDefault(); editKeyRound(sc); };
    edit.addEventListener('click', openEdit);
    edit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openEdit(e); });
    b.addEventListener('click', async () => {
      if (!(await confirmLoad(sc.name || sc.slot))) return;
      if (await send('loadScenario', sc.slot)) { toast(`${sc.slot}: ${sc.name}`); S.settings = await api.get('/api/settings'); syncAll(); }
    });
    return b;
  });
  const free = (S.scenarios || []).find((x) => x.empty);
  if (free) {
    const add = h('button', { type: 'button', class: 'choice fkey fkey-add' }, h('span', { class: 'choice-title' }, `＋ Add ${free.slot}`),
      h('span', { class: 'choice-sub' }, 'Starts from the current round'));
    add.addEventListener('click', () => editKeyRound({ slot: free.slot, name: '', round: clone(S.settings.round), isNew: true }));
    items.push(add);
  }
  box.replaceChildren(...items);
}

let editorDlg = null;
function editKeyRound(sc) {
  const base = clone(sc.round && sc.round.system === 'fita' ? sc.round : S.settings.round);
  base.system = 'fita';
  const f = base.fita;
  if (!editorDlg) { editorDlg = h('dialog', { class: 'modal modal-wide' }); document.body.append(editorDlg); }
  const name = h('input', { type: 'text', maxlength: 60, value: sc.name || '', placeholder: 'e.g. Club night' });
  const layout = h('select', { class: 'text-input' }, ...LAYOUTS.map((L) => h('option', { value: L.id, selected: L.id === f.layout }, `${L.title} — ${L.sub}`)));
  const dbl = h('select', { class: 'text-input' },
    h('option', { value: 'off', selected: !f.doubleEnds }, 'Normal'),
    h('option', { value: 'time', selected: f.doubleEnds && f.doubleMode === 'time' }, 'Double time (all arrows in one go, twice the time)'),
    h('option', { value: 'turns', selected: f.doubleEnds && f.doubleMode !== 'time' }, 'Double turns (each detail shoots twice)'));
  const num = (label, val, min, max, holdOk) => {
    const i = h('input', { type: 'number', inputmode: 'numeric', min: holdOk ? -1 : min, max, value: val });
    return { i, el: h('label', { class: 'ed-field' }, h('span', {}, label + (holdOk ? ' (−1 = hold)' : '')), i) };
  };
  const red = num('Walk-up (red), s', f.red, 0, 150, true);
  const green = num('Shooting (green), s', f.green, 0, 450, true);
  const yellow = num('Warning (yellow), s', f.orange, 0, 150, true);
  const prac = num('Practice ends', f.practiceEnds, 0, 10, false);
  const total = h('p', { class: 'field-help' });
  const upd = () => {
    const g = Number(green.i.value), o = Number(yellow.i.value), m = dbl.value === 'time' ? 2 : 1;
    total.textContent = `Shooting time shown: ${(Math.max(0, g) + Math.max(0, o)) * m} s, yellow from ${Math.max(0, o)} s.`;
  };
  [green.i, yellow.i, dbl].forEach((x) => x.addEventListener('input', upd)); upd();
  const cancel = h('button', { class: 'btn', type: 'button' }, 'Cancel');
  const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Save');
  const reset = sc.isNew ? null : h('button', { class: 'btn btn-quiet', type: 'button', style: 'margin-right:auto' }, sc.builtIn ? 'Default' : 'Remove');
  editorDlg.replaceChildren(h('div', { class: 'modal-body' },
    h('h2', {}, `${sc.slot} — ${sc.isNew ? 'new round' : 'edit round'}`),
    h('label', { class: 'ed-field' }, h('span', {}, 'Name'), name),
    h('label', { class: 'ed-field' }, h('span', {}, 'Detail order'), layout),
    h('label', { class: 'ed-field' }, h('span', {}, 'Ends'), dbl),
    h('div', { class: 'ed-grid' }, red.el, green.el, yellow.el, prac.el),
    total,
    h('div', { class: 'modal-actions' }, reset, cancel, save)));
  cancel.addEventListener('click', () => editorDlg.close());
  if (reset) reset.addEventListener('click', async () => {
    try { await api.del(`/api/scenarios/${sc.slot}`); editorDlg.close(); toast(sc.builtIn ? `${sc.slot} back to default` : `${sc.slot} removed`); loadScenarios(); }
    catch (e) { toast(e.message, 'err'); }
  });
  save.addEventListener('click', async () => {
    const n = (i, lo, hi) => clamp(Math.round(Number(i.value) || 0), lo, hi);
    Object.assign(f, {
      layout: layout.value, red: n(red.i, -1, 150), green: n(green.i, -1, 450), orange: n(yellow.i, -1, 150),
      practiceEnds: n(prac.i, 0, 10), doubleEnds: dbl.value !== 'off', doubleMode: dbl.value === 'off' ? f.doubleMode : dbl.value,
    });
    const wasActive = !sc.isNew && S.settings.round.system === 'fita' && sameFita(S.settings.round.fita, sc.round.fita);
    try {
      await api.put(`/api/scenarios/${sc.slot}`, { name: name.value.trim() || sc.name || sc.slot, round: base });
      editorDlg.close();
      toast(`${sc.slot} saved`);
      await loadScenarios();
      if (wasActive && !isBusy()) { await send('loadScenario', sc.slot); S.settings = await api.get('/api/settings'); syncAll(); }
    } catch (e) { toast(`Not saved: ${e.message}`, 'err'); }
  });
  editorDlg.showModal();
  name.focus();
}

/* ---- password for other devices (Start-up tab) ---- */

/* ---- updates (Start-up tab) ---- */

function updatesCard() {
  const line = h('p', { class: 'update-line' });
  const notes = h('div', { class: 'explain update-notes' });
  const err = h('p', { class: 'field-help update-err' });
  const checkBtn = h('button', { class: 'btn', type: 'button' }, 'Check now');
  const installBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Install update');
  const why = h('p', { class: 'field-help' });
  let st = null;
  const render = () => {
    const u = st || (S.info && S.info.update) || {};
    const busy = isBusy() || !!(S.snap && S.snap.anthem && S.snap.anthem.playing);
    const when = u.checkedAt ? new Date(u.checkedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'not yet';
    line.innerHTML = u.status === 'downloading' ? `Downloading ${escapeHtml(u.latest || '')}…`
      : u.status === 'installing' ? `Installing ${escapeHtml(u.latest || '')}. The clock restarts by itself in about 15 seconds.`
      : u.available ? `<b>Update ${escapeHtml(u.latest)} available</b> (you have ${escapeHtml(u.current || '')}).`
      : `Version <b>${escapeHtml(u.current || (S.info && S.info.version) || '')}</b>, up to date. Last checked: ${escapeHtml(when)}.`;
    notes.hidden = !(u.available && u.notes);
    notes.textContent = u.notes || '';
    err.hidden = !u.error;
    err.textContent = u.error || '';
    installBtn.hidden = !u.available;
    installBtn.disabled = busy || ['downloading', 'installing'].includes(u.status) || !!u.devCopy;
    why.hidden = !(u.available && (busy || u.devCopy));
    why.textContent = u.devCopy ? 'This copy is a git checkout; update it with git pull.' : 'Install between ends (not while an end or the anthem is running).';
  };
  const refresh = async () => { try { st = await api.get('/api/update'); } catch {} render(); };
  checkBtn.addEventListener('click', async () => {
    checkBtn.disabled = true;
    try { st = await api.post('/api/update/check', {}); toast(st.available ? `Update ${st.latest} available` : 'Up to date'); }
    catch (e) { toast(e.message, 'err'); }
    checkBtn.disabled = false; render();
  });
  installBtn.addEventListener('click', async () => {
    const ok = await ask({ title: `Install ${st ? st.latest : 'the update'}?`, ok: 'Install now',
      text: 'The clock restarts by itself in about 15 seconds; your settings, rounds and password are kept. If the new version does not start, the old one is put back automatically.' });
    if (!ok) return;
    installBtn.disabled = true;
    try { await api.post('/api/update/install', {}); toast('Installing… the clock will restart'); } catch (e) { toast(e.message, 'err', 5000); }
    refresh();
  });
  onSync(render);
  refresh();
  setInterval(() => { if (S.view === 'startup') refresh(); }, 5000);
  return card('Updates', 'New versions come from GitHub. Your settings, rounds and password are never touched.',
    line, notes, err, h('div', { class: 'update-actions' }, checkBtn, installBtn), why,
    toggleField({ label: 'Install updates automatically at start-up', sub: 'When the clock computer starts and an update is waiting, install it before anyone shoots.', path: 'update.autoInstallAtStartup', set: setValue }));
}

function passwordCard() {
  const status = h('p', { class: 'field-help' });
  const warn = h('div', { class: 'explain warn' });
  const pw = (ph, ac) => h('input', { class: 'text-input', type: 'password', placeholder: ph, autocomplete: ac, maxlength: 100 });
  const cur = pw('Current password', 'current-password');
  const nw = pw('New password', 'new-password');
  const again = pw('New password again', 'new-password');
  const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Change password');
  const req = h('input', { type: 'checkbox' });
  const reqRow = h('label', { class: 'check-row' }, req, h('span', {}, 'Ask other devices for the password'));
  const out = h('button', { class: 'btn', type: 'button' }, 'Sign out this device');
  const render = () => {
    const s = S.session || {};
    status.textContent = s.local
      ? 'You are on the clock computer, which never needs the password.'
      : 'You are signed in on this device for 30 days.';
    warn.hidden = !(s.isDefault && s.required);
    warn.innerHTML = 'The password is still the default, <b>archery</b>. Change it so people on the network can’t run the clock.';
    cur.hidden = !!s.local;
    req.checked = s.required !== false;
    req.disabled = !s.local;
    reqRow.title = s.local ? '' : 'Can only be turned off on the clock computer';
    out.hidden = !!s.local;
  };
  save.addEventListener('click', async () => {
    if (nw.value.length < 4) return toast('Use at least 4 characters', 'err');
    if (nw.value !== again.value) return toast('The two new passwords don’t match', 'err');
    try {
      S.session = await api.put('/api/password', { password: nw.value, current: cur.value });
      cur.value = nw.value = again.value = '';
      toast('Password changed. Other devices must sign in again.');
      render();
    } catch (e) { toast(e.message, 'err', 3000); }
  });
  req.addEventListener('change', async () => {
    try { S.session = await api.put('/api/password', { required: req.checked }); toast(req.checked ? 'Password on' : 'Password off for other devices'); }
    catch (e) { toast(e.message, 'err'); }
    render();
  });
  out.addEventListener('click', async () => { await api.post('/api/logout', {}).catch(() => {}); location.href = '/login/'; });
  render();
  onSync(render);
  return card('Password for other devices', 'Phones, tablets and other computers must enter this password. The clock computer itself never does.',
    status, warn, h('div', { class: 'pw-grid' }, cur, nw, again, save), reqRow, out);
}

async function loadScenarios() {
  try { S.scenarios = await api.get('/api/scenarios'); renderSlotsAndPresets(); syncAll(); } catch {}
}

async function confirmLoad(what) {
  if (!isBusy()) return true;
  return ask({ title: `Load ${what}?`, text: 'The clock is running. Loading stops it and goes back to end 1.', ok: 'Load and reset', danger: true });
}

function renderSlotsAndPresets() {
  const grid = $('#slot-grid');
  if (!grid) return;
  const startup = S.settings && S.settings.start && S.settings.start.scenario;
  const bySlot = new Map((S.scenarios || []).map((x) => [x.slot, x]));
  grid.replaceChildren();
  for (let i = 1; i <= 12; i++) {
    const slot = `F${i}`;
    const sc = bySlot.get(slot) || { slot, empty: true };
    const empty = sc.empty || !sc.round;
    const saveBtn = h('button', { class: `btn btn-sm ${empty ? 'btn-primary' : ''}`, type: 'button' }, empty ? 'Save current round here' : 'Overwrite');
    saveBtn.addEventListener('click', async () => {
      const name = await ask({ title: `Save to ${slot}`, text: summarize(S.settings.round, true), input: empty ? '' : sc.name || '', ok: 'Save' });
      if (name === false) return;
      try {
        await api.put(`/api/scenarios/${slot}`, { name: name || `Scenario ${slot}` });
        toast(`Saved to ${slot}`);
        loadScenarios();
      } catch (e) { toast(e.message, 'err'); }
    });
    const head = h('div', { class: 'slot-head' }, h('span', { class: 'keycap' }, slot),
      h('span', { class: 'slot-name' }, empty ? 'Empty' : sc.name || slot),
      startup === slot ? h('span', { class: 'pill', style: 'margin-left:auto' }, 'Start-up') : null);
    if (empty) {
      saveBtn.textContent = 'Save here';
      saveBtn.className = 'btn btn-sm';
      grid.append(h('div', { class: 'slot empty' }, head, saveBtn));
      continue;
    }
    const loadBtn = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, 'Load');
    loadBtn.addEventListener('click', async () => {
      if (!(await confirmLoad(sc.name || slot))) return;
      if (await send('loadScenario', slot)) toast(`Loaded ${sc.name || slot}`);
    });
    const renBtn = h('button', { class: 'btn btn-sm icon-btn', type: 'button', title: 'Rename', 'aria-label': `Rename ${slot}`, html: PENCIL });
    renBtn.addEventListener('click', async () => {
      const name = await ask({ title: `Rename ${slot}`, input: sc.name || '', ok: 'Rename' });
      if (!name) return;
      try { await api.put(`/api/scenarios/${slot}`, { name, round: sc.round }); toast('Renamed'); loadScenarios(); } catch (e) { toast(e.message, 'err'); }
    });
    const delBtn = h('button', { class: 'btn btn-sm icon-btn', type: 'button', title: 'Delete', 'aria-label': `Delete ${slot}`, html: TRASH });
    delBtn.addEventListener('click', async () => {
      const ok = await ask({ title: `Delete ${sc.name || slot}?`, text: `${slot} will fall back to the built-in Shift+${slot} round.`, ok: 'Delete', danger: true });
      if (!ok) return;
      try { await api.del(`/api/scenarios/${slot}`); toast('Deleted'); loadScenarios(); } catch (e) { toast(e.message, 'err'); }
    });
    grid.append(h('div', { class: 'slot' }, head,
      h('p', { class: 'slot-sum' }, sc.summary || summarize(sc.round, true)),
      h('div', { class: 'slot-actions' }, loadBtn, saveBtn, renBtn, delBtn)));
  }

  const pg = $('#preset-grid');
  pg.replaceChildren();
  for (const p of S.presets || []) {
    const sys = p.round && p.round.system;
    const b = h('button', { class: 'card-btn', type: 'button', dataset: { current: String(startup === p.id) } },
      h('div', { class: 'slot-head' }, h('span', { class: 'keycap' }, p.key || p.id),
        h('span', { class: 'tag' }, startup === p.id ? 'Start-up' : (SYSTEMS[sys] ? SYSTEMS[sys].short : ''))),
      h('span', { class: 'slot-name', style: 'white-space:normal' }, p.name),
      h('span', { class: 'slot-sum' }, p.description || ''),
      p.summary ? h('span', { class: 'preset-sum' }, p.summary) : null);
    b.addEventListener('click', async () => {
      if (!(await confirmLoad(p.name))) return;
      if (await send('loadPreset', p.id)) toast(`Loaded ${p.name}`);
    });
    pg.append(b);
  }
  if (!(S.presets || []).length) pg.append(h('p', { class: 'note' }, 'Built-in rounds are not available.'));
}

/* ------------------------------------------------------------------ DISPLAY tab */

function buildDisplay() {
  const root = $('#display-form');
  root.replaceChildren();
  const themes = S.themes && S.themes.length ? S.themes : [{ id: 'classic', name: 'Classic', description: '' }];
  const grid = h('div', { class: 'theme-grid' });
  for (const t of themes) {
    const b = h('button', { type: 'button', class: 'choice theme-card', dataset: { v: JSON.stringify(t.id) } },
      // a still picture, not a live display: nine live theme displays at once crash phone browsers
      t.preview
        ? h('div', { class: 'preview preview-still' }, h('img', { src: t.preview, alt: `${t.name || t.id} theme`, loading: 'lazy', decoding: 'async' }))
        : h('div', { class: 'preview', dataset: { src: `/display/?preview=1&theme=${encodeURIComponent(t.id)}` } }),
      h('div', { class: 'theme-meta' }, h('span', { class: 'choice-title' }, t.name || t.id), t.description && h('span', { class: 'choice-sub' }, t.description)));
    b.addEventListener('click', () => setValue('display.theme', t.id, 0));
    grid.append(b);
  }
  onSync((s) => { for (const b of grid.children) b.setAttribute('aria-pressed', String(b.dataset.v === JSON.stringify(s.display.theme))); });
  root.append(card('Theme', 'Tap a theme to use it; the range display switches straight away.', grid));

  const sideSeg = segmented({ path: 'display.trafficSide', label: 'Traffic light side', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] });
  root.append(card('Layout', null,
    h('div', { class: 'subgrid', style: 'margin-top:0' },
      field('Time shown as', segmented({ path: 'display.timeFormat', label: 'Time format', options: [{ value: 'sec', label: 'Seconds  (120)' }, { value: 'min', label: 'Minutes  (2:00)' }] })),
      toggleField({ label: 'Traffic light', sub: 'Red / yellow / green lamps beside the digits. Always shown in manual mode.', path: 'display.trafficLight' }),
      showWhen(field('Traffic light side', sideSeg), (s) => s.display.trafficLight))));

  const banner = h('input', { class: 'text-input', type: 'text', maxlength: 80, placeholder: 'e.g. club name or event title' });
  let bt = null;
  banner.addEventListener('input', () => { clearTimeout(bt); bt = setTimeout(() => setValue('display.bannerText', banner.value, 600), 0); });
  onSync((s) => { if (document.activeElement !== banner) banner.value = s.display.bannerText || ''; });
  root.append(card('Text & icons', null,
    h('div', { class: 'subgrid', style: 'margin-top:0' },
      toggleField({ label: 'Show operator hints', sub: 'Small hints on the display about what the next key press does.', path: 'display.showHints' }),
      toggleField({ label: 'Show icons and labels', sub: 'Turn off for a cleaner screen (key H on the clock PC).', path: 'display.hideIcons', invert: true }),
      field('Banner text', banner, 'Shown on the display while waiting between ends.'))));

  root.append(card('Time of day', 'Shown on the display while waiting between ends, from the clock computer’s own clock.',
    h('div', { class: 'subgrid', style: 'margin-top:0' },
      field('Show', segmented({ path: 'display.clock', label: 'Time of day', options: [
        { value: 'off', label: 'Off' }, { value: 'time', label: 'Time' }, { value: 'datetime', label: 'Time and date' }] })),
      showWhen(field('Clock style', segmented({ path: 'display.clock24h', label: 'Clock style', options: [
        { value: false, label: '12-hour  (2:34 PM)' }, { value: true, label: '24-hour  (14:34)' }] })),
      (s) => s.display.clock !== 'off'),
      showWhen(toggleField({ label: 'Show seconds', sub: 'e.g. 14:34:07', path: 'display.clockSeconds' }), (s) => s.display.clock !== 'off'))));
}

/* ------------------------------------------------------------------ SOUND tab */

// Optional "preview on this device" using the display's synthesiser, if it is available.
let player = null;
let playerTried = false;
async function loadPlayer() {
  if (playerTried) return player;
  playerTried = true;
  try {
    const mod = await import('../shared/sound.js');
    if (typeof mod.createSoundPlayer === 'function') player = mod.createSoundPlayer();
  } catch { player = null; }
  return player;
}

function buildSound() {
  const root = $('#sound-form');
  root.replaceChildren();
  const list = SOUNDS.map((x) => ({ value: x.id, title: x.title, sub: x.sub }));
  const cur = S.settings.sound.sound;
  for (const id of new Set([...(S.customSounds || []), ...(cur && cur.startsWith('file:') ? [cur] : [])])) {
    if (id === 'file:Default.wav') list.unshift({ value: id, title: 'Default', sub: 'Original ArcheryClock sound' });
    else list.push({ value: id, title: id.replace(/^file:/, '').replace(/\.wav$/i, ''), sub: 'Custom file' });
  }
  const pickers = choiceCards({ path: 'sound.sound', options: list, cls: 'sound-grid', set: (p, v) => setValue(p, v, 0) });

  const vol = h('input', { type: 'range', min: 0, max: 100, step: 5, 'aria-label': 'Volume' });
  const volVal = h('span', { class: 'range-val' });
  vol.addEventListener('input', () => { volVal.textContent = `${vol.value}%`; setValue('sound.volume', vol.value / 100, 400); });
  onSync((s) => { if (document.activeElement !== vol) vol.value = Math.round((s.sound.volume ?? 1) * 100); volVal.textContent = `${vol.value}%`; });

  const test = h('button', { class: 'btn btn-primary btn-lg', type: 'button' },
    svg('<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', 'ico'),
    'Test on the clock');
  test.addEventListener('click', async () => {
    if (saveTimer) { clearTimeout(saveTimer); await flushSave(); }
    if (await send('testSound')) toast('Playing on the clock PC');
  });
  const local = h('button', { class: 'btn btn-lg', type: 'button' }, 'Preview on this device');
  local.addEventListener('click', previewLocally);
  const localHelp = h('p', { class: 'field-help' }, 'The preview plays through this phone or computer’s speaker, just to hear what it sounds like.');
  showWhen(local, () => !!player);
  showWhen(localHelp, () => !!player);

  root.append(card('Signals', null,
    toggleField({ label: 'Sound on', sub: 'Turn off for silent practice — lights and digits still work.', path: 'sound.enabled' })));
  const body = h('div', {},
    card('Sound', 'Played 1, 2 or 3 times, 1.5 seconds apart.', pickers),
    card('Volume', null, h('div', { class: 'range-row' }, vol, volVal),
      h('div', { class: 'btn-row', style: 'margin-top:14px' }, test, local), localHelp,
      h('p', { class: 'field-help', style: 'margin-top:8px' }, 'Custom sounds: drop .wav files into public/sounds/custom/ on the clock PC.')));
  root.append(showWhen(body, (s) => s.sound.enabled));
}

function previewLocally() {
  if (!player) return;
  const s = S.settings.sound;
  try { player.setSound(s.sound); player.setVolume(s.volume); player.play(1); }
  catch (e) { toast(`Could not play: ${e.message}`, 'err'); }
}

/* ------------------------------------------------------------------ START-UP tab */

function buildStartup() {
  const root = $('#startup-form');
  root.replaceChildren();
  const sel = h('select', { class: 'select', 'aria-label': 'Start-up scenario' });
  sel.addEventListener('change', () => setValue('start.scenario', sel.value, 0));
  onSync((s) => {
    const groups = [h('option', { value: '--' }, 'Keep the last round used (as set on the Round page)')];
    const user = (S.scenarios || []).filter((x) => !x.empty && x.round);
    if (user.length) groups.push(h('optgroup', { label: 'Your scenarios' }, user.map((x) => h('option', { value: x.slot }, `${x.slot} — ${x.name || x.slot}`))));
    groups.push(h('optgroup', { label: 'Built-in rounds' }, (S.presets || []).map((p) => h('option', { value: p.id }, `${p.key || p.id} — ${p.name}`))));
    const want = s.start.scenario;
    const known = ['--', ...(S.presets || []).map((p) => p.id), ...user.map((x) => x.slot)];
    if (want && !known.includes(want)) groups.unshift(h('option', { value: want }, want));
    if (document.activeElement !== sel) { sel.replaceChildren(...groups); sel.value = want; }
  });

  root.append(card('When the clock starts', 'What the clock loads when the PC starts.',
    h('div', { class: 'subgrid', style: 'margin-top:0' },
      field('Start-up round', sel),
      h('div', { class: 'fields' },
        numberField({ label: 'Match countdown', path: 'start.countdownMinutes', min: 0, max: 10, unit: 'min', set: setValue, help: 'The blue “Match starts in” countdown (Run page or key C).' })),
      toggleField({ label: 'Countdown between ends', sub: 'Target rounds only: start the match countdown automatically after every end.', path: 'start.countdownBetweenEnds' }))));

  const urls = h('div', { class: 'url-list' });
  const kv = h('dl', { class: 'kv' });
  const renderInfo = () => {
    const list = (S.info && S.info.urls) || [];
    urls.replaceChildren(...(list.length ? list : [location.origin + '/']).map((u) => {
      const b = h('button', { class: 'btn btn-sm', type: 'button' }, 'Copy');
      b.addEventListener('click', () => copyText(u));
      return h('div', { class: 'url-item' }, h('code', {}, u), b);
    }));
    kv.replaceChildren(h('dt', {}, 'Display (on the clock PC)'), h('dd', {}, h('code', {}, `http://localhost:${location.port || (S.settings && S.settings.server.port) || 80}/display/`)),
      h('dt', {}, 'Version'), h('dd', {}, (S.info && S.info.version) || '—'));
  };
  renderInfo();
  onSync(renderInfo);
  root.append(card('Connect another device', 'Open one of these on a phone or tablet on the same network to control the clock.', urls, kv));
  root.append(passwordCard());
  root.append(updatesCard());
  root.append(card('Location', 'Where the clock is used.',
    field('This clock is at', segmented({ path: 'venue', label: 'Location', options: [
      { value: 'public', label: 'Public location' }, { value: 'private', label: 'Private range' }] })),
    h('p', { class: 'field-help' }, 'Private range adds Music controls (Amazon Music or another music app on the clock computer) to the Run page. ' +
      'Streaming services are licensed for personal use; playing music to club members may still need a public-performance licence.')));

  root.append(card('Server', null, h('div', { class: 'fields' },
    numberField({ label: 'Port', path: 'server.port', min: 1, max: 65535, unit: '', set: setValue, help: 'Takes effect after the clock program is restarted.' }))));

  const appearance = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Appearance' });
  for (const [v, label] of [['dark', 'Dark'], ['light', 'Light']]) {
    const b = h('button', { type: 'button', dataset: { v } }, label);
    b.addEventListener('click', () => { setAppearance(v); syncAppearance(); });
    appearance.append(b);
  }
  const syncAppearance = () => { for (const b of appearance.children) b.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === b.dataset.v)); };
  syncAppearance();
  root.append(card('This device', 'Only changes how this control page looks.', field('Appearance', appearance)));
}

function setAppearance(v) {
  document.documentElement.dataset.theme = v;
  try { localStorage.setItem('nac.appearance', v); } catch {}
  $('meta[name="theme-color"]').content = v === 'light' ? '#eef1f5' : '#0c0f14';
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = h('textarea', { style: 'position:fixed;left:-999px;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast('Copied');
}

/* ------------------------------------------------------------------ header + RUN */

function fmtSecs(sec, fmt) {
  if (sec == null) return '––';
  return fmt === 'min' ? mmss(sec) : String(sec);
}

function headerTime(s) {
  if (s.phase === 'emergency' || s.emergency) return { text: 'STOP', color: 'red' };
  if (s.system === 'manual') return { text: s.light && s.light !== 'off' ? '●' : '—', color: { red: 'red', orange: 'orange', green: 'green' }[s.light] || 'idle' };
  if (s.phase === 'countdown') return { text: s.seconds == null ? '––' : mmss(s.seconds), color: 'blue' };
  if (s.system === 'finals' && s.finals) {
    const side = s.finals.active || s.finals.chosen;
    if (side && s.finals[side]) return { text: fmtSecs(s.finals[side].seconds, s.timeFormat), color: s.finals[side].color || s.digitColor };
  }
  return { text: fmtSecs(s.seconds, s.timeFormat), color: s.digitColor || 'idle' };
}

function renderHeader() {
  const s = S.snap;
  const up = s && s.update;
  $('#hdr-update').hidden = !(up && up.available);
  if (up && up.available) $('#hdr-update').textContent = `Update ${up.latest}`;
  const chip = $('#hdr-phase');
  const time = $('#hdr-time');
  if (!s) { chip.textContent = '—'; time.textContent = '––'; return; }
  chip.dataset.phase = s.phase;
  chip.dataset.paused = String(!!s.paused);
  chip.textContent = s.paused ? 'Paused' : s.hold ? 'Hold' : (PHASES[s.phase] || {}).chip || s.phase;
  if (s.system === 'manual' && s.phase === 'wait') {
    chip.dataset.phase = { red: 'red', orange: 'orange', green: 'green' }[s.light] || 'wait';
    chip.textContent = { red: 'Red', orange: 'Yellow', green: 'Green' }[s.light] || 'Lights off';
  }
  const t = headerTime(s);
  time.textContent = t.text;
  time.dataset.color = t.color;
  document.title = s.phase === 'wait' ? 'ArcheryClock Control' : `${t.text} · ${chip.textContent} — ArcheryClock`;
}

function nextLabel(s) {
  if (s.paused) return 'Resume';
  if (s.hold) return 'Continue';
  switch (s.phase) {
    case 'wait':
      if (s.system === 'finals') return s.finals && s.finals.chosen ? 'Start end' : 'Choose a side first';
      if (s.shootoff) return 'Start shoot-off';
      return s.system === '25m1p' ? 'Start arrow' : 'Start end';
    case 'countdown': return 'Start now';
    case 'emergency': return 'Emergency…';
    default:
      if (s.system === 'finals') return 'Next side';
      if (s.shootoff) return 'End shoot-off';
      if (s.turn && s.turn.number < s.turn.total) return s.system === '25m1p' ? 'Next archer' : 'Next detail';
      return 'End turn';
  }
}

function renderRun() {
  const s = S.snap;
  if (!s) return;
  const sys = s.system;
  const manual = sys === 'manual', finals = sys === 'finals';
  const connected = S.conn !== 'reconnecting';

  $('#st-system').textContent = (SYSTEMS[sys] || { short: sys }).short;
  const endEl = $('#st-end');
  if (s.end && s.end.visible !== false && !manual) {
    endEl.hidden = false;
    endEl.innerHTML = `${escapeHtml(s.end.label || 'End')} <b>${s.end.number}</b>${s.end.practice ? '<span class="practice-tag">P</span>' : ''}${finals && s.finals ? ` <span class="muted">of ${s.finals.turns}</span>` : ''}`;
  } else endEl.hidden = true;
  const turnEl = $('#st-turn');
  if (s.turn && s.turn.visible !== false && !manual && !finals && s.turn.total > 1) {
    turnEl.hidden = false;
    turnEl.innerHTML = `Turn <b>${s.turn.number}/${s.turn.total}</b>`;
  } else turnEl.hidden = true;
  const ph = $('#st-phase');
  ph.textContent = s.paused ? 'Paused' : s.hold ? 'Holding — press Next' : (PHASES[s.phase] || {}).name || s.phase;
  ph.dataset.color = s.phase === 'red' || s.phase === 'emergency' ? 'red' : s.phase === 'green' ? 'green' : s.phase === 'orange' ? 'orange' : s.phase === 'countdown' ? 'blue' : 'idle';
  const ht = headerTime(s);
  const stt = $('#st-time');
  stt.textContent = ht.text;
  stt.dataset.color = ht.color;
  if (s.shootoff) ph.textContent += ` · shoot-off ${plural(s.shootoff, 'arrow')}`;
  if (manual && s.phase === 'wait') {
    ph.textContent = { red: 'Red light', orange: 'Yellow light', green: 'Green light' }[s.light] || 'Lights off';
    ph.dataset.color = { red: 'red', orange: 'orange', green: 'green' }[s.light] || 'idle';
  }
  $('#hint').textContent = s.hint || '';
  $('#hint').hidden = !s.hint;

  const next = $('#btn-next');
  next.textContent = nextLabel(s);
  next.disabled = !connected || !s.canNext;
  const pause = $('#btn-pause');
  pause.querySelector('span').textContent = s.paused ? 'Resume' : 'Pause';
  pause.disabled = !connected || !s.canPause;
  $('#btn-stop').disabled = !connected || !s.canStop;
  $('#grp-main').hidden = manual;

  $('#grp-manual').hidden = !manual;
  for (const b of $$('#grp-manual .lamp')) b.dataset.on = String(s.light === b.dataset.arg);

  $('#grp-finals').hidden = !finals;
  if (finals && s.finals) {
    const f = s.finals;
    for (const side of ['left', 'right']) {
      const b = $(`#btn-${side}`);
      b.dataset.active = String(f.active === side);
      b.dataset.chosen = String(f.chosen === side);
      $(`#lbl-${side}`).textContent = f.primary ? (f.primary === side ? 'Primary' : 'Secondary') : '';
    }
    const wait = s.phase === 'wait';
    $('#btn-swap').disabled = !connected || !wait || !f.chosen;
    $('#btn-clear').disabled = !connected || !wait || !f.chosen;
  }

  $('#grp-counters').hidden = manual;
  $('#lbl-end').textContent = (s.end && s.end.label) || 'End';
  $('#val-end').innerHTML = s.end ? `${s.end.number}${s.end.practice ? '<span class="practice-tag">P</span>' : ''}` : '–';
  $('#ctr-turn').hidden = finals || !s.turn || s.turn.total <= 1;
  $('#val-turn').textContent = s.turn ? `${s.turn.number} / ${s.turn.total}` : '–';
  $('#btn-reset').hidden = finals;

  const extras = sys === 'fita' || sys === '25m1p';
  $('#grp-extras').hidden = !extras;
  const idle = s.phase === 'wait';
  for (const b of $$('#grp-extras [data-cmd="shootoff"]')) b.disabled = !connected || !idle;
  $('#btn-countdown').disabled = !connected || !(idle || s.phase === 'countdown');
  const mins = S.settings && S.settings.start ? S.settings.start.countdownMinutes : null;
  $('#lbl-countdown').textContent = mins != null ? `${mins} min` : '';

  for (const b of $$('#view-run [data-cmd]')) {
    if (['next', 'pause', 'stop', 'shootoff', 'countdown', 'finalsSwap', 'finalsClear'].includes(b.dataset.cmd)) continue;
    b.disabled = !connected;
  }
  $('#btn-emergency').disabled = !connected;
}

function wireRun() {
  $('#view-run').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (!b || b.disabled) return;
    const raw = b.dataset.arg;
    const arg = raw == null ? undefined : /^\d+$/.test(raw) ? Number(raw) : raw;
    send(b.dataset.cmd, arg);
  });

  // Emergency: press and hold so it can't be triggered by a stray tap.
  const em = $('#btn-emergency');
  const HOLD = 600;
  em.style.setProperty('--hold-ms', `${HOLD}ms`);
  let t = null, fired = false;
  const cancel = () => { clearTimeout(t); t = null; em.classList.remove('holding'); };
  em.addEventListener('pointerdown', (e) => {
    if (em.disabled || e.button !== 0) return;
    e.preventDefault();
    fired = false;
    try { em.setPointerCapture(e.pointerId); } catch {}
    em.classList.add('holding');
    t = setTimeout(() => {
      t = null; fired = true;
      em.classList.remove('holding');
      em.classList.add('fired');
      setTimeout(() => em.classList.remove('fired'), 600);
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      send('emergency');
    }, HOLD);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => em.addEventListener(ev, () => {
    if (t && ev === 'pointerup') toast('Keep holding to trigger EMERGENCY', 'ok', 1400);
    cancel();
  }));
  em.addEventListener('contextmenu', (e) => e.preventDefault());
  em.addEventListener('click', async (e) => {
    if (e.detail !== 0 || fired) return; // pointer presses are handled above
    if (await ask({ title: 'Emergency stop?', text: 'Stops shooting immediately: red light, 4 signals and STOP on the display.', ok: 'EMERGENCY', danger: true })) send('emergency');
  });
}

function onKey(e) {
  if (S.view !== 'run' || e.repeat || modal.open) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  const s = S.snap || {};
  const fin = s.system === 'finals';
  let cmd = null, arg;
  const k = e.key;
  const fk = /^F([1-9]|1[0-2])$/.exec(k);
  if (fk) { cmd = e.shiftKey ? 'loadPreset' : 'loadScenario'; arg = e.shiftKey ? `shift${k}` : k; }
  else switch (k) {
    case ' ': case 'Spacebar': cmd = 'next'; break;
    case 'PageDown': cmd = 'pageDown'; break; // server applies the finals meaning
    case 'PageUp': cmd = 'pageUp'; break;
    case 'p': case 'P': cmd = 'pause'; break;
    case 's': case 'S': cmd = 'stop'; break;
    case 'e': case 'E': cmd = 'emergency'; break;
    case 'c': case 'C': cmd = 'countdown'; break;
    case 'h': case 'H': cmd = 'toggleIcons'; break;
    case 'm': case 'M': cmd = 'toggleFormat'; break;
    case 'r': case 'R': cmd = 'manualLight'; arg = 'red'; break;
    case 'y': case 'Y': case 'o': case 'O': cmd = 'manualLight'; arg = 'orange'; break;
    case 'g': case 'G': cmd = 'manualLight'; arg = 'green'; break;
    case 'ArrowUp': cmd = 'endUp'; break;
    case 'ArrowDown': cmd = 'endDown'; break;
    case 'ArrowLeft': if (fin) { cmd = 'finalsSide'; arg = 'left'; } else cmd = 'turnDown'; break;
    case 'ArrowRight': if (fin) { cmd = 'finalsSide'; arg = 'right'; } else cmd = 'turnUp'; break;
    default:
      if (/^[1-6]$/.test(k)) { cmd = 'shootoff'; arg = Number(k); }
  }
  if (!cmd) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  send(cmd, arg);
}

/* ------------------------------------------------------------------ previews (scaled iframes) */

const BASE_W = 1280, BASE_H = 720;
const ro = new ResizeObserver((entries) => entries.forEach((en) => scalePreview(en.target)));
function scalePreview(p) {
  const f = p.querySelector('iframe');
  if (!f) return;
  const k = p.clientWidth / BASE_W;
  f.style.width = `${BASE_W}px`;
  f.style.height = `${BASE_H}px`;
  f.style.transform = `scale(${k})`;
}
function feedPreviews(target) {
  if (!S.snap) return;
  const msg = { type: 'ac-state', snap: S.snap };
  const frames = target ? [target] : $$('.preview iframe').map((f) => f.contentWindow);
  for (const w of frames) { try { w && w.postMessage(msg, location.origin); } catch {} }
}
window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data && e.data.type === 'ac-ready') feedPreviews(e.source);
});

function mountPreviews(root) {
  for (const p of $$('.preview[data-src]', root)) {
    if (p.querySelector('iframe')) continue;
    // previews are fed from this page (see feedPreviews) rather than each opening its own stream
    const src = p.dataset.src + (p.dataset.src.includes('?') ? '&' : '?') + 'feed=parent';
    const f = h('iframe', { src, title: 'Display preview', tabindex: '-1', 'aria-hidden': 'true', scrolling: 'no' });
    p.append(f);
    ro.observe(p);
    scalePreview(p);
  }
}
function unmountPreviews(root) {
  // Each preview holds an SSE connection; browsers allow only ~6 per host, so drop hidden ones.
  for (const p of $$('.preview[data-src]', root)) {
    const f = p.querySelector('iframe');
    if (f) { ro.unobserve(p); f.remove(); }
  }
}

/* ------------------------------------------------------------------ router */

const VIEWS = ['run', 'round', 'scenarios', 'display', 'sound', 'startup'];
function route() {
  const want = location.hash.replace(/^#\/?/, '');
  const view = VIEWS.includes(want) ? want : 'run';
  const changed = view !== S.view;
  S.view = view;
  for (const sec of $$('.view')) {
    const on = sec.dataset.view === view;
    sec.hidden = !on;
    if (on) mountPreviews(sec); else unmountPreviews(sec);
  }
  for (const a of $$('#tabs a')) {
    if (a.dataset.tab === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (view === 'scenarios') loadScenarios();
  if (view === 'startup') api.get('/api/info').then((i) => { S.info = i; syncAll(); }).catch(() => {});
  if (changed) window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ boot */

function buildForms() {
  if (!S.settings) return;
  syncers.clear();
  buildRound();
  buildDisplay();
  buildSound();
  buildStartup();
  onSync(() => renderSlotsAndPresets());
  S.built = true;
  syncAll();
  renderSlotsAndPresets();
  route();
}

function setConn(state) {
  S.conn = state;
  const dot = $('#conn');
  dot.dataset.state = state;
  dot.title = state === 'open' ? 'Connected to the clock' : state === 'reconnecting' ? 'Reconnecting…' : 'Connecting…';
  clearTimeout(setConn._t);
  if (state === 'open') $('#offline').hidden = true;
  else setConn._t = setTimeout(() => { $('#offline').hidden = S.conn === 'open'; }, 2500);
  renderRun();
}

/* ------------------------------------------------------------------ national anthem (Run tab) */

function wireMusic() {
  const go = async (cmd, arg) => {
    try { await api.command(cmd, arg); } catch (e) { toast(e.message, 'err', 4000); }
  };
  $('#btn-music-open').addEventListener('click', () => go('musicOpen'));
  $('#btn-music-play').addEventListener('click', () => go('musicKey', 'playPause'));
  $('#btn-music-next').addEventListener('click', () => go('musicKey', 'next'));
  $('#btn-music-prev').addEventListener('click', () => go('musicKey', 'previous'));
  onSync((s) => { $('#grp-music').hidden = s.venue !== 'private'; });
}

function wireAnthem() {
  $('#btn-anthem-play').addEventListener('click', () => send('anthemPlay', S.settings && S.settings.anthem ? S.settings.anthem.choice : undefined));
  $('#btn-anthem-stop').addEventListener('click', () => send('anthemStop'));
  const vol = $('#anthem-volume');
  vol.addEventListener('input', () => { $('#anthem-volume-val').textContent = `${vol.value}%`; setValue('anthem.volume', vol.value / 100, 300); });
  onSync((s) => {
    const v = Math.round(((s.anthem && s.anthem.volume) ?? 1) * 100);
    if (document.activeElement !== vol) vol.value = v;
    $('#anthem-volume-val').textContent = `${vol.value}%`;
    renderAnthem();
  });
  setInterval(renderAnthem, 1000);
}

function renderAnthem() {
  $('#grp-music').hidden = !(S.settings && S.settings.venue === 'private');
  const grp = $('#grp-anthem');
  const list = S.anthems || [];
  grp.hidden = !list.length;
  if (!list.length) return;
  const box = $('#anthem-versions');
  if (box.childElementCount !== list.length) {
    box.replaceChildren(...list.map((a) => {
      const b = h('button', { class: 'btn', type: 'button', dataset: { id: a.id }, title: a.performer || '' },
        h('span', null, a.title), h('small', null, a.performer || ''));
      b.addEventListener('click', () => setValue('anthem.choice', a.id, 0));
      return b;
    }));
  }
  const vol = $('#anthem-volume');
  if (S.settings && S.settings.anthem && document.activeElement !== vol) vol.value = Math.round((S.settings.anthem.volume ?? 1) * 100);
  $('#anthem-volume-val').textContent = `${vol.value}%`;
  const a = (S.snap && S.snap.anthem) || { playing: false };
  const choice = (S.settings && S.settings.anthem && S.settings.anthem.choice) || list[0].id;
  for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.id === (a.playing ? a.id : choice)));
  $('#btn-anthem-play').disabled = a.playing;
  $('#btn-anthem-stop').disabled = !a.playing;
  const prog = $('#anthem-progress');
  prog.hidden = !a.playing;
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  if (a.playing) {
    const el = Math.max(0, Math.min(a.durationSec, (Date.now() - a.startedAt) / 1000));
    $('#anthem-bar').style.width = `${(100 * el / a.durationSec).toFixed(1)}%`;
    $('#anthem-status').textContent = `· playing ${a.title} ${fmt(el)} / ${fmt(a.durationSec)}`;
  } else $('#anthem-status').textContent = '';
}

async function boot() {
  wireRun();
  wireAnthem();
  wireMusic();
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', route);
  route();

  const [settings, state, presets, scenarios, themes, info] = await Promise.allSettled([
    api.get('/api/settings'), api.get('/api/state'), api.get('/api/presets'),
    api.get('/api/scenarios'), api.get('/api/themes'), api.get('/api/info'),
  ]);
  try { const snd = await api.get('/api/sounds'); S.customSounds = (snd && snd.custom) || []; } catch { S.customSounds = []; }
  try { S.anthems = await api.get('/api/anthems'); } catch { S.anthems = []; }
  try { S.session = await api.get('/api/session'); } catch { S.session = {}; }
  if (S.session.isDefault && S.session.required && !S.session.local) setTimeout(() => toast('Please change the default password (Start-up tab)', 'err', 4000), 800);
  const val = (r, d) => (r.status === 'fulfilled' && r.value != null ? r.value : d);
  S.presets = val(presets, []);
  S.scenarios = val(scenarios, []);
  S.themes = [...val(themes, [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  S.info = val(info, null);
  if (settings.status === 'fulfilled') S.settings = settings.value;
  await loadPlayer();
  if (S.settings) buildForms();
  if (state.status === 'fulfilled') applySnap(state.value);

  connect({
    onState: applySnap,
    onSettings: onSettingsEvent,
    onSignal: () => {
      const dot = $('#conn');
      dot.animate([{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], { duration: 400 });
    },
    onStatus: (st) => {
      setConn(st);
      if (st === 'open') api.get('/api/state').then(applySnap).catch(() => {});
    },
  });
}

boot();
