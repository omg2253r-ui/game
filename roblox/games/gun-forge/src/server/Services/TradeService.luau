-- Secure player trading (same server): request -> accept -> both pick items -> both READY ->
-- 3 s confirm countdown (any change cancels) -> atomic swap re-validated at execution -> both saved.
-- Items move as deep copies under fresh uids; equipped items can't be offered.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)

local TradeService = {}
local S
local MAX_ITEMS, CONFIRM = 8, 3
type Trade = { a: Player, b: Player, offer: { [Player]: { string } }, ready: { [Player]: boolean }, confirmAt: number?, done: boolean }
local trades: { [Player]: Trade } = {}
local requests: { [Player]: { [Player]: number } } = {} -- target -> from -> time

local function deepCopy(t)
	local c = {}
	for k, v in pairs(t) do
		c[k] = if type(v) == "table" then deepCopy(v) else v
	end
	return c
end

local function isEquipped(d, uid: string): boolean
	local e = d.equipped
	return e.gun == uid or e.helmet == uid or e.vest == uid or e.boots == uid or table.find(e.pets, uid) ~= nil
end

local function itemsView(p: Player, uids: { string })
	local d = S.DataService.Get(p)
	local out = {}
	for _, uid in ipairs(uids) do
		local it = d and d.items[uid]
		if it then
			table.insert(out, { uid = uid, item = it })
		end
	end
	return out
end

local function push(t: Trade)
	for _, me in ipairs({ t.a, t.b }) do
		local other = if me == t.a then t.b else t.a
		Net.fire(me, "TradeState", {
			partner = other.DisplayName,
			mine = itemsView(me, t.offer[me]), theirs = itemsView(other, t.offer[other]),
			myReady = t.ready[me], theirReady = t.ready[other],
			confirmAt = t.confirmAt,
		})
	end
end

local function close(t: Trade, reason: string)
	t.done = true
	for _, p in ipairs({ t.a, t.b }) do
		if trades[p] == t then
			trades[p] = nil
		end
		if p.Parent then
			Net.fire(p, "TradeClosed", reason)
		end
	end
end

local function canReceive(p: Player, incoming: { string }, outgoing: { string }, from: Player): boolean
	local fromData = S.DataService.Get(from)
	local pets, gear = 0, 0
	for _, uid in ipairs(incoming) do
		local it = fromData and fromData.items[uid]
		if it and it.kind == "pet" then
			pets += 1
		else
			gear += 1
		end
	end
	local d = S.DataService.Get(p)
	for _, uid in ipairs(outgoing) do
		local it = d and d.items[uid]
		if it and it.kind == "pet" then
			pets -= 1
		else
			gear -= 1
		end
	end
	return S.InventoryService.ItemCount(p, "pet") + pets <= 200 and S.InventoryService.ItemCount(p, "gun") + gear <= 150
end

local function valid(t: Trade): boolean
	for _, p in ipairs({ t.a, t.b }) do
		local d = S.DataService.Get(p)
		if not d or not p.Parent then
			return false
		end
		for _, uid in ipairs(t.offer[p]) do
			if not d.items[uid] or isEquipped(d, uid) then
				return false
			end
		end
	end
	return canReceive(t.a, t.offer[t.b], t.offer[t.a], t.b) and canReceive(t.b, t.offer[t.a], t.offer[t.b], t.a)
end

local function execute(t: Trade)
	if t.done or not valid(t) then
		close(t, "Trade failed: items changed")
		return
	end
	t.done = true
	local moveA, moveB = {}, {}
	local da, db = S.DataService.Get(t.a), S.DataService.Get(t.b)
	for _, uid in ipairs(t.offer[t.a]) do
		table.insert(moveA, deepCopy(da.items[uid]))
	end
	for _, uid in ipairs(t.offer[t.b]) do
		table.insert(moveB, deepCopy(db.items[uid]))
	end
	-- remove first (no window where both own the item), then grant
	for _, uid in ipairs(t.offer[t.a]) do
		S.InventoryService.RemoveItem(t.a, uid)
	end
	for _, uid in ipairs(t.offer[t.b]) do
		S.InventoryService.RemoveItem(t.b, uid)
	end
	for _, it in ipairs(moveA) do
		S.InventoryService.CreateItem(t.b, it)
	end
	for _, it in ipairs(moveB) do
		S.InventoryService.CreateItem(t.a, it)
	end
	task.spawn(S.DataService.Save, t.a)
	task.spawn(S.DataService.Save, t.b)
	S.AnalyticsService.Event(t.a, "Trade", #moveA + #moveB)
	t.done = false
	close(t, "Trade complete!")
end

local function setReady(p: Player, on: boolean)
	local t = trades[p]
	if not t or t.done then
		return
	end
	t.ready[p] = on
	if t.ready[t.a] and t.ready[t.b] then
		local stamp = os.clock()
		t.confirmAt = workspace:GetServerTimeNow() + CONFIRM
		t.stamp = stamp
		push(t)
		task.delay(CONFIRM, function()
			if trades[t.a] == t and t.stamp == stamp and t.ready[t.a] and t.ready[t.b] then
				execute(t)
			end
		end)
	else
		t.confirmAt = nil
		push(t)
	end
end

function TradeService.Init(services)
	S = services
	for _, n in ipairs({ "TradeInvite", "TradeState", "TradeClosed" }) do
		Net.declare(n)
	end

	Net.on("TradeRequest", function(p, targetId)
		local target = type(targetId) == "number" and Players:GetPlayerByUserId(targetId)
		if not target or target == p or trades[p] or trades[target] then
			return
		end
		requests[target] = requests[target] or {}
		requests[target][p] = os.clock()
		Net.fire(target, "TradeInvite", { fromId = p.UserId, from = p.DisplayName })
		S.EconomyService.Toast(p, "Trade request sent to " .. target.DisplayName, "info")
	end, 1)

	Net.on("TradeAccept", function(p, fromId)
		local from = type(fromId) == "number" and Players:GetPlayerByUserId(fromId)
		local t0 = from and requests[p] and requests[p][from]
		if not from or not t0 or os.clock() - t0 > 30 or trades[p] or trades[from] then
			return
		end
		requests[p][from] = nil
		local t: Trade = { a = from, b = p, offer = { [from] = {}, [p] = {} }, ready = { [from] = false, [p] = false }, done = false }
		trades[from], trades[p] = t, t
		push(t)
	end, 2)

	Net.on("TradeSetOffer", function(p, uids)
		local t = trades[p]
		local d = S.DataService.Get(p)
		if not t or t.done or not d or type(uids) ~= "table" then
			return
		end
		local clean, seen = {}, {}
		for _, uid in ipairs(uids) do
			if type(uid) == "string" and not seen[uid] and d.items[uid] and not isEquipped(d, uid) and #clean < MAX_ITEMS then
				seen[uid] = true
				table.insert(clean, uid)
			end
		end
		t.offer[p] = clean
		t.ready[t.a], t.ready[t.b] = false, false -- any change un-readies both (anti-scam)
		t.confirmAt = nil
		push(t)
	end, 6)

	Net.on("TradeReady", function(p, on)
		if type(on) == "boolean" then
			setReady(p, on)
		end
	end, 4)
	Net.on("TradeCancel", function(p)
		local t = trades[p]
		if t then
			close(t, p.DisplayName .. " cancelled the trade")
		end
	end, 2)
	Players.PlayerRemoving:Connect(function(p)
		local t = trades[p]
		if t then
			close(t, "Partner left")
		end
		requests[p] = nil
	end)
end

return TradeService
