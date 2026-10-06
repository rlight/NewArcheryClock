'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, EMERGENCY_MS } = require('../server/engine');
const cfg = require('../server/config');

// A tiny harness: a fake clock, collected signals, and helpers to advance time.
function setup(roundPatch = {}, settingsPatch = {}) {
  const s = cfg.validate(cfg.deepMerge(cfg.clone(cfg.DEFAULTS), { ...settingsPatch, round: cfg.deepMerge(cfg.clone(cfg.DEFAULT_ROUND), roundPatch) }));
  let now = 1_000_000;
  const signals = [];
  const e = new Engine(s, now, { onSignal: (c) => signals.push(c) });
  const h = {
    e, signals,
    get now() { return now; },
    advance(ms) { // step in 50 ms ticks like the server
      const end = now + ms;
      while (now < end) { now = Math.min(end, now + 50); e.tick(now); }
    },
    cmd(c, arg) { e.command(c, arg, now); },
    snap() { return e.snapshot(now); },
    clearGuard() { h.advance(2100); },
  };
  return h;
}

test('AB-CD end: red 10 → green 120 (yellow at 30) → CD → wait, with 2/1/2/1/3 signals', () => {
  const h = setup();
  assert.equal(h.snap().phase, 'wait');
  assert.equal(h.snap().end.practice, true);
  h.cmd('next');
  let s = h.snap();
  assert.equal(s.phase, 'red'); assert.equal(s.seconds, 10);
  assert.deepEqual(h.signals, [2]);
  h.advance(9_999);
  assert.equal(h.snap().seconds, 1);
  h.advance(1);
  s = h.snap();
  assert.equal(s.phase, 'green'); assert.equal(s.seconds, 120);
  assert.deepEqual(h.signals, [2, 1]);
  h.advance(89_100);
  assert.equal(h.snap().phase, 'green'); assert.equal(h.snap().seconds, 31);
  h.advance(1_000);
  assert.equal(h.snap().phase, 'orange'); assert.equal(h.snap().seconds, 30);
  assert.equal(h.snap().digitColor, 'orange');
  h.advance(30_000);
  s = h.snap();
  assert.equal(s.phase, 'red'); assert.equal(s.turn.number, 2);
  assert.deepEqual(s.details.slots.filter((x) => x.active).map((x) => x.letter), ['C', 'D']);
  assert.deepEqual(h.signals, [2, 1, 2]);
  h.advance(130_000);
  s = h.snap();
  assert.equal(s.phase, 'wait');
  assert.deepEqual(h.signals, [2, 1, 2, 1, 3]);
  assert.equal(s.end.number, 2); assert.equal(s.end.practice, true); // second practice end
});

test('practice ends finish, then rotation alternates AB-CD / CD-AB', () => {
  const h = setup({ fita: { practiceEnds: 1, red: 0, green: 1, orange: 0 } });
  const runEnd = () => { h.clearGuard(); h.cmd('next'); h.advance(5_000); };
  assert.equal(h.snap().end.practice, true);
  runEnd();
  let s = h.snap();
  assert.equal(s.end.practice, false); assert.equal(s.end.number, 1);
  assert.deepEqual(s.details.slots.map((x) => x.letter), ['A', 'B', 'C', 'D']);
  runEnd();
  s = h.snap();
  assert.equal(s.end.number, 2);
  assert.deepEqual(s.details.slots.map((x) => x.letter), ['C', 'D', 'A', 'B']);
  assert.equal(s.details.next, 'CD');
  runEnd();
  assert.deepEqual(h.snap().details.slots.map((x) => x.letter), ['A', 'B', 'C', 'D']);
});

test('start every end with AB disables rotation', () => {
  const h = setup({ fita: { practiceEnds: 0, startEveryEndWithAB: true, red: 0, green: 1, orange: 0 } });
  h.cmd('next'); h.advance(5_000); h.clearGuard();
  assert.equal(h.snap().end.number, 2);
  assert.equal(h.snap().details.next, 'AB');
});

test('A-B-C-D rotates right by one detail each end', () => {
  const h = setup({ fita: { layout: 'A-B-C-D', practiceEnds: 0 } });
  h.cmd('endUp');
  assert.deepEqual(h.snap().details.slots.map((x) => x.letter), ['D', 'A', 'B', 'C']);
  h.cmd('endUp');
  assert.deepEqual(h.snap().details.slots.map((x) => x.letter), ['C', 'D', 'A', 'B']);
});

test('pause keeps the exact remaining time; Next resumes after the guard', () => {
  const h = setup({ fita: { practiceEnds: 0 } });
  h.cmd('next'); h.advance(10_000); h.advance(12_300);
  const before = h.snap().remainingMs;
  h.cmd('pause');
  assert.equal(h.snap().paused, true);
  h.advance(60_000);
  assert.equal(h.snap().remainingMs, before);
  h.cmd('next');
  assert.equal(h.snap().paused, false);
  h.advance(1_000);
  assert.equal(h.snap().remainingMs, before - 1_000);
});

test('double-press guard blocks Next for 2 s after stop', () => {
  const h = setup({ fita: { practiceEnds: 0 } });
  h.cmd('next'); h.advance(3_000);
  h.cmd('stop');
  assert.equal(h.snap().phase, 'wait');
  assert.deepEqual(h.signals, [2, 3]);
  h.cmd('next');
  assert.equal(h.snap().phase, 'wait');
  h.clearGuard(); h.cmd('next');
  assert.equal(h.snap().phase, 'red');
  assert.equal(h.snap().turn.number, 1); // stop never advances
});

test('Next during green finishes the detail early', () => {
  const h = setup({ fita: { practiceEnds: 0 } });
  h.cmd('next'); h.advance(15_000);
  h.cmd('next');
  assert.equal(h.snap().phase, 'red'); assert.equal(h.snap().turn.number, 2);
});

test('emergency: 4 signals, STOP, then wait; finalizes the end on the last detail', () => {
  const h = setup({ fita: { practiceEnds: 0 } });
  h.cmd('next'); h.advance(10_000); h.cmd('next'); h.advance(12_000); // CD shooting
  assert.equal(h.snap().turn.number, 2); assert.equal(h.snap().phase, 'green');
  h.cmd('emergency');
  assert.equal(h.snap().phase, 'emergency'); assert.equal(h.snap().emergency, true);
  assert.equal(h.signals.at(-1), 4);
  h.advance(EMERGENCY_MS + 100);
  const s = h.snap();
  assert.equal(s.phase, 'wait'); assert.equal(s.end.number, 2); assert.equal(s.turn.number, 1);
});

test('shoot-off: N × (green+orange), does not advance counters', () => {
  const h = setup({ fita: { practiceEnds: 0 } });
  h.cmd('shootoff', 3);
  let s = h.snap();
  assert.equal(s.phase, 'red'); assert.equal(s.seconds, 10); assert.equal(s.details.kind, 'none');
  h.advance(10_000);
  s = h.snap();
  assert.equal(s.seconds, 120); assert.equal(s.phase, 'green');
  h.advance(90_000);
  assert.equal(h.snap().phase, 'orange'); // orange at 3 × 10 = 30
  h.advance(30_000);
  s = h.snap();
  assert.equal(s.phase, 'wait'); assert.equal(s.end.number, 1); assert.equal(s.turn.number, 1); assert.equal(s.shootoff, null);
  assert.equal(h.signals.at(-1), 3);
});

test('double turns: AB-CD-AB-CD, half ends counted, carries on automatically', () => {
  const h = setup({ fita: { practiceEnds: 0, doubleEnds: true, doubleMode: 'turns', red: 0, green: 2, orange: 0 } });
  h.cmd('next');
  h.advance(4_100); // AB, CD of half end 1 → half end 2 starts automatically
  let s = h.snap();
  assert.equal(s.end.number, 2); assert.notEqual(s.phase, 'wait');
  h.advance(4_100);
  s = h.snap();
  assert.equal(s.phase, 'wait'); assert.equal(s.end.number, 3);
  assert.deepEqual(s.details.slots.map((x) => x.letter), ['C', 'D', 'A', 'B']);
});

test('double time can count as one end when the option is off', () => {
  const h = setup({ fita: { practiceEnds: 0, doubleEnds: true, doubleMode: 'time', countDoubleAsTwo: false } });
  h.cmd('next'); h.advance(10_000 + 240_000 + 10_000 + 240_000 + 100);
  assert.equal(h.snap().end.number, 2);
});

test('double time counted as two ends: 1, 3, 5 (original behaviour, optional)', () => {
  const h = setup({ fita: { practiceEnds: 0, doubleEnds: true, doubleMode: 'time', countDoubleAsTwo: true } });
  h.cmd('next'); h.advance(10_000);
  assert.equal(h.snap().seconds, 240);
  h.advance(210_000);
  assert.equal(h.snap().phase, 'orange');
  h.advance(30_000 + 10_000 + 240_000 + 100);
  assert.equal(h.snap().phase, 'wait');
  assert.equal(h.snap().end.number, 3);
});

test('hold values: red -1 waits for Next; orange -1 holds at 0', () => {
  const h = setup({ fita: { practiceEnds: 0, red: -1, green: 2, orange: -1 } });
  h.cmd('next');
  let s = h.snap();
  assert.equal(s.phase, 'red'); assert.equal(s.hold, true); assert.equal(s.seconds, 0);
  h.advance(60_000);
  assert.equal(h.snap().phase, 'red');
  h.cmd('next');
  assert.equal(h.snap().phase, 'green');
  h.advance(2_000);
  s = h.snap();
  assert.equal(s.phase, 'orange'); assert.equal(s.hold, true);
  h.clearGuard(); h.cmd('next');
  assert.equal(h.snap().turn.number, 2);
});

test('match countdown is silent, blue, then starts the end with 2 signals', () => {
  const h = setup({ fita: { practiceEnds: 0 } }, { start: { countdownMinutes: 1 } });
  h.cmd('countdown');
  let s = h.snap();
  assert.equal(s.phase, 'countdown'); assert.equal(s.digitColor, 'blue'); assert.equal(s.seconds, 60);
  assert.deepEqual(h.signals, []);
  h.advance(60_000);
  s = h.snap();
  assert.equal(s.phase, 'red'); assert.deepEqual(h.signals, [2]);
});

test('25m1P: archer numbers rotate when not always starting with archer 1', () => {
  const h = setup({ system: '25m1p', oneArrow: { archers: 4, practiceArrows: 0, alwaysStartWithArcher1: false, red: 1, green: 1, orange: 0 } });
  let s = h.snap();
  assert.equal(s.details.kind, 'archer'); assert.equal(s.details.archer, 1); assert.equal(s.end.label, 'Arrow');
  h.cmd('next'); h.advance(8_100);
  s = h.snap();
  assert.equal(s.phase, 'wait'); assert.equal(s.end.number, 2); assert.equal(s.details.archer, 2);
});

test('Top-Bottom shows T/op then B/ottom', () => {
  const h = setup({ fita: { layout: 'TOP-BOTTOM', practiceEnds: 0, red: 0, green: 1, orange: 0 } });
  assert.deepEqual(h.snap().details.topbottom, { big: 'T', small: 'op' });
  h.cmd('next'); h.advance(1_000);
  assert.deepEqual(h.snap().details.topbottom, { big: 'B', small: 'ottom' });
});

test('individual final: choose side, red, alternate 20 s per arrow, end after secondary arrow 3', () => {
  const h = setup({ system: 'finals', finals: { mode: 'perArrow', perArrow: { turns: 3, red: 10, green: 20, orange: 0 } } });
  h.cmd('next');
  assert.equal(h.snap().phase, 'wait'); // must choose a side first
  h.cmd('finalsSide', 'left');
  h.cmd('next');
  let s = h.snap();
  assert.equal(s.phase, 'red'); assert.equal(s.finals.active, 'left');
  h.advance(10_000);
  s = h.snap();
  assert.equal(s.phase, 'green'); assert.equal(s.finals.left.seconds, 20); assert.equal(s.finals.left.color, 'green'); assert.equal(s.finals.right.color, 'red');
  h.advance(5_000); h.cmd('next'); // left shot early
  s = h.snap();
  assert.equal(s.finals.active, 'right'); assert.equal(s.finals.right.seconds, 20); assert.equal(s.finals.arrow, 1);
  h.advance(20_000); // right times out → back to left, arrow 2
  s = h.snap();
  assert.equal(s.finals.active, 'left'); assert.equal(s.finals.arrow, 2);
  h.advance(20_000 * 4); // L2 R2 L3 R3
  s = h.snap();
  assert.equal(s.phase, 'wait'); assert.equal(s.finals.chosen, null); assert.equal(s.finals.arrow, 1);
  assert.equal(h.signals.at(-1), 3);
});

test('team final: unused time is kept per side', () => {
  const h = setup({ system: 'finals', finals: { mode: 'perEnd', perEnd: { turns: 2, red: 0, green: 120, orange: 0 } } });
  h.cmd('finalsSide', 'right'); h.cmd('next');
  h.advance(30_000); h.clearGuard();
  h.cmd('next'); // right used ~32 s
  let s = h.snap();
  assert.equal(s.finals.active, 'left');
  h.advance(10_000); h.cmd('next');
  s = h.snap();
  assert.equal(s.finals.active, 'right');
  assert.ok(s.finals.right.seconds <= 88 && s.finals.right.seconds >= 86, 'right kept its budget: ' + s.finals.right.seconds);
});

test('manual mode: lights with configured signals, no digits', () => {
  const h = setup({ system: 'manual' });
  h.cmd('manualLight', 'green');
  let s = h.snap();
  assert.equal(s.light, 'green'); assert.equal(s.seconds, null);
  assert.deepEqual(h.signals, [1]);
  h.cmd('manualLight', 'red');
  assert.deepEqual(h.signals, [1, 2]);
  h.cmd('manualSignal', 3);
  assert.deepEqual(h.signals, [1, 2, 3]);
  h.cmd('next'); assert.equal(h.snap().phase, 'wait');
});

test('end navigation crosses the practice boundary', () => {
  const h = setup({ fita: { practiceEnds: 2 } });
  h.cmd('endUp'); assert.equal(h.snap().end.number, 2);
  h.cmd('endUp'); assert.deepEqual([h.snap().end.number, h.snap().end.practice], [1, false]);
  h.cmd('endDown'); assert.deepEqual([h.snap().end.number, h.snap().end.practice], [2, true]);
  h.cmd('resetEnd'); assert.deepEqual([h.snap().end.number, h.snap().end.practice], [1, true]);
});

test('settings validation clamps and rejects junk', () => {
  const s = cfg.validate({ round: { fita: { red: 999, green: -5, layout: 'XYZ' } }, display: { theme: '../../etc' } });
  assert.equal(s.round.fita.red, 150); assert.equal(s.round.fita.green, -1); assert.equal(s.round.fita.layout, 'AB-CD');
  assert.equal(s.display.theme, 'classic');
});

test('F1-F4 default rounds: single / AB-CD at 120 s, NFAA 5-arrow single / AB-CD at 240 s', () => {
  const r = (slot) => cfg.readScenario(slot).round.fita;
  assert.deepEqual([r('F1').layout, r('F1').green + r('F1').orange, r('F1').doubleEnds], ['A', 120, false]);
  assert.deepEqual([r('F2').layout, r('F2').green + r('F2').orange, r('F2').doubleEnds], ['AB-CD', 120, false]);
  assert.deepEqual([r('F3').layout, r('F3').green, r('F3').orange, r('F3').doubleEnds], ['A', 210, 30, false]);
  assert.deepEqual([r('F4').layout, r('F4').green, r('F4').orange, r('F4').doubleEnds], ['AB-CD', 210, 30, false]);
  assert.equal(cfg.readScenario('F4').builtIn, true);
  const h = setup(cfg.readScenario('F4').round);
  h.cmd('endUp'); h.cmd('endUp'); // past practice
  h.cmd('next'); h.advance(10_000);
  assert.equal(h.snap().seconds, 240);
  h.advance(210_000);
  assert.equal(h.snap().phase, 'orange');
  h.advance(30_000);
  assert.equal(h.snap().turn.number, 2); // then CD
  h.advance(250_100);
  assert.equal(h.snap().end.number, 2); // one end per AB + CD
});
