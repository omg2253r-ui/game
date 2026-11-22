-- Client entry: controllers only do presentation; the server owns all game state.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)

local Controllers = script.Parent:WaitForChild("Controllers")
local UIController = require(Controllers.UIController)
local EffectsController = require(Controllers.EffectsController)

UIController.Init()
task.spawn(EffectsController.Init)

UIController.SettingsChanged = function(settings)
	EffectsController.SetLowFx(settings.lowFx == true)
end

Net.listen("DataSync", function(state)
	UIController.Apply(state)
	EffectsController.SetLowFx(state.settings and state.settings.lowFx == true)
end)
Net.listen("Toast", UIController.Toast)
Net.listen("RewardState", UIController.RenderRewards)
Net.listen("QuestState", UIController.RenderQuests)

-- initial pull (in case DataSync fired before listeners connected)
task.spawn(function()
	local state = Net.invoke("GetData")
	if state then
		UIController.Apply(state)
	end
end)
