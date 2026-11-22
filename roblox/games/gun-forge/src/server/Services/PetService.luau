-- Fusion Altar pets: core (materials+coins) -> weighted roll (odds public) -> pet item.
-- Equip up to slots, combine 5 same -> golden -> rainbow, multipliers cached per player.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Pets = require(Shared.Config.Pets)
local Net = require(Shared.Net)

local PetService = {}
local S
local rng = Random.new()
local cache: { [Player]: { power: number, coins: number } } = {}
local coreById = {}
for _, c in ipairs(Pets.Cores) do
	coreById[c.id] = c
end

local function levelMult(lvl: number): number
	return if lvl >= 2 then Pets.RainbowMult elseif lvl == 1 then Pets.GoldenMult else 1
end

function PetService.Slots(player: Player): number
	return Pets.BaseSlots + (S.MonetizationService.GetPerk(player, "extraPetSlots") or 0)
end

local function recompute(player: Player)
	local d = S.DataService.Get(player)
	local m = { power = 1, coins = 1 }
	local tags = {}
	if d then
		for _, uid in ipairs(d.equipped.pets) do
			local it = d.items[uid]
			local def = it and Pets.Pets[it.id]
			if def then
				m.power += def.power * levelMult(it.lvl or 0)
				m.coins += def.coins * levelMult(it.lvl or 0)
				table.insert(tags, it.id .. ":" .. (it.lvl or 0))
			end
		end
	end
	cache[player] = m
	player:SetAttribute("Pets", table.concat(tags, ",")) -- clients render followers from this
end

function PetService.Multipliers(player: Player)
	return cache[player] or { power = 1, coins = 1 }
end

local function roll(odds): string
	local total = 0
	for _, w in pairs(odds) do
		total += w
	end
	local x = rng:NextNumber() * total
	local last
	for id, w in pairs(odds) do
		last = id
		x -= w
		if x <= 0 then
			return id
		end
	end
	return last
end

local function changed(player: Player)
	recompute(player)
	S.InventoryService.Sync(player)
	S.TrainingService.Push(player)
end

function PetService.Init(services)
	S = services
	S.DataService.Loaded:Connect(function(player)
		recompute(player)
	end)
	Players.PlayerRemoving:Connect(function(p)
		cache[p] = nil
	end)

	Net.handle("Fuse", function(player, coreId)
		local core = type(coreId) == "string" and coreById[coreId]
		if not core then
			return { ok = false }
		end
		if not S.InventoryService.CanAdd(player, "pet") then
			return { ok = false, err = "Pet storage full" }
		end
		if not S.InventoryService.Take(player, core.mats, core.coins) then
			return { ok = false, err = "Missing materials or coins" }
		end
		local petId = roll(core.odds)
		local lucky = false
		if S.MonetizationService.GetPerk(player, "forgeLuck") and rng:NextNumber() < 0.1 then
			local second = roll(core.odds) -- Lucky Forge: 10% chance to roll twice, keep rarer
			if Pets.Pets[second].rarity > Pets.Pets[petId].rarity then
				petId, lucky = second, true
			end
		end
		local uid = S.InventoryService.CreateItem(player, { kind = "pet", id = petId, lvl = 0 })
		S.QuestService.Progress(player, "Fusions", 1)
		if Pets.Pets[petId].rarity >= 5 then
			Net.fireAll("Announce", ("%s hatched a MYTHIC %s!"):format(player.DisplayName, Pets.Pets[petId].name))
		end
		-- auto-equip if a slot is free
		local d = S.DataService.Get(player)
		if d and uid and #d.equipped.pets < PetService.Slots(player) then
			S.DataService.Update(player, function(data)
				table.insert(data.equipped.pets, uid)
			end)
		end
		changed(player)
		return { ok = true, pet = petId, uid = uid, lucky = lucky }
	end, 2)

	Net.on("EquipPet", function(player, uid)
		local d = S.DataService.Get(player)
		local it = d and type(uid) == "string" and d.items[uid]
		if not it or it.kind ~= "pet" then
			return
		end
		S.DataService.Update(player, function(data)
			local i = table.find(data.equipped.pets, uid)
			if i then
				table.remove(data.equipped.pets, i)
			elseif #data.equipped.pets < PetService.Slots(player) then
				table.insert(data.equipped.pets, uid)
			end
		end)
		changed(player)
	end, 6)

	Net.on("EquipBestPets", function(player)
		local d = S.DataService.Get(player)
		if not d then
			return
		end
		local list = {}
		for uid, it in pairs(d.items) do
			if it.kind == "pet" and Pets.Pets[it.id] then
				table.insert(list, { uid = uid, v = Pets.Pets[it.id].power * levelMult(it.lvl or 0) })
			end
		end
		table.sort(list, function(a, b)
			return a.v > b.v
		end)
		S.DataService.Update(player, function(data)
			data.equipped.pets = {}
			for i = 1, math.min(#list, PetService.Slots(player)) do
				table.insert(data.equipped.pets, list[i].uid)
			end
		end)
		changed(player)
	end, 2)

	-- combine 5 identical (same id + level) into one of the next level
	Net.on("CombinePets", function(player, petId, lvl)
		local d = S.DataService.Get(player)
		if not d or type(petId) ~= "string" or type(lvl) ~= "number" or lvl < 0 or lvl > 1 then
			return
		end
		local uids = {}
		for uid, it in pairs(d.items) do
			if it.kind == "pet" and it.id == petId and (it.lvl or 0) == lvl then
				table.insert(uids, uid)
			end
		end
		if #uids < Pets.CombineCount then
			S.EconomyService.Toast(player, ("Need %d of the same pet"):format(Pets.CombineCount), "error")
			return
		end
		for i = 1, Pets.CombineCount do
			S.InventoryService.RemoveItem(player, uids[i])
		end
		S.InventoryService.CreateItem(player, { kind = "pet", id = petId, lvl = lvl + 1 })
		S.EconomyService.Toast(player, (lvl == 0 and "GOLDEN " or "RAINBOW ") .. Pets.Pets[petId].name .. "!", "success")
		changed(player)
	end, 2)

	Net.on("DeletePet", function(player, uid)
		local it = type(uid) == "string" and S.InventoryService.GetItem(player, uid)
		if it and it.kind == "pet" then
			S.InventoryService.RemoveItem(player, uid)
			changed(player)
		end
	end, 6)
end

return PetService
