-- Achievements + Titles. kind: "stat" (stats[stat]), "rebirths", "pets" (owned), "index" (collection entries),
-- "rating" (PvP), "clan" (1 if in clan). Rewards: gems (+ optional title id). announce = server-wide toast.
local A = {}

A.Titles = {
	rookie = { name = "Rookie", color = Color3.fromRGB(200, 200, 220) },
	slayer = { name = "Slayer", color = Color3.fromRGB(255, 120, 90) },
	boss_hunter = { name = "Boss Hunter", color = Color3.fromRGB(255, 159, 67) },
	gladiator = { name = "Gladiator", color = Color3.fromRGB(255, 79, 106) },
	smith = { name = "Master Smith", color = Color3.fromRGB(255, 205, 60) },
	reborn = { name = "Reborn", color = Color3.fromRGB(190, 110, 255) },
	collector = { name = "Collector", color = Color3.fromRGB(90, 220, 150) },
	titan = { name = "Titan", color = Color3.fromRGB(58, 216, 255) },
	pass_holder = { name = "Pass Holder", color = Color3.fromRGB(255, 120, 200) },
	pass_vet = { name = "Season Veteran", color = Color3.fromRGB(120, 200, 255) },
	pass_champ = { name = "Season Champion", color = Color3.fromRGB(255, 220, 100) },
	elite_operator = { name = "Elite Operator", color = Color3.fromRGB(255, 90, 220) },
	forge_legend = { name = "Forge Legend", color = Color3.fromRGB(255, 79, 216) },
	vex_chosen = { name = "Vex's Chosen", color = Color3.fromRGB(255, 255, 140) },
}

A.List = {
	{ id = "pow1k", name = "Getting Strong", desc = "Reach 1K Power", kind = "stat", stat = "Power", goal = 1e3, gems = 3, title = "rookie" },
	{ id = "pow100k", name = "Muscle Memory", desc = "Reach 100K Power", kind = "stat", stat = "Power", goal = 1e5, gems = 10 },
	{ id = "pow10m", name = "Powerhouse", desc = "Reach 10M Power", kind = "stat", stat = "Power", goal = 1e7, gems = 30 },
	{ id = "pow1b", name = "Titan Power", desc = "Reach 1B Power", kind = "stat", stat = "Power", goal = 1e9, gems = 100, title = "titan", announce = true },
	{ id = "kill100", name = "Monster Masher", desc = "Defeat 100 monsters", kind = "stat", stat = "Kills", goal = 100, gems = 3 },
	{ id = "kill1k", name = "Exterminator", desc = "Defeat 1,000 monsters", kind = "stat", stat = "Kills", goal = 1000, gems = 15, title = "slayer" },
	{ id = "kill10k", name = "Mass Extinction", desc = "Defeat 10,000 monsters", kind = "stat", stat = "Kills", goal = 10000, gems = 60 },
	{ id = "boss5", name = "Boss Breaker", desc = "Defeat 5 bosses", kind = "stat", stat = "BossKills", goal = 5, gems = 8 },
	{ id = "boss50", name = "Boss Hunter", desc = "Defeat 50 bosses", kind = "stat", stat = "BossKills", goal = 50, gems = 40, title = "boss_hunter", announce = true },
	{ id = "craft10", name = "Apprentice Smith", desc = "Forge 10 times", kind = "stat", stat = "Crafts", goal = 10, gems = 5 },
	{ id = "craft100", name = "Master Smith", desc = "Forge 100 times", kind = "stat", stat = "Crafts", goal = 100, gems = 40, title = "smith" },
	{ id = "fuse5", name = "Pet Tinkerer", desc = "Fuse pets 5 times", kind = "stat", stat = "Fusions", goal = 5, gems = 5 },
	{ id = "fuse25", name = "Fusion Expert", desc = "Fuse pets 25 times", kind = "stat", stat = "Fusions", goal = 25, gems = 25 },
	{ id = "pvp5", name = "Arena Rookie", desc = "Win 5 PvP matches", kind = "stat", stat = "PvpWins", goal = 5, gems = 8 },
	{ id = "pvp50", name = "Gladiator", desc = "Win 50 PvP matches", kind = "stat", stat = "PvpWins", goal = 50, gems = 50, title = "gladiator", announce = true },
	{ id = "mini10", name = "Playful", desc = "Play 10 minigames", kind = "stat", stat = "Minigames", goal = 10, gems = 5 },
	{ id = "mini100", name = "Minigame Maniac", desc = "Play 100 minigames", kind = "stat", stat = "Minigames", goal = 100, gems = 30 },
	{ id = "reb1", name = "Reborn", desc = "Rebirth once", kind = "rebirths", goal = 1, gems = 15, title = "reborn" },
	{ id = "reb5", name = "Cycle of Power", desc = "Rebirth 5 times", kind = "rebirths", goal = 5, gems = 40 },
	{ id = "reb15", name = "Eternal", desc = "Rebirth 15 times", kind = "rebirths", goal = 15, gems = 120, announce = true },
	{ id = "pets5", name = "Pet Lover", desc = "Own 5 pets", kind = "pets", goal = 5, gems = 8 },
	{ id = "pets20", name = "Zoo Keeper", desc = "Own 20 pets", kind = "pets", goal = 20, gems = 35 },
	{ id = "idx15", name = "Collector", desc = "Fill 15 Index entries", kind = "index", goal = 15, gems = 15, title = "collector" },
	{ id = "idx40", name = "Completionist", desc = "Fill 40 Index entries", kind = "index", goal = 40, gems = 60, announce = true },
	{ id = "rate1200", name = "Rising Fighter", desc = "Reach 1200 PvP rating", kind = "rating", goal = 1200, gems = 15 },
	{ id = "rate1600", name = "PvP Champion", desc = "Reach 1600 PvP rating", kind = "rating", goal = 1600, gems = 80, announce = true },
	{ id = "clan1", name = "Team Player", desc = "Join a clan", kind = "clan", goal = 1, gems = 5 },
}

local function count(t)
	local n = 0
	for _ in pairs(t or {}) do
		n += 1
	end
	return n
end

-- Current value of a goal-kind for a save table (shared by server checks and client progress bars)
function A.Value(data, kind: string, stat: string?): number
	if kind == "stat" then
		return data.stats[stat] or 0
	elseif kind == "rebirths" then
		return data.rebirths or 0
	elseif kind == "pets" then
		local n = 0
		for _, it in pairs(data.items) do
			if it.kind == "pet" then
				n += 1
			end
		end
		return n
	elseif kind == "index" then
		return count(data.index.guns) + count(data.index.pets) + count(data.index.monsters)
	elseif kind == "rating" then
		return data.pvp.rating or 0
	elseif kind == "clan" then
		return (data.clan ~= "" and data.clan ~= nil) and 1 or 0
	end
	return 0
end

function A.RewardText(reward): string
	local parts = {}
	for _, k in ipairs({ "Coins", "Gems" }) do
		if reward[k] then
			table.insert(parts, ("%d %s"):format(reward[k], k))
		end
	end
	for id, n in pairs(reward.mats or {}) do
		table.insert(parts, ("%dx %s"):format(n, id:gsub("_", " ")))
	end
	if reward.boostMin then
		table.insert(parts, reward.boostMin .. "m boost")
	end
	if reward.title and A.Titles[reward.title] then
		table.insert(parts, "Title: " .. A.Titles[reward.title].name)
	end
	return table.concat(parts, " + ")
end

return A
