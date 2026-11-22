-- Retention UI: Season pass ("PASS"), Achievements/Titles/Story ("GOALS"), Daily Spin ("SPIN"), story tracker.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Theme = require(Shared.Theme)
local Net = require(Shared.Net)
local Season = require(Shared.Config.Season)
local Achievements = require(Shared.Config.Achievements)
local Spin = require(Shared.Config.Spin)
local Story = require(Shared.Config.Story)
local UI = require(script.Parent.Parent.UIKit)
local W = require(script.Parent.Parent.Widgets)
local PUI = require(script.Parent.Parent.ProgressUI)
local UIController = require(script.Parent.UIController)

local C = Theme.Colors
local Progress = {}

local seasonBody, goalsBody, spinBody, goalsWin
local selectTab, setTracker
local goalTab = "ACHIEVEMENTS"
local storyState, spinInfo, wheel, spinBtn, spinNote

local function onVisible(win: GuiObject, fn: () -> ())
	win:GetPropertyChangedSignal("Visible"):Connect(function()
		if win.Visible then
			fn()
		end
	end)
end

local function fmtTime(s: number): string
	return ("%dh %02dm"):format(s // 3600, (s % 3600) // 60)
end

---------------------------------------------------------------- season
local function renderSeason(st)
	W.clear(seasonBody)
	if not st then
		return
	end
	UIController.List(seasonBody)
	local into = st.xp - st.tier * Season.XpPerTier
	local sub = st.tier >= Season.Tiers and "Max tier reached!" or ("%d / %d XP to next tier"):format(into, Season.XpPerTier)
	UIController.Row(seasonBody, 0, ("%s  -  Tier %d / %d"):format(Season.Name, st.tier, Season.Tiers), sub .. (st.premium and "  •  PREMIUM ACTIVE" or "  •  Premium locked (Season Pass+ in SHOP)"), "", C.Panel, false, function() end, st.tier >= Season.Tiers and 1 or into / Season.XpPerTier)
	for t = 1, Season.Tiers do
		PUI.tierRow(seasonBody, t, st, Season, function(tier, premium)
			renderSeason(Net.invoke("SeasonClaim", tier, premium))
		end)
	end
end

---------------------------------------------------------------- achievements / titles / story
local function renderAchievements(info)
	UIController.List(goalsBody)
	local order = {}
	for i, a in ipairs(Achievements.List) do
		table.insert(order, { a = a, i = i, done = info.earned[a.id] == true })
	end
	table.sort(order, function(x, y)
		if x.done ~= y.done then
			return not x.done
		end
		return x.i < y.i
	end)
	for k, e in ipairs(order) do
		local a = e.a
		local v = info.values[a.id] or 0
		local reward = a.gems .. " Gems" .. (a.title and ("  •  Title: " .. Achievements.Titles[a.title].name) or "")
		UIController.Row(goalsBody, k, a.name, ("%s  (%s/%s)  •  %s"):format(a.desc, UI.formatNumber(math.min(v, a.goal)), UI.formatNumber(a.goal), reward), e.done and "DONE" or "IN PROGRESS", C.Primary, false, function() end, v / a.goal)
	end
end

local function renderTitles(info)
	UIController.List(goalsBody)
	UIController.Row(goalsBody, 0, "No Title", "Hide your title tag", info.title == "" and "EQUIPPED" or "EQUIP", C.Primary, info.title ~= "", function()
		Progress.Equip("")
	end)
	local ids = {}
	for id in pairs(Achievements.Titles) do
		table.insert(ids, id)
	end
	table.sort(ids)
	for i, id in ipairs(ids) do
		local own = info.owned[id] == true
		UIController.Row(goalsBody, i, Achievements.Titles[id].name, own and "Unlocked" or "Locked - earn it from achievements, the season pass or story", info.title == id and "EQUIPPED" or (own and "EQUIP" or "LOCKED"), C.Accent, own and info.title ~= id, function()
			Progress.Equip(id)
		end)
	end
end

local function renderStory()
	UIController.List(goalsBody)
	local st = storyState
	if not st then
		return
	end
	for i, step in ipairs(Story.Steps) do
		local label, enabled = "LOCKED", false
		local sub = step.text .. "  •  " .. Achievements.RewardText(step.reward)
		local prog
		if i < st.step or st.finished then
			label = "DONE"
		elseif i == st.step then
			label, enabled = st.done and "CLAIM" or "IN PROGRESS", st.done
			sub = ("%s (%s/%s)  •  %s"):format(step.text, UI.formatNumber(st.value), UI.formatNumber(st.goal), Achievements.RewardText(step.reward))
			prog = st.value / st.goal
		end
		UIController.Row(goalsBody, i, ("%s - Step %d"):format(Story.Npc, i), sub, label, C.Accent, enabled, function()
			Net.send("StoryClaim")
		end, prog)
	end
end

local function renderGoals()
	W.clear(goalsBody)
	if goalTab == "STORY" then
		return renderStory()
	end
	local info = Net.invoke("AchInfo")
	if not info then
		return
	end
	if goalTab == "TITLES" then
		renderTitles(info)
	else
		renderAchievements(info)
	end
end

function Progress.Equip(id: string)
	Net.invoke("EquipTitle", id)
	renderGoals()
end

---------------------------------------------------------------- spin
local function refreshSpinUi()
	if not spinInfo or not spinBtn then
		return
	end
	local free = spinInfo.freeIn <= 0
	spinBtn.Label.Text = free and "FREE SPIN!" or ("SPIN  -  %d Gems"):format(spinInfo.cost)
	spinNote.Text = free and "Your daily free spin is ready!" or ("Next free spin in %s  •  paid spins left today: %d"):format(fmtTime(spinInfo.freeIn), spinInfo.paidLeft)
end

local function buildSpin()
	wheel = PUI.wheel(spinBody, Spin.Prizes, 300)
	wheel.frame.Position = UDim2.fromOffset(10, 10)
	local lines = {}
	for _, p in ipairs(Spin.Prizes) do
		table.insert(lines, ("%s %s  (%d%%)"):format(p.glyph, p.text, p.weight))
	end
	UI.label("PRIZES\n" .. table.concat(lines, "\n"), 15, { Font = Theme.FontBody, Position = UDim2.fromOffset(330, 10), Size = UDim2.fromOffset(250, 190), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Parent = spinBody })
	spinNote = UI.label("", 15, { Font = Theme.FontBody, TextColor3 = C.TextDim, Position = UDim2.fromOffset(330, 205), Size = UDim2.fromOffset(250, 44), Parent = spinBody })
	spinBtn = UI.button("SPIN", C.Accent, function()
		if wheel.busy() or not spinInfo then
			return
		end
		local res = Net.invoke("Spin", spinInfo.freeIn > 0)
		if not res then
			UIController.Toast("Can't spin right now", "error")
			return
		end
		local prize = Spin.Prizes[res.index]
		wheel.spinTo(res.index, function()
			spinInfo = res.info
			refreshSpinUi()
			UIController.Toast("You won " .. prize.text .. "!", "success")
		end)
	end, { Size = UDim2.fromOffset(250, 54), Position = UDim2.fromOffset(330, 255), Parent = spinBody })
end

---------------------------------------------------------------- init
function Progress.Init()
	local _, sb = UIController.MakeWindow("Season", "SEASON PASS", C.Accent)
	seasonBody = sb
	local gw, gb = UIController.MakeWindow("Achievements", "GOALS", C.Primary)
	goalsWin, goalsBody = gw, gb
	local _, pb = UIController.MakeWindow("Spin", "DAILY SPIN", Color3.fromRGB(255, 159, 67))
	spinBody = pb
	spinBody.CanvasSize = UDim2.fromOffset(0, 330)
	spinBody.AutomaticCanvasSize = Enum.AutomaticSize.None

	UIController.AddMenuButton(13, "PASS", C.Accent, "Season")
	UIController.AddMenuButton(14, "GOALS", C.Primary, "Achievements")
	UIController.AddMenuButton(15, "SPIN", Color3.fromRGB(255, 159, 67), "Spin")

	selectTab = W.tabs(gw, gb, { "ACHIEVEMENTS", "TITLES", "STORY" }, function(name)
		goalTab = name
		renderGoals()
	end)
	buildSpin()

	onVisible(panelOf("Season"), function()
		renderSeason(Net.invoke("SeasonInfo"))
	end)
	onVisible(gw, function()
		selectTab(goalTab)
	end)
	onVisible(panelOf("Spin"), function()
		spinInfo = Net.invoke("SpinInfo")
		refreshSpinUi()
	end)

	setTracker = PUI.tracker(UIController.Gui(), function()
		goalTab = "STORY"
		if UIController.IsOpen("Achievements") then
			selectTab("STORY")
		else
			UIController.Open("Achievements")
		end
	end)
	Net.listen("StoryState", function(st)
		storyState = st
		setTracker(st)
		if goalsWin.Visible and goalTab == "STORY" then
			renderGoals()
		end
	end)
	task.spawn(function()
		local st = Net.invoke("StoryInfo")
		if st and not storyState then
			storyState = st
			setTracker(st)
		end
	end)
end

local function panelOfDummy() end
function panelOf(name: string): GuiObject
	return UIController.Gui():WaitForChild(name)
end

return Progress
