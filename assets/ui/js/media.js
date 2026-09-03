/* ===== media.js — AI gambar (pollinations) + AI file (kode sbg file) ===== */
var Media = (function() {
  var IMG_WORDS = ['gambar', 'lukisan', 'foto', 'ilustrasi', 'image', 'picture', 'visual', 'sketsa', 'poster', 'wallpaper'];
  var IMG_ACT = ['buatkan', 'bikin', 'buat', 'tolong', 'generate', 'create', 'lukis', 'lukiskan', 'draw', 'gambarkan', 'desain', 'design'];
  var FILE_ACT = ['buatkan file', 'buatin file', 'buat file', 'kirim file', 'kirim sebagai file', 'simpan sebagai file', 'simpan ke file', 'buatkan kode', 'buatin kode', 'download'];
  var EXT = { python: 'py', py: 'py', javascript: 'js', js: 'js', html: 'html', css: 'css', json: 'json', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', go: 'go', rust: 'rs', rs: 'rs', php: 'php', ruby: 'rb', rb: 'rb', bash: 'sh', sh: 'sh', shell: 'sh', sql: 'sql', xml: 'xml', yaml: 'yml', yml: 'yml', markdown: 'md', md: 'md', text: 'txt', txt: 'txt' };

  function hasAny(t, arr) {
    for (var i = 0; i < arr.length; i++) {
      if (t.indexOf(arr[i]) >= 0) return true;
    }
    return false;
  }

  /* request gambar? cth: "buatkan gambar kucing", "gambar kucing dong", "foto senja ya"
     BUKAN: "gambar apa itu?" (nanya) */
  function imgRequest(t) {
    var low = String(t || '').toLowerCase().trim();
    if (hasAny(low, IMG_ACT) && hasAny(low, IMG_WORDS)) return cleanImgPrompt(t);
    if (/^(gambar|lukisan|foto|ilustrasi|image|picture|visual|sketsa|poster|wallpaper)\b/.test(low) &&
        !/^(gambar|foto|lukisan)\s+apa|apa\s+itu|maksud|artinya/.test(low)) return cleanImgPrompt(t);
    if (hasAny(low, IMG_WORDS) && /(dong|ya|kak|plis|please|dong$|\sya$|\skak$)/.test(low) &&
        !/apa\s+itu|yang\s+mana/.test(low)) return cleanImgPrompt(t);
    return null;
  }
  function cleanImgPrompt(t) {
    var s = String(t || '');
    s = s.replace(/tolong|buatkan|bikinkan|buatin|lukiskan|gambarkan|desainkan|generate|create|design|draw/gi, '');
    s = s.replace(/^(gambar|lukisan|foto|ilustrasi|image|picture|visual|sketsa|poster|wallpaper|yang|sebuah|seekor|tentang)\s+/gi, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s || 'random art';
  }
  function imgUrl(prompt, seed, size) {
    var s = size || 512; /* 512 = jauh lebih cepat dari 768 */
    return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
      '?width=' + s + '&height=' + s + '&nologo=true&seed=' + (seed === undefined ? Math.floor(Math.random() * 100000) : seed);
  }

  /* request file/kode? cth: "buatkan file kode python kalkulator" */
  function fileRequest(t) {
    var low = String(t || '').toLowerCase();
    return hasAny(low, FILE_ACT);
  }
  function fileName(t, fenceLang) {
    var m = String(t || '').match(/([\w\-]+\.(py|js|html|css|txt|md|json|java|cpp?|go|rs|php|rb|sh|sql|xml|ya?ml))/i);
    if (m) return m[1];
    var ext = EXT[String(fenceLang || '').toLowerCase()] || 'txt';
    return 'kode.' + ext;
  }
  function extractCode(plain) {
    var s = String(plain || '');
    var m = s.match(/```(\w*)\n?([\s\S]*?)```/);
    if (m) return { lang: m[1] || '', code: m[2].replace(/\n$/, '') };
    return { lang: '', code: s.trim() };
  }
  function fenceLangOf(plain) {
    var m = String(plain || '').match(/```(\w+)/);
    return m ? m[1] : '';
  }

  return {
    imgRequest: imgRequest,
    cleanImgPrompt: cleanImgPrompt,
    imgUrl: imgUrl,
    fileRequest: fileRequest,
    fileName: fileName,
    extractCode: extractCode,
    fenceLangOf: fenceLangOf
  };
})();

/* ===== alur gambar: thinking → skeleton+timer → img / timeout =====
   Regen MENAMBAH (append), tidak menimpa. Timeout 45s anti-stuck. */
var IMG_SVG_NEW = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><polyline points="21 3 21 9 15 9"/></svg>';
var IMG_SVG_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
var IMG_SVG_DL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
function doImage(t, label) {
  window._warmingUp = false;
  var um = addMsg('user');
  um.textContent = label || t;
  msgCount++;
  window._cur = null; window._plain = ''; window._canceling = false;
  window._done = false; window._aborted = false;
  window._lastPrompt = t;
  window._lastImgPrompt = t;
  var body = addMsg('ai');
  body.innerHTML = '<div class="thinking-svg">' +
    '<svg class="brain-pulse" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3DDC84" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 4.5 2.8A4 4 0 0 1 20 8.5a4 4 0 0 1-1.2 2.9A4.5 4.5 0 0 1 17 18h-2a3 3 0 0 1-3-3v-1a3 3 0 0 0-3-3H7a4 4 0 0 1-1-7.9A5 5 0 0 1 12 2z"/></svg>' +
    '</div><span class="elapsed">Siapkan kanvas...</span>';
  window._cur = body;
  busy = true;
  dot.className = 'work';
  go.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';
  go.classList.add('stop');
  document.getElementById('hint').textContent = '';
  setTimeout(function() { genImage(body, Media.cleanImgPrompt(t)); }, 650);
}
function genImage(body, q) {
  if (!body.isConnected || window._aborted) return;
  var sk = document.createElement('div');
  sk.className = 'imgjob';
  sk.innerHTML = '<div class="imgskeleton"></div><span class="elapsed">Gambar "' + esc(q) + '"... <span class="imgt">0</span> dtk</span>';
  body.appendChild(sk);
  var think = body.querySelector('.thinking-svg');
  if (think) think.remove();
  var eb = body.querySelectorAll('.elapsed');
  for (var k = 0; k < eb.length - 1; k++) eb[k].remove();
  var t0 = Date.now(), done = false;
  var iv = setInterval(function() {
    var e = sk.querySelector('.imgt');
    if (e && e.isConnected) e.textContent = Math.floor((Date.now() - t0) / 1000);
    else clearInterval(iv);
  }, 1000);
  var to = setTimeout(function() {
    if (done || !sk.isConnected) return;
    done = true;
    clearInterval(iv);
    sk.innerHTML = '<span style="color:#E08A7B">Kelamaan (45 dtk). Cek internet, coba tombol Baru.</span>';
    imgFinish(body);
  }, 45000);
  var src = Media.imgUrl(q);
  var img = new Image();
  img.onload = function() {
    if (done || !sk.isConnected) return;
    done = true;
    clearInterval(iv);
    clearTimeout(to);
    sk.innerHTML = '<img class="aimg" src="' + src + '" alt="' + escAttr(q) + '">';
    ensureImgBar(body);
    imgFinish(body);
  };
  img.onerror = function() {
    if (done || window._aborted || !sk.isConnected) return;
    done = true;
    clearInterval(iv);
    clearTimeout(to);
    sk.innerHTML = '<span style="color:#E08A7B">Gagal bikin gambar. Cek internet, coba tombol Baru.</span>';
    ensureImgBar(body);
    imgFinish(body);
  };
  img.src = src;
}
function ensureImgBar(body) {
  if (body.querySelector('[data-imgnew]')) return;
  var d = document.createElement('div');
  d.className = 'mact';
  d.innerHTML = '<button data-imgnew>' + IMG_SVG_NEW + ' Baru</button>';
  body.appendChild(d);
  d.querySelector('[data-imgnew]').onclick = function() {
    if (busy && window._cur) return;
    busy = true; window._done = false; window._aborted = false;
    dot.className = 'work';
    genImage(body, Media.cleanImgPrompt(window._lastImgPrompt || ''));
  };
}
function imgFinish(body) {
  var pending = body.querySelector('.imgskeleton');
  if (pending) return; /* masih ada yang loading */
  window._cur = null;
  busy = false;
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  go.classList.remove('stop');
  dot.className = 'ok';
  document.getElementById('hint').textContent = '';
  histSaveCur();
}
/* ===== lightbox gambar ala chatgpt: Keluar + Simpan di atas ===== */
var _ivSrc = '';
function openImgViewer(src) {
  _ivSrc = src;
  var v = document.getElementById('imgview');
  if (!v) {
    v = document.createElement('div');
    v.id = 'imgview';
    v.innerHTML = '<div class="ivtop"><button data-x>' + IMG_SVG_X + ' Keluar</button>' +
      '<button data-sv>' + IMG_SVG_DL + ' Simpan</button></div><img id="ivimg" alt="">';
    document.body.appendChild(v);
    v.querySelector('[data-x]').onclick = closeImgViewer;
    v.querySelector('[data-sv]').onclick = function() { saveImg(_ivSrc); };
    v.addEventListener('click', function(e) { if (e.target === v) closeImgViewer(); });
  }
  document.getElementById('ivimg').src = src;
  v.classList.add('show');
}
function closeImgViewer() {
  var v = document.getElementById('imgview');
  if (v) v.classList.remove('show');
}
function saveImg(url) {
  try {
    fetch(url).then(function(r) {
      if (!r.ok) throw 0;
      return r.blob();
    }).then(function(b) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'ai-gambar.jpg';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { try { URL.revokeObjectURL(a.href); } catch (e) {} a.remove(); }, 800);
      toast('Menyimpan gambar...');
    }).catch(function() {
      try { Android.openUrl(url); } catch (e) { toast('Gagal simpan'); }
    });
  } catch (e) {
    try { Android.openUrl(url); } catch (e2) { toast('Gagal simpan'); }
  }
}

/* ===== alur file: tanya dulu chat/file, baru jalan ===== */
function askFileMode(t) {
  var um = addMsg('user');
  um.textContent = t;
  msgCount++;
  window._lastPrompt = t;
  var body = addMsg('ai');
  body.innerHTML = '<div class="fchoice"><div class="fchoice-q">Mau ditampilkan di chat atau dikirim sebagai file?</div>' +
    '<div class="fchoice-btns"><button data-pick="chat">💬 Tampilkan di chat</button>' +
    '<button data-pick="file">📄 Kirim sebagai file</button></div></div>';
  window._pendingPrompt = t;
  body.querySelector('[data-pick="chat"]').onclick = function() { window._pickMode('chat'); };
  body.querySelector('[data-pick="file"]').onclick = function() { window._pickMode('file'); };
  follow();
}
window._pickMode = function(mode) {
  var t = window._pendingPrompt;
  if (!t || busy) return;
  window._pendingPrompt = null;
  /* hapus bubble pilihan */
  var msgs = chat.querySelectorAll('.msg.ai');
  var last = msgs.length ? msgs[msgs.length - 1] : null;
  if (last && last.querySelector('.fchoice')) last.parentNode.removeChild(last);
  if (mode === 'file') {
    window._fileMode = { at: Date.now() };
    var enriched = t + '\n\n[OUTPUT HANYA kode mentah dalam 1 blok ```, tanpa penjelasan di luar blok]';
    send(enriched, null, null, false, true);
  } else {
    send(t, null, null, false, true);
  }
};

/* render kartu file (dipanggil finishMarkdown saat _fileMode) */
function onFileDone(code, plain) {
  var got = Media.extractCode(plain);
  var lang = got.lang || Media.fenceLangOf(plain);
  var name = Media.fileName(window._lastPrompt, lang);
  var cur = window._cur;
  if (!cur) return;
  cur.classList.remove('plain', 'caret');
  var size = Math.round(new Blob([got.code]).size / 1024 * 10) / 10;
  cur.innerHTML = '<div class="fcard"><div class="fname">📄 ' + esc(name) + '</div>' +
    '<div class="fmeta">' + (lang || 'teks') + ' • ' + size + ' KB</div>' +
    '<div class="mact"><button data-dl><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><polyline points="6 11 12 17 18 11"/><path d="M4 21h16"/></svg> Unduh</button>' +
    '<button data-cp><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Salin</button>' +
    '<button data-vw><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg> Lihat</button></div></div>';
  cur.querySelector('[data-dl]').onclick = function() { dlFile(name, got.code); };
  cur.querySelector('[data-cp]').onclick = function() {
    Android.copyText(got.code);
    toast('Kode disalin');
  };
  cur.querySelector('[data-vw]').onclick = function() {
    cur.innerHTML = '<div class="md">' + mdRender(plain) + '</div>';
    addActions(cur, plain);
  };
  window._cur = null;
  busy = false;
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  go.classList.remove('stop');
  dot.className = code === 0 ? 'ok' : 'bad';
  document.getElementById('hint').textContent = '';
  histSaveCur();
}
function dlFile(name, text) {
  try {
    var blob = new Blob([text], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { try { URL.revokeObjectURL(a.href); } catch (e) {} a.remove(); }, 800);
    toast('Unduh dimulai' + (typeof Android !== 'undefined' && Android.appInfo && Android.appInfo().indexOf('web') !== 0 ? ' (cek notifikasi)' : ''));
  } catch (e) {
    Android.copyText(text);
    toast('Unduh gagal — kode disalin');
  }
}
