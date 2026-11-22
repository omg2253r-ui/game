"""VFX meshes for MeshPart-based effects (slashes, shockwaves, auras, beams).
UVs run 0->1 along the effect so a gradient/noise texture (tools/art/make_vfx.py) can be
scrolled/tweened in Studio. Keep VFX tiny: every mesh here is < 200 tris.

  blender -b -P make_vfx_mesh.py -- --type slash --out out/slash.fbx
  types: slash, ring, aura, beam, spike, all
"""
import argparse
import math
import os
import sys

import bpy
import bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rbx_lib as R  # noqa: E402


def strip_mesh(name, rows):
    """rows: list of (inner(x,y,z), outer(x,y,z)) along the effect; builds a UV'd ribbon."""
    me = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    verts = [(bm.verts.new(i), bm.verts.new(o)) for i, o in rows]
    n = len(rows) - 1
    for k in range(n):
        a, b = verts[k]
        c, d = verts[k + 1]
        f = bm.faces.new((a, b, d, c))
        for loop, (u, v) in zip(f.loops, ((k / n, 0), (k / n, 1), ((k + 1) / n, 1), ((k + 1) / n, 0))):
            loop[uv].uv = (u, v)
    bm.to_mesh(me)
    bm.free()
    return obj


def slash(_):
    rows = []
    for i in range(17):
        t = i / 16
        ang = math.radians(-70 + 140 * t)
        w = math.sin(t * math.pi) * 1.4 + 0.05  # thick middle, sharp ends
        r = 5
        rows.append(((math.cos(ang) * (r - w), math.sin(ang) * (r - w), 0), (math.cos(ang) * r, math.sin(ang) * r, 0)))
    return strip_mesh("Slash", rows)


def ring(_):
    rows = []
    for i in range(33):
        ang = 2 * math.pi * i / 32
        rows.append(((math.cos(ang) * 3.5, math.sin(ang) * 3.5, 0), (math.cos(ang) * 5, math.sin(ang) * 5, 0.4)))
    return strip_mesh("Ring", rows)


def aura(_):
    rows = []
    for i in range(25):
        ang = 2 * math.pi * i / 24
        rows.append(((math.cos(ang) * 2.2, math.sin(ang) * 2.2, 0), (math.cos(ang) * 1.6, math.sin(ang) * 1.6, 6)))
    return strip_mesh("Aura", rows)


def beam(_):
    o = R.add_obj("cylinder", vertices=8, radius=0.5, depth=10, location=(0, 0, 5), end_fill_type="NOTHING")
    o.name = "Beam"
    return o


def spike(_):
    o = R.add_obj("cone", vertices=6, radius1=1.2, depth=5, location=(0, 0, 2.5))
    o.name = "Spike"
    return o


BUILDERS = {f.__name__: f for f in (slash, ring, aura, beam, spike)}


def build(kind, out):
    R.reset_scene()
    o = BUILDERS[kind](None)
    R.assign(o, R.material("VFX", (1, 1, 1), emission=1.0))
    meshes = R.finalize([o])
    R.check_budget(meshes, "vfx")
    R.export_fbx(out, meshes)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--type", required=True, choices=list(BUILDERS) + ["all"])
    p.add_argument("--out", required=True)
    a = p.parse_args(R.cli_args())
    if a.type == "all":
        for k in BUILDERS:
            build(k, os.path.join(a.out, f"{k}.fbx"))
    else:
        build(a.type, a.out)


if __name__ == "__main__":
    main()
