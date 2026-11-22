-- Builds workspace.Map in code (Hub, Zones, Arena). Names are contracts for other services:
--   Map.Hub{TrainingPads, Booth_*, Forge, FusionAltar, RebirthStatue, ArenaPortal, ClanBoard, CodesBoard, SpawnLocation, BossPit}
--   Map.Zones.<id>{Ground, SpawnArea, Gate(PowerReq, ZoneId), landmark}   Map.Arena.Arena1..3{SpawnA, SpawnB}
-- Perf: all Anchored; decor has CanCollide/CanQuery/CanTouch/CastShadow off. ~1000 parts total.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Zones = require(ReplicatedStorage.Shared.Config.Zones)
local World = require(ReplicatedStorage.Shared.Config.World)
local Combat = require(ReplicatedStorage.Shared.Config.Combat)
local P = require(script.Parent.MapParts)

local part, cyl = P.part, P.cyl
local NEON = Enum.Material.Neon
local MapService = {}

local ZONE_MAT = {
	meadow = Enum.Material.Grass, desert = Enum.Material.Sand, frost = Enum.Material.Snow,
	magma = Enum.Material.Basalt, void = Enum.Material.Slate,
}
local ZONE_ACCENT = {
	meadow = P.Cyan, desert = P.Gold, frost = Color3.fromRGB(150, 220, 255),
	magma = Color3.fromRGB(255, 110, 30), void = P.Pink,
}

local function folder(parent: Instance, name: string)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

local function model(parent: Instance, name: string)
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

local function invisible(p: Part)
	p.Transparency = 1
	p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = false, false, false, false
end

-- ===== Hub =====
local STATIONS = { -- name, label, angle (deg), color
	{ "Booth_TargetRush", "TARGET RUSH", -72, P.Cyan },
	{ "Booth_ReloadRhythm", "RELOAD RHYTHM", -36, P.Pink },
	{ "Booth_LuckyCrate", "LUCKY CRATE", 5, P.Gold },
	{ "Forge", "THE FORGE", 30, Color3.fromRGB(255, 120, 40) },
	{ "FusionAltar", "FUSION ALTAR", 70, P.Pink },
	{ "RebirthStatue", "REBIRTH", 110, P.Gold },
	{ "ArenaPortal", "PVP ARENA", 145, Color3.fromRGB(255, 80, 80) },
	{ "ClanBoard", "CLAN HALL", 175, P.Cyan },
	{ "CodesBoard", "CODES", 225, Color3.fromRGB(120, 255, 150) },
}

local function buildHub(map: Model)
	local hub = model(map, "Hub")
	local R = World.HubRadius
	cyl(hub, "Floor", R * 2, 2, CFrame.new(0, -1, 0), P.Dark, Enum.Material.Metal)
	cyl(hub, "FloorInlay", R * 2 - 16, 0.2, CFrame.new(0, 0.05, 0), Color3.fromRGB(40, 36, 80), Enum.Material.SmoothPlastic, true)
	cyl(hub, "NeonRing", R * 2 - 4, 0.3, CFrame.new(0, 0.1, 0), P.Cyan, NEON, true)
	cyl(hub, "NeonRingInner", R * 2 - 8, 0.4, CFrame.new(0, 0.12, 0), P.Dark, Enum.Material.SmoothPlastic, true)
	for i = 1, 24 do -- edge pylons
		local a = i / 24 * math.pi * 2
		local c = CFrame.new(math.cos(a) * (R - 1), 0, math.sin(a) * (R - 1))
		part(hub, "Pylon", Vector3.new(2, 7, 2), c * CFrame.new(0, 3.5, 0), P.Dark, Enum.Material.Metal, true)
		part(hub, "PylonLight", Vector3.new(2.4, 1.2, 2.4), c * CFrame.new(0, 7.4, 0), i % 2 == 0 and P.Cyan or P.Pink, NEON, true)
	end

	local sp = Instance.new("SpawnLocation")
	sp.Anchored, sp.Size, sp.Position = true, Vector3.new(14, 1, 14), Vector3.new(0, 0.5, 0)
	sp.Material, sp.Neutral, sp.Duration, sp.TopSurface = NEON, true, 0, Enum.SurfaceType.Smooth
	sp.Color = Color3.fromRGB(58, 120, 200)
	sp.Parent = hub

	local pads = folder(hub, "TrainingPads")
	for i = 1, 6 do
		local a = math.rad(i * 60 + 30)
		local pos = Vector3.new(math.cos(a) * 24, 0.5, math.sin(a) * 24)
		local pad = part(pads, "Pad" .. i, Vector3.new(10, 1, 10), CFrame.new(pos) * CFrame.Angles(0, -a, 0), P.Dark, Enum.Material.Metal)
		part(pads, "PadGlow", Vector3.new(8, 0.3, 8), CFrame.new(pos + Vector3.new(0, 0.55, 0)) * CFrame.Angles(0, -a, 0), P.Cyan, NEON, true)
		pad.Name = "Pad" .. i
	end

	for _, s in ipairs(STATIONS) do
		local a = math.rad(s[3])
		local pos = Vector3.new(math.cos(a) * 45, 0, math.sin(a) * 45)
		local face = CFrame.lookAt(pos, Vector3.zero)
		cyl(hub, s[1] .. "_Base", 14, 0.6, CFrame.new(pos + Vector3.new(0, 0.3, 0)), P.Dark, Enum.Material.Metal, true)
		cyl(hub, s[1] .. "_Glow", 12.5, 0.7, CFrame.new(pos + Vector3.new(0, 0.32, 0)), s[4], NEON, true)
		local blk = part(hub, s[1], Vector3.new(8, 8, 8), face + Vector3.new(0, 4.6, 0), Color3.fromRGB(46, 42, 88), Enum.Material.Metal)
		part(hub, s[1] .. "_Trim", Vector3.new(8.4, 1, 8.4), face + Vector3.new(0, 9, 0), s[4], NEON, true)
		part(hub, s[1] .. "_Face", Vector3.new(5, 4, 0.4), face * CFrame.new(0, 5.6, -4.1), s[4], NEON, true)
		P.label(blk, s[2], s[4], 8)
	end

	local bp = Combat.WorldBoss.Position
	local pit = part(hub, "BossPit", Vector3.new(60, 1, 60), CFrame.new(bp.X, bp.Y - 0.3, bp.Z), Color3.fromRGB(60, 25, 40), Enum.Material.Basalt)
	for i = 1, 4 do
		local a = i * math.pi / 2
		local d = Vector3.new(math.cos(a), 0, math.sin(a))
		local sz = Vector3.new(i % 2 == 0 and 60 or 1.2, 0.4, i % 2 == 0 and 1.2 or 60)
		part(hub, "BossRim", sz, CFrame.new(pit.Position + d * 30 + Vector3.new(0, 0.7, 0)), Color3.fromRGB(255, 60, 90), NEON, true)
	end
	P.label(pit, "WORLD BOSS", Color3.fromRGB(255, 90, 110), 10)
end

-- ===== Zones =====
local function entryT(c: Vector3, half: Vector3, dir: Vector3): number -- ray from origin enters the zone square
	local t0 = 0
	local function slab(cc: number, h: number, d: number)
		if math.abs(d) < 1e-4 then return end
		local a, b = (cc - h) / d, (cc + h) / d
		t0 = math.max(t0, math.min(a, b))
	end
	slab(c.X, half.X, dir.X)
	slab(c.Z, half.Z, dir.Z)
	return t0
end

local function buildZone(parent: Folder, z)
	local m = model(parent, z.id)
	local accent = ZONE_ACCENT[z.id] or P.Cyan
	part(m, "Ground", Vector3.new(z.size.X, 2, z.size.Z), CFrame.new(z.center.X, -1, z.center.Z), z.color, ZONE_MAT[z.id] or Enum.Material.Slate)
	local sa = part(m, "SpawnArea", Vector3.new(z.size.X, 1, z.size.Z), CFrame.new(z.center.X, 0, z.center.Z), accent, nil)
	invisible(sa)

	local dir = Vector3.new(z.center.X, 0, z.center.Z).Unit
	local half = Vector3.new(z.size.X / 2, 0, z.size.Z / 2)
	local t = entryT(z.center, half, dir)
	local face = CFrame.lookAt(Vector3.zero, dir)
	local roadEnd, roadStart = t + 14, World.HubRadius - 2
	local len = roadEnd - roadStart
	local mid = dir * (roadStart + len / 2)
	part(m, "Road", Vector3.new(16, 1, len), CFrame.lookAt(mid + Vector3.new(0, -0.5, 0), mid + dir + Vector3.new(0, -0.5, 0)), P.Dark, Enum.Material.Metal)
	for side = -1, 1, 2 do -- neon edge lines
		local p = mid + face.RightVector * side * 7.6
		part(m, "RoadEdge", Vector3.new(0.8, 0.2, len), CFrame.lookAt(p + Vector3.new(0, 0.1, 0), p + dir + Vector3.new(0, 0.1, 0)), accent, NEON, true)
	end
	local gp = dir * (t - 14)
	local gate = part(m, "Gate", Vector3.new(24, 16, 2), CFrame.lookAt(gp + Vector3.new(0, 8, 0), gp + dir * 2 + Vector3.new(0, 8, 0)), accent, Enum.Material.ForceField)
	gate:SetAttribute("PowerReq", z.powerReq)
	gate:SetAttribute("ZoneId", z.id)
	gate.CastShadow = false
	for side = -1, 1, 2 do
		local p = gp + face.RightVector * side * 13
		part(m, "GatePost", Vector3.new(3, 20, 3), CFrame.new(p + Vector3.new(0, 10, 0)), P.Dark, Enum.Material.Metal, true).CanCollide = true
		part(m, "GateLight", Vector3.new(3.6, 2, 3.6), CFrame.new(p + Vector3.new(0, 21, 0)), accent, NEON, true)
	end
	part(m, "GateBeam", Vector3.new(30, 2, 3), face + gp + Vector3.new(0, 20, 0), accent, NEON, true)

	-- landmark: between the hub and the zone centre so it is visible from the hub
	local lpos = Vector3.new(z.center.X, 0, z.center.Z) - dir * 30
	local lm = model(m, "Landmark")
	P.Landmarks[z.id](lm, lpos, face, z.color)
	if z.id ~= "void" then
		part(lm, "Beacon", Vector3.new(3, 3, 3), CFrame.new(lpos + Vector3.new(0, 150, 0)), accent, NEON, true)
	end
	P.label(gate, z.name .. "  (" .. z.powerReq .. " PWR)", accent, 12)

	-- decor rocks
	local rng = Random.new(#z.id * 31)
	local decor = folder(m, "Decor")
	for _ = 1, 40 do
		local p = Vector3.new(z.center.X + rng:NextNumber(-100, 100), 0, z.center.Z + rng:NextNumber(-100, 100))
		if (p - lpos).Magnitude > 45 then
			local s = rng:NextNumber(2, 7)
			part(decor, "Rock", Vector3.new(s, s * 0.8, s), CFrame.new(p + Vector3.new(0, s * 0.3, 0)) * CFrame.Angles(rng:NextNumber(0, 3), rng:NextNumber(0, 3), 0), z.color:Lerp(Color3.new(0.3, 0.3, 0.3), 0.4), Enum.Material.Slate, true)
		end
	end
end

-- ===== Arena =====
local COVER = { -- x, z, sx, sz  (mirrored by 180 degrees -> symmetric)
	{ { 20, 0, 12, 12 }, { 0, 25, 24, 6 }, { 38, 30, 8, 8 } },
	{ { 25, 10, 6, 6 }, { 10, 30, 6, 6 }, { 38, -10, 6, 6 }, { 0, 0, 14, 14 } },
	{ { 0, 14, 40, 5 }, { 28, 28, 10, 10 }, { 30, -8, 5, 20 } },
}

local function buildArenas(map: Model)
	local root = model(map, "Arena")
	local A = World.Arena
	for i = 1, 3 do
		local m = model(root, "Arena" .. i)
		local c = A.Origin + Vector3.new((i - 2) * A.Spacing, 0, 0)
		local h = A.Size / 2
		local col = ({ P.Cyan, P.Pink, P.Gold })[i]
		part(m, "Floor", Vector3.new(A.Size, 2, A.Size), CFrame.new(c.X, -1, c.Z), Color3.fromRGB(38, 34, 74), Enum.Material.Metal)
		part(m, "FloorGlow", Vector3.new(A.Size - 6, 0.2, A.Size - 6), CFrame.new(c.X, 0.1, c.Z), col, NEON, true).Transparency = 0.75
		for _, w in ipairs({ { 0, h, A.Size, 1 }, { 0, -h, A.Size, 1 }, { h, 0, 1, A.Size }, { -h, 0, 1, A.Size } }) do
			local wall = part(m, "Wall", Vector3.new(w[3], 40, w[4]), CFrame.new(c.X + w[1], 20, c.Z + w[2]), col, Enum.Material.ForceField)
			wall.Transparency = 0.6
			part(m, "WallTrim", Vector3.new(w[3] + 1, 1, w[4] + 1), CFrame.new(c.X + w[1], 0.5, c.Z + w[2]), col, NEON, true)
		end
		for _, b in ipairs(COVER[i]) do
			for sgn = -1, 1, 2 do
				local blk = part(m, "Cover", Vector3.new(b[3], 9, b[4]), CFrame.new(c.X + b[1] * sgn, 4.5, c.Z + b[2] * sgn), Color3.fromRGB(70, 64, 120), Enum.Material.Concrete)
				part(m, "CoverTop", Vector3.new(b[3] + 0.2, 0.6, b[4] + 0.2), blk.CFrame * CFrame.new(0, 4.6, 0), col, NEON, true)
			end
		end
		for n, zz in ipairs({ -h + 12, h - 12 }) do
			local s = part(m, n == 1 and "SpawnA" or "SpawnB", Vector3.new(10, 1, 10), CFrame.new(c.X, 2, c.Z + zz), col, nil)
			invisible(s)
		end
	end
end

function MapService.Init(_services)
	if workspace:FindFirstChild("Map") then
		return
	end
	local base = workspace:FindFirstChild("Baseplate")
	if base then
		base:Destroy()
	end
	local map = Instance.new("Model")
	map.Name = "Map"
	map.ModelStreamingMode = Enum.ModelStreamingMode.Default
	buildHub(map)
	local zf = folder(map, "Zones")
	for _, z in ipairs(Zones) do
		buildZone(zf, z)
	end
	buildArenas(map)
	map.Parent = workspace
end

return MapService
