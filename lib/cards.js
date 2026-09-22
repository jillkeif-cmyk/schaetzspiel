// Spielerkarten: Embleme (Bilder) und Titel (Banner). Beides wird über Herausforderungen freigeschaltet.
// cond(u) prüft den Spielerstand. secret: nur über einen Code.

const EMBLEMS = [
  { id: 'e1',  name: 'Erstkontakt',   need: 'Spiele dein erstes Match',                 cond: (u) => u.matches >= 1 },
  { id: 'e2',  name: 'Zeitgefühl',    need: 'Spiele 20 Matches zu Ende',                cond: (u) => u.matches >= 20 },
  { id: 'e3',  name: 'Siegerfaust',   need: 'Gewinne 10 Matches',                       cond: (u) => u.wins >= 10 },
  { id: 'e4',  name: 'Robin Hood',    need: 'Lande 3 Punktlandungen',                   cond: (u) => u.exact >= 3 },
  { id: 'e5',  name: 'Laserauge',     need: 'Lande 10 Punktlandungen',                  cond: (u) => u.exact >= 10 },
  { id: 'e6',  name: 'Brandstifter',  need: 'Gewinne 3 Matches in Folge',               cond: (u) => u.best_streak >= 3 },
  { id: 'e7',  name: 'Kurvenkönig',   need: 'Hol 2000 Punkte in einem Match',           cond: (u) => u.best_score >= 2000 },
  { id: 'e8',  name: 'Denkapparat',   need: 'Beantworte 250 Auswahlfragen richtig',     cond: (u) => u.mc_right >= 250 },
  { id: 'e9',  name: 'Veteran',       need: 'Erreiche Prestige 3',                      cond: (u) => u.prestige >= 3 },
  { id: 'e10', name: 'Weltklasse',    need: 'Sammle 500 Weltranglistenpunkte',          cond: (u) => u.rank_points >= 500 },
  { id: 'e11', name: 'Blitzdenker',   need: 'Gib 100 Schätzungen in unter 10 Sekunden ab (aktuell: alle Antworten)', cond: (u) => u.answered >= 600 },
  { id: 'e12', name: 'Königsmörder', need: 'Gewinne 25 Matches',                       cond: (u) => u.wins >= 25 },
  { id: 'e13', name: 'Phönix',       need: 'Spiele 100 Matches zu Ende',               cond: (u) => u.matches >= 100 },
  { id: 'e14', name: 'Jäger',        need: 'Schaffe 100 Doppel-Treffer (×2)',     cond: (u) => u.close >= 100 },
  { id: 'e15', name: 'Glückspilz',   need: 'Lande 20 Punktlandungen',                  cond: (u) => u.exact >= 20 },
  { id: 'e16', name: 'Maschine',     need: 'Beantworte 500 Auswahlfragen richtig',     cond: (u) => u.mc_right >= 500 },
  { id: 'e17', name: 'Zeitlos',      need: 'Sammle 100.000 Punkte insgesamt',          cond: (u) => u.points >= 100000 },
  { id: 'e18', name: 'Gipfelstürmer',need: 'Hol 3000 Punkte in einem Match',           cond: (u) => u.best_score >= 3000 },
  { id: 'e19', name: 'Rabenmutter',  need: 'Gewinne 7 Matches in Folge',               cond: (u) => u.best_streak >= 7 },
  { id: 'e20', name: 'Schlüsselmeister', need: 'Sammle 1500 Weltranglistenpunkte',     cond: (u) => u.rank_points >= 1500 },
  { id: 'e21', name: 'Kristallkugel', need: 'Lande 30 Punktlandungen',                 cond: (u) => u.exact >= 30 },
  { id: 'e22', name: 'Kleeblatt',     need: 'Schaffe 250 Doppel-Treffer (×2)',    cond: (u) => u.close >= 250 },
  { id: 'e23', name: 'Mastermind',    need: 'Beantworte 750 Auswahlfragen richtig',    cond: (u) => u.mc_right >= 750 },
  { id: 'e24', name: 'Bankhalter',    need: 'Spiele 150 Matches zu Ende',              cond: (u) => u.matches >= 150 },
  { id: 'e25', name: 'Allwissend',    need: 'Sammle 200.000 Punkte insgesamt',         cond: (u) => u.points >= 200000 },
  { id: 'e26', name: 'Feinwaage',     need: 'Beantworte 1500 Fragen',                  cond: (u) => u.answered >= 1500 },
  { id: 'e27', name: 'Schicksalskugel', need: 'Gewinne 12 Matches in Folge',           cond: (u) => u.best_streak >= 12 },
  { id: 'e28', name: 'Zirkelschlag',  need: 'Sammle 3000 Weltranglistenpunkte',        cond: (u) => u.rank_points >= 3000 },
  { id: 'e29', name: 'Kopf oder Zahl', need: 'Gewinne 75 Matches',                     cond: (u) => u.wins >= 75 },
  { id: 'e30', name: 'Dreifachtreffer', need: 'Hol 4000 Punkte in einem Match',        cond: (u) => u.best_score >= 4000 },
  { id: 'EN1', name: 'Die Nummer Eins',    need: 'Nur für das Entwicklerteam', dev: true, cond: () => false, anim: 'video' },
  { id: 'ER8', name: 'Pharao der Straße', need: 'Nur für das Entwicklerteam', dev: true, cond: () => false, anim: 'video' },
  { id: 'ETT', name: 'Seitenflügel',      need: 'Nur für das Entwicklerteam', dev: true, cond: () => false, anim: 'video' },
  { id: 'EP1', name: 'Violetter Chipturm', need: 'Spiele 50 Poker-Hände', cond: (u) => (u.poker_hands || 0) >= 50 },
  { id: 'EP2', name: 'Asse-Schild',        need: 'Gewinne einen Pot mit 5.000 Diamanten', cond: (u) => (u.poker_best || 0) >= 5000 },
  { id: 'EP3', name: 'Pokerkrone',         need: 'Gewinne einen Pot mit 60.000 Diamanten', cond: (u) => (u.poker_best || 0) >= 60000, anim: 'video' },
  { id: 'ET1', name: 'Toon-Grimoire',      need: 'Sammle 10 verschiedene Toon-Welt-Karten', cond: (u) => (u.toon_distinct || 0) >= 10 },
  { id: 'ET2', name: 'Arcane-Siegel',      need: 'Sammle 20 verschiedene Toon-Welt-Karten', cond: (u) => (u.toon_distinct || 0) >= 20 },
  { id: 'ET3', name: 'Herr der Toon-Welt', need: 'Sammle alle 33 Toon-Welt-Karten inklusive der 3 Extended Arts', cond: (u) => (u.toon_distinct || 0) >= 33 },
  { id: 'EC1', name: 'Walzenkönig',   need: 'Nur mit dem Aktionscode',                 secret: true, code: 'GAMBLER'},
  { id: 'EC2', name: 'Roulettekrone', need: 'Nur mit dem Aktionscode',                secret: true, code: 'GAMBLER'},
  { id: 'EC3', name: 'Chipturm',      need: 'Nur mit dem Aktionscode', secret: true, code: 'GAMBLER'},
  { id: 'L1', name: 'Höllenkessel',   need: 'Gewinne 50.000 Diamanten auf einmal im Casino', cond: (u) => (u.casino_best || 0) >= 50000, anim: 'fire' },
  { id: 'L2', name: 'Teufelsblatt',   need: 'Gewinne 500 Casino-Runden',                cond: (u) => (u.casino_wins || 0) >= 500, anim: 'spark' },
  { id: 'L3', name: 'Prismatresor',   need: 'Sammle 25 Extended-Art- oder Ghost-Karten', cond: (u) => (u.cards_ext || 0) >= 25, anim: 'prism' },
  { id: 'L4', name: 'Münzdrache',     need: 'Spiele 2500 Casino-Runden',                cond: (u) => (u.casino_rounds || 0) >= 2500, anim: 'spin' },
  { id: 'L5', name: 'Kronarchiv',     need: 'Sammle 1000 Karten',                       cond: (u) => (u.cards_total || 0) >= 1000, anim: 'crown' },
  { id: 'e31', name: 'Kesselfieber',  need: 'Spiele 150 Casino-Runden',              cond: (u) => (u.casino_rounds || 0) >= 150 },
  { id: 'e32', name: 'Kartenhai',     need: 'Gewinne 75 Casino-Runden',              cond: (u) => (u.casino_wins || 0) >= 75 },
  { id: 'e33', name: 'Sammelalbum',   need: 'Sammle 250 Karten',                     cond: (u) => (u.cards_total || 0) >= 250 },
  { id: 'e34', name: 'Vitrine',       need: 'Sammle 12 Extended-Art- oder Ghost-Karten', cond: (u) => (u.cards_ext || 0) >= 12 },
  { id: 'egrace', name: 'Dino-Geburtstag', need: 'Gewinne heute eine GRACE-Runde', event: 'grace' },
  { id: 'secret', name: 'Pink Pages', need: 'Geheim', secret: true, code: 'GRACE' },
];

// style: Klasse für das Banner in der Oberfläche
const TITLES = [
  { id: 't1',  text: 'Frischling',        style: 'grau',   need: 'Spiele dein erstes Match',              cond: (u) => u.matches >= 1 },
  { id: 't2',  text: 'Daumenpeilung',     style: 'bronze', need: 'Beantworte 200 Fragen',                 cond: (u) => u.answered >= 200 },
  { id: 't3',  text: 'Zollstock',         style: 'bronze', need: 'Spiele 10 Matches zu Ende',             cond: (u) => u.matches >= 10 },
  { id: 't4',  text: 'Bauchgefühl',       style: 'gruen',  need: 'Schaffe 50 Doppel-Treffer (×2)',   cond: (u) => u.close >= 50 },
  { id: 't5',  text: 'Punktlandung',      style: 'gold',   need: 'Lande 5 Punktlandungen',                cond: (u) => u.exact >= 5 },
  { id: 't6',  text: 'Zielwasser',        style: 'gold',   need: 'Lande 15 Punktlandungen',               cond: (u) => u.exact >= 15 },
  { id: 't7',  text: 'Seriensieger',      style: 'feuer',  need: 'Gewinne 5 Matches in Folge',            cond: (u) => u.best_streak >= 5 },
  { id: 't8',  text: 'Hausnummer',        style: 'lila',   need: 'Hol 1500 Punkte in einem Match',        cond: (u) => u.best_score >= 1500 },
  { id: 't9',  text: 'Unantastbar',       style: 'eis',    need: 'Gewinne 50 Matches',                    cond: (u) => u.wins >= 50 },
  { id: 't10', text: 'Maßbandlegende',    style: 'legende',need: 'Erreiche Prestige 5',                   cond: (u) => u.prestige >= 5 },
  { id: 't11', text: 'Blitzableiter',  style: 'eis',    need: 'Beantworte 600 Fragen',                 cond: (u) => u.answered >= 600 },
  { id: 't12', text: 'Kronenträger',   style: 'gold',   need: 'Gewinne 25 Matches',                    cond: (u) => u.wins >= 25 },
  { id: 't13', text: 'Wiedergeburt',   style: 'feuer',  need: 'Spiele 100 Matches zu Ende',            cond: (u) => u.matches >= 100 },
  { id: 't14', text: 'Tiefseetaucher', style: 'eis',    need: 'Schaffe 150 Doppel-Treffer (×2)',  cond: (u) => u.close >= 150 },
  { id: 't15', text: 'Würfelglück',    style: 'gruen',  need: 'Spiele 60 Matches zu Ende',             cond: (u) => u.matches >= 60 },
  { id: 't16', text: 'Rechenmaschine', style: 'eis',    need: 'Beantworte 400 Auswahlfragen richtig',  cond: (u) => u.mc_right >= 400 },
  { id: 't17', text: 'Sandkorn',       style: 'bronze', need: 'Sammle 50.000 Punkte insgesamt',        cond: (u) => u.points >= 50000 },
  { id: 't18', text: 'Über den Wolken',style: 'lila',   need: 'Hol 2500 Punkte in einem Match',        cond: (u) => u.best_score >= 2500 },
  { id: 't19', text: 'Unheilsbote',    style: 'lila',   need: 'Gewinne 10 Matches in Folge',           cond: (u) => u.best_streak >= 10 },
  { id: 't20', text: 'Schatzmeister',  style: 'gold',   need: 'Sammle 1000 Weltranglistenpunkte',      cond: (u) => u.rank_points >= 1000 },
  { id: 't21', text: 'Hellseher',        style: 'lila',   need: 'Lande 25 Punktlandungen',               cond: (u) => u.exact >= 25 },
  { id: 't22', text: 'Glückssträhne',    style: 'gruen',  need: 'Gewinne 15 Matches in Folge',           cond: (u) => u.best_streak >= 15 },
  { id: 't23', text: 'Mastermind',       style: 'eis',    need: 'Beantworte 600 Auswahlfragen richtig',  cond: (u) => u.mc_right >= 600 },
  { id: 't24', text: 'High Roller',      style: 'gold',   need: 'Spiele 120 Matches zu Ende',            cond: (u) => u.matches >= 120 },
  { id: 't25', text: 'Orakel',           style: 'gold',   need: 'Sammle 150.000 Punkte insgesamt',       cond: (u) => u.points >= 150000 },
  { id: 't26', text: 'Millimeterarbeit', style: 'grau',   need: 'Beantworte 1200 Fragen',                cond: (u) => u.answered >= 1200 },
  { id: 't27', text: 'Kopf oder Zahl',   style: 'bronze', need: 'Gewinne 60 Matches',                    cond: (u) => u.wins >= 60 },
  { id: 't28', text: 'Zirkelschluss',    style: 'eis',    need: 'Sammle 2500 Weltranglistenpunkte',      cond: (u) => u.rank_points >= 2500 },
  { id: 't29', text: 'Ins Schwarze',     style: 'feuer',  need: 'Hol 3500 Punkte in einem Match',        cond: (u) => u.best_score >= 3500 },
  { id: 't30', text: 'Königsgambit',     style: 'legende',need: 'Gewinne 100 Matches',                   cond: (u) => u.wins >= 100 },
  { id: 'tmaster', text: 'Meister aller Klassen', style: 'legende', need: 'Erreiche das Meisterprestige', cond: (u) => u.prestige >= 11 },
  { id: 'TP1', text: 'Violetter Flush',  style: 'lila',    need: 'Verbringe 5 Stunden am Pokertisch', cond: (u) => (u.poker_minutes || 0) >= 300, anim: 'video' },
  { id: 'TP2', text: 'Asse in Flammen',  style: 'feuer',   need: 'Gewinne 150 Hände beim Poker', cond: (u) => (u.poker_wins || 0) >= 150, anim: 'video' },
  { id: 'TP3', text: 'König des Pokers', style: 'legende', need: 'Gewinne 1.500 Hände beim Poker', cond: (u) => (u.poker_wins || 0) >= 1500, anim: 'video' },
  { id: 'TT1', text: 'Toon-Leser',              style: 'eis',     need: 'Sammle 5 verschiedene Toon-Welt-Karten',  cond: (u) => (u.toon_distinct || 0) >= 5 },
  { id: 'TT2', text: 'Toon-Zauberer',           style: 'lila',    need: 'Sammle 15 verschiedene Toon-Welt-Karten', cond: (u) => (u.toon_distinct || 0) >= 15 },
  { id: 'TT3', text: 'Herrscher der Toon-Welt', style: 'legende', need: 'Sammle alle 33 Toon-Welt-Karten inklusive der 3 Extended Arts', cond: (u) => (u.toon_distinct || 0) >= 33 },
  { id: 'THR', text: 'High Roller',   style: 'gold',    need: 'Gewinne 100.000 Diamanten auf einmal im Casino', cond: (u) => (u.casino_best || 0) >= 100000, anim: 'spin' },
  { id: 'TGK', text: 'Goldener König',   style: 'legende', need: 'Nur für das Entwicklerteam', dev: true, cond: () => false, anim: 'video' },
  { id: 'TR8', text: 'Alexandria-Raser', style: 'legende', need: 'Nur für das Entwicklerteam', dev: true, cond: () => false, anim: 'video' },
  { id: 'TTT', text: 'Bücherwirbel',     style: 'legende', need: 'Nur für das Entwicklerteam', dev: true, cond: () => false, anim: 'video' },
  { id: 'TDEV', text: 'Entwickler',   style: 'legende', need: 'Nur für das Entwicklerteam', dev: true, cond: () => false, anim: 'dev' },
  { id: 'TC1', text: 'Diamantregen', style: 'gold',    need: 'Nur mit dem Aktionscode',                   secret: true, code: 'GAMBLER'},
  { id: 'TC2', text: 'Kartenkönig',  style: 'gold',    need: 'Nur mit dem Aktionscode',                   secret: true, code: 'GAMBLER'},
  { id: 'TC3', text: 'Jackpot',      style: 'gold',    need: 'Nur mit dem Aktionscode', secret: true, code: 'GAMBLER'},
  { id: 'TD7', text: 'Siebenfach',    style: 'legende', need: 'Hol 7 Tage in Folge deine Tagesbelohnung', cond: () => false, anim: 'crown' },
  { id: 'TL1', text: 'Höllenbankier',  style: 'feuer',   need: 'Gewinne 50.000 Diamanten auf einmal im Casino', cond: (u) => (u.casino_best || 0) >= 50000, anim: 'fire' },
  { id: 'TL2', text: 'Teufelsspieler', style: 'lila',    need: 'Gewinne 500 Casino-Runden',                 cond: (u) => (u.casino_wins || 0) >= 500, anim: 'spark' },
  { id: 'TL3', text: 'Prismasammler',  style: 'eis',     need: 'Sammle 25 Extended-Art- oder Ghost-Karten',  cond: (u) => (u.cards_ext || 0) >= 25, anim: 'prism' },
  { id: 'TL4', text: 'Münzdrache',     style: 'gold',    need: 'Spiele 2500 Casino-Runden',                  cond: (u) => (u.casino_rounds || 0) >= 2500, anim: 'spin' },
  { id: 'TL5', text: 'Kronarchivar',   style: 'legende', need: 'Sammle 1000 Karten',                         cond: (u) => (u.cards_total || 0) >= 1000, anim: 'crown' },
  { id: 't31', text: 'Hausvorteil',   style: 'gold',   need: 'Gewinne 5000 Diamanten auf einmal', cond: (u) => (u.casino_best || 0) >= 5000 },
  { id: 't32', text: 'Kartenzähler',  style: 'eis',    need: 'Spiele 400 Casino-Runden',           cond: (u) => (u.casino_rounds || 0) >= 400 },
  { id: 't33', text: 'Sammler',       style: 'bronze', need: 'Sammle 100 Karten',                  cond: (u) => (u.cards_total || 0) >= 100 },
  { id: 't34', text: 'Kurator',       style: 'legende',need: 'Sammle 25 seltene Karten (Holo und besser)', cond: (u) => (u.cards_rare || 0) >= 25 },
  { id: 'tgrace', text: 'Dinoflüsterer', style: 'pink', need: 'Gewinne heute eine GRACE-Runde', event: 'grace' },
  { id: 'secret', text: 'BookTok-Legende', style: 'pink',  need: 'Geheim', secret: true, code: 'GRACE' },
];

const codesOf = (u) => String(u.codes || '').split(',').filter(Boolean);
const forced = (u) => String(u.unlocks || '').split(',').filter(Boolean);
const has = (item, u) => (item.dev ? !!(u && u._mod) : forced(u).includes(item.id) || (item.event ? false : item.secret ? codesOf(u).includes(item.code) : !!item.cond(u)));

function view(u) {
  const pack = (list, extra) => list.map((i) => ({ id: i.id, ...extra(i), secret: !!i.secret, event: i.event || '', anim: i.anim || '', need: i.need, unlocked: has(i, u) }));
  return {
    emblems: pack(EMBLEMS.filter((i) => !i.dev || (u && u._mod)), (i) => ({ name: i.name })),
    titles: pack(TITLES.filter((i) => !i.dev || (u && u._mod)), (i) => ({ text: i.text, style: i.style, dev: !!i.dev })),
  };
}
const titleById = (id) => TITLES.find((t) => t.id === id) || null;
const canUse = (u, emblem, title) =>
  (!emblem || (EMBLEMS.find((e) => e.id === emblem) && has(EMBLEMS.find((e) => e.id === emblem), u))) &&
  (!title || (titleById(title) && has(titleById(title), u)));

// Codes einlösen. Ein Code kann mehrere Sachen freischalten.
const CODES = { GRACE: 'Pink Pages und BookTok-Legende', GAMBLER: 'Casino-Paket: 3 animierte Titel, 3 Embleme, 3 Rahmen und 15.000 Diamanten', POKER: 'Poker-Startkapital: 10.000 Diamanten für die Pokertische' };
const CODE_DIAMONDS = { GAMBLER: 15000, POKER: 10000 };
function redeem(u, raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!CODES[code]) return { ok: false, error: 'Dieser Code stimmt nicht.' };
  const list = codesOf(u);
  if (list.includes(code)) return { ok: false, error: 'Diesen Code hast du schon eingelöst.' };
  return { ok: true, codes: [...list, code].join(','), reward: CODES[code], diamonds: CODE_DIAMONDS[code] || 0 };
}

// Admin schaltet einzelne Karten frei oder nimmt sie zurück
function setUnlock(u, id, on, extra = []) {
  // extra: weitere freischaltbare IDs, etwa die Rahmen
  const all = [...EMBLEMS, ...TITLES].map((i) => i.id).concat(extra);
  if (!all.includes(id) && id !== '*') return null;
  let list = forced(u);
  if (id === '*') list = on ? [...new Set(all)] : [];
  else list = on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  return list.join(',');
}
module.exports = { EMBLEMS, TITLES, view, canUse, redeem, titleById, has, setUnlock };
