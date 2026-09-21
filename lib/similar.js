// Erkennt inhaltlich gleiche Fragen, auch wenn sie anders formuliert sind
const STOP = new Set('der die das den dem des ein eine einer eines einem einen wie viele viel welche welcher welches was wer wo wann ist sind war waren hat haben hatte gibt es im in am an auf aus bei von vom zum zur zu und oder fuer für ungefähr etwa circa ca insgesamt jahr jahre jahren meter kilometer prozent sich man durchschnittlich durchschnitt heute lang hoch gross groß alt'.split(' '));
const norm = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ');
// grobe Wortstämme, damit "erwachsener/erwachsenen" und "Mann/Mensch" nah beieinander liegen
const stem = (w) => w.replace(/(en|er|es|em|e|n|s)$/, '').slice(0, 6);
function tokens(q) { return new Set(norm(q).split(/\s+/).filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !STOP.has(w)).map((w) => (/^\d+$/.test(w) ? '#' + w : stem(w)))); }
// Gewichte: Wörter, die in vielen Fragen vorkommen, zählen wenig, seltene (Namen, Dinge) viel
const DF = new Map(); let DOCS = 0;
function learn(texts) { for (const t of texts) { DOCS++; for (const w of tokens(t)) DF.set(w, (DF.get(w) || 0) + 1); } }
const wt = (w) => Math.log((DOCS + 2) / ((DF.get(w) || 0) + 1));
function wj(a, b) {
  let inter = 0, uni = 0;
  for (const x of new Set([...a, ...b])) { const g = wt(x); uni += g; if (a.has(x) && b.has(x)) inter += g; }
  return uni ? inter / uni : 0;
}
function overlap(a, b) { let i = 0; for (const x of a) if (b.has(x)) i++; return i; }
function jaccard(a, b) { if (!a.size || !b.size) return 0; const i = overlap(a, b); return i / (a.size + b.size - i); }
// gleich: die gewichtigen Wörter stimmen weitgehend überein, oder (fast) gleiche Antwort bei ähnlichen Wörtern
function same(ta, tb, aa, ab) {
  if (!ta.size || !tb.size) return false;
  const j = wj(ta, tb);
  if (j >= 0.62) return true;
  const x = Number(aa), y = Number(ab);
  const isYear = (v) => Number.isInteger(v) && v >= 1000 && v <= 2100;
  const near = aa != null && ab != null && Number.isFinite(x) && Number.isFinite(y) && (isYear(x) && isYear(y) ? x === y : Math.abs(x - y) <= Math.max(1e-9, Math.abs(x) * 0.02));
  return near && j >= 0.4;
}
function similar(qa, qb, ansA, ansB) { return same(tokens(qa), tokens(qb), ansA, ansB); }
function makeIndex(list) { return list.map((q) => ({ t: tokens(typeof q === 'string' ? q : q.q), a: typeof q === 'string' ? null : q.a })); }
function inIndex(idx, q) {
  const t = tokens(q.q);
  return idx.some((x) => same(t, x.t, q.a, x.a));
}
// Grundwortschatz aus dem festen Pool lernen
try { const P = require('./questions'); learn((P.pool || []).map((q) => q.q)); } catch (e) {}
// Nur fast wortgleiche Fragen (für den festen Pool)
function nearlyIdentical(qa, qb) { return wj(tokens(qa), tokens(qb)) >= 0.8; }
module.exports = { tokens, jaccard, similar, makeIndex, inIndex, learn, nearlyIdentical };
