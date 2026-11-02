/* The sand. Every rake stroke is stored as an "op" so the sand can be redrawn
 * (new colour, undo, reload). Strokes are painted into two 1000x1000 canvases:
 *   canvas - the colour of the sand
 *   hc     - a height map (grey 128 = flat, darker = dug in) that the 3D view
 *            uses to press real grooves into the sand surface. */
(function () {
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const R = v => Math.round(v);
  const MAX_AUTO_POINTS = 24000;
  const BASE = 128;

  class Sand {
    constructor() {
      this.S = 1000;
      const mk = () => { const c = document.createElement('canvas'); c.width = c.height = this.S; return c; };
      this.canvas = mk(); this.ctx = this.canvas.getContext('2d');
      this.hc = mk(); this.h = this.hc.getContext('2d');
      this.tex = mk(); this.htex = mk();
      this.ops = [];
      this.cur = null;
      this.dirty = true;
      this.buildHeightBase();
      this.setColor('#e8dcc4');
    }

    setColor(hex) {
      this.hex = hex;
      const c = hexToRgb(hex);
      const lum = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
      const dark = lum < 0.5;
      // the 3D lighting does most of the shading, so these stay subtle
      this.cGroove = css(mix(c, [30, 20, 10], dark ? 0.2 : 0.14));
      this.cShadow = css(mix(c, [40, 25, 10], dark ? 0.35 : 0.22));
      this.cHigh = css(mix(c, [255, 255, 255], dark ? 0.12 : 0.28));
      this.cSlime = css(mix(c, [255, 255, 255], dark ? 0.2 : 0.45));
      this.buildTexture(c);
      this.replay();
    }

    buildTexture(c) {
      const S = this.S, t = this.tex.getContext('2d');
      const img = t.createImageData(S, S), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        let n = (Math.random() - 0.5) * 14;
        const r = Math.random();
        if (r < 0.015) n -= 28; else if (r < 0.026) n += 22;
        d[i] = c[0] + n; d[i + 1] = c[1] + n; d[i + 2] = c[2] + n * 0.9; d[i + 3] = 255;
      }
      t.putImageData(img, 0, 0);
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * S, y = Math.random() * S, r = 80 + Math.random() * 200;
        const g = t.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(60,40,20,0.04)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        t.fillStyle = g;
        t.fillRect(x - r, y - r, r * 2, r * 2);
      }
      this.pattern = this.ctx.createPattern(this.tex, 'no-repeat');
    }

    buildHeightBase() {
      const S = this.S, t = this.htex.getContext('2d');
      const img = t.createImageData(S, S), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = BASE + (Math.random() - 0.5) * 7;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      t.putImageData(img, 0, 0);
      // a few soft lumps so untouched sand isn't perfectly flat
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 120;
        const g = t.createRadialGradient(x, y, 0, x, y, r);
        const up = Math.random() < 0.5;
        g.addColorStop(0, up ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        t.fillStyle = g;
        t.fillRect(x - r, y - r, r * 2, r * 2);
      }
      this.hpattern = this.h.createPattern(this.htex, 'no-repeat');
    }

    /* ---- drawing primitives (paint both colour and height) ---- */
    _groove(build, w) {
      const x = this.ctx, o = w * 0.2;
      x.lineCap = x.lineJoin = 'round';
      x.lineWidth = w;
      x.strokeStyle = this.cHigh; x.save(); x.translate(o, o); build(x); x.stroke(); x.restore();
      x.strokeStyle = this.cShadow; x.save(); x.translate(-o, -o); build(x); x.stroke(); x.restore();
      x.lineWidth = w * 0.55; x.strokeStyle = this.cGroove; build(x); x.stroke();
      // height: "darken" keeps the deepest value, so overlapping strokes never bump up
      const h = this.h;
      h.save();
      h.globalCompositeOperation = 'darken';
      h.lineCap = h.lineJoin = 'round';
      for (const [lw, v] of [[1.45, 108], [1.05, 82], [0.6, 58]]) {
        h.lineWidth = w * lw; h.strokeStyle = `rgb(${v},${v},${v})`; build(h); h.stroke();
      }
      h.restore();
      this.dirty = true;
    }
    _dimple(x, y, r) {
      const c = this.ctx, o = r * 0.35;
      c.fillStyle = this.cHigh; c.beginPath(); c.arc(x + o, y + o, r, 0, 7); c.fill();
      c.fillStyle = this.cShadow; c.beginPath(); c.arc(x - o, y - o, r, 0, 7); c.fill();
      c.fillStyle = this.cGroove; c.beginPath(); c.arc(x, y, r * 0.75, 0, 7); c.fill();
      const h = this.h;
      h.save(); h.globalCompositeOperation = 'darken';
      h.fillStyle = 'rgb(100,100,100)'; h.beginPath(); h.arc(x, y, r * 1.2, 0, 7); h.fill();
      h.fillStyle = 'rgb(70,70,70)'; h.beginPath(); h.arc(x, y, r * 0.7, 0, 7); h.fill();
      h.restore();
      this.dirty = true;
    }
    _level(poly) {
      // flatten the sand under the rake head before new grooves go in
      for (const [c, p] of [[this.ctx, this.pattern], [this.h, this.hpattern]]) {
        c.save(); c.fillStyle = p; c.beginPath();
        poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath(); c.fill(); c.restore();
      }
    }
    _ring(op, i, a0 = 0, a1 = Math.PI * 2) {
      const r = op.r0 + i * op.sp;
      this._groove(c => { c.beginPath(); c.arc(op.x, op.y, r, a0, a1); }, op.w);
    }

    _rakeFrom(op, st, from) {
      const p = op.p, n = op.n, sp = op.sp;
      const half = n > 1 ? ((n - 1) / 2) * sp + sp * 0.55 : op.w * 0.9;
      for (let i = Math.max(1, from); i < p.length / 2; i++) {
        const x0 = p[2 * i - 2], y0 = p[2 * i - 1], x1 = p[2 * i], y1 = p[2 * i + 1];
        let dx = x1 - x0, dy = y1 - y0;
        const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        if (st.dx === undefined) { st.dx = dx; st.dy = dy; }
        else {
          st.dx = st.dx * 0.6 + dx * 0.4; st.dy = st.dy * 0.6 + dy * 0.4;
          const l = Math.hypot(st.dx, st.dy) || 1; st.dx /= l; st.dy /= l;
        }
        const px = -st.dy, py = st.dx, tines = [];
        for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * sp; tines.push([x1 + px * o, y1 + py * o]); }
        const edge = [[x1 + px * half, y1 + py * half], [x1 - px * half, y1 - py * half]];
        if (!st.prev) {
          st.prev = [];
          for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * sp; st.prev.push([x0 + px * o, y0 + py * o]); }
          st.edge = [[x0 + px * half, y0 + py * half], [x0 - px * half, y0 - py * half]];
        }
        this._level([st.edge[0], edge[0], edge[1], st.edge[1]]);
        const prev = st.prev;
        this._groove(c => {
          c.beginPath();
          for (let k = 0; k < n; k++) { c.moveTo(prev[k][0], prev[k][1]); c.lineTo(tines[k][0], tines[k][1]); }
        }, op.w);
        st.prev = tines; st.edge = edge;
      }
    }

    _smoothFrom(op, from) {
      const p = op.p, r = op.r;
      for (const [c, pat] of [[this.ctx, this.pattern], [this.h, this.hpattern]]) {
        c.save();
        c.fillStyle = pat;
        c.globalAlpha = 0.3;
        const dab = (x, y) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
        if (from === 0) dab(p[0], p[1]);
        for (let i = Math.max(1, from); i < p.length / 2; i++) {
          const x0 = p[2 * i - 2], y0 = p[2 * i - 1], x1 = p[2 * i], y1 = p[2 * i + 1];
          const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (r / 4)));
          for (let s = 1; s <= steps; s++) dab(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps);
        }
        c.restore();
      }
      this.dirty = true;
    }

    _lineFrom(op, from) {
      const c = this.ctx, p = op.p;
      c.lineCap = c.lineJoin = 'round';
      for (let i = Math.max(1, from); i < p.length / 2; i++) {
        c.beginPath(); c.moveTo(p[2 * i - 2], p[2 * i - 1]); c.lineTo(p[2 * i], p[2 * i + 1]);
        c.lineWidth = op.w; c.strokeStyle = this.cSlime; c.stroke();
        c.lineWidth = op.w * 0.35; c.strokeStyle = '#fff'; c.globalAlpha = 0.5; c.stroke(); c.globalAlpha = 1;
      }
      this.dirty = true;
    }

    _drawOp(op, st, from) {
      switch (op.t) {
        case 'rake': this._rakeFrom(op, st, from); break;
        case 'smooth': this._smoothFrom(op, from); break;
        case 'line': this._lineFrom(op, from); break;
        case 'dots': for (let i = from; i < op.p.length / 3; i++) this._dimple(op.p[3 * i], op.p[3 * i + 1], op.p[3 * i + 2]); break;
        case 'ring': for (let i = 0; i < op.n; i++) this._ring(op, i); break;
        case 'clear': this._wipe(); break;
      }
    }
    _wipe() {
      this.ctx.drawImage(this.tex, 0, 0);
      this.h.drawImage(this.htex, 0, 0);
      this.dirty = true;
    }

    replay() {
      this._wipe();
      let start = 0;
      for (let i = this.ops.length - 1; i >= 0; i--) if (this.ops[i].t === 'clear') { start = i + 1; break; }
      for (let i = start; i < this.ops.length; i++) this._drawOp(this.ops[i], {}, 0);
      if (this.cur) this.cur.st = {};
    }

    /* ---- user strokes ---- */
    begin(op, x, y) {
      op.p = [R(x), R(y)];
      this.ops.push(op);
      this.cur = { op, st: {} };
      if (op.t === 'smooth') this._smoothFrom(op, 0);
    }
    extend(x, y) {
      const c = this.cur; if (!c) return false;
      const p = c.op.p, lx = p[p.length - 2], ly = p[p.length - 1];
      if (Math.hypot(x - lx, y - ly) < (c.op.t === 'smooth' ? 6 : 5)) return false;
      p.push(R(x), R(y));
      this._drawOp(c.op, c.st, p.length / 2 - 1);
      return true;
    }
    end() {
      const c = this.cur; this.cur = null;
      if (c && c.op.t === 'rake' && c.op.p.length < 4) {
        const i = this.ops.indexOf(c.op);
        if (i >= 0) this.ops.splice(i, 1);
      }
    }

    /* Concentric rings. When animated, each ring is traced around over a few
     * frames and onPos(x, y) reports where the "stick" is. */
    ring(x, y, r0, opts = {}, animate = true, onPos, onDone) {
      const op = { t: 'ring', x: R(x), y: R(y), r0: R(r0), n: opts.n || 5, sp: opts.sp || 17, w: opts.w || 7 };
      this.ops.push(op);
      if (!animate) { this._drawOp(op, {}, 0); return op; }
      const STEPS = 14;
      let i = 0, s = 0;
      const step = () => {
        if (!this.ops.includes(op)) { if (onDone) onDone(); return; }
        const a0 = (s / STEPS) * Math.PI * 2 - Math.PI / 2, a1 = ((s + 1) / STEPS) * Math.PI * 2 - Math.PI / 2;
        this._ring(op, i, a0 - 0.02, a1);
        const r = op.r0 + i * op.sp;
        if (onPos) onPos(op.x + Math.cos(a1) * r, op.y + Math.sin(a1) * r);
        if (++s >= STEPS) { s = 0; i++; }
        if (i < op.n) requestAnimationFrame(step); else if (onDone) onDone();
      };
      step();
      return op;
    }

    /* ---- marks left by animals (not part of undo) ---- */
    addDot(x, y, r) {
      let last = this.ops[this.ops.length - 1];
      if (!last || last.t !== 'dots' || !last.auto) { last = { t: 'dots', auto: true, p: [] }; this.ops.push(last); }
      last.p.push(R(x), R(y), Math.round(r * 10) / 10);
      this._dimple(x, y, r);
      this._capAuto();
    }
    beginLine(x, y, w) {
      const op = { t: 'line', auto: true, w, p: [R(x), R(y)] };
      this.ops.push(op);
      return op;
    }
    extendLine(op, x, y) {
      const p = op.p;
      if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 4) return;
      p.push(R(x), R(y));
      this._lineFrom(op, p.length / 2 - 1);
      this._capAuto();
    }
    _capAuto() {
      let total = 0;
      for (const o of this.ops) if (o.auto) total += o.p.length;
      while (total > MAX_AUTO_POINTS) {
        const i = this.ops.findIndex(o => o.auto);
        if (i < 0) break;
        total -= this.ops[i].p.length;
        this.ops.splice(i, 1);
      }
    }

    /* ---- history ---- */
    undo() {
      for (let i = this.ops.length - 1; i >= 0; i--) {
        if (!this.ops[i].auto && this.ops[i] !== (this.cur && this.cur.op)) {
          this.ops.splice(i, 1);
          this.replay();
          return true;
        }
      }
      return false;
    }
    clear(animate = true) {
      this.ops.push({ t: 'clear' });
      if (!animate) { this.replay(); return; }
      const S = this.S; let x = 0;
      const step = () => {
        const nx = Math.min(S, x + 55), w = nx - x + 1;
        this.ctx.drawImage(this.tex, x, 0, w, S, x, 0, w, S);
        this.h.drawImage(this.htex, x, 0, w, S, x, 0, w, S);
        this.dirty = true;
        x = nx;
        if (x < S) requestAnimationFrame(step); else this.replay();
      };
      step();
    }
    reset() { this.ops = []; this.cur = null; this.replay(); }
    load(ops) { this.ops = Array.isArray(ops) ? ops : []; this.replay(); }
    liveOps() {
      let start = 0;
      for (let i = this.ops.length - 1; i >= 0; i--) if (this.ops[i].t === 'clear') { start = i + 1; break; }
      return this.ops.slice(start);
    }
  }

  window.Sand = Sand;
})();
