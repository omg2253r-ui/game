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

local function recount()
	local list = Players:GetPlayers()
	for _, p in ipairs(list) do
		local n = 0
		for _, other in ipairs(list) do
			if other ~= p then
				local ok, yes = pcall(p.IsFriendsWith, p, other.UserId)
				if ok and yes then
					n += 1
				end
			end
		end
		friendCount[p] = n
		p:SetAttribute("SocialBoost", math.floor((SocialService.Mult(p) - 1) * 100 + 0.5))
	end
end

function SocialService.Init(services)
	S = services
	Players.PlayerAdded:Connect(function(p)
		if Social.GroupId ~= 0 then
			local ok, yes = pcall(p.IsInGroup, p, Social.GroupId)
			inGroup[p] = ok and yes or false
		end
		task.delay(2, recount)
	end)
	Players.PlayerRemoving:Connect(function(p)
		friendCount[p], inGroup[p] = nil, nil
		task.delay(1, recount)
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
