#!/bin/bash
# Stops the Archery Clock server and closes the kiosk display.
cd "$(dirname "$0")/.." || exit 1
pkill -f "$PWD/server/server.js" && echo "Server stopped."
pkill -f "NewArcheryClock/browser-profile" 2>/dev/null
rm -f data/server.pid
echo "Archery Clock stopped."
