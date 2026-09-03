#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  build-ui.sh — UI-only APK rebuild (Termux)
#  Cuma ganti assets/ui (HTML/JS/CSS), TANPA compile Java.
#  Syarat: build/classes.dex + keystore/ks.jks sudah ada
#  (dari build.sh full minimal sekali).
# ============================================================
set -e
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ABI="arm64-v8a"
AJ="dl/android-34/android.jar"
KS_FILE="keystore/ks.jks"
KS_PASS="${OC_KEYSTORE_PASS:-opencode123}"

find_tool() {
    local name="$1"
    if command -v "$name" &>/dev/null; then
        command -v "$name"
    else
        echo ""
    fi
}

AAPT=$(find_tool aapt)
APKSIGNER=$(find_tool apksigner)
KEYTOOL=$(find_tool keytool)

VER_NAME=$(grep -o 'android:versionName="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
APK_OUT="build/OpenCode-v${VER_NAME}.apk"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  UI-ONLY BUILD v${VER_NAME}${NC}"
echo -e "${GREEN}========================================${NC}"

MISSING=""
[ ! -f "$AJ" ] && MISSING="$MISSING android.jar(dl/android-34/)"
[ -z "$AAPT" ] && MISSING="$MISSING aapt"
[ -z "$APKSIGNER" ] && MISSING="$MISSING apksigner"
[ ! -f build/classes.dex ] && MISSING="$MISSING build/classes.dex (jalanin build.sh full dulu)"
# AUTO dulu sebelum vonis missing: pulihkan keystore dari shared storage
KS_SHARED="$HOME/storage/shared/Documents/opencode-keystore/ks.jks"
if [ ! -f "$KS_FILE" ] && [ -f "$KS_SHARED" ]; then
    mkdir -p keystore && cp "$KS_SHARED" "$KS_FILE"
    echo "  keystore dipulihkan otomatis dari shared storage"
fi
[ ! -f "$KS_FILE" ] && MISSING="$MISSING $KS_FILE (jalanin build.sh full dulu)"
if [ -n "$MISSING" ]; then
    echo -e "${RED}MISSING:$MISSING${NC}"
    exit 1
fi

# PENGAMAN key (lihat build.sh): gagalkan kalau beda dari APK existing
if [ -n "$KEYTOOL" ]; then
    CUR_FP="$("$KEYTOOL" -list -v -keystore "$KS_FILE" -storepass "$KS_PASS" 2>/dev/null | grep -i "SHA256:" | head -1 | sed 's/.*SHA256: *//I' | tr -d ' :' | tr 'a-z' 'A-Z')"
    for REF_APK in "$APK_OUT" "$HOME/storage/shared/Documents/OpenCode-v${VER_NAME}.apk"; do
        [ -f "$REF_APK" ] || continue
        REF_FP="$("$APKSIGNER" verify --print-certs "$REF_APK" 2>/dev/null | grep -i "SHA-256" | head -1 | sed 's/.*digest: *//I' | tr -d ' :' | tr 'a-z' 'A-Z')"
        [ -z "$REF_FP" ] && continue
        if [ "$CUR_FP" != "$REF_FP" ]; then
            echo -e "${RED}FATAL: keystore beda dari key $REF_APK — stop, anti APK bentrok${NC}"
            exit 1
        fi
    done
    [ -n "$CUR_FP" ] && echo "  key cocok dgn APK sebelumnya, aman timpa"
fi

# [1/4] aapt package (assets/ui terbaru langsung, tanpa minify-swap ribet)
echo -e "${YELLOW}[1/4] aapt package...${NC}"
rm -f build/base.apk
"$AAPT" package -f \
    -M AndroidManifest.xml \
    -S res \
    -A assets \
    -I "$AJ" \
    -F build/base.apk 2>&1 | grep -v "STRING CACHE" || true

# [2/4] add dex + native libs (reuse)
echo -e "${YELLOW}[2/4] add dex + native libs...${NC}"
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
fi

# [3/4] align
echo -e "${YELLOW}[3/4] align...${NC}"
if command -v zipalign &>/dev/null; then
    zipalign -f 4 build/base.apk build/base-aligned.apk
    mv build/base-aligned.apk build/base.apk
    echo "  aligned (zipalign)"
else
    echo "  skipped (no align tool)"
fi

# [4/4] sign (keystore auto-survive: sudah dipulihkan di atas bila hilang)
echo -e "${YELLOW}[4/4] sign...${NC}"
rm -f "$APK_OUT" "$APK_OUT.idsig"
"$APKSIGNER" sign --ks "$KS_FILE" --ks-pass pass:"$KS_PASS" \
    --out "$APK_OUT" build/base.apk

"$APKSIGNER" verify "$APK_OUT" && echo "  VERIFIED"

APK_SIZE=$(stat -c%s "$APK_OUT" 2>/dev/null || echo "?")
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DONE: $APK_OUT${NC}"
echo -e "${GREEN}  Size: $APK_SIZE bytes${NC}"
echo -e "${GREEN}========================================${NC}"
