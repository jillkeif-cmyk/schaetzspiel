// Web-Push: Schlüssel liegen in der Datenbank, damit sie Neustarts überleben.
const webpush = require('web-push');
let ready = null, pub = '';

async function init(store) {
  let publicKey = process.env.VAPID_PUBLIC || (await store.setting('vapid_pub'));
  let privateKey = process.env.VAPID_PRIVATE || (await store.setting('vapid_priv'));
  if (!publicKey || !privateKey) {
    const k = webpush.generateVAPIDKeys();
    publicKey = k.publicKey; privateKey = k.privateKey;
    await store.setting('vapid_pub', publicKey);
    await store.setting('vapid_priv', privateKey);
  }
  webpush.setVapidDetails(process.env.PUSH_CONTACT || 'mailto:admin@punktlandung.app', publicKey, privateKey);
  pub = publicKey; ready = store;
  return publicKey;
}
const publicKey = () => pub;

let last = { total: 0, ok: 0, gone: 0, failed: 0, errors: [] }; // Ergebnis des letzten Versands, für die Rückmeldung im Admin-Menü
async function send(subs, payload) {
  last = { total: subs.length, ok: 0, gone: 0, failed: 0, errors: [] };
  if (!ready || !subs.length) return 0;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification(s, body, { TTL: 86400, urgency: 'high' }); last.ok++; }
    catch (e) {
      const host = (() => { try { return new URL(s.endpoint).host; } catch (x) { return '?'; } })();
      if (e.statusCode === 404 || e.statusCode === 410) { last.gone++; await ready.pushDrop(s.endpoint).catch(() => {}); }
      else { last.failed++; last.errors.push(`${e.statusCode || e.code || 'Fehler'} bei ${host}: ${String(e.body || e.message || '').slice(0, 80)}`); }
    }
  }));
  console.log(`Push „${payload.title}“: ${last.ok} von ${last.total} zugestellt, ${last.gone} abgelaufen, ${last.failed} fehlgeschlagen${last.errors.length ? ' · ' + last.errors.slice(0, 3).join(' | ') : ''}`);
  return last.ok;
}
const toUser = async (userId, payload) => send(await ready.pushFor(userId), payload);
const toAll = async (payload) => send(await ready.pushAll(), payload);
const lastResult = () => last;

module.exports = { init, publicKey, toUser, toAll, lastResult };
