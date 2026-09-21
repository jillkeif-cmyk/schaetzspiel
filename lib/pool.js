// Fragen-Pool: alle KI-Fragen liegen dauerhaft in der Datenbank, nach Kategorie sortiert.
// Beim Spielstart werden Fragen gewählt, die keiner der Mitspieler je hatte.
// Eine Hintergrund-Befüllung hält jede Kategorie auf dem Zielstand, ohne Doppelte.
const ai = require('./ai');
const themes = require('./themes');
const sim = require('./similar');

const SKIP = new Set(['grace']); // eigene Fragen, keine KI
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const subj = (q) => String(q.s || '').toLowerCase().replace(/[^a-z0-9äöüß ]/g, '').trim();

module.exports = function createPool(store) {
  const byTheme = new Map(themes.THEMES.map((t) => [t.key, []]));
  const idx = new Map(themes.THEMES.map((t) => [t.key, []])); // Ähnlichkeits-Index je Kategorie
  let loaded = false;
  const themeOfQ = (q) => (q.theme && byTheme.has(q.theme) ? q.theme : themes.themeOf(q));
  function add(list) {
    for (const q of list) {
      const t = themeOfQ(q);
      if (!byTheme.has(t)) continue;
      byTheme.get(t).push(q); idx.get(t).push(...sim.makeIndex([q]));
    }
  }
  async function load() {
    try { add(await store.poolAll()); loaded = true;
      const was = await store.setting('pool_fill_running').catch(() => null);
      if (was && was !== '0') setTimeout(() => { fill.target = Number(was) || fill.target; note('Befüllung nach Neustart fortgesetzt'); start(); }, 5000); console.log('Fragen-Pool geladen:', [...byTheme.values()].reduce((x, l) => x + l.length, 0), 'Fragen'); }
    catch (e) { console.error('Pool laden:', e.message); }
  }

  // Auswahl für ein Match: ungesehen für alle Mitspieler, höchstens eine Frage pro Gegenstand
  function pick(themeKeys, seen, reported, total) {
    const cand = shuffle(themeKeys.flatMap((k) => byTheme.get(k) || []).filter((q) => !seen.has(q.id) && !reported.has(q.id)));
    // gleichmäßig über die Kategorien verteilen
    const per = new Map(themeKeys.map((k) => [k, []]));
    for (const q of cand) { const l = per.get(themeOfQ(q)); if (l) l.push(q); }
    const out = [], usedSubj = new Set();
    for (let round = 0; out.length < total && round < 200; round++) {
      let added = false;
      for (const k of shuffle([...themeKeys])) {
        const l = per.get(k); if (!l) continue;
        while (l.length) {
          const q = l.shift(); const s = subj(q);
          if (s && usedSubj.has(s)) continue;
          if (out.some((x) => sim.similar(x.q, q.q, x.a, q.a))) continue;
          if (s) usedSubj.add(s); out.push(q); added = true; break;
        }
        if (out.length >= total) break;
      }
      if (!added) break;
    }
    // etwa ein Viertel Auswahlfragen, wenn vorhanden
    return out;
  }

  // ---------- Befüllung ----------
  const fill = { running: false, auto: false, target: 200, inFlight: 0, made: 0, rejected: 0, startTokens: null, log: [], queue: new Set() };
  const note = (t) => { fill.log.unshift(new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' }) + ' ' + t); fill.log = fill.log.slice(0, 30); console.log('Pool:', t); };

  async function fillOne(theme) {
    const t = themes.byKey(theme); if (!t) return;
    const list = byTheme.get(theme);
    // Gegenstände, die es schon gibt: die KI soll andere wählen
    const known = [...new Set(list.map((q) => q.s).filter(Boolean))].slice(-80);
    const avoidTexts = list.slice(-20).map((q) => q.q);
    fill.inFlight++;
    try {
      const got = await ai.generate(10, [...known.slice(-40).map((x) => 'Gegenstand schon vergeben: ' + x), ...avoidTexts.slice(-10)], { themes: [t], timeout: 150000 });
      const fresh = [];
      for (const q of got) {
        q.theme = theme;
        const s = subj(q);
        if (s && list.some((x) => subj(x) === s) && list.filter((x) => subj(x) === s).length >= 3) { fill.rejected++; continue; } // höchstens 3 Fragen pro Gegenstand im ganzen Pool
        if (sim.inIndex(idx.get(theme), q) || fresh.some((x) => sim.similar(x.q, q.q, x.a, q.a))) { fill.rejected++; continue; }
        fresh.push(q);
      }
      if (fresh.length) { const stored = await store.addAiQuestions(fresh); add(stored); fill.made += stored.length; }
      note(`${t.name}: ${fresh.length} neu, ${got.length - fresh.length} aussortiert, jetzt ${list.length}`);
    } catch (e) { note(`${t.name}: Fehler ${e.message}`); }
    finally { fill.inFlight--; }
  }

  // Welche Kategorie braucht als Nächstes Fragen?
  function nextTheme() {
    let best = null;
    for (const t of themes.THEMES) {
      if (SKIP.has(t.key)) continue;
      const n = byTheme.get(t.key).length;
      const want = fill.queue.has(t.key) ? n + 1 : fill.target;
      if (n >= want) continue;
      if (!best || n < best.n) best = { key: t.key, n };
    }
    return best && best.key;
  }
  const PARALLEL = 3;
  async function loop() {
    while (fill.running) {
      while (fill.running && fill.inFlight < PARALLEL) {
        const t = nextTheme();
        if (!t) break;
        fillOne(t).then(() => { if (fill.queue.has(t) && byTheme.get(t).length >= fill.target + 20) fill.queue.delete(t); });
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!nextTheme() && !fill.inFlight) { fill.running = false; remember(false); note('Alle Kategorien haben den Zielstand erreicht'); break; }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  const remember = (on) => store.setting('pool_fill_running', on ? String(fill.target) : '0').catch(() => {});
  function start() { if (fill.running || !ai.enabled()) return; fill.running = true; remember(true); if (!fill.startTokens) fill.startTokens = { ...ai.usage }; note(`Befüllung gestartet, Ziel ${fill.target} pro Kategorie`); loop(); }
  function stop() { if (!fill.running) return; fill.running = false; remember(false); note('Befüllung angehalten'); }

  // Automatisches Nachfüllen: haben die aktivsten Spieler in einer Kategorie über 80 % gesehen, kommen 20 neue dazu
  async function autoCheck() {
    if (!fill.auto) return;
    try {
      const top = (await store.leaderboard().catch(() => [])).slice(0, 5).map((u) => u.id);
      for (const t of themes.THEMES) {
        if (SKIP.has(t.key)) continue;
        const list = byTheme.get(t.key); if (!list.length) continue;
        let worst = list.length;
        for (const uid of top) { const seen = await store.seenCounts(uid); worst = Math.min(worst, list.filter((q) => !seen.has(q.id)).length); }
        if (worst < list.length * 0.2) { fill.target = Math.max(fill.target, list.length + 20); note(`${t.name}: nur noch ${worst} ungesehen, fülle nach`); start(); }
      }
    } catch (e) { console.error('Pool-Autocheck:', e.message); }
  }
  setInterval(autoCheck, 15 * 60 * 1000);

  function stats(seenByMe) {
    const u = ai.usage, base = fill.startTokens || u;
    return {
      loaded, running: fill.running, auto: fill.auto, target: fill.target, inFlight: fill.inFlight, made: fill.made, rejected: fill.rejected,
      tokens: { calls: u.calls - (base.calls || 0), input: u.input - (base.input || 0), output: u.output - (base.output || 0), totalOutput: u.output, totalInput: u.input },
      themes: themes.THEMES.map((t) => {
        const list = byTheme.get(t.key);
        return { key: t.key, name: t.name, count: list.length, seen: seenByMe ? list.filter((q) => seenByMe.has(q.id)).length : 0, skip: SKIP.has(t.key) };
      }),
      log: fill.log,
    };
  }
  function setTarget(n) { fill.target = Math.max(20, Math.min(5000, Math.round(Number(n) || 200))); note(`Ziel pro Kategorie: ${fill.target}`); }
  function setAuto(on) { fill.auto = !!on; note(fill.auto ? 'Automatisches Nachfüllen an' : 'Automatisches Nachfüllen aus'); if (fill.auto) autoCheck(); }

  return { load, add, pick, start, stop, stats, setTarget, setAuto, themeOfQ, size: (k) => (byTheme.get(k) || []).length };
};
