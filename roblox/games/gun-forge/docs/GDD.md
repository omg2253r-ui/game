# Gun Forge Simulator — Game Design Doc
Owner: rbx-director · Status: **DRAFT (waiting for G1 approval)**

## 1. Hook
> "AFK-train your Power, blast monsters for loot, and FORGE your own legendary guns, armor and pets — then prove it in the arena."

## 2. Genre & references
- Genre: **Simulator (AFK training + collection)** × **Shooter PvE** × **Arena PvP**. Original IP — no names/art from existing games.
- Closest genre neighbours (for mechanics only): weapon-crafting simulators with pet gacha, gun-RNG dungeon crafters, aim/arena PvP.
- Players: 9–16, mobile-first (≈70 %), sessions 15–40 min, many leave the game running AFK.
- Style: chunky low-poly sci-fi cartoon, neon accents. Preset **NeonCity** for hub/arena, per-zone presets for monster zones.
- Palette: #3ad8ff (energy cyan) · #ff4fd8 (forge magenta) · #ffc935 (loot gold) · darks #16142a.

## 3. Loops
- **Core (30 s):** train (AFK) → tap **x2** when it pops → Power ↑ → shoot monsters → materials drop.
- **Meta (30 min):** materials → **Forge** (assembly minigame) → better gun/armor → unlock next zone → **Fusion Altar** pets → Rebirth.
- **Long (30 days):** collection Index, rebirth tiers, ranked PvP seasons, clan wars, tournaments, events, daily quests/rewards.

## 4. Systems (✔ = template already has it)
✔ Save/data · ✔ Coins/Gems · ✔ Game passes · ✔ Dev products · ✔ Daily + playtime rewards · ✔ Daily quests · ✔ Global leaderboard · ✔ Analytics/badges · ✔ Lighting presets · ✔ UI shell (HUD/shop/settings/low-fx)

New for this game:
| # | System | Key rules |
|---|---|---|
| 1 | **TrainingService** (AFK) | Toggle *Train*; +Power every 1 s (base × pass × pet × rebirth × gun mastery). Works while AFK in hub. |
| 2 | **x2 Pulse** | Every 45–75 s a big **x2** button pops for 6 s; tap → x2 training for 30 s (stacks to x4 with pass). Rewards active players. |
| 3 | **Training minigames** (kill time while AFK) | *Target Rush* (tap targets 20 s), *Reload Rhythm* (timing bar), *Lucky Crate* (pick 1 of 3). Payout: Power burst + Coins + small material chance. Cooldown 2 min each. Server validates score caps. |
| 4 | **Zones & monsters** | 5 zones gated by Power: Slime Meadow → Scrap Desert → Frost Cavern → Magma Foundry → Neon Void. 3 monsters + 1 boss per zone, server-simulated HP, capped spawns (≤ 12/zone), boss respawn 3 min. |
| 5 | **GunService** (shooting) | Hitscan raycast, server-validated (range, fire-rate, line of sight). Damage = gun dmg × Power factor. Mobile auto-fire button, PC click. Client does tracers/VFX/recoil. |
| 6 | **Loot & Inventory** | Drop tables per monster: Common parts, Rare cores, Boss shards. Stackable materials; gun/armor/pet items with unique ids. |
| 7 | **Forge (guns + armor)** | Recipe = materials + Coins. **Assembly minigame**: 3–5 parts slide in, tap on the glow line (Perfect/Good/Miss). Quality → stat roll bonus & rarity bump chance. Rarities: Common, Rare, Epic, Legendary, Mythic. Gun types: Pistol, SMG, Shotgun, Rifle, Blaster, Railgun. Armor: Helmet / Vest / Boots sets. |
| 8 | **Fusion Altar (pets)** | Combine materials into a **Core** → hatch animation → pet (odds always shown). Pets give Power/drop-luck/coin multipliers; equip 3 (+3 with pass). 5 duplicates → **Golden**, 5 golden → **Rainbow**. |
| 9 | **Rebirth** | Reset Power + Coins (keep items) for permanent ×1.5 training and +1 rebirth token (rebirth shop). |
| 10 | **Index** | Collection book of guns/pets/monsters; completion rewards. |
| 11 | **PvP Arena** | Queues: **1v1**, **2v2**, **Team 4v4** (first to 20 kills). **Normalized stats** in PvP (gun type matters, Power/passes don't) → fair, no pay-to-win. Ranked rating (Elo), season rewards = cosmetics/titles. |
| 12 | **Tournament** | Every 30 min server tournament: 8-player bracket 1v1, small Coins entry, prize pool + trophy title + badge. |
| 13 | **Clans** | Create (Coins), join/leave/invite, roles (Leader/Officer/Member), clan tag over head, Clan XP from members' kills/PvP wins, weekly **Clan War** leaderboard (cross-server via OrderedDataStore + MemoryStore), clan perks (+5 % drops per level). |
| 14 | **World Boss** | Every 20 min a giant boss in the hub; everyone damages it; reward by damage share. |
| 15 | **Codes** | Redeem codes from config (social growth). |
| 16 | **Offline earnings** | Roblox kicks idle players after 20 min — on rejoin give capped offline training (≤ 4 h, 25 % rate) so AFK players aren't punished. |
| R2 | Trading (later) | Secure two-step trade window — release 2, after anti-dupe testing. |

## 5. Monetization (never affects PvP)
| Item | Type | R$ | Perk |
|---|---|---|---|
| VIP | Pass | 299 | x1.5 Coins, VIP tag, neon trail, VIP lounge in hub |
| 2x Training | Pass | 199 | permanent x2 Power gain (stacks with x2 Pulse) |
| Auto Farm | Pass | 249 | auto-shoot nearest monster in zones + auto-collect drops |
| +3 Pet Slots | Pass | 149 | equip 6 pets |
| Lucky Forge | Pass | 349 | +1 rarity-bump chance at Forge & Fusion (odds shown) |
| 2x Drops | Pass | 199 | x2 material drops |
| 1,000 / 6,000 Coins | Product | 25 / 99 | currency |
| 120 Gems | Product | 49 | premium currency (cosmetic skins, extra minigame plays) |
| x3 Training 30 min | Product | 39 | boost |
| 700 Gems | Product | 249 | premium currency (+17%) |
| Gem Shop | Gems | 10–60 | x3 boost 10 min, reset minigames, coin crate, material pack |

## 6. World
- **Hub (spawn)**: Training Grounds (pads), Minigame booths, Forge, Fusion Altar, Rebirth statue, Arena portal, Clan hall, World Boss pit, leaderboards.
- Zone portals in a ring around the hub, each locked by Power (0 / 2K / 25K / 300K / 5M). Each zone ≈ 250×250 studs, own preset + landmark visible from hub.
- Arena: separate area (or reserved server for tournaments later); 3 small symmetric maps.
- Budget: ≤ 8k parts visible, everything under workspace.Map, zones streamed.

## 7. Content list (→ ASSETS.md)
- Guns: 6 types × 5 rarities (procedural mesh variations + colour tiers) = 30 · Armor: 3 sets × 5 rarities
- Monsters: 15 + 5 bosses (make_character.py enemy/boss styles, zone colours) · Pets: 18 (pet style variants)
- Props: forge, altar, training pads, portals, crates, crystals, zone decor
- VFX: muzzle flash, tracer beam, hit spark, death poof, x2 pulse ring, forge sparks, hatch burst, level-up aura
- UI: Training HUD (Power, x2 button), Minigame screens ×3, Forge minigame, Fusion hatch, Inventory/Equip, Index, PvP queue/scoreboard, Tournament bracket, Clan panel, Codes

## 8. First 60 seconds
1. Spawn on training pad → "TAP TO TRAIN" → Power ticks up. 2. x2 pops at 10 s (first one guaranteed). 3. Arrow to Slime Meadow (0 Power). 4. Starter pistol kills a slime in 3 shots → material drop. 5. Forge tutorial crafts a Rare pistol with the minigame.

## 9. Success metrics
D1 ≥ 25 %, avg session ≥ 20 min, payer conversion ≥ 2 %, PvP queue time < 30 s.
