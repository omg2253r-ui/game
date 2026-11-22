# {{GAME_NAME}} — Production Plan (single source of truth)
Every agent reads ONLY its own section + "Shared decisions". Tick boxes when done; add 1-line notes.
Gate rule: a phase starts only after the previous gate is ticked by rbx-director (and the user for G1).

## Shared decisions (filled by director, rarely changed)
- Slug: {{SLUG}} · Genre: · Preset: · Palette: #......, #......, #......
- Currencies: Coins (soft), Gems (premium) · Fonts: FredokaOne / GothamBold
- Perf budget: ≤ 8k parts streamed, ≤ 150 unique meshes, ≤ 30 live particles per effect, mobile 60 fps

## Phase 1 — Design (rbx-director + rbx-economy)          Gate G1: user approves GDD
- [ ] GDD.md written (1 page)  - [ ] Economy table in Config/Economy.luau  - [ ] Pass/product list

## Phase 2 — Scaffold (rbx-engineer)                      Gate G2: template runs in Studio
- [ ] new_game.sh done  - [ ] Settings/World config  - [ ] check.sh PASS

## Phase 3 — Build (parallel)                              Gate G3: feature complete
### rbx-engineer
- [ ] Genre service(s): ...
- [ ] Hook genre stats into QuestService.Progress / EconomyService.Add
### rbx-world-builder
- [ ] Zones layout + spawn + lighting preset  - [ ] Map grouped in workspace.Map, anchored
### rbx-3d-artist
- [ ] Props (make_asset.py) - [ ] Characters/pets (make_character.py) - [ ] VFX meshes + textures
### rbx-ui-designer
- [ ] Theme.luau palette  - [ ] Icons (make_icons.py)  - [ ] Genre screens  - [ ] Thumbnail + icon

## Phase 4 — Integrate (rbx-engineer + world-builder)       Gate G4: full loop playable
- [ ] Asset ids pasted into configs  - [ ] Assets in ReplicatedStorage.Assets  - [ ] Studio playtest 2 players

## Phase 5 — QA (rbx-qa)                                    Gate G5: no blockers
- [ ] check.sh --release PASS  - [ ] perf checklist  - [ ] exploit checklist  - [ ] purchase test (Studio)

## Phase 6 — Launch (director + ui + economy)
- [ ] Passes/products created on Creator Hub, ids set  - [ ] Thumbnail/icon uploaded  - [ ] Description + tags
- [ ] Update roadmap (first 4 weekly updates)

## Log (newest first, 1 line each)
-
