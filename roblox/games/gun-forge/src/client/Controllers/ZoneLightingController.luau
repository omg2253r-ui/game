-- Applies the current zone's lighting preset locally and shows a zone-name banner on change.
local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local World = require(ReplicatedStorage.Shared.Config.World)
local Zones = require(ReplicatedStorage.Shared.Config.Zones)

local ZoneLightingController = {}

local current: string? = nil
local banner: TextLabel? = nil

local function ensure(className: string, name: string)
	local inst = Lighting:FindFirstChild(name) or Instance.new(className)
	inst.Name = name
	inst.Parent = Lighting
	return inst
end

-- Tween every numeric/Color3 prop (~1 s); set the rest (bool/enum) immediately.
local FADE = TweenInfo.new(1, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)
local function apply(inst: Instance, props, fade: boolean)
	local tweenable = {}
	for k, v in pairs(props or {}) do
		if fade and (typeof(v) == "number" or typeof(v) == "Color3") then
			tweenable[k] = v
		else
			pcall(function()
				(inst :: any)[k] = v
			end)
		end
	end
	if next(tweenable) then
		pcall(function()
			TweenService:Create(inst, FADE, tweenable):Play()
		end)
	end
end

local function applyPreset(name: string)
	local p = World.Presets[name]
	if not p then
		return
	end
	apply(Lighting, p.Lighting, true)
	apply(ensure("Atmosphere", "Atmosphere"), p.Atmosphere, true)
	apply(ensure("BloomEffect", "Bloom"), p.Bloom, true)
	apply(ensure("ColorCorrectionEffect", "ColorCorrection"), p.ColorCorrection, true)
	local rays = ensure("SunRaysEffect", "SunRays")
	rays.Enabled = p.SunRays ~= nil
	apply(rays, p.SunRays, true)
	local dof = ensure("DepthOfFieldEffect", "DepthOfField")
	dof.Enabled = p.DepthOfField ~= nil
	apply(dof, p.DepthOfField, true)
	apply(workspace.Terrain, p.Water, true)
	if p.Sky then
		local sky = Lighting:FindFirstChildOfClass("Sky") or ensure("Sky", "Sky")
		apply(sky, p.Sky, true)
	end
end

-- ===== Map animations (server tags decor with "MapAnim" + AnimKind attributes): Spin / Pulse / Beam =====
-- Only entries within RANGE of the camera are updated; spins every frame, the rest at 10 Hz.
local TAG, RANGE = "MapAnim", 420
local anims: { [Instance]: any } = {}
local spinList: { any } = {}
local slowList: { any } = {}

local function register(inst: Instance)
	local kind = inst:GetAttribute("AnimKind")
	if typeof(kind) ~= "string" then
		return
	end
	local e: any = { inst = inst, kind = kind, speed = inst:GetAttribute("AnimSpeed") or 1, ph = inst:GetAttribute("AnimPh") or 0, lo = inst:GetAttribute("AnimLo") or 0.3, hi = inst:GetAttribute("AnimHi") or 0.8 }
	if kind == "Spin" then
		local pivot, axis = inst:GetAttribute("AnimPivot"), inst:GetAttribute("AnimAxis")
		if not inst:IsA("BasePart") or typeof(pivot) ~= "Vector3" or typeof(axis) ~= "Vector3" then
			return
		end
		e.base, e.pivot, e.axis, e.pos = inst.CFrame, pivot, axis.Unit, inst.Position
	elseif kind == "Pulse" then
		if not inst:IsA("BasePart") then
			return
		end
		e.pos = inst.Position
	elseif kind ~= "Beam" or not inst:IsA("Beam") then
		return
	end
	anims[inst] = e
end

local function startAnims()
	for _, inst in ipairs(CollectionService:GetTagged(TAG)) do
		register(inst)
	end
	CollectionService:GetInstanceAddedSignal(TAG):Connect(register)
	CollectionService:GetInstanceRemovedSignal(TAG):Connect(function(inst)
		anims[inst] = nil
	end)
	local clock, refresh, slow = 0, 1, 0
	RunService.Heartbeat:Connect(function(dt)
		clock += dt
		refresh += dt
		slow += dt
		local cam = workspace.CurrentCamera
		if not cam then
			return
		end
		if refresh >= 0.5 then
			refresh = 0
			table.clear(spinList)
			table.clear(slowList)
			local cp = cam.CFrame.Position
			for inst, e in pairs(anims) do
				local pos = e.pos
				if not pos and inst:IsA("Beam") then
					local a = (inst :: Beam).Attachment0
					pos = a and a.WorldPosition
				end
				if pos and (pos - cp).Magnitude < RANGE then
					table.insert(e.kind == "Spin" and spinList or slowList, e)
				end
			end
		end
		for _, e in ipairs(spinList) do
			e.inst.CFrame = CFrame.new(e.pivot) * CFrame.fromAxisAngle(e.axis, clock * e.speed) * CFrame.new(-e.pivot) * e.base
		end
		if slow >= 0.1 then
			slow = 0
			for _, e in ipairs(slowList) do
				local w = 0.5 + 0.5 * math.sin(clock * e.speed + e.ph)
				if e.kind == "Pulse" then
					e.inst.Transparency = e.lo + (e.hi - e.lo) * w
				else
					local b = e.inst :: Beam
					local mid = e.lo + (e.hi - e.lo) * w
					b.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.95), NumberSequenceKeypoint.new(0.5, mid), NumberSequenceKeypoint.new(1, 0.95) })
					b.Width1 = 70 + 14 * math.sin(clock * e.speed * 0.7 + e.ph)
				end
			end
		end
	end)
end

local function getBanner(): TextLabel
	if banner and banner.Parent then
		return banner
	end
	local gui = Instance.new("ScreenGui")
	gui.Name = "ZoneBanner"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = 20
	local t = Instance.new("TextLabel")
	t.AnchorPoint = Vector2.new(0.5, 0.5)
	t.Position = UDim2.fromScale(0.5, 0.22)
	t.Size = UDim2.fromScale(0.6, 0.1)
	t.BackgroundTransparency = 1
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.TextColor3 = Color3.fromRGB(255, 255, 255)
	t.TextStrokeColor3 = Color3.fromRGB(22, 20, 42)
	t.TextStrokeTransparency = 0
	t.TextTransparency = 1
	t.Parent = gui
	gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
	banner = t
	return t
end

local function showBanner(text: string, color: Color3)
	local t = getBanner()
	t.Text = string.upper(text)
	t.TextColor3 = color
	t.TextTransparency = 1
	t.Position = UDim2.fromScale(0.5, 0.26)
	TweenService:Create(t, TweenInfo.new(0.4, Enum.EasingStyle.Back), { TextTransparency = 0, Position = UDim2.fromScale(0.5, 0.22) }):Play()
	local mine = text
	task.delay(2.4, function()
		if banner and banner.Text == string.upper(mine) then
			TweenService:Create(banner, TweenInfo.new(0.6), { TextTransparency = 1 }):Play()
		end
	end)
end

-- returns key, preset, display name, color
local function locate(pos: Vector3): (string, string, string, Color3)
	for _, z in ipairs(Zones) do
		if math.abs(pos.X - z.center.X) <= z.size.X / 2 and math.abs(pos.Z - z.center.Z) <= z.size.Z / 2 then
			return z.id, z.preset, z.name, z.color:Lerp(Color3.new(1, 1, 1), 0.35)
		end
	end
	local A = World.Arena
	if math.abs(pos.Z - A.Origin.Z) <= A.Size / 2 + 20 and math.abs(pos.X - A.Origin.X) <= A.Spacing + A.Size / 2 + 20 then
		return "arena", "NeonCity", "PvP Arena", Color3.fromRGB(255, 79, 216)
	end
	return "hub", World.Preset, "Training Hub", Color3.fromRGB(58, 216, 255)
end

function ZoneLightingController.Init()
	startAnims()
	local player = Players.LocalPlayer
	while true do -- lint-ok (task.wait)
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if root and root:IsA("BasePart") then
			local key, preset, name, color = locate(root.Position)
			if key ~= current then
				local first = current == nil
				current = key
				applyPreset(preset)
				if not first or key ~= "hub" then
					showBanner(name, color)
				end
			end
		end
		task.wait(0.5)
	end
end

return ZoneLightingController
