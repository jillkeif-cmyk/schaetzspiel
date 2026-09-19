// Speichert Accounts, Fortschritt, KI-Fragen und Meldungen.
// Mit DATABASE_URL: Postgres. Ohne: Arbeitsspeicher (Daten weg nach Neustart, gut zum Testen).
const NUM_KEYS = ['matches', 'wins', 'answered', 'exact', 'close', 'mc_right', 'mc_total', 'points', 'dev_sum', 'dev_n', 'xp', 'prestige', 'best_score', 'streak', 'best_streak', 'av'];
const rank = (a, b) => b.prestige - a.prestige || b.xp - a.xp || b.wins - a.wins;

function memoryStore() {
  const users = new Map(), byId = new Map(), ai = [], reports = new Map(), fr = [];
  let uid = 0, qid = 0;
  return {
    kind: 'memory',
    async init() {},
    async createUser(name, pass) {
      const key = name.toLowerCase();
      if (users.has(key)) return null;
      const u = { id: ++uid, name, pass, avatar: null, ...Object.fromEntries(NUM_KEYS.map((k) => [k, 0])) };
      users.set(key, u); byId.set(u.id, u);
      return u;
    },
    async userByName(name) { return users.get(name.toLowerCase()) || null; },
    async userById(id) { return byId.get(id) || null; },
    async save(id, f) { const u = byId.get(id); if (u) for (const k of NUM_KEYS) if (k in f) u[k] = f[k]; },
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
    async leaderboard() { return [...byId.values()].filter((u) => u.matches > 0).sort(rank).slice(0, 10); },
    async addAiQuestions(list) { return list.map((q) => { const s = { ...q, id: 'a' + (++qid) }; ai.push(s); return s; }); },
    async aiQuestions() { return ai.slice(-500); },
    async report(id) { reports.set(id, (reports.get(id) || 0) + 1); },
    async reportedIds() { return new Set([...reports].filter(([, c]) => c >= 2).map(([k]) => k)); },
  };
}

function pgStore(url) {
  const { Pool } = require('pg');
  const db = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 5 });
  const one = async (sql, p) => (await db.query(sql, p)).rows[0] || null;
  const num = (u) => { if (u) for (const k of NUM_KEYS) u[k] = Number(u[k]); return u; };
  const COLS = 'id,name,pass,' + NUM_KEYS.join(','); // ohne avatar, der wird nur gezielt geladen
  return {
    kind: 'postgres',
    async init() {
      await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, name_key TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, created TIMESTAMPTZ DEFAULT now(), avatar TEXT)`);
      for (const k of NUM_KEYS) await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${k} ${k === 'dev_sum' ? 'DOUBLE PRECISION' : 'BIGINT'} DEFAULT 0`);
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
      await db.query(`CREATE TABLE IF NOT EXISTS ai_questions (id SERIAL PRIMARY KEY, data JSONB NOT NULL, created TIMESTAMPTZ DEFAULT now())`);
      await db.query(`CREATE TABLE IF NOT EXISTS friends (a INT NOT NULL, b INT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', PRIMARY KEY (a, b))`);
      await db.query(`CREATE TABLE IF NOT EXISTS question_reports (qid TEXT PRIMARY KEY, n INT DEFAULT 0)`);
    },
    async createUser(name, pass) {
      try { return num(await one(`INSERT INTO users(name,name_key,pass) VALUES($1,$2,$3) RETURNING ${COLS}`, [name, name.toLowerCase(), pass])); }
      catch (e) { if (e.code === '23505') return null; throw e; }
    },
    async userByName(name) { return num(await one(`SELECT ${COLS} FROM users WHERE name_key=$1`, [name.toLowerCase()])); },
    async userById(id, withAvatar) { return num(await one(`SELECT ${COLS}${withAvatar ? ',avatar' : ''} FROM users WHERE id=$1`, [id])); },
    async save(id, f) {
      const keys = NUM_KEYS.filter((k) => k in f); if (!keys.length) return;
      await db.query(`UPDATE users SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1`, [id, ...keys.map((k) => f[k])]);
    },
    async friendAdd(a, b) {
      const e = await one('SELECT * FROM friends WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)', [a, b]);
      if (!e) { await db.query('INSERT INTO friends(a,b) VALUES($1,$2)', [a, b]); return 'pending'; }
      if (e.status === 'pending' && e.a === b) { await db.query("UPDATE friends SET status='ok' WHERE a=$1 AND b=$2", [b, a]); return 'ok'; }
      return e.status;
    },
    async friendRespond(me, other, accept) { await db.query(accept ? "UPDATE friends SET status='ok' WHERE a=$1 AND b=$2 AND status='pending'" : "DELETE FROM friends WHERE a=$1 AND b=$2 AND status='pending'", [other, me]); },
    async friendRemove(me, other) { await db.query('DELETE FROM friends WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)', [me, other]); },
    async friendList(me) { return (await db.query('SELECT * FROM friends WHERE a=$1 OR b=$1', [me])).rows.map((x) => ({ id: x.a === me ? x.b : x.a, status: x.status === 'ok' ? 'ok' : x.a === me ? 'out' : 'in' })); },
    async setPass(id, pass) { await db.query('UPDATE users SET pass=$2 WHERE id=$1', [id, pass]); },
    async setAvatar(id, data) { return Number((await one('UPDATE users SET avatar=$2, av=av+1 WHERE id=$1 RETURNING av', [id, data])).av); },
    async leaderboard() { return (await db.query(`SELECT ${COLS} FROM users WHERE matches>0 ORDER BY prestige DESC, xp DESC, wins DESC LIMIT 10`)).rows.map(num); },
    async addAiQuestions(list) {
      const out = [];
      for (const q of list) { const r = await one('INSERT INTO ai_questions(data) VALUES($1) RETURNING id', [JSON.stringify(q)]); out.push({ ...q, id: 'a' + r.id }); }
      return out;
    },
    async aiQuestions() { return (await db.query('SELECT id,data FROM ai_questions ORDER BY id DESC LIMIT 500')).rows.map((r) => ({ ...r.data, id: 'a' + r.id })); },
    async report(id) { await db.query('INSERT INTO question_reports(qid,n) VALUES($1,1) ON CONFLICT (qid) DO UPDATE SET n=question_reports.n+1', [id]); },
    async reportedIds() { return new Set((await db.query('SELECT qid FROM question_reports WHERE n>=2')).rows.map((r) => r.qid)); },
  };
}

module.exports = process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : memoryStore();
