-- Co-op raid: 10 waves, mini-boss at 5, raid boss at 10. Rewards scale with the party's best zone tier.
local Raid = {
	Waves = 10, MiniBossWave = 5, BossWave = 10,
	MaxPlayers = 4, WaveSeconds = 90, IntermissionSeconds = 4, RespawnSeconds = 5,
	MaxArenas = 3, ArenaSpacing = 200, ArenaOrigin = Vector3.new(700, 0, 0), ArenaSize = 140,
	MaxAlive = 20, -- hard cap on simultaneous raid monsters per raid
	-- per wave: count = min(MaxAlive, BaseCount + CountPerWave * wave); hp x (1 + HpPerWave*(wave-1)); x(1+0.25*(players-1))
	BaseCount = 3, CountPerWave = 1.2, HpPerWave = 0.18, PartyHpBonus = 0.25,
	MiniBossHp = 0.35, BossHp = 1.0, -- fraction of the tier boss HP (before wave/party scaling)
	-- rewards per cleared wave, indexed by tier
	CoinsPerWave = { 300, 3000, 25000, 200000, 1500000 },
	GemsPerWave = 2, TokensPerWave = 1, ClearBonus = { Gems = 25, Tokens = 10 },
	DailyFirstClear = { Gems = 50, Tokens = 15, CoinsMult = 5 }, -- CoinsMult x CoinsPerWave[tier]
	-- Raid Token shop. kind: boost | gems | mats | rare | title
	Shop = {
		{ id = "boost", name = "Training Boost 15 min", desc = "Boosted training for 15 minutes", cost = 30, kind = "boost", seconds = 900 },
		{ id = "gems", name = "Gem Pouch", desc = "100 Gems", cost = 25, kind = "gems", amount = 100 },
		{ id = "mats", name = "Material Pack", desc = "Common + core materials of your best tier", cost = 15, kind = "mats" },
		{ id = "rare", name = "Rare Material Crate", desc = "2 boss materials of your best tier", cost = 45, kind = "rare" },
		{ id = "title", name = "Trail Title: Raid Slayer", desc = "Exclusive title (one time)", cost = 150, kind = "title", title = "Raid Slayer" },
	},
}
return Raid
