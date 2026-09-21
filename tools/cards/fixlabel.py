"""Ersetzt das Seltenheits-Schild oben rechts in fertigen Kartenbildern.
Extended Art bekommt "EXTENDED ART", Ghost-Karten "GHOST RARE"."""
import glob, os
from PIL import Image, ImageDraw, ImageFont
FW, NAMEY = 880, 37
INK=(10,24,26); GOLD=(255,214,90); GHOST=(226,238,246)
def R(s): f=ImageFont.truetype('/tmp/fonts/Archivo.ttf',s); f.set_variation_by_axes([900,80]); return f
d0=ImageDraw.Draw(Image.new('RGB',(10,10)))
JOBS={} if False else {'_ext.webp':('LEGENDÄR','EXTENDED ART',GOLD), '_ghost.webp':('GHOST','GHOST  RARE',GHOST)}
n=0
import sys
ONLY=sys.argv[1] if len(sys.argv)>1 else None
for suffix,(old,new,plate) in JOBS.items():
    if ONLY and ONLY not in suffix: continue
    for p in sorted(x for x in glob.glob('public/tcg/*'+suffix) if not os.path.basename(x).startswith('pack_')):
        im=Image.open(p).convert('RGB'); sc=im.width/FW
        tw_old=d0.textlength(old,font=R(21)); x0_old=FW-64-tw_old-24
        size=21
        while d0.textlength(new,font=R(size))>max(tw_old,150) and size>15: size-=1
        tw=d0.textlength(new,font=R(size)); x0=FW-64-tw-24
        L=int(min(x0,x0_old))-8; T=NAMEY+12; Rr=FW-58; B=NAMEY+68
        box=(int(L*sc),int(T*sc),int(Rr*sc)+1,int(B*sc)+1)
        crop=im.crop(box); big=crop.resize((int(crop.width/sc),int(crop.height/sc)),Image.LANCZOS)
        d=ImageDraw.Draw(big); ox,oy=box[0]/sc,box[1]/sc
        # altes Schild vollständig überdecken, dann neues setzen
        d.rounded_rectangle([x0_old-ox-2,NAMEY+16-oy,FW-62-ox,NAMEY+64-oy],radius=10,fill=plate)
        d.rounded_rectangle([x0-ox,NAMEY+18-oy,FW-64-ox,NAMEY+62-oy],radius=9,fill=plate)
        f=R(size); bb=d.textbbox((0,0),new,font=f)
        d.text((x0+12-ox, NAMEY+40-oy-(bb[1]+bb[3])/2),new,font=f,fill=INK)
        im.paste(big.resize(crop.size,Image.LANCZOS),box[:2])
        im.save(p,quality=90,method=6); n+=1
print(n,'Karten angepasst')
