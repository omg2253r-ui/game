-- Fusion Altar (odds always visible) + hatch reveal, pet inventory (equip/best/combine),
-- and client-side pet followers for every player (server only stores ids).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Pets = require(Shared.Config.Pets)
local Guns = require(Shared.Config.Guns)
local Materials = require(Shared.Config.Materials)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local State = require(script.Parent.Parent.ClientState)
local UIController = require(script.Parent.UIController)
local Effects = require(script.Parent.EffectsController)

local C = Theme.Colors
local PetsC = {}
local body, tab = nil, "FUSE"
local LVL = { [0] = "", [1] = "Golden ", [2] = "Rainbow " }

local function oddsText(core): string
	local total = 0
	for _, w in pairs(core.odds) do
		total += w
	end
	local parts = {}
	for id, w in pairs(core.odds) do
		table.insert(parts, { t = ("%s %.1f%%"):format(Pets.Pets[id].name, w / total * 100), w = w })
	end
	table.sort(parts, function(a, b)
		return a.w > b.w
	end)
	local out = {}
	for _, p in ipairs(parts) do
		table.insert(out, p.t)
	end
	return table.concat(out, " • ")
end

local function hatch(core)
	local res = Net.invoke("Fuse", core.id)
	if not res or not res.ok then
		UIController.Toast(res and res.err or "Can't fuse", "error")
		return
	end
	UIController.Close("Pets")
	local box, close = W.modal(UIController.Gui(), core.name, C.Forge)
	local egg = UI.icon(nil, "🥚", C.Energy, 140)
	egg.AnchorPoint = Vector2.new(0.5, 0.5)
	egg.Position = UDim2.fromScale(0.5, 0.48)
	egg.Parent = box
	for i = 1, 6 do -- shake, faster and faster
		TweenService:Create(egg, TweenInfo.new(0.12 - i * 0.012), { Rotation = if i % 2 == 0 then 14 else -14 }):Play()
		task.wait(0.14 - i * 0.012)
	end
	local def = Pets.Pets[res.pet]
	W.flash(UIController.Gui(), Guns.Rarities[def.rarity].color)
	egg:Destroy()
	local card = W.card(box, 0, def.rarity, "🐾", def.name, ("%s  •  +%d%% Power  +%d%% Coins"):format(Guns.Rarities[def.rarity].name, def.power * 100, def.coins * 100), nil, nil, nil, "pet_" .. res.pet)
	card.AnchorPoint = Vector2.new(0.5, 0)
	card.Position = UDim2.new(0.5, 0, 0, 80)
	card.Size = UDim2.fromOffset(240, 160)
	local s = UI.new("UIScale", { Scale = 0.2, Parent = card })
	TweenService:Create(s, TweenInfo.new(0.5, Enum.EasingStyle.Back), { Scale = 1.25 }):Play()
	if res.lucky then
		UI.label("LUCKY FORGE upgrade!", 20, { Position = UDim2.fromOffset(0, 300), Size = UDim2.new(1, 0, 0, 24), TextColor3 = C.Gold, Parent = box })
	end
	UI.button("AWESOME!", C.Primary, close, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -16), Size = UDim2.fromOffset(220, 54), Parent = box })
end

local function renderFuse()
	UIController.List(body)
	for i, core in ipairs(Pets.Cores) do
		local inv = State.Inv.materials
		local ok = State.Coins() >= core.coins
		local need = {}
		for id, n in pairs(core.mats) do
			ok = ok and (inv[id] or 0) >= n
			table.insert(need, ("%s %d/%d"):format(Materials[id].glyph, inv[id] or 0, n))
		end
		table.insert(need, "🪙 " .. W.short(core.coins))
		UIController.Row(body, i, core.name .. "  —  " .. table.concat(need, " "), oddsText(core), "FUSE", C.Forge, ok, function()
			hatch(core)
		end, nil, "mat_" .. core.id)
	end
end

local function renderMine()
	W.grid(body, Vector2.new(140, 170))
	local groups, list = {}, {}
	for uid, it in pairs(State.Inv.items) do
		if it.kind == "pet" and Pets.Pets[it.id] then
			local key = it.id .. ":" .. (it.lvl or 0)
			groups[key] = (groups[key] or 0) + 1
			table.insert(list, { uid = uid, it = it })
		end
	end
	table.sort(list, function(a, b)
		local pa, pb = Pets.Pets[a.it.id], Pets.Pets[b.it.id]
		return pa.power * (1 + (a.it.lvl or 0) * 2) > pb.power * (1 + (b.it.lvl or 0) * 2)
	end)
	local equipped = State.Inv.equipped.pets
	for i, e in ipairs(list) do
		local def = Pets.Pets[e.it.id]
		local lvl = e.it.lvl or 0
		local eq = table.find(equipped, e.uid) ~= nil
		local mult = if lvl == 2 then Pets.RainbowMult elseif lvl == 1 then Pets.GoldenMult else 1
		local card = W.card(body, i, math.min(5, def.rarity + lvl), "🐾", LVL[lvl] .. def.name, ("+%d%% Power"):format(def.power * mult * 100),
			if eq then "UNEQUIP" else "EQUIP", function()
				Net.send("EquipPet", e.uid)
			end, if eq then "ON" else nil, "pet_" .. e.it.id)
		local key = e.it.id .. ":" .. lvl
		if lvl < 2 and (groups[key] or 0) >= Pets.CombineCount then
			local b = UI.button("x5↑", C.Gold, function()
				Net.send("CombinePets", e.it.id, lvl)
			end, { Size = UDim2.fromOffset(40, 26), Position = UDim2.new(1, -42, 0, 2), Parent = card })
			b.Label.TextSize = 13
		end
	end
end

local function render()
	if not body then
		return
	end
	W.clear(body)
	if tab == "FUSE" then
		renderFuse()
	else
		renderMine()
	end
end

-------------------------------------------------- followers
local followers: { [Player]: { Model } } = {}

local function petModel(id: string, lvl: number): Model
	local assets = ReplicatedStorage:FindFirstChild("Assets")
	local src = assets and assets:FindFirstChild("Pets") and assets.Pets:FindFirstChild(id)
	local m: Model
	if src and src:IsA("Model") then
		m = src:Clone()
	else
		m = Instance.new("Model")
		local def = Pets.Pets[id]
		local body = Instance.new("Part")
		body.Shape = Enum.PartType.Ball
		body.Size = Vector3.one * 1.8
		body.Color = if lvl == 1 then Color3.fromRGB(255, 205, 60) else def.color
		body.Material = if lvl == 2 then Enum.Material.Neon else Enum.Material.SmoothPlastic
		body.Parent = m
		for sx = -1, 1, 2 do
			local eye = Instance.new("Part")
			eye.Shape = Enum.PartType.Ball
			eye.Size = Vector3.one * 0.4
			eye.Color = Color3.new(0.05, 0.05, 0.08)
			eye.CFrame = CFrame.new(sx * 0.35, 0.2, -0.75)
			eye.Parent = m
		end
		m.PrimaryPart = body
	end
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then
			p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
		end
	end
	m.Parent = Workspace
	return m
end

local function rebuild(p: Player)
	for _, m in ipairs(followers[p] or {}) do
		m:Destroy()
	end
	followers[p] = {}
	local attr = p:GetAttribute("Pets")
	if type(attr) ~= "string" or attr == "" then
		return
	end
	for entry in attr:gmatch("[^,]+") do
		local id, lvl = entry:match("^(.-):(%d)$")
		if id and Pets.Pets[id] then
			table.insert(followers[p], petModel(id, tonumber(lvl) or 0))
		end
	end
end

local function watch(p: Player)
	p:GetAttributeChangedSignal("Pets"):Connect(function()
		rebuild(p)
	end)
	rebuild(p)
end

function PetsC.Init()
	local win, b = UIController.MakeWindow("Pets", "PETS & FUSION", C.Gold)
	body = b
	local select = W.tabs(win, b, { "FUSE", "MY PETS" }, function(name)
		tab = name
		render()
	end)
	UI.button("EQUIP BEST", C.Primary, function()
		Net.send("EquipBestPets")
	end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -60, 0, 52), Size = UDim2.fromOffset(160, 40), Parent = win }).Label.TextSize = 14
	UIController.AddMenuButton(7, "PETS", C.Gold, "Pets").Activated:Connect(function()
		task.defer(render)
	end)
	State.InvChanged:Connect(function()
		if UIController.IsOpen("Pets") then
			render()
		end
	end)
	select("FUSE")

	Players.PlayerAdded:Connect(watch)
	for _, p in ipairs(Players:GetPlayers()) do
		watch(p)
	end
	Players.PlayerRemoving:Connect(function(p)
		for _, m in ipairs(followers[p] or {}) do
			m:Destroy()
		end
		followers[p] = nil
	end)
	local cam = Workspace.CurrentCamera
	RunService.Heartbeat:Connect(function(dt)
		local t = os.clock()
		for p, list in pairs(followers) do
			local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
			if root and (root.Position - cam.CFrame.Position).Magnitude < 160 and not Effects.LowFx or (root and p == Players.LocalPlayer) then
				local r = root :: BasePart
				for i, m in ipairs(list) do
					local angle = math.rad(150 + (i - 1) * 30 - (#list - 1) * 15)
					local offset = r.CFrame:VectorToWorldSpace(Vector3.new(math.sin(angle) * 5, 0, -math.cos(angle) * 5))
					local goal = r.Position + offset + Vector3.new(0, -1.5 + math.sin(t * 4 + i) * 0.4, 0)
					local cur = m:GetPivot()
					local pos = cur.Position:Lerp(goal, math.clamp(dt * 8, 0, 1))
					m:PivotTo(CFrame.lookAt(pos, pos + r.CFrame.LookVector))
				end
			end
		end
	end)
end

return PetsC
