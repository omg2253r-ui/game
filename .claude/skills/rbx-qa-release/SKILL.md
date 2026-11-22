---
name: rbx-qa-release
description: QA, exploit/security review, purchase testing and publish/launch checklist for a Roblox game built from the rbx template. Use before calling a Roblox game done or publishing it.
---
# QA & release

1. `roblox/tools/check.sh roblox/games/<slug>` → must PASS (then `--release` before launch).
2. Read only changed/new services (git diff) — template services are already reviewed.

## Functional (Studio, 2-player local server: Test → Clients and Servers)
- [ ] Join: splash, HUD, map, lighting, no red errors in Output (server + client).
- [ ] Core loop gives currency; leaderstats update; quests progress; rewards claim once only.
- [ ] Rejoin keeps data (API Services enabled). Leaving mid-purchase does not lose items.
- [ ] Shop: each pass/product card works (Studio test-buy); perks apply after respawn.
- [ ] Mobile emulator (phone + tablet): all buttons reachable, nothing under Roblox menu/jump button.

## Exploit review (for every Net.on / Net.handle)
- [ ] Arg types checked; numbers clamped; ids looked up in server tables.
- [ ] Distance/cooldown checks for interactions; client never sends amounts/prices.
- [ ] Rate limit set; no remote can grant currency directly.

## Performance → run `rbx-performance` checklist.

## Launch (Creator Hub)
- [ ] Create passes (Monetization → Passes), products (Developer Products); paste ids into configs; upload icons.
- [ ] Badges created (optional) → `Economy.Badges`.
- [ ] Game settings: Thumbnail(s) 1920×1080, icon 512, description (hook + features + update log), genre, devices (PC/mobile/console/tablet), max players.
- [ ] Questionnaire (content maturity) completed; Private servers price (optional).
- [ ] Publish → test in live server with a cheap pass purchase from an alt or friend.
