"""Procedural stylized low-poly props for Roblox.

  blender -b -P make_asset.py -- --type crate --color "#c98a4b" --out out/crate.fbx [--size 4] [--seed 1]
  python make_asset.py --type tree --out out/tree.fbx            (bpy pip module)

Types: coin, gem, crate, chest, tree, pine, rock, crystal, lamp, portal, platform,
       forge, fusion_altar, training_pad, loot_crate, all (original set)
Zone scenery (--type zones -> <out>/<zone>/<name>.fbx): mushroom flower_cluster bush cactus scrap_pile oil_barrel
  ice_crystal_cluster snow_pine frozen_rock lava_rock forge_pipe ember_brazier neon_pillar floating_shard void_obelisk
Gameplay (--type gameplay): training_dummy stage_gate_arch return_portal_pad raid_spawn_pad raid_cover_block
  loot_chest_raid season_pass_trophy
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


# ---------------------------------------------------------------- zone scenery + gameplay props
import math  # noqa: E402


class P:
    """Tiny part helper: every dimension is multiplied by k (= size/4) so --size scales a prop."""

    def __init__(self, a):
        self.k = a.size / 4
        self.parts = []
        self.a = a

    def m(self, name, hexc, em=0.0, **kw):
        return R.material(name, R.hex_color(hexc), emission=em, **kw)

    def box(self, d, loc, mat, rot=(0, 0, 0), bev=0.0):
        k = self.k
        o = R.add_obj("cube", size=1, location=tuple(v * k for v in loc))
        o.scale = tuple(v * k for v in d)
        bpy.ops.object.transform_apply(scale=True)
        o.rotation_euler = tuple(R.deg(r) for r in rot)
        if bev:
            R.bevel(o, bev * k, 1)
        self.parts.append(R.assign(o, mat))
        return o

    def cyl(self, r, h, loc, mat, v=8, rot=(0, 0, 0), r2=None):
        k = self.k
        if r2 is None:
            o = R.add_obj("cylinder", vertices=v, radius=r * k, depth=h * k, location=tuple(x * k for x in loc))
        else:
            o = R.add_obj("cone", vertices=v, radius1=r * k, radius2=r2 * k, depth=h * k, location=tuple(x * k for x in loc))
        o.rotation_euler = tuple(R.deg(x) for x in rot)
        self.parts.append(R.assign(o, mat))
        return o

    def cone(self, r, h, loc, mat, v=6, rot=(0, 0, 0)):
        return self.cyl(r, h, loc, mat, v=v, rot=rot, r2=0.0)

    def ico(self, r, loc, mat, sc=(1, 1, 1), sub=1):
        k = self.k
        o = R.add_obj("ico_sphere", subdivisions=sub, radius=r * k, location=tuple(x * k for x in loc))
        o.scale = sc
        self.parts.append(R.assign(o, mat))
        R.shade_flat(o)
        return o

    def torus(self, R1, r, loc, mat, rot=(0, 0, 0), seg=16, mseg=4):
        k = self.k
        o = R.add_obj("torus", major_radius=R1 * k, minor_radius=r * k, major_segments=seg, minor_segments=mseg,
                      location=tuple(x * k for x in loc))
        o.rotation_euler = tuple(R.deg(x) for x in rot)
        self.parts.append(R.assign(o, mat))
        return o


# ---- meadow
def mushroom(a):
    p = P(a)
    p.cyl(0.35, 1.2, (0, 0, 0.6), p.m("Stem", "#f3e8d0"), v=8)
    cap = p.ico(1.1, (0, 0, 1.3), p.m("CapRed", "#e8403f"), sc=(1, 1, 0.65), sub=2)
    dot = p.m("CapDot", "#fff6e0")
    for x, y in ((0.55, 0.3), (-0.4, 0.55), (-0.2, -0.65), (0.5, -0.4)):
        p.ico(0.16, (x, y, 1.62 - 0.35 * (x * x + y * y)), dot, sub=1)
    return p.parts, "zone_prop"


def flower_cluster(a):
    p = P(a)
    stem = p.m("Stem", "#3fa24a")
    cols = ["#ff6fb5", "#ffd23f", "#8f7bff"]
    for i, (x, y, h) in enumerate(((0, 0, 1.6), (0.7, 0.4, 1.2), (-0.6, 0.5, 1.0), (0.1, -0.7, 1.4))):
        p.cyl(0.07, h, (x, y, h / 2), stem, v=5)
        c = p.m(f"Petal{i % 3}", cols[i % 3])
        for j in range(5):
            ang = j * 2 * math.pi / 5
            p.ico(0.17, (x + 0.24 * math.cos(ang), y + 0.24 * math.sin(ang), h + 0.02), c, sub=1)
        p.ico(0.16, (x, y, h + 0.05), p.m("Center", "#ffb020", 0.3), sub=1)
    p.cone(0.5, 0.25, (0.2, 0.0, 0.12), stem, v=6)
    return p.parts, "zone_prop"


def bush(a):
    p = P(a)
    g = [p.m("BushA", "#4fbf5a"), p.m("BushB", "#3aa34c")]
    for i, (x, y, z, r) in enumerate(((0, 0, 0.8, 1.0), (0.9, 0.2, 0.6, 0.75), (-0.8, -0.2, 0.6, 0.8), (0.1, 0.8, 0.55, 0.65))):
        p.ico(r, (x, y, z), g[i % 2], sc=(1, 1, 0.85), sub=2)
    berry = p.m("Berry", "#ff4f6a", 0.3)
    for x, y, z in ((0.5, -0.7, 1.0), (-0.5, 0.6, 1.35), (0.9, 0.7, 0.9)):
        p.ico(0.12, (x, y, z), berry, sub=1)
    return p.parts, "zone_prop"


# ---- desert
def cactus(a):
    p = P(a)
    g = p.m("Cactus", "#4aa35a")
    p.cyl(0.4, 2.8, (0, 0, 1.4), g, v=8)
    p.ico(0.4, (0, 0, 2.8), g, sub=1)
    for s in (-1, 1):
        h = 0.8 + 0.3 * (s > 0)
        z0 = 1.0 + 0.4 * (s > 0)
        p.cyl(0.22, 0.7, (s * 0.65, 0, z0), g, v=6, rot=(0, 90, 0))
        p.cyl(0.22, h, (s * 0.9, 0, z0 + h / 2), g, v=6)
        p.ico(0.22, (s * 0.9, 0, z0 + h), g, sub=1)
    p.ico(0.12, (0, 0.0, 3.25), p.m("Bloom", "#ff6fb5", 0.3), sub=1)
    return p.parts, "zone_prop"


def scrap_pile(a):
    p = P(a)
    rust, iron, dark = p.m("Rust", "#b5683a"), p.m("ScrapIron", "#7d8594", metallic=0.6), p.m("ScrapDark", "#3a3a46")
    p.box((2.4, 1.6, 0.5), (0, 0, 0.25), dark, bev=0.05)
    p.box((1.6, 1.2, 0.6), (-0.2, 0.1, 0.8), rust, rot=(0, 0, 20), bev=0.05)
    p.box((1.8, 0.2, 1.0), (0.5, -0.4, 1.0), iron, rot=(0, 25, -10), bev=0.03)
    p.cyl(0.45, 0.35, (-0.8, -0.5, 0.65), iron, v=8, rot=(90, 0, 0))   # gear/wheel
    p.cyl(0.18, 0.4, (-0.8, -0.5, 0.65), dark, v=6, rot=(90, 0, 0))
    p.cyl(0.12, 1.6, (0.3, 0.5, 1.2), iron, v=6, rot=(60, 0, 30))      # pipe
    p.box((0.7, 0.7, 0.5), (0.9, 0.3, 0.6), rust, rot=(0, 0, 40), bev=0.04)
    p.box((0.5, 0.5, 0.4), (-0.3, 0.2, 1.3), p.m("ScrapLight", "#ffb347", 1.5), rot=(0, 0, 15))
    return p.parts, "zone_prop"


def oil_barrel(a):
    p = P(a)
    body = p.m("BarrelBody", "#c4503a", roughness=0.5)
    p.cyl(0.75, 1.8, (0, 0, 0.9), body, v=12)
    band = p.m("BarrelBand", "#3a3a46", metallic=0.6)
    for z in (0.45, 1.35):
        p.cyl(0.79, 0.14, (0, 0, z), band, v=12)
    p.cyl(0.6, 0.1, (0, 0, 1.85), band, v=12)
    p.cyl(0.18, 0.12, (0.25, 0.15, 1.93), p.m("Cap", "#ffc935", 0.5), v=8)
    p.box((0.6, 0.04, 0.5), (0, -0.76, 0.9), p.m("Hazard", "#ffc935", 0.6))
    return p.parts, "zone_prop"


# ---- frost
def ice_crystal_cluster(a):
    p = P(a)
    ice = p.m("Ice", "#9fe6ff", 1.0, roughness=0.1)
    ice2 = p.m("IceDeep", "#5bb8ff", 1.2, roughness=0.1)
    spec = ((0, 0, 3.0, 0.5, (0, 0)), (0.7, 0.3, 2.0, 0.38, (12, 15)), (-0.7, 0.1, 1.7, 0.36, (-14, 8)),
            (0.2, -0.7, 1.4, 0.32, (6, -18)), (-0.3, 0.7, 1.2, 0.3, (-8, -12)))
    for i, (x, y, h, r, (rx, ry)) in enumerate(spec):
        p.cyl(r, h, (x, y, h / 2), ice if i % 2 == 0 else ice2, v=6, rot=(rx, ry, 0), r2=0.0)
    p.cyl(1.1, 0.25, (0, 0, 0.12), p.m("Snow", "#f2fbff"), v=8)
    return p.parts, "zone_prop"


def snow_pine(a):
    p = P(a)
    p.cyl(0.3, 1.2, (0, 0, 0.6), p.m("Bark", "#6b4128"), v=6)
    leaf, snow = p.m("FrostPine", "#2f7f6a"), p.m("SnowCap", "#f4fbff")
    for i in range(4):
        r = 1.6 - i * 0.35
        z = 1.5 + i * 1.0
        p.cyl(r, 1.4, (0, 0, z), leaf, v=7, r2=0.0)
        p.cyl(r * 0.62, 0.5, (0, 0, z + 0.45), snow, v=7, r2=0.0)
    p.ico(0.25, (0, 0, 5.4), snow, sub=1)
    p.cyl(0.9, 0.2, (0, 0, 0.1), snow, v=8)
    return p.parts, "zone_prop"


def frozen_rock(a):
    p = P(a)
    rock = p.m("FrostRock", "#8aa2b8", roughness=0.8)
    ice = p.m("RockIce", "#bdf0ff", 0.7, roughness=0.1)
    rnd = random.Random(a.seed)
    r = R.add_obj("ico_sphere", subdivisions=2, radius=1.3 * p.k)
    for v in r.data.vertices:
        v.co *= rnd.uniform(0.8, 1.15)
    r.scale = (1.1, 0.9, 0.75)
    r.location = (0, 0, 0.8 * p.k)
    p.parts.append(R.assign(r, rock))
    R.shade_flat(r)
    p.ico(0.8, (0.2, 0, 1.45), p.m("Snow", "#f4fbff"), sc=(1, 0.9, 0.35), sub=1)
    for x, y, h, rx in ((0.9, 0.5, 1.2, 20), (-0.7, 0.6, 0.9, -15), (0.3, -0.9, 0.8, 10)):
        p.cone(0.22, h, (x, y, 1.0 + h / 2 - 0.1), ice, v=5, rot=(rx, 0, 0))
    return p.parts, "zone_prop"


# ---- magma
def lava_rock(a):
    p = P(a)
    rock = p.m("Basalt", "#33282e", roughness=0.9)
    lava = p.m("Lava", "#ff6a1a", 4.0)
    rnd = random.Random(a.seed)
    r = R.add_obj("ico_sphere", subdivisions=2, radius=1.2 * p.k)
    for v in r.data.vertices:
        v.co *= rnd.uniform(0.8, 1.15)
    r.scale = (1.1, 0.95, 0.85)
    r.location = (0, 0, 0.9 * p.k)
    p.parts.append(R.assign(r, rock))
    R.shade_flat(r)
    p.box((1.6, 0.14, 0.12), (0.1, -1.05, 1.0), lava, rot=(0, 0, 0))
    p.box((0.14, 0.14, 1.1), (0.6, -1.0, 0.9), lava)
    p.box((1.0, 0.12, 0.12), (0.0, 0.0, 1.95), lava, rot=(0, 0, 30))
    p.ico(0.35, (-0.5, -0.9, 0.5), lava, sub=1)
    return p.parts, "zone_prop"


def forge_pipe(a):
    p = P(a)
    iron = p.m("PipeIron", "#4a4a5a", metallic=0.6, roughness=0.45)
    dark = p.m("PipeDark", "#2b2b38", metallic=0.5)
    glow = p.m("PipeGlow", "#ff8a2a", 3.0)
    p.box((1.6, 1.6, 0.3), (0, 0, 0.15), dark, bev=0.05)
    p.cyl(0.4, 3.0, (0, 0, 1.8), iron, v=10)
    for z in (0.9, 2.2):
        p.cyl(0.52, 0.25, (0, 0, z), dark, v=10)
    p.cyl(0.4, 1.4, (0.7, 0, 3.2), iron, v=10, rot=(0, 90, 0))     # elbow arm
    p.cyl(0.4, 1.0, (1.4, 0, 2.7), iron, v=10)
    p.cyl(0.42, 0.18, (1.4, 0, 2.15), glow, v=10)                 # glowing nozzle
    p.cyl(0.55, 0.2, (0.0, 0, 3.4), dark, v=10)
    p.torus(0.42, 0.06, (0, 0, 1.55), glow, seg=12)
    return p.parts, "zone_prop"


def ember_brazier(a):
    p = P(a)
    iron = p.m("BrazierIron", "#2b2b38", metallic=0.6)
    fire = p.m("Ember", "#ff8a2a", 4.0)
    core = p.m("EmberCore", "#ffd27a", 5.0)
    for k in range(3):
        ang = k * 2 * math.pi / 3
        p.cyl(0.1, 1.5, (0.5 * math.cos(ang), 0.5 * math.sin(ang), 0.7), iron, v=5,
              rot=(-12 * math.sin(ang), 12 * math.cos(ang), 0))
    p.cyl(0.95, 0.5, (0, 0, 1.5), iron, v=10, r2=0.65)          # bowl (wide top)
    p.torus(0.97, 0.08, (0, 0, 1.78), iron, seg=12)
    p.cyl(0.78, 0.12, (0, 0, 1.7), fire, v=10)
    p.cone(0.4, 1.1, (0, 0, 2.3), fire, v=6)
    p.cone(0.25, 0.8, (0.25, 0.1, 2.2), core, v=5)
    p.cone(0.22, 0.7, (-0.3, -0.15, 2.1), core, v=5)
    return p.parts, "zone_prop"


# ---- void
def neon_pillar(a):
    p = P(a)
    dark = p.m("VoidDark", "#1c1233", metallic=0.5, roughness=0.4)
    neon = p.m("VoidNeon", "#c04dff", 4.0)
    p.cyl(0.9, 0.4, (0, 0, 0.2), dark, v=8)
    p.cyl(0.5, 4.2, (0, 0, 2.5), dark, v=6)
    for z in (1.0, 2.2, 3.4):
        p.cyl(0.55, 0.1, (0, 0, z), neon, v=6)
    for s in (-1, 1):
        p.box((0.06, 0.06, 3.6), (s * 0.48, 0, 2.5), neon)
    p.cyl(0.7, 0.3, (0, 0, 4.75), dark, v=6)
    p.ico(0.3, (0, 0, 5.3), neon, sub=1)
    return p.parts, "zone_prop"


def floating_shard(a):
    p = P(a)
    neon = p.m("ShardGlow", "#4dd8ff", 3.0, roughness=0.1)
    dark = p.m("ShardDark", "#2a1a55", 0.4)
    # origin = bottom; shard hovers 0.6 above ground
    p.cyl(0.9, 2.0, (0, 0, 2.2), dark, v=5, r2=0.0, rot=(0, 0, 0))
    p.cyl(0.9, 1.4, (0, 0, 1.2), dark, v=5, r2=0.0, rot=(180, 0, 0))
    p.cyl(0.55, 1.4, (0.1, 0.0, 2.05), neon, v=5, r2=0.0)
    p.cyl(0.55, 1.0, (0.1, 0.0, 1.35), neon, v=5, r2=0.0, rot=(180, 0, 0))
    for x, y, z, r in ((1.0, 0.6, 1.2, 0.2), (-0.9, -0.5, 2.0, 0.16), (0.6, -0.9, 2.6, 0.13)):
        p.cyl(r, r * 3, (x, y, z), neon, v=4, r2=0.0)
    return p.parts, "zone_prop"


def void_obelisk(a):
    p = P(a)
    dark = p.m("ObeliskDark", "#17102b", metallic=0.5, roughness=0.35)
    neon = p.m("ObeliskNeon", "#ff4fd8", 4.0)
    p.box((2.2, 2.2, 0.35), (0, 0, 0.18), dark, bev=0.06)
    p.box((1.6, 1.6, 0.35), (0, 0, 0.52), dark, bev=0.06)
    p.cyl(0.95, 4.6, (0, 0, 3.1), dark, v=4, r2=0.55, rot=(0, 0, 45))
    p.cyl(0.55, 0.9, (0, 0, 5.85), dark, v=4, r2=0.0, rot=(0, 0, 45))
    for s in range(4):
        ang = s * math.pi / 2
        p.box((0.1, 0.1, 3.2), (0.66 * math.cos(ang) * 1.0, 0.66 * math.sin(ang), 3.0), neon, rot=(0, 0, 0))
    p.ico(0.3, (0, 0, 6.6), neon, sub=1)
    p.torus(0.8, 0.06, (0, 0, 6.6), neon, rot=(70, 0, 0), seg=16)
    return p.parts, "zone_prop"


# ---- gameplay props
def training_dummy(a):
    p = P(a)
    wood, rope = p.m("DummyWood", "#a9743f"), p.m("DummyPost", "#6b4128")
    p.cyl(1.2, 0.3, (0, 0, 0.15), p.m("DummyBase", "#4a4660"), v=8)
    p.cyl(0.2, 3.0, (0, 0, 1.7), rope, v=6)
    p.cyl(1.0, 0.25, (0, -0.2, 3.3), wood, v=14, rot=(90, 0, 0))   # target board facing -Y
    for r, c in ((0.85, "#f4f1e8"), (0.6, "#e8403f"), (0.35, "#f4f1e8"), (0.15, "#e8403f")):
        p.cyl(r, 0.06, (0, -0.36, 3.3), p.m(f"Ring{c}", c), v=14, rot=(90, 0, 0))
        p.parts[-1].location.y -= 0.01 * p.k * (1 - r)
    p.box((0.6, 0.3, 0.2), (0, 0, 0.5), rope, rot=(0, 0, 0))
    p.cyl(0.18, 0.18, (0.85, 0.2, 3.9), p.m("Flag", "#ffc935", 1.0), v=6)
    return p.parts, "prop"


def stage_gate_arch(a):
    p = P(a)
    stone = p.m("GateStone", "#4b4566")
    trim = p.m("GateTrim", "#ffc935", 0.5, metallic=0.7)
    glow = p.m("GateGlow", a.color or "#3ad8ff", 3.0)
    for s in (-1, 1):
        p.box((1.2, 1.4, 6.0), (s * 3.6, 0, 3.0), stone, bev=0.1)
        p.box((1.5, 1.7, 0.5), (s * 3.6, 0, 0.25), stone, bev=0.08)
        p.box((0.2, 0.2, 5.0), (s * 2.95, -0.72, 3.0), glow)
        p.box((1.4, 1.6, 0.2), (s * 3.6, 0, 6.05), trim)
    p.box((9.4, 1.4, 1.2), (0, 0, 6.6), stone, bev=0.1)
    p.box((7.0, 0.2, 0.5), (0, -0.75, 6.6), glow)
    p.box((2.0, 1.0, 0.9), (0, 0, 7.55), trim, bev=0.06)
    p.cone(0.5, 0.9, (0, 0, 8.4), glow, v=4)
    return p.parts, "prop"


def return_portal_pad(a):
    p = P(a)
    base, glow, gold = p.m("RPBase", "#26233f"), p.m("RPGlow", a.color or "#7affb2", 3.0), p.m("RPGold", "#ffc935", 1.0)
    p.cyl(3.0, 0.4, (0, 0, 0.2), base, v=12)
    p.torus(2.8, 0.14, (0, 0, 0.45), glow, seg=24)
    p.cyl(2.2, 0.06, (0, 0, 0.43), glow, v=16)
    p.cyl(1.8, 0.08, (0, 0, 0.46), base, v=16)
    for k in range(3):                      # up/return chevrons (home arrow)
        p.box((1.6, 0.3, 0.06), (0, -0.2 + k * 0.0, 0.52), gold, rot=(0, 0, 0)) if False else None
    p.cone(0.9, 1.0, (0, 0, 1.0), gold, v=3, rot=(0, 0, 0))   # arrow pointing up (3-sided cone)
    p.box((0.5, 0.5, 0.7), (0, 0, 0.45), gold)
    for k in range(6):
        ang = k * math.pi / 3
        p.box((0.2, 0.2, 1.5 + 0.5 * (k % 2)), (2.5 * math.cos(ang), 2.5 * math.sin(ang), 1.0), glow, rot=(0, 0, 0))
    return p.parts, "prop"


def raid_spawn_pad(a):
    p = P(a)
    base, red, hot = p.m("RSBase", "#1f1f2b", metallic=0.5), p.m("RSRed", "#ff4f6a", 3.0), p.m("RSHot", "#ffc935", 2.5)
    p.cyl(3.2, 0.5, (0, 0, 0.25), base, v=8)
    p.cyl(2.7, 0.1, (0, 0, 0.55), p.m("RSPlate", "#34304f", metallic=0.4), v=8)
    p.torus(3.0, 0.14, (0, 0, 0.55), red, seg=24)
    for k in range(4):                      # corner hazard blocks
        ang = k * math.pi / 2 + math.pi / 4
        p.box((0.9, 0.5, 0.35), (2.9 * math.cos(ang), 2.9 * math.sin(ang), 0.55), hot, rot=(0, 0, math.degrees(ang) + 90))
    for rot in (45, -45):                   # big X
        p.box((4.2, 0.45, 0.06), (0, 0, 0.62), red, rot=(0, 0, rot))
    p.cyl(0.55, 0.2, (0, 0, 0.7), hot, v=8)
    return p.parts, "prop"


def raid_cover_block(a):
    p = P(a)
    body, trim = p.m("CoverBody", "#3a3f58", metallic=0.5, roughness=0.5), p.m("CoverNeon", a.color or "#3ad8ff", 3.0)
    dark = p.m("CoverDark", "#1f1f2b", metallic=0.5)
    p.box((4.0, 1.2, 2.6), (0, 0, 1.4), body, bev=0.1)
    p.box((4.4, 1.5, 0.3), (0, 0, 0.15), dark, bev=0.06)
    p.box((4.4, 1.5, 0.25), (0, 0, 2.8), dark, bev=0.06)
    for x in (-1.6, 1.6):
        p.box((0.2, 1.25, 2.4), (x, 0, 1.4), dark, bev=0.04)
    p.box((2.4, 0.08, 0.14), (0, -0.62, 1.9), trim)
    p.box((2.4, 0.08, 0.14), (0, -0.62, 1.1), trim)
    p.box((0.8, 0.08, 0.8), (0, 0.62, 1.4), trim, rot=(0, 45, 0))
    return p.parts, "prop"


def loot_chest_raid(a):
    p = P(a)
    wood = p.m("RChestWood", "#5a2f66")
    gold = p.m("RChestGold", "#ffcc33", 0.4, metallic=0.9, roughness=0.3)
    glow = p.m("RChestGlow", a.color or "#ffe27a", 3.5)
    p.box((3.0, 2.0, 1.5), (0, 0, 0.9), wood, bev=0.08)
    lid = R.add_obj("cylinder", vertices=10, radius=1.0 * p.k, depth=3.0 * p.k, location=(0, 0, 1.65 * p.k))
    lid.rotation_euler = (0, R.deg(90), 0)
    lid.scale = (0.85, 1.0, 1.0)
    p.parts.append(R.assign(lid, wood))
    for x in (-1.2, 0, 1.2):
        p.box((0.22, 2.1, 1.55), (x, 0, 0.9), gold, bev=0.03)
        p.cyl(1.02, 0.22, (x, 0, 1.65), gold, v=10, rot=(0, 90, 0))
    p.box((3.1, 2.1, 0.2), (0, 0, 0.2), gold)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((0.35, 0.35, 0.5), (sx * 1.4, sy * 0.9, 0.25), gold, bev=0.03)
    p.box((0.5, 0.2, 0.55), (0, -1.05, 1.45), glow, bev=0.0)
    p.ico(0.3, (0, 0, 2.9), glow, sub=1)
    p.cone(0.35, 0.6, (0, 0, 2.5), glow, v=4, rot=(180, 0, 0))
    p.torus(0.6, 0.05, (0, 0, 2.55), glow, rot=(75, 0, 0), seg=14)
    return p.parts, "prop"


def season_pass_trophy(a):
    p = P(a)
    gold = p.m("TrophyGold", "#ffc935", 0.5, metallic=0.9, roughness=0.25)
    base = p.m("TrophyBase", "#34304f", metallic=0.4)
    glow = p.m("TrophyGlow", a.color or "#ff4fd8", 3.0)
    p.box((2.0, 2.0, 0.4), (0, 0, 0.2), base, bev=0.06)
    p.box((1.4, 1.4, 0.4), (0, 0, 0.6), base, bev=0.06)
    p.box((1.45, 0.06, 0.2), (0, -0.7, 0.6), glow)
    p.cyl(0.25, 0.9, (0, 0, 1.3), gold, v=8)
    p.cyl(0.9, 1.5, (0, 0, 2.5), gold, v=12, r2=0.5) if False else None
    p.cyl(0.5, 1.4, (0, 0, 2.2), gold, v=12, r2=1.0)             # cup
    p.torus(1.0, 0.07, (0, 0, 2.9), gold, seg=14)
    for s in (-1, 1):
        p.torus(0.45, 0.09, (s * 1.15, 0, 2.3), gold, rot=(90, 0, 0), seg=10)
    p.ico(0.45, (0, 0, 3.6), glow, sub=1)                          # star-gem above the cup
    p.cone(0.28, 0.7, (0, 0, 4.2), glow, v=4)
    return p.parts, "prop"


ZONE_PROPS = {  # name -> (zone id, builder)
    "mushroom": "meadow", "flower_cluster": "meadow", "bush": "meadow",
    "cactus": "desert", "scrap_pile": "desert", "oil_barrel": "desert",
    "ice_crystal_cluster": "frost", "snow_pine": "frost", "frozen_rock": "frost",
    "lava_rock": "magma", "forge_pipe": "magma", "ember_brazier": "magma",
    "neon_pillar": "void", "floating_shard": "void", "void_obelisk": "void",
}
GAMEPLAY_PROPS = ["training_dummy", "stage_gate_arch", "return_portal_pad", "raid_spawn_pad",
                  "raid_cover_block", "loot_chest_raid", "season_pass_trophy"]
for _f in (mushroom, flower_cluster, bush, cactus, scrap_pile, oil_barrel, ice_crystal_cluster, snow_pine,
           frozen_rock, lava_rock, forge_pipe, ember_brazier, neon_pillar, floating_shard, void_obelisk,
           training_dummy, stage_gate_arch, return_portal_pad, raid_spawn_pad, raid_cover_block,
           loot_chest_raid, season_pass_trophy):
    BUILDERS[_f.__name__] = _f


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
    p.add_argument("--type", required=True, choices=list(BUILDERS) + ["all", "zones", "gameplay"])
    p.add_argument("--out", required=True, help="file.fbx, or a folder when --type all")
    p.add_argument("--color", default=None, help="hex main colour, e.g. #ff8800")
    p.add_argument("--size", type=float, default=4.0, help="approx size in studs")
    p.add_argument("--seed", type=int, default=1)
    a = p.parse_args(R.cli_args())
    if a.type == "all":  # original props only
        for k in list(BUILDERS)[:15]:
            build_one(k, a, os.path.join(a.out, f"{k}.fbx"))
    elif a.type == "zones":  # <out>/<zoneId>/<name>.fbx
        for k, z in ZONE_PROPS.items():
            build_one(k, a, os.path.join(a.out, z, f"{k}.fbx"))
    elif a.type == "gameplay":
        for k in GAMEPLAY_PROPS:
            build_one(k, a, os.path.join(a.out, f"{k}.fbx"))
    else:
        build_one(a.type, a, a.out)


if __name__ == "__main__":
    main()
