# Changelog — OpenCode Android

Format: `## [versi] - tanggal` + poin perubahan.

## [1.6.1] - 2026-09-03

### Game (menu garis tiga)
- Ular: canvas, swipe + dpad, kecepatan naik, umpan emas, slow-mo mati
- Quiz Otak: 15 soal acak, timer 15 dtk, streak bonus, grade S–D, medali
- Puzzle geser 3×3: langkah + waktu + rekor + tanggal, confetti
- Ludo: kamu (hijau) vs 3 CPU — keluar markas butuh 6, makan, ★ aman,
  finis pas, tray finis, hujan crown
- TicTac: X vs CPU smart (menang > cegah > tengah > sudut), strike line
- Skor terbaik tersimpan lokal per game

### Chat
- Animasi mengetik bertahap (typewriter + fast-forward pas done)
- Dots mengetik beneran tampil (CSS sempat hilang)
- Sitasi web bernomor [1][2] ala Claude + daftar sumber bisa diketuk
- Animasi "lagi nyari" (ikon putar + dots) saat web search
- Fade halus saat teks jadi markdown (tanpa pop)
- List `•`/`–` ke-render, link panjang wrap, gambar contain
- Chat ga bisa scroll kesamping lagi

### Boot & install
- Progress ekstrak 1–100% akurat (hitung byte kompresi, bukan dekompresi)
- Throttle push progress (anti lag), total file asli (bukan hardcode)
- setStage juga di jalur buka-ulang (dulu stuck "0 file")
- Tunggu WebView siap sebelum ekstrak (progress kelihatan jalan)
- Animasi boot indefinite (geser) + teks marching ❯❯❯
- Splash ikut tampil % saat ekstrak
- Keystore permanen + auto-backup shared storage + guard anti-bentrok
- `build-ui.sh`: rebuild UI doang tanpa compile Java

### Tes
- 249 tests hijau (9 file, Node + jsdom)

## [1.6.0] - 2026-08-31

- Timeout realistis, warm-up model, bagikan obrolan
- Context menu riwayat, 3 tema, backup/impor

## [1.5.3] - 2026-08-25

- Install instan, ringan di background
