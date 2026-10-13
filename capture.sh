#!/usr/bin/env bash
# Onizleme yakalama: CAPTURE_URL + CAPTURE_DIR kullanir, masaustu + mobil
# goruntuyu final-desktop.png / final-mobile.png olarak yazar, kendi
# tarayicisini kapatir, uygulamayi calisir birakir.
# Cikis: 75 gecici gezinme/tarayici altyapi hatasi, 1 betik/render hatasi.
set -euo pipefail
# NOT: `cd` kabuk yerlesigidir; /usr/bin/time ile calistirilamaz. Zamanlama
# yalnizca harici komutlarda /usr/bin/time -p ile yapilir.
cd "$(dirname "$0")"
# RUNTIME_DIR normalde worker ortaminda gelir; yoksa varsayilan konuma dus.
RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
if [ -z "${CAPTURE_URL:-}" ]; then echo 'CAPTURE_URL required' >&2; exit 1; fi
if [ -z "${CAPTURE_DIR:-}" ]; then echo 'CAPTURE_DIR required' >&2; exit 1; fi
export CAPTURE_URL CAPTURE_DIR RUNTIME_DIR
/usr/bin/time -p bash -n capture.sh
/usr/bin/time -p test -f "$RUNTIME_DIR/scripts/default-capture.mjs"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-mobile.png"
/usr/bin/time -p ls -la "$CAPTURE_DIR"
