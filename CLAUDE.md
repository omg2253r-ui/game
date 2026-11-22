# Roblox game studio (rbx team)

This repo contains an AI game-dev team for building Roblox games/maps of any genre.
- Agents: `.claude/agents/rbx-*.md` — director, economy, engineer, world-builder, 3d-artist, ui-designer, qa.
- Skills: `.claude/skills/rbx-*` — `rbx-build-game` is the master pipeline; start there for any "make a Roblox game/map" request.
- Code template: `roblox/templates/base` (Rojo project, playable out of the box). Games live in `roblox/games/<slug>`.
- Tools: `roblox/tools/new_game.sh`, `check.sh`, `setup_tools.sh`, `blender/*.py`, `art/*.py`.

Working rules (save tokens, keep quality):
1. Plan → approve → build. Phase gates in `roblox/games/<slug>/docs/PLAN.md`; G1 needs the user's OK.
2. Config before code; extend the template, never rewrite it. Scripts over hand-written assets.
3. Read only what the task needs (line ranges, one genre section). PLAN.md is the shared memory.
4. Run `roblox/tools/check.sh` before every hand-off.
5. Reply to the user in Thai unless they use another language.
`index.html` at the root is an unrelated web game; leave it alone.
