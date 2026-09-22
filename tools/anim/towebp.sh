#!/bin/bash
# Video (mp4) -> animiertes WebP mit nahtloser Schleife.
# Aufruf: towebp.sh eingabe.mp4 ausgabe.webp banner|emblem [YPOS]
# YPOS nur für banner: 0 = oben, 0.5 = Mitte (Standard), 1 = unten.
# Titel-Banner: 560x127 (Seitenverhältnis wie 880x200), fps 10, Qualität 48.
# Embleme besser mit emb.py (Maske von den Rändern, dunkle Stellen im Motiv bleiben).
set -e
IN=$1; OUT=$2; KIND=$3; YPOS=${4:-0.5}
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
F=0.8
E=$(python3 -c "print(round($D-$F,2))")
if [ "$KIND" = "banner" ]; then
  PRE="fps=10,scale=560:-2,crop=560:127:0:(ih-127)*$YPOS"; Q=48; FMT=yuv420p
else
  PRE="fps=12,scale=240:240"; Q=62; FMT=yuva420p
fi
ffmpeg -y -v error -i "$IN" -filter_complex "
[0:v]$PRE,split=3[a][b][c];
[a]trim=0:$F,setpts=PTS-STARTPTS[head];
[b]trim=$E:$D,setpts=PTS-STARTPTS[tail];
[c]trim=$F:$E,setpts=PTS-STARTPTS[mid];
[head][tail]blend=all_expr='A*(T/$F)+B*(1-T/$F)'[mix];
[mix][mid]concat=n=2:v=1[loop];
[loop]$( [ "$KIND" = "banner" ] && echo "format=$FMT" || echo "colorkey=0x000000:0.10:0.06,format=$FMT" )" \
  -c:v libwebp -quality $Q -compression_level 6 -loop 0 -an "$OUT"
ls -la "$OUT" | awk '{print $5" Bytes"}'
