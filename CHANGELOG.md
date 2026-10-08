# Changelog

## 0.1.6

- **Three new display themes:**
  - **Arctic Blast** — the winter series look: northern lights over icy mountains, falling snow,
    ice-crystal lamps and navy shield badges.
  - **Christmas** — snowy night, twinkling tree and presents, ornament lamps, gift-tag letters.
  - **Thanksgiving** — harvest evening with drifting leaves, hay bales and a turkey; lantern lamps on a
    wooden board; "Happy Thanksgiving" between ends.
- Halloween: the time between ends no longer risks running into the pumpkin lamps with wider fonts.

## 0.1.5

- **Fixes choosing a theme on the Display tab.** With six themes, the live preview cards used up all the
  connections a browser allows to one server, so the change you picked was never sent. The previews now
  get their updates from the page itself.

## 0.1.4

- **Fixes the Windows "Install update" button.** The installer is now started independently of the clock,
  and the clock only shuts down once the installer reports that it is running; if it doesn't start within
  15 seconds, the update is cancelled and the clock keeps running.
- **Clocks on 0.1.1–0.1.3 on Windows must install 0.1.4 by hand once** (stop the clock, unzip
  NewArcheryClock-0.1.4.zip over the folder, start it). Later updates then work from the button.

## 0.1.3

- **Halloween theme** (Display tab → Theme): haunted night with a full moon, bats, fog, a graveyard and
  jack-o'-lanterns as the traffic light; the big numbers glow in the phase colour. Looks best with the
  "Chiller" font (installed with Microsoft Office on Windows); falls back to Impact.

## 0.1.2

- **Three new display themes** (Display tab → Theme):
  - **LPYA Sunset** — Lower Providence Youth Archery colours: sunset over the mountains, eagle, pines and
    the shield logo, with big white numbers on a panel tinted in the phase colour and a shield-shaped light.
  - **Stadium** — modern sports scoreboard: huge condensed numbers, phase header (WALK UP / SHOOT / LAST 30)
    and a progress bar that drains as time runs out.
  - **Daylight** — the whole screen turns red, green or yellow with giant numbers; the most visible outdoors.
- Themes now know the length of the yellow warning period, so they can say "LAST 30" exactly.

## 0.1.1

- **Updates from the control page.** The clock checks GitHub for new versions; *Start-up & connection →
  Updates* shows what's new with an **Install update** button (between ends only). Settings, rounds and
  the password are kept, the old version is backed up, and it's put back automatically if the new one
  doesn't start. Optional: install waiting updates automatically when the computer starts.

## 0.1.0

- First release: clock engine (target rounds, finals, 25m1P, manual), Classic and Retro LED themes,
  web control page, national anthem, time of day between ends, password for other devices,
  private-range music controls, Windows and Mac scripts.
