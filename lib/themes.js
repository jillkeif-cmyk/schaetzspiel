// Themen für die Auswahl im freien Spiel. Jede Frage-Kategorie gehört zu genau einem Thema.
const THEMES = [
  { key: 'geo', name: 'Geografie', cats: ['Geografie'] },
  { key: 'bau', name: 'Bauwerke', cats: ['Bauwerke'] },
  { key: 'weltall', name: 'Weltall', cats: ['Weltall'] },
  { key: 'wissen', name: 'Wissen & Natur', cats: ['Wissenschaft', 'Mathe', 'Mensch', 'Tiere'] },
  { key: 'geschichte', name: 'Geschichte', cats: ['Geschichte'] },
  { key: 'technik', name: 'Technik & Autos', cats: ['Technik', 'Auto'] },
  { key: 'sport', name: 'Sport', cats: ['Sport'] },
  { key: 'kultur', name: 'Film & Kultur', cats: ['Kultur', 'Spiele'] },
  { key: 'musik', name: 'Musik', cats: ['Musik'] },
  { key: 'cod', name: 'Call of Duty', cats: ['Call of Duty'] },
  { key: 'booktok', name: 'BookTok', cats: ['BookTok'] },
];
const MAX_THEMES = 8;
const catTheme = {};
for (const t of THEMES) for (const c of t.cats) catTheme[c] = t.key;
const themeOf = (q) => (q.theme && THEMES.some((t) => t.key === q.theme) ? q.theme : catTheme[q.cat]) || 'wissen';
const valid = (keys) => {
  const ok = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => THEMES.some((t) => t.key === k)))];
  return ok.length ? ok.slice(0, MAX_THEMES) : THEMES.map((t) => t.key);
};
const byKey = (k) => THEMES.find((t) => t.key === k);
module.exports = { THEMES, MAX_THEMES, themeOf, valid, byKey, list: () => THEMES.map((t) => ({ key: t.key, name: t.name })) };
