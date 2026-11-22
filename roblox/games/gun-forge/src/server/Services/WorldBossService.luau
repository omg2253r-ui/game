-- World boss in the hub every N minutes: HP scales to the players online, everyone who helps gets
-- rewards by damage share, top 3 get Gems. Telegraphed slam AoE keeps it active, not AFK.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Combat = require(Shared.Config.Combat)
local Guns = require(Shared.Config.Guns)
local Recipes = require(Shared.Config.Recipes)
local Net = require(Shared.Net)

local WorldBossService = {}
local S
local TIER_COINS = { 500, 8000, 120000, 1500000, 25000000 }
local DEF = { name = "TITAN OF THE FORGE", hp = 1, damage = 0, coins = 0, power = 0, drops = {},
	color = Color3.fromRGB(255, 79, 216), size = 22, boss = true, speed = 0, respawn = 0 }

local function scaledHp(): number
	local total = 0
	for _, p in ipairs(Players:GetPlayers()) do
		total += 30 * Guns.PowerFactor(S.PlayerService.GetPower(p)) * 1.5 -- ~starter dps with upgrades
	end
	return math.max(Combat.WorldBoss.Hp, math.floor(total * 90)) -- ~90 s with everyone shooting
end

local function onDeath(rec, pos)
	local total = 0
	for _, dmg in pairs(rec.contrib) do
		total += dmg
	end
	local ranking = {}
	for p, dmg in pairs(rec.contrib) do
		if p.Parent and dmg >= total * 0.01 then
			table.insert(ranking, { p = p, dmg = dmg })
		end
	end
	table.sort(ranking, function(a, b)
		return a.dmg > b.dmg
	end)
	for i, r in ipairs(ranking) do
		local p = r.p
		local tier = S.ZoneService.BestTier(S.PlayerService.GetPower(p))
		local coins = math.floor(TIER_COINS[tier] * (0.5 + r.dmg / total * #ranking))
		S.EconomyService.Add(p, "Coins", coins, "worldboss", true)
		S.InventoryService.AddMaterial(p, Recipes.TierMats[tier][2], 3)
		local gems = ({ 30, 20, 10 })[i]
		if gems then
			S.EconomyService.Add(p, "Gems", gems, "worldboss", false)
		end
		S.QuestService.Progress(p, "BossKills", 1)
		S.ClanService.AddXp(p, 50)
		Net.fire(p, "Loot", pos, { coins = coins, power = 0, mats = { [Recipes.TierMats[tier][2]] = 3 }, rank = i })
	end
	Net.fireAll("Announce", "The World Boss has been defeated!")
end

local function run()
	local pos = Combat.WorldBoss.Position
	Net.fireAll("Announce", "WORLD BOSS arrives in 60 seconds at the Boss Pit!")
	task.wait(60)
	local hp = scaledHp()
	local rec = S.MonsterService.Spawn("world_boss", pos, { def = DEF, static = true, onDeath = onDeath, hpOverride = hp })
	Net.fireAll("Announce", "The World Boss is here! Shoot it!")
	local t0 = os.clock()
	while S.MonsterService.Get(rec.id) and os.clock() - t0 < 360 do
		task.wait(6)
		if not S.MonsterService.Get(rec.id) then
			break
		end
		local center = Vector3.new(pos.X, 0, pos.Z)
		Net.fireAll("BossSlam", center, 28, 1.4) -- telegraph: radius, delay
		task.wait(1.4)
		for _, p in ipairs(Players:GetPlayers()) do
			local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
			local hum = p.Character and p.Character:FindFirstChildOfClass("Humanoid")
			if root and hum and (Vector3.new(root.Position.X, 0, root.Position.Z) - center).Magnitude < 28 then
				hum:TakeDamage(hum.MaxHealth * 0.3)
			end
		end
	end
	if S.MonsterService.Get(rec.id) then
		S.MonsterService.Remove(rec.id)
		Net.fireAll("Announce", "The World Boss escaped... next time!")
	end
end

function WorldBossService.Init(services)
	S = services
	Net.declare("BossSlam")
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(Combat.WorldBoss.IntervalMinutes * 60 - 60)
			if #Players:GetPlayers() > 0 then
				run()
			end
		end
	end)
end

return WorldBossService
