---
name: rbx-genres
description: Genre recipe book for Roblox games (obby, tycoon, simulator, tower defense, horror, battlegrounds/fighting, survival, racing, RPG/adventure, roleplay, party/minigames) - core loop, required systems, pass ideas, retention hooks and perf traps. Use when designing or building a Roblox game of a specific genre.
---
# Roblox genre recipes
Read ONLY the section you need (`grep -n "^## " SKILL.md` then read that range).
Each recipe: Loop · New services (beyond template) · Passes/products · Retention · Perf traps.

## Obby / Parkour
- Loop: run stage → checkpoint → next stage; skip/troll obstacles. Stages = Models `Stage_N` with `Checkpoint` part.
- Services: StageService (checkpoint save in data.stats.Stage, respawn at checkpoint, stage counter leaderstat), KillBrickService (tag `Kill` via CollectionService), MovingPartService (TweenService on client for platforms, server only for hazards).
- Passes: Skip Stage (product), Gravity Coil, Speed Coil, Rainbow Trail, VIP. Product: "Skip stage" 15–25 R$.
- Retention: stage leaderboard, daily "speedrun" badge, worlds every 10 stages.
- Perf: animate moving platforms on CLIENT; anchor everything; one Touched per kill brick via tag.

## Tycoon
- Loop: dropper makes ore → conveyor → collector gives Coins → buy buttons unlock droppers/walls → rebirth.
- Services: PlotService (assign plot on join, release on leave), ButtonService (buttons = data `owned[buttonId]`, dependency chain), DropperService (spawn drops on server at low rate OR pure-number income every 1 s — prefer number income + client-only visual drops), RebirthService (reset tycoon, +multiplier).
- Passes: 2x Cash, Auto-Collect, VIP Room, +1 Dropper speed. Products: cash packs, "Instant unlock next".
- Retention: rebirth multipliers, offline earnings (cap 8h) on join, plot decorations.
- Perf: NEVER physical drops on server for every player; cap drops; stream plots.

## Simulator (clicker / pet / mining)
- Loop: click/swing tool → earn → sell/upgrade → new zone → hatch pets for multipliers → rebirth.
- Services: ToolService (cooldown validated on server), PetService (egg hatch with weighted odds, equip ≤ N pets, multiplier sum), ZoneService (gate parts open when owned), RebirthService.
- Passes: +2 Pet Slots, Lucky (x2 rare odds), Auto-Click/Auto-Hatch, Triple Hatch, VIP. Products: Gem packs, Lucky potion (30 min boost).
- Retention: index/collection book, limited-time eggs, boosts, trading (later).
- Perf: pets follow via client-side CFrame lerp (server only stores equipped ids); ≤ 6 pets rendered per player.

## Tower Defense
- Loop: lobby → match → place towers on path → waves → win coins/gems → unlock towers.
- Services: MatchService (TeleportService reserved servers or in-place), WaveService (enemy stats table, spawn timing), EnemyService (path waypoints, enemies are server-simulated as DATA; client renders models), TowerService (place validation, targeting, upgrades).
- Passes: extra tower slot, 2x speed, VIP. Products: summon crate, revive.
- Perf: simulate enemies as numbers on server, replicate positions compactly (FireAllClients every 0.1 s with arrays), client tweens models.

## Horror / Story
- Loop: chapter objectives → puzzle/hide → chase → escape; replay for endings/badges.
- Services: ChapterService (objective state machine), MonsterService (PathfindingService, recompute ≤ 2 Hz), DoorService, CutsceneController (client camera tweens).
- Passes: Flashlight+ / Revive / extra lives, cosmetic lantern. Products: revive.
- Retention: multiple endings, badges, secret collectibles, co-op.
- Perf: SpookyNight preset, fog, few dynamic lights (≤ 8 PointLights with Shadows off), sounds 3D.

## Battlegrounds / Fighting
- Loop: pick character/moveset → fight → kills → unlock movesets/emotes.
- Services: CombatService (server hitbox via GetPartBoundsInBox / spatial query, cooldowns, stun), MovesetService (data-driven moves table), RagdollService.
- Passes: moveset pack, emote pack, VIP server perks. NO stat advantages for Robux.
- Perf: VFX on client only; server sends `Net.fireAll("Fx", moveId, cframe)`; pool VFX parts.

## Survival / Crafting
- Loop: gather → craft → build base → survive night/waves.
- Services: ResourceNodeService (respawning nodes), InventoryService (stack sizes), CraftingService (recipes table), BuildService (grid placement validated on server), DayNightService.
- Passes: bigger backpack, starter kit, VIP. Products: resource bundle.
- Perf: limit built parts per player (e.g. 300), merge static builds, StreamingEnabled.

## Racing / Driving
- Loop: race → coins → buy/upgrade cars → new tracks.
- Services: VehicleService (spawn owned car, network ownership to driver), RaceService (checkpoints, lap times), GarageService.
- Passes: exclusive cars, nitro, VIP garage. Products: cash.
- Perf: car models ≤ 3k tris, network owner = driver, few unanchored parts.

## RPG / Adventure
- Loop: quests → fight mobs → loot → level up → new region → boss.
- Services: LevelService (xp curve `xpNeeded = 50 * level^1.6`), MobService (spawners with caps, server AI simple), LootService (drop tables), EquipmentService.
- Passes: 2x XP, extra inventory, pet companion. Products: XP potion, revive.
- Perf: mob cap per zone (≤ 12), disable AI when no player within 120 studs.

## Roleplay / Town
- Loop: choose job/house → interact → customize → socialize.
- Services: HouseService (claim plot), JobService (paycheck timer), VehicleService, CustomizationService.
- Passes: premium houses, vehicles, pets, VIP area. Products: cash.
- Perf: interiors streamed, doors client-animated.

## Party / Minigames
- Loop: lobby vote → random minigame (60–90 s) → winners get coins → shop cosmetics.
- Services: RoundService (state machine Intermission→Vote→Play→Results), MinigameRegistry (each minigame a module with Start/Stop), SpectateController.
- Passes: double coins, extra vote, VIP. Products: skip intermission? (no) → cosmetics crates.
- Perf: load each minigame map from ServerStorage, destroy after round.
