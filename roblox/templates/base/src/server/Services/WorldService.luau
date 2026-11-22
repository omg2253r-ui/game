-- Applies the lighting preset and builds a starter map when none exists.
-- Perf: all static parts Anchored, decorations CanCollide/CanQuery/CanTouch off,
-- CastShadow off on small props, everything grouped under one Map model for streaming.
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local World = require(ReplicatedStorage.Shared.Config.World)

local WorldService = {}

local function ensure(className: string, name: string)
	local inst = Lighting:FindFirstChild(name) or Instance.new(className)
	inst.Name = name
	inst.Parent = Lighting
	return inst
end

local function setProps(inst: Instance, props)
	for k, v in pairs(props or {}) do
		local ok, err = pcall(function()
			(inst :: any)[k] = v
		end)
		if not ok then
			warn("[WorldService] bad prop", k, err)
		end
	end
end

function WorldService.ApplyPreset(name: string)
	local p = World.Presets[name]
	if not p then
		warn("[WorldService] unknown preset", name)
		return
	end
	setProps(Lighting, p.Lighting)
	setProps(ensure("Atmosphere", "Atmosphere"), p.Atmosphere)
	setProps(ensure("BloomEffect", "Bloom"), p.Bloom)
	setProps(ensure("ColorCorrectionEffect", "ColorCorrection"), p.ColorCorrection)
	local rays = ensure("SunRaysEffect", "SunRays")
	rays.Enabled = p.SunRays ~= nil
	setProps(rays, p.SunRays)
end

local function part(parent, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material, decor: boolean)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material
	p.TopSurface = Enum.SurfaceType.Smooth
	if decor then
		p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = false, false, false, false
	end
	p.Parent = parent
	return p
end

local function fallbackTree(parent, pos: Vector3, rng: Random)
	local m = Instance.new("Model")
	m.Name = "Tree"
	local h = rng:NextNumber(6, 10)
	local trunk = part(m, Vector3.new(1.6, h, 1.6), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(120, 80, 50), Enum.Material.Wood, false)
	trunk.CastShadow = false
	local leaf = part(m, Vector3.one * rng:NextNumber(7, 10), CFrame.new(pos + Vector3.new(0, h + 2, 0)), Color3.fromRGB(80, 180, 80):Lerp(Color3.fromRGB(150, 220, 90), rng:NextNumber()), Enum.Material.Grass, true)
	leaf.Shape = Enum.PartType.Ball
	m.Parent = parent
end

function WorldService.BuildStarterMap()
	local cfg = World.StarterMap
	if not cfg.Enabled or workspace:FindFirstChild("Map") then
		return
	end
	local map = Instance.new("Model")
	map.Name = "Map"
	map.ModelStreamingMode = Enum.ModelStreamingMode.Default

	local base = workspace:FindFirstChild("Baseplate")
	if base then
		base:Destroy()
	end
	part(map, cfg.GroundSize, CFrame.new(0, -cfg.GroundSize.Y / 2, 0), cfg.GroundColor, cfg.GroundMaterial, false).Name = "Ground"

	local spawn = Instance.new("SpawnLocation")
	spawn.Anchored = true
	spawn.Size = Vector3.new(14, 1, 14)
	spawn.Position = Vector3.new(0, 0.5, 0)
	spawn.Color = Color3.fromRGB(255, 255, 255)
	spawn.Material = Enum.Material.SmoothPlastic
	spawn.Duration = 0
	spawn.Parent = map

	for _, pl in ipairs(cfg.Platforms) do
		part(map, pl[2], CFrame.new(pl[1]), pl[3], Enum.Material.SmoothPlastic, false)
	end

	local assets = ReplicatedStorage:FindFirstChild("Assets")
	local decorList = assets and assets:FindFirstChild("Decor") and assets.Decor:GetChildren() or {}
	local rng = Random.new(42)
	local decor = Instance.new("Folder")
	decor.Name = "Decor"
	decor.Parent = map
	for _ = 1, cfg.Decorations do
		local r = cfg.GroundSize.X / 2 - 10
		local pos = Vector3.new(rng:NextNumber(-r, r), 0, rng:NextNumber(-r, r))
		if pos.Magnitude > 30 then -- keep spawn clear
			if #decorList > 0 then
				local m = decorList[rng:NextInteger(1, #decorList)]:Clone()
				m:PivotTo(CFrame.new(pos) * CFrame.Angles(0, rng:NextNumber(0, math.pi * 2), 0))
				m.Parent = decor
			else
				fallbackTree(decor, pos, rng)
			end
		end
	end
	map.Parent = workspace
end

function WorldService.Init()
	WorldService.ApplyPreset(World.Preset)
	WorldService.BuildStarterMap()
end

return WorldService
