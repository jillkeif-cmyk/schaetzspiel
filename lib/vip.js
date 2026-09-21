// VIP-Stufen im Casino: Casino-XP füllen die Leiter
// Richtwert: rund 25.000 XP an einem langen Spieltag, Black Card also nach etwa einer Woche
const TIERS = [
  { key: 'bronze',  name: 'Bronze',     xp: 0,      cashback: 0,    spins: 1, theme: 'gruen' },
  { key: 'silber',  name: 'Silber',     xp: 5000,   cashback: 0,    spins: 1, theme: 'blau' },
  { key: 'gold',    name: 'Gold',       xp: 15000,  cashback: 0.03, spins: 2, theme: 'rot' },
  { key: 'platin',  name: 'Platin',     xp: 40000,  cashback: 0.05, spins: 2, theme: 'violett' },
  { key: 'diamant', name: 'Diamant',    xp: 90000,  cashback: 0.07, spins: 3, theme: 'eis' },
  { key: 'black',   name: 'Black Card', xp: 175000, cashback: 0.10, spins: 3, theme: 'schwarz' },
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
const CASHBACK_CAP = 25000;

// Glücksrad: Felder mit Gewicht. Höhere Stufen verdoppeln Diamantgewinne teilweise.
const WHEEL = [
  { label: '250', dia: 250, w: 22 },
  { label: '500', dia: 500, w: 20 },
  { label: '1.000', dia: 1000, w: 16 },
  { label: 'Booster', pack: 'standard', w: 10 },
  { label: '2.500', dia: 2500, w: 10 },
  { label: 'Premium', pack: 'premium', w: 7 },
  { label: '5.000', dia: 5000, w: 6 },
  { label: 'Geister', pack: 'ghost', w: 4 },
  { label: '10.000', dia: 10000, w: 3 },
  { label: 'JACKPOT', dia: 25000, w: 2 },
];
function spinWheel(tier) {
  const bonus = 1 + tier * 0.1; // bis zu +50 % Diamanten bei Black Card
  const total = WHEEL.reduce((s, f) => s + f.w, 0);
  let r = Math.random() * total, idx = 0;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r <= 0) { idx = i; break; } }
  const f = WHEEL[idx];
  return { index: idx, label: f.label, dia: f.dia ? Math.round(f.dia * bonus) : 0, pack: f.pack || null };
}
module.exports = { TIERS, THEMES, tierIndex, WHEEL, spinWheel, CASHBACK_CAP };
