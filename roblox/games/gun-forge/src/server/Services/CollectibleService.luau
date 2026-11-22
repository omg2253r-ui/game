-- DEMO gameplay loop so a fresh template is instantly playable: glowing coins spawn
-- around the map, touching one pays out. Replace/extend with the genre's core loop
-- (keep the pattern: server spawns + validates, client only does visuals).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Cfg = require(Shared.Config.Settings).Collectibles
local Net = require(Shared.Net)

local CollectibleService = {}

function CollectibleService.Init(services)
	if not Cfg.Enabled then
		return
	end
	Net.declare("Collected")
	local folder = Instance.new("Folder")
	folder.Name = "Collectibles"
	folder.Parent = workspace

	-- Optional designer-placed spawn points: workspace.CoinSpawns (Parts)
	local spawns = workspace:FindFirstChild("CoinSpawns")
	local rng = Random.new()
	local active = 0

	local function spawnPoint(): Vector3
		if spawns and #spawns:GetChildren() > 0 then
			local list = spawns:GetChildren()
			return list[rng:NextInteger(1, #list)].Position + Vector3.new(0, 3, 0)
		end
		local r = Cfg.SpawnRadius
		local origin = Vector3.new(rng:NextNumber(-r, r), 60, rng:NextNumber(-r, r))
		local hit = workspace:Raycast(origin, Vector3.new(0, -120, 0))
		return (hit and hit.Position or Vector3.new(origin.X, 0, origin.Z)) + Vector3.new(0, 2.5, 0)
	end

	local template = ReplicatedStorage:FindFirstChild("CoinModel") -- artist can supply a MeshPart named CoinModel

	local function spawnOne()
		local coin: BasePart
		if template then
			coin = template:Clone()
		else
			local part = Instance.new("Part")
			part.Shape = Enum.PartType.Cylinder
			part.Size = Vector3.new(0.4, 2.2, 2.2)
			part.Color = Color3.fromRGB(255, 200, 40)
			part.Material = Enum.Material.Neon
			coin = part
		end
		coin.Name = "Coin"
		coin.Anchored = true
		coin.CanCollide = false
		coin.CanQuery = false
		coin.CastShadow = false
		coin.CFrame = CFrame.new(spawnPoint()) * CFrame.Angles(0, 0, math.rad(90))
		coin:SetAttribute("Spin", true) -- client spins it locally (no server physics cost)
		local taken = false
		coin.Touched:Connect(function(hit)
			if taken then
				return
			end
			local player = Players:GetPlayerFromCharacter(hit.Parent)
			if not player then
				return
			end
			taken = true
			local pos = coin.Position
			coin:Destroy()
			active -= 1
			local got = services.EconomyService.Add(player, "Coins", Cfg.Value, "collect", true)
			services.QuestService.Progress(player, "Collect", got)
			services.QuestService.Progress(player, "Earn", got)
			Net.fire(player, "Collected", pos, got)
			task.delay(Cfg.RespawnSeconds, function()
				if active < Cfg.MaxActive then
					active += 1
					spawnOne()
				end
			end)
		end)
		coin.Parent = folder
	end

	for _ = 1, Cfg.MaxActive do
		active += 1
		spawnOne()
	end
end

return CollectibleService
