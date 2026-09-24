// Erzeugt während des Lobby-Countdowns neue Fragen über die Anthropic-API.
// Ohne ANTHROPIC_API_KEY ist die Funktion aus und das Spiel nutzt nur den festen Pool.
const { yearRange } = require('./questions');
const KEY = process.env.ANTHROPIC_API_KEY;
let MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'; // im Admin-Menü umschaltbar (Setting ai_model)
const MODELS = { sonnet: 'claude-sonnet-5', haiku: 'claude-haiku-4-5-20251001' };
function setModel(k) { if (MODELS[k]) MODEL = MODELS[k]; }
const modelKey = () => (/haiku/.test(MODEL) ? 'haiku' : 'sonnet');

const usage = { calls: 0, input: 0, output: 0 }; // verbrauchte Tokens seit dem Start
const MOCK = Number(process.env.AI_MOCK_MS) || 0; // nur für Tests: simulierte KI mit Verzögerung
const enabled = () => !!KEY || !!MOCK;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Ausgangspunkte für gemischte Runden: bewusst abseits der Standard-Quizthemen
const SEEDS = ['Leuchttürme', 'Bienen und Honig', 'U-Boote', 'Kaffeeanbau', 'Vulkane', 'Brückenbau', 'Seidenstraße', 'Tiefseefische', 'Pyramiden außerhalb Ägyptens', 'Eisenbahnrekorde', 'Wolkenkratzer in Asien', 'Zugvögel', 'Formel 1', 'Olympische Winterspiele', 'Wüsten', 'Korallenriffe', 'Schokolade', 'Käsesorten', 'Gewürze', 'Pilze', 'Dinosaurier-Funde', 'Meteoriten', 'Monde des Saturn', 'Raumsonden', 'Satelliten', 'Uhren und Zeitmessung', 'Erfindungen des Mittelalters', 'Römische Straßen', 'Wikinger', 'Samurai', 'Ritterburgen', 'Kathedralen', 'Talsperren', 'Kanäle und Schleusen', 'Tunnel', 'Flughäfen', 'Containerschiffe', 'Zeppeline', 'Motorräder', 'Oldtimer', 'Elektroautos', 'Traktoren', 'Fahrräder', 'Schach', 'Kartenspiele', 'Brettspiele', 'Videospiel-Geschichte', 'Filmmusik', 'Oper', 'Instrumente', 'Rockbands der 70er', 'Comics', 'Zeichentrickfilme', 'Märchen', 'Weltraumtouristen', 'Polarforschung', 'Antarktis', 'Grönland', 'Inseln im Pazifik', 'Flüsse in Afrika', 'Seen in Südamerika', 'Gebirge in Asien', 'Höhlen', 'Geysire', 'Wasserfälle', 'Regenwald', 'Kakteen', 'Riesenbäume', 'Blumen und Duft', 'Haustiere', 'Pferderassen', 'Hunderassen', 'Katzen', 'Insekten', 'Spinnen', 'Haie', 'Wale', 'Pinguine', 'Elefanten', 'Giraffen', 'Faultiere', 'Papageien', 'Eulen', 'Krokodile', 'Schlangen', 'Frösche', 'Schildkröten', 'Menschlicher Körper: Haut', 'Menschlicher Körper: Blut', 'Schlaf', 'Sinne', 'Ernährung', 'Brot und Backen', 'Bier und Brauen', 'Wein', 'Tee', 'Zucker', 'Salz', 'Papier', 'Glas', 'Stahl', 'Gold', 'Diamanten', 'Kupfer', 'Erdöl', 'Windkraft', 'Solarenergie', 'Batterien', 'Computerchips', 'Internet-Geschichte', 'Smartphones', 'Kameras', 'Fernsehen', 'Radio', 'Telefone', 'Briefmarken', 'Münzen und Geldscheine', 'Banken', 'Börsen früher', 'Kaufhäuser', 'Supermärkte', 'Mode', 'Schuhe', 'Hüte', 'Brillen', 'Parfüm', 'Kosmetik', 'Architekturstile', 'Schlösser', 'Museen', 'Bibliotheken', 'Universitäten', 'Schrift und Alphabete', 'Sprachen der Welt', 'Kalender', 'Feiertage', 'Karneval', 'Feuerwerk', 'Zirkus', 'Freizeitparks', 'Achterbahnen', 'Zoos', 'Aquarien', 'Stadien', 'Fußball-WM', 'Tennis', 'Basketball', 'Radsport', 'Marathon', 'Schwimmen', 'Klettern', 'Segeln', 'Surfen', 'Skispringen', 'Boxen', 'Golf', 'Darts', 'Kochrekorde', 'Weltrekorde des Alltags', 'Guinness-Kuriositäten', 'Wetter und Stürme', 'Blitze', 'Schnee und Eis', 'Erdbeben', 'Gezeiten', 'Mondphasen', 'Sternbilder', 'Kometen', 'Mars', 'Jupiter', 'Sonne', 'Licht und Farben', 'Schall', 'Magnete', 'Roboter', 'Künstliche Intelligenz', 'Mikroskope', 'Teleskope', 'Medizin-Geschichte', 'Impfungen', 'Zahnmedizin früher', 'Feuerwehr', 'Polizei-Geschichte', 'Post und Briefe', 'Kartografie', 'Entdeckungsreisen', 'Piraten', 'Schatzfunde', 'Archäologie', 'Mumien', 'Maya und Azteken', 'Chinesische Kaiser', 'Osmanisches Reich', 'Industrielle Revolution', 'Mondmissionen außer Apollo'];
// Blickwinkel für Themenrunden: jede Frage schaut von einer anderen Seite auf das Thema
const ASPECTS = ['Anfänge und Gründung', 'eine bestimmte Zahl oder Statistik', 'Rekorde', 'eine Person im Hintergrund', 'Orte und Schauplätze', 'Technik und Ausrüstung', 'Regeln und Abläufe', 'Kurioses und Pannen', 'Preise, Geld und Kosten', 'Dauer und Zeiten', 'Größen und Maße', 'Veröffentlichungen und Daten', 'Namen und ihre Herkunft', 'Fans und Community', 'Auszeichnungen', 'Vergleiche zwischen zwei Dingen', 'Entwicklung über die Jahre', 'Details, die kaum jemand kennt', 'Produktion und Entstehung', 'Zahlenspiele rund um das Thema'];

// Steckt die Lösung schon in der Frage? Zahl steht drin, oder sie lässt sich aus zwei Zahlen der Frage ausrechnen
function leaks(q) {
  const nums = (String(q.q).match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(/\./g, '').replace(',', '.'))).filter(Number.isFinite);
  if (q.t === 'est') {
    const a = Number(q.a);
    if (nums.some((n) => n === a)) return true;
    for (let i = 0; i < nums.length; i++) for (let k = 0; k < nums.length; k++) {
      if (i === k) continue;
      const x = nums[i], y = nums[k];
      if (Math.abs(x - y) === a || x + y === a || (y && Math.abs(x / y - a) < 1e-9) || x * y === a) return true;
    }
    if (/zwischen\s+\d{3,4}\s+und\s+\d{3,4}|wie viele jahre (?:lagen|liegen|vergingen)/i.test(q.q)) return true; // Differenz-Fragen
    const months = (String(q.q).match(/januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember/gi) || []).length;
    if (months >= 2 && /monat|wochen|tage/i.test(q.q)) return true; // Monate zwischen zwei genannten Monaten
  } else if (q.t === 'mc') {
    const right = String(q.o[0]).toLowerCase().trim();
    if (right.length >= 4 && String(q.q).toLowerCase().includes(right)) return true;
  }
  return false;
}
const EST_QTY = /\b(wie\s*viele?|wieviele?|wie\s+(hoch|lang|lange|groß|gross|schwer|weit|alt|tief|breit|schnell|teuer|oft|warm|kalt|heiß(?!t)|dick)|in\s+welchem\s+jahr|welche[mrs]?\s+jahr|wann|um\s+wie\s+viel|wie\s+viel\s+prozent|welche[rsn]?\s+(anzahl|höhe|länge|größe|gewicht|zahl|temperatur|geschwindigkeit|fläche|entfernung|dauer|summe|preis|nummer)|anzahl\b|prozent|wie\s+lange\s+dauer)/i;
const isQtyQuestion = (q) => EST_QTY.test(String(q || '')); // Schätzfragen müssen nach einer Menge, Zahl oder Jahr fragen, nie nach Ort oder Namen
function validate(raw) {
  const out = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r.q !== 'string' || r.q.length < 8 || r.q.length > 180) continue;
    const cat = typeof r.cat === 'string' ? r.cat.slice(0, 20) : 'Wissen';
    if (r.t === 'est') {
      const a = Number(r.a);
      if (!Number.isFinite(a) || a <= 0 || a > 1e12) continue;
      if (!isQtyQuestion(r.q)) continue; // z. B. „Welcher Ort …“ ist keine Schätzfrage
      const unit = typeof r.unit === 'string' ? r.unit.slice(0, 16) : '';
      const q = { t: 'est', q: r.q.trim(), a, unit, cat, ai: true, s: typeof r.s === 'string' ? r.s.slice(0, 60) : '' };
      if (leaks(q)) continue;
      if (/^jahr$/i.test(unit)) { q.unit = 'Jahr'; q.range = yearRange(a); }
      out.push(q);
    } else if (r.t === 'mc') {
      const o = Array.isArray(r.o) ? r.o.map((x) => String(x).trim()) : [];
      if (o.some((x) => x.length > 60)) continue; // zu lange Antworten nicht abschneiden, sondern die Frage verwerfen
      const c = Number(r.c);
      if (o.length !== 4 || new Set(o.map((x) => x.toLowerCase())).size !== 4 || ![0, 1, 2, 3].includes(c)) continue;
      const mq = { t: 'mc', q: r.q.trim(), o: [o[c], ...o.filter((_, i) => i !== c)], cat, ai: true, s: typeof r.s === 'string' ? r.s.slice(0, 60) : '' };
      if (leaks(mq)) continue;
      out.push(mq);
    }
  }
  return out;
}

// Auch abgeschnittene Antworten auswerten: jedes vollständige Objekt zählt
function parseList(text) {
  const s = text.indexOf('[');
  if (s < 0) throw new Error('Kein JSON in der Antwort');
  const e = text.lastIndexOf(']');
  if (e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch (err) { /* weiter unten retten */ } }
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = s; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; continue; }
    if (c === '}') { depth--; if (depth === 0 && start >= 0) { try { out.push(JSON.parse(text.slice(start, i + 1))); } catch (err) {} start = -1; } }
  }
  if (!out.length) throw new Error('Kein JSON in der Antwort');
  return out;
}

async function generate(count, avoid = [], opts = {}) {

  // Große Aufträge in Häppchen zerlegen: das Modell denkt sonst das ganze Budget weg
  const CHUNK = 5; // kleine Portionen: die KI denkt kürzer und antwortet zuverlässiger
  // Jede Frage bekommt einen eigenen Ausgangspunkt, zufällig und ohne Wiederholung: so ähneln sich die Fragen einer Runde nicht
  const seeds = shuffle(opts.themes && opts.themes.length ? ASPECTS.slice() : SEEDS.slice());
  const seedFor = (i) => seeds[i % seeds.length];
  if (count <= CHUNK) return generateOne(count, avoid, { ...opts, seeds: Array.from({ length: count }, (_, i) => seedFor(i)) }).then((r) => { if (opts.onChunk) opts.onChunk(r); return r; });
  if (count > CHUNK) {
    // Häppchen parallel anfragen: nacheinander dauert es mit einem nachdenkenden Modell zu lange
    const parts = Math.ceil(count / CHUNK);
    const t0 = Date.now();
    const results = await Promise.all(Array.from({ length: parts }, (_, i) => {
      const n = i < parts - 1 ? CHUNK : count - CHUNK * (parts - 1);
      const ts = Date.now();
      return generateOne(n, avoid, { ...opts, variant: i, seeds: Array.from({ length: n }, (_, k) => seedFor(i * CHUNK + k)) })
        .then((r) => { console.log(`KI-Häppchen ${i + 1}/${parts}: ${r.length} Fragen in ${Math.round((Date.now() - ts) / 1000)} s`); if (opts.onChunk) opts.onChunk(r); return r; })
        .catch((e) => { console.error(`KI-Häppchen ${i + 1}/${parts} fehlgeschlagen nach ${Math.round((Date.now() - ts) / 1000)} s:`, e.message); return []; });
    }));
    // doppelte Fragen zwischen den Häppchen entfernen
    const seen = new Set(), out = [];
    for (const q of results.flat()) { const k = String(q.q).toLowerCase().slice(0, 60); if (!seen.has(k)) { seen.add(k); out.push(q); } }
    console.log(`KI gesamt: ${out.length} von ${count} Fragen in ${Math.round((Date.now() - t0) / 1000)} s`);
    if (!out.length) throw new Error('Keine Fragen erhalten');
    return out;
  }
}

function buildPrompt(count, avoid = [], opts = {}) {
  const themeList = opts.themes && opts.themes.length ? opts.themes : null;
  const budget = Math.max(15000, Math.min(240000, opts.timeout || 100000));
  const mc = Math.max(1, Math.round(count * 0.25));
  const vary = opts.variant != null ? `\nDies ist Teil ${opts.variant + 1} einer größeren Runde: Wähle bewusst andere Unterthemen als die naheliegendsten, beginne beim ${['ungewöhnlichsten', 'historischsten', 'technischsten', 'alltäglichsten', 'überraschendsten', 'zahlenlastigsten'][opts.variant % 6]} Aspekt.` : '';
  const prompt = `Erstelle ${count} Quizfragen auf Deutsch für ein Schätzspiel unter Freunden: ${count - mc} Schätzfragen und ${mc} Auswahlfragen.
${themeList ? `\nWICHTIG: Alle Fragen müssen zu diesen Themen passen, zu keinem anderen: ${themeList.map((t) => t.name).join(', ')}. Verteile die Fragen gleichmäßig auf diese Themen. Schreibe in \"cat\" genau einen dieser Themennamen.\n${themeList.filter((t) => t.hint).map((t) => `Zum Thema ${t.name}: ${t.hint}`).join('\n')}` : ''}

Regeln:
- Nur Fakten, bei denen du dir beim exakten Wert sehr sicher bist und die sich nicht laufend ändern (keine Einwohnerzahlen, Börsenwerte, aktuellen Rekorde, Amtsinhaber).
- Schätzfragen haben genau eine positive Zahl als Antwort. Die Einheit steht NICHT im Zahlwert, sondern im Feld "unit". Bei Jahreszahlen ist unit "Jahr". Große Werte als "Mio." oder "Mrd." in der Einheit ausdrücken, wenn der exakte Wert unüblich ist.
- Die Frage muss eindeutig sein (welcher Messpunkt, welches Jahr, mit oder ohne Antenne usw.).
${themeList ? '- Bleib strikt bei den oben genannten Themen.' : '- Bunte Mischung: Geografie, Geschichte, Technik, Auto, Sport, Natur, Weltall, Essen, Film, Musik, Alltag.'} Mittelschwer, gern überraschend.
- Auswahlfragen haben 4 plausible Optionen, "c" ist der Index (0-3) der richtigen.
- Sei erfinderisch: nimm ungewöhnliche Blickwinkel, seltener genutzte Beispiele und Zahlen, die man nicht sofort im Kopf hat.
- VERBOTEN sind Standard-Quizfragen, die in jedem Quiz vorkommen, zum Beispiel: Zähne oder Knochen eines Menschen, Ende oder Beginn des Zweiten Weltkriegs, Höhe des Mount Everest, Mauerfall, Mondlandung, Lichtgeschwindigkeit, Länge der Chinesischen Mauer, Felder eines Schachbretts, Tasten eines Klaviers, Sekunden eines Tages, Herzschläge, Einführung des Euro, erstes iPhone. Solche Fakten und ihre Umformulierungen nie verwenden.
${opts.seeds && opts.seeds.length ? `- Jede Frage hat einen eigenen Ausgangspunkt. Frage 1 dreht sich um den ersten, Frage 2 um den zweiten und so weiter: ${opts.seeds.map((x, i) => `${i + 1}. ${x}`).join('; ')}.${opts.themes && opts.themes.length ? ' Das sind Blickwinkel innerhalb der oben genannten Themen.' : ''}
` : ''}- Keine zwei Fragen zum selben Gegenstand, Ort, Tier, Bauwerk, Ereignis, Werk oder zur selben Person, und keine zwei mit derselben Art von Zahl. Bei Themen mit bekannten Namen (Autoren, Bands, Spieler, Filme) jede Frage zu einem anderen Namen, gern auch zu weniger bekannten.
- Auswahlfragen: jede der vier Antworten höchstens 40 Zeichen, kurz und knackig.
- Keine Rechenaufgaben: Die Frage darf keine Zahlen enthalten, aus denen man die Antwort ausrechnen kann (keine "wie viele Jahre zwischen X und Y"), und die Antwort darf nicht in der Frage stehen.
- Gib in "s" den Hauptgegenstand der Frage an (Person, Werk, Ort oder Ding), kurz, zum Beispiel "Colleen Hoover" oder "Eiffelturm".
- Keine dieser Fragen wiederholen oder leicht abwandeln:
${avoid.slice(0, 50).map((t) => '  - ' + String(t).slice(0, 80)).join('\n')}${vary}

Deine Antwort besteht ausschließlich aus dem JSON-Array. Kein Fließtext, keine Einleitung, kein Markdown, keine Code-Blöcke. Das erste Zeichen deiner Antwort ist "[" und das letzte "]".
[{"t":"est","q":"...","a":123.4,"unit":"m","cat":"Bauwerke","s":"..."},{"t":"mc","q":"...","o":["A","B","C","D"],"c":2,"cat":"Kultur","s":"..."}]`;

  return { prompt, themeList, budget };
}

async function generateOne(count, avoid = [], opts = {}) {
  if (MOCK && !KEY) {
    await new Promise((r) => setTimeout(r, MOCK * (0.5 + Math.random() * 3)));
    const base = (opts.seeds || []).concat(shuffle(SEEDS.slice())).slice(0, count).map((w, i) => ({ t: 'est', q: `Testfrage: Welche Zahl gehört zu ${w} ${Math.random().toString(36).slice(2, 6)}?`, a: 100 + i * 7, unit: 'Stück', cat: 'Test' }));
    // absichtlich Klassiker und Umformulierungen dazwischen, damit die Prüfung greifen muss
    base.splice(0, 3, { t: 'est', q: 'Wie viele Zähne hat ein erwachsener Mensch?', a: 32, unit: 'Zähne', cat: 'Test' }, { t: 'est', q: 'Wie viele Zähne hat ein erwachsener Mann normalerweise?', a: 32, unit: 'Zähne', cat: 'Test' }, { t: 'est', q: 'Wann endete der Zweite Weltkrieg in Europa?', a: 1945, unit: 'Jahr', cat: 'Test' });
    return base;
  }
  if (!KEY) return [];
  const { prompt, themeList, budget } = buildPrompt(count, avoid, opts);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), budget);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(requestBody(prompt, opts.effort)),
    });
    if (!res.ok) throw new Error('API ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    count_usage(data.usage);
    let text = (data.content || []).map((b) => b.text || '').join('');
    if (!text.trim()) throw new Error('Leere Antwort (' + (data.stop_reason || 'unbekannt') + ')');

    let out;
    try { out = validate(parseList(text)); }
    catch (e) {
      console.error('KI-Antwort unbrauchbar (' + (data.stop_reason || '?') + '):', text.slice(0, 180).replace(/\n/g, ' '));
      throw e;
    }
    if (themeList) { const byName = Object.fromEntries(themeList.map((t) => [t.name.toLowerCase(), t.key])); for (const q of out) q.theme = byName[String(q.cat).toLowerCase()] || themeList[0].key; }
    return out;
  } finally { clearTimeout(timer); }
}

// Anfrage-Körper: 'effort' steuert, wie viel die KI nachdenkt. Weniger Nachdenken = weniger Ausgabe-Tokens = günstiger.
function requestBody(prompt, effort) {
  const b = { model: MODEL, max_tokens: 16000, system: 'Du antwortest ausschließlich mit gültigem JSON. Niemals Erklärungen, niemals Markdown.', messages: [{ role: 'user', content: prompt }] };
  if (effort && !/haiku/.test(MODEL)) b.output_config = { effort }; // Haiku 4.5 kennt den effort-Parameter nicht (laut Doku)
  return b;
}
function count_usage(u, factor = 1) { if (!u) return; usage.calls++; usage.input += (u.input_tokens || 0) * factor; usage.output += (u.output_tokens || 0) * factor; }
function parseText(text, themeList) {
  const out = validate(parseList(text));
  if (themeList) { const byName = Object.fromEntries(themeList.map((t) => [t.name.toLowerCase(), t.key])); for (const q of out) q.theme = byName[String(q.cat).toLowerCase()] || themeList[0].key; }
  return out;
}

// ---------- Batch: viele Anfragen gesammelt, kostet die Hälfte, Ergebnis kommt meist nach Minuten ----------
async function batchSubmit(jobs) {
  // jobs: [{ id, count, avoid, opts }]
  const requests = jobs.map((j) => ({ custom_id: j.id, params: requestBody(buildPrompt(j.count, j.avoid, j.opts).prompt, j.opts.effort) }));
  const res = await fetch('https://api.anthropic.com/v1/messages/batches', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ requests }) });
  if (!res.ok) throw new Error('Batch ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return (await res.json()).id;
}
async function batchPoll(id) {
  const res = await fetch('https://api.anthropic.com/v1/messages/batches/' + id, { headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' } });
  if (!res.ok) throw new Error('Batch-Status ' + res.status);
  return res.json(); // processing_status, request_counts, results_url
}
async function batchResults(url, themeFor) {
  const res = await fetch(url, { headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' } });
  if (!res.ok) throw new Error('Batch-Ergebnis ' + res.status);
  const out = [];
  for (const line of (await res.text()).split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (!r.result || r.result.type !== 'succeeded') continue;
      const msg = r.result.message; count_usage(msg.usage, 0.5); // Batch kostet die Hälfte: so zählt der Zähler den echten Gegenwert
      const text = (msg.content || []).map((b) => b.text || '').join('');
      out.push({ id: r.custom_id, questions: parseText(text, themeFor(r.custom_id)) });
    } catch (e) { /* einzelne kaputte Zeile überspringen */ }
  }
  return out;
}

const seedList = (themed, n) => shuffle((themed ? ASPECTS : SEEDS).slice()).slice(0, n);
module.exports = { isQtyQuestion, setModel, modelKey, enabled, generate, validate, leaks, usage, batchSubmit, batchPoll, batchResults, hasKey: () => !!KEY, buildPrompt, requestBody, seedList };
