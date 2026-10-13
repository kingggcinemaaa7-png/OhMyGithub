// Ses motoru PRO: Web Audio muzik + SFX + Chatterbox TTS (tek saglayici). Chatterbox-only.
// TTS akisi: say() -> sira -> GET /tts?text= -> AudioElement -> ducking -> siradaki.
import { clamp, rand } from './util.js';
const SCALE = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];
const ROOTS = [73.42, 73.42, 77.78, 73.42, 98.0, 73.42, 55.0, 77.78];
const ARP = [0, 2, 4, 2, 5, 4, 2, 1, 0, 3, 4, 6, 5, 4, 2, 3];

class ChatterboxVoice {
  constructor(cfg, duck) {
    this.cfg = cfg; this.duck = duck;
    this.q = []; this.busy = false; this.cache = new Map();
    this.el = null; this.ok = cfg.tts && cfg.tts.enabled && cfg.tts.provider === 'chatterbox';
  }
  urlFor(text) { return '/tts?text=' + encodeURIComponent(text.slice(0, 280)); }
  say(text, high) {
    if (!this.ok || !text) return;
    text = String(text).slice(0, 280);
    if (!high && this.q.length >= 2) return; // tikanmayi onle
    if (high) { this.q.unshift({ text }); try { if (this.el) this.el.pause(); } catch (e) {} this.busy = false; }
    else this.q.push({ text });
    if (this.q.length > 4) this.q.splice(4);
    this.next();
  }
  async next() {
    if (this.busy || !this.q.length) return;
    const { text } = this.q.shift(); this.busy = true;
    try {
      this.duck(true);
      let url = this.cache.get(text);
      if (!url) {
        const r = await fetch(this.urlFor(text));
        if (!r.ok) throw new Error('TTS ' + r.status);
        const blob = await r.blob();
        url = URL.createObjectURL(blob);
        if (this.cache.size > 40) { const k = this.cache.keys().next().value; URL.revokeObjectURL(this.cache.get(k)); this.cache.delete(k); }
        this.cache.set(text, url);
      }
      await this.play(url);
    } catch (e) { /* sessiz gec */ }
    this.duck(false); this.busy = false;
    if (this.q.length) this.next();
  }
  play(url) {
    return new Promise((resolve) => {
      try {
        const a = this.el || (this.el = new Audio());
        a.src = url; a.volume = 1;
        a.onended = () => resolve(); a.onerror = () => resolve();
        const p = a.play(); if (p && p.catch) p.catch(() => resolve());
        setTimeout(resolve, 9000); // guvenlik
      } catch (e) { resolve(); }
    });
  }
}

export class AudioEngine {
  constructor(cfg) {
    this.cfg = cfg; this.ctx = null; this.started = false; this.energy = 0.45; this.mode = 'normal'; this.modeUntil = 0; this.modeStart = 0;
    this.spb = 60 / cfg.music.bpm; this.step = 0; this.next = 0; this.t0 = 0; this.file = null;
    this.voice = null;
  }
  async start() {
    if (this.started) return; this.started = true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.7; this.music.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.gain.value = 0.6; this.sfxG.connect(this.master);
    // TTS ducking icin muzik hattina bagli ses elementi
    this.ttsGain = c.createGain(); this.ttsGain.gain.value = 1.0; this.ttsGain.connect(this.master);
    const len = c.sampleRate; const nb = c.createBuffer(1, len, c.sampleRate); const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = nb;
    if (c.state === 'suspended') { try { await c.resume(); } catch (e) {} }
    this.voice = new ChatterboxVoice(this.cfg, (on) => this.duck(on));
    // SFX hattina bagli TTS elementi ducking ile birlikte calar
    try {
      const r = await fetch('/' + this.cfg.music.file, { method: 'HEAD' });
      if (r.ok) { const a = new Audio('/' + this.cfg.music.file); a.loop = true; c.createMediaElementSource(a).connect(this.music); await a.play(); this.file = a; }
    } catch (e) { this.file = null; }
    if (!this.file) { this.t0 = c.currentTime + 0.15; this.next = this.t0; this.step = 0; this.timer = setInterval(() => this.tick(), 25); }
  }
  beats() {
    if (this.file) return this.file.currentTime / this.spb;
    if (this.ctx && this.t0) return Math.max(0, (this.ctx.currentTime - this.t0) / this.spb);
    return performance.now() / 1000 / this.spb;
  }
  tick() {
    const c = this.ctx; if (!c) return;
    while (this.next < c.currentTime + 0.2) { this.sched(this.step, this.next); this.next += this.spb / 4; this.step++; }
  }
  osc(t, f, dur, type, g, out, f2, lp) {
    const c = this.ctx, o = c.createOscillator(), gn = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.4);
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    let node = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
    node.connect(gn); gn.connect(out || this.music); o.start(t); o.stop(t + dur + 0.05);
  }
  nz(t, dur, freq, g, type, out, sweepTo) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type || 'highpass'; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const gn = c.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(gn); gn.connect(out || this.music); s.start(t); s.stop(t + dur + 0.05);
  }
  kick(t, g = 1) { this.osc(t, 160, 0.4, 'sine', g, this.music, 42); }
  sched(step, t) {
    const s = step % 16, bar = Math.floor(step / 16);
    let e = this.energy;
    if (this.mode !== 'normal' && t >= this.modeUntil) {
      if (this.mode === 'build') { this.mode = 'drop'; this.modeUntil = t + 9; this.modeStart = t; this.nz(t, 1.6, 2500, 0.5, 'highpass'); this.osc(t, 60, 1.2, 'sine', 1, this.music, 38); }
      else this.mode = 'normal';
    }
    if (this.mode === 'build') {
      const u = (t - this.modeStart) / Math.max(0.1, this.modeUntil - this.modeStart);
      if (u < 0.6 ? s % 4 === 0 : u < 0.85 ? s % 2 === 0 : true) this.nz(t, 0.1, 1800 + u * 3000, 0.25 + u * 0.35, 'bandpass');
      return;
    }
    if (this.mode === 'drop') e = 1.2;
    if (s % 4 === 0) this.kick(t, this.mode === 'drop' ? 1.2 : 0.95);
    if (e > 0.15 && (s === 4 || s === 12)) this.nz(t, 0.16, 1500, 0.35, 'bandpass');
    if (e > 0.25 && s % 4 === 2) this.nz(t, 0.07, 7000, 0.18, 'highpass');
    if (e > 0.6 && s % 2 === 1) this.nz(t, 0.03, 9000, 0.07, 'highpass');
    const root = ROOTS[bar % 8];
    if (e > 0.2 && [0, 3, 6, 8, 11, 14].includes(s)) this.osc(t, root, 0.28, 'sawtooth', 0.28, this.music, null, 420);
    if (e > 0.5) { const idx = ARP[(s + bar * 3) % 16]; if ((s + bar) % 3 !== 2) this.osc(t, SCALE[idx], 0.2, 'triangle', 0.1, this.music, null, 2600); }
    if (s === 0 && e > 0.1) for (const m of [1, 1.26, 1.5]) this.osc(t, root * 4 * m, this.spb * 3.5, 'sawtooth', 0.025, this.music, null, 900);
  }
  requestDrop(seconds) {
    if (!this.ctx || this.file) return;
    const t = this.ctx.currentTime; this.mode = 'build'; this.modeStart = t; this.modeUntil = t + seconds;
    this.nz(t, seconds, 300, 0.4, 'highpass', this.music, 7000);
  }
  duck(on) { if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.18 : 0.7, this.ctx.currentTime, 0.12); }
  sfx(name, level = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.sfxG;
    if (name === 'gift') { const n = 2 + Math.min(4, Math.floor(level)); for (let i = 0; i < n; i++) this.osc(t + i * 0.07, 660 * Math.pow(1.26, i), 0.35, 'triangle', 0.25, o); }
    else if (name === 'tier') { [523, 659, 784, 1047].forEach((f, i) => this.osc(t + i * 0.11, f, 0.7, 'square', 0.1, o, null, 3000)); }
    else if (name === 'combo') { for (let i = 0; i < 3; i++) this.osc(t + i * 0.06, 440 * Math.pow(1.5, i) * level, 0.25, 'sawtooth', 0.12, o, null, 2500); }
    else if (name === 'whoosh') this.nz(t, 1.2, 400, 0.4, 'bandpass', o, 5000);
    else if (name === 'star') { for (let i = 0; i < 6; i++) this.osc(t + i * 0.09, rand(1200, 2400), 0.5, 'sine', 0.08, o); }
    else if (name === 'join') this.osc(t, 880, 0.12, 'sine', 0.1, o);
    else if (name === 'boom') { this.osc(t, 90, 1.2, 'sine', 0.9, o, 35); this.nz(t, 1.0, 600, 0.35, 'lowpass', o); }
  }
  say(text, high) { if (this.voice) this.voice.say(text, high); }
}
