"""Falcon V2 enclosure and internals, built from src/content/components.json dimensions.
Local frame: origin at the body centre, lens facing runtime +Z (Blender -Y), up = Blender Z.
Node names match components.json `node` so the runtime can explode them.
"""
import math
from lib import *

def build():
    comps = load_json("components.json")
    env = comps["envelope"]
    W, H, D = env["widthIn"] * IN, env["heightIn"] * IN, env["depthIn"] * IN
    parts = {p["id"]: p for p in comps["parts"]}

    shell = mat("falcon_shell", (0.05, 0.052, 0.058), 0.0, 0.5)
    shell_in = mat("falcon_shell_inner", (0.16, 0.16, 0.17), 0.0, 0.8)
    glass = mat("falcon_glass", (0.02, 0.02, 0.03), 0.0, 0.08)
    pcb = mat("pcb_green", (0.10, 0.36, 0.18), 0.0, 0.45)
    pcb_dark = mat("pcb_dark", (0.10, 0.16, 0.22), 0.0, 0.45)
    chip = mat("chip", (0.12, 0.12, 0.14), 0.2, 0.35)
    can = mat("rf_can", (0.6, 0.6, 0.62), 1.0, 0.35)
    gold = mat("gold_pad", (0.9, 0.7, 0.3), 1.0, 0.3)
    ir = mat("ir_led", (0.35, 0.05, 0.05), 0.0, 0.3, emission=(0.9, 0.08, 0.05), emission_strength=2.0)
    amber = mat("sensor_dome", (0.9, 0.5, 0.1), 0.0, 0.2, emission=(0.6, 0.3, 0.05), emission_strength=0.6)
    lens_m = mat("lens_barrel", (0.05, 0.05, 0.05), 0.6, 0.3)
    steel = mat("steel", (0.7, 0.71, 0.72), 1.0, 0.3)
    white = mat("label", (0.92, 0.92, 0.9), 0.0, 0.7)
    solder = mat("solder", (0.75, 0.75, 0.75), 1.0, 0.25)

    root = empty("falcon")
    front_y = -D / 2          # face plane (Blender -Y is forward)
    back_y = D / 2
    lens_z = H * 0.27         # lens centre sits in the upper third

    # 1. Front bezel: a matte lower face plate, a glossy dark window over the upper half where the ring and
    #    lens sit, a thin frame, and a hood over the top.
    bez = empty(parts["bezel"]["node"], parent=root)
    win_h = H * 0.55
    box("bezel_lower", (W, 0.012, H - win_h), (0, front_y + 0.006, -H / 2 + (H - win_h) / 2), shell, bez, bevel=0.004)
    glass_win = mat("falcon_window", (0.02, 0.02, 0.03), 0.0, 0.06, alpha=0.42)
    box("bezel_window", (W - 0.006, 0.003, win_h - 0.006), (0, front_y + 0.0035, H / 2 - win_h / 2), glass_win, bez)
    box("bezel_frame_top", (W, 0.012, 0.006), (0, front_y + 0.006, H / 2 - 0.003), shell, bez)
    box("bezel_frame_l", (0.004, 0.012, win_h), (-W / 2 + 0.002, front_y + 0.006, H / 2 - win_h / 2), shell, bez)
    box("bezel_frame_r", (0.004, 0.012, win_h), (W / 2 - 0.002, front_y + 0.006, H / 2 - win_h / 2), shell, bez)
    box("bezel_hood", (W + 0.004, 0.028, 0.006), (0, front_y + 0.012, H / 2 + 0.002), shell, bez, bevel=0.002)
    box("bezel_plate", (W * 0.36, 0.001, 0.012), (0, front_y - 0.0005, -H * 0.36), shell_in, bez)

    # 2. LED board: disc with a central cutout and six emitters, plus the ambient light dome.
    led = empty(parts["ledboard"]["node"], parent=root)
    r_board = parts["ledboard"]["dims"]["diameter"] * IN / 2
    tube("ledboard_pcb", r_board, 0.0095, 0.0016, (0, front_y + 0.016, lens_z), pcb_dark, led, rot=(math.pi / 2, 0, 0), verts=48)
    for i in range(6):
        a = 2 * math.pi * i / 6 + math.pi / 6
        cx, cz = math.cos(a) * r_board * 0.66, math.sin(a) * r_board * 0.66
        cyl(f"ledboard_led{i}", 0.0035, 0.0045, (cx, front_y + 0.0135, lens_z + cz), ir, led, rot=(math.pi / 2, 0, 0), verts=16)
        cyl(f"ledboard_lens{i}", 0.0045, 0.0015, (cx, front_y + 0.0105, lens_z + cz), glass, led, rot=(math.pi / 2, 0, 0), verts=16)
    sphere("ledboard_ambient", 0.003, (r_board * 0.95, front_y + 0.0145, lens_z - r_board * 0.75), amber, led)

    # 3. Lens barrel (M12) through the ring.
    ln = empty(parts["lens"]["node"], parent=root)
    cyl("lens_barrel", 0.007, 0.020, (0, front_y + 0.022, lens_z), lens_m, ln, rot=(math.pi / 2, 0, 0), verts=24)
    cyl("lens_front", 0.0055, 0.002, (0, front_y + 0.0115, lens_z), glass, ln, rot=(math.pi / 2, 0, 0), verts=24)
    cyl("lens_thread", 0.0062, 0.010, (0, front_y + 0.036, lens_z), steel, ln, rot=(math.pi / 2, 0, 0), verts=24)

    # 4. IR-cut filter with solenoid.
    ic = empty(parts["ircut"]["node"], parent=root)
    box("ircut_frame", (0.022, 0.003, 0.022), (0, front_y + 0.043, lens_z), chip, ic)
    box("ircut_filter", (0.010, 0.001, 0.010), (0, front_y + 0.041, lens_z), glass, ic)
    box("ircut_solenoid", (0.006, 0.006, 0.010), (0.014, front_y + 0.043, lens_z + 0.004), can, ic)

    # 5. Camera module PCB with the sensor.
    sm = empty(parts["sensor"]["node"], parent=root)
    box("sensor_pcb", (0.025, 0.0016, 0.025), (0, front_y + 0.048, lens_z), pcb, sm)
    box("sensor_die", (0.008, 0.002, 0.006), (0, front_y + 0.046, lens_z), chip, sm)
    box("sensor_ffc", (0.012, 0.0005, 0.030), (0, front_y + 0.0472, lens_z - 0.026), white, sm)

    # 6. PIR below the ring, behind a small window.
    pir = empty(parts["pir"]["node"], parent=root)
    cyl("pir_can", 0.0045, 0.006, (0, front_y + 0.014, lens_z - r_board - 0.020), can, pir, rot=(math.pi / 2, 0, 0), verts=20)
    sphere("pir_dome", 0.0032, (0, front_y + 0.0105, lens_z - r_board - 0.020), mat("pir_dome", (0.85, 0.85, 0.8), 0.0, 0.9), pir)

    # 7. Mainboard: vertical carrier with a SIM socket, USB, and headers.
    mb = empty(parts["mainboard"]["node"], parent=root)
    mw, mh = parts["mainboard"]["dims"]["w"] * IN, parts["mainboard"]["dims"]["h"] * IN
    box("mainboard_pcb", (mw, 0.0016, mh), (0, 0.004, -0.004), pcb, mb)
    box("mainboard_sim", (0.016, 0.002, 0.012), (0.012, 0.0022, -0.055), can, mb)
    box("mainboard_usb", (0.008, 0.003, 0.0055), (-0.018, 0.0025, -0.070), can, mb)
    box("mainboard_j400", (0.0245, 0.005, 0.005), (0, 0.0005, lens_z + 0.003), mat("header", (0.02, 0.02, 0.02), 0, 0.7), mb)
    for i in range(7):
        box(f"mainboard_c{i}", (0.003, 0.0015, 0.002), (-0.02 + i * 0.006, 0.0022, -0.030), solder, mb)
    box("mainboard_inductor", (0.007, 0.004, 0.007), (0.016, 0.0025, -0.020), chip, mb)

    # 8. SOM stacked on the mainboard's front side.
    som = empty(parts["som"]["node"], parent=root)
    sw, sh = parts["som"]["dims"]["w"] * IN, parts["som"]["dims"]["h"] * IN
    box("som_pcb", (sw, 0.0012, sh), (0, -0.004, -0.010), pcb_dark, som)
    box("som_soc", (0.012, 0.0012, 0.012), (0, -0.0055, -0.004), chip, som)
    box("som_pmic", (0.006, 0.001, 0.006), (0.009, -0.0055, -0.024), chip, som)
    box("som_ram", (0.010, 0.001, 0.008), (-0.008, -0.0055, -0.024), chip, som)

    # 9. eMMC on the SOM.
    em = empty(parts["emmc"]["node"], parent=root)
    box("emmc_chip", (0.0115, 0.001, 0.013), (0, -0.0055, 0.012), chip, em)

    # 10. LTE module stacked above the SOM, with an antenna pigtail stub.
    lte = empty(parts["lte"]["node"], parent=root)
    box("lte_pcb", (0.025, 0.0012, 0.030), (0, -0.010, 0.040), pcb_dark, lte)
    box("lte_can", (0.020, 0.0025, 0.022), (0, -0.0118, 0.040), can, lte)
    cyl("lte_ufl", 0.0012, 0.002, (0.009, -0.0118, 0.028), gold, lte, verts=12)
    for i in range(5):
        box(f"lte_pad{i}", (0.0012, 0.0006, 0.004), (-0.011 + i * 0.0055, -0.0093, 0.024), gold, lte)

    # 11. Wi-Fi/BT module, low on the board.
    wf = empty(parts["wifi"]["node"], parent=root)
    box("wifi_pcb", (0.015, 0.001, 0.013), (0.010, -0.004, -0.050), pcb_dark, wf)
    box("wifi_can", (0.012, 0.002, 0.010), (0.010, -0.0055, -0.050), can, wf)

    # 12. GPS patch, sky-facing on the top of the frame.
    gps = empty(parts["gps"]["node"], parent=root)
    box("gps_patch", (0.017, 0.017, 0.006), (0, 0.004, H / 2 - 0.010), mat("ceramic", (0.86, 0.82, 0.74), 0.0, 0.5), gps)
    box("gps_pad", (0.019, 0.019, 0.0012), (0, 0.004, H / 2 - 0.0136), pcb, gps)
    cyl("gps_ufl", 0.0012, 0.002, (0.006, 0.010, H / 2 - 0.0125), gold, gps, verts=12)

    # 13. Rear shell: an open five-sided box (back plate and four walls) so the internals are visible
    #     through the window when assembled, with connector, antenna stub, label and mounting boss.
    rear = empty(parts["rear"]["node"], parent=root)
    body_y0, body_y1 = front_y + 0.012, back_y          # from the bezel seam to the back
    body_len = body_y1 - body_y0
    body_cy = (body_y0 + body_y1) / 2
    wall = 0.004
    box("rear_back", (W, wall, H), (0, body_y1 - wall / 2, 0), shell, rear, bevel=0.002)
    box("rear_top", (W, body_len, wall), (0, body_cy, H / 2 - wall / 2), shell, rear)
    box("rear_bottom", (W, body_len, wall), (0, body_cy, -H / 2 + wall / 2), shell, rear)
    box("rear_left", (wall, body_len, H), (-W / 2 + wall / 2, body_cy, 0), shell, rear)
    box("rear_right", (wall, body_len, H), (W / 2 - wall / 2, body_cy, 0), shell, rear)
    box("rear_liner", (W - 2 * wall, wall, H - 2 * wall), (0, body_y1 - wall - 0.0005, 0), shell_in, rear)
    cyl("rear_connector", 0.006, 0.010, (0.012, back_y - 0.002, -H * 0.30), steel, rear, rot=(math.pi / 2, 0, 0), verts=20)
    cyl("rear_ant", 0.003, 0.012, (-0.018, back_y - 0.002, H * 0.30), chip, rear, rot=(math.pi / 2, 0, 0), verts=12)
    box("rear_label", (0.030, 0.0006, 0.022), (0, back_y + 0.0002, -H * 0.05), white, rear)
    box("rear_boss", (0.040, 0.010, 0.050), (0, back_y + 0.004, 0), shell, rear, bevel=0.002)
    for i, sx in enumerate((-1, 1)):
        for j, sz in enumerate((-1, 1)):
            cyl(f"rear_screw{i}{j}", 0.0022, 0.003, (sx * (W / 2 - 0.006), front_y + 0.012, sz * (H / 2 - 0.010)), steel, rear, rot=(math.pi / 2, 0, 0), verts=12)

    # 14. Band clamps and the mounting saddle behind the boss. Pole axis is 0.10 m behind the body centre.
    cl = empty(parts["clamps"]["node"], parent=root)
    pole_y = back_y + 0.0365 + 0.004
    for i, z in enumerate((-0.05, 0.05)):
        torus(f"clamps_band{i}", 0.0385, 0.0025, (0, pole_y, z), steel, cl, rot=(0, 0, 0), seg=40, ring=8)
        box(f"clamps_buckle{i}", (0.014, 0.010, 0.012), (0.0385, pole_y - 0.006, z), steel, cl, bevel=0.001)
    box("clamps_saddle", (0.040, 0.012, 0.13), (0, back_y + 0.014, 0), shell, cl, bevel=0.002)

    # Explode vectors travel with the file so the runtime and the content file cannot drift apart.
    for p in comps["parts"]:
        o = bpy.data.objects.get(p["node"])
        if o is not None:
            o["explode"] = p["explode"]
            o["order"] = p["order"]
    return root
