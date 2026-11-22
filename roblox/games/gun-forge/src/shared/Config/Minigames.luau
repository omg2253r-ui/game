-- Training-break minigames. reward = TrainingSeconds of your current training gain * score fraction, + coins.
-- Server caps scores (MaxScore) and requires MinSeconds elapsed.
return {
	TargetRush = { name = "Target Rush", desc = "Tap the targets!", duration = 20, maxScore = 30, minSeconds = 18,
		trainingSeconds = 60, coins = 50, cooldown = 120, color = Color3.fromRGB(255, 79, 106) },
	ReloadRhythm = { name = "Reload Rhythm", desc = "Tap when the bar hits the gold zone.", duration = 15, maxScore = 10, minSeconds = 8,
		trainingSeconds = 60, coins = 60, cooldown = 120, color = Color3.fromRGB(58, 216, 255) },
	LuckyCrate = { name = "Lucky Crate", desc = "Pick 1 of 3 crates.", duration = 5, maxScore = 1, minSeconds = 1,
		trainingSeconds = 0, coins = 0, cooldown = 300, color = Color3.fromRGB(255, 201, 53),
		-- weighted prizes: training seconds or coins or a material from your best zone
		prizes = { { w = 45, trainingSeconds = 90 }, { w = 35, coins = 300 }, { w = 15, material = true, amount = 3 }, { w = 5, gems = 5 } } },
}
