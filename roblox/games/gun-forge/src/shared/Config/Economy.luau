-- Currencies, rewards and quests. Balancing lives here (Economy designer owns this file).
return {
	Currencies = {
		Coins = { start = 0, leaderstat = true, color = Color3.fromRGB(255, 205, 60) },
		Gems = { start = 10, leaderstat = false, color = Color3.fromRGB(190, 110, 255) },
	},

	-- Daily login streak; index = streak day (loops after last)
	DailyRewards = {
		{ Coins = 100 },
		{ Coins = 200 },
		{ Coins = 300, Gems = 5 },
		{ Coins = 500 },
		{ Coins = 750, Gems = 10 },
		{ Coins = 1000 },
		{ Coins = 2000, Gems = 30 },
	},

	-- Playtime rewards (minutes in this session) keep sessions long
	PlaytimeRewards = {
		{ minutes = 5, reward = { Coins = 150 } },
		{ minutes = 15, reward = { Coins = 400 } },
		{ minutes = 30, reward = { Gems = 15 } },
		{ minutes = 60, reward = { Coins = 2500, Gems = 25 } },
	},

	-- Daily quests: stats are fed by genre services via QuestService.Progress
	QuestsPerDay = 3,
	QuestPool = {
		{ id = "kill50", text = "Defeat 50 monsters", stat = "Kills", goal = 50, reward = { Coins = 400 } },
		{ id = "kill200", text = "Defeat 200 monsters", stat = "Kills", goal = 200, reward = { Gems = 10 } },
		{ id = "boss1", text = "Defeat a boss", stat = "BossKills", goal = 1, reward = { Gems = 8 } },
		{ id = "x2tap", text = "Catch 5 x2 Pulses", stat = "X2Taps", goal = 5, reward = { Coins = 300 } },
		{ id = "mini3", text = "Play 3 training minigames", stat = "Minigames", goal = 3, reward = { Coins = 350 } },
		{ id = "forge2", text = "Forge 2 items", stat = "Crafts", goal = 2, reward = { Gems = 6 } },
		{ id = "fuse1", text = "Hatch a pet at the Fusion Altar", stat = "Fusions", goal = 1, reward = { Coins = 500 } },
		{ id = "pvp3", text = "Win 3 arena matches", stat = "PvpWins", goal = 3, reward = { Gems = 12 } },
		{ id = "play20", text = "Play for 20 minutes", stat = "Minutes", goal = 20, reward = { Coins = 300 } },
		{ id = "earn5k", text = "Earn 5,000 coins", stat = "Earn", goal = 5000, reward = { Gems = 5 } },
	},

	-- BadgeService badge ids (0 = skip). Awarded by AnalyticsService helpers.
	Badges = {
		Welcome = 0,
		FirstPurchase = 0,
		Streak7 = 0,
		FirstLegendary = 0,
		TournamentWin = 0,
		Rebirth1 = 0,
	},
}
