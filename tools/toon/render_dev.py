# Entwickler-Karten im Stil "Mythisch": Vollbild-Motiv, Glasflächen, dicker Regenbogenrahmen mit Sternen
import sys, math
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, __file__.rsplit('/', 1)[0])
import render as R0
W, H, GOLD, INK = R0.W, R0.H, R0.GOLD, R0.INK

def rainbow(size):
    w, h = size; img = Image.new('RGB', size); px = img.load()
    cx, cy = w / 2, h / 2
    cols = [(255, 79, 163), (255, 210, 63), (61, 220, 151), (90, 169, 255), (180, 92, 255), (255, 79, 163)]
    for y in range(h):
        for x in range(w):
            a = (math.atan2(y - cy, x - cx) / (2 * math.pi) + 0.5) * (len(cols) - 1)
            i = int(a); f = a - i; c0, c1 = cols[i], cols[min(i + 1, len(cols) - 1)]
            px[x, y] = tuple(int(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
    return img

def build(c, motif, out):
    art = Image.open(motif).convert('RGB')
    base = R0.cover(art, W, H, bias=0.22).convert('RGBA')
    card = base.copy()
    def glass(box, r=26, tint=(14, 6, 26, 130)):
        x0, y0, x1, y1 = box
        reg = base.crop(box).filter(ImageFilter.GaussianBlur(14))
        reg = Image.alpha_composite(reg, Image.new('RGBA', reg.size, tint))
        m = Image.new('L', reg.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, reg.width - 1, reg.height - 1], radius=r, fill=255)
        card.paste(reg, (x0, y0), m)
        ImageDraw.Draw(card).rounded_rectangle(box, radius=r, outline=(255, 240, 200, 200), width=2)
    glass((46, 40, W - 46, 118), r=22)
    d = ImageDraw.Draw(card)
    f = R0.fit_text(d, c['name'].upper(), W - 220, 46, R0.A)
    R0.centered(d, (46, 40, W - 46, 118), c['name'].upper(), f, GOLD)
    glass((46, H - 336, W - 46, H - 50), r=28)
    R0.text_block(card, (46, H - 336, W - 46, H - 156), c, True)
    d = ImageDraw.Draw(card)
    for i, (lab, val, col) in enumerate((('ATK', c['atk'], (255, 150, 130)), ('DEF', c['def'], (150, 205, 255)))):
        x = W - 336 + i * 150; y = H - 134
        d.rounded_rectangle([x, y, x + 132, y + 64], radius=16, fill=(16, 8, 28, 210), outline=(255, 230, 160, 180), width=2)
        d.text((x + 14, y + 8), lab, font=R0.R(17, 900, 80), fill=col)
        d.text((x + 14, y + 26), str(val), font=R0.A(32), fill=(255, 246, 220))
    lf = R0.R(20, 900, 80); lab = 'MYTHISCH'; tw = d.textlength(lab, font=lf)
    pill = rainbow((int(tw) + 74, 38)); pm = Image.new('L', pill.size, 0); ImageDraw.Draw(pm).rounded_rectangle([0, 0, pill.width - 1, pill.height - 1], radius=12, fill=255)
    card.paste(pill, (64, H - 128), pm)
    dd = ImageDraw.Draw(card)
    R0.star(dd, 64 + 20, H - 109, 9, (255, 255, 255)); R0.star(dd, 64 + pill.width - 20, H - 109, 9, (255, 255, 255))  # Sterne statt Sonderzeichen
    dd.text((64 + 37, H - 120), lab, font=lf, fill=(255, 255, 255))
    ImageDraw.Draw(card).text((64, H - 80), c['num'], font=R0.R(18, 800, 80), fill=(255, 226, 150))
    # dicker Regenbogenrahmen mit Holo-Schimmer und Sternen
    rb = rainbow((W, H)).convert('RGBA')
    holo = R0.holo_overlay((W, H), 255).convert('RGBA')
    rb = Image.blend(rb, holo, .25)
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).rounded_rectangle([4, 4, W - 5, H - 5], radius=38, outline=255, width=22)
    card.paste(rb, (0, 0), m)
    ImageDraw.Draw(card).rounded_rectangle([26, 26, W - 27, H - 27], radius=28, outline=(255, 255, 255, 230), width=3)
    sd = ImageDraw.Draw(card)
    for (sx, sy) in ((15, 15), (W - 16, 15), (15, H - 16), (W - 16, H - 16), (W // 2, 15), (W // 2, H - 16)):
        R0.star(sd, sx, sy, 16, (255, 255, 255))
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], radius=40, fill=255)
    bg = Image.new('RGBA', (W, H), (0, 0, 0, 255)); bg.paste(card, (0, 0), mask)
    bg.convert('RGB').resize((460, 610), Image.LANCZOS).save(out, quality=92, method=6)

if __name__ == '__main__':
    c = dict(name='Die Legendären Drei', theme='Entwickler', lvl=12, atk=5000, effect='Wird diese Karte gelegt, endet das Spiel sofort mit dem Sieg ihres Besitzers. Held, Dino und Bücherfee: Gemeinsam sind sie unbesiegbar.', num='Entwickler-Karte 01/01')
    c['def'] = 5000
    build(c, sys.argv[1], sys.argv[2]); print('fertig')
