// Prüft, dass jede Titel-, Emblem- und Rahmen-Kennung nur einmal vergeben ist und ein Bild hat
const fs = require('fs'); const path = require('path');
const c = require('../lib/cards'); const f = require('../lib/frames');
let bad = 0; const seen = {};
for (const x of [...c.EMBLEMS, ...c.TITLES, ...f.FRAMES]) { if (x.id === 'secret' || x.id === 'tsecret') continue; if (seen[x.id]) { console.log('FEHLER: Kennung doppelt:', x.id, seen[x.id], '/', x.name || x.text); bad++; } seen[x.id] = x.name || x.text; }
for (const e of c.EMBLEMS) if (e.id !== 'secret' && !fs.existsSync(path.join(__dirname, '../public/emblems/pc_' + e.id + '.webp'))) { console.log('FEHLER: Bild fehlt für Emblem', e.id); bad++; }
for (const t of c.TITLES) if (t.id !== 'secret' && !fs.existsSync(path.join(__dirname, '../public/emblems/title_' + t.id + '.webp'))) { console.log('FEHLER: Bild fehlt für Titel', t.id); bad++; }
if (bad) process.exit(1); console.log('OK: alle Kennungen eindeutig');
