-- Default save data. New keys are merged into old saves automatically (reconcile).
-- Never rename keys after launch; add new ones instead.
local Economy = require(script.Parent.Economy)

local currencies = {}
for name, def in pairs(Economy.Currencies) do
	currencies[name] = def.start
end

return {
	version = 1,
	currencies = currencies,
	stats = { Collect = 0, Earn = 0, Minutes = 0, Purchases = 0 },
	inventory = {}, -- [itemId] = count
	equipped = {}, -- [slot] = itemId
	daily = { lastDay = 0, streak = 0 },
	quests = { day = 0, list = {} },
	settings = { music = true, sfx = true, lowFx = false },
	receipts = {}, -- processed PurchaseIds (idempotency, trimmed to last 50)
	firstJoin = 0,
}
