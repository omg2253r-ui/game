-- Guns: gives the equipped gun as a Tool, validates every shot server-side (rate, range, target),
-- applies PvE damage (Power-scaled) or PvP damage (normalized, via ArenaService), relays tracers.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Guns = require(Shared.Config.Guns)
local Combat = require(Shared.Config.Combat)
local Net = require(Shared.Net)

local GunService = {}
local S
local lastShot: { [Player]: number } = {}
local lastRelay: { [Player]: number } = {}

local function buildHandle(item): BasePart
	local assets = ReplicatedStorage:FindFirstChild("Assets")
	local src = assets and assets:FindFirstChild("Guns") and assets.Guns:FindFirstChild(item.id)
	local rarityColor = Guns.Rarities[item.rarity].color
	if src and src:IsA("BasePart") then
		local h = src:Clone()
		h.Name = "Handle"
		return h
	end
	-- code-built fallback: body + barrel + glowing rarity strip, welded to Handle
	local t = Guns.Types[item.id]
	local len = 1.6 + t.range / 60
	local h = Instance.new("Part")
	h.Name = "Handle"
	h.Size = Vector3.new(0.45, 0.9, len * 0.55)
	h.Color = t.color
	h.Material = Enum.Material.SmoothPlastic
	local function add(size: Vector3, offset: CFrame, color: Color3, mat: Enum.Material)
		local p = Instance.new("Part")
		p.Size = size
		p.Color = color
		p.Material = mat
		p.CanCollide, p.CanQuery, p.CanTouch, p.Massless = false, false, false, true
		p.CFrame = h.CFrame * offset
		local w = Instance.new("WeldConstraint")
		w.Part0, w.Part1 = h, p
		w.Parent = p
		p.Parent = h
	end
	add(Vector3.new(0.35, 0.35, len), CFrame.new(0, 0.45, -len * 0.35), t.color:Lerp(Color3.new(0, 0, 0), 0.3), Enum.Material.Metal)
	add(Vector3.new(0.5, 0.12, len * 0.7), CFrame.new(0, 0.7, -len * 0.2), rarityColor, Enum.Material.Neon)
	local muzzle = Instance.new("Attachment")
	muzzle.Name = "Muzzle"
	muzzle.Position = Vector3.new(0, 0.45, -len * 0.85 - 0.2)
	muzzle.Parent = h
	return h
end

function GunService.GiveGun(player: Player)
	local item = S.InventoryService.EquippedGun(player)
	local backpack = player:FindFirstChildOfClass("Backpack")
	local char = player.Character
	if not item or not backpack then
		return
	end
	for _, container in ipairs({ backpack, char }) do
		if container then
			for _, tool in ipairs(container:GetChildren()) do
				if tool:IsA("Tool") and tool:GetAttribute("Gun") then
					tool:Destroy()
				end
			end
		end
	end
	local tool = Instance.new("Tool")
	tool.Name = Guns.Rarities[item.rarity].name .. " " .. Guns.Types[item.id].name
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	tool.GripPos = Vector3.new(0, -0.2, 0.3)
	tool:SetAttribute("Gun", item.id)
	tool:SetAttribute("Rarity", item.rarity)
	tool:SetAttribute("Rate", Guns.Types[item.id].rate)
	tool:SetAttribute("Range", Guns.Types[item.id].range)
	buildHandle(item).Parent = tool
	tool.Parent = backpack
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum then
		hum:EquipTool(tool) -- AFK friendly: always holding the gun
	end
end

local function hrp(player: Player): BasePart?
	local c = player.Character
	return c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function relay(player: Player, toPos: Vector3)
	local t = os.clock()
	if t - (lastRelay[player] or 0) < 0.3 then
		return
	end
	lastRelay[player] = t
	for _, other in ipairs(Players:GetPlayers()) do
		if other ~= player then
			Net.fire(other, "Shot", player, toPos)
		end
	end
end

-- kind: "m" monster id | "p" player userId
local function onFire(player: Player, kind, targetId)
	local item = S.InventoryService.EquippedGun(player)
	local root = hrp(player)
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if not item or not root or not hum or hum.Health <= 0 or type(targetId) ~= "number" then
		return
	end
	local t = Guns.Types[item.id]
	local now = os.clock()
	if now - (lastShot[player] or 0) < (1 / t.rate) * Combat.FireTolerance then
		return
	end
	lastShot[player] = now

	if kind == "m" then
		if S.PlayerService.InArena(player) then
			return
		end
		local rec = S.MonsterService.Get(targetId)
		if not rec then
			return
		end
		local pos = S.MonsterService.Position(rec)
		if (pos - root.Position).Magnitude > t.range + rec.def.size + 6 then
			return
		end
		local dmg = item.dmg * Guns.PowerFactor(S.PlayerService.GetPower(player))
		S.MonsterService.Damage(targetId, player, dmg)
		Net.fire(player, "Hit", pos, math.floor(dmg))
		relay(player, pos)
	elseif kind == "p" then
		local target = Players:GetPlayerByUserId(targetId)
		local troot = target and hrp(target)
		if not troot or (troot.Position - root.Position).Magnitude > t.range + 4 then
			return
		end
		local dmg = t.dmg * t.pellets * (1 + Guns.PvP.RarityBonus * (item.rarity - 1)) * Guns.PvP.DamageScale
		if S.ArenaService.Damage(player, target :: Player, dmg) then
			Net.fire(player, "Hit", troot.Position, math.floor(dmg))
			relay(player, troot.Position)
		end
	end
end

function GunService.Init(services)
	S = services
	Net.declare("Shot")
	Net.declare("Hit")
	Net.on("Fire", onFire, 12)

	S.InventoryService.GearChanged:Connect(function(player, slot)
		if slot == "gun" then
			GunService.GiveGun(player)
		end
	end)
	local function hook(player: Player)
		player.CharacterAdded:Connect(function(char)
			char:WaitForChild("Humanoid", 5)
			task.wait(0.2)
			GunService.GiveGun(player)
		end)
	end
	Players.PlayerAdded:Connect(hook)
	for _, p in ipairs(Players:GetPlayers()) do
		hook(p)
	end
	Players.PlayerRemoving:Connect(function(p)
		lastShot[p] = nil
		lastRelay[p] = nil
	end)
end

return GunService
