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
local Vfx = require(script.Parent.VfxController)

local MonsterController = {}
type Rec = { model: Model, size: number, bar: Frame?, last: Vector3, born: number, rot: CFrame, atk: number, color: Color3 }
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

function MonsterController.Bob(m: Model): number
	local s = m:GetAttribute("Size") or 4
	return s * 0.1
end

function MonsterController.Alive(): { Model }
	local out = {}
	for m in pairs(tracked) do
		if (m:GetAttribute("HP") or 0) > 0 then
			table.insert(out, m)
		end
	end
	return out
end

local function track(m: Instance)
	if not m:IsA("Model") or tracked[m] then
		return
	end
	local size = m:GetAttribute("Size") or 4
	local root = m.PrimaryPart or m:FindFirstChildWhichIsA("BasePart")
	local rec: Rec = { model = m, size = size, last = pos(m), born = os.clock(), rot = CFrame.identity, atk = 0,
		color = if root and root:IsA("BasePart") then root.Color else Color3.new(1, 1, 1) }
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
	m:GetAttributeChangedSignal("Atk"):Connect(function()
		rec.atk = os.clock()
	end)
	m:GetAttributeChangedSignal("HP"):Connect(function()
		local hp, max = m:GetAttribute("HP") or 0, m:GetAttribute("MaxHP") or 1
		if rec.bar then
			rec.bar.Size = UDim2.fromScale(math.clamp(hp / max, 0, 1), 1)
		end
		if hp <= 0 then
			Vfx.DeathBurst(rec.last, size, rec.color)
		end
	end)
	tracked[m] = rec
end

local function slam(center: Vector3, radius: number, delay: number)
	task.delay(delay, function()
		Vfx.Sound(require(ReplicatedStorage.Shared.Config.Sounds).Slam, center)
		Vfx.Shake(0.6, 0.35)
	end)
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
	RunService.Heartbeat:Connect(function(dt)
		local camPos = cam.CFrame.Position
		local char = player.Character
		local me = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		local t = os.clock()
		for m, rec in pairs(tracked) do
			local p = pos(m)
			if (p - camPos).Magnitude < 260 then
				local moving = (p - rec.last).Magnitude > 0.01
				-- facing: player if close, else movement direction; slerped for smooth turns
				local look
				if me and (me.Position - p).Magnitude < 40 then
					look = Vector3.new(me.Position.X, p.Y, me.Position.Z) - p
				elseif moving then
					look = Vector3.new(p.X - rec.last.X, 0, p.Z - rec.last.Z)
				end
				if look and look.Magnitude > 0.05 then
					rec.rot = rec.rot:Lerp(CFrame.lookAt(Vector3.zero, look.Unit), math.clamp(dt * 10, 0, 1))
				end
				-- hop while moving, gentle idle breathing otherwise
				local speed = if moving then 9 else 3
				local hop = math.abs(math.sin(t * speed + rec.size)) * rec.size * (if moving then 0.18 else 0.05)
				-- spawn: rise out of the ground
				local age = t - rec.born
				local rise = if age < 0.5 then -(1 - age / 0.5) ^ 2 * rec.size else 0
				-- attack: wind-up back then lunge forward
				local lunge = 0
				local at = t - rec.atk
				if at < 0.5 then
					lunge = if at < 0.25 then -at / 0.25 * 0.6 else math.sin((at - 0.25) / 0.25 * math.pi) * 1.8
				end
				local cf = CFrame.new(p + Vector3.new(0, hop + rise, 0)) * rec.rot * CFrame.new(0, 0, -lunge * rec.size * 0.3)
				m:PivotTo(cf)
			end
			rec.last = p
		end
	end)
end

return MonsterController
