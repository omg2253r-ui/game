-- Co-op raid UI: lobby (create / join / start / solo), Raid Token shop, in-raid HUD (wave, enemies, timer, bar), end screen.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Cfg = require(Shared.Config.Raid)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local UIController = require(script.Parent.UIController)

local C = Theme.Colors
local Raid = {}
local body, tab = nil, "LOBBY"
local info, hud, state = nil, nil, nil
local barFill, waveL, enemyL, timeL, banner

local function renderLobby()
	UIController.List(body)
	info = Net.invoke("RaidInfo")
	if not info then
		return
	end
	local lp = game:GetService("Players").LocalPlayer
	UIController.Row(body, 0, ("Best wave %d/%d  •  Clears %d  •  Tokens %d"):format(info.best, Cfg.Waves, info.clears, info.tokens),
		if info.dailyReady then "Daily first-clear bonus ready!" else "Daily bonus claimed", "", C.Panel, false, function() end)
	local mine = info.mine
	if mine then
		UIController.Row(body, 1, ("Lobby: %s (%d/%d)"):format(table.concat(mine.names, ", "), mine.count, Cfg.MaxPlayers),
			if mine.started then "Raid in progress" else "Leader starts the raid", "LEAVE", C.Danger, true, function()
				Net.send("RaidLeave")
				task.defer(Raid.Render)
			end)
		if mine.leaderId == lp.UserId and not mine.started then
			UIController.Row(body, 2, "START RAID", ("%d waves • mini-boss wave %d • boss wave %d"):format(Cfg.Waves, Cfg.MiniBossWave, Cfg.BossWave), "START", C.Primary, true, function()
				if Net.invoke("RaidStart") then
					UIController.Close("Raid")
				end
			end, nil, "menu_raid")
		end
		return
	end
	UIController.Row(body, 1, "Create raid lobby", "Other players in the server can join (max 4)", "CREATE", C.Primary, true, function()
		Net.invoke("RaidCreate")
		Raid.Render()
	end)
	UIController.Row(body, 2, "Solo raid", ("Enemies scale with your best zone (tier %d)"):format(info.tier), "GO SOLO", C.Gold, true, function()
		if Net.invoke("RaidCreate") and Net.invoke("RaidStart") then
			UIController.Close("Raid")
		else
			Raid.Render()
		end
	end)
	for i, l in ipairs(info.open) do
		UIController.Row(body, 10 + i, l.leader .. "'s raid", ("%d/%d players"):format(l.count, Cfg.MaxPlayers), "JOIN", C.Primary, true, function()
			Net.invoke("RaidJoin", l.id)
			Raid.Render()
		end)
	end
	UIController.Row(body, 99, "Refresh", "Update lobby list", "REFRESH", C.PanelLight, true, Raid.Render)
end

local function renderShop()
	UIController.List(body)
	info = Net.invoke("RaidInfo")
	if not info then
		return
	end
	UIController.Row(body, 0, ("Raid Tokens: %d"):format(info.tokens), "Earn tokens by clearing raid waves", "", C.Panel, false, function() end, nil, "cur_raid")
	for i, it in ipairs(info.shop) do
		local owned = it.kind == "title" and info.owned[it.id]
		local equipped = owned and info.title == it.title
		UIController.Row(body, i, it.name, it.desc, if equipped then "EQUIPPED" elseif owned then "EQUIP" else ("%d TOKENS"):format(it.cost), C.Gold,
			not equipped and (owned or info.tokens >= it.cost), function()
				Net.invoke("RaidBuy", it.id)
				Raid.Render()
			end, nil, "cur_raid")
	end
end

function Raid.Render()
	if not body then
		return
	end
	W.clear(body)
	if tab == "LOBBY" then
		renderLobby()
	else
		renderShop()
	end
end

local function refreshHud()
	if not state then
		return
	end
	local left = math.max(0, state.endsAt - Workspace:GetServerTimeNow())
	waveL.Text = ("WAVE %d/%d%s"):format(state.wave, state.waves, if state.boss then "  BOSS" else "")
	enemyL.Text = ("Enemies left: %d"):format(math.max(0, state.total - state.killed))
	timeL.Text = ("%d:%02d"):format(left // 60, left % 60)
	barFill.Size = UDim2.fromScale(math.clamp((state.wave - 1 + state.killed / math.max(1, state.total)) / state.waves, 0, 1), 1)
end

local function endScreen(r)
	local box, close = W.modal(UIController.Gui(), if r.won then "RAID CLEARED!" else "RAID FAILED", if r.won then C.Primary else C.Danger)
	local rw = r.rewards
	local lines = { ("Waves cleared: %d/%d"):format(r.cleared, r.waves) }
	if rw then
		table.insert(lines, ("Coins %s   Gems %d   Raid Tokens %d"):format(W.short(rw.coins), rw.gems, rw.tokens))
		local mats = {}
		for id, n in pairs(rw.mats) do
			if n > 0 then
				table.insert(mats, ("%s x%d"):format(id:gsub("_", " "), n))
			end
		end
		table.insert(lines, table.concat(mats, ", "))
		if rw.daily then
			table.insert(lines, "Daily first-clear bonus included!")
		end
	end
	for i, t in ipairs(lines) do
		UI.label(t, if i == 1 then 30 else 20, { Position = UDim2.fromOffset(10, 70 + (i - 1) * 50), Size = UDim2.new(1, -20, 0, 40), TextColor3 = if i == 1 then C.Gold else C.Text, Parent = box })
	end
	UI.button("OK", C.Primary, close, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -20), Size = UDim2.fromOffset(200, 54), Parent = box })
end

function Raid.Init()
	local gui = UIController.Gui()
	local win, b = UIController.MakeWindow("Raid", "CO-OP RAID", C.Danger)
	body = b
	local select = W.tabs(win, b, { "LOBBY", "SHOP" }, function(name)
		tab = name
		Raid.Render()
	end)
	UIController.AddMenuButton(12, "RAID", Color3.fromRGB(255, 120, 40), "Raid").Activated:Connect(function()
		task.defer(Raid.Render)
	end)

	hud = UI.panel({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 100), Size = UDim2.fromOffset(440, 84), BackgroundColor3 = C.Bg, Visible = false, Parent = gui })
	waveL = UI.label("", 24, { Position = UDim2.fromOffset(10, 4), Size = UDim2.new(0.6, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, Parent = hud })
	timeL = UI.label("", 24, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -10, 0, 4), Size = UDim2.fromOffset(100, 30), TextXAlignment = Enum.TextXAlignment.Right, Parent = hud })
	enemyL = UI.label("", 16, { Position = UDim2.fromOffset(10, 34), Size = UDim2.new(1, -20, 0, 22), TextXAlignment = Enum.TextXAlignment.Left, Parent = hud })
	local bar = UI.new("Frame", { BackgroundColor3 = C.PanelLight, Position = UDim2.new(0, 10, 1, -20), Size = UDim2.new(1, -20, 0, 10), Parent = hud }, { UI.corner(UDim.new(1, 0)) })
	barFill = UI.new("Frame", { BackgroundColor3 = C.Primary, Size = UDim2.fromScale(0, 1), Parent = bar }, { UI.corner(UDim.new(1, 0)) })
	banner = UI.label("", 56, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.3), Size = UDim2.fromOffset(700, 80), TextColor3 = C.Gold, Visible = false, Parent = gui })

	Net.listen("RaidState", function(s)
		state = s
		hud.Visible = s ~= nil
		if s and s.banner then
			banner.Text = if s.wave == s.waves then "FINAL WAVE - RAID BOSS!" elseif s.boss then ("WAVE %d - MINI-BOSS!"):format(s.wave) else ("WAVE %d"):format(s.wave)
			banner.Visible = true
			task.delay(2.5, function()
				banner.Visible = false
			end)
		end
		refreshHud()
	end)
	Net.listen("RaidLobby", function()
		if UIController.IsOpen("Raid") then
			Raid.Render()
		end
	end)
	Net.listen("RaidEnd", function(r)
		state = nil
		hud.Visible = false
		endScreen(r)
	end)
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(0.25)
			if state then
				refreshHud()
			end
		end
	end)
	select("LOBBY")
end

return Raid
