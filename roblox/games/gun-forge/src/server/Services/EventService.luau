-- Global events: weekly (2x weekend), special date ranges, hourly happy hour.
-- PlayerService multiplies training/drops/coins by EventService.Mult(kind).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Events = require(ReplicatedStorage.Shared.Config.Events)
local Net = require(ReplicatedStorage.Shared.Net)

local EventService = {}
local active = {}

local function compute()
	local now = os.time()
	local t = os.date("!*t", now)
	local wday = t.wday - 1 -- 0 = Sunday
	local list = {}
	for _, e in ipairs(Events.Weekly) do
		if table.find(e.days, wday) then
			-- ends at next UTC midnight after the last listed day; good enough for a banner timer
			table.insert(list, { name = e.name, train = e.train, drops = e.drops, coins = e.coins, color = e.color, endsAt = now - (t.hour * 3600 + t.min * 60 + t.sec) + 86400 })
		end
	end
	for _, e in ipairs(Events.Special) do
		if e.start > 0 and now >= e.start and now < e.finish then
			table.insert(list, { name = e.name, train = e.train, drops = e.drops, coins = e.coins, color = e.color, endsAt = e.finish })
		end
	end
	local h = Events.HappyHour
	if t.min < h.minutes then
		table.insert(list, { name = h.name, train = h.train, drops = h.drops, coins = h.coins, color = h.color, endsAt = now - t.min * 60 - t.sec + h.minutes * 60 })
	end
	return list
end

function EventService.Mult(kind: string): number
	local m = 1
	for _, e in ipairs(active) do
		m *= e[kind] or 1
	end
	return m
end

function EventService.Init()
	Net.declare("EventState")
	Players.PlayerAdded:Connect(function(p)
		task.wait(3)
		Net.fire(p, "EventState", active)
	end)
	task.spawn(function()
		local last = ""
		while true do -- lint-ok (task.wait)
			active = compute()
			local sig = ""
			for _, e in ipairs(active) do
				sig ..= e.name
			end
			if sig ~= last then
				last = sig
				Net.fireAll("EventState", active)
				for _, e in ipairs(active) do
					Net.fireAll("Announce", "🎉 " .. e.name .. " is LIVE!")
				end
			end
			task.wait(20)
		end
	end)
end

return EventService
