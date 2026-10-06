#!/bin/bash
# One-time setup for the Archery Clock on a Mac.
#  - installs Node.js with Homebrew if it is missing
#  - optionally starts the clock automatically at login
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"
echo "New ArcheryClock setup"; echo

if ! command -v node >/dev/null; then
  if command -v brew >/dev/null; then
    echo "Installing Node.js with Homebrew..."; brew install node
  else
    echo "Node.js is needed. Install the LTS version from https://nodejs.org (or install Homebrew), then run this again."
    open "https://nodejs.org/en/download"; read -r -p "Press Enter"; exit 1
  fi
fi
echo "Node.js: $(node --version)"
chmod +x "$ROOT"/mac/*.command

read -r -p "Start the clock automatically when you log in? (y/N) " a
if [[ "$a" =~ ^[yY] ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.newarcheryclock.start.plist"
  mkdir -p "$(dirname "$PLIST")"
  cat >"$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.newarcheryclock.start</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$ROOT/mac/start-clock.command</string></array>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
</dict></plist>
PL
  launchctl unload "$PLIST" 2>/dev/null; launchctl load "$PLIST"
  echo "Added to login items (remove with: launchctl unload $PLIST && rm $PLIST)."
fi
echo
echo "Done. Double-click mac/start-clock.command to start."
echo "The first time a phone connects, macOS may ask whether 'node' may accept incoming connections: choose Allow."
read -r -p "Press Enter"
