-- Story quests (Commander Vex). Progress is derived from data.stats; data.story.progress is the stat baseline of the current step.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config.Story)
local Achievements = require(ReplicatedStorage.Shared.Config.Achievements)
local Net = require(ReplicatedStorage.Shared.Net)
local Rewards = require(script.Parent.ProgressRewards)

local StoryService = {}
local S
local lastSent = {}

local function value(d, step): number
	local st = d.story
	if step.kind == "power" then
		return d.stats.Power or 0
	elseif step.kind == "stat" then
		return math.max(0, (d.stats[step.stat] or 0) - (st.progress or 0))
	end
	return Achievements.Value(d, step.kind)
end

local function state(player: Player)
	local d = S.DataService.Get(player)
	if not d then
		return nil
	end
	local n = d.story.step
	local step = Config.Steps[n]
	if not step then
		return { step = n, total = #Config.Steps, finished = true }
	end
	local v = math.min(math.floor(value(d, step)), step.goal)
	return { step = n, total = #Config.Steps, text = step.text, value = v, goal = step.goal, done = v >= step.goal, reward = step.reward }
end

local function push(player: Player, force: boolean?)
	local st = state(player)
	if not st then
		return
	end
	local key = ("%d:%s:%s"):format(st.step, tostring(st.value), tostring(st.done))
	if force or lastSent[player] ~= key then
		lastSent[player] = key
		Net.fire(player, "StoryState", st)
	end
end

function StoryService.Init(services)
	S = services
	Net.declare("StoryState")

	S.DataService.Loaded:Connect(function(player)
		push(player, true)
	end)
	Players.PlayerRemoving:Connect(function(p)
		lastSent[p] = nil
	end)

	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(4)
			for _, p in ipairs(Players:GetPlayers()) do
				push(p)
			end
		end
	end)

	Net.handle("StoryInfo", state, 3)

	Net.on("StoryClaim", function(player)
		local d = S.DataService.Get(player)
		local st = state(player)
		if not d or not st or st.finished or not st.done then
			return
		end
		local nextStep = Config.Steps[st.step + 1]
		S.DataService.Update(player, function(x)
			x.story.step = st.step + 1
			x.story.progress = (nextStep and nextStep.kind == "stat") and (x.stats[nextStep.stat] or 0) or 0
		end)
		Rewards.Grant(S, player, Config.Steps[st.step].reward, "story")
		S.EconomyService.Toast(player, (Config.Npc .. ": Well done, soldier! Step %d complete."):format(st.step), "success")
		push(player, true)
	end, 3)
end

return StoryService
