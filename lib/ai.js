// Erzeugt während des Lobby-Countdowns neue Fragen über die Anthropic-API.
// Ohne ANTHROPIC_API_KEY ist die Funktion aus und das Spiel nutzt nur den festen Pool.
const { yearRange } = require('./questions');
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const MOCK = Number(process.env.AI_MOCK_MS) || 0; // nur für Tests: simulierte KI mit Verzögerung
const enabled = () => !!KEY || !!MOCK;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Ausgangspunkte für gemischte Runden: bewusst abseits der Standard-Quizthemen
const SEEDS = ['Leuchttürme', 'Bienen und Honig', 'U-Boote', 'Kaffeeanbau', 'Vulkane', 'Brückenbau', 'Seidenstraße', 'Tiefseefische', 'Pyramiden außerhalb Ägyptens', 'Eisenbahnrekorde', 'Wolkenkratzer in Asien', 'Zugvögel', 'Formel 1', 'Olympische Winterspiele', 'Wüsten', 'Korallenriffe', 'Schokolade', 'Käsesorten', 'Gewürze', 'Pilze', 'Dinosaurier-Funde', 'Meteoriten', 'Monde des Saturn', 'Raumsonden', 'Satelliten', 'Uhren und Zeitmessung', 'Erfindungen des Mittelalters', 'Römische Straßen', 'Wikinger', 'Samurai', 'Ritterburgen', 'Kathedralen', 'Talsperren', 'Kanäle und Schleusen', 'Tunnel', 'Flughäfen', 'Containerschiffe', 'Zeppeline', 'Motorräder', 'Oldtimer', 'Elektroautos', 'Traktoren', 'Fahrräder', 'Schach', 'Kartenspiele', 'Brettspiele', 'Videospiel-Geschichte', 'Filmmusik', 'Oper', 'Instrumente', 'Rockbands der 70er', 'Comics', 'Zeichentrickfilme', 'Märchen', 'Weltraumtouristen', 'Polarforschung', 'Antarktis', 'Grönland', 'Inseln im Pazifik', 'Flüsse in Afrika', 'Seen in Südamerika', 'Gebirge in Asien', 'Höhlen', 'Geysire', 'Wasserfälle', 'Regenwald', 'Kakteen', 'Riesenbäume', 'Blumen und Duft', 'Haustiere', 'Pferderassen', 'Hunderassen', 'Katzen', 'Insekten', 'Spinnen', 'Haie', 'Wale', 'Pinguine', 'Elefanten', 'Giraffen', 'Faultiere', 'Papageien', 'Eulen', 'Krokodile', 'Schlangen', 'Frösche', 'Schildkröten', 'Menschlicher Körper: Haut', 'Menschlicher Körper: Blut', 'Schlaf', 'Sinne', 'Ernährung', 'Brot und Backen', 'Bier und Brauen', 'Wein', 'Tee', 'Zucker', 'Salz', 'Papier', 'Glas', 'Stahl', 'Gold', 'Diamanten', 'Kupfer', 'Erdöl', 'Windkraft', 'Solarenergie', 'Batterien', 'Computerchips', 'Internet-Geschichte', 'Smartphones', 'Kameras', 'Fernsehen', 'Radio', 'Telefone', 'Briefmarken', 'Münzen und Geldscheine', 'Banken', 'Börsen früher', 'Kaufhäuser', 'Supermärkte', 'Mode', 'Schuhe', 'Hüte', 'Brillen', 'Parfüm', 'Kosmetik', 'Architekturstile', 'Schlösser', 'Museen', 'Bibliotheken', 'Universitäten', 'Schrift und Alphabete', 'Sprachen der Welt', 'Kalender', 'Feiertage', 'Karneval', 'Feuerwerk', 'Zirkus', 'Freizeitparks', 'Achterbahnen', 'Zoos', 'Aquarien', 'Stadien', 'Fußball-WM', 'Tennis', 'Basketball', 'Radsport', 'Marathon', 'Schwimmen', 'Klettern', 'Segeln', 'Surfen', 'Skispringen', 'Boxen', 'Golf', 'Darts', 'Kochrekorde', 'Weltrekorde des Alltags', 'Guinness-Kuriositäten', 'Wetter und Stürme', 'Blitze', 'Schnee und Eis', 'Erdbeben', 'Gezeiten', 'Mondphasen', 'Sternbilder', 'Kometen', 'Mars', 'Jupiter', 'Sonne', 'Licht und Farben', 'Schall', 'Magnete', 'Roboter', 'Künstliche Intelligenz', 'Mikroskope', 'Teleskope', 'Medizin-Geschichte', 'Impfungen', 'Zahnmedizin früher', 'Feuerwehr', 'Polizei-Geschichte', 'Post und Briefe', 'Kartografie', 'Entdeckungsreisen', 'Piraten', 'Schatzfunde', 'Archäologie', 'Mumien', 'Maya und Azteken', 'Chinesische Kaiser', 'Osmanisches Reich', 'Industrielle Revolution', 'Mondmissionen außer Apollo'];
// Blickwinkel für Themenrunden: jede Frage schaut von einer anderen Seite auf das Thema
const ASPECTS = ['Anfänge und Gründung', 'eine bestimmte Zahl oder Statistik', 'Rekorde', 'eine Person im Hintergrund', 'Orte und Schauplätze', 'Technik und Ausrüstung', 'Regeln und Abläufe', 'Kurioses und Pannen', 'Preise, Geld und Kosten', 'Dauer und Zeiten', 'Größen und Maße', 'Veröffentlichungen und Daten', 'Namen und ihre Herkunft', 'Fans und Community', 'Auszeichnungen', 'Vergleiche zwischen zwei Dingen', 'Entwicklung über die Jahre', 'Details, die kaum jemand kennt', 'Produktion und Entstehung', 'Zahlenspiele rund um das Thema'];

function validate(raw) {
  const out = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r.q !== 'string' || r.q.length < 8 || r.q.length > 180) continue;
    const cat = typeof r.cat === 'string' ? r.cat.slice(0, 20) : 'Wissen';
    if (r.t === 'est') {
      const a = Number(r.a);
      if (!Number.isFinite(a) || a <= 0 || a > 1e12) continue;
      const unit = typeof r.unit === 'string' ? r.unit.slice(0, 16) : '';
      const q = { t: 'est', q: r.q.trim(), a, unit, cat, ai: true };
      if (/^jahr$/i.test(unit)) { q.unit = 'Jahr'; q.range = yearRange(a); }
      out.push(q);
    } else if (r.t === 'mc') {
      const o = Array.isArray(r.o) ? r.o.map((x) => String(x).trim().slice(0, 40)) : [];
      const c = Number(r.c);
      if (o.length !== 4 || new Set(o.map((x) => x.toLowerCase())).size !== 4 || ![0, 1, 2, 3].includes(c)) continue;
      out.push({ t: 'mc', q: r.q.trim(), o: [o[c], ...o.filter((_, i) => i !== c)], cat, ai: true });
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

async function generateOne(count, avoid = [], opts = {}) {
  if (MOCK && !KEY) {
    await new Promise((r) => setTimeout(r, MOCK * (0.5 + Math.random() * 3)));
    const base = (opts.seeds || []).concat(shuffle(SEEDS.slice())).slice(0, count).map((w, i) => ({ t: 'est', q: `Testfrage: Welche Zahl gehört zu ${w} ${Math.random().toString(36).slice(2, 6)}?`, a: 100 + i * 7, unit: 'Stück', cat: 'Test' }));
    // absichtlich Klassiker und Umformulierungen dazwischen, damit die Prüfung greifen muss
    base.splice(0, 3, { t: 'est', q: 'Wie viele Zähne hat ein erwachsener Mensch?', a: 32, unit: 'Zähne', cat: 'Test' }, { t: 'est', q: 'Wie viele Zähne hat ein erwachsener Mann normalerweise?', a: 32, unit: 'Zähne', cat: 'Test' }, { t: 'est', q: 'Wann endete der Zweite Weltkrieg in Europa?', a: 1945, unit: 'Jahr', cat: 'Test' });
    return base;
  }
  if (!KEY) return [];
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
` : ''}- Keine zwei Fragen zum selben Gegenstand, Ort, Tier, Bauwerk, Ereignis oder zur selben Person, und keine zwei mit derselben Art von Zahl.
- Keine dieser Fragen wiederholen oder leicht abwandeln:
${avoid.slice(0, 50).map((t) => '  - ' + String(t).slice(0, 80)).join('\n')}${vary}

Deine Antwort besteht ausschließlich aus dem JSON-Array. Kein Fließtext, keine Einleitung, kein Markdown, keine Code-Blöcke. Das erste Zeichen deiner Antwort ist "[" und das letzte "]".
[{"t":"est","q":"...","a":123.4,"unit":"m","cat":"Bauwerke"},{"t":"mc","q":"...","o":["A","B","C","D"],"c":2,"cat":"Kultur"}]`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), budget);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000, // genug Luft fürs Nachdenken, sonst bricht die Antwort leer ab
        system: 'Du antwortest ausschließlich mit gültigem JSON. Niemals Erklärungen, niemals Markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error('API ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = await res.json();
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

module.exports = { enabled, generate, validate };
