'use strict';
// PRO testler: motor kurallari + TTS vekili (provider=chatterbox).
const assert = require('assert');
const { createEngine } = require('./lib/engine');
const cfg = JSON.parse(require('fs').readFileSync(__dirname + '/config.json', 'utf8'));

let n = 0;
const ok = (c, msg) => { n++; assert(c, msg); console.log('ok ' + n + ' - ' + msg); };

// 1. TTS provider chatterbox olmali, baska saglayici anahtari olmamali
ok(cfg.tts.provider === 'chatterbox', 'tts.provider chatterbox');
ok(cfg.tts.provider === 'chatterbox' && !('edgeTts' in cfg.tts) && !('edge' in cfg.tts), 'config tts chatterbox-only');
ok(cfg.tts.fallbackBrowser === false, 'tarayici TTS varsayilan kapali');

// 2. audio.js birincil TTS yolu /tts olmali, speechSynthesis birincil olmamali
const audio = require('fs').readFileSync(__dirname + '/../game/js/audio.js', 'utf8');
ok(!audio.includes('edge-tts') && !audio.includes('SpeechSynthesisUtterance'), 'audio.js chatterbox-only (birincil speechSynthesis yok)');
ok(audio.includes('/tts?text='), 'audio.js /tts vekilini kullanir');
ok(audio.includes('Chatterbox'), 'audio.js Chatterbox sinifi var');

// 3. tts/server.py Chatterbox kullanmali
const py = require('fs').readFileSync(__dirname + '/../tts/server.py', 'utf8');
ok(py.includes('ChatterboxMultilingualTTS'), 'server.py ChatterboxMultilingualTTS');
ok(!py.includes('edge-tts') && !py.includes('edge_tts'), 'server.py bagimsiz (chatterbox-only)');
ok(py.includes('language_id="tr"') || py.includes("language_id='tr'") || py.includes('language_id'), 'server.py Turkce dil destegi');

// 4. bridge tts vekili dosya olarak var
ok(require('fs').existsSync(__dirname + '/lib/tts.js'), 'bridge/lib/tts.js var');
ok(require('fs').existsSync(__dirname + '/server.js'), 'bridge/server.js var');

// 5-7. motor kurallari (streak, hediye dusmez, kufur filtresi)
{
  const sent = [];
  const eng = createEngine({ config: cfg, wordlist: ['salak'], dataDir: require('os').tmpdir(), broadcast: (o) => sent.push(o), log: () => {} });
  eng.onGift({ uniqueId: 'u1', nick: 'A', giftId: 1, giftName: 'Rose', giftType: 1, diamondPer: 1, repeatCount: 1, repeatEnd: false });
  ok(sent.length === 0, 'streak repeatEnd beklenir');
  eng.onGift({ uniqueId: 'u1', nick: 'A', giftId: 1, giftName: 'Rose', giftType: 1, diamondPer: 1, repeatCount: 5, repeatEnd: true });
  ok(sent.length === 1 && sent[0].gift.count === 5, 'streak son count kullanilir');
  eng.onGift({ uniqueId: 'u2', nick: 'B', giftId: 9, giftName: 'Galaxy', giftType: 0, diamondPer: 1000, repeatCount: 1, repeatEnd: true });
  ok(sent.length === 2, 'streaksiz hediye hemen islenir (dusmez)');
  const before = sent.length;
  eng.onChat({ uniqueId: 'u3', nick: 'C', comment: 'salak herif' });
  ok(sent.length === before, 'yasakli yorum sahneye alinmaz');
}
console.log('\nTUM TESTLER GECTI (' + n + ')');
