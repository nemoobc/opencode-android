#!/bin/bash
# ============================================================================
# BUILD APK — opencode-android
# ============================================================================
set -e
cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Config
ABI="arm64-v8a"
SDK_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
AJ="$SDK_HOME/platforms/android-34/android.jar"
AAPT="$SDK_HOME/build-tools/34.0.0/aapt"
D8="$SDK_HOME/build-tools/34.0.0/d8"
APKSIGNER="$SDK_HOME/build-tools/34.0.0/apksigner"
ZIPALIGN="$SDK_HOME/build-tools/34.0.0/zipalign"

# Version from manifest
VER_NAME=$(grep -o 'android:versionName="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
VER_CODE=$(grep -o 'android:versionCode="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
APK_OUT="build/OpenCode-v${VER_NAME}.apk"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  BUILD APK v${VER_NAME} (code ${VER_CODE})${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Pre-check
if [ ! -f "$AJ" ]; then echo -e "${RED}FATAL: android.jar not found${NC}"; exit 1; fi
if [ ! -f "$AAPT" ]; then echo -e "${RED}FATAL: aapt not found${NC}"; exit 1; fi

# Clean
rm -rf build/classes build/gen build/*.apk build/classes.dex build/base.apk build/base-aligned.apk
mkdir -p build/classes

echo "[1/6] javac..."
javac -source 8 -target 8 -nowarn \
  -bootclasspath "$AJ" \
  -d build/classes \
  src/com/nemoobc/opencode/*.java 2>&1 | grep -v "bootstrap class path" || true

if [ ! -d "build/classes/com/nemoobc/opencode" ]; then
    echo -e "${RED}FATAL: javac failed${NC}"
    exit 1
fi
CLASS_COUNT=$(find build/classes -name "*.class" | wc -l)
echo "  Compiled $CLASS_COUNT classes"

echo "[2/6] d8..."
$D8 --release --lib "$AJ" --min-api 26 \
  $(find build/classes -name "*.class") \
  --output build/
echo "  dex: $(ls -la build/classes.dex | awk '{print $5}') bytes"

echo "[3/6] aapt package..."
"$AAPT" package -f \
  -M AndroidManifest.xml \
  -S res \
  -A assets \
  -I "$AJ" \
  -F build/base.apk

echo "[4/6] add dex + native libs..."
cd build
"$AAPT" add base.apk classes.dex

# Add native libs if they exist
cd ..
if [ -d "jniLibs/$ABI" ]; then
    rm -rf build/pkglib && mkdir -p "build/pkglib/lib/$ABI"
    cp -a "jniLibs/$ABI/." "build/pkglib/lib/$ABI/"
    cd build
    for so in pkglib/lib/$ABI/*.so; do
        "$AAPT" add base.apk "$so"
    done
    cd ..
    echo "  native libs added"
else
    echo "  no native libs (lightweight build)"
fi

echo "[5/6] zipalign..."
if [ -n "$ZIPALIGN" ] && [ -x "$ZIPALIGN" ]; then
    $ZIPALIGN -f 4 build/base.apk build/base-aligned.apk
    mv build/base-aligned.apk build/base.apk
    echo "  aligned"
elif [ -f "tools/align.py" ]; then
    python3 tools/align.py build/base.apk build/base-aligned.apk
    mv build/base-aligned.apk build/base.apk
    echo "  aligned (align.py)"
else
    echo "  skipped (no zipalign)"
fi

echo "[6/6] sign..."
# Generate keystore if not exists
if [ ! -f "build/ks.jks" ]; then
    keytool -genkeypair -keystore build/ks.jks -alias oc -keyalg RSA -keysize 2048 \
        -validity 10000 -storepass opencode123 -keypass opencode123 \
        -dname "CN=OpenCode, O=nemoobc, C=ID" 2>/dev/null
fi

$APKSIGNER sign --ks build/ks.jks --ks-pass pass:opencode123 \
    --out "$APK_OUT" build/base.apk

$APKSIGNER verify "$APK_OUT" && echo "  VERIFIED"

# Size
APK_SIZE=$(ls -la "$APK_OUT" | awk '{print $5}')
APK_SIZE_MB=$(echo "scale=1; $APK_SIZE / 1048576" | bc)

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  DONE: $APK_OUT${NC}"
echo -e "${GREEN}  Size: ${APK_SIZE_MB}MB ($APK_SIZE bytes)${NC}"
echo -e "${GREEN}  Version: v${VER_NAME} (code ${VER_CODE})${NC}"
echo -e "${GREEN}============================================${NC}"
