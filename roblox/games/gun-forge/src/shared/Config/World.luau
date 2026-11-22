-- World look + starter layout. World Builder owns this file.
-- Lighting presets give an instant professional look; pick one per game/zone.
-- Every preset defines Lighting + Atmosphere + Bloom + ColorCorrection + SunRays + DepthOfField (subtle).
local function C(r, g, b)
	return Color3.fromRGB(r, g, b)
end

local Presets = {
	-- Meadow: bright, soft, fresh
	SunnyCartoon = {
		Lighting = { ClockTime = 14.2, Brightness = 2.8, Ambient = C(110, 120, 140), OutdoorAmbient = C(150, 155, 175), ExposureCompensation = 0.15, EnvironmentDiffuseScale = 1, EnvironmentSpecularScale = 1, ColorShift_Top = C(255, 244, 214), ColorShift_Bottom = C(150, 190, 255) },
		Atmosphere = { Density = 0.25, Offset = 0.25, Color = C(190, 224, 255), Decay = C(130, 175, 235), Glare = 0.15, Haze = 1.0 },
		Bloom = { Intensity = 0.5, Size = 28, Threshold = 1.7 },
		ColorCorrection = { Saturation = 0.22, Contrast = 0.08, Brightness = 0.02, TintColor = C(255, 252, 244) },
		SunRays = { Intensity = 0.08, Spread = 0.7 },
		DepthOfField = { FarIntensity = 0.08, NearIntensity = 0, FocusDistance = 90, InFocusRadius = 90 },
	},
	-- Desert: warm dusty sunset
	DesertDusk = {
		Lighting = { ClockTime = 17.4, Brightness = 2.2, Ambient = C(120, 90, 80), OutdoorAmbient = C(170, 120, 100), ExposureCompensation = 0.1, EnvironmentDiffuseScale = 0.9, EnvironmentSpecularScale = 0.8, ColorShift_Top = C(255, 190, 120), ColorShift_Bottom = C(200, 120, 90) },
		Atmosphere = { Density = 0.38, Offset = 0.3, Color = C(255, 196, 150), Decay = C(210, 110, 80), Glare = 0.7, Haze = 2.0 },
		Bloom = { Intensity = 0.8, Size = 34, Threshold = 1.3 },
		ColorCorrection = { Saturation = 0.18, Contrast = 0.1, Brightness = 0, TintColor = C(255, 232, 205) },
		SunRays = { Intensity = 0.14, Spread = 0.85 },
		DepthOfField = { FarIntensity = 0.1, NearIntensity = 0, FocusDistance = 80, InFocusRadius = 80 },
	},
	-- Frost: cold blue haze
	FrostHaze = {
		Lighting = { ClockTime = 11, Brightness = 2.0, Ambient = C(110, 135, 175), OutdoorAmbient = C(140, 170, 215), ExposureCompensation = 0.2, EnvironmentDiffuseScale = 1, EnvironmentSpecularScale = 1.2, ColorShift_Top = C(200, 230, 255), ColorShift_Bottom = C(120, 160, 230) },
		Atmosphere = { Density = 0.5, Offset = 0.1, Color = C(190, 220, 250), Decay = C(120, 160, 220), Glare = 0.1, Haze = 2.6 },
		Bloom = { Intensity = 0.7, Size = 36, Threshold = 1.4 },
		ColorCorrection = { Saturation = -0.05, Contrast = 0.1, Brightness = 0.03, TintColor = C(220, 238, 255) },
		SunRays = { Intensity = 0.06, Spread = 0.5 },
		DepthOfField = { FarIntensity = 0.12, NearIntensity = 0, FocusDistance = 70, InFocusRadius = 70 },
	},
	-- Magma: dark red glow
	MagmaGlow = {
		Lighting = { ClockTime = 21.5, Brightness = 0.9, Ambient = C(90, 40, 30), OutdoorAmbient = C(120, 50, 35), ExposureCompensation = 0.05, EnvironmentDiffuseScale = 0.5, EnvironmentSpecularScale = 0.7, ColorShift_Top = C(255, 120, 60), ColorShift_Bottom = C(160, 50, 30) },
		Atmosphere = { Density = 0.52, Offset = 0, Color = C(140, 55, 35), Decay = C(70, 20, 15), Glare = 0.3, Haze = 3.0 },
		Bloom = { Intensity = 1.1, Size = 42, Threshold = 1.0 },
		ColorCorrection = { Saturation = 0.15, Contrast = 0.2, Brightness = -0.02, TintColor = C(255, 215, 200) },
		SunRays = { Intensity = 0.04, Spread = 0.6 },
		DepthOfField = { FarIntensity = 0.12, NearIntensity = 0, FocusDistance = 70, InFocusRadius = 65 },
	},
	-- Void: neon purple
	VoidNeon = {
		Lighting = { ClockTime = 23, Brightness = 1.1, Ambient = C(70, 40, 110), OutdoorAmbient = C(95, 60, 150), ExposureCompensation = 0.1, EnvironmentDiffuseScale = 0.6, EnvironmentSpecularScale = 1, ColorShift_Top = C(210, 120, 255), ColorShift_Bottom = C(80, 40, 170) },
		Atmosphere = { Density = 0.42, Offset = 0.1, Color = C(120, 70, 200), Decay = C(45, 20, 100), Glare = 0.5, Haze = 2.2 },
		Bloom = { Intensity = 1.5, Size = 40, Threshold = 0.85 },
		ColorCorrection = { Saturation = 0.35, Contrast = 0.15, Brightness = 0, TintColor = C(240, 220, 255) },
		SunRays = { Intensity = 0.1, Spread = 0.9 },
		DepthOfField = { FarIntensity = 0.1, NearIntensity = 0, FocusDistance = 80, InFocusRadius = 75 },
	},
	-- Hub / arena
	NeonCity = {
		Lighting = { ClockTime = 19.8, Brightness = 1.4, Ambient = C(70, 60, 110), OutdoorAmbient = C(85, 70, 135), ExposureCompensation = 0.1, EnvironmentDiffuseScale = 0.6, EnvironmentSpecularScale = 1, ColorShift_Top = C(160, 200, 255), ColorShift_Bottom = C(120, 60, 200) },
		Atmosphere = { Density = 0.33, Offset = 0.1, Color = C(125, 90, 200), Decay = C(45, 25, 90), Glare = 0.4, Haze = 1.6 },
		Bloom = { Intensity = 1.3, Size = 36, Threshold = 0.95 },
		ColorCorrection = { Saturation = 0.3, Contrast = 0.15, Brightness = 0, TintColor = C(245, 240, 255) },
		SunRays = { Intensity = 0.07, Spread = 0.7 },
		DepthOfField = { FarIntensity = 0.1, NearIntensity = 0, FocusDistance = 90, InFocusRadius = 90 },
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
