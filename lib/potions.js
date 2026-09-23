// Tränke: ×2 / ×4 für Level-XP (xp), Casino-XP (cxp) und Pass-XP (pxp). Laufen ab Aktivierung 60 Minuten echte Zeit.
// Gleicher Trank nochmal = Laufzeit verlängert sich (hintereinander geschaltet). ×2 und ×4 derselben XP-Art lassen sich nicht kombinieren.
const TYPES = { xp: 'Level-XP', cxp: 'Casino-XP', pxp: 'Pass-XP' };
const DUR = 60 * 60 * 1000;
const ITEMS = {}; for (const t of Object.keys(TYPES)) for (const m of [2, 4]) ITEMS[`pot_${t}${m}`] = { id: `pot_${t}${m}`, type: t, mult: m, name: `${TYPES[t]}-Trank ×${m}` };
const active = new Map(); // uid -> { xp: { m, until }, ... }
const parse = (s) => { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
const clean = (o) => { const now = Date.now(), out = {}; for (const [t, v] of Object.entries(o || {})) { const until = v.until || (v.left ? now + v.left : 0); if (until > now) out[t] = { m: v.m, until }; } return out; };
module.exports = {
  TYPES, ITEMS, DUR, clean,
  load(u) { if (!u) return; const o = clean(parse(u.pot_active)); if (Object.keys(o).length) active.set(u.id, o); else active.delete(u.id); },
  get(uid) { return clean(active.get(uid)); },
  set(uid, o) { o = clean(o); if (Object.keys(o).length) active.set(uid, o); else active.delete(uid); },
  mult(uid, type) { const o = active.get(uid); return o && o[type] && o[type].until > Date.now() ? o[type].m : 1; },
  all() { return active; },
};
