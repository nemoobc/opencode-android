/* ===== games.js — shell menu Game ===== */
function gbestGet(k, def) {
  try {
    var v = localStorage.getItem(k);
    return v === null ? def : v;
  } catch (e) { return def; }
}
function gbestSet(k, v) {
  try { localStorage.setItem(k, String(v)); } catch (e) {}
}
function openGames() {
  if (typeof closeDrawer === 'function') closeDrawer();
  refreshGBest();
  showGMenu();
  document.getElementById('mgames').classList.add('show');
}
function closeGames() {
  window.Games.stop();
  document.getElementById('mgames').classList.remove('show');
}
function showGMenu() {
  window.Games.stop();
  document.getElementById('gmenu').style.display = '';
  document.getElementById('gstage').style.display = 'none';
}
function playGame(name, title) {
  window.Games.stop();
  document.getElementById('gmenu').style.display = 'none';
  document.getElementById('gstage').style.display = '';
  document.getElementById('gtitle').textContent = title;
  document.getElementById('gscore').textContent = '';
  document.getElementById('gbody').innerHTML = '';
  window.Games.play(name);
}
function refreshGBest() {
  var set = function(id, txt, has) {
    var e = document.getElementById(id);
    if (!e) return;
    e.textContent = txt;
    if (has) e.classList.add('has');
    else e.classList.remove('has');
  };
  var sn = parseInt(gbestGet('g-snake-best', '0'), 10) || 0;
  set('gb-snake', sn > 0 ? 'Terbaik: ' + sn : 'Belum main', sn > 0);
  var qz = parseInt(gbestGet('g-quiz-best', '0'), 10) || 0;
  set('gb-quiz', qz > 0 ? 'Terbaik: ' + qz : 'Belum main', qz > 0);
  var pm = gbestGet('g-puz-best', '');
  set('gb-puzzle', pm ? 'Best: ' + pm + ' langkah' : 'Belum main', !!pm);
  var lw = parseInt(gbestGet('g-ludo-wins', '0'), 10) || 0;
  set('gb-ludo', lw > 0 ? 'Menang: ' + lw : 'Belum menang', lw > 0);
  var tw = parseInt(gbestGet('g-tic-w', '0'), 10) || 0;
  set('gb-tic', tw > 0 ? 'Menang: ' + tw : 'Belum menang', tw > 0);
}
document.getElementById('dgame').onclick = openGames;
document.getElementById('gclose').onclick = closeGames;
document.getElementById('gback').onclick = showGMenu;
document.querySelectorAll('.gopt').forEach(function(b) {
  b.onclick = function() { playGame(b.getAttribute('data-g'), b.querySelector('.gname').textContent); };
});

/* registry — tiap file game daftar ke sini */
window.Games = window.Games || {
  _impl: {},
  reg: function(name, impl) { this._impl[name] = impl; },
  play: function(name) { if (this._impl[name]) this._impl[name].start(); },
  stop: function() {
    for (var k in this._impl) {
      try { if (this._impl[k].stop) this._impl[k].stop(); } catch (e) {}
    }
  }
};
