-- Season pass: XP from gameplay stats (wraps QuestService.Progress), 30 tiers, free + premium tracks.
-- Init AFTER QuestService, DataService, EconomyService, MonetizationService.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config.Season)
local Net = require(ReplicatedStorage.Shared.Net)
local Rewards = require(script.Parent.ProgressRewards)

local SeasonService = {}
local S

local function ensure(player: Player)
	local d = S.DataService.Get(player)
	if d and d.season.id ~= Config.Id then
		S.DataService.Update(player, function(x)
			x.season = { id = Config.Id, xp = 0, claimed = {}, premiumClaimed = {} }
		end)
	end
	return S.DataService.Get(player)
end

local function tierOf(xp: number): number
	return math.min(Config.Tiers, math.floor(xp / Config.XpPerTier))
end

local function state(player: Player)
	local d = ensure(player)
	if not d then
		return nil
	end
	local se = d.season
	return {
		id = Config.Id,
		xp = math.floor(se.xp),
		tier = tierOf(se.xp),
		premium = S.MonetizationService.GetPerk(player, "seasonPremium") == true,
		claimed = se.claimed,
		premiumClaimed = se.premiumClaimed,
	}
end

function SeasonService.AddXp(player: Player, n: number)
	if n <= 0 then
		return
	end
	local d = ensure(player)
	if not d then
		return
	end
	local before = tierOf(d.season.xp)
	S.DataService.Update(player, function(x)
		x.season.xp += n
	end)
	local after = tierOf(d.season.xp)
	if after > before then
		S.EconomyService.Toast(player, ("Season tier %d reached! Open PASS to claim."):format(after), "success")
	end
end

function SeasonService.Init(services)
	S = services
	local original = S.QuestService.Progress
	S.QuestService.Progress = function(player: Player, stat: string, amount: number)
		original(player, stat, amount)
		local w = Config.Weights[stat]
		if w and type(amount) == "number" then
			SeasonService.AddXp(player, w * amount)
		end
	end

	S.DataService.Loaded:Connect(ensure)

	Net.handle("SeasonInfo", function(player)
		return state(player)
	end, 4)

	Net.handle("SeasonClaim", function(player, tier, premium)
		if type(tier) ~= "number" or tier % 1 ~= 0 or tier < 1 or tier > Config.Tiers or type(premium) ~= "boolean" then
			return state(player)
		end
		local st = state(player)
		if not st or tier > st.tier or (premium and not st.premium) then
			return st
		end
		local key = tostring(tier)
		local map = premium and "premiumClaimed" or "claimed"
		if st[map][key] then
			return st
		end
		S.DataService.Update(player, function(d)
			d.season[map][key] = true
		end)
		local reward = (premium and Config.Premium or Config.Free)[tier]
		Rewards.Grant(S, player, reward, "season")
		S.EconomyService.Toast(player, ("Season tier %d claimed!"):format(tier), "success")
		return state(player)
	end, 4)
end

return SeasonService
