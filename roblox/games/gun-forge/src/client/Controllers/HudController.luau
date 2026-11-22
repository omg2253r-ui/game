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
		pulseBtn.Visible = false
		W.flash(gui, C.Forge)
	end, { AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(130, 130), Visible = false, ZIndex = 10, Parent = gui })
	pulseBtn.Label.TextSize = 48
	UI.corner(UDim.new(1, 0)).Parent = pulseBtn

	banner = UI.label("", 30, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 104), Size = UDim2.fromOffset(900, 40), TextColor3 = C.Gold, Visible = false, Parent = gui })

	Net.listen("PulseOffer", function(seconds)
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
				y += 1.5
			end
		end
		if loot.rank then
			Hud.Announce(("World Boss — your rank #%d"):format(loot.rank))
		end
	end)
	Net.listen("Hit", function(pos: Vector3, dmg: number)
		floatText(pos, W.short(dmg), Color3.new(1, 1, 1), 18)
	end)

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
