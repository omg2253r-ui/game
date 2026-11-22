-- Currencies (server-authoritative), leaderstats, and client sync.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Economy = require(Shared.Config.Economy)
local Net = require(Shared.Net)
local Signal = require(Shared.Signal)

local EconomyService = {}
EconomyService.Earned = Signal.new() -- (player, currency, amount, source)

local DataService, MonetizationService -- injected in Init

local function syncLeaderstats(player: Player, data)
	local ls = player:FindFirstChild("leaderstats")
	if not ls then
		return
	end
	for name, def in pairs(Economy.Currencies) do
		if def.leaderstat then
			local v = ls:FindFirstChild(name)
			if v then
				v.Value = data.currencies[name] or 0
			end
		end
	end
end

-- Push a compact snapshot to the client (HUD, shop, quests read this).
function EconomyService.Sync(player: Player)
	local data = DataService.Get(player)
	if not data then
		return
	end
	syncLeaderstats(player, data)
	Net.fire(player, "DataSync", {
		currencies = data.currencies,
		inventory = data.inventory,
		equipped = data.equipped,
		settings = data.settings,
		passes = MonetizationService.OwnedList(player),
	})
end

function EconomyService.Get(player: Player, currency: string): number
	local data = DataService.Get(player)
	return data and data.currencies[currency] or 0
end

-- Adds currency. applyMultiplier=true for gameplay earnings (game passes boost them),
-- false for purchases/rewards with a fixed amount.
function EconomyService.Add(player: Player, currency: string, amount: number, source: string?, applyMultiplier: boolean?)
	assert(Economy.Currencies[currency], "unknown currency " .. tostring(currency))
	if amount <= 0 then
		return 0
	end
	if applyMultiplier and currency == "Coins" then
		amount = math.floor(amount * MonetizationService.GetMultiplier(player, "coinMultiplier"))
	end
	local ok = DataService.Update(player, function(d)
		d.currencies[currency] = (d.currencies[currency] or 0) + amount
	end)
	if ok then
		EconomyService.Earned:Fire(player, currency, amount, source or "unknown")
		EconomyService.Sync(player)
		return amount
	end
	return 0
end

function EconomyService.Spend(player: Player, currency: string, amount: number): boolean
	if amount < 0 then
		return false
	end
	local data = DataService.Get(player)
	if not data or (data.currencies[currency] or 0) < amount then
		return false
	end
	DataService.Update(player, function(d)
		d.currencies[currency] -= amount
	end)
	EconomyService.Sync(player)
	return true
end

-- reward = { Coins = 100, Gems = 5 }
function EconomyService.Grant(player: Player, reward: { [string]: number }, source: string?)
	for currency, amount in pairs(reward) do
		if Economy.Currencies[currency] then
			EconomyService.Add(player, currency, amount, source, false)
		end
	end
end

function EconomyService.Init(services)
	DataService = services.DataService
	MonetizationService = services.MonetizationService
	Net.declare("DataSync")
	Net.declare("Toast")

	DataService.Loaded:Connect(function(player, data)
		local ls = Instance.new("Folder")
		ls.Name = "leaderstats"
		for name, def in pairs(Economy.Currencies) do
			if def.leaderstat then
				local v = Instance.new("IntValue")
				v.Name = name
				v.Value = data.currencies[name] or 0
				v.Parent = ls
			end
		end
		ls.Parent = player
		EconomyService.Sync(player)
	end)

	Net.handle("GetData", function(player)
		local data = DataService.WaitFor(player)
		if not data then
			return nil
		end
		return {
			currencies = data.currencies,
			inventory = data.inventory,
			equipped = data.equipped,
			settings = data.settings,
			passes = MonetizationService.OwnedList(player),
		}
	end)

	Net.on("SetSetting", function(player, name, value)
		if type(name) ~= "string" or type(value) ~= "boolean" then
			return
		end
		DataService.Update(player, function(d)
			if d.settings[name] ~= nil then
				d.settings[name] = value
			end
		end)
	end, 5)
end

function EconomyService.Toast(player: Player, text: string, kind: string?)
	Net.fire(player, "Toast", text, kind or "info")
end

return EconomyService
