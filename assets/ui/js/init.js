/* ===== init.js — global vars, DOM refs, scroll ===== */
var chat = document.getElementById('chat');
/* sapaan sesuai waktu */
(function() {
  var h = new Date().getHours();
  var g = h < 1 ? 'Selamat dini hari' : (h < 4 ? 'Selamat larut' : (h < 11 ? 'Selamat pagi' : (h < 15 ? 'Selamat siang' : (h < 19 ? 'Selamat sore' : 'Selamat malam'))));
  var hello = document.getElementById('hello');
  var e = document.createElement('p');
  e.id = 'greet';
  e.textContent = g + ' 👋';
  hello.insertBefore(e, hello.querySelector('h2'));
})();
window._helloHTML = document.getElementById('hello').outerHTML;
/* splash handled by bridge.js — 6s logo animation then loading */
chat.innerHTML = window._helloHTML;
var wrap = document.getElementById('chatwrap');
var inp = document.getElementById('inp');
var go = document.getElementById('go');
var battach = document.getElementById('battach');
var dot = document.getElementById('dot');
var ov = document.getElementById('ov');
var busy = false;
var curModel = 'opencode/mimo-v2.5-free';
document.getElementById('mname').textContent = 'Mimo 2.5 Free';

/* ===== transition: splash → overlay =====
   Splash animation ~3s (drawStroke 1.6s + cursorPop 0.5s + fadeUp).
   Overlay tampil SAAT splash fade — jadi user lihat transisi halus.
   Progress updates dari Java langsung kelihatan di overlay. */
(function() {
  /* FLOW: logo 6 detik PENUH dulu (progress ekstrak jalan di splash),
     BARU overlay bersiap. Jangan tampilkan loading lain sebelum itu. */
  var SP_DUR = 6000;
  setTimeout(function() {
    /* overlay duluan (fade-in .5s berjalan di bawah splash yang masih ada) */
    if (ov && !window._pendingReady && !ov.classList.contains('show')) ov.classList.add('show');
  }, SP_DUR - 200);
  setTimeout(function() {
    var sp = document.getElementById('splash');
    if (sp && !sp.classList.contains('out')) {
      sp.classList.add('out');
      /* tampilkan overlay HANYA kalau server belum ready
         (_pendingReady = null berarti extraction/ server masih jalan) */
      if (ov && !window._pendingReady) ov.classList.add('show');
      setTimeout(function() {
        if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
        /* proses onReady yang tertunda */
        if (window._pendingReady) {
          var p = window._pendingReady;
          window._pendingReady = null;
          if (window._onReadyRaw) window._onReadyRaw(p.ok, p.free);
        }
      }, 700);
    }
  }, SP_DUR);
})();

/* pendingReady di-set oleh stream.js wrapper, di-proses di splash fade timeout di atas */

var userHold = false;
var msgCount = 0;
function follow() {
  if (userHold) return;
  /* throttle 200ms: typewriter manggil tiap 50ms, scroll smooth tiap tick = jank */
  var now = Date.now();
  if (window._followAt && now - window._followAt < 200) return;
  window._followAt = now;
  if (wrap.scrollTo) { try { wrap.scrollTo({ top: wrap.scrollHeight }); } catch(e) { wrap.scrollTop = wrap.scrollHeight; } }
  else wrap.scrollTop = wrap.scrollHeight;
}
function scrollEnd() { userHold = false; follow(); }
/* keyboard dismiss saat user scroll ke atas */
var _lastScrollTop = 0;
wrap.addEventListener('touchstart', function() { userHold = true; _lastScrollTop = wrap.scrollTop; }, { passive: true });
wrap.addEventListener('touchmove', function() {
  var st = wrap.scrollTop;
  if (st < _lastScrollTop - 30) {
    try { inp.blur(); } catch(e) {}
  }
  _lastScrollTop = st;
}, { passive: true });
wrap.addEventListener('touchend', function() {
  setTimeout(function() {
    userHold = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight > 150;
    var d = document.getElementById('down');
    if (userHold) d.classList.add('show'); else d.classList.remove('show');
  }, 60);
});
window.addEventListener('resize', function() {
  var d = document.getElementById('down');
  if (!d.classList.contains('show')) scrollEnd();
});
if (window.visualViewport) visualViewport.addEventListener('resize', function() {
  var d = document.getElementById('down');
  if (!d.classList.contains('show')) scrollEnd();
});
wrap = document.getElementById('chatwrap');
document.getElementById('chatwrap').addEventListener('scroll', function() {
  var d = document.getElementById('down');
  var far = this.scrollHeight - this.scrollTop - this.clientHeight > 300;
  if (far && !userHold) d.classList.add('show');
  else if (!far) d.classList.remove('show');
});
document.getElementById('down').onclick = function() { scrollEnd(); };
function killHello() { var h = document.getElementById('hello'); if (h) h.remove(); }
