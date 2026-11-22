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
G.Types = {
	pistol = { name = "Pistol", dmg = 10, rate = 3, range = 60, pellets = 1, minTier = 1, color = Color3.fromRGB(70, 70, 80) },
	smg = { name = "SMG", dmg = 4.5, rate = 8, range = 50, pellets = 1, minTier = 1, color = Color3.fromRGB(60, 90, 120) },
	shotgun = { name = "Shotgun", dmg = 5, rate = 1.2, range = 35, pellets = 6, minTier = 1, color = Color3.fromRGB(120, 80, 50) },
	rifle = { name = "Rifle", dmg = 9, rate = 4, range = 90, pellets = 1, minTier = 2, color = Color3.fromRGB(80, 100, 70) },
	blaster = { name = "Blaster", dmg = 20, rate = 2, range = 70, pellets = 1, minTier = 3, color = Color3.fromRGB(58, 216, 255) },
	railgun = { name = "Railgun", dmg = 75, rate = 0.6, range = 140, pellets = 1, minTier = 4, color = Color3.fromRGB(255, 79, 216) },
}
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

function G.ArmorHp(slot: string, tier: number, rarity: number, quality: number): number
	return math.floor(G.Armor[slot].hp * G.Rarities[rarity].mult * G.TierMult[tier] * quality)
end

-- PvP: everyone normalized (type matters, rarity a little, Power/passes never)
G.PvP = { BaseHp = 100, DamageScale = 1.0, RarityBonus = 0.04 } -- +4% per rarity step

return G
