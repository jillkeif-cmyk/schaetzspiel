"""Freistellen von Higgsfield-Bildern mit schwarzem Hintergrund.
Aufruf: python3 cutout.py quelle.png ziel.webp [emblem|ring|banner] [groesse]
- emblem: Objekt auf Schwarz, Hintergrund von den Rändern her entfernen
- ring:   Profilrahmen, zusätzlich das schwarze Innere entfernen
- banner: Titel-Banner 880x200 mit abgerundeten Ecken
"""
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage as nd

def cut(src, dst, size=256, ring=False):
    im = Image.open(src).convert('RGB'); a = np.array(im).max(axis=2)
    dark = a <= 22; lab, c = nd.label(dark); sizes = nd.sum(dark, lab, range(1, c + 1))
    if ring:
        keep = np.zeros_like(dark)
        for i, sz in enumerate(sizes, 1):
            if sz > 2500: keep |= (lab == i)
    else:
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        keep = np.isin(lab, list(edge))
    alpha = Image.fromarray(np.where(keep, 0, 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    r = im.copy(); r.putalpha(alpha); r = r.crop(alpha.point(lambda v: 255 if v > 8 else 0).getbbox())
    w, h = r.size; s = max(w, h) if ring else int(max(w, h) * 1.04)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(r, ((s - w) // 2, (s - h) // 2))
    sq.resize((size, size), Image.LANCZOS).save(dst, quality=88, method=6)

def banner(src, dst, W=880, H=200):
    im = Image.open(src).convert('RGB'); w, h = im.size; ch = int(w * H / W); top = max(0, (h - ch) // 2)
    im = im.crop((0, top, w, top + ch)).resize((W, H), Image.LANCZOS).convert('RGBA')
    d = ImageDraw.Draw(im); d.rounded_rectangle([1, 1, W - 2, H - 2], radius=18, outline=(255, 255, 255, 70), width=3)
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, W - 1, H - 1], radius=18, fill=255); im.putalpha(m)
    im.save(dst, quality=88, method=6)

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    kind = sys.argv[3] if len(sys.argv) > 3 else 'emblem'
    size = int(sys.argv[4]) if len(sys.argv) > 4 else 256
    if kind == 'banner': banner(src, dst)
    else: cut(src, dst, size, ring=(kind == 'ring'))
