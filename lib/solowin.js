// Solo-Sieg: ein Solo-Quiz zählt als Sieg, wenn man mindestens `min` Punkte in höchstens `maxQ` Fragen schafft.
// Standardmäßig aus, im Admin-Menü schaltbar (Einstellung solo_win).
let cfg = { on: true, min: 1200, min15: 750, maxQ: 25 }; // min = 25 Fragen, min15 = 15 Fragen
module.exports = {
  get: () => cfg,
  need: (q) => (Number(q) <= 15 ? cfg.min15 : cfg.min), // Sieggrenze je nach Fragenzahl
  set: (c) => { cfg = { on: !!c.on, min: Math.max(300, Math.min(10000, Math.round(Number(c.min) || 1200))), min15: Math.max(300, Math.min(10000, Math.round(Number(c.min15) || 750))), maxQ: Math.max(5, Math.min(50, Math.round(Number(c.maxQ) || 25))) }; return cfg; },
};
