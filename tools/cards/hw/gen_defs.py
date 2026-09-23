# Erzeugt lib/gn.js (Kartendaten) und tools/cards/hw/gn_cards.json (inkl. Bild-Prompts) für das Set Gruselnacht
import json, random
random.seed(31)
# (id, Name, Thema, englische Motivbeschreibung)  A = Kürbis/Hexen/Monster, B = Geister/Skelette/Tod
A = [
 ('gn_ritter','Kürbisritter','Grusel','an armored knight in black and orange plate armor whose helmet is a glowing jack-o-lantern, holding a flaming scythe'),
 ('gn_katze','Hexenkatze','Magie','an elegant black cat standing upright in a purple witch robe and pointed hat casting green magic, floating spellbook'),
 ('gn_koenig','Kürbiskönig','Grusel','a giant regal pumpkin-headed king with golden crown and fiery grin on a throne of vines and jack-o-lanterns'),
 ('gn_a04','Kesselhexe','Magie','an old cackling witch stirring a huge bubbling green cauldron, potion bottles, bats'),
 ('gn_a05','Kürbiswichtel','Grusel','a tiny mischievous goblin with a carved pumpkin as a helmet, holding a candle'),
 ('gn_a06','Besenreiterin','Magie','a young witch flying on a broomstick across a huge full moon, cape fluttering'),
 ('gn_a07','Werwolf-Jäger','Monster','a hulking werewolf howling on a rocky cliff under a full moon, fur glowing silver'),
 ('gn_a08','Vogelscheuche','Grusel','a creepy scarecrow with glowing orange eyes and a burlap face in a dark cornfield, crows'),
 ('gn_a09','Süßigkeitengolem','Grusel','a big friendly-scary golem made of candy corn, lollipops and wrapped sweets'),
 ('gn_a10','Frankensteins Riese','Monster','a towering stitched monster with neck bolts in a lightning-lit laboratory'),
 ('gn_a11','Mumienpharao','Monster','a bandaged mummy pharaoh with glowing eyes rising from a golden sarcophagus'),
 ('gn_a12','Kürbisdrache','Monster','a dragon whose scaly body is made of orange pumpkin skin and vines, breathing embers'),
 ('gn_a13','Hexenzirkelmeisterin','Magie','a powerful witch high priestess raising a staff inside a glowing magenta rune circle'),
 ('gn_a14','Fledermausfürst','Monster','a noble vampire bat lord with huge wings and a tiny crown hanging from a castle beam'),
 ('gn_a15','Trankmischer','Magie','a hunched alchemist goblin mixing glowing potions in a cluttered attic laboratory'),
 ('gn_a16','Kürbisbombe','Grusel','a sparking jack-o-lantern bomb with a lit fuse and a manic grin'),
 ('gn_a17','Spinnenkönigin','Monster','a giant elegant spider queen with a golden crown on a huge glowing web'),
 ('gn_a18','Zauberhut','Magie','a living enchanted witch hat with eyes and a mouth, floating with magic sparkles'),
 ('gn_a19','Mondwolf','Monster','a sleek silver wolf with glowing blue eyes standing before a giant moon'),
 ('gn_a20','Laternenträger','Grusel','a tall thin figure carrying a pole of hanging jack-o-lanterns through fog'),
 ('gn_a21','Rabenhexe','Magie','a witch surrounded by a swirling flock of black ravens with glowing eyes'),
 ('gn_a22','Kürbisgolem','Grusel','a massive golem built from stacked pumpkins and roots, glowing carved face'),
 ('gn_a23','Monsterbraut','Monster','a gothic bride of the monster with tall streaked hair in a stone castle'),
 ('gn_a24','Nachtkrähe','Grusel','a huge black crow with glowing orange eyes perched on a gravestone'),
 ('gn_a25','Hexenkobold','Magie','a small green imp with a pointed hat juggling glowing magic orbs'),
 ('gn_a26','Kürbisbogenschützin','Grusel','a hooded archer shooting a flaming arrow, quiver of pumpkin-tipped arrows'),
 ('gn_a27','Sumpfmonster','Monster','a mossy swamp creature rising from murky water with glowing eyes'),
 ('gn_a28','Gruselclown','Grusel','a spooky circus clown with a pumpkin nose holding glowing balloons in fog'),
 ('gn_a29','Nachtschattenhexe','Magie','a mysterious witch made of purple shadow and stars with a crescent staff'),
 ('gn_a30','Werkatze','Monster','a sleek black panther-like werecat prowling on rooftops at night'),
 ('gn_a31','Kürbiskutscher','Grusel','a pumpkin carriage pulled by skeletal horses with a pumpkin-headed driver'),
 ('gn_a32','Zaubertrank','Magie','a bubbling glowing potion bottle with a skull cork and swirling magic'),
 ('gn_a33','Bonbonhexe','Magie','a sweet-looking witch with a gingerbread house and floating candies'),
 ('gn_a34','Kürbisschlange','Monster','a long serpent whose body is a vine of small glowing pumpkins'),
 ('gn_a35','Gargoyle','Monster','a stone gargoyle coming alive on a cathedral roof, cracks glowing'),
 ('gn_a36','Hexenlehrling','Magie','a young apprentice witch reading a floating spellbook with sparkles'),
 ('gn_a37','Kürbisfeld-Wächter','Grusel','a giant guardian made of straw and pumpkins guarding a moonlit field'),
 ('gn_a38','Minotaurus der Nacht','Monster','a dark minotaur with glowing horns in a foggy stone labyrinth'),
 ('gn_a39','Zauberspiegel-Hexe','Magie','a witch gazing into a glowing enchanted mirror that shows a ghostly face'),
 ('gn_a40','Kürbiskerze','Grusel','a cute living candle inside a small jack-o-lantern with a flickering flame'),
 ('gn_a41','Riesenfledermaus','Monster','a gigantic bat with glowing red eyes swooping over a village'),
 ('gn_a42','Kräuterhexe','Magie','a forest witch gathering glowing mushrooms and herbs in a dark wood'),
 ('gn_a43','Kürbiskanone','Grusel','an old cannon firing flaming jack-o-lanterns from a castle wall'),
 ('gn_a44','Yeti der Geisternacht','Monster','a furry white yeti with glowing purple eyes in a snowy haunted forest'),
 ('gn_a45','Sternenhexe','Magie','a witch pulling stars from the night sky into her glowing lantern'),
 ('gn_a46','Kürbisritter-Knappe','Grusel','a small squire with a pumpkin helmet carrying a lantern and wooden sword'),
 ('gn_a47','Hydra der Nacht','Monster','a three-headed dark hydra with glowing orange eyes in a stormy lake'),
 ('gn_a48','Schwarze Magierin','Magie','a powerful sorceress in black robes with swirling purple lightning'),
 ('gn_a49','Kürbiskaiser','Grusel','an emperor made of golden pumpkin armor with a flaming crown and cape'),
 ('gn_a50','Hexenkönigin','Magie','an elegant witch queen on a dark throne with a crown of thorns and magic'),
]
B = [
 ('gn_schnitter','Seelenschnitter','Geister','a towering hooded spectral reaper made of teal ghost smoke with a huge scythe'),
 ('gn_b02','Skelettkrieger','Tod','a skeleton warrior in rusty armor with a glowing green sword'),
 ('gn_b03','Irrlicht','Geister','a small floating ghost light wisp glowing teal in a dark swamp'),
 ('gn_b04','Geisterbraut','Geister','a translucent ghost bride in a flowing veil in a ruined chapel'),
 ('gn_b05','Knochendrache','Tod','a huge skeletal dragon with green fire in its ribcage'),
 ('gn_b06','Gespenst','Geister','a classic white sheet ghost with dark eyes floating through a hallway'),
 ('gn_b07','Friedhofswächter','Tod','a hooded gravekeeper with a lantern and shovel among tombstones'),
 ('gn_b08','Poltergeist','Geister','an angry ghost throwing floating furniture in a haunted room'),
 ('gn_b09','Nekromant','Tod','a dark necromancer raising skeleton hands from the ground with green magic'),
 ('gn_b10','Banshee','Geister','a screaming banshee spirit with flowing white hair and teal mist'),
 ('gn_b11','Skelettpirat','Tod','a skeleton pirate captain on a ghostly ship with green sails'),
 ('gn_b12','Totenkopfritter','Tod','a knight with a flaming skull head on a skeletal horse'),
 ('gn_b13','Spukkind','Geister','a creepy translucent ghost child holding a teddy bear in a dark hallway'),
 ('gn_b14','Lich-König','Tod','a towering undead lich king on a floating throne of skulls, a storm of screaming souls swirling around him, crown of icy blue fire, frozen cathedral ruins'),
 ('gn_b15','Geisterlaterne','Geister','a floating old lantern with a trapped teal spirit inside'),
 ('gn_b16','Zombie-Rex','Dino','a colossal undead Tyrannosaurus rex zombie with rotting flesh and exposed ribs bursting out of a bubbling tar pit, roaring'),
 ('gn_b17','Nebelgeist','Geister','a large ghost made of thick fog rising over a lake'),
 ('gn_b18','Skeletthund','Tod','a skeletal hound with green fire eyes and a spiked collar'),
 ('gn_b19','Geisterorgel','Geister','a ghostly organist playing a giant pipe organ with spirits flowing out'),
 ('gn_b20','Zombie-Horde','Tod','a horde of rotting zombies clawing their way out of cracked graves, hands reaching from the earth'),
 ('gn_b21','Phantomritter','Geister','a translucent phantom knight in glowing teal armor'),
 ('gn_b22','Schädelthron','Tod','a menacing throne built from skulls with green flames'),
 ('gn_b23','Geisterkatze','Geister','a translucent glowing ghost cat walking through a wall'),
 ('gn_b24','Knochenmagier','Tod','a skeletal mage casting teal spells from an ancient book'),
 ('gn_b25','Seelenfänger','Geister','a hooded figure catching glowing souls in a crystal jar'),
 ('gn_b26','Skelettmusiker','Tod','a skeleton playing a violin on a gravestone under the moon'),
 ('gn_b27','Geisterschiff','Geister','a ghost ship with glowing teal sails sailing through the sky'),
 ('gn_b28','Werwolf-Zombie','Monster','a half-rotten undead werewolf howling in a graveyard under a blood red moon'),
 ('gn_b29','Spiegelgeist','Geister','a ghost face appearing inside an ornate cracked mirror'),
 ('gn_b30','Skelettdrachenreiter','Tod','a skeleton riding a skeletal wyvern through a stormy sky'),
 ('gn_b31','Gruftwächter','Tod','a massive armored undead guard at the gates of a crypt'),
 ('gn_b32','Geistermönch','Geister','a translucent monk spirit with a glowing rosary in a cloister'),
 ('gn_b33','Voodoo-Priester','Magie','a voodoo priest with skull face paint, top hat, glowing voodoo dolls floating around him and candles'),
 ('gn_b34','Heulende Seele','Geister','a twisted howling spirit trapped in swirling teal wind'),
 ('gn_b35','Skelettkönigin','Tod','a skeleton queen in a black lace gown and silver crown'),
 ('gn_b36','Geisterzug','Geister','a spectral steam train rushing through the night with glowing windows'),
 ('gn_b37','Raptor-Skelette','Dino','a pack of undead velociraptor skeletons with glowing eyes hunting through a dark museum hall'),
 ('gn_b38','Puppenspieler','Grusel','a sinister puppet master controlling creepy marionette dolls with glowing strings in an old theater'),
 ('gn_b39','Todesbote','Tod','a winged dark angel of death with black feathers and a scythe'),
 ('gn_b40','Geisterwolf','Geister','a translucent spectral wolf howling with teal aura'),
 ('gn_b41','Skelettschmied','Tod','a skeleton blacksmith hammering a glowing blade in a crypt forge'),
 ('gn_b42','Geisterkrake','Geister','a giant spectral kraken with glowing tentacles dragging a sinking ship into a stormy sea'),
 ('gn_b43','Vampirgräfin','Monster','an elegant vampire countess in a crimson gown with bats, drinking from a golden goblet in a gothic castle'),
 ('gn_b44','Wiedergänger','Tod','a pale undead revenant in tattered clothes rising from a grave'),
 ('gn_b45','Geisterkönigin','Geister','a majestic ghost queen with a crown of teal flames'),
 ('gn_b46','Totenmammut','Dino','an undead woolly mammoth skeleton with frozen fur, ice crystals and green soul fire in its eyes'),
 ('gn_b47','Seelenlicht','Geister','a radiant orb of many souls swirling in a dark cathedral'),
 ('gn_b48','Sensenmeister','Tod','a skeletal master reaper holding two crossed scythes, cloak billowing'),
 ('gn_b49','Geisterfürst','Geister','a regal ghost lord in spectral robes with a golden crown'),
 ('gn_b50','Auferstehung','Tod','a towering necromancer overlord raising an army of skeletons, zombies and a zombie dinosaur from a cracked graveyard, green lightning storm, apocalyptic sky'),
]
# Gruppen je Rahmen (Reihenfolge in der Liste bestimmt die Gruppe; feste Zuordnung für die Musterkarten)
def assign(lst, fixed, plan):
    ids=[x[0] for x in lst]; groups={}
    for k,g in fixed.items(): groups[k]=g
    pool=[i for i in ids if i not in groups]
    for g,n in plan:
        have=sum(1 for v in groups.values() if v==g)
        for _ in range(n-have): groups[pool.pop(0)]=g
    assert not pool, pool
    return groups
# Starke Namen nach hinten: Liste ist grob nach Stärke sortiert, darum Plan von schwach nach stark mit umgedrehter Liste
planA=[('haeufig',20),('selten',12),('legend',8),('ultra',5),('ext',3),('mythic',2)]
planB=[('haeufig',20),('selten',13),('legend',7),('ultra',5),('ext',2),('mythic',3)]
fixA={'gn_ritter':'selten','gn_katze':'legend','gn_koenig':'mythic','gn_a49':'mythic','gn_a50':'ext','gn_a13':'ext','gn_a48':'ext'}
fixB={'gn_schnitter':'mythic','gn_b50':'mythic','gn_b14':'mythic','gn_b49':'ext','gn_b45':'ext'}
gA=assign(A,fixA,planA); gB=assign(B,fixB,planB)
VAR={'haeufig':['haeufig'],'selten':['selten','holo'],'legend':['legend','ultra'],'ultra':['ultra'],'ext':['ext'],'mythic':['ext','mythic']}
LV={'haeufig':(2,4),'selten':(4,6),'legend':(6,8),'ultra':(7,8),'ext':(8,9),'mythic':(9,10)}
EFF={
 'haeufig':['Wenn diese Karte beschworen wird: Ziehe 1 Karte.','Solange diese Karte liegt, erhalten deine Grusel-Karten 100 ATK.','Wenn diese Karte zerstört wird: Heile 300 Lebenspunkte.','Diese Karte kann nicht durch Effekte zerstört werden, solange du 2 oder mehr Karten liegen hast.','Einmal pro Zug: Eine gegnerische Karte verliert 200 ATK bis zum Zugende.'],
 'selten':['Wenn diese Karte angreift: Sie erhält 300 ATK bis zum Ende des Zuges.','Einmal pro Zug: Ziehe 1 Karte, wenn du eine Zauberkarte gespielt hast.','Wenn diese Karte beschworen wird: Wirf 1 gegnerische Karte mit 1000 ATK oder weniger ab.','Solange diese Karte in Verteidigung liegt, verlieren gegnerische Karten 300 ATK.','Wenn diese Karte zerstört wird: Beschwöre 1 Karte mit 3 oder weniger Sternen aus deinem Friedhof.'],
 'legend':['Wenn diese Karte beschworen wird: Zerstöre 1 gegnerische Karte mit weniger als 2000 ATK.','Einmal pro Zug: Hole 1 Karte aus deinem Friedhof auf die Hand.','Diese Karte kann zweimal pro Zug angreifen.','Alle gegnerischen Karten verlieren 500 DEF, solange diese Karte liegt.'],
 'ultra':['Einmal pro Duell: Tausche die ATK und DEF aller Karten auf dem Feld.','Wenn diese Karte angreift, kann der Gegner keine Effekte aktivieren.','Wenn diese Karte beschworen wird: Ziehe 2 Karten und wirf 1 ab.'],
 'ext':['Einmal pro Duell: Zerstöre alle Karten deines Gegners mit weniger als 2500 ATK.','Solange diese Karte liegt, kann dein Gegner keine Karten mit 5 oder mehr Sternen beschwören.','Wenn diese Karte zerstört würde: Wirf stattdessen 1 Karte ab.'],
 'mythic':['Wenn diese Karte beschworen wird: Zerstöre alle gegnerischen Karten mit weniger als 1500 DEF.','Einmal pro Duell: Hole alle deine zerstörten Karten auf die Hand.','Diese Karte ist unzerstörbar, solange du eine andere Gruselnacht-Karte liegen hast.'],
}
cards=[]; n=0
fixed_eff={'gn_ritter':EFF['selten'][0],'gn_katze':EFF['selten'][1],'gn_schnitter':EFF['mythic'][0],'gn_koenig':'Einmal pro Duell: Hole alle Kürbis-Karten aus deinem Friedhof auf die Hand.'}
fixed_stats={'gn_ritter':(5,1900,1600),'gn_katze':(7,2400,1900),'gn_schnitter':(9,3300,2600),'gn_koenig':(10,3500,3000)}
for frame,lst,gg in (('A',A,gA),('B',B,gB)):
    for cid,name,theme,prompt in lst:
        n+=1; g=gg[cid]; lo,hi=LV[g]; lvl=random.randint(lo,hi)
        atk=lvl*300+random.choice([0,100,200,300]); dfs=max(300,atk-random.choice([200,300,500,700]))
        if cid in fixed_stats: lvl,atk,dfs=fixed_stats[cid]
        eff=fixed_eff.get(cid) or random.choice(EFF[g])
        trib='' if lvl<=4 else 'Beschwörung: 1 Tribut' if lvl<=6 else 'Beschwörung: 2 Tribute'
        cards.append(dict(id=cid,name=name,theme=theme,frame=frame,group=g,variants=VAR[g],lvl=lvl,atk=atk,dfs=dfs,effect=eff,tribute=trib,num=f'GN {n:03d} / 100',prompt=prompt))
json.dump(cards,open('/home/claude/schaetzspiel/tools/cards/hw/gn_cards.json','w'),ensure_ascii=False,indent=1)
js=['// Set Gruselnacht (Halloween): 100 Motive, erzeugt aus tools/cards/hw/gen_defs.py. Nur im Gruselnacht-Booster.','module.exports = ['+',\n'.join('  '+json.dumps({'id':c['id'],'name':c['name'],'theme':c['theme'],'lvl':c['lvl'],'atk':c['atk'],'def':c['dfs'],'set':'gn','base':c['variants'][0],'variants':c['variants'],**({'tribute':c['tribute']} if c['tribute'] else {}),'effect':c['effect'],**({'anim':True} if 'mythic' in c['variants'] else {})},ensure_ascii=False) for c in cards)+'\n];\n']
open('/home/claude/schaetzspiel/lib/gn.js','w').write('\n'.join(js))
from collections import Counter
print('Motive',len(cards),'| Varianten',sum(len(c['variants']) for c in cards),'| Gruppen',dict(Counter(c['group'] for c in cards)),'| Rahmen',dict(Counter(c['frame'] for c in cards)))
