-- Client-side mirror of server pushes (Inv, TrainState). Controllers read + subscribe here.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Net = require(ReplicatedStorage.Shared.Net)
local Signal = require(ReplicatedStorage.Shared.Signal)

local State = {
	Inv = { materials = {}, items = {}, equipped = { gun = "", helmet = "", vest = "", boots = "", pets = {} }, index = { guns = {}, pets = {}, monsters = {} }, rebirths = 0 },
	Train = { training = true, gain = 0, mult = 1, pulseLeft = 0, boostLeft = 0, rebirths = 0 },
	InvChanged = Signal.new(),
	TrainChanged = Signal.new(),
}

function State.Power(): number
	local ls = Players.LocalPlayer:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild("Power")
	return v and (v :: IntValue).Value or 0
end

function State.Coins(): number
	local ls = Players.LocalPlayer:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild("Coins")
	return v and (v :: IntValue).Value or 0
end

function State.Init()
	Net.listen("Inv", function(inv)
		State.Inv = inv
		State.InvChanged:Fire(inv)
	end)
	Net.listen("TrainState", function(t)
		State.Train = t
		State.TrainChanged:Fire(t)
	end)
end

return State
