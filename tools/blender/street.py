"""Street set: ground, two-lane road with markings, curbs, far sidewalk, distant streetlights, and a sedan.
World frame, pole base at the origin, road toward runtime +Z, traffic toward +X.
"""
import math
from lib import *

ROAD_NEAR = 3.0   # runtime z of the near road edge
LANE = 3.6

def build():
    grass = mat("grass", (0.08, 0.10, 0.06), 0.0, 0.95)
    asphalt = mat("asphalt", (0.06, 0.06, 0.065), 0.0, 0.9)
    curb = mat("curb", (0.35, 0.34, 0.32), 0.0, 0.85)
    walk = mat("sidewalk", (0.28, 0.27, 0.26), 0.0, 0.9)
    white = mat("paint_white", (0.75, 0.75, 0.72), 0.0, 0.7)
    yellow = mat("paint_yellow", (0.75, 0.6, 0.15), 0.0, 0.7)
    poleg = mat("streetlight_grey", (0.25, 0.26, 0.27), 0.6, 0.5)
    lum = mat("luminaire", (1.0, 0.75, 0.4), 0.0, 0.4, emission=(1.0, 0.72, 0.35), emission_strength=6.0)
    car = mat("car_paint", (0.55, 0.57, 0.6), 0.9, 0.3)
    tint = mat("car_glass", (0.05, 0.06, 0.08), 0.0, 0.1)
    rubber = mat("tire", (0.02, 0.02, 0.02), 0.0, 0.9)
    rim = mat("rim", (0.6, 0.6, 0.62), 1.0, 0.4)
    tail = mat("tail_light", (0.6, 0.05, 0.05), 0.0, 0.3, emission=(1.0, 0.05, 0.03), emission_strength=4.0)
    head = mat("head_light", (0.9, 0.9, 0.85), 0.0, 0.2, emission=(1.0, 0.95, 0.85), emission_strength=8.0)
    plate = mat("plate", (0.9, 0.9, 0.88), 0.0, 0.5)
    plate_txt = mat("plate_text", (0.1, 0.15, 0.4), 0.0, 0.6)

    root = empty("street")
    L = 120.0
    z0 = ROAD_NEAR
    z1 = ROAD_NEAR + 2 * LANE
    plane("ground", 400, 400, B(0, -0.01, 0), grass, root)
    plane("road", L, z1 - z0, B(0, 0.0, (z0 + z1) / 2), asphalt, root)
    box("curb_near", (L, 0.25, 0.14), B(0, 0.07, z0 - 0.125), curb, root)
    box("curb_far", (L, 0.25, 0.14), B(0, 0.07, z1 + 0.125), curb, root)
    plane("sidewalk", L, 1.8, B(0, 0.14, z1 + 0.25 + 0.9), walk, root)
    plane("edge_near", L, 0.10, B(0, 0.002, z0 + 0.15), white, root)
    plane("edge_far", L, 0.10, B(0, 0.002, z1 - 0.15), white, root)
    # dashed centre line
    for i in range(-20, 20):
        plane(f"dash{i+20}", 3.0, 0.10, B(i * 6.0 + 1.5, 0.002, (z0 + z1) / 2), yellow, root)
    # far-side streetlights
    for i, x in enumerate((-30, -10, 10, 30)):
        sp = empty(f"streetlight{i}", B(x, 0, z1 + 2.4), root)
        cyl(f"sl_pole{i}", 0.08, 8.0, (0, 0, 4.0), poleg, sp, verts=16)
        cyl(f"sl_arm{i}", 0.04, 2.0, (0, 1.0, 7.9), poleg, sp, rot=(math.pi / 2, 0, 0), verts=12)
        box(f"sl_lum{i}", (0.5, 0.25, 0.12), (0, 2.0, 7.85), poleg, sp, bevel=0.01)
        plane(f"sl_glow{i}", 0.4, 0.18, (0, 2.0, 7.78), lum, sp)

    # sedan in lane 1, facing +X, rear toward the camera when it has passed
    sedan = empty("sedan", B(0, 0, z0 + LANE / 2), root)
    box("car_body", (4.4, 1.8, 0.55), (0, 0, 0.55), car, sedan, bevel=0.06)
    box("car_cabin", (2.2, 1.65, 0.55), (-0.2, 0, 1.08), car, sedan, bevel=0.10)
    box("car_glass_f", (0.6, 1.5, 0.45), (0.85, 0, 1.06), tint, sedan, bevel=0.03)
    box("car_glass_r", (0.5, 1.5, 0.42), (-1.3, 0, 1.05), tint, sedan, bevel=0.03)
    box("car_glass_s", (1.6, 1.72, 0.40), (-0.2, 0, 1.08), tint, sedan, bevel=0.02)
    for i, (x, y) in enumerate(((1.45, 0.85), (1.45, -0.85), (-1.45, 0.85), (-1.45, -0.85))):
        cyl(f"tire{i}", 0.33, 0.22, (x, y, 0.33), rubber, sedan, rot=(math.pi / 2, 0, 0), verts=24)
        cyl(f"rim{i}", 0.20, 0.23, (x, y, 0.33), rim, sedan, rot=(math.pi / 2, 0, 0), verts=16)
    box("tail_l", (0.03, 0.34, 0.12), (-2.2, 0.62, 0.72), tail, sedan)
    box("tail_r", (0.03, 0.34, 0.12), (-2.2, -0.62, 0.72), tail, sedan)
    box("head_l", (0.03, 0.34, 0.12), (2.2, 0.62, 0.72), head, sedan)
    box("head_r", (0.03, 0.34, 0.12), (2.2, -0.62, 0.72), head, sedan)
    box("rear_plate", (0.01, 0.30, 0.15), (-2.21, 0, 0.50), plate, sedan)
    for k in range(6):
        box(f"plate_glyph{k}", (0.004, 0.028, 0.07), (-2.216, -0.10 + k * 0.04, 0.50), plate_txt, sedan)
    box("car_bumper_r", (0.15, 1.75, 0.20), (-2.15, 0, 0.42), mat("bumper", (0.08, 0.08, 0.085), 0.2, 0.6), sedan, bevel=0.03)
    return root
