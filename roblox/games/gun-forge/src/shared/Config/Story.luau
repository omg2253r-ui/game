-- Commander Vex story chain. kind: "power" (stats.Power >= goal), "stat" (stats[stat] delta since step start),
-- "rebirths" (>= goal), "clan" (in a clan), "pets" (owned pets >= goal).
local Zones = require(script.Parent.Zones)
local function zp(i) return Zones[i] and Zones[i].powerReq or 1e6 end

return {
	Npc = "Commander Vex",
	Steps = {
		{ text = "Train your Power. Stand in the training zone!", kind = "power", goal = 100, reward = { Coins = 200 } },
		{ text = "Defeat 10 monsters in Slime Meadow.", kind = "stat", stat = "Kills", goal = 10, reward = { Coins = 400 } },
		{ text = "Reach 1,000 Power.", kind = "power", goal = 1000, reward = { Coins = 600, Gems = 3 } },
		{ text = "Forge your first gun at the Forge.", kind = "stat", stat = "Crafts", goal = 1, reward = { Gems = 5 } },
		{ text = "Defeat 30 more monsters.", kind = "stat", stat = "Kills", goal = 30, reward = { Coins = 1000 } },
		{ text = "Reach Scrap Desert (zone 2) by gaining Power.", kind = "power", goal = zp(2), reward = { Coins = 1500, Gems = 5 } },
		{ text = "Defeat 40 monsters with your new gun.", kind = "stat", stat = "Kills", goal = 40, reward = { Coins = 2000 } },
		{ text = "Fuse a pet at the Pet station.", kind = "stat", stat = "Fusions", goal = 1, reward = { Gems = 8 } },
		{ text = "Play a minigame.", kind = "stat", stat = "Minigames", goal = 1, reward = { Coins = 2500 } },
		{ text = "Forge 3 more guns.", kind = "stat", stat = "Crafts", goal = 3, reward = { Gems = 10, mats = { gear_core = 3 } } },
		{ text = "Own 3 pets.", kind = "pets", goal = 3, reward = { Coins = 4000 } },
		{ text = "Defeat a boss.", kind = "stat", stat = "BossKills", goal = 1, reward = { Gems = 12 } },
		{ text = "Win a PvP match in the Arena.", kind = "stat", stat = "PvpWins", goal = 1, reward = { Gems = 15, Coins = 5000 } },
		{ text = "Join or create a clan.", kind = "clan", goal = 1, reward = { Gems = 15 } },
		{ text = "Reach Frost Cavern (zone 3) power.", kind = "power", goal = zp(3), reward = { Coins = 10000, Gems = 10 } },
		{ text = "Fuse 3 more pets.", kind = "stat", stat = "Fusions", goal = 3, reward = { Gems = 20, boostMin = 30 } },
		{ text = "Defeat 150 monsters.", kind = "stat", stat = "Kills", goal = 150, reward = { Coins = 15000 } },
		{ text = "Rebirth for the first time.", kind = "rebirths", goal = 1, reward = { Gems = 40, boostMin = 60 } },
		{ text = "Defeat 5 more bosses.", kind = "stat", stat = "BossKills", goal = 5, reward = { Gems = 40 } },
		{ text = "Reach Neon Void power. You are a legend!", kind = "power", goal = zp(5), reward = { Gems = 100, title = "vex_chosen" } },
	},
}
