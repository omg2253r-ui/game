# Gun Forge Simulator — Production Plan (single source of truth)
Every agent reads ONLY its own section + "Shared decisions". Tick boxes when done; add 1-line notes.
Gate rule: a phase starts only after the previous gate is ticked by rbx-director (and the user for G1).

## Shared decisions
- Slug: gun-forge · Genre: AFK simulator × PvE shooter × arena PvP · Preset: NeonCity (hub) + per-zone
- Palette: #3ad8ff, #ff4fd8, #ffc935, dark #16142a · Fonts: FredokaOne / GothamBold
- Currencies: Coins (soft), Gems (premium). Stat: Power (leaderstat). Rarity colours: Common #c8c8d0, Rare #3ad8ff, Epic #b56cff, Legendary #ffc935, Mythic #ff4f6a
- PvP uses normalized stats — passes/Power never apply in Arena/Tournament.
- Perf: ≤ 12 monsters/zone (server HP data, client visuals), ≤ 8k parts streamed, ≤ 30 particles/effect, hitscan only (no physical bullets).
- Content data lives in `src/shared/Config/{Zones,Monsters,Guns,Armor,Pets,Recipes,Minigames,Codes}.luau`.

## Milestones (build order — each is playable on its own)
- **M1 Core loop**: Training + x2 Pulse + 1 minigame, 2 zones, shooting, drops, Forge guns, inventory/equip
- **M2 Progression**: zones 3–5 + bosses, armor, Fusion pets, rebirth, index, other 2 minigames, codes, offline earnings, world boss
- **M3 Social/PvP**: Arena 1v1/2v2/4v4 + rating, tournament, clans + clan war
- **M4 Polish/launch**: thumbnail, balancing pass, QA, Creator Hub setup
- R2 (after launch): trading, events

## Phase 1 — Design (rbx-director + rbx-economy)          Gate G1: user approves GDD
- [x] GDD.md  - [x] Economy.luau / GamePasses.luau / Products.luau  - [ ] **User approval**

## Phase 2 — Scaffold (rbx-engineer)                      Gate G2
- [x] new_game.sh  - [ ] Disable demo Collectibles, Power leaderstat, content config skeletons  - [ ] check.sh PASS

## Phase 3 — Build (parallel per milestone)                 Gate G3
### rbx-engineer (services ≤ 300 lines each)
- [ ] M1 TrainingService (+x2 Pulse, offline earnings) · MinigameService · ZoneService · MonsterService · GunService · LootService · InventoryService · ForgeService
- [ ] M2 ArmorService (in Forge) · PetService (fusion, equip, golden/rainbow) · RebirthService · IndexService · CodesService · WorldBossService
- [ ] M3 ArenaService (queues, matches, normalized stats, Elo) · TournamentService · ClanService (DataStore + MemoryStore, clan war board)
- [ ] Client: GunController (aim, auto-fire, tracers), TrainingController, MinigameController, ForgeController (assembly QTE), FusionController (hatch), ArenaController
### rbx-world-builder
- [ ] Hub layout (pads, booths, forge, altar, rebirth, arena portal, clan hall, boss pit) · 5 zones + portals + gates · 3 arena maps · per-zone presets
### rbx-3d-artist
- [ ] Gun builder (6 types, parametric) in make_asset.py · 15 monsters + 5 bosses · 18 pets · forge/altar/pads/portals · VFX meshes
### rbx-ui-designer
- [ ] Theme palette · Training HUD + x2 button · 3 minigame screens · Forge QTE · Hatch · Inventory/Index · PvP/Tournament/Clan panels · icons · thumbnail + icon

## Phase 4 — Integrate (rbx-engineer)                       Gate G4
- [ ] Assets in ReplicatedStorage.Assets · ids in configs · 2-player Studio test of full loop

## Phase 5 — QA (rbx-qa)                                    Gate G5
- [ ] check.sh --release · exploit review (shooting, minigame scores, forge, trades) · perf · purchase test

## Phase 6 — Launch
- [ ] Passes/products on Creator Hub · thumbnail/icon · description · 4-week roadmap (W1 balance, W2 zone 6, W3 2x weekend + event pets, W4 trading)

## Log (newest first)
- G1 pending: GDD + economy configs drafted by rbx-director/rbx-economy.
