// Daylight theme — maximum visibility outdoors. The whole screen is the phase colour (red / green /
// yellow / blue), the digits are as big as the screen allows, and a strip along the bottom carries
// the detail letters, the end number and the phase word. No traffic-light graphic: the screen IS
// the light. Everything is laid out in px from the root size; text is fitted with canvas metrics so
// the glyphs (not the font's line box) fill their boxes on any font that happens to be installed.

const BG = { idle: '#1d1d1f', red: '#e10600', green: '#00a651', orange: '#ffd200', blue: '#0057d9' };
const FG = { idle: '#ffffff', red: '#ffffff', green: '#ffffff', orange: '#000000', blue: '#ffffff' };
const DIGIT_FONT = 'Impact, "Arial Black", "Segoe UI Black", sans-serif';
const TEXT_FONT = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Impact, sans-serif';
const DIGIT_W = 400;   // Impact has a single weight; asking for bold would synthesise a smeared one
const TEXT_W = 900;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

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
function css(e, prop, v) { if (e.style[prop] !== v) e.style[prop] = v; }

// ---------------------------------------------------------------- text fitting

const cv = document.createElement('canvas').getContext('2d');
const metrics = new Map();
function measure(text, font, weight) {
  const k = `${weight}|${font}|${text}`;
  let m = metrics.get(k);
  if (m) return m;
  cv.font = `${weight} 100px ${font}`;
  const t = cv.measureText(text);
  m = {
    w: t.width || 1,
    asc: t.actualBoundingBoxAscent ?? 72, desc: t.actualBoundingBoxDescent ?? 0,
    fa: t.fontBoundingBoxAscent ?? 90, fd: t.fontBoundingBoxDescent ?? 21,
  };
  if (metrics.size > 400) metrics.clear();
  metrics.set(k, m);
  return m;
}
const tplOf = (s) => String(s).replace(/\d/g, '0');

/** Size + position `el` so its glyphs fill the box (x, y, w, h) as far as the aspect allows.
 *  o: { digits, tpl, extraW (fraction of measured width added, e.g. AM/PM), max (px), align, v } */
function place(el, text, x, y, w, h, o = {}) {
  const font = o.digits ? DIGIT_FONT : TEXT_FONT;
  const weight = o.digits ? DIGIT_W : TEXT_W;
  const m = measure(o.tpl != null ? o.tpl : o.digits ? tplOf(text) : text, font, weight);
  const gh = Math.max(1, m.asc + m.desc);
  let fs = Math.min(w / (m.w * (1 + (o.extraW || 0)) * 1.02), h / gh) * 100;
  if (o.max) fs = Math.min(fs, o.max);
  fs = Math.max(1, Math.floor(fs));
  const k = fs / 100;
  const baseline = (fs - (m.fa + m.fd) * k) / 2 + m.fa * k;      // in a line box of height fs
  const mid = baseline - ((m.asc - m.desc) / 2) * k;               // glyph centre in that box
  const glyphH = gh * k;
  const cy = o.v === 'top' ? y + glyphH / 2 : o.v === 'bottom' ? y + h - glyphH / 2 : y + h / 2;
  const key = `${fs}|${x}|${cy - mid}|${w}|${o.align || 'center'}|${font}`;
  if (el._k !== key) {
    el._k = key;
    const st = el.style;
    st.left = x + 'px'; st.width = w + 'px'; st.top = (cy - mid) + 'px';
    st.fontSize = fs + 'px'; st.lineHeight = fs + 'px';
    st.fontFamily = font; st.fontWeight = weight;
    st.textAlign = o.align || 'center';
  }
  return { fs, glyphH, glyphTop: cy - glyphH / 2 };
}

// ---------------------------------------------------------------- mount

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('dl-root');
  els = {};
  els.std = h('div', 'dl-layer', root);
  els.cap = h('div', 'dl-t dl-cap', els.std);
  els.big = h('div', 'dl-t dl-big', els.std);
  els.banner = h('div', 'dl-t dl-banner', els.std);

  // finals, both screens
  els.fin = h('div', 'dl-layer dl-fin', root);
  els.half = {};
  for (const side of ['left', 'right']) {
    const s = { bg: h('div', `dl-half dl-half-${side}`, els.fin) };
    s.tag = h('div', 'dl-t dl-ftag', s.bg);
    s.big = h('div', 'dl-t dl-fbig', s.bg);
    s.word = h('div', 'dl-t dl-fword', s.bg);
    els.half[side] = s;
  }
  els.fmid = h('div', 'dl-fmid', els.fin);
  els.fLab = h('div', 'dl-t dl-flab', els.fmid);
  els.fNum = h('div', 'dl-t dl-fnum', els.fmid);
  els.fArrow = h('div', 'dl-farrow', els.fmid);

  // between-ends clock screen
  els.idle = h('div', 'dl-layer dl-idle', root);
  els.iTime = h('div', 'dl-t dl-i-time', els.idle);
  els.iDay = h('div', 'dl-t dl-i-day', els.idle);
  els.iDate = h('div', 'dl-t dl-i-date', els.idle);
  els.iYear = h('div', 'dl-t dl-i-date', els.idle);
  els.iBanner = h('div', 'dl-t dl-i-banner', els.idle);
  els.iRule = h('div', 'dl-i-rule', els.idle);
  els.iEndLab = h('div', 'dl-t dl-i-lab', els.idle);
  els.iEnd = h('div', 'dl-t dl-i-end', els.idle);
  els.iNextLab = h('div', 'dl-t dl-i-lab dl-i-nextlab', els.idle, 'NEXT');
  els.iNext = h('div', 'dl-t dl-i-next', els.idle);

  // drain bar + bottom strip
  els.bar = h('div', 'dl-bar', root);
  els.barFill = h('div', 'dl-bar-fill', els.bar);
  els.strip = h('div', 'dl-strip', root);
  els.sLeft = h('div', 'dl-s-left', els.strip);
  els.sLab = h('span', 'dl-s-lab', els.sLeft);
  els.sVal = h('span', 'dl-s-val', els.sLeft);
  els.sMid = h('div', 'dl-s-mid', els.strip);
  els.sRight = h('div', 'dl-s-right', els.strip);
  els.sWord = h('span', 'dl-s-word', els.sRight);

  // emergency + paused/hold frame
  els.stop = h('div', 'dl-t dl-stop', root, 'STOP');
  els.haz = h('div', 'dl-haz', root);
  for (const sd of ['t', 'b', 'l', 'r']) h('div', 'dl-haz-' + sd, els.haz);

  ro = new ResizeObserver(() => { last.stripKey = null; if (last.snap) render(last.snap); });
  ro.observe(root);
}

function unmount() {
  if (ro) ro.disconnect();
  if (root) { root.textContent = ''; root.classList.remove('dl-root', 'dl-emerg'); root.removeAttribute('style'); }
  root = els = ro = null; last = {};
}

// ---------------------------------------------------------------- helpers

function setColors(el, color) {
  css(el, 'backgroundColor', BG[color] || BG.idle);
  css(el, 'color', FG[color] || FG.idle);
}

function orangeWord(s) {
  const n = Number(s.warningSeconds);
  return n > 0 ? `LAST ${n} SECONDS` : 'LAST SECONDS';
}

function phaseWord(s, color, seconds) {
  if (s.phase === 'red') return 'WALK UP';
  if (color === 'green') return 'SHOOT';
  if (color === 'orange') return orangeWord(s);
  if (color === 'red') return 'WAIT';
  return '';
}

function clockParts(d, withSecs) {
  const now = new Date();
  const H = now.getHours(), M = String(now.getMinutes()).padStart(2, '0');
  let time = d.clock24h ? `${String(H).padStart(2, '0')}:${M}` : `${H % 12 || 12}:${M}`;
  if (withSecs && d.clockSeconds !== false) time += ':' + String(now.getSeconds()).padStart(2, '0');
  return { now, time, ampm: d.clock24h ? '' : (H < 12 ? 'AM' : 'PM') };
}
function setTime(el, c) {
  const key = c.time + c.ampm;
  if (el._t === key) return;
  el._t = key;
  el.textContent = c.time;
  if (c.ampm) h('span', 'dl-ampm', el, c.ampm);
}

/** Bottom strip: left = label + value, mid = detail letters etc., right = phase word / pill. */
function renderStrip(W, H, Hs, st) {
  const key = JSON.stringify(st) + `|${W}x${H}`;
  if (last.stripKey === key) return;
  last.stripKey = key;
  const s = els.strip.style;
  s.height = Hs + 'px';
  s.padding = `0 ${Math.round(Hs * 0.32)}px`;
  s.gap = Math.round(Hs * 0.5) + 'px';
  toggle(els.strip, 'dl-strip-dark', st.dark);

  show(els.sLeft, !!(st.lab || st.val));
  setText(els.sLab, st.lab); setText(els.sVal, st.val);
  els.sLab.style.fontSize = Math.round(Hs * 0.3) + 'px';
  els.sVal.style.fontSize = Math.round(Hs * (st.valSmall ? 0.5 : 0.78)) + 'px';
  els.sVal.style.fontFamily = st.valDigits ? DIGIT_FONT : '';
  els.sVal.style.fontWeight = st.valDigits ? DIGIT_W : '';

  const mid = els.sMid;
  mid.textContent = '';
  mid.style.gap = Math.round(Hs * 0.22) + 'px';
  for (const it of st.mid || []) {
    const e = h('span', 'dl-s-item' + (it.cls ? ' ' + it.cls : ''), mid, it.t);
    e.style.fontSize = Math.round(Hs * (it.size || 0.78)) + 'px';
  }
  show(mid, !!(st.mid && st.mid.length));

  setText(els.sWord, st.word);
  toggle(els.sWord, 'dl-pill', !!st.pill);
  show(els.sRight, !!st.word);
  if (st.word) {
    // fit the word into whatever width the left and middle parts leave over
    const avail = Math.max(10, els.sRight.clientWidth - (st.pill ? Hs * 0.5 : 0));
    const m = measure(st.word, TEXT_FONT, TEXT_W);
    const fs = Math.min(Hs * (st.pill ? 0.5 : 0.62), (avail / m.w) * 100 * 0.98);
    els.sWord.style.fontSize = Math.floor(fs) + 'px';
  }
}

function detailItems(s) {
  const det = s.details || {};
  if (det.kind === 'letters' && det.slots && det.slots.length >= 2)
    return det.slots.map((x) => ({ t: x.letter, cls: x.active ? 'on' : 'off' }));
  if (det.kind === 'topbottom' && det.topbottom)
    return [{ t: (det.topbottom.big + det.topbottom.small).toUpperCase(), cls: 'on' }];
  if (det.kind === 'archer' && det.archer != null)
    return [{ t: 'ARCHER', cls: 'lab', size: 0.32 }, { t: String(det.archer), cls: 'on' }];
  if (s.shootoff) return [{ t: 'SHOOT-OFF', cls: 'lab', size: 0.32 }, { t: String(s.shootoff), cls: 'on' }];
  return [];
}

function endParts(s) {
  const e = s.end || {};
  if (e.visible === false || e.number == null) return { lab: '', val: '' };
  const num = s.system === 'finals' && s.finals ? s.finals.arrow : e.number;
  return { lab: (e.label || 'End').toUpperCase(), val: (e.practice ? 'P' : '') + num };
}

// ---------------------------------------------------------------- render

function render(s) {
  if (!els || !s) return;
  last.snap = s;
  const W = root.clientWidth || window.innerWidth;
  const H = root.clientHeight || window.innerHeight;
  const d = s.display || {};
  const emergency = s.phase === 'emergency' || !!s.emergency;
  const finals = s.system === 'finals' && s.finals ? s.finals : null;
  const manual = s.system === 'manual';
  const wait = s.phase === 'wait';
  const clockOn = d.clock === 'time' || d.clock === 'datetime';
  const idle = wait && !emergency && !finals && !manual && (s.system === 'fita' || s.system === '25m1p') && clockOn;
  const bothFinals = finals && finals.view === 'both' && !emergency && !manual;
  const mode = emergency ? 'emerg' : manual ? 'manual' : idle ? 'idle' : bothFinals ? 'finals' : 'std';

  toggle(root, 'dl-emerg', mode === 'emerg');
  show(els.std, mode === 'std' || mode === 'manual');
  show(els.fin, mode === 'finals');
  show(els.idle, mode === 'idle');
  show(els.stop, mode === 'emerg');
  // a green hold is shooting with no time limit: it must never look like "stop"
  const greenHold = !!s.hold && !s.paused && s.phase === 'green';
  const framed = !emergency && (s.paused || (s.hold && !greenHold));
  show(els.haz, framed);
  const T = Math.round(Math.min(W, H) * 0.035);
  if (framed) els.haz.style.setProperty('--t', T + 'px');

  const Hs = Math.round(H * 0.17);

  if (mode === 'emerg') {
    setColors(root, 'red');
    show(els.strip, false); show(els.bar, false);
    place(els.stop, 'STOP', W * 0.05, H * 0.12, W * 0.9, H * 0.76);
    last.prevPhase = s.phase;
    return;
  }

  if (mode === 'manual') {
    const lc = s.light === 'orange' ? 'orange' : s.light === 'red' ? 'red' : s.light === 'green' ? 'green' : 'idle';
    setColors(root, lc);
    show(els.strip, false); show(els.bar, false);
    show(els.cap, false); show(els.banner, false);
    const word = { red: 'RED', orange: 'YELLOW', green: 'GREEN' }[lc] || '';
    setText(els.big, word);
    show(els.big, !!word);
    if (word) place(els.big, word, W * 0.06, H * 0.2, W * 0.88, H * 0.6);
    last.prevPhase = s.phase;
    return;
  }

  if (mode === 'idle') {
    setColors(root, 'idle');
    show(els.bar, false); show(els.strip, false);
    renderIdle(s, d, W, H);
    last.prevPhase = s.phase;
    return;
  }

  if (mode === 'finals') {
    setColors(root, 'idle');
    renderFinals(s, d, W, H, Hs, clockOn);
    last.prevPhase = s.phase;
    return;
  }

  // ---- standard (fita, 25m1p, single-side finals)
  const single = finals ? finals[finals.view] || finals.left : null;
  const countdown = s.phase === 'countdown';
  let color, seconds, digitStr;
  if (countdown) { color = 'blue'; seconds = s.seconds; digitStr = ctx.formatTime(s.seconds, 'min'); }
  else if (single) { color = single.color || 'idle'; seconds = single.seconds; digitStr = ctx.formatTime(single.seconds, s.timeFormat); }
  else { color = wait ? 'idle' : s.digitColor || 'idle'; seconds = s.seconds; digitStr = s.seconds == null ? '' : ctx.formatTime(s); }
  if (!BG[color]) color = 'idle';
  setColors(root, color);

  const det = s.details || {};
  const ep = endParts(s);
  const banner = wait ? (d.bannerText || '').trim() : greenHold ? 'NO TIME LIMIT' : '';
  let word = countdown ? (det.next ? `NEXT ${det.next}` : '')
    : wait ? (det.next && !finals ? `NEXT ${det.next}` : finals && !finals.chosen ? 'CHOOSE SIDE' : 'WAIT')
    : phaseWord(s, color, seconds);
  let pill = false;
  if (s.paused) { word = 'PAUSED'; pill = true; }
  const mid = finals || countdown ? [] : detailItems(s);
  const clock = wait && clockOn ? clockParts(d, false) : null;   // finals single view between arrows
  if (clock) mid.push({ t: clock.time + (clock.ampm ? ' ' + clock.ampm : ''), cls: 'clock', size: 0.5 });
  const showEnd = !countdown;
  const ins = framed ? T : 0;
  for (const e of [els.strip, els.bar]) { e.style.left = ins + 'px'; e.style.right = ins + 'px'; }
  els.strip.style.bottom = ins + 'px';
  show(els.strip, true);
  renderStrip(W, H, Hs, {
    lab: showEnd ? ep.lab : '', val: showEnd ? ep.val : '', mid, word, pill, ins, dark: color === 'idle',
  });

  // drain bar
  const total = s.phaseTotalMs, rem = s.remainingMs;
  const barOn = !wait && !s.hold && total > 0 && rem != null;
  const Hb = Math.max(4, Math.round(H * 0.022));
  show(els.bar, barOn);
  if (barOn) {
    els.bar.style.bottom = (Hs + ins) + 'px';
    els.bar.style.height = Hb + 'px';
    css(els.barFill, 'width', (Math.max(0, Math.min(1, rem / total)) * 100).toFixed(2) + '%');
  }

  // main area
  const topY = ins + H * 0.025;
  const botY = H - ins - Hs - (barOn ? Hb : 0) - H * 0.025;
  let y0 = topY, y1 = botY;
  show(els.cap, countdown);
  if (countdown) {
    const ch = (y1 - y0) * 0.13;
    setText(els.cap, 'MATCH STARTS IN');
    place(els.cap, 'MATCH STARTS IN', W * 0.1, y0, W * 0.8, ch);
    y0 += ch * 1.35;
  }
  show(els.banner, !!banner);
  if (banner) {
    const bh = (y1 - y0) * 0.12;
    setText(els.banner, banner);
    place(els.banner, banner, ins + W * 0.04, y1 - bh, W - 2 * ins - W * 0.08, bh);
    y1 -= bh * 1.5;
  }
  let bigTxt = digitStr, digits = true;
  if (greenHold) { bigTxt = 'SHOOT'; digits = false; }
  else if (s.hold) { bigTxt = 'HOLD'; digits = false; }
  show(els.big, !!bigTxt);
  if (bigTxt) {
    setText(els.big, bigTxt);
    // fit a 3-digit template so 2- and 3-digit values keep one size
    const tpl = digits && !bigTxt.includes(':') ? '0'.repeat(Math.max(3, bigTxt.length)) : undefined;
    place(els.big, bigTxt, ins + W * 0.03, y0, W - 2 * ins - W * 0.06, y1 - y0, { digits, tpl });
    toggle(els.big, 'dl-dim', wait && !finals);
  }
  last.prevPhase = s.phase;
}

// both-screens finals: 2 digits when the value fits, so each half can be really big
function finalsDigits(sec, fmt) {
  const str = ctx.formatTime(sec ?? 0, fmt);
  return fmt !== 'min' && str.length === 3 && str[0] === '0' ? str.slice(1) : str;
}

function renderFinals(s, d, W, H, Hs, clockOn) {
  const f = s.finals;
  const wait = s.phase === 'wait';
  const banner = wait && (d.bannerText || '').trim();
  const clock = wait && clockOn ? clockParts(d, true) : null;
  const choose = wait && !f.chosen;
  const stripOn = wait && !!(clock || banner || choose);
  show(els.bar, false);
  show(els.strip, stripOn);
  for (const e of [els.strip, els.bar]) { e.style.left = '0px'; e.style.right = '0px'; }
  els.strip.style.bottom = '0px';
  if (stripOn) {
    renderStrip(W, H, Hs, {
      lab: '', val: clock ? clock.time + (clock.ampm ? ' ' + clock.ampm : '') : '', valDigits: true,
      mid: banner ? [{ t: banner, cls: 'banner', size: 0.34 }] : [],
      word: choose ? 'CHOOSE STARTING SIDE' : '', dark: true,
    });
  }
  const Hf = H - (stripOn ? Hs : 0);
  const Wm = Math.round(W * 0.15);
  const Wh = (W - Wm) / 2;
  els.fin.style.height = Hf + 'px';
  els.fmid.style.left = Wh + 'px';
  els.fmid.style.width = Wm + 'px';
  const running = !wait;
  const active = f.active || (running ? null : f.chosen);

  for (const side of ['left', 'right']) {
    const x = els.half[side];
    const st = f[side] || {};
    const color = BG[st.color] ? st.color : 'idle';
    setColors(x.bg, color);
    toggle(x.bg, 'dl-dark', color === 'idle');
    x.bg.style.left = (side === 'left' ? 0 : Wh + Wm) + 'px';
    x.bg.style.width = Wh + 'px';
    const pad = Wh * 0.05;
    // tag: target + role
    const parts = [];
    if (f.showTargets && f.targets) parts.push(`TARGET ${f.targets[side]}`);
    if (f.primary && !d.hideIcons) parts.push(f.primary === side ? 'PRIMARY' : 'SECONDARY');
    const tag = parts.join(' · ');
    show(x.tag, !!tag);
    if (tag) { setText(x.tag, tag); place(x.tag, tag, pad, Hf * 0.035, Wh - 2 * pad, Hf * 0.065); }
    const w = running ? phaseWord(s, color, st.seconds) : '';
    show(x.word, !!w);
    const wordH = Hf * 0.1;
    if (w) { setText(x.word, w); place(x.word, w, pad, Hf - wordH - Hf * 0.05, Wh - 2 * pad, wordH); }
    const str = finalsDigits(st.seconds, s.timeFormat);
    setText(x.big, str);
    const top = Hf * 0.13, bot = Hf - wordH - Hf * 0.09;
    place(x.big, str, pad, top, Wh - 2 * pad, bot - top,
      { digits: true, tpl: str.includes(':') ? undefined : '00' });
    toggle(x.big, 'dl-dim', !running && active !== side);
  }

  // middle column: arrow number + which side shoots
  const lab = (s.end && s.end.label ? s.end.label : 'Arrow').toUpperCase();
  setText(els.fLab, lab);
  place(els.fLab, lab, Wm * 0.1, Hf * 0.2, Wm * 0.8, Hf * 0.045);
  setText(els.fNum, f.arrow);
  place(els.fNum, String(f.arrow), Wm * 0.08, Hf * 0.27, Wm * 0.84, Hf * 0.24, { digits: true });
  const aw = Wm * 0.62;
  const as = els.fArrow.style;
  as.width = aw + 'px'; as.height = aw * 0.8 + 'px';
  as.left = (Wm - aw) / 2 + 'px'; as.top = Hf * 0.6 + 'px';
  toggle(els.fArrow, 'left', active === 'left');
  toggle(els.fArrow, 'right', active === 'right');
  show(els.fArrow, !!active);
}

/** Between-ends clock screen: big time, weekday / date / year, banner, and a big End / Next column. */
function renderIdle(s, d, W, H) {
  const c = clockParts(d, true);
  const withDate = d.clock === 'datetime';
  const banner = (d.bannerText || '').trim();
  const pad = Math.round(Math.min(W, H) * 0.045);
  const colW = Math.round(W * 0.26);
  const leftW = W - colW - pad * 3;

  // left stack (heights as fractions of the free height; gaps share what remains)
  const items = [{ el: els.iTime, h: withDate ? 0.36 : 0.5, digits: true }];
  if (withDate) {
    items.push({ el: els.iDay, h: 0.13, t: DAYS[c.now.getDay()].toUpperCase() });
    items.push({ el: els.iDate, h: 0.13, t: `${c.now.getDate()} ${MONTHS[c.now.getMonth()].toUpperCase()}` });
    items.push({ el: els.iYear, h: 0.13, t: String(c.now.getFullYear()) });
  }
  if (banner) items.push({ el: els.iBanner, h: 0.075, t: banner });
  for (const el of [els.iDay, els.iDate, els.iYear, els.iBanner]) show(el, items.some((i) => i.el === el));
  const free = H - pad * 2;
  const used = items.reduce((a, i) => a + i.h * free, 0);
  const gap = items.length > 1 ? (free - used) / (items.length - 1) : 0;
  let y = items.length > 1 ? pad : (H - used) / 2;
  for (const it of items) {
    const bh = it.h * free;
    if (it.el === els.iTime) {
      setTime(els.iTime, c);
      const am = c.ampm ? measure(' ' + c.ampm, TEXT_FONT, TEXT_W).w * 0.36 / measure(tplOf(c.time), DIGIT_FONT, DIGIT_W).w : 0;
      place(els.iTime, c.time, pad, y, leftW, bh, { digits: true, extraW: am });
    } else {
      setText(it.el, it.t);
      place(it.el, it.t, pad, y, leftW, bh);
    }
    y += bh + gap;
  }

  // vertical rule
  const r = els.iRule.style;
  r.left = (pad * 1.5 + leftW) + 'px'; r.top = pad + 'px'; r.height = (H - pad * 2) + 'px';
  r.width = Math.max(2, Math.round(W * 0.004)) + 'px';

  // End / Next column
  const e = s.end || {};
  const endTxt = e.number != null ? (e.practice ? 'P' : '') + e.number : '';
  const endLab = (e.label || 'End').toUpperCase();
  const next = s.details && s.details.next;
  const x0 = W - pad - colW;
  const labH = H * 0.06, valH = H * 0.27;
  const blockH = labH * 1.5 + valH;
  const blocks = (endTxt ? 1 : 0) + (next ? 1 : 0);
  const g = blocks ? (H - pad * 2 - blocks * blockH) / (blocks + 1) : 0;
  let by = pad + g;
  show(els.iEndLab, !!endTxt); show(els.iEnd, !!endTxt);
  if (endTxt) {
    setText(els.iEndLab, endLab);
    place(els.iEndLab, endLab, x0, by, colW, labH);
    setText(els.iEnd, endTxt);
    place(els.iEnd, endTxt, x0, by + labH * 1.5, colW, valH, { digits: true, tpl: endTxt.length < 2 ? '00' : undefined });
    by += blockH + g;
  }
  show(els.iNextLab, !!next); show(els.iNext, !!next);
  if (next) {
    place(els.iNextLab, 'NEXT', x0, by, colW, labH);
    setText(els.iNext, next);
    place(els.iNext, next, x0, by + labH * 1.5, colW, valH, { tpl: next.length < 2 ? 'AB' : undefined });
  }
}

export default { mount, render, unmount };
