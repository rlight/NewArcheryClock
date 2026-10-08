#!/bin/bash
# Installs a downloaded NewArcheryClock update. Started by the server (server/updater.js) from a copy
# in data/update/, after the zip's SHA-256 has been verified. Never touches data/.
# Args: APP_DIR ZIP SERVER_PID PORT OLD_VERSION NEW_VERSION DATA_DIR
APP="$1"; ZIP="$2"; SPID="$3"; PORT="$4"; OLDV="$5"; NEWV="$6"; DATA="$7"
LOG="$DATA/update.log"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [helper] $*" >> "$LOG"; }
# tell the server we are running; it only exits once this file exists
echo $$ > "$DATA/update/helper-started"
log "helper running"
NODE=$(command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1)

healthy() {   # the server on PORT answers and reports version $1
  curl -sf -m 3 "http://127.0.0.1:$PORT/api/info" 2>/dev/null | grep -q "\"version\":\"$1\""
}
start_server() {
  cd "$APP" || return 1
  ARCHERYCLOCK_DATA="$DATA" nohup "$NODE" "$APP/server/server.js" >"$DATA/server.log" 2>"$DATA/server-error.log" &
  echo $! >"$DATA/server.pid"
  caffeinate -dis -w "$(cat "$DATA/server.pid")" >/dev/null 2>&1 &
}
wait_healthy() { for _ in $(seq 60); do healthy "$1" && return 0; sleep 0.5; done; return 1; }
app_items() { ls -A "$APP" | grep -vx -e data -e backup; }

log "installing $OLDV -> $NEWV"
for _ in $(seq 30); do kill -0 "$SPID" 2>/dev/null || break; sleep 0.5; done
kill -0 "$SPID" 2>/dev/null && { log "old server still running; stopping it"; kill "$SPID"; sleep 1; }

STAGE="$DATA/update/new"
rm -rf "$STAGE"; mkdir -p "$STAGE"
if ! ditto -x -k "$ZIP" "$STAGE"; then log "unzip failed; starting $OLDV again"; start_server; exit 1; fi
SRC="$STAGE/NewArcheryClock"; [ -d "$SRC" ] || SRC="$STAGE"
if [ ! -f "$SRC/server/server.js" ]; then log "zip has no server/server.js; starting $OLDV again"; start_server; exit 1; fi

BK="$APP/backup/$OLDV"
rm -rf "$BK"; mkdir -p "$BK"
app_items | while IFS= read -r f; do mv "$APP/$f" "$BK/"; done
cp -R "$SRC"/. "$APP"/
chmod +x "$APP"/mac/*.command 2>/dev/null
log "files replaced; starting $NEWV"
start_server
if wait_healthy "$NEWV"; then
  log "update to $NEWV OK"
  # keep the two most recent backups
  ls -1t "$APP/backup" | tail -n +3 | while IFS= read -r old; do rm -rf "$APP/backup/$old"; done
  rm -rf "$STAGE" "$ZIP"
  exit 0
fi

log "$NEWV did not come up; restoring $OLDV"
kill "$(cat "$DATA/server.pid" 2>/dev/null)" 2>/dev/null; sleep 1
app_items | while IFS= read -r f; do rm -rf "$APP/$f"; done
cp -R "$BK"/. "$APP"/
start_server
if wait_healthy "$OLDV"; then log "restored $OLDV"; else log "restore started but $OLDV is not answering; check server-error.log"; fi
exit 1
