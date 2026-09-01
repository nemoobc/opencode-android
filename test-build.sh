#!/bin/bash
# ============================================================================
# TEST BUILD — opencode-android APK
# ============================================================================
# Jalankan: bash test-build.sh
# Tujuan: cek SEMUA bahan & tools sebelum build beneran.
# Kalau semua PASS → langsung jalankan: bash build-apk.sh
# ============================================================================

set -e
cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

ok()   { echo -e "  ${GREEN}PASS${NC}  $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${YELLOW}WARN${NC}  $1"; WARN=$((WARN+1)); }

echo "============================================"
echo "  TEST BUILD — opencode-android"
echo "============================================"
echo ""

# -------------------------------------------------------
# 1. ENVIRONMENT
# -------------------------------------------------------
echo "--- [1/8] Environment ---"

# Java
if command -v java &>/dev/null; then
    JAVA_VER=$(java -version 2>&1 | head -1)
    ok "java: $JAVA_VER"
else
    fail "java: not found"
fi

if command -v javac &>/dev/null; then
    JAVAC_VER=$(javac -version 2>&1 | head -1)
    ok "javac: $JAVAC_VER"
else
    fail "javac: not found"
fi

# Detect SDK paths
if [ -n "$ANDROID_HOME" ]; then
    SDK_HOME="$ANDROID_HOME"
elif [ -d "$HOME/android-sdk" ]; then
    SDK_HOME="$HOME/android-sdk"
elif [ -d "/usr/local/lib/android/sdk" ]; then
    SDK_HOME="/usr/local/lib/android/sdk"
else
    SDK_HOME=""
fi

if [ -n "$SDK_HOME" ]; then
    ok "ANDROID_HOME: $SDK_HOME"
else
    fail "ANDROID_HOME: not found (set ANDROID_HOME or install Android SDK)"
fi

# -------------------------------------------------------
# 2. ANDROID SDK TOOLS
# -------------------------------------------------------
echo ""
echo "--- [2/8] Android SDK Tools ---"

# aapt
AAPT=""
for p in \
    "$SDK_HOME/build-tools/34.0.0/aapt" \
    "$SDK_HOME/build-tools/33.0.0/aapt" \
    "$(command -v aapt 2>/dev/null)"; do
    if [ -f "$p" ] && [ -x "$p" ]; then
        AAPT="$p"
        break
    fi
done
if [ -n "$AAPT" ]; then
    ok "aapt: $AAPT"
else
    fail "aapt: not found in SDK build-tools"
fi

# d8
D8=""
for p in \
    "$SDK_HOME/build-tools/34.0.0/d8" \
    "$SDK_HOME/build-tools/33.0.0/d8" \
    "$(command -v d8 2>/dev/null)"; do
    if [ -f "$p" ] && [ -x "$p" ]; then
        D8="$p"
        break
    fi
done
# Also check d8.jar (needs java -cp)
if [ -z "$D8" ]; then
    for p in \
        "$SDK_HOME/build-tools/34.0.0/lib/d8.jar" \
        "$SDK_HOME/cmdline-tools/latest/lib/d8.jar"; do
        if [ -f "$p" ]; then
            D8="java -cp $p com.android.tools.r8.D8"
            break
        fi
    done
fi
if [ -n "$D8" ]; then
    ok "d8: $D8"
else
    fail "d8: not found"
fi

# apksigner
APKSIGNER=""
for p in \
    "$SDK_HOME/build-tools/34.0.0/apksigner" \
    "$SDK_HOME/build-tools/33.0.0/apksigner" \
    "$(command -v apksigner 2>/dev/null)"; do
    if [ -f "$p" ] && [ -x "$p" ]; then
        APKSIGNER="$p"
        break
    fi
done
if [ -n "$APKSIGNER" ]; then
    ok "apksigner: $APKSIGNER"
else
    fail "apksigner: not found"
fi

# zipalign
ZIPALIGN=""
for p in \
    "$SDK_HOME/build-tools/34.0.0/zipalign" \
    "$SDK_HOME/build-tools/33.0.0/zipalign"; do
    if [ -f "$p" ] && [ -x "$p" ]; then
        ZIPALIGN="$p"
        break
    fi
done
if [ -n "$ZIPALIGN" ]; then
    ok "zipalign: $ZIPALIGN"
else
    warn "zipalign: not found (will use align.py fallback)"
fi

# keytool
if command -v keytool &>/dev/null; then
    ok "keytool: $(command -v keytool)"
else
    fail "keytool: not found"
fi

# -------------------------------------------------------
# 3. ANDROID.JAR
# -------------------------------------------------------
echo ""
echo "--- [3/8] Android Platform ---"

AJ=""
for p in \
    "dl/android-34/android.jar" \
    "$SDK_HOME/platforms/android-34/android.jar" \
    "$SDK_HOME/platforms/android-33/android.jar"; do
    if [ -f "$p" ]; then
        AJ="$p"
        break
    fi
done
if [ -n "$AJ" ]; then
    AJ_SIZE=$(ls -la "$AJ" | awk '{print $5}')
    ok "android.jar: $AJ ($(( AJ_SIZE / 1024 / 1024 ))MB)"
else
    fail "android.jar: not found (need platforms/android-34 or dl/android-34/android.jar)"
fi

# -------------------------------------------------------
# 4. SOURCE FILES
# -------------------------------------------------------
echo ""
echo "--- [4/8] Source Files ---"

JAVA_DIR="src/com/nemoobc/opencode"
for f in MainActivity.java TarExtractor.java; do
    if [ -f "$JAVA_DIR/$f" ]; then
        ok "$f"
    else
        fail "$f: missing"
    fi
done
# Diagnostics.java (optional)
if [ -f "$JAVA_DIR/Diagnostics.java" ]; then
    ok "Diagnostics.java"
else
    warn "Diagnostics.java: not found (optional)"
fi

# -------------------------------------------------------
# 5. ANDROID MANIFEST
# -------------------------------------------------------
echo ""
echo "--- [5/8] AndroidManifest.xml ---"

if [ -f "AndroidManifest.xml" ]; then
    VER_NAME=$(grep -o 'android:versionName="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
    VER_CODE=$(grep -o 'android:versionCode="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
    PKG=$(grep -o 'package="[^"]*"' AndroidManifest.xml | head -1 | sed 's/.*="\([^"]*\)"/\1/')
    ok "versionName: $VER_NAME"
    ok "versionCode: $VER_CODE"
    ok "package: $PKG"
else
    fail "AndroidManifest.xml: missing"
fi

# -------------------------------------------------------
# 6. RESOURCES
# -------------------------------------------------------
echo ""
echo "--- [6/8] Resources ---"

if [ -d "res" ]; then
    RES_COUNT=$(find res -type f | wc -l)
    ok "res/ directory ($RES_COUNT files)"
else
    fail "res/ directory: missing"
fi

if [ -d "assets" ]; then
    ok "assets/ directory"
else
    warn "assets/ directory: missing"
fi

# -------------------------------------------------------
# 7. NATIVE LIBS (optional for light build)
# -------------------------------------------------------
echo ""
echo "--- [7/8] Native Libraries ---"

ABI="arm64-v8a"
JNI_DIR="jniLibs/$ABI"

if [ -f "$JNI_DIR/libopencode.so" ]; then
    LIB_SIZE=$(ls -la "$JNI_DIR/libopencode.so" | awk '{print $5}')
    ok "libopencode.so ($(( LIB_SIZE / 1024 / 1024 ))MB)"
else
    warn "libopencode.so: not found (APK tanpa server lokal)"
fi

for lib in libproot.so libproot_loader.so libshmem.so libtalloc.so; do
    if [ -f "$JNI_DIR/$lib" ]; then
        ok "$lib"
    else
        warn "$lib: not found"
    fi
done

# Rootfs
if [ -f "assets/payload/rootfs.bin" ]; then
    ROOTFS_SIZE=$(ls -la "assets/payload/rootfs.bin" | awk '{print $5}')
    ok "rootfs.bin ($(( ROOTFS_SIZE / 1024 / 1024 ))MB)"
else
    warn "rootfs.bin: not found (APK tanpa server lokal)"
fi

# -------------------------------------------------------
# 8. BUILD SCRIPT
# -------------------------------------------------------
echo ""
echo "--- [8/8] Build Tools ---"

if [ -f "tools/align.py" ]; then
    ok "tools/align.py"
else
    warn "tools/align.py: not found"
fi

if [ -f "build.sh" ]; then
    ok "build.sh"
else
    fail "build.sh: missing"
fi

# -------------------------------------------------------
# SUMMARY
# -------------------------------------------------------
echo ""
echo "============================================"
TOTAL=$((PASS + FAIL + WARN))
echo -e "  Results: ${GREEN}$PASS PASS${NC} / ${RED}$FAIL FAIL${NC} / ${YELLOW}$WARN WARN${NC} / $TOTAL total"
echo "============================================"

if [ $FAIL -gt 0 ]; then
    echo ""
    echo -e "${RED}BUILD TIDAK MUNGKIN — perbaiki FAIL dulu!${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}SEMUA PASS — siap build!${NC}"
    echo ""
    echo "Build commands:"
    if [ -n "$SDK_HOME" ]; then
        echo "  export ANDROID_HOME=$SDK_HOME"
    fi
    echo "  bash build-apk.sh"
    exit 0
fi
