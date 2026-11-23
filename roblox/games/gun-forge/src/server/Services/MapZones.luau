-- Per-stage identity + set-pieces for MapService (Terrain + decor parts + ambient emitters). Everything here is decor:
-- non-collidable, non-queryable, no shadows, anchored. Terrain is only filled OUTSIDE the 48-wide road (|x| > 40).
-- Budget per stage: <= ~250 parts, <= 6 PointLights, <= 6 ParticleEmitters (Rate <= 15, Decor=true).
-- Client-animated bits use P.spin / P.pulse / Beam "Beam" anims (ZoneLightingController).
local P = require(script.Parent.MapParts)

local V3, CF, ANG, V2 = Vector3.new, CFrame.new, CFrame.Angles, Vector2.new
local NEON = Enum.Material.Neon
local M = Enum.Material
local T = workspace.Terrain
local PI = math.pi

local function rgb(r: number, g: number, b: number): Color3
	return Color3.fromRGB(r, g, b)
end

local Z = {}

-- ===== one-time terrain palette / water =====
function Z.setup()
	local function col(mat: Enum.Material, c: Color3)
		pcall(function()
			T:SetMaterialColor(mat, c)
		end)
	end
	col(M.Grass, rgb(92, 178, 78))
	col(M.Rock, rgb(128, 122, 128))
	col(M.Sand, rgb(228, 190, 124))
	col(M.Sandstone, rgb(198, 120, 80))
	col(M.Snow, rgb(242, 249, 255))
	col(M.Glacier, rgb(165, 218, 246))
	col(M.Basalt, rgb(46, 38, 42))
	col(M.CrackedLava, rgb(255, 96, 24))
	col(M.Slate, rgb(46, 34, 82))
	pcall(function()
		T.WaterColor = rgb(70, 190, 225)
		T.WaterTransparency = 0.72
		T.WaterWaveSize = 0.25
		T.WaterWaveSpeed = 8
		T.WaterReflectance = 0.6
	end)
end

-- ===== shared pieces =====

-- Arches framing the road every ~60 studs. o: pillarCol/Mat, segCol/segCol2/segMat, keyCol, trimCol, h, rise, ts
local function arch(c, o)
	local d, cx = c.d, c.cx
	local h, rise = o.h or 20, o.rise or 9
	local R = c.half + 2
	for _, t in ipairs(o.ts or { 60, 120, 180, 240 }) do
		local z = c.startZ - t
		for s = -1, 1, 2 do
			P.part(d, "ArchPillar", V3(3.4, h, 3.4), CF(cx + s * R, h / 2, z), o.pillarCol, o.pillarMat, true)
			P.part(d, "ArchTrim", V3(0.5, h - 2, 1.4), CF(cx + s * (R - 1.75), h / 2, z), o.trimCol, NEON, true)
		end
		local prev: Vector3? = nil
		for k = 0, 6 do
			local a = PI * (k / 6)
			local p = V3(cx - R * math.cos(a), h + rise * math.sin(a), z)
			if prev then
				P.beam(d, "ArchSeg", prev, p, 2.4, k % 2 == 0 and o.segCol or o.segCol2, o.segMat, true)
			end
			prev = p
		end
		P.ball(d, "ArchKey", 3.6, CF(cx, h + rise + 1.4, z), o.keyCol, NEON)
	end
end

-- Road surface detail: centre band, tile plates, side strips, puddles, cracks
local function road(c, o)
	local d, cx, rng = c.d, c.cx, c.rng
	local midZ = c.startZ - 150
	P.part(d, "RoadBand", V3(o.bandW or 16, 0.04, 300), CF(cx, 0.02, midZ), o.bandCol, o.bandMat, true)
	for s = -1, 1, 2 do
		P.part(d, "RoadSide", V3(o.sideW or 5, 0.04, 300), CF(cx + s * (c.half - 5), 0.02, midZ), o.sideCol, o.sideMat, true)
	end
	for t = 20, 280, 30 do
		P.part(d, "RoadPlate", V3((o.bandW or 16) - 1.2, 0.05, 14), CF(cx, 0.03, c.startZ - t), o.plateCol, o.plateMat or o.bandMat, true)
	end
	for _ = 1, o.puddles or 6 do
		local dia = rng:NextNumber(4, 9)
		local p = P.cyl(d, "Puddle", dia, 0.05, CF(cx + rng:NextNumber(-19, 19), 0.07, c.startZ - rng:NextNumber(30, 250)), o.puddleCol, o.puddleMat or M.Glass, true)
		p.Transparency = o.puddleTr or 0.3
	end
	for _ = 1, o.cracks or 8 do
		local cr = P.part(d, "Crack", V3(rng:NextNumber(0.2, 0.45), 0.05, rng:NextNumber(5, 12)), CF(cx + rng:NextNumber(-20, 20), 0.08, c.startZ - rng:NextNumber(25, 255)) * ANG(0, rng:NextNumber(-0.7, 0.7), 0), o.crackCol, o.crackMat or NEON, true)
		cr.Transparency = o.crackTr or 0.15
	end
end

-- Boss gate: spinning halo ring over the end of the road + dais under the boss ring
local function bossGate(c, o)
	local cx, d = c.cx, c.d
	local z = c.endZ + 9
	P.ring(d, "BossHalo", V3(cx, 30, z), 20, 14, "Z", 2.2, { o.c1, o.c2 }, o.mat or NEON, 0.22)
	P.ring(d, "BossHaloInner", V3(cx, 30, z), 14, 8, "Z", 1.2, { o.c2 }, NEON, -0.5)
	local orb = P.ball(d, "BossOrb", 7, CF(cx, 30, z), o.c1, NEON)
	orb.Transparency = 0.3
	P.pulse(orb, 0.2, 0.7, 2, 0)
	local bz = c.z.bossPos.Z
	P.cyl(d, "BossDais", 47, 0.4, CF(cx, 0, bz), o.dark or P.Dark, M.Slate, true)
	for s = -1, 1, 2 do -- flanking crystal horns
		for k = 1, 2 do
			P.part(d, "BossHorn", V3(2.4, 14 + k * 4, 2.4), CF(cx + s * (c.half + 3 + k * 3.5), 7 + k * 2, c.endZ + 6) * ANG(0, 0, -s * (0.18 + k * 0.1)), o.c1, NEON, true)
		end
	end
end

local function skyBeam(c, x: number, z: number, col: Color3)
	local b = P.part(c.lm, "SkyBeam", V3(2.6, 320, 2.6), CF(x, 150, z), col, NEON, true)
	b.Transparency = 0.72
	P.pulse(b, 0.6, 0.85, 1.2, 0)
end

-- terrain helpers
local function hill(x: number, z: number, r: number, mat: Enum.Material, peak: number?)
	T:FillBall(V3(x, -r + (peak or r * 0.45), z), r, mat)
end

local function near(list, x: number, z: number, d: number): boolean
	for _, p in ipairs(list) do
		if (p.X - x) ^ 2 + (p.Z - z) ^ 2 < d * d then
			return true
		end
	end
	return false
end

-- =====================================================================
-- STAGE 1: MEADOW  - floating islands, waterfalls, ponds, fireflies
-- =====================================================================
function Z.meadow(c)
	local rng, cx, d, lm = c.rng, c.cx, c.d, c.lm
	local islands = {
		{ t = 45, s = 1, xo = 100, y = 78, r = 16, fall = true }, { t = 110, s = -1, xo = 106, y = 98, r = 19, fall = true },
		{ t = 170, s = 1, xo = 114, y = 70, r = 14, fall = false }, { t = 230, s = -1, xo = 98, y = 90, r = 17, fall = true },
		{ t = 282, s = 1, xo = 106, y = 104, r = 20, fall = false },
	}
	local ponds = {}
	local lights = 0
	local mists = 0
	for n, isl in ipairs(islands) do
		local s, xo, y, r = isl.s, isl.xo, isl.y, isl.r
		local x, z = cx + s * xo, c.startZ - isl.t
		local top = y + r * 0.35
		T:FillBall(V3(x, y - r * 0.35, z), r, M.Rock)
		T:FillBall(V3(x, y + r * 0.1, z), r * 0.92, M.Grass)
		T:FillBlock(CF(x, top + 10, z), V3(r * 2 + 6, 20, r * 2 + 6), M.Air)
		-- crown dressing
		local tx, tz = x + rng:NextNumber(-r * 0.35, r * 0.35), z + rng:NextNumber(-r * 0.35, r * 0.35)
		P.cyl(d, "IslandTrunk", 2.4, 9, CF(tx, top + 3.5, tz), rgb(120, 82, 52), M.Wood, true)
		P.ball(d, "IslandLeaf", 13, CF(tx, top + 10, tz), rgb(90, 200, 100), M.Grass)
		P.ball(d, "IslandLeaf", 9, CF(tx + 3, top + 15, tz), rgb(130, 226, 110), M.Grass)
		for k = 1, 2 do
			local cr = P.part(d, "IslandCrystal", V3(2, rng:NextNumber(5, 9), 2), CF(x + rng:NextNumber(-r * 0.5, r * 0.5), top + 2.5, z + rng:NextNumber(-r * 0.5, r * 0.5)) * ANG(rng:NextNumber(-0.3, 0.3), rng:NextNumber(0, 3), rng:NextNumber(-0.3, 0.3)), k == 1 and P.Cyan or P.Pink, NEON, true)
			if k == 1 and lights < 2 then
				lights += 1
				P.light(cr, P.Cyan, 34, 1.4)
			end
		end
		for _ = 1, 3 do
			P.ball(d, "IslandFlower", 1.4, CF(x + rng:NextNumber(-r * 0.6, r * 0.6), top + 0.4, z + rng:NextNumber(-r * 0.6, r * 0.6)), rgb(255, 150, 200), NEON)
		end
		-- waterfall (3 stacked Glass/Neon sheets, client pulse) into a terrain pond
		if isl.fall then
			local ex = x - s * r * 0.85
			local topY = top - 3
			local H = topY - 1.5
			local layers = {
				{ mat = M.Glass, col = rgb(150, 225, 255), tr = 0.35, w = 6, ph = 0 },
				{ mat = NEON, col = rgb(110, 215, 255), tr = 0.55, w = 4, ph = 0.7 },
				{ mat = NEON, col = rgb(235, 250, 255), tr = 0.7, w = 2, ph = 1.9 },
			}
			for li, L in ipairs(layers) do
				local sh = P.part(d, "Waterfall", V3(0.6 + li * 0.2, H, L.w), CF(ex - s * li * 0.15, topY - H / 2, z), L.col, L.mat, true)
				sh.Transparency = L.tr
				if li > 1 then
					P.pulse(sh, L.tr - 0.15, L.tr + 0.25, 2.2 + li * 0.4, L.ph)
				end
			end
			local sp = P.ball(d, "Splash", 8, CF(ex, 1.5, z), rgb(235, 250, 255), NEON)
			sp.Transparency = 0.6
			P.pulse(sp, 0.45, 0.8, 3, n)
			ponds[#ponds + 1] = V3(ex, 0, z)
			T:FillBlock(CF(ex, 0, z), V3(32, 8, 32), M.Grass)
			T:FillBlock(CF(ex, -0.5, z), V3(22, 4, 22), M.Water)
			if mists < 2 then
				mists += 1
				P.emitter(d, "Mist", CF(ex, 5, z), V3(18, 6, 18), { rate = 6, life = NumberRange.new(3, 5), speed = NumberRange.new(1, 3), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 5), NumberSequenceKeypoint.new(1, 13) }), texture = "rbxasset://textures/particles/smoke_main.dds", color = ColorSequence.new(rgb(235, 250, 255)), transp = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.3, 0.8), NumberSequenceKeypoint.new(1, 1) }) })
			end
		end
	end
	-- rolling hills outside the scenery strip (skip around ponds)
	for zz = c.startZ - 5, c.endZ, -34 do
		for s = -1, 1, 2 do
			local x = cx + s * (64 + rng:NextNumber(0, 44))
			local z = zz + rng:NextNumber(-10, 10)
			if not near(ponds, x, z, 38) then
				hill(x, z, rng:NextNumber(20, 32), M.Grass)
			end
		end
	end
	-- fireflies
	for _, t in ipairs({ 70, 150, 230 }) do
		P.emitter(d, "Fireflies", CF(cx, 8, c.startZ - t), V3(110, 14, 70), { rate = 12, life = NumberRange.new(4, 7), speed = NumberRange.new(0.5, 2), size = NumberSequence.new(0.7), glow = 1, color = ColorSequence.new(rgb(220, 255, 120), rgb(120, 255, 200)), accel = V3(0, 0.4, 0), spread = V2(180, 180) })
	end
	arch(c, { pillarCol = rgb(150, 105, 65), pillarMat = M.Wood, segCol = rgb(135, 95, 60), segCol2 = rgb(90, 190, 90), segMat = M.Wood, keyCol = rgb(255, 120, 190), trimCol = P.Cyan, h = 20, rise = 9 })
	road(c, { bandCol = rgb(176, 160, 134), bandMat = M.Cobblestone, plateCol = rgb(150, 136, 112), plateMat = M.Slate, sideCol = rgb(110, 190, 90), sideMat = M.Grass, puddleCol = rgb(120, 205, 245), crackCol = rgb(255, 214, 90), crackTr = 0.3, cracks = 5 })
	bossGate(c, { c1 = P.Gold, c2 = P.Cyan, dark = rgb(40, 70, 50) })
	-- landmark: crystal spire crowning the first island (visible from the hub)
	local lx, lz = cx + 100, c.startZ - 45
	for i = 1, 5 do
		local w = 12 - i * 1.8
		P.part(lm, "Spire", V3(w, 16, w), CF(lx, 84 + i * 14, lz) * ANG(0, i * 0.5, 0), i % 2 == 0 and P.Cyan or rgb(140, 235, 255), i % 2 == 0 and NEON or M.Glass, true)
	end
	P.part(lm, "Tip", V3(5, 10, 5), CF(lx, 168, lz) * ANG(0.6, 0.8, 0), P.Gold, NEON, true)
	skyBeam(c, lx, lz, P.Cyan)
end

-- =====================================================================
-- STAGE 2: DESERT - canyon walls, crashed spaceship, sandstorm, bone ribs
-- =====================================================================
function Z.desert(c)
	local rng, cx, d, lm = c.rng, c.cx, c.d, c.lm
	local ls = c.lside
	local lz = c.startZ - 60
	for zz = c.startZ + 5, c.endZ - 5, -30 do -- dunes
		for s = -1, 1, 2 do
			T:FillBall(V3(cx + s * (52 + rng:NextNumber(0, 14)), -12, zz + rng:NextNumber(-8, 8)), rng:NextNumber(18, 24), M.Sand)
		end
	end
	for zz = c.startZ + 10, c.endZ - 10, -44 do -- canyon walls with a lighter cap
		for s = -1, 1, 2 do
			if not (s == ls and math.abs(zz - lz) < 34) then
				local h, w = rng:NextNumber(34, 72), rng:NextNumber(26, 38)
				local x = cx + s * (64 + w / 2)
				T:FillBlock(CF(x, h / 2 - 6, zz) * ANG(0, rng:NextNumber(-0.12, 0.12), 0), V3(w, h, rng:NextNumber(42, 54)), M.Sandstone)
				T:FillBlock(CF(x - s * 3, h - 3, zz), V3(w - 8, 6, 34), M.Sand)
			end
		end
	end

	-- crashed spaceship (opposite side of the antenna)
	local sx, sz = cx - ls * 48, c.startZ - 150
	local B = CF(sx, 8, sz) * ANG(0, 0.45 * -ls, 0) * ANG(-0.2, 0, 0)
	local function piece(name: string, size: Vector3, off: CFrame, col: Color3, mat: Enum.Material)
		return P.part(d, name, size, B * off, col, mat, true)
	end
	piece("ShipHull", V3(12, 9, 36), CF(), rgb(140, 146, 158), M.Metal)
	piece("ShipBelly", V3(12.6, 2.5, 36.4), CF(0, -3.4, 0), rgb(112, 72, 52), M.CorrodedMetal)
	piece("ShipNose", V3(11, 9, 11), CF(0, 0, -19), rgb(150, 154, 166), M.Metal).Shape = Enum.PartType.Ball
	local ck = piece("ShipCockpit", V3(6, 3, 8), CF(0, 5, -10), rgb(120, 200, 255), M.Glass)
	ck.Transparency = 0.35
	piece("ShipWing", V3(20, 1.2, 12), CF(-14, -1, 4) * ANG(0, 0, -0.12), rgb(130, 136, 148), M.Metal)
	piece("ShipWingBroken", V3(9, 1.2, 10), CF(10, -2.5, 6) * ANG(0, 0.5, 0.4), rgb(110, 90, 80), M.CorrodedMetal)
	piece("ShipFin", V3(1.2, 12, 9), CF(0, 9, 15), rgb(150, 154, 166), M.Metal)
	for s = -1, 1, 2 do
		local en = piece("ShipEngine", V3(6, 5, 5), CF(s * 4, 0, 19) * ANG(0, PI / 2, 0), rgb(80, 82, 92), M.Metal)
		en.Shape = Enum.PartType.Cylinder
		local gl = piece("ShipEngineGlow", V3(0.6, 4.2, 4.2), CF(s * 4, 0, 21.6) * ANG(0, PI / 2, 0), rgb(255, 130, 40), NEON)
		gl.Shape = Enum.PartType.Cylinder
		if s == 1 then
			P.light(gl, rgb(255, 140, 50), 38, 2)
		end
	end
	for k = 1, 3 do
		piece("ShipPlate", V3(3, 0.4, 8), CF(rng:NextNumber(-3, 3), 4.7, -2 + k * 6) * ANG(rng:NextNumber(-0.3, 0.3), rng:NextNumber(-0.5, 0.5), rng:NextNumber(-0.3, 0.3)), rgb(120, 126, 138), M.Metal)
		piece("ShipSpark", V3(0.6, 0.6, 3), CF(rng:NextNumber(-4, 4), 4.6, -4 + k * 5) * ANG(0, rng:NextNumber(0, 3), 0), P.Cyan, NEON)
	end
	for _ = 1, 8 do
		local s = rng:NextNumber(1.5, 4.5)
		P.part(d, "ShipDebris", V3(s, s * 0.5, s * 1.4), CF(sx + rng:NextNumber(-22, 22), 0.3, sz + rng:NextNumber(-12, 40)) * ANG(rng:NextNumber(-0.5, 0.5), rng:NextNumber(0, 3), rng:NextNumber(-0.5, 0.5)), rgb(120, 110, 105), M.CorrodedMetal, true)
	end
	P.part(d, "ShipScorch", V3(12, 0.1, 50), CF(sx, -0.9, sz + 38) * ANG(0, 0.45 * -ls, 0), rgb(30, 26, 26), M.Slate, true)
	P.emitter(d, "ShipFire", B * CF(0, 5, 20), V3(7, 4, 5), { rate = 12, life = NumberRange.new(1, 2), speed = NumberRange.new(5, 9), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 3), NumberSequenceKeypoint.new(1, 0.5) }), glow = 0.8, color = ColorSequence.new(rgb(255, 190, 60), rgb(255, 70, 20)), spread = V2(20, 20) })
	P.emitter(d, "ShipSmoke", B * CF(0, 8, 8), V3(8, 3, 8), { rate = 7, life = NumberRange.new(4, 6), speed = NumberRange.new(4, 7), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 4), NumberSequenceKeypoint.new(1, 14) }), texture = "rbxasset://textures/particles/smoke_main.dds", color = ColorSequence.new(rgb(60, 56, 54)), transp = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.9), NumberSequenceKeypoint.new(0.2, 0.55), NumberSequenceKeypoint.new(1, 1) }) })

	-- giant bone ribcage
	local bx, z0 = cx + ls * 46, c.startZ - 225
	local bone = rgb(236, 226, 200)
	for k = 0, 5 do
		local zk = z0 - k * 5
		local sc = 1 - math.abs(k - 2.5) * 0.12
		local prev: Vector3? = nil
		for q = 0, 4 do
			local a = PI * (0.08 + q / 4 * 0.84)
			local p = V3(bx + math.cos(a) * 11 * sc, 1 + math.sin(a) * 13 * sc, zk)
			if prev then
				P.beam(d, "Rib", prev, p, 1.6, bone, M.Slate, true)
			end
			prev = p
		end
	end
	P.beam(d, "Spine", V3(bx, 14, z0), V3(bx, 14, z0 - 25), 2, bone, M.Slate, true)
	P.ball(d, "Skull", 9, CF(bx, 5, z0 + 8), bone, M.Slate)
	P.ball(d, "SkullEye", 1.8, CF(bx - 2.2, 6, z0 + 12), rgb(255, 160, 40), NEON)
	P.ball(d, "SkullEye", 1.8, CF(bx + 2.2, 6, z0 + 12), rgb(255, 160, 40), NEON)

	-- sandstorm sweeping across the lane
	for _, t in ipairs({ 70, 160, 245 }) do
		P.emitter(d, "Sandstorm", CF(cx - 90, 14, c.startZ - t), V3(20, 34, 70), { rate = 15, life = NumberRange.new(4, 6), speed = NumberRange.new(30, 45), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 5), NumberSequenceKeypoint.new(1, 11) }), texture = "rbxasset://textures/particles/smoke_main.dds", color = ColorSequence.new(rgb(226, 184, 120)), dir = Enum.NormalId.Right, spread = V2(8, 8), transp = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.15, 0.78), NumberSequenceKeypoint.new(0.8, 0.82), NumberSequenceKeypoint.new(1, 1) }) })
	end

	arch(c, { pillarCol = rgb(200, 150, 100), pillarMat = M.Sandstone, segCol = rgb(150, 95, 60), segCol2 = rgb(205, 160, 105), segMat = M.CorrodedMetal, keyCol = P.Gold, trimCol = P.Gold, h = 22, rise = 8 })
	road(c, { bandCol = rgb(196, 152, 106), bandMat = M.Cobblestone, plateCol = rgb(170, 128, 88), plateMat = M.Slate, sideCol = rgb(150, 110, 76), sideMat = M.Concrete, puddleCol = rgb(24, 22, 34), puddleTr = 0.15, crackCol = rgb(255, 190, 70), crackTr = 0.35 })
	bossGate(c, { c1 = P.Gold, c2 = rgb(255, 120, 50), mat = M.Metal, dark = rgb(70, 52, 40) })

	-- landmark: radio antenna tower with a beacon, standing in a gap of the canyon
	local lx = cx + ls * 85
	local rust = rgb(140, 100, 70)
	for sx2 = -1, 1, 2 do
		for sz2 = -1, 1, 2 do
			P.beam(lm, "Leg", V3(lx + sx2 * 8, -1, lz + sz2 * 8), V3(lx + sx2 * 1.5, 82, lz + sz2 * 1.5), 2.2, rust, M.Metal, true)
		end
	end
	for _, y in ipairs({ 20, 48 }) do
		local w = 8 - y / 82 * 6.5
		for k = 0, 3 do
			local a, b = k * PI / 2, (k + 1) * PI / 2
			P.beam(lm, "Brace", V3(lx + math.cos(a) * w * 1.41, y, lz + math.sin(a) * w * 1.41), V3(lx + math.cos(b) * w * 1.41, y, lz + math.sin(b) * w * 1.41), 1.2, rust, M.Metal, true)
		end
	end
	P.part(lm, "Mast", V3(1.4, 40, 1.4), CF(lx, 100, lz), rgb(100, 100, 112), M.Metal, true)
	local bc = P.ball(lm, "Beacon", 7, CF(lx, 122, lz), P.Gold, NEON)
	P.light(bc, P.Gold, 44, 1.6)
	P.pulse(bc, 0, 0.5, 2.5, 0)
	skyBeam(c, lx, lz, P.Gold)
end

-- =====================================================================
-- STAGE 3: FROST - ice cathedral arches, aurora, glacier peaks, frozen lake
-- =====================================================================
function Z.frost(c)
	local rng, cx, d, lm = c.rng, c.cx, c.d, c.lm
	local ls = c.lside
	local lz = c.startZ - 55
	local lakeZ = c.startZ - 150
	for zz = c.startZ - 3, c.endZ, -30 do -- snow drifts
		for s = -1, 1, 2 do
			if not (s == -ls and math.abs(zz - lakeZ) < 48) then
				hill(cx + s * (52 + rng:NextNumber(0, 12)), zz + rng:NextNumber(-8, 8), rng:NextNumber(16, 22), M.Snow, 6)
			end
		end
	end
	for zz = c.startZ - 3, c.endZ, -48 do -- glacier peaks (stacked balls) with snow caps
		for s = -1, 1, 2 do
			if not (s == ls and math.abs(zz - lz) < 50) then
				local x = cx + s * (84 + rng:NextNumber(0, 30))
				local r = rng:NextNumber(24, 32)
				T:FillBall(V3(x, -6, zz), r, M.Glacier)
				T:FillBall(V3(x + rng:NextNumber(-3, 3), r * 0.6, zz), r * 0.66, M.Glacier)
				T:FillBall(V3(x, r * 1.15, zz), r * 0.4, M.Glacier)
				T:FillBall(V3(x, r * 1.5, zz), r * 0.3, M.Snow)
			end
		end
	end

	-- frozen lake on the far side
	local lkx = cx - ls * 62
	local lake = P.part(d, "FrozenLake", V3(46, 0.4, 70), CF(lkx, -0.8, lakeZ), rgb(140, 205, 245), M.Ice, true)
	lake.Transparency = 0.15
	for k = 1, 5 do
		local cr = P.part(d, "LakeCrack", V3(0.3, 0.05, rng:NextNumber(10, 22)), CF(lkx + rng:NextNumber(-16, 16), -0.55, lakeZ + rng:NextNumber(-22, 22)) * ANG(0, rng:NextNumber(-1, 1), 0), rgb(220, 248, 255), NEON, true)
		cr.Transparency = 0.45
	end
	-- ice crystal clusters
	local lights = 0
	for k = 1, 12 do
		local s = k % 2 == 0 and 1 or -1
		local h = rng:NextNumber(8, 17)
		local cr = P.part(d, "IceCrystal", V3(3, h, 3), CF(cx + s * rng:NextNumber(50, 76), h / 2 - 1, c.startZ - 10 - k * 23) * ANG(rng:NextNumber(-0.3, 0.3), rng:NextNumber(0, 3), rng:NextNumber(-0.3, 0.3)), rgb(150, 220, 255), M.Glass, true)
		cr.Transparency = 0.2
		if k % 5 == 0 and lights < 2 then
			lights += 1
			P.light(cr, P.Cyan, 34, 1.5)
		end
	end

	-- cathedral arches: pointed gothic ribs over the road
	local R = c.half + 2
	local ice, glow = rgb(196, 232, 255), rgb(120, 225, 255)
	for _, t in ipairs({ 60, 120, 180, 240 }) do
		local z = c.startZ - t
		for s = -1, 1, 2 do
			P.part(d, "GothPillar", V3(3.6, 34, 3.6), CF(cx + s * R, 17, z), ice, M.Ice, true)
			P.beam(d, "GothRib", V3(cx + s * R, 34, z), V3(cx, 54, z), 3.2, ice, M.Ice, true)
			P.beam(d, "GothGlow", V3(cx + s * (R - 1.6), 33, z), V3(cx, 51.4, z), 0.9, glow, NEON, true)
			P.part(d, "GothSpire", V3(2.2, 16, 2.2), CF(cx + s * (R + 3.4), 8, z) * ANG(0, 0, -s * 0.08), rgb(215, 242, 255), M.Ice, true)
		end
		P.ball(d, "GothKey", 4, CF(cx, 52.5, z), glow, NEON)
		local ch = P.part(d, "Chandelier", V3(2.4, 8, 2.4), CF(cx, 47, z), rgb(170, 230, 255), M.Glass, true)
		ch.Transparency = 0.25
	end

	-- aurora ribbons (Beams with gradients; client animates width/transparency)
	local A = P.part(d, "AuroraA", V3(1, 1, 1), CF(cx, 150, c.startZ - 10), P.Cyan, nil, true)
	A.Transparency = 1
	local Bp = P.part(d, "AuroraB", V3(1, 1, 1), CF(cx, 168, c.startZ - 290), P.Cyan, nil, true)
	Bp.Transparency = 1
	local ribbons = {
		{ x = -70, y = 0, k = 40, c0 = rgb(90, 255, 170), c1 = rgb(70, 220, 255), c2 = rgb(170, 100, 255) },
		{ x = -10, y = 14, k = -50, c0 = rgb(110, 255, 200), c1 = rgb(90, 190, 255), c2 = rgb(200, 120, 255) },
		{ x = 55, y = 4, k = 35, c0 = rgb(70, 255, 150), c1 = rgb(120, 230, 255), c2 = rgb(150, 90, 255) },
		{ x = 115, y = 22, k = -30, c0 = rgb(130, 255, 190), c1 = rgb(80, 200, 255), c2 = rgb(220, 130, 255) },
	}
	for i, r in ipairs(ribbons) do
		local a0 = Instance.new("Attachment")
		a0.Position = V3(r.x, r.y, 0)
		a0.Parent = A
		local a1 = Instance.new("Attachment")
		a1.Position = V3(r.x * 0.6 + 20, r.y + 10, 0)
		a1.Parent = Bp
		local b = Instance.new("Beam")
		b.Attachment0, b.Attachment1 = a0, a1
		b.FaceCamera = true
		b.LightEmission = 1
		b.LightInfluence = 0
		b.Width0, b.Width1 = 50, 70
		b.Segments = 24
		b.CurveSize0, b.CurveSize1 = r.k, -r.k
		b.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, r.c0), ColorSequenceKeypoint.new(0.5, r.c1), ColorSequenceKeypoint.new(1, r.c2) })
		b.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.9), NumberSequenceKeypoint.new(0.5, 0.55), NumberSequenceKeypoint.new(1, 0.9) })
		P.anim(b, "Beam", { AnimSpeed = 0.8, AnimPh = i * 1.3, AnimLo = 0.4, AnimHi = 0.85 })
		b.Parent = A
	end

	-- snowfall + ice glitter
	for _, t in ipairs({ 50, 130, 210, 275 }) do
		P.emitter(d, "Snow", CF(cx, 60, c.startZ - t), V3(110, 2, 70), { rate = 15, life = NumberRange.new(7, 9), speed = NumberRange.new(6, 9), size = NumberSequence.new(0.55), dir = Enum.NormalId.Bottom, spread = V2(18, 18), accel = V3(3, 0, 0), glow = 0.2 })
	end
	P.emitter(d, "IceGlitter", CF(cx, 6, c.startZ - 150), V3(120, 10, 240), { rate = 10, life = NumberRange.new(3, 5), speed = NumberRange.new(0.5, 1.5), size = NumberSequence.new(0.6), glow = 1, color = ColorSequence.new(rgb(170, 235, 255)), spread = V2(180, 180) })

	road(c, { bandCol = rgb(176, 220, 246), bandMat = M.Ice, plateCol = rgb(210, 238, 255), plateMat = M.Glacier, sideCol = rgb(236, 246, 255), sideMat = M.Snow, puddleCol = rgb(215, 242, 255), puddleMat = M.Ice, puddleTr = 0.1, crackCol = rgb(190, 240, 255), crackTr = 0.35 })
	bossGate(c, { c1 = rgb(150, 230, 255), c2 = rgb(200, 150, 255), mat = M.Ice, dark = rgb(60, 90, 130) })

	-- landmark: cathedral facade with a rose window and spires
	local lx = cx + ls * 92
	P.part(lm, "Hall", V3(26, 46, 40), CF(lx, 22, lz), rgb(196, 232, 255), M.Ice, true)
	for i = 1, 5 do
		local w = 14 - i * 2.4
		P.part(lm, "Spire", V3(w, 22, w), CF(lx, 46 + (i - 1) * 22 + 11, lz) * ANG(0, 0.78, 0), i % 2 == 0 and rgb(236, 248, 255) or rgb(185, 226, 255), M.Ice, true)
	end
	P.part(lm, "Tip", V3(3, 10, 3), CF(lx, 168, lz), glow, NEON, true)
	for s = -1, 1, 2 do
		for i = 1, 4 do
			local w = 9 - i * 1.8
			P.part(lm, "Tower", V3(w, 20, w), CF(lx, 26 + (i - 1) * 18 + 10, lz + s * 22) * ANG(0, 0.78, 0), i % 2 == 0 and rgb(236, 248, 255) or rgb(185, 226, 255), M.Ice, true)
		end
	end
	local face = lx - ls * 13.5
	P.ring(lm, "RoseWindow", V3(face, 30, lz), 8, 12, "X", 1.2, { glow }, NEON)
	local core = P.ball(lm, "RoseCore", 10, CF(face, 30, lz), rgb(180, 240, 255), NEON)
	core.Transparency = 0.45
	P.light(core, glow, 50, 1.8)
	P.pulse(core, 0.3, 0.7, 1.5, 0)
	skyBeam(c, lx, lz, glow)
end

-- =====================================================================
-- STAGE 4: MAGMA - foundry, lava rivers, giant gears, volcano
-- =====================================================================
function Z.magma(c)
	local rng, cx, d, lm = c.rng, c.cx, c.d, c.lm
	local ls = c.lside
	local orange = rgb(255, 110, 30)
	local vx, vz = cx + ls * 138, c.startZ - 70
	local sheds = { { -ls, 130 }, { ls, 215 } } -- side, t

	-- lava rivers (terrain CrackedLava, basalt banks) following gentle zigzags
	local pts = {}
	for s = -1, 1, 2 do
		pts[s] = {}
		for k = 0, 8 do
			pts[s][k] = V3(cx + s * (58 + 6 * math.sin(k * 1.1 + (s > 0 and 0 or 2))), 0, c.startZ - 6 - k * 36)
		end
		for k = 0, 7 do
			local a, b = pts[s][k], pts[s][k + 1]
			local mid = (a + b) / 2
			local len = (b - a).Magnitude
			T:FillBlock(CFrame.lookAt(V3(mid.X, -2, mid.Z), V3(b.X, -2, b.Z)), V3(24, 5, len + 4), M.Basalt)
			T:FillBlock(CFrame.lookAt(V3(mid.X, -3, mid.Z), V3(b.X, -3, b.Z)), V3(11, 6, len + 4), M.CrackedLava)
		end
	end
	-- glowing lava blobs with lights (<= 4), plus bubbling pulses
	local li = 0
	for s = -1, 1, 2 do
		for _, k in ipairs({ 2, 6 }) do
			local p = pts[s][k]
			local g = P.cyl(d, "LavaGlow", 7, 0.4, CF(p.X, 0.15, p.Z), orange, NEON, true)
			g.Transparency = 0.2
			P.pulse(g, 0.1, 0.5, 2.5, k + s)
			if li < 4 then
				li += 1
				P.light(g, orange, 42, 2)
			end
		end
	end

	-- basalt crags + volcano
	for zz = c.startZ - 3, c.endZ, -55 do
		for s = -1, 1, 2 do
			local x = cx + s * (84 + rng:NextNumber(0, 24))
			local skip = false
			for _, sh in ipairs(sheds) do
				if sh[1] == s and math.abs(zz - (c.startZ - sh[2])) < 40 then
					skip = true
				end
			end
			if (vx - x) ^ 2 + (vz - zz) ^ 2 < 70 * 70 then
				skip = true
			end
			if not skip then
				local r = rng:NextNumber(22, 30)
				T:FillBall(V3(x, -8, zz), r, M.Basalt)
				T:FillBall(V3(x + rng:NextNumber(-4, 4), r * 0.5, zz), r * 0.55, M.Basalt)
			end
		end
	end
	for k = 0, 6 do -- volcano cone
		T:FillCylinder(CF(vx, -6 + k * 14 + 7, vz), 14, 46 - k * 5.5, M.Basalt)
	end
	T:FillCylinder(CF(vx, -6 + 6 * 14 + 10, vz), 8, 9, M.CrackedLava)
	for k = 1, 3 do
		local a = k * PI * 2 / 3 + 0.4
		local st = P.beam(lm, "LavaStream", V3(vx + math.cos(a) * 12, 90, vz + math.sin(a) * 12), V3(vx + math.cos(a) * 48, -1, vz + math.sin(a) * 48), 3.2, orange, NEON, true)
		st.Transparency = 0.1
	end
	P.emitter(d, "VolcanoEmbers", CF(vx, 98, vz), V3(14, 4, 14), { rate = 15, life = NumberRange.new(3, 5), speed = NumberRange.new(14, 22), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.4), NumberSequenceKeypoint.new(1, 0.2) }), glow = 1, color = ColorSequence.new(rgb(255, 200, 80), rgb(255, 80, 20)), spread = V2(30, 30), accel = V3(0, -8, 0) })

	-- foundry sheds with smokestacks
	for n, sh in ipairs(sheds) do
		local s, zc = sh[1], c.startZ - sh[2]
		local x = cx + s * 92
		local fx = x - s * 15.2
		P.part(d, "ShedBody", V3(30, 20, 36), CF(x, 9, zc), rgb(48, 42, 50), M.Metal, true)
		for k = -1, 1 do
			P.part(d, "ShedRoof", V3(30, 3, 12), CF(x, 20.5, zc + k * 12) * ANG(0.28, 0, 0), rgb(36, 32, 40), M.Metal, true)
		end
		for k = -2, 2 do
			if k ~= 0 then
				P.part(d, "ShedWindow", V3(0.6, 2.5, 4), CF(fx, 13, zc + k * 7), orange, NEON, true)
			end
		end
		local door = P.part(d, "ShedDoor", V3(0.6, 10, 8), CF(fx, 5, zc), rgb(255, 150, 50), NEON, true)
		door.Transparency = 0.1
		P.pulse(door, 0, 0.35, 3, n)
		for k = 1, 2 do
			local sx2 = x + s * 6
			local stackZ = zc + (k == 1 and -10 or 10)
			P.cyl(d, "Stack", 6, 44, CF(sx2, 22, stackZ), rgb(58, 50, 56), M.Metal, true)
			P.cyl(d, "StackRim", 6.6, 1.4, CF(sx2, 44.5, stackZ), orange, NEON, true)
			if k == 1 then
				P.emitter(d, "StackSmoke", CF(sx2, 48, stackZ), V3(4, 2, 4), { rate = 7, life = NumberRange.new(5, 7), speed = NumberRange.new(5, 8), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 4), NumberSequenceKeypoint.new(1, 16) }), texture = "rbxasset://textures/particles/smoke_main.dds", color = ColorSequence.new(rgb(60, 54, 54)), spread = V2(12, 12), transp = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.9), NumberSequenceKeypoint.new(0.2, 0.55), NumberSequenceKeypoint.new(1, 1) }) })
			end
		end
	end

	-- giant gears (client-spun)
	local function gear(x: number, y: number, z: number, Rg: number, speed: number)
		local center = V3(x, y, z)
		local body = P.part(d, "GearBody", V3(6, Rg * 2, Rg * 2), CF(center), rgb(74, 66, 76), M.Metal, true)
		body.Shape = Enum.PartType.Cylinder
		P.spin(body, center, Vector3.xAxis, speed)
		for k = 1, 8 do
			local a = k / 8 * PI * 2
			local tooth = P.part(d, "GearTooth", V3(6, 5, 6), CF(center + V3(0, math.cos(a) * (Rg + 1.5), math.sin(a) * (Rg + 1.5))) * ANG(a, 0, 0), rgb(88, 78, 90), M.Metal, true)
			P.spin(tooth, center, Vector3.xAxis, speed)
		end
		for k = 0, 2 do
			local sp = P.part(d, "GearSpoke", V3(6.4, Rg * 1.7, 3), CF(center) * ANG(k * PI / 3, 0, 0), orange, NEON, true)
			sp.Transparency = 0.15
			P.spin(sp, center, Vector3.xAxis, speed)
		end
	end
	gear(cx + 118, 40, c.startZ - 30, 26, 0.2)
	gear(cx - 120, 38, c.startZ - 195, 24, -0.22)
	gear(cx + 108, 34, c.startZ - 255, 20, 0.28)

	-- lava cauldron gantry pouring into the river
	local cp = pts[1][5]
	for k = -1, 1, 2 do
		P.part(d, "CauldronPylon", V3(4, 40, 4), CF(cp.X + 10, 20, cp.Z + k * 9), rgb(50, 44, 52), M.Metal, true)
	end
	P.part(d, "CauldronBeam", V3(4, 3, 22), CF(cp.X + 10, 41, cp.Z), rgb(50, 44, 52), M.Metal, true)
	P.cyl(d, "Cauldron", 10, 8, CF(cp.X + 4, 34, cp.Z) * ANG(0, 0, 0.6), rgb(70, 60, 66), M.Metal, true)
	local fall = P.part(d, "LavaFall", V3(2.6, 34, 2.6), CF(cp.X, 16, cp.Z), orange, NEON, true)
	fall.Transparency = 0.1
	P.pulse(fall, 0, 0.3, 4, 0)

	-- embers over the lane
	for _, t in ipairs({ 60, 150, 240 }) do
		P.emitter(d, "Embers", CF(cx, 6, c.startZ - t), V3(110, 8, 70), { rate = 14, life = NumberRange.new(4, 6), speed = NumberRange.new(3, 7), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.7), NumberSequenceKeypoint.new(1, 0.1) }), glow = 1, color = ColorSequence.new(rgb(255, 200, 90), rgb(255, 90, 30)), accel = V3(0, 2, 0), spread = V2(40, 40) })
	end

	arch(c, { pillarCol = rgb(46, 40, 48), pillarMat = M.Metal, segCol = rgb(62, 54, 62), segCol2 = rgb(96, 70, 52), segMat = M.Metal, keyCol = orange, trimCol = orange, h = 22, rise = 3 })
	road(c, { bandCol = rgb(52, 42, 46), bandMat = M.Basalt, plateCol = rgb(70, 54, 54), plateMat = M.Slate, sideCol = orange, sideMat = NEON, sideW = 0.6, puddleCol = orange, puddleMat = NEON, puddleTr = 0.2, puddles = 5, crackCol = orange, crackTr = 0.1, cracks = 10 })
	bossGate(c, { c1 = orange, c2 = P.Gold, mat = M.Metal, dark = rgb(50, 36, 36) })
	skyBeam(c, vx, vz, orange)
end

-- =====================================================================
-- STAGE 5: VOID - floating neon platforms, gyroscope rings, starfield, obelisk
-- =====================================================================
function Z.void(c)
	local rng, cx, d, lm = c.rng, c.cx, c.d, c.lm
	local ls = c.lside

	-- asteroids (terrain) with neon crystals
	for k = 1, 12 do
		local s = k % 2 == 0 and 1 or -1
		local r = rng:NextNumber(8, 16)
		local pos = V3(cx + s * rng:NextNumber(76, 150), rng:NextNumber(25, 95), c.startZ - 10 - k * 23)
		T:FillBall(pos, r, k % 3 == 0 and M.Basalt or M.Slate)
		P.part(d, "AsteroidCrystal", V3(2.2, r * 0.9, 2.2), CF(pos + V3(0, r * 0.9, 0)) * ANG(rng:NextNumber(-0.3, 0.3), 0, rng:NextNumber(-0.3, 0.3)), k % 2 == 0 and P.Pink or P.Cyan, NEON, true)
	end

	-- floating neon platforms (hover tiles) with pulsing under-glow and light shafts
	for k = 1, 16 do
		local s = k % 2 == 0 and 1 or -1
		local y = rng:NextNumber(6, 40)
		local sz = rng:NextNumber(12, 16)
		local x, z = cx + s * rng:NextNumber(50, 78), c.startZ - 8 - k * 17
		local col = k % 2 == 0 and P.Pink or P.Cyan
		P.part(d, "HoverTile", V3(sz, 1.5, sz), CF(x, y, z) * ANG(0, rng:NextNumber(0, 3), 0), P.Dark, M.Metal, true)
		local g = P.part(d, "HoverGlow", V3(sz + 0.6, 0.4, sz + 0.6), CF(x, y - 0.9, z), col, NEON, true)
		P.pulse(g, 0, 0.5, 2, k)
		local sh = P.part(d, "HoverShaft", V3(0.7, y, 0.7), CF(x, y / 2, z), col, NEON, true)
		sh.Transparency = 0.75
	end

	-- giant rotating gyroscope rings over the road
	local cols = { P.Pink, P.Cyan }
	for n, t in ipairs({ 80, 170, 250 }) do
		P.ring(d, "GyroRing", V3(cx, 46, c.startZ - t), 36, 16, "Z", 2.4, cols, NEON, n % 2 == 0 and -0.35 or 0.35)
	end
	P.ring(d, "GyroInner", V3(cx, 46, c.startZ - 170), 27, 12, "Z", 1.4, { P.Gold }, NEON, 0.6)

	-- neon grid across the road
	for t = 20, 280, 20 do
		local ln = P.part(d, "GridLine", V3(c.half * 2 - 6, 0.05, 0.35), CF(cx, 0.09, c.startZ - t), (t / 20) % 2 == 0 and P.Pink or P.Cyan, NEON, true)
		ln.Transparency = 0.55
	end

	-- starfield + rising void sparks
	for _, t in ipairs({ 60, 150, 240 }) do
		P.emitter(d, "Stars", CF(cx, 70, c.startZ - t), V3(260, 80, 90), { rate = 12, life = NumberRange.new(18, 24), speed = NumberRange.new(0, 0.2), size = NumberSequence.new(1.2), glow = 1, color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.new(1, 1, 1)), ColorSequenceKeypoint.new(0.5, rgb(150, 220, 255)), ColorSequenceKeypoint.new(1, rgb(255, 150, 240)) }), spread = V2(180, 180) })
	end
	for _, t in ipairs({ 100, 210 }) do
		P.emitter(d, "VoidSparks", CF(cx, 4, c.startZ - t), V3(100, 8, 80), { rate = 12, life = NumberRange.new(3, 5), speed = NumberRange.new(3, 6), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.7), NumberSequenceKeypoint.new(1, 0.1) }), glow = 1, color = ColorSequence.new(rgb(255, 90, 220), rgb(80, 220, 255)), accel = V3(0, 3, 0), spread = V2(30, 30) })
	end

	arch(c, { pillarCol = rgb(24, 18, 48), pillarMat = M.Metal, segCol = rgb(36, 26, 70), segCol2 = rgb(90, 60, 170), segMat = M.Metal, keyCol = P.Pink, trimCol = P.Cyan, h = 22, rise = 9 })
	road(c, { bandCol = rgb(30, 24, 56), bandMat = M.Metal, plateCol = rgb(40, 30, 78), plateMat = M.Slate, sideCol = P.Pink, sideMat = NEON, sideW = 0.6, puddleCol = rgb(110, 60, 220), puddleTr = 0.35, crackCol = P.Cyan, crackTr = 0.25 })
	bossGate(c, { c1 = P.Pink, c2 = P.Cyan, dark = rgb(30, 18, 60) })

	-- landmark: obelisk with three orbiting rings
	local lx, lz = cx + ls * 98, c.startZ - 45
	P.part(lm, "Obelisk", V3(9, 74, 9), CF(lx, 36, lz), rgb(26, 18, 52), M.Slate, true)
	for sx2 = -1, 1, 2 do
		for sz2 = -1, 1, 2 do
			if sx2 == sz2 then
				P.part(lm, "ObeliskEdge", V3(0.9, 74, 0.9), CF(lx + sx2 * 4.6, 36, lz + sz2 * 4.6), P.Cyan, NEON, true)
			else
				P.part(lm, "ObeliskEdge", V3(0.9, 74, 0.9), CF(lx + sx2 * 4.6, 36, lz + sz2 * 4.6), P.Pink, NEON, true)
			end
		end
	end
	local orb = P.ball(lm, "ObeliskOrb", 11, CF(lx, 84, lz), P.Pink, NEON)
	P.light(orb, P.Pink, 50, 1.8)
	P.pulse(orb, 0, 0.4, 2, 0)
	for n = 1, 3 do
		P.ring(lm, "OrbitRing", V3(lx, 40 + n * 14, lz), 16 + n * 3, 12, "Y", 1.2, cols, NEON, (n % 2 == 0 and -1 or 1) * (0.5 + n * 0.15))
	end
	skyBeam(c, lx, lz, P.Pink)
end

-- Entry point: builds one stage's set-piece. c = { m, cx, half, startZ, endZ, accent, rng, lside, z }
function Z.build(c)
	local f = Instance.new("Folder")
	f.Name = "SetPiece"
	c.d = f
	local lm = Instance.new("Model")
	lm.Name = "Landmark"
	c.lm = lm
	local fn = Z[c.z.id]
	if fn then
		fn(c)
	end
	f.Parent = c.m
	lm.Parent = c.m
end

return Z
