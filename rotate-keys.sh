#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  rotate-keys.sh — Rotasi license.key + keystore (Termux)
#  Dipakai saat password signing bocor / mau ganti password.
#
#  UWAGA: key baru = sidik APK beda = user HARUS uninstall dulu
#  sekali (backup chat via menu sebelum itu). Update berikut
#  TIMPA biasa lagi.
# ============================================================
set -e
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -f "license.key" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  cp license.key "license.key.bak.$TS"
  echo -e "${YELLOW}[1/3] backup license.key lama -> license.key.bak.$TS${NC}"
fi
if [ -f "keystore/ks.jks" ]; then
  TS="${TS:-$(date +%Y%m%d-%H%M%S)}"
  cp keystore/ks.jks "keystore/ks.jks.bak.$TS"
  echo -e "${YELLOW}[2/3] backup keystore lama -> keystore/ks.jks.bak.$TS${NC}"
fi

tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32 > license.key
chmod 600 license.key
echo -e "${GREEN}[3/3] license.key BARU dibuat (32 char). Copy ke Drive/password manager SEKARANG.${NC}"
echo ""
echo -e "${RED}WAJIB: hapus keystore lama biar build lahirkan pasangan baru:${NC}"
echo "  rm keystore/ks.jks && bash build.sh"
echo ""
echo "Lalu: user uninstall app sekali -> install APK baru -> update timpa biasa."
