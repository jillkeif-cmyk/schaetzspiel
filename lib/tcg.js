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
];
// Welche Varianten es je Karte gibt
const VARIANTS = {
  kobold: ['haeufig', 'holo'],
  falke: ['haeufig', 'holo'],
  golem: ['selten', 'holo', 'ultra'],
  orakel: ['selten', 'holo', 'ultra'],
  drache: ['legend', 'ultra', 'ext'],
  schmied: ['legend', 'ultra', 'ext'],
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
