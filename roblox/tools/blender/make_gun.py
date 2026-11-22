"""Parametric chunky sci-fi toy guns for Roblox Tools.

  python make_gun.py --type blaster --rarity 5 --out out/blaster_r5.fbx
  python make_gun.py --type all --rarity 1,5 --out art/blender/guns/      (files <type>_r<n>.fbx)

Types: pistol, smg, shotgun, rifle, blaster, railgun, all.   Rarity 1..5 (or a list "1,5").

ORIENTATION (consistent for every gun):
  * Barrel points along +X in Blender / in the FBX file. Z is up. Gun is centred on Y (left/right).
  * Origin = centre of the grip (where the hand holds it) -> use as Tool.Handle directly.
  * In Studio the importer keeps the mesh as-is, so the muzzle is on the Handle's +X (RightVector).
    Tool.Grip: set GripForward = (0,0,-1)-ish rotation so the muzzle faces the character's LookVector,
    i.e. Tool.Grip = CFrame.Angles(0, math.rad(90), 0)  (muzzle along -Z of the hand). Muzzle attachment:
    find Attachment "Muzzle" position from MUZZLE below (printed on export) in Handle-local studs.
  * 1 unit = 1 stud. Pistol ~2.6 long, rifle/railgun ~5.5-6.5.
Neon accent strips use the Guns.luau rarity colour (emissive). Budget: <= 1500 tris each.
"""
import argparse
import os
import sys

import bpy
import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rbx_lib as R  # noqa: E402

# Guns.luau Rarities + Types colours
RARITY = ["#c8c8d0", "#3ad8ff", "#b56cff", "#ffc935", "#ff4f6a"]
BODY = {"pistol": "#46465a", "smg": "#3c5a78", "shotgun": "#78503a", "rifle": "#50644a",
        "blaster": "#2e7f99", "railgun": "#8a2f78"}
TYPES = list(BODY)


class Ctx:
    def __init__(self, kind, rarity):
        self.parts = []
        self.acc_hex = RARITY[rarity - 1]
        self.rarity = rarity
        self.body = R.material("GunBody", R.hex_color(BODY[kind]), roughness=0.55)
        self.dark = R.material("GunDark", R.hex_color("#1f1f2b"), roughness=0.6)
        self.metal = R.material("GunMetal", R.hex_color("#9aa0b0"), metallic=0.8, roughness=0.35)
        self.accent = R.material("GunAccent", R.hex_color(self.acc_hex), emission=3.0, roughness=0.3)
        self.muzzle = (0, 0, 0)

    def bx(self, dims, loc, mat, rot=0.0, bev=0.04):
        o = R.add_obj("cube", size=1, location=loc)
        o.scale = dims
        bpy.ops.object.transform_apply(scale=True)
        o.rotation_euler = (0, R.deg(rot), 0)
        if bev:
            R.bevel(o, bev, 1)
        R.assign(o, mat)
        self.parts.append(o)
        return o

    def cy(self, r, length, loc, mat, verts=12, vertical=False, rot=0.0):
        o = R.add_obj("cylinder", vertices=verts, radius=r, depth=length, location=loc)
        o.rotation_euler = (0, R.deg(rot), 0) if vertical else (0, R.deg(90), 0)
        R.assign(o, mat)
        self.parts.append(o)
        return o

    def strip(self, x0, x1, z, half_w, h=0.07):
        for s in (-1, 1):
            self.bx((x1 - x0, 0.04, h), ((x0 + x1) / 2, s * (half_w + 0.012), z), self.accent, bev=0)

    def finish_core(self, x, z):
        """Rarity >= 4: glowing crystal core on top; rarity 5: extra fins."""
        if self.rarity >= 4:
            c = R.add_obj("ico_sphere", subdivisions=1, radius=0.2, location=(x, 0, z))
            R.assign(c, self.accent)
            self.parts.append(c)
        if self.rarity >= 5:  # glowing dorsal fin
            self.bx((0.5, 0.05, 0.3), (x - 0.1, 0, z - 0.1), self.accent, bev=0)


def pistol(c):
    c.bx((1.7, 0.5, 0.55), (0.35, 0, 0.45), c.body)                 # frame
    c.bx((1.9, 0.42, 0.28), (0.45, 0, 0.82), c.metal)                # slide
    c.cy(0.15, 0.7, (1.55, 0, 0.82), c.dark)                         # barrel
    c.bx((0.5, 0.46, 1.1), (-0.15, 0, -0.1), c.dark, rot=-12)        # grip
    c.bx((0.4, 0.4, 0.3), (-0.25, 0, -0.75), c.metal)                # mag base
    c.bx((0.5, 0.5, 0.1), (0.45, 0, 0.2), c.body)                    # trigger guard
    c.bx((0.15, 0.2, 0.18), (1.2, 0, 1.05), c.dark)                  # front sight
    c.bx((0.15, 0.2, 0.18), (-0.4, 0, 1.05), c.dark)                 # rear sight
    c.strip(-0.3, 1.2, 0.45, 0.25)
    c.finish_core(0.4, 1.1)
    c.muzzle = (1.95, 0, 0.82)
    return (-0.15, -0.1)


def smg(c):
    c.bx((2.4, 0.56, 0.7), (0.5, 0, 0.5), c.body)
    c.bx((1.2, 0.36, 0.45), (1.55, 0, 0.5), c.dark)                  # shroud
    c.cy(0.14, 0.7, (2.5, 0, 0.5), c.metal)
    c.bx((0.55, 0.46, 1.0), (-0.15, 0, -0.1), c.dark, rot=-10)       # grip
    c.bx((0.45, 0.4, 1.3), (0.85, 0, -0.35), c.metal)                # long mag
    c.bx((1.0, 0.3, 0.45), (-1.15, 0, 0.55), c.dark)                 # stock stub
    c.bx((0.8, 0.3, 0.12), (0.4, 0, 1.0), c.dark)                    # top rail
    c.bx((0.15, 0.2, 0.22), (1.1, 0, 1.12), c.dark)
    c.strip(-0.5, 1.4, 0.6, 0.28)
    c.finish_core(0.4, 1.15)
    c.muzzle = (2.9, 0, 0.5)
    return (-0.15, -0.1)


def shotgun(c):
    c.bx((2.2, 0.6, 0.7), (0.2, 0, 0.5), c.body)
    c.cy(0.26, 3.2, (2.4, 0, 0.62), c.metal, verts=12)               # big barrel
    c.cy(0.2, 2.2, (1.9, 0, 0.05), c.dark, verts=10)                  # mag tube
    c.bx((1.0, 0.5, 0.42), (1.6, 0, -0.05), c.body)                   # pump
    c.bx((0.5, 0.46, 1.0), (-0.45, 0, -0.1), c.dark, rot=-12)         # grip
    c.bx((1.8, 0.5, 0.8), (-1.9, 0, 0.35), c.body, rot=-8)            # stock
    c.bx((0.15, 0.2, 0.2), (3.8, 0, 0.95), c.dark)                    # bead sight
    c.strip(-0.8, 0.9, 0.55, 0.31)
    c.finish_core(0.1, 0.95)
    c.muzzle = (4.0, 0, 0.62)
    return (-0.45, -0.1)


def rifle(c):
    c.bx((3.0, 0.55, 0.65), (0.8, 0, 0.5), c.body)
    c.cy(0.14, 2.2, (3.6, 0, 0.55), c.metal)
    c.bx((1.4, 0.4, 0.4), (2.8, 0, 0.5), c.dark)                      # handguard
    c.bx((0.5, 0.46, 1.0), (-0.25, 0, -0.1), c.dark, rot=-12)
    c.bx((0.45, 0.4, 1.0), (0.7, 0, -0.1), c.metal, rot=8)            # mag
    c.bx((2.0, 0.45, 0.9), (-1.7, 0, 0.35), c.body, rot=-6)           # stock
    c.cy(0.22, 1.2, (0.9, 0, 1.2), c.dark)                            # scope
    c.cy(0.28, 0.12, (1.55, 0, 1.2), c.accent)                        # lens ring
    c.bx((0.3, 0.2, 0.3), (0.9, 0, 0.95), c.dark)
    c.strip(-0.4, 2.2, 0.55, 0.275)
    c.finish_core(-0.3, 0.95)
    c.muzzle = (4.75, 0, 0.55)
    return (-0.25, -0.1)


def blaster(c):
    c.cy(0.65, 2.2, (0.4, 0, 0.55), c.body, verts=14)                 # fat chunky chamber
    c.cy(0.45, 1.4, (2.1, 0, 0.55), c.dark, verts=12)                 # barrel base
    for x in (1.6, 2.1, 2.6):
        c.cy(0.55, 0.18, (x, 0, 0.55), c.accent, verts=12)            # glowing rings
    c.cy(0.3, 0.7, (3.0, 0, 0.55), c.metal, verts=10)                 # muzzle
    c.bx((0.55, 0.5, 1.0), (-0.1, 0, -0.35), c.dark, rot=-14)
    c.bx((0.9, 0.3, 0.6), (-1.1, 0, 0.9), c.body, rot=20)             # rear fin
    c.bx((0.9, 0.3, 0.5), (0.3, 0, 1.3), c.body)                      # top fin
    c.cy(0.32, 0.9, (0.4, 0, 1.15), c.accent, verts=8, vertical=True)  # energy cell
    c.strip(-0.6, 1.2, 0.55, 0.65)
    c.finish_core(-0.8, 1.2)
    c.muzzle = (3.35, 0, 0.55)
    return (-0.1, -0.35)


def railgun(c):
    for s in (-1, 1):
        c.bx((4.2, 0.22, 0.35), (2.3, s * 0.38, 0.6), c.metal)         # twin rails
        c.bx((4.2, 0.05, 0.12), (2.3, s * 0.5, 0.6), c.accent, bev=0)  # neon rail glow
    c.bx((2.6, 0.7, 0.8), (0.1, 0, 0.55), c.body)                      # body
    for x in (1.6, 2.5, 3.4):
        c.cy(0.55, 0.2, (x, 0, 0.6), c.accent, verts=12)               # coils
    c.bx((0.5, 0.5, 0.45), (4.3, 0, 0.6), c.dark)                      # muzzle block
    c.bx((0.55, 0.5, 1.0), (-0.2, 0, -0.35), c.dark, rot=-14)
    c.cy(0.5, 1.0, (-1.5, 0, 0.7), c.dark, verts=12)                   # power cell
    c.cy(0.35, 0.3, (-2.1, 0, 0.7), c.accent, verts=10)
    c.bx((1.0, 0.4, 0.5), (0.2, 0, 1.1), c.dark)                       # sight block
    c.bx((0.12, 0.2, 0.35), (0.6, 0, 1.5), c.accent, bev=0)
    c.strip(-0.9, 1.2, 0.6, 0.35)
    c.finish_core(-0.8, 1.2)
    c.muzzle = (4.6, 0, 0.6)
    return (-0.2, -0.35)


BUILDERS = {f.__name__: f for f in (pistol, smg, shotgun, rifle, blaster, railgun)}


def build_one(kind, rarity, out, scale=1.0):
    R.reset_scene()
    c = Ctx(kind, rarity)
    gx, gz = BUILDERS[kind](c)
    meshes = R.finalize(c.parts, join_name=f"{kind.capitalize()}_R{rarity}")
    m = meshes[0]
    m.data.transform(mathutils.Matrix.Translation((-gx, 0, -gz)))   # origin = grip centre
    if scale != 1.0:  # only for hero renders; game exports keep 1.0
        m.data.transform(mathutils.Matrix.Scale(scale, 4))
    R.shade_flat(m)
    mx, my, mz = c.muzzle
    print(f"[rbx] gun {kind} r{rarity}: MUZZLE (Handle-local studs) = ({mx - gx:.2f}, {my:.2f}, {mz - gz:.2f})")
    R.check_budget(meshes, "prop")
    R.export_fbx(out, meshes)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--type", required=True, choices=TYPES + ["all"])
    p.add_argument("--rarity", default="1", help="1..5 or comma list, e.g. 1,5")
    p.add_argument("--out", required=True, help="file.fbx, or a folder for --type all / several rarities")
    p.add_argument("--scale", type=float, default=1.0, help="uniform scale (hero renders only)")
    a = p.parse_args(R.cli_args())
    rars = [int(x) for x in a.rarity.split(",")]
    kinds = TYPES if a.type == "all" else [a.type]
    for k in kinds:
        for r in rars:
            out = a.out if (a.out.endswith(".fbx") and len(kinds) * len(rars) == 1) else os.path.join(a.out, f"{k}_r{r}.fbx")
            build_one(k, r, out, a.scale)


if __name__ == "__main__":
    main()
