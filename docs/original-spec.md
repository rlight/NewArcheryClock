# ArcheryClock 2.4 (2.4.1.2 beta) — Functional Specification of the Original

Source analysed: `~/git/archeryclock24124_dev/archeryclock24124_dev/`
(`Countdown.pas` 12,052 lines + `Countdown.lfm`, `settings`, `language/*`, `sounds/*`).
Author: Henk Jegers, © 2010–2015, **GPL v3**.

All application logic lives in the one unit `Countdown.pas`. The other 19 `.pas` files
(`include/sdl*.pas`, `smpeg.pas`, `libxmlparser.pas`, `logger.pas`, `userpreferences.pas`,
`registryuserpreferences.pas`, `moduleloader.pas`, `fastevents.pas`, `xplatformutils.pas`)
are third-party SDL/JEDI library bindings used only to play WAV files on Linux.
`Countdownold.pas` is an older copy of the main unit and is not compiled.

This document describes **what the program does**, so it can be rebuilt without reading
the Pascal. Section 9 lists what to **drop** (hardware, serial, network, follow mode).
Pascal identifiers appear in `code` so the original can be checked if needed.

> **Licence note:** the original is GPL v3. A clean-room rewrite of the *behaviour* is fine.
> Copying the language files, sound files, images or code text into the new project would
> make it a derivative work under GPL.

---

## 1. Concepts and vocabulary

| Term (original) | Meaning |
|---|---|
| **archerysystem** | The top-level round type: `fita`, `fitafin`, `25m1p`, `manual`, `follow` (follow is dropped). |
| **end / serie** (`serienumber`) | End counter shown on screen. In finals it is the **arrow/turn number**. In 25m1P it is the **arrow number**. |
| **turn** (`turnnumber`) | Which detail/group within the current end is shooting (1…`Turnsperserie`). |
| **detail letters** | A–F. These are archer positions on the target. "Archers per turn" letters shoot together. |
| **practice** (`Practiseturn`) | Practice ends are counted separately before the scoring ends, with a "P" marker. |
| **state** | 1 = waiting, 2 = red (preparation / walk-up), 3 = green (shooting), 4 = orange/yellow (warning), 5 = countdown to match start, 6 = emergency (only for an instant; see §4). |
| **shoot-off** (`Shootoff`) | A one-off timed turn for N arrows (1–6) that does not advance the end counter. |

---

## 2. Round types (timing modes)

### 2.1 Common phase sequence (all timed modes)

```
WAIT (state 1, red light, grey digits "000")
   │ Next/Space            ── 2 beeps
   ▼
RED / preparation (state 2) — counts down redTime
   │ time expires           ── 1 beep
   ▼
GREEN (state 3) — counts down (green + orange)
   │ remaining reaches orange threshold (no sound)
   ▼
ORANGE (state 4) — continues counting down
   │ time expires OR operator presses Next
   ▼
 ├─ more turns in this end → next turn's RED starts automatically   ── 2 beeps
 └─ last turn of the end   → WAIT, end counter advances             ── 3 beeps
```

* The shooting countdown starts at **green + orange** seconds and changes to orange when the remaining time reaches the orange value. Example: 90 s green + 30 s orange = 120 s shown, turning orange at 30.
* While the remaining time is above 1 it counts down once per second. The display shows `N … 1`, and **one second after "1"** the phase changes. "0" is never shown during a running phase, so the phase lasts exactly N seconds.
* In **standard (FITA) rounds the orange transition uses `<=`**. In all other modes it uses `==`, so an orange value of 0 means there is no orange phase.
* If **green = 0** (FITA mode only), the clock goes from red straight to orange.
* Between details inside one end, the next detail's red/preparation phase starts **automatically** without operator input.

### 2.2 Standard round — `fita` ("FITA", target archery)

The detail layout is selected from 10 options (`fitamode` is the stored value):

| fitamode | Name (UI) | Shooters on target | Turns per end | Archers per turn | Order, end 1 | Order, end 2 | Order, end 3 | … |
|---|---|---|---|---|---|---|---|---|
| 1 | `[A]` | 1 | 1 | 1 | A | A | A | |
| 2 | `[A-B]` | 2 | 2 | 1 | A-B | B-A | A-B | |
| 3 | `[A-B-C]` | 3 | 3 | 1 | A-B-C | C-A-B | B-C-A | |
| 4 | `[A-B-C-D]` | 4 | 4 | 1 | A-B-C-D | D-A-B-C | C-D-A-B | B-C-D-A |
| 5 | `[AB-CD]` | 4 | 2 | 2 | AB-CD | CD-AB | AB-CD | |
| 6 | `[A-B-C-D-E]` | 5 | 5 | 1 | A-B-C-D-E | E-A-B-C-D | D-E-A-B-C | C-D-E-A-B, B-C-D-E-A |
| 7 | `[A-B-C-D-E-F]` | 6 | 6 | 1 | A…F | F-A-B-C-D-E | E-F-A-B-C-D | … (rotate right by 1 each end) |
| 8 | `[AB-CD-EF]` | 6 | 3 | 2 | AB-CD-EF | EF-AB-CD | CD-EF-AB | |
| 9 | `[ABC-DEF]` | 6 | 2 | 3 | ABC-DEF | DEF-ABC | ABC-DEF | |
| 0 | `Top-Bottom` | 2 | 2 | 1 | T-B | B-T | T-B | |

**Rotation rule.** The letter sequence is rotated right by one group per scoring end, cyclically with period = turns per end. The end index used for rotation is
`e = ceil(serienumber / nrofturns)`, where `nrofturns` = 2 when "double ends" is on (§2.3) and 1 otherwise. The original computes `k = ((serienumber + nrofturns − 1) div nrofturns) mod Turnsperserie`; k = 1 means the base order.

The sequence is **always the base order (no rotation)** when:
* the current end is a **practice end**, or
* **"Start every end with sequence AB…"** (`ABCDperEND`) is checked. Default is unchecked; every built-in preset clears it.

**Display model.** Six fixed on-screen *slots* (`Shooter1..6`) sit left to right. Slot *i* is "active" when it belongs to the current turn:
* 1 archer per turn: slot = turn
* 2 per turn: slots 2t−1 and 2t
* 3 per turn: slots 3t−2 to 3t

Active slots are lime and the others are grey. Each slot's *caption* is the letter from the rotated order. So in end 2 of AB-CD, slots 1–2 show "C D" lit first. Letters are shown only when shooters ≥ 2. They are hidden during a shoot-off and in Top-Bottom mode.

**Top-Bottom mode** (`topbot`) works like `[A-B]`, but instead of letters it shows a large **"T" + "op"** when the active slot carries "A", or **"B" + "ottom"** when it carries "B". The first letter is lime and the rest cream. It alternates T-B / B-T per end.

**FITA timing settings** (defaults are from the form; built-in presets F1–F7 set the same values):

| Setting | Field | Default | Range | Notes |
|---|---|---|---|---|
| Red / preparation | `redtime` | 10 s | −1…150 | −1 = hold (see §2.7) |
| Green | `greentime` | 90 s | −1…450 | −1 = hold; 0 = skip straight to orange |
| Orange (warning) | `orangetime` | 30 s | −1…150 | −1 = hold at end of green |
| Total (read-only) | `totaltime` | green+orange | | A −1 value counts as 0 |
| Practice ends | `practiseturns` | 2 | 0…10 | 0 = no practice |
| Double ends | `doubleturns` | off | bool | Enables Double time / Double turns |
| Double time | `dbltime` | — | radio | |
| Double turns | `dblturn` | selected | radio | |
| Start every end with AB… | `ABCDperEND` | off | bool | Disables rotation |
| Shoot-off red | `redtimeso` | 10 s | 0…150 | |
| Shoot-off green (per arrow) | `greentimeso` | 30 s | 0…450 | |
| Shoot-off orange (per arrow) | `orangetimeso` | 10 s | 0…150 | |

### 2.3 Double ends (long distance) — FITA only

"Double ends? (for example on long distances where 2 times 3 arrows are shot before getting them from the target)". Two variants:

**Double turns** (`dblturn`; internally `nrofturns=2, times=1, turnsss=2`). This is the AB-CD-AB-CD style:
* Each detail shoots twice per real end, e.g. `[AB-CD-AB-CD]`. Every pass is a full red + green + orange cycle with normal times.
* **The end counter increments after each pass of the sequence**, so it counts 3-arrow "half ends". One real end shows as ends 1 and 2, the next as 3 and 4, and so on.
* After the last turn of an odd-numbered half end, the clock does **not** stop. It increments the end, resets the turn to 1 and starts the next red/preparation automatically (2 beeps).
* Only after the last turn of an **even** half end does it go to WAIT (3 beeps).
* Rotation changes every 2 half ends, so ends 1–2 run AB-CD and ends 3–4 run CD-AB.

**Double time** (`dbltime`; internally `nrofturns=2, times=2, turnsss=1`). This is the "6 arrows in a row in 4 minutes" style:
* Each detail gets **one** turn per end with shooting time **2 × (green + orange)**. With the defaults that is 240 s.
* The orange threshold is still `orangetime` (30 s), not doubled.
* The end counter steps by **2** (shows 1, 3, 5, …). Each 6-arrow end counts as two 3-arrow ends.
* Rotation changes every end.
* Practice: practice ends also step by 2. Practice finishes when `serienumber ≥ practiseturns − times + 1`.

UI text helpers show the sequence and duration, e.g. `1: [AB-CD-AB-CD]` / `2: [CD-AB-CD-AB]` and `(120+120+…)`. For double time it shows `1: [2x AB-CD]` and "green+green+orange + orange = total".

### 2.4 Practice ends

* `fita`: `practiseturns` practice ends (default 2). `25m1p`: `nrof1ppractisearrows` practice arrows (default 5).
* At startup and after a system change, practice is active if the count is > 0. The end counter starts at 1 with the **"P"** marker shown next to it.
* When the last practice end finishes, the counter resets to **1** and the P marker disappears. Scoring ends start from 1.
* Practice ends always use the un-rotated order.
* Lowering the practice count below the current practice end clamps the current end to the new count. Setting it to 0 leaves practice.
* Moving "end down" from scoring end 1 goes back into practice (last practice end) if the practice count > 0.
* Clicking the end number resets to end 1, turn 1, with practice re-enabled if the count > 0. Hint: "Reset to first (practice) end."

### 2.5 Shoot-off (FITA and 25m1P)

* Triggered by **keys 1–6** (N = 1…6 arrows) or the **SO icon** (N = 1). This only works while the countdown timer is not running, normally in WAIT.
* The SO icon is visible only in WAIT (state 1) in `fita`/`25m1p`. It is hidden in finals.
* FITA shoot-off: red = `redtimeso`; shooting time = **N × (greenso + orangeso)**; orange at **N × orangeso**. The double-time multiplier is ignored.
* 25m1P shoot-off: uses the normal 25m1P red/green/orange (one turn).
* Detail letters are hidden during a shoot-off.
* After a single turn the clock goes to WAIT (3 beeps). **The end and turn counters are not changed.**
* The Next hint changes to "Stop last turn of this end".
* Quirk: pressing 1–6 while a turn is **paused** (timer stopped, state 2/3/4) just resumes the timer. The turn is flagged as a shoot-off and ends as one.

### 2.6 25m1P — one-arrow-per-archer rotation (`25m1p`)

The Dutch "25m 1 pijl" system. Each archer on the target shoots **one arrow per turn** in sequence. The end counter is the **arrow number** (label "Arrow" instead of "End").

| Setting | Field | Default | Range |
|---|---|---|---|
| Archers per target | `nrof1pshooters` | 6 (presets: 4/5/6) | 1…6 |
| Red | `redtime1p` | 15 s | 0…150 |
| Green | `greentime1p` | 30 s | 0…450 |
| Orange | `orangetime1p` | 15 s | 0…150 |
| Practice arrows | `nrof1ppractisearrows` | 5 | 0…10 |
| Always start with archer nr 1 | `rotate25m1p` | on | bool |
| Use ABCD lights for first 4 archers | `abcd25m1p` | on | hardware only — drop |

* Turns per end = number of archers. Each turn is red → green → orange for one archer. The next archer's red starts automatically (2 beeps). After the last archer the clock goes to WAIT (3 beeps) and the arrow number advances.
* The screen shows **"Archer" + the big archer number** (lime) instead of letters.
* With "Always start with archer nr 1" **on**: archer number = turn.
* With it **off**, the starting archer rotates each arrow:
  `archer = ((turn + (arrow − 1) mod N − 1) mod N) + 1`. Arrow 2 starts with archer 2, and so on.
* The archer number label is hidden when "Always start with archer 1" is on. Clicking the archer label / number moves the turn down / up.

### 2.7 "Hold" values (−1) in FITA timing

Setting red, green or orange to **−1** makes that phase **untimed**. The clock enters the phase, stops, and waits for the operator to press **Next/Space**, which resumes it:
* red = −1: shows red "0" and holds. Next → green.
* green = −1: holds in green showing the orange value. Next → counts down the orange time as orange.
* orange = −1: after green expires, shows orange "0" and holds. Next → ends the turn. The following red is then also paused and needs another Next.
* The Next icon stays visible in red only when red = −1.

### 2.8 Finals — alternating shooting (`fitafin`, "FITA Finals (Alternating)")

Two competitors or teams, **Left** and **Right**. Each has its own timer (`countdowntimer` = left, `countdowntimer2` = right). Only one runs at a time.

Sub-modes:

| Sub-mode | Field | Defaults (preset) | Meaning |
|---|---|---|---|
| **Time per turn/arrow (individual)** | `timeperturn` | shift-F8: green 20, orange 0, red 10, turns `finalturns` 3 | Fixed time per arrow. A side's timer **resets to full** each time it becomes active. |
| **Time per end (team)** | `timeperend` | shift-F9: green 120, orange 0, red 10, turns `finalteamturns` 2 | Each side has a time budget per end. The timer **pauses** while the other side shoots and **keeps its remaining time**. |

Ranges: green 0…450, orange 0…150, red 0…150, turns 1…99. Form defaults for orange in finals are **0**, so there is no warning phase unless configured.

**Sequence:**
1. WAIT, no side chosen. The "Choose" button is lime, both direction arrows grey, and "Choose starting archer by click on an arrow" is shown. The Next icon is hidden and Space does nothing.
2. The operator chooses the starting side by:
   * clicking the left/right grey arrow, or the left/right digits when both timers are shown;
   * pressing **← / →**; or
   * pressing **PageUp** (left) / **PageDown** (right) when no side is chosen.

   That side becomes **active** and **Primary**; the other is **Secondary** (spelled "Secundary" in the original). Clicking the Primary/Secondary labels swaps them.
3. **Next/Space** → RED for the starting side: active timer = red time, the other side's timer shows its full shooting time. 2 beeps.
4. Red expires → GREEN for the active side; its timer = green + orange. 1 beep.
   * Quirk: the original decides "green = 0 → go straight to orange" using the **FITA** green value, not the finals green.
5. The active side's time expires, or the operator presses **Next / Space / PageDown** (side finished early) → **switch sides**, 1 beep:
   * The other side goes straight into **GREEN**. There is no red between alternations.
   * Individual: the side that just finished has its timer reset to full (or 0 if it was its last arrow).
   * Team: the finished side keeps its remaining time (a value of 1 becomes 0). The newly active side enters green, or orange if its remaining time ≤ the orange value.
   * The arrow/turn counter increments when play returns to the **Primary** side (only while counter < turns).
6. When the counter ≥ turns **and** the **Secondary** side finishes, the end is over. WAIT, 3 beeps, both timers 0, sides cleared (must choose again), **counter reset to 1**.

* Edge case (team): if a side's budget is exhausted (0) and play switches to it, it immediately counts as finished one second later. Another switch follows, with 1 beep.
* **Correcting the side while running:** pressing ←/→ (or clicking an arrow/digits) during a running end makes that side active, makes it Primary, and **swaps the two timer values**.
* **PageUp while running** does nothing. In WAIT it clears the side selection.
* **Up/Down** change the arrow counter, clamped to 1…turns.
* **Stop / Emergency** clear the side selection, zero both timers and go to WAIT. The counter is *not* reset by Stop.
* No shoot-off and no practice in finals.

**Finals display options** (`Show` group):

| Option | Field | Default | Meaning |
|---|---|---|---|
| Both screens | `finarrow` | on | Both timers on one screen, side by side. The active side zooms large and the inactive side shrinks (animated, 30 ms steps). |
| Left screen | `viewleft` | off | Only the left competitor's timer (for a dedicated left-side display) |
| Right screen | `viewright` | off | Only the right competitor's timer |
| Show target number | `showtarget` | off | Shows left/right target numbers (`leftnumber` 1, `rightnumber` 2). Active number lime, inactive red. Disabled for single-side views. |

Finals digit colours:
* WAIT: inactive / unchosen side **red**, chosen side grey. With single-side view or not "both screens", both are grey.
* Red phase: both red.
* Green/orange: active side green/orange, other side red.

There are two traffic lights (left and right) in "both screens" mode. Otherwise there is one light, showing the lamp state of the viewed side.

### 2.9 Manual mode (`manual`)

There is no countdown. The operator drives the traffic light and signals by hand. This is screen-only and is **kept**.
* Digits, end and turn are hidden. The on-screen traffic light is **always shown**, whatever the setting.
* Buttons:
  * **Red** → light red + `nrredbuzz` beeps (default **2**, range 0–3).
  * **Orange** → orange + `nrorangebuzz` (default **0**).
  * **Green** → green + `nrgreenbuzz` (default **1**).
  * Clicking a lamp of the on-screen light does the same.
* Buttons **1 / 2 / 3 signals** play 1, 2 or 3 beeps.
* **Emergency** (E, PageUp or the danger button) → red + 4 beeps + "Stop" text.
* Next, pause, stop and end navigation do nothing in this mode.

### 2.10 Countdown to match start (state 5)

* Started with **C**, the hourglass icon or the "start" button in the Countdown tab. Only possible in WAIT (or straight after an emergency) in `fita`/`25m1p`, and not during the 2 s anti-double-press guard (§7.3).
* Duration: `tostart` minutes. Default **4**, range 0…10, settings line 10.
* Shows a **blue full-screen panel** with "Match starts in", digits in **M:SS** (always minutes, colour #0080FF) and "Minutes". The light stays red.
* At 0 it goes straight into the first RED/preparation (2 beeps). Starting it is silent.
* Next during the countdown skips to RED immediately. Pause works. Stop cancels **silently** (no beeps).
* **"Start countdown always between ends"** (`precountalways`, default off; settings line 14 `PRECOUNT`). In FITA only, every completed end automatically starts this countdown (bypassing the 2 s guard).
* Display quirk: with 10 minutes the first second shows `0:00`, because the minutes digit is mod 10.

### 2.11 Built-in presets (Shift+F1…Shift+F12) and user scenarios (F1…F12)

**Shift+Fn** loads a fixed preset (`Setsettings`). Each also clears "Start every end with AB…":

| Key | System | Layout / options | Times |
|---|---|---|---|
| Shift-F1 | fita | `[A]`, no double | red 10, green 90, orange 30; SO 10/30/10; practice 2 |
| Shift-F2 | fita | `[A-B]` | same |
| Shift-F3 | fita | `[A-B-C]` | same |
| Shift-F4 | fita | `[A-B-C-D]` | same |
| **Shift-F5** (factory startup) | fita | `[AB-CD]` | same |
| Shift-F6 | fita | `[AB-CD]` + double ends: **double turns** (AB-CD-AB-CD) | same |
| Shift-F7 | fita | `[AB-CD]` + double ends: **double time** (6 arrows in 240 s) | same |
| Shift-F8 | fitafin | both screens, time per arrow, 3 arrows | red 10, green 20, orange 0 |
| Shift-F9 | fitafin | both screens, time per end, 2 turns | red 10, green 120, orange 0 |
| Shift-F10 | 25m1p | 4 archers | red 15, green 30, orange 15 |
| Shift-F11 | 25m1p | 5 archers | same |
| Shift-F12 | 25m1p | 6 archers | same |

Preset descriptions (language lines 25–36): "1 archer per target.", "1 archer per turn 2 turns per end", …, "2 archers per turn 2 X 2 turns per end (Get arrows after every 2 ends)…", "…shooting 6 arrows in a row in 4 minutes…", "Individual final round. (Alternating) Fixed time per arrow.", "Team Final round. (Alternating) Fixed time per end. Paused timing when other team is shooting.", "25m1P system with 4/5/6 archers on a target."

Partial-reset quirks:
* Presets only set the fields listed above. For example, Shift-F8–F12 don't touch the FITA times, and Shift-F1–F5 don't change the double-time/double-turn radio.
* Selecting any preset (or changing system) resets end = 1, turn = 1, state = WAIT, timers = 0 and the finals side selection.

**F1…F12** load **user scenarios** from `scenarios/F1`…`F12`. If a file is missing, the matching Shift preset is used. "Save current settings as Fn settings" buttons on the Scenario tab write the current full timing configuration (format in §5.3). Each user slot shows a summary: sequence, shooting time, red time and shoot-off time.

---

## 3. Signals (sound)

### 3.1 Mechanism

* One sound file is selected globally and played once per "beep". The original has no separate whistle and buzzer sounds.
* Beeps of a group start at t = 0 and are spaced **1.5 s** apart: a 750 ms timer toggles on/off and the sound plays at each "on". A group of N beeps takes about (N−1)·1.5 s + 0.75 s.
* A new signal cancels any group still in progress (the remaining-beep count is overwritten).
* "Use PC speaker for buzzer" (`speaker`, default **on**). When off, no sound is played at all; the original then relied on a hardware buzzer.
* "Test" button plays the signal for the current state. In WAIT that is 3 beeps.

### 3.2 Beep counts by event

| Event | Beeps |
|---|---|
| Start of an end / turn: WAIT → RED (Next, or match-start countdown expiring) | **2** |
| Next detail's RED starting automatically after a turn ends mid-end (incl. double-turn half-end) | **2** |
| RED → GREEN (shooting starts) | **1** |
| GREEN → ORANGE (warning) | **0 (silent)** |
| End of end: last detail finished by time-out or Next | **3** |
| End of shoot-off | **3** |
| Finals: side switch (alternation) | **1** |
| Finals: end complete | **3** |
| **Stop** (S key / stop icon), from any state except the match-start countdown | **3** |
| Stop during match-start countdown | 0 |
| **Emergency stop** (E / PageUp / danger icon) | **4**, with "Stop" flashing in red in sync with the beeps |
| Pause / resume | 0 |
| Start of match-start countdown | 0 |
| Manual mode red / orange / green | 2 / 0 / 1 by default (configurable 0–3 each) |
| Manual mode signal buttons | 1, 2, 3 |
| Manual mode emergency | 4 |

### 3.3 Sound files

* Selectable (`soundselect`): BEEP1–BEEP7, BELL1, BUZZER1–BUZZER8, FLUTE1, HORN1–HORN6, OINK1, PLOINK1.
* The file played is `sounds/<lowercase name>.wav`. Default (settings line 9) is **`buzzer1`** → `sounds/buzzer1.wav`.
* Validation quirk: an unknown name falls back to `buzzer` (`sounds/buzzer.wav`). The check is case-sensitive, so choosing "BUZZER1" from the list resets to "buzzer" (an identical file).
* Unused files in the folder: `ringout.wav` and the `.mp3` copies.

---

## 4. Display

### 4.1 Screen elements

Black background. Tahoma, bold, for everything. Sizes scale with the window (§4.4).

| Element | Content / rule |
|---|---|
| **Main timer** | 3 digits. **Seconds mode** (default): `SSS` with leading zeros, e.g. `090`, max 999. **Minutes mode**: `M:SS`, single minute digit (minutes mod 10). Toggle with **M** or the setting. Shows `000` / `0:00` in WAIT. |
| **Digit colour** | WAIT: grey `#808080`. RED: red `#FF0000`. GREEN: lime `#00FF00`. ORANGE: **yellow `#FFFF00`** (named orange throughout the program). |
| **Traffic light** (optional) | 3 stacked circular lamps (red top, orange, green bottom), each 0.22·R, beside the digits on the left or right. Lit lamp = current phase. WAIT, match-start countdown and red phase: red lit. Shown when "Use traffic light on screen" is on (and always in manual mode). Finals "both screens": one light on each side. |
| **End number** | Lower left, silver, with label "End" ("Arrow" in 25m1P). In finals it is a large centred arrow/turn number. |
| **Practice marker** | "P" left of the end number while in practice. |
| **Turn number** | Lower right, silver, with label "Turn" (FITA). |
| **Detail letters** | Row of 2–6 letters, centred, 0.25·R high. Active = lime, others = grey. Scaled ×0.9 for 5 and ×0.8 for 6 shooters. |
| **Top/Bottom** | Big "T"+"op" or "B"+"ottom" instead of letters. |
| **25m1P archer** | "Archer" (cream) + big archer number (lime). |
| **Finals** | Two timers, direction arrows (green = shooting side, grey = waiting), "Primary"/"Secondary" labels (lime/grey), "Choose" button, optional target numbers. |
| **Match-start countdown** | Blue panel: "Match starts in" / `M:SS` / "Minutes". |
| **Emergency text** | "Stop" (language line 141), huge red, flashing during the 4 beeps. |
| **Idle banner** | In WAIT only: a cycling text label ("Free", "Archery", "CountDown", "Timer", "www.archeryclock.com", 1.2 s steps) and `banner.bmp` (club banner) at the bottom if present. Hidden while running. Optional in the rewrite. |
| **Copyright header** | Small grey line at the top: "© 1994-2015, Henk Jegers. 2.4.1.2 beta". |
| **Hint bar** | (if "Show hints") Cream box above the Next button. WAIT: "Press space bar or click 'Start Timer'…". Running, more turns to come: "…'Next archer' to finish this turn…". Last turn: "…'Stop last turn of this end' to finish this end." Finals: "Choose starting archer by click on an arrow." Tooltips on every icon. |
| **Menu auto-hide** | If a settings/timing menu is open while the clock runs, a "Menu disappears after N Seconds" countdown (5 → −1, 1 s steps) closes it. |

There is **no** on-screen "paused" indicator. Digits simply freeze in their current colour; only the pause icon tooltip changes.

### 4.2 Icon bar (bottom of screen; size = min(H·1.33, W)/38, max 25 px)

* Left: end − / end +.
* Then: play/pause (hidden in WAIT and manual), stop, shoot-off "SO" (WAIT only), hourglass + "4 min." (match-start countdown, WAIT only), emergency/danger.
* Centre: **Next** (hidden during red unless red = −1; hidden in finals until a side is chosen).
* Right: timing menu (clock icon), settings (gear), USB/hardware (drop), turn − / turn +.
* Top-left: resize/window toggle. Top-right: close.
* Manual mode adds 1/2/3-signal buttons and red/orange/green buttons.
* **"Hide icons"** (`hideicons`, H key, or clicking digit 1) hides all icons and labels except the clock and settings icons.

### 4.3 Colours summary

* Background black. Labels silver `#C0C0C0`. Active letter/number lime `#00FF00`; inactive grey `#808080`.
* Cream text `#FFFBF0` for secondary words ("op", "ottom", "Archer").
* Match-start digits `#0080FF` on a blue image background.
* Finals target numbers: lime (active) / red. "Choose" button lime when unchosen, else grey.
* The colours are hard-coded, not configurable.

### 4.4 Layout geometry (proportional)

* Reference size R:
  * **Without** traffic light, aspect 4:3: R = min(H·1.33, W). Content centred horizontally.
  * **With** traffic light, aspect 1.65:1: R = H·1.33 if W > 1.65·H, else W·1.33/1.65. The block is shifted to leave room for the light on the chosen side.
* Main digits: font 0.57·R, top −0.07·R.
  * Seconds mode, digit x positions: 0.02, 0.33, 0.64·R.
  * Minutes mode: 0.001 (digit), 0.29 (colon), 0.38, 0.68·R.
* Letters row: top 0.41·R, centred around 0.59·R, pitch 0.2·R.
* End number: x 0.033·R, y 0.48·R, font 0.09·R. Labels "End"/"Turn" at y 0.45·R, font 0.035·R.
* Traffic lamps: 0.22·R at y 0.01 / 0.23 / 0.45·R, x = −0.23·R (left) or +1.01·R (right) of the content block.
* Finals (both screens):
  * Each timer is font 0.45·R at full (active) size and shrinks to 0.225·R when inactive. A zoom animation steps 20 % (4 % near the end) every 30 ms.
  * Arrow number: centred, font 0.2·R at y 0.4·R. Target numbers 0.12·R at the far left/right, y 0.52·R.
* Match-start digits: font 0.47·R.

### 4.5 Window behaviour

* Starts maximised and borderless (full screen after a 1 s start-up delay). The screensaver is disabled at start.
* **Esc** / resize icon toggles between full screen and a 640×480 sizable window. Pressing Next removes the window border.
* Close icon exits immediately, with no confirmation.

---

## 5. Settings and persistence

### 5.1 Settings dialog (gear icon) — tabs

| Tab | Controls (kept unless marked) |
|---|---|
| **Language** | Language combo (§6) |
| **Screen layout** | Minutes/Seconds radio (`Sec. (120)` / `Min. (2:00)`), Traffic light group (Use traffic light on screen; left side / right side), Hide icons, Show hints |
| **Sound** | Use PC speaker for buzzer; sound file combo; Test button |
| **Scenario** | Startup scenario combo (F1…F12, shiftF1…shiftF12, `--`); panel with 24 "Select F…"/"Select shift-F…" buttons, descriptions and "Save current settings as Fn" buttons |
| **Countdown to start match** | Minutes (0–10), "start" button, "Start countdown always between ends" |
| **Hardware** | K8055, Serial (Arduino), COM port, LAN, port, PC name — **drop** |
| **About** | GPL text, credits |
| — | **"Save as startup setting"** button writes the `settings` file (§5.2) |

**Timing menu** (clock icon) offers a system radio (FITA / FITA Finals / 25m1P / Manual / Follow) and the panel for the selected system with all the fields in §2. Any change to a timing field sets the startup scenario to `--` (custom).

### 5.2 `settings` file (plain text, one value per line, read in order)

The factory file shipped with the app holds exactly these values:

| Line | Meaning | Values | Factory | Keep? |
|---|---|---|---|---|
| 1 | Language | `English`, `Nederlands`, `Deutsch`, `Francais`, `Espanol`/`Español`, `Italiano`, `Magyar`, `Greek`/`Ελληνικά` | `English` | keep |
| 2 | Time format | `Sec` / `Min` | `Sec` | keep |
| 3 | Hide icons | `Hide` / `nonHide` | `nonHide` | keep |
| 4 | Sound on | `Buzzer` / `nonBuzzer` | `Buzzer` | keep |
| 5 | Startup scenario | `F1`…`F12`, `shiftF1`…`shiftF12`, `--` | `shiftF5` | keep |
| 6 | Show hints | `Hint` / `nonHint` | `Hint` | keep |
| 7 | Traffic light on screen | `TL` / `nonTL` | `TL` (on) | keep |
| 8 | Traffic light side | `TLleft` / `TLright` | `TLright` | keep |
| 9 | Sound name | see §3.3 | `buzzer1` | keep |
| 10 | Match-start countdown minutes | 0–10 | `4` | keep |
| 11 | K8055 card | `K8055` / `nonK8055` | `K8055` | **drop** |
| 12 | Serial port | `COM1`…`COM10`, `/dev/ttyACM0`, `/dev/ttyUSB0` | `COM1` | **drop** |
| 13 | Arduino serial | `arduino1` / `nonarduino1` | `nonarduino1` | **drop** |
| 14 | Countdown between ends | `PRECOUNT` / `noPRECOUNT` | `noPRECOUNT` | keep |
| 15 | Network port | 1024–100000 | `4665` (form default 25220) | **drop** |
| 16 | LAN on | `LAN` / `nonLAN` | `nonLAN` | **drop** |

* Lines 6+ and 14+ are optional, for older files.
* When the startup scenario is `--`, saving also writes the current timing configuration to `scenarios/gen`. Start-up with `--` loads `scenarios/gen`.
* The `scenarios/` folder does not exist in the distribution. Saving into it would fail unless the folder is created; the rewrite should create it.

### 5.3 Scenario file format (`scenarios/F1`…`F12`, `scenarios/gen`)

One value per line, in this order. Booleans are `TRUE`/`FALSE`.

1. system (`fita`/`fitafin`/`25m1p`/`manual`/`follow`)
2. `0` (unused)
3. fitamode 0–9 (§2.2)
4. nrofturns (1/2)
5. green
6. orange
7. red
8. SO green
9. SO orange
10. SO red
11. 25m1p green
12. 25m1p orange
13. 25m1p red
14. practice ends
15. 25m1p archers
16. doubleturns
17. dbltime
18. dblturn
19. showtarget
20. finarrow (both screens)
21. `empty`
22. timeperturn
23. timeperend
24. left target no.
25. right target no.
26. final turns (individual)
27. final turns (team)
28. final green
29. final orange
30. final red
31. team green
32. team orange
33. team red
34. BCDtoROG2 *(hw)*
35. abcd25m1p *(hw)*
36. ABCDperEND
37. manual red beeps
38. manual orange beeps
39. manual green beeps
40–45. hardware button actions ×6 *(hw)*
46. follow screen side *(follow)*
47. follow input *(follow)*
48. 25m1p practice arrows
49. viewleft
50. viewright
51. rotate25m1p
52. follow host *(follow)*
53–54. `dummy`

### 5.4 Complete list of kept settings with defaults

| Group | Setting | Type | Default | Range |
|---|---|---|---|---|
| General | Language | enum | English | 8 languages |
| General | Seconds / minutes display | enum | seconds | |
| General | Hide icons | bool | off (factory settings file) | |
| General | Show hints | bool | on | |
| General | Traffic light on screen | bool | on | |
| General | Traffic light side | left/right | right | |
| Sound | Sound enabled | bool | on | |
| Sound | Sound file | enum | buzzer1 | 25 names |
| Start | Startup scenario | enum | shiftF5 | |
| Start | Match-start countdown | int min | 4 | 0–10 |
| Start | Countdown between every end | bool | off | |
| System | Round type | enum | fita | fita / fitafin / 25m1p / manual |
| FITA | Layout (fitamode) | enum | AB-CD (via shiftF5); form default A-B-C-D | 10 options |
| FITA | red / green / orange | int s | 10 / 90 / 30 | −1…150 / −1…450 / −1…150 |
| FITA | practice ends | int | 2 | 0–10 |
| FITA | double ends | bool | off | |
| FITA | double mode | turns/time | turns | |
| FITA | start every end with AB… | bool | off | |
| FITA | SO red / green / orange per arrow | int s | 10 / 30 / 10 | 0…150 / 0…450 / 0…150 |
| 25m1P | archers | int | 6 | 1–6 |
| 25m1P | red / green / orange | int s | 15 / 30 / 15 | |
| 25m1P | practice arrows | int | 5 | 0–10 |
| 25m1P | always start with archer 1 | bool | on | |
| Finals | per arrow / per end | enum | per arrow | |
| Finals | individual turns (arrows) | int | 3 | 1–99 |
| Finals | team turns | int | 2 | 1–99 |
| Finals | individual red / green / orange | int s | 10 / 20 / 0 | |
| Finals | team red / green / orange | int s | 10 / 120 / 0 | |
| Finals | view | both / left / right | both | |
| Finals | show target numbers | bool | off | |
| Finals | left / right target number | int | 1 / 2 | |
| Manual | red / orange / green beeps | int | 2 / 0 / 1 | 0–3 |

---

## 6. Languages

* 8 languages: **English, Nederlands, Deutsch, Francais, Espanol** (shown as "Español"), **Italiano, Magyar, Greek** (shown as "Ελληνικά").
* Files: `language/<Name>`, with no extension. Mostly UTF-8; `Italiano` is ISO-8859-1 with CRLF. `Francais.dat` is an unused older copy.
* Format: **plain text, one string per line, purely positional.** 192 lines, of which 179 are read in a fixed order. There are no keys, so every translation must keep the exact line order.
* Some UI strings are hard-coded English and not translated: "Primary", "Secundary", the "Free/Archery/CountDown/Timer" banner, scenario summary words ("sec", "manual", "X Finalround ind./team").
* English line map (line → use). Lines marked *(hw)* or *(follow)* can be dropped:

| Lines | Use |
|---|---|
| 1 | "End" label |
| 2 | "Arrow" label |
| 3 | Practice marker "P" |
| 4 | "Turn" label |
| 5 | Double-ends checkbox |
| 6–9 | "Seconds Green / Orange / Red / Total" |
| 10 | "Archers per target" |
| 11 | "Archer" |
| 12 | "Settings" |
| 13 | "Minutes / Seconds?" |
| 14 | "Save as startup setting." |
| 15 | "Hide Icons." |
| 16 | "Use PC speaker for Buzzer." |
| 17 | "Waiting time." |
| 18 | "Shooting time:" |
| 19 | "Shoot off time (per arrow):" |
| 20–24 | Layout names [A]…[AB-CD] |
| 25–36 | Preset descriptions shift-F1…F12 |
| 37 | skipped |
| 38 | "Practice ends" |
| 39–41 | System names "FITA", "FITA Finals (Alternating)", "25m1p" |
| 42 | "Timing" |
| 43 | "Shoot off timing" |
| 44 | "Timing and sequence" |
| 45–46 | "Double time", "Double turns" |
| 47 | "show:" |
| 48 | "Target number" |
| 49–50 | skipped |
| 51 | "Left side-Right side" |
| 52–53 | per-arrow / per-end radio |
| 54 | "Turns per end." |
| 55 | *(hw)* |
| 56 | "Choose" |
| 57–68 | "Save current settings as Fn settings." |
| 69 | *(hw)* |
| 70 | "Match starts in" (hint) |
| 71 | "Minutes" |
| 72 | "min." |
| 73–77 | Tab names (screen layout, Sound, Scenario, Countdown to start match, Language) |
| 78 | "Traffic Light" |
| 79 | "Use traffic light on screen" |
| 80 | "Show hints" |
| 81 | "Sound via PC speaker" |
| 82 | "Test" |
| 83 | Countdown caption |
| 84 | "start" |
| 85–86 | "Menu disappears after", "Seconds" |
| 87–94 | Tooltips: previous/next end, Stop, Pause, Resume, Start Timer, Next archer, Stop last turn of this end |
| 95 | *(hw)* |
| 96–97 | Previous/next archer |
| 98 | "Reset to first (practice) end." |
| 99–102 | "Activate Archer A–D" |
| 103–104 | Resize, Close |
| 105–106 | Main hints 1, 2 |
| 107–108 | "Left side", "Right side" |
| 109 | "Match starts in" (panel title) |
| 110–111 | Select right/left archer |
| 112–113 | Main hints 3, 4 |
| 114–117 | *(hw)* |
| 118 | Countdown-between-ends checkbox |
| 119 | "Start every end with sequence AB...." |
| 120 | "About" |
| 121 | *(hw)* |
| 122–124 | Manual select red/orange/green |
| 125–127 | One/two/three signals |
| 128 | Emergency tooltip |
| 129 | "sound signals" |
| 130–132 | Manual red/orange/green settings captions |
| 133–138 | *(hw)* |
| 139 | "Manual" |
| 140 | *(follow)* |
| 141 | **Emergency screen text "Stop"** |
| 142–145 | *(follow)* |
| 146–152 | *(hw)* |
| 153–155 | Finals view: left screen / right screen / both screens |
| 156–158 | *(follow)* |
| 159–160 | Activate Archer E/F |
| 161–164 | Layout names A–E, A–F, AB-CD-EF, ABC-DEF |
| 165 | "Always start with archer nr 1." |
| 166–167 | skipped |
| 168–172 | *(hw/LAN)* |
| 173 | "Top-Bottom" |
| 174–177 | "T", "op", "B", "ottom" |
| 178 | "Practise Arrows" |
| 179 | "Select" (prefix for scenario buttons) |
| 180–192 | unused |

Recommendation: move to keyed resources (JSON/PO) in the rewrite, using the English file to seed the keys.

---

## 7. Operator controls

### 7.1 Keyboard

The keys **S, P, E, 1–6, C, H, M** are ignored while the timing menu or settings dialog is open.

| Key | Non-finals (FITA / 25m1P) | Finals | Manual |
|---|---|---|---|
| **Space** | Next (see state table) | Next | — |
| **PageDown** | Next (presenter-remote friendly) | No side chosen: choose **right**; else Next | — |
| **PageUp** | **Emergency stop** | No side chosen: choose **left**; else clear selection (WAIT only) | Emergency |
| **S** | Stop | Stop | — |
| **P** | Pause / resume toggle | Pause / resume | — |
| **E** | Emergency stop | Emergency stop | Emergency |
| **1–6** | Shoot-off with N arrows (only when the timer is not running) | (no effect) | — |
| **C** | Start match-start countdown (WAIT only) | — | — |
| **↑ / ↓** | End +1 / −1 (crosses the practice boundary) | Arrow counter +1 / −1 (1…turns) | — |
| **→ / ←** | Turn +1 / −1 (wraps into next/previous end) | Make right / left side active (swaps timers if running) | — |
| **H** | Toggle hide icons | same | same |
| **M** | Toggle seconds / minutes display | same | same |
| **Esc** | Toggle full screen / 640×480 window | same | same |
| **F1–F12** | Load user scenario Fn | same | same |
| **Shift+F1–F12** | Load built-in preset | same | same |

The end/turn navigation keys work in **any state**, including while the clock is running. They only change counters and display; the running countdown is untouched.

### 7.2 Mouse / buttons

| Control | Action |
|---|---|
| Next icon, banner image, website label | Next |
| Play/pause icon | Pause / resume |
| Stop icon | Stop |
| Danger icon | Emergency stop |
| SO icon | Shoot-off, 1 arrow |
| Hourglass / "N min." label | Start match-start countdown |
| End −/+ icons | End −1 / +1 |
| Turn −/+ icons | Turn −1 / +1 (finals: choose left / right) |
| Click end number or "P" | Reset to end 1 / turn 1 / practice |
| Click a detail letter | Make that letter's turn current (1/turn: slot n; 2/turn: ceil(n/2); 3/turn: ceil(n/3)) |
| 25m1P: click "Archer" / number | Turn −1 / +1 |
| Click digits | Toggle hide icons (finals both-screens: choose that side) |
| Finals: grey arrows | Choose side; "Choose" button clears the selection; Primary/Secondary labels swap start side |
| Manual: lamps or R/O/G buttons | Set light (+ configured beeps); 1/2/3 buttons beep |

### 7.3 State machine (non-finals)

States: **W** = WAIT (1), **R** = RED (2), **G** = GREEN (3), **O** = ORANGE (4), **M** = MATCH-START COUNTDOWN (5). There is also a `paused` flag (timer stopped) in states R, G, O and M.

**Double-press guard.** A 2 s window (`endtimout`) starts after Pause/Resume, Stop, end-of-end and every finals switch. While it is active, Next and Stop are ignored, and the countdown can't start manually.

| From | Event | To / effect |
|---|---|---|
| W | Next | R (redTime, or SO red), 2 beeps. If red = −1: R paused at 0. |
| W | C | M (tostart·60 s), silent |
| W | 1–6 / SO | Shoot-off flag + same as Next |
| W | Stop | W, 3 beeps |
| W | Pause | no change (but arms the 2 s guard) |
| M | expires | R, 2 beeps |
| M | Next | R, 2 beeps |
| M | Stop | W, silent |
| R | expires | G (or O if green = 0), 1 beep, time = times·(green+orange) |
| R | Next | ignored (unless paused → resume) |
| G | remaining ≤ orange (FITA) / = orange (others) | O, silent |
| G/O | expires or Next | **finalize turn**: if last turn of end (or shoot-off) → W, 3 beeps, end advances (§2.3/2.4), turn = 1, optional auto countdown (M). Else → turn+1, R, 2 beeps. |
| R/G/O/M | Pause (P) | paused. **Next/Space while paused = resume.** |
| R/G/O | Stop | W, 3 beeps; end/turn **unchanged** (the turn will be repeated); shoot-off cleared |
| any | Emergency | see below |

**Emergency stop.** The timer stops and the screen flashes "Stop" with 4 beeps. While the beeps play, Next and the countdown are blocked. Then the clock goes to WAIT with the timer at 0 and shoot-off cleared.
* If the clock was in **G/O on the last turn of the end**, the end is **finalized** (counter advances) as well.
* Otherwise end and turn are unchanged.

**Finals state machine:** see §2.8. Pause and Stop behave as above. Next in G/O switches sides.

---

## 8. Timing precision and other non-obvious behaviour

* **Tick.** The countdown timer fires every **100 ms**. Each tick compares the wall clock with a reference time:
  * When at least 1 s has elapsed past the reference, the counter decrements and the reference advances by exactly 1 s.
  * This keeps the countdown drift-free. If the UI stalls, it catches up at up to 10 steps per second.
  * The original compares localized `TimeToStr` strings against a hard-coded list of "zero" spellings for various locales. Don't copy this; use a monotonic clock and a deadline.
* **Start.** On Next the reference = now, so the first value is held for a full second.
* **Resume.** On resume the reference is set to now + 1 s. The fraction of a second elapsed before the pause is lost, and the first decrement after resume may come up to about 2 s later. Not verified at runtime.
  * Rewrite recommendation: keep the remaining milliseconds across a pause and resume exactly.
* **Pause during preparation (red)** is allowed and freezes the red countdown. Next/Space or P resumes it. Pause in WAIT does nothing.
* **Stop never advances** the end or turn. Next during green/orange is the way to end a turn early and advance.
* **Navigation while running:** changing the end or turn with the arrow keys mid-turn changes the letters shown immediately but not the timer.
* **No direct time adjustment.** There is no "add/subtract seconds" or "restart this turn" control; restarting means Stop then Next.
* **Field / 3D / clout:** there are no dedicated modes. `[A]` with suitable times is the closest. There are no archer names; the only identifiers are letters A–F, Top/Bottom, archer numbers 1–6 (25m1P) and target numbers (finals).
* **Practice is per system:** switching system re-arms practice.
* **Double time / double turns + practice:** practice ends step by `times` (§2.3).
* **Display overflow:** seconds mode shows 3 digits (max 999). Minutes mode shows M:SS with the minutes digit mod 10.
* **Finals "green = 0" check** uses the FITA green value (quirk, §2.8).
* **Manual / Follow modes** disable Next, Pause, Stop and navigation.
* **Startup:** read the settings file (creating the factory one if missing), apply the language, apply the startup scenario, then go full screen after 1 s. It starts in WAIT, end 1, turn 1, practice active if configured.

---

## 9. To DROP in the rewrite (hardware / serial / network / follow)

* **Velleman K8055 USB card** (`K8055D.dll`): all digital/analog output of lamps, the buzzer and the ABCD lights; "Use BCD lights as ROG lights on right side" (`BCDtoROG2`); card address handling.
* **Arduino / USB-serial** (`SdpoSerial`, `switchbox`): the 16-bit word protocol for digits, lights, details and end number; COM port selection; serial input of **5 external hardware buttons** mapped to actions (`HWbutton1..5`: red/orange/green/1–3 signals/emergency; defaults 3 signals, emergency, red, orange, green); refresh timers.
* **Network (LAN)** (`lNet` UDP/TCP): broadcasting state on port `4665`/`25220`/`25221`, PC name, client accept/receive.
* **Follow mode** (`archerysystem='follow'`): mirroring another clock's display over serial or LAN, with left/right screen selection and host name.
* **25m1P "Use ABCD lights for first 4 archers"** (hardware lamps only).
* Hardware tab, USB/connect icon, the "Connecting/Connected/Card not found" strings, and the hardware-off sequence on close.

**Keep** everything else, including **Manual mode**, which is on-screen and drives sound and lights manually.
