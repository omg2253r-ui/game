-- Pets from the Fusion Altar. mult.power = training multiplier, mult.coins = coin multiplier (additive per pet).
-- Odds are ALWAYS shown in UI (paid-random-item policy).
local C = Color3.fromRGB
local P = {}
P.Pets = {
	gooey = { name = "Gooey", rarity = 1, power = 0.10, coins = 0.05, color = C(120, 230, 90), ears = "round" },
	pip = { name = "Pip", rarity = 1, power = 0.12, coins = 0.05, color = C(255, 200, 120), ears = "cat" },
	bubbles = { name = "Bubbles", rarity = 2, power = 0.25, coins = 0.10, color = C(80, 200, 255), ears = "bunny" },
	jelly_kid = { name = "Jelly Kid", rarity = 4, power = 0.8, coins = 0.30, color = C(255, 220, 60), ears = "cat" },
	bolt = { name = "Bolt", rarity = 1, power = 0.35, coins = 0.12, color = C(190, 160, 120), ears = "none" },
	cogsy = { name = "Cogsy", rarity = 2, power = 0.6, coins = 0.2, color = C(255, 159, 67), ears = "round" },
	dune_fox = { name = "Dune Fox", rarity = 3, power = 1.1, coins = 0.35, color = C(235, 170, 80), ears = "cat" },
	titan_cub = { name = "Titan Cub", rarity = 4, power = 2.0, coins = 0.6, color = C(255, 120, 60), ears = "round" },
	frosty = { name = "Frosty", rarity = 1, power = 1.0, coins = 0.3, color = C(235, 245, 255), ears = "round" },
	ice_bun = { name = "Ice Bun", rarity = 2, power = 1.6, coins = 0.45, color = C(140, 200, 255), ears = "bunny" },
	yeti_pup = { name = "Yeti Pup", rarity = 4, power = 4.0, coins = 1.0, color = C(220, 240, 255), ears = "cat" },
	cinder = { name = "Cinder", rarity = 1, power = 2.6, coins = 0.7, color = C(255, 140, 50), ears = "cat" },
	lava_lizard = { name = "Lava Lizard", rarity = 3, power = 4.5, coins = 1.2, color = C(255, 80, 40), ears = "none" },
	forge_spirit = { name = "Forge Spirit", rarity = 5, power = 12, coins = 3, color = C(255, 79, 106), ears = "bunny" },
	wisp = { name = "Wisp", rarity = 2, power = 7, coins = 1.8, color = C(181, 108, 255), ears = "none" },
	glitchy = { name = "Glitchy", rarity = 3, power = 11, coins = 2.6, color = C(58, 216, 255), ears = "cat" },
	nebula = { name = "Nebula", rarity = 4, power = 18, coins = 4, color = C(255, 79, 216), ears = "bunny" },
	void_dragon = { name = "Void Dragon", rarity = 5, power = 40, coins = 9, color = C(120, 40, 200), ears = "none" },
}

-- Fusion cores: cost + odds (weights). One core per tier.
P.Cores = {
	{ id = "slime_core", name = "Jelly Core", tier = 1, coins = 250, mats = { slime_goo = 20, slime_core = 2 },
		odds = { gooey = 50, pip = 35, bubbles = 13, jelly_kid = 2 } },
	{ id = "gear_core", name = "Gear Core", tier = 2, coins = 6000, mats = { scrap_metal = 25, gear_core = 3 },
		odds = { bolt = 55, cogsy = 30, dune_fox = 13, titan_cub = 2 } },
	{ id = "ice_core", name = "Frost Core", tier = 3, coins = 90000, mats = { frost_shard = 30, ice_core = 3 },
		odds = { frosty = 60, ice_bun = 35, yeti_pup = 5 } },
	{ id = "flame_core", name = "Magma Core", tier = 4, coins = 1500000, mats = { magma_rock = 30, flame_core = 4 },
		odds = { cinder = 65, lava_lizard = 33, forge_spirit = 2 } },
	{ id = "void_core", name = "Void Core", tier = 5, coins = 20000000, mats = { void_dust = 35, void_core = 4 },
		odds = { wisp = 55, glitchy = 33, nebula = 11, void_dragon = 1 } },
}
P.BaseSlots = 3
P.CombineCount = 5 -- 5 same -> golden, 5 golden -> rainbow
P.GoldenMult = 2
P.RainbowMult = 4
P.MaxPets = 200
return P
