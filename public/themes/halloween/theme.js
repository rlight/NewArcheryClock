// Halloween theme — a haunted night for October shoots.
// Scenery (sky, moon, bats, graveyard, fog, cobwebs, spider) is drawn once in SVG/CSS behind the
// content and animated with CSS only. The content follows the Classic geometry: a 4:3 block in
// units of R/100 (--u) plus a lamp column of three jack-o'-lanterns, scaled to fit any screen.
// Readability first: digits sit on a darkened clearing with a dark outline and glow in the phase
// colour; the lit jack-o'-lantern is filled with the phase colour.

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
function setData(e, k, v) { v = v == null ? '' : String(v); if (e.dataset[k] !== v) e.dataset[k] = v; }
function setVar(e, k, v) { if (e.style.getPropertyValue(k) !== v) e.style.setProperty(k, v); }

// ---------------------------------------------------------------- font detection
// Chiller (MS Office) is thin: when it is the font in use, the digits get a fattening stroke.
function detectFont() {
  try {
    const c = document.createElement('canvas').getContext('2d');
    const probe = 'mmmmmmwwwwwlli 0123456789';
    const w = (f) => { c.font = `72px ${f}`; return c.measureText(probe).width; };
    for (const [name, cls] of [['Chiller', 'chiller'], ['Creepster', 'creepster'], ['Jokerman', 'jokerman']]) {
      if (w(`"${name}", monospace`) !== w('monospace') || w(`"${name}", serif`) !== w('serif')) return cls;
    }
  } catch (_) { /* ignore */ }
  return 'impact';
}

// ---------------------------------------------------------------- scenery

const PUMPKIN = `
  <path class="hw-stem" d="M47 17 C46 9 49 4 55 1 L59 5 C55 8 54 12 55 18 Z"/>
  <ellipse class="hw-pb" cx="29" cy="58" rx="25" ry="35"/>
  <ellipse class="hw-pb" cx="71" cy="58" rx="25" ry="35"/>
  <ellipse class="hw-pb" cx="50" cy="57" rx="24" ry="39"/>
  <ellipse class="hw-shade" cx="50" cy="58" rx="49" ry="39" fill="url(#hw-shade)"/>
  <g class="hw-face">
    <path d="M24 46 L37 33 L41 50 Z"/>
    <path d="M76 46 L63 33 L59 50 Z"/>
    <path d="M50 52 L45 61 L55 61 Z"/>
    <path d="M20 66 Q50 92 80 66 L72 70 L68 66 L62 73 L56 68 L50 75 L44 68 L38 73 L32 66 L28 70 Z"/>
  </g>`;

function batSvg() {
  return `<svg viewBox="0 0 100 50" class="hw-batsvg"><g class="hw-wings"><use href="#hw-wing"/>
    <use href="#hw-wing" transform="translate(100 0) scale(-1 1)"/></g>
    <path d="M45 21 L44 13 L48 18 L52 18 L56 13 L55 21 C57 30 53 36 50 37 C47 36 43 30 45 21 Z"/></svg>`;
}

function tomb(x, base, w, ht, kind, tilt) {
  const r = w / 2;
  if (kind === 'cross') {
    const t = w * 0.28;
    return `<path transform="rotate(${tilt} ${x + r} ${base})" d="M${x + r - t / 2} ${base} V${base - ht * 0.7} H${x} V${base - ht * 0.7 - t} H${x + r - t / 2} V${base - ht} H${x + r + t / 2} V${base - ht * 0.7 - t} H${x + w} V${base - ht * 0.7} H${x + r + t / 2} V${base} Z"/>`;
  }
  return `<path transform="rotate(${tilt} ${x + r} ${base})" d="M${x} ${base} V${base - ht + r} A${r} ${r * 0.9} 0 0 1 ${x + w} ${base - ht + r} V${base} Z"/>`;
}

function cobweb(size) {
  // spokes from the corner (0,0) and sagging rings between them
  const spokes = 7, rings = 6, pts = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / (spokes - 1)) * Math.PI / 2;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  let d = '';
  for (const [cx, cy] of pts) d += `M0 0 L${(cx * size).toFixed(1)} ${(cy * size).toFixed(1)} `;
  for (let r = 1; r <= rings; r++) {
    const rr = size * (r / rings) * (0.92 + (r % 2) * 0.05);
    for (let i = 0; i < spokes - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const sag = 0.82;
      d += `M${(x1 * rr).toFixed(1)} ${(y1 * rr).toFixed(1)} Q${(mx * rr * sag).toFixed(1)} ${(my * rr * sag).toFixed(1)} ${(x2 * rr).toFixed(1)} ${(y2 * rr).toFixed(1)} `;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}"><path d="${d}"/></svg>`;
}

function smallLantern(x, y, s, delay) {
  return `<g class="hw-jack" transform="translate(${x} ${y}) scale(${s})" style="animation-delay:${delay}s">
    <circle cx="0" cy="0" r="34" fill="url(#hw-candle)" class="hw-jack-glow"/>
    <path d="M-2 -15 C-2 -20 0 -23 4 -24 L5 -21 C3 -20 2 -18 3 -15 Z" fill="#1d2a10"/>
    <ellipse cx="-8" cy="0" rx="11" ry="14" fill="#c4520a"/><ellipse cx="8" cy="0" rx="11" ry="14" fill="#c4520a"/>
    <ellipse cx="0" cy="0" rx="10" ry="15" fill="#e0680f"/>
    <g class="hw-jack-face" fill="#ffe08a"><path d="M-10 -4 L-5 -9 L-3 -2 Z"/><path d="M10 -4 L5 -9 L3 -2 Z"/>
    <path d="M-10 4 Q0 14 10 4 L6 6 L3 4 L0 7 L-3 4 L-6 6 Z"/></g></g>`;
}

function sceneHTML() {
  let tombs = '';
  const T = [[560, 214, 30, 46, 'tomb', -4], [640, 206, 22, 52, 'cross', 3], [700, 212, 36, 40, 'tomb', 5],
    [790, 209, 26, 34, 'tomb', -7], [860, 204, 20, 58, 'cross', -2], [1010, 206, 34, 50, 'tomb', 2],
    [1080, 202, 24, 38, 'tomb', -9], [1140, 200, 22, 56, 'cross', 6], [1205, 198, 30, 44, 'tomb', -3],
    [430, 220, 26, 36, 'tomb', 8]];
  for (const t of T) tombs += tomb(...t);
  let fence = '';
  for (let x = 905; x <= 990; x += 13) fence += `M${x} 210 V170 M${x - 4} 175 L${x} 164 L${x + 4} 175 `;
  fence += 'M900 180 H995 M900 200 H995';
  return `
  <svg class="hw-defs" width="0" height="0" aria-hidden="true"><defs>
    <radialGradient id="hw-shade" cx="42%" cy="38%" r="65%">
      <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".8" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
    </radialGradient>
    <radialGradient id="hw-candle"><stop offset="0" stop-color="#ffb030" stop-opacity=".55"/>
      <stop offset="1" stop-color="#ff7000" stop-opacity="0"/></radialGradient>
    <path id="hw-wing" d="M50 23 C42 10 30 4 12 6 C18 11 18 16 14 20 C9 17 4 19 0 26 C8 26 12 29 14 34 C20 28 27 28 31 33 C36 27 43 27 50 31 Z"/>
  </defs></svg>
  <div class="hw-sky"></div>
  <div class="hw-stars"></div><div class="hw-stars hw-stars2"></div>
  <div class="hw-moon"><div class="hw-moon-face"></div></div>
  <div class="hw-horizon"></div>
  <div class="hw-flyers">
    <div class="hw-bat hw-bat1"><div class="hw-bob">${batSvg()}</div></div>
    <div class="hw-bat hw-bat2"><div class="hw-bob">${batSvg()}</div></div>
    <div class="hw-bat hw-bat3"><div class="hw-bob">${batSvg()}</div></div>
    <div class="hw-bat hw-bat4"><div class="hw-bob">${batSvg()}</div></div>
    <div class="hw-bat hw-bat5"><div class="hw-bob">${batSvg()}</div></div>
  </div>
  <svg class="hw-land" viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice">
    <path class="hw-hill2" d="M0 175 C120 120 260 105 400 128 C520 148 600 175 720 185 C900 170 1100 150 1300 160 C1420 166 1520 150 1600 140 L1600 260 L0 260 Z"/>
    <path class="hw-ground" d="M0 215 C180 188 330 190 480 206 C650 224 800 214 980 206 C1150 198 1300 186 1600 196 L1600 260 L0 260 Z"/>
    <g class="hw-tombs">${tombs}</g>
    <path class="hw-fence" d="${fence}"/>
    <text class="hw-rip" x="1027" y="186">RIP</text>
    <g class="hw-tree">
      <path d="M1470 255 C1458 205 1484 160 1466 112" stroke-width="24"/>
      <path d="M1466 122 C1440 92 1418 86 1388 60" stroke-width="11"/>
      <path d="M1388 60 C1378 50 1368 52 1352 38" stroke-width="5"/>
      <path d="M1420 84 C1410 70 1412 60 1398 46" stroke-width="3.5"/>
      <path d="M1468 116 C1492 82 1515 70 1540 40" stroke-width="9"/>
      <path d="M1540 40 C1550 30 1562 28 1578 20" stroke-width="4"/>
      <path d="M1467 142 C1502 132 1530 136 1572 110" stroke-width="7"/>
      <path d="M1572 110 l20 -14" stroke-width="3"/>
      <path d="M1466 112 C1470 80 1460 58 1472 18" stroke-width="6"/>
      <path d="M1472 18 l-8 -14 M1468 50 l14 -10" stroke-width="2.5"/>
      <path d="M1468 250 C1440 252 1420 258 1400 260 M1472 250 C1500 252 1520 256 1545 260" stroke-width="8"/>
      <path d="M70 255 C62 200 86 150 64 92" stroke-width="16"/>
      <path d="M66 110 C40 90 30 70 6 60" stroke-width="7"/>
      <path d="M64 96 C80 70 100 62 126 52" stroke-width="6"/>
      <path d="M126 52 l18 -12 M64 92 C60 70 68 52 58 30" stroke-width="3"/>
      <path d="M72 150 C96 140 112 142 136 126" stroke-width="5"/>
    </g>
    ${smallLantern(505, 214, 0.9, 0)}${smallLantern(948, 212, 0.75, 1.3)}${smallLantern(1260, 196, 0.95, 0.6)}
  </svg>
  <svg class="hw-house-svg" viewBox="180 -6 262 150" preserveAspectRatio="xMidYMax meet">
    <g class="hw-house">
      <rect x="198" y="38" width="40" height="100"/><path d="M190 42 L218 -4 L246 42 Z"/>
      <rect x="236" y="62" width="140" height="80"/><path d="M226 66 L306 14 L386 66 Z"/>
      <rect x="330" y="20" width="13" height="34" transform="rotate(6 336 37)"/>
      <rect x="372" y="88" width="56" height="54"/><path d="M364 92 L400 58 L436 92 Z"/>
      <path d="M262 142 V112 Q274 100 286 112 V142 Z" class="hw-door"/>
    </g>
    <g class="hw-win">
      <rect x="250" y="78" width="13" height="17"/><rect x="345" y="78" width="13" height="17"/>
      <rect x="211" y="56" width="11" height="15" class="hw-win-b"/><rect x="394" y="104" width="12" height="15" class="hw-win-b"/>
      <circle cx="306" cy="46" r="7"/><rect x="300" y="78" width="13" height="17" class="hw-win-off"/>
    </g>
  </svg>
  <div class="hw-fog hw-fog1"></div><div class="hw-fog hw-fog2"></div>
  <div class="hw-web hw-web-a">${cobweb(200)}</div>
  <div class="hw-web hw-web-b">${cobweb(200)}</div>
  <div class="hw-spider"><svg viewBox="-20 -400 40 440"><line x1="0" y1="-400" x2="0" y2="0"/>
    <g class="hw-legs"><path d="M-4 6 C-14 -2 -18 0 -22 -8 M-4 9 C-16 6 -20 10 -24 4 M-4 12 C-14 14 -18 20 -22 22 M-4 14 C-10 20 -12 28 -16 32
    M4 6 C14 -2 18 0 22 -8 M4 9 C16 6 20 10 24 4 M4 12 C14 14 18 20 22 22 M4 14 C10 20 12 28 16 32"/></g>
    <ellipse cx="0" cy="4" rx="5" ry="5"/><ellipse cx="0" cy="16" rx="8" ry="10"/>
    <circle cx="-2" cy="3" r="1.2" class="hw-eye"/><circle cx="2" cy="3" r="1.2" class="hw-eye"/></svg></div>
  <div class="hw-ghost"><svg viewBox="0 0 100 110"><path d="M18 100 V44 A32 32 0 0 1 82 44 V100 L74 92 L66 101 L58 92 L50 101 L42 92 L34 101 L26 92 Z"/>
    <ellipse cx="38" cy="46" rx="6" ry="9" class="hw-ghost-eye"/><ellipse cx="62" cy="46" rx="6" ry="9" class="hw-ghost-eye"/>
    <ellipse cx="50" cy="70" rx="7" ry="9" class="hw-ghost-eye"/>
    <path d="M18 60 C8 58 4 50 2 40 M82 60 C92 58 96 50 98 40" class="hw-ghost-arm"/></svg>
    <div class="hw-boo">BOO!</div></div>`;
}

function makeLight(parent, extra) {
  const col = h('div', 'hw-light ' + (extra || ''), parent);
  const lamps = {};
  for (const c of LAMPS) {
    const l = h('div', `hw-lamp hw-lamp-${c}`, col);
    l.innerHTML = `<svg viewBox="0 -2 100 100">${PUMPKIN}</svg>`;
    lamps[c] = l;
  }
  return { col, lamps, lit: null };
}
function setLight(light, lit) {
  if (light.lit === lit) return;
  light.lit = lit;
  for (const c of LAMPS) toggle(light.lamps[c], 'on', c === lit);
}

/** Fixed-width digit cells so numbers never jitter. color: idle|red|green|orange|blue|clock */
function makeDigits(parent, cls) {
  return { el: h('div', 'hw-digits ' + (cls || ''), parent), str: null };
}
function setDigits(d, str, color, suffix = '', secs = '') {
  const key = str + '|' + suffix + '|' + secs;
  if (d.str !== key) {
    d.str = key;
    d.el.textContent = '';
    for (const ch of str) h('span', ch === ':' ? 'hw-colon' : 'hw-d', d.el, ch);
    if (secs) {
      const side = h('span', 'hw-side', d.el);
      h('span', 'hw-secs', side, secs);
      if (suffix) h('span', 'hw-ampm', side, suffix);
    } else if (suffix) h('span', 'hw-ampm', d.el, suffix);
    d.el.dataset.len = str.length;
    d.el.dataset.fmt = str.includes(':') ? 'min' : 'sec';
  }
  setData(d.el, 'c', color || 'idle');
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('hw-root', 'hw-font-' + detectFont());
  const scene = h('div', 'hw-scene', root);
  scene.innerHTML = sceneHTML();
  const stage = h('div', 'hw-stage', root);
  const main = h('div', 'hw-main', stage);
  els = {
    scene, stage, main,
    moon: scene.querySelector('.hw-moon'),
    house: scene.querySelector('.hw-house-svg'),
    spider: scene.querySelector('.hw-spider'),
    ghost: scene.querySelector('.hw-ghost'),
    webA: scene.querySelector('.hw-web-a'),
    webB: scene.querySelector('.hw-web-b'),
    clear: h('div', 'hw-clear', main),
    light: makeLight(stage, 'hw-light-main'),
    lightL: makeLight(stage, 'hw-light-fl'),
    lightR: makeLight(stage, 'hw-light-fr'),
    digits: makeDigits(main, 'hw-main-digits'),
    letters: h('div', 'hw-letters', main),
    tb: h('div', 'hw-tb', main),
    archer: h('div', 'hw-archer', main),
    so: h('div', 'hw-so', main),
    endBox: h('div', 'hw-end hw-tomb', main),
    bottom: h('div', 'hw-bottom', main),
    bigDate: h('div', 'hw-bigdate', main),
    idle: h('div', 'hw-idle', main),
    badges: h('div', 'hw-badges', stage),
    countdown: h('div', 'hw-countdown', main),
    stop: h('div', 'hw-stop', main),
    mark: h('div', 'hw-mark', main),
    finals: h('div', 'hw-finals', main),
  };
  els.tbBig = h('span', 'hw-tb-big', els.tb);
  els.tbSmall = h('span', 'hw-tb-small', els.tb);
  h('span', 'hw-archer-word', els.archer, 'Archer');
  els.archerNum = h('span', 'hw-archer-num', els.archer);
  h('span', 'hw-archer-word', els.so, 'Shoot-off');
  els.soNum = h('span', 'hw-archer-num', els.so);

  els.endLabel = h('div', 'hw-label', els.endBox, 'End');
  const endRow = h('div', 'hw-num-row', els.endBox);
  els.endP = h('span', 'hw-p', endRow, 'P');
  els.endNum = h('span', 'hw-num', endRow);

  els.next = h('div', 'hw-next', els.bottom);
  h('span', 'hw-next-word', els.next, 'Next:');
  els.nextVal = h('span', 'hw-next-val', els.next);
  els.banner = h('div', 'hw-banner', els.bottom);
  els.date = h('div', 'hw-date', els.bottom);

  h('div', 'hw-cd-sub', els.countdown, 'The witching hour begins in…');
  h('div', 'hw-cd-title', els.countdown, 'Match starts in');
  els.cdDigits = makeDigits(els.countdown, 'hw-cd-digits');
  h('div', 'hw-cd-title', els.countdown, 'Minutes');

  // emergency: blood-red slab, huge STOP, skeleton hands clawing up from the bottom
  els.stop.innerHTML = `<div class="hw-stop-word">STOP</div>
    <svg class="hw-hand hw-hand-l" viewBox="0 0 100 160">${HAND}</svg>
    <svg class="hw-hand hw-hand-r" viewBox="0 0 100 160">${HAND}</svg>`;

  // finals (both screens)
  const f = els.finals;
  els.fl = {};
  for (const side of ['left', 'right']) {
    const s = {};
    s.timer = h('div', `hw-ftimer hw-ftimer-${side}`, f);
    s.digits = makeDigits(s.timer, 'hw-fdigits');
    s.arrow = h('div', `hw-farrow hw-farrow-${side}`, f);
    s.role = h('div', `hw-frole hw-frole-${side}`, f);
    s.target = h('div', `hw-ftarget hw-ftarget-${side}`, f);
    els.fl[side] = s;
  }
  els.fArrowLabel = h('div', 'hw-farrow-label', f, 'Arrow');
  els.fArrowNum = h('div', 'hw-farrow-num', f);
  els.fChoose = h('div', 'hw-fchoose', f, 'Choose starting side');
  els.fTime = makeDigits(f, 'hw-ftime');

  // between-ends clock screen: big time, date lines, banner + big End / Next tombstones
  els.iTime = h('div', 'hw-i-time', els.idle);
  els.iDay = h('div', 'hw-i-day', els.idle);
  els.iDate = h('div', 'hw-i-date', els.idle);
  els.iYear = h('div', 'hw-i-date', els.idle);
  els.iBanner = h('div', 'hw-i-banner', els.idle);
  els.bEnd = h('div', 'hw-badge hw-tomb', els.badges);
  els.bEndLabel = h('span', 'hw-b-word', els.bEnd);
  els.bEndNum = h('span', 'hw-b-val hw-b-end', els.bEnd);
  els.bNext = h('div', 'hw-badge hw-tomb', els.badges);
  h('span', 'hw-b-word hw-b-next-word', els.bNext, 'Next:');
  els.bNextVal = h('span', 'hw-b-val hw-b-next', els.bNext);

  ro = new ResizeObserver(() => { last.layoutKey = null; last.fit = {}; if (last.snap) render(last.snap); });
  ro.observe(root);
}

const HAND = `<g class="hw-bone">
  <path d="M38 160 L40 112 L60 112 L62 160 Z"/>
  <path d="M30 116 C28 96 34 84 50 82 C66 84 74 96 70 116 Z"/>
  <path d="M30 98 L18 74 M18 74 L10 58" />
  <path d="M38 86 L34 52 M34 52 L32 30 M32 30 L31 16"/>
  <path d="M48 84 L48 46 M48 46 L48 22 M48 22 L48 6"/>
  <path d="M58 86 L62 50 M62 50 L64 28 M64 28 L66 14"/>
  <path d="M66 92 L76 62 M76 62 L80 44 M80 44 L82 32"/></g>`;

function unmount() {
  if (ro) ro.disconnect();
  if (root) { root.textContent = ''; root.className = root.className.replace(/\bhw-[\w-]+/g, '').trim(); }
  root = els = ro = null; last = {};
}

function layout(mode, lightShown, side) {
  const W = root.clientWidth || window.innerWidth;
  const H = root.clientHeight || window.innerHeight;
  let wf = 1;
  if (mode === 'manual') wf = 0.34;
  else if (mode === 'finals') wf = lightShown ? 1.52 : 1;
  else if (mode === 'idle') wf = 1.33;
  else wf = lightShown ? 1.25 : 1;
  const R = Math.min(H / 0.75, W / wf) * 0.97;
  const key = `${mode}|${lightShown}|${side}|${W}x${H}`;
  if (last.layoutKey === key) return;
  last.layoutKey = key;
  last.fit = {};
  const U = R / 100;
  const st = els.stage.style;
  const sw = R * wf, sl = (W - sw) / 2, stp = (H - R * 0.75) / 2;
  st.setProperty('--u', U + 'px');
  root.style.setProperty('--u', U + 'px');
  st.width = sw + 'px';
  st.height = (R * 0.75) + 'px';
  st.left = sl + 'px';
  st.top = stp + 'px';
  const u = (n) => `calc(var(--u) * ${n})`;
  const m = els.main.style;
  const L = els.light.col.style;
  // the moon rises behind the top of the lamp (or End/Next) column; else in the top corner
  let moonX = side === 'left' ? W * 0.035 : W * 0.965, moonY = H * 0.08;
  // the haunted house stands in the free gap beside the detail tombstones (or the best free spot)
  let houseX = side === 'left' && lightShown ? sl + U * 117.5 : sl + U * 92.5, houseW = U * 21;
  if (mode === 'manual') {
    show(els.main, false);
    L.left = u(6); L.top = u(1.5); L.setProperty('--lamp', u(23.5));
    moonX = W / 2 + U * 22; moonY = stp + U * 12;
    houseX = W / 2 - U * 34; houseW = U * 34;
  } else if (mode === 'finals') {
    show(els.main, true);
    m.left = lightShown ? u(26) : '0px';
    els.lightL.col.style.left = u(1); els.lightR.col.style.left = u(128);
    for (const l of [els.lightL, els.lightR]) { l.col.style.top = u(1); l.col.style.setProperty('--lamp', u(22)); }
    if (lightShown) { moonX = sl + U * 139 + U * 6; moonY = stp + U * 12; }
    houseX = W / 2; houseW = U * 26;
  } else if (mode === 'idle') {
    show(els.main, true);
    m.left = side === 'left' ? u(33) : '0px';
    els.badges.style.left = side === 'left' ? u(0.5) : u(102);
    moonX = sl + (side === 'left' ? U * 16 - U * 8 : U * 117.5 + U * 8); moonY = stp + U * 10;
    houseX = sl + (side === 'left' ? U * 118 : U * 85); houseW = U * 24;
  } else {
    show(els.main, true);
    m.left = lightShown && side === 'left' ? u(25) : '0px';
    L.left = side === 'left' ? u(1.5) : u(102.5);
    L.top = u(1); L.setProperty('--lamp', u(22));
    if (lightShown) { moonX = sl + (side === 'left' ? U * 12.5 - U * 6 : U * 113.5 + U * 6); moonY = stp + U * 12; }
  }
  const hs = els.house.style;
  hs.width = houseW + 'px'; hs.height = (houseW * 150 / 262) + 'px';
  hs.left = (houseX - houseW / 2) + 'px';
  const D = Math.min(H * 0.5, W * 0.3);
  const ms = els.moon.style;
  ms.width = ms.height = D + 'px';
  ms.left = (moonX - D / 2) + 'px';
  ms.top = (moonY - D / 2) + 'px';
  // cobwebs: a big one in the corner away from the moon, a small one across the moon's corner
  const moonRight = moonX > W / 2;
  toggle(root, 'hw-moon-left', !moonRight);
}

/** Set font size (in units) so the element's text fits `widthU` units; maxFs caps it.
 *  Cached per element + key, so it measures only when the text shape changes. Returns the size. */
function fit(el, key, maxFs, widthU) {
  last.fit = last.fit || {};
  const id = el.className + (el.dataset.fid || '');
  const k = key + '|' + maxFs + '|' + widthU;
  if (last.fit[id] && last.fit[id].k === k) return last.fit[id].fs;
  el.style.fontSize = `calc(var(--u) * ${maxFs})`;
  const U = parseFloat(els.stage.style.getPropertyValue('--u')) || 1;
  // measure the content itself (centred flex content overflows both sides, so scrollWidth under-reports)
  let w = el.scrollWidth;
  try { const r = document.createRange(); r.selectNodeContents(el); w = Math.max(w, r.getBoundingClientRect().width); } catch (_) { /* ignore */ }
  const target = widthU * U;
  let fs = maxFs;
  if (w > target && w > 0) { fs = maxFs * target / w; el.style.fontSize = `calc(var(--u) * ${fs.toFixed(2)})`; }
  last.fit[id] = { k, fs };
  return fs;
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
  const idle = s.phase === 'wait' && !emergency && mode === 'std' && !finals && (s.system === 'fita' || s.system === '25m1p')
    && (d.clock === 'time' || d.clock === 'datetime');
  layout(idle ? 'idle' : mode, lightShown, side);
  toggle(root, 'hw-idleclock', idle);
  show(els.badges, idle);

  const single = finals && !bothFinals ? s.finals[s.finals.view] : null;
  // scene mood: the horizon glows in the phase colour, ghost rises in the red phase
  const sceneColor = emergency ? 'red' : idle ? 'idle'
    : mode === 'manual' ? (s.light === 'orange' ? 'orange' : s.light === 'off' ? 'idle' : s.light)
    : mode === 'finals' ? (s.finals.active ? s.finals[s.finals.active].color : 'idle')
    : s.phase === 'countdown' ? 'blue' : single ? single.color : s.digitColor;
  setData(root, 'scene', sceneColor || 'idle');
  setData(root, 'phase', s.phase);
  setData(root, 'mode', idle ? 'idle' : mode);
  toggle(root, 'hw-paused', s.paused || s.hold);

  if (idle) {
    show(els.light.col, false); show(els.lightL.col, false); show(els.lightR.col, false);
    renderIdle(s, d);
    return;
  }
  toggle(root, 'hw-hide-labels', d.hideIcons);

  // jack-o'-lantern lamps
  show(els.light.col, mode !== 'finals' && lightShown);
  setLight(els.light, emergency ? 'red' : (single ? single.light : s.light));
  show(els.lightL.col, mode === 'finals' && lightShown);
  show(els.lightR.col, mode === 'finals' && lightShown);
  if (mode === 'finals') { setLight(els.lightL, s.finals.left.light); setLight(els.lightR, s.finals.right.light); }

  if (mode === 'manual') return;

  const countdown = s.phase === 'countdown';
  const wait = s.phase === 'wait';
  const clock = wait && !emergency && (d.clock === 'time' || d.clock === 'datetime')
    ? { mode: d.clock, h24: !!d.clock24h, secs: d.clockSeconds !== false, now: new Date() } : null;

  // main digits (standard + single-side finals)
  const stdDigits = mode === 'std' && !emergency && !countdown;
  let digitStr = '', digitColor = 'idle';
  if (stdDigits) {
    if (single) { digitStr = ctx.formatTime(single.seconds, s.timeFormat); digitColor = single.color || 'idle'; }
    else { digitStr = s.seconds == null ? '' : ctx.formatTime(s); digitColor = s.digitColor || 'idle'; }
  }
  const digitsOn = stdDigits && (digitStr !== '' || !!clock);
  show(els.digits.el, digitsOn);
  show(els.clear, digitsOn);
  if (stdDigits && clock) clockFace(els.digits, clock, 98, 46);
  else if (stdDigits) {
    if (last.clockFace) { els.digits.el.style.fontSize = ''; last.clockFace = false; }
    setDigits(els.digits, digitStr, digitColor);
  }

  show(els.countdown, countdown && !emergency);
  if (countdown) setDigits(els.cdDigits, ctx.formatTime(s.seconds, 'min'), 'blue');

  show(els.stop, emergency);

  // details row: tombstone letters
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
      for (const sl of det.slots) {
        const t = h('div', 'hw-letter hw-tomb' + (sl.active ? ' on' : ''), els.letters);
        h('span', null, t, sl.letter);
      }
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

  // end (the turn number is never shown on the range display)
  const e = s.end || {};
  const endOn = mode === 'std' && e.visible !== false && e.number != null && !countdown && !emergency;
  show(els.endBox, endOn);
  if (endOn) {
    setText(els.endLabel, e.label || 'End');
    setText(els.endNum, finals ? s.finals.arrow : e.number);
    show(els.endP, !!e.practice);
  }

  // bottom line: Next + banner + date (WAIT only)
  const nextOn = mode === 'std' && wait && !finals && !!det.next;
  const bannerOn = wait && !emergency && !!(d.bannerText && d.bannerText.trim());
  show(els.next, nextOn);
  if (nextOn) setText(els.nextVal, det.next);
  const rowFree = !letters && !tb && !archer && !so;
  const bigDate = !!clock && clock.mode === 'datetime' && rowFree && mode === 'std';
  show(els.bigDate, bigDate);
  if (bigDate) {
    const n = clock.now;
    const l1 = DAYS_LONG[n.getDay()], l2 = `${n.getDate()} ${MONTHS_LONG[n.getMonth()]}`;
    const key = l1 + '|' + l2;
    if (els.bigDate.dataset.k !== key) {
      els.bigDate.dataset.k = key;
      els.bigDate.textContent = '';
      h('div', null, els.bigDate, l1); h('div', null, els.bigDate, l2);
      els.bigDate.style.setProperty('--dfs', Math.min(10, 70 / (Math.max(l1.length, l2.length) * 0.5)).toFixed(2));
    }
  }
  const dateOn = !!clock && clock.mode === 'datetime' && !bigDate;
  show(els.date, dateOn);
  if (dateOn) setText(els.date, clockText(clock.now, clock.h24, !bannerOn).date);
  toggle(els.date, 'sep', bannerOn || nextOn);
  show(els.banner, bannerOn);
  show(els.bottom, (nextOn || bannerOn || dateOn) && mode !== 'manual');
  toggle(els.bottom, 'hw-bottom-finals', mode === 'finals');
  if (bannerOn) {
    setText(els.banner, d.bannerText);
    const room = 94 - (nextOn ? 20 : 0) - (dateOn ? (els.date.scrollWidth / (parseFloat(els.stage.style.getPropertyValue('--u')) || 1)) + 4 : 0);
    fit(els.banner, d.bannerText + nextOn + dateOn, 6, room);
  }

  // paused / hold
  const mark = emergency ? '' : s.paused ? 'PAUSED' : s.hold ? 'HOLD' : '';
  setText(els.mark, mark);
  show(els.mark, !!mark);

  // finals both screens
  const wasFinals = last.finalsShown;
  last.finalsShown = mode === 'finals';
  show(els.finals, mode === 'finals');
  if (mode === 'finals') {
    toggle(els.finals, 'hw-fclock', !!clock);
    show(els.fTime.el, !!clock);
    if (clock) clockFace(els.fTime, clock, 96, 40);
    if (!wasFinals || last.finalsLayout !== last.layoutKey) {
      last.finalsLayout = last.layoutKey;
      els.finals.classList.add('hw-noanim');
      renderFinals(s);
      void els.finals.offsetWidth;
      requestAnimationFrame(() => els && els.finals.classList.remove('hw-noanim'));
    } else renderFinals(s);
  }
}

function renderFinals(s) {
  const f = s.finals;
  const running = s.phase !== 'wait';
  const active = f.active || (running ? null : f.chosen);
  toggle(els.finals, 'act-left', active === 'left');
  toggle(els.finals, 'act-right', active === 'right');
  for (const side of ['left', 'right']) {
    const x = els.fl[side];
    const st = f[side] || {};
    setDigits(x.digits, finalsDigits(st.seconds, s.timeFormat), st.color || 'idle');
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

/** Time of day in a digit box: fitted to `width` units, capped at maxFs units. */
function clockFace(d, clock, width, maxFs) {
  const c = clockText(clock.now, clock.h24, false, clock.secs);
  last.clockFace = true;
  setDigits(d, c.time, 'clock', c.ampm, c.sec);
  d.el.dataset.fid = d === els.fTime ? 'f' : 'm';
  fit(d.el, c.time.length + c.ampm + !!c.sec, maxFs, width);
}

/** Between-ends clock screen. */
function renderIdle(s, d) {
  const now = new Date();
  const H = now.getHours(), M = String(now.getMinutes()).padStart(2, '0'), S = String(now.getSeconds()).padStart(2, '0');
  const secs = d.clockSeconds !== false;
  let time = d.clock24h ? `${String(H).padStart(2, '0')}:${M}` : `${H % 12 || 12}:${M}`;
  if (secs) time += ':' + S;
  const ampm = d.clock24h ? '' : (H < 12 ? 'AM' : 'PM');
  const withDate = d.clock === 'datetime';
  const banner = (d.bannerText || '').trim();

  const timeKey = time + ampm;
  if (last.iTime !== timeKey) {
    last.iTime = timeKey;
    els.iTime.textContent = '';
    for (const ch of time) h('span', ch === ':' ? 'hw-colon' : 'hw-d', els.iTime, ch);
    if (ampm) h('span', 'hw-i-ampm', els.iTime, ampm);
  }
  // fixed-width cells: width depends only on the character count, so fit once per shape
  const fsT = fit(els.iTime, time.length + ampm + withDate, withDate ? 26 : 42, 94);
  const bannerFs = banner ? 7 : 0;
  const lineFs = withDate ? Math.min(14, (72 - fsT * 0.95 - bannerFs * 1.2) / 3 / 1.05) : 0;
  const line = (el, txt, fs, id) => {
    setText(el, txt); show(el, !!txt);
    if (txt) { el.dataset.fid = id; fit(el, txt, fs, 94); }
  };
  line(els.iDay, withDate ? DAYS_LONG[now.getDay()] : '', lineFs, 'day');
  line(els.iDate, withDate ? `${now.getDate()} ${MONTHS_LONG[now.getMonth()]}` : '', lineFs, 'date');
  line(els.iYear, withDate ? String(now.getFullYear()) : '', lineFs, 'year');
  line(els.iBanner, banner, bannerFs, 'banner');

  const e = s.end || {};
  const endTxt = (e.practice ? 'P' : '') + (e.number ?? '');
  setText(els.bEndLabel, e.label || 'End');
  setText(els.bEndNum, endTxt);
  els.bEndNum.style.fontSize = `calc(var(--u) * ${Math.min(19, 26 / (Math.max(2, endTxt.length) * 0.5)).toFixed(2)})`;
  const next = s.details && s.details.next;
  show(els.bNext, !!next);
  if (next) {
    setText(els.bNextVal, next);
    els.bNextVal.style.fontSize = `calc(var(--u) * ${Math.min(19, 26 / (Math.max(2, next.length) * 0.5)).toFixed(2)})`;
  }
  toggle(els.badges, 'single', !next);
}

function finalsDigits(sec, fmt) {
  const str = ctx.formatTime(sec ?? 0, fmt);
  return fmt !== 'min' && str.length === 3 && str[0] === '0' ? str.slice(1) : str;
}

export default { mount, render, unmount };
