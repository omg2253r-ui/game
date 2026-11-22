-- Forge recipes, generated per tier. mats from the tier's zone (common part + rare core).
local Guns = require(script.Parent.Guns)
local TIER_MATS = {
	{ "slime_goo", "slime_core" },
	{ "scrap_metal", "gear_core" },
	{ "frost_shard", "ice_core" },
	{ "magma_rock", "flame_core" },
	{ "void_dust", "void_core" },
}
local COINS = { 100, 2500, 40000, 600000, 9000000 }

local R = { List = {}, ById = {}, TierMats = TIER_MATS }
local function add(r)
	table.insert(R.List, r)
	R.ById[r.id] = r
end
for tier = 1, 5 do
	local common, rare = TIER_MATS[tier][1], TIER_MATS[tier][2]
	for _, typeId in ipairs(Guns.TypeOrder) do
		if Guns.Types[typeId].minTier <= tier then
			add({ id = typeId .. "_t" .. tier, kind = "gun", item = typeId, tier = tier, coins = COINS[tier],
				mats = { [common] = 12 + tier * 3, [rare] = 1 + math.floor(tier / 2) } })
		end
	end
	for _, slot in ipairs(Guns.ArmorOrder) do
		add({ id = slot .. "_t" .. tier, kind = "armor", item = slot, tier = tier, coins = math.floor(COINS[tier] * 0.8),
			mats = { [common] = 10 + tier * 3, [rare] = 1 } })
	end
end

-- Forge minigame: each Perfect adds bump chance; LuckyForge pass adds PassBump.
R.Minigame = { Parts = 4, PerfectBump = 0.04, PassBump = 0.10, MinSeconds = 2.5, QualityMin = 0.9, QualityMax = 1.15 }
R.CraftSeconds = 0 -- forge timer (0 = instant after minigame); InstantCraft product skips when > 0
R.SalvageRefund = 0.3 -- coins refunded when scrapping an item
R.MaxItems = 150
return R
