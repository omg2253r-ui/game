-- Builds the whole HUD + menus in code: currency bar, side menu, Shop (passes + products),
-- Rewards (daily + playtime), Quests, Settings, toasts. Mobile-safe via UIScale on viewport.
local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local GamePasses = require(Shared.Config.GamePasses)
local Products = require(Shared.Config.Products)
local Economy = require(Shared.Config.Economy)
local Settings = require(Shared.Config.Settings)
local UI = require(script.Parent.Parent.UIKit)

local C = Theme.Colors
local ROBUX = utf8.char(0xE002) -- renders as the Robux icon in Roblox fonts
local player = Players.LocalPlayer
local UIController = { State = { currencies = {}, passes = {}, settings = {} } }

local gui, panels, currencyLabels = nil, {}, {}
local menuButtons, badgeSetters, badgeCounts = {}, {}, {}
local menuToggle, menuToggleBadge, setMenuOpen

-- window name -> { image key (Config/UiImages), fallback glyph, short title, tooltip text }
local META = {
	Shop = { "menu_shop", "🛒", "SHOP", "Shop - passes, gem packs and boosts" },
	Rewards = { "menu_rewards", "🎁", "REWARDS", "Rewards - daily gift and playtime prizes" },
	Quests = { "menu_quests", "📜", "QUESTS", "Daily quests" },
	Minigames = { "menu_games", "🎮", "GAMES", "Training games - earn Power fast" },
	Forge = { "menu_forge", "🔨", "FORGE", "Forge - craft guns and armor" },
	Inventory = { "menu_bag", "🎒", "BAG", "Bag - guns, armor, materials, index" },
	Pets = { "menu_pets", "🐾", "PETS", "Pets - hatch, fuse and equip" },
	Arena = { "menu_pvp", "⚔", "PVP", "PvP arena and tournaments" },
	Rebirth = { "menu_rebirth", "🔄", "REBIRTH", "Rebirth - reset for a permanent boost" },
	Clan = { "menu_clan", "🛡", "CLAN", "Clans and clan wars" },
	Gems = { "menu_gems", "💎", "GEMS", "Gem shop" },
	Raid = { "menu_raid", "💀", "RAID", "Co-op raid vs a boss" },
	Season = { "menu_pass", "🎫", "PASS", "Season pass - claim tier rewards" },
	Achievements = { "menu_goals", "🏆", "GOALS", "Goals, titles and story" },
	Spin = { "menu_spin", "🎡", "SPIN", "Daily spin wheel" },
	Settings = { "menu_settings", "⚙", "SETTINGS", "Settings" },
	Codes = { "menu_rewards", "🎟", "CODES", "Redeem codes" },
}
UIController.Meta = META
local shownCoins = {}

local function sorted(tbl)
	local list = {}
	for k, v in pairs(tbl) do
		table.insert(list, { key = k, def = v })
	end
	table.sort(list, function(a, b)
		return (a.def.order or 99) < (b.def.order or 99)
	end)
	return list
end

local function rewardText(reward)
	local parts = {}
	for cur, n in pairs(reward) do
		table.insert(parts, UI.formatNumber(n) .. " " .. cur)
	end
	return table.concat(parts, " + ")
end

---------------------------------------------------------------- toasts
local toastHolder
function UIController.Toast(text: string, kind: string?)
	local color = if kind == "success" then C.Primary elseif kind == "error" then C.Danger else C.PanelLight
	local t = UI.panel({ Size = UDim2.fromOffset(360, 48), BackgroundColor3 = color, Parent = toastHolder }, {
		UI.label(text, 20, { Size = UDim2.fromScale(1, 1) }),
	})
	UI.pop(t, true)
	task.delay(2.6, function()
		UI.pop(t, false)
		task.wait(0.2)
		t:Destroy()
	end)
end

---------------------------------------------------------------- panels
local function makeWindow(name: string, title: string, accent: Color3)
	local win = UI.panel({
		Name = name,
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(640, 420),
		Visible = false,
		Parent = gui,
	})
	UI.gradient(C.Panel, C.Bg).Parent = win
	UI.skinPanel(win, "panel_bg")
	-- consistent layout: icon + title header, close button top-right
	local header = UI.panel({ Name = "Header", Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = accent, Parent = win }, {
		UI.label(title, 30, { Size = UDim2.fromScale(1, 1) }),
	})
	local meta = META[name]
	if meta and UI.hasImage(meta[1]) then
		local ic = UI.image(meta[1], meta[2], accent, 46)
		ic.Position = UDim2.fromOffset(8, 5)
		ic.ZIndex = 3
		ic.Parent = header
	end
	local closeBtn = UI.button("X", C.Danger, function()
		UI.pop(win, false)
	end, { Name = "Close", Size = UDim2.fromOffset(48, 48), Position = UDim2.new(1, -52, 0, 4), ZIndex = 3, Parent = header })
	closeBtn.Label.ZIndex = 4
	local body = UI.new("ScrollingFrame", {
		Name = "Body",
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Position = UDim2.fromOffset(12, 68),
		Size = UDim2.new(1, -24, 1, -80),
		ScrollBarThickness = 6,
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		CanvasSize = UDim2.new(),
		Parent = win,
	})
	panels[name] = win
	return win, body
end

local function toggle(name: string)
	for n, p in pairs(panels) do
		if n ~= name and p.Visible then
			UI.pop(p, false)
		end
	end
	local p = panels[name]
	UI.pop(p, not p.Visible)
	if UI.isTouch() and setMenuOpen then
		setMenuOpen(false) -- phones: give the window the whole screen
	end
end

local function buyPass(key, def)
	if def.id == 0 then
		if RunService:IsStudio() then
			Net.send("StudioTestBuy", "pass", key)
		else
			UIController.Toast("Coming soon!", "info")
		end
		return
	end
	MarketplaceService:PromptGamePassPurchase(player, def.id)
end

local function buyProduct(key, def)
	if def.id == 0 then
		if RunService:IsStudio() then
			Net.send("StudioTestBuy", "product", key)
		else
			UIController.Toast("Coming soon!", "info")
		end
		return
	end
	MarketplaceService:PromptProductPurchase(player, def.id)
end

local shopBody
local function buildShop()
	local win, body = makeWindow("Shop", "SHOP", C.Accent)
	shopBody = body
	if UI.hasImage("banner_shop") then -- banner on top, cards below
		UI.new("ImageLabel", { Name = "Banner", Image = UI.imageId("banner_shop") :: string, ScaleType = Enum.ScaleType.Crop, BackgroundTransparency = 1, Position = UDim2.fromOffset(12, 62), Size = UDim2.new(1, -24, 0, 96), Parent = win }, { UI.corner() })
		body.Position = UDim2.fromOffset(12, 166)
		body.Size = UDim2.new(1, -24, 1, -178)
	end
	UI.new("UIGridLayout", {
		CellSize = UDim2.fromOffset(190, 250),
		CellPadding = UDim2.fromOffset(12, 12),
		SortOrder = Enum.SortOrder.LayoutOrder,
		Parent = body,
	})
end

local function renderShop()
	for _, ch in ipairs(shopBody:GetChildren()) do
		if ch:IsA("GuiObject") then
			ch:Destroy()
		end
	end
	local order = 0
	local function card(title, desc, priceText, color, image, glyph, owned, onBuy, tag, imgKey)
		order += 1
		local c = UI.panel({ LayoutOrder = order, BackgroundColor3 = C.PanelLight, Parent = shopBody })
		UI.gradient(color:Lerp(C.PanelLight, 0.55), C.Panel).Parent = c
		local ic = if image and image ~= "" and image ~= "rbxassetid://0" then UI.icon(image, glyph, color, 84) else UI.image(imgKey, glyph, color, 84)
		ic.AnchorPoint = Vector2.new(0.5, 0)
		ic.Position = UDim2.new(0.5, 0, 0, 10)
		ic.Parent = c
		UI.label(title, 22, { Position = UDim2.fromOffset(0, 98), Parent = c })
		UI.label(desc, 14, {
			Font = Theme.FontBody,
			TextColor3 = C.TextDim,
			Position = UDim2.fromOffset(8, 126),
			Size = UDim2.new(1, -16, 0, 60),
			TextYAlignment = Enum.TextYAlignment.Top,
			Parent = c,
		})
		if tag then
			UI.panel({ Size = UDim2.fromOffset(96, 24), Position = UDim2.fromOffset(-6, -8), BackgroundColor3 = C.Danger, Rotation = -8, Parent = c }, {
				UI.label(tag, 14, { Size = UDim2.fromScale(1, 1) }),
			})
		end
		local btn = UI.button(owned and "OWNED" or priceText, owned and C.PanelLight or C.Robux, function()
			if not owned then
				onBuy()
			end
		end, { Size = UDim2.new(1, -20, 0, 44), Position = UDim2.new(0, 10, 1, -54), Parent = c })
		btn.Active = not owned
	end
	for _, e in ipairs(sorted(GamePasses)) do
		local owned = table.find(UIController.State.passes, e.key) ~= nil
		card(e.def.name, e.def.desc, ROBUX .. " " .. e.def.price, e.def.color, e.def.icon, "⭐", owned, function()
			buyPass(e.key, e.def)
		end, nil, "menu_pass")
	end
	for _, e in ipairs(sorted(Products)) do
		local cur = next(e.def.grant or {}) or "Coins"
		local col = Economy.Currencies[cur] and Economy.Currencies[cur].color or C.Accent
		card(e.def.name, "Instant delivery. Buy as many as you like!", ROBUX .. " " .. e.def.price, col, e.def.icon, cur == "Gems" and "💎" or "🪙", false, function()
			buyProduct(e.key, e.def)
		end, e.def.tag, if cur == "Gems" then "cur_gems" else "cur_coins")
	end
end

local rewardsBody, questsBody
local function list(body)
	UI.new("UIListLayout", { Padding = UDim.new(0, 10), SortOrder = Enum.SortOrder.LayoutOrder, Parent = body })
end

-- iconKey (optional, Config/UiImages key) adds a portrait on the left; skipped until that image is uploaded.
local function row(body, order, title, sub, btnText, btnColor, enabled, onClick, progress, iconKey)
	local r = UI.panel({ LayoutOrder = order, Size = UDim2.new(1, -8, 0, 72), BackgroundColor3 = C.PanelLight, Parent = body })
	local x = 14
	if UI.hasImage(iconKey) then
		local ic = UI.image(iconKey, "", C.Primary, 52)
		ic.Position = UDim2.fromOffset(8, 10)
		ic.Parent = r
		x = 68
	end
	UI.label(title, 20, { Position = UDim2.fromOffset(x, 8), Size = UDim2.new(1, -176 - x, 0, 26), TextXAlignment = Enum.TextXAlignment.Left, Parent = r })
	UI.label(sub, 15, { Font = Theme.FontBody, TextColor3 = C.TextDim, Position = UDim2.fromOffset(x, 38), Size = UDim2.new(1, -176 - x, 0, 22), TextXAlignment = Enum.TextXAlignment.Left, Parent = r })
	if progress then
		local bar = UI.new("Frame", { BackgroundColor3 = C.Bg, Position = UDim2.new(0, x, 1, -12), Size = UDim2.new(1, -186 - x, 0, 6), Parent = r }, { UI.corner(UDim.new(1, 0)) })
		UI.new("Frame", { BackgroundColor3 = C.Primary, Size = UDim2.fromScale(math.clamp(progress, 0, 1), 1), Parent = bar }, { UI.corner(UDim.new(1, 0)) })
	end
	local b = UI.button(btnText, enabled and btnColor or C.Panel, function()
		if enabled then
			onClick()
		end
	end, { Size = UDim2.fromOffset(160, 50), Position = UDim2.new(1, -170, 0.5, -25), Parent = r })
	b.Active = enabled
end

local function clear(body)
	for _, ch in ipairs(body:GetChildren()) do
		if ch:IsA("GuiObject") then
			ch:Destroy()
		end
	end
end

function UIController.RenderRewards(state)
	clear(rewardsBody)
	local d = state.daily
	local function curIcon(reward)
		return if reward and reward.Gems then "cur_gems" else "cur_coins"
	end
	local ready = if d.canClaim then 1 else 0
	row(rewardsBody, 0, "Daily Reward — Day " .. (d.streak + 1), rewardText(d.rewards[d.nextIndex]), d.canClaim and "CLAIM" or "TOMORROW", C.Primary, d.canClaim, function()
		Net.send("ClaimDaily")
	end, nil, "menu_rewards")
	for i, p in ipairs(state.playtime) do
		local label = p.claimed and "CLAIMED" or (p.ready and "CLAIM" or (p.minutes .. " MIN"))
		row(rewardsBody, i, "Play " .. p.minutes .. " minutes", rewardText(p.reward), label, C.Accent, p.ready and not p.claimed, function()
			Net.send("ClaimPlaytime", i)
		end, state.sessionMinutes / p.minutes, curIcon(p.reward))
		if p.ready and not p.claimed then
			ready += 1
		end
	end
	UIController.SetBadge("Rewards", ready)
end

function UIController.RenderQuests(quests)
	clear(questsBody)
	local claimable = 0
	for i, q in ipairs(quests) do
		local done = q.progress >= q.goal
		if done and not q.claimed then
			claimable += 1
		end
		row(questsBody, i, q.text, ("%d / %d  •  %s"):format(q.progress, q.goal, rewardText(q.reward)), q.claimed and "DONE" or (done and "CLAIM" or "IN PROGRESS"), C.Primary, done and not q.claimed, function()
			Net.send("ClaimQuest", i)
		end, q.progress / q.goal, if q.reward and q.reward.Gems then "cur_gems" else "menu_quests")
	end
	UIController.SetBadge("Quests", claimable)
end

local settingsBody
local function renderSettings()
	clear(settingsBody)
	local names = { { "music", "Music" }, { "sfx", "Sound Effects" }, { "lowFx", "Low Graphics Mode (less lag)" } }
	for i, pair in ipairs(names) do
		local key, title = pair[1], pair[2]
		local on = UIController.State.settings[key] == true
		row(settingsBody, i, title, on and "ON" or "OFF", on and "TURN OFF" or "TURN ON", on and C.Danger or C.Primary, true, function()
			UIController.State.settings[key] = not on
			Net.send("SetSetting", key, not on)
			renderSettings()
			UIController.SettingsChanged(UIController.State.settings)
		end, nil, "menu_settings")
	end
end
UIController.SettingsChanged = function(_) end -- overwritten by Main

---------------------------------------------------------------- public helpers for genre controllers
local menuFrame
-- Icon-first menu tile: image (or code-drawn glyph) + small label, tooltip on PC, notification dot.
function UIController.AddMenuButton(order: number, text: string, color: Color3, windowName: string)
	local meta = META[windowName] or { "", "★", text, text }
	local b = UI.button("", color:Lerp(C.Bg, 0.6), function()
		toggle(windowName)
	end, { LayoutOrder = order, Size = UDim2.fromOffset(84, 64), Skin = false, Parent = menuFrame })
	b.Label.Text = text
	b.Label.TextSize = 12
	b.Label.Size = UDim2.new(1, 0, 0, 16)
	b.Label.Position = UDim2.new(0, 0, 1, -18)
	local ic = UI.image(meta[1], meta[2], color, 40)
	ic.AnchorPoint = Vector2.new(0.5, 0)
	ic.Position = UDim2.new(0.5, 0, 0, 3)
	ic.Parent = b
	UI.tooltip(b, meta[4])
	menuButtons[windowName] = b
	badgeSetters[windowName] = UI.badge(b)
	if badgeCounts[windowName] then
		badgeSetters[windowName](badgeCounts[windowName])
	end
	return b
end
-- red dot on a menu icon (n > 0 shows it; 2..9 shows the number). Also lights the MENU toggle while collapsed.
function UIController.SetBadge(windowName: string, n: number)
	badgeCounts[windowName] = n
	local set = badgeSetters[windowName]
	if set then
		set(n)
	end
	if menuToggleBadge then
		local total = 0
		for _, v in pairs(badgeCounts) do
			total += v
		end
		menuToggleBadge(total)
	end
end
function UIController.GetMenuButton(windowName: string): GuiButton?
	return menuButtons[windowName]
end
function UIController.SetMenuOpen(open: boolean)
	if setMenuOpen then
		setMenuOpen(open)
	end
end
UIController.MakeWindow = makeWindow
UIController.Toggle = toggle
UIController.Row = row
UIController.Clear = clear
UIController.List = list
function UIController.Open(name: string)
	local p = panels[name]
	if p and not p.Visible then
		toggle(name)
	end
end
function UIController.Close(name: string)
	local p = panels[name]
	if p and p.Visible then
		UI.pop(p, false)
	end
end
function UIController.IsOpen(name: string): boolean
	return panels[name] ~= nil and panels[name].Visible
end
function UIController.Gui(): ScreenGui
	return gui
end

---------------------------------------------------------------- HUD
local function currencyPill(name: string, def, order: number, parent)
	local pill = UI.panel({ LayoutOrder = order, Size = UDim2.fromOffset(190, 46), BackgroundColor3 = C.Bg, Parent = parent })
	local ic = UI.image(if name == "Gems" then "cur_gems" else "cur_coins", name == "Gems" and "💎" or "🪙", def.color, 40)
	ic.Position = UDim2.fromOffset(3, 3)
	ic.Parent = pill
	currencyLabels[name] = UI.label("0", 24, { Position = UDim2.fromOffset(48, 0), Size = UDim2.new(1, -56, 1, 0), TextXAlignment = Enum.TextXAlignment.Left, Parent = pill })
	shownCoins[name] = 0
end

local function animateCurrency(name: string, target: number)
	local label = currencyLabels[name]
	if not label then
		return
	end
	local from = shownCoins[name] or 0
	shownCoins[name] = target
	if from == target then
		label.Text = UI.formatNumber(target)
		return
	end
	local nv = Instance.new("NumberValue")
	nv.Value = from
	nv.Changed:Connect(function(v)
		label.Text = UI.formatNumber(v)
	end)
	local t = TweenService:Create(nv, TweenInfo.new(0.5, Enum.EasingStyle.Quad), { Value = target })
	t.Completed:Once(function()
		nv:Destroy()
		label.Text = UI.formatNumber(target)
	end)
	t:Play()
	local pill = label.Parent
	local s = pill:FindFirstChildOfClass("UIScale") or UI.new("UIScale", { Parent = pill })
	s.Scale = 1.12
	TweenService:Create(s, Theme.Tween, { Scale = 1 }):Play()
end

function UIController.Apply(state)
	UIController.State = state
	for name, v in pairs(state.currencies or {}) do
		animateCurrency(name, v)
	end
	if shopBody then
		renderShop()
	end
	if settingsBody then
		renderSettings()
	end
end

function UIController.Init()
	gui = UI.new("ScreenGui", {
		Name = "GameUI",
		ResetOnSpawn = false,
		IgnoreGuiInset = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		Parent = player:WaitForChild("PlayerGui"),
	})
	-- responsive scale: design at 1280x720, scale down on phones
	local scale = UI.new("UIScale", { Parent = gui })
	local function rescale()
		local vp = workspace.CurrentCamera.ViewportSize
		scale.Scale = math.clamp(math.min(vp.X / 1280, vp.Y / 720) * 1.1, 0.55, 1.25)
	end
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	rescale()

	-- currency bar (top-left)
	local bar = UI.new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(12, 12), Size = UDim2.fromOffset(400, 46), Parent = gui })
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = bar })
	local i = 0
	for _, e in ipairs(sorted(Economy.Currencies)) do
		i += 1
		currencyPill(e.key, e.def, i, bar)
	end

	-- side menu (left): MENU toggle + 2-column grid of icon tiles; collapsed by default on phones
	local holder = UI.new("Frame", { Name = "MenuHolder", BackgroundTransparency = 1, Position = UDim2.fromOffset(12, 64), Size = UDim2.fromOffset(176, 40), Parent = gui })
	menuToggle = UI.button("MENU", C.PanelLight, function()
		setMenuOpen(not menuFrame.Visible)
	end, { Size = UDim2.fromOffset(176, 40), Skin = false, Parent = holder })
	menuToggle.Label.TextSize = 18
	menuToggleBadge = UI.badge(menuToggle)
	local menu = UI.new("Frame", { Name = "Menu", BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 46), Size = UDim2.fromOffset(176, 560), Parent = holder })
	UI.new("UIGridLayout", { CellSize = UDim2.fromOffset(84, 64), CellPadding = UDim2.fromOffset(8, 6), SortOrder = Enum.SortOrder.LayoutOrder, Parent = menu })
	menuFrame = menu
	setMenuOpen = function(open: boolean)
		menu.Visible = open
		menuToggle.Label.Text = if open then "MENU  ▲" else "MENU  ▼"
	end
	UIController.AddMenuButton(1, "SHOP", C.Accent, "Shop")
	UIController.AddMenuButton(2, "REWARDS", C.Primary, "Rewards")
	UIController.AddMenuButton(3, "QUESTS", Color3.fromRGB(90, 150, 255), "Quests")
	UIController.AddMenuButton(99, "SETTINGS", C.PanelLight, "Settings")
	setMenuOpen(not UI.isTouch())

	buildShop()
	local _, rb = makeWindow("Rewards", "REWARDS", C.Primary)
	rewardsBody = rb
	list(rb)
	local _, qb = makeWindow("Quests", "DAILY QUESTS", Color3.fromRGB(90, 150, 255))
	questsBody = qb
	list(qb)
	local _, sb = makeWindow("Settings", "SETTINGS", C.PanelLight)
	settingsBody = sb
	list(sb)

	toastHolder = UI.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 70), Size = UDim2.fromOffset(360, 300), Parent = gui })
	UI.new("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Center, Parent = toastHolder })

	-- title splash
	local splash = UI.label(Settings.GameName, 64, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.3), Size = UDim2.fromOffset(900, 90), TextColor3 = C.Accent, Parent = gui })
	task.delay(2.5, function()
		TweenService:Create(splash, TweenInfo.new(0.6), { TextTransparency = 1 }):Play()
		TweenService:Create(splash:FindFirstChildOfClass("UIStroke"), TweenInfo.new(0.6), { Transparency = 1 }):Play()
		task.wait(0.7)
		splash:Destroy()
	end)
	renderShop()
end

return UIController
