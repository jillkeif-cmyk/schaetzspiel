// Simuliert ein komplettes Match mit 3 Spielern gegen einen lokalen Server.
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const PORT = 3999, URL = 'http://localhost:' + PORT;
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, REVEAL_MS: 200, MIN_COUNTDOWN: 1, INVITE_CODE: 'test', MATCH_SAVE_DELAY: 2500, ADMIN_NAME: 'nick', SECRET: 's', DATABASE_URL: '', ANTHROPIC_API_KEY: '' }, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b) => fetch(URL + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

(async () => {
  for (let i = 0; i < 150; i++) { try { const r = await fetch(URL + '/api/version'); if (r.ok) break; } catch (e) {} await sleep(100); } // warten, bis der Server antwortet
  assert.equal((await post('/api/register', { name: 'X', password: 'geheim1', code: 'falsch' })).status, 403);
  const users = [];
  for (const name of ['Nick', 'Pascal', 'Kollege']) users.push(await post('/api/register', { name, password: 'geheim1', code: 'TEST' }));
  assert.equal((await post('/api/register', { name: 'nick', password: 'geheim1', code: 'test' })).status, 409);
  assert.equal((await post('/api/login', { name: 'Nick', password: 'falsch' })).status, 401);
  assert.ok((await post('/api/login', { name: 'nick', password: 'geheim1' })).token);

  const states = [], socks = users.map((u, i) => { const s = io(URL, { auth: { token: u.token } }); s.on('state', (st) => { states[i] = st; }); s.on('err', (e) => console.log('  err[' + i + ']:', e)); return s; });
  await sleep(400);
  socks[0].emit('create'); await sleep(200);
  const code = states[0].code; assert.equal(states[0].phase, 'lobby');
  assert.equal(states[0].setup, true, 'Match startet in der Einrichtung');
  socks[0].emit('create_done'); await sleep(150); assert.equal(states[0].setup, false);
  socks[1].emit('join', code.toLowerCase()); socks[2].emit('join', code); await sleep(200);
  assert.equal(states[0].players.length, 3);
  socks[1].emit('settings', { maxQuestions: 5 }); await sleep(100); // kein Host -> ignoriert
  assert.equal(states[0].settings.maxQuestions, 25);
  socks[0].emit('settings', { maxQuestions: 6, countdown: 1, pointLimit: 5000, answerTime: 10 }); await sleep(100);
  assert.equal(states[1].settings.maxQuestions, 6);

  await fetch(URL + '/api/admin/passmode', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + users[0].token }, body: JSON.stringify({ mode: 'on' }) }); // Pass ist anfangs gesperrt
  let seen = 0, shown = false, lastQ = 0;
  socks[0].emit('start');
  const t0 = Date.now();
  const auth = (t) => ({ method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t } });
  while (states[0].phase !== 'finished' && Date.now() - t0 < 30000) {
    await sleep(50);
    const st = states[0];
    if (st.phase === 'question' && st.qIndex !== lastQ) {
      lastQ = st.qIndex; seen++;
      assert.ok(!('a' in st.question) && !st.reveal, 'Antwort darf vor dem Aufdecken nicht sichtbar sein');
      if (st.question.type === 'mc') socks.forEach((s, i) => s.emit('answer', i));
      else socks.forEach((s, i) => s.emit('answer', [100, 2000, 5][i]));
    }
    if (st.phase === 'reveal' && st.question.type === 'est' && !shown) { shown = true; assert.equal(st.reveal.results.length, 3); assert.ok(st.reveal.results[0].dev <= st.reveal.results[1].dev); console.log('  Beispiel-Auflösung:', JSON.stringify(st.reveal)); }
  }
  assert.equal(states[0].phase, 'finished'); assert.equal(seen, 6);
  // Während die Auswertung läuft, bekommt Nick woanders 777.777 Diamanten und 1.500 Pass-XP
  console.log('  Admin Diamanten:', JSON.stringify(await fetch(URL + '/api/admin/diamonds', { ...auth(users[0].token), body: JSON.stringify({ id: users[0].me.id, diamonds: 777777 }) }).then((r) => r.json())).slice(0, 120));
  await fetch(URL + '/api/admin/passxp', { ...auth(users[0].token), body: JSON.stringify({ xp: 1500 }) });
  await sleep(3500);
  const h = await fetch(URL + '/api/home', { headers: { authorization: 'Bearer ' + users[0].token } }).then((r) => r.json());
  const pv = await fetch(URL + '/api/pass', { headers: { authorization: 'Bearer ' + users[0].token } }).then((r) => r.json());
  console.log('  Diamanten nach Match:', h.me.diamonds, '| Pass-XP:', pv.xp, '| Matches:', h.me.matches, '| XP:', h.me.xp);
  assert.ok(h.me.diamonds >= 777777, 'Diamanten aus der Zwischenzeit wurden überschrieben');
  assert.ok(pv.xp > 1500, 'Pass-XP aus der Zwischenzeit wurden überschrieben');
  assert.equal(h.me.matches, 1);
  console.log('OK: nichts überschrieben'); srv.kill(); process.exit(0);
})().catch((e) => { console.error('FEHLER:', e.message); srv.kill(); process.exit(1); });
