# 📱 OpenCode Android

**[opencode](https://opencode.ai)** sebagai aplikasi Android native — TANPA Termux, TANPA root.

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227)](https://github.com/nemoobc/opencode-android/releases)
[![platform](https://img.shields.io/badge/platform-Android%208%2B-3DDC84)](#)
[![arch](https://img.shields.io/badge/arch-arm64-blue)](#)

Versi pendamping dari [opencode-termux](https://github.com/nemoobc/opencode-termux) — kalau di sana kita jalanin lewat terminal Termux, di sini cukup **install APK, tempel API key, gas.**

---

## ✨ Fitur

- ⚡ **Sekali install langsung kebuka** — binary opencode diekstrak sistem saat instalasi (via jniLibs), first-open cuma ekstrak rootfs mini ±5 detik
- 🤖 Chat UI siap pakai — agent AI jalan penuh (`opencode run`): baca/tulis file di folder kerja, eksekusi perintah, streaming output real-time
- 📦 Semua bundel dalam 1 APK (~67 MB): binary opencode + Alpine rootfs mini + proot
- 🆓 **Langsung bisa dipakai** — model gratis `opencode/x-preview-f-free` jadi default, tanpa API key
- 💬 **Obrolan nyambung otomatis** — agent ingat konteks; tombol + untuk mulai baru
- 📝 **Render markdown** — code block dengan tombol COPY, tabel, list, heading
- ⚡ **Ganti model dari header** — tanpa buka config
- 🔄 **Update checker** — notifikasi kalau ada versi baru
- ⚙️ Panel config: provider (opencode/anthropic/openai/openrouter/groq/google) + API key + model
- 🎨 Ikon & UI: interpretasi sendiri dari logo opencode — bingkai putih, kursor hijau-emas nembus keluar
- 🔒 Sandbox app Android biasa — tidak butuh izin apa pun kecuali internet

## 🚀 Install

1. Unduh APK terbaru dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Install (izinkan sumber tidak dikenal)
3. Buka app → ekstraksi rootfs mini beberapa detik → langsung siap
4. Tap **[config]** → pilih provider + tempel API key → simpan
5. Ngobrol sama agent-nya. Kerja file ada di `/work` (folder internal app)

> Key opencode gratis: [console.opencode.ai](https://console.opencode.ai) → API Keys

## 🔧 Cara kerja

```
OpenCode.apk
 ├─ lib/arm64-v8a/
 │   ├─ libopencode.so          ← binary opencode resmi (diekstrak installer saat install)
 │   ├─ libproot.so             ← proot: jalankan rootfs tanpa root
 │   ├─ libproot_loader.so
 │   ├─ libtalloc.so
 │   └─ libshmem.so
 └─ assets/payload/rootfs.bin   ← Alpine minirootfs (~4 MB, diekstrak saat first-open)
```

Saat chat, app menjalankan:

```
proot -r rootfs -0 \
  -b libopencode.so:/usr/bin/opencode \
  -b cache:/tmp  -b work:/work \
  /usr/bin/oc run "<prompt>"
```

- Binary opencode **tidak pernah dimodifikasi** — diambil apa adanya dari rilis resmi upstream
- Output di-stream real-time ke WebView chat UI
- Config/auth tersimpan persisten di `rootfs/root/.config/opencode/`

## 🛠️ Build dari sumber

Butuh: Termux/Android arm64 dengan `aapt d8 apksigner openjdk-21 librsvg` (semua ada di repo Termux).

```bash
# 1. unduh bahan ke dl/ (URL di build.sh & README):
#    - platform-34-ext7 android.jar (dl.google.com)
#    - opencode-linux-arm64-musl v1.18.21 (npm)  → jniLibs/libopencode.so
#    - alpine-minirootfs 3.21 aarch64 + libgcc + libstdc++ (dl-cdn.alpinelinux.org)
# 2. rakit rootfs mini (TANPA binary opencode — itu dari jniLibs)
mkdir -p staging/rootfs && tar -xzf dl/minirootfs.tar.gz -C staging/rootfs
#    + libstdc++/libgcc ke usr/lib, resolv.conf ke etc/, wrapper usr/bin/oc
tar -czf assets/payload/rootfs.bin -C staging rootfs
# 3. build
./build.sh   # → build/OpenCode-v<versi>.apk (signed, verified)
```

## 📜 Riwayat versi

| Versi | Isi |
|---|---|
| v1.1.1 | Desain ulang natural ala ChatGPT/Claude/Gemini: font sans-serif, jawaban AI full-width, bubble user lembut, aksi Salin/Tanya lagi, timer proses, tombol scroll — fix payload nested & opsi `--` proot, CI build otomatis |

## ⚠️ Catatan

- v1 belum punya: sesi interaktif berkelanjutan, mode TUI penuh
- APK ~67 MB karena membawa binary opencode utuh (~193 MB, terkompresi 68% di APK)

## 📄 Lisensi

Kode app: MIT. Komponen bundel mempertahankan lisensinya masing-masing (proot = GPLv3, opencode = lisensi upstream, Alpine = BSD/GPL campuran).
