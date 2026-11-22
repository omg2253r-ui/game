"""Procedural stylized low-poly props for Roblox.

  blender -b -P make_asset.py -- --type crate --color "#c98a4b" --out out/crate.fbx [--size 4] [--seed 1]
  python make_asset.py --type tree --out out/tree.fbx            (bpy pip module)

Types: coin, gem, crate, chest, tree, pine, rock, crystal, lamp, portal, platform,
       forge, fusion_altar, training_pad, loot_crate, all
Each export prints its triangle count vs budget. Use these as blockout/production props,
or as a base the 3D artist refines by hand.
"""
import argparse
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rbx_lib as R  # noqa: E402


def coin(a):
    c = R.add_obj("cylinder", vertices=16, radius=1.0 * a.size / 2, depth=0.25 * a.size / 2)
    R.bevel(c, 0.06, 1)
    R.assign(c, R.material("Gold", R.hex_color(a.color or "#ffc935"), emission=0.3, metallic=0.8, roughness=0.3))
    rim = R.add_obj("torus", major_radius=0.85 * a.size / 2, minor_radius=0.06 * a.size / 2, major_segments=16, minor_segments=4, location=(0, 0, 0.13 * a.size / 2))
    R.assign(rim, R.material("GoldRim", R.hex_color("#fff1a8"), emission=0.5))
    return [c, rim], "prop"


def gem(a):
    s = a.size / 2
    g = R.add_obj("cone", vertices=6, radius1=0.9 * s, radius2=0.0, depth=1.2 * s, location=(0, 0, -0.6 * s))
    g.rotation_euler = (R.deg(180), 0, 0)
    top = R.add_obj("cone", vertices=6, radius1=0.9 * s, radius2=0.5 * s, depth=0.5 * s, location=(0, 0, 0.25 * s))
    m = R.material("Gem", R.hex_color(a.color or "#b56cff"), emission=0.6, roughness=0.1)
    for o in (g, top):
        R.assign(o, m)
    return [g, top], "prop"


def crate(a):
    s = a.size
    box = R.add_obj("cube", size=s)
    R.bevel(box, 0.06 * s, 1)
    wood = R.material("Wood", R.hex_color(a.color or "#c98a4b"))
    dark = R.material("WoodDark", R.hex_color("#7a4a22"))
    R.assign(box, wood)
    parts = [box]
    for axis in range(3):  # cross planks on each side pair
        for sign in (-1, 1):
            loc = [0, 0, 0]
            loc[axis] = sign * (s / 2 + 0.02 * s)
            plank = R.add_obj("cube", size=1, location=loc)
            dims = [s * 0.9, s * 0.9, s * 0.9]
            dims[axis] = 0.06 * s
            dims[(axis + 1) % 3] = 0.16 * s
            plank.scale = dims
            R.assign(plank, dark)
            parts.append(plank)
    return parts, "prop"


def chest(a):
    s = a.size
    base = R.add_obj("cube", size=1, location=(0, 0, 0.3 * s))
    base.scale = (s, 0.65 * s, 0.6 * s)
    R.bevel(base, 0.04 * s)
    lid = R.add_obj("cylinder", vertices=8, radius=0.325 * s, depth=s, location=(0, 0, 0.6 * s), rotation=(0, R.deg(90), 0))
    lid.scale = (1, 1, 1)
    wood = R.material("ChestWood", R.hex_color(a.color or "#8b4f2a"))
    gold = R.material("ChestGold", R.hex_color("#ffcc33"), metallic=0.9, roughness=0.3, emission=0.15)
    R.assign(base, wood)
    R.assign(lid, wood)
    parts = [base, lid]
    for x in (-0.42, 0.42):
        band = R.add_obj("cube", size=1, location=(x * s, 0, 0.5 * s))
        band.scale = (0.08 * s, 0.68 * s, 0.98 * s)
        R.assign(band, gold)
        parts.append(band)
    lock = R.add_obj("cube", size=0.14 * s, location=(0, -0.34 * s, 0.6 * s))
    R.assign(lock, gold)
    parts.append(lock)
    return parts, "prop"


def tree(a):
    rnd = random.Random(a.seed)
    s = a.size / 4
    trunk = R.add_obj("cylinder", vertices=6, radius=0.35 * s, depth=3 * s, location=(0, 0, 1.5 * s))
    R.assign(trunk, R.material("Bark", R.hex_color("#7b5134")))
    leaf = R.material("Leaf", R.hex_color(a.color or "#58c25a"))
    parts = [trunk]
    for i in range(3):
        b = R.add_obj("ico_sphere", subdivisions=1, radius=(1.5 - i * 0.25) * s,
                      location=(rnd.uniform(-0.4, 0.4) * s, rnd.uniform(-0.4, 0.4) * s, (3.2 + i * 1.0) * s))
        b.scale = (1, 1, 0.85)
        R.assign(b, leaf)
        R.shade_flat(b)
        parts.append(b)
    return parts, "prop"


def pine(a):
    s = a.size / 4
    trunk = R.add_obj("cylinder", vertices=6, radius=0.3 * s, depth=1.5 * s, location=(0, 0, 0.75 * s))
    R.assign(trunk, R.material("Bark", R.hex_color("#6b4128")))
    leaf = R.material("Pine", R.hex_color(a.color or "#2f8f57"))
    parts = [trunk]
    for i in range(3):
        c = R.add_obj("cone", vertices=7, radius1=(1.8 - i * 0.45) * s, depth=2.0 * s, location=(0, 0, (2.0 + i * 1.2) * s))
        R.assign(c, leaf)
        parts.append(c)
    return parts, "prop"


def rock(a):
    rnd = random.Random(a.seed)
    r = R.add_obj("ico_sphere", subdivisions=2, radius=a.size / 2)
    for v in r.data.vertices:
        v.co *= rnd.uniform(0.75, 1.15)
    r.scale = (1, rnd.uniform(0.7, 1.0), rnd.uniform(0.55, 0.8))
    R.assign(r, R.material("Rock", R.hex_color(a.color or "#8a8f98"), roughness=0.9))
    R.shade_flat(r)
    return [r], "prop"


def crystal(a):
    rnd = random.Random(a.seed)
    m = R.material("Crystal", R.hex_color(a.color or "#53e0ff"), emission=1.2, roughness=0.1)
    parts = []
    for i in range(5):
        h = rnd.uniform(1.2, 2.6) * a.size / 3
        c = R.add_obj("cone", vertices=5, radius1=0.35 * a.size / 3, radius2=0.0, depth=h,
                      location=(rnd.uniform(-0.4, 0.4) * a.size / 3, rnd.uniform(-0.4, 0.4) * a.size / 3, h / 2))
        c.rotation_euler = (rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), 0) if i else (0, 0, 0)
        R.assign(c, m)
        parts.append(c)
    return parts, "prop"


def lamp(a):
    s = a.size / 4
    pole = R.add_obj("cylinder", vertices=6, radius=0.12 * s, depth=4 * s, location=(0, 0, 2 * s))
    R.assign(pole, R.material("Iron", R.hex_color("#3a3a46"), metallic=0.7))
    bulb = R.add_obj("ico_sphere", subdivisions=1, radius=0.45 * s, location=(0, 0, 4.2 * s))
    R.assign(bulb, R.material("Glow", R.hex_color(a.color or "#ffd27a"), emission=3.0))
    cap = R.add_obj("cone", vertices=6, radius1=0.6 * s, depth=0.4 * s, location=(0, 0, 4.7 * s))
    R.assign(cap, R.material("Iron", R.hex_color("#3a3a46")))
    return [pole, bulb, cap], "prop"


def portal(a):
    s = a.size / 6
    ring = R.add_obj("torus", major_radius=3 * s, minor_radius=0.4 * s, major_segments=24, minor_segments=6,
                     location=(0, 0, 3.4 * s), rotation=(R.deg(90), 0, 0))
    R.assign(ring, R.material("PortalStone", R.hex_color("#4b4566")))
    inner = R.add_obj("circle", vertices=24, radius=2.7 * s, fill_type="NGON", location=(0, 0, 3.4 * s), rotation=(R.deg(90), 0, 0))
    R.assign(inner, R.material("PortalGlow", R.hex_color(a.color or "#9b5cff"), emission=2.0))
    base = R.add_obj("cube", size=1, location=(0, 0, 0.25 * s))
    base.scale = (4 * s, 1.6 * s, 0.5 * s)
    R.assign(base, R.material("PortalStone", R.hex_color("#4b4566")))
    return [ring, inner, base], "hero_prop"


def platform(a):
    s = a.size
    top = R.add_obj("cylinder", vertices=10, radius=s / 2, depth=0.6, location=(0, 0, 0))
    R.bevel(top, 0.1)
    R.assign(top, R.material("Grass", R.hex_color(a.color or "#6bd26b")))
    under = R.add_obj("cone", vertices=10, radius1=s / 2 * 0.95, depth=s * 0.4, location=(0, 0, -0.3 - s * 0.2))
    under.rotation_euler = (R.deg(180), 0, 0)
    R.assign(under, R.material("Dirt", R.hex_color("#8a5a3b")))
    R.shade_flat(under)
    return [top, under], "prop"


def forge(a):
    """Anvil in front of a glowing furnace with a chimney (Gun Forge hub station)."""
    s = a.size / 6
    stone = R.material("ForgeStone", R.hex_color("#4a4660"))
    iron = R.material("ForgeIron", R.hex_color("#2b2b38"), metallic=0.6, roughness=0.4)
    fire = R.material("ForgeFire", R.hex_color(a.color or "#ff8a2a"), emission=4.0)
    parts = []
    def box(dims, loc, mat, bev=0.05):
        o = R.add_obj("cube", size=1, location=loc)
        o.scale = dims
        bpy.ops.object.transform_apply(scale=True)
        if bev:
            R.bevel(o, bev * s, 1)
        R.assign(o, mat)
        parts.append(o)
        return o
    box((3.2 * s, 2.4 * s, 3.0 * s), (0, 1.2 * s, 1.5 * s), stone, 0.12)          # furnace body
    box((1.8 * s, 0.3 * s, 1.2 * s), (0, -0.0 * s, 1.3 * s), fire, 0.0)            # fire mouth
    box((3.5 * s, 2.7 * s, 0.35 * s), (0, 1.2 * s, 3.1 * s), iron, 0.08)           # cap
    ch = R.add_obj("cylinder", vertices=8, radius=0.5 * s, depth=2.2 * s, location=(0.6 * s, 1.6 * s, 4.4 * s))
    parts.append(R.assign(ch, stone))
    box((1.6 * s, 1.1 * s, 0.7 * s), (-2.6 * s, -1.6 * s, 0.35 * s), stone, 0.08)  # anvil plinth
    box((2.4 * s, 0.8 * s, 0.5 * s), (-2.6 * s, -1.6 * s, 1.0 * s), iron, 0.08)   # anvil top
    box((0.9 * s, 0.7 * s, 0.4 * s), (-2.6 * s, -1.6 * s, 0.75 * s), iron, 0.04)  # waist
    horn = R.add_obj("cone", vertices=6, radius1=0.4 * s, depth=1.0 * s, location=(-1.0 * s, -1.6 * s, 1.0 * s), rotation=(0, R.deg(90), 0))
    parts.append(R.assign(horn, iron))
    return parts, "hero_prop"


def fusion_altar(a):
    """Stepped round altar with floating crystal + 4 rune pillars (hatch/fusion station)."""
    s = a.size / 6
    stone = R.material("AltarStone", R.hex_color("#3d3a58"))
    glow = R.material("AltarGlow", R.hex_color(a.color or "#ff4fd8"), emission=3.0, roughness=0.15)
    gold = R.material("AltarGold", R.hex_color("#ffc935"), metallic=0.8, emission=0.3)
    parts = []
    for i, (r, h) in enumerate(((3.2, 0.5), (2.5, 0.5), (1.6, 0.6))):
        c = R.add_obj("cylinder", vertices=12, radius=r * s, depth=h * s, location=(0, 0, (0.25 + sum(x[1] for x in ((3.2, 0.5), (2.5, 0.5), (1.6, 0.6))[:i])) * s))
        R.bevel(c, 0.06 * s)
        parts.append(R.assign(c, stone))
    ring = R.add_obj("torus", major_radius=2.1 * s, minor_radius=0.08 * s, major_segments=16, minor_segments=4, location=(0, 0, 1.05 * s))
    parts.append(R.assign(ring, glow))
    import math
    for k in range(4):
        ang = k * math.pi / 2 + math.pi / 4
        p = R.add_obj("cylinder", vertices=6, radius=0.28 * s, depth=2.6 * s, location=(math.cos(ang) * 2.7 * s, math.sin(ang) * 2.7 * s, 1.3 * s))
        parts.append(R.assign(p, stone))
        t = R.add_obj("ico_sphere", subdivisions=1, radius=0.3 * s, location=(math.cos(ang) * 2.7 * s, math.sin(ang) * 2.7 * s, 2.8 * s))
        parts.append(R.assign(t, glow))
    top = R.add_obj("cone", vertices=6, radius1=0.7 * s, radius2=0.0, depth=1.2 * s, location=(0, 0, 2.5 * s))
    bot = R.add_obj("cone", vertices=6, radius1=0.7 * s, radius2=0.0, depth=1.0 * s, location=(0, 0, 1.6 * s), rotation=(R.deg(180), 0, 0))
    parts += [R.assign(top, glow), R.assign(bot, glow)]
    return parts, "hero_prop"


def training_pad(a):
    """Flat beveled pad with chevron arrows and glowing rim; stand on it to train."""
    s = a.size / 6
    base = R.add_obj("cylinder", vertices=8, radius=3 * s, depth=0.4 * s, location=(0, 0, 0.2 * s))
    R.bevel(base, 0.08 * s)
    R.assign(base, R.material("PadBase", R.hex_color("#26233f")))
    rim = R.add_obj("torus", major_radius=2.8 * s, minor_radius=0.12 * s, major_segments=24, minor_segments=4, location=(0, 0, 0.42 * s))
    R.assign(rim, R.material("PadRim", R.hex_color(a.color or "#3ad8ff"), emission=3.0))
    parts = [base, rim]
    glow = R.material("PadArrow", R.hex_color("#ffc935"), emission=2.5)
    for k in (-1, 0, 1):
        for sx in (-1, 1):
            b = R.add_obj("cube", size=1, location=(sx * 0.45 * s, k * 0.9 * s - 0.2 * s, 0.43 * s))
            b.scale = (1.3 * s, 0.28 * s, 0.06 * s)
            b.rotation_euler = (0, 0, sx * R.deg(-30))
            parts.append(R.assign(b, glow))
    return parts, "prop"


def loot_crate(a):
    """Sci-fi supply crate: dark metal cube, neon edge strips and a glowing lock plate."""
    s = a.size
    box = R.add_obj("cube", size=s)
    R.bevel(box, 0.08 * s, 1)
    R.assign(box, R.material("LootBody", R.hex_color("#34304f"), metallic=0.4, roughness=0.5))
    neon = R.material("LootNeon", R.hex_color(a.color or "#ffc935"), emission=3.0)
    parts = [box]
    for sx in (-1, 1):
        for sy in (-1, 1):
            bar = R.add_obj("cube", size=1, location=(sx * s / 2, sy * s / 2, 0))
            bar.scale = (0.1 * s, 0.1 * s, 1.02 * s)
            parts.append(R.assign(bar, neon))
    for sz in (-1, 1):
        band = R.add_obj("cube", size=1, location=(0, 0, sz * s * 0.25))
        band.scale = (1.03 * s, 1.03 * s, 0.07 * s)
        parts.append(R.assign(band, neon))
    lock = R.add_obj("cube", size=1, location=(0, -s * 0.52, s * 0.0))
    lock.scale = (0.28 * s, 0.06 * s, 0.28 * s)
    parts.append(R.assign(lock, neon))
    return parts, "prop"


BUILDERS = {f.__name__: f for f in (coin, gem, crate, chest, tree, pine, rock, crystal, lamp, portal, platform,
                                    forge, fusion_altar, training_pad, loot_crate)}


def build_one(kind, a, out_path):
    R.reset_scene()
    objs, budget = BUILDERS[kind](a)
    meshes = R.finalize(objs, join_name=kind.capitalize())
    for m in meshes:
        R.origin_bottom(m)
    R.check_budget(meshes, budget)
    R.export_fbx(out_path, meshes)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--type", required=True, choices=list(BUILDERS) + ["all"])
    p.add_argument("--out", required=True, help="file.fbx, or a folder when --type all")
    p.add_argument("--color", default=None, help="hex main colour, e.g. #ff8800")
    p.add_argument("--size", type=float, default=4.0, help="approx size in studs")
    p.add_argument("--seed", type=int, default=1)
    a = p.parse_args(R.cli_args())
    if a.type == "all":
        for k in BUILDERS:
            build_one(k, a, os.path.join(a.out, f"{k}.fbx"))
    else:
        build_one(a.type, a, a.out)


if __name__ == "__main__":
    main()
