// Texas Hold'em: zwei feste Tische (Classic und High Stakes), immer offen.
// Einsatz beim Hinsetzen wird vom Diamantenstand abgezogen, beim Aufstehen kommt der restliche Stack zurück.
const casino = require('./casino');

const TABLES = [
  { id: 'classic', name: 'Classic', buyIn: 150, sb: 5, bb: 10, max: 6 },
  { id: 'high', name: 'High Stakes', buyIn: 1500, sb: 50, bb: 100, max: 6 },
];
const TURN_MS = 20000, NEXT_HAND_MS = 5000, SHOW_MS = 6000;
const VAL = { B: 11, D: 12, K: 13, A: 14 };
const val = (c) => VAL[c.r] || Number(c.r);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- Handbewertung: beste 5 aus 7 ----------
const HAND_NAMES = ['Höchste Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush'];
function rank5(cs) {
  const v = cs.map(val).sort((a, b) => b - a);
  const flush = cs.every((c) => c.s === cs[0].s);
  const uniq = [...new Set(v)];
  let straightHigh = 0;
  if (uniq.length === 5) { if (v[0] - v[4] === 4) straightHigh = v[0]; else if (v.join() === '14,5,4,3,2') straightHigh = 5; }
  const cnt = new Map(); for (const x of v) cnt.set(x, (cnt.get(x) || 0) + 1);
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const kick = groups.map((g) => g[0]);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][1] === 4) return [7, ...kick];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, ...kick];
  if (flush) return [5, ...v];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) return [3, ...kick];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...kick];
  if (groups[0][1] === 2) return [1, ...kick];
  return [0, ...v];
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
function best(cards) {
  let top = null;
  for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
    const five = cards.filter((_, i) => i !== a && i !== b);
    if (five.length !== 5) continue;
    const r = rank5(five); if (!top || cmp(r, top) > 0) top = r;
  }
  if (!top && cards.length === 5) top = rank5(cards);
  return top;
}
const handName = (r) => (r ? HAND_NAMES[r[0]] : '');

module.exports = function setupPoker(io, store, onStat, canPlay, push) {
  const tables = new Map(TABLES.map((d) => [d.id, { ...d, seats: Array(d.max).fill(null), hand: null, dealer: -1, timer: null, nextTimer: null, log: [] }]));
  const seatOf = new Map(); // userId -> tableId

  const addDia = async (uid, n) => { const u = await store.userById(uid); if (!u) return 0; const v = Math.max(0, (Number(u.diamonds) || 0) + n); await store.save(uid, { diamonds: v }); return v; };
  const seated = (t) => t.seats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  const nextIdx = (t, from, pred) => { for (let k = 1; k <= t.max; k++) { const i = (from + k) % t.max; if (t.seats[i] && pred(i)) return i; } return -1; };
  const summary = () => [...tables.values()].map((t) => ({ id: t.id, name: t.name, buyIn: t.buyIn, sb: t.sb, bb: t.bb, max: t.max, seated: seated(t).length, running: !!t.hand }));
  const pushList = () => io.emit('pk:list', summary());

  function view(t, uid) {
    const h = t.hand;
    return {
      id: t.id, name: t.name, buyIn: t.buyIn, sb: t.sb, bb: t.bb, max: t.max, dealer: t.dealer,
      board: h ? h.board : [], pot: h ? h.pot + h.players.reduce((x, p) => x + p.bet, 0) : 0,
      street: h ? h.street : 'waiting', toAct: h ? h.toAct : -1, currentBet: h ? h.currentBet : 0, minRaise: h ? h.minRaise : t.bb,
      deadline: h && h.deadline ? h.deadline : null, now: Date.now(), winners: h ? h.winners || null : null,
      me: t.seats.findIndex((s) => s && s.id === uid),
      seats: t.seats.map((s, i) => {
        if (!s) return null;
        const p = h && h.players.find((x) => x.idx === i);
        const showCards = p && (s.id === uid || (h.street === 'showdown' && !p.folded));
        return {
          id: s.id, name: s.name, av: s.av, frame: s.frame, frameAnim: s.frameAnim, color: s.color, stack: s.stack, away: !s.sockets.size,
          inHand: !!p, folded: p ? p.folded : false, allin: p ? p.allin : false, bet: p ? p.bet : 0, last: p ? p.last : '',
          cards: p ? (showCards ? p.cards : p.cards.map(() => ({ hidden: true }))) : [],
          handName: p && showCards && h.board.length >= 3 ? handName(best([...p.cards, ...h.board])) : '',
        };
      }),
    };
  }
  const pushTable = (t) => { for (const s of t.seats) if (s) for (const so of s.sockets) so.emit('pk:state', view(t, s.id)); for (const so of t.watchers || []) so.emit('pk:state', view(t, null)); };

  // ---------- Handablauf ----------
  function scheduleHand(t) {
    clearTimeout(t.nextTimer);
    if (t.hand) return;
    const ready = seated(t).filter((i) => t.seats[i].stack > 0 && !t.seats[i].sitOut);
    if (ready.length < 2) { pushTable(t); pushList(); return; }
    t.nextTimer = setTimeout(() => startHand(t), NEXT_HAND_MS);
  }
  function pay(t, p, amount) { const s = t.seats[p.idx]; const x = Math.min(amount, s.stack); s.stack -= x; p.bet += x; p.contrib += x; if (s.stack === 0) p.allin = true; return x; }
  function startHand(t) {
    const ready = seated(t).filter((i) => t.seats[i].stack > 0 && !t.seats[i].sitOut);
    if (ready.length < 2 || t.hand) return;
    t.dealer = nextIdx(t, t.dealer < 0 ? -1 : t.dealer, (i) => ready.includes(i));
    const deck = shuffle(casino.deck());
    const players = ready.map((idx) => ({ idx, id: t.seats[idx].id, cards: [deck.pop(), deck.pop()], bet: 0, contrib: 0, folded: false, allin: false, acted: false, last: '' }));
    const h = t.hand = { deck, board: [], players, pot: 0, street: 'preflop', currentBet: 0, minRaise: t.bb, toAct: -1, deadline: null, winners: null };
    const P = (i) => players.find((p) => p.idx === i);
    const heads = players.length === 2;
    const sbIdx = heads ? t.dealer : nextIdx(t, t.dealer, (i) => ready.includes(i));
    const bbIdx = nextIdx(t, sbIdx, (i) => ready.includes(i));
    pay(t, P(sbIdx), t.sb); P(sbIdx).last = 'Small Blind';
    pay(t, P(bbIdx), t.bb); P(bbIdx).last = 'Big Blind';
    h.currentBet = t.bb;
    h.toAct = nextActor(t, bbIdx);
    armTimer(t); pushTable(t); pushList();
  }
  // Nächster, der handeln muss: nicht gefoldet, nicht all-in, und hat noch nicht gehandelt oder liegt unter dem Einsatz
  function nextActor(t, from) {
    const h = t.hand;
    return nextIdx(t, from, (i) => { const p = h.players.find((x) => x.idx === i); return p && !p.folded && !p.allin && (!p.acted || p.bet < h.currentBet); });
  }
  function armTimer(t) {
    clearTimeout(t.timer);
    const h = t.hand; if (!h || h.toAct < 0) { if (h) h.deadline = null; return; }
    const s = t.seats[h.toAct];
    const ms = s && !s.sockets.size ? 3000 : TURN_MS; // wer weg ist, bekommt nur kurz Zeit
    h.deadline = Date.now() + ms;
    t.timer = setTimeout(() => { const p = h.players.find((x) => x.idx === h.toAct); if (p) act(t, p.id, { action: p.bet >= h.currentBet ? 'check' : 'fold' }, true); }, ms);
  }
  function act(t, uid, a, auto) {
    const h = t.hand; if (!h || h.street === 'showdown') return 'Gerade läuft keine Setzrunde.';
    const p = h.players.find((x) => x.id === uid);
    if (!p || h.toAct !== p.idx) return 'Du bist gerade nicht dran.';
    const s = t.seats[p.idx], need = h.currentBet - p.bet;
    const action = String(a.action || '');
    if (action === 'fold') { p.folded = true; p.last = auto ? 'Fold (Zeit)' : 'Fold'; }
    else if (action === 'check') { if (need > 0) return 'Du musst mitgehen oder aussteigen.'; p.last = auto ? 'Check (Zeit)' : 'Check'; }
    else if (action === 'call') { if (need <= 0) return 'Nichts zu callen, du kannst checken.'; pay(t, p, need); p.last = p.allin ? 'All In' : 'Call'; }
    else if (action === 'allin' && p.bet + s.stack <= h.currentBet) { pay(t, p, s.stack); p.last = 'All In'; }
    else if (action === 'raise' || action === 'allin') {
      const to = action === 'allin' ? p.bet + s.stack : Math.floor(Number(a.to) || 0);
      if (to > p.bet + s.stack) return 'So viel hast du nicht.';
      const full = to >= h.currentBet + h.minRaise;
      if (to <= h.currentBet) return 'Ein Raise muss höher sein als der aktuelle Einsatz.';
      if (!full && to < p.bet + s.stack) return `Mindestens auf ${h.currentBet + h.minRaise} erhöhen.`;
      pay(t, p, to - p.bet);
      if (full) h.minRaise = to - h.currentBet;
      h.currentBet = p.bet;
      for (const o of h.players) if (o !== p && !o.folded && !o.allin) o.acted = false; // alle anderen müssen reagieren
      p.last = p.allin ? 'All In' : 'Raise';
    } else return 'Unbekannte Aktion.';
    p.acted = true;
    advance(t, p.idx);
    return null;
  }
  // Jemand steigt aus, ohne dran zu sein (Aufstehen, Verbindung weg)
  function foldOut(t, p) {
    const h = t.hand; if (!h || p.folded || h.street === 'showdown') return;
    if (h.toAct === p.idx) { act(t, p.id, { action: 'fold' }, false); return; }
    p.folded = true; p.last = 'Fold';
    const live = h.players.filter((x) => !x.folded);
    if (live.length <= 1) return award(t, [[live[0] || p]], true);
    pushTable(t);
  }
  function advance(t, from) {
    const h = t.hand;
    const live = h.players.filter((p) => !p.folded);
    if (live.length === 1) return award(t, [[live[0]]], true);
    const nxt = nextActor(t, from);
    if (nxt >= 0) { h.toAct = nxt; armTimer(t); pushTable(t); return; }
    // Setzrunde vorbei: Einsätze in den Pot
    for (const p of h.players) { h.pot += p.bet; p.bet = 0; p.acted = false; if (!p.folded && !p.allin) p.last = ''; }
    h.currentBet = 0; h.minRaise = t.bb;
    const canAct = h.players.filter((p) => !p.folded && !p.allin).length;
    const dealNext = () => {
      if (h.street === 'preflop') { h.board.push(h.deck.pop(), h.deck.pop(), h.deck.pop()); h.street = 'flop'; }
      else if (h.street === 'flop') { h.board.push(h.deck.pop()); h.street = 'turn'; }
      else if (h.street === 'turn') { h.board.push(h.deck.pop()); h.street = 'river'; }
      else return showdown(t);
      if (canAct < 2) { h.toAct = -1; h.deadline = null; pushTable(t); t.timer = setTimeout(dealNext, 1400); return; } // alle all-in: Karten nacheinander aufdecken
      h.toAct = nextActor(t, t.dealer); armTimer(t); pushTable(t);
    };
    dealNext();
  }
  function showdown(t) {
    const h = t.hand;
    const live = h.players.filter((p) => !p.folded).map((p) => ({ p, r: best([...p.cards, ...h.board]) }));
    // Side Pots nach Einzahlungen staffeln
    const levels = [...new Set(h.players.map((p) => p.contrib))].filter((x) => x > 0).sort((a, b) => a - b);
    const pots = []; let prev = 0;
    for (const lv of levels) {
      const amount = h.players.reduce((x, p) => x + Math.max(0, Math.min(p.contrib, lv) - prev), 0);
      const elig = live.filter((x) => x.p.contrib >= lv);
      if (amount > 0 && elig.length) pots.push({ amount, elig });
      else if (amount > 0 && pots.length) pots[pots.length - 1].amount += amount;
      prev = lv;
    }
    award(t, pots.map((pt) => { const top = pt.elig.reduce((m, x) => (!m || cmp(x.r, m) > 0 ? x.r : m), null); return { amount: pt.amount, winners: pt.elig.filter((x) => cmp(x.r, top) === 0).map((x) => x.p), name: handName(top) }; }), false);
  }
  // Gewinne verteilen, Stats melden, nächste Hand planen
  function award(t, pots, byFold) {
    const h = t.hand; clearTimeout(t.timer);
    if (byFold) { const total = h.pot + h.players.reduce((x, p) => x + p.bet, 0); for (const p of h.players) { p.bet = 0; } pots = [{ amount: total, winners: pots[0], name: '' }]; h.pot = total; }
    h.street = 'showdown'; h.toAct = -1; h.deadline = null;
    const won = new Map();
    for (const pt of pots) {
      const share = Math.floor(pt.amount / pt.winners.length);
      let rest = pt.amount - share * pt.winners.length;
      for (const w of pt.winners) { const x = share + (rest-- > 0 ? 1 : 0); won.set(w.id, (won.get(w.id) || 0) + x); }
    }
    for (const [id, x] of won) { const i = t.seats.findIndex((s) => s && s.id === id); if (i >= 0) t.seats[i].stack += x; }
    h.winners = [...won.entries()].map(([id, amount]) => ({ id, amount, name: (t.seats.find((s) => s && s.id === id) || {}).name || '?', hand: byFold ? '' : (pots.find((pt) => pt.winners.some((w) => w.id === id)) || {}).name || '' }));
    for (const p of h.players) onStat(p.id, p.contrib, won.get(p.id) || 0, { allin: p.allin }).catch(() => {});
    pushTable(t);
    t.timer = setTimeout(() => {
      t.hand = null;
      // Wer weg ist oder aufstehen wollte, verlässt jetzt den Tisch
      for (let i = 0; i < t.max; i++) { const s = t.seats[i]; if (s && (s.leaving || (!s.sockets.size && Date.now() - (s.goneAt || 0) > 60000))) standUp(t, i); }
      pushTable(t); pushList(); scheduleHand(t);
    }, byFold ? 2500 : SHOW_MS);
  }
  async function standUp(t, i) {
    const s = t.seats[i]; if (!s) return;
    t.seats[i] = null; seatOf.delete(s.id);
    if (s.stack > 0) { const v = await addDia(s.id, s.stack); for (const so of s.sockets) so.emit('diamonds', v); }
    for (const so of s.sockets) so.emit('pk:state', null);
  }

  function attach(socket, user) {
    socket.on('pk:list', () => socket.emit('pk:list', summary()));
    socket.on('pk:watch', (tid) => { const t = tables.get(String(tid)); if (!t) return; t.watchers = t.watchers || new Set(); t.watchers.add(socket); socket.emit('pk:state', view(t, user.id)); });
    socket.on('pk:sit', async (arg) => {
      try {
        const t = tables.get(String(arg && arg.table)); if (!t) return socket.emit('err', 'Diesen Tisch gibt es nicht.');
        const u = await store.userById(user.id); if (!u) return;
        if (!(await canPlay(u))) return socket.emit('err', 'Poker ist noch nicht freigeschaltet.');
        const other = seatOf.get(user.id);
        if (other && other !== t.id) return socket.emit('err', 'Du sitzt schon an einem anderen Tisch.');
        if (other === t.id) { const s = t.seats.find((x) => x && x.id === user.id); if (s) { s.sockets.add(socket); s.goneAt = 0; } return pushTable(t); }
        let idx = Number.isInteger(arg.seat) && arg.seat >= 0 && arg.seat < t.max && !t.seats[arg.seat] ? arg.seat : t.seats.findIndex((x) => !x);
        if (idx < 0) return socket.emit('err', 'Der Tisch ist voll.');
        if ((Number(u.diamonds) || 0) < t.buyIn) return socket.emit('err', `Du brauchst ${t.buyIn} Diamanten zum Hinsetzen.`);
        const v = await addDia(user.id, -t.buyIn); socket.emit('diamonds', v);
        t.seats[idx] = { id: user.id, name: u.name, av: Number(u.av) || 0, frame: u.frame || '', color: u.color || '', stack: t.buyIn, sockets: new Set([socket]), sitOut: false };
        seatOf.set(user.id, t.id);
        if (t.watchers) t.watchers.delete(socket);
        pushTable(t); pushList(); scheduleHand(t);
      } catch (e) { console.error('Poker hinsetzen:', e.message); }
    });
    socket.on('pk:invite', async (friendId) => {
      try {
        const t = tables.get(seatOf.get(user.id)); if (!t) return socket.emit('err', 'Setz dich zuerst an einen Tisch.');
        const f = await store.userById(Number(friendId)); if (!f) return socket.emit('err', 'Diesen Spieler gibt es nicht.');
        io.sockets.sockets.forEach((so) => { if (so.data.user && so.data.user.id === f.id) so.emit('pk:invited', { from: user.name, table: t.id, name: t.name, buyIn: t.buyIn }); });
        if (push) push.toUser(f.id, { title: '♠️ Poker-Einladung', body: `${user.name} lädt dich an den ${t.name}-Tisch ein (Einkauf ${t.buyIn} 💎).`, tag: 'poker', url: '/' }).catch(() => {});
        socket.emit('note', 'Einladung an ' + f.name + ' verschickt');
      } catch (e) { console.error(e); }
    });
    // Emojis am Tisch: für alle am Tisch und alle Zuschauer sichtbar
    socket.on('pk:emote', (i) => {
      const t = tables.get(seatOf.get(user.id)); if (!t) return;
      const n = Number(i); if (!Number.isInteger(n) || n < 0 || n > 7) return;
      const now = Date.now(); if (now - (socket.data.pkEmoteAt || 0) < 1500) return; socket.data.pkEmoteAt = now;
      const seat = t.seats.findIndex((x) => x && x.id === user.id);
      for (const s of t.seats) if (s) for (const so of s.sockets) so.emit('pk:emote', { seat, i: n });
      for (const so of t.watchers || []) so.emit('pk:emote', { seat, i: n });
    });
    socket.on('pk:rebuy', async () => {
      const t = tables.get(seatOf.get(user.id)); if (!t) return;
      const s = t.seats.find((x) => x && x.id === user.id); if (!s || s.stack > 0) return;
      const u = await store.userById(user.id);
      if ((Number(u.diamonds) || 0) < t.buyIn) return socket.emit('err', `Du brauchst ${t.buyIn} Diamanten zum Nachkaufen.`);
      socket.emit('diamonds', await addDia(user.id, -t.buyIn)); s.stack = t.buyIn; pushTable(t); scheduleHand(t);
    });
    socket.on('pk:act', (a) => {
      const t = tables.get(seatOf.get(user.id)); if (!t) return;
      const err = act(t, user.id, a || {}, false); if (err) socket.emit('err', err);
    });
    socket.on('pk:leave', () => {
      const t = tables.get(seatOf.get(user.id)); if (!t) return;
      const i = t.seats.findIndex((x) => x && x.id === user.id); if (i < 0) return;
      const p = t.hand && t.hand.players.find((x) => x.id === user.id);
      if (p && !p.folded && t.hand.street !== 'showdown') { t.seats[i].leaving = true; foldOut(t, p); socket.emit('pk:state', null); }
      else if (p && t.hand && t.hand.street !== 'showdown') { t.seats[i].leaving = true; socket.emit('pk:state', null); }
      else standUp(t, i).then(() => { pushTable(t); pushList(); });
    });
    socket.on('disconnect', () => {
      for (const t of tables.values()) {
        if (t.watchers) t.watchers.delete(socket);
        const s = t.seats.find((x) => x && x.sockets.has(socket));
        if (s) { s.sockets.delete(socket); if (!s.sockets.size) { s.goneAt = Date.now(); if (!t.hand) setTimeout(() => { const i = t.seats.indexOf(s); if (i >= 0 && !s.sockets.size && !t.hand) standUp(t, i).then(() => { pushTable(t); pushList(); }); }, 60000); } pushTable(t); }
      }
    });
  }
  return { attach, tables, isSeated: (id) => seatOf.has(id), seatedIds: () => [...seatOf.keys()], best, rank5, handName };
};
