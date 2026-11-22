-- Daily spin wheel: 8 weighted prizes, 1 free spin / FreeSeconds, extra spins cost Gems.
return {
	FreeSeconds = 86400,
	GemCost = 25,
	MaxPaidPerDay = 5,
	Prizes = {
		{ text = "500 Coins", glyph = "🪙", weight = 30, color = Color3.fromRGB(255, 205, 60), reward = { Coins = 500 } },
		{ text = "5 Gems", glyph = "💎", weight = 22, color = Color3.fromRGB(190, 110, 255), reward = { Gems = 5 } },
		{ text = "2,000 Coins", glyph = "💰", weight = 16, color = Color3.fromRGB(255, 159, 67), reward = { Coins = 2000 } },
		{ text = "15 Min Boost", glyph = "⚡", weight = 12, color = Color3.fromRGB(58, 216, 255), reward = { boostMin = 15 } },
		{ text = "Slime Cores", glyph = "🔷", weight = 8, color = Color3.fromRGB(80, 200, 255), reward = { mats = { slime_core = 5 } } },
		{ text = "20 Gems", glyph = "💠", weight = 6, color = Color3.fromRGB(120, 140, 255), reward = { Gems = 20 } },
		{ text = "Void Dust", glyph = "✦", weight = 4, color = Color3.fromRGB(181, 108, 255), reward = { mats = { void_dust = 5 } } },
		{ text = "JACKPOT 100 Gems", glyph = "🎰", weight = 2, color = Color3.fromRGB(255, 79, 106), reward = { Gems = 100 }, announce = true },
	},
}
