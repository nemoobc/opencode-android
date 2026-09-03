/* ===== notif.js — pengumuman/update remote (notifications.json) ===== */
var Notif = (function() {
  var URL_ = 'https://raw.githubusercontent.com/nemoobc/opencode-android/main/notifications.json';
  var KEY = 'oc-notif-read';
  var CACHE = 'oc-notif-cache';

  function readIds() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function parseList(json) {
    try {
      var o = typeof json === 'string' ? JSON.parse(json) : json;
      if (o && o.announcements instanceof Array) return o.announcements;
    } catch (e) {}
    return [];
  }
  function unread(list) {
    var read = readIds(), out = 0;
    for (var i = 0; i < list.length; i++) {
      if (read.indexOf(list[i].id) < 0) out++;
    }
    return out;
  }
  function badge(n) {
    var d = document.getElementById('ndot');
    if (!d) return;
    if (n > 0) { d.textContent = n > 9 ? '9+' : String(n); d.classList.add('show'); }
    else d.classList.remove('show');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function render(list) {
    var box = document.getElementById('nlist');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="nempty">Belum ada pengumuman.</div>';
      return;
    }
    var h = '';
    for (var i = 0; i < list.length; i++) {
      var a = list[i] || {};
      h += '<div class="nitem"><div class="ntitle">' + esc(a.title || '(tanpa judul)') + '</div>' +
        '<div class="ndate">' + esc(a.date || '') + '</div>' +
        '<div class="nbody">' + esc(a.body || '') + '</div>' +
        (a.link ? '<a class="nlink" href="#" data-url="' + esc(a.link) + '">Buka tautan ›</a>' : '') +
        '</div>';
    }
    box.innerHTML = h;
  }
  function markRead(list) {
    try {
      var ids = readIds();
      for (var i = 0; i < list.length; i++) {
        if (ids.indexOf(list[i].id) < 0) ids.push(list[i].id);
      }
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch (e) {}
    badge(0);
  }
  function fetchAll(done) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', URL_ + '?t=' + Date.now(), true);
      xhr.timeout = 6000;
      xhr.onload = function() {
        if (xhr.status === 200) {
          var list = parseList(xhr.responseText);
          try { localStorage.setItem(CACHE, JSON.stringify(list)); } catch (e) {}
          done(list);
        } else done(cached());
      };
      xhr.onerror = function() { done(cached()); };
      xhr.ontimeout = function() { done(cached()); };
      xhr.send();
    } catch (e) { done(cached()); }
  }
  function cached() {
    try {
      var l = JSON.parse(localStorage.getItem(CACHE) || '[]');
      return l instanceof Array ? l : [];
    } catch (e) { return []; }
  }
  function init() {
    fetchAll(function(list) {
      window._notifList = list;
      badge(unread(list));
    });
  }
  function open() {
    var list = window._notifList || cached();
    render(list);
    document.getElementById('mnotif').classList.add('show');
    markRead(list);
  }
  return { init: init, open: open, parseList: parseList, unread: unread, URL: URL_ };
})();

function notifBind(id, fn) {
  try {
    var el = document.getElementById(id);
    if (el) el.onclick = fn;
  } catch (e) {}
}
notifBind('bnotif', function() { Notif.open(); });
notifBind('nclose', function() { document.getElementById('mnotif').classList.remove('show'); });
Notif.init();
