// Kronen-Pass: Saison mit 30 Stufen. Links gratis für alle, rechts Premium für PREMIUM_PRICE Diamanten.
// Pass-XP kommen aus normaler Match-XP (ohne Herausforderungs-XP, ohne Casino). Wer später Premium kauft,
// kann alle schon erreichten Premium-Stufen sofort abholen. Nach Stufe 30 füllt sich der Bonus-Tresor (nur Premium).
const PREMIUM_PRICE = 15000;
let XP_PER_TIER = 4000; // im Admin-Menü einstellbar (Einstellung pass_per_tier)
const TIERS = 30;
const BANK = { dia: 500, max: 5000 }; // Tresor: pro Stufe Pass-XP nach Stufe 30 kommen 500 dazu, höchstens 5.000

const SEASON = {
  id: 's1', name: 'Geisternacht', nr: 1,
  start: '2026-09-23T00:00:00+02:00', end: '2026-10-31T23:59:59+01:00',
  banner: '/news/pass_s1.webp',
};

// Belohnungen: dia = Diamanten, pack = Booster, spin = Glücksrad-Drehs, xp = Level-XP, cxp = Casino-XP (VIP),
// box = Kürbis-Überraschung (wird beim Abholen ausgelost), item = Titel/Emblem/Rahmen (über unlocks)
const FREE = {
  1: { dia: 200 }, 2: { spin: 1 }, 3: { xp: 500, item: 'TH4', kind: 'title', name: 'Neonnacht' }, 4: { dia: 200 }, 5: { pack: 'gn' },
  6: { box: 'small' }, 7: { dia: 300 }, 8: { spin: 2 }, 9: { cxp: 1000 }, 10: { dia: 400, item: 'TH2', kind: 'title', name: 'Gruselfan' },
  11: { dia: 300 }, 12: { pack: 'gn' }, 13: { xp: 1000 }, 14: { box: 'small' }, 15: { pack: 'gn', spin: 1 },
  16: { dia: 400 }, 17: { spin: 2 }, 18: { cxp: 2000 }, 19: { dia: 400 }, 20: { pack: 'gn', item: 'EH3', kind: 'emblem', name: 'Mondfledermaus' },
  21: { box: 'small' }, 22: { dia: 500 }, 23: { xp: 1500 }, 24: { spin: 3 }, 25: { pack: 'gn', item: 'EH5', kind: 'emblem', name: 'Neonkatze' },
  26: { dia: 500 }, 27: { box: 'small' }, 28: { cxp: 3000 }, 29: { dia: 600 }, 30: { dia: 1000, item: 'EH1', kind: 'emblem', name: 'Kürbiskrone' },
};
const PREM = {
  1: { dia: 1000 }, 2: { pack: 'gn' }, 3: { spin: 3, item: 'TH5', kind: 'title', name: 'Seelenwächter' }, 4: { dia: 1000 }, 5: { dia: 500, item: 'EH4', kind: 'emblem', name: 'Hexenkessel' },
  6: { box: 'big' }, 7: { pack: 'gn' }, 8: { dia: 1000 }, 9: { cxp: 5000 }, 10: { dia: 2500, pack: 'gn' },
  11: { spin: 5 }, 12: { pack: 'gn', item: 'EH6', kind: 'emblem', name: 'Seelenlaterne' }, 13: { dia: 1000 }, 14: { xp: 2000 }, 15: { pack: 'gn', item: 'TH3', kind: 'title', name: 'Kürbiskopf' },
  16: { dia: 1000 }, 17: { box: 'big' }, 18: { pack: 'gn' }, 19: { dia: 1000 }, 20: { dia: 2500, item: 'fp1', kind: 'frame', name: 'Geisternacht' },
  21: { spin: 5 }, 22: { pack: 'gn' }, 23: { cxp: 10000, item: 'TH6', kind: 'title', name: 'Hexenzirkel' }, 24: { dia: 1000 }, 25: { box: 'big', pack: 'gn' },
  26: { pack: 'gn' }, 27: { dia: 1000, item: 'EH7', kind: 'emblem', name: 'Mitternachtshexe' }, 28: { xp: 3000 }, 29: { dia: 1000, spin: 5 },
  30: { dia: 5500, item: 'TH1', kind: 'title', name: 'Geisterfürst', item2: 'EH2', kind2: 'emblem', name2: 'Geisterkönig' },
};
// Casino-Strang: 20 Stufen, freigeschaltet durch Casino-XP, die in dieser Saison erspielt werden (bis 2,5 Mio für den letzten Titel)
const CAS_TIERS = 20;
const casNeed = (t) => Math.max(10000, Math.round(2500000 * Math.pow(t / CAS_TIERS, 1.8) / 5000) * 5000);
const CASINO = {
  1: { dia: 2000 }, 2: { pack: 'gn' }, 3: { dia: 2000, item: 'EC1', kind: 'emblem', name: 'Knochenwürfel' }, 4: { pack: 'gn' },
  5: { spin: 3, item: 'TC1', kind: 'title', name: 'Knochenzocker' }, 6: { dia: 5000 }, 7: { pack: 'gn' }, 8: { pack: 'gn', item: 'EC2', kind: 'emblem', name: 'Kürbis-Chip' },
  9: { dia: 7500 }, 10: { pack: 'gn', item: 'TC2', kind: 'title', name: 'Geistercroupier' }, 11: { box: 'big' }, 12: { pack: 'gn', spin: 5 },
  13: { dia: 10000, item: 'EC3', kind: 'emblem', name: 'Skelett-Automat' }, 14: { pack: 'gn' }, 15: { dia: 15000, item: 'TC3', kind: 'title', name: 'Kürbis-Jackpot' },
  16: { box: 'big' }, 17: { pack: 'gn' }, 18: { pack: 'gn', item: 'EC4', kind: 'emblem', name: 'Sensen-Jackpot' }, 19: { dia: 25000 },
  20: { pack: 'disp_gn', item: 'TC4', kind: 'title', name: 'Totenkopf-Highroller' },
};
// Kürbis-Überraschung: was drin ist, entscheidet sich beim Öffnen
const BOXES = {
  small: [[35, { dia: 500 }], [20, { dia: 1000 }], [8, { dia: 2000 }], [17, { spin: 2 }], [15, { pack: 'gn' }], [5, { pack: 'gn' }]],
  big: [[30, { dia: 2000 }], [15, { dia: 4000 }], [5, { dia: 8000 }], [15, { spin: 5 }], [15, { pack: 'gn' }], [15, { pack: 'gn' }], [5, { pack: 'gn', spin: 3 }]],
};
function openBox(kind) { const list = BOXES[kind] || BOXES.small, sum = list.reduce((a, x) => a + x[0], 0); let r = require('crypto').randomInt(sum); for (const [w, rw] of list) { if ((r -= w) < 0) return rw; } return list[0][1]; }

const WEEK_TASKS = [ // wöchentliche Aufgaben, Fortschritt = Zuwachs seit Wochenbeginn
  { id: 'w1', text: 'Spiele 25 Matches zu Ende', key: 'matches', goal: 25, xp: 2500 },
  { id: 'w2', text: 'Gewinne 8 Matches', key: 'wins', goal: 8, xp: 2500 },
  { id: 'w3', text: 'Lande 5 Punktlandungen', key: 'exact', goal: 5, xp: 3000 },
];
const weekId = (now = Date.now()) => { const dt = new Date(now + 2 * 3600e3); const day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day); return dt.toISOString().slice(0, 10); }; // Montag (dt. Zeit)

// Admin-Schalter: on = läuft, locked = sichtbar aber gesperrt (optional mit Freischaltzeit), off = komplett ausgeblendet
let MODE = 'locked', UNLOCK = 0; // Start: gesperrt, bis der Admin im Menü auf „An“ schaltet
const setMode = (m, at) => { MODE = ['on', 'locked', 'off'].includes(m) ? m : 'on'; UNLOCK = Number(at) || 0; return { mode: MODE, unlockAt: UNLOCK }; };
const state = (now = Date.now()) => (MODE === 'locked' && UNLOCK && now >= UNLOCK ? 'on' : MODE);
const active = (now = Date.now()) => state(now) === 'on' && now >= Date.parse(SEASON.start) && now <= Date.parse(SEASON.end);
const tierOf = (xp) => Math.min(TIERS, Math.floor((Number(xp) || 0) / XP_PER_TIER));
const bankOf = (xp) => { const over = Math.max(0, (Number(xp) || 0) - TIERS * XP_PER_TIER); return Math.min(BANK.max, Math.floor(over / XP_PER_TIER) * BANK.dia); };
const set = (s) => new Set(String(s || '').split(',').filter(Boolean));

// Nutzerstand in die aktuelle Saison bringen (neue Saison: alles zurück auf null)
function norm(u) {
  const out = {};
  if (u.pass_season !== SEASON.id) Object.assign(out, { pass_season: SEASON.id, pass_xp: 0, pass_prem: 0, pass_cf: '', pass_cp: '', pass_bank: 0, pass_cxp: u.pass_season ? 0 : Number(u.pass_cxp) || 0, pass_cc: '' }); // erster Besuch: schon gesammelte Casino-XP dieser Saison behalten
  return out;
}
function view(u) {
  const xp = Number(u.pass_xp) || 0, tier = tierOf(xp), cf = set(u.pass_cf), cp = set(u.pass_cp), prem = !!Number(u.pass_prem);
  const tiers = [];
  for (let t = 1; t <= TIERS; t++) tiers.push({ t, free: FREE[t], prem: PREM[t], reached: t <= tier, gotFree: cf.has(String(t)), gotPrem: cp.has(String(t)) });
  const wk = weekId(), pre = wk + '@' + EPOCH + '|', base = active() && String(u.pass_wk || '').startsWith(pre) ? JSON.parse(String(u.pass_wk).slice(pre.length)) : null;
  const done = set(u.pass_wdone);
  const tasks = WEEK_TASKS.map((w) => { const have = base ? Math.max(0, (Number(u[w.key]) || 0) - (base[w.key] || 0)) : 0; return { ...w, have: Math.min(w.goal, have), claimed: done.has(wk + '@' + EPOCH + ':' + w.id) }; });
  const claimable = tiers.filter((x) => x.reached && (!x.gotFree || (prem && !x.gotPrem))).length;
  const cxp = Number(u.pass_cxp) || 0, cc = set(u.pass_cc);
  const casino = { xp: cxp, max: casNeed(CAS_TIERS), tiers: Array.from({ length: CAS_TIERS }, (_, k) => ({ t: k + 1, need: casNeed(k + 1), rw: CASINO[k + 1], reached: cxp >= casNeed(k + 1), got: cc.has(String(k + 1)) })) };
  return { casino, season: SEASON, price: PREMIUM_PRICE, perTier: XP_PER_TIER, tiersN: TIERS, xp, tier, into: tier >= TIERS ? 0 : xp - tier * XP_PER_TIER, prem, tiers, bank: bankOf(xp), bankMax: BANK.max, bankGot: Number(u.pass_bank) || 0, tasks, weekEnds: weekId(Date.now() + 7 * 864e5), claimable, active: active(), mode: state(), unlockAt: UNLOCK };
}
let EPOCH = 0; // Zeitpunkt, ab dem der Pass läuft: Wochenaufgaben zählen erst ab dann
const setEpoch = (t) => { EPOCH = Number(t) || 0; return EPOCH; }; const epoch = () => EPOCH;
const setPerTier = (n) => { XP_PER_TIER = Math.max(500, Math.min(50000, Math.round(Number(n) || 4000))); return XP_PER_TIER; };
const perTier = () => XP_PER_TIER;
module.exports = { CASINO, CAS_TIERS, casNeed, setEpoch, epoch, setMode, state, unlockAt: () => UNLOCK, setPerTier, perTier, BOXES, openBox, PREMIUM_PRICE, XP_PER_TIER, TIERS, BANK, SEASON, FREE, PREM, WEEK_TASKS, weekId, active, tierOf, bankOf, set, norm, view };
