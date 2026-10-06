#!/bin/bash
# Builds release/NewArcheryClock-<version>.zip: the app only (no data/, docs/, tests/, .git).
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -p "require('./package.json').version")
NAME="NewArcheryClock-$VER"
STAGE=$(mktemp -d)/NewArcheryClock
mkdir -p "$STAGE" release
cp -R server public windows mac package.json README.md LICENSE INSTALL.txt "$STAGE"/
find "$STAGE" -name '.DS_Store' -delete
chmod +x "$STAGE"/mac/*.command
rm -f "release/$NAME.zip"
( cd "$(dirname "$STAGE")" && zip -qr -X "$OLDPWD/release/$NAME.zip" NewArcheryClock )
rm -rf "$(dirname "$STAGE")"
echo "release/$NAME.zip ($(du -h "release/$NAME.zip" | cut -f1))"
