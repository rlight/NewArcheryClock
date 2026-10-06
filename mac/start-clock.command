#!/bin/bash
# Double-click to start the Archery Clock on a Mac: server (in the background) + full-screen display.
# Quit the display with Cmd+Q. Stop everything with stop-clock.command.
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"; DATA="$ROOT/data"; mkdir -p "$DATA"

PORT=$(python3 -c "import json;print(json.load(open('$DATA/settings.json'))['server']['port'])" 2>/dev/null || echo 8765)
NODE=$(command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1)
if [ -z "$NODE" ]; then echo "Node.js is not installed. Run mac/install.command first."; read -r -p "Press Enter"; exit 1; fi

up() { curl -sf -m 3 "http://127.0.0.1:$PORT/api/info" 2>/dev/null | grep -q '"urls"'; }
if ! up; then
  nohup "$NODE" "$ROOT/server/server.js" >"$DATA/server.log" 2>"$DATA/server-error.log" &
  echo $! >"$DATA/server.pid"
  for _ in $(seq 40); do up && break; sleep 0.25; done
  up || { echo "The clock server did not start. See $DATA/server-error.log"; read -r -p "Press Enter"; exit 1; }
  # keep the display and the Mac awake for as long as the server runs
  caffeinate -dis -w "$(cat "$DATA/server.pid")" &
fi
[ "$1" = "--no-display" ] && exit 0

URL="http://127.0.0.1:$PORT/display/"
PROFILE="$HOME/Library/Application Support/NewArcheryClock/browser-profile"
FLAGS=(--kiosk "--app=$URL" --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required "--user-data-dir=$PROFILE")
for app in "Google Chrome" "Microsoft Edge" "Chromium" "Brave Browser"; do
  if [ -d "/Applications/$app.app" ] || [ -d "$HOME/Applications/$app.app" ]; then
    open -na "$app" --args "${FLAGS[@]}"
    exit 0
  fi
done
# Safari fallback: no kiosk mode, and it needs one click on the page before it will play sound.
open "$URL"
echo "Tip: install Google Chrome or Microsoft Edge for full-screen kiosk mode and automatic sound."
