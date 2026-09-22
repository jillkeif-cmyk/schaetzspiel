"""Video eines Emblems auf Schwarz -> animiertes WebP mit Transparenz und nahtloser Schleife.
Aufruf: python3 emb.py eingabe.mp4 ausgabe.webp
Hintergrund wird pro Bild von den Rändern her entfernt, dunkle Stellen im Motiv bleiben erhalten."""
import sys, subprocess, glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd
src, dst = sys.argv[1], sys.argv[2]
tmp = '/tmp/anim/fr_' + os.path.basename(dst).split('.')[0]
os.makedirs(tmp, exist_ok=True)
for f in glob.glob(tmp + '/*.png'): os.remove(f)
subprocess.run(['ffmpeg','-y','-v','error','-i',src,'-vf','fps=10,scale=180:180',tmp+'/%03d.png'], check=True)
files = sorted(glob.glob(tmp + '/*.png'))
imgs = [np.array(Image.open(f).convert('RGB')).astype(np.float32) for f in files]
n = len(imgs); F = 8  # 0,8 s Überblendung
loop = [imgs[i] * (i / F) + imgs[n - F + i] * (1 - i / F) if i < F else imgs[i] for i in range(n - F)]
out = []
for fr in loop:
    lum = fr.max(axis=2); dark = lum <= 24
    lab, c = nd.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    soft = np.clip((lum - 8) * 12, 0, 255).astype(np.uint8)  # Funken und Glanz weich
    alpha = np.maximum(alpha, np.where(bg, soft, 0)).astype(np.uint8)
    a = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.6))
    im = Image.fromarray(fr.clip(0, 255).astype(np.uint8)); im.putalpha(a); out.append(im)
out[0].save(dst, save_all=True, append_images=out[1:], duration=100, loop=0, quality=58, method=6, lossless=False)
print(os.path.getsize(dst), 'Bytes,', len(out), 'Bilder')
