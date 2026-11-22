---
name: rbx-ui-art
description: Roblox UI/UX, icons, VFX textures, game thumbnail and icon - code-drawn UI via UIKit/Theme, Pillow-generated icons, AI image generation prompts, and the thumbnail compositor. Use for any Roblox UI screen, button, shop, HUD, icon, game cover/thumbnail or store art.
---
# Roblox UI, icons & store art

## In-game UI (code-drawn, no uploads needed)
- Restyle everything from `src/shared/Theme.luau` (palette, fonts, corner, stroke, tweens).
- Build screens with `src/client/UIKit.luau`: `UI.panel`, `UI.button(text, color, onClick)`, `UI.label`, `UI.icon(imageId, glyph, color, size)`, `UI.pop(gui, open)`, `UI.formatNumber`.
- New screen = function in `UIController` using `makeWindow(name, title, accent)` + `row(...)` or a grid; add a side-menu button.
- UX rules: primary action = biggest/greenest; ≤ 2 taps to buy; every number animates; toasts for every reward; buttons ≥ 44 px on mobile; text has outline; nothing important in top-left 60 px (Roblox menu) or bottom-right (mobile jump).
- Game-specific HUD (stage counter, wave bar, hatch animation…) lives in a new Controller.

## Icons & textures (Pillow, free, consistent style)
- `python roblox/tools/art/make_icons.py --out art/icons --sheet` → coin gem vip speed x2 star gift trophy lock heart sword egg (512² PNG). `--only x2 --color "#59e35a"` for variants.
- `python roblox/tools/art/make_vfx.py --out art/vfx` → glow spark ring smoke slash dots explosion_4x4 (white; colour per emitter).

## Thumbnail + icon (professional, policy-safe)
1. Hero image: `render_shot.py` of the game's characters/props (transparent PNG), or an in-game screenshot.
2. Background: AI-generated (use any connected image tool, e.g. Figma/Canva/Gamma `generate_image`) or leave empty → gradient + sun-rays.
3. `python roblox/tools/art/make_thumbnail.py --title "PET KINGDOM" --subtitle "HATCH • COLLECT • EVOLVE" --hero art/renders/hero.png [--bg bg.png] --badge "NEW!" --top "#36c3ff" --bottom "#5b2bd6" --out art/store` → `thumbnail_1920x1080.png` + `icon_512.png`.
4. Look at the result (Read the PNG) and adjust once; don't iterate more than twice.

AI background prompt template:
`"<setting from GDD>, stylized 3D cartoon game environment, vibrant saturated colours, soft volumetric light, depth of field, empty centre-right for a character, no text, no logos, 16:9"`

Policy: no Robux symbol/currency images, no fake buttons/“FREE ROBUX”, no real brands, no misleading content, title readable at 150 px wide.
