"""Realistic-proportion modern / sci-fi firearms for Roblox Tools (v2: detailed, smooth, PBR, animatable parts).

  python make_gun.py --type rifle --rarity 5 --out out/rifle_r5.fbx
  python make_gun.py --type all --rarity 1,2,3,4,5 --out art/blender/guns/      (files <type>_r<n>.fbx + <type>_r<n>.png)

Types: pistol, smg, shotgun, rifle, blaster, railgun, all.   Rarity 1..5 (or a list "1,5").
Rarity ladder: r1 plain gunmetal/polymer | r2 +glow strips & muzzle ring | r3 +glowing optic/handguard band, tinted furniture
               | r4 +glowing energy window/core + fins | r5 exotic: gold-plated trim, extra glow rails, bigger flare.

SEPARATE MESH PARTS in one FBX (all share ONE pivot = grip centre, so they line up with no offsets):
  Body      receiver, barrel, muzzle device, handguard, stock, grip, rails, optic, trigger guard   (static)
  Magazine  mag + base plate               -> reload anim: slide DOWN along -Z, swap, back up
  Slide     pistol/shotgun: slide / pump   -> slides back along -X (pistol 0.5 stud, shotgun pump 0.9 stud)
  Bolt      smg/rifle/blaster/railgun: charging handle / bolt carrier -> back along -X (0.5 stud)
  Trigger   trigger blade                  -> rotate about Y around TRIGGER pivot (printed on export), ~12 deg
  Glow      (r2+) emissive accent parts: set Material=Neon, colour = rarity colour (flat emissive material)
All parts except Glow use one baked 512px albedo (<name>.png next to the FBX, also embedded in the FBX).

ORIENTATION: barrel points along +X, Z up, centred on Y. Origin = grip centre (Tool.Handle).
Printed on export: MUZZLE (Handle-local studs), EJECT port position, TRIGGER pivot, tri count (budget 4000).
Tool.Grip = CFrame.Angles(0, math.rad(90), 0) makes the muzzle face the character's look vector.
"""
import argparse
import math
import os
import sys

import bpy
import bmesh
import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rbx_lib as R  # noqa: E402

RARITY = ["#c8c8d0", "#3ad8ff", "#b56cff", "#ffc935", "#ff4f6a"]   # Guns.luau rarity colours
TYPES = ["pistol", "smg", "shotgun", "rifle", "blaster", "railgun"]
# furniture tint per type (r1 = plain gunmetal; sci-fi types a touch of hue)
POLY = {"pistol": "#23252b", "smg": "#22262b", "shotgun": "#2b2520", "rifle": "#24282a", "blaster": "#1f2830",
        "railgun": "#2a2033"}
SLIDE_NAME = {"pistol": "Slide", "shotgun": "Slide"}   # others: Bolt


class Ctx:
    def __init__(self, kind, rarity):
        self.kind, self.rarity = kind, rarity
        self.parts = {}
        acc = R.hex_color(RARITY[rarity - 1])

        def tint(hexc, k):
            return tuple(a * (1 - k) + b * k for a, b in zip(R.hex_color(hexc), acc))

        k = 0.0 if rarity < 3 else 0.14
        self.metal = R.material("GunMetal", R.hex_color("#3b3f47"), metallic=0.9, roughness=0.42, grunge=0.3)
        self.steel = R.material("GunSteel", R.hex_color("#8d929c"), metallic=0.95, roughness=0.3, grunge=0.25)
        self.poly = R.material("GunPoly", tint(POLY[kind], k), metallic=0.0, roughness=0.78, grunge=0.35, scale=22)
        self.dark = R.material("GunDark", R.hex_color("#101114"), metallic=0.3, roughness=0.6, grunge=0.15)
        self.trim = (R.material("GunGold", R.hex_color("#d9a53a"), metallic=1.0, roughness=0.28, grunge=0.2)
                     if rarity >= 5 else self.steel)
        self.glass = R.material("GunGlass", R.hex_color("#12202c"), metallic=0.0, roughness=0.08, grunge=0.0)
        self.glow = R.material("GunGlow", acc, emission=4.0, roughness=0.3, grunge=0.0)
        self.muzzle = (0, 0, 0)
        self.eject = (0, 0, 0)
        self.trig = (0, 0)

    # ---- primitives -------------------------------------------------------------------------------
    def _reg(self, o, part, mat):
        R.assign(o, mat)
        self.parts.setdefault(part, []).append(o)
        return o

    def box(self, part, dims, loc, mat, rot=0.0, bev=0.035, seg=2):
        o = R.add_obj("cube", size=1, location=loc)
        o.scale = dims
        bpy.ops.object.transform_apply(scale=True)
        o.rotation_euler = (0, math.radians(rot), 0)
        if bev:
            R.bevel(o, min(bev, min(dims) * 0.4), seg)
        return self._reg(o, part, mat)

    def cyl(self, part, r, length, loc, mat, verts=14, axis="x", r2=None, bev=0.0):
        o = R.add_obj("cone", vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=length, location=loc)
        if axis == "x":
            o.rotation_euler = (0, math.radians(90), 0)
        elif axis == "y":
            o.rotation_euler = (math.radians(90), 0, 0)
        if bev:
            R.bevel(o, bev, 1)
        return self._reg(o, part, mat)

    def prof(self, part, pts, w, mat, y=0.0, bev=0.03, seg=2):
        """Side-profile polygon (x,z points, CCW) extruded across Y by w."""
        bm = bmesh.new()
        vs = [bm.verts.new((x, y - w / 2, z)) for x, z in pts]
        f = bm.faces.new(vs)
        ex = bmesh.ops.extrude_face_region(bm, geom=[f])
        for v in [e for e in ex["geom"] if isinstance(e, bmesh.types.BMVert)]:
            v.co.y += w
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new("prof")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("prof", me)
        bpy.context.collection.objects.link(o)
        if bev:
            R.bevel(o, min(bev, w * 0.4), seg)
        return self._reg(o, part, mat)

    # ---- shared gun furniture ----------------------------------------------------------------------
    def rail(self, x0, x1, z, w=0.22, teeth=8, part="Body"):
        """Picatinny-style rail: base + raised teeth."""
        self.box(part, (x1 - x0, w, 0.07), ((x0 + x1) / 2, 0, z), self.metal, bev=0.012, seg=1)
        step = (x1 - x0) / teeth
        for i in range(teeth):
            self.box(part, (step * 0.55, w, 0.06), (x0 + step * (i + 0.5), 0, z + 0.06), self.metal, bev=0, seg=1)

    def guard(self, x0, x1, ztop, zbot, w=0.16, part="Body"):
        """Trigger guard loop from 3 bars (open in the middle)."""
        t = 0.07
        self.box(part, (t, w, ztop - zbot), (x1, 0, (ztop + zbot) / 2), self.poly, bev=0.02, seg=1)
        self.box(part, (x1 - x0, w, t), ((x0 + x1) / 2, 0, zbot), self.poly, bev=0.02, seg=1)
        self.box(part, (t, w, (ztop - zbot) * 0.6), (x0, 0, zbot + (ztop - zbot) * 0.3), self.poly, bev=0.02, seg=1)

    def trigger(self, x, z, h=0.3):
        self.prof("Trigger", [(x - 0.04, z + h / 2), (x + 0.05, z + h / 2), (x + 0.1, z - h / 2), (x + 0.01, z - h / 2)],
                  0.07, self.steel, bev=0.012, seg=1)
        self.trig = (x, z + h / 2)

    def eject_port(self, x0, x1, z0, z1, part, y):
        self.box(part, (x1 - x0, 0.03, z1 - z0), ((x0 + x1) / 2, y, (z0 + z1) / 2), self.dark, bev=0.01, seg=1)
        self.eject = ((x0 + x1) / 2, y, (z0 + z1) / 2)

    def strip(self, x0, x1, z, y, h=0.05):
        for s in (-1, 1):
            self.box("Glow", (x1 - x0, 0.025, h), ((x0 + x1) / 2, s * y, z), self.glow, bev=0, seg=1)

    def flash_hider(self, x, z, r=0.13, n=0.34):
        self.cyl("Body", r, n, (x + n / 2, 0, z), self.dark, verts=12, r2=r * 0.92)
        for i in range(3):   # slots read as rings
            self.cyl("Body", r * 1.08, 0.04, (x + 0.07 + i * 0.1, 0, z), self.dark, verts=12)

    def red_dot(self, x, z):
        self.box("Body", (0.5, 0.26, 0.07), (x, 0, z), self.metal, bev=0.02, seg=1)
        self.prof("Body", [(x - 0.2, z + 0.03), (x + 0.2, z + 0.03), (x + 0.2, z + 0.4), (x + 0.12, z + 0.4),
                           (x + 0.12, z + 0.12), (x - 0.12, z + 0.12), (x - 0.12, z + 0.4), (x - 0.2, z + 0.4)],
                  0.24, self.dark, bev=0.02, seg=1)
        self.box("Body", (0.02, 0.18, 0.2), (x + 0.07, 0, z + 0.28), self.glass, bev=0, seg=1)

    def scope(self, x, z, length=1.3, r=0.17):
        self.cyl("Body", r, length, (x, 0, z), self.dark, verts=14)
        self.cyl("Body", r * 1.35, length * 0.22, (x + length * 0.5 - 0.1, 0, z), self.dark, verts=14, r2=r * 1.1)
        self.cyl("Body", r * 1.2, length * 0.16, (x - length * 0.5 + 0.1, 0, z), self.dark, verts=14, r2=r)
        for dx in (-0.35, 0.35):
            self.box("Body", (0.16, 0.2, 0.22), (x + dx, 0, z - 0.2), self.metal, bev=0.015, seg=1)
        self.cyl("Body", 0.06, 0.12, (x - 0.05, 0, z + r + 0.05), self.metal, verts=8, axis="y")   # turret
        self.cyl("Glow" if self.rarity >= 3 else "Body", r * 1.05, 0.03, (x + length * 0.5 + 0.02, 0, z),
                 self.glow if self.rarity >= 3 else self.glass, verts=14)

    def mag(self, pts, w=0.34):
        self.prof("Magazine", pts, w, self.metal, bev=0.025, seg=2)
        xs = [p[0] for p in pts]
        zs = [p[1] for p in pts]
        self.prof("Magazine", [(min(xs) - 0.03, min(zs) - 0.07), (max(xs) + 0.05, min(zs) - 0.07),
                               (max(xs) + 0.05, min(zs) + 0.03), (min(xs) - 0.03, min(zs) + 0.03)],
                  w + 0.06, self.poly, bev=0.02, seg=1)

    def extras(self, bx0, bx1, zmid, h, w):
        """Rarity ladder shared by all types. bx0..bx1 = receiver span, zmid/h = receiver height, w = half width."""
        mx, _, mz = self.muzzle
        if self.rarity >= 2:   # glowing muzzle ring + side strips
            self.cyl("Glow", 0.2, 0.06, (mx - 0.08, 0, mz), self.glow, verts=14)
            self.strip(bx0, bx1, zmid, w + 0.01)
        if self.rarity >= 4:   # energy windows in receiver
            for s in (-1, 1):
                self.box("Glow", (min(0.7, (bx1 - bx0) * 0.35), 0.03, h * 0.35),
                         (bx0 + (bx1 - bx0) * 0.45, s * (w + 0.015), zmid + h * 0.1), self.glow, bev=0, seg=1)
        if self.rarity >= 5:   # exotic glow rail on top + fins
            self.box("Glow", ((bx1 - bx0) * 0.8, 0.06, 0.035), ((bx0 + bx1) / 2, 0, zmid + h / 2 + 0.03), self.glow, bev=0, seg=1)
            for s in (-1, 1):
                f = self.box("Glow", (0.5, 0.025, 0.22), (bx0 + 0.2, s * (w + 0.1), zmid - 0.1), self.glow, bev=0, seg=1)
                f.rotation_euler = (s * math.radians(35), 0, 0)


# ------------------------------------------------------------------------------------------------------------
# Each builder returns the grip-centre (gx, gz) used as the FBX origin.
def pistol(c):
    c.box("Slide", (2.55, 0.46, 0.5), (0.3, 0, 0.78), c.metal, bev=0.06)
    c.box("Slide", (2.3, 0.3, 0.04), (0.35, 0, 1.04), c.steel, bev=0.01, seg=1)
    for i in range(5):
        for s in (-1, 1):                                                                 # rear serrations
            c.box("Slide", (0.035, 0.03, 0.34), (-0.82 + i * 0.1, s * 0.235, 0.78), c.dark, bev=0, seg=1)
    c.box("Slide", (0.14, 0.12, 0.17), (1.38, 0, 1.12), c.dark, bev=0.015, seg=1)       # front sight
    for s in (-1, 1):                                                                     # rear sight
        c.box("Slide", (0.14, 0.09, 0.15), (-0.88, s * 0.1, 1.1), c.dark, bev=0.015, seg=1)
    c.eject_port(0.15, 0.75, 0.68, 0.92, "Slide", 0.235)
    c.prof("Body", [(-1.0, 0.52), (1.4, 0.52), (1.4, 0.3), (0.95, 0.3), (0.52, 0.28), (0.14, 0.28), (-0.18, 0.0),
                    (-0.52, -0.9), (-1.12, -0.9), (-1.2, -0.55), (-1.08, 0.12)], 0.4, c.poly, bev=0.04)
    c.guard(0.0, 0.98, 0.3, 0.02, 0.16)
    c.box("Body", (0.5, 0.2, 0.08), (1.1, 0, 0.26), c.metal, bev=0.01, seg=1)
    c.cyl("Body", 0.11, 0.35, (1.67, 0, 0.78), c.steel, verts=12)
    c.cyl("Body", 0.145, 0.1, (1.78, 0, 0.78), c.dark, verts=12)
    c.box("Body", (0.1, 0.22, 0.1), (-0.55, 0, 0.42), c.steel, bev=0.01, seg=1)
    c.box("Body", (0.1, 0.05, 0.09), (-0.05, 0.215, 0.3), c.steel, bev=0.01, seg=1)
    for i in range(3):                                                                    # grip texture bands
        c.box("Body", (0.5, 0.42, 0.03), (-0.68 - i * 0.05, 0, -0.1 - i * 0.28), c.dark, rot=-14, bev=0, seg=1)
    c.mag([(-0.98, 0.1), (-0.3, 0.1), (-0.28, -0.88), (-1.1, -0.88)], 0.3)
    c.trigger(0.52, 0.2)
    c.muzzle = (1.84, 0, 0.78)
    c.extras(-0.8, 1.3, 0.78, 0.5, 0.235)
    return (-0.65, -0.1)


def smg(c):
    c.prof("Body", [(-0.9, 0.95), (1.5, 0.95), (1.5, 0.15), (0.45, 0.15), (0.2, -0.05), (-0.35, -0.05), (-0.62, -0.95),
                    (-1.2, -0.95), (-0.95, 0.0), (-0.9, 0.0)], 0.5, c.poly, bev=0.05)
    c.prof("Body", [(-0.88, 0.97), (1.48, 0.97), (1.48, 0.6), (-0.88, 0.6)], 0.54, c.metal, bev=0.05)
    c.prof("Body", [(1.45, 0.96), (2.7, 0.9), (2.7, 0.2), (1.45, 0.2)], 0.42, c.metal, bev=0.05)
    for i in range(5):
        for s in (-1, 1):
            c.box("Body", (0.12, 0.03, 0.34), (1.7 + i * 0.22, s * 0.215, 0.58), c.dark, bev=0, seg=1)
    c.cyl("Body", 0.12, 0.55, (2.95, 0, 0.62), c.steel, verts=12)
    c.flash_hider(3.2, 0.62, 0.15, 0.4)
    c.rail(-0.7, 1.4, 1.0, 0.24, 9)
    c.red_dot(0.45, 1.07)
    c.prof("Body", [(-0.9, 0.9), (-2.2, 0.82), (-2.3, 0.05), (-1.7, -0.02), (-0.9, 0.35)], 0.3, c.poly, bev=0.04)
    c.box("Body", (0.3, 0.38, 0.5), (-2.3, 0, 0.45), c.dark, bev=0.03, seg=1)
    c.prof("Body", [(1.65, 0.2), (2.05, 0.2), (2.0, -0.7), (1.7, -0.7)], 0.3, c.poly, bev=0.04)
    c.guard(0.2, 0.95, 0.15, -0.12, 0.2)
    c.eject_port(0.5, 1.15, 0.68, 0.9, "Bolt", 0.275)
    c.box("Bolt", (0.34, 0.16, 0.16), (0.85, 0.3, 0.8), c.steel, bev=0.03, seg=1)
    c.box("Bolt", (0.9, 0.1, 0.18), (0.4, 0.27, 0.8), c.dark, bev=0.02, seg=1)
    c.mag([(0.62, 0.15), (1.1, 0.15), (1.2, -0.5), (1.12, -1.35), (0.7, -1.35), (0.7, -0.5)], 0.34)
    c.trigger(0.45, 0.02, 0.32)
    c.muzzle = (3.6, 0, 0.62)
    c.extras(-0.5, 1.35, 0.78, 0.45, 0.27)
    return (-0.62, -0.1)


def shotgun(c):
    c.prof("Body", [(-1.0, 0.95), (1.2, 0.95), (1.2, 0.3), (0.35, 0.25), (0.15, 0.05), (-0.3, 0.0), (-0.55, -0.95),
                    (-1.1, -0.95), (-1.0, 0.0)], 0.5, c.metal, bev=0.05)
    c.cyl("Body", 0.2, 3.7, (3.0, 0, 0.7), c.steel, verts=16)
    c.cyl("Body", 0.17, 2.6, (2.4, 0, 0.2), c.metal, verts=14)
    c.cyl("Body", 0.24, 0.14, (4.8, 0, 0.7), c.dark, verts=16)
    c.cyl("Body", 0.23, 0.08, (4.5, 0, 0.2), c.dark, verts=14)
    c.cyl("Body", 0.2, 0.2, (1.75, 0, 0.7), c.dark, verts=14, r2=0.22)
    c.box("Body", (3.0, 0.1, 0.05), (3.0, 0, 0.99), c.steel, bev=0.012, seg=1)
    c.box("Body", (0.1, 0.1, 0.16), (4.7, 0, 1.08), c.dark, bev=0.015, seg=1)
    c.prof("Body", [(-1.0, 0.9), (-3.4, 0.8), (-3.5, 0.0), (-3.0, -0.35), (-1.9, -0.05), (-1.0, 0.25)], 0.38, c.poly, bev=0.05)
    c.box("Body", (0.18, 0.42, 0.85), (-3.5, 0, 0.35), c.dark, rot=3, bev=0.03, seg=1)
    c.guard(0.0, 0.7, 0.28, -0.04, 0.18)
    c.eject_port(-0.2, 0.55, 0.6, 0.85, "Body", 0.255)
    c.box("Slide", (1.25, 0.52, 0.5), (2.2, 0, 0.2), c.poly, bev=0.07)                    # pump forend
    for i in range(6):
        c.box("Slide", (0.045, 0.54, 0.46), (1.8 + i * 0.14, 0, 0.2), c.dark, bev=0, seg=1)
    c.prof("Magazine", [(0.0, 0.0), (0.7, 0.0), (0.7, -0.38), (0.0, -0.38)], 0.34, c.metal, bev=0.03, seg=1)   # loading gate
    c.trigger(0.2, 0.05, 0.3)
    c.muzzle = (4.87, 0, 0.7)
    c.extras(-0.9, 1.1, 0.62, 0.65, 0.255)
    return (-0.55, -0.1)


def rifle(c):
    c.prof("Body", [(-0.9, 0.78), (1.35, 0.78), (1.35, 0.25), (0.55, 0.22), (0.2, -0.02), (-0.3, -0.02),
                    (-0.58, -0.95), (-1.1, -0.95), (-0.95, -0.02), (-0.9, 0.2)], 0.46, c.poly, bev=0.04)
    c.prof("Body", [(-0.92, 1.0), (1.4, 1.0), (1.4, 0.55), (-0.92, 0.55)], 0.5, c.metal, bev=0.05)
    c.prof("Body", [(1.38, 1.02), (4.3, 0.97), (4.3, 0.28), (1.38, 0.28)], 0.5, c.metal, bev=0.06)
    for i in range(6):
        for s in (-1, 1):
            c.box("Body", (0.34, 0.03, 0.11), (1.95 + i * 0.4, s * 0.255, 0.62), c.dark, bev=0, seg=1)
    c.rail(-0.7, 4.2, 1.07, 0.24, 20)
    c.cyl("Body", 0.1, 0.8, (4.6, 0, 0.64), c.steel, verts=12)
    c.cyl("Body", 0.15, 0.16, (4.25, 0, 0.64), c.dark, verts=12)
    c.flash_hider(4.95, 0.64, 0.14, 0.4)
    c.prof("Body", [(-0.9, 0.82), (-1.5, 0.8), (-1.5, 0.45), (-0.9, 0.45)], 0.18, c.dark, bev=0.02, seg=1)
    c.prof("Body", [(-1.5, 0.82), (-3.0, 0.7), (-3.1, -0.05), (-2.55, -0.08), (-1.5, 0.28)], 0.34, c.poly, bev=0.05)
    c.box("Body", (0.16, 0.38, 0.8), (-3.1, 0, 0.33), c.dark, rot=3, bev=0.025, seg=1)
    c.guard(0.2, 0.95, 0.24, -0.04, 0.16)
    c.scope(1.1, 1.52, 1.5, 0.19)
    c.box("Body", (0.12, 0.16, 0.2), (3.7, 0, 1.2), c.dark, bev=0.015, seg=1)
    c.eject_port(0.3, 1.0, 0.7, 0.92, "Bolt", 0.255)
    c.box("Bolt", (0.28, 0.14, 0.14), (-0.75, 0.28, 0.9), c.steel, bev=0.03, seg=1)
    c.box("Bolt", (0.9, 0.08, 0.2), (0.65, 0.26, 0.75), c.dark, bev=0.02, seg=1)
    c.mag([(0.52, 0.22), (1.08, 0.22), (1.14, -0.45), (1.3, -1.2), (0.78, -1.28), (0.6, -0.5)], 0.34)
    c.trigger(0.5, 0.05, 0.3)
    c.muzzle = (5.35, 0, 0.64)
    c.extras(-0.7, 1.3, 0.78, 0.45, 0.255)
    return (-0.62, -0.1)


def blaster(c):
    c.prof("Body", [(-1.2, 0.95), (1.1, 1.0), (1.55, 0.55), (1.55, 0.05), (0.4, 0.0), (0.1, -0.15), (-0.35, -0.15),
                    (-0.6, -0.95), (-1.1, -0.95), (-0.95, -0.1), (-1.25, 0.1)], 0.62, c.poly, bev=0.07)
    c.prof("Body", [(-1.1, 1.05), (1.0, 1.1), (1.4, 0.65), (-1.1, 0.65)], 0.66, c.metal, bev=0.07)
    for i in range(6):
        c.box("Body", (0.07, 0.5, 0.26), (-0.9 + i * 0.28, 0, 1.2 - i * 0.012), c.steel, bev=0.012, seg=1)
    c.cyl("Body", 0.5, 1.6, (2.25, 0, 0.55), c.metal, verts=16, r2=0.42)
    for i in range(3):
        c.cyl("Body", 0.56 - i * 0.04, 0.12, (1.85 + i * 0.5, 0, 0.55), c.dark, verts=16)
    c.cyl("Body", 0.22, 0.9, (3.35, 0, 0.55), c.steel, verts=14)
    c.cyl("Body", 0.36, 0.3, (3.95, 0, 0.55), c.dark, verts=16, r2=0.3)
    c.box("Body", (1.1, 0.5, 0.1), (1.3, 0, 1.0), c.metal, bev=0.02, seg=1)
    c.prof("Body", [(-1.2, 0.8), (-1.9, 0.6), (-1.9, 0.0), (-1.2, 0.15)], 0.5, c.poly, bev=0.06)
    c.guard(0.1, 0.9, 0.0, -0.22, 0.2)
    c.prof("Magazine", [(0.35, 0.05), (1.05, 0.05), (1.05, -0.55), (0.35, -0.55)], 0.5, c.metal, bev=0.04)
    c.box("Magazine", (0.5, 0.52, 0.34), (0.7, 0, -0.3), c.glass, bev=0.03, seg=1)
    c.box("Bolt", (0.34, 0.2, 0.16), (-0.8, 0.36, 1.0), c.steel, bev=0.03, seg=1)
    c.box("Bolt", (0.9, 0.08, 0.22), (-0.3, 0.34, 0.9), c.dark, bev=0.02, seg=1)
    c.trigger(0.45, -0.02, 0.3)
    c.muzzle = (4.12, 0, 0.55)
    c.red_dot(0.0, 1.17)
    c.extras(-0.7, 1.3, 0.85, 0.5, 0.33)
    if c.rarity >= 3:
        for i in range(3):
            c.cyl("Glow", 0.5 - i * 0.02, 0.05, (2.0 + i * 0.5, 0, 0.55), c.glow, verts=16)
    return (-0.6, -0.1)


def railgun(c):
    c.prof("Body", [(-1.4, 1.05), (1.8, 1.0), (1.8, 0.3), (0.4, 0.25), (0.15, -0.1), (-0.35, -0.1), (-0.62, -1.0),
                    (-1.15, -1.0), (-1.0, -0.1), (-1.4, 0.15)], 0.7, c.poly, bev=0.07)
    c.prof("Body", [(-1.1, 1.12), (1.9, 1.08), (1.9, 0.5), (-1.1, 0.5)], 0.74, c.metal, bev=0.07)
    for s in (-1, 1):
        c.box("Body", (4.6, 0.2, 0.34), (4.1, s * 0.4, 0.78), c.steel, bev=0.04)
        c.box("Body", (4.6, 0.04, 0.12), (4.1, s * 0.52, 0.78), c.dark, bev=0, seg=1)
    for i in range(7):                                                                    # rail coil clamps
        c.box("Body", (0.1, 0.9, 0.46), (2.2 + i * 0.65, 0, 0.78), c.dark, bev=0.015, seg=1)
    c.cyl("Body", 0.5, 1.5, (-1.3, 0, 0.7), c.metal, verts=16)
    c.cyl("Body", 0.4, 0.2, (-2.15, 0, 0.7), c.dark, verts=16)
    for i in range(4):
        c.cyl("Body", 0.52, 0.09, (-0.8 - i * 0.35, 0, 0.7), c.dark, verts=16)
    c.box("Body", (0.5, 0.74, 0.45), (6.55, 0, 0.78), c.dark, bev=0.04)
    c.box("Body", (1.6, 0.4, 0.2), (0.7, 0, 1.32), c.metal, bev=0.03)
    c.scope(0.8, 1.75, 1.6, 0.22)
    c.guard(0.1, 0.9, 0.25, -0.18, 0.2)
    c.prof("Body", [(-2.1, 0.5), (-2.55, 0.4), (-2.55, -0.1), (-2.1, 0.0)], 0.4, c.poly, bev=0.04)
    c.prof("Magazine", [(0.5, 0.2), (1.4, 0.2), (1.4, -0.6), (0.5, -0.6)], 0.46, c.metal, bev=0.04)
    c.box("Magazine", (0.4, 0.5, 0.3), (0.95, 0, -0.35), c.glass, bev=0.03, seg=1)
    c.box("Bolt", (0.3, 0.22, 0.18), (-0.5, 0.42, 1.05), c.steel, bev=0.03, seg=1)
    c.box("Bolt", (0.8, 0.08, 0.2), (0.0, 0.4, 0.9), c.dark, bev=0.02, seg=1)
    c.trigger(0.42, 0.02, 0.32)
    c.muzzle = (6.8, 0, 0.78)
    c.extras(-0.9, 1.8, 0.8, 0.55, 0.37)
    if c.rarity >= 3:
        for x in (2.6, 3.8, 5.0):
            for s in (-1, 1):
                c.box("Glow", (0.18, 0.03, 0.2), (x, s * 0.52, 0.78), c.glow, bev=0, seg=1)
    return (-0.62, -0.1)


BUILDERS = {f.__name__: f for f in (pistol, smg, shotgun, rifle, blaster, railgun)}


def build_one(kind, rarity, out, scale=1.0):
    R.reset_scene()
    c = Ctx(kind, rarity)
    gx, gz = BUILDERS[kind](c)
    slide_name = SLIDE_NAME.get(kind, "Bolt")
    shift = mathutils.Matrix.Translation((-gx, 0, -gz))
    named, glow = {}, None
    order = ["Body", "Magazine", slide_name, "Trigger"]
    for part in order + ["Glow"]:
        objs = c.parts.get(part, [])
        if not objs:
            continue
        m = R.finalize(objs, join_name=part, smooth=False)[0]
        m.name = m.data.name = part
        m.data.transform(shift)
        if scale != 1.0:
            m.data.transform(mathutils.Matrix.Scale(scale, 4))
        if part == "Glow":
            glow = m
        else:
            named[part] = m
    png = os.path.splitext(out)[0] + ".png"
    named = R.bake_atlas(named, png, 512)
    final = list(named.values()) + ([glow] if glow else [])
    for o in final:
        R.smooth_by_angle(o, 38.0)
    mx, my, mz = c.muzzle
    tx, tz = c.trig
    print(f"[rbx] gun {kind} r{rarity}: MUZZLE (Handle-local studs) = ({mx - gx:.2f}, {my:.2f}, {mz - gz:.2f}) "
          f"EJECT = ({c.eject[0] - gx:.2f}, {c.eject[1]:.2f}, {c.eject[2] - gz:.2f}) TRIGGER pivot = ({tx - gx:.2f}, 0, {tz - gz:.2f}) "
          f"parts = {', '.join(o.name + ':' + str(len(o.data.polygons)) for o in final)}")
    R.check_budget(final, "gun")
    R.export_fbx(out, final)


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
