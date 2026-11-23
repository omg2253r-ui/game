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

-- ===== Shared helpers for MapZones / MapHub =====
local CollectionService = game:GetService("CollectionService")

-- beam-shaped part between two points
function P.beam(parent: Instance, name: string, a: Vector3, b: Vector3, th: number, color: Color3, mat: Enum.Material?, decor: boolean?)
	local len = math.max((b - a).Magnitude, 0.05)
	return P.part(parent, name, Vector3.new(th, th, len), CFrame.lookAt((a + b) / 2, b), color, mat, decor)
end

-- client-animated decor (ZoneLightingController reads the tag + attributes)
function P.anim(inst: Instance, kind: string, attrs: { [string]: any }?)
	inst:SetAttribute("AnimKind", kind)
	for k, v in pairs(attrs or {}) do
		inst:SetAttribute(k, v)
	end
	CollectionService:AddTag(inst, "MapAnim")
end
function P.spin(part: BasePart, pivot: Vector3, axis: Vector3, speed: number)
	P.anim(part, "Spin", { AnimPivot = pivot, AnimAxis = axis, AnimSpeed = speed })
end
function P.pulse(part: BasePart, lo: number, hi: number, speed: number, ph: number?)
	P.anim(part, "Pulse", { AnimLo = lo, AnimHi = hi, AnimSpeed = speed, AnimPh = ph or 0 })
end

function P.light(parent: Instance, color: Color3, range: number, brightness: number)
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness, l.Shadows = color, range, brightness, false
	l.Parent = parent
	return l
end

-- ambient particle volume: invisible anchored box with a ParticleEmitter (Decor=true -> Low Graphics disables it)
function P.emitter(parent: Instance, name: string, cf: CFrame, size: Vector3, cfg: { [string]: any })
	local box = P.part(parent, name, size, cf, Color3.new(1, 1, 1), nil, true)
	box.Transparency = 1
	local e = Instance.new("ParticleEmitter")
	e.Shape = Enum.ParticleEmitterShape.Box
	e.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	e.Texture = cfg.texture or "rbxasset://textures/particles/sparkles_main.dds"
	e.Rate = math.min(cfg.rate or 10, 15)
	e.Lifetime = cfg.life or NumberRange.new(4, 6)
	e.Speed = cfg.speed or NumberRange.new(1, 3)
	e.Size = cfg.size or NumberSequence.new(1)
	e.Transparency = cfg.transp or NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.2, 0.2), NumberSequenceKeypoint.new(0.8, 0.2), NumberSequenceKeypoint.new(1, 1) })
	e.Color = cfg.color or ColorSequence.new(Color3.new(1, 1, 1))
	e.LightEmission = cfg.glow or 0
	e.LightInfluence = cfg.influence or 0
	e.Acceleration = cfg.accel or Vector3.zero
	e.EmissionDirection = cfg.dir or Enum.NormalId.Top
	e.SpreadAngle = cfg.spread or Vector2.new(30, 30)
	e.Rotation = NumberRange.new(0, 360)
	e.RotSpeed = cfg.rot or NumberRange.new(-20, 20)
	e.Drag = cfg.drag or 0
	e.LockedToPart = false
	e:SetAttribute("Decor", true)
	e.Parent = box
	return box, e
end

-- vertical-ish ring of beam segments in a plane. normal = "Z" (XY plane), "X" (YZ plane) or "Y" (XZ plane)
function P.ring(parent: Instance, name: string, center: Vector3, radius: number, segs: number, normal: string, th: number, colors: { Color3 }, mat: Enum.Material?, speed: number?)
	local out = {}
	local function pt(a: number): Vector3
		local c, s = math.cos(a) * radius, math.sin(a) * radius
		if normal == "Z" then
			return center + Vector3.new(c, s, 0)
		elseif normal == "X" then
			return center + Vector3.new(0, c, s)
		end
		return center + Vector3.new(c, 0, s)
	end
	local axis = normal == "Z" and Vector3.zAxis or (normal == "X" and Vector3.xAxis or Vector3.yAxis)
	for i = 1, segs do
		local p = P.beam(parent, name, pt((i - 1) / segs * math.pi * 2), pt(i / segs * math.pi * 2), th, colors[(i - 1) % #colors + 1], mat or Enum.Material.Neon, true)
		if speed then
			P.spin(p, center, axis, speed)
		end
		out[i] = p
	end
	return out
end

local NEON, ROCK = Enum.Material.Neon, Enum.Material.Slate
local function up(y: number): Vector3
	return Vector3.new(0, y, 0)
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

return P
