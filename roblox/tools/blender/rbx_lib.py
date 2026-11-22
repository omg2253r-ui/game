"""Shared Blender helpers for Roblox assets.

Conventions (keep every asset consistent and lag-free):
  * 1 Blender unit = 1 stud. Import in Studio with the 3D Importer, "File Dimensions: Studs".
  * Low-poly, flat/vertex-colour or 1 small texture per mesh. Budgets in TRI_BUDGET.
  * Origin at the bottom-centre, transforms applied, triangulated before export.
Works with `blender -b -P script.py -- args` and with the `bpy` pip module (`python script.py args`).
"""
import math
import os
import sys

import bpy
import bmesh

TRI_BUDGET = {"prop": 1500, "hero_prop": 5000, "character": 6000, "vfx": 400, "building": 8000}
ROBLOX_MESH_LIMIT = 20000  # hard limit per MeshPart


def cli_args():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else argv[1:]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "NONE"
    return scene


def material(name, color, emission=0.0, roughness=0.6, metallic=0.0):
    """Flat PBR material. Roblox imports base colour; emission is used for glow props."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    rgba = (*color, 1.0) if len(color) == 3 else color
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission > 0:
        bsdf.inputs["Emission Color"].default_value = rgba
        bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = rgba
    return mat


def hex_color(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # Blender colour inputs are linear
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def bevel(obj, width=0.08, segments=1):
    """Cheap chunky bevel = the 'stylized Roblox' look for ~2x tris on boxes."""
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    return obj


def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def finalize(objs, join_name=None):
    """Apply modifiers + transforms, optional join, triangulate, origin to bottom-centre."""
    meshes = [o for o in objs if o.type == "MESH"]
    for o in meshes:
        select_only([o])
        for m in list(o.modifiers):
            if m.type != "ARMATURE":
                bpy.ops.object.modifier_apply(modifier=m.name)
    if join_name and len(meshes) > 1:
        select_only(meshes)
        bpy.ops.object.join()
        meshes = [bpy.context.view_layer.objects.active]
        meshes[0].name = join_name
    for o in meshes:
        select_only([o])
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(o.data)
        bm.free()
    return meshes


def origin_bottom(obj):
    """Call after finalize() (transforms applied): moves mesh so bottom-centre = origin."""
    import mathutils
    vs = [v.co for v in obj.data.vertices]
    cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
    cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
    minz = min(v.z for v in vs)
    obj.data.transform(mathutils.Matrix.Translation((-cx, -cy, -minz)))
    obj.location = (0, 0, 0)


def tri_count(objs):
    return sum(len(o.data.polygons) for o in objs if o.type == "MESH")


def check_budget(objs, kind="prop"):
    tris = tri_count(objs)
    budget = TRI_BUDGET.get(kind, 1500)
    status = "OK" if tris <= budget else ("OVER BUDGET" if tris <= ROBLOX_MESH_LIMIT else "EXCEEDS ROBLOX LIMIT")
    print(f"[rbx] {kind}: {tris} tris (budget {budget}) -> {status}")
    return tris <= ROBLOX_MESH_LIMIT


def export_fbx(path, objs=None):
    """FBX tuned for the Roblox 3D Importer (Y-up handled by importer, -Z forward)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    if objs:
        select_only(objs)
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=bool(objs),
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        axis_forward="-Z",
        axis_up="Y",
        object_types={"MESH", "ARMATURE"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        add_leaf_bones=False,
        bake_anim=False,
        path_mode="COPY",
        embed_textures=True,
    )
    print(f"[rbx] exported {path}")


def add_obj(prim, **kw):
    getattr(bpy.ops.mesh, f"primitive_{prim}_add")(**kw)
    return bpy.context.active_object


def deg(d):
    return math.radians(d)
