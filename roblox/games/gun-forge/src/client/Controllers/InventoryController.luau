-- Inventory: guns / armor (equip, salvage), materials, collection Index. Plus Rebirth + Codes windows.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Guns = require(Shared.Config.Guns)
local Materials = require(Shared.Config.Materials)
local Monsters = require(Shared.Config.Monsters)
local Pets = require(Shared.Config.Pets)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local State = require(script.Parent.Parent.ClientState)
local UIController = require(script.Parent.UIController)
local Forge = require(script.Parent.ForgeController)

local C = Theme.Colors
local Inv = {}
local body, tab = nil, "GUNS"
local GLYPH = { pistol = "🔫", smg = "🔫", shotgun = "🔫", rifle = "🔫", blaster = "✦", railgun = "⚡", helmet = "⛑", vest = "🦺", boots = "👢" }

local function isEquipped(uid: string): boolean
	local e = State.Inv.equipped
	return e.gun == uid or e.helmet == uid or e.vest == uid or e.boots == uid
end

local function renderGear(kind: string)
	W.grid(body, Vector2.new(140, 170))
	local list = {}
	for uid, it in pairs(State.Inv.items) do
		if it.kind == kind then
			table.insert(list, { uid = uid, it = it })
		end
	end
	table.sort(list, function(a, b)
		local va = a.it.dmg or a.it.hp or 0
		local vb = b.it.dmg or b.it.hp or 0
		return va > vb
	end)
	for i, e in ipairs(list) do
		local it = e.it
		local name = if kind == "gun" then Guns.Types[it.id].name else Guns.Armor[it.id].name
		local eq = isEquipped(e.uid)
		local card = W.card(body, i, it.rarity, GLYPH[it.id] or "★", ("%s T%d"):format(name, it.tier), Forge.StatText(it),
			if eq then "EQUIPPED" else "EQUIP", function()
				if not eq then
					Net.send("Equip", e.uid)
				end
			end, if eq then "ON" else nil)
		if not eq then
			local s = UI.button("♻", C.Danger, function()
				Net.send("Salvage", e.uid)
			end, { Size = UDim2.fromOffset(28, 28), Position = UDim2.new(1, -30, 0, 2), Parent = card })
			s.Label.TextSize = 14
		end
	end
	if #list == 0 then
		UI.label("Nothing yet — craft at the Forge!", 18, { Size = UDim2.fromOffset(560, 30), Parent = body })
	end
end

local function renderMats()
	W.grid(body, Vector2.new(140, 120))
	local i = 0
	for id, n in pairs(State.Inv.materials) do
		local def = Materials[id]
		if def then
			i += 1
			W.card(body, def.rarity * 100 + i, def.rarity, def.glyph, def.name, "x" .. W.short(n))
		end
	end
end

local function renderIndex()
	UIController.List(body)
	local idx = State.Inv.index
	local function count(t)
		local n = 0
		for _ in pairs(t or {}) do
			n += 1
		end
		return n
	end
	local totalGuns = #Guns.TypeOrder * #Guns.Rarities
	local totalPets, totalMon = 0, 0
	for _ in pairs(Pets.Pets) do
		totalPets += 1
	end
	for _ in pairs(Monsters) do
		totalMon += 1
	end
	UIController.Row(body, 1, "Guns discovered", ("%d / %d"):format(count(idx.guns), totalGuns), "", C.Panel, false, function() end, count(idx.guns) / totalGuns)
	UIController.Row(body, 2, "Pets discovered", ("%d / %d"):format(count(idx.pets), totalPets), "", C.Panel, false, function() end, count(idx.pets) / totalPets)
	UIController.Row(body, 3, "Monsters defeated", ("%d / %d"):format(count(idx.monsters), totalMon), "", C.Panel, false, function() end, count(idx.monsters) / totalMon)
	local o = 3
	for _, typeId in ipairs(Guns.TypeOrder) do
		o += 1
		local have = {}
		for r = 1, #Guns.Rarities do
			table.insert(have, if idx.guns[typeId .. "_" .. r] then "★" else "☆")
		end
		UIController.Row(body, o, Guns.Types[typeId].name, table.concat(have, " "), "", C.Panel, false, function() end)
	end
end

local function render()
	if not body then
		return
	end
	W.clear(body)
	if tab == "GUNS" then
		renderGear("gun")
	elseif tab == "ARMOR" then
		renderGear("armor")
	elseif tab == "MATS" then
		renderMats()
	else
		renderIndex()
	end
end

local function rebirthWindow()
	local _, rb = UIController.MakeWindow("Rebirth", "REBIRTH", C.Gold)
	UIController.List(rb)
	local function draw()
		UIController.Clear(rb)
		local info = Net.invoke("RebirthInfo")
		if not info then
			return
		end
		local ok = info.power >= info.cost
		UIController.Row(rb, 1, ("Rebirth %d → %d"):format(info.rebirths, info.rebirths + 1),
			("Training x%.2f → x%.2f  •  Resets Power + Coins, keeps items & pets"):format(info.now, info.after),
			"REBIRTH", C.Gold, ok, function()
				if Net.invoke("Rebirth") then
					UIController.Close("Rebirth")
				end
			end, info.power / info.cost)
		UIController.Row(rb, 2, "Requirement", ("%s / %s Power"):format(W.short(info.power), W.short(info.cost)), "", C.Panel, false, function() end)
	end
	Inv.DrawRebirth = draw
end

local function codesWindow()
	local win = UIController.MakeWindow("Codes", "CODES", C.Energy)
	local box = UI.new("TextBox", { PlaceholderText = "Enter code", Text = "", Font = Theme.Font, TextSize = 26, TextColor3 = C.Text, BackgroundColor3 = C.Bg,
		AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 120), Size = UDim2.fromOffset(360, 56), ClearTextOnFocus = false, Parent = win })
	UI.corner().Parent = box
	UI.stroke().Parent = box
	local res = UI.label("", 20, { Position = UDim2.fromOffset(0, 270), Size = UDim2.new(1, 0, 0, 30), Parent = win })
	UI.button("REDEEM", C.Primary, function()
		local r = Net.invoke("Redeem", box.Text)
		res.Text = if r == "OK" then "✔ Redeemed!" else tostring(r)
		res.TextColor3 = if r == "OK" then C.Primary else C.Danger
	end, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 196), Size = UDim2.fromOffset(220, 56), Parent = win })
end

local function gemWindow()
	local GemShop = require(Shared.Config.GemShop)
	local _, gb = UIController.MakeWindow("Gems", "GEM SHOP", Color3.fromRGB(181, 108, 255))
	UIController.List(gb)
	for i, it in ipairs(GemShop) do
		UIController.Row(gb, i, it.name, it.desc, ("💎 %d"):format(it.gems), Color3.fromRGB(181, 108, 255), true, function()
			Net.invoke("GemBuy", it.key)
		end)
	end
end

function Inv.Init()
	local win, b = UIController.MakeWindow("Inventory", "INVENTORY", C.Energy)
	body = b
	local select = W.tabs(win, b, { "GUNS", "ARMOR", "MATS", "INDEX" }, function(name)
		tab = name
		render()
	end)
	UI.button("♻ SALVAGE COMMONS", C.Danger, function()
		Net.send("SalvageAllCommon")
	end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -60, 0, 52), Size = UDim2.fromOffset(200, 40), Parent = win }).Label.TextSize = 14
	UIController.AddMenuButton(6, "BAG", C.Energy, "Inventory")
	State.InvChanged:Connect(function()
		if UIController.IsOpen("Inventory") then
			render()
		end
	end)
	select("GUNS")
	rebirthWindow()
	codesWindow()
	gemWindow()
	UIController.AddMenuButton(11, "GEMS", Color3.fromRGB(181, 108, 255), "Gems")
	UIController.AddMenuButton(9, "REBIRTH", C.Gold, "Rebirth").Activated:Connect(function()
		task.defer(Inv.DrawRebirth)
	end)
end

return Inv
