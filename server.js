const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const store = require('./lib/store');
const attachGame = require('./lib/game');
const ai = require('./lib/ai');
const progress = require('./lib/progress');
const cards = require('./lib/cards');
const frames = require('./lib/frames');
const push = require('./lib/push');
const tcg = require('./lib/tcg');
const casino = require('./lib/casino');
const daily = require('./lib/daily');
const vip = require('./lib/vip');
const hot = require('./lib/hottime');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_NAME = (process.env.ADMIN_NAME || '').trim().toLowerCase();
// Leerer INVITE_CODE bedeutet: Registrierung ohne Code
const INVITE_CODE = (process.env.INVITE_CODE || '').trim().toLowerCase();
if (!process.env.SECRET) console.warn('SECRET fehlt: Logins gelten nur bis zum nächsten Neustart.');
if (!INVITE_CODE) console.warn('INVITE_CODE ist leer: jeder kann sich ohne Code registrieren.');

// --- Passwort & Token ---
const hashPass = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const checkPass = (pw, stored) => { const [salt, h] = stored.split(':'); const a = Buffer.from(h, 'hex'); const b = crypto.scryptSync(pw, salt, 32); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const sign = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
const makeToken = (id) => { const body = id + '.' + (Date.now() + 90 * 864e5); return body + '.' + sign(body); };
function readToken(t) {
  const parts = String(t || '').split('.'); if (parts.length !== 3) return null;
  const body = parts[0] + '.' + parts[1];
  const a = Buffer.from(sign(body)), b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b) || Number(parts[1]) < Date.now()) return null;
  return Number(parts[0]);
}

// --- Einfache Bremse gegen Passwort-Raten ---
const hits = new Map();
function limited(ip) {
  const now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 10 * 60000);
  h.push(now); hits.set(ip, h); return h.length > 30;
}
setInterval(() => hits.clear(), 3600000).unref();

const TAG_COLORS = ['cyan', 'blau', 'rot', 'gruen', 'gelb', 'lila', 'orange', 'pink', 'weiss', 'rainbow'];
const RESERVED_TAGS = ['dev', 'admin', 'mod', 'staff', 'owner', 'system', 'claude', 'anthropic'];

const shownPrestige = (u) => { const pr = Math.max(0, Math.min(progress.MAX_PRESTIGE, Number(u.prestige) || 0)), ps = Number(u.pres_shown) || 0; return ps === -1 ? 0 : ps > 0 ? Math.min(ps, pr) : pr; };
const isAdmin = (u) => !!ADMIN_NAME && u.name.toLowerCase() === ADMIN_NAME;
const isMod = (u) => isAdmin(u) || u.role === 'coadmin';
const ROLES = ['', 'coadmin', 'supporter'];

const publicStats = (u) => ({
  id: u.id, name: u.name, diamonds: Number(u.diamonds) || 0,
  playMinutes: Number(u.play_minutes) || 0, pokerMinutes: Number(u.poker_minutes) || 0, casinoXp: Number(u.casino_xp) || 0, casinoTier: vip.tierIndex(Number(u.casino_xp) || 0), casinoRounds: Number(u.casino_rounds) || 0, casinoWins: Number(u.casino_wins) || 0, casinoBest: Number(u.casino_best) || 0, casinoNet: Number(u.casino_net) || 0, frame: u.frame || '', frameAnim: frames.animOf(u.frame), role: u.role || '', streak: u.streak || 0, lastSeen: Number(u.last_seen) || 0, presShown: shownPrestige(u), tag: u.tag || '', tagColor: u.tag_color || '', emblem: u.emblem || '', title: cards.titleById(u.title) ? { id: u.title === 'secret' ? 'tsecret' : u.title, text: cards.titleById(u.title).text, style: cards.titleById(u.title).style } : null, matches: u.matches, wins: u.wins, answered: u.answered, exact: u.exact, close: u.close,
  mcRight: u.mc_right, mcTotal: u.mc_total, points: u.points, rankPoints: u.rank_points, avgDev: u.dev_n ? u.dev_sum / u.dev_n : null,
  bestScore: u.best_score, bestStreak: u.best_streak, prestige: Number(u.prestige) || 0, av: Number(u.av) || 0, ...progress.levelInfo(u.xp),
});
const auth = async (req) => { const id = readToken((req.headers.authorization || '').replace('Bearer ', '')); return id ? store.userById(id) : null; };

const app = express();
app.set('trust proxy', 1);
const jsonSmall = express.json({ limit: '120kb' }), jsonBig = express.json({ limit: '2mb' }); // Tickets dürfen einen Screenshot mitbringen
app.use((req, res, next) => (req.path === '/api/tickets' ? jsonBig : jsonSmall)(req, res, next));
app.get('/healthz', (_, res) => res.send('ok'));
app.get('/api/push/key', (_, res) => res.json({ key: push.publicKey() }));
app.get('/api/config', (_, res) => res.json({ needCode: !!INVITE_CODE }));

app.post('/api/register', async (req, res) => {
  try {
    if (limited(req.ip)) return res.status(429).json({ error: 'Zu viele Versuche. Warte ein paar Minuten.' });
    const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
    const pw = String(req.body.password || '');
    if (INVITE_CODE && String(req.body.code || '').trim().toLowerCase() !== INVITE_CODE) return res.status(403).json({ error: 'Der Einladungscode stimmt nicht.' });
    if (!/^[\p{L}\p{N} _.-]{2,16}$/u.test(name)) return res.status(400).json({ error: 'Name: 2 bis 16 Zeichen, Buchstaben und Zahlen.' });
    if (pw.length < 6 || pw.length > 100) return res.status(400).json({ error: 'Passwort: mindestens 6 Zeichen.' });
    const u = await store.createUser(name, hashPass(pw));
    if (!u) return res.status(409).json({ error: 'Dieser Name ist schon vergeben.' });
    res.json({ token: makeToken(u.id), me: publicStats(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler bei der Registrierung.' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    if (limited(req.ip)) return res.status(429).json({ error: 'Zu viele Versuche. Warte ein paar Minuten.' });
    const u = await store.userByName(String(req.body.name || '').trim());
    if (!u || !checkPass(String(req.body.password || ''), u.pass)) return res.status(401).json({ error: 'Name oder Passwort stimmt nicht.' });
    res.json({ token: makeToken(u.id), me: publicStats(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler beim Anmelden.' }); }
});

const RARE = new Set(['holo', 'ultra', 'legend', 'ext', 'ghost']);
// Welche Titel, Embleme und Rahmen hängen an welcher Herausforderung? Einmal beim Start ermittelt
const CHALLENGE_REWARDS = (() => {
  const base = {}; for (const k of ['matches', 'wins', 'exact', 'close', 'answered', 'mc_right', 'mc_total', 'points', 'best_score', 'streak', 'best_streak', 'rank_points', 'prestige', 'casino_rounds', 'casino_wins', 'casino_best', 'casino_xp', 'cards_total', 'cards_rare', 'cards_ext', 'toon_distinct', 'packs_opened', 'melted', 'daily_streak', 'xp', 'poker_hands', 'poker_wins', 'poker_best', 'poker_allin_wins', 'poker_minutes', 'play_minutes']) base[k] = 0;
  const items = [...cards.EMBLEMS.map((i) => ['e', i]), ...cards.TITLES.map((i) => ['t', i]), ...frames.FRAMES.map((i) => ['f', i])].filter(([, i]) => i.cond && !i.secret && !i.dev && !i.event);
  const out = {};
  for (const c of progress.challengeView({})) out[c.key] = items.filter(([, i]) => { try { return !i.cond(base) && i.cond({ ...base, [c.key]: 1e12 }); } catch (e) { return false; } }).map(([k, i]) => k + ':' + i.id);
  return out;
})();
// Zu jedem Titel, Emblem und Rahmen: welche Kennzahl, welcher Zielwert? Per Suche aus der Bedingung ermittelt
const GOAL_KEYS = ['matches', 'wins', 'exact', 'close', 'answered', 'mc_right', 'mc_total', 'points', 'best_score', 'streak', 'best_streak', 'rank_points', 'prestige', 'casino_rounds', 'casino_wins', 'casino_best', 'casino_xp', 'cards_total', 'cards_rare', 'cards_ext', 'toon_distinct', 'packs_opened', 'melted', 'daily_streak', 'xp', 'poker_hands', 'poker_wins', 'poker_best', 'poker_allin_wins', 'poker_minutes', 'play_minutes'];
const ITEM_GOALS = (() => {
  const base = Object.fromEntries(GOAL_KEYS.map((k) => [k, 0]));
  const items = [...cards.EMBLEMS, ...cards.TITLES, ...frames.FRAMES].filter((i) => i.cond && !i.secret && !i.dev && !i.event);
  const out = {};
  for (const i of items) {
    const hits = GOAL_KEYS.filter((k) => { try { return !i.cond(base) && i.cond({ ...base, [k]: 1e12 }); } catch (e) { return false; } });
    if (hits.length !== 1) continue; // nur eindeutige Bedingungen
    const k = hits[0]; let lo = 0, hi = 1e12;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); let ok = false; try { ok = i.cond({ ...base, [k]: mid }); } catch (e) {} if (ok) hi = mid; else lo = mid; }
    out[i.id] = [k, hi];
  }
  return out;
})();
const DEV_IDS = new Set(tcg.view().cards.filter((c) => c.set === 'dev').map((c) => c.id));
const TOON_IDS = new Set(tcg.view().cards.filter((c) => c.set === 'toon').map((c) => c.id));
const TOP = new Set(['ext', 'ghost']);
async function cardStats(uid) {
  const rows = await store.cardsOf(uid).catch(() => []);
  let total = 0, rare = 0, ext = 0;
  const toon = new Set(), toonExt = new Set();
  for (const r of rows) {
    if (DEV_IDS.has(r.card_id)) continue; // Entwickler-Karten zählen für keine Herausforderung
    const n = Number(r.count) || 0;
    if (n > 0 && TOON_IDS.has(r.card_id)) { toon.add(r.card_id); if (r.variant === 'ext') toonExt.add(r.card_id); }
    total += n;
    if (RARE.has(r.variant)) rare += n;
    if (TOP.has(r.variant)) ext += n;
  }
  return { cards_total: total, cards_rare: rare, cards_ext: ext, toon_distinct: toon.size + toonExt.size }; // 30 Karten + 3 Extended Arts = 33
}

app.get('/api/home', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const withOnline = (x) => ({ ...publicStats(x), online: game.online.has(x.id) });
    const u2 = { ...u, ...(await cardStats(u.id)), _mod: isMod(u) };
    res.json({ tagColors: TAG_COLORS, me: { ...publicStats(u), frame: u.frame || '', emblem: u.emblem || '', title: u.title || '', titleShown: publicStats(u).title, admin: isAdmin(u), mod: isMod(u), gifts: await store.giftsOpen(u.id).catch(() => []), openTickets: (await store.tickets().catch(() => [])).filter((x) => x.status === 'eingereicht' || x.status === 'in Bearbeitung').map((x) => x.id), pokerOk: true, wheelLeft: vipView(u).spinsLeft, goals: ITEM_GOALS, stats: Object.fromEntries(GOAL_KEYS.map((k) => [k, Number(u2[k]) || 0])), hot: hot.view(), qsource: isMod(u) ? ((await store.setting('question_source')) || 'live') : undefined, firstBonus: u.first_game_day !== new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10) }, leaderboard: (await store.leaderboard()).map(withOnline), ai: ai.enabled(),
      world: (await store.worldRanking()).map(withOnline),
      points: (await store.pointsRanking()).map(withOnline),
      seen: String(u.seen_items || '').split(',').filter(Boolean),
      cards: cards.view(u2),
      frames: frames.view(u2, isMod(u)),
      casinoTop: (await store.casinoRanking().catch(() => [])).map(publicStats),
      progress: { maxLevel: progress.MAX_LEVEL, maxPrestige: progress.MAX_PRESTIGE, names: progress.PRESTIGE_NAMES, prestige: progress.prestigeStatus(u), challenges: progress.challengeView(u2).map((c) => ({ ...c, rewards: CHALLENGE_REWARDS[c.key] || [] })) } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Welches Prestige-Logo getragen wird, höchstens der erreichte Rang
app.post('/api/prestige-icon', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const n = Math.round(Number(req.body.n));
    if (!Number.isFinite(n) || n < -1 || n > u.prestige) return res.status(403).json({ error: 'Diesen Rang hast du noch nicht erreicht.' });
    await store.save(u.id, { pres_shown: n });
    res.json({ presShown: n === -1 ? 0 : n });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Push: Gerät anmelden oder abmelden
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const sub = req.body.sub;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Ungültige Anmeldung.' });
    await store.pushSave(u.id, sub);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    if (req.body.endpoint) await store.pushDrop(String(req.body.endpoint));
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Rundruf an alle Geräte, nur Admin und Co-Admins
app.post('/api/admin/broadcast', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    const title = String(req.body.title || 'PUNKTLANDUNG').slice(0, 60);
    const body = String(req.body.body || '').slice(0, 160);
    if (!body) return res.status(400).json({ error: 'Schreib eine Nachricht.' });
    const n = await push.toAll({ title, body, tag: 'news', url: '/' });
    res.json({ sent: n });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Freischaltungen als gesehen markieren
app.post('/api/seen', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const add = (Array.isArray(req.body.ids) ? req.body.ids : []).map(String).slice(0, 200);
    const list = new Set(String(u.seen_items || '').split(',').filter(Boolean));
    add.forEach((x) => list.add(x));
    await store.save(u.id, { seen_items: [...list].join(',') });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// ---------- Casino-VIP: Stufe, Cashback, Glücksrad, Tischdesign ----------
function vipView(u) {
  const xp = Number(u.casino_xp) || 0, ti = vip.tierIndex(xp), t = vip.TIERS[ti], nx = vip.TIERS[ti + 1] || null;
  const today = daily.dayKey(), yesterday = daily.dayKey(new Date(Date.now() - 86400000));
  // Verlust von gestern: entweder schon in cash_prev_* verschoben oder noch als laufender Tag gespeichert
  let prevNet = 0;
  if (u.casino_day === yesterday) prevNet = Number(u.casino_day_net) || 0;
  else if (u.cash_prev_day === yesterday) prevNet = Number(u.cash_prev_net) || 0;
  const cashback = t.cashback && prevNet < 0 && u.cash_claimed !== today ? Math.min(vip.CASHBACK_CAP, Math.round(-prevNet * t.cashback)) : 0;
  const used = u.wheel_day === today ? Number(u.wheel_used) || 0 : 0;
  return {
    xp, tier: ti, tiers: vip.TIERS, next: nx, cashback, cashbackPct: t.cashback, cashbackClaimed: u.cash_claimed === today,
    spinsLeft: Math.max(0, t.spins - used), spinsTotal: t.spins, wheel: vip.WHEEL.map((f) => f.label),
    themes: vip.THEMES.map((th) => ({ ...th, unlocked: ti >= th.tier })), theme: u.casino_theme || 'gruen',
  };
}
app.get('/api/casino/vip', async (req, res) => {
  try { const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' }); res.json(vipView(u)); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/casino/cashback', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const v = vipView(u);
    if (!v.cashback) return res.status(400).json({ error: v.cashbackClaimed ? 'Heute schon abgeholt.' : 'Heute gibt es kein Cashback.' });
    const after = (Number(u.diamonds) || 0) + v.cashback;
    await store.save(u.id, { diamonds: after, cash_claimed: daily.dayKey() });
    res.json({ gained: v.cashback, diamonds: after, vip: vipView(await store.userById(u.id)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/casino/wheel', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const v = vipView(u);
    if (!v.spinsLeft) return res.status(400).json({ error: 'Für heute hast du keine Drehung mehr. Morgen geht es weiter.' });
    const r = vip.spinWheel();
    const today = daily.dayKey();
    const save = { wheel_day: today, wheel_used: (u.wheel_day === today ? Number(u.wheel_used) || 0 : 0) + 1 };
    if (r.dia) save.diamonds = (Number(u.diamonds) || 0) + r.dia;
    await store.save(u.id, save);
    if (r.pack) await store.packAdd(u.id, r.pack, 1);
    const nu = await store.userById(u.id);
    res.json({ ...r, diamonds: Number(nu.diamonds) || 0, vip: vipView(nu) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/casino/theme', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const th = vip.THEMES.find((x) => x.key === String(req.body.theme || ''));
    if (!th) return res.status(400).json({ error: 'Dieses Design gibt es nicht.' });
    if (vip.tierIndex(Number(u.casino_xp) || 0) < th.tier) return res.status(403).json({ error: 'Dafür brauchst du die Stufe ' + vip.TIERS[th.tier].name + '.' });
    await store.save(u.id, { casino_theme: th.key });
    res.json(vipView(await store.userById(u.id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// ---------- News und Updates ----------
const NEWS = require('./lib/news');
app.get('/api/news', (req, res) => res.json({ posts: NEWS }));

// ---------- Tagesbelohnungen ----------
app.get('/api/daily', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    res.json(daily.view({ ...u, ...(await cardStats(u.id)) }));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/daily/claim', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const v = daily.view(u);
    if (v.claimed) return res.status(400).json({ error: 'Heute schon abgeholt. Komm morgen wieder.' });
    const t = daily.taskFor(v.day);
    let gain = v.loginDia;
    if (v.task.done) gain += t.dia;
    const save = {
      diamonds: (Number(u.diamonds) || 0) + gain,
      daily_day: v.today,
      daily_streak: v.day,
      daily_base: Number(u[t.stat]) || 0,
    };
    if (v.day >= 7) { // Woche voll: Titel freischalten und Serie neu starten
      const un = new Set(String(u.unlocks || '').split(',').filter(Boolean));
      un.add('TD7'); save.unlocks = [...un].join(',');
      save.daily_streak = 0;
    }
    await store.save(u.id, save);
    const reward = daily.DAYS[v.day - 1] || {};
    if (reward.pack) await store.packAdd(u.id, reward.pack, 1); // Booster des Tages
    res.json({ ok: true, gain, pack: reward.pack || null, weekDone: v.day >= 7, diamonds: save.diamonds, next: daily.view(await store.userById(u.id)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Einmalige Aktion: Glücksrad heute für alle wieder frei, damit jeder das neue Rad testen kann
setTimeout(async () => {
  try {
    const KEY = 'wheel_reset_2026_09_21';
    if (await store.setting(KEY)) return;
    const n = await store.resetWheel();
    await store.setting(KEY, '1');
    console.log('Glücksrad für alle zurückgesetzt:', n, 'Spieler');
  } catch (e) { console.error('Glücksrad-Reset:', e.message); }
}, 3000);

// Einmalig: paddy ist durch den behobenen Solo-Fehler knapp unter Level 30 gefallen, zurücksetzen
setTimeout(async () => {
  try {
    if (await store.setting('fix_paddy_lvl30')) return;
    await store.setting('fix_paddy_lvl30', '1');
    const u = (await store.searchUsers('paddy', 5)).find((x) => x.name.toLowerCase() === 'paddy');
    if (u && Number(u.xp) < progress.CAP && Number(u.xp) >= progress.CAP - 600) { await store.save(u.id, { xp: progress.CAP }); console.log('paddy: Level 30 wiederhergestellt, XP', u.xp, '->', progress.CAP); }
    else console.log('paddy: keine Korrektur nötig, XP', u && u.xp);
  } catch (e) { console.error('paddy-Korrektur:', e.message); }
}, 15000);

// Einmalig: Fragen, die vor den Gesehen-Listen schon gestellt wurden, gelten für alle bisherigen Spieler als gesehen
setTimeout(async () => {
  try {
    if (await store.setting('seen_backfill_v1')) return;
    const nkey = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
    const asked = new Set((await store.askedAll(100000)).map(nkey));
    const played = (await store.poolAll()).filter((q) => asked.has(nkey(q.q))).map((q) => q.id);
    const users = (await store.allUsers()).map((u) => u.id);
    const n = played.length && users.length ? await store.seenAddMany(users, played) : 0;
    await store.setting('seen_backfill_v1', '1');
    console.log(`Gesehen-Listen nachgetragen: ${played.length} schon gestellte Fragen für ${users.length} Spieler (${n} Einträge)`);
  } catch (e) { console.error('Nachtragen:', e.message); }
}, 12000);

// Einmalig nach dem Update: Pool auf 200 Fragen pro Kategorie befüllen (im Admin-Bereich anhaltbar)
setTimeout(async () => {
  try {
    if (await store.setting('pool_fill_started_v2')) return;
    await store.setting('pool_fill_started_v2', '1');
    game.qpool.setTarget(200); game.qpool.start();
  } catch (e) { console.error('Pool-Start:', e.message); }
}, 20000);

// Spielzeit: jede Minute für alle, die gerade online sind, eine Minute gutschreiben, am Pokertisch zusätzlich Pokerzeit
setInterval(async () => {
  try {
    const atPoker = new Set(poker.seatedIds());
    for (const id of [...game.online.keys()]) {
      if (game.isIdle(id) && !atPoker.has(id)) { checkProgress(id); continue; } // eingeschlafen: keine Spielzeit
      const u = await store.userById(id); if (!u) continue;
      const f = { play_minutes: (Number(u.play_minutes) || 0) + 1 };
      if (atPoker.has(id)) f.poker_minutes = (Number(u.poker_minutes) || 0) + 1;
      await store.save(id, f);
      checkProgress(id);
    }
  } catch (e) { console.error('Spielzeit:', e.message); }
}, 60 * 1000);

// Hot Time: um 19:59 Uhr deutscher Zeit alle per Push benachrichtigen
let lastHotPush = '';
setInterval(async () => {
  try {
    const b = hot.berlinNow();
    if (b.getHours() !== 19 || b.getMinutes() !== 59) return;
    const today = daily.dayKey();
    if (lastHotPush === today) return;
    lastHotPush = today;
    await push.toAll({ title: 'Hot Time 🔥', body: 'Jetzt Doppel XP bis 24 Uhr 🤩', tag: 'hottime', url: '/' });
    console.log('Hot-Time-Push verschickt');
  } catch (e) { console.error('Hot-Time-Push:', e.message); }
}, 20 * 1000);

// Erinnerung an die Tagesbelohnung, jeden Tag um 11 Uhr deutscher Zeit
let lastReminder = '';
setInterval(async () => {
  try {
    const now = new Date();
    const berlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    if (berlin.getHours() !== 11 || berlin.getMinutes() > 4) return;
    const today = daily.dayKey();
    if (lastReminder === today) return;
    lastReminder = today;
    const all = await store.allUsers().catch(() => []);
    let n = 0;
    for (const u of all) {
      if (u.daily_day === today) continue; // schon abgeholt
      await push.toUser(u.id, { title: '🎁 Deine Tagesbelohnung wartet', body: 'Hol dir heute deine Diamanten ab, bevor die Serie reißt.', tag: 'daily', url: '/' }).catch(() => {});
      n++;
    }
    console.log('Tages-Erinnerung verschickt an', n, 'Spieler');
  } catch (e) { console.error('Erinnerung:', e.message); }
}, 60 * 1000);

// ---------- Glücksspiel ----------
const MIN_BET = 50, MAX_BET = 250000; // Obergrenze pro Runde
const bjGames = new Map(); // userId -> laufendes Blackjack-Spiel
const takeBet = async (u, amount) => {
  const have = Number(u.diamonds) || 0;
  if (!Number.isFinite(amount) || amount < MIN_BET) return { error: `Mindestens ${MIN_BET} Diamanten.` };
  if (amount > MAX_BET) return { error: `Höchstens ${fmtInt(MAX_BET)} Diamanten pro Runde.` };
  if (have < amount) return { error: 'So viele Diamanten hast du nicht.' };
  await store.save(u.id, { diamonds: have - amount });
  return { ok: true, left: have - amount };
};
// Casino-Statistik: Runden, Gewinne, bester Gewinn, Bilanz und eigene XP
// ---------- Erfolge melden: neue Herausforderungsstufen und frisch freigeschaltete Stücke ----------
const progressSnap = new Map(); // userId -> { chal: {key: done}, items: Set }
async function checkProgress(uid) {
  try {
    const u = await store.userById(uid); if (!u) return;
    const u2 = { ...u, ...(await cardStats(uid)), _mod: isMod(u) };
    const chal = Object.fromEntries(progress.challengeView(u2).map((c) => [c.key, c.done]));
    const cv = cards.view(u2), fv = frames.view(u2, isMod(u));
    const items = new Map();
    for (const e of cv.emblems) if (e.unlocked && !e.dev) items.set('e:' + e.id, { kind: 'emblem', id: e.id, name: e.name, anim: e.anim });
    for (const t of cv.titles) if (t.unlocked && !t.dev) items.set('t:' + t.id, { kind: 'title', id: t.id, name: t.text, anim: t.anim });
    for (const f of fv) if (f.unlocked) items.set('f:' + f.id, { kind: 'frame', id: f.id, name: f.name, anim: f.anim });
    const prev = progressSnap.get(uid);
    progressSnap.set(uid, { chal, items: new Set(items.keys()) });
    if (!prev) return; // erster Blick: nur merken
    const news = [];
    for (const c of progress.challengeView(u2)) if (c.done > (prev.chal[c.key] || 0)) news.push({ kind: 'challenge', key: c.key, name: c.name, tier: c.done, total: c.total, xp: c.xps[c.done - 1] });
    for (const [k, it] of items) if (!prev.items.has(k)) news.push(it);
    if (news.length) io.sockets.sockets.forEach((so) => { if (so.data.user && so.data.user.id === uid) so.emit('progress:new', news); });
  } catch (e) { console.error('Erfolge:', e.message); }
}

const casinoStat = async (uid, stake, won, risk = stake) => {
  const u = await store.userById(uid); if (!u) return;
  const net = won - stake;
  const today = daily.dayKey();
  const dayMove = u.casino_day && u.casino_day !== today ? { cash_prev_day: u.casino_day, cash_prev_net: Number(u.casino_day_net) || 0 } : {};
  const dayNet = (u.casino_day === today ? Number(u.casino_day_net) || 0 : 0) + net;
  await store.save(uid, {
    ...dayMove, casino_day: today, casino_day_net: dayNet,
    casino_rounds: (Number(u.casino_rounds) || 0) + 1,
    casino_wins: (Number(u.casino_wins) || 0) + (won > stake ? 1 : 0),
    casino_best: Math.max(Number(u.casino_best) || 0, won),
    casino_net: (Number(u.casino_net) || 0) + net,
    casino_xp: (Number(u.casino_xp) || 0) + vip.xpFor(risk, won, stake) * (hot.active() ? 2 : 1),
  });
  setTimeout(() => checkProgress(uid), 400);
};
const payOut = async (uid, n) => {
  if (n <= 0) return null;
  const u = await store.userById(uid);
  if (u) await store.save(uid, { diamonds: (Number(u.diamonds) || 0) + Math.round(n) });
  return u ? Math.round((Number(u.diamonds) || 0) + Math.round(n)) : null;
};
const fmtInt = (n) => String(n);

app.post('/api/casino/roulette', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const amount = Math.round(Number(req.body.amount) || 0);
    const kind = String(req.body.kind || '');
    const number = Math.round(Number(req.body.number) || 0);
    if (kind === 'zahl' && (number < 0 || number > 36)) return res.status(400).json({ error: 'Zahl zwischen 0 und 36.' });
    if (kind !== 'zahl' && !casino.BETS[kind]) return res.status(400).json({ error: 'Unbekannter Einsatz.' });
    const t = await takeBet(u, amount); if (t.error) return res.status(400).json({ error: t.error });
    const r = casino.spin(kind, number);
    const won = Math.round(amount * r.pay);
    const after = won ? await payOut(u.id, won) : t.left;
    await casinoStat(u.id, amount, won);
    res.json({ ...r, amount, won, diamonds: after });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Roulette-Tableau: mehrere Einsätze auf einmal
const rHistory = new Map(); // userId -> letzte Zahlen
app.post('/api/casino/board', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const bets = (Array.isArray(req.body.bets) ? req.body.bets : []).slice(0, 60).map((b) => ({ numbers: b.numbers, amount: Math.round(Number(b.amount) || 0) }));
    if (!bets.length) return res.status(400).json({ error: 'Setz zuerst einen Chip.' });
    const total = bets.reduce((x, b) => x + b.amount, 0);
    if (total > MAX_BET) return res.status(400).json({ error: 'Höchstens 250.000 Diamanten pro Runde.' });
    const have = Number(u.diamonds) || 0;
    if (have < total) return res.status(400).json({ error: 'So viele Diamanten hast du nicht.' });
    const r = casino.spinBoard(bets);
    if (r.error) return res.status(400).json({ error: r.error });
    const after = have - r.stake + r.won;
    await store.save(u.id, { diamonds: after });
    const pays = Array.from({ length: 37 }, (_, n) => bets.reduce((x, b) => x + (b.numbers.includes(n) ? Math.round(b.amount * 36 / b.numbers.length) : 0), 0)).sort((a, b) => a - b);
    const risk = Math.max(0, r.stake - pays[18]); // Median der 37 möglichen Ergebnisse
    await casinoStat(u.id, r.stake, r.won, risk);
    const h = [r.n, ...(rHistory.get(u.id) || [])].slice(0, 14); rHistory.set(u.id, h);
    res.json({ ...r, diamonds: after, history: h });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Blackjack mit vollen Regeln: Teilen, Verdoppeln, Versicherung, Aufgeben
const BJ = casino.bj;
const bjSend = async (res, uid, g, left) => {
  const v = BJ.view(g);
  if (g.over) {
    bjGames.delete(uid);
    const after = g.payout ? await payOut(uid, g.payout) : Number((await store.userById(uid)).diamonds) || 0;
    await casinoStat(uid, g.staked, g.payout);
    return res.json({ ...v, won: g.payout, diamonds: after });
  }
  res.json({ ...v, diamonds: left != null ? left : Number((await store.userById(uid)).diamonds) || 0 });
};
app.post('/api/casino/bj/deal', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    if (bjGames.has(u.id)) return bjSend(res, u.id, bjGames.get(u.id)); // offene Runde weiterführen
    const amount = Math.round(Number(req.body.amount) || 0);
    const t = await takeBet(u, amount); if (t.error) return res.status(400).json({ error: t.error });
    const g = BJ.newRound(amount);
    bjGames.set(u.id, g);
    if (BJ.isBJ(g.hands[0].cards) || (BJ.isBJ(g.dealer) && g.dealer[0].r !== 'A')) BJ.finish(g);
    await bjSend(res, u.id, g, t.left);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/casino/bj/act', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const g = bjGames.get(u.id); if (!g) return res.status(400).json({ error: 'Keine offene Runde.' });
    const a = String(req.body.action || '');
    // Zusatzeinsatz vorab prüfen
    const needs = { double: () => g.hands[g.active].bet, split: () => g.hands[g.active].bet, insurance: () => Math.floor(g.amount / 2) };
    if (needs[a]) {
      const cur = await store.userById(u.id);
      if ((Number(cur.diamonds) || 0) < needs[a]()) return res.status(400).json({ error: 'Dafür reichen deine Diamanten nicht.' });
    }
    const r = BJ.act(g, a);
    if (r.error) return res.status(400).json({ error: r.error });
    let left = null;
    if (r.extra) { const cur = await store.userById(u.id); left = (Number(cur.diamonds) || 0) - r.extra; await store.save(u.id, { diamonds: left }); }
    // Nach der Versicherungsfrage: Hat die Bank Blackjack, ist die Runde vorbei
    if ((a === 'insurance' || a === 'noinsurance') && BJ.isBJ(g.dealer)) BJ.finish(g);
    await bjSend(res, u.id, g, left);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// ---------- Sammelkarten ----------
const tcgState = async (u) => ({
  diamonds: Number(u.diamonds) || 0,
  cards: await store.cardsOf(u.id),
  packs: await store.packsOf(u.id),
  def: { ...tcg.view(), melt: MELT },
});
app.get('/api/tcg', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    res.json(await tcgState(u));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Booster kaufen
app.post('/api/tcg/buy', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const p = tcg.PACKS[String(req.body.pack || '')];
    const n = Math.max(1, Math.min(9999, Math.round(Number(req.body.n) || 1))); // kein festes Limit mehr, begrenzt nur durch die Diamanten
    if (!p) return res.status(400).json({ error: 'Unbekannter Booster.' });
    if (p.hidden) return res.status(403).json({ error: 'Diesen Booster gibt es nicht im Shop.' });
    if (p.locked && !isMod(u)) return res.status(403).json({ error: 'Dieser Booster ist noch gesperrt. Bald geht es los!' });
    const cost = p.price * n, have = Number(u.diamonds) || 0;
    if (have < cost) return res.status(400).json({ error: 'Du hast nicht genug Diamanten.' });
    await store.save(u.id, { diamonds: have - cost });
    await store.packAdd(u.id, p.id, n);
    res.json(await tcgState(await store.userById(u.id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Booster öffnen
app.post('/api/tcg/open', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const pid = String(req.body.pack || '');
    if (!tcg.PACKS[pid]) return res.status(400).json({ error: 'Unbekannter Booster.' });
    const mine = (await store.packsOf(u.id)).find((x) => x.pack_id === pid);
    if (!mine || mine.count < 1) return res.status(400).json({ error: 'Du hast diesen Booster nicht.' });
    await store.packAdd(u.id, pid, -1);
    const pulled = tcg.openPack(pid);
    for (const c of pulled) await store.cardAdd(u.id, c.id, c.variant, 1);
    await store.save(u.id, { packs_opened: (Number(u.packs_opened) || 0) + 1 });
    setTimeout(() => checkProgress(u.id), 300);
    res.json({ pulled, state: await tcgState(await store.userById(u.id)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Doppelte Karten umwandeln
const MELT = { haeufig: 40, selten: 90, holo: 160, legend: 260, ultra: 420, ext: 900, ghost: 1500, mythic: 2500 };
app.post('/api/tcg/melt', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 60) : [];
    let sum = 0, n = 0;
    for (const it of items) {
      const cid = String(it.card || ''), v = String(it.variant || '');
      const want = Math.max(0, Math.round(Number(it.n) || 0));
      if (!tcg.has(cid, v) || !want) continue;
      const have = await store.cardCount(u.id, cid, v);
      const take = Math.min(want, Math.max(0, have - 1)); // die letzte Karte bleibt immer erhalten
      if (take <= 0) continue;
      await store.cardAdd(u.id, cid, v, -take);
      sum += (MELT[v] || 40) * take; n += take;
    }
    if (!n) return res.status(400).json({ error: 'Nichts zum Umwandeln. Die letzte Karte einer Art bleibt immer erhalten.' });
    const cur = await store.userById(u.id);
    await store.save(u.id, { diamonds: (Number(cur.diamonds) || 0) + sum, melted: (Number(cur.melted) || 0) + n });
    res.json({ ...(await tcgState(await store.userById(u.id))), melted: n, gained: sum });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Börse
app.get('/api/tcg/market', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const rows = await store.marketList();
    const out = [];
    for (const r of rows) {
      const s = await store.userById(r.seller);
      out.push({ id: r.id, cardId: r.card_id, variant: r.variant, price: Number(r.price), seller: s ? s.name : '?', sellerId: r.seller, mine: r.seller === u.id });
    }
    res.json({ listings: out, diamonds: Number(u.diamonds) || 0 });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/tcg/sell', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const cid = String(req.body.card || ''), v = String(req.body.variant || '');
    const price = Math.max(10, Math.min(1000000, Math.round(Number(req.body.price) || 0)));
    if (!tcg.has(cid, v)) return res.status(400).json({ error: 'Diese Karte gibt es nicht.' });
    if (await store.cardCount(u.id, cid, v) < 1) return res.status(400).json({ error: 'Du besitzt diese Karte nicht.' });
    await store.cardAdd(u.id, cid, v, -1);
    await store.marketAdd({ seller: u.id, card_id: cid, variant: v, price });
    res.json(await tcgState(await store.userById(u.id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
// Preisübersicht für eine Karte oder einen Booster: Händlerwert, bisherige Verkäufe, aktive Angebote
app.get('/api/tcg/price', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const cid = String(req.query.card || ''), v = String(req.query.variant || '');
    const sales = (await store.tradesFor(cid, v)).sort((a, b) => a.created - b.created);
    const listings = (await store.marketList()).filter((m) => m.card_id === cid && m.variant === v).map((m) => ({ id: m.id, price: Number(m.price), mine: m.seller === u.id })).sort((a, b) => a.price - b.price);
    const avg = sales.length ? Math.round(sales.reduce((x, s) => x + s.price, 0) / sales.length) : null;
    res.json({ melt: cid === 'pack' ? null : (MELT[v] || 0), sales: sales.map((s) => ({ price: s.price, at: s.created })), avg, last: sales.length ? sales[sales.length - 1].price : null, low: listings.length ? listings[0].price : null, listings });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/tcg/sellpack', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const pid = String(req.body.pack || ''), price = Math.max(10, Math.min(1000000, Math.round(Number(req.body.price) || 0)));
    if (!tcg.PACKS[pid]) return res.status(400).json({ error: 'Diesen Booster gibt es nicht.' });
    const own = (await store.packsOf(u.id)).find((x) => x.pack_id === pid);
    if (!own || own.count < 1) return res.status(400).json({ error: 'Du hast diesen Booster nicht.' });
    await store.packAdd(u.id, pid, -1);
    await store.marketAdd({ seller: u.id, card_id: 'pack', variant: pid, price });
    res.json(await tcgState(await store.userById(u.id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/tcg/cancel', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const row = await store.marketGet(req.body.id);
    if (!row || row.seller !== u.id) return res.status(403).json({ error: 'Das ist nicht dein Angebot.' });
    await store.marketDrop(row.id);
    if (row.card_id === 'pack') await store.packAdd(u.id, row.variant, 1); else await store.cardAdd(u.id, row.card_id, row.variant, 1);
    res.json(await tcgState(await store.userById(u.id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
// ---------- Sammler-Rangliste: jede Karte in jeder Fassung zählt einmal ----------
const COLLECT_PTS = { haeufig: 1, selten: 2, holo: 3, ultra: 5, legend: 8, ext: 12, ghost: 15 };
const COLLECT = (() => {
  const v = tcg.view(); const all = [];
  for (const c of v.cards) if (c.set !== 'dev') for (const va of (v.variants[c.id] || [c.base])) all.push({ id: c.id, variant: va }); // Entwickler-Karten zählen nicht
  const group = (va) => (va === 'ext' ? 'ext' : va === 'ghost' ? 'ghost' : 'normal');
  const totals = { normal: 0, ext: 0, ghost: 0 }; let maxPts = 0;
  for (const e of all) { totals[group(e.variant)]++; maxPts += COLLECT_PTS[e.variant] || 1; }
  return { keys: new Set(all.map((e) => e.id + ':' + e.variant)), total: all.length, totals, maxPts, group };
})();
let collectCache = { at: 0, data: null };
app.get('/api/ranks/cards', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    if (!collectCache.data || Date.now() - collectCache.at > 60000) { // höchstens einmal pro Minute neu rechnen
      const users = await store.searchUsers('', 500).catch(() => []);
      const rows = [];
      for (const x of users) {
        const cs = await store.cardsOf(x.id).catch(() => []);
        const have = { normal: 0, ext: 0, ghost: 0 }; let pts = 0; const seen = new Set();
        for (const r of cs) { const k = r.card_id + ':' + r.variant; if ((Number(r.count) || 0) > 0 && COLLECT.keys.has(k) && !seen.has(k)) { seen.add(k); have[COLLECT.group(r.variant)]++; pts += COLLECT_PTS[r.variant] || 1; } }
        if (seen.size) rows.push({ ...publicStats(x), have, unique: seen.size, pts });
      }
      rows.sort((a, b) => b.pts - a.pts || b.unique - a.unique);
      collectCache = { at: Date.now(), data: rows };
    }
    res.json({ rows: collectCache.data, total: COLLECT.total, totals: COLLECT.totals, maxPts: COLLECT.maxPts, points: COLLECT_PTS, names: tcg.view().names });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.get('/api/tcg/history', async (req, res) => {
  try { const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' }); res.json({ trades: await store.trades(60) }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// ---------- Geschenke (Dankeschön für Support-Meldungen und vom Entwickler-Team) ----------
app.post('/api/admin/gift', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    if (!isAdmin(u)) return res.status(403).json({ error: 'Nur der Admin verteilt Geschenke.' });
    const dia = Math.max(0, Math.min(1000000, Math.round(Number(req.body.diamonds) || 0)));
    const pack = tcg.PACKS[req.body.pack] ? req.body.pack : null, n = pack ? Math.max(1, Math.min(100, Math.round(Number(req.body.n) || 1))) : 0;
    const times = Math.max(1, Math.min(20, Math.round(Number(req.body.times) || 1))); // wie oft das Geschenk verschickt wird
    const msg = String(req.body.message || '').trim().slice(0, 200);
    if (!dia && !pack) return res.status(400).json({ error: 'Bitte Diamanten oder einen Booster auswählen.' });
    const ids = req.body.all ? (await store.searchUsers('', 500)).map((x) => x.id).filter((id) => id !== u.id) : [Number(req.body.id)];
    let sent = 0;
    for (const id of ids) {
      const t = await store.userById(id); if (!t) continue;
      for (let k = 0; k < times; k++) await store.giftAdd({ user_id: t.id, diamonds: dia, pack, n, reason: '', source: 'dev', message: msg });
      push.toUser(t.id, { title: '🎁 Geschenk vom Entwickler-Team', body: msg || 'Auf deiner Startseite wartet ein Geschenk auf dich.', tag: 'gift', url: '/' }).catch(() => {});
      io.sockets.sockets.forEach((so) => { if (so.data.user && so.data.user.id === t.id) so.emit('gift:new'); });
      sent++;
    }
    console.log(`Admin-Geschenk: ${times}× (${dia} 💎${pack ? `, ${n}× ${pack}` : ''}) an ${sent} Spieler`);
    res.json({ ok: true, sent, times });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/gifts/:id/claim', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const g = await store.giftClaim(req.params.id, u.id); if (!g) return res.status(400).json({ error: 'Dieses Geschenk gibt es nicht mehr.' });
    let dia = Number(u.diamonds) || 0;
    if (g.diamonds) { dia += Number(g.diamonds); await store.save(u.id, { diamonds: dia }); }
    if (g.pack && g.n) await store.packAdd(u.id, g.pack, Number(g.n));
    res.json({ ok: true, diamonds: Number(g.diamonds) || 0, pack: g.pack, packName: g.pack ? tcg.PACKS[g.pack].name : '', n: Number(g.n) || 0, reason: g.reason, source: g.source || 'support', message: g.message || '', total: dia });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// ---------- Support-Tickets ----------
const TICKET_CATS = ['Fehler', 'Account', 'Wunsch'], TICKET_STATES = ['eingereicht', 'in Bearbeitung', 'abgeschlossen', 'abgelehnt'];
app.get('/api/tickets', async (req, res) => {
  try { const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' }); res.json({ tickets: await store.tickets(), canManage: isMod(u) }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.get('/api/tickets/:id/image', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).end();
    const t = await store.ticketGet(req.params.id); if (!t || !t.image) return res.status(404).end();
    const m = String(t.image).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/); if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]); res.set('Cache-Control', 'private, max-age=86400'); res.send(Buffer.from(m[2], 'base64'));
  } catch (e) { console.error(e); res.status(500).end(); }
});
app.post('/api/tickets', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const category = TICKET_CATS.includes(req.body.category) ? req.body.category : 'Fehler';
    const title = String(req.body.title || '').trim().slice(0, 80), text = String(req.body.text || '').trim().slice(0, 2000);
    if (title.length < 3) return res.status(400).json({ error: 'Bitte gib einen kurzen Titel an.' });
    let image = null;
    if (req.body.image) { image = String(req.body.image); if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 1400000) return res.status(400).json({ error: 'Das Bild ist zu groß oder kein Bild.' }); }
    const t = await store.ticketAdd({ user_id: u.id, user_name: u.name, category, title, text, image });
    // Admin und Co-Admins bekommen Bescheid
    for (const x of await store.searchUsers('', 200).catch(() => [])) if (isAdmin(x) && x.id !== u.id) push.toUser(x.id, { title: '🎫 Neues Ticket', body: `${u.name}: ${title}`, tag: 'ticket', url: '/' }).catch(() => {}); // nur der Admin bekommt Bescheid
    res.json({ ok: true, id: t.id, tickets: await store.tickets(), canManage: isMod(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/tickets/:id/status', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    if (!isMod(u)) return res.status(403).json({ error: 'Nur das Entwicklerteam kann Tickets bearbeiten.' });
    const status = String(req.body.status || '');
    if (!TICKET_STATES.includes(status)) return res.status(400).json({ error: 'Unbekannter Status.' });
    const reply = String(req.body.reply || '').trim().slice(0, 1000);
    if ((status === 'abgeschlossen' || status === 'abgelehnt') && reply.length < 3) return res.status(400).json({ error: 'Bitte schreib kurz dazu, was erledigt wurde oder warum abgelehnt.' });
    const t = await store.ticketStatus(req.params.id, status, u.name, reply || null);
    if (!t) return res.status(404).json({ error: 'Dieses Ticket gibt es nicht.' });
    // Dankeschön als Geschenk: nur der Admin, nur beim Abschließen
    const rw = req.body.reward || {};
    const gDia = Math.max(0, Math.min(100000, Math.round(Number(rw.diamonds) || 0)));
    const gPack = tcg.PACKS[rw.pack] ? rw.pack : null, gN = gPack ? Math.max(1, Math.min(10, Math.round(Number(rw.n) || 1))) : 0;
    let gift = null;
    if (status === 'abgeschlossen' && isAdmin(u) && t.user_id !== u.id && (gDia || gPack)) gift = await store.giftAdd({ user_id: t.user_id, diamonds: gDia, pack: gPack, n: gN, reason: t.title });
    if (t.user_id !== u.id) {
      const thanks = status === 'abgeschlossen' ? `Dein Ticket „${t.title}“ wurde abgeschlossen. Vielen Dank für deine Meldung!${gift ? ' 🎁 Als Dankeschön wartet ein Geschenk auf dich.' : ''}` : `„${t.title}“ ist jetzt: ${status}${reply ? ' · ' + reply.slice(0, 80) : ''}`;
      push.toUser(t.user_id, { title: status === 'abgeschlossen' ? '🎫 Danke für deine Meldung!' : '🎫 Dein Ticket', body: thanks, tag: 'ticket', url: '/' }).catch(() => {});
      io.sockets.sockets.forEach((so) => { if (so.data.user && so.data.user.id === t.user_id) so.emit('gift:new'); });
    }
    res.json({ tickets: await store.tickets(), canManage: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/tcg/market/buy', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const row = await store.marketGet(req.body.id);
    if (!row) return res.status(404).json({ error: 'Dieses Angebot gibt es nicht mehr.' });
    if (row.seller === u.id) return res.status(400).json({ error: 'Das ist dein eigenes Angebot.' });
    const have = Number(u.diamonds) || 0, price = Number(row.price);
    if (have < price) return res.status(400).json({ error: 'Du hast nicht genug Diamanten.' });
    const seller = await store.userById(row.seller);
    await store.marketDrop(row.id);
    await store.save(u.id, { diamonds: have - price });
    if (seller) await store.save(seller.id, { diamonds: (Number(seller.diamonds) || 0) + price });
    const isPack = row.card_id === 'pack';
    if (isPack) await store.packAdd(u.id, row.variant, 1); else await store.cardAdd(u.id, row.card_id, row.variant, 1);
    const cdef = isPack ? { name: (tcg.PACKS[row.variant] || {}).name || 'Booster' } : tcg.view().cards.find((c) => c.id === row.card_id), vname = isPack ? 'Booster' : tcg.view().names[row.variant] || row.variant;
    await store.tradeLog({ seller: row.seller, seller_name: seller ? seller.name : '?', buyer: u.id, buyer_name: u.name, card_id: row.card_id, variant: row.variant, price }).catch((e) => console.error('Verlauf:', e.message));
    push.toUser(row.seller, { title: isPack ? '💎 Booster verkauft' : '💎 Karte verkauft', body: isPack ? `Dein ${cdef.name} wurde für ${price.toLocaleString('de-DE')} 💎 an ${u.name} verkauft.` : `Deine Karte „${cdef ? cdef.name : row.card_id}“ (${vname}) wurde für ${price.toLocaleString('de-DE')} 💎 an ${u.name} verkauft.`, tag: 'market', url: '/' }).catch(() => {});
    res.json(await tcgState(await store.userById(u.id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Tausch: Angebot, Annahme, Ablehnung
const trades = new Map(); let tradeId = 0;
app.post('/api/tcg/trade', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const to = await store.userById(Number(req.body.to));
    const give = req.body.give || {}, want = req.body.want || {};
    if (!to || to.id === u.id) return res.status(400).json({ error: 'Wähle einen anderen Spieler.' });
    if (!tcg.has(give.card, give.variant) || !tcg.has(want.card, want.variant)) return res.status(400).json({ error: 'Karte unbekannt.' });
    if (await store.cardCount(u.id, give.card, give.variant) < 1) return res.status(400).json({ error: 'Du besitzt diese Karte nicht.' });
    const id = ++tradeId;
    trades.set(id, { id, from: u.id, fromName: u.name, to: to.id, give, want, t: Date.now() });
    push.toUser(to.id, { title: '🔄 Tauschangebot', body: `${u.name} bietet dir einen Tausch an.`, tag: 'trade', url: '/' }).catch(() => {});
    res.json({ ok: true, id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.get('/api/tcg/trades', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    res.json({ incoming: [...trades.values()].filter((t) => t.to === u.id), outgoing: [...trades.values()].filter((t) => t.from === u.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/tcg/trade/:act', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const t = trades.get(Number(req.body.id));
    if (!t || t.to !== u.id) return res.status(404).json({ error: 'Dieses Angebot gibt es nicht.' });
    if (req.params.act === 'decline') { trades.delete(t.id); return res.json({ ok: true }); }
    if (await store.cardCount(u.id, t.want.card, t.want.variant) < 1) return res.status(400).json({ error: 'Du besitzt die gewünschte Karte nicht.' });
    if (await store.cardCount(t.from, t.give.card, t.give.variant) < 1) { trades.delete(t.id); return res.status(400).json({ error: 'Der andere besitzt seine Karte nicht mehr.' }); }
    await store.cardAdd(u.id, t.want.card, t.want.variant, -1);
    await store.cardAdd(t.from, t.give.card, t.give.variant, -1);
    await store.cardAdd(u.id, t.give.card, t.give.variant, 1);
    await store.cardAdd(t.from, t.want.card, t.want.variant, 1);
    trades.delete(t.id);
    push.toUser(t.from, { title: '🔄 Tausch angenommen', body: `${u.name} hat den Tausch angenommen.`, tag: 'trade', url: '/' }).catch(() => {});
    res.json(await tcgState(await store.userById(u.id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Admin: Diamanten setzen
app.post('/api/admin/diamonds', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    const t = await store.userById(Number(req.body.id)); if (!t) return res.status(404).json({ error: 'Diesen Spieler gibt es nicht.' });
    const v = Math.max(0, Math.round(Number(req.body.diamonds)));
    if (!Number.isFinite(v)) return res.status(400).json({ error: 'Zahl fehlt.' });
    await store.save(t.id, { diamonds: v });
    res.json({ ok: true, diamonds: v });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Profilrahmen wählen
app.post('/api/frame', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const id = String(req.body.frame || '');
    const uf = { ...u, ...(await cardStats(u.id)) };
    if (!frames.canUse(uf, id, isMod(u))) return res.status(403).json({ error: 'Diesen Rahmen hast du noch nicht.' });
    await store.save(u.id, { frame: id });
    res.json({ frame: id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Spielerkarte: Emblem und Titel wählen
app.post('/api/card', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const emblem = String(req.body.emblem || ''), title = String(req.body.title || '');
    const uc = { ...u, ...(await cardStats(u.id)), _mod: isMod(u) };
    if (!cards.canUse(uc, emblem, title)) return res.status(403).json({ error: 'Das hast du noch nicht freigeschaltet.' });
    await store.save(u.id, { emblem, title });
    res.json({ emblem, title });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Code einlösen
app.post('/api/redeem', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const r = cards.redeem(u, req.body.code);
    if (!r.ok) return res.status(400).json({ error: r.error });
    const save = { codes: r.codes };
    if (r.diamonds) save.diamonds = (Number(u.diamonds) || 0) + r.diamonds; // Aktionscode mit Diamanten
    await store.save(u.id, save);
    // Alles, was dieser Code freischaltet, für die große Einblendung
    const code = String(req.body.code || '').trim().toUpperCase();
    const items = {
      emblems: cards.EMBLEMS.filter((i) => i.code === code).map((i) => ({ id: i.id === 'secret' ? 'secret' : i.id, name: i.name, anim: i.anim || '' })),
      titles: cards.TITLES.filter((i) => i.code === code).map((i) => ({ id: i.id === 'secret' ? 'tsecret' : i.id, text: i.text, anim: i.anim || '' })),
      frames: frames.FRAMES.filter((f) => f.code === code).map((f) => ({ id: f.id, name: f.name, anim: f.anim || '' })),
    };
    res.json({ reward: r.reward, diamonds: r.diamonds || 0, code, items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Clan-Tag setzen. „DEV“ und Regenbogen sind dem Admin vorbehalten.
app.post('/api/tag', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const mod = isMod(u);
    const tag = String(req.body.tag || '').trim().toUpperCase();
    const color = String(req.body.color || '').trim().toLowerCase();
    if (tag && !/^[A-Z0-9ÄÖÜ]{2,5}$/.test(tag)) return res.status(400).json({ error: 'Clan-Tag: 2 bis 5 Buchstaben oder Zahlen.' });
    if (tag && !isAdmin(u) && RESERVED_TAGS.includes(tag.toLowerCase())) return res.status(403).json({ error: 'Dieser Tag ist reserviert.' });
    if (color && !TAG_COLORS.includes(color)) return res.status(400).json({ error: 'Unbekannte Farbe.' });
    if (color === 'rainbow' && !mod) return res.status(403).json({ error: 'Regenbogen ist reserviert.' });
    await store.save(u.id, { tag, tag_color: tag ? color || 'cyan' : '' });
    res.json({ tag, color: tag ? color || 'cyan' : '' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Freunde
app.get('/api/friends', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const out = [];
    for (const f of await store.friendList(u.id)) {
      const o = await store.userById(f.id); if (!o) continue;
      const m = game.matches.get(game.userMatch.get(o.id));
      out.push({ ...publicStats(o), status: f.status, online: game.online.has(o.id), act: game.online.has(o.id) ? game.activityOf(o.id) : '', idle: game.isIdle(o.id), playing: !!m && m.phase !== 'lobby' && m.phase !== 'finished', watchCode: m && m.phase !== 'lobby' && m.phase !== 'finished' ? m.code : '',
        joinCode: f.status === 'ok' && m && !m.setup && (m.phase === 'lobby' || m.phase === 'countdown') && m.players.size < 8 ? m.code : null });
    }
    res.json({ friends: out });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/friends/:act', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const o = req.body.id ? await store.userById(Number(req.body.id)) : await store.userByName(String(req.body.name || '').trim());
    if (!o) return res.status(404).json({ error: 'Diesen Spieler gibt es nicht.' });
    if (o.id === u.id) return res.status(400).json({ error: 'Das bist du selbst.' });
    if (req.params.act === 'add') return res.json({ status: await store.friendAdd(u.id, o.id), name: o.name });
    if (req.params.act === 'accept' || req.params.act === 'decline') { await store.friendRespond(u.id, o.id, req.params.act === 'accept'); return res.json({ ok: true }); }
    if (req.params.act === 'remove') { await store.friendRemove(u.id, o.id); return res.json({ ok: true }); }
    res.status(404).json({ error: 'Unbekannte Aktion.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.get('/api/user/:id', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const o = await store.userById(Number(req.params.id)); if (!o) return res.status(404).json({ error: 'Diesen Spieler gibt es nicht.' });
    const m2 = game.matches.get(game.userMatch.get(o.id));
    const rel = (await store.friendList(u.id)).find((f) => f.id === o.id);
    res.json({ user: { ...publicStats(o), online: game.online.has(o.id), act: game.online.has(o.id) ? game.activityOf(o.id) : '', playing: !!m2 && !['lobby', 'finished'].includes(m2.phase),
      self: o.id === u.id, friend: rel ? rel.status : null } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Neu registrierte Spieler, zum Kennenlernen und Hinzufügen
app.get('/api/newplayers', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const rel = new Map((await store.friendList(u.id)).map((f) => [f.id, f.status]));
    // Testkonten aus der Entwicklung nicht anzeigen
    const TEST = /test|claude|tester|probe|dummy|demo/i;
    const list = (await store.recentUsers(30)).filter((o) => !TEST.test(o.name)).slice(0, 12).map((o) => ({ ...publicStats(o), online: game.online.has(o.id), friend: rel.get(o.id) || null, self: o.id === u.id, joined: Number(o.created_ms) || null }));
    res.json({ players: list });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// --- Mod-Menü: nur Admin und Co-Admins ---
const modAuth = async (req, res) => {
  const u = await auth(req);
  if (!u) { res.status(401).json({ error: 'Bitte neu anmelden.' }); return null; }
  if (!isMod(u)) { res.status(403).json({ error: 'Kein Zugriff.' }); return null; }
  return u;
};
const modView = (t) => ({ ...publicStats(t), xp: t.xp, dailyStreak: Number(t.daily_streak) || 0, wheelUsed: Number(t.wheel_used) || 0, answered: t.answered || 0, pointsTotal: t.points || 0, diamonds: Number(t.diamonds) || 0, emblem: t.emblem || '', titleId: t.title || '', unlocks: String(t.unlocks || '').split(',').filter(Boolean), codes: String(t.codes || '').split(',').filter(Boolean) });

app.get('/api/admin/users', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    const list = await store.searchUsers(req.query.q, req.query.q ? 50 : 300);
    res.json({ total: await store.countUsers(), users: list.map(modView), roles: ROLES, admin: isAdmin(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Werte eines Spielers ändern. Level und Prestige lassen sich getrennt setzen.
const NUM_FIELDS = { level: 1, xp: 1, prestige: 1, rank_points: 1, wins: 1, matches: 1, exact: 1, close: 1, answered: 1, mc_right: 1, mc_total: 1, points: 1, best_score: 1, streak: 1, best_streak: 1, casino_xp: 1, casino_rounds: 1, casino_wins: 1, casino_best: 1, daily_streak: 1, wheel_used: 1, packs_opened: 1 };
app.post('/api/admin/user', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    const t = await store.userById(Number(req.body.id)); if (!t) return res.status(404).json({ error: 'Diesen Spieler gibt es nicht.' });
    const f = {};
    for (const k of Object.keys(NUM_FIELDS)) {
      if (req.body[k] === undefined || req.body[k] === '') continue;
      const v = Math.max(0, Math.round(Number(req.body[k])));
      if (!Number.isFinite(v)) continue;
      if (k === 'level') f.xp = progress.xpForLevel(Math.min(v, progress.MAX_LEVEL));
      else if (k === 'prestige') f.prestige = Math.min(v, progress.MAX_PRESTIGE);
      else f[k] = v;
    }
    if (req.body.role !== undefined) {
      if (!isAdmin(u)) return res.status(403).json({ error: 'Nur der Admin vergibt Rollen.' });
      if (!ROLES.includes(String(req.body.role))) return res.status(400).json({ error: 'Unbekannte Rolle.' });
      f.role = String(req.body.role);
    }
    await store.save(t.id, f);
    res.json({ user: modView(await store.userById(t.id)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Embleme und Titel für einen Spieler einzeln freischalten oder zurücksetzen
// Admin: Fragen-Pool ansehen und steuern
app.get('/api/admin/pool', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    if (!isAdmin(u)) return res.status(403).json({ error: 'Nur für den Admin.' });
    const seen = await store.seenCounts(u.id).catch(() => new Set());
    res.json({ source: (await store.setting('question_source')) || 'live', ...game.qpool.stats(seen) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});
app.post('/api/admin/pool', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    if (!isAdmin(u)) return res.status(403).json({ error: 'Nur für den Admin.' });
    const a = String(req.body.action || '');
    if (a === 'start') game.qpool.start();
    else if (a === 'stop') game.qpool.stop();
    else if (a === 'target') game.qpool.setTarget(req.body.value);
    else if (a === 'auto') game.qpool.setAuto(!!req.body.value);
    else if (a === 'mode') game.qpool.setMode(String(req.body.value));
    else if (a === 'ttarget') { const v = typeof req.body.value === 'object' && req.body.value ? req.body.value : req.body; game.qpool.setThemeTarget(String(v.key), v.value); }
    else if (a === 'effort') game.qpool.setEffort(String(req.body.value));
    else return res.status(400).json({ error: 'Unbekannte Aktion.' });
    const seen = await store.seenCounts(u.id).catch(() => new Set());
    res.json({ source: (await store.setting('question_source')) || 'live', ...game.qpool.stats(seen) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Fragenquelle: live erstellen oder aus dem eigenen Pool
app.post('/api/admin/qsource', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    if (!isAdmin(u)) return res.status(403).json({ error: 'Nur der Admin stellt die Fragenquelle um.' });
    const src = req.body.source === 'pool' ? 'pool' : 'live';
    await store.setting('question_source', src);
    console.log('Fragenquelle umgestellt auf', src);
    res.json({ source: src });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/admin/pack', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    if (!isAdmin(u)) return res.status(403).json({ error: 'Nur der Admin kann Booster verschenken.' });
    const pid = String(req.body.pack || ''), n = Math.max(1, Math.min(100, Math.round(Number(req.body.n) || 1)));
    if (!tcg.PACKS[pid]) return res.status(400).json({ error: 'Unbekannter Booster.' });
    const t = await store.userById(Number(req.body.id)); if (!t) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
    const c = await store.packAdd(t.id, pid, n);
    console.log(`Admin: ${n}× ${pid} an ${t.name}`);
    res.json({ ok: true, count: c, name: tcg.PACKS[pid].name, to: t.name });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/admin/unlock', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    const t = await store.userById(Number(req.body.id)); if (!t) return res.status(404).json({ error: 'Diesen Spieler gibt es nicht.' });
    const list = cards.setUnlock(t, String(req.body.card || ''), !!req.body.on, frames.FRAMES.filter((f) => !f.dev).map((f) => f.id));
    if (list === null) return res.status(400).json({ error: 'Unbekanntes Emblem, Titel oder Rahmen.' });
    await store.save(t.id, { unlocks: list });
    res.json({ user: modView(await store.userById(t.id)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Admin setzt das Passwort eines Spielers neu (es gibt keine E-Mail-Funktion)
app.post('/api/admin/reset', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u || !isMod(u)) return res.status(403).json({ error: 'Kein Zugriff.' });
    const target = await store.userByName(String(req.body.name || '').trim());
    const pw = String(req.body.password || '');
    if (!target) return res.status(404).json({ error: 'Diesen Spieler gibt es nicht.' });
    if (pw.length < 6) return res.status(400).json({ error: 'Passwort: mindestens 6 Zeichen.' });
    await store.setPass(target.id, hashPass(pw));
    res.json({ ok: true, name: target.name });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Prestige: setzt Level und XP zurück und schaltet den nächsten Rahmen frei
app.post('/api/prestige', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    if (!progress.prestigeStatus(u).can) return res.status(400).json({ error: 'Die Bedingungen für den nächsten Prestige-Rang sind noch nicht erfüllt.' });
    await store.save(u.id, { prestige: u.prestige + 1, xp: 0 });
    res.json({ prestige: u.prestige + 1 });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Profilbild: kommt vom Handy schon verkleinert als Data-URL
app.post('/api/avatar', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const data = String(req.body.data || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data) || data.length > 90000) return res.status(400).json({ error: 'Das Bild ist zu groß oder kein JPG/PNG.' });
    res.json({ av: await store.setAvatar(u.id, data) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler beim Speichern des Bildes.' }); }
});
app.get('/api/avatar/:id', async (req, res) => {
  try {
    const u = await store.userById(Number(req.params.id), true);
    const m = u && u.avatar && /^data:(image\/\w+);base64,(.+)$/.exec(u.avatar);
    if (!m) return res.status(404).end();
    res.set({ 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' }).send(Buffer.from(m[2], 'base64'));
  } catch (e) { res.status(500).end(); }
});

app.use('/emblems', express.static(path.join(__dirname, 'public/emblems'), { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });
io.use(async (socket, next) => {
  try {
    const id = readToken(socket.handshake.auth?.token);
    const u = id && (await store.userById(id));
    if (!u) return next(new Error('auth'));
    socket.data.user = { id: u.id, name: u.name };
    next();
  } catch (e) { next(new Error('auth')); }
});
const game = attachGame(io, store);
// Mehrspieler-Blackjack: eigene Socket-Events, gleiche Anmeldung wie das Schätzspiel
const bjTables = require('./lib/bjtables')(io, store, casinoStat, push);
// Poker: vorerst nur für das Entwicklerteam, bis 'poker_open' gesetzt ist
// Poker zählt als Casino, gibt aber 25 % mehr XP, weil gegen echte Spieler gespielt wird
const pokerStat = async (uid, stake, won, info = {}) => {
  await casinoStat(uid, stake, won);
  const u = await store.userById(uid); if (!u) return;
  const bonus = Math.round(vip.xpFor(stake, won, stake) * 0.25) * (hot.active() ? 2 : 1);
  const net = won - stake;
  await store.save(uid, {
    casino_xp: (Number(u.casino_xp) || 0) + bonus,
    poker_hands: (Number(u.poker_hands) || 0) + 1,
    poker_wins: (Number(u.poker_wins) || 0) + (won > 0 ? 1 : 0),
    poker_best: Math.max(Number(u.poker_best) || 0, won > 0 ? won : 0),
    poker_allin_wins: (Number(u.poker_allin_wins) || 0) + (info.allin && net > 0 ? 1 : 0),
  });
  setTimeout(() => checkProgress(uid), 500);
};
const poker = require('./lib/poker')(io, store, pokerStat, async () => true, push); // Poker ist für alle offen
io.on('connection', (socket) => { if (socket.data.user) { bjTables.attach(socket, socket.data.user); poker.attach(socket, socket.data.user); checkProgress(socket.data.user.id); } }); // Erfolge: Ausgangsstand beim Verbinden
game.hooks.progress = (id) => checkProgress(id);
game.hooks.table = (id) => (poker.isSeated(id) ? 'spielt Poker' : bjTables.isSeated(id));

store.init().then(() => push.init(store)).then((k) => {
  console.log('Push bereit, Schlüssel endet auf …' + k.slice(-6));
  server.listen(PORT, () => console.log(`Schätzspiel läuft auf Port ${PORT} | Speicher: ${store.kind} | KI-Fragen: ${ai.enabled() ? 'an' : 'aus'}`));
}).catch((e) => { console.error('Datenbank nicht erreichbar:', e.message); process.exit(1); });
