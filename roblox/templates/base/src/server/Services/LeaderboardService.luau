-- Global leaderboard via OrderedDataStore. Writes the top list to
-- ReplicatedStorage.Leaderboard (StringValue JSON) for any in-world board / UI.
local DataStoreService = game:GetService("DataStoreService")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Settings = require(ReplicatedStorage.Shared.Config.Settings).Leaderboard

local LeaderboardService = {}

function LeaderboardService.Init(services)
	if not Settings.Enabled then
		return
	end
	local ok, store = pcall(DataStoreService.GetOrderedDataStore, DataStoreService, Settings.StoreName)
	if not ok then
		return
	end
	local out = Instance.new("StringValue")
	out.Name = "Leaderboard"
	out.Value = "[]"
	out.Parent = ReplicatedStorage

	local function score(player)
		local data = services.DataService.Get(player)
		if not data then
			return nil
		end
		return data.currencies[Settings.Stat] or data.stats[Settings.Stat]
	end

	task.spawn(function()
		while true do -- lint-ok (task.wait)
			for _, player in ipairs(Players:GetPlayers()) do
				local s = score(player)
				if s and not services.DataService.IsOffline(player) then
					pcall(store.SetAsync, store, tostring(player.UserId), math.floor(s))
				end
				task.wait(0.5) -- spread writes (DataStore budget)
			end
			local okPage, pages = pcall(store.GetSortedAsync, store, false, Settings.Top)
			if okPage then
				local list = {}
				for rank, entry in ipairs(pages:GetCurrentPage()) do
					local okName, name = pcall(Players.GetNameFromUserIdAsync, Players, tonumber(entry.key))
					table.insert(list, { rank = rank, name = okName and name or "?", value = entry.value })
				end
				out.Value = HttpService:JSONEncode(list)
			end
			task.wait(Settings.RefreshSeconds)
		end
	end)
end

return LeaderboardService
