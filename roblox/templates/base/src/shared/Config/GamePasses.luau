-- Game passes (one-time Robux purchase, permanent).
-- 1) Create the pass on create.roblox.com > Monetization > Passes
-- 2) Paste its id below. id = 0 means "not created yet" (auto-owned in Studio when
--    Settings.StudioGrantUnconfiguredPasses = true).
-- perks are read by services: coinMultiplier (EconomyService), walkSpeed/jumpPower,
-- trail/chatTag (MonetizationService), extra keys for genre-specific code.
return {
	VIP = {
		id = 0,
		order = 1,
		name = "VIP",
		price = 299,
		desc = "x2 Coins forever, golden VIP tag and an exclusive VIP trail.",
		icon = "rbxassetid://0",
		color = Color3.fromRGB(255, 196, 46),
		perks = { coinMultiplier = 2, chatTag = "VIP", trail = Color3.fromRGB(255, 210, 60) },
	},
	Speed = {
		id = 0,
		order = 2,
		name = "Speed Boots",
		price = 99,
		desc = "Run 50% faster everywhere.",
		icon = "rbxassetid://0",
		color = Color3.fromRGB(64, 200, 255),
		perks = { walkSpeed = 24 },
	},
	DoubleCoins = {
		id = 0,
		order = 3,
		name = "2x Coins",
		price = 199,
		desc = "Doubles every coin you earn. Stacks with VIP!",
		icon = "rbxassetid://0",
		color = Color3.fromRGB(120, 230, 90),
		perks = { coinMultiplier = 2 },
	},
}
