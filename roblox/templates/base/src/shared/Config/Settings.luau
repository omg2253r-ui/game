-- Global game settings. The Director/Engineer edit THIS file per game, not the services.
return {
	GameName = "MY GAME",
	DataStoreName = "PlayerData_v1", -- bump the suffix only for a full data wipe
	AutosaveSeconds = 120,

	-- Studio testing: pretend the player owns every game pass with id = 0 (unconfigured)
	-- so the whole game can be play-tested before passes are created on the website.
	StudioGrantUnconfiguredPasses = true,

	-- Demo gameplay loop (CollectibleService). Disable when the real genre loop is in.
	Collectibles = {
		Enabled = true,
		MaxActive = 40, -- hard cap = performance safety
		SpawnRadius = 80,
		RespawnSeconds = 4,
		Value = 5,
	},

	Leaderboard = {
		Enabled = true,
		Stat = "Coins", -- key in data.stats or currency to rank by
		StoreName = "Leaderboard_Coins_v1",
		RefreshSeconds = 120,
		Top = 50,
	},
}
