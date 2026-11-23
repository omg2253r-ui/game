-- Sound ids. Defaults use sounds that ship with every Roblox client (rbxasset://) so the game has
-- audio with zero uploads. For a better mix, replace with Creator Store audio ids (rbxassetid://...).
local gun = "rbxasset://sounds/electronicpingshort.wav"
return {
	Guns = {
		pistol = { id = "rbxasset://sounds/snap.mp3", volume = 0.5, pitch = 1.3 },
		smg = { id = "rbxasset://sounds/snap.mp3", volume = 0.35, pitch = 1.7 },
		shotgun = { id = "rbxasset://sounds/collide.wav", volume = 0.7, pitch = 0.8 },
		rifle = { id = "rbxasset://sounds/snap.mp3", volume = 0.5, pitch = 1.0 },
		blaster = { id = gun, volume = 0.4, pitch = 0.9 },
		railgun = { id = gun, volume = 0.6, pitch = 0.5 },
	},
	-- weapon layers (mixed with the shot): mechanical bolt/slide click, magazine out/in, distant tail, switch, charge
	Mech = {
		Bolt = { id = "rbxasset://sounds/clickfast.wav", volume = 0.35, pitch = 0.6 },
		MagOut = { id = "rbxasset://sounds/collide.wav", volume = 0.25, pitch = 2.2 },
		MagIn = { id = "rbxasset://sounds/clickfast.wav", volume = 0.55, pitch = 0.85 },
		Switch = { id = "rbxasset://sounds/button.wav", volume = 0.3, pitch = 1.6 },
		Charge = { id = gun, volume = 0.4, pitch = 0.4 },
	},
	Tail = { id = "rbxasset://sounds/collide.wav", volume = 0.3, pitch = 0.45, delayPer100 = 0.28, minDist = 45 },
	Reload = { id = "rbxasset://sounds/clickfast.wav", volume = 0.6, pitch = 1 },
	Empty = { id = "rbxasset://sounds/clickfast.wav", volume = 0.4, pitch = 1.6 },
	Hit = { id = "rbxasset://sounds/clickfast.wav", volume = 0.25, pitch = 2 },
	Crit = { id = gun, volume = 0.35, pitch = 1.8 },
	Death = { id = "rbxasset://sounds/collide.wav", volume = 0.5, pitch = 1.4 },
	Loot = { id = gun, volume = 0.3, pitch = 2.2 },
	Pulse = { id = gun, volume = 0.6, pitch = 1.2 },
	Slam = { id = "rbxasset://sounds/collide.wav", volume = 1, pitch = 0.5 },
	Ui = { id = "rbxasset://sounds/button.wav", volume = 0.4, pitch = 1 },
	MaxDistance = 140,
}
