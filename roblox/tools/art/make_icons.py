"""Code-drawn glossy UI icons (512x512 transparent PNG) for shop cards, HUD and game-pass
images. Consistent style: thick dark outline, vertical gradient, top gloss, soft shadow.

  python make_icons.py --out icons/                      # all icons
  python make_icons.py --only coin gem vip --out icons/  # subset
  python make_icons.py --only x2 --color "#59e35a" --out icons/

Upload PNGs in Studio (Asset Manager / Creator Hub) and paste the rbxassetid into
Config/GamePasses.luau / Products.luau `icon` fields. Game-pass images: 512x512, circle-safe.
"""
import argparse
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

S = 512
OUT = (24, 14, 40, 255)


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def grad(top, bottom):
    g = Image.new("RGBA", (S, S))
    d = ImageDraw.Draw(g)
    for y in range(S):
        k = y / (S - 1)
        d.line([(0, y), (S, y)], fill=tuple(int(top[i] * (1 - k) + bottom[i] * k) for i in range(4)))
    return g


def render(mask_fn, color, outline=26):
    """mask_fn(draw) draws white shape on L mask. Returns finished icon."""
    mask = Image.new("L", (S, S), 0)
    mask_fn(ImageDraw.Draw(mask))
    out_mask = mask.filter(ImageFilter.MaxFilter(outline | 1))
    icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 120))
    icon.paste(shadow, (10, 16), out_mask.filter(ImageFilter.GaussianBlur(10)))
    icon.paste(Image.new("RGBA", (S, S), OUT), (0, 0), out_mask)
    icon.paste(grad(shade(color, 1.25), shade(color, 0.72)), (0, 0), mask)
    gloss = Image.new("L", (S, S), 0)
    ImageDraw.Draw(gloss).ellipse((S * 0.12, -S * 0.35, S * 0.88, S * 0.42), fill=85)
    icon.paste(Image.new("RGBA", (S, S), (255, 255, 255, 255)), (0, 0), ImageChops.multiply(gloss, mask))
    return icon


def star_pts(cx, cy, r1, r2, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def text_on(icon, text, size, fill="white"):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
        if os.path.exists(p):
            f = ImageFont.truetype(p, size)
            break
    else:
        f = ImageFont.load_default(size)
    ImageDraw.Draw(icon).text((S / 2, S / 2 + 8), text, font=f, anchor="mm", fill=fill, stroke_width=size // 9, stroke_fill=OUT)
    return icon


def coin(c):
    i = render(lambda d: d.ellipse((60, 60, 452, 452), fill=255), c or hexc("#ffc935"))
    inner = render(lambda d: d.ellipse((130, 130, 382, 382), fill=255), shade(c or hexc("#ffc935"), 0.9), outline=9)
    i.alpha_composite(inner)
    return text_on(i, "$", 200, fill=(255, 244, 190, 255))


def gem(c):
    return render(lambda d: d.polygon([(256, 470), (50, 200), (140, 70), (372, 70), (462, 200)], fill=255), c or hexc("#b56cff"))


def vip(c):
    def crown(d):
        d.polygon([(70, 400), (60, 150), (170, 260), (256, 90), (342, 260), (452, 150), (442, 400)], fill=255)
    i = render(crown, c or hexc("#ffcc33"))
    for x, y in ((60, 150), (256, 90), (452, 150)):
        i.alpha_composite(render(lambda d, x=x, y=y: d.ellipse((x - 34, y - 34, x + 34, y + 34), fill=255), hexc("#ff4f7a"), outline=9))
    return text_on(i, "VIP", 110)


def speed(c):
    return render(lambda d: d.polygon([(300, 40), (110, 290), (240, 290), (200, 472), (402, 210), (270, 210)], fill=255), c or hexc("#40c8ff"))


def x2(c):
    i = render(lambda d: d.rounded_rectangle((50, 110, 462, 402), radius=80, fill=255), c or hexc("#59e35a"))
    return text_on(i, "x2", 210)


def star(c):
    return render(lambda d: d.polygon(star_pts(256, 270, 230, 100), fill=255), c or hexc("#ffd84a"))


def gift(c):
    def g(d):
        d.rectangle((80, 210, 432, 452), fill=255)
        d.rectangle((60, 150, 452, 230), fill=255)
        d.ellipse((140, 60, 250, 170), fill=255)
        d.ellipse((262, 60, 372, 170), fill=255)
    i = render(g, c or hexc("#ff5c8a"))
    i.alpha_composite(render(lambda d: d.rectangle((226, 150, 286, 452), fill=255), hexc("#ffd84a"), outline=9))
    return i


def trophy(c):
    def t(d):
        d.pieslice((110, -60, 402, 330), 0, 180, fill=255)
        d.ellipse((50, 90, 150, 220), outline=255, width=30)
        d.ellipse((362, 90, 462, 220), outline=255, width=30)
        d.rectangle((226, 300, 286, 400), fill=255)
        d.rounded_rectangle((140, 390, 372, 460), radius=20, fill=255)
    return render(t, c or hexc("#ffcc33"))


def lock(c):
    def l(d):
        d.rounded_rectangle((100, 220, 412, 460), radius=40, fill=255)
        d.arc((150, 60, 362, 300), 180, 360, fill=255, width=48)
        d.rectangle((150, 175, 198, 240), fill=255)
        d.rectangle((314, 175, 362, 240), fill=255)
    return render(l, c or hexc("#9aa3b5"))


def heart(c):
    def h(d):
        d.ellipse((60, 90, 270, 300), fill=255)
        d.ellipse((242, 90, 452, 300), fill=255)
        d.polygon([(72, 240), (440, 240), (256, 460)], fill=255)
    return render(h, c or hexc("#ff4f6a"))


def sword(c):
    def s(d):
        d.polygon([(380, 40), (470, 40), (470, 130), (210, 390), (122, 302)], fill=255)
        d.polygon([(90, 300), (212, 422), (180, 454), (58, 332)], fill=255)
        d.ellipse((40, 400, 110, 470), fill=255)
    return render(s, c or hexc("#cfe3ff"))


def egg(c):
    return render(lambda d: d.ellipse((110, 40, 402, 470), fill=255), c or hexc("#7ee0ff"))


ICONS = {f.__name__: f for f in (coin, gem, vip, speed, x2, star, gift, trophy, lock, heart, sword, egg)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--only", nargs="*", choices=list(ICONS))
    p.add_argument("--color", help="override main colour (hex)")
    p.add_argument("--out", default="icons")
    p.add_argument("--sheet", action="store_true", help="also write a preview contact sheet")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)
    names = a.only or list(ICONS)
    made = []
    for n in names:
        img = ICONS[n](hexc(a.color) if a.color else None)
        path = os.path.join(a.out, f"{n}.png")
        img.save(path)
        made.append(img)
    if a.sheet:
        sheet = Image.new("RGBA", (128 * len(made), 128), (40, 36, 70, 255))
        for k, img in enumerate(made):
            sheet.alpha_composite(img.resize((128, 128), Image.LANCZOS), (128 * k, 0))
        sheet.save(os.path.join(a.out, "_sheet.png"))
    print(f"[art] {len(made)} icons -> {a.out}")


if __name__ == "__main__":
    main()
