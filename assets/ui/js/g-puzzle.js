/* ===== g-puzzle.js — puzzle geser 3x3 ===== */
(function() {
  var N = 3;
  var timer = null, gest = 0;
  var P = null; /* {tiles:[..9], moves, secs} */

  function solved() { return [1, 2, 3, 4, 5, 6, 7, 8, 0]; }
  function isSolved(t) {
    for (var i = 0; i < 8; i++) if (t[i] !== i + 1) return false;
    return t[8] === 0;
  }
  /* index ubin yg boleh geser ke lubang — testable */
  function canMove(t, i) {
    var h = t.indexOf(0);
    var hr = Math.floor(h / N), hc = h % N;
    var r = Math.floor(i / N), c = i % N;
    return Math.abs(hr - r) + Math.abs(hc - c) === 1;
  }
  function shuffle() {
    var t = solved();
    for (var k = 0; k < 200; k++) {
      var h = t.indexOf(0);
      var opts = [];
      for (var i = 0; i < 9; i++) if (canMove(t, i)) opts.push(i);
      var pick = opts[Math.floor(Math.random() * opts.length)];
      t[h] = t[pick]; t[pick] = 0;
    }
    if (isSolved(t)) return shuffle();
    return t;
  }
  function start() {
    stop();
    var id = ++gest;
    P = { tiles: shuffle(), moves: 0, secs: 0 };
    render();
    setScore('0 langkah');
    clearInterval(timer);
    timer = setInterval(function() {
      if (id !== gest || !P) return;
      P.secs++;
      var e = document.getElementById('pz-time');
      if (e) e.textContent = fmt(P.secs);
    }, 1000);
  }
  function fmt(s) {
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (r < 10 ? '0' + r : r);
  }
  function setScore(t) {
    var e = document.getElementById('gscore');
    if (e) e.textContent = t;
  }
  function render() {
    var b = document.getElementById('gbody');
    var html = '<div class="pzmeta"><span>⏱ <b id="pz-time">' + fmt(P.secs) + '</b></span><span>👆 <b id="pz-mv">' + P.moves + '</b> langkah</span></div><div class="pzgrid">';
    for (var i = 0; i < 9; i++) {
      var v = P.tiles[i];
      if (v === 0) html += '<button class="pztile hole" data-i="' + i + '"></button>';
      else html += '<button class="pztile' + (v === i + 1 ? ' ok' : '') + '" data-i="' + i + '">' + v + '</button>';
    }
    b.innerHTML = html + '</div>';
    b.querySelectorAll('.pztile').forEach(function(btn) {
      btn.onclick = function() { tap(parseInt(btn.getAttribute('data-i'), 10)); };
    });
  }
  function tap(i) {
    if (!P || !canMove(P.tiles, i)) return;
    var h = P.tiles.indexOf(0);
    P.tiles[h] = P.tiles[i];
    P.tiles[i] = 0;
    P.moves++;
    setScore(P.moves + ' langkah');
    if (isSolved(P.tiles)) return win();
    render();
  }
  function win() {
    clearInterval(timer);
    var prev = parseInt(gbestGet('g-puz-best', '0'), 10) || 0;
    var isBest = !prev || P.moves < prev;
    if (isBest) gbestSet('g-puz-best', P.moves);
    var info = P.moves + ' langkah • ' + fmt(P.secs);
    P = null;
    var b = document.getElementById('gbody');
    b.innerHTML = '<div class="gpanel"><div class="big">🎉 Selesai!</div>' +
      '<div class="sub2"><b>' + info + '</b>' + (isBest ? ' — <b>Rekor baru!</b>' : '') + '</div>' +
      '<button class="gbtn" id="pz-again">Acak Lagi</button></div>';
    document.getElementById('pz-again').onclick = function() { start(); };
  }
  function stop() {
    gest++;
    if (timer) { clearInterval(timer); timer = null; }
    P = null;
  }
  window.Games.reg('puzzle', { start: start, stop: stop });
  window.Games.PUZZLE = { solved: solved, isSolved: isSolved, canMove: canMove };
})();
