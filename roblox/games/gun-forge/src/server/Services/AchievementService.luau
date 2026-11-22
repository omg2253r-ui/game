-- Achievements (checked every 10 s + on demand) and equippable titles shown above the head.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config.Achievements)
local Net = require(ReplicatedStorage.Shared.Net)
local Rewards = require(script.Parent.ProgressRewards)

local AchievementService = {}
local S

local function applyTag(player: Player)
	local d = S.DataService.Get(player)
	local head = player.Character and player.Character:FindFirstChild("Head")
	if not d or not head then
		return
	end
	local old = head:FindFirstChild("TitleTag")
	if old then
		old:Destroy()
	end
	local def = Config.Titles[d.title]
	player:SetAttribute("Title", def and def.name or nil)
	if not def then
		return
	end
	local g = Instance.new("BillboardGui")
	g.Name = "TitleTag"
	g.Size = UDim2.fromOffset(120, 20)
	g.StudsOffset = Vector3.new(0, 2.6, 0)
	g.MaxDistance = 50
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.Text = def.name
	l.TextColor3 = def.color
	l.TextStrokeTransparency = 0.3
	l.Parent = g
	g.Parent = head
end

function AchievementService.Check(player: Player)
	local d = S.DataService.Get(player)
	if not d then
		return
	end
	for _, a in ipairs(Config.List) do
		if not d.achievements[a.id] and Config.Value(d, a.kind, a.stat) >= a.goal then
			S.DataService.Update(player, function(x)
				x.achievements[a.id] = true
			end)
			Rewards.Grant(S, player, { Gems = a.gems, title = a.title }, "achievement")
			S.EconomyService.Toast(player, ("Achievement: %s  (+%d Gems)"):format(a.name, a.gems), "success")
			if a.announce then
				Net.fireAll("Toast", ("%s earned \"%s\"!"):format(player.DisplayName, a.name), "success")
			end
		end
	end
end

local function info(player: Player)
	local d = S.DataService.Get(player)
	if not d then
		return nil
	end
	local values = {}
	for _, a in ipairs(Config.List) do
		values[a.id] = Config.Value(d, a.kind, a.stat)
	end
	local owned = {}
	for key in pairs(d.achievements) do
		if key:sub(1, 6) == "title:" then
			owned[key:sub(7)] = true
		end
	end
	return { earned = d.achievements, values = values, owned = owned, title = d.title }
end

function AchievementService.Init(services)
	S = services

	S.DataService.Loaded:Connect(function(player)
		player.CharacterAdded:Connect(function()
			task.wait(0.5)
			applyTag(player)
		end)
		AchievementService.Check(player)
		applyTag(player)
	end)

	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(10)
			for _, p in ipairs(Players:GetPlayers()) do
				AchievementService.Check(p)
			end
		end
	end)

	Net.handle("AchInfo", function(player)
		AchievementService.Check(player)
		return info(player)
	end, 3)

	Net.handle("EquipTitle", function(player, id)
		local d = S.DataService.Get(player)
		if not d or type(id) ~= "string" or #id > 40 then
			return nil
		end
		if id ~= "" and not (Config.Titles[id] and d.achievements["title:" .. id]) then
			return info(player)
		end
		S.DataService.Update(player, function(x)
			x.title = id
		end)
		applyTag(player)
		return info(player)
	end, 4)
end

return AchievementService
