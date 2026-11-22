#!/usr/bin/env bash
# Scaffold a new Roblox game from the base template (cheap: copies files, no AI tokens).
#   ./roblox/tools/new_game.sh <slug> "<Game Name>" [preset]
#   preset = SunnyCartoon | SpookyNight | NeonCity | FantasySunset
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="${1:?usage: new_game.sh <slug> \"<Game Name>\" [preset]}"
NAME="${2:-$SLUG}"
PRESET="${3:-SunnyCartoon}"
DEST="$ROOT/games/$SLUG"
[ -e "$DEST" ] && { echo "exists: $DEST"; exit 1; }

cp -r "$ROOT/templates/base" "$DEST"
mkdir -p "$DEST"/{docs,art/{blender,renders,icons,vfx,store},assets}
SKILLS="$ROOT/../.claude/skills/rbx-gdd/templates"
cp "$SKILLS/GDD.md" "$DEST/docs/GDD.md"
cp "$SKILLS/PLAN.md" "$DEST/docs/PLAN.md"
cp "$SKILLS/ASSETS.md" "$DEST/docs/ASSETS.md"

python3 - "$DEST" "$NAME" "$PRESET" "$SLUG" <<'PY'
import json, re, sys, pathlib
dest, name, preset, slug = sys.argv[1:]
d = pathlib.Path(dest)
s = d / "src/shared/Config/Settings.luau"
s.write_text(s.read_text().replace('GameName = "MY GAME"', f'GameName = "{name.upper()}"'))
w = d / "src/shared/Config/World.luau"
w.write_text(re.sub(r'Preset = "\w+"', f'Preset = "{preset}"', w.read_text(), count=1))
p = d / "default.project.json"
j = json.loads(p.read_text()); j["name"] = slug
p.write_text(json.dumps(j, indent=2) + "\n")
for f in (d / "docs").glob("*.md"):
    f.write_text(f.read_text().replace("{{GAME_NAME}}", name).replace("{{SLUG}}", slug))
PY
echo "✔ created $DEST"
echo "  next: fill docs/GDD.md + docs/PLAN.md (rbx-director), then: cd $DEST && rojo serve"
