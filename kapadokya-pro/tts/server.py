# Chatterbox TTS üretim servisi — Kapadokya Beat Vadisi PRO
# Tek sağlayıcı: Chatterbox Multilingual V3 (Türkçe `tr`).
# Çalıştır:  python server.py  (varsayılan :5002)
# Ortam: TTS_PORT, TTS_MOCK=1 (model indirmeden test), TTS_DEVICE=cuda/cpu,
#        TTS_REF_WAV (klonlanacak ses), TTS_EXAGGERATION, TTS_TEMPERATURE
import hashlib
import io
import math
import os
import struct
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

PORT = int(os.environ.get("TTS_PORT", "5002"))
MOCK = os.environ.get("TTS_MOCK", "0") == "1"
DEVICE = os.environ.get("TTS_DEVICE", "cpu")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

_model = None

def mock_wav(text, sr=24000):
    # Üretim dışı test sesi: metin uzunluğuna göre süreli yumuşak ton.
    dur = max(0.8, min(6.0, 0.6 + len(text) * 0.06))
    n = int(sr * dur)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        for i in range(n):
            t = i / sr
            env = min(1.0, i / (sr * 0.1), (n - i) / (sr * 0.2))
            f = 220 + 110 * math.sin(2 * math.pi * 2 * t)
            v = int(12000 * env * math.sin(2 * math.pi * f * t))
            w.writeframes(struct.pack("<h", v))
    return buf.getvalue()

def real_wav(text):
    global _model
    if _model is None:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        _model = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE, t3_model="v3")
    ref = os.environ.get("TTS_REF_WAV", "")
    kw = dict(language_id="tr", exaggeration=float(os.environ.get("TTS_EXAGGERATION", "0.5")), temperature=float(os.environ.get("TTS_TEMPERATURE", "0.8")))
    if ref and os.path.exists(ref):
        kw["audio_prompt_path"] = ref
    wav = _model.generate(text, **kw)
    import torch, torchaudio
    buf = io.BytesIO()
    # chatterbox wav: [1, T] float tensor
    ta_wav = wav.cpu() if hasattr(wav, "cpu") else wav
    torchaudio.save(buf, ta_wav, _model.sr, format="wav")
    return buf.getvalue()

def synth(text):
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]
    p = os.path.join(CACHE_DIR, h + ".wav")
    if os.path.exists(p):
        with open(p, "rb") as f:
            return f.read(), True
    data = mock_wav(text) if MOCK else real_wav(text)
    try:
        with open(p, "wb") as f:
            f.write(data)
    except OSError:
        pass
    return data, False

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/health":
            body = b'{"ok":true,"provider":"chatterbox","mock":%s}' % (b"true" if MOCK else b"false")
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers()
            self.wfile.write(body)
            return
        if u.path in ("/speak", "/tts"):
            q = parse_qs(u.query)
            text = (q.get("text", [""])[0] or "")[:280]
            text = unquote(text).strip()
            if not text:
                self.send_response(400); self._cors(); self.end_headers(); return
            try:
                data, cached = synth(text)
            except Exception as e:
                msg = ("TTS hatasi: " + str(e)).encode("utf-8")
                self.send_response(500); self._cors()
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(msg))); self.end_headers()
                self.wfile.write(msg); return
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "audio/wav")
            self.send_header("X-Cache", "HIT" if cached else "MISS")
            self.send_header("Cache-Control", "public, max-age=86400")
            self.send_header("Content-Length", str(len(data))); self.end_headers()
            self.wfile.write(data)
            return
        self.send_response(404); self._cors(); self.end_headers()

if __name__ == "__main__":
    print(f"[tts] Chatterbox PRO ready :{PORT} mock={MOCK} device={DEVICE}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
