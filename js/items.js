/* Zen Garden object library.
 * Every item is a square 100x100 SVG. Animals are drawn facing right
 * (the app mirrors them when they walk left). Gradient ids are made
 * unique per copy by the app, so they can repeat here freely. */
(function () {
  const f = n => +n.toFixed(1);

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const stops = s => s.map(([o, c, a]) =>
    `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
  const rad = (id, s, cx = '35%', cy = '30%', r = '75%') =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(s)}</radialGradient>`;
  const lin = (id, s, x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`;
  const wrap = (body, defs = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;

  // Smooth organic closed shape (Catmull-Rom through jittered ellipse points)
  function blob(cx, cy, rx, ry, seed, jit = 0.08, n = 10) {
    const r = rng(seed), pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * 2 * jit;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
           `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + 'Z';
  }
  function speckle(seed, n, cx, cy, rx, ry, col, op = 0.4) {
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 0.82;
      s += `<circle cx="${f(cx + Math.cos(a) * rx * d)}" cy="${f(cy + Math.sin(a) * ry * d)}" r="${f(0.6 + r() * 1.2)}" fill="${col}" opacity="${f(op * (0.5 + r() * 0.6))}"/>`;
    }
    return s;
  }
  const shine = (cx, cy, rx, ry, rot, op = 0.18) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;

  /* ---------------- Stones ---------------- */
  const river = wrap(
    `<path d="${blob(50, 58, 38, 25, 3, 0.07)}" fill="url(#g)"/>${shine(37, 48, 13, 5, -18, 0.16)}`,
    rad('g', [[0, '#6e7175'], [0.55, '#2f3134'], [1, '#141516']]));

  const granite = wrap(
    `<path d="${blob(50, 57, 33, 28, 7, 0.1)}" fill="url(#g)"/>` +
    speckle(8, 40, 50, 57, 33, 28, '#3f3b36', 0.5) + speckle(9, 22, 50, 57, 33, 28, '#ffffff', 0.5) +
    shine(40, 44, 10, 5, -25, 0.2),
    rad('g', [[0, '#dcd8d1'], [0.6, '#a8a39b'], [1, '#6f6a63']]));

  const quartz = wrap(
    `<path d="${blob(50, 56, 30, 26, 11, 0.06)}" fill="url(#g)"/>` +
    `<path d="M36 50 L47 39 L61 44 L58 59 L42 62Z" fill="#fff" opacity=".17"/>` +
    `<path d="M47 39 L58 59 M36 50 L58 59" stroke="#fff" stroke-width="1" opacity=".3"/>` +
    shine(41, 44, 7, 3.5, -30, 0.45),
    rad('g', [[0, '#fff3f3'], [0.55, '#ecbcc3'], [1, '#c48690']]));

  const amethyst = (() => {
    const r = rng(14); let crystals = '';
    const cols = [['#b892dd', '#8a63b5'], ['#9c74c9', '#6d4a98'], ['#cfb2ec', '#9c7cc4']];
    for (let i = 0; i < 16; i++) {
      const x = 26 + r() * 48, y = 58 + r() * 14, h = 8 + r() * 12, w = 3 + r() * 3;
      const [c1, c2] = cols[Math.floor(r() * 3)];
      crystals += `<polygon points="${f(x - w)},${f(y)} ${f(x)},${f(y - h)} ${f(x)},${f(y + 1)}" fill="${c1}"/>` +
                  `<polygon points="${f(x)},${f(y - h)} ${f(x + w)},${f(y)} ${f(x)},${f(y + 1)}" fill="${c2}"/>`;
    }
    return wrap(
      `<path d="${blob(50, 62, 40, 25, 13, 0.07)}" fill="url(#g)"/>` +
      `<path d="${blob(50, 62, 32, 17, 15, 0.08)}" fill="#3e2557"/>` + crystals +
      shine(36, 52, 6, 2.5, -20, 0.5),
      rad('g', [[0, '#c4bcc4'], [0.7, '#8d8390'], [1, '#625966']]));
  })();

  const cairn = wrap(
    `<path d="${blob(50, 77, 34, 12, 21, 0.06)}" fill="url(#a)"/>${shine(40, 72, 10, 3, -6, 0.18)}` +
    `<path d="${blob(52, 58, 25, 10, 22, 0.07)}" fill="url(#b)"/>${shine(45, 54, 8, 2.5, -6, 0.18)}` +
    `<path d="${blob(48, 41, 16, 8, 23, 0.07)}" fill="url(#c)"/>${shine(44, 38, 5, 2, -6, 0.3)}`,
    rad('a', [[0, '#bcb8b1'], [0.6, '#87827b'], [1, '#55514b']]) +
    rad('b', [[0, '#8f8c88'], [0.6, '#5c5955'], [1, '#33312e']]) +
    rad('c', [[0, '#d8d3cb'], [0.6, '#a39d94'], [1, '#726c65']]));

  const slate = wrap(
    `<path d="${blob(50, 60, 42, 17, 5, 0.05)}" fill="url(#g)"/>` +
    `<path d="${blob(48, 56, 36, 11, 6, 0.05)}" fill="#fff" opacity=".08"/>${shine(36, 54, 12, 3, -4, 0.15)}`,
    rad('g', [[0, '#8e9aa3'], [0.6, '#5b6872'], [1, '#38424a']]));

  const mossy = (() => {
    const stone = blob(50, 60, 36, 27, 31, 0.09);
    const r = rng(32), cols = ['#4f6e2c', '#5f8436', '#709a3f', '#86ad4c', '#9cbf5c'];
    const dots = [];
    for (let i = 0; i < 70; i++) {
      const x = 16 + r() * 68, y = 30 + Math.pow(r(), 1.6) * 26;
      dots.push({ y, s: `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.5 + r() * 4)}" fill="${cols[Math.floor(r() * 5)]}"/>` });
    }
    dots.sort((a, b) => a.y - b.y);
    return wrap(
      `<path d="${stone}" fill="url(#g)"/>` + speckle(33, 20, 50, 66, 32, 18, '#3f3b36', 0.4) +
      `<g clip-path="url(#c)">${dots.map(d => d.s).join('')}</g>`,
      rad('g', [[0, '#c2bdb4'], [0.6, '#8e887f'], [1, '#5a554e']]) + `<clipPath id="c"><path d="${stone}"/></clipPath>`);
  })();

  const pebbles = (() => {
    const r = rng(41), cols = ['url(#a)', 'url(#b)', 'url(#c)'];
    let s = '';
    const spots = [[34, 46], [56, 40], [72, 52], [44, 62], [62, 66], [28, 66], [50, 52]];
    spots.sort((a, b) => a[1] - b[1]).forEach(([x, y], i) => {
      s += `<path d="${blob(x, y, 9 + r() * 4, 7 + r() * 2, 50 + i, 0.1, 8)}" fill="${cols[i % 3]}"/>`;
    });
    return wrap(s,
      rad('a', [[0, '#ffffff'], [1, '#d8d2c8']]) + rad('b', [[0, '#f6f1e8'], [1, '#c9c0b2']]) +
      rad('c', [[0, '#eceae6'], [1, '#b6b2ab']]));
  })();

  /* ---------------- Plants ---------------- */
  function airPlant(base, tip, seed) {
    const r = rng(seed), cx = 50, cy = 60;
    let defs = ''; const leaves = [];
    const n = 19;
    for (let i = 0; i < n; i++) {
      const a = (-90 + (i / (n - 1) - 0.5) * 290 + (r() - 0.5) * 14) * Math.PI / 180;
      const up = Math.sin(a) < 0;
      const L = (up ? 28 : 18) + r() * (up ? 16 : 10);
      const bend = (r() - 0.5) * 0.5 + (Math.cos(a) > 0 ? 0.18 : -0.18);
      const tx = cx + Math.cos(a) * L, ty = cy + Math.sin(a) * L;
      const mx = cx + Math.cos(a + bend) * L * 0.55, my = cy + Math.sin(a + bend) * L * 0.55;
      const w = 2.1 + r() * 1.3, px = -Math.sin(a) * w, py = Math.cos(a) * w;
      const gid = `l${i}`;
      defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${cx}" y1="${cy}" x2="${f(tx)}" y2="${f(ty)}">` +
              `<stop offset="0" stop-color="${base}"/><stop offset=".5" stop-color="${base}"/><stop offset="1" stop-color="${tip}"/></linearGradient>`;
      leaves.push({
        y: ty,
        s: `<path d="M${f(cx + px)} ${f(cy + py)} Q${f(mx + px * 0.6)} ${f(my + py * 0.6)} ${f(tx)} ${f(ty)} ` +
           `Q${f(mx - px * 0.6)} ${f(my - py * 0.6)} ${f(cx - px)} ${f(cy - py)}Z" fill="url(#${gid})"/>`
      });
    }
    leaves.sort((a, b) => a.y - b.y);
    return wrap(leaves.map(l => l.s).join('') + `<ellipse cx="50" cy="61" rx="5.5" ry="3.5" fill="${base}"/>`, defs);
  }

  const moss = (() => {
    const r = rng(61), cols = ['#4f6e2c', '#5f8436', '#709a3f', '#86ad4c', '#9cbf5c'];
    const dots = [];
    for (let i = 0; i < 95; i++) {
      const a = r() * 6.283, d = Math.sqrt(r());
      const x = 50 + Math.cos(a) * 32 * d, y = 60 + Math.sin(a) * 19 * d - (1 - d) * 7;
      dots.push({ y, s: `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.4 + r() * 4.2 * (1 - d * 0.5))}" fill="${cols[Math.floor(r() * 5)]}"/>` });
    }
    for (let i = 0; i < 40; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 0.9;
      dots.push({ y: 999, s: `<circle cx="${f(50 + Math.cos(a) * 30 * d)}" cy="${f(57 + Math.sin(a) * 17 * d)}" r="${f(0.7 + r())}" fill="#cfe59a" opacity=".75"/>` });
    }
    dots.sort((a, b) => a.y - b.y);
    return wrap(`<path d="${blob(50, 61, 34, 21, 62, 0.14, 12)}" fill="#46612a"/>` + dots.map(d => d.s).join(''));
  })();

  const succulent = (() => {
    const layers = [[40, 11, '#5f8c6c', '#a9cbb0'], [31, 9, '#6fa07c', '#c3dfc2'], [21, 7, '#86b98f', '#d6ecd2'], [11, 5, '#a9d4a8', '#eef8e8']];
    let s = '', defs = '';
    layers.forEach(([L, n, c1, c2], li) => {
      defs += lin(`s${li}`, [[0, '#e48d9e'], [0.2, c1], [1, c2]]);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * 360 + li * 17;
        s += `<path d="M0 0 C${f(L * 0.34)} ${f(-L * 0.35)} ${f(L * 0.22)} ${f(-L * 0.86)} 0 ${-L} C${f(-L * 0.22)} ${f(-L * 0.86)} ${f(-L * 0.34)} ${f(-L * 0.35)} 0 0Z" ` +
             `transform="translate(50 52) rotate(${f(ang)})" fill="url(#s${li})" stroke="#4d7356" stroke-width=".6" stroke-opacity=".35"/>`;
      }
    });
    return wrap(s + `<circle cx="50" cy="52" r="3" fill="#eef8e8"/>`, defs);
  })();

  function pad(cx, cy, w, h, seed) {
    const r = rng(seed); let s = '';
    for (let i = 0; i < 14; i++) s += `<circle cx="${f(cx + (r() - 0.5) * w * 1.6)}" cy="${f(cy + (r() - 0.5) * h)}" r="${f(h * 0.5 + r() * h * 0.4)}" fill="#3a6532"/>`;
    for (let i = 0; i < 10; i++) s += `<circle cx="${f(cx + (r() - 0.6) * w * 1.3)}" cy="${f(cy - h * 0.2 - r() * h * 0.3)}" r="${f(h * 0.3 + r() * h * 0.3)}" fill="#578c49"/>`;
    for (let i = 0; i < 6; i++) s += `<circle cx="${f(cx + (r() - 0.7) * w)}" cy="${f(cy - h * 0.35 - r() * h * 0.25)}" r="${f(h * 0.15 + r() * h * 0.2)}" fill="#86b56a"/>`;
    return s;
  }
  const bonsai = wrap(
    `<ellipse cx="51" cy="90" rx="17" ry="4.5" fill="#5d7f3a"/>` +
    `<path d="M38 56 C33 48 35 40 43 33" stroke="#5e412b" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M53 55 C56 45 58 36 55 27" stroke="#5e412b" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M44 90 C46 80 40 74 34 66 C30 60 33 54 38 56 C44 59 48 62 52 56 C56 49 63 44 70 44 L71 47 C64 49 60 55 58 62 C56 70 56 80 58 90Z" fill="url(#t)"/>` +
    pad(28, 50, 15, 9, 71) + pad(73, 42, 14, 9, 72) + pad(44, 32, 13, 8, 73) + pad(56, 23, 12, 8, 74),
    lin('t', [[0, '#7a5638'], [0.5, '#5e412b'], [1, '#4a321f']], 1, 0));

  const bamboo = (() => {
    let s = '';
    const stalks = [[33, 18, 7], [47, 6, 8], [61, 22, 7]];
    const leaf = (x, y, ang, len = 22) =>
      `<path d="M0 0 C${len * 0.3} -3.5 ${len * 0.7} -3.5 ${len} 0 C${len * 0.7} 3.5 ${len * 0.3} 3.5 0 0Z" fill="#6aa043" transform="translate(${x} ${y}) rotate(${ang})"/>` +
      `<path d="M2 0 L${len - 2} 0" stroke="#4f7f2e" stroke-width=".6" transform="translate(${x} ${y}) rotate(${ang})"/>`;
    stalks.forEach(([x, top, w]) => {
      s += `<rect x="${x}" y="${top}" width="${w}" height="${90 - top}" rx="3" fill="url(#b)"/>`;
      for (let y = 90 - 13; y > top + 4; y -= 13) s += `<rect x="${x - 0.6}" y="${y}" width="${w + 1.2}" height="2.2" rx="1" fill="#5d8a2f"/>`;
    });
    s += leaf(40, 26, -30) + leaf(41, 24, -150, 18) + leaf(55, 14, -40) + leaf(55, 30, 20, 18) +
         leaf(68, 34, -20) + leaf(33, 40, -160, 20) + leaf(68, 48, 25, 16) + leaf(47, 10, -120, 16);
    return wrap(s, lin('b', [[0, '#6f9a3b'], [0.4, '#b6d470'], [1, '#5c872f']], 1, 0));
  })();

  /* ---------------- Decor ---------------- */
  const lantern = wrap(
    `<path d="M30 90 L70 90 L64 81 L36 81Z" fill="#8a857d"/>` +
    `<rect x="44" y="61" width="12" height="20" fill="url(#p)"/>` +
    `<path d="M32 61 L68 61 L62 55 L38 55Z" fill="#9c978f"/>` +
    `<rect x="38" y="37" width="24" height="18" fill="url(#p)"/>` +
    `<circle class="glow-halo" cx="50" cy="46" r="11" fill="#ffd27a" opacity=".35"/>` +
    `<rect class="glow" x="45" y="41" width="10" height="10" rx="1" fill="#ffcf6b"/>` +
    `<path d="M21 38 Q33 34 39 23 L61 23 Q67 34 79 38 Z" fill="#8a857d"/>` +
    `<path d="M21 38 L79 38 L77 40 L23 40Z" fill="#6f6b64"/>` +
    `<circle cx="50" cy="18" r="5" fill="#9c978f"/><path d="M47 14 Q50 7 53 14Z" fill="#9c978f"/>` +
    `<circle cx="30" cy="36" r="2.4" fill="#6f9a3f"/><circle cx="33" cy="35" r="1.8" fill="#86ad4c"/><circle cx="66" cy="34" r="2" fill="#6f9a3f"/>`,
    lin('p', [[0, '#b3aea5'], [1, '#8a857d']], 1, 0));

  const bridge = (() => {
    let posts = '';
    for (const t of [0.04, 0.27, 0.5, 0.73, 0.96]) {
      const x = 10 + 80 * t, ry = 58 - 80 * t * (1 - t);
      const t2 = (x - 6) / 88, dy = 70 - 80 * t2 * (1 - t2);
      posts += `<rect x="${f(x - 1.6)}" y="${f(ry)}" width="3.2" height="${f(dy - ry + 1)}" fill="#b23a2e"/>` +
               `<circle cx="${f(x)}" cy="${f(ry - 1.5)}" r="2.4" fill="#2c2420"/>`;
    }
    return wrap(
      `<ellipse cx="9" cy="80" rx="8" ry="3" fill="#8d877d"/><ellipse cx="91" cy="80" rx="8" ry="3" fill="#8d877d"/>` +
      posts +
      `<path d="M10 58 Q50 18 90 58" stroke="#c8453a" stroke-width="3.2" fill="none"/>` +
      `<path d="M6 70 Q50 30 94 70 L94 79 Q50 40 6 79Z" fill="url(#w)"/>` +
      `<path d="M6 70 Q50 30 94 70" stroke="#e46b5d" stroke-width="1.2" fill="none" opacity=".7"/>`,
      lin('w', [[0, '#d24c3f'], [1, '#9f3027']]));
  })();

  const pond = wrap(
    `<ellipse cx="50" cy="55" rx="45" ry="33" fill="url(#r)"/>` +
    `<ellipse cx="50" cy="55" rx="40" ry="28" fill="url(#w)"/>` +
    `<g><animateTransform attributeName="transform" type="rotate" from="0 50 55" to="360 50 55" dur="16s" repeatCount="indefinite"/>` +
      `<g transform="translate(70 55)"><path d="M0 8 C4 5 4 -2 0 -6 L-3.5 -11 L3.5 -11 L0 -6 C-4 -2 -4 5 0 8Z" fill="#f08a3c"/><circle cx="0" cy="2" r="2.2" fill="#fff" opacity=".85"/></g>` +
      `<g transform="translate(30 55) rotate(180)"><path d="M0 8 C4 5 4 -2 0 -6 L-3.5 -11 L3.5 -11 L0 -6 C-4 -2 -4 5 0 8Z" fill="#fbf6ee"/><circle cx="0" cy="3" r="2" fill="#e0493a"/><circle cx="1" cy="-3" r="1.4" fill="#e0493a"/></g>` +
    `</g>` +
    `<circle cx="38" cy="45" r="3" fill="none" stroke="#fff" stroke-width=".8" opacity="0"><animate attributeName="r" values="2;12" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="4s" repeatCount="indefinite"/></circle>` +
    `<ellipse cx="66" cy="68" rx="9" ry="6" fill="#5d9a46"/><path d="M66 68 L75 66 L74 71Z" fill="#3f84a0"/>` +
    `<ellipse cx="30" cy="64" rx="6" ry="4" fill="#6aa850"/>` +
    `<circle cx="63" cy="66" r="2.6" fill="#f4b6c6"/><circle cx="63" cy="66" r="1.1" fill="#ffe28a"/>` +
    `<ellipse cx="38" cy="41" rx="14" ry="4" fill="#fff" opacity=".12"/>`,
    rad('r', [[0, '#a7a196'], [0.85, '#8d877d'], [1, '#6f6a62']], '50%', '40%', '60%') +
    rad('w', [[0, '#7cc0d4'], [0.6, '#3f88a5'], [1, '#2a6280']], '45%', '40%', '65%'));

  const torii = wrap(
    `<rect x="25" y="34" width="7" height="54" fill="url(#p)"/><rect x="68" y="34" width="7" height="54" fill="url(#p)"/>` +
    `<rect x="23.5" y="84" width="10" height="5" fill="#2c2420"/><rect x="66.5" y="84" width="10" height="5" fill="#2c2420"/>` +
    `<rect x="18" y="43" width="64" height="5" fill="#d1462f"/>` +
    `<rect x="47" y="31" width="6" height="12" fill="#2c2420"/>` +
    `<rect x="16" y="28" width="68" height="5" fill="#d1462f"/>` +
    `<path d="M8 20 Q50 29 92 20 L90 28 Q50 34 10 28Z" fill="#2c2420"/>`,
    lin('p', [[0, '#e1593f'], [1, '#b8382a']], 1, 0));

  const shell = (() => {
    let ribs = '';
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (1.08 + i * 0.105);
      ribs += `<path d="M50 80 L${f(50 + Math.cos(a) * 36)} ${f(78 + Math.sin(a) * 46)}" stroke="#d29583" stroke-width="1.3" opacity=".8"/>`;
    }
    return wrap(
      `<path d="M50 82 C34 76 14 56 18 40 C24 24 76 24 82 40 C86 56 66 76 50 82Z" fill="url(#g)"/>` +
      `<g clip-path="url(#c)">${ribs}</g>` +
      `<path d="M41 79 L50 86 L59 79 L54 76 L46 76Z" fill="#e3b19e"/>`,
      rad('g', [[0, '#fff3ea'], [0.7, '#f3c8b5'], [1, '#d99c88']], '50%', '30%', '80%') +
      `<clipPath id="c"><path d="M50 82 C34 76 14 56 18 40 C24 24 76 24 82 40 C86 56 66 76 50 82Z"/></clipPath>`);
  })();

  const candle = wrap(
    `<circle class="glow-halo" cx="50" cy="34" r="16" fill="#ffd27a" opacity=".3"/>` +
    `<rect x="38" y="46" width="24" height="42" rx="4" fill="url(#c)"/>` +
    `<ellipse cx="50" cy="47" rx="12" ry="3.5" fill="#fffaf0"/>` +
    `<path d="M50 47 L50 41" stroke="#3a2a20" stroke-width="1.4"/>` +
    `<g class="flame"><path d="M50 22 C57 32 56 40 50 42 C44 40 43 32 50 22Z" fill="#ffb03b"/>` +
    `<path d="M50 30 C53 35 53 39 50 40.5 C47 39 47 35 50 30Z" fill="#fff2b0"/></g>`,
    lin('c', [[0, '#f3e6cc'], [0.45, '#fffaf0'], [1, '#e2d2b2']], 1, 0));

  /* ---------------- Animals (facing right) ---------------- */
  const frog = wrap(
    `<ellipse cx="33" cy="72" rx="17" ry="10" fill="#4a8f3d"/>` +
    `<path d="M20 70 C20 48 38 36 58 38 C78 40 86 54 84 68 C82 80 66 86 48 86 C32 86 20 80 20 70Z" fill="url(#b)"/>` +
    `<circle cx="38" cy="54" r="3" fill="#3f7d34" opacity=".6"/><circle cx="30" cy="62" r="2.2" fill="#3f7d34" opacity=".6"/><circle cx="46" cy="47" r="2" fill="#3f7d34" opacity=".6"/>` +
    `<ellipse cx="62" cy="72" rx="15" ry="10" fill="#d9efb4"/>` +
    `<circle cx="58" cy="37" r="9" fill="#6fbf5a"/><circle cx="76" cy="41" r="8.5" fill="#6fbf5a"/>` +
    `<g class="eye"><circle cx="59" cy="36" r="5.5" fill="#fff"/><circle cx="60.5" cy="36" r="3.2" fill="#1d2a1a"/><circle cx="61.5" cy="34.8" r="1" fill="#fff"/></g>` +
    `<g class="eye"><circle cx="77" cy="40" r="5" fill="#fff"/><circle cx="78.5" cy="40" r="3" fill="#1d2a1a"/><circle cx="79.4" cy="38.9" r=".9" fill="#fff"/></g>` +
    `<path d="M64 56 Q75 63 85 55" stroke="#2f5f28" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="79" cy="60" r="3" fill="#f29c9c" opacity=".6"/>` +
    `<ellipse cx="25" cy="84" rx="10" ry="3.6" fill="#4a8f3d"/>` +
    `<ellipse cx="57" cy="86" rx="7" ry="3.4" fill="#4a8f3d"/><ellipse cx="73" cy="85" rx="6.5" ry="3.2" fill="#4a8f3d"/>`,
    rad('b', [[0, '#a2dc86'], [0.6, '#5fae4b'], [1, '#3b7d33']], '45%', '35%', '70%'));

  const turtle = wrap(
    `<path d="M14 66 L5 71 L15 71Z" fill="#9aa86a"/>` +
    `<ellipse class="leg" cx="25" cy="74" rx="7" ry="9" fill="#a5b377"/>` +
    `<ellipse class="leg leg2" cx="64" cy="74" rx="7" ry="9" fill="#a5b377"/>` +
    `<path d="M70 62 C78 58 82 50 90 50 C97 50 99 58 96 63 C92 68 82 68 74 68Z" fill="#a5b377"/>` +
    `<g class="eye"><circle cx="91" cy="56" r="2.3" fill="#1d2a1a"/><circle cx="91.7" cy="55.3" r=".7" fill="#fff"/></g>` +
    `<path d="M88 62 Q92 64.5 95.5 61" stroke="#5f6b3e" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    `<path d="M12 66 C14 36 30 24 46 24 C64 24 80 36 80 66 Z" fill="url(#s)"/>` +
    `<path d="M34 35 L46 31 L58 35 L60 47 L46 53 L32 47Z" fill="#fff" fill-opacity=".08" stroke="#3f5222" stroke-width="2" stroke-opacity=".45" stroke-linejoin="round"/>` +
    `<path d="M32 47 L21 60 M60 47 L71 60 M46 53 L46 66 M34 35 L24 43 M58 35 L68 43" stroke="#3f5222" stroke-width="2" stroke-opacity=".45" stroke-linecap="round"/>` +
    `<path d="M10 66 L82 66 C82 70 78 72 74 72 L18 72 C14 72 10 70 10 66Z" fill="#c8b46a"/>` +
    shine(36, 32, 9, 3.5, -20, 0.2),
    rad('s', [[0, '#a9bf70'], [0.6, '#6f8a3f'], [1, '#4c6229']], '40%', '25%', '85%'));

  const cat = wrap(
    `<g class="zzz"><text x="84" y="30" font-size="11" font-family="sans-serif" font-weight="700" fill="#8796a6">z</text>` +
    `<text x="91" y="20" font-size="8" font-family="sans-serif" font-weight="700" fill="#8796a6">z</text></g>` +
    `<g class="breathe">` +
    `<ellipse cx="46" cy="66" rx="34" ry="20" fill="url(#b)"/>` +
    `<path d="M30 49 Q35 57 30 66 M42 46 Q47 55 42 64 M54 47 Q58 55 55 62" stroke="#c96f2a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>` +
    `<path d="M14 70 C12 87 40 91 62 84" stroke="#e08a3c" stroke-width="8" fill="none" stroke-linecap="round"/>` +
    `<path d="M54 86 C58 85 61 84.5 63 84" stroke="#fbd3a6" stroke-width="8" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="66" cy="80" rx="8" ry="4.5" fill="#fbd3a6"/>` +
    `<path d="M62 51 L63 35 L73 46Z" fill="#f3a65a"/><path d="M78 45 L89 35 L88 51Z" fill="#f3a65a"/>` +
    `<path d="M64.5 47 L65 40 L70 45Z" fill="#f7c3b0"/><path d="M80.5 45 L86.5 40 L86 48Z" fill="#f7c3b0"/>` +
    `<circle cx="75" cy="59" r="16" fill="#f3a65a"/>` +
    `<path d="M66 59 Q69 62 72 59 M78 59 Q81 62 84 59" stroke="#5a3418" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M73.5 64 L77 64 L75.2 66.2Z" fill="#e6847f"/>` +
    `<path d="M75 66.5 Q73 68.5 71.5 67.5 M75 66.5 Q77 68.5 78.5 67.5" stroke="#5a3418" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `<path d="M64 65 L55 63 M64 67 L55 68 M86 65 L95 63 M86 67 L95 68" stroke="#fff" stroke-width=".8" opacity=".8"/>` +
    `<circle cx="67" cy="64" r="2.4" fill="#f58b80" opacity=".35"/><circle cx="83" cy="64" r="2.4" fill="#f58b80" opacity=".35"/>` +
    `</g>`,
    rad('b', [[0, '#f9c07d'], [0.7, '#eb9649'], [1, '#d77a32']], '45%', '30%', '80%'));

  const bird = wrap(
    `<path d="M30 56 L5 62 L9 51 Z" fill="#6f4f32"/>` +
    `<path d="M44 72 L42 84 M52 72 L54 84 M38 84 L46 84 M50 84 L58 84" stroke="#c48a4a" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="46" cy="57" rx="24" ry="17" fill="url(#b)"/>` +
    `<ellipse cx="52" cy="65" rx="16" ry="9" fill="#efe2cc"/>` +
    `<path d="M28 50 C38 39 57 43 60 54 C50 63 35 62 28 50Z" fill="#7d5636"/>` +
    `<path d="M36 50 L48 54 M38 55 L50 57" stroke="#5a3b22" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>` +
    `<circle cx="68" cy="42" r="13" fill="#9a6b44"/>` +
    `<path d="M56 39 A13 13 0 0 1 80 37 Q68 33 56 39Z" fill="#6f4a2e"/>` +
    `<ellipse cx="70" cy="48" rx="6.5" ry="4.2" fill="#f4ead8"/>` +
    `<g class="eye"><circle cx="72" cy="40" r="2.7" fill="#1a1410"/><circle cx="72.8" cy="39.2" r=".8" fill="#fff"/></g>` +
    `<path d="M80 39 L91 42.5 L80 46Z" fill="#e7a43a"/>`,
    rad('b', [[0, '#c99a6c'], [0.7, '#8a6240'], [1, '#6e4c30']], '50%', '35%', '75%'));

  const snail = (() => {
    let sp = '';
    for (let t = 0; t <= 4.4 * Math.PI; t += 0.25) {
      const r = 1.4 * t, x = 42 + Math.cos(t) * r, y = 55 + Math.sin(t) * r;
      sp += (t === 0 ? 'M' : 'L') + f(x) + ' ' + f(y);
    }
    return wrap(
      `<path d="M10 82 C20 76 50 77 70 74 C78 61 84 53 90 54 C96 56 95 70 91 78 C87 84 76 86 60 86 L14 86 C10 86 8 84 10 82Z" fill="url(#b)"/>` +
      `<path d="M86 56 L83 40 M91 57 L95 42" stroke="#a8917a" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="83" cy="39" r="3.2" fill="#3a2e26"/><circle cx="95" cy="41" r="3" fill="#3a2e26"/>` +
      `<path d="M85 69 Q89 72 93 68" stroke="#6e5a48" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
      `<circle cx="42" cy="55" r="24" fill="url(#s)"/>` +
      `<path d="${sp}" stroke="#7a4522" stroke-width="2.4" fill="none" opacity=".65" stroke-linecap="round"/>` +
      shine(34, 41, 8, 4, -30, 0.3),
      lin('b', [[0, '#d8c6b2'], [1, '#a38b74']]) +
      rad('s', [[0, '#f3c27e'], [0.6, '#d48a46'], [1, '#a65e2c']], '40%', '35%', '70%'));
  })();

  const bunny = wrap(
    `<circle cx="20" cy="66" r="8" fill="#fffdf9"/>` +
    `<ellipse cx="44" cy="68" rx="26" ry="20" fill="url(#b)"/>` +
    `<ellipse cx="44" cy="86" rx="16" ry="5" fill="#e8ddd2"/>` +
    `<ellipse cx="61" cy="27" rx="5.5" ry="17" fill="#f3ece3" transform="rotate(-14 61 27)"/>` +
    `<ellipse cx="61" cy="28" rx="2.6" ry="12" fill="#f4c0c4" transform="rotate(-14 61 28)"/>` +
    `<g class="ear"><ellipse cx="71" cy="25" rx="5.5" ry="17" fill="#f8f3ec" transform="rotate(8 71 25)"/>` +
    `<ellipse cx="71" cy="26" rx="2.6" ry="12" fill="#f4c0c4" transform="rotate(8 71 26)"/></g>` +
    `<ellipse cx="70" cy="50" rx="16" ry="14" fill="#f8f3ec"/>` +
    `<g class="eye"><circle cx="76" cy="47" r="2.9" fill="#2a1d1d"/><circle cx="77" cy="46" r=".9" fill="#fff"/></g>` +
    `<circle class="nose" cx="85" cy="53" r="2.1" fill="#e8909a"/>` +
    `<path d="M85 55 Q83 58 81 57" stroke="#b48a84" stroke-width="1" fill="none"/>` +
    `<circle cx="76" cy="56" r="3" fill="#f6b6bd" opacity=".5"/>` +
    `<ellipse cx="66" cy="84" rx="6" ry="4" fill="#f3ece3"/>`,
    rad('b', [[0, '#ffffff'], [0.7, '#f1ebe3'], [1, '#d8cdc0']], '45%', '30%', '80%'));

  const butterfly = wrap(
    `<g class="wl"><path d="M49 47 C38 19 11 17 13 35 C15 50 34 54 49 51Z" fill="url(#u)" stroke="#3a2a20" stroke-width="2"/>` +
    `<path d="M49 54 C35 56 21 66 27 78 C33 87 46 74 49 59Z" fill="url(#l)" stroke="#3a2a20" stroke-width="2"/>` +
    `<circle cx="22" cy="31" r="2.6" fill="#fff"/><circle cx="29" cy="25" r="1.8" fill="#fff"/><circle cx="31" cy="72" r="1.8" fill="#fff"/></g>` +
    `<g class="wr"><path d="M51 47 C62 19 89 17 87 35 C85 50 66 54 51 51Z" fill="url(#u)" stroke="#3a2a20" stroke-width="2"/>` +
    `<path d="M51 54 C65 56 79 66 73 78 C67 87 54 74 51 59Z" fill="url(#l)" stroke="#3a2a20" stroke-width="2"/>` +
    `<circle cx="78" cy="31" r="2.6" fill="#fff"/><circle cx="71" cy="25" r="1.8" fill="#fff"/><circle cx="69" cy="72" r="1.8" fill="#fff"/></g>` +
    `<ellipse cx="50" cy="55" rx="3" ry="15" fill="#3a2a20"/><circle cx="50" cy="39" r="3.6" fill="#3a2a20"/>` +
    `<path d="M49 37 Q44 27 40 25 M51 37 Q56 27 60 25" stroke="#3a2a20" stroke-width="1.4" fill="none"/>` +
    `<circle cx="40" cy="25" r="1.6" fill="#3a2a20"/><circle cx="60" cy="25" r="1.6" fill="#3a2a20"/>`,
    rad('u', [[0, '#ffd27a'], [0.6, '#f49a3a'], [1, '#d9562a']], '50%', '60%', '70%') +
    rad('l', [[0, '#ffe2a0'], [1, '#e8743a']], '50%', '30%', '80%'));

  window.ITEMS = [
    { id: 'river',    name: 'River stone',   cat: 'rocks', size: 0.12, svg: river },
    { id: 'granite',  name: 'Granite',       cat: 'rocks', size: 0.11, svg: granite },
    { id: 'quartz',   name: 'Rose quartz',   cat: 'rocks', size: 0.09, svg: quartz },
    { id: 'amethyst', name: 'Amethyst',      cat: 'rocks', size: 0.11, svg: amethyst },
    { id: 'cairn',    name: 'Cairn',         cat: 'rocks', size: 0.12, svg: cairn },
    { id: 'slate',    name: 'Slate',         cat: 'rocks', size: 0.14, svg: slate, flat: true },
    { id: 'mossy',    name: 'Mossy boulder', cat: 'rocks', size: 0.15, svg: mossy },
    { id: 'pebbles',  name: 'Pebbles',       cat: 'rocks', size: 0.11, svg: pebbles, flat: true },

    { id: 'airplant', name: 'Air plant',     cat: 'plants', size: 0.17, svg: airPlant('#86ab80', '#c3dba0', 81) },
    { id: 'blush',    name: 'Blushing air plant', cat: 'plants', size: 0.15, svg: airPlant('#7f9f62', '#dc4a3c', 82) },
    { id: 'moss',     name: 'Moss',          cat: 'plants', size: 0.12, svg: moss, flat: true },
    { id: 'succulent',name: 'Succulent',     cat: 'plants', size: 0.12, svg: succulent },
    { id: 'bonsai',   name: 'Bonsai',        cat: 'plants', size: 0.22, svg: bonsai },
    { id: 'bamboo',   name: 'Bamboo',        cat: 'plants', size: 0.2, svg: bamboo },

    { id: 'lantern',  name: 'Lantern',       cat: 'decor', size: 0.17, svg: lantern },
    { id: 'bridge',   name: 'Bridge',        cat: 'decor', size: 0.3, svg: bridge },
    { id: 'pond',     name: 'Koi pond',      cat: 'decor', size: 0.3, svg: pond, flat: true, sound: 'water' },
    { id: 'torii',    name: 'Torii gate',    cat: 'decor', size: 0.22, svg: torii },
    { id: 'shell',    name: 'Shell',         cat: 'decor', size: 0.07, svg: shell, flat: true },
    { id: 'candle',   name: 'Candle',        cat: 'decor', size: 0.08, svg: candle },

    { id: 'frog',  name: 'Frog',  cat: 'animals', size: 0.09, svg: frog, animal: true, voice: 'frog',
      move: 'hop', hopDist: [0.06, 0.13], hopDur: 0.5, hopHeight: 60, rest: [3, 8], foot: 0.36 },
    { id: 'turtle', name: 'Turtle', cat: 'animals', size: 0.12, svg: turtle, animal: true, voice: 'turtle',
      move: 'wander', speed: 0.018, trail: 'feet', foot: 0.24 },
    { id: 'cat', name: 'Sleepy cat', cat: 'animals', size: 0.15, svg: cat, animal: true, voice: 'cat' },
    { id: 'bird', name: 'Sparrow', cat: 'animals', size: 0.075, svg: bird, animal: true, voice: 'bird',
      move: 'hop', hopDist: [0.02, 0.05], hopDur: 0.22, hopHeight: 35, rest: [0.6, 2.8], foot: 0.34 },
    { id: 'snail', name: 'Snail', cat: 'animals', size: 0.08, svg: snail, animal: true, voice: 'snail',
      move: 'wander', speed: 0.007, trail: 'slime', foot: 0.34 },
    { id: 'bunny', name: 'Bunny', cat: 'animals', size: 0.11, svg: bunny, animal: true, voice: 'bunny',
      move: 'hop', hopDist: [0.05, 0.11], hopDur: 0.45, hopHeight: 50, rest: [2, 7], foot: 0.38 },
    { id: 'butterfly', name: 'Butterfly', cat: 'animals', size: 0.085, svg: butterfly, animal: true, voice: 'butterfly',
      move: 'fly', speed: 0.12, fly: true },
  ];
})();
