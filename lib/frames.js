// Profilrahmen. anim: wird in der Oberfläche zusätzlich animiert.
const FRAMES = [
  { id: 'f1',  name: 'Werkbank',      need: 'Spiele dein erstes Match',              cond: (u) => u.matches >= 1 },
  { id: 'f2',  name: 'Maßband',       need: 'Spiele 10 Matches zu Ende',             cond: (u) => u.matches >= 10 },
  { id: 'f3',  name: 'Kettenglied',   need: 'Beantworte 300 Fragen',                 cond: (u) => u.answered >= 300 },
  { id: 'f4',  name: 'Lorbeer',       need: 'Gewinne 10 Matches',                    cond: (u) => u.wins >= 10 },
  { id: 'f5',  name: 'Messing',       need: 'Schaffe 30 Doppel-Treffer (×2)',   cond: (u) => u.close >= 30 },
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
  { id: 'fC1', name: 'Diamantkranz',  need: 'Nur mit dem Aktionscode',                  secret: true, code: 'GAMBLER', anim: 'spin' },
  { id: 'fC2', name: 'Kartenkrone',   need: 'Nur mit dem Aktionscode',                   secret: true, code: 'GAMBLER', anim: 'spin' },
  { id: 'fC3', name: 'Roulettekranz', need: 'Nur mit dem Aktionscode', secret: true, code: 'GAMBLER', anim: 'spin' },
  { id: 'fL1', name: 'Feuerkessel',   need: 'Gewinne 100.000 Diamanten auf einmal im Casino', cond: (u) => (u.casino_best || 0) >= 100000, anim: 'fire' },
  { id: 'fL2', name: 'Prismafächer',  need: 'Sammle 40 Extended-Art- oder Ghost-Karten',  cond: (u) => (u.cards_ext || 0) >= 40, anim: 'prism' },
  { id: 'fL3', name: 'Münzdrache',    need: 'Spiele 5000 Casino-Runden',                  cond: (u) => (u.casino_rounds || 0) >= 5000, anim: 'spin' },
  { id: 'fL4', name: 'Kronreif',      need: 'Sammle 2000 Karten',                         cond: (u) => (u.cards_total || 0) >= 2000, anim: 'crown' },
  { id: 'fL5', name: 'Höllenblatt',   need: 'Gewinne 1200 Casino-Runden',                 cond: (u) => (u.casino_wins || 0) >= 1200, anim: 'spark' },
  { id: 'f21', name: 'Chipkranz',    need: 'Gewinne 25 Casino-Runden',   cond: (u) => (u.casino_wins || 0) >= 25 },
  { id: 'f22', name: 'Kartenfächer', need: 'Sammle 60 Karten',           cond: (u) => (u.cards_total || 0) >= 60, anim: 'spin' },
  { id: 'fgrace', name: 'Dinoland', need: 'Gewinne heute eine GRACE-Runde', event: 'grace', anim: 'pulse' },
  { id: 'fdev', name: 'DEV',          need: 'Nur für Entwickler', dev: true, anim: 'dev' },
];
const forced = (u) => String(u.unlocks || '').split(',').filter(Boolean);
const codesOf = (u) => String(u.codes || '').split(',').filter(Boolean);
const has = (f, u, isMod) => (f.dev ? !!isMod : f.event ? forced(u).includes(f.id) : f.secret ? codesOf(u).includes(f.code) || forced(u).includes(f.id) : forced(u).includes(f.id) || !!f.cond(u));
const byId = (id) => FRAMES.find((f) => f.id === id) || null;
const view = (u, isMod) => FRAMES.map((f) => ({ id: f.id, name: f.name, need: f.need, secret: !!f.secret, dev: !!f.dev, event: f.event || '', anim: f.anim || '', unlocked: has(f, u, isMod) }));
const canUse = (u, id, isMod) => !id || (byId(id) && has(byId(id), u, isMod));
const animOf = (id) => (byId(id) || {}).anim || '';
module.exports = { FRAMES, view, canUse, byId, has, animOf };
