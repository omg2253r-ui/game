-- Remote networking with per-player rate limiting.
-- Server: Net.on(name, handler, perSecond?)  /  Net.fire(player, name, ...)  /  Net.fireAll(name, ...)
-- Client: Net.send(name, ...)  /  Net.listen(name, handler)  /  Net.invoke(name, ...)
-- Server : Net.handle(name, handler, perSecond?) for RemoteFunctions.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local IS_SERVER = RunService:IsServer()
local Net = {}

local folder: Folder
if IS_SERVER then
	folder = ReplicatedStorage:FindFirstChild("Remotes") or Instance.new("Folder")
	folder.Name = "Remotes"
	folder.Parent = ReplicatedStorage
else
	folder = ReplicatedStorage:WaitForChild("Remotes")
end

local function getRemote(name: string, className: string)
	local r = folder:FindFirstChild(name)
	if r then
		return r
	end
	if IS_SERVER then
		r = Instance.new(className)
		r.Name = name
		r.Parent = folder
		return r
	end
	return folder:WaitForChild(name, 15)
end

-- token bucket per player per remote
local buckets = {}
local function allow(player: Player, name: string, perSecond: number): boolean
	local key = name
	buckets[player] = buckets[player] or {}
	local b = buckets[player][key]
	local now = os.clock()
	if not b then
		b = { tokens = perSecond, t = now }
		buckets[player][key] = b
	end
	b.tokens = math.min(perSecond, b.tokens + (now - b.t) * perSecond)
	b.t = now
	if b.tokens < 1 then
		return false
	end
	b.tokens -= 1
	return true
end

if IS_SERVER then
	Players.PlayerRemoving:Connect(function(p)
		buckets[p] = nil
	end)

	-- Declare a remote ahead of time so clients can find it immediately.
	function Net.declare(name: string)
		getRemote(name, "RemoteEvent")
	end

	function Net.on(name: string, handler: (Player, ...any) -> (), perSecond: number?)
		local rate = perSecond or 10
		getRemote(name, "RemoteEvent").OnServerEvent:Connect(function(player, ...) -- lint-ok (rate limited)
			if allow(player, name, rate) then
				handler(player, ...)
			end
		end)
	end

	function Net.handle(name: string, handler: (Player, ...any) -> ...any, perSecond: number?)
		local rate = perSecond or 5
		getRemote(name, "RemoteFunction").OnServerInvoke = function(player, ...)
			if not allow(player, name, rate) then
				return nil
			end
			return handler(player, ...)
		end
	end

	function Net.fire(player: Player, name: string, ...)
		getRemote(name, "RemoteEvent"):FireClient(player, ...)
	end

	function Net.fireAll(name: string, ...)
		getRemote(name, "RemoteEvent"):FireAllClients(...) -- lint-ok
	end
else
	function Net.send(name: string, ...)
		getRemote(name, "RemoteEvent"):FireServer(...)
	end

	function Net.listen(name: string, handler: (...any) -> ())
		return getRemote(name, "RemoteEvent").OnClientEvent:Connect(handler)
	end

	function Net.invoke(name: string, ...)
		return getRemote(name, "RemoteFunction"):InvokeServer(...)
	end
end

return Net
