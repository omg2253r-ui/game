-- Shooting with realistic feel. Client picks the target, rolls spread, sends the server the fire request; the server
-- validates rate / fire mode / ammo / range and decides crits (weak point) itself.
--   Fire modes: semi / burst / auto per gun (B or MODE button)   ADS: hold right mouse / ADS button (zoom, tighter spread)
--   Recoil: spring-driven camera climb + random sideways, spread bloom while spraying, crosshair that breathes
--   Ballistics: travel-time tracers, impact decals on misses, shell casings, muzzle smoke, railgun charge-up
--   Animation + extra audio layers: WeaponAnim.luau / Config.Sounds (Mech, Tail)
-- Public (used by the HUD): Mag, MaxMag, ReloadUntil, ReloadTime, Auto, Reloading(), Reload(), MuzzlePos(tool, char)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Guns = require(Shared.Config.Guns)
local Sounds = require(Shared.Config.Sounds)
local UI = require(script.Parent.Parent.UIKit)
local UIController = require(script.Parent.UIController)
local MonsterController = require(script.Parent.MonsterController)
local Vfx = require(script.Parent.VfxController)
local WeaponFx = require(script.Parent.WeaponFx)
local WeaponAnim = require(script.Parent.WeaponAnim)
local Effects = require(script.Parent.EffectsController)

local player = Players.LocalPlayer
local GunController = { Auto = false, Mag = 0, MaxMag = 0, ReloadUntil = 0, ReloadTime = 0 }
local rng = Random.new()

-- trigger / mode state
local holding = false
local pull = 0 -- os.clock() of an unconsumed trigger pull (semi/burst), 0 = none
local lastShot = 0
local burstLeft = 0
local modeIdx = 1
local modeFor = ""
local chargeEnd = 0 -- railgun charge-up in progress until this time
-- aim / recoil state
local adsWanted = false
local adsA = 0 -- 0 hip .. 1 fully aimed
local bloom = 0 -- extra spread degrees from spraying
local shotIdx = 0
local recoilP, recoilPV, recoilY, recoilYV = 0, 0, 0, 0 -- radians (camera offset, springs back to 0)
local baseFov = 70
local origSens = UserInputService.MouseDeltaSensitivity
local hitFlashUntil = 0
-- ui
local modeBtn: TextButton?
local cross: { Frame } = {}
local crossRoot: Frame? = nil
local scopeBars: { Frame } = {}
local scopeRoot: Frame? = nil

local function tool(): Tool?
	local c = player.Character
	local t = c and c:FindFirstChildOfClass("Tool")
	return if t and t:GetAttribute("Gun") then t else nil
end

local function muzzlePos(t: Tool?, char: Model?): Vector3?
	local h = t and t:FindFirstChild("Handle") :: BasePart?
	local att = h and h:FindFirstChild("Muzzle") :: Attachment?
	if att then
		return att.WorldPosition
	end
	local head = char and char:FindFirstChild("Head") :: BasePart?
	return head and head.Position
end
GunController.MuzzlePos = muzzlePos

local function ejectPos(t: Tool?, muzzle: Vector3): Vector3
	local h = t and t:FindFirstChild("Handle") :: BasePart?
	if not h then
		return muzzle
	end
	local att = h:FindFirstChild("Eject") :: Attachment?
	if att then
		return att.WorldPosition
	end
	return h.Position + (muzzle - h.Position) * 0.25 + Vector3.new(0, 0.25, 0)
end

local function currentMode(def): string
	return def.modes[math.clamp(modeIdx, 1, #def.modes)]
end

local function lowFx(): boolean
	return Effects.LowFx
end

function GunController.Reloading(): boolean
	return os.clock() < GunController.ReloadUntil
end

function GunController.Reload()
	if GunController.Reloading() or GunController.Mag >= GunController.MaxMag then
		return
	end
	GunController.ReloadUntil = os.clock() + GunController.ReloadTime
	burstLeft, pull, chargeEnd = 0, 0, 0
	Net.send("Reload")
	task.delay(GunController.ReloadTime, function()
		if os.clock() >= GunController.ReloadUntil - 0.01 then
			GunController.Mag = GunController.MaxMag
		end
	end)
end

local function cycleMode(def)
	if #def.modes <= 1 then
		return
	end
	modeIdx = modeIdx % #def.modes + 1
	burstLeft = 0
	Vfx.Sound(Sounds.Mech.Switch)
end

-- aim-assist target pick: nearest to the aim ray within `cone` degrees (or nearest in range without a ray)
local function pickTarget(root: BasePart, range: number, aimRay: Ray?, cone: number)
	local bestScore, kind, id, at, model = math.huge, nil, nil, nil, nil
	local function consider(p: Vector3, k: string, tid: number, m: Model?)
		local d = (p - root.Position).Magnitude
		if d > range then
			return
		end
		local score = d
		if aimRay then
			local to = (p - aimRay.Origin).Unit
			local ang = math.deg(math.acos(math.clamp(to:Dot(aimRay.Direction.Unit), -1, 1)))
			if ang > cone then
				return
			end
			score = ang * 4 + d * 0.1
		end
		if score < bestScore then
			bestScore, kind, id, at, model = score, k, tid, p, m
		end
	end
	local mid = player:GetAttribute("MatchId")
	if mid then
		for _, other in ipairs(Players:GetPlayers()) do
			if other ~= player and other:GetAttribute("MatchId") == mid and other:GetAttribute("Team") ~= player:GetAttribute("Team") then
				local r = other.Character and other.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
				local h = other.Character and other.Character:FindFirstChildOfClass("Humanoid")
				if r and h and h.Health > 0 then
					consider(r.Position, "p", other.UserId, other.Character)
				end
			end
		end
	else
		for _, m in ipairs(MonsterController.Alive()) do
			consider(MonsterController.Pos(m) + Vector3.new(0, MonsterController.Bob(m), 0), "m", m:GetAttribute("MonsterId"), m)
		end
	end
	return kind, id, at, model
end

-- current spread cone in degrees (hip -> ADS, + bloom, + movement / airborne)
local function spreadDeg(def, root: BasePart?): number
	local base = def.spread * (1 + (def.adsSpread - 1) * adsA) + bloom * (1 - adsA * 0.5)
	local speed = root and Vector3.new(root.AssemblyLinearVelocity.X, 0, root.AssemblyLinearVelocity.Z).Magnitude or 0
	local move = 1 + math.clamp(speed / 16, 0, 1.2) * 0.9 * (1 - adsA * 0.5)
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if hum and hum.FloorMaterial == Enum.Material.Air then
		move += 1.2
	end
	return base * move
end

local function randomCone(dir: Vector3, deg: number): Vector3
	local ang = math.rad(deg) * math.sqrt(rng:NextNumber())
	local az = rng:NextNumber(0, math.pi * 2)
	return (CFrame.lookAt(Vector3.zero, dir) * CFrame.Angles(0, 0, az) * CFrame.Angles(ang, 0, 0)).LookVector
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
-- travel end of a bullet that hit nothing: world point + (surface normal if it struck map geometry, not a creature)
local function trace(origin: Vector3, dir: Vector3, range: number): (Vector3, Vector3?)
	rayParams.FilterDescendantsInstances = { player.Character :: Instance }
	local r = Workspace:Raycast(origin, dir * range, rayParams)
	if not r then
		return origin + dir * range, nil
	end
	local m = r.Instance:FindFirstAncestorOfClass("Model")
	if m and (m:GetAttribute("MonsterId") or m:FindFirstChildOfClass("Humanoid")) then
		return r.Position, nil
	end
	return r.Position, r.Normal
end

local function doFire(t: Tool, def, typeId: string, root: BasePart, char: Model, mode: string)
	local aimRay = nil
	if not (GunController.Auto and not holding) and UserInputService.MouseEnabled and not UserInputService.TouchEnabled then
		local m = UserInputService:GetMouseLocation()
		aimRay = Workspace.CurrentCamera:ViewportPointToRay(m.X, m.Y)
	end
	local isPvp = player:GetAttribute("MatchId") ~= nil
	local range = if isPvp then def.range else (t:GetAttribute("Range") or def.range)
	local kind, id, at, model = pickTarget(root, range, aimRay, if adsA > 0.5 then 8 else 18)
	if not kind and not aimRay then
		return false -- touch / auto farm never wastes ammo
	end
	local from = muzzlePos(t, char)
	if not from then
		return false
	end
	local spread = spreadDeg(def, root)
	local multi = def.pellets > 1
	local color = Guns.Rarities[t:GetAttribute("Rarity") or 1].color

	-- decide: hit the picked target or miss (PC aims with the mouse; spread decides)
	local hit, headOff, shotDir = false, nil, nil
	if aimRay then
		shotDir = if multi then aimRay.Direction.Unit else randomCone(aimRay.Direction.Unit, spread)
		if kind then
			local toC = at - aimRay.Origin
			local dist = math.max(toC.Magnitude, 1)
			local ang = math.acos(math.clamp(toC.Unit:Dot(shotDir), -1, 1))
			local size = if model then (model:GetAttribute("Size") or 4) else 4
			local tol = math.atan(size * 0.5 / dist) + math.rad(2.5) + (if multi then math.rad(spread) * 0.7 else 0)
			hit = ang <= tol
			if hit and kind == "m" then
				local pt = aimRay.Origin + shotDir * toC:Dot(shotDir)
				headOff = math.clamp(pt.Y - at.Y, -size * 0.6, size * 0.6)
			end
		end
	else
		hit = kind ~= nil
	end

	lastShot = os.clock()
	GunController.Mag -= 1
	local aimPos: Vector3? = nil
	local aimNormal: Vector3? = nil
	if not hit then
		local o = aimRay and aimRay.Origin or from
		aimPos, aimNormal = trace(o, shotDir or (at :: Vector3 - o).Unit, range)
	end
	if hit then
		Net.send("Fire", kind, id, headOff, mode)
	else
		Net.send("Fire", "n", 0, nil, mode, aimPos)
	end

	-- visuals: flash, travel-time tracers, decals / sparks on arrival
	local look = (((if hit then at else aimPos) :: Vector3) - from).Unit
	local atPos: Vector3 = if hit then at :: Vector3 else aimPos :: Vector3
	Vfx.MuzzleFlash(from, color)
	if def.eject and not lowFx() then
		WeaponFx.SmokePuff(from + look * 0.3, look)
		local cam = Workspace.CurrentCamera
		WeaponFx.Shell(ejectPos(t, from), cam.CFrame.RightVector, rng)
	end
	local pellets = math.min(def.pellets, 5)
	for i = 1, pellets do
		local to: Vector3
		local normal: Vector3? = nil
		if hit then
			local sp = math.rad(def.spread) * (1 + (def.adsSpread - 1) * adsA)
			local jitter = if pellets == 1 then Vector3.zero
				else Vector3.new(rng:NextNumber(-sp, sp), rng:NextNumber(-sp, sp), rng:NextNumber(-sp, sp)) * (atPos - from).Magnitude * 0.5
			to = atPos + jitter
		elseif multi then
			to, normal = trace(from, randomCone(look, spread), range)
		else
			to, normal = atPos, aimNormal
		end
		Vfx.Bullet(from, to, color, function()
			if hit then
				Vfx.HitSpark(to, false)
			elseif normal then
				Vfx.HitSpark(to, false)
				WeaponFx.ImpactDecal(to, normal)
			end
		end, def.travel)
	end
	if hit then
		Vfx.HitFlash(model)
	end

	-- audio layers: shot (pitch varies in Vfx.Sound), mechanical bolt, distant tail
	Vfx.Sound(Sounds.Guns[def.sound or typeId], from)
	if def.eject then
		Vfx.Sound(Sounds.Mech.Bolt, from, { delay = 0.07 })
	end
	if def.tail then
		Vfx.Sound(Sounds.Tail, from, { delay = 0.1, volume = 0.6 })
	end

	-- recoil: vertical climb + random sideways (smaller while aimed), bloom, weapon kickback, camera shake
	shotIdx += 1
	local k = 1 + (def.adsRecoil - 1) * adsA
	recoilPV += math.rad(def.vKick) * 7 * k
	recoilYV += math.rad(def.hKick) * 7 * k * (rng:NextNumber(-1, 1) * 0.7 + math.sin(shotIdx * 1.7) * 0.3)
	bloom = math.min(def.bloomMax, bloom + def.bloom)
	WeaponAnim.Kick(def.recoil * 0.3 * k)
	Vfx.Shake(def.recoil * 0.02 * k, 0.05)
	if aimRay and not hit then
		return true
	end
	local flat = Vector3.new(atPos.X, root.Position.Y, atPos.Z)
	if (flat - root.Position).Magnitude > 1 then
		root.CFrame = CFrame.lookAt(root.Position, flat)
	end
	return true
end

local function step(dt: number)
	local now = os.clock()
	if now - lastShot > 0.12 then
		bloom = math.max(0, bloom - 6 * dt)
	end
	if now - lastShot > 0.45 then
		shotIdx = 0
	end
	local t = tool()
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not t or not root then
		burstLeft, chargeEnd = 0, 0
		return
	end
	local typeId = t:GetAttribute("Gun") :: string
	local def = Guns.Types[typeId]
	if not def then
		return
	end
	if modeFor ~= typeId then
		modeFor, modeIdx = typeId, 1
		burstLeft = 0
		WeaponAnim.Equip()
	end
	if GunController.Reloading() then
		return
	end

	-- railgun charge-up finishing
	if chargeEnd > 0 then
		if now < chargeEnd then
			return
		end
		chargeEnd = 0
		if GunController.Mag > 0 then
			doFire(t, def, typeId, root, char :: Model, currentMode(def))
			if GunController.Mag <= 0 then
				GunController.Reload()
			end
		end
		return
	end

	local mode = currentMode(def)
	if GunController.Auto and (holding == false) then
		pull = now -- auto farm = a trigger pull every opportunity
	end
	local triggered = holding or GunController.Auto
	local want: boolean
	if burstLeft > 0 then
		want = true
	elseif mode == "auto" then
		want = triggered
	else
		want = pull > 0 and now - pull < 0.25
	end
	if not want then
		return
	end

	local rate = if player:GetAttribute("MatchId") then def.rate else (t:GetAttribute("Rate") or def.rate)
	local interval = 1 / rate
	local need = interval
	if mode == "burst" then
		local fast = interval / Guns.Burst.RateMult
		need = if burstLeft > 0 then fast else def.burst * interval - (def.burst - 1) * fast
	end
	if def.charge then
		need = math.max(0, need - def.charge)
	end
	if now - lastShot < need then
		return
	end
	if GunController.Mag <= 0 then
		lastShot = now
		pull, burstLeft = 0, 0
		Vfx.Sound(Sounds.Empty)
		GunController.Reload()
		return
	end

	if def.charge then
		-- visual charge on the muzzle first, the shot goes out when it completes
		chargeEnd = now + def.charge
		pull = 0
		local color = Guns.Rarities[t:GetAttribute("Rarity") or 1].color
		Vfx.Sound(Sounds.Mech.Charge, nil, { pitch = 1 })
		WeaponFx.Charge(function()
			return muzzlePos(tool(), player.Character)
		end, color, def.charge)
		return
	end

	local fired = doFire(t, def, typeId, root, char :: Model, mode)
	if not fired then
		pull = 0
		burstLeft = 0
		return
	end
	if mode == "burst" then
		burstLeft = if burstLeft > 0 then burstLeft - 1 else def.burst - 1
	end
	if mode ~= "auto" then
		pull = 0
	end
	if GunController.Mag <= 0 then
		GunController.Reload()
	end
end

-- crosshair: 4 lines + dot, gap follows the live spread (breathes with movement, firing, ADS)
local function buildCrosshair(gui: Instance)
	-- own full-screen gui (no inset, no UI scale) so the reticle lines up with the mouse / screen centre
	local root = Instance.new("Frame")
	root.Name = "Crosshair"
	root.BackgroundTransparency = 1
	root.AnchorPoint = Vector2.new(0.5, 0.5)
	root.Size = UDim2.fromOffset(0, 0)
	root.Visible = false
	local lines = {}
	for i = 1, 4 do
		local f = Instance.new("Frame")
		f.BackgroundColor3 = Color3.new(1, 1, 1)
		f.BorderSizePixel = 0
		f.AnchorPoint = Vector2.new(0.5, 0.5)
		local st = Instance.new("UIStroke")
		st.Thickness = 1
		st.Color = Color3.new(0, 0, 0)
		st.Transparency = 0.4
		st.Parent = f
		f.Parent = root
		lines[i] = f
	end
	local dot = Instance.new("Frame")
	dot.BackgroundColor3 = Color3.new(1, 1, 1)
	dot.BorderSizePixel = 0
	dot.AnchorPoint = Vector2.new(0.5, 0.5)
	dot.Size = UDim2.fromOffset(3, 3)
	dot.Parent = root
	root.Parent = gui
	crossRoot = root
	cross = lines
end

-- scoped overlay (railgun ADS): black bars around a clear centre square + thin reticle lines
local function buildScope(gui: Instance)
	local f = Instance.new("Frame")
	f.Name = "Scope"
	f.BackgroundTransparency = 1
	f.Size = UDim2.fromScale(1, 1)
	f.Visible = false
	for i = 1, 6 do -- 1-4 black bars (L R T B), 5-6 reticle lines
		local b = Instance.new("Frame")
		b.BackgroundColor3 = if i <= 4 then Color3.new(0, 0, 0) else Color3.fromRGB(20, 20, 24)
		b.BorderSizePixel = 0
		b.Parent = f
		scopeBars[i] = b
	end
	f.Parent = gui
	scopeRoot = f
end

local function updateScope(on: boolean, vp: Vector2)
	if not scopeRoot then
		return
	end
	scopeRoot.Visible = on
	if not on then
		return
	end
	local s = math.min(vp.X, vp.Y) * 0.9
	local sx, sy = (vp.X - s) / 2, (vp.Y - s) / 2
	local b = scopeBars
	b[1].Position, b[1].Size = UDim2.fromOffset(0, 0), UDim2.fromOffset(sx, vp.Y)
	b[2].Position, b[2].Size = UDim2.fromOffset(vp.X - sx, 0), UDim2.fromOffset(sx, vp.Y)
	b[3].Position, b[3].Size = UDim2.fromOffset(sx, 0), UDim2.fromOffset(s, sy)
	b[4].Position, b[4].Size = UDim2.fromOffset(sx, vp.Y - sy), UDim2.fromOffset(s, sy)
	b[5].Position, b[5].Size = UDim2.fromOffset(sx, vp.Y / 2 - 1), UDim2.fromOffset(s, 2)
	b[6].Position, b[6].Size = UDim2.fromOffset(vp.X / 2 - 1, sy), UDim2.fromOffset(2, s)
end

local function renderStep(dt: number)
	local cam = Workspace.CurrentCamera
	local t = tool()
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local def = t and Guns.Types[t:GetAttribute("Gun") :: string]

	-- ADS blend (cancelled while reloading)
	local wantAds = t ~= nil and adsWanted and not GunController.Reloading() and def ~= nil
	adsA += ((if wantAds then 1 else 0) - adsA) * math.clamp(dt * 14, 0, 1)
	if math.abs(adsA - (if wantAds then 1 else 0)) < 0.003 then
		adsA = if wantAds then 1 else 0
	end

	if def and adsA > 0 then
		cam.FieldOfView = baseFov + (def.fov - baseFov) * adsA
		UserInputService.MouseDeltaSensitivity = origSens * (1 - 0.5 * adsA * (1 - def.fov / 70))
	else
		local wantFov = if player:GetAttribute("Sprinting") then 80 else 70
		baseFov = cam.FieldOfView + (wantFov - cam.FieldOfView) * math.clamp(dt * 8, 0, 1)
		cam.FieldOfView = baseFov
		UserInputService.MouseDeltaSensitivity = origSens
	end

	-- speed = server BaseSpeed attribute * sprint * ADS (single owner; no read-modify-write of WalkSpeed)
	local baseSpd = hum and hum:GetAttribute("BaseSpeed")
	if hum and type(baseSpd) == "number" then
		local want = baseSpd * (if player:GetAttribute("Sprinting") then 1.4 else 1) * (if def and adsA > 0.5 then def.adsSpeed else 1)
		if math.abs(hum.WalkSpeed - want) > 0.01 then
			hum.WalkSpeed = want
		end
	end

	-- recoil springs (camera offset), applied after the camera script so it recovers on its own
	local ks, cs = 70, 11
	recoilPV += (-ks * recoilP - cs * recoilPV) * dt
	recoilYV += (-ks * recoilY - cs * recoilYV) * dt
	recoilP += recoilPV * dt
	recoilY += recoilYV * dt
	if math.abs(recoilP) > 1e-4 or math.abs(recoilY) > 1e-4 then
		cam.CFrame = cam.CFrame * CFrame.Angles(recoilP, recoilY, 0)
	end

	-- weapon animation
	local speed = root and Vector3.new(root.AssemblyLinearVelocity.X, 0, root.AssemblyLinearVelocity.Z).Magnitude or 0
	local reload: number? = nil
	if GunController.Reloading() and GunController.ReloadTime > 0 then
		reload = math.clamp(1 - (GunController.ReloadUntil - os.clock()) / GunController.ReloadTime, 0, 1)
	end
	WeaponAnim.Update(dt, { ads = adsA, speed = speed, reload = reload, bloom = bloom })
	local ph = WeaponAnim.PollPhase()
	if ph == 1 then
		Vfx.Sound(Sounds.Mech.MagOut)
	elseif ph == 2 then
		Vfx.Sound(Sounds.Mech.MagIn)
	elseif ph == 3 then
		Vfx.Sound(Sounds.Mech.Bolt)
	end

	-- crosshair
	if crossRoot then
		local show = def ~= nil and not (def.scope and adsA > 0.6)
		crossRoot.Visible = show
		if show and def then
			local vp = cam.ViewportSize
			local pos = if UserInputService.MouseEnabled and not UserInputService.TouchEnabled
				then UserInputService:GetMouseLocation() else Vector2.new(vp.X / 2, vp.Y / 2)
			crossRoot.Position = UDim2.fromOffset(pos.X, pos.Y)
			local deg = spreadDeg(def, root)
			local gap = math.tan(math.rad(deg)) / math.tan(math.rad(cam.FieldOfView / 2)) * (vp.Y / 2)
			gap = math.clamp(gap, 3, 120)
			local len = 9 - adsA * 3
			local col = if os.clock() < hitFlashUntil then Color3.fromRGB(255, 80, 80) else Color3.new(1, 1, 1)
			for i, f in ipairs(cross) do
				f.BackgroundColor3 = col
				local horiz = i <= 2
				local sgn = if i % 2 == 1 then -1 else 1
				f.Size = if horiz then UDim2.fromOffset(len, 2) else UDim2.fromOffset(2, len)
				f.Position = if horiz then UDim2.fromOffset(sgn * (gap + len / 2), 0) else UDim2.fromOffset(0, sgn * (gap + len / 2))
			end
		end
	end
	updateScope(def ~= nil and def.scope == true and adsA > 0.6, cam.ViewportSize)
	if modeBtn then
		modeBtn.Visible = def ~= nil
		if def then
			local m = currentMode(def)
			local label = modeBtn:FindFirstChild("Label") :: TextLabel?
			if label then
				label.Text = (if UserInputService.TouchEnabled then "%s" else "%s [B]"):format(string.upper(m))
			end
		end
	end
end

function GunController.Init()
	local gui = UIController.Gui()
	local aimGui = Instance.new("ScreenGui")
	aimGui.Name = "GunAimGui"
	aimGui.ResetOnSpawn = false
	aimGui.IgnoreGuiInset = true
	aimGui.DisplayOrder = 5
	buildCrosshair(aimGui)
	buildScope(aimGui)
	aimGui.Parent = player:WaitForChild("PlayerGui")
	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			holding = true
			pull = os.clock()
		elseif input.UserInputType == Enum.UserInputType.MouseButton2 then
			adsWanted = true
		elseif input.KeyCode == Enum.KeyCode.R then
			GunController.Reload()
		elseif input.KeyCode == Enum.KeyCode.B then
			local t = tool()
			local def = t and Guns.Types[t:GetAttribute("Gun") :: string]
			if def then
				cycleMode(def)
			end
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			holding = false
		elseif input.UserInputType == Enum.UserInputType.MouseButton2 then
			adsWanted = false
		end
	end)
	local touch = UserInputService.TouchEnabled
	local fire = UI.button("FIRE", Theme.Colors.Danger, function() end, {
		AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -176, 1, -150), Size = UDim2.fromOffset(110, 110), Visible = touch, Parent = gui })
	UI.corner(UDim.new(1, 0)).Parent = fire
	fire.MouseButton1Down:Connect(function()
		holding = true
		pull = os.clock()
	end)
	fire.MouseButton1Up:Connect(function()
		holding = false
	end)
	fire.MouseLeave:Connect(function()
		holding = false
	end)
	local reloadBtn = UI.button("R", Theme.Colors.PanelLight, GunController.Reload, {
		AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -296, 1, -160), Size = UDim2.fromOffset(64, 64), Visible = touch, Parent = gui })
	UI.corner(UDim.new(1, 0)).Parent = reloadBtn
	-- mobile ADS toggle (above FIRE)
	local adsBtn = UI.button("ADS", Theme.Colors.PanelLight, function()
		adsWanted = not adsWanted
	end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -176, 1, -268), Size = UDim2.fromOffset(70, 70), Visible = touch, Parent = gui })
	UI.corner(UDim.new(1, 0)).Parent = adsBtn
	-- fire mode button: next to FIRE on touch, above AUTO on PC (also key B)
	local mb: any = UI.button("SEMI", Theme.Colors.PanelLight, function()
		local t = tool()
		local def = t and Guns.Types[t:GetAttribute("Gun") :: string]
		if def then
			cycleMode(def)
		end
	end, { AnchorPoint = Vector2.new(1, 1), Position = if touch then UDim2.new(1, -296, 1, -232) else UDim2.new(1, -16, 1, -210),
		Size = if touch then UDim2.fromOffset(64, 40) else UDim2.fromOffset(150, 34), Visible = false, Parent = gui })
	mb.Label.TextSize = 16
	modeBtn = mb
	local auto
	auto = UI.button("AUTO: OFF", Theme.Colors.PanelLight, function()
		local passes = UIController.State.passes or {}
		if not table.find(passes, "AutoFarm") then
			UIController.Toast("Auto Farm pass required — see SHOP", "info")
			UIController.Open("Shop")
			return
		end
		GunController.Auto = not GunController.Auto
		auto.Label.Text = if GunController.Auto then "AUTO: ON" else "AUTO: OFF"
	end, { AnchorPoint = Vector2.new(1, 1), Position = if touch then UDim2.new(1, -140, 1, -86) else UDim2.new(1, -16, 1, -86), Size = UDim2.fromOffset(150, 50), Parent = gui })
	auto.Label.TextSize = 18

	Net.listen("Ammo", function(mag: number, max: number, reload: number)
		GunController.MaxMag = max
		if reload > 0 then
			if not GunController.Reloading() then
				GunController.ReloadUntil = os.clock() + reload
				task.delay(reload, function()
					GunController.Mag = max
				end)
			end
			GunController.ReloadTime = reload
		else
			GunController.Mag = mag
			GunController.ReloadUntil = 0
			local t = tool()
			local def = t and Guns.Types[t:GetAttribute("Gun") :: string]
			GunController.ReloadTime = def and def.reload or 1.5
		end
	end)
	Net.listen("Hit", function(_pos: Vector3, _dmg: number, crit: boolean)
		hitFlashUntil = os.clock() + (if crit then 0.25 else 0.1)
	end)
	-- other players' shots: flash + tracer with travel time, shot sound, distant tail for far shots
	Net.listen("Shot", function(shooter: Player, to: Vector3)
		local char = shooter.Character
		local t = char and char:FindFirstChildOfClass("Tool")
		local from = muzzlePos(t, char)
		local camPos = Workspace.CurrentCamera.CFrame.Position
		if from and (from - camPos).Magnitude < 150 then
			local color = Guns.Rarities[(t and t:GetAttribute("Rarity")) or 1].color
			local def = t and Guns.Types[t:GetAttribute("Gun") :: string]
			Vfx.MuzzleFlash(from, color)
			Vfx.Bullet(from, to, color, nil, def and def.travel)
			if def then
				local dist = (from - camPos).Magnitude
				Vfx.Sound(Sounds.Guns[def.sound], from, { volume = 0.8 })
				if def.tail and dist > Sounds.Tail.minDist then
					Vfx.Sound(Sounds.Tail, from, { delay = dist / 100 * Sounds.Tail.delayPer100 })
				end
			end
		end
	end)
	RunService.Heartbeat:Connect(step)
	RunService:BindToRenderStep("GunRecoilAnim", Enum.RenderPriority.Camera.Value + 1, renderStep)
end

return GunController
