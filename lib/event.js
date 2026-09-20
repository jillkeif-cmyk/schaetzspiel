// Zeitlich begrenzte Aktionen. GRACE läuft bis heute 24:00 Uhr deutscher Zeit.
const GRACE_END = Date.parse(process.env.GRACE_END || '2026-09-21T00:00:00+02:00');
const graceActive = () => Date.now() < GRACE_END;
const graceEnd = () => GRACE_END;
module.exports = { graceActive, graceEnd };
