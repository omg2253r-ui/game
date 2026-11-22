-- Shooting: hold mouse / FIRE button (mobile) / AUTO (Auto Farm pass). Client picks the target
-- (aim-assist cone), server validates everything. Tracers + muzzle flash are client-only.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Guns = require(Shared.Config.Guns)
local UI = require(script.Parent.Parent.UIKit)
local UIController = require(script.Parent.UIController)
local MonsterController = require(script.Parent.MonsterController)
local Effects = require(script.Parent.EffectsController)

local player = Players.LocalPlayer
local GunController = { Auto = false }
local holding = false
local lastShot = 0

local function tool(): Tool?
	local c = player.Character
	local t = c and c:FindFirstChildOfClass("Tool")
	return if t and t:GetAttribute("Gun") then t else nil
end

local function muzzlePos(t: Tool?, char: Model?): Vector3?
	local h = t and t:FindFirstChild("Handle") :: BasePart?
	local att = h and h:FindFirstChild("Muzzle") :: Attachment?
	if att then
		return att.WorldPosition
	end
	local head = char and char:FindFirstChild("Head") :: BasePart?
	return head and head.Position
end

local function tracer(from: Vector3, to: Vector3, color: Color3)
	local dist = (to - from).Magnitude
	if dist < 0.5 then
		return
	end
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	p.Color = color
	p.Size = Vector3.new(0.18, 0.18, dist)
	p.CFrame = CFrame.lookAt(from, to) * CFrame.new(0, 0, -dist / 2)
	p.Parent = Workspace
	TweenService:Create(p, TweenInfo.new(0.09), { Transparency = 1, Size = Vector3.new(0.05, 0.05, dist) }):Play()
	task.delay(0.1, function()
		p:Destroy()
	end)
	if not Effects.LowFx then
		local f = Instance.new("Part")
		f.Anchored, f.CanCollide, f.CanQuery, f.CanTouch, f.CastShadow = true, false, false, false, false
		f.Shape = Enum.PartType.Ball
		f.Material = Enum.Material.Neon
		f.Color = color
		f.Size = Vector3.one * 0.8
		f.Position = from
		f.Parent = Workspace
		TweenService:Create(f, TweenInfo.new(0.06), { Size = Vector3.one * 0.1, Transparency = 1 }):Play()
		task.delay(0.08, function()
			f:Destroy()
		end)
	end
end

local function pickTarget(root: BasePart, range: number, aimRay: Ray?)
	local best, bestScore, kind, id, at = nil, math.huge, nil, nil, nil
	local function consider(p: Vector3, k: string, tid: number)
		local d = (p - root.Position).Magnitude
		if d > range then
			return
		end
		local score = d
		if aimRay then
			local to = (p - aimRay.Origin).Unit
			local ang = math.deg(math.acos(math.clamp(to:Dot(aimRay.Direction.Unit), -1, 1)))
			if ang > 18 then
				return
			end
			score = ang * 4 + d * 0.1
		end
		if score < bestScore then
			best, bestScore, kind, id, at = true, score, k, tid, p
		end
	end
	local mid = player:GetAttribute("MatchId")
	if mid then
		for _, other in ipairs(Players:GetPlayers()) do
			if other ~= player and other:GetAttribute("MatchId") == mid and other:GetAttribute("Team") ~= player:GetAttribute("Team") then
				local r = other.Character and other.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
				local h = other.Character and other.Character:FindFirstChildOfClass("Humanoid")
				if r and h and h.Health > 0 then
					consider(r.Position, "p", other.UserId)
				end
			end
		end
	else
		for _, m in ipairs(MonsterController.Alive()) do
			consider(MonsterController.Pos(m), "m", m:GetAttribute("MonsterId"))
		end
	end
	if best then
		return kind, id, at
	end
	return nil
end

local function step()
	local t = tool()
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not t or not root or not (holding or GunController.Auto) then
		return
	end
	local rate = t:GetAttribute("Rate") or 2
	if os.clock() - lastShot < 1 / rate then
		return
	end
	local aimRay = nil
	if holding and UserInputService.MouseEnabled and not UserInputService.TouchEnabled then
		local m = UserInputService:GetMouseLocation()
		aimRay = Workspace.CurrentCamera:ViewportPointToRay(m.X, m.Y)
	end
	local kind, id, at = pickTarget(root, t:GetAttribute("Range") or 60, aimRay)
	if not kind then
		return
	end
	lastShot = os.clock()
	Net.send("Fire", kind, id)
	local from = muzzlePos(t, char)
	if from then
		tracer(from, at, Guns.Rarities[t:GetAttribute("Rarity") or 1].color)
	end
	-- face the target (feels responsive, helps mobile)
	local flat = Vector3.new(at.X, root.Position.Y, at.Z)
	if (flat - root.Position).Magnitude > 1 then
		root.CFrame = CFrame.lookAt(root.Position, flat)
	end
end

function GunController.Init()
	local gui = UIController.Gui()
	UserInputService.InputBegan:Connect(function(input, processed)
		if not processed and input.UserInputType == Enum.UserInputType.MouseButton1 then
			holding = true
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			holding = false
		end
	end)
	-- big FIRE button (touch) + AUTO toggle (pass)
	local fire = UI.button("FIRE", Theme.Colors.Danger, function() end, {
		AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -150, 1, -150), Size = UDim2.fromOffset(110, 110),
		Visible = UserInputService.TouchEnabled, Parent = gui })
	UI.corner(UDim.new(1, 0)).Parent = fire
	fire.MouseButton1Down:Connect(function()
		holding = true
	end)
	fire.MouseButton1Up:Connect(function()
		holding = false
	end)
	fire.MouseLeave:Connect(function()
		holding = false
	end)
	local auto
	auto = UI.button("AUTO: OFF", Theme.Colors.PanelLight, function()
		local passes = UIController.State.passes or {}
		if not table.find(passes, "AutoFarm") then
			UIController.Toast("Auto Farm pass required — see SHOP", "info")
			UIController.Open("Shop")
			return
		end
		GunController.Auto = not GunController.Auto
		auto.Label.Text = if GunController.Auto then "AUTO: ON" else "AUTO: OFF"
	end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -16, 1, -86), Size = UDim2.fromOffset(150, 50), Parent = gui })
	auto.Label.TextSize = 18

	Net.listen("Shot", function(shooter: Player, to: Vector3)
		local char = shooter.Character
		local t = char and char:FindFirstChildOfClass("Tool")
		local from = muzzlePos(t, char)
		if from and (from - Workspace.CurrentCamera.CFrame.Position).Magnitude < 150 then
			tracer(from, to, Guns.Rarities[(t and t:GetAttribute("Rarity")) or 1].color)
		end
	end)
	RunService.Heartbeat:Connect(step)
end

return GunController
