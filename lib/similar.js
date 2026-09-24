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
  if (near && j >= 0.4) return true;
  // gleiche Zahl als Antwort und mindestens zwei gemeinsame Stichwörter: fast immer dieselbe Frage anders formuliert
  const exact = aa != null && ab != null && Number.isFinite(x) && x === y && !(Number.isInteger(x) && x <= 12);
  return exact && overlap(ta, tb) >= 2;
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
// Klassiker, die in jedem Quiz vorkommen: nie als frische Frage durchlassen
const CLASSICS = [
  { q: 'Wie viele Zähne hat ein erwachsener Mensch?', a: 32 }, { q: 'Wie viele Knochen hat ein erwachsener Mensch?', a: 206 },
  { q: 'In welchem Jahr endete der Zweite Weltkrieg?', a: 1945 }, { q: 'In welchem Jahr begann der Zweite Weltkrieg?', a: 1939 },
  { q: 'Wie hoch ist der Mount Everest?', a: 8849 }, { q: 'In welchem Jahr fiel die Berliner Mauer?', a: 1989 },
  { q: 'In welchem Jahr landeten Menschen zum ersten Mal auf dem Mond?', a: 1969 }, { q: 'Wie schnell ist das Licht?', a: 299792 },
  { q: 'Wie lang ist die Chinesische Mauer?', a: 21196 }, { q: 'Wie viele Felder hat ein Schachbrett?', a: 64 },
  { q: 'Wie viele Tasten hat ein Klavier?', a: 88 }, { q: 'Wie viele Sekunden hat ein Tag?', a: 86400 },
  { q: 'In welchem Jahr wurde der Euro als Bargeld eingeführt?', a: 2002 }, { q: 'In welchem Jahr erschien das erste iPhone?', a: 2007 },
];
CLASSICS.push(
  { q: 'Wie viele Kinder haben Molly und Arthur Weasley?', a: 7 }, { q: 'Wie viele Kinder hat die Familie Weasley?', a: 7 }, { q: 'Wie viele Punkte gibt es für das Fangen des Goldenen Schnatzes?', a: 150 },
  { q: 'Wie viele Herzen hat ein Oktopus?', a: 3 }, { q: 'Wie viele Beine hat eine Spinne?', a: 8 }, { q: 'Wie viele Knochen hat der menschliche Körper?', a: 206 });
const isClassic = (q) => CLASSICS.some((c) => similar(c.q, q.q, c.a, q.a));
module.exports = { tokens, jaccard, similar, makeIndex, inIndex, learn, nearlyIdentical, CLASSICS, isClassic };
