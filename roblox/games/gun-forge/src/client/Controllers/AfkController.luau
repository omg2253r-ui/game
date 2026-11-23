-- AFK MODE: turns off 3D rendering (saves battery/heat on long AFK sessions), shows a clean
-- overlay with live Power/coins gained this AFK session. Training keeps running server-side.
-- Also shows the social boost chip (friends / premium / group).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Theme = require(ReplicatedStorage.Shared.Theme)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local State = require(script.Parent.Parent.ClientState)
local UIController = require(script.Parent.UIController)

local C = Theme.Colors
local Afk = {}

function Afk.Init()
	local gui = UIController.Gui()
	local player = Players.LocalPlayer
	local overlay = UI.new("Frame", { BackgroundColor3 = Color3.fromRGB(8, 6, 16), Size = UDim2.fromScale(1, 1), ZIndex = 40, Visible = false, Parent = gui })
	UI.gradient(Color3.fromRGB(22, 16, 44), Color3.fromRGB(6, 4, 12)).Parent = overlay
	UI.label("AFK MODE", 56, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.18), Size = UDim2.fromOffset(700, 70), TextColor3 = C.Energy, ZIndex = 41, Parent = overlay })
	local stats = UI.label("", 30, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.35), Size = UDim2.fromOffset(800, 160), ZIndex = 41, Parent = overlay })
	UI.label("Training continues • 3D rendering paused to save battery", 18, { Font = Theme.FontBody, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.62), Size = UDim2.fromOffset(800, 24), TextColor3 = C.TextDim, ZIndex = 41, Parent = overlay })
	local startPower, startCoins, startTime = 0, 0, 0
	local exit = UI.button("TAP TO RETURN", C.Primary, function() end, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.72), Size = UDim2.fromOffset(280, 64), ZIndex = 42, Parent = overlay })
	local function setAfk(on: boolean)
		overlay.Visible = on
		pcall(function()
			RunService:Set3dRenderingEnabled(not on)
		end)
		if on then
			startPower, startCoins, startTime = State.Power(), State.Coins(), os.clock()
		end
	end
	exit.Activated:Connect(function()
		setAfk(false)
	end)
	local btn = UI.button("AFK", C.PanelLight, function()
		setAfk(true)
	end, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 150, 1, -16), Size = UDim2.fromOffset(70, 56), Parent = gui })
	btn.Label.TextSize = 16

	local chip = UI.panel({ AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(0.5, -176, 0, 64), Size = UDim2.fromOffset(200, 24), BackgroundColor3 = C.Primary, Visible = false, Parent = gui })
	local chipL = UI.label("", 13, { Size = UDim2.fromScale(1, 1), Parent = chip })
	player:GetAttributeChangedSignal("SocialBoost"):Connect(function()
		local b = player:GetAttribute("SocialBoost") or 0
		chip.Visible = b > 0
		chipL.Text = ("👥 SOCIAL BOOST +%d%%"):format(b)
	end)

	task.spawn(function()
		while true do -- lint-ok (task.wait)
			task.wait(1)
			if overlay.Visible then
				local mins = (os.clock() - startTime) / 60
				stats.Text = ("⚡ +%s Power\n🪙 +%s Coins\n⏱ %d min"):format(W.short(State.Power() - startPower), W.short(math.max(0, State.Coins() - startCoins)), math.floor(mins))
			end
		end
	end)
end

return Afk
