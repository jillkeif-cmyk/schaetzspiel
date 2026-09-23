"""Bewegte Mythisch-Karte für eine Gruselnacht-Karte: python3 anim_one.py <id> <video.mp4>"""
import sys, json, subprocess
H = '/home/claude/schaetzspiel/tools/cards'
c = next(x for x in json.load(open(H + '/hw/gn_cards.json')) if x['id'] == sys.argv[1])
meta = dict(name=c['name'].upper(), theme=c['theme'], rar='mythic', lvl=c['lvl'], atk=c['atk'], dfs=c['dfs'], effect=c['effect'], tribute=c['tribute'], num=c['num'])
frame = H + ('/hw/frame_a.png' if c['frame'] == 'A' else '/hw/frame_b.png')
subprocess.run(['python3', H + '/anim_card.py', frame, sys.argv[2], f"/home/claude/schaetzspiel/public/tcg/{c['id']}_mythic.webp", json.dumps(meta, ensure_ascii=False)], check=True)
