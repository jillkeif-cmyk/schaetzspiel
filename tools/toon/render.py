"""Renderer für das Toon-Welt-Set.
Rahmen: Vorlagen mit magentafarbenen Flächen (Name, Bild, Text, zwei Medaillons).
Häufig und Selten: Toon-Grimoire. Holo, Ultra, Legendär: Arcane. Extended Art: Vollbild mit Glasflächen.
Aufruf: python3 render.py cards.json motiv_ordner ausgabe_ordner"""
import json, sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops
from scipy import ndimage as nd
HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 880, 1168
A = lambda s: ImageFont.truetype('/tmp/fonts/Anton.ttf', s)
def R(s, w=700, wd=90):
    f = ImageFont.truetype('/tmp/fonts/Archivo.ttf', s)
    try: f.set_variation_by_axes([w, wd])
    except Exception: pass
    return f
GOLD = (255, 214, 90); INK = (26, 20, 12); PAPER = (246, 238, 214)
LABEL = {'haeufig': 'HÄUFIG', 'selten': 'SELTEN', 'holo': 'HOLO', 'ultra': 'ULTRA RARE', 'legend': 'LEGENDÄR', 'ext': 'EXTENDED ART'}

def regions(path):
    im = Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS)
    a = np.array(im).astype(int)
    mag = (a[:, :, 0] > 190) & (a[:, :, 1] < 90) & (a[:, :, 2] > 190)
    mag = nd.binary_opening(mag, iterations=2)
    lab, n = nd.label(mag)
    boxes = []
    for i, sl in enumerate(nd.find_objects(lab), 1):
        ys, xs = sl; area = (lab[sl] == i).sum()
        if area < 800: continue
        boxes.append((xs.start, ys.start, xs.stop, ys.stop, area, i))
    boxes.sort(key=lambda b: -b[4])
    art, text = sorted(boxes[:2], key=lambda b: b[1])
    rest = boxes[2:]
    name = min(rest, key=lambda b: b[1])
    meds = sorted([b for b in rest if b is not name][:2], key=lambda b: b[0])
    # Magenta durch Transparenz ersetzen, damit Inhalte darunter liegen können
    rgba = im.convert('RGBA'); al = np.array(rgba)
    edge = np.zeros(mag.shape, bool); edge[:14, :] = edge[-14:, :] = True; edge[:, :14] = edge[:, -14:] = True
    pinkish = (a[:, :, 0] > 140) & (a[:, :, 2] > 140) & (a[:, :, 1] < 130) & edge
    al[pinkish, 0] = 30; al[pinkish, 1] = 20; al[pinkish, 2] = 40
    soft = nd.binary_dilation(mag, iterations=2)
    al[soft, 3] = 0
    return Image.fromarray(al), {'art': art[:4], 'text': text[:4], 'name': name[:4], 'meds': [m[:4] for m in meds]}

def cover(img, w, h, bias=0.35):
    iw, ih = img.size; s = max(w / iw, h / ih)
    img = img.resize((max(w, int(iw * s + .5)), max(h, int(ih * s + .5))), Image.LANCZOS)
    x = (img.width - w) // 2; y = int((img.height - h) * bias)
    return img.crop((x, y, x + w, y + h))

def fit_text(d, txt, maxw, start, fontf):
    s = start
    while s > 10 and d.textlength(txt, font=fontf(s)) > maxw: s -= 1
    return fontf(s)

def wrap(d, txt, font, maxw):
    words, lines, cur = txt.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def centered(d, box, txt, font, fill, shadow=True, dy=0):
    x0, y0, x1, y1 = box; bb = d.textbbox((0, 0), txt, font=font)
    x = x0 + (x1 - x0 - (bb[2] - bb[0])) / 2 - bb[0]; y = y0 + (y1 - y0 - (bb[3] - bb[1])) / 2 - bb[1] + dy
    if shadow: d.text((x + 2, y + 3), txt, font=font, fill=(0, 0, 0, 160))
    d.text((x, y), txt, font=font, fill=fill)

def holo_overlay(size, strength=70):
    w, h = size; x = np.linspace(0, 1, w)[None, :]; y = np.linspace(0, 1, h)[:, None]
    t = (x * 0.8 + y * 0.6) * 6.28 * 1.5
    r = (np.sin(t) * .5 + .5); g = (np.sin(t + 2.1) * .5 + .5); b = (np.sin(t + 4.2) * .5 + .5)
    arr = np.dstack([r, g, b]) * 255
    o = Image.fromarray(arr.astype('uint8')).convert('RGBA'); o.putalpha(strength); return o

def star(d, cx, cy, r, fill):
    pts = [(cx + math.cos(math.pi / 2 + k * math.pi / 5) * (r if k % 2 == 0 else r * .45), cy - math.sin(math.pi / 2 + k * math.pi / 5) * (r if k % 2 == 0 else r * .45)) for k in range(10)]
    d.polygon(pts, fill=fill)

def text_block(card, box, c, dark):
    x0, y0, x1, y1 = box; d = ImageDraw.Draw(card)
    col = PAPER if dark else INK; sub = (255, 205, 120) if dark else (140, 70, 20)
    d.text((x0 + 22, y0 + 16), f"TOON · {c['theme'].upper()}", font=R(20, 900, 80), fill=GOLD if dark else (150, 105, 20))
    for k in range(min(c['lvl'], 10)): star(d, x1 - 26 - k * 26, y0 + 28, 10, GOLD)
    yy = y0 + 52
    if c['lvl'] >= 7: d.text((x0 + 22, yy), 'Beschwörung: 2 Tribute', font=R(22, 800), fill=sub); yy += 32
    elif c['lvl'] >= 5: d.text((x0 + 22, yy), 'Beschwörung: 1 Tribut', font=R(22, 800), fill=sub); yy += 32
    f = R(24, 600)
    for ln in wrap(d, c['effect'], f, x1 - x0 - 44)[:5]:
        d.text((x0 + 22, yy), ln, font=f, fill=col); yy += 32

def stats(card, meds, c, dark):
    d = ImageDraw.Draw(card)
    for (x0, y0, x1, y1), lab, val, color in zip(meds, ('ATK', 'DEF'), (c['atk'], c['def']), ((255, 140, 120), (140, 200, 255))):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; rr = (x1 - x0) / 2
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(18, 14, 26) if dark else (22, 44, 46))
        centered(d, (x0, y0 + 10, x1, cy - 6), lab, R(17, 900, 80), color, shadow=False)
        centered(d, (x0, cy - 10, x1, y1 - 20), str(val), A(int(rr * 0.5)), (255, 246, 220))

def build(c, motif, out, variant):
    art_img = Image.open(motif).convert('RGB')
    if variant == 'ext': return build_ext(c, art_img, out)
    dark = variant in ('holo', 'ultra', 'legend')
    frame, rg = regions(os.path.join(HERE, 'frame_arcane.png' if dark else 'frame_grimoire.png'))
    card = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    ax0, ay0, ax1, ay1 = rg['art']
    art = cover(art_img, ax1 - ax0 + 8, ay1 - ay0 + 8).convert('RGBA')
    if variant == 'holo': art.alpha_composite(holo_overlay(art.size, 55))
    if variant in ('ultra', 'legend'): art = ImageEnhance.Contrast(art).enhance(1.08)
    card.alpha_composite(art, (ax0 - 4, ay0 - 4))
    tx0, ty0, tx1, ty1 = rg['text']
    panel = Image.new('RGBA', (tx1 - tx0 + 8, ty1 - ty0 + 8), (30, 18, 44, 255) if dark else (240, 228, 196, 255))
    card.alpha_composite(panel, (tx0 - 4, ty0 - 4))
    nx0, ny0, nx1, ny1 = rg['name']
    plate = Image.new('RGBA', (nx1 - nx0 + 8, ny1 - ny0 + 8), (22, 14, 30, 255) if dark else (20, 52, 54, 255))
    card.alpha_composite(plate, (nx0 - 4, ny0 - 4))
    for (x0, y0, x1, y1) in rg['meds']:
        card.alpha_composite(Image.new('RGBA', (x1 - x0 + 8, y1 - y0 + 8), (18, 14, 26, 255)), (x0 - 4, y0 - 4))
    card.alpha_composite(frame)
    d = ImageDraw.Draw(card)
    f = fit_text(d, c['name'].upper(), nx1 - nx0 - 40, 44, A)
    centered(d, (nx0, ny0, nx1, ny1), c['name'].upper(), f, GOLD if variant in ('ultra', 'legend') else (255, 244, 220))
    # Seltenheit oben rechts im Bild
    lab = LABEL[variant]; lf = R(19, 900, 80); tw = d.textlength(lab, font=lf)
    pc = {'haeufig': (200, 205, 200), 'selten': (150, 190, 240), 'holo': (170, 235, 255), 'ultra': GOLD, 'legend': (255, 170, 60)}[variant]
    d.rounded_rectangle([ax1 - tw - 34, ay0 + 14, ax1 - 12, ay0 + 50], radius=10, fill=pc)
    d.text((ax1 - tw - 23, ay0 + 22), lab, font=lf, fill=INK)
    text_block(card, rg['text'], c, dark)
    stats(card, rg['meds'], c, dark)
    nf = R(17, 800, 80); d.text(((tx0 + tx1 - d.textlength(c['num'], font=nf)) / 2, ty1 - 30), c['num'], font=nf, fill=(200, 180, 140) if dark else (120, 100, 70))
    card.convert('RGB').resize((460, 610), Image.LANCZOS).save(out, quality=90, method=6)

def build_ext(c, art_img, out):
    # Motiv füllt die ganze Karte, Glasflächen zeigen dasselbe Bild weichgezeichnet an derselben Stelle
    base = cover(art_img, W, H, bias=0.3).convert('RGBA')
    card = base.copy(); d = ImageDraw.Draw(card)
    def glass(box, r=26, tint=(10, 8, 20, 120)):
        x0, y0, x1, y1 = box
        reg = base.crop(box).filter(ImageFilter.GaussianBlur(14))
        reg = Image.alpha_composite(reg, Image.new('RGBA', reg.size, tint))
        m = Image.new('L', reg.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, reg.width - 1, reg.height - 1], radius=r, fill=255)
        card.paste(reg, (x0, y0), m)
        ImageDraw.Draw(card).rounded_rectangle(box, radius=r, outline=(255, 235, 170, 170), width=2)
    glass((40, 34, W - 40, 110), r=22)
    f = fit_text(d, c['name'].upper(), W - 200, 46, A)
    centered(ImageDraw.Draw(card), (40, 34, W - 40, 110), c['name'].upper(), f, GOLD)
    glass((40, H - 330, W - 40, H - 44), r=28)
    text_block(card, (40, H - 330, W - 40, H - 150), c, True)
    d = ImageDraw.Draw(card)
    for i, (lab, val, col) in enumerate((('ATK', c['atk'], (255, 150, 130)), ('DEF', c['def'], (150, 205, 255)))):
        x = W - 330 + i * 150; y = H - 128
        d.rounded_rectangle([x, y, x + 132, y + 64], radius=16, fill=(12, 10, 20, 200), outline=(255, 230, 160, 160), width=2)
        d.text((x + 14, y + 8), lab, font=R(17, 900, 80), fill=col)
        d.text((x + 14, y + 26), str(val), font=A(32), fill=(255, 246, 220))
    lf = R(19, 900, 80); lab = 'EXTENDED ART'; tw = d.textlength(lab, font=lf)
    d.rounded_rectangle([60, H - 120, 60 + tw + 22, H - 84], radius=10, fill=(255, 170, 60))
    d.text((71, H - 112), lab, font=lf, fill=INK)
    d.text((60, H - 74), c['num'], font=R(18, 800, 80), fill=(255, 226, 150))
    # dünner Holo-Goldrand
    edge = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ed = ImageDraw.Draw(edge)
    ed.rounded_rectangle([6, 6, W - 7, H - 7], radius=34, outline=(255, 215, 110, 255), width=10)
    holo = holo_overlay((W, H), 255); m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).rounded_rectangle([6, 6, W - 7, H - 7], radius=34, outline=255, width=10)
    edge = Image.composite(Image.blend(edge.convert('RGB'), holo.convert('RGB'), .45).convert('RGBA'), Image.new('RGBA', (W, H), (0, 0, 0, 0)), m)
    card.alpha_composite(edge)
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], radius=40, fill=255)
    bg = Image.new('RGBA', (W, H), (0, 0, 0, 255)); bg.paste(card, (0, 0), mask)
    bg.convert('RGB').resize((460, 610), Image.LANCZOS).save(out, quality=90, method=6)

if __name__ == '__main__':
    cards = json.load(open(sys.argv[1])); src = sys.argv[2]; dst = sys.argv[3]
    only = sys.argv[4].split(',') if len(sys.argv) > 4 else None
    for i, row in enumerate(cards):
        cid, name, rar, theme, lvl, atk, dfs, eff = row[:8]
        if only and cid not in only: continue
        c = dict(name=name, theme=theme, lvl=lvl, atk=atk, def_=dfs, effect=eff, num=f'Toon-Welt {i + 1:02d}/30'); c['def'] = dfs
        m = os.path.join(src, cid + '.png')
        if not os.path.exists(m): continue
        build(c, m, os.path.join(dst, f'{cid}_{rar}.webp'), rar)
        if rar == 'legend': build(c, m, os.path.join(dst, f'{cid}_ext.webp'), 'ext')
    print('fertig')
