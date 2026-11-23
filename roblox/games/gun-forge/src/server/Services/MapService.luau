-- Builds workspace.Map in code (Hub, linear Lane of 5 Zones, Arena). Names are contracts for other services:
--   Map.Hub{TrainingPads/Pad1..6, TrainingDummies/Dummy1..6, Booth_*, Forge, FusionAltar, RebirthStatue, ArenaPortal,
--           ClanBoard, CodesBoard, SpawnLocation, BossPit, Portal_<zoneId>}
--   Map.Zones.<id>{Ground, SpawnArea, Gate(PowerReq, ZoneId), ReturnPortal_<id>, Landmark, Scenery}   Map.Arena.Arena1..3{SpawnA, SpawnB}
-- Layout: hub at origin, ONE straight road towards -Z (48 wide), stage i = Zones[i].center/size, 30-stud bridges between stages.
-- Perf: all Anchored; decor has CanCollide/CanQuery/CanTouch/CastShadow off. ~2500 parts total (budget 3000).
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Zones = require(ReplicatedStorage.Shared.Config.Zones)
local World = require(ReplicatedStorage.Shared.Config.World)
local Combat = require(ReplicatedStorage.Shared.Config.Combat)
local P = require(script.Parent.MapParts)
local MapZones = require(script.Parent.MapZones)
local MapHub = require(script.Parent.MapHub)

local part, cyl = P.part, P.cyl
local GY = P.GY
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
local function fmtPower(n: number): string
	if n >= 1e6 then
		return string.format("%gM", n / 1e6)
	elseif n >= 1e3 then
		return string.format("%gK", n / 1e3)
	end
	return tostring(n)
end

local STATIONS = { -- name, label, x, z, color  (all on the +Z side / flanks; the -Z side is the lane mouth)
	{ "Booth_TargetRush", "TARGET RUSH", -54, 40, P.Cyan },
	{ "Booth_ReloadRhythm", "RELOAD RHYTHM", -27, 40, P.Pink },
	{ "Booth_LuckyCrate", "LUCKY CRATE", 0, 40, P.Gold },
	{ "Forge", "THE FORGE", 27, 40, Color3.fromRGB(255, 120, 40) },
	{ "FusionAltar", "FUSION ALTAR", 54, 40, P.Pink },
	{ "RebirthStatue", "REBIRTH", -66, 16, P.Gold },
	{ "ArenaPortal", "PVP ARENA", 66, 16, Color3.fromRGB(255, 80, 80) },
	{ "ClanBoard", "CLAN HALL", -66, -14, P.Cyan },
	{ "CodesBoard", "CODES", 66, -14, Color3.fromRGB(120, 255, 150) },
}
local MOUTH_Z = -68 -- where the lane walls / arch start (inside the hub rim)

local function buildHub(map: Model)
	local hub = model(map, "Hub")
	local R = World.HubRadius
	local halfLane = Zones.LaneWidth / 2
	cyl(hub, "Floor", R * 2, 2, CFrame.new(0, -1, 0), P.Dark, Enum.Material.Metal)
	cyl(hub, "FloorInlay", R * 2 - 16, 0.2, CFrame.new(0, 0.05, 0), Color3.fromRGB(40, 36, 80), Enum.Material.SmoothPlastic, true)
	cyl(hub, "NeonRing", R * 2 - 4, 0.3, CFrame.new(0, 0.1, 0), P.Cyan, NEON, true)
	cyl(hub, "NeonRingInner", R * 2 - 8, 0.4, CFrame.new(0, 0.12, 0), P.Dark, Enum.Material.SmoothPlastic, true)
	cyl(hub, "SpawnRing", 24, 0.3, CFrame.new(0, 0.55, 0), P.Pink, NEON, true)
	cyl(hub, "SpawnRingInner", 21, 0.35, CFrame.new(0, 0.57, 0), Color3.fromRGB(40, 36, 80), Enum.Material.SmoothPlastic, true)
	for i = 1, 28 do -- edge pylons (skip the lane mouth)
		local a = i / 28 * math.pi * 2
		local px, pz = math.cos(a) * (R - 1), math.sin(a) * (R - 1)
		if not (pz < 0 and math.abs(px) < 34) then
			local c = CFrame.new(px, 0, pz)
			part(hub, "Pylon", Vector3.new(2, 7, 2), c * CFrame.new(0, 3.5, 0), P.Dark, Enum.Material.Metal, true)
			part(hub, "PylonLight", Vector3.new(2.4, 1.2, 2.4), c * CFrame.new(0, 7.4, 0), i % 2 == 0 and P.Cyan or P.Pink, NEON, true)
		end
	end

	-- lane mouth: apron (hub edge -> stage 1 gate), clear and wide
	local apronLen = math.abs(Zones[1].gatePos.Z - MOUTH_Z)
	part(hub, "LaneApron", Vector3.new(Zones.LaneWidth, 2, apronLen), CFrame.new(0, -1.05, (MOUTH_Z + Zones[1].gatePos.Z) / 2), P.Dark, Enum.Material.Metal)
	for side = -1, 1, 2 do
		part(hub, "ApronEdge", Vector3.new(0.8, 0.2, apronLen), CFrame.new(side * (halfLane - 0.6), 0.12, (MOUTH_Z + Zones[1].gatePos.Z) / 2), P.Cyan, NEON, true)
	end
	for n = 0, 5 do -- chevrons leading the eye down the lane
		part(hub, "Chevron", Vector3.new(14, 0.1, 1.2), CFrame.new(0, 0.56, -12 - n * 11), P.Gold, NEON, true).Transparency = 0.2 + n * 0.1
	end
	-- big arch "ADVENTURE ->"
	for side = -1, 1, 2 do
		part(hub, "ArchPillar", Vector3.new(4, 30, 4), CFrame.new(side * 28, 15, MOUTH_Z), P.Dark, Enum.Material.Metal, true)
		part(hub, "ArchGlow", Vector3.new(1, 28, 4.4), CFrame.new(side * 28 - side * 2.1, 15, MOUTH_Z), P.Gold, NEON, true)
	end
	local beam = part(hub, "ArchBeam", Vector3.new(64, 7, 5), CFrame.new(0, 31, MOUTH_Z), P.Dark, Enum.Material.Metal, true)
	part(hub, "ArchTrim", Vector3.new(64.4, 1, 5.4), CFrame.new(0, 27.4, MOUTH_Z), P.Gold, NEON, true)
	part(hub, "ArchTrim", Vector3.new(64.4, 1, 5.4), CFrame.new(0, 34.6, MOUTH_Z), P.Cyan, NEON, true)
	P.label(beam, "ADVENTURE  →", P.Gold, 0, 600, UDim2.fromOffset(520, 100))

	local sp = Instance.new("SpawnLocation")
	sp.Anchored, sp.Size, sp.Position = true, Vector3.new(14, 1, 14), Vector3.new(0, 0.5, 0)
	sp.Material, sp.Neutral, sp.Duration, sp.TopSurface = NEON, true, 0, Enum.SurfaceType.Smooth
	sp.Color = Color3.fromRGB(58, 120, 200)
	sp.Parent = hub

	-- training range: Pad1..3 left column, Pad4..6 right column; dummy 14 studs in front (outwards)
	local pads = folder(hub, "TrainingPads")
	local dummies = folder(hub, "TrainingDummies")
	local dDecor = folder(hub, "TrainingDummyDecor")
	for i = 1, 6 do
		local side = i <= 3 and -1 or 1
		local z = ({ -25, -5, 15 })[(i - 1) % 3 + 1]
		local pos = Vector3.new(side * 30, 0.5, z)
		local face = CFrame.lookAt(pos, pos + Vector3.new(side, 0, 0))
		part(pads, "Pad" .. i, Vector3.new(10, 1, 10), face, P.Dark, Enum.Material.Metal)
		part(pads, "PadGlow", Vector3.new(8, 0.3, 8), face + Vector3.new(0, 0.55, 0), P.Cyan, NEON, true)
		part(pads, "PadArrow", Vector3.new(2, 0.2, 4), face * CFrame.new(0, 0.7, -2), P.Gold, NEON, true)
		local dx = side * (30 + 14)
		local board = cyl(dummies, "Dummy" .. i, 8, 1, CFrame.new(dx, 7, z) * CFrame.Angles(0, 0, math.pi / 2) * CFrame.Angles(0, 0, 0), Color3.fromRGB(240, 240, 240), Enum.Material.SmoothPlastic)
		board.CFrame = CFrame.new(dx, 7, z) -- cylinder axis = X, i.e. the face points at the pad
		board.CanCollide = false
		part(dDecor, "DummyRing", Vector3.new(0.3, 5.6, 5.6), CFrame.new(dx - side * 0.6, 7, z), Color3.fromRGB(255, 70, 70), Enum.Material.SmoothPlastic, true).Shape = Enum.PartType.Cylinder
		part(dDecor, "DummyRing", Vector3.new(0.3, 3.2, 3.2), CFrame.new(dx - side * 0.7, 7, z), Color3.fromRGB(245, 245, 245), Enum.Material.SmoothPlastic, true).Shape = Enum.PartType.Cylinder
		part(dDecor, "DummyBull", Vector3.new(0.3, 1.2, 1.2), CFrame.new(dx - side * 0.8, 7, z), Color3.fromRGB(255, 70, 70), NEON, true).Shape = Enum.PartType.Cylinder
		part(dDecor, "DummyPost", Vector3.new(1, 4, 1), CFrame.new(dx + side * 0.2, 2, z), P.Dark, Enum.Material.Metal, true)
		part(dDecor, "DummyBase", Vector3.new(4, 0.6, 4), CFrame.new(dx + side * 0.2, 0.3, z), P.Cyan, NEON, true)
	end

	for _, s in ipairs(STATIONS) do
		local pos = Vector3.new(s[3], 0, s[4])
		local face = CFrame.lookAt(pos, Vector3.new(0, 0, 0))
		cyl(hub, s[1] .. "_Base", 14, 0.6, CFrame.new(pos + Vector3.new(0, 0.3, 0)), P.Dark, Enum.Material.Metal, true)
		cyl(hub, s[1] .. "_Glow", 12.5, 0.7, CFrame.new(pos + Vector3.new(0, 0.32, 0)), s[5], NEON, true)
		local blk = part(hub, s[1], Vector3.new(8, 8, 8), face + Vector3.new(0, 4.6, 0), Color3.fromRGB(46, 42, 88), Enum.Material.Metal)
		part(hub, s[1] .. "_Trim", Vector3.new(8.4, 1, 8.4), face + Vector3.new(0, 9, 0), s[5], NEON, true)
		part(hub, s[1] .. "_Face", Vector3.new(5, 4, 0.4), face * CFrame.new(0, 5.6, -4.1), s[5], NEON, true)
		P.label(blk, s[2], s[5], 8)
	end

	-- teleport portals (StationService adds the prompts): glowing pad + small arch, in a row near the lane mouth
	for n, z in ipairs(Zones) do
		local acc = ZONE_ACCENT[z.id] or P.Cyan
		local px, pz = (n - 3) * 20, -50
		part(hub, "PortalRim_" .. z.id, Vector3.new(0.5, 12.6, 12.6), CFrame.new(px, 0.25, pz) * CFrame.Angles(0, 0, math.pi / 2), P.Dark, Enum.Material.Metal, true).Shape = Enum.PartType.Cylinder
		local pad = cyl(hub, "Portal_" .. z.id, 11, 0.5, CFrame.new(px, 0.35, pz), acc, NEON)
		pad.CanCollide = false
		pad:SetAttribute("ZoneId", z.id)
		pad:SetAttribute("PowerReq", z.powerReq)
		pad.CastShadow = false
		for side = -1, 1, 2 do
			part(hub, "PortalPost", Vector3.new(1, 13, 1), CFrame.new(px + side * 5.5, 6.5, pz), P.Dark, Enum.Material.Metal, true)
			part(hub, "PortalGlow", Vector3.new(0.6, 12, 1.2), CFrame.new(px + side * 5.5, 6.5, pz), acc, NEON, true)
		end
		part(hub, "PortalTop", Vector3.new(12, 1, 1.4), CFrame.new(px, 13.2, pz), acc, NEON, true)
		part(hub, "PortalVeil", Vector3.new(10, 12, 0.2), CFrame.new(px, 6.6, pz), acc, Enum.Material.ForceField, true)
		P.label(pad, z.name .. "\nPower " .. fmtPower(z.powerReq), acc, 11, 120, UDim2.fromOffset(240, 64))
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
	MapHub.decorate(hub, R, STATIONS)
end

-- ===== Zones (one straight lane) =====
local THEME = { -- outland ground + bridge look + road patch style
	meadow = { out = Color3.fromRGB(92, 168, 80), outMat = Enum.Material.Grass, bridge = Color3.fromRGB(150, 110, 70), bridgeMat = Enum.Material.WoodPlanks, patch = Color3.fromRGB(135, 215, 110), patchMat = Enum.Material.Grass },
	desert = { out = Color3.fromRGB(205, 160, 105), outMat = Enum.Material.Sand, bridge = Color3.fromRGB(120, 95, 75), bridgeMat = Enum.Material.CorrodedMetal, patch = Color3.fromRGB(200, 160, 100), patchMat = Enum.Material.Sand },
	frost = { out = Color3.fromRGB(215, 235, 250), outMat = Enum.Material.Snow, bridge = Color3.fromRGB(150, 200, 235), bridgeMat = Enum.Material.Ice, patch = Color3.fromRGB(170, 215, 245), patchMat = Enum.Material.Ice },
	magma = { out = Color3.fromRGB(38, 28, 28), outMat = Enum.Material.Basalt, bridge = Color3.fromRGB(30, 26, 28), bridgeMat = Enum.Material.Metal, patch = Color3.fromRGB(255, 100, 30), patchMat = NEON },
	void = { out = Color3.fromRGB(20, 12, 40), outMat = Enum.Material.Slate, bridge = Color3.fromRGB(26, 18, 50), bridgeMat = Enum.Material.Metal, patch = Color3.fromRGB(150, 70, 255), patchMat = NEON },
}

local function buildZone(parent: Folder, z, index: number)
	local m = model(parent, z.id)
	local accent = ZONE_ACCENT[z.id] or P.Cyan
	local th = THEME[z.id]
	local W, L, G = Zones.LaneWidth, Zones.StageLength, Zones.Gap
	local half = W / 2
	local cx = z.center.X
	local startZ, endZ = z.gatePos.Z, z.center.Z - L / 2
	local wallStart = index == 1 and MOUTH_Z or startZ + G -- hub-side end of this stage's walls (incl. bridge)
	local wallLen = wallStart - endZ
	local wallMid = (wallStart + endZ) / 2
	local rng = Random.new(index * 7919)

	part(m, "Ground", Vector3.new(W, 2, L), CFrame.new(cx, -1, z.center.Z), z.color, ZONE_MAT[z.id] or Enum.Material.Slate)
	local sa = part(m, "SpawnArea", Vector3.new(W, 1, L), CFrame.new(cx, 0, z.center.Z), accent, nil)
	invisible(sa)

	-- bridge over the 30-stud gap (hub side of the gate), same straight road
	if index > 1 then
		part(m, "Bridge", Vector3.new(W, 2, G), CFrame.new(cx, -1, startZ + G / 2), th.bridge, th.bridgeMat)
		for side = -1, 1, 2 do
			part(m, "BridgeRail", Vector3.new(0.8, 0.2, G), CFrame.new(cx + side * (half - 0.6), 0.12, startZ + G / 2), accent, NEON, true)
		end
		for n = 1, 4 do
			part(m, "BridgePlank", Vector3.new(W - 2, 0.1, 0.5), CFrame.new(cx, 0.06, startZ + n * G / 5), th.bridge:Lerp(Color3.new(1, 1, 1), 0.15), th.bridgeMat, true)
		end
	end

	-- invisible side walls (+ end wall on the last stage)
	for side = -1, 1, 2 do
		local w = part(m, "SideWall", Vector3.new(2, 60, wallLen), CFrame.new(cx + side * (half + 1), 30, wallMid), accent, nil)
		w.Transparency = 1
		w.CanQuery, w.CanTouch, w.CastShadow = false, false, false
	end
	if index == #Zones then
		local ew = part(m, "EndWall", Vector3.new(W + 4, 60, 2), CFrame.new(cx, 30, endZ - 1), accent, nil)
		ew.Transparency = 1
		ew.CanQuery, ew.CanTouch, ew.CastShadow = false, false, false
	end

	-- lane dressing: curbs, edge lines, dashed centre line, themed path patches
	local decor = folder(m, "Dressing")
	for side = -1, 1, 2 do
		part(decor, "Curb", Vector3.new(1.6, 1.2, wallLen), CFrame.new(cx + side * (half - 0.2), 0.4, wallMid), P.Dark:Lerp(z.color, 0.25), Enum.Material.Concrete, true)
		part(decor, "EdgeLine", Vector3.new(0.5, 0.15, L), CFrame.new(cx + side * (half - 1.4), 0.08, z.center.Z), accent, NEON, true)
	end
	for zz = startZ - 12, endZ + 8, -24 do
		part(decor, "Dash", Vector3.new(1.2, 0.1, 9), CFrame.new(cx, 0.06, zz), accent, NEON, true).Transparency = 0.45
	end
	for _ = 1, 14 do
		local s = rng:NextNumber(6, 12)
		local c = th.patch:Lerp(z.color, rng:NextNumber(0.2, 0.6))
		local p = part(decor, "Patch", Vector3.new(s, 0.06, s * rng:NextNumber(0.6, 1.2)), CFrame.new(cx + rng:NextNumber(-half + 7, half - 7), 0.03, rng:NextNumber(endZ + 15, startZ - 15)) * CFrame.Angles(0, rng:NextNumber(0, 3), 0), c, th.patchMat, true)
		if th.patchMat == NEON then
			p.Size = Vector3.new(rng:NextNumber(0.4, 0.9), 0.06, rng:NextNumber(8, 18))
			p.Transparency = 0.25
		end
	end
	for zz = startZ - 40, endZ + 40, -60 do -- lamps on the wall line
		for side = -1, 1, 2 do
			part(decor, "LampPost", Vector3.new(0.8, 9, 0.8), CFrame.new(cx + side * (half + 2.2), 4.5, zz), P.Dark, Enum.Material.Metal, true)
			P.ball(decor, "LampBulb", 2, CFrame.new(cx + side * (half + 2.2), 9.4, zz), accent, NEON)
		end
	end

	-- gate (force field) at the stage start + frame + label
	local gate = part(m, "Gate", Vector3.new(W, 30, 2), CFrame.new(cx, 15, startZ), accent, Enum.Material.ForceField)
	gate:SetAttribute("PowerReq", z.powerReq)
	gate:SetAttribute("ZoneId", z.id)
	gate.CastShadow = false
	for side = -1, 1, 2 do
		part(decor, "GatePost", Vector3.new(4, 34, 4), CFrame.new(cx + side * (half + 3), 17, startZ), P.Dark, Enum.Material.Metal, true)
		part(decor, "GateLight", Vector3.new(4.6, 2, 4.6), CFrame.new(cx + side * (half + 3), 35, startZ), accent, NEON, true)
	end
	part(decor, "GateBeam", Vector3.new(W + 10, 3, 4), CFrame.new(cx, 32, startZ), P.Dark, Enum.Material.Metal, true)
	part(decor, "GateBeamGlow", Vector3.new(W + 10.4, 0.8, 4.4), CFrame.new(cx, 30.2, startZ), accent, NEON, true)
	P.label(gate, z.name .. "  |  Power " .. fmtPower(z.powerReq), accent, 21, 400, UDim2.fromOffset(420, 60))

	-- return portal just inside the gate
	local rp = cyl(m, "ReturnPortal_" .. z.id, 10, 0.5, CFrame.new(cx, 0.35, startZ - 12), accent, NEON)
	rp.CanCollide, rp.CastShadow = false, false
	rp:SetAttribute("ZoneId", z.id)
	cyl(decor, "ReturnRim", 11.6, 0.4, CFrame.new(cx, 0.25, startZ - 12), P.Dark, Enum.Material.Metal, true)
	P.label(rp, "Back to Hub", Color3.new(1, 1, 1), 4, 70, UDim2.fromOffset(180, 36))

	-- boss arena decoration (inside the road: flat, walkable)
	local bp = z.bossPos
	cyl(decor, "BossRing", 42, 0.3, CFrame.new(bp.X, 0.15, bp.Z), accent, NEON)
	cyl(decor, "BossDisc", 39, 0.4, CFrame.new(bp.X, 0.18, bp.Z), P.Dark:Lerp(z.color, 0.3), Enum.Material.Slate)
	cyl(decor, "BossCore", 12, 0.5, CFrame.new(bp.X, 0.22, bp.Z), accent, NEON)
	for n = 1, 8 do
		local a = n / 8 * math.pi * 2
		part(decor, "BossRune", Vector3.new(1, 0.2, 5), CFrame.new(bp.X + math.cos(a) * 15, 0.3, bp.Z + math.sin(a) * 15) * CFrame.Angles(0, -a, 0), accent, NEON, true)
	end
	for side = -1, 1, 2 do -- tall banner towers outside the walls + arch at the far end
		part(decor, "BossTower", Vector3.new(7, 40, 7), CFrame.new(cx + side * (half + 8), 20, bp.Z), P.Dark:Lerp(z.color, 0.2), Enum.Material.Slate, true)
		part(decor, "BossTowerGlow", Vector3.new(7.4, 3, 7.4), CFrame.new(cx + side * (half + 8), 41, bp.Z), accent, NEON, true)
		part(decor, "EndPillar", Vector3.new(4, 36, 4), CFrame.new(cx + side * (half + 3), 18, endZ + 2), P.Dark, Enum.Material.Metal, true)
	end
	part(decor, "EndBeam", Vector3.new(W + 10, 4, 4), CFrame.new(cx, 34, endZ + 2), P.Dark, Enum.Material.Metal, true)
	part(decor, "EndGlow", Vector3.new(W + 10.4, 1, 4.4), CFrame.new(cx, 31.6, endZ + 2), accent, NEON, true)

	-- stage identity: terrain, set-pieces, arches, road detail, particles, landmark (MapZones)
	local lside = index % 2 == 1 and 1 or -1
	MapZones.build({ m = m, z = z, cx = cx, half = half, startZ = startZ, endZ = endZ, accent = accent, rng = Random.new(index * 104729), lside = lside })

	-- outland ground + roadside scenery + background silhouettes (decor only)
	local sc = folder(m, "Scenery")
	local outLen = wallStart - endZ + 20
	for side = -1, 1, 2 do
		part(sc, "Outland", Vector3.new(130, 4, outLen), CFrame.new(cx + side * (half + 65), -3, wallStart - outLen / 2 + 10), th.out, th.outMat, true)
	end
	local slotTop = index == 1 and wallStart - 10 or startZ + G - 6
	for zz = slotTop, endZ + 10, -30 do
		for side = -1, 1, 2 do
			do
				P.Scenery[z.id](sc, cx + side * (half + 8 + rng:NextNumber(0, 12)), zz + rng:NextNumber(-5, 5), rng)
			end
		end
	end
	if z.id == "void" then -- other stages use Terrain hills/cliffs instead of part silhouettes
		for zz = slotTop, endZ + 10, -56 do
			for side = -1, 1, 2 do
				P.Backdrop[z.id](sc, cx + side * (half + 62 + rng:NextNumber(0, 40)), zz + rng:NextNumber(-8, 8), rng)
			end
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
	pcall(MapZones.setup)
	local map = Instance.new("Model")
	map.Name = "Map"
	map.ModelStreamingMode = Enum.ModelStreamingMode.Default
	buildHub(map)
	local zf = folder(map, "Zones")
	for i, z in ipairs(Zones) do
		buildZone(zf, z, i)
	end
	buildArenas(map)
	map.Parent = workspace
	local n = 0
	for _, d in ipairs(map:GetDescendants()) do
		if d:IsA("BasePart") then
			n += 1
		end
	end
	print(string.format("[MapService] built Map: %d parts (budget 4000)", n))
end

return MapService
