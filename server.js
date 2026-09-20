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

const shownPrestige = (u) => (u.pres_shown === -1 ? 0 : u.pres_shown > 0 ? Math.min(u.pres_shown, u.prestige) : u.prestige);
const isAdmin = (u) => !!ADMIN_NAME && u.name.toLowerCase() === ADMIN_NAME;
const isMod = (u) => isAdmin(u) || u.role === 'coadmin';
const ROLES = ['', 'coadmin', 'supporter'];

const publicStats = (u) => ({
  id: u.id, name: u.name, frame: u.frame || '', frameAnim: frames.animOf(u.frame), role: u.role || '', streak: u.streak || 0, lastSeen: Number(u.last_seen) || 0, presShown: shownPrestige(u), tag: u.tag || '', tagColor: u.tag_color || '', emblem: u.emblem || '', title: (cards.titleById(u.title) && cards.has(cards.titleById(u.title), u)) ? { id: u.title === 'secret' ? 'tsecret' : u.title, text: cards.titleById(u.title).text, style: cards.titleById(u.title).style } : null, matches: u.matches, wins: u.wins, answered: u.answered, exact: u.exact, close: u.close,
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

app.get('/api/home', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const withOnline = (x) => ({ ...publicStats(x), online: game.online.has(x.id) });
    res.json({ tagColors: TAG_COLORS, me: { ...publicStats(u), frame: u.frame || '', emblem: u.emblem || '', title: u.title || '', titleShown: publicStats(u).title, admin: isAdmin(u), mod: isMod(u) }, leaderboard: (await store.leaderboard()).map(withOnline), ai: ai.enabled(),
      world: (await store.worldRanking()).map(withOnline),
      points: (await store.pointsRanking()).map(withOnline),
      seen: String(u.seen_items || '').split(',').filter(Boolean),
      cards: cards.view(u),
      frames: frames.view(u, isMod(u)),
      progress: { maxLevel: progress.MAX_LEVEL, maxPrestige: progress.MAX_PRESTIGE, names: progress.PRESTIGE_NAMES, prestige: progress.prestigeStatus(u), challenges: progress.challengeView(u) } });
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

// Profilrahmen wählen
app.post('/api/frame', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const id = String(req.body.frame || '');
    if (!frames.canUse(u, id, isMod(u))) return res.status(403).json({ error: 'Diesen Rahmen hast du noch nicht.' });
    await store.save(u.id, { frame: id });
    res.json({ frame: id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler.' }); }
});

// Spielerkarte: Emblem und Titel wählen
app.post('/api/card', async (req, res) => {
  try {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    const emblem = String(req.body.emblem || ''), title = String(req.body.title || '');
    if (!cards.canUse(u, emblem, title)) return res.status(403).json({ error: 'Das hast du noch nicht freigeschaltet.' });
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
    await store.save(u.id, { codes: r.codes });
    res.json({ reward: r.reward });
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
const modView = (t) => ({ ...publicStats(t), xp: t.xp, emblem: t.emblem || '', titleId: t.title || '', unlocks: String(t.unlocks || '').split(',').filter(Boolean), codes: String(t.codes || '').split(',').filter(Boolean) });

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
    const list = cards.setUnlock(t, String(req.body.card || ''), !!req.body.on);
    if (list === null) return res.status(400).json({ error: 'Unbekanntes Emblem oder Titel.' });
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

store.init().then(() => push.init(store)).then((k) => {
  console.log('Push bereit, Schlüssel endet auf …' + k.slice(-6));
  server.listen(PORT, () => console.log(`Schätzspiel läuft auf Port ${PORT} | Speicher: ${store.kind} | KI-Fragen: ${ai.enabled() ? 'an' : 'aus'}`));
}).catch((e) => { console.error('Datenbank nicht erreichbar:', e.message); process.exit(1); });
