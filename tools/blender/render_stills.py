"""Render stills of the models for the mobile stepper and for style comparisons.
Usage: python3 tools/blender/render_stills.py <out_dir> [job ...]
Jobs: exploded, assembled, lineart, pole, part:<id>, dark
Renders with Cycles on CPU; transparent film with a shadow catcher so the same image
can sit on any page background.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import lib
from lib import reset, load_json, B

OUT = sys.argv[1] if len(sys.argv) > 1 else "renders"
JOBS = sys.argv[2:] or ["exploded", "assembled", "lineart", "pole", "part:som"]
os.makedirs(OUT, exist_ok=True)

def scene_setup(samples=96, w=1400, h=900, transparent=True):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.quality = 88
    sc.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    sc.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("w") if not sc.world else sc.world
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = 0.12

def light(name, loc, energy, size=2.0, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.size = size
    d.color = color
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o

def studio(center, radius):
    light("key", center + Vector((-radius * 2.0, -radius * 2.5, radius * 3.0)), 220 * radius * radius, size=radius * 1.2)
    light("fill", center + Vector((radius * 3.0, -radius * 1.5, radius * 1.5)), 50 * radius * radius, size=radius * 3, color=(0.9, 0.95, 1.0))
    light("rim", center + Vector((radius * 0.5, radius * 3.0, radius * 2.0)), 200 * radius * radius, size=radius * 0.6)
    light("top", center + Vector((0, 0, radius * 4.0)), 120 * radius * radius, size=radius * 4)

def shadow_catcher(z, size):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    p = bpy.context.active_object
    p.name = "catcher"
    p.is_shadow_catcher = True
    return p

def world_matrix(o):
    """Compose from matrix_basis up the parent chain; independent of depsgraph state in background mode."""
    m = o.matrix_basis.copy()
    p = o.parent
    while p is not None:
        m = p.matrix_basis @ m
        p = p.parent
    return m

def bbox(objs):
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        mw = world_matrix(o)
        for c in o.bound_box:
            w = mw @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi

def camera_for(objs, direction, fov_deg=32, pad=1.25, up_bias=0.0):
    lo, hi = bbox(objs)
    center = (lo + hi) / 2
    size = max(hi - lo)
    d = Vector(direction).normalized()
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens_unit = "FOV"
    cam_data.angle = math.radians(fov_deg)
    dist = (size * pad) / (2 * math.tan(math.radians(fov_deg) / 2))
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = center + d * dist + Vector((0, 0, up_bias * size))
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return center, size, lo

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("rendered", path)

def build_falcon(explode=0.0, isolate=None):
    import falcon, importlib
    importlib.reload(falcon)
    lib._mats.clear()
    root = falcon.build()
    comps = load_json("components.json")
    scale = load_json("animation.json")["explode"].get("scale", 1.0)
    for p in comps["parts"]:
        o = bpy.data.objects.get(p["node"])
        if o is None:
            continue
        ex = p["explode"]
        # runtime (x right, y up, z fwd) -> Blender (x, -z, y)
        o.location = o.location + Vector((ex[0], -ex[2], ex[1])) * scale * explode
        if isolate and p["id"] != isolate:
            for m in [o] + o.children_recursive:
                if m.type == "MESH":
                    m.hide_render = True
    return root

def job_exploded(dark=False):
    reset(); scene_setup(transparent=True)
    root = build_falcon(explode=1.0)
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    lo, hi = bbox(objs)
    center, size, lo = camera_for(objs, (-1.0, -0.55, 0.35), fov_deg=30, pad=1.3)
    studio(center, size)
    shadow_catcher(lo.z - 0.002, size * 8)
    render(os.path.join(OUT, "exploded.webp"))

def job_assembled():
    reset(); scene_setup(transparent=True, w=1000, h=1100)
    build_falcon(explode=0.0)
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    center, size, lo = camera_for(objs, (-0.8, -1.0, 0.45), fov_deg=28, pad=1.45)
    studio(center, size)
    shadow_catcher(lo.z - 0.002, size * 8)
    render(os.path.join(OUT, "assembled.webp"))

def job_part(pid):
    reset(); scene_setup(transparent=True, w=1000, h=800, samples=64)
    build_falcon(explode=1.0, isolate=pid)
    objs = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render]
    center, size, lo = camera_for(objs, (-0.7, -1.0, 0.7), fov_deg=26, pad=1.45)
    studio(center, size)
    render(os.path.join(OUT, f"part-{pid}.webp"))

def job_lineart():
    reset(); scene_setup(samples=32, transparent=True)
    build_falcon(explode=1.0)
    # flat white materials, freestyle black lines
    for m in bpy.data.materials:
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        if b:
            b.inputs["Base Color"].default_value = (0.97, 0.97, 0.97, 1)
            b.inputs["Metallic"].default_value = 0
            b.inputs["Roughness"].default_value = 1.0
            b.inputs["Emission Strength"].default_value = 0
            if "Alpha" in b.inputs: b.inputs["Alpha"].default_value = 1
        m.blend_method = "OPAQUE"
    sc = bpy.context.scene
    sc.render.use_freestyle = True
    sc.render.line_thickness = 1.6
    vl = sc.view_layers[0]
    vl.use_freestyle = True
    ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new("LineSet")
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new("ink")
    ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True; ls.select_contour = True
    ls.linestyle.color = (0.05, 0.05, 0.06)
    ls.linestyle.thickness = 1.6
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    center, size, lo = camera_for(objs, (-1.0, -0.55, 0.35), fov_deg=30, pad=1.3)
    light("flat", center + Vector((0, -size * 3, size * 3)), 60 * size * size, size=size * 6)
    render(os.path.join(OUT, "lineart.webp"))

def job_falcon(view="front"):
    reset(); scene_setup(transparent=True, w=1000, h=1100)
    build_falcon(explode=0.0)
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    d = (-0.55, -1.0, 0.4) if view == "front" else (-1.0, -0.35, 0.3)
    center, size, lo = camera_for(objs, d, fov_deg=28, pad=1.45)
    studio(center, size)
    shadow_catcher(lo.z - 0.002, size * 8)
    render(os.path.join(OUT, f"falcon-{view}.webp"))

def job_explode(amount=1.0):
    reset(); scene_setup(transparent=True, w=1400, h=900)
    build_falcon(explode=amount)
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    center, size, lo = camera_for(objs, (-1.0, -0.55, 0.35), fov_deg=30, pad=1.25)
    studio(center, size)
    shadow_catcher(lo.z - 0.002, size * 8)
    k = int(round(amount * 5))
    render(os.path.join(OUT, f"explode-{k}.webp"))

def job_wing():
    reset(); scene_setup(transparent=True, w=1400, h=1000)
    import wing, importlib
    importlib.reload(wing)
    lib._mats.clear()
    wing.build()
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    center, size, lo = camera_for(objs, (-0.9, -1.0, 0.7), fov_deg=32, pad=1.2)
    studio(center, size)
    shadow_catcher(lo.z - 0.002, size * 8)
    render(os.path.join(OUT, "wing-closet.webp"))

def job_pole_mode(mode="flock"):
    reset(); scene_setup(transparent=True, w=900, h=1300)
    import pole, falcon, importlib
    importlib.reload(pole); importlib.reload(falcon)
    lib._mats.clear()
    pole.build()
    hide = {"flock": ("utility_pole", "ac_kit"), "existing": ("ac_kit", "solar_array", "locate_flag"), "ac": ("solar_array", "battery_box", "locate_flag", "utility_solar")}[mode]
    for n in hide:
        o = bpy.data.objects.get(n)
        if o:
            for m in [o] + o.children_recursive:
                m.hide_render = True
    if mode != "flock":
        for n in ("pole_shaft", "pole_cap", "pole_coupling", "pole_baseplate", "pole_footing", "pole_bolt0", "pole_bolt1", "pole_bolt2", "pole_bolt3"):
            o = bpy.data.objects.get(n)
            if o: o.hide_render = True
    lib._mats.clear()
    f = falcon.build()
    inst = load_json("install.json")
    y = inst["pole"]["cameraHeightFt"] * lib.FT
    off = 0.10 if mode == "flock" else 0.10 + (0.14 - 0.0365)
    f.location = Vector(B(0, y, 0)) + Vector((0, -off, 0))
    f.rotation_euler = (0, 0, math.radians(-62))
    objs = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render]
    center, size, lo = camera_for(objs, (-1.2, -1.6, 0.5), fov_deg=30, pad=1.25)
    studio(center, size * 0.5)
    shadow_catcher(-0.001, 60)
    render(os.path.join(OUT, f"pole-{mode}.webp"))

def run_manifest(only=None):
    man = load_json("stills.json")
    for st in man["stills"]:
        if only and st["id"] not in only:
            continue
        if os.path.exists(os.path.join(OUT, st["file"])) and os.environ.get("STILLS_SKIP_EXISTING"):
            print("skip", st["id"]); continue
        j, a = st["job"], st.get("args", {})
        if j == "pole": job_pole_mode(a.get("mode", "flock"))
        elif j == "falcon": job_falcon(a.get("view", "front"))
        elif j == "explode": job_explode(float(a.get("amount", 1.0)))
        elif j == "part": job_part(a["part"])
        elif j == "wing": job_wing()

def job_pole():
    reset(); scene_setup(transparent=True, w=900, h=1300)
    import pole, falcon, importlib
    importlib.reload(pole); importlib.reload(falcon)
    lib._mats.clear()
    pole.build()
    for n in ("utility_pole", "ac_kit"):
        o = bpy.data.objects.get(n)
        if o:
            for m in [o] + o.children_recursive:
                m.hide_render = True
    lib._mats.clear()
    f = falcon.build()
    inst = load_json("install.json")
    y = inst["pole"]["cameraHeightFt"] * lib.FT
    f.location = Vector(B(0, y, 0)) + Vector((0, -0.10, 0))
    f.rotation_euler = (0, 0, math.radians(-62))
    objs = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render]
    center, size, lo = camera_for(objs, (-1.2, -1.6, 0.5), fov_deg=30, pad=1.3)
    studio(center, size * 0.5)
    shadow_catcher(-0.001, 40)
    render(os.path.join(OUT, "pole.webp"))

def main():
  if JOBS and JOBS[0] == "manifest":
      run_manifest(set(JOBS[1:]) or None)
      return
  for j in JOBS:
    if j == "exploded": job_exploded()
    elif j == "assembled": job_assembled()
    elif j == "lineart": job_lineart()
    elif j == "pole": job_pole()
    elif j.startswith("part:"): job_part(j.split(":", 1)[1])

if __name__ == "__main__":
    main()
