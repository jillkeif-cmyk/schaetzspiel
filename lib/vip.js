// VIP-Stufen im Casino: Casino-XP füllen die Leiter
// Richtwert: bei üblichen Einsätzen rund 30 XP pro Runde, Black Card also nach etwa 3.000 Runden
const TIERS = [
  { key: 'bronze',  name: 'Bronze',     xp: 0,     cashback: 0,    spins: 1, theme: 'gruen' },
  { key: 'silber',  name: 'Silber',     xp: 3000,  cashback: 0,    spins: 1, theme: 'blau' },
  { key: 'gold',    name: 'Gold',       xp: 10000, cashback: 0.03, spins: 2, theme: 'rot' },
  { key: 'platin',  name: 'Platin',     xp: 25000, cashback: 0.05, spins: 2, theme: 'violett' },
  { key: 'diamant', name: 'Diamant',    xp: 50000, cashback: 0.07, spins: 3, theme: 'eis' },
  { key: 'black',   name: 'Black Card', xp: 90000, cashback: 0.10, spins: 3, theme: 'schwarz' },
  { key: 'obsidian', name: 'Obsidianherz', xp: 250000,   cashback: 0.12, spins: 4, theme: 'obsidian' },
  { key: 'purpur',   name: 'Purpurflamme', xp: 750000,   cashback: 0.14, spins: 4, theme: 'purpur' },
  { key: 'geist',    name: 'Geisterhand',  xp: 2000000,  cashback: 0.16, spins: 5, theme: 'geist' },
  { key: 'schatten', name: 'Schattenkrone', xp: 5000000, cashback: 0.18, spins: 5, theme: 'schatten' },
  { key: 'toten',    name: 'Totenkönig',   xp: 10000000, cashback: 0.20, spins: 6, theme: 'toten' },
];
const THEMES = [
  { key: 'gruen',   name: 'Klassisch Grün', tier: 0 },
  { key: 'blau',    name: 'Mitternachtsblau', tier: 1 },
  { key: 'rot',     name: 'Rot und Gold', tier: 2 },
  { key: 'violett', name: 'Amethyst', tier: 3 },
  { key: 'eis',     name: 'Eiskristall', tier: 4 },
  { key: 'schwarz', name: 'Schwarz-Gold', tier: 5 },
  { key: 'obsidian', name: 'Obsidianherz', tier: 6 },
  { key: 'purpur',   name: 'Purpurflamme', tier: 7 },
  { key: 'geist',    name: 'Geisterhand',  tier: 8 },
  { key: 'schatten', name: 'Schattenkrone', tier: 9 },
  { key: 'toten',    name: 'Totenkönig',   tier: 10 },
];
const tierIndex = (xp) => { let i = 0; TIERS.forEach((t, k) => { if ((xp || 0) >= t.xp) i = k; }); return i; };
const CASHBACK_CAP = 25000; // Deckel pro Tag

// Glücksrad (neu): 12 Felder, im Schnitt rund 3.300 Diamanten plus Booster je Drehung, Jackpot 150.000 (≈ 1 zu 400)
const WHEEL = [
  { label: '1.000', dia: 1000, w: 22 },
  { label: 'Premium', pack: 'premium', w: 12 },
  { label: '2.000', dia: 2000, w: 18 },
  { label: 'Geister', pack: 'ghost', w: 7 },
  { label: '3.000', dia: 3000, w: 14 },
  { label: 'Gruselnacht', pack: 'gn', w: 5 },
  { label: '5.000', dia: 5000, w: 10 },
  { label: 'Toon', pack: 'toon', w: 3 },
  { label: '10.000', dia: 10000, w: 6 },
  { label: '25.000', dia: 25000, w: 2 },
  { label: '50.000', dia: 50000, w: 0.6 },
  { label: 'JACKPOT', dia: 150000, w: 0.25 },
]
function spinWheel() {
  const total = WHEEL.reduce((s, f) => s + f.w, 0);
  let r = Math.random() * total, idx = 0;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r <= 0) { idx = i; break; } }
  const f = WHEEL[idx];
  return { index: idx, label: f.label, dia: f.dia || 0, pack: f.pack || null };
}

// Casino-XP nach echtem Risiko: was man in mindestens der Hälfte der Fälle ohnehin zurückbekommt, zählt nicht
// Casino-XP: etwa zweieinhalbmal so viel wie früher, gedämpft über die Wurzel, damit riesige Einsätze nicht alles überholen
function xpFor(risk, won, stake) { // Grundwert nach Einsatz; große Gewinne (ab 5-fachem Einsatz) bringen einen mitwachsenden Zuschlag
  const base = Math.min(400, 15 + Math.round(Math.sqrt(Math.max(0, risk)) * 1.6));
  const m = stake > 0 ? won / stake : 0;
  const f = m <= 1 ? 0 : m < 5 ? 0.3 : 0.3 + 1.5 * (Math.sqrt(Math.min(m, 1000)) - Math.sqrt(5)); // 20× ≈ 3,7-fach, 200× ≈ 18-fach des Grundwerts
  return Math.min(15000, base + Math.round(base * f));
}
module.exports = { TIERS, THEMES, tierIndex, WHEEL, spinWheel, xpFor, CASHBACK_CAP };
