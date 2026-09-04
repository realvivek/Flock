"""Wing network-closet vignette: a 1U gateway, a PoE switch with SFP cages, an SFP module cutaway,
a fiber cable cutaway, a CAT6 cutaway, and a bullet IP camera on a short arm.
Local frame: group origin at the front-bottom-left of the shelf; runtime places it in the world.
"""
import math
from lib import *

def build():
    steel = mat("rack_steel", (0.18, 0.19, 0.2), 0.7, 0.5)
    face = mat("appliance_face", (0.07, 0.07, 0.08), 0.3, 0.55)
    blue = mat("port_blue", (0.1, 0.35, 0.8), 0.2, 0.5)
    green = mat("link_led", (0.1, 0.9, 0.3), 0.0, 0.3, emission=(0.1, 0.9, 0.3), emission_strength=3.0)
    amber = mat("act_led", (0.9, 0.6, 0.1), 0.0, 0.3, emission=(0.9, 0.6, 0.1), emission_strength=3.0)
    sfp_m = mat("sfp_metal", (0.72, 0.72, 0.74), 1.0, 0.3)
    pcb = mat("sfp_pcb", (0.05, 0.16, 0.08), 0.0, 0.5)
    laser = mat("laser_diode", (0.9, 0.2, 0.2), 0.0, 0.3, emission=(1.0, 0.2, 0.1), emission_strength=4.0)
    jacket_y = mat("fiber_jacket", (0.85, 0.7, 0.1), 0.0, 0.7)
    aramid = mat("aramid", (0.9, 0.85, 0.5), 0.0, 0.9)
    buffer_m = mat("tight_buffer", (0.2, 0.5, 0.9), 0.0, 0.6)
    cladding = mat("cladding", (0.85, 0.9, 0.95), 0.0, 0.2, alpha=0.6)
    core = mat("core", (1.0, 0.95, 0.8), 0.0, 0.1, emission=(1.0, 0.9, 0.6), emission_strength=2.0)
    cat_jacket = mat("cat6_jacket", (0.2, 0.5, 0.9), 0.0, 0.7)
    copper = mat("copper", (0.85, 0.5, 0.3), 1.0, 0.35)
    ins = [mat(f"ins{i}", c, 0.0, 0.7) for i, c in enumerate(((0.9, 0.5, 0.1), (0.1, 0.6, 0.2), (0.15, 0.3, 0.9), (0.6, 0.3, 0.1)))]
    white_ins = mat("ins_white", (0.92, 0.92, 0.9), 0.0, 0.7)
    cam_m = mat("bullet_cam", (0.85, 0.86, 0.88), 0.4, 0.45)

    root = empty("wing_closet")
    shelf_w = 0.48
    # shelf and two 1U boxes
    box("shelf", (0.55, 0.32, 0.02), (0.275, 0.16, -0.01), steel, root)
    gw = empty("wing_gateway", (0.275, 0.16, 0.022), root)
    box("gateway_body", (shelf_w, 0.30, 0.044), (0, 0, 0), face, gw, bevel=0.003)
    box("gateway_bezel", (shelf_w, 0.004, 0.044), (0, -0.152, 0), steel, gw)
    for i in range(2):
        cyl(f"gateway_led{i}", 0.0025, 0.002, (-0.20 + i * 0.012, -0.155, 0.008), green if i == 0 else amber, gw, rot=(math.pi / 2, 0, 0), verts=10)
    box("gateway_rj45", (0.016, 0.004, 0.013), (0.18, -0.155, 0), blue, gw)
    box("gateway_label", (0.06, 0.001, 0.014), (-0.05, -0.1545, 0.004), mat("gw_label", (0.9, 0.9, 0.88), 0, 0.7), gw)

    sw = empty("poe_switch", (0.275, 0.16, 0.022 + 0.044 + 0.02), root)
    box("switch_body", (shelf_w, 0.26, 0.044), (0, 0, 0), face, sw, bevel=0.003)
    for i in range(8):
        box(f"switch_port{i}", (0.016, 0.004, 0.013), (-0.20 + i * 0.020, -0.132, 0.0), blue, sw)
        cyl(f"switch_led{i}", 0.0018, 0.002, (-0.20 + i * 0.020, -0.135, 0.012), green if i % 3 else amber, sw, rot=(math.pi / 2, 0, 0), verts=8)
    for i in range(2):
        box(f"switch_sfp_cage{i}", (0.016, 0.006, 0.010), (0.12 + i * 0.022, -0.133, 0.0), sfp_m, sw)
        box(f"switch_sfp_hole{i}", (0.013, 0.002, 0.008), (0.12 + i * 0.022, -0.136, 0.0), mat("hole", (0.01, 0.01, 0.01), 0, 1), sw)

    # Enlarged SFP module cutaway (x6 real size) on the shelf, half the housing removed
    sfp = empty("sfp_cutaway", (0.10, 0.02, 0.10), root)
    s = 6.0
    L, W, H = 0.0567 * s, 0.0137 * s, 0.0085 * s
    box("sfp_housing", (L, W, H / 2), (0, 0, -H / 4), sfp_m, sfp, bevel=0.002)
    box("sfp_pcb", (L * 0.85, W * 0.8, 0.0016 * s), (-0.02, 0, 0.0), pcb, sfp)
    box("sfp_edge_pads", (0.010 * s, W * 0.7, 0.0004 * s), (L / 2 - 0.006 * s, 0, 0.001 * s), mat("gold_fingers", (0.9, 0.7, 0.3), 1.0, 0.3), sfp)
    box("sfp_asic", (0.006 * s, 0.006 * s, 0.001 * s), (-0.005 * s, 0, 0.0016 * s), mat("asic", (0.05, 0.05, 0.06), 0.2, 0.4), sfp)
    cyl("sfp_tosa", 0.0022 * s, 0.010 * s, (-L / 2 + 0.010 * s, 0.003 * s, 0.001 * s), laser, sfp, rot=(0, math.pi / 2, 0), verts=16)
    cyl("sfp_rosa", 0.0022 * s, 0.010 * s, (-L / 2 + 0.010 * s, -0.003 * s, 0.001 * s), sfp_m, sfp, rot=(0, math.pi / 2, 0), verts=16)
    box("sfp_lc_port", (0.008 * s, W * 0.9, H * 0.7), (-L / 2 + 0.002 * s, 0, 0.0), mat("lc_port", (0.3, 0.45, 0.8), 0, 0.5), sfp)
    box("sfp_latch", (0.012 * s, 0.002 * s, 0.002 * s), (-L / 2 + 0.008 * s, 0, -H / 2 - 0.001 * s), sfp_m, sfp)

    # Fiber cable cutaway (x40), layers stepped back like a stripped end
    fb = empty("fiber_cutaway", (0.40, 0.05, 0.08), root)
    f = 40.0
    cyl("fiber_jacket", 0.0015 * f, 0.20, (-0.10, 0, 0), jacket_y, fb, rot=(0, math.pi / 2, 0), verts=32)
    cyl("fiber_aramid", 0.0011 * f, 0.10, (0.04, 0, 0), aramid, fb, rot=(0, math.pi / 2, 0), verts=32)
    cyl("fiber_buffer", 0.00045 * f, 0.10, (0.13, 0, 0), buffer_m, fb, rot=(0, math.pi / 2, 0), verts=24)
    cyl("fiber_cladding", 0.0000625 * f, 0.10, (0.22, 0, 0), cladding, fb, rot=(0, math.pi / 2, 0), verts=24)
    cyl("fiber_core", 0.0000045 * f * 6, 0.12, (0.30, 0, 0), core, fb, rot=(0, math.pi / 2, 0), verts=12)

    # CAT6 cutaway (x12): jacket, spline, four twisted pairs
    ct = empty("cat6_cutaway", (0.40, 0.18, 0.08), root)
    c = 12.0
    cyl("cat6_jacket", 0.0029 * c, 0.16, (-0.08, 0, 0), cat_jacket, ct, rot=(0, math.pi / 2, 0), verts=32)
    box("cat6_spline", (0.14, 0.0045 * c, 0.0005 * c), (0.07, 0, 0), white_ins, ct)
    box("cat6_spline2", (0.14, 0.0005 * c, 0.0045 * c), (0.07, 0, 0), white_ins, ct)
    for i, (py, pz) in enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1))):
        for j in range(2):
            m = ins[i] if j == 0 else white_ins
            cyl(f"cat6_wire{i}{j}", 0.00055 * c, 0.14, (0.07 + j * 0.006, py * 0.0013 * c + (0.0006 * c if j else -0.0006 * c) * py, pz * 0.0013 * c), m, ct, rot=(0, math.pi / 2, 0), verts=12)
        cyl(f"cat6_copper{i}", 0.00028 * c, 0.05, (0.165, py * 0.0013 * c, pz * 0.0013 * c), copper, ct, rot=(0, math.pi / 2, 0), verts=10)

    # Existing bullet IP camera on a short arm (the thing Wing ingests)
    cam = empty("existing_camera", (0.55, 0.30, 0.30), root)
    cyl("bullet_body", 0.035, 0.18, (0, 0, 0), cam_m, cam, rot=(0, math.pi / 2, 0), verts=24)
    cyl("bullet_hood", 0.040, 0.06, (-0.07, 0, 0.004), cam_m, cam, rot=(0, math.pi / 2, 0), verts=24)
    cyl("bullet_lens", 0.018, 0.01, (-0.095, 0, 0), mat("bullet_glass", (0.02, 0.02, 0.03), 0, 0.1), cam, rot=(0, math.pi / 2, 0), verts=24)
    box("bullet_arm", (0.02, 0.02, 0.10), (0.03, 0, -0.08), cam_m, cam)
    cyl("bullet_cat6", 0.004, 0.25, (0.09, 0, -0.10), cat_jacket, cam, rot=(0, math.pi / 2, 0), verts=8)
    return root
