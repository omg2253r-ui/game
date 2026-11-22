-- Thin wrappers: Roblox AnalyticsService (funnels/economy dashboards) + BadgeService.
-- All calls are pcall-wrapped so analytics can never break gameplay.
local RbxAnalytics = game:GetService("AnalyticsService")
local BadgeService = game:GetService("BadgeService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Economy = require(ReplicatedStorage.Shared.Config.Economy)

local AnalyticsService = {}

function AnalyticsService.Event(player: Player, name: string, value: number?)
	pcall(function()
		RbxAnalytics:LogCustomEvent(player, name, value or 1)
	end)
end

-- Onboarding funnel: call with steps 1..n in order (e.g. 1 Joined, 2 FirstCollect, 3 OpenedShop)
function AnalyticsService.Funnel(player: Player, step: number, stepName: string)
	pcall(function()
		RbxAnalytics:LogOnboardingFunnelStepEvent(player, step, stepName)
	end)
end

function AnalyticsService.Economy(player: Player, flow: "Source" | "Sink", currency: string, amount: number, balance: number, txType: string, sku: string?)
	pcall(function()
		local flowType = if flow == "Source" then Enum.AnalyticsEconomyFlowType.Source else Enum.AnalyticsEconomyFlowType.Sink
		RbxAnalytics:LogEconomyEvent(player, flowType, currency, amount, balance, txType, sku)
	end)
end

function AnalyticsService.Purchase(player: Player, sku: string, robux: number?)
	AnalyticsService.Event(player, "Purchase_" .. sku, robux or 0)
	AnalyticsService.Badge(player, "FirstPurchase")
end

function AnalyticsService.Badge(player: Player, key: string)
	local id = Economy.Badges[key]
	if not id or id == 0 then
		return
	end
	task.spawn(function()
		pcall(function()
			if not BadgeService:UserHasBadgeAsync(player.UserId, id) then
				BadgeService:AwardBadge(player.UserId, id)
			end
		end)
	end)
end

function AnalyticsService.Init(services)
	services.DataService.Loaded:Connect(function(player)
		AnalyticsService.Funnel(player, 1, "Joined")
		AnalyticsService.Badge(player, "Welcome")
	end)
	services.EconomyService.Earned:Connect(function(player, currency, amount, source)
		local bal = services.EconomyService.Get(player, currency)
		AnalyticsService.Economy(player, "Source", currency, amount, bal, Enum.AnalyticsEconomyTransactionType.Gameplay.Name, source)
	end)
end

return AnalyticsService
