-- PvP arena: queues (Duel/Duo/Squad), matches in Map.Arena.Arena1..3, normalized HP/damage
-- (Power & passes never matter), no real deaths (respawn at team spawn), Elo rating.
-- StartMatch() is reused by TournamentService.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Combat = require(Shared.Config.Combat)
local Net = require(Shared.Net)

local ArenaService = {}
local S
local A = Combat.Arena
local arenas: { Model } = {}
local busy: { [number]: any } = {}
local queues: { [string]: { Player } } = { Duel = {}, Duo = {}, Squad = {} }
local pending = {} -- matches waiting for a free arena
local matches: { [number]: any } = {}
local nextId = 0

local function root(p: Player): BasePart?
	return p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function hum(p: Player): Humanoid?
	return p.Character and p.Character:FindFirstChildOfClass("Humanoid")
end

local function spawnAt(match, p: Player)
	local team = p:GetAttribute("Team")
	local spawnPart = match.arena:FindFirstChild(team == "A" and "SpawnA" or "SpawnB") :: BasePart?
	local r = root(p)
	if spawnPart and r then
		r.CFrame = spawnPart.CFrame + Vector3.new(math.random(-4, 4), 4, math.random(-4, 4))
	end
	local h = hum(p)
	if h then
		h.Health = h.MaxHealth
	end
	if p.Character then
		local ff = Instance.new("ForceField")
		ff.Visible = true
		ff.Parent = p.Character
		task.delay(2, function()
			ff:Destroy()
		end)
	end
end

local function removeFromQueues(p: Player)
	for _, q in pairs(queues) do
		local i = table.find(q, p)
		if i then
			table.remove(q, i)
		end
	end
end

local function pushQueue(mode: string)
	local q = queues[mode]
	for _, p in ipairs(q) do
		Net.fire(p, "QueueState", { mode = mode, count = #q, need = A.Modes[mode].teamSize * 2 })
	end
end

local function sendState(match)
	local names = { A = {}, B = {} }
	for team, list in pairs(match.teams) do
		for _, p in ipairs(list) do
			table.insert(names[team], p.DisplayName)
		end
	end
	for _, list in pairs(match.teams) do
		for _, p in ipairs(list) do
			Net.fire(p, "MatchState", { id = match.id, mode = match.modeName, team = p:GetAttribute("Team"), names = names,
				kills = match.kills, killsToWin = match.killsToWin, endsAt = match.endsAt })
		end
	end
end

local function avgRating(list: { Player }): number
	local sum, n = 0, 0
	for _, p in ipairs(list) do
		local d = S.DataService.Get(p)
		if d then
			sum += d.pvp.rating
			n += 1
		end
	end
	return if n > 0 then sum / n else 1000
end

local function finish(match, winner: string?)
	if match.done then
		return
	end
	match.done = true
	matches[match.id] = nil
	busy[match.arenaIndex] = nil
	local ra, rb = avgRating(match.teams.A), avgRating(match.teams.B)
	for team, list in pairs(match.teams) do
		local mine, theirs = if team == "A" then ra else rb, if team == "A" then rb else ra
		local expected = 1 / (1 + 10 ^ ((theirs - mine) / 400))
		local score = if winner == nil then 0.5 elseif winner == team then 1 else 0
		local delta = if match.ranked then math.floor(A.EloK * (score - expected) + 0.5) else 0
		for _, p in ipairs(list) do
			if p.Parent then
				S.DataService.Update(p, function(d)
					d.pvp.rating = math.max(0, d.pvp.rating + delta)
					if winner == team then
						d.pvp.wins += 1
					elseif winner then
						d.pvp.losses += 1
					end
				end)
				if match.ranked then
					S.EconomyService.Add(p, "Coins", if winner == team then A.WinCoins else A.LoseCoins, "pvp", false)
				end
				if winner == team then
					S.QuestService.Progress(p, "PvpWins", 1)
					S.ClanService.AddXp(p, Combat.Clan.XpPerPvpWin)
				end
				p:SetAttribute("MatchId", nil)
				p:SetAttribute("Team", nil)
				S.PlayerService.RefreshCharacter(p)
				local r = root(p)
				if r then
					r.CFrame = CFrame.new(0, 5, 0)
				end
				Net.fire(p, "MatchEnd", { winner = winner, team = team, delta = delta, ranked = match.ranked })
			end
		end
	end
	if match.onEnd then
		task.spawn(match.onEnd, winner, match)
	end
end

local function begin(match)
	-- drop players who left while the match was pending
	for team, list in pairs(match.teams) do
		for i = #list, 1, -1 do
			if not list[i].Parent then
				table.remove(list, i)
			end
		end
		if #list == 0 then
			match.arenaIndex = 0
			finish(match, if team == "A" then "B" else "A")
			return true
		end
	end
	for i, arena in ipairs(arenas) do
		if not busy[i] then
			busy[i] = match
			match.arena, match.arenaIndex = arena, i
			match.endsAt = Workspace:GetServerTimeNow() + match.minutes * 60
			matches[match.id] = match
			for team, list in pairs(match.teams) do
				for _, p in ipairs(list) do
					removeFromQueues(p)
					p:SetAttribute("MatchId", match.id)
					p:SetAttribute("Team", team)
					S.PlayerService.RefreshCharacter(p)
					spawnAt(match, p)
				end
			end
			sendState(match)
			return true
		end
	end
	return false
end

function ArenaService.Dequeue(p: Player)
	removeFromQueues(p)
	Net.fire(p, "QueueState", nil)
end

-- teamA/teamB: lists of players. opts: { killsToWin, minutes, ranked, onEnd(winnerTeam|nil, match) }
function ArenaService.StartMatch(teamA: { Player }, teamB: { Player }, modeName: string, opts)
	nextId += 1
	local match = { id = nextId, teams = { A = teamA, B = teamB }, kills = { A = 0, B = 0 }, modeName = modeName,
		killsToWin = opts.killsToWin, minutes = opts.minutes, ranked = opts.ranked, onEnd = opts.onEnd }
	if not begin(match) then
		table.insert(pending, match)
	end
	return match
end

function ArenaService.Damage(attacker: Player, victim: Player, dmg: number): boolean
	local mid = attacker:GetAttribute("MatchId")
	local match = mid and matches[mid]
	if not match or victim:GetAttribute("MatchId") ~= mid or victim:GetAttribute("Team") == attacker:GetAttribute("Team") then
		return false
	end
	local h = hum(victim)
	if not h or h.Health <= 0 or (victim.Character and victim.Character:FindFirstChildOfClass("ForceField")) then
		return false
	end
	if h.Health - dmg > 0 then
		h.Health -= dmg
		return true
	end
	local team = attacker:GetAttribute("Team")
	match.kills[team] += 1
	Net.fire(attacker, "Announce", "You eliminated " .. victim.DisplayName .. "!")
	S.ClanService.AddXp(attacker, Combat.Clan.XpPerKill)
	if match.kills[team] >= match.killsToWin then
		finish(match, team)
	else
		task.delay(0, function()
			spawnAt(match, victim)
		end)
		sendState(match)
	end
	return true
end

local function leave(p: Player)
	removeFromQueues(p)
	local mid = p:GetAttribute("MatchId")
	local match = mid and matches[mid]
	if not match then
		return
	end
	for team, list in pairs(match.teams) do
		local i = table.find(list, p)
		if i then
			table.remove(list, i)
			if #list == 0 then
				finish(match, if team == "A" then "B" else "A")
			end
		end
	end
end

local function matchmake()
	for mode, q in pairs(queues) do
		local size = A.Modes[mode].teamSize
		while #q >= size * 2 do
			local group = {}
			for _ = 1, size * 2 do
				table.insert(group, table.remove(q, 1))
			end
			table.sort(group, function(a, b) -- snake draft by rating for fair teams
				local da, db = S.DataService.Get(a), S.DataService.Get(b)
				return (da and da.pvp.rating or 0) > (db and db.pvp.rating or 0)
			end)
			local ta, tb = {}, {}
			for i, p in ipairs(group) do
				table.insert(if (i % 4 == 1 or i % 4 == 0) then ta else tb, p)
			end
			local m = A.Modes[mode]
			ArenaService.StartMatch(ta, tb, m.name, { killsToWin = m.killsToWin, minutes = m.minutes, ranked = true })
		end
		pushQueue(mode)
	end
	for i = #pending, 1, -1 do
		if begin(pending[i]) then
			table.remove(pending, i)
		end
	end
	local t = Workspace:GetServerTimeNow()
	for _, match in pairs(matches) do
		if t >= match.endsAt then
			local a, b = match.kills.A, match.kills.B
			finish(match, if a > b then "A" elseif b > a then "B" else nil)
		end
	end
end

function ArenaService.Init(services)
	S = services
	for _, n in ipairs({ "QueueState", "MatchState", "MatchEnd" }) do
		Net.declare(n)
	end
	task.spawn(function()
		local root = Workspace:WaitForChild("Map", 30)
		local arenaFolder = root and root:WaitForChild("Arena", 30)
		for i = 1, 3 do
			local a = arenaFolder and arenaFolder:WaitForChild("Arena" .. i, 10)
			if a then
				table.insert(arenas, a :: Model)
			end
		end
	end)

	Net.on("QueueJoin", function(player, mode)
		if type(mode) ~= "string" or not queues[mode] or player:GetAttribute("MatchId") or player:GetAttribute("InTournament") then
			return
		end
		removeFromQueues(player)
		table.insert(queues[mode], player)
		pushQueue(mode)
	end, 2)
	Net.on("QueueLeave", function(player)
		removeFromQueues(player)
		Net.fire(player, "QueueState", nil)
	end, 2)
	Net.handle("PvpStats", function(player)
		local d = S.DataService.Get(player)
		return d and d.pvp
	end, 2)

	Players.PlayerRemoving:Connect(leave)
	Players.PlayerAdded:Connect(function(p)
		p.CharacterAdded:Connect(function()
			local mid = p:GetAttribute("MatchId")
			if mid and matches[mid] then
				task.wait(0.3)
				S.PlayerService.RefreshCharacter(p)
				spawnAt(matches[mid], p)
			end
		end)
	end)
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(2)
			matchmake()
		end
	end)
end

return ArenaService
