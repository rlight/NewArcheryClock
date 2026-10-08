#!/bin/bash
# Builds release/NewArcheryClock-<version>.zip (+ .zip.sha256): the app only (no data/, docs/, tests/, .git).
#   ./scripts/make-release.sh                 build the current version
#   ./scripts/make-release.sh --bump patch    0.1.0 -> 0.1.1 first (or: minor, major)
#   ./scripts/make-release.sh --publish       also create the GitHub Release v<version> with the zip and
#                                             checksum attached (notes = that version's CHANGELOG.md section).
#                                             Installed clocks offer it as an update from then on.
set -euo pipefail
cd "$(dirname "$0")/.."
BUMP=""; PUBLISH=0
while [ $# -gt 0 ]; do
  case "$1" in
    --bump) BUMP="$2"; shift 2 ;;
    --publish) PUBLISH=1; shift ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
if [ -n "$BUMP" ]; then
  node -e '
    const fs = require("fs"); const p = JSON.parse(fs.readFileSync("package.json"));
    const v = p.version.split(".").map(Number); const k = process.argv[1];
    if (k === "major") { v[0]++; v[1] = 0; v[2] = 0 } else if (k === "minor") { v[1]++; v[2] = 0 } else if (k === "patch") v[2]++; else { console.error("bump: patch|minor|major"); process.exit(1) }
    p.version = v.join("."); fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n"); console.log("version " + p.version);' "$BUMP"
fi
VER=$(node -p "require('./package.json').version")
NAME="NewArcheryClock-$VER"
STAGE=$(mktemp -d)/NewArcheryClock
mkdir -p "$STAGE" release
cp -R server public windows mac package.json README.md LICENSE INSTALL.txt CHANGELOG.md "$STAGE"/
find "$STAGE" -name '.DS_Store' -delete
chmod +x "$STAGE"/mac/*.command
rm -f "release/$NAME.zip" "release/$NAME.zip.sha256"
( cd "$(dirname "$STAGE")" && zip -qr -X "$OLDPWD/release/$NAME.zip" NewArcheryClock )
rm -rf "$(dirname "$STAGE")"
( cd release && shasum -a 256 "$NAME.zip" > "$NAME.zip.sha256" )
# README download link follows the version
sed -i '' -E "s#NewArcheryClock-[0-9]+\.[0-9]+\.[0-9]+\.zip#$NAME.zip#g" README.md
echo "release/$NAME.zip ($(du -h "release/$NAME.zip" | cut -f1)), sha256 $(cut -c1-12 "release/$NAME.zip.sha256")…"

if [ "$PUBLISH" = 1 ]; then
  NOTES=$(awk -v v="$VER" '$0 ~ "^## " v "( |$)" {f=1; next} /^## /{f=0} f' CHANGELOG.md)
  [ -n "$NOTES" ] || NOTES="NewArcheryClock $VER"
  gh release create "v$VER" "release/$NAME.zip" "release/$NAME.zip.sha256" --title "NewArcheryClock $VER" --notes "$NOTES"
  echo "published v$VER"
fi
