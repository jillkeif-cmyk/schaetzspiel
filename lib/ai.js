// Erzeugt während des Lobby-Countdowns neue Fragen über die Anthropic-API.
// Ohne ANTHROPIC_API_KEY ist die Funktion aus und das Spiel nutzt nur den festen Pool.
const { yearRange } = require('./questions');
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const enabled = () => !!KEY;

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
  if (!KEY) return [];
  const themeList = opts.themes && opts.themes.length ? opts.themes : null;
  const budget = Math.max(15000, Math.min(240000, opts.timeout || 100000));
  const mc = Math.max(1, Math.round(count * 0.25));
  const prompt = `Erstelle ${count} Quizfragen auf Deutsch für ein Schätzspiel unter Freunden: ${count - mc} Schätzfragen und ${mc} Auswahlfragen.
${themeList ? `\nWICHTIG: Alle Fragen müssen zu diesen Themen passen, zu keinem anderen: ${themeList.map((t) => t.name).join(', ')}. Verteile die Fragen gleichmäßig auf diese Themen. Schreibe in \"cat\" genau einen dieser Themennamen.\n${themeList.filter((t) => t.hint).map((t) => `Zum Thema ${t.name}: ${t.hint}`).join('\n')}` : ''}

Regeln:
- Nur Fakten, bei denen du dir beim exakten Wert sehr sicher bist und die sich nicht laufend ändern (keine Einwohnerzahlen, Börsenwerte, aktuellen Rekorde, Amtsinhaber).
- Schätzfragen haben genau eine positive Zahl als Antwort. Die Einheit steht NICHT im Zahlwert, sondern im Feld "unit". Bei Jahreszahlen ist unit "Jahr". Große Werte als "Mio." oder "Mrd." in der Einheit ausdrücken, wenn der exakte Wert unüblich ist.
- Die Frage muss eindeutig sein (welcher Messpunkt, welches Jahr, mit oder ohne Antenne usw.).
${themeList ? '- Bleib strikt bei den oben genannten Themen.' : '- Bunte Mischung: Geografie, Geschichte, Technik, Auto, Sport, Natur, Weltall, Essen, Film, Musik, Alltag.'} Mittelschwer, gern überraschend.
- Auswahlfragen haben 4 plausible Optionen, "c" ist der Index (0-3) der richtigen.
- Sei erfinderisch: nimm ungewöhnliche Blickwinkel, seltener genutzte Beispiele und Zahlen, die man nicht sofort im Kopf hat. Wiederhole keine Klassiker.
- Keine dieser Fragen wiederholen oder leicht abwandeln:
${avoid.slice(0, 80).map((t) => '  - ' + t).join('\n')}

Antworte NUR mit einem JSON-Array, ohne Text davor oder danach, ohne Markdown:
[{"t":"est","q":"...","a":123.4,"unit":"m","cat":"Bauwerke"},{"t":"mc","q":"...","o":["A","B","C","D"],"c":2,"cat":"Kultur"}]`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), budget);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: Math.min(16000, 900 + count * 320), messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error('API ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    const out = validate(parseList(text));
    if (themeList) { const byName = Object.fromEntries(themeList.map((t) => [t.name.toLowerCase(), t.key])); for (const q of out) q.theme = byName[String(q.cat).toLowerCase()] || themeList[0].key; }
    return out;
  } finally { clearTimeout(timer); }
}

module.exports = { enabled, generate, validate };
