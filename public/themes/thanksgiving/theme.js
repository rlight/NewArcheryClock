// Thanksgiving theme — golden-hour harvest for November shoots.
// Scenery (amber sky, low sun, rolling hills, a field with hay bales, wheat sheaves and corn shocks,
// drifting autumn leaves, a turkey with a feather fan and a cornucopia) is drawn once in SVG/CSS
// behind the content and animated with CSS only. The content follows the Classic geometry: a 4:3
// block in units of R/100 (--u) plus a lamp column, scaled to fit any screen.
// Readability first: the digits sit on a dark walnut panel with an outline and a glow in the phase
// colour; the lamps are glass lenses on a walnut board lit in the TRUE signal colours; a plaque under
// the details spells the phase (WALK UP / SHOOT / LAST n). Decoration uses muted rust/brown/ochre
// only, never the saturated signal red/yellow/green, and never sits on the lamps or digits.

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

// ---------------------------------------------------------------- scenery

const MAPLE = 'M50 2 L57 22 L70 14 L67 35 L88 29 L80 46 L97 55 L73 61 L78 79 L56 69 L52 98 L48 98 L44 69 L22 79 L27 61 L3 55 L20 46 L12 29 L33 35 L30 14 L43 22 Z';
const OAK = 'M50 3 C61 9 54 18 65 20 C76 23 66 32 75 37 C85 42 72 50 79 57 C85 65 70 67 68 75 C66 85 56 81 52 90 L51 99 L49 99 L48 90 C44 81 34 85 32 75 C30 67 15 65 21 57 C28 50 15 42 25 37 C34 32 24 23 35 20 C46 18 39 9 50 3 Z';
const LEAF_VEIN = 'M50 96 L50 18 M50 60 L30 44 M50 60 L70 44 M50 42 L36 30 M50 42 L64 30';

// [shape, left %, size vmin, fall s, delay s, colour, sway s]
const LEAVES = [
  [MAPLE, 6, 4.2, 19, -2, '#b8461c', 3.1], [OAK, 17, 3.4, 23, -11, '#8a4a1e', 3.7],
  [MAPLE, 31, 3.0, 21, -6, '#c98a2a', 2.8], [OAK, 44, 3.8, 26, -17, '#a3381a', 3.4],
  [MAPLE, 58, 3.4, 18, -9, '#d0701f', 3.0], [OAK, 69, 3.0, 24, -3, '#b37a2a', 3.9],
  [MAPLE, 81, 4.4, 22, -14, '#9c3416', 3.3], [OAK, 92, 3.2, 20, -7, '#c4621c', 2.9],
  [MAPLE, 37, 2.6, 28, -21, '#7a4520', 3.6], [MAPLE, 75, 2.8, 25, -12, '#b85a20', 3.2],
];

function leavesHTML() {
  return LEAVES.map(([d, x, s, dur, del, col, sw], i) =>
    `<div class="tg-leaf" style="left:${x}%;width:${s}vmin;animation-duration:${dur}s;animation-delay:${del}s">
      <svg viewBox="0 0 100 100" style="animation-duration:${sw}s;animation-delay:${-i * 0.7}s">
      <path d="${d}" fill="${col}"/><path d="${LEAF_VEIN}" class="tg-vein"/></svg></div>`).join('');
}

function hayBale(x, y, r) {
  // round bale seen end-on: disc + spiral + shadow
  return `<g class="tg-bale" transform="translate(${x} ${y})">
    <ellipse cx="${r * 0.15}" cy="${r * 0.95}" rx="${r * 1.25}" ry="${r * 0.22}" class="tg-shadow"/>
    <rect x="${-r * 0.2}" y="${-r}" width="${r * 1.1}" height="${r * 2}" class="tg-bale-side"/>
    <circle cx="${-r * 0.2}" cy="0" r="${r}" class="tg-bale-end"/>
    <path d="M${-r * 0.2} 0 m-${r * 0.12} 0 a${r * 0.12} ${r * 0.12} 0 1 1 ${r * 0.24} 0 a${r * 0.3} ${r * 0.3} 0 1 1 -${r * 0.54} 0 a${r * 0.5} ${r * 0.5} 0 1 1 ${r * 0.9} 0 a${r * 0.72} ${r * 0.72} 0 1 1 -${r * 1.3} 0" class="tg-spiral"/>
    <circle cx="${r * 0.9}" cy="0" r="${r}" class="tg-bale-back"/></g>`;
}

function wheat(x, y, s) {
  let stalks = '', ears = '';
  for (let i = -4; i <= 4; i++) {
    const tx = i * 4.2, ty = -46 - Math.abs(i) * -1.5;
    stalks += `M0 0 Q${i * 1.2} -20 ${tx} ${ty} `;
    ears += `<ellipse cx="${tx}" cy="${ty - 6}" rx="2.6" ry="8" transform="rotate(${i * 6} ${tx} ${ty - 6})"/>`;
  }
  return `<g class="tg-wheat" transform="translate(${x} ${y}) scale(${s})">
    <path d="${stalks} M0 0 L-9 14 M0 0 L9 14 M0 0 L0 15" class="tg-stalks"/>
    <rect x="-6" y="-20" width="12" height="5" rx="1.5" class="tg-tie"/>
    <g class="tg-ears">${ears}</g></g>`;
}

function cornShock(x, y, s) {
  let d = '';
  for (let i = -5; i <= 5; i++) d += `M${i * 5} 0 L${i * 0.6} -70 L${i * 0.3 + (i % 2 ? 6 : -6)} -96 `;
  return `<g class="tg-shock" transform="translate(${x} ${y}) scale(${s})">
    <path d="${d}" class="tg-shock-stalks"/>
    <path d="M-6 -66 L6 -66" class="tg-shock-tie"/></g>`;
}

const TURKEY = (() => {
  // a fan of feathers around (100,128), body, head with a little wattle
  const cols = ['#5c2c12', '#8a4019', '#b0661f', '#6e3816', '#9a5a1e', '#b0661f', '#6e3816', '#8a4019', '#5c2c12'];
  let fan = '';
  cols.forEach((c, i) => {
    const a = -72 + i * 18;
    fan += `<g transform="rotate(${a} 100 128)">
      <path d="M100 128 C84 96 82 34 100 6 C118 34 116 96 100 128 Z" fill="#2c160a"/>
      <path d="M100 124 C88 96 87 42 100 16 C113 42 112 96 100 124 Z" fill="${c}"/>
      <path d="M100 30 C93 38 92 46 92 52 L108 52 C108 46 107 38 100 30 Z" fill="#e6cf9c" opacity=".85"/>
      <path d="M100 124 L100 22" stroke="#2c160a" stroke-width="1.2" fill="none" opacity=".6"/></g>`;
  });
  return `<svg viewBox="0 0 200 170" class="tg-turkey-svg">${fan}
    <ellipse cx="100" cy="134" rx="38" ry="34" fill="#3d200e"/>
    <path d="M70 128 C76 150 92 160 100 160 C108 160 124 150 130 128 C120 142 80 142 70 128 Z" fill="#5a2e12"/>
    <path d="M100 108 C92 100 90 84 96 74" stroke="#4a2810" stroke-width="12" fill="none" stroke-linecap="round"/>
    <circle cx="98" cy="70" r="13" fill="#6b4024"/>
    <circle cx="94" cy="66" r="3.2" fill="#fff6e0"/><circle cx="93.4" cy="66" r="1.7" fill="#1a0c04"/>
    <circle cx="104" cy="66" r="3.2" fill="#fff6e0"/><circle cx="103.4" cy="66" r="1.7" fill="#1a0c04"/>
    <path d="M96 71 L104 71 L100 79 Z" fill="#d8a23e"/>
    <path d="M101 76 C106 80 106 88 102 90 C99 86 99 80 101 76 Z" fill="#a8301c"/></svg>`;
})();

const CORNUCOPIA = `<svg viewBox="0 0 220 130" class="tg-cornu-svg">
  <ellipse cx="120" cy="122" rx="96" ry="7" fill="rgba(0,0,0,.35)"/>
  <path d="M8 38 C28 30 44 48 60 56 C84 30 120 26 150 34 L156 118 C120 124 76 118 56 100 C40 86 24 56 8 38 Z" fill="#a8742e"/>
  <path d="M8 38 C28 30 44 48 60 56 C84 30 120 26 150 34 L156 118 C120 124 76 118 56 100 C40 86 24 56 8 38 Z" fill="url(#tg-weave)" opacity=".55"/>
  <path d="M58 56 C70 72 66 92 56 100 M80 40 C94 60 92 96 78 114 M104 32 C118 58 116 98 104 120 M128 30 C140 58 140 98 130 122" stroke="#6a4416" stroke-width="3" fill="none"/>
  <ellipse cx="152" cy="76" rx="14" ry="44" fill="#4a2c10"/>
  <circle cx="198" cy="104" r="15" fill="#8a2a1a"/><path d="M198 90 l3 -7" stroke="#3a2a0c" stroke-width="2.5"/>
  <ellipse cx="174" cy="92" rx="30" ry="24" fill="#b5541c"/>
  <path d="M164 70 C160 84 160 102 166 114 M184 70 C188 84 188 102 182 114 M174 68 L174 116" stroke="#8a3c12" stroke-width="2.5" fill="none"/>
  <path d="M172 69 C170 60 175 56 180 55 L181 60 C178 61 176 64 177 69 Z" fill="#4a5a20"/>
  <path d="M150 58 C160 40 186 38 196 50 C190 54 176 52 168 62 C162 70 152 70 150 58 Z" fill="#c9a03c"/>
  <path d="M146 110 C150 98 166 98 170 110 C166 122 150 122 146 110 Z" fill="#5d6a26"/>
  <g fill="#5a2846"><circle cx="150" cy="44" r="6"/><circle cx="160" cy="46" r="6"/><circle cx="155" cy="54" r="6"/><circle cx="145" cy="53" r="6"/><circle cx="150" cy="62" r="5.5"/></g>
  <path d="M202 66 C214 60 218 72 210 80 C204 86 196 80 202 66 Z" fill="#8a3a14"/>
</svg>`;

function sceneHTML() {
  return `
  <svg class="tg-defs" width="0" height="0" aria-hidden="true"><defs>
    <radialGradient id="tg-g-red" cx="40%" cy="36%" r="70%"><stop offset="0" stop-color="#ffd0b8"/><stop offset=".35" stop-color="#ff3a22"/><stop offset="1" stop-color="#d40c00"/></radialGradient>
    <radialGradient id="tg-g-orange" cx="40%" cy="36%" r="70%"><stop offset="0" stop-color="#fffbe0"/><stop offset=".35" stop-color="#fff01a"/><stop offset="1" stop-color="#f2cf00"/></radialGradient>
    <radialGradient id="tg-g-green" cx="40%" cy="36%" r="70%"><stop offset="0" stop-color="#e2ffd8"/><stop offset=".35" stop-color="#3dff36"/><stop offset="1" stop-color="#10c814"/></radialGradient>
    <linearGradient id="tg-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a3a"/><stop offset=".5" stop-color="#4a3418"/><stop offset="1" stop-color="#2a1c0c"/></linearGradient>
    <pattern id="tg-weave" width="12" height="10" patternUnits="userSpaceOnUse">
      <path d="M0 5 Q3 0 6 5 T12 5" stroke="#5a3a12" stroke-width="2" fill="none"/></pattern>
  </defs></svg>
  <div class="tg-sky"></div>
  <div class="tg-sun"></div>
  <div class="tg-rays"></div>
  <svg class="tg-land" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice">
    <path class="tg-hill3" d="M0 130 C140 96 300 92 460 112 C600 128 700 104 860 96 C1040 88 1200 110 1360 102 C1460 98 1540 88 1600 90 L1600 300 L0 300 Z"/>
    <path class="tg-hill2" d="M0 170 C160 140 320 136 500 156 C660 172 780 150 960 146 C1140 142 1300 160 1600 140 L1600 300 L0 300 Z"/>
    <g class="tg-barn" transform="translate(1180 150)">
      <path d="M0 0 L0 -26 L18 -40 L36 -26 L36 0 Z"/><path d="M36 0 V-18 H58 V0 Z"/></g>
    <path class="tg-field" d="M0 206 C200 186 380 184 560 196 C760 210 920 200 1100 192 C1280 184 1440 190 1600 186 L1600 300 L0 300 Z"/>
    <path class="tg-furrows" d="M0 240 C300 222 700 236 1000 226 C1250 218 1450 224 1600 220 M0 268 C320 252 680 268 1020 256 C1280 248 1460 254 1600 250 M0 292 C340 280 700 296 1040 284 C1300 276 1470 282 1600 280"/>
    ${cornShock(250, 212, 0.9)}${cornShock(300, 214, 0.75)}
    ${hayBale(470, 214, 22)}${hayBale(640, 222, 28)}${hayBale(1010, 212, 20)}${hayBale(1420, 208, 24)}
    ${wheat(560, 230, 0.9)}${wheat(1110, 222, 0.8)}${wheat(1300, 222, 0.95)}
    ${cornShock(1520, 210, 0.85)}
  </svg>
  <div class="tg-leaves">${leavesHTML()}</div>
  <div class="tg-cornu">${CORNUCOPIA}</div>
  <div class="tg-turkey">${TURKEY}</div>`;
}

// ---------------------------------------------------------------- lamps

function makeLight(parent, extra) {
  const col = h('div', 'tg-light ' + (extra || ''), parent);
  h('div', 'tg-board', col);
  const lamps = {};
  for (const c of LAMPS) {
    const l = h('div', `tg-lamp tg-lamp-${c}`, col);
    l.innerHTML = `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="url(#tg-brass)"/>
      <circle cx="50" cy="50" r="42.5" class="tg-rim"/>
      <circle cx="50" cy="50" r="40" class="tg-glass"/>
      <ellipse cx="37" cy="32" rx="15" ry="8" transform="rotate(-32 37 32)" class="tg-shine"/></svg>`;
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
  return { el: h('div', 'tg-digits ' + (cls || ''), parent), str: null };
}
function setDigits(d, str, color, suffix = '', secs = '') {
  const key = str + '|' + suffix + '|' + secs;
  if (d.str !== key) {
    d.str = key;
    d.el.textContent = '';
    if (/^[0-9:]*$/.test(str)) for (const ch of str) h('span', ch === ':' ? 'tg-colon' : 'tg-d', d.el, ch);
    else h('span', 'tg-word', d.el, str);
    if (secs) {
      const side = h('span', 'tg-side', d.el);
      h('span', 'tg-secs', side, secs);
      if (suffix) h('span', 'tg-ampm', side, suffix);
    } else if (suffix) h('span', 'tg-ampm', d.el, suffix);
    d.el.dataset.len = str.length;
    d.el.dataset.fmt = str.includes(':') ? 'min' : 'sec';
  }
  setData(d.el, 'c', color || 'idle');
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('tg-root');
  const scene = h('div', 'tg-scene', root);
  scene.innerHTML = sceneHTML();
  const stage = h('div', 'tg-stage', root);
  const main = h('div', 'tg-main', stage);
  els = {
    scene, stage, main,
    cornu: scene.querySelector('.tg-cornu'),
    panel: h('div', 'tg-panel', main),
    light: makeLight(stage, 'tg-light-main'),
    lightL: makeLight(stage, 'tg-light-fl'),
    lightR: makeLight(stage, 'tg-light-fr'),
    digits: makeDigits(main, 'tg-main-digits'),
    letters: h('div', 'tg-letters', main),
    tb: h('div', 'tg-tb tg-plank', main),
    archer: h('div', 'tg-archer tg-plank', main),
    so: h('div', 'tg-so tg-plank', main),
    endBox: h('div', 'tg-end tg-plank', main),
    bottom: h('div', 'tg-bottom', main),
    bigDate: h('div', 'tg-bigdate', main),
    idle: h('div', 'tg-idle', main),
    badges: h('div', 'tg-badges', stage),
    countdown: h('div', 'tg-countdown', main),
    stop: h('div', 'tg-stop', main),
    mark: h('div', 'tg-mark', main),
    finals: h('div', 'tg-finals', main),
  };
  const pin = h('div', 'tg-pin', els.panel);
  pin.innerHTML = `<svg viewBox="0 0 130 100">
    <g transform="translate(6 2) rotate(-28 40 50) scale(.8)"><path d="${OAK}" fill="#7a3e18"/><path d="${LEAF_VEIN}" class="tg-vein"/></g>
    <g transform="translate(44 -6) rotate(22 50 50) scale(.62)"><path d="${OAK}" fill="#a0601e"/><path d="${LEAF_VEIN}" class="tg-vein"/></g>
    <g transform="translate(-4 8) rotate(-4 50 50) scale(.95)"><path d="${MAPLE}" fill="#b0481c"/><path d="${LEAF_VEIN}" class="tg-vein"/></g>
    <g transform="translate(46 44)"><ellipse cx="0" cy="8" rx="7" ry="9" fill="#8a5a24"/><path d="M-8 2 C-8 -6 8 -6 8 2 Z" fill="#4a2c12"/><path d="M0 -4 l2 -5" stroke="#4a2c12" stroke-width="2"/></g>
    <g transform="translate(62 50) rotate(30)"><ellipse cx="0" cy="8" rx="6" ry="8" fill="#9a6a2c"/><path d="M-7 2 C-7 -5 7 -5 7 2 Z" fill="#4a2c12"/></g></svg>`;
  els.tbBig = h('span', 'tg-tb-big', els.tb);
  els.tbSmall = h('span', 'tg-tb-small', els.tb);
  h('span', 'tg-archer-word', els.archer, 'ARCHER');
  els.archerNum = h('span', 'tg-archer-num', els.archer);
  h('span', 'tg-archer-word', els.so, 'Shoot-off');
  els.soNum = h('span', 'tg-archer-num', els.so);

  els.endLabel = h('div', 'tg-label', els.endBox, 'End');
  const endRow = h('div', 'tg-num-row', els.endBox);
  els.endP = h('span', 'tg-p', endRow, 'P');
  els.endNum = h('span', 'tg-num', endRow);

  els.next = h('div', 'tg-next tg-plank', els.bottom);
  h('span', 'tg-next-word', els.next, 'Next:');
  els.nextVal = h('span', 'tg-next-val', els.next);
  els.banner = h('div', 'tg-banner', els.bottom);
  els.date = h('div', 'tg-date', els.bottom);

  h('div', 'tg-cd-title', els.countdown, 'Match starts in');
  els.cdDigits = makeDigits(els.countdown, 'tg-cd-digits');
  h('div', 'tg-cd-sub', els.countdown, 'minutes : seconds');

  els.stop.innerHTML = '<div class="tg-stop-word">STOP</div><div class="tg-stop-sub">EMERGENCY · STOP SHOOTING</div>';

  // finals (both screens)
  const f = els.finals;
  els.fl = {};
  for (const side of ['left', 'right']) {
    const s = {};
    s.timer = h('div', `tg-ftimer tg-ftimer-${side}`, f);
    s.digits = makeDigits(s.timer, 'tg-fdigits');
    s.arrow = h('div', `tg-farrow tg-farrow-${side}`, f);
    s.role = h('div', `tg-frole tg-frole-${side}`, f);
    s.target = h('div', `tg-ftarget tg-ftarget-${side}`, f);
    els.fl[side] = s;
  }
  els.fArrowLabel = h('div', 'tg-farrow-label', f, 'Arrow');
  els.fArrowNum = h('div', 'tg-farrow-num', f);
  els.fChoose = h('div', 'tg-fchoose', f, 'Choose starting side');
  els.fTime = makeDigits(f, 'tg-ftime');

  // between-ends clock screen: big time, date lines, banner + big End / Next signs
  els.iTime = h('div', 'tg-i-time', els.idle);
  els.iDay = h('div', 'tg-i-day', els.idle);
  els.iDate = h('div', 'tg-i-date', els.idle);
  els.iYear = h('div', 'tg-i-date', els.idle);
  els.iBanner = h('div', 'tg-i-banner', els.idle);
  els.iHappy = h('div', 'tg-i-happy', els.idle, 'Happy Thanksgiving');
  els.bEnd = h('div', 'tg-badge tg-plank', els.badges);
  els.bEndLabel = h('span', 'tg-b-word', els.bEnd);
  els.bEndNum = h('span', 'tg-b-val tg-b-end', els.bEnd);
  els.bNext = h('div', 'tg-badge tg-plank', els.badges);
  h('span', 'tg-b-word tg-b-next-word', els.bNext, 'Next:');
  els.bNextVal = h('span', 'tg-b-val tg-b-next', els.bNext);

  ro = new ResizeObserver(() => { last.layoutKey = null; last.fit = {}; if (last.snap) render(last.snap); });
  ro.observe(root);
}

function unmount() {
  if (ro) ro.disconnect();
  if (root) { root.textContent = ''; root.className = root.className.replace(/\btg-[\w-]+/g, '').trim(); }
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
  if (mode === 'manual') {
    show(els.main, false);
    L.left = u(6); L.top = u(2.5); L.setProperty('--lamp', u(22));
  } else if (mode === 'finals') {
    show(els.main, true);
    m.left = lightShown ? u(26) : '0px';
    els.lightL.col.style.left = u(1); els.lightR.col.style.left = u(128);
    for (const l of [els.lightL, els.lightR]) { l.col.style.top = u(1); l.col.style.setProperty('--lamp', u(22)); }
  } else if (mode === 'idle') {
    show(els.main, true);
    m.left = side === 'left' ? u(33) : '0px';
    els.badges.style.left = side === 'left' ? u(0.5) : u(102);
  } else {
    show(els.main, true);
    m.left = lightShown && side === 'left' ? u(25) : '0px';
    L.left = side === 'left' ? u(1.5) : u(102.5);
    L.top = u(1); L.setProperty('--lamp', u(22));
  }
  // the turkey + cornucopia sit in the bottom corner away from the lamps (finals: both corners are lamps)
  toggle(root, 'tg-deco-right', side === 'left');
  toggle(root, 'tg-deco-small', mode === 'finals' && lightShown);
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
  const w = el.scrollWidth, target = widthU * U;
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
  toggle(root, 'tg-idleclock', idle);
  show(els.badges, idle);

  const single = finals && !bothFinals ? s.finals[s.finals.view] : null;
  // scene mood: a soft glow along the horizon in the phase colour
  const sceneColor = emergency ? 'red' : idle ? 'idle'
    : mode === 'manual' ? (s.light === 'orange' ? 'orange' : s.light === 'off' ? 'idle' : s.light)
    : mode === 'finals' ? (s.finals.active ? s.finals[s.finals.active].color : 'idle')
    : s.phase === 'countdown' ? 'blue' : single ? single.color : s.digitColor;
  setData(root, 'scene', sceneColor || 'idle');
  setData(root, 'phase', s.phase);
  setData(root, 'mode', idle ? 'idle' : mode);
  toggle(root, 'tg-paused', s.paused || s.hold);

  if (idle) {
    show(els.light.col, false); show(els.lightL.col, false); show(els.lightR.col, false);
    renderIdle(s, d);
    return;
  }
  toggle(root, 'tg-hide-labels', d.hideIcons);

  // glass lamps
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
    if (s.hold && !single) digitStr = 'HOLD';
  }
  const digitsOn = stdDigits && (digitStr !== '' || !!clock);
  show(els.digits.el, digitsOn);
  show(els.panel, digitsOn || mode === 'finals');
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
        const t = h('div', 'tg-letter tg-plank' + (sl.active ? ' on' : ''), els.letters);
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
  toggle(els.bottom, 'tg-bottom-finals', mode === 'finals');
  if (bannerOn) {
    setText(els.banner, d.bannerText);
    const Uu = parseFloat(els.stage.style.getPropertyValue('--u')) || 1;
    const room = 96 - (nextOn ? els.next.offsetWidth / Uu + 2.5 : 0) - (dateOn ? els.date.offsetWidth / Uu + 2.5 : 0);
    fit(els.banner, d.bannerText + nextOn + dateOn + (els.date.textContent || ''), 6, room);
  }

  // paused / hold
  // phase plaque: spells the phase under the details; also PAUSED / HOLD
  const pc = mode === 'finals' ? (s.finals.active ? s.finals[s.finals.active].color : 'idle')
    : single ? single.color : s.digitColor;
  let mark = '', markC = pc;
  if (emergency || countdown) mark = '';
  else if (s.paused) { mark = 'PAUSED'; markC = 'paused'; }
  else if (s.hold) mark = s.phase === 'green' || pc === 'green' ? 'SHOOT · NO TIME LIMIT' : 'WALK UP · HOLD';
  else if (!wait) mark = phaseWord(s, pc);
  setText(els.mark, mark);
  setData(els.mark, 'c', markC || 'idle');
  show(els.mark, !!mark);
  if (mark) fit(els.mark, mark, 8, 64);

  // finals both screens
  const wasFinals = last.finalsShown;
  last.finalsShown = mode === 'finals';
  show(els.finals, mode === 'finals');
  if (mode === 'finals') {
    toggle(els.finals, 'tg-fclock', !!clock);
    show(els.fTime.el, !!clock);
    if (clock) clockFace(els.fTime, clock, 96, 40);
    if (!wasFinals || last.finalsLayout !== last.layoutKey) {
      last.finalsLayout = last.layoutKey;
      els.finals.classList.add('tg-noanim');
      renderFinals(s);
      void els.finals.offsetWidth;
      requestAnimationFrame(() => els && els.finals.classList.remove('tg-noanim'));
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
    for (const ch of time) h('span', ch === ':' ? 'tg-colon' : 'tg-d', els.iTime, ch);
    if (ampm) h('span', 'tg-i-ampm', els.iTime, ampm);
  }
  // fixed-width cells: width depends only on the character count, so fit once per shape
  const fsT = fit(els.iTime, time.length + ampm + withDate, withDate ? 26 : 42, 94);
  const bannerFs = banner ? 7 : 0;
  const happyFs = 5.2;
  const lineFs = withDate ? Math.min(13, (70 - fsT * 0.95 - bannerFs * 1.2 - happyFs * 1.3) / 3 / 1.05) : 0;
  const line = (el, txt, fs, id) => {
    setText(el, txt); show(el, !!txt);
    if (txt) { el.dataset.fid = id; fit(el, txt, fs, 94); }
  };
  line(els.iDay, withDate ? DAYS_LONG[now.getDay()] : '', lineFs, 'day');
  line(els.iDate, withDate ? `${now.getDate()} ${MONTHS_LONG[now.getMonth()]}` : '', lineFs, 'date');
  line(els.iYear, withDate ? String(now.getFullYear()) : '', lineFs, 'year');
  line(els.iBanner, banner, bannerFs, 'banner');
  els.iHappy.style.fontSize = `calc(var(--u) * ${happyFs})`;

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

function phaseWord(s, color) {
  if (color === 'green') return 'SHOOT';
  if (color === 'orange') { const n = Number(s.warningSeconds); return n > 0 ? `LAST ${n}` : 'LAST SECONDS'; }
  if (color === 'red') return s.phase === 'red' ? 'WALK UP' : 'STOP';
  return '';
}

function finalsDigits(sec, fmt) {
  const str = ctx.formatTime(sec ?? 0, fmt);
  return fmt !== 'min' && str.length === 3 && str[0] === '0' ? str.slice(1) : str;
}

export default { mount, render, unmount };
