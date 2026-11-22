-- Applies the current zone's lighting preset locally and shows a zone-name banner on change.
local Lighting = game:GetService("Lighting")
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
			TweenService:Create(inst, TweenInfo.new(1.2), tweenable):Play()
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
	apply(rays, p.SunRays, false)
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
