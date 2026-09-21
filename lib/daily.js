// Tagesbelohnungen: Einloggen plus eine wechselnde Aufgabe, 7 Tage in Folge
// Belohnung je Tag der Serie. Wer einen Tag auslässt, beginnt wieder bei Tag 1.
const DAYS = [
  { dia: 1000 },
  { dia: 1500 },
  { dia: 1000, pack: 'standard' },
  { dia: 2000 },
  { dia: 1500, pack: 'premium' },
  { dia: 3000 },
  { dia: 5000, pack: 'ghost', title: 'Siebenfach' },
];
const DIA = DAYS.map((d) => d.dia);
const TASKS = [
  { key: 'play', text: 'Spiele 1 Match zu Ende', need: 1, dia: 500, stat: 'matches' },
  { key: 'win', text: 'Gewinne 1 Match', need: 1, dia: 800, stat: 'wins' },
  { key: 'cards', text: 'Öffne 1 Booster', need: 1, dia: 600, stat: 'packs_opened' },
  { key: 'casino', text: 'Spiele 3 Casino-Runden', need: 3, dia: 500, stat: 'casino_rounds' },
  { key: 'exact', text: 'Lande 1 Punktlandung', need: 1, dia: 1200, stat: 'exact' },
  { key: 'answer', text: 'Beantworte 20 Fragen', need: 20, dia: 500, stat: 'answered' },
  { key: 'melt', text: 'Wandle 1 doppelte Karte um', need: 1, dia: 400, stat: 'melted' },
];
const dayKey = (d = new Date()) => {
  const t = new Date(d.getTime() + 2 * 3600 * 1000); // grob deutsche Zeit
  return t.toISOString().slice(0, 10);
};
const taskFor = (day) => TASKS[(day - 1) % TASKS.length];
// Fortschritt der Tagesaufgabe: Differenz zum Stand beim Tageswechsel
function view(u) {
  const today = dayKey();
  const last = u.daily_day || '';
  const streak = last === today ? (u.daily_streak || 0) : (last === dayKey(new Date(Date.now() - 86400000)) ? (u.daily_streak || 0) : 0);
  const nextDay = Math.min(7, (last === today ? streak : streak + 1) || 1);
  const t = taskFor(nextDay);
  const base = Number(u.daily_base) || 0;
  const cur = Math.max(0, (Number(u[t.stat]) || 0) - base);
  return {
    today, claimed: last === today, streak, day: nextDay,
    loginDia: DIA[nextDay - 1], days: DIA, rewards: DAYS, pack: DAYS[nextDay - 1].pack || null,
    task: { text: t.text, need: t.need, cur: Math.min(cur, t.need), dia: t.dia, done: cur >= t.need, key: t.key },
  };
}
module.exports = { view, taskFor, dayKey, DIA, DAYS, TASKS };
