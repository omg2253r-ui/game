-- Rebirth: reset Power + Coins (keep items/pets) for a permanent training multiplier.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Training = require(Shared.Config.Training)
local Net = require(Shared.Net)

local RebirthService = {}
local BASE_COST, GROWTH = 50000, 4

function RebirthService.Cost(rebirths: number): number
	return BASE_COST * GROWTH ^ rebirths
end

function RebirthService.Init(S)
	Net.handle("RebirthInfo", function(player)
		local d = S.DataService.Get(player)
		if not d then
			return nil
		end
		return { rebirths = d.rebirths, cost = RebirthService.Cost(d.rebirths), power = d.stats.Power,
			now = Training.RebirthMultiplier ^ d.rebirths, after = Training.RebirthMultiplier ^ (d.rebirths + 1) }
	end, 4)

	Net.handle("Rebirth", function(player)
		local d = S.DataService.Get(player)
		if not d or d.stats.Power < RebirthService.Cost(d.rebirths) or S.PlayerService.InArena(player) then
			return false
		end
		S.DataService.Update(player, function(data)
			data.rebirths += 1
			data.currencies.Coins = 0
		end)
		S.PlayerService.SetPower(player, 0)
		S.EconomyService.Sync(player)
		S.InventoryService.Sync(player)
		S.TrainingService.Push(player)
		S.PlayerService.RefreshCharacter(player)
		S.AnalyticsService.Badge(player, "Rebirth1")
		S.EconomyService.Toast(player, ("REBIRTH %d! Training x%.2f"):format(d.rebirths, Training.RebirthMultiplier ^ d.rebirths), "success")
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if root then
			root.CFrame = CFrame.new(0, 5, 0)
		end
		return true
	end, 1)
end

return RebirthService
