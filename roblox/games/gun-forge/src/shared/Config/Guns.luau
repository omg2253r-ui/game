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
-- mag/reload = magazine + reload seconds, spread = hip cone (deg), recoil = camera kick (deg),
-- crit = random crit chance (low; headshots are the main crit), falloff = dmg multiplier at max range (linear from 60% range)
-- Realism (client feel, never changes damage): modes = allowed fire modes (first = default), burst = shots per burst,
-- fov = ADS field of view, adsSpread/adsRecoil/adsSpeed = ADS multipliers, vKick/hKick = recoil pattern per shot (deg),
-- bloom = spread added per shot (deg, decays), bloomMax, charge = charge-up seconds, scope = ADS scope overlay,
-- eject = shell casings, tail = distant report, travel = bullet speed studs/s (tracer travel time)
G.Types = {
	pistol = { name = "Pistol", dmg = 11, rate = 3.5, range = 60, pellets = 1, minTier = 1, color = Color3.fromRGB(70, 70, 80),
		mag = 12, reload = 1.1, spread = 0.9, recoil = 1.2, crit = 0.05, falloff = 0.75, sound = "pistol",
		modes = { "semi", "burst" }, burst = 3, fov = 62, adsSpread = 0.35, adsRecoil = 0.6, adsSpeed = 0.75,
		vKick = 1.0, hKick = 0.35, bloom = 0.35, bloomMax = 2.5, eject = true, tail = true, travel = 520 },
	smg = { name = "SMG", dmg = 3.6, rate = 11, range = 50, pellets = 1, minTier = 1, color = Color3.fromRGB(60, 90, 120),
		mag = 32, reload = 1.6, spread = 2.2, recoil = 0.6, crit = 0.03, falloff = 0.6, sound = "smg",
		modes = { "auto", "burst", "semi" }, burst = 3, fov = 64, adsSpread = 0.5, adsRecoil = 0.65, adsSpeed = 0.8,
		vKick = 0.55, hKick = 0.45, bloom = 0.3, bloomMax = 5, eject = true, tail = false, travel = 480 },
	shotgun = { name = "Shotgun", dmg = 4.5, rate = 1.1, range = 30, pellets = 8, minTier = 1, color = Color3.fromRGB(120, 80, 50),
		mag = 6, reload = 2.2, spread = 6, recoil = 3.5, crit = 0.03, falloff = 0.35, sound = "shotgun",
		modes = { "semi" }, burst = 1, fov = 66, adsSpread = 0.6, adsRecoil = 0.7, adsSpeed = 0.75,
		vKick = 3.0, hKick = 0.8, bloom = 0.5, bloomMax = 2, eject = true, tail = true, travel = 380 },
	rifle = { name = "Rifle", dmg = 8, rate = 5, range = 100, pellets = 1, minTier = 2, color = Color3.fromRGB(80, 100, 70),
		mag = 30, reload = 1.9, spread = 1.2, recoil = 1.0, crit = 0.04, falloff = 0.85, sound = "rifle",
		modes = { "auto", "burst", "semi" }, burst = 3, fov = 55, adsSpread = 0.3, adsRecoil = 0.55, adsSpeed = 0.7,
		vKick = 0.85, hKick = 0.4, bloom = 0.25, bloomMax = 4, eject = true, tail = true, travel = 650 },
	blaster = { name = "Blaster", dmg = 22, rate = 1.8, range = 70, pellets = 1, minTier = 3, color = Color3.fromRGB(58, 216, 255),
		mag = 10, reload = 1.6, spread = 0.6, recoil = 1.8, crit = 0.06, falloff = 0.8, sound = "blaster",
		modes = { "semi" }, burst = 1, fov = 58, adsSpread = 0.4, adsRecoil = 0.6, adsSpeed = 0.75,
		vKick = 1.6, hKick = 0.3, bloom = 0.5, bloomMax = 2.5, eject = false, tail = true, travel = 300 },
	railgun = { name = "Railgun", dmg = 80, rate = 0.55, range = 140, pellets = 1, minTier = 4, color = Color3.fromRGB(255, 79, 216),
		mag = 4, reload = 2.6, spread = 0.3, recoil = 5, crit = 0.08, falloff = 1, sound = "railgun",
		modes = { "semi" }, burst = 1, fov = 28, adsSpread = 0.1, adsRecoil = 0.7, adsSpeed = 0.55, scope = true, charge = 0.6,
		vKick = 4.5, hKick = 0.5, bloom = 0.6, bloomMax = 1.5, eject = false, tail = true, travel = 1200 },
}
G.FireModes = { "semi", "burst", "auto" }
-- Burst: shots inside a burst fire at rate * RateMult; the pause before the next burst keeps the average at `rate`
G.Burst = { RateMult = 1.8 }
-- Weak point: top HeadFraction of a monster's height is its head; crit when the aim point lies in it
G.HeadFraction = 0.35
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
