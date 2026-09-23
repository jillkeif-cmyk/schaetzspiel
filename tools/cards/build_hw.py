"""Halloween-Karten (Set Gruselnacht): Rahmenvorlage mit magentafarbenen Feldern, Felder werden automatisch erkannt.
build(frame, art, out, name=..., rar=..., extended=False) -> PIL-Bild. rar: haeufig, selten, holo, ultra, legend, ext, ghost"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageEnhance
from scipy import ndimage as nd
import numpy as np
sys.path.insert(0, '/home/claude/schaetzspiel/tools/cards')

def A(s): return ImageFont.truetype('/tmp/fonts/Anton.ttf', s)
def R(s, w=600, wd=95):
    f = ImageFont.truetype('/tmp/fonts/Archivo.ttf', s)
    try: f.set_variation_by_axes([wd, w])
    except Exception: pass
    return f
PAPER = (246, 238, 222); GOLD = (255, 200, 90); ORANGE = (255, 140, 40)
LABEL = {'haeufig': 'HÄUFIG', 'selten': 'SELTEN', 'holo': 'HOLO', 'ultra': 'ULTRA RARE', 'legend': 'LEGENDÄR', 'ext': 'EXTENDED ART', 'ghost': 'GHOST RARE', 'mythic': 'MYTHISCH'}

_cache = {}
def load_frame(path):
    if path in _cache: return _cache[path]
    fr = Image.open(path).convert('RGB'); W, H = fr.size
    a = np.array(fr).astype(int)
    mag = (a[:, :, 0] > 170) & (a[:, :, 1] < 110) & (a[:, :, 2] > 170)
    mag = nd.binary_opening(mag, iterations=2)
    lab, n = nd.label(mag); boxes = []
    for sl in nd.find_objects(lab):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        if (x1 - x0) * (y1 - y0) > 1500: boxes.append((x0, y0, x1, y1))
    boxes.sort(key=lambda b: (b[1], b[0]))
    name = min(boxes, key=lambda b: b[1]); rest = [b for b in boxes if b != name]
    big = sorted(rest, key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    art, text = sorted(big[:2], key=lambda b: b[1]); stats = sorted([b for b in rest if b not in (art, text)], key=lambda b: b[0])[-2:]
    alpha = Image.fromarray(np.where(nd.binary_dilation(mag, iterations=2), 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(.8))
    _cache[path] = dict(img=fr, W=W, H=H, NAME=name, ART=art, TEXT=text, STATS=stats, alpha=alpha)
    return _cache[path]

def fit(img, box, top=0.12):
    # Beschnitt nur wo nötig; wenn oben und unten etwas weg muss, fast alles unten wegnehmen (Köpfe bleiben)
    bw, bh = box; ar = img.width / img.height; th = bh; tw = int(th * ar)
    if tw < bw: tw = bw; th = int(tw / ar)
    img = img.resize((tw, th), Image.LANCZOS)
    y = int((th - bh) * top)
    return img.crop(((tw - bw) // 2, y, (tw - bw) // 2 + bw, y + bh))

def prism(size, strength=1.0, shift=0.0):
    w, h = size
    x = np.linspace(0, 1, w)[None, :].repeat(h, 0); y = np.linspace(0, 1, h)[:, None].repeat(w, 1)
    cx, cy = 0.5 + 0.35 * np.cos(shift * 6.283), 0.45 + 0.3 * np.sin(shift * 6.283)
    d = np.sqrt(((x - cx) * 1.15) ** 2 + (y - cy) ** 2); t = (d * 1.25 + shift) % 1.0
    r = np.sin(2 * np.pi * t) * .5 + .5; g = np.sin(2 * np.pi * (t + .33)) * .5 + .5; b = np.sin(2 * np.pi * (t + .66)) * .5 + .5
    sp = nd.gaussian_filter((np.random.default_rng(7).random((h, w)) > 0.9985).astype(float), 1.6) * 90
    a = (0.14 + 0.5 * np.exp(-(d ** 2) / (2 * 0.42 ** 2))) * strength
    arr = np.dstack([r * 255 * a + sp, g * 255 * a + sp, b * 255 * a + sp])
    return Image.fromarray(np.clip(arr, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(max(2, int(min(w, h) * 0.012))))

def frame_layer(F, rar, opacity=1.0, shift=0.0):
    col = F['img'].copy()
    if rar == 'haeufig': col = ImageEnhance.Color(col).enhance(.55)
    if rar in ('ultra', 'legend', 'ghost', 'ext', 'mythic'): col = ImageChops.screen(col, prism((F['W'], F['H']), .5 if rar != 'ghost' else .4, shift + .2))
    if rar == 'ghost': col = ImageEnhance.Brightness(ImageEnhance.Color(col).enhance(.3)).enhance(1.35)
    lay = col.convert('RGBA'); al = F['alpha']
    if opacity < 1: al = al.point(lambda v: int(v * opacity))
    lay.putalpha(al); return lay

def star(d, cx, cy, r, fill, outline):
    pts = [(cx + (r if k % 2 == 0 else r * .45) * np.cos(-np.pi / 2 + k * np.pi / 5), cy + (r if k % 2 == 0 else r * .45) * np.sin(-np.pi / 2 + k * np.pi / 5)) for k in range(10)]
    d.polygon(pts, fill=fill, outline=outline)

def wrap(d, text, f, maxw):
    out, cur = [], ''
    for wd in text.split():
        s = (cur + ' ' + wd).strip()
        if d.textlength(s, font=f) <= maxw: cur = s
        else: out.append(cur); cur = wd
    out.append(cur); return out

def build(frame, art, out=None, *, name, theme, rar, lvl, atk, dfs, effect, tribute='', num='', extended=False, shift=0.0, art_img=None):
    F = load_frame(frame); W, H = F['W'], F['H']; ART, TEXT, NAME = F['ART'], F['TEXT'], F['NAME']
    src = art_img if art_img is not None else Image.open(art).convert('RGB')
    card = Image.new('RGBA', (W, H), (14, 6, 20, 255))
    if extended:
        # Vollbild: Motiv über die ganze Karte, Rahmen halb durchsichtig darüber
        full = fit(src, (W, H)); card.paste(full, (0, 0))
        card = ImageChops.screen(card.convert('RGB'), prism((W, H), .45, shift)).convert('RGBA')
        card = Image.alpha_composite(card, frame_layer(F, 'ext', .5, shift))
        pl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); pd = ImageDraw.Draw(pl)
        pd.rounded_rectangle(NAME, radius=10, fill=(10, 4, 16, 170)); pd.rounded_rectangle(TEXT, radius=16, fill=(10, 4, 16, 185))
        for b in F['STATS']: pd.rounded_rectangle(b, radius=8, fill=(10, 4, 16, 200))
        card = Image.alpha_composite(card, pl)
    else:
        x0, y0, x1, y1 = ART; win = fit(src, (x1 - x0, y1 - y0))
        if rar in ('holo', 'ultra', 'legend'): win = ImageChops.screen(win, prism(win.size, .7 if rar == 'holo' else .55, shift))
        if rar == 'ghost':
            g = win.convert('L'); win = Image.merge('RGB', [g.point(lambda v: min(255, int(v * 1.05 + 10))), g.point(lambda v: min(255, int(v * 1.1 + 20))), g.point(lambda v: min(255, int(v * 1.12 + 26)))])
            win = ImageChops.screen(ImageEnhance.Contrast(win).enhance(1.2), prism(win.size, .45, shift))
        card.paste(win, (x0, y0)); d0 = ImageDraw.Draw(card)
        d0.rectangle(TEXT, fill=(32, 16, 40)); d0.rectangle(NAME, fill=(16, 6, 22))
        for b in F['STATS']: d0.rectangle(b, fill=(16, 6, 22))
        card = Image.alpha_composite(card, frame_layer(F, rar, 1, shift))
    d = ImageDraw.Draw(card)
    nx0, ny0, nx1, ny1 = NAME; nh = ny1 - ny0
    lab = LABEL['ext' if extended and rar != 'mythic' else rar]; lf = R(max(14, int(nh * .38)), 900, 80); lw = d.textlength(lab, font=lf)
    plate = GOLD if rar in ('legend', 'ultra', 'mythic') or extended else (226, 238, 246) if rar == 'ghost' else (120, 70, 150)
    d.rounded_rectangle([nx1 - lw - 30, ny0 + nh * .18, nx1 - 8, ny1 - nh * .18], radius=8, fill=plate)
    d.text((nx1 - lw - 19, ny0 + nh * .5), lab, font=lf, fill=(20, 8, 24) if plate != (120, 70, 150) else (250, 236, 255), anchor='lm')
    f = A(int(nh * .72))
    while d.textlength(name, font=f) > (nx1 - nx0 - lw - 60): f = A(f.size - 2)
    d.text((nx0 + 16 + 2, ny0 + nh * .5 + 2), name, font=f, fill=(0, 0, 0), anchor='lm')
    d.text((nx0 + 16, ny0 + nh * .5), name, font=f, fill=GOLD if rar in ('legend', 'ultra', 'ghost') or extended else PAPER, anchor='lm')
    # Sterne und Thema unten im Bild
    ax0, ay0, ax1, ay1 = ART; cy = ay1 - 30
    pl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(pl).rounded_rectangle([ax0 + 8, cy - 22, ax1 - 8, cy + 22], radius=14, fill=(12, 4, 18, 190))
    card.alpha_composite(pl); d = ImageDraw.Draw(card)
    for i in range(lvl): star(d, ax0 + 36 + i * 40, cy, 16, ORANGE, (120, 50, 0))
    tf = R(20, 900, 78); d.text((ax1 - 22, cy), theme.upper(), font=tf, fill=(255, 200, 150), anchor='rm')
    # Effekt
    tx0, ty0, tx1, ty1 = TEXT
    d.text((tx0 + 24, ty0 + 18), 'EFFEKT', font=R(20, 900, 80), fill=ORANGE)
    yy = ty0 + 52
    if tribute:
        for l in wrap(d, tribute, R(23, 800), tx1 - tx0 - 48): d.text((tx0 + 24, yy), l, font=R(23, 800), fill=(255, 170, 110)); yy += 32
        yy += 4
    for l in wrap(d, effect, R(24, 500), tx1 - tx0 - 48): d.text((tx0 + 24, yy), l, font=R(24, 500), fill=PAPER); yy += 32
    # ATK / DEF
    for b, lbl, val, col in zip(F['STATS'], ('ATK', 'DEF'), (atk, dfs), ((255, 150, 110), (170, 200, 255))):
        cx = (b[0] + b[2]) / 2
        d.text((cx, b[1] + (b[3] - b[1]) * .28), lbl, font=R(15, 900, 80), fill=(210, 190, 220), anchor='mm')
        d.text((cx, b[1] + (b[3] - b[1]) * .66), str(atk if lbl == 'ATK' else dfs), font=A(int((b[3] - b[1]) * .36)), fill=col, anchor='mm')
    if num: d.text((tx0 + 24, ty1 - 30), num, font=R(18, 800, 80), fill=(180, 150, 190))
    card = card.convert('RGB')
    if out: card.save(out, quality=90)
    return card
