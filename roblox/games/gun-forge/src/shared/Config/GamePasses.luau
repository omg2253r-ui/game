-- Game passes (real Robux, permanent). id = 0 -> create on Creator Hub, paste id.
-- Perks NEVER apply in PvP (ArenaService uses normalized stats).
return {
	VIP = {
		id = 0, order = 1, name = "VIP", price = 299,
		desc = "x1.5 Coins, VIP tag, neon trail and the VIP lounge.",
		icon = "rbxassetid://0", color = Color3.fromRGB(255, 201, 53),
		perks = { coinMultiplier = 1.5, chatTag = "VIP", trail = Color3.fromRGB(255, 79, 216) },
	},
	TrainingX2 = {
		id = 0, order = 2, name = "2x Training", price = 199,
		desc = "Gain double Power forever. Stacks with the x2 Pulse!",
		icon = "rbxassetid://0", color = Color3.fromRGB(58, 216, 255),
		perks = { trainMultiplier = 2 },
	},
	AutoFarm = {
		id = 0, order = 3, name = "Auto Farm", price = 249,
		desc = "Auto-shoot the nearest monster and auto-collect drops.",
		icon = "rbxassetid://0", color = Color3.fromRGB(120, 230, 90),
		perks = { autoFarm = true },
	},
	PetSlots = {
		id = 0, order = 4, name = "+3 Pet Slots", price = 149,
		desc = "Equip 6 pets instead of 3.",
		icon = "rbxassetid://0", color = Color3.fromRGB(255, 159, 67),
		perks = { extraPetSlots = 3 },
	},
	LuckyForge = {
		id = 0, order = 5, name = "Lucky Forge", price = 349,
		desc = "Extra rarity-upgrade chance at the Forge and Fusion Altar (odds shown).",
		icon = "rbxassetid://0", color = Color3.fromRGB(181, 108, 255),
		perks = { forgeLuck = 1 },
	},
	DropsX2 = {
		id = 0, order = 6, name = "2x Drops", price = 199,
		desc = "Monsters drop double materials.",
		icon = "rbxassetid://0", color = Color3.fromRGB(255, 79, 106),
		perks = { dropMultiplier = 2 },
	},
}
