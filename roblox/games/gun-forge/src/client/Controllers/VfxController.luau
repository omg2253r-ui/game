-- Smooth, cheap client VFX + audio. Everything is pooled or short-lived, respects Low Graphics.
--   Bullet (travelling tracer)  MuzzleFlash (light + sparks)  HitSpark  DamageNumber (pop + crit)
--   HitFlash (shared Highlight)  DeathBurst (smoke + ring)  LootOrbs (fly to player)  Shake  Sound
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Sounds = require(Shared.Config.Sounds)
local Theme = require(Shared.Theme)
local UI = require(script.Parent.Parent.UIKit)
local Effects = require(script.Parent.EffectsController)

local Vfx = {}
local player = Players.LocalPlayer
local terrain = Workspace.Terrain
local emitters: { [string]: ParticleEmitter } = {}
local anchorAtt: Attachment
local highlight: Highlight
local shakeUntil, shakePower = 0, 0

local function fx(): boolean
	return not Effects.LowFx
end

local function newPart(): Part
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	return p
end

function Vfx.Sound(def, pos: Vector3?)
	if not def or not def.id then
		return
	end
	local s = Instance.new("Sound")
	s.SoundId = def.id
	s.Volume = def.volume or 0.5
	s.PlaybackSpeed = (def.pitch or 1) * (0.94 + math.random() * 0.12) -- slight variation = less robotic
	if pos then
		local a = Instance.new("Attachment")
		a.WorldPosition = pos
		a.Parent = terrain
		s.RollOffMaxDistance = Sounds.MaxDistance
		s.Parent = a
		s:Play()
		task.delay(3, function()
			a:Destroy()
		end)
	else
		s.Parent = SoundService
		s:Play()
		task.delay(3, function()
			s:Destroy()
		end)
	end
end

local function emitAt(kind: string, pos: Vector3, n: number, color: Color3?)
	local e = emitters[kind]
	if not e or not fx() then
		return
	end
	anchorAtt.WorldPosition = pos
	e.Color = ColorSequence.new(color or Color3.fromRGB(255, 230, 150), Color3.new(1, 1, 1))
	e:Emit(n)
end

-- travelling bolt (fast) + fading streak: reads as a real bullet but costs 2 parts for 0.1 s
function Vfx.Bullet(from: Vector3, to: Vector3, color: Color3, onArrive: (() -> ())?)
	local dist = (to - from).Magnitude
	if dist < 0.5 then
		return
	end
	local travel = math.clamp(dist / 700, 0.03, 0.14)
	local bolt = newPart()
	bolt.Color = color
	bolt.Size = Vector3.new(0.14, 0.14, math.min(5, dist))
	bolt.CFrame = CFrame.lookAt(from, to)
	bolt.Parent = Workspace
	TweenService:Create(bolt, TweenInfo.new(travel, Enum.EasingStyle.Linear), { CFrame = CFrame.lookAt(to, to + (to - from)) }):Play()
	if fx() then
		local streak = newPart()
		streak.Color = color
		streak.Transparency = 0.55
		streak.Size = Vector3.new(0.06, 0.06, dist)
		streak.CFrame = CFrame.lookAt(from, to) * CFrame.new(0, 0, -dist / 2)
		streak.Parent = Workspace
		TweenService:Create(streak, TweenInfo.new(0.16), { Transparency = 1 }):Play()
		task.delay(0.18, function()
			streak:Destroy()
		end)
	end
	task.delay(travel, function()
		bolt:Destroy()
		if onArrive then
			onArrive()
		end
	end)
end

function Vfx.MuzzleFlash(pos: Vector3, color: Color3)
	if not fx() then
		return
	end
	local a = Instance.new("Attachment")
	a.WorldPosition = pos
	a.Parent = terrain
	local light = Instance.new("PointLight")
	light.Color = color
	light.Brightness = 5
	light.Range = 9
	light.Shadows = false
	light.Parent = a
	TweenService:Create(light, TweenInfo.new(0.08), { Brightness = 0 }):Play()
	task.delay(0.1, function()
		a:Destroy()
	end)
	local f = newPart()
	f.Shape = Enum.PartType.Ball
	f.Color = Color3.new(1, 0.95, 0.8):Lerp(color, 0.4)
	f.Size = Vector3.one * 0.9
	f.Position = pos
	f.Parent = Workspace
	TweenService:Create(f, TweenInfo.new(0.07, Enum.EasingStyle.Quad), { Size = Vector3.one * 0.15, Transparency = 1 }):Play()
	task.delay(0.08, function()
		f:Destroy()
	end)
end

function Vfx.HitSpark(pos: Vector3, crit: boolean?)
	emitAt("spark", pos, if crit then 14 else 6, if crit then Theme.Colors.Gold else nil)
end

function Vfx.DamageNumber(pos: Vector3, dmg: number, crit: boolean?, short: (number) -> string)
	local a = Instance.new("Attachment")
	a.WorldPosition = pos + Vector3.new((math.random() - 0.5) * 2, 1.5, (math.random() - 0.5) * 2)
	a.Parent = terrain
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(if crit then 200 else 140, if crit then 46 else 32)
	bb.AlwaysOnTop = true
	bb.MaxDistance = 120
	bb.LightInfluence = 0
	local l = UI.label(if crit then ("CRIT " .. short(dmg) .. "!") else short(dmg), if crit then 34 else 22,
		{ Size = UDim2.fromScale(1, 1), TextColor3 = if crit then Theme.Colors.Gold else Color3.new(1, 1, 1), Parent = bb })
	local sc = UI.new("UIScale", { Scale = 0.4, Parent = l })
	bb.Parent = a
	TweenService:Create(sc, TweenInfo.new(0.18, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = if crit then 1.25 else 1 }):Play()
	TweenService:Create(bb, TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { StudsOffset = Vector3.new(0, 3, 0) }):Play()
	task.delay(0.45, function()
		TweenService:Create(l, TweenInfo.new(0.35), { TextTransparency = 1 }):Play()
		local st = l:FindFirstChildOfClass("UIStroke")
		if st then
			TweenService:Create(st, TweenInfo.new(0.35), { Transparency = 1 }):Play()
		end
	end)
	task.delay(0.85, function()
		a:Destroy()
	end)
end

function Vfx.HitFlash(model: Model?)
	if not model or not fx() then
		return
	end
	highlight.Adornee = model
	highlight.FillTransparency = 0.25
	highlight.OutlineTransparency = 0.2
	TweenService:Create(highlight, TweenInfo.new(0.14), { FillTransparency = 1, OutlineTransparency = 1 }):Play()
end

function Vfx.DeathBurst(pos: Vector3, size: number, color: Color3)
	emitAt("smoke", pos, math.clamp(math.floor(size * 2), 4, 14), color)
	emitAt("spark", pos, 12, color)
	Vfx.Sound(Sounds.Death, pos)
	if not fx() then
		return
	end
	local ring = newPart()
	ring.Shape = Enum.PartType.Cylinder
	ring.Color = color
	ring.Transparency = 0.3
	ring.Size = Vector3.new(0.2, size, size)
	ring.CFrame = CFrame.new(pos.X, 0.25, pos.Z) * CFrame.Angles(0, 0, math.rad(90))
	ring.Parent = Workspace
	TweenService:Create(ring, TweenInfo.new(0.4, Enum.EasingStyle.Quad), { Size = Vector3.new(0.2, size * 3, size * 3), Transparency = 1 }):Play()
	task.delay(0.42, function()
		ring:Destroy()
	end)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if root and (root.Position - pos).Magnitude < 40 then
		Vfx.Shake(math.clamp(size / 20, 0.05, 0.4), 0.15)
	end
end

-- glowing orbs pop out, then home onto the player (classic satisfying pickup)
function Vfx.LootOrbs(pos: Vector3, count: number, color: Color3)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then
		return
	end
	count = if fx() then math.clamp(count, 1, 8) else 1
	for i = 1, count do
		local o = newPart()
		o.Shape = Enum.PartType.Ball
		o.Color = color
		o.Size = Vector3.one * 0.7
		o.Position = pos + Vector3.new(0, 1, 0)
		o.Parent = Workspace
		local up = pos + Vector3.new((math.random() - 0.5) * 6, 3 + math.random() * 3, (math.random() - 0.5) * 6)
		local t1 = TweenService:Create(o, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = up })
		t1:Play()
		task.delay(0.25 + i * 0.04, function()
			local start, t0 = o.Position, os.clock()
			local conn
			conn = RunService.RenderStepped:Connect(function() -- lint-ok (short-lived, ≤ 0.4 s)
				local a = math.clamp((os.clock() - t0) / 0.35, 0, 1)
				local target = root.Position
				o.Position = start:Lerp(target, a * a)
				o.Size = Vector3.one * (0.7 - 0.4 * a)
				if a >= 1 then
					conn:Disconnect()
					o:Destroy()
					if i == 1 then
						Vfx.Sound(Sounds.Loot)
					end
				end
			end)
		end)
	end
end

function Vfx.Shake(power: number, duration: number)
	shakePower = math.max(shakePower, power)
	shakeUntil = math.max(shakeUntil, os.clock() + duration)
end

function Vfx.Init()
	anchorAtt = Instance.new("Attachment")
	anchorAtt.Parent = terrain

	local spark = Instance.new("ParticleEmitter")
	spark.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	spark.LightEmission = 1
	spark.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 0) })
	spark.Speed = NumberRange.new(10, 22)
	spark.SpreadAngle = Vector2.new(180, 180)
	spark.Lifetime = NumberRange.new(0.15, 0.35)
	spark.Drag = 6
	spark.Rate = 0
	spark.Parent = anchorAtt
	emitters.spark = spark

	local smoke = Instance.new("ParticleEmitter")
	smoke.Texture = "rbxasset://textures/particles/smoke_main.dds"
	smoke.LightEmission = 0.3
	smoke.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 1) })
	smoke.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.5), NumberSequenceKeypoint.new(1, 4) })
	smoke.Speed = NumberRange.new(3, 8)
	smoke.SpreadAngle = Vector2.new(180, 180)
	smoke.Lifetime = NumberRange.new(0.5, 0.9)
	smoke.Drag = 3
	smoke.RotSpeed = NumberRange.new(-90, 90)
	smoke.Rate = 0
	smoke.Parent = anchorAtt
	emitters.smoke = smoke

	highlight = Instance.new("Highlight")
	highlight.FillColor = Color3.new(1, 1, 1)
	highlight.OutlineColor = Color3.new(1, 1, 1)
	highlight.FillTransparency = 1
	highlight.OutlineTransparency = 1
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded
	highlight.Parent = Workspace

	-- camera shake through Humanoid.CameraOffset (smooth, never fights the camera script)
	RunService.RenderStepped:Connect(function() -- lint-ok (one cheap offset update)
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if not hum then
			return
		end
		local t = os.clock()
		if t < shakeUntil and fx() then
			local p = shakePower
			hum.CameraOffset = Vector3.new((math.random() - 0.5) * p, (math.random() - 0.5) * p, 0)
		elseif hum.CameraOffset ~= Vector3.zero then
			hum.CameraOffset = hum.CameraOffset:Lerp(Vector3.zero, 0.5)
			if hum.CameraOffset.Magnitude < 0.01 then
				hum.CameraOffset = Vector3.zero
				shakePower = 0
			end
		end
	end)
end

return Vfx
