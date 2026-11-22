-- Monster zones in a ring around the hub (hub at origin). World Builder builds geometry from this.
-- center/size in studs. preset = Config/World.luau preset applied client-side when inside.
return {
	{ id = "meadow", name = "Slime Meadow", powerReq = 0, tier = 1, center = Vector3.new(0, 0, -260), size = Vector3.new(220, 0, 220),
		preset = "SunnyCartoon", color = Color3.fromRGB(110, 200, 95), monsters = { "slime", "big_slime", "bouncer" }, boss = "slime_king", maxAlive = 12 },
	{ id = "desert", name = "Scrap Desert", powerReq = 2000, tier = 2, center = Vector3.new(250, 0, -80), size = Vector3.new(220, 0, 220),
		preset = "FantasySunset", color = Color3.fromRGB(225, 190, 120), monsters = { "scrap_bot", "sand_crab", "rust_drone" }, boss = "sand_titan", maxAlive = 12 },
	{ id = "frost", name = "Frost Cavern", powerReq = 25000, tier = 3, center = Vector3.new(155, 0, 215), size = Vector3.new(220, 0, 220),
		preset = "SunnyCartoon", color = Color3.fromRGB(200, 235, 255), monsters = { "snowling", "ice_bat", "frost_golem" }, boss = "yeti_lord", maxAlive = 12 },
	{ id = "magma", name = "Magma Foundry", powerReq = 300000, tier = 4, center = Vector3.new(-155, 0, 215), size = Vector3.new(220, 0, 220),
		preset = "SpookyNight", color = Color3.fromRGB(80, 50, 45), monsters = { "ember", "lava_hound", "forge_brute" }, boss = "magma_overseer", maxAlive = 12 },
	{ id = "void", name = "Neon Void", powerReq = 5000000, tier = 5, center = Vector3.new(-250, 0, -80), size = Vector3.new(220, 0, 220),
		preset = "NeonCity", color = Color3.fromRGB(40, 20, 70), monsters = { "void_wisp", "glitch", "void_knight" }, boss = "void_emperor", maxAlive = 12 },
}
