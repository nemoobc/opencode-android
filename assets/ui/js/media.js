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

  /* request gambar? cth: "buatkan gambar kucing astronot" (bukan "gambar apa itu") */
  function imgRequest(t) {
    var low = String(t || '').toLowerCase();
    return hasAny(low, IMG_ACT) && hasAny(low, IMG_WORDS) ? cleanImgPrompt(t) : null;
  }
  function cleanImgPrompt(t) {
    var s = String(t || '');
    s = s.replace(/tolong|buatkan|bikinkan|buatin|lukiskan|gambarkan|desainkan|generate|create|design|draw/gi, '');
    s = s.replace(/^(gambar|lukisan|foto|ilustrasi|image|picture|visual|sketsa|poster|wallpaper|yang|sebuah|seekor|tentang)\s+/gi, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s || 'random art';
  }
  function imgUrl(prompt, seed) {
    return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
      '?width=768&height=768&nologo=true&seed=' + (seed === undefined ? Math.floor(Math.random() * 100000) : seed);
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

/* ===== alur gambar: bubble loading → img → aksi ===== */
function doImage(t, label) {
  window._warmingUp = false;
  var um = addMsg('user');
  um.textContent = label || t;
  msgCount++;
  window._cur = null; window._plain = ''; window._canceling = false;
  window._done = false; window._aborted = false;
  window._lastPrompt = t;
  var body = addMsg('ai');
  var q = Media.cleanImgPrompt(t);
  body.innerHTML = '<div class="imgskeleton"></div><span class="elapsed">Gambar "' + esc(q) + '"...</span>';
  window._cur = body;
  busy = true;
  dot.className = 'work';
  go.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';
  go.classList.add('stop');
  document.getElementById('hint').textContent = '';
  window._lastImgPrompt = t;
  var src = Media.imgUrl(q);
  window._lastImgUrl = src;
  var img = new Image();
  img.onload = function() {
    if (window._done || window._aborted || window._cur !== body) return;
    body.classList.remove('caret');
    body.innerHTML = '<img class="aimg" src="' + src + '" alt="' + escAttr(q) + '">' +
      '<div class="mact"><button data-imgnew>🔄 Baru</button>' +
      '<button data-imgopen>🔗 Buka</button></div>';
    body.querySelector('[data-imgnew]').onclick = function() {
      if (busy) return;
      busy = false; window._done = false;
      doImage(window._lastImgPrompt);
    };
    body.querySelector('[data-imgopen]').onclick = function() { Android.openUrl(window._lastImgUrl); };
    window._cur = null;
    busy = false;
    go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    go.classList.remove('stop');
    dot.className = 'ok';
    histSaveCur();
  };
  img.onerror = function() {
    if (window._done || window._aborted) return;
    window._cur = null;
    busy = false;
    dot.className = 'bad';
    go.classList.remove('stop');
    body.innerHTML = '<span style="color:#E08A7B">Gagal bikin gambar. Cek internet, coba lagi.</span>';
  };
  img.src = src;
}
window._reImg = function() {};

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
    send(enriched);
  } else {
    send(t);
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
    '<div class="mact"><button data-dl>⬇ Unduh</button>' +
    '<button data-cp>📋 Salin</button>' +
    '<button data-vw>👁 Lihat</button></div></div>';
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
