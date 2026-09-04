/* ===== dev.js — fitur developer TERSEMBUNYI (bukan public) =====
   Masuk: tap teks versi di drawer 5x cepat.
   Kunci: PIN.
   Remote notif: edit notifications.json di repo → push → app fetch saat buka. */

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
  function isMaint() {
    try {
      if (localStorage.getItem('oc-maint') !== '1') return false;
      var u = parseInt(localStorage.getItem('oc-maint-until') || '0', 10);
      if (u && Date.now() > u) {
        localStorage.setItem('oc-maint', '0');
        localStorage.removeItem('oc-maint-until');
        maintLog('auto-mati (timer)');
        return false;
      }
      return true;
    } catch (e) { return false; }
  }
  function maintMsg() {
    try { return localStorage.getItem('oc-maint-msg') || 'Lagi maintenance — balik lagi ya.'; } catch (e) { return 'Lagi maintenance — balik lagi ya.'; }
  }
  function maintScope() {
    try { return localStorage.getItem('oc-maint-scope') === 'teks' ? 'teks' : 'semua'; } catch (e) { return 'semua'; }
  }
  /* true = boleh kirim walau maint NYALA (dev bypass / scope teks + non-teks) */
  function maintAllow(t, imgPrev) {
    try {
      if (!isMaint()) return true;
      if (window._devOn) return true;
      if (maintScope() === 'teks') {
        if (imgPrev) return true;
        var s = String(t || '');
        if (typeof Media !== 'undefined' && Media) {
          if (Media.imgRequest && Media.imgRequest(s)) return true;
          if (Media.fileRequest && Media.fileRequest(s)) return true;
        }
        if (/^(main|buka|open|play)\s+(game\s+)?(tebak|kata|quiz|puzzle|ludo|tic|tac|tictac)\b/i.test(s.trim())) return true;
      }
    } catch (e) {}
    return !isMaint();
  }
  function maintLog(a) {
    try {
      var l = JSON.parse(localStorage.getItem('oc-maint-log') || '[]');
      l.unshift({ ts: Date.now(), a: String(a || '') });
      localStorage.setItem('oc-maint-log', JSON.stringify(l.slice(0, 20)));
    } catch (e) {}
  }
  function refreshMaintBtn() {
    try {
      var b = document.getElementById('dev-nmaint');
      if (b) b.textContent = 'Maintenance: ' + (isMaint() ? 'NYALA' : 'Mati');
      var inp = document.getElementById('dev-nmaintmsg');
      if (inp && !inp.value) inp.value = maintMsg();
      var sc = document.getElementById('dev-nscope');
      if (sc) sc.textContent = 'Scope: ' + (maintScope() === 'teks' ? 'teks aja' : 'semua');
      var lg = document.getElementById('dev-nmaintlog');
      if (lg) {
        var l = [];
        try { l = JSON.parse(localStorage.getItem('oc-maint-log') || '[]'); } catch (e) {}
        lg.textContent = l.length ? l.slice(0, 5).map(function (e) {
          var d = new Date(e.ts);
          var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
          return hh + ':' + mm + ' ' + e.a;
        }).join(' • ') : 'Belum ada log.';
      }
      var ban = document.getElementById('mban');
      if (ban) {
        if (isMaint()) {
          var u = 0;
          try { u = parseInt(localStorage.getItem('oc-maint-until') || '0', 10); } catch (e) {}
          var extra = '';
          if (u) { var mnt = Math.max(1, Math.round((u - Date.now()) / 60000)); extra = ' (sisa ~' + mnt + ' mnt)'; }
          ban.innerHTML = '🚧 <b>Maintenance</b> — ' + maintMsg().replace(/&/g, '&amp;').replace(/</g, '&lt;') + extra;
          ban.style.display = '';
        } else ban.style.display = 'none';
      }
    } catch (e) {}
  }
  function openPanel() {
    document.getElementById('dev-lock').style.display = 'none';
    var p = document.getElementById('dev-panel');
    p.style.display = '';
    var info = 'memuat...';
    try { info = (typeof Android !== 'undefined' && Android && Android.appInfo) ? Android.appInfo() : 'web'; } catch (e) {}
    document.getElementById('dev-info').textContent = info;
    refreshCount();
    refreshMaintBtn();
    refreshSec();
    devTab('notif');
    try {
      var d = document.getElementById('dev-ndate');
      if (d && !d.value && typeof Notif !== 'undefined' && Notif.today) d.value = Notif.today();
    } catch (e) {}
    try { renderDevList(); } catch (e) {}
    document.getElementById('mdev').classList.add('show');
  }
  function refreshCount() {
    try {
      var n = (window._notifList || []).length;
      document.getElementById('dev-notif').textContent = n + ' pengumuman termuat. Remote: edit notifications.json di repo → push → app fetch saat dibuka.';
    } catch (e) {}
  }
  function formEntry() {
    function v(id) {
      try { var el = document.getElementById(id); return el ? el.value : ''; } catch (e) { return ''; }
    }
    try { return Notif.makeEntry({ id: v('dev-nid'), date: v('dev-ndate'), title: v('dev-ntitle'), body: v('dev-nbody'), link: v('dev-nlink') }); }
    catch (e) { return { id: '', date: '', title: '', body: '', link: '' }; }
  }
  function persistList(list) {
    try { window._notifList = list; } catch (e) {}
    try { localStorage.setItem('oc-notif-cache', JSON.stringify(list)); } catch (e) {}
    try {
      var n = list.length;
      document.getElementById('dev-notif').textContent = n + ' pengumuman termuat. Remote: edit notifications.json di repo → push → app fetch saat dibuka.';
    } catch (e) {}
  }
  function escH(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderDevList() {
    var box;
    try { box = document.getElementById('dev-nlist'); } catch (e) { return; }
    if (!box) return;
    var list = [];
    try { list = window._notifList || []; } catch (e) {}
    if (!list.length) { box.textContent = 'Belum ada.'; return; }
    var h = '';
    for (var i = 0; i < list.length; i++) {
      var a = list[i] || {};
      h += '<div class="dev-nrow" style="display:flex;gap:6px;align-items:center;margin:3px 0">' +
        '<span style="flex:1">• ' + escH(a.id || '?') + ' — ' + escH(String(a.title || '').slice(0, 50)) + '</span>' +
        '<button class="bb ghost" data-nedit="' + i + '">Edit</button>' +
        '<button class="bb ghost" data-ndel="' + i + '">Hapus</button></div>';
    }
    box.innerHTML = h;
    try {
      var es = box.querySelectorAll('[data-nedit]');
      for (var k = 0; k < es.length; k++) (function (btn) {
        btn.onclick = function () {
          var idx = parseInt(btn.getAttribute('data-nedit'), 10);
          var arr = [];
          try { arr = window._notifList || []; } catch (e) {}
          var e2 = arr[idx];
          if (!e2) return;
          function set(id, val) { try { var el = document.getElementById(id); if (el) el.value = val || ''; } catch (ex) {} }
          set('dev-nid', e2.id); set('dev-ndate', e2.date); set('dev-ntitle', e2.title); set('dev-nbody', e2.body); set('dev-nlink', e2.link);
          try { document.getElementById('dev-nmsg').textContent = 'Dimuat ke form: ' + (e2.id || ''); } catch (ex) {}
        };
      })(es[k]);
      var ds = box.querySelectorAll('[data-ndel]');
      for (var j = 0; j < ds.length; j++) (function (btn) {
        btn.onclick = function () {
          var idx = parseInt(btn.getAttribute('data-ndel'), 10);
          var arr = [];
          try { arr = window._notifList || []; } catch (e) {}
          if (!arr[idx]) return;
          var gone = arr.splice(idx, 1)[0] || {};
          persistList(arr);
          renderDevList();
          try { document.getElementById('dev-nmsg').textContent = 'Dihapus lokal: ' + (gone.id || ''); } catch (e) {}
          if (typeof toast === 'function') toast('Dihapus lokal (perlu push buat remote)');
        };
      })(ds[j]);
    } catch (e) {}
  }
  /* PIN disamarkan (bukan plaintext) + brute-force dikunci.
     Jujur: obfuscation lawan intip kasual, bukan anti-forensik. */
  function obPin(pin) {
    try {
      var s = String(pin).split('').reverse().join('') + '#' + String(pin).length;
      return 'h1.' + btoa(unescape(encodeURIComponent(s)));
    } catch (e) { return 'h1.' + String(pin); }
  }
  function deobPin(stored) {
    try {
      if (!stored) return '112233';
      if (String(stored).indexOf('h1.') !== 0) return String(stored); /* legacy plaintext */
      var s = decodeURIComponent(escape(atob(String(stored).slice(3))));
      var parts = s.split('#');
      var rev = parts.slice(0, -1).join('#');
      return rev.split('').reverse().join('');
    } catch (e) { return '112233'; }
  }
  function devPin() {
    try { return deobPin(localStorage.getItem('oc-dev-pin')) || '112233'; } catch (e) { return '112233'; }
  }
  function lockInfo() {
    try {
      var o = JSON.parse(localStorage.getItem('oc-dev-fails') || '{"n":0,"ts":0}');
      if (o.n >= 5 && Date.now() - o.ts < 5 * 60000) return Math.ceil((5 * 60000 - (Date.now() - o.ts)) / 1000);
      return 0;
    } catch (e) { return 0; }
  }
  function lockBump() {
    try {
      var o = JSON.parse(localStorage.getItem('oc-dev-fails') || '{"n":0,"ts":0}');
      if (Date.now() - o.ts > 5 * 60000) o = { n: 0, ts: 0 };
      o.n++; o.ts = Date.now();
      localStorage.setItem('oc-dev-fails', JSON.stringify(o));
    } catch (e) {}
  }
  function lockClear() {
    try { localStorage.removeItem('oc-dev-fails'); } catch (e) {}
  }
  function unlock(pin) {
    var msg = document.getElementById('dev-msg');
    var wait = lockInfo();
    if (wait > 0) {
      if (msg) msg.textContent = 'Terkunci ' + wait + ' dtk (5x salah).';
      return false;
    }
    if (String(pin || '').trim() === devPin()) {
      lockClear();
      window._devOn = true;
      var inp = document.getElementById('dev-pin');
      if (inp) inp.value = '';
      if (msg) msg.textContent = '';
      /* migrasi legacy plaintext -> samaran */
      try {
        var cur = localStorage.getItem('oc-dev-pin');
        if (cur && cur.indexOf('h1.') !== 0) localStorage.setItem('oc-dev-pin', obPin(cur));
      } catch (e) {}
      openPanel();
      return true;
    }
    lockBump();
    if (msg) msg.textContent = lockInfo() > 0 ? 'Terkunci 300 dtk (5x salah).' : 'PIN salah.';
    return false;
  }
  function close() {
    /* default KUNCI (rapet): cuma bertahan kalau user matikan eksplisit. */
    try { if (localStorage.getItem('oc-dev-autolock') !== '0') window._devOn = false; } catch (e) { window._devOn = false; }
    document.getElementById('mdev').classList.remove('show');
  }
  function devTab(which) {
    try {
      var panes = { notif: 'dev-pane-notif', maint: 'dev-pane-maint', sec: 'dev-pane-sec' };
      var tabs = { notif: 'dev-tab-notif', maint: 'dev-tab-maint', sec: 'dev-tab-sec' };
      for (var k in panes) {
        var p = document.getElementById(panes[k]);
        if (p) p.style.display = (k === which) ? '' : 'none';
        var t = document.getElementById(tabs[k]);
        if (t) { if (k === which) t.classList.add('on'); else t.classList.remove('on'); }
      }
    } catch (e) {}
  }
  function refreshSec() {
    try {
      var b = document.getElementById('dev-nautolock');
      if (b) b.textContent = 'Kunci otomatis: ' + ((function () { try { return localStorage.getItem('oc-dev-autolock') !== '0'; } catch (e) { return true; } })() ? 'NYALA' : 'Mati');
      var s = document.getElementById('dev-nsec');
      if (s) {
        var plat = 'web';
        try { plat = (typeof Android !== 'undefined' && Android && Android.appInfo) ? String(Android.appInfo()) : 'web'; } catch (e) {}
        var dk = (typeof window.DEVKEY === 'string' && window.DEVKEY) ? 'ada' : 'ga ada (web wajar)';
        s.textContent = 'Platform: ' + plat + ' • DEVKEY build: ' + dk + ' • PIN: ' + (devPin() === '112233' ? 'default' : 'custom');
      }
    } catch (e) {}
  }
  return { armTap: armTap, unlock: unlock, openPanel: openPanel, close: close, isMaint: isMaint, maintMsg: maintMsg, maintAllow: maintAllow, refreshMaintBtn: refreshMaintBtn, refreshSec: refreshSec, maintLog: maintLog, devTab: devTab, obPin: obPin };
})();

function bindBtn(id, fn) {
  try {
    var el = document.getElementById(id);
    if (el) el.onclick = fn;
  } catch (e) {}
}
try {
  var dv = document.getElementById('dver');
  if (dv) dv.addEventListener('click', function() { Dev.armTap(); });
} catch (e) {}
bindBtn('dev-go', function() {
  var inp = document.getElementById('dev-pin');
  Dev.unlock(inp ? inp.value : '');
});
bindBtn('dev-close', function() { Dev.close(); });
bindBtn('dev-close2', function() { Dev.close(); });
bindBtn('dev-tab-notif', function() { try { Dev.devTab('notif'); } catch (e) {} });
bindBtn('dev-tab-maint', function() { try { Dev.devTab('maint'); } catch (e) {} });
bindBtn('dev-tab-sec', function() { try { Dev.devTab('sec'); } catch (e) {} });
bindBtn('dev-refresh', function() {
  Notif.init();
  setTimeout(function() {
    try {
      document.getElementById('dev-notif').textContent = (window._notifList || []).length + ' pengumuman termuat.';
    } catch (e) {}
    try {
      var box = document.getElementById('dev-nlist');
      if (box) {
        var h = '';
        var arr = [];
        try { arr = window._notifList || []; } catch (ex) { arr = []; }
        for (var i = 0; i < arr.length; i++) {
          var a = arr[i] || {};
          h += '<div class="dev-nrow" style="display:flex;gap:6px;align-items:center;margin:3px 0">' +
            '<span style="flex:1">• ' + String(a.id || '?') + ' — ' + String((a.title || '').slice ? a.title.slice(0, 50) : a.title) + '</span>' +
            '<button class="bb ghost" data-nedit="' + i + '">Edit</button>' +
            '<button class="bb ghost" data-ndel="' + i + '">Hapus</button></div>';
        }
        box.innerHTML = h || 'Belum ada.';
      }
    } catch (e) {}
  }, 2500);
  if (typeof toast === 'function') toast('Refresh notifikasi...');
});
bindBtn('dev-nreset', function() {
  try { localStorage.removeItem('oc-notif-read'); } catch (e) {}
  try { Notif.init(); } catch (e) {}
  try { document.getElementById('dev-nmsg').textContent = 'Badge di-reset — lonceng nyala lagi'; } catch (e) {}
  if (typeof toast === 'function') toast('Badge di-reset');
});
bindBtn('dev-nclear', function() {
  try { window._notifList = []; } catch (e) {}
  try { localStorage.setItem('oc-notif-cache', '[]'); } catch (e) {}
  try {
    document.getElementById('dev-notif').textContent = '0 pengumuman termuat.';
    document.getElementById('dev-nlist').textContent = 'Belum ada.';
    document.getElementById('dev-nmsg').textContent = 'Lokal dikosongkan (remote berubah pas push)';
  } catch (e) {}
  if (typeof toast === 'function') toast('Lokal dikosongkan');
});
bindBtn('dev-nmaint', function() {
  var on = false;
  try {
    on = localStorage.getItem('oc-maint') !== '1';
    localStorage.setItem('oc-maint', on ? '1' : '0');
    var inp = document.getElementById('dev-nmaintmsg');
    if (inp && inp.value.trim()) localStorage.setItem('oc-maint-msg', inp.value.trim());
    var dur = 0;
    try { var di = document.getElementById('dev-nmaindur'); dur = parseInt((di && di.value) || '0', 10) || 0; } catch (e) {}
    if (on && dur > 0) localStorage.setItem('oc-maint-until', String(Date.now() + dur * 60000));
    else localStorage.removeItem('oc-maint-until');
    Dev.maintLog(on ? ('NYALA' + (dur > 0 ? ' ' + dur + 'mnt' : '')) : 'mati');
  } catch (e) {}
  try { Dev.refreshMaintBtn(); } catch (e) {}
  if (typeof toast === 'function') toast(on ? 'Maintenance NYALA' : 'Maintenance mati');
});
bindBtn('dev-nscope', function() {
  try {
    var cur = localStorage.getItem('oc-maint-scope') === 'teks' ? 'semua' : 'teks';
    localStorage.setItem('oc-maint-scope', cur);
    Dev.maintLog('scope ' + cur);
  } catch (e) {}
  try { Dev.refreshMaintBtn(); } catch (e) {}
});
bindBtn('dev-nannounce', function() {
  try {
    var m = maintMsg();
    var t = document.getElementById('dev-ntitle'); if (t) t.value = 'Maintenance';
    var b = document.getElementById('dev-nbody'); if (b) b.value = m;
    var d = document.getElementById('dev-ndate'); if (d && window.Notif && Notif.today) d.value = Notif.today();
    devTab('notif');
    devMsg('Form notif terisi — Preview > Tes/Salin/Unduh > push');
  } catch (e) {}
});
function devMsg(t) {
  try { document.getElementById('dev-nmsg').textContent = t; } catch (e) {}
  if (typeof toast === 'function' && t) toast(t);
}
bindBtn('dev-nprev', function() {
  var e = null;
  try { e = Notif.makeEntry({ id: document.getElementById('dev-nid').value, date: document.getElementById('dev-ndate').value, title: document.getElementById('dev-ntitle').value, body: document.getElementById('dev-nbody').value, link: document.getElementById('dev-nlink').value }); } catch (err) { devMsg('Form ga kebaca'); return; }
  var err = Notif.validateEntry(e);
  if (err) { devMsg(err); return; }
  try {
    var box = document.getElementById('dev-nprevbox');
    if (box) {
      var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
      box.innerHTML = '<div class="nitem"><div class="ntitle">' + esc(e.title) + '</div><div class="ndate">' + esc(e.date) + '</div><div class="nbody">' + esc(e.body) + '</div>' + (e.link ? '<div class="ndate">' + esc(e.link) + '</div>' : '') + '</div>';
    }
  } catch (ex) {}
  devMsg('Preview ok: ' + e.id);
});
bindBtn('dev-ntest', function() {
  var e = null;
  try { e = Notif.makeEntry({ id: document.getElementById('dev-nid').value, date: document.getElementById('dev-ndate').value, title: document.getElementById('dev-ntitle').value, body: document.getElementById('dev-nbody').value, link: document.getElementById('dev-nlink').value }); } catch (err) { devMsg('Form ga kebaca'); return; }
  var err = Notif.validateEntry(e);
  if (err) { devMsg(err); return; }
  Notif.testLocal(e);
  try { document.getElementById('dev-notif').textContent = (window._notifList || []).length + ' pengumuman termuat.'; } catch (ex) {}
  devMsg('Masuk lokal: ' + e.id + ' (belum remote, perlu push)');
});
bindBtn('dev-ncopy', function() {
  var list = [];
  try { list = window._notifList || []; } catch (e) {}
  var s = Notif.buildFile(list);
  function done() { devMsg('JSON tersalin (' + list.length + ') — paste ke notifications.json lalu push'); }
  try {
    if (typeof Android !== 'undefined' && Android && Android.copyText) { Android.copyText(s); done(); }
    else if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(s).then(done, function () { devMsg('Gagal salin'); }); }
    else devMsg('Clipboard ga didukung');
  } catch (e) { devMsg('Gagal salin'); }
});
bindBtn('dev-ndl', function() {
  var list = [];
  try { list = window._notifList || []; } catch (e) {}
  try {
    var blob = new Blob([Notif.buildFile(list)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'notifications.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} a.remove(); }, 800);
    devMsg('Unduh mulai (' + list.length + ')');
  } catch (e) { devMsg('Gagal unduh'); }
});
/* ===== keamanan: ganti PIN + kunci otomatis + panduan rotasi key ===== */
bindBtn('dev-npinsave', function() {
  var v = '';
  try { v = String(document.getElementById('dev-npin2').value || '').trim(); } catch (e) {}
  if (v.length < 4 || v.length > 32) { devMsg('PIN 4-32 karakter'); return; }
  try { localStorage.setItem('oc-dev-pin', Dev.obPin(v)); } catch (e) { devMsg('Gagal simpan'); return; }
  try { document.getElementById('dev-npin2').value = ''; } catch (e) {}
  try { Dev.refreshSec(); } catch (e) {}
  devMsg('PIN diganti (tersimpan lokal HP ini)');
});
bindBtn('dev-npinreset', function() {
  try { localStorage.removeItem('oc-dev-pin'); } catch (e) {}
  try { Dev.refreshSec(); } catch (e) {}
  devMsg('PIN balik default 112233');
});
bindBtn('dev-nautolock', function() {
  var on = false;
  try {
    on = localStorage.getItem('oc-dev-autolock') !== '1';
    localStorage.setItem('oc-dev-autolock', on ? '1' : '0');
  } catch (e) {}
  try { Dev.refreshSec(); } catch (e) {}
  if (typeof toast === 'function') toast(on ? 'Kunci otomatis NYALA' : 'Kunci otomatis mati');
});
bindBtn('dev-nkeyguide', function() {
  var s = 'ROTASI license.key/keystore (di mesin build, BUKAN di HP):\n' +
    '1. bash rotate-keys.sh\n2. bash build.sh\n3. HP: uninstall app lama sekali (data hilang, backup dulu)\n4. Install APK baru. Update berikut TIMPA biasa.';
  try {
    if (typeof Android !== 'undefined' && Android && Android.copyText) { Android.copyText(s); devMsg('Panduan tersalin'); }
    else if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(s).then(function () { devMsg('Panduan tersalin'); }, function () { devMsg('Gagal salin'); }); }
    else devMsg('Clipboard ga didukung');
  } catch (e) { devMsg('Gagal salin'); }
});
/* saat app dibuka: timer kedaluwarsa -> auto-mati + cat banner */
try {
  if (typeof Dev !== 'undefined' && Dev && typeof Dev.isMaint === 'function') {
    Dev.isMaint();
    Dev.refreshMaintBtn();
  }
} catch (e) {}
