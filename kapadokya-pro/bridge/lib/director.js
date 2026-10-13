'use strict';
// AI yonetmen: her tickSec saniyede bir oyunun durumuna bakip sahne/kamera/isik/duyuru onerir.
// Saglayici-bagimsiz (OpenAI uyumlu /chat/completions). Anahtar yoksa veya hata olursa YEREL yonetmen devreye girer.
const EVENTS = ['drop', 'starRain', 'lightCeremony', 'dawn', 'laserShow'];
const CAMS = ['wide', 'orbit', 'crane', 'dj', 'sky', 'crowd'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function createDirector({ config, env, broadcast, log, isBanned, now = () => Date.now() }) {
  const ai = Object.assign({}, config.ai);
  if (env.AI_BASE_URL) ai.baseUrl = env.AI_BASE_URL;
  if (env.AI_MODEL) ai.model = env.AI_MODEL;
  const key = env.AI_API_KEY || '';
  let state = { hype: 0, dancers: 0, dj: false };
  const lastEv = {}; const history = [];
  let fails = 0; let pausedUntil = 0; let timer = null; let usingAi = false;

  function available() {
    const t = now();
    return EVENTS.filter((e) => !lastEv[e] || t - lastEv[e] > (config.cooldownSec[e] || 30) * 1000);
  }
  function localPlan() {
    const av = available(); const a = { event: 'none', camera: pick(CAMS), palette: Math.floor(Math.random() * 4), say: '' };
    if ((state.hype || 0) >= 80 && av.includes('drop')) a.event = 'drop';
    else if (Math.random() < 0.3 && av.length) a.event = pick(av.filter((e) => e !== 'drop' && e !== 'dawn') .concat(['none']));
    if (Math.random() < 0.08 && av.includes('dawn')) a.event = 'dawn';
    if ((state.dancers || 0) < 3) a.say = pick(['Vadi seni bekliyor! Yorum yaz, sahneye gel!', 'Gece daha yeni başlıyor!']);
    return a;
  }
  function sanitize(a) {
    const out = { event: 'none', camera: '', palette: -1, say: '' };
    if (a && EVENTS.includes(a.event) && available().includes(a.event) && !history.slice(-5).includes(a.event)) out.event = a.event; // tekrar korumasi
    if (a && CAMS.includes(a.camera)) out.camera = a.camera;
    if (a && Number.isInteger(a.palette) && a.palette >= 0 && a.palette <= 3) out.palette = a.palette;
    if (a && typeof a.say === 'string') {
      let s = a.say.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 110);
      if (s.split(/\s+/).length > 18) s = s.split(/\s+/).slice(0, 18).join(' ');
      if (s && !isBanned(s) && !/(gerçek para|ödül|kazan|bahis|hediye at)/i.test(s)) out.say = s;
    }
    return out;
  }
  async function askAi() {
    const sys = 'Sen "Kapadokya Beat Vadisi" adlı TikTok LIVE şovunun yapay zeka yönetmenisin (DJ Kapadokya). ' +
      'YALNIZCA tek bir JSON nesnesi döndür: {"event":"drop|starRain|lightCeremony|dawn|laserShow|none","camera":"wide|orbit|crane|dj|sky|crowd","palette":0-3,"say":"en fazla 15 kelime Türkçe duyuru ya da boş"}. ' +
      'Kurallar: son olayları tekrar etme; hype>80 ise drop öncelikli; sahne boşsa say ile izleyiciyi yorum yazmaya davet et; gerçek para/ödül vaadi, kumar dili ve hediye baskısı YASAK.';
    const body = { model: ai.model, temperature: 0.8, max_tokens: 200, messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify({ state, availableEvents: available(), lastEvents: history.slice(-8) }) }] };
    const r = await fetch(ai.baseUrl.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body), signal: AbortSignal.timeout(ai.timeoutMs || 6000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); const txt = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    const m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('JSON yok');
    return JSON.parse(m[0]);
  }
  async function tick() {
    let plan = null;
    if (ai.enabled && key && now() >= pausedUntil) {
      try { plan = await askAi(); fails = 0; if (!usingAi) { usingAi = true; log('AI yönetmen çalışıyor (' + ai.model + ')'); } }
      catch (e) {
        fails++; log('AI yönetmen hatası (' + fails + '/3): ' + (e.message || e).toString().replace(key, '***'));
        if (fails >= 3) { pausedUntil = now() + 5 * 60 * 1000; fails = 0; usingAi = false; log('AI 5 dk duraklatıldı, yerel yönetmenle devam.'); }
      }
    }
    const a = sanitize(plan || localPlan());
    if (a.event !== 'none') { lastEv[a.event] = now(); history.push(a.event); } else history.push('-');
    if (history.length > 30) history.shift();
    broadcast({ type: 'director', action: a, source: plan ? 'ai' : 'local' });
  }
  return {
    setState(s) { if (s && typeof s === 'object') state = { hype: +s.hype || 0, dancers: +s.dancers || 0, dj: !!s.dj }; },
    start() { if (!key) log('AI anahtarı yok (bridge/.env AI_API_KEY) → yerel yönetmen kullanılacak.'); timer = setInterval(tick, (ai.tickSec || 30) * 1000); setTimeout(tick, 15000); },
    stop() { clearInterval(timer); },
    tick, sanitize,
  };
}
module.exports = { createDirector };
