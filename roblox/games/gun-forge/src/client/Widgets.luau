-- Higher-level UI pieces built on UIKit (tabs, item cards, popups, number formatting helpers).
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Theme = require(ReplicatedStorage.Shared.Theme)
local Guns = require(ReplicatedStorage.Shared.Config.Guns)
local UI = require(script.Parent.UIKit)

local W = {}
local C = Theme.Colors

function W.short(n: number): string
	n = math.floor(n)
	for _, u in ipairs({ { 1e15, "Q" }, { 1e12, "T" }, { 1e9, "B" }, { 1e6, "M" }, { 1e3, "K" } }) do
		if n >= u[1] then
			return (("%.2f%s"):format(n / u[1], u[2]):gsub("%.?0+([A-Z])", "%1"))
		end
	end
	return tostring(n)
end

-- Tab bar inside a window (moves body down). onSelect(name) re-renders the body.
function W.tabs(win: Frame, body: ScrollingFrame, names: { string }, onSelect: (string) -> ())
	local bar = UI.new("Frame", { Name = "Tabs", BackgroundTransparency = 1, Position = UDim2.fromOffset(12, 64), Size = UDim2.new(1, -24, 0, 40), Parent = win })
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6), Parent = bar })
	body.Position = UDim2.fromOffset(12, 112)
	body.Size = UDim2.new(1, -24, 1, -124)
	local buttons = {}
	local function select(name)
		for n, b in pairs(buttons) do
			b.BackgroundTransparency = if n == name then 0 else 0.5
		end
		onSelect(name)
	end
	for _, n in ipairs(names) do
		buttons[n] = UI.button(n, C.PanelLight, function()
			select(n)
		end, { Size = UDim2.fromOffset(math.floor(600 / #names) - 6, 38), Parent = bar })
		buttons[n].Label.TextSize = 16
	end
	return select
end

function W.grid(body: ScrollingFrame, cell: Vector2)
	UI.new("UIGridLayout", { CellSize = UDim2.fromOffset(cell.X, cell.Y), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = body })
end

function W.clear(body: Instance)
	for _, ch in ipairs(body:GetChildren()) do
		if ch:IsA("GuiObject") or ch:IsA("UIGridLayout") or ch:IsA("UIListLayout") then
			ch:Destroy()
		end
	end
end

-- item card: rarity-coloured gradient + glyph + title/sub + optional button
function W.card(parent: Instance, order: number, rarity: number, glyph: string, title: string, sub: string, btnText: string?, onClick: (() -> ())?, badge: string?)
	local col = Theme.Rarity and Theme.Rarity[rarity] or Guns.Rarities[rarity].color
	local c = UI.panel({ LayoutOrder = order, BackgroundColor3 = C.PanelLight, Parent = parent })
	UI.gradient(col:Lerp(C.Panel, 0.35), C.Panel).Parent = c
	local ic = UI.icon(nil, glyph, col, 52)
	ic.AnchorPoint = Vector2.new(0.5, 0)
	ic.Position = UDim2.new(0.5, 0, 0, 6)
	ic.Parent = c
	UI.label(title, 15, { Position = UDim2.fromOffset(4, 60), Size = UDim2.new(1, -8, 0, 18), Parent = c })
	UI.label(sub, 12, { Font = Theme.FontBody, TextColor3 = C.TextDim, Position = UDim2.fromOffset(4, 80), Size = UDim2.new(1, -8, 0, 30), TextYAlignment = Enum.TextYAlignment.Top, Parent = c })
	if badge then
		UI.panel({ Size = UDim2.fromOffset(58, 20), Position = UDim2.fromOffset(-4, -4), BackgroundColor3 = C.Primary, Parent = c }, {
			UI.label(badge, 12, { Size = UDim2.fromScale(1, 1) }),
		})
	end
	if btnText and onClick then
		local b = UI.button(btnText, C.Primary, onClick, { Size = UDim2.new(1, -12, 0, 30), Position = UDim2.new(0, 6, 1, -36), Parent = c })
		b.Label.TextSize = 14
	end
	return c
end

-- Fullscreen modal used by minigames / forge / hatch. Returns frame + close fn.
function W.modal(gui: ScreenGui, title: string, accent: Color3)
	local dim = UI.new("Frame", { BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, Size = UDim2.fromScale(1, 1), ZIndex = 20, Parent = gui })
	local box = UI.panel({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(620, 420), ZIndex = 21, Parent = dim })
	UI.gradient(C.Panel, C.Bg).Parent = box
	UI.panel({ Size = UDim2.new(1, 0, 0, 52), BackgroundColor3 = accent, Parent = box }, { UI.label(title, 28, { Size = UDim2.fromScale(1, 1) }) })
	UI.pop(box, true)
	local function close()
		dim:Destroy()
	end
	return box, close
end

function W.flash(gui: Instance, color: Color3)
	local f = UI.new("Frame", { BackgroundColor3 = color, BackgroundTransparency = 0.3, Size = UDim2.fromScale(1, 1), ZIndex = 50, Parent = gui })
	TweenService:Create(f, TweenInfo.new(0.5), { BackgroundTransparency = 1 }):Play()
	task.delay(0.6, function()
		f:Destroy()
	end)
end

return W
