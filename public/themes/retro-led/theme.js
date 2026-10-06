// Retro LED theme — looks like a physical Lancaster / Chronotir dot-LED range timer.
// The whole board is one SVG. Every LED is a permanent dim "socket" circle plus a lit circle
// (radial gradient with a baked-in glow) that is shown only when the LED is on, so unlit LEDs
// stay faintly visible like on a real board. The layout is rebuilt only when its shape changes
// (system, view, format, letter group size…); per-frame renders only flip LEDs that changed.

const NS = 'http://www.w3.org/2000/svg';
const U = 10;                               // SVG units per digit dot pitch

const COLORS = {
  red: ['#ff2a16', '#ffd9cc'],
  green: ['#2bff52', '#e2ffe6'],
  amber: ['#ffb000', '#fff1c4'],
  yellow: ['#ffd800', '#fffbd6'],
  blue: ['#2f8dff', '#d9ecff'],
};
const PHASE_LED = { idle: 'dim-amber', red: 'red', green: 'green', orange: 'yellow', blue: 'blue' };

// ---------------------------------------------------------------- glyphs

// 7-segment layout on an 8 × 15 dot grid (6 LEDs per segment, empty corners).
const SEG = {};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
SEG.a = range(1, 6).map((x) => [x, 0]);
SEG.g = range(1, 6).map((x) => [x, 7]);
SEG.d = range(1, 6).map((x) => [x, 14]);
SEG.f = range(1, 6).map((y) => [0, y]);
SEG.b = range(1, 6).map((y) => [7, y]);
SEG.e = range(8, 13).map((y) => [0, y]);
SEG.c = range(8, 13).map((y) => [7, y]);
const DIGIT = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg',
  7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '',
};

// 5 × 7 dot-matrix font.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '<': ['00001', '00011', '00111', '01111', '00111', '00011', '00001'],
  '>': ['10000', '11000', '11100', '11110', '11100', '11000', '10000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

// ---------------------------------------------------------------- svg helpers

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function buildDefs(svg) {
  const defs = el('defs', null, svg);
  for (const [name, [c, hot]] of Object.entries(COLORS)) {
    const g = el('radialGradient', { id: `rl-led-${name}` }, defs);
    [[0, hot, 1], [0.2, c, 1], [0.4, c, 0.95], [0.48, c, 0.5], [0.66, c, 0.16], [1, c, 0]]
      .forEach(([o, col, op]) => el('stop', { offset: o, 'stop-color': col, 'stop-opacity': op }, g));
    const d = el('radialGradient', { id: `rl-dim-${name}`, fx: 0.42, fy: 0.4 }, defs);
    [[0, c, 0.5], [0.7, c, 0.3], [1, c, 0.12]]
      .forEach(([o, col, op]) => el('stop', { offset: o, 'stop-color': col, 'stop-opacity': op }, d));
  }
  const off = el('radialGradient', { id: 'rl-off', fx: 0.4, fy: 0.36 }, defs);
  [[0, '#6a6a68'], [0.45, '#353534'], [1, '#191919']]
    .forEach(([o, col]) => el('stop', { offset: o, 'stop-color': col }, off));

  const lin = (id, x2, y2, stops) => {
    const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs);
    stops.forEach(([o, col, op = 1]) => el('stop', { offset: o, 'stop-color': col, 'stop-opacity': op }, g));
  };
  lin('rl-house', 0, 1, [[0, '#1a1a1b'], [1, '#0e0e0f']]);
  // a faint bloom over the lit layer: makes LEDs bleed light into the panel like a photo
  const bloom = el('filter', { id: 'rl-bloom', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
  el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 9, result: 'b' }, bloom);
  const m = el('feMerge', null, bloom);
  el('feMergeNode', { in: 'b' }, m);
  el('feMergeNode', { in: 'SourceGraphic' }, m);
}

// ---------------------------------------------------------------- LED primitives

class Led {
  constructor(L, x, y, p) {
    this.L = L; this.x = x * U; this.y = y * U; this.p = p; this.s = 'off'; this.lit = null;
    el('circle', { cx: this.x, cy: this.y, r: 0.34 * p * U, fill: 'url(#rl-off)' }, L.sock);
  }
  set(s) {
    if (s === this.s) return;
    this.s = s;
    if (s === 'off') { if (this.lit) this.lit.setAttribute('visibility', 'hidden'); return; }
    if (!this.lit) this.lit = el('circle', { cx: this.x, cy: this.y }, this.L.lit);
    const dim = s.startsWith('dim-');
    this.lit.setAttribute('r', (dim ? 0.36 : 0.98) * this.p * U);
    this.lit.setAttribute('fill', dim ? `url(#rl-${s})` : `url(#rl-led-${s})`);
    this.lit.setAttribute('visibility', 'visible');
  }
}

/** 7-segment digit of dots; top-left LED centre at (x, y); span 7p × 14p. */
function seg7(L, x, y, p) {
  const segs = {};
  for (const k in SEG) segs[k] = SEG[k].map(([dx, dy]) => new Led(L, x + dx * p, y + dy * p, p));
  return {
    set(ch, color) {
      const on = DIGIT[ch] ?? '';
      for (const k in segs) {
        const st = on.includes(k) ? color : 'off';
        for (const d of segs[k]) d.set(st);
      }
    },
  };
}

/** 5 × 7 dot-matrix character; span 4p × 6p. */
function matrix(L, x, y, p) {
  const dots = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) dots.push(new Led(L, x + c * p, y + r * p, p));
  return {
    set(ch, color) {
      const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        dots[r * 5 + c].set(g[r][c] === '1' ? color : 'off');
      }
    },
  };
}

/** Square 5 × 5 lamp block in a little housing; span 4q. */
function lamp(L, x, y, q, color) {
  const pad = 0.75 * q;
  el('rect', {
    x: (x - pad) * U, y: (y - pad) * U, width: (4 * q + 2 * pad) * U, height: (4 * q + 2 * pad) * U,
    rx: 0.35 * q * U, fill: 'url(#rl-house)', stroke: '#2a2a2b', 'stroke-width': 0.08 * U,
  }, L.under);
  const dots = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) dots.push(new Led(L, x + c * q, y + r * q, q));
  return { set(on) { for (const d of dots) d.set(on ? color : 'off'); } };
}

/** A single round indicator LED with a silkscreen label to its right. */
function indicator(L, x, y, label, size = 1.0) {
  const d = new Led(L, x, y, size);
  silk(L, x + 1.0 * size, y + 0.38 * size, label, 1.05 * size, 'start');
  return d;
}

function groove(x, y0, y1) {
  el('line', { x1: x * U, y1: y0 * U, x2: x * U, y2: y1 * U, stroke: '#000', 'stroke-width': 0.22 * U,
    'stroke-linecap': 'round' }, L.under);
  el('line', { x1: (x + 0.16) * U, y1: y0 * U, x2: (x + 0.16) * U, y2: y1 * U, stroke: '#2b2b2d',
    'stroke-width': 0.08 * U, 'stroke-linecap': 'round' }, L.under);
}

function silk(L, x, y, text, size, anchor = 'middle', cls = 'rl-silk') {
  const t = el('text', { x: x * U, y: y * U, 'font-size': size * U, 'text-anchor': anchor, class: cls }, L.labels);
  t.textContent = text;
  return t;
}

// ---------------------------------------------------------------- layout decisions

function letterGroup(s) {
  const d = s.details || {};
  if (d.kind === 'topbottom' && d.topbottom) return { type: 'big', label: 'DETAIL' };
  if (d.kind === 'archer' && d.archer != null) return { type: 'archer', label: 'ARCHER' };
  if (d.kind === 'letters' && Array.isArray(d.slots) && d.slots.length >= 2) {
    const g = groupLetters(s);
    return { type: 'letters', n: Math.min(3, Math.max(1, g.length || 2)), label: 'DETAIL' };
  }
  return null;
}

function groupLetters(s) {
  const d = s.details || {};
  if ((s.phase === 'wait' || s.phase === 'countdown') && d.next) return String(d.next).split('');
  return (d.slots || []).filter((x) => x.active).map((x) => x.letter);
}

function isEmergency(s) { return s.phase === 'emergency' || !!s.emergency; }

function layoutOptions(s) {
  const disp = s.display || {};
  const fmt = s.phase === 'countdown' ? 'min' : (s.timeFormat === 'min' ? 'min' : 'sec');
  const lamps = disp.trafficLight !== false;
  const side = disp.trafficSide === 'left' ? 'left' : 'right';
  // time-of-day row is part of the layout whenever enabled (blank outside WAIT) so the board
  // does not jump in size between phases
  // time of day replaces the main digits between ends (phase "wait") when enabled
  const clock = s.phase === 'wait' && (disp.clock === 'time' || disp.clock === 'datetime')
    ? { mode: disp.clock, h24: !!disp.clock24h, secs: disp.clockSeconds !== false } : null;
  const mainArea = clock ? 'clock' : fmt;
  if (isEmergency(s)) {
    return { mode: 'std', area: 'stop', lamps: true, side, letters: null, end: false };
  }
  if (s.system === 'manual') return { mode: 'manual' };
  if (s.system === 'finals' && s.finals) {
    const f = s.finals;
    if (f.view === 'left' || f.view === 'right') {
      return { mode: 'std', area: mainArea, lamps, side, letters: null, end: true, finalsView: f.view, clock };
    }
    return { mode: 'finals2', fmt, lamps, targets: !!f.showTargets, wide: (f.turns || 0) >= 10, clock };
  }
  return {
    mode: 'std', area: mainArea, lamps, side, letters: letterGroup(s),
    end: !!(s.end && s.end.visible !== false), clock,  // no TURN on the board (operator sees it on the control page)
  };
}

// ---------------------------------------------------------------- builders

const MAIN_TOP = 3.4;        // y of the first LED row of the main line
const MAIN_SPAN = 14;        // main line height (LED centre to centre)
const GAP = 4.2;             // gap between columns

/** Time area: returns { width, set(text, color) }. */
function buildArea(L, x, y, kind, p = 1, clock = null) {
  if (kind === 'clock') {
    // HH:MM in the big digits (blank leading hour digit in 12 h), plus AM/PM LEDs
    const ds = [0, 10, 23.4, 33.4].map((dx) => seg7(L, x + dx * p, y, p));
    const cx = x + 20.2 * p;
    const colon = [new Led(L, cx, y + 4.5 * p, 1.35 * p), new Led(L, cx, y + 9.5 * p, 1.35 * p)];
    let am = null, pm = null, secs = null;
    let width = clock.h24 ? 40.4 : 47.2;
    if (clock.secs) {
      // seconds: two smaller digits top-aligned right of the minutes, AM/PM LEDs underneath
      const sp = 0.55 * p, sx = x + 44.0 * p;
      secs = [seg7(L, sx, y, sp), seg7(L, sx + 9.5 * sp, y, sp)];
      width = 44.0 + 9.5 * 0.55 + 7 * 0.55;
      if (!clock.h24) {
        am = indicator(L, x + 44.4 * p, y + 11.6 * p, 'AM', 1.15 * p);
        pm = indicator(L, x + 50.0 * p, y + 11.6 * p, 'PM', 1.15 * p);
        width = Math.max(width, 54.0);
      }
    } else if (!clock.h24) {
      am = indicator(L, x + 42.2 * p, y + 3.2 * p, 'AM', 1.25 * p);
      pm = indicator(L, x + 42.2 * p, y + 9.6 * p, 'PM', 1.25 * p);
    }
    return {
      width: width * p,
      setClock(now) {
        if (secs) {
          const ss = String(now.getSeconds()).padStart(2, '0');
          secs[0].set(ss[0], 'amber'); secs[1].set(ss[1], 'amber');
        }
        const H = now.getHours();
        const hh = clock.h24 ? String(H).padStart(2, '0') : String(H % 12 || 12).padStart(2, ' ');
        const mm = String(now.getMinutes()).padStart(2, '0');
        (hh + mm).split('').forEach((ch, i) => ds[i].set(ch, 'amber'));
        colon.forEach((c) => c.set('amber'));
        if (am) { am.set(H < 12 ? 'amber' : 'off'); pm.set(H >= 12 ? 'amber' : 'off'); }
      },
    };
  }
  if (kind === 'stop') {
    const q = 1.45;
    const yy = y + (MAIN_SPAN * p - 6 * q) / 2;
    const chars = [0, 1, 2, 3].map((i) => matrix(L, x + i * 6.3 * q, yy, q));
    return {
      width: (3 * 6.3 + 4) * q,
      set(on) { 'STOP'.split('').forEach((c, i) => chars[i].set(c, on ? 'red' : 'dim-red')); },
    };
  }
  if (kind === 'min') {
    const d0 = seg7(L, x, y, p);
    const cx = x + 10.2 * p;
    const colon = [new Led(L, cx, y + 4.5 * p, 1.35 * p), new Led(L, cx, y + 9.5 * p, 1.35 * p)];
    const d1 = seg7(L, x + 13.4 * p, y, p);
    const d2 = seg7(L, x + 23.4 * p, y, p);
    return {
      width: 30.4 * p,
      set(text, color) {
        const m = /^(\d):(\d)(\d)$/.exec(text || '');
        d0.set(m ? m[1] : ' ', color); d1.set(m ? m[2] : ' ', color); d2.set(m ? m[3] : ' ', color);
        colon.forEach((c) => c.set(m ? color : 'off'));
      },
    };
  }
  const ds = [0, 1, 2].map((i) => seg7(L, x + i * 10 * p, y, p));
  return {
    width: 27 * p,
    set(text, color) {
      const t = /^\d{3}$/.test(text || '') ? text : '   ';
      ds.forEach((d, i) => d.set(t[i], color));
    },
  };
}

function buildLamps(L, x, y, span = MAIN_SPAN) {
  const q = span / 16;                       // 3 blocks of 5 rows + 2 gap rows → 16 pitches
  const r = lamp(L, x, y, q, 'red');
  const o = lamp(L, x, y + 6 * q, q, 'yellow');
  const g = lamp(L, x, y + 12 * q, q, 'green');
  return {
    width: 4 * q,
    set(light) { r.set(light === 'red'); o.set(light === 'orange'); g.set(light === 'green'); },
  };
}

function buildLetters(L, x, y, lg) {
  if (lg.type === 'big' || lg.type === 'archer' || (lg.type === 'letters' && lg.n === 1)) {
    const p = MAIN_SPAN / 6;
    const m = matrix(L, x, y, p);
    return {
      width: 4 * p,
      set(s) {
        const ch = lg.type === 'big' ? (s.details.topbottom?.big || ' ')
          : lg.type === 'archer' ? String((s.details.archer ?? ' ')).slice(-1)
          : (groupLetters(s)[0] || ' ');
        m.set(ch.toUpperCase(), 'amber');
      },
    };
  }
  const n = lg.n;
  const p = MAIN_SPAN / (n * 7 + (n - 1) * 1 - 1);
  const ms = Array.from({ length: n }, (_, i) => matrix(L, x, y + i * 8 * p, p));
  return {
    width: 4 * p,
    set(s) {
      const g = groupLetters(s);
      ms.forEach((m, i) => m.set((g[i] || ' ').toUpperCase(), 'amber'));
    },
  };
}

/** Small 2-digit dot number (end / target); returns { width, set(n, color) }. */
function smallNumber(L, x, y, p, digits = 2) {
  const ds = Array.from({ length: digits }, (_, i) => seg7(L, x + i * 9.5 * p, y, p));
  return {
    width: (digits - 1) * 9.5 * p + 7 * p,
    set(n, color) {
      let t = n == null ? '' : String(n);
      t = t.slice(-digits).padStart(digits, ' ');
      ds.forEach((d, i) => d.set(t[i], color));
    },
  };
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY_LONG = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTH_LONG = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER',
  'OCTOBER', 'NOVEMBER', 'DECEMBER'];
function longDate(d) { return `${DAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`; }
const CLOCK_P = 0.8;                       // dot pitch of the finals time-of-day row
const CLOCK_ROW = 14 * CLOCK_P + 2.4;      // extra board height for that row

/** Finals (both screens) time-of-day row centred on cx: H:MM in dot-LED digits, AM/PM LEDs, date. */
function buildClock(L, cx, y, c) {
  const p = CLOCK_P, k = p / 0.4, pitch = 9.5 * p, dw = 7 * p;
  const digitsW = 3 * pitch + 5 * p + dw;
  const sp = 0.55 * p, secsW = c.secs ? 3.6 * p + 9.5 * sp + 7 * sp : 0;
  const ampmW = c.h24 ? 0 : (c.secs ? Math.max(0, 11.2 * p - secsW) : 4.2 * k);
  const dateSize = 1.15 * k;
  const dateW = c.mode === 'datetime' ? 1.0 * k + 10 * 0.7 * dateSize : 0;
  const total = digitsW + secsW + ampmW + dateW;
  let x = cx - total / 2;
  const h1 = seg7(L, x, y, p), h2 = seg7(L, x + pitch, y, p);
  const colX = x + 2 * pitch - (pitch - dw) / 2 + 2.5 * p;
  const colon = [new Led(L, colX, y + 4.5 * p, 1.35 * p), new Led(L, colX, y + 9.5 * p, 1.35 * p)];
  const m1 = seg7(L, x + 2 * pitch + 5 * p, y, p), m2 = seg7(L, x + 3 * pitch + 5 * p, y, p);
  let am = null, pm = null, secs = null;
  if (c.secs) {
    const sx = x + digitsW + 3.6 * p;
    secs = [seg7(L, sx, y, sp), seg7(L, sx + 9.5 * sp, y, sp)];
    if (!c.h24) {
      am = indicator(L, sx + 0.4 * p, y + 11.6 * p, 'AM', 1.15 * p);
      pm = indicator(L, sx + 6.0 * p, y + 11.6 * p, 'PM', 1.15 * p);
    }
    x += digitsW + secsW + ampmW + 1.0 * k;
  } else {
    x += digitsW + 1.0 * k;
    if (!c.h24) {
      am = indicator(L, x, y + 3.2 * p, 'AM', 1.25 * p);
      pm = indicator(L, x, y + 9.6 * p, 'PM', 1.25 * p);
      x += ampmW;
    }
  }
  const date = c.mode === 'datetime' ? silk(L, x, y + 7 * p + 0.4 * dateSize, '', dateSize, 'start') : null;
  return {
    set(now) {
      const H = now.getHours();
      const hh = c.h24 ? String(H).padStart(2, '0') : String(H % 12 || 12).padStart(2, ' ');
      const mm = String(now.getMinutes()).padStart(2, '0');
      h1.set(hh[0], 'amber'); h2.set(hh[1], 'amber'); m1.set(mm[0], 'amber'); m2.set(mm[1], 'amber');
      colon.forEach((d) => d.set('amber'));
      if (secs) {
        const ss = String(now.getSeconds()).padStart(2, '0');
        secs[0].set(ss[0], 'amber'); secs[1].set(ss[1], 'amber');
      }
      if (am) { am.set(H < 12 ? 'amber' : 'off'); pm.set(H >= 12 ? 'amber' : 'off'); }
      if (date) {
        const t = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
        if (date.textContent !== t) date.textContent = t;
      }
    },
  };
}


// ---------------------------------------------------------------- the theme

let root = null, ctx = null, svg = null, board = null, L = null;
let key = '';
let widgets = null;
let emergencyStart = 0;

function clearBoard() {
  if (board) board.remove();
  board = el('g', null, svg);
  L = {
    frame: el('g', null, board),
    under: el('g', null, board),
    sock: el('g', null, board),
    lit: el('g', { filter: 'url(#rl-bloom)' }, board),
    labels: el('g', null, board),
    gloss: el('g', { 'pointer-events': 'none' }, board),
  };
}

/** Sets the viewBox around the content box [x0,y0,x1,y1]. The screen itself is the LED board:
 *  no bezel, screws or reflection; the face colour (theme.css background) fills the whole screen. */
function frame(x0, y0, x1, y1, banner) {
  const pad = 1.2;
  const fx0 = x0 - pad, fy0 = y0 - pad, fx1 = x1 + pad, fy1 = y1 + pad + (banner ? 0.6 : 0);
  const R = (v) => v * U;
  let bannerEl = null;
  if (banner) {
    bannerEl = silk(L, (fx0 + fx1) / 2, fy1 - 0.55, '', 1.25, 'middle', 'rl-banner');
    bannerEl.removeAttribute('textLength');
  }
  svg.setAttribute('viewBox', `${R(fx0)} ${R(fy0)} ${R(fx1 - fx0)} ${R(fy1 - fy0)}`);
  return { bannerEl, maxBannerWidth: (fx1 - fx0) * 0.8 };
}

function buildStd(o) {
  const w = {};
  const y = MAIN_TOP;
  let x = 0;
  const cols = [];
  // Chronotir/Lancaster board order: letters | lamps | digits. Without a letter column the
  // lamps follow display.trafficSide.
  if (o.letters) {
    cols.push('letters');
    if (o.lamps) cols.push('lamps');
    cols.push('area');
  } else {
    if (o.lamps && o.side === 'left') cols.push('lamps');
    cols.push('area');
    if (o.lamps && o.side === 'right') cols.push('lamps');
  }
  let areaX = 0, areaW = 0, lettersX = 0;
  for (const c of cols) {
    if (c === 'letters') {
      w.letters = buildLetters(L, x, y, o.letters);
      lettersX = x;
      silk(L, x + w.letters.width / 2, 1.5, o.letters.label, 1.0);
      x += w.letters.width + GAP + 0.6;
      groove(x - (GAP + 0.6) / 2, MAIN_TOP - 2.4, MAIN_TOP + MAIN_SPAN + 1.4);
    } else if (c === 'lamps') {
      w.lamps = buildLamps(L, x, y);
      x += w.lamps.width + GAP;
    } else {
      w.area = buildArea(L, x, y, o.area, 1, o.clock);
      areaX = x; areaW = w.area.width;
      const label = o.area === 'stop' ? 'EMERGENCY' : o.area === 'min' ? 'MIN : SEC'
        : o.area === 'clock' ? 'TIME OF DAY' : 'SECONDS';
      // datetime: the date is printed large above the clock digits
      w.areaLabel = o.area === 'clock' && o.clock.mode === 'datetime'
        ? silk(L, x + areaW / 2, 1.75, '', 1.6) : silk(L, x + areaW / 2, 1.5, label, 1.0);
      x += areaW + GAP;
    }
  }
  const width = x - GAP;
  // bottom row
  const by = MAIN_TOP + MAIN_SPAN + 2.6;
  const sp = 0.3;
  if (o.end) {
    w.endLabel = silk(L, 0, by + 2.1 * 1, o.finalsView ? 'ARROW' : 'END', 1.0, 'start');
    const lx = o.finalsView ? 4.6 : 3.3;
    w.end = smallNumber(L, lx, by - 0.2, sp);
    w.practice = matrix(L, lx + w.end.width + 1.0, by + 0.25, 0.55);
  }
  // status indicators, centred under the time area
  // centred in the free space right of the end block
  const leftEdge = o.end ? (o.finalsView ? 4.6 : 3.3) + 9.5 * sp + 7 * sp + 1.0 + 2.2 + 1.5 : 0;
  const rightEdge = width;
  const ix = Math.max(leftEdge, (leftEdge + rightEdge) / 2 - 9.6);
  w.ind = {
    start: indicator(L, ix, by + 1.7, 'START'),
    pause: indicator(L, ix + 6.8, by + 1.7, 'PAUSE'),
    hold: indicator(L, ix + 13.6, by + 1.7, 'HOLD'),
  };
  w.frame = frame(-1, 0, width + 1, by + 3.6, true);
  w.render = (s) => renderStd(w, o, s);
  return w;
}

function renderStd(w, o, s) {
  let seconds = s.seconds, color = PHASE_LED[s.digitColor] || 'dim-amber', light = s.light;
  if (o.finalsView && s.finals) {
    const side = s.finals[o.finalsView] || {};
    seconds = side.seconds; color = PHASE_LED[side.color] || 'dim-amber'; light = side.light;
  }
  if (o.area === 'stop') {
    if (!emergencyStart) emergencyStart = performance.now();
    const t = (performance.now() - emergencyStart) % 1500;
    w.area.set(t < 1150);
    light = 'red';
  } else if (o.area === 'clock') {
    const now = new Date();
    w.area.setClock(now);
    if (o.clock.mode === 'datetime') {
      const t = longDate(now);
      if (w.areaLabel.textContent !== t) w.areaLabel.textContent = t;
    }
  } else {
    const fmt = o.area;
    w.area.set(ctx.formatTime(seconds, fmt), color);
  }
  if (w.lamps) w.lamps.set(light);
  if (w.letters) w.letters.set(s);
  if (w.end) {
    const n = o.finalsView ? s.finals?.arrow : s.end?.number;
    w.end.set(n, 'amber');
    w.practice.set(s.end?.practice && !o.finalsView ? 'P' : ' ', 'amber');
  }
  w.ind.start.set(s.phase === 'countdown' ? 'blue' : 'off');
  w.ind.pause.set(s.paused ? 'amber' : 'off');
  w.ind.hold.set(s.hold ? 'amber' : 'off');
  setBanner(w, s);
}

function setBanner(w, s) {
  const b = w.frame.bannerEl;
  if (!b) return;
  const text = s.phase === 'wait' && s.display?.bannerText ? String(s.display.bannerText).toUpperCase() : '';
  if (b.textContent !== text) {
    b.textContent = text;
    // squeeze long banners to fit the bezel
    const approx = text.length * 0.62 * 1.25;
    if (approx > w.frame.maxBannerWidth) {
      b.setAttribute('textLength', w.frame.maxBannerWidth * U);
      b.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    } else b.removeAttribute('textLength');
  }
}

// Finals, both screens: two side boards that slide/zoom — the shooting side large, the
// waiting side small. Each side is a group (in every layer) moved with a CSS transform.
const SMALL = 0.58;

function moverLayers() {
  const mk = (layer) => el('g', { class: 'rl-move' }, layer);
  const sub = { under: mk(L.under), sock: mk(L.sock), lit: mk(L.lit), labels: mk(L.labels) };
  sub.groups = [sub.under, sub.sock, sub.lit, sub.labels];
  sub.tf = '';
  sub.move = (tx, ty, sc) => {
    const tf = `translate(${(tx * U).toFixed(2)}px, ${(ty * U).toFixed(2)}px) scale(${sc})`;
    if (tf === sub.tf) return;
    sub.tf = tf;
    for (const g of sub.groups) g.style.transform = tf;
  };
  return sub;
}

function buildFinals2(o) {
  const w = {};
  const y = MAIN_TOP;
  const lampW = 4 * (MAIN_SPAN / 16);
  const areaW = o.fmt === 'min' ? 30.4 : 27;
  const sideW = (o.lamps ? lampW + GAP : 0) + areaW;
  const by = MAIN_TOP + MAIN_SPAN + 2.6;
  const centreW = 11;
  const gap = 4.2;
  w.sideW = sideW; w.centreW = centreW; w.gap = gap;
  const mkSide = (name) => {
    const sub = moverLayers();
    const prev = L; L = sub;            // builders draw into L.*
    let x = 0, lamps = null;
    if (o.lamps && name === 'left') { lamps = buildLamps(sub, x, y); x += lampW + GAP; }
    const area = buildArea(sub, x, y, o.fmt);
    if (o.lamps && name === 'right') lamps = buildLamps(sub, x + areaW + GAP, y);
    const prim = indicator(sub, 0.6, by + 1.7, '');
    const primLabel = silk(sub, 1.7, by + 2.08, 'PRIMARY', 1.05, 'start');
    let target = null;
    if (o.targets) {
      silk(sub, sideW - 6.4, by + 2.08, 'TARGET', 1.05, 'end');
      target = smallNumber(sub, sideW - 5.8, by - 0.2, 0.3);
    }
    L = prev;
    return { sub, lamps, area, prim, primLabel, target };
  };
  w.left = mkSide('left');
  w.right = mkSide('right');
  // centre column: arrow number + direction arrows
  const c = moverLayers();
  const prev = L; L = c;
  silk(c, centreW / 2, 1.5, 'ARROW', 1.0);
  const ap = 0.75;
  w.arrowDigits = o.wide ? 2 : 1;
  const numW = w.arrowDigits === 2 ? 16.5 * ap : 7 * ap;
  w.arrow = smallNumber(c, (centreW - numW) / 2, y, ap, w.arrowDigits);
  const tp = 0.55;
  w.arrL = matrix(c, 0.3, y + 14 * ap + 1.2, tp);
  w.arrR = matrix(c, centreW - 0.3 - 4 * tp, y + 14 * ap + 1.2, tp);
  w.pause = indicator(c, 2.0, by + 1.7, 'PAUSE', 0.9);
  L = prev;
  w.centre = c;
  const total = (1 + SMALL) * sideW + centreW + 2 * gap;
  if (o.clock) w.clock = buildClock(L, total / 2, by + 5.0, o.clock);
  w.frame = frame(-1, 0, total + 1, by + 3.6 + (o.clock ? CLOCK_ROW : 0), true);
  w.render = (s) => renderFinals2(w, o, s);
  return w;
}

function renderFinals2(w, o, s) {
  const f = s.finals;
  const mid = MAIN_TOP + MAIN_SPAN / 2;
  const half = (1 + SMALL) / 2;
  const sl = f.active === 'left' ? 1 : f.active === 'right' ? SMALL : half;
  const sr = f.active === 'right' ? 1 : f.active === 'left' ? SMALL : half;
  const xc = sl * w.sideW + w.gap;
  w.left.sub.move(0, mid * (1 - sl), sl);
  w.centre.move(xc, 0, 1);
  w.right.sub.move(xc + w.centreW + w.gap, mid * (1 - sr), sr);
  for (const name of ['left', 'right']) {
    const side = f[name] || {};
    const sw = w[name];
    sw.area.set(ctx.formatTime(side.seconds, o.fmt), PHASE_LED[side.color] || 'dim-amber');
    if (sw.lamps) sw.lamps.set(side.light);
    const isPrim = f.primary === name;
    sw.prim.set(isPrim ? 'amber' : 'off');
    const lbl = f.primary ? (isPrim ? 'PRIMARY' : 'SECONDARY') : '';
    if (sw.primLabel.textContent !== lbl) sw.primLabel.textContent = lbl;
    if (sw.target) sw.target.set(f.targets?.[name], f.active === name ? 'green' : 'red');
  }
  w.arrow.set(f.arrow, 'amber');
  w.arrL.set('<', f.active === 'left' ? 'green' : 'off');
  w.arrR.set('>', f.active === 'right' ? 'green' : 'off');
  w.pause.set(s.paused ? 'amber' : 'off');
  if (w.clock) w.clock.set(new Date());
  setBanner(w, s);
}

function buildManual() {
  const w = {};
  const q = 2.7, span = 4 * q, gap = 5.5;
  const y = MAIN_TOP;
  const lamps = [['red', 'red', 'STOP'], ['yellow', 'orange', 'WARNING'], ['green', 'green', 'SHOOT']]
    .map(([c, light, label], i) => {
      const x = i * (span + gap);
      silk(L, x + span / 2, 1.4, label, 1.1);
      return { light, l: lamp(L, x, y, q, c) };
    });
  const width = 3 * span + 2 * gap;
  w.frame = frame(-2, 0, width + 2, y + span + 2.5, true);
  w.render = (s) => { lamps.forEach(({ light, l }) => l.set(s.light === light)); setBanner(w, s); };
  return w;
}

function rebuild(o) {
  clearBoard();
  if (o.mode === 'manual') widgets = buildManual();
  else if (o.mode === 'finals2') widgets = buildFinals2(o);
  else widgets = buildStd(o);
}

export default {
  mount(r, c) {
    root = r; ctx = c;
    svg = el('svg', { class: 'rl-svg', preserveAspectRatio: 'xMidYMid meet', viewBox: '0 0 100 60' });
    buildDefs(svg);
    root.appendChild(svg);
    key = '';
  },
  render(s) {
    if (!svg || !s) return;
    const o = layoutOptions(s);
    const k = JSON.stringify(o);
    if (k !== key) { key = k; rebuild(o); }
    if (!isEmergency(s)) emergencyStart = 0;
    widgets.render(s);
  },
  unmount() {
    if (svg) svg.remove();
    svg = board = L = widgets = null; root = null; key = '';
  },
};
