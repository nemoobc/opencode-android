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
  var set = function(id, txt) {
    var e = document.getElementById(id);
    if (e) e.textContent = txt;
  };
  set('gb-snake', 'Terbaik: ' + gbestGet('g-snake-best', '0'));
  set('gb-quiz', 'Terbaik: ' + gbestGet('g-quiz-best', '0'));
  var pm = gbestGet('g-puz-best', '');
  set('gb-puzzle', pm ? 'Best: ' + pm + ' langkah' : 'Belum main');
  set('gb-ludo', 'Menang: ' + gbestGet('g-ludo-wins', '0'));
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
