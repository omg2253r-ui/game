-- Co-op raid: lobby (1-4 players) -> 10 waves of tier-scaled monsters in a code-built arena -> rewards + Raid Token shop.
-- Players in a raid carry attribute "RaidId" (never MatchId). Raid monsters give no normal kill rewards.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Net = require(Shared.Net)
local Cfg = require(Shared.Config.Raid)
local Arena = require(script.Parent.RaidArena)
local Rewards = require(script.Parent.RaidRewards)
local Monsters = require(Shared.Config.Monsters)

local RaidService = {}
local S
local rng = Random.new()
local lobbies: { [number]: any } = {} -- by raid id (open or running)
local ofPlayer: { [Player]: any } = {}
local slotBusy: { [number]: boolean } = {}
local nextId = 0


local function members(raid): { Player }
	local out = {}
	for _, p in ipairs(raid.members) do
		if p.Parent then
			table.insert(out, p)
		end
	end
	return out
end

local function fireAll(raid, name: string, ...)
	for _, p in ipairs(members(raid)) do
		Net.fire(p, name, ...)
	end
end

local function lobbyView(raid)
	local names = {}
	for _, p in ipairs(raid.members) do
		table.insert(names, p.DisplayName)
	end
	return { id = raid.id, leader = raid.leader.DisplayName, leaderId = raid.leader.UserId, names = names, count = #names, started = raid.started }
end

local function pushLobby(raid)
	fireAll(raid, "RaidLobby", lobbyView(raid))
end

local function toHub(p: Player)
	local r = p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if r then
		r.CFrame = CFrame.new(0, 5, 0)
	end
end

local function teleportIn(raid, p: Player)
	local r = p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if r then
		r.CFrame = CFrame.new(Arena.Origin(raid.slot) + Vector3.new(rng:NextInteger(-5, 5), 4, rng:NextInteger(-5, 5)))
	end
end

local function removeMember(raid, p: Player, silent: boolean?)
	local i = table.find(raid.members, p)
	if i then
		table.remove(raid.members, i)
	end
	ofPlayer[p] = nil
	p:SetAttribute("RaidId", nil)
	p:SetAttribute("RaidDead", nil)
	if p.Parent then
		if raid.started then
			toHub(p)
			S.PlayerService.RefreshCharacter(p)
		end
		if not silent then
			Net.fire(p, "RaidLobby", nil)
		end
	end
	if #raid.members == 0 then
		raid.over = true
		for id in pairs(raid.mons or {}) do -- don't leak monsters into the next raid on this slot
			S.MonsterService.Remove(id)
		end
		raid.mons = {}
		lobbies[raid.id] = nil
		if raid.slot then
			slotBusy[raid.slot] = false
		end
	elseif raid.leader == p then
		raid.leader = raid.members[1]
		pushLobby(raid)
	else
		pushLobby(raid)
	end
end

local function bestTier(raid): number
	local t = 1
	for _, p in ipairs(members(raid)) do
		t = math.max(t, S.ZoneService.BestTier(S.PlayerService.GetPower(p)))
	end
	return t
end

local function finish(raid, cleared: number, won: boolean)
	if raid.over then
		return
	end
	raid.over = true
	for id in pairs(raid.mons) do
		S.MonsterService.Remove(id)
	end
	raid.mons = {}
	local list = members(raid)
	for _, p in ipairs(list) do
		local ok, res = pcall(Rewards.Grant, S, raid, p, cleared, won)
		Net.fire(p, "RaidEnd", { won = won, cleared = cleared, waves = Cfg.Waves, rewards = if ok then res else nil })
		ofPlayer[p] = nil
		p:SetAttribute("RaidId", nil)
		p:SetAttribute("RaidDead", nil)
		Net.fire(p, "RaidState", nil)
		Net.fire(p, "RaidLobby", nil)
		toHub(p)
		S.PlayerService.RefreshCharacter(p)
	end
	raid.members = {}
	lobbies[raid.id] = nil
	slotBusy[raid.slot] = false
end

local function scaled(raid, id: string, wave: number, frac: number?)
	local def = Monsters[id]
	local hp = def.hp * (frac or 1) * (1 + Cfg.HpPerWave * (wave - 1)) * (1 + Cfg.PartyHpBonus * (#raid.members - 1))
	local copy = table.clone(def)
	copy.hp = hp
	return copy, math.floor(hp)
end

local function spawnWave(raid, wave: number)
	local z = Arena.ZoneOfTier(raid.tier)
	local list = {} -- defIds + hp fraction
	local boss = wave == Cfg.BossWave
	local mini = wave == Cfg.MiniBossWave
	if boss or mini then
		table.insert(list, { z.boss, if boss then Cfg.BossHp else Cfg.MiniBossHp })
	end
	local n = math.min(Cfg.MaxAlive, math.floor(Cfg.BaseCount + Cfg.CountPerWave * wave))
	if boss or mini then
		n = math.floor(n / 2)
	end
	for _ = 1, n do
		table.insert(list, { z.monsters[rng:NextInteger(1, #z.monsters)], 1 })
	end
	raid.total, raid.killed, raid.wave = #list, 0, wave
	raid.endsAt = Workspace:GetServerTimeNow() + Cfg.WaveSeconds
	raid.deadline = os.clock() + Cfg.WaveSeconds
	local o = Arena.Origin(raid.slot)
	for i, e in ipairs(list) do
		if raid.over then
			return
		end
		local def, hp = scaled(raid, e[1], wave, e[2])
		local a = rng:NextNumber(0, math.pi * 2)
		local rad = rng:NextNumber(45, 62)
		local rec = S.MonsterService.Spawn(e[1], o + Vector3.new(math.cos(a) * rad, 0, math.sin(a) * rad), { def = def, hpOverride = hp, raidId = raid.id,
			onDeath = function(r)
				raid.mons[r.id] = nil
				if not raid.over and raid.wave == wave then
					raid.killed += 1
					fireAll(raid, "RaidState", { wave = wave, waves = Cfg.Waves, killed = raid.killed, total = raid.total, endsAt = raid.endsAt, boss = boss or mini })
				end
			end })
		raid.mons[rec.id] = true
		if i % 4 == 0 then
			task.wait(0.3)
		end
	end
end

local function run(raid)
	local cleared = 0
	for wave = 1, Cfg.Waves do
		if raid.over then
			return
		end
		spawnWave(raid, wave)
		fireAll(raid, "RaidState", { wave = wave, waves = Cfg.Waves, killed = 0, total = raid.total, endsAt = raid.endsAt, boss = wave == Cfg.BossWave or wave == Cfg.MiniBossWave, banner = true })
		while not raid.over and raid.killed < raid.total and os.clock() < raid.deadline and not raid.failed do
			task.wait(0.5)
		end
		if raid.over then
			return
		end
		if raid.killed < raid.total then
			finish(raid, cleared, false)
			return
		end
		cleared = wave
		if wave < Cfg.Waves then
			task.wait(Cfg.IntermissionSeconds)
		end
	end
	finish(raid, cleared, true)
end

local function allDead(raid): boolean
	for _, p in ipairs(raid.members) do
		if p.Parent and not p:GetAttribute("RaidDead") then
			return false
		end
	end
	return true
end

local function hook(p: Player)
	p.CharacterAdded:Connect(function(char)
		local raid = ofPlayer[p]
		p:SetAttribute("RaidDead", nil)
		local hum = char:WaitForChild("Humanoid", 5) :: Humanoid?
		if raid and raid.started and hum then
			task.wait(0.3) -- after PlayerService sets up the character
			if ofPlayer[p] == raid and not raid.over then
				teleportIn(raid, p)
			end
			hum.Died:Connect(function()
				if ofPlayer[p] == raid and not raid.over then
					p:SetAttribute("RaidDead", true)
					if allDead(raid) then
						raid.failed = true
					end
				end
			end)
		end
	end)
end

local function startRaid(raid)
	local slot
	for i = 0, Cfg.MaxArenas - 1 do
		if not slotBusy[i] then
			slot = i
			break
		end
	end
	if not slot then
		return false
	end
	slotBusy[slot] = true
	raid.slot, raid.started, raid.mons = slot, true, {}
	Arena.Build(slot)
	raid.tier = bestTier(raid)
	for _, p in ipairs(members(raid)) do
		p:SetAttribute("RaidId", raid.id)
		local hum = p.Character and p.Character:FindFirstChildOfClass("Humanoid")
		if hum then
			hum.Health = hum.MaxHealth
			hum.Died:Connect(function() -- first life (later lives are hooked on CharacterAdded)
				if ofPlayer[p] == raid and not raid.over then
					p:SetAttribute("RaidDead", true)
					if allDead(raid) then
						raid.failed = true
					end
				end
			end)
		end
		teleportIn(raid, p)
	end
	pushLobby(raid)
	task.spawn(run, raid)
	return true
end

local function inPvp(p: Player): boolean
	return p:GetAttribute("MatchId") ~= nil
end

function RaidService.Init(services)
	S = services
	for _, n in ipairs({ "RaidLobby", "RaidState", "RaidEnd" }) do
		Net.declare(n)
	end
	for _, p in ipairs(Players:GetPlayers()) do
		hook(p)
	end
	Players.PlayerAdded:Connect(hook)
	Players.PlayerRemoving:Connect(function(p)
		local raid = ofPlayer[p]
		if raid then
			removeMember(raid, p, true)
			if raid.started and not raid.over and #raid.members > 0 and allDead(raid) then
				raid.failed = true
			end
		end
	end)

	Net.handle("RaidInfo", function(p)
		local d = S.DataService.Get(p)
		if not d then
			return nil
		end
		local open = {}
		for _, r in pairs(lobbies) do
			if not r.started and #r.members < Cfg.MaxPlayers then
				table.insert(open, lobbyView(r))
			end
		end
		local mine = ofPlayer[p]
		return { open = open, mine = if mine then lobbyView(mine) else nil, tokens = d.raid.tokens, best = d.raid.best, clears = d.raid.clears,
			dailyReady = (d.raid.daily or 0) < os.time() // 86400, shop = Cfg.Shop, title = d.title, owned = d.raid.owned or {}, tier = S.ZoneService.BestTier(S.PlayerService.GetPower(p)) }
	end, 2)

	Net.handle("RaidCreate", function(p)
		if ofPlayer[p] or inPvp(p) then
			return false
		end
		nextId += 1
		local raid = { id = nextId, leader = p, members = { p }, started = false }
		lobbies[raid.id] = raid
		ofPlayer[p] = raid
		pushLobby(raid)
		return true
	end, 2)

	Net.handle("RaidJoin", function(p, id)
		local raid = type(id) == "number" and lobbies[id]
		if not raid or raid.started or ofPlayer[p] or inPvp(p) or #raid.members >= Cfg.MaxPlayers then
			return false
		end
		table.insert(raid.members, p)
		ofPlayer[p] = raid
		pushLobby(raid)
		return true
	end, 2)

	Net.on("RaidLeave", function(p)
		local raid = ofPlayer[p]
		if raid then
			removeMember(raid, p)
		end
	end, 2)

	Net.handle("RaidStart", function(p)
		local raid = ofPlayer[p]
		if not raid or raid.leader ~= p or raid.started or inPvp(p) then
			return false
		end
		if not startRaid(raid) then
			S.EconomyService.Toast(p, "All raid arenas are busy, try again soon", "error")
			return false
		end
		return true
	end, 1)

	Net.handle("RaidBuy", function(p, id)
		return Rewards.Buy(S, p, id)
	end, 3)
end

return RaidService
