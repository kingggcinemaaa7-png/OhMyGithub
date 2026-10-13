// Dansçılar PRO: 8 stil, yumuşak spawn, rütbe ölçeği, kombo FX, DJ koltuğu.
import { THREE as T } from './three-loader.js';
import { hash, clamp, easeOutBack } from './util.js';

const COLORDER = [3, 2, 4, 1, 5, 0, 6];
export function slotPos(i) { const row = Math.floor(i / 7), c = COLORDER[i % 7]; return new T.Vector3((c - 3) * 3.6 + (row % 2 ? 0.9 : 0), row * 1.7, 6 - row * 2.4); }

const wingShape = new T.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(3.4, 1.5); wingShape.lineTo(2.7, -0.2); wingShape.lineTo(1.2, -1.5); wingShape.lineTo(0, -0.4);
const GEO = {
  torso: new T.CapsuleGeometry(0.5, 0.85, 4, 12), head: new T.SphereGeometry(0.46, 16, 14), arm: new T.CapsuleGeometry(0.16, 1.15, 3, 8), leg: new T.CapsuleGeometry(0.22, 1.15, 3, 8),
  disc: new T.CircleGeometry(2.0, 32), halo: new T.TorusGeometry(0.65, 0.07, 8, 28), headset: new T.TorusGeometry(0.53, 0.07, 6, 18, Math.PI), hat: new T.ConeGeometry(0.42, 0.95, 10),
  aura: new T.SphereGeometry(2.4, 16, 12), wing: new T.ShapeGeometry(wingShape), ring: new T.TorusGeometry(3.3, 0.13, 8, 44), crown: new T.ConeGeometry(0.15, 0.42, 5),
};
const SKIN = new T.MeshStandardMaterial({ color: 0xf2c9a2, roughness: 0.6 });
const WHITE = new T.MeshBasicMaterial({ color: 0xffffff });

function nameLines(ctx, name) {
  const F = (s) => 'bold ' + s + 'px "Segoe UI",Arial,sans-serif';
  ctx.font = F(88); if (ctx.measureText(name).width <= 470) return { lines: [name], size: 88 };
  const sp = name.indexOf(' ', Math.floor(name.length * 0.35));
  const cut = sp > 0 && sp < name.length - 1 ? sp : Math.ceil(name.length / 2);
  const a = name.slice(0, cut).trim(), b = name.slice(cut).trim(); let size = 76;
  ctx.font = F(size); while (size > 38 && (ctx.measureText(a).width > 480 || ctx.measureText(b).width > 480)) { size -= 4; ctx.font = F(size); }
  return { lines: [a, b], size };
}

export class Dancer {
  constructor(G, parent, id, nick, isDj) {
    this.G = G; this.parent = parent; this.id = id; this.nick = nick; this.isDj = !!isDj; this.slot = -1; this.born = G.t; this.pulse = 1; this.dead = false; this.dying = false; this.dyingT = 0;
    const h = hash(id); this.style = this.isDj ? 4 : h % 8; this.phase = (h % 100) / 100 * Math.PI * 2; this.baseScale = 1; this.tier = 0; this.until = Infinity;
    this.color = new T.Color().setHSL((h % 360) / 360, 0.78, 0.56);
    this.bodyMat = new T.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.1 });
    const g = this.group = new T.Group(); this.body = new T.Group(); g.add(this.body);
    const torso = new T.Mesh(GEO.torso, this.bodyMat); torso.position.y = 2.35; torso.castShadow = true; this.body.add(torso);
    this.head = new T.Mesh(GEO.head, SKIN); this.head.position.y = 3.58; this.head.castShadow = true; this.body.add(this.head);
    const limb = (geo, x, y, dy) => { const pv = new T.Group(); pv.position.set(x, y, 0); const m = new T.Mesh(geo, this.bodyMat); m.position.y = dy; m.castShadow = true; pv.add(m); this.body.add(pv); return pv; };
    this.armR = limb(GEO.arm, 0.78, 3.05, -0.72); this.armL = limb(GEO.arm, -0.78, 3.05, -0.72); this.legR = limb(GEO.leg, 0.3, 1.55, -0.78); this.legL = limb(GEO.leg, -0.3, 1.55, -0.78);
    if (this.isDj || h % 3 === 0) { const hs = new T.Mesh(GEO.headset, WHITE); hs.position.y = 3.62; this.body.add(hs); }
    else if (h % 3 === 1) { const ht = new T.Mesh(GEO.hat, this.bodyMat); ht.position.y = 4.4; this.body.add(ht); }
    this.discMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, blending: T.AdditiveBlending, depthWrite: false });
    this.disc = new T.Mesh(GEO.disc, this.discMat); this.disc.rotation.x = -Math.PI / 2; this.disc.position.y = 0.06; g.add(this.disc);
    this.discRing = new T.Mesh(new T.TorusGeometry(2.0, 0.07, 8, 40), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false }));
    this.discRing.rotation.x = Math.PI / 2; this.discRing.position.y = 0.08; g.add(this.discRing);
    this.cv = document.createElement('canvas'); this.cv.width = 512; this.cv.height = 320;
    this.tex = new T.CanvasTexture(this.cv); this.tex.colorSpace = T.SRGBColorSpace; this.tex.anisotropy = 4;
    this.label = new T.Sprite(new T.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false })); this.label.renderOrder = 20;
    this.label.scale.set(5.6, 3.5, 1); this.label.position.y = 5.6; g.add(this.label); this.tf = 1; this.lm = 1; this.labelMul = 1;
    g.scale.setScalar(0.001); parent.add(g);
  }
  setTier(i, tiers) {
    this.tier = i; const td = tiers[i]; this.tierColor = new T.Color(td.color); this.discMat.color.copy(this.tierColor); this.discRing.material.color.copy(this.tierColor); this.tierName = td.name;
    this.baseScale = (this.isDj ? (this.bigDj ? 2.15 : 1.4) : 1) * (1 + 0.06 * i);
    this.label.position.y = 5.4 + (this.isDj ? 0.35 : 0) + i * 0.06; this.tf = 1 + 0.05 * i;
    this.drawLabel(td);
    if (this.halo) { this.body.remove(this.halo); this.halo = null; }
    if (i >= 4) { this.halo = new T.Group(); const r = new T.Mesh(GEO.halo, new T.MeshBasicMaterial({ color: td.color })); r.rotation.x = Math.PI / 2; this.halo.add(r);
      if (i >= 6) for (let k = 0; k < 5; k++) { const c = new T.Mesh(GEO.crown, new T.MeshBasicMaterial({ color: td.color })); const a = k / 5 * Math.PI * 2; c.position.set(Math.cos(a) * 0.62, 0.22, Math.sin(a) * 0.62); this.halo.add(c); }
      this.halo.position.y = 4.42; this.body.add(this.halo); }
  }
  drawLabel(td) {
    const x = this.cv.getContext('2d'); x.clearRect(0, 0, 512, 320);
    let nick = (this.isDj && !this.nick.startsWith('DJ') ? 'DJ ' : '') + this.nick; if (nick.length > 24) nick = nick.slice(0, 23) + '…';
    const { lines, size } = nameLines(x, nick); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const y0 = lines.length === 1 ? 118 : 80, lh = size * 1.02;
    lines.forEach((ln, i) => { x.font = 'bold ' + size + 'px "Segoe UI",Arial,sans-serif'; x.lineWidth = 13; x.strokeStyle = '#100722'; x.strokeText(ln, 256, y0 + i * lh); x.fillStyle = '#fff'; x.fillText(ln, 256, y0 + i * lh); });
    x.font = 'bold 40px "Segoe UI",Arial,sans-serif'; const w = x.measureText(td.name).width + 48;
    x.fillStyle = 'rgba(8,3,18,.85)'; x.fillRect(256 - w / 2, 230, w, 58);
    x.fillStyle = td.color; x.fillRect(256 - w / 2, 230, 10, 58); x.fillRect(256 + w / 2 - 10, 230, 10, 58);
    x.fillStyle = '#fff'; x.fillText(td.name, 256, 260);
    this.tex.needsUpdate = true;
  }
  setCombo(level, secs) { this.comboLevel = level; this.comboUntil = this.G.t + secs; this.buildCombo(); }
  buildCombo() {
    if (this.fx) { this.group.remove(this.fx); this.fx = null; }
    if (!this.comboLevel) return;
    const f = this.fx = new T.Group(); const pal = this.G.pal;
    const aura = new T.Mesh(GEO.aura, new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false })); aura.position.y = 2.2; aura.scale.y = 1.4; f.add(aura); this.aura = aura;
    if (this.comboLevel >= 2) { this.wings = []; [1, -1].forEach((s) => { const w = new T.Mesh(GEO.wing, new T.MeshBasicMaterial({ color: pal[1], side: T.DoubleSide, transparent: true, opacity: 0.78, blending: T.AdditiveBlending, depthWrite: false })); w.position.set(0, 3, -0.4); w.scale.x = s; f.add(w); this.wings.push(w); }); }
    if (this.comboLevel >= 3) { const r = new T.Mesh(GEO.ring, new T.MeshBasicMaterial({ color: pal[2], transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })); r.position.y = 2.2; f.add(r); this.ring = r; }
    this.group.add(f);
  }
  update(dt) {
    const G = this.G, b = G.beat.b, p = b * Math.PI, e = clamp(G.energy, 0.3, 1.3), t = G.t;
    this.pulse = Math.max(0, this.pulse - dt * 1.4);
    if (this.dying) { this.dyingT += dt; if (this.dyingT > 0.5) { this.dead = true; return; } }
    const age = t - this.born; let s = this.baseScale * easeOutBack(clamp(age / 0.6, 0, 1)) * (1 + 0.16 * this.pulse + 0.05 * G.beat.pulse * e);
    if (this.dying) s *= Math.max(0, 1 - this.dyingT / 0.5);
    this.group.scale.setScalar(Math.max(0.001, s)); this.lm += (this.labelMul - this.lm) * (1 - Math.exp(-4 * dt)); this.label.scale.set(5.6 * this.tf * this.lm, 3.5 * this.tf * this.lm, 1);
    const ph = this.phase, B = this.body, aR = this.armR, aL = this.armL, lR = this.legR, lL = this.legL;
    B.position.y = Math.abs(Math.sin(p + ph * 0.1)) * 0.42 * e; B.rotation.z = 0; lR.rotation.x = Math.sin(p * 2 + ph) * 0.15; lL.rotation.x = -lR.rotation.x; aR.rotation.x = aL.rotation.x = 0;
    let ar, al;
    switch (this.style) {
      case 0: ar = 1.6 + Math.sin(p * 2) * 1.0; al = 1.6 + Math.sin(p * 2 + Math.PI) * 1.0; break;
      case 1: ar = 0.9 + Math.sin(b * 3 + ph) * 0.55; al = 0.9 + Math.sin(b * 3 + ph + 1.5) * 0.55; B.rotation.z = Math.sin(p) * 0.13; break;
      case 2: this.group.rotation.y += dt * 3.2 * e; ar = al = 1.55; break;
      case 3: lR.rotation.x = Math.sin(p) * 0.75; lL.rotation.x = -Math.sin(p) * 0.75; ar = 0.5; al = 0.5; aR.rotation.x = -Math.sin(p) * 0.65; aL.rotation.x = Math.sin(p) * 0.65; break;
      case 4: ar = 2.6 + Math.sin(p * 2) * 0.22; al = 0.4 + Math.abs(Math.sin(p)) * 0.42; B.rotation.z = Math.sin(p) * 0.1; break;
      case 5: { const q = Math.floor(b * 2 + ph) % 4; ar = [0.3, 1.7, 2.9, 1.7][q]; al = [1.7, 0.3, 1.7, 2.9][q]; B.position.y += Math.abs(Math.sin(p * 2)) * 0.15; break; }
      case 6: ar = 2.9; al = 2.9; B.rotation.y = Math.sin(p * 0.5) * 0.4; lR.rotation.x = Math.abs(Math.sin(p)) * 0.5; lL.rotation.x = Math.abs(Math.cos(p)) * 0.5; break;
      default: ar = 1.2 + Math.sin(p * 3 + ph) * 0.9; al = 1.2 + Math.cos(p * 3 + ph) * 0.9; B.rotation.z = Math.sin(p * 0.7) * 0.16;
    }
    aR.rotation.z = ar; aL.rotation.z = -al;
    if (this.style !== 2) this.group.rotation.y *= 0.92;
    this.bodyMat.emissiveIntensity = 0.32 + 0.55 * G.beat.pulse * e + this.pulse * 0.85;
    this.discMat.opacity = 0.32 + 0.3 * G.beat.pulse + 0.4 * this.pulse;
    this.discRing.rotation.z += dt * (1 + e);
    if (this.halo) this.halo.rotation.y += dt * 2.2;
    if (this.fx) {
      if (t > this.comboUntil) { this.comboLevel = 0; this.buildCombo(); }
      else { if (this.aura) this.aura.material.opacity = 0.18 + Math.random() * 0.12; if (this.wings) this.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.5 + Math.sin(t * 9) * 0.45); }); if (this.ring) { this.ring.rotation.x = t * 2.1; this.ring.rotation.y = t * 1.35; } }
    }
  }
  startDying() { this.dying = true; this.dyingT = 0; }
  dispose() { this.parent.remove(this.group); this.bodyMat.dispose(); this.discMat.dispose(); this.tex.dispose(); this.label.material.dispose(); }
}

export class Dancers {
  constructor(G, scene) {
    this.G = G; this.cfg = G.cfg; this.container = new T.Group(); scene.add(this.container);
    this.map = new Map(); this.list = []; this.taken = new Array(G.cfg.dancers.max).fill(false); this.dj = null; this.djEnd = 0; this.djUser = null;
    this.resident = new Dancer(G, this.container, 'resident', 'DJ Kapadokya', true); this.resident.setTier(3, G.cfg.tiers); this.resident.group.position.set(0, 13.5, -15.2);
  }
  get(id) { return this.map.get(id) || null; }
  spawn(user, tierIdx) {
    let d = this.map.get(user.id);
    if (d) { if (d.nick !== user.nick) { d.nick = user.nick; d.setTier(tierIdx, this.cfg.tiers); } if (d.tier !== tierIdx) d.setTier(tierIdx, this.cfg.tiers); d.until = this.G.t + this.cfg.dancers.lifetimeSec; return d; }
    const max = this.cfg.dancers.max;
    if (this.list.length >= max) this.remove(this.list[0]);
    let slot = this.taken.indexOf(false); if (slot < 0) slot = 0;
    d = new Dancer(this.G, this.container, user.id, user.nick, false); d.slot = slot; this.taken[slot] = true; d.group.position.copy(slotPos(slot));
    d.until = this.G.t + this.cfg.dancers.lifetimeSec; d.setTier(tierIdx, this.cfg.tiers); this.map.set(user.id, d); this.list.push(d); return d;
  }
  remove(d) {
    if (!d) return; if (d.slot >= 0) this.taken[d.slot] = false; this.map.delete(d.id); const i = this.list.indexOf(d); if (i >= 0) this.list.splice(i, 1); d.dispose();
  }
  setDj(user, tierIdx, secs) {
    this.clearDj(false); const old = this.map.get(user.id); if (old) this.remove(old);
    this.resident.group.visible = false;
    const d = new Dancer(this.G, this.container, 'dj:' + user.id, user.nick, true); d.bigDj = true; d.setTier(Math.max(tierIdx, 3), this.cfg.tiers); d.group.position.set(0, 13.5, -15.5); d.pulse = 1.5;
    this.dj = d; this.djUser = { user, tierIdx }; this.djEnd = this.G.t + secs; return d;
  }
  clearDj(restore = true) {
    if (!this.dj) return; this.dj.dispose(); this.dj = null; this.resident.group.visible = true;
    if (restore && this.djUser) this.spawn(this.djUser.user, this.djUser.tierIdx); this.djUser = null;
  }
  random() { return this.list.length ? this.list[Math.floor(Math.random() * this.list.length)] : null; }
  update(dt) {
    const t = this.G.t;
    if (this.dj && t >= this.djEnd) this.clearDj(true);
    this.resident.update(dt); if (this.dj) this.dj.update(dt);
    const byAge = this.list.slice().sort((a, b) => b.born - a.born); byAge.forEach((d, i) => { d.labelMul = i < 10 ? 1 : 0.6; });
    for (const d of this.list.slice()) { if (!d.dying && t > d.until) d.startDying(); d.update(dt); if (d.dead) this.remove(d); }
  }
}
