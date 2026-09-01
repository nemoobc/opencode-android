/* ===== stream.js — appendOut, flushStream, finishUI, onDone, onError, onStatus, onReady, fadeSplash, progress ===== */
window.appendOut = function(t) {
  if (window._aborted) return;
  if (window._done) return;
  if (window._rend === undefined) window._rend = '';
  killHello();
  if (!window._cur) {
    window._plain = '';
    window._rend = '';
    var body = addMsg('ai');
    body.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    body.classList.add('caret');
    body.classList.add('plain');
    window._cur = body;
  } else {
    var d = window._cur.querySelector('.dots');
    if (d) d.remove();
  }
  window._plain += t;
  window._gotDelta = true;
  var now = Date.now();
  if (!window._flushAt || now - window._flushAt >= 40) {
    window._flushAt = now;
    var tail = window._plain.substring(window._rend.length);
    window._rend = window._plain;
    if (tail.length && window._cur && window._cur.isConnected) {
      window._cur.textContent += tail;
      window._cur.classList.add('caret');
      follow();
    }
  }
};
window.flushStream = function() {
  if (window._cur) { window._cur.textContent = window._plain; follow(); }
};
function finishUI(code) {
  busy = false;
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  go.classList.remove('stop');
  dot.className = code === 0 ? 'ok' : 'bad';
  document.getElementById('hint').textContent = '';
}

window.onDone = function(code, tok) {
  window._lastOnDone = code + ' @ ' + new Date().toISOString();
  if (tok !== undefined && tok < window._reqTok) return;
  clearTimeout(window._cw);
  if (window._done) return;
  window._done = true;
  clearInterval(window._tm);
  var el = window._cur ? window._cur.querySelector('.elapsed') : null;
  if (el) el.remove();
  if (window._cur) {
    var plain = (window._plain || '').trim();
    if (window._canceling) {
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
  } else if (plain) {
      window._cur.classList.remove('plain');
      window._cur.innerHTML = '<div class="md">' + mdRender(plain) + '</div>';
      addActions(window._cur, plain);
    } else if (code !== 0) {
      window._cur.innerHTML = '<span style="color:#E08A7B">Gagal (Kode ' + code + ') — Coba Lagi.</span>';
    }
    window._cur.classList.remove('caret');
    window._cur = null;
  }
  busy = false;
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  go.classList.remove('stop');
  dot.className = code === 0 ? 'ok' : 'bad';
  document.getElementById('hint').textContent = '';
  /* append search sources if available */
  if (WebSearch.lastResults && WebSearch.lastResults.length) {
    var srcHTML = WebSearch.buildSourcesHTML();
    if (srcHTML) {
      /* find the last AI message and append sources */
      var aiMsgs = chat.querySelectorAll('.msg.ai');
      var lastAI = aiMsgs.length ? aiMsgs[aiMsgs.length - 1] : null;
      if (lastAI) {
        var mdDiv = lastAI.querySelector('.md');
        if (mdDiv) {
          mdDiv.insertAdjacentHTML('beforeend', srcHTML);
        } else {
          /* wrap existing content + sources in .md div */
          var existing = lastAI.innerHTML;
          lastAI.innerHTML = '<div class="md">' + existing + srcHTML + '</div>';
        }
      }
    }
  }
  histSaveCur();
};
function friendlyErr(m) {
  var low = String(m).toLowerCase();
  if (low.indexOf('http 500') >= 0 || low.indexOf('model not found') >= 0)
    return 'Model tidak tersedia saat ini. Coba ganti model cepat dari menu, lalu ketik ulang.';
  if (low.indexOf('http 429') >= 0 || low.indexOf('too many') >= 0 || low.indexOf('rate limit') >= 0)
    return 'Terlalu banyak permintaan (rate limit). Tunggu sebentar, lalu coba lagi.';
  if (low.indexOf('cleartext') >= 0 || low.indexOf('localhost') >= 0 || low.indexOf('connect') >= 0)
    return 'Koneksi ke server lokal gagal. Tutup lalu buka ulang aplikasi.';
  if (low.indexOf('timed out') >= 0 || low.indexOf('timeout') >= 0)
    return 'Server model lambat/kehabisan waktu. Periksa internet, lalu coba lagi.';
  return String(m);
}
window.onError = function(m, tok) {
  window._lastOnError = m + ' @ ' + new Date().toISOString();
  if (tok !== undefined && tok < window._reqTok) return;
  clearTimeout(window._cw);
  var first = !window._done;
  if (window._cur) {
    try {
      var bw = window._cur.parentNode;
      var msg = bw && bw.classList.contains('bw') ? bw.parentNode : window._cur;
      if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
    } catch (e) {}
    window._cur = null;
  }
  window._done = true;
  clearInterval(window._tm);
  ov.classList.remove('show');
  killHello();
  if (first) addNote(friendlyErr(m), true, true);
  finishUI(-1);
  histSaveCur();
};
window.onStatus = function(m) {
  addNote('⚙ ' + m);
};
window.onReady = function(ok, free) {
  window._srvOk = !!ok;
  if (ok) {
    ov.classList.remove('show');
    var sp = document.getElementById('splash');
    if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
    if (!chat.querySelector('#hello') && !chat.querySelector('.msg')) {
      chat.innerHTML = window._helloHTML;
      bindChips();
    }
    dot.className = 'ok';
  } else window.onError('payload tidak lengkap - uninstall lalu install ulang');
};
function fadeSplash() {
  var sp = document.getElementById('splash');
  if (sp && !sp.classList.contains('out')) {
    sp.classList.add('out');
    setTimeout(function() { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600);
  }
}
window.PAYLOAD_TOTAL = 16332800;
window.setProgress = function(n) {
  document.getElementById('pnum').textContent = n + ' / 555 file';
};
window.setProgressBytes = function(b) {
  var mb = b / 1048576;
  var pct = Math.min(100, (b / PAYLOAD_TOTAL) * 100);
  document.getElementById('pfill').style.width = pct + '%';
  document.getElementById('pnum').textContent = mb.toFixed(1) + ' / 16 MB (' + Math.round(pct) + '%)';
};
window.setStage = function(t) {
  var p = document.getElementById('ovp');
  if (p) p.textContent = t;
};
window.onSaved = function() {
  document.getElementById('mconfig').classList.remove('show');
  toast('Config tersimpan');
};
window.onUpdate = function(tag, body) {
  document.getElementById('utag').textContent = tag;
  document.getElementById('ubanner').classList.add('show');
  window._upTag = tag;
  toast('Update ' + tag + ' tersedia');
};
