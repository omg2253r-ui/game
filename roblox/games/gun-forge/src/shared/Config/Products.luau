-- Developer products (consumable). Custom keys are handled via MonetizationService.ProductHandlers.
return {
	Coins1 = { id = 0, order = 1, name = "1,000 Coins", price = 25, icon = "rbxassetid://0", grant = { Coins = 1000 } },
	Coins2 = { id = 0, order = 2, name = "6,000 Coins", price = 99, icon = "rbxassetid://0", grant = { Coins = 6000 }, tag = "BEST VALUE" },
	Gems1 = { id = 0, order = 3, name = "120 Gems", price = 49, icon = "rbxassetid://0", grant = { Gems = 120 } },
	TrainBoost = { id = 0, order = 4, name = "x3 Training (30 min)", price = 39, icon = "rbxassetid://0", handler = "TrainBoost" },
	Gems2 = { id = 0, order = 5, name = "700 Gems", price = 249, icon = "rbxassetid://0", grant = { Gems = 700 }, tag = "+17% BONUS" },
}
