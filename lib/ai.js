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

async function generate(count, avoid = []) {
  if (!KEY) return [];
  const mc = Math.max(1, Math.round(count * 0.25));
  const prompt = `Erstelle ${count} Quizfragen auf Deutsch für ein Schätzspiel unter Freunden: ${count - mc} Schätzfragen und ${mc} Auswahlfragen.

Regeln:
- Nur Fakten, bei denen du dir beim exakten Wert sehr sicher bist und die sich nicht laufend ändern (keine Einwohnerzahlen, Börsenwerte, aktuellen Rekorde, Amtsinhaber).
- Schätzfragen haben genau eine positive Zahl als Antwort. Die Einheit steht NICHT im Zahlwert, sondern im Feld "unit". Bei Jahreszahlen ist unit "Jahr". Große Werte als "Mio." oder "Mrd." in der Einheit ausdrücken, wenn der exakte Wert unüblich ist.
- Die Frage muss eindeutig sein (welcher Messpunkt, welches Jahr, mit oder ohne Antenne usw.).
- Bunte Mischung: Geografie, Geschichte, Technik, Auto, Sport, Natur, Weltall, Essen, Film, Musik, Alltag. Mittelschwer, gern überraschend.
- Auswahlfragen haben 4 plausible Optionen, "c" ist der Index (0-3) der richtigen.
- Keine dieser Fragen wiederholen oder leicht abwandeln:
${avoid.slice(0, 80).map((t) => '  - ' + t).join('\n')}

Antworte NUR mit einem JSON-Array, ohne Text davor oder danach, ohne Markdown:
[{"t":"est","q":"...","a":123.4,"unit":"m","cat":"Bauwerke"},{"t":"mc","q":"...","o":["A","B","C","D"],"c":2,"cat":"Kultur"}]`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 100000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error('API ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    const s = text.indexOf('['), e = text.lastIndexOf(']');
    if (s < 0 || e < 0) throw new Error('Kein JSON in der Antwort');
    return validate(JSON.parse(text.slice(s, e + 1)));
  } finally { clearTimeout(timer); }
}

module.exports = { enabled, generate, validate };
