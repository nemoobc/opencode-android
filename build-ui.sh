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
[ ! -f "$KS_FILE" ] && MISSING="$MISSING $KS_FILE (jalanin build.sh full dulu)"
if [ -n "$MISSING" ]; then
    echo -e "${RED}MISSING:$MISSING${NC}"
    exit 1
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

# [4/4] sign (keystore permanen — key sama, install timpa OK)
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
