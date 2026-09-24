// Solo-Sieg: ein Solo-Quiz zählt als Sieg, wenn man mindestens `min` Punkte in höchstens `maxQ` Fragen schafft.
// Standardmäßig aus, im Admin-Menü schaltbar (Einstellung solo_win).
let cfg = { on: true, min: 1500, maxQ: 25 };
module.exports = {
  get: () => cfg,
  set: (c) => { cfg = { on: !!c.on, min: Math.max(300, Math.min(10000, Math.round(Number(c.min) || 1500))), maxQ: Math.max(5, Math.min(50, Math.round(Number(c.maxQ) || 25))) }; return cfg; },
};
