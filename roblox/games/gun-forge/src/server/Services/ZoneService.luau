-- Zone access by Power: server bounces under-powered players back to the hub (clients make the
-- gate non-collidable locally once unlocked). Sets player attribute "Zone".
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Zones = require(ReplicatedStorage.Shared.Config.Zones)

local ZoneService = {}

function ZoneService.ZoneAt(pos: Vector3)
	for _, z in ipairs(Zones) do
		if math.abs(pos.X - z.center.X) <= z.size.X / 2 and math.abs(pos.Z - z.center.Z) <= z.size.Z / 2 then
			return z
		end
	end
	return nil
end

-- best zone tier the player may enter (for minigame material prizes etc.)
function ZoneService.BestTier(power: number): number
	local tier = 1
	for _, z in ipairs(Zones) do
		if power >= z.powerReq then
			tier = math.max(tier, z.tier)
		end
	end
	return tier
end

function ZoneService.Init(services)
	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(1)
			for _, p in ipairs(Players:GetPlayers()) do
				local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
				if root then
					local z = ZoneService.ZoneAt(root.Position)
					p:SetAttribute("Zone", z and z.id or "hub")
					if z and services.PlayerService.GetPower(p) < z.powerReq then
						root.CFrame = CFrame.new(0, 5, 0)
						services.EconomyService.Toast(p, ("Need %d Power for %s!"):format(z.powerReq, z.name), "error")
					end
				end
			end
		end
	end)
end

return ZoneService
