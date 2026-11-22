-- Shared reward granter for Season / Achievements / Spin / Story.
-- reward = { Coins, Gems, mats = {id=n}, boostMin, title }
local ProgressRewards = {}

function ProgressRewards.Grant(S, player: Player, reward, source: string)
	local cur = {}
	for _, k in ipairs({ "Coins", "Gems" }) do
		if reward[k] then
			cur[k] = reward[k]
		end
	end
	if next(cur) then
		S.EconomyService.Grant(player, cur, source)
	end
	if reward.mats or reward.boostMin or reward.title then
		S.DataService.Update(player, function(d)
			for id, n in pairs(reward.mats or {}) do
				d.inventory[id] = (d.inventory[id] or 0) + n
			end
			if reward.boostMin then
				d.boostUntil = math.max(os.time(), d.boostUntil) + reward.boostMin * 60
			end
			if reward.title then
				d.achievements["title:" .. reward.title] = true
			end
		end)
		S.EconomyService.Sync(player)
	end
end

return ProgressRewards
