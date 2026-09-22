// VIP-Stufen im Casino: Casino-XP füllen die Leiter
// Richtwert: bei üblichen Einsätzen rund 30 XP pro Runde, Black Card also nach etwa 3.000 Runden
const TIERS = [
  { key: 'bronze',  name: 'Bronze',     xp: 0,     cashback: 0,    spins: 1, theme: 'gruen' },
  { key: 'silber',  name: 'Silber',     xp: 3000,  cashback: 0,    spins: 1, theme: 'blau' },
  { key: 'gold',    name: 'Gold',       xp: 10000, cashback: 0.03, spins: 2, theme: 'rot' },
  { key: 'platin',  name: 'Platin',     xp: 25000, cashback: 0.05, spins: 2, theme: 'violett' },
  { key: 'diamant', name: 'Diamant',    xp: 50000, cashback: 0.07, spins: 3, theme: 'eis' },
  { key: 'black',   name: 'Black Card', xp: 90000, cashback: 0.10, spins: 3, theme: 'schwarz' },
];
const THEMES = [
  { key: 'gruen',   name: 'Klassisch Grün', tier: 0 },
  { key: 'blau',    name: 'Mitternachtsblau', tier: 1 },
  { key: 'rot',     name: 'Rot und Gold', tier: 2 },
  { key: 'violett', name: 'Amethyst', tier: 3 },
  { key: 'eis',     name: 'Eiskristall', tier: 4 },
  { key: 'schwarz', name: 'Schwarz-Gold', tier: 5 },
];
const tierIndex = (xp) => { let i = 0; TIERS.forEach((t, k) => { if ((xp || 0) >= t.xp) i = k; }); return i; };
const CASHBACK_CAP = 25000; // Deckel pro Tag

// Glücksrad: Felder mit Gewicht. Höhere Stufen verdoppeln Diamantgewinne teilweise.
// Glücksrad: im Schnitt rund 400 Diamanten pro Drehung, also etwa ein Booster
const WHEEL = [
  { label: '50', dia: 50, w: 20 },
  { label: '100', dia: 100, w: 20 },
  { label: '250', dia: 250, w: 18 },
  { label: '500', dia: 500, w: 14 },
  { label: 'Booster', pack: 'standard', w: 10 },
  { label: '1.000', dia: 1000, w: 8 },
  { label: 'Premium', pack: 'premium', w: 4 },
  { label: '2.500', dia: 2500, w: 3 },
  { label: 'Geister', pack: 'ghost', w: 2 },
  { label: 'JACKPOT', dia: 5000, w: 1 },
];
function spinWheel() {
  const total = WHEEL.reduce((s, f) => s + f.w, 0);
  let r = Math.random() * total, idx = 0;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r <= 0) { idx = i; break; } }
  const f = WHEEL[idx];
  return { index: idx, label: f.label, dia: f.dia || 0, pack: f.pack || null };
}

// Casino-XP nach echtem Risiko: was man in mindestens der Hälfte der Fälle ohnehin zurückbekommt, zählt nicht
// Casino-XP: etwa zweieinhalbmal so viel wie früher, gedämpft über die Wurzel, damit riesige Einsätze nicht alles überholen
function xpFor(risk, won, stake) {
  const base = 15 + Math.round(Math.sqrt(Math.max(0, risk)) * 1.6);
  const bonus = won > stake ? Math.round(base * 0.3) : 0;
  return Math.min(400, base + bonus);
}
module.exports = { TIERS, THEMES, tierIndex, WHEEL, spinWheel, xpFor, CASHBACK_CAP };
