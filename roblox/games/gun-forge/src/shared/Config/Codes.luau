-- Redeem codes (case-insensitive). expires = os.time() or 0 for never.
return {
	RELEASE = { reward = { Coins = 500, Gems = 20 }, expires = 0 },
	FORGE = { reward = { Coins = 1000 }, expires = 0 },
	THANKS100 = { reward = { Gems = 50 }, expires = 0 },
}
