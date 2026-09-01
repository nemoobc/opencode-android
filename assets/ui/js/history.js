/* ===== history.js — riwayat obrolan ===== */
var HKEY = 'oc-hist';
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
  var entry = { id: window._chatId, title: title, ts: Date.now(), model: curModel, html: chat.innerHTML };
  if (idx >= 0) arr[idx] = entry; else arr.unshift(entry);
  if (arr.length > 30) arr = arr.slice(0, 30);
  histSave(arr);
}
function histRender() {
  var el = document.getElementById('hlist');
  var arr = histGet();
  if (!arr.length) { el.innerHTML = '<div class="h-empty">Belum Ada Riwayat Obrolan</div>'; return; }
  var html = '';
  for (var i = 0; i < arr.length; i++) {
    var h = arr[i];
    var ago = histAgo(h.ts);
    html += '<button class="h-item" data-idx="' + i + '">' +
      '<div class="htxt"><span class="htitle">' + esc(h.title) + '</span>' +
      '<span class="hsub">' + ago + '</span></div>' +
      '<span class="hdel" data-del="' + i + '"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>';
  }
  el.innerHTML = html;
  el.querySelectorAll('.h-item').forEach(function(b) {
    b.onclick = function(e) {
      if (e.target.closest('.hdel')) return;
      var idx = parseInt(b.getAttribute('data-idx'));
      var arr = histGet();
      if (!arr[idx]) return;
      closeDrawer();
      histRestore(arr[idx]);
    };
  });
  el.querySelectorAll('.hdel').forEach(function(d) {
    d.onclick = function(e) {
      e.stopPropagation();
      var idx = parseInt(d.getAttribute('data-del'));
      histDelete(idx);
    };
  });
}
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
  scrollEnd();
}
document.getElementById('bnew').onclick = newChat;
document.getElementById('dnew').onclick = function() { closeDrawer(); newChat(); };
if (!window._chatId) window._chatId = 'c' + Date.now();
