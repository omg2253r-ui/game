-- Server-simulated monsters (cheap): HP + logical position live on the server; models are anchored
-- and moved by the CLIENT from segment attributes (From/To/T0/Dur). Server never moves parts per frame.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Zones = require(Shared.Config.Zones)
local Monsters = require(Shared.Config.Monsters)
local Combat = require(Shared.Config.Combat)
local Net = require(Shared.Net)

local MonsterService = {}
local S
local rng = Random.new()
local folder: Folder
local nextId = 0
local recs: { [number]: any } = {}
local zoneCount: { [string]: number } = {}
local bossAlive: { [string]: boolean } = {}

local function now()
	return Workspace:GetServerTimeNow()
end

function MonsterService.Position(rec): Vector3
	if rec.dur <= 0 then
		return rec.to
	end
	local a = math.clamp((now() - rec.t0) / rec.dur, 0, 1)
	return rec.from:Lerp(rec.to, a)
end

function MonsterService.Get(id: number)
	return recs[id]
end

function MonsterService.InZone(zone, pos: Vector3): boolean
	local c, s = zone.center, zone.size
	return math.abs(pos.X - c.X) <= s.X / 2 and math.abs(pos.Z - c.Z) <= s.Z / 2
end

local function setSegment(rec, to: Vector3, dur: number)
	rec.from = MonsterService.Position(rec)
	rec.to = to
	rec.t0 = now()
	rec.dur = dur
	local m = rec.model
	m:SetAttribute("From", rec.from)
	m:SetAttribute("To", to)
	m:SetAttribute("T0", rec.t0)
	m:SetAttribute("Dur", dur)
end

local function buildModel(defId: string, def, size: number): Model
	local assets = ReplicatedStorage:FindFirstChild("Assets")
	local src = assets and assets:FindFirstChild("Monsters") and assets.Monsters:FindFirstChild(defId)
	local m: Model
	if src and src:IsA("Model") then
		m = src:Clone()
		local _, ext = m:GetBoundingBox()
		if ext.Y > 0 then
			m:ScaleTo(size / ext.Y)
		end
	else
		m = Instance.new("Model")
		local body = Instance.new("Part")
		body.Name = "Body"
		body.Shape = Enum.PartType.Ball
		body.Size = Vector3.one * size
		body.Color = def.color
		body.Material = Enum.Material.SmoothPlastic
		body.Parent = m
		for sx = -1, 1, 2 do
			local eye = Instance.new("Part")
			eye.Shape = Enum.PartType.Ball
			eye.Size = Vector3.one * size * 0.22
			eye.Color = Color3.new(0.05, 0.05, 0.08)
			eye.CFrame = CFrame.new(sx * size * 0.2, size * 0.12, -size * 0.42)
			eye.Parent = m
		end
		if def.boss then
			local crown = Instance.new("Part")
			crown.Size = Vector3.new(size * 0.5, size * 0.2, size * 0.5)
			crown.Color = Color3.fromRGB(255, 201, 53)
			crown.Material = Enum.Material.Neon
			crown.CFrame = CFrame.new(0, size * 0.55, 0)
			crown.Parent = m
		end
		m.PrimaryPart = body
	end
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then
			p.Anchored = true
			p.CanCollide = false
			p.CanTouch = false
			p.CanQuery = true -- mouse targeting
			p.CastShadow = def.boss == true
		end
	end
	m.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	return m
end

-- opts: { zone, static, onDeath(rec), name, hpOverride, def, raidId (only players with attribute RaidId==raidId are targeted) }
function MonsterService.Spawn(defId: string, pos: Vector3, opts)
	opts = opts or {}
	local def = opts.def or Monsters[defId]
	nextId += 1
	local id = nextId
	local hp = opts.hpOverride or def.hp
	local m = buildModel(defId, def, def.size)
	m.Name = "M" .. id
	local y = def.size / 2
	local start = Vector3.new(pos.X, y, pos.Z)
	m:PivotTo(CFrame.new(start))
	m:SetAttribute("MonsterId", id)
	m:SetAttribute("Name", opts.name or def.name)
	m:SetAttribute("HP", hp)
	m:SetAttribute("MaxHP", hp)
	m:SetAttribute("Boss", def.boss == true)
	m:SetAttribute("Size", def.size)
	local rec = { id = id, defId = defId, def = def, zone = opts.zone, model = m, hp = hp, maxHp = hp, y = y,
		from = start, to = start, t0 = now(), dur = 0, lastAttack = 0, contrib = {}, static = opts.static, onDeath = opts.onDeath, wanderAt = 0, raidId = opts.raidId }
	setSegment(rec, start, 0)
	m.Parent = folder
	recs[id] = rec
	return rec
end

local function rollDrops(def, mult: number)
	local out = {}
	for _, d in ipairs(def.drops) do
		local mat, chance, lo, hi = d[1], d[2], d[3], d[4]
		if rng:NextNumber() < math.min(1, chance) then
			local raw = rng:NextInteger(lo, hi) * mult
			local n = math.floor(raw) + (if rng:NextNumber() < raw % 1 then 1 else 0)
			if n > 0 then
				out[mat] = (out[mat] or 0) + n
			end
		end
	end
	return out
end

local function reward(rec, player: Player, pos: Vector3)
	local def = rec.def
	local coins = S.EconomyService.Add(player, "Coins", math.max(1, math.floor(def.coins * S.PlayerService.CoinBonus(player))), "kill", true)
	local power = math.floor(def.power * S.PlayerService.TrainMultiplier(player))
	S.PlayerService.AddPower(player, power)
	local mats = rollDrops(def, S.PlayerService.DropMultiplier(player))
	for mat, n in pairs(mats) do
		S.InventoryService.AddMaterial(player, mat, n)
	end
	S.QuestService.Progress(player, "Kills", 1)
	S.QuestService.Progress(player, "Earn", coins)
	if def.boss then
		S.QuestService.Progress(player, "BossKills", 1)
	end
	S.DataService.Update(player, function(d)
		d.index.monsters[rec.defId] = true
	end)
	S.ClanService.AddXp(player, if def.boss then 20 else 1)
	Net.fire(player, "Loot", pos, { coins = coins, power = power, mats = mats })
end

local function kill(rec)
	recs[rec.id] = nil
	local pos = MonsterService.Position(rec)
	rec.model:SetAttribute("HP", 0)
	if rec.onDeath then
		task.spawn(rec.onDeath, rec, pos)
	else
		local top, topDmg = nil, 0
		for p, dmg in pairs(rec.contrib) do
			if dmg > topDmg then
				top, topDmg = p, dmg
			end
		end
		for p, dmg in pairs(rec.contrib) do -- shared loot: anyone with >= 10% damage (no kill stealing)
			if p.Parent and (p == top or dmg >= rec.maxHp * 0.1) then
				reward(rec, p, pos)
			end
		end
	end
	task.delay(0.05, function()
		rec.model:Destroy()
	end)
	local zone = rec.zone
	if zone then
		if rec.def.boss then
			task.delay(rec.def.respawn, function()
				bossAlive[zone.id] = false
			end)
		else
			zoneCount[zone.id] -= 1
		end
	end
end

function MonsterService.Remove(id: number)
	local rec = recs[id]
	if rec then
		recs[id] = nil
		rec.model:Destroy()
	end
end

function MonsterService.Damage(id: number, player: Player, dmg: number): boolean
	local rec = recs[id]
	if not rec or rec.hp <= 0 then
		return false
	end
	rec.hp -= dmg
	rec.contrib[player] = (rec.contrib[player] or 0) + dmg
	rec.aggro = player
	rec.model:SetAttribute("HP", math.max(0, math.floor(rec.hp)))
	if rec.hp <= 0 then
		kill(rec)
	end
	return true
end

-- along the lane: keep the first 35 studs after the gate and the boss end (last 45) clear
local function randomPoint(zone, margin: number): Vector3
	local c, s = zone.center, zone.size
	local x = c.X + rng:NextNumber(-s.X / 2 + margin, s.X / 2 - margin)
	local z = c.Z + rng:NextNumber(-s.Z / 2 + 45, s.Z / 2 - 35)
	return Vector3.new(x, 0, z)
end

local function clampToZone(zone, p: Vector3, y: number): Vector3
	local c, s = zone.center, zone.size
	return Vector3.new(math.clamp(p.X, c.X - s.X / 2 + 4, c.X + s.X / 2 - 4), y, math.clamp(p.Z, c.Z - s.Z / 2 + 4, c.Z + s.Z / 2 - 4))
end

local function spawnTick()
	for _, zone in ipairs(Zones) do
		zoneCount[zone.id] = zoneCount[zone.id] or 0
		local n = 0
		while zoneCount[zone.id] < zone.maxAlive and n < 3 do -- max 3 per tick per zone (smooth)
			n += 1
			zoneCount[zone.id] += 1
			MonsterService.Spawn(zone.monsters[rng:NextInteger(1, #zone.monsters)], randomPoint(zone, 6), { zone = zone })
		end
		if not bossAlive[zone.id] then
			bossAlive[zone.id] = true
			MonsterService.Spawn(zone.boss, zone.bossPos or zone.center, { zone = zone })
		end
	end
end

local function hrpOf(p: Player): BasePart?
	local char = p.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum or hum.Health <= 0 then
		return nil
	end
	return char:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function aiTick()
	local t = now()
	local players = Players:GetPlayers()
	for _, rec in pairs(recs) do
		local pos = MonsterService.Position(rec)
		local def = rec.def
		local reach = Combat.MonsterAttackRange + def.size / 2
		-- pick target: last attacker if close, else nearest player in range
		local target, best = nil, if rec.raidId then 400 else Combat.MonsterAggroRange + def.size
		for _, p in ipairs(players) do
			local hrp = hrpOf(p)
			if hrp and not S.PlayerService.InArena(p) and (if rec.raidId then p:GetAttribute("RaidId") == rec.raidId else (not rec.zone or MonsterService.InZone(rec.zone, hrp.Position))) then
				local dist = (hrp.Position - pos).Magnitude
				if p == rec.aggro and dist < best * 2 then
					target, best = hrp, -1
				elseif dist < best then
					target, best = hrp, dist
				end
			end
		end
		if target then
			local tp = target.Position
			local flat = Vector3.new(tp.X, rec.y, tp.Z)
			local dist = (flat - pos).Magnitude
			if dist <= reach then
				if os.clock() - rec.lastAttack >= Combat.MonsterAttackCooldown then
					rec.lastAttack = os.clock()
					-- telegraph: clients play a wind-up + lunge from this attribute, damage lands after it
					rec.model:SetAttribute("Atk", now())
					local victim = target
					task.delay(0.35, function()
						if not recs[rec.id] or not victim.Parent then
							return
						end
						if (victim.Position - MonsterService.Position(rec)).Magnitude <= reach * 1.4 then
							local hum = (victim.Parent :: Model):FindFirstChildOfClass("Humanoid")
							if hum then
								hum:TakeDamage(def.damage * Combat.MonsterDamageScale)
							end
						end
					end)
				end
			elseif not rec.static and (t >= rec.t0 + rec.dur or (rec.to - flat).Magnitude > 6) then
				local goal = pos + (flat - pos).Unit * math.min(def.speed, dist - reach * 0.7)
				if rec.zone then
					goal = clampToZone(rec.zone, goal, rec.y)
				end
				setSegment(rec, goal, math.max(0.2, (goal - pos).Magnitude / def.speed))
			end
		elseif not rec.static and rec.zone and t >= rec.t0 + rec.dur and os.clock() >= rec.wanderAt then
			rec.aggro = nil
			rec.wanderAt = os.clock() + rng:NextNumber(2, 5)
			local goal = clampToZone(rec.zone, pos + Vector3.new(rng:NextNumber(-12, 12), 0, rng:NextNumber(-25, 25)), rec.y)
			setSegment(rec, goal, (goal - pos).Magnitude / (def.speed * 0.5))
		end
	end
end

function MonsterService.Init(services)
	S = services
	Net.declare("Loot")
	folder = Instance.new("Folder")
	folder.Name = "Monsters"
	folder.Parent = Workspace
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			spawnTick()
			task.wait(1)
		end
	end)
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(0.35)
			debug.profilebegin("MonsterAI")
			aiTick()
			debug.profileend()
		end
	end)
end

return MonsterService
