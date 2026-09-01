# 📱 OpenCode Android

<div align="center">

<img src="icon.svg" width="120" alt="OpenCode"/>

**[OpenCode](https://opencode.ai) — AI chat agent di genggaman kamu.**

Model gratis aktif · Tanpa API key · Tanpa Termux · Tanpa root

[![release](https://img.shields.io/github/v/release/nemoobc/opencode-android?color=C9A227&label=versi)](https://github.com/nemoobc/opencode-android/releases)
[![platform](https://img.shields.io/badge/Android%208%2B-arm64-3DDC84)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](#)

[**⬇ Unduh APK**](https://github.com/nemoobc/opencode-android/releases) · [**🔗 Web Preview**](https://nemoobc.github.io/opencode-preview/)

</div>

---

## ✨ Fitur

### 💬 Chat AI
- **Streaming real-time** — jawaban muncul token per token
- **Context-aware** — agent ingat percakapan sebelumnya
- **Markdown rendering** — code block + copy, tabel, list, heading
- **File attachment** — lampirkan gambar/file untuk analisis
- **Multi-model** — pilih model dari header (gratis semua!)

### 🔐 Login & Auth
- **Email/Password** — daftar & login real (Supabase)
- **Google Sign-In** — one-click login
- **GitHub Sign-In** — one-click login
- **Wallet Login** — MetaMask / WalletConnect (Sign-In with Ethereum)
- **Remember Me** — session persist lintas reload
- **Forgot Password** — reset via email
- **Change Password** — dari drawer profile
- **Login History** — lihat kapan & dari mana kamu login

### 🎨 UI
- **Dark theme** — desain premium ala Bumble
- **24 avatar cartoon** — pilih karakter unikmu (DiceBear)
- **Drawer navigation** — profile, config, model, logout
- **Splash animation** — logo dramatis saat buka
- **Smooth transitions** — animasi halus di mana-mana

### ⚙️ Lainnya
- **Ganti model** — beberapa model gratis + custom API key
- **Konfigurasi** — simpan API key provider lain (Anthropic, OpenAI, dll)
- **Update checker** — notif saat ada versi baru
- **Share obrolan** — bagikan percakapan ke apps lain

---

## 🚀 Pasang

1. Unduh APK dari [Releases](https://github.com/nemoobc/opencode-android/releases)
2. Izinkan instalasi dari sumber tidak dikenal
3. Buka — ekstraksi awal cuma sekali (progress berjalan)
4. Login / daftar akun, atau langsung pakai

> Hasil kerja agent tersimpan di `Android/data/com.nemoobc.opencode/files`

---

## 🆓 Gratis, Tanpa API Key

Model default **`opencode/mimo-v2.5-free`** berjalan tanpa kunci apa pun —
pasang, buka, langsung pakai.

Beberapa model gratis lain tersedia:
| Model | Kecepatan |
|-------|-----------|
| `opencode/mimo-v2.5-free` | ~5s |
| `opencode/gemini-2.0-flash` | ~4s |
| `opencode/gpt-4o-mini` | ~6s |
| `opencode/claude-3.5-sonnet` | ~8s |
| `deepseek/deepseek-chat` | ~7s |

> Mau pakai model berbayar? Masukkan API key di menu **Konfigurasi**.
> Format: `provider/nama-model` (mis. `anthropic/claude-sonnet-4`)

---

## ⚙️ Cara Kerja

```
OpenCode-v1.6.1.apk
 ├─ lib/arm64-v8a/libopencode.so   binary opencode resmi
 ├─ lib/arm64-v8a/libproot.so      jalankan rootfs tanpa root
 ├─ lib/arm64-v8a/...              loader, libtalloc, libandroid-shmem
 └─ assets/payload/rootfs.bin      Alpine minirootfs ±4 MB
```

Saat dibuka, `opencode serve` dijalankan sebagai server lokal persisten di
`127.0.0.1:4096`. Pertanyaan dikirim lewat HTTP API dan jawaban mengalir
real-time lewat event stream.

---

## 🔐 Auth System

App menggunakan **Supabase Auth** untuk autentikasi real:

- **Email/Password** — registrasi + login + forgot password + change password
- **Google OAuth** — one-click login (perlu setup di Google Cloud Console)
- **GitHub OAuth** — one-click login (perlu setup di GitHub Developer Settings)
- **Wallet (MetaMask)** — connect wallet + personal_sign, tanpa backend

### Setup Google/GitHub OAuth

1. Buat project di [Supabase](https://supabase.com)
2. Buka **Authentication → Providers**
3. Enable **Google** → masukkan Client ID + Secret dari Google Cloud Console
4. Enable **GitHub** → masukkan Client ID + Secret dari GitHub OAuth Apps
5. Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

### Setup Wallet Login

Tidak perlu setup — langsung jalan dengan MetaMask/WalletConnect.

---

## 🛠️ Build dari Sumber

Butuh perangkat arm64 dengan JDK, `aapt`, `d8`, `apksigner`
(semua tersedia di repo paket Termux):

```bash
git clone https://github.com/nemoobc/opencode-android && cd opencode-android

# 1. unduh bahan ke dl/
#    - platform-34 android.jar
#    - opencode-linux-arm64-musl (npm) → jniLibs/arm64-v8a/libopencode.so
#    - alpine-minirootfs + libgcc + libstdc++

# 2. rakit payload + salin binary
tar -xzf dl/minirootfs.tar.gz -C staging/rootfs
tar -xzf dl/oc-musl.tgz -C staging/
cp staging/package/bin/opencode jniLibs/arm64-v8a/libopencode.so
tar -czf assets/payload/rootfs.bin -C staging/rootfs .

# 3. bangun
./build.sh  # → build/OpenCode-v1.6.1.apk
```

---

## 📱 Screenshots

| Login | Chat | Drawer | Model Picker |
|-------|------|--------|-------------|
| Email, Google, GitHub, Wallet | Streaming response | Profile + settings | Multi-model |

---

## 📜 Changelog

| Versi | Isi |
|-------|-----|
| **v1.6.1** | 🔐 Login system (email, Google, GitHub, Wallet) · 24 avatar cartoon · Forgot/Change password · Login history · Remember me · UI premium dark theme · Streaming AI · Splash animation |
| v1.6.0 | Timeout realistis, warm-up model, bagikan obrolan |
| v1.5.9 | Kunci kirim + watchdog pesan |
| v1.5.8 | Chip 1 kolom, font 15px |
| v1.5.5 | Fix rootfs, upload file, auto-detect bahasa, streaming token-per-token |
| v1.5.4 | Perombakan internal & perbaikan |
| v1.5.3 | Install instan |
| v1.5.2 | Fix server gagal start palsu, UI v2 splash |

---

## 📄 Lisensi

Kode aplikasi: **MIT**. Komponen yang dibundel mempertahankan lisensinya
masing-masing — proot (GPLv3), opencode (lisensi upstream), Alpine (BSD/GPL).

---

<div align="center">

**Dibuat dengan ❤️ untuk komunitas AI Indonesia**

</div>
