<div align="center">

# OpenCode Android

**AI chat agent di genggaman kamu.**

Model gratis aktif · Tanpa API key · Tanpa Termux · Tanpa root

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227&label=versi)](https://github.com/nemoobc/opencode-android/releases)
[![platform](https://img.shields.io/badge/Android%208%2B-arm64-3DDC84)](#)
[![tests](https://img.shields.io/badge/tests-204%20pass-3DDC84)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](#)

[**Download APK**](https://github.com/nemoobc/opencode-android/releases) · [**Web Preview**](https://nemoobc.github.io/opencode-preview/)

</div>

---

## Apa itu?

OpenCode Android adalah aplikasi chat AI yang berjalan lokal di perangkat Android kamu. Tidak perlu server eksternal, tidak perlu API key — cukup install, buka, langsung chat.

Di balik layar, aplikasi ini menjalankan [OpenCode](https://github.com/opencode-ai/opencode) sebagai server lokal via proot (Linux tanpa root) di `127.0.0.1:4096`. Semua proses terjadi di perangkat kamu.

---

## Fitur

### Chat AI

| Fitur | Deskripsi |
|-------|-----------|
| Streaming real-time | Jawaban muncul token per token |
| Context-aware | Agent ingat percakapan sebelumnya |
| Markdown rendering | Code block + copy, tabel, list, heading |
| File attachment | Lampirkan gambar/file untuk analisis |
| Multi-model | 9 model gratis + custom API key |
| Pencarian web | Toggle real-time search (DuckDuckGo) |

### Riwayat Obrolan

| Fitur | Deskripsi |
|-------|-----------|
| Context menu | Tap 3-dot untuk sematkan, ganti nama, hapus |
| Streaming indicator | Dot amber berkedip untuk chat aktif |
| Auto-save | Riwayat tersimpan otomatis di lokal |
| Pin obrolan | Sematkan chat penting di atas |

### Tema

| Tema | Deskripsi |
|------|-----------|
| Default (Hijau) | Tema gelap dengan aksen hijau |
| Putih | Tema terang untuk kenyamanan mata |
| Hitam | Tema AMOLED murni, hemat baterai |

### Privasi & Backup

| Fitur | Deskripsi |
|-------|-----------|
| Privacy-first | Semua data tersimpan lokal di perangkat |
| Backup | Ekspor riwayat ke file .txt (auto-encode) |
| Import | Impor riwayat dari file backup |

### UI

| Fitur | Deskripsi |
|-------|-----------|
| Splash animation | Logo OpenCode dramatis saat buka |
| Drawer navigation | Riwayat, konfigurasi, model, tema |
| 24 avatar cartoon | Pilih karakter unikmu (DiceBear) |
| Smooth transitions | Animasi halus di mana-mana |
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
> Format: `provider/nama-model` (mis. `anthropic/claude-sonnet-4`)

---

## Cara Kerja

```
User ketik pertanyaan
     │
     ├── [Web Search ON?] ──YES──> DuckDuckGo HTML ──> Parse 5 hasil
     │                                                          │
     NO ◄───────────────────────────────────────────────────────┘
     │
     ▼
Kirim enriched prompt ke AI server
     │
     ▼
Streaming response token per token
     │
     ▼
Render markdown + source citations
```

Saat dibuka, `opencode serve` dijalankan sebagai server lokal persisten di
`127.0.0.1:4096`. Pertanyaan dikirim lewat HTTP API dan jawaban mengalir
real-time lewat event stream.

---

## Instalasi

### APK (Recommended)

1. Download APK dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Izinkan instalasi dari sumber tidak dikenal
3. Buka — ekstraksi awal cuma sekali (progress berjalan)
4. Mulai chat dengan AI

### Web Preview

Versi web untuk preview UI. Tidak ada AI real-time, hanya simulasi.

- **URL**: https://nemoobc.github.io/opencode-preview/
- **Fitur**: UI lengkap, splash screen, drawer, model switcher, tema
- **Keterbatasan**: Balasan AI hanya simulasi (mock response)

---

## Build dari Sumber

Butuh perangkat arm64 dengan JDK, `aapt`, `d8`, `apksigner`
(semua tersedia di repo paket Termux):

```bash
git clone https://github.com/nemoobc/opencode-android && cd opencode-android

# 1. Download bahan ke dl/
#    - platform-34 android.jar
#    - opencode-linux-arm64-musl (npm) -> jniLibs/arm64-v8a/libopencode.so
#    - alpine-minirootfs + libgcc + libstdc++

# 2. Rakit payload + salin binary
tar -xzf dl/minirootfs.tar.gz -C staging/rootfs
tar -xzf dl/oc-musl.tgz -C staging/
cp staging/package/bin/opencode jniLibs/arm64-v8a/libopencode.so
tar -czf assets/payload/rootfs.bin -C staging/rootfs .

# 3. Bangun
./build.sh  # -> build/OpenCode-v1.6.1.apk
```

---

## Struktur Proyek

```
opencode-android/
├── src/com/nemoobc/opencode/
│   └── MainActivity.java          # Java source — Android entry point
├── assets/
│   ├── ui/
│   │   ├── index.html             # Main HTML (APK version)
│   │   ├── index-web.html         # Web preview version
│   │   ├── icon.svg               # App icon
│   │   ├── css/
│   │   │   ├── base.css           # Reset, body, toast, CSS variables
│   │   │   ├── drawer.css         # Drawer, history, context menu
│   │   │   ├── header.css         # Header bar, model chip, status dot
│   │   │   ├── chat.css           # Chat bubbles, markdown, code blocks
│   │   │   ├── welcome.css        # Welcome screen, chips, input bar
│   │   │   └── splash.css         # Splash, modals, overlay, privacy
│   │   └── js/
│   │       ├── bridge.js          # Mock Android bridge (web mode)
│   │       ├── websearch.js       # DuckDuckGo HTML search
│   │       ├── init.js            # Global vars, DOM refs
│   │       ├── utils.js           # Markdown render, toast, helpers
│   │       ├── stream.js          # Streaming, onDone, onStatus
│   │       ├── send.js            # Send, forceStop, web search
│   │       ├── history.js         # Riwayat, context menu, pin
│   │       └── models.js          # Models, drawer, language, theme
│   └── payload/
│       └── rootfs.bin             # Alpine minirootfs (~4 MB)
├── jniLibs/arm64-v8a/
│   ├── libopencode.so             # Binary opencode resmi
│   ├── libproot.so                # Rootfs tanpa root
│   ├── libproot_loader.so         # Loader
│   ├── libtalloc.so               # Memory allocator
│   └── libandroid-shmem.so        # Shared memory
├── test/
│   ├── ui.test.js                 # 147 tests — UI, modals, themes
│   ├── drawer-splash.test.js      # 26 tests — drawer, splash, icons
│   └── ai.test.js                 # 31 tests — streaming, models, search
├── build.sh                       # Build script
├── build/
│   └── OpenCode-v1.6.1.apk       # Built APK
└── README.md
```

---

## Testing

```bash
npm install jsdom    # dependency
node test/ui.test.js
node test/drawer-splash.test.js
node test/ai.test.js
```

Total: **204 tests** (147 UI + 26 drawer/splash + 31 AI)

---

## Changelog

| Versi | Isi |
|-------|-----|
| **v1.6.1** | Context menu riwayat · Tema (Default/Putih/Hitam) · Backup/Import auto-encode · Privasi penjelasan lengkap · Web search toggle · Split CSS/JS · 204 tests · Custom SVG icons |
| v1.6.0 | Timeout realistis, warm-up model, bagikan obrolan |
| v1.5.9 | Kunci kirim + watchdog pesan |
| v1.5.8 | Chip 1 kolom, font 15px |
| v1.5.5 | Fix rootfs, upload file, auto-detect bahasa, streaming token-per-token |
| v1.5.4 | Perombakan internal & perbaikan |
| v1.5.3 | Install instan |
| v1.5.2 | Fix server gagal start palsu, UI v2 splash |

---

## Lisensi

Kode aplikasi: **MIT**. Komponen yang dibundel mempertahankan lisensinya
masing-masing — proot (GPLv3), opencode (lisensi upstream), Alpine (BSD/GPL).

---

## Terima Kasih

Proyek ini dibangun di atas kerja luar biasa dari komunitas open source:

- **[OpenCode](https://github.com/opencode-ai/opencode)** — AI coding agent asli yang menjalankan semua ini
- **[proot](https://proot-me.github.io/)** — menjalankan Linux di Android tanpa root
- **[Alpine Linux](https://alpine-linux.org/)** — minirootfs yang ringan dan efisien
- **[DiceBear](https://www.dicebear.com/)** — avatar cartoon untuk profil

---

<div align="center">

**Dibuat dengan ❤ untuk komunitas AI Indonesia**

</div>
