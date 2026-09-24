// Narrenkappe: 5 Walzen, 3 Reihen, 10 Gewinnlinien (Idee wie Merkurs „Jolly's Cap“, eigene Halloween-Symbole).
// Gewonnen wird mit 3 bis 5 gleichen Symbolen von links. Der Kürbisnarr (W) ersetzt jedes Symbol außer der Kappe.
// Die Geister-Narrenkappe (N, nur auf Walze 2 bis 4) schüttelt sich: sie wird selbst zum Narren und verwandelt
// zufällig weitere Felder in Narren, manchmal auch keins. Keine Freispiele, dafür die bekannte Risikoleiter.
const { randomInt } = require('crypto');
const NAMES = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A', G: 'Geisterpferd', V: 'Rabe', P: 'Hexenprinzessin', O: 'Kürbiskönig', W: 'Kürbisnarr', N: 'Narrenkappe' };
// Gewinn je Linie als Vielfaches des Linieneinsatzes (Einsatz / 10) für 3, 4, 5 gleiche
const PAY = { T: [5, 25, 100], J: [5, 25, 100], Q: [5, 25, 100], K: [5, 40, 150], A: [5, 40, 150], G: [10, 75, 250], V: [10, 75, 250], P: [15, 150, 500], O: [25, 250, 1000], W: [50, 500, 2000] };
const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 1, 2, 1]];
// Walzenstreifen (feste Reihenfolge), per Werkzeug abgestimmt
let STRIPS = ['AOVJGAGKJTWKQAWTJPKTVVQTATOQTKJTQPQTJKAJQAKJQJAGQK', 'AKTKTKGAJJQOKPQVQKJTJJAAKPAJGQJKQTAQQJTTTGQVWVOWAT', 'QQTGJQTQVTJWJTQPKNAKKAKJTGAVQTAATGKJPQOJKWQJAAJOTVK',
  'QPAOKTJPTAAKTQGJTAQWJGTKQOQAVAQTATVWTJKGJJJKKKQJVQ', 'TAVJAQPKJKTQVKAQKJJATOTTQAGVQQTTJTOJQAJKAQJKPWKGWG'].map((x) => x.split('')); // 2 Narren je Walze, Kappe nur auf Walze 3
// Wie viele weitere Felder die Kappe verwandelt (Gewichte für 0, 1, 2, 3, 4, 6)
let CAP_K = [0, 1, 2, 3, 4, 6, 9, 12], CAP_W = [2200, 840, 700, 420, 260, 144, 54, 17]; // bis 12 Felder wie im Original (9+ in ≈ 1,5 % der Kappen), Auszahlung ≈ 95 % (7 × 0,85 Mio. Drehs)
const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
const pickW = (vals, w, rnd) => { let x = rnd(w.reduce((a, b) => a + b, 0)); for (let i = 0; i < w.length; i++) { if (x < w[i]) return vals[i]; x -= w[i]; } return vals[0]; };
const spinGrid = (rnd = randomInt) => STRIPS.map((s) => { const i = rnd(s.length); return [s[i], s[(i + 1) % s.length], s[(i + 2) % s.length]]; }); // [walze][reihe]
function capShake(g, rnd = randomInt, forceExtra = null) { // Kappen werden Narren, dazu zufällig weitere Felder
  const caps = []; g.forEach((col, c) => col.forEach((x, r) => { if (x === 'N') caps.push([c, r]); }));
  if (!caps.length) return null;
  const turned = [];
  const extra = forceExtra !== null ? forceExtra : pickW(CAP_K, CAP_W, rnd), free = []; g.forEach((col, c) => col.forEach((x, r) => { if (x !== 'W' && x !== 'N') free.push([c, r]); }));
  for (let k = 0; k < extra && free.length; k++) { const [c, r] = free.splice(rnd(free.length), 1)[0]; g[c][r] = 'W'; turned.push([c, r]); }
  return { caps: caps.length, extra, turned };
}
function evaluate(g, bet) {
  const lb = bet / 10, lines = [];
  LINES.forEach((L, n) => {
    const s = L.map((r, c) => g[c][r]); let best = null;
    // Reiner Narren-Lauf von links
    let w = 0; while (w < 5 && s[w] === 'W') w++;
    if (w >= 3) best = { sym: 'W', n: w, win: PAY.W[w - 3] * lb };
    const base = s.find((x) => x !== 'W');
    if (base && PAY[base]) { let k = 0; while (k < 5 && (s[k] === base || s[k] === 'W')) k++; if (k >= 3) { const v = PAY[base][k - 3] * lb; if (!best || v > best.win) best = { sym: base, n: k, win: v }; } }
    if (best) lines.push({ line: n + 1, ...best, win: Math.round(best.win) });
  });
  return { lines, win: lines.reduce((a, l) => a + l.win, 0) };
}
function play(bet, rnd = randomInt, force = false) { // force: nur Admin-Test, Kappe landet und verwandelt 9 Felder
  const grid = spinGrid(rnd); if (force) grid[2][1] = 'N';
  const before = grid.map((c) => [...c]), cap = capShake(grid, rnd, force ? 9 : null), r = evaluate(grid, bet);
  return { before, grid, cap, lines: r.lines, total: r.win };
}
function setStrips(s) { STRIPS = s.map((x) => x.split('')); }
function setCap(k, w) { CAP_K = k; CAP_W = w; }
module.exports = { setCap, NAMES, PAY, LINES, BETS, play, evaluate, capShake, setStrips, get STRIPS() { return STRIPS; } };
