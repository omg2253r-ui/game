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

	-- Daily quests: 3 are rolled per player per day from this pool.
	-- stat = key incremented via QuestService.Progress(player, stat, amount)
	QuestsPerDay = 3,
	QuestPool = {
		{ id = "collect50", text = "Collect 50 coins", stat = "Collect", goal = 50, reward = { Coins = 300 } },
		{ id = "collect200", text = "Collect 200 coins", stat = "Collect", goal = 200, reward = { Gems = 10 } },
		{ id = "play10", text = "Play for 10 minutes", stat = "Minutes", goal = 10, reward = { Coins = 250 } },
		{ id = "earn1k", text = "Earn 1,000 coins", stat = "Earn", goal = 1000, reward = { Gems = 5 } },
	},

	-- BadgeService badge ids (0 = skip). Awarded by AnalyticsService helpers.
	Badges = {
		Welcome = 0,
		FirstPurchase = 0,
		Streak7 = 0,
	},
}
