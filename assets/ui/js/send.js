/* ===== send.js — send, forceStop, input handlers + web search ===== */

/* search toggle init */
var bsearchBtn = document.getElementById('bsearch');
if (WebSearch.enabled) bsearchBtn.classList.add('active');
bsearchBtn.onclick = function() {
  var on = WebSearch.toggle();
  bsearchBtn.classList.toggle('active', on);
  toast(on ? 'Pencarian Web: Aktif' : 'Pencarian Web: Mati');
};

/* send with optional web search */
function send(t, label, imgPrev, retryMode) {
  if (busy || !t) return;
  if (!window._srvOk) {
    addNote('⏳ Server Masih Menyala — Tunggu Sampai Siap, Lalu Kirim Ulang');
    return;
  }
  window._lastPrompt = t;
  userHold = false;
  document.getElementById('down').classList.remove('show');
  window._flushAt = 0;

  /* determine if we should search */
  var shouldSearch = WebSearch.enabled && !imgPrev && !retryMode && t.length > 5;
  var searchQuery = shouldSearch ? WebSearch.sanitizeQuery(t) : null;

  if (searchQuery) {
    /* show searching indicator in hint */
    document.getElementById('hint').innerHTML = '<svg class="spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#3DDC84" stroke-width="2.5" style="vertical-align:-1px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Mencari: <b>' + esc(searchQuery) + '</b> <span class="dots"><i></i><i></i><i></i></span>';
    document.getElementById('dot').className = 'work';

    WebSearch.search(searchQuery).then(function(results) {
      WebSearch.lastResults = results;
      document.getElementById('hint').textContent = '';
      doSend(t, label, imgPrev, retryMode, results);
    });
  } else {
    WebSearch.lastResults = [];
    doSend(t, label, imgPrev, retryMode, null);
  }
}

function doSend(t, label, imgPrev, retryMode, searchResults) {
  window._warmingUp = false;  /* reset warm-up suppress saat user kirim pesan */
  var um;
  if (retryMode) {
    var userMsgs = chat.querySelectorAll('.msg.user');
    um = userMsgs.length ? userMsgs[userMsgs.length - 1] : addMsg('user');
  } else {
    um = addMsg('user');
    msgCount++;
  }
  if (imgPrev) {
    um.innerHTML = '<img class="attimg" src="' + imgPrev + '"><span class="attname">' +
      esc(label || '') + '</span>';
  } else if (!retryMode) {
    um.textContent = label || t;
  }
  window._cur = null; window._plain = ''; window._canceling = false; window._done = false; window._aborted = false;
  window._suggested = false;
  window._gotDelta = false;
  var body;
  if (retryMode) {
    var aiMsgs = chat.querySelectorAll('.msg.ai');
    body = aiMsgs.length ? aiMsgs[aiMsgs.length - 1] : addMsg('ai');
  } else {
    body = addMsg('ai');
  }
  /* alur baca ala Claude: thinking → jawaban → sumber bernomor di bawah.
     chips sumber di atas DIHAPUS (dulu nongol sebelum jawaban, konteks-less). */
  body.innerHTML = '<div class="thinking-svg">' +
      '<svg class="brain-pulse" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3DDC84" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 4.5 2.8A4 4 0 0 1 20 8.5a4 4 0 0 1-1.2 2.9A4.5 4.5 0 0 1 17 18h-2a3 3 0 0 1-3-3v-1a3 3 0 0 0-3-3H7a4 4 0 0 1-1-7.9A5 5 0 0 1 12 2z"/><path d="M12 2v4M8.5 5.5L10 7M15.5 5.5L14 7"/><path d="M9 18h6"/></svg>' +
      '<svg class="gear" viewBox="0 0 24 24" width="14" height="14" fill="#3DDC84"><path d="M19.14 12.94a7.07 7.07 0 0 0 .06-.94c0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a6.94 6.94 0 0 0-1.63-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.63.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.63.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.57 1.63-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>' +
      '</div><span class="elapsed">Berpikir...</span>';
  window._cur = body;
  var t0 = Date.now();
  clearInterval(window._tm);
  busy = true;
  dot.className = 'work';
  go.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';
  go.classList.add('stop');

  /* build prompt with search context if available */
  var promptToSend = searchResults && searchResults.length
    ? WebSearch.buildPrompt(t, searchResults)
    : langPromp(t);

  document.getElementById('hint').innerHTML = 'Mengirim ke server...';
  var jTok = Android.send(promptToSend);
  if (typeof jTok === 'number' && jTok > 0) window._reqTok = jTok;
}

function forceStop() {
  clearTimeout(window._cw);
  if (typeof stopTyper === 'function') stopTyper();
  if (window._done || !busy) return;
  window._done = true;
  busy = false;
  clearInterval(window._tm);
  var elx = window._cur ? window._cur.querySelector('.elapsed') : null;
  if (elx) elx.remove();
  if (window._cur) {
    var plain = (window._plain || '').trim();
    window._cur.classList.remove('caret');
    if (plain) {
      window._cur.classList.remove('plain');
      window._cur.innerHTML = '<div class="md">' + mdRender(plain) + '</div>';
      addActions(window._cur, plain);
    } else {
      window._cur.classList.remove('plain');
      window._cur.innerHTML = '<span style="color:#8AA396;font-style:italic">Dibatalkan...</span>' +
        '<div class="mact"><button class="retry-cancel" onclick="(function(){' +
        'if(window._retrying)return;var p=window._lastCancelledPrompt;if(p){window._retrying=true;busy=false;window._done=false;send(p,null,null,true);setTimeout(function(){window._retrying=false},2000);}' +
        '})()">&#8635; Kirim Ulang</button></div>';
      window._lastCancelledPrompt = window._lastPrompt;
    }
    window._cur = null;
  }
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  go.classList.remove('stop');
  dot.className = '';
  document.getElementById('hint').textContent = '';
}
window.forceStop = forceStop;

go.onclick = function() {
  if (busy) {
    window._canceling = true; window._aborted = true;
    Android.cancel();
    forceStop();
    return;
  }
  var t = inp.value.trim();
  var att = window._att;
  if (!t && !att) return;
  inp.value = ''; inp.style.height = 'auto';
  if (att) {
    var image = /\.(jpe?g|png|gif|webp|bmp)$/i.test(att.name);
    var prompt;
    var sandbox = '/work/' + att.name;
    if (image) {
      prompt = '(user melampirkan gambar: ' + att.name + ')\n' +
        'Path kerja di sandbox KAMU: ' + sandbox + '\n\n' +
        'Jangan membuka/ membaca byte file gambar untuk melihat isinya — kamu tidak punya ' +
        'kemampuan melihat gambar. Cukup balas berdasarkan teks ini.\n\n' +
        (t ? 'Pesan user: ' + t : 'Berikan respons singkat tentang file lampiran ini.');
    } else {
      prompt = '(file dilampirkan ke folder kerja)\n\nNama: ' + att.name + '\nPath kerja: ' + sandbox + '\n\n' +
        (t ? 'Pesan: ' + t + '\n\n' : '') +
        'Baca/buka isi file ini. Kalau ada pertanyaan, jawab; kalau tidak, buatkan rangkuman singkat isinya.';
    }
    var lbl = (t ? t + '\n' : '') + (image ? '🖼️ ' : '📎 ') + att.name;
    var prev = image ? Android.readImageDataUrl(att.path) : null;
    attHide();
    send(prompt, lbl, prev);
  } else {
    send(t);
  }
  inp.focus();
};
go.onmousedown = battach.onmousedown = function(e) { e.preventDefault(); };
function refocusInp() {
  setTimeout(function() {
    try { inp.focus(); } catch (e) {}
  }, 60);
}
function bindChips() {
  document.querySelectorAll('.chip').forEach(function(c) {
    c.onclick = function() { send(c.getAttribute('data-q')); };
  });
}
inp.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go.onclick(); }
});
inp.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(110, this.scrollHeight) + 'px';
});
chat.addEventListener('click', function(e) {
  var cp = e.target.closest('button[data-copy]');
  if (cp) {
    Android.copyText(cp.getAttribute('data-copy'));
    var orig = cp.textContent;
    cp.textContent = '✓ OK';
    cp.classList.add('copied');
    setTimeout(function() { cp.textContent = orig; cp.classList.remove('copied'); }, 1500);
    return;
  }
  var a = e.target.closest('a[data-url]');
  if (a) { var u = a.getAttribute('data-url'); if (/^https?:\/\//i.test(u)) Android.openUrl(u); }
});
