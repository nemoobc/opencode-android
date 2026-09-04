# Fitur Gambar AI — Dokumentasi Lengkap (GACOR)

Sumber kode: `js/media.js` (disync Android <-> Web via `sync.sh`).
API gambar: `https://image.pollinations.ai` (gratis, tanpa key, model `flux`).
API chat (untuk teks): `POST /api/chat` -> `https://opencode.ai/zen/v1/*`.

## 1. Cara pakai (user)

Trigger gambar (lihat `Media.imgRequest`):

- `buatkan|bikin|buat|tolong|generate|create|lukis|draw|desain` + `gambar|lukisan|foto|ilustrasi|image|picture|visual|sketsa|poster|wallpaper`
- Atau awalan langsung: `gambar ...`, `lukisan ...`, `foto ...` (kecuali nanya: `gambar apa itu?`)
- Atau akhiran manja: `... dong|ya|kak|plis|please`

Contoh valid:

- `buatkan gambar kucing oren hd`
- `gaya anime: samurai di hujan`
- `buatkan gambar sertifikat penghargaan`
- `wallpaper pantai wallpaper`
- `foto rendang`

Bukan gambar (dikirim ke chat AI):

- `gambar apa itu?`, `apa itu ...`, `buatkan file kode ...` (masuk jalur file)

Bersih prompt (`Media.cleanImgPrompt`):

1. Buang kata perintah: tolong|buatkan|bikinkan|buatin|lukiskan|gambarkan|desainkan|generate|create|design|draw.
2. Buang kata benda pembuka di awal: gambar|lukisan|foto|...|yang|sebuah|seekor|tentang.
3. Rapatkan spasi. Kosong -> `random art`.

Contoh: `buatkan gambar sertifikat penghargaan` -> `sertifikat penghargaan`.

## 2. Pipeline otomatis (tanpa setting manual)

Urutan di `Media.imgUrl(prompt, seed, size)`:

1. `parseStyle` — gaya.
2. `autoEN` — bilingual ID->EN.
3. `autoGuard` — guard kualitas + anti-cacat per kategori.
4. `autoDims` — rasio + resolusi.
5. Bangun URL pollinations + `seed`.

### 2.1 Gaya (`STYLE_MAP` + `parseStyle`)

Tulis eksplisit (prioritas 1):

- `gaya anime: kucing samurai`
- `style foto: nenek di sawah`
- `ala sinematik: pasar malam`

Daftar gaya: `anime`, `kartun`, `foto|realistik`, `lukisan`, `3d`, `sinematik`, `poster`.
Contoh suffix: anime -> `anime style, vibrant, clean lineart`; foto ->
`ultra realistic photo, 85mm, natural light`; sinematik ->
`cinematic still, dramatic light, film grain`.

Prioritas 2 (implisit): kalau kata gaya muncul di mana saja
(`kucing kartun`), suffix ikut tanpa ubah prompt asli.

### 2.2 Bilingual (`AUTO_DICT` + `autoEN`)

Kamus (ditambah otomatis max 3, tanpa duplikat):

sertifikat->certificate award, penghargaan->award, kucing->cat,
anjing->dog, anjing laut->seal, pemandangan->landscape, pantai->beach,
gunung->mountain, kota->city, mobil->car, motor->motorcycle, rumah->house,
gedung->building, bunga->flower, makanan->food, rendang->rendang,
anak->kid, keluarga->family, potret->portrait, logo->logo, poster->poster,
undangan->invitation, masjid->mosque, sawah->rice field.

Contoh: `sertifikat` -> `sertifikat (certificate award)`.

### 2.3 Guard per kategori (`autoGuard`)

Basis semua: `masterpiece, sharp focus, correct anatomy, clean, high quality, detailed`.

- Dokumen (`sertifikat|certificate|ijazah|piagam|surat|dokumen|kartu|undangan|poster|brosur|logo`):
  `official document on table, paper, flat lay, studio photo` +
  `no building, no architecture, no people` (+ `no horror` kecuali minta dark).
- Orang (`orang|anak|keluarga|potret|wajah|face|man|woman|kid|family|pengantin|wisuda`):
  `natural skin, sharp focus, studio light` + `no horror, no gore, no disfigurement`.
- Makanan (`makanan|food|rendang|nasi|sate|bakso|kue|cake|kopi|coffee`):
  `appetizing, studio food photo`.
- Tempat (`pantai|gunung|kota|rumah|gedung|masjid|sawah|taman|jalan|jembatan|...`):
  `daylight, vibrant`.
- Horor (`horor|horror|hantu|ghost|dark|gore|seram|zombie|skull|tengkorak|vampire|dracula`):
  guard cerah DIMATIKAN, sisa basis saja. Mau horor? tulis katanya eksplisit.
- Default: `bright daylight, cheerful` + `no horror, no gore, no darkness`.

### 2.4 Rasio + resolusi (`autoDims` + `imgUrl`)

- `portrait` eksplisit / dokumen|poster|potret|full body -> `768x1024`.
- `landscape` eksplisit / wallpaper|landscape|pemandangan|pantai|kota|wide -> `1024x768`.
- `hd` eksplisit / `hd|4k|detail|bagus|tajam|jernih` -> `1024x1024`.
- Angka eksplisit (`imgUrl(p, seed, 512)`) -> kotak `NxN`.
- Default: `768x768` (512 terlalu pecah, 1024 lambat buat coba-coba).

### 2.5 URL final

```text
https://image.pollinations.ai/prompt/{encodeURIComponent(prompt_final)}
  ?width={w}&height={h}&nologo=true&private=true&enhance=true&model=flux&seed={acak|tetap}
```

- `seed` acak `0..99999` tiap render (tombol Baru = seed baru = varian baru).
- `seed` tetap (angka) = gambar sama persis (dipakai tes).
- `enhance=false` kalau prompt sudah diracik `expandPrompt` (biar nurut, tidak dipoles
  ulang seenaknya); `enhance=true` hanya untuk fallback statik offline.
- `private=true` + `nologo=true` = tanpa watermark, tidak publik.

## 3. Alur UI (`doImage` -> `expandPrompt` -> `genImage` -> `imgFinish`)

1. `send.js` deteksi `Media.imgRequest(t)` -> `doImage(t, label)` (tanpa LLM chat).
2. `doImage`: bubble user + bubble AI `Siapkan kanvas...`, `busy=true`, timer 650ms ->
   `genImage(body, clean)`.
3. `genImage(body, q, size?)` DUA TAHAP:
   - Tahap otak: `Media.expandPrompt(q)` minta AI tulis prompt EN detail (max 80 kata,
     objek sama persis). Web: `POST /api/chat`. Android/file offline: fallback statik
     langsung (tak pernah reject, max 25 dtk).
   - Tahap gambar: `Media.imgUrl(final, seed, size, enhance=false kalau expanded)`.
     `enhance=false` biar nurut (pollinations tidak poles ulang seenaknya).
     Skeleton + timer detik, `new Image()`, sukses -> `<img>` + bar tombol.
   - Gagal/timeout 60 dtk: pesan merah + bar tombol (coba Baru).
4. Terakhir diingat: `window._lastImgPrompt` (prompt bersih) untuk Baru/HD/Potret/Lanskap.

Tombol di tiap hasil (`ensureImgBar`):

- Baru: prompt sama, seed acak baru (varian).
- HD: render ulang `1024x1024`.
- Potret: `768x1024` (cocok sertifikat/poster).
- Lanskap: `1024x768` (cocok wallpaper).
- Simpan: unduh `ai-gambar.jpg` (fetch blob, fallback buka tab).
- Klik gambar: lightbox (`openImgViewer`) + Keluar + Simpan.

## 4. Contoh copy-paste (teruji logikanya)

- `buatkan gambar kucing oren hd` -> cat + bright + 1024.
- `gaya anime: samurai di hujan` -> anime suffix + 768.
- `buatkan gambar sertifikat penghargaan` -> certificate award + dokumen +
  portrait `768x1024` + `no building`.
- `wallpaper pantai` -> beach + landscape `1024x768`.
- `foto rendang` -> studio food photo.
- `gaya foto: nenek di sawah` -> realistic 85mm.
- `hantu di hutan` -> guard cerah mati (sesuai permintaan).

Cek cepat di console/Node:

```js
Media.imgUrl('sertifikat', 7); // harus ada no%20building + 768 + 1024
Media.imgUrl('wallpaper pantai', 7); // 1024x768
Media.imgUrl('kucing hd', 7); // 1024x1024
```

## 5. Batasan jujur (gratis vs PRO)

- Gratis pollinations `flux`: bagus untuk sketsa/poster/ilustrasi, tapi anatomi
  tangan/wajah dan teks kecil (tulisan di sertifikat) sering cacat. Itu batas
  model, bukan bug app. Teks sertifikat yang sempurna butuh template, bukan AI murni.
- Agar teks 100% benar: minta AI bikinkan `file HTML sertifikat` (jalur file,
  bukan gambar), lalu print-to-PDF. Contoh: `buatkan file sertifikat html nama Budi`.
- Native sekelas Gemini/OpenAI Image: butuh API key (PRO) di menu Konfigurasi.
  Tanpa key, jangan bandingkan 1:1.

## 6. Troubleshooting

- Horor semua -> prompt tanpa guard? Pastikan `autoGuard` jalan (cek URL ada
  `no%20horror`). Kalau minta cerah tapi tetap gelap: tambah `siang cerah` + tap Baru.
- Bangunan padahal sertifikat -> pastikan URL ada `no%20building` + `768x1024`.
  Kalau masih: tambah kata `dokumen kertas` di prompt.
- Pecah -> tap HD. Atau tulis `hd` sejak awal.
- Gepeng -> tap Potret (dokumen) / Lanskap (wallpaper).
- `Kelamaan (45 dtk)` -> internet / pollinations sibuk. Tap Baru (seed baru antrean baru).
- `Gagal bikin gambar` -> offline atau pemblokir iklan blokir domain. Coba data/barcode lain.
- Tombol hilang -> `ensureImgBar` sekali per bubble; reload chat dari riwayat tetap ada gambarnya.

## 7. File + tes + sync

- Kode: `js/media.js` (`Media.*`, `doImage`, `genImage`, `ensureImgBar`,
  `openImgViewer`, `saveImg`). Style: `css/chat.css` (`.aimg`, `.imgjob`, `.imgskeleton`).
- Sync: `bash sync.sh to-web|to-android|check`. `media.js` file bersama;
  `web-bridge.js` web-only; `devkey.js` android-only.
- Tes: `node --check js/media.js`, `npm test` (18 media tests),
  `bash test-web.sh`, `bash emulator-full-web.sh`.
- Live: `http://172.24.71.173:8080` (WSL). Refresh sekali tiap update
  (static `no-store` saat dev).
