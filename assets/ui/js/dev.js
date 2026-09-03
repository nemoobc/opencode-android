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
  function unlock(pin) {
    var msg = document.getElementById('dev-msg');
    if (String(pin || '').trim() === '112233') {
      window._devOn = true;
      var inp = document.getElementById('dev-pin');
      if (inp) inp.value = '';
      if (msg) msg.textContent = '';
      openPanel();
      return true;
    }
    if (msg) msg.textContent = 'PIN salah.';
    return false;
  }
  function close() {
    document.getElementById('mdev').classList.remove('show');
  }
  return { armTap: armTap, unlock: unlock, openPanel: openPanel, close: close };
})();

document.getElementById('dver').addEventListener('click', function() { Dev.armTap(); });
document.getElementById('dev-go').onclick = function() {
  var inp = document.getElementById('dev-pin');
  Dev.unlock(inp ? inp.value : '');
};
document.getElementById('dev-close').onclick = function() { Dev.close(); };
document.getElementById('dev-close2').onclick = function() { Dev.close(); };
document.getElementById('dev-refresh').onclick = function() {
  Notif.init();
  setTimeout(function() {
    document.getElementById('dev-notif').textContent = (window._notifList || []).length + ' pengumuman termuat.';
  }, 2500);
  if (typeof toast === 'function') toast('Refresh notifikasi...');
};
