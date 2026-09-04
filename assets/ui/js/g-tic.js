/* ===== g-tic.js — tic-tac-toe: kamu (X) vs CPU (O) ===== */
(function() {
  var timers = [], gest = 0;
  var T = null; /* {b:[9], over, turn, starter} */
  var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  /* return {p:'X'|'O', line:[..]} atau 'D' seri atau null jalan */
  function winner(b) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i];
      if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { p: b[l[0]], line: l };
    }
    for (var j = 0; j < 9; j++) if (!b[j]) return null;
    return 'D';
  }
  function empties(b) {
    var o = [];
    for (var i = 0; i < 9; i++) if (!b[i]) o.push(i);
    return o;
  }
  /* CPU O: menang > cegah > tengah > sudut > acak — testable */
  function cpuMove(b) {
    var e = empties(b), i, t;
    for (i = 0; i < e.length; i++) { t = b.slice(); t[e[i]] = 'O'; if (winner(t) && winner(t).p === 'O') return e[i]; }
    for (i = 0; i < e.length; i++) { t = b.slice(); t[e[i]] = 'X'; if (winner(t) && winner(t).p === 'X') return e[i]; }
    if (!b[4]) return 4;
    var corners = [0, 2, 6, 8].filter(function(c) { return !b[c]; });
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return e[Math.floor(Math.random() * e.length)];
  }
  function later(fn, ms, id) {
    var t = setTimeout(function() { if (id === gest) fn(); }, ms);
    timers.push(t);
  }
  function markSVG(v) {
    if (v === 'X') return '<svg viewBox="0 0 48 48" fill="none" stroke="#3DDC84" stroke-width="5" stroke-linecap="round"><path class="dx" d="M12 12l24 24"/><path class="dx dx2" d="M36 12L12 36"/></svg>';
    if (v === 'O') return '<svg viewBox="0 0 48 48" fill="none" stroke="#6EC6FF" stroke-width="5" stroke-linecap="round"><circle class="oc" cx="24" cy="24" r="15"/></svg>';
    return '';
  }
  function strikeSVG(line) {
    var pts = [[14, 46, 278, 46], [14, 146, 278, 146], [14, 246, 278, 246],
      [46, 14, 46, 278], [146, 14, 146, 278], [246, 14, 246, 278],
      [20, 20, 272, 272], [272, 20, 20, 272]];
    var idx = 0;
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i];
      if (l[0] === line[0] && l[1] === line[1] && l[2] === line[2]) { idx = i; break; }
    }
    var p = pts[idx];
    return '<svg class="tstrike" viewBox="0 0 292 292"><defs><linearGradient id="tgd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3DDC84"/><stop offset="1" stop-color="#6EC6FF"/></linearGradient></defs>' +
      '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[2] + '" y2="' + p[3] + '"/></svg>';
  }
  function setScore(t) {
    var e = document.getElementById('gscore');
    if (e) e.textContent = t;
  }
  function start() {
    stop();
    var id = ++gest;
    var starter = gbestGet('g-tic-starter', 'X');
    T = { b: ['','','','','','','','',''], over: false, starter: starter };
    gbestSet('g-tic-starter', starter === 'X' ? 'O' : 'X');
    var b = document.getElementById('gbody');
    var h = '<div class="tstatus" id="tstatus"></div><div class="tgrid" id="tgrid">';
    for (var i = 0; i < 9; i++) h += '<button class="tcell" data-i="' + i + '"></button>';
    b.innerHTML = h + '</div>';
    b.querySelectorAll('.tcell').forEach(function(btn) {
      btn.onclick = function() { tap(parseInt(btn.getAttribute('data-i'), 10), id); };
    });
    paint(null);
    if (starter === 'O') {
      status('CPU mulai...', 0);
      lockBoard(true);
      later(function() { cpu(id); }, 700, id);
    } else {
      status('Giliranmu (X)', 0);
    }
  }
  function status(t) {
    var e = document.getElementById('tstatus');
    if (!e) return;
    e.textContent = t;
    e.classList.remove('pop');
    void e.offsetWidth;
    e.classList.add('pop');
  }
  function lockBoard(v) {
    var b = document.getElementById('gbody');
    if (!b) return;
    var btns = b.querySelectorAll('.tcell');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = v;
  }
  function paint(winLine) {
    var b = document.getElementById('gbody');
    if (!b || !T) return;
    var grid = document.getElementById('tgrid');
    var btns = b.querySelectorAll('.tcell');
    for (var i = 0; i < 9; i++) {
      var v = T.b[i];
      btns[i].innerHTML = markSVG(v);
      btns[i].classList.toggle('x', v === 'X');
      btns[i].classList.toggle('o', v === 'O');
      if (winLine && winLine.indexOf(i) >= 0) btns[i].classList.add('win');
    }
    var old = grid ? grid.querySelector('.tstrike') : null;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (winLine && grid) {
      var tmp = document.createElement('div');
      tmp.innerHTML = strikeSVG(winLine);
      grid.appendChild(tmp.firstChild);
    }
    var w = parseInt(gbestGet('g-tic-w', '0'), 10) || 0;
    var d = parseInt(gbestGet('g-tic-d', '0'), 10) || 0;
    var l = parseInt(gbestGet('g-tic-l', '0'), 10) || 0;
    setScore('Menang ' + w + ' • Seri ' + d + ' • Kalah ' + l);
  }
  /* langkah menentukan? (langsung menang / cegah kalah) — buat delay adaptif */
  function decisive(b, i, p) {
    var t = b.slice();
    t[i] = p;
    var r = winner(t);
    return !!(r && r !== 'D' && r.p === p);
  }
  function xThreat(b) {
    for (var k = 0; k < 9; k++) {
      if (!b[k] && decisive(b, k, 'X')) return true;
    }
    return false;
  }
  function tap(i, id) {
    if (id !== gest || !T || T.over || T.b[i]) return;
    T.b[i] = 'X';
    paint(null);
    var r = winner(T.b);
    if (r) return end(id, r);
    lockBoard(true);
    status('CPU mikir...', 0);
    var mv = cpuMove(T.b);
    /* cepat kalau langkah jelas (menang/cegah/papan sempit), lambat kalau mikir */
    var fast = decisive(T.b, mv, 'O') || xThreat(T.b) || empties(T.b).length <= 3;
    later(function() { cpu(id, mv); }, fast ? 350 : 700, id);
  }
  function cpu(id, mv) {
    if (id !== gest || !T || T.over) return;
    T.b[(mv === undefined ? cpuMove(T.b) : mv)] = 'O';
    paint(null);
    var r = winner(T.b);
    if (r) return end(id, r);
    lockBoard(false);
    status('Giliranmu (X)', 0);
  }
  function end(id, r) {
    if (id !== gest || !T) return;
    T.over = true;
    lockBoard(true);
    if (r === 'D') {
      var d = (parseInt(gbestGet('g-tic-d', '0'), 10) || 0) + 1;
      gbestSet('g-tic-d', d);
      status('Seri!', 0);
      paint(null);
      var b2 = document.getElementById('gbody');
      if (b2) {
        var cells = b2.querySelectorAll('.tcell');
        for (var c = 0; c < cells.length; c++) cells[c].classList.add('tie');
      }
    } else {
      paint(r.line);
      if (r.p === 'X') {
        var w = (parseInt(gbestGet('g-tic-w', '0'), 10) || 0) + 1;
        gbestSet('g-tic-w', w);
        status('Kamu menang!', 0);
      } else {
        var l = (parseInt(gbestGet('g-tic-l', '0'), 10) || 0) + 1;
        gbestSet('g-tic-l', l);
        status('CPU menang!', 0);
      }
    }
    var b = document.getElementById('gbody');
    var div = document.createElement('div');
    div.innerHTML = '<button class="gbtn ghost2" id="tic-menu">‹ Menu</button> <button class="gbtn" id="tic-again" style="margin-top:6px">Main Lagi</button>';
    b.appendChild(div);
    document.getElementById('tic-again').onclick = function() { start(); };
    document.getElementById('tic-menu').onclick = function() { showGMenu(); };
  }
  function stop() {
    gest++;
    for (var i = 0; i < timers.length; i++) {
      try { clearTimeout(timers[i]); clearInterval(timers[i]); } catch (e) {}
    }
    timers = [];
    T = null;
  }
  window.Games.reg('tic', { start: start, stop: stop });
  window.Games.TIC = { LINES: LINES, winner: winner, cpuMove: cpuMove, empties: empties, decisive: decisive };
})();
