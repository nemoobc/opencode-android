/* ===== history.js — riwayat obrolan + context menu + streaming indicator ===== */
var HKEY = 'oc-hist';
var _hctxIdx = -1;
function histGet() { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch(e) { return []; } }
function histSave(arr) { try { localStorage.setItem(HKEY, JSON.stringify(arr)); } catch(e) {} }
function histSaveCur() {
  var msgs = chat.querySelectorAll('.msg.user');
  if (!msgs.length) return;
  var title = msgs[0].textContent || 'Obrolan tanpa judul';
  if (title.length > 40) title = title.substring(0, 40) + '...';
  var arr = histGet();
  var idx = -1;
  for (var i = 0; i < arr.length; i++) { if (arr[i].id === window._chatId) { idx = i; break; } }
  if (idx >= 0 && arr[idx].title) title = arr[idx].title; /* judul stabil walau DOM ke-trim */
  var storeHtml = chat.innerHTML;
  /* foto data-URL bisa MB-an: di atas 400KB, simpan tanpa blob gambar
     (nama file tetap). Tampilan live tidak diubah. */
  try {
    if (storeHtml.length > 400000) storeHtml = storeHtml.replace(/src="data:image[^"]{1000,}"/g, 'src=""');
  } catch (e) {}
  var entry = { id: window._chatId, title: title, ts: Date.now(), model: curModel, html: storeHtml, pinned: false };
  if (idx >= 0) { entry.pinned = arr[idx].pinned || false; arr[idx] = entry; }
  else arr.unshift(entry);
  if (arr.length > 30) arr = arr.slice(0, 30);
  try {
    histSave(arr);
  } catch (e) {
    /* storage penuh: buang 1 entri tak-semat tertua, coba lagi */
    try {
      for (var d = arr.length - 1; d >= 0; d--) {
        if (!arr[d].pinned && arr[d].id !== window._chatId) { arr.splice(d, 1); break; }
      }
      histSave(arr);
    } catch (e2) {}
  }
  /* cap DOM 150 bubble biar HP kentang ga ngelag */
  try { if (typeof trimChat === 'function') trimChat(150); } catch (e) {}
}
function histRender() {
  var el = document.getElementById('hlist');
  var arr = histGet();
  if (!arr.length) { el.innerHTML = '<div class="h-empty">Belum Ada Riwayat Obrolan</div>'; return; }
  /* sort: pinned dulu */
  arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  var html = '';
  for (var i = 0; i < arr.length; i++) {
    var h = arr[i];
    var ago = histAgo(h.ts);
    var isActive = !window._done && busy && window._chatId === h.id;
    html += '<button class="h-item' + (isActive ? ' h-active' : '') + '" data-idx="' + i + '">' +
      '<div class="htxt"><span class="htitle">' + (h.pinned ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="#C9A227" stroke="#C9A227" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M8 3h8v5l-2 2v3l-2 8-2-8v-3L8 8z"/></svg> ' : '') + esc(h.title) + '</span>' +
      '<span class="hsub">' + ago + '</span></div>' +
      '<span class="hstream"></span>' +
      '<span class="hctx-btn" data-idx="' + i + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></span></button>';
  }
  el.innerHTML = html;
  el.querySelectorAll('.h-item').forEach(function(b) {
    b.onclick = function(e) {
      if (e.target.closest('.hctx-btn')) return;
      var idx = parseInt(b.getAttribute('data-idx'));
      var arr = histGet();
      arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
      if (!arr[idx]) return;
      closeDrawer();
      histRestore(arr[idx]);
    };
  });
  el.querySelectorAll('.hctx-btn').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      _hctxIdx = parseInt(btn.getAttribute('data-idx'));
      var arr = histGet();
      arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
      window._hctxEntry = arr[_hctxIdx];
      showHCtxMenu(btn, _hctxIdx);
    };
  });
}
function showHCtxMenu(btn, idx) {
  var menu = document.getElementById('hctx');
  var scrim = document.getElementById('hctx-scrim');
  var arr = histGet();
  arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  var entry = arr[idx];
  if (!entry) return;
  /* update pin button text */
  var pinBtn = document.getElementById('hctx-pin');
  pinBtn.innerHTML = entry.pinned ?
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="#C9A227" stroke="#C9A227" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v5l-2 2v3l-2 8-2-8v-3L8 8z"/><path d="M10 5.5h4" stroke="#0C100E"/></svg> Lepas Sematan' :
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v5l-2 2v3l-2 8-2-8v-3L8 8z"/><path d="M10 5.5h4"/></svg> Sematkan';
  /* position menu */
  var rect = btn.getBoundingClientRect();
  menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 160) + 'px';
  menu.style.right = '16px';
  menu.style.left = 'auto';
  menu.classList.add('show');
  scrim.classList.add('show');
}
function hideHCtxMenu() {
  document.getElementById('hctx').classList.remove('show');
  document.getElementById('hctx-scrim').classList.remove('show');
}
document.getElementById('hctx-scrim').onclick = hideHCtxMenu;
document.getElementById('hctx-pin').onclick = function() {
  var arr = histGet();
  arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  if (arr[_hctxIdx]) {
    arr[_hctxIdx].pinned = !arr[_hctxIdx].pinned;
    histSave(arr);
    histRender();
    toast(arr[_hctxIdx].pinned ? 'Disematkan' : 'Lepas Sematan');
  }
  hideHCtxMenu();
};
document.getElementById('hctx-rename').onclick = function() {
  hideHCtxMenu();
  var arr = histGet();
  arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  if (!arr[_hctxIdx]) return;
  document.getElementById('renameInput').value = arr[_hctxIdx].title;
  document.getElementById('mrename').classList.add('show');
};
document.getElementById('rnClose').onclick = function() { document.getElementById('mrename').classList.remove('show'); };
document.getElementById('rnSave').onclick = function() {
  var val = document.getElementById('renameInput').value.trim();
  if (!val) return;
  var arr = histGet();
  arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  if (arr[_hctxIdx]) {
    arr[_hctxIdx].title = val;
    histSave(arr);
    histRender();
    toast('Nama Diperbarui');
  }
  document.getElementById('mrename').classList.remove('show');
};
document.getElementById('hctx-delete').onclick = function() {
  hideHCtxMenu();
  var arr = histGet();
  arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  if (arr[_hctxIdx]) {
    var id = arr[_hctxIdx].id;
    arr.splice(_hctxIdx, 1);
    histSave(arr);
    /* jangan reset chat kalau yang dihapus bukan chat aktif */
    if (id === window._chatId) {
      /* tetap stay di chat aktif, cuma hapus dari riwayat */
    }
    histRender();
    toast('Riwayat Dihapus');
  }
};

function histRestore(entry) {
  /* stream AI milik chat ini / chat lain yg masih jalan: JANGAN cancel,
     biar tetep jalan di background. Cuma switch tampilan. */
  var liveHere = !!(busy && !window._done && window._streamChat && window._streamChat === entry.id);
  var liveElse = !!(busy && !window._done && window._streamChat && window._streamChat !== entry.id);
  if (busy && !liveHere && !liveElse) { window._aborted = true; window._canceling = true; Android.cancel(); }
  clearTimeout(window._cw);
  if (!liveHere && !liveElse) { window._done = true; window._aborted = true; window._canceling = true; }
  attHide();
  window._chatId = entry.id;
  window._langDetected = null;
  window._cur = null;
  if (!liveHere && !liveElse) { window._plain = ''; busy = false; }
  clearInterval(window._tm);
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'; go.classList.remove('stop');
  chat.innerHTML = entry.html;
  try {
    chat.classList.add('restoring');
    void chat.offsetWidth;
    setTimeout(function () { try { chat.classList.remove('restoring'); } catch (e) {} }, 900);
  } catch (e) {}
  /* balik ke chat yg stream-nya masih idup: sambung lagi, jangan strip.
     Chat lain / sudah mati: bekukan transient + pasang hasil bg + tawar kirim ulang. */
  if (liveHere) {
    try {
      var bodies = chat.querySelectorAll('.msg.ai .body');
      var lb = bodies.length ? bodies[bodies.length - 1] : null;
      if (lb) {
        window._cur = lb;
        if (lb.querySelector('.thinking-svg')) {
          lb.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
          lb.classList.add('plain');
        }
        if ((window._plain || '').length > (window._rend || '').length && typeof startTyper === 'function') startTyper();
      }
    } catch (e) {}
  } else {
  try {
    var hadStuck = !!chat.querySelector('.thinking-svg,.dots,.filewait,.imgskeleton,.elapsed');
    chat.querySelectorAll('.thinking-svg,.dots,.elapsed').forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    chat.querySelectorAll('.imgjob').forEach(function (job) {
      if (job.querySelector('.imgskeleton')) job.innerHTML = '<span style="color:#8AA396;font-style:italic">⏸ Gambar terhenti — pindah chat.</span>';
    });
    chat.querySelectorAll('.msg.ai').forEach(function (m) {
      var b = m.querySelector('.body');
      if (b && !b.textContent.trim() && !b.querySelector('img,.md,.fcard,.mact')) { if (m.parentNode) m.parentNode.removeChild(m); }
    });
    try {
      var fin = (window._bgFinished || {})[entry.id];
      if (fin && fin.trim()) {
        delete window._bgFinished[entry.id];
        var nb = addMsg('ai');
        nb.classList.remove('plain');
        nb.innerHTML = '<div class="md">' + mdRender(fin.trim()) + '</div>';
        addActions(nb, fin.trim());
      }
    } catch (e) {}
    if (hadStuck) {
      try { if (window._promptByChat && window._promptByChat[entry.id]) window._lastPrompt = window._promptByChat[entry.id]; } catch (e) {}
      addNote('⏸ Respons terhenti karena pindah chat.', true, true);
    }
  } catch (e) {}
  }
  window._aborted = false; /* regen Baru/HD di chat lama harus bisa jalan lagi */
  if (entry.model) setModel(entry.model);
  msgCount = chat.querySelectorAll('.msg.user').length;
  dot.className = (liveHere || liveElse) ? 'work' : 'ok';
  document.getElementById('hint').textContent = '';
  scrollEnd();
}
function histDelete(idx) {
  var arr = histGet();
  if (idx < 0 || idx >= arr.length) return;
  var doomed = arr[idx];
  /* hapus chat yg stream-nya idup: bunuh sekalian biar ga yatim */
  try {
    if (doomed && window._streamChat && window._streamChat === doomed.id) {
      try { Android.cancel(); } catch (e) {}
      busy = false; window._done = true; window._aborted = true;
      window._streamChat = null; window._cur = null;
      if (window._bgFinished) { try { delete window._bgFinished[doomed.id]; } catch (e) {} }
    }
  } catch (e) {}
  arr.splice(idx, 1);
  histSave(arr);
  histRender();
}
function histAgo(ts) {
  var d = Date.now() - ts;
  if (d < 60000) return 'Baru saja';
  if (d < 3600000) return Math.floor(d / 60000) + ' Menit Lalu';
  if (d < 86400000) return Math.floor(d / 3600000) + ' Jam Lalu';
  return Math.floor(d / 86400000) + ' Hari Lalu';
}

/* ===== newChat ===== */
function newChat() {
  /* stream lagi jalan: JANGAN cancel — biarin lanjut di background. */
  var liveSv = !!(busy && !window._done && window._streamChat);
  if (busy && !liveSv) { window._aborted = true; window._canceling = true; Android.cancel(); }
  clearTimeout(window._cw);
  histSaveCur();
  if (!liveSv) { window._done = true; window._aborted = true; window._canceling = true; }
  attHide();
  Android.newChat();
  window._langDetected = null;
  window._cur = null;
  if (!liveSv) { window._plain = ''; window._rend = ''; }
  busy = !!liveSv;
  msgCount = 0;
  window._chatId = 'c' + Date.now();
  clearInterval(window._tm);
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'; go.classList.remove('stop');
  chat.innerHTML = window._helloHTML;
  bindChips();
  dot.className = liveSv ? 'work' : 'ok';
  document.getElementById('hint').textContent = '';
  if (liveSv && typeof toast === 'function') toast('AI lanjut di background — balik via riwayat');
  scrollEnd();
}
document.getElementById('bnew').onclick = newChat;
document.getElementById('dnew').onclick = function() { closeDrawer(); newChat(); };
if (!window._chatId) window._chatId = 'c' + Date.now();

/* ===== streaming indicator for active chat (hemat: skip kalau drawer tutup) ===== */
setInterval(function() {
  try {
    var dr = document.getElementById('drawer');
    if (!dr || !dr.classList.contains('show')) return;
    if (!busy && !window._streamChat) return;
    var items = document.querySelectorAll('.h-item');
    if (!items.length) return;
    var arr = histGet();
    arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
    items.forEach(function(item) {
      var idx = parseInt(item.getAttribute('data-idx'));
      if ((arr[idx] && arr[idx].id === window._chatId && busy) ||
          (window._streamChat && arr[idx] && arr[idx].id === window._streamChat)) {
        item.classList.add('h-active');
      } else {
        item.classList.remove('h-active');
      }
    });
  } catch (e) {}
}, 2000);
