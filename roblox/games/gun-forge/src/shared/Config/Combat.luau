-- Player survival + PvP queue settings.
return {
	PlayerBaseHp = 100,
	PowerHpFactor = 1.0, -- + sqrt(Power) * factor  (PvE only)
	RegenDelay = 4, RegenPerSecond = 0.06, -- fraction of max HP
	MonsterDamageScale = 0.5, -- global balance knob
	MonsterAggroRange = 45, MonsterAttackRange = 7, MonsterAttackCooldown = 1.6,
	FireTolerance = 0.85, -- server accepts shots at >= 85% of nominal interval (latency)
	Arena = {
		Modes = {
			Duel = { name = "1v1", teamSize = 1, killsToWin = 5, minutes = 3 },
			Duo = { name = "2v2", teamSize = 2, killsToWin = 10, minutes = 4 },
			Squad = { name = "4v4", teamSize = 4, killsToWin = 20, minutes = 5 },
		},
		RespawnSeconds = 3, EloK = 32, WinCoins = 300, LoseCoins = 75,
	},
	Tournament = { IntervalMinutes = 30, Size = 8, EntryCoins = 500, SignupSeconds = 60, KillsToWin = 3, PrizeGems = 40 },
	Clan = { CreateCoins = 25000, MaxMembers = 30, TagMaxLen = 4, NameMaxLen = 20, XpPerKill = 1, XpPerPvpWin = 25, PerkPerLevel = 0.05, XpPerLevel = 5000 },
	WorldBoss = { IntervalMinutes = 20, Hp = 2000000, Position = Vector3.new(0, 0, 90) },
}
