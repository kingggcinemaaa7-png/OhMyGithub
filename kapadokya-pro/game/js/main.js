// Kapadokya Beat Vadisi PRO - ana döngü ve olay akışı (Chatterbox TTS, profesyonel sahne)
import { THREE as T } from './three-loader.js';
import { clamp, rand, pick, damp, tierOf, PALETTES } from './util.js';
import { createWorld } from './world.js';
import { Dancers } from './dancers.js';
import { CamDirector } from './camera.js';
import { Particles, Meteors, SkyShow, Ceremony } from './fx.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Net } from './net.js';

const Q = new URLSearchParams(location.search);
const DEV = Q.get('dev') === '1';
const fail = (m) => { const e = document.getElementById('err'); e.hidden = false; e.textContent = m; };

const cfg = await fetch('/config.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
if (!cfg) { fail('Köprü çalışmıyor. BASLAT.bat ile aç ve konsolda yazan Oyun adresini kullan.'); throw new Error('config yok'); }

// ---------- ortak durum ----------
const G = {
  cfg, t: 0, dt: 0, beat: { b: 0, pulse: 0 }, pal: PALETTES[0].map((h) => new T.Color(h)), palIdx: 0, energy: 0.5, hype: 0,
  skyMix: 0, skyTarget: 0, shake: 0, strobe: 0, laserBoost: 0, dropGlow: 0, quality: 1, W: 1080, H: 1920, ledMsg: null, skyCenter: new T.Vector3(0, 70, -60),
};
const ui = new UI(); const audio = new AudioEngine(cfg);
const canvas = document.getElementById('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
const camera = new T.PerspectiveCamera(72, 9 / 16, 0.5, 1400);
const world = createWorld(G); const scene = world.scene;
const dancers = new Dancers(G, scene); const cam = new CamDirector(camera, G, dancers);
const particles = new Particles(scene, 4500); const meteors = new Meteors(scene, G); const sky = new SkyShow(scene, G); const ceremony = new Ceremony(scene);

function resize() {
  const w = Math.min(innerWidth, innerHeight * 9 / 16), h = w * 16 / 9; G.W = w; G.H = h;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6) * (G.quality < 0.7 ? 0.7 : 1)); renderer.setSize(w, h, false);
  camera.aspect = 9 / 16; const hf = 46 * Math.PI / 180; cam.baseFov = clamp(2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI, 40, 80); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- yardımcılar ----------
const cooldown = {}; const lastGiftBy = {}; const sessionPts = new Map(); let boardOrder = [];
const ready = (name) => !cooldown[name] || G.t - cooldown[name] >= (cfg.cooldownSec[name] || 30);
const mark = (name) => { cooldown[name] = G.t; };
const tcol = (i) => cfg.tiers[i].color;
const giftColor = (name, tier) => new T.Color(cfg.giftColors[name] || tcol(tier));
const say = (txt, high) => audio.say(txt, high);
function setPalette(i) { G.palIdx = ((i % 4) + 4) % 4; }
async function checkTts() {
  try { const r = await fetch('/tts-health', { cache: 'no-store' }); const j = await r.json(); ui.tts(!!j.ok); }
  catch (e) { ui.tts(false); }
}
setInterval(checkTts, 15000); checkTts();

// ---------- olaylar ----------
let dropping = false;
function startDrop(auto) {
  if (dropping || !ready('drop')) return; dropping = true; mark('drop');
  ui.banner('HAZIRLAN…', '#ffb300'); say('Hazır ol! Dört, üç, iki, bir… DROP!', true); audio.requestDrop(3.2); cam.push({ type: 'crane', dur: 3.2 }, true); G.strobe = 3.2; world.ledMessage('HAZIR OL', '', 3.2);
  let n = 3; ui.dropCount(String(n));
  const cd = setInterval(() => { n--; if (n > 0) { ui.dropCount(String(n)); audio.sfx('join'); } else { clearInterval(cd); ui.dropCount(null); } }, 800);
  setTimeout(() => {
    ui.flash(); ui.banner('DROP!', '#ff2d95'); world.ledMessage('DROP!', '', 4); audio.sfx('boom'); G.shake = 1.5; G.dropGlow = 1; G.laserBoost = 1; G.strobe = 0;
    particles.confetti(1100); for (let i = 0; i < 7; i++) particles.burst(new T.Vector3(rand(-15, 15), rand(4, 15), rand(-8, 6)), G.pal[i % 3], 100, 19);
    particles.fountain(new T.Vector3(0, 2, 8), new T.Color(0xffffff), 120);
    dancers.list.forEach((d) => { d.pulse = 1; }); dancers.resident.pulse = 1; cam.push({ type: 'drop', dur: 5.5 }, true); G.hype = 0; dropping = false;
  }, 3200);
}
function startStarRain(by) { if (!ready('starRain')) return; mark('starRain'); meteors.start(10); audio.sfx('star'); ui.banner('YILDIZ YAĞMURU', '#8fd3ff'); world.ledMessage('YILDIZ', 'YAĞMURU', 4); if (by) say(by + ' gökyüzünden yıldız yağdırdı!'); cam.push({ type: 'sky', dur: 6, power: 0 }, false); }
function startCeremony(by) { if (!ready('lightCeremony')) return; mark('lightCeremony'); ceremony.start(13); audio.sfx('whoosh'); audio.sfx('tier'); ui.banner('BÜYÜK IŞIK TÖRENİ', '#ffd54a'); world.ledMessage('IŞIK', 'TÖRENİ', 5); G.laserBoost = 1; cam.push({ type: 'portal', dur: 8 }, true); if (by) say('Büyük ışık töreni! Teşekkürler ' + by + '!', true); }
function startDawn() { if (!ready('dawn')) return; mark('dawn'); G.skyTarget = 1; ui.banner('ŞAFAK FİNALİ', '#ffb36b'); world.ledMessage('ŞAFAK', 'FİNALİ', 5); say('Şafak sökerken vadi uyanıyor!'); setTimeout(() => { G.skyTarget = 0; }, 38000); }
function startLaser() { if (!ready('laserShow')) return; mark('laserShow'); G.laserBoost = 1; G.strobe = 1.2; audio.sfx('whoosh'); ui.banner('LAZER ŞOV', '#19d3ff'); world.ledMessage('LAZER', 'ŞOV', 4); }
function startDuel(a, b) {
  if (!ready('duel')) return; mark('duel'); ui.banner('DANS DÜELLOSU', '#ff6e40'); say(a.nick + ' ve ' + b.nick + ' dans düellosunda!'); world.ledMessage(a.nick, 'VS ' + b.nick, 5);
  [a, b].forEach((d, i) => { d.pulse = 1.5; cam.push({ type: 'spot', dancer: d, dur: 3.5, power: 0.6 }, true); particles.burst(d.group.position.clone().add(new T.Vector3(0, 3, 0)), G.pal[i], 70, 11); });
}

function updateBoard(uid, nick) {
  const before = boardOrder.findIndex((e) => e.id === uid); const arr = [...sessionPts.entries()].map(([id, e]) => ({ id, nick: e.nick, points: e.points })).sort((a, b) => b.points - a.points);
  const after = arr.findIndex((e) => e.id === uid);
  if (before > after && after >= 0 && before >= 0 && after < 5) { const passed = boardOrder[after]; if (passed && passed.id !== uid) { ui.banner(nick + ' öne geçti!', '#ffd54a'); say(nick + ', ' + passed.nick + '’i geçti! Sıralama değişti!'); } }
  boardOrder = arr; ui.board(arr.slice(0, 5));
}

function onJoin(m) {
  const tier = tierOf(m.total || 0, cfg.tiers); const d = dancers.spawn(m.user, tier); d.pulse = 0.9;
  particles.burst(d.group.position.clone().add(new T.Vector3(0, 3, 0)), new T.Color(0xffffff), 22, 7); audio.sfx('join');
  ui.toast(m.user.nick, 'sahneye katıldı', tcol(tier)); cam.push({ type: 'spot', dancer: d, dur: 4, power: 0.12 }, false);
}
function onGift(m) {
  const u = m.user, g = m.gift, tier = tierOf(m.total, cfg.tiers), prev = tierOf(m.totalBefore, cfg.tiers), L = cfg.ladder;
  const gc = giftColor(g.name, tier); let d;
  if (m.points >= L.djMin) d = dancers.setDj(u, tier, L.djSeconds); else d = dancers.spawn(u, tier);
  d.pulse = 1.25; const ppos = d.group.position.clone().add(new T.Vector3(0, 3, 0));
  particles.burst(ppos, gc, clamp(35 + m.points / 3, 35, 180), 8 + Math.min(11, m.points / 300));
  ui.toast(u.nick, '× ' + g.count + '  ' + g.name + (m.mult > 1 ? '  (x' + m.mult + ')' : ''), '#' + gc.getHexString()); audio.sfx('gift', Math.log10(1 + m.points));
  G.hype = clamp(G.hype + clamp(cfg.hype.minPerGift + m.points * cfg.hype.perPoint, cfg.hype.minPerGift, cfg.hype.maxPerGift), 0, 100);
  const s = sessionPts.get(u.id) || { nick: u.nick, points: 0 }; s.nick = u.nick; s.points += m.points; sessionPts.set(u.id, s); updateBoard(u.id, u.nick);
  if (m.mult > 1) { const lvl = m.mult >= 3 ? 3 : m.mult >= 2 ? 2 : 1; d.setCombo(lvl, 9); ui.combo('x' + g.count + ' COMBO', lvl === 3 ? '#ffd54a' : lvl === 2 ? '#19d3ff' : '#ff7a1a'); audio.sfx('combo', lvl); if (lvl === 3) say(u.nick + ' ' + g.count + ' kombo yaptı!'); }
  if (tier > prev) { ui.tierup(u.nick, cfg.tiers[tier].name, tcol(tier)); audio.sfx('tier'); particles.confetti(300); say(u.nick + ' artık ' + cfg.tiers[tier].name + '! Tebrikler!', true); }
  const last = lastGiftBy[g.name]; if (last && last.id !== u.id && G.t - last.t < 10) { const other = dancers.get(last.id); if (other && other !== d) startDuel(other, d); } lastGiftBy[g.name] = { id: u.id, t: G.t };
  if (m.points >= L.djMin) { ui.banner('DJ KOLTUĞU: ' + u.nick, '#e74c3c'); world.ledMessage('DJ', u.nick, 6); say('Yeni DJ ' + u.nick + '! Vadi senin!', true); cam.push({ type: 'dj', dur: 5.5 }, true); G.shake = 0.9; }
  if (m.points >= L.skyMin) { sky.show({ nick: u.nick, avatar: u.avatar, color: gc.clone().lerp(new T.Color(tcol(tier)), 0.5).lerp(new T.Color(0xffffff), 0.3) }); cam.push({ type: 'sky', dur: 5.5 }, true); say(u.nick + ' ismini gökyüzüne yazdı!'); audio.sfx('star'); }
  else if (m.points >= L.announceMin && !(m.points >= L.djMin)) say('Hoş geldin ' + u.nick + '!');
  if (m.points >= L.lightCeremonyMin) startCeremony(u.nick); else if (m.points >= L.starRainMin) startStarRain(u.nick);
  if (m.points < L.djMin) cam.push({ type: 'spot', dancer: d, dur: 5, power: clamp(m.points / 3000, 0.12, 1) }, true);
  G.shake = Math.max(G.shake, Math.min(0.55, m.points / 4000));
}
function onDirector(a) {
  if (!a) return;
  if (a.palette >= 0) setPalette(a.palette);
  if (a.camera) cam.push({ type: a.camera, dur: 6, idle: true, side: Math.random() < 0.5 ? -1 : 1 }, false);
  if (a.event === 'drop') startDrop(true); else if (a.event === 'starRain') startStarRain(); else if (a.event === 'lightCeremony') startCeremony(); else if (a.event === 'dawn') startDawn(); else if (a.event === 'laserShow') startLaser();
  if (a.say) { say(a.say); world.ledMessage(a.say.length > 22 ? 'DJ KAPADOKYA' : a.say, '', 4); }
}
let bridgeUp = false, mode = '';
const net = new Net((m) => {
  if (m.type === 'gift') onGift(m); else if (m.type === 'join') onJoin(m); else if (m.type === 'director') onDirector(m.action);
  else if (m.type === 'hello') mode = m.mode; else if (m.type === 'status') { /* TikTok durum */ }
}, (up) => { bridgeUp = up; });

// ---------- geliştirici paneli (?dev=1) ----------
if (DEV) {
  const panel = document.getElementById('dev'); panel.hidden = false; const totals = {}; const names = ['Şeyma', 'Ömer', 'Çağla', 'İlker', 'Gülsüm', 'Mehmet Ali Yıldırım', 'Zeynep', 'Uğur Can'];
  const fake = (gift, dia, count) => { const n = pick(names), id = 'dev_' + n; const mult = count >= 10 ? 3 : count >= 5 ? 2 : count >= 3 ? 1.5 : 1; const pts = Math.round(dia * count * mult); const before = totals[id] || 0; totals[id] = before + pts; onGift({ user: { id, nick: n, avatar: '' }, gift: { name: gift, count, id: 1 }, diamonds: dia * count, points: pts, mult, total: totals[id], totalBefore: before }); };
  [['Katıl (yorum)', () => onJoin({ user: { id: 'dev_' + Math.random(), nick: pick(names) + ' ' + Math.floor(rand(1, 99)), avatar: '' }, total: 0 })], ['Rose x1', () => fake('Rose', 1, 1)], ['Finger Heart x5 (combo)', () => fake('Finger Heart', 5, 5)], ['Rose x12 (x10 combo)', () => fake('Rose', 1, 12)], ['Perfume (anons)', () => fake('Perfume', 20, 3)],
    ['Yıldız Yağmuru (200+)', () => fake('Galaxy', 250, 1)], ['Gökyüzü ismi (500+)', () => fake('Galaxy', 600, 1)], ['Işık Töreni (2000+)', () => fake('Galaxy', 2500, 1)], ['DJ KOLTUĞU (5000+)', () => fake('Lion', 6000, 1)], ['TTS test (Chatterbox)', () => say('Burası Kapadokya Beat Vadisi! Chatterbox sesiyle yayındayız!')], ['DROP', () => { G.hype = 100; startDrop(); }], ['Şafak Finali', () => startDawn()], ['Lazer şov', () => startLaser()], ['Palet değiştir', () => setPalette(G.palIdx + 1)]]
    .forEach(([label, fn]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; panel.append(b); });
}

// ---------- başlat / döngü ----------
const startEl = document.getElementById('start');
const begin = () => { startEl.style.display = 'none'; audio.start(); };
if (Q.get('auto') === '1') { begin(); if (audio.ctx && audio.ctx.resume) audio.ctx.resume(); } else document.getElementById('startBtn').onclick = begin;
if (Q.get('auto') === '1') addEventListener('click', () => { if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); });

let last = performance.now(), fpsAcc = 0, fpsN = 0, slow = 0, nextAmb = 25, nextState = 5, lastDawn = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; G.t += dt; G.dt = dt;
  const b = audio.beats(); G.beat.b = b; G.beat.pulse = Math.pow(1 - (b - Math.floor(b)), 3);
  for (let i = 0; i < 3; i++) G.pal[i].lerp(new T.Color(PALETTES[G.palIdx][i]), 1 - Math.exp(-2 * dt));
  G.hype = Math.max(0, G.hype - cfg.hype.decayPerSec * dt); if (G.hype >= 100 && !dropping) startDrop();
  G.energy = clamp(0.35 + G.hype / 100 * 0.7 + 0.2 * dancers.list.length / cfg.dancers.max, 0.3, 1.25); audio.energy = clamp(G.energy, 0, 1);
  G.skyMix = damp(G.skyMix, G.skyTarget, 0.35, dt); G.strobe = Math.max(0, G.strobe - dt); G.laserBoost = Math.max(0, G.laserBoost - dt * 0.35); G.dropGlow = Math.max(0, G.dropGlow - dt * 1.2);
  ui.hype(G.hype);
  world.update(dt); dancers.update(dt); cam.update(dt); particles.update(dt); meteors.update(dt); sky.update(dt); ceremony.update(dt, G); renderer.render(scene, camera);
  nextAmb -= dt; if (nextAmb <= 0) { nextAmb = rand(22, 38); setPalette(G.palIdx + 1 + Math.floor(rand(0, 3))); if (Math.random() < 0.3) startLaser(); else if (Math.random() < 0.2) startStarRain(); }
  if (G.t - lastDawn > 900) { lastDawn = G.t; startDawn(); }
  nextState -= dt; if (nextState <= 0) { nextState = 5; net.send({ type: 'state', hype: Math.round(G.hype), dancers: dancers.list.length, dj: !!dancers.dj }); }
  fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { const fps = fpsN / fpsAcc; slow = fps < 40 ? slow + 1 : 0; if (slow >= 3 && G.quality > 0.5) { G.quality = 0.5; resize(); } fpsAcc = 0; fpsN = 0; if (DEV || Q.get('hud') === '1') ui.status(Math.round(fps) + ' fps | köprü: ' + (bridgeUp ? (mode || 'bağlı') : 'YOK') + ' | dansçı: ' + dancers.list.length + ' | hype: ' + Math.round(G.hype)); }
}
requestAnimationFrame(frame);
