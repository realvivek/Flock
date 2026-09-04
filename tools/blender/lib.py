"""Helpers for building the models with Blender's Python API.

Coordinates: content files use the runtime's right-handed frame (X right, Y up, Z toward the road).
Blender is Z-up with Y forward, and the glTF exporter maps Blender (x, y, z) -> (x, z, -y).
So a runtime point (X, Y, Z) is authored in Blender at (X, -Z, Y). Use B() for that.
"""
import bpy, bmesh, math, os, json
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, "..", "..", "src", "content")
OUT = os.path.join(ROOT, "..", "..", "public", "models")
IN = 0.0254
FT = 0.3048

def B(x, y, z):
    """Runtime (X right, Y up, Z forward) -> Blender (x, -z, y)."""
    return (x, -z, y)

def load_json(name):
    with open(os.path.join(CONTENT, name), "r", encoding="utf8") as f:
        return json.load(f)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)

_mats = {}
def mat(name, color=(0.5, 0.5, 0.5), metallic=0.0, rough=0.6, emission=None, emission_strength=1.0, alpha=1.0):
    key = name
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    _mats[key] = m
    return m

def _finish(obj, name, material, parent=None, bevel=0.0, smooth=False, segments=3):
    obj.name = name
    if obj.data:
        obj.data.name = name
    if material is not None:
        if obj.data.materials:
            obj.data.materials[0] = material
        else:
            obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if parent is not None:
        obj.parent = parent
    return obj

def box(name, size, loc=(0, 0, 0), material=None, parent=None, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, name, material, parent, bevel)

def cyl(name, radius, depth, loc=(0, 0, 0), material=None, parent=None, rot=(0, 0, 0), verts=32, bevel=0.0, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    return _finish(obj, name, material, parent, bevel, smooth)

def tube(name, r_out, r_in, depth, loc=(0, 0, 0), material=None, parent=None, rot=(0, 0, 0), verts=32):
    """Hollow cylinder along local Z."""
    bm = bmesh.new()
    top = bmesh.ops.create_circle(bm, cap_ends=False, radius=r_out, segments=verts)
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    vo = [bm.verts.new((r_out * math.cos(2 * math.pi * i / verts), r_out * math.sin(2 * math.pi * i / verts), -depth / 2)) for i in range(verts)]
    vi = [bm.verts.new((r_in * math.cos(2 * math.pi * i / verts), r_in * math.sin(2 * math.pi * i / verts), -depth / 2)) for i in range(verts)]
    vo2 = [bm.verts.new((v.co.x, v.co.y, depth / 2)) for v in vo]
    vi2 = [bm.verts.new((v.co.x, v.co.y, depth / 2)) for v in vi]
    for i in range(verts):
        j = (i + 1) % verts
        bm.faces.new((vo[i], vo[j], vo2[j], vo2[i]))
        bm.faces.new((vi[j], vi[i], vi2[i], vi2[j]))
        bm.faces.new((vo[j], vo[i], vi[i], vi[j]))
        bm.faces.new((vo2[i], vo2[j], vi2[j], vi2[i]))
    bm.to_mesh(mesh)
    bm.free()
    obj.location = loc
    obj.rotation_euler = rot
    for p in mesh.polygons:
        p.use_smooth = True
    return _finish(obj, name, material, parent)

def torus(name, major, minor, loc=(0, 0, 0), material=None, parent=None, rot=(0, 0, 0), seg=32, ring=12):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot, major_segments=seg, minor_segments=ring)
    obj = bpy.context.active_object
    return _finish(obj, name, material, parent, 0.0, True)

def plane(name, sx, sy, loc=(0, 0, 0), material=None, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = (sx, sy, 1)
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, name, material, parent)

def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if parent is not None:
        obj.parent = parent
    return obj

def rounded_box(name, size, loc=(0, 0, 0), material=None, parent=None, radius=0.006, segments=4):
    return box(name, size, loc, material, parent, bevel=radius)

def export(filename, objects):
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
        for c in o.children_recursive:
            c.select_set(True)
    path = os.path.join(OUT, filename)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_normals=True, export_texcoords=False, export_animations=False,
        export_extras=True, export_cameras=False, export_lights=False,
    )
    print(f"wrote {path} ({os.path.getsize(path)//1024} KB)")

def sphere(name, radius, loc=(0, 0, 0), material=None, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=16, ring_count=8)
    return _finish(bpy.context.active_object, name, material, parent, 0.0, True)
