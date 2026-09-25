// Speichert Accounts, Fortschritt, KI-Fragen und Meldungen.
// Mit DATABASE_URL: Postgres. Ohne: Arbeitsspeicher (Daten weg nach Neustart, gut zum Testen).
// Fragen für den Abgleich vereinheitlichen: Kleinschreibung, keine Sonderzeichen
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
const { AsyncLocalStorage } = require('async_hooks');
const ctx = new AsyncLocalStorage(); // Herkunft einer Guthaben-Änderung (Pfad oder Socket-Ereignis)
const src = () => (ctx.getStore() && ctx.getStore().src) || 'System';
const note = () => String((ctx.getStore() && ctx.getStore().note) || '').slice(0, 300);
const TRACK = ['diamonds', 'xp', 'casino_xp', 'pass_xp'], KIND = { diamonds: 'dia', xp: 'xp', casino_xp: 'cxp', pass_xp: 'pxp' }; // wird protokolliert
const dbStat = { n: 0, ms: 0 }; // gemessene Datenbankzugriffe (für die Langsam-Meldung im Server)
const NUM_KEYS = ['p_best_score', 'p_best_streak', 'pass_cxp', 'casino_ban', 'wheel_bonus', 'pass_xp', 'pass_prem', 'pass_bank', 'matches', 'wins', 'answered', 'exact', 'close', 'mc_right', 'mc_total', 'points', 'dev_sum', 'dev_n', 'xp', 'prestige', 'best_score', 'streak', 'best_streak', 'av', 'rank_points', 'pres_shown', 'last_seen', 'diamonds', 'casino_xp', 'casino_rounds', 'casino_wins', 'casino_best', 'casino_net', 'daily_streak', 'daily_base', 'packs_opened', 'melted', 'casino_day_net', 'cash_prev_net', 'wheel_used', 'poker_hands', 'poker_wins', 'poker_best', 'poker_allin_wins', 'play_minutes', 'poker_minutes', 'peak_cards_total', 'peak_cards_rare', 'peak_cards_ext', 'peak_toon', 'peak_collect', 'slot_spins', 'slot_full', 'slot_best'];
const TEXT_KEYS = ['casino_best_game', 'pres_base', 'pass_cc', 'pot_active', 'pass_season', 'pass_cf', 'pass_cp', 'pass_wk', 'pass_wdone', 'tag', 'tag_color', 'emblem', 'title', 'codes', 'role', 'unlocks', 'frame', 'seen_items', 'daily_day', 'casino_day', 'cash_prev_day', 'cash_claimed', 'wheel_day', 'casino_theme', 'first_game_day', 'news_claimed', 'showcase', 'showcase_g', 'chal_paid'];
const rank = (a, b) => b.prestige - a.prestige || b.xp - a.xp || b.wins - a.wins;

function memoryStore() {
  const seen = new Map(); // Spieler -> gesehene Fragen
  const trades = [], tickets = [], gifts = [], graded = [];
  const users = new Map(), byId = new Map(), ai = [], reports = new Map(), fr = [], subs = new Map(), settings = new Map(), ledger = [];
  const inv = new Map(), packs = new Map(), market = []; let mid = 0;
  const askedLib = new Set();
  const k3 = (u, c, v) => u + '|' + c + '|' + v;
  let uid = 0, qid = 0;
  return {
    kind: 'memory',
    async init() {},
    async createUser(name, pass) {
      const key = name.toLowerCase();
      if (users.has(key)) return null;
      const u = { id: ++uid, name, pass, avatar: null, tag: '', tag_color: '', emblem: '', title: '', codes: '', role: '', unlocks: '', ...Object.fromEntries(NUM_KEYS.map((k) => [k, 0])) };
      users.set(key, u); byId.set(u.id, u);
      return u;
    },
    async userByName(name) { return users.get(name.toLowerCase()) || null; },
    async userById(id) { return byId.get(id) || null; },
    async save(id, f) {
      const u = byId.get(id); if (!u) return;
      const before = Object.fromEntries(TRACK.map((k) => [k, Number(u[k]) || 0]));
      for (const k of [...NUM_KEYS, ...TEXT_KEYS]) if (k in f) u[k] = f[k];
      for (const k of TRACK) if (k in f && Number(f[k]) !== before[k]) ledger.push({ user_id: id, ts: Date.now(), delta: Number(f[k]) - before[k], after: Number(f[k]), src: src(), kind: KIND[k], note: k === 'diamonds' ? note() : '' });
    },
    async ledgerOf(uid, limit = 300, kind = 'dia') { return ledger.filter((x) => x.user_id === uid && (x.kind || 'dia') === kind).slice(-limit).reverse(); },
    async setAvatar(id, data) { const u = byId.get(id); u.avatar = data; u.av++; return u.av; },
    async setPass(id, pass) { const u = byId.get(id); if (u) u.pass = pass; },
    async friendAdd(a, b) {
      const e = fr.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
      if (!e) { fr.push({ a, b, status: 'pending' }); return 'pending'; }
      if (e.status === 'pending' && e.a === b) e.status = 'ok';
      return e.status;
    },
    async friendRespond(me, other, accept) { const i = fr.findIndex((x) => x.a === other && x.b === me && x.status === 'pending'); if (i < 0) return; if (accept) fr[i].status = 'ok'; else fr.splice(i, 1); },
    async friendRemove(me, other) { const i = fr.findIndex((x) => (x.a === me && x.b === other) || (x.a === other && x.b === me)); if (i >= 0) fr.splice(i, 1); },
    async friendList(me) { return fr.filter((x) => x.a === me || x.b === me).map((x) => ({ id: x.a === me ? x.b : x.a, status: x.status === 'ok' ? 'ok' : x.a === me ? 'out' : 'in' })); },
    async setting(k, v) { if (v === undefined) return settings.get(k) || null; settings.set(k, v); return v; },
    async pushSave(userId, sub) { subs.set(sub.endpoint, { userId, sub }); },
    async pushDrop(endpoint) { subs.delete(endpoint); },
    async pushFor(userId) { return [...subs.values()].filter((x) => x.userId === userId).map((x) => x.sub); },
    async pushAll() { return [...subs.values()].map((x) => x.sub); },
    async askedAdd(texts) { for (const t of texts) askedLib.add(norm(t)); },
    async askedHas(text) { return askedLib.has(norm(text)); },
    async askedAll(limit = 400) { return [...askedLib].slice(-limit); },
    async cardsOf(uid) { return [...inv.values()].filter((x) => x.user_id === uid && x.count > 0); },
    async cardAdd(uid, cid, v, n = 1) {
      const k = k3(uid, cid, v), e = inv.get(k) || { user_id: uid, card_id: cid, variant: v, count: 0 };
      e.count += n; if (e.count <= 0) inv.delete(k); else inv.set(k, e); return Math.max(0, e.count);
    },
    async cardCount(uid, cid, v) { const e = inv.get(k3(uid, cid, v)); return e ? e.count : 0; },
    async packsOf(uid) { return [...packs.values()].filter((x) => x.user_id === uid && x.count > 0); },
    async packAdd(uid, pid, n = 1) {
      const k = uid + '|' + pid, e = packs.get(k) || { user_id: uid, pack_id: pid, count: 0 };
      e.count += n; if (e.count <= 0) packs.delete(k); else packs.set(k, e); return Math.max(0, e.count);
    },
    async marketList() { return market.filter((m) => !m.sold); },
    async marketAdd(row) { row.id = ++mid; row.created = Date.now(); market.push(row); return row; },
    async marketGet(id) { return market.find((m) => m.id === Number(id) && !m.sold) || null; },
    async marketDrop(id) { const i = market.findIndex((m) => m.id === Number(id)); if (i >= 0) market.splice(i, 1); },
    async tradeLog(r) { trades.unshift({ ...r, id: trades.length + 1, created: Date.now() }); },
    async trades(limit = 50) { return trades.slice(0, limit); },
    async tradesFor(cid, v) { return trades.filter((t) => t.card_id === cid && t.variant === v).slice(0, 200); },
    async gradedAdd(g) { const row = { ...g, id: graded.length + 1, created: Date.now() }; graded.push(row); return row; },
    async gradedOf(uid) { return graded.filter((x) => x.user_id === uid).sort((a, b) => b.id - a.id); },
    async gradedGet(id) { return graded.find((x) => x.id === Number(id)) || null; },
    async gradedMove(id, uid) { const g = graded.find((x) => x.id === Number(id)); if (g) g.user_id = uid; return g || null; },
    async gradedAll() { return graded.slice(); },
    async giftAdd(g) { const row = { ...g, id: gifts.length + 1, created: Date.now(), claimed: false }; gifts.push(row); return row; },
    async giftsOpen(uid) { return gifts.filter((g) => g.user_id === uid && !g.claimed); },
    async giftClaim(id, uid) { const g = gifts.find((x) => x.id === Number(id) && x.user_id === uid && !x.claimed); if (g) g.claimed = true; return g || null; },
    async ticketAdd(t) { const row = { ...t, id: tickets.length + 1, status: 'eingereicht', created: Date.now(), updated: Date.now() }; tickets.unshift(row); return row; },
    async tickets() { return tickets.map(({ image, ...r }) => ({ ...r, hasImage: !!image })); },
    async ticketGet(id) { return tickets.find((x) => x.id === Number(id)) || null; },
    async ticketStatus(id, status, by, reply) { const t = tickets.find((x) => x.id === Number(id)); if (t) { t.status = status; t.handler = by; t.updated = Date.now(); if (reply) t.reply = reply; } return t || null; },
    async allUsers() { return [...byId.values()]; },
    async activeUsers(since) { return [...byId.values()].filter((u) => (Number(u.last_seen) || 0) > since && (Number(u.matches) || 0) > 0); },
    async usersFull(limit = 500) { return [...byId.values()].sort((a, b) => (Number(b.last_seen) || 0) - (Number(a.last_seen) || 0)).slice(0, limit); },
    async passTop(season, n = 50) { return [...byId.values()].filter((u) => u.pass_season === season && Number(u.pass_xp) > 0).sort((a, b) => Number(b.pass_xp) - Number(a.pass_xp)).slice(0, n); },
    async recentUsers(n) { return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, n); },
    async resetWheel() { for (const u of byId.values()) u.wheel_used = 0; },
    async casinoRanking() { return [...byId.values()].filter((u) => (u.casino_rounds || 0) > 0).sort((a, b) => (b.casino_xp || 0) - (a.casino_xp || 0)).slice(0, 20); },
    async leaderboard() { return [...byId.values()].filter((u) => u.matches > 0).sort(rank).slice(0, 10); },
    async worldRanking() { return [...byId.values()].filter((u) => u.rank_points > 0).sort((a, b) => b.rank_points - a.rank_points).slice(0, 20); },
    async pointsRanking() { return [...byId.values()].filter((u) => u.matches > 0).sort((a, b) => b.points - a.points).slice(0, 20); },
    async searchUsers(q, limit) { const s = String(q || '').toLowerCase(); return [...byId.values()].filter((u) => !s || u.name.toLowerCase().includes(s)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit || 50); },
    async countUsers() { return byId.size; },
    async addAiQuestions(list) { return list.map((q) => { const s = { ...q, id: 'a' + (++qid) }; ai.push(s); return s; }); },
    async aiQuestions() { return ai.slice(-500); },
    async poolAll() { return ai.slice(); },
    async seenAdd(uids, qid) { for (const u of uids) { if (!seen.has(u)) seen.set(u, new Set()); seen.get(u).add(qid); } },
    async seenOf(uids) { const out = new Set(); for (const u of uids) for (const q of seen.get(u) || []) out.add(q); return out; },
    async seenCounts(uid) { return seen.get(uid) || new Set(); },
    async seenAddMany(uids, qids) { for (const u of uids) { if (!seen.has(u)) seen.set(u, new Set()); for (const q of qids) seen.get(u).add(q); } return uids.length * qids.length; },
    async report(id, name) { const r = reports.get(id) || { n: 0, names: [], at: 0, status: 'open' }; r.n++; if (name && !r.names.includes(name)) r.names.push(name); r.at = Date.now(); if (r.status === 'kept') r.status = 'open'; reports.set(id, r); },
    async reportedIds() { return new Set([...reports].filter(([, r]) => r.status !== 'kept').map(([k]) => k)); }, // gemeldet = gesperrt, bis der Admin entsperrt
    async reportList() { return [...reports].map(([qid, r]) => ({ qid, n: r.n, names: r.names, at: r.at, status: r.status })); },
    async reportSet(qid, status) { const r = reports.get(qid); if (!r) return; r.status = status; if (status === 'kept') r.n = 0; },
  };
}

function pgStore(url) {
  const { Pool } = require('pg');
  const db = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 10 });
  try { const h = new URL(url).hostname; console.log(`Datenbank: ${/\.render\.com$/.test(h) ? 'EXTERNE Adresse (langsamer, besser die interne verwenden)' : 'interne Adresse'} · ${h.split('.')[0]}`); } catch (e) {}
  { const oq = db.query.bind(db); db.query = (...a) => { const t = Date.now(), p = oq(...a); if (p && p.then) p.then(() => { dbStat.n++; dbStat.ms += Date.now() - t; }, () => {}); return p; }; } // Datenbankzeit messen
  const one = async (sql, p) => (await db.query(sql, p)).rows[0] || null;
  const num = (u) => { if (u) for (const k of NUM_KEYS) u[k] = Number(u[k]); return u; };
  const COLS = 'id,name,pass,' + [...NUM_KEYS, ...TEXT_KEYS].join(','); // ohne avatar, der wird nur gezielt geladen
  return {
    kind: 'postgres',
    async init() {
      await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, name_key TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, created TIMESTAMPTZ DEFAULT now(), avatar TEXT)`);
      for (const k of NUM_KEYS) await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${k} ${k === 'dev_sum' ? 'DOUBLE PRECISION' : 'BIGINT'} DEFAULT 0`);
      for (const k of TEXT_KEYS) await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${k} TEXT DEFAULT ''`);
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
      await db.query(`CREATE TABLE IF NOT EXISTS ai_questions (id SERIAL PRIMARY KEY, data JSONB NOT NULL, created TIMESTAMPTZ DEFAULT now())`);
      await db.query(`CREATE TABLE IF NOT EXISTS user_seen (user_id INTEGER NOT NULL, qid TEXT NOT NULL, PRIMARY KEY (user_id, qid))`);
      await db.query(`CREATE TABLE IF NOT EXISTS trades (id SERIAL PRIMARY KEY, seller INTEGER, seller_name TEXT, buyer INTEGER, buyer_name TEXT, card_id TEXT, variant TEXT, price BIGINT, created TIMESTAMPTZ DEFAULT now())`);
      await db.query(`CREATE TABLE IF NOT EXISTS tickets (id SERIAL PRIMARY KEY, user_id INTEGER, user_name TEXT, category TEXT, title TEXT, text TEXT, image TEXT, status TEXT DEFAULT 'eingereicht', handler TEXT, created TIMESTAMPTZ DEFAULT now(), updated TIMESTAMPTZ DEFAULT now())`);
      await db.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reply TEXT`);
      await db.query(`CREATE TABLE IF NOT EXISTS gifts (id SERIAL PRIMARY KEY, user_id INTEGER, diamonds INTEGER DEFAULT 0, pack TEXT, n INTEGER DEFAULT 0, reason TEXT, created TIMESTAMPTZ DEFAULT now(), claimed BOOLEAN DEFAULT false)`);
      await db.query(`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'support'`);
      await db.query(`CREATE TABLE IF NOT EXISTS graded (id SERIAL PRIMARY KEY, user_id INTEGER, card_id TEXT, variant TEXT, grade INTEGER, created TIMESTAMPTZ DEFAULT now())`);
      await db.query(`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS message TEXT`);
      await db.query(`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0`);
      await db.query(`ALTER TABLE gifts ADD COLUMN IF NOT EXISTS items TEXT`);
      await db.query(`CREATE TABLE IF NOT EXISTS friends (a INT NOT NULL, b INT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', PRIMARY KEY (a, b))`);
      await db.query(`CREATE TABLE IF NOT EXISTS asked_questions (id SERIAL PRIMARY KEY, qnorm TEXT UNIQUE NOT NULL, qtext TEXT NOT NULL, created TIMESTAMPTZ DEFAULT now())`);
      await db.query(`CREATE TABLE IF NOT EXISTS user_cards (user_id INT NOT NULL, card_id TEXT NOT NULL, variant TEXT NOT NULL, count INT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, card_id, variant))`);
      await db.query(`CREATE TABLE IF NOT EXISTS user_packs (user_id INT NOT NULL, pack_id TEXT NOT NULL, count INT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, pack_id))`);
      await db.query(`CREATE TABLE IF NOT EXISTS market (id SERIAL PRIMARY KEY, seller INT NOT NULL, card_id TEXT NOT NULL, variant TEXT NOT NULL, price INT NOT NULL, sold BOOLEAN DEFAULT false, created TIMESTAMPTZ DEFAULT now())`);
      await db.query(`CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, user_id INT NOT NULL, data JSONB NOT NULL, created TIMESTAMPTZ DEFAULT now())`);
      await db.query(`CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
      await db.query(`CREATE TABLE IF NOT EXISTS ledger (id BIGSERIAL PRIMARY KEY, user_id INT NOT NULL, ts BIGINT NOT NULL, delta BIGINT NOT NULL, after BIGINT NOT NULL, src TEXT)`);
      await db.query(`CREATE INDEX IF NOT EXISTS ledger_user_ts ON ledger(user_id, ts DESC)`);
      await db.query(`ALTER TABLE ledger ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'dia'`);
      await db.query(`ALTER TABLE ledger ADD COLUMN IF NOT EXISTS note TEXT`);
      await db.query('DELETE FROM ledger WHERE ts < $1', [Date.now() - 90 * 864e5]).catch(() => {}); // 90 Tage aufheben
      await db.query(`CREATE TABLE IF NOT EXISTS question_reports (qid TEXT PRIMARY KEY, n INT DEFAULT 0)`);
      await db.query(`ALTER TABLE question_reports ADD COLUMN IF NOT EXISTS names TEXT DEFAULT ''`);
      await db.query(`ALTER TABLE question_reports ADD COLUMN IF NOT EXISTS last_at BIGINT DEFAULT 0`);
      await db.query(`ALTER TABLE question_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'`);
    },
    async createUser(name, pass) {
      try { return num(await one(`INSERT INTO users(name,name_key,pass) VALUES($1,$2,$3) RETURNING ${COLS}`, [name, name.toLowerCase(), pass])); }
      catch (e) { if (e.code === '23505') return null; throw e; }
    },
    async userByName(name) { return num(await one(`SELECT ${COLS} FROM users WHERE name_key=$1`, [name.toLowerCase()])); },
    async userById(id, withAvatar) { return num(await one(`SELECT ${COLS}${withAvatar ? ',avatar' : ''} FROM users WHERE id=$1`, [id])); },
    async save(id, f) {
      const keys = [...NUM_KEYS, ...TEXT_KEYS].filter((k) => k in f); if (!keys.length) return;
      const tr = TRACK.filter((k) => k in f);
      if (!tr.length) { await db.query(`UPDATE users SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1`, [id, ...keys.map((k) => f[k])]); return; }
      // Protokoll (Diamanten, XP, Casino-XP, Pass-XP): alten Stand im selben Schritt lesen, Differenz festhalten
      const r = await db.query(`WITH old AS (SELECT ${tr.join(',')} FROM users WHERE id=$1) UPDATE users SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING ${tr.map((k) => `(SELECT ${k} FROM old) AS o_${k}`).join(',')}`, [id, ...keys.map((k) => f[k])]);
      const row = r.rows[0] || {};
      for (const k of tr) { const before = Number(row['o_' + k]) || 0, after = Number(f[k]) || 0; if (after !== before) db.query('INSERT INTO ledger(user_id,ts,delta,after,src,kind,note) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, Date.now(), after - before, after, src(), KIND[k], k === 'diamonds' ? note() : '']).catch((e) => console.error('Protokoll:', e.message)); }
    },
    async ledgerOf(uid, limit = 300, kind = 'dia') { return (await db.query("SELECT user_id,ts,delta,after,src,note FROM ledger WHERE user_id=$1 AND COALESCE(kind,'dia')=$3 ORDER BY ts DESC, id DESC LIMIT $2", [uid, limit, kind])).rows.map((x) => ({ ...x, ts: Number(x.ts), delta: Number(x.delta), after: Number(x.after) })); },
    async friendAdd(a, b) {
      const e = await one('SELECT * FROM friends WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)', [a, b]);
      if (!e) { await db.query('INSERT INTO friends(a,b) VALUES($1,$2)', [a, b]); return 'pending'; }
      if (e.status === 'pending' && e.a === b) { await db.query("UPDATE friends SET status='ok' WHERE a=$1 AND b=$2", [b, a]); return 'ok'; }
      return e.status;
    },
    async friendRespond(me, other, accept) { await db.query(accept ? "UPDATE friends SET status='ok' WHERE a=$1 AND b=$2 AND status='pending'" : "DELETE FROM friends WHERE a=$1 AND b=$2 AND status='pending'", [other, me]); },
    async friendRemove(me, other) { await db.query('DELETE FROM friends WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)', [me, other]); },
    async friendList(me) { return (await db.query('SELECT * FROM friends WHERE a=$1 OR b=$1', [me])).rows.map((x) => ({ id: x.a === me ? x.b : x.a, status: x.status === 'ok' ? 'ok' : x.a === me ? 'out' : 'in' })); },
    async setting(k, v) {
      if (v === undefined) { const r = await one('SELECT v FROM settings WHERE k=$1', [k]); return r ? r.v : null; }
      await db.query('INSERT INTO settings(k,v) VALUES($1,$2) ON CONFLICT (k) DO UPDATE SET v=$2', [k, v]); return v;
    },
    async pushSave(userId, sub) { await db.query('INSERT INTO push_subs(endpoint,user_id,data) VALUES($1,$2,$3) ON CONFLICT (endpoint) DO UPDATE SET user_id=$2, data=$3', [sub.endpoint, userId, JSON.stringify(sub)]); },
    async pushDrop(endpoint) { await db.query('DELETE FROM push_subs WHERE endpoint=$1', [endpoint]); },
    async pushFor(userId) { return (await db.query('SELECT data FROM push_subs WHERE user_id=$1', [userId])).rows.map((r) => r.data); },
    async pushAll() { return (await db.query('SELECT data FROM push_subs')).rows.map((r) => r.data); },
    async askedAdd(texts) {
      for (const t of texts) await db.query('INSERT INTO asked_questions(qnorm, qtext) VALUES($1,$2) ON CONFLICT (qnorm) DO NOTHING', [norm(t), String(t).slice(0, 400)]);
    },
    async askedHas(text) { return !!(await one('SELECT 1 FROM asked_questions WHERE qnorm=$1', [norm(text)])); },
    async askedAll(limit = 400) { return (await db.query('SELECT qtext FROM asked_questions ORDER BY id DESC LIMIT $1', [limit])).rows.map((r) => r.qtext); },
    async cardsOf(uid) { return (await db.query('SELECT * FROM user_cards WHERE user_id=$1 AND count>0', [uid])).rows.map((r) => ({ ...r, count: Number(r.count) })); },
    async cardAdd(uid, cid, v, n = 1) {
      const r = await one('INSERT INTO user_cards(user_id,card_id,variant,count) VALUES($1,$2,$3,$4) ON CONFLICT (user_id,card_id,variant) DO UPDATE SET count=user_cards.count+$4 RETURNING count', [uid, cid, v, n]);
      return r ? Number(r.count) : 0;
    },
    async cardCount(uid, cid, v) { const r = await one('SELECT count FROM user_cards WHERE user_id=$1 AND card_id=$2 AND variant=$3', [uid, cid, v]); return r ? Number(r.count) : 0; },
    async packsOf(uid) { return (await db.query('SELECT * FROM user_packs WHERE user_id=$1 AND count>0', [uid])).rows.map((r) => ({ ...r, count: Number(r.count) })); },
    async packAdd(uid, pid, n = 1) {
      const r = await one('INSERT INTO user_packs(user_id,pack_id,count) VALUES($1,$2,$3) ON CONFLICT (user_id,pack_id) DO UPDATE SET count=user_packs.count+$3 RETURNING count', [uid, pid, n]);
      return r ? Number(r.count) : 0;
    },
    async marketList() { return (await db.query('SELECT * FROM market WHERE sold=false ORDER BY created DESC LIMIT 5000')).rows.map((r) => ({ ...r, price: Number(r.price) })); },
    async marketAdd(row) { return await one('INSERT INTO market(seller,card_id,variant,price) VALUES($1,$2,$3,$4) RETURNING *', [row.seller, row.card_id, row.variant, row.price]); },
    async marketGet(id) { const r = await one('SELECT * FROM market WHERE id=$1 AND sold=false', [Number(id)]); return r ? { ...r, price: Number(r.price) } : null; },
    async marketDrop(id) { await db.query('DELETE FROM market WHERE id=$1', [Number(id)]); },
    async tradeLog(r) { await db.query('INSERT INTO trades(seller,seller_name,buyer,buyer_name,card_id,variant,price) VALUES($1,$2,$3,$4,$5,$6,$7)', [r.seller, r.seller_name, r.buyer, r.buyer_name, r.card_id, r.variant, r.price]); },
    async trades(limit = 50) { return (await db.query('SELECT * FROM trades ORDER BY id DESC LIMIT $1', [limit])).rows.map((r) => ({ ...r, price: Number(r.price), created: new Date(r.created).getTime() })); },
    async tradesFor(cid, v) { return (await db.query('SELECT price, created, seller_name, buyer_name FROM trades WHERE card_id=$1 AND variant=$2 ORDER BY id DESC LIMIT 200', [cid, v])).rows.map((r) => ({ ...r, price: Number(r.price), created: new Date(r.created).getTime() })); },
    async gradedAdd(g) { return one('INSERT INTO graded(user_id,card_id,variant,grade) VALUES($1,$2,$3,$4) RETURNING *', [g.user_id, g.card_id, g.variant, g.grade]); },
    async gradedOf(uid) { return (await db.query('SELECT * FROM graded WHERE user_id=$1 ORDER BY id DESC', [uid])).rows; },
    async gradedGet(id) { return one('SELECT * FROM graded WHERE id=$1', [Number(id)]); },
    async gradedMove(id, uid) { return one('UPDATE graded SET user_id=$2 WHERE id=$1 RETURNING *', [Number(id), uid]); },
    async gradedAll() { return (await db.query('SELECT * FROM graded')).rows; },
    async giftAdd(g) { return one('INSERT INTO gifts(user_id,diamonds,pack,n,reason,source,message,xp,items) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [g.user_id, g.diamonds || 0, g.pack || null, g.n || 0, g.reason || '', g.source || 'support', g.message || null, g.xp || 0, g.items || null]); },
    async giftsOpen(uid) { return (await db.query('SELECT * FROM gifts WHERE user_id=$1 AND claimed=false ORDER BY id', [uid])).rows; },
    async giftClaim(id, uid) { return one('UPDATE gifts SET claimed=true WHERE id=$1 AND user_id=$2 AND claimed=false RETURNING *', [Number(id), uid]); },
    async ticketAdd(t) { const r = await one('INSERT INTO tickets(user_id,user_name,category,title,text,image) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status,created', [t.user_id, t.user_name, t.category, t.title, t.text, t.image || null]); return { ...t, ...r }; },
    async tickets() { return (await db.query('SELECT id,user_id,user_name,category,title,text,status,handler,reply,created,updated,(image IS NOT NULL) AS "hasImage" FROM tickets ORDER BY id DESC LIMIT 200')).rows.map((r) => ({ ...r, created: new Date(r.created).getTime(), updated: new Date(r.updated).getTime() })); },
    async ticketGet(id) { return one('SELECT * FROM tickets WHERE id=$1', [Number(id)]); },
    async ticketStatus(id, status, by, reply) { return one('UPDATE tickets SET status=$2, handler=$3, reply=COALESCE($4, reply), updated=now() WHERE id=$1 RETURNING *', [Number(id), status, by, reply || null]); },
    async setPass(id, pass) { await db.query('UPDATE users SET pass=$2 WHERE id=$1', [id, pass]); },
    async setAvatar(id, data) { return Number((await one('UPDATE users SET avatar=$2, av=av+1 WHERE id=$1 RETURNING av', [id, data])).av); },
    async allUsers() { return (await db.query('SELECT id, daily_day FROM users')).rows; },
    async activeUsers(since) { return (await db.query('SELECT id, name, last_seen, matches FROM users WHERE COALESCE(last_seen,0) > $1 AND COALESCE(matches,0) > 0', [since])).rows; }, // für Bedarfsprüfung (allUsers liefert nur id)
    async usersFull(limit = 500) { return (await db.query(`SELECT ${COLS} FROM users ORDER BY COALESCE(last_seen,0) DESC LIMIT $1`, [limit])).rows.map(num); }, // alle Felder außer Profilbild, z. B. fürs Einladen
    async passTop(season, n = 50) { return (await db.query(`SELECT ${COLS} FROM users WHERE pass_season=$1 AND pass_xp>0 ORDER BY pass_xp DESC LIMIT $2`, [season, n])).rows; },
    async recentUsers(n) { return (await db.query(`SELECT ${COLS} FROM users ORDER BY id DESC LIMIT $1`, [n])).rows.map(num); },
    async resetWheel() { const r = await db.query('UPDATE users SET wheel_used=0 WHERE wheel_used>0'); return r.rowCount; },
    async casinoRanking() { return (await db.query(`SELECT ${COLS} FROM users WHERE casino_rounds>0 ORDER BY casino_xp DESC LIMIT 20`)).rows.map(num); },
    async leaderboard() { return (await db.query(`SELECT ${COLS} FROM users WHERE matches>0 ORDER BY prestige DESC, xp DESC, wins DESC LIMIT 10`)).rows.map(num); },
    async worldRanking() { return (await db.query(`SELECT ${COLS} FROM users WHERE rank_points>0 ORDER BY rank_points DESC LIMIT 20`)).rows.map(num); },
    async pointsRanking() { return (await db.query(`SELECT ${COLS} FROM users WHERE matches>0 ORDER BY points DESC LIMIT 20`)).rows.map(num); },
    async searchUsers(q, limit) { const s = '%' + String(q || '').toLowerCase() + '%'; return (await db.query(`SELECT ${COLS} FROM users WHERE name_key LIKE $1 ORDER BY name LIMIT $2`, [s, limit || 50])).rows.map(num); },
    async countUsers() { return Number((await one('SELECT count(*) AS n FROM users')).n); },
    async addAiQuestions(list) {
      const out = [];
      for (const q of list) { const r = await one('INSERT INTO ai_questions(data) VALUES($1) RETURNING id', [JSON.stringify(q)]); out.push({ ...q, id: 'a' + r.id }); }
      return out;
    },
    async aiQuestions() { return (await db.query('SELECT id,data FROM ai_questions ORDER BY id DESC LIMIT 500')).rows.map((r) => ({ ...r.data, id: 'a' + r.id })); },
    async poolAll() { return (await db.query('SELECT id,data FROM ai_questions ORDER BY id')).rows.map((r) => ({ ...r.data, id: 'a' + r.id })); },
    async seenAdd(uids, qid) { for (const u of uids) await db.query('INSERT INTO user_seen(user_id,qid) VALUES($1,$2) ON CONFLICT DO NOTHING', [u, qid]); },
    async seenOf(uids) { if (!uids.length) return new Set(); return new Set((await db.query('SELECT DISTINCT qid FROM user_seen WHERE user_id = ANY($1)', [uids])).rows.map((r) => r.qid)); },
    async seenCounts(uid) { return new Set((await db.query('SELECT qid FROM user_seen WHERE user_id=$1', [uid])).rows.map((r) => r.qid)); },
    async seenAddMany(uids, qids) {
      let n = 0;
      for (const u of uids) {
        const r = await db.query('INSERT INTO user_seen(user_id,qid) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [u, qids]);
        n += r.rowCount;
      }
      return n;
    },
    async report(id, name) { const nm = String(name || '').replace(/,/g, ' ').slice(0, 30); await db.query(`INSERT INTO question_reports(qid,n,names,last_at,status) VALUES($1,1,$2,$3,'open') ON CONFLICT (qid) DO UPDATE SET n=question_reports.n+1, last_at=$3, status=CASE WHEN question_reports.status='kept' THEN 'open' ELSE question_reports.status END, names=CASE WHEN $2='' OR position(','||$2||',' in ','||question_reports.names||',')>0 THEN question_reports.names WHEN question_reports.names='' THEN $2 ELSE question_reports.names||','||$2 END`, [id, nm, Date.now()]); },
    async reportedIds() { return new Set((await db.query("SELECT qid FROM question_reports WHERE status<>'kept' AND (n>0 OR status='blocked')")).rows.map((r) => r.qid)); }, // gemeldet = gesperrt, bis der Admin entsperrt
    async reportList() { return (await db.query('SELECT qid, n, names, last_at, status FROM question_reports ORDER BY last_at DESC LIMIT 300')).rows.map((r) => ({ qid: r.qid, n: Number(r.n) || 0, names: String(r.names || '').split(',').filter(Boolean), at: Number(r.last_at) || 0, status: r.status || 'open' })); },
    async reportSet(qid, status) { await db.query(`UPDATE question_reports SET status=$2${status === 'kept' ? ', n=0' : ''} WHERE qid=$1`, [qid, status]); },
  };
}

module.exports = process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : memoryStore();
module.exports.ctx = ctx;
module.exports.dbStat = dbStat;
