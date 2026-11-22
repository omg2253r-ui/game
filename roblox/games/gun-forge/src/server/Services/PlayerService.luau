-- Central player stats: Power (leaderstat), combined multipliers, max HP, arena flag.
-- Genre services call these instead of re-implementing multiplier math.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = ReplicatedStorage.Shared.Config
local Training = require(Config.Training)
local Guns = require(Config.Guns)
local Combat = require(Config.Combat)

local PlayerService = {}
local S -- services

function PlayerService.GetPower(player: Player): number
	local d = S.DataService.Get(player)
	return d and d.stats.Power or 0
end

local function setLeaderstat(player: Player, power: number)
	local ls = player:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild("Power")
	if v then
		(v :: IntValue).Value = math.floor(power)
	end
end

function PlayerService.AddPower(player: Player, amount: number)
	if not (amount > 0) or amount == math.huge then -- also rejects NaN (would corrupt saved Power)
		return
	end
	local power = 0
	S.DataService.Update(player, function(d)
		d.stats.Power += amount
		power = d.stats.Power
	end)
	setLeaderstat(player, power)
end

function PlayerService.SetPower(player: Player, value: number)
	S.DataService.Update(player, function(d)
		d.stats.Power = value
	end)
	setLeaderstat(player, value)
end

function PlayerService.InArena(player: Player): boolean
	return player:GetAttribute("MatchId") ~= nil
end

-- Training gain multiplier (without the temporary x2 pulse, which TrainingService adds)
function PlayerService.TrainMultiplier(player: Player): number
	local d = S.DataService.Get(player)
	if not d then
		return 1
	end
	local m = S.MonetizationService.GetMultiplier(player, "trainMultiplier")
	m *= Training.RebirthMultiplier ^ d.rebirths
	m *= S.PetService.Multipliers(player).power
	if d.boostUntil > os.time() then
		m *= Training.ProductBoost.Multiplier
	end
	return m
end

function PlayerService.BaseGain(power: number): number
	return Training.Base + math.sqrt(math.max(0, power)) * Training.SqrtFactor
end

-- Extra coin multiplier on top of the pass multiplier EconomyService applies itself
function PlayerService.CoinBonus(player: Player): number
	return S.PetService.Multipliers(player).coins * (1 + S.ClanService.Perk(player))
end

function PlayerService.DropMultiplier(player: Player): number
	return S.MonetizationService.GetMultiplier(player, "dropMultiplier") * (1 + S.ClanService.Perk(player))
end

function PlayerService.ArmorHp(player: Player): number
	local d = S.DataService.Get(player)
	if not d then
		return 0
	end
	local hp = 0
	for _, slot in ipairs(Guns.ArmorOrder) do
		local item = d.items[d.equipped[slot]]
		if item and item.kind == "armor" then
			hp += item.hp
		end
	end
	return hp
end

function PlayerService.MaxHp(player: Player): number
	if PlayerService.InArena(player) then
		return Guns.PvP.BaseHp
	end
	return math.floor(Combat.PlayerBaseHp + math.sqrt(PlayerService.GetPower(player)) * Combat.PowerHpFactor + PlayerService.ArmorHp(player))
end

-- Apply max HP + boots speed to the current character (call after gear/arena changes)
function PlayerService.RefreshCharacter(player: Player)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	local maxHp = PlayerService.MaxHp(player)
	local ratio = if hum.MaxHealth > 0 then hum.Health / hum.MaxHealth else 1
	hum.MaxHealth = maxHp
	hum.Health = math.max(1, maxHp * ratio)
	local speed = 16
	local d = S.DataService.Get(player)
	if d and not PlayerService.InArena(player) then
		local boots = d.items[d.equipped.boots]
		if boots and boots.kind == "armor" then
			speed += (Guns.Armor.boots.speed or 0) * boots.tier * 2
		end
		local passSpeed = S.MonetizationService.GetPerk(player, "walkSpeed")
		if passSpeed then
			speed = math.max(speed, passSpeed)
		end
	end
	hum.WalkSpeed = speed
end

function PlayerService.Init(services)
	S = services
	S.DataService.Loaded:Connect(function(player, data)
		local ls = player:WaitForChild("leaderstats", 10)
		if ls and not ls:FindFirstChild("Power") then
			local v = Instance.new("IntValue")
			v.Name = "Power"
			v.Value = math.floor(data.stats.Power)
			v.Parent = ls
		end
		PlayerService.RefreshCharacter(player)
	end)

	-- regen out of combat
	local lastHit: { [Player]: number } = {}
	PlayerService.MarkHit = function(player: Player)
		lastHit[player] = os.clock()
	end
	Players.PlayerRemoving:Connect(function(p)
		lastHit[p] = nil
	end)
	local function hook(player: Player)
		player.CharacterAdded:Connect(function(char)
			local hum = char:WaitForChild("Humanoid", 5) :: Humanoid?
			if not hum then
				return
			end
			hum.BreakJointsOnDeath = false
			task.wait()
			PlayerService.RefreshCharacter(player)
			hum.Health = hum.MaxHealth
			local last = hum.Health
			hum.HealthChanged:Connect(function(h)
				if h < last then
					lastHit[player] = os.clock()
				end
				last = h
			end)
		end)
	end
	Players.PlayerAdded:Connect(hook)
	for _, p in ipairs(Players:GetPlayers()) do
		hook(p)
	end
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(1)
			for _, p in ipairs(Players:GetPlayers()) do
				local hum = p.Character and p.Character:FindFirstChildOfClass("Humanoid")
				if hum and hum.Health > 0 and hum.Health < hum.MaxHealth and os.clock() - (lastHit[p] or 0) > Combat.RegenDelay then
					hum.Health = math.min(hum.MaxHealth, hum.Health + hum.MaxHealth * Combat.RegenPerSecond)
				end
			end
		end
	end)
end

PlayerService.MarkHit = function(_player: Player) end

return PlayerService
