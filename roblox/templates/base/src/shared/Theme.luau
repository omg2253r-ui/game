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
		Primary = Color3.fromRGB(80, 200, 120),
		PrimaryDark = Color3.fromRGB(40, 140, 80),
		Accent = Color3.fromRGB(255, 190, 40),
		AccentDark = Color3.fromRGB(210, 120, 20),
		Danger = Color3.fromRGB(235, 70, 80),
		Robux = Color3.fromRGB(0, 176, 111),
	},
	Corner = UDim.new(0, 14),
	StrokeThickness = 3,
	Tween = TweenInfo.new(0.18, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
	TweenFast = TweenInfo.new(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
}
