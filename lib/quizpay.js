// Diamanten fürs Quiz (neu): Sieger bis `win` 💎 (voll ab `pts` Punkten), andere anteilig nach Punkten × `lose`.
// Solo: bis `solo` 💎 (voll ab `soloPts` Punkten mit Solo-Sieg), ohne Sieg anteilig × `lose`.
let cfg = { on: true, win: 12000, pts: 2000, solo: 8000, soloPts: 1500, lose: 0.6 };
const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : d));
module.exports = {
  get: () => cfg,
  set: (c) => { cfg = { on: !!c.on, win: Math.round(num(c.win, 12000, 0, 100000)), pts: Math.round(num(c.pts, 2000, 300, 10000)), solo: Math.round(num(c.solo, 8000, 0, 100000)), soloPts: Math.round(num(c.soloPts, 1500, 300, 10000)), lose: num(c.lose, 0.6, 0, 1) }; return cfg; },
  // Diamanten für ein Match (vor Tagesbonus und Hot Time)
  amount: ({ solo, win, score }) => {
    const c = cfg, full = solo ? c.solo : c.win, need = solo ? c.soloPts : c.pts;
    const share = Math.min(1, Math.max(0, Number(score) || 0) / need);
    return Math.round(full * share * (win ? 1 : c.lose));
  },
};
