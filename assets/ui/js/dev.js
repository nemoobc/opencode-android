/* ===== dev.js — fitur developer TERSEMBUNYI (bukan public) =====
   Masuk: tap teks versi di drawer 5x cepat.
   Kunci: pilih file license.key (hash cocok = buka sesi ini).
   Remote notif: edit notifications.json di repo → push → app fetch saat buka. */

/* SHA-256 kompak (public domain style) — untuk verifikasi hash, tanpa deps */
function sha256hex(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  var maxWord = Math.pow(2, 32), result = '';
  var words = [], bitLen = ascii.length * 8;
  var hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var k = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  var i, j;
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (bitLen / maxWord) | 0;
  words[words.length] = bitLen;
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16);
    var old = hash.slice(0);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
        (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash);
      hash[4] = (hash[4] + t1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

var Dev = (function() {
  var taps = [], need = 5, want = null;

  function toast2(t) { if (typeof toast === 'function') toast(t); }

  function armTap() {
    var now = Date.now();
    taps.push(now);
    while (taps.length && now - taps[0] > 3000) taps.shift();
    if (taps.length >= need) {
      taps = [];
      openLock();
    }
  }
  function openLock() {
    if (window._devOn) { openPanel(); return; }
    document.getElementById('dev-lock').style.display = '';
    document.getElementById('dev-panel').style.display = 'none';
    document.getElementById('dev-msg').textContent = '';
    document.getElementById('mdev').classList.add('show');
  }
  function expectedHash(done) {
    /* utama: tertanam build (tanpa network, anti-blokir file://) */
    if (typeof window.DEVKEY === 'string' && /^[0-9a-f]{64}$/.test(window.DEVKEY)) {
      done(window.DEVKEY);
      return;
    }
    if (want) { done(want); return; }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'devkey.txt?t=' + Date.now(), true);
      xhr.timeout = 4000;
      xhr.onload = function() {
        want = (xhr.status === 200 && xhr.responseText) ? xhr.responseText.trim().toLowerCase() : '';
        done(want);
      };
      xhr.onerror = function() { want = ''; done(''); };
      xhr.ontimeout = function() { want = ''; done(''); };
      xhr.send();
    } catch (e) { want = ''; done(''); }
  }
  function pick() {
    window._devPick = true;
    document.getElementById('dev-msg').textContent = 'Pilih file license.key...';
    try { Android.pickFile(); }
    catch (e) {
      window._devPick = false;
      document.getElementById('dev-msg').textContent = 'File picker tidak tersedia.';
    }
  }
  function verifyFile(path) {
    var hasReader = false;
    try { hasReader = (typeof Android !== 'undefined' && Android && typeof Android.readTextFile === 'function'); } catch (e) {}
    if (!hasReader) {
      document.getElementById('dev-msg').textContent = 'App/web ini versi lama — update dulu baru bisa.';
      return;
    }
    var raw = null;
    try { raw = Android.readTextFile(path); } catch (e) {}
    if (!raw) {
      document.getElementById('dev-msg').textContent = 'File tidak terbaca / terlalu besar (max 8KB).';
      return;
    }
    verifyText(raw);
  }
  function verifyText(raw) {
    var msg = document.getElementById('dev-msg');
    if (msg) msg.textContent = 'Memeriksa kunci...';
    var txt = String(raw).replace(/[\r\n]+/g, '').trim();
    if (!txt) { msg.textContent = 'File kosong.'; return; }
    expectedHash(function(wantHash) {
      if (!wantHash) { msg.textContent = 'Dev tidak tersedia di build ini.'; return; }
      if (sha256hex(txt) === wantHash) {
        window._devOn = true;
        openPanel();
      } else {
        msg.textContent = 'Kunci salah. Bukan license.key yang benar.';
      }
    });
  }
  function openPanel() {
    document.getElementById('dev-lock').style.display = 'none';
    var p = document.getElementById('dev-panel');
    p.style.display = '';
    var info = 'memuat...';
    try { info = (typeof Android !== 'undefined' && Android && Android.appInfo) ? Android.appInfo() : 'web'; } catch (e) {}
    document.getElementById('dev-info').textContent = info;
    var n = (window._notifList || []).length;
    document.getElementById('dev-notif').textContent = n + ' pengumuman termuat. Remote: edit notifications.json di repo → push → app fetch saat dibuka.';
    document.getElementById('mdev').classList.add('show');
  }
  function close() {
    document.getElementById('mdev').classList.remove('show');
  }
  return { armTap: armTap, pick: pick, verifyFile: verifyFile, openPanel: openPanel, close: close };
})();

/* hook hasil picker: kalau mode dev-lock, alihkan ke verifikasi (bukan lampiran) */
(function() {
  var raw = window.onFileReady;
  window.onFileReady = function(name, path) {
    if (window._devPick) { window._devPick = false; Dev.verifyFile(path); return; }
    if (raw) raw(name, path);
  };
})();
/* hook teks langsung (dipakai file picker web yg baca via FileReader) */
window._devFileText = function(t) {
  window._devPick = false;
  Dev.verifyText(t);
};

document.getElementById('dver').addEventListener('click', function() { Dev.armTap(); });
document.getElementById('dev-pick').onclick = function() { Dev.pick(); };
document.getElementById('dev-close').onclick = function() { Dev.close(); };
document.getElementById('dev-close2').onclick = function() { Dev.close(); };
document.getElementById('dev-refresh').onclick = function() {
  Notif.init();
  setTimeout(function() {
    document.getElementById('dev-notif').textContent = (window._notifList || []).length + ' pengumuman termuat.';
  }, 2500);
  if (typeof toast === 'function') toast('Refresh notifikasi...');
};
