// Kronen-Pass: Saison mit 30 Stufen. Links gratis für alle, rechts Premium für PREMIUM_PRICE Diamanten.
// Pass-XP kommen aus normaler Match-XP (ohne Herausforderungs-XP, ohne Casino). Wer später Premium kauft,
// kann alle schon erreichten Premium-Stufen sofort abholen. Nach Stufe 30 füllt sich der Bonus-Tresor (nur Premium).
const PREMIUM_PRICE = 15000;
const XP_PER_TIER = 2000;
const TIERS = 30;
const BANK = { every: 2000, dia: 500, max: 5000 }; // Tresor: pro 2.000 Pass-XP nach Stufe 30 kommen 500 dazu, höchstens 5.000

const SEASON = {
  id: 's1', name: 'Geisternacht', nr: 1,
  start: '2026-09-23T00:00:00+02:00', end: '2026-10-31T23:59:59+01:00',
  banner: '/news/pass_s1.webp',
};

// Belohnungen: dia = Diamanten, pack = Booster (id aus tcg.PACKS), item = Titel/Emblem/Rahmen (freigeschaltet über unlocks)
const d = (n) => ({ dia: n });
const FREE = {}, PREM = {};
for (let t = 1; t <= TIERS; t++) { FREE[t] = d(t % 5 === 0 ? 400 : 200); PREM[t] = d(500); }
Object.assign(FREE, { 5: { pack: 'standard' }, 15: { pack: 'standard' }, 20: { pack: 'premium' }, 25: { pack: 'standard' }, 30: { item: 'EP1', kind: 'emblem', name: 'Kürbiskrone' } });
Object.assign(PREM, {
  5: { dia: 500, pack: 'premium' }, 10: { dia: 2000, pack: 'premium' }, 15: { dia: 500, pack: 'ghost' },
  20: { dia: 2000, item: 'fp1', kind: 'frame', name: 'Geisternacht' }, 25: { dia: 500, pack: 'ghost' },
  30: { dia: 5000, item: 'TP1', kind: 'title', name: 'Geisterfürst', item2: 'EP2', kind2: 'emblem', name2: 'Geisterkönig' },
});

const WEEK_TASKS = [ // wöchentliche Aufgaben, Fortschritt = Zuwachs seit Wochenbeginn
  { id: 'w1', text: 'Spiele 10 Matches zu Ende', key: 'matches', goal: 10, xp: 1500 },
  { id: 'w2', text: 'Gewinne 3 Matches', key: 'wins', goal: 3, xp: 1500 },
  { id: 'w3', text: 'Lande 3 Punktlandungen', key: 'exact', goal: 3, xp: 2000 },
];
const weekId = (now = Date.now()) => { const dt = new Date(now + 2 * 3600e3); const day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day); return dt.toISOString().slice(0, 10); }; // Montag (dt. Zeit)

const active = (now = Date.now()) => now >= Date.parse(SEASON.start) && now <= Date.parse(SEASON.end);
const tierOf = (xp) => Math.min(TIERS, Math.floor((Number(xp) || 0) / XP_PER_TIER));
const bankOf = (xp) => { const over = Math.max(0, (Number(xp) || 0) - TIERS * XP_PER_TIER); return Math.min(BANK.max, Math.floor(over / BANK.every) * BANK.dia); };
const set = (s) => new Set(String(s || '').split(',').filter(Boolean));

// Nutzerstand in die aktuelle Saison bringen (neue Saison: alles zurück auf null)
function norm(u) {
  const out = {};
  if (u.pass_season !== SEASON.id) Object.assign(out, { pass_season: SEASON.id, pass_xp: 0, pass_prem: 0, pass_cf: '', pass_cp: '', pass_bank: 0 });
  return out;
}
function view(u) {
  const xp = Number(u.pass_xp) || 0, tier = tierOf(xp), cf = set(u.pass_cf), cp = set(u.pass_cp), prem = !!Number(u.pass_prem);
  const tiers = [];
  for (let t = 1; t <= TIERS; t++) tiers.push({ t, free: FREE[t], prem: PREM[t], reached: t <= tier, gotFree: cf.has(String(t)), gotPrem: cp.has(String(t)) });
  const wk = weekId(), base = String(u.pass_wk || '').startsWith(wk + '|') ? JSON.parse(String(u.pass_wk).slice(wk.length + 1)) : null;
  const done = set(u.pass_wdone);
  const tasks = WEEK_TASKS.map((w) => { const have = base ? Math.max(0, (Number(u[w.key]) || 0) - (base[w.key] || 0)) : 0; return { ...w, have: Math.min(w.goal, have), claimed: done.has(wk + ':' + w.id) }; });
  const claimable = tiers.filter((x) => x.reached && (!x.gotFree || (prem && !x.gotPrem))).length;
  return { season: SEASON, price: PREMIUM_PRICE, perTier: XP_PER_TIER, tiersN: TIERS, xp, tier, into: tier >= TIERS ? 0 : xp - tier * XP_PER_TIER, prem, tiers, bank: bankOf(xp), bankMax: BANK.max, bankGot: Number(u.pass_bank) || 0, tasks, weekEnds: weekId(Date.now() + 7 * 864e5), claimable, active: active() };
}
module.exports = { PREMIUM_PRICE, XP_PER_TIER, TIERS, BANK, SEASON, FREE, PREM, WEEK_TASKS, weekId, active, tierOf, bankOf, set, norm, view };
