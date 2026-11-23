-- PvP: queue window (1v1 / 2v2 / 4v4 + rating), tournament signup + bracket, in-match scoreboard.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Combat = require(Shared.Config.Combat)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local UIController = require(script.Parent.UIController)

local C = Theme.Colors
local Arena = {}
local body, tab = nil, "QUEUE"
local tour = nil
local queuePill, queueLabel, score

local function renderQueue()
	UIController.List(body)
	local st = Net.invoke("PvpStats")
	if st then
		UIController.Row(body, 0, ("Rating %d   🏆 %d"):format(st.rating, st.trophies), ("Wins %d  •  Losses %d  •  PvP is fair: everyone has the same HP, passes don't count"):format(st.wins, st.losses), "", C.Panel, false, function() end)
	end
	local order = { "Duel", "Duo", "Squad" }
	for i, mode in ipairs(order) do
		local m = Combat.Arena.Modes[mode]
		UIController.Row(body, i, m.name .. " Ranked", ("First to %d kills • %d min • win +%d Coins"):format(m.killsToWin, m.minutes, Combat.Arena.WinCoins), "QUEUE", C.Danger, true, function()
			Net.send("QueueJoin", mode)
			UIController.Close("Arena")
		end, nil, "menu_pvp")
	end
end

local function renderTour()
	UIController.List(body)
	local t = tour or Net.invoke("TourInfo")
	if not t then
		return
	end
	local now = Workspace:GetServerTimeNow()
	local T = Combat.Tournament
	if t.phase == "signup" then
		UIController.Row(body, 0, ("SIGNUP OPEN — %ds left"):format(math.max(0, math.floor(t.endsAt - now))),
			("%d/%d players • entry %d Coins • pot %s + %d Gems"):format(#t.entrants, t.size, t.entry, W.short(t.pot), T.PrizeGems), "JOIN", C.Gold, true, function()
				if not Net.invoke("TourJoin") then
					UIController.Toast("Can't join (full, already in, or not enough Coins)", "error")
				end
			end)
	else
		local mins = math.max(0, math.floor(((t.nextAt or 0) - now) / 60))
		UIController.Row(body, 0, if t.phase == "running" then "TOURNAMENT IN PROGRESS" else ("Next tournament in ~%d min"):format(mins),
			("8-player 1v1 bracket • first to %d • entry %d Coins"):format(T.KillsToWin, T.EntryCoins), "", C.Panel, false, function() end)
	end
	for r, round in ipairs(t.rounds or {}) do
		for i, m in ipairs(round) do
			UIController.Row(body, r * 10 + i, ("Round %d: %s vs %s"):format(r, m.a, m.b), m.winner and ("Winner: " .. m.winner) or "fighting...", "", C.Panel, false, function() end)
		end
	end
end

local function render()
	if not body then
		return
	end
	W.clear(body)
	if tab == "QUEUE" then
		renderQueue()
	else
		renderTour()
	end
end
Arena.Render = render

function Arena.Init()
	local gui = UIController.Gui()
	local win, b = UIController.MakeWindow("Arena", "PVP ARENA", C.Danger)
	body = b
	local select = W.tabs(win, b, { "QUEUE", "TOURNAMENT" }, function(name)
		tab = name
		render()
	end)
	UIController.AddMenuButton(8, "PVP", C.Danger, "Arena").Activated:Connect(function()
		task.defer(render)
	end)

	-- queue pill
	queuePill = UI.panel({ AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -16, 0, 70), Size = UDim2.fromOffset(250, 50), BackgroundColor3 = C.Danger, Visible = false, Parent = gui })
	queueLabel = UI.label("", 16, { Position = UDim2.fromOffset(8, 0), Size = UDim2.new(1, -90, 1, 0), TextXAlignment = Enum.TextXAlignment.Left, Parent = queuePill })
	UI.button("LEAVE", C.PanelLight, function()
		Net.send("QueueLeave")
	end, { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -6, 0.5, 0), Size = UDim2.fromOffset(76, 38), Parent = queuePill }).Label.TextSize = 14
	Net.listen("QueueState", function(q)
		queuePill.Visible = q ~= nil
		if q then
			queueLabel.Text = ("Finding %s... %d/%d"):format(Combat.Arena.Modes[q.mode].name, q.count, q.need)
		end
	end)

	-- scoreboard
	score = UI.panel({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 100), Size = UDim2.fromOffset(420, 60), BackgroundColor3 = C.Bg, Visible = false, Parent = gui })
	local scoreL = UI.label("", 26, { Size = UDim2.fromScale(1, 1), Parent = score })
	local current = nil
	Net.listen("MatchState", function(s)
		current = s
		queuePill.Visible = false
		score.Visible = true
	end)
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(0.25)
			if current and score.Visible then
				local left = math.max(0, current.endsAt - Workspace:GetServerTimeNow())
				local mine = current.team
				local other = if mine == "A" then "B" else "A"
				scoreL.Text = ("%s  YOU %d — %d ENEMY  •  %d:%02d  (to %d)"):format(current.mode, current.kills[mine], current.kills[other], left // 60, left % 60, current.killsToWin)
			end
		end
	end)
	Net.listen("MatchEnd", function(r)
		score.Visible = false
		current = nil
		local won = r.winner == r.team
		local box, close = W.modal(gui, if r.winner == nil then "DRAW" elseif won then "VICTORY!" else "DEFEAT", if won then C.Primary else C.Danger)
		UI.label(if r.ranked then ("Rating %s%d"):format(if r.delta >= 0 then "+" else "", r.delta) else "Tournament match", 30, { Position = UDim2.fromOffset(0, 140), Size = UDim2.new(1, 0, 0, 40), Parent = box })
		UI.button("OK", C.Primary, close, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -20), Size = UDim2.fromOffset(200, 54), Parent = box })
	end)
	Net.listen("TourState", function(t)
		tour = t
		if UIController.IsOpen("Arena") and tab == "TOURNAMENT" then
			render()
		end
	end)
	select("QUEUE")
end

return Arena
