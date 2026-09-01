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
  var entry = { id: window._chatId, title: title, ts: Date.now(), model: curModel, html: chat.innerHTML, pinned: false };
  if (idx >= 0) { entry.pinned = arr[idx].pinned || false; arr[idx] = entry; }
  else arr.unshift(entry);
  if (arr.length > 30) arr = arr.slice(0, 30);
  histSave(arr);
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
      '<div class="htxt"><span class="htitle">' + (h.pinned ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#C9A227" stroke-width="2" style="vertical-align:-1px"><path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z"/></svg> ' : '') + esc(h.title) + '</span>' +
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
      showHCtxMenu(e, _hctxIdx);
    };
  });
}
function showHCtxMenu(e, idx) {
  var menu = document.getElementById('hctx');
  var scrim = document.getElementById('hctx-scrim');
  var arr = histGet();
  arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
  var entry = arr[idx];
  if (!entry) return;
  /* update pin button text */
  var pinBtn = document.getElementById('hctx-pin');
  pinBtn.innerHTML = entry.pinned ?
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12l4 4 4-4"/><path d="M12 8v8"/></svg> Lepas Sematan' :
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg> Sematkan';
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
  if (busy) { window._aborted = true; window._canceling = true; Android.cancel(); }
  clearTimeout(window._cw);
  window._done = true; window._aborted = true; window._canceling = true;
  attHide();
  window._chatId = entry.id;
  window._langDetected = null;
  window._cur = null; window._plain = '';
  busy = false;
  clearInterval(window._tm);
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'; go.classList.remove('stop');
  chat.innerHTML = entry.html;
  if (entry.model) setModel(entry.model);
  msgCount = chat.querySelectorAll('.msg.user').length;
  dot.className = 'ok';
  document.getElementById('hint').textContent = '';
  scrollEnd();
}
function histDelete(idx) {
  var arr = histGet();
  if (idx < 0 || idx >= arr.length) return;
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
  if (busy) { window._aborted = true; window._canceling = true; Android.cancel(); }
  clearTimeout(window._cw);
  histSaveCur();
  window._done = true; window._aborted = true; window._canceling = true;
  attHide();
  Android.newChat();
  window._langDetected = null;
  window._cur = null; window._plain = '';
  busy = false;
  msgCount = 0;
  window._chatId = 'c' + Date.now();
  clearInterval(window._tm);
  go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'; go.classList.remove('stop');
  chat.innerHTML = window._helloHTML;
  bindChips();
  dot.className = 'ok';
  document.getElementById('hint').textContent = '';
  scrollEnd();
}
document.getElementById('bnew').onclick = newChat;
document.getElementById('dnew').onclick = function() { closeDrawer(); newChat(); };
if (!window._chatId) window._chatId = 'c' + Date.now();

/* ===== streaming indicator for active chat ===== */
setInterval(function() {
  var items = document.querySelectorAll('.h-item');
  items.forEach(function(item) {
    var idx = parseInt(item.getAttribute('data-idx'));
    var arr = histGet();
    arr.sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
    if (arr[idx] && arr[idx].id === window._chatId && busy) {
      item.classList.add('h-active');
    } else {
      item.classList.remove('h-active');
    }
  });
}, 2000);
