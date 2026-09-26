// „Lügen“ (Mogeln / Ich zweifle): Tischlogik mit Bots. Karten { r, s }.
const crypto = require('crypto');
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K', 'A'];
const RANK_NAME = { 2: 'Zweien', 3: 'Dreien', 4: 'Vieren', 5: 'Fünfen', 6: 'Sechsen', 7: 'Siebenen', 8: 'Achten', 9: 'Neunen', 10: 'Zehnen', B: 'Buben', D: 'Damen', K: 'Könige', A: 'Asse' };
const SUITS = ['♠', '♥', '♦', '♣'];
const rnd = (n) => crypto.randomInt(0, n);
const BOT_NAMES = ['Bot Karl', 'Bot Lotte', 'Bot Fritz', 'Bot Mia', 'Bot Otto', 'Bot Emma'];
const SKAT = ['7', '8', '9', '10', 'B', 'D', 'K', 'A'];
function deck(ranks) { const d = []; for (const r of ranks) for (const s of SUITS) d.push({ r, s, id: `${r}${s}` }); for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; }
function deal(t) {
  const players = t.seats.filter(Boolean); t.ranks = players.length >= 5 ? RANKS : SKAT; const d = deck(t.ranks); // 3–4 Spieler: Skatblatt (32), 5–6: volles Blatt (52)
  players.forEach((p) => { p.cards = []; }); d.forEach((c, i) => players[i % players.length].cards.push(c));
  players.forEach((p) => p.cards.sort((a, b) => RANKS.indexOf(a.r) - RANKS.indexOf(b.r)));
  t.decks = 1;
}
// Bot: wählt einen Zug. Rückgabe { pass } oder { ids, rank }
function botMove(t, seat) {
  const me = t.seats[seat], byRank = {}; for (const c of me.cards) (byRank[c.r] = byRank[c.r] || []).push(c);
  if (!t.rank) { // Rundenbeginn: Wert mit den meisten eigenen Karten, ehrlich (manchmal eine Karte dazugemogelt)
    const best = Object.keys(byRank).sort((a, b) => byRank[b].length - byRank[a].length)[0]; const ids = byRank[best].slice(0, 4).map((c) => c.id);
    if (ids.length < 4 && me.cards.length > 6 && rnd(4) === 0) { const x = me.cards.find((c) => c.r !== best); if (x) ids.push(x.id); }
    return { ids, rank: best };
  }
  const have = byRank[t.rank] || [];
  if (have.length) { const ids = have.slice(0, 4).map((c) => c.id); if (ids.length < 4 && rnd(4) === 0) { const x = me.cards.find((c) => c.r !== t.rank); if (x) ids.push(x.id); } return { ids, rank: t.rank }; }
  if (t.allowPass && rnd(3) > 0) return { pass: true };
  const n = 1 + (me.cards.length > 8 && rnd(3) === 0 ? 1 : 0); return { ids: me.cards.slice(0, n).map((c) => c.id), rank: t.rank }; // gezwungen zu lügen
}
// Bot: soll er der letzten Ansage misstrauen?
function botDoubt(t, seat) {
  const lp = t.last; if (!lp || lp.seat === seat) return false;
  const mine = t.seats[seat].cards.filter((c) => c.r === lp.rank).length, total = 4 * t.decks, claimed = t.claimedThisRound || 0;
  if (mine + lp.n > total || mine + claimed > total) return true; // unmöglich
  if (t.seats[lp.seat].cards.length === 0) return rnd(10) < 5; // letzte Karte: oft misstrauisch
  const bots = Math.max(1, t.seats.filter((p, i) => p && (p.bot || p.away) && i !== lp.seat).length); // Chance auf alle Bots verteilt, damit nicht bei jedem Zug jemand zweifelt
  return rnd(1000) < (40 + lp.n * 45 + mine * 70) / bots;
}
function isLie(play) { return play.cards.some((c) => c.r !== play.rank); }
module.exports = { RANKS, RANK_NAME, BOT_NAMES, deal, botMove, botDoubt, isLie };
