// Sammelkarten: Definitionen, Booster, Ziehen. Die Duell-Logik kommt später.
const CARDS = [
  { id: 'kobold',  name: 'Zollstock-Kobold',  theme: 'Technik', lvl: 3, atk: 900,  def: 700,  base: 'haeufig',
    effect: 'Wenn diese Karte zerstört wird: Ziehe 1 Karte.' },
  { id: 'falke',   name: 'Stoppuhr-Falke',    theme: 'Sport',   lvl: 4, atk: 1200, def: 800,  base: 'haeufig',
    effect: 'Einmal pro Zug: Erhöhe die ATK einer eigenen Karte bis zum Zugende um 300.' },
  { id: 'golem',   name: 'Zahnrad-Golem',     theme: 'Technik', lvl: 5, atk: 1700, def: 2000, base: 'selten',
    effect: 'Solange diese Karte in Verteidigung liegt, verlieren alle gegnerischen Karten 200 DEF.' },
  { id: 'orakel',  name: 'Eiskristall-Orakel', theme: 'Wissen', lvl: 6, atk: 2100, def: 1900, base: 'selten',
    effect: 'Einmal pro Zug: Sieh dir die oberste Karte im Deck des Gegners an und lege sie zurück.' },
  { id: 'drache',  name: 'Maßband-Drache',    theme: 'Weltall', lvl: 8, atk: 3000, def: 2500, base: 'legend',
    effect: 'Wenn diese Karte beschworen wird: Zerstöre 1 gegnerische Karte mit weniger als 2000 ATK.' },
  { id: 'schmied', name: 'Sternenschmied',    theme: 'Weltall', lvl: 9, atk: 3200, def: 2800, base: 'legend',
    effect: 'Einmal pro Duell: Hole 1 Karte mit bis zu 4 Sternen aus deinem Friedhof zurück.' },
  { id: 'eisfee', name: 'Eisfee', theme: 'Wissen', lvl: 4, atk: 1300, def: 1100, base: 'haeufig',
    effect: 'Einmal pro Zug: Friere 1 gegnerische Karte bis zum Ende des nächsten Zuges ein.' },
  { id: 'einhorn', name: 'Morgenlicht-Einhorn', theme: 'Wissen', lvl: 6, atk: 2000, def: 2100, base: 'selten',
    effect: 'Wenn diese Karte beschworen wird: Heile 500 Lebenspunkte.' },
  { id: 'sternpanther', name: 'Sternenpanther', theme: 'Weltall', lvl: 7, atk: 2400, def: 1800, base: 'selten',
    effect: 'Diese Karte kann nicht als Ziel von Effekten gewählt werden.' },
  { id: 'domgolem', name: 'Kathedralen-Golem', theme: 'Bauwerke', lvl: 8, atk: 2800, def: 3000, base: 'legend',
    effect: 'Solange diese Karte liegt, erleiden eigene Karten in Verteidigung keinen Kampfschaden.' },
  { id: 'astroritter', name: 'Astro-Ritter', theme: 'Weltall', lvl: 5, atk: 1800, def: 1600, base: 'selten',
    effect: 'Einmal pro Zug: Wechsle die Position einer gegnerischen Karte.' },
  { id: 'inselschildkroete', name: 'Inselschildkröte', theme: 'Geografie', lvl: 7, atk: 2000, def: 2900, base: 'selten',
    effect: 'Solange diese Karte liegt, erhalten alle eigenen Karten 300 DEF.' },
  { id: 'schildmaid', name: 'Runen-Schildmaid', theme: 'Geschichte', lvl: 6, atk: 2200, def: 1500, base: 'selten',
    effect: 'Wenn diese Karte eine Karte zerstört: Ziehe 1 Karte.' },
  { id: 'gepardwagen', name: 'Gepard-Bolide', theme: 'Technik', lvl: 5, atk: 1900, def: 1200, base: 'selten',
    effect: 'Diese Karte kann im Zug der Beschwörung sofort angreifen.' },
  { id: 'notentaenzerin', name: 'Notentänzerin', theme: 'Musik', lvl: 4, atk: 1400, def: 1400, base: 'haeufig',
    effect: 'Einmal pro Zug: Tausche ATK und DEF einer eigenen Karte bis zum Zugende.' },
  { id: 'nachtoperator', name: 'Nacht-Operator', theme: 'Call of Duty', lvl: 6, atk: 2300, def: 1400, base: 'selten',
    effect: 'Einmal pro Duell: Zerstöre 1 gedeckte gegnerische Karte.' },
  { id: 'entschaerfer', name: 'Entschärfer', theme: 'Counter-Strike', lvl: 5, atk: 1600, def: 2100, base: 'selten',
    effect: 'Einmal pro Zug: Negiere den Effekt einer gegnerischen Karte bis zum Zugende.' },
  { id: 'buechermagierin', name: 'Büchermagierin', theme: 'BookTok', lvl: 6, atk: 1900, def: 2200, base: 'selten',
    effect: 'Einmal pro Zug: Lege 1 Karte aus deiner Hand ab und ziehe 2 Karten.' },
  { id: 'blaetterphoenix', name: 'Blätterphönix', theme: 'Wissen', lvl: 8, atk: 2900, def: 2400, base: 'legend',
    effect: 'Wenn diese Karte zerstört wird: Beschwöre sie am Ende des nächsten Zuges zurück.' },
  { id: 'meerkoenigin', name: 'Perlen-Königin', theme: 'Geografie', lvl: 7, atk: 2500, def: 2300, base: 'selten',
    effect: 'Einmal pro Zug: Nimm 1 eigene Karte auf die Hand zurück.' },
  { id: 'uhreule', name: 'Uhrwerk-Eule', theme: 'Technik', lvl: 4, atk: 1200, def: 1700, base: 'haeufig',
    effect: 'Wenn diese Karte beschworen wird: Sieh dir die Hand des Gegners an.' },
  { id: 'sphinx', name: 'Wüsten-Sphinx', theme: 'Geschichte', lvl: 7, atk: 2600, def: 2200, base: 'selten',
    effect: 'Der Gegner muss ein Rätsel lösen: Er wirft eine Münze, bei Kopf kann er angreifen.' },
  { id: 'sturmriese', name: 'Sturmriese', theme: 'Weltall', lvl: 9, atk: 3100, def: 2600, base: 'legend',
    effect: 'Wenn diese Karte angreift: Zerstöre zusätzlich 1 gegnerische Karte mit weniger als 1500 DEF.' },
  { id: 'gartenfee', name: 'Gartenfee', theme: 'Wissen', lvl: 3, atk: 800, def: 900, base: 'haeufig',
    effect: 'Wenn diese Karte zerstört wird: Beschwöre 1 Karte mit bis zu 3 Sternen aus deinem Deck.' },
  { id: 'fuchssamurai', name: 'Fuchs-Samurai', theme: 'Geschichte', lvl: 6, atk: 2100, def: 1700, base: 'selten',
    effect: 'Diese Karte greift zweimal an, wenn sie eine Karte mit weniger ATK angreift.' },
  { id: 'torjaeger', name: 'Torjäger', theme: 'Sport', lvl: 5, atk: 1800, def: 1300, base: 'selten',
    effect: 'Einmal pro Zug: Erhöhe die ATK dieser Karte um 400, bis sie angreift.' },
  { id: 'kristallhirsch', name: 'Kristallhirsch', theme: 'Wissen', lvl: 6, atk: 1700, def: 2400, base: 'selten',
    effect: 'Solange diese Karte liegt, kann der Gegner keine Karten mit 4 Sternen oder weniger angreifen.' },
  { id: 'luftschifferin', name: 'Luftschiff-Kapitänin', theme: 'Technik', lvl: 6, atk: 2000, def: 1900, base: 'selten',
    effect: 'Einmal pro Zug: Lege 1 Karte vom Deck des Gegners beiseite.' },
  { id: 'cyberkatze', name: 'Cyber-Katze', theme: 'Technik', lvl: 4, atk: 1500, def: 1000, base: 'haeufig',
    effect: 'Wenn diese Karte beschworen wird: Sieh dir 3 Karten deines Decks an und nimm 1 auf die Hand.' },
  { id: 'goldskarabaeus', name: 'Gold-Skarabäus', theme: 'Geschichte', lvl: 5, atk: 1600, def: 1800, base: 'selten',
    effect: 'Solange diese Karte liegt, erhältst du bei jeder eigenen Beschwörung 200 Lebenspunkte.' },
];
// Welche Varianten es je Karte gibt
const VARIANTS = {
  kobold: ['haeufig', 'holo'],
  falke: ['haeufig', 'holo'],
  golem: ['selten', 'holo', 'ultra'],
  orakel: ['selten', 'holo', 'ultra'],
  drache: ['legend', 'ultra', 'ext'],
  schmied: ['legend', 'ultra', 'ext'],
  eisfee: ["haeufig", "holo"],
  einhorn: ["selten", "holo", "ultra"],
  sternpanther: ["selten", "holo", "ultra"],
  domgolem: ["legend", "ultra", "ext"],
  astroritter: ["selten", "holo"],
  inselschildkroete: ["selten", "holo", "ultra"],
  schildmaid: ["selten", "holo"],
  gepardwagen: ["selten", "holo", "ultra"],
  notentaenzerin: ["haeufig", "holo"],
  nachtoperator: ["selten", "holo", "ultra"],
  entschaerfer: ["selten", "holo"],
  buechermagierin: ["selten", "holo", "ultra"],
  blaetterphoenix: ["legend", "ultra", "ext"],
  meerkoenigin: ["selten", "holo", "ultra"],
  uhreule: ["haeufig", "holo"],
  sphinx: ["selten", "holo", "ultra"],
  sturmriese: ["legend", "ultra", "ext"],
  gartenfee: ["haeufig", "holo"],
  fuchssamurai: ["selten", "holo", "ultra"],
  torjaeger: ["selten", "holo"],
  kristallhirsch: ["selten", "holo", "ultra"],
  luftschifferin: ["selten", "holo"],
  cyberkatze: ["haeufig", "holo"],
  goldskarabaeus: ["selten", "holo"],
};
const VAR_NAME = { haeufig: 'Häufig', selten: 'Selten', holo: 'Holo', ultra: 'Ultra Rare', legend: 'Legendär', ext: 'Extended Art' };
const VAR_ORDER = ['haeufig', 'selten', 'holo', 'legend', 'ultra', 'ext'];

const PACKS = {
  standard: { id: 'standard', name: 'Standard-Booster', price: 900, cards: 3,
    odds: { haeufig: 0.70, selten: 0.22, holo: 0.05, ultra: 0.024, ext: 0.006 } },
  premium:  { id: 'premium',  name: 'Premium-Booster',  price: 2400, cards: 3,
    odds: { haeufig: 0.48, selten: 0.33, holo: 0.11, ultra: 0.06, ext: 0.02 } },
};

const card = (id) => CARDS.find((c) => c.id === id) || null;
const has = (id, v) => !!VARIANTS[id] && VARIANTS[id].includes(v);
// Welche Karten gibt es in dieser Stufe?
function poolFor(v) {
  if (v === 'haeufig' || v === 'selten') return CARDS.filter((c) => c.base === v).map((c) => c.id);
  if (v === 'legend') return CARDS.filter((c) => c.base === 'legend').map((c) => c.id);
  return Object.keys(VARIANTS).filter((id) => VARIANTS[id].includes(v));
}
function rollVariant(odds, minimum) {
  const keys = Object.keys(odds);
  let r = Math.random(), acc = 0, pick = keys[0];
  for (const k of keys) { acc += odds[k]; if (r <= acc) { pick = k; break; } }
  if (minimum) {
    const rank = (x) => VAR_ORDER.indexOf(x);
    if (rank(pick) < rank(minimum)) pick = minimum;
  }
  return pick;
}
function openPack(packId) {
  const p = PACKS[packId]; if (!p) return [];
  const out = [];
  for (let i = 0; i < p.cards; i++) {
    let v = rollVariant(p.odds, i === p.cards - 1 ? 'selten' : null);
    let pool = poolFor(v);
    if (!pool.length) { v = 'haeufig'; pool = poolFor(v); }
    // Legendäre Karten in Grundform nur über die Stufe "legend"
    if (v === 'selten' && !pool.length) v = 'haeufig';
    const id = pool[Math.floor(Math.random() * pool.length)];
    out.push({ id, variant: has(id, v) ? v : VARIANTS[id][0] });
  }
  return out;
}
// Diamanten pro Match: bis 200, abhängig von Sieg und Punkten
function diamondsFor({ win, score, pointLimit, counted }) {
  if (!counted) return 0;
  const share = Math.max(0, Math.min(1, score / Math.max(1, pointLimit)));
  const base = win ? 90 : 25;
  return Math.round(Math.min(200, base + share * (win ? 110 : 55)));
}
const view = () => ({ cards: CARDS, variants: VARIANTS, names: VAR_NAME, packs: Object.values(PACKS) });
module.exports = { CARDS, VARIANTS, VAR_NAME, VAR_ORDER, PACKS, card, has, openPack, diamondsFor, view };
