<div align="center">

<img src="icon.svg" width="120" alt="OpenCode Android">

# OpenCode Android

**AI chat agent di genggaman kamu.**

Model gratis aktif · Tanpa API key · Tanpa Termux · Tanpa root

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227&label=versi)](https://github.com/nemoobc/opencode-android/releases)
[![platform](https://img.shields.io/badge/Android%208%2B-arm64-3DDC84)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](#)

[**Download APK**](https://github.com/nemoobc/opencode-android/releases)

</div>

---

## Apa itu?

OpenCode Android adalah aplikasi chat AI yang berjalan lokal di perangkat Android kamu. Tidak perlu server eksternal, tidak perlu API key — cukup install, buka, langsung chat.

Di balik layar, aplikasi ini menjalankan [OpenCode](https://github.com/opencode-ai/opencode) sebagai server lokal via proot (Linux tanpa root) di `127.0.0.1:4096`. Semua proses terjadi di perangkat kamu.

---

## Fitur

| Fitur | Deskripsi |
|-------|-----------|
| Streaming real-time | Jawaban muncul token per token |
| Context-aware | Agent ingat percakapan sebelumnya |
| Markdown rendering | Code block + copy, tabel, list, heading |
| File attachment | Lampirkan gambar/file untuk analisis |
| Multi-model | 9 model gratis + custom API key |
| Pencarian web | Toggle real-time search (DuckDuckGo) |
| Riwayat lokal | Auto-save, context menu, pin obrolan |
| 3 Tema | Default (Hijau), Putih, Hitam AMOLED |
| Backup/Import | Ekspor riwayat ke .txt, impor kembali |
| Splash animation | Logo OpenCode dramatis saat buka |
| Drawer navigation | Riwayat, konfigurasi, model, tema |
| Custom SVG icons | Semua ikon desain sendiri |

---

## Model

Model default **`opencode/mimo-v2.5-free`** berjalan tanpa kunci apa pun — pasang, buka, langsung pakai.

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

> Mau pakai model berbayar? Masukkan API key di menu **Konfigurasi**.

---

## Instalasi

1. Download APK dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Izinkan instalasi dari sumber tidak dikenal
3. Buka — ekstraksi awal cuma sekali (progress berjalan)
4. Mulai chat dengan AI

> APK standalone — jalan mandiri di HP, tanpa Termux, tanpa setup apapun.

---

## Cara Kerja

```
User ketik pesan
      │
      ▼
┌──────────────┐
│ Web Search?  │──YA──▶ DuckDuckGo ──▶ ambil 5 hasil
└──────┬───────┘
       │ TIDAK
       ▼
┌──────────────────────────────────┐
│ Kirim ke server (localhost:4096) │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ Streaming jawaban token-by-token │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ Render markdown + sumber         │
└──────────────────────────────────┘
```

---

## Struktur Proyek

```
opencode-android/
├── src/com/nemoobc/opencode/
│   └── MainActivity.java
├── assets/ui/
│   ├── index.html
│   ├── icon.svg
│   ├── css/ (base, drawer, header, chat, welcome, splash)
│   └── js/ (bridge, websearch, init, utils, stream, send, history, models)
├── assets/payload/rootfs.bin
├── jniLibs/arm64-v8a/ (libopencode, libproot, etc.)
├── test/ (204 tests)
├── build.sh
└── README.md
```

---

## Changelog

| Versi | Isi |
|-------|-----|
| **v1.6.1** | Context menu · 3 tema · Backup/Import · Web search · Custom SVG icons |
| v1.6.0 | Timeout realistis, warm-up model, bagikan obrolan |
| v1.5.3 | Install instan |

---

## Lisensi

**MIT**. Komponen yang dibundel: proot (GPLv3), opencode (lisensi upstream), Alpine (BSD/GPL).

---

<div align="center">

### Tentang Proyek ini

OpenCode Android dibuat karena percaya bahwa akses ke AI tidak harus rumit atau mahal.
Cukup HP Android, tanpa Termux, tanpa root, tanpa API key — langsung bisa chat dengan AI.

Terima kasih sudah pakai dan mendukung proyek ini.

**nemoobc** · [GitHub](https://github.com/nemoobc)

</div>
