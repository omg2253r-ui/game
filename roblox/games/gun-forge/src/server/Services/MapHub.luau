-- Sci-fi plaza dressing for the Hub (added on top of MapService.buildHub): holographic monument, neon floor
-- patterns, light pillars over stations, floating skyline towers, undercarriage. All decor (<= ~190 parts).
local P = require(script.Parent.MapParts)

local V3, CF, ANG = Vector3.new, CFrame.new, CFrame.Angles
local NEON, M = Enum.Material.Neon, Enum.Material
local PI = math.pi

local H = {}

function H.decorate(hub: Instance, R: number, stations)
	local d = Instance.new("Folder")
	d.Name = "Plaza"
	local floorCol = P.Dark

	-- concentric neon rings + radial spokes (above the existing floor layers, below pads/bases)
	for i, r in ipairs({ 54, 36 }) do -- big first, so the smaller ring sits on top
		local y = 0.4 + (i - 1) * 0.04
		P.cyl(d, "FloorRing", r * 2, 0.04, CF(0, y, 0), r == 36 and P.Cyan or P.Pink, NEON, true)
		P.cyl(d, "FloorRingFill", r * 2 - 1, 0.04, CF(0, y + 0.01, 0), floorCol, M.SmoothPlastic, true)
	end
	for i = 0, 11 do
		local a = i / 12 * PI * 2
		if not (math.sin(a) < -0.6) then -- keep the lane mouth clean
			local len = R - 20
			local mid = 14 + len / 2
			local ln = P.part(d, "Spoke", V3(0.6, 0.04, len), CF(math.cos(a) * mid, 0.5, math.sin(a) * mid) * ANG(0, -a + PI / 2, 0), i % 2 == 0 and P.Cyan or P.Pink, NEON, true)
			ln.Transparency = 0.3
		end
	end

	-- holographic monument: pedestal + spinning forge-gun hologram + 3 orbit rings
	local mz = 24
	local center = V3(0, 20, mz)
	P.cyl(d, "MonumentBase", 17, 1.2, CF(0, 0.9, mz), P.Dark, M.Metal, true)
	P.cyl(d, "MonumentRing", 15, 1.3, CF(0, 0.95, mz), P.Cyan, NEON, true)
	P.cyl(d, "MonumentTop", 11, 1.4, CF(0, 1, mz), P.Dark, M.Metal, true)
	local col = P.part(d, "MonumentColumn", V3(3.4, 10, 3.4), CF(0, 6, mz), P.Dark, M.Metal, true)
	P.part(d, "MonumentColumnGlow", V3(0.6, 9, 3.8), CF(0, 6, mz), P.Cyan, NEON, true)
	local emit = P.part(d, "MonumentEmitterPlate", V3(7, 0.6, 7), CF(0, 11.3, mz), P.Cyan, NEON, true)
	P.light(emit, P.Cyan, 46, 1.8)
	local function holo(name: string, size: Vector3, off: Vector3, c: Color3)
		local p = P.part(d, name, size, CF(center + off), c, NEON, true)
		p.Transparency = 0.25
		P.spin(p, center, Vector3.yAxis, 0.9)
		return p
	end
	holo("HoloSlide", V3(1.8, 2.2, 10), V3(0, 1, 0), P.Cyan)
	holo("HoloBarrel", V3(1, 1, 4), V3(0, 1.2, -6.5), P.Pink)
	holo("HoloGrip", V3(1.6, 4.5, 2.2), V3(0, -2.4, 3.2), P.Cyan)
	holo("HoloMag", V3(1.2, 3, 1.6), V3(0, -3.2, 0.4), P.Gold)
	P.ring(d, "HoloRing", center, 11, 14, "Z", 0.7, { P.Cyan, P.Pink }, NEON, 0.5)
	P.ring(d, "HoloRing", center, 13, 14, "X", 0.7, { P.Pink, P.Gold }, NEON, -0.4)
	P.ring(d, "HoloRing", center + V3(0, -5, 0), 9, 10, "Y", 0.7, { P.Cyan }, NEON, 0.8)
	P.label(col, "GUN FORGE", P.Gold, 22, 260, UDim2.fromOffset(300, 60))
	P.emitter(d, "MonumentSparks", CF(0, 12, mz), V3(9, 2, 9), { rate = 12, life = NumberRange.new(3, 4), speed = NumberRange.new(3, 6), size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.7), NumberSequenceKeypoint.new(1, 0.1) }), glow = 1, color = ColorSequence.new(Color3.fromRGB(110, 230, 255), Color3.fromRGB(255, 110, 230)), spread = Vector2.new(25, 25) })
	P.emitter(d, "PlazaMotes", CF(0, 14, 0), V3(150, 24, 150), { rate = 10, life = NumberRange.new(6, 9), speed = NumberRange.new(0.5, 1.5), size = NumberSequence.new(0.5), glow = 1, color = ColorSequence.new(Color3.fromRGB(120, 220, 255)), accel = V3(0, 0.3, 0), spread = Vector2.new(180, 180) })

	-- station light pillars (faint neon shafts)
	for _, s in ipairs(stations) do
		local sh = P.part(d, "StationShaft", V3(1.2, 34, 1.2), CF(s[3], 17, s[4]), s[5], NEON, true)
		sh.Transparency = 0.78
		P.pulse(sh, 0.65, 0.9, 1.6, s[3] * 0.05)
	end

	-- floating skyline towers around the rim (skip the lane mouth)
	local n = 0
	for i = 1, 14 do
		local a = i / 14 * PI * 2
		local px, pz = math.cos(a) * (R + 22), math.sin(a) * (R + 22)
		if not (pz < 0 and math.abs(px) < 56) and n < 10 then
			n += 1
			local h = 30 + (i * 17 % 40)
			local c = i % 2 == 0 and P.Cyan or P.Pink
			P.cyl(d, "TowerPlate", 24, 1.6, CF(px, -1, pz), P.Dark, M.Metal, true)
			P.part(d, "Tower", V3(13, h, 13), CF(px, h / 2, pz), Color3.fromRGB(34, 30, 66), M.Metal, true)
			P.part(d, "TowerBand", V3(13.4, 1.2, 13.4), CF(px, h * 0.35, pz), c, NEON, true)
			P.part(d, "TowerBand", V3(13.4, 1.2, 13.4), CF(px, h * 0.7, pz), c == P.Cyan and P.Pink or P.Cyan, NEON, true)
			P.part(d, "TowerAntenna", V3(0.8, 12, 0.8), CF(px, h + 6, pz), P.Dark, M.Metal, true)
			P.ball(d, "TowerBeacon", 2.2, CF(px, h + 12.5, pz), c, NEON)
		end
	end

	-- undercarriage so the plaza reads as a floating station
	P.cyl(d, "HubUnder", R * 2 - 6, 3, CF(0, -3.5, 0), Color3.fromRGB(30, 28, 56), M.Metal, true)
	P.cyl(d, "HubUnderGlow", R * 2 - 10, 0.5, CF(0, -5.2, 0), P.Cyan, NEON, true)
	P.cyl(d, "HubUnder", R * 1.4, 8, CF(0, -9, 0), Color3.fromRGB(26, 24, 50), M.Metal, true)
	P.cyl(d, "HubUnder", R * 0.7, 10, CF(0, -18, 0), Color3.fromRGB(22, 20, 42), M.Metal, true)

	d.Parent = hub
end

return H
