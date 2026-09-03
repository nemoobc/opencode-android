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
  var STEP = 98; /* 92px ubin + 6px gap */
  function cellXY(i) {
    return 'translate(' + ((i % N) * STEP) + 'px,' + (Math.floor(i / N) * STEP) + 'px)';
  }
  function render() {
    var b = document.getElementById('gbody');
    var board = document.getElementById('pzboard');
    if (!board) {
      b.innerHTML = '<div class="pzmeta"><span>⏱ <b id="pz-time">' + fmt(P.secs) + '</b></span><span>👆 <b id="pz-mv">' + P.moves + '</b> langkah</span></div>' +
        '<div class="pzboard" id="pzboard"></div>';
      board = document.getElementById('pzboard');
      P.nodes = {};
      for (var v = 1; v <= 8; v++) {
        (function(val) {
          var btn = document.createElement('button');
          btn.className = 'pztile';
          btn.textContent = val;
          btn.onclick = function() { tapByVal(val); };
          board.appendChild(btn);
          P.nodes[val] = btn;
        })(v);
      }
    }
    /* node persistent — cuma update transform, transisi CSS yang geser */
    for (var i = 0; i < 9; i++) {
      var vv = P.tiles[i];
      if (vv === 0) continue;
      var el = P.nodes[vv];
      el.style.transform = cellXY(i);
      el.dataset.i = i;
      if (vv === i + 1) el.classList.add('ok');
      else el.classList.remove('ok');
    }
    var mv = document.getElementById('pz-mv');
    if (mv) mv.textContent = P.moves;
  }
  function tapByVal(v) {
    if (!P) return;
    var el = P.nodes[v];
    var i = el ? parseInt(el.dataset.i, 10) : P.tiles.indexOf(v);
    tap(i);
  }
  function tap(i) {
    if (!P || P.lock || !canMove(P.tiles, i)) return;
    var h = P.tiles.indexOf(0);
    P.tiles[h] = P.tiles[i];
    P.tiles[i] = 0;
    P.moves++;
    setScore(P.moves + ' langkah');
    if (isSolved(P.tiles)) {
      render();
      P.lock = true;
      clearInterval(timer);
      /* gelombang glow baru panel menang */
      for (var v = 1; v <= 8; v++) {
        (function(val) {
          var el = P.nodes[val];
          if (el) {
            el.style.animationDelay = ((val - 1) * 0.06) + 's';
            el.classList.add('win');
          }
        })(v);
      }
      var id = gest;
      setTimeout(function() { if (id === gest) win(); }, 800);
      return;
    }
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
