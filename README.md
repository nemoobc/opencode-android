# 📱 OpenCode Android

<div align="center">

<img src="icon.svg" width="120" alt="OpenCode"/>

**[opencode](https://opencode.ai) dalam bentuk aplikasi Android.**

Model gratis aktif — tanpa API key, tanpa Termux, tanpa root.

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227&label=versi)](https://github.com/nemoobc/opencode-android/releases)
[![platform](https://img.shields.io/badge/Android%208%2B-arm64-3DDC84)](#)

[**⬇ Unduh APK terbaru**](https://github.com/nemoobc/opencode-android/releases)

</div>

---

## ✨ Apa yang bisa dilakukan

| | |
|---|---|
| 💬 **Obrolan nyambung** | Agent mengingat konteks percakapan — tombol **+** untuk mulai baru |
| ⚡ **Respons cepat** | Server opencode berjalan persisten — tanpa startup ulang di tiap pesan |
| 🌊 **Jawaban mengalir** | Teks muncul kata-per-kata saat model menulis |
| 🛠️ **Agent penuh** | Membaca & menulis file di folder kerja, menjalankan perintah, analisis masalah |
| 📝 **Jawaban rapi** | Render markdown: code block + tombol salin, tabel, list, heading |
| ⚡ **Ganti model sekali tap** | Langsung dari header — 7 model gratis terverifikasi, atau model kustom |
| 🔒 **Privat** | Semua berjalan di sandbox aplikasi; hanya izin internet |
| 🔄 **Deteksi update** | Pemberitahuan otomatis saat ada versi baru |

## 🆓 Gratis, tanpa API key

Model default **`opencode/x-preview-f-free`** berjalan tanpa kunci apa pun —
pasang aplikasi, buka, langsung pakai.

> Kecepatan akhir tetap ditentukan relay model gratis di sisi server —
> kadang butuh beberapa detik ekstra. Mau lebih cepat? Tempel API key
> provider lain lewat menu **config**.

## 🚀 Pasang

1. Unduh APK dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Izinkan instalasi dari sumber tidak dikenal
3. Buka — ekstraksi awal hanya sekali (±1 menit), setelah itu server langsung siap
4. Ketuk nama model di header untuk ganti model, atau langsung bertanya

Hasil kerja agent tersimpan di
`Android/data/com.nemoobc.opencode/files` — terlihat di file manager mana pun.

## ⚙️ Cara kerja

```
OpenCode.apk
 ├─ lib/arm64-v8a/
 │   ├─ libopencode.so        binary opencode resmi (ekstrak sistem saat instalasi)
 │   ├─ libproot.so           menjalankan rootfs tanpa root
 │   └─ ...                   loader, libtalloc, libandroid-shmem
 └─ assets/payload/rootfs.bin Alpine minirootfs ±4 MB (diekstrak saat pertama dibuka)
```

Saat aplikasi dibuka, `opencode serve` dijalankan sebagai server lokal
persisten di `127.0.0.1:4096`. Setiap pertanyaan dikirim lewat HTTP API —
karena itu tanpa startup ulang, dan jawaban mengalir real-time lewat
event stream.

## 🛠️ Build dari sumber

Butuh perangkat arm64 dengan JDK 21, `aapt`, `d8`, `apksigner`
(semua tersedia di repo paket Termux):

```bash
git clone https://github.com/nemoobc/opencode-android && cd opencode-android

# 1. unduh bahan ke dl/ — daftar URL ada di komentar build.yml di riwayat git
#    - platform-34 android.jar (dl.google.com)
#    - opencode-linux-arm64-musl (npm)  → jniLibs/arm64-v8a/libopencode.so
#    - alpine-minirootfs 3.21 + libgcc + libstdc++ (dl-cdn.alpinelinux.org)

# 2. rakit payload (tanpa prefix folder!) + salin binary
tar -xzf dl/minirootfs.tar.gz -C staging/rootfs
tar -xzf dl/oc-musl.tgz -C staging/
cp staging/package/bin/opencode jniLibs/arm64-v8a/libopencode.so
#    + libstdc++/libgcc ke usr/lib, resolv.conf, wrapper usr/bin/oc, config model gratis
tar -czf assets/payload/rootfs.bin -C staging/rootfs .

# 3. bangun
./build.sh          # → build/OpenCode-vX.Y.Z.apk (signed + verified)
```

## 📜 Riwayat versi

| Versi | Isi |
|---|---|
| v1.5.1 | Fix tombol cancel benar-benar tidak nyangkut (watchdog ganda JS+Java), render streaming anti-lag (throttle 120ms), auto-scroll pasti turun saat kirim, ABI build diperbaiki |
| v1.5.2 | Fix "server gagal start" palsu — deteksi siap kini terima respons HTTP apa pun (tidak menuntut 200 di /), sekaligus UI v2: splash logo tergambar + glow, avatar AI, aurora welcome, tombol spring |
| v1.5.3 | Install instan (native libs tidak diekstrak saat instal — pindah ke buka pertama dengan progress MB nyata), tanpa notifikasi background, tanpa toast |
| v1.2.3 | Fix tombol cancel stuck merah (onError kini mereset UI + watchdog tanpa syarat), welcome screen kosong saat buka pertama, auto-scroll, streaming ringan, anti white-flash |

## 📄 Lisensi

Kode aplikasi: **MIT**. Komponen yang dibundel mempertahankan lisensinya
masing-masing — proot (GPLv3), opencode (lisensi upstream), Alpine (BSD/GPL).
