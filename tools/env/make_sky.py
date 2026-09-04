"""Write a small equirectangular Radiance .hdr dusk sky for image-based lighting.
Deterministic and dependency-free; ~256x128 is plenty for a prefiltered environment."""
import math, os, struct

import sys
W, H = 256, 128
MODE = sys.argv[1] if len(sys.argv) > 1 else "dusk"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "env", f"{MODE}.hdr")

def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def sky(u, v):
    # v: 0 = zenith, 1 = nadir. u: 0..1 around, sun/glow at u = 0.15 (roughly +X in the runtime frame).
    el = 1.0 - 2.0 * v  # +1 zenith .. -1 nadir
    zenith = (0.010, 0.020, 0.045)
    horizon = (0.30, 0.16, 0.10)
    ground = (0.020, 0.024, 0.018)
    if el >= 0:
        t = math.pow(1.0 - el, 3.0)
        c = mix(zenith, horizon, t)
        # warm afterglow lobe near the horizon around u=0.15
        d = min(abs(u - 0.15), 1.0 - abs(u - 0.15)) / 0.5
        glow = math.exp(-(d * d) * 14.0) * math.exp(-el * 9.0)
        c = (c[0] + 1.6 * glow, c[1] + 0.7 * glow, c[2] + 0.25 * glow)
        # a few cool streetlight-ish highlights opposite the glow
        d2 = min(abs(u - 0.65), 1.0 - abs(u - 0.65)) / 0.5
        cool = math.exp(-(d2 * d2) * 30.0) * math.exp(-el * 12.0) * 0.25
        c = (c[0] + cool * 0.6, c[1] + cool * 0.8, c[2] + cool)
        return c
    t = min(1.0, -el * 6.0)
    return mix(horizon, ground, t)

def studio(u, v):
    # Bright neutral studio: white ceiling, soft warm key window near u=0.15, pale floor.
    el = 1.0 - 2.0 * v
    if el >= 0:
        base = mix((0.95, 0.96, 0.98), (0.80, 0.81, 0.82), math.pow(1.0 - el, 2.0))
        d = min(abs(u - 0.15), 1.0 - abs(u - 0.15)) / 0.5
        key = math.exp(-(d * d) * 10.0) * math.exp(-abs(el - 0.35) * 5.0)
        return (base[0] + 1.4 * key, base[1] + 1.25 * key, base[2] + 1.0 * key)
    return mix((0.80, 0.81, 0.82), (0.55, 0.56, 0.56), min(1.0, -el * 2.0))

def rgbe(r, g, b):
    m = max(r, g, b)
    if m < 1e-32:
        return b"\x00\x00\x00\x00"
    mant, exp = math.frexp(m)
    scale = mant * 256.0 / m
    return struct.pack("BBBB", int(r * scale), int(g * scale), int(b * scale), exp + 128)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "wb") as f:
    f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
    f.write(f"-Y {H} +X {W}\n".encode())
    for j in range(H):
        v = (j + 0.5) / H
        for i in range(W):
            u = (i + 0.5) / W
            f.write(rgbe(*(studio(u, v) if MODE == "studio" else sky(u, v))))
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
