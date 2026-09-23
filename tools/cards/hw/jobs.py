"""Hilfe für die Bildaufträge: python3 jobs.py set 'idx:jobid,...' | python3 jobs.py url 'idx:url,...' | python3 jobs.py next N | python3 jobs.py status"""
import json, sys
P = '/home/claude/schaetzspiel/tools/cards/hw/gn_jobs.json'
r = json.load(open(P)); by = {x['index']: x for x in r}
cmd = sys.argv[1]
if cmd in ('set', 'url'):
    for pair in sys.argv[2].split(','):
        i, v = pair.split(':', 1); by[int(i)]['job' if cmd == 'set' else 'url'] = v.strip()
    json.dump(r, open(P, 'w'), ensure_ascii=False, indent=1)
if cmd == 'next':
    todo = [x for x in r if not x.get('url') and not x.get('job_pending')][:int(sys.argv[2])]
    print(json.dumps([{'index': x['index'], 'params': {'aspect_ratio': x['params']['aspect_ratio'], 'model': 'gpt_image_2_5', 'prompt': x['params']['prompt'].replace('Halloween fantasy trading card creature art', 'Halloween card art').replace(' Painterly highly detailed AAA card game illustration, no border, no text.', ' Painterly AAA card game illustration, no border, no text.')}} for x in todo], ensure_ascii=False))
print('fertig:', sum(1 for x in r if x.get('url')), '/', len(r))
