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

async function send(subs, payload) {
  if (!ready || !subs.length) return 0;
  const body = JSON.stringify(payload);
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification(s, body); ok++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await ready.pushDrop(s.endpoint).catch(() => {}); }
  }));
  return ok;
}
const toUser = async (userId, payload) => send(await ready.pushFor(userId), payload);
const toAll = async (payload) => send(await ready.pushAll(), payload);

module.exports = { init, publicKey, toUser, toAll };
