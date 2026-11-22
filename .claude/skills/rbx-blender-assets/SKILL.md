---
name: rbx-blender-assets
description: Make Roblox 3D models, characters/pets/NPCs/bosses, VFX meshes and render shots with Blender via the scripted tools in roblox/tools/blender (headless, parametric, low-poly, tri-budget checked). Use for any 3D model, character, prop or effect mesh for a Roblox game.
---
# Blender → Roblox assets (scripted, cheap, lag-free)

Run headless: `blender -b -P <script> -- <args>` (or `python <script> <args>` with the `bpy` pip module, Python 3.11).
All scripts: 1 Blender unit = 1 stud, origin bottom-centre, triangulated, tri budget printed.

| Need | Command |
|---|---|
| Props: coin gem crate chest tree pine rock crystal lamp portal platform | `make_asset.py --type crate --color "#c98a4b" --size 4 --out art/blender/crate.fbx` (`--type all --out dir/`) |
| Pet / NPC / enemy / boss (rigged, auto-weights) | `make_character.py --style pet --color "#ff9f43" --accent "#fff1d6" --ears cat --out art/blender/pet.fbx` |
| VFX meshes: slash ring aura beam spike | `make_vfx_mesh.py --type all --out art/blender/vfx/` |
| Hero render (thumbnail/icon/shop image) | `render_shot.py --in a.fbx b.fbx --out art/renders/hero.png --size 1600 1200 --angle 30` (`--engine eevee` on GPU) |

Custom models: write a new builder function in `make_asset.py` using `rbx_lib` helpers (`add_obj`, `material`, `bevel`, `finalize`, `origin_bottom`, `check_budget`, `export_fbx`) — ~20 lines, never hand-edit FBX.

## Budgets (tris) — keep the game lag-free
prop ≤ 1.5k · hero prop ≤ 5k · character ≤ 6k · building ≤ 8k · VFX mesh ≤ 400 · Roblox hard limit 20k/MeshPart.
Reuse one mesh many times (same MeshId = instanced, cheap). Prefer vertex colour / flat materials; textures ≤ 512 px.

## Import to Studio
3D Importer → File Dimensions **Studs** → Anchored for props → `RenderFidelity = Automatic`, `CollisionFidelity = Box` (or Hull for walkable), `CastShadow = false` for small props, `DoubleSided` off.
Characters: import as rig → animate in Animation Editor → publish animations → put ids in config.
Put reusable models in `ReplicatedStorage.Assets` (`Decor/` folder is auto-scattered by WorldService; a MeshPart named `CoinModel` replaces the demo coin).
Record every exported file + uploaded id in `docs/ASSETS.md`.

## VFX recipe (Roblox side)
ParticleEmitter: texture from `rbx-ui-art` (`make_vfx.py`), `LightEmission 1`, `Rate 0` + `:Emit(8-20)` bursts, Lifetime 0.3–0.8, ≤ 30 alive.
Mesh VFX: slash/ring MeshPart, `Material Neon` or texture, tween `Size`/`Transparency` on CLIENT, destroy after 0.5 s. Tag decorative emitters with attribute `Decor=true` so Low Graphics mode disables them.
