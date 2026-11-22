-- Clans (cross-server): DataStore records, roles, invites, filtered names/tags, clan XP + perks,
-- weekly Clan War leaderboard (OrderedDataStore per week). All web calls pcall-wrapped.
local DataStoreService = game:GetService("DataStoreService")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextService = game:GetService("TextService")

local Shared = ReplicatedStorage.Shared
local Combat = require(Shared.Config.Combat)
local Net = require(Shared.Net)

local ClanService = {}
local S
local C = Combat.Clan
local okStore, store = pcall(DataStoreService.GetDataStore, DataStoreService, "Clans_v1")
local cache: { [string]: { data: any, t: number } } = {}
local localClans: { [string]: any } = {} -- offline fallback (Studio without API access)
local pendingXp: { [string]: number } = {}
local invites: { [Player]: { [string]: boolean } } = {}
local warCache = { t = 0, list = {} }
local busy: { [Player]: boolean } = {} -- one clan mutation per player at a time (handlers yield)

-- wraps a RemoteFunction handler: serialises per player and never throws back at the client
local function guarded(fn)
	return function(player: Player, ...)
		if busy[player] then
			return "Busy"
		end
		busy[player] = true
		local ok, res = pcall(fn, player, ...)
		busy[player] = nil
		if not ok then
			warn("[Clan]", res)
			return "Error"
		end
		return res
	end
end

local function week(): number
	return math.floor((os.time() - 345600) / 604800) -- weeks starting Monday UTC
end

local function warStore()
	local ok, s = pcall(DataStoreService.GetOrderedDataStore, DataStoreService, "ClanWar_" .. week())
	return ok and s or nil
end

-- returns data, fetched (fetched=false: the DataStore read failed, data is only a fallback)
local function load(id: string, fresh: boolean?)
	local c = cache[id]
	if c and not fresh and os.clock() - c.t < 60 then
		return c.data, true
	end
	local data = localClans[id]
	local fetched = not okStore
	if okStore then
		local ok, res = pcall(store.GetAsync, store, id)
		if ok then
			data, fetched = res, true
		end
	end
	if fetched then
		cache[id] = { data = data, t = os.clock() }
	end
	return data, fetched
end

-- atomic modify; fn(data) returns data or nil to abort
local function modify(id: string, fn)
	local result
	local useLocal = not okStore
	if okStore then
		local ok, err = pcall(function()
			store:UpdateAsync(id, function(old) -- lint-ok (pcall)
				result = fn(old)
				return result
			end)
		end)
		if not ok then
			warn("[Clan] update failed", err)
			if not tostring(err):find("API") then
				return nil
			end
			result, useLocal = nil, true -- Studio without API access: keep clans in memory
		end
	end
	if useLocal then
		result = fn(localClans[id])
	end
	if result ~= nil then
		localClans[id] = result
		cache[id] = { data = result, t = os.clock() }
	end
	return result
end

local function level(xp: number): number
	return math.floor(xp / C.XpPerLevel)
end

function ClanService.Perk(player: Player): number
	return (player:GetAttribute("ClanPerk") :: number?) or 0
end

local function applyTag(player: Player, clan)
	player:SetAttribute("ClanTag", clan and clan.tag or nil)
	player:SetAttribute("ClanPerk", clan and math.min(0.5, level(clan.xp) * C.PerkPerLevel) or 0)
	local head = player.Character and player.Character:FindFirstChild("Head")
	local old = head and head:FindFirstChild("ClanTag")
	if old then
		old:Destroy()
	end
	if clan and head then
		local g = Instance.new("BillboardGui")
		g.Name = "ClanTag"
		g.Size = UDim2.fromOffset(100, 24)
		g.StudsOffset = Vector3.new(0, 3.3, 0)
		g.MaxDistance = 60
		local l = Instance.new("TextLabel")
		l.Size = UDim2.fromScale(1, 1)
		l.BackgroundTransparency = 1
		l.Font = Enum.Font.FredokaOne
		l.TextScaled = true
		l.Text = "[" .. clan.tag .. "]"
		l.TextColor3 = Color3.fromRGB(58, 216, 255)
		l.TextStrokeTransparency = 0.2
		l.Parent = g
		g.Parent = head
	end
end

local function filter(text: string, userId: number): string?
	local ok, res = pcall(function()
		return TextService:FilterStringAsync(text, userId):GetNonChatStringForBroadcastAsync()
	end)
	return if ok then res else nil
end

local function myClan(player: Player)
	local d = S.DataService.Get(player)
	if not d or d.clan == "" then
		return nil, nil
	end
	return d.clan, load(d.clan)
end

local function setClan(player: Player, id: string)
	S.DataService.Update(player, function(d)
		d.clan = id
	end)
end

function ClanService.AddXp(player: Player, n: number)
	local d = S.DataService.Get(player)
	if d and d.clan ~= "" then
		pendingXp[d.clan] = (pendingXp[d.clan] or 0) + n
	end
end

local function flush()
	local batch = pendingXp
	pendingXp = {}
	local ws = warStore()
	for id, xp in pairs(batch) do
		modify(id, function(c)
			if c then
				c.xp += xp
			end
			return c
		end)
		if ws then
			pcall(ws.IncrementAsync, ws, id, xp)
		end
	end
	for _, p in ipairs(Players:GetPlayers()) do
		local _, clan = myClan(p)
		if clan then
			p:SetAttribute("ClanPerk", math.min(0.5, level(clan.xp) * C.PerkPerLevel))
		end
	end
end

local function info(player: Player)
	local id, clan = myClan(player)
	if not clan or not clan.members[tostring(player.UserId)] then
		return { clan = nil }
	end
	local members = {}
	for uid, m in pairs(clan.members) do
		table.insert(members, { userId = tonumber(uid), name = m.name, role = m.role, online = Players:GetPlayerByUserId(tonumber(uid) or 0) ~= nil })
	end
	table.sort(members, function(a, b)
		return a.role < b.role
	end)
	return { clan = { id = id, name = clan.name, tag = clan.tag, xp = clan.xp, level = level(clan.xp), perk = math.min(0.5, level(clan.xp) * C.PerkPerLevel),
		max = C.MaxMembers, members = members }, role = clan.members[tostring(player.UserId)].role }
end

function ClanService.Init(services)
	S = services
	Net.declare("ClanInvite")

	S.DataService.Loaded:Connect(function(player, data)
		if data.clan ~= "" then
			local clan, fetched = load(data.clan, true)
			if fetched and (not clan or not clan.members[tostring(player.UserId)]) then
				setClan(player, "") -- kicked / disbanded while away
			elseif clan and clan.members[tostring(player.UserId)] then
				applyTag(player, clan)
			end
		end
		player.CharacterAdded:Connect(function()
			task.wait(0.5)
			local _, clan = myClan(player)
			applyTag(player, clan)
		end)
	end)
	Players.PlayerRemoving:Connect(function(p)
		invites[p] = nil
		busy[p] = nil
	end)

	Net.handle("ClanInfo", info, 3)

	Net.handle("ClanCreate", guarded(function(player, name, tag)
		if type(name) ~= "string" or type(tag) ~= "string" then
			return "Invalid"
		end
		name, tag = name:sub(1, C.NameMaxLen), tag:upper():sub(1, C.TagMaxLen)
		if #name < 3 or #tag < 2 or not tag:match("^[A-Z0-9]+$") then
			return "Name 3+ chars, tag 2-4 letters/numbers"
		end
		if myClan(player) then
			return "Leave your clan first"
		end
		local fName, fTag = filter(name, player.UserId), filter(tag, player.UserId)
		if fName ~= name or fTag ~= tag then
			return "That name is not allowed"
		end
		if not S.EconomyService.Spend(player, "Coins", C.CreateCoins) then
			return ("Need %d Coins"):format(C.CreateCoins)
		end
		local id = HttpService:GenerateGUID(false)
		local made = modify(id, function()
			return { name = name, tag = tag, owner = player.UserId, xp = 0, created = os.time(),
				members = { [tostring(player.UserId)] = { role = "1Leader", name = player.DisplayName } } }
		end)
		if not made then
			S.EconomyService.Add(player, "Coins", C.CreateCoins, "clan_refund", false)
			return "Could not create clan, try again"
		end
		setClan(player, id)
		applyTag(player, made)
		return "OK"
	end), 1)

	Net.on("ClanInviteSend", function(player, targetUserId)
		local id, clan = myClan(player)
		local target = type(targetUserId) == "number" and Players:GetPlayerByUserId(targetUserId)
		if not clan or not target or target == player then
			return
		end
		local mine = clan.members[tostring(player.UserId)]
		if not mine or mine.role == "3Member" then
			return
		end
		invites[target] = invites[target] or {}
		invites[target][id] = true
		Net.fire(target, "ClanInvite", { id = id, name = clan.name, tag = clan.tag, from = player.DisplayName })
	end, 3)

	Net.handle("ClanAccept", guarded(function(player, id)
		if type(id) ~= "string" or not (invites[player] and invites[player][id]) or myClan(player) then
			return "No invite"
		end
		local full = false
		local res = modify(id, function(c)
			if not c then
				return nil
			end
			local n = 0
			for _ in pairs(c.members) do
				n += 1
			end
			if n >= C.MaxMembers then
				full = true
				return nil
			end
			c.members[tostring(player.UserId)] = { role = "3Member", name = player.DisplayName }
			return c
		end)
		if full or not res then
			return "Clan is full"
		end
		invites[player] = nil
		setClan(player, id)
		applyTag(player, res)
		return "OK"
	end), 2)

	Net.handle("ClanLeave", guarded(function(player)
		local id, clan = myClan(player)
		if not id then
			return "Not in a clan"
		end
		if not clan then -- stale reference to a missing clan record: just detach
			setClan(player, "")
			applyTag(player, nil)
			return "OK"
		end
		local uid = tostring(player.UserId)
		modify(id :: string, function(c)
			if not c then
				return nil
			end
			c.members[uid] = nil
			if c.owner == player.UserId then -- hand over to an officer, else anyone
				local heir, best = nil, "9"
				for k, m in pairs(c.members) do
					if m.role < best then
						heir, best = k, m.role
					end
				end
				if heir then
					c.owner = tonumber(heir)
					c.members[heir].role = "1Leader"
				end
			end
			return c
		end)
		setClan(player, "")
		applyTag(player, nil)
		return "OK"
	end), 2)

	-- action: "kick" | "promote" | "demote"
	Net.handle("ClanManage", guarded(function(player, targetUserId, action)
		local id, clan = myClan(player)
		if not clan or type(targetUserId) ~= "number" then
			return "Invalid"
		end
		local mine = clan.members[tostring(player.UserId)]
		local me = mine and mine.role
		local key = tostring(targetUserId)
		local them = clan.members[key]
		if not me or not them or me >= them.role then
			return "No permission"
		end
		if action ~= "kick" and action ~= "promote" and action ~= "demote" then
			return "Invalid"
		end
		modify(id :: string, function(c)
			local m = c and c.members[key]
			if not m then
				return c
			end
			if action == "kick" then
				c.members[key] = nil
			elseif action == "promote" and me == "1Leader" then
				m.role = "2Officer"
			elseif action == "demote" and me == "1Leader" then
				m.role = "3Member"
			end
			return c
		end)
		local target = Players:GetPlayerByUserId(targetUserId)
		if target and action == "kick" then
			setClan(target, "")
			applyTag(target, nil)
		end
		return "OK"
	end), 3)

	Net.handle("ClanWarTop", function()
		if os.clock() - warCache.t > 120 then
			warCache.t = os.clock()
			local ws = warStore()
			local ok, pages = false, nil
			if ws then
				ok, pages = pcall(ws.GetSortedAsync, ws, false, 10)
			end
			local list = {}
			if ok and pages then
				for rank, e in ipairs(pages:GetCurrentPage()) do
					local clan = load(e.key)
					table.insert(list, { rank = rank, name = clan and clan.name or "?", tag = clan and clan.tag or "", xp = e.value })
				end
			end
			warCache.list = list
		end
		return warCache.list
	end, 2)

	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(60)
			flush()
		end
	end)
	game:BindToClose(flush)
end

return ClanService
