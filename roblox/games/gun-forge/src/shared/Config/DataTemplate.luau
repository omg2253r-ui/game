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
	stats = { Power = 0, Kills = 0, BossKills = 0, X2Taps = 0, Minigames = 0, Crafts = 0, Fusions = 0, PvpWins = 0, Earn = 0, Minutes = 0, Purchases = 0 },
	inventory = {}, -- materials: [materialId] = count
	items = {}, -- [uid] = { kind = "gun"|"armor"|"pet", id = typeOrPetId, tier, rarity, dmg/hp/mult, golden }
	nextUid = 1,
	equipped = { gun = "", helmet = "", vest = "", boots = "", pets = {} },
	rebirths = 0,
	boostUntil = 0, -- x3 training product end (os.time)
	lastSeen = 0, -- offline earnings
	index = { guns = {}, pets = {}, monsters = {} },
	pvp = { rating = 1000, wins = 0, losses = 0, trophies = 0 },
	clan = "",
	codes = {},
	daily = { lastDay = 0, streak = 0 },
	quests = { day = 0, list = {} },
	settings = { music = true, sfx = true, lowFx = false },
	receipts = {}, -- processed PurchaseIds (idempotency, trimmed to last 50)
	firstJoin = 0,
}
