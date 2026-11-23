-- Weapon-specific client VFX (all pooled + hard capped, off in Low Graphics):
--   ImpactDecal (dark disc on surfaces, <= 30, fades in 3 s)   Shell (brass casing arc, <= 20)
--   SmokePuff (muzzle smoke, <= 8)   Charge (railgun muzzle charge-up glow)
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Effects = require(script.Parent.EffectsController)

local WeaponFx = {}

local MAX_DECALS, MAX_SHELLS, MAX_SMOKE = 30, 20, 8
local decals: { Part } = {}
local decalTweens: { [Part]: Tween } = {}
local decalNext = 1
local shells: { Part } = {}
local shellNext = 1
local flying: { { part: Part, vel: Vector3, spin: Vector3, born: number } } = {}
local smokeActive = 0
local conn: RBXScriptConnection? = nil

local function lowFx(): boolean
	return Effects.LowFx
end

-- dark bullet-hole disc on a surface (call with the raycast hit position + normal)
function WeaponFx.ImpactDecal(pos: Vector3, normal: Vector3)
	if lowFx() then
		return
	end
	local d = decals[decalNext]
	if not d then
		d = Instance.new("Part")
		d.Shape = Enum.PartType.Cylinder
		d.Anchored, d.CanCollide, d.CanQuery, d.CanTouch, d.CastShadow = true, false, false, false, false
		d.Material = Enum.Material.SmoothPlastic
		d.Color = Color3.fromRGB(18, 16, 18)
		d.Size = Vector3.new(0.03, 0.55, 0.55)
		decals[decalNext] = d
	end
	decalNext = decalNext % MAX_DECALS + 1
	local old = decalTweens[d]
	if old then
		old:Cancel()
	end
	d.Transparency = 0.15
	d.CFrame = CFrame.lookAt(pos + normal * 0.02, pos + normal) * CFrame.Angles(0, math.rad(90), 0)
	d.Parent = Workspace
	local tw = TweenService:Create(d, TweenInfo.new(3, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Transparency = 1 })
	decalTweens[d] = tw
	tw.Completed:Connect(function(state)
		if state == Enum.PlaybackState.Completed then
			d.Parent = nil
		end
	end)
	tw:Play()
end

local function stepShells(dt: number)
	local now = os.clock()
	for i = #flying, 1, -1 do
		local s = flying[i]
		local life = now - s.born
		if life > 0.9 then
			s.part.Parent = nil
			table.remove(flying, i)
		else
			s.vel += Vector3.new(0, -55 * dt, 0)
			s.part.CFrame = (s.part.CFrame + s.vel * dt) * CFrame.Angles(s.spin.X * dt, s.spin.Y * dt, s.spin.Z * dt)
			if life > 0.4 then
				s.part.Transparency = math.clamp((life - 0.4) / 0.5, 0, 1)
			end
		end
	end
	if #flying == 0 and conn then
		conn:Disconnect()
		conn = nil
	end
end

-- brass casing ejected from `from`, thrown along `right` (+ up), quick arc
function WeaponFx.Shell(from: Vector3, right: Vector3, rng: Random)
	if lowFx() or #flying >= MAX_SHELLS then
		return
	end
	local p = shells[shellNext]
	if not p then
		p = Instance.new("Part")
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
		p.Material = Enum.Material.Metal
		p.Color = Color3.fromRGB(214, 168, 66)
		p.Size = Vector3.new(0.09, 0.09, 0.26)
		shells[shellNext] = p
	end
	shellNext = shellNext % MAX_SHELLS + 1
	for _, f in ipairs(flying) do
		if f.part == p then
			return
		end
	end
	p.Transparency = 0
	p.CFrame = CFrame.new(from)
	p.Parent = Workspace
	table.insert(flying, {
		part = p,
		vel = right * rng:NextNumber(6, 10) + Vector3.new(rng:NextNumber(-1, 1), rng:NextNumber(5, 9), rng:NextNumber(-1, 1)),
		spin = Vector3.new(rng:NextNumber(-30, 30), rng:NextNumber(-30, 30), rng:NextNumber(-30, 30)),
		born = os.clock(),
	})
	if not conn then
		conn = RunService.Heartbeat:Connect(stepShells)
	end
end

-- small grey smoke puff drifting up from the muzzle
function WeaponFx.SmokePuff(pos: Vector3, dir: Vector3)
	if lowFx() or smokeActive >= MAX_SMOKE then
		return
	end
	smokeActive += 1
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Ball
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.SmoothPlastic
	p.Color = Color3.fromRGB(190, 190, 195)
	p.Transparency = 0.6
	p.Size = Vector3.one * 0.3
	p.Position = pos
	p.Parent = Workspace
	local tw = TweenService:Create(p, TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size = Vector3.one * 1.3, Transparency = 1, Position = pos + dir * 1.2 + Vector3.new(0, 1.1, 0) })
	tw.Completed:Connect(function()
		smokeActive -= 1
		p:Destroy()
	end)
	tw:Play()
end

-- railgun charge-up: a neon orb at the muzzle that grows for `duration`; getPos keeps it on the (moving) barrel
function WeaponFx.Charge(getPos: () -> Vector3?, color: Color3, duration: number)
	if lowFx() then
		return
	end
	local orb = Instance.new("Part")
	orb.Shape = Enum.PartType.Ball
	orb.Anchored, orb.CanCollide, orb.CanQuery, orb.CanTouch, orb.CastShadow = true, false, false, false, false
	orb.Material = Enum.Material.Neon
	orb.Color = color
	orb.Transparency = 0.3
	orb.Size = Vector3.one * 0.1
	local light = Instance.new("PointLight")
	light.Color = color
	light.Range = 10
	light.Shadows = false
	light.Brightness = 0
	light.Parent = orb
	orb.Parent = Workspace
	local t0 = os.clock()
	local c
	c = RunService.Heartbeat:Connect(function()
		local a = (os.clock() - t0) / duration
		local pos = getPos()
		if a >= 1 or not pos then
			c:Disconnect()
			orb:Destroy()
			return
		end
		orb.Position = pos
		orb.Size = Vector3.one * (0.1 + a * 0.8 + math.sin(a * 60) * 0.04)
		light.Brightness = a * 6
	end)
end

return WeaponFx
