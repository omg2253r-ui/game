-- Server entry. Services are plain modules with Init(services); order matters only
-- for who connects to DataService.Loaded first (all connect before any player loads).
local Services = script.Parent.Services

local order = {
	"DataService",
	"WorldService",
	"MapService",
	"MonetizationService",
	"EconomyService",
	"AnalyticsService",
	"QuestService",
	"RewardService",
	"LeaderboardService",
	"CollectibleService",
	-- Gun Forge
	"EventService",
	"SocialService",
	"PlayerService",
	"InventoryService",
	"PetService",
	"ClanService",
	"TrainingService",
	"ZoneService",
	"MonsterService",
	"GunService",
	"ForgeService",
	"MinigameService",
	"StationService",
	"RebirthService",
	"CodesService",
	"WorldBossService",
	"ArenaService",
	"TournamentService",
	"GemShopService",
	"RaidService",
	"SeasonService", -- wraps QuestService.Progress (must be the only wrapper)
	"AchievementService",
	"SpinService",
	"StoryService",
	"TradeService",
}

local services = {}
for _, name in ipairs(order) do
	services[name] = require(Services:WaitForChild(name))
end

-- DataService.Init last-but-first: other services must subscribe to Loaded before players load
for _, name in ipairs(order) do
	if name ~= "DataService" and services[name].Init then
		services[name].Init(services)
	end
end
services.DataService.Init()

print(("[Server] %d services started"):format(#order))
