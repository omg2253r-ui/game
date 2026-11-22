---
name: rbx-build-game
description: End-to-end pipeline to build a complete, playable, monetized Roblox game/map of any genre with the rbx-* agent team (director, economy, engineer, world-builder, 3d-artist, ui-designer, qa). Use when the user asks to make a Roblox game/map ("สร้างแมพ roblox", "make a roblox game").
---
# Build a Roblox game (team pipeline)

Plan first, build second. Each phase ends at a gate; never skip a gate.

| Phase | Who | Output | Gate |
|---|---|---|---|
| 1 Design | rbx-director (+ rbx-economy) via `rbx-gdd` | GDD.md, PLAN.md, Economy/GamePasses/Products config | **G1: user approves** |
| 2 Scaffold | rbx-engineer | `roblox/tools/new_game.sh <slug> "<Name>" <preset>` + config edits, `check.sh` PASS | G2 |
| 3 Build (parallel) | rbx-engineer · rbx-world-builder · rbx-3d-artist · rbx-ui-designer | genre services, map, assets, UI, thumbnail | G3 |
| 4 Integrate | rbx-engineer | ids wired, assets placed, full loop works | G4 |
| 5 QA | rbx-qa | `check.sh --release`, perf + exploit + purchase checklists | G5 |
| 6 Launch | director + ui + economy | Creator Hub steps, store page, update roadmap | done |

## Token-saving rules (mandatory)
1. **Template first.** The base template already has: session-locked saves, currencies, game passes, dev products (ProcessReceipt idempotent), daily/playtime rewards, daily quests, global leaderboard, analytics/badges, lighting presets, starter map, code-drawn UI (HUD/shop/rewards/quests/settings), effects + low-graphics mode. Edit **Config/*.luau** before writing code. Never rewrite a template service; extend via new service or hooks (`MonetizationService.PerkHooks`, `ProductHandlers`, `QuestService.Progress`).
2. **PLAN.md is the shared memory.** Agents read their own section + "Shared decisions" only, tick boxes, add a 1-line log. No long reports.
3. **Scripts over tokens.** Assets come from `roblox/tools/blender/*.py` and `roblox/tools/art/*.py` (parameters, not hand-written geometry). Validation is `roblox/tools/check.sh`.
4. **Delegate only real parallel work** (Phase 3). Phases 1–2 and 4–6 run inline. Give each subagent: game dir, its PLAN section, the exact files it may touch.
5. Read files with line ranges; don't re-read files you just wrote; don't paste whole files into chat.
6. One genre service per mechanic, ≤ 300 lines each; shared helpers go in `src/shared`.

## Definition of done (all must be true)
- Joins → sees title splash, HUD, map with lighting; core loop playable in < 10 s, no errors in Output.
- Data persists across rejoin; purchases grant correctly (Studio test mode + real ids at launch).
- At least 3 game passes + 2 dev products visible in shop with real icons.
- Mobile layout OK (UIScale), Low Graphics toggle works, 60 fps on mid phone (perf checklist).
- Thumbnail 1920×1080 + icon 512 exported; `check.sh --release` PASS.

## How to run in Studio (tell the user)
Easiest (no installs): `python3 roblox/tools/build_place.py roblox/games/<slug>` → send the `.rbxlx` to the user → double-click → Studio opens it → Play (F5). Rebuild after every code change.
Dev workflow (live sync):
Install Rojo plugin + CLI → `cd roblox/games/<slug> && rojo serve` → Studio: Rojo → Connect → Play.
Game Settings → Security → enable "Studio Access to API Services" to test saving.
