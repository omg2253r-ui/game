-- Gun & armor stats. Final damage per hit = gun.dmg * PowerFactor(power)   (PvE only)
-- gun.dmg (stored on the item when forged) = Type.dmg * Rarity.mult * TierMult[tier] * quality
local G = {}

G.Rarities = {
	{ name = "Common", mult = 1.0, color = Color3.fromRGB(200, 200, 208), weight = 60 },
	{ name = "Rare", mult = 1.6, color = Color3.fromRGB(58, 216, 255), weight = 28 },
	{ name = "Epic", mult = 2.6, color = Color3.fromRGB(181, 108, 255), weight = 9 },
	{ name = "Legendary", mult = 4.2, color = Color3.fromRGB(255, 201, 53), weight = 2.5 },
	{ name = "Mythic", mult = 7.0, color = Color3.fromRGB(255, 79, 106), weight = 0.5 },
}
G.TierMult = { 1, 3, 9, 27, 81 }

-- rate = shots/sec, range studs, pellets multiply damage (hitscan on one target)
-- rate = shots/sec, range studs, pellets multiply damage (hitscan on one target)
-- mag/reload = magazine + reload seconds, spread = visual cone (deg), recoil = camera kick (deg),
-- crit = crit chance, falloff = damage multiplier at max range (linear from 60% range)
G.Types = {
	pistol = { name = "Pistol", dmg = 10, rate = 3, range = 60, pellets = 1, minTier = 1, color = Color3.fromRGB(70, 70, 80),
		mag = 12, reload = 1.1, spread = 1.5, recoil = 1.2, crit = 0.12, falloff = 0.75, sound = "pistol" },
	smg = { name = "SMG", dmg = 4.5, rate = 8, range = 50, pellets = 1, minTier = 1, color = Color3.fromRGB(60, 90, 120),
		mag = 30, reload = 1.6, spread = 3.5, recoil = 0.6, crit = 0.06, falloff = 0.6, sound = "smg" },
	shotgun = { name = "Shotgun", dmg = 5, rate = 1.2, range = 35, pellets = 6, minTier = 1, color = Color3.fromRGB(120, 80, 50),
		mag = 6, reload = 2.0, spread = 7, recoil = 3.5, crit = 0.05, falloff = 0.4, sound = "shotgun" },
	rifle = { name = "Rifle", dmg = 9, rate = 4, range = 90, pellets = 1, minTier = 2, color = Color3.fromRGB(80, 100, 70),
		mag = 24, reload = 1.8, spread = 1.0, recoil = 1.0, crit = 0.1, falloff = 0.85, sound = "rifle" },
	blaster = { name = "Blaster", dmg = 20, rate = 2, range = 70, pellets = 1, minTier = 3, color = Color3.fromRGB(58, 216, 255),
		mag = 10, reload = 1.5, spread = 0.8, recoil = 1.8, crit = 0.12, falloff = 0.8, sound = "blaster" },
	railgun = { name = "Railgun", dmg = 75, rate = 0.6, range = 140, pellets = 1, minTier = 4, color = Color3.fromRGB(255, 79, 216),
		mag = 4, reload = 2.4, spread = 0, recoil = 5, crit = 0.25, falloff = 1, sound = "railgun" },
}
G.CritMultiplier = 2
G.TypeOrder = { "pistol", "smg", "shotgun", "rifle", "blaster", "railgun" }

G.Armor = {
	helmet = { name = "Helmet", hp = 20 },
	vest = { name = "Vest", hp = 40 },
	boots = { name = "Boots", hp = 15, speed = 0.5 }, -- +WalkSpeed per tier
}
G.ArmorOrder = { "helmet", "vest", "boots" }

G.Starter = { kind = "gun", id = "pistol", tier = 1, rarity = 1, quality = 1 }

function G.PowerFactor(power: number): number
	return 1 + (math.max(0, power) ^ 0.6) / 5
end

function G.GunDamage(typeId: string, tier: number, rarity: number, quality: number): number
	local t = G.Types[typeId]
	return math.floor(t.dmg * t.pellets * G.Rarities[rarity].mult * G.TierMult[tier] * quality * 10 + 0.5) / 10
end

-- distance falloff: full damage up to 60% range, then linear to t.falloff at max range
function G.Falloff(typeId: string, dist: number): number
	local t = G.Types[typeId]
	local a = math.clamp((dist / t.range - 0.6) / 0.4, 0, 1)
	return 1 + (t.falloff - 1) * a
end

function G.ArmorHp(slot: string, tier: number, rarity: number, quality: number): number
	return math.floor(G.Armor[slot].hp * G.Rarities[rarity].mult * G.TierMult[tier] * quality)
end

-- Mastery: guns level up by getting kills (+DamagePerLevel each level, PvE only)
G.Mastery = { MaxLevel = 10, BaseXp = 25, Growth = 1.6, DamagePerLevel = 0.06, BossXp = 20 }
function G.MasteryXpNeeded(lvl: number): number
	return math.floor(G.Mastery.BaseXp * G.Mastery.Growth ^ lvl)
end

-- Enchants: one random bonus per gun (reroll replaces). PvE only.
G.Enchants = {
	{ kind = "dmg", name = "Sharpened", min = 0.05, max = 0.2, fmt = "+%d%% damage" },
	{ kind = "crit", name = "Lucky", min = 0.03, max = 0.1, fmt = "+%d%% crit chance" },
	{ kind = "rate", name = "Rapid", min = 0.05, max = 0.15, fmt = "+%d%% fire rate" },
	{ kind = "range", name = "Scoped", min = 0.1, max = 0.25, fmt = "+%d%% range" },
}
G.EnchantCost = { Gems = 25, RareCores = 2 } -- rare core of the gun's tier

-- PvP: everyone normalized (type matters, rarity a little, Power/passes never)
G.PvP = { BaseHp = 100, DamageScale = 1.0, RarityBonus = 0.04 } -- +4% per rarity step

return G
