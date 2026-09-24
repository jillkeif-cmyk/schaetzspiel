// Buch der Gruft: 5 Walzen, 3 Reihen, 10 Linien (Spielidee wie Novomatics „Book of Ra Deluxe“, eigene Halloween-Gruft-Grafik).
// Das Grimoire (B) ist Wild und Scatter: ersetzt alle Symbole, 3+ irgendwo zahlen 2× / 20× / 200× Einsatz und geben 10 Freispiele.
// Vor den Freispielen wird ein Bonus-Symbol gelost. In den Freispielen dehnt es sich über jede Walze aus, auf der es steht,
// und zahlt auf allen 10 Linien, auch wenn die Walzen nicht nebeneinander liegen (zusätzlich zu den normalen Gewinnen).
// 3+ Grimoires in den Freispielen geben 10 weitere Freispiele. Grabräuber und Mumien-Pharao zahlen schon ab 2.
const { randomInt } = require('crypto');
const NAMES = { R: 'Grabräuber', M: 'Mumien-Pharao', G: 'Gargoyle', C: 'Totenkopf-Käfer', A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10', B: 'Grimoire' };
const PAY = { R: [10, 100, 1000, 5000], M: [5, 40, 400, 2000], G: [5, 30, 100, 750], C: [5, 30, 100, 750], A: [0, 5, 40, 150], K: [0, 5, 40, 150], Q: [0, 5, 25, 100], J: [0, 5, 25, 100], T: [0, 5, 25, 100] }; // × Linieneinsatz für 2,3,4,5
const MIN = (s) => (s === 'R' || s === 'M' ? 2 : 3);
const SCAT = [2, 20, 200]; // × Gesamteinsatz für 3, 4, 5 Grimoires
const SPECIALS = ['R', 'M', 'G', 'C', 'A', 'K', 'Q', 'J', 'T'];
const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 2, 2, 2, 1], [1, 0, 0, 0, 1], [2, 2, 1, 0, 0], [0, 0, 1, 2, 2], [2, 1, 1, 1, 0]];
const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
const FS_COUNT = 10;
let STRIPS = ["CJJGAQRKCQQQTJKMJAKTGRMKQKJATJTAMRBAAKTJGCGQTCTQTMTJQQJKABCGT", "AKRQTQMQTQAGATRCQCRCGJTMQAJJTJAAJTKJCKKTMKQBTKBJTTKGCJAJMGQQG", "TAACAMAGQGTQMQQCTJRKCATMJTJRJTBJTTQTQKCKJKQAGTAGJQMRJKCQKKGJ", "GTQCTTTBTTKMQQGAQGJGARCTAQKJCCKQAJAQJMKAQRRGBKJTJKCKJMTMJJATQ", "MTTQRCQGMQCTMAQQTAJQKKATKABJGJGCTRTJCAKKAGMJQATTJRKQQBGJJKCTJ"].map((x) => x.split('')); // Grimoires 2/2/1/2/2 je Walze
const spinGrid = (rnd) => STRIPS.map((s) => { const i = rnd(s.length); return [0, 1, 2].map((k) => s[(i + k) % s.length]); });
function evaluate(g, bet) {
  const lb = bet / 10, lines = [];
  LINES.forEach((L, n) => {
    const s = L.map((r, c) => g[c][r]); const base = s.find((x) => x !== 'B'); if (!base) return; // reine Buch-Linien zahlen nur als Scatter
    let k = 0; while (k < 5 && (s[k] === base || s[k] === 'B')) k++;
    if (k >= MIN(base) && PAY[base][k - 2]) lines.push({ line: n + 1, sym: base, n: k, win: Math.round(PAY[base][k - 2] * lb) });
  });
  let sc = 0; g.forEach((col) => col.forEach((x) => { if (x === 'B') sc++; }));
  const scat = sc >= 3 ? Math.round(SCAT[Math.min(5, sc) - 3] * bet) : 0;
  return { lines, scat, sc, win: lines.reduce((a, l) => a + l.win, 0) + scat };
}
function expandWin(g, sym, bet) { // Bonus-Symbol: Walzen, auf denen es steht, zahlen auf allen 10 Linien
  const reels = g.map((col) => col.includes(sym)); const n = reels.filter(Boolean).length;
  if (n < MIN(sym) || !PAY[sym][n - 2]) return { reels, n, win: 0 };
  return { reels, n, win: Math.round(PAY[sym][n - 2] * (bet / 10) * 10) };
}
function play(bet, rnd = randomInt, force = false) {
  const grid = spinGrid(rnd); if (force) { grid[0][1] = 'B'; grid[2][0] = 'B'; grid[4][2] = 'B'; }
  const base = evaluate(grid, bet), out = { grid, lines: base.lines, scat: base.scat, win: base.win, fs: null };
  if (base.sc >= 3) {
    const special = SPECIALS[rnd(SPECIALS.length)], spins = []; let left = FS_COUNT, total = 0, n = 0, extra = 0;
    while (left > 0 && n < 300) {
      left--; n++;
      const g = spinGrid(rnd), r = evaluate(g, bet), ex = expandWin(g, special, bet); const re = r.sc >= 3 ? FS_COUNT : 0;
      left += re; extra += re;
      spins.push({ grid: g, lines: r.lines, scat: r.scat, exp: ex, retrigger: re, win: r.win + ex.win });
      total += r.win + ex.win;
    }
    out.fs = { special, spins, total, extra }; out.win += total;
  }
  out.total = out.win; return out;
}
function setStrips(s) { STRIPS = s.map((x) => x.split('')); }
module.exports = { NAMES, PAY, SCAT, SPECIALS, LINES, BETS, FS_COUNT, MIN, play, evaluate, expandWin, setStrips, get STRIPS() { return STRIPS; } };
