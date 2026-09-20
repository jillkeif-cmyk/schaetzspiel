// Glücksspiel mit Diamanten: Roulette und Blackjack. Alle Entscheidungen fallen auf dem Server.
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const colorOf = (n) => (n === 0 ? 'gruen' : RED.has(n) ? 'rot' : 'schwarz');

// Einsatzarten und ihre Auszahlung (Faktor auf den Einsatz, inklusive Einsatz)
const BETS = {
  rot: { name: 'Rot', pay: 2, hit: (n) => colorOf(n) === 'rot' },
  schwarz: { name: 'Schwarz', pay: 2, hit: (n) => colorOf(n) === 'schwarz' },
  gerade: { name: 'Gerade', pay: 2, hit: (n) => n !== 0 && n % 2 === 0 },
  ungerade: { name: 'Ungerade', pay: 2, hit: (n) => n % 2 === 1 },
  klein: { name: '1 bis 18', pay: 2, hit: (n) => n >= 1 && n <= 18 },
  gross: { name: '19 bis 36', pay: 2, hit: (n) => n >= 19 && n <= 36 },
  drittel1: { name: '1 bis 12', pay: 3, hit: (n) => n >= 1 && n <= 12 },
  drittel2: { name: '13 bis 24', pay: 3, hit: (n) => n >= 13 && n <= 24 },
  drittel3: { name: '25 bis 36', pay: 3, hit: (n) => n >= 25 && n <= 36 },
};
function spin(kind, number) {
  const n = WHEEL[Math.floor(Math.random() * WHEEL.length)];
  let win = false, pay = 0;
  if (kind === 'zahl') { win = Number(number) === n; pay = win ? 36 : 0; }
  else { const b = BETS[kind]; if (!b) return null; win = b.hit(n); pay = win ? b.pay : 0; }
  return { n, color: colorOf(n), win, pay, index: WHEEL.indexOf(n) };
}

// Blackjack
const deck = () => {
  const d = [];
  for (const s of ['♠', '♥', '♦', '♣']) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K']) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
};
function score(hand) {
  let sum = 0, aces = 0;
  for (const c of hand) {
    if (c.r === 'A') { aces++; sum += 11; }
    else if (['B', 'D', 'K'].includes(c.r)) sum += 10;
    else sum += Number(c.r);
  }
  while (sum > 21 && aces) { sum -= 10; aces--; }
  return sum;
}
const isBJ = (h) => h.length === 2 && score(h) === 21;
function dealerPlay(g) { while (score(g.dealer) < 17) g.dealer.push(g.deck.pop()); }
function result(g) {
  const p = score(g.player), d = score(g.dealer);
  if (p > 21) return { text: 'Überkauft', pay: 0 };
  if (isBJ(g.player) && !isBJ(g.dealer)) return { text: 'Blackjack!', pay: 2.5 };
  if (d > 21) return { text: 'Bank überkauft', pay: 2 };
  if (p > d) return { text: 'Gewonnen', pay: 2 };
  if (p === d) return { text: 'Unentschieden', pay: 1 };
  return { text: 'Verloren', pay: 0 };
}
module.exports = { spin, BETS, colorOf, WHEEL, deck, score, isBJ, dealerPlay, result };
