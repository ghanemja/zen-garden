/* The sand: a canvas that remembers every rake stroke as an "op" so it can be
 * redrawn when the sand colour changes, undone, and saved. Coordinates are in a
 * fixed 1000x1000 space no matter how big the tray is on screen. */
(function () {
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const R = v => Math.round(v);
  const MAX_AUTO_POINTS = 24000;

  class Sand {
    constructor(canvas) {
      this.S = 1000;
      this.canvas = canvas;
      canvas.width = canvas.height = this.S;
      this.ctx = canvas.getContext('2d');
      this.tex = document.createElement('canvas');
      this.tex.width = this.tex.height = this.S;
      this.ops = [];
      this.cur = null;
      this.setColor('#e8dcc4');
    }

    setColor(hex) {
      this.hex = hex;
      const c = hexToRgb(hex);
      const lum = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
      const dark = lum < 0.5;
      this.cGroove = css(mix(c, [30, 20, 10], dark ? 0.22 : 0.12));
      this.cShadow = css(mix(c, [40, 25, 10], dark ? 0.5 : 0.3));
      this.cHigh = css(mix(c, [255, 255, 255], dark ? 0.22 : 0.5));
      this.cSlime = css(mix(c, [255, 255, 255], dark ? 0.15 : 0.35));
      this.buildTexture(c);
      this.replay();
    }

    buildTexture(c) {
      const S = this.S, t = this.tex.getContext('2d');
      const img = t.createImageData(S, S), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        let n = (Math.random() - 0.5) * 16;
        const r = Math.random();
        if (r < 0.015) n -= 30; else if (r < 0.026) n += 24;
        d[i] = c[0] + n; d[i + 1] = c[1] + n; d[i + 2] = c[2] + n * 0.9; d[i + 3] = 255;
      }
      t.putImageData(img, 0, 0);
      // gentle large-scale unevenness
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * S, y = Math.random() * S, r = 80 + Math.random() * 200;
        const g = t.createRadialGradient(x, y, 0, x, y, r);
        const light = Math.random() < 0.5;
        g.addColorStop(0, light ? 'rgba(255,255,255,0.05)' : 'rgba(60,40,20,0.04)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        t.fillStyle = g;
        t.fillRect(x - r, y - r, r * 2, r * 2);
      }
      this.pattern = this.ctx.createPattern(this.tex, 'no-repeat');
    }

    /* ---- drawing primitives ---- */
    _groove(build, w) {
      const x = this.ctx, o = w * 0.2;
      x.lineCap = x.lineJoin = 'round';
      x.lineWidth = w;
      x.strokeStyle = this.cHigh; x.save(); x.translate(o, o); build(); x.stroke(); x.restore();
      x.strokeStyle = this.cShadow; x.save(); x.translate(-o, -o); build(); x.stroke(); x.restore();
      x.lineWidth = w * 0.55; x.strokeStyle = this.cGroove; build(); x.stroke();
    }
    _dimple(x, y, r) {
      const c = this.ctx, o = r * 0.35;
      c.fillStyle = this.cHigh; c.beginPath(); c.arc(x + o, y + o, r, 0, 7); c.fill();
      c.fillStyle = this.cShadow; c.beginPath(); c.arc(x - o, y - o, r, 0, 7); c.fill();
      c.fillStyle = this.cGroove; c.beginPath(); c.arc(x, y, r * 0.75, 0, 7); c.fill();
    }
    _ring(op, i) {
      const r = op.r0 + i * op.sp;
      this._groove(() => { const c = this.ctx; c.beginPath(); c.arc(op.x, op.y, r, 0, Math.PI * 2); }, op.w);
    }

    _rakeFrom(op, st, from) {
      const p = op.p, n = op.n, sp = op.sp;
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
        if (!st.prev) {
          st.prev = [];
          for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * sp; st.prev.push([x0 + px * o, y0 + py * o]); }
        }
        const prev = st.prev;
        this._groove(() => {
          const c = this.ctx; c.beginPath();
          for (let k = 0; k < n; k++) { c.moveTo(prev[k][0], prev[k][1]); c.lineTo(tines[k][0], tines[k][1]); }
        }, op.w);
        st.prev = tines;
      }
    }

    _smoothFrom(op, from) {
      const c = this.ctx, p = op.p, r = op.r;
      c.save();
      c.fillStyle = this.pattern;
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

    _lineFrom(op, from) {
      const c = this.ctx, p = op.p;
      c.lineCap = c.lineJoin = 'round';
      for (let i = Math.max(1, from); i < p.length / 2; i++) {
        c.beginPath(); c.moveTo(p[2 * i - 2], p[2 * i - 1]); c.lineTo(p[2 * i], p[2 * i + 1]);
        c.lineWidth = op.w; c.strokeStyle = this.cSlime; c.stroke();
        c.lineWidth = op.w * 0.35; c.strokeStyle = this.cHigh; c.stroke();
      }
    }

    _drawOp(op, st, from) {
      switch (op.t) {
        case 'rake': this._rakeFrom(op, st, from); break;
        case 'smooth': this._smoothFrom(op, from); break;
        case 'line': this._lineFrom(op, from); break;
        case 'dots': for (let i = from; i < op.p.length / 3; i++) this._dimple(op.p[3 * i], op.p[3 * i + 1], op.p[3 * i + 2]); break;
        case 'ring': for (let i = 0; i < op.n; i++) this._ring(op, i); break;
        case 'clear': this.ctx.drawImage(this.tex, 0, 0); break;
      }
    }

    replay() {
      this.ctx.drawImage(this.tex, 0, 0);
      let start = 0;
      for (let i = this.ops.length - 1; i >= 0; i--) if (this.ops[i].t === 'clear') { start = i + 1; break; }
      for (let i = start; i < this.ops.length; i++) this._drawOp(this.ops[i], {}, 0);
      if (this.cur) {
        // keep the in-progress stroke's smoothing state consistent
        this.cur.st = {};
      }
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

    ring(x, y, r0, opts = {}, animate = true) {
      const op = { t: 'ring', x: R(x), y: R(y), r0: R(r0), n: opts.n || 5, sp: opts.sp || 17, w: opts.w || 7 };
      this.ops.push(op);
      if (!animate) { this._drawOp(op, {}, 0); return op; }
      let i = 0;
      const step = () => {
        if (!this.ops.includes(op)) return;
        this._ring(op, i++);
        if (i < op.n) setTimeout(step, 70);
      };
      step();
      return op;
    }

    /* ---- marks left by animals (don't count for undo) ---- */
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
        const nx = Math.min(S, x + 55);
        this.ctx.drawImage(this.tex, x, 0, nx - x + 1, S, x, 0, nx - x + 1, S);
        x = nx;
        if (x < S) requestAnimationFrame(step); else this.replay();
      };
      step();
    }
    reset() { this.ops = []; this.cur = null; this.replay(); }
    load(ops) { this.ops = Array.isArray(ops) ? ops : []; this.replay(); }
    // only what's visible: everything after the last clear
    liveOps() {
      let start = 0;
      for (let i = this.ops.length - 1; i >= 0; i--) if (this.ops[i].t === 'clear') { start = i + 1; break; }
      return this.ops.slice(start);
    }
  }

  window.Sand = Sand;
})();
