/* ===== stream.js — appendOut, flushStream, finishUI, onDone, onError, onStatus, onReady, fadeSplash, progress ===== */
window.appendOut = function(t) {
  if (window._warmingUp) return;   /* suppress warm-up "OK" response */
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
  } else if (!window._gotDelta) {
    /* first delta: replace thinking animation with typing dots */
    window._cur.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    window._cur.classList.add('caret');
    window._cur.classList.add('plain');
  }
  window._plain += t;
  window._gotDelta = true;
  startTyper();
};
/* ===== typewriter: teks muncul bertahap biar kelihatan "mengetik" =====
   Delta dari server sering datang bergerombol (1 burst besar) sehingga
   tanpa pacer, jawaban langsung pop penuh. Pacer reveal bertahap 50ms. */
function startTyper() {
  if (window._typer) return;
  window._typer = setInterval(function() { tickTyper(); }, 50);
}
function stopTyper() {
  if (window._typer) { clearInterval(window._typer); window._typer = null; }
}
function tickTyper() {
  var cur = window._cur;
  if (!cur || !cur.isConnected) { stopTyper(); return; }
  var plain = window._plain || '', rend = window._rend || '';
  if (rend.length >= plain.length) {
    /* kejar-kejaran selesai saat done: render markdown final */
    if (window._done && window._ff) {
      window._ff = false;
      finishMarkdown(window._doneCode || 0);
      return;
    }
    /* idle: matiin interval (hemat CPU/baterai).
       startTyper nyala lagi otomatis pas delta baru masuk. */
    stopTyper();
    return; /* nunggu delta berikutnya */
  }
  if (!rend) cur.textContent = ''; /* clear dots di reveal pertama */
  var remain = plain.length - rend.length;
  /* fast-forward pas done: kebut biar typing tetap kelihatan sekilas
     tapi jawaban langsung jadi (timing pas, ga ngegantung) */
  var step = window._ff
    ? Math.max(120, Math.ceil(remain / 3))
    : Math.max(4, Math.min(120, Math.ceil(remain / 10)));
  var tail = plain.substring(rend.length, rend.length + step);
  window._rend = rend + tail;
  cur.textContent += tail;
  cur.classList.add('caret');
  follow();
}
window._tickTyper = tickTyper;
window.flushStream = function() {
  stopTyper();
  if (window._cur) { window._rend = window._plain; window._cur.textContent = window._plain; follow(); }
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
  /* teks belum selesai ke-reveal (burst cepat): JANGAN langsung swap ke
     markdown — fast-forward typing dulu biar animasi ngetik kelihatan,
     render final ditunda sampai tick kejar (timing pas). */
  if (window._cur && !window._canceling &&
      (window._plain || '').trim() &&
      (window._rend || '').length < (window._plain || '').length) {
    window._ff = true;
    window._doneCode = code;
    dot.className = 'work';
    if (typeof startTyper === 'function') startTyper();
    return;
  }
  if (typeof stopTyper === 'function') stopTyper();
  finishMarkdown(code);
};
function finishMarkdown(code) {
  if (typeof stopTyper === 'function') stopTyper();
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
        'if(window._retrying)return;var p=window._lastCancelledPrompt;if(p){' +
        'var old=document.querySelectorAll(\'.sysnote.err\');for(var i=0;i<old.length;i++)old[i].remove();' +
        'window._retrying=true;busy=false;window._done=false;send(p,null,null,true);setTimeout(function(){window._retrying=false},2000);}' +
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
  if (low.indexOf('timed out') >= 0 || low.indexOf('timeout') >= 0)
    return 'Server model lambat/kehabisan waktu. Periksa internet, lalu coba lagi.';
  if (low.indexOf('cleartext') >= 0 || low.indexOf('localhost') >= 0 || low.indexOf('connect') >= 0)
    return 'Koneksi ke server lokal gagal. Tutup lalu buka ulang aplikasi.';
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
window._onReadyRaw = function(ok, free) {
  window._srvOk = !!ok;
  ovElapsedStop();
  /* selalu hapus splash — baik server siap maupun gagal */
  var sp = document.getElementById('splash');
  if (sp && !sp.classList.contains('out')) {
    sp.classList.add('out');
    setTimeout(function() { if (sp && sp.parentNode) sp.parentNode.removeChild(sp); }, 700);
  }
  if (ok) {
    /* sequence siap: stepper penuh → ✓ 450ms → fade → hello stagger */
    ovStep(2);
    var ov = document.getElementById('ov');
    if (ov) ov.classList.add('ready');
    setTimeout(function() {
      if (ov) ov.classList.remove('show');
      if (!chat.querySelector('#hello') && !chat.querySelector('.msg')) {
        chat.innerHTML = window._helloHTML;
        bindChips();
      }
      var wrap = document.getElementById('chatwrap');
      if (wrap) {
        wrap.classList.remove('enter');
        void wrap.offsetWidth;
        wrap.classList.add('enter');
      }
      dot.className = 'ok';
    }, 450);
  } else {
    var ov2 = document.getElementById('ov');
    if (ov2) {
      ov2.classList.add('show', 'err');
      var rb = document.getElementById('ovretry');
      if (rb) rb.onclick = function() { toast('Tutup lalu buka ulang aplikasi'); };
    }
    addNote('Server gagal start. Coba tutup lalu buka ulang aplikasi.', true, true);
  }
};
function fadeSplash() {
  var sp = document.getElementById('splash');
  if (sp && !sp.classList.contains('out')) {
    sp.classList.add('out');
    setTimeout(function() { if (sp && sp.parentNode) sp.parentNode.removeChild(sp); }, 700);
  }
}
window.PAYLOAD_TOTAL = 4839338;
window.FILE_TOTAL = 528;
window._fileN = 0;
window._mile = 0;
window._done100at = 0;
/* progress dicat ke overlay (#ov) DAN splash (#splash) — splash yang
   tampil duluan saat ekstrak jalan, jadi % harus kelihatan di sana.
   SATU label "N / total file • P%" — dulu dua format (file vs MB)
   rebutan satu label sampai kelihatan flicker. */
function paintProgress(pct, label) {
  pct = Math.max(0, Math.min(100, pct));
  var rpct = Math.round(pct);
  var f = document.getElementById('pfill');
  if (f) f.style.width = pct + '%';
  var p = document.getElementById('pnum');
  if (p) p.textContent = label;
  var sf = document.getElementById('spfill');
  if (sf) sf.style.width = pct + '%';
  var sp = document.getElementById('spnum');
  if (sp) sp.textContent = label;
  /* milestone 25/50/75: kedip emas sekilas */
  if (rpct >= 25 && window._mile < 25 && rpct < 100) flashMile(25);
  else if (rpct >= 50 && window._mile < 50 && rpct < 100) flashMile(50);
  else if (rpct >= 75 && window._mile < 75 && rpct < 100) flashMile(75);
  if (rpct >= 100 && !window._done100at) {
    window._done100at = Date.now();
    var bar = document.getElementById('pbar');
    if (bar) { bar.classList.add('done'); setTimeout(function() { bar.classList.remove('done'); }, 900); }
    var sbar = document.getElementById('spbar');
    if (sbar) { sbar.classList.add('done'); setTimeout(function() { sbar.classList.remove('done'); }, 900); }
    if (p) p.textContent = '✓ ' + label;
    if (sp) sp.textContent = '✓ ' + label;
  }
}
function flashMile(m) {
  window._mile = m;
  var bar = document.getElementById('pbar');
  if (bar) { bar.classList.add('mile'); setTimeout(function() { bar.classList.remove('mile'); }, 250); }
  var sbar = document.getElementById('spbar');
  if (sbar) { sbar.classList.add('mile'); setTimeout(function() { sbar.classList.remove('mile'); }, 250); }
}
function fileLabel(pct) {
  return window._fileN + ' / ' + window.FILE_TOTAL + ' file • ' + Math.round(pct) + '%';
}
window.setProgress = function(n) {
  window._fileN = n;
  var pct = (n / window.FILE_TOTAL) * 100;
  paintProgress(pct, fileLabel(pct));
};
window.setProgressBytes = function(b) {
  var pct = (b / window.PAYLOAD_TOTAL) * 100;
  paintProgress(pct, fileLabel(Math.min(100, pct)));
};
function ovStep(n) {
  /* stepper 0=ekstrak 1=server 2=siap */
  var ids = ['st0', 'st1', 'st2'], lns = ['ln0', 'ln1'];
  for (var i = 0; i < 3; i++) {
    var e = document.getElementById(ids[i]);
    if (!e) continue;
    e.classList.remove('on', 'ok');
    if (i < n) e.classList.add('ok');
    else if (i === n) e.classList.add('on');
  }
  for (var j = 0; j < 2; j++) {
    var l = document.getElementById(lns[j]);
    if (!l) continue;
    if (j < n) l.classList.add('ok');
    else l.classList.remove('ok');
  }
}
function ovElapsedStop() {
  if (window._ovTimer) { clearInterval(window._ovTimer); window._ovTimer = null; }
  var t = document.getElementById('ovtime');
  if (t) t.textContent = '';
}
window.setStage = function(t) {
  t = t || '';
  var apply = function() {
    var p = document.getElementById('ovp');
    if (p) {
      p.textContent = t;
      p.classList.remove('swap');
      void p.offsetWidth;
      p.classList.add('swap');
    }
    /* fase boot server tidak ada % (indefinite) → cincin + stepper.
       fase ekstrak → bar determinate biasa. */
    var boot = /menyalakan/i.test(t);
    var ov = document.getElementById('ov');
    if (ov) {
      if (boot) ov.classList.add('boot');
      else ov.classList.remove('boot');
    }
    var bar = document.getElementById('pbar');
    if (bar) {
      if (boot) bar.classList.add('indet');
      else bar.classList.remove('indet');
    }
    var num = document.getElementById('pnum');
    if (boot) {
      ovStep(1);
      ovElapsedStop();
      window._bootAt = Date.now();
      window._ovTimer = setInterval(function() {
        var s = Math.floor((Date.now() - window._bootAt) / 1000);
        var te = document.getElementById('ovtime');
        if (!te) return;
        te.textContent = s > 60
          ? 'menyalakan server… ' + s + ' dtk — masih nyala, sabar…'
          : 'menyalakan server… ' + s + ' dtk';
      }, 1000);
      if (num) num.textContent = 'memuat server...';
    } else {
      ovElapsedStop();
      ovStep(0);
    }
  };
  /* 100% baru kelar (<600ms): tahan ✓ sebentar sebelum mode boot nimpa */
  if (/menyalakan/i.test(t) && window._done100at && Date.now() - window._done100at < 600) {
    setTimeout(apply, 600);
  } else {
    apply();
  }
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

/* ===== wrapper: tunda onReady kalau splash masih ada =====
   Java bisa panggil onReady(true) sebelum splash fade (server warm).
   User harusnya liat BERSIAP dulu sebelum masuk chat. */
(function() {
  var _raw = window._onReadyRaw;
  window.onReady = function(ok, free) {
    if (ok && document.getElementById('splash')) {
      /* splash masih tampil — tunda, jangan hide overlay */
      window._pendingReady = {ok: ok, free: free};
      return;
    }
    if (_raw) _raw(ok, free);
  };
})();
