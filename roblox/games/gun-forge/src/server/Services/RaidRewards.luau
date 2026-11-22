-- Raid rewards + Raid Token shop logic.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Cfg = require(Shared.Config.Raid)
local Monsters = require(Shared.Config.Monsters)
local Arena = require(script.Parent.RaidArena)
local rng = Random.new()
local Rewards = {}

function Rewards.Grant(S, raid, p: Player, cleared: number, won: boolean)
	local tier = raid.tier
	local z = Arena.ZoneOfTier(tier)
	local common, core, rare = Monsters[z.monsters[1]].drops, Monsters[z.monsters[3]].drops, Monsters[z.boss].drops
	local coins = Cfg.CoinsPerWave[tier] * cleared
	local gems, tokens = Cfg.GemsPerWave * cleared, Cfg.TokensPerWave * cleared
	local mats = { [common[1][1]] = cleared * 2, [core[2][1]] = cleared // 2 }
	if won then
		gems += Cfg.ClearBonus.Gems
		tokens += Cfg.ClearBonus.Tokens
		mats[rare[2][1]] = rng:NextInteger(1, 2)
	end
	local daily = false
	if won then
		local day = os.time() // 86400
		S.DataService.Update(p, function(d)
			if (d.raid.daily or 0) < day then
				d.raid.daily = day
				daily = true
			end
		end)
		if daily then
			coins += Cfg.CoinsPerWave[tier] * Cfg.DailyFirstClear.CoinsMult
			gems += Cfg.DailyFirstClear.Gems
			tokens += Cfg.DailyFirstClear.Tokens
		end
	end
	S.DataService.Update(p, function(d)
		d.raid.tokens += tokens
		d.raid.best = math.max(d.raid.best, cleared)
		if won then
			d.raid.clears += 1
		end
	end)
	if coins > 0 then
		S.EconomyService.Add(p, "Coins", coins, "raid", false)
	end
	if gems > 0 then
		S.EconomyService.Add(p, "Gems", gems, "raid", false)
	end
	for id, n in pairs(mats) do
		S.InventoryService.AddMaterial(p, id, n)
	end
	return { coins = coins, gems = gems, tokens = tokens, mats = mats, daily = daily }
end


function Rewards.Buy(S, p: Player, id): boolean
	local item
	for _, it in ipairs(Cfg.Shop) do
		if it.id == id then
			item = it
		end
	end
	local d = S.DataService.Get(p)
	if not item or not d or d.raid.tokens < item.cost then
		return false
	end
	if item.kind == "title" and d.raid.owned and d.raid.owned[item.id] then
		d.raid.owned = d.raid.owned
		S.DataService.Update(p, function(dd)
			dd.title = item.title
		end)
		return true -- re-equip
	end
	local z = Arena.ZoneOfTier(S.ZoneService.BestTier(S.PlayerService.GetPower(p)))
	S.DataService.Update(p, function(dd)
		dd.raid.tokens -= item.cost
		if item.kind == "boost" then
			dd.boostUntil = math.max(os.time(), dd.boostUntil) + item.seconds
		elseif item.kind == "title" then
			dd.raid.owned = dd.raid.owned or {}
			dd.raid.owned[item.id] = true
			dd.title = item.title
		end
	end)
	if item.kind == "gems" then
		S.EconomyService.Add(p, "Gems", item.amount, "raidshop", false)
	elseif item.kind == "mats" then
		S.InventoryService.AddMaterial(p, Monsters[z.monsters[1]].drops[1][1], 30)
		S.InventoryService.AddMaterial(p, Monsters[z.monsters[2]].drops[2][1], 6)
	elseif item.kind == "rare" then
		S.InventoryService.AddMaterial(p, Monsters[z.boss].drops[2][1], 2)
	end
	S.EconomyService.Toast(p, "Purchased " .. item.name, "success")
	return true
end

return Rewards
