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

# v2 budgets (detailed/smooth pass). gun<=4k, character/monster<=8k, boss<=12k, pet<=5k, prop<=2k.
TRI_BUDGET = {"prop": 2000, "hero_prop": 5000, "character": 8000, "monster": 8000, "boss": 12000, "pet": 5000,
              "gun": 4000, "vfx": 600, "zone_prop": 1200, "building": 8000}
ROBLOX_MESH_LIMIT = 20000  # hard limit per MeshPart


def cli_args():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else argv[1:]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "NONE"
    return scene


def material(name, color, emission=0.0, roughness=0.6, metallic=0.0, grunge=0.22, scale=7.0, wear=None):
    """PBR material. base colour gets procedural noise (grunge) + edge-scratch wear on metals; roughness varies.
    Everything is later baked to a <=512px albedo PNG by bake_albedo()/bake_atlas() (Roblox reads base colour)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    rgba = (*color, 1.0) if len(color) == 3 else color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if wear is None:
        wear = metallic > 0.4
    if grunge > 0 and not bsdf.inputs["Base Color"].links:
        n = nt.nodes
        tc = n.new("ShaderNodeTexCoord")
        noise = n.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = scale
        noise.inputs["Detail"].default_value = 8.0
        noise.inputs["Roughness"].default_value = 0.65
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        ramp = n.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[0].color = (1 - grunge, 1 - grunge, 1 - grunge, 1)
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        mix = n.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        mix.inputs[6].default_value = rgba
        nt.links.new(ramp.outputs["Color"], mix.inputs[7])
        last = mix.outputs[2]
        if wear:  # fine voronoi scratches: lighten thin cell edges (bare metal)
            vor = n.new("ShaderNodeTexVoronoi")
            vor.feature = "DISTANCE_TO_EDGE"
            vor.inputs["Scale"].default_value = scale * 5.0
            nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
            cr = n.new("ShaderNodeValToRGB")
            cr.color_ramp.elements[0].position = 0.0
            cr.color_ramp.elements[1].position = 0.06
            cr.color_ramp.elements[0].color = (1, 1, 1, 1)
            cr.color_ramp.elements[1].color = (0, 0, 0, 1)
            nt.links.new(vor.outputs["Distance"], cr.inputs["Fac"])
            m2 = n.new("ShaderNodeMix")
            m2.data_type = "RGBA"
            m2.blend_type = "ADD"
            m2.inputs[0].default_value = 0.10
            nt.links.new(last, m2.inputs[6])
            nt.links.new(cr.outputs["Color"], m2.inputs[7])
            last = m2.outputs[2]
        nt.links.new(last, bsdf.inputs["Base Color"])
        # roughness variation from the same noise
        rm = n.new("ShaderNodeMapRange")
        rm.inputs["From Min"].default_value = 0.0
        rm.inputs["From Max"].default_value = 1.0
        rm.inputs["To Min"].default_value = min(1.0, roughness + 0.12)
        rm.inputs["To Max"].default_value = max(0.05, roughness - 0.12)
        nt.links.new(noise.outputs["Fac"], rm.inputs["Value"])
        nt.links.new(rm.outputs["Result"], bsdf.inputs["Roughness"])
    else:
        bsdf.inputs["Base Color"].default_value = rgba
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


def bevel(obj, width=0.08, segments=2):
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


def finalize(objs, join_name=None, smooth=True):
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
        if smooth:
            smooth_by_angle(o, 38.0)
    return meshes


def smooth_by_angle(obj, angle=38.0):
    """Smooth shading + sharp edges above `angle` deg (replaces the removed auto-smooth). Call after triangulation."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    lim = math.radians(angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) < lim
        else:
            e.smooth = False
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def subsurf(obj, levels=1):
    mod = obj.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    return obj


def decimate_to(obj, max_tris):
    """Collapse-decimate a mesh to <= max_tris (keeps UV/vertex groups)."""
    select_only([obj])
    tris = sum(max(1, len(p.vertices) - 2) for p in obj.data.polygons)
    if tris <= max_tris:
        return obj
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = max(0.05, max_tris / tris * 0.98)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def _uv_unwrap(obj, margin=0.004):
    select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_albedo(obj, png_path, size=512, margin=6):
    """Bake the procedural base colour of ALL materials of one mesh into a single <=512px PNG (Cycles, 1 sample)
    and replace the materials with one textured material (image -> Base Color: exports through FBX).
    Skinned meshes keep their vertex groups; UVs are smart-projected."""
    size = min(int(size), 512)
    scene = bpy.context.scene
    _uv_unwrap(obj)
    img = bpy.data.images.new(os.path.splitext(os.path.basename(png_path))[0], size, size, alpha=False)
    for slot in obj.material_slots:
        m = slot.material
        m.use_nodes = True
        node = m.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        m.node_tree.nodes.active = node
        node.select = True
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    select_only([obj])
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=margin, use_clear=True)
    os.makedirs(os.path.dirname(os.path.abspath(png_path)), exist_ok=True)
    img.filepath_raw = os.path.abspath(png_path)
    img.file_format = "PNG"
    img.save()
    name = os.path.splitext(os.path.basename(png_path))[0]
    mat = bpy.data.materials.new(name + "_Mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Metallic"].default_value = 0.0
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.material_index = 0
    return mat


def bake_atlas(named, png_path, size=512):
    """Several separate meshes (dict name -> object) share ONE baked albedo atlas; they stay separate objects
    (named parts for animation) with a common material. Returns {name: object}."""
    objs = list(named.values())
    for name, o in named.items():
        vg = o.vertex_groups.new(name="PART_" + name)
        vg.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
    select_only(objs)
    bpy.ops.object.join()
    big = bpy.context.view_layer.objects.active
    mat = bake_albedo(big, png_path, size)
    names = list(named)
    out = {}
    for name in names[:-1]:
        before = set(bpy.data.objects)
        select_only([big])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        big.vertex_groups.active_index = big.vertex_groups["PART_" + name].index
        bpy.ops.object.vertex_group_select()
        bpy.ops.mesh.separate(type="SELECTED")
        bpy.ops.object.mode_set(mode="OBJECT")
        new = [o for o in bpy.data.objects if o not in before][0]
        new.name = new.data.name = name
        out[name] = new
    big.name = big.data.name = names[-1]
    out[names[-1]] = big
    for o in out.values():
        for g in list(o.vertex_groups):
            o.vertex_groups.remove(g)
    return out


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


def export_fbx(path, objs=None, anim=False):
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
        mesh_smooth_type="EDGE",
        add_leaf_bones=False,
        bake_anim=anim,
        bake_anim_use_all_actions=anim,
        bake_anim_use_nla_strips=False,
        bake_anim_force_startend_keying=True,
        bake_anim_step=1.0,
        bake_anim_simplify_factor=0.0,
        path_mode="COPY",
        embed_textures=True,
    )
    print(f"[rbx] exported {path}")


def add_obj(prim, **kw):
    getattr(bpy.ops.mesh, f"primitive_{prim}_add")(**kw)
    return bpy.context.active_object


def deg(d):
    return math.radians(d)
