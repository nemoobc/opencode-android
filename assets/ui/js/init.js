/* ===== init.js — global vars, DOM refs, scroll ===== */
var chat = document.getElementById('chat');
/* sapaan sesuai waktu */
(function() {
  var h = new Date().getHours();
  var g = h < 4 ? 'Selamat malam' : (h < 11 ? 'Selamat pagi' : (h < 15 ? 'Selamat siang' : (h < 19 ? 'Selamat sore' : 'Selamat malam')));
  var hello = document.getElementById('hello');
  var e = document.createElement('p');
  e.id = 'greet';
  e.textContent = g + ' 👋';
  hello.insertBefore(e, hello.querySelector('h2'));
})();
window._helloHTML = document.getElementById('hello').outerHTML;
setTimeout(function() {
  fadeSplash();
}, 10000);
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

var userHold = false;
var msgCount = 0;
function follow() {
  if (userHold) return;
  if (wrap.scrollTo) { try { wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' }); } catch(e) { wrap.scrollTop = wrap.scrollHeight; } }
  else wrap.scrollTop = wrap.scrollHeight;
  requestAnimationFrame(function() { if (!userHold) wrap.scrollTop = wrap.scrollHeight; });
  setTimeout(function() { if (!userHold) wrap.scrollTop = wrap.scrollHeight; }, 250);
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
