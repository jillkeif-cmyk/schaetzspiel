// Tränke: ×2 / ×4 für Level-XP (xp), Casino-XP (cxp) und Pass-XP (pxp). Laufen 60 Minuten App-Zeit (nur solange die App offen ist).
const TYPES = { xp: 'Level-XP', cxp: 'Casino-XP', pxp: 'Pass-XP' };
const DUR = 60 * 60 * 1000;
const ITEMS = {}; for (const t of Object.keys(TYPES)) for (const m of [2, 4]) ITEMS[`pot_${t}${m}`] = { id: `pot_${t}${m}`, type: t, mult: m, name: `${TYPES[t]}-Trank ×${m}` };
const active = new Map(); // uid -> { xp: { m, left }, ... }
const parse = (s) => { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
module.exports = {
  TYPES, ITEMS, DUR,
  load(u) { if (!u) return; const o = parse(u.pot_active); if (Object.keys(o).length) active.set(u.id, o); else active.delete(u.id); },
  get(uid) { return active.get(uid) || {}; },
  set(uid, o) { if (Object.keys(o).length) active.set(uid, o); else active.delete(uid); },
  mult(uid, type) { const o = active.get(uid); return o && o[type] && o[type].left > 0 ? o[type].m : 1; },
  all() { return active; },
};
