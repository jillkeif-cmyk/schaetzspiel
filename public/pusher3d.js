// Münzschieber in 3D mit echter Physik (Prototyp). Three.js zeichnet, cannon-es rechnet.
// Der Server entscheidet, wie viel fällt: eine unsichtbare Leiste an der Kante hält die Münzen,
// nur bei einem Gewinn senkt sie sich und der Schieber stößt kräftiger, bis genau so viele gefallen sind.
import * as THREE from '/vendor/three.module.min.js';
import * as CANNON from '/vendor/cannon-es.min.js';

const R = 0.55, T = 0.15;            // Münze: Radius, Dicke
const W = 6, BACK = -8, EDGE = 0;    // Feld: halbe Breite, hinten, Kante
const MAX = 240;                     // höchstens so viele Münzen gleichzeitig
let st = null;

function coinTexture() { // Münzgesicht: Goldverlauf, Rand, Stern
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  let gr = g.createRadialGradient(100, 90, 20, 128, 128, 128); gr.addColorStop(0, '#FFF3B0'); gr.addColorStop(0.55, '#F2B92A'); gr.addColorStop(1, '#B07A0C');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
  g.strokeStyle = 'rgba(120,70,0,.7)'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(255,245,200,.8)'; g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.stroke();
  g.fillStyle = 'rgba(140,85,0,.75)'; g.font = 'bold 120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function envMap(renderer) { // Neonlicht-Umgebung für die Spiegelungen
  const sc = new THREE.Scene(), box = (col, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); sc.add(m); };
  sc.background = new THREE.Color(0x3a2a55);
  box(0xffffff, 0, 12, 0, 24, 0.2, 14); box(0xfff0d0, 0, 6, 10, 20, 6, 0.2); box(0xff3fb0, -10, 4, -4, 0.2, 8, 12); box(0x3fa0ff, 10, 4, -4, 0.2, 8, 12); box(0xffc860, 0, 3, -12, 16, 6, 0.2); box(0x9b5cff, 0, 2, 12, 16, 3, 0.2);
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(sc, 0.04).texture; pm.dispose(); return tex;
}

export function init(host, opts = {}) {
  destroy();
  const cv = document.createElement('canvas'); cv.id = 'pf3'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; host.prepend(cv);
  const r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr); renderer.setSize(r.width, r.height, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.environment = envMap(renderer); scene.background = new THREE.Color(0x0d0618);
  const cam = new THREE.PerspectiveCamera(46, r.width / r.height, 0.1, 100); cam.position.set(0, 17, 10.5); cam.lookAt(0, -1.2, -4.2); // ganzer Automat im Bild: Schieber, Feld, Kante
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.6); sun.position.set(3, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -10, near: 1, far: 40 }); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x2a1450, 1.1));
  const pink = new THREE.PointLight(0xff4fa3, 9, 16); pink.position.set(-7, 4, -3); scene.add(pink); const blue = new THREE.PointLight(0x3fa0ff, 9, 16); blue.position.set(7, 4, -3); scene.add(blue);

  // Gehäuse: Boden, Seitenwände, Rückwand, Kantenleiste, Schacht
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3ee, metalness: 1, roughness: 0.18 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a0e52, metalness: 0.55, roughness: 0.28 });
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = shadow; scene.add(m); return m; };
  add(new THREE.BoxGeometry(W * 2, 0.4, EDGE - BACK + 4), floorMat, 0, -0.2, (EDGE + BACK - 4) / 2);
  add(new THREE.BoxGeometry(0.5, 3, EDGE - BACK + 6), chrome, -W - 0.25, 1.3, (EDGE + BACK - 4) / 2); add(new THREE.BoxGeometry(0.5, 3, EDGE - BACK + 6), chrome, W + 0.25, 1.3, (EDGE + BACK - 4) / 2);
  add(new THREE.BoxGeometry(W * 2 + 1, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 1, roughness: 0.25, emissive: 0x4a3000 }), 0, 0.02, EDGE + 0.12);
  add(new THREE.BoxGeometry(W * 2, 0.2, 3), new THREE.MeshStandardMaterial({ color: 0x05020a, roughness: 1 }), 0, -3, 1.6, false);
  add(new THREE.BoxGeometry(W * 2 + 1, 8, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a0a33, metalness: 0.4, roughness: 0.5, emissive: 0x2a0d55, emissiveIntensity: 0.6 }), 0, 3, BACK - 7.5);
  const pusherMesh = add(new THREE.BoxGeometry(W * 2, 1.4, 7), new THREE.MeshStandardMaterial({ color: 0xc9ced9, metalness: 1, roughness: 0.22 }), 0, 0.7, -10);
  const stripe = add(new THREE.BoxGeometry(W * 2, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa000, emissiveIntensity: 0.6 }), 0, 0.9, -6.5);

  // Physik
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) }); world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true; world.solver.iterations = 5; world.quatNormalizeFast = true; world.quatNormalizeSkip = 2;
  const mCoin = new CANNON.Material('coin'), mFloor = new CANNON.Material('floor');
  world.addContactMaterial(new CANNON.ContactMaterial(mCoin, mFloor, { friction: 0.35, restitution: 0.05 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mCoin, mCoin, { friction: 0.45, restitution: 0.05 }));
  const stat = (hx, hy, hz, x, y, z, mat = mFloor) => { const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) }); b.position.set(x, y, z); world.addBody(b); return b; };
  stat(W, 0.2, (EDGE - BACK + 4) / 2, 0, -0.2, (EDGE + BACK - 4) / 2); stat(0.25, 3, 12, -W - 0.25, 2, -4); stat(0.25, 3, 12, W + 0.25, 2, -4); stat(W, 3, 0.25, 0, 2, BACK - 7);
  const lip = stat(W, 0.5, 0.08, 0, 0.3, EDGE + 0.1); // unsichtbare Leiste an der Kante
  const pusher = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mFloor, shape: new CANNON.Box(new CANNON.Vec3(W, 0.7, 3.5)) }); pusher.position.set(0, 0.7, -10); world.addBody(pusher);

  // Münzen als Instanzen (ein Zeichenaufruf für alle)
  const faceTex = coinTexture(), side = new THREE.MeshStandardMaterial({ color: 0xe8b53a, metalness: 0.85, roughness: 0.3 }), face = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.75, roughness: 0.3 });
  const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(R, R, T, 28), [side, face, face], MAX); inst.castShadow = true; inst.receiveShadow = true; inst.count = 0; scene.add(inst);
  const shape = new CANNON.Box(new CANNON.Vec3(R * 0.84, T / 2, R * 0.84)); // Physik rechnet eine flache Scheibe mit 8 Ecken (viel schneller), gezeichnet wird rund
  const coins = [];
  const addCoin = (x, y, z, vy = 0) => { if (coins.length >= MAX) return null; const b = new CANNON.Body({ mass: 1, material: mCoin, shape, sleepSpeedLimit: 0.35, sleepTimeLimit: 0.25, linearDamping: 0.18, angularDamping: 0.6 }); b.position.set(x, y, z); b.quaternion.setFromEuler((Math.random() - 0.5) * 0.2, Math.random() * 6, (Math.random() - 0.5) * 0.2); b.velocity.set(0, vy, 0); world.addBody(b); coins.push(b); return b; };

  st = { host, cv, renderer, scene, cam, world, pusher, pusherMesh, stripe, lip, lipIn: true, inst, coins, addCoin, t: 0, boost: 0, boostT: 0, budget: 0, fallen: 0, raf: 0, last: performance.now(), m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), onFall: opts.onFall, fps: 0, frames: 0, fpsT: performance.now() };
  fill(opts.count || 120);
  loop();
  return st;
}

function fill(n) { // Startzustand: Münzen locker verteilt fallen lassen und kurz setzen lassen (unsichtbar vorberechnet)
  const s = st; for (let i = 0; i < n; i++) s.addCoin((Math.random() - 0.5) * (W * 2 - 1.4), 0.4 + Math.floor(i / 60) * 0.3 + Math.random() * 0.6, BACK + 2.4 + Math.random() * (EDGE - BACK - 2.8));
  for (let i = 0; i < 180; i++) { stepPusher(1 / 60); s.world.step(1 / 60); }
}
function stepPusher(dt) {
  const s = st; s.t += dt; s.boost += (s.boostT - s.boost) * Math.min(1, dt * 3);
  const z = -10.4 + (1.6 + s.boost) * (0.5 - 0.5 * Math.cos(s.t * 2.2)); // hin und her; bei Gewinn weiter nach vorn
  const vz = (z - s.pusher.position.z) / dt; s.pusher.velocity.set(0, 0, vz); s.pusher.position.z = z;
}
function loop() {
  const s = st; if (!s) return;
  if (!s.cv.isConnected) { destroy(); return; }
  const now = performance.now(), dt = Math.min(0.05, (now - s.last) / 1000); s.last = now;
  const tp = performance.now(); stepPusher(dt); s.world.step(1 / 60, dt, 1); /* kein Nachholen bei Überlast */ s.physMs = (s.physMs || 0) * 0.9 + (performance.now() - tp) * 0.1;
  // Münzen, die über die Kante gefallen sind
  for (let i = s.coins.length - 1; i >= 0; i--) { const b = s.coins[i]; if (b.position.y < -2.5 || b.position.z > EDGE + 3.5) { s.world.removeBody(b); s.coins.splice(i, 1); s.fallen++; if (s.budget > 0) s.budget--; if (s.onFall) s.onFall(); } }
  if (s.budget <= 0 && !s.lipIn) { s.world.addBody(s.lip); s.lipIn = true; s.boostT = 0; } // genug gefallen: Leiste wieder hoch
  // zeichnen
  s.inst.count = s.coins.length;
  s.coins.forEach((b, i) => { s.v.set(b.position.x, b.position.y, b.position.z); s.q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); s.m4.compose(s.v, s.q, s.s); s.inst.setMatrixAt(i, s.m4); });
  s.inst.instanceMatrix.needsUpdate = true;
  s.pusherMesh.position.z = s.pusher.position.z; s.stripe.position.z = s.pusher.position.z + 3.51;
  const tr = performance.now(); s.renderer.render(s.scene, s.cam); s.drawMs = (s.drawMs || 0) * 0.9 + (performance.now() - tr) * 0.1;
  s.frames++; if (now - s.fpsT > 1000) { s.fps = s.frames; s.frames = 0; s.fpsT = now; }
  s.raf = requestAnimationFrame(loop);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Einwurf: neue Münzen fallen hinten aufs Feld; bei Gewinn senkt sich die Leiste, bis "fall" Münzen unten sind
export async function anim(ins, fall, avalanche, fast, snd) {
  const s = st; if (!s) return;
  for (let i = 0; i < ins; i++) { s.addCoin((Math.random() - 0.5) * (W * 2 - 2), 5 + Math.random(), -3.9 + Math.random() * 1.2, -2); /* landet direkt vor dem Schieber */ snd && snd('coin'); await sleep(fast ? 70 : 150); }
  await sleep(fast ? 700 : 1100);
  if (fall > 0) {
    s.budget = fall + (avalanche ? 6 : 0); if (s.lipIn) { s.world.removeBody(s.lip); s.lipIn = false; } s.boostT = 1.2 + Math.min(2.2, fall * 0.12); s.coins.forEach((b) => b.wakeUp()); snd && snd('slide');
    const t0 = Date.now(); let heard = s.fallen;
    while (s.budget > 0 && Date.now() - t0 < 6000) { await sleep(100); if (Date.now() - t0 > 3000) s.boostT = 3.6; if (s.fallen > heard) { snd && snd('coins', s.fallen - heard); heard = s.fallen; } }
    if (s.budget > 0) { const front = s.coins.slice().sort((a, b) => b.position.z - a.position.z).slice(0, s.budget); front.forEach((b) => { b.wakeUp(); b.velocity.set((Math.random() - 0.5) * 2, 1, 6); }); await sleep(900); } // Notfall: die vordersten anschubsen
    s.budget = 0; s.boostT = 0; if (!s.lipIn) { s.world.addBody(s.lip); s.lipIn = true; }
  }
  await sleep(fast ? 200 : 500);
}
export const count = () => (st ? st.coins.length : 0);
export const fps = () => (st ? st.fps : 0);
export const stats = () => (st ? { physik: Math.round(st.physMs * 10) / 10, zeichnen: Math.round(st.drawMs * 10) / 10, muenzen: st.coins.length, schlafen: st.coins.filter((b) => b.sleepState === 2).length } : null);
export function setCount(n) { // still an den Pool angleichen (beim Öffnen)
  const s = st; if (!s) return; n = Math.min(MAX, n);
  while (s.coins.length > n) { const b = s.coins.pop(); s.world.removeBody(b); }
  if (s.coins.length < n) { const k = n - s.coins.length; for (let i = 0; i < k; i++) s.addCoin((Math.random() - 0.5) * (W * 2 - 1.4), 1 + Math.random() * 2, BACK + 2.4 + Math.random() * (EDGE - BACK - 2.8)); for (let i = 0; i < 120; i++) { stepPusher(1 / 60); s.world.step(1 / 60); } }
}
export function destroy() { if (!st) return; cancelAnimationFrame(st.raf); try { st.renderer.dispose(); } catch (e) {} if (st.cv && st.cv.parentNode) st.cv.remove(); st = null; }
export const active = () => !!st;
