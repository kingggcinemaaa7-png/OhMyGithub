'use strict';
// Chatterbox TTS vekili: oyun /tts?text=... ister -> bridge disk+hafiza onbellegi kullanir,
// yoksa python tts/server.py'ye yonlendirir. Baska saglayici yok.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createTts({ config, log }) {
  const t = (config && config.tts) || {};
  const serverUrl = (t.serverUrl || 'http://127.0.0.1:5002').replace(/\/$/, '');
  const cacheDir = path.join(__dirname, '..', '..', 'data', 'tts-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const mem = new Map();
  const h = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 32);

  async function fetchWav(text) {
    const key = h(text);
    if (mem.has(key)) return { buf: mem.get(key), hit: true };
    const f = path.join(cacheDir, key + '.wav');
    if (fs.existsSync(f)) {
      const buf = fs.readFileSync(f);
      if (mem.size > 60) mem.delete(mem.keys().next().value);
      mem.set(key, buf);
      return { buf, hit: true };
    }
    const url = serverUrl + '/speak?text=' + encodeURIComponent(text.slice(0, 280));
    const r = await fetch(url, { signal: AbortSignal.timeout(t.timeoutMs || 8000) });
    if (!r.ok) throw new Error('TTS HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) throw new Error('TTS bos ses');
    fs.writeFile(f, buf, () => {});
    if (mem.size > 60) mem.delete(mem.keys().next().value);
    mem.set(key, buf);
    return { buf, hit: false };
  }

  async function handle(reqUrl, res) {
    const text = String(reqUrl.searchParams.get('text') || '').slice(0, 280).trim();
    if (!text) { res.writeHead(400); res.end(); return; }
    if (t.enabled === false) { res.writeHead(204); res.end(); return; }
    try {
      const { buf, hit } = await fetchWav(text);
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=86400', 'X-Cache': hit ? 'HIT' : 'MISS', 'Content-Length': buf.length });
      res.end(buf);
    } catch (e) {
      log('TTS vekil hatasi: ' + e.message);
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('TTS kullanilamiyor (tts/server.py calisiyor mu?)');
    }
  }

  async function health() {
    try {
      const r = await fetch(serverUrl + '/health', { signal: AbortSignal.timeout(4000) });
      return r.ok;
    } catch (e) { return false; }
  }

  return { handle, health };
}

module.exports = { createTts };
