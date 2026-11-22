-- Shooting with realistic feel: magazine + reload (R / button / auto), recoil camera kick, spread,
-- per-gun sounds, muzzle light, travelling bullets, hit sparks + flash. Hold mouse / FIRE / AUTO.
-- Client picks target (aim-assist cone) and predicts ammo; the server validates everything.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Guns = require(Shared.Config.Guns)
local Sounds = require(Shared.Config.Sounds)
local UI = require(script.Parent.Parent.UIKit)
local UIController = require(script.Parent.UIController)
local MonsterController = require(script.Parent.MonsterController)
local Vfx = require(script.Parent.VfxController)

local player = Players.LocalPlayer
local GunController = { Auto = false, Mag = 0, MaxMag = 0, ReloadUntil = 0, ReloadTime = 0 }
local holding = false
local lastShot = 0
local rng = Random.new()

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
GunController.MuzzlePos = muzzlePos

function GunController.Reloading(): boolean
	return os.clock() < GunController.ReloadUntil
end

function GunController.Reload()
	if GunController.Reloading() or GunController.Mag >= GunController.MaxMag then
		return
	end
	GunController.ReloadUntil = os.clock() + GunController.ReloadTime
	Net.send("Reload")
	Vfx.Sound(Sounds.Reload)
	task.delay(GunController.ReloadTime, function()
		if os.clock() >= GunController.ReloadUntil - 0.01 then
			GunController.Mag = GunController.MaxMag
		end
	end)
end

local function pickTarget(root: BasePart, range: number, aimRay: Ray?)
	local bestScore, kind, id, at, model = math.huge, nil, nil, nil, nil
	local function consider(p: Vector3, k: string, tid: number, m: Model?)
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
			bestScore, kind, id, at, model = score, k, tid, p, m
		end
	end
	local mid = player:GetAttribute("MatchId")
	if mid then
		for _, other in ipairs(Players:GetPlayers()) do
			if other ~= player and other:GetAttribute("MatchId") == mid and other:GetAttribute("Team") ~= player:GetAttribute("Team") then
				local r = other.Character and other.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
				local h = other.Character and other.Character:FindFirstChildOfClass("Humanoid")
				if r and h and h.Health > 0 then
					consider(r.Position, "p", other.UserId, other.Character)
				end
			end
		end
	else
		for _, m in ipairs(MonsterController.Alive()) do
			consider(MonsterController.Pos(m) + Vector3.new(0, MonsterController.Bob(m), 0), "m", m:GetAttribute("MonsterId"), m)
		end
	end
	return kind, id, at, model
end

local function step()
	local t = tool()
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not t or not root or not (holding or GunController.Auto) then
		return
	end
	local typeId = t:GetAttribute("Gun") :: string
	local def = Guns.Types[typeId]
	if not def or GunController.Reloading() then
		return
	end
	local rate = if player:GetAttribute("MatchId") then def.rate else (t:GetAttribute("Rate") or def.rate)
	if os.clock() - lastShot < 1 / rate then
		return
	end
	if GunController.Mag <= 0 then
		lastShot = os.clock()
		Vfx.Sound(Sounds.Empty)
		GunController.Reload()
		return
	end
	local aimRay = nil
	if holding and UserInputService.MouseEnabled and not UserInputService.TouchEnabled then
		local m = UserInputService:GetMouseLocation()
		aimRay = Workspace.CurrentCamera:ViewportPointToRay(m.X, m.Y)
	end
	local range = if player:GetAttribute("MatchId") then def.range else (t:GetAttribute("Range") or def.range)
	local kind, id, at, model = pickTarget(root, range, aimRay)
	if not kind then
		return
	end
	lastShot = os.clock()
	GunController.Mag -= 1
	Net.send("Fire", kind, id)

	local color = Guns.Rarities[t:GetAttribute("Rarity") or 1].color
	local from = muzzlePos(t, char)
	if from then
		Vfx.MuzzleFlash(from, color)
		Vfx.Sound(Sounds.Guns[def.sound or typeId], from)
		for _ = 1, math.min(def.pellets, 3) do -- shotgun shows a few pellets
			local sp = math.rad(def.spread)
			local jitter = Vector3.new(rng:NextNumber(-sp, sp), rng:NextNumber(-sp, sp), rng:NextNumber(-sp, sp)) * (at - from).Magnitude
			Vfx.Bullet(from, at + jitter * 0.5, color, function()
				Vfx.HitSpark(at, false)
			end)
		end
	end
	Vfx.HitFlash(model)
	-- recoil: small camera kick (PC aim) + body faces the target
	if aimRay then
		local cam = Workspace.CurrentCamera
		cam.CFrame = cam.CFrame * CFrame.Angles(math.rad(def.recoil * 0.35), 0, 0)
	end
	Vfx.Shake(def.recoil * 0.02, 0.05)
	local flat = Vector3.new(at.X, root.Position.Y, at.Z)
	if (flat - root.Position).Magnitude > 1 then
		root.CFrame = CFrame.lookAt(root.Position, flat)
	end
	if GunController.Mag <= 0 then
		GunController.Reload()
	end
end

function GunController.Init()
	local gui = UIController.Gui()
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			holding = true
		elseif input.KeyCode == Enum.KeyCode.R then
			GunController.Reload()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			holding = false
		end
	end)
	local touch = UserInputService.TouchEnabled
	local fire = UI.button("FIRE", Theme.Colors.Danger, function() end, {
		AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -150, 1, -150), Size = UDim2.fromOffset(110, 110), Visible = touch, Parent = gui })
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
	local reloadBtn = UI.button("R", Theme.Colors.PanelLight, GunController.Reload, {
		AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -270, 1, -160), Size = UDim2.fromOffset(64, 64), Visible = touch, Parent = gui })
	UI.corner(UDim.new(1, 0)).Parent = reloadBtn
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

	Net.listen("Ammo", function(mag: number, max: number, reload: number)
		GunController.MaxMag = max
		if reload > 0 then
			if not GunController.Reloading() then
				GunController.ReloadUntil = os.clock() + reload
				task.delay(reload, function()
					GunController.Mag = max
				end)
			end
			GunController.ReloadTime = reload
		else
			GunController.Mag = mag
			GunController.ReloadUntil = 0
			local t = tool()
			local def = t and Guns.Types[t:GetAttribute("Gun") :: string]
			GunController.ReloadTime = def and def.reload or 1.5
		end
	end)
	Net.listen("Shot", function(shooter: Player, to: Vector3)
		local char = shooter.Character
		local t = char and char:FindFirstChildOfClass("Tool")
		local from = muzzlePos(t, char)
		if from and (from - Workspace.CurrentCamera.CFrame.Position).Magnitude < 150 then
			local color = Guns.Rarities[(t and t:GetAttribute("Rarity")) or 1].color
			Vfx.MuzzleFlash(from, color)
			Vfx.Bullet(from, to, color, nil)
		end
	end)
	RunService.Heartbeat:Connect(step)
end

return GunController
