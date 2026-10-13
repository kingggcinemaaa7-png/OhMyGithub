# KAPADOKYA BEAT VADİSİ — PRO v2.0.0 (3B profesyonel + Chatterbox TTS)

Dikey (1080×1920) 3B Kapadokya gece festivali — **üretim (prodüksiyon) sürümü**.
İzleyiciler hediye + yorumla sahneye çıkar, rütbe atlar, ismini gökyüzüne yazdırır, DJ olur. Yapay zekâ yönetmen kamerayı/ışığı yönetir.

> **TTS: yalnızca Chatterbox Multilingual V3 (Türkçe). Edge TTS silindi.** Oyun `speechSynthesis`/Edge kullanmaz; ses `tts/server.py` → `bridge /tts` hattından gelir, disk+hafıza önbelleklidir.

## Hızlı kurulum (Windows)

1. Zip/klasörü çıkar → `BASLAT.bat` çift tık. TikTok adını gir.
2. Oyun tarayıcıda açılır → **▶ BAŞLAT** (ses için bir kez tık şart).
3. Önce `SIMULASYON-TEST.bat` ile TikTok'suz dene.

## Gerçek Chatterbox sesi (üretim)

```bat
pip install -r tts\requirements.txt
set TTS_REF_WAV=%CD%\tts\voices\dj-ref.wav   (opsiyonel, 6-15 sn temiz Türkçe ses)
python tts\server.py
```

- Test/mock: `set TTS_MOCK=1` → model indirmeden bip sesi üretir.
- Sağlık: `http://127.0.0.1:5002/health` ve köprü üstünden `http://127.0.0.1:8787/tts-health`.
- Önbellek: `data/tts-cache/*.wav` + `tts/cache/*.wav` (aynı cümle 1 kez üretilir).

## OBS

Kaynak → Tarayıcı → `http://127.0.0.1:8787/?auto=1` → 1080×1920, 60 FPS. Ses tarayıcı kaynağından gelir (TTS dahil).

## PRO 3B yükseltmeler

- PBR zemin + kenar şeritli LED teraslar, gölgeli (PCFSoft) peri bacaları, ışıklı pencereler
- Volumetrik ışık kuleleri + 12 lazer, twinkle yıldız, şafak geçişi, ışıklı balon sepetleri
- 8 dans stili, rütbe ölçeği/hale/taç, kombo aura/kanat/halka, büyük DJ
- 4500 parçacık havuzu, fıskiye + konfeti, 48 meteor, avatarlı gökyüzü yazısı
- Sinematik kamera: 8 plan, kuyruk önceliği, sarsıntı + FOV kick, güvenli clamp
- DROP geri sayım (3-2-1), hype % göstergesi, TTS durum noktası, TikTok güvenli alan çizgileri

## Kurallar (`bridge/config.json`)

Yorum (25 sn) → sahne · hediye → hype · ≥30 anons · ≥200 yıldız · ≥500 gökyüzü · ≥2000 tören · ≥5000 DJ (90 sn) · hype %100 DROP. 7 rütbe kalıcı (`data/users.json`).

## Test

```
cd bridge && node test.js     # 9 kontrol: chatterbox-only, motor kuralları
TTS_MOCK=1 python tts/server.py  # ayrı terminalde, sonra /speak?text=merhaba
```
