-- hp/damage per zone tier. drops: { material, chance 0..1, min, max }. Power reward = small bonus per kill.
-- style/color/size = fallback part-built look (Assets.Monsters.<id> model replaces it when present).
local M = {}
local function mon(id, name, tier, hp, dmg, coins, power, drops, color, size, boss)
	M[id] = { name = name, tier = tier, hp = hp, damage = dmg, coins = coins, power = power, drops = drops,
		color = color, size = size, boss = boss or false, speed = boss and 8 or 12, respawn = boss and 180 or 4 }
end
local C = Color3.fromRGB
-- Tier 1 Slime Meadow
mon("slime", "Slime", 1, 30, 4, 3, 2, { { "slime_goo", 0.8, 1, 2 }, { "slime_core", 0.08, 1, 1 } }, C(120, 230, 90), 3)
mon("big_slime", "Big Slime", 1, 70, 7, 6, 4, { { "slime_goo", 0.9, 2, 3 }, { "slime_core", 0.15, 1, 1 } }, C(90, 200, 160), 4.5)
mon("bouncer", "Bouncer", 1, 50, 6, 5, 3, { { "slime_goo", 0.8, 1, 3 }, { "slime_core", 0.12, 1, 1 } }, C(255, 159, 200), 3.5)
mon("slime_king", "Slime King", 1, 1200, 15, 120, 60, { { "slime_core", 1, 3, 5 }, { "king_jelly", 0.35, 1, 1 } }, C(255, 220, 60), 10, true)
-- Tier 2 Scrap Desert
mon("scrap_bot", "Scrap Bot", 2, 600, 25, 25, 15, { { "scrap_metal", 0.8, 1, 2 }, { "gear_core", 0.08, 1, 1 } }, C(190, 160, 120), 4)
mon("sand_crab", "Sand Crab", 2, 900, 30, 35, 20, { { "scrap_metal", 0.9, 2, 3 }, { "gear_core", 0.12, 1, 1 } }, C(235, 180, 90), 4)
mon("rust_drone", "Rust Drone", 2, 750, 28, 30, 18, { { "scrap_metal", 0.8, 1, 3 }, { "gear_core", 0.1, 1, 1 } }, C(200, 110, 70), 3.5)
mon("sand_titan", "Sand Titan", 2, 24000, 80, 900, 400, { { "gear_core", 1, 3, 5 }, { "sand_titan_shard", 0.35, 1, 1 } }, C(255, 150, 60), 12, true)
-- Tier 3 Frost Cavern
mon("snowling", "Snowling", 3, 3200, 90, 120, 70, { { "frost_shard", 0.8, 1, 2 }, { "ice_core", 0.08, 1, 1 } }, C(235, 245, 255), 3.5)
mon("ice_bat", "Ice Bat", 3, 2600, 80, 110, 60, { { "frost_shard", 0.85, 1, 3 }, { "ice_core", 0.1, 1, 1 } }, C(140, 200, 255), 3)
mon("frost_golem", "Frost Golem", 3, 5200, 120, 180, 100, { { "frost_shard", 0.9, 2, 3 }, { "ice_core", 0.15, 1, 1 } }, C(90, 170, 255), 6)
mon("yeti_lord", "Yeti Lord", 3, 130000, 300, 6000, 2500, { { "ice_core", 1, 3, 5 }, { "yeti_fang", 0.35, 1, 1 } }, C(220, 240, 255), 13, true)
-- Tier 4 Magma Foundry
mon("ember", "Ember", 4, 16000, 400, 600, 350, { { "magma_rock", 0.8, 1, 2 }, { "flame_core", 0.08, 1, 1 } }, C(255, 140, 50), 3.5)
mon("lava_hound", "Lava Hound", 4, 22000, 500, 800, 450, { { "magma_rock", 0.9, 1, 3 }, { "flame_core", 0.1, 1, 1 } }, C(255, 80, 40), 4.5)
mon("forge_brute", "Forge Brute", 4, 30000, 650, 1100, 600, { { "magma_rock", 0.9, 2, 3 }, { "flame_core", 0.15, 1, 1 } }, C(120, 60, 50), 6.5)
mon("magma_overseer", "Magma Overseer", 4, 800000, 1500, 40000, 15000, { { "flame_core", 1, 3, 5 }, { "forge_heart", 0.25, 1, 1 } }, C(255, 70, 40), 14, true)
-- Tier 5 Neon Void
mon("void_wisp", "Void Wisp", 5, 90000, 1800, 3500, 2000, { { "void_dust", 0.85, 1, 2 }, { "void_core", 0.08, 1, 1 } }, C(181, 108, 255), 3)
mon("glitch", "Glitch", 5, 120000, 2200, 4500, 2600, { { "void_dust", 0.9, 1, 3 }, { "void_core", 0.1, 1, 1 } }, C(58, 216, 255), 4)
mon("void_knight", "Void Knight", 5, 170000, 3000, 6500, 3500, { { "void_dust", 0.9, 2, 3 }, { "void_core", 0.15, 1, 1 } }, C(255, 79, 216), 6.5)
mon("void_emperor", "Void Emperor", 5, 4500000, 8000, 250000, 90000, { { "void_core", 1, 3, 5 }, { "void_crown", 0.25, 1, 1 } }, C(255, 79, 216), 16, true)
return M
