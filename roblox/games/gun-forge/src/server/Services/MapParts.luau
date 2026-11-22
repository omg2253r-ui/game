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

function P.label(adornee: BasePart, text: string, color: Color3?, offsetY: number?)
	local g = Instance.new("BillboardGui")
	g.Name = "NameLabel"
	g.Size = UDim2.fromOffset(220, 44)
	g.StudsOffset = Vector3.new(0, offsetY or 8, 0)
	g.MaxDistance = 80
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

P.Landmarks = L
return P
