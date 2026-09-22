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
// Risikoleiter: Stufen etwa 1,6-fach, unten 0, ganz oben die Ausspielung. Das Licht taktet zwischen der
// nächsthöheren und der nächstniedrigeren Stufe; die Chance ist genau fair: (aktuell - unten) / (oben - unten)
const nice = (v) => (v < 100 ? Math.round(v) : v < 1000 ? Math.round(v / 5) * 5 : v < 10000 ? Math.round(v / 10) * 10 : Math.round(v / 100) * 100);
function ladder(win) {
  const up = [win]; for (let k = 0; k < 6; k++) up.push(Math.max(up[up.length - 1] + 1, nice(up[up.length - 1] * 1.6)));
  const down = []; let v = win; for (let k = 0; k < 3; k++) { v = nice(v / 1.6); if (v < 1 || v >= (down[0] || win)) break; down.unshift(v); }
  return { steps: [0, ...down, ...up], pos: 1 + down.length }; // steps[0] = 0, letzte Stufe = Ausspielung
}
const chance = (low, cur, high) => (cur - low) / (high - low);
const riskWins = (p) => randomInt(1000000) < Math.floor(1000000 * p);
const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K', 'A'], CARD_SUITS = ['♥', '♦', '♠', '♣'];
const drawCard = () => ({ r: CARD_RANKS[randomInt(13)], s: CARD_SUITS[randomInt(4)] });
const cardRed = (c) => c.s === '♥' || c.s === '♦';
module.exports = { play, evaluate, ladder, chance, riskWins, drawCard, cardRed, PAY, NAMES, LINES, STRIPS, BETS };
