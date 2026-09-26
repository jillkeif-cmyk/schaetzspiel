// Kirmes-Spiele und Rakete (Crash). Alle Ergebnisse würfelt der Server, feste Auszahlungsquoten (RTP) wie im übrigen Casino.
const crypto = require('crypto');
const rnd = () => crypto.randomInt(0, 1e9) / 1e9; // gleichverteilt in [0, 1)
const pick = (table) => { let u = rnd(), acc = 0; for (const t of table) { acc += t.p; if (u < acc) return t; } return table[table.length - 1]; };

// ---------- Hau den Lukas: Geschicklichkeit + etwas Glück ----------
// acc = wo die Nadel gestoppt wurde (1 = ganz rechts). Selbst perfektes Timing bringt höchstens ~96 % zurück, damit die Bank nie verliert.
const LUKAS = [
  { m: 4, from: 96, to: 100, label: 'GLOCKE!' },
  { m: 1.5, from: 88, to: 95, label: 'Bärenstark!' },
  { m: 1, from: 78, to: 87, label: 'Einsatz zurück' },
  { m: 0.3, from: 62, to: 77, label: 'Halbe Kraft' },
  { m: 0, from: 8, to: 61, label: 'Zu schwach' },
];
function lukas(acc) {
  const a = Math.max(0, Math.min(1, Number(acc) || 0)), eff = 1 - (1 - a) * 0.55; // etwas gnädiger nahe der Spitze
  const h = Math.max(8, Math.min(100, Math.round(100 * eff * (0.525 + rnd() * 0.475))));
  const t = LUKAS.find((x) => h >= x.from) || LUKAS[LUKAS.length - 1];
  return { height: h, mult: t.m, label: t.label, acc: a };
}
// ---------- Pferderennen: jede Wahl hat dieselbe Quote (RTP ≈ 94,7 %) ----------
const HORSES = [
  { name: 'Blitz', color: '#E23B3B', m: 2.2 }, { name: 'Donner', color: '#2F7DE1', m: 4 }, { name: 'Kobold', color: '#2FB36B', m: 6.5 },
  { name: 'Pfeffer', color: '#E0A21E', m: 10 }, { name: 'Nebel', color: '#8E4BD6', m: 16 }, { name: 'Glückspilz', color: '#E85DB0', m: 28 },
];
const HSUM = HORSES.reduce((a, h) => a + 1 / h.m, 0), HRTP = 1 / HSUM; // Wahrscheinlichkeit je Pferd = RTP / Quote
function race() {
  const w = pick(HORSES.map((h, i) => ({ i, p: HRTP / h.m })));
  const order = [w.i, ...HORSES.map((_, i) => i).filter((i) => i !== w.i).sort(() => rnd() - 0.5)];
  const rank = HORSES.map((_, i) => order.indexOf(i));
  // 8 Zwischenstände: zufälliges Tempo mit Führungswechseln, am Ende läuft alles auf den Zieleinlauf zu
  const K = 8, legs = [];
  let pos = HORSES.map(() => 0);
  for (let k = 1; k <= K; k++) {
    const f = k / K;
    pos = pos.map((p, i) => { const target = f * (1 - rank[i] * 0.035 * f * f), wob = (rnd() - 0.5) * 0.09 * (1 - f * f); return Math.max(p + 0.01, Math.min(0.999, target + wob)); });
    legs.push(pos.slice());
  }
  legs[K - 1] = HORSES.map((_, i) => 1 - rank[i] * 0.035);
  return { winner: w.i, order, legs };
}

// ---------- Greifautomat: Preise im Glaskasten (RTP 95 % + kleine Booster-Chance) ----------
const CLAW = [
  { k: 'none', m: 0, p: 0.55, label: 'Knapp daneben' },
  { k: 'dia', m: 0.5, p: 0.15, label: 'Kleines Säckchen' },
  { k: 'dia', m: 1, p: 0.12, label: 'Säckchen' },
  { k: 'dia', m: 2, p: 0.09, label: 'Großes Säckchen' },
  { k: 'dia', m: 5, p: 0.055, label: 'Diamanten-Truhe' },
  { k: 'dia', m: 15, p: 0.02, label: 'Goldene Truhe!' },
  { k: 'pack', m: 0, p: 0.015, label: 'Premium-Booster!', pack: 'premium' },
];
// Neuer Greifautomat: sichtbare Preise, man zielt selbst. Greifchance = 0,95 / Wert → jede Wahl hat 95 % Quote
const CLAW_ITEMS = { s1: { m: 1, name: 'Kleines Säckchen' }, s2: { m: 2, name: 'Säckchen' }, c5: { m: 5, name: 'Truhe' }, c15: { m: 15, name: 'Goldene Truhe' } };
function clawGrab(type) { const it = CLAW_ITEMS[type]; if (!it) return null; const p = 0.95 / it.m, ok = rnd() < p; return { type, m: it.m, name: it.name, ok, chance: p, slip: !ok && rnd() < 0.6 }; }
function claw() { const t = pick(CLAW); return { kind: t.k, mult: t.m, label: t.label, pack: t.pack || null, drop: t.k === 'none' && rnd() < 0.5 }; }

// ---------- Münzschieber: Münzen fallen über die Kante (RTP 93 % + 3 % in den gemeinsamen Jackpot) ----------
const PUSH = [
  { m: 0, p: 0.45, label: 'Nichts gefallen' },
  { m: 0.5, p: 0.20, label: 'Ein paar Münzen' },
  { m: 1, p: 0.15, label: 'Einsatz zurück' },
  { m: 2, p: 0.12, label: 'Münzregen' },
  { m: 4, p: 0.06, label: 'Lawine!' },
  { m: 10, p: 0.02, label: 'Riesenlawine!' },
];
const JACKPOT_SHARE = 0.03, JACKPOT_CHANCE = 1 / 2500, JACKPOT_SEED = 25000;
function pusher() { const t = pick(PUSH); return { mult: t.m, label: t.label, coins: t.m ? Math.min(40, Math.round(4 + t.m * 3.5)) : Math.round(rnd() * 2), jackpot: rnd() < JACKPOT_CHANCE }; }

// ---------- Rakete: Absturzpunkt mit P(Absturz ≥ m) = 0,96 / m (RTP 96 % bei jeder Ausstiegsstrategie) ----------
const ROCKET_MAX = 1000, GROWTH = 0.075; // Multiplikator = e^(0,075 · Sekunden): 2× nach ~9 s, 10× nach ~31 s
function crashPoint() { const u = rnd(); const c = 0.96 / (1 - u); return c < 1 ? 1 : Math.min(ROCKET_MAX, Math.floor(c * 100) / 100); }
const multAt = (ms) => Math.floor(Math.exp(GROWTH * ms / 1000) * 100) / 100;
const msFor = (m) => Math.log(m) / GROWTH * 1000;

// ---------- Gemeinsamer Münzschieber: 95 % jedes Einwurfs landen im Pool, was fällt, hängt vom Füllstand ab (Erhaltung: Quote auf Dauer 95 %) ----------
const PM_T = 2500, PM_CAP = 15000, PM_SHARE = 0.95, PM_COIN = 100, PM_SEED = 800;
function pusherFall(pool, n) {
  const fill = Math.max(0.35, Math.min(4, Math.pow(pool / PM_T, 0.7)));
  const u = rnd(), noise = u < 0.55 ? rnd() * 0.6 : u < 0.9 ? 0.6 + rnd() * 1.2 : 1.8 + rnd() * 3.2; // meist wenig, manchmal viel, selten sehr viel
  let f = Math.round(PM_SHARE * n * fill * noise / 1.19), avalanche = false;
  if (pool > PM_CAP) f += Math.round((pool - PM_CAP) * 0.5);
  if (rnd() < 0.004 * Math.min(1, n / 10) && pool > 300) { f += Math.round(pool * (0.08 + rnd() * 0.12)); avalanche = true; } // seltene Lawine: ein Turm kippt
  return { fell: Math.max(0, Math.min(pool, f)), avalanche };
}
module.exports = { clawGrab, CLAW_ITEMS, pusherFall, PM_T, PM_CAP, PM_SHARE, PM_COIN, PM_SEED, lukas, LUKAS, race, HORSES, HRTP, claw, CLAW, pusher, PUSH, JACKPOT_SHARE, JACKPOT_CHANCE, JACKPOT_SEED, crashPoint, multAt, msFor, ROCKET_MAX };
