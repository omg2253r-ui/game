-- AFK training tuning (rbx-economy). Gain/s = (Base + sqrt(Power) * SqrtFactor) * multipliers
return {
	Base = 2,
	SqrtFactor = 0.1,
	TickSeconds = 1,
	RebirthMultiplier = 1.5, -- per rebirth (multiplicative)
	-- x2 Pulse: active-play reward
	Pulse = { MinGap = 45, MaxGap = 75, ShowSeconds = 6, BoostSeconds = 30, Multiplier = 2, FirstAt = 10 },
	ProductBoost = { Multiplier = 3, Seconds = 1800 },
	Offline = { MaxHours = 4, Rate = 0.25, MinMinutes = 5 },
	-- training pads: players must be on a pad OR anywhere in the hub when AutoTrainAnywhere
	AutoTrainAnywhere = true,
}
