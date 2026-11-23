-- Code-driven first-person weapon animation (client only, no animation assets).
-- Works with the code-built handle and with Blender guns whose child meshes are named Body/Magazine/Slide/Trigger.
-- The whole gun is moved by editing the character's RightGrip weld C1 (handle-local offsets, so it is independent of the
-- model's axis); Slide / Magazine / Trigger are moved by swapping their WeldConstraint for a client Weld.
--   Update(dt, s)  per frame: s = { ads = 0..1, speed = studs/s, reload = 0..1 | nil, bloom = 0..1 }
--   Kick(strength)  recoil kickback + slide cycle on a shot     Equip()  raise animation
--   PollPhase()  returns 1 (mag out) / 2 (mag in) / 3 (bolt) once each time a reload phase is reached
local Players = game:GetService("Players")

local WeaponAnim = {}

local player = Players.LocalPlayer

type Moving = { part: BasePart, weld: Weld, base: CFrame }
local tool: Tool? = nil
local grip: Weld? = nil
local baseC1 = CFrame.identity
local moving: { [string]: Moving } = {}
local fwd = Vector3.new(0, 0, -1)
local side = Vector3.xAxis
local kick, kickV = 0, 0 -- kickback spring (0 = rest)
local slide = 0 -- slide travel 0..1, snaps back
local equipAt = 0
local phase = 0 -- reload phases already announced (1 mag out, 2 mag in, 3 bolt)
local t0 = os.clock()

local function release()
	if grip and grip.Parent then
		grip.C1 = baseC1
	end
	for _, m in pairs(moving) do
		if m.weld.Parent then
			m.weld.C0 = m.base
		end
		m.part.Transparency = 0
	end
	tool, grip, moving = nil, nil, {}
end

local function dominantAxis(v: Vector3): Vector3
	local ax, ay, az = math.abs(v.X), math.abs(v.Y), math.abs(v.Z)
	if ax >= ay and ax >= az then
		return Vector3.new(math.sign(v.X), 0, 0)
	elseif az >= ay then
		return Vector3.new(0, 0, math.sign(v.Z))
	end
	return Vector3.new(0, math.sign(v.Y), 0)
end

-- take over a named child part: disable its static joints and replace them with a client weld we can offset
local function adopt(handle: BasePart, name: string)
	local part = handle:FindFirstChild(name, true)
	if not part or not part:IsA("BasePart") or part == handle then
		return
	end
	local rel = handle.CFrame:ToObjectSpace(part.CFrame)
	for _, d in ipairs(handle:GetDescendants()) do
		if d:IsA("WeldConstraint") and (d.Part0 == part or d.Part1 == part) then
			d.Enabled = false
		elseif (d:IsA("Weld") or d:IsA("Motor6D")) and (d.Part0 == part or d.Part1 == part) and d.Name ~= "RightGrip" then
			d.Enabled = false
		end
	end
	local w = Instance.new("Weld")
	w.Name = "AnimWeld"
	w.Part0, w.Part1 = handle, part
	w.C0 = rel
	w.Parent = part
	part.Massless = true
	moving[name] = { part = part, weld = w, base = rel }
end

local function setup(t: Tool)
	release()
	local char = player.Character
	local handle = t:FindFirstChild("Handle") :: BasePart?
	local g = char and char:FindFirstChild("RightGrip", true)
	if not handle or not g or not g:IsA("JointInstance") then
		return
	end
	tool, grip = t, g :: any
	baseC1 = (g :: any).C1
	local muz = handle:FindFirstChild("Muzzle") :: Attachment?
	fwd = if muz and muz.Position.Magnitude > 0.1 then dominantAxis(muz.Position) else Vector3.new(0, 0, -1)
	side = fwd:Cross(Vector3.yAxis)
	if side.Magnitude < 0.1 then
		side = Vector3.xAxis
	end
	side = side.Unit
	for _, n in ipairs({ "Slide", "Magazine", "Trigger" }) do
		adopt(handle, n)
	end
	equipAt = os.clock()
	phase = 0
end

function WeaponAnim.Equip()
	equipAt = os.clock()
end

-- shot: kick the grip back and cycle the slide/bolt
function WeaponAnim.Kick(strength: number)
	kickV += strength * 9
	slide = 1
end

local function smooth(a: number): number
	return a * a * (3 - 2 * a)
end

function WeaponAnim.Update(dt: number, s: { ads: number, speed: number, reload: number?, bloom: number })
	local char = player.Character
	local t = char and char:FindFirstChildOfClass("Tool")
	if t and not t:GetAttribute("Gun") then
		t = nil
	end
	if t ~= tool then
		if t then
			setup(t)
		else
			release()
		end
	end
	if not tool or not grip or not grip.Parent then
		return
	end
	local now = os.clock()
	local damp = 1 - s.ads * 0.7 -- idle motion shrinks when aiming

	-- spring for the kickback (underdamped a little = punchy recovery)
	local k, c = 220, 24
	kickV += (-k * kick - c * kickV) * dt
	kick += kickV * dt
	slide = math.max(0, slide - dt * 9)

	-- idle sway + breathing, walk bob
	local tt = now - t0
	local moveF = math.clamp(s.speed / 16, 0, 1.4)
	local bobT = tt * (6 + moveF * 3)
	local px = math.sin(tt * 0.9) * 0.012 * damp + math.sin(bobT) * 0.03 * moveF * damp
	local py = math.sin(tt * 1.6) * 0.01 * damp - math.abs(math.cos(bobT)) * 0.04 * moveF * damp
	local roll = math.sin(bobT) * 0.012 * moveF * damp
	local pitch = math.sin(tt * 1.6) * 0.004 * damp

	-- equip raise
	local eq = smooth(math.clamp((now - equipAt) / 0.4, 0, 1))
	pitch += -(1 - eq) * 0.9
	py -= (1 - eq) * 0.5

	-- reload: tilt the gun, mag drops out (0..0.3), stays out (..0.55), new mag slides in (..0.85), settle + rack
	local magOff, magAlpha = 0, 0
	local r = s.reload
	if r then
		local tilt = math.sin(math.clamp(r, 0, 1) * math.pi)
		pitch += -0.35 * tilt
		roll += 0.5 * tilt
		px += 0.05 * tilt
		if r < 0.3 then
			magOff = smooth(r / 0.3) * 1.6
			magAlpha = smooth(r / 0.3)
		elseif r < 0.55 then
			magOff, magAlpha = 1.6, 1
		elseif r < 0.85 then
			local a = smooth((r - 0.55) / 0.3)
			magOff, magAlpha = 1.6 * (1 - a), 1 - math.min(1, a * 1.5)
		end
		if r > 0.1 and phase < 1 then
			phase = 1
		elseif r > 0.6 and phase < 2 then
			phase = 2
		elseif r > 0.88 and phase < 3 then
			phase = 3
			slide = 1
		end
	else
		phase = 0
	end

	local kb = kick * 0.12
	local off = CFrame.new(side * px + Vector3.yAxis * py - fwd * kb) * CFrame.fromAxisAngle(side, pitch + kick * 0.08)
		* CFrame.fromAxisAngle(fwd, roll)
	grip.C1 = off:Inverse() * baseC1

	local sl = moving.Slide
	if sl then
		sl.weld.C0 = CFrame.new(-fwd * 0.35 * slide) * sl.base
	end
	local tr = moving.Trigger
	if tr then
		tr.weld.C0 = CFrame.new(-fwd * 0.04 * slide) * tr.base
	end
	local mg = moving.Magazine
	if mg then
		mg.weld.C0 = CFrame.new(-Vector3.yAxis * magOff) * mg.base
		mg.part.Transparency = magAlpha
	end
end

-- progress-driven phase pulses for audio: returns the phase number if a new one was reached this frame
local announced = 0
function WeaponAnim.PollPhase(): number?
	if phase == 0 then
		announced = 0
		return nil
	end
	if phase > announced then
		announced += 1
		return announced
	end
	return nil
end

return WeaponAnim
