"""Particle / beam / trail textures for Roblox VFX (white on transparent, so colour is
set per-emitter via ParticleEmitter.Color — one texture serves every element).

  python make_vfx.py --out vfx/              # all textures
  python make_vfx.py --only glow spark --out vfx/

Textures (256x256 unless noted):
  glow        soft round light (auras, pickups, magic)        LightEmission 1
  spark       4-point twinkle star (hits, sparkles)
  ring        hollow ring (shockwave on ground / Beam)
  smoke       soft noisy puff (dust, smoke, poof)             LightEmission 0
  slash       horizontal gradient streak (Beam/Trail/slash mesh UV)  512x128
  dots        scattered dots (magic dust)
  tracer      thin bright streak 256x32 (bullet Beam/Trail; bright end on the right)
  muzzle      6-spike star-burst flash (gun muzzle, hit flash)
  explosion_4x4  1024x1024 flipbook -> ParticleEmitter.FlipbookLayout = Grid4x4,
                 FlipbookMode = OneShot, Lifetime = 0.5
Perf rule: <= 30 particles alive per effect, Rate small, use :Emit(n) bursts.
"""
import argparse
import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

W = 256


def white(alpha):
    img = Image.new("RGBA", alpha.size, (255, 255, 255, 0))
    img.putalpha(alpha)
    return img


def radial(size, power=2.0, inner=0.0):
    a = Image.new("L", (size, size))
    px = a.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c) / c
            v = 0 if d >= 1 else (1 - max(0.0, d - inner) / (1 - inner)) ** power
            px[x, y] = int(255 * max(0.0, min(1.0, v)))
    return a


def glow(_):
    return white(radial(W, 2.2))


def spark(_):
    a = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(a)
    c = W / 2
    for ang, ln in ((0, 0.48), (90, 0.48), (45, 0.22), (135, 0.22)):
        r = math.radians(ang)
        dx, dy = math.cos(r) * W * ln, math.sin(r) * W * ln
        px, py = -math.sin(r) * W * 0.03, math.cos(r) * W * 0.03
        d.polygon([(c - dx, c - dy), (c + px, c + py), (c + dx, c + dy), (c - px, c - py)], fill=255)
    a = a.filter(ImageFilter.GaussianBlur(2))
    return white(ImageChops.lighter(a, radial(W, 3.0)))


def ring(_):
    a = Image.new("L", (W, W), 0)
    ImageDraw.Draw(a).ellipse((20, 20, W - 20, W - 20), outline=255, width=22)
    return white(a.filter(ImageFilter.GaussianBlur(6)))


def smoke(seed):
    rnd = random.Random(seed)
    a = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(a)
    for _ in range(18):
        r = rnd.uniform(0.12, 0.25) * W
        x, y = rnd.gauss(W / 2, W * 0.1), rnd.gauss(W / 2, W * 0.1)
        d.ellipse((x - r, y - r, x + r, y + r), fill=rnd.randint(90, 170))
    a = a.filter(ImageFilter.GaussianBlur(14))
    return white(ImageChops.multiply(a, radial(W, 1.2)))


def slash(_):
    w, h = 512, 128
    a = Image.new("L", (w, h))
    px = a.load()
    for y in range(h):
        for x in range(w):
            u, v = x / (w - 1), abs(y / (h - 1) - 0.5) * 2
            px[x, y] = int(255 * (u ** 1.5) * max(0.0, 1 - v ** 1.6))
    return white(a)


def dots(seed):
    rnd = random.Random(seed)
    a = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(a)
    for _ in range(14):
        r = rnd.uniform(4, 12)
        x, y = rnd.uniform(r, W - r), rnd.uniform(r, W - r)
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return white(a.filter(ImageFilter.GaussianBlur(1.5)))


def explosion_4x4(seed):
    rnd = random.Random(seed)
    cell = 256
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (255, 255, 255, 0))
    blobs = [(rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), rnd.uniform(0.15, 0.3)) for _ in range(10)]
    for f in range(16):
        t = f / 15
        a = Image.new("L", (cell, cell), 0)
        d = ImageDraw.Draw(a)
        grow = 0.35 + 0.65 * (1 - (1 - t) ** 2)
        fade = 1 - t ** 1.5
        for bx, by, br in blobs:
            r = br * cell * grow
            x, y = cell / 2 + bx * cell * grow, cell / 2 + by * cell * grow
            d.ellipse((x - r, y - r, x + r, y + r), fill=int(255 * fade))
        a = a.filter(ImageFilter.GaussianBlur(6 + 10 * t))
        if t > 0.3:  # hollow out as it dissipates
            hole = radial(cell, 1.0).point(lambda v, t=t: int(v * min(1, (t - 0.3) * 2)))
            a = ImageChops.subtract(a, hole)
        sheet.paste(white(a), ((f % 4) * cell, (f // 4) * cell))
    return sheet


def tracer(_):
    """thin bright streak 256x32: hot core, soft falloff, fades toward the tail (left)."""
    w, h = 256, 32
    a = Image.new("L", (w, h))
    px = a.load()
    for y in range(h):
        v = abs((y + 0.5) / h - 0.5) * 2
        prof = max(0.0, 1 - v ** 0.8) ** 1.5
        for x in range(w):
            u = x / (w - 1)
            px[x, y] = int(255 * prof * (u ** 0.8) * min(1.0, (1 - u) * 12 + 0.4))
    return white(a)


def muzzle(_):
    """star-burst flash 256x256: 6 spikes + hot centre."""
    a = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(a)
    c = W / 2
    for k in range(6):
        r = math.radians(k * 30 + 8)
        ln = W * (0.48 if k % 2 == 0 else 0.34)
        dx, dy = math.cos(r) * ln, math.sin(r) * ln
        px, py = -math.sin(r) * W * 0.045, math.cos(r) * W * 0.045
        d.polygon([(c - dx, c - dy), (c + px, c + py), (c + dx, c + dy), (c - px, c - py)], fill=255)
    a = a.filter(ImageFilter.GaussianBlur(2.5))
    return white(ImageChops.lighter(a, radial(W, 1.6, 0.0).point(lambda v: min(255, int(v * 1.1)))))


TEX = {"tracer": tracer, "muzzle": muzzle, "glow": glow, "spark": spark, "ring": ring, "smoke": smoke, "slash": slash, "dots": dots, "explosion_4x4": explosion_4x4}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--only", nargs="*", choices=list(TEX))
    p.add_argument("--out", default="vfx")
    p.add_argument("--seed", type=int, default=7)
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for n in a.only or TEX:
        TEX[n](a.seed).save(os.path.join(a.out, f"{n}.png"))
    print(f"[art] vfx textures -> {a.out}")


if __name__ == "__main__":
    main()
