// Sinematik kamera PRO: 8 çekim, öncelik kuyruğu, sarsıntı + FOV kick, güvenli mesafe.
import { THREE as T } from './three-loader.js';
import { damp, rand, pick, clamp } from './util.js';

export class CamDirector {
  constructor(cam, G, dancers) {
    this.cam = cam; this.G = G; this.dancers = dancers; this.q = []; this.cur = null; this.ct = 0;
    this.pos = new T.Vector3(0, 12.5, 39); this.look = new T.Vector3(0, 19, -4); this.tp = new T.Vector3(); this.tl = new T.Vector3();
    this.baseFov = 72; this.fov = 72; cam.position.copy(this.pos);
  }
  push(s, front) {
    s.dur = s.dur || 5;
    if (s.dancer) this.q = this.q.filter((x) => x.dancer !== s.dancer);
    if (front) this.q.unshift(s); else this.q.push(s);
    if (this.q.length > 8) this.q.length = 8;
  }
  idle() {
    const r = Math.random(), ds = this.dancers.list;
    if (r < 0.3) return { type: 'wide', dur: rand(6, 9), idle: true };
    if (r < 0.5 && ds.length) return { type: 'spot', dancer: pick(ds), dur: 4, power: 0.25, idle: true };
    if (r < 0.63) return { type: 'crane', dur: 7, idle: true };
    if (r < 0.75) return { type: 'crowd', dur: 5, idle: true, side: Math.random() < 0.5 ? -1 : 1 };
    if (r < 0.86) return { type: 'dj', dur: 4.5, idle: true };
    return { type: 'orbit', dur: 7, idle: true };
  }
  update(dt) {
    const G = this.G, t = G.t;
    if (this.cur && this.cur.idle && this.q.length && this.ct > 2.4) this.cur = null;
    if (this.cur && this.cur.dancer && this.cur.dancer.dead) this.cur = null;
    if (!this.cur || this.ct >= this.cur.dur) { this.cur = this.q.shift() || this.idle(); this.ct = 0; }
    this.ct += dt;
    const c = this.cur, u = this.ct, tp = this.tp, tl = this.tl; let lamP = 2.4, power = c.power || 0, fovAdd = 0;
    switch (c.type) {
      case 'spot': {
        const d = c.dancer, p = d.group.position, sc = Math.max(0.6, d.group.scale.y), hgt = 2.3 * sc, R = (9.5 - 3 * power) * Math.max(1, sc * 0.8), a = Math.sin(u * (0.6 + power)) * 0.9;
        tl.set(p.x, p.y + hgt, p.z); tp.set(p.x + Math.sin(a) * R, p.y + hgt + 0.6 + Math.sin(u * 1.7) * 0.5, p.z + Math.cos(a) * R); lamP = 3.2; fovAdd = -8 * power; break;
      }
      case 'sky': tl.copy(G.skyCenter); tp.set(Math.sin(u * 0.3) * 4.5, 12.5 + Math.sin(u * 0.4), 37); break;
      case 'dj': tl.set(0, 16.5, -15.5); tp.set(Math.sin(u * 0.5) * 8.5, 16.5 + Math.sin(u * 0.7), 1.5); break;
      case 'crane': { const k = clamp(u / c.dur, 0, 1), e = k * k * (3 - 2 * k); tp.set(Math.sin(u * 0.4) * 3, 3.5 + 28 * e, 34); tl.set(0, 8 + 13 * e, -6); break; }
      case 'crowd': tp.set((c.side || 1) * 11.5, 5.2 + Math.sin(u * 2) * 0.2, 29); tl.set(0, 14.5, -10); break;
      case 'orbit': { const a = Math.sin(u * 0.3) * 0.62; tp.set(Math.sin(a) * 33, 19 + Math.sin(u * 0.5) * 2.2, -4 + Math.cos(a) * 33); tl.set(0, 14.5, -4); break; }
      case 'drop': tp.set(Math.sin(u * 8) * 0.35, 12.5, 33 - u * 1.6); tl.set(0, 18.5, -10); fovAdd = -7; lamP = 4.2; break;
      case 'portal': tp.set(Math.sin(u * 0.4) * 4.2, 8.5, 37); tl.set(0, 36, -24); break;
      default: tp.set(Math.sin(t * 0.07) * 8.5, 12.5 + Math.sin(t * 0.05) * 2, 39 + Math.cos(t * 0.06) * 2); tl.set(Math.sin(t * 0.05) * 3, 19.5, -4);
    }
    tp.z = clamp(tp.z, -8, 44); tp.y = clamp(tp.y, 2.5, 46);
    const P = this.pos, L = this.look;
    P.x = damp(P.x, tp.x, lamP, dt); P.y = damp(P.y, tp.y, lamP, dt); P.z = damp(P.z, tp.z, lamP, dt);
    L.x = damp(L.x, tl.x, 3.6, dt); L.y = damp(L.y, tl.y, 3.6, dt); L.z = damp(L.z, tl.z, 3.6, dt);
    const cam = this.cam; cam.position.copy(P);
    if (G.shake > 0.001) { cam.position.x += (Math.random() - 0.5) * G.shake; cam.position.y += (Math.random() - 0.5) * G.shake; G.shake *= Math.exp(-3 * dt); }
    cam.lookAt(L);
    this.fov = damp(this.fov, this.baseFov + fovAdd - G.beat.pulse * 2 * clamp(G.energy, 0.3, 1.2), 6, dt);
    cam.fov = this.fov; cam.updateProjectionMatrix();
  }
}
