// Auge des Anubis: 5 Walzen, 3 Reihen, 10 Linien (Spielidee wie Merkurs „Eye of Horus“, eigene Nacht-Ägypten-Grafik).
// Regeln nach Original-Gewinntabelle und Aufnahmen:
// - Anubis (W) dehnt sich auf die ganze Walze aus und ersetzt alle Symbole außer dem Scatter.
// - 3+ Grabtore (P) irgendwo zahlen 1× / 10× / 25× Einsatz und geben 12 Freispiele (Anzahl fest).
// - In den Freispielen gibt jeder gelandete Anubis +1 Freispiel und hebt NACH der Auswertung die Tafel um eine Stufe:
//   Lotus → Ankh → Skarabäus → Falke → Schakal → Auge (J, Q, K, A bleiben).
const { randomInt } = require('crypto');
const NAMES = { J: 'J', Q: 'Q', K: 'K', A: 'A', L: 'Lotus', H: 'Ankh', S: 'Skarabäus', B: 'Falke', X: 'Schakal', E: 'Auge', W: 'Anubis', P: 'Grabtor' };
const PAY = { J: [5, 20, 100], Q: [5, 20, 100], K: [5, 20, 100], A: [5, 20, 100], L: [10, 50, 200], H: [10, 50, 200], S: [20, 100, 250], B: [20, 125, 300], X: [50, 200, 400], E: [100, 250, 500] }; // × Linieneinsatz (Einsatz/10)
const SCAT = [1, 10, 25]; // × Gesamteinsatz für 3, 4, 5 Grabtore
const TIERS = ['L', 'H', 'S', 'B', 'X', 'E'];
const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 1, 2, 1]];
const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
const FS_START = 12;
let STRIPS = ["BXQJKSLLHSJSQAQJKQKSAHQLPLQPJEAAAKWKAJAKHHJBLQHSKBKQXBJXLEQAKAHEJJ", "JKWJJLJQQHJLHKEQKPHQQKJHQASSJAXPKBKBALBQQKAAKSKHLSLQAJHAXEASXBLAJE", "AXLABHJXWQKJSBKLHQJKAAKLHSQXJELQSHASJEKPHHPKBALQKLKKQJBSJJEJQAAQQA", "HAKQLJKXAXKJQJJBLQHBBHLJKQKKXEJJLAALKQAPSSQKSAALAEAQSQSWPBHJQKEHHJ", "QLJHLSSSSKLHBQKQEHHAHQKBAJKXXAKPKQKJKBXLJJQALQBAJJEAELQAWAJAQHSKPJ"].map((x) => x.split('')); // ≈ 41 % Bildsymbole wie im Original, 2 Grabtore je Walze: ≈ 95,6 %, Freispiele ≈ alle 155 Drehs, Ø ≈ 65×
const up = (x, lvl) => { const i = TIERS.indexOf(x); return i >= 0 && i < lvl ? TIERS[lvl] : x; };
const spinGrid = (rnd, lvl = 0) => STRIPS.map((s) => { const i = rnd(s.length); return [0, 1, 2].map((k) => up(s[(i + k) % s.length], lvl)); });
function evaluate(g, bet) {
  const lb = bet / 10, wild = g.map((col) => col.includes('W')); // Walzen mit Anubis sind komplett wild
  const cell = (c, r) => (wild[c] ? 'W' : g[c][r]);
  const lines = [];
  LINES.forEach((L, n) => {
    const s = L.map((r, c) => cell(c, r)); if (s[0] === 'P') return;
    const base = s.find((x) => x !== 'W' && x !== 'P') || 'E'; // reine Anubis-Linie zählt wie das Auge
    let k = 0; while (k < 5 && (s[k] === base || s[k] === 'W')) k++;
    if (k >= 3 && PAY[base]) lines.push({ line: n + 1, sym: base, n: k, win: Math.round(PAY[base][k - 3] * lb) });
  });
  let sc = 0; g.forEach((col) => col.forEach((x) => { if (x === 'P') sc++; }));
  const scat = sc >= 3 ? Math.round(SCAT[Math.min(5, sc) - 3] * bet) : 0;
  return { lines, scat, sc, wild, win: lines.reduce((a, l) => a + l.win, 0) + scat };
}
function play(bet, rnd = randomInt, force = false) { // force: Admin-Test, löst Freispiele aus
  const grid = spinGrid(rnd); if (force) { grid[0][1] = 'P'; grid[2][0] = 'P'; grid[4][2] = 'P'; }
  const base = evaluate(grid, bet), out = { grid, lines: base.lines, scat: base.scat, wild: base.wild, win: base.win, fs: null };
  if (base.sc >= 3) { // Freispiele: 12, jeder Anubis +1 und Tafel-Stufe nach der Auswertung
    const spins = []; let left = FS_START, lvl = 0, total = 0, n = 0;
    while (left > 0 && n < 200) {
      left--; n++;
      const g = spinGrid(rnd, lvl), r = evaluate(g, bet); let ws = 0; g.forEach((col) => col.forEach((x) => { if (x === 'W') ws++; }));
      spins.push({ grid: g, lines: r.lines, scat: r.scat, wild: r.wild, win: r.win, lvl, anubis: ws, extra: ws, lvlAfter: Math.min(5, lvl + ws) });
      total += r.win; left += ws; lvl = Math.min(5, lvl + ws);
    }
    out.fs = { spins, total }; out.win += total;
  }
  out.total = out.win; return out;
}
function setStrips(s) { STRIPS = s.map((x) => x.split('')); }
module.exports = { NAMES, PAY, SCAT, TIERS, LINES, BETS, FS_START, play, evaluate, setStrips, up, get STRIPS() { return STRIPS; } };
