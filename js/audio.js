/* All sounds are synthesized live with the Web Audio API, so there are no
 * audio files to load. Browsers only allow audio after a click or tap,
 * so Sound.init() is called on the first interaction. */
(function () {
  let ctx = null, master = null, white = null, brown = null, rakeN = null;
  let muted = false;
  const amb = { wind: true, chimes: true, stream: false };
  const ambNodes = {};
  const PENTA = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const rand = (a, b) => a + Math.random() * (b - a);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(comp); comp.connect(ctx.destination);
    white = makeNoise(false); brown = makeNoise(true);
    setupRake();
    for (const k in amb) if (amb[k]) startAmb(k);
  }

  function makeNoise(isBrown) {
    const len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (isBrown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  const loopSrc = buf => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; };
  const filt = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone({ type = 'sine', f, f2, t = 0, dur = 0.2, vol = 0.2, a = 0.005, slide, to = master }) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + (slide || dur));
    const g = gain(0); env(g, now, a, vol, dur);
    o.connect(g); g.connect(to);
    o.start(now); o.stop(now + dur + 0.05);
    return o;
  }
  function burst({ type = 'bandpass', f = 1000, f2, q = 1, t = 0, dur = 0.2, vol = 0.2, a = 0.005, buf, to = master }) {
    const now = ctx.currentTime + t;
    const s = ctx.createBufferSource(); s.buffer = buf || white;
    const b = filt(type, f, q);
    b.frequency.setValueAtTime(f, now);
    if (f2) b.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const g = gain(0); env(g, now, a, vol, dur);
    chain(s, b, g, to);
    s.start(now, Math.random() * 2); s.stop(now + dur + 0.05);
  }

  /* ---- raking: a looping noise bed whose volume follows your hand ---- */
  function setupRake() {
    const s = loopSrc(white), hp = filt('highpass', 500, 0.7), bp = filt('bandpass', 2000, 0.8), g = gain(0);
    const s2 = loopSrc(brown), lp = filt('lowpass', 700, 0.5), g2 = gain(0);
    chain(s, hp, bp, g, master);
    chain(s2, lp, g2, master);
    s.start(); s2.start(ctx.currentTime, 1.1);
    rakeN = { bp, g, g2 };
  }
  function rake(speed, tool) {
    if (!rakeN) return;
    const t = ctx.currentTime, v = Math.min(1, speed / 2.2);
    const base = { rake: 1900, wide: 1500, stick: 2800, smooth: 800 }[tool] || 1800;
    const vol = (tool === 'smooth' ? 0.32 : tool === 'stick' ? 0.2 : 0.3) * (0.25 + v * 0.75);
    rakeN.bp.frequency.setTargetAtTime(base * (0.8 + v * 0.5) + Math.random() * 250, t, 0.03);
    for (const [g, k] of [[rakeN.g, 1], [rakeN.g2, 0.9]]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(vol * k, t, 0.025);
      g.gain.setTargetAtTime(0, t + 0.09, 0.09);
    }
  }
  function rakeStop() {
    if (!rakeN) return;
    const t = ctx.currentTime;
    for (const g of [rakeN.g, rakeN.g2]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.06); }
  }

  /* ---- one-shots ---- */
  function place(item, v = 1) {
    const k = item.sound || item.cat;
    if (k === 'rocks') {
      burst({ type: 'lowpass', f: 1800, dur: 0.09, vol: 0.5 * v });
      tone({ f: 190, f2: 80, dur: 0.18, vol: 0.45 * v });
      tone({ f: 1100 + Math.random() * 600, dur: 0.06, vol: 0.06 * v });
      burst({ f: 3000, q: 0.8, t: 0.02, dur: 0.28, vol: 0.08 * v });
    } else if (k === 'plants') {
      for (let i = 0; i < 3; i++) burst({ f: 3200 + Math.random() * 1500, q: 1.2, t: i * 0.045, dur: 0.14, vol: 0.16 * v });
    } else if (k === 'water') {
      tone({ f: 380, f2: 900, dur: 0.12, vol: 0.25 * v, slide: 0.08 });
      tone({ f: 520, f2: 1200, t: 0.1, dur: 0.1, vol: 0.15 * v, slide: 0.07 });
      burst({ f: 1400, q: 0.6, t: 0.03, dur: 0.4, vol: 0.06 * v });
    } else if (k === 'animals') {
      voice(item.voice, 0.8 * v);
    } else {
      tone({ type: 'triangle', f: 240, f2: 180, dur: 0.16, vol: 0.35 * v });
      burst({ type: 'lowpass', f: 1200, dur: 0.08, vol: 0.35 * v });
      burst({ f: 2600, q: 0.8, t: 0.02, dur: 0.3, vol: 0.07 * v });
    }
  }
  const pick = () => tone({ f: 700, f2: 1050, dur: 0.07, vol: 0.05 });
  const tick = () => tone({ f: 1500, dur: 0.03, vol: 0.04 });
  const remove = () => burst({ f: 2200, f2: 300, q: 1.2, dur: 0.35, vol: 0.25 });
  const undo = () => tone({ f: 900, f2: 600, dur: 0.07, vol: 0.05 });
  const ripple = () => {
    burst({ f: 900, f2: 1800, q: 0.6, a: 0.12, dur: 0.6, vol: 0.14 });
    bell(PENTA[Math.floor(Math.random() * PENTA.length)] * 2, 0.025, 0.1);
  };
  const clear = () => burst({ f: 500, f2: 2600, q: 0.7, a: 0.3, dur: 1.0, vol: 0.3 });

  function bell(f, vol = 0.08, t = 0) {
    const now = ctx.currentTime + t;
    const out = gain(1);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = rand(-0.7, 0.7); chain(out, p, master); }
    else out.connect(master);
    for (const [r, a, d] of [[1, 1, 3.5], [2.76, 0.45, 1.6], [5.4, 0.22, 0.8], [8.93, 0.1, 0.4]]) {
      const o = ctx.createOscillator(); o.frequency.value = f * r;
      const g = gain(0);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol * a, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d);
      o.connect(g); g.connect(out); o.start(now); o.stop(now + d + 0.05);
    }
  }

  /* ---- animal voices ---- */
  function amp(rate, depth = 0.5) {
    const g = gain(1 - depth), o = ctx.createOscillator(), og = gain(depth);
    o.frequency.value = rate; chain(o, og, g.gain); o.start();
    return { g, o };
  }
  const voices = {
    frog(v) {
      for (let i = 0; i < 2; i++) {
        const now = ctx.currentTime + i * 0.15;
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(270, now); o.frequency.linearRampToValueAtTime(190, now + 0.11);
        const bp = filt('bandpass', 1000, 3), m = amp(42, 0.6), g = gain(0);
        env(g, now, 0.008, 0.6 * v, 0.13);
        chain(o, bp, m.g, g, master);
        o.start(now); o.stop(now + 0.18); m.o.stop(now + 0.18);
      }
    },
    bird(v) {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) tone({ f: 3000 + Math.random() * 500, f2: 4700, t: i * 0.11, dur: 0.07, vol: 0.12 * v, slide: 0.05 });
      tone({ f: 4300, f2: 2800, t: n * 0.11 + 0.03, dur: 0.11, vol: 0.1 * v });
    },
    cat(v) {
      const now = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(430, now);
      o.frequency.linearRampToValueAtTime(760, now + 0.22);
      o.frequency.linearRampToValueAtTime(430, now + 0.7);
      const vib = ctx.createOscillator(), vg = gain(10); vib.frequency.value = 6; chain(vib, vg, o.frequency);
      const bp = filt('bandpass', 1100, 2.5), lp = filt('lowpass', 2600), g = gain(0);
      bp.frequency.setValueAtTime(900, now); bp.frequency.linearRampToValueAtTime(1600, now + 0.25); bp.frequency.linearRampToValueAtTime(900, now + 0.7);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.5 * v, now + 0.08);
      g.gain.setValueAtTime(0.5 * v, now + 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      chain(o, bp, lp, g, master);
      o.start(now); vib.start(now); o.stop(now + 0.8); vib.stop(now + 0.8);
      setTimeout(() => voices.purr(v), 700);
    },
    purr(v) {
      const now = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = brown;
      const lp = filt('lowpass', 320), m = amp(26, 0.85), g = gain(0);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.9 * v, now + 0.25);
      g.gain.setValueAtTime(0.9 * v, now + 1.4);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2);
      chain(s, lp, m.g, g, master);
      s.start(now, Math.random()); s.stop(now + 2.05); m.o.stop(now + 2.05);
    },
    turtle(v) {
      tone({ f: 160, f2: 120, dur: 0.25, vol: 0.3 * v, a: 0.03 });
      tone({ f: 200, f2: 150, t: 0.2, dur: 0.22, vol: 0.22 * v, a: 0.03 });
    },
    snail(v) {
      burst({ f: 500, f2: 1400, q: 5, dur: 0.3, vol: 0.3 * v, a: 0.04 });
      tone({ f: 1400, f2: 2100, t: 0.26, dur: 0.05, vol: 0.06 * v });
    },
    bunny(v) {
      for (let i = 0; i < 3; i++) burst({ type: 'highpass', f: 4000, t: i * 0.07, dur: 0.045, vol: 0.09 * v });
      tone({ f: 110, f2: 45, t: 0.26, dur: 0.2, vol: 0.55 * v });
    },
    butterfly(v) {
      [1568, 1760, 2093, 2349, 2637].forEach((fr, i) => tone({ f: fr, t: i * 0.06, dur: 0.45, vol: 0.045 * v }));
    },
  };
  function voice(name, v = 1) { if (voices[name]) voices[name](v); }
  function land(name) {
    if (name === 'bunny') tone({ f: 100, f2: 50, dur: 0.12, vol: 0.12 });
    else if (name === 'frog') { tone({ f: 140, f2: 70, dur: 0.1, vol: 0.1 }); burst({ type: 'lowpass', f: 900, dur: 0.05, vol: 0.08 }); }
    else if (name === 'bird') tone({ f: 2200, dur: 0.02, vol: 0.025 });
  }

  /* ---- ambience ---- */
  let chimeTimer = null;
  function chimeLoop() {
    const n = 1 + Math.floor(Math.random() * 3);
    let t = 0;
    for (let i = 0; i < n; i++) { bell(PENTA[Math.floor(Math.random() * PENTA.length)], 0.045, t); t += rand(0.15, 0.5); }
    chimeTimer = setTimeout(chimeLoop, rand(3500, 9000));
  }
  function startAmb(k) {
    if (!ctx) return;
    stopAmb(k);
    if (k === 'chimes') {
      chimeTimer = setTimeout(chimeLoop, 900);
      ambNodes.chimes = { stop() { clearTimeout(chimeTimer); } };
      return;
    }
    const out = gain(0); out.connect(master);
    const nodes = []; let iv = null;
    if (k === 'wind') {
      const s = loopSrc(brown), lp = filt('lowpass', 420, 0.8), g = gain(0.35);
      chain(s, lp, g, out);
      const l1 = ctx.createOscillator(), l1g = gain(240); l1.frequency.value = 0.07; chain(l1, l1g, lp.frequency);
      const l2 = ctx.createOscillator(), l2g = gain(0.2); l2.frequency.value = 0.11; chain(l2, l2g, g.gain);
      [s, l1, l2].forEach(n => { n.start(); nodes.push(n); });
    } else if (k === 'stream') {
      const s = loopSrc(white), bp = filt('bandpass', 1100, 0.5), g = gain(0.05);
      chain(s, bp, g, out);
      const s2 = loopSrc(brown), lp = filt('lowpass', 600), g2 = gain(0.4);
      chain(s2, lp, g2, out);
      iv = setInterval(() => {
        bp.frequency.setTargetAtTime(rand(700, 1800), ctx.currentTime, 0.15);
        g.gain.setTargetAtTime(rand(0.025, 0.08), ctx.currentTime, 0.1);
      }, 180);
      s.start(); s2.start(ctx.currentTime, 1.3); nodes.push(s, s2);
    }
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    ambNodes[k] = {
      stop() {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        clearInterval(iv);
        setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch (e) { /* already stopped */ } }); out.disconnect(); }, 1600);
      }
    };
  }
  function stopAmb(k) { if (ambNodes[k]) { ambNodes[k].stop(); delete ambNodes[k]; } }

  // Every public call is a no-op until audio has been unlocked, and never throws.
  const safe = fn => (...a) => { if (!ctx) return; try { return fn(...a); } catch (e) { console.warn(e); } };

  window.Sound = {
    init,
    rake: safe(rake), rakeStop: safe(rakeStop),
    place: safe(place), pick: safe(pick), tick: safe(tick), remove: safe(remove),
    undo: safe(undo), ripple: safe(ripple), clear: safe(clear),
    voice: safe(voice), land: safe(land),
    setAmbient(k, on) { amb[k] = on; if (ctx) (on ? startAmb : stopAmb)(k); },
    getAmbient: () => ({ ...amb }),
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05); },
    get muted() { return muted; },
  };
})();
