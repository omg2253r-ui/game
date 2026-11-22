-- Daily quests rolled from Economy.QuestPool. Call QuestService.Progress(player, stat, n)
-- from any gameplay code (e.g. "Collect", "Kill", "Win", "Minutes").
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Economy = require(Shared.Config.Economy)
local Net = require(Shared.Net)

local QuestService = {}
local DataService, EconomyService

local function today(): number
	return math.floor(os.time() / 86400)
end

local function roll(data)
	local pool = table.clone(Economy.QuestPool)
	local rng = Random.new(today() * 7919 + (data.firstJoin % 1000))
	local list = {}
	for _ = 1, math.min(Economy.QuestsPerDay, #pool) do
		local q = table.remove(pool, rng:NextInteger(1, #pool))
		table.insert(list, { id = q.id, progress = 0, claimed = false })
	end
	data.quests = { day = today(), list = list }
end

local function find(id)
	for _, q in ipairs(Economy.QuestPool) do
		if q.id == id then
			return q
		end
	end
	return nil
end

local function push(player: Player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local out = {}
	for i, q in ipairs(data.quests.list) do
		local def = find(q.id)
		if def then
			out[i] = { text = def.text, goal = def.goal, progress = math.min(q.progress, def.goal), claimed = q.claimed, reward = def.reward }
		end
	end
	Net.fire(player, "QuestState", out)
end

local function ensure(player: Player)
	local data = DataService.Get(player)
	if data and data.quests.day ~= today() then
		DataService.Update(player, roll)
	end
end

function QuestService.Progress(player: Player, stat: string, amount: number)
	ensure(player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local changed = false
	DataService.Update(player, function(d)
		d.stats[stat] = (d.stats[stat] or 0) + amount
		for _, q in ipairs(d.quests.list) do
			local def = find(q.id)
			if def and def.stat == stat and not q.claimed and q.progress < def.goal then
				q.progress += amount
				changed = true
			end
		end
	end)
	if changed then
		push(player)
	end
end

function QuestService.Init(services)
	DataService = services.DataService
	EconomyService = services.EconomyService
	Net.declare("QuestState")

	DataService.Loaded:Connect(function(player)
		ensure(player)
		push(player)
	end)

	Net.on("ClaimQuest", function(player, index)
		ensure(player)
		local data = DataService.Get(player)
		local q = data and type(index) == "number" and data.quests.list[index]
		local def = q and find(q.id)
		if not def or q.claimed or q.progress < def.goal then
			return
		end
		DataService.Update(player, function()
			q.claimed = true
		end)
		EconomyService.Grant(player, def.reward, "quest")
		EconomyService.Toast(player, "Quest complete: " .. def.text, "success")
		push(player)
	end, 3)
end

return QuestService
