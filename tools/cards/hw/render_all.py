"""Rendert alle statischen Gruselnacht-Varianten nach public/tcg/<id>_<variante>.webp. python3 render_all.py START ENDE (Kartenindex)"""
import sys, json, os
sys.path.insert(0, '/home/claude/schaetzspiel/tools/cards')
from build_hw import build
from PIL import Image
H = '/home/claude/schaetzspiel/tools/cards/hw'
cards = json.load(open(H + '/gn_cards.json'))
SPECIAL = {'gn_ritter': '/tmp/hw/a1w.png', 'gn_katze': '/tmp/hw/a2w.png', 'gn_schnitter': '/tmp/hw/a3.png', 'gn_koenig': '/tmp/hw/a4.png'}
a, b = int(sys.argv[1]), int(sys.argv[2]); n = 0
for c in cards[a:b]:
    art = SPECIAL.get(c['id'], f"/tmp/gnart/{c['id']}.png")
    frame = H + ('/frame_a.png' if c['frame'] == 'A' else '/frame_b.png')
    meta = dict(name=c['name'].upper(), theme=c['theme'], lvl=c['lvl'], atk=c['atk'], dfs=c['dfs'], effect=c['effect'], tribute=c['tribute'], num=c['num'])
    for v in c['variants']:
        if v == 'mythic': continue  # bewegt, eigenes Skript
        out = f"/home/claude/schaetzspiel/public/tcg/{c['id']}_{v}.webp"
        im = build(frame, art, None, rar='legend' if v == 'ext' else v, extended=(v == 'ext'), shift=(hash(c['id']) % 100) / 100, **meta)
        im.resize((460, 610), Image.LANCZOS).save(out, quality=86); n += 1
print('gerendert', n)
