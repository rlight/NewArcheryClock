// Stadium theme — a modern sports-arena scoreboard.
// Phase-coloured header strip with the phase word, huge condensed digits, a progress bar that
// drains smoothly from remainingMs / phaseTotalMs, detail letters as tiles, a side rail with the
// end number and a compact traffic light. Digit sizes are fitted with container-query units
// (each digit box is a size container; JS only sets --ems, the width of the string in ems).

const COLORS = { idle: '#a9b6cc', red: '#ff3b30', green: '#2ee86a', orange: '#ffd60a', blue: '#3d8bff', amber: '#ffb000' };
const LAMPS = ['red', 'orange', 'green'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

let root, ctx, els, last = {};
let M = { dw: 0.48, gh: 0.72, k: 0.14, dy: 0 };   // measured digit metrics (em), see measureFont

/** Measure the digit glyph box of whichever font in the stack is actually used, so the numerals
 *  can be sized by their real height and centred exactly (no reliance on font line metrics). */
function measureFont() {
  const cs = getComputedStyle(root);
  const c = document.createElement('canvas').getContext('2d');
  c.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
  if ('fontStretch' in c) c.fontStretch = 'condensed';
  let w = 0, asc = 0, desc = 0, fA = 0, fD = 0;
  for (const ch of '0123456789') {
    const m = c.measureText(ch);
    w = Math.max(w, m.width);
    asc = Math.max(asc, m.actualBoundingBoxAscent);
    desc = Math.max(desc, m.actualBoundingBoxDescent);
    fA = m.fontBoundingBoxAscent; fD = m.fontBoundingBoxDescent;
  }
  if (!(asc > 10) || !(fA > 0)) return;            // canvas metrics unavailable: keep defaults
  const em = (x) => x / 100;
  const hl = (1 - em(fA) - em(fD)) / 2;             // half-leading with line-height 1
  const k = hl + em(fA) - em(asc);                  // glyph top below the line-box top
  const gh = em(asc) + em(desc);                    // glyph height
  M = { dw: em(w) + 0.07, gh, k, dy: 0.5 - (k + gh / 2) };
  const st = root.style;
  st.setProperty('--dw', M.dw.toFixed(3) + 'em');
  st.setProperty('--gh', M.gh.toFixed(3));
  st.setProperty('--dy', M.dy.toFixed(3) + 'em');
  st.setProperty('--subm', (M.k * 0.7 / 0.3).toFixed(3) + 'em');
}

function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function setText(e, t) { t = t == null ? '' : String(t); if (e.textContent !== t) e.textContent = t; }
function show(e, on) { const v = on ? '' : 'none'; if (e.style.display !== v) e.style.display = v; }
function toggle(e, cls, on) { e.classList.toggle(cls, !!on); }
function setVar(e, k, v) { if (e.style.getPropertyValue(k) !== v) e.style.setProperty(k, v); }
function setData(e, k, v) { v = v == null ? '' : String(v); if (e.dataset[k] !== v) e.dataset[k] = v; }

/** A size-container box with fixed-width digit cells inside (numbers never jitter). */
function makeDigits(parent, cls) {
  const box = h('div', 'st-dbox ' + (cls || ''), parent);
  return { box, el: h('div', 'st-digits', box), key: null };
}
function setDigits(d, str, sub = '') {
  const key = str + '|' + sub;
  if (d.key === key) return;
  d.key = key;
  d.el.textContent = '';
  let ems = 0;
  for (const ch of str) {
    const colon = ch === ':';
    h('span', colon ? 'st-colon' : 'st-d', d.el, ch);
    ems += colon ? 0.24 : M.dw;
  }
  if (sub) { h('span', 'st-sub', d.el, sub); ems += 0.36; }
  setVar(d.el, '--ems', ems.toFixed(2));
}

function makeLamps(parent, cls) {
  const col = h('div', 'st-lamps ' + (cls || ''), parent);
  const lamps = {};
  for (const c of LAMPS) lamps[c] = h('div', `st-lamp st-lamp-${c}`, col);
  return { col, lamps, lit: undefined };
}
function setLamps(l, lit) {
  if (l.lit === lit) return;
  l.lit = lit;
  for (const c of LAMPS) toggle(l.lamps[c], 'on', c === lit);
}

function makePanel(parent, cls, label) {
  const p = h('div', 'st-panel ' + (cls || ''), parent);
  const lbl = h('div', 'st-lbl', p, label);
  const val = h('div', 'st-val', p);
  return { p, lbl, val };
}
function setPanelVal(panel, txt) {
  setText(panel.val, txt);
  setData(panel.val, 'len', Math.min(4, Math.max(1, String(txt).length)));
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('st-root');
  const e = els = {};
  e.head = h('div', 'st-head', root);
  e.word = h('div', 'st-word', e.head);
  e.ctx = h('div', 'st-ctx', e.head);

  // ---- standard scoreboard
  e.body = h('div', 'st-body', root);
  e.main = h('div', 'st-main', e.body);
  e.digits = makeDigits(e.main, 'st-main-digits');
  e.cap = h('div', 'st-cap', e.main);
  e.bar = h('div', 'st-bar', e.main);
  e.fill = h('div', 'st-fill', e.bar);
  e.ribbon = h('div', 'st-ribbon', e.bar);
  e.det = h('div', 'st-det', e.main);
  e.rail = h('div', 'st-rail', e.body);
  e.endP = makePanel(e.rail, 'st-endp', 'End');
  e.light = makeLamps(e.rail, 'st-lamps-rail');

  e.foot = h('div', 'st-foot', root);
  e.next = h('div', 'st-next', e.foot);
  h('span', 'st-next-lbl', e.next, 'Next');
  e.nextVal = h('span', 'st-tile on', e.next);
  e.banner = h('div', 'st-banner', e.foot);

  // ---- manual mode: three big lamps
  e.manual = h('div', 'st-manual', root);
  e.mLamps = makeLamps(e.manual, 'st-lamps-big');

  // ---- finals, both screens
  e.fin = h('div', 'st-fin', root);
  e.fClock = makeDigits(e.fin, 'st-fclock');
  e.fs = {};
  for (const side of ['left', 'right']) {
    const p = h('div', `st-fp st-fp-${side}`, e.fin);
    const top = h('div', 'st-fp-top', p);
    const x = { p };
    x.side = h('span', 'st-fp-side', top, side === 'left' ? 'Left' : 'Right');
    x.role = h('span', 'st-fp-role', top);
    x.target = h('span', 'st-fp-target', top);
    x.digits = makeDigits(p, 'st-fp-digits');
    x.bar = h('div', 'st-bar st-fp-bar', p);
    x.fill = h('div', 'st-fill', x.bar);
    x.light = makeLamps(p, 'st-lamps-row');
    e.fs[side] = x;
  }
  e.fc = h('div', 'st-fc', e.fin);
  e.fArrowLbl = h('div', 'st-lbl', e.fc, 'Arrow');
  e.fArrow = h('div', 'st-fc-num', e.fc);
  e.fTurns = h('div', 'st-fc-of', e.fc);

  // ---- between-ends clock screen
  e.idle = h('div', 'st-idle', root);
  const im = h('div', 'st-imain', e.idle);
  e.iTime = makeDigits(im, 'st-itime');
  e.iDay = h('div', 'st-iday', im);
  e.iDate = h('div', 'st-idate', im);
  e.iBanner = h('div', 'st-ibanner', im);
  const ir = h('div', 'st-irail', e.idle);
  e.iEnd = makePanel(ir, 'st-ipanel', 'End');
  e.iNext = makePanel(ir, 'st-ipanel st-inext', 'Next');

  // ---- emergency
  measureFont();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (els) { measureFont(); for (const d of [e.digits, e.fClock, e.iTime, e.fs.left.digits, e.fs.right.digits]) d.key = null; } });
  e.stop = h('div', 'st-stop', root);
  h('div', 'st-stop-word', e.stop, 'STOP');
  h('div', 'st-stop-sub', e.stop, 'Emergency — stop shooting');
}

function unmount() {
  if (root) { root.textContent = ''; root.classList.remove('st-root'); delete root.dataset.mode; }
  root = els = null; last = {};
}

function phaseWord(color, s) {
  switch (color) {
    case 'red': return 'Walk up';
    case 'green': return 'Shoot';
    case 'orange': {
      const n = s.warningSeconds;
      return n > 0 ? `Last ${n}` : 'Warning';
    }
    case 'blue': return 'Match starts in';
    default: return 'Wait';
  }
}

function clockParts(now, h24, secs) {
  const H = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  let time = h24 ? `${String(H).padStart(2, '0')}:${m}` : `${H % 12 || 12}:${m}`;
  if (secs) time += ':' + String(now.getSeconds()).padStart(2, '0');
  return { time, ampm: h24 ? '' : (H < 12 ? 'AM' : 'PM') };
}

function progress(s, remainingMs, totalMs) {
  if (!totalMs || totalMs <= 0 || remainingMs == null) return s.hold ? 1 : 0;
  return Math.max(0, Math.min(1, remainingMs / totalMs));
}

function render(s) {
  if (!els || !s) return;
  const d = s.display || {};
  const emergency = s.phase === 'emergency' || !!s.emergency;
  const finals = s.system === 'finals' && s.finals ? s.finals : null;
  const manual = s.system === 'manual';
  const wait = s.phase === 'wait';
  const clockOn = d.clock === 'time' || d.clock === 'datetime';
  const idle = wait && !emergency && !finals && !manual && (s.system === 'fita' || s.system === '25m1p') && clockOn;
  const mode = emergency ? 'emergency' : manual ? 'manual' : finals && finals.view === 'both' ? 'finals' : idle ? 'idle' : 'std';
  setData(root, 'mode', mode);
  setData(root, 'side', d.trafficSide === 'left' ? 'left' : 'right');
  toggle(root, 'st-nolight', !d.trafficLight);
  toggle(root, 'st-nolabels', d.hideIcons);


  if (mode === 'emergency') { setVar(root, '--pc', COLORS.red); setData(root, 'phase', 'emergency'); return; }

  // single-side finals view: that side's timer and lamp drive the whole board
  const single = finals && finals.view !== 'both' ? finals[finals.view] : null;
  let color = s.phase === 'countdown' ? 'blue' : (single ? single.color : s.digitColor) || 'idle';
  if (manual) color = s.light === 'off' ? 'idle' : s.light;
  if (!COLORS[color]) color = 'idle';
  setData(root, 'phase', color);
  setVar(root, '--pc', COLORS[color]);

  // header strip
  let word = phaseWord(color, s);
  if (manual && color === 'idle') word = 'Manual';
  if (mode === 'finals' && wait && !finals.chosen) word = 'Choose starting side';
  setText(els.word, word);
  const e = s.end || {};
  let ctxTxt = '';
  if (s.shootoff && !finals) ctxTxt = `Shoot-off · ${s.shootoff} arrow${s.shootoff > 1 ? 's' : ''}`;
  else if (e.practice && !finals) ctxTxt = 'Practice';
  else if (finals) ctxTxt = finals.view === 'both' ? 'Finals' : `Finals · ${finals.view}`;
  else if (s.system === '25m1p') ctxTxt = '25 m · one arrow';
  setText(els.ctx, ctxTxt);

  if (mode === 'manual') { setLamps(els.mLamps, s.light); return; }
  if (mode === 'idle') { renderIdle(s, d); return; }
  if (mode === 'finals') { renderFinals(s, d, clockOn && wait); return; }

  // ---------------- standard board (incl. countdown and single-side finals)
  const countdown = s.phase === 'countdown';
  let str = '';
  if (single) str = ctx.formatTime(single.seconds, s.timeFormat);
  else if (countdown) str = ctx.formatTime(s.seconds, 'min');
  else if (s.seconds != null) str = ctx.formatTime(s);
  setDigits(els.digits, str);
  setData(els.digits.el, 'fmt', str.includes(':') ? 'min' : 'sec');
  toggle(els.digits.box, 'dim', s.paused);
  setText(els.cap, countdown ? 'Minutes' : '');
  show(els.cap, countdown);

  // progress bar
  const running = ['red', 'green', 'orange', 'countdown'].includes(s.phase) || (single && !wait);
  let frac = 0, rem = s.remainingMs;
  if (running) {
    // single-side finals: the shooting side uses the shared remainingMs; the waiting side is full
    if (single && finals.active !== finals.view) frac = 1;
    else frac = progress(s, rem, s.phaseTotalMs);
  }
  show(els.bar, running || s.hold);
  els.fill.style.transform = `scaleX(${frac.toFixed(4)})`;
  const barColor = (color === 'orange' || color === 'green') && rem != null && rem <= 5000 && !s.hold ? 'red' : color;
  setVar(els.bar, '--bc', COLORS[barColor]);
  const ribbon = s.paused ? 'Paused' : s.hold ? 'Hold' : '';
  setText(els.ribbon, ribbon);
  show(els.ribbon, !!ribbon);
  toggle(els.bar, 'ribbon', !!ribbon);

  // details row
  renderDetails(s, single, finals, countdown);

  // rail: end number + traffic light
  const endOn = e.visible !== false && (e.number != null || finals) && !countdown;
  show(els.endP.p, endOn);
  if (endOn) {
    setText(els.endP.lbl, finals ? 'Arrow' : (e.label || 'End'));
    setPanelVal(els.endP, finals ? finals.arrow : (e.practice ? 'P' : '') + e.number);
  }
  show(els.light.col, !!d.trafficLight);
  setLamps(els.light, single ? single.light : s.light);

  // footer: Next + banner (WAIT and match countdown)
  const det = s.details || {};
  const nextOn = (wait || countdown) && !finals && !!det.next;
  const banner = (d.bannerText || '').trim();
  const bannerOn = wait && !!banner;
  show(els.next, nextOn);
  if (nextOn) setText(els.nextVal, det.next);
  show(els.banner, bannerOn);
  if (bannerOn) {
    setText(els.banner, banner);
    setVar(els.banner, '--n', String(Math.max(12, banner.length)));
  }
  show(els.foot, nextOn || bannerOn);
}

function renderDetails(s, single, finals, countdown) {
  const det = s.details || {};
  let key = 'none', build = null;
  if (countdown) {
    key = 'none';
  } else if (single) {
    const role = finals.primary ? (finals.primary === finals.view ? 'Primary' : 'Secondary') : '';
    const tgt = finals.showTargets && finals.targets ? finals.targets[finals.view] : null;
    key = `fs|${role}|${tgt}|${finals.active === finals.view}`;
    build = (row) => {
      if (role) h('span', 'st-tag', row, role);
      if (tgt != null) { h('span', 'st-tag-lbl', row, 'Target'); h('span', 'st-tile on', row, tgt); }
    };
  } else if (det.kind === 'letters' && det.slots && det.slots.length >= 2) {
    key = 'L' + det.slots.map((x) => x.letter + (x.active ? '1' : '0')).join('');
    build = (row) => { for (const sl of det.slots) h('span', 'st-tile' + (sl.active ? ' on' : ''), row, sl.letter); };
  } else if (det.kind === 'topbottom' && det.topbottom) {
    const t = det.topbottom.big + det.topbottom.small;
    key = 'TB' + t;
    build = (row) => { h('span', 'st-tile st-wide on', row, t); };
  } else if (det.kind === 'archer' && det.archer != null) {
    key = 'A' + det.archer;
    build = (row) => { h('span', 'st-tag-lbl', row, 'Archer'); h('span', 'st-tile on', row, det.archer); };
  } else if (s.shootoff) {
    key = 'S' + s.shootoff;
    build = (row) => { h('span', 'st-tag-lbl', row, 'Shoot-off'); h('span', 'st-tile on', row, s.shootoff); };
  }
  if (last.det !== key) {
    last.det = key;
    els.det.textContent = '';
    if (build) build(els.det);
    setData(els.det, 'n', els.det.childElementCount);
  }
  show(els.det, !!build);
}

function renderFinals(s, d, clock) {
  const f = s.finals;
  const wait = s.phase === 'wait';
  const active = f.active || (wait ? f.chosen : null);
  toggle(els.fin, 'act-left', active === 'left');
  toggle(els.fin, 'act-right', active === 'right');
  toggle(els.fin, 'clock', clock);
  show(els.fClock.box, clock);
  if (clock) {
    const c = clockParts(new Date(), !!d.clock24h, d.clockSeconds !== false);
    setDigits(els.fClock, c.time, c.ampm);
  }
  for (const side of ['left', 'right']) {
    const x = els.fs[side];
    const st = f[side] || {};
    const col = COLORS[st.color] ? st.color : 'idle';
    setVar(x.p, '--pc', COLORS[col]);
    setData(x.p, 'phase', col);
    toggle(x.p, 'active', active === side);
    toggle(x.p, 'waiting', !!active && active !== side);
    let str = ctx.formatTime(st.seconds ?? 0, s.timeFormat);
    if (s.timeFormat !== 'min' && str.length === 3 && str[0] === '0') str = str.slice(1);
    setDigits(x.digits, str);
    toggle(x.digits.box, 'dim', s.paused);
    setText(x.role, f.primary ? (f.primary === side ? 'Primary' : 'Secondary') : '');
    toggle(x.role, 'primary', f.primary === side);
    show(x.target, !!f.showTargets);
    if (f.showTargets) setText(x.target, f.targets ? `Target ${f.targets[side]}` : '');
    // progress: the shooting side drains from the shared remainingMs; others sit full
    const shooting = f.active === side && !wait;
    const frac = shooting ? progress(s, s.remainingMs, s.phaseTotalMs) : 1;
    x.fill.style.transform = `scaleX(${frac.toFixed(4)})`;
    const bc = (col === 'green' || col === 'orange') && shooting && s.remainingMs != null && s.remainingMs <= 5000 ? 'red' : col;
    setVar(x.bar, '--bc', COLORS[bc]);
    show(x.light.col, !!d.trafficLight);
    setLamps(x.light, st.light);
  }
  setText(els.fArrowLbl, s.end && s.end.label ? s.end.label : 'Arrow');
  setText(els.fArrow, f.arrow);
  setText(els.fTurns, f.turns ? `of ${f.turns}` : '');
}

/** Between-ends screen: big time with seconds, weekday / date / year, banner, and a big
 *  End + Next column on the traffic-light side. */
function renderIdle(s, d) {
  const now = new Date();
  const c = clockParts(now, !!d.clock24h, d.clockSeconds !== false);
  setDigits(els.iTime, c.time, c.ampm);
  const withDate = d.clock === 'datetime';
  toggle(els.idle, 'nodate', !withDate);
  setText(els.iDay, withDate ? DAYS[now.getDay()] : '');
  setText(els.iDate, withDate ? `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}` : '');
  show(els.iDay, withDate); show(els.iDate, withDate);
  const banner = (d.bannerText || '').trim();
  setText(els.iBanner, banner);
  setVar(els.iBanner, '--n', String(Math.max(14, banner.length)));
  show(els.iBanner, !!banner);
  const e = s.end || {};
  setText(els.iEnd.lbl, e.label || 'End');
  setPanelVal(els.iEnd, (e.practice ? 'P' : '') + (e.number ?? ''));
  const next = s.details && s.details.next;
  show(els.iNext.p, !!next);
  if (next) setPanelVal(els.iNext, next);
  toggle(els.idle, 'single', !next);
}

export default { mount, render, unmount };
