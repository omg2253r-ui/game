-- Training HUD: Power + gain/s, TRAIN toggle, x2 Pulse pop-up button, boost timers, announcements,
-- loot/damage popups, gate unlocking (local CanCollide), next-zone hint.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Zones = require(Shared.Config.Zones)
local Materials = require(Shared.Config.Materials)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local State = require(script.Parent.Parent.ClientState)
local UIController = require(script.Parent.UIController)
local Vfx = require(script.Parent.VfxController)
local GunController = require(script.Parent.GunController)
local Sounds = require(Shared.Config.Sounds)
local Guns = require(Shared.Config.Guns)
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local C = Theme.Colors

local Hud = {}

local powerLabel, gainLabel, trainBtn, pulseBtn, boostLabel, hintLabel, banner

local function pop(gui: GuiObject, s: number)
	local sc = gui:FindFirstChildOfClass("UIScale") or UI.new("UIScale", { Parent = gui })
	sc.Scale = s
	TweenService:Create(sc, Theme.Tween, { Scale = 1 }):Play()
end

function Hud.Announce(text: string)
	banner.Text = text
	banner.TextTransparency = 0
	banner.Visible = true
	pop(banner, 1.3)
	task.delay(4, function()
		if banner.Text == text then
			TweenService:Create(banner, TweenInfo.new(0.5), { TextTransparency = 1 }):Play()
		end
	end)
end

local function floatText(worldPos: Vector3, text: string, color: Color3, size: number)
	local anchor = Instance.new("Part")
	anchor.Anchored, anchor.CanCollide, anchor.CanQuery, anchor.CanTouch, anchor.Transparency = true, false, false, false, 1
	anchor.Size = Vector3.one
	anchor.Position = worldPos + Vector3.new(math.random(-15, 15) / 10, 2, math.random(-15, 15) / 10)
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(160, size + 10)
	bb.AlwaysOnTop = true
	bb.MaxDistance = 120
	local l = UI.label(text, size, { Size = UDim2.fromScale(1, 1), TextColor3 = color, Parent = bb })
	bb.Parent = anchor
	anchor.Parent = Workspace
	TweenService:Create(bb, TweenInfo.new(0.9, Enum.EasingStyle.Quad), { StudsOffset = Vector3.new(0, 3, 0) }):Play()
	TweenService:Create(l, TweenInfo.new(0.9), { TextTransparency = 1 }):Play()
	task.delay(1, function()
		anchor:Destroy()
	end)
end

local function updateGates()
	local power = State.Power()
	local map = Workspace:FindFirstChild("Map")
	local zones = map and map:FindFirstChild("Zones")
	if not zones then
		return
	end
	for _, z in ipairs(Zones) do
		local zm = zones:FindFirstChild(z.id)
		local gate = zm and zm:FindFirstChild("Gate") :: BasePart?
		if gate then
			local open = power >= z.powerReq
			gate.CanCollide = not open -- local only: server still bounces under-powered players
			gate.Transparency = if open then 0.85 else 0.35
			local tag = gate:FindFirstChild("LockTag") :: BillboardGui?
			if not tag then
				tag = Instance.new("BillboardGui")
				tag.Name = "LockTag"
				tag.Size = UDim2.fromOffset(240, 60)
				tag.StudsOffset = Vector3.new(0, gate.Size.Y / 2 + 3, 0)
				tag.MaxDistance = 150
				UI.label("", 26, { Name = "L", Size = UDim2.fromScale(1, 1), Parent = tag })
				tag.Parent = gate
			end
			local l = (tag :: BillboardGui):FindFirstChild("L") :: TextLabel
			l.Text = if open then "✔ " .. z.name else ("🔒 %s\n%s Power"):format(z.name, W.short(z.powerReq))
			l.TextColor3 = if open then C.Primary else C.Gold
		end
	end
end

local function nextZoneHint()
	local power = State.Power()
	for _, z in ipairs(Zones) do
		if power < z.powerReq then
			hintLabel.Text = ("Next: %s at %s Power (%d%%)"):format(z.name, W.short(z.powerReq), math.floor(power / z.powerReq * 100))
			return
		end
	end
	hintLabel.Text = "All zones unlocked — try Rebirth!"
end

-- First-time hints, one at a time: TRAIN -> x2 pulse -> Adventure gate -> Forge. Session-only; skipped for
-- returning players (already strong). Each step dismisses itself when the player does the thing.
function Hud.StartTutorial()
	local player = Players.LocalPlayer
	task.spawn(function()
		task.wait(4)
		if State.Power() > 300 or (State.Inv.rebirths or 0) > 0 then
			return
		end
		local dismiss: (() -> ())? = nil
		local function show(target: GuiObject, text: string, side: string?)
			if dismiss then
				dismiss()
			end
			dismiss = UI.hint(target, text, side)
		end
		local function hide()
			if dismiss then
				dismiss()
				dismiss = nil
			end
		end
		-- 1. TRAIN
		show(trainBtn, "Training is ON: stay near monsters and your Power grows!", "up")
		task.wait(8)
		hide()
		-- 2. x2 pulse (waits up to 3 min for the first one)
		local waited = 0
		while not pulseBtn.Visible and waited < 180 do
			task.wait(1)
			waited += 1
		end
		if pulseBtn.Visible then
			show(pulseBtn, "Tap x2 for double Power!", "down")
			while pulseBtn.Visible do
				task.wait(0.3)
			end
			hide()
		end
		-- 3. Adventure gate
		local bar = UI.panel({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 100), Size = UDim2.fromOffset(420, 44), BackgroundColor3 = C.Gold, ZIndex = 15, Parent = UIController.Gui() }, {
			UI.label("➡  Walk through the glowing ADVENTURE gate!", 18, { Size = UDim2.fromScale(1, 1), ZIndex = 16 }),
		})
		local bob = TweenService:Create(bar, TweenInfo.new(0.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Position = UDim2.new(0.5, 0, 0, 108) })
		bob:Play()
		while true do -- lint-ok (task.wait)
			local z = player:GetAttribute("Zone")
			if z ~= nil and z ~= "hub" then
				break
			end
			task.wait(1)
		end
		bob:Cancel()
		bar:Destroy()
		-- 4. Forge: once you hold any material
		local function hasMats(): boolean
			for _, n in pairs(State.Inv.materials) do
				if n > 0 then
					return true
				end
			end
			return false
		end
		while not hasMats() do
			task.wait(2)
		end
		UIController.SetMenuOpen(true)
		local fb = UIController.GetMenuButton("Forge")
		if fb then
			show(fb, "You got materials! Open the FORGE to craft a better gun.", "right")
			while not UIController.IsOpen("Forge") do
				task.wait(0.5)
			end
			hide()
		end
	end)
end

function Hud.Init()
	local gui = UIController.Gui()
	-- Power panel (top centre)
	local panel = UI.panel({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), Size = UDim2.fromOffset(340, 86), BackgroundColor3 = C.Bg, Parent = gui })
	UI.gradient(C.Panel, C.Bg).Parent = panel
	powerLabel = UI.label("⚡ 0", 34, { Position = UDim2.fromOffset(0, 4), Size = UDim2.new(1, 0, 0, 40), TextColor3 = C.Energy, Parent = panel })
	gainLabel = UI.label("+0 /s", 16, { Font = Theme.FontBody, Position = UDim2.fromOffset(0, 44), Size = UDim2.new(1, 0, 0, 18), TextColor3 = C.TextDim, Parent = panel })
	hintLabel = UI.label("", 13, { Font = Theme.FontBody, Position = UDim2.fromOffset(0, 64), Size = UDim2.new(1, 0, 0, 16), TextColor3 = C.Gold, Parent = panel })

	-- TRAIN toggle + boost (bottom centre)
	trainBtn = UI.button("TRAINING: ON", C.Energy, function()
		Net.send("SetTraining", not State.Train.training)
	end, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -16), Size = UDim2.fromOffset(220, 56), Parent = gui })
	boostLabel = UI.label("", 16, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -76), Size = UDim2.fromOffset(400, 20), TextColor3 = C.Gold, Parent = gui })

	-- x2 pulse button (pops in at random spots on the right side)
	pulseBtn = UI.button("x2!", C.Forge, function()
		Net.send("PulseTap")
		Vfx.Sound(Sounds.Ui)
		pulseBtn.Visible = false
		W.flash(gui, C.Forge)
	end, { AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(130, 130), Visible = false, ZIndex = 10, Skin = false, Parent = gui })
	pulseBtn.Label.TextSize = 48
	UI.corner(UDim.new(1, 0)).Parent = pulseBtn
	if UI.skinPanel(pulseBtn, "badge_x2") then -- uploaded art replaces the code-drawn disc
		pulseBtn.Label.Text = ""
	end

	banner = UI.label("", 30, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 104), Size = UDim2.fromOffset(900, 40), TextColor3 = C.Gold, Visible = false, Parent = gui })

	Net.listen("PulseOffer", function(seconds)
		Vfx.Sound(Sounds.Pulse)
		pulseBtn.Position = UDim2.fromScale(0.55 + math.random() * 0.3, 0.3 + math.random() * 0.35)
		pulseBtn.Visible = true
		pop(pulseBtn, 0.3)
		local spin = TweenService:Create(pulseBtn, TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Rotation = 8 })
		spin:Play()
		task.delay(seconds, function()
			spin:Cancel()
			pulseBtn.Rotation = 0
			pulseBtn.Visible = false
		end)
	end)

	State.TrainChanged:Connect(function(t)
		trainBtn.Label.Text = if t.training then "TRAINING: ON" else "TRAINING: OFF"
		gainLabel.Text = ("+%s /s   x%.2f"):format(W.short(t.gain), t.mult)
		local parts = {}
		if t.pulseLeft > 0 then
			table.insert(parts, ("x2 PULSE %ds"):format(math.ceil(t.pulseLeft)))
		end
		if t.boostLeft > 0 then
			table.insert(parts, ("x3 BOOST %dm"):format(math.ceil(t.boostLeft / 60)))
		end
		boostLabel.Text = table.concat(parts, "   ")
	end)

	Net.listen("Announce", Hud.Announce)

	Net.listen("Loot", function(pos: Vector3, loot)
		local y = 0
		if loot.coins and loot.coins > 0 then
			floatText(pos + Vector3.new(0, y, 0), "+" .. W.short(loot.coins) .. " 🪙", C.Gold, 22)
			Vfx.LootOrbs(pos, 3, C.Gold)
			y += 1.5
		end
		if loot.power and loot.power > 0 then
			floatText(pos + Vector3.new(0, y, 0), "+" .. W.short(loot.power) .. " ⚡", C.Energy, 20)
			y += 1.5
		end
		for mat, n in pairs(loot.mats or {}) do
			local def = Materials[mat]
			if def then
				floatText(pos + Vector3.new(0, y, 0), ("+%d %s %s"):format(n, def.glyph, def.name), def.color, 18)
				Vfx.LootOrbs(pos, n, def.color)
				y += 1.5
			end
		end
		if loot.rank then
			Hud.Announce(("World Boss — your rank #%d"):format(loot.rank))
		end
	end)
	Net.listen("Hit", function(pos: Vector3, dmg: number, crit: boolean?)
		Vfx.DamageNumber(pos, dmg, crit, W.short)
		Vfx.HitSpark(pos, crit)
		Vfx.Sound(if crit then Sounds.Crit else Sounds.Hit)
	end)

	-- health bar (custom, smooth) above the TRAIN button
	local player = Players.LocalPlayer
	local hpBack = UI.panel({ AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -100), Size = UDim2.fromOffset(320, 26), BackgroundColor3 = C.Bg, Parent = gui })
	local hpLag = UI.new("Frame", { BackgroundColor3 = Color3.fromRGB(255, 255, 255), BackgroundTransparency = 0.3, Size = UDim2.fromScale(1, 1), Parent = hpBack }, { UI.corner() })
	local hpFill = UI.new("Frame", { BackgroundColor3 = C.Primary, Size = UDim2.fromScale(1, 1), Parent = hpBack }, { UI.corner() })
	local hpText = UI.label("", 16, { Size = UDim2.fromScale(1, 1), Parent = hpBack })
	-- ammo counter (bottom right) with reload bar
	local ammoBox = UI.panel({ AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -16, 1, -146), Size = UDim2.fromOffset(150, 58), BackgroundColor3 = C.Bg, Parent = gui })
	local ammoText = UI.label("", 26, { Size = UDim2.new(1, 0, 0, 36), Parent = ammoBox })
	local gunText = UI.label("", 12, { Font = Theme.FontBody, Position = UDim2.fromOffset(0, 32), Size = UDim2.new(1, 0, 0, 14), TextColor3 = C.TextDim, Parent = ammoBox })
	local reloadBar = UI.new("Frame", { BackgroundColor3 = C.Gold, Position = UDim2.new(0, 6, 1, -8), Size = UDim2.new(0, 0, 0, 4), Parent = ammoBox })
	local lagRatio = 1
	RunService.RenderStepped:Connect(function(dt) -- lint-ok (2 bars)
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if hum and hum.MaxHealth > 0 then
			local r = math.clamp(hum.Health / hum.MaxHealth, 0, 1)
			hpFill.Size = hpFill.Size:Lerp(UDim2.fromScale(r, 1), math.clamp(dt * 14, 0, 1))
			lagRatio = if r > lagRatio then r else lagRatio + (r - lagRatio) * math.clamp(dt * 2.5, 0, 1)
			hpLag.Size = UDim2.fromScale(lagRatio, 1)
			hpFill.BackgroundColor3 = C.Danger:Lerp(C.Primary, r)
			hpText.Text = ("%s / %s"):format(W.short(hum.Health), W.short(hum.MaxHealth))
		end
		local t = player.Character and player.Character:FindFirstChildOfClass("Tool")
		ammoBox.Visible = t ~= nil
		if t then
			local def = Guns.Types[t:GetAttribute("Gun") :: string]
			gunText.Text = t.Name
			if GunController.Reloading() then
				ammoText.Text = "RELOADING"
				ammoText.TextColor3 = C.Gold
				local left = GunController.ReloadUntil - os.clock()
				reloadBar.Size = UDim2.new(1 - math.clamp(left / math.max(GunController.ReloadTime, 0.01), 0, 1), -12, 0, 4)
			else
				ammoText.Text = ("%d / %d"):format(GunController.Mag, GunController.MaxMag)
				ammoText.TextColor3 = if GunController.Mag <= (def and def.mag or 10) * 0.25 then C.Danger else Color3.new(1, 1, 1)
				reloadBar.Size = UDim2.new(0, 0, 0, 4)
			end
		end
	end)

	-- sprint (Shift / mobile button) for the long lane: client-side speed boost on top of server speed
	local UserInputService = game:GetService("UserInputService")
	local sprinting = false
	local function setSprint(on: boolean)
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if not hum or sprinting == on then
			return
		end
		sprinting = on
		hum.WalkSpeed = if on then hum.WalkSpeed * 1.4 else hum.WalkSpeed / 1.4
		TweenService:Create(Workspace.CurrentCamera, TweenInfo.new(0.25), { FieldOfView = if on then 80 else 70 }):Play()
	end
	UserInputService.InputBegan:Connect(function(input, processed)
		if not processed and input.KeyCode == Enum.KeyCode.LeftShift then
			setSprint(true)
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.LeftShift then
			setSprint(false)
		end
	end)
	if UserInputService.TouchEnabled then
		local sb
		sb = UI.button("RUN", C.PanelLight, function()
			setSprint(not sprinting)
			sb.BackgroundColor3 = if sprinting then C.Energy else C.PanelLight
		end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -270, 1, -236), Size = UDim2.fromOffset(64, 64), Parent = gui })
		UI.corner(UDim.new(1, 0)).Parent = sb
	end
	player.CharacterAdded:Connect(function()
		sprinting = false
		Workspace.CurrentCamera.FieldOfView = 70
	end)

	-- stage progress bar: distance from the gate to the boss of the stage you are in
	local stageBar = UI.panel({ AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -134), Size = UDim2.fromOffset(360, 26), BackgroundColor3 = C.Bg, Visible = false, Parent = gui })
	local stageFill = UI.new("Frame", { BackgroundColor3 = C.Energy, Size = UDim2.fromScale(0, 1), Parent = stageBar }, { UI.corner() })
	local stageText = UI.label("", 14, { Size = UDim2.fromScale(1, 1), Parent = stageBar })
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(0.2)
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
			local zid = player:GetAttribute("Zone")
			local zone = nil
			for _, z in ipairs(Zones) do
				if z.id == zid then
					zone = z
				end
			end
			stageBar.Visible = root ~= nil and zone ~= nil
			if root and zone then
				local gz, bz = zone.gatePos.Z, zone.bossPos.Z
				local r = math.clamp((root.Position.Z - gz) / (bz - gz), 0, 1)
				stageFill.Size = stageFill.Size:Lerp(UDim2.fromScale(r, 1), 0.5)
				stageFill.BackgroundColor3 = zone.color
				stageText.Text = ("STAGE %d • %s  —  %d%% to BOSS 👑"):format(zone.stage, zone.name, math.floor(r * 100))
			end
		end
	end)

	-- training range: while TRAINING in the hub, your character shoots the nearest target dummy
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(0.7)
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
			local map = Workspace:FindFirstChild("Map")
			local hub = map and map:FindFirstChild("Hub")
			local dummies = hub and hub:FindFirstChild("TrainingDummies")
			if root and dummies and State.Train.training and player:GetAttribute("Zone") == "hub" then
				local best, bd = nil, 40
				for _, d in ipairs(dummies:GetChildren()) do
					if d:IsA("BasePart") then
						local dist = (d.Position - root.Position).Magnitude
						if dist < bd then
							best, bd = d, dist
						end
					end
				end
				if best then
					local t = char:FindFirstChildOfClass("Tool")
					local from = GunController.MuzzlePos(t, char)
					if from and t then
						local col = Guns.Rarities[t:GetAttribute("Rarity") or 1].color
						local hit = best.Position + Vector3.new((math.random() - 0.5) * 1.5, (math.random() - 0.5) * 1.5, 0)
						Vfx.MuzzleFlash(from, col)
						Vfx.Bullet(from, hit, col, function()
							Vfx.HitSpark(hit, false)
						end)
					end
				end
			end
		end
	end)

	-- stage banner: art splash when you enter a new stage (only once banner_stageN is uploaded)
	local stageBanner = UI.new("ImageLabel", { BackgroundTransparency = 1, ImageTransparency = 1, ScaleType = Enum.ScaleType.Crop, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 100), Size = UDim2.fromOffset(420, 76), Visible = false, ZIndex = 12, Parent = gui }, { UI.corner() })
	local stageBannerText = UI.label("", 30, { Size = UDim2.fromScale(1, 1), ZIndex = 13, TextTransparency = 1, Parent = stageBanner })
	local lastZone = nil
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(0.5)
			local zid = player:GetAttribute("Zone")
			if zid ~= lastZone then
				lastZone = zid
				for _, z in ipairs(Zones) do
					local img = UI.imageId("banner_stage" .. z.stage)
					if z.id == zid and img then
						stageBanner.Image = img
						stageBannerText.Text = ("STAGE %d  %s"):format(z.stage, z.name)
						stageBanner.Visible = true
						TweenService:Create(stageBanner, TweenInfo.new(0.4), { ImageTransparency = 0 }):Play()
						TweenService:Create(stageBannerText, TweenInfo.new(0.4), { TextTransparency = 0 }):Play()
						task.delay(3.2, function()
							TweenService:Create(stageBanner, TweenInfo.new(0.6), { ImageTransparency = 1 }):Play()
							TweenService:Create(stageBannerText, TweenInfo.new(0.6), { TextTransparency = 1 }):Play()
						end)
					end
				end
			end
		end
	end)

	Hud.StartTutorial()

	-- power ticker
	local shown = 0
	task.spawn(function()
		local t = 0
		while true do -- lint-ok (task.wait)
			task.wait(0.1)
			local target = State.Power()
			shown += (target - shown) * 0.35
			if math.abs(target - shown) < 1 then
				shown = target
			end
			powerLabel.Text = "⚡ " .. W.short(shown)
			t += 1
			if t % 10 == 0 then
				updateGates()
				nextZoneHint()
			end
		end
	end)
end

return Hud
