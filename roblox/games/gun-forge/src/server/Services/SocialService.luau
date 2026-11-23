-- Friend boost (friends in this server), Roblox Premium bonus, group membership bonus + daily chest.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Social = require(ReplicatedStorage.Shared.Config.Social)
local Net = require(ReplicatedStorage.Shared.Net)

local SocialService = {}
local S
local friendCount: { [Player]: number } = {}
local inGroup: { [Player]: boolean } = {}

function SocialService.Mult(player: Player): number
	local m = 1 + math.min(Social.FriendBoostMax, (friendCount[player] or 0) * Social.FriendBoostPer)
	if player.MembershipType == Enum.MembershipType.Premium then
		m += Social.PremiumBoost
	end
	if inGroup[player] then
		m += Social.GroupBoost
	end
	return m
end

local friends: { [Player]: { [Player]: boolean } } = {}

local function refresh(p: Player)
	local n = 0
	for _ in pairs(friends[p] or {}) do
		n += 1
	end
	friendCount[p] = n
	p:SetAttribute("SocialBoost", math.floor((SocialService.Mult(p) - 1) * 100 + 0.5))
end

-- O(n) per join: only check pairs that involve the new player (web call each), not all pairs
local function onJoin(newP: Player)
	friends[newP] = friends[newP] or {}
	for _, other in ipairs(Players:GetPlayers()) do
		if other ~= newP then
			local ok, yes = pcall(newP.IsFriendsWith, newP, other.UserId)
			if ok and yes then
				friends[newP][other] = true
				friends[other] = friends[other] or {}
				friends[other][newP] = true
				refresh(other)
			end
		end
	end
	refresh(newP)
end

function SocialService.Init(services)
	S = services
	Players.PlayerAdded:Connect(function(p)
		if Social.GroupId ~= 0 then
			local ok, yes = pcall(p.IsInGroup, p, Social.GroupId)
			inGroup[p] = ok and yes or false
		end
		task.delay(2, onJoin, p)
	end)
	Players.PlayerRemoving:Connect(function(p)
		friendCount[p], inGroup[p] = nil, nil
		for other in pairs(friends[p] or {}) do
			if friends[other] then
				friends[other][p] = nil
				if other.Parent then
					refresh(other)
				end
			end
		end
		friends[p] = nil
	end)
	Net.handle("GroupChest", function(p)
		if Social.GroupId == 0 then
			return "Group chest is not set up yet"
		end
		if not inGroup[p] then
			local ok, yes = pcall(p.IsInGroup, p, Social.GroupId)
			inGroup[p] = ok and yes or false
			if not inGroup[p] then
				return "Join the group to open this chest!"
			end
		end
		local d = S.DataService.Get(p)
		if not d then
			return "Try again"
		end
		local last = d.social and d.social.chest or 0
		local wait = last + Social.GroupChest.cooldownHours * 3600 - os.time()
		if wait > 0 then
			return ("Come back in %dh %dm"):format(wait // 3600, (wait % 3600) // 60)
		end
		S.DataService.Update(p, function(data)
			data.social = data.social or {}
			data.social.chest = os.time()
		end)
		S.EconomyService.Grant(p, Social.GroupChest.reward, "groupchest")
		return "OK"
	end, 1)
end

return SocialService
