-- Redeem codes from Config/Codes.luau (once per player).
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Codes = require(ReplicatedStorage.Shared.Config.Codes)
local Net = require(ReplicatedStorage.Shared.Net)

local CodesService = {}

function CodesService.Init(S)
	Net.handle("Redeem", function(player, code)
		if type(code) ~= "string" or #code > 30 then
			return "Invalid code"
		end
		code = code:upper():gsub("%s", "")
		local def = Codes[code]
		local d = S.DataService.Get(player)
		if not def or not d then
			return "Invalid code"
		end
		if def.expires ~= 0 and os.time() > def.expires then
			return "Code expired"
		end
		if d.codes[code] then
			return "Already redeemed"
		end
		S.DataService.Update(player, function(data)
			data.codes[code] = true
		end)
		S.EconomyService.Grant(player, def.reward, "code")
		return "OK"
	end, 1)
end

return CodesService
