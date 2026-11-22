-- Game passes + developer products (real Robux).
-- * Ownership is verified server-side with UserOwnsGamePassAsync (cached per session).
-- * Developer products use ProcessReceipt with PurchaseId idempotency saved in player data.
-- * Perks from Config.GamePasses[*].perks are applied on every character spawn.
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage.Shared
local Settings = require(Shared.Config.Settings)
local GamePasses = require(Shared.Config.GamePasses)
local Products = require(Shared.Config.Products)
local Net = require(Shared.Net)
local Signal = require(Shared.Signal)

local MonetizationService = {}
MonetizationService.PassGranted = Signal.new() -- (player, passKey)
MonetizationService.ProductBought = Signal.new() -- (player, productKey)

-- Custom product handlers for non-currency products: [productKey] = function(player) -> boolean
MonetizationService.ProductHandlers = {}
-- Custom pass perk hooks: [passKey] = function(player, character)
MonetizationService.PerkHooks = {}

local DataService, EconomyService, AnalyticsService
local owned: { [Player]: { [string]: boolean } } = {}

local passById, productById = {}, {}
for k, v in pairs(GamePasses) do
	if v.id ~= 0 then
		passById[v.id] = k
	end
end
for k, v in pairs(Products) do
	if v.id ~= 0 then
		productById[v.id] = k
	end
end

function MonetizationService.HasPass(player: Player, passKey: string): boolean
	return owned[player] ~= nil and owned[player][passKey] == true
end

function MonetizationService.OwnedList(player: Player): { string }
	local list = {}
	for k, v in pairs(owned[player] or {}) do
		if v then
			table.insert(list, k)
		end
	end
	return list
end

-- Multiplicative perk across owned passes (e.g. VIP x2 and DoubleCoins x2 = x4)
function MonetizationService.GetMultiplier(player: Player, perk: string): number
	local m = 1
	for k in pairs(owned[player] or {}) do
		local p = GamePasses[k] and GamePasses[k].perks
		if p and p[perk] then
			m *= p[perk]
		end
	end
	return m
end

function MonetizationService.GetPerk(player: Player, perk: string): any
	for k in pairs(owned[player] or {}) do
		local p = GamePasses[k] and GamePasses[k].perks
		if p and p[perk] ~= nil then
			return p[perk]
		end
	end
	return nil
end

local function addTrail(character: Model, color: Color3)
	local hrp = character:FindFirstChild("HumanoidRootPart")
	if not hrp or hrp:FindFirstChild("PassTrail") then
		return
	end
	local a0 = Instance.new("Attachment")
	a0.Name = "TrailTop"
	a0.Position = Vector3.new(0, 0.8, 0)
	a0.Parent = hrp
	local a1 = Instance.new("Attachment")
	a1.Name = "TrailBottom"
	a1.Position = Vector3.new(0, -0.8, 0)
	a1.Parent = hrp
	local trail = Instance.new("Trail")
	trail.Name = "PassTrail"
	trail.Attachment0, trail.Attachment1 = a0, a1
	trail.Color = ColorSequence.new(color)
	trail.Transparency = NumberSequence.new(0.2, 1)
	trail.Lifetime = 0.35
	trail.LightEmission = 0.6
	trail.Parent = hrp
end

local function addTag(character: Model, text: string)
	local head = character:FindFirstChild("Head")
	if not head or head:FindFirstChild("PassTag") then
		return
	end
	local gui = Instance.new("BillboardGui")
	gui.Name = "PassTag"
	gui.Size = UDim2.fromOffset(120, 32)
	gui.StudsOffset = Vector3.new(0, 2.4, 0)
	gui.MaxDistance = 60
	gui.AlwaysOnTop = false
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.FredokaOne
	label.TextScaled = true
	label.Text = "⭐ " .. text
	label.TextColor3 = Color3.fromRGB(255, 215, 70)
	label.TextStrokeTransparency = 0.2
	label.Parent = gui
	gui.Parent = head
end

local function applyPerks(player: Player)
	local character = player.Character
	if not character then
		return
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	for passKey in pairs(owned[player] or {}) do
		local def = GamePasses[passKey]
		local perks = def and def.perks or {}
		if humanoid and perks.walkSpeed then
			humanoid.WalkSpeed = math.max(humanoid.WalkSpeed, perks.walkSpeed)
		end
		if humanoid and perks.jumpPower then
			humanoid.UseJumpPower = true
			humanoid.JumpPower = math.max(humanoid.JumpPower, perks.jumpPower)
		end
		if perks.trail then
			addTrail(character, perks.trail)
		end
		if perks.chatTag then
			addTag(character, perks.chatTag)
		end
		local hook = MonetizationService.PerkHooks[passKey]
		if hook then
			task.spawn(hook, player, character)
		end
	end
end

local function grantPass(player: Player, passKey: string, announce: boolean)
	owned[player] = owned[player] or {}
	if owned[player][passKey] then
		return
	end
	owned[player][passKey] = true
	applyPerks(player)
	MonetizationService.PassGranted:Fire(player, passKey)
	EconomyService.Sync(player)
	if announce then
		EconomyService.Toast(player, "Unlocked " .. GamePasses[passKey].name .. "!", "success")
	end
end

local function loadOwnership(player: Player)
	owned[player] = owned[player] or {}
	local studioFree = RunService:IsStudio() and Settings.StudioGrantUnconfiguredPasses
	for passKey, def in pairs(GamePasses) do
		if def.id == 0 then
			if studioFree then
				owned[player][passKey] = true
			end
		else
			for _ = 1, 3 do
				local ok, has = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, def.id)
				if ok then
					owned[player][passKey] = has or nil
					break
				end
				task.wait(1)
			end
		end
	end
end

local function processReceipt(receipt)
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local data = DataService.WaitFor(player)
	if not data then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local pid = tostring(receipt.PurchaseId)
	if table.find(data.receipts, pid) then
		DataService.Save(player)
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end

	local productKey = productById[receipt.ProductId]
	local def = productKey and Products[productKey]
	if not def then
		warn("[Monetization] unknown product id", receipt.ProductId)
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	local granted = true
	local handler = MonetizationService.ProductHandlers[productKey]
	if handler then
		local ok, res = pcall(handler, player)
		granted = ok and res ~= false
	elseif def.grant then
		EconomyService.Grant(player, def.grant, "product:" .. productKey)
	end
	if not granted then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	DataService.Update(player, function(d)
		table.insert(d.receipts, pid)
		while #d.receipts > 50 do
			table.remove(d.receipts, 1)
		end
		d.stats.Purchases += 1
	end)
	if not DataService.Save(player) and not DataService.IsOffline(player) then
		return Enum.ProductPurchaseDecision.NotProcessedYet -- retried later; receipt id is recorded in memory
	end
	MonetizationService.ProductBought:Fire(player, productKey)
	AnalyticsService.Purchase(player, productKey, def.price)
	EconomyService.Toast(player, "Thanks! You got " .. def.name, "success")
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

function MonetizationService.Init(services)
	DataService = services.DataService
	EconomyService = services.EconomyService
	AnalyticsService = services.AnalyticsService

	MarketplaceService.ProcessReceipt = processReceipt

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		local passKey = passById[passId]
		if purchased and passKey then
			grantPass(player, passKey, true)
			AnalyticsService.Purchase(player, passKey, GamePasses[passKey].price)
		end
	end)

	-- Studio test purchase of an unconfigured pass/product (id = 0) from the shop
	Net.on("StudioTestBuy", function(player, kind, key)
		if not RunService:IsStudio() then
			return
		end
		if kind == "pass" and GamePasses[key] then
			grantPass(player, key, true)
		elseif kind == "product" and Products[key] then
			local handler = MonetizationService.ProductHandlers[key]
			if handler then
				handler(player)
			elseif Products[key].grant then
				EconomyService.Grant(player, Products[key].grant, "studio-test")
			end
			EconomyService.Toast(player, "[Studio] Granted " .. Products[key].name, "success")
		end
	end, 2)

	local function setup(player: Player)
		loadOwnership(player)
		player.CharacterAdded:Connect(function(char)
			char:WaitForChild("Humanoid", 5)
			applyPerks(player)
		end)
		if player.Character then
			applyPerks(player)
		end
		EconomyService.Sync(player)
	end
	Players.PlayerAdded:Connect(setup)
	for _, p in ipairs(Players:GetPlayers()) do
		task.spawn(setup, p)
	end
	Players.PlayerRemoving:Connect(function(p)
		owned[p] = nil
	end)
end

return MonetizationService
