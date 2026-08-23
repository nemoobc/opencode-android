# 📱 OpenCode Android

**[opencode](https://opencode.ai)** sebagai aplikasi Android native — TANPA Termux, TANPA root, TANPA proot-distro manual.

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227)](https://github.com/nemoobc/opencode-android/releases)
[![platform](https://img.shields.io/badge/platform-Android%208%2B-3DDC84)](#)
[![arch](https://img.shields.io/badge/arch-arm64-blue)](#)

Versi pendamping dari [opencode-termux](https://github.com/nemoobc/opencode-termux) — kalau di sana kita jalanin lewat terminal Termux, di sini cukup **install APK, tempel API key, gas.**

---

## ✨ Fitur

- 🤖 Chat UI siap pakai — agent AI jalan penuh (`opencode run`): baca/tulis file di folder kerja, eksekusi perintah, dll.
- 📦 Semua bundel dalam 1 APK: binary opencode + Alpine rootfs mini + proot
- ⚙️ Panel config: provider (opencode/anthropic/openai/openrouter/groq/google) + API key + model
- 🎨 Tema gelap hijau-emas khas Urahara Shouten
- 🔒 Sandbox app Android biasa — tidak butuh izin apa pun kecuali internet

## 🚀 Install

1. Unduh APK terbaru dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Install (izinkan sumber tidak dikenal)
3. Buka app → tunggu ekstraksi pertama (±1-2 menit, sekali saja)
4. Tap **[config]** → pilih provider + tempel API key → simpan
5. Ngobrol sama agent-nya. Kerja file ada di `/work` (folder internal app)

> Key opencode gratis: [console.opencode.ai](https://console.opencode.ai) → API Keys

## 🔧 Cara kerja

```
OpenCode.apk
 ├─ assets/payload/rootfs.bin     ← Alpine minirootfs + opencode-linux-arm64-musl + libstdc++/libgcc
 └─ lib/arm64-v8a/
     ├─ libproot.so               ← proot (jalankan rootfs tanpa root)
     ├─ libproot_loader.so
     ├─ libtalloc.so
     └─ libshmem.so
```

Saat pertama dibuka, app mengekstrak rootfs ke storage internal lalu menjalankan:

```
proot -r rootfs -0 -b $HOME/work:/work /usr/bin/oc run "<prompt>"
```

Output di-stream real-time ke WebView chat UI.

## 🛠️ Build dari sumber

Butuh: Termux/Android arm64 dengan `aapt d8 apksigner openjdk-21` (semua ada di repo Termux).

```bash
# 1. unduh bahan (lihat build.sh header untuk URL)
#    - platform-34 android.jar
#    - opencode-linux-arm64-musl (npm)
#    - alpine-minirootfs + libgcc + libstdc++ (alpine 3.21 aarch64)
# 2. rakit payload
tar -xzf dl/minirootfs.tar.gz -C staging/rootfs
tar -xzf dl/oc-musl.tgz -C staging/
cp staging/package/bin/opencode staging/rootfs/usr/bin/
# (+ libstdc++, libgcc, resolv.conf — lihat detail di build.sh)
tar -czf assets/payload/rootfs.bin -C staging rootfs
# 3. build
./build.sh
```

## ⚠️ Catatan

- Binary opencode **tidak dimodifikasi** — diambil apa adanya dari rilis resmi upstream
- `proot` adalah karya [proot-me](https://github.com/proot-me/proot) (GPLv3) — build Termux dibundel apa adanya
- APK ~67 MB karena membawa binary opencode utuh (~193 MB terkompresi jadi ~65 MB)
- v1 belum punya: sesi interaktif berkelanjutan, mode TUI penuh, ikon bagus 😄

## 📄 Lisensi

Kode app: MIT. Komponen bundel masing-masing memakai lisensinya (proot = GPLv3, opencode = lisensi upstream, Alpine = BSD/GPL campuran).
