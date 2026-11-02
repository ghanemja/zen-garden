import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildModel, buildTool, woodTexture } from './models.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

const ITEMS = window.ITEMS, Sound = window.Sound;
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const KEY = 'zen-garden-v1';
const SIZE = 10;          // sand is 10 x 10 world units
const RIM = 0.75, RIM_H = 0.34, DEPTH = 0.75;

const TOOLS = {
  rake:   { kind: 'rake', n: 5, sp: 15, w: 7 },
  wide:   { kind: 'rake', n: 9, sp: 13, w: 6 },
  stick:  { kind: 'rake', n: 1, sp: 0, w: 10 },
  ripple: { kind: 'ripple', n: 5, sp: 17, w: 7 },
  smooth: { kind: 'smooth', r: 48 },
  pour:   { kind: 'pour', r: 75 },
};
const SAND_COLORS = [
  ['Desert sand', '#d6b98a'], ['Beach sand', '#e4cfa3'], ['White', '#efe9dc'],
  ['Pearl', '#cfc9bc'], ['Rose', '#e6c6b4'], ['Charcoal', '#5a5753'],
];
const FRAMES = {
  birch:  ['Birch', '#e8cc98'],
  walnut: ['Walnut', '#7a5434'],
  ebony:  ['Ebony', '#2e2926'],
  bamboo: ['Bamboo', '#cdb86a'],
  stone:  ['Stone', '#d9d5ce'],
};

const state = { tool: 'rake', objects: [], selected: null, roam: true, sandColor: SAND_COLORS[0][1], frame: 'birch', view: '3d' };
let uid = 1;

/* =============== renderer, scene, camera =============== */
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const view = renderer.domElement;
view.id = 'view';
stage.prepend(view);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
camera.position.set(0, 14, 13);
const controls = new OrbitControls(camera, view);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.minPolarAngle = 0.02;
controls.maxPolarAngle = 1.2;
controls.minDistance = 6;
controls.maxDistance = 50;

scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb9a27c, 0.35));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-9, 8, -6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
scene.add(sun);

/* tray */
const woodTex = woodTexture();
const woodTexZ = woodTex.clone();
woodTexZ.center.set(0.5, 0.5); woodTexZ.rotation = Math.PI / 2; woodTexZ.needsUpdate = true;
const woodX = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5 });
const woodZ = new THREE.MeshStandardMaterial({ map: woodTexZ, roughness: 0.5 });
const frameH = RIM_H + DEPTH, frameY = (RIM_H - DEPTH) / 2;
const addPiece = (w, d, x, z, mat) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, frameH, d, 4, 0.08), mat);
  m.position.set(x, frameY, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
};
addPiece(SIZE + RIM * 2, RIM, 0, -(SIZE + RIM) / 2, woodX);
addPiece(SIZE + RIM * 2, RIM, 0, (SIZE + RIM) / 2, woodX);
addPiece(RIM, SIZE + 0.02, -(SIZE + RIM) / 2, 0, woodZ);
addPiece(RIM, SIZE + 0.02, (SIZE + RIM) / 2, 0, woodZ);
const floor = new THREE.Mesh(new THREE.BoxGeometry(SIZE + 0.1, 0.1, SIZE + 0.1), woodX);
floor.position.y = -DEPTH + 0.05;
scene.add(floor);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -DEPTH - 0.001;
ground.receiveShadow = true;
scene.add(ground);

/* sand */
const sand = new Sand();
const colorTex = new THREE.CanvasTexture(sand.canvas);
colorTex.colorSpace = THREE.SRGBColorSpace;
colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const heightTex = new THREE.CanvasTexture(sand.hc);
const sandGeo = new THREE.PlaneGeometry(SIZE, SIZE, 360, 360);
sandGeo.rotateX(-Math.PI / 2);
const DISP = 0.6; // height map 0..255 spans this many world units (128 = flat sand)
const roughTex = new THREE.CanvasTexture(sand.rc);
const sandMat = new THREE.MeshStandardMaterial({
  map: colorTex, bumpMap: heightTex, bumpScale: 18, roughnessMap: roughTex,
  displacementMap: heightTex, displacementScale: DISP, displacementBias: -DISP * 128 / 255, roughness: 1,
});
const floorAt = (x, z) => {
  // world height of the sand surface at a world x/z
  const u = (x / SIZE + 0.5) * 1000, v = (z / SIZE + 0.5) * 1000;
  if (u < 0 || u > 1000 || v < 0 || v > 1000) return 0;
  return (sand.heightAt(u, v) - 128) / 255 * DISP;
};
const sandMesh = new THREE.Mesh(sandGeo, sandMat);
sandMesh.receiveShadow = true;
scene.add(sandMesh);

/* selection ring */
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
const selRing = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.62, 64), ringMat);
selRing.rotation.x = -Math.PI / 2;
selRing.visible = false;
scene.add(selRing);

/* hand tools */
const toolMeshes = {
  rake: buildTool('rake', 5, 0.15),
  wide: buildTool('rake', 9, 0.13),
  stick: buildTool('stick'),
  ripple: buildTool('stick'),
  smooth: buildTool('smooth'),
  pour: buildTool('pour'),
};
Object.values(toolMeshes).forEach(t => { t.visible = false; scene.add(t); });
const tool = { pos: new THREE.Vector3(), target: new THREE.Vector3(), angle: 0, targetAngle: 0, y: 0.4, show: false, active: false, snap: true };

/* =============== layout & camera fit =============== */
const VIEWS = { '3d': 0.82, top: 0.02 };
function fitDistance() {
  const aspect = view.clientWidth / Math.max(1, view.clientHeight);
  const half = SIZE / 2 + RIM + 0.4;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const polar = controls.getPolarAngle();
  const dv = (half * (0.55 + 0.45 * Math.cos(polar))) / t + half * Math.sin(polar) * 0.6;
  const dh = half / (t * aspect) + half * Math.sin(polar) * 0.3;
  return Math.max(dv * 0.9, dh * 1.1);
}
function setDistance(d) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, d);
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  setDistance(fitDistance());
}
new ResizeObserver(resize).observe(stage);

let viewAnim = null;
function setView(name) {
  state.view = name;
  $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
  const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  viewAnim = { t: 0, from: { phi: sph.phi, theta: sph.theta, r: sph.radius }, to: { phi: VIEWS[name], theta: 0 } };
}
function stepView(dt) {
  if (!viewAnim) return;
  viewAnim.t = Math.min(1, viewAnim.t + dt / 0.7);
  const e = 1 - Math.pow(1 - viewAnim.t, 3), f = viewAnim.from, to = viewAnim.to;
  const phi = f.phi + (to.phi - f.phi) * e, theta = lerpAngle(f.theta, to.theta, e);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(f.r, phi, theta)));
  if (viewAnim.t >= 1) { viewAnim = null; setDistance(fitDistance()); }
}

/* =============== palette =============== */
const uniq = (svg, sfx) => svg.replace(/(id="|url\(#)([\w-]+)/g, (m, p, n) => p + n + '_' + sfx);
const CATS = [['rocks', 'Stones'], ['plants', 'Plants'], ['decor', 'Decor'], ['animals', 'Animals']];
const pal = $('#palette');
for (const [cat, label] of CATS) {
  const sec = document.createElement('section');
  sec.className = 'pal-sec';
  sec.innerHTML = `<h3>${label}</h3><div class="pal-grid"></div>`;
  const grid = $('.pal-grid', sec);
  ITEMS.filter(i => i.cat === cat).forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pal-item';
    b.title = `Drag ${item.name.toLowerCase()} into your garden (or tap to add)`;
    b.innerHTML = `<span class="pal-art">${uniq(item.svg, 'p' + item.id)}</span><span class="pal-name">${item.name}</span>`;
    b.addEventListener('pointerdown', e => startPaletteDrag(e, item));
    b.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addObject(item.id, ...freeSpot(), { select: true }); }
    });
    grid.appendChild(b);
  });
  pal.appendChild(sec);
}

/* =============== picking =============== */
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function setRay(ev) {
  const r = view.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function groundAt(ev) {
  setRay(ev);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, p)) return null;
  return { x: p.x / SIZE + 0.5, y: p.z / SIZE + 0.5, p };
}
function objectAt(ev) {
  setRay(ev);
  const hits = raycaster.intersectObjects(state.objects.map(o => o.root), true);
  for (const h of hits) {
    let n = h.object;
    while (n && !n.userData.obj) n = n.parent;
    if (n) return n.userData.obj;
  }
  return null;
}
const inSand = g => g && g.x >= 0 && g.x <= 1 && g.y >= 0 && g.y <= 1;

function freeSpot() {
  let best = [0.5, 0.5], bestD = -1;
  for (let i = 0; i < 40; i++) {
    const x = rand(0.15, 0.85), y = rand(0.15, 0.85);
    let d = 9;
    for (const o of state.objects) d = Math.min(d, Math.hypot(o.x - x, o.y - y));
    if (d > bestD) { bestD = d; best = [x, y]; }
  }
  return best;
}

/* =============== objects =============== */
function addObject(id, x, y, opts = {}) {
  const item = ITEM[id];
  if (!item) return null;
  const model = buildModel(id);
  // normalise: footprint about 1 unit wide, centred, tall things capped
  const box = new THREE.Box3().setFromObject(model), ext = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(ext.x, ext.z, ext.y * 0.7, 0.01);
  model.scale.multiplyScalar(k);
  model.position.x -= c.x * k; model.position.z -= c.z * k;
  const root = new THREE.Group(), lift = new THREE.Group();
  root.add(lift); lift.add(model);
  const o = {
    uid: uid++, id, item, x, y, rot: opts.rot || 0, scale: opts.scale || 1, flip: !!opts.flip,
    root, lift, model, h: box.max.y * k, a: null, dropT: opts.silent ? 0 : 1, pokeT: 0, hopY: 0, flyY: 0,
  };
  root.userData.obj = o;
  scene.add(root);
  state.objects.push(o);
  place(o);
  if (!opts.silent) { Sound.place(item); hideHint(); o.puffPending = true; }
  if (opts.select) select(o);
  save();
  return o;
}
const worldSize = o => o.item.size * SIZE * o.scale;
function place(o) {
  const s = worldSize(o);
  o.root.position.set((o.x - 0.5) * SIZE, 0, (o.y - 0.5) * SIZE);
  o.root.scale.set(s, s, o.flip && !o.item.animal ? -s : s);
  o.root.rotation.y = -o.rot * Math.PI / 180 + (o.flip && o.item.animal ? Math.PI : 0);
}
function select(o) {
  state.selected = o;
  $('#objbar').hidden = !o;
  selRing.visible = !!o;
}
function removeObject(o) {
  Sound.remove();
  if (state.selected === o) select(null);
  const i = state.objects.indexOf(o);
  if (i >= 0) state.objects.splice(i, 1);
  o.removing = 1;
  o.dying = 0.25;
  save();
}
function poke(o) {
  Sound.voice(o.item.voice);
  o.pokeT = 0.6;
  if (o.item.move === 'hop' && o.a && !o.a.hopping) o.a.timer = 0.4;
  if (o.item.move === 'fly' && o.a) { o.a.pause = 0; o.a.target = null; }
}

/* =============== palette drag =============== */
function startPaletteDrag(e, item) {
  if (e.button !== 0) return;
  e.preventDefault();
  Sound.init();
  const sx = e.clientX, sy = e.clientY;
  let ghost = null;
  const move = ev => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
      ghost = document.createElement('div');
      ghost.className = 'ghost';
      ghost.innerHTML = uniq(item.svg, 'ghost');
      document.body.appendChild(ghost);
      Sound.pick();
    }
    ghost.style.left = ev.clientX + 'px';
    ghost.style.top = ev.clientY + 'px';
    const g = overView(ev) ? groundAt(ev) : null;
    const ok = inSand(g);
    ghost.classList.toggle('over', ok);
    if (ok) { tool.show = false; dropMarker(g); } else dropMarker(null);
  };
  const done = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', done);
    if (ghost) ghost.remove();
    dropMarker(null);
  };
  const up = ev => {
    const had = !!ghost;
    done();
    if (!had) { addObject(item.id, ...freeSpot(), { select: true }); return; }
    const g = overView(ev) ? groundAt(ev) : null;
    if (inSand(g)) addObject(item.id, clamp(g.x, 0.03, 0.97), clamp(g.y, 0.03, 0.97), { select: true });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', done);
}
const overView = ev => { const r = view.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 48), new THREE.MeshBasicMaterial({ color: 0x6b8a5a, transparent: true, opacity: 0.8, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03; marker.visible = false; scene.add(marker);
function dropMarker(g) { marker.visible = !!g; if (g) marker.position.set(g.p.x, 0.03, g.p.z); }

/* =============== pointer: rake, ripple, drag objects =============== */
const pointers = new Set();
let stroke = null, drag = null, hoverObj = null, pouring = null;
const nearTray = g => g && g.x > -0.2 && g.x < 1.2 && g.y > -0.2 && g.y < 1.2;

function ripples(x, y, r0) {
  const t = TOOLS.ripple;
  tool.active = true;
  sand.ring(x, y, r0, { n: t.n, sp: t.sp, w: t.w }, true,
    (px, py) => { tool.target.set((px / 1000 - 0.5) * SIZE, 0, (py / 1000 - 0.5) * SIZE); tool.targetAngle = Math.atan2(py - y, px - x) + Math.PI / 2; },
    () => { tool.active = false; });
  tool.show = true;
  Sound.ripple();
  hideHint();
  save();
}

view.addEventListener('pointerdown', e => {
  pointers.add(e.pointerId);
  if (pointers.size > 1) { cancelInteractions(); return; }
  if (e.button !== 0) return;
  Sound.init();
  viewAnim = null;
  const o = objectAt(e);
  if (o) {
    if (state.tool === 'ripple') { ripples(o.x * 1000, o.y * 1000, worldSize(o) * 100 * 0.45 + 12); return; }
    select(o);
    const g = groundAt(e);
    drag = { o, sx: e.clientX, sy: e.clientY, ox: o.x - (g ? g.x : o.x), oy: o.y - (g ? g.y : o.y), moved: false, outside: false };
    view.setPointerCapture(e.pointerId);
    return;
  }
  const g = groundAt(e);
  select(null);
  const t = TOOLS[state.tool];
  if (t.kind === 'pour' && nearTray(g)) {
    view.setPointerCapture(e.pointerId);
    pouring = { g, clock: 0 };
    tool.active = true; tool.show = true; tool.target.copy(g.p);
    if (e.pointerType !== 'mouse') tool.snap = true;
    hideHint();
    return;
  }
  if (!inSand(g)) return;
  if (t.kind === 'ripple') { ripples(g.x * 1000, g.y * 1000, 16); return; }
  view.setPointerCapture(e.pointerId);
  stroke = { last: performance.now(), lx: g.x * 1000, ly: g.y * 1000 };
  if (t.kind === 'smooth') sand.begin({ t: 'smooth', r: t.r }, g.x * 1000, g.y * 1000);
  else sand.begin({ t: 'rake', n: t.n, sp: t.sp, w: t.w }, g.x * 1000, g.y * 1000);
  tool.active = true; tool.show = true;
  tool.target.copy(g.p);
  if (e.pointerType !== 'mouse') tool.snap = true;
  hideHint();
});

view.addEventListener('pointermove', e => {
  if (drag) return dragMove(e);
  if (pouring) { const g = groundAt(e); if (g) { pouring.g = g; tool.target.copy(g.p); } return; }
  if (stroke) {
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    for (const ev of (evs.length ? evs : [e])) { const g = groundAt(ev); if (g) sand.extend(g.x * 1000, g.y * 1000); }
    const g = groundAt(e);
    if (!g) return;
    const x = g.x * 1000, y = g.y * 1000, now = performance.now();
    const d = Math.hypot(x - stroke.lx, y - stroke.ly), dt = Math.max(8, now - stroke.last);
    if (d > 3) tool.targetAngle = Math.atan2(y - stroke.ly, x - stroke.lx);
    stroke.lx = x; stroke.ly = y; stroke.last = now;
    tool.target.copy(g.p);
    Sound.rake(d / dt, state.tool);
    if (d > 1) sprayFromTool(g.p, (x - (stroke.px ?? x)) || Math.cos(tool.targetAngle), (y - (stroke.py ?? y)) || Math.sin(tool.targetAngle), d / dt * 10);
    stroke.px = x; stroke.py = y;
    return;
  }
  if (pointers.size > 1 || e.pointerType !== 'mouse') return;
  // hover: show the tool over sand, a grab hand over objects
  hoverObj = objectAt(e);
  const g = groundAt(e);
  if (hoverObj && state.tool !== 'ripple') { tool.show = false; view.style.cursor = 'grab'; }
  else if (inSand(g) || (state.tool === 'pour' && nearTray(g))) {
    tool.show = true; view.style.cursor = 'none';
    tool.target.copy(g.p);
    if (!tool.active) tool.targetAngle = Math.atan2(camera.position.z - g.p.z, camera.position.x - g.p.x);
  } else { tool.show = false; view.style.cursor = 'default'; }
});

function dragMove(e) {
  const o = drag.o;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    drag.moved = true; o.dragging = true;
    if (o.a) { o.a.hopping = null; o.a.trail = null; }
    $('#objbar').hidden = true;
    view.style.cursor = 'grabbing';
    Sound.pick();
  }
  const g = groundAt(e);
  if (!g) return;
  o.x = g.x + drag.ox; o.y = g.y + drag.oy;
  drag.outside = g.x < -0.04 || g.x > 1.04 || g.y < -0.04 || g.y > 1.04;
  ringMat.color.set(drag.outside ? 0xd0573a : 0xffffff);
  place(o);
}

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (drag) {
    const { o, moved, outside } = drag;
    drag = null;
    o.dragging = false;
    ringMat.color.set(0xffffff);
    view.style.cursor = 'grab';
    if (outside) { removeObject(o); return; }
    if (moved) {
      o.x = clamp(o.x, 0.03, 0.97); o.y = clamp(o.y, 0.03, 0.97);
      if (o.a) o.a.target = null;
      place(o);
      Sound.place(o.item, 0.5);
      if (state.selected === o) $('#objbar').hidden = false;
      save();
    } else if (o.item.animal) poke(o);
    return;
  }
  if (pouring) {
    pouring = null;
    sand.end();
    Sound.rakeStop();
    tool.active = false;
    if (e.pointerType !== 'mouse') tool.show = false;
    save();
  }
  if (stroke) {
    stroke = null;
    sand.end();
    Sound.rakeStop();
    tool.active = false;
    if (e.pointerType !== 'mouse') tool.show = false;
    save();
  }
}
view.addEventListener('pointerup', endPointer);
view.addEventListener('pointercancel', endPointer);
view.addEventListener('pointerleave', e => { if (!stroke && !drag && e.pointerType === 'mouse') tool.show = false; });
function cancelInteractions() {
  if (stroke || pouring) { stroke = null; pouring = null; sand.end(); Sound.rakeStop(); save(); }
  if (drag) { drag.o.dragging = false; drag = null; }
  tool.active = false; tool.show = false;
}
view.addEventListener('wheel', () => { viewAnim = null; }, { passive: true });

/* selection toolbar */
const bar = $('#objbar');
bar.addEventListener('pointerdown', e => e.stopPropagation());
bar.addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]');
  const o = state.selected;
  if (!btn || !o) return;
  switch (btn.dataset.act) {
    case 'rotl': o.rot -= 15; break;
    case 'rotr': o.rot += 15; break;
    case 'smaller': o.scale = clamp(o.scale / 1.15, 0.4, 2.5); break;
    case 'bigger': o.scale = clamp(o.scale * 1.15, 0.4, 2.5); break;
    case 'flip': o.flip = !o.flip; break;
    case 'delete': removeObject(o); return;
  }
  Sound.tick();
  place(o); save();
});

/* =============== controls =============== */
function setTool(name) {
  state.tool = name;
  $$('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === name));
  Object.entries(toolMeshes).forEach(([k, m]) => { if (k !== name) m.visible = false; });
}
$$('.tool').forEach(b => b.addEventListener('click', () => { Sound.tick(); setTool(b.dataset.tool); }));
$$('[data-view]').forEach(b => b.addEventListener('click', () => { Sound.tick(); setView(b.dataset.view); }));

const sandSw = $('#sandSwatches');
SAND_COLORS.forEach(([name, hex]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'swatch'; b.title = name + ' sand';
  b.setAttribute('aria-label', name + ' sand');
  b.style.background = hex; b.dataset.hex = hex;
  b.addEventListener('click', () => { Sound.tick(); setSand(hex); save(); });
  sandSw.appendChild(b);
});
function setSand(hex) {
  state.sandColor = hex;
  sand.setColor(hex);
  $$('.swatch', sandSw).forEach(b => b.setAttribute('aria-pressed', b.dataset.hex === hex));
}
const frameSw = $('#frameSwatches');
Object.entries(FRAMES).forEach(([key, [name, c]]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'swatch'; b.title = name + ' frame';
  b.setAttribute('aria-label', name + ' frame');
  b.style.background = c; b.dataset.key = key;
  b.addEventListener('click', () => { Sound.tick(); setFrame(key); save(); });
  frameSw.appendChild(b);
});
function setFrame(key) {
  if (!FRAMES[key]) key = 'birch';
  state.frame = key;
  woodX.color.set(FRAMES[key][1]); woodZ.color.set(FRAMES[key][1]);
  $$('.swatch', frameSw).forEach(b => b.setAttribute('aria-pressed', b.dataset.key === key));
}

$('#undo').addEventListener('click', () => { if (sand.undo()) { Sound.undo(); save(); } });
$('#clear').addEventListener('click', () => { Sound.clear(); sand.clear(); sweepSpills(); save(); });
$('#reset').addEventListener('click', () => {
  if (!confirm('Start a new, empty garden? Your current one will be cleared.')) return;
  Sound.clear();
  select(null);
  state.objects.forEach(o => scene.remove(o.root));
  state.objects = [];
  sweepSpills();
  sand.reset();
  save();
});
$('#roam').addEventListener('change', e => {
  state.roam = e.target.checked;
  if (!state.roam) state.objects.forEach(o => { if (o.a) { o.a.hopping = null; o.a.walking = false; } o.hopY = 0; });
  save();
});

const muteBtn = $('#mute');
muteBtn.addEventListener('click', () => {
  Sound.setMuted(!Sound.muted);
  muteBtn.setAttribute('aria-pressed', Sound.muted);
  muteBtn.title = Sound.muted ? 'Unmute' : 'Mute';
  save();
});
$$('[data-amb]').forEach(b => b.addEventListener('click', () => {
  const on = b.getAttribute('aria-pressed') !== 'true';
  Sound.setAmbient(b.dataset.amb, on);
  b.setAttribute('aria-pressed', on);
  save();
}));
const soundNote = $('#soundNote');
const updateSoundNote = st => { soundNote.hidden = st === 'running'; };
Sound.onState(updateSoundNote);
updateSoundNote(Sound.state);
soundNote.addEventListener('click', () => Sound.init());

window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('#undo').click(); return; }
  const o = state.selected;
  const keyTools = { 1: 'rake', 2: 'wide', 3: 'stick', 4: 'ripple', 5: 'smooth', 6: 'pour' };
  if (!o && keyTools[e.key]) { setTool(keyTools[e.key]); return; }
  if (!o && (e.key === 't' || e.key === 'T')) { setView(state.view === '3d' ? 'top' : '3d'); return; }
  if (!o) return;
  let changed = true;
  switch (e.key) {
    case 'Delete': case 'Backspace': removeObject(o); return;
    case 'Escape': select(null); return;
    case 'r': o.rot += 15; break;
    case 'R': o.rot -= 15; break;
    case '+': case '=': o.scale = clamp(o.scale * 1.1, 0.4, 2.5); break;
    case '-': case '_': o.scale = clamp(o.scale / 1.1, 0.4, 2.5); break;
    case 'f': o.flip = !o.flip; break;
    case 'ArrowLeft': o.x = clamp(o.x - 0.01, 0.03, 0.97); break;
    case 'ArrowRight': o.x = clamp(o.x + 0.01, 0.03, 0.97); break;
    case 'ArrowUp': o.y = clamp(o.y - 0.01, 0.03, 0.97); break;
    case 'ArrowDown': o.y = clamp(o.y + 0.01, 0.03, 0.97); break;
    default: changed = false;
  }
  if (changed) { e.preventDefault(); place(o); save(); }
});

const hint = $('#hint');
function hideHint() { if (hint) hint.classList.add('gone'); }

/* =============== animals =============== */
function behave(o, dt, now) {
  const a = o.a || (o.a = { pause: rand(0.5, 3), timer: rand(1.5, 5), target: null, dist: 0, side: 1 });
  const m = o.item.move;
  if (m === 'wander') wander(o, a, dt);
  else if (m === 'hop') hop(o, a, dt);
  else if (m === 'fly') fly(o, a, dt, now);
}
function wander(o, a, dt) {
  if (a.pause > 0) { a.pause -= dt; a.walking = false; a.trail = null; return; }
  if (!a.target) a.target = { x: clamp(o.x + rand(-0.22, 0.22), 0.08, 0.92), y: clamp(o.y + rand(-0.2, 0.2), 0.08, 0.92) };
  const dx = a.target.x - o.x, dy = a.target.y - o.y, d = Math.hypot(dx, dy);
  if (d < 0.004) { a.target = null; a.pause = rand(2, 7); save(); return; }
  a.walking = true;
  const step = Math.min(d, o.item.speed * dt);
  o.x += dx / d * step; o.y += dy / d * step;
  const want = Math.atan2(dy, dx) * 180 / Math.PI;
  o.rot = lerpAngle(o.rot * Math.PI / 180, want * Math.PI / 180, Math.min(1, dt * 4)) * 180 / Math.PI;
  o.flip = false;
  place(o);
  const s = worldSize(o) * 100, hx = Math.cos(o.rot * Math.PI / 180), hy = Math.sin(o.rot * Math.PI / 180);
  if (o.item.trail === 'slime') {
    const fx = o.x * 1000 - hx * s * 0.3, fy = o.y * 1000 - hy * s * 0.3;
    if (!a.trail) a.trail = sand.beginLine(fx, fy, 6); else sand.extendLine(a.trail, fx, fy);
  } else if (o.item.trail === 'feet') {
    a.dist += step;
    if (a.dist > 0.012) {
      a.dist = 0; a.side *= -1;
      const off = s * 0.24 * a.side;
      sand.addDot(o.x * 1000 - hy * off, o.y * 1000 + hx * off, 3.2);
    }
  }
}
function hop(o, a, dt) {
  if (a.hopping) {
    const h = a.hopping;
    h.p += dt / h.dur;
    const p = Math.min(1, h.p), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    o.x = h.x0 + (h.x1 - h.x0) * e;
    o.y = h.y0 + (h.y1 - h.y0) * e;
    o.hopY = Math.sin(Math.PI * p) * h.height;
    place(o);
    if (p >= 1) {
      a.hopping = null; o.hopY = 0;
      const s = worldSize(o) * 100, hx = Math.cos(o.rot * Math.PI / 180), hy = Math.sin(o.rot * Math.PI / 180);
      for (const side of [-1, 1]) sand.addDot(o.x * 1000 - hy * s * 0.2 * side, o.y * 1000 + hx * s * 0.2 * side, Math.max(2.5, s * 0.05));
      puff(o.root.position.x, o.root.position.z, worldSize(o) * 0.3, 8, 0.8);
      Sound.land(o.item.voice);
      a.timer = rand(o.item.rest[0], o.item.rest[1]);
    }
    return;
  }
  a.timer -= dt;
  if (a.timer > 0) return;
  const ang = Math.random() * Math.PI * 2, dist = rand(o.item.hopDist[0], o.item.hopDist[1]);
  const x1 = clamp(o.x + Math.cos(ang) * dist, 0.08, 0.92), y1 = clamp(o.y + Math.sin(ang) * dist, 0.08, 0.92);
  o.rot = Math.atan2(y1 - o.y, x1 - o.x) * 180 / Math.PI;
  o.flip = false;
  a.hopping = { p: 0, x0: o.x, y0: o.y, x1, y1, dur: o.item.hopDur, height: o.item.hopHeight / 100 * 0.9 };
  if (Math.random() < 0.2) Sound.voice(o.item.voice, 0.3);
}
function fly(o, a, dt, now) {
  const cruise = 1.3 / worldSize(o);
  if (a.pause > 0) {
    a.pause -= dt; a.resting = true;
    const want = a.perchY ?? 0;
    o.flyY += (want - o.flyY) * Math.min(1, dt * 6);
    return;
  }
  a.resting = false;
  if (!a.target) {
    const perches = state.objects.filter(p => p !== o && (p.item.cat === 'plants' || p.item.cat === 'rocks' || p.id === 'lantern'));
    if (perches.length && Math.random() < 0.6) {
      const p = perches[Math.floor(Math.random() * perches.length)];
      a.target = { x: p.x + rand(-0.01, 0.01), y: p.y + rand(-0.01, 0.01), perchY: (p.h * worldSize(p)) / worldSize(o) };
    } else a.target = { x: rand(0.08, 0.92), y: rand(0.08, 0.92), perchY: 0 };
  }
  const dx = a.target.x - o.x, dy = a.target.y - o.y, d = Math.hypot(dx, dy);
  if (d < 0.01) { a.pause = a.target.perchY ? rand(3, 8) : rand(1, 3); a.perchY = a.target.perchY; a.target = null; save(); return; }
  const ang = Math.atan2(dy, dx) + Math.sin(now / 170 + o.uid) * 0.5;
  const step = Math.min(d, o.item.speed * dt);
  o.x += Math.cos(ang) * step; o.y += Math.sin(ang) * step;
  o.rot = ang * 180 / Math.PI;
  const want = d < 0.05 ? (a.target.perchY || 0) + 0.3 : cruise + Math.sin(now / 300 + o.uid) * 0.3;
  o.flyY += (want - o.flyY) * Math.min(1, dt * 3);
  place(o);
}

/* =============== loose sand: flying grains and spills =============== */
const MAXP = 5000, MAXS = 9000;
const grainSprite = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#eee'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(16, 16, 15, 0, 7); x.fill();
  return new THREE.CanvasTexture(c);
})();
function makeCloud(max, size) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: grainSprite, vertexColors: true, alphaTest: 0.45, sizeAttenuation: true }));
  pts.frustumCulled = false;
  scene.add(pts);
  return { pos, col, geo, n: 0 };
}
const air = makeCloud(MAXP, 0.13), vel = new Float32Array(MAXP * 3);
const spill = makeCloud(MAXS, 0.11);
let spillNext = 0, lastGrainSound = 0;
const grainCol = new THREE.Color(), sandCol = new THREE.Color();
function grainColor(arr, i) {
  sandCol.set(state.sandColor);
  const r = Math.random();
  const k = r < 0.08 ? 0.45 : r < 0.18 ? 1.25 : 0.78 + Math.random() * 0.25;
  grainCol.copy(sandCol).multiplyScalar(k * 0.8); // points are unlit, so tone them down to match the lit sand
  arr[i * 3] = grainCol.r; arr[i * 3 + 1] = grainCol.g; arr[i * 3 + 2] = grainCol.b;
}
function emit(x, y, z, vx, vy, vz) {
  if (air.n >= MAXP) return;
  const i = air.n++;
  air.pos[i * 3] = x; air.pos[i * 3 + 1] = y; air.pos[i * 3 + 2] = z;
  vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
  grainColor(air.col, i);
}
function settle(i, y) {
  const j = spillNext; spillNext = (spillNext + 1) % MAXS;
  spill.pos[j * 3] = air.pos[i * 3]; spill.pos[j * 3 + 1] = y; spill.pos[j * 3 + 2] = air.pos[i * 3 + 2];
  spill.col[j * 3] = air.col[i * 3]; spill.col[j * 3 + 1] = air.col[i * 3 + 1]; spill.col[j * 3 + 2] = air.col[i * 3 + 2];
  spill.n = Math.min(MAXS, spill.n + 1);
  spill.dirty = true;
  const now = performance.now();
  if (now - lastGrainSound > 45) { lastGrainSound = now; Sound.grain(); }
}
function kill(i) {
  const l = --air.n;
  if (i !== l) for (let k = 0; k < 3; k++) { air.pos[i * 3 + k] = air.pos[l * 3 + k]; air.col[i * 3 + k] = air.col[l * 3 + k]; vel[i * 3 + k] = vel[l * 3 + k]; }
}
function sweepSpills() { spill.n = 0; spillNext = 0; spill.dirty = true; air.n = 0; }

const HALF = SIZE / 2, OUTER = SIZE / 2 + RIM, GROUND = -DEPTH;
function stepParticles(dt) {
  if (!air.n && !spill.dirty) return;
  const P = air.pos;
  for (let i = 0; i < air.n; i++) {
    const ix = i * 3, iy = ix + 1, iz = ix + 2;
    const ox = P[ix], oy = P[iy], oz = P[iz];
    vel[iy] -= 9.8 * dt;
    P[ix] += vel[ix] * dt; P[iy] += vel[iy] * dt; P[iz] += vel[iz] * dt;
    const x = P[ix], y = P[iy], z = P[iz];
    const wasIn = Math.abs(ox) < HALF && Math.abs(oz) < HALF;
    const inside = Math.abs(x) < HALF && Math.abs(z) < HALF;
    const onFrame = !inside && Math.abs(x) < OUTER && Math.abs(z) < OUTER;
    if (inside) {
      const f = floorAt(x, z);
      if (y <= f) {
        // most grains sink back into the sand; a few bounce
        if (vel[iy] < -2.2 && Math.random() < 0.25) { P[iy] = f; vel[iy] *= -0.25; vel[ix] *= 0.5; vel[iz] *= 0.5; }
        else { kill(i); i--; }
      }
    } else if (onFrame) {
      if (y <= RIM_H) {
        if (wasIn && oy < RIM_H) {
          // hit the inside wall of the tray: bounce back in
          if (Math.abs(x) >= HALF) { P[ix] = Math.sign(x) * (HALF - 0.01); vel[ix] *= -0.3; }
          if (Math.abs(z) >= HALF) { P[iz] = Math.sign(z) * (HALF - 0.01); vel[iz] *= -0.3; }
        } else if (oy >= RIM_H - 0.03) {
          if (Math.abs(vel[iy]) > 1.2) { P[iy] = RIM_H; vel[iy] *= -0.3; vel[ix] *= 0.55; vel[iz] *= 0.55; }
          else { settle(i, RIM_H + 0.012); kill(i); i--; }
        }
      }
    } else if (y <= GROUND) {
      if (Math.abs(vel[iy]) > 1.2) { P[iy] = GROUND; vel[iy] *= -0.3; vel[ix] *= 0.55; vel[iz] *= 0.55; }
      else { settle(i, GROUND + 0.012); kill(i); i--; }
    }
    if (P[iy] < -5) { kill(i); i--; }
  }
  air.geo.setDrawRange(0, air.n);
  air.geo.attributes.position.needsUpdate = true;
  air.geo.attributes.color.needsUpdate = true;
  if (spill.dirty) {
    spill.geo.setDrawRange(0, spill.n);
    spill.geo.attributes.position.needsUpdate = true;
    spill.geo.attributes.color.needsUpdate = true;
    spill.dirty = false;
  }
}
// grains kicked up by a moving rake/stick/smoother
function sprayFromTool(p, dx, dy, speed) {
  const t = TOOLS[state.tool];
  const L = Math.hypot(dx, dy) || 1, ux = dx / L, uz = dy / L, px = -uz, pz = ux;
  const span = t.kind === 'smooth' ? 0.95 : (t.n - 1) * t.sp / 100 + 0.12;
  const s = Math.min(speed, 9);
  const count = Math.min(16, Math.round(1 + s * 1.6 * (t.kind === 'smooth' ? 1.5 : t.n > 1 ? 1 : 0.5)));
  const f0 = floorAt(p.x, p.z);
  for (let k = 0; k < count; k++) {
    const o = (Math.random() - 0.5) * span;
    const fwd = s * (0.25 + Math.random() * 0.45);
    emit(p.x + px * o + ux * 0.05, f0 + 0.02, p.z + pz * o + uz * 0.05,
      ux * fwd + (Math.random() - 0.5) * 0.7, 0.5 + Math.random() * (0.6 + s * 0.3), uz * fwd + (Math.random() - 0.5) * 0.7);
  }
}
// a ring of grains thrown up when something lands
function puff(x, z, r, n, power) {
  const f = floorAt(x, z);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, sp = power * (0.4 + Math.random() * 0.8);
    emit(x + Math.cos(a) * r, f + 0.02, z + Math.sin(a) * r, Math.cos(a) * sp, 0.6 + Math.random() * power, Math.sin(a) * sp);
  }
}
// pouring: a stream of grains falls from the scoop and builds a pile
function stepPour(dt) {
  const g = pouring.g, p = tool.pos;
  const lipY = tool.y + 1.22;
  for (let k = 0; k < 14; k++) emit(p.x + (Math.random() - 0.5) * 0.07, lipY, p.z + (Math.random() - 0.5) * 0.07, (Math.random() - 0.5) * 0.25, -0.4 - Math.random() * 0.8, (Math.random() - 0.5) * 0.25);
  Sound.rake(1.1, 'pour');
  // one dab of sand every 70ms of real time, however fast frames come
  const now = performance.now();
  if (!pouring.last) pouring.last = now - 70;
  let dabs = Math.min(8, Math.floor((now - pouring.last) / 70));
  if (!dabs) return;
  pouring.last += dabs * 70;
  const u = (p.x / SIZE + 0.5) * 1000, v = (p.z / SIZE + 0.5) * 1000;
  if (!inSand(g) || u < 0 || u > 1000 || v < 0 || v > 1000) return;
  while (dabs--) { if (!sand.cur) sand.begin({ t: 'pour', r: TOOLS.pour.r }, u, v); else sand.pour(u, v); }
}

/* =============== main loop =============== */
const clock = new THREE.Clock();
let saveClock = 0, hStamp = 0, hPending = false;
const tmpV = new THREE.Vector3();
function frame() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
  stepView(dt);
  controls.update();
  if (pouring) stepPour(dt);
  stepParticles(dt);

  if (state.roam && !document.hidden) {
    for (const o of state.objects) if (o.item.move && !o.dragging) behave(o, dt, now);
    saveClock += dt;
    if (saveClock > 5) { saveClock = 0; save(); }
  }

  const all = scene.children.filter(c => c.userData.obj);
  for (const root of all) {
    const o = root.userData.obj;
    if (o.dying !== undefined) {
      o.dying -= dt;
      const k = Math.max(0, o.dying / 0.25);
      o.lift.scale.setScalar(k);
      if (o.dying <= 0) scene.remove(root);
      continue;
    }
    let y = o.hopY + o.flyY, sx = 1, sy = 1;
    if (o.dropT > 0) {
      o.dropT = Math.max(0, o.dropT - dt / 0.45);
      const p = 1 - o.dropT;
      if (o.puffPending && p > 0.6) { o.puffPending = false; puff(o.root.position.x, o.root.position.z, worldSize(o) * 0.4, 36, 1.4); }
      y += Math.max(0, 1 - p * 1.6) * 0.9;
      const sq = p > 0.6 ? Math.sin((p - 0.6) / 0.4 * Math.PI) * 0.12 : 0;
      sx += sq; sy -= sq;
    }
    if (o.pokeT > 0) {
      o.pokeT = Math.max(0, o.pokeT - dt);
      const p = 1 - o.pokeT / 0.6;
      y += Math.sin(Math.min(1, p * 1.4) * Math.PI) * 0.3;
      const sq = Math.sin(p * Math.PI * 2) * 0.1 * (1 - p);
      sx += sq; sy -= sq;
    }
    if (o.dragging) y += 0.35;
    o.lift.position.y = y;
    o.lift.scale.set(sx, sy, sx);
    if (o.model.userData.update) o.model.userData.update(t, o);
  }

  // selection ring + toolbar follow the selected object
  const sel = state.selected;
  if (sel) {
    const s = worldSize(sel);
    selRing.position.set(sel.root.position.x, 0.04, sel.root.position.z);
    selRing.scale.setScalar(s);
    if (!bar.hidden) {
      tmpV.set(sel.root.position.x, 0, sel.root.position.z + s * 0.6).project(camera);
      let sx = (tmpV.x * 0.5 + 0.5) * view.clientWidth, sy = (-tmpV.y * 0.5 + 0.5) * view.clientHeight;
      if (sy > view.clientHeight - 120) {
        tmpV.set(sel.root.position.x, sel.h * s + 0.2, sel.root.position.z).project(camera);
        sy = (-tmpV.y * 0.5 + 0.5) * view.clientHeight - 54;
      }
      bar.style.left = clamp(sx, 130, view.clientWidth - 130) + 'px';
      bar.style.top = clamp(sy + 10, 60, view.clientHeight - 110) + 'px';
    }
  }

  // hand tool
  const tm = toolMeshes[state.tool];
  tm.visible = tool.show;
  if (tool.show) {
    if (tool.snap) { tool.pos.copy(tool.target); tool.angle = tool.targetAngle; tool.snap = false; }
    tool.pos.lerp(tool.target, tool.active ? 0.6 : 0.35);
    tool.angle = lerpAngle(tool.angle, tool.targetAngle, tool.active ? 0.25 : 0.15);
    const ground = floorAt(tool.pos.x, tool.pos.z);
    const wantY = state.tool === 'pour' ? ground + (tool.active ? 0.15 : 0.3) : ground + (tool.active ? -0.025 : 0.35);
    tool.y += (wantY - tool.y) * 0.3;
    tm.position.set(tool.pos.x, tool.y, tool.pos.z);
    tm.rotation.set(0, -tool.angle, 0);
  } else tool.snap = true;

  if (sand.dirty) {
    colorTex.needsUpdate = true; heightTex.needsUpdate = true; sand.dirty = false;
    if (now - hStamp > 120) { sand._hdStale = true; hStamp = now; } else hPending = true;
  } else if (hPending && now - hStamp > 120) { sand._hdStale = true; hStamp = now; hPending = false; }
  if (sand.roughDirty) { roughTex.needsUpdate = true; sand.roughDirty = false; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* =============== save / load =============== */
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(doSave, 400); }
function doSave() {
  saveT = null;
  const data = {
    v: 2, sand: state.sandColor, frame: state.frame, roam: state.roam, view: state.view,
    muted: Sound.muted, ambient: Sound.getAmbient(),
    objects: state.objects.map(o => ({ id: o.id, x: +o.x.toFixed(4), y: +o.y.toFixed(4), rot: Math.round(o.rot), scale: +o.scale.toFixed(3), flip: o.flip })),
    ops: sand.liveOps(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) {
    try { data.ops = data.ops.filter(op => !op.auto); localStorage.setItem(KEY, JSON.stringify(data)); } catch (e2) { /* storage full or blocked */ }
  }
}
const flush = () => { if (saveT) { clearTimeout(saveT); doSave(); } };
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

function load() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
  if (!data || !Array.isArray(data.objects)) { starterGarden(); return; }
  // the old near-white default becomes the new sandier one
  setSand(!data.sand || data.sand === '#e8dcc4' ? SAND_COLORS[0][1] : data.sand);
  setFrame(data.frame || 'birch');
  sand.load(data.ops || []);
  data.objects.forEach(o => {
    // v1 butterflies stored "heading + 90" because the 2D art faced up
    const rot = data.v === 1 && o.id === 'butterfly' ? o.rot - 90 : o.rot;
    const flipAnimal = data.v === 1 && ITEM[o.id] && ITEM[o.id].animal && o.flip;
    addObject(o.id, o.x, o.y, { rot: flipAnimal ? 180 : rot, scale: o.scale, flip: flipAnimal ? false : o.flip, silent: true });
  });
  state.roam = data.roam !== false;
  $('#roam').checked = state.roam;
  if (data.ambient) for (const k in data.ambient) Sound.setAmbient(k, !!data.ambient[k]);
  if (data.muted) { Sound.setMuted(true); muteBtn.setAttribute('aria-pressed', 'true'); }
  hideHint();
}
function starterGarden() {
  setSand(SAND_COLORS[0][1]);
  setFrame('birch');
  sand.reset();
  const wave = x0 => {
    sand.begin({ t: 'rake', n: 9, sp: 13, w: 6 }, x0, -80);
    for (let y = -80; y <= 1060; y += 8) sand.extend(x0 + Math.sin(y / 95) * 34, y);
    sand.end();
  };
  wave(660); wave(780); wave(900);
  sand.ring(360, 400, 82, { n: 6, sp: 17, w: 7 }, false);
  [
    ['airplant', 0.36, 0.4], ['river', 0.17, 0.74, { rot: -10 }], ['quartz', 0.82, 0.17],
    ['moss', 0.75, 0.13], ['amethyst', 0.72, 0.84], ['blush', 0.14, 0.15, { scale: 0.8 }],
    ['frog', 0.47, 0.76, { rot: -30 }], ['snail', 0.3, 0.9],
  ].forEach(([id, x, y, o]) => addObject(id, x, y, Object.assign({ silent: true }, o)));
}

/* =============== save picture =============== */
$('#save').addEventListener('click', () => {
  Sound.tick();
  const wasRing = selRing.visible, wasTool = toolMeshes[state.tool].visible;
  selRing.visible = false; toolMeshes[state.tool].visible = false;
  renderer.render(scene, camera);
  view.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-zen-garden.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
  selRing.visible = wasRing; toolMeshes[state.tool].visible = wasTool;
});

/* =============== go =============== */
setTool('rake');
load();
$$('[data-amb]').forEach(b => b.setAttribute('aria-pressed', !!Sound.getAmbient()[b.dataset.amb]));
camera.position.set(0, Math.cos(VIEWS['3d']) * 20, Math.sin(VIEWS['3d']) * 20);
controls.target.set(0, -0.2, 0.9);
resize();
$$('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === '3d'));
document.body.classList.add('ready');
frame();
