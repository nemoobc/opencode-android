# 📱 OpenCode Android

<div align="center">

<img src="icon.svg" width="120" alt="logo"/>

**[opencode](https://opencode.ai) dalam bentuk aplikasi Android.**

Model gratis aktif — tanpa API key, tanpa Termux, tanpa root.

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227&label=versi)](https://github.com/nemoobc/opencode-android/releases)
[![ci](https://github.com/nemoobc/opencode-android/actions/workflows/build.yml/badge.svg)](https://github.com/nemoobc/opencode-android/actions/workflows/build.yml)
[![platform](https://img.shields.io/badge/Android%208%2B-arm64-3DDC84)](#)

[Unduh APK terbaru →](https://github.com/nemoobc/opencode-android/releases)

</div>

---

## ✨ Apa yang bisa dilakukan

| | |
|---|---|
| 💬 **Obrolan nyambung** | Agent mengingat konteks percakapan — tombol **+** untuk mulai baru |
| 🛠️ **Agent penuh** | Bisa membaca & menulis file di folder kerjanya, menjalankan perintah, menganalisis masalah |
| 📝 **Jawaban rapi** | Render markdown: code block + tombol salin, tabel, list, heading |
| ⚡ **Ganti model sekali tap** | Langsung dari header — preset gratis atau model kustom |
| 🔒 **Privat** | Semua berjalan di sandbox aplikasi; hanya izin internet |
| 🔄 **Update otomatis terdeteksi** | Banner muncul saat ada versi baru |
| 🤖 **CI build** | APK dibangun otomatis oleh GitHub Actions setiap push |

## 🆓 Gratis, tanpa API key

Model default **`opencode/x-preview-f-free`** berjalan tanpa kunci apa pun —
pasang aplikasi, buka, langsung pakai.

> Catatan jujur: relay model gratis memproses di server, balasan pertama
> bisa memakan **30–60 detik** (ada timer berjalan di layar). Mau lebih cepat?
> Tempel API key provider lain lewat menu **config**.

## 🚀 Pasang

1. Unduh APK dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Izinkan instalasi dari sumber tidak dikenal
3. Buka — ekstraksi awal hanya beberapa detik
4. Ketuk chip model di header untuk ganti model, atau mulai bertanya

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

Saat bertanya, aplikasi menjalankan:

```
proot -r rootfs -0 -b libopencode.so:/usr/bin/opencode \
      -b cache:/tmp -b external-files:/work \
      /usr/bin/oc run "pertanyaan"
```

Output mengalir real-time ke antarmuka obrolan (WebView), konfigurasi
tersimpan persisten di `rootfs/root/.config/opencode/`.

## 🛠️ Build dari sumber

Butuh JDK 21, `aapt`, `d8`, `apksigner` (semua tersedia di repo Termux):

```bash
git clone https://github.com/nemoobc/opencode-android && cd opencode-android
# unduh bahan ke dl/ — daftar URL ada di .github/workflows/build.yml
# rakit payload + jniLibs (lihat langkah di workflow CI)
./build.sh          # → build/OpenCode-vX.Y.Z.apk (signed + verified)
```

Atau biarkan **GitHub Actions** yang membangun — push apa pun akan
menghasilkan artefak APK di tab Actions.

## 📜 Riwayat versi

| Versi | Isi |
|---|---|
| v1.1.2 | Perapian teks antarmuka, perbaikan build |

## 📄 Lisensi

Kode aplikasi: **MIT**. Komponen yang dibundel mempertahankan lisensinya
masing-masing — proot (GPLv3), opencode (lisensi upstream), Alpine (BSD/GPL).
