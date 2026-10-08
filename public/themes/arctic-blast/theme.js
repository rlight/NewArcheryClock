// Arctic Blast theme — the club's winter "Arctic Ice Challenge" series.
// Scenery (navy night sky, aurora borealis ribbons, icy snow-capped mountains, falling snow, frost
// crystals in the corners) is drawn once in SVG/CSS behind the content and animated with CSS only
// (transform/opacity), so render() — which runs every frame while a timer runs — never touches it.
// The content follows the Classic geometry: a 4:3 block in units of R/100 (--u) plus a lamp column
// of three hexagonal ice-crystal lamps, scaled to fit any screen.
// Readability first: digits sit on a dark clearing with a dark outline and a glow in the phase
// colour; the lit lamp is filled with the TRUE phase colour; while a timer runs a solid colour bar
// names the phase (TO THE LINE / SHOOT / LAST 30) and the aurora dims so the green phase never
// blends into the scenery.

const LAMPS = ['red', 'orange', 'green'];
const FONT = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, sans-serif';

let root, ctx, els, ro, last = {};
let DW = 0.7, CW = 0.34;          // digit / colon cell widths in em (measured at mount)

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
function setFs(e, fs) { const v = `calc(var(--u) * ${fs.toFixed(2)})`; if (e.style.fontSize !== v) e.style.fontSize = v; }

/** Measure the real digit and colon advance widths of the font in use, so cells never clip. */
function measureDigits() {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `900 100px ${FONT}`;
    let w = 0;
    for (const d of '0123456789') w = Math.max(w, c.measureText(d).width);
    const cw = c.measureText(':').width;
    if (w > 20) { DW = w / 100 + 0.035; CW = cw / 100 + 0.03; }
  } catch (_) { /* keep defaults */ }
}
/** Width of a digit string in em (fixed cells). */
function strEm(str) {
  let w = 0;
  for (const ch of str) w += ch === ':' ? CW : DW;
  return w;
}

// ---------------------------------------------------------------- scenery

/** Frost crystal growing from a corner: main branches with 60-degree side spikes. */
function frost(size, seed) {
  let d = '';
  let r = seed;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const branch = (x, y, ang, len, depth) => {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    d += `M${x.toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
    if (depth <= 0) return;
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const bx = x + (x2 - x) * t, by = y + (y2 - y) * t;
      const sl = len * (0.42 - t * 0.25) * (0.7 + rnd() * 0.5);
      branch(bx, by, ang - Math.PI / 3, sl, depth - 1);
      branch(bx, by, ang + Math.PI / 3, sl, depth - 1);
    }
  };
  const mains = [0.08, 0.32, 0.55, 0.8, 1.02, 1.3, 1.48];
  for (const a of mains) branch(0, 0, a * Math.PI / 2 * 0.98 + (rnd() - 0.5) * 0.12, size * (0.45 + rnd() * 0.55), 2);
  return `<svg viewBox="0 0 ${size} ${size}"><path d="${d}"/></svg>`;
}

function snowflake(r) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    d += `M0 0 L${(c * r).toFixed(2)} ${(s * r).toFixed(2)} `;
    for (const t of [0.45, 0.7]) {
      const bx = c * r * t, by = s * r * t, l = r * (t === 0.45 ? 0.3 : 0.22);
      for (const da of [-Math.PI / 4, Math.PI / 4]) {
        d += `M${bx.toFixed(2)} ${by.toFixed(2)} L${(bx + Math.cos(a + da) * l).toFixed(2)} ${(by + Math.sin(a + da) * l).toFixed(2)} `;
      }
    }
  }
  return d;
}

/** An aurora curtain: a wavy band, bright at its lower edge, rays fading upward. */
function ribbon(id, pts, depth, gradId) {
  // pts: lower-edge points [x, y]; upper edge = lower edge minus depth (with some wobble)
  const smooth = (P) => {
    let s = `${P[0][0]} ${P[0][1]}`;
    for (let i = 1; i < P.length; i++) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      const mx = (x0 + x1) / 2;
      s += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
    }
    return s;
  };
  const top = pts.map(([x, y], i) => [x, y - depth * (0.75 + 0.35 * Math.sin(i * 1.7))]).reverse();
  const lower = smooth(pts), upper = smooth(top);
  return `<svg class="ab-rib ab-rib-${id}" viewBox="0 0 1600 600" preserveAspectRatio="none">
    <g filter="url(#ab-blur)">
      <path d="M${lower} L${upper} Z" fill="url(#${gradId})"/>
      <path d="M${lower} L${upper} Z" fill="url(#ab-rays)" opacity=".6"/>
      <path d="M${lower}" fill="none" stroke="url(#${gradId}-edge)" stroke-width="16" stroke-linecap="round"/>
    </g></svg>`;
}

// mountain ranges: [x, y] points alternating valley / peak, left to right
const FAR = [[-20, 235], [80, 180], [140, 200], [215, 105], [300, 175], [360, 150], [420, 200], [560, 80], [680, 190],
  [760, 150], [830, 205], [950, 60], [1070, 185], [1130, 160], [1180, 195], [1265, 100], [1350, 175], [1400, 150],
  [1470, 195], [1540, 95], [1620, 160]];
const NEAR = [[-20, 300], [90, 235], [170, 270], [295, 140], [420, 250], [470, 230], [540, 280], [640, 225], [720, 290],
  [830, 250], [920, 295], [1010, 205], [1090, 260], [1210, 125], [1340, 245], [1400, 225], [1470, 270], [1530, 215], [1620, 260]];
/** Mountain range body + snow caps (top `capFrac` of each peak, ragged lower edge) + shaded right faces. */
function range(P, cls, capCls, capFrac) {
  const f = (n) => n.toFixed(1);
  let body = `M${f(P[0][0])} 360 L${f(P[0][0])} ${f(P[0][1])} `;
  for (const [x, y] of P.slice(1)) body += `L${f(x)} ${f(y)} `;
  body += `L${f(P[P.length - 1][0])} 360 Z`;
  let caps = '', shade = '';
  for (let i = 1; i < P.length - 1; i++) {
    const [px, py] = P[i], [ax, ay] = P[i - 1], [bx, by] = P[i + 1];
    if (!(py < ay && py < by)) continue;
    const drop = Math.min(ay, by) - py, cd = drop * capFrac + 6;
    const lx = px + (ax - px) * cd / (ay - py), rx = px + (bx - px) * cd / (by - py), cy = py + cd;
    let d = `M${f(px)} ${f(py)} L${f(rx)} ${f(cy)} `;
    const n = 5;
    for (let k = 1; k < n; k++) {
      const x = rx + (lx - rx) * k / n, y = cy + (k % 2 ? -cd * 0.28 : cd * 0.08);
      d += `L${f(x)} ${f(y)} `;
    }
    caps += `<path d="${d}L${f(lx)} ${f(cy)} Z"/>`;
    // shaded right face: from the peak down the right slope to the valley, back up a ridge line
    shade += `<path d="M${f(px)} ${f(py)} L${f(bx)} ${f(by)} L${f(px + (bx - px) * 0.25)} ${f(by + 30)} Z"/>`;
  }
  return `<path class="${cls}" d="${body}"/><g class="ab-shade">${shade}</g><g class="${capCls}">${caps}</g>`;
}

function sceneHTML() {
  const flake = snowflake(40);
  return `
  <svg class="ab-defs" width="0" height="0" aria-hidden="true"><defs>
    <filter id="ab-blur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4.5"/></filter>
    <linearGradient id="ab-g1" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#7dffbc" stop-opacity="1"/><stop offset=".22" stop-color="#2dff9a" stop-opacity=".85"/>
      <stop offset=".6" stop-color="#18d6b4" stop-opacity=".38"/><stop offset="1" stop-color="#1aa3c8" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ab-g1-edge" x1="0" x2="1"><stop offset="0" stop-color="#b8ffd8" stop-opacity="0"/>
      <stop offset=".3" stop-color="#c8ffe0" stop-opacity=".8"/><stop offset=".7" stop-color="#9fffd0" stop-opacity=".7"/>
      <stop offset="1" stop-color="#b8ffd8" stop-opacity="0"/></linearGradient>
    <linearGradient id="ab-g2" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#5ff4ff" stop-opacity=".85"/><stop offset=".3" stop-color="#22d6e0" stop-opacity=".55"/>
      <stop offset=".7" stop-color="#2a8cff" stop-opacity=".2"/><stop offset="1" stop-color="#3a5cff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ab-g2-edge" x1="0" x2="1"><stop offset="0" stop-color="#c0faff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#d0fbff" stop-opacity=".75"/><stop offset="1" stop-color="#c0faff" stop-opacity="0"/></linearGradient>
    <linearGradient id="ab-g3" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#39ff9c" stop-opacity=".7"/><stop offset=".35" stop-color="#1fd3c0" stop-opacity=".4"/>
      <stop offset=".8" stop-color="#7a5cff" stop-opacity=".12"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ab-g3-edge" x1="0" x2="1"><stop offset="0" stop-color="#aaffd0" stop-opacity="0"/>
      <stop offset=".5" stop-color="#aaffd0" stop-opacity=".6"/><stop offset="1" stop-color="#aaffd0" stop-opacity="0"/></linearGradient>
    <pattern id="ab-rays" width="41" height="600" patternUnits="userSpaceOnUse">
      <rect x="1" width="3" height="600" fill="#f0fff8" opacity=".5"/><rect x="8" width="1.5" height="600" fill="#f0fff8" opacity=".35"/>
      <rect x="14" width="7" height="600" fill="#001024" opacity=".22"/><rect x="25" width="2.5" height="600" fill="#f0fff8" opacity=".42"/>
      <rect x="32" width="5" height="600" fill="#001024" opacity=".16"/><rect x="38.5" width="1" height="600" fill="#f0fff8" opacity=".3"/>
    </pattern>
    <linearGradient id="ab-mfar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5d8fc4"/><stop offset="1" stop-color="#1b3963"/></linearGradient>
    <linearGradient id="ab-mnear" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3c6fa8"/><stop offset=".6" stop-color="#173560"/><stop offset="1" stop-color="#0b1f3e"/></linearGradient>
    <linearGradient id="ab-snowcap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#a9d2f2"/></linearGradient>
    <linearGradient id="ab-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a77a8"/><stop offset=".25" stop-color="#21436f"/><stop offset="1" stop-color="#0a1a35"/></linearGradient>
    <radialGradient id="ab-lit" cx="50%" cy="42%" r="62%">
      <stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".22" stop-color="#fff" stop-opacity=".25"/>
      <stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/>
    </radialGradient>
    <path id="ab-flake" d="${flake}"/>
  </defs></svg>
  <div class="ab-sky"></div>
  <div class="ab-stars"></div><div class="ab-stars ab-stars2"></div>
  <div class="ab-aurora">
    ${ribbon(3, [[-100, 330], [250, 280], [560, 360], [900, 300], [1250, 340], [1700, 270]], 230, 'ab-g3')}
    ${ribbon(1, [[-100, 250], [200, 330], [480, 220], [820, 300], [1120, 200], [1400, 250], [1700, 180]], 260, 'ab-g1')}
    ${ribbon(2, [[-100, 420], [300, 380], [650, 450], [1000, 360], [1350, 420], [1700, 350]], 200, 'ab-g2')}
  </div>
  <div class="ab-horizon"></div>
  <svg class="ab-land" viewBox="0 0 1600 360" preserveAspectRatio="xMidYMax slice">
    ${range(FAR, 'ab-mfar', 'ab-capfar', 0.34)}
    ${range(NEAR, 'ab-mnear', 'ab-capnear', 0.3)}
    <path class="ab-ground" d="M0 318 C200 296 380 300 560 314 C760 330 940 322 1120 308 C1300 296 1460 300 1600 306 L1600 360 L0 360 Z"/>
    <path class="ab-groundline" d="M0 318 C200 296 380 300 560 314 C760 330 940 322 1120 308 C1300 296 1460 300 1600 306"/>
  </svg>
  <div class="ab-snow ab-snow1"></div><div class="ab-snow ab-snow2"></div><div class="ab-snow ab-snow3"></div>
  <div class="ab-frost ab-frost-tl">${frost(260, 7)}</div>
  <div class="ab-frost ab-frost-tr">${frost(260, 31)}</div>
  <div class="ab-frost ab-frost-bl">${frost(200, 53)}</div>
  <div class="ab-frost ab-frost-br">${frost(200, 97)}</div>
  <div class="ab-edge"></div>
  <div class="ab-brand"><svg viewBox="-42 -42 84 84"><use href="#ab-flake"/></svg>ARCTIC BLAST</div>`;
}

// ---------------------------------------------------------------- lamps: hexagonal ice crystals

function hexPts(r, cx = 50, cy = 50) {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 - 90) * Math.PI / 180;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
}
const LAMP_SVG = (() => {
  const o = hexPts(46), i = hexPts(24);
  const P = (pts) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  let facets = '';
  for (let k = 0; k < 6; k++) {
    const a = o[k], b = o[(k + 1) % 6];
    facets += `<polygon class="ab-facet ab-facet-${k % 2 ? 'd' : 'l'}" points="50,50 ${a[0].toFixed(2)},${a[1].toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}"/>`;
  }
  let spokes = '';
  for (const [x, y] of o) spokes += `M50 50 L${x.toFixed(2)} ${y.toFixed(2)} `;
  return `<svg viewBox="-2 -2 104 104">
    <polygon class="ab-hex" points="${P(o)}"/>
    ${facets}
    <polygon class="ab-hex-lit" points="${P(o)}" fill="url(#ab-lit)"/>
    <path class="ab-spokes" d="${spokes}"/>
    <polygon class="ab-inner" points="${P(i)}"/>
    <g class="ab-lflake" transform="translate(50 50) scale(.42)"><use href="#ab-flake"/></g>
    <polygon class="ab-rim" points="${P(o)}"/>
    <polygon class="ab-rim2" points="${P(hexPts(41))}"/>
  </svg>`;
})();

function makeLight(parent, extra) {
  const col = h('div', 'ab-light ' + (extra || ''), parent);
  const lamps = {};
  for (const c of LAMPS) {
    const l = h('div', `ab-lamp ab-lamp-${c}`, col);
    l.innerHTML = LAMP_SVG;
    lamps[c] = l;
  }
  return { col, lamps, lit: null };
}
function setLight(light, lit) {
  if (light.lit === lit) return;
  light.lit = lit;
  for (const c of LAMPS) toggle(light.lamps[c], 'on', c === lit);
}

/** Shield badge (like the series' event badges): rim + fill clipped to a hexagonal shield. */
function shield(cls, parent) {
  const s = h('div', 'ab-shield ' + (cls || ''), parent);
  h('div', 'ab-sh-rim', s);
  h('div', 'ab-sh-fill', s);
  return s;
}

/** Fixed-width digit cells so numbers never jitter. color: idle|red|green|orange|blue|clock */
function makeDigits(parent, cls) {
  return { el: h('div', 'ab-digits ' + (cls || ''), parent), str: null };
}
function setDigits(d, str, color, suffix = '', secs = '') {
  const key = str + '|' + suffix + '|' + secs;
  if (d.str !== key) {
    d.str = key;
    d.el.textContent = '';
    for (const ch of str) h('span', ch === ':' ? 'ab-colon' : 'ab-d', d.el, ch);
    if (secs) {
      const side = h('span', 'ab-side', d.el);
      h('span', 'ab-secs', side, secs);
      if (suffix) h('span', 'ab-ampm', side, suffix);
    } else if (suffix) h('span', 'ab-ampm', d.el, suffix);
    d.el.dataset.len = str.length;
    d.el.dataset.fmt = str.includes(':') ? 'min' : 'sec';
  }
  setData(d.el, 'c', color || 'idle');
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  measureDigits();
  root.classList.add('ab-root');
  root.style.setProperty('--dw', DW + 'em');
  root.style.setProperty('--cw', CW + 'em');
  const scene = h('div', 'ab-scene', root);
  scene.innerHTML = sceneHTML();
  const stage = h('div', 'ab-stage', root);
  const main = h('div', 'ab-main', stage);
  els = {
    scene, stage, main,
    brand: scene.querySelector('.ab-brand'),
    clear: h('div', 'ab-clear', main),
    light: makeLight(stage, 'ab-light-main'),
    lightL: makeLight(stage, 'ab-light-fl'),
    lightR: makeLight(stage, 'ab-light-fr'),
    digits: makeDigits(main, 'ab-main-digits'),
    letters: h('div', 'ab-letters', main),
    tb: h('div', 'ab-tb', main),
    archer: h('div', 'ab-archer', main),
    so: h('div', 'ab-so', main),
    endBox: shield('ab-end', main),
    bottom: h('div', 'ab-bottom', main),
    phase: h('div', 'ab-phase', main),
    bigDate: h('div', 'ab-bigdate', main),
    idle: h('div', 'ab-idle', main),
    badges: h('div', 'ab-badges', stage),
    countdown: h('div', 'ab-countdown', main),
    stop: h('div', 'ab-stop', main),
    mark: h('div', 'ab-mark', main),
    finals: h('div', 'ab-finals', main),
  };
  els.tbBig = h('span', 'ab-tb-big', els.tb);
  els.tbSmall = h('span', 'ab-tb-small', els.tb);
  h('span', 'ab-archer-word', els.archer, 'ARCHER');
  els.archerNum = h('span', 'ab-archer-num', els.archer);
  h('span', 'ab-archer-word', els.so, 'SHOOT-OFF');
  els.soNum = h('span', 'ab-archer-num', els.so);

  const endIn = h('div', 'ab-sh-in', els.endBox);
  els.endLabel = h('div', 'ab-label', endIn, 'End');
  const endRow = h('div', 'ab-num-row', endIn);
  els.endP = h('span', 'ab-p', endRow, 'P');
  els.endNum = h('span', 'ab-num', endRow);

  els.next = h('div', 'ab-next', els.bottom);
  h('span', 'ab-next-word', els.next, 'Next:');
  els.nextVal = h('span', 'ab-next-val', els.next);
  els.banner = h('div', 'ab-banner', els.bottom);
  els.date = h('div', 'ab-date', els.bottom);

  h('div', 'ab-cd-title', els.countdown, 'Match starts in');
  els.cdDigits = makeDigits(els.countdown, 'ab-cd-digits');
  h('div', 'ab-cd-sub', els.countdown, 'minutes');

  els.stop.innerHTML = `<div class="ab-stop-word">STOP</div>`;

  // finals (both screens)
  const f = els.finals;
  els.fl = {};
  for (const side of ['left', 'right']) {
    const s = {};
    s.timer = h('div', `ab-ftimer ab-ftimer-${side}`, f);
    s.digits = makeDigits(s.timer, 'ab-fdigits');
    s.arrow = h('div', `ab-farrow ab-farrow-${side}`, f);
    s.role = h('div', `ab-frole ab-frole-${side}`, f);
    s.target = h('div', `ab-ftarget ab-ftarget-${side}`, f);
    els.fl[side] = s;
  }
  els.fArrowLabel = h('div', 'ab-farrow-label', f, 'Arrow');
  els.fArrowNum = h('div', 'ab-farrow-num', f);
  els.fChoose = h('div', 'ab-fchoose', f, 'Choose starting side');
  els.fTime = makeDigits(f, 'ab-ftime');

  // between-ends clock screen: big time, date lines, banner + big End / Next shields
  els.iTime = h('div', 'ab-i-time', els.idle);
  els.iDay = h('div', 'ab-i-day', els.idle);
  els.iDate = h('div', 'ab-i-date', els.idle);
  els.iYear = h('div', 'ab-i-date', els.idle);
  els.iBanner = h('div', 'ab-i-banner', els.idle);
  els.bEnd = shield('ab-badge', els.badges);
  const bEndIn = h('div', 'ab-sh-in', els.bEnd);
  els.bEndLabel = h('span', 'ab-b-word', bEndIn);
  els.bEndNum = h('span', 'ab-b-val ab-b-end', bEndIn);
  els.bNext = shield('ab-badge ab-badge-next', els.badges);
  const bNextIn = h('div', 'ab-sh-in', els.bNext);
  h('span', 'ab-b-word ab-b-next-word', bNextIn, 'Next:');
  els.bNextVal = h('span', 'ab-b-val ab-b-next', bNextIn);

  ro = new ResizeObserver(() => { last.layoutKey = null; last.fit = {}; if (last.snap) render(last.snap); });
  ro.observe(root);
}

function unmount() {
  if (ro) ro.disconnect();
  if (root) {
    root.textContent = '';
    root.className = root.className.replace(/\bab-[\w-]+/g, '').trim();
    root.style.removeProperty('--dw'); root.style.removeProperty('--cw'); root.style.removeProperty('--u');
    for (const k of ['scene', 'phase', 'mode']) delete root.dataset[k];
  }
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
    L.left = u(6); L.top = u(1.5); L.setProperty('--lamp', u(23.5));
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
  toggle(root, 'ab-side-left', side === 'left');
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

function phaseWord(color, s) {
  if (color === 'red') return 'TO THE LINE';
  if (color === 'green') return 'SHOOT';
  if (color === 'orange') return s.warningSeconds > 0 ? `LAST ${s.warningSeconds}` : 'FINISH';
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
  toggle(root, 'ab-idleclock', idle);
  show(els.badges, idle);

  const single = finals && !bothFinals ? s.finals[s.finals.view] : null;
  // scene mood: the horizon glows in the phase colour, the aurora dims while a timer runs
  const sceneColor = emergency ? 'red' : idle ? 'idle'
    : mode === 'manual' ? (s.light === 'off' ? 'idle' : s.light)
    : mode === 'finals' ? (s.finals.active ? s.finals[s.finals.active].color : 'idle')
    : s.phase === 'countdown' ? 'blue' : single ? single.color : s.digitColor;
  setData(root, 'scene', sceneColor || 'idle');
  setData(root, 'phase', s.phase);
  setData(root, 'mode', idle ? 'idle' : mode);

  if (idle) {
    show(els.light.col, false); show(els.lightL.col, false); show(els.lightR.col, false);
    renderIdle(s, d);
    return;
  }
  toggle(root, 'ab-hide-labels', d.hideIcons);

  // ice-crystal lamps
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
  if (stdDigits && clock) clockFace(els.digits, clock, 98, 40);
  else if (stdDigits) {
    if (last.clockFace) last.clockFace = false;
    setDigits(els.digits, digitStr, digitColor);
    setFs(els.digits.el, Math.min(50, 98 / strEm(digitStr || '000')));
  }

  show(els.countdown, countdown && !emergency);
  if (countdown) {
    const cd = ctx.formatTime(s.seconds, 'min');
    setDigits(els.cdDigits, cd, 'blue');
    setFs(els.cdDigits.el, Math.min(34, 74 / strEm(cd)));
  }

  show(els.stop, emergency);

  // details row: shield letters
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
        const t = shield('ab-letter' + (sl.active ? ' on' : ''), els.letters);
        h('span', 'ab-sh-in', t, sl.letter);
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
    const lbl = e.label || 'End';
    setText(els.endLabel, lbl);
    setFs(els.endLabel, Math.min(2.9, 9.6 / (lbl.length * 0.78)));
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
      els.bigDate.style.setProperty('--dfs', Math.min(9, 70 / (Math.max(l1.length, l2.length) * 0.75)).toFixed(2));
    }
  }
  const dateOn = !!clock && clock.mode === 'datetime' && !bigDate;
  show(els.date, dateOn);
  if (dateOn) setText(els.date, clockText(clock.now, clock.h24, !bannerOn).date);
  toggle(els.date, 'sep', bannerOn || nextOn);
  show(els.banner, bannerOn);
  show(els.bottom, (nextOn || bannerOn || dateOn) && mode !== 'manual');
  toggle(els.bottom, 'ab-bottom-finals', mode === 'finals');
  if (bannerOn) {
    setText(els.banner, d.bannerText);
    const room = 94 - (nextOn ? 22 : 0) - (dateOn ? (els.date.scrollWidth / (parseFloat(els.stage.style.getPropertyValue('--u')) || 1)) + 4 : 0);
    fit(els.banner, d.bannerText + nextOn + dateOn, 5.2, room);
  }

  // phase bar / paused / hold
  const pc = mode === 'std' && !countdown && !emergency && !wait ? digitColor : '';
  let mark = '', markCls = '';
  if (!emergency && s.paused) { mark = 'PAUSED'; markCls = 'paused'; }
  else if (!emergency && s.hold) {
    if (s.phase === 'green') { mark = 'SHOOT · NO TIME LIMIT'; markCls = 'green'; }
    else { mark = s.phase === 'red' ? 'HOLD · WAIT' : 'HOLD'; markCls = s.phase === 'orange' ? 'orange' : 'red'; }
  }
  setText(els.mark, mark);
  setData(els.mark, 'c', markCls);
  show(els.mark, !!mark && mode !== 'finals');
  const word = !mark && pc ? phaseWord(pc, s) : '';
  setText(els.phase, word);
  setData(els.phase, 'c', pc);
  show(els.phase, !!word);

  // finals both screens
  const wasFinals = last.finalsShown;
  last.finalsShown = mode === 'finals';
  show(els.finals, mode === 'finals');
  if (mode === 'finals') {
    toggle(els.finals, 'ab-fclock', !!clock);
    show(els.fTime.el, !!clock);
    if (clock) clockFace(els.fTime, clock, 96, 34);
    if (!wasFinals || last.finalsLayout !== last.layoutKey) {
      last.finalsLayout = last.layoutKey;
      els.finals.classList.add('ab-noanim');
      renderFinals(s);
      void els.finals.offsetWidth;
      requestAnimationFrame(() => els && els.finals.classList.remove('ab-noanim'));
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
    const str = finalsDigits(st.seconds, s.timeFormat);
    setDigits(x.digits, str, st.color || 'idle');
    setFs(x.digits.el, Math.min(46, 62 / strEm(str)));
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
    for (const ch of time) h('span', ch === ':' ? 'ab-colon' : 'ab-d', els.iTime, ch);
    if (ampm) h('span', 'ab-i-ampm', els.iTime, ampm);
  }
  // fixed-width cells: width depends only on the character count, so fit once per shape
  const fsT = fit(els.iTime, time.length + ampm + withDate, withDate ? 24 : 38, 94);
  const bannerFs = banner ? 5.6 : 0;
  const lineFs = withDate ? Math.min(12, (70 - fsT * 0.95 - bannerFs * 1.25) / 3 / 1.1) : 0;
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
  setFs(els.bEndNum, Math.min(15, 21 / (Math.max(1.4, endTxt.length) * 0.78)));
  const next = s.details && s.details.next;
  show(els.bNext, !!next);
  if (next) {
    setText(els.bNextVal, next);
    setFs(els.bNextVal, Math.min(15, 21 / (Math.max(1.4, next.length) * 0.8)));
  }
  toggle(els.badges, 'single', !next);
}

function finalsDigits(sec, fmt) {
  const str = ctx.formatTime(sec ?? 0, fmt);
  return fmt !== 'min' && str.length === 3 && str[0] === '0' ? str.slice(1) : str;
}

export default { mount, render, unmount };
