-- Code-drawn UI kit: every element is built from Theme tokens so the whole game can be
-- restyled from Shared/Theme.luau. Uses UICorner/UIStroke/UIGradient (no image uploads needed);
-- pass an image id to Icon() to use AI-generated / Blender-rendered art instead.
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Theme = require(ReplicatedStorage.Shared.Theme)
local Images = require(ReplicatedStorage.Shared.Config.UiImages)

local UI = {}
local C = Theme.Colors

function UI.new(className: string, props: { [string]: any }, children: { Instance }?)
	local inst = Instance.new(className)
	for k, v in pairs(props) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	for _, child in ipairs(children or {}) do
		child.Parent = inst
	end
	if props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

function UI.corner(radius: UDim?)
	return UI.new("UICorner", { CornerRadius = radius or Theme.Corner })
end

function UI.stroke(color: Color3?, thickness: number?)
	return UI.new("UIStroke", {
		Color = color or C.Stroke,
		Thickness = thickness or Theme.StrokeThickness,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	})
end

function UI.gradient(top: Color3, bottom: Color3)
	return UI.new("UIGradient", { Color = ColorSequence.new(top, bottom), Rotation = 90 })
end

function UI.padding(px: number)
	local u = UDim.new(0, px)
	return UI.new("UIPadding", { PaddingTop = u, PaddingBottom = u, PaddingLeft = u, PaddingRight = u })
end

function UI.label(text: string, size: number, props: { [string]: any }?)
	local p = {
		Text = text,
		Font = Theme.Font,
		TextSize = size,
		TextColor3 = C.Text,
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, size + 6),
		TextWrapped = true,
	}
	for k, v in pairs(props or {}) do
		p[k] = v
	end
	local l = UI.new("TextLabel", p)
	UI.new("UIStroke", { Color = C.Stroke, Thickness = 2, Parent = l }) -- text outline = readable on any bg
	return l
end

function UI.panel(props: { [string]: any }, children: { Instance }?)
	local p = { BackgroundColor3 = C.Panel, BorderSizePixel = 0 }
	for k, v in pairs(props) do
		p[k] = v
	end
	local f = UI.new("Frame", p, children)
	UI.corner().Parent = f
	UI.stroke().Parent = f
	return f
end

---------------------------------------------------------------- image system
-- Every image is looked up by key in Config/UiImages. id "rbxassetid://0" (not uploaded yet) = nil,
-- so each caller falls back to the code-drawn look and the game always works before uploads.
function UI.imageId(key: string?): string?
	local e = key and Images[key]
	if e and e.id and e.id ~= "" and e.id ~= "rbxassetid://0" then
		return e.id
	end
	return nil
end

function UI.hasImage(key: string?): boolean
	return UI.imageId(key) ~= nil
end

function UI.isTouch(): boolean
	return UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
end

-- Image if uploaded, else the glossy code-drawn circle with a glyph.
function UI.image(key: string?, fallbackGlyph: string, color: Color3, size: number)
	local id = UI.imageId(key)
	if id then
		return UI.new("ImageLabel", {
			Name = "Image",
			Image = id,
			BackgroundTransparency = 1,
			Size = UDim2.fromOffset(size, size),
			ScaleType = Enum.ScaleType.Fit,
		})
	end
	return UI.icon(nil, fallbackGlyph, color, size)
end

-- 9-slice skin behind a frame's content. Returns the ImageLabel, or nil when the key has no upload yet.
function UI.skin(frame: GuiObject, key: string?, tint: Color3?): ImageLabel?
	local id = UI.imageId(key)
	if not id then
		return nil
	end
	local e = Images[key :: string]
	local props = {
		Name = "Skin",
		Image = id,
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 0,
		ImageColor3 = tint or Color3.new(1, 1, 1),
		Parent = frame,
	} :: { [string]: any }
	if e.slice then
		props.ScaleType = Enum.ScaleType.Slice
		props.SliceCenter = Rect.new(e.slice[1], e.slice[2], e.slice[3], e.slice[4])
	else
		props.ScaleType = Enum.ScaleType.Stretch
	end
	return UI.new("ImageLabel", props) :: ImageLabel
end

-- which button background image fits a colour (nil = keep the code-drawn gradient)
local function buttonSkinFor(color: Color3): string?
	local h, s, v = color:ToHSV()
	if s < 0.5 or v < 0.6 then
		return nil
	end
	if h >= 0.25 and h <= 0.45 then
		return "btn_green"
	elseif h >= 0.08 and h <= 0.17 then
		return "btn_gold"
	elseif h <= 0.03 or h >= 0.96 then
		return "btn_red"
	elseif h >= 0.5 and h <= 0.58 then
		return "btn_blue"
	end
	return nil
end

-- Chunky "candy" button with hover/press scale animation. props.Skin = image key | false to force.
function UI.button(text: string, color: Color3, onClick: () -> (), props: { [string]: any }?)
	local p = {
		Text = "",
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(1, 1, 1),
		Size = UDim2.fromOffset(160, 52),
	} :: { [string]: any }
	local skinKey: any = nil
	for k, v in pairs(props or {}) do
		if k == "Skin" then
			skinKey = v
		else
			p[k] = v
		end
	end
	if UI.isTouch() then -- bigger touch targets
		local sz = p.Size :: UDim2
		p.Size = UDim2.new(sz.X.Scale, if sz.X.Scale == 0 then math.max(sz.X.Offset, 40) else sz.X.Offset, sz.Y.Scale, if sz.Y.Scale == 0 then math.max(sz.Y.Offset, 40) else sz.Y.Offset)
	end
	local b = UI.new("TextButton", p) :: TextButton
	if skinKey == nil then
		skinKey = buttonSkinFor(color)
	end
	if skinKey and UI.skin(b, skinKey) then
		b.BackgroundTransparency = 1
	else
		UI.corner().Parent = b
		UI.stroke().Parent = b
		local h, s, v = color:ToHSV()
		UI.gradient(Color3.fromHSV(h, s * 0.85, math.min(1, v * 1.15)), Color3.fromHSV(h, s, v * 0.8)).Parent = b
	end
	local scale = UI.new("UIScale", { Parent = b })
	UI.label(text, 22, { Size = UDim2.fromScale(1, 1), Name = "Label", Parent = b })

	b.MouseEnter:Connect(function()
		TweenService:Create(scale, Theme.Tween, { Scale = 1.06 }):Play()
	end)
	b.MouseLeave:Connect(function()
		TweenService:Create(scale, Theme.Tween, { Scale = 1 }):Play()
	end)
	b.MouseButton1Down:Connect(function()
		TweenService:Create(scale, Theme.TweenFast, { Scale = 0.92 }):Play()
	end)
	b.MouseButton1Up:Connect(function()
		TweenService:Create(scale, Theme.Tween, { Scale = 1.06 }):Play()
	end)
	b.Activated:Connect(onClick)
	return b
end

-- Hover tooltip (PC only; touch has none).
local tipFrame: Frame? = nil
function UI.tooltip(obj: GuiObject, text: string)
	if UI.isTouch() then
		return
	end
	local conn: RBXScriptConnection? = nil
	obj.MouseEnter:Connect(function()
		local root = obj:FindFirstAncestorOfClass("ScreenGui")
		if not root then
			return
		end
		if not tipFrame or tipFrame.Parent ~= root then
			if tipFrame then
				tipFrame:Destroy()
			end
			tipFrame = UI.panel({ Name = "Tooltip", Size = UDim2.fromOffset(200, 30), BackgroundColor3 = C.Bg, ZIndex = 60, Visible = false, Parent = root }, {
				UI.label("", 16, { Name = "T", Size = UDim2.fromScale(1, 1), ZIndex = 61 }),
			})
		end
		local tip = tipFrame :: Frame
		(tip:FindFirstChild("T") :: TextLabel).Text = text
		tip.Size = UDim2.fromOffset(math.max(80, #text * 9 + 24), 30)
		tip.Visible = true
		local sc = root:FindFirstChildOfClass("UIScale")
		local inset = game:GetService("GuiService"):GetGuiInset()
		if conn then
			conn:Disconnect()
		end
		conn = game:GetService("RunService").RenderStepped:Connect(function()
			local m = UserInputService:GetMouseLocation() - inset
			local k = if sc then sc.Scale else 1
			tip.Position = UDim2.fromOffset(m.X / k + 16, m.Y / k + 18)
		end)
	end)
	obj.MouseLeave:Connect(function()
		if conn then
			conn:Disconnect()
			conn = nil
		end
		if tipFrame then
			tipFrame.Visible = false
		end
	end)
end

-- Red notification dot (with optional count) pinned to a button's top-right. Returns set(n).
function UI.badge(parent: GuiObject): (number?) -> ()
	local dot = UI.panel({ Name = "Dot", Size = UDim2.fromOffset(24, 24), AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 4, 0, -4), BackgroundColor3 = C.Danger, Visible = false, ZIndex = 5, Parent = parent })
	UI.corner(UDim.new(1, 0)).Parent = dot
	local l = UI.label("!", 16, { Size = UDim2.fromScale(1, 1), ZIndex = 6, Parent = dot })
	local tween = TweenService:Create(dot, TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Size = UDim2.fromOffset(29, 29) })
	return function(n: number?)
		local on = n ~= nil and n > 0
		dot.Visible = on
		if on then
			l.Text = if n and n > 1 and n < 10 then tostring(n) else "!"
			tween:Play()
		else
			tween:Cancel()
		end
	end
end

-- Tutorial hint: bobbing arrow + speech bubble + pulsing ring on a target. Returns a dismiss function.
function UI.hint(target: GuiObject, text: string, side: string?): () -> ()
	local up = side == nil or side == "up"
	local right = side == "right"
	local holder = UI.new("Frame", { Name = "Hint", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 40, Parent = target })
	local ring = UI.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(1, 8, 1, 8), ZIndex = 40, Parent = holder }, {
		UI.corner(UDim.new(0, 18)),
		UI.new("UIStroke", { Color = C.Gold, Thickness = 4 }),
	})
	local pulse = TweenService:Create(ring, TweenInfo.new(0.55, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Size = UDim2.new(1, 22, 1, 22) })
	pulse:Play()
	local bubble = UI.panel({
		Size = UDim2.fromOffset(230, 52),
		BackgroundColor3 = C.Primary,
		AnchorPoint = if right then Vector2.new(0, 0.5) else Vector2.new(0.5, if up then 1 else 0),
		Position = if right then UDim2.new(1, 44, 0.5, 0) else UDim2.new(0.5, 0, if up then 0 else 1, if up then -40 else 40),
		ZIndex = 41,
		Parent = holder,
	})
	UI.label(text, 16, { Size = UDim2.new(1, -12, 1, 0), Position = UDim2.fromOffset(6, 0), ZIndex = 42, Parent = bubble })
	local arrow = UI.label(if right then "◀" else (if up then "▼" else "▲"), 30, {
		Size = UDim2.fromOffset(34, 34),
		TextColor3 = C.Gold,
		ZIndex = 41,
		AnchorPoint = if right then Vector2.new(0, 0.5) else Vector2.new(0.5, if up then 1 else 0),
		Position = if right then UDim2.new(1, 8, 0.5, 0) else UDim2.new(0.5, 0, if up then 0 else 1, if up then -4 else 4),
		Parent = holder,
	})
	local bob = TweenService:Create(arrow, TweenInfo.new(0.45, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
		Position = if right then UDim2.new(1, 18, 0.5, 0) else UDim2.new(0.5, 0, if up then 0 else 1, if up then -14 else 14),
	})
	bob:Play()
	return function()
		pulse:Cancel()
		bob:Cancel()
		holder:Destroy()
	end
end

-- Image icon if an asset id is set, otherwise a code-drawn glossy circle with an emoji/glyph.
function UI.icon(image: string?, glyph: string, color: Color3, size: number)
	if image and image ~= "" and image ~= "rbxassetid://0" then
		return UI.new("ImageLabel", {
			Image = image,
			BackgroundTransparency = 1,
			Size = UDim2.fromOffset(size, size),
			ScaleType = Enum.ScaleType.Fit,
		})
	end
	local f = UI.new("Frame", { Size = UDim2.fromOffset(size, size), BackgroundColor3 = Color3.new(1, 1, 1) })
	UI.corner(UDim.new(1, 0)).Parent = f
	UI.stroke(C.Stroke, 2).Parent = f
	local h, s, v = color:ToHSV()
	UI.gradient(Color3.fromHSV(h, s * 0.6, 1), Color3.fromHSV(h, s, v * 0.75)).Parent = f
	UI.label(glyph, math.floor(size * 0.55), { Size = UDim2.fromScale(1, 1), Parent = f })
	return f
end

-- Replace a panel's code-drawn look (fill, gradient, stroke) with a 9-slice image when uploaded.
function UI.skinPanel(frame: GuiObject, key: string?): boolean
	if not UI.skin(frame, key) then
		return false
	end
	frame.BackgroundTransparency = 1
	for _, ch in ipairs(frame:GetChildren()) do
		if ch:IsA("UIGradient") or ch:IsA("UIStroke") or ch:IsA("UICorner") then
			ch:Destroy()
		end
	end
	return true
end

-- Open/close with pop animation
function UI.pop(gui: GuiObject, open: boolean)
	local scale = gui:FindFirstChildOfClass("UIScale") or UI.new("UIScale", { Parent = gui })
	if open then
		gui.Visible = true
		scale.Scale = 0.6
		TweenService:Create(scale, Theme.Tween, { Scale = 1 }):Play()
	else
		local t = TweenService:Create(scale, Theme.TweenFast, { Scale = 0.6 })
		t.Completed:Once(function()
			gui.Visible = false
		end)
		t:Play()
	end
end

function UI.formatNumber(n: number): string
	n = math.floor(n)
	if n >= 1e9 then
		return ("%.1fB"):format(n / 1e9)
	elseif n >= 1e6 then
		return ("%.1fM"):format(n / 1e6)
	elseif n >= 1e4 then
		return ("%.1fK"):format(n / 1e3)
	end
	local s = tostring(n)
	return (s:reverse():gsub("(%d%d%d)", "%1,"):reverse():gsub("^,", ""))
end

return UI
