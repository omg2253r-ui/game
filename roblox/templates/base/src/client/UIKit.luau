-- Code-drawn UI kit: every element is built from Theme tokens so the whole game can be
-- restyled from Shared/Theme.luau. Uses UICorner/UIStroke/UIGradient (no image uploads needed);
-- pass an image id to Icon() to use AI-generated / Blender-rendered art instead.
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Theme = require(ReplicatedStorage.Shared.Theme)

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

-- Chunky "candy" button with hover/press scale animation.
function UI.button(text: string, color: Color3, onClick: () -> (), props: { [string]: any }?)
	local p = {
		Text = "",
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(1, 1, 1),
		Size = UDim2.fromOffset(160, 52),
	}
	for k, v in pairs(props or {}) do
		p[k] = v
	end
	local b = UI.new("TextButton", p)
	UI.corner().Parent = b
	UI.stroke().Parent = b
	local h, s, v = color:ToHSV()
	UI.gradient(Color3.fromHSV(h, s * 0.85, math.min(1, v * 1.15)), Color3.fromHSV(h, s, v * 0.8)).Parent = b
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
