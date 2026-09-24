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
  const byId = new Map(), groupOf = new Map(); // Fragenummer -> Gruppe
  const tokIdx = new Map(); // Wort -> Vertreter der Gruppen, die es enthalten
  const reps = []; let badCount = 0;
  // Schlecht: gesperrter Klassiker, Lösung in der Frage, früher abgeschnittene Auswahlantworten
  const isBad = (q) => sim.isClassic(q) || ai.leaks(q) || (q.t === 'mc' && (q.o || []).some((o) => String(o).length === 40));
  function groupFor(q, probe) {
    const toks = [...sim.tokens(q.q)];
    const cand = new Set();
    for (const w of toks) { const l = tokIdx.get(w); if (l && l.length < 400) for (const r of l) cand.add(r); }
    for (const r of cand) if (sim.similar(r.q, q.q, r.a, q.a) || (q.t === 'mc' && r.t === 'mc' && String(r.o[0]).toLowerCase() === String(q.o[0]).toLowerCase() && sim.jaccard(r.q, q.q) > 0.3)) return groupOf.get(r.id);
    if (probe) return null;
    reps.push(q); for (const w of toks) { if (!tokIdx.has(w)) tokIdx.set(w, []); tokIdx.get(w).push(q); }
    return q.id;
  }
  function add(list) {
    for (const q of list) {
      const t = themeOfQ(q);
      if (!byTheme.has(t)) continue;
      q.bad = isBad(q); if (q.bad) badCount++;
      groupOf.set(q.id, groupFor(q)); byId.set(q.id, q);
      byTheme.get(t).push(q); idx.get(t).push(...sim.makeIndex([q]));
    }
  }
  async function load() {
    try { add(await store.poolAll()); loaded = true;
      try { const c = JSON.parse((await store.setting('pool_cfg').catch(() => null)) || '{}'); Object.assign(fill, { target: c.target || fill.target, targets: c.targets || {}, auto: !!c.auto, mode: c.mode || fill.mode, effort: c.effort || fill.effort }); } catch (e) {}
      try { fill.log = JSON.parse((await store.setting('pool_log').catch(() => null)) || '[]'); } catch (e) {}
      const ob = await store.setting('pool_batch').catch(() => null); if (ob) { try { fill.batch = JSON.parse(ob); } catch (e) {} }
      const was = await store.setting('pool_fill_running').catch(() => null);
      if (was && was !== '0') setTimeout(() => { fill.target = Number(was) || fill.target; note('Befüllung nach Neustart fortgesetzt'); start(); }, 5000); console.log(`Fragen-Pool geladen: ${byId.size} Fragen, ${reps.length} verschiedene, ${badCount} gesperrt`); }
    catch (e) { console.error('Pool laden:', e.message); }
  }

  // Auswahl für ein Match: ungesehen für alle Mitspieler, höchstens eine Frage pro Gegenstand
  function pick(themeKeys, seen, reported, total) {
    const seenGroups = new Set([...seen].map((id) => groupOf.get(id)).filter(Boolean));
    const cand = shuffle(themeKeys.flatMap((k) => byTheme.get(k) || []).filter((q) => !q.bad && !seen.has(q.id) && !seenGroups.has(groupOf.get(q.id)) && !reported.has(q.id)));
    const usedGroups = new Set();
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
          if (usedGroups.has(groupOf.get(q.id))) continue;
          if (out.some((x) => sim.similar(x.q, q.q, x.a, q.a))) continue;
          if (s) usedSubj.add(s); usedGroups.add(groupOf.get(q.id)); out.push(q); added = true; break;
        }
        if (out.length >= total) break;
      }
      if (!added) break;
    }
    // etwa ein Viertel Auswahlfragen, wenn vorhanden
    return out;
  }

  // ---------- Befüllung ----------
  const saveCfg = () => store.setting('pool_cfg', JSON.stringify({ target: fill.target, targets: fill.targets, auto: fill.auto, mode: fill.mode, effort: fill.effort })).catch(() => {});
  const fill = { targets: {}, mode: 'batch', effort: 'low', batch: null, batchStatus: '', running: false, auto: false, target: 200, inFlight: 0, made: 0, rejected: 0, startTokens: null, log: [], queue: new Set() };
  const note = (t) => { fill.log.unshift(new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + t); fill.log = fill.log.slice(0, 60); console.log('Pool:', t); store.setting('pool_log', JSON.stringify(fill.log)).catch(() => {}); };

  // Was die KI vermeiden soll: Gegenstände, die es in dieser Kategorie schon gibt
  const avoidFor = (theme) => { const list = byTheme.get(theme); const known = [...new Set(list.map((q) => q.s).filter(Boolean))]; return [...known.slice(-40).map((x) => 'Gegenstand schon vergeben: ' + x), ...list.slice(-10).map((q) => q.q)]; };
  async function accept(theme, got) {
    const t = themes.byKey(theme), list = byTheme.get(theme);
    const fresh = [];
    for (const q of got) {
      q.theme = theme;
      const s = subj(q);
      if (s && list.filter((x) => subj(x) === s).length >= 3) { fill.rejected++; continue; }
      if (isBad(q) || groupFor(q, true) || fresh.some((x) => sim.similar(x.q, q.q, x.a, q.a))) { fill.rejected++; continue; } // gibt es inhaltlich schon, egal in welcher Kategorie
      fresh.push(q);
    }
    if (fresh.length) { const stored = await store.addAiQuestions(fresh); add(stored); fill.made += stored.length; }
    note(`${t.name}: ${fresh.length} neu, ${got.length - fresh.length} aussortiert, jetzt ${list.length}`);
  }
  async function fillOne(theme) {
    const t = themes.byKey(theme); if (!t) return;
    const list = byTheme.get(theme);
    fill.inFlight++;
    try {
      const got = await ai.generate(10, avoidFor(theme), { themes: [t], timeout: 150000, effort: fill.effort });
      await accept(theme, got); return;
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
      const n = playable(t.key);
      const want = fill.queue.has(t.key) ? n + 1 : targetOf(t.key);
      if (n >= want) continue;
      if (!best || n < best.n) best = { key: t.key, n };
    }
    return best && best.key;
  }
  const PARALLEL = 3;
  const targetOf = (k) => (fill.targets && fill.targets[k]) || fill.target;
  const playable = (k) => byTheme.get(k).filter((q) => !q.bad).length;
  async function batchCycle() {
    const jobs = [], themeOf = {};
    for (const t of themes.THEMES) {
      if (SKIP.has(t.key)) continue;
      const missing = targetOf(t.key) - playable(t.key);
      if (missing <= 0) continue;
      const n = Math.min(4, Math.ceil(missing / 8)); // bis zu 4 Anfragen je Kategorie und Runde
      for (let i = 0; i < n; i++) { const id = `${t.key}_${Date.now().toString(36)}_${i}`; themeOf[id] = t.key; jobs.push({ id, count: 10, avoid: avoidFor(t.key), opts: { themes: [t], seeds: ai.seedList(true, 10), effort: fill.effort } }); }
    }
    if (!jobs.length) return false;
    const id = await ai.batchSubmit(jobs);
    fill.batch = { id, themeOf, at: Date.now(), n: jobs.length };
    await store.setting('pool_batch', JSON.stringify(fill.batch)).catch(() => {});
    note(`Sammelauftrag abgeschickt: ${jobs.length} Anfragen, ${Object.keys(themeOf).length ? new Set(Object.values(themeOf)).size : 0} Kategorien`);
    return true;
  }
  async function batchWait() {
    const b = fill.batch; if (!b) return;
    for (;;) {
      if (!fill.running) return;
      const st = await ai.batchPoll(b.id).catch((e) => ({ error: e.message }));
      if (st.error) { note('Sammelauftrag: ' + st.error); await new Promise((r) => setTimeout(r, 60000)); continue; }
      fill.batchStatus = st.request_counts ? `${st.request_counts.succeeded || 0} fertig, ${st.request_counts.processing || 0} in Arbeit` : st.processing_status;
      if (st.processing_status === 'ended') {
        const res = await ai.batchResults(st.results_url, (cid) => [themes.byKey(b.themeOf[cid])].filter(Boolean)).catch((e) => { note('Ergebnis: ' + e.message); return []; });
        for (const r of res) { const th = b.themeOf[r.id]; if (th) await accept(th, r.questions); }
        note(`Sammelauftrag fertig nach ${Math.round((Date.now() - b.at) / 60000)} min: ${res.length} von ${b.n} Anfragen erfolgreich`);
        fill.batch = null; fill.batchStatus = ''; await store.setting('pool_batch', '').catch(() => {});
        return;
      }
      await new Promise((r) => setTimeout(r, 30000));
    }
  }
  async function batchLoop() {
    while (fill.running) {
      if (!fill.batch && !(await batchCycle().catch((e) => { note('Sammelauftrag fehlgeschlagen: ' + e.message); return 'err'; }))) { fill.running = false; remember(false); note('Alle Kategorien haben den Zielstand erreicht'); break; }
      if (fill.batch) await batchWait(); else await new Promise((r) => setTimeout(r, 60000));
    }
  }
  async function loop() {
    if (fill.mode === 'batch' && ai.hasKey()) return batchLoop();
    while (fill.running) {
      while (fill.running && fill.inFlight < PARALLEL) {
        const t = nextTheme();
        if (!t) break;
        fillOne(t).then(() => { if (fill.queue.has(t) && playable(t) >= targetOf(t) + 20) fill.queue.delete(t); });
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
  // Bedarf: für jede Kategorie der aktive Spieler (letzte 14 Tage) mit den wenigsten ungesehenen, spielbaren Fragen
  async function needReport() {
    const since = Date.now() - 14 * 86400000;
    const active = (await store.allUsers().catch(() => [])).filter((u) => (Number(u.last_seen) || 0) > since && (Number(u.matches) || 0) > 0);
    const seenGroups = [];
    for (const u of active) { const seen = await store.seenCounts(u.id); const gs = new Set(); for (const id of seen.keys ? seen.keys() : seen) { const g = groupOf.get(id); if (g) gs.add(g); } seenGroups.push({ seen, gs }); }
    const isSeen = (q, x) => x.seen.has(q.id) || (() => { const g = groupFor(q, true); return !!g && x.gs.has(g); })();
    const rows = [];
    for (const t of themes.THEMES) {
      if (SKIP.has(t.key)) continue;
      const list = byTheme.get(t.key).filter((q) => !q.bad); if (!list.length) continue;
      let worst = list.length, who = -1;
      seenGroups.forEach((x, k) => { const un = list.filter((q) => !isSeen(q, x)).length; if (un < worst) { worst = un; who = k; } });
      rows.push({ key: t.key, name: t.name, count: list.length, worst, who: who >= 0 ? active[who].name : '', need: worst < list.length * 0.2 });
    }
    return { active: active.length, rows, at: Date.now() };
  }
  async function fillNeeded() { // wo es knapp ist: Ziel um 20 über den Bestand heben und füllen (auch ohne Automatik)
    const r = await needReport(); let n = 0;
    for (const row of r.rows) if (row.need) { fill.targets[row.key] = Math.max(targetOf(row.key), playable(row.key) + 20); n++; note(`${row.name}: ${row.who} hat nur noch ${row.worst} von ${row.count} ungesehen, fülle nach`); }
    if (n) { saveCfg(); start(); }
    return { ...r, raised: n };
  }
  async function autoCheck() {
    if (!fill.auto) return;
    try { const r = await fillNeeded(); if (r.raised) note(`Automatik: ${r.raised} Kategorien knapp (${r.active} aktive Spieler geprüft)`); } catch (e) { console.error('Pool-Autocheck:', e.message); }
  }


  setInterval(autoCheck, 15 * 60 * 1000);

  function stats(seenByMe) {
    const u = ai.usage, base = fill.startTokens || u;
    return {
      loaded, distinct: reps.length, blocked: badCount, mode: fill.mode, effort: fill.effort, batchStatus: fill.batch ? (fill.batchStatus || 'abgeschickt') : '', running: fill.running, aiOk: ai.enabled(), auto: fill.auto, target: fill.target, inFlight: fill.inFlight, made: fill.made, rejected: fill.rejected,
      tokens: { calls: u.calls - (base.calls || 0), input: u.input - (base.input || 0), output: u.output - (base.output || 0), totalOutput: u.output, totalInput: u.input },
      themes: themes.THEMES.map((t) => {
        const list = byTheme.get(t.key);
        return { key: t.key, name: t.name, target: targetOf(t.key), custom: !!fill.targets[t.key], count: list.filter((q) => !q.bad).length, seen: seenByMe ? list.filter((q) => seenByMe.has(q.id)).length : 0, skip: SKIP.has(t.key) };
      }),
      log: fill.log,
    };
  }
  function setTarget(n) { fill.target = Math.max(20, Math.min(5000, Math.round(Number(n) || 200))); saveCfg(); note(`Standard-Ziel: ${fill.target}`); }
  function setThemeTarget(k, n) {
    const t = themes.byKey(k); if (!t || SKIP.has(k)) return;
    const v = Math.round(Number(n) || 0);
    if (!v) delete fill.targets[k]; else fill.targets[k] = Math.max(20, Math.min(5000, v));
    saveCfg(); note(`${t.name}: Ziel ${targetOf(k)}`);
  }
  function setAuto(on) { fill.auto = !!on; saveCfg(); note(fill.auto ? 'Automatisches Nachfüllen an' : 'Automatisches Nachfüllen aus'); if (fill.auto) autoCheck(); }

  function addLive(list, label) {
    const before = reps.length; add(list);
    if (list.length) note(`${list.length} Fragen durch Live-Match hinzugefügt (${reps.length - before} inhaltlich neu) · ${label}`);
  }
  function seenContent(q, seenIds) {
    const g = groupFor(q, true); if (!g) return false;
    for (const id of seenIds) if (groupOf.get(id) === g) return true;
    return false;
  }
  function setMode(m) { if (['batch', 'direct'].includes(m)) { fill.mode = m; saveCfg(); note(m === 'batch' ? 'Modus: Sammelauftrag (halbe Gebühr, langsamer)' : 'Modus: direkt (schneller, volle Gebühr)'); } }
  function setEffort(e) { if (['low', 'medium', 'high'].includes(e)) { fill.effort = e; saveCfg(); note('Nachdenk-Stufe: ' + e); } }
  return { needReport, fillNeeded, addLive, setThemeTarget, seenContent, setMode, setEffort, load, add, pick, start, stop, stats, setTarget, setAuto, themeOfQ, size: (k) => (byTheme.get(k) || []).length };
};
