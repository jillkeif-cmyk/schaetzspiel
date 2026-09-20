// XP, Level, Prestige und Herausforderungen.
const MAX_LEVEL = 30;
const MAX_PRESTIGE = 11; // 11 = Meisterprestige
const need = (lvl) => 150 + 25 * lvl; // XP von Level lvl auf lvl+1
const CAP = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => need(i + 1)).reduce((a, b) => a + b, 0);

function levelInfo(xp) {
  let lvl = 1, rest = Math.min(xp, CAP);
  while (lvl < MAX_LEVEL && rest >= need(lvl)) { rest -= need(lvl); lvl++; }
  return { level: lvl, into: lvl === MAX_LEVEL ? 0 : rest, next: lvl === MAX_LEVEL ? 0 : need(lvl), max: lvl === MAX_LEVEL };
}

// Herausforderungen mit Stufen. Jede erreichte Stufe gibt einmalig XP.
const CHALLENGES = [
  { key: 'wins', name: 'Seriensieger', desc: 'Gewinne Matches', tiers: [1, 3, 10, 25, 50, 100], xp: [200, 400, 800, 1500, 2500, 5000] },
  { key: 'matches', name: 'Stammgast', desc: 'Spiele Matches zu Ende', tiers: [1, 5, 20, 50, 100, 200], xp: [100, 250, 500, 1000, 2000, 4000] },
  { key: 'exact', name: 'Punktlandung', desc: 'Triff den exakten Wert', tiers: [1, 3, 6, 10, 15, 25], xp: [500, 1000, 1500, 2500, 3500, 5000] },
  { key: 'close', name: 'Haarscharf', desc: 'Lande im Doppel-Bereich (×2)', tiers: [5, 15, 40, 80, 150, 300], xp: [200, 400, 800, 1500, 2500, 4000] },
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
const LABEL = { points: 'Punkte insgesamt', rank_points: 'Weltranglistenpunkte', wins: 'Siege', matches: 'Matches', exact: 'Punktlandungen', close: 'Doppelte (×2)', mc_right: 'Auswahlfragen richtig', answered: 'Fragen beantwortet', best_score: 'Punkte in einem Match', best_streak: 'Siege in Folge' };
const PRESTIGE_NAMES = ['', 'Bronzewinkel', 'Messschieber', 'Volltreffer', 'Silbereule', 'Goldkompass', 'Goldwolf', 'Smaragdkobra', 'Sturmadler', 'Rubinkrone', 'Flamme', 'Meisterprestige'];

function prestigeStatus(u) {
  const next = u.prestige + 1;
  if (next > MAX_PRESTIGE) return { next: null, reqs: [], can: false };
  const lv = levelInfo(u.xp);
  const reqs = [{ label: `Level ${MAX_LEVEL}`, cur: lv.level, goal: MAX_LEVEL, done: lv.max },
    ...Object.entries(PRESTIGE_REQ[next]).map(([k, g]) => ({ label: LABEL[k], cur: Math.min(u[k] || 0, g), goal: g, done: (u[k] || 0) >= g }))];
  return { next, name: PRESTIGE_NAMES[next], reqs, can: reqs.every((r) => r.done) };
}

function challengeView(u) {
  return CHALLENGES.map((c) => {
    const cur = u[c.key] || 0, done = c.tiers.filter((t) => cur >= t).length;
    return { key: c.key, name: c.name, desc: c.desc, cur, done, total: c.tiers.length, goal: c.tiers[done] ?? null, reward: c.xp[done] ?? null };
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
  if (r.win) parts.push(['Sieg', 250]);
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
