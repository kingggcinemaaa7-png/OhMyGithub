'use strict';
// KAPADOKYA BEAT VADISI PRO - kopru + oyun sunucusu + Chatterbox TTS vekili
// TTS akisi: oyun -> GET /tts?text= -> bridge (onbellek) -> tts/server.py (Chatterbox V3, tr)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { attach } = require('./lib/ws');
const { createEngine } = require('./lib/engine');
const { createDirector } = require('./lib/director');
const { createTts } = require('./lib/tts');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const DATA = path.join(ROOT, 'data');
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const SIM = process.argv.includes('--sim');

function loadEnv() {
  const p = path.join(__dirname, '.env'); if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue;
    let v = m[2]; if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv();
const env = process.env;
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
let wordlist = []; try { wordlist = JSON.parse(fs.readFileSync(path.join(DATA, 'wordlist.json'), 'utf8')); } catch (e) { log('wordlist.json okunamadi'); }
fs.mkdirSync(DATA, { recursive: true });
let PORT = parseInt(env.PORT || '8787', 10);
const TIKTOK_USER = (env.TIKTOK_USER || env.TIKTOK_USERNAME || '').replace(/^@/, '');
let ttConnected = false;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
const AV_OK = /(^|\.)(tiktokcdn(-us|-eu)?\.com|ibyteimg\.com|byteimg\.com|tiktokv\.com|byteoversea\.com|muscdn\.com)$/i;
const publicConfig = Object.assign({}, config, { ai: { enabled: !!(config.ai && config.ai.enabled) } });

function serveStatic(p, req, res) {
  let rel = decodeURIComponent(p); if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(GAME, rel));
  if (file !== GAME && !file.startsWith(GAME + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<h2>PRO sunucu calisiyor ama dosya yok: ' + rel.replace(/[<>&]/g, '') + '</h2>'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}
async function avatar(u, res) {
  let url; try { url = new URL(u.searchParams.get('u') || ''); } catch (e) { res.writeHead(400); res.end(); return; }
  if (url.protocol !== 'https:' || !AV_OK.test(url.hostname)) { res.writeHead(403); res.end(); return; }
  const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(6000) }).catch(() => null);
  const ct = r && r.headers.get('content-type') || '';
  if (!r || !r.ok || !ct.startsWith('image/')) { res.writeHead(404); res.end(); return; }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 2e6) { res.writeHead(413); res.end(); return; }
  res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'max-age=3600' }); res.end(buf);
}

const send = (obj) => hub.broadcast(JSON.stringify(obj));
const tts = createTts({ config, log });
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost'); const p = u.pathname;
    if (p === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, version: config.version, tts: config.tts.provider, tiktok: SIM ? 'sim' : ttConnected ? '@' + TIKTOK_USER : 'bekliyor', oyun: hub.count() })); return; }
    if (p === '/config.json') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(publicConfig)); return; }
    if (p === '/tts') { await tts.handle(u, res); return; }
    if (p === '/tts-health') { const ok = await tts.health(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok, provider: 'chatterbox' })); return; }
    if (p === '/avatar') { await avatar(u, res); return; }
    serveStatic(p, req, res);
  } catch (e) { try { res.writeHead(500); res.end(); } catch (e2) { /* */ } }
});

const hub = attach(server, {
  onConnect: (c) => { c.send(JSON.stringify({ type: 'hello', version: config.version, mode: SIM ? 'sim' : 'live', tiktok: ttConnected })); log('Oyun baglandi (' + (hub.count()) + ' istemci)'); },
  onMessage: (txt) => { try { const m = JSON.parse(txt); if (m && m.type === 'state') director.setState(m); } catch (e) { /* */ } },
});
const engine = createEngine({ config, wordlist, dataDir: DATA, broadcast: send, log });
const director = createDirector({ config, env, broadcast: send, log, isBanned: (t) => engine.isBanned(t) });

async function ensureThree() {
  const f = path.join(GAME, 'vendor', 'three.module.js'); if (fs.existsSync(f) && fs.statSync(f).size > 100000) return;
  try {
    log('Three.js indiriliyor (tek seferlik)...');
    const r = await fetch('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('Three.js hazir.');
  } catch (e) { log('Three.js indirilemedi (' + e.message + '). Oyun CDN deneyecek.'); }
}

function normalizeGift(d) {
  const u = d.user || {};
  return {
    uniqueId: u.uniqueId, nick: u.nickname || u.uniqueId,
    avatar: u.profilePictureUrl || (u.profilePicture && ((u.profilePicture.url && u.profilePicture.url[0]) || (u.profilePicture.urls && u.profilePicture.urls[0]))) || '',
    giftId: d.giftId, giftType: (d.giftDetails && d.giftDetails.giftType) != null ? d.giftDetails.giftType : (d.giftType || 0),
    giftName: (d.giftDetails && d.giftDetails.giftName) || d.giftName || (d.extendedGiftInfo && (d.extendedGiftInfo.name || d.extendedGiftInfo.giftName)) || (d.gift && d.gift.giftName) || 'Hediye',
    diamondPer: (d.giftDetails && d.giftDetails.diamondCount) || (d.extendedGiftInfo && d.extendedGiftInfo.diamondCount) || d.diamondCount || 1,
    repeatCount: d.repeatCount || 1, repeatEnd: !!d.repeatEnd,
  };
}
let reconnect = null;
function startTikTok() {
  if (!TIKTOK_USER) { log('HATA: bridge/.env icinde TIKTOK_USER yok. BASLAT.bat ile calistir.'); return; }
  let lib; try { lib = require('tiktok-live-connector'); } catch (e) { log('tiktok-live-connector kurulu degil. Sadece --sim calisir.'); return; }
  const { TikTokLiveConnection, WebcastEvent } = lib;
  const conn = new TikTokLiveConnection(TIKTOK_USER, { enableExtendedGiftInfo: true, processInitialData: false });
  conn.on(WebcastEvent.GIFT, (d) => { try { engine.onGift(normalizeGift(d)); } catch (e) { log('GIFT hatasi: ' + e.message); } });
  conn.on(WebcastEvent.CHAT, (d) => { try { const u = d.user || {}; engine.onChat({ uniqueId: u.uniqueId, nick: u.nickname || u.uniqueId, comment: d.comment || '', avatar: u.profilePictureUrl || (u.profilePicture && u.profilePicture.url && u.profilePicture.url[0]) || '' }); } catch (e) { log('CHAT hatasi: ' + e.message); } });
  const retry = (ms) => { if (reconnect) return; reconnect = setTimeout(() => { reconnect = null; go(); }, ms); };
  conn.on(WebcastEvent.STREAM_END, () => { ttConnected = false; send({ type: 'status', tiktok: false }); log('Yayin bitti. 30 sn sonra tekrar.'); retry(30000); });
  const go = () => conn.connect().then(() => { ttConnected = true; send({ type: 'status', tiktok: true }); log('TIKTOK BAGLANDI: @' + TIKTOK_USER); })
    .catch((e) => { ttConnected = false; log('TikTok baglanamadi: ' + e.message + ' (30 sn sonra tekrar)'); retry(30000); });
  go();
}
function startSim() {
  log('SIMULASYON: sahte izleyici/hediye (TikTok yok).');
  const names = ['Seyma', 'Omer Celik', 'Cagla', 'Yilmaz', 'Ibrahim', 'Zeynep Kaya', 'Mert', 'Elif Naz', 'Burak', 'Selin', 'Emre Can', 'Deniz', 'Ayse', 'Kerem', 'Buse', 'Ugur', 'Hulya', 'Ozan', 'Pinar', 'Tugce Su', 'Baran', 'Mehmet Ali', 'Cem', 'Ece'];
  const streakable = [['Rose', 1], ['TikTok', 1], ['Finger Heart', 5], ['Ice Cream Cone', 1], ['Doughnut', 30], ['Perfume', 20]];
  const big = [['Hand Hearts', 100, 0], ['Corgi', 299, 0], ['Galaxy', 1000, 0], ['Lion', 29999, 0]];
  const pickR = (a) => a[Math.floor(Math.random() * a.length)];
  const who = () => { const n = pickR(names); return { uniqueId: 'sim_' + names.indexOf(n), nick: n }; };
  function next() {
    const r = Math.random(); const w = who();
    if (r < 0.4) engine.onChat(Object.assign({ comment: 'merhaba' }, w));
    else if (r < 0.85) {
      const [name, dia] = pickR(streakable); const n = 1 + Math.floor(Math.random() * 12); let i = 0;
      const step = () => { i++; engine.onGift(Object.assign({ giftId: name.length * 7, giftName: name, giftType: 1, diamondPer: dia, repeatCount: i, repeatEnd: i >= n }, w)); if (i < n) setTimeout(step, 250); };
      step();
    } else {
      const [name, dia] = Math.random() < 0.03 ? big[3] : pickR(big.slice(0, 3));
      engine.onGift(Object.assign({ giftId: name.length * 11, giftName: name, giftType: 0, diamondPer: dia, repeatCount: 1, repeatEnd: true }, w));
    }
    setTimeout(next, 900 + Math.random() * 2200);
  }
  setTimeout(next, 3000);
}

function openBrowser(url) {
  if (process.platform !== 'win32' || env.NO_OPEN === '1') return;
  try { require('child_process').spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch (e) { /* */ }
}
function ready(port) {
  PORT = port; const url = 'http://127.0.0.1:' + port + '/';
  console.log('============================================================');
  console.log(' KAPADOKYA BEAT VADISI PRO v' + config.version);
  console.log(' Oyun : ' + url);
  console.log(' OBS  : ' + url + '?auto=1   (1080x1920, 60fps)');
  console.log(' TTS  : Chatterbox (python tts/server.py :5002)  ');
  console.log(' Hesap: ' + (SIM ? '(simulasyon)' : TIKTOK_USER ? '@' + TIKTOK_USER : 'YOK'));
  console.log('============================================================');
  ensureThree(); director.start();
  if (SIM) startSim(); else startTikTok();
  setTimeout(() => openBrowser(url), 1200);
}
function listen(port, left) {
  const onErr = (e) => {
    server.removeListener('listening', onOk);
    if (e.code === 'EADDRINUSE' && left > 0) { log('Port ' + port + ' dolu, ' + (port + 1) + ' deneniyor...'); listen(port + 1, left - 1); }
    else { log('Sunucu hatasi: ' + e.message); process.exit(1); }
  };
  const onOk = () => { server.removeListener('error', onErr); ready(port); };
  server.once('error', onErr); server.once('listening', onOk); server.listen(port, '127.0.0.1');
}
if (require.main === module) listen(PORT, 25);
module.exports = { server, engine, director };
