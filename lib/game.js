const { pool } = require('./questions');
const themes = require('./themes');
const ai = require('./ai');
const progress = require('./progress');
const cards = require('./cards');

const MAX_MATCHES = Number(process.env.MAX_MATCHES || 2);
const MAX_PLAYERS = 6;
const REVEAL_MS = Number(process.env.REVEAL_MS || 9000);
const MIN_COUNTDOWN = Number(process.env.MIN_COUNTDOWN || 10);
const COLORS = ['#FFD23F', '#FF7A6B', '#4FD1C5', '#C4A5FF', '#8BE28B', '#FFA94D'];
const DEFAULTS = { pointLimit: 1000, maxQuestions: 25, countdown: 120, answerTime: 30 };
const ALL_THEMES = themes.list().map((t) => t.key);
const LIMITS = { pointLimit: [300, 5000], maxQuestions: [5, 50], countdown: [MIN_COUNTDOWN, 180], answerTime: [10, 60] };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// Punkte für eine Schätzung. Punktlandung x10, sehr nah dran x2, sonst 0-100 nach Nähe.
function scoreEstimate(q, guess) {
  const range = q.range || Math.abs(q.a) * 0.5;
  const d = Math.abs(guess - q.a);
  if (d < 1e-9) return { points: 500, exact: true, close: false, d };
  if (d <= range * 0.04) return { points: 200, exact: false, close: true, d };
  return { points: Math.max(0, Math.round(100 * (1 - d / range))), exact: false, close: false, d };
}

module.exports = function attach(io, store) {
  const matches = new Map(); // code -> match
  const userMatch = new Map(); // userId -> code
  const online = new Map(); // userId -> {name, n}
  const recent = []; // zuletzt gespielte Frage-IDs, damit sich Fragen nicht sofort wiederholen

  const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join(''); } while (matches.has(c)); return c; };

  function lobbies() {
    return {
      max: MAX_MATCHES, running: matches.size, online: online.size, onlineNames: [...online.values()].map((o) => o.name).slice(0, 12),
      open: [...matches.values()].map((m) => ({ code: m.code, host: m.players.get(m.hostId)?.name || '?', players: m.players.size, phase: m.phase, setup: m.setup, locked: !!m.password, ranked: m.ranked, qIndex: m.qIndex, qTotal: m.questions.length || m.settings.maxQuestions })),
    };
  }
  const pushLobbies = () => io.emit('lobbies', lobbies());

  function stateFor(m, uid) {
    const q = m.current;
    const revealed = m.phase === 'reveal' || m.phase === 'finished';
    return {
      code: m.code, phase: m.phase, hostId: m.hostId, you: uid, settings: m.settings, locked: !!m.password, ranked: m.ranked, setup: m.setup, chat: m.chat, themes: m.themes, themeList: themes.list(), maxThemes: themes.MAX_THEMES, password: uid === m.hostId ? m.password : undefined,
      summary: m.phase === 'finished' ? m.summaries[uid] || null : null, now: Date.now(), endsAt: m.endsAt, totalMs: m.totalMs,
      aiStatus: m.aiStatus, qIndex: m.qIndex, qTotal: m.questions.length || m.settings.maxQuestions,
      players: [...m.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, level: p.level, prestige: p.prestige, av: p.av, tag: p.tag, tagColor: p.tagColor, emblem: p.emblem, title: p.title, streak: p.streak, score: p.score, connected: p.sockets.size > 0, answered: p.answer !== null, gain: revealed ? p.gain : 0 })),
      question: q && m.phase !== 'lobby' && m.phase !== 'countdown' ? { type: q.t, text: q.q, unit: q.unit || '', cat: q.cat, ai: !!q.ai, options: q.t === 'mc' ? q.shown : undefined } : null,
      myAnswer: m.players.get(uid)?.answer ?? null,
      reveal: revealed && m.reveal ? m.reveal : null,
      reported: m.reportedBy.has(uid),
      winners: m.phase === 'finished' ? m.winners : null,
    };
  }
  function push(m) { for (const p of m.players.values()) for (const s of p.sockets) s.emit('state', stateFor(m, p.id)); }

  function timer(m, ms, fn) { clearTimeout(m.timer); m.totalMs = ms; m.endsAt = Date.now() + ms; m.timer = setTimeout(fn, ms); }

  async function prepareQuestions(m) {
    const total = m.settings.maxQuestions;
    const reported = await store.reportedIds().catch(() => new Set());
    const saved = await store.aiQuestions().catch(() => []);
    const skip = new Set([...reported, ...recent]);
    const themeMatch = (q) => m.ranked || m.themes.length === ALL_THEMES.length || m.themes.includes(themes.themeOf(q));
    const all = [...pool, ...saved].filter((q) => themeMatch(q) && !reported.has(q.id));
    // Bei wenigen Fragen im Thema lieber weniger Fragen spielen als themenfremde nehmen
    // Fragen, die in diesem Match schon dran waren, kommen zuletzt. Lieber kurze Runde als Wiederholung.
    if (m.asked.size >= all.length) m.asked.clear();
    const unseen = [...shuffle(all.filter((q) => !m.asked.has(q.id) && !skip.has(q.id))), ...shuffle(all.filter((q) => !m.asked.has(q.id) && skip.has(q.id)))];
    let cand = unseen.length >= 5 ? unseen : [...unseen, ...shuffle(all.filter((q) => m.asked.has(q.id)))];
    if (cand.length < 5) cand = shuffle([...pool, ...saved].filter((q) => !reported.has(q.id)));
    const want = Math.min(total, Math.max(5, cand.length));
    const mcWant = Math.round(want * 0.25);
    const mc = cand.filter((q) => q.t === 'mc').slice(0, mcWant);
    const est = cand.filter((q) => q.t === 'est').slice(0, want - mc.length);
    let chosen = [...est, ...mc];
    if (chosen.length < want) { // Mischung geht nicht auf, mit dem Rest auffüllen
      const taken = new Set(chosen.map((q) => q.id));
      chosen = [...chosen, ...cand.filter((q) => !taken.has(q.id)).slice(0, want - chosen.length)];
    }
    m.questions = shuffle(chosen).slice(0, want);
    for (const q of m.questions) m.asked.add(q.id);

    if (!ai.enabled()) { m.aiStatus = 'off'; return; }
    m.aiStatus = 'loading'; push(m);
    const themeList = m.ranked ? null : m.themes.map((k) => themes.byKey(k)).filter(Boolean);
    const fresh_n = Math.ceil(m.questions.length * 0.4);
    ai.generate(fresh_n, m.questions.map((q) => q.q), { themes: themeList, timeout: Math.max(15000, m.settings.countdown * 1000 - 4000) }).then(async (raw) => {
      const fresh = raw.filter(themeMatch);
      const stored = await store.addAiQuestions(fresh).catch(() => fresh.map((q, i) => ({ ...q, id: 'x' + Date.now() + i })));
      if (m.phase !== 'countdown' || !stored.length) { m.aiStatus = stored.length ? 'ready' : 'failed'; return; }
      // Frische KI-Fragen ersetzen einen Teil der Pool-Fragen
      const n = m.questions.length;
      const keep = m.questions.slice(0, Math.max(0, n - stored.length));
      m.questions = shuffle([...keep, ...stored]).slice(0, n);
      for (const q of m.questions) m.asked.add(q.id);
      m.aiStatus = 'ready'; push(m);
    }).catch((e) => { console.error('KI-Fragen fehlgeschlagen:', e.message); m.aiStatus = 'failed'; if (matches.has(m.code)) push(m); });
  }

  function startCountdown(m) {
    m.phase = 'countdown'; m.qIndex = 0; m.current = null; m.reveal = null; m.winners = null;
    for (const p of m.players.values()) { p.score = 0; p.gain = 0; p.answer = null; p.match = { answered: 0, exact: 0, close: 0, mc_right: 0, mc_total: 0, dev_sum: 0, dev_n: 0 }; }
    prepareQuestions(m).catch((e) => console.error(e));
    timer(m, m.settings.countdown * 1000, () => nextQuestion(m));
    push(m); pushLobbies();
  }

  function nextQuestion(m) {
    if (!m.questions.length) { m.questions = shuffle([...pool]).slice(0, m.settings.maxQuestions); }
    const src = m.questions[m.qIndex];
    if (!src) return finish(m);
    const q = { ...src }; // Kopie, damit parallele Matches sich nicht beeinflussen
    m.current = q; m.qIndex++; m.reveal = null; m.reportedBy = new Set();
    recent.push(q.id); if (recent.length > 120) recent.shift();
    if (q.t === 'mc') q.shown = shuffle([...q.o]);
    for (const p of m.players.values()) { p.answer = null; p.gain = 0; }
    m.phase = 'question';
    pushLobbies();
    timer(m, (q.t === 'mc' ? Math.min(20, m.settings.answerTime) : m.settings.answerTime) * 1000, () => endQuestion(m));
    push(m);
  }

  function endQuestion(m) {
    if (m.phase !== 'question') return;
    const q = m.current;
    const results = [];
    if (q.t === 'est') {
      let best = Infinity;
      for (const p of m.players.values()) if (p.answer !== null) best = Math.min(best, Math.abs(p.answer - q.a));
      const answered = [...m.players.values()].filter((p) => p.answer !== null).length;
      for (const p of m.players.values()) {
        if (p.answer === null) { results.push({ id: p.id, value: null, points: 0 }); continue; }
        const s = scoreEstimate(q, p.answer);
        const closest = answered > 1 && Math.abs(s.d - best) < 1e-9;
        if (closest && !s.exact) s.points += 25;
        p.gain = s.points; p.score += s.points;
        p.match.answered++; p.match.exact += s.exact ? 1 : 0; p.match.close += s.close ? 1 : 0;
        p.match.dev_sum += Math.min(5, s.d / Math.abs(q.a)); p.match.dev_n++;
        results.push({ id: p.id, value: p.answer, points: s.points, exact: s.exact, close: s.close, closest, dev: s.d / Math.abs(q.a) });
      }
      results.sort((a, b) => (a.value === null) - (b.value === null) || a.dev - b.dev);
      m.reveal = { answer: q.a, unit: q.unit || '', results };
    } else {
      for (const p of m.players.values()) {
        const right = p.answer !== null && q.shown[p.answer] === q.o[0];
        if (p.answer !== null) { p.match.answered++; p.match.mc_total++; p.match.mc_right += right ? 1 : 0; }
        p.gain = right ? 100 : 0; p.score += p.gain;
        results.push({ id: p.id, value: p.answer, points: p.gain, right });
      }
      m.reveal = { correctIndex: q.shown.indexOf(q.o[0]), results };
    }
    m.phase = 'reveal';
    const top = Math.max(...[...m.players.values()].map((p) => p.score));
    const over = top >= m.settings.pointLimit || m.qIndex >= m.questions.length;
    timer(m, REVEAL_MS, () => (over ? finish(m) : nextQuestion(m)));
    push(m);
  }

  function finish(m) {
    clearTimeout(m.timer); m.endsAt = null; m.phase = 'finished';
    const ps = [...m.players.values()];
    const top = Math.max(0, ...ps.map((p) => p.score));
    m.winners = ps.filter((p) => p.score === top && top > 0).map((p) => p.id);
    m.summaries = {};
    m.timer = setTimeout(() => destroy(m), 15 * 60 * 1000); // Aufräumen, falls niemand mehr zurück in die Lobby geht
    push(m); pushLobbies();
    Promise.all(ps.filter((p) => p.match).map(async (p) => {
      const r = { ...p.match, score: p.score, win: ps.length > 1 && m.winners.includes(p.id), counted: ps.length > 1,
        ranked: m.ranked && ps.length > 1, place: ps.filter((x) => x.score > p.score).length, players: ps.length }; p.match = null;
      const u = await store.userById(p.id); if (!u) return;
      const out = progress.applyMatch(u, r);
      await store.save(p.id, out.user);
      m.summaries[p.id] = out.summary; p.level = out.summary.levelAfter;
    })).catch((e) => console.error('Fortschritt speichern fehlgeschlagen:', e)).then(() => { if (matches.has(m.code) && m.phase === 'finished') push(m); });
  }

  function destroy(m) {
    clearTimeout(m.timer); clearTimeout(m.emptyTimer);
    for (const p of m.players.values()) { userMatch.delete(p.id); for (const s of p.sockets) s.emit('state', null); }
    matches.delete(m.code); pushLobbies();
  }

  function removePlayer(m, uid) {
    const p = m.players.get(uid); if (!p) return;
    m.players.delete(uid); userMatch.delete(uid);
    for (const s of p.sockets) s.emit('state', null);
    if (!m.players.size) return destroy(m);
    if (m.hostId === uid) m.hostId = [...m.players.values()].find((x) => x.sockets.size)?.id ?? [...m.players.keys()][0];
    checkAllAnswered(m); push(m); pushLobbies();
  }

  function checkAllAnswered(m) {
    if (m.phase !== 'question') return;
    const active = [...m.players.values()].filter((p) => p.sockets.size > 0);
    if (active.length && active.every((p) => p.answer !== null)) endQuestion(m);
  }

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const mine = () => matches.get(userMatch.get(user.id));
    const fail = (msg) => socket.emit('err', msg);
    const on = online.get(user.id) || { name: user.name, n: 0 }; on.n++; online.set(user.id, on); pushLobbies();

    // Wiedereinstieg nach Verbindungsabbruch
    const cur = mine();
    if (cur) { const p = cur.players.get(user.id); p.sockets.add(socket); clearTimeout(cur.emptyTimer); push(cur); }
    else socket.emit('state', null);
    socket.emit('lobbies', lobbies());

    socket.on('create', () => {
      if (mine()) return fail('Du bist schon in einem Match.');
      if (matches.size >= MAX_MATCHES) return fail(`Es laufen schon ${MAX_MATCHES} Matches. Warte, bis eines endet, oder tritt einem bei.`);
      const m = { code: newCode(), phase: 'lobby', hostId: user.id, players: new Map(), settings: { ...DEFAULTS }, questions: [], qIndex: 0, current: null, reveal: null, endsAt: null, aiStatus: ai.enabled() ? 'idle' : 'off', reportedBy: new Set(), winners: null, password: '', summaries: {}, ranked: false, themes: ALL_THEMES, setup: true, chat: [], asked: new Set() };
      matches.set(m.code, m);
      join(m).catch((e) => console.error(e));
    });

    async function join(m) {
      const u = (await store.userById(user.id)) || {};
      if (mine() || m.players.size >= MAX_PLAYERS || !matches.has(m.code)) return;
      const used = new Set([...m.players.values()].map((p) => p.color));
      m.players.set(user.id, { id: user.id, name: user.name, color: COLORS.find((c) => !used.has(c)), score: 0, gain: 0, answer: null, sockets: new Set([socket]),
        match: m.phase === 'countdown' ? { answered: 0, exact: 0, close: 0, mc_right: 0, mc_total: 0, dev_sum: 0, dev_n: 0 } : null,
        level: progress.levelInfo(u.xp || 0).level, prestige: u.prestige || 0, av: u.av || 0, tag: u.tag || '', tagColor: u.tag_color || '', emblem: u.emblem || '', streak: u.streak || 0,
        title: (() => { const t = cards.titleById(u.title); return t && cards.has(t, u) ? { id: u.title === 'secret' ? 'tsecret' : u.title, text: t.text, style: t.style } : null; })() });
      userMatch.set(user.id, m.code);
      if (!m.setup) { m.chat.push({ sys: true, text: user.name + ' ist beigetreten.', t: Date.now() }); if (m.chat.length > 60) m.chat.shift(); }
      push(m); pushLobbies();
    }

    socket.on('join', (arg) => {
      if (mine()) return fail('Du bist schon in einem Match.');
      const code = typeof arg === 'object' && arg ? arg.code : arg, pw = typeof arg === 'object' && arg ? String(arg.password || '') : '';
      const m = matches.get(String(code || '').toUpperCase().trim());
      if (!m) return fail('Kein Match mit diesem Code gefunden.');
      if (m.phase !== 'lobby' && m.phase !== 'countdown') return fail('Dieses Match läuft schon. Warte auf die nächste Runde.');
      if (m.setup) return fail('Der Host richtet das Match gerade erst ein.');
      if (m.players.size >= MAX_PLAYERS) return fail('Das Match ist voll (6 Spieler).');
      if (m.password && pw !== m.password) return socket.emit('needpw', { code: m.code, wrong: !!pw });
      join(m).catch((e) => console.error(e));
    });

    socket.on('leave', () => { const m = mine(); if (m) removePlayer(m, user.id); });

    socket.on('settings', (s) => {
      const m = mine(); if (!m || m.hostId !== user.id || m.phase !== 'lobby' || !s) return;
      if (typeof s.password === 'string') { m.password = s.password.trim().slice(0, 20); pushLobbies(); }
      if (typeof s.ranked === 'boolean') { m.ranked = s.ranked; m.themes = m.ranked ? ALL_THEMES : themes.valid(m.themes.slice(0, themes.MAX_THEMES)); pushLobbies(); }
      if (Array.isArray(s.themes) && !m.ranked) m.themes = themes.valid(s.themes);
      for (const k of Object.keys(LIMITS)) if (Number.isFinite(Number(s[k]))) m.settings[k] = clamp(Math.round(Number(s[k])), LIMITS[k]);
      push(m);
    });

    socket.on('create_done', () => {
      const m = mine(); if (!m || m.hostId !== user.id || m.phase !== 'lobby' || !m.setup) return;
      m.setup = false;
      m.chat.push({ sys: true, text: 'Match eröffnet. Freunde können jetzt beitreten.', t: Date.now() });
      push(m); pushLobbies();
    });

    // Chat: nur in der Lobby, im Countdown und am Ende, und nur solange das Match lebt
    let lastChat = 0;
    socket.on('chat', (txt) => {
      const m = mine(); if (!m || !['lobby', 'countdown', 'finished'].includes(m.phase)) return;
      const text = String(txt || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!text || Date.now() - lastChat < 700) return;
      lastChat = Date.now();
      const p = m.players.get(user.id);
      m.chat.push({ id: user.id, name: p.name, color: p.color, tag: p.tag, tagColor: p.tagColor, text, t: Date.now() });
      if (m.chat.length > 60) m.chat.splice(0, m.chat.length - 60);
      push(m);
    });

    socket.on('start', () => { const m = mine(); if (m && m.hostId === user.id && m.phase === 'lobby' && !m.setup) startCountdown(m); });

    // Host kann den Countdown abkürzen, sobald die Fragen fertig sind
    socket.on('skip', () => {
      const m = mine();
      if (m && m.hostId === user.id && m.phase === 'countdown' && m.questions.length) nextQuestion(m);
    });

    socket.on('answer', (v) => {
      const m = mine(); if (!m || m.phase !== 'question') return;
      const p = m.players.get(user.id); if (p.answer !== null) return;
      if (m.current.t === 'mc') { if (![0, 1, 2, 3].includes(v)) return; p.answer = v; }
      else { const x = Number(v); if (!Number.isFinite(x) || Math.abs(x) > 1e15) return; p.answer = x; }
      push(m); checkAllAnswered(m);
    });

    // Emotes: nach der eigenen Abgabe, bei der Auflösung und am Ende
    let lastEmote = 0;
    socket.on('emote', (i) => {
      const m = mine(); if (!m || ![0, 1, 2, 3, 4, 5].includes(i) || Date.now() - lastEmote < 600) return;
      const p = m.players.get(user.id);
      if (!(m.phase === 'reveal' || m.phase === 'finished' || (m.phase === 'question' && p.answer !== null))) return;
      lastEmote = Date.now();
      for (const pl of m.players.values()) for (const s of pl.sockets) s.emit('emote', { id: user.id, e: i });
    });

    socket.on('report', () => {
      const m = mine(); if (!m || m.phase !== 'reveal' || !m.current || m.reportedBy.has(user.id)) return;
      m.reportedBy.add(user.id); store.report(m.current.id).catch(() => {}); push(m);
    });

    socket.on('again', () => {
      const m = mine(); if (!m || m.hostId !== user.id || m.phase !== 'finished') return;
      clearTimeout(m.timer); m.phase = 'lobby'; m.setup = false; m.questions = []; m.current = null; m.reveal = null; m.winners = null; m.endsAt = null; m.summaries = {}; m.qIndex = 0;
      for (const p of [...m.players.values()]) { p.score = 0; p.gain = 0; p.answer = null; if (!p.sockets.size) { m.players.delete(p.id); userMatch.delete(p.id); } }
      push(m); pushLobbies();
    });

    socket.on('disconnect', () => {
      const o = online.get(user.id); if (o && --o.n <= 0) online.delete(user.id); pushLobbies();
      const m = mine(); if (!m) return;
      const p = m.players.get(user.id); p.sockets.delete(socket);
      if (p.sockets.size) return;
      if (m.phase === 'lobby' || m.phase === 'countdown') return removePlayer(m, user.id);
      if (![...m.players.values()].some((x) => x.sockets.size)) { clearTimeout(m.emptyTimer); m.emptyTimer = setTimeout(() => destroy(m), 90000); }
      else if (m.hostId === user.id) m.hostId = [...m.players.values()].find((x) => x.sockets.size).id;
      checkAllAnswered(m); if (matches.has(m.code)) push(m);
    });
  });

  return { matches, scoreEstimate, online, userMatch };
};
module.exports.scoreEstimate = scoreEstimate;
