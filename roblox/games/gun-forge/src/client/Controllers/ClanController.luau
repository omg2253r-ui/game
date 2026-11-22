-- Clans: create / info / members (promote, kick) / invite nearby players / weekly Clan War top 10.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Combat = require(Shared.Config.Combat)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local UIController = require(script.Parent.UIController)

local C = Theme.Colors
local Clan = {}
local body, tab = nil, "MY CLAN"
local ROLE = { ["1Leader"] = "Leader", ["2Officer"] = "Officer", ["3Member"] = "Member" }

local function input(parent: Instance, placeholder: string, y: number): TextBox
	local box = UI.new("TextBox", { PlaceholderText = placeholder, Text = "", Font = Theme.Font, TextSize = 22, TextColor3 = C.Text, BackgroundColor3 = C.Bg,
		Size = UDim2.fromOffset(300, 48), Position = UDim2.fromOffset(140, y), ClearTextOnFocus = false, Parent = parent })
	UI.corner().Parent = box
	UI.stroke().Parent = box
	return box
end

local function renderCreate()
	local holder = UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 260), Parent = body })
	UI.label("You are not in a clan. Create one or ask a clan member for an invite!", 16, { Size = UDim2.new(1, 0, 0, 24), Parent = holder })
	local name = input(holder, "Clan name (3-20)", 40)
	local tag = input(holder, "TAG (2-4)", 100)
	local res = UI.label("", 16, { Position = UDim2.fromOffset(0, 220), Size = UDim2.new(1, 0, 0, 24), Parent = holder })
	UI.button(("CREATE (%s Coins)"):format(W.short(Combat.Clan.CreateCoins)), C.Primary, function()
		local r = Net.invoke("ClanCreate", name.Text, tag.Text)
		res.Text = if r == "OK" then "Clan created!" else tostring(r)
		if r == "OK" then
			task.defer(Clan.Render)
		end
	end, { Position = UDim2.fromOffset(140, 160), Size = UDim2.fromOffset(300, 50), Parent = holder })
end

local function renderMine(info)
	UIController.List(body)
	local c = info.clan
	UIController.Row(body, 0, ("[%s] %s  •  Lv %d"):format(c.tag, c.name, c.level), ("%d/%d members • XP %s • perk +%d%% drops & coins"):format(#c.members, c.max, W.short(c.xp), math.floor(c.perk * 100)),
		"LEAVE", C.Danger, true, function()
			Net.invoke("ClanLeave")
			task.defer(Clan.Render)
		end, (c.xp % Combat.Clan.XpPerLevel) / Combat.Clan.XpPerLevel)
	for i, m in ipairs(c.members) do
		local canManage = info.role < m.role
		local action = if info.role == "1Leader" and m.role == "3Member" then "promote" elseif canManage then "kick" else nil
		UIController.Row(body, i, (if m.online then "🟢 " else "⚫ ") .. m.name, ROLE[m.role] or m.role, if action == "promote" then "PROMOTE" elseif action then "KICK" else "", C.PanelLight, action ~= nil, function()
			Net.invoke("ClanManage", m.userId, action)
			task.defer(Clan.Render)
		end)
	end
	if info.role ~= "3Member" then
		local o = 100
		for _, p in ipairs(Players:GetPlayers()) do
			if p ~= Players.LocalPlayer and not p:GetAttribute("ClanTag") then
				o += 1
				UIController.Row(body, o, "Invite " .. p.DisplayName, "Player in this server without a clan", "INVITE", C.Primary, true, function()
					Net.send("ClanInviteSend", p.UserId)
					UIController.Toast("Invite sent to " .. p.DisplayName, "success")
				end)
			end
		end
	end
end

local function renderWar()
	UIController.List(body)
	local list = Net.invoke("ClanWarTop") or {}
	UIController.Row(body, 0, "WEEKLY CLAN WAR", "Clans earn XP from kills, bosses and PvP wins. Resets every Monday.", "", C.Panel, false, function() end)
	for _, e in ipairs(list) do
		UIController.Row(body, e.rank, ("#%d  [%s] %s"):format(e.rank, e.tag, e.name), W.short(e.xp) .. " XP", "", C.Panel, false, function() end)
	end
end

function Clan.Render()
	if not body then
		return
	end
	W.clear(body)
	if tab == "WAR" then
		renderWar()
		return
	end
	local info = Net.invoke("ClanInfo")
	if info and info.clan then
		renderMine(info)
	else
		renderCreate()
	end
end

function Clan.Init()
	local win, b = UIController.MakeWindow("Clan", "CLANS", C.Energy)
	body = b
	local select = W.tabs(win, b, { "MY CLAN", "WAR" }, function(name)
		tab = name
		Clan.Render()
	end)
	UIController.AddMenuButton(10, "CLAN", C.Energy, "Clan").Activated:Connect(function()
		task.defer(Clan.Render)
	end)
	Net.listen("ClanInvite", function(inv)
		local box, close = W.modal(UIController.Gui(), "CLAN INVITE", C.Energy)
		UI.label(("%s invited you to [%s] %s"):format(inv.from, inv.tag, inv.name), 24, { Position = UDim2.fromOffset(20, 120), Size = UDim2.new(1, -40, 0, 80), Parent = box })
		UI.button("JOIN", C.Primary, function()
			local r = Net.invoke("ClanAccept", inv.id)
			UIController.Toast(if r == "OK" then "Joined clan!" else tostring(r), if r == "OK" then "success" else "error")
			close()
		end, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(0.5, -8, 1, -20), Size = UDim2.fromOffset(170, 54), Parent = box })
		UI.button("NO", C.PanelLight, close, { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0.5, 8, 1, -20), Size = UDim2.fromOffset(170, 54), Parent = box })
	end)
	select("MY CLAN")
end

return Clan
