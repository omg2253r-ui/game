-- UI helpers for ProgressController: season tier rows, spin wheel, story tracker.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Theme = require(ReplicatedStorage.Shared.Theme)
local Achievements = require(ReplicatedStorage.Shared.Config.Achievements)
local UI = require(script.Parent.UIKit)

local C = Theme.Colors
local P = {}

-- One season tier: free + premium claim buttons. st = SeasonInfo state, cfg = Config/Season
function P.tierRow(body, tier: number, st, cfg, onClaim: (number, boolean) -> ())
	local reached = tier <= st.tier
	local r = UI.panel({ LayoutOrder = tier, Size = UDim2.new(1, -8, 0, 84), BackgroundColor3 = reached and C.PanelLight or C.Panel, Parent = body })
	UI.label("TIER " .. tier, 18, { Position = UDim2.fromOffset(10, 4), Size = UDim2.fromOffset(80, 24), TextXAlignment = Enum.TextXAlignment.Left, Parent = r })
	local function side(x: number, name: string, reward, claimed: boolean, locked: boolean, premium: boolean)
		local txt = Achievements.RewardText(reward)
		UI.label(name .. ": " .. txt, 13, { Font = Theme.FontBody, TextColor3 = premium and C.Accent or C.TextDim, Position = UDim2.new(0, x, 0, 4), Size = UDim2.new(0.5, -90, 0, 38), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Parent = r })
		local can = reached and not claimed and not locked
		local label = claimed and "CLAIMED" or (locked and "LOCKED" or (reached and "CLAIM" or "..."))
		local b = UI.button(label, can and (premium and C.Accent or C.Primary) or C.Panel, function()
			if can then
				onClaim(tier, premium)
			end
		end, { Size = UDim2.new(0.5, -20, 0, 34), Position = UDim2.new(0, x, 1, -40), Parent = r })
		b.Label.TextSize = 15
	end
	side(14, "FREE", cfg.Free[tier], st.claimed[tostring(tier)] == true, false, false)
	side(0, "PREMIUM", cfg.Premium[tier], st.premiumClaimed[tostring(tier)] == true, not st.premium, true)
	-- second column sits in the right half
	for _, ch in ipairs(r:GetChildren()) do
		if ch:IsA("GuiObject") and ch.Position.X.Offset == 0 and ch.Position.X.Scale == 0 and ch.Name ~= "" then
			ch.Position = UDim2.new(0.5, 6, ch.Position.Y.Scale, ch.Position.Y.Offset)
		end
	end
	return r
end

-- Wheel with N segments; returns { frame, spinTo(index, done) }
function P.wheel(parent: Instance, prizes, size: number)
	local holder = UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(size, size), Parent = parent })
	local wheel = UI.new("Frame", { Name = "Wheel", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(0.94, 0.94), BackgroundColor3 = C.Bg, Parent = holder }, { UI.corner(UDim.new(1, 0)), UI.stroke(C.Primary, 3) })
	local n = #prizes
	for i, p in ipairs(prizes) do
		local seg = UI.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(1, 1), Rotation = (i - 1) * 360 / n, Parent = wheel })
		local tile = UI.panel({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 6), Size = UDim2.fromOffset(size * 0.2, size * 0.26), BackgroundColor3 = p.color, Parent = seg })
		UI.label(p.glyph, math.floor(size * 0.11), { Size = UDim2.new(1, 0, 0.55, 0), Parent = tile })
		UI.label(p.text, 11, { Position = UDim2.fromScale(0, 0.55), Size = UDim2.fromScale(1, 0.45), Parent = tile })
	end
	UI.new("TextLabel", { Text = "▼", TextSize = 30, Font = Theme.Font, TextColor3 = C.Accent, BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, -0.04), Size = UDim2.fromOffset(34, 34), ZIndex = 3, Parent = holder })
	local spinning = false
	local function spinTo(index: number, done: () -> ())
		spinning = true
		local target = math.ceil(wheel.Rotation / 360) * 360 + 360 * 5 - (index - 1) * 360 / n
		local tw = TweenService:Create(wheel, TweenInfo.new(4.5, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), { Rotation = target })
		tw.Completed:Once(function()
			spinning = false
			done()
		end)
		tw:Play()
	end
	return { frame = holder, spinTo = spinTo, busy = function() return spinning end }
end

-- compact always-visible story tracker (top-right); onClick opens STORY tab
function P.tracker(gui: Instance, onClick: () -> ())
	local f = UI.panel({ Name = "StoryTracker", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 200), Size = UDim2.fromOffset(240, 64), BackgroundColor3 = C.Bg, BackgroundTransparency = 0.15, Parent = gui })
	local title = UI.label("STORY", 14, { Font = Theme.Font, TextColor3 = C.Accent, Position = UDim2.fromOffset(8, 2), Size = UDim2.new(1, -16, 0, 18), TextXAlignment = Enum.TextXAlignment.Left, Parent = f })
	local text = UI.label("", 13, { Font = Theme.FontBody, Position = UDim2.fromOffset(8, 20), Size = UDim2.new(1, -16, 0, 28), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Parent = f })
	local bar = UI.new("Frame", { BackgroundColor3 = C.Panel, Position = UDim2.new(0, 8, 1, -10), Size = UDim2.new(1, -16, 0, 6), Parent = f }, { UI.corner(UDim.new(1, 0)) })
	local fill = UI.new("Frame", { BackgroundColor3 = C.Primary, Size = UDim2.fromScale(0, 1), Parent = bar }, { UI.corner(UDim.new(1, 0)) })
	UI.new("TextButton", { Text = "", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 5, Parent = f }).Activated:Connect(onClick)
	return function(st)
		if st.finished then
			title.Text = "STORY COMPLETE"
			text.Text = "Thanks for playing, hero!"
			fill.Size = UDim2.fromScale(1, 1)
			return
		end
		title.Text = ("STORY %d/%d%s"):format(st.step, st.total, st.done and "  -  READY!" or "")
		text.Text = ("%s (%s/%s)"):format(st.text, UI.formatNumber(st.value), UI.formatNumber(st.goal))
		fill.Size = UDim2.fromScale(math.clamp(st.value / st.goal, 0, 1), 1)
		fill.BackgroundColor3 = st.done and C.Accent or C.Primary
	end
end

return P
