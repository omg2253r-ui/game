# usage: python sheet.py out.jpg img1 img2 ... (labels = file names), 4 per row, each scaled to 270x480
import sys, os
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
W, H, C = 270, 480, 4
rows = (len(files) + C - 1) // C
sheet = Image.new("RGB", (C * W, rows * (H + 22)), "#222")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((W, H))
    x, y = (i % C) * W, (i // C) * (H + 22)
    sheet.paste(im, (x, y + 22)); d.text((x + 6, y + 4), os.path.basename(f), fill="#fff")
sheet.save(out, quality=88)
