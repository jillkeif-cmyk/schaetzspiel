// Simuliert ein komplettes Match mit 3 Spielern gegen einen lokalen Server.
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const PORT = 3999, URL = 'http://localhost:' + PORT;
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, REVEAL_MS: 200, MIN_COUNTDOWN: 1, INVITE_CODE: 'test', SECRET: 's', DATABASE_URL: '', ANTHROPIC_API_KEY: '' }, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b) => fetch(URL + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

(async () => {
  await sleep(1200);
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

  let seen = 0, shown = false, lastQ = 0;
  socks[0].emit('start');
  const t0 = Date.now();
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
  console.log('  Endstand:', states[0].players.map((p) => p.name + ' ' + p.score).join(', '), '| Sieger:', states[0].winners);
  const home = await fetch(URL + '/api/home', { headers: { authorization: 'Bearer ' + users[0].token } }).then((r) => r.json());
  assert.equal(home.me.matches, 1); assert.ok(home.leaderboard.length === 3);

  // Match-Limit: zweites Match geht, drittes nicht
  socks[1].emit('leave'); socks[2].emit('leave'); await sleep(200);
  assert.equal(states[1], null);
  socks[1].emit('create'); await sleep(200); assert.ok(states[1].code);
  socks[1].emit('create_done'); await sleep(120);
  // Match-Limit: mit weiteren Konten so lange eröffnen, bis der Server abwinkt
  let err = null;
  const extra = [];
  for (let i = 0; i < 5; i++) {
    const u = await post('/api/register', { name: 'Limit' + i, password: 'geheim1', code: 'TEST' });
    const sx = io(URL, { auth: { token: u.token } });
    sx.on('err', (e) => { if (/Matches/.test(e)) err = e; });
    extra.push(sx); await sleep(150);
    sx.emit('create'); await sleep(220);
  }
  assert.ok(err && /Matches/.test(err), 'Match-Limit greift nicht');
  for (const sx of extra) sx.close();
  await sleep(200);
  assert.ok(home.me.level >= 1 && home.progress.challenges.length === 8 && states[0].summary.gained > 0, 'XP-Zusammenfassung fehlt');
  // Passwortschutz
  socks[1].emit('settings', { password: 'geheim' }); await sleep(100);
  let need = null; socks[0].on('needpw', (d) => { need = d; });
  socks[0].emit('leave'); await sleep(150); socks[0].emit('join', states[1].code); await sleep(150);
  assert.ok(need && !need.wrong && states[0] === null, 'Beitritt ohne Passwort muss scheitern');
  socks[0].emit('join', { code: states[1].code, password: 'falsch' }); await sleep(150); assert.ok(need.wrong);
  socks[0].emit('join', { code: states[1].code, password: 'geheim' }); await sleep(200);
  assert.ok(states[0] && states[0].locked && states[0].password === undefined && states[1].password === 'geheim');
  socks[0].emit('leave'); await sleep(150);
  // Wiedereinstieg mitten im Spiel
  socks[1].emit('chat', '  hallo   zusammen  '); await sleep(150);
  assert.ok(states[1].chat.some((c) => c.text === 'hallo zusammen'), 'Chat-Nachricht fehlt');
  socks[1].emit('settings', { countdown: 1, maxQuestions: 5 }); socks[1].emit('start'); await sleep(1500);
  assert.equal(states[1].phase, 'question');
  socks[1].disconnect(); await sleep(200);
  const again = io(URL, { auth: { token: users[1].token } }); let back = null; again.on('state', (s) => { back = s; }); await sleep(400);
  assert.ok(back && back.code === states[1].code, 'Wiedereinstieg fehlgeschlagen');
  again.disconnect();
  console.log('OK: alle Prüfungen bestanden');
})().catch((e) => { console.error('FEHLER:', e); process.exitCode = 1; }).finally(() => { srv.kill(); setTimeout(() => process.exit(), 200); });
