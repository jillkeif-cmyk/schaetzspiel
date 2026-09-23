// XP, Level, Prestige und Herausforderungen.
const MAX_LEVEL = 30;
const MAX_PRESTIGE = 11; // 11 = Meisterprestige
const need = (lvl) => 150 + 25 * lvl; // XP von Level lvl auf lvl+1
const CAP = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => need(i + 1)).reduce((a, b) => a + b, 0);

function levelInfo(xp) {
  let lvl = 1, rest = Math.min(xp, CAP);
  while (lvl < MAX_LEVEL && rest >= need(lvl)) { rest -= need(lvl); lvl++; }
  return { level: lvl, into: lvl === MAX_LEVEL ? 0 : rest, next: lvl === MAX_LEVEL ? 0 : need(lvl), max: lvl === MAX_LEVEL, xpTotal: Math.max(0, Math.min(Number(xp) || 0, CAP)), xpCap: CAP };
}

// Herausforderungen mit Stufen. Jede erreichte Stufe gibt einmalig XP.
const CHALLENGES = [
  { key: 'poker_minutes', name: 'Sitzfleisch', desc: 'Verbringe Zeit am Pokertisch (Minuten)', tiers: [30, 120, 300, 600, 1500, 3000], xp: [150, 300, 700, 1400, 2800, 5600], group: 'casino', isNew: true },
  { key: 'poker_hands', name: 'Am Tisch', desc: 'Spiele Poker-Hände', tiers: [10, 50, 200, 600, 1500, 4000], xp: [150, 300, 700, 1400, 2800, 5600], group: 'casino', isNew: true },
  { key: 'poker_wins', name: 'Pot-Jäger', desc: 'Gewinne Pots beim Poker', tiers: [5, 25, 100, 300, 800, 2000], xp: [200, 400, 900, 1800, 3600, 7200], group: 'casino', isNew: true },
  { key: 'poker_best', name: 'Großer Pot', desc: 'Gewinne einen großen Pot auf einmal', tiers: [300, 1500, 5000, 20000, 60000, 150000], xp: [150, 350, 800, 1600, 3200, 6400], group: 'casino', isNew: true },
  { key: 'poker_allin_wins', name: 'Alles oder nichts', desc: 'Gewinne Hände, in denen du All-in warst', tiers: [1, 5, 20, 50, 120, 300], xp: [200, 400, 900, 1800, 3600, 7200], group: 'casino', isNew: true },
  { key: 'toon_distinct', name: 'Toon-Sammler', desc: 'Sammle verschiedene Toon-Welt-Karten', tiers: [3, 8, 15, 22, 28, 33], xp: [200, 400, 800, 1600, 3200, 6400], group: 'toon', isNew: true },
  { key: 'slot_full', name: 'Vollbild-Jäger', desc: 'Hol Vollbilder bei Triple Crown', tiers: [1, 3, 10, 25, 60], xp: [200, 600, 1500, 4000, 10000], group: 'casino' },
  { key: 'slot_best', name: 'Walzenglück', desc: 'Gewinne in einem Triple-Crown-Spiel', tiers: [2500, 10000, 50000, 250000, 1000000], xp: [200, 600, 1500, 4000, 10000], group: 'casino' },
  { key: 'casino_rounds', name: 'Stammspieler', desc: 'Spiele Casino-Runden', tiers: [10, 50, 150, 400, 1000, 2500], xp: [150, 300, 600, 1200, 2400, 5000] },
  { key: 'casino_wins', name: 'Glückssträhne', desc: 'Gewinne im Casino', tiers: [5, 25, 75, 200, 500, 1200], xp: [150, 350, 700, 1400, 2800, 5600] },
  { key: 'casino_best', name: 'Großer Wurf', desc: 'Gewinne auf einmal', tiers: [500, 2000, 5000, 15000, 40000, 100000], xp: [200, 400, 800, 1600, 3200, 6400] },
  { key: 'collect_unique', name: 'Komplettist', desc: 'Sammle verschiedene Karten, jede Fassung zählt einmal', tiers: [25, 75, 150, 250, 295], xp: [400, 1000, 2500, 6000, 15000], group: 'cards' },
  { key: 'cards_total', name: 'Sammler', desc: 'Sammle Karten', tiers: [10, 40, 100, 250, 500, 1000], xp: [150, 300, 600, 1200, 2400, 5000] },
  { key: 'cards_rare', name: 'Rarität', desc: 'Sammle seltene Karten (Holo und besser)', tiers: [3, 10, 25, 60, 120, 250], xp: [200, 400, 800, 1600, 3200, 6400] },
  { key: 'cards_ext', name: 'Vitrine', desc: 'Sammle Extended-Art- und Ghost-Karten', tiers: [1, 3, 6, 12, 20, 40], xp: [300, 600, 1200, 2400, 4800, 9000] },
  { key: 'wins', name: 'Seriensieger', desc: 'Gewinne Matches', tiers: [1, 3, 10, 25, 50, 100], xp: [200, 400, 800, 1500, 2500, 5000] },
  { key: 'matches', name: 'Stammgast', desc: 'Spiele Matches zu Ende', tiers: [1, 5, 20, 50, 100, 200], xp: [100, 250, 500, 1000, 2000, 4000] },
  { key: 'exact', name: 'Punktlandung', desc: 'Triff den exakten Wert', tiers: [1, 3, 6, 10, 15, 25], xp: [500, 1000, 1500, 2500, 3500, 5000] },
  { key: 'close', name: 'Haarscharf', desc: 'Schätze höchstens 8 % daneben: Doppel-Treffer (×2)', tiers: [5, 15, 40, 80, 150, 300], xp: [200, 400, 800, 1500, 2500, 4000] },
  { key: 'mc_right', name: 'Richtig getippt', desc: 'Beantworte Auswahlfragen richtig', tiers: [10, 30, 100, 250, 500], xp: [150, 300, 800, 1500, 3000] },
  { key: 'answered', name: 'Dauerbrenner', desc: 'Beantworte Fragen', tiers: [50, 200, 500, 1500, 3000], xp: [150, 400, 800, 2000, 4000] },
  { key: 'best_score', name: 'Highscore', desc: 'Punkte in einem einzigen Match', tiers: [500, 1000, 1500, 2500, 4000], xp: [200, 400, 800, 1500, 3000] },
  { key: 'best_streak', name: 'Lauf', desc: 'Gewinne Matches in Folge', tiers: [2, 3, 5, 7], xp: [400, 800, 2000, 4000] },
];

// Bedingungen, um den jeweiligen Prestige-Rang zu betreten (zusätzlich zu Level 30).
const PRESTIGE_REQ = {
  1: { wins: 3 },
  2: { wins: 8, close: 15 },
  3: { exact: 1, matches: 30 },
  4: { wins: 20, mc_right: 100 },
  5: { exact: 3, close: 60 },
  6: { wins: 35, answered: 1500 },
  7: { exact: 6, best_score: 1500 },
  8: { wins: 60, best_streak: 3 },
  9: { exact: 10, best_score: 2500 },
  10: { wins: 100, exact: 15, best_streak: 5 },
  11: { wins: 150, exact: 25, best_streak: 7, rank_points: 2000, points: 150000 },
};
const LABEL = { poker_minutes: 'Minuten am Pokertisch', poker_hands: 'Poker-Hände', poker_wins: 'gewonnene Pots', poker_best: 'Diamanten in einem Pot', poker_allin_wins: 'gewonnene All-ins', toon_distinct: 'Toon-Welt-Karten', slot_full: 'Vollbilder bei Triple Crown', slot_best: 'Gewinn in einem Triple-Crown-Spiel', slot_spins: 'Drehungen bei Triple Crown', casino_rounds: 'Casino-Runden', casino_wins: 'Casino-Siege', casino_best: 'Bester Casino-Gewinn', collect_unique: 'verschiedene Karten', cards_total: 'Karten', cards_rare: 'Seltene Karten', cards_ext: 'Extended-Art-Karten', points: 'Punkte insgesamt', rank_points: 'Weltranglistenpunkte', wins: 'Siege', matches: 'Matches', exact: 'Punktlandungen', close: 'Doppel-Treffer (×2)', mc_right: 'Auswahlfragen richtig', answered: 'Fragen beantwortet', best_score: 'Punkte in einem Match', best_streak: 'Siege in Folge' };
const PRESTIGE_NAMES = ['', 'Bronzewinkel', 'Messschieber', 'Volltreffer', 'Silbereule', 'Goldkompass', 'Goldwolf', 'Smaragdkobra', 'Sturmadler', 'Rubinkrone', 'Flamme', 'Meisterprestige'];

function prestigeStatus(u) {
  const next = u.prestige + 1;
  if (next > MAX_PRESTIGE) return { next: null, reqs: [], can: false };
  const lv = levelInfo(u.xp);
  const reqs = [{ label: `Level ${MAX_LEVEL}`, cur: lv.level, goal: MAX_LEVEL, done: lv.max },
    ...Object.entries(PRESTIGE_REQ[next]).map(([k, g]) => ({ key: k, label: LABEL[k], cur: Math.min(u[k] || 0, g), goal: g, done: (u[k] || 0) >= g }))];
  return { next, name: PRESTIGE_NAMES[next], reqs, can: reqs.every((r) => r.done) };
}

function challengeView(u) {
  return CHALLENGES.map((c) => {
    const cur = u[c.key] || 0, done = c.tiers.filter((t) => cur >= t).length;
    return { key: c.key, name: c.name, desc: c.desc, cur, done, total: c.tiers.length, goal: c.tiers[done] ?? null, reward: c.xp[done] ?? null, tiers: c.tiers, xps: c.xp, group: c.group || (c.key.startsWith('casino_') ? 'casino' : c.key.startsWith('cards_') ? 'cards' : 'quiz'), isNew: !!c.isNew };
  });
}

// Weltranglistenpunkte: nur im Ranglisten-Modus, nach Platzierung und Feld
const RANK_BASE = [30, 18, 12, 8, 5, 3, 2, 1];
function rankPointsFor(place, players, exact) {
  const base = RANK_BASE[Math.min(place, RANK_BASE.length - 1)] || 1;
  return Math.round(base * (0.7 + 0.08 * Math.min(players, 8))) + 5 * (exact || 0);
}

// Wendet ein beendetes Match auf den Nutzer an. Liefert neue Werte und eine Zusammenfassung.
function applyMatch(u, r) {
  const before = { ...u }, lvBefore = levelInfo(u.xp);
  const n = { ...u };
  for (const k of ['answered', 'exact', 'close', 'mc_right', 'mc_total', 'dev_sum', 'dev_n']) n[k] = (u[k] || 0) + (r[k] || 0);
  n.matches = u.matches + 1; n.wins = u.wins + (r.win ? 1 : 0); n.points = u.points + r.score;
  n.best_score = Math.max(u.best_score || 0, r.score);
  n.rank_points = (u.rank_points || 0) + (r.ranked ? rankPointsFor(r.place, r.players, r.exact) : 0);
  if (r.counted) { n.streak = r.win ? (u.streak || 0) + 1 : 0; n.best_streak = Math.max(u.best_streak || 0, n.streak); }
  const parts = [['Match beendet', 100], ['Punkte', Math.round(r.score * 0.5)], ['Beantwortete Fragen', (r.answered || 0) * 10]];
  // Längere Matches bringen mehr: der Siegbonus wächst mit dem Punktelimit
  if (r.win) parts.push(['Sieg', Math.round(150 + Math.min(4000, r.pointLimit || 1000) / 8)]);
  if (r.exact) parts.push([`Punktlandung ×${r.exact}`, 300 * r.exact]);
  const unlocked = [];
  for (const c of CHALLENGES) c.tiers.forEach((t, i) => { if ((before[c.key] || 0) < t && (n[c.key] || 0) >= t) { unlocked.push({ name: `${c.name} ${i + 1}`, xp: c.xp[i] }); parts.push([`Herausforderung: ${c.name} ${i + 1}`, c.xp[i]]); } });
  const gained = parts.reduce((s, p) => s + p[1], 0);
  n.xp = Math.min(CAP, u.xp + gained);
  const lvAfter = levelInfo(n.xp);
  return { user: n, summary: { parts, gained, levelBefore: lvBefore.level, levelAfter: lvAfter.level, unlocked, canPrestige: prestigeStatus(n).can, rankGain: n.rank_points - (u.rank_points || 0), rankTotal: n.rank_points } };
}

const xpForLevel = (lvl) => { let x = 0; for (let i = 1; i < Math.min(Math.max(1, lvl), MAX_LEVEL); i++) x += need(i); return x; };

module.exports = { xpForLevel, rankPointsFor, MAX_LEVEL, MAX_PRESTIGE, CAP, PRESTIGE_NAMES, levelInfo, prestigeStatus, challengeView, applyMatch };
