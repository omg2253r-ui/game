-- ProximityPrompts on hub stations (names are MapService contracts). Client opens the matching
-- panel via ProximityPromptService.PromptTriggered + the prompt's "Panel" attribute.
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Zones = require(ReplicatedStorage.Shared.Config.Zones)

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

function StationService.Init(services)
	task.spawn(function()
		local map = Workspace:WaitForChild("Map", 30)
		local hub = map and map:WaitForChild("Hub", 30)
		if not hub then
			warn("[StationService] no Map.Hub")
			return
		end
		-- stage portals (hub) + return portals (inside each stage): server-side teleport
		local function teleport(player: Player, to: Vector3)
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
			if root and not player:GetAttribute("MatchId") then
				root.CFrame = CFrame.new(to + Vector3.new(0, 4, 0))
			end
		end
		local zonesFolder = map:WaitForChild("Zones", 30)
		for _, z in ipairs(Zones) do
			local portal = hub:WaitForChild("Portal_" .. z.id, 10)
			if portal and portal:IsA("BasePart") then
				local pp = Instance.new("ProximityPrompt")
				pp.ObjectText = z.name
				pp.ActionText = "Teleport"
				pp.MaxActivationDistance = 12
				pp.RequiresLineOfSight = false
				pp.Parent = portal
				pp.Triggered:Connect(function(player)
					if services.PlayerService.GetPower(player) < z.powerReq then
						services.EconomyService.Toast(player, ("Need %d Power for %s"):format(z.powerReq, z.name), "error")
						return
					end
					teleport(player, (z.gatePos :: Vector3) + Vector3.new(0, 0, -20))
				end)
			end
			local zm = zonesFolder and zonesFolder:FindFirstChild(z.id)
			local back = zm and zm:FindFirstChild("ReturnPortal_" .. z.id, true)
			if back and back:IsA("BasePart") then
				local pp = Instance.new("ProximityPrompt")
				pp.ObjectText = "Hub"
				pp.ActionText = "Return"
				pp.MaxActivationDistance = 12
				pp.RequiresLineOfSight = false
				pp.Parent = back
				pp.Triggered:Connect(function(player)
					teleport(player, Vector3.new(0, 0, 0))
				end)
			end
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
