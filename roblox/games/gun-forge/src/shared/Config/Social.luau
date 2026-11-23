-- Social boosts (encourage playing with friends / joining the group).
return {
	FriendBoostPer = 0.05, FriendBoostMax = 0.25, -- +5% training & coins per friend in the server (max +25%)
	PremiumBoost = 0.1, -- Roblox Premium members: +10% training & coins
	GroupId = 0, -- your Roblox group id (0 = disabled)
	GroupBoost = 0.1, -- +10% for group members
	GroupChest = { cooldownHours = 24, reward = { Gems = 15, Coins = 500 } },
}
