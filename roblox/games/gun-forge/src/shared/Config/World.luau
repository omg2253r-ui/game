-- World look + starter layout. World Builder owns this file.
-- Lighting presets give an instant professional look; pick one per game/zone.
-- Every preset defines Lighting + Atmosphere + Bloom + ColorCorrection + SunRays + DepthOfField (subtle).
local function C(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local Presets = {
	-- Meadow: bright, soft, fresh, hazy blue distance
	SunnyCartoon = {
		Lighting = { ClockTime = 14.2, Brightness = 2.9, Ambient = C(112, 124, 146), OutdoorAmbient = C(152, 160, 182), ExposureCompensation = 0.15, EnvironmentDiffuseScale = 1, EnvironmentSpecularScale = 1, ColorShift_Top = C(255, 244, 214), ColorShift_Bottom = C(150, 190, 255) },
		Atmosphere = { Density = 0.3, Offset = 0.25, Color = C(190, 226, 255), Decay = C(120, 172, 238), Glare = 0.2, Haze = 1.4 },
		Bloom = { Intensity = 0.55, Size = 28, Threshold = 1.6 },
		ColorCorrection = { Saturation = 0.25, Contrast = 0.1, Brightness = 0.02, TintColor = C(255, 252, 244) },
		SunRays = { Intensity = 0.1, Spread = 0.75 },
		DepthOfField = { FarIntensity = 0.1, NearIntensity = 0, FocusDistance = 90, InFocusRadius = 90 },
		Water = { WaterColor = C(70, 196, 226), WaterTransparency = 0.72, WaterReflectance = 0.6, WaterWaveSize = 0.25, WaterWaveSpeed = 8 },
		Sky = { StarCount = 0, SunAngularSize = 14 },
	},
	-- Desert: warm dusty sunset, thick golden haze
	DesertDusk = {
		Lighting = { ClockTime = 17.2, Brightness = 2.3, Ambient = C(124, 92, 82), OutdoorAmbient = C(176, 124, 102), ExposureCompensation = 0.1, EnvironmentDiffuseScale = 0.9, EnvironmentSpecularScale = 0.8, ColorShift_Top = C(255, 192, 120), ColorShift_Bottom = C(204, 120, 90) },
		Atmosphere = { Density = 0.42, Offset = 0.3, Color = C(255, 198, 150), Decay = C(214, 108, 78), Glare = 0.85, Haze = 2.4 },
		Bloom = { Intensity = 0.9, Size = 34, Threshold = 1.25 },
		ColorCorrection = { Saturation = 0.2, Contrast = 0.12, Brightness = 0, TintColor = C(255, 230, 200) },
		SunRays = { Intensity = 0.18, Spread = 0.9 },
		DepthOfField = { FarIntensity = 0.12, NearIntensity = 0, FocusDistance = 80, InFocusRadius = 80 },
		Water = { WaterColor = C(90, 150, 150), WaterTransparency = 0.8, WaterReflectance = 0.4, WaterWaveSize = 0.1, WaterWaveSpeed = 4 },
		Sky = { StarCount = 0, SunAngularSize = 22 },
	},
	-- Frost: cold blue haze, glittery
	FrostHaze = {
		Lighting = { ClockTime = 9.5, Brightness = 2.0, Ambient = C(112, 138, 180), OutdoorAmbient = C(140, 172, 220), ExposureCompensation = 0.2, EnvironmentDiffuseScale = 1, EnvironmentSpecularScale = 1.3, ColorShift_Top = C(200, 232, 255), ColorShift_Bottom = C(120, 160, 235) },
		Atmosphere = { Density = 0.55, Offset = 0.1, Color = C(190, 222, 252), Decay = C(120, 160, 224), Glare = 0.15, Haze = 3.0 },
		Bloom = { Intensity = 0.8, Size = 38, Threshold = 1.3 },
		ColorCorrection = { Saturation = -0.02, Contrast = 0.12, Brightness = 0.03, TintColor = C(218, 238, 255) },
		SunRays = { Intensity = 0.07, Spread = 0.55 },
		DepthOfField = { FarIntensity = 0.14, NearIntensity = 0, FocusDistance = 70, InFocusRadius = 70 },
		Water = { WaterColor = C(150, 210, 235), WaterTransparency = 0.6, WaterReflectance = 0.8, WaterWaveSize = 0.05, WaterWaveSpeed = 2 },
		Sky = { StarCount = 1500, SunAngularSize = 8 },
	},
	-- Magma: dark red glow, heavy bloom
	MagmaGlow = {
		Lighting = { ClockTime = 21.5, Brightness = 1.0, Ambient = C(96, 42, 30), OutdoorAmbient = C(126, 52, 36), ExposureCompensation = 0.05, EnvironmentDiffuseScale = 0.5, EnvironmentSpecularScale = 0.7, ColorShift_Top = C(255, 124, 60), ColorShift_Bottom = C(160, 50, 30) },
		Atmosphere = { Density = 0.56, Offset = 0, Color = C(150, 58, 36), Decay = C(72, 20, 14), Glare = 0.35, Haze = 3.4 },
		Bloom = { Intensity = 1.3, Size = 44, Threshold = 0.95 },
		ColorCorrection = { Saturation = 0.18, Contrast = 0.22, Brightness = -0.02, TintColor = C(255, 214, 196) },
		SunRays = { Intensity = 0.05, Spread = 0.6 },
		DepthOfField = { FarIntensity = 0.14, NearIntensity = 0, FocusDistance = 70, InFocusRadius = 65 },
		Water = { WaterColor = C(255, 110, 40), WaterTransparency = 0.3, WaterReflectance = 0.2, WaterWaveSize = 0.3, WaterWaveSpeed = 6 },
		Sky = { StarCount = 400, SunAngularSize = 6 },
	},
	-- Void: neon purple, stars, strong bloom
	VoidNeon = {
		Lighting = { ClockTime = 23, Brightness = 1.2, Ambient = C(74, 42, 118), OutdoorAmbient = C(100, 62, 158), ExposureCompensation = 0.1, EnvironmentDiffuseScale = 0.6, EnvironmentSpecularScale = 1.1, ColorShift_Top = C(214, 124, 255), ColorShift_Bottom = C(80, 40, 172) },
		Atmosphere = { Density = 0.46, Offset = 0.1, Color = C(124, 72, 206), Decay = C(48, 20, 104), Glare = 0.6, Haze = 2.6 },
		Bloom = { Intensity = 1.7, Size = 42, Threshold = 0.8 },
		ColorCorrection = { Saturation = 0.38, Contrast = 0.16, Brightness = 0, TintColor = C(240, 220, 255) },
		SunRays = { Intensity = 0.12, Spread = 0.95 },
		DepthOfField = { FarIntensity = 0.12, NearIntensity = 0, FocusDistance = 80, InFocusRadius = 75 },
		Water = { WaterColor = C(130, 70, 220), WaterTransparency = 0.5, WaterReflectance = 0.9, WaterWaveSize = 0.2, WaterWaveSpeed = 5 },
		Sky = { StarCount = 5000, SunAngularSize = 4, MoonAngularSize = 14 },
	},
	-- Hub / arena: night-city sci-fi plaza
	NeonCity = {
		Lighting = { ClockTime = 19.8, Brightness = 1.5, Ambient = C(72, 62, 114), OutdoorAmbient = C(88, 72, 140), ExposureCompensation = 0.1, EnvironmentDiffuseScale = 0.6, EnvironmentSpecularScale = 1.1, ColorShift_Top = C(160, 200, 255), ColorShift_Bottom = C(120, 60, 200) },
		Atmosphere = { Density = 0.36, Offset = 0.1, Color = C(125, 92, 204), Decay = C(45, 25, 94), Glare = 0.45, Haze = 1.9 },
		Bloom = { Intensity = 1.4, Size = 36, Threshold = 0.9 },
		ColorCorrection = { Saturation = 0.32, Contrast = 0.16, Brightness = 0, TintColor = C(245, 240, 255) },
		SunRays = { Intensity = 0.08, Spread = 0.7 },
		DepthOfField = { FarIntensity = 0.1, NearIntensity = 0, FocusDistance = 90, InFocusRadius = 90 },
		Water = { WaterColor = C(70, 190, 230), WaterTransparency = 0.7, WaterReflectance = 0.7, WaterWaveSize = 0.2, WaterWaveSpeed = 6 },
		Sky = { StarCount = 3000, SunAngularSize = 8, MoonAngularSize = 10 },
	},
	SpookyNight = {
		Lighting = { ClockTime = 0.2, Brightness = 0.6, Ambient = C(30, 30, 55), EnvironmentDiffuseScale = 0.3, OutdoorAmbient = C(40, 40, 70), ExposureCompensation = -0.2, ColorShift_Top = C(120, 140, 200), ColorShift_Bottom = C(30, 30, 60) },
		Atmosphere = { Density = 0.48, Offset = 0, Color = C(60, 70, 90), Decay = C(20, 20, 35), Glare = 0, Haze = 2.5 },
		Bloom = { Intensity = 1, Size = 40, Threshold = 1.2 },
		ColorCorrection = { Saturation = -0.25, Contrast = 0.2, Brightness = 0, TintColor = C(200, 210, 255) },
		SunRays = { Intensity = 0.02, Spread = 0.5 },
		DepthOfField = { FarIntensity = 0.12, NearIntensity = 0, FocusDistance = 70, InFocusRadius = 65 },
	},
	FantasySunset = {
		Lighting = { ClockTime = 17.6, Brightness = 2, Ambient = C(120, 90, 100), OutdoorAmbient = C(150, 110, 120), ExposureCompensation = 0.1, ColorShift_Top = C(255, 200, 150), ColorShift_Bottom = C(170, 100, 140) },
		Atmosphere = { Density = 0.3, Offset = 0.25, Color = C(255, 190, 160), Decay = C(180, 90, 120), Glare = 0.6, Haze = 1.4 },
		Bloom = { Intensity = 0.8, Size = 32, Threshold = 1.3 },
		ColorCorrection = { Saturation = 0.2, Contrast = 0.1, Brightness = 0, TintColor = C(255, 240, 230) },
		SunRays = { Intensity = 0.1, Spread = 0.8 },
		DepthOfField = { FarIntensity = 0.08, NearIntensity = 0, FocusDistance = 90, InFocusRadius = 90 },
	},
}

return {
	Preset = "NeonCity", -- hub look (zones/arena override client-side via ZoneLightingController)
	HubRadius = 80,
	Arena = { Origin = Vector3.new(0, 0, 900), Spacing = 200, Size = 120 }, -- Arena1..3 along X
	Presets = Presets,

	-- Built only when workspace has no "Map" model (i.e. nobody built one in Studio yet).
	-- Lets a fresh template run as a real little level. Units = studs.
	StarterMap = {
		Enabled = false, -- MapService builds the real map
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
