-- Routes hub ProximityPrompts (attribute "Panel", set by StationService) to the right UI.
local ProximityPromptService = game:GetService("ProximityPromptService")

local UIController = require(script.Parent.UIController)
local MG = require(script.Parent.MinigameController)
local Forge = require(script.Parent.ForgeController)
local Inv = require(script.Parent.InventoryController)
local Arena = require(script.Parent.ArenaController)
local Clan = require(script.Parent.ClanController)

local Station = {}

function Station.Init()
	ProximityPromptService.PromptTriggered:Connect(function(prompt)
		local panel = prompt:GetAttribute("Panel")
		if type(panel) ~= "string" then
			return
		end
		local game_ = panel:match("^Minigame:(%w+)$")
		if game_ then
			MG.Play(game_)
			return
		end
		UIController.Open(panel)
		if panel == "Forge" then
			Forge.Render()
		elseif panel == "Rebirth" then
			task.spawn(Inv.DrawRebirth)
		elseif panel == "Arena" then
			task.spawn(Arena.Render)
		elseif panel == "Clan" then
			task.spawn(Clan.Render)
		end
	end)
end

return Station
