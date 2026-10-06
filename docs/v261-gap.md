# ArcheryClock 2.6.1 (2.6.1.14, Feb 2025) vs New ArcheryClock: feature gaps

The rebuild implements ArcheryClock **2.4** (`original-spec.md`) plus themes, a web control page,
Mac/Windows scripts, a WAIT-screen clock (`display.clock` off/time/datetime, 12/24 h), an anthem
player, and the 2.6.1 sounds (`ac1.wav` as "Default"). The club actually ran **2.6.1.14**. This
report lists what 2.6.1 does that the rebuild doesn't.

Out of scope, as asked: Arduino, K8055, ESP32/full-matrix/sub-matrix boards, serial,
LAN/multicast/follow/client mode, remote shutdown, Raspberry Pi GPIO and access point.

## Sources and how to read the evidence

| Tag | Source |
|---|---|
| **LANG nnn** | `archeryclock261_14/language/English`, line nnn. It has 332 positional strings; lines 1–179 match 2.4 apart from small wording changes, and lines 180–323 are new. |
| **FORM** | The Lazarus form resource (`TPF0`) parsed straight out of `archeryclock26.exe`: component names, captions and design-time defaults (`Checked`, `Value`, `ItemIndex`, `MaxValue`). Runtime code can override these defaults, so a FORM default is "likely", not "confirmed". |
| **SYM** | Procedure and global-variable names from the exe's debug info (`s.txt`), e.g. `SHOWTIME`, `RECOVERYBEEPS`. |
| **STR** | Literal strings in the exe, e.g. date formats and settings-file tokens. |
| **HIST** | archeryclock.com `software.html`, "Release 2.6 history" (2.6.0.x → 2.6.1.14). |
| **WEB:page** | Other archeryclock.com pages (`additional`, `alternate`, `wa`, `keybmouse`, `pointer`, `app`, `audio`, `elgato`, `touchp`, `scenario`, `25m1p`, `faq`), plus the *User Manual for DOS* (June 2020, written for 2.6) as **DOS pNN**. |
| **IMG** | Site screenshots: `Screen_26_1..4.png`, `timedatescreen.png`, `newtiming.png`, `WAtiming.png`, `alternatetiming.png`, `altsequencemenu.png`, `pretimescreen.png`, `chooseslides.png`, `selectcolor1.png`, `screencolors.png`, `arrowfunctions.png`. |

**Confidence:**
- **confirmed**: two or more independent sources agree, or a source states the behaviour outright.
- **likely**: one good source, or a source plus a strong code clue.
- **guess**: inferred from component or variable names only.

**Size to add to the rebuild:**
- **S**: under a day, a setting plus a few engine lines.
- **M**: one to three days, touching engine, settings, control UI and theme.
- **L**: more than three days, or a new subsystem.

---

## 1. Timing & rules

### 1.1 WA 2022 "30 s per arrow" / "40 s per arrow" (Para, pre-2022) timing buttons (Indoor/Outdoor)
- **What it does:** The Indoor/Outdoor timing panel has a **"Standard times / Default timings"** box with two buttons.
  - **"average 30 sec."** ("WA times averaged per arrow (As of 2022)") sets:
    - shooting: green **60**, orange **30**, total **90**, red **10**;
    - shoot-off: green **0**, orange **30**, total **30**, red **10**. With green 0 the light is yellow from the first second.
  - **"average 40 sec."** ("WA PARA times averaged per arrow. (Also, WA timing before 2022)") sets:
    - shooting: green **90**, orange **30**, total **120**, red **10**;
    - shoot-off: green **10**, orange **30**, total **40**, red **10**.
  - **40 s is still the factory default.** The buttons only fill in the fields, and they do not depend on the double-time / double-turn mode.
- **Evidence:**
  - LANG 317–320.
  - FORM `fitadefaulttimingbox`: `WA22timeruleButton` "average 30 sec.", `WA22timeruleButton1` "average 40 sec.".
  - IMG `newtiming.png` shows 60/30/90/10 and SO 0/30/30/10. IMG `WAtiming.png` shows 90/30/120/10 and SO 10/30/40/10.
  - HIST 2.6.1.9: "easy select buttons added in the menu to select 30 or 40 seconds average timing".
  - software.html: "ArcheryClock version 2.6.1.14 is prepared for new timings. But old timings (40 seconds per arrow) is still the default."
- **Confidence:** confirmed.
- **Size:** S. Two presets in config, two buttons on the control page's Round section. Consider also adding Shift-presets for "AB-CD 90 s".

### 1.2 Alternating finals: default buttons for Individual / Team / Mixed team, each also in a Para version
- **What it does:** Six buttons fill in the sequence and timing, including shoot-off:
  - "individual round", "team round", "mixed team round";
  - "individual round para", "team round para", "mixed team round para".

  Values documented on the site:

  | Mode | Shooting | Turns per end | Shoot-off | Turns in shoot-off |
  |---|---|---|---|---|
  | Individual | 20 s per arrow, time reset each arrow | 3 | same per-arrow time | 1 |
  | Team (3 archers) | 120 s per team per end, time kept between alternations | 2 | 60 s per team | 3 |
  | Mixed team | "2 instead of 3 archers per team, which has impact on timing, sequence and ShootOFF timing" | — | — | — |

  The finals timing box also has "average 20 sec." and "average 30 sec." (PARA) buttons.
- **Evidence:**
  - LANG 249–251, 319.
  - FORM `indfindefbutton`, `teamfindefbutton`, `mxteamfindefbutton`, the `…1` "para" variants, `WAfin20timeruleButton`, `WAfin30timeruleButton`.
  - WEB:alternate: "3 default settings commonly used in WA alternating matches…".
  - DOS p14–16.
  - HIST 2.6.1.9: "Added default buttons in alternating shooting for PARA".
  - IMG `alternatedefaults.png`.
- **Not documented:**
  - Mixed team values. WA rule is 80 s for 4 arrows and a 40 s shoot-off. Guess.
  - Para values. WA Para alternating is 30 s per arrow (software.html: "20 seconds per arrow (30 seconds for Para)"). Team-para totals are a guess.
- **Confidence:** buttons and individual/team values confirmed; mixed and para values guess.
- **Size:** S once the shoot-off below exists.

### 1.3 Shoot-off in alternating finals
- **What it does:** 2.6 adds shoot-offs to finals. The rebuild, like 2.4, has none.
  - Separate **"Turns per end during Shoot Off"**: individual default **1**, team default **3**. Alternation happens per arrow, so a 3-person team alternates 3 times.
  - Team-only **"Shootoff Time"** box. FORM defaults: green 30, orange 30, red 10 (total 60). In individual mode no separate shoot-off time is shown; the per-arrow time is used.
  - Started like a normal shoot-off (SO icon or key 1). Exact trigger in finals not verified.
- **Evidence:**
  - LANG 252–253.
  - FORM `finalturnsSO` (1), `finalteamturnsSO` (3), `groupfinendSO` (30/30/10).
  - HIST 2.6 "Shoot-off functionality added for alternating matches".
  - IMG `altsequencemenu.png`, `alternatetiming.png` (SO 30+30=60).
- **Confidence:** confirmed (trigger likely).
- **Size:** M (engine finals state machine, settings, control buttons, theme labels).

### 1.4 Alternating: signal on switch is now optional, plus a separate "run out of time" sound
- **What it does:**
  - **"Sound signal when changing archer"** checkbox, default **off**. When off:
    - switching sides with **Next** is **silent**;
    - switching because the **time ran out** plays a signal.

    WEB:alternate: "Rationale is that sound is leading … the judge needs to see if an archer shoots the arrow before the sound". When on, every alternation gives 1 signal, which is the 2.4 and rebuild behaviour.
  - **2.6.1.13, "Updated WA rule for 'run out of time' sound during alternating rounds"**: a second sound picker, **"Run out of time sound"** (Settings → Sound, with its own Test button), plays when an alternating timer expires. "NOTE: this is only applicable for alternating shooting." FORM default for `runoutsoundselect` is index 9 = **BUZZER1**. The main sound defaults to AC1.
- **Evidence:**
  - LANG 268, 322.
  - FORM `Beepswitcharcher` (unchecked), `runoutsoundselect`, `testrunoutsound`.
  - SYM `ENDTIMEBUZZER`, `TESTRUNOUTSOUNDCLICK`.
  - HIST 2.6.1.13.
  - Home page news.
- **Confidence:** confirmed. Default run-out sound is likely BUZZER1.
- **Size:** S. Needs one flag on the `signal` event ("timeout" vs "manual"), a second sound setting, and a check box.

### 1.5 Emergency stop: pause and resume, time adjustment, configurable behaviour and beeps
- **What it does:** A new *Emergency* settings tab.
  - **Text on screen:** default "Stop", or an "Alternative text" (free text).
  - **Behaviour after emergency stop** (default first):
    1. **"Pause / stay in emergency state"** (default). The clock freezes in the emergency state and keeps the remaining time. **Next resumes** the turn where it stopped.
    2. **"Stop / stay in the current turn"**. This is the 2.4 behaviour: WAIT, and the turn is repeated.
    3. **"Stop / go to the next turn"**.
  - **Minimum number of signals:** default **5**, range 1–25. 2.4 used 4.
  - **"Keep signals when emergency state is activated":** default off. Keeps beeping until the operator resumes.
  - **Time adjustment while in emergency:** "If time was running while pressing the Emergency function, it is possible to adjust the time left over with arrow keys. The time will continue pressing the next function." There are on-screen "adjust time" up/down icons (`timeup`/`timedown`).
  - **2.6.1.14:** "Added possibility to adjust 'second time' in alternating modes and emergency button pressed (First time adjustment was already possible)". Icons `secondtimeup`/`secondtimedown` adjust the other finals side.
  - The step size per press and which arrow keys do it aren't documented. Probably ↑/↓ = ±1 s (guess).
  - **Esc pressed twice = emergency.** In 2.4, Esc toggled the window.
- **Evidence:**
  - LANG 228–236.
  - FORM `tabEmergency`: `EmergencytxtEdit` "Stop", `Pause_emergency_RadioButton` (checked), `Stop_current_RadioButton`, `Stop_next_RadioButton`, `minnrbeeps` Value 5 Min 1 Max 25, `KeepbuzzingCheckBox`; `timeup`, `timedown`, `secondtimeup`, `secondtimedown` (hint "adjust time").
  - STR settings tokens `Stop|def|pause|notkeep`.
  - WEB:keybmouse.
  - DOS p4 ("Recovering the system can be done by pressing the 'Next' button. But before recovering, the time left over can be adjusted by arrow keys").
  - HIST 2.6.1.14.
- **Confidence:** confirmed (step size guess).
- **Size:** M. The rebuild's emergency is a fixed ~5 s, 4-beep "STOP", then WAIT. This needs a paused-emergency state, resume, ± adjust commands and buttons, and settings.

### 1.6 Make-up (recovery) arrows without preparation time; "recovery needed" end signal
- **What it does:**
  - Keys **1–6** start a shoot-off-timed turn for N arrows (N × shoot-off time) with the 10 s red. This is the same as 2.4 and is documented in 2.6 as "recovery arrows".
  - **Shift+1…Shift+6** start the same turn **without the red/preparation time**, straight to green (2.6.1.3). This only works on the top-row digits, not the numpad. Assignable actions: "1makeup+10 … 6makeup+10" (with red) and "1makeup no10 … 6makeup no10" (LANG 208–209 "Arrow+red time recover" / "Arrow no red time recover").
  - **R instead of Space to finish an end** gives **4** signals instead of 3, meaning a recovery is needed before arrows are retrieved (2.6.1.11).
- **Evidence:**
  - HIST 2.6.1.3, 2.6.1.11.
  - WEB:keybmouse.
  - DOS p6, p21.
  - FORM action list items 29–40.
  - SYM `RECOVERYBEEPS`.
  - FAQ "only the keyboard keys on the left side".
- **Confidence:** confirmed.
- **Size:** S.

### 1.7 Blinking red during preparation
- **What it does:** During the red (prepare-shooting) phase the red light **and the digits blink**, every 500 ms.
  - Setting in the timing menu: "Blink red light during: ☑ Prepare shooting". The default is **on** for all styles.
  - A second option, "Retrieving arrows", exists in the form but is hidden.
- **Evidence:**
  - LANG 246–248.
  - FORM `blinkredgroupbox`: `Blinkphase2CheckBox` "Prepare shooting" checked, `Blinkphase1CheckBox` "Retrieving Arrows" `Visible=False`; timer `blinkingred` Interval 500.
  - SYM `CHECKREDBLINK`, `REDLIGHTON`.
  - HIST 2.6.1.0: "Behavior Red (prepare shooting) updated by blinking red light and digits."
  - WEB:additional: "Since version 2.6 the red light is blinking during the 10 seconds prepare shooting. For all styles."
- **Confidence:** confirmed.
- **Size:** S. Add a setting plus a theme blink driven by `phase==='red'`.

### 1.8 One signal at the start of yellow
- **What it does:** "One beep on yellow" checkbox (Indoor/Outdoor and 25m1P), default off. When on, 1 signal sounds at green→orange. In 2.4 this transition was silent.
- **Evidence:**
  - LANG 245.
  - FORM `orangebeepfitacheckbox`, `orangebeep25m1pcheckbox` (unchecked).
- **Confidence:** confirmed (default likely).
- **Size:** S.

### 1.9 Pause between turns (details)
- **What it does:** "Pause in between Turns" checkbox (Indoor/Outdoor), default off, "added functionality for crossbow matches". When on, the next detail's red does **not** start automatically after a turn ends mid-end. The clock waits for Next.
- **Evidence:**
  - LANG 316.
  - FORM `stopinbetweenturnsfitacheckbox`.
  - HIST 2.6.1.3.
- **Confidence:** likely. Exact screen state while waiting not seen.
- **Size:** S.

### 1.10 "Number of ends repeating this sequence" (Vegas / Kings of Archery rotation)
- **What it does:** A spin box, default **1**, minimum 1. The detail rotation advances only every N scoring ends. Example: AB-CD with N=10 gives ends 1–10 as AB-CD and ends 11–20 as CD-AB.
- **Evidence:**
  - LANG 312.
  - FORM `repeatsequence` Value 1 MinValue 1.
  - WEB:wa: "If sequence is AB-CD and repeating ends is set to 10, the first 10 ends (30 Arrows) sequence AB-CD is used. The second half … CD-AB".
  - DOS p12.
  - SYM `ORGREPEATSEQUENCE`.
- **Confidence:** confirmed.
- **Size:** S. Rotation index becomes `ceil(e / N)`.

### 1.11 "Rotate practice end"
- **What it does:** A checkbox, default off. When on, practice ends rotate like scoring ends; in 2.4 practice was always the base order.
- **Evidence:**
  - LANG 224.
  - FORM `PABCDperEND`.
  - WEB:wa; DOS p12.
- **Confidence:** confirmed.
- **Size:** S.

### 1.12 25m1P timing rule change and split "always start with archer 1"
- **What it does:**
  - 2.6.1.12 changed 25m1P from 45 s to **40 s** shooting time. FORM defaults: red **10**, green **30**, orange **10** (2.4/rebuild: 15/30/15).
  - "Always start with archer nr 1" is now **two** checkboxes, **Practice arrows** and **Counting arrows**, both default on. Rotation can be set separately for practice.
- **Evidence:**
  - HIST 2.6.1.12.
  - LANG 223.
  - FORM `greentime1p` 30, `orangetime1p` 10, `redtime1p` 10, `rotate25m1p` / `rotate25m1p_p` checked.
  - WEB:25m1p.
  - IMG `25m1psequencemenu.png`.
- **Confidence:** confirmed. The site text still says 45 s, but HIST and FORM agree on 40.
- **Size:** S.

### 1.13 Other timing details
- **Ranges.** Green max **480**, orange max **120**, red max 150 (2.4: 450/150/150). FORM `greentime` and `orangetime`. Confirmed. Size S.
- **Countdown to match start.** Max **60 min** (2.4/rebuild: 10). FORM `tostart` MaxValue 60; WEB:additional "up to an hour"; DOS p6. Confirmed. Size S. Minutes display must allow 2 digits; the rebuild does `min % 10`.
- **Alternating team default timing has a warning phase.** FORM team green **90** + orange **30** (= 120, yellow at 30); 2.4 had 120 + 0. IMG `alternatetiming.png` shows 90/30. Likely; the preset buttons may override this. Size S.
- **Shoot-off default.** **10 green + 30 orange** (= 40), shown in IMG `WAtiming.png` and stated in DOS p13 / WEB:wa ("40 seconds (10+30)"). 2.4 and the rebuild use 30 + 10. The form still says 30/10, so the 40-s button / presets set it. Likely. Size S.
- **Green = 0.** Goes straight to yellow in **every** mode including shoot-off (fixed in 2.6.1.9, needed for the 0/30 shoot-off). The rebuild should check its shoot-off path. Confirmed. Size S.
- **"Fast countdown" catch-up removed** (2.6.1.7). A system-clock jump no longer races the timer to zero. The rebuild already uses a monotonic clock (`process.hrtime`). Covered.

---

## 2. Display

### 2.1 Actual time / date: everything found
2.6.1 has **two separate** time features.

**(a) "Actual time / date" slide: a full-screen page in the slide rotation during "retrieving arrows" (WAIT).**
- **Where and when.** Shown in the background-slide area when the clock is in WAIT between ends ("Show large screen images when retrieving arrows"). It is one slide in the rotation alongside the image slides, flipping every *N* s (default 10). The traffic light stays on the side. In this mode the lamps carry information:
  - red lamp lit;
  - middle lamp shows the **end number** (e.g. "P1") with the turn "(1)" under it, if "Show end number when slides are shown" is on;
  - green lamp shows **"Next:"** and the group that shoots next (e.g. "AB").
- **Layout.** From IMG `timedatescreen.png` (2.6.1.0), four centred lines:
  - **time `22:33:44`** in large **red** bold;
  - the weekday **"Monday"** in **yellow**;
  - **"30  September"** (day, then the full month name) in **lime**;
  - **"2019"** in **lime**.

  Form labels: `sheetdatetime2label` "23:30:00" clRed, `sheetdatetime1label` "Zondag" clYellow, `sheetdatetime3label` "12 October" clLime, `sheetdatetime4label` "1969" clLime, all Tahoma bold.
- **Format.** **12/24** vs **am/pm** radio, default **12/24** (`am24_2` ItemIndex 0).
  - Format strings in the exe: `hh:nn:ss` and `hh:nn:ss am/pm` (seconds shown), plus `hh:nn am/pm` and `yyyy`.
  - Weekday and month names come from the **language file**, not the OS locale: LANG 293–299 Monday…Sunday, 300–311 January…December (SYM `DAYNAME`, `MONTHNAME`). The date line is built as "d MonthName".
  - Per-language fixes: German puts a "." after the day (HIST 2.6.1.4); Czech date notation was corrected (2.6.1.2).
- **Updates.** Timer `actualtime` (default 1 s interval), proc `ACTUALTIMETIMER` / `ACTUALTIMERSTATUS` / `SHOWTIME`.
- **Default.** "Actual time" checkbox is **checked** (FORM `Actualtimecheckbox` Checked, settings token `TRUE`). The slide group itself ("Show large screen images…") is also on by default (`slides`).
- **Evidence:**
  - LANG 291, 293–311.
  - FORM as cited.
  - STR `hh:nn:ss am/pm|hh:nn:ss|hh:nn am/pm|yyyy`.
  - WEB:additional: "Next to info slides it is possible to show a slide with actual time and date … you can enable the slide with actual time/date".
  - IMG `chooseslides.png` ("☑ Actual time / date ◉ 12/24 ○ am/pm").
- **Confidence:** layout and defaults confirmed. Which format string goes with 12/24 vs am/pm is likely (`hh:nn:ss` vs `hh:nn:ss am/pm`).

**(b) "Time on screen": a small clock on the normal timing screen.**
- **What.** A checkbox at the bottom of the Screen-layout tab, LANG 255 "Time on screen." (`timecheckbox`, default **off**), with its own 12/24 / am/pm radio (`am24`, disabled until ticked).
  - Drives `Datetimelabel`, a **small, plain (not bold) silver Tahoma** label, caption "[time]". At design time it sits at the bottom-left of the window, just below the icon bar (Left 8, Top 536 in a 717-high form).
  - It is presumably repositioned by `RESIZEWINDOW*` at runtime. It is shown on the main timing screen, not only in WAIT. Probable format `hh:nn:ss` / `hh:nn am/pm`.
- **Evidence:** LANG 255; FORM `timecheckbox`, `am24` (`Enabled=False`), `Datetimelabel` (clSilver, Font.Height −11, not bold); SYM `TIMECHECKBOXCHANGE`.
- **Confidence:**
  - existence and default: confirmed;
  - position (bottom-left, small, silver): likely;
  - shown during running phases: likely;
  - format: guess.

**Rebuild status.** The rebuild shows a **WAIT-only HH:MM clock** (no seconds) with an optional short date ("Mon 30 Sep") in the bottom strip of the Classic theme, using English short names.

**Gaps:**
- (a) the full-screen time/date slide in the slide rotation: big HH:MM:SS, full weekday, "d Month", year, colours as above;
- (b) a small always-on clock during running phases;
- seconds;
- full names.

**Size:** S on top of the slide feature (2.2). Without slides, a "time/date page in WAIT" option is S–M.

### 2.2 Background slides ("Show large screen images when retrieving arrows")
- **What it does:** In WAIT (between ends), the screen shows a **slide show**.
  - **Slides:** the time/date slide (2.1a), then a list of image files.
    - Defaults: `background1.png` (ArcheryClock.com logo, Free Archery Countdown Timer) and `background2.png` (red→yellow→green gradient "ARCHERY CLOCK .COM").
    - Managed with **Add Image / Remove Image** (file dialog). The `backgroundimages/` folder ships empty.
  - **"Flip every N seconds":** default **10** (`slidetime`, `backgroundtimer` 10000 ms).
  - **"Full Screen":** default off. When off, the image fills the area left of the traffic light; when on, the whole screen (IMG `Screen_26_1/2.png`).
  - **"Show end number when slides are shown":** default off in the form; the site screenshot shows it on. It puts the end and turn in the middle lamp. HIST 2.6.1.2, 2.6.1.5: end and arrow number shown in slide mode, including 25m1P.
  - While slides show, the green lamp shows **"Next: AB"** (`Lnexttxt`/`LABCDtxt`, `Lnextturnbg`), and in 25m1P "Archer:" n (`Larchertxt`).
  - Use: club info, sponsors, "commercials" (proc `SHOW_COMMERCIALTIMER`).
- **Evidence:**
  - LANG 256–262, 267.
  - FORM `BGGroupBox` "During retrieving arrows show:", `largeimagecheckbox` (checked), `imagesListBox`, `Addimagebutton`, `Removeimagebutton`, `slidetime` 10, `fullscreencheckbox`, `showendnrcheckbox`.
  - STR `backgroundimages`, `slides|nonfullscreen`.
  - HIST 2.6: "Possibility to show slides (club information or commercials) when retrieving arrows".
  - WEB:additional "Slide shows… By default the timing in between slides is 10 seconds".
  - IMG `chooseslides.png`, `Screen_26_1.png`, `Screen_26_2.png`, `timedatescreen.png`.
- **Confidence:** confirmed. Whether slides start immediately on WAIT or after a short delay is not known.
- **Size:** M. Needs an image upload/list API, a theme slide layer, and lamps-as-info-panel in Classic. Retro LED needs its own treatment.

### 2.3 Banner image
- **What it does:** Settings → Screen layout → **Banner**: "ArcheryClock" (default) or **"Specific Banner"** with **Choose** (file dialog).
  - The image (wide, low; default path `banner2.png`) replaces the "www.archeryclock.com" line at the bottom.
  - Bundled: `banner.png` (grey "www.archeryclock.com" on black) and `banner2.png` (pale-green text plus a target logo, on white).
  - Clicking the banner = Next (2.4 behaviour).
- **Evidence:**
  - LANG 263–265.
  - FORM `Bannerbox`, `defaultbannerRadioButton`, `specificbannerRadioButton`, `Choosebannerbutton`, `specificbannerpath` "banner2.png".
  - SYM `CHOOSEBANNER`, `BANNERAR`, `BANNERSCALING`.
  - WEB:additional "Banner… Select the 'Choose' button to select an image file".
- **Rebuild status:** has `bannerText` (text only).
- **Confidence:** confirmed.
- **Size:** S. Add an upload or pick from `public/banners/`, rendered in place of the text.

### 2.4 Screen colour schemes
- **What it does:** A *Screen Colors* tab with **8 preset schemes** plus **"Adjust colors"** (custom).
  - Presets (IMG `selectcolor1.png`, `screencolors.png`) include black background with coloured digits (default, scheme 1), white background with dark digits, and green or lime backgrounds.
  - Some schemes colour the **whole background by phase**: blue for countdown, maroon/red for red, green for green, olive/yellow for yellow.
  - **Custom** sets a background colour and digit colour per phase, plus active and inactive letter colours. Custom defaults from STR/FORM:

    | Phase | Background | Digits |
    |---|---|---|
    | Prepare match (countdown) | clBlue | clAqua |
    | Retrieve arrows (WAIT) | clBlack | clGray |
    | Red | clMaroon | clRed |
    | Green | clGreen | clLime |
    | Orange | clOlive | clYellow |
    | Active letters ("AB") | — | clLime |
    | Inactive letters ("CD") | — | clRed |
- **Evidence:**
  - LANG 216, 237–242.
  - FORM `colorscheme1..9`, `manualcolorpanel`, `PrepCol/retrCol/RedCol/GrnCol/OrCol/AB/CD` groups.
  - SYM `CHANGECOLORSCHEME`, `BGWAITCOLOR`, `BGREDCOLOR`, `BGORANGECOLOR`, `BGGREENCOLOR`, `BGPRECOLOR`.
  - STR settings `col1…col9`, `clBlue|clAqua|clBlack|clGray|clMaroon|clRed|clGreen|clLime|clOlive|clYellow`.
  - WEB:additional "8 predefined color settings … 9th possibility 'adjust colors'".
  - Credits: "Paolo Neri (Italian Translation / color scheme)".
- **Confidence:** confirmed. The exact colours of presets 2–8 come from screenshots only.
- **Size:** M. Add per-phase colour tokens to the theme contract (`display.colors`), a scheme picker, and custom pickers. Themes partly cover the need.

### 2.5 Seconds display: leading zeros now optional, off by default
- **What it does:** Under "Minutes / seconds?" there is a second radio for seconds mode: **"005"** (leading zeros, 2.4 style) vs **"    5"** (no leading zeros), default **no leading zeros**.
  - In 2.6 the WAIT display shows a single grey **"0"** (IMG `Screen_26_4.png`).
  - Running digits show e.g. "30" (IMG `Screen_26_3.png`).
  - HIST 2.6.0: "time digits layout changed (seconds)" / "Improved layout timing digits".
- **Evidence:**
  - FORM `zerosec` "005", `nonzerosec` "    5" (checked).
  - STR settings `nonzero` / `zero`.
  - SYM `NONZEROSECCHANGE`.
  - IMG as cited.
- **Rebuild status:** always pads to 3 digits (`pad(…,3)` in `display.js`), so it shows "090" and "000" where the club is used to "90" and "0".
- **Confidence:** confirmed.
- **Size:** S.

### 2.6 Countdown-to-start screen layouts
- **What it does:** The *Countdown to start match* tab has a **Layout** choice, **1** (default) or **2**, shown as preview images (`preborder`, `preborder1`).
  - IMG `pretimescreen.png` (2.6.1.0) shows layout 1: blue "[ 4:00 ]" with "Match starts in" / "Minutes", and End/letters/Turn still visible below.
  - Layout 2 not seen.
- **Evidence:** FORM `pretimelayoutbox`, `prelayoutradio1` (checked), `prelayoutradio2`; STR `prelayout1/prelayout2`.
- **Confidence:** existence confirmed; layout 2 look is a guess (probably without the bracket border).
- **Size:** S.

### 2.7 Touch-screen mode: on-screen scenario buttons and button size
- **What it does:** A *Touchscreen mode* tab.
  - **"Scenarios on screen":** default off. Shows **F1–F12 buttons** across the top-right of the display (`F1panel…F12panel`, grey) to tap a scenario.
  - **"Button Size":** magnification of the icon bar, default **2**, range 1–12.
  - 2.6.1.2: "Reshape touchscreen buttons".
- **Evidence:**
  - LANG 225–227.
  - FORM `Touchscreentab`, `Fbutonscreenbox`, `magnification` (1–12, 2), `F1panel…F12panel`.
  - STR `Fnotonscreen` / `FonScreen`.
- **Confidence:** confirmed.
- **Size:** S. The web control page already covers most of the need; this would only add a display-side option.

### 2.8 Smaller display differences
- **Header and version line.** "© 1994 - 2025, Henk Jegers. 2.6.1.14" at the top. Optional. Confirmed (FORM `copyright`).
- **Mode names renamed.** "FITA" → **"Indoor/Outdoor"**, "FITA Finals (Alternating)" → **"Alternating Finals"** (LANG 39–40). The rebuild should use the 2.6 names in the UI. Size S.
- **Startup splash.** "Preparing ArcheryClock. One moment." (FORM `Startuplabel`). Cosmetic.

---

## 3. Controls

### 3.1 Keyboard key settings (remappable keys) and presenter presets
- **Actions.** Settings → **Control settings**. Every remappable key picks from **42 actions**:
  - Next, Stop, Emergency stop, Pause/Play;
  - Previous/left archer, Next/right archer, Previous end, Next end;
  - **Preparation time** (= match-start countdown), **Left field setup**, **Right field setup**;
  - **Next scenario**, **Previous scenario**, Shutdown;
  - 1/2/3 Arrows Shootoff, F1…F12;
  - 1–6 make-up +10 (with red), 1–6 make-up without 10 s red;
  - **No action**.
- **Remappable keys and FORM defaults:**

  | Key | Default action |
  |---|---|
  | **PageUp** | Emergency stop |
  | **PageDown** | Next |
  | **Play button (pressed 2×)** (presenter "start show", i.e. F5 / Shift+F5) | Pause/Play |
  | **Blank button** (**B** or **.**) | Preparation time |
  | **← / →** | Previous/left archer, Next/right archer |
  | **↑ / ↓** | Next end / Previous end |
  | **Numpad** 0, 1, 3, 7, 9, ., +, −, *, / | No action |
  | Numpad 2 | Previous end |
  | Numpad 4 | Left archer |
  | Numpad 5 | Pause/Play |
  | Numpad 6 | Right archer |
  | Numpad 8 | Next end |
  | Numpad Enter | Next |
  | Numpad Backspace | Emergency stop |
  | **Tab** | No action (2.6.1.3 made it Next; 2.6.1.11 made it configurable, default none) |

- **Preset buttons:**
  - **Preference 1** (default arrows), **Preference 2** (↑/↓ → Next, for the Logitech R500 and the Samsung watch app), **Preference 3** (for "specific laser pointer"; mapping not documented).
  - Clickable pointer pictures: **Generic**, **Logitech (R400)**, **Kensington**.
  - **"All buttons next function"** (Viboton PP3000).
- **Evidence:**
  - LANG 183–215, 292, 313–315.
  - FORM `controltab`: `pgupcombox` idx 2, `pgdncombox` 0, `playcombox` 3, `blnkcombox` 8, `left/right/up/downarrowkeycombo` 4/5/7/6, `comboxnumpad*press`, `comboxTABpress` 41, `keyboardpref1..3`, `genericpointer` / `logitechpointer` / `kensingtonpointer`, `nextonlybutton`.
  - HIST 2.6.1.3, .9, .10, .11.
  - WEB:pointer, WEB:app, DOS p20–25.
  - IMG `arrowfunctions.png`.
- **Confidence:** confirmed. "Left/Right field setup" meaning is a guess: probably choosing the finals start side.
- **Size:** M. Add a keymap setting, apply it in `display.js` key handling, and a control-page editor with presets.

### 3.2 Extra fixed keys and key rules in 2.6
| Key | Behaviour | Evidence / confidence | Size |
|---|---|---|---|
| **Esc ×2** | Emergency stop | WEB:keybmouse, DOS p4/p20. Confirmed. | S |
| **R** | Finish the end like Space but with **4** signals ("recovery needed") | HIST 2.6.1.11. Confirmed. | S |
| **Shift+1…6** | Make-up arrows without red | §1.6. Confirmed. | S |
| **B / .** | Preparation time (match countdown) by default. Touch Portal's "prep" button sends **B**. | Confirmed. | S |
| **F5** | Must be pressed **twice** to load scenario F5, because presenters send F5 for "start slideshow" | WEB:scenario, DOS p19. Confirmed. | S |
| **Ctrl+S / Ctrl+T** | Open Settings / Timing menu. While a menu is open **all** clock keys are ignored except these (2.6.1.11). | Confirmed. | n/a (web UI) |
| **Ctrl+End / Ctrl+Home** | Shut down remote / main Raspberry Pi | WEB:keybmouse. Hardware, dropped. | — |

### 3.3 Disable individual F-keys
- **What it does:** Settings → Scenario has a **"Disable F1" … "Disable F12"** checkbox next to each user scenario, all default off.
  - A disabled F-key does nothing, so presenters that send F-keys can't switch scenario mid-match (2.6.1.14).
  - FORM item lists also allow F1–F12 as assignable actions.
- **Evidence:** LANG 323 "Disable"; FORM `DisableF1…DisableF12`; SYM `DISABLEF1CHANGE…`; HIST 2.6.1.14 ("Reason … some laserpointers have F* function connected to a button. Leading to scenario change during a match").
- **Confidence:** confirmed.
- **Size:** S.

### 3.4 "Next scenario" / "Previous scenario" actions
- **What it does:** Assignable actions that step through the scenarios (F1→F2…), so a presenter or Stream Deck can change rounds.
- **Evidence:** LANG 202–203; FORM action list; SYM `NEXTSCENARIO`, `PREVSCENARIO`.
- **Confidence:** confirmed. Whether it wraps or skips empty slots isn't known.
- **Size:** S.

### 3.5 Stream Deck profile: what it sends
- **What it is:** `StreamDeck/ArcheryClock.streamDeckProfile`, a zip holding `manifest.json`.
  - Device model **20GAI9901 = Stream Deck Mini**, 6 keys, `AppIdentifier "*"`.
  - Every key is an Elgato **System → Hotkey** action that sends a keystroke to the focused window. No plugin, no network.

  | Position (col,row) | Icon | Sends |
  |---|---|---|
  | 0,0 (top-left) | grey ◀ | **Left arrow** (Qt 16777234 / VK 37) |
  | 1,0 (top-middle) | yellow ⚠ | **E** |
  | 2,0 (top-right) | grey ▶ | **Right arrow** (VK 39) |
  | 0,1 (bottom-left) | "Shoot OFF" | **1** |
  | 1,1 (bottom-middle) | green ↻ (Next) | **Space** |
  | 2,1 (bottom-right) | ▶/❚❚ | **P** |

  Notes:
  - The `KeyModifiers` fields on the arrow and Space keys are non-zero, but Shift/Ctrl/Alt/Cmd are all false. These are extended-key flags, not modifiers.
  - Each key's second hotkey entry (NativeCode 146) is an empty placeholder.
- **Rebuild status.** All six keys already work with the rebuild's display page, provided the kiosk window has focus: Space=next, E=emergency, P=pause, 1=shoot-off, ←/→=turn ∓ or finals side.
- **Gap.** None functionally. Optionally ship an equivalent profile, which needs re-creating rather than copying the GPL icons. The web control page is the better multi-device route.
- **Evidence:** the manifest; WEB:elgato ("6 buttons (the mini version)… Windows 10").
- **Confidence:** confirmed.
- **Size:** S.

### 3.6 Touch Portal: what it sends
- **What it is:** `touchportal/ArcheryClock.tpz`, a page `ArcheryClock.tml` with 8 buttons, also shipped as separate `buttons/*.tpb` plus `(main).tml`.
  - Every button is a **KEY_PRESS_ACTION** (Touch Portal on the Windows PC injects a keystroke; the phone app is just the remote):

    | Button | Icon | Sends |
    |---|---|---|
    | prep | blue hourglass | **B** (66) = Preparation time / countdown |
    | next | green ↻ | **Space** (32) |
    | play | ▶/❚❚ | **P** (80) |
    | stop | ■ | **S** (83) |
    | emergency | ⚠ | **E** (69) |
    | shootoff | "Shoot OFF" | **1** (49) |
    | left | ◀ | **Left** (37) |
    | right | ▶ | **Right** (39) |

  - `(main).tml` has a second Space button.
- **Rebuild status.** Everything works except **B**, which the rebuild ignores. Its countdown key is C.
- **Gap.** Map B (and ".") to `countdown`.
- **Evidence:** the `.tpb` / `.tml` JSON; WEB:touchp.
- **Confidence:** confirmed.
- **Size:** S.

---

## 4. Sound

### 4.1 Music volume control ("Control audio"), 2.6.0.3+
- **What it does:** ArcheryClock **does not play music itself**. It remote-controls a **VLC media player** running on another (or the same) PC through VLC's Lua **Remote Control (RC) TCP interface**.
  - Settings → Sound → **"Control audio"** with player type **VLC** (a second, disabled ".....").
  - **IP address of audio device:** `localhost`, or `127.0.0.1` in the form.
  - **Port:** **5005** in the settings file, 5000 in the form; range 1024–100000. **Reconnect** button.
  - **Per clock phase**, an **Action** (Play / Pause / Stop) and a **Volume %**. FORM defaults, all with action Play:

    | Phase | Volume |
    |---|---|
    | Retrieve arrows (WAIT) | 100 |
    | Prepare shooting (red) | 67 |
    | Shooting (green) | 33 |
    | Shooting (yellow) | 33 |
    | Before start match (countdown) | 100 |
    | Alarm (emergency) | 0 |

  - Commands sent are VLC RC text: `volume N`, `play`, `pause`, `stop`, `volume 0`.
  - A 50 ms `musicvolumetimer` suggests the volume is **ramped** rather than jumped (guess).
  - Use: louder music while archers retrieve arrows, quieter or stopped while they shoot.
- **Evidence:**
  - LANG 270–282.
  - FORM `audiovolumebox`, `VLCradiobutton`, `AudioIPedit`, `Audioportnumber`, `Audioboxstate1..6` ("Retrieve arrows", "Prepare Shooting", "Shooting (Green)", "Shooting (Yellow)", "Before start match", "Allarm"), `volumestate1..6`, `Playstate*`, `Pausestate*`, `Stopstate*`, `reconnectbutton`, `TCPmusiccntrl`, `musicvolumetimer` 50 ms.
  - SYM `SETMUSICSTATUS`, `MUSICACTION`, `MUSICVOLUME`, `NEWMUSICVOLUME`, `MUSICMUTE`.
  - STR `volume |play|pause|stop|volume 0`, `VLC|localhost|5005|100|play`.
  - WEB:audio (VLC setup: Tools → Preferences → All → Interface → Main interfaces → ☑ Lua interpreter, ☑ Remote control; Lua → TCP command input `musicPC:5005`).
  - HIST 2.6 "Control audio level (VLC) depending on clock status (2.6.0.3 and up)".
- **Confidence:** confirmed (ramping is a guess).
- **Rebuild status.** The rebuild has its own *anthem* player (local MP3/OGG files in `public/anthem/`) but no phase-driven background music.
- **Size:** M either way:
  - **Native** (better fit): play a music folder in the display browser with per-phase volume and action;
  - **VLC RC client**: a TCP socket from the Node server.

### 4.2 "Audio toolbar" (mute / next track / previous track)
- **What it is.** The 2.6.1 language file has **"Show audio toolbar"** (LANG 287), "mute" (288), "next track" (289) and "previous track" (290), which suggests an on-screen music toolbar.
- **But it isn't in this build.** **No matching component, event handler or code string exists in the 2.6.1.14 exe**: no toolbar, mute or track controls in the form; no `next`/`prev` VLC commands. Only the `MUSICMUTE` variable hints at it. The site doesn't mention it.
- **Conclusion.** Most likely strings for an unfinished or future feature (2.6.2?). It would have sent `next`/`prev` to VLC, which serves the music.
- **Confidence:** likely **not present** in 2.6.1.14. No gap to close; at most S if wanted with 4.1.

### 4.3 Run-out-of-time sound
See §1.4. Confirmed. Size S.

### 4.4 Sound list and default
- **What changed.** 2.6 adds **AC1** (new factory default; WEB:additional "standard tone till release 2.5 was 'Buzzer1'. As of version 2.6 this is 'AC1'") and **WHISTLE1**.
- **Rebuild status.** Already covered: "Default" = `ac1.wav`, `whistle1` included.

### 4.5 Emergency signal count
See §1.5: minimum 5 (1–25), optional continuous. Size S as part of §1.5.

---

## 5. Other

| # | Feature | What it does | Evidence | Confidence | Size |
|---|---|---|---|---|---|
| 5.1 | **18 languages** | Czech, Chinese, Danish, Dutch, English, Estonian, French, German, Greek, Hungarian, Italian, Norwegian, Polish, Portuguese, Russian, Slovak, Spanish, Swedish (2.4: 8). The display strings that matter are End/Turn/Arrow/P/Stop/Match starts in/Minutes/Next:/Archer:, day and month names. | `language/` (18 files), FORM `Lang`, software.html | confirmed | M for display strings only, L for the whole control UI |
| 5.2 | **Settings menu auto-close + keyboard lock** | All clock keys are ignored while a menu is open (2.6.1.11). | HIST | confirmed | n/a. The web control is separate from the display, so accidental keys on the control page aren't an issue. |
| 5.3 | **Window: full screen / resize** | Same as 2.4. | — | — | covered (kiosk) |
| 5.4 | **Allow remote control (password "archery")**, remote shutdown, access point, multicast | LAN features | LANG 180–190, FORM `TabNetwork` | confirmed | dropped. The web control replaces remote control. Consider a control-page PIN (S). |
| 5.5 | **"When closing this program" shut down remote systems** | Raspberry Pi clients | LANG 321, FORM `Autoshutdowncheckbox` | confirmed | dropped |
| 5.6 | **Manual mode via laser pointer** | Pointer buttons drive manual lights (2.6.1.2) | HIST | confirmed | S, falls out of §3.1 |
| 5.7 | **"Left/Right field setup" actions** | Probably choose the finals start side (left/right) from a pointer or button | LANG 200–201 | guess | S |

---

## 6. 2.6.1 features the rebuild already covers

- **Indoor/Outdoor (FITA):**
  - all 10 layouts incl. Top-Bottom and A–F, rotation, Start-every-end-with-AB;
  - double ends (double turns and double time);
  - practice ends, −1 hold values;
  - shoot-off keys 1–6 with red;
  - Stop / Pause / Next semantics.
- **Alternating finals:** per-arrow (individual) and per-end (team), Both / Left / Right views, target numbers, Primary/Secondary, side choice with ←/→ and PgUp/PgDn, side correction while running.
- **25m1P:** archers 1–6, practice arrows, start-with-archer-1 (one switch).
- **Manual mode:** lamps and 1/2/3 signals.
- **Match-start countdown:** blue panel, C key, countdown between ends.
- **Scenarios:** F1–F12 user scenarios, Shift+F1–F12 presets, startup scenario.
- **Display:** seconds/minutes (M), hide icons/hints (H), traffic light on/off and side, "Next:" group badge, emergency "STOP", banner *text*, WAIT clock (HH:MM, optional short date).
- **Sounds:** all 2.6.1 sounds incl. AC1 as Default and WHISTLE1; 1.5 s signal spacing.
- **Control:** PgUp = emergency and PgDn = next (2.6 defaults); Stream Deck and Touch Portal keystrokes (except B, §3.6).
- **Timing:** drift-free; already immune to the system-clock jump fixed in 2.6.1.7.
- **Remote control** of the clock from other devices, via the web control page instead of 2.6's LAN remote and Touch Portal.

## 7. 2.4 behaviours that changed in 2.6.1

The rebuild follows 2.4 in each of these.

| Area | 2.4 (rebuild) | 2.6.1 | Ref |
|---|---|---|---|
| Seconds digits | `090`, WAIT `000` | `90`, WAIT `0` (no leading zeros by default; option for `005`) | §2.5 |
| Red phase | steady red | red light and digits **blink** (500 ms), default on | §1.7 |
| Emergency | 4 beeps, "Stop", then WAIT | ≥ **5** beeps; default **pause in emergency**, adjust time, Next resumes; text configurable; Esc×2 triggers | §1.5 |
| Finals side switch | 1 beep every switch | **silent on Next**, signal only when time runs out (now a separate run-out sound); option for a beep every switch | §1.4 |
| Finals team timing (form default) | 120 + 0 | 90 + 30 (yellow at 30) | §1.13 |
| Shoot-off default | green 30 + orange 10 | green 10 + orange 30 (and 0 + 30 with the WA-2022 button) | §1.1, §1.13 |
| 25m1P timing | red 15, green 30, orange 15 | red 10, green 30, orange 10 (40 s shooting) | §1.12 |
| Countdown max | 10 min | 60 min | §1.13 |
| Timing field max | green 450 / orange 150 | green 480 / orange 120 | §1.13 |
| Default sound | buzzer1 | AC1 (rebuild already uses AC1) | §4.4 |
| Esc | toggle full screen / window | pressed twice = emergency | §3.2 |
| F5 | loads scenario F5 | must be pressed twice | §3.2 |
| Tab | (nothing) | configurable; default nothing (was Next in 2.6.1.3–.10) | §3.1 |
| Arrow keys | fixed | remappable; defaults unchanged (↑ next end, ↓ previous end, ←/→ turn or archer) | §3.1 |
| Practice-end rotation | never rotates | optional "Rotate practise end" | §1.11 |
| 25m1P "always start with archer 1" | one switch | separate switches for practice and counting arrows | §1.12 |
| Mode names | "FITA", "FITA Finals (Alternating)" | "Indoor/Outdoor", "Alternating Finals" | §2.8 |
| WAIT screen with slides on | logo, banner, cycling "Free Archery CountDown Timer" text | slide show (time/date and images); lamps show end no. and "Next: AB" | §2.1–2.2 |
