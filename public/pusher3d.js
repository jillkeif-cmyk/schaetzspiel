// Münzschieber 3D v2: echte Mechanik (Münzen landen auf dem Schieber, die Abstreifwand schiebt sie beim Einfahren herunter),
// Premium-Optik (Chrom, Neon, Bloom, Klarlack). Der Server entscheidet, wie viel fällt: eine unsichtbare Leiste an der Kante
// hält die Münzen, nur bei einem Gewinn senkt sie sich und der Schieber stößt kräftiger, bis genau so viele unten sind.
import * as THREE from 'three';
import { EffectComposer } from '/vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '/vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/vendor/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from '/vendor/addons/environments/RoomEnvironment.js';
import * as CANNON from '/vendor/cannon-es.min.js';

const R = 0.55, T = 0.15, PH = 0.8 * R;     // Münze: Radius, Dicke, halbe Breite der Physik-Scheibe
const W = 6, EDGE = 0, FIELD_BACK = -9;      // Feld: halbe Breite, Kante, hinteres Ende
const SH_Y = 1.25, SH_HD = 4.2;              // Schieber: Höhe der Oberseite, halbe Tiefe
const WIPE_Z = -7.1;                         // Vorderseite der Abstreifwand über dem Schieber
const MAX = 260;
let st = null;

function coinFace() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(96, 84, 10, 128, 128, 130); gr.addColorStop(0, '#FFF7C9'); gr.addColorStop(0.45, '#F6C33A'); gr.addColorStop(1, '#A56E08');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
  for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; g.strokeStyle = k % 2 ? 'rgba(120,70,0,.55)' : 'rgba(255,240,180,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.lineTo(128 + Math.cos(a) * 127, 128 + Math.sin(a) * 127); g.stroke(); }
  g.strokeStyle = 'rgba(110,62,0,.75)'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke();
  g.fillStyle = 'rgba(120,70,0,.8)'; g.font = 'bold 118px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', 128, 134);
  g.fillStyle = 'rgba(255,250,215,.55)'; g.fillText('★', 124, 130);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function signTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, '#2a0a45'); bg.addColorStop(1, '#0c0318'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 30; i++) { g.fillStyle = i % 2 ? '#FFE27A' : '#FF4FA3'; g.beginPath(); g.arc(20 + i * 34.5, 20, 7, 0, 7); g.fill(); g.beginPath(); g.arc(20 + i * 34.5, 236, 7, 0, 7); g.fill(); }
  g.font = '900 118px Impact,Anton,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#FFB800'; g.shadowBlur = 30; g.fillStyle = '#FFE27A'; g.fillText('PUNKTLANDUNG', 512, 132); g.shadowBlur = 0; g.fillStyle = '#FFF8D8'; g.fillText('PUNKTLANDUNG', 512, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function init(host, opts = {}) {
  destroy();
  const cv = document.createElement('canvas'); cv.id = 'pf3'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; host.prepend(cv);
  const r = host.getBoundingClientRect(), dpr = Math.min(1.75, window.devicePixelRatio || 1);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr); renderer.setSize(r.width, r.height, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07030f);
  // Umgebung für echte Chrom-Spiegelungen: helles Studio + Neon-Leisten
  const envScene = new RoomEnvironment(); const neon = (col, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); envScene.add(m); };
  neon(0xff3fb0, -4.5, 2, 0, 0.3, 4, 8); neon(0x3fb8ff, 4.5, 2, 0, 0.3, 4, 8); neon(0xffc24a, 0, 4.6, -4, 8, 0.4, 0.3);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.03).texture; pm.dispose();
  const cam = new THREE.PerspectiveCamera(44, r.width / r.height, 0.1, 120); const camBase = new THREE.Vector3(0, 16.5, 10.2), camLook = new THREE.Vector3(0, 0.2, -4.3); cam.position.copy(camBase); cam.lookAt(camLook);

  const key = new THREE.DirectionalLight(0xfff1dc, 1.9); key.position.set(4, 16, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -12, near: 1, far: 45 }); scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffe8cc, 0x1c0838, 0.9));
  const fillL = new THREE.DirectionalLight(0xfff6e6, 1.1); fillL.position.set(0, 9, 15); scene.add(fillL); // weiches Fülllicht von vorn: Münzen leuchten golden statt braun
  const pL = new THREE.PointLight(0xff3fb0, 7, 12); pL.position.set(-6.5, 3, -3); scene.add(pL); const bL = new THREE.PointLight(0x3fb8ff, 7, 12); bL.position.set(6.5, 3, -3); scene.add(bL);

  // Materialien
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe6e9f2, metalness: 1, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.55 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x23083f, metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.5 });
  const neonMat = (col) => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.4 });
  const mk = (geo, mat, x, y, z, cast = false, recv = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m; };

  // Gehäuse
  mk(new THREE.BoxGeometry(W * 2, 0.4, EDGE - FIELD_BACK + 2), lacquer, 0, -0.2, (EDGE + FIELD_BACK - 2) / 2);                       // Lackboden
  for (const sx of [-1, 1]) {
    mk(new THREE.BoxGeometry(0.7, 4.2, 15), chrome, sx * (W + 0.35), 1.9, -5.5, true);                                                 // Chromwände
    mk(new THREE.BoxGeometry(0.12, 0.12, 14), neonMat(sx < 0 ? 0xff3fb0 : 0x3fb8ff), sx * (W - 0.02), 3.6, -5.5, false, false);          // Neonleiste oben
    mk(new THREE.BoxGeometry(0.1, 0.1, 13), neonMat(sx < 0 ? 0xff3fb0 : 0x3fb8ff), sx * (W - 0.02), 0.12, -5, false, false);            // Neonleiste unten
    mk(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 20), gold, sx * (W + 0.35), 1.9, EDGE + 0.2, true);                                  // Goldsäulen vorn
  }
  mk(new THREE.BoxGeometry(W * 2 + 1.4, 0.3, 0.5), gold, 0, 0.05, EDGE + 0.2, true);                                                    // goldene Kante
  mk(new THREE.BoxGeometry(W * 2, 0.2, 3.2), new THREE.MeshStandardMaterial({ color: 0x030106, roughness: 1 }), 0, -3.2, 1.8);          // Schacht
  const wiper = mk(new THREE.BoxGeometry(W * 2, 3.2, 1.2), chrome, 0, SH_Y + 0.08 + 1.6, WIPE_Z - 0.6, true);                          // Abstreifwand
  mk(new THREE.BoxGeometry(W * 2, 0.14, 0.14), gold, 0, SH_Y + 0.12, WIPE_Z + 0.02);                                                     // goldene Unterkante
  const sign = mk(new THREE.PlaneGeometry(W * 2 - 0.4, (W * 2 - 0.4) / 4), new THREE.MeshStandardMaterial({ map: signTex(), emissive: 0xffffff, emissiveMap: signTex(), emissiveIntensity: 1.1 }), 0, SH_Y + 1.9, WIPE_Z + 0.03);
  void sign; void wiper;
  const pusherMesh = mk(new THREE.BoxGeometry(W * 2 - 0.02, SH_Y, SH_HD * 2), chrome, 0, SH_Y / 2, -9, true);
  const pStripe = mk(new THREE.BoxGeometry(W * 2 - 0.02, 0.1, 0.06), neonMat(0xffc24a), 0, SH_Y - 0.12, -9 + SH_HD + 0.03);

  // Physik
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) }); world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true;
  world.solver.iterations = 6; // genaue Drehberechnung (die schnelle Variante erzeugte ungültige Werte und brachte cannon-es zum Absturz)
  const mCoin = new CANNON.Material('coin'), mHard = new CANNON.Material('hard');
  world.addContactMaterial(new CANNON.ContactMaterial(mCoin, mHard, { friction: 0.3, restitution: 0.04 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mCoin, mCoin, { friction: 0.45, restitution: 0.04 }));
  const stat = (hx, hy, hz, x, y, z) => { const b = new CANNON.Body({ mass: 0, material: mHard, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) }); b.position.set(x, y, z); world.addBody(b); return b; };
  stat(W, 0.2, (EDGE - FIELD_BACK + 2) / 2, 0, -0.2, (EDGE + FIELD_BACK - 2) / 2);
  const inner = W - (R - PH);                                      // Wände rücken nach innen: gezeichnete Münze berührt die Wand, ragt nicht hinein
  stat(1, 4, 9, -inner - 1, 3, -5); stat(1, 4, 9, inner + 1, 3, -5); // dicke Wände, nichts rutscht durch
  stat(W, 2, 0.6, 0, SH_Y + 0.08 + 2, WIPE_Z - 0.6);                 // Abstreifwand: Spalt zum Schieber kleiner als eine Münze
  const lip = stat(W, 0.5, 0.08, 0, 0.3, EDGE + 0.1);               // unsichtbare Leiste an der Kante
  const pusher = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mHard, shape: new CANNON.Box(new CANNON.Vec3(inner, SH_Y / 2, SH_HD)) });
  pusher.position.set(0, SH_Y / 2, -9); world.addBody(pusher);

  // Münzen (ein Zeichenaufruf für alle)
  const face = coinFace(), side = new THREE.MeshPhysicalMaterial({ color: 0xe9b43a, metalness: 1, roughness: 0.25, clearcoat: 0.6, envMapIntensity: 0.55 }), top = new THREE.MeshPhysicalMaterial({ map: face, metalness: 0.85, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55 });
  const geo = new THREE.CylinderGeometry(R, R, T, 32); const inst = new THREE.InstancedMesh(geo, [side, top, top], MAX); inst.castShadow = true; inst.receiveShadow = true; inst.count = 0; scene.add(inst);
  const shape = new CANNON.Box(new CANNON.Vec3(PH, T / 2, PH)), coins = [];
  const addCoin = (x, y, z, vy = 0) => { if (coins.length >= MAX) return null; const b = new CANNON.Body({ mass: 1, material: mCoin, shape, sleepSpeedLimit: 0.3, sleepTimeLimit: 0.3, linearDamping: 0.15, angularDamping: 0.55 }); b.position.set(Math.max(-inner + PH, Math.min(inner - PH, x)), y, z); b.quaternion.setFromEuler((Math.random() - 0.5) * 0.3, Math.random() * 6, (Math.random() - 0.5) * 0.3); b.velocity.set(0, vy, 0); world.addBody(b); coins.push(b); return b; };

  // Funken beim Fallen über die Kante
  const sparkGeo = new THREE.BufferGeometry(), SPN = 160, sp = new Float32Array(SPN * 3), sv = [];
  for (let i = 0; i < SPN; i++) { sp[i * 3 + 1] = -99; sv.push({ x: 0, y: 0, z: 0, life: 0 }); }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffe28a, size: 0.16, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(sparks);

  // Nachbearbeitung: Leuchten für Neon, Gold und Funken
  const composer = new EffectComposer(renderer); composer.setPixelRatio(dpr); composer.setSize(r.width, r.height);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(r.width / 2, r.height / 2), 0.32, 0.28, 1.35); // nur Neon, Funken und echte Glanzpunkte leuchten composer.addPass(bloom); composer.addPass(new OutputPass());

  st = { host, cv, renderer, composer, scene, cam, camBase, camLook, world, pusher, pusherMesh, pStripe, lip, lipIn: true, inst, coins, addCoin, sp, sv, sparkGeo, shake: 0,
    t: 0, boost: 0, boostT: 0, budget: 0, fallen: 0, raf: 0, last: performance.now(), m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s1: new THREE.Vector3(1, 1, 1), fps: 0, frames: 0, fpsT: performance.now(), inner };
  fill(opts.count || 120);
  loop();
  return st;
}

function fill(n) { // Startzustand: Feld und Schieber mit Münzen, kurz unsichtbar vorberechnet
  const s = st, onShelf = Math.round(n * 0.22);
  for (let i = 0; i < n; i++) {
    if (i < onShelf) s.addCoin((Math.random() - 0.5) * 2 * (s.inner - 0.6), SH_Y + 0.3 + Math.random() * 0.8, WIPE_Z + 0.5 + Math.random() * 1.6);
    else s.addCoin((Math.random() - 0.5) * 2 * (s.inner - 0.6), 0.3 + Math.random() * 1.4, -4.4 + Math.random() * 4.1);
  }
  for (let i = 0; i < 200; i++) { stepPusher(1 / 60); safeStep(1 / 60, 1); }
}
function safeStep(dt, max) { // Physik-Schritt mit Absicherung: nie einfrieren
  const s = st;
  try { s.world.step(1 / 60, dt, max); clampWalls(); }
  catch (e) {
    s.errors = (s.errors || 0) + 1;
    for (let i = s.coins.length - 1; i >= 0; i--) { const b = s.coins[i], p = b.position, q = b.quaternion; if (![p.x, p.y, p.z, q.x, q.y, q.z, q.w].every(Number.isFinite) || p.y > 30) { s.world.removeBody(b); s.coins.splice(i, 1); } else { q.normalize(); } }
  }
}
function clampWalls() { // harte Grenze: keine Münze in oder durch Wand und Boden, egal wie groß der Druck ist
  const s = st, lim = W - R, bottom = T / 2 - 0.02;
  for (const b of s.coins) {
    const p = b.position;
    if (p.x > lim) { p.x = lim; if (b.velocity.x > 0) b.velocity.x = 0; } else if (p.x < -lim) { p.x = -lim; if (b.velocity.x < 0) b.velocity.x = 0; }
    if (p.z < EDGE && p.y < bottom) { p.y = bottom; if (b.velocity.y < 0) b.velocity.y = 0; }
  }
}
function stepPusher(dt) { // fährt weit ein (unter die Abstreifwand) und wieder aus; bei Gewinn weiter nach vorn
  const s = st; s.t += dt; s.boost += (s.boostT - s.boost) * Math.min(1, dt * 3);
  const front = WIPE_Z + 0.25 + (2.5 + s.boost) * (0.5 - 0.5 * Math.cos(s.t * 1.9)), z = front - SH_HD;
  s.pusher.velocity.set(0, 0, (z - s.pusher.position.z) / dt); s.pusher.position.z = z;
}
function spark(x, z, n) { const s = st; let k = 0; for (const p of s.sv) { if (p.life > 0) continue; p.x = x + (Math.random() - 0.5) * 0.6; p.y = 0.2; p.z = z; p.vx = (Math.random() - 0.5) * 3; p.vy = 2 + Math.random() * 4; p.vz = 1 + Math.random() * 2; p.life = 0.5 + Math.random() * 0.4; if (++k >= n) break; } }
function loop() {
  const s = st; if (!s) return;
  if (!s.cv.isConnected) { destroy(); return; }
  const now = performance.now(), dt = Math.min(0.05, (now - s.last) / 1000); s.last = now;
  const tp = performance.now(); stepPusher(dt); safeStep(dt, 1); s.physMs = (s.physMs || 0) * 0.9 + (performance.now() - tp) * 0.1;
  for (let i = s.coins.length - 1; i >= 0; i--) { const b = s.coins[i]; if (b.position.y < -2.5 || b.position.z > EDGE + 3.5) { spark(b.position.x, EDGE + 0.3, 6); s.world.removeBody(b); s.coins.splice(i, 1); s.fallen++; if (s.budget > 0) s.budget--; } }
  if (s.budget <= 0 && !s.lipIn) { s.world.addBody(s.lip); s.lipIn = true; s.boostT = 0; }
  // Münzen, Schieber, Funken
  s.inst.count = s.coins.length;
  for (let i = 0; i < s.coins.length; i++) { const b = s.coins[i]; s.v.set(b.position.x, b.position.y, b.position.z); s.q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); s.m4.compose(s.v, s.q, s.s1); s.inst.setMatrixAt(i, s.m4); }
  s.inst.instanceMatrix.needsUpdate = true;
  s.pusherMesh.position.z = s.pusher.position.z; s.pStripe.position.z = s.pusher.position.z + SH_HD + 0.03;
  for (let i = 0; i < s.sv.length; i++) { const p = s.sv[i]; if (p.life > 0) { p.life -= dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; s.sp[i * 3] = p.x; s.sp[i * 3 + 1] = p.life > 0 ? p.y : -99; s.sp[i * 3 + 2] = p.z; } }
  s.sparkGeo.attributes.position.needsUpdate = true;
  // leichte Kamerabewegung, Wackeln bei Lawinen
  s.shake = Math.max(0, s.shake - dt * 1.6); const sw = Math.sin(now / 2600) * 0.25, sk = s.shake * s.shake;
  s.cam.position.set(s.camBase.x + sw + (Math.random() - 0.5) * sk * 0.6, s.camBase.y + (Math.random() - 0.5) * sk * 0.6, s.camBase.z); s.cam.lookAt(s.camLook);
  const tr = performance.now(); s.composer.render(); s.drawMs = (s.drawMs || 0) * 0.9 + (performance.now() - tr) * 0.1;
  s.frames++; if (now - s.fpsT > 1000) { s.fps = s.frames; s.frames = 0; s.fpsT = now; }
  s.raf = requestAnimationFrame(loop);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Einwurf: Münzen fallen auf den Schieber; beim Einfahren streift die Wand sie aufs Feld. Bei Gewinn senkt sich die Leiste an der Kante.
export async function anim(ins, fall, avalanche, fast, snd) {
  const s = st; if (!s) return;
  for (let i = 0; i < ins; i++) { s.addCoin((Math.random() - 0.5) * 2 * (s.inner - 0.8), 5.5 + Math.random(), WIPE_Z + 0.6 + Math.random() * 1.4, -3); snd && snd('coin'); await sleep(fast ? 70 : 140); }
  await sleep(fast ? 900 : 1500);
  if (fall > 0) {
    if (avalanche) s.shake = 1.2;
    s.budget = fall; if (s.lipIn) { s.world.removeBody(s.lip); s.lipIn = false; } s.boostT = 0.9 + Math.min(2.4, fall * 0.12); s.coins.forEach((b) => b.wakeUp()); snd && snd('slide');
    const t0 = Date.now(); let heard = s.fallen;
    while (s.budget > 0 && Date.now() - t0 < 6500) { await sleep(100); if (Date.now() - t0 > 3200) s.boostT = 3.4; if (s.fallen > heard) { snd && snd('coins', s.fallen - heard); heard = s.fallen; } }
    if (s.budget > 0) { const front = s.coins.filter((b) => b.position.y < 1).sort((a, b) => b.position.z - a.position.z).slice(0, s.budget); front.forEach((b) => { b.wakeUp(); b.velocity.set((Math.random() - 0.5) * 2, 1, 7); }); await sleep(900); }
    s.budget = 0; s.boostT = 0; if (!s.lipIn) { s.world.addBody(s.lip); s.lipIn = true; }
  }
  await sleep(fast ? 200 : 500);
}
export const count = () => (st ? st.coins.length : 0);
export const errors = () => (st ? st.errors || 0 : -1);
export const fps = () => (st ? st.fps : 0);
export const stats = () => (st ? { physik: Math.round((st.physMs || 0) * 10) / 10, zeichnen: Math.round((st.drawMs || 0) * 10) / 10, muenzen: st.coins.length, aufSchieber: st.coins.filter((b) => b.position.y > SH_Y - 0.1).length, inWand: st.coins.filter((b) => Math.abs(b.position.x) + R > W + 0.02).length } : null);
export function setCount(n) {
  const s = st; if (!s) return; n = Math.min(MAX, n);
  while (s.coins.length > n) { const b = s.coins.pop(); s.world.removeBody(b); }
  if (s.coins.length < n) { const k = n - s.coins.length; for (let i = 0; i < k; i++) s.addCoin((Math.random() - 0.5) * 2 * (s.inner - 0.6), 0.5 + Math.random() * 1.5, -4.4 + Math.random() * 4.1); for (let i = 0; i < 140; i++) { stepPusher(1 / 60); safeStep(1 / 60, 1); } }
}
export function destroy() { if (!st) return; cancelAnimationFrame(st.raf); try { st.composer.dispose && st.composer.dispose(); st.renderer.dispose(); } catch (e) {} if (st.cv && st.cv.parentNode) st.cv.remove(); st = null; }
export const active = () => !!st;
export function simulate(sec) { // nur für Tests: Physik im Zeitraffer laufen lassen
  const s = st; if (!s) return null; const shelf0 = s.coins.filter((b) => b.position.y > SH_Y - 0.1).length, f0 = s.fallen;
  for (let i = 0; i < sec * 60; i++) { stepPusher(1 / 60); safeStep(1 / 60, 1); }
  return { vorher: shelf0, nachher: s.coins.filter((b) => b.position.y > SH_Y - 0.1).length, feld: s.coins.filter((b) => b.position.y < SH_Y - 0.1).length, ueberKante: s.fallen - f0, inWand: s.coins.filter((b) => Math.abs(b.position.x) + R > W + 0.02).length, tiefsteMm: Math.round(Math.max(0, ...s.coins.map((b) => Math.abs(b.position.x) + R - W)) * 1000) / 1000 };
}
