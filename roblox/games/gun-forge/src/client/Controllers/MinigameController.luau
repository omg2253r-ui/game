-- Training-break minigames (play while AFK-training): Target Rush, Reload Rhythm, Lucky Crate.
-- Also exports the timing-bar widget reused by the Forge assembly minigame.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Minigames = require(Shared.Config.Minigames)
local Materials = require(Shared.Config.Materials)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local UIController = require(script.Parent.UIController)

local C = Theme.Colors
local MG = { Busy = false }

local function resultText(res): string
	if not res then
		return "No reward"
	end
	local parts = {}
	if res.power and res.power > 0 then
		table.insert(parts, "+" .. W.short(res.power) .. " ⚡ Power")
	end
	if res.coins and res.coins > 0 then
		table.insert(parts, "+" .. W.short(res.coins) .. " 🪙")
	end
	if res.gems then
		table.insert(parts, "+" .. res.gems .. " 💎")
	end
	if res.mat and Materials[res.mat] then
		table.insert(parts, ("+%d %s"):format(res.amount, Materials[res.mat].name))
	end
	return if #parts > 0 then table.concat(parts, "\n") else "Better luck next time!"
end

local function showResult(box: Frame, close: () -> (), title: string, res)
	for _, ch in ipairs(box:GetChildren()) do
		if ch.Name == "Play" then
			ch:Destroy()
		end
	end
	UI.label(title, 34, { Position = UDim2.fromOffset(0, 90), Size = UDim2.new(1, 0, 0, 40), TextColor3 = C.Gold, Parent = box })
	UI.label(resultText(res), 24, { Position = UDim2.fromOffset(0, 150), Size = UDim2.new(1, 0, 0, 120), Parent = box })
	UI.button("NICE!", C.Primary, function()
		close()
		MG.Busy = false
	end, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -20), Size = UDim2.fromOffset(200, 56), Parent = box })
end

-- Timing bar: needle sweeps; tap when inside the gold zone. Calls onHit(perfect: boolean) per tap.
function MG.TimingBar(parent: Frame, y: number, speed: number, zoneWidth: number, onHit: (boolean) -> ())
	local bar = UI.new("Frame", { Name = "Play", BackgroundColor3 = C.Bg, Position = UDim2.new(0.1, 0, 0, y), Size = UDim2.new(0.8, 0, 0, 34), Parent = parent }, { UI.corner(UDim.new(0, 8)), UI.stroke() })
	local zone = UI.new("Frame", { BackgroundColor3 = C.Gold, Size = UDim2.fromScale(zoneWidth, 1), Parent = bar }, { UI.corner(UDim.new(0, 8)) })
	local needle = UI.new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.new(0, 6, 1, 10), Position = UDim2.fromScale(0, -0.15), Parent = bar })
	local x, dir = 0, 1
	local function newZone()
		zone.Position = UDim2.fromScale(math.random() * (1 - zoneWidth), 0)
	end
	newZone()
	local conn = RunService.RenderStepped:Connect(function(dt) -- lint-ok (one needle)
		x += dir * dt * speed
		if x >= 1 or x <= 0 then
			dir = -dir
			x = math.clamp(x, 0, 1)
		end
		needle.Position = UDim2.new(x, -3, -0.15, 0)
	end)
	local function tap()
		local zx = zone.Position.X.Scale
		local perfect = x >= zx and x <= zx + zoneWidth
		zone.BackgroundColor3 = if perfect then C.Primary else C.Danger
		task.delay(0.15, function()
			zone.BackgroundColor3 = C.Gold
			newZone()
		end)
		onHit(perfect)
	end
	return tap, function()
		conn:Disconnect()
	end
end

local function targetRush(box: Frame, duration: number, done: (number) -> ())
	local area = UI.new("Frame", { Name = "Play", BackgroundTransparency = 1, Position = UDim2.fromOffset(20, 100), Size = UDim2.new(1, -40, 1, -120), Parent = box })
	local scoreL = UI.label("0", 26, { Name = "Play", Position = UDim2.fromOffset(0, 58), Size = UDim2.new(1, 0, 0, 30), TextColor3 = C.Gold, Parent = box })
	local score, running = 0, true
	local function spawnTarget()
		if not running then
			return
		end
		local t = UI.button("🎯", C.Danger, function() end, { Size = UDim2.fromOffset(64, 64), Position = UDim2.fromScale(math.random() * 0.88, math.random() * 0.8), Parent = area })
		UI.corner(UDim.new(1, 0)).Parent = t
		local hit = false
		t.Activated:Connect(function()
			if hit then
				return
			end
			hit = true
			score += 1
			scoreL.Text = tostring(score)
			t:Destroy()
			spawnTarget()
		end)
		task.delay(1.1, function()
			if not hit and t.Parent then
				t:Destroy()
				spawnTarget()
			end
		end)
	end
	spawnTarget()
	spawnTarget()
	task.delay(duration, function()
		running = false
		done(score)
	end)
end

local function reloadRhythm(box: Frame, duration: number, maxScore: number, done: (number) -> ())
	local score, taps = 0, 0
	local scoreL = UI.label("0 / " .. maxScore, 26, { Name = "Play", Position = UDim2.fromOffset(0, 58), Size = UDim2.new(1, 0, 0, 30), TextColor3 = C.Gold, Parent = box })
	local tap, stop = MG.TimingBar(box, 170, 1.4, 0.16, function(perfect)
		taps += 1
		if perfect then
			score += 1
		end
		scoreL.Text = ("%d / %d"):format(score, maxScore)
	end)
	local btn = UI.button("RELOAD!", C.Energy, function()
		if taps < maxScore + 5 then
			tap()
		end
	end, { Name = "Play", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 240), Size = UDim2.fromOffset(240, 70), Parent = box })
	btn.Label.TextSize = 30
	task.delay(duration, function()
		stop()
		done(math.min(score, maxScore))
	end)
end

local function luckyCrate(box: Frame, done: (number) -> ())
	local row = UI.new("Frame", { Name = "Play", BackgroundTransparency = 1, Position = UDim2.fromOffset(40, 120), Size = UDim2.new(1, -80, 0, 180), Parent = box })
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 24), Parent = row })
	local picked = false
	for _ = 1, 3 do
		local b = UI.button("📦", C.Gold, function()
			if picked then
				return
			end
			picked = true
			done(1)
		end, { Size = UDim2.fromOffset(150, 150), Parent = row })
		b.Label.TextSize = 70
		TweenService:Create(b, TweenInfo.new(0.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Rotation = 6 }):Play()
	end
end

function MG.Play(name: string)
	local cfg = Minigames[name]
	if not cfg or MG.Busy then
		return
	end
	local res = Net.invoke("MinigameStart", name)
	if not res or not res.ok then
		UIController.Toast(res and res.wait and ("Ready in %ds"):format(res.wait) or "Not available", "info")
		return
	end
	MG.Busy = true
	local box, close = W.modal(UIController.Gui(), cfg.name, cfg.color)
	UI.label(cfg.desc, 18, { Name = "Play", Font = Theme.FontBody, Position = UDim2.fromOffset(0, 60), Size = UDim2.new(1, 0, 0, 0), TextColor3 = C.TextDim, Parent = box })
	local function finish(score)
		local out = Net.invoke("MinigameEnd", score)
		showResult(box, close, if name == "LuckyCrate" then "YOU GOT" else ("SCORE %d"):format(score), out)
	end
	if name == "TargetRush" then
		targetRush(box, res.duration, finish)
	elseif name == "ReloadRhythm" then
		reloadRhythm(box, res.duration, res.maxScore, finish)
	else
		luckyCrate(box, finish)
	end
end

function MG.Init()
	-- quick-access minigame menu (also opened by booths in the hub)
	local _, body = UIController.MakeWindow("Minigames", "TRAINING GAMES", C.Forge)
	UIController.List(body)
	local function render()
		UIController.Clear(body)
		local cds = Net.invoke("MinigameCooldowns") or {}
		local i = 0
		for key, cfg in pairs(Minigames) do
			i += 1
			local cd = cds[key] or 0
			UIController.Row(body, i, cfg.name, cfg.desc, if cd > 0 then (cd .. "s") else "PLAY", cfg.color, cd <= 0, function()
				UIController.Close("Minigames")
				MG.Play(key)
			end, nil, "menu_games")
		end
	end
	local btn = UIController.AddMenuButton(4, "GAMES", C.Forge, "Minigames")
	btn.Activated:Connect(function()
		task.defer(render)
	end)
	MG.Render = render
end

return MG
