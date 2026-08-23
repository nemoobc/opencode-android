#!/bin/bash
set -e
cd "$(dirname "$0")"
AJ=dl/android-34/android.jar
rm -rf build/classes build/gen build/*.apk build/classes.dex
mkdir -p build/classes

echo "[1/6] javac..."
javac -source 8 -target 8 -nowarn \
  -bootclasspath $AJ \
  -d build/classes \
  src/com/nemoobc/opencode/*.java 2>&1 | grep -v "bootstrap class path" || true

echo "[2/6] d8..."
D8_BIN="${D8_CMD:-d8}"
$D8_BIN --release --lib $AJ --min-api 26 \
  $(find build/classes -name "*.class") \
  --output build/

echo "[3/6] aapt package..."
aapt package -f \
  -M AndroidManifest.xml \
  -S res \
  -A assets \
  -I $AJ \
  -F build/base.apk

echo "[4/6] tambahkan dex + native libs..."
cd build
aapt add base.apk classes.dex
cd ..
rm -rf build/pkglib && mkdir -p build/pkglib/lib
cp -a jniLibs/arm64-v8a build/pkglib/lib/arm64-v8a
cd build/pkglib
aapt add ../base.apk $(find . -type f | sed 's|^\./||')
cd ../..

echo "[5/6] keystore..."
if [ ! -f build/ks.jks ]; then
  keytool -genkeypair -keystore build/ks.jks -alias oc \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass opencode123 -keypass opencode123 \
    -dname "CN=OpenCode, O=nemoobc, C=ID" 2>/dev/null
fi

echo "[6/6] sign + verify..."
apksigner sign --ks build/ks.jks --ks-pass pass:opencode123 \
  --out build/OpenCode-v1.1.3.apk build/base.apk
apksigner verify build/OpenCode-v1.1.3.apk && echo "VERIFIED"
ls -la build/*.apk
