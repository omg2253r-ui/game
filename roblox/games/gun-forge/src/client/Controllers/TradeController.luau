-- Trading UI: player list -> request, invite popup, trade window (pick ≤ 8 items, see partner's
-- offer live, READY both -> 3 s countdown -> done). Plus the event banner (2x weekend etc.).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Guns = require(Shared.Config.Guns)
local Pets = require(Shared.Config.Pets)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local State = require(script.Parent.Parent.ClientState)
local UIController = require(script.Parent.UIController)

local C = Theme.Colors
local Trade = {}
local GLYPH = { pistol = "🔫", smg = "🔫", shotgun = "🔫", rifle = "🔫", blaster = "✦", railgun = "⚡", helmet = "⛑", vest = "🦺", boots = "👢" }

local function describe(it): (string, string, number)
	if it.kind == "pet" then
		local def = Pets.Pets[it.id]
		local lvl = ({ [0] = "", [1] = "Golden ", [2] = "Rainbow " })[it.lvl or 0] or ""
		return "🐾", lvl .. (def and def.name or it.id), math.min(5, (def and def.rarity or 1) + (it.lvl or 0))
	end
	local name = if it.kind == "gun" then Guns.Types[it.id].name else Guns.Armor[it.id].name
	return GLYPH[it.id] or "★", ("%s %s T%d"):format(Guns.Rarities[it.rarity].name, name, it.tier), it.rarity
end

local box, close, mineGrid, theirGrid, pickGrid, status, readyBtn
local selected: { string } = {}
local myReady = false

local function isEquipped(uid: string): boolean
	local e = State.Inv.equipped
	return e.gun == uid or e.helmet == uid or e.vest == uid or e.boots == uid or table.find(e.pets, uid) ~= nil
end

local function renderPicker()
	if not pickGrid then
		return
	end
	W.clear(pickGrid)
	W.grid(pickGrid, Vector2.new(96, 110))
	local i = 0
	for uid, it in pairs(State.Inv.items) do
		if not isEquipped(uid) then
			i += 1
			local glyph, name, rarity = describe(it)
			local on = table.find(selected, uid) ~= nil
			W.card(pickGrid, i, rarity, glyph, name, "", if on then "✔" else "+", function()
				local idx = table.find(selected, uid)
				if idx then
					table.remove(selected, idx)
				elseif #selected < 8 then
					table.insert(selected, uid)
				end
				Net.send("TradeSetOffer", selected)
				renderPicker()
			end, if on then "IN" else nil)
		end
	end
end

local function renderList(grid: ScrollingFrame, list)
	W.clear(grid)
	W.grid(grid, Vector2.new(96, 96))
	for i, e in ipairs(list) do
		local glyph, name, rarity = describe(e.item)
		W.card(grid, i, rarity, glyph, name, "")
	end
end

local function scroll(parent: Instance, pos: UDim2, size: UDim2): ScrollingFrame
	return UI.new("ScrollingFrame", { BackgroundColor3 = C.Bg, BackgroundTransparency = 0.3, BorderSizePixel = 0, Position = pos, Size = size,
		ScrollBarThickness = 5, AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(), Parent = parent }, { UI.corner() })
end

local function openWindow(partner: string)
	if box then
		return
	end
	selected, myReady = {}, false
	box, close = W.modal(UIController.Gui(), "TRADE with " .. partner, C.Gold)
	box.Size = UDim2.fromOffset(820, 520)
	UI.label("YOUR OFFER", 16, { Position = UDim2.fromOffset(16, 58), Size = UDim2.fromOffset(250, 20), Parent = box })
	mineGrid = scroll(box, UDim2.fromOffset(16, 80), UDim2.fromOffset(250, 160))
	UI.label("THEIR OFFER", 16, { Position = UDim2.fromOffset(280, 58), Size = UDim2.fromOffset(250, 20), Parent = box })
	theirGrid = scroll(box, UDim2.fromOffset(280, 80), UDim2.fromOffset(250, 160))
	UI.label("PICK YOUR ITEMS (max 8)", 16, { Position = UDim2.fromOffset(16, 248), Size = UDim2.fromOffset(514, 20), Parent = box })
	pickGrid = scroll(box, UDim2.fromOffset(16, 270), UDim2.fromOffset(514, 236))
	status = UI.label("", 18, { Position = UDim2.fromOffset(548, 80), Size = UDim2.fromOffset(256, 90), TextColor3 = C.TextDim, Parent = box })
	readyBtn = UI.button("READY", C.Primary, function()
		myReady = not myReady
		Net.send("TradeReady", myReady)
	end, { Position = UDim2.fromOffset(560, 300), Size = UDim2.fromOffset(230, 70), Parent = box })
	UI.button("CANCEL", C.Danger, function()
		Net.send("TradeCancel")
	end, { Position = UDim2.fromOffset(560, 390), Size = UDim2.fromOffset(230, 56), Parent = box })
	renderPicker()
end

local function shutdown(reason: string)
	if close then
		close()
	end
	box, close, mineGrid, theirGrid, pickGrid = nil, nil, nil, nil, nil
	UIController.Toast(reason, if reason:find("complete") then "success" else "info")
end

local function eventBanner()
	local gui = UIController.Gui()
	local holder = UI.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -16, 0, 130), Size = UDim2.fromOffset(240, 200), Parent = gui })
	UI.new("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Right, Parent = holder })
	local events = {}
	Net.listen("EventState", function(list)
		events = list or {}
		W.clear(holder)
		UI.new("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Right, Parent = holder })
		for i, e in ipairs(events) do
			local p = UI.panel({ LayoutOrder = i, Name = "E" .. i, Size = UDim2.fromOffset(240, 40), BackgroundColor3 = e.color, Parent = holder })
			UI.label("🎉 " .. e.name, 15, { Name = "L", Size = UDim2.fromScale(1, 1), Parent = p })
		end
	end)
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(1)
			local now = os.time()
			for i, e in ipairs(events) do
				local p = holder:FindFirstChild("E" .. i)
				local l = p and p:FindFirstChild("L") :: TextLabel?
				if l then
					local left = math.max(0, e.endsAt - now)
					l.Text = ("🎉 %s  %02d:%02d:%02d"):format(e.name, left // 3600, (left % 3600) // 60, left % 60)
				end
			end
		end
	end)
end

function Trade.Init()
	local _, body = UIController.MakeWindow("Trade", "TRADE", C.Gold)
	UIController.List(body)
	local function render()
		UIController.Clear(body)
		UIController.Row(body, 0, "Safe trading", "Both players must press READY, then a 3-second countdown. Any change cancels the countdown.", "", C.Panel, false, function() end)
		local i = 0
		for _, p in ipairs(Players:GetPlayers()) do
			if p ~= Players.LocalPlayer then
				i += 1
				UIController.Row(body, i, p.DisplayName, "@" .. p.Name, "REQUEST", C.Gold, true, function()
					Net.send("TradeRequest", p.UserId)
				end)
			end
		end
		if i == 0 then
			UIController.Row(body, 1, "No other players here", "Invite a friend to trade!", "", C.Panel, false, function() end)
		end
	end
	UIController.AddMenuButton(16, "TRADE", C.Gold, "Trade").Activated:Connect(function()
		task.defer(render)
	end)

	Net.listen("TradeInvite", function(inv)
		local b, cl = W.modal(UIController.Gui(), "TRADE REQUEST", C.Gold)
		UI.label(inv.from .. " wants to trade with you", 24, { Position = UDim2.fromOffset(20, 130), Size = UDim2.new(1, -40, 0, 60), Parent = b })
		UI.button("ACCEPT", C.Primary, function()
			Net.send("TradeAccept", inv.fromId)
			cl()
		end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(0.5, -8, 1, -20), Size = UDim2.fromOffset(170, 54), Parent = b })
		UI.button("DECLINE", C.PanelLight, cl, { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0.5, 8, 1, -20), Size = UDim2.fromOffset(170, 54), Parent = b })
		task.delay(30, function()
			if b.Parent then
				cl()
			end
		end)
	end)
	Net.listen("TradeState", function(st)
		UIController.Close("Trade")
		openWindow(st.partner)
		renderList(mineGrid, st.mine)
		renderList(theirGrid, st.theirs)
		myReady = st.myReady
		readyBtn.Label.Text = if st.myReady then "UNREADY" else "READY"
		local cd = st.confirmAt and math.max(0, math.ceil(st.confirmAt - Workspace:GetServerTimeNow()))
		status.Text = ("You: %s\nThem: %s%s"):format(if st.myReady then "READY ✔" else "not ready", if st.theirReady then "READY ✔" else "not ready",
			if cd then ("\n\nTrading in %d...  (change = cancel)"):format(cd) else "")
		status.TextColor3 = if cd then C.Gold else C.TextDim
	end)
	Net.listen("TradeClosed", shutdown)
	State.InvChanged:Connect(function()
		if box then
			renderPicker()
		end
	end)
	eventBanner()
end

return Trade
