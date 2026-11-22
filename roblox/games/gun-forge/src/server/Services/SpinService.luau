-- Daily spin wheel. Server picks the prize; client only animates to the returned index.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config.Spin)
local Net = require(ReplicatedStorage.Shared.Net)
local Rewards = require(script.Parent.ProgressRewards)

local SpinService = {}
local S
local rng = Random.new()

local function today(): number
	return math.floor(os.time() / 86400)
end

local function info(player: Player)
	local d = S.DataService.Get(player)
	if not d then
		return nil
	end
	local sp = d.spin
	local paid = (sp.paidDay == today()) and (sp.paidCount or 0) or 0
	return {
		freeIn = math.max(0, (sp.last or 0) + Config.FreeSeconds - os.time()),
		paidLeft = Config.MaxPaidPerDay - paid,
		cost = Config.GemCost,
	}
end

local function pick(): number
	local total = 0
	for _, p in ipairs(Config.Prizes) do
		total += p.weight
	end
	local r = rng:NextNumber() * total
	for i, p in ipairs(Config.Prizes) do
		r -= p.weight
		if r <= 0 then
			return i
		end
	end
	return 1
end

function SpinService.Init(services)
	S = services

	Net.handle("SpinInfo", info, 3)

	Net.handle("Spin", function(player, usePaid)
		local d = S.DataService.Get(player)
		if not d or type(usePaid) ~= "boolean" then
			return nil
		end
		local st = info(player)
		if usePaid then
			if st.paidLeft <= 0 or not S.EconomyService.Spend(player, "Gems", Config.GemCost) then
				return nil
			end
			S.DataService.Update(player, function(x)
				if x.spin.paidDay ~= today() then
					x.spin.paidDay, x.spin.paidCount = today(), 0
				end
				x.spin.paidCount += 1
			end)
		else
			if st.freeIn > 0 then
				return nil
			end
			S.DataService.Update(player, function(x)
				x.spin.last = os.time()
			end)
		end
		local index = pick()
		local prize = Config.Prizes[index]
		Rewards.Grant(S, player, prize.reward, "spin")
		if prize.announce then
			Net.fireAll("Toast", ("%s hit the JACKPOT on the Daily Spin!"):format(player.DisplayName), "success")
		end
		return { index = index, info = info(player) }
	end, 1)
end

return SpinService
