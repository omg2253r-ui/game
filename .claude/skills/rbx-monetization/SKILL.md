---
name: rbx-monetization
description: Design Roblox economy, game passes (real Robux), developer products, pricing and retention/live-ops so the game is fun long-term and earns fairly. Use when setting prices, passes, products, currencies, rewards, quests or update plans for a Roblox game.
---
# Economy & monetization (fair, long-lived)

Config files (no code needed): `Config/GamePasses.luau`, `Config/Products.luau`, `Config/Economy.luau`.

## Game passes (one-time, permanent) — pick 3–5
| Archetype | Price R$ | Perk key(s) |
|---|---|---|
| VIP (tag + trail + bonus) | 249–399 | `chatTag`, `trail`, `coinMultiplier` |
| 2x Currency | 149–249 | `coinMultiplier = 2` |
| Speed / Gravity | 79–149 | `walkSpeed`, `jumpPower` |
| Convenience (auto-collect, +slots, auto-hatch) | 149–399 | custom key → `PerkHooks` / genre service reads `GetPerk` |
| Luck (x2 rare odds) | 199–499 | custom `luck` key read by PetService/LootService |
| Exclusive cosmetic (pet, skin, emote) | 99–299 | custom |

## Developer products (consumable) — 2–4
Currency packs (show "BEST VALUE" tag on the mid pack), 30-min boosts, skip-stage, revive, crates. Prices 15–499 R$.

## Fairness rules
- Free players can finish all content; Robux = faster/cosmetic/convenience. No stat advantage in PvP.
- Every pass shows exactly what it does; Studio test-buy works for id = 0.
- Never show odds-based paid crates without listing odds (Roblox policy for paid random items).

## Economy tuning
- First upgrade affordable in < 60 s; each next costs ~1.6–2.2× more; earnings scale ~1.4×.
- Time-to-next-goal ≤ 3 min early, ≤ 15 min mid, rebirth/prestige at ~45–60 min.
- Daily reward escalates over 7 days; day 7 is a big premium payout.
- Playtime rewards at 5/15/30/60 min; quests = 3/day targeting 10–20 min of play.

## Live-ops roadmap (put in PLAN.md Phase 6)
Week 1 bug-fix + balance · Week 2 new zone/world · Week 3 limited-time event (2x weekend, event currency) · Week 4 new pets/items + leaderboard season.
Track: D1/D7 retention, session length, payer %, ARPDAU (Creator Hub analytics + AnalyticsService events).
