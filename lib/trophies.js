// Trophäen-Bibliothek: Sonder-Stücke, die nur der Admin in seinem Profil ausstellen kann (für alle sichtbar)
const LIB = [
  { id: 'karambit_bluegem', name: 'Karambit CASE HARDENED', sub: 'Pattern 387', img: '/trophies/karambit.webp' },
  { id: 'ak47_casehardened', name: 'AK-47 CASE HARDENED', sub: 'Pattern 661', img: '/trophies/ak47.webp' },
];
module.exports = { LIB, byId: (id) => LIB.find((x) => x.id === id) };
