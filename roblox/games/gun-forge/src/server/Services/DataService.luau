-- Player data: session-locked DataStore with retries, autosave, reconcile, BindToClose.
-- Falls back to an in-memory profile (not saved) when DataStores are unavailable
-- (e.g. Studio without "Enable Studio Access to API Services"), so the game stays playable.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Settings = require(Shared.Config.Settings)
local Template = require(Shared.Config.DataTemplate)
local Signal = require(Shared.Signal)

local LOCK_EXPIRE = 600 -- seconds; a lock older than this is considered dead
local MAX_LOAD_TRIES = 6

local DataService = {}
DataService.Loaded = Signal.new() -- (player, data)
DataService.Changed = Signal.new() -- (player, data)

local profiles: { [Player]: { data: any, offline: boolean, dirty: boolean } } = {}
local loadedWaiters: { [Player]: { thread } } = {}

local okStore, store = pcall(function()
	return DataStoreService:GetDataStore(Settings.DataStoreName)
end)
if not okStore then
	store = nil
	warn("[DataService] DataStore unavailable, running OFFLINE (data will not save)")
end

local function deepCopy(t)
	if type(t) ~= "table" then
		return t
	end
	local c = {}
	for k, v in pairs(t) do
		c[k] = deepCopy(v)
	end
	return c
end

local function reconcile(data, template)
	for k, v in pairs(template) do
		if data[k] == nil then
			data[k] = deepCopy(v)
		elseif type(v) == "table" and type(data[k]) == "table" then
			reconcile(data[k], v)
		end
	end
	return data
end

local function key(player: Player)
	return "u_" .. player.UserId
end

local function load(player: Player)
	if not store then
		return deepCopy(Template), true
	end
	for attempt = 1, MAX_LOAD_TRIES do
		local locked = false
		local ok, result = pcall(function()
			return store:UpdateAsync(key(player), function(old) -- lint-ok (pcall above)
				old = old or deepCopy(Template)
				local lock = old._lock
				if lock and lock.job ~= game.JobId and os.time() - lock.t < LOCK_EXPIRE then
					locked = true
					return nil -- abort write, another server still owns it
				end
				old._lock = { job = game.JobId, t = os.time() }
				return old
			end)
		end)
		if ok and result and not locked then
			return reconcile(result, Template), false
		end
		if not ok then
			warn("[DataService] load error:", result)
			if tostring(result):find("API Services") or tostring(result):find("StudioAccess") then
				return deepCopy(Template), true
			end
		end
		task.wait(math.min(2 ^ attempt, 15))
	end
	-- Could not acquire: kick to protect data from duplication
	player:Kick("Your data is still saving on another server. Please rejoin in a minute.")
	return nil, false
end

local function save(player: Player, release: boolean): boolean
	local p = profiles[player]
	if not p or p.offline or not store then
		return true
	end
	local data = p.data
	for attempt = 1, 4 do
		local ok, err = pcall(function()
			store:UpdateAsync(key(player), function(old) -- lint-ok (pcall above)
				if old and old._lock and old._lock.job ~= game.JobId then
					return nil -- someone stole the lock (expired); do not overwrite
				end
				data._lock = if release then nil else { job = game.JobId, t = os.time() }
				return data
			end)
		end)
		if ok then
			p.dirty = false
			return true
		end
		warn("[DataService] save error:", err)
		task.wait(attempt * 2)
	end
	return false
end

function DataService.Get(player: Player): any?
	local p = profiles[player]
	return p and p.data
end

-- Yields until the player's data is loaded (or the player leaves).
function DataService.WaitFor(player: Player): any?
	if profiles[player] then
		return profiles[player].data
	end
	if not player.Parent then
		return nil
	end
	loadedWaiters[player] = loadedWaiters[player] or {}
	table.insert(loadedWaiters[player], coroutine.running())
	return coroutine.yield()
end

-- Mutate data safely: DataService.Update(player, function(data) data.currencies.Coins += 5 end)
function DataService.Update(player: Player, fn: (any) -> ())
	local p = profiles[player]
	if not p then
		return false
	end
	fn(p.data)
	p.dirty = true
	DataService.Changed:Fire(player, p.data)
	return true
end

function DataService.Save(player: Player): boolean
	return save(player, false)
end

function DataService.IsOffline(player: Player): boolean
	local p = profiles[player]
	return p == nil or p.offline
end

local function onJoin(player: Player)
	local data, offline = load(player)
	if not data or not player.Parent then
		return
	end
	if data.firstJoin == 0 then
		data.firstJoin = os.time()
	end
	profiles[player] = { data = data, offline = offline, dirty = false }
	DataService.Loaded:Fire(player, data)
	for _, th in ipairs(loadedWaiters[player] or {}) do
		task.spawn(th, data)
	end
	loadedWaiters[player] = nil
end

local function onLeave(player: Player)
	if profiles[player] then
		save(player, true)
	end
	profiles[player] = nil
	for _, th in ipairs(loadedWaiters[player] or {}) do
		task.spawn(th, nil)
	end
	loadedWaiters[player] = nil
end

function DataService.Init()
	Players.PlayerAdded:Connect(onJoin)
	Players.PlayerRemoving:Connect(onLeave)
	for _, p in ipairs(Players:GetPlayers()) do
		task.spawn(onJoin, p)
	end

	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(Settings.AutosaveSeconds)
			for player, p in pairs(profiles) do
				if p.dirty then
					task.spawn(save, player, false)
				end
			end
		end
	end)

	game:BindToClose(function()
		local pending = 0
		for player in pairs(profiles) do
			pending += 1
			task.spawn(function()
				save(player, true)
				pending -= 1
			end)
		end
		local t = os.clock()
		while pending > 0 and os.clock() - t < 25 do
			task.wait(0.1)
		end
	end)
end

return DataService
