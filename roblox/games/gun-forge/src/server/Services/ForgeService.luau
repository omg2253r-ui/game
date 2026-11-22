-- Forge: recipe -> take materials/coins -> assembly minigame session -> rarity/quality roll -> item.
-- Minigame only nudges odds (bump chance + quality), so client-reported results are low-risk; the
-- server still enforces min duration, clamps hits and auto-finishes abandoned sessions (no lost mats).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Recipes = require(Shared.Config.Recipes)
local Guns = require(Shared.Config.Guns)
local Net = require(Shared.Net)

local ForgeService = {}
local S
local rng = Random.new()
local sessions: { [Player]: { recipe: any, t0: number, id: number } } = {}
local sid = 0

local function rollRarity(): number
	local total = 0
	for _, r in ipairs(Guns.Rarities) do
		total += r.weight
	end
	local x = rng:NextNumber() * total
	for i, r in ipairs(Guns.Rarities) do
		x -= r.weight
		if x <= 0 then
			return i
		end
	end
	return 1
end

local function finish(player: Player, perfects: number)
	local sess = sessions[player]
	if not sess then
		return nil
	end
	sessions[player] = nil
	local cfg = Recipes.Minigame
	perfects = math.clamp(math.floor(perfects), 0, cfg.Parts)
	local recipe = sess.recipe
	local rarity = rollRarity()
	local bump = perfects * cfg.PerfectBump
	if S.MonetizationService.GetPerk(player, "forgeLuck") then
		bump += cfg.PassBump
	end
	local bumped = false
	if rarity < #Guns.Rarities and rng:NextNumber() < bump then
		rarity += 1
		bumped = true
	end
	local skill = perfects / cfg.Parts
	local quality = cfg.QualityMin + (cfg.QualityMax - cfg.QualityMin) * (skill * 0.7 + rng:NextNumber() * 0.3)
	quality = math.floor(quality * 100) / 100
	local item = if recipe.kind == "gun"
		then S.InventoryService.MakeGun(recipe.item, recipe.tier, rarity, quality)
		else S.InventoryService.MakeArmor(recipe.item, recipe.tier, rarity, quality)
	local uid = S.InventoryService.CreateItem(player, item)
	S.QuestService.Progress(player, "Crafts", 1)
	if rarity >= 4 then
		S.AnalyticsService.Badge(player, "FirstLegendary")
		if rarity == 5 then
			Net.fireAll("Announce", ("%s forged a MYTHIC %s!"):format(player.DisplayName, recipe.item))
		end
	end
	return { uid = uid, item = item, bumped = bumped, perfects = perfects }
end

function ForgeService.Init(services)
	S = services
	Net.declare("Announce")

	Net.handle("ForgeStart", function(player, recipeId)
		local recipe = type(recipeId) == "string" and Recipes.ById[recipeId]
		if not recipe or sessions[player] then
			return { ok = false, err = "busy" }
		end
		if not S.InventoryService.CanAdd(player, "gun") then
			return { ok = false, err = "Inventory full — salvage some items" }
		end
		if not S.InventoryService.Take(player, recipe.mats, recipe.coins) then
			return { ok = false, err = "Missing materials or coins" }
		end
		sid += 1
		local id = sid
		sessions[player] = { recipe = recipe, t0 = os.clock(), id = id }
		task.delay(60, function() -- abandoned -> finish with 0 perfects
			if sessions[player] and sessions[player].id == id then
				local res = finish(player, 0)
				if res then
					Net.fire(player, "ForgeAuto", res)
				end
			end
		end)
		return { ok = true, session = id, parts = Recipes.Minigame.Parts }
	end, 2)
	Net.declare("ForgeAuto")

	Net.handle("ForgeFinish", function(player, sessionId, perfects)
		local sess = sessions[player]
		if not sess or sess.id ~= sessionId or type(perfects) ~= "number" then
			return nil
		end
		if os.clock() - sess.t0 < Recipes.Minigame.MinSeconds then
			perfects = 0 -- too fast = bot; still give the item
		end
		return finish(player, perfects)
	end, 2)

	Players.PlayerRemoving:Connect(function(p)
		if sessions[p] then
			finish(p, 0) -- runs before DataService releases the profile in practice; item is saved with it
		end
	end)
end

return ForgeService
