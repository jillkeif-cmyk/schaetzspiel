from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageEnhance
from scipy import ndimage as nd
import numpy as np

FR = Image.open('/tmp/cards/frame2.png').convert('RGB')
FW,FH = FR.size                      # 880 x 1168
arr = np.array(FR).astype(int)
MAG = (arr[:,:,0]>140)&(arr[:,:,1]<120)&(arr[:,:,2]>140)

ART  = (69,153,810,725)      # Bildfenster
TEXT = (45,779,835,1058)     # Effektkasten
NAME = (94,37,786,125)       # Namensleiste
V1   = (614,1044,743,1141)   # ATK
V2   = (762,1044,847,1141)   # DEF
STAR_Y = 742                 # Sterne zeichne ich selbst unter das Bild

A = lambda s: ImageFont.truetype('/tmp/fonts/Anton.ttf', s)
def R(s,w=600,wd=95):
    f=ImageFont.truetype('/tmp/fonts/Archivo.ttf',s); f.set_variation_by_axes([w,wd]); return f
PAPER=(246,241,225); MUT=(168,190,188); INK=(10,24,26); GOLD=(255,214,90)

TINT = {  # Metallfarbe je Seltenheit
 'haeufig': (150,168,168),
 'selten':  (150,185,225),
 'holo':    (170,200,220),
 'ultra':   (235,205,255),
 'legend':  (255,214,120),
 'ghost':   (250,252,255),
}
LABEL = {'haeufig':'HÄUFIG','selten':'SELTEN','holo':'HOLO','ultra':'ULTRA RARE','legend':'LEGENDÄR','ghost':'GHOST'}

def fit(img, box):
    bw,bh=box; ar=img.width/img.height
    th=bh; tw=int(th*ar)
    if tw<bw: tw=bw; th=int(tw/ar)
    img=img.resize((tw,th), Image.LANCZOS)
    return img.crop(((tw-bw)//2,(th-bh)//2,(tw-bw)//2+bw,(th-bh)//2+bh))

def prism(size, strength=1.0, shift=0.0, freq=1.0):
    """Weiche Folie: breite Farbwolken plus feiner Glitzer, keine harten Streifen"""
    w,h=size
    x=np.linspace(0,1,w)[None,:].repeat(h,0); y=np.linspace(0,1,h)[:,None].repeat(w,1)
    cx,cy = 0.5+0.35*np.cos(shift*6.283), 0.45+0.3*np.sin(shift*6.283)
    d = np.sqrt(((x-cx)*1.15)**2 + ((y-cy)*1.0)**2)
    t = (d*1.25 + shift) % 1.0
    glow = np.exp(-(d**2)/(2*0.42**2))
    r=(np.sin(2*np.pi*t)*.5+.5); g=(np.sin(2*np.pi*(t+.33))*.5+.5); b=(np.sin(2*np.pi*(t+.66))*.5+.5)
    rng = np.random.default_rng(7)
    sparkle = (rng.random((h,w)) > 0.9985).astype(float)
    sparkle = nd.gaussian_filter(sparkle, 1.6) * 90
    a = (0.14 + 0.5*glow) * strength
    arr = np.dstack([(r*255*a + sparkle), (g*255*a + sparkle), (b*255*a + sparkle)])
    img = Image.fromarray(np.clip(arr,0,255).astype('uint8'))
    return img.filter(ImageFilter.GaussianBlur(max(2, int(min(w,h)*0.012))))

def frame_layer(rar):
    """Rahmen mit transparenten Fenstern, in der Farbe der Seltenheit"""
    base = FR.convert('RGB')
    g = base.convert('L')
    t = TINT[rar]
    col = Image.merge('RGB',[g.point(lambda v,c=c: int(v*c/255)) for c in t])
    col = ImageEnhance.Contrast(col).enhance(1.12)
    if rar in ('ultra','legend'):
        col = ImageChops.screen(col, prism((FW,FH), .45 if rar=='ultra' else .35, .2, 1.4))
    if rar == 'ghost':
        col = ImageEnhance.Brightness(col).enhance(1.32)
        col = ImageEnhance.Contrast(col).enhance(1.15)
        col = ImageChops.screen(col, prism((FW,FH), .35, .35, 1.0))
    lay = col.convert('RGBA')
    al = Image.fromarray(np.where(MAG,0,255).astype('uint8')).filter(ImageFilter.GaussianBlur(.6))
    lay.putalpha(al)
    return lay

def wrap(d,text,f,maxw):
    out=[];cur=''
    for wd in text.split():
        s=(cur+' '+wd).strip()
        if d.textlength(s,font=f)<=maxw: cur=s
        else: out.append(cur);cur=wd
    out.append(cur);return out

def star(d,cx,cy,r,fill,outline):
    pts=[]
    for k in range(10):
        ang=-np.pi/2+k*np.pi/5; rr=r if k%2==0 else r*0.45
        pts.append((cx+rr*np.cos(ang), cy+rr*np.sin(ang)))
    d.polygon(pts, fill=fill, outline=outline)

def emboss_text(img, xy, text, font, fill, depth=2):
    d=ImageDraw.Draw(img)
    d.text((xy[0]+depth,xy[1]+depth), text, font=font, fill=(0,0,0,170))
    d.text((xy[0]-1,xy[1]-1), text, font=font, fill=(255,255,255,90))
    d.text(xy, text, font=font, fill=fill)

def build(art_path,out,*,name,theme,rar,lvl,atk,dfs,effect,tribute,num,extended=False,shift=0.0):
    art=Image.open(art_path).convert('RGB')
    card=Image.new('RGBA',(FW,FH),(6,20,24,255))
    if extended:
        full=fit(art,(FW,FH)); card.paste(full,(0,0))
        card=ImageChops.screen(card.convert('RGB'), prism((FW,FH),.85,shift,1.1)).convert('RGBA')
    else:
        x0,y0,x1,y1=ART
        win=fit(art,(x1-x0,y1-y0))
        if rar == 'ghost':
            g = win.convert('L')
            win = Image.merge('RGB', [g.point(lambda v: min(255, int(v*1.06+14))),
                                      g.point(lambda v: min(255, int(v*1.08+18))),
                                      g.point(lambda v: min(255, int(v*1.12+24)))])
            win = ImageEnhance.Contrast(win).enhance(1.22)
            win = ImageChops.screen(win, prism(win.size, .45, shift, 1.0))
        elif rar in ('holo','ultra','legend'):
            win=ImageChops.screen(win, prism(win.size, .7 if rar=='holo' else .55, shift, 1.3))
        card.paste(win,(x0,y0))
        # Textkasten füllen
        tx0,ty0,tx1,ty1=TEXT
        d0=ImageDraw.Draw(card)
        d0.rectangle([tx0,ty0,tx1,ty1], fill=(244,238,214) if rar!='legend' else (250,242,214))
        nx0,ny0,nx1,ny1=NAME
        d0.rectangle([nx0,ny0,nx1,ny1], fill=(10,26,30))

        for bx in (V1,V2):
            d0.rectangle(bx, fill=(10,26,30))
    card=Image.alpha_composite(card, frame_layer(rar))
    if extended:
        x0,y0,x1,y1=ART
        ow,oh = (x1-x0)+150, (y1-y0)+230
        spill=fit(art,(ow,oh))
        spill=ImageChops.screen(spill, prism((ow,oh),.6,shift,1.1))
        m=Image.new('L',(ow,oh),0); ImageDraw.Draw(m).rounded_rectangle([0,0,ow-1,oh-1],radius=60,fill=255)
        m=m.filter(ImageFilter.GaussianBlur(34))
        card.paste(spill,(x0-75,y0-120),m)
        # danach oben und unten abdunkeln, damit Name, Sterne und Effekt lesbar bleiben
        ov=Image.new('L',(FW,FH),0); od=ImageDraw.Draw(ov)
        for y in range(FH):
            t=y/FH; a2=0
            if t<0.19: a2=int(225*(1-t/0.19))
            elif t>0.64: a2=int(248*min(1,(t-0.64)/0.18))
            od.line([(0,y),(FW,y)],fill=a2)
        card=Image.composite(Image.new('RGBA',(FW,FH),(5,18,22,255)), card, ov)
        card=Image.alpha_composite(card, frame_layer(rar))
    d=ImageDraw.Draw(card)
    # Name
    f=A(46)
    while d.textlength(name,font=f)>(FW-300): f=A(f.size-2)
    if extended: emboss_text(card,(84,NAME[1]+16),name,f,GOLD if rar in ('legend','ultra') else PAPER)
    else: emboss_text(card,(84,NAME[1]+16),name,f,GOLD if rar in ('legend','ultra') else PAPER,1)
    d=ImageDraw.Draw(card)
    # Seltenheit
    plate = GOLD if rar in ('legend','ultra') else (226,238,246) if rar=='ghost' else (120,150,152)
    tw=d.textlength(LABEL[rar],font=R(21,900,80))
    d.rounded_rectangle([FW-64-tw-24, NAME[1]+18, FW-64, NAME[1]+62], radius=9, fill=plate)
    d.text((FW-64-tw-12, NAME[1]+28), LABEL[rar], font=R(21,900,80), fill=INK if rar in ('legend','ultra','ghost') else (240,246,246))
    # Sterne unter dem Bild, selbst gesetzt
    cy = STAR_Y
    plate = Image.new('RGBA',(FW,FH),(0,0,0,0)); pd=ImageDraw.Draw(plate)
    pd.rounded_rectangle([ART[0]+4, cy-24, ART[2]-4, cy+24], radius=14, fill=(6,20,24,205))
    card.alpha_composite(plate); d=ImageDraw.Draw(card)
    for i in range(lvl):
        star(d, ART[0]+34+i*42, cy, 17, GOLD, (130,86,0))
    th=R(21,900,78)
    d.text((ART[2]-18-d.textlength(theme.upper(),font=th), cy-11), theme.upper(), font=th, fill=(214,232,230) if not extended else (255,226,150))
    # Effekt
    tx0,ty0,tx1,ty1=TEXT
    tcol=(24,30,30) if not extended else PAPER
    d.text((tx0+28, ty0+18), 'EFFEKT', font=R(20,900,80), fill=(150,110,20) if not extended else GOLD)
    yy=ty0+54
    if tribute:
        for l in wrap(d,tribute,R(24,800),tx1-tx0-56):
            d.text((tx0+28,yy), l, font=R(24,800), fill=(150,60,20) if not extended else (255,190,120)); yy+=34
        yy+=4
    fe=R(25,500)
    for l in wrap(d,effect,fe,tx1-tx0-56):
        d.text((tx0+28,yy), l, font=fe, fill=tcol); yy+=34
    # ATK / DEF
    d.text((V1[0]+10, V1[1]+6), 'ATK', font=R(17,900,80), fill=(190,205,205))
    d.text((V1[0]+10, V1[1]+24), str(atk), font=A(28), fill=(255,150,130))
    d.text((V2[0]+10, V2[1]+6), 'DEF', font=R(17,900,80), fill=(190,205,205))
    d.text((V2[0]+10, V2[1]+24), str(dfs), font=A(28), fill=(150,200,255))
    d.text((TEXT[0]+26, FH-74), num, font=R(19,800,80), fill=(120,140,140) if not extended else (255,226,150))
    if rar in ('ultra','ghost'):  # geprägte Folie zusätzlich über Name und Sterne
        band=prism((FW,260), .9, shift+.3, 2.0)
        top=Image.new('RGBA',(FW,FH),(0,0,0,0)); top.paste(band,(0,20))
        m=Image.new('L',(FW,FH),0); md=ImageDraw.Draw(m)
        md.rectangle([NAME[0]-20,NAME[1]-6,NAME[2]+20,NAME[3]+6],fill=120); md.rounded_rectangle([ART[0]+4,STAR_Y-24,ART[2]-4,STAR_Y+24],radius=14,fill=130)
        top.putalpha(m)
        card=Image.alpha_composite(card, top)
    return card.save(out) or card

CARDS = {
 'kobold': dict(art_path='/tmp/cards/art1.png', name='ZOLLSTOCK-KOBOLD', theme='Technik', lvl=3, atk=900, dfs=700,
   effect='Wenn diese Karte zerstört wird: Ziehe 1 Karte.', tribute='', num='Nr. 014 / 60'),
 'falke': dict(art_path='/tmp/cards/art3.png', name='STOPPUHR-FALKE', theme='Sport', lvl=4, atk=1200, dfs=800,
   effect='Einmal pro Zug: Erhöhe die ATK einer eigenen Karte bis zum Zugende um 300.', tribute='', num='Nr. 021 / 60'),
 'golem': dict(art_path='/tmp/cards/art4.png', name='ZAHNRAD-GOLEM', theme='Technik', lvl=5, atk=1700, dfs=2000,
   effect='Solange diese Karte in Verteidigung liegt, verlieren alle gegnerischen Karten 200 DEF.', tribute='Beschwörung: 1 Tribut', num='Nr. 028 / 60'),
 'orakel': dict(art_path='/tmp/cards/art5.png', name='EISKRISTALL-ORAKEL', theme='Wissen', lvl=6, atk=2100, dfs=1900,
   effect='Einmal pro Zug: Sieh dir die oberste Karte im Deck des Gegners an und lege sie zurück.', tribute='Beschwörung: 1 Tribut', num='Nr. 037 / 60'),
 'drache': dict(art_path='/tmp/cards/art2.png', name='MASSBAND-DRACHE', theme='Weltall', lvl=8, atk=3000, dfs=2500,
   effect='Wenn diese Karte beschworen wird: Zerstöre 1 gegnerische Karte mit weniger als 2000 ATK.', tribute='Beschwörung: 2 Tribute', num='Nr. 003 / 60'),
 'schmied': dict(art_path='/tmp/cards/art6.png', name='STERNENSCHMIED', theme='Weltall', lvl=9, atk=3200, dfs=2800,
   effect='Einmal pro Duell: Hole 1 Karte mit bis zu 4 Sternen aus deinem Friedhof zurück.', tribute='Beschwörung: 2 Tribute', num='Nr. 001 / 60'),
}
if __name__ == '__main__':
    build(out='/tmp/cards/v_normal.png', rar='haeufig', **CARDS['kobold'])
    build(out='/tmp/cards/v_selten.png', rar='selten', **CARDS['golem'])
    build(out='/tmp/cards/v_holo.png', rar='holo', **CARDS['orakel'])
    build(out='/tmp/cards/v_ultra.png', rar='ultra', **CARDS['orakel'])
    build(out='/tmp/cards/v_ext.png', rar='legend', extended=True, **CARDS['drache'])
    print('ok')
