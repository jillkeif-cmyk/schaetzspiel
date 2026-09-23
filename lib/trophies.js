// Trophäen-Bibliothek: Sonder-Stücke, die nur der Admin in seinem Profil ausstellen kann (für alle sichtbar)
const LIB = [
  { id: 'karambit_bluegem', name: 'Karambit „Blue Gem“', sub: 'Case Hardened · Messer', img: '/trophies/karambit.webp' },
  { id: 'ak47_casehardened', name: 'AK-47 „Case Hardened“', sub: 'Blue-Gem-Muster · Sturmgewehr', img: '/trophies/ak47.webp' },
];
module.exports = { LIB, byId: (id) => LIB.find((x) => x.id === id) };
