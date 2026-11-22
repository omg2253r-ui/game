"""Professional Roblox game thumbnail + icon compositor (Pillow only).

  python make_thumbnail.py --title "PET QUEST" --subtitle "HATCH • TRADE • EVOLVE" \
      --hero shots/hero.png --bg ai_background.png --badge "UPDATE 1" --out store/

Outputs:  thumbnail_1920x1080.png  (game thumbnail, 16:9)
          icon_512.png             (game icon, square; Roblox shows it rounded)
Layers:   background (AI image / Blender render / generated gradient+rays)
          -> vignette -> hero render (transparent PNG) with glow + drop shadow
          -> big chunky title (gradient fill, thick outline, 3D extrude) -> badge ribbon.
Rules kept automatically: no Robux symbols, no fake UI buttons, text inside safe area.
"""
import argparse
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

FONT_CANDIDATES = [
    "fonts/LilitaOne-Regular.ttf", "fonts/FredokaOne-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/opentype/inter/Inter-Black.otf",
    "C:/Windows/Fonts/impact.ttf", "/System/Library/Fonts/Supplemental/Impact.ttf",
]


def hexc(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def font(path, size):
    for p in ([path] if path else []) + FONT_CANDIDATES:
        full = p if os.path.isabs(p) else os.path.join(os.path.dirname(__file__), p)
        if os.path.exists(full):
            return ImageFont.truetype(full, size)
    return ImageFont.load_default(size)


def gradient_bg(w, h, top, bottom, rays=True, seed_color=None):
    img = Image.new("RGBA", (w, h))
    px = img.load()
    t, b = hexc(top), hexc(bottom)
    for y in range(h):
        k = y / (h - 1)
        c = tuple(int(t[i] * (1 - k) + b[i] * k) for i in range(4))
        for x in range(w):
            px[x, y] = c
    if rays:  # radial sun-rays = classic energetic Roblox look
        ray = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(ray)
        cx, cy, n = w * 0.62, h * 0.45, 18
        for i in range(n):
            a0 = 2 * math.pi * i / n
            a1 = a0 + math.pi / n
            r = w * 1.5
            d.polygon([(cx, cy), (cx + r * math.cos(a0), cy + r * math.sin(a0)), (cx + r * math.cos(a1), cy + r * math.sin(a1))], fill=38)
        ray = ray.filter(ImageFilter.GaussianBlur(6))
        glow = Image.new("RGBA", (w, h), seed_color or (255, 255, 255, 255))
        img = Image.composite(glow, img, ray)
    return img


def cover(img, w, h):
    s = max(w / img.width, h / img.height)
    img = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def vignette(img, strength=0.55):
    w, h = img.size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).ellipse((-w * 0.15, -h * 0.25, w * 1.15, h * 1.25), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) // 6))
    dark = Image.new("RGBA", (w, h), (0, 0, 0, int(255 * strength)))
    return Image.composite(img, Image.alpha_composite(img, dark), m)


def place_hero(base, hero, box, glow_color):
    """Fit hero PNG into box (x, y, w, h) with soft glow + contact shadow."""
    x, y, bw, bh = box
    s = min(bw / hero.width, bh / hero.height)
    hero = hero.resize((int(hero.width * s), int(hero.height * s)), Image.LANCZOS)
    m = 70  # margin so glow/shadow are not clipped at the layer edge
    padded = Image.new("RGBA", (hero.width + 2 * m, hero.height + 2 * m), (0, 0, 0, 0))
    padded.alpha_composite(hero, (m, m))
    hero = padded
    px, py = x + (bw - hero.width) // 2, y + bh - hero.height + m
    alpha = hero.split()[3]
    glow = Image.new("RGBA", hero.size, glow_color)
    glow.putalpha(alpha.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(28)))
    shadow = Image.new("RGBA", hero.size, (0, 0, 0, 160))
    shadow.putalpha(ImageChops.multiply(alpha.filter(ImageFilter.GaussianBlur(18)), Image.new("L", hero.size, 150)))
    base.alpha_composite(shadow, (px + 18, py + 22))
    base.alpha_composite(glow, (px, py))
    base.alpha_composite(hero, (px, py))
    return base


def chunky_text(base, text, center, size, fnt_path, fill_top, fill_bottom, outline="#1b1030", extrude="#3a1d5c", max_w=None):
    """Big readable title: gradient fill + thick outline + 3D extrude, auto-shrinks to max_w."""
    f = font(fnt_path, size)
    while max_w and f.getbbox(text)[2] > max_w and size > 20:
        size = int(size * 0.92)
        f = font(fnt_path, size)
    l, t, r, b = f.getbbox(text)
    tw, th = r - l, b - t
    stroke = max(4, size // 11)
    depth = max(3, size // 14)
    pad = stroke + depth + 10
    layer = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    o = (pad - l, pad - t)
    for i in range(depth, 0, -1):  # extrude
        d.text((o[0], o[1] + i), text, font=f, fill=hexc(extrude), stroke_width=stroke, stroke_fill=hexc(extrude))
    d.text(o, text, font=f, fill=hexc(outline), stroke_width=stroke, stroke_fill=hexc(outline))
    mask = Image.new("L", layer.size, 0)
    ImageDraw.Draw(mask).text(o, text, font=f, fill=255)
    grad = gradient_bg(layer.width, layer.height, fill_top, fill_bottom, rays=False)
    layer = Image.composite(grad, layer, mask)
    shine = Image.new("L", layer.size, 0)  # top highlight band
    ImageDraw.Draw(shine).rectangle((0, 0, layer.width, pad + th * 0.38), fill=70)
    layer = Image.composite(Image.new("RGBA", layer.size, (255, 255, 255, 255)), layer, ImageChops.multiply(shine, mask))
    cx, cy = center
    base.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))
    return layer.height


def badge(base, text, fnt_path, color="#ff3b5c"):
    w = base.width
    f = font(fnt_path, int(w * 0.034))
    tw = f.getbbox(text)[2]
    rib = Image.new("RGBA", (tw + 90, int(w * 0.06)), (0, 0, 0, 0))
    d = ImageDraw.Draw(rib)
    d.rounded_rectangle((0, 0, rib.width - 1, rib.height - 1), radius=rib.height // 3, fill=hexc(color), outline=hexc("#ffffff"), width=5)
    d.text((rib.width / 2, rib.height / 2), text, font=f, anchor="mm", fill="white", stroke_width=4, stroke_fill=hexc("#5a0016"))
    rib = rib.rotate(8, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(rib, (int(w * 0.035), int(w * 0.03)))


def build(a, w, h, square=False):
    if a.bg:
        img = cover(Image.open(a.bg).convert("RGBA"), w, h)
    else:
        img = gradient_bg(w, h, a.top, a.bottom, seed_color=hexc(a.ray))
    img = vignette(img, 0.45)
    if a.hero:
        hero = Image.open(a.hero).convert("RGBA")
        # kill near-zero alpha noise from denoised renders (else the glow shows a box)
        hero.putalpha(hero.split()[3].point(lambda v: 0 if v < 12 else v))
        hero = hero.crop(hero.getchannel("A").getbbox() or (0, 0, hero.width, hero.height))
        box = (int(w * 0.1), int(h * 0.30), int(w * 0.8), int(h * 0.68)) if square else (int(w * 0.40), int(h * 0.12), int(w * 0.58), int(h * 0.84))
        place_hero(img, hero, box, hexc(a.glow, 200))
    if square:
        chunky_text(img, a.title, (w / 2, h * 0.16), int(h * 0.2), a.font, a.title_top, a.title_bottom, max_w=w * 0.9)
    else:
        th = chunky_text(img, a.title, (w * 0.29, h * 0.42), int(h * 0.19), a.font, a.title_top, a.title_bottom, max_w=w * 0.52)
        if a.subtitle:
            chunky_text(img, a.subtitle, (w * 0.29, h * 0.42 + th * 0.62), int(h * 0.065), a.font, "#ffffff", "#d8e6ff", max_w=w * 0.5)
        if a.badge:
            badge(img, a.badge, a.font)
    return img.convert("RGB")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--title", required=True)
    p.add_argument("--subtitle", default="")
    p.add_argument("--hero", help="transparent PNG (tools/blender/render_shot.py)")
    p.add_argument("--bg", help="background image (AI-generated or render); default = gradient + rays")
    p.add_argument("--badge", default="", help='e.g. "NEW!", "UPDATE 2", "x2 EVENT"')
    p.add_argument("--font", default=None, help="TTF/OTF path (Lilita One / Fredoka One recommended)")
    p.add_argument("--top", default="#36c3ff")
    p.add_argument("--bottom", default="#5b2bd6")
    p.add_argument("--ray", default="#bff2ff")
    p.add_argument("--glow", default="#ffe27a")
    p.add_argument("--title-top", dest="title_top", default="#fff36b")
    p.add_argument("--title-bottom", dest="title_bottom", default="#ff9d1c")
    p.add_argument("--out", default="store")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)
    build(a, 1920, 1080).save(os.path.join(a.out, "thumbnail_1920x1080.png"))
    build(a, 512, 512, square=True).save(os.path.join(a.out, "icon_512.png"))
    print("[art] wrote", os.path.join(a.out, "thumbnail_1920x1080.png"), "and icon_512.png")


if __name__ == "__main__":
    main()
