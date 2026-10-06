// Classic theme — the original ArcheryClock 2.x screen.
// Geometry follows the original: everything is laid out in units of R/100, where R is the
// width of a 4:3 content block (see original-spec §4.4). The block (plus the lamp column)
// is scaled to fit the viewport and centred, so any aspect ratio works without overflow.

const COLORS = { idle: '#808080', red: '#FF0000', green: '#00FF00', orange: '#FFFF00', blue: '#0080FF' };
const LAMPS = ['red', 'orange', 'green'];

let root, ctx, els, ro, last = {};

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

function makeLight(parent, extra) {
  const col = h('div', 'cl-light ' + (extra || ''), parent);
  const lamps = {};
  for (const c of LAMPS) {
    const l = h('div', `cl-lamp cl-lamp-${c}`, col);
    h('div', 'cl-lens', l);
    lamps[c] = l;
  }
  return { col, lamps, lit: null };
}
function setLight(light, lit) {
  if (light.lit === lit) return;
  light.lit = lit;
  for (const c of LAMPS) toggle(light.lamps[c], 'on', c === lit);
}

/** Fixed-width digit cells so numbers never jitter. */
function makeDigits(parent, cls) {
  return { el: h('div', 'cl-digits ' + (cls || ''), parent), str: null, fmt: null };
}
function setDigits(d, str, color, suffix = '', secs = '') {
  if (d.str !== str + '|' + suffix + '|' + secs) {
    d.str = str + '|' + suffix + '|' + secs;
    d.el.textContent = '';
    for (const ch of str) h('span', ch === ':' ? 'cl-colon' : 'cl-d', d.el, ch);
    if (secs) {                       // time of day: smaller seconds with AM/PM under them
      const side = h('span', 'cl-side', d.el);
      h('span', 'cl-secs', side, secs);
      if (suffix) h('span', 'cl-ampm', side, suffix);
    } else if (suffix) h('span', 'cl-ampm', d.el, suffix);
    d.el.dataset.len = str.length;
    d.el.dataset.fmt = str.includes(':') ? 'min' : 'sec';
  }
  if (d.color !== color) { d.color = color; d.el.style.color = color; }
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('cl-root');
  const stage = h('div', 'cl-stage', root);
  const main = h('div', 'cl-main', stage);
  els = {
    stage, main,
    light: makeLight(stage, 'cl-light-main'),
    lightL: makeLight(stage, 'cl-light-fl'),
    lightR: makeLight(stage, 'cl-light-fr'),
    digits: makeDigits(main),
    letters: h('div', 'cl-letters', main),
    tb: h('div', 'cl-tb', main),
    archer: h('div', 'cl-archer', main),
    so: h('div', 'cl-so', main),
    endBox: h('div', 'cl-end', main),
    turnBox: h('div', 'cl-turn', main),
    bottom: h('div', 'cl-bottom', main),
    bigDate: h('div', 'cl-bigdate', main),
    countdown: h('div', 'cl-countdown', main),
    stop: h('div', 'cl-stop', main, 'STOP'),
    mark: h('div', 'cl-mark', main),
    finals: h('div', 'cl-finals', main),
  };
  els.tbBig = h('span', 'cl-tb-big', els.tb);
  els.tbSmall = h('span', 'cl-tb-small', els.tb);
  h('span', 'cl-archer-word', els.archer, 'Archer');
  els.archerNum = h('span', 'cl-archer-num', els.archer);
  h('span', 'cl-archer-word', els.so, 'Shoot-off');
  els.soNum = h('span', 'cl-archer-num', els.so);

  els.endLabel = h('div', 'cl-label', els.endBox, 'End');
  const endRow = h('div', 'cl-num-row', els.endBox);
  els.endP = h('span', 'cl-p', endRow, 'P');
  els.endNum = h('span', 'cl-num', endRow);
  els.turnLabel = h('div', 'cl-label', els.turnBox, 'Turn');
  els.turnNum = h('div', 'cl-num', els.turnBox);

  els.next = h('div', 'cl-next', els.bottom);
  h('span', 'cl-next-word', els.next, 'Next:');
  els.nextVal = h('span', 'cl-next-val', els.next);
  els.banner = h('div', 'cl-banner', els.bottom);
  els.date = h('div', 'cl-date', els.bottom);

  h('div', 'cl-cd-title', els.countdown, 'Match starts in');
  els.cdDigits = makeDigits(els.countdown, 'cl-cd-digits');
  h('div', 'cl-cd-title', els.countdown, 'Minutes');

  // finals (both screens)
  const f = els.finals;
  els.fl = {};
  for (const side of ['left', 'right']) {
    const s = {};
    s.timer = h('div', `cl-ftimer cl-ftimer-${side}`, f);
    s.digits = makeDigits(s.timer, 'cl-fdigits');
    s.arrow = h('div', `cl-farrow cl-farrow-${side}`, f);
    s.role = h('div', `cl-frole cl-frole-${side}`, f);
    s.target = h('div', `cl-ftarget cl-ftarget-${side}`, f);
    els.fl[side] = s;
  }
  els.fArrowLabel = h('div', 'cl-farrow-label', f, 'Arrow');
  els.fArrowNum = h('div', 'cl-farrow-num', f);
  els.fChoose = h('div', 'cl-fchoose', f, 'Choose starting side');
  els.fTime = makeDigits(f, 'cl-ftime');

  ro = new ResizeObserver(() => { last.layoutKey = null; if (last.snap) render(last.snap); });
  ro.observe(root);
}

function unmount() {
  if (ro) ro.disconnect();
  if (root) { root.textContent = ''; root.classList.remove('cl-root'); }
  root = els = ro = null; last = {};
}

function layout(mode, lightShown, side) {
  const W = root.clientWidth || window.innerWidth;
  const H = root.clientHeight || window.innerHeight;
  // stage width in units of R
  let wf = 1;
  if (mode === 'manual') wf = 0.34;
  else if (mode === 'finals') wf = lightShown ? 1.52 : 1;
  else wf = lightShown ? 1.25 : 1;
  const R = Math.min(H / 0.75, W / wf) * 0.97;
  const key = `${mode}|${lightShown}|${side}|${W}x${H}`;
  if (last.layoutKey === key) return;
  last.layoutKey = key;
  const st = els.stage.style;
  st.setProperty('--u', (R / 100) + 'px');
  st.width = (R * wf) + 'px';
  st.height = (R * 0.75) + 'px';
  st.left = ((W - R * wf) / 2) + 'px';
  st.top = ((H - R * 0.75) / 2) + 'px';
  const u = (n) => `calc(var(--u) * ${n})`;
  const m = els.main.style;
  const L = els.light.col.style;
  if (mode === 'manual') {
    show(els.main, false);
    L.left = u(6); L.top = u(1.5); L.setProperty('--lamp', u(23.5));
  } else if (mode === 'finals') {
    show(els.main, true);
    m.left = lightShown ? u(26) : '0px';
    els.lightL.col.style.left = u(1); els.lightR.col.style.left = u(128);
    for (const l of [els.lightL, els.lightR]) { l.col.style.top = u(1); l.col.style.setProperty('--lamp', u(22)); }
  } else {
    show(els.main, true);
    m.left = lightShown && side === 'left' ? u(25) : '0px';
    L.left = side === 'left' ? u(1) : u(102);
    L.top = u(1); L.setProperty('--lamp', u(22));
  }
}

function render(s) {
  if (!els || !s) return;
  last.snap = s;
  const d = s.display || {};
  const emergency = s.phase === 'emergency' || s.emergency;
  const finals = s.system === 'finals' && s.finals;
  const bothFinals = finals && s.finals.view === 'both' && !emergency;
  const manual = s.system === 'manual';
  const mode = manual && !emergency ? 'manual' : bothFinals ? 'finals' : 'std';
  const lightShown = manual || !!d.trafficLight;
  const side = d.trafficSide === 'left' ? 'left' : 'right';
  layout(mode, lightShown, side);
  root.dataset.mode = mode;
  root.dataset.phase = s.phase;
  toggle(root, 'cl-hide-labels', d.hideIcons);

  // traffic lights
  const single = finals && !bothFinals ? s.finals[s.finals.view] : null;
  show(els.light.col, mode !== 'finals' && lightShown);
  setLight(els.light, emergency ? 'red' : (single ? single.light : s.light));
  show(els.lightL.col, mode === 'finals' && lightShown);
  show(els.lightR.col, mode === 'finals' && lightShown);
  if (mode === 'finals') { setLight(els.lightL, s.finals.left.light); setLight(els.lightR, s.finals.right.light); }

  if (mode === 'manual') return;

  const countdown = s.phase === 'countdown';
  const wait = s.phase === 'wait';

  // time of day replaces the main digits between ends when enabled
  const clock = wait && !emergency && (d.clock === 'time' || d.clock === 'datetime')
    ? { mode: d.clock, h24: !!d.clock24h, secs: d.clockSeconds !== false, now: new Date() } : null;

  // main digits (standard + single-side finals)
  const stdDigits = mode === 'std' && !emergency && !countdown;
  let digitStr = '', digitColor = COLORS.idle;
  if (stdDigits) {
    if (single) { digitStr = ctx.formatTime(single.seconds, s.timeFormat); digitColor = COLORS[single.color] || COLORS.idle; }
    else { digitStr = s.seconds == null ? '' : ctx.formatTime(s); digitColor = COLORS[s.digitColor] || COLORS.idle; }
  }
  show(els.digits.el, stdDigits && (digitStr !== '' || !!clock));
  if (stdDigits && clock) clockFace(els.digits, clock, 98, 49, 20);
  else if (stdDigits) {
    if (last.clockFace) { els.digits.el.style.fontSize = ''; els.digits.el.style.top = ''; last.clockFace = false; }
    setDigits(els.digits, digitStr, digitColor);
  }

  // countdown panel
  show(els.countdown, countdown && !emergency);
  if (countdown) setDigits(els.cdDigits, ctx.formatTime(s.seconds, 'min'), COLORS.blue);

  // emergency
  show(els.stop, emergency);

  // details row
  const det = s.details || {};
  const detailsOn = mode === 'std' && !emergency && !countdown && !finals;
  const letters = detailsOn && det.kind === 'letters' && det.slots && det.slots.length >= 2;
  show(els.letters, letters);
  if (letters) {
    const key = det.slots.map((x) => x.letter + (x.active ? '1' : '0')).join('');
    if (last.letters !== key) {
      last.letters = key;
      els.letters.textContent = '';
      els.letters.dataset.n = det.slots.length;
      for (const sl of det.slots) h('span', 'cl-letter' + (sl.active ? ' on' : ''), els.letters, sl.letter);
    }
  }
  const tb = detailsOn && det.kind === 'topbottom' && det.topbottom;
  show(els.tb, !!tb);
  if (tb) { setText(els.tbBig, tb.big); setText(els.tbSmall, tb.small); }
  const archer = detailsOn && det.kind === 'archer' && det.archer != null;
  show(els.archer, archer);
  if (archer) setText(els.archerNum, det.archer);
  const so = detailsOn && s.shootoff && !letters && !tb && !archer;
  show(els.so, !!so);
  if (so) setText(els.soNum, s.shootoff);

  // end / turn
  const e = s.end || {};
  const endOn = mode === 'std' && e.visible !== false && e.number != null && !countdown && !emergency;
  show(els.endBox, endOn);
  if (endOn) {
    setText(els.endLabel, e.label || 'End');
    setText(els.endNum, finals ? s.finals.arrow : e.number);
    show(els.endP, !!e.practice);
  }
  // The turn number is not shown on the range display (the detail letters already say who shoots);
  // the operator still sees and changes it on the control page.
  show(els.turnBox, false);

  // bottom line: Next badge + banner (WAIT only)
  const nextOn = mode === 'std' && wait && !finals && !!det.next;
  const bannerOn = wait && !emergency && !!(d.bannerText && d.bannerText.trim());
  show(els.next, nextOn);
  if (nextOn) setText(els.nextVal, det.next);
  // Date: with no detail letters (single archer etc.) it gets the big middle row, centred under
  // the time; otherwise it goes on the bottom line. (The time itself replaces the main digits.)
  const rowFree = !letters && !tb && !archer && !so;
  const bigDate = !!clock && clock.mode === 'datetime' && rowFree;
  show(els.bigDate, bigDate);
  if (bigDate) {
    // two lines, "Tuesday" over "6 October", sized to fit between the End and Turn columns
    // (~74 units; Tahoma bold ≈ 0.6 em per character)
    const n = clock.now;
    const l1 = DAYS_LONG[n.getDay()], l2 = `${n.getDate()} ${MONTHS_LONG[n.getMonth()]}`;
    const key = l1 + '|' + l2;
    if (els.bigDate.dataset.k !== key) {
      els.bigDate.dataset.k = key;
      els.bigDate.textContent = '';
      h('div', null, els.bigDate, l1); h('div', null, els.bigDate, l2);
      els.bigDate.style.setProperty('--dfs', Math.min(12, 74 / (Math.max(l1.length, l2.length) * 0.6)).toFixed(2));
    }
  }
  let dateW = 0;
  show(els.date, !!clock && clock.mode === 'datetime' && !bigDate);
  if (clock && clock.mode === 'datetime' && !bigDate) {
    const c = clockText(clock.now, clock.h24, !bannerOn);
    setText(els.date, c.date);
    dateW = c.date.length * 0.6 * 4.8 + 3;
  }
  toggle(els.date, 'sep', bannerOn || nextOn);
  show(els.banner, bannerOn);
  if (bannerOn) {
    setText(els.banner, d.bannerText);
    const room = 96 - (nextOn ? 14 : 0) - dateW;   // in units; Tahoma bold averages ~0.6 em per character
    els.banner.style.setProperty('--bfs', Math.min(5.2, room / (d.bannerText.length * 0.6)).toFixed(2));
  }
  show(els.bottom, (nextOn || bannerOn || dateW > 0) && mode !== 'manual');
  toggle(els.bottom, 'cl-bottom-finals', mode === 'finals');

  // paused / hold mark
  const mark = emergency ? '' : s.paused ? 'PAUSED' : s.hold ? 'HOLD' : '';
  setText(els.mark, mark);
  show(els.mark, !!mark);

  // finals both screens
  const wasFinals = last.finalsShown;
  last.finalsShown = mode === 'finals';
  show(els.finals, mode === 'finals');
  if (mode === 'finals') {
    toggle(els.finals, 'cl-fclock', !!clock);
    show(els.fTime.el, !!clock);
    if (clock) clockFace(els.fTime, clock, 96, 40, null);
    // no zoom animation when the finals view first appears (or the layout changes) — only on side switches
    if (!wasFinals || last.finalsLayout !== last.layoutKey) {
      last.finalsLayout = last.layoutKey;
      els.finals.classList.add('cl-noanim');
      renderFinals(s);
      void els.finals.offsetWidth;
      requestAnimationFrame(() => els && els.finals.classList.remove('cl-noanim'));
    } else renderFinals(s);
  }
}

function renderFinals(s) {
  const f = s.finals;
  const running = !['wait'].includes(s.phase);
  const active = f.active || (running ? null : f.chosen);
  toggle(els.finals, 'act-left', active === 'left');
  toggle(els.finals, 'act-right', active === 'right');
  for (const side of ['left', 'right']) {
    const x = els.fl[side];
    const st = f[side] || {};
    setDigits(x.digits, finalsDigits(st.seconds, s.timeFormat), COLORS[st.color] || COLORS.idle);
    toggle(x.arrow, 'on', f.active === side && running);
    toggle(x.arrow, 'chosen', !running && f.chosen === side);
    const role = f.primary ? (f.primary === side ? 'Primary' : 'Secondary') : '';
    setText(x.role, role);
    toggle(x.role, 'primary', f.primary === side);
    show(x.target, !!f.showTargets);
    if (f.showTargets) {
      setText(x.target, f.targets ? f.targets[side] : '');
      toggle(x.target, 'on', f.active === side);
    }
  }
  setText(els.fArrowNum, f.arrow);
  setText(els.fArrowLabel, s.end && s.end.label ? s.end.label : 'Arrow');
  show(els.fChoose, !f.chosen && s.phase === 'wait');
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
function clockText(now, h24, long, secs) {
  const m = String(now.getMinutes()).padStart(2, '0');
  const H = now.getHours();
  const time = h24 ? `${String(H).padStart(2, '0')}:${m}` : `${H % 12 || 12}:${m}`;
  const sec = secs ? String(now.getSeconds()).padStart(2, '0') : '';
  const date = long ? `${DAYS_LONG[now.getDay()]} ${now.getDate()} ${MONTHS_LONG[now.getMonth()]}`
    : `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  return { time, sec, ampm: h24 ? '' : (H < 12 ? 'AM' : 'PM'), date };
}

/** Big silver time of day in a digit box `width` units wide; font capped at `maxFs` units.
 *  centreY: vertical centre of the glyphs (units) or null to keep the CSS position. */
function clockFace(d, clock, width, maxFs, centreY) {
  const c = clockText(clock.now, clock.h24, false, clock.secs);
  const digits = c.time.replace(/:/g, '').length, colons = c.time.length - digits;
  const ems = digits * 0.56 + 0.3 * colons + (c.sec ? 0.62 : c.ampm ? 0.42 : 0);
  const fs = Math.min(maxFs, width / ems);
  const st = d.el.style;
  const fsv = `calc(var(--u) * ${fs.toFixed(2)})`;
  if (st.fontSize !== fsv) st.fontSize = fsv;
  if (centreY != null) {
    // Tahoma: glyph top ≈ 0.17 em below the line top, digit height ≈ 0.727 em
    const top = `calc(var(--u) * ${(centreY - 0.5335 * fs).toFixed(2)})`;
    if (st.top !== top) st.top = top;
  }
  last.clockFace = true;
  setDigits(d, c.time, '#d8d8d8', c.ampm, c.sec);
}

// both-screens finals: 2 digits when the value fits, so the active timer can be really big
function finalsDigits(sec, fmt) {
  const str = ctx.formatTime(sec ?? 0, fmt);
  return fmt !== 'min' && str.length === 3 && str[0] === '0' ? str.slice(1) : str;
}

export default { mount, render, unmount };
