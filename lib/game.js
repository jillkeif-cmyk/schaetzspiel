const { pool: rawPool } = require('./questions');
const sim = require('./similar');
const hot = require('./hottime');
const { CLASSICS } = sim; // gesperrte Klassiker, gemeinsam mit dem Pool
// Doppelte und fast gleiche Fragen im festen Pool nur einmal behalten
const pool = (() => { const out = []; for (const q of rawPool) { if (out.some((x) => sim.nearlyIdentical(x.q, q.q))) continue; out.push(q); } return out; })();
const themes = require('./themes');
const { graceActive } = require('./event');
const webpush = require('./push');
const tcg = require('./tcg');
const ai = require('./ai');
const progress = require('./progress');
const cards = require('./cards');
const frames = require('./frames');

const MAX_MATCHES = Number(process.env.MAX_MATCHES || 4);
const MAX_PLAYERS = 8;
const REVEAL_MS = Number(process.env.REVEAL_MS || 9000);
const MIN_COUNTDOWN = Number(process.env.MIN_COUNTDOWN || 10);
const COLORS = ['#FFD23F', '#FF7A6B', '#4FD1C5', '#C4A5FF', '#8BE28B', '#FFA94D', '#FF79C6', '#5AA9FF'];
const DEFAULTS = { pointLimit: 1000, maxQuestions: 25, countdown: 120, answerTime: 30 };
const WAIT_EXTRA_MS = 360000; // beim Warten wird notfalls bis zu 6 Minuten gewartet
const hasQ = (key) => pool.some((q) => themes.themeOf(q) === key);
const themeList = () => themes.list(hasQ);
const allThemes = () => themeList().map((t) => t.key);
const defaultThemes = () => themeList().filter((t) => !t.event).map((t) => t.key);
const LIMITS = { pointLimit: [300, 10000], maxQuestions: [5, 50], countdown: [MIN_COUNTDOWN, 180], answerTime: [8, 60] };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// Punkte für eine Schätzung. Punktlandung x10, sehr nah dran x2, sonst 0-100 nach Nähe.
function scoreEstimate(q, guess) {
  const range = q.range || Math.abs(q.a) * 0.4;
  const d = Math.abs(guess - q.a);
  if (d < 1e-9) return { points: 300, exact: true, close: false, d };
  if (d <= range * 0.04) return { points: 200, exact: false, close: true, d };
  // quadratischer Abfall: weit daneben gibt deutlich weniger
  const near = Math.max(0, 1 - d / range);
  return { points: Math.round(100 * near * near), exact: false, close: false, d };
}

module.exports = function attach(io, store) {
  const qpool = require('./pool')(store); // Fragen-Pool (dauerhaft, in der Datenbank)
  qpool.load();
  const matches = new Map(); // code -> match
  const userMatch = new Map(); // userId -> code
  const online = new Map(); // userId -> {name, n, sockets}
  const where = new Map(); // userId -> vom Client gemeldete Seite
  const hooks = { table: () => null, progress: () => {} }; // vom Server gesetzt: sitzt jemand am Blackjack-Tisch?
  const PAGE_TXT = { home: 'im Hauptmenü', casino: 'im Casino', 'casino:roulette': 'spielt Roulette', 'casino:bj': 'spielt Blackjack', 'casino:vip': 'am Glücksrad', 'casino:rewards': 'schaut Casino-Belohnungen', 'casino:crank': 'schaut die Casino-Rangliste', 'casino:tables': 'sucht einen Blackjack-Tisch', 'casino:poker': 'schaut beim Poker zu', cards: 'bei Karten & Booster', ranks: 'schaut die Ranglisten', profile: 'bearbeitet sein Profil' };
  const idle = new Set(); // wer seit ein paar Minuten nichts mehr gedrückt hat
  function activityOf(id) {
    const m = matches.get(userMatch.get(id));
    if (m) {
      const kind = m.solo ? 'Solo' : m.ranked ? 'Rangliste' : m.password ? 'private Runde' : 'offene Runde';
      if (m.phase === 'lobby' || m.phase === 'countdown') return `wartet in der Lobby (${kind})`;
      if (m.phase === 'finished') return 'schaut den Endstand an';
      return `spielt ein Match (${kind})`;
    }
    const tb = hooks.table(id); if (tb) return typeof tb === 'string' ? tb : 'sitzt am Blackjack-Tisch';
    return PAGE_TXT[where.get(id)] || PAGE_TXT[String(where.get(id) || '').split(':')[0]] || 'online';
  }
  const seen = new Map(); // Frage-ID -> Zähler, wann sie zuletzt dran war
  let tick = 0;
  const lastAsked = []; // Fragetexte der letzten Matches, damit die KI sie meidet

  const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join(''); } while (matches.has(c)); return c; };

  function lobbies() {
    return {
      max: MAX_MATCHES, maxPlayers: MAX_PLAYERS, running: matches.size, online: online.size, onlineNames: [...online.values()].map((o) => o.name).slice(0, 12), onlinePeople: [...online.entries()].slice(0, 20).map(([id, o]) => ({ id, idle: idle.has(id), name: o.name, act: activityOf(id) })),
      open: [...matches.values()].filter((m) => !m.solo || (m.phase !== 'lobby' && m.phase !== 'finished')).map((m) => ({ code: m.code, host: m.players.get(m.hostId)?.name || '?', players: m.players.size, phase: m.phase, setup: m.setup, locked: !!m.password, ranked: m.ranked, solo: !!m.solo, qIndex: m.qIndex, qTotal: m.questions.length || m.settings.maxQuestions })),
    };
  }
  const pushLobbies = () => io.emit('lobbies', lobbies());
  let presenceTimer = null;

  function stateFor(m, uid, watching = false) {
    const q = m.current;
    const revealed = m.phase === 'reveal' || m.phase === 'finished';
    return {
      code: m.code, phase: m.phase, hostId: m.hostId, you: uid, watching, watchers: m.watchers.size, solo: !!m.solo,
      live: watching && m.solo && m.phase === 'question' ? (() => { const p = [...m.players.values()][0]; return { typing: m.liveInput || '', answer: p && p.answer !== null && p.answer !== undefined ? p.answer : null, name: p ? p.name : '' }; })() : null,
      bets: [...m.bets.entries()].map(([id, amount]) => ({ id, name: (m.players.get(id) || {}).name || '?', amount })),
      betNote: (m.betNotes || []).filter((x) => x.id === uid).map((x) => x.text).join(' · ') || null, maxPlayers: MAX_PLAYERS, settings: m.settings, locked: !!m.password, ranked: m.ranked, waitAi: m.waitAi, setup: m.setup, chat: m.chat, themes: m.themes, themeList: themeList(), maxThemes: themes.MAX_THEMES, password: uid === m.hostId ? m.password : undefined,
      summary: m.phase === 'finished' ? m.summaries[uid] || null : null, now: Date.now(), endsAt: m.endsAt, totalMs: m.totalMs,
      aiStatus: m.aiStatus, fromPool: !!m.fromPool, waitingMore: !!m.waitingMore, startWhenReady: !!m.startWhenReady, readyGo: !!m.readyGo, qIndex: m.qIndex, qTotal: m.questions.length || m.settings.maxQuestions,
      players: [...m.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, level: p.level, prestige: p.prestige, presShown: p.presShown, av: p.av, tag: p.tag, tagColor: p.tagColor, frame: p.frame, frameAnim: p.frameAnim, emblem: p.emblem, title: p.title, streak: p.streak, score: p.score, connected: p.sockets.size > 0, answered: p.answer !== null, gain: revealed ? p.gain : 0 })),
      question: q && m.phase !== 'lobby' && m.phase !== 'countdown' ? { type: q.t, text: q.q, unit: q.unit || '', cat: q.cat, ai: !!q.ai, options: q.t === 'mc' ? q.shown : undefined } : null,
      myAnswer: m.players.get(uid)?.answer ?? null,
      reveal: revealed && m.reveal ? m.reveal : null,
      reported: m.reportedBy.has(uid),
      solo: !!m.solo, winners: m.phase === 'finished' ? m.winners : null, drops: m.phase === 'finished' ? m.drops || [] : [],
    };
  }
  function push(m) {
    for (const p of m.players.values()) for (const s of p.sockets) s.emit('state', stateFor(m, p.id));
    for (const w of m.watchers.values()) for (const s of w.sockets) s.emit('state', stateFor(m, w.id, true));
  }

  function timer(m, ms, fn) { clearTimeout(m.timer); m.totalMs = ms; m.endsAt = Date.now() + ms; m.timer = setTimeout(fn, ms); }

  // Fragen schon in der Pre-Lobby anfordern, damit beim Start alles bereitliegt
  function prepQueue(m) {
    if (!matches.has(m.code) || m.phase !== 'lobby' || m.setup) return;
    clearTimeout(m.prepTimer);
    m.prepTimer = setTimeout(() => {
      if (!matches.has(m.code) || m.phase !== 'lobby' || m.setup || m.prepDone) return;
      m.prepDone = true;
      prepareQuestions(m).catch((e) => console.error(e));
    }, 1200);
  }

  async function prepareQuestions(m) {
    const total = m.settings.maxQuestions;
    const reported = await store.reportedIds().catch(() => new Set());
    const saved = await store.aiQuestions().catch(() => []);

    const themeMatch = (q) => (m.ranked ? themes.RANKED.includes(themes.themeOf(q)) : m.themes.length === allThemes().length || m.themes.includes(themes.themeOf(q)));
    const all = [...pool, ...saved].filter((q) => themeMatch(q) && !reported.has(q.id));
    // Bei wenigen Fragen im Thema lieber weniger Fragen spielen als themenfremde nehmen
    // Fragen, die in diesem Match schon dran waren, kommen zuletzt. Lieber kurze Runde als Wiederholung.
    if (m.asked.size >= all.length) m.asked.clear();
    // am längsten nicht gespielte Fragen zuerst, damit sich nichts über mehrere Matches wiederholt
    // am längsten nicht gespielte zuerst, innerhalb gleicher Stufe zufällig
    const bucket = (q) => Math.floor((seen.get(q.id) || 0) / 6);
    // Fragen, die zuletzt irgendwo gestellt wurden (auch umformuliert), möglichst meiden
    const history = await store.askedAll(800).catch(() => []);
    const recentIdx = sim.makeIndex(history.slice(0, 300));
    const notRecent = all.filter((q) => !sim.inIndex(recentIdx, q));
    const base = notRecent.length >= Math.max(5, total) ? notRecent : all;
    const unseen = shuffle(base.filter((q) => !m.asked.has(q.id))).sort((x, y) => bucket(x) - bucket(y));
    let cand = unseen.length >= 5 ? unseen : [...unseen, ...shuffle(all.filter((q) => m.asked.has(q.id)))];
    if (cand.length < 5) cand = shuffle([...pool, ...saved].filter((q) => !reported.has(q.id)));
    const want = Math.min(total, Math.max(5, cand.length));
    // Gleichmäßig auf die gewählten Themen verteilen, sonst gewinnt der größte Pool
    if (!m.ranked && m.themes.length > 1) {
      const buckets = new Map(m.themes.map((k) => [k, []]));
      for (const q of cand) { const b = buckets.get(themes.themeOf(q)); if (b) b.push(q); }
      const mixed = [];
      for (let i = 0; mixed.length < cand.length; i++) {
        let added = false;
        for (const k of shuffle([...m.themes])) { const b = buckets.get(k); if (b && b[i]) { mixed.push(b[i]); added = true; } }
        if (!added) break;
      }
      cand = mixed.length ? mixed : cand;
    }
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

    if (!ai.enabled() || (m.themes.length === 1 && m.themes[0] === 'grace')) { m.aiStatus = 'off'; if (m.phase === 'countdown' && m.startWhenReady && !m.readyGo) { m.readyGo = true; timer(m, 4000, () => nextQuestion(m)); push(m); } return; }
    m.waitAi = true; // nur frische Fragen: immer warten, bis sie da sind
    m.aiStatus = 'loading'; push(m);
    const themeList = m.ranked ? null : m.themes.map((k) => themes.byKey(k)).filter(Boolean);
    const fresh_n = Math.max(5, total);
    const tries = 4; // so oft nachfragen, bis genug neue Fragen beisammen sind
    const known = history;
    // Zum Text im Gedächtnis die Antwort dazuholen, damit auch Umformulierungen mit gleicher Antwort auffallen
    const nkey = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
    const byText = new Map([...pool, ...saved].map((q) => [nkey(q.q), q]));
    const knownIdx = sim.makeIndex([...known.slice(0, 600).map((t) => byText.get(nkey(t)) || t), ...CLASSICS]);
    // bereits gestellte Fragen aussortieren, sonst zählt die Runde nicht als frisch
    const fresh_ok = async (list) => {
      const out = [];
      for (const q of list) {
        if (!q || !q.q) continue;
        if (out.some((x) => sim.similar(x.q, q.q, x.a, q.a))) continue; // doppelt in dieser Lieferung
        if (sim.inIndex(knownIdx, q)) continue; // schon mal gestellt, auch umformuliert
        if (await store.askedHas(q.q).catch(() => false)) continue;
        out.push(q);
      }
      return out;
    };
    // Jede fertige Portion sofort verarbeiten: ab 5 frischen Fragen kann es losgehen, der Rest kommt während des Spiels dazu
    const START_MIN = Math.min(5, total);
    let have = [], chain = Promise.resolve();
    m.fromPool = false;
    if ((await store.setting('question_source')) === 'pool') {
      const keys = m.ranked ? themes.RANKED : m.themes;
      const seenAll = await store.seenOf([...m.players.keys()]).catch(() => new Set());
      have = qpool.pick(keys, seenAll, reported, total);
      console.log(`Pool: ${have.length} von ${total} ungesehenen Fragen für ${m.players.size} Spieler`);
      if (have.length >= START_MIN) {
        m.questions = have.slice(0, total); for (const q of m.questions) m.asked.add(q.id); m.fromPool = true;
        const wasWaiting = m.aiStatus === 'waiting'; m.aiStatus = 'ready'; if (wasWaiting) m.startWhenReady = true; push(m); readyGo(m);
      }
      if (have.length >= total) { m.fetching = false; return; } // Pool reicht, keine KI nötig
    }
    m.fetching = true;
    const seenByPlayers = await store.seenOf([...m.players.keys()]).catch(() => new Set()); // auch live: nichts, was jemand inhaltlich schon hatte
    const liveAdded = [];
    const take = (list) => { chain = chain.then(async () => {
      if (!matches.has(m.code) || !list || !list.length) return;
      // Höchstens eine Frage pro Hauptgegenstand (Person, Werk, Ort) in einer Runde
      const subj = (q) => String(q.s || '').toLowerCase().replace(/[^a-z0-9äöüß ]/g, '').trim();
      const names = (q) => new Set((String(q.q).match(/(?<=\s)[A-ZÄÖÜ][a-zäöüß]{3,}(?:\s[A-ZÄÖÜ][a-zäöüß]{2,})*/g) || []).map((x) => x.toLowerCase()));
      const taken = new Set(have.map(subj).filter(Boolean)), takenNames = new Map();
      for (const x of have) for (const n of names(x)) takenNames.set(n, (takenNames.get(n) || 0) + 1);
      const diverse = [];
      for (const q of list) {
        const k = subj(q);
        if (k && taken.has(k)) continue;
        if ([...names(q)].some((n) => (takenNames.get(n) || 0) >= 2)) continue; // derselbe Name höchstens zweimal im Text
        if (k) taken.add(k);
        for (const n of names(q)) takenNames.set(n, (takenNames.get(n) || 0) + 1);
        diverse.push(q);
      }
      const ok = await fresh_ok(diverse.filter((q) => themeMatch(q) && !sim.isClassic(q) && !qpool.seenContent(q, seenByPlayers) && !have.some((x) => sim.similar(x.q, q.q, x.a, q.a))));
      if (!ok.length) return;
      for (const q of ok) q.theme = m.ranked ? 'allgemein' : m.themes.length === 1 ? m.themes[0] : themes.themeOf(q);
      const stored = await store.addAiQuestions(ok).catch(() => ok.map((q, i) => ({ ...q, id: 'x' + Date.now() + i })));
      liveAdded.push(...stored.filter((q) => String(q.id).startsWith('a'))); // Live-Fragen landen im Pool, gemeldet wird gesammelt
      have = [...have, ...stored];
      console.log(`KI-Prüfung: ${list.length} geliefert, ${have.length} von ${total} frisch und neu`);
      if (m.phase === 'lobby' || m.phase === 'countdown') {
        if (have.length < START_MIN) return;
        m.questions = have.slice(0, total); // nur frische Fragen, kein Pool
        for (const q of m.questions) m.asked.add(q.id);
        if (m.aiStatus !== 'ready') { const wasWaiting = m.aiStatus === 'waiting'; m.aiStatus = 'ready'; if (wasWaiting) m.startWhenReady = true; push(m); readyGo(m); }
      } else if (m.phase !== 'finished') {
        // Spiel läuft schon: neue Fragen hinten anhängen, bis die gewünschte Zahl erreicht ist
        for (const q of stored) { if (m.questions.length >= total) break; if (!m.questions.some((x) => x.id === q.id)) { m.questions.push(q); m.asked.add(q.id); } }
        if (m.waitingMore) { m.waitingMore = false; clearTimeout(m.timer); nextQuestion(m); }
      }
    }).catch((e) => console.error('KI-Portion:', e.message)); return chain; };
    const run = async (n) => {
      const need = total - have.length;
      if (need <= 0) return;
      try {
        const ask = Math.min(40, Math.ceil(need * 1.5) + 2); // etwas mehr, weil beim Prüfen welche wegfallen
        await ai.generate(ask, [...lastAsked.slice(-30).reverse(), ...known.slice(0, 40)], { themes: themeList, timeout: 150000, onChunk: take, effort: 'medium' });
        await chain;
      } catch (e) { console.error('KI-Versuch ' + n + ' fehlgeschlagen:', e.message); }
      if (have.length >= total || n >= tries || !matches.has(m.code) || m.phase === 'finished') return;
      await new Promise((r) => setTimeout(r, 1000));
      return run(n + 1);
    };
    run(1).then(async () => {
      await chain;
      m.fetching = false;
      if (liveAdded.length) qpool.addLive(liveAdded, m.ranked ? 'Rangliste' : m.themes.length > 4 ? `gemischt, ${m.themes.length} Kategorien` : m.themes.map((k) => (themes.byKey(k) || {}).name || k).join(', '));
      if (!matches.has(m.code)) return;
      if (have.length >= START_MIN || m.aiStatus === 'ready') { if (m.waitingMore) { m.waitingMore = false; clearTimeout(m.timer); nextQuestion(m); } return; }
      // KI hat nicht genug geliefert: Notlösung mit dem, was da ist, sonst Pool
      if (have.length) m.questions = have.slice(0, total);
      m.aiStatus = 'failed'; push(m);
      if (m.phase === 'countdown' && m.startWhenReady) timer(m, 1500, () => nextQuestion(m));
    }).catch((e) => { m.fetching = false; console.error('KI-Fragen fehlgeschlagen:', e.message); m.aiStatus = 'failed'; if (matches.has(m.code)) { push(m); if (m.phase === 'countdown' && m.startWhenReady) timer(m, 1500, () => nextQuestion(m)); } });
  }

  // Frische Fragen sind da und der Start ist vorgemerkt: noch 5 Sekunden, dann geht es los
  function readyGo(m) {
    if (m.phase !== 'countdown' || m.readyGo) return;
    if (!(m.startWhenReady || m.aiStatus === 'waiting')) return; // sonst läuft der normale Countdown weiter
    m.readyGo = true; m.totalMs = 5000;
    timer(m, 5000, () => nextQuestion(m));
    push(m);
  }
  function startCountdown(m) {
    m.phase = 'countdown'; m.qIndex = 0; m.current = null; m.reveal = null; m.winners = null; m.drops = []; m.readyGo = false; m.startWhenReady = !!m.solo;
    for (const p of m.players.values()) { p.score = 0; p.gain = 0; p.answer = null; p.match = { answered: 0, exact: 0, close: 0, mc_right: 0, mc_total: 0, dev_sum: 0, dev_n: 0 }; }
    if (!m.prepDone) { m.prepDone = true; prepareQuestions(m).catch((e) => console.error(e)); }
    const startAt = Date.now();
    const go = () => {
      // Auf frische KI-Fragen warten, wenn der Host das will
      if (m.waitAi && ai.enabled() && ['loading', 'waiting'].includes(m.aiStatus)) { // warten, bis die frischen Fragen da sind oder die KI aufgibt
        m.endsAt = null; m.aiStatus = 'waiting'; push(m);
        clearTimeout(m.timer); m.timer = setTimeout(go, 1500); return;
      }
      nextQuestion(m);
    };
    timer(m, m.settings.countdown * 1000, go);
    push(m); pushLobbies();
  }

  function nextQuestion(m) {
    m.liveInput = ''; // neue Frage: Live-Eingabe zurücksetzen
    if (!m.questions.length) { m.questions = shuffle([...pool]).slice(0, m.settings.maxQuestions); }
    const src = m.questions[m.qIndex];
    if (!src && m.fetching && m.qIndex < m.settings.maxQuestions) {
      m.waitingMore = true; m.endsAt = null; push(m);
      clearTimeout(m.timer); m.timer = setTimeout(() => { if (m.waitingMore) { m.waitingMore = false; nextQuestion(m); } }, 90000); // spätestens nach 90 s weiter
      return;
    }
    if (!src) return finish(m);
    const q = { ...src }; // Kopie, damit parallele Matches sich nicht beeinflussen
    m.current = q; m.qIndex++; m.reveal = null; m.reportedBy = new Set();
    seen.set(q.id, ++tick);
    lastAsked.push(q.q); if (lastAsked.length > 200) lastAsked.shift();
    store.askedAdd([q.q]).catch(() => {}); // Frage kommt in die Bibliothek
    store.seenAdd([...m.players.keys()], q.id).catch(() => {}); // jeder Mitspieler hat sie jetzt gesehen
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
    const over = top >= m.settings.pointLimit || m.qIndex >= m.settings.maxQuestions || (m.qIndex >= m.questions.length && !m.fetching);
    timer(m, REVEAL_MS, () => (over ? finish(m) : nextQuestion(m)));
    push(m);
  }

  function finish(m) {
    clearTimeout(m.timer); m.endsAt = null; m.phase = 'finished';
    const ps = [...m.players.values()];
    const top = Math.max(0, ...ps.map((p) => p.score));
    m.winners = ps.filter((p) => p.score === top && top > 0).map((p) => p.id);
    m.summaries = {}; m.drops = [];
    m.timer = setTimeout(() => destroy(m), 15 * 60 * 1000); // Aufräumen, falls niemand mehr zurück in die Lobby geht
    settleBets(m, ps).catch((e) => console.error('Wetten:', e.message));
    push(m); pushLobbies();
    Promise.all(ps.filter((p) => p.match).map(async (p) => {
      const r = { ...p.match, score: p.score, win: ps.length > 1 && m.winners.includes(p.id), counted: ps.length > 1,
        ranked: m.ranked && ps.length > 1, place: ps.filter((x) => x.score > p.score).length, players: ps.length }; p.match = null;
      const u = await store.userById(p.id); if (!u) return;
      r.pointLimit = m.settings.pointLimit;
      const out = progress.applyMatch(u, r);
      const solo = ps.length === 1;
      // Solo-Runde: XP etwas abgeschwächt, Diamanten wie eine Niederlage, nur etwas weniger
      if (solo && (r.answered || 0) > 0) {
        const cut = Math.round((out.summary.gained || 0) * 0.12);
        out.user.xp = Math.min(progress.CAP, Math.max(0, (Number(u.xp) || 0) + (out.summary.gained || 0) - cut)); // erst abziehen, dann deckeln: auf Level 30 bleibt man auf Level 30
        out.summary.parts = [...(out.summary.parts || []), ['Solo-Runde (−12 %)', -cut]];
        out.summary.gained = (out.summary.gained || 0) - cut;
        out.summary.levelAfter = progress.levelInfo(out.user.xp).level;
      }
      let dia = solo ? ((r.answered || 0) > 0 ? Math.round(tcg.diamondsFor({ win: false, score: r.score, pointLimit: m.settings.pointLimit, counted: true }) * 0.7) : 0)
        : tcg.diamondsFor({ win: r.win, score: r.score, pointLimit: m.settings.pointLimit, counted: r.counted });
      // Erstes Match des Tages: XP und Diamanten doppelt (wer mitgespielt hat, also mindestens eine Antwort)
      const today = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
      if (u.first_game_day !== today && (r.answered || 0) > 0) {
        const extra = out.summary.gained || 0;
        out.user.xp = Math.min(progress.CAP, (out.user.xp || 0) + extra);
        out.summary.parts = [...(out.summary.parts || []), ['Erstes Match des Tages: doppelt', extra]];
        out.summary.gained = (out.summary.gained || 0) + extra;
        out.summary.levelAfter = progress.levelInfo(out.user.xp).level;
        dia *= 2;
        out.user.first_game_day = today; out.summary.firstBonus = true;
      }
      // Hot Time am Abend: XP und Diamanten doppelt
      if (hot.active() && (r.answered || 0) > 0) {
        const extra = out.summary.gained || 0;
        out.user.xp = Math.min(progress.CAP, (out.user.xp || 0) + extra);
        out.summary.parts = [...(out.summary.parts || []), ['Hot Time 🔥 doppelte XP', extra]];
        out.summary.gained = (out.summary.gained || 0) + extra;
        out.summary.levelAfter = progress.levelInfo(out.user.xp).level;
        dia *= 2; out.summary.hot = true;
      }
      if (dia) { out.user.diamonds = (Number(u.diamonds) || 0) + dia; out.summary.diamonds = dia; }
      // Zufallsfund am Ende der Runde: für alle sichtbar
      if ((r.answered || 0) > 0 && Math.random() < (process.env.DROP_TEST ? 1 : solo ? 0.12 : 0.22)) {
        const roll = Math.random();
        const drop = roll < 0.55 ? { kind: 'dia', n: 300 + Math.floor(Math.random() * 6) * 100 }
          : roll < 0.80 ? { kind: 'pack', pack: 'standard', text: 'einen Standard-Booster' }
          : roll < 0.92 ? { kind: 'pack', pack: 'premium', text: 'einen Premium-Booster' }
          : roll < 0.98 ? { kind: 'pack', pack: 'ghost', text: 'einen Geister-Booster' }
          : { kind: 'dia', n: 3000, jackpot: true };
        if (drop.kind === 'dia') { out.user.diamonds = (Number(out.user.diamonds ?? u.diamonds) || 0) + drop.n; drop.text = `${drop.n.toLocaleString('de-DE')} Diamanten${drop.jackpot ? ' (Jackpot!)' : ''}`; }
        else await store.packAdd(p.id, drop.pack, 1);
        m.drops.push({ id: p.id, name: p.name, text: drop.text, kind: drop.kind, pack: drop.pack || null, jackpot: !!drop.jackpot });
        out.summary.drop = drop.text;
      }
      // Aktion: Wer eine GRACE-Runde gewinnt, schaltet den Dino-Satz frei
      if (r.win && graceActive() && !m.ranked && m.themes.length === 1 && m.themes[0] === 'grace') {
        const list = new Set(String(u.unlocks || '').split(',').filter(Boolean));
        ['fgrace', 'tgrace', 'egrace'].forEach((x) => list.add(x));
        out.user.unlocks = [...list].join(',');
        out.summary.unlocked = [...(out.summary.unlocked || []), { name: 'GRACE: Dino-Satz freigeschaltet', xp: 0 }];
      }
      await store.save(p.id, out.user);
      setTimeout(() => hooks.progress(p.id), 6000); // nach der Endabrechnung: neue Erfolge melden
      m.summaries[p.id] = out.summary; p.level = out.summary.levelAfter;
    })).catch((e) => console.error('Fortschritt speichern fehlgeschlagen:', e)).then(() => { if (matches.has(m.code) && m.phase === 'finished') push(m); });
  }

  function destroy(m) {
    clearTimeout(m.timer); clearTimeout(m.emptyTimer);
    for (const p of m.players.values()) { userMatch.delete(p.id); for (const s of p.sockets) s.emit('state', null); }
    matches.delete(m.code); pushLobbies();
  }

  // Einsätze auszahlen: Sieger bekommen das Doppelte, verlorene Einsätze gehen an die Sieger
  async function settleBets(m, ps) {
    if (!m.bets.size) return;
    const bets = [...m.bets.entries()];
    m.bets = new Map();
    const solo = ps.length < 2 || !m.winners.length;
    const add = async (uid, n) => { const u = await store.userById(uid); if (u && n > 0) await store.save(uid, { diamonds: (Number(u.diamonds) || 0) + Math.round(n) }); };
    if (solo) { for (const [uid, amt] of bets) await add(uid, amt); return; } // allein gespielt: Einsatz zurück
    let pot = 0;
    const notes = [];
    for (const [uid, amt] of bets) {
      if (m.winners.includes(uid)) { await add(uid, amt * 2); notes.push({ id: uid, text: `Wette gewonnen: +${amt * 2} Diamanten` }); }
      else { pot += amt; notes.push({ id: uid, text: `Wette verloren: −${amt} Diamanten` }); }
    }
    if (pot > 0) {
      const share = Math.floor(pot / m.winners.length);
      for (const id of m.winners) { await add(id, share); notes.push({ id, text: `Aus verlorenen Wetten: +${share} Diamanten` }); }
    }
    m.betNotes = notes;
    push(m);
  }

  function removePlayer(m, uid) {
    const p = m.players.get(uid); if (!p) return;
    const bet = m.bets.get(uid);
    if (bet) { m.bets.delete(uid); store.userById(uid).then((u) => u && store.save(uid, { diamonds: (Number(u.diamonds) || 0) + bet })).catch(() => {}); }
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
    let watching = null;
    const fail = (msg) => socket.emit('err', msg);
    socket.on('idle', (on) => {
      const was = idle.has(user.id);
      if (on) idle.add(user.id); else idle.delete(user.id);
      if (was !== !!on) { clearTimeout(presenceTimer); presenceTimer = setTimeout(pushLobbies, 400); }
    });
    // Solo-Quiz: aktuelle Eingabe nur an Zuschauer weitergeben (bei mehreren Spielern nie, sonst könnte man Antworten verraten)
    socket.on('typing', (v) => {
      const m = mine(); if (!m || !m.solo || m.phase !== 'question' || !m.watchers.size) return;
      m.liveInput = String(v || '').slice(0, 24);
      for (const w of m.watchers.values()) for (const so of w.sockets) so.emit('state', stateFor(m, w.id, true));
    });
    socket.on('presence', (pg) => {
      const v = String(pg || '').slice(0, 40);
      if (where.get(user.id) === v) return;
      where.set(user.id, v);
      clearTimeout(presenceTimer); presenceTimer = setTimeout(pushLobbies, 400); // gebündelt senden
    });
    const note = (msg) => socket.emit('note', msg);
    const on = online.get(user.id) || { name: user.name, n: 0, sockets: new Set() }; on.n++; on.sockets.add(socket); online.set(user.id, on); pushLobbies();
    store.save(user.id, { last_seen: Date.now() }).catch(() => {});

    // Wiedereinstieg nach Verbindungsabbruch
    const cur = mine();
    if (cur) { const p = cur.players.get(user.id); p.sockets.add(socket); clearTimeout(cur.emptyTimer); push(cur); }
    else socket.emit('state', null);
    socket.emit('lobbies', lobbies());

    const newMatch = () => ({ code: newCode(), phase: 'lobby', hostId: user.id, players: new Map(), settings: { ...DEFAULTS }, questions: [], qIndex: 0, current: null, reveal: null, endsAt: null, aiStatus: ai.enabled() ? 'idle' : 'off', reportedBy: new Set(), winners: null, password: '', summaries: {}, ranked: false, themes: defaultThemes(), setup: true, chat: [], asked: new Set(), invited: new Set(), watchers: new Map(), bets: new Map(), waitAi: true });

    socket.on('create', () => {
      if (mine()) return fail('Du bist schon in einem Match.');
      if (matches.size >= MAX_MATCHES) return fail(`Es laufen schon ${MAX_MATCHES} Matches. Warte, bis eines endet, oder tritt einem bei.`);
      const m = newMatch();
      matches.set(m.code, m);
      join(m).catch((e) => console.error(e));
    });

    // Zuschauen: sehen alles mit, können Reaktionen schicken, aber nicht antworten
    function watch(m) {
      if (!matches.has(m.code)) return fail('Dieses Match gibt es nicht mehr.');
      const w = m.watchers.get(user.id) || { id: user.id, name: user.name, sockets: new Set() };
      w.sockets.add(socket); m.watchers.set(user.id, w);
      watching = m.code;
      socket.emit('state', stateFor(m, user.id, true));
      push(m);
      note('Du schaust zu. Sobald eine neue Runde beginnt, kannst du mitspielen.');
    }
    function unwatch() {
      if (!watching) return;
      const m = matches.get(watching);
      if (m) {
        const w = m.watchers.get(user.id);
        if (w) { w.sockets.delete(socket); if (!w.sockets.size) m.watchers.delete(user.id); }
        push(m);
      }
      watching = null;
      socket.emit('state', null);
    }

    async function join(m) {
      const u = (await store.userById(user.id)) || {};
      if (mine() || m.players.size >= MAX_PLAYERS || !matches.has(m.code)) return;
      const used = new Set([...m.players.values()].map((p) => p.color));
      m.players.set(user.id, { id: user.id, name: user.name, color: COLORS.find((c) => !used.has(c)), score: 0, gain: 0, answer: null, sockets: new Set([socket]),
        match: m.phase === 'countdown' ? { answered: 0, exact: 0, close: 0, mc_right: 0, mc_total: 0, dev_sum: 0, dev_n: 0 } : null,
        level: progress.levelInfo(u.xp || 0).level, prestige: u.prestige || 0, presShown: (u.pres_shown === -1 ? 0 : u.pres_shown > 0 ? Math.min(u.pres_shown, u.prestige || 0) : (u.prestige || 0)), av: u.av || 0, tag: u.tag || '', tagColor: u.tag_color || '', emblem: u.emblem || '', streak: u.streak || 0, frame: u.frame || '', frameAnim: frames.animOf(u.frame),
        title: (() => { const t = cards.titleById(u.title); return t ? { /* geprüft wird beim Auswählen, nicht bei der Anzeige */ id: u.title === 'secret' ? 'tsecret' : u.title, text: t.text, style: t.style } : null; })() });
      userMatch.set(user.id, m.code);
      if (!m.setup) { m.chat.push({ sys: true, text: user.name + ' ist beigetreten.', t: Date.now() }); if (m.chat.length > 60) m.chat.shift(); }
      if (!m.setup && m.phase === 'lobby') store.setting('question_source').then((src) => {
        if (src !== 'pool' || m.phase !== 'lobby') return;
        clearTimeout(m.prepTimer); m.prepDone = false; m.aiStatus = 'idle'; prepQueue(m); // Pool-Auswahl für alle Mitspieler neu
      }).catch(() => {});
      push(m); pushLobbies();
    }

    socket.on('join', (arg) => {
      if (mine()) return fail('Du bist schon in einem Match.');
      const code = typeof arg === 'object' && arg ? arg.code : arg, pw = typeof arg === 'object' && arg ? String(arg.password || '') : '';
      const m = matches.get(String(code || '').toUpperCase().trim());
      if (!m) return fail('Kein Match mit diesem Code gefunden.');
      if (m.phase !== 'lobby' && m.phase !== 'countdown') return watch(m);
      if (m.setup) return fail('Der Host richtet das Match gerade erst ein.');
      if (m.players.size >= MAX_PLAYERS) return watch(m);
      if (m.password && pw !== m.password && !m.invited.has(user.id)) return socket.emit('needpw', { code: m.code, wrong: !!pw });
      join(m).catch((e) => console.error(e));
    });

    socket.on('leave', () => { if (watching) return unwatch(); const m = mine(); if (m) removePlayer(m, user.id); });
    socket.on('unwatch', unwatch);

    // Diamanten setzen: nur in der Pre-Lobby, Einsatz wird sofort gesperrt
    socket.on('bet', async (raw) => {
      try {
        const m = mine();
        if (!m || m.setup || m.phase !== 'lobby') return fail('Setzen geht nur in der Lobby vor dem Start.');
        const amount = Math.max(0, Math.min(100000, Math.round(Number(raw) || 0)));
        const u = await store.userById(user.id); if (!u) return;
        const old = m.bets.get(user.id) || 0;
        const have = (Number(u.diamonds) || 0) + old;
        if (amount > have) return fail('So viele Diamanten hast du nicht.');
        if (amount && amount < 50) return fail('Mindestens 50 Diamanten.');
        await store.save(user.id, { diamonds: have - amount });
        if (amount) m.bets.set(user.id, amount); else m.bets.delete(user.id);
        note(amount ? `${amount} Diamanten gesetzt. Gewinnst du, bekommst du das Doppelte.` : 'Einsatz zurückgenommen.');
        socket.emit('diamonds', have - amount); // Guthaben sofort aktualisieren
        push(m);
      } catch (e) { console.error(e); }
    });
    socket.on('watch', (code) => { if (mine()) return fail('Du bist schon in einem Match.'); const m = matches.get(String(code || '').toUpperCase().trim()); if (!m) return fail('Kein Match mit diesem Code.'); watch(m); });

    socket.on('settings', (s) => {
      const m = mine(); if (!m || m.hostId !== user.id || m.phase !== 'lobby' || !s) return;
      let reprep = false;
      if (typeof s.password === 'string') { m.password = s.password.trim().slice(0, 20); pushLobbies(); }
      const onlyGrace = () => m.themes.length === 1 && m.themes[0] === 'grace';
      if (typeof s.waitAi === 'boolean') { m.waitAi = onlyGrace() ? false : s.waitAi; reprep = true; }
      if (typeof s.ranked === 'boolean') { m.ranked = s.ranked; m.themes = m.ranked ? [...themes.RANKED] : themes.valid(m.themes.slice(0, themes.MAX_THEMES)); reprep = true; pushLobbies(); }
      if (Array.isArray(s.themes) && !m.ranked) {
        const list = themes.valid(s.themes);
        // GRACE läuft allein und ohne KI-Fragen
        m.themes = list.includes('grace') ? ['grace'] : list;
        if (m.themes.length === 1 && m.themes[0] === 'grace') m.waitAi = false;
        reprep = true;
      }
      for (const k of Object.keys(LIMITS)) if (Number.isFinite(Number(s[k]))) { if (k === 'maxQuestions' && Number(s[k]) !== m.settings[k]) reprep = true; m.settings[k] = clamp(Math.round(Number(s[k])), LIMITS[k]); }
      if (reprep && !m.setup) { clearTimeout(m.prepTimer); m.prepDone = false; m.aiStatus = ai.enabled() ? 'idle' : 'off'; m.questions = []; m.asked = new Set(); prepQueue(m); }
      push(m);
    });

    socket.on('create_done', () => {
      const m = mine(); if (!m || m.hostId !== user.id || m.phase !== 'lobby' || !m.setup) return;
      m.setup = false;
      m.chat.push({ sys: true, text: 'Match eröffnet. Freunde können jetzt beitreten.', t: Date.now() });
      prepQueue(m);
      push(m); pushLobbies();
    });

    // Solo-Runde: freies Spiel, niemand kann beitreten, startet sofort
    socket.on('create_solo', () => {
      const m = mine(); if (!m || m.hostId !== user.id || m.phase !== 'lobby' || !m.setup) return;
      m.setup = false; m.solo = true; m.ranked = false;
      m.password = Math.random().toString(36).slice(2, 10);
      startCountdown(m);
      // Ohne KI oder wenn die Fragen schon da sind: nach kurzem Vorlauf los
      if (!ai.enabled()) { m.readyGo = true; timer(m, 4000, () => nextQuestion(m)); }
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
      if (!m || m.hostId !== user.id || m.phase !== 'countdown' || !m.questions.length) return;
      if (['loading', 'waiting'].includes(m.aiStatus)) { m.startWhenReady = true; push(m); return; } // startet, sobald die Fragen da sind
      if (m.readyGo) return;
      nextQuestion(m);
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
      const m = mine() || (watching ? matches.get(watching) : null);
      if (!m || ![0, 1, 2, 3, 4, 5].includes(i) || Date.now() - lastEmote < 600) return;
      const p = m.players.get(user.id);
      const asWatcher = !p;
      // Zuschauer dürfen jederzeit reagieren, Spieler erst nach ihrer Abgabe
      if (!asWatcher && !(m.phase === 'reveal' || m.phase === 'finished' || (m.phase === 'question' && p.answer !== null))) return;
      lastEmote = Date.now();
      const msg = { id: user.id, e: i, watcher: asWatcher, name: asWatcher ? user.name : undefined };
      for (const pl of m.players.values()) for (const s of pl.sockets) s.emit('emote', msg);
      for (const w of m.watchers.values()) for (const s of w.sockets) s.emit('emote', msg);
    });

    // Jemanden ins eigene Match holen
    socket.on('challenge', async (targetId) => {
      const id = Number(targetId);
      const t = online.get(id);
      // Offline-Spieler bekommen eine Push-Nachricht statt einer Absage
      const target = t || (await store.userById(id));
      if (!target) return fail('Diesen Spieler gibt es nicht.');
      const tname = t ? t.name : target.name;
      if (userMatch.has(id)) return fail(tname + ' ist schon in einem Match.');
      let m = mine();
      if (m && (m.setup || !['lobby', 'countdown'].includes(m.phase))) return fail('Dein Match läuft schon. Fordere jemanden aus der Lobby heraus.');
      if (!m) {
        // Kein Match offen: eines eröffnen und direkt einladen
        if (matches.size >= MAX_MATCHES) return fail(`Es laufen schon ${MAX_MATCHES} Matches.`);
        m = newMatch();
        m.setup = false;
        m.chat.push({ sys: true, text: 'Match eröffnet. Freunde können jetzt beitreten.', t: Date.now() });
        matches.set(m.code, m);
        await join(m);
        m = mine();
        if (!m) return fail('Das Match ließ sich nicht eröffnen.');
      }
      if (m.players.size >= MAX_PLAYERS) return fail('Dein Match ist voll.');
      m.invited.add(id);
      if (t) for (const s of t.sockets) s.emit('challenged', { from: user.name, code: m.code });
      webpush.toUser(id, { title: '⚔ Herausforderung', body: user.name + ' fordert dich heraus. Match ' + m.code, tag: 'invite', url: '/?join=' + m.code }).catch(() => {});
      note(t ? 'Einladung an ' + tname + ' verschickt' : 'Einladung an ' + tname + ' verschickt, er ist offline und bekommt eine Benachrichtigung');
    });

    socket.on('report', () => {
      const m = mine(); if (!m || m.phase !== 'reveal' || !m.current || m.reportedBy.has(user.id)) return;
      m.reportedBy.add(user.id); store.report(m.current.id).catch(() => {}); push(m);
    });

    socket.on('again', () => {
      const m = mine(); if (!m || m.hostId !== user.id || m.phase !== 'finished') return;
      clearTimeout(m.timer); m.phase = 'lobby'; m.setup = false; m.prepDone = false; m.betNotes = null; m.aiStatus = ai.enabled() ? 'idle' : 'off'; m.questions = []; m.current = null; m.reveal = null; m.winners = null; m.endsAt = null; m.summaries = {}; m.qIndex = 0;
      for (const p of [...m.players.values()]) { p.score = 0; p.gain = 0; p.answer = null; if (!p.sockets.size) { m.players.delete(p.id); userMatch.delete(p.id); } }
      push(m); pushLobbies();
    });

    socket.on('disconnect', () => {
      if (watching) { const wm = matches.get(watching); if (wm) { const w = wm.watchers.get(user.id); if (w) { w.sockets.delete(socket); if (!w.sockets.size) wm.watchers.delete(user.id); } push(wm); } watching = null; }
      const o = online.get(user.id); if (o) { o.sockets.delete(socket); if (--o.n <= 0) { online.delete(user.id); where.delete(user.id); idle.delete(user.id); } } pushLobbies();
      store.save(user.id, { last_seen: Date.now() }).catch(() => {});
      const m = mine(); if (!m) return;
      const p = m.players.get(user.id); p.sockets.delete(socket);
      if (p.sockets.size) return;
      if (m.phase === 'lobby' || m.phase === 'countdown') return removePlayer(m, user.id);
      if (![...m.players.values()].some((x) => x.sockets.size)) { clearTimeout(m.emptyTimer); m.emptyTimer = setTimeout(() => destroy(m), 90000); }
      else if (m.hostId === user.id) m.hostId = [...m.players.values()].find((x) => x.sockets.size).id;
      checkAllAnswered(m); if (matches.has(m.code)) push(m);
    });
  });

  return { matches, scoreEstimate, online, userMatch, activityOf, hooks, qpool, isIdle: (id) => idle.has(id) };
};
module.exports.scoreEstimate = scoreEstimate;
