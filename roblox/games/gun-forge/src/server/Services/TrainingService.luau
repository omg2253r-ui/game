-- AFK training: Power every tick, x2 Pulse (tap to boost), offline earnings, x3 boost product.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Training = require(Shared.Config.Training)
local Net = require(Shared.Net)

local TrainingService = {}
local S
type State = { training: boolean, nextPulse: number, offerUntil: number, pulseUntil: number, pulses: number }
local state: { [Player]: State } = {}
local rng = Random.new()

local function push(player: Player)
	local st = state[player]
	local d = S.DataService.Get(player)
	if not st or not d then
		return
	end
	local power = d.stats.Power
	local mult = S.PlayerService.TrainMultiplier(player) * (if os.clock() < st.pulseUntil then Training.Pulse.Multiplier else 1)
	Net.fire(player, "TrainState", {
		training = st.training,
		gain = S.PlayerService.BaseGain(power) * mult,
		mult = mult,
		pulseLeft = math.max(0, st.pulseUntil - os.clock()),
		boostLeft = math.max(0, d.boostUntil - os.time()),
		rebirths = d.rebirths,
	})
end
TrainingService.Push = push

function TrainingService.GainPerSecond(player: Player): number
	return S.PlayerService.BaseGain(S.PlayerService.GetPower(player)) * S.PlayerService.TrainMultiplier(player)
end

-- grant N seconds worth of training (minigames, crates)
function TrainingService.GrantSeconds(player: Player, seconds: number): number
	local amount = math.floor(TrainingService.GainPerSecond(player) * seconds)
	S.PlayerService.AddPower(player, amount)
	return amount
end

local function offline(player: Player, data)
	local cfg = Training.Offline
	if data.lastSeen <= 0 then
		return
	end
	local elapsed = math.min(os.time() - data.lastSeen, cfg.MaxHours * 3600)
	if elapsed < cfg.MinMinutes * 60 then
		return
	end
	local gain = math.floor(S.PlayerService.BaseGain(data.stats.Power) * S.PlayerService.TrainMultiplier(player) * cfg.Rate * elapsed)
	if gain > 0 then
		S.PlayerService.AddPower(player, gain)
		task.delay(4, function()
			S.EconomyService.Toast(player, ("While you were away: +%d Power"):format(gain), "success")
		end)
	end
end

function TrainingService.Init(services)
	S = services
	Net.declare("TrainState")
	Net.declare("PulseOffer")

	S.DataService.Loaded:Connect(function(player, data)
		state[player] = { training = true, nextPulse = os.clock() + Training.Pulse.FirstAt, offerUntil = 0, pulseUntil = 0, pulses = 0 }
		offline(player, data)
		push(player)
	end)
	Players.PlayerRemoving:Connect(function(p)
		state[p] = nil
	end)

	Net.on("SetTraining", function(player, on)
		local st = state[player]
		if st and type(on) == "boolean" then
			st.training = on
			push(player)
		end
	end, 4)

	Net.on("PulseTap", function(player)
		local st = state[player]
		if not st or os.clock() > st.offerUntil + 0.5 then
			return
		end
		st.offerUntil = 0
		st.pulseUntil = os.clock() + Training.Pulse.BoostSeconds
		S.QuestService.Progress(player, "X2Taps", 1)
		S.EconomyService.Toast(player, "x2 TRAINING ACTIVE!", "success")
		push(player)
	end, 3)

	S.MonetizationService.ProductHandlers.TrainBoost = function(player)
		local cfg = Training.ProductBoost
		S.DataService.Update(player, function(d)
			d.boostUntil = math.max(os.time(), d.boostUntil) + cfg.Seconds
		end)
		push(player)
		return true
	end

	task.spawn(function()
		local tick = 0
		while true do -- lint-ok (task.wait)
			task.wait(Training.TickSeconds)
			tick += 1
			local now = os.clock()
			for player, st in pairs(state) do
				local d = S.DataService.Get(player)
				if d and st.training and not S.PlayerService.InArena(player) then
					local mult = S.PlayerService.TrainMultiplier(player) * (if now < st.pulseUntil then Training.Pulse.Multiplier else 1)
					S.PlayerService.AddPower(player, S.PlayerService.BaseGain(d.stats.Power) * mult * Training.TickSeconds)
					if now >= st.nextPulse then
						local p = Training.Pulse
						st.offerUntil = now + p.ShowSeconds
						st.nextPulse = now + rng:NextNumber(p.MinGap, p.MaxGap)
						Net.fire(player, "PulseOffer", p.ShowSeconds)
					end
				end
				if tick % 5 == 0 then
					push(player)
				end
				if tick % 60 == 0 then
					S.DataService.Update(player, function(data)
						data.lastSeen = os.time()
					end)
				end
			end
		end
	end)
end

return TrainingService
