-- Training-break minigames: server starts a session (cooldown), client plays, server clamps score
-- and pays Power (seconds of training) + coins. Lucky Crate result is rolled on the server.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Minigames = require(Shared.Config.Minigames)
local Recipes = require(Shared.Config.Recipes)
local Net = require(Shared.Net)

local MinigameService = {}
local S
local rng = Random.new()
local cooldown: { [Player]: { [string]: number } } = {}
local active: { [Player]: { game: string, t0: number } } = {}

local function crate(player: Player)
	local prizes = Minigames.LuckyCrate.prizes
	local total = 0
	for _, p in ipairs(prizes) do
		total += p.w
	end
	local x = rng:NextNumber() * total
	for _, p in ipairs(prizes) do
		x -= p.w
		if x <= 0 then
			if p.trainingSeconds then
				return { power = S.TrainingService.GrantSeconds(player, p.trainingSeconds) }
			elseif p.coins then
				S.EconomyService.Add(player, "Coins", p.coins, "crate", false)
				return { coins = p.coins }
			elseif p.gems then
				S.EconomyService.Add(player, "Gems", p.gems, "crate", false)
				return { gems = p.gems }
			elseif p.material then
				local tier = S.ZoneService.BestTier(S.PlayerService.GetPower(player))
				local mat = Recipes.TierMats[tier][1]
				S.InventoryService.AddMaterial(player, mat, p.amount)
				return { mat = mat, amount = p.amount }
			end
		end
	end
	return {}
end

function MinigameService.ResetCooldowns(player: Player)
	cooldown[player] = {}
end

function MinigameService.Init(services)
	S = services
	Players.PlayerRemoving:Connect(function(p)
		cooldown[p] = nil
		active[p] = nil
	end)

	Net.handle("MinigameStart", function(player, name)
		local cfg = type(name) == "string" and Minigames[name]
		if not cfg then
			return { ok = false }
		end
		cooldown[player] = cooldown[player] or {}
		local left = (cooldown[player][name] or 0) - os.clock()
		if left > 0 then
			return { ok = false, wait = math.ceil(left) }
		end
		cooldown[player][name] = os.clock() + cfg.cooldown
		active[player] = { game = name, t0 = os.clock() }
		return { ok = true, duration = cfg.duration, maxScore = cfg.maxScore }
	end, 2)

	Net.handle("MinigameEnd", function(player, score)
		local a = active[player]
		if not a or type(score) ~= "number" then
			return nil
		end
		active[player] = nil
		local cfg = Minigames[a.game]
		S.QuestService.Progress(player, "Minigames", 1)
		if a.game == "LuckyCrate" then
			return crate(player)
		end
		if os.clock() - a.t0 < cfg.minSeconds then
			score = 0
		end
		local frac = math.clamp(score, 0, cfg.maxScore) / cfg.maxScore
		local power = S.TrainingService.GrantSeconds(player, cfg.trainingSeconds * frac)
		local coins = math.floor(cfg.coins * frac)
		if coins > 0 then
			S.EconomyService.Add(player, "Coins", coins, "minigame", true)
		end
		return { power = power, coins = coins, score = score }
	end, 2)

	Net.handle("MinigameCooldowns", function(player)
		local out = {}
		for name in pairs(Minigames) do
			out[name] = math.max(0, math.ceil(((cooldown[player] or {})[name] or 0) - os.clock()))
		end
		return out
	end, 2)
end

return MinigameService
