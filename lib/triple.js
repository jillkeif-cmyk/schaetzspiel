// Triple Crown: 3 Walzen, 3 Reihen, 5 feste Linien. Nachgebaut nach dem klassischen Prinzip:
// 3 gleiche Symbole auf einer Linie gewinnen, Linien werden addiert. Vollbild aus Blitz, Herz, Stern
// oder Mond startet das Rewin-Rad (3 grün, 1 Stop, bis zu 3 Drehungen). Drei Chips auf einer Linie
// geben einen Gratis-Dreh. Exakt berechnete Auszahlungsquote: 96,2 %.
const { randomInt } = require('crypto');
const PAY = { K: 150, S: 40, H: 12, B: 8, R: 8, T: 8, M: 8, C: 1 }; // Vielfaches des Einsatzes je Linie
const NAMES = { K: 'Krone', S: 'Sieben', H: 'Hufeisen', B: 'Blitz', R: 'Herz', T: 'Stern', M: 'Mond', C: 'Chip' };
const FRUIT = new Set(['B', 'R', 'T', 'M']);
const LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]]; // Reihe je Walze: 0 oben, 1 Mitte, 2 unten
const STRIPS = ['SBBBCTTTCMBMTRRRHKCCRCTBRMMMC', 'BBBBMCMCRCTTTRRRTCSCMMMBHRCKT', 'CTCHMSCMCBRKCTBBBCRMMMTTTRRRB'].map((s) => s.split(''));
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
    if (r.full && FRUIT.has(r.full)) { // Rewin-Rad: jedes Grün zahlt das Vollbild noch einmal
      wheel = []; for (let k = 0; k < 3; k++) { const green = randomInt(4) < 3; wheel.push(green ? 'green' : 'stop'); if (!green) break; }
    }
    const extra = wheel ? wheel.filter((x) => x === 'green').length * r.win : 0;
    spins.push({ grid, lines: r.lines, win: r.win, full: r.full, wheel, extra });
    total += r.win + extra;
    if (!r.respin || respins >= 10) break;
    respins++;
  }
  return { spins, total };
}
// Risikoleiter: jede Stufe etwa 1,6-fach, faire Chance (aktuell / nächste Stufe), bis zu 6 Stufen
const nice = (v) => (v < 100 ? Math.round(v) : v < 1000 ? Math.round(v / 5) * 5 : v < 10000 ? Math.round(v / 10) * 10 : Math.round(v / 100) * 100);
function ladder(win) { const l = [win]; for (let k = 0; k < 6; k++) l.push(Math.max(l[l.length - 1] + 1, nice(l[l.length - 1] * 1.6))); return l; }
const riskWins = (cur, next) => randomInt(1000000) < Math.floor(1000000 * cur / next);
module.exports = { play, evaluate, ladder, riskWins, PAY, NAMES, LINES, STRIPS, BETS };
