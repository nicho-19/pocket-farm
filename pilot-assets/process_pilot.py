#!/usr/bin/env python3
"""Pilot asset processing: magenta key-out, split sprites, compose a test scene."""
import os, random
from PIL import Image, ImageDraw, ImageFilter

RAW = os.path.expanduser('~/workspace/codex-projects/pocket-farm/pilot-assets/raw')
OUT = os.path.expanduser('~/workspace/codex-projects/pocket-farm/pilot-assets')
os.makedirs(OUT, exist_ok=True)

def key_out(path):
    img = Image.open(path).convert('RGB')
    px = img.load()
    w, h = img.size
    alpha = Image.new('L', (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            # magenta: high red+blue, low green
            if r > 130 and b > 130 and g < min(r, b) - 45:
                ap[x, y] = 0
    out = img.convert('RGBA')
    out.putalpha(alpha)
    # erode alpha 1px to kill magenta fringe
    a = out.getchannel('A').filter(ImageFilter.MinFilter(3))
    # despill: pixels still carrying magenta cast near edges
    rgb = out.convert('RGB')
    rp = rgb.load(); ap2 = a.load()
    for y in range(h):
        for x in range(w):
            if 0 < ap2[x, y] < 255 or (ap2[x, y] == 255 and x > 0 and ap2[x-1, y] == 0):
                r, g, b = rp[x, y]
                if r > 120 and b > 120 and g < min(r, b) - 30:
                    rp[x, y] = (r, max(g, (r + b) // 3), b)
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out

def split_columns(img, min_w=60):
    a = img.getchannel('A')
    w, h = img.size
    ap = a.load()
    colsum = [0] * w
    for x in range(w):
        s = 0
        for y in range(h):
            if ap[x, y] > 10:
                s += 1
        colsum[x] = s
    runs = []
    x = 0
    while x < w:
        if colsum[x] > 0:
            x0 = x
            while x < w and colsum[x] > 0:
                x += 1
            if x - x0 >= min_w:
                runs.append((x0, x))
        else:
            x += 1
    sprites = []
    for (x0, x1) in runs:
        crop = img.crop((x0, 0, x1, h))
        bbox = crop.getchannel('A').getbbox()
        if bbox:
            sprites.append(crop.crop(bbox))
    return sprites

jobs = {
    'media-generation-sprite-house-0-e4152252-0d67-48ee-8d08-5f82cc05e855.png': ['house'],
    'media-generation-sprite-trees-0-fc714ce5-60ea-48ae-a5fd-13088bece93e.png': ['tree-broadleaf', 'tree-pine'],
    'media-generation-sprite-crops-0-1711a5ac-55c9-4655-9024-8738b1a0b158.png': ['crop-pumpkin', 'crop-corn', 'crop-carrot'],
}
saved = {}
for raw_name, names in jobs.items():
    img = key_out(os.path.join(RAW, raw_name))
    sprites = split_columns(img)
    print(raw_name, '->', len(sprites), 'sprites')
    assert len(sprites) == len(names), (raw_name, len(sprites), len(names))
    for name, sp in zip(names, sprites):
        sp.save(os.path.join(OUT, name + '.png'))
        saved[name] = sp
        print(' ', name, sp.size)

# ---------- contact sheet on checkerboard ----------
names = ['house', 'tree-broadleaf', 'tree-pine', 'crop-pumpkin', 'crop-corn', 'crop-carrot']
cell = 360
sheet = Image.new('RGB', (cell * 3, cell * 2), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for j in range(cell * 2 // 24 + 1):
    for i in range(cell * 3 // 24 + 1):
        if (i + j) % 2 == 0:
            d.rectangle([i * 24, j * 24, i * 24 + 23, j * 24 + 23], fill=(198, 198, 198))
for idx, name in enumerate(names):
    sp = saved[name]
    cx, cy = (idx % 3) * cell, (idx // 3) * cell
    scale = min((cell - 30) / sp.width, (cell - 30) / sp.height)
    nw, nh = max(1, int(sp.width * scale)), max(1, int(sp.height * scale))
    sheet.paste(sp.resize((nw, nh), Image.LANCZOS), (cx + (cell - nw) // 2, cy + (cell - nh) // 2), sp.resize((nw, nh), Image.LANCZOS))
sheet.save(os.path.join(OUT, 'contact-sheet.png'))
print('contact sheet done')

# ---------- composed pilot scene, 1536x1152 (cell 96) ----------
W, H, C = 1536, 1152, 96
random.seed(14)
scene = Image.new('RGB', (W, H), (142, 183, 107))
d = ImageDraw.Draw(scene, 'RGBA')
# grass patches and speckles
for _ in range(2600):
    x, y = random.randrange(W), random.randrange(H)
    c = random.choice([(117, 160, 93), (167, 201, 110), (79, 127, 75), (185, 206, 128)])
    s = random.choice([3, 4, 5, 6])
    d.rectangle([x, y, x + s, y + s], fill=c)
for _ in range(90):  # tiny flowers
    x, y = random.randrange(W), random.randrange(H)
    c = random.choice([(245, 238, 220), (233, 202, 100), (232, 165, 174)])
    d.rectangle([x, y, x + 5, y + 5], fill=c)
# dirt path (column cells 9..10)
d.rectangle([9 * C, 0, 11 * C, H], fill=(185, 162, 118))
for _ in range(700):
    x, y = random.randrange(9 * C, 11 * C), random.randrange(H)
    c = random.choice([(141, 118, 85), (211, 192, 154), (158, 137, 104)])
    d.rectangle([x, y, x + 4, y + 4], fill=c)
# soil patch: cells (1..4, 6..8)
d.rectangle([1 * C, 6 * C, 5 * C, 9 * C], fill=(138, 98, 73))
for r in range(6, 9):
    for i in range(5):
        y = r * C + 14 + i * 18
        d.rectangle([1 * C + 6, y, 5 * C - 6, y + 5], fill=(104, 71, 51))
for _ in range(400):
    x, y = random.randrange(1 * C, 5 * C), random.randrange(6 * C, 9 * C)
    d.rectangle([x, y, x + 4, y + 4], fill=random.choice([(183, 142, 101), (120, 84, 58)]))
# fence row above soil
for x in range(1 * C, 5 * C, 48):
    d.rectangle([x + 6, 6 * C - 26, x + 14, 6 * C], fill=(113, 76, 53))
d.rectangle([1 * C, 6 * C - 20, 5 * C, 6 * C - 13], fill=(157, 107, 67))

def paste_bottom(sprite, cx, by, target_w):
    scale = target_w / sprite.width
    nw, nh = int(sprite.width * scale), int(sprite.height * scale)
    sp = sprite.resize((nw, nh), Image.LANCZOS)
    # soft contact shadow
    d.ellipse([cx - nw // 2 + 10, by - 16, cx + nw // 2 - 10, by + 8], fill=(53, 82, 65, 90))
    scene.paste(sp, (cx - nw // 2, by - nh), sp)
    return nh

# trees along the top and right
paste_bottom(saved['tree-pine'], int(0.8 * C), int(2.6 * C), int(2.2 * C))
paste_bottom(saved['tree-broadleaf'], int(3.4 * C), int(2.8 * C), int(2.6 * C))
paste_bottom(saved['tree-broadleaf'], int(13.6 * C), int(3.0 * C), int(2.4 * C))
paste_bottom(saved['tree-pine'], int(15.2 * C), int(5.4 * C), int(2.0 * C))
# house center-top (door faces path)
paste_bottom(saved['house'], int(7.6 * C), int(4.4 * C), int(5.2 * C))
# crops on soil rows, bottom-anchored per cell
paste_bottom(saved['crop-pumpkin'], int(1.7 * C), int(7.0 * C), int(1.15 * C))
paste_bottom(saved['crop-corn'], int(3.0 * C), int(7.0 * C), int(0.95 * C))
paste_bottom(saved['crop-carrot'], int(4.3 * C), int(7.0 * C), int(1.1 * C))
paste_bottom(saved['crop-corn'], int(1.7 * C), int(8.6 * C), int(0.95 * C))
paste_bottom(saved['crop-pumpkin'], int(3.0 * C), int(8.6 * C), int(1.15 * C))
paste_bottom(saved['crop-carrot'], int(4.3 * C), int(8.6 * C), int(1.1 * C))
scene.save(os.path.join(OUT, 'pilot-scene.png'))
print('scene done', scene.size)
