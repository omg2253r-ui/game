-- Global timed events (all UTC). Multipliers stack with passes. Live-ops edit this file only.
return {
	-- recurring weekly: days 0=Sunday..6=Saturday
	Weekly = {
		{ name = "2x WEEKEND", days = { 6, 0 }, train = 2, drops = 2, coins = 1, color = Color3.fromRGB(255, 201, 53) },
		{ name = "LUCKY WEDNESDAY", days = { 3 }, train = 1, drops = 1.5, coins = 1.5, color = Color3.fromRGB(120, 230, 90) },
	},
	-- one-off events: start/finish as os.time() (UTC). Example: launch week.
	Special = {
		{ name = "LAUNCH PARTY", start = 0, finish = 0, train = 1.5, drops = 1.5, coins = 1.5, color = Color3.fromRGB(255, 79, 216) },
	},
	-- hourly "happy hour": first 10 minutes of every hour
	HappyHour = { minutes = 10, train = 1.5, drops = 1, coins = 1, name = "HAPPY HOUR", color = Color3.fromRGB(58, 216, 255) },
}
