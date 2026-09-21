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
  casinoXp: Number(u.casino_xp) || 0, casinoRounds: Number(u.casino_rounds) || 0, casinoWins: Number(u.casino_wins) || 0, casinoBest: Number(u.casino_best) || 0, casinoNet: Number(u.casino_net) || 0, frame: u.frame || '', frameAnim: frames.animOf(u.frame), role: u.role || '', streak: u.streak || 0, lastSeen: Number(u.last_seen) || 0, presShown: shownPrestige(u), tag: u.tag || '', tagColor: u.tag_color || '', emblem: u.emblem || '', title: cards.titleById(u.title) ? { id: u.title === 'secret' ? 'tsecret' : u.title, text: cards.titleById(u.title).text, style: cards.titleById(u.title).style } : null, matches: u.matches, wins: u.wins, answered: u.answered, exact: u.exact, close: u.close,
  mcRight: u.mc_right, mcTotal: u.mc_total, points: u.points, rankPoints: u.rank_points, avgDev: u.dev_n ? u.dev_sum / u.dev_n : null,
  bestScore: u.best_score, bestStreak: u.best_streak, prestige: u.prestige, av: u.av, ...progress.levelInfo(u.xp),
});
const auth = async (req) => { const id = readToken((req.headers.authorization || '').replace('Bearer ', '')); return id ? store.userById(id) : null; };

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '120kb' }));
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
const TOP = new Set(['ext', 'ghost']);
async function cardStats(uid) {
  const rows = await store.cardsOf(uid).catch(() => []);
  let total = 0, rare = 0, ext = 0;
  for (const r of rows) {
    const n = Number(r.count) || 0;
    total += n;
    if (RARE.has(r.variant)) rare += n;
    if (TOP.has(r.variant)) ext += n;
  }
  return { cards_total: total, cards_rare: rare, cards_ext: ext };
}

app.get('/api/home', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const withOnline = (x) => ({ ...publicStats(x), online: game.online.has(x.id) });
    const u2 = { ...u, ...(await cardStats(u.id)), _mod: isMod(u) };
    res.json({ tagColors: TAG_COLORS, me: { ...publicStats(u), frame: u.frame || '', emblem: u.emblem || '', title: u.title || '', titleShown: publicStats(u).title, admin: isAdmin(u), mod: isMod(u) }, leaderboard: (await store.leaderboard()).map(withOnline), ai: ai.enabled(),
      world: (await store.worldRanking()).map(withOnline),
      points: (await store.pointsRanking()).map(withOnline),
      seen: String(u.seen_items || '').split(',').filter(Boolean),
      cards: cards.view(u2),
      frames: frames.view(u2, isMod(u)),
      casinoTop: (await store.casinoRanking().catch(() => [])).map(publicStats),
      progress: { maxLevel: progress.MAX_LEVEL, maxPrestige: progress.MAX_PRESTIGE, names: progress.PRESTIGE_NAMES, prestige: progress.prestigeStatus(u), challenges: progress.challengeView(u2) } });
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
const MIN_BET = 50, MAX_BET = 20000;
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
const casinoStat = async (uid, stake, won) => {
  const u = await store.userById(uid); if (!u) return;
  const net = won - stake;
  await store.save(uid, {
    casino_rounds: (Number(u.casino_rounds) || 0) + 1,
    casino_wins: (Number(u.casino_wins) || 0) + (won > stake ? 1 : 0),
    casino_best: Math.max(Number(u.casino_best) || 0, won),
    casino_net: (Number(u.casino_net) || 0) + net,
    casino_xp: (Number(u.casino_xp) || 0) + Math.max(5, Math.round(stake / 20) + (won > stake ? Math.round(won / 40) : 0)),
  });
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
    if (total > MAX_BET) return res.status(400).json({ error: 'Höchstens 20.000 Diamanten pro Runde.' });
    const have = Number(u.diamonds) || 0;
    if (have < total) return res.status(400).json({ error: 'So viele Diamanten hast du nicht.' });
    const r = casino.spinBoard(bets);
    if (r.error) return res.status(400).json({ error: r.error });
    const after = have - r.stake + r.won;
    await store.save(u.id, { diamonds: after });
    await casinoStat(u.id, r.stake, r.won);
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
    const n = Math.max(1, Math.min(20, Math.round(Number(req.body.n) || 1))); // passt zum Max-Knopf im Shop
    if (!p) return res.status(400).json({ error: 'Unbekannter Booster.' });
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
    res.json({ pulled, state: await tcgState(await store.userById(u.id)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Doppelte Karten umwandeln
const MELT = { haeufig: 40, selten: 90, holo: 160, legend: 260, ultra: 420, ext: 900, ghost: 1500 };
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
app.post('/api/tcg/cancel', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const row = await store.marketGet(req.body.id);
    if (!row || row.seller !== u.id) return res.status(403).json({ error: 'Das ist nicht dein Angebot.' });
    await store.marketDrop(row.id);
    await store.cardAdd(u.id, row.card_id, row.variant, 1);
    res.json(await tcgState(await store.userById(u.id)));
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
    await store.cardAdd(u.id, row.card_id, row.variant, 1);
    push.toUser(row.seller, { title: '💎 Verkauft', body: `${u.name} hat deine Karte für ${price} Diamanten gekauft.`, tag: 'market', url: '/' }).catch(() => {});
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
      out.push({ ...publicStats(o), status: f.status, online: game.online.has(o.id), playing: !!m && m.phase !== 'lobby' && m.phase !== 'finished',
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
    res.json({ user: { ...publicStats(o), online: game.online.has(o.id), playing: !!m2 && !['lobby', 'finished'].includes(m2.phase) } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// --- Mod-Menü: nur Admin und Co-Admins ---
const modAuth = async (req, res) => {
  const u = await auth(req);
  if (!u) { res.status(401).json({ error: 'Bitte neu anmelden.' }); return null; }
  if (!isMod(u)) { res.status(403).json({ error: 'Kein Zugriff.' }); return null; }
  return u;
};
const modView = (t) => ({ ...publicStats(t), xp: t.xp, diamonds: Number(t.diamonds) || 0, emblem: t.emblem || '', titleId: t.title || '', unlocks: String(t.unlocks || '').split(',').filter(Boolean), codes: String(t.codes || '').split(',').filter(Boolean) });

app.get('/api/admin/users', async (req, res) => {
  try {
    const u = await modAuth(req, res); if (!u) return;
    const list = await store.searchUsers(req.query.q, 50);
    res.json({ total: await store.countUsers(), users: list.map(modView), roles: ROLES, admin: isAdmin(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Werte eines Spielers ändern. Level und Prestige lassen sich getrennt setzen.
const NUM_FIELDS = { level: 1, xp: 1, prestige: 1, rank_points: 1, wins: 1, matches: 1, exact: 1, close: 1, answered: 1, mc_right: 1, mc_total: 1, points: 1, best_score: 1, streak: 1, best_streak: 1 };
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
io.on('connection', (socket) => { if (socket.data.user) bjTables.attach(socket, socket.data.user); });

store.init().then(() => push.init(store)).then((k) => {
  console.log('Push bereit, Schlüssel endet auf …' + k.slice(-6));
  server.listen(PORT, () => console.log(`Schätzspiel läuft auf Port ${PORT} | Speicher: ${store.kind} | KI-Fragen: ${ai.enabled() ? 'an' : 'aus'}`));
}).catch((e) => { console.error('Datenbank nicht erreichbar:', e.message); process.exit(1); });
