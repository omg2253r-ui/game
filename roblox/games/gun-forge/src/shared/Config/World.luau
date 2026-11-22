-- World look + starter layout. World Builder owns this file.
-- Lighting presets give an instant professional look; pick one per game/zone.
local Presets = {
	SunnyCartoon = {
		Lighting = { ClockTime = 14.5, Brightness = 2.6, EnvironmentDiffuseScale = 1, EnvironmentSpecularScale = 1, OutdoorAmbient = Color3.fromRGB(140, 140, 160), ExposureCompensation = 0.1 },
		Atmosphere = { Density = 0.28, Offset = 0.2, Color = Color3.fromRGB(199, 225, 255), Decay = Color3.fromRGB(120, 160, 220), Glare = 0.2, Haze = 1.2 },
		Bloom = { Intensity = 0.6, Size = 30, Threshold = 1.6 },
		ColorCorrection = { Saturation = 0.18, Contrast = 0.08, Brightness = 0.02 },
		SunRays = { Intensity = 0.06, Spread = 0.6 },
	},
	SpookyNight = {
		Lighting = { ClockTime = 0.2, Brightness = 0.6, EnvironmentDiffuseScale = 0.3, OutdoorAmbient = Color3.fromRGB(40, 40, 70), ExposureCompensation = -0.2 },
		Atmosphere = { Density = 0.48, Offset = 0, Color = Color3.fromRGB(60, 70, 90), Decay = Color3.fromRGB(20, 20, 35), Glare = 0, Haze = 2.5 },
		Bloom = { Intensity = 1, Size = 40, Threshold = 1.2 },
		ColorCorrection = { Saturation = -0.25, Contrast = 0.2, TintColor = Color3.fromRGB(200, 210, 255) },
	},
	NeonCity = {
		Lighting = { ClockTime = 20.5, Brightness = 1.2, EnvironmentDiffuseScale = 0.6, OutdoorAmbient = Color3.fromRGB(70, 50, 110) },
		Atmosphere = { Density = 0.35, Offset = 0.1, Color = Color3.fromRGB(120, 80, 190), Decay = Color3.fromRGB(40, 20, 80), Glare = 0.4, Haze = 1.6 },
		Bloom = { Intensity = 1.4, Size = 36, Threshold = 0.9 },
		ColorCorrection = { Saturation = 0.3, Contrast = 0.15 },
	},
	FantasySunset = {
		Lighting = { ClockTime = 17.6, Brightness = 2, OutdoorAmbient = Color3.fromRGB(150, 110, 120) },
		Atmosphere = { Density = 0.3, Offset = 0.25, Color = Color3.fromRGB(255, 190, 160), Decay = Color3.fromRGB(180, 90, 120), Glare = 0.6, Haze = 1.4 },
		Bloom = { Intensity = 0.8, Size = 32, Threshold = 1.3 },
		ColorCorrection = { Saturation = 0.2, Contrast = 0.1, TintColor = Color3.fromRGB(255, 240, 230) },
		SunRays = { Intensity = 0.1, Spread = 0.8 },
	},
}

return {
	Preset = "NeonCity",
	Presets = Presets,

	-- Built only when workspace has no "Map" model (i.e. nobody built one in Studio yet).
	-- Lets a fresh template run as a real little level. Units = studs.
	StarterMap = {
		Enabled = true,
		GroundSize = Vector3.new(400, 4, 400),
		GroundColor = Color3.fromRGB(106, 190, 96),
		GroundMaterial = Enum.Material.Grass,
		-- floating islands / platforms (Position, Size, Color)
		Platforms = {
			{ Vector3.new(60, 12, 0), Vector3.new(30, 3, 30), Color3.fromRGB(120, 200, 255) },
			{ Vector3.new(-50, 18, 40), Vector3.new(24, 3, 24), Color3.fromRGB(255, 170, 90) },
			{ Vector3.new(0, 26, -70), Vector3.new(36, 3, 20), Color3.fromRGB(200, 130, 255) },
		},
		Decorations = 60, -- trees/rocks scattered (uses ReplicatedStorage.Assets models if present)
	},
}
