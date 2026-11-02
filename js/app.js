(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const tray = $('#tray'), canvas = $('#sand'), layer = $('#objects'), bar = $('#objbar');
  const sand = new Sand(canvas);
  const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  const KEY = 'zen-garden-v1';

  const TOOLS = {
    rake:   { kind: 'rake', n: 5, sp: 15, w: 7 },
    wide:   { kind: 'rake', n: 9, sp: 13, w: 6 },
    stick:  { kind: 'rake', n: 1, sp: 0, w: 10 },
    ripple: { kind: 'ripple', n: 5, sp: 17, w: 7 },
    smooth: { kind: 'smooth', r: 48 },
  };
  const SAND_COLORS = [
    ['Classic', '#e8dcc4'], ['White', '#f2eee6'], ['Pearl', '#d4d0c7'],
    ['Rose', '#ecd3c7'], ['Sea glass', '#cfe0d5'], ['Charcoal', '#5a5753'],
  ];
  const FRAMES = {
    birch:  ['Birch', '#ecd3a4', '#cfa970'],
    walnut: ['Walnut', '#86603f', '#563823'],
    ebony:  ['Ebony', '#3a3430', '#1c1917'],
    bamboo: ['Bamboo', '#d8c57c', '#a99245'],
    stone:  ['Stone', '#e6e3dd', '#bdb8af'],
  };

  const state = { tool: 'rake', objects: [], selected: null, roam: true, sandColor: SAND_COLORS[0][1], frame: 'birch' };
  let uid = 1;

  // Each copy of an SVG gets its own gradient/clip ids so copies never clash.
  const uniq = (svg, sfx) => svg.replace(/(id="|url\(#)([\w-]+)/g, (m, p, n) => p + n + '_' + sfx);

  /* ---------------- palette ---------------- */
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
      b.className = 'pal-item' + (item.animal ? ' is-animal' : '');
      b.title = `Drag ${item.name.toLowerCase()} into your garden (or tap to add)`;
      b.innerHTML = `<span class="pal-art">${uniq(item.svg, 'p' + item.id)}</span><span class="pal-name">${item.name}</span>`;
      b.addEventListener('pointerdown', e => startPaletteDrag(e, item));
      b.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Sound.init(); addObject(item.id, ...freeSpot(), { select: true }); }
      });
      grid.appendChild(b);
    });
    pal.appendChild(sec);
  }

  const toNorm = ev => {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
  };
  const toCanvas = ev => { const p = toNorm(ev); return { x: p.x * 1000, y: p.y * 1000 }; };
  const overSand = ev => { const p = toNorm(ev); return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; };

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
        const w = item.size * canvas.getBoundingClientRect().width;
        ghost.style.width = ghost.style.height = w + 'px';
        ghost.innerHTML = uniq(item.svg, 'ghost');
        document.body.appendChild(ghost);
        Sound.pick();
      }
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
      tray.classList.toggle('drop-hover', overSand(ev));
    };
    const done = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      tray.classList.remove('drop-hover');
      if (ghost) ghost.remove();
    };
    const up = ev => {
      const hadGhost = !!ghost;
      done();
      if (!hadGhost) { addObject(item.id, ...freeSpot(), { select: true }); return; }
      if (overSand(ev)) {
        const p = toNorm(ev);
        addObject(item.id, clamp(p.x, 0.03, 0.97), clamp(p.y, 0.03, 0.97), { select: true });
      }
    };
    const cancel = () => done();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  /* ---------------- objects in the garden ---------------- */
  function addObject(id, x, y, opts = {}) {
    const item = ITEM[id];
    if (!item) return null;
    const o = { uid: uid++, id, item, x, y, rot: opts.rot || 0, scale: opts.scale || 1, flip: !!opts.flip, a: null };
    const el = document.createElement('div');
    el.className = `obj c-${item.cat}` + (item.animal ? ` animal a-${id}` : '');
    el.innerHTML = `<div class="obj-inner"><div class="obj-hop"><div class="obj-body">${uniq(item.svg, o.uid)}</div></div></div>`;
    el.style.setProperty('--d', (-Math.random() * 6).toFixed(2) + 's');
    o.el = el; o.inner = $('.obj-inner', el); o.hop = $('.obj-hop', el); o.body = $('.obj-body', el);
    el.addEventListener('pointerdown', e => objPointerDown(e, o));
    el.addEventListener('wheel', e => {
      if (state.selected !== o) return;
      e.preventDefault();
      o.scale = clamp(o.scale * (e.deltaY < 0 ? 1.06 : 0.94), 0.4, 2.5);
      render(o); save();
    }, { passive: false });
    layer.appendChild(el);
    state.objects.push(o);
    render(o);
    if (!opts.silent) {
      Sound.place(item);
      el.classList.add('drop-in');
      setTimeout(() => el.classList.remove('drop-in'), 450);
      hideHint();
    }
    if (opts.select) select(o);
    save();
    return o;
  }

  function render(o) {
    const s = o.el.style;
    s.left = o.x * 100 + '%';
    s.top = o.y * 100 + '%';
    s.width = o.item.size * o.scale * 100 + '%';
    s.zIndex = o.item.fly ? 900 : o.item.flat ? 5 + Math.round(o.y * 4) : 10 + Math.round(o.y * 800);
    o.inner.style.transform = `rotate(${o.rot}deg) scaleX(${o.flip ? -1 : 1})`;
    if (o === state.selected && !o.dragging) placeBar();
  }

  function select(o) {
    if (state.selected) state.selected.el.classList.remove('selected');
    state.selected = o;
    if (o) { o.el.classList.add('selected'); bar.hidden = false; placeBar(); }
    else bar.hidden = true;
  }
  function placeBar() {
    const o = state.selected;
    if (!o) return;
    const h = o.item.size * o.scale;
    let y = o.y + h * 0.5, above = false;
    if (y > 0.86) { y = o.y - h * 0.5; above = true; }
    bar.style.left = clamp(o.x, 0.16, 0.84) * 100 + '%';
    bar.style.top = y * 100 + '%';
    bar.classList.toggle('above', above);
  }

  function objPointerDown(e, o) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    Sound.init();
    if (state.tool === 'ripple') {
      ripples(o.x * 1000, o.y * 1000, o.item.size * o.scale * 1000 * 0.42 + 10);
      return;
    }
    select(o);
    const start = toNorm(e), ox = o.x - start.x, oy = o.y - start.y;
    let moved = false, outside = false;
    const move = ev => {
      const p = toNorm(ev);
      if (!moved) {
        if (Math.hypot(p.x - start.x, p.y - start.y) * canvas.clientWidth < 5) return;
        moved = true; o.dragging = true;
        o.el.classList.add('dragging');
        if (o.a) { o.a.hopping = null; o.hop.style.transform = ''; }
        bar.hidden = true;
        Sound.pick();
      }
      o.x = p.x + ox; o.y = p.y + oy;
      outside = p.x < -0.03 || p.x > 1.03 || p.y < -0.03 || p.y > 1.03;
      o.el.classList.toggle('removing', outside);
      tray.classList.toggle('drop-remove', outside);
      render(o);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      o.dragging = false;
      o.el.classList.remove('dragging');
      tray.classList.remove('drop-remove');
      if (outside) { removeObject(o); return; }
      if (moved) {
        o.x = clamp(o.x, 0.03, 0.97); o.y = clamp(o.y, 0.03, 0.97);
        if (o.a) { o.a.target = null; o.a.trail = null; }
        render(o);
        Sound.place(o.item, 0.5);
        if (state.selected === o) { bar.hidden = false; placeBar(); }
        save();
      } else if (o.item.animal) poke(o);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function removeObject(o) {
    Sound.remove();
    if (state.selected === o) select(null);
    const i = state.objects.indexOf(o);
    if (i >= 0) state.objects.splice(i, 1);
    o.el.classList.add('poof');
    setTimeout(() => o.el.remove(), 280);
    save();
  }

  function poke(o) {
    Sound.voice(o.item.voice);
    o.body.classList.remove('poke');
    void o.body.offsetWidth;
    o.body.classList.add('poke');
    setTimeout(() => o.body.classList.remove('poke'), 700);
    if (o.item.move === 'hop' && o.a && !o.a.hopping) o.a.timer = 0.35;
    if (o.item.move === 'fly' && o.a) { o.a.pause = 0; o.a.target = null; }
  }

  /* selection toolbar */
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  bar.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    const o = state.selected;
    if (!btn || !o) return;
    Sound.init();
    switch (btn.dataset.act) {
      case 'rotl': o.rot -= 15; break;
      case 'rotr': o.rot += 15; break;
      case 'smaller': o.scale = clamp(o.scale / 1.15, 0.4, 2.5); break;
      case 'bigger': o.scale = clamp(o.scale * 1.15, 0.4, 2.5); break;
      case 'flip': o.flip = !o.flip; break;
      case 'delete': removeObject(o); return;
    }
    Sound.tick();
    render(o); save();
  });

  /* ---------------- sand ---------------- */
  let stroke = null;
  function ripples(x, y, r0) {
    const t = TOOLS.ripple;
    sand.ring(x, y, r0, { n: t.n, sp: t.sp, w: t.w });
    Sound.ripple();
    hideHint();
    save();
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    Sound.init();
    select(null);
    const p = toCanvas(e), t = TOOLS[state.tool];
    if (t.kind === 'ripple') { ripples(p.x, p.y, 16); return; }
    canvas.setPointerCapture(e.pointerId);
    stroke = { last: performance.now(), lx: p.x, ly: p.y };
    if (t.kind === 'smooth') sand.begin({ t: 'smooth', r: t.r }, p.x, p.y);
    else sand.begin({ t: 'rake', n: t.n, sp: t.sp, w: t.w }, p.x, p.y);
    hideHint();
  });
  canvas.addEventListener('pointermove', e => {
    if (!stroke) return;
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    for (const ev of (evs.length ? evs : [e])) { const p = toCanvas(ev); sand.extend(p.x, p.y); }
    const p = toCanvas(e), now = performance.now();
    const d = Math.hypot(p.x - stroke.lx, p.y - stroke.ly), dt = Math.max(8, now - stroke.last);
    stroke.lx = p.x; stroke.ly = p.y; stroke.last = now;
    Sound.rake(d / dt, state.tool);
  });
  const endStroke = () => {
    if (!stroke) return;
    stroke = null;
    sand.end();
    Sound.rakeStop();
    save();
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  canvas.addEventListener('lostpointercapture', endStroke);

  /* ---------------- tools & controls ---------------- */
  function setTool(name) {
    state.tool = name;
    tray.dataset.tool = name;
    $$('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === name));
  }
  $$('.tool').forEach(b => b.addEventListener('click', () => { Sound.init(); Sound.tick(); setTool(b.dataset.tool); }));

  const sandSw = $('#sandSwatches');
  SAND_COLORS.forEach(([name, hex]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.title = name + ' sand';
    b.setAttribute('aria-label', name + ' sand');
    b.style.background = hex; b.dataset.hex = hex;
    b.addEventListener('click', () => { Sound.init(); Sound.tick(); setSand(hex); save(); });
    sandSw.appendChild(b);
  });
  function setSand(hex) {
    state.sandColor = hex;
    sand.setColor(hex);
    $$('.swatch', sandSw).forEach(b => b.setAttribute('aria-pressed', b.dataset.hex === hex));
  }

  const frameSw = $('#frameSwatches');
  Object.entries(FRAMES).forEach(([key, [name, c1, c2]]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.title = name + ' frame';
    b.setAttribute('aria-label', name + ' frame');
    b.style.background = `linear-gradient(135deg, ${c1}, ${c2})`; b.dataset.key = key;
    b.addEventListener('click', () => { Sound.init(); Sound.tick(); setFrame(key); save(); });
    frameSw.appendChild(b);
  });
  function setFrame(key) {
    if (!FRAMES[key]) key = 'birch';
    state.frame = key;
    tray.style.setProperty('--wood1', FRAMES[key][1]);
    tray.style.setProperty('--wood2', FRAMES[key][2]);
    tray.classList.toggle('dark-frame', key === 'walnut' || key === 'ebony');
    $$('.swatch', frameSw).forEach(b => b.setAttribute('aria-pressed', b.dataset.key === key));
  }

  $('#undo').addEventListener('click', () => { Sound.init(); if (sand.undo()) { Sound.undo(); save(); } });
  $('#clear').addEventListener('click', () => { Sound.init(); Sound.clear(); sand.clear(); save(); });
  $('#reset').addEventListener('click', () => {
    if (!confirm('Start a new, empty garden? Your current one will be cleared.')) return;
    Sound.init(); Sound.clear();
    select(null);
    state.objects.forEach(o => o.el.remove());
    state.objects = [];
    sand.reset();
    save();
  });
  $('#roam').addEventListener('change', e => {
    state.roam = e.target.checked;
    if (!state.roam) state.objects.forEach(o => { o.el.classList.remove('walking'); if (o.a) { o.a.hopping = null; o.hop.style.transform = ''; } });
    save();
  });

  // sound buttons
  const muteBtn = $('#mute');
  muteBtn.addEventListener('click', () => {
    Sound.init();
    Sound.setMuted(!Sound.muted);
    muteBtn.setAttribute('aria-pressed', Sound.muted);
    muteBtn.title = Sound.muted ? 'Unmute' : 'Mute';
    save();
  });
  $$('[data-amb]').forEach(b => b.addEventListener('click', () => {
    Sound.init();
    const on = b.getAttribute('aria-pressed') !== 'true';
    Sound.setAmbient(b.dataset.amb, on);
    b.setAttribute('aria-pressed', on);
    save();
  }));
  function syncAmbientButtons() {
    const a = Sound.getAmbient();
    $$('[data-amb]').forEach(b => b.setAttribute('aria-pressed', !!a[b.dataset.amb]));
  }

  // keyboard
  window.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('#undo').click(); return; }
    const o = state.selected;
    const keyTools = { 1: 'rake', 2: 'wide', 3: 'stick', 4: 'ripple', 5: 'smooth' };
    if (!o && keyTools[e.key]) { setTool(keyTools[e.key]); return; }
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
    if (changed) { e.preventDefault(); render(o); save(); }
  });

  // first-visit hint
  const hint = $('#hint');
  function hideHint() { if (hint && !hint.classList.contains('gone')) hint.classList.add('gone'); }

  /* ---------------- animals ---------------- */
  let lastT = performance.now(), saveClock = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (state.roam && !document.hidden) {
      for (const o of state.objects) if (o.item.move && !o.dragging) behave(o, dt, now);
      saveClock += dt;
      if (saveClock > 4) { saveClock = 0; save(); }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function behave(o, dt, now) {
    const a = o.a || (o.a = { pause: rand(0.5, 3), timer: rand(1.5, 5), target: null, dist: 0, side: 1 });
    const m = o.item.move;
    if (m === 'wander') wander(o, a, dt);
    else if (m === 'hop') hop(o, a, dt);
    else if (m === 'fly') fly(o, a, dt, now);
  }
  const footPos = o => ({ x: o.x * 1000, y: (o.y + o.item.size * o.scale * o.item.foot) * 1000 });

  function wander(o, a, dt) {
    if (a.pause > 0) {
      a.pause -= dt;
      if (a.walking) { a.walking = false; o.el.classList.remove('walking'); a.trail = null; }
      return;
    }
    if (!a.target) a.target = { x: clamp(o.x + rand(-0.22, 0.22), 0.08, 0.92), y: clamp(o.y + rand(-0.18, 0.18), 0.1, 0.9) };
    const dx = a.target.x - o.x, dy = a.target.y - o.y, d = Math.hypot(dx, dy);
    if (d < 0.004) { a.target = null; a.pause = rand(2, 7); return; }
    if (!a.walking) { a.walking = true; o.el.classList.add('walking'); }
    const step = Math.min(d, o.item.speed * dt);
    o.x += dx / d * step; o.y += dy / d * step;
    if (Math.abs(dx) > 0.003) o.flip = dx < 0;
    render(o);
    const f = footPos(o);
    if (o.item.trail === 'slime') {
      if (!a.trail) a.trail = sand.beginLine(f.x, f.y, 5);
      else sand.extendLine(a.trail, f.x, f.y);
    } else if (o.item.trail === 'feet') {
      a.dist += step;
      if (a.dist > 0.012) {
        a.dist = 0; a.side *= -1;
        const off = 10 * a.side;
        sand.addDot(f.x + (-dy / d) * off, f.y + (dx / d) * off * 0.5, 3.2);
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
      o.hop.style.transform = `translateY(${(-Math.sin(Math.PI * p) * h.height).toFixed(1)}%)`;
      render(o);
      if (p >= 1) {
        a.hopping = null;
        o.hop.style.transform = '';
        const f = footPos(o), s = o.item.size * o.scale * 1000;
        sand.addDot(f.x - s * 0.14, f.y, Math.max(2.5, s * 0.045));
        sand.addDot(f.x + s * 0.14, f.y, Math.max(2.5, s * 0.045));
        Sound.land(o.item.voice);
        a.timer = rand(o.item.rest[0], o.item.rest[1]);
      }
      return;
    }
    a.timer -= dt;
    if (a.timer > 0) return;
    const ang = Math.random() * Math.PI * 2, dist = rand(o.item.hopDist[0], o.item.hopDist[1]);
    const x1 = clamp(o.x + Math.cos(ang) * dist, 0.08, 0.92), y1 = clamp(o.y + Math.sin(ang) * dist * 0.8, 0.1, 0.9);
    if (Math.abs(x1 - o.x) > 0.005) o.flip = x1 < o.x;
    a.hopping = { p: 0, x0: o.x, y0: o.y, x1, y1, dur: o.item.hopDur, height: o.item.hopHeight };
    if (Math.random() < 0.2) Sound.voice(o.item.voice, 0.3);
  }

  function fly(o, a, dt, now) {
    if (a.pause > 0) {
      a.pause -= dt;
      if (!a.resting) { a.resting = true; o.el.classList.add('resting'); }
      return;
    }
    if (a.resting) { a.resting = false; o.el.classList.remove('resting'); }
    if (!a.target) {
      const perches = state.objects.filter(p => p !== o && (p.item.cat === 'plants' || p.id === 'pond'));
      if (perches.length && Math.random() < 0.55) {
        const p = perches[Math.floor(Math.random() * perches.length)];
        a.target = { x: p.x + rand(-0.02, 0.02), y: p.y - p.item.size * p.scale * 0.15, perch: true };
      } else a.target = { x: rand(0.06, 0.94), y: rand(0.06, 0.94) };
    }
    const dx = a.target.x - o.x, dy = a.target.y - o.y, d = Math.hypot(dx, dy);
    if (d < 0.01) { a.pause = a.target.perch ? rand(3, 8) : rand(0.4, 1.8); a.target = null; return; }
    const ang = Math.atan2(dy, dx) + Math.sin(now / 170 + o.uid) * 0.5;
    const step = Math.min(d, o.item.speed * dt);
    o.x += Math.cos(ang) * step; o.y += Math.sin(ang) * step;
    o.rot = ang * 180 / Math.PI + 90;
    render(o);
  }

  /* ---------------- save / load ---------------- */
  let saveT = null;
  function save() { clearTimeout(saveT); saveT = setTimeout(doSave, 400); }
  function doSave() {
    const data = {
      v: 1, sand: state.sandColor, frame: state.frame, roam: state.roam,
      muted: Sound.muted, ambient: Sound.getAmbient(),
      objects: state.objects.map(o => ({ id: o.id, x: +o.x.toFixed(4), y: +o.y.toFixed(4), rot: Math.round(o.rot), scale: +o.scale.toFixed(3), flip: o.flip })),
      ops: sand.liveOps(),
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) {
      try { data.ops = data.ops.filter(op => !op.auto); localStorage.setItem(KEY, JSON.stringify(data)); } catch (e2) { /* storage full or blocked */ }
    }
  }
  // flush any pending save when the tab is closed or hidden
  const flush = () => { if (saveT) { clearTimeout(saveT); saveT = null; doSave(); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
    if (!data || !Array.isArray(data.objects)) { starterGarden(); return; }
    setSand(data.sand || SAND_COLORS[0][1]);
    setFrame(data.frame || 'birch');
    sand.load(data.ops || []);
    data.objects.forEach(o => addObject(o.id, o.x, o.y, { rot: o.rot, scale: o.scale, flip: o.flip, silent: true }));
    state.roam = data.roam !== false;
    $('#roam').checked = state.roam;
    if (data.ambient) for (const k in data.ambient) Sound.setAmbient(k, !!data.ambient[k]);
    if (data.muted) { Sound.setMuted(true); muteBtn.setAttribute('aria-pressed', 'true'); }
    if (hint) hint.classList.add('gone');
  }

  // A first garden inspired by a classic desk zen garden: rings around an
  // air plant on one side, waves on the other.
  function starterGarden() {
    setSand(SAND_COLORS[0][1]);
    setFrame('birch');
    sand.reset();
    const wave = (x0, amp) => {
      sand.begin({ t: 'rake', n: 9, sp: 13, w: 6 }, x0, -80);
      for (let y = -80; y <= 1060; y += 8) sand.extend(x0 + Math.sin(y / 95) * amp, y);
      sand.end();
    };
    wave(660, 34); wave(780, 34); wave(900, 34);
    sand.ring(360, 400, 82, { n: 6, sp: 17, w: 7 }, false);
    [
      ['airplant', 0.36, 0.4], ['river', 0.17, 0.74, { rot: -10 }], ['quartz', 0.82, 0.17],
      ['moss', 0.75, 0.13], ['amethyst', 0.72, 0.84], ['blush', 0.14, 0.15, { scale: 0.8 }],
      ['frog', 0.47, 0.76], ['snail', 0.3, 0.9],
    ].forEach(([id, x, y, o]) => addObject(id, x, y, Object.assign({ silent: true }, o)));
  }

  /* ---------------- save picture ---------------- */
  function loadSvg(svg) {
    return new Promise((res, rej) => {
      const img = new Image();
      const sized = svg.replace('<svg ', '<svg width="400" height="400" ');
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    });
  }
  $('#save').addEventListener('click', async () => {
    Sound.init(); Sound.tick();
    const S = 1400, pad = 70, inner = S - pad * 2;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const [, w1, w2] = FRAMES[state.frame];
    const g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, w1); g.addColorStop(1, w2);
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    x.globalAlpha = 0.07;
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = i % 2 ? '#000' : '#fff';
      x.lineWidth = 1 + Math.random() * 2;
      const yy = Math.random() * S;
      x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(S / 3, yy + rand(-10, 10), S * 2 / 3, yy + rand(-10, 10), S, yy); x.stroke();
    }
    x.globalAlpha = 1;
    x.drawImage(canvas, pad, pad, inner, inner);
    // soft inner shadow where the sand meets the frame
    x.save();
    x.beginPath(); x.rect(pad, pad, inner, inner); x.clip();
    x.shadowColor = 'rgba(70,50,25,0.45)'; x.shadowBlur = 22; x.shadowOffsetX = 6; x.shadowOffsetY = 8;
    x.lineWidth = 40; x.strokeStyle = '#000';
    x.strokeRect(pad - 20, pad - 20, inner + 40, inner + 40);
    x.restore();
    const sorted = [...state.objects].sort((a, b) => (parseInt(a.el.style.zIndex) || 0) - (parseInt(b.el.style.zIndex) || 0));
    for (const o of sorted) {
      try {
        const img = await loadSvg(o.item.svg);
        const size = o.item.size * o.scale * inner;
        x.save();
        x.translate(pad + o.x * inner, pad + o.y * inner);
        x.rotate(o.rot * Math.PI / 180);
        x.scale(o.flip ? -1 : 1, 1);
        x.shadowColor = 'rgba(70,50,25,0.35)';
        x.shadowBlur = 8; x.shadowOffsetX = o.item.fly ? 10 : 4; x.shadowOffsetY = o.item.fly ? 16 : 7;
        x.drawImage(img, -size / 2, -size / 2, size, size);
        x.restore();
      } catch (e) { /* skip an object that fails to render */ }
    }
    c.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-zen-garden.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  });

  setTool('rake');
  load();
  syncAmbientButtons();
})();
