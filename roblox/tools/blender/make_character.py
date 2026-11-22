"""Stylized chibi creature (pet / NPC / enemy / boss) with a simple armature, ready for the
Roblox 3D Importer as a rigged skinned mesh (animate it in Studio's Animation Editor).

  blender -b -P make_character.py -- --style pet --color "#ffb347" --ears cat --out out/pet.fbx
  styles: pet (tiny, big head), npc (biped), enemy (horns, spikes), boss (enemy x2.5, crown)
  ears:   none, cat, bunny, round
"""
import argparse
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rbx_lib as R  # noqa: E402

STYLE = {
    #        head, body, legLen, scale, biped
    "pet": (1.25, 0.8, 0.35, 1.0, False),
    "npc": (0.9, 0.9, 1.1, 1.6, True),
    "enemy": (1.0, 1.0, 0.6, 1.4, False),
    "boss": (1.0, 1.1, 0.7, 3.5, False),
}


def blob(name, radius, loc, mat, scale=(1, 1, 1), subdiv=2):
    o = R.add_obj("ico_sphere", subdivisions=subdiv, radius=radius, location=loc)
    o.name = name
    o.scale = scale
    R.assign(o, mat)
    R.shade_smooth(o)
    return o


def build(a):
    head_r, body_r, leg, k, biped = STYLE[a.style]
    main = R.material("Body", R.hex_color(a.color))
    belly = R.material("Belly", R.hex_color(a.accent))
    black = R.material("Eye", (0.01, 0.01, 0.01), roughness=0.2)
    white = R.material("EyeShine", (1, 1, 1), emission=1.0)
    parts = []

    body_z = leg + body_r * 0.8
    head_z = body_z + body_r * 0.7 + head_r * 0.75
    parts.append(blob("Body", body_r, (0, 0, body_z), main, (1, 0.9, 0.95), 3))
    parts.append(blob("Belly", body_r * 0.62, (0, -body_r * 0.5, body_z - 0.05), belly, (0.9, 0.5, 0.85)))
    parts.append(blob("Head", head_r, (0, 0, head_z), main, (1.05, 0.95, 0.92), 3))
    for sx in (-1, 1):  # eyes: big + shine = cute readability at small sizes
        parts.append(blob("Eye", head_r * 0.2, (sx * head_r * 0.38, -head_r * 0.82, head_z + 0.05), black, (1, 0.5, 1.25), 1))
        parts.append(blob("Shine", head_r * 0.06, (sx * head_r * 0.33, -head_r * 0.93, head_z + 0.15), white, subdiv=1))
        # legs / feet
        parts.append(blob("Leg", body_r * 0.32, (sx * body_r * 0.45, 0, leg * 0.5 + 0.1), main, (1, 1.1, max(1, leg * 1.6)), 1))
        if biped:  # arms
            parts.append(blob("Arm", body_r * 0.25, (sx * body_r * 1.05, 0, body_z + 0.1), main, (1, 1, 2.0), 1))
        if a.ears == "cat":
            e = R.add_obj("cone", vertices=4, radius1=head_r * 0.35, depth=head_r * 0.6,
                          location=(sx * head_r * 0.55, 0, head_z + head_r * 0.85), rotation=(0, sx * R.deg(-20), 0))
            parts.append(R.assign(e, main))
        elif a.ears == "bunny":
            parts.append(blob("Ear", head_r * 0.22, (sx * head_r * 0.35, 0, head_z + head_r * 1.2), main, (0.8, 0.5, 2.6), 1))
        elif a.ears == "round":
            parts.append(blob("Ear", head_r * 0.3, (sx * head_r * 0.7, 0, head_z + head_r * 0.7), main, (1, 0.5, 1), 1))
        if a.style in ("enemy", "boss"):
            h = R.add_obj("cone", vertices=6, radius1=head_r * 0.18, depth=head_r * 0.7,
                          location=(sx * head_r * 0.45, -head_r * 0.1, head_z + head_r * 0.95), rotation=(0, sx * R.deg(-25), 0))
            parts.append(R.assign(h, R.material("Horn", R.hex_color("#f4ead2"))))
    if a.style == "boss":
        crown = R.add_obj("cone", vertices=8, radius1=head_r * 0.5, radius2=head_r * 0.6, depth=head_r * 0.35,
                          location=(0, 0, head_z + head_r * 1.05))
        parts.append(R.assign(crown, R.material("Crown", R.hex_color("#ffcc33"), metallic=0.9, emission=0.3)))

    for o in parts:
        o.location = tuple(c * k for c in o.location)
        o.scale = tuple(c * k for c in o.scale)
    mesh = R.finalize(parts, join_name=a.style.capitalize())[0]
    R.origin_bottom(mesh)

    # armature: Root -> Body -> Head, plus legs; auto weights
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "Rig"
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    root = eb[0]
    root.name = "Root"
    root.head, root.tail = (0, 0, 0), (0, 0, leg * k * 0.5 + 0.01)

    def bone(name, head, tail, parent):
        b = eb.new(name)
        b.head, b.tail, b.parent = head, tail, parent
        return b

    torso = bone("Torso", (0, 0, leg * k), (0, 0, (body_z + body_r * 0.6) * k), root)
    bone("Head", (0, 0, (body_z + body_r * 0.6) * k), (0, 0, (head_z + head_r) * k), torso)
    for sx, side in ((-1, "L"), (1, "R")):
        bone("Leg" + side, (sx * body_r * 0.45 * k, 0, leg * k), (sx * body_r * 0.45 * k, 0, 0.05), root)
        if biped:
            bone("Arm" + side, (sx * body_r * 0.85 * k, 0, (body_z + 0.4) * k), (sx * body_r * 1.15 * k, 0, (body_z - 0.4) * k), torso)
    bpy.ops.object.mode_set(mode="OBJECT")
    R.select_only([mesh, arm])
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    R.check_budget([mesh], "character")
    return [mesh, arm]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--style", default="pet", choices=list(STYLE))
    p.add_argument("--color", default="#ffb347")
    p.add_argument("--accent", default="#fff1d6")
    p.add_argument("--ears", default=None, choices=["none", "cat", "bunny", "round"],
                   help="default: cat for pet/npc, none for enemy/boss")
    p.add_argument("--out", required=True)
    a = p.parse_args(R.cli_args())
    if a.ears is None:
        a.ears = "none" if a.style in ("enemy", "boss") else "cat"
    R.reset_scene()
    objs = build(a)
    R.export_fbx(a.out, objs)


if __name__ == "__main__":
    main()
