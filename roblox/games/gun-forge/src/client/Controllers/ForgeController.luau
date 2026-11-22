-- Forge UI: recipe list (guns / armor, by tier) -> assembly minigame (timing taps per part)
-- -> rarity reveal card -> equip.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Recipes = require(Shared.Config.Recipes)
local Guns = require(Shared.Config.Guns)
local Materials = require(Shared.Config.Materials)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local State = require(script.Parent.Parent.ClientState)
local UIController = require(script.Parent.UIController)
local MG = require(script.Parent.MinigameController)

local C = Theme.Colors
local Forge = {}
local body, kindFilter = nil, "GUNS"
local PART_NAMES = { gun = { "Barrel", "Receiver", "Grip", "Sight", "Mag" }, armor = { "Plates", "Straps", "Core", "Padding", "Visor" } }
local GLYPH = { pistol = "🔫", smg = "🔫", shotgun = "🔫", rifle = "🔫", blaster = "✦", railgun = "⚡", helmet = "⛑", vest = "🦺", boots = "👢" }

local function matText(recipe): (string, boolean)
	local inv = State.Inv.materials
	local parts, ok = {}, true
	for id, n in pairs(recipe.mats) do
		local have = inv[id] or 0
		ok = ok and have >= n
		table.insert(parts, ("%s %d/%d"):format(Materials[id].glyph, have, n))
	end
	ok = ok and State.Coins() >= recipe.coins
	table.insert(parts, "🪙 " .. W.short(recipe.coins))
	return table.concat(parts, "  "), ok
end

local function enchText(item): string
	if not item.ench then
		return ""
	end
	for _, e in ipairs(Guns.Enchants) do
		if e.kind == item.ench.kind then
			return "  •  " .. e.name .. " " .. e.fmt:format(math.floor(item.ench.val * 100))
		end
	end
	return ""
end

local function statText(item): string
	if item.kind == "gun" then
		local t = Guns.Types[item.id]
		local lvl = item.lvl or 0
		local mastery = if lvl > 0 then ("  •  Lv%d"):format(lvl) else ""
		return ("DMG %s  •  %s/s%s%s"):format(W.short(item.dmg * (1 + lvl * Guns.Mastery.DamagePerLevel)), tostring(t.rate), mastery, enchText(item))
	end
	return ("+%s HP  •  Q%d%%"):format(W.short(item.hp), math.floor(item.q * 100))
end
Forge.StatText = statText

local function reveal(box: Frame, close: () -> (), res)
	for _, ch in ipairs(box:GetChildren()) do
		if ch.Name == "Play" then
			ch:Destroy()
		end
	end
	local item = res.item
	local r = Guns.Rarities[item.rarity]
	W.flash(UIController.Gui(), r.color)
	local name = if item.kind == "gun" then Guns.Types[item.id].name else Guns.Armor[item.id].name
	local card = W.card(box, 0, item.rarity, GLYPH[item.id] or "★", ("%s %s T%d"):format(r.name, name, item.tier), statText(item))
	card.AnchorPoint = Vector2.new(0.5, 0)
	card.Position = UDim2.new(0.5, 0, 0, 70)
	card.Size = UDim2.fromOffset(220, 150)
	local s = UI.new("UIScale", { Scale = 0.2, Parent = card })
	TweenService:Create(s, TweenInfo.new(0.5, Enum.EasingStyle.Back), { Scale = 1.3 }):Play()
	UI.label(("Perfect parts: %d%s"):format(res.perfects, if res.bumped then "  —  RARITY UP!" else ""), 18, { Position = UDim2.fromOffset(0, 300), Size = UDim2.new(1, 0, 0, 24), TextColor3 = if res.bumped then C.Gold else C.TextDim, Parent = box })
	UI.button("EQUIP", C.Primary, function()
		Net.send("Equip", res.uid)
		close()
	end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(0.5, -8, 1, -16), Size = UDim2.fromOffset(170, 52), Parent = box })
	UI.button("KEEP", C.PanelLight, close, { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0.5, 8, 1, -16), Size = UDim2.fromOffset(170, 52), Parent = box })
end

local function craft(recipe)
	local start = Net.invoke("ForgeStart", recipe.id)
	if not start or not start.ok then
		UIController.Toast(start and start.err or "Can't craft", "error")
		return
	end
	UIController.Close("Forge")
	local box, close = W.modal(UIController.Gui(), "ASSEMBLY", C.Forge)
	local names = PART_NAMES[recipe.kind]
	local perfects, index = 0, 1
	local partL = UI.label("", 30, { Name = "Play", Position = UDim2.fromOffset(0, 70), Size = UDim2.new(1, 0, 0, 36), TextColor3 = C.Gold, Parent = box })
	local slots = UI.new("Frame", { Name = "Play", BackgroundTransparency = 1, Position = UDim2.fromOffset(60, 120), Size = UDim2.new(1, -120, 0, 40), Parent = box })
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 10), Parent = slots })
	local slotFrames = {}
	for i = 1, start.parts do
		slotFrames[i] = UI.panel({ Size = UDim2.fromOffset(90, 36), BackgroundColor3 = C.Bg, Parent = slots }, { UI.label(names[i] or "Part", 13, { Size = UDim2.fromScale(1, 1) }) })
	end
	partL.Text = "Install: " .. names[1]
	local tap, stop
	local finished = false
	tap, stop = MG.TimingBar(box, 190, 1.1 + recipe.tier * 0.12, 0.14, function(perfect)
		if finished then
			return
		end
		local f = slotFrames[index]
		f.BackgroundColor3 = if perfect then C.Primary else C.Danger
		local sc = UI.new("UIScale", { Scale = 1.3, Parent = f })
		TweenService:Create(sc, Theme.Tween, { Scale = 1 }):Play()
		if perfect then
			perfects += 1
		end
		index += 1
		if index > start.parts then
			finished = true
			stop()
			partL.Text = "Forging..."
			task.wait(0.8)
			local res = Net.invoke("ForgeFinish", start.session, perfects)
			if res then
				reveal(box, close, res)
			else
				close()
			end
		else
			partL.Text = "Install: " .. (names[index] or "Part")
		end
	end)
	local btn = UI.button("HAMMER!", C.Forge, function()
		tap()
	end, { Name = "Play", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 260), Size = UDim2.fromOffset(240, 70), Parent = box })
	btn.Label.TextSize = 30
end

local function renderEnchant()
	UIController.List(body)
	UIController.Row(body, 0, "ENCHANT & MASTERY", ("Enchant: %d Gems + 2 rare cores of the gun's tier → random bonus (replaces old). Mastery: kills level guns up to Lv%d (+%d%% dmg/lv)."):format(
		Guns.EnchantCost.Gems, Guns.Mastery.MaxLevel, math.floor(Guns.Mastery.DamagePerLevel * 100)), "", C.Panel, false, function() end)
	local list = {}
	for uid, it in pairs(State.Inv.items) do
		if it.kind == "gun" then
			table.insert(list, { uid = uid, it = it })
		end
	end
	table.sort(list, function(a, b)
		return a.it.dmg > b.it.dmg
	end)
	for i, e in ipairs(list) do
		local it = e.it
		local core = Recipes.TierMats[it.tier][2]
		local have = State.Inv.materials[core] or 0
		local lvl = it.lvl or 0
		local progress = if lvl >= Guns.Mastery.MaxLevel then 1 else (it.xp or 0) / Guns.MasteryXpNeeded(lvl)
		UIController.Row(body, i, ("%s %s %s T%d  (Lv%d)"):format(GLYPH[it.id] or "", Guns.Rarities[it.rarity].name, Guns.Types[it.id].name, it.tier, lvl),
			statText(it) .. ("  •  %s %d/%d"):format(Materials[core].glyph, have, Guns.EnchantCost.RareCores), "ENCHANT", Color3.fromRGB(181, 108, 255),
			have >= Guns.EnchantCost.RareCores, function()
				local r = Net.invoke("Enchant", e.uid)
				if r and r.kind then
					W.flash(UIController.Gui(), Color3.fromRGB(181, 108, 255))
					UIController.Toast(("%s! %s"):format(r.name, enchText({ ench = r }):sub(6)), "success")
				elseif r and r.err then
					UIController.Toast(r.err, "error")
				end
			end, progress)
	end
end

local function render()
	if not body then
		return
	end
	W.clear(body)
	if kindFilter == "ENCHANT" then
		renderEnchant()
		return
	end
	UIController.List(body)
	local kind = if kindFilter == "GUNS" then "gun" else "armor"
	local list = {}
	for _, r in ipairs(Recipes.List) do
		if r.kind == kind then
			table.insert(list, r)
		end
	end
	table.sort(list, function(a, b)
		local _, oa = matText(a)
		local _, ob = matText(b)
		if oa ~= ob then
			return oa
		end
		return a.tier < b.tier
	end)
	for i, r in ipairs(list) do
		local name = if kind == "gun" then Guns.Types[r.item].name else Guns.Armor[r.item].name
		local text, ok = matText(r)
		UIController.Row(body, i, ("%s %s  (Tier %d)"):format(GLYPH[r.item] or "", name, r.tier), text, "CRAFT", C.Forge, ok, function()
			craft(r)
		end)
	end
end
Forge.Render = render

function Forge.Init()
	local win, b = UIController.MakeWindow("Forge", "THE FORGE", C.Forge)
	body = b
	local select = W.tabs(win, b, { "GUNS", "ARMOR", "ENCHANT" }, function(name)
		kindFilter = name
		render()
	end)
	UIController.AddMenuButton(5, "FORGE", C.Forge, "Forge").Activated:Connect(function()
		task.defer(render)
	end)
	State.InvChanged:Connect(function()
		if UIController.IsOpen("Forge") then
			render()
		end
	end)
	Net.listen("ForgeAuto", function(res)
		UIController.Toast("Forge finished automatically: " .. Guns.Rarities[res.item.rarity].name, "info")
	end)
	select("GUNS")
end

return Forge
