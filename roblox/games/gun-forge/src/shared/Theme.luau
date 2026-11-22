-- UI design tokens. The UI/UX designer changes THIS file to restyle the whole game.
return {
	Font = Enum.Font.FredokaOne,
	FontBody = Enum.Font.GothamBold,
	Colors = {
		Bg = Color3.fromRGB(22, 20, 38),
		Panel = Color3.fromRGB(38, 34, 64),
		PanelLight = Color3.fromRGB(58, 52, 96),
		Stroke = Color3.fromRGB(12, 10, 24),
		Text = Color3.fromRGB(255, 255, 255),
		TextDim = Color3.fromRGB(190, 185, 220),
		Primary = Color3.fromRGB(58, 216, 255), -- neon cyan
		PrimaryDark = Color3.fromRGB(20, 130, 190),
		Accent = Color3.fromRGB(255, 79, 216), -- neon magenta
		AccentDark = Color3.fromRGB(170, 30, 140),
		Danger = Color3.fromRGB(255, 79, 106),
		Robux = Color3.fromRGB(0, 176, 111),
		Energy = Color3.fromRGB(58, 216, 255),
		Forge = Color3.fromRGB(255, 79, 216),
		Gold = Color3.fromRGB(255, 201, 53),
	},
	-- matches Config/Guns.luau Rarities (Common..Mythic)
	Rarity = {
		Color3.fromRGB(200, 200, 208),
		Color3.fromRGB(58, 216, 255),
		Color3.fromRGB(181, 108, 255),
		Color3.fromRGB(255, 201, 53),
		Color3.fromRGB(255, 79, 106),
	},
	Corner = UDim.new(0, 14),
	StrokeThickness = 3,
	Tween = TweenInfo.new(0.18, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
	TweenFast = TweenInfo.new(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
}
