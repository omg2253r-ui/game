-- Guns: gives the equipped gun as a Tool, validates every shot server-side (rate, range, target),
-- applies PvE damage (Power-scaled) or PvP damage (normalized, via ArenaService), relays tracers.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Guns = require(Shared.Config.Guns)
local Combat = require(Shared.Config.Combat)
local Net = require(Shared.Net)

local GunService = {}
local S
local lastShot: { [Player]: number } = {}
local burst: { [Player]: number } = {} -- shots fired in the current burst
local ammo: { [Player]: { mag: number, max: number, reloadUntil: number, reload: number } } = {}
local rng = Random.new()

local function resetAmmo(player: Player, typeId: string)
	local t = Guns.Types[typeId]
	ammo[player] = { mag = t.mag, max = t.mag, reloadUntil = 0, reload = t.reload }
	burst[player] = 0
	Net.fire(player, "Ammo", t.mag, t.mag, 0)
end

local function startReload(player: Player)
	local a = ammo[player]
	if not a or os.clock() < a.reloadUntil or a.mag >= a.max then
		return
	end
	a.reloadUntil = os.clock() + a.reload - 0.15 -- small slack for latency
	Net.fire(player, "Ammo", 0, a.max, a.reload)
	task.delay(a.reload - 0.15, function()
		if ammo[player] == a and a.reloadUntil > 0 then
			a.mag, a.reloadUntil = a.max, 0
		end
	end)
end
local lastRelay: { [Player]: number } = {}

-- effective stats incl. enchant (PvE); PvP uses base type stats
local function ench(item, kind: string): number
	return if item.ench and item.ench.kind == kind then item.ench.val else 0
end
function GunService.Rate(item): number
	return Guns.Types[item.id].rate * (1 + ench(item, "rate"))
end
function GunService.Range(item): number
	return Guns.Types[item.id].range * (1 + ench(item, "range"))
end

local function buildHandle(item): BasePart
	local assets = ReplicatedStorage:FindFirstChild("Assets")
	local folder = assets and assets:FindFirstChild("Guns")
	-- per-rarity model (<type>_r<N>) first, then the generic <type> model, else code-built fallback
	local src = folder and (folder:FindFirstChild(item.id .. "_r" .. item.rarity) or folder:FindFirstChild(item.id))
	local rarityColor = Guns.Rarities[item.rarity].color
	if src and src:IsA("BasePart") then
		local h = src:Clone()
		h.Name = "Handle"
		return h
	end
	-- code-built fallback: body + barrel + glowing rarity strip, welded to Handle
	local t = Guns.Types[item.id]
	local len = 1.6 + t.range / 60
	local h = Instance.new("Part")
	h.Name = "Handle"
	h.Size = Vector3.new(0.45, 0.9, len * 0.55)
	h.Color = t.color
	h.Material = Enum.Material.SmoothPlastic
	local function add(size: Vector3, offset: CFrame, color: Color3, mat: Enum.Material): Part
		local p = Instance.new("Part")
		p.Size = size
		p.Color = color
		p.Material = mat
		p.CanCollide, p.CanQuery, p.CanTouch, p.Massless = false, false, false, true
		p.CFrame = h.CFrame * offset
		local w = Instance.new("WeldConstraint")
		w.Part0, w.Part1 = h, p
		w.Parent = p
		p.Parent = h
		return p
	end
	add(Vector3.new(0.35, 0.35, len), CFrame.new(0, 0.45, -len * 0.35), t.color:Lerp(Color3.new(0, 0, 0), 0.3), Enum.Material.Metal)
	add(Vector3.new(0.5, 0.12, len * 0.7), CFrame.new(0, 0.7, -len * 0.2), rarityColor, Enum.Material.Neon)
	-- named moving parts (WeaponAnim cycles the slide and drops/reinserts the magazine on the client)
	add(Vector3.new(0.4, 0.3, len * 0.4), CFrame.new(0, 0.2, -len * 0.05), t.color:Lerp(Color3.new(1, 1, 1), 0.15), Enum.Material.Metal).Name = "Slide"
	add(Vector3.new(0.34, 0.7, 0.4), CFrame.new(0, -0.55, len * 0.12), Color3.fromRGB(40, 40, 46), Enum.Material.Metal).Name = "Magazine"
	local eject = Instance.new("Attachment")
	eject.Name = "Eject"
	eject.Position = Vector3.new(0.2, 0.55, -len * 0.1)
	eject.Parent = h
	local muzzle = Instance.new("Attachment")
	muzzle.Name = "Muzzle"
	muzzle.Position = Vector3.new(0, 0.45, -len * 0.85 - 0.2)
	muzzle.Parent = h
	return h
end

function GunService.GiveGun(player: Player)
	local item = S.InventoryService.EquippedGun(player)
	local backpack = player:FindFirstChildOfClass("Backpack")
	local char = player.Character
	if not item or not backpack then
		return
	end
	for _, container in ipairs({ backpack, char }) do
		if container then
			for _, tool in ipairs(container:GetChildren()) do
				if tool:IsA("Tool") and tool:GetAttribute("Gun") then
					tool:Destroy()
				end
			end
		end
	end
	local tool = Instance.new("Tool")
	tool.Name = Guns.Rarities[item.rarity].name .. " " .. Guns.Types[item.id].name
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	tool.GripPos = Vector3.new(0, -0.2, 0.3)
	tool:SetAttribute("Gun", item.id)
	tool:SetAttribute("Rarity", item.rarity)
	tool:SetAttribute("Rate", GunService.Rate(item))
	tool:SetAttribute("Range", GunService.Range(item))
	tool:SetAttribute("Level", item.lvl or 0)
	buildHandle(item).Parent = tool
	tool.Parent = backpack
	resetAmmo(player, item.id)
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum then
		hum:EquipTool(tool) -- AFK friendly: always holding the gun
	end
end

local function hrp(player: Player): BasePart?
	local c = player.Character
	return c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function relay(player: Player, toPos: Vector3)
	local t = os.clock()
	if t - (lastRelay[player] or 0) < 0.3 then
		return
	end
	lastRelay[player] = t
	for _, other in ipairs(Players:GetPlayers()) do
		if other ~= player then
			Net.fire(other, "Shot", player, toPos)
		end
	end
end

-- Fire: kind "m" monster id | "p" player userId | "n" no target (miss, consumes ammo, tracer only)
-- headOff = aim point height relative to the monster centre (clamped here), mode = fire mode (checked against the gun)
local function onFire(player: Player, kind, targetId, headOff, mode, aimPos)
	local item = S.InventoryService.EquippedGun(player)
	local root = hrp(player)
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if not item or not root or not hum or hum.Health <= 0 or type(targetId) ~= "number" then
		return
	end
	local t = Guns.Types[item.id]
	local now = os.clock()
	local inArena = S.PlayerService.InArena(player)
	local rate = if inArena then t.rate else GunService.Rate(item)
	-- fire mode: unknown/unsupported modes fall back to the gun's default. Burst fires N shots fast, then waits so
	-- the average stays at `rate`, so no mode out-damages another
	if type(mode) ~= "string" or not table.find(t.modes, mode) then
		mode = t.modes[1]
	end
	local interval = 1 / rate
	local gap = now - (lastShot[player] or 0)
	local n = burst[player] or 0
	local need = interval
	local inBurst = false
	if mode == "burst" then
		local fast = interval / Guns.Burst.RateMult
		inBurst = n > 0 and n < t.burst and gap < interval
		need = if inBurst then fast else t.burst * interval - (t.burst - 1) * fast
	end
	if gap < need * Combat.FireTolerance then
		return
	end
	local a = ammo[player]
	if not a or now < a.reloadUntil then
		return
	end
	if a.reloadUntil > 0 then -- reload finished but the delay callback has not run yet
		a.mag, a.reloadUntil = a.max, 0
	end
	if a.mag <= 0 then
		startReload(player)
		return
	end
	lastShot[player] = now
	burst[player] = if inBurst then n + 1 else 1
	a.mag -= 1
	if a.mag <= 0 then
		startReload(player)
	end

	if kind == "n" then
		if typeof(aimPos) == "Vector3" and aimPos == aimPos then
			local off = aimPos - root.Position
			if off.Magnitude > 1 then
				relay(player, root.Position + off.Unit * math.min(off.Magnitude, GunService.Range(item)))
			end
		end
	elseif kind == "m" then
		if S.PlayerService.InArena(player) then
			return
		end
		local rec = S.MonsterService.Get(targetId)
		if not rec then
			return
		end
		local pos = S.MonsterService.Position(rec)
		if (pos - root.Position).Magnitude > GunService.Range(item) + rec.def.size + 6 then
			return
		end
		local dist = (pos - root.Position).Magnitude
		-- weak point: the aim point must lie in the top HeadFraction of the monster (offset clamped; never raw damage)
		local size = rec.def.size
		local head = false
		if type(headOff) == "number" and headOff == headOff then
			local off = math.clamp(headOff, -size * 0.6, size * 0.6)
			head = off >= size * (0.5 - Guns.HeadFraction) and off <= size * 0.55
		end
		local crit = head or rng:NextNumber() < t.crit + ench(item, "crit")
		local mastery = 1 + (item.lvl or 0) * Guns.Mastery.DamagePerLevel
		local dmg = item.dmg * Guns.PowerFactor(S.PlayerService.GetPower(player)) * Guns.Falloff(item.id, dist * (1 - ench(item, "range")))
			* mastery * (1 + ench(item, "dmg"))
		if crit then
			dmg *= Guns.CritMultiplier
		end
		local wasBoss = rec.def.boss
		S.MonsterService.Damage(targetId, player, dmg)
		Net.fire(player, "Hit", pos, math.floor(dmg), crit)
		if not S.MonsterService.Get(targetId) then -- this shot killed it: gun mastery xp
			GunService.AddMastery(player, if wasBoss then Guns.Mastery.BossXp else 1)
		end
		relay(player, pos)
	elseif kind == "p" then
		local target = Players:GetPlayerByUserId(targetId)
		local troot = target and hrp(target)
		if not troot or (troot.Position - root.Position).Magnitude > t.range + 4 then
			return
		end
		local dist = (troot.Position - root.Position).Magnitude
		local dmg = t.dmg * t.pellets * (1 + Guns.PvP.RarityBonus * (item.rarity - 1)) * Guns.PvP.DamageScale * Guns.Falloff(item.id, dist)
		if S.ArenaService.Damage(player, target :: Player, dmg) then
			Net.fire(player, "Hit", troot.Position, math.floor(dmg), false)
			relay(player, troot.Position)
		end
	end
end

function GunService.AddMastery(player: Player, xp: number)
	local d = S.DataService.Get(player)
	local item = d and d.items[d.equipped.gun]
	if not item or (item.lvl or 0) >= Guns.Mastery.MaxLevel then
		return
	end
	local leveled = false
	S.DataService.Update(player, function()
		item.xp = (item.xp or 0) + xp
		item.lvl = item.lvl or 0
		while item.lvl < Guns.Mastery.MaxLevel and item.xp >= Guns.MasteryXpNeeded(item.lvl) do
			item.xp -= Guns.MasteryXpNeeded(item.lvl)
			item.lvl += 1
			leveled = true
		end
	end)
	if leveled then
		S.EconomyService.Toast(player, ("%s reached MASTERY Lv %d! (+%d%% dmg)"):format(Guns.Types[item.id].name, item.lvl,
			math.floor(item.lvl * Guns.Mastery.DamagePerLevel * 100)), "success")
		S.InventoryService.SyncSoon(player)
		local tool = player.Character and player.Character:FindFirstChildOfClass("Tool")
		if tool then
			tool:SetAttribute("Level", item.lvl)
		end
	end
end

function GunService.Init(services)
	S = services
	Net.declare("Shot")
	Net.declare("Hit")
	Net.declare("Ammo")
	Net.on("Fire", onFire, 20)
	Net.on("Reload", startReload, 2)

	S.InventoryService.GearChanged:Connect(function(player, slot)
		if slot == "gun" then
			GunService.GiveGun(player)
		end
	end)
	local function hook(player: Player)
		player.CharacterAdded:Connect(function(char)
			char:WaitForChild("Humanoid", 5)
			task.wait(0.2)
			GunService.GiveGun(player)
		end)
	end
	Players.PlayerAdded:Connect(hook)
	for _, p in ipairs(Players:GetPlayers()) do
		hook(p)
	end
	Players.PlayerRemoving:Connect(function(p)
		lastShot[p] = nil
		lastRelay[p] = nil
		ammo[p] = nil
		burst[p] = nil
	end)
end

return GunService
