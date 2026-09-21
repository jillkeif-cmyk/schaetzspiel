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

// ---------- Blackjack mit vollen Regeln ----------
// Hände: Teilen (bis 4 Hände), Verdoppeln, Versicherung, Aufgeben, Blackjack zahlt 3:2
const val = (c) => (c.r === 'A' ? 11 : ['B', 'D', 'K', '10'].includes(c.r) ? 10 : Number(c.r));
function newRound(amount) {
  const d = deck();
  const g = { deck: d, dealer: [d.pop(), d.pop()], hands: [{ cards: [d.pop(), d.pop()], bet: amount, done: false, doubled: false, fromSplit: false }], active: 0, insurance: 0, amount, surrendered: false, over: false };
  return g;
}
const hand = (g) => g.hands[g.active];
function canSplit(g) {
  const h = hand(g); if (!h || h.done || g.hands.length >= 4 || h.cards.length !== 2) return false;
  return val(h.cards[0]) === val(h.cards[1]);
}
const canDouble = (g) => { const h = hand(g); return !!h && !h.done && h.cards.length === 2; };
const canSurrender = (g) => { const h = hand(g); return !!h && g.hands.length === 1 && h.cards.length === 2 && !h.done && !g.insuranceAsked; };
const canInsure = (g) => { const h = hand(g); return !!h && g.dealer[0].r === 'A' && g.hands.length === 1 && h.cards.length === 2 && !g.insurance && !g.insuranceAsked; };
function nextHand(g) {
  while (g.active < g.hands.length && g.hands[g.active].done) g.active++;
  if (g.active >= g.hands.length) { if (g.table) g.waiting = true; else finish(g); }
}
function finish(g) {
  g.over = true;
  const live = g.hands.some((h) => !h.busted) && !g.surrendered;
  if (live) dealerPlay(g);
  const d = score(g.dealer), dBJ = isBJ(g.dealer);
  let payout = 0;
  g.results = g.hands.map((h) => {
    const p = score(h.cards);
    if (g.surrendered) { payout += h.bet / 2; return 'Aufgegeben'; }
    if (p > 21) return 'Überkauft';
    const bj = h.cards.length === 2 && p === 21 && !h.fromSplit;
    if (bj && !dBJ) { payout += h.bet * 2.5; return 'Blackjack!'; }
    if (dBJ && !bj) return 'Bank hat Blackjack';
    if (d > 21) { payout += h.bet * 2; return 'Bank überkauft'; }
    if (p > d) { payout += h.bet * 2; return 'Gewonnen'; }
    if (p === d) { payout += h.bet; return 'Unentschieden'; }
    return 'Verloren';
  });
  if (g.insurance && dBJ) payout += g.insurance * 3; // Versicherung zahlt 2:1
  g.payout = Math.round(payout);
  g.staked = g.hands.reduce((s, h) => s + h.bet, 0) + (g.insurance || 0);
}
// Aktion ausführen. Gibt zurück, wie viel zusätzlicher Einsatz nötig war.
function act(g, a) {
  if (g.over) return { error: 'Die Runde ist vorbei.' };
  const h = hand(g);
  if (!h) return { error: 'Du bist schon fertig.' };
  if (a === 'hit') {
    h.cards.push(g.deck.pop());
    if (score(h.cards) > 21) { h.done = true; h.busted = true; nextHand(g); }
    else if (score(h.cards) === 21) { h.done = true; nextHand(g); }
    return { extra: 0 };
  }
  if (a === 'stand') { h.done = true; nextHand(g); return { extra: 0 }; }
  if (a === 'double') {
    if (!canDouble(g)) return { error: 'Verdoppeln geht nur mit zwei Karten.' };
    const extra = h.bet; h.bet *= 2; h.doubled = true;
    h.cards.push(g.deck.pop()); h.done = true;
    if (score(h.cards) > 21) h.busted = true;
    nextHand(g); return { extra };
  }
  if (a === 'split') {
    if (!canSplit(g)) return { error: 'Teilen geht nur mit zwei gleichwertigen Karten.' };
    const second = h.cards.pop();
    const aces = h.cards[0].r === 'A';
    const nh = { cards: [second, g.deck.pop()], bet: h.bet, done: aces, doubled: false, fromSplit: true };
    h.cards.push(g.deck.pop()); h.fromSplit = true; if (aces) h.done = true;
    g.hands.splice(g.active + 1, 0, nh);
    if (h.done) nextHand(g);
    return { extra: nh.bet };
  }
  if (a === 'surrender') {
    if (!canSurrender(g)) return { error: 'Aufgeben geht nur direkt nach dem Austeilen.' };
    g.surrendered = true; h.done = true; if (g.table) g.waiting = true; else finish(g); return { extra: 0 };
  }
  if (a === 'insurance') {
    if (!canInsure(g)) return { error: 'Versicherung gibt es nur, wenn die Bank ein Ass zeigt.' };
    g.insurance = Math.floor(g.amount / 2); g.insuranceAsked = true; return { extra: g.insurance };
  }
  if (a === 'noinsurance') { g.insuranceAsked = true; return { extra: 0 }; }
  return { error: 'Unbekannte Aktion.' };
}
function view(g) {
  const done = g.over;
  return {
    dealer: done ? g.dealer : [g.dealer[0], { hidden: true }],
    dealerScore: done ? score(g.dealer) : val(g.dealer[0]),
    hands: g.hands.map((h, i) => ({ cards: h.cards, score: score(h.cards), bet: h.bet, done: h.done, doubled: h.doubled, active: !done && i === g.active, result: done && g.results ? g.results[i] : null })),
    can: done || g.waiting ? {} : { hit: true, stand: true, double: canDouble(g), split: canSplit(g), surrender: canSurrender(g), insurance: canInsure(g) },
    insurance: g.insurance, over: done, payout: done ? g.payout : 0, staked: done ? g.staked : 0,
  };
}
module.exports.bj = { newRound, act, view, isBJ, score, finish };

// ---------- Roulette-Tableau: alle klassischen Einsätze ----------
// Tableau: 12 Spalten × 3 Reihen, Zahl = 3·Spalte + (3 − Reihe)
const numAt = (col, row) => 3 * col + (3 - row);
function legalSets() {
  const sets = new Map(); const add = (arr) => { const k = [...arr].sort((a, b) => a - b).join(','); sets.set(k, arr.length); };
  for (let n = 0; n <= 36; n++) add([n]);                                   // Zahl
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
    if (r < 2) add([numAt(c, r), numAt(c, r + 1)]);                          // Split senkrecht
    if (c < 11) add([numAt(c, r), numAt(c + 1, r)]);                         // Split waagrecht
    if (r < 2 && c < 11) add([numAt(c, r), numAt(c, r + 1), numAt(c + 1, r), numAt(c + 1, r + 1)]); // Ecke
  }
  for (let c = 0; c < 12; c++) {
    add([numAt(c, 0), numAt(c, 1), numAt(c, 2)]);                            // Street
    if (c < 11) add([0, 1, 2].flatMap((r) => [numAt(c, r), numAt(c + 1, r)])); // Sechserreihe
  }
  add([0, 1]); add([0, 2]); add([0, 3]); add([0, 1, 2]); add([0, 2, 3]);    // mit der Null
  for (let d = 0; d < 3; d++) add(Array.from({ length: 12 }, (_, i) => d * 12 + i + 1)); // Dutzende
  for (let r = 0; r < 3; r++) add(Array.from({ length: 12 }, (_, c) => numAt(c, r)));   // Kolonnen
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  add(range(1, 18)); add(range(19, 36));
  add(range(1, 36).filter((n) => n % 2 === 0)); add(range(1, 36).filter((n) => n % 2 === 1));
  add(range(1, 36).filter((n) => RED.has(n))); add(range(1, 36).filter((n) => !RED.has(n)));
  return sets;
}
const LEGAL = legalSets();
// Auszahlung inklusive Einsatz: 36 geteilt durch die Anzahl der Zahlen
function spinBoard(bets) {
  let stake = 0;
  for (const b of bets) {
    const nums = [...new Set((b.numbers || []).map(Number))].sort((a, c) => a - c);
    if (!LEGAL.has(nums.join(','))) return { error: 'Ungültiger Einsatz auf ' + nums.join(', ') };
    if (!(b.amount >= 10)) return { error: 'Mindestens 10 Diamanten pro Chip.' };
    b.numbers = nums; stake += Math.round(b.amount);
  }
  const n = WHEEL[Math.floor(Math.random() * WHEEL.length)];
  let won = 0;
  for (const b of bets) if (b.numbers.includes(n)) won += Math.round(b.amount * 36 / b.numbers.length);
  return { n, color: colorOf(n), index: WHEEL.indexOf(n), stake, won };
}
module.exports.spinBoard = spinBoard;
module.exports.LEGAL_COUNT = LEGAL.size;
