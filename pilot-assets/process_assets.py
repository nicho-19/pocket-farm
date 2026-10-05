#!/usr/bin/env python3
"""Process all round-15 asset sheets: key out, split, downscale, contact sheet, grass seam test."""
import os
from PIL import Image, ImageDraw, ImageFilter

RAW = os.path.expanduser('~/workspace/codex-projects/pocket-farm/pilot-assets/raw')
SRC = os.path.expanduser('~/workspace/codex-projects/pocket-farm/pilot-assets')
GAME = os.path.join(SRC, 'game')
os.makedirs(GAME, exist_ok=True)

def key_out(path):
    img = Image.open(path).convert('RGB')
    w, h = img.size
    alpha = Image.new('L', (w, h), 255)
    ip = img.load(); ap = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b = ip[x, y]
            if r > 130 and b > 130 and g < min(r, b) - 45:
                ap[x, y] = 0
    out = img.convert('RGBA')
    out.putalpha(alpha.getchannel('A') if False else alpha)
    a = out.getchannel('A').filter(ImageFilter.MinFilter(3))
    out.putalpha(a)
    return out

def split_columns(img, min_w=40):
    a = img.getchannel('A'); w, h = img.size; ap = a.load()
    colsum = [sum(1 for y in range(h) if ap[x, y] > 10) for x in range(w)]
    runs = []; x = 0
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

def save_game(sprite, name, target_w):
    scale = target_w / sprite.width
    nw, nh = target_w, max(1, round(sprite.height * scale))
    sp = sprite.resize((nw, nh), Image.LANCZOS)
    sp.save(os.path.join(GAME, name + '.png'))
    return sp

jobs = [
    ('media-generation-sheet-huts-0-4946b64f-a520-4a76-acf9-2f277fbbde97.png',
     ['hut-blue', 'hut-red', 'hut-green'], 640),
    ('media-generation-sheet-props-0-e8df0221-480d-4f37-a1e3-012c92b7a6fd.png',
     ['node-stump', 'node-berry', 'node-rock', 'prop-scarecrow', 'prop-fence'], 320),
    ('media-generation-sheet-radish-0-3cd7d8e7-c001-4557-b296-7f8c14c5ef65.png',
     ['crop-carrot-1', 'crop-carrot-2', 'crop-carrot-3', 'crop-carrot-4'], 320),
    ('media-generation-sheet-potato-0-2587a4e2-7043-4f64-a2e3-2280c87cc3a8.png',
     ['crop-potato-1', 'crop-potato-2', 'crop-potato-3', 'crop-potato-4'], 320),
    ('media-generation-sheet-strawberry-0-5a4fbea6-9796-4e17-9188-5344a7d41eab.png',
     ['crop-strawberry-1', 'crop-strawberry-2', 'crop-strawberry-3', 'crop-strawberry-4'], 320),
    ('media-generation-sheet-pumpkin4-0-092e9785-a701-4be7-a363-6b59fb7194f2.png',
     ['crop-pumpkin-1', 'crop-pumpkin-2', 'crop-pumpkin-3', 'crop-pumpkin-4'], 320),
    ('media-generation-sheet-corn4-0-79d7e7f0-1bbf-4524-aeee-4fb23cb89b8c.png',
     ['crop-corn-1', 'crop-corn-2', 'crop-corn-3', 'crop-corn-4'], 320),
]
all_sprites = {}
for raw_name, names, tw in jobs:
    img = key_out(os.path.join(RAW, raw_name))
    sprites = split_columns(img)
    print(raw_name[:44], '->', len(sprites), 'expected', len(names))
    assert len(sprites) == len(names), (raw_name, len(sprites))
    for name, sp in zip(names, sprites):
        all_sprites[name] = save_game(sp, name, tw)
        print('  ', name, all_sprites[name].size)

# pilot sprites resized into game set too
for src_name, game_name, tw in [('house', 'house', 768), ('tree-broadleaf', 'tree-broadleaf', 512),
                                ('tree-pine', 'tree-pine', 512)]:
    sp = Image.open(os.path.join(SRC, src_name + '.png'))
    all_sprites[game_name] = save_game(sp, game_name, tw)
    print('pilot', game_name, all_sprites[game_name].size)

# contact sheet of the whole game set
names = sorted(all_sprites)
cols, cell = 6, 240
rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell, rows * cell), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for j in range(rows * cell // 20 + 1):
    for i in range(cols * cell // 20 + 1):
        if (i + j) % 2 == 0:
            d.rectangle([i * 20, j * 20, i * 20 + 19, j * 20 + 19], fill=(200, 200, 200))
for idx, name in enumerate(names):
    sp = all_sprites[name]
    cx, cy = (idx % cols) * cell, (idx // cols) * cell
    scale = min((cell - 16) / sp.width, (cell - 16) / sp.height)
    nw, nh = max(1, int(sp.width * scale)), max(1, int(sp.height * scale))
    r = sp.resize((nw, nh), Image.LANCZOS)
    sheet.paste(r, (cx + (cell - nw) // 2, cy + (cell - nh) // 2), r)
sheet.save(os.path.join(SRC, 'contact-sheet-15.png'))
print('contact sheet 15:', len(names), 'sprites')

# grass texture: seam test
tex = Image.open(os.path.join(RAW, 'media-generation-tex-grass-0-50e663ad-f4d1-4559-bc75-daa3a5ce5b55.png')).convert('RGB')
tile = tex.resize((512, 512), Image.LANCZOS)
tile.save(os.path.join(GAME, 'tex-grass.png'))
quad = Image.new('RGB', (1024, 1024))
for yy in (0, 512):
    for xx in (0, 512):
        quad.paste(tile, (xx, yy))
quad.save(os.path.join(SRC, 'grass-tile-test.png'))
# seam metric: mean abs diff across the vertical seam vs average interior column diff
px = quad.convert('L').load()
def col_diff(x):
    return sum(abs(px[x, y] - px[x - 1, y]) for y in range(0, 1024, 4)) / 256
seam = col_diff(512)
interior = sum(col_diff(x) for x in (100, 300, 700, 900)) / 4
print(f'grass seam metric: seam={seam:.2f} interior={interior:.2f} ratio={seam / interior:.2f}')
total = sum(os.path.getsize(os.path.join(GAME, f)) for f in os.listdir(GAME))
print(f'game asset dir total: {total / 1024:.0f} KiB, files: {len(os.listdir(GAME))}')
