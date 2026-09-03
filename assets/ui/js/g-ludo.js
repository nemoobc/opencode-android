/* ===== g-ludo.js — ludo sederhana: kamu (hijau) vs 3 CPU =====
   Aturan: kocok 6 keluar markas • injak lawan (non-★) makan •
   6 / makan / finis = jalan lagi • finis harus pas • duluan 4 finis menang */
(function() {
  var PATH = [
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]
  ];
  var START = { R: 0, G: 13, Y: 26, B: 39 };
  var HOMECOL = {
    R: [[7,1],[7,2],[7,3],[7,4],[7,5]],
    G: [[1,7],[2,7],[3,7],[4,7],[5,7]],
    Y: [[7,13],[7,12],[7,11],[7,10],[7,9]],
    B: [[13,7],[12,7],[11,7],[10,7],[9,7]]
  };
  var BASE = {
    R: [[2,2],[2,3],[3,2],[3,3]],
    G: [[2,11],[2,12],[3,11],[3,12]],
    Y: [[11,11],[11,12],[12,11],[12,12]],
    B: [[11,2],[11,3],[12,2],[12,3]]
  };
  var SAFE = { '6,1': 1, '1,8': 1, '8,13': 1, '13,6': 1, '2,6': 1, '6,12': 1, '12,8': 1, '8,2': 1 };
  var COLOR = { R: '#E08A7B', G: '#3DDC84', Y: '#E8D9A0', B: '#6EC6FF' };
  var NAME = { R: 'Merah', G: 'Hijau (kamu)', Y: 'Kuning', B: 'Biru' };
  var ORDER = ['G', 'R', 'Y', 'B'];
  var FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  var timers = [], gest = 0;
  var L = null; /* {toks, turn, dice, phase, winner} */

  /* sel [r,c] utk token — testable. steps: -1 markas, 0-50 ring, 51-55 home, 56 finis */
  function cellFor(color, steps, idx) {
    if (steps < 0) return BASE[color][idx % 4];
    if (steps <= 50) return PATH[(START[color] + steps) % 52];
    if (steps <= 55) return HOMECOL[color][steps - 51];
    return null;
  }
  function newState() {
    return { toks: { R: [-1,-1,-1,-1], G: [-1,-1,-1,-1], Y: [-1,-1,-1,-1], B: [-1,-1,-1,-1] },
      turn: 0, dice: 0, phase: 'roll', winner: null };
  }
  /* langkah legal utk dadu — testable. return [{i,to}] */
  function legalMoves(st, color, dice) {
    var out = [];
    var arr = st.toks[color];
    for (var i = 0; i < 4; i++) {
      var p = arr[i];
      if (p === 56) continue;
      if (p < 0) { if (dice === 6) out.push({ i: i, to: 0 }); continue; }
      var t = p + dice;
      if (t <= 56) out.push({ i: i, to: t });
    }
    return out;
  }
  /* terapkan jalan. return {captured, homed} */
  function applyMove(st, color, mv) {
    var arr = st.toks[color];
    arr[mv.i] = mv.to;
    var res = { captured: false, homed: mv.to === 56 };
    if (mv.to >= 0 && mv.to <= 50) {
      var cell = cellFor(color, mv.to, mv.i);
      var key = cell[0] + ',' + cell[1];
      if (!SAFE[key]) {
        for (var c in st.toks) {
          if (c === color) continue;
          var oa = st.toks[c];
          for (var j = 0; j < 4; j++) {
            var op = oa[j];
            if (op >= 0 && op <= 50) {
              var oc = cellFor(c, op, j);
              if (oc[0] === cell[0] && oc[1] === cell[1]) { oa[j] = -1; res.captured = true; }
            }
          }
        }
      }
    }
    return res;
  }
  function allDone(st, color) {
    var a = st.toks[color];
    return a[0] === 56 && a[1] === 56 && a[2] === 56 && a[3] === 56;
  }
  /* AI CPU: skor tiap jalan, pilih terbaik */
  function cpuPick(st, color, dice, moves) {
    var best = moves[0], bs = -1e9;
    for (var k = 0; k < moves.length; k++) {
      var mv = moves[k], sc = Math.random() * 5;
      var p = st.toks[color][mv.i];
      if (mv.to === 56) sc += 60;
      else if (p < 0) sc += 25;
      else {
        sc += mv.to * 0.3;
        if (mv.to <= 50) {
          var cell = cellFor(color, mv.to, mv.i);
          var key = cell[0] + ',' + cell[1];
          if (SAFE[key]) sc += 10;
          else {
            for (var c in st.toks) {
              if (c === color) continue;
              var oa = st.toks[c];
              for (var j = 0; j < 4; j++) {
                var op = oa[j];
                if (op >= 0 && op <= 50) {
                  var oc = cellFor(c, op, j);
                  if (oc[0] === cell[0] && oc[1] === cell[1]) sc += 40;
                }
              }
            }
          }
          if (p <= 50) {
            var pc = cellFor(color, p, mv.i);
            if (SAFE[pc[0] + ',' + pc[1]] && !SAFE[key]) sc -= 6;
          }
        }
      }
      if (sc > bs) { bs = sc; best = mv; }
    }
    return best;
  }

  /* ---------- UI ---------- */
  function later(fn, ms, id) {
    var t = setTimeout(function() { if (id === gest) fn(); }, ms);
    timers.push(t);
  }
  function log(t) {
    var e = document.getElementById('lulog');
    if (e) e.textContent = t;
  }
  function setScore() {
    var e = document.getElementById('gscore');
    if (!e || !L) return;
    var n = 0, arr = L.toks.G;
    for (var i = 0; i < 4; i++) if (arr[i] === 56) n++;
    e.textContent = '🏠 ' + n + '/4';
  }
  function buildBoard() {
    var h = '';
    for (var r = 0; r < 15; r++) for (var c = 0; c < 15; c++) {
      var cls = 'lucell', key = r + ',' + c;
      if (r < 6 && c < 6) cls += ' baseR';
      else if (r < 6 && c > 8) cls += ' baseG';
      else if (r > 8 && c > 8) cls += ' baseY';
      else if (r > 8 && c < 6) cls += ' baseB';
      if (HOMECOL.R.some(function(x) { return x[0] === r && x[1] === c; })) cls += ' homeR';
      if (HOMECOL.G.some(function(x) { return x[0] === r && x[1] === c; })) cls += ' homeG';
      if (HOMECOL.Y.some(function(x) { return x[0] === r && x[1] === c; })) cls += ' homeY';
      if (HOMECOL.B.some(function(x) { return x[0] === r && x[1] === c; })) cls += ' homeB';
      if (SAFE[key]) cls += ' safe';
      if (r === 7 && c === 6) cls += ' triR';
      if (r === 6 && c === 7) cls += ' triG';
      if (r === 7 && c === 8) cls += ' triY';
      if (r === 8 && c === 7) cls += ' triB';
      h += '<div class="' + cls + '"></div>';
    }
    return '<div class="luboard"><div class="lugrid">' + h + '</div><div class="lutoks" id="lutoks"></div></div>';
  }
  function render(moves) {
    var layer = document.getElementById('lutoks');
    if (!layer || !L) return;
    var byCell = {};
    var html = '';
    var mvSet = {};
    if (moves) for (var m = 0; m < moves.length; m++) mvSet[L.turn + ':' + moves[m].i] = 1;
    for (var ci = 0; ci < ORDER.length; ci++) {
      var color = ORDER[ci];
      var arr = L.toks[color];
      for (var i = 0; i < 4; i++) {
        var cell = cellFor(color, arr[i], i);
        if (!cell) continue;
        var key = cell[0] + ',' + cell[1];
        (byCell[key] = byCell[key] || []).push({ color: color, i: i });
      }
    }
    for (var k in byCell) {
      var grp = byCell[k];
      var rc = k.split(',');
      var br = parseInt(rc[0], 10), bc = parseInt(rc[1], 10);
      for (var g = 0; g < grp.length; g++) {
        var t = grp[g];
        var ox = 0.5, oy = 0.5;
        if (grp.length > 1) { ox = (g % 2 ? 0.72 : 0.28); oy = (g < 2 ? 0.28 : 0.72); }
        var can = mvSet[t.color + ':' + t.i] ? ' canmove' : '';
        html += '<button class="lutok' + can + '" data-c="' + t.color + '" data-i="' + t.i + '"' +
          ' style="left:' + ((bc + ox) / 15 * 100) + '%;top:' + ((br + oy) / 15 * 100) + '%;background:' + COLOR[t.color] + '"></button>';
      }
    }
    layer.innerHTML = html;
    layer.querySelectorAll('.lutok').forEach(function(btn) {
      btn.onclick = function() { tapTok(btn.getAttribute('data-c'), parseInt(btn.getAttribute('data-i'), 10)); };
    });
    var tn = document.getElementById('luturn');
    if (tn) {
      var col = ORDER[L.turn];
      tn.innerHTML = '<span class="ludot" style="background:' + COLOR[col] + '"></span> ' +
        (col === 'G' ? 'Giliranmu!' : 'Giliran ' + NAME[col] + '...');
    }
    setScore();
  }
  function start() {
    stop();
    var id = ++gest;
    L = newState();
    var b = document.getElementById('gbody');
    b.innerHTML = '<div class="luturn" id="luturn"></div>' + buildBoard() +
      '<div class="lurow"><button class="ludice" id="ludice">⚀</button></div>' +
      '<div class="lulog" id="lulog">Kocok dadu untuk mulai. Butuh 6 keluar markas!</div>';
    document.getElementById('gtitle').textContent = 'Ludo';
    document.getElementById('ludice').onclick = function() { humanRoll(id); };
    render(null);
    log('Giliranmu! Ketuk dadu 🎲');
  }
  function diceAnim(id, done) {
    var d = document.getElementById('ludice');
    if (d) d.disabled = true;
    var n = 0;
    var iv = setInterval(function() {
      if (id !== gest) { clearInterval(iv); return; }
      if (d) d.textContent = FACES[Math.floor(Math.random() * 6)];
      if (++n >= 6) {
        clearInterval(iv);
        done();
      }
    }, 70);
    timers.push(iv);
  }
  function humanRoll(id) {
    if (id !== gest || !L || L.winner || ORDER[L.turn] !== 'G' || L.phase !== 'roll') return;
    L.phase = 'anim';
    diceAnim(id, function() {
      L.dice = 1 + Math.floor(Math.random() * 6);
      var d = document.getElementById('ludice');
      if (d) d.textContent = FACES[L.dice - 1];
      var moves = legalMoves(L, 'G', L.dice);
      if (!moves.length) {
        log('🎲 ' + L.dice + ' — ga bisa jalan.');
        render(null);
        return later(function() { nextTurn(id); }, 900, id);
      }
      if (moves.length === 1) {
        log('🎲 ' + L.dice + ' — jalan otomatis.');
        render(moves);
        return later(function() { doMove(id, 'G', moves[0]); }, 500, id);
      }
      L.phase = 'move';
      L.moves = moves;
      log('🎲 ' + L.dice + ' — ketuk bidak hijau berdenyut!');
      render(moves);
    });
  }
  function tapTok(color, i) {
    if (!L || L.winner || color !== 'G' || ORDER[L.turn] !== 'G' || L.phase !== 'move') return;
    var id = gest;
    var moves = L.moves || [];
    for (var k = 0; k < moves.length; k++) {
      if (moves[k].i === i) return doMove(id, 'G', moves[k]);
    }
  }
  function doMove(id, color, mv) {
    if (id !== gest || !L || L.winner) return;
    var fromBase = L.toks[color][mv.i] < 0;
    var res = applyMove(L, color, mv);
    render(null);
    var nm = NAME[color].split(' ')[0];
    if (res.captured) log('💥 ' + nm + ' makan lawan!');
    else if (res.homed) log('🏠 ' + nm + ' finis 1 bidak!');
    else log(nm + ' jalan ' + L.dice + (fromBase ? ' (keluar markas!)' : '.'));
    if (allDone(L, color)) return win(id, color);
    var extra = (L.dice === 6 || res.captured || res.homed);
    later(function() {
      if (extra) {
        log(nm + ' jalan lagi!');
        beginTurn(id, false);
      } else nextTurn(id);
    }, 750, id);
  }
  function beginTurn(id, advance) {
    if (id !== gest || !L || L.winner) return;
    var color = ORDER[L.turn];
    L.phase = 'roll';
    L.dice = 0;
    var d = document.getElementById('ludice');
    if (color === 'G') {
      if (d) { d.disabled = false; d.textContent = '🎲'; }
      render(null);
      log('Giliranmu! Ketuk dadu 🎲');
    } else {
      if (d) { d.disabled = true; d.textContent = '🎲'; }
      render(null);
      later(function() { cpuTurn(id, color); }, 700, id);
    }
  }
  function cpuTurn(id, color) {
    if (id !== gest || !L || L.winner) return;
    L.phase = 'anim';
    diceAnim(id, function() {
      L.dice = 1 + Math.floor(Math.random() * 6);
      var d = document.getElementById('ludice');
      if (d) d.textContent = FACES[L.dice - 1];
      var moves = legalMoves(L, color, L.dice);
      if (!moves.length) {
        log(NAME[color].split(' ')[0] + ' kocok ' + L.dice + ' — lewat.');
        render(null);
        return later(function() { nextTurn(id); }, 800, id);
      }
      var mv = cpuPick(L, color, L.dice, moves);
      render([mv]);
      later(function() { doMove(id, color, mv); }, 600, id);
    });
  }
  function nextTurn(id) {
    if (id !== gest || !L || L.winner) return;
    L.turn = (L.turn + 1) % 4;
    beginTurn(id, true);
  }
  function win(id, color) {
    if (id !== gest || !L) return;
    L.winner = color;
    render(null);
    var d = document.getElementById('ludice');
    if (d) d.disabled = true;
    var you = color === 'G';
    if (you) {
      var w = parseInt(gbestGet('g-ludo-wins', '0'), 10) || 0;
      gbestSet('g-ludo-wins', w + 1);
    }
    log(you ? '🏆 KAMU MENANG! Hebat!' : '😅 ' + NAME[color] + ' menang. Coba lagi!');
    var b = document.getElementById('gbody');
    var div = document.createElement('div');
    div.innerHTML = '<button class="gbtn" id="lu-again" style="margin-top:4px">Main Lagi</button>';
    b.appendChild(div);
    document.getElementById('lu-again').onclick = function() { start(); };
  }
  function stop() {
    gest++;
    for (var i = 0; i < timers.length; i++) {
      try { clearTimeout(timers[i]); clearInterval(timers[i]); } catch (e) {}
    }
    timers = [];
    L = null;
  }
  window.Games.reg('ludo', { start: start, stop: stop });
  window.Games.LUDO = { PATH: PATH, START: START, cellFor: cellFor, newState: newState, legalMoves: legalMoves, applyMove: applyMove };
})();
