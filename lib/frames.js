// Profilrahmen. anim: wird in der Oberfläche zusätzlich animiert.
const FRAMES = [
  { id: 'f1',  name: 'Werkbank',      need: 'Spiele dein erstes Match',              cond: (u) => u.matches >= 1 },
  { id: 'f2',  name: 'Maßband',       need: 'Spiele 10 Matches zu Ende',             cond: (u) => u.matches >= 10 },
  { id: 'f3',  name: 'Kettenglied',   need: 'Beantworte 300 Fragen',                 cond: (u) => u.answered >= 300 },
  { id: 'f4',  name: 'Lorbeer',       need: 'Gewinne 10 Matches',                    cond: (u) => u.wins >= 10 },
  { id: 'f5',  name: 'Messing',       need: 'Lande 30 mal im Doppel-Bereich (×2)',   cond: (u) => u.close >= 30 },
  { id: 'f6',  name: 'Dornenring',    need: 'Gewinne 3 Matches in Folge',            cond: (u) => u.best_streak >= 3 },
  { id: 'f7',  name: 'Platine',       need: 'Beantworte 150 Auswahlfragen richtig',  cond: (u) => u.mc_right >= 150 },
  { id: 'f8',  name: 'Eichenholz',    need: 'Spiele 30 Matches zu Ende',             cond: (u) => u.matches >= 30 },
  { id: 'f9',  name: 'Eisscholle',    need: 'Hol 1500 Punkte in einem Match',        cond: (u) => u.best_score >= 1500 },
  { id: 'f10', name: 'Obsidian',      need: 'Sammle 25.000 Punkte insgesamt',        cond: (u) => u.points >= 25000 },
  { id: 'f11', name: 'Pfeilkreis',    need: 'Lande 5 Punktlandungen',                cond: (u) => u.exact >= 5 },
  { id: 'f12', name: 'Kristall',      need: 'Sammle 300 Weltranglistenpunkte',       cond: (u) => u.rank_points >= 300 },
  { id: 'f13', name: 'Uhrwerk',       need: 'Beantworte 800 Fragen',                 cond: (u) => u.answered >= 800 },
  { id: 'f14', name: 'Rabenfeder',    need: 'Gewinne 30 Matches',                    cond: (u) => u.wins >= 30 },
  { id: 'f15', name: 'Rubinkrone',    need: 'Erreiche Prestige 3',                   cond: (u) => u.prestige >= 3 },
  { id: 'f16', name: 'Flammenring',   need: 'Gewinne 6 Matches in Folge',            cond: (u) => u.best_streak >= 6, anim: 'fire' },
  { id: 'f17', name: 'Blitzring',     need: 'Lande 15 Punktlandungen',               cond: (u) => u.exact >= 15, anim: 'spark' },
  { id: 'f18', name: 'Giftring',      need: 'Beantworte 400 Auswahlfragen richtig',  cond: (u) => u.mc_right >= 400, anim: 'pulse' },
  { id: 'f19', name: 'Sternenstaub',  need: 'Sammle 1500 Weltranglistenpunkte',      cond: (u) => u.rank_points >= 1500, anim: 'spin' },
  { id: 'f20', name: 'Lavagold',      need: 'Erreiche das Meisterprestige',          cond: (u) => u.prestige >= 11, anim: 'lava' },
  { id: 'fbook', name: 'Pink Pages',  need: 'Geheim', secret: true, code: 'GRACE', anim: 'pulse' },
  { id: 'fdev', name: 'DEV',          need: 'Nur für Entwickler', dev: true, anim: 'dev' },
];
const forced = (u) => String(u.unlocks || '').split(',').filter(Boolean);
const codesOf = (u) => String(u.codes || '').split(',').filter(Boolean);
const has = (f, u, isMod) => (f.dev ? !!isMod : f.secret ? codesOf(u).includes(f.code) || forced(u).includes(f.id) : forced(u).includes(f.id) || !!f.cond(u));
const byId = (id) => FRAMES.find((f) => f.id === id) || null;
const view = (u, isMod) => FRAMES.map((f) => ({ id: f.id, name: f.name, need: f.need, secret: !!f.secret, dev: !!f.dev, anim: f.anim || '', unlocked: has(f, u, isMod) }));
const canUse = (u, id, isMod) => !id || (byId(id) && has(byId(id), u, isMod));
const animOf = (id) => (byId(id) || {}).anim || '';
module.exports = { FRAMES, view, canUse, byId, has, animOf };
