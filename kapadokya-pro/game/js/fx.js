// Efektler PRO: havuzlu parçacıklar, yıldız yağmuru, gökyüzü ismi + avatar, tören portalı.
import { THREE as T } from './three-loader.js';
import { rand, clamp, easeOutBack } from './util.js';

export class Particles {
  constructor(scene, max) {
    this.max = max; this.i = 0; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.grav = new Float32Array(max); this.fade = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -9999;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 3));
    this.pts = new T.Points(g, new T.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    this.pts.frustumCulled = false; scene.add(this.pts); this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, c, life, grav, fade) {
    const i = this.i; this.i = (i + 1) % this.max; const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = c.r; this.col[k + 1] = c.g; this.col[k + 2] = c.b; this.life[i] = life; this.grav[i] = grav; this.fade[i] = fade;
  }
  burst(p, color, count, speed) {
    for (let n = 0; n < count; n++) { const th = rand(0, 6.283), ph = Math.acos(rand(-1, 1)), s = speed * rand(0.35, 1); this.emit(p.x, p.y, p.z, Math.sin(ph) * Math.cos(th) * s, Math.abs(Math.cos(ph)) * s + 2, Math.sin(ph) * Math.sin(th) * s, color, rand(0.8, 1.5), 6, 0.35); }
  }
  fountain(p, color, count) {
    for (let n = 0; n < count; n++) this.emit(p.x + rand(-1, 1), p.y, p.z + rand(-1, 1), rand(-3, 3), rand(8, 18), rand(-3, 3), color, rand(1, 1.8), 9, 0.4);
  }
  confetti(count) {
    const c = new T.Color();
    for (let n = 0; n < count; n++) { c.setHSL(Math.random(), 0.92, 0.62); this.emit(rand(-26, 26), rand(28, 46), rand(-16, 18), rand(-2.5, 2.5), rand(-7, -3), rand(-2.5, 2.5), c, 6.5, 0.45, 0.92); }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue; const k = i * 3; this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[k + 1] = -9999; this.col[k] = this.col[k + 1] = this.col[k + 2] = 0; continue; }
      this.vel[k + 1] -= this.grav[i] * dt; this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const f = Math.pow(this.fade[i], dt); this.col[k] *= f; this.col[k + 1] *= f; this.col[k + 2] *= f;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

export class Meteors {
  constructor(scene, G) {
    this.G = G; this.list = []; this.timer = 0; this.until = 0; const geo = new T.CylinderGeometry(0.22, 0.01, 9, 5);
    for (let i = 0; i < 48; i++) { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; scene.add(m); this.list.push({ m, life: 0, v: new T.Vector3() }); }
  }
  start(secs) { this.until = secs; this.timer = 0; }
  spawn() {
    const o = this.list.find((x) => x.life <= 0); if (!o) return;
    o.life = 2.6; o.v.set(rand(-48, -26), -62, rand(-5, 5)); o.m.position.set(rand(-40, 115), 110, rand(-135, -45)); o.m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), o.v.clone().normalize());
    o.m.material.color.copy(this.G.pal[Math.floor(rand(0, 3))]).lerp(new T.Color(0xffffff), 0.5); o.m.visible = true;
  }
  update(dt) {
    if (this.until > 0) { this.until -= dt; this.timer -= dt; while (this.timer <= 0) { this.timer += 0.12; this.spawn(); } }
    for (const o of this.list) { if (o.life <= 0) continue; o.life -= dt; o.m.position.addScaledVector(o.v, dt); if (o.life <= 0) o.m.visible = false; }
  }
}

export class SkyShow {
  constructor(scene, G) {
    this.scene = scene; this.G = G; this.queue = []; this.cur = null; this.cv = document.createElement('canvas'); this.cv.width = 1024; this.cv.height = 256;
  }
  show(item) { if (this.queue.length < 4) this.queue.push(item); }
  textPoints(text) {
    const x = this.cv.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, 1024, 256); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    text = text.toLocaleUpperCase('tr-TR'); let size = 215; do { x.font = 'bold ' + size + 'px "Segoe UI",Arial,sans-serif'; size -= 8; } while (x.measureText(text).width > 965 && size > 46);
    x.fillText(text, 512, 132); const d = x.getImageData(0, 0, 1024, 256).data; let step = 5, pts = [];
    for (;;) { pts = []; for (let py = 0; py < 256; py += step) for (let px = 0; px < 1024; px += step) if (d[(py * 1024 + px) * 4 + 3] > 128) pts.push(px, py); if (pts.length / 2 <= 4800 || step > 12) break; step++; }
    return pts;
  }
  makeAvatar(url, nick, color) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const initial = () => { x.fillStyle = '#' + color.getHexString(); x.fillRect(0, 0, 256, 256); x.fillStyle = '#fff'; x.font = 'bold 150px "Segoe UI",Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((nick || '?').slice(0, 1).toLocaleUpperCase('tr-TR'), 128, 142); tex.needsUpdate = true; };
    initial();
    if (url) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { x.clearRect(0, 0, 256, 256); x.save(); x.beginPath(); x.arc(128, 128, 126, 0, 7); x.clip(); x.drawImage(img, 0, 0, 256, 256); x.restore(); tex.needsUpdate = true; }; img.onerror = () => {}; img.src = '/avatar?u=' + encodeURIComponent(url); }
    return tex;
  }
  start(item) {
    const W = 46, H = 11.5, BY = 66, Z = -60, raw = this.textPoints(item.nick), n = raw.length / 2;
    const target = new Float32Array(n * 3), startp = new Float32Array(n * 3), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { target[i * 3] = (raw[i * 2] - 512) / 1024 * W; target[i * 3 + 1] = BY + (128 - raw[i * 2 + 1]) / 256 * H; target[i * 3 + 2] = Z + rand(-0.3, 0.3); startp[i * 3] = rand(-65, 65); startp[i * 3 + 1] = rand(32, 95); startp[i * 3 + 2] = Z + rand(-30, 20); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ color: item.color, size: Math.max(3, 4.4 * (this.G.W / 1080)), sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; this.scene.add(pts);
    const tex = this.makeAvatar(item.avatar, item.nick, item.color);
    const disc = new T.Mesh(new T.CircleGeometry(5.8, 44), new T.MeshBasicMaterial({ map: tex, transparent: true, fog: false })); disc.position.set(0, BY + 17, Z);
    const ring = new T.Mesh(new T.TorusGeometry(6.1, 0.32, 8, 56), new T.MeshBasicMaterial({ color: item.color, blending: T.AdditiveBlending, transparent: true, fog: false })); ring.position.copy(disc.position);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: tex, color: item.color, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); glow.scale.set(20, 20, 1); glow.position.copy(disc.position);
    this.scene.add(disc); this.scene.add(ring); this.scene.add(glow);
    this.cur = { pts, geo, mat, pos, target, startp, n, disc, ring, glow, tex, t: 0, dur: 15 };
  }
  stop() { const c = this.cur; if (!c) return; this.scene.remove(c.pts, c.disc, c.ring, c.glow); c.geo.dispose(); c.mat.dispose(); c.tex.dispose(); c.disc.material.dispose(); c.ring.material.dispose(); this.cur = null; }
  update(dt) {
    if (!this.cur && this.queue.length) this.start(this.queue.shift());
    const c = this.cur; if (!c) return; c.t += dt;
    const k = clamp(c.t / 2.2, 0, 1), e = 1 - Math.pow(1 - k, 3);
    if (k < 1 || c.t < c.dur) { for (let i = 0; i < c.n * 3; i++) c.pos[i] = c.startp[i] + (c.target[i] - c.startp[i]) * e; for (let i = 1; i < c.n * 3; i += 3) c.pos[i] += Math.sin(c.t * 1.6 + i) * 0.09; c.geo.attributes.position.needsUpdate = true; }
    const fade = clamp((c.dur - c.t) / 2, 0, 1); c.mat.opacity = fade * (0.82 + 0.18 * Math.sin(c.t * 9)); c.disc.material.opacity = fade; c.ring.material.opacity = fade; c.glow.material.opacity = fade * 0.35; c.ring.rotation.z += dt;
    c.disc.scale.setScalar(easeOutBack(clamp(c.t / 0.8, 0, 1)) || 0.001);
    if (c.t >= c.dur) this.stop();
  }
  get center() { return this.G.skyCenter; }
  get active() { return !!this.cur; }
}

export class Ceremony {
  constructor(scene) {
    this.g = new T.Group(); this.g.position.set(0, 36, -34); this.g.visible = false; scene.add(this.g); this.t = 0; this.dur = 0; this.rings = [];
    [15, 11, 7.2].forEach((r) => { const m = new T.Mesh(new T.TorusGeometry(r, 0.5, 10, 64), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false })); this.g.add(m); this.rings.push(m); });
    this.beams = []; const bg = new T.CylinderGeometry(0.55, 0.55, 130, 8, 1, true);
    for (let i = 0; i < 12; i++) { const b = new T.Mesh(bg, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide })); b.position.set((i - 5.5) * 4.6, 22, 42); this.g.add(b); this.beams.push(b); }
  }
  start(secs) { this.t = 0.001; this.dur = secs; this.g.visible = true; }
  update(dt, G) {
    if (this.t <= 0) return; this.t += dt; const p = this.t / this.dur; if (p >= 1) { this.t = 0; this.g.visible = false; return; }
    const grow = easeOutBack(clamp(this.t / 1.5, 0, 1)), fade = clamp((1 - p) * 4, 0, 1);
    this.rings.forEach((r, i) => { r.scale.setScalar(Math.max(0.01, grow)); r.rotation.z = this.t * (i % 2 ? -1 : 1) * 0.85; r.rotation.y = Math.sin(this.t + i) * 0.32; r.material.color.copy(G.pal[i % 3]); r.material.opacity = 0.92 * fade; });
    this.beams.forEach((b, i) => { b.scale.set(1 + 0.4 * Math.sin(this.t * 3 + i), grow, 1); b.material.color.copy(G.pal[(i + 1) % 3]); b.material.opacity = 0.24 * fade * (0.6 + 0.4 * G.beat.pulse); });
  }
}
