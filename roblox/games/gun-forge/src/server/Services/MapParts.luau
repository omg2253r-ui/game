-- Part helpers + landmark builders for MapService. Everything Anchored; decor has collision/query/touch off.
local P = {}

P.Cyan = Color3.fromRGB(58, 216, 255)
P.Pink = Color3.fromRGB(255, 79, 216)
P.Gold = Color3.fromRGB(255, 201, 53)
P.Dark = Color3.fromRGB(22, 20, 42)

function P.part(parent: Instance, name: string, size: Vector3, cf: CFrame, color: Color3, mat: Enum.Material?, decor: boolean?)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = mat or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if decor then
		p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = false, false, false, false
	end
	p.Parent = parent
	return p
end

-- Upright cylinder (Roblox cylinders lie along X, so rotate).
function P.cyl(parent: Instance, name: string, diameter: number, height: number, cf: CFrame, color: Color3, mat: Enum.Material?, decor: boolean?)
	local p = P.part(parent, name, Vector3.new(height, diameter, diameter), cf * CFrame.Angles(0, 0, math.pi / 2), color, mat, decor)
	p.Shape = Enum.PartType.Cylinder
	return p
end

function P.label(adornee: BasePart, text: string, color: Color3?, offsetY: number?, maxDist: number?, size: UDim2?)
	local g = Instance.new("BillboardGui")
	g.Name = "NameLabel"
	g.Size = size or UDim2.fromOffset(220, 44)
	g.StudsOffset = Vector3.new(0, offsetY or 8, 0)
	g.MaxDistance = maxDist or 80
	g.AlwaysOnTop = true
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = text
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.TextColor3 = color or Color3.new(1, 1, 1)
	t.TextStrokeTransparency = 0
	t.TextStrokeColor3 = P.Dark
	t.Parent = g
	g.Parent = adornee
end

-- decor ball (diameter d)
function P.ball(parent: Instance, name: string, d: number, cf: CFrame, color: Color3, mat: Enum.Material?)
	local p = P.part(parent, name, Vector3.new(d, d, d), cf, color, mat, true)
	p.Shape = Enum.PartType.Ball
	return p
end

local NEON, ROCK = Enum.Material.Neon, Enum.Material.Slate
local function up(y: number): Vector3
	return Vector3.new(0, y, 0)
end

-- Landmark builders: (parent, pos on ground, cframe facing the hub, color). All decor, <= 60 parts.
local L = {}

function L.meadow(m, pos, base, color)
	for i = 1, 7 do
		local w = 16 - i * 1.8
		P.part(m, "Spire", Vector3.new(w, 14, w), CFrame.new(pos + up(i * 13 - 6)) * CFrame.Angles(0, i * 0.4, 0), i % 2 == 0 and P.Cyan or Color3.fromRGB(140, 235, 255), i % 2 == 0 and NEON or Enum.Material.Glass, true)
	end
	for i = 1, 12 do
		local a = i / 12 * math.pi * 2
		local h = 14 + (i % 4) * 7
		P.part(m, "Shard", Vector3.new(4, h, 4), CFrame.new(pos + Vector3.new(math.cos(a) * 20, h / 2, math.sin(a) * 20)) * CFrame.Angles(math.sin(a) * 0.3, a, math.cos(a) * 0.3), i % 3 == 0 and P.Pink or P.Cyan, NEON, true)
	end
	P.part(m, "Tip", Vector3.new(6, 12, 6), CFrame.new(pos + up(100)) * CFrame.Angles(0.8, 0.8, 0), P.Gold, NEON, true)
end

function L.desert(m, pos, base, color)
	local rng = Random.new(7)
	for i = 1, 10 do
		local s = 22 - i * 1.4
		P.part(m, "Scrap", Vector3.new(s, 9, s * rng:NextNumber(0.7, 1)), CFrame.new(pos + Vector3.new(rng:NextNumber(-2, 2), i * 8.5, rng:NextNumber(-2, 2))) * CFrame.Angles(0, rng:NextNumber(0, 3), 0), i % 2 == 0 and Color3.fromRGB(150, 95, 60) or Color3.fromRGB(110, 110, 120), i % 2 == 0 and Enum.Material.CorrodedMetal or Enum.Material.Metal, true)
	end
	P.part(m, "Antenna", Vector3.new(1.4, 40, 1.4), CFrame.new(pos + up(105)), Color3.fromRGB(90, 90, 100), Enum.Material.Metal, true)
	P.part(m, "Beacon", Vector3.new(6, 6, 6), CFrame.new(pos + up(128)), P.Gold, NEON, true)
	for i = 1, 4 do
		local a = i * math.pi / 2
		P.cyl(m, "Gear", 20, 3, CFrame.new(pos + Vector3.new(math.cos(a) * 20, 14 + i * 6, math.sin(a) * 20)) * CFrame.Angles(a, 0, 0), Color3.fromRGB(170, 130, 80), Enum.Material.Metal, true)
	end
end

function L.frost(m, pos, base, color)
	for i = 1, 12 do
		local a = i / 12 * math.pi * 2
		local r = i % 3 == 0 and 0 or 12 + (i % 4) * 5
		local h = 30 + (i * 13 % 50)
		P.part(m, "Ice", Vector3.new(7, h, 7), CFrame.new(pos + Vector3.new(math.cos(a) * r, h / 2 - 2, math.sin(a) * r)) * CFrame.Angles(math.sin(a) * 0.25, a, math.cos(a) * 0.25), i % 2 == 0 and Color3.fromRGB(170, 230, 255) or Color3.fromRGB(230, 250, 255), Enum.Material.Ice, true)
	end
	P.part(m, "Core", Vector3.new(10, 70, 10), CFrame.new(pos + up(40)) * CFrame.Angles(0, 0.7, 0), P.Cyan, NEON, true).Transparency = 0.35
end

function L.magma(m, pos, base, color)
	for i = 1, 8 do
		local d = 78 - i * 8
		P.cyl(m, "Cone", d, 10, CFrame.new(pos + up(i * 10 - 5)), i % 2 == 0 and Color3.fromRGB(70, 45, 40) or Color3.fromRGB(50, 35, 35), ROCK, true)
	end
	P.cyl(m, "Lava", 18, 4, CFrame.new(pos + up(82)), Color3.fromRGB(255, 120, 30), NEON, true)
	for i = 1, 6 do
		local a = i / 6 * math.pi * 2
		P.part(m, "Stream", Vector3.new(3, 60, 3), CFrame.new(pos + Vector3.new(math.cos(a) * 22, 50, math.sin(a) * 22)) * CFrame.Angles(math.sin(a) * 0.45, 0, -math.cos(a) * 0.45), Color3.fromRGB(255, 90, 20), NEON, true)
		P.part(m, "Ember", Vector3.new(4, 4, 4), CFrame.new(pos + Vector3.new(math.cos(a) * 10, 95 + (i % 3) * 8, math.sin(a) * 10)), P.Gold, NEON, true).Shape = Enum.PartType.Ball
	end
end

function L.void(m, pos, base, color)
	local c = CFrame.new(pos) * (base - base.Position)
	for i = 1, 24 do
		local a = i / 24 * math.pi * 2
		P.part(m, "Ring", Vector3.new(8, 9, 7), c * CFrame.new(math.cos(a) * 40, 62 + math.sin(a) * 40, 0) * CFrame.Angles(0, 0, a), i % 2 == 0 and P.Pink or P.Cyan, NEON, true)
	end
	P.part(m, "Portal", Vector3.new(1, 66, 66), c * CFrame.new(0, 62, 0) * CFrame.Angles(0, math.pi / 2, 0), Color3.fromRGB(90, 40, 160), Enum.Material.ForceField, true).Shape = Enum.PartType.Cylinder
	for s = -1, 1, 2 do
		P.part(m, "Pylon", Vector3.new(8, 24, 8), c * CFrame.new(s * 40, 12, 0), P.Dark, Enum.Material.Metal, true)
	end
end


-- ===== Roadside scenery (OUTSIDE the lane walls). All decor. GY = outland ground height. =====
P.GY = -1
local GY = P.GY
local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local function rgb(r, g, b)
	return Color3.fromRGB(r, g, b)
end
local function tilt(rng: Random, a: number): CFrame
	return ANG(rng:NextNumber(-a, a), rng:NextNumber(0, 6.28), rng:NextNumber(-a, a))
end

-- Slot scenery: (parent, x, z, rng). One cluster per slot (~4-8 parts).
local S = {}
function S.meadow(m, x, z, rng)
	local k = rng:NextInteger(1, 3)
	if k <= 2 then
		local h = rng:NextNumber(7, 11)
		P.cyl(m, "Trunk", 2.2, h, CF(x, GY + h / 2, z), rgb(120, 82, 52), Enum.Material.Wood, true)
		local g1 = rgb(86, 190, 90):Lerp(rgb(150, 225, 100), rng:NextNumber())
		P.ball(m, "Leaf", 10, CF(x, GY + h + 2, z), g1, Enum.Material.Grass)
		P.ball(m, "Leaf", 7.5, CF(x + 1.5, GY + h + 7, z - 1), g1:Lerp(Color3.new(1, 1, 1), 0.12), Enum.Material.Grass)
		P.ball(m, "Leaf", 5.5, CF(x - 2.5, GY + h + 0.5, z + 2.5), g1:Lerp(Color3.new(0, 0, 0), 0.1), Enum.Material.Grass)
	else
		P.part(m, "Rock", V3(6, 4, 5), CF(x, GY + 1.6, z) * tilt(rng, 0.2), rgb(150, 156, 150), ROCK, true)
		P.part(m, "Rock", V3(3.5, 2.5, 3), CF(x + 4, GY + 1, z + 2) * tilt(rng, 0.3), rgb(130, 140, 135), ROCK, true)
		P.ball(m, "Bush", 5, CF(x - 4, GY + 1.6, z - 1), rgb(70, 170, 80), Enum.Material.Grass)
	end
	local cols = { rgb(255, 120, 190), rgb(255, 220, 90), rgb(255, 255, 255), rgb(130, 220, 255) }
	for i = 1, 3 do
		P.ball(m, "Flower", 1.2, CF(x + rng:NextNumber(-7, 7), GY + 0.7, z + rng:NextNumber(-7, 7)), cols[(i + rng:NextInteger(0, 3)) % 4 + 1], NEON)
	end
end

function S.desert(m, x, z, rng)
	local k = rng:NextInteger(1, 3)
	if k == 1 then
		P.cyl(m, "Cactus", 2.4, 9, CF(x, GY + 4.5, z), rgb(80, 140, 80), Enum.Material.Grass, true)
		P.part(m, "Arm", V3(3, 1.4, 1.4), CF(x + 2, GY + 4.5, z), rgb(80, 140, 80), Enum.Material.Grass, true)
		P.part(m, "Arm", V3(1.4, 4, 1.4), CF(x + 3.3, GY + 6.3, z), rgb(80, 140, 80), Enum.Material.Grass, true)
	elseif k == 2 then
		local yaw = ANG(0, rng:NextNumber(0, 3), 0)
		P.part(m, "Mesa", V3(14, 16, 12), CF(x, GY + 8, z) * yaw, rgb(196, 112, 72), Enum.Material.Sandstone, true)
		P.part(m, "MesaBand", V3(14.3, 3, 12.3), CF(x, GY + 11, z) * yaw, rgb(235, 175, 110), Enum.Material.Sandstone, true)
		P.part(m, "MesaCap", V3(15, 1.2, 13), CF(x, GY + 16.4, z) * yaw, rgb(150, 85, 60), Enum.Material.Rock, true)
	else
		P.part(m, "Rock", V3(6, 4, 5), CF(x, GY + 1.6, z) * tilt(rng, 0.2), rgb(214, 170, 112), Enum.Material.Sandstone, true)
		P.part(m, "Rock", V3(3.5, 2.5, 3), CF(x + 4, GY + 1, z + 2) * tilt(rng, 0.3), rgb(190, 140, 95), Enum.Material.Sandstone, true)
		P.part(m, "Bone", V3(0.8, 0.8, 7), CF(x - 3, GY + 0.5, z - 3) * ANG(0, rng:NextNumber(0, 3), 0), rgb(235, 230, 215), Enum.Material.SmoothPlastic, true)
	end
end

function S.frost(m, x, z, rng)
	local k = rng:NextInteger(1, 3)
	if k == 1 then
		local pine, snow = rgb(52, 105, 110), rgb(240, 250, 255)
		P.part(m, "Trunk", V3(1.6, 3, 1.6), CF(x, GY + 1.5, z), rgb(90, 70, 60), Enum.Material.Wood, true)
		P.part(m, "Tier", V3(10, 3, 10), CF(x, GY + 4, z) * ANG(0, 0.78, 0), pine, Enum.Material.Slate, true)
		P.part(m, "Tier", V3(7.5, 3, 7.5), CF(x, GY + 7, z) * ANG(0, 0.78, 0), pine, Enum.Material.Slate, true)
		P.part(m, "Tier", V3(5, 3, 5), CF(x, GY + 10, z) * ANG(0, 0.78, 0), snow, Enum.Material.Snow, true)
	elseif k == 2 then
		for i = 1, 3 do
			local h = rng:NextNumber(9, 17)
			P.part(m, "Crystal", V3(2.6, h, 2.6), CF(x + (i - 2) * 3.4, GY + h / 2 - 0.5, z + rng:NextNumber(-2, 2)) * ANG(rng:NextNumber(-0.3, 0.3), rng:NextNumber(0, 3), rng:NextNumber(-0.3, 0.3)), rgb(150, 220, 255), Enum.Material.Glass, true)
		end
		P.ball(m, "Glow", 2, CF(x, GY + 2, z), rgb(140, 230, 255), NEON)
	else
		P.cyl(m, "Drift", 10, 3, CF(x, GY + 1, z), rgb(245, 250, 255), Enum.Material.Snow, true)
		P.part(m, "Rock", V3(4, 3, 4), CF(x + 3, GY + 1.5, z + 1) * tilt(rng, 0.3), rgb(120, 135, 160), ROCK, true)
		P.ball(m, "Drift", 5, CF(x - 3, GY + 0.5, z - 2), rgb(235, 245, 255), Enum.Material.Snow)
	end
end

function S.magma(m, x, z, rng)
	local k = rng:NextInteger(1, 3)
	if k == 1 then
		local cf = CF(x, GY + 8, z) * tilt(rng, 0.15)
		P.part(m, "Spire", V3(6, 18, 6), cf, rgb(48, 36, 36), Enum.Material.Basalt, true)
		P.part(m, "Vein", V3(0.8, 14, 0.8), cf * CF(2.9, 0, 0), rgb(255, 110, 30), NEON, true)
		P.part(m, "Rock", V3(5, 3, 5), CF(x + 5, GY + 1.2, z + 1) * tilt(rng, 0.3), rgb(60, 44, 42), Enum.Material.Basalt, true)
	elseif k == 2 then
		P.cyl(m, "PoolRim", 14, 0.5, CF(x, GY + 0.1, z), rgb(40, 30, 30), Enum.Material.Basalt, true)
		P.cyl(m, "Lava", 11, 0.5, CF(x, GY + 0.2, z), rgb(255, 110, 30), NEON, true)
		P.ball(m, "Ember", 1.1, CF(x + 1, GY + rng:NextNumber(5, 12), z), rgb(255, 190, 70), NEON)
		P.ball(m, "Ember", 0.8, CF(x - 2, GY + rng:NextNumber(3, 9), z + 2), rgb(255, 140, 40), NEON)
	else
		P.part(m, "Rock", V3(7, 5, 6), CF(x, GY + 2, z) * tilt(rng, 0.25), rgb(55, 42, 40), Enum.Material.Basalt, true)
		P.part(m, "Rock", V3(4, 3, 4), CF(x + 4, GY + 1, z - 2) * tilt(rng, 0.3), rgb(70, 50, 44), Enum.Material.Basalt, true)
		P.part(m, "Crack", V3(0.6, 0.2, 9), CF(x - 3, GY + 0.15, z) * ANG(0, rng:NextNumber(0, 3), 0), rgb(255, 100, 30), NEON, true)
	end
end

function S.void(m, x, z, rng)
	local k = rng:NextInteger(1, 3)
	local c = (z // 24) % 2 == 0 and P.Pink or P.Cyan
	if k == 1 then
		local h = rng:NextNumber(18, 34)
		P.part(m, "Base", V3(4.5, 1, 4.5), CF(x, GY + 0.5, z), P.Dark, Enum.Material.Metal, true)
		P.part(m, "Pillar", V3(2, h, 2), CF(x, GY + h / 2, z), c, NEON, true)
		P.ball(m, "Orb", 3, CF(x, GY + h + 2, z), c:Lerp(Color3.new(1, 1, 1), 0.4), NEON)
	elseif k == 2 then
		for i = 1, 2 do
			local s = rng:NextNumber(3, 5)
			local cf = CF(x + (i - 1.5) * 5, GY + rng:NextNumber(9, 18), z) * tilt(rng, 0.8)
			P.part(m, "Cube", V3(s, s, s), cf, rgb(90, 50, 170), Enum.Material.Glass, true)
			P.part(m, "Core", V3(s * 0.4, s * 0.4, s * 0.4), cf, c, NEON, true)
		end
	else
		P.part(m, "Base", V3(5, 1, 5), CF(x, GY + 0.5, z), P.Dark, Enum.Material.Metal, true)
		P.part(m, "Crystal", V3(3, 11, 3), CF(x, GY + 6, z) * tilt(rng, 0.25), c, NEON, true)
		P.part(m, "Crystal", V3(2, 7, 2), CF(x + 3, GY + 4, z + 1) * tilt(rng, 0.4), c:Lerp(Color3.new(1, 1, 1), 0.3), NEON, true)
	end
end
P.Scenery = S

-- Background silhouettes far outside the walls (hills / mesas / ice / basalt / monoliths).
local B = {}
function B.meadow(m, x, z, rng)
	local d = rng:NextNumber(40, 64)
	P.ball(m, "Hill", d, CF(x, GY - d * 0.28, z), rgb(96, 176, 84):Lerp(rgb(140, 210, 100), rng:NextNumber()), Enum.Material.Grass)
end
function B.desert(m, x, z, rng)
	local h = rng:NextNumber(30, 52)
	local yaw = ANG(0, rng:NextNumber(0, 3), 0)
	P.part(m, "Butte", V3(rng:NextNumber(22, 32), h, rng:NextNumber(20, 28)), CF(x, GY + h / 2, z) * yaw, rgb(190, 108, 70), Enum.Material.Sandstone, true)
	P.part(m, "ButteCap", V3(34, 2, 30), CF(x, GY + h, z) * yaw, rgb(240, 190, 120), Enum.Material.Sandstone, true)
end
function B.frost(m, x, z, rng)
	local h = rng:NextNumber(36, 64)
	P.part(m, "Berg", V3(rng:NextNumber(18, 26), h, rng:NextNumber(18, 26)), CF(x, GY + h / 2 - 2, z) * tilt(rng, 0.12), rgb(190, 225, 245), Enum.Material.Ice, true)
	P.part(m, "BergCap", V3(10, 6, 10), CF(x, GY + h - 1, z) * ANG(0, rng:NextNumber(0, 3), 0.2), rgb(250, 253, 255), Enum.Material.Snow, true)
end
function B.magma(m, x, z, rng)
	local h = rng:NextNumber(38, 70)
	local cf = CF(x, GY + h / 2, z) * tilt(rng, 0.1)
	P.part(m, "Crag", V3(rng:NextNumber(20, 30), h, rng:NextNumber(18, 26)), cf, rgb(44, 32, 32), Enum.Material.Basalt, true)
	P.part(m, "CragGlow", V3(1.6, h * 0.8, 1.6), cf * CF(10, -h * 0.05, 0), rgb(255, 100, 30), NEON, true)
end
function B.void(m, x, z, rng)
	local h = rng:NextNumber(50, 100)
	P.part(m, "Monolith", V3(12, h, 12), CF(x, GY + h / 2, z) * ANG(0, rng:NextNumber(0, 1.5), 0), rgb(26, 18, 52), Enum.Material.Slate, true)
	P.part(m, "MonolithEdge", V3(0.8, h, 0.8), CF(x + 6, GY + h / 2, z + 6), (z // 30) % 2 == 0 and P.Pink or P.Cyan, NEON, true)
end
P.Backdrop = B

P.Landmarks = L
return P
