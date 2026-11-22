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
- [x] GDD.md  - [x] Economy.luau / GamePasses.luau / Products.luau  - [x] **User approval** (G1 ✔)

## Phase 2 — Scaffold (rbx-engineer)                      Gate G2
- [x] new_game.sh  - [ ] Disable demo Collectibles, Power leaderstat, content config skeletons  - [ ] check.sh PASS

## Phase 3 — Build (parallel per milestone)                 Gate G3
### rbx-engineer (services ≤ 300 lines each)
- [ ] M1 TrainingService (+x2 Pulse, offline earnings) · MinigameService · ZoneService · MonsterService · GunService · LootService · InventoryService · ForgeService
- [ ] M2 ArmorService (in Forge) · PetService (fusion, equip, golden/rainbow) · RebirthService · IndexService · CodesService · WorldBossService
- [ ] M3 ArenaService (queues, matches, normalized stats, Elo) · TournamentService · ClanService (DataStore + MemoryStore, clan war board)
- [ ] Client: GunController (aim, auto-fire, tracers), TrainingController, MinigameController, ForgeController (assembly QTE), FusionController (hatch), ArenaController
### rbx-world-builder
- [x] (code: MapService, ZoneLightingController) Hub layout (pads, booths, forge, altar, rebirth, arena portal, clan hall, boss pit) · 5 zones + portals + gates · 3 arena maps · per-zone presets
### rbx-3d-artist
- [x] Gun builder (6 types, parametric, make_gun.py) · 15 monsters + 5 bosses · 18 pets · forge/altar/pads/portals · VFX meshes (FBX in art/blender, renders in art/renders; ids pending Studio upload)
### rbx-ui-designer
- [x] Theme palette · [x] icons (31) + rarity frames + vfx tracer/muzzle · [ ] Training HUD + x2 button · 3 minigame screens · Forge QTE · Hatch · Inventory/Index · PvP/Tournament/Clan panels · [x] thumbnail + icon

## Phase 4 — Integrate (rbx-engineer)                       Gate G4
- [ ] Assets in ReplicatedStorage.Assets · ids in configs · 2-player Studio test of full loop

## Phase 5 — QA (rbx-qa)                                    Gate G5
- [ ] check.sh --release · exploit review (shooting, minigame scores, forge, trades) · perf · purchase test

## Phase 6 — Launch
- [ ] Passes/products on Creator Hub · thumbnail/icon · description · 4-week roadmap (W1 balance, W2 zone 6, W3 2x weekend + event pets, W4 trading)

## Log (newest first)
- qa (Update 1 review, check.sh PASS): MAJOR RaidService.removeMember — raid emptied mid-run left monsters alive + slot reused → now Remove()d. MAJOR GunService reload race (fire at reloadUntil before delay cb restarted reload; cb could refill mid-mag) → lazy refill + guard. MAJOR SpinService trusted client paid flag (stale UI charged 25 Gems while free spin ready) → forced to free. MINOR Raid shop title "Raid Slayer" was not a Titles id (no tag, unequippable) → raid_slayer + owned flag. MINOR StationService portals now blocked while in a raid. MINOR ForgeController enchText sub(6) cut a UTF-8 bullet → sub(8).
- qa open MINOR: HudController sprint multiplies WalkSpeed client-side (server resets drift; speed is client-trusted anyway); gun swap resets mag (instant reload, rate-limited by Equip); raid arenas show "Training Hub" lighting banner (ZoneLighting.locate has no raid case); Enchant tab does not re-render after roll; ammo/HUD text rebuilt every RenderStepped (cheap).
- qa: season/story/achievement/raid claims are all server-derived, flagged before grant, and written via DataService.Update; title equip validated against title:<id>. Studio steps: solo raid (die/leave/rejoin -> no reward, slot reusable), spin free+paid, season claim twice, enchant with 1 core, reload at 60 FPS and 20 FPS, LowFx on (no muzzle light/streaks), portal use in raid.
- Director: fixed open MINORs (pending match with leavers, TourJoin dequeues). Remaining launch tasks: ids/icons on Creator Hub, Studio playtest.
- qa: code review of new services/controllers (check.sh PASS; --release only fails on placeholder ids/icons = launch task). Findings:
  - MAJOR MinigameService:~78 / ForgeService:~100 — NaN score/perfects from client passed clamp -> NaN Power/quality saved -> fixed (reject NaN)
  - MAJOR PlayerService.AddPower — NaN/inf amount corrupted saved Power -> fixed (guard `not (amount > 0)`)
  - MAJOR TrainingService offline() — lastSeen not consumed on join: quick rejoin re-paid offline Power -> fixed (reset on load + on leave)
  - MAJOR ClanService load/Loaded — transient DataStore read failure cleared player's clan; failed modify wiped cache -> fixed (fetched flag, no cache on failure)
  - MAJOR ClanService handlers — concurrent Create/Accept (yield in filter/UpdateAsync) double-charge / double-join; nil member index threw to client -> fixed (per-player guard + pcall, refund on failed create, stale-clan Leave)
  - MINOR InventoryService.SyncSoon — full inventory resent up to 6x/s on drops -> debounce 0.4s
  - MINOR TournamentService — cancelled signup never broadcast (client kept JOIN) -> fixed; leaver's entry fee stays in pot (by design)
  - MINOR ArenaService — pending match with a player who left waits for arena, TourJoin while queued can double-book; Studio w/o Map.Arena stalls tournament up to 600s -> open
  - MINOR MinigameService — TargetRush/Reload score is client-reported (capped, min duration, 120s cooldown; worst case = 60s of training) -> accepted
  - MINOR PetsController — LowFx hides other players' pets without destroying them (cosmetic) -> open
- ui-designer: store art done: art/store thumbnail+icon (A) and art/store/v2 (B, A/B test); make_thumbnail.py gained --ray-alpha + hero hot-spot. Upload to Creator Hub pending.
- 3d-artist: make_gun.py + blob/drone styles + 4 props added; 12 guns, 20 monsters, 18 pets, 7 props, 5 vfx FBX + hero.png/guns_sheet.png generated, all within tri budget (see ASSETS.md).
- world-builder: MapService/MapParts build workspace.Map (Hub, 5 Zones+gates+roads+landmarks, 3 Arenas) in code; ZoneLightingController applies per-zone presets + banner; StarterMap disabled.
- ui-designer: Theme neon restyle (+Energy/Forge/Gold/Rarity), 19 new icons, 5 rarity frames, tracer+muzzle VFX generated; ids pending upload (ASSETS.md).
- G1 approved by user → Phase 2 + M1 started.
- world-builder: linear lane rebuild: Hub arch "ADVENTURE ->" + Portal_<zoneId> x5 + Hub.TrainingDummies/Dummy1..6; Zones.<id>{Ground,SpawnArea,Gate,ReturnPortal_<id>,SideWalls,Bridge,Scenery,Landmark}; presets DesertDusk/FrostHaze/MagmaGlow/VoidNeon (+DepthOfField/SunRays all); ZoneLightingController tweens all props ~1s.
