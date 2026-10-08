// LPYA Sunset — Lower Providence Youth Archery colours: a sunset over layered mountain ridges
// (drawn here as SVG, so it is crisp at any resolution) behind tinted glass panels.
// Readability first: white outlined digits on a glass panel tinted in the phase colour, a bold
// phase band with a word (SHOOT / WALK UP / WARNING …) and a shield-shaped lamp column.
// Layout is in units of R/100 (--u) where R is the width of a 4:3 content block, as in Classic.

const LAMPS = ['red', 'orange', 'green'];
const LOGO = new URL('./logo-white.png', import.meta.url).href;

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
function setData(e, k, v) { v = v == null ? '' : String(v); if (e.dataset[k] !== v) e.dataset[k] = v; }
const U = (n) => `calc(var(--u) * ${(+n).toFixed(2)})`;
function setFs(e, n) { const v = U(n); if (e.style.fontSize !== v) e.style.fontSize = v; }

// ---------------------------------------------------------------- landscape (SVG)

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** jagged mountain ridge filled down to `bottom` */
function ridge(seed, base, amp, step, bumps, bottom = 900) {
  const r = rng(seed);
  const pts = [];
  let y = base;
  for (let x = -40; x <= 1640; x += step * (0.6 + r() * 0.8)) {
    let target = base;
    for (const [cx, w, a] of bumps) target -= a * Math.exp(-((x - cx) ** 2) / (2 * w * w));
    y = target + (r() - 0.5) * amp;
    pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
  }
  return `M-40,${bottom} L${pts.join(' L')} L1640,${bottom} Z`;
}
function pine(x, baseY, hgt) {
  const w = hgt * 0.34, tiers = 5, p = [`${x},${baseY - hgt}`];
  const right = [], left = [];
  for (let i = 1; i <= tiers; i++) {
    const yy = baseY - hgt + (hgt * 0.88) * (i / tiers);
    const ww = w * (0.25 + 0.75 * i / tiers) / 2;
    right.push(`${(x + ww).toFixed(1)},${yy.toFixed(1)}`, `${(x + ww * 0.45).toFixed(1)},${(yy - hgt * 0.02).toFixed(1)}`);
    left.unshift(`${(x - ww * 0.45).toFixed(1)},${(yy - hgt * 0.02).toFixed(1)}`, `${(x - ww).toFixed(1)},${yy.toFixed(1)}`);
  }
  right.pop(); left.shift();
  const trunk = [`${x + w * 0.05},${baseY - hgt * 0.12}`, `${x + w * 0.05},${baseY}`, `${x - w * 0.05},${baseY}`, `${x - w * 0.05},${baseY - hgt * 0.12}`];
  return 'M' + p.concat(right, trunk, left).join(' L') + ' Z';
}
function forest(seed, x0, x1, groundY, hMin, hMax, gap) {
  const r = rng(seed);
  let d = '';
  for (let x = x0; x < x1; x += gap * (0.5 + r())) {
    const g = typeof groundY === 'function' ? groundY(x) : groundY;
    d += pine(x, g + r() * 10, hMin + r() * (hMax - hMin));
  }
  return d;
}
const EAGLE = 'M0,0 C-14,-6 -34,-24 -62,-30 L-58,-24 L-74,-25 L-62,-19 L-78,-16 L-62,-12 L-74,-7 L-56,-7 ' +
  'C-36,-6 -18,0 -7,5 L-11,16 L-3,12 L0,17 L3,12 L11,16 L7,5 C18,0 36,-6 56,-7 L74,-7 L62,-12 L78,-16 ' +
  'L62,-19 L74,-25 L58,-24 L62,-30 C34,-24 14,-6 0,0 Z M-3,-1 L0,-9 L3,-1 Z';

function landscapeSVG() {
  const shoreL = (x) => 760 - 140 * Math.exp(-(x * x) / (2 * 260 * 260));
  return `
<svg class="lp-bg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="lpSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c2452a"/><stop offset=".28" stop-color="#ef6a2b"/>
      <stop offset=".5" stop-color="#f9a13a"/><stop offset=".62" stop-color="#f6b448"/>
    </linearGradient>
    <radialGradient id="lpGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff2a8" stop-opacity=".85"/><stop offset=".35" stop-color="#fbc02d" stop-opacity=".45"/>
      <stop offset="1" stop-color="#f9a13a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lpSun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#fbc02d"/>
    </linearGradient>
    <linearGradient id="lpLake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c2452a"/><stop offset=".35" stop-color="#8b2a6b"/><stop offset="1" stop-color="#241a2b"/>
    </linearGradient>
    <linearGradient id="lpShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17131c" stop-opacity=".18"/><stop offset=".5" stop-color="#17131c" stop-opacity="0"/>
      <stop offset="1" stop-color="#17131c" stop-opacity=".35"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#lpSky)"/>
  <circle cx="1270" cy="470" r="330" fill="url(#lpGlow)"/>
  <circle cx="1270" cy="470" r="125" fill="url(#lpSun)"/>
  <path d="${EAGLE}" fill="#3a1838" opacity=".8" transform="translate(1110 150) rotate(-8) scale(1.5)"/>
  <path d="${ridge(11, 470, 26, 34, [[300, 140, 130], [760, 120, 70], [1500, 160, 60]], 900)}" fill="#e4177a" opacity=".42"/>
  <path d="${ridge(23, 545, 22, 30, [[120, 120, 120], [560, 180, 110], [1050, 140, 70]], 900)}" fill="#b5245d" opacity=".9"/>
  <path d="${ridge(37, 615, 18, 30, [[420, 200, 80], [880, 160, 110], [1400, 180, 50]], 900)}" fill="#8b2a6b"/>
  <path d="${ridge(41, 690, 14, 26, [[0, 220, 120], [700, 220, 50], [1250, 160, 40]], 900)}" fill="#4a1d4f"/>
  <rect y="790" width="1600" height="110" fill="url(#lpLake)"/>
  <g fill="#ffd45a" opacity=".55">
    <rect x="1170" y="800" width="200" height="5" rx="2.5"/><rect x="1195" y="816" width="150" height="4" rx="2"/>
    <rect x="1215" y="832" width="110" height="4" rx="2"/><rect x="1235" y="848" width="70" height="3" rx="1.5"/>
    <rect x="1250" y="864" width="40" height="3" rx="1.5"/>
  </g>
  <path d="${forest(5, 1120, 1640, 795, 34, 70, 16)}" fill="#241a2b"/>
  <path d="M-40,900 L-40,600 C120,610 300,690 520,800 L560,900 Z" fill="#241a2b"/>
  <path d="${forest(7, -30, 560, shoreL, 110, 260, 34)}" fill="#17131c"/>
  <path d="${forest(9, -20, 420, (x) => shoreL(x) + 70, 150, 300, 46)}" fill="#120e16"/>
  <rect width="1600" height="900" fill="url(#lpShade)"/>
</svg>`;
}

// ---------------------------------------------------------------- building blocks

/** shield-shaped lamp column (echoes the club logo) */
function makeLight(parent, extra) {
  const col = h('div', 'lp-light ' + (extra || ''), parent);
  col.innerHTML = `<svg class="lp-housing" viewBox="0 0 100 330" preserveAspectRatio="none" aria-hidden="true">
    <path d="M14,3 H86 Q97,3 97,14 V248 L50,325 L3,248 V14 Q3,3 14,3 Z" fill="#17131c" fill-opacity=".9"
      stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M14,3 H86 Q97,3 97,14 V248 L50,325 L3,248 V14 Q3,3 14,3 Z" fill="none"
      stroke="#f2c230" stroke-width="1.2" transform="translate(50 164) scale(.93) translate(-50 -164)"/>
    <path d="M50,276 L60,294 L50,314 L40,294 Z" fill="#fbc02d"/></svg>`;
  const lamps = {};
  LAMPS.forEach((c, i) => { lamps[c] = h('div', `lp-lamp lp-lamp-${c}`, col); lamps[c].style.top = `${((14 + i * 88) / 330 * 100).toFixed(2)}%`; });
  return { col, lamps, lit: null };
}
function setLight(light, lit) {
  if (light.lit === lit) return;
  light.lit = lit;
  for (const c of LAMPS) toggle(light.lamps[c], 'on', c === lit);
}

/** fixed-width digit cells so numbers never jitter */
function makeDigits(parent, cls) { return { el: h('div', 'lp-digits ' + (cls || ''), parent), str: null }; }
function setDigits(d, str, suffix = '', secs = '') {
  const key = str + '|' + suffix + '|' + secs;
  if (d.str === key) return;
  d.str = key;
  d.el.textContent = '';
  for (const ch of str) h('span', ch === ':' ? 'lp-colon' : 'lp-d', d.el, ch);
  if (secs || suffix) {
    const side = h('span', 'lp-side', d.el);
    if (secs) h('span', 'lp-secs', side, secs);
    if (suffix) h('span', 'lp-ampm', side, suffix);
  }
  d.el.dataset.fmt = str.includes(':') ? 'min' : 'sec';
}
/** width of a digit string in em (cells: digit .6, colon .3) */
function digitEms(str, extra = 0) {
  let n = 0;
  for (const ch of str) n += ch === ':' ? 0.3 : 0.6;
  return n + extra;
}

/** shrink a text element so it fits `width` units, starting from `maxFs` units (cached per key) */
function fitText(el, maxFs, width, key) {
  const k = `${key}|${maxFs.toFixed(2)}|${width}|${last.layoutKey}`;
  if (el._fitKey === k) return;
  el._fitKey = k;
  setFs(el, maxFs);
  el._fs = maxFs;
  const u = last.u || 1;
  const w = el.scrollWidth / u;
  if (w > width) { el._fs = maxFs * width / w; setFs(el, el._fs); }
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('lp-root');
  root.insertAdjacentHTML('beforeend', landscapeSVG());
  const stage = h('div', 'lp-stage', root);
  const main = h('div', 'lp-main', stage);
  els = { stage, main };

  els.panel = h('div', 'lp-panel', main);
  els.digits = makeDigits(els.panel, 'lp-main-digits');

  els.cd = h('div', 'lp-cd', main);
  h('div', 'lp-cd-title', els.cd, 'Match starts in');
  els.cdDigits = makeDigits(els.cd, 'lp-cd-digits');
  h('div', 'lp-cd-sub', els.cd, 'Minutes');

  els.row = h('div', 'lp-row', main);
  els.letters = h('div', 'lp-letters', els.row);
  els.tb = h('div', 'lp-tb', els.row);
  els.tbBig = h('span', 'lp-tb-big', els.tb);
  els.tbSmall = h('span', 'lp-tb-small', els.tb);
  els.archer = h('div', 'lp-archer', els.row);
  h('span', 'lp-word', els.archer, 'Archer');
  els.archerNum = h('span', 'lp-big', els.archer);
  els.so = h('div', 'lp-archer', els.row);
  h('span', 'lp-word', els.so, 'Shoot-off');
  els.soNum = h('span', 'lp-big', els.so);
  els.bigDate = h('div', 'lp-bigdate', els.row);

  els.endBox = h('div', 'lp-end', main);
  els.endLabel = h('div', 'lp-label', els.endBox, 'End');
  const endRow = h('div', 'lp-end-row', els.endBox);
  els.endP = h('span', 'lp-p', endRow, 'P');
  els.endNum = h('span', 'lp-end-num', endRow);

  els.logo = h('img', 'lp-logo-sm', main);
  els.logo.src = LOGO; els.logo.alt = '';

  els.band = h('div', 'lp-band', main);
  els.bandText = h('span', 'lp-band-text', els.band);

  els.bottom = h('div', 'lp-bottom', main);
  els.next = h('div', 'lp-next', els.bottom);
  h('span', 'lp-next-word', els.next, 'Next');
  els.nextVal = h('span', 'lp-next-val', els.next);
  els.banner = h('div', 'lp-banner', els.bottom);
  els.date = h('div', 'lp-date', els.bottom);
  els.choose = h('div', 'lp-choose', els.bottom, 'Choose starting side');

  // finals, both screens
  els.finals = h('div', 'lp-finals', main);
  els.fl = {};
  for (const side of ['left', 'right']) {
    const s = {};
    s.panel = h('div', `lp-fpanel lp-fpanel-${side}`, els.finals);
    h('div', `lp-fside lp-fside-${side}`, els.finals);
    s.digits = makeDigits(s.panel, 'lp-fdigits');
    s.arrow = h('div', `lp-farrow lp-farrow-${side}`, els.finals);
    s.role = h('div', `lp-frole lp-frole-${side}`, els.finals);
    s.target = h('div', `lp-ftarget lp-ftarget-${side}`, els.finals);
    h('span', 'lp-label', s.target, 'Target');
    s.targetNum = h('span', 'lp-ftarget-num', s.target);
    els.fl[side] = s;
  }
  els.fArrow = h('div', 'lp-farrow-box', els.finals);
  els.fArrowLabel = h('div', 'lp-label', els.fArrow, 'Arrow');
  els.fArrowNum = h('div', 'lp-farrow-num', els.fArrow);
  els.fTimePanel = h('div', 'lp-panel lp-ftime', els.finals);
  els.fTime = makeDigits(els.fTimePanel, 'lp-main-digits');

  // between-ends clock screen
  els.idle = h('div', 'lp-idle', main);
  els.iTime = h('div', 'lp-i-time', els.idle);
  els.iRule = h('div', 'lp-i-rule', els.idle);
  els.iDay = h('div', 'lp-i-day', els.idle);
  els.iDate = h('div', 'lp-i-date', els.idle);
  els.iYear = h('div', 'lp-i-year', els.idle);
  els.iBanner = h('div', 'lp-i-banner', els.idle);
  els.col = h('div', 'lp-col', stage);
  els.colLogo = h('img', 'lp-col-logo', els.col);
  els.colLogo.src = LOGO; els.colLogo.alt = '';
  els.bEnd = h('div', 'lp-badge', els.col);
  els.bEndLabel = h('span', 'lp-b-word', els.bEnd, 'End');
  els.bEndNum = h('span', 'lp-b-val', els.bEnd);
  els.bNext = h('div', 'lp-badge', els.col);
  h('span', 'lp-b-word', els.bNext, 'Next');
  els.bNextVal = h('span', 'lp-b-val', els.bNext);

  els.light = makeLight(stage, 'lp-light-main');
  els.lightL = makeLight(stage, 'lp-light-fl');
  els.lightR = makeLight(stage, 'lp-light-fr');

  els.stop = h('div', 'lp-stop', root);
  h('div', 'lp-stop-word', els.stop, 'STOP');

  ro = new ResizeObserver(() => { last.layoutKey = null; if (last.snap) render(last.snap); });
  ro.observe(root);
}

function unmount() {
  if (ro) ro.disconnect();
  if (root) { root.textContent = ''; root.classList.remove('lp-root'); }
  root = els = ro = null; last = {};
}

function layout(mode, lightShown, side) {
  const W = root.clientWidth || window.innerWidth;
  const H = root.clientHeight || window.innerHeight;
  let wf;
  if (mode === 'manual') wf = 0.34;
  else if (mode === 'finals') wf = lightShown ? 1.5 : 1;
  else if (mode === 'idle') wf = 1.34;
  else wf = lightShown ? 1.25 : 1;
  const R = Math.min(H / 0.75, W / wf) * 0.96;
  const key = `${mode}|${lightShown}|${side}|${W}x${H}`;
  if (last.layoutKey === key) return;
  last.layoutKey = key;
  last.u = R / 100;
  const st = els.stage.style;
  st.setProperty('--u', (R / 100) + 'px');
  st.width = (R * wf) + 'px';
  st.height = (R * 0.75) + 'px';
  st.left = ((W - R * wf) / 2) + 'px';
  st.top = ((H - R * 0.75) / 2) + 'px';
  const m = els.main.style;
  const L = els.light.col.style;
  show(els.main, mode !== 'manual');
  if (mode === 'manual') {
    L.left = U(5.8); L.top = U(0.5); L.setProperty('--w', U(22.4));
  } else if (mode === 'finals') {
    m.left = lightShown ? U(25) : '0px';
    els.lightL.col.style.left = U(0.5); els.lightR.col.style.left = U(126.5);
    for (const l of [els.lightL, els.lightR]) { l.col.style.top = U(0.8); l.col.style.setProperty('--w', U(22.4)); }
  } else if (mode === 'idle') {
    m.left = side === 'left' ? U(34) : '0px';
    els.col.style.left = side === 'left' ? U(0) : U(102);
  } else {
    m.left = lightShown && side === 'left' ? U(25) : '0px';
    L.left = side === 'left' ? U(1) : U(102);
    L.top = U(0.8); L.setProperty('--w', U(22.4));
  }
}

// ---------------------------------------------------------------- render

const BAND = { green: 'Shoot', orange: 'Warning', blue: 'Get ready' };

function render(s) {
  if (!els || !s) return;
  last.snap = s;
  const d = s.display || {};
  const emergency = s.phase === 'emergency' || !!s.emergency;
  const finals = s.system === 'finals' && s.finals;
  const bothFinals = finals && s.finals.view === 'both' && !emergency;
  const manual = s.system === 'manual';
  const mode = manual && !emergency ? 'manual' : bothFinals ? 'finals' : 'std';
  const lightShown = manual || !!d.trafficLight;
  const side = d.trafficSide === 'left' ? 'left' : 'right';
  const wait = s.phase === 'wait';
  const countdown = s.phase === 'countdown';
  const idle = wait && !emergency && mode === 'std' && !finals && (s.system === 'fita' || s.system === '25m1p')
    && (d.clock === 'time' || d.clock === 'datetime');
  const lmode = idle ? 'idle' : mode;
  layout(lmode, lightShown, side);
  setData(root, 'mode', emergency ? 'emergency' : lmode);
  toggle(root, 'lp-hide-labels', d.hideIcons);

  // emergency: full-screen flashing STOP
  show(els.stop, emergency);
  if (emergency) return;

  // traffic lights
  const single = finals && !bothFinals ? s.finals[s.finals.view] : null;
  show(els.light.col, (mode === 'std' && lightShown && !idle) || mode === 'manual');
  setLight(els.light, single ? single.light : s.light);
  show(els.lightL.col, mode === 'finals' && lightShown);
  show(els.lightR.col, mode === 'finals' && lightShown);
  if (mode === 'finals') { setLight(els.lightL, s.finals.left.light); setLight(els.lightR, s.finals.right.light); }
  show(els.col, idle);

  if (mode === 'manual') return;
  if (idle) { renderIdle(s, d); return; }

  // phase colour of the main panel and band
  let ph = 'wait';
  if (countdown) ph = 'blue';
  else if (!wait) {
    const c = single ? single.color : bothFinals ? (s.finals.active ? s.finals[s.finals.active].color : 'idle') : s.digitColor;
    ph = { red: 'red', green: 'green', orange: 'orange', blue: 'blue' }[c] || 'wait';
  }
  setData(root, 'ph', ph);

  const clock = wait && (d.clock === 'time' || d.clock === 'datetime')
    ? { mode: d.clock, h24: !!d.clock24h, secs: d.clockSeconds !== false, now: new Date() } : null;

  // main digits
  const stdDigits = mode === 'std' && !countdown;
  let digitStr = '';
  if (stdDigits) digitStr = single ? ctx.formatTime(single.seconds, s.timeFormat) : (s.seconds == null ? '' : ctx.formatTime(s));
  show(els.panel, stdDigits);
  show(els.digits.el, stdDigits && (digitStr !== '' || !!clock));
  if (stdDigits && clock) clockFace(els.digits, clock, 92, 46);
  else if (stdDigits) {
    setDigits(els.digits, digitStr);
    setFs(els.digits.el, Math.min(50, 92 / digitEms(digitStr || '000')));
  }

  // countdown
  show(els.cd, countdown);
  if (countdown) {
    const t = ctx.formatTime(s.seconds, 'min');
    setDigits(els.cdDigits, t);
    setFs(els.cdDigits.el, Math.min(40, 86 / digitEms(t)));
  }

  // details row
  const det = s.details || {};
  const detailsOn = mode === 'std' && !countdown && !finals;
  const letters = detailsOn && det.kind === 'letters' && det.slots && det.slots.length >= 2;
  show(els.letters, letters);
  if (letters) {
    const key = det.slots.map((x) => x.letter + (x.active ? '1' : '0')).join('');
    if (last.letters !== key) {
      last.letters = key;
      els.letters.textContent = '';
      setData(els.letters, 'n', det.slots.length);
      for (const sl of det.slots) h('span', 'lp-letter' + (sl.active ? ' on' : ''), els.letters, sl.letter);
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
  const bigDate = mode === 'std' && !countdown && !!clock && clock.mode === 'datetime' && !letters && !tb && !archer && !so;
  show(els.bigDate, bigDate);
  if (bigDate) {
    const n = clock.now;
    const txt = `${DAYS_LONG[n.getDay()]} ${n.getDate()} ${MONTHS_LONG[n.getMonth()]}`;
    setText(els.bigDate, txt);
    fitText(els.bigDate, 9, 64, txt);
  }
  show(els.row, mode === 'std' && !countdown && (letters || !!tb || archer || !!so || bigDate));

  // end
  const e = s.end || {};
  const endOn = mode === 'std' && e.visible !== false && e.number != null && !countdown;
  show(els.endBox, endOn);
  if (endOn) {
    setText(els.endLabel, e.label || 'End');
    const n = finals ? s.finals.arrow : e.number;
    setText(els.endNum, n);
    show(els.endP, !!e.practice && !finals);
    setFs(els.endNum, String(n).length > 2 ? 8 : 11);
  }
  // small logo beside the details row while running
  show(els.logo, mode === 'std' && !countdown);

  // phase band (running) or bottom line (WAIT)
  const mark = s.paused ? 'Paused' : s.hold ? 'Hold' : '';
  const bandOn = !wait;
  show(els.band, bandOn);
  if (bandOn) {
    let word = mark || BAND[ph] || '';
    if (!word && ph === 'red') word = (s.system === 'fita' || s.system === '25m1p') && s.phase === 'red' ? 'Walk up' : 'Stop';
    setText(els.bandText, word);
    toggle(els.band, 'lp-marked', !!mark);
  }

  const nextOn = mode === 'std' && wait && !finals && !!det.next;
  const banner = (d.bannerText || '').trim();
  const bannerOn = wait && !!banner;
  const dateOn = wait && !!clock && clock.mode === 'datetime' && !bigDate;
  const chooseOn = mode === 'finals' && wait && !s.finals.chosen;
  show(els.next, nextOn);
  if (nextOn) setText(els.nextVal, det.next);
  show(els.date, dateOn);
  if (dateOn) {
    const n = clock.now;
    setText(els.date, `${DAYS[n.getDay()]} ${n.getDate()} ${MONTHS[n.getMonth()]}`);
  }
  show(els.choose, chooseOn);
  show(els.banner, bannerOn);
  if (bannerOn) {
    setText(els.banner, banner);
    show(els.bottom, true);
    const u = last.u || 1;
    let room = 94;
    for (const [on, el] of [[nextOn, els.next], [dateOn, els.date], [chooseOn, els.choose]]) if (on) room -= el.offsetWidth / u + 2.5;
    fitText(els.banner, 5.6, room, banner + nextOn + dateOn + chooseOn);
  }
  show(els.bottom, wait && (nextOn || bannerOn || dateOn || chooseOn));

  // finals both screens
  const wasFinals = last.finalsShown;
  last.finalsShown = mode === 'finals';
  show(els.finals, mode === 'finals');
  if (mode === 'finals') {
    // no zoom animation when the finals view first appears (or the layout changes), only on side switches
    if (!wasFinals || last.finalsLayout !== last.layoutKey) {
      last.finalsLayout = last.layoutKey;
      els.finals.classList.add('lp-noanim');
      renderFinals(s, clock);
      void els.finals.offsetWidth;
      requestAnimationFrame(() => els && els.finals.classList.remove('lp-noanim'));
    } else renderFinals(s, clock);
  }
}

function renderFinals(s, clock) {
  const f = s.finals;
  const running = s.phase !== 'wait';
  const active = clock ? null : (f.active || (running ? null : f.chosen));
  setData(els.finals, 'act', active || 'none');
  toggle(els.finals, 'lp-fclock', !!clock);
  show(els.fTimePanel, !!clock);
  if (clock) clockFace(els.fTime, clock, 92, 40);
  for (const side of ['left', 'right']) {
    const x = els.fl[side];
    const st = f[side] || {};
    const str = finalsDigits(st.seconds, s.timeFormat);
    setDigits(x.digits, str);
    const big = active === side, small = active && active !== side;
    setFs(x.digits.el, big ? Math.min(44, 56 / digitEms(str)) : small ? Math.min(22, 30 / digitEms(str)) : Math.min(34, 44 / digitEms(str)));
    setData(x.panel, 'ph', running ? ({ red: 'red', green: 'green', orange: 'orange' }[st.color] || 'wait') : 'wait');
    toggle(x.arrow, 'on', f.active === side && running);
    toggle(x.arrow, 'chosen', !running && f.chosen === side);
    const role = f.primary ? (f.primary === side ? 'Primary' : 'Secondary') : '';
    setText(x.role, role);
    toggle(x.role, 'primary', f.primary === side);
    show(x.target, !!f.showTargets);
    if (f.showTargets) {
      setText(x.targetNum, f.targets ? f.targets[side] : '');
      toggle(x.target, 'on', f.active === side);
    }
  }
  setText(els.fArrowNum, f.arrow);
  setText(els.fArrowLabel, s.end && s.end.label ? s.end.label : 'Arrow');
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

function clockText(now, h24, secs) {
  const m = String(now.getMinutes()).padStart(2, '0');
  const H = now.getHours();
  const time = h24 ? `${String(H).padStart(2, '0')}:${m}` : `${H % 12 || 12}:${m}`;
  const sec = secs ? String(now.getSeconds()).padStart(2, '0') : '';
  return { time, sec, ampm: h24 ? '' : (H < 12 ? 'AM' : 'PM') };
}
/** time of day in a digit panel (smaller seconds with AM/PM beside the hours:minutes) */
function clockFace(d, clock, width, maxFs) {
  const c = clockText(clock.now, clock.h24, clock.secs);
  setDigits(d, c.time, c.ampm, c.sec);
  setFs(d.el, Math.min(maxFs, width / digitEms(c.time, c.sec ? 0.62 : c.ampm ? 0.5 : 0)));
}

/** Between-ends clock screen: big time with seconds, weekday / date / year, banner, and a big
 *  End + Next column (with the club shield) in place of the lamp column. */
function renderIdle(s, d) {
  setData(root, 'ph', 'wait');
  const now = new Date();
  const H = now.getHours(), M = String(now.getMinutes()).padStart(2, '0'), S = String(now.getSeconds()).padStart(2, '0');
  const secs = d.clockSeconds !== false;
  let time = d.clock24h ? `${String(H).padStart(2, '0')}:${M}` : `${H % 12 || 12}:${M}`;
  if (secs) time += ':' + S;
  const ampm = d.clock24h ? '' : (H < 12 ? 'AM' : 'PM');
  const withDate = d.clock === 'datetime';
  const banner = (d.bannerText || '').trim();

  const tkey = time.replace(/\d/g, '0') + ampm;
  if (els.iTime.dataset.t !== time + ampm) {
    els.iTime.dataset.t = time + ampm;
    els.iTime.textContent = '';
    for (const ch of time) h('span', ch === ':' ? 'lp-colon' : 'lp-d', els.iTime, ch);
    if (ampm) h('span', 'lp-i-ampm', els.iTime, ampm);
  }
  const bannerFs = banner ? 6.5 : 0;
  const timeMax = withDate ? 26 : 38;
  fitText(els.iTime, timeMax, 92, tkey);
  const timeFs = els.iTime._fs || timeMax;
  const lineFs = withDate ? Math.min(12.5, (70 - timeFs * 1.05 - bannerFs * 1.3 - 3) / 3 / 1.12) : 0;
  const line = (el, txt, fs) => { show(el, !!txt); if (txt) { setText(el, txt); fitText(el, fs, 90, txt); } };
  line(els.iDay, withDate ? DAYS_LONG[now.getDay()] : '', lineFs);
  line(els.iDate, withDate ? `${now.getDate()} ${MONTHS_LONG[now.getMonth()]}` : '', lineFs);
  line(els.iYear, withDate ? String(now.getFullYear()) : '', lineFs * 0.8);
  show(els.iRule, withDate || !!banner);
  line(els.iBanner, banner, bannerFs);

  const e = s.end || {};
  const endTxt = (e.practice ? 'P' : '') + (e.number ?? '');
  setText(els.bEndLabel, e.label || 'End');
  setText(els.bEndNum, endTxt);
  setFs(els.bEndNum, Math.min(19, 26 / (Math.max(2, endTxt.length) * 0.62)));
  const next = s.details && s.details.next;
  show(els.bNext, !!next);
  if (next) {
    setText(els.bNextVal, next);
    setFs(els.bNextVal, Math.min(19, 26 / (Math.max(2, next.length) * 0.66)));
  }
  toggle(els.col, 'single', !next);
}

// both-screens finals: 2 digits when the value fits, so the active timer can be really big
function finalsDigits(sec, fmt) {
  const str = ctx.formatTime(sec ?? 0, fmt);
  return fmt !== 'min' && str.length === 3 && str[0] === '0' ? str.slice(1) : str;
}

export default { mount, render, unmount };
