-- Server tournament every N minutes: signup (entry fee) -> single-elimination 1v1 bracket using
-- ArenaService.StartMatch -> champion takes the pot + Gems + trophy + badge.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Combat = require(Shared.Config.Combat)
local Net = require(Shared.Net)

local TournamentService = {}
local S
local T = Combat.Tournament
local state = { phase = "idle", entrants = {} :: { Player }, rounds = {}, endsAt = 0, nextAt = 0, pot = 0 }

local function broadcast()
	local rounds = {}
	for r, list in ipairs(state.rounds) do
		rounds[r] = {}
		for i, m in ipairs(list) do
			rounds[r][i] = { a = m.a and m.a.DisplayName or "BYE", b = m.b and m.b.DisplayName or "BYE", winner = m.winner and m.winner.DisplayName }
		end
	end
	local names = {}
	for _, p in ipairs(state.entrants) do
		table.insert(names, p.DisplayName)
	end
	Net.fireAll("TourState", { phase = state.phase, endsAt = state.endsAt, nextAt = state.nextAt, entrants = names,
		size = T.Size, entry = T.EntryCoins, pot = state.pot, rounds = rounds })
end

local function startDuel(m, done)
	S.ArenaService.StartMatch({ m.a }, { m.b }, "Tournament", {
		killsToWin = T.KillsToWin, minutes = 3, ranked = false,
		onEnd = function(winnerTeam)
			if winnerTeam == "A" then
				done(m.a)
			elseif winnerTeam == "B" then
				done(m.b)
			else -- draw: higher rating advances
				local da, db = S.DataService.Get(m.a), S.DataService.Get(m.b)
				done(if (da and da.pvp.rating or 0) >= (db and db.pvp.rating or 0) then m.a else m.b)
			end
		end,
	})
end

local function runRound(players: { Player }): { Player }
	local list = {}
	for i = 1, #players, 2 do
		table.insert(list, { a = players[i], b = players[i + 1] })
	end
	table.insert(state.rounds, list)
	broadcast()
	local open = 0
	for _, m in ipairs(list) do
		if not m.b or not m.b.Parent then
			m.winner = m.a
		elseif not m.a.Parent then
			m.winner = m.b
		else
			open += 1
			startDuel(m, function(winner)
				m.winner = winner
				open -= 1
				broadcast()
			end)
		end
	end
	local t0 = os.clock()
	while open > 0 and os.clock() - t0 < 600 do
		task.wait(1)
	end
	local winners = {}
	for _, m in ipairs(list) do
		if m.winner and m.winner.Parent then
			table.insert(winners, m.winner)
		end
	end
	return winners
end

local function run()
	state = { phase = "signup", entrants = {}, rounds = {}, endsAt = Workspace:GetServerTimeNow() + T.SignupSeconds, nextAt = 0, pot = 0 }
	Net.fireAll("Announce", ("TOURNAMENT signup open! Entry %d Coins — go to the Arena Portal"):format(T.EntryCoins))
	broadcast()
	task.wait(T.SignupSeconds)
	if #state.entrants < 2 then
		for _, p in ipairs(state.entrants) do
			if p.Parent then
				S.EconomyService.Add(p, "Coins", T.EntryCoins, "tour_refund", false)
				p:SetAttribute("InTournament", nil)
			end
		end
		state.phase = "idle"
		Net.fireAll("Announce", "Tournament cancelled (not enough players).")
		return
	end
	state.phase = "running"
	local players = table.clone(state.entrants)
	for i = #players, 2, -1 do -- shuffle
		local j = math.random(1, i)
		players[i], players[j] = players[j], players[i]
	end
	while #players > 1 do
		players = runRound(players)
	end
	local champ = players[1]
	if champ and champ.Parent then
		S.EconomyService.Add(champ, "Coins", state.pot, "tournament", false)
		S.EconomyService.Add(champ, "Gems", T.PrizeGems, "tournament", false)
		S.DataService.Update(champ, function(d)
			d.pvp.trophies += 1
		end)
		S.AnalyticsService.Badge(champ, "TournamentWin")
		S.ClanService.AddXp(champ, 200)
		Net.fireAll("Announce", ("🏆 %s won the tournament and %d Coins!"):format(champ.DisplayName, state.pot))
	end
	for _, p in ipairs(state.entrants) do
		p:SetAttribute("InTournament", nil)
	end
	state.phase = "done"
	broadcast()
end

function TournamentService.Init(services)
	S = services
	Net.declare("TourState")
	Net.handle("TourJoin", function(player)
		if state.phase ~= "signup" or table.find(state.entrants, player) or #state.entrants >= T.Size or player:GetAttribute("MatchId") then
			return false
		end
		if not S.EconomyService.Spend(player, "Coins", T.EntryCoins) then
			return false
		end
		table.insert(state.entrants, player)
		state.pot += T.EntryCoins
		player:SetAttribute("InTournament", true)
		broadcast()
		return true
	end, 2)
	Net.handle("TourInfo", function()
		local names = {}
		for _, p in ipairs(state.entrants) do
			table.insert(names, p.DisplayName)
		end
		return { phase = state.phase, endsAt = state.endsAt, nextAt = state.nextAt, entrants = names, size = T.Size, entry = T.EntryCoins, pot = state.pot }
	end, 4)
	Players.PlayerRemoving:Connect(function(p)
		local i = table.find(state.entrants, p)
		if i and state.phase == "signup" then
			table.remove(state.entrants, i)
		end
	end)
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			state.nextAt = Workspace:GetServerTimeNow() + T.IntervalMinutes * 60
			task.wait(T.IntervalMinutes * 60)
			if #Players:GetPlayers() >= 2 then
				run()
			end
		end
	end)
end

return TournamentService
