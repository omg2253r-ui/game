-- Moves monster models locally from server segments (zero physics/network per frame), HP bars,
-- death poofs, world-boss slam telegraph. Also exposes targeting queries for GunController.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Net = require(ReplicatedStorage.Shared.Net)
local Theme = require(ReplicatedStorage.Shared.Theme)
local UI = require(script.Parent.Parent.UIKit)
local Effects = require(script.Parent.EffectsController)

local MonsterController = {}
type Rec = { model: Model, size: number, bar: Frame?, last: Vector3 }
local tracked: { [Model]: Rec } = {}

local function pos(m: Model): Vector3
	local from, to = m:GetAttribute("From"), m:GetAttribute("To")
	local t0, dur = m:GetAttribute("T0"), m:GetAttribute("Dur")
	if typeof(from) ~= "Vector3" or typeof(to) ~= "Vector3" then
		return m:GetPivot().Position
	end
	if type(dur) ~= "number" or dur <= 0 then
		return to
	end
	local a = math.clamp((Workspace:GetServerTimeNow() - t0) / dur, 0, 1)
	return from:Lerp(to, a)
end
MonsterController.Pos = pos

function MonsterController.Alive(): { Model }
	local out = {}
	for m in pairs(tracked) do
		if (m:GetAttribute("HP") or 0) > 0 then
			table.insert(out, m)
		end
	end
	return out
end

local function poof(at: Vector3, size: number, color: Color3)
	if Effects.LowFx then
		return
	end
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch = true, false, false, false
	p.Shape = Enum.PartType.Ball
	p.Material = Enum.Material.Neon
	p.Color = color
	p.Size = Vector3.one * size * 0.6
	p.Position = at
	p.Parent = Workspace
	TweenService:Create(p, TweenInfo.new(0.35, Enum.EasingStyle.Quad), { Size = Vector3.one * size * 1.8, Transparency = 1 }):Play()
	task.delay(0.4, function()
		p:Destroy()
	end)
end

local function track(m: Instance)
	if not m:IsA("Model") or tracked[m] then
		return
	end
	local size = m:GetAttribute("Size") or 4
	local root = m.PrimaryPart or m:FindFirstChildWhichIsA("BasePart")
	local rec: Rec = { model = m, size = size, last = pos(m) }
	if root then
		local bb = Instance.new("BillboardGui")
		bb.Size = UDim2.fromOffset(if m:GetAttribute("Boss") then 260 else 130, 34)
		bb.StudsOffset = Vector3.new(0, size * 0.75 + 1, 0)
		bb.MaxDistance = if m:GetAttribute("Boss") then 250 else 90
		UI.label(tostring(m:GetAttribute("Name") or "?"), 14, { Size = UDim2.new(1, 0, 0, 16), TextColor3 = if m:GetAttribute("Boss") then Theme.Colors.Gold else Color3.new(1, 1, 1), Parent = bb })
		local back = UI.new("Frame", { BackgroundColor3 = Color3.fromRGB(20, 16, 30), Position = UDim2.fromOffset(0, 18), Size = UDim2.new(1, 0, 0, 10), Parent = bb }, { UI.corner(UDim.new(1, 0)) })
		rec.bar = UI.new("Frame", { BackgroundColor3 = Theme.Colors.Danger, Size = UDim2.fromScale(1, 1), Parent = back }, { UI.corner(UDim.new(1, 0)) })
		bb.Parent = root
	end
	m:GetAttributeChangedSignal("HP"):Connect(function()
		local hp, max = m:GetAttribute("HP") or 0, m:GetAttribute("MaxHP") or 1
		if rec.bar then
			rec.bar.Size = UDim2.fromScale(math.clamp(hp / max, 0, 1), 1)
		end
		if hp <= 0 then
			local col = root and (root :: BasePart).Color or Color3.new(1, 1, 1)
			poof(rec.last, size, col)
		end
	end)
	tracked[m] = rec
end

local function slam(center: Vector3, radius: number, delay: number)
	local ring = Instance.new("Part")
	ring.Anchored, ring.CanCollide, ring.CanQuery, ring.CanTouch = true, false, false, false
	ring.Shape = Enum.PartType.Cylinder
	ring.Material = Enum.Material.Neon
	ring.Color = Theme.Colors.Danger
	ring.Transparency = 0.5
	ring.Size = Vector3.new(0.3, 2, 2)
	ring.CFrame = CFrame.new(center + Vector3.new(0, 0.3, 0)) * CFrame.Angles(0, 0, math.rad(90))
	ring.Parent = Workspace
	TweenService:Create(ring, TweenInfo.new(delay, Enum.EasingStyle.Linear), { Size = Vector3.new(0.3, radius * 2, radius * 2) }):Play()
	task.delay(delay, function()
		ring.Transparency = 0.1
		TweenService:Create(ring, TweenInfo.new(0.3), { Transparency = 1 }):Play()
		task.wait(0.35)
		ring:Destroy()
	end)
end

function MonsterController.Init()
	local folder = Workspace:WaitForChild("Monsters", 30)
	if not folder then
		return
	end
	folder.ChildAdded:Connect(track)
	folder.ChildRemoved:Connect(function(m)
		tracked[m :: Model] = nil
	end)
	for _, m in ipairs(folder:GetChildren()) do
		track(m)
	end
	Net.listen("BossSlam", slam)

	local cam = Workspace.CurrentCamera
	local player = Players.LocalPlayer
	RunService.Heartbeat:Connect(function()
		local camPos = cam.CFrame.Position
		local char = player.Character
		local me = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		local t = os.clock()
		for m, rec in pairs(tracked) do
			local p = pos(m)
			if (p - camPos).Magnitude < 260 then
				local dir = p - rec.last
				local look
				if me and (me.Position - p).Magnitude < 40 then
					look = Vector3.new(me.Position.X, p.Y, me.Position.Z)
				elseif dir.Magnitude > 0.01 then
					look = p + Vector3.new(dir.X, 0, dir.Z)
				end
				local bob = math.abs(math.sin(t * 6 + rec.size)) * rec.size * 0.12
				local at = p + Vector3.new(0, bob, 0)
				m:PivotTo(if look and (look - p).Magnitude > 0.05 then CFrame.lookAt(at, Vector3.new(look.X, at.Y, look.Z)) else CFrame.new(at))
			end
			rec.last = p
		end
	end)
end

return MonsterController
