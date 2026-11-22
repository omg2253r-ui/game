---
name: rbx-performance
description: Roblox anti-lag / optimization checklist and fixes (parts, meshes, streaming, scripts, network, VFX, mobile). Use when building maps or reviewing a Roblox game for lag, FPS, memory or network issues.
---
# Roblox performance checklist (target: 60 fps mid phone, < 1.2 GB client memory)

World
- [ ] `Workspace.StreamingEnabled = true` (template default); big static map grouped in `workspace.Map`.
- [ ] All static parts `Anchored`; decor `CanCollide/CanQuery/CanTouch = false`, `CastShadow = false` for small stuff.
- [ ] ≤ ~8k visible parts; union/merge repeated detail into meshes; reuse the same MeshId.
- [ ] MeshPart `CollisionFidelity = Box` unless walkable; `RenderFidelity = Automatic`.
- [ ] Textures ≤ 512 px (1024 only for hero); no 4k decals.
- [ ] Lights: ≤ 8 shadow-casting lights in any area; use Neon + Bloom for glow instead.

Scripts
- [ ] No per-part scripts — CollectionService tags + one handler.
- [ ] No server `while true` loops faster than needed (≥ 0.1 s); Heartbeat loops do O(n) tiny work.
- [ ] Visuals (spinning, bobbing, pets follow, moving platforms) on client.
- [ ] Spawners have hard caps (coins, mobs, drops) and cleanup (`Debris`/`Destroy`).
- [ ] Pool frequently created parts (projectiles, VFX).

Network
- [ ] Remotes carry ids/numbers, not instances/tables per frame; batch updates (≤ 10 Hz).
- [ ] Rate limit every client→server remote (`Net.on(name, fn, perSec)`).

VFX / UI
- [ ] ≤ 30 live particles per effect, bursts via `:Emit`; decor emitters tagged `Decor` (Low Graphics toggle).
- [ ] UI: no per-frame layout changes; `AutomaticCanvasSize`; avoid hundreds of frames (paginate).

Measure: Studio → View → MicroProfiler (Ctrl+F6), Script Performance, Developer Console (F9) Memory/Network; Device Emulator (phone).
