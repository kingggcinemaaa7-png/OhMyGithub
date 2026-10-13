// PRO 3B Kapadokya gecesi: PBR zemin, isikli peri bacalari, LED teraslar, volumetrik kuleler, lazerler, kalabalik, balonlar.
import { THREE as T } from './three-loader.js';
import { rand, clamp, lerp } from './util.js';

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
}
const ROW_Z = (r) => 6 - r * 2.4, ROW_Y = (r) => r * 1.7;

export function createWorld(G) {
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x120a2a, 0.0042);
  scene.background = new T.Color(0x05010e);

  // ---------- gökyüzü kubbesi (gece <-> şafak, horizon glow) ----------
  const skyU = { top: { value: new T.Color(0x02010d) }, mid: { value: new T.Color(0x1c0b44) }, bot: { value: new T.Color(0x5a2058) }, glow: { value: new T.Color(0xff5a3c) }, dTop: { value: new T.Color(0x2b3f8f) }, dMid: { value: new T.Color(0xff7a59) }, dBot: { value: new T.Color(0xffc15e) }, uMix: { value: 0 } };
  const sky = new T.Mesh(new T.SphereGeometry(520, 32, 20), new T.ShaderMaterial({
    uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top,mid,bot,glow,dTop,dMid,dBot; uniform float uMix; varying vec3 vP;' +
      'void main(){ float h=clamp(vP.y,0.,1.); float hz=exp(-abs(vP.y)*9.0);' +
      'vec3 n=mix(bot,mix(mid,top,smoothstep(0.12,0.8,h)),smoothstep(0.,0.28,h)); n+=glow*hz*0.35;' +
      'vec3 d=mix(dBot,mix(dMid,dTop,smoothstep(0.1,0.7,h)),smoothstep(0.,0.2,h));' +
      'gl_FragColor=vec4(mix(n,d,uMix),1.0);\n#include <colorspace_fragment>\n}',
  }));
  scene.add(sky);
  // yildizlar (twinkle icin iki katman)
  const mkStars = (n2, size, op) => {
    const sp = []; for (let i = 0; i < n2; i++) { const a = rand(0, Math.PI * 2), e = Math.acos(rand(0.03, 1)); const r = 440; sp.push(Math.sin(e) * Math.cos(a) * r, Math.cos(e) * r, Math.sin(e) * Math.sin(a) * r); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    const p = new T.Points(g, new T.PointsMaterial({ color: 0xcfd8ff, size, sizeAttenuation: false, transparent: true, opacity: op, depthWrite: false, fog: false }));
    scene.add(p); return p;
  };
  const stars1 = mkStars(1100, 2.6, 0.9), stars2 = mkStars(500, 3.6, 0.7);
  const gt = glowTex();
  const moon = new T.Mesh(new T.SphereGeometry(14, 24, 18), new T.MeshBasicMaterial({ color: 0xfff4d6, fog: false })); moon.position.set(-110, 130, -340); scene.add(moon);
  const moonGlow = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0x9db8ff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, fog: false })); moonGlow.scale.set(150, 150, 1); moonGlow.position.copy(moon.position); scene.add(moonGlow);
  const sun = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0xff9a3c, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sun.scale.set(300, 300, 1); scene.add(sun);

  // ---------- ışıklar (PRO: softer + rim) ----------
  scene.add(new T.AmbientLight(0x4a3a7a, 1.1));
  scene.add(new T.HemisphereLight(0x7a6cff, 0x1a0f2e, 1.35));
  const moonLight = new T.DirectionalLight(0x9fb4ff, 1.7); moonLight.position.set(-30, 70, 40); moonLight.castShadow = true; moonLight.shadow.mapSize.set(1024, 1024); moonLight.shadow.camera.far = 200; scene.add(moonLight);
  const rim = new T.DirectionalLight(0xff5a8a, 0.7); rim.position.set(30, 20, -60); scene.add(rim);
  const pl = [[-14, 14, 4], [14, 14, 4], [0, 26, -10]].map((p) => { const l = new T.PointLight(0xffffff, 900, 80, 2); l.position.set(...p); scene.add(l); return l; });

  // ---------- zemin (PBR + ızgara yansıması hissi) ----------
  const ground = new T.Mesh(new T.PlaneGeometry(1000, 1000), new T.MeshStandardMaterial({ color: 0x241426, roughness: 0.85, metalness: 0.25 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.35; ground.receiveShadow = true; scene.add(ground);

  // ---------- peri bacaları PRO (katmanlı + ışıklı pencereler) ----------
  const rockMats = [0x8a5a4a, 0x7a5a58, 0x946a55, 0x6f4f4a].map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true, emissive: 0x140a0c, emissiveIntensity: 0.6 }));
  const winMat = new T.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff9a2a, emissiveIntensity: 2.2 });
  function chimney(x, z, h, r) {
    const g = new T.Group(), m = rockMats[Math.floor(rand(0, rockMats.length))];
    const body = new T.Mesh(new T.CylinderGeometry(r * 0.55, r, h, 9), m); body.position.y = h / 2; body.castShadow = true; g.add(body);
    const neck = new T.Mesh(new T.CylinderGeometry(r * 0.35, r * 0.55, h * 0.25, 9), m); neck.position.y = h * 1.08; g.add(neck);
    const cap = new T.Mesh(new T.ConeGeometry(r * 0.62, r * 0.9, 9), m); cap.position.y = h * 1.3; cap.castShadow = true; g.add(cap);
    const n = Math.floor(rand(3, 6));
    for (let i = 0; i < n; i++) { const f = rand(0.25, 0.8), a = rand(0, Math.PI * 2), rad = r * (1 - f * 0.5); const w = new T.Mesh(new T.BoxGeometry(r * 0.18, r * 0.3, 0.25), winMat); w.position.set(Math.cos(a) * rad, h * f, Math.sin(a) * rad); w.rotation.y = -a + Math.PI / 2; g.add(w); }
    g.position.set(x, 0, z); g.rotation.y = rand(0, 6.28); scene.add(g);
  }
  for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1; chimney(side * rand(32, 80), rand(-30, -135), rand(14, 42), rand(4, 8)); }
  for (let i = 0; i < 12; i++) chimney(rand(-70, 70), rand(-155, -220), rand(26, 58), rand(7, 12));
  for (let i = 0; i < 7; i++) { const m = new T.Mesh(new T.ConeGeometry(rand(60, 110), rand(40, 75), 7), new T.MeshStandardMaterial({ color: 0x150d28, roughness: 1, flatShading: true })); m.position.set(rand(-260, 260), 14, rand(-270, -310)); scene.add(m); }

  // ---------- teraslar + LED zemin PRO (kenar şeridi) ----------
  const terrM = new T.MeshStandardMaterial({ color: 0x1c1332, roughness: 0.7, metalness: 0.3 });
  const trimM = new T.MeshBasicMaterial({ color: 0x19d3ff });
  for (let r = 0; r < 8; r++) { const H = ROW_Y(r) + 1; const b = new T.Mesh(new T.BoxGeometry(42, H, 2.4), terrM); b.position.set(0, (ROW_Y(r) - 1) / 2, ROW_Z(r)); b.receiveShadow = true; scene.add(b);
    const strip = new T.Mesh(new T.BoxGeometry(42, 0.12, 0.12), trimM); strip.position.set(0, ROW_Y(r) + 0.08, ROW_Z(r) + 1.22); scene.add(strip); }
  const front = new T.Mesh(new T.BoxGeometry(42, 1, 7), terrM); front.position.set(0, -0.5, 10.8); scene.add(front);
  const backP = new T.Mesh(new T.BoxGeometry(42, ROW_Y(7) + 1, 8), terrM); backP.position.set(0, (ROW_Y(7) - 1) / 2, -15); scene.add(backP);
  const rows = []; for (let r = 0; r < 8; r++) rows.push([ROW_Z(r), ROW_Y(r) + 0.02]); rows.push([8.4, 0.02], [10.8, 0.02]);
  const COLS = 16, tileGeo = new T.PlaneGeometry(2.3, 2.4); tileGeo.rotateX(-Math.PI / 2);
  const tiles = new T.InstancedMesh(tileGeo, new T.MeshBasicMaterial({ color: 0xffffff }), COLS * rows.length);
  const tmeta = []; const dm = new T.Object3D(); let ti = 0;
  rows.forEach(([z, y], ri) => { for (let c = 0; c < COLS; c++) { dm.position.set((c - (COLS - 1) / 2) * 2.5, y, z); dm.updateMatrix(); tiles.setMatrixAt(ti, dm.matrix); tmeta.push([c, ri]); tiles.setColorAt(ti, new T.Color(0x000000)); ti++; } });
  scene.add(tiles);
  const tc = new T.Color();

  // ---------- DJ kabini + LED duvar PRO ----------
  const booth = new T.Group(); booth.position.set(0, ROW_Y(7), -14.5); scene.add(booth);
  const bb = new T.Mesh(new T.BoxGeometry(15, 1.7, 4.2), new T.MeshStandardMaterial({ color: 0x2a1650, roughness: 0.4, metalness: 0.5 })); bb.position.y = 0.85; bb.castShadow = true; booth.add(bb);
  const archMat = new T.MeshBasicMaterial({ color: 0xffb300 }); const arch = new T.Mesh(new T.TorusGeometry(6.6, 0.38, 10, 48, Math.PI), archMat); arch.position.set(0, 1.6, 2.1); booth.add(arch);
  const deckMat = new T.MeshBasicMaterial({ color: 0x19d3ff }); [-3.2, 3.2].forEach((x) => { const d = new T.Mesh(new T.CylinderGeometry(1.35, 1.35, 0.22, 28), deckMat); d.position.set(x, 1.85, 1.2); booth.add(d); });
  const lc = document.createElement('canvas'); lc.width = 768; lc.height = 320; const lx = lc.getContext('2d');
  const ledTex = new T.CanvasTexture(lc); ledTex.colorSpace = T.SRGBColorSpace; ledTex.anisotropy = 4;
  const led = new T.Mesh(new T.PlaneGeometry(42, 17.5), new T.MeshBasicMaterial({ map: ledTex, toneMapped: false })); led.position.set(0, 27, -22.5); scene.add(led);
  const frameM = new T.MeshBasicMaterial({ color: 0xffffff });
  [[0, 36, 42.6, 0.5], [0, 18, 42.6, 0.5]].forEach(([x, y, w, h]) => { const f = new T.Mesh(new T.BoxGeometry(w, h, 0.6), frameM); f.position.set(x, y, -22.4); scene.add(f); });
  [-21.2, 21.2].forEach((x) => { const f = new T.Mesh(new T.BoxGeometry(0.5, 18.5, 0.6), frameM); f.position.set(x, 27, -22.4); scene.add(f); });
  let ledAcc = 0;
  function drawLed() {
    const [c1, c2, c3] = G.pal.map((c) => '#' + c.getHexString()); const pulse = G.beat.pulse;
    lx.globalAlpha = 1; lx.fillStyle = '#06030f'; lx.fillRect(0, 0, 768, 320);
    const off = (G.t * 28) % 64; const cols = [c1, c2, c3, c1];
    for (let band = 0; band < 2; band++) for (let sub = 0; sub < 2; sub++) {
      const cy = band ? 272 + sub * 24 : 16 + sub * 24;
      for (let i = -1; i < 14; i++) {
        const cx = i * 64 + (sub ? 32 : 0) + (band ? -off : off);
        lx.globalAlpha = 0.3 + 0.6 * pulse * ((i + sub) % 2 ? 1 : 0.6); lx.fillStyle = cols[(i + sub + band * 2 + 40) % 3];
        lx.beginPath(); lx.moveTo(cx, cy - 18); lx.lineTo(cx + 18, cy); lx.lineTo(cx, cy + 18); lx.lineTo(cx - 18, cy); lx.closePath(); lx.fill();
      }
    }
    lx.globalAlpha = 1; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.shadowColor = c2; lx.shadowBlur = 20 + 22 * pulse; lx.fillStyle = '#fff';
    const m = G.ledMsg && G.t < G.ledMsg.until ? G.ledMsg : null;
    if (m) { lx.font = 'bold 92px "Segoe UI",Arial,sans-serif'; lx.fillText(m.l1, 384, m.l2 ? 120 : 160); if (m.l2) { lx.font = 'bold 62px "Segoe UI",Arial,sans-serif'; lx.fillText(m.l2, 384, 210); } }
    else { lx.font = 'bold 88px "Segoe UI",Arial,sans-serif'; lx.fillText('KAPADOKYA', 384, 120); lx.font = 'bold 68px "Segoe UI",Arial,sans-serif'; lx.fillStyle = c3; lx.fillText('BEAT VADİSİ • PRO', 384, 205); }
    lx.shadowBlur = 0; ledTex.needsUpdate = true;
  }

  // ---------- ışık kuleleri + lazerler PRO ----------
  const beamMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  const coneG = new T.ConeGeometry(3.2, 75, 20, 1, true); coneG.translate(0, -37.5, 0);
  const towers = [-19, -13, 13, 19].map((x, i) => {
    const grp = new T.Group(); grp.position.set(x, ROW_Y(7) + 8, -13); grp.rotation.x = Math.PI;
    const m = new T.Mesh(coneG, beamMat.clone()); grp.add(m); scene.add(grp);
    const post = new T.Mesh(new T.BoxGeometry(0.9, 8, 0.9), new T.MeshStandardMaterial({ color: 0x2a1650, roughness: 0.5, metalness: 0.4 })); post.position.set(x, ROW_Y(7) + 4, -13); post.castShadow = true; scene.add(post);
    const head = new T.Mesh(new T.SphereGeometry(0.55, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff })); head.position.set(x, ROW_Y(7) + 8.2, -13); scene.add(head);
    return { grp, m, head, i };
  });
  const lasers = []; const laserG = new T.BoxGeometry(0.07, 0.07, 75); laserG.translate(0, 0, 37.5);
  for (let i = 0; i < 12; i++) { const piv = new T.Group(); piv.position.set(-20 + i * 3.6, 36, -21.5); const m = new T.Mesh(laserG, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, fog: false })); piv.add(m); scene.add(piv); lasers.push({ piv, m, i }); }

  // ---------- ön plan kalabalık PRO (renk varyasyonlu siluet) ----------
  const CROWD = 160; const crowd = new T.InstancedMesh(new T.CapsuleGeometry(0.45, 1.2, 3, 6), new T.MeshBasicMaterial({ color: 0xffffff }), CROWD);
  const cb = []; const cc = new T.Color();
  for (let i = 0; i < CROWD; i++) { cb.push([rand(-22, 22), 0.9 + Math.floor(i / 55) * 0.1, 11.5 + (i % 55) / 55 * 5.5 + rand(0, 1.2), rand(0, 6.28)]); crowd.setColorAt(i, cc.setHSL(rand(0.55, 0.95), 0.5, rand(0.03, 0.1))); }
  scene.add(crowd);

  // ---------- sıcak hava balonları PRO (ışıklı sepet) ----------
  const balloons = [];
  for (let i = 0; i < 12; i++) {
    const g = new T.SphereGeometry(5, 18, 14), pos = g.attributes.position, col = [], base = new T.Color(), hue = Math.random();
    for (let k = 0; k < pos.count; k++) { const a = Math.atan2(pos.getZ(k), pos.getX(k)); const st = Math.floor((a + Math.PI) / (Math.PI * 2) * 8) % 2; base.setHSL((hue + st * 0.08) % 1, 0.85, st ? 0.6 : 0.42); col.push(base.r, base.g, base.b); }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const grp = new T.Group(); const bm = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); bm.scale.set(1, 1.22, 1); grp.add(bm);
    const bk = new T.Mesh(new T.BoxGeometry(1.9, 1.2, 1.9), new T.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 })); bk.position.y = -7; grp.add(bk);
    const lamp = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0xffc15e, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })); lamp.scale.set(4, 4, 1); lamp.position.y = -6.2; grp.add(lamp);
    const near = i < 2; grp.position.set(near ? (i ? 60 : -60) : rand(-110, 110), near ? rand(34, 48) : rand(42, 95), near ? -50 : rand(-75, -160)); grp.scale.setScalar(near ? 1.05 : rand(0.8, 1.4));
    scene.add(grp); balloons.push({ grp, lamp, ph: rand(0, 6), sp: rand(0.4, 1.0), x0: grp.position.x, y0: grp.position.y });
  }

  // ---------- her kare ----------
  const dummy = new T.Object3D();
  function update(dt) {
    const t = G.t, b = G.beat.b, pulse = G.beat.pulse, e = clamp(G.energy, 0.2, 1.3), mix = G.skyMix;
    skyU.uMix.value = mix; stars1.material.opacity = 0.9 * (1 - mix); stars2.material.opacity = 0.7 * (1 - mix) * (0.6 + 0.4 * Math.sin(t * 3));
    stars1.rotation.y = t * 0.004;
    moon.material.color.setScalar(1 - mix * 0.6); moonGlow.material.opacity = 0.55 * (1 - mix);
    sun.position.set(0, lerp(-40, 75, mix), -380); sun.material.opacity = mix;
    scene.fog.color.setRGB(lerp(0.07, 0.8, mix), lerp(0.04, 0.45, mix), lerp(0.16, 0.4, mix));
    moonLight.intensity = lerp(1.7, 2.4, mix);
    pl[0].color.copy(G.pal[0]); pl[1].color.copy(G.pal[1]); pl[2].color.copy(G.pal[2]);
    trimM.color.copy(G.pal[(Math.floor(t * 0.5)) % 3]);
    const strobe = G.strobe > 0 ? (Math.floor(t * 18) % 2 ? 1 : 0.1) : 1; pl.forEach((l) => { l.intensity = 950 * (0.7 + pulse * 0.85) * strobe; });
    archMat.color.copy(G.pal[2]); deckMat.color.copy(G.pal[1]);
    const k = Math.floor(b * 0.5);
    for (let i = 0; i < tmeta.length; i++) {
      const [c, ri] = tmeta[i]; const wave = 0.5 + 0.5 * Math.sin(c * 0.7 + ri * 0.9 + t * 2.4 + (G.strobe > 0 ? t * 20 : 0));
      const v = (0.12 + 0.9 * pulse * wave) * (0.35 + 0.65 * Math.min(1, e)) + (G.dropGlow > 0 ? G.dropGlow : 0);
      tc.copy(G.pal[(c + ri + k) % 3]).multiplyScalar(v); tiles.setColorAt(i, tc);
    }
    tiles.instanceColor.needsUpdate = true;
    ledAcc += dt; if (ledAcc > 0.07) { ledAcc = 0; drawLed(); }
    const lb = 1 + G.laserBoost * 1.6;
    towers.forEach(({ grp, m, head, i }) => { grp.rotation.z = Math.sin(t * 0.7 + i * 1.7) * 0.5 * lb; grp.rotation.x = Math.PI + Math.sin(t * 0.5 + i) * 0.38; m.material.color.copy(G.pal[i % 3]); m.material.opacity = 0.1 + 0.09 * pulse + 0.12 * G.laserBoost; head.material.color.copy(G.pal[i % 3]); });
    lasers.forEach(({ piv, m, i }) => { piv.rotation.y = Math.sin(t * (0.85 + G.laserBoost) + i * 0.6) * 0.85 * lb; piv.rotation.x = 0.15 + Math.sin(t * 0.9 + i) * 0.38 * lb; m.material.color.copy(G.pal[i % 3]); m.visible = G.quality > 0.5 || i % 2 === 0; m.material.opacity = 0.35 + 0.5 * (e > 0.5 ? 1 : 0.4) + G.laserBoost * 0.3; });
    for (let i = 0; i < CROWD; i++) { const [x, y, z, ph] = cb[i]; dummy.position.set(x, y + Math.abs(Math.sin(b * Math.PI + ph)) * 0.5 * e, z); dummy.rotation.z = Math.sin(b * 2 + ph) * 0.07; dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix); }
    crowd.instanceMatrix.needsUpdate = true;
    balloons.forEach((o) => { o.grp.position.x = o.x0 + Math.sin(t * 0.05 * o.sp + o.ph) * 15; o.grp.position.y = o.y0 + Math.sin(t * 0.2 * o.sp + o.ph) * 2.6; o.grp.rotation.y += dt * 0.05; o.lamp.material.opacity = 0.5 + 0.4 * pulse; });
  }
  function ledMessage(l1, l2, secs) { G.ledMsg = { l1, l2: l2 || '', until: G.t + (secs || 4) }; }
  return { scene, update, ledMessage, rowZ: ROW_Z, rowY: ROW_Y };
}
