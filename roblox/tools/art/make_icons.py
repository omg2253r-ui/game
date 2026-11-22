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


# ---- Gun Forge additions -------------------------------------------------------------
def _poly(pts):
    return lambda d: d.polygon(pts, fill=255)


def _gun(parts, c, dark=None, accent=None):
    """parts: list of draw fns for the body mask; optional accent overlay (list of fns)."""
    def body(d):
        for p in parts:
            p(d)
    i = render(body, c)
    if accent:
        def acc(d):
            for p in accent:
                p(d)
        i.alpha_composite(render(acc, accent_col(c), outline=7))
    return i


def accent_col(c):
    return shade(c, 0.6)


def pistol(c):
    c = c or hexc("#3ad8ff")
    return _gun([
        lambda d: d.rounded_rectangle((60, 130, 470, 250), radius=24, fill=255),
        lambda d: d.polygon([(130, 240), (250, 240), (230, 440), (140, 440)], fill=255),
        lambda d: d.arc((200, 220, 330, 330), 0, 180, fill=255, width=22),
    ], c, accent=[lambda d: d.rectangle((90, 160, 330, 190), fill=255)])


def smg(c):
    c = c or hexc("#3ad8ff")
    return _gun([
        lambda d: d.rounded_rectangle((40, 140, 480, 250), radius=20, fill=255),
        lambda d: d.polygon([(150, 240), (230, 240), (215, 440), (150, 440)], fill=255),
        lambda d: d.polygon([(290, 240), (350, 240), (360, 460), (300, 460)], fill=255),
        lambda d: d.rectangle((20, 160, 60, 200), fill=255),
    ], c, accent=[lambda d: d.rectangle((80, 170, 400, 195), fill=255)])


def shotgun(c):
    c = c or hexc("#ff9a3a")
    return _gun([
        lambda d: d.rounded_rectangle((20, 160, 400, 215), radius=16, fill=255),
        lambda d: d.rounded_rectangle((20, 225, 330, 270), radius=16, fill=255),
        lambda d: d.polygon([(330, 170), (480, 120), (490, 330), (400, 300), (340, 260)], fill=255),
        lambda d: d.polygon([(250, 260), (310, 260), (290, 360), (240, 360)], fill=255),
    ], c, accent=[lambda d: d.rectangle((60, 180, 330, 196), fill=255)])


def rifle(c):
    c = c or hexc("#59e35a")
    return _gun([
        lambda d: d.rounded_rectangle((20, 175, 330, 240), radius=14, fill=255),
        lambda d: d.rectangle((300, 150, 470, 250), fill=255),
        lambda d: d.polygon([(440, 160), (490, 140), (490, 320), (430, 300)], fill=255),
        lambda d: d.polygon([(250, 235), (310, 235), (300, 400), (240, 400)], fill=255),
        lambda d: d.rectangle((150, 120, 290, 180), fill=255),
        lambda d: d.polygon([(190, 235), (240, 235), (230, 330), (190, 330)], fill=255),
    ], c, accent=[lambda d: d.rectangle((165, 135, 275, 160), fill=255)])


def blaster(c):
    c = c or hexc("#ff4fd8")
    def fin(d):
        d.polygon([(110, 150), (250, 90), (400, 140), (480, 210), (400, 280), (250, 290), (110, 250)], fill=255)
    return _gun([
        fin,
        lambda d: d.polygon([(180, 270), (260, 270), (230, 430), (160, 430)], fill=255),
        lambda d: d.rectangle((420, 180, 500, 240), fill=255),
    ], c, accent=[lambda d: d.ellipse((230, 150, 330, 250), fill=255)])


def railgun(c):
    c = c or hexc("#b56cff")
    return _gun([
        lambda d: d.rectangle((20, 175, 130, 255), fill=255),
        lambda d: d.rounded_rectangle((100, 150, 330, 270), radius=20, fill=255),
        lambda d: d.rectangle((330, 130, 490, 160), fill=255),
        lambda d: d.rectangle((330, 190, 490, 220), fill=255),
        lambda d: d.rectangle((330, 150, 350, 200), fill=255),
        lambda d: d.polygon([(170, 260), (250, 260), (230, 420), (160, 420)], fill=255),
    ], c, accent=[lambda d: d.rectangle((130, 195, 300, 225), fill=255)])


def helmet(c):
    c = c or hexc("#3ad8ff")
    i = render(lambda d: (d.pieslice((60, 50, 452, 440), 180, 360, fill=255), d.rounded_rectangle((60, 245, 452, 440), radius=40, fill=255)), c)
    i.alpha_composite(render(lambda d: d.rounded_rectangle((120, 230, 392, 330), radius=45, fill=255), hexc("#16142a"), outline=7))
    return i


def vest(c):
    c = c or hexc("#59e35a")
    i = render(lambda d: d.polygon([(130, 70), (210, 70), (256, 130), (302, 70), (382, 70), (460, 140), (420, 230), (400, 450), (112, 450), (92, 230), (52, 140)], fill=255), c)
    i.alpha_composite(render(lambda d: d.rectangle((150, 270, 362, 320), fill=255), shade(c, 0.6), outline=7))
    return i


def boots(c):
    c = c or hexc("#ff9a3a")
    return render(lambda d: (d.polygon([(130, 50), (270, 50), (280, 270), (470, 330), (470, 440), (100, 440)], fill=255), d.rounded_rectangle((90, 400, 480, 460), radius=18, fill=255)), c)


def paw(c):
    c = c or hexc("#ff7ab8")
    def p(d):
        d.ellipse((150, 260, 362, 450), fill=255)
        d.ellipse((150, 230, 250, 300), fill=255)
        d.ellipse((262, 230, 362, 300), fill=255)
        for x, y in ((50, 200), (150, 90), (290, 90), (390, 200)):
            d.ellipse((x, y, x + 80, y + 120), fill=255)
    return render(p, c)


def anvil(c):
    c = c or hexc("#ff4fd8")
    def a(d):
        d.polygon([(30, 130), (480, 130), (440, 200), (330, 220), (330, 290), (400, 350), (400, 420), (112, 420), (112, 350), (190, 290), (190, 220), (110, 200)], fill=255)
    i = render(a, c)
    i.alpha_composite(render(lambda d: d.rectangle((70, 140, 440, 160), fill=255), hexc("#ffffff"), outline=3))
    return i


def portal(c):
    c = c or hexc("#3ad8ff")
    i = render(lambda d: d.ellipse((80, 20, 432, 490), fill=255), c)
    i.alpha_composite(render(lambda d: d.ellipse((150, 100, 362, 410), fill=255), hexc("#6a2cff"), outline=9))
    i.alpha_composite(render(lambda d: d.ellipse((210, 170, 302, 340), fill=255), hexc("#ffffff"), outline=5))
    return i


def swords_crossed(c):
    c = c or hexc("#cfe3ff")
    def blade(d, flip):
        def X(x):
            return 512 - x if flip else x
        d.polygon([(X(40), 40), (X(130), 30), (X(450), 350), (X(380), 420)], fill=255)
        d.polygon([(X(290), 310), (X(440), 330), (X(470), 400), (X(330), 450), (X(260), 380)], fill=255)
        d.ellipse((X(400) - 45, 410, X(400) + 45, 500), fill=255)
    return render(lambda d: (blade(d, False), blade(d, True)), c)


def shield_clan(c):
    c = c or hexc("#3ad8ff")
    i = render(lambda d: d.polygon([(60, 70), (256, 30), (452, 70), (452, 250), (256, 480), (60, 250)], fill=255), c)
    i.alpha_composite(render(lambda d: d.polygon(star_pts(256, 235, 110, 48), fill=255), hexc("#ffc935"), outline=9))
    return i


def target(c):
    c = c or hexc("#ff4f6a")
    i = render(lambda d: d.ellipse((40, 40, 472, 472), fill=255), c)
    i.alpha_composite(render(lambda d: d.ellipse((120, 120, 392, 392), fill=255), hexc("#ffffff"), outline=7))
    i.alpha_composite(render(lambda d: d.ellipse((190, 190, 322, 322), fill=255), c, outline=7))
    return i


def x2_pulse(c):
    c = c or hexc("#ffc935")
    i = render(lambda d: d.polygon([(330, 20), (90, 300), (230, 300), (170, 490), (440, 190), (290, 190)], fill=255), c)
    return text_on(i, "x2", 190, fill="white")


def rebirth(c):
    c = c or hexc("#59e35a")
    def r(d):
        d.arc((70, 70, 442, 442), 200, 340, fill=255, width=60)
        d.arc((70, 70, 442, 442), 20, 160, fill=255, width=60)
        d.polygon([(400, 90), (480, 230), (320, 230)], fill=255)
        d.polygon([(112, 422), (32, 282), (192, 282)], fill=255)
    return render(r, c)


def book(c):
    c = c or hexc("#b56cff")
    i = render(lambda d: (d.polygon([(40, 90), (240, 120), (240, 450), (40, 420)], fill=255), d.polygon([(472, 90), (272, 120), (272, 450), (472, 420)], fill=255)), c)
    i.alpha_composite(render(lambda d: (d.rectangle((80, 160, 200, 180), fill=255), d.rectangle((80, 220, 200, 240), fill=255), d.rectangle((312, 160, 432, 180), fill=255), d.rectangle((312, 220, 432, 240), fill=255)), hexc("#f4efff"), outline=3))
    return i


def skull(c):
    c = c or hexc("#e8e8f0")
    def s(d):
        d.ellipse((60, 40, 452, 380), fill=255)
        d.rounded_rectangle((140, 320, 372, 460), radius=30, fill=255)
    i = render(s, c)
    dark = hexc("#16142a")
    i.alpha_composite(render(lambda d: (d.ellipse((110, 170, 230, 290), fill=255), d.ellipse((282, 170, 402, 290), fill=255), d.polygon([(256, 300), (225, 360), (287, 360)], fill=255)), dark, outline=3))
    return i


ICONS.update({f.__name__: f for f in (pistol, smg, shotgun, rifle, blaster, railgun, helmet, vest, boots, paw, anvil,
                                      portal, swords_crossed, shield_clan, target, x2_pulse, rebirth, book, skull)})


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
        cols = 8
        rows = (len(made) + cols - 1) // cols
        sheet = Image.new("RGBA", (128 * cols, 128 * rows), (40, 36, 70, 255))
        for k, img in enumerate(made):
            sheet.alpha_composite(img.resize((128, 128), Image.LANCZOS), (128 * (k % cols), 128 * (k // cols)))
        sheet.save(os.path.join(a.out, "_sheet.png"))
    print(f"[art] {len(made)} icons -> {a.out}")


if __name__ == "__main__":
    main()
