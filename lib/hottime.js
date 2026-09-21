// Hot Time: jeden Abend von 20 bis 24 Uhr deutscher Zeit doppelte XP (Quiz und Casino) und doppelte Diamanten im Quiz
const START = 20, END = 24;
function berlinNow(now = new Date()) { return new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' })); }
function active(now = new Date()) { if (process.env.HOT_TEST) return true; const h = berlinNow(now).getHours(); return h >= START && h < END; } // HOT_TEST nur für Tests
// Sekunden bis zum Ende (wenn aktiv) oder bis zum nächsten Start
function view(now = new Date()) {
  const b = berlinNow(now), secOfDay = b.getHours() * 3600 + b.getMinutes() * 60 + b.getSeconds();
  const on = b.getHours() >= START && b.getHours() < END;
  const until = on ? END * 3600 - secOfDay : (secOfDay < START * 3600 ? START * 3600 - secOfDay : 24 * 3600 - secOfDay + START * 3600);
  return { active: on, seconds: until, start: START, end: END };
}
module.exports = { active, view, berlinNow };
