// Archery Range theme — an indoor range: panelled wall, warm overhead lights, target-face lamps
// and wooden plaques. The content follows the Classic geometry: a 4:3 block in units of R/100 (--u)
// plus a lamp column, scaled to fit any screen. Between ends (the time-of-day screen) the date is left
// off so an archer can shoot below the time: every arrow sails high and sticks in the wall above the target.

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

// ---------------------------------------------------------------- scenery

// lamp: a round lamp printed like a target face (rings over the lamp colour)
const LAMP = `
  <circle class="ar-lamp-rim" cx="50" cy="50" r="48"/>
  <circle class="ar-lamp-face" cx="50" cy="50" r="43"/>
  <g class="ar-lamp-rings"><circle cx="50" cy="50" r="34.5"/><circle cx="50" cy="50" r="25.5"/>
    <circle cx="50" cy="50" r="16.5"/><circle cx="50" cy="50" r="7.5"/></g>
  <ellipse class="ar-lamp-shine" cx="38" cy="32" rx="17" ry="10" transform="rotate(-28 38 32)"/>`;

function sceneHTML() {
  return `
  <div class="ar-wall"></div>
  <div class="ar-lights"></div>
  <div class="ar-wainscot"></div>
  <div class="ar-horizon"></div>`;
}

// ---------------------------------------------------------------- the archer (idle screen only)
// Side-on: an archer on the left takes an arrow from his quiver, nocks, draws, aims at the target
// on the right... and his aim creeps up until every arrow thunks into the wall above the target.
// He looks up at it and scratches his head. One SVG (viewBox 0 0 250 100), posed every animation
// frame from a timeline so arms, bow, string and arrow always stay joined.

const NS = 'http://www.w3.org/2000/svg';
const FLOOR = 95, WALL_X = 234;
const SHOULDER = [41, 43], NECK = [41.5, 39.5];
const ANCHOR = [47.5, 38.2];    // string hand under the chin at full draw
const DRAW = 19;                // anchor -> grip
const BRACE = 4.5;              // grip -> string at rest
const ARROW = 30;               // nock -> tip
const UPPER = 11, FORE = 12;    // string-arm bones
const QUIVER = [29, 56];        // where the hand takes an arrow
const REST_HAND = [43.5, 64];
const SCRATCH = [39.5, 27.5];   // top-back of the head
const LOW_GRIP = [52, 63];      // bow held down between shots
const TARGET = [219, 60];
const MAX_STUCK = 5;
const RAD = Math.PI / 180;

const T = { raise: 0.9, nock: 1.6, draw: 2.7, release: 3.9, fly: 0.42, look: 4.5, scratch: 5.1,
  scratchEnd: 6.4, down: 7.3, cycle: 9 };

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const f1 = (n) => n.toFixed(2);
const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;

/** One arrow, tip at (0,0) pointing +x, nock at (-ARROW,0). */
function arrowSVG(cls) {
  return `<g class="ar-arw ${cls || ''}">
    <line class="ar-shaft" x1="${-ARROW + .6}" y1="0" x2="-2.6" y2="0"/>
    <path class="ar-point" d="M0 0 L-3.4 -1.15 L-3.4 1.15 Z"/>
    <path class="ar-vane" d="M${-ARROW + 1.2} 0 L${-ARROW + 2.4} -2.6 L${-ARROW + 7.5} -.4 L${-ARROW + 7.5} 0 Z"/>
    <path class="ar-vane ar-vane2" d="M${-ARROW + 1.2} 0 L${-ARROW + 2.4} 2.6 L${-ARROW + 7.5} .4 L${-ARROW + 7.5} 0 Z"/>
    <rect class="ar-nock" x="${-ARROW - .2}" y="-.7" width="1.4" height="1.4" rx=".4"/></g>`;
}

function targetSVG() {
  const [cx, cy] = TARGET, k = 0.42;     // face seen at an angle: rings are ellipses
  const rings = [[19, 'ar-r-w'], [15.2, 'ar-r-k'], [11.4, 'ar-r-b'], [7.6, 'ar-r-r'], [3.8, 'ar-r-g']];
  return `<g class="ar-target">
    <path class="ar-stand" d="M${cx + 3} 72 L${cx - 7} ${FLOOR} M${cx + 4} 72 L${cx + 13} ${FLOOR} M${cx + 9} 40 L${cx + 11} ${FLOOR}"/>
    <rect class="ar-boss" x="${cx - 2}" y="${cy - 23}" width="14" height="46" rx="3"/>
    <path class="ar-straw" d="M${cx} ${cy - 15} h11 M${cx} ${cy - 6} h11 M${cx} ${cy + 4} h11 M${cx} ${cy + 13} h11"/>
    ${rings.map(([r, c]) => `<ellipse class="${c}" cx="${cx}" cy="${cy}" rx="${r * k}" ry="${r}"/>`).join('')}
  </g>`;
}

function showHTML() {
  return `<svg class="ar-show-svg" viewBox="0 0 250 100" preserveAspectRatio="xMidYMax meet">
    <defs><linearGradient id="ar-wallg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8a6238" stop-opacity="0"/><stop offset=".1" stop-color="#8a6238"/>
      <stop offset="1" stop-color="#6e4c2a"/></linearGradient></defs>
    <rect class="ar-floor" x="-600" y="${FLOOR}" width="1450" height="140"/>
    <line class="ar-floor-edge" x1="-600" y1="${FLOOR}" x2="850" y2="${FLOOR}"/>
    <ellipse class="ar-shadow" cx="42" cy="${FLOOR + 1}" rx="17" ry="1.8"/>
    <g class="ar-stuck"></g>
    <g class="ar-flying" style="display:none">${arrowSVG()}</g>
    <g class="ar-dust"></g>
    <rect class="ar-backstop" x="${WALL_X}" y="-6" width="30" height="${FLOOR + 6}" fill="url(#ar-wallg)"/>
    <path class="ar-backstop-seam" d="M${WALL_X + 6} 2 V${FLOOR} M${WALL_X + 12} 2 V${FLOOR}"/>
    <line class="ar-backstop-edge" x1="${WALL_X + .3}" y1="2" x2="${WALL_X + .3}" y2="${FLOOR}"/>
    ${targetSVG()}
    <g class="ar-man">
      <path class="ar-leg ar-leg-back" d="M38 66 L34 80 L31 ${FLOOR - 1}"/>
      <path class="ar-leg" d="M41 66 L45 80 L48 ${FLOOR - 1}"/>
      <path class="ar-shoe" d="M27.5 ${FLOOR} Q28 ${FLOOR - 2.6} 31.5 ${FLOOR - 2.6} L34 ${FLOOR - 2} L34 ${FLOOR} Z"/>
      <path class="ar-shoe" d="M46 ${FLOOR} L46 ${FLOOR - 2.6} L50 ${FLOOR - 2.6} Q53.5 ${FLOOR - 2.4} 53.5 ${FLOOR} Z"/>
      <path class="ar-quiver" d="M27.5 55 L33 54 L36 70 L31 71 Z"/>
      <g class="ar-quiver-arrows"><path d="M29 55 L28 50 M31 54.6 L31 49.5 M32.6 54.4 L33.6 49.8"/></g>
      <path class="ar-torso" d="M39.5 66 C39 57 40 48 41.5 41"/>
      <path class="ar-arm ar-bowarm"/>
      <circle class="ar-hand ar-bowhand" r="1.9"/>
      <path class="ar-bow"/><path class="ar-riser"/>
      <path class="ar-string"/>
      <g class="ar-nocked">${arrowSVG()}</g>
      <g class="ar-head">
        <path class="ar-neck" d="M0 0 L1.2 -3"/>
        <circle class="ar-face" cx="2.6" cy="-6.6" r="5.2"/>
        <path class="ar-hair" d="M-2.4 -5.2 C-3 -8.6 -1.2 -11 1.8 -11.6 L-.2 -6.4 Z"/>
        <path class="ar-cap" d="M-2.6 -7.6 C-2.2 -12.6 6 -13.6 7.6 -8.6 Z"/>
        <path class="ar-brim" d="M5 -8.9 L11.6 -8.2"/>
        <circle class="ar-eye" cx="5.4" cy="-6.6" r=".7"/>
        <path class="ar-nose" d="M7.6 -6 L8.6 -4.4 L7.4 -4.2"/>
      </g>
      <path class="ar-arm ar-strarm"/>
      <circle class="ar-hand ar-strhand" r="1.8"/>
    </g>
  </svg>`;
}

/** Two-bone IK: elbow for a hand at `h`, bent backwards (the smaller-x solution). */
function elbow(s, h) {
  const dx = h[0] - s[0], dy = h[1] - s[1];
  let d = Math.hypot(dx, dy);
  const maxD = UPPER + FORE - 0.01;
  if (d > maxD) d = maxD;
  const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
  const mx = s[0] + ux * a, my = s[1] + uy * a;
  const e1 = [mx - uy * hh, my + ux * hh], e2 = [mx + uy * hh, my - ux * hh];
  return e1[0] < e2[0] ? e1 : e2;
}

let rng = null;   // { wrap, p: parts, on, raf, t0, stuck: [{g, tip, ang, at}], shot }

function showMount(parent) {
  const wrap = h('div', 'ar-show', parent);
  wrap.innerHTML = showHTML();
  const q = (c) => wrap.querySelector(c);
  rng = {
    wrap, on: false, raf: 0, t0: 0, stuck: [], shot: null, clearing: 0,
    p: {
      bowArm: q('.ar-bowarm'), bowHand: q('.ar-bowhand'), bow: q('.ar-bow'), riser: q('.ar-riser'),
      string: q('.ar-string'), nocked: q('.ar-nocked'), head: q('.ar-head'),
      strArm: q('.ar-strarm'), strHand: q('.ar-strhand'),
      stuck: q('.ar-stuck'), flying: q('.ar-flying'), dust: q('.ar-dust'),
    },
  };
}

/** Plan the next shot: a free spot on the wall above the target and the aim that gets it there. */
function planShot() {
  if (rng.stuck.length >= MAX_STUCK) rng.clearing = 1;
  const taken = rng.clearing ? [] : rng.stuck.map((a) => a.tip[1]);
  let y = 22;
  for (let i = 0; i < 30; i++) {
    y = 9 + Math.random() * 24;
    if (taken.every((v) => Math.abs(v - y) > 4.2)) break;
  }
  const P1 = [WALL_X + 3.2, y], HUMP = 4.5;
  let th = 0, P0 = ANCHOR;
  for (let i = 0; i < 5; i++) {
    P0 = [ANCHOR[0] + ARROW * Math.cos(th), ANCHOR[1] + ARROW * Math.sin(th)];
    th = Math.atan2(P1[1] - P0[1] - 4 * HUMP, P1[0] - P0[0]);
  }
  const aim = Math.atan2(TARGET[1] - ANCHOR[1], TARGET[0] - ANCHOR[0]);
  rng.shot = { P0, P1, HUMP, th, aim, landed: false };
}

function flight(sh, u) {
  const p = [lerp(sh.P0[0], sh.P1[0], u), lerp(sh.P0[1], sh.P1[1], u) - sh.HUMP * 4 * u * (1 - u)];
  const ang = Math.atan2(sh.P1[1] - sh.P0[1] - sh.HUMP * 4 * (1 - 2 * u), sh.P1[0] - sh.P0[0]);
  return { p, ang };
}

function bowPath(G, th, bend) {
  const dir = [Math.cos(th), Math.sin(th)], up = [Math.sin(th), -Math.cos(th)];
  const w = (a, b) => [G[0] + a * dir[0] + b * up[0], G[1] + a * dir[1] + b * up[1]];
  const ta = -BRACE - 2.4 * bend, tb = 20 - 1.4 * bend;
  const top = w(ta, tb), bot = w(ta, -tb);
  const d = `M${pt(w(ta + 2.2, tb + 2.6))} Q${pt(w(ta - .6, tb + 1.8))} ${pt(top)} Q${pt(w(1.6 - bend, 12))} ${pt(w(0, 3))}`
    + ` L${pt(w(0, -3))} Q${pt(w(1.6 - bend, -12))} ${pt(bot)} Q${pt(w(ta - .6, -tb - 1.8))} ${pt(w(ta + 2.2, -tb - 2.6))}`;
  return { d, top, bot, riser: `M${pt(w(.3, 4.2))} L${pt(w(.3, -4.2))}`, rest: w(-BRACE - 2.4 * bend, 0), dir };
}

function setArrow(g, tip, ang) {
  g.setAttribute('transform', `translate(${pt(tip)}) rotate(${f1(ang / RAD)})`);
}

function dust(at) {
  for (let i = 0; i < 6; i++) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', f1(at[0] - .5)); c.setAttribute('cy', f1(at[1])); c.setAttribute('r', '.9');
    rng.p.dust.appendChild(c);
    const a = (150 + Math.random() * 60) * RAD, dd = 3 + Math.random() * 4;
    const anim = c.animate([{ transform: 'translate(0,0) scale(1)', opacity: .9 },
      { transform: `translate(${f1(Math.cos(a) * dd)}px,${f1(Math.sin(a) * dd)}px) scale(2.2)`, opacity: 0 }],
    { duration: 500 + Math.random() * 300, easing: 'ease-out' });
    anim.onfinish = () => c.remove();
  }
}

function pose(t) {
  const P = rng.p, sh = rng.shot;
  // bow up / down and aim
  const r = t < T.release ? seg(t, 0, T.raise) : 1 - seg(t, T.scratchEnd, T.down);
  const drift = seg(t, T.draw + .15, T.release - .05);
  const aimTh = lerp(sh.aim, sh.th, drift);
  const th = lerp(20 * RAD, aimTh, r);
  const aimG = [ANCHOR[0] + DRAW * Math.cos(aimTh), ANCHOR[1] + DRAW * Math.sin(aimTh)];
  const G = lerp2(LOW_GRIP, aimG, r);
  const rel = t - T.release;
  const bend = t < T.nock ? 0 : t < T.release ? seg(t, T.nock, T.draw) : Math.max(0, 1 - rel / .06);
  const bow = bowPath(G, th, bend);
  const nock0 = [G[0] - BRACE * bow.dir[0], G[1] - BRACE * bow.dir[1]];

  // string hand
  let H, onString = false, carrying = false;
  if (t < T.raise) H = lerp2(REST_HAND, QUIVER, seg(t, 0, T.raise));
  else if (t < T.nock) { H = lerp2(QUIVER, nock0, seg(t, T.raise, T.nock)); carrying = true; }
  else if (t < T.release) { H = lerp2(nock0, ANCHOR, seg(t, T.nock, T.draw)); onString = true; }
  else {
    const follow = [ANCHOR[0] - 7, ANCHOR[1] - 1.5];
    if (t < T.look) H = lerp2(ANCHOR, follow, Math.min(1, rel / .12));
    else if (t < T.scratch) H = lerp2(follow, SCRATCH, seg(t, T.look, T.scratch));
    else if (t < T.scratchEnd) {
      const k = Math.sin((t - T.scratch) * 26) * 1.1;
      H = [SCRATCH[0] + k, SCRATCH[1] + Math.abs(k) * .4];
    } else H = lerp2(SCRATCH, REST_HAND, seg(t, T.scratchEnd, T.down));
  }
  const E = elbow(SHOULDER, H);
  P.strArm.setAttribute('d', `M${pt(SHOULDER)} L${pt(E)} L${pt(H)}`);
  P.strHand.setAttribute('cx', f1(H[0])); P.strHand.setAttribute('cy', f1(H[1]));
  P.bowArm.setAttribute('d', `M${pt(SHOULDER)} L${pt(G)}`);
  P.bowHand.setAttribute('cx', f1(G[0])); P.bowHand.setAttribute('cy', f1(G[1]));
  P.bow.setAttribute('d', bow.d);
  P.riser.setAttribute('d', bow.riser);
  let mid = onString ? H : bow.rest;
  if (rel > 0 && rel < .5) {
    const v = Math.sin(rel * 70) * Math.exp(-rel * 9) * 1.6;
    mid = [bow.rest[0] + v * bow.dir[0], bow.rest[1] + v * bow.dir[1]];
  }
  P.string.setAttribute('d', `M${pt(bow.top)} L${pt(mid)} L${pt(bow.bot)}`);

  // the arrow in his hands
  const inHand = carrying || onString;
  if (inHand) {
    const ang = carrying ? lerp(-70 * RAD, th, seg(t, T.raise, T.nock)) : th;
    setArrow(P.nocked, [H[0] + ARROW * Math.cos(ang), H[1] + ARROW * Math.sin(ang)], ang);
  }
  P.nocked.style.display = inHand ? '' : 'none';

  // head: follows the aim, looks up at the arrow in the wall, then back down
  const tilt = (r * drift * -4) + (t > T.release ? -14 * seg(t, T.release + .3, T.look) * (1 - seg(t, T.scratchEnd, T.down)) : 0);
  P.head.setAttribute('transform', `translate(${pt(NECK)}) rotate(${f1(tilt)})`);

  // flight, thunk, wobble
  if (rel >= 0 && !sh.landed) {
    const u = Math.min(1, rel / T.fly);
    const f = flight(sh, u);
    P.flying.style.display = '';
    setArrow(P.flying.firstElementChild, f.p, f.ang);
    if (u >= 1) {
      sh.landed = true;
      P.flying.style.display = 'none';
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = arrowSVG();
      const a = g.firstElementChild;
      P.stuck.appendChild(a);
      rng.stuck.push({ g: a, tip: f.p, ang: f.ang, at: t });
      dust([WALL_X, f.p[1]]);
    }
  } else if (rel < 0) P.flying.style.display = 'none';
  for (const s of rng.stuck) {
    const dt = t - s.at;
    const wob = dt >= 0 && dt < 1.6 ? 7 * Math.exp(-dt * 4.5) * Math.sin(dt * 46) : 0;
    setArrow(s.g, s.tip, s.ang + wob * RAD);
  }
  // a full wall: pull them all out (fade) while he takes the next arrow
  if (rng.clearing) {
    const k = 1 - seg(t, 0, .8);
    for (const s of rng.stuck) s.g.style.opacity = f1(k);
    if (k <= 0) { for (const s of rng.stuck) s.g.remove(); rng.stuck = []; rng.clearing = 0; }
  }
}

// ?pose=<seconds>[,<shots>] freezes the archer at that moment of a shot, after <shots> earlier arrows
// (for screenshots: a headless browser does not run animation frames).
const POSE = (() => {
  try { const v = new URLSearchParams(location.search).get('pose'); if (!v) return null; const [t, n] = v.split(',').map(Number); return { t, n: n || 0 }; } catch (_) { return null; }
})();

function showFrame(now) {
  if (!rng || !rng.on) return;
  if (POSE) {
    for (let i = 0; i < POSE.n; i++) { for (let t = 3.9; t <= 4.4; t += .05) pose(t); planShot(); }
    for (const s of rng.stuck) s.at = -99;
    for (let t = 0; t <= POSE.t; t += .02) pose(t);
    pose(POSE.t);
    return;
  }
  let t = (now - rng.t0) / 1000;
  if (t >= T.cycle) {
    for (const s of rng.stuck) s.at = -99;   // settled
    rng.t0 = now; t = 0; planShot();
  }
  pose(t);
  rng.raf = requestAnimationFrame(showFrame);
}

function showSet(on) {
  if (!rng || on === rng.on) return;
  rng.on = on;
  cancelAnimationFrame(rng.raf);
  if (on) {
    for (const s of rng.stuck) s.at = -99;
    planShot();
    rng.t0 = performance.now();
    rng.raf = requestAnimationFrame(showFrame);
  }
}

function makeLight(parent, extra) {
  const col = h('div', 'ar-light ' + (extra || ''), parent);
  const lamps = {};
  for (const c of LAMPS) {
    const l = h('div', `ar-lamp ar-lamp-${c}`, col);
    l.innerHTML = `<svg viewBox="0 0 100 100">${LAMP}</svg>`;
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
  return { el: h('div', 'ar-digits ' + (cls || ''), parent), str: null };
}
function setDigits(d, str, color, suffix = '', secs = '') {
  const key = str + '|' + suffix + '|' + secs;
  if (d.str !== key) {
    d.str = key;
    d.el.textContent = '';
    for (const ch of str) h('span', ch === ':' ? 'ar-colon' : 'ar-d', d.el, ch);
    if (secs) {
      const side = h('span', 'ar-side', d.el);
      h('span', 'ar-secs', side, secs);
      if (suffix) h('span', 'ar-ampm', side, suffix);
    } else if (suffix) h('span', 'ar-ampm', d.el, suffix);
    d.el.dataset.len = str.length;
    d.el.dataset.fmt = str.includes(':') ? 'min' : 'sec';
  }
  setData(d.el, 'c', color || 'idle');
}

function mount(r, c) {
  root = r; ctx = c; last = {};
  root.classList.add('ar-root');
  const scene = h('div', 'ar-scene', root);
  scene.innerHTML = sceneHTML();
  const stage = h('div', 'ar-stage', root);
  const main = h('div', 'ar-main', stage);
  els = {
    scene, stage, main,
    clear: h('div', 'ar-clear', main),
    light: makeLight(stage, 'ar-light-main'),
    lightL: makeLight(stage, 'ar-light-fl'),
    lightR: makeLight(stage, 'ar-light-fr'),
    digits: makeDigits(main, 'ar-main-digits'),
    letters: h('div', 'ar-letters', main),
    tb: h('div', 'ar-tb', main),
    archer: h('div', 'ar-archer', main),
    so: h('div', 'ar-so', main),
    endBox: h('div', 'ar-end ar-plank', main),
    bottom: h('div', 'ar-bottom', main),
    bigDate: h('div', 'ar-bigdate', main),
    idle: h('div', 'ar-idle', main),
    badges: h('div', 'ar-badges', stage),
    countdown: h('div', 'ar-countdown', main),
    stop: h('div', 'ar-stop', main),
    mark: h('div', 'ar-mark', main),
    finals: h('div', 'ar-finals', main),
  };
  els.tbBig = h('span', 'ar-tb-big', els.tb);
  els.tbSmall = h('span', 'ar-tb-small', els.tb);
  h('span', 'ar-archer-word', els.archer, 'Archer');
  els.archerNum = h('span', 'ar-archer-num', els.archer);
  h('span', 'ar-archer-word', els.so, 'Shoot-off');
  els.soNum = h('span', 'ar-archer-num', els.so);

  els.endLabel = h('div', 'ar-label', els.endBox, 'End');
  const endRow = h('div', 'ar-num-row', els.endBox);
  els.endP = h('span', 'ar-p', endRow, 'P');
  els.endNum = h('span', 'ar-num', endRow);

  els.next = h('div', 'ar-next', els.bottom);
  h('span', 'ar-next-word', els.next, 'Next:');
  els.nextVal = h('span', 'ar-next-val', els.next);
  els.banner = h('div', 'ar-banner', els.bottom);
  els.date = h('div', 'ar-date', els.bottom);

  h('div', 'ar-cd-sub', els.countdown, 'Bows up soon…');
  h('div', 'ar-cd-title', els.countdown, 'Match starts in');
  els.cdDigits = makeDigits(els.countdown, 'ar-cd-digits');
  h('div', 'ar-cd-title', els.countdown, 'Minutes');

  // emergency: a red slab with a huge STOP
  els.stop.innerHTML = '<div class="ar-stop-word">STOP</div>';

  // finals (both screens)
  const f = els.finals;
  els.fl = {};
  for (const side of ['left', 'right']) {
    const s = {};
    s.timer = h('div', `ar-ftimer ar-ftimer-${side}`, f);
    s.digits = makeDigits(s.timer, 'ar-fdigits');
    s.arrow = h('div', `ar-farrow ar-farrow-${side}`, f);
    s.role = h('div', `ar-frole ar-frole-${side}`, f);
    s.target = h('div', `ar-ftarget ar-ftarget-${side}`, f);
    els.fl[side] = s;
  }
  els.fArrowLabel = h('div', 'ar-farrow-label', f, 'Arrow');
  els.fArrowNum = h('div', 'ar-farrow-num', f);
  els.fChoose = h('div', 'ar-fchoose', f, 'Choose starting side');
  els.fTime = makeDigits(f, 'ar-ftime');

  // between-ends clock screen: time, banner and the archer below; End / Next plaques beside
  els.iTime = h('div', 'ar-i-time', els.idle);
  els.iDay = h('div', 'ar-i-day', els.idle);
  els.iDate = h('div', 'ar-i-date', els.idle);
  els.iYear = h('div', 'ar-i-date', els.idle);
  els.iBanner = h('div', 'ar-i-banner', els.idle);
  showMount(els.idle);
  els.bEnd = h('div', 'ar-badge ar-plank', els.badges);
  els.bEndLabel = h('span', 'ar-b-word', els.bEnd);
  els.bEndNum = h('span', 'ar-b-val ar-b-end', els.bEnd);
  els.bNext = h('div', 'ar-badge ar-plank', els.badges);
  h('span', 'ar-b-word ar-b-next-word', els.bNext, 'Next:');
  els.bNextVal = h('span', 'ar-b-val ar-b-next', els.bNext);

  ro = new ResizeObserver(() => { last.layoutKey = null; last.fit = {}; if (last.snap) render(last.snap); });
  ro.observe(root);
}

function unmount() {
  if (rng) { showSet(false); rng = null; }
  if (ro) ro.disconnect();
  if (root) { root.textContent = ''; root.className = root.className.replace(/\bar-[\w-]+/g, '').trim(); }
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
  toggle(root, 'ar-idleclock', idle);
  showSet(idle);
  show(els.badges, idle);

  const single = finals && !bothFinals ? s.finals[s.finals.view] : null;
  // scene mood: the floor glows in the phase colour
  const sceneColor = emergency ? 'red' : idle ? 'idle'
    : mode === 'manual' ? (s.light === 'orange' ? 'orange' : s.light === 'off' ? 'idle' : s.light)
    : mode === 'finals' ? (s.finals.active ? s.finals[s.finals.active].color : 'idle')
    : s.phase === 'countdown' ? 'blue' : single ? single.color : s.digitColor;
  setData(root, 'scene', sceneColor || 'idle');
  setData(root, 'phase', s.phase);
  setData(root, 'mode', idle ? 'idle' : mode);
  toggle(root, 'ar-paused', s.paused || s.hold);

  if (idle) {
    show(els.light.col, false); show(els.lightL.col, false); show(els.lightR.col, false);
    renderIdle(s, d);
    return;
  }
  toggle(root, 'ar-hide-labels', d.hideIcons);

  // target-face lamps
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

  // details row: plaque letters
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
        const t = h('div', 'ar-letter ar-plank' + (sl.active ? ' on' : ''), els.letters);
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
  toggle(els.bottom, 'ar-bottom-finals', mode === 'finals');
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
    toggle(els.finals, 'ar-fclock', !!clock);
    show(els.fTime.el, !!clock);
    if (clock) clockFace(els.fTime, clock, 96, 40);
    if (!wasFinals || last.finalsLayout !== last.layoutKey) {
      last.finalsLayout = last.layoutKey;
      els.finals.classList.add('ar-noanim');
      renderFinals(s);
      void els.finals.offsetWidth;
      requestAnimationFrame(() => els && els.finals.classList.remove('ar-noanim'));
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
  // the date is left off this theme's between-ends screen: the archer gets the room instead
  const banner = (d.bannerText || '').trim();

  const timeKey = time + ampm;
  if (last.iTime !== timeKey) {
    last.iTime = timeKey;
    els.iTime.textContent = '';
    for (const ch of time) h('span', ch === ':' ? 'ar-colon' : 'ar-d', els.iTime, ch);
    if (ampm) h('span', 'ar-i-ampm', els.iTime, ampm);
  }
  // fixed-width cells: width depends only on the character count, so fit once per shape
  fit(els.iTime, time.length + ampm + !!banner, banner ? 25 : 31, 94);
  setText(els.iBanner, banner); show(els.iBanner, !!banner);
  if (banner) { els.iBanner.dataset.fid = 'banner'; fit(els.iBanner, banner, 6.5, 94); }
  for (const el of [els.iDay, els.iDate, els.iYear]) show(el, false);

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
