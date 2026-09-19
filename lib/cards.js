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
  { id: 'secret', name: 'Pink Pages', need: 'Geheim', secret: true, code: 'GRACE' },
];

// style: Klasse für das Banner in der Oberfläche
const TITLES = [
  { id: 't1',  text: 'Frischling',        style: 'grau',   need: 'Spiele dein erstes Match',              cond: (u) => u.matches >= 1 },
  { id: 't2',  text: 'Daumenpeilung',     style: 'bronze', need: 'Beantworte 200 Fragen',                 cond: (u) => u.answered >= 200 },
  { id: 't3',  text: 'Zollstock',         style: 'bronze', need: 'Spiele 10 Matches zu Ende',             cond: (u) => u.matches >= 10 },
  { id: 't4',  text: 'Bauchgefühl',       style: 'gruen',  need: 'Lande 50 mal im Doppel-Bereich (×2)',   cond: (u) => u.close >= 50 },
  { id: 't5',  text: 'Punktlandung',      style: 'gold',   need: 'Lande 5 Punktlandungen',                cond: (u) => u.exact >= 5 },
  { id: 't6',  text: 'Zielwasser',        style: 'gold',   need: 'Lande 15 Punktlandungen',               cond: (u) => u.exact >= 15 },
  { id: 't7',  text: 'Seriensieger',      style: 'feuer',  need: 'Gewinne 5 Matches in Folge',            cond: (u) => u.best_streak >= 5 },
  { id: 't8',  text: 'Hausnummer',        style: 'lila',   need: 'Hol 1500 Punkte in einem Match',        cond: (u) => u.best_score >= 1500 },
  { id: 't9',  text: 'Unantastbar',       style: 'eis',    need: 'Gewinne 50 Matches',                    cond: (u) => u.wins >= 50 },
  { id: 't10', text: 'Maßbandlegende',    style: 'legende',need: 'Erreiche Prestige 5',                   cond: (u) => u.prestige >= 5 },
  { id: 'secret', text: 'BookTok-Legende', style: 'pink',  need: 'Geheim', secret: true, code: 'GRACE' },
];

const codesOf = (u) => String(u.codes || '').split(',').filter(Boolean);
const forced = (u) => String(u.unlocks || '').split(',').filter(Boolean);
const has = (item, u) => forced(u).includes(item.id) || (item.secret ? codesOf(u).includes(item.code) : !!item.cond(u));

function view(u) {
  const pack = (list, extra) => list.map((i) => ({ id: i.id, ...extra(i), secret: !!i.secret, need: i.need, unlocked: has(i, u) }));
  return {
    emblems: pack(EMBLEMS, (i) => ({ name: i.name })),
    titles: pack(TITLES, (i) => ({ text: i.text, style: i.style })),
  };
}
const titleById = (id) => TITLES.find((t) => t.id === id) || null;
const canUse = (u, emblem, title) =>
  (!emblem || (EMBLEMS.find((e) => e.id === emblem) && has(EMBLEMS.find((e) => e.id === emblem), u))) &&
  (!title || (titleById(title) && has(titleById(title), u)));

// Codes einlösen. Ein Code kann mehrere Sachen freischalten.
const CODES = { GRACE: 'Pink Pages und BookTok-Legende' };
function redeem(u, raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!CODES[code]) return { ok: false, error: 'Dieser Code stimmt nicht.' };
  const list = codesOf(u);
  if (list.includes(code)) return { ok: false, error: 'Diesen Code hast du schon eingelöst.' };
  return { ok: true, codes: [...list, code].join(','), reward: CODES[code] };
}

// Admin schaltet einzelne Karten frei oder nimmt sie zurück
function setUnlock(u, id, on) {
  const all = [...EMBLEMS, ...TITLES].map((i) => i.id);
  if (!all.includes(id) && id !== '*') return null;
  let list = forced(u);
  if (id === '*') list = on ? [...new Set(all)] : [];
  else list = on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  return list.join(',');
}
module.exports = { EMBLEMS, TITLES, view, canUse, redeem, titleById, has, setUnlock };
