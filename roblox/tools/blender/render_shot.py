"""Render FBX models to a PNG with transparent background: hero shots for the game
thumbnail/icon (composited by tools/art/make_thumbnail.py) and item icons for the shop UI.

  blender -b -P render_shot.py -- --in out/pet.fbx out/chest.fbx --out shots/hero.png --size 1024 1024
  options: --angle 35 (yaw deg)  --tilt 15  --spread 1.2 (space between models)  --samples 32
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rbx_lib as R  # noqa: E402


def light(name, kind, energy, loc, color=(1, 1, 1), size=5):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.size = size
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    o.location = loc
    direction = Vector((0, 0, 1)) - o.location
    o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return o


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="inputs", nargs="+", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--size", nargs=2, type=int, default=[1024, 1024])
    p.add_argument("--angle", type=float, default=30)
    p.add_argument("--tilt", type=float, default=12)
    p.add_argument("--spread", type=float, default=1.2)
    p.add_argument("--samples", type=int, default=32)
    p.add_argument("--engine", choices=["cycles", "eevee"], default="cycles",
                   help="cycles works headless/CPU everywhere; eevee is faster but needs a GPU")
    a = p.parse_args(R.cli_args())

    scene = R.reset_scene()
    x = 0.0
    meshes = []
    for path in a.inputs:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=os.path.abspath(path))
        new = [o for o in bpy.data.objects if o not in before]
        for o in new:   # baked clips would override our layout/pose: render the rest pose
            o.animation_data_clear()
        roots = [o for o in new if o.parent is None]
        ms = [o for o in new if o.type == "MESH"]
        bpy.context.view_layer.update()
        wpts = [o.matrix_world @ Vector(c) for o in ms for c in o.bound_box]
        if not wpts:
            continue
        lo_x, hi_x = min(v.x for v in wpts), max(v.x for v in wpts)
        for r in roots:   # lay models out left->right by their real world bounds (rigged FBX import scale safe)
            r.location.x += x - lo_x
        x += (hi_x - lo_x) * a.spread
        meshes += ms
    bpy.context.view_layer.update()

    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(v.x for v in pts), min(v.y for v in pts), min(v.z for v in pts)))
    hi = Vector((max(v.x for v in pts), max(v.y for v in pts), max(v.z for v in pts)))
    center, radius = (lo + hi) / 2, (hi - lo).length / 2

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 70
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    yaw, tilt = math.radians(a.angle), math.radians(a.tilt)
    dist = radius / math.tan(cam_data.angle / 2) * 1.25
    cam.location = center + Vector((math.sin(yaw) * math.cos(tilt), -math.cos(yaw) * math.cos(tilt), math.sin(tilt))) * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    s = radius * 3
    light("Key", "AREA", 900 * radius, center + Vector((-s, -s, s)), (1.0, 0.95, 0.88), size=s)
    light("Fill", "AREA", 300 * radius, center + Vector((s, -s * 0.6, s * 0.3)), (0.75, 0.85, 1.0), size=s)
    light("Rim", "AREA", 1200 * radius, center + Vector((0, s, s * 0.8)), (1.0, 0.85, 1.0), size=s)
    world = bpy.data.worlds.new("W")
    if not world.node_tree:
        world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world

    if a.engine == "eevee":
        engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
        scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
        scene.eevee.taa_render_samples = a.samples
    else:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = a.samples
        scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = a.size
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"  # punchy colours like Roblox
    scene.view_settings.look = "None"
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    scene.render.filepath = os.path.abspath(a.out)
    bpy.ops.render.render(write_still=True)
    print(f"[rbx] rendered {a.out}")


if __name__ == "__main__":
    main()
