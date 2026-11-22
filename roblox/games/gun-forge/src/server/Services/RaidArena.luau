-- Raid arena builder (flat floor, walls, cover, spawn pad), one instance per slot.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")
local Cfg = require(ReplicatedStorage.Shared.Config.Raid)
local Zones = require(ReplicatedStorage.Shared.Config.Zones)

local Arena = { Built = {} :: { [number]: Model } }
local arenas = Arena.Built

function Arena.ZoneOfTier(tier: number)
	for _, z in ipairs(Zones) do
		if z.tier == tier then
			return z
		end
	end
	return Zones[1]
end


local function part(parent: Instance, name: string, size: Vector3, pos: Vector3, color: Color3, transparency: number?)
	local p = Instance.new("Part")
	p.Name, p.Size, p.Position, p.Color, p.Anchored = name, size, pos, color, true
	p.Material = Enum.Material.SmoothPlastic
	p.Transparency = transparency or 0
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end


function Arena.Origin(slot: number): Vector3
	return Cfg.ArenaOrigin + Vector3.new(slot * Cfg.ArenaSpacing, 0, 0)
end


function Arena.Build(slot: number): Model
	if arenas[slot] then
		return arenas[slot]
	end
	local map = Workspace:FindFirstChild("Map") or Workspace
	local root = map:FindFirstChild("Raid") or Instance.new("Folder")
	root.Name = "Raid"
	if not root.Parent then
		root.Parent = map
	end
	local m = Instance.new("Model")
	m.Name = "Arena" .. slot
	local o, s = Arena.Origin(slot), Cfg.ArenaSize
	part(m, "Floor", Vector3.new(s, 2, s), o + Vector3.new(0, -1, 0), Color3.fromRGB(55, 50, 70))
	for _, d in ipairs({ { 0, 1 }, { 0, -1 }, { 1, 0 }, { -1, 0 } }) do -- walls (20 high, invisible-ish top)
		local horiz = d[1] == 0
		part(m, "Wall", if horiz then Vector3.new(s, 24, 2) else Vector3.new(2, 24, s), o + Vector3.new(d[1] * (s / 2 + 1), 12, d[2] * (s / 2 + 1)), Color3.fromRGB(90, 70, 120), 0.4)
	end
	for _, c in ipairs({ { -30, -30 }, { 30, -30 }, { -30, 30 }, { 30, 30 }, { 0, -45 }, { 0, 45 } }) do
		part(m, "Cover", Vector3.new(10, 6, 10), o + Vector3.new(c[1], 3, c[2]), Color3.fromRGB(120, 100, 150))
	end
	local pad = part(m, "SpawnPad", Vector3.new(14, 1, 14), o + Vector3.new(0, 0.5, 0), Color3.fromRGB(80, 220, 160))
	pad.Material = Enum.Material.Neon
	m.Parent = root
	arenas[slot] = m
	return m
end

return Arena
