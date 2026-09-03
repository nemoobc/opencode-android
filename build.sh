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

ABI="arm64-v8a"
AJ="dl/android-34/android.jar"
KS_PASS="${OC_KEYSTORE_PASS:-opencode123}"

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
D8=$(find_tool d8)
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

# [7/7] sign (keystore PERMANEN di keystore/ — jangan di build/,
#  karena build/ boleh dihapus. Key beda = install bentrok.)
echo -e "${YELLOW}[7/7] sign...${NC}"
KS_FILE="keystore/ks.jks"
mkdir -p keystore
if [ ! -f "$KS_FILE" ]; then
    "$KEYTOOL" -genkeypair -keystore "$KS_FILE" -alias oc \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass "$KS_PASS" -keypass "$KS_PASS" \
        -dname "CN=OpenCode, O=nemoobc, C=ID" 2>/dev/null
    echo "  keystore baru: $KS_FILE (JAGA — ganti key = install bentrok)"
else
    echo "  keystore lama dipakai: $KS_FILE"
fi

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
