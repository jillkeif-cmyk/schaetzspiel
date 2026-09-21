// Mehrspieler-Blackjack: Tische mit bis zu 5 Plätzen und gemeinsamer Bank
const casino = require('./casino');
const vip = require('./vip');
const BJ = casino.bj;
const MAX_SEATS = 5, MAX_TABLES = 6;

module.exports = function setupTables(io, store, onStat, push) {
  const tables = new Map(); let nextId = 1;
  const seatOf = new Map(); // userId -> Tisch-ID

  const list = () => [...tables.values()].map((t) => ({ id: t.id, host: t.hostName, seats: t.seats.length, max: MAX_SEATS, phase: t.phase }));
  const pushList = () => io.emit('bj:list', list());
  const view = (t) => ({
    id: t.id, hostId: t.hostId, phase: t.phase, max: MAX_SEATS, turn: t.turn, theme: t.theme || 'gruen', autoIn: t.autoAt ? Math.max(0, Math.ceil((t.autoAt - Date.now()) / 1000)) : null,
    dealer: t.phase === 'done' ? t.dealer : t.dealer ? [t.dealer[0], { hidden: true }] : [],
    dealerScore: t.dealer ? (t.phase === 'done' ? BJ.score(t.dealer) : BJ.score([t.dealer[0]])) : null,
    seats: t.seats.map((s) => {
      const g = t.games.get(s.id);
      return { id: s.id, name: s.name, tier: s.tier || 0, bet: t.bets.get(s.id) || 0, payout: t.payouts.get(s.id) || 0,
        hands: g ? BJ.view(g).hands : [], can: g && t.turn === s.id && !g.waiting ? BJ.view(g).can : {} };
    }),
  });
  const pushTable = (t) => { for (const s of t.seats) for (const so of s.sockets) so.emit('bj:state', view(t)); };
  const addDia = async (uid, n) => { const u = await store.userById(uid); if (u) await store.save(uid, { diamonds: Math.max(0, (Number(u.diamonds) || 0) + n) }); return u ? (Number(u.diamonds) || 0) + n : 0; };

  function nextTurn(t) {
    const open = t.seats.find((s) => { const g = t.games.get(s.id); return g && !g.waiting; });
    if (open) { t.turn = open.id; pushTable(t); return; }
    // Alle fertig: Bank spielt einmal für alle, dann auszahlen
    t.turn = null;
    const any = t.seats.map((s) => t.games.get(s.id)).find(Boolean);
    if (any) casino.dealerPlay(any);
    t.phase = 'done';
    (async () => {
      for (const s of t.seats) {
        const g = t.games.get(s.id); if (!g) continue;
        BJ.finish(g);
        t.payouts.set(s.id, g.payout);
        if (g.payout) await addDia(s.id, g.payout);
        onStat(s.id, g.staked, g.payout).catch(() => {});
      }
      pushTable(t);
      setTimeout(() => { if (!tables.has(t.id)) return; resetRound(t); pushTable(t); pushList(); }, 7000);
    })().catch((e) => console.error('Blackjack-Tisch:', e.message));
  }
  function resetRound(t) { clearTimeout(t.autoTimer); t.autoAt = null; t.phase = 'betting'; t.bets = new Map(); t.games = new Map(); t.payouts = new Map(); t.dealer = null; t.turn = null; }
  function startRound(t) {
    clearTimeout(t.autoTimer); t.autoAt = null;
    if (t.phase !== 'betting' || !t.bets.size) return;
    const deck = casino.deck().concat(casino.deck()); // zwei Decks
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    t.dealer = [deck.pop(), deck.pop()];
    for (const s of t.seats) {
      const bet = t.bets.get(s.id); if (!bet) continue;
      const g = { deck, dealer: t.dealer, hands: [{ cards: [deck.pop(), deck.pop()], bet, done: false, doubled: false, fromSplit: false }], active: 0, insurance: 0, amount: bet, table: true, over: false, insuranceAsked: true };
      if (BJ.isBJ(g.hands[0].cards)) { g.hands[0].done = true; g.waiting = true; }
      t.games.set(s.id, g);
    }
    t.phase = 'playing';
    if (BJ.isBJ(t.dealer)) { for (const g of t.games.values()) g.waiting = true; }
    nextTurn(t); pushList();
  }
  function leave(uid) {
    const id = seatOf.get(uid); if (!id) return;
    const t = tables.get(id); seatOf.delete(uid); if (!t) return;
    const bet = t.bets.get(uid);
    if (bet && t.phase === 'betting') addDia(uid, bet).catch(() => {}); // Einsatz zurück, solange nicht ausgeteilt
    t.seats = t.seats.filter((s) => s.id !== uid);
    const g = t.games.get(uid); if (g) g.waiting = true;
    t.bets.delete(uid);
    if (!t.seats.length) { tables.delete(id); pushList(); return; }
    if (t.hostId === uid) { t.hostId = t.seats[0].id; t.hostName = t.seats[0].name; }
    if (t.phase === 'playing' && t.turn === uid) nextTurn(t); else pushTable(t);
    pushList();
  }

  function attach(socket, user) {
    const fail = (m) => socket.emit('err', m);
    socket.emit('bj:list', list());
    socket.on('bj:create', () => {
      if (seatOf.has(user.id)) return fail('Du sitzt schon an einem Tisch.');
      if (tables.size >= MAX_TABLES) return fail('Alle Tische sind belegt.');
      const t = { id: String(nextId++), hostId: user.id, hostName: user.name, seats: [{ id: user.id, name: user.name, sockets: new Set([socket]) }] };
      resetRound(t); tables.set(t.id, t); seatOf.set(user.id, t.id);
      pushTable(t); pushList();
      store.userById(user.id).then((u) => { if (!u) return; t.theme = u.casino_theme || 'gruen'; t.seats[0].tier = vip.tierIndex(Number(u.casino_xp) || 0); pushTable(t); }).catch(() => {});
    });
    socket.on('bj:join', (id) => {
      const t = tables.get(String(id)); if (!t) return fail('Diesen Tisch gibt es nicht mehr.');
      const mine = seatOf.get(user.id);
      if (mine === t.id) { const s = t.seats.find((x) => x.id === user.id); s.sockets.add(socket); return pushTable(t); }
      if (mine) return fail('Du sitzt schon an einem Tisch.');
      if (t.seats.length >= MAX_SEATS) return fail('Der Tisch ist voll.');
      const seat = { id: user.id, name: user.name, sockets: new Set([socket]) };
      t.seats.push(seat);
      seatOf.set(user.id, t.id); pushTable(t); pushList();
      store.userById(user.id).then((u) => { if (u) { seat.tier = vip.tierIndex(Number(u.casino_xp) || 0); pushTable(t); } }).catch(() => {});
    });
    socket.on('bj:leave', () => { leave(user.id); socket.emit('bj:state', null); });
    socket.on('bj:invite', async (friendId) => {
      try {
        const t = tables.get(seatOf.get(user.id)); if (!t) return fail('Setz dich zuerst an einen Tisch.');
        const f = await store.userById(Number(friendId)); if (!f) return fail('Diesen Spieler gibt es nicht.');
        if (t.seats.length >= MAX_SEATS) return fail('Der Tisch ist voll.');
        io.sockets.sockets.forEach((so) => { if (so.data.user && so.data.user.id === f.id) so.emit('bj:invited', { from: user.name, table: t.id }); });
        if (push) push.toUser(f.id, { title: '🃏 Blackjack-Einladung', body: user.name + ' lädt dich an den Blackjack-Tisch ein.', tag: 'bj', url: '/?bj=' + t.id }).catch(() => {});
        socket.emit('note', 'Einladung an ' + f.name + ' verschickt');
      } catch (e) { console.error(e); }
    });
    socket.on('bj:bet', async (raw) => {
      try {
        const t = tables.get(seatOf.get(user.id)); if (!t || t.phase !== 'betting') return fail('Setzen geht nur vor dem Austeilen.');
        const amount = Math.round(Number(raw) || 0);
        if (amount < 50 || amount > 250000) return fail('Einsatz zwischen 50 und 250.000.');
        const u = await store.userById(user.id);
        const old = t.bets.get(user.id) || 0, have = (Number(u.diamonds) || 0) + old;
        if (amount > have) return fail('So viele Diamanten hast du nicht.');
        await store.save(user.id, { diamonds: have - amount });
        t.bets.set(user.id, amount); socket.emit('diamonds', have - amount);
        const allIn = t.seats.every((x) => t.bets.get(x.id));
        clearTimeout(t.autoTimer);
        const wait = allIn ? 2000 : (t.autoAt ? Math.max(2000, t.autoAt - Date.now()) : 15000);
        t.autoAt = Date.now() + wait;
        t.autoTimer = setTimeout(() => { if (tables.has(t.id)) startRound(t); }, wait);
        pushTable(t);
      } catch (e) { console.error(e); }
    });
    socket.on('bj:start', () => {
      const t = tables.get(seatOf.get(user.id)); if (!t) return;
      if (t.hostId !== user.id) return fail('Nur der Gastgeber teilt aus.');
      if (!t.bets.size) return fail('Noch hat niemand gesetzt.');
      startRound(t);
    });
    socket.on('bj:act', async (a) => {
      try {
        const t = tables.get(seatOf.get(user.id)); if (!t || t.phase !== 'playing' || t.turn !== user.id) return;
        const g = t.games.get(user.id); if (!g) return;
        const need = { double: () => g.hands[g.active].bet, split: () => g.hands[g.active].bet }[a];
        if (need) { const u = await store.userById(user.id); if ((Number(u.diamonds) || 0) < need()) return fail('Dafür reichen deine Diamanten nicht.'); }
        const r = BJ.act(g, String(a)); if (r.error) return fail(r.error);
        if (r.extra) socket.emit('diamonds', await addDia(user.id, -r.extra));
        if (g.waiting) nextTurn(t); else pushTable(t);
      } catch (e) { console.error(e); }
    });
    socket.on('disconnect', () => {
      const t = tables.get(seatOf.get(user.id)); if (!t) return;
      const s = t.seats.find((x) => x.id === user.id); if (s) s.sockets.delete(socket);
      if (s && !s.sockets.size) setTimeout(() => { const s2 = t.seats.find((x) => x.id === user.id); if (s2 && !s2.sockets.size) leave(user.id); }, 20000);
    });
  }
  return { attach, tables, isSeated: (id) => seatOf.has(id) };
};
