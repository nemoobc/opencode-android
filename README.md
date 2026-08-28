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

## ✨ Yang bisa dilakukan

| | |
|---|---|
| 💬 **Obrolan nyambung** | Agent mengingat konteks — tombol **+** untuk percakapan baru |
| ⚡ **Respons cepat** | Server opencode persisten di `127.0.0.1:4096`, tanpa startup ulang tiap pesan |
| 🌊 **Jawaban mengalir** | Teks muncul token-per-token real-time via event stream |
| 🛠️ **Agent penuh** | Baca/tulis file di folder kerja, jalankan perintah, analisis masalah |
| 📝 **Jawaban rapi** | Render markdown: code block + tombol salin, tabel, list, heading |
| ⚙️ **Ganti model sekali tap** | Dari header — beberapa model gratis + model kustom/API key |
| 🔒 **Privat** | Semua di sandbox aplikasi; hanya izin internet |
| 🔄 **Deteksi update** | Pemberitahuan saat ada versi baru |
| 🪄 **Splash 10 detik** | Animasi logo opencode yang lambat & dramatis saat buka |

## 🆓 Gratis, tanpa API key

Model default **`opencode/big-pickle`** berjalan tanpa kunci apa pun —
pasang, buka, langsung pakai. Beberapa model gratis lain tersedia
(mis. `opencode/hy3-free`) dan bisa dipilih sekali tap dari header.

> Kecepatan akhir tetap ditentukan relay model gratis di sisi server.
> Mau lebih cepat / model tertentu? Tempel API key provider lewat menu
> **config** (model: `provider/nama-model`, mis. `anthropic/claude-sonnet-4`).

## 🚀 Pasang

1. Unduh APK dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Izinkan instalasi dari sumber tidak dikenal
3. Buka — ekstraksi awal cuma sekali (progress berjalan), setelah itu langsung siap
4. Pilih model di header, atau langsung bertanya

Hasil kerja agent tersimpan di
`Android/data/com.nemoobc.opencode/files` — terlihat di file manager mana pun.

## ⚙️ Cara kerja

```
OpenCode-v1.5.4.apk
 ├─ lib/arm64-v8a/libopencode.so   binary opencode resmi (dikompresi di APK)
 ├─ lib/arm64-v8a/libproot.so      jalankan rootfs tanpa root
 ├─ lib/arm64-v8a/...              loader, libtalloc, libandroid-shmem
 └─ assets/payload/rootfs.bin      Alpine minirootfs ±4 MB (diekstrak saat buka pertama)
```

Saat dibuka, `opencode serve` dijalankan sebagai server lokal persisten di
`127.0.0.1:4096`. Pertanyaan dikirim lewat HTTP API dan jawaban mengalir
real-time lewat event stream. Cleartext ke `127.0.0.1` diizinkan lewat
network security config, dan kesiapan server dideteksi dari log
`listening` — bukan permisif terhadap kode HTTP palsu.

## 🛠️ Build dari sumber

Butuh perangkat arm64 dengan JDK, `aapt`, `d8`, `apksigner`
(semua tersedia di repo paket Termux):

```bash
git clone https://github.com/nemoobc/opencode-android && cd opencode-android

# 1. unduh bahan ke dl/
#    - platform-34 android.jar (dl.google.com)
#    - opencode-linux-arm64-musl (npm)   → jniLibs/arm64-v8a/libopencode.so
#    - alpine-minirootfs 3.21 + libgcc + libstdc++ (dl-cdn.alpinelinux.org)

# 2. rakit payload (tanpa prefix folder!) + salin binary
tar -xzf dl/minirootfs.tar.gz -C staging/rootfs
tar -xzf dl/oc-musl.tgz -C staging/
cp staging/package/bin/opencode jniLibs/arm64-v8a/libopencode.so
#    + libstdc++/libgcc ke usr/lib, resolv.conf, wrapper usr/bin/oc, config model gratis
tar -czf assets/payload/rootfs.bin -C staging/rootfs .

# 3. bangun (kompresi .so level 9 → APK kecil)
./build.sh          # → build/OpenCode-v1.5.4.apk (signed + verified)
```

## 📜 Riwayat versi

| Versi | Ukuran | Isi |
|---|---|---|
| v1.5.5 | **±64 MB** | Fix ekstrak rootfs tar (tidak stuck di "bersiap"); upload file (tombol **+** di input); auto-detect bahasa + reset per percakapan; streaming token-per-token mulus; model default `opencode/big-pickle` |
| v1.5.4 | ±64 MB | Perombakan internal & penuh perbaikan dari v1.5.3 |
| v1.5.3 | ±190 MB | Upaya install instan (native libs tidak diekstrak saat instal) |
| v1.5.2 | ±190 MB | Fix "server gagal start" palsu — deteksi siap terima respons HTTP apa pun; UI v2 splash |
| v1.5.1 | ±190 MB | Fix tombol cancel tidak nyangkut (watchdog ganda), streaming anti-lag, auto-scroll |
| v1.2.3 | ±190 MB | Fix tombol cancel stif stuck, welcome kosong saat buka pertama, anti white-flash |

## 📄 Lisensi

Kode aplikasi: **MIT**. Komponen yang dibundel mempertahankan lisensinya
masing-masing — proot (GPLv3), opencode (lisensi upstream), Alpine (BSD/GPL).
