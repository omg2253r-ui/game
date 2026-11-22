-- LINEAR LANE: 5 stages chained on ONE long straight road leaving the hub towards -Z.
-- Hub (origin) -> Gate1 -> Stage 1 (300 studs) -> Gate2 -> Stage 2 -> ... -> Stage 5 (boss at each end).
-- center/size = the stage rectangle (width 48 along X, length 300 along Z). gatePos = gate at the stage
-- start (hub side). bossPos = far end. portalPos = return/teleport pad at the stage start.
local LANE_WIDTH, STAGE_LEN, GAP, HUB_EDGE = 48, 300, 30, 90
local function stage(i: number)
	local startZ = -(HUB_EDGE + (i - 1) * (STAGE_LEN + GAP))
	local endZ = startZ - STAGE_LEN
	return Vector3.new(0, 0, (startZ + endZ) / 2), Vector3.new(LANE_WIDTH, 0, STAGE_LEN), Vector3.new(0, 0, startZ), Vector3.new(0, 0, endZ + 25)
end

local Z = {
	{ id = "meadow", name = "Slime Meadow", powerReq = 0, tier = 1, stage = 1,
		preset = "SunnyCartoon", color = Color3.fromRGB(110, 200, 95), monsters = { "slime", "big_slime", "bouncer" }, boss = "slime_king", maxAlive = 12 },
	{ id = "desert", name = "Scrap Desert", powerReq = 2000, tier = 2, stage = 2,
		preset = "DesertDusk", color = Color3.fromRGB(225, 190, 120), monsters = { "scrap_bot", "sand_crab", "rust_drone" }, boss = "sand_titan", maxAlive = 12 },
	{ id = "frost", name = "Frost Cavern", powerReq = 25000, tier = 3, stage = 3,
		preset = "FrostHaze", color = Color3.fromRGB(200, 235, 255), monsters = { "snowling", "ice_bat", "frost_golem" }, boss = "yeti_lord", maxAlive = 12 },
	{ id = "magma", name = "Magma Foundry", powerReq = 300000, tier = 4, stage = 4,
		preset = "MagmaGlow", color = Color3.fromRGB(80, 50, 45), monsters = { "ember", "lava_hound", "forge_brute" }, boss = "magma_overseer", maxAlive = 12 },
	{ id = "void", name = "Neon Void", powerReq = 5000000, tier = 5, stage = 5,
		preset = "VoidNeon", color = Color3.fromRGB(40, 20, 70), monsters = { "void_wisp", "glitch", "void_knight" }, boss = "void_emperor", maxAlive = 12 },
}
Z.LaneWidth, Z.StageLength, Z.Gap = LANE_WIDTH, STAGE_LEN, GAP
for _, z in ipairs(Z) do
	z.center, z.size, z.gatePos, z.bossPos = stage(z.stage)
end
return Z
