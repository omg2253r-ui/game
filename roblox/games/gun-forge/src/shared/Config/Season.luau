-- Season pass. Change Id to start a new season (everyone's season data resets).
-- reward = { Coins=, Gems=, mats = { [materialId] = n }, boostMin = n, title = "titleId" } (titles live in Achievements.Titles)
local S = {
	Id = 1,
	Name = "Season 1: Forge Rising",
	Tiers = 30,
	XpPerTier = 120,
	-- XP gained per QuestService stat increment
	Weights = { Kills = 0.4, BossKills = 12, Minigames = 6, Crafts = 8, Fusions = 10, PvpWins = 15, Minutes = 1 },
}

local mats = { "slime_core", "gear_core", "ice_core", "flame_core", "void_dust" }

local free, premium = {}, {}
for t = 1, S.Tiers do
	free[t] = { Coins = 250 * t }
	premium[t] = { Coins = 500 * t, Gems = 5 + math.floor(t / 3) * 2 }
	if t % 5 == 0 then
		free[t] = { Coins = 250 * t, Gems = 10 }
		premium[t].mats = { [mats[(t // 5 - 1) % #mats + 1]] = 3 + t // 5 }
	elseif t % 3 == 0 then
		free[t].boostMin = 10
		premium[t].boostMin = 30
	end
end
free[10] = { Gems = 20, title = "pass_vet" }
free[30] = { Gems = 50, boostMin = 60, title = "pass_champ" }
premium[1] = { Gems = 15, title = "pass_holder" }
premium[15] = { Gems = 40, boostMin = 60, title = "elite_operator" }
premium[30] = { Gems = 150, boostMin = 120, title = "forge_legend" }

S.Free, S.Premium = free, premium
return S
