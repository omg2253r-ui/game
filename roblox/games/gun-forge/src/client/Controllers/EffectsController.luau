-- Client-only visuals (zero server cost): coin spin, pickup burst + floating text,
-- and a quality governor that turns heavy effects off on weak devices / Low Graphics.
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local Net = require(ReplicatedStorage.Shared.Net)

local EffectsController = { LowFx = false }
local spinning: { BasePart } = {}

function EffectsController.SetLowFx(on: boolean)
	EffectsController.LowFx = on
	for _, e in ipairs(Lighting:GetChildren()) do
		if e:IsA("PostEffect") then
			e.Enabled = not on -- Bloom/SunRays/DepthOfField/ColorCorrection
		end
	end
	for _, d in ipairs(workspace:GetDescendants()) do
		if d:IsA("ParticleEmitter") and d:GetAttribute("Decor") then
			d.Enabled = not on
		end
	end
end

local function burst(pos: Vector3, amount: number)
	if EffectsController.LowFx then
		return
	end
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch = true, false, false, false
	p.Transparency = 1
	p.Size = Vector3.one
	p.Position = pos
	local a = Instance.new("Attachment")
	a.Parent = p
	local pe = Instance.new("ParticleEmitter")
	pe.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	pe.Color = ColorSequence.new(Color3.fromRGB(255, 220, 80))
	pe.LightEmission = 0.8
	pe.Size = NumberSequence.new(0.6, 0)
	pe.Speed = NumberRange.new(8, 14)
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.Lifetime = NumberRange.new(0.4, 0.6)
	pe.Rate = 0
	pe.Parent = a
	p.Parent = workspace
	pe:Emit(12)

	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(120, 40)
	bb.AlwaysOnTop = true
	bb.Adornee = p
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.fromScale(1, 1)
	t.Font = Enum.Font.FredokaOne
	t.TextScaled = true
	t.Text = "+" .. amount
	t.TextColor3 = Color3.fromRGB(255, 220, 60)
	t.TextStrokeTransparency = 0
	t.Parent = bb
	bb.Parent = p
	TweenService:Create(bb, TweenInfo.new(0.8), { StudsOffset = Vector3.new(0, 4, 0) }):Play()
	TweenService:Create(t, TweenInfo.new(0.8), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	task.delay(1, function()
		p:Destroy()
	end)
end

function EffectsController.Init()
	-- coin spin: one RenderStepped loop for all coins, skipped when far away
	local function track(inst)
		if inst:IsA("BasePart") and inst:GetAttribute("Spin") then
			table.insert(spinning, inst)
		end
	end
	local folder = workspace:WaitForChild("Collectibles", 10)
	if folder then
		folder.ChildAdded:Connect(track)
		for _, c in ipairs(folder:GetChildren()) do
			track(c)
		end
	end
	local cam = workspace.CurrentCamera
	RunService.RenderStepped:Connect(function(dt) -- lint-ok (distance-culled spin)
		local camPos = cam.CFrame.Position
		for i = #spinning, 1, -1 do
			local part = spinning[i]
			if not part.Parent then
				table.remove(spinning, i)
			elseif (part.Position - camPos).Magnitude < 150 then
				part.CFrame *= CFrame.Angles(dt * 2, 0, 0)
			end
		end
	end)

	Net.listen("Collected", function(pos, amount)
		burst(pos, amount)
	end)

	-- auto low-fx on very low quality settings
	local ok, q = pcall(function()
		return UserSettings().GameSettings.SavedQualityLevel.Value
	end)
	if ok and q > 0 and q <= 3 then
		EffectsController.SetLowFx(true)
	end
end

return EffectsController
