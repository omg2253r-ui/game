-- Materials + unique items (guns, armor, pets), equip/salvage, index, client sync.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Guns = require(Shared.Config.Guns)
local Recipes = require(Shared.Config.Recipes)
local Pets = require(Shared.Config.Pets)
local Materials = require(Shared.Config.Materials)
local Net = require(Shared.Net)
local Signal = require(Shared.Signal)

local InventoryService = {}
InventoryService.GearChanged = Signal.new() -- (player, slot)
local S

local function countKind(items, kind: string): number
	local n = 0
	for _, it in pairs(items) do
		if (kind == "pet") == (it.kind == "pet") then
			n += 1
		end
	end
	return n
end

function InventoryService.Sync(player: Player)
	local d = S.DataService.Get(player)
	if not d then
		return
	end
	Net.fire(player, "Inv", { materials = d.inventory, items = d.items, equipped = d.equipped, index = d.index, rebirths = d.rebirths })
end

-- debounce syncs within the same frame burst
local pending: { [Player]: boolean } = {}
function InventoryService.SyncSoon(player: Player)
	if pending[player] then
		return
	end
	pending[player] = true
	task.delay(0.4, function()
		pending[player] = nil
		if player.Parent then
			InventoryService.Sync(player)
		end
	end)
end

function InventoryService.AddMaterial(player: Player, id: string, n: number)
	if not Materials[id] or n <= 0 then
		return
	end
	S.DataService.Update(player, function(d)
		d.inventory[id] = (d.inventory[id] or 0) + n
	end)
	InventoryService.SyncSoon(player)
end

function InventoryService.Has(player: Player, mats: { [string]: number }, coins: number?): boolean
	local d = S.DataService.Get(player)
	if not d then
		return false
	end
	for id, n in pairs(mats) do
		if (d.inventory[id] or 0) < n then
			return false
		end
	end
	return (coins or 0) <= (d.currencies.Coins or 0)
end

-- Atomically take materials + coins. Returns false if anything is missing.
function InventoryService.Take(player: Player, mats: { [string]: number }, coins: number?): boolean
	if not InventoryService.Has(player, mats, coins) then
		return false
	end
	if coins and coins > 0 and not S.EconomyService.Spend(player, "Coins", coins) then
		return false
	end
	S.DataService.Update(player, function(d)
		for id, n in pairs(mats) do
			d.inventory[id] -= n
			if d.inventory[id] <= 0 then
				d.inventory[id] = nil
			end
		end
	end)
	InventoryService.SyncSoon(player)
	return true
end

function InventoryService.ItemCount(player: Player, kind: string): number
	local d = S.DataService.Get(player)
	return d and countKind(d.items, kind) or 0
end

function InventoryService.CanAdd(player: Player, kind: string): boolean
	local limit = if kind == "pet" then Pets.MaxPets else Recipes.MaxItems
	return InventoryService.ItemCount(player, kind) < limit
end

-- item = { kind, id, tier, rarity, ... } -> uid
function InventoryService.CreateItem(player: Player, item): string?
	local uid
	S.DataService.Update(player, function(d)
		uid = "i" .. d.nextUid
		d.nextUid += 1
		d.items[uid] = item
		if item.kind == "gun" then
			d.index.guns[item.id .. "_" .. item.rarity] = true
		elseif item.kind == "pet" then
			d.index.pets[item.id] = true
		end
	end)
	InventoryService.SyncSoon(player)
	return uid
end

function InventoryService.RemoveItem(player: Player, uid: string)
	S.DataService.Update(player, function(d)
		d.items[uid] = nil
		for slot, v in pairs(d.equipped) do
			if v == uid then
				d.equipped[slot] = ""
			end
		end
		local i = table.find(d.equipped.pets, uid)
		if i then
			table.remove(d.equipped.pets, i)
		end
	end)
	InventoryService.SyncSoon(player)
end

function InventoryService.GetItem(player: Player, uid: string)
	local d = S.DataService.Get(player)
	return d and d.items[uid]
end

function InventoryService.EquippedGun(player: Player)
	local d = S.DataService.Get(player)
	return d and d.items[d.equipped.gun]
end

function InventoryService.MakeGun(typeId: string, tier: number, rarity: number, quality: number)
	return { kind = "gun", id = typeId, tier = tier, rarity = rarity, q = quality, dmg = Guns.GunDamage(typeId, tier, rarity, quality) }
end

function InventoryService.MakeArmor(slot: string, tier: number, rarity: number, quality: number)
	return { kind = "armor", id = slot, tier = tier, rarity = rarity, q = quality, hp = Guns.ArmorHp(slot, tier, rarity, quality) }
end

local function equip(player: Player, uid: string)
	local d = S.DataService.Get(player)
	local item = d and d.items[uid]
	if not item or item.kind == "pet" then
		return
	end
	local slot = if item.kind == "gun" then "gun" else item.id
	S.DataService.Update(player, function(data)
		data.equipped[slot] = uid
	end)
	InventoryService.GearChanged:Fire(player, slot)
	InventoryService.Sync(player)
end
InventoryService.Equip = equip

local function salvage(player: Player, uid: string)
	local d = S.DataService.Get(player)
	local item = d and d.items[uid]
	if not item or item.kind == "pet" then
		return
	end
	for slot, v in pairs(d.equipped) do
		if v == uid and slot ~= "pets" then
			S.EconomyService.Toast(player, "Unequip it first!", "error")
			return
		end
	end
	local recipe = Recipes.ById[item.id .. "_t" .. item.tier]
	local refund = recipe and math.floor(recipe.coins * Recipes.SalvageRefund * (1 + (item.rarity - 1) * 0.5)) or 10
	InventoryService.RemoveItem(player, uid)
	S.EconomyService.Add(player, "Coins", refund, "salvage", false)
	S.EconomyService.Toast(player, ("Salvaged for %d Coins"):format(refund), "info")
end

function InventoryService.Init(services)
	S = services
	Net.declare("Inv")

	S.DataService.Loaded:Connect(function(player, data)
		if next(data.items) == nil then -- starter pistol
			local st = Guns.Starter
			local uid = InventoryService.CreateItem(player, InventoryService.MakeGun(st.id, st.tier, st.rarity, st.quality))
			if uid then
				S.DataService.Update(player, function(d)
					d.equipped.gun = uid
				end)
			end
		end
		InventoryService.Sync(player)
		InventoryService.GearChanged:Fire(player, "gun")
	end)
	Players.PlayerRemoving:Connect(function(p)
		pending[p] = nil
	end)

	Net.on("Equip", function(player, uid)
		if type(uid) == "string" then
			equip(player, uid)
		end
	end, 4)
	Net.on("Unequip", function(player, slot)
		if slot == "helmet" or slot == "vest" or slot == "boots" then
			S.DataService.Update(player, function(d)
				d.equipped[slot] = ""
			end)
			InventoryService.GearChanged:Fire(player, slot)
			InventoryService.Sync(player)
		end
	end, 4)
	Net.on("Salvage", function(player, uid)
		if type(uid) == "string" then
			salvage(player, uid)
		end
	end, 6)
	Net.on("SalvageAllCommon", function(player)
		local d = S.DataService.Get(player)
		if not d then
			return
		end
		for uid, item in pairs(table.clone(d.items)) do
			if item.kind ~= "pet" and item.rarity == 1 and d.equipped.gun ~= uid and d.equipped[item.id] ~= uid then
				salvage(player, uid)
			end
		end
	end, 1)

	InventoryService.GearChanged:Connect(function(player, slot)
		if slot ~= "gun" then
			S.PlayerService.RefreshCharacter(player)
		end
	end)
end

return InventoryService
