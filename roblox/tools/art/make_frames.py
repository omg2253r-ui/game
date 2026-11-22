"""Rarity card frames (512x640 PNG): dark card body, rounded rim and soft glow in the rarity colour.
Used as background ImageLabel for inventory / forge-result cards (put icon + text on top).

  python make_frames.py --out art/ui
Colours match Config/Guns.luau Rarities (Common..Mythic).
"""
import argparse
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

W, H = 512, 640
RAR = {
    "common": (200, 200, 208),
    "rare": (58, 216, 255),
    "epic": (181, 108, 255),
    "legendary": (255, 201, 53),
    "mythic": (255, 79, 106),
}


def frame(col):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    box = (36, 36, W - 36, H - 36)
    # glow
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=48, fill=255)
    glow = Image.new("RGBA", (W, H), col + (255,))
    glow.putalpha(m.filter(ImageFilter.GaussianBlur(24)).point(lambda v: int(v * 0.9)))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=48, fill=(12, 10, 24, 255))
    d.rounded_rectangle((44, 44, W - 44, H - 44), radius=42, fill=col + (255,))
    # body: vertical gradient dark with a tint of the rarity colour
    body = Image.new("RGBA", (W, H))
    bd = ImageDraw.Draw(body)
    for y in range(H):
        k = y / (H - 1)
        c = tuple(int(22 + (col[i] * 0.28 - 22) * (1 - k) ** 1.5 + (col[i] * 0.12) * k) for i in range(3))
        bd.line([(0, y), (W, y)], fill=c + (255,))
    bm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(bm).rounded_rectangle((58, 58, W - 58, H - 58), radius=34, fill=255)
    img.paste(body, (0, 0), bm)
    # centre spotlight behind the item icon
    spot = Image.new("L", (W, H), 0)
    ImageDraw.Draw(spot).ellipse((90, 90, W - 90, 400), fill=110)
    spot = ImageChops.multiply(spot.filter(ImageFilter.GaussianBlur(40)), bm)
    img.paste(Image.new("RGBA", (W, H), col + (255,)), (0, 0), spot)
    # top gloss
    g = Image.new("L", (W, H), 0)
    ImageDraw.Draw(g).rounded_rectangle((58, 58, W - 58, 200), radius=34, fill=34)
    img.paste(Image.new("RGBA", (W, H), (255, 255, 255, 255)), (0, 0), ImageChops.multiply(g, bm))
    # name plate strip at the bottom
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((78, H - 150, W - 78, H - 78), radius=22, fill=(12, 10, 24, 200))
    return img


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="art/ui")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for n, c in RAR.items():
        frame(c).save(os.path.join(a.out, f"frame_{n}.png"))
    print(f"[art] {len(RAR)} frames -> {a.out}")


if __name__ == "__main__":
    main()
