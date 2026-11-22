-- Gem shop: boosts, cooldown resets, coin/material packs scaled to the player's best zone.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local GemShop = require(Shared.Config.GemShop)
local Zones = require(Shared.Config.Zones)
local Monsters = require(Shared.Config.Monsters)
local Recipes = require(Shared.Config.Recipes)
local Net = require(Shared.Net)

local GemShopService = {}

function GemShopService.Init(S)
	local byKey = {}
	for _, it in ipairs(GemShop) do
		byKey[it.key] = it
	end
	Net.handle("GemBuy", function(player, key)
		local it = type(key) == "string" and byKey[key]
		if not it then
			return false
		end
		if not S.EconomyService.Spend(player, "Gems", it.gems) then
			S.EconomyService.Toast(player, "Not enough Gems", "error")
			return false
		end
		local tier = S.ZoneService.BestTier(S.PlayerService.GetPower(player))
		if it.boostSeconds then
			S.DataService.Update(player, function(d)
				d.boostUntil = math.max(os.time(), d.boostUntil) + it.boostSeconds
			end)
			S.TrainingService.Push(player)
		elseif key == "ResetGames" then
			S.MinigameService.ResetCooldowns(player)
		elseif it.coinsBossKills then
			local boss = Monsters[Zones[tier].boss]
			S.EconomyService.Add(player, "Coins", boss.coins * it.coinsBossKills, "gemshop", false)
		elseif it.common then
			S.InventoryService.AddMaterial(player, Recipes.TierMats[tier][1], it.common)
			S.InventoryService.AddMaterial(player, Recipes.TierMats[tier][2], it.rare)
		end
		S.EconomyService.Toast(player, "Bought " .. it.name, "success")
		return true
	end, 2)
end

return GemShopService
