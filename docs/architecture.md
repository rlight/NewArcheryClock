# New ArcheryClock — architecture and contracts

Rebuild of ArcheryClock 2.4 (see `original-spec.md`) for one Windows or Mac computer driving the range
display(s). Same timing behaviour; no hardware, serial, LAN-broadcast or follow mode.

## Pieces

```
server/                Node.js (no npm dependencies, Node 20+)
  server.js            HTTP: static files, JSON API, Server-Sent Events
  engine.js            the clock state machine (pure: time is passed in)
  config.js            settings defaults, validation, presets, persistence (data/*.json)
public/
  display/             full-screen display host page (kiosk browser on the clock PC)
  control/             web control + settings GUI (any device on the LAN)
  shared/              client helpers shared by display and control (api.js, sound.js)
  themes/<id>/         display themes (theme.json, theme.css, theme.js)
data/                  settings.json, scenarios/F1.json … (created at runtime, git-ignored)
windows/               start/stop scripts, Edge kiosk launcher, firewall + autostart setup
mac/                   start/stop/install .command scripts (Chrome/Edge kiosk, caffeinate, LaunchAgent)
tests/                 node:test unit tests for the engine
```

The **server is the single source of truth**. The display, the PC keyboard (captured by the
display page) and every control page send *commands*; the server runs the state machine and
pushes *snapshots* to everyone. Nothing times anything on the client except sound spacing.

Default port **8765** (setting `server.port`). Display: `http://localhost:8765/display/`.
Control: `http://<pc>:8765/` (redirects to `/control/`).

## HTTP API

| Method | Path | Body / result |
|---|---|---|
| GET | `/events` | SSE stream. Events: `state` (snapshot JSON), `signal` (`{id, count}`), `settings` (full settings JSON, sent on connect and on change) |
| POST | `/api/command` | `{ "cmd": "...", "arg": ... }` → `{ ok, snapshot }` or `{ ok:false, error }` |
| GET | `/api/state` | current snapshot |
| GET | `/api/settings` | full settings object |
| PUT | `/api/settings` | full or partial settings (deep-merged, validated) → saved settings. Changing `round` resets the clock to WAIT end 1 (like the original). |
| GET | `/api/presets` | built-in presets `[{id:"shiftF5", key:"Shift+F5", name, description, round}]` |
| GET | `/api/scenarios` | user scenarios `[{slot:"F1", name, summary, round} | {slot, empty:true}]` |
| PUT | `/api/scenarios/:slot` | `{name?, round?}`; if `round` omitted, saves the current round settings |
| DELETE | `/api/scenarios/:slot` | removes it |
| GET | `/api/themes` | `[{id, name, description}]` from `public/themes/*/theme.json` |
| GET | `/api/anthems` | `[{id, title, performer, file, durationSec, source, licence}]` from `public/anthem/anthems.json` |
| GET | `/api/sounds` | `{ custom: ["file:club-horn.wav", …] }` from `public/sounds/custom/` |
| GET | `/api/info` | `{ version, urls: ["http://192.168.1.50:8765/", …] }` |

## Access control

Requests from loopback (the clock computer) are always allowed. Anything else needs a session cookie
(`ac_session`, 30 days) from `POST /api/login {password}`; otherwise pages redirect to `/login/` and
`/api/*` + `/events` answer 401. Open without a session: `/login/`, `/api/session`
(`{local, authed, required, isDefault}`), `/api/login`, `/api/logout`. `PUT /api/password
{password?, required?, current?}` changes the password (other devices must send `current`; only the
clock computer can set `required: false`). The scrypt hash and sessions live in `data/auth.json`, never
in settings. Default password: `archery`. 5 wrong tries from an address → one try per 5 s for 10 min.

## Commands (`POST /api/command`)

| cmd | arg | Meaning (original key) |
|---|---|---|
| `next` | – | Space / PageDown: start, next detail, finish turn early, resume when paused |
| `pause` | – | P: pause / resume toggle |
| `stop` | – | S |
| `emergency` | – | E |
| `pageUp` / `pageDown` | – | PageUp / PageDown keys: the server applies the mode-dependent meaning (non-finals: emergency / next; finals: choose left / right when no side chosen, else clear / next) |
| `shootoff` | 1–6 | keys 1–6 |
| `countdown` | – | C: match-start countdown |
| `endUp` / `endDown` | – | ↑ / ↓ (finals: arrow counter) |
| `turnUp` / `turnDown` | – | → / ← (non-finals) |
| `resetEnd` | – | click end number |
| `selectSlot` | 1–6 | click detail letter |
| `finalsSide` | `"left"`/`"right"` | finals ← / → / PageUp / PageDown when unchosen |
| `finalsClear` | – | finals "Choose" (WAIT only) |
| `finalsSwap` | – | swap Primary/Secondary (WAIT only) |
| `manualLight` | `"red"`/`"orange"`/`"green"` | manual mode lamp + configured beeps |
| `manualSignal` | 1–3 | manual mode beeps |
| `toggleFormat` | – | M (seconds ↔ minutes; persisted) |
| `toggleIcons` | – | H (hide on-screen hints/labels; persisted) |
| `loadPreset` | `"shiftF1"`…`"shiftF12"` | Shift+F1…F12 |
| `loadScenario` | `"F1"`…`"F12"` | F1…F12 (falls back to matching preset if empty) |
| `testSound` | – | plays 1 signal on displays |
| `anthemPlay` | anthem id (optional; default `settings.anthem.choice`) | displays play the national anthem; emergency stops it |
| `anthemStop` | – | stop the anthem |

## Snapshot (SSE `state`, also `/api/state`)

Pushed on every change and at least every 250 ms while a timer runs.

```js
{
  seq: 123,                    // increments on every push
  serverTime: 1730000000000,   // ms epoch
  system: "fita" | "finals" | "25m1p" | "manual",
  phase: "wait" | "red" | "green" | "orange" | "countdown" | "emergency",
  paused: false,
  hold: false,                 // phase is an untimed -1 hold waiting for Next
  timeFormat: "sec" | "min",
  seconds: 87,                 // integer to show on the main timer (null = hide digits, e.g. manual)
  remainingMs: 86500,          // precise remaining in this phase (for smooth themes; may be null)
  phaseTotalMs: 120000,        // full length of the current phase (for progress bars)
  digitColor: "idle" | "red" | "green" | "orange" | "blue",
  light: "red" | "orange" | "green" | "off",     // lamp lit on the traffic light
  end: { number: 3, label: "End" | "Arrow", practice: false, visible: true },
  turn: { number: 1, total: 2, visible: true },
  details: {
    kind: "letters" | "topbottom" | "archer" | "none",
    slots: [ { letter: "C", active: true }, { letter: "D", active: true },
             { letter: "A", active: false }, { letter: "B", active: false } ],
    topbottom: null | { big: "T", small: "op" },
    archer: null | 3,
    next: "AB" | null          // group that shoots next (Classic "Next:" badge), null if none
  },
  shootoff: null | 3,          // arrows in the running/armed shoot-off
  finals: null | {
    mode: "perArrow" | "perEnd",
    view: "both" | "left" | "right",
    chosen: null | "left" | "right",   // starting side picked?
    active: null | "left" | "right",   // side currently shooting
    primary: null | "left" | "right",
    arrow: 1, turns: 3,
    showTargets: false, targets: { left: 1, right: 2 },
    left:  { seconds: 20, color: "idle"|"red"|"green"|"orange", light: "red"|"orange"|"green"|"off" },
    right: { seconds: 20, color: "...", light: "..." }
  },
  anthem: { playing: false } | { playing: true, id, title, file, durationSec, startedAt /* epoch ms */, volume },
  emergency: false,            // true while the emergency "STOP" sequence runs (~5 s)
  hint: "Press Space to start the end.",   // operator hint for current state
  canNext: true, canPause: false, canStop: true,     // for enabling control buttons
  display: {                   // the display part of settings, so themes need no second fetch
    theme: "classic",
    trafficLight: true, trafficSide: "right",
    showHints: true, hideIcons: false,
    bannerText: "Lower Providence Rod & Gun Club",  // shown in WAIT (Classic: bottom line)
    clock: "off" | "time" | "datetime",  // time of day (and date) shown in WAIT, from the display PC's own clock
    clock24h: false                      // false = 2:34 PM, true = 14:34
  }
}
```

Colour rules (from the original): WAIT idle grey; red phase red; green lime; orange phase
**yellow**; match-start countdown blue. Emergency: digits hidden, big red "STOP".

## Signals (SSE `signal`)

`{ id: 17, count: 2 }`. Every display host plays `count` signals spaced **1.5 s** apart with
the configured sound; a new signal cancels the rest of a group still playing. Control pages do
**not** play sound (they may show a small visual cue). Counts: start of end/turn 2, red→green 1,
end of end 3, stop 3, emergency 4, finals switch 1, finals end 3, manual per settings.

## Settings (`/api/settings`)

```js
{
  version: 1,
  server: { port: 8765 },
  display: { theme: "classic", timeFormat: "sec", trafficLight: true, trafficSide: "right",
             showHints: true, hideIcons: false, bannerText: "", clock: "off", clock24h: false },
  sound: { enabled: true, sound: "file:Default.wav", volume: 1 },
  anthem: { choice: "navy-solo", volume: 1 },   // sound ids from shared/sound.js or "file:<name>.wav" in public/sounds/custom
  start: { scenario: "shiftF5", countdownMinutes: 4, countdownBetweenEnds: false },
  round: {
    system: "fita",
    fita: { layout: "AB-CD", red: 10, green: 90, orange: 30, practiceEnds: 2,
            doubleEnds: false, doubleMode: "turns", startEveryEndWithAB: false,
            shootoff: { red: 10, green: 30, orange: 10 } },
    finals: { mode: "perArrow", view: "both", showTargets: false, targets: { left: 1, right: 2 },
              perArrow: { turns: 3, red: 10, green: 20, orange: 0 },
              perEnd:   { turns: 2, red: 10, green: 120, orange: 0 } },
    oneArrow: { archers: 6, red: 15, green: 30, orange: 15, practiceArrows: 5, alwaysStartWithArcher1: true },
    manual: { redSignals: 2, orangeSignals: 0, greenSignals: 1 }
  }
}
```

FITA layouts: `"A"`, `"A-B"`, `"A-B-C"`, `"A-B-C-D"`, `"AB-CD"`, `"A-B-C-D-E"`, `"A-B-C-D-E-F"`,
`"AB-CD-EF"`, `"ABC-DEF"`, `"TOP-BOTTOM"`. FITA red/green/orange accept `-1` (= hold).

## Themes

`public/themes/<id>/theme.json`: `{ "name": "Classic", "description": "…", "order": 1 }`.
`theme.css` is loaded by the host; `theme.js` is an ES module:

```js
export default {
  mount(root, ctx) {},      // build DOM inside root (a full-viewport div). ctx: { formatTime(snapshot|seconds, fmt) }
  render(snapshot) {},      // called on every snapshot and on every animation frame while running
  unmount() {}
}
```

Themes must scale to any 16:9 / 16:10 / 4:3 screen (use vw/vh/min()), must not handle input,
must not play sound, and must look right in every phase/system above, including finals
(both / left / right views), 25m1P, Top-Bottom, manual, countdown, emergency, paused (a theme
may show a subtle "PAUSED" mark — the original showed none) and hold.

Built-in themes: **classic** (faithful to ArcheryClock 2.x: black, Tahoma-bold digits,
chrome-ringed round lamps, A–F letters, end/turn numbers, banner) and **retro-led**
(Lancaster/Chronotir physical timer look: dark panel, amber dot-LED 7-segment digits with
faint unlit LEDs, square red/yellow/green dot-matrix lamps, dot-LED detail letters).

## Display host (`public/display/`)

Full-screen page. Responsibilities: SSE connection with auto-reconnect (shows a small
"reconnecting" badge), load/swap themes when `display.theme` changes (no reload), call
`render` on snapshots and on `requestAnimationFrame` while running, play signals
(Web Audio; the kiosk browser is launched with autoplay allowed), keep the screen awake
(Wake Lock API), hide the cursor, and map the keyboard to commands:

Space next · PageDown `pageDown` · PageUp `pageUp` · P pause · S stop · E emergency ·
1–6 shoot-off · C countdown · ↑/↓ end · ←/→ turn (finals: side) · H icons · M format ·
F1–F12 scenario · Shift+F1–F12 preset · Esc nothing (kiosk). Key repeat is ignored.

## Control GUI (`public/control/`)

Works on phone, tablet and desktop. Sections:
1. **Run** — live mini preview of the display (an iframe of `/display/?preview=1`, which
   mutes sound and ignores keys), big Start/Next, Pause, Stop, Emergency buttons, end/turn
   steppers, shoot-off 1–6, match countdown, finals side buttons, manual lamp/signal buttons.
2. **Round** — system picker and every timing field, with presets and a plain-English
   summary ("AB-CD, 2 practice ends, 10 s + 120 s, warning at 30 s").
3. **Scenarios** — F1–F12 slots: save current, load, rename, delete; built-in Shift presets.
4. **Display** — theme picker with live previews, seconds/minutes, traffic light + side,
   hints, banner text.
5. **Sound** — on/off, sound picker with test, volume, custom WAV upload is out of scope v1
   (drop files in `public/sounds/custom/`).
6. **Start-up** — startup scenario, countdown minutes, countdown between ends; connection
   info (URLs for other devices).
