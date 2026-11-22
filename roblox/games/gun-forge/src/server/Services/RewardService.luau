-- Retention: daily login streak + session playtime rewards.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Economy = require(Shared.Config.Economy)
local Net = require(Shared.Net)

local RewardService = {}
local DataService, EconomyService, AnalyticsService
local sessionStart: { [Player]: number } = {}
local claimedPlaytime: { [Player]: { [number]: boolean } } = {}

local function today(): number
	return math.floor(os.time() / 86400)
end

local function dailyState(data)
	local d = today()
	local canClaim = data.daily.lastDay < d
	local streak = data.daily.streak
	if data.daily.lastDay < d - 1 then
		streak = 0 -- missed a day
	end
	local nextIndex = (streak % #Economy.DailyRewards) + 1
	return canClaim, streak, nextIndex
end

local function pushState(player: Player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local canClaim, streak, nextIndex = dailyState(data)
	local minutes = (os.clock() - (sessionStart[player] or os.clock())) / 60
	local playtime = {}
	for i, r in ipairs(Economy.PlaytimeRewards) do
		playtime[i] = {
			minutes = r.minutes,
			reward = r.reward,
			claimed = claimedPlaytime[player] and claimedPlaytime[player][i] or false,
			ready = minutes >= r.minutes,
		}
	end
	Net.fire(player, "RewardState", {
		daily = { canClaim = canClaim, streak = streak, nextIndex = nextIndex, rewards = Economy.DailyRewards },
		playtime = playtime,
		sessionMinutes = minutes,
	})
end

function RewardService.Init(services)
	DataService = services.DataService
	EconomyService = services.EconomyService
	AnalyticsService = services.AnalyticsService
	Net.declare("RewardState")

	DataService.Loaded:Connect(function(player)
		sessionStart[player] = os.clock()
		claimedPlaytime[player] = {}
		pushState(player)
	end)
	Players.PlayerRemoving:Connect(function(p)
		sessionStart[p] = nil
		claimedPlaytime[p] = nil
	end)

	Net.on("ClaimDaily", function(player)
		local data = DataService.Get(player)
		if not data then
			return
		end
		local canClaim, streak, nextIndex = dailyState(data)
		if not canClaim then
			return
		end
		DataService.Update(player, function(d)
			d.daily.lastDay = today()
			d.daily.streak = streak + 1
		end)
		EconomyService.Grant(player, Economy.DailyRewards[nextIndex], "daily")
		EconomyService.Toast(player, "Daily reward claimed! Day " .. (streak + 1), "success")
		if streak + 1 >= 7 then
			AnalyticsService.Badge(player, "Streak7")
		end
		pushState(player)
	end, 2)

	Net.on("ClaimPlaytime", function(player, index)
		local r = type(index) == "number" and Economy.PlaytimeRewards[index]
		if not r or not sessionStart[player] or claimedPlaytime[player][index] then
			return
		end
		if (os.clock() - sessionStart[player]) / 60 < r.minutes then
			return
		end
		claimedPlaytime[player][index] = true
		EconomyService.Grant(player, r.reward, "playtime")
		EconomyService.Toast(player, "Playtime reward claimed!", "success")
		pushState(player)
	end, 2)

	-- refresh timers once a minute (cheap) and count Minutes stat for quests
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(60)
			for _, player in ipairs(Players:GetPlayers()) do
				if sessionStart[player] then
					services.QuestService.Progress(player, "Minutes", 1)
					pushState(player)
				end
			end
		end
	end)
end

return RewardService
