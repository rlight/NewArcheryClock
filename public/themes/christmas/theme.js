// Christmas theme — a cosy snowy night for December shoots.
// Scenery (night sky, moon, Santa's sleigh, falling snow, a string of bulbs, snowy pines, a decorated
// tree with presents) is drawn once in SVG/CSS behind the content and animated with CSS only.
// The content follows the Classic geometry: a 4:3 block in units of R/100 (--u) plus a lamp column
// of three big glass ornaments, scaled to fit any screen.
// Readability first: the decoration is kept muted (warm white, gold, ice blue, lavender) so only the
// lit ornament, the digits and the phase word carry the true phase colours. Digits sit on a dark
// clearing with a dark outline and a glow in the phase colour.

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

// glass ornament (lamp): hook, gold cap, ball, shading, highlight
const ORNAMENT = `
  <circle class="xm-hook" cx="50" cy="6" r="4.2"/>
  <rect class="xm-cap" x="40" y="9.5" width="20" height="9" rx="2"/>
  <path class="xm-cap-line" d="M42 12.5 H58 M42 15.5 H58"/>
  <circle class="xm-ball" cx="50" cy="59" r="40"/>
  <circle class="xm-shade" cx="50" cy="59" r="40" fill="url(#xm-shade)"/>
  <ellipse class="xm-hl" cx="35" cy="42" rx="8" ry="13" transform="rotate(32 35 42)"/>
  <ellipse class="xm-hl2" cx="66" cy="83" rx="5" ry="2.6" transform="rotate(-35 66 83)"/>`;

const BULB_COLS = ['#ffe6b0', '#8ec5ff', '#e7a0e0', '#f0c060', '#bfe8ff'];

/** String of small coloured bulbs sagging along the top edge (muted colours, not phase colours). */
function bulbString() {
  const N = 14, W = 1600, seg = W / N;
  let wire = 'M0 6', bulbs = '';
  for (let i = 0; i < N; i++) {
    const x0 = i * seg, x1 = x0 + seg;
    wire += ` Q${(x0 + seg / 2).toFixed(1)} 40 ${x1.toFixed(1)} 6`;
    // three bulbs per scallop at t = .25 / .5 / .75 along the quadratic
    for (const t of [0.22, 0.5, 0.78]) {
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + seg / 2) + t * t * x1;
      const y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 40 + t * t * 6;
      const k = i * 3 + Math.round(t * 4);
      const col = BULB_COLS[k % BULB_COLS.length];
      const rot = (t - 0.5) * -50;
      bulbs += `<g class="xm-b xm-b${k % 4}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})">
        <circle cx="0" cy="11" r="11" fill="${col}" class="xm-b-glow"/>
        <rect x="-3" y="-1" width="6" height="5" rx="1" fill="#3a3a2a"/>
        <path d="M0 3 C-5 5 -5.5 11 -3.2 15 C-1.8 17.5 1.8 17.5 3.2 15 C5.5 11 5 5 0 3 Z" fill="${col}"/></g>`;
    }
  }
  return `<svg class="xm-string" viewBox="0 0 1600 64" preserveAspectRatio="xMidYMin slice">
    <path class="xm-wire" d="${wire}"/>${bulbs}</svg>`;
}

/** Snow-covered pine: dark tiers with soft white snow on each tier. */
function pine(x, base, ht, cls) {
  const w = ht * 0.62;
  let tiers = '', snow = '';
  const n = 3;
  for (let i = 0; i < n; i++) {
    const top = base - ht + (i * ht * 0.26);
    const bot = base - ht * (0.42 - i * 0.2) + (i === n - 1 ? ht * 0.12 : 0);
    const half = w * (0.3 + i * 0.2);
    tiers += `M${x} ${top} L${x + half} ${bot} L${x - half} ${bot} Z `;
    snow += `M${x} ${top} L${x + half * 0.42} ${top + (bot - top) * 0.42} Q${x + half * 0.2} ${top + (bot - top) * 0.36} ${x} ${top + (bot - top) * 0.46} Q${x - half * 0.2} ${top + (bot - top) * 0.36} ${x - half * 0.42} ${top + (bot - top) * 0.42} Z `;
    snow += `M${x - half} ${bot} Q${x} ${bot - (bot - top) * 0.18} ${x + half} ${bot} Q${x} ${bot - (bot - top) * 0.06} ${x - half} ${bot} Z `;
  }
  return `<g class="${cls}"><rect x="${x - w * 0.05}" y="${base - ht * 0.12}" width="${w * 0.1}" height="${ht * 0.14}" class="xm-trunk"/>
    <path d="${tiers}" class="xm-pine"/><path d="${snow}" class="xm-pine-snow"/></g>`;
}

function treeSvg() {
  // decorated tree with twinkling lights, gold garland, star and presents
  const L = [[100, 66, 0], [86, 90, 1], [116, 96, 2], [100, 112, 3], [72, 128, 0], [128, 132, 1], [92, 146, 2],
    [114, 160, 3], [62, 178, 1], [140, 176, 0], [84, 190, 3], [106, 196, 2], [130, 204, 1], [50, 222, 2],
    [74, 230, 0], [98, 234, 1], [124, 236, 3], [150, 226, 0], [64, 200, 3], [148, 150, 2]];
  const cols = ['#fff1c8', '#ffd36a', '#9fd0ff', '#e9a7e4'];
  let lights = '';
  L.forEach(([x, y, c], i) => {
    lights += `<g class="xm-tl xm-tl${i % 4}"><circle cx="${x}" cy="${y}" r="9" fill="${cols[c]}" opacity=".28"/>
      <circle cx="${x}" cy="${y}" r="3.8" fill="${cols[c]}"/></g>`;
  });
  return `<svg class="xm-tree" viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet">
    <ellipse cx="100" cy="292" rx="96" ry="9" fill="rgba(210,225,255,.18)"/>
    <rect x="90" y="246" width="20" height="30" fill="#2a1a10"/>
    <path class="xm-tree-body" d="M100 34 L138 92 L122 92 L160 152 L140 152 L184 222 L162 222 L194 254 L6 254 L38 222 L16 222 L60 152 L40 152 L78 92 L62 92 Z"/>
    <path class="xm-tree-snow" d="M100 34 L114 56 Q100 50 86 56 Z M62 92 Q100 82 138 92 Q100 88 62 92 Z M40 152 Q100 140 160 152 Q100 147 40 152 Z M16 222 Q100 210 184 222 Q100 216 16 222 Z M6 254 Q100 242 194 254 Q100 249 6 254 Z"/>
    <path class="xm-garland" d="M80 84 Q104 98 124 86 M58 132 Q100 156 146 136 M40 196 Q100 222 166 198 M22 244 Q90 262 180 244"/>
    ${lights}
    <g class="xm-star"><circle cx="100" cy="30" r="20" fill="url(#xm-starglow)"/>
      <path d="M100 12 L105 25 L119 25 L108 33 L112 47 L100 39 L88 47 L92 33 L81 25 L95 25 Z"/></g>
    <g class="xm-gift"><rect x="18" y="258" width="44" height="34" fill="#c9a24a"/><rect x="36" y="258" width="8" height="34" fill="#7a2a36"/>
      <rect x="14" y="252" width="52" height="9" fill="#d8b358"/><rect x="36" y="252" width="8" height="9" fill="#7a2a36"/>
      <path d="M40 252 C30 240 22 246 30 252 M40 252 C50 240 58 246 50 252" stroke="#7a2a36" stroke-width="3" fill="none"/></g>
    <g class="xm-gift"><rect x="128" y="264" width="52" height="28" fill="#1f3570"/><rect x="150" y="264" width="8" height="28" fill="#d9dfe9"/>
      <rect x="124" y="258" width="60" height="8" fill="#2a4384"/><rect x="150" y="258" width="8" height="8" fill="#d9dfe9"/>
      <path d="M154 258 C144 247 136 252 144 258 M154 258 C164 247 172 252 164 258" stroke="#d9dfe9" stroke-width="3" fill="none"/></g>
    <g class="xm-gift"><rect x="70" y="272" width="30" height="20" fill="#6a2333"/><rect x="82" y="272" width="6" height="20" fill="#e2c26a"/>
      <rect x="68" y="268" width="34" height="6" fill="#7d2a3c"/></g>
  </svg>`;
}

const SLEIGH = `<svg viewBox="0 0 260 70" class="xm-sleighsvg">
  <g class="xm-sl">
    ${[0, 46, 92].map((x) => `<g transform="translate(${x} ${x === 46 ? -4 : x === 92 ? -8 : 0})">
      <path d="M8 34 C10 28 22 26 32 28 L36 22 L40 20 L42 24 L38 30 C36 36 30 38 26 38 L28 46 L25 46 L22 39 L14 39 L10 46 L7 46 L9 38 C6 37 6 35 8 34 Z"/>
      <path d="M38 21 L36 12 M37 15 L32 11 M39 19 L44 12 M42 15 L46 13" class="xm-antler"/></g>`).join('')}
    <path d="M40 30 L150 22 L178 36" class="xm-rein"/>
    <path d="M160 22 C164 16 172 14 176 18 L180 16 C184 12 190 14 190 20 L208 16 L214 32 C214 42 200 44 186 44 L166 44 C160 40 158 30 160 22 Z"/>
    <circle cx="180" cy="13" r="5"/><path d="M196 18 L198 4 L212 6 L210 20 Z"/>
    <path d="M150 50 L216 50 C224 50 226 44 222 40" class="xm-runner"/>
  </g></svg>`;

function sceneHTML() {
  let pinesBack = '', pinesFront = '';
  const P1 = [[40, 214, 90], [120, 220, 120], [230, 208, 80], [330, 218, 70], [520, 214, 96], [610, 220, 66],
    [760, 210, 84], [900, 214, 72], [1020, 206, 98], [1150, 212, 76], [1290, 206, 92], [1400, 214, 70], [1520, 210, 104]];
  for (const p of P1) pinesBack += pine(...p, 'xm-p-back');
  const P2 = [[80, 258, 150], [190, 262, 110], [430, 258, 92], [1220, 262, 100], [1380, 258, 140], [1560, 262, 120]];
  for (const p of P2) pinesFront += pine(...p, 'xm-p-front');
  return `
  <svg class="xm-defs" width="0" height="0" aria-hidden="true"><defs>
    <radialGradient id="xm-shade" cx="38%" cy="34%" r="70%">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".78" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".5"/>
    </radialGradient>
    <radialGradient id="xm-starglow"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".8"/>
      <stop offset="1" stop-color="#ffd060" stop-opacity="0"/></radialGradient>
    <linearGradient id="xm-snowfield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a5a80"/><stop offset=".25" stop-color="#2c3858"/><stop offset="1" stop-color="#141b30"/></linearGradient>
    <linearGradient id="xm-snowhill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#334468"/><stop offset="1" stop-color="#1a2440"/></linearGradient>
  </defs></svg>
  <div class="xm-sky"></div>
  <div class="xm-stars"></div><div class="xm-stars xm-stars2"></div>
  <div class="xm-moon"></div>
  <div class="xm-sleigh">${SLEIGH}</div>
  <svg class="xm-land" viewBox="0 0 1600 270" preserveAspectRatio="xMidYMax slice">
    <path fill="url(#xm-snowhill)" d="M0 190 C140 150 300 140 460 166 C600 188 720 190 860 176 C1020 160 1180 150 1340 166 C1460 178 1540 170 1600 160 L1600 270 L0 270 Z"/>
    ${pinesBack}
    <path fill="url(#xm-snowfield)" d="M0 236 C200 216 380 218 560 230 C760 244 920 238 1100 226 C1280 214 1440 216 1600 226 L1600 270 L0 270 Z"/>
    ${pinesFront}
  </svg>
  <div class="xm-treebox">${treeSvg()}</div>
  <div class="xm-snow xm-snow1"></div><div class="xm-snow xm-snow2"></div><div class="xm-snow xm-snow3"></div>
  ${bulbString()}`;
}

function makeLight(parent, extra) {
  const col = h('div', 'xm-light ' + (extra || ''), parent);
  const lamps = {};
  for (const c of LAMPS) {
    const l = h('div', `xm-lamp xm-lamp-${c}`, col);
    l.innerHTML = `<svg viewBox="0 0 100 100">${ORNAMENT}</svg>`;
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
  return { el: h('div', 'xm-digits ' + (cls || ''), parent), str: null };
}
function setDigits(d, str, color, suffix = '', secs = '') {
  const key = str + '|' + suffix + '|' + secs;
  if (d.str !== key) {
    d.str = key;
    d.el.textContent = '';
    for (const ch of str) h('span', ch === ':' ? 'xm-colon' : 'xm-d', d.el, ch);
    if (secs) {
      const side = h('span', 'xm-side', d.el);
      h('span', 'xm-secs', side, secs);
      if (suffix) h('span', 'xm-ampm', side, suffix);
    } else if (suffix) h('span', 'xm-ampm', d.el, suffix);
    d.el.dataset.len = str.length;
    d.el.dataset.fmt = str.includes(':') ? 'min' : 'sec';
  }
  setData(d.el, 'c', color || 'idle');
}

/** Gift tag: gold edge + filled face (both clipped to the tag shape), punched hole, string. */
function makeTag(parent, cls) {
  const t = h('div', 'xm-tag ' + (cls || ''), parent);
  h('div', 'xm-tag-b', t);
  const f = h('div', 'xm-tag-f', t);
  return { t, f };
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('xm-root');
  const scene = h('div', 'xm-scene', root);
  scene.innerHTML = sceneHTML();
  const stage = h('div', 'xm-stage', root);
  const main = h('div', 'xm-main', stage);
  els = {
    scene, stage, main,
    moon: scene.querySelector('.xm-moon'),
    sleigh: scene.querySelector('.xm-sleigh'),
    tree: scene.querySelector('.xm-treebox'),
    clear: h('div', 'xm-clear', main),
    light: makeLight(stage, 'xm-light-main'),
    lightL: makeLight(stage, 'xm-light-fl'),
    lightR: makeLight(stage, 'xm-light-fr'),
    digits: makeDigits(main, 'xm-main-digits'),
    bigWord: h('div', 'xm-bigword', main),
    letters: h('div', 'xm-letters', main),
    tb: h('div', 'xm-tb', main),
    archer: h('div', 'xm-archer', main),
    so: h('div', 'xm-so', main),
    bottom: h('div', 'xm-bottom', main),
    bigDate: h('div', 'xm-bigdate', main),
    idle: h('div', 'xm-idle', main),
    badges: h('div', 'xm-badges', stage),
    countdown: h('div', 'xm-countdown', main),
    stop: h('div', 'xm-stop', main),
    word: h('div', 'xm-word', main),
    finals: h('div', 'xm-finals', main),
  };
  const endTag = makeTag(main, 'xm-end');
  els.endBox = endTag.t;
  els.tbBig = h('span', 'xm-tb-big', els.tb);
  els.tbSmall = h('span', 'xm-tb-small', els.tb);
  h('span', 'xm-archer-word', els.archer, 'ARCHER');
  els.archerNum = h('span', 'xm-archer-num', els.archer);
  h('span', 'xm-archer-word', els.so, 'SHOOT-OFF');
  els.soNum = h('span', 'xm-archer-num', els.so);

  els.endLabel = h('div', 'xm-label', endTag.f, 'End');
  const endRow = h('div', 'xm-num-row', endTag.f);
  els.endP = h('span', 'xm-p', endRow, 'P');
  els.endNum = h('span', 'xm-num', endRow);

  els.next = h('div', 'xm-next', els.bottom);
  h('span', 'xm-next-word', els.next, 'Next:');
  els.nextVal = h('span', 'xm-next-val', els.next);
  els.banner = h('div', 'xm-banner', els.bottom);
  els.date = h('div', 'xm-date', els.bottom);

  h('div', 'xm-cd-sub', els.countdown, '❄  Gather round, archers  ❄');
  h('div', 'xm-cd-title', els.countdown, 'Match starts in');
  els.cdDigits = makeDigits(els.countdown, 'xm-cd-digits');
  h('div', 'xm-cd-title', els.countdown, 'Minutes');

  els.stop.innerHTML = '<div class="xm-stop-word">STOP</div>';
  els.stopWord = els.stop.firstChild;

  // finals (both screens)
  const f = els.finals;
  els.fl = {};
  for (const side of ['left', 'right']) {
    const s = {};
    s.timer = h('div', `xm-ftimer xm-ftimer-${side}`, f);
    s.digits = makeDigits(s.timer, 'xm-fdigits');
    s.arrow = h('div', `xm-farrow xm-farrow-${side}`, f);
    s.role = h('div', `xm-frole xm-frole-${side}`, f);
    s.target = h('div', `xm-ftarget xm-ftarget-${side}`, f);
    els.fl[side] = s;
  }
  els.fArrowLabel = h('div', 'xm-farrow-label', f, 'Arrow');
  els.fArrowNum = h('div', 'xm-farrow-num', f);
  els.fChoose = h('div', 'xm-fchoose', f, 'Choose starting side');
  els.fTime = makeDigits(f, 'xm-ftime');

  // between-ends clock screen: big time, date lines, banner + big End / Next gift tags
  els.iTime = h('div', 'xm-i-time', els.idle);
  els.iDay = h('div', 'xm-i-day', els.idle);
  els.iDate = h('div', 'xm-i-date', els.idle);
  els.iYear = h('div', 'xm-i-date', els.idle);
  els.iBanner = h('div', 'xm-i-banner', els.idle);
  const bE = makeTag(els.badges, 'xm-badge');
  els.bEnd = bE.t;
  els.bEndLabel = h('span', 'xm-b-word', bE.f);
  els.bEndNum = h('span', 'xm-b-val', bE.f);
  const bN = makeTag(els.badges, 'xm-badge');
  els.bNext = bN.t;
  h('span', 'xm-b-word', bN.f, 'Next:');
  els.bNextVal = h('span', 'xm-b-val', bN.f);

  ro = new ResizeObserver(() => { last.layoutKey = null; last.fit = {}; if (last.snap) render(last.snap); });
  ro.observe(root);
}

function unmount() {
  if (ro) ro.disconnect();
  if (root) { root.textContent = ''; root.className = root.className.replace(/\bxm-[\w-]+/g, '').trim(); }
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
  let moonX = side === 'left' ? W * 0.06 : W * 0.94, moonY = H * 0.12;
  // the decorated tree stands in the free gap beside the detail tags (or the best free spot)
  let treeX = side === 'left' && lightShown ? sl + U * 117 : sl + U * 92, treeW = U * 20;
  if (mode === 'manual') {
    show(els.main, false);
    L.left = u(6); L.top = u(1.5); L.setProperty('--lamp', u(23.5));
    moonX = W / 2 + U * 26; moonY = stp + U * 12;
    treeX = W / 2 - U * 32; treeW = U * 30;
  } else if (mode === 'finals') {
    show(els.main, true);
    m.left = lightShown ? u(26) : '0px';
    els.lightL.col.style.left = u(1); els.lightR.col.style.left = u(128);
    for (const l of [els.lightL, els.lightR]) { l.col.style.top = u(1); l.col.style.setProperty('--lamp', u(22)); }
    if (lightShown) { moonX = sl + U * 139 + U * 4; moonY = stp + U * 12; }
    treeX = sl + U * (lightShown ? 26 : 0) + U * 88; treeW = U * 15;
  } else if (mode === 'idle') {
    show(els.main, true);
    m.left = side === 'left' ? u(33) : '0px';
    els.badges.style.left = side === 'left' ? u(0.5) : u(102);
    moonX = sl + (side === 'left' ? U * 16 - U * 6 : U * 117.5 + U * 6); moonY = stp + U * 10;
    treeX = sl + (side === 'left' ? U * 120 : U * 88); treeW = U * 18;
  } else {
    show(els.main, true);
    m.left = lightShown && side === 'left' ? u(25) : '0px';
    L.left = side === 'left' ? u(1.5) : u(102.5);
    L.top = u(1); L.setProperty('--lamp', u(22));
    if (lightShown) { moonX = sl + (side === 'left' ? U * 12.5 - U * 5 : U * 113.5 + U * 5); moonY = stp + U * 12; }
  }
  const ts = els.tree.style;
  ts.width = treeW + 'px'; ts.height = (treeW * 1.5) + 'px';
  ts.left = (treeX - treeW / 2) + 'px';
  const D = Math.min(H * 0.34, W * 0.2);
  const ms = els.moon.style;
  ms.width = ms.height = D + 'px';
  ms.left = (moonX - D / 2) + 'px';
  ms.top = (moonY - D / 2) + 'px';
  // Santa's sleigh crosses in front of the moon now and then
  els.sleigh.style.top = (moonY - D * 0.18) + 'px';
  els.sleigh.style.setProperty('--sw', (D * 0.95) + 'px');
  toggle(root, 'xm-moon-left', moonX < W / 2);
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

/** Phase word for a colour (the safety signal in words). */
function phaseWord(s, color) {
  if (color === 'green') return 'SHOOT';
  if (color === 'orange') {
    const n = Number(s.warningSeconds);
    return n > 0 ? `LAST ${n}` : 'LAST SECONDS';
  }
  if (color === 'red') return s.phase === 'red' ? 'WALK UP' : 'WAIT';
  return '';
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
  toggle(root, 'xm-idleclock', idle);
  show(els.badges, idle);

  const single = finals && !bothFinals ? s.finals[s.finals.view] : null;
  setData(root, 'phase', s.phase);
  setData(root, 'mode', idle ? 'idle' : mode);
  toggle(root, 'xm-emerg', emergency);

  if (idle) {
    show(els.light.col, false); show(els.lightL.col, false); show(els.lightR.col, false);
    renderIdle(s, d);
    return;
  }
  toggle(root, 'xm-hide-labels', d.hideIcons);

  // ornament lamps
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
  const hold = !!s.hold && !s.paused && !emergency && !countdown && !wait;
  const greenHold = hold && s.phase === 'green';

  // main digits (standard + single-side finals)
  const stdDigits = mode === 'std' && !emergency && !countdown;
  let digitStr = '', digitColor = 'idle';
  if (stdDigits) {
    if (single) { digitStr = ctx.formatTime(single.seconds, s.timeFormat); digitColor = single.color || 'idle'; }
    else { digitStr = s.seconds == null ? '' : ctx.formatTime(s); digitColor = s.digitColor || 'idle'; }
  }
  // an untimed hold shows a word instead of 000: green hold = SHOOT (no time limit), else HOLD
  const bigWord = stdDigits && hold ? (greenHold ? 'SHOOT' : 'HOLD') : '';
  const digitsOn = stdDigits && !bigWord && (digitStr !== '' || !!clock);
  show(els.digits.el, digitsOn);
  show(els.bigWord, !!bigWord);
  show(els.clear, digitsOn || !!bigWord);
  if (bigWord) {
    setText(els.bigWord, bigWord);
    setData(els.bigWord, 'c', digitColor);
    fit(els.bigWord, bigWord, 30, 96);
  }
  if (digitsOn && clock) clockFace(els.digits, clock, 98, 44);
  else if (digitsOn) {
    if (last.clockFace) { els.digits.el.style.fontSize = ''; last.clockFace = false; }
    setDigits(els.digits, digitStr, digitColor);
  }

  show(els.countdown, countdown && !emergency);
  if (countdown) setDigits(els.cdDigits, ctx.formatTime(s.seconds, 'min'), 'blue');

  show(els.stop, emergency);
  if (emergency) fit(els.stopWord, 'STOP', 30, 90);

  // details row: gift-tag letters
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
        const t = makeTag(els.letters, 'xm-letter' + (sl.active ? ' on' : ''));
        h('span', null, t.f, sl.letter);
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
      els.bigDate.style.setProperty('--dfs', Math.min(10, 70 / (Math.max(l1.length, l2.length) * 0.55)).toFixed(2));
    }
  }
  const dateOn = !!clock && clock.mode === 'datetime' && !bigDate;
  show(els.date, dateOn);
  if (dateOn) setText(els.date, clockText(clock.now, clock.h24, !bannerOn).date);
  toggle(els.date, 'sep', bannerOn || nextOn);
  show(els.banner, bannerOn);
  show(els.bottom, (nextOn || bannerOn || dateOn) && mode !== 'manual');
  toggle(els.bottom, 'xm-bottom-finals', mode === 'finals');
  if (bannerOn) {
    setText(els.banner, d.bannerText);
    const room = 94 - (nextOn ? 21 : 0) - (dateOn ? (els.date.scrollWidth / (parseFloat(els.stage.style.getPropertyValue('--u')) || 1)) + 4 : 0);
    fit(els.banner, d.bannerText + nextOn + dateOn, 6, room);
  }

  // phase word ribbon (running) / PAUSED / hold
  let word = '', wordC = 'idle';
  if (!emergency && !countdown && !wait) {
    const color = mode === 'finals' ? (s.finals.active ? s.finals[s.finals.active].color : '')
      : single ? single.color : s.digitColor;
    if (s.paused) { word = 'PAUSED'; wordC = 'paused'; }
    else if (greenHold) { word = 'NO TIME LIMIT'; wordC = 'green'; }
    else if (hold && s.phase === 'red') { word = 'WALK UP'; wordC = 'red'; }
    else { word = phaseWord(s, color); wordC = color; }
  } else if (s.paused && !emergency) { word = 'PAUSED'; wordC = 'paused'; }
  if (els.word.dataset.w !== word) {
    // numbers in the heavy digit face (Georgia's old-style figures read poorly from far away)
    els.word.dataset.w = word;
    els.word.textContent = '';
    for (const part of word.split(/(\d+)/)) if (part) h('span', /\d/.test(part) ? 'xm-word-num' : null, els.word, part);
  }
  setData(els.word, 'c', wordC);
  show(els.word, !!word);
  toggle(els.word, 'xm-word-finals', mode === 'finals');

  // finals both screens
  const wasFinals = last.finalsShown;
  last.finalsShown = mode === 'finals';
  show(els.finals, mode === 'finals');
  if (mode === 'finals') {
    toggle(els.finals, 'xm-fclock', !!clock);
    show(els.fTime.el, !!clock);
    if (clock) clockFace(els.fTime, clock, 96, 40);
    if (!wasFinals || last.finalsLayout !== last.layoutKey) {
      last.finalsLayout = last.layoutKey;
      els.finals.classList.add('xm-noanim');
      renderFinals(s);
      void els.finals.offsetWidth;
      requestAnimationFrame(() => els && els.finals.classList.remove('xm-noanim'));
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
    for (const ch of time) h('span', ch === ':' ? 'xm-colon' : 'xm-d', els.iTime, ch);
    if (ampm) h('span', 'xm-i-ampm', els.iTime, ampm);
  }
  // fixed-width cells: width depends only on the character count, so fit once per shape
  const fsT = fit(els.iTime, time.length + ampm + withDate, withDate ? 24 : 40, 94);
  const bannerFs = banner ? 6.5 : 0;
  const lineFs = withDate ? Math.min(13, (72 - fsT * 0.95 - bannerFs * 1.2) / 3 / 1.08) : 0;
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
  els.bEndNum.style.fontSize = `calc(var(--u) * ${Math.min(14.5, 20 / (Math.max(2, endTxt.length) * 0.5)).toFixed(2)})`;
  const next = s.details && s.details.next;
  show(els.bNext, !!next);
  if (next) {
    setText(els.bNextVal, next);
    els.bNextVal.style.fontSize = `calc(var(--u) * ${Math.min(14.5, 20 / (Math.max(2, next.length) * 0.5)).toFixed(2)})`;
  }
  toggle(els.badges, 'single', !next);
}

function finalsDigits(sec, fmt) {
  const str = ctx.formatTime(sec ?? 0, fmt);
  return fmt !== 'min' && str.length === 3 && str[0] === '0' ? str.slice(1) : str;
}

export default { mount, render, unmount };
