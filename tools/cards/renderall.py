import sys, json, os, re
sys.path.insert(0,'/tmp/cards')
from build3 import build
from PIL import Image
OUT='/home/claude/schaetzspiel/public/tcg'
art = json.load(open('/tmp/cards/artmap.json'))
for i in range(1,11): art['g%d' % i] = '/tmp/gh/g%d.png' % i
src = open('/home/claude/schaetzspiel/lib/tcg.js').read()
cards = {}
blocks = re.findall(r"\{ id: '([^']+)',(.*?)effect: '([^']*)' \}", src, re.S)
for cid, mid, eff in blocks:
    g = lambda k, d=None: (re.search(k + r": '?([^',}]+)'?", mid).group(1).strip() if re.search(k + r": '?([^',}]+)'?", mid) else d)
    cards[cid] = dict(name=g('name'), theme=g('theme'), set=g('set', 'standard'),
                      lvl=int(g('lvl', 1)), atk=int(g('atk', 0)), dfs=int(g('def', 0)),
                      base=g('base', 'haeufig'), effect=eff.replace("\\'", "'"))
vars = {}
for m in re.finditer(r"^  ([a-z0-9]+): (\[[^\]]*\]),", src, re.M):
    vars[m.group(1)] = json.loads(m.group(2))
nums = {cid: i+1 for i, cid in enumerate(cards)}
start = int(sys.argv[1]); end = int(sys.argv[2])
jobs = []
for cid, c in cards.items():
    for v in vars.get(cid, []): jobs.append((cid, c, v))
jobs = jobs[start:end]
for cid, c, v in jobs:
    ap = art.get(cid)
    if not ap or not os.path.exists(ap): print('kein Artwork:', cid); continue
    ext = v == 'ext'
    rar = 'legend' if ext else v
    img = build(out='/tmp/cards/_r.png', art_path=ap, name=c['name'].upper(), theme=('SPECIAL' if c['base']=='ghost' else c['theme']),
                lvl=c['lvl'], atk=c['atk'], dfs=c['dfs'], effect=c['effect'],
                tribute='Beschwörung: 2 Tribute' if c['lvl']>=8 else ('Beschwörung: 1 Tribut' if c['lvl']>=5 else ''),
                num=f"Nr. {nums[cid]:03d} / 110", rar=rar, extended=ext)
    img = img.convert('RGB'); img = img.resize((460, int(460*img.height/img.width)), Image.LANCZOS)
    img.save(f"{OUT}/{cid}_{v}.webp", quality=80, method=5)
print('fertig', len(jobs), 'von Index', start)
