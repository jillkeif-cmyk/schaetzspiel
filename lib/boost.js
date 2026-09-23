// Doppel-XP-Aktion, im Admin-Menü unabhängig von der Hot Time schaltbar: xp = Level-XP, cxp = Casino-XP, pxp = Pass-XP
let B = { xp: false, cxp: false, pxp: false };
module.exports = {
  get: () => ({ ...B }),
  set: (o) => { B = { xp: !!o.xp, cxp: !!o.cxp, pxp: !!o.pxp }; return { ...B }; },
  any: () => B.xp || B.cxp || B.pxp,
};
