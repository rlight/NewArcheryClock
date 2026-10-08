'use strict';
// The clock state machine. Pure logic: the caller passes monotonic time (ms) into every call,
// so the whole thing can be unit-tested without real timers. See docs/original-spec.md for
// the behaviour being reproduced and docs/architecture.md for the snapshot contract.

const GUARD_MS = 2000;            // anti double-press window after pause/stop/end/finals switch
const SIGNAL_SPACING_MS = 1500;   // matches the display's signal spacing
const EMERGENCY_MS = 3 * SIGNAL_SPACING_MS + 750; // 4 signals, then back to WAIT

const LAYOUTS = {
  'A':           { groups: [['A']] },
  'A-B':         { groups: [['A'], ['B']] },
  'A-B-C':       { groups: [['A'], ['B'], ['C']] },
  'A-B-C-D':     { groups: [['A'], ['B'], ['C'], ['D']] },
  'AB-CD':       { groups: [['A', 'B'], ['C', 'D']] },
  'A-B-C-D-E':   { groups: [['A'], ['B'], ['C'], ['D'], ['E']] },
  'A-B-C-D-E-F': { groups: [['A'], ['B'], ['C'], ['D'], ['E'], ['F']] },
  'AB-CD-EF':    { groups: [['A', 'B'], ['C', 'D'], ['E', 'F']] },
  'ABC-DEF':     { groups: [['A', 'B', 'C'], ['D', 'E', 'F']] },
  'TOP-BOTTOM':  { groups: [['T'], ['B']], topBottom: true },
};

const hold = (v) => v === -1;
const sec = (v) => (v > 0 ? v : 0);

class Engine {
  constructor(settings, now, hooks = {}) {
    this.onSignal = hooks.onSignal || (() => {});
    this.onChange = hooks.onChange || (() => {});
    this.settings = settings;
    this.version = 0;
    this.reset(now);
  }

  // ---------------------------------------------------------------- setup

  setSettings(settings, now, { resetRound = false } = {}) {
    this.settings = settings;
    if (resetRound) this.reset(now);
    else this.changed();
  }

  reset(now) {
    this.phase = 'wait';
    this.paused = false;
    this.hold = false;
    this.deadline = null;
    this.remainingMs = 0;       // used while paused / holding / waiting
    this.phaseTotalMs = 0;
    this.shootoff = null;
    this.guardUntil = 0;
    this.emergencyUntil = 0;
    this.afterEmergency = null;
    this.countdownActive = false;
    this.end = 1;
    this.turn = 1;
    this.practice = this.practiceCount() > 0;
    this.manualLight = 'red';
    this.finals = {
      chosen: null, active: null, primary: null, arrow: 1,
      left: { remainingMs: 0 }, right: { remainingMs: 0 }, exhausted: false,
    };
    this.lastNow = now;
    this.changed();
  }

  changed() { this.version++; this.onChange(); }
  signal(count) { if (count > 0) this.onSignal(count); }

  get round() { return this.settings.round; }
  get system() { return this.round.system; }

  // ---------------------------------------------------------------- round geometry

  layout() {
    if (this.system === '25m1p') {
      const n = this.round.oneArrow.archers;
      return { groups: Array.from({ length: n }, (_, i) => [String(i + 1)]), archerMode: true };
    }
    return LAYOUTS[this.round.fita.layout] || LAYOUTS['AB-CD'];
  }
  turnsPerEnd() { return this.layout().groups.length; }
  archersPerTurn() { return this.layout().groups[0].length; }

  doubleEnds() { return this.system === 'fita' && this.round.fita.doubleEnds; }
  doubleTime() { return this.doubleEnds() && this.round.fita.doubleMode === 'time'; }
  doubleTurns() { return this.doubleEnds() && this.round.fita.doubleMode === 'turns'; }
  // a double-time end counts as one end, unless set to count as two (original WA 2 x 3-arrow habit: 1, 3, 5 ...)
  endStep() { return this.doubleTime() && this.round.fita.countDoubleAsTwo ? 2 : 1; }
  passesPerEnd() { return this.doubleEnds() ? 2 : 1; } // "nrofturns" in the original

  practiceCount() {
    if (this.system === 'fita') return this.round.fita.practiceEnds;
    if (this.system === '25m1p') return this.round.oneArrow.practiceArrows;
    return 0;
  }
  lastPracticeEnd() { return Math.max(1, this.practiceCount() - this.endStep() + 1); }

  rotation() {
    if (this.system !== 'fita' || this.practice || this.round.fita.startEveryEndWithAB) return 0;
    const e = Math.ceil(this.end / this.passesPerEnd());
    return (e - 1) % this.turnsPerEnd();
  }

  // groups in shooting order for the current end
  orderedGroups() {
    const g = this.layout().groups;
    const r = this.rotation();
    return g.map((_, i) => g[(i - r + g.length) % g.length]);
  }

  groupLabel(turn) {
    const groups = this.orderedGroups();
    const grp = groups[turn - 1];
    return grp ? grp.join('') : null;
  }

  archerNumber(turn = this.turn) {
    const n = this.round.oneArrow.archers;
    if (this.round.oneArrow.alwaysStartWithArcher1 || this.practice) return turn;
    return ((turn + ((this.end - 1) % n) - 1) % n) + 1;
  }

  // ---------------------------------------------------------------- timings

  times() {
    const s = this.round;
    if (this.shootoff && this.system === 'fita') {
      const so = s.fita.shootoff, n = this.shootoff;
      return { red: so.red, shoot: n * (sec(so.green) + sec(so.orange)) * 1000, orange: n * sec(so.orange), greenHold: false, orangeHold: false };
    }
    if (this.system === '25m1p') {
      const o = s.oneArrow;
      return { red: o.red, shoot: (sec(o.green) + sec(o.orange)) * 1000, orange: sec(o.orange), greenHold: false, orangeHold: false };
    }
    const f = s.fita, mult = this.doubleTime() ? 2 : 1;
    return {
      red: f.red,
      shoot: mult * (sec(f.green) + sec(f.orange)) * 1000,
      orange: sec(f.orange),
      greenHold: hold(f.green), orangeHold: hold(f.orange),
    };
  }

  finalsTimes() {
    const f = this.round.finals;
    const t = f.mode === 'perEnd' ? f.perEnd : f.perArrow;
    return { red: sec(t.red), full: (sec(t.green) + sec(t.orange)) * 1000, orange: sec(t.orange), turns: t.turns };
  }

  // ---------------------------------------------------------------- phase helpers

  running() { return this.deadline !== null && !this.paused; }
  timedPhase() { return ['red', 'green', 'orange', 'countdown'].includes(this.phase); }
  guarded(now) { return now < this.guardUntil; }
  arm(now) { this.guardUntil = now + GUARD_MS; }

  remaining(now) {
    if (this.deadline !== null && !this.paused) return Math.max(0, this.deadline - now);
    return this.remainingMs;
  }

  startTimed(phase, ms, now, at = now) {
    this.phase = phase;
    this.hold = false;
    this.paused = false;
    this.phaseTotalMs = ms;
    this.deadline = at + ms;
    this.remainingMs = ms;
    if (this.deadline <= now) this.deadline = now; // catch-up guard
  }

  startHold(phase, shownMs) {
    this.phase = phase;
    this.hold = true;
    this.paused = false;
    this.deadline = null;
    this.remainingMs = shownMs;
    this.phaseTotalMs = shownMs;
  }

  toWait() {
    this.phase = 'wait';
    this.hold = false;
    this.paused = false;
    this.deadline = null;
    this.remainingMs = 0;
    this.phaseTotalMs = 0;
  }

  // ---------------------------------------------------------------- tick

  tick(now) {
    this.lastNow = now;
    let guard = 0;
    while (guard++ < 50) {
      if (this.phase === 'emergency') {
        if (now >= this.emergencyUntil) { this.finishEmergency(now); continue; }
        return;
      }
      if (this.system === 'finals') { if (!this.tickFinals(now)) return; continue; }
      if (!this.running()) return;
      const at = this.deadline;
      if (this.phase === 'green' && this.times().orange > 0 && Math.ceil((at - now) / 1000) <= this.times().orange) {
        this.phase = 'orange'; this.changed(); continue;
      }
      if (now < at) return;
      this.expire(now, at);
    }
  }

  expire(now, at) {
    switch (this.phase) {
      case 'countdown': this.countdownActive = false; this.startRed(now, at); this.signal(2); break;
      case 'red': this.startShooting(now, at); this.signal(1); break;
      case 'green':
      case 'orange':
        if (this.phase === 'green' && this.times().orangeHold) { this.startHold('orange', 0); this.changed(); break; }
        this.finishTurn(now, at);
        break;
      default: this.deadline = null;
    }
  }

  startRed(now, at = now) {
    const t = this.times();
    if (hold(t.red)) { this.startHold('red', 0); this.changed(); return; }
    this.startTimed('red', sec(t.red) * 1000, now, at);
    if (t.red <= 0) { this.startShooting(now, at); return; }
    this.changed();
  }

  startShooting(now, at = now) {
    const t = this.times();
    if (t.greenHold) { this.startHold('green', t.orange * 1000); this.changed(); return; }
    if (t.shoot <= 0) { this.startTimed('orange', 0, now, at); this.finishTurn(now, at); return; }
    this.startTimed('green', t.shoot, now, at);
    if (t.orange > 0 && Math.ceil(t.shoot / 1000) <= t.orange) this.phase = 'orange';
    this.changed();
  }

  // End of one detail's shooting (time-out or Next).
  finishTurn(now, at = now) {
    if (this.shootoff) {
      this.shootoff = null;
      this.toWait(); this.arm(now); this.signal(3); this.changed();
      return;
    }
    if (this.turn < this.turnsPerEnd()) {
      this.turn++;
      this.startRed(now, at); this.signal(2);
      return;
    }
    // last detail of the end
    if (this.doubleTurns() && this.end % 2 === 1) {
      // first pass of AB-CD-AB-CD: count the half end and carry straight on
      this.end++; this.turn = 1;
      this.startRed(now, at); this.signal(2);
      return;
    }
    this.advanceEnd();
    this.turn = 1;
    this.toWait(); this.arm(now); this.signal(3);
    if (this.system === 'fita' && this.settings.start.countdownBetweenEnds) this.startCountdown(now, true);
    this.changed();
  }

  advanceEnd() {
    if (this.practice && this.end >= this.lastPracticeEnd()) { this.practice = false; this.end = 1; return; }
    this.end += this.endStep();
  }

  // ---------------------------------------------------------------- commands

  command(cmd, arg, now) {
    this.tick(now);
    const fn = this['cmd_' + cmd];
    if (!fn) throw new Error('unknown command: ' + cmd);
    const r = fn.call(this, arg, now);
    this.tick(now);
    return r;
  }

  cmd_next(_, now) {
    if (this.phase === 'emergency') return;
    if (this.system === 'manual') return;
    if (this.system === 'finals') return this.finalsNext(now);
    if (this.guarded(now)) return;
    if (this.paused) return this.resume(now);
    switch (this.phase) {
      case 'wait': this.startRed(now); this.signal(2); return;
      case 'countdown': this.countdownActive = false; this.startRed(now); this.signal(2); return;
      case 'red':
        if (this.hold) { this.startShooting(now); this.signal(1); }
        return;
      case 'green':
        if (this.hold) { // green hold → count down the orange time
          const t = this.times();
          if (t.orangeHold) { this.startHold('orange', 0); this.changed(); return; }
          this.startTimed('orange', t.orange * 1000, now);
          if (t.orange <= 0) this.finishTurn(now);
          else this.changed();
          return;
        }
        this.finishTurn(now); return;
      case 'orange': this.finishTurn(now); return;
    }
  }

  cmd_pause(_, now) {
    if (this.phase === 'emergency' || this.system === 'manual') return;
    if (this.system === 'finals') {
      if (!['red', 'green', 'orange'].includes(this.phase)) return;
    } else if (!this.timedPhase() || this.hold) return;
    if (this.paused) return this.resume(now);
    if (this.system === 'finals') {
      const side = this.finals[this.finals.active] || {};
      side.remainingMs = this.remaining(now);
    }
    this.remainingMs = this.remaining(now);
    this.paused = true;
    this.arm(now);
    this.changed();
  }

  resume(now) {
    this.paused = false;
    this.deadline = now + this.remainingMs;
    this.arm(now);
    this.changed();
  }

  cmd_stop(_, now) {
    if (this.phase === 'emergency' || this.system === 'manual') return;
    if (this.guarded(now) && this.phase !== 'wait') return;
    if (this.phase === 'countdown') { this.countdownActive = false; this.toWait(); this.changed(); return; }
    if (this.system === 'finals') { this.finalsReset(); this.toWait(); this.arm(now); this.signal(3); this.changed(); return; }
    this.shootoff = null;
    this.toWait(); this.arm(now); this.signal(3); this.changed();
  }

  cmd_emergency(_, now) {
    if (this.phase === 'emergency') return;
    let finalize = false;
    if (this.system !== 'finals' && this.system !== 'manual' && ['green', 'orange'].includes(this.phase)
        && !this.shootoff && this.turn >= this.turnsPerEnd() && !(this.doubleTurns() && this.end % 2 === 1)) {
      finalize = true;
    }
    this.afterEmergency = { finalize };
    this.phase = 'emergency';
    this.paused = false; this.hold = false; this.deadline = null; this.remainingMs = 0;
    this.emergencyUntil = now + EMERGENCY_MS;
    this.countdownActive = false;
    if (this.system === 'manual') this.manualLight = 'red';
    this.signal(4);
    this.changed();
  }

  finishEmergency(now) {
    const a = this.afterEmergency || {};
    this.afterEmergency = null;
    this.shootoff = null;
    if (this.system === 'finals') this.finalsReset();
    if (a.finalize) { this.advanceEnd(); this.turn = 1; }
    this.toWait(); this.arm(now); this.changed();
  }

  cmd_shootoff(n, now) {
    if (this.system === 'manual') return this.cmd_manualSignal(Math.min(3, Number(n) || 1));   // keys 1-3 in manual mode
    if (!['fita', '25m1p'].includes(this.system)) return;
    n = Math.max(1, Math.min(6, Number(n) || 1));
    if (this.phase === 'emergency') return;
    if (this.paused) { this.shootoff = n; return this.resume(now); }   // original quirk
    if (this.phase !== 'wait' || this.guarded(now)) return;
    this.shootoff = n;
    this.startRed(now); this.signal(2);
  }

  cmd_countdown(_, now) { this.startCountdown(now, false); }

  startCountdown(now, auto) {
    if (!['fita', '25m1p'].includes(this.system)) return;
    if (this.phase !== 'wait') return;
    if (!auto && this.guarded(now)) return;
    const ms = this.settings.start.countdownMinutes * 60000;
    if (ms <= 0) return;
    this.countdownActive = true;
    this.startTimed('countdown', ms, now);
    this.changed();
  }

  // navigation: counters only, never touches a running timer
  cmd_endUp() {
    if (this.system === 'finals') { const t = this.finalsTimes().turns; this.finals.arrow = Math.min(t, this.finals.arrow + 1); return this.changed(); }
    if (this.system === 'manual') return;
    if (this.practice && this.end + this.endStep() > this.lastPracticeEnd()) { this.practice = false; this.end = 1; }
    else this.end += this.endStep();
    this.changed();
  }
  cmd_endDown() {
    if (this.system === 'finals') { this.finals.arrow = Math.max(1, this.finals.arrow - 1); return this.changed(); }
    if (this.system === 'manual') return;
    if (!this.practice && this.end - this.endStep() < 1) {
      if (this.practiceCount() > 0) { this.practice = true; this.end = this.lastPracticeEnd(); }
    } else this.end = Math.max(1, this.end - this.endStep());
    this.changed();
  }
  cmd_turnUp(_, now) {
    if (this.system === 'finals') return this.cmd_finalsSide('right', now);
    if (this.system === 'manual') return;
    if (this.turn < this.turnsPerEnd()) { this.turn++; return this.changed(); }
    this.turn = 1; this.cmd_endUp();
  }
  cmd_turnDown(_, now) {
    if (this.system === 'finals') return this.cmd_finalsSide('left', now);
    if (this.system === 'manual') return;
    if (this.turn > 1) { this.turn--; return this.changed(); }
    const before = [this.end, this.practice];
    this.cmd_endDown();
    if (this.end !== before[0] || this.practice !== before[1]) this.turn = this.turnsPerEnd();
    this.changed();
  }
  cmd_resetEnd() {
    if (this.system === 'manual') return;
    if (this.system === 'finals') { this.finals.arrow = 1; return this.changed(); }
    this.end = 1; this.turn = 1; this.practice = this.practiceCount() > 0;
    this.changed();
  }
  cmd_selectSlot(n) {
    if (!['fita', '25m1p'].includes(this.system)) return;
    n = Number(n);
    const t = Math.ceil(n / this.archersPerTurn());
    if (t >= 1 && t <= this.turnsPerEnd()) { this.turn = t; this.changed(); }
  }

  // keys with mode-dependent meaning, so every client maps them the same way
  cmd_pageUp(_, now) {
    if (this.system === 'finals') {
      if (!this.finals.chosen) return this.cmd_finalsSide('left', now);
      if (this.phase === 'wait') return this.cmd_finalsClear(null, now);
      return;
    }
    return this.cmd_emergency(null, now);
  }
  cmd_pageDown(_, now) {
    if (this.system === 'finals' && !this.finals.chosen) return this.cmd_finalsSide('right', now);
    return this.cmd_next(null, now);
  }

  // manual mode
  cmd_manualLight(color) {
    if (this.system !== 'manual' || this.phase === 'emergency') return;
    if (!['red', 'orange', 'green'].includes(color)) return;
    this.manualLight = color;
    const m = this.round.manual;
    this.signal({ red: m.redSignals, orange: m.orangeSignals, green: m.greenSignals }[color]);
    this.changed();
  }
  cmd_manualSignal(n) {
    if (this.system !== 'manual') return;
    this.signal(Math.max(1, Math.min(3, Number(n) || 1)));
  }

  // ---------------------------------------------------------------- finals (alternating)

  finalsReset() {
    const f = this.finals;
    f.chosen = null; f.active = null; f.primary = null; f.exhausted = false;
    f.left.remainingMs = 0; f.right.remainingMs = 0;
  }
  other(side) { return side === 'left' ? 'right' : 'left'; }

  cmd_finalsSide(side, now) {
    if (this.system !== 'finals' || !['left', 'right'].includes(side) || this.phase === 'emergency') return;
    const f = this.finals, full = this.finalsTimes().full;
    if (this.phase === 'wait') {
      f.chosen = side; f.active = side; f.primary = side;
      f.left.remainingMs = full; f.right.remainingMs = full;
      return this.changed();
    }
    // correcting the side while running: that side becomes active + primary, timers swap
    if (f.active !== side) {
      const a = this.finalsActiveRemaining(now);
      const b = f[side].remainingMs;
      f[f.active].remainingMs = b;
      f[side].remainingMs = a;
      f.active = side;
      if (this.deadline !== null && !this.paused && this.phase !== 'red') this.deadline = now + a;
      else if (this.paused) this.remainingMs = a;
    }
    f.primary = side; f.chosen = side;
    this.changed();
  }
  cmd_finalsClear() {
    if (this.system !== 'finals' || this.phase !== 'wait') return;
    this.finalsReset(); this.changed();
  }
  cmd_finalsSwap() {
    const f = this.finals;
    if (this.system !== 'finals' || this.phase !== 'wait' || !f.chosen) return;
    const s = this.other(f.primary);
    f.chosen = s; f.active = s; f.primary = s;
    this.changed();
  }

  finalsActiveRemaining(now) {
    if (this.phase === 'red') return this.finals[this.finals.active].remainingMs;
    return this.remaining(now);
  }

  finalsNext(now) {
    const f = this.finals;
    if (this.phase === 'emergency') return;
    if (this.guarded(now)) return;
    if (this.paused) return this.resume(now);
    if (this.phase === 'wait') {
      if (!f.chosen) return;
      const t = this.finalsTimes();
      f.left.remainingMs = t.full; f.right.remainingMs = t.full;
      f.active = f.primary;
      this.startTimed('red', t.red * 1000, now);
      if (t.red <= 0) { this.finalsStartGreen(now, now); this.signal(1); return; }
      this.signal(2); this.changed();
      return;
    }
    if (this.phase === 'red') return;
    this.finalsSwitch(now, now);
  }

  finalsStartGreen(now, at) {
    const f = this.finals, t = this.finalsTimes();
    const rem = f[f.active].remainingMs;
    f.exhausted = rem <= 0;
    // an exhausted team budget still occupies one second before switching on
    this.startTimed('green', f.exhausted ? 1000 : rem, now, at);
    if (f.exhausted || (t.orange > 0 && Math.ceil(rem / 1000) <= t.orange)) this.phase = 'orange';
    this.changed();
  }

  finalsSwitch(now, at) {
    const f = this.finals, t = this.finalsTimes();
    const finished = f.active;
    const left = f.exhausted ? 0 : Math.max(0, this.deadline !== null ? this.deadline - at : this.remainingMs);
    const isSecondary = finished !== f.primary;
    const lastArrow = f.arrow >= t.turns;
    if (lastArrow && isSecondary) {
      // the secondary side has shot its last arrow: end complete
      this.finalsReset(); f.arrow = 1;
      this.toWait(); this.arm(now); this.signal(3); this.changed();
      return;
    }
    const perEnd = this.round.finals.mode === 'perEnd';
    // team: keep the unused budget; individual: reset to a full arrow, or 0 after its last arrow
    if (perEnd) f[finished].remainingMs = left < 1000 ? 0 : left;
    else f[finished].remainingMs = lastArrow ? 0 : t.full;
    const next = this.other(finished);
    if (next === f.primary && f.arrow < t.turns) f.arrow++;
    if (!perEnd) f[next].remainingMs = t.full;
    f.active = next;
    this.arm(now);
    this.finalsStartGreen(now, at);
    this.signal(1);
  }

  tickFinals(now) {
    if (!this.running()) return false;
    const at = this.deadline;
    const t = this.finalsTimes();
    if (this.phase === 'green' && t.orange > 0 && Math.ceil((at - now) / 1000) <= t.orange) {
      this.phase = 'orange'; this.changed(); return true;
    }
    if (now < at) return false;
    if (this.phase === 'red') { this.finalsStartGreen(now, at); this.signal(1); return true; }
    this.finalsSwitch(now, at);
    return true;
  }

  // ---------------------------------------------------------------- snapshot

  snapshot(now) {
    this.tick(now);
    const sys = this.system;
    const rem = this.remaining(now);
    const shown = this.hold ? Math.round(rem / 1000) : Math.ceil(rem / 1000);
    const colorOf = { wait: 'idle', red: 'red', green: 'green', orange: 'orange', countdown: 'blue', emergency: 'red' };
    const lightOf = { wait: 'red', red: 'red', green: 'green', orange: 'orange', countdown: 'red', emergency: 'red' };
    const d = this.settings.display;
    const snap = {
      system: sys,
      phase: this.phase,
      paused: this.paused,
      hold: this.hold,
      timeFormat: d.timeFormat,
      seconds: this.phase === 'wait' ? 0 : this.phase === 'emergency' ? null : shown,
      remainingMs: this.phase === 'wait' || this.phase === 'emergency' ? null : Math.round(rem),
      phaseTotalMs: this.phaseTotalMs,
      // length of the yellow warning period in this round (0 = none), so themes can say "last 30 s"
      warningSeconds: sys === 'manual' ? 0 : sys === 'finals' ? this.finalsTimes().orange : this.times().orange,
      digitColor: colorOf[this.phase],
      light: lightOf[this.phase],
      end: { number: this.end, label: sys === '25m1p' ? 'Arrow' : 'End', practice: this.practice, visible: sys === 'fita' || sys === '25m1p' },
      turn: { number: this.turn, total: this.turnsPerEnd(), visible: sys === 'fita' && this.turnsPerEnd() > 1 },
      details: this.detailsSnapshot(),
      shootoff: this.shootoff,
      finals: null,
      emergency: this.phase === 'emergency',
      hint: '',
      canNext: false, canPause: false, canStop: false,
      display: {
        theme: d.theme, trafficLight: d.trafficLight || sys === 'manual', trafficSide: d.trafficSide,
        showHints: d.showHints, hideIcons: d.hideIcons, bannerText: d.bannerText,
        clock: d.clock, clock24h: d.clock24h, clockSeconds: d.clockSeconds,
      },
    };
    if (sys === 'manual') {
      snap.seconds = null; snap.remainingMs = null; snap.digitColor = 'idle';
      snap.light = this.manualLight;
      snap.end.visible = false; snap.turn.visible = false;
    }
    if (sys === 'finals') this.finalsSnapshot(snap, now);
    this.hintsAndButtons(snap, now);
    return snap;
  }

  detailsSnapshot() {
    const sys = this.system;
    const none = { kind: 'none', slots: [], topbottom: null, archer: null, next: null };
    if (sys === 'finals' || sys === 'manual' || this.shootoff) return none;
    if (sys === '25m1p') {
      const next = this.phase === 'wait' || this.phase === 'countdown' ? this.archerNumber(this.turn)
        : this.turn < this.turnsPerEnd() ? this.archerNumber(this.turn + 1) : null;
      return { kind: 'archer', slots: [], topbottom: null, archer: this.archerNumber(), next: next == null ? null : String(next) };
    }
    const lay = this.layout();
    const groups = this.orderedGroups();
    const apt = this.archersPerTurn();
    const letters = groups.flat();
    const slots = letters.map((letter, i) => ({ letter, active: Math.ceil((i + 1) / apt) === this.turn }));
    const waiting = this.phase === 'wait' || this.phase === 'countdown';
    const nextTurn = waiting ? this.turn : this.turn < this.turnsPerEnd() ? this.turn + 1 : null;
    const next = nextTurn ? groups[nextTurn - 1].join('') : null;
    if (lay.topBottom) {
      const cur = groups[this.turn - 1][0];
      return { kind: 'topbottom', slots, topbottom: cur === 'T' ? { big: 'T', small: 'op' } : { big: 'B', small: 'ottom' }, archer: null, next };
    }
    if (letters.length < 2) return { ...none, kind: 'none', slots };
    return { kind: 'letters', slots, topbottom: null, archer: null, next };
  }

  finalsSnapshot(snap, now) {
    const f = this.finals, t = this.finalsTimes(), cfg = this.round.finals;
    const sideSecs = (side) => {
      if (f.active === side && ['green', 'orange'].includes(this.phase)) return f.exhausted ? 0 : Math.ceil(this.remaining(now) / 1000);
      if (this.phase === 'emergency') return 0;
      return Math.ceil(f[side].remainingMs / 1000);
    };
    const sideColor = (side) => {
      if (this.phase === 'wait') return f.chosen === side ? 'idle' : 'red';
      if (this.phase === 'red' || this.phase === 'emergency') return 'red';
      return f.active === side ? (this.phase === 'orange' ? 'orange' : 'green') : 'red';
    };
    const sideLight = (side) => {
      const c = sideColor(side);
      return c === 'green' ? 'green' : c === 'orange' ? 'orange' : 'red';
    };
    snap.finals = {
      mode: cfg.mode, view: cfg.view, chosen: f.chosen, active: f.active, primary: f.primary,
      arrow: f.arrow, turns: t.turns, showTargets: cfg.showTargets && cfg.view === 'both', targets: { ...cfg.targets },
      left: { seconds: sideSecs('left'), color: sideColor('left'), light: sideLight('left') },
      right: { seconds: sideSecs('right'), color: sideColor('right'), light: sideLight('right') },
    };
    if (this.phase === 'red') snap.seconds = Math.ceil(this.remaining(now) / 1000);
    else if (this.phase === 'wait') snap.seconds = 0;
    else if (f.active && this.phase !== 'emergency') snap.seconds = sideSecs(f.active);
    snap.end.visible = false; snap.turn.visible = false;
    if (cfg.view !== 'both') {
      const v = snap.finals[cfg.view];
      snap.light = v.light;
    }
  }

  hintsAndButtons(snap, now) {
    const sys = this.system, p = this.phase, g = this.guarded(now);
    if (sys === 'manual') {
      snap.hint = 'Manual: R / Y / G switch the light, 1 / 2 / 3 send signals.';
      return;
    }
    snap.canStop = p !== 'emergency';
    snap.canPause = ['red', 'green', 'orange', 'countdown'].includes(p) && !this.hold && (sys !== 'finals' || p !== 'countdown');
    if (p === 'emergency') { snap.hint = 'Emergency stop.'; return; }
    if (this.paused) { snap.canNext = !g; snap.hint = 'Paused. Press Space or Next to resume.'; return; }
    if (sys === 'finals') {
      const f = this.finals;
      if (p === 'wait') {
        snap.canNext = !!f.chosen && !g;
        snap.hint = f.chosen ? 'Press Space to start the end.' : 'Choose the starting archer (left or right).';
      } else if (p === 'red') { snap.hint = 'Preparation.'; }
      else { snap.canNext = !g; snap.hint = 'Press Space when the archer has shot to switch sides.'; }
      return;
    }
    if (p === 'wait') { snap.canNext = !g; snap.hint = this.shootoff ? 'Shoot-off armed.' : 'Press Space to start the end.'; return; }
    if (p === 'countdown') { snap.canNext = true; snap.hint = 'Match starts soon. Press Space to start now.'; return; }
    if (p === 'red') { snap.canNext = this.hold; snap.hint = this.hold ? 'Waiting: press Space to start shooting.' : 'Walk-up time.'; return; }
    snap.canNext = !g;
    const last = this.shootoff || (this.turn >= this.turnsPerEnd() && !(this.doubleTurns() && this.end % 2 === 1));
    snap.hint = last ? 'Press Space to finish this end.' : 'Press Space when this detail has finished.';
  }
}

module.exports = { Engine, LAYOUTS, GUARD_MS, EMERGENCY_MS };
