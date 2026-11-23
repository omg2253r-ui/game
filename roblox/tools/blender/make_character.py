"""Detailed, smooth, rigged + animated creatures (monsters, bosses, pets, NPCs) for Roblox (v2).

  python make_character.py --roster monsters --out art/blender/monsters/     (20 files: 16 monsters + 4 bosses)
  python make_character.py --roster pets     --out art/blender/pets/         (18 files)
  python make_character.py --only slime_king --roster monsters --out out/    (one id)
  python make_character.py --style pet --color "#ffb347" --out out/pet.fbx   (legacy single creature)

Each FBX = ONE skinned mesh (smooth ellipsoid/limb parts, proper eyes with lids + specular, mouth/teeth/claws/horns where
the species has them, ONE baked <=512px albedo PNG next to the FBX) + an Armature with spine/neck/head/jaw/arms/legs/tail bones
and BAKED ANIMATION CLIPS (separate FBX takes, 30 fps, bone rotations/locations, loop clips end on their first pose):
  monsters/bosses: Idle 1-48 (loop) | Walk 1-24 (loop) | Attack 1-30 | Hit 1-15 | Death 1-40 (holds last pose)
  pets:            Idle 1-48 (loop) | Hop 1-30 (loop)
Body plans (--plan): biped, quad (hounds/crabs/lizards/dragons), flyer (bats/drones/wisps), blob (slimes), chibi (pets).
Creatures face -Y; origin = bottom-centre (feet on Z=0). Heights come from ROSTER (studs).
Budgets: monster <= 8000 tris, boss <= 12000, pet <= 5000.
"""
import argparse
import math
import os
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rbx_lib as R  # noqa: E402

FPS = 30
CLIPS = {"monster": [("Idle", 48, True), ("Walk", 24, True), ("Attack", 30, False), ("Hit", 15, False), ("Death", 40, False)],
         "pet": [("Idle", 48, True), ("Hop", 30, True)]}


# ====================================================================================================== roster
def spec(plan, color, height, kind="monster", **kw):
    d = dict(plan=plan, color=color, height=height, kind=kind)
    d.update(kw)
    return d


MONSTERS = {
    "slime": spec("blob", "#78e65a", 3, teeth=2, eyes="cute", accent="#c8ffa8"),
    "big_slime": spec("blob", "#5ac8a0", 4.5, teeth=4, eyes="angry", accent="#b8ffe8", spikes=5, wide=1.1),
    "bouncer": spec("blob", "#ff9fc8", 3.5, teeth=0, eyes="cute", accent="#ffd8ea", antenna=True, tall=1.15),
    "slime_king": spec("blob", "#ffdc3c", 10, kind="boss", teeth=6, eyes="angry", accent="#fff0a0", crown=True, drips=True),
    "scrap_bot": spec("biped", "#bea078", 4, robot=True, eyes="visor", glow="#ffb040", antenna=True, accent="#7a6448", arm_claws=True),
    "sand_crab": spec("quad", "#ebb45a", 4, crab=True, eyes="stalk", claws=True, accent="#fff0c8", teeth=0),
    "rust_drone": spec("flyer", "#c86e46", 3.5, drone=True, eyes="visor", glow="#ff6a30", accent="#6a3a28"),
    "sand_titan": spec("biped", "#ff963c", 12, kind="boss", bulk=1.5, horns=2, eyes="glow", glow="#fff070", teeth=6,
                       shoulders=True, accent="#ffd49a", claws=True, spikes=7, rock=True),
    "snowling": spec("biped", "#ebf5ff", 3.5, chubby=1.3, eyes="angry", teeth=3, accent="#ffffff", nose="#ff9040", arm_claws=False),
    "ice_bat": spec("flyer", "#8cc8ff", 3, bat=True, eyes="angry", teeth=2, ears=True, accent="#e0f4ff", fangs=True),
    "frost_golem": spec("biped", "#5aaaff", 6, bulk=1.4, blocky=True, eyes="glow", glow="#d8ffff", accent="#b0e0ff", crystals=True),
    "yeti_lord": spec("biped", "#dcf0ff", 13, kind="boss", bulk=1.5, horns=2, eyes="angry", teeth=6, claws=True,
                      accent="#ffffff", fur=True, tusks=True),
    "ember": spec("biped", "#ff8c32", 3.5, chubby=1.2, horns=2, eyes="angry", teeth=3, accent="#ffd070", flame=True, claws=True),
    "lava_hound": spec("quad", "#ff5028", 4.5, horns=2, eyes="glow", glow="#ffe040", teeth=6, claws=True, accent="#401810",
                       spikes=6, tail=True),
    "forge_brute": spec("biped", "#783c32", 6.5, bulk=1.5, horns=2, eyes="glow", glow="#ff8a2a", teeth=4, claws=False,
                        shoulders=True, accent="#ff7a30", fists=True, armor=True),
    "magma_overseer": spec("biped", "#ff4628", 14, kind="boss", bulk=1.4, horns=4, eyes="glow", glow="#fff050", teeth=6,
                           shoulders=True, accent="#ffb020", core=True, claws=True, spikes=7, crown=True),
    "void_wisp": spec("flyer", "#b56cff", 3, wisp=True, eyes="glow", glow="#ffffff", accent="#e0c0ff", tail=True),
    "glitch": spec("biped", "#3ad8ff", 4, eyes="visor", glow="#ff40d8", accent="#1a5a70", shards=True, blocky=True, antenna=True),
    "void_knight": spec("biped", "#ff4fd8", 6.5, bulk=1.25, horns=2, eyes="glow", glow="#ffffff", shoulders=True, armor=True,
                        accent="#401040", blocky=True, helmet=True),
    "void_emperor": spec("biped", "#ff4fd8", 16, kind="boss", bulk=1.3, horns=4, eyes="glow", glow="#ffffff", shoulders=True,
                         armor=True, accent="#2a0a30", crown=True, cape=True, shards=True, claws=True),
}
PETS = {
    "gooey": spec("blob", "#78e65a", 2.4, "pet", eyes="cute", accent="#c8ffa8", teeth=0),
    "pip": spec("chibi", "#ffc878", 3, "pet", ears="cat", eyes="cute", accent="#fff0d8", tail=True),
    "bubbles": spec("chibi", "#50c8ff", 3, "pet", ears="bunny", eyes="cute", accent="#d0f4ff", tail=True),
    "jelly_kid": spec("chibi", "#ffdc3c", 3, "pet", ears="cat", eyes="cute", accent="#fff4b0", tail=True),
    "bolt": spec("chibi", "#bea078", 3, "pet", ears="none", eyes="cute", accent="#8a7050", antenna=True, robot=True),
    "cogsy": spec("chibi", "#ff9f43", 3, "pet", ears="round", eyes="cute", accent="#ffe0b0", gear=True),
    "dune_fox": spec("chibi", "#ebaa50", 3.2, "pet", ears="fox", eyes="cute", accent="#fff0d0", tail=True, bigtail=True),
    "titan_cub": spec("chibi", "#ff783c", 3.4, "pet", ears="round", eyes="cute", accent="#ffd0a0", horns=2, tail=True),
    "frosty": spec("chibi", "#ebf5ff", 3, "pet", ears="round", eyes="cute", accent="#ffffff", scarf="#ff5050", nose="#ff9040"),
    "ice_bun": spec("chibi", "#8cc8ff", 3, "pet", ears="bunny", eyes="cute", accent="#e8f6ff", tail=True),
    "yeti_pup": spec("chibi", "#dcf0ff", 3.2, "pet", ears="cat", eyes="cute", accent="#ffffff", fur=True, horns=2, tail=True),
    "cinder": spec("chibi", "#ff8c32", 3, "pet", ears="cat", eyes="cute", accent="#ffe090", flame=True, tail=True),
    "lava_lizard": spec("quad", "#ff5028", 2.6, "pet", eyes="cute", accent="#ffc060", tail=True, spikes=5, lizard=True),
    "forge_spirit": spec("chibi", "#ff4f6a", 3.4, "pet", ears="bunny", eyes="cute", accent="#ffd0d8", flame=True, tail=True, halo="#ffc040"),
    "wisp": spec("flyer", "#b56cff", 2.6, "pet", wisp=True, eyes="cute", accent="#e8d0ff", tail=True),
    "glitchy": spec("chibi", "#3ad8ff", 3, "pet", ears="cat", eyes="cute", accent="#b0f0ff", shards=True, tail=True),
    "nebula": spec("chibi", "#ff4fd8", 3.2, "pet", ears="bunny", eyes="cute", accent="#ffd0f0", halo="#ffffff", tail=True),
    "void_dragon": spec("quad", "#7828c8", 3.8, "pet", eyes="cute", accent="#d0a0ff", tail=True, horns=2, wings=True, spikes=6,
                        dragon=True),
}


def smoothstep(a):
    a = max(0.0, min(1.0, a))
    return a * a * (3 - 2 * a)


def curve(t, pts):
    """piecewise ease-in-out interpolation through (t, value) points."""
    if t <= pts[0][0]:
        return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * smoothstep((t - t0) / (t1 - t0))
    return pts[-1][1]


# ====================================================================================================== builder
class Rig:
    def __init__(self, s):
        self.s = s
        self.parts = []
        self.bones = {}      # name -> (head, tail, parent)
        big = s["kind"] == "boss"
        pet = s["kind"] == "pet"
        self.seg, self.rings = (14, 9) if big else ((10, 7) if pet else (12, 8))
        col = R.hex_color(s["color"])
        mix = lambda c, t, k: tuple(a * (1 - k) + b * k for a, b in zip(c, t))
        self.col = col
        rough = 0.9 if s.get("fur") else 0.6
        self.main = R.material("Main", col, roughness=rough, grunge=0.2, scale=5 if not s.get("robot") else 12,
                               metallic=0.7 if s.get("robot") else 0.0)
        self.dark = R.material("Dark", mix(col, (0, 0, 0), 0.7), roughness=0.55, grunge=0.15)
        self.acc = R.material("Accent", R.hex_color(s.get("accent", "#ffffff")), roughness=0.7, grunge=0.15, scale=6)
        self.black = R.material("Black", (0.01, 0.01, 0.015), roughness=0.15, grunge=0.0)
        self.white = R.material("White", (0.9, 0.9, 0.92), roughness=0.2, grunge=0.0)
        self.mouth = R.material("Mouth", (0.35, 0.03, 0.05), roughness=0.5, grunge=0.0)
        self.tooth = R.material("Tooth", R.hex_color("#f4ecd6"), roughness=0.4, grunge=0.1)
        self.horn = R.material("Horn", R.hex_color("#e8dcc0"), roughness=0.45, grunge=0.25)
        self.glow = R.material("Glow", R.hex_color(s.get("glow", "#ffffff")), emission=3.0, roughness=0.3, grunge=0.0)
        self.metal = R.material("Metal", R.hex_color("#8a8f9a"), metallic=0.9, roughness=0.35, grunge=0.3)
        self.gold = R.material("Gold", R.hex_color("#ffcc33"), metallic=0.9, roughness=0.3, grunge=0.15)

    # -- bones / parts
    def bone(self, name, head, tail, parent=None):
        self.bones[name] = (Vector(head), Vector(tail), parent)

    def _add(self, o, bone, mat):
        R.assign(o, mat)
        vg = o.vertex_groups.new(name=bone)
        vg.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
        self.parts.append(o)
        return o

    def ell(self, bone, c, r, mat, rot=(0, 0, 0), seg=None, rings=None):
        o = R.add_obj("uv_sphere", segments=seg or self.seg, ring_count=rings or self.rings, radius=1, location=c)
        o.scale = r
        o.rotation_euler = rot
        return self._add(o, bone, mat)

    def _orient(self, o, p0, p1):
        d = Vector(p1) - Vector(p0)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
        return d.length

    def limb(self, bone, p0, p1, r0, r1, mat, box=False):
        """smooth ellipsoid (or rounded box) spanning p0..p1; radius ~ mean(r0, r1)."""
        p0, p1 = Vector(p0), Vector(p1)
        r = (r0 + r1) / 2
        mid = (p0 + p1) / 2
        if box:
            o = R.add_obj("cube", size=1, location=mid)
            L = (p1 - p0).length
            o.scale = (r * 2, r * 2, L * 1.02)
            self._orient(o, p0, p1)
            R.bevel(o, r * 0.3, 2)
            return self._add(o, bone, mat)
        o = R.add_obj("uv_sphere", segments=self.seg, ring_count=self.rings, radius=1, location=mid)
        L = self._orient(o, p0, p1)
        o.scale = (r, r, max(r, L * 0.56))
        return self._add(o, bone, mat)

    def tube(self, bone, p0, p1, r0, r1, mat, verts=7):
        p0, p1 = Vector(p0), Vector(p1)
        o = R.add_obj("cone", vertices=verts, radius1=r0, radius2=r1, depth=(p1 - p0).length, location=(p0 + p1) / 2)
        self._orient(o, p0, p1)
        return self._add(o, bone, mat)

    def horn_at(self, bone, base, direction, r, length, mat=None, curl=0.5, up=(0, 0, 1)):
        mat = mat or self.horn
        d = Vector(direction).normalized()
        p1 = Vector(base) + d * length * 0.55
        d2 = (d + Vector(up) * curl).normalized()
        p2 = p1 + d2 * length * 0.5
        self.tube(bone, base, p1, r, r * 0.6, mat, 8)
        self.tube(bone, p1, p2, r * 0.6, 0.0, mat, 8)

    def teeth_row(self, bone, c, half_w, n, size, up, mat=None, y_curve=0.0):
        """row of cone teeth across X at c; up=True -> lower jaw row (tips up)."""
        mat = mat or self.tooth
        for i in range(n):
            f = (i / (n - 1) - 0.5) * 2 if n > 1 else 0
            p = Vector((c[0] + f * half_w, c[1] + y_curve * (f * f), c[2]))
            tip = p + Vector((0, 0, size if up else -size))
            self.tube(bone, p, tip, size * 0.32, 0.0, mat, 5)

    def lid(self, bone, c, r, mat, tilt):
        o = R.add_obj("uv_sphere", segments=10, ring_count=6, radius=1, location=c)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0.18], context="VERTS")
        bm.to_mesh(o.data)
        bm.free()
        o.scale = (r * 1.12, r * 1.12, r * 1.12)
        o.rotation_euler = (0, tilt, 0)
        return self._add(o, bone, mat)

    def eye(self, bone, c, r, style, sx, mood=0.0):
        """style: cute | angry | glow. c = eyeball centre; faces -Y. Eyeball + iris + pupil + specular + lid."""
        s = self.s
        c = Vector(c)
        if style == "glow":
            self.ell(bone, c, (r, r * 0.8, r), self.glow, seg=10, rings=6)
            self.ell(bone, c + Vector((0, -r * 0.62, 0)), (r * 0.2, r * 0.25, r * 0.75), self.black, seg=8, rings=4)
            self.lid(bone, c, r, self.main, -sx * math.radians(26))
            return
        if style == "cute":
            self.ell(bone, c, (r, r * 0.8, r * 1.05), self.black, seg=10, rings=7)
            self.ell(bone, c + Vector((sx * -r * 0.28, -r * 0.62, r * 0.38)), (r * 0.3, r * 0.2, r * 0.3), self.white, seg=8, rings=4)
            self.ell(bone, c + Vector((sx * r * 0.3, -r * 0.7, -r * 0.3)), (r * 0.13, r * 0.1, r * 0.13), self.white, seg=6, rings=4)
            self.lid(bone, c + Vector((0, 0.01, r * 0.12)), r, self.main, sx * math.radians(10))
            return
        # angry: white ball, coloured iris, slit pupil, heavy brow lid
        self.ell(bone, c, (r, r * 0.8, r), self.white, seg=10, rings=6)
        self.ell(bone, c + Vector((0, -r * 0.62, 0)), (r * 0.62, r * 0.28, r * 0.62), self.glow if s.get("glow") else self.acc, seg=8, rings=5)
        self.ell(bone, c + Vector((0, -r * 0.83, 0)), (r * 0.18, r * 0.12, r * 0.5), self.black, seg=6, rings=4)
        self.ell(bone, c + Vector((sx * -r * 0.25, -r * 0.9, r * 0.28)), (r * 0.14, r * 0.08, r * 0.14), self.white, seg=6, rings=4)
        self.lid(bone, c + Vector((0, 0.01, r * 0.05)), r, self.main, -sx * math.radians(30))

    def eyes(self, bone, hc, hr, style, size=0.2, spread=0.42, high=0.12):
        """place a pair of eyes on an ellipsoid head (hc centre, hr=(rx,ry,rz))."""
        for sx in (-1, 1):
            x = sx * hr[0] * spread
            z = hr[2] * high
            y = -hr[1] * math.sqrt(max(0.05, 1 - spread ** 2 - high ** 2)) * 0.93
            self.eye(bone, (hc[0] + x, hc[1] + y, hc[2] + z), min(hr) * size, style, sx)

    def finish(self):
        k = self.k
        for o in self.parts:
            o.location = o.location * k
            o.scale = o.scale * k
        self.bones = {n: (h * k, t * k, p) for n, (h, t, p) in self.bones.items()}


# ====================================================================================================== plans
def build_biped(rig, s):
    """natural height ~10 units. returns natural height."""
    pet = s["kind"] == "pet"
    bulk = s.get("bulk", 1.0) * s.get("chubby", 1.0)
    robot, blocky = s.get("robot"), s.get("blocky")
    M, A, D = rig.main, rig.acc, rig.dark
    ch = pet or s["plan"] == "chibi"
    lf, tf, hf = (0.22, 0.28, 0.27) if ch else (0.34, 0.30, 0.17)   # leg frac, torso frac, head radius frac
    if s.get("chubby"):
        lf, tf, hf = 0.26, 0.30, 0.2
    H = 10.0
    hip_z = H * lf
    tw = H * (0.13 if ch else 0.11) * bulk          # torso half width
    chest_z = hip_z + H * tf
    hr_ = H * hf
    neck_z = chest_z + hr_ * 0.15
    head_c = Vector((0, 0, neck_z + hr_ * 0.75))
    hdim = (hr_ * 1.05, hr_ * 0.95, hr_ * 0.92)
    box = bool(robot or blocky)
    # -- bones
    rig.bone("Root", (0, 0, 0), (0, 0, hip_z * 0.5))
    rig.bone("Hips", (0, 0, hip_z), (0, 0, hip_z + (chest_z - hip_z) * 0.4), "Root")
    rig.bone("Spine", (0, 0, hip_z + (chest_z - hip_z) * 0.4), (0, 0, chest_z), "Hips")
    rig.bone("Neck", (0, 0, chest_z), (0, 0, neck_z + hr_ * 0.2), "Spine")
    rig.bone("Head", (0, 0, neck_z + hr_ * 0.2), (0, 0, head_c.z + hdim[2]), "Neck")
    jaw_z = head_c.z - hdim[2] * 0.45
    has_jaw = s["kind"] != "pet" and not robot and s.get("teeth", 1) is not None and not s.get("helmet") and s.get("eyes") != "visor"
    if has_jaw:
        rig.bone("Jaw", (0, -hdim[1] * 0.1, jaw_z), (0, -hdim[1] * 0.95, jaw_z), "Head")
    arm_z = chest_z - H * 0.03
    arm_len = H * (0.17 if ch else 0.21) * (1.15 if s.get("fists") else 1.0)
    sh_x = tw * 1.25 + (H * 0.03 if s.get("shoulders") else 0)
    arm_r = H * (0.05 if ch else 0.055) * bulk * (1.25 if s.get("fists") else 1.0)
    leg_r = H * (0.06 if ch else 0.06) * bulk
    leg_x = tw * 0.55
    for sx, side in ((-1, "L"), (1, "R")):
        sh = Vector((sx * sh_x, 0, arm_z))
        el = Vector((sx * (sh_x + H * 0.02), -arm_len * 0.15, arm_z - arm_len))
        wr = Vector((sx * (sh_x + H * 0.02), -arm_len * 0.2, arm_z - arm_len * 2))
        rig.bone(f"Arm{side}_U", sh, el, "Spine")
        rig.bone(f"Arm{side}_L", el, wr, f"Arm{side}_U")
        hp = Vector((sx * leg_x, 0, hip_z))
        kn = Vector((sx * leg_x, -hip_z * 0.05, hip_z * 0.5))
        ft = Vector((sx * leg_x, 0, hip_z * 0.07))
        rig.bone(f"Leg{side}_U", hp, kn, "Hips")
        rig.bone(f"Leg{side}_L", kn, ft, f"Leg{side}_U")
        # arm meshes
        rig.limb(f"Arm{side}_U", sh, el, arm_r * 1.15, arm_r, M, box=box)
        rig.ell(f"Arm{side}_U", sh, (arm_r * 1.2, arm_r * 1.2, arm_r * 1.2), M)
        rig.limb(f"Arm{side}_L", el, wr, arm_r, arm_r * (1.5 if s.get("fists") else 0.9), M, box=box)
        hand_r = arm_r * (1.7 if s.get("fists") else 1.05)
        rig.ell(f"Arm{side}_L", wr + Vector((0, -arm_r * 0.2, -hand_r * 0.3)), (hand_r, hand_r, hand_r), A if not robot else rig.metal)
        if s.get("claws") or s.get("arm_claws"):
            for i in (-1, 0, 1):
                p = wr + Vector((i * hand_r * 0.55, -hand_r * 0.35, -hand_r * 0.7))
                rig.tube(f"Arm{side}_L", p, p + Vector((0, -hand_r * 0.2, -hand_r * 1.2)), hand_r * 0.3, 0.0, rig.horn, 5)
        if s.get("shoulders"):
            rig.ell(f"Arm{side}_U", sh + Vector((sx * arm_r * 0.5, 0, arm_r * 0.9)), (arm_r * 2.0, arm_r * 1.8, arm_r * 1.5),
                    rig.metal if s.get("armor") else (rig.dark if s.get("rock") else M))
            if s.get("rock") or s.get("armor"):
                rig.tube(f"Arm{side}_U", sh + Vector((sx * arm_r * 1.2, 0, arm_r * 1.8)), sh + Vector((sx * arm_r * 1.9, 0, arm_r * 4.0)),
                         arm_r * 0.6, 0.0, rig.horn if s.get("rock") else rig.metal, 6)
        # leg meshes
        rig.limb(f"Leg{side}_U", hp + Vector((0, 0, -0.1)), kn, leg_r * 1.2, leg_r, M, box=box)
        rig.ell(f"Leg{side}_U", kn, (leg_r * 1.05, leg_r * 1.05, leg_r * 1.05), M)
        rig.limb(f"Leg{side}_L", kn, ft + Vector((0, 0, leg_r * 0.4)), leg_r, leg_r * 0.85, M, box=box)
        fw = leg_r * 1.15
        rig.ell(f"Leg{side}_L", Vector((sx * leg_x, -leg_r * 0.7, fw * 0.55)), (fw, fw * 1.75, fw * 0.6), D if not ch else A)
        if s.get("claws"):
            for i in (-1, 0, 1):
                p = Vector((sx * leg_x + i * fw * 0.5, -fw * 2.3, fw * 0.4))
                rig.tube(f"Leg{side}_L", p + Vector((0, fw * 0.5, 0)), p + Vector((0, -fw * 0.5, -fw * 0.1)), fw * 0.28, 0.0, rig.horn, 5)
    # torso
    pel = Vector((0, 0, hip_z + H * 0.03))
    if box:
        rig.limb("Hips", Vector((0, 0, hip_z - 0.1)), Vector((0, 0, hip_z + H * 0.1)), tw * 0.85, tw * 0.85, M, box=True)
        rig.limb("Spine", Vector((0, 0, hip_z + H * 0.08)), Vector((0, 0, chest_z)), tw * 1.05, tw * 1.1, M, box=True)
    else:
        rig.ell("Hips", pel, (tw * 0.95, tw * 0.8, H * 0.07), M)
        rig.ell("Spine", Vector((0, 0, (hip_z + chest_z) / 2 + H * 0.02)), (tw * 1.15, tw * 0.9, (chest_z - hip_z) * 0.62), M)
    rig.ell("Spine", Vector((0, -tw * 0.45, (hip_z + chest_z) / 2)), (tw * 0.7, tw * 0.55, (chest_z - hip_z) * 0.46), A)   # belly/chest plate
    if s.get("core"):
        rig.ell("Spine", Vector((0, -tw * 0.85, (hip_z + chest_z) / 2 + H * 0.02)), (tw * 0.4, tw * 0.2, tw * 0.4), rig.glow)
    if s.get("armor"):
        rig.ell("Spine", Vector((0, -tw * 0.1, chest_z - H * 0.03)), (tw * 1.25, tw * 1.0, H * 0.05), rig.metal)
        rig.limb("Hips", Vector((0, -tw * 0.6, hip_z + H * 0.03)), Vector((0, -tw * 0.6, hip_z - H * 0.08)), tw * 0.5, tw * 0.5, rig.metal, box=True)
    if s.get("spikes"):
        n = s["spikes"]
        for i in range(n):
            z = hip_z + (chest_z - hip_z) * (i + 0.5) / n
            rig.tube("Spine", Vector((0, tw * 0.75, z)), Vector((0, tw * 1.7, z + H * 0.05)), tw * 0.22, 0.0, rig.horn, 5)
    if s.get("fur"):
        for i in range(8):
            a = i / 8 * math.tau
            p = Vector((math.cos(a) * tw * 1.1, math.sin(a) * tw * 0.9, chest_z - H * 0.02))
            rig.tube("Spine", p, p + Vector((math.cos(a) * tw * 0.4, math.sin(a) * tw * 0.3, -H * 0.1)), tw * 0.28, 0.0, A, 5)
    if s.get("scarf"):
        sc = R.material("Scarf", R.hex_color(s["scarf"]), roughness=0.8, grunge=0.2)
        o = R.add_obj("torus", major_radius=hr_ * 0.75, minor_radius=hr_ * 0.18, major_segments=14, minor_segments=6, location=(0, 0, neck_z + hr_ * 0.05))
        rig._add(o, "Neck", sc)
        rig.limb("Spine", Vector((hr_ * 0.5, -hr_ * 0.6, neck_z)), Vector((hr_ * 0.6, -hr_ * 0.7, neck_z - H * 0.14)), hr_ * 0.16, hr_ * 0.14, sc)
    if s.get("cape"):
        cape = R.material("Cape", R.hex_color(s.get("accent", "#2a0a30")), roughness=0.8, grunge=0.3)
        rig.bone("Cape", (0, tw, chest_z), (0, tw * 1.5, hip_z * 0.5), "Spine")
        rig.limb("Cape", Vector((0, tw * 1.05, chest_z)), Vector((0, tw * 1.8, hip_z * 0.4)), tw * 1.4, tw * 1.7, cape, box=False)
    # tail
    if s.get("tail") and ch:
        tl = H * (0.22 if s.get("bigtail") else 0.15)
        t0 = Vector((0, tw * 0.8, hip_z + H * 0.03))
        t1 = t0 + Vector((0, tl * 0.6, tl * 0.25))
        t2 = t1 + Vector((0, tl * 0.5, tl * 0.4))
        rig.bone("Tail1", t0, t1, "Hips")
        rig.bone("Tail2", t1, t2, "Tail1")
        tr = H * (0.055 if s.get("bigtail") else 0.04)
        rig.limb("Tail1", t0, t1, tr, tr * 0.9, M)
        rig.limb("Tail2", t1, t2, tr * 0.9, tr * 1.1 if s.get("bigtail") else tr * 0.5, A if s.get("bigtail") else M)
    # head
    rig.ell("Head", head_c, hdim, M)
    rig.ell("Neck", Vector((0, 0, chest_z + H * 0.01)), (hr_ * 0.4, hr_ * 0.4, hr_ * 0.25), M)
    mz = head_c.z - hdim[2] * 0.4
    eyes = s.get("eyes", "cute")
    if eyes == "visor":
        rig.ell("Head", head_c + Vector((0, -hdim[1] * 0.75, hdim[2] * 0.12)), (hdim[0] * 0.7, hdim[1] * 0.3, hdim[2] * 0.28), rig.glow, seg=12, rings=6)
        rig.ell("Head", head_c + Vector((0, -hdim[1] * 0.8, hdim[2] * 0.12)), (hdim[0] * 0.78, hdim[1] * 0.2, hdim[2] * 0.36), rig.black, seg=12, rings=6)
        rig.ell("Head", head_c + Vector((0, -hdim[1] * 0.84, hdim[2] * 0.14)), (hdim[0] * 0.6, hdim[1] * 0.16, hdim[2] * 0.18), rig.glow, seg=12, rings=6)
    else:
        rig.eyes("Head", head_c, hdim, eyes, size=0.24 if ch else 0.19, spread=0.4, high=0.14)
    if s.get("nose"):
        rig.tube("Head", head_c + Vector((0, -hdim[1] * 0.85, -hdim[2] * 0.05)), head_c + Vector((0, -hdim[1] * 1.7, -hdim[2] * 0.12)),
                 hdim[0] * 0.12, 0.0, R.material("Nose", R.hex_color(s["nose"]), grunge=0.1), 6)
    # mouth + teeth + jaw
    if has_jaw:
        jw = (hdim[0] * 0.78, hdim[1] * 0.78, hdim[2] * 0.26)
        rig.ell("Jaw", Vector((0, -hdim[1] * 0.45, jaw_z - hdim[2] * 0.05)), jw, M)
        rig.ell("Jaw", Vector((0, -hdim[1] * 0.45, jaw_z + hdim[2] * 0.12)), (jw[0] * 0.8, jw[1] * 0.8, jw[2] * 0.4), rig.mouth, seg=10, rings=5)
        nt = s.get("teeth", 4) or 0
        if nt:
            rig.teeth_row("Head", (0, -hdim[1] * 0.72, jaw_z + hdim[2] * 0.2), hdim[0] * 0.5, nt + 1, hdim[2] * 0.2, False, y_curve=hdim[1] * 0.25)
            rig.teeth_row("Jaw", (0, -hdim[1] * 0.72, jaw_z + hdim[2] * 0.1), hdim[0] * 0.5, nt, hdim[2] * 0.2, True, y_curve=hdim[1] * 0.25)
    elif not robot and not s.get("helmet") and eyes != "visor":
        rig.ell("Head", head_c + Vector((0, -hdim[1] * 0.88, -hdim[2] * 0.32)), (hdim[0] * 0.12, hdim[1] * 0.06, hdim[2] * 0.05), rig.black, seg=6, rings=4)
    # ears
    ears = s.get("ears")
    for sx in (-1, 1):
        nm = "Ear" + ("L" if sx < 0 else "R")
        if ears:
            rig.bone(nm, head_c + Vector((sx * hdim[0] * 0.6, 0, hdim[2] * 0.7)), head_c + Vector((sx * hdim[0] * 0.8, 0, hdim[2] * 1.5)), "Head")
        if ears == "cat" or ears == "fox":
            h = hdim[2] * (0.75 if ears == "cat" else 1.05)
            b = head_c + Vector((sx * hdim[0] * 0.62, 0, hdim[2] * 0.72))
            rig.tube(nm, b, b + Vector((sx * hdim[0] * 0.25, 0, h)), hdim[0] * 0.3, 0.0, M, 4)
            rig.tube(nm, b + Vector((0, -hdim[1] * 0.1, 0)), b + Vector((sx * hdim[0] * 0.22, -hdim[1] * 0.06, h * 0.8)), hdim[0] * 0.18, 0.0, A, 4)
        elif ears == "bunny":
            b = head_c + Vector((sx * hdim[0] * 0.38, 0, hdim[2] * 0.85))
            rig.limb(nm, b, b + Vector((sx * hdim[0] * 0.15, 0, hdim[2] * 1.45)), hdim[0] * 0.2, hdim[0] * 0.2, M)
            rig.limb(nm, b + Vector((0, -hdim[1] * 0.1, hdim[2] * 0.1)), b + Vector((sx * hdim[0] * 0.14, -hdim[1] * 0.1, hdim[2] * 1.25)), hdim[0] * 0.1, hdim[0] * 0.1, A)
        elif ears == "round":
            b = head_c + Vector((sx * hdim[0] * 0.78, 0, hdim[2] * 0.7))
            rig.ell(nm, b, (hdim[0] * 0.3, hdim[0] * 0.2, hdim[0] * 0.3), M)
            rig.ell(nm, b + Vector((0, -hdim[1] * 0.1, 0)), (hdim[0] * 0.18, hdim[0] * 0.12, hdim[0] * 0.18), A)
    # horns
    nh = s.get("horns", 0)
    if nh:
        for i in range(nh // 2 if nh >= 4 else 1):
            for sx in (-1, 1):
                if nh >= 4:
                    base = head_c + Vector((sx * hdim[0] * (0.45 + 0.28 * i), hdim[1] * 0.05 * i, hdim[2] * (0.82 - 0.2 * i)))
                    rig.horn_at("Head", base, (sx * (0.4 + 0.5 * i), -0.1, 0.9 - 0.4 * i), hdim[0] * 0.14, hdim[2] * (0.9 - 0.2 * i), curl=0.6)
                else:
                    base = head_c + Vector((sx * hdim[0] * 0.5, -hdim[1] * 0.08, hdim[2] * 0.82))
                    rig.horn_at("Head", base, (sx * 0.5, -0.15, 0.85), hdim[0] * 0.16, hdim[2] * (0.75 if not ch else 0.5), curl=0.7)
    if s.get("tusks") or s.get("fangs"):
        for sx in (-1, 1):
            b = head_c + Vector((sx * hdim[0] * 0.4, -hdim[1] * 0.7, jaw_z - hdim[2] * 0.05))
            rig.tube("Jaw" if has_jaw else "Head", b, b + Vector((sx * 0.1, -hdim[1] * 0.2, hdim[2] * 0.8)), hdim[0] * 0.1, 0.0, rig.horn, 6)
    if s.get("crown"):
        o = R.add_obj("cone", vertices=8, radius1=hr_ * 0.65, radius2=hr_ * 0.75, depth=hr_ * 0.28, location=(0, 0, head_c.z + hdim[2] * 0.95))
        rig._add(o, "Head", rig.gold)
        for i in range(8):
            a = i / 8 * math.tau
            p = Vector((math.cos(a) * hr_ * 0.7, math.sin(a) * hr_ * 0.7, head_c.z + hdim[2] * 1.05))
            rig.tube("Head", p, p + Vector((0, 0, hr_ * 0.4)), hr_ * 0.12, 0.0, rig.gold, 5)
    if s.get("helmet"):
        rig.ell("Head", head_c + Vector((0, 0.02, hdim[2] * 0.2)), (hdim[0] * 1.12, hdim[1] * 1.08, hdim[2] * 0.85), rig.metal)
        rig.ell("Head", head_c + Vector((0, -hdim[1] * 0.7, hdim[2] * 0.1)), (hdim[0] * 0.75, hdim[1] * 0.3, hdim[2] * 0.12), rig.glow, seg=10, rings=5)
    if s.get("antenna"):
        b = head_c + Vector((hdim[0] * 0.3, 0, hdim[2] * 0.9))
        rig.tube("Head", b, b + Vector((hdim[0] * 0.1, 0, hdim[2] * 0.8)), hdim[0] * 0.06, hdim[0] * 0.05, rig.metal, 6)
        rig.ell("Head", b + Vector((hdim[0] * 0.1, 0, hdim[2] * 0.9)), (hdim[0] * 0.14,) * 3, rig.glow, seg=8, rings=5)
    if s.get("flame"):
        for i, (x, h) in enumerate(((0, 1.0), (-0.3, 0.7), (0.3, 0.7))):
            b = head_c + Vector((x * hdim[0], hdim[1] * 0.05, hdim[2] * 0.9))
            fl = R.material("Flame", R.hex_color("#ffd040"), emission=3.0, grunge=0.0)
            rig.tube("Head", b, b + Vector((x * 0.2, 0, hdim[2] * (0.9 * h))), hdim[0] * 0.22, 0.0, fl, 6)
    if s.get("halo"):
        hm = R.material("Halo", R.hex_color(s["halo"]), emission=3.0, grunge=0.0)
        o = R.add_obj("torus", major_radius=hr_ * 0.7, minor_radius=hr_ * 0.07, major_segments=16, minor_segments=5, location=(0, 0, head_c.z + hdim[2] * 1.35))
        rig._add(o, "Head", hm)
    if s.get("crystals") or s.get("shards"):
        cm = rig.glow if s.get("shards") else R.material("Crystal", R.hex_color("#d8ffff"), roughness=0.1, grunge=0.0)
        for i in range(5):
            a = (i - 2) * 0.5
            p = Vector((math.sin(a) * tw * 1.2, tw * 0.9, chest_z + H * 0.05))
            rig.tube("Spine", p, p + Vector((math.sin(a) * tw * 0.9, tw * 0.6, H * (0.12 + 0.03 * (i % 2)))), tw * 0.25, 0.0, cm, 5)
    if s.get("gear"):
        o = R.add_obj("cylinder", vertices=10, radius=hr_ * 0.4, depth=hr_ * 0.18, location=(0, tw * 1.0, (hip_z + chest_z) / 2))
        o.rotation_euler = (math.radians(90), 0, 0)
        rig._add(o, "Spine", rig.metal)
    return H


def build_quad(rig, s):
    M, A, D = rig.main, rig.acc, rig.dark
    crab, lizard, dragon = s.get("crab"), s.get("lizard"), s.get("dragon")
    pet = s["kind"] == "pet"
    H = 6.0 if not (lizard or dragon) else 5.0
    bw = 1.5 if crab else 1.0           # body width factor
    leg_h = 2.1 if not (lizard or crab) else 1.2
    body_len = 4.0
    bz = leg_h + 0.9
    br = 1.15 * (1.25 if crab else 1.0)
    chest = Vector((0, -body_len * 0.28, bz))
    hipp = Vector((0, body_len * 0.28, bz))
    rig.bone("Root", (0, 0, 0), (0, 0, leg_h * 0.5))
    rig.bone("Hips", hipp, hipp + Vector((0, -0.01 - body_len * 0.1, 0.01)), "Root")
    rig.bone("Spine", (0, 0, bz), chest, "Hips")
    nc = Vector((0, -body_len * 0.5, bz + (0.2 if not crab else 0.3)))
    hd_c = Vector((0, -body_len * 0.72, bz + (0.55 if not crab else 0.5)))
    hr = Vector((1.05, 1.15, 0.95)) * (1.2 if pet else 1.0) * (0.8 if crab else 1.0)
    rig.bone("Neck", chest, nc, "Spine")
    rig.bone("Head", nc, hd_c + Vector((0, -0.05, 0)), "Neck")
    jaw_z = hd_c.z - hr.z * 0.42
    has_jaw = not crab
    if has_jaw:
        rig.bone("Jaw", (0, hd_c.y + hr.y * 0.5, jaw_z), (0, hd_c.y - hr.y * 0.9, jaw_z), "Head")
    # body
    rig.ell("Hips", hipp + Vector((0, 0.1, 0)), (br * bw, 1.45, br * 0.95), M)
    rig.ell("Spine", chest, (br * 1.05 * bw, 1.5, br), M)
    rig.ell("Spine", Vector((0, chest.y - 0.2, bz - br * 0.45)), (br * 0.7 * bw, 1.5, br * 0.55), A)   # belly
    if crab:
        rig.ell("Spine", Vector((0, 0, bz + 0.45)), (br * 1.5, 2.0, br * 0.7), rig.dark if False else M)
        for i in range(5):
            a = (i - 2) * 0.32
            p = Vector((math.sin(a) * br * 1.4, 0.2 + i * 0.1, bz + 1.0))
            rig.tube("Spine", p, p + Vector((math.sin(a) * 0.2, 0.2, 0.55)), 0.22, 0.0, rig.horn, 5)
    # legs
    reach = 0.0
    for sx, ss in ((-1, "L"), (1, "R")):
        for fb, pre, base in ((1, "F", chest), (-1, "B", hipp)):
            nm = f"{pre}{ss}"
            hx = sx * (br * 0.8 * bw)
            top = Vector((hx, base.y, bz - 0.2))
            if crab:
                kn = Vector((sx * (br * 1.9), base.y - 0.2 * fb, bz - 0.1))
                ft = Vector((sx * (br * 2.5), base.y - 0.6 * fb, 0.1))
            else:
                kn = Vector((hx + sx * 0.1, base.y + 0.25 * (1 if fb < 0 else -0.3), leg_h * 0.5))
                ft = Vector((hx + sx * 0.05, base.y - 0.2 * fb * 0 - 0.1, 0.12))
            rig.bone(f"{nm}_U", top, kn, "Spine" if fb > 0 else "Hips")
            rig.bone(f"{nm}_L", kn, ft, f"{nm}_U")
            lr = 0.34 if not crab else 0.22
            rig.limb(f"{nm}_U", top, kn, lr * 1.35, lr, M)
            rig.limb(f"{nm}_L", kn, ft + Vector((0, 0, 0.1)), lr, lr * 0.7, M)
            rig.ell(f"{nm}_L", Vector((ft.x, ft.y - 0.15, 0.17)), (lr * 1.2, lr * 1.9, 0.2), D)
            if s.get("claws") and not crab:
                for i in (-1, 0, 1):
                    p = Vector((ft.x + i * 0.14, ft.y - 0.5, 0.12))
                    rig.tube(f"{nm}_L", p, p + Vector((0, -0.3, -0.05)), 0.07, 0.0, rig.horn, 5)
    if crab and s.get("claws"):   # oversized front pincers on the front legs' feet
        for sx, ss in ((-1, "L"), (1, "R")):
            nm = f"F{ss}_L"
            c0 = Vector((sx * br * 2.5, chest.y - 0.9, 0.9))
            rig.ell(nm, c0, (0.7, 0.9, 0.55), M)
            rig.tube(nm, c0 + Vector((sx * 0.3, -0.5, 0.2)), c0 + Vector((sx * 0.1, -1.5, 0.5)), 0.3, 0.0, rig.horn, 6)
            rig.tube(nm, c0 + Vector((sx * 0.3, -0.5, -0.2)), c0 + Vector((sx * 0.1, -1.4, -0.3)), 0.26, 0.0, rig.horn, 6)
    # tail
    if s.get("tail"):
        tl = 2.2 if not (lizard or dragon) else 3.4
        t0 = hipp + Vector((0, 1.2, 0.1))
        t1 = t0 + Vector((0, tl * 0.5, 0.3))
        t2 = t1 + Vector((0, tl * 0.5, 0.2 if not (lizard or dragon) else -0.2))
        rig.bone("Tail1", t0, t1, "Hips")
        rig.bone("Tail2", t1, t2, "Tail1")
        rig.limb("Tail1", t0, t1, 0.5, 0.38, M)
        rig.limb("Tail2", t1, t2, 0.38, 0.12, M)
        if dragon or lizard:
            rig.tube("Tail2", t2, t2 + Vector((0, 0.8, 0.1)), 0.12, 0.0, rig.glow if lizard else rig.horn, 5)
    # head
    rig.ell("Head", hd_c, tuple(hr), M)
    if not crab:   # snout
        sn = hd_c + Vector((0, -hr.y * 0.85, -hr.z * 0.2))
        rig.ell("Head", sn, (hr.x * 0.6, hr.y * 0.55, hr.z * 0.4), M)
        rig.ell("Head", sn + Vector((0, -hr.y * 0.45, hr.z * 0.18)), (hr.x * 0.14, hr.y * 0.06, hr.z * 0.1), rig.black, seg=6, rings=4)
    eyes = s.get("eyes", "angry")
    if crab:
        for sx in (-1, 1):
            b = Vector((sx * 0.5, chest.y - 1.0, bz + 1.0))
            rig.tube("Head", b, b + Vector((sx * 0.1, -0.2, 0.7)), 0.12, 0.1, M, 6)
            rig.eye("Head", b + Vector((sx * 0.1, -0.2, 0.85)), 0.34, "angry", sx)
    else:
        rig.eyes("Head", hd_c, tuple(hr), eyes, size=0.22 if not pet else 0.26, spread=0.5, high=0.28)
    if has_jaw:
        jc = Vector((0, hd_c.y - hr.y * 0.55, jaw_z - 0.05))
        rig.ell("Jaw", jc, (hr.x * 0.55, hr.y * 0.7, hr.z * 0.22), M)
        rig.ell("Jaw", jc + Vector((0, 0, 0.12)), (hr.x * 0.42, hr.y * 0.6, hr.z * 0.1), rig.mouth, seg=8, rings=4)
        nt = s.get("teeth", 0) or 0
        if nt:
            rig.teeth_row("Head", (0, jc.y - hr.y * 0.35, jaw_z + hr.z * 0.14), hr.x * 0.42, nt, 0.22, False)
            rig.teeth_row("Jaw", (0, jc.y - hr.y * 0.35, jaw_z + hr.z * 0.06), hr.x * 0.38, nt - 1, 0.2, True)
    for i in range(s.get("horns", 0) // 2 if s.get("horns") else 0):
        for sx in (-1, 1):
            rig.horn_at("Head", hd_c + Vector((sx * hr.x * 0.55, hr.y * 0.1, hr.z * 0.75)), (sx * 0.5, 0.35, 0.8), 0.18, 1.3, curl=-0.2)
    # ears
    if not crab and not dragon and not lizard:
        for sx in (-1, 1):
            b = hd_c + Vector((sx * hr.x * 0.7, hr.y * 0.1, hr.z * 0.75))
            rig.tube("Head", b, b + Vector((sx * 0.3, 0.2, 0.9)), 0.34, 0.0, M, 4)
    if s.get("spikes"):
        n = s["spikes"]
        for i in range(n):
            y = hd_c.y + hr.y * 0.6 + i * (body_len * 0.95 / n)
            z = bz + br * 0.95 - (0.05 if i > n * 0.6 else 0)
            rig.tube("Spine" if i < n // 2 else "Hips", Vector((0, y, z)), Vector((0, y + 0.3, z + 0.65)), 0.22, 0.0, rig.horn if not s.get("lizard") else rig.glow, 5)
    if s.get("wings"):
        for sx, ss in ((-1, "L"), (1, "R")):
            wb = Vector((sx * 0.6, chest.y + 0.9, bz + br * 0.8))
            e1 = wb + Vector((sx * 1.8, 0.3, 1.8))
            e2 = e1 + Vector((sx * 1.9, 0.6, -0.4))
            rig.bone(f"Wing{ss}_1", wb, e1, "Spine")
            rig.bone(f"Wing{ss}_2", e1, e2, f"Wing{ss}_1")
            wm = R.material("WingSkin", R.hex_color(s["accent"]), roughness=0.5, grunge=0.2)
            rig.tube(f"Wing{ss}_1", wb, e1, 0.16, 0.12, M, 6)
            rig.tube(f"Wing{ss}_2", e1, e2, 0.12, 0.05, M, 6)
            membrane(rig, f"Wing{ss}_1", [wb + Vector((0, 0, 0)), e1, e1 + Vector((0, 1.5, -1.6)), wb + Vector((0, 1.5, -1.2))], wm)
            membrane(rig, f"Wing{ss}_2", [e1, e2, e2 + Vector((-sx * 0.2, 1.4, -1.6)), e1 + Vector((0, 1.5, -1.6))], wm)
    return H


def membrane(rig, bone, pts, mat, thick=0.04):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    f = bm.faces.new(vs)
    ex = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ex["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += thick
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("memb")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("memb", me)
    bpy.context.collection.objects.link(o)
    return rig._add(o, bone, mat)


def build_flyer(rig, s):
    M, A, D = rig.main, rig.acc, rig.dark
    pet = s["kind"] == "pet"
    drone, bat, wisp = s.get("drone"), s.get("bat"), s.get("wisp")
    hover = 2.0
    r = 1.6
    z = hover + r
    H = z + r * 1.2
    rig.bone("Root", (0, 0, 0), (0, 0, hover * 0.6))
    rig.bone("Body", (0, 0, z - r), (0, 0, z + r * 0.4), "Root")
    rig.bone("Head", (0, 0, z + r * 0.2), (0, 0, z + r * 0.9), "Body")
    has_jaw = bat
    if has_jaw:
        rig.bone("Jaw", (0, -r * 0.2, z - r * 0.15), (0, -r * 0.95, z - r * 0.15), "Head")
    rig.ell("Body", (0, 0, z), (r, r * 0.95, r * (0.85 if not wisp else 1.0)), M, seg=max(rig.seg, 12), rings=max(rig.rings, 8))
    rig.ell("Body", (0, -r * 0.45, z - r * 0.2), (r * 0.7, r * 0.6, r * 0.55), A)
    eyes = s.get("eyes", "angry")
    if drone:
        rig.ell("Head", (0, -r * 0.85, z + r * 0.05), (r * 0.52, r * 0.2, r * 0.52), rig.black, seg=12, rings=8)
        rig.ell("Head", (0, -r * 0.98, z + r * 0.05), (r * 0.36, r * 0.13, r * 0.36), rig.glow, seg=12, rings=8)
        rig.ell("Head", (r * 0.1, -r * 1.07, z + r * 0.18), (r * 0.1, r * 0.05, r * 0.1), rig.white, seg=6, rings=4)
        rig.bone("Ring", (0, 0, z), (0, 0, z + 0.3), "Body")
        o = R.add_obj("torus", major_radius=r * 1.25, minor_radius=r * 0.12, major_segments=24, minor_segments=7, location=(0, 0, z))
        rig._add(o, "Ring", rig.metal)
        for sx, ss in ((-1, "L"), (1, "R")):
            rig.bone(f"Rotor{ss}", (sx * r * 1.15, 0, z + r * 0.75), (sx * r * 1.15, 0, z + r * 1.15), "Body")
            rig.tube(f"Rotor{ss}", (sx * r * 1.15, 0, z + r * 0.5), (sx * r * 1.15, 0, z + r * 0.95), r * 0.14, r * 0.1, rig.metal, 8)
            for k in range(2):
                a = k * math.pi / 2
                bl = R.add_obj("cube", size=1, location=(sx * r * 1.15, 0, z + r * 1.0))
                bl.scale = (r * 1.2, r * 0.17, r * 0.04)
                bl.rotation_euler = (0, 0, a + math.radians(20))
                R.bevel(bl, r * 0.015, 1)
                rig._add(bl, f"Rotor{ss}", D)
        rig.tube("Head", (0, r * 0.2, z + r * 0.85), (0, r * 0.3, z + r * 1.5), r * 0.06, r * 0.05, rig.metal, 6)
        rig.ell("Head", (0, r * 0.3, z + r * 1.55), (r * 0.13,) * 3, rig.glow, seg=8, rings=5)
        for k in (-1, 1):
            rig.tube("Body", (k * r * 0.4, 0.2, z - r * 0.7), (k * r * 0.45, 0.4, z - r * 1.3), r * 0.1, r * 0.04, rig.metal, 6)
    else:
        rig.eyes("Head", Vector((0, 0, z + r * 0.12)), (r, r * 0.95, r * 0.85), eyes, size=0.22 if not pet else 0.26, spread=0.4, high=0.15)
    if bat:
        jc = Vector((0, -r * 0.55, z - r * 0.28))
        rig.ell("Jaw", jc, (r * 0.5, r * 0.5, r * 0.2), M)
        rig.ell("Jaw", jc + Vector((0, 0, 0.08)), (r * 0.4, r * 0.42, r * 0.09), rig.mouth, seg=8, rings=4)
        rig.teeth_row("Head", (0, -r * 0.68, z - r * 0.13), r * 0.35, 4, r * 0.17, False)
        rig.teeth_row("Jaw", (0, -r * 0.68, z - r * 0.2), r * 0.3, 3, r * 0.15, True)
        for sx in (-1, 1):
            b = Vector((sx * r * 0.55, 0, z + r * 0.7))
            rig.tube("Head", b, b + Vector((sx * 0.25, 0, r * 0.9)), r * 0.28, 0.0, M, 4)
            rig.tube("Head", b + Vector((0, -0.1, 0)), b + Vector((sx * 0.22, -0.1, r * 0.7)), r * 0.15, 0.0, A, 4)
    if wisp or pet:
        if not drone and not bat:
            for i in range(3):   # wisp tuft
                a = (i - 1) * 0.5
                b = Vector((math.sin(a) * r * 0.4, 0, z + r * 0.85))
                rig.tube("Head", b, b + Vector((math.sin(a) * 0.4, 0, r * 0.9)), r * 0.26, 0.0, A if i != 1 else M, 6)
    if bat or s.get("wings"):
        for sx, ss in ((-1, "L"), (1, "R")):
            wb = Vector((sx * r * 0.7, 0.1, z + 0.1))
            e1 = wb + Vector((sx * 2.4, 0.2, 1.1))
            e2 = e1 + Vector((sx * 2.4, 0.4, -0.9))
            rig.bone(f"Wing{ss}_1", wb, e1, "Body")
            rig.bone(f"Wing{ss}_2", e1, e2, f"Wing{ss}_1")
            wm = R.material("WingSkin", R.hex_color(s["accent"]), roughness=0.5, grunge=0.2)
            rig.tube(f"Wing{ss}_1", wb, e1, 0.2, 0.14, M, 6)
            rig.tube(f"Wing{ss}_2", e1, e2, 0.14, 0.05, M, 6)
            membrane(rig, f"Wing{ss}_1", [wb + Vector((0, 0, -0.1)), e1, e1 + Vector((0, 1.2, -2.0)), wb + Vector((0, 1.0, -1.5))], wm)
            membrane(rig, f"Wing{ss}_2", [e1, e2, e2 + Vector((-sx * 0.2, 1.2, -1.8)), e1 + Vector((0, 1.2, -2.0))], wm)
            for kk, p in enumerate((e2,)):
                rig.tube(f"Wing{ss}_2", p, p + Vector((sx * 0.1, 0.3, -0.5)), 0.08, 0.0, rig.horn, 5)
    if s.get("tail"):
        t0 = Vector((0, r * 0.8, z - r * 0.3))
        t1 = t0 + Vector((0, r * 0.9, -r * 0.3))
        rig.bone("Tail1", t0, t1, "Body")
        rig.limb("Tail1", t0, t1, r * 0.4, r * 0.1, M)
    return H


def build_blob(rig, s):
    M, A = rig.main, rig.acc
    wide = s.get("wide", 1.0)
    tall = s.get("tall", 1.0)
    r = 1.8
    rig.bone("Root", (0, 0, 0), (0, 0, 0.3))
    rig.bone("Body", (0, 0, 0.1), (0, 0, r * 0.7), "Root")
    rig.bone("Top", (0, 0, r * 0.7), (0, 0, r * 1.5 * tall), "Body")
    rig.ell("Body", (0, 0, r * 0.55), (r * 1.2 * wide, r * 1.1 * wide, r * 0.72), M, seg=max(rig.seg, 14), rings=max(rig.rings, 9))
    rig.ell("Top", (0, 0, r * 0.95 * tall), (r * 0.85 * wide, r * 0.8 * wide, r * 0.55 * tall), M, seg=max(rig.seg, 12))
    rig.ell("Body", (0, 0, r * 0.25), (r * 0.5, r * 0.5, r * 0.28), A)                      # glowing core visible through belly
    # face on Top
    hc = Vector((0, -r * 0.2, r * 0.95 * tall))
    hr = (r * 1.0 * wide, r * 0.95 * wide, r * 0.6 * tall)
    eyes = s.get("eyes", "cute")
    rig.eyes("Top", hc, hr, eyes, size=0.3, spread=0.42, high=0.2)
    mz = hc.z - hr[2] * 0.4
    my = hc.y - hr[1] * 0.85
    rig.ell("Top", (0, my, mz), (r * 0.32 * wide, r * 0.1, r * 0.13), rig.mouth, seg=10, rings=5)
    nt = s.get("teeth", 0)
    if nt:
        rig.teeth_row("Top", (0, my - 0.05, mz + r * 0.09), r * 0.26 * wide, nt, r * 0.13, False)
    # blobs (drips + bubbles)
    for i in range(4):
        a = i * math.tau / 4 + 0.5
        rig.ell("Body", (math.cos(a) * r * 1.15 * wide, math.sin(a) * r * 1.0 * wide, 0.18), (r * 0.24, r * 0.24, 0.2), M, seg=8, rings=5)
    rig.ell("Top", (r * 0.35, -r * 0.4, r * 1.35 * tall), (r * 0.13, r * 0.08, r * 0.1), rig.white, seg=6, rings=4)   # glossy highlight
    if s.get("spikes"):
        for i in range(s["spikes"]):
            a = i / s["spikes"] * math.tau
            p = Vector((math.cos(a) * r * 0.55 * wide, math.sin(a) * r * 0.5 * wide, r * 1.3 * tall))
            rig.tube("Top", p, p + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, r * 0.5)), r * 0.15, 0.0, rig.horn, 5)
    if s.get("antenna"):
        b = Vector((0, 0, r * 1.45 * tall))
        rig.tube("Top", b, b + Vector((0, 0, r * 0.8)), r * 0.05, r * 0.04, rig.metal, 6)
        rig.ell("Top", b + Vector((0, 0, r * 0.9)), (r * 0.17,) * 3, rig.glow, seg=8, rings=5)
    if s.get("crown"):
        o = R.add_obj("cone", vertices=10, radius1=r * 0.7, radius2=r * 0.8, depth=r * 0.3, location=(0, 0, r * 1.4 * tall))
        rig._add(o, "Top", rig.gold)
        for i in range(10):
            a = i / 10 * math.tau
            p = Vector((math.cos(a) * r * 0.75, math.sin(a) * r * 0.75, r * 1.5 * tall))
            rig.tube("Top", p, p + Vector((0, 0, r * 0.45)), r * 0.12, 0.0, rig.gold, 5)
        rig.ell("Top", (0, -r * 0.78, r * 1.45 * tall), (r * 0.16,) * 3, R.material("Ruby", R.hex_color("#ff3050"), emission=1.0, grunge=0), seg=8, rings=5)
    return r * 1.5 * tall + (r * 0.8 if s.get("antenna") else 0) + (r * 0.4 if s.get("crown") else 0)


PLANS = {"biped": build_biped, "chibi": build_biped, "quad": build_quad, "flyer": build_flyer, "blob": build_blob}


# ====================================================================================================== rigging
def make_armature(rig):
    arm_data = bpy.data.armatures.new("RigData")
    arm = bpy.data.objects.new("Rig", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    R.select_only([arm])
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    for name, (h, t, parent) in rig.bones.items():
        b = eb.new(name)
        b.head, b.tail = h, t
        if (t - h).length < 0.02:
            b.tail = h + Vector((0, 0, 0.05))
    for name, (h, t, parent) in rig.bones.items():
        if parent:
            eb[name].parent = eb[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def apply_pose(arm, pose, bones):
    """pose: bone -> dict(rot=(x,y,z deg about WORLD axes), loc=(world delta), scl=(x,y,z))."""
    for name, pb in arm.pose.bones.items():
        d = pose.get(name)
        pb.rotation_mode = "QUATERNION"
        if d is None:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
            continue
        M = arm.data.bones[name].matrix_local.to_3x3()
        Mi = M.inverted()
        rot = d.get("rot", (0, 0, 0))
        Rw = Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix()
        pb.rotation_quaternion = (Mi @ Rw @ M).to_quaternion()
        pb.location = Mi @ Vector(d.get("loc", (0, 0, 0)))
        pb.scale = d.get("scl", (1, 1, 1))


def key_all(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("scale", frame=frame)


# ------------------------------------------------------------------------------------------------------------ motion
def motion(plan, kind, clip, t, u, bones, s):
    """returns pose dict for clip at normalised time t (0..1). u = height/10 (world units per 'natural unit')."""
    sin, cos, pi = math.sin, math.cos, math.pi
    P = {}

    def put(b, rot=None, loc=None, scl=None):
        if b not in bones:
            return
        d = P.setdefault(b, {})
        if rot:
            r0 = d.get("rot", (0, 0, 0))
            d["rot"] = tuple(a + b_ for a, b_ in zip(r0, rot))
        if loc:
            l0 = d.get("loc", (0, 0, 0))
            d["loc"] = tuple(a + b_ for a, b_ in zip(l0, loc))
        if scl:
            d["scl"] = scl

    ph = 2 * pi * t
    sn, cs = sin(ph), cos(ph)
    heavy = s.get("bulk", 1.0) > 1.2
    if plan in ("biped", "chibi"):
        if clip == "Idle":
            put("Root", loc=(0, 0, 0.03 * u * sn))
            put("Spine", rot=(2.0 * sn, 0, 1.5 * sn))
            put("Head", rot=(-2.5 * sn, 0, 5 * sin(ph + 1)))
            put("Jaw", rot=(3 + 2 * sn, 0, 0))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Arm{sd}_U", rot=(1.5 * sn, sg * (4 + 2 * sn), 0))
                put(f"Arm{sd}_L", rot=(-6 - 3 * sn, 0, 0))
            put("Tail1", rot=(0, 0, 12 * sn))
            put("Tail2", rot=(0, 0, 18 * sin(ph - 0.8)))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Ear{sd}", rot=(0, sg * 6 * max(0, sin(ph * 2)), 0))
            put("Cape", rot=(4 * sn, 0, 0))
        elif clip == "Walk":
            amp = 24 if not heavy else 18
            put("Root", loc=(0, 0, 0.07 * u * cos(2 * ph)))
            for sd, sg in (("L", 1), ("R", -1)):
                p = ph if sd == "L" else ph + pi
                put(f"Leg{sd}_U", rot=(-amp * sin(p), 0, 0))
                put(f"Leg{sd}_L", rot=(amp * 1.2 * max(0, cos(p)), 0, 0))
                put(f"Arm{sd}_U", rot=(amp * 0.9 * sin(p), sg * 5, 0))
                put(f"Arm{sd}_L", rot=(-18 - 10 * max(0, -sin(p)), 0, 0))
            put("Spine", rot=(-3, 0, 5 * sn))
            put("Hips", rot=(0, 0, -5 * sn))
            put("Head", rot=(2, 0, -3 * sn))
            put("Jaw", rot=(2 + 2 * sn, 0, 0))
            put("Tail1", rot=(0, 0, 15 * sn))
            put("Tail2", rot=(0, 0, 20 * sin(ph - 1)))
            for sd in "LR":
                put(f"Ear{sd}", rot=(10 * cos(2 * ph), 0, 0))
            put("Cape", rot=(8 + 6 * cos(2 * ph), 0, 0))
        elif clip == "Attack":
            e = curve(t, [(0, 0), (0.3, -1), (0.5, 1), (0.75, 0.3), (1, 0)])
            ep = max(0, e)
            put("Root", loc=(0, -0.9 * u * ep, 0.1 * u * ep))
            put("Spine", rot=(-16 * e, 0, -12 * e))
            put("Hips", rot=(0, 0, 6 * e))
            put("Head", rot=(-10 * e, 0, 8 * e))
            put("Jaw", rot=(34 * ep, 0, 0))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Arm{sd}_U", rot=(-95 * e, sg * (20 + 10 * ep), 0))
                put(f"Arm{sd}_L", rot=(-30 * ep - 20 * (-min(0, e)), 0, 0))
                put(f"Leg{sd}_U", rot=((-18 if sd == "L" else 14) * ep, 0, 0))
                put(f"Leg{sd}_L", rot=(14 * ep, 0, 0))
            put("Tail1", rot=(0, 0, 20 * e))
            put("Tail2", rot=(0, 0, 30 * e))
            for sd in "LR":
                put(f"Ear{sd}", rot=(-20 * ep, 0, 0))
            put("Cape", rot=(15 * ep, 0, 0))
        elif clip == "Hit":
            h = curve(t, [(0, 0), (0.25, 1), (1, 0)])
            put("Root", loc=(0, 0.35 * u * h, 0))
            put("Spine", rot=(24 * h, 0, 8 * h))
            put("Hips", rot=(-6 * h, 0, 0))
            put("Head", rot=(22 * h, 0, -10 * h))
            put("Jaw", rot=(24 * h, 0, 0))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Arm{sd}_U", rot=(25 * h, sg * 35 * h, 0))
                put(f"Arm{sd}_L", rot=(-25 * h, 0, 0))
                put(f"Leg{sd}_U", rot=(-8 * h, 0, 0))
            put("Tail1", rot=(-20 * h, 0, 0))
            for sd in "LR":
                put(f"Ear{sd}", rot=(25 * h, 0, 0))
        elif clip == "Death":
            d = curve(t, [(0, 0), (0.4, 0.45), (0.75, 1.0), (1, 1)])
            fall = curve(t, [(0, 0), (0.7, 1), (1, 1)])
            put("Root", rot=(88 * fall, 0, 0), loc=(0, 0.2 * u * fall, 0.55 * u * fall))
            put("Spine", rot=(10 * d, 0, 0))
            put("Head", rot=(20 * d, 0, 12 * d))
            put("Jaw", rot=(30 * d, 0, 0))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Arm{sd}_U", rot=(20 * d, sg * 55 * d, 0))
                put(f"Arm{sd}_L", rot=(-25 * d, 0, 0))
                put(f"Leg{sd}_U", rot=(-12 * d, sg * 14 * d, 0))
                put(f"Leg{sd}_L", rot=(15 * d, 0, 0))
            put("Tail1", rot=(-25 * d, 0, 0))
            for sd in "LR":
                put(f"Ear{sd}", rot=(40 * d, 0, 0))
        elif clip == "Hop":
            air = curve(t, [(0, 0), (0.18, -0.25), (0.45, 1), (0.72, 0), (0.82, -0.2), (1, 0)])
            a = max(0, air)
            cr = max(0, -air)
            put("Root", loc=(0, 0, (1.4 * a - 0.5 * cr) * u * 0.5))
            put("Spine", rot=(10 * cr - 12 * a, 0, 0))
            put("Head", rot=(-6 * cr + 8 * a, 0, 0))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Leg{sd}_U", rot=(-35 * cr - 25 * a, 0, 0))
                put(f"Leg{sd}_L", rot=(55 * cr + 25 * a, 0, 0))
                put(f"Arm{sd}_U", rot=(-20 * cr + 20 * a, sg * (15 + 45 * a), 0))
                put(f"Arm{sd}_L", rot=(-15, 0, 0))
                put(f"Ear{sd}", rot=(35 * a - 10 * cr, 0, 0))
            put("Tail1", rot=(-30 * a + 10 * cr, 0, 0))
            put("Tail2", rot=(-20 * a, 0, 0))
    elif plan == "quad":
        pet = kind == "pet"
        if clip == "Idle":
            put("Root", loc=(0, 0, 0.025 * u * sn))
            put("Spine", rot=(1.5 * sn, 0, 0))
            put("Neck", rot=(3 * sin(ph + 0.5), 0, 4 * sin(ph)))
            put("Head", rot=(-2 * sn, 0, 0))
            put("Jaw", rot=(4 + 3 * sn, 0, 0))
            put("Tail1", rot=(0, 0, 15 * sn))
            put("Tail2", rot=(0, 0, 22 * sin(ph - 0.9)))
            for sd in "LR":
                put(f"Wing{sd}_1", rot=(0, (4 if sd == "L" else -4) * sn, 0))
        elif clip in ("Walk", "Hop"):
            if clip == "Hop":
                air = curve(t, [(0, 0), (0.18, -0.25), (0.45, 1), (0.72, 0), (0.82, -0.2), (1, 0)])
                a, cr = max(0, air), max(0, -air)
                put("Root", loc=(0, 0, (1.3 * a - 0.4 * cr) * u * 0.5))
                put("Spine", rot=(-8 * a + 8 * cr, 0, 0))
                put("Head", rot=(8 * a, 0, 0))
                for nm in ("FL", "FR"):
                    put(f"{nm}_U", rot=(-35 * a - 20 * cr, 0, 0))
                    put(f"{nm}_L", rot=(30 * a + 40 * cr, 0, 0))
                for nm in ("BL", "BR"):
                    put(f"{nm}_U", rot=(30 * a + 25 * cr, 0, 0))
                    put(f"{nm}_L", rot=(-35 * a - 40 * cr, 0, 0))
                put("Tail1", rot=(-25 * a, 0, 0))
                put("Tail2", rot=(-20 * a, 0, 0))
                for sd, sg in (("L", 1), ("R", -1)):
                    put(f"Wing{sd}_1", rot=(0, sg * 35 * a, 0))
                    put(f"Wing{sd}_2", rot=(0, sg * 25 * a, 0))
            else:
                amp = 26
                crab = s.get("crab")
                put("Root", loc=(0, 0, 0.06 * u * cos(2 * ph)))
                for nm, p in (("FL", ph), ("BR", ph), ("FR", ph + pi), ("BL", ph + pi)):
                    if crab:   # sideways scuttle: legs swing about Y
                        sg = 1 if nm.endswith("L") else -1
                        put(f"{nm}_U", rot=(0, sg * 14 * sin(p), 0))
                        put(f"{nm}_L", rot=(0, sg * 10 * max(0, cos(p)), 0))
                    else:
                        put(f"{nm}_U", rot=(-amp * sin(p), 0, 0))
                        put(f"{nm}_L", rot=(amp * 1.3 * max(0, cos(p)), 0, 0))
                put("Spine", rot=(0, 0, 3 * sn))
                put("Hips", rot=(0, 0, -3 * sn))
                put("Neck", rot=(2 * cos(2 * ph), 0, -2 * sn))
                put("Jaw", rot=(5 + 3 * sn, 0, 0))
                put("Tail1", rot=(0, 0, 18 * sn))
                put("Tail2", rot=(0, 0, 25 * sin(ph - 1)))
                for sd, sg in (("L", 1), ("R", -1)):
                    put(f"Wing{sd}_1", rot=(0, sg * 10 * sn, 0))
        elif clip == "Attack":
            e = curve(t, [(0, 0), (0.3, -1), (0.5, 1), (0.75, 0.3), (1, 0)])
            ep = max(0, e)
            put("Root", loc=(0, -1.0 * u * ep, 0.1 * u * ep))
            put("Spine", rot=(10 * (-e) + 0, 0, 0))
            put("Neck", rot=(-18 * ep + 12 * (-min(0, e)), 0, 0))
            put("Head", rot=(-12 * ep + 10 * (-min(0, e)), 0, 0))
            put("Jaw", rot=(42 * ep, 0, 0))
            for nm in ("FL", "FR"):
                put(f"{nm}_U", rot=(-30 * ep + 20 * (-min(0, e)), 0, 0))
                put(f"{nm}_L", rot=(20 * ep, 0, 0))
            for nm in ("BL", "BR"):
                put(f"{nm}_U", rot=(14 * ep, 0, 0))
            put("Tail1", rot=(0, 0, 25 * e))
            put("Tail2", rot=(0, 0, 30 * e))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Wing{sd}_1", rot=(0, sg * 30 * ep, 0))
        elif clip == "Hit":
            h = curve(t, [(0, 0), (0.25, 1), (1, 0)])
            put("Root", loc=(0, 0.4 * u * h, 0))
            put("Spine", rot=(14 * h, 0, 6 * h))
            put("Neck", rot=(20 * h, 0, -10 * h))
            put("Head", rot=(14 * h, 0, 0))
            put("Jaw", rot=(28 * h, 0, 0))
            for nm in ("FL", "FR"):
                put(f"{nm}_U", rot=(18 * h, 0, 0))
            put("Tail1", rot=(-20 * h, 0, 0))
        elif clip == "Death":
            d = curve(t, [(0, 0), (0.4, 0.45), (0.75, 1.0), (1, 1)])
            fall = curve(t, [(0, 0), (0.7, 1), (1, 1)])
            put("Root", rot=(0, 85 * fall, 0), loc=(0.3 * u * fall, 0, 0.45 * u * fall))
            put("Neck", rot=(15 * d, 0, 10 * d))
            put("Jaw", rot=(30 * d, 0, 0))
            for nm in ("FL", "FR"):
                put(f"{nm}_U", rot=(-35 * d, 0, 0))
                put(f"{nm}_L", rot=(40 * d, 0, 0))
            for nm in ("BL", "BR"):
                put(f"{nm}_U", rot=(35 * d, 0, 0))
                put(f"{nm}_L", rot=(-30 * d, 0, 0))
            put("Tail1", rot=(0, 0, 25 * d))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Wing{sd}_1", rot=(0, sg * 40 * d, 0))
    elif plan == "flyer":
        fl = 38
        if clip in ("Idle", "Walk", "Hop"):
            speed = 1 if clip != "Walk" else 2
            ph2 = ph * speed
            hop = 0
            if clip == "Hop":
                air = curve(t, [(0, 0), (0.18, -0.2), (0.45, 1), (0.72, 0), (0.82, -0.15), (1, 0)])
                put("Root", loc=(0, 0, 0.7 * u * air))
                put("Body", rot=(-10 * max(0, air), 0, 0))
                ph2 = ph * 2
            else:
                put("Root", loc=(0, 0, 0.18 * u * sin(ph2)))
            put("Body", rot=(3 * sin(ph2 + 0.5), 0, 0))
            put("Head", rot=(-4 * sin(ph2 + 0.5), 0, 4 * sin(ph)))
            put("Jaw", rot=(5 + 4 * sin(ph2), 0, 0))
            put("Tail1", rot=(0, 0, 18 * sin(ph2 - 0.5)))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Wing{sd}_1", rot=(0, sg * fl * sin(ph2), 0))
                put(f"Wing{sd}_2", rot=(0, sg * fl * 0.7 * sin(ph2 - 0.9), 0))
            put("Ring", rot=(0, 0, 360 * t))
            put("RotorL", rot=(0, 0, 360 * 2 * t))
            put("RotorR", rot=(0, 0, -360 * 2 * t))
        elif clip == "Attack":
            e = curve(t, [(0, 0), (0.3, -1), (0.5, 1), (0.75, 0.3), (1, 0)])
            ep = max(0, e)
            put("Root", loc=(0, -1.4 * u * ep, -0.5 * u * ep + 0.4 * u * (-min(0, e))))
            put("Body", rot=(-28 * ep + 20 * (-min(0, e)), 0, 0))
            put("Head", rot=(-12 * ep, 0, 0))
            put("Jaw", rot=(40 * ep, 0, 0))
            put("Tail1", rot=(0, 0, 20 * e))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Wing{sd}_1", rot=(0, sg * (50 * (-e) if e < 0 else -20 * e), 0))
                put(f"Wing{sd}_2", rot=(0, sg * (35 * (-e) if e < 0 else -10 * e), 0))
            put("Ring", rot=(0, 0, 360 * 3 * t))
            put("RotorL", rot=(0, 0, 360 * 3 * t))
            put("RotorR", rot=(0, 0, -360 * 3 * t))
        elif clip == "Hit":
            h = curve(t, [(0, 0), (0.25, 1), (1, 0)])
            put("Root", loc=(0, 0.5 * u * h, 0.1 * u * h))
            put("Body", rot=(25 * h, 0, 12 * h))
            put("Head", rot=(20 * h, 0, 0))
            put("Jaw", rot=(25 * h, 0, 0))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Wing{sd}_1", rot=(0, sg * 40 * h, 0))
            put("Ring", rot=(0, 0, 180 * t))
        elif clip == "Death":
            fall = curve(t, [(0, 0), (0.8, 1), (1, 1)])
            put("Root", rot=(75 * fall, 0, 0), loc=(0, 0.2 * u * fall, -1.1 * u * fall))
            put("Body", rot=(0, 0, 25 * fall))
            put("Jaw", rot=(30 * fall, 0, 0))
            for sd, sg in (("L", 1), ("R", -1)):
                put(f"Wing{sd}_1", rot=(0, sg * -45 * fall, 0))
                put(f"Wing{sd}_2", rot=(0, sg * -30 * fall, 0))
    elif plan == "blob":
        sq = lambda a, k=0.1: (1 + k * a, 1 + k * a, 1 - k * 1.4 * a)
        if clip == "Idle":
            put("Body", loc=(0, 0, 0), scl=sq(sn, 0.05))
            put("Top", rot=(3 * sn, 0, 2 * sin(ph + 1)), loc=(0, 0, 0.03 * u * sn))
        elif clip in ("Walk", "Hop"):
            air = curve(t, [(0, 0), (0.18, -0.25), (0.45, 1), (0.72, 0), (0.82, -0.2), (1, 0)]) if clip == "Hop" else abs(sin(ph / 2))
            a, cr = max(0, air), max(0, -air)
            amp = 1.3 if clip == "Hop" else 0.5
            put("Root", loc=(0, 0, amp * a * u * 0.6))
            put("Body", scl=(1 + 0.12 * cr - 0.07 * a, 1 + 0.12 * cr - 0.07 * a, 1 - 0.25 * cr + 0.15 * a))
            put("Top", rot=(-10 * a + 8 * cr, 0, 3 * sin(ph)), loc=(0, 0, 0.1 * u * a))
        elif clip == "Attack":
            e = curve(t, [(0, 0), (0.3, -1), (0.5, 1), (0.75, 0.3), (1, 0)])
            ep = max(0, e)
            put("Root", loc=(0, -1.3 * u * ep, 0.15 * u * ep))
            put("Body", scl=(1 + 0.15 * (-min(0, e)) - 0.1 * ep, 1 + 0.15 * (-min(0, e)) + 0.25 * ep, 1 - 0.2 * (-min(0, e)) - 0.05 * ep))
            put("Top", rot=(-30 * ep + 14 * (-min(0, e)), 0, 0))
        elif clip == "Hit":
            h = curve(t, [(0, 0), (0.25, 1), (1, 0)])
            put("Root", loc=(0, 0.5 * u * h, 0))
            put("Body", scl=(1 + 0.22 * h, 1 + 0.22 * h, 1 - 0.35 * h))
            put("Top", rot=(25 * h, 0, 10 * h))
        elif clip == "Death":
            d = curve(t, [(0, 0), (0.35, 0.4), (0.8, 1), (1, 1)])
            put("Body", scl=(1 + 0.45 * d, 1 + 0.45 * d, 1 - 0.8 * d))
            put("Top", rot=(15 * d, 0, 0), loc=(0, 0, -1.2 * u * d))
    return P


def animate(arm, plan, kind, rig, s, H):
    u = H / 10.0
    bones = set(rig.bones)
    clips = CLIPS["pet" if kind == "pet" else "monster"]
    arm.animation_data_create()
    scene = bpy.context.scene
    scene.render.fps = FPS
    table = []
    for name, n, loop in clips:
        act = bpy.data.actions.new(name)
        arm.animation_data.action = act
        step = 3 if n <= 30 else 4
        frames = list(range(0, n, step))
        if frames[-1] != n - 1:
            frames.append(n - 1)
        for f in frames:
            t = f / (n - 1)
            apply_pose(arm, motion(plan, kind, name, t, u, bones, s), bones)
            key_all(arm, 1 + f)
        act.use_fake_user = True
        table.append((name, 1, n))
    # leave the first clip assigned
    arm.animation_data.action = bpy.data.actions[clips[0][0]]
    scene.frame_start, scene.frame_end = 1, max(n for _, n, _ in clips)
    return table


# ====================================================================================================== build one
def build(sid, s, out_dir):
    R.reset_scene()
    rig = Rig(s)
    plan = s["plan"]
    nat_h = PLANS[plan](rig, s)
    rig.k = s["height"] / nat_h
    rig.finish()
    H = s["height"]
    mesh = R.finalize(rig.parts, join_name=sid, smooth=False)[0]
    mesh.name = mesh.data.name = sid
    budget = {"boss": "boss", "pet": "pet"}.get(s["kind"], "monster")
    limit = R.TRI_BUDGET[budget]
    tris = len(mesh.data.polygons)
    if tris > limit:
        R.decimate_to(mesh, limit)
    R.origin_bottom(mesh) if False else None
    # centre X/Y, feet on Z=0 (do not move bones separately: shift both by the same delta)
    vs = [v.co for v in mesh.data.vertices]
    minz = min(v.z for v in vs)
    cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
    cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
    if abs(minz) > 1e-4 or abs(cx) > 1e-3 or abs(cy) > 1e-3:
        import mathutils
        mesh.data.transform(mathutils.Matrix.Translation((0, 0, -minz)))   # keep X/Y so bones stay aligned
        rig.bones = {n: (h + Vector((0, 0, -minz)), t + Vector((0, 0, -minz)), p) for n, (h, t, p) in rig.bones.items()}
    R.bake_albedo(mesh, os.path.join(out_dir, sid + ".png"), 512)
    R.smooth_by_angle(mesh, 50.0)
    arm = make_armature(rig)
    # skin: vertex groups already carry the bone name weights -> parent with empty groups
    R.select_only([mesh, arm])
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_NAME")
    table = animate(arm, plan, s["kind"], rig, s, H)
    apply_pose(arm, {}, set())
    mods = [m for m in mesh.modifiers if m.type == "ARMATURE"]
    print(f"[rbx] {sid} ({s['kind']}/{plan}) h={H} bones={len(rig.bones)} clips=" + ",".join(f"{n}:{a}-{b}" for n, a, b in table))
    R.check_budget([mesh], budget)
    R.export_fbx(os.path.join(out_dir, sid + ".fbx"), [mesh, arm], anim=True)
    return table


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--roster", choices=["monsters", "pets", "all"], default=None)
    p.add_argument("--only", default=None, help="one roster id")
    p.add_argument("--style", default=None, choices=["pet", "npc", "enemy", "boss", "blob", "drone"], help="legacy single creature")
    p.add_argument("--color", default="#ffb347")
    p.add_argument("--accent", default="#fff1d6")
    p.add_argument("--ears", default=None)
    p.add_argument("--height", type=float, default=None)
    p.add_argument("--crown", action="store_true")
    p.add_argument("--out", required=True)
    a = p.parse_args(R.cli_args())
    if a.style:   # legacy
        m = {"pet": ("chibi", "pet"), "npc": ("biped", "monster"), "enemy": ("biped", "monster"), "boss": ("biped", "boss"),
             "blob": ("blob", "monster"), "drone": ("flyer", "monster")}[a.style]
        s = spec(m[0], a.color, a.height or {"pet": 3, "npc": 5, "enemy": 4, "boss": 10, "blob": 3, "drone": 3.5}[a.style], m[1],
                 accent=a.accent, ears=a.ears if a.ears not in (None, "none") else None, crown=a.crown, eyes="cute" if a.style in ("pet", "npc") else "angry",
                 drone=a.style == "drone", tail=a.style == "pet")
        out = a.out if a.out.endswith(".fbx") else os.path.join(a.out, "creature.fbx")
        build(os.path.splitext(os.path.basename(out))[0], s, os.path.dirname(os.path.abspath(out)))
        return
    rosters = {"monsters": MONSTERS, "pets": PETS}
    pick = ["monsters", "pets"] if a.roster in (None, "all") else [a.roster]
    for rn in pick:
        for sid, s in rosters[rn].items():
            if a.only and a.only != sid:
                continue
            build(sid, s, a.out)


if __name__ == "__main__":
    main()
