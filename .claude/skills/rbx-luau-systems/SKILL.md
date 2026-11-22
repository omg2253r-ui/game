---
name: rbx-luau-systems
description: Engineering conventions and recipes for the Roblox Luau template (Rojo layout, services, Net remotes, DataService, monetization hooks, adding genre systems). Use when writing or reviewing server/client Luau for an rbx game.
---
# Luau systems (template conventions)

Layout (Rojo): `src/server/Services/*.luau` (server modules, `Init(services)`), `src/server/Main.server.luau` (order list),
`src/client/Controllers/*.luau` + `UIKit.luau`, `src/shared/Config/*.luau` (all tunables), `src/shared/{Net,Signal,Theme}.luau`.

## Add a genre service (pattern)
```lua
-- src/server/Services/StageService.luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Net = require(ReplicatedStorage.Shared.Net)
local StageService = {}
function StageService.Init(services)
	local Data, Econ, Quest = services.DataService, services.EconomyService, services.QuestService
	Net.declare("StageChanged")
	-- server validates EVERYTHING; client only requests
end
return StageService
```
Then add `"StageService"` to the order list in `Main.server.luau` (after RewardService). New save fields → add to `Config/DataTemplate.luau` (auto-reconciled).

## API cheatsheet
- Data: `DataService.Get(p)`, `WaitFor(p)`, `Update(p, fn)` (marks dirty, autosaves), `Loaded`/`Changed` signals.
- Money: `EconomyService.Add(p, "Coins", n, source, applyMultiplier)`, `Spend(p, cur, n) -> bool`, `Grant(p, {Coins=..})`, `Toast(p, text, kind)`, `Sync(p)`.
- Passes: `MonetizationService.HasPass(p, "VIP")`, `GetMultiplier(p, "coinMultiplier")`, `GetPerk(p, key)`, `PerkHooks.Key = function(p, char) end`, `ProductHandlers.Key = function(p) return true end`, `PassGranted` signal.
- Quests: `QuestService.Progress(p, "Stat", n)`; add quests in `Config/Economy.luau QuestPool`.
- Net: server `Net.on(name, fn, perSec)`, `Net.handle(name, fn)`, `Net.fire(p, name, ...)`, `Net.fireAll`; client `Net.send`, `Net.listen`, `Net.invoke`.
- Analytics: `AnalyticsService.Event/Funnel/Economy/Badge`.
- World: `WorldService.ApplyPreset(name)`.

## Rules
- Server-authoritative: never trust client numbers; validate type, range, distance (`(hrp.Position - target.Position).Magnitude < 15`), cooldown.
- Use `task.*`, never `wait/spawn/delay`. All DataStore/Marketplace/Badge calls in `pcall`.
- Visual-only work on client (tweens, VFX, spinning, pets following). Server sends events, not per-frame updates.
- CollectionService tags for many similar parts (kill bricks, buttons) — one handler, not one script per part.
- No `Instance.new(class, parent)`; set Parent last. No free models/scripts.
- Run `roblox/tools/check.sh <game>` after each change set; fix errors before handing off.
