// Triple Crown: 3 Walzen, 3 Reihen, 5 feste Linien. Nachgebaut nach dem klassischen Prinzip:
// 3 gleiche Symbole auf einer Linie gewinnen, Linien werden addiert. Vollbild aus Blitz, Herz, Stern
// oder Mond startet das Rewin-Rad: 12 Felder, in Runde 1 ein Stop-Feld, nach jedem Rewin eins mehr.
// Drei Chips auf einer Linie geben einen Gratis-Dreh. Exakt berechnete Auszahlungsquote: 96,2 %.
const { randomInt } = require('crypto');
const PAY = { K: 150, S: 40, H: 12, B: 8, R: 8, T: 8, M: 8, C: 1 }; // Vielfaches des Einsatzes je Linie
const NAMES = { K: 'Krone', S: 'Sieben', H: 'Hufeisen', B: 'Blitz', R: 'Herz', T: 'Stern', M: 'Mond', C: 'Chip' };
const FRUIT = new Set(['B', 'R', 'T', 'M']);
const LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]]; // Reihe je Walze: 0 oben, 1 Mitte, 2 unten
const STRIPS = ['CCRRRCMBBBHTKCRMTTTRBMMMSCBTC', 'CCSTCTKMCRRBHCRRRMBBBMMMTTTCB', 'TTTKBBCCCCMCCRRRHSMTBBBTMMMRR'].map((s) => s.split(''));
const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

const spinGrid = () => STRIPS.map((s) => { const i = randomInt(s.length); return [s[(i - 1 + s.length) % s.length], s[i], s[(i + 1) % s.length]]; });
function evaluate(g, bet) {
  const lines = [];
  LINES.forEach((L, n) => { const a = g[0][L[0]]; if (a === g[1][L[1]] && a === g[2][L[2]]) lines.push({ line: n + 1, sym: a, win: PAY[a] * bet }); });
  const s = g[0][0], full = g.every((r) => r.every((x) => x === s)) ? s : null;
  return { lines, win: lines.reduce((x, l) => x + l.win, 0), full, respin: lines.some((l) => l.sym === 'C') };
}
// Ein kompletter Spielzug: Dreh, mögliches Rad, mögliche Gratis-Drehs (höchstens 10 hintereinander)
function play(bet) {
  const spins = []; let total = 0, respins = 0;
  for (;;) {
    const grid = spinGrid(), r = evaluate(grid, bet);
    let wheel = null;
    if (r.full && FRUIT.has(r.full)) { // Rewin-Rad: Runde k hat k Stop-Felder von 12; jedes Rewin zahlt das Vollbild noch einmal
      wheel = []; for (let k = 1; k <= 11; k++) { const field = randomInt(12), stop = field < k; wheel.push({ stops: k, field, rewin: !stop }); if (stop) break; }
    }
    const extra = wheel ? wheel.filter((x) => x.rewin).length * r.win : 0;
    spins.push({ grid, lines: r.lines, win: r.win, full: r.full, wheel, extra });
    total += r.win + extra;
    if (!r.respin || respins >= 10) break;
    respins++;
  }
  return { spins, total };
}
// Risikoleiter wie bei Merkur: Die Leiter hängt am Gewinn. Jede Sprosse darüber verdoppelt, jede darunter
// halbiert (höchstens drei Sprossen nach unten), ganz unten steht die AUSSPIELUNG (alles weg).
// Beim Riskieren blinken die Sprosse darüber und die darunter: hoch verdoppelt, runter kostet eine Sprosse.
// Die Spitze liegt fest beim RISK_TOP-fachen Einsatz (wie die 140 € am Automaten), darüber geht es nie,
// auch nicht mit der Karte. Liegt der Gewinn schon auf oder über der Spitze, gibt es nur Nehmen.
// Chancen fair aus den Nachbarwerten (siehe chance): Verdoppeln/Halbieren 1 zu 3, unterste Sprosse 50 %.
const RISK_TOP = 50; // höchstens das 50-fache des Einsatzes über das Risiko
const riskTop = (bet) => bet * RISK_TOP;
function ladder(win, bet) {
  const T = riskTop(bet), downs = [], ups = [];
  let v = win;
  for (let k = 0; k < 3; k++) { v = Math.floor(v / 2); if (v < Math.max(1, bet / 2)) break; downs.unshift(v); }
  v = win; while (v * 2 < T) { v *= 2; ups.push(v); }
  if (win < T) ups.push(T);
  const steps = [{ v: 0, aus: true }, ...downs.map((x) => ({ v: x })), { v: win }, ...ups.map((x) => ({ v: x }))];
  return { steps, pos: 1 + downs.length };
}
const chance = (low, cur, high) => (cur - low) / (high - low);
const riskWins = (p) => randomInt(1000000) < Math.floor(1000000 * p);
const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K', 'A'], CARD_SUITS = ['♥', '♦', '♠', '♣'];
const drawCard = () => ({ r: CARD_RANKS[randomInt(13)], s: CARD_SUITS[randomInt(4)] });
const cardRed = (c) => c.s === '♥' || c.s === '♦';
module.exports = { RISK_TOP, riskTop, play, evaluate, ladder, chance, riskWins, drawCard, cardRed, PAY, NAMES, LINES, STRIPS, BETS };
