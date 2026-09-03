<div align="center">

<img src="assets/ui/icon.svg" width="120" alt="OpenCode Android">

# OpenCode Android

**AI chat agent di genggaman kamu.**

Model gratis aktif · Tanpa API key · Tanpa Termux · Tanpa root

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227&label=versi)](https://github.com/nemoobc/opencode-android/releases)
[![platform](https://img.shields.io/badge/Android%208%2B-arm64-3DDC84)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](#)

[**⬇ Download APK**](https://github.com/nemoobc/opencode-android/releases)

</div>

---

## Apa itu?

OpenCode Android adalah aplikasi chat AI yang jalan **penuh lokal** di HP Android.
Tanpa server luar, tanpa API key — install, buka, langsung chat.

Di balik layar, aplikasi menjalankan [OpenCode](https://github.com/anomalyco/opencode)
sebagai server lokal via proot di `127.0.0.1:4096`. Plus ada **menu Game** buat selingan:
Ular, Quiz Otak, Puzzle, dan Ludo lawan CPU.

---

## Fitur

| Fitur | Deskripsi |
|-------|-----------|
| Animasi mengetik | Jawaban muncul bertahap + kursor kedip, lalu fade jadi markdown rapi |
| Sitasi web [1][2] | Pencarian web bernomor ala Claude, sumber bisa diketuk |
| Pencarian web | Toggle real-time search, ada animasi "lagi nyari" |
| Boot jujur | Progress ekstrak 1–100% beneran, mode animasi pas nyalain server |
| Markdown rendering | Code block + copy, tabel, list (termasuk •), heading, gambar |
| File attachment | Lampirkan gambar/file untuk analisis |
| Multi-model | 9 model gratis + API key sendiri buat model berbayar |
| Riwayat lokal | Auto-save, pin, ganti nama, hapus, backup/impor terenkripsi |
| 3 Tema | Default (Hijau), Putih, Hitam AMOLED |
| 🎮 Game | Ular, Quiz Otak (15 soal), Puzzle geser, Ludo vs 3 CPU |
| Custom SVG icons | Semua ikon desain sendiri, tanpa emoji tempel |

---

## Model

Model default **`opencode/mimo-v2.5-free`** — tanpa kunci apa pun, langsung pakai.

| Model | Kecepatan | Keterangan |
|-------|-----------|------------|
| `opencode/mimo-v2.5-free` | ~5s | Default, recommended |
| `opencode/muse-spark-1.2-contributor-free` | ~8s | Cepat |
| `opencode/deepseek-v4-flash-free` | ~7s | Flash |
| `opencode/hy3-free` | ~6s | Katalog resmi |
| `opencode/big-pickle` | ~6s | Katalog resmi |
| `opencode/nemotron-3-ultra-free` | ~7s | Ultra |
| `opencode/nemotron-3.5-lightning-free` | ~4s | Tercepat |
| `opencode/ling-3.0-flash-fin-free` | ~7s | Flash |
| `opencode/laguna-s-2.1-free` | ~6s | Baru |

> Mau model berbayar? Masukkan API key di menu **Konfigurasi**.

---

## Instalasi

1. Download APK dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Izinkan instalasi dari sumber tidak dikenal
3. Buka — ekstraksi awal cuma sekali (progress 1–100% jalan beneran)
4. Update berikutnya tinggal timpa install (keystore permanen, data aman)

> ⚠ Kalau dulu pernah install versi lama dan muncul "paket bentrok": uninstall sekali,
> lalu install yang baru. Setelah itu update selalu bisa timpa langsung.

---

## Game

Buka ☰ (garis tiga) → **Game**. Skor terbaik tersimpan otomatis di HP.

| Game | Main |
|------|------|
| 🐍 Ular | Swipe / tombol arah, makan, makin cepat, jangan nabrak |
| 🧠 Quiz Otak | 15 soal acak, timer 15 detik, streak bonus, grade S–D |
| 🧩 Puzzle | Geser 3×3 sampai urut, dihitung langkah + waktu |
| 🎲 Ludo | Kamu (hijau) vs 3 CPU — butuh 6 keluar markas, injak lawan makan, finis harus pas |

---

## Cara Kerja

```
User ketik pesan
      │
      ▼
┌──────────────┐
│ Web Search?  │──YA──▶ Java native HTTP ──▶ 5 hasil ──▶ prompt + sitasi [1][2]
└──────┬───────┘
       │ TIDAK
       ▼
┌──────────────────────────────────┐
│ Kirim ke server (localhost:4096) │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ Streaming delta → typewriter     │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ Render markdown + daftar sumber  │
└──────────────────────────────────┘
```

---

## Struktur Proyek

```
opencode-android/
├── src/com/nemoobc/opencode/
│   ├── MainActivity.java   # WebView, server, bridge, webSearch
│   ├── TarExtractor.java   # Ekstrak rootfs + progress akurat
│   └── Diagnostics.java    # Autotest + diagnosa
├── assets/ui/
│   ├── index.html
│   ├── css/ (base, drawer, header, chat, welcome, splash, games)
│   └── js/ (bridge, websearch, init, utils, stream, send, history,
│            models, games, g-snake, g-quiz, g-puzzle, g-ludo)
├── assets/payload/rootfs.bin
├── jniLibs/arm64-v8a/ (libopencode, libproot, dll)
├── test/ (245 tests, Node + jsdom)
├── build.sh      # Build full (Java + UI)
├── build-ui.sh   # Build UI doang (HTML/JS/CSS)
└── README.md
```

### Build sendiri

```bash
# Full (butuh: pkg install aapt d8 apksigner openjdk-21)
bash build.sh

# Cuma UI berubah? Lebih cepat:
bash build-ui.sh
```

---

## Changelog

| Versi | Isi |
|-------|-----|
| **v1.6.1** | Game (ular/quiz/puzzle/ludo) · Sitasi web [1][2] · Typewriter · Boot progress jujur · Keystore permanen |
| v1.6.0 | Timeout realistis, warm-up model, bagikan obrolan |
| v1.5.3 | Install instan |

---

## Atribusi & Lisensi

- Binary AI: [OpenCode](https://github.com/anomalyco/opencode)
- Runtime sandbox: proot (GPLv3) · Rootfs: Alpine Linux
- Kode aplikasi & UI: **MIT** — bebas dipakai dan dimodifikasi.

---

<div align="center">

### Tentang Proyek ini

Dibuat karena akses ke AI tidak harus rumit atau mahal.
Cukup HP Android — langsung chat dengan AI.

Terima kasih sudah pakai dan mendukung proyek ini.

**nemoobc** · [GitHub](https://github.com/nemoobc)

</div>
