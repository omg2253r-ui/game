---
name: rbx-gdd
description: Write the 1-page Game Design Doc and the production PLAN.md for a Roblox game (any genre). Use at the start of a new Roblox game or when the core idea changes.
---
# Roblox GDD + Plan

Goal: decide everything cheap (text) before anything expensive (code/art). Max ~1 page each.

1. Ask the user at most 3 questions, only if unknown: genre/idea, target age/vibe, must-have feature. Otherwise assume and state assumptions.
2. Open `rbx-genres` → read only the matching genre section (not the whole file).
3. Fill `roblox/games/<slug>/docs/GDD.md` (template: `templates/GDD.md`). Rules:
   - Hook in one sentence. Core loop must be fun with zero purchases.
   - Reuse template systems (marked ✔) — list only NEW systems.
   - Monetization via `rbx-monetization` rules (3–5 passes, 2–4 products, no pay-to-win PvP).
4. Fill `docs/PLAN.md` phases with concrete, small tasks (each ≤ 1 agent-session). Name the owner agent per task.
5. Fill `docs/ASSETS.md` content rows (key, type, command).
6. Stop at Gate G1: show the user the hook, loop, systems, passes (≤ 15 lines) and wait for approval.
