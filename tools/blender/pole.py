"""Pole assembly: breakaway pole and base, pole-top dual solar array, external battery box, AC junction box.
World frame, pole base at the origin. The Falcon itself lives in falcon.glb and is placed by the runtime.
"""
import math
from lib import *

def build():
    inst = load_json("install.json")
    pole_h = inst["pole"]["heightFt"] * FT
    r = inst["pole"]["odIn"] * IN / 2
    panel_l = inst["solar"]["lengthIn"] * IN
    panel_w = inst["solar"]["widthIn"] * IN

    black = mat("pole_black", (0.03, 0.03, 0.035), 0.4, 0.45)
    dark = mat("bracket_dark", (0.06, 0.06, 0.065), 0.5, 0.5)
    steel = mat("steel_pole", (0.7, 0.71, 0.72), 1.0, 0.3)
    cells = mat("solar_cells", (0.02, 0.03, 0.08), 0.6, 0.25)
    grid = mat("solar_grid", (0.75, 0.75, 0.78), 1.0, 0.4)
    frame = mat("solar_frame", (0.55, 0.56, 0.58), 1.0, 0.35)
    box_m = mat("battery_box", (0.05, 0.05, 0.055), 0.1, 0.5)
    label = mat("box_label", (0.9, 0.9, 0.88), 0.0, 0.7)
    concrete = mat("concrete", (0.45, 0.44, 0.42), 0.0, 0.9)
    yellow = mat("safety_yellow", (0.9, 0.7, 0.1), 0.0, 0.6)
    flag = mat("locate_flag", (0.95, 0.2, 0.1), 0.0, 0.7)
    grey = mat("ac_box", (0.55, 0.56, 0.57), 0.3, 0.5)
    led_g = mat("ac_led", (0.1, 0.9, 0.3), 0.0, 0.3, emission=(0.1, 0.9, 0.3), emission_strength=2.0)

    root = empty("pole_assembly")

    # Pole and breakaway base
    cyl("pole_shaft", r, pole_h, B(0, pole_h / 2, 0), black, root, verts=40)
    cyl("pole_cap", r + 0.004, 0.012, B(0, pole_h + 0.006, 0), black, root, verts=40)
    cyl("pole_coupling", r + 0.012, 0.16, B(0, 0.10, 0), dark, root, verts=40)
    box("pole_baseplate", (0.20, 0.20, 0.012), B(0, 0.006, 0), steel, root, bevel=0.002)
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cyl(f"pole_bolt{i}", 0.008, 0.03, (sx * 0.07, sy * 0.07, 0.02), steel, root, verts=12)
    cyl("pole_footing", 0.16, 0.05, B(0, -0.02, 0), concrete, root, verts=32)

    # 811 locate flag in the grass nearby (installer detail)
    fl = empty("locate_flag", B(0.6, 0, -0.5), root)
    cyl("flag_wire", 0.0015, 0.5, (0, 0, 0.25), steel, fl, verts=6)
    plane("flag_cloth", 0.09, 0.06, (0.045, 0, 0.47), flag, fl, rot=(math.pi / 2, 0, 0))

    # Pole-top solar array: two panels side by side on a tilted rack facing +X (south in the runtime frame)
    solar = empty("solar_array", B(0, pole_h + 0.02, 0), root)
    tilt = math.radians(30)
    rack = empty("solar_rack", (0, 0, 0.12), solar)
    rack.rotation_euler = (0, tilt, 0)          # tilt about Blender Y so the panel faces +X
    box("solar_mast", (0.06, 0.06, 0.24), (0, 0, 0.12), dark, solar, bevel=0.002)
    box("solar_rail", (panel_l + 0.02, 0.05, 0.02), (0, 0, 0), dark, rack)
    for i, off in enumerate((-panel_w / 4 - 0.01, panel_w / 4 + 0.01)):
        box(f"solar_frame{i}", (panel_l, panel_w / 2 - 0.02, 0.035), (0, off, 0.03), frame, rack, bevel=0.003)
        box(f"solar_cells{i}", (panel_l - 0.03, panel_w / 2 - 0.05, 0.004), (0, off, 0.049), cells, rack)
        # cell grid lines
        for k in range(1, 6):
            box(f"solar_gridx{i}{k}", (0.002, panel_w / 2 - 0.05, 0.001), (-panel_l / 2 + 0.015 + k * (panel_l - 0.03) / 6, off, 0.052), grid, rack)
        for k in range(1, 4):
            box(f"solar_gridy{i}{k}", (panel_l - 0.03, 0.002, 0.001), (0, off - (panel_w / 2 - 0.05) / 2 + k * (panel_w / 2 - 0.05) / 4, 0.052), grid, rack)
    box("solar_jbox", (0.10, 0.08, 0.03), (0, 0, -0.015), box_m, rack)

    # External battery box on the back of the pole (runtime -Z side), with band clamps
    bat = empty("battery_box", B(0, 2.45, -0.12), root)
    box("battery_enclosure", (0.25, 0.12, 0.35), (0, 0, 0), box_m, bat, bevel=0.006)
    box("battery_label", (0.08, 0.001, 0.05), (0.04, -0.0605, 0.08), label, bat)
    cyl("battery_gland", 0.008, 0.02, (0.06, 0, -0.18), dark, bat, verts=16)
    for i, z in enumerate((-0.10, 0.10)):
        torus(f"battery_band{i}", 0.0385, 0.0025, (0, 0.12, z), steel, bat, seg=40, ring=8)
    box("battery_bracket", (0.06, 0.06, 0.28), (0, 0.075, 0), dark, bat)

    # DC leads: panel -> battery box -> camera (thin tubes hugging the pole)
    cable = mat("cable_black", (0.02, 0.02, 0.02), 0.0, 0.7)
    cyl("cable_solar_down", 0.004, pole_h - 2.45 - 0.2, B(0, (pole_h + 2.45 + 0.2) / 2 - 0.1, -r - 0.006), cable, root, verts=8)
    cyl("cable_to_camera", 0.004, 0.55, B(0, 2.75, -r - 0.006), cable, root, verts=8)
    cyl("cable_into_camera", 0.004, 0.16, B(0, 2.98, 0.0), cable, root, rot=(math.pi / 2, 0, 0), verts=8)

    # AC junction box variant (hidden by default at runtime) on the back of the pole where the battery box sits
    ac = empty("ac_kit", B(0, 2.45, -0.12), root)
    box("ac_box", (0.18, 0.10, 0.22), (0, 0, 0), grey, ac, bevel=0.004)
    cyl("ac_led0", 0.004, 0.004, (0.05, -0.052, 0.06), led_g, ac, rot=(math.pi / 2, 0, 0), verts=12)
    cyl("ac_led1", 0.004, 0.004, (0.065, -0.052, 0.06), led_g, ac, rot=(math.pi / 2, 0, 0), verts=12)
    cyl("ac_conduit", 0.012, 2.45 - 0.11, (0, 0.06, -(2.45 - 0.11) / 2 - 0.11), grey, ac, verts=16)
    cyl("ac_conduit_elbow", 0.012, 0.3, (0, 0.20, -2.45 + 0.05), grey, ac, rot=(math.pi / 2, 0, 0), verts=16)
    box("ac_disconnect", (0.10, 0.06, 0.14), (0, 0.10, -1.30), grey, ac, bevel=0.003)
    box("ac_warning", (0.04, 0.001, 0.02), (0, -0.0505, -0.06), yellow, ac)

    # Existing wooden utility pole variant (hidden by default): 9 m class pole with a crossarm and a side-mount
    # solar bracket position. The Falcon and its clamps come from falcon.glb and simply wrap a larger diameter.
    wood = mat("utility_wood", (0.22, 0.16, 0.11), 0.0, 0.9)
    up = empty("utility_pole", B(0, 0, 0), root)
    cyl("utility_shaft", 0.14, 9.0, (0, 0, 4.5), wood, up, verts=28)
    box("utility_crossarm", (2.4, 0.09, 0.11), (0, 0, 8.4), wood, up)
    for i, x in enumerate((-1.0, -0.5, 0.5, 1.0)):
        cyl(f"utility_insulator{i}", 0.05, 0.16, (x, 0, 8.53), mat("insulator", (0.35, 0.4, 0.45), 0.2, 0.5), up, verts=12)
    # side-of-pole solar bracket for the existing-pole configuration, facing the road side (+Z runtime = -Y Blender)
    sb = empty("utility_solar", B(0, 4.6, -0.55), up)
    sb.rotation_euler = (0, math.radians(30), 0)
    box("utility_solar_arm", (0.06, 0.06, 0.5), (0, 0.35, 0.0), dark, sb, rot=(math.pi / 2, 0, 0))
    box("utility_solar_frame", (panel_l, panel_w, 0.035), (0, 0, 0.0), frame, sb, bevel=0.003)
    box("utility_solar_cells", (panel_l - 0.03, panel_w - 0.03, 0.004), (0, 0, 0.02), cells, sb)
    return root
