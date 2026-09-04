#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  build.sh — OpenCode Android APK Builder (Termux)
# ============================================================
set -e
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ABI="${OCX_ABI:-arm64-v8a}"
if [ ! -d "jniLibs/$ABI" ]; then
    echo -e "${RED}FATAL: jniLibs/$ABI tidak ada. OCX_ABI salah?${NC}"
    exit 1
fi
AJ="dl/android-34/android.jar"
# Password keystore dibaca dari file license.key (TIDAK di-commit, .gitignore).
# File ini yang kamu jaga (1 file kecil). keystore/ks.jks boleh di repo.
# Bikin sekali (lihat README):  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32 > license.key
if [ ! -f "license.key" ]; then
    echo -e "${RED}FATAL: license.key tidak ada.${NC}"
    echo "Bikin sekali:  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32 > license.key"
    echo "Lalu simpan copy-nya di Drive/password manager. Tanpa file ini = tidak bisa build."
    exit 1
fi
KS_PASS="$(head -c 1024 license.key | tr -d '\r\n')"
if [ -z "$KS_PASS" ]; then
    echo -e "${RED}FATAL: license.key kosong.${NC}"
    exit 1
fi

# auto-detect tools
find_tool() {
    local name="$1"
    if command -v "$name" &>/dev/null; then
        command -v "$name"
    else
        echo ""
    fi
}

AAPT=$(find_tool aapt)
D8=${D8_CMD:-$(find_tool d8)}
APKSIGNER=$(find_tool apksigner)
KEYTOOL=$(find_tool keytool)
PYTHON=$(find_tool python3)

# version from manifest
VER_NAME=$(grep -o 'android:versionName="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
VER_CODE=$(grep -o 'android:versionCode="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
APK_OUT="build/OpenCode-v${VER_NAME}.apk"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  BUILD APK v${VER_NAME} (code ${VER_CODE})${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# pre-check
MISSING=""
[ -z "$AJ" ] || [ ! -f "$AJ" ] && MISSING="$MISSING android.jar(dl/android-34/)"
[ -z "$AAPT" ] && MISSING="$MISSING aapt"
[ -z "$D8" ] && MISSING="$MISSING d8"
[ -z "$APKSIGNER" ] && MISSING="$MISSING apksigner"
[ -z "$KEYTOOL" ] && MISSING="$MISSING keytool"

if [ -n "$MISSING" ]; then
    echo -e "${RED}MISSING:$MISSING${NC}"
    echo "Install: pkg install aapt d8 apksigner openjdk-21"
    exit 1
fi

echo -e "${GREEN}[ok]${NC} aapt  = $AAPT"
echo -e "${GREEN}[ok]${NC} d8    = $D8"
echo -e "${GREEN}[ok]${NC} sign  = $APKSIGNER"
echo -e "${GREEN}[ok]${NC} java  = $($KEYTOOL 2>&1 | head -1)"
echo -e "${GREEN}[ok]${NC} android.jar = $AJ ($(du -h "$AJ" | cut -f1))"
echo ""

# clean
rm -rf build/classes build/gen build/*.apk build/classes.dex build/base.apk
mkdir -p build/classes

# [1/7] compile java
echo -e "${YELLOW}[1/7] javac...${NC}"
SRC_FILES=$(find src/com/nemoobc/opencode -name "*.java")
javac -source 8 -target 8 -nowarn \
    -bootclasspath "$AJ" \
    -d build/classes \
    $SRC_FILES 2>&1 | grep -v "bootstrap class path" || true

if [ ! -d "build/classes/com/nemoobc/opencode" ]; then
    echo -e "${RED}FATAL: javac failed${NC}"
    exit 1
fi
CLASS_COUNT=$(find build/classes -name "*.class" | wc -l)
echo "  compiled $CLASS_COUNT classes"

# [2/7] dex
echo -e "${YELLOW}[2/7] d8...${NC}"
CLASS_FILES=$(find build/classes -name "*.class")
$D8 --release --lib "$AJ" --min-api 26 \
    $CLASS_FILES \
    --output build/
echo "  dex: $(wc -c < build/classes.dex) bytes"

# [3/7] minify js/css (build copy, jangan in-place)
echo -e "${YELLOW}[3/7] minify js/css...${NC}"
if [ -f "tools/minify.py" ] && [ -n "$PYTHON" ]; then
    rm -rf build/ui
    cp -a assets/ui build/ui
    $PYTHON tools/minify.py build/ui/js/ 2>&1
    $PYTHON tools/minify.py build/ui/css/ 2>&1
    echo "  minified (build/ui)"
else
    rm -rf build/ui
    cp -a assets/ui build/ui
    echo "  skipped (no python, using original)"
fi

# [4/7] aapt package (pakai minified assets)
echo -e "${YELLOW}[4/7] aapt package...${NC}"
if [ -d "build/ui" ]; then
    mv assets/ui build/ui-orig
    cp -a build/ui assets/ui
fi
"$AAPT" package -f \
    -M AndroidManifest.xml \
    -S res \
    -A assets \
    -I "$AJ" \
    -F build/base.apk
if [ -d "build/ui-orig" ]; then
    rm -rf assets/ui && mv build/ui-orig assets/ui
fi

# [5/7] add dex + native libs
echo -e "${YELLOW}[5/7] add dex + native libs...${NC}"
cd build
"$AAPT" add base.apk classes.dex
cd ..

if [ -d "jniLibs/$ABI" ]; then
    rm -rf build/pkglib && mkdir -p "build/pkglib/lib/$ABI"
    cp -a "jniLibs/$ABI/." "build/pkglib/lib/$ABI/"
    cd build/pkglib
    for so in $(find . -type f | sed 's|^\./||'); do
        "$AAPT" add ../base.apk "$so"
    done
    cd ../..
    echo "  native libs added"
else
    echo "  no native libs"
fi

# [6/7] align
echo -e "${YELLOW}[6/7] align...${NC}"
if [ -f "tools/align.py" ] && [ -n "$PYTHON" ]; then
    $PYTHON tools/align.py build/base.apk build/base-aligned.apk
    mv build/base-aligned.apk build/base.apk
    echo "  aligned (align.py)"
elif command -v zipalign &>/dev/null; then
    zipalign -f 4 build/base.apk build/base-aligned.apk
    mv build/base-aligned.apk build/base.apk
    echo "  aligned (zipalign)"
else
    echo "  skipped (no align tool)"
fi

# [7/7] sign — keystore TIDAK di repo (rahasia).
#  Urutan cari: keystore/ks.jks (lokal) → shared storage (auto-restore).
#  Ga ada dua-duanya = bikin BARU (hati2: key baru = user uninstall dulu).
#  Password dari file license.key (gitignored, jangan commit).
echo -e "${YELLOW}[7/7] sign...${NC}"
KS_FILE="keystore/ks.jks"
KS_SHARED="$HOME/storage/shared/Documents/opencode-keystore/ks.jks"
mkdir -p keystore
if [ ! -f "$KS_FILE" ] && [ -f "$KS_SHARED" ]; then
    cp "$KS_SHARED" "$KS_FILE"
    echo "  keystore dipulihkan dari shared storage"
fi
if [ ! -f "$KS_FILE" ]; then
    "$KEYTOOL" -genkeypair -keystore "$KS_FILE" -alias oc \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass "$KS_PASS" -keypass "$KS_PASS" \
        -dname "CN=OpenCode, O=nemoobc, C=ID" 2>/dev/null
    echo "  keystore BARU dibuat (satu-satunya — dijaga otomatis)"
fi
# cadangkan ke shared storage (tahan reset) + ingatkan backup luar
if mkdir -p "$(dirname "$KS_SHARED")" 2>/dev/null && cp "$KS_FILE" "$KS_SHARED" 2>/dev/null; then
    echo "  keystore aman: lokal + shared storage"
else
    echo -e "${RED}  ! shared storage ga bisa tulis — jalanin termux-setup-storage${NC}"
    echo "  ! keystore cuma lokal. BACKUP MANUAL: copy keystore/ks.jks ke Drive"
fi
echo "  TIPS: copy Documents/opencode-keystore/ks.jks ke Drive/PC. Hilang = update bentrok permanen."

# DEV GATE: tanam hash license.key (bukan password!) sebagai JS.
# Gerbang developer cocokkan sha256 file pilihan user dgn hash ini.
# File devkey.js diregenerate tiap build, TIDAK di-commit (langsung baca,
# tanpa fetch — fetch file:// sering diblokir WebView).
if [ -f "license.key" ]; then
    LK_FP="$(sha256sum license.key 2>/dev/null | cut -d' ' -f1 || openssl dgst -sha256 license.key 2>/dev/null | awk '{print $NF}')"
    if [ -n "$LK_FP" ]; then
        printf 'window.DEVKEY="%s";\n' "$LK_FP" > assets/ui/js/devkey.js
        echo "  devkey tertanam (hash only)"
    fi
fi

# PENGAMAN: pastikan key = key APK yang sudah terpasang/rilis.
# Kalau beda, GAGALKAN build — jangan hasilkan APK bentrok diam-diam.
cert_fp_ks() {
    "$KEYTOOL" -list -v -keystore "$1" -storepass "$KS_PASS" 2>/dev/null \
        | grep -i "SHA256:" | head -1 | sed 's/.*SHA256: *//I' | tr -d ' :' | tr 'a-z' 'A-Z'
}
cert_fp_apk() {
    "$APKSIGNER" verify --print-certs "$1" 2>/dev/null \
        | grep -i "SHA-256" | head -1 | sed 's/.*digest: *//I' | tr -d ' :' | tr 'a-z' 'A-Z'
}
CUR_FP="$(cert_fp_ks "$KS_FILE")"
CHECKED=0
for REF_APK in "$APK_OUT" "$HOME/storage/shared/Documents/OpenCode-v${VER_NAME}.apk"; do
    [ -f "$REF_APK" ] || continue
    REF_FP="$(cert_fp_apk "$REF_APK")"
    [ -z "$REF_FP" ] && continue
    CHECKED=1
    if [ "$CUR_FP" != "$REF_FP" ]; then
        echo -e "${RED}FATAL: keystore beda dari key $REF_APK${NC}"
        echo "JANGAN lanjut — hasilnya APK bentrok, ga bisa timpa install."
        echo "Pulihkan: copy keystore bener ke keystore/ks.jks (cek Drive / Documents/opencode-keystore/)"
        echo "Atau sadar: uninstall app di HP dulu, baru install APK baru (data chat hilang)."
        exit 1
    fi
done
[ "$CHECKED" = 1 ] && echo "  key cocok dgn APK sebelumnya, aman timpa"
[ "$CHECKED" = 0 ] && echo "  key baru (tidak ada APK pembanding) — pastikan HP uninstall versi lama dulu"

"$APKSIGNER" sign --ks "$KS_FILE" --ks-pass pass:"$KS_PASS" \
    --out "$APK_OUT" build/base.apk

"$APKSIGNER" verify "$APK_OUT" && echo "  VERIFIED"

# done
APK_SIZE=$(stat -c%s "$APK_OUT" 2>/dev/null || stat -f%z "$APK_OUT" 2>/dev/null || echo "?")
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DONE: $APK_OUT${NC}"
echo -e "${GREEN}  Size: $APK_SIZE bytes${NC}"
echo -e "${GREEN}  Version: v${VER_NAME} (code ${VER_CODE})${NC}"
echo -e "${GREEN}========================================${NC}"
