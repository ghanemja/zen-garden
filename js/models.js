/* Procedural 3D models for every item, plus the hand tools.
 * Conventions: y is up, models sit on y = 0 (the sand), animals face +x.
 * The app rescales each model so its footprint is about 1 unit wide. */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise3(x, y, z, s) {
  return Math.sin(x * 1.9 + s) * Math.sin(y * 2.3 + s * 1.7) * Math.sin(z * 1.7 + s * 0.6)
    + 0.5 * Math.sin(x * 3.7 + y * 2.9 + s * 2.3) * Math.sin(z * 3.3 - s * 1.1)
    + 0.25 * Math.sin(x * 7.1 - z * 6.3 + s) * Math.sin(y * 6.7 + s * 0.3);
}

const matCache = new Map();
export function std(color, o = {}) {
  const k = color + JSON.stringify(o);
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o }); matCache.set(k, m); }
  return m;
}
function mesh(geo, mat, p = [0, 0, 0], s = 1, r) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]);
  if (r) m.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const GEO = {
  sph: new THREE.SphereGeometry(1, 28, 18),
  lo: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 18),
};
const grp = (...c) => { const g = new THREE.Group(); c.forEach(x => g.add(x)); return g; };

/* ---------- stones ---------- */
function rockGeo(seed, detail, amp) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + noise3(v.x, v.y, v.z, seed) * amp);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function rock({ seed = 1, s = [0.4, 0.3, 0.4], color = '#888', rough = 0.8, amp = 0.16, speck = 0, flat = false, y, rotY = 0, pos = [0, 0], coat = 0 }) {
  const g = rockGeo(seed, flat ? 2 : 4, amp);
  const r = rng(seed * 7 + 1), c = new THREE.Color(color), n = g.attributes.position.count, cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let k = 1 + (r() - 0.5) * 0.14;
    if (speck && r() < speck) k *= r() < 0.55 ? 0.45 : 1.6;
    cols[i * 3] = c.r * k; cols[i * 3 + 1] = c.g * k; cols[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = coat
    ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: rough, clearcoat: coat, clearcoatRoughness: 0.15, flatShading: flat })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, flatShading: flat });
  return mesh(g, mat, [pos[0], y ?? s[1] * 0.72, pos[1]], s, [0, rotY, 0]);
}
function mossCap(target, seed, count = 130, minNy = 0.35) {
  // scatter moss balls over the upward-facing part of a rock mesh
  const r = rng(seed), g = target.geometry, p = g.attributes.position, nrm = g.attributes.normal;
  const cands = [];
  for (let i = 0; i < p.count; i++) if (nrm.getY(i) > minNy) cands.push(i);
  const im = new THREE.InstancedMesh(GEO.lo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), count);
  const greens = ['#4f6e2c', '#5f8436', '#709a3f', '#86ad4c', '#9cbf5c'].map(c => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let k = 0; k < count; k++) {
    const i = cands[Math.floor(r() * cands.length)];
    v.set(p.getX(i), p.getY(i), p.getZ(i)).multiply(target.scale).add(target.position);
    const s = 0.025 + r() * 0.04;
    sc.set(s, s * 0.7, s);
    m4.compose(v, q, sc);
    im.setMatrixAt(k, m4);
    im.setColorAt(k, greens[Math.floor(r() * greens.length)]);
  }
  im.castShadow = im.receiveShadow = true;
  return im;
}

const B = {};
B.river = () => grp(rock({ seed: 3, s: [0.5, 0.19, 0.34], color: '#2a2c2f', rough: 0.35, amp: 0.1, coat: 0.5 }));
B.granite = () => grp(rock({ seed: 7, s: [0.42, 0.33, 0.39], color: '#a8a39b', speck: 0.3, amp: 0.2 }));
B.quartz = () => grp(rock({ seed: 11, s: [0.36, 0.29, 0.33], color: '#eab4bd', rough: 0.2, amp: 0.1, coat: 0.9 }));
B.amethyst = () => {
  const base = rock({ seed: 13, s: [0.48, 0.2, 0.4], color: '#8d8390', amp: 0.15, flat: true, y: 0.1 });
  const g = grp(base), r = rng(14);
  const cols = ['#9c6fd0', '#7b4fb0', '#b996e6', '#6a3f9a'];
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.3;
    const h = 0.12 + r() * 0.2;
    const c = mesh(new THREE.ConeGeometry(0.035 + r() * 0.03, h, 5), std(cols[i % 4], { roughness: 0.15, metalness: 0.1, flatShading: true }),
      [Math.cos(a) * d * 1.2, 0.22 + h / 2 - 0.04, Math.sin(a) * d], 1, [Math.sin(a) * d * 1.4, r() * 3, -Math.cos(a) * d * 1.4]);
    g.add(c);
  }
  return g;
};
B.cairn = () => grp(
  rock({ seed: 21, s: [0.48, 0.14, 0.42], color: '#87827b', y: 0.09 }),
  rock({ seed: 22, s: [0.35, 0.12, 0.31], color: '#5c5955', y: 0.32, rotY: 0.6 }),
  rock({ seed: 23, s: [0.24, 0.1, 0.21], color: '#a39d94', y: 0.52, rotY: 1.4 }));
B.slate = () => grp(rock({ seed: 5, s: [0.5, 0.08, 0.36], color: '#5b6872', amp: 0.08, flat: true, y: 0.05 }));
B.mossy = () => {
  const r = rock({ seed: 31, s: [0.46, 0.36, 0.42], color: '#8e887f', amp: 0.18 });
  return grp(r, mossCap(r, 32, 180, 0.3));
};
B.pebbles = () => {
  const g = new THREE.Group(), r = rng(41);
  const spots = [[-0.2, -0.12], [0.08, -0.2], [0.26, 0.02], [-0.06, 0.12], [0.16, 0.2], [-0.3, 0.14], [0.0, -0.02]];
  spots.forEach(([x, z], i) => g.add(rock({
    seed: 50 + i, s: [0.09 + r() * 0.05, 0.06 + r() * 0.02, 0.08 + r() * 0.03],
    color: ['#f4f1ea', '#e6e0d4', '#d7d3cc'][i % 3], pos: [x, z], rotY: r() * 3, rough: 0.5,
  })));
  return g;
};

/* ---------- plants ---------- */
function leafGeo({ len = 0.4, width = 0.05, lift = 0.6, droop = 0.3, fold = 0.35, base = '#6a9', tip = '#9c6', segs = 10, cup = 0 }) {
  const pos = [], col = [], idx = [], cb = new THREE.Color(base), ct = new THREE.Color(tip);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = t * len, y = (Math.sin(t * Math.PI / 2) * lift - t * t * droop) * len;
    const w = width * Math.min(1, 0.35 + t * 5) * (1 - t * 0.92);
    const c = cb.clone().lerp(ct, Math.pow(t, 1.5));
    pos.push(x, y + w * cup, -w, x, y + w * fold, 0, x, y + w * cup, w);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    if (i) { const a = (i - 1) * 3, b = i * 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.65 });
function leaf(opts, rotY, y = 0, tilt = 0) {
  const m = mesh(leafGeo(opts), leafMat, [0, y, 0]);
  m.rotation.set(0, rotY, tilt);
  return m;
}

function airPlant(base, tip, seed) {
  const g = new THREE.Group(), r = rng(seed);
  const n = 24;
  for (let i = 0; i < n; i++) {
    g.add(leaf({ len: 0.3 + r() * 0.2, width: 0.028 + r() * 0.012, lift: 0.2 + r() * 1.6, droop: 0.2 + r() * 0.5, base, tip, fold: 0.5 },
      (i / n) * Math.PI * 2 + r() * 0.3, 0.03));
  }
  g.add(mesh(GEO.sph, std(base, { roughness: 0.7 }), [0, 0.04, 0], [0.06, 0.05, 0.06]));
  return g;
}
B.airplant = () => airPlant('#86ab80', '#cfe3ad', 81);
B.blush = () => airPlant('#7f9f62', '#dc4a3c', 82);
B.moss = () => {
  const r = rng(61), n = 220;
  const im = new THREE.InstancedMesh(GEO.lo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), n);
  const greens = ['#4f6e2c', '#5f8436', '#709a3f', '#86ad4c', '#9cbf5c', '#46612a'].map(c => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = Math.cos(a) * 0.46 * d, z = Math.sin(a) * 0.34 * d;
    const s = 0.04 + r() * 0.05 * (1 - d * 0.5);
    v.set(x, (1 - d * d) * 0.11 + s * 0.3, z);
    sc.set(s, s * 0.75, s);
    m4.compose(v, q, sc);
    im.setMatrixAt(i, m4);
    im.setColorAt(i, greens[Math.floor(r() * greens.length)]);
  }
  im.castShadow = im.receiveShadow = true;
  return grp(im);
};
B.succulent = () => {
  const g = new THREE.Group();
  const layers = [[0.4, 11, 0.12, 0.35, '#5f8c6c'], [0.32, 9, 0.11, 0.75, '#6fa07c'], [0.23, 7, 0.09, 1.2, '#86b98f'], [0.14, 5, 0.07, 1.8, '#a9d4a8']];
  layers.forEach(([len, n, w, lift, c], li) => {
    for (let i = 0; i < n; i++) g.add(leaf({ len, width: w, lift, droop: 0.05, fold: 0.55, cup: 0.25, base: c, tip: '#e08b9c' }, (i / n) * Math.PI * 2 + li * 0.37, 0.02 + li * 0.015));
  });
  return g;
};
function foliage(g, cx, cy, cz, w, seed) {
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const s = w * (0.35 + r() * 0.3);
    g.add(mesh(GEO.lo, std(r() < 0.5 ? '#3f6b37' : '#4f8445', { roughness: 0.9, flatShading: true }),
      [cx + (r() - 0.5) * w * 1.4, cy + (r() - 0.3) * w * 0.35, cz + (r() - 0.5) * w * 1.1], [s, s * 0.55, s]));
  }
}
B.bonsai = () => {
  const g = new THREE.Group();
  const bark = std('#6b4a32', { roughness: 0.9 });
  const tube = (pts, r) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 8), bark);
  g.add(tube([[0, 0, 0], [-0.06, 0.15, 0.02], [0.05, 0.32, 0], [-0.02, 0.5, -0.02], [0.03, 0.62, 0]], 0.05));
  g.add(mesh(GEO.cone, bark, [0, 0.05, 0], [0.11, 0.12, 0.11]));
  g.add(tube([[0.04, 0.3, 0], [-0.15, 0.38, 0.05], [-0.3, 0.42, 0.06]], 0.025));
  g.add(tube([[0.0, 0.45, 0], [0.18, 0.5, -0.05], [0.3, 0.55, -0.06]], 0.022));
  foliage(g, -0.3, 0.45, 0.06, 0.22, 71);
  foliage(g, 0.3, 0.58, -0.06, 0.2, 72);
  foliage(g, 0.03, 0.7, 0, 0.24, 73);
  g.add(mesh(GEO.sph, std('#5d7f3a', { roughness: 1 }), [0, 0, 0], [0.2, 0.04, 0.18]));
  return g;
};
B.bamboo = () => {
  const g = new THREE.Group();
  const stalk = std('#8fb750', { roughness: 0.45 }), node = std('#5d8a2f', { roughness: 0.5 });
  [[-0.09, 0.02, 0.85], [0.06, -0.05, 1.0], [0.0, 0.1, 0.72]].forEach(([x, z, h], si) => {
    g.add(mesh(GEO.cyl, stalk, [x, h / 2, z], [0.032, h, 0.032]));
    for (let y = 0.14; y < h; y += 0.15) g.add(mesh(GEO.cyl, node, [x, y, z], [0.036, 0.014, 0.036]));
    for (let k = 0; k < 4; k++) {
      const l = leaf({ len: 0.22, width: 0.035, lift: 0.3, droop: 0.6, base: '#5f9a3d', tip: '#86bb58', fold: 0.3 }, si * 2 + k * 1.6, 0);
      l.position.set(x, h - 0.05 - k * 0.12, z);
      g.add(l);
    }
  });
  return g;
};

/* ---------- decor ---------- */
B.lantern = () => {
  const stone = std('#8a857c', { roughness: 0.95, flatShading: true });
  const g = grp(
    mesh(GEO.cyl6, stone, [0, 0.04, 0], [0.22, 0.08, 0.22]),
    mesh(GEO.cyl6, stone, [0, 0.23, 0], [0.07, 0.32, 0.07]),
    mesh(GEO.cyl6, stone, [0, 0.41, 0], [0.18, 0.06, 0.18]),
    mesh(GEO.box, stone, [0, 0.53, 0], [0.22, 0.18, 0.22]),
    mesh(new THREE.ConeGeometry(0.33, 0.16, 6), stone, [0, 0.7, 0], 1, [0, Math.PI / 6, 0]),
    mesh(GEO.sph, stone, [0, 0.8, 0], 0.05),
    mesh(GEO.cone, stone, [0, 0.86, 0], [0.025, 0.06, 0.025]),
  );
  const glow = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb23d', emissiveIntensity: 1.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const w = mesh(new THREE.PlaneGeometry(0.1, 0.09), glow, [Math.sin(a) * 0.111, 0.53, Math.cos(a) * 0.111], 1, [0, a, 0]);
    w.castShadow = false;
    g.add(w);
  }
  const light = new THREE.PointLight('#ffb35c', 1.2, 3, 2);
  light.position.set(0, 0.53, 0);
  g.add(light);
  g.userData.update = t => { const f = 1 + Math.sin(t * 7) * 0.06 + Math.sin(t * 13) * 0.04; light.intensity = 1.2 * f; glow.emissiveIntensity = 1.6 * f; };
  return g;
};
B.bridge = () => {
  const g = new THREE.Group(), red = std('#c8453a', { roughness: 0.55 }), black = std('#2c2420', { roughness: 0.6 });
  const arcY = x => 0.26 * (1 - (x / 0.5) ** 2);
  const N = 16;
  for (let i = 0; i < N; i++) {
    const x = -0.48 + (i + 0.5) * (0.96 / N), slope = Math.atan(-0.26 * 2 * x / 0.25);
    g.add(mesh(GEO.box, red, [x, arcY(x) + 0.02, 0], [0.96 / N - 0.005, 0.025, 0.26], [0, 0, slope]));
  }
  for (const z of [-0.13, 0.13]) {
    const rail = [], beam = [];
    for (let i = 0; i <= 20; i++) { const x = -0.46 + i * 0.046; rail.push(new THREE.Vector3(x, arcY(x) + 0.14, z)); beam.push(new THREE.Vector3(x, arcY(x) + 0.0, z)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 40, 0.012, 6), red));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beam), 40, 0.018, 6), red));
    for (const x of [-0.44, -0.22, 0, 0.22, 0.44]) {
      g.add(mesh(GEO.cyl, red, [x, arcY(x) + 0.075, z], [0.012, 0.15, 0.012]));
      g.add(mesh(GEO.sph, black, [x, arcY(x) + 0.16, z], 0.02));
    }
  }
  for (const x of [-0.5, 0.5]) g.add(rock({ seed: x > 0 ? 91 : 92, s: [0.07, 0.04, 0.16], color: '#8d877d', pos: [x, 0] }));
  return g;
};
function fishMesh(body, spot) {
  const f = grp(
    mesh(GEO.sph, std(body, { roughness: 0.4 }), [0, 0, 0], [0.07, 0.022, 0.03]),
    mesh(new THREE.ConeGeometry(0.03, 0.05, 6), std(body, { roughness: 0.4 }), [-0.08, 0, 0], [1, 1, 0.3], [0, 0, Math.PI / 2]),
  );
  if (spot) f.add(mesh(GEO.sph, std(spot, { roughness: 0.4 }), [0.02, 0.012, 0], [0.025, 0.012, 0.018]));
  return f;
}
B.pond = () => {
  const g = new THREE.Group(), r = rng(101);
  g.add(mesh(new THREE.CircleGeometry(0.46, 48), std('#1e4f63', { roughness: 0.9 }), [0, 0.006, 0], [1, 0.72, 1], [-Math.PI / 2, 0, 0]));
  const water = new THREE.MeshPhysicalMaterial({ color: '#3f8fae', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.72, clearcoat: 1 });
  const wm = mesh(new THREE.CircleGeometry(0.46, 48), water, [0, 0.045, 0], [1, 0.72, 1], [-Math.PI / 2, 0, 0]);
  wm.castShadow = false;
  g.add(wm);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.add(rock({ seed: 110 + i, s: [0.06 + r() * 0.03, 0.04 + r() * 0.03, 0.06 + r() * 0.02], color: ['#8d877d', '#a7a196', '#6f6a62'][i % 3], pos: [Math.cos(a) * 0.48, Math.sin(a) * 0.35], rotY: r() * 3 }));
  }
  const pad = std('#5d9a46', { roughness: 0.6, side: THREE.DoubleSide });
  for (const [x, z, s] of [[0.18, 0.12, 0.08], [-0.2, 0.08, 0.06], [0.05, -0.16, 0.05]]) {
    const p = mesh(new THREE.CircleGeometry(1, 20, 0.4, Math.PI * 1.8), pad, [x, 0.05, z], s, [-Math.PI / 2, 0, r() * 6]);
    p.castShadow = false;
    g.add(p);
  }
  g.add(mesh(GEO.sph, std('#f4b6c6', { roughness: 0.5 }), [0.16, 0.065, 0.1], [0.03, 0.02, 0.03]));
  const koi = [fishMesh('#f08a3c', '#ffffff'), fishMesh('#fbf6ee', '#e0493a')];
  koi.forEach(k => g.add(k));
  g.userData.update = t => {
    koi.forEach((k, i) => {
      const th = t * (0.45 + i * 0.12) + i * Math.PI;
      k.position.set(Math.cos(th) * 0.26, 0.03, Math.sin(th) * 0.17);
      k.rotation.y = -(th + Math.PI / 2) + Math.sin(t * 6 + i) * 0.15;
    });
  };
  return g;
};
B.torii = () => {
  const red = std('#d1462f', { roughness: 0.5 }), black = std('#2c2420', { roughness: 0.5 });
  return grp(
    mesh(GEO.cyl, red, [-0.3, 0.38, 0], [0.035, 0.76, 0.035]),
    mesh(GEO.cyl, red, [0.3, 0.38, 0], [0.035, 0.76, 0.035]),
    mesh(GEO.cyl, black, [-0.3, 0.03, 0], [0.05, 0.06, 0.05]),
    mesh(GEO.cyl, black, [0.3, 0.03, 0], [0.05, 0.06, 0.05]),
    mesh(GEO.box, red, [0, 0.56, 0], [0.82, 0.045, 0.05]),
    mesh(GEO.box, black, [0, 0.66, 0], [0.06, 0.12, 0.03]),
    mesh(GEO.box, red, [0, 0.74, 0], [0.86, 0.045, 0.07]),
    mesh(GEO.box, black, [0, 0.79, 0], [1.0, 0.05, 0.1]),
    mesh(GEO.box, black, [-0.5, 0.81, 0], [0.12, 0.04, 0.1], [0, 0, 0.25]),
    mesh(GEO.box, black, [0.5, 0.81, 0], [0.12, 0.04, 0.1], [0, 0, -0.25]),
  );
};
B.shell = () => {
  const geo = new THREE.SphereGeometry(1, 48, 16, Math.PI * 0.45, Math.PI * 1.1, 0, Math.PI / 2);
  const p = geo.attributes.position, cols = [], c1 = new THREE.Color('#fff1e6'), c2 = new THREE.Color('#e6a690');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + Math.sin(a * 22) * 0.035 * (1 - y);
    p.setXYZ(i, x * k, y, z * k);
    const c = c1.clone().lerp(c2, Math.max(0, Math.sin(a * 22)) * 0.6 + (1 - y) * 0.3);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return grp(mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }), [0, 0, 0.18], [0.42, 0.16, 0.42]));
};
B.candle = () => {
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcf6b' });
  const flame = mesh(GEO.sph, flameMat, [0, 0.42, 0], [0.03, 0.07, 0.03]);
  flame.castShadow = false;
  const core = mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: '#fff6c8' }), [0, 0.405, 0], [0.015, 0.035, 0.015]);
  core.castShadow = false;
  const light = new THREE.PointLight('#ffb35c', 1.4, 3, 2);
  light.position.set(0, 0.45, 0);
  const g = grp(
    mesh(GEO.cyl, std('#f6ecd8', { roughness: 0.5 }), [0, 0.17, 0], [0.12, 0.34, 0.12]),
    mesh(GEO.cyl, std('#3a2a20'), [0, 0.36, 0], [0.006, 0.04, 0.006]),
    flame, core, light,
  );
  g.userData.update = t => {
    const f = 1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23) * 0.05;
    flame.scale.set(0.03 / f, 0.07 * f, 0.03 / f);
    flame.rotation.z = Math.sin(t * 5) * 0.08;
    light.intensity = 1.4 * f;
  };
  return g;
};

/* ---------- animals (face +x) ---------- */
function eye(g, x, y, z, r = 0.05, outward = [1, 0, 0]) {
  g.add(mesh(GEO.sph, std('#ffffff', { roughness: 0.3 }), [x, y, z], r));
  const p = mesh(GEO.sph, std('#151515', { roughness: 0.2 }), [x + outward[0] * r * 0.55, y + outward[1] * r * 0.55, z + outward[2] * r * 0.55], r * 0.58);
  g.add(p);
  return p;
}
B.frog = () => {
  const g = new THREE.Group(), green = std('#5fae4b', { roughness: 0.45 }), dark = std('#4a8f3d', { roughness: 0.5 });
  g.add(mesh(GEO.sph, green, [0, 0.2, 0], [0.32, 0.22, 0.27]));
  g.add(mesh(GEO.sph, std('#d9efb4', { roughness: 0.6 }), [0.13, 0.15, 0], [0.2, 0.13, 0.19]));
  for (const z of [-0.11, 0.11]) {
    g.add(mesh(GEO.sph, green, [0.17, 0.37, z], 0.08));
    eye(g, 0.21, 0.4, z * 1.1, 0.055, [0.8, 0.1, Math.sign(z) * 0.5]);
    g.add(mesh(GEO.sph, dark, [-0.13, 0.09, z * 1.9], [0.17, 0.08, 0.1]));
    g.add(mesh(GEO.sph, dark, [0.24, 0.03, z * 1.15], [0.07, 0.03, 0.05]));
  }
  g.add(mesh(GEO.sph, std('#f29c9c', { roughness: 0.6 }), [0.27, 0.27, 0.15], 0.02));
  g.add(mesh(GEO.sph, std('#f29c9c', { roughness: 0.6 }), [0.27, 0.27, -0.15], 0.02));
  return g;
};
B.turtle = () => {
  const g = new THREE.Group(), skin = std('#a5b377', { roughness: 0.7 });
  const shell = mesh(new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), std('#6f8a3f', { roughness: 0.55, flatShading: true }), [0, 0.07, 0], [0.38, 0.24, 0.31]);
  g.add(shell);
  g.add(mesh(GEO.cyl, std('#c8b46a', { roughness: 0.6 }), [0, 0.07, 0], [0.39, 0.04, 0.32]));
  g.add(mesh(GEO.sph, skin, [0.42, 0.13, 0], [0.1, 0.08, 0.08]));
  g.add(mesh(GEO.sph, skin, [0.32, 0.09, 0], [0.09, 0.05, 0.06]));
  for (const z of [-0.045, 0.045]) g.add(mesh(GEO.sph, std('#151515'), [0.49, 0.16, z], 0.015));
  const legs = [];
  for (const [x, z] of [[0.22, 0.22], [0.22, -0.22], [-0.22, 0.22], [-0.22, -0.22]]) {
    const l = mesh(GEO.sph, skin, [x, 0.04, z], [0.08, 0.05, 0.07]);
    legs.push(l); g.add(l);
  }
  g.add(mesh(GEO.cone, skin, [-0.42, 0.06, 0], [0.03, 0.08, 0.03], [0, 0, Math.PI / 2]));
  g.userData.update = (t, o) => {
    const walking = o && o.a && o.a.walking;
    legs.forEach((l, i) => { l.position.x = (i < 2 ? 0.22 : -0.22) + (walking ? Math.sin(t * 9 + (i % 2 ? 0 : Math.PI) + (i < 2 ? 0 : Math.PI)) * 0.04 : 0); });
  };
  return g;
};
B.cat = () => {
  const g = new THREE.Group(), fur = std('#eb9649', { roughness: 0.85 }), light = std('#fbd3a6', { roughness: 0.85 });
  const body = mesh(GEO.sph, fur, [-0.05, 0.17, 0], [0.36, 0.18, 0.25]);
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0.27, 0.2, 0.08);
  head.add(mesh(GEO.sph, fur, [0, 0, 0], [0.16, 0.14, 0.16]));
  head.add(mesh(new THREE.ConeGeometry(0.055, 0.1, 4), fur, [0.0, 0.14, 0.08], 1, [0.3, 0, 0]));
  head.add(mesh(new THREE.ConeGeometry(0.055, 0.1, 4), fur, [0.0, 0.14, -0.08], 1, [-0.3, 0, 0]));
  head.add(mesh(GEO.sph, std('#e6847f'), [0.155, -0.01, 0], 0.016));
  for (const z of [-0.06, 0.06]) head.add(mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 10, Math.PI), std('#5a3418'), [0.135, 0.03, z], 1, [0, Math.PI / 2, Math.PI]));
  head.add(mesh(GEO.sph, light, [0.12, -0.05, 0], [0.05, 0.04, 0.07]));
  g.add(head);
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 24, Math.PI * 1.15), fur, [-0.05, 0.05, 0], [1, 0.8, 1], [Math.PI / 2, 0, 1.1]));
  g.add(mesh(GEO.sph, light, [0.22, 0.04, 0.2], [0.07, 0.04, 0.05]));
  for (let i = 0; i < 3; i++) g.add(mesh(GEO.sph, std('#c96f2a', { roughness: 0.85 }), [-0.2 + i * 0.12, 0.3, 0], [0.03, 0.03, 0.2]));
  g.userData.update = t => { const b = Math.sin(t * 1.7) * 0.012; body.scale.y = 0.18 + b; head.position.y = 0.2 + b * 0.6; };
  return g;
};
B.bird = () => {
  const g = new THREE.Group(), brown = std('#9a6b44', { roughness: 0.8 }), dark = std('#6f4a2e', { roughness: 0.8 });
  g.add(mesh(GEO.sph, std('#b98a5e', { roughness: 0.8 }), [0, 0.26, 0], [0.25, 0.17, 0.16], [0, 0, 0.2]));
  g.add(mesh(GEO.sph, std('#efe2cc', { roughness: 0.8 }), [0.06, 0.21, 0], [0.17, 0.11, 0.13]));
  g.add(mesh(GEO.sph, brown, [0.2, 0.42, 0], 0.13));
  g.add(mesh(GEO.sph, dark, [0.18, 0.47, 0], [0.11, 0.07, 0.11]));
  g.add(mesh(GEO.cone, std('#e7a43a', { roughness: 0.5 }), [0.36, 0.42, 0], [0.03, 0.09, 0.03], [0, 0, -Math.PI / 2]));
  for (const z of [-0.085, 0.085]) {
    g.add(mesh(GEO.sph, std('#141414', { roughness: 0.2 }), [0.28, 0.45, z], 0.02));
    g.add(mesh(GEO.sph, dark, [-0.03, 0.29, z * 1.6], [0.18, 0.07, 0.04], [0, 0, 0.25]));
    g.add(mesh(GEO.cyl, std('#c48a4a'), [0.02, 0.06, z * 0.5], [0.008, 0.13, 0.008]));
  }
  g.add(mesh(GEO.box, dark, [-0.3, 0.33, 0], [0.2, 0.02, 0.1], [0, 0, 0.45]));
  return g;
};
B.snail = () => {
  const g = new THREE.Group(), skin = std('#c7b39e', { roughness: 0.4 });
  g.add(mesh(new THREE.CapsuleGeometry(0.065, 0.5, 6, 12), skin, [0.02, 0.06, 0], [1, 1, 1.15], [0, 0, Math.PI / 2]));
  g.add(mesh(GEO.sph, skin, [0.3, 0.12, 0], 0.075));
  for (const z of [-0.04, 0.04]) {
    g.add(mesh(GEO.cyl, skin, [0.33, 0.22, z], [0.012, 0.16, 0.012], [z * 4, 0, -0.3]));
    g.add(mesh(GEO.sph, std('#3a2e26', { roughness: 0.3 }), [0.355, 0.3, z * 1.6], 0.022));
  }
  g.add(mesh(GEO.sph, std('#d48a46', { roughness: 0.35 }), [-0.04, 0.25, 0], [0.2, 0.2, 0.17]));
  const pts = [];
  for (let t = 0.3; t <= 4.4 * Math.PI; t += 0.2) { const r = 0.012 * t; pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  for (const z of [-0.168, 0.168]) g.add(mesh(new THREE.TubeGeometry(curve, 80, 0.008, 5), std('#7a4522', { roughness: 0.5 }), [-0.04, 0.25, z]));
  return g;
};
B.bunny = () => {
  const g = new THREE.Group(), fur = std('#f6f1ea', { roughness: 0.9 }), pink = std('#f4c0c4', { roughness: 0.8 });
  g.add(mesh(GEO.sph, fur, [-0.04, 0.22, 0], [0.28, 0.22, 0.21]));
  g.add(mesh(GEO.sph, fur, [0.22, 0.4, 0], [0.15, 0.13, 0.13]));
  const ears = [];
  for (const z of [-0.055, 0.055]) {
    const ear = new THREE.Group();
    ear.position.set(0.17, 0.5, z);
    ear.rotation.set(z * 3, 0, 0.25);
    ear.add(mesh(new THREE.CapsuleGeometry(0.035, 0.18, 4, 10), fur, [0, 0.12, 0], [1, 1, 0.55]));
    ear.add(mesh(new THREE.CapsuleGeometry(0.018, 0.14, 4, 8), pink, [0.018, 0.12, 0], [1, 1, 0.4]));
    ears.push(ear); g.add(ear);
    g.add(mesh(GEO.sph, std('#2a1d1d', { roughness: 0.2 }), [0.31, 0.44, z * 1.55], 0.022));
    g.add(mesh(GEO.sph, fur, [0.2, 0.04, z * 2.4], [0.13, 0.04, 0.06]));
  }
  g.add(mesh(GEO.sph, pink, [0.37, 0.4, 0], 0.02));
  g.add(mesh(GEO.sph, std('#ffffff', { roughness: 1 }), [-0.32, 0.25, 0], 0.07));
  g.userData.update = t => { const w = Math.max(0, Math.sin(t * 0.9)) ** 30; ears[1].rotation.z = 0.25 - w * 0.5; };
  return g;
};
function wingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0.03, 0.02);
  s.bezierCurveTo(0.16, 0.12, 0.3, 0.38, 0.14, 0.47);
  s.bezierCurveTo(0.02, 0.53, -0.04, 0.32, -0.03, 0.22);
  s.bezierCurveTo(-0.14, 0.32, -0.25, 0.36, -0.21, 0.22);
  s.bezierCurveTo(-0.18, 0.1, -0.06, 0.04, -0.03, 0.02);
  const g = new THREE.ShapeGeometry(s, 18);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position, cols = [], a = new THREE.Color('#ffd27a'), b = new THREE.Color('#e2562a'), e = new THREE.Color('#3a2a20');
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getZ(i)) / 0.48;
    const c = d > 0.8 ? e : a.clone().lerp(b, d);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
B.butterfly = () => {
  const g = new THREE.Group(), dark = std('#3a2a20', { roughness: 0.6 });
  const wmat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 });
  const wgeo = wingGeo();
  const wl = grp(mesh(wgeo, wmat)), wr = grp(mesh(wgeo, wmat, [0, 0, 0], [1, 1, -1]));
  g.add(wl, wr);
  g.add(mesh(new THREE.CapsuleGeometry(0.025, 0.24, 4, 8), dark, [0, 0, 0], 1, [0, 0, Math.PI / 2]));
  g.add(mesh(GEO.sph, dark, [0.16, 0.01, 0], 0.035));
  for (const z of [-0.03, 0.03]) g.add(mesh(GEO.cyl, dark, [0.22, 0.06, z * 1.4], [0.004, 0.14, 0.004], [z * 8, 0, -0.9]));
  g.position.y = 0.03;
  g.userData.update = (t, o) => {
    const rest = o && o.a && o.a.resting;
    const a = rest ? 0.25 + Math.sin(t * 2) * 0.25 : 0.15 + Math.abs(Math.sin(t * 16)) * 1.1;
    wl.rotation.x = -a; wr.rotation.x = a;
  };
  return g;
};

export function buildModel(id) {
  const g = (B[id] || B.river)();
  g.traverse(m => { if (m.isMesh && m.castShadow === undefined) m.castShadow = true; });
  return g;
}

/* ---------- hand tools: origin = where it touches the sand, handle toward +x ---------- */
export function buildTool(kind, n = 5, sp = 0.15) {
  const wood = std('#c9a26b', { roughness: 0.55 }), dark = std('#9c7646', { roughness: 0.6 }), bam = std('#d6c27e', { roughness: 0.5 });
  const g = new THREE.Group();
  const handle = (len, el, y0, mat = wood, r = 0.034) => {
    const h = mesh(GEO.cyl, mat, [Math.cos(el) * len / 2, y0 + Math.sin(el) * len / 2, 0], [r, len, r], [0, 0, -(Math.PI / 2 - el)]);
    g.add(h);
  };
  if (kind === 'rake') {
    const span = (n - 1) * sp + 0.14;
    g.add(mesh(GEO.box, wood, [0, 0.13, 0], [0.09, 0.08, span]));
    for (let k = 0; k < n; k++) g.add(mesh(GEO.cone, dark, [0, 0.05, (k - (n - 1) / 2) * sp], [0.02, 0.1, 0.02], [Math.PI, 0, 0]));
    handle(2.6, 0.9, 0.15);
  } else if (kind === 'stick') {
    g.add(mesh(GEO.cone, dark, [0.02, 0.05, 0], [0.02, 0.1, 0.02], [0, 0, -0.45]));
    handle(1.5, 1.1, 0.06, bam, 0.028);
    for (let i = 1; i < 5; i++) { const d = i * 0.3; g.add(mesh(GEO.cyl, dark, [Math.cos(1.1) * d, 0.06 + Math.sin(1.1) * d, 0], [0.024, 0.012, 0.024], [0, 0, -(Math.PI / 2 - 1.1)])); }
  } else if (kind === 'pour') {
    // a little wooden scoop full of sand, tipped so it pours straight down
    const scoop = new THREE.Group();
    const cup = mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.32, 24, 1, true), std('#b98a52', { roughness: 0.6, side: THREE.DoubleSide }));
    scoop.add(cup);
    scoop.add(mesh(new THREE.CircleGeometry(0.16, 24), std('#9c7646', { roughness: 0.6, side: THREE.DoubleSide }), [0, -0.16, 0], 1, [Math.PI / 2, 0, 0]));
    scoop.add(mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 28), wood, [0, 0.16, 0], 1, [Math.PI / 2, 0, 0]));
    scoop.add(mesh(new THREE.CircleGeometry(0.17, 24), std('#e2d3b4', { roughness: 1 }), [0, 0.1, 0], 1, [-Math.PI / 2, 0, 0]));
    scoop.add(mesh(GEO.cyl, wood, [0, -0.05, -0.42], [0.03, 0.5, 0.03], [Math.PI / 2, 0, 0]));
    scoop.rotation.z = -2.1;
    scoop.position.set(-0.12, 1.32, 0);
    g.add(scoop);
  } else if (kind === 'smooth') {
    g.add(mesh(GEO.box, wood, [0, 0.07, 0], [0.05, 0.14, 0.95]));
    g.add(mesh(GEO.box, dark, [0.04, 0.14, 0], [0.08, 0.03, 0.3]));
    handle(2.2, 0.85, 0.14);
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
  return g;
}

export function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#ececec';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 170; i++) {
    const y = Math.random() * 512, dark = Math.random() < 0.6;
    x.strokeStyle = dark ? `rgba(90,65,40,${0.05 + Math.random() * 0.13})` : `rgba(255,255,255,${0.08 + Math.random() * 0.15})`;
    x.lineWidth = 0.5 + Math.random() * 2.5;
    x.beginPath();
    for (let X = 0; X <= 512; X += 16) {
      const yy = y + Math.sin(X / 70 + i) * 3 + Math.sin(X / 23 + i * 2) * 0.8;
      if (X === 0) x.moveTo(X, yy); else x.lineTo(X, yy);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
