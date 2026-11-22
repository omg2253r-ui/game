-- ProximityPrompts on hub stations (names are MapService contracts). Client opens the matching
-- panel via ProximityPromptService.PromptTriggered + the prompt's "Panel" attribute.
local Workspace = game:GetService("Workspace")

local StationService = {}

local STATIONS = {
	Booth_TargetRush = { "Target Rush", "Play", "Minigame:TargetRush" },
	Booth_ReloadRhythm = { "Reload Rhythm", "Play", "Minigame:ReloadRhythm" },
	Booth_LuckyCrate = { "Lucky Crate", "Open", "Minigame:LuckyCrate" },
	Forge = { "Forge", "Craft", "Forge" },
	FusionAltar = { "Fusion Altar", "Fuse", "Pets" },
	RebirthStatue = { "Rebirth", "Rebirth", "Rebirth" },
	ArenaPortal = { "PvP Arena", "Queue", "Arena" },
	ClanBoard = { "Clans", "Open", "Clan" },
	CodesBoard = { "Codes", "Redeem", "Codes" },
}

function StationService.Init()
	task.spawn(function()
		local map = Workspace:WaitForChild("Map", 30)
		local hub = map and map:WaitForChild("Hub", 30)
		if not hub then
			warn("[StationService] no Map.Hub")
			return
		end
		for name, s in pairs(STATIONS) do
			local part = hub:WaitForChild(name, 10)
			if part and part:IsA("BasePart") then
				local pp = Instance.new("ProximityPrompt")
				pp.ObjectText = s[1]
				pp.ActionText = s[2]
				pp.HoldDuration = 0
				pp.MaxActivationDistance = 14
				pp.RequiresLineOfSight = false
				pp:SetAttribute("Panel", s[3])
				pp.Parent = part
			end
		end
	end)
end

return StationService
