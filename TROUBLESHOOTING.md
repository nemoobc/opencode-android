# Troubleshooting — OpenCode Android

Gejala → sebab → fix. Urut dari paling sering.

## 1. `ERR_FILE_NOT_FOUND ... android_asset/ui/index.html`

**Sebab:** APK lama (bug path assets, versi ≤ build awal v1.6.1).
**Fix:** Download APK terbaru dari
[Releases](https://github.com/nemoobc/opencode-android/releases), timpa install.

## 2. "Aplikasi tidak terinstall" / paket bentrok

**Sebab:** Key penanda APK beda dari yang kepasang. Terjadi kalau keystore
ke-reset (dulu: tiap `rm -rf build/` bikin key baru).
**Fix:**
1. Uninstall aplikasi di HP (data chat ikut hilang — backup dulu kalau bisa).
2. Install APK baru.
3. Setelah itu update selalu bisa timpa langsung (keystore sekarang permanen +
   auto-backup ke `Documents/opencode-keystore/` tiap build).

**Cegah:** copy `Documents/opencode-keystore/ks.jks` ke Drive/PC. File inilah
nyawanya update. Hilang = ulangi langkah di atas.

## 3. Stuck "0 file" / persen ga jalan

**Sebab:** WebView belum siap saat progress dikirim, atau server masih boot
(tidak ada event progress selama boot — normal).
**Fix:** Tunggu max 2 menit. Kalau masih stuck:
1. Tutup paksa aplikasi (Recent → geser).
2. Buka lagi. Sisa `rootfs.tmp` dibersihkan otomatis, lanjut dari awal.

## 4. "Server gagal start"

**Sebab:** Boot proot + node butuh 10–60 detik (lebih lama di HP kentang/RAM penuh).
**Fix:** Tunggu 1–2 menit tanpa buka-tutup aplikasi. Kalau tetap gagal:
1. Pastikan sisa RAM cukup (tutup aplikasi berat).
2. Pastikan storage internal sisa > 500MB.
3. Buka lagi.

## 5. Web search tidak ada hasil

**Sebab:** Toggle mati, offline, atau DuckDuckGo diblokir jaringan.
**Fix:**
1. Nyalakan toggle 🌐 di bar input (muncul toast "Pencarian Web: Aktif").
2. Cek internet (coba buka browser).
3. Hasil kosong = kirim sebagai chat biasa (fallback otomatis).

## 6. Model error / HTTP 429

**Sebab:** Rate limit provider model gratis.
**Fix:** Tunggu 1–5 menit, atau ganti model cepat dari menu (chip model).

## 7. Chat lemot / ketikan telat

**Sebab:** Respons panjang + HP panas / RAM sempit.
**Fix:** Tekan stop, tanya lebih spesifik dan pendek.

## 8. Riwayat hilang setelah update

**Sebab:** Uninstall (bukan timpa). Uninstall menghapus data aplikasi.
**Fix:** Update selalu TIMPA install. Backup berkala via menu (file terenkripsi).

## 9. Game tidak jalan / layar aneh

**Sebab:** WebView versi lama (Android 8 awal).
**Fix:** Update "Android System WebView" via Play Store.

## Masih rusak?

Catat 3 hal ini lalu lapor:
1. Teks error persis (screenshot lebih bagus).
2. Versi APK (drawer bawah) + tipe HP + Android versi.
3. Kapan terjadi: install baru / update / buka ulang / pas chat.
