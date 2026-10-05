#!/usr/bin/env python3
"""Round 16 character assets: key out magenta, slice the farmer sheet into
12 frames (4 dirs x idle/walkA/walkB) with one shared scale per character,
trim the four single characters, build a contact sheet."""
import glob
import os
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw16')
OUT = os.path.join(HERE, 'game')
os.makedirs(OUT, exist_ok=True)


def key_magenta(im):
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):  # key
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 130 and b > 130 and g < min(r, b) - 45:
                px[x, y] = (r, g, b, 0)
    alpha = im.getchannel('A').filter(ImageFilter.MinFilter(3))
    im.putalpha(alpha)
    return im


def content(im):
    bbox = im.getchannel('A').getbbox()
    return im.crop(bbox) if bbox else im


def find(name_part):
    hits = sorted(glob.glob(os.path.join(RAW, f'*{name_part}*.webp'))) + \
        sorted(glob.glob(os.path.join(RAW, f'*{name_part}*.png')))
    if not hits:
        raise SystemExit(f'raw image not found: {name_part}')
    return hits[0]


results = []

# ---- farmer sheet: 4 rows (down, up, left, right) x 3 cols (idle, walkA, walkB)
sheet = key_magenta(Image.open(find('sheet-farmer')))
W, H = sheet.size
rows = ['down', 'up', 'left', 'right']
cells = {}
max_h = 0
for r, dname in enumerate(rows):
    for c in range(3):
        cell = sheet.crop((c * W // 3, r * H // 4, (c + 1) * W // 3, (r + 1) * H // 4))
        cell = content(cell)
        cells[(dname, c)] = cell
        max_h = max(max_h, cell.height)
TARGET_H = 384
for (dname, c), cell in cells.items():
    scale = TARGET_H / max_h
    nw, nh = max(1, round(cell.width * scale)), max(1, round(cell.height * scale))
    cell = cell.resize((nw, nh), Image.LANCZOS)
    canvas_w = max(nw, 200)
    canvas = Image.new('RGBA', (canvas_w, TARGET_H), (0, 0, 0, 0))
    canvas.paste(cell, ((canvas_w - nw) // 2, TARGET_H - nh), cell)
    name = f'char-farmer-{dname}-{c}.png'
    canvas.save(os.path.join(OUT, name))
    results.append((name, canvas))
    print(f'{name}: cell -> {canvas.size}')

# ---- singles: mayor / merchant / hunter / bandit (front view)
for key, out_name in [('char-mayor', 'char-mayor.png'), ('char-merchant', 'char-merchant.png'),
                      ('char-hunter', 'char-hunter.png'), ('char-bandit', 'char-bandit.png')]:
    im = content(key_magenta(Image.open(find(key))))
    im.save(os.path.join(OUT, out_name))
    results.append((out_name, im))
    print(f'{out_name}: {im.size}')

# ---- contact sheet
cols = 4
cell_w, cell_h = 220, 420
rows_n = (len(results) + cols - 1) // cols
sheet_im = Image.new('RGBA', (cols * cell_w, rows_n * cell_h), (240, 240, 235, 255))
for i, (_, im) in enumerate(results):
    thumb = im.copy()
    thumb.thumbnail((cell_w - 16, cell_h - 16), Image.LANCZOS)
    x = (i % cols) * cell_w + (cell_w - thumb.width) // 2
    y = (i // cols) * cell_h + (cell_h - thumb.height) // 2
    sheet_im.paste(thumb, (x, y), thumb)
sheet_path = os.path.join(HERE, 'contact-sheet-16.png')
sheet_im.save(sheet_path)
print('contact sheet:', sheet_path, sheet_im.size, 'items:', len(results))
