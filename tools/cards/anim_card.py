"""Bewegte Extended-Art-Karte: Wan-Video des Motivs -> jedes Bild als Extended-Karte -> animiertes WebP (Schleife überblendet).
python3 anim_card.py rahmen.png video.mp4 ausgabe.webp '<json mit name, theme, rar, lvl, atk, dfs, effect, tribute, num>'"""
import sys, json, subprocess, glob, os
sys.path.insert(0, os.path.dirname(__file__))
from build_hw import build
from PIL import Image
frame, vid, dst, meta = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
tmp = '/tmp/animcard_' + os.path.basename(dst).split('.')[0]; os.makedirs(tmp, exist_ok=True)
for f in glob.glob(tmp + '/*.png'): os.remove(f)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', vid, '-vf', 'fps=8', tmp + '/%03d.png'], check=True)
srcs = [Image.open(f).convert('RGB') for f in sorted(glob.glob(tmp + '/*.png'))]
n = len(srcs); F = 6  # Überblendung Ende -> Anfang
loop = [Image.blend(srcs[n - F + i], srcs[i], i / F) if i < F else srcs[i] for i in range(n - F)]
out = []
for k, im in enumerate(loop):
    c = build(frame, None, None, art_img=im, extended=True, shift=k / len(loop), **meta)  # Folie wandert mit
    out.append(c.resize((460, 610), Image.LANCZOS))
out[0].save(dst, save_all=True, append_images=out[1:], duration=125, loop=0, quality=72, method=4)
print(os.path.getsize(dst), 'Bytes,', len(out), 'Bilder')
