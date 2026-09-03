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
  var HOMESTART = { '6,1': 'R', '1,8': 'G', '8,13': 'Y', '13,6': 'B' };
  var COLOR = { R: '#E0514A', G: '#2FBF71', Y: '#E8C93A', B: '#3FA7E8' };
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
  function log(t, cls) {
    if (!L) return;
    L.logs = L.logs || [];
    L.logs.push(cls ? '<span class="' + cls + '">' + t + '</span>' : t);
    if (L.logs.length > 3) L.logs.shift();
    var e = document.getElementById('lulog');
    if (e) e.innerHTML = L.logs.join('<br>');
  }
  function setScore() {
    var e = document.getElementById('gscore');
    if (!e || !L) return;
    var n = 0, arr = L.toks.G;
    for (var i = 0; i < 4; i++) if (arr[i] === 56) n++;
    e.textContent = '🏠 ' + n + '/4';
    var tray = document.getElementById('lutray');
    if (tray) {
      var h = '';
      for (var c = 0; c < ORDER.length; c++) {
        var col = ORDER[c], dn = 0, ta = L.toks[col];
        for (var j = 0; j < 4; j++) if (ta[j] === 56) dn++;
        h += '<span><span class="ludot" style="background:' + COLOR[col] + ';display:inline-block;vertical-align:-1px"></span>';
        for (var s = 0; s < 4; s++) h += '<span class="slot' + (s < dn ? ' fill' : '') + '"></span>';
        h += '</span>';
      }
      tray.innerHTML = h;
    }
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
      if (HOMESTART[key]) cls += ' homestart' + HOMESTART[key];
      if (r >= 1 && r <= 4 && c >= 1 && c <= 4) cls += ' yard';
      if (r >= 1 && r <= 4 && c >= 10 && c <= 13) cls += ' yard';
      if (r >= 10 && r <= 13 && c >= 10 && c <= 13) cls += ' yard';
      if (r >= 10 && r <= 13 && c >= 1 && c <= 4) cls += ' yard';
      h += '<div class="' + cls + '"></div>';
    }
    return '<div class="luboard"><div class="lugrid">' + h + '</div><div class="tric"></div><div class="lutoks" id="lutoks"></div></div>';
  }
  function render(moves) {
    var layer = document.getElementById('lutoks');
    if (!layer || !L) return;
    /* node persistent per bidak — transisi left/top CSS jalan mulus
       (dulu innerHTML rebuild tiap render = teleport, animasi mati) */
    if (!L.nodes) L.nodes = {};
    var seen = {};
    var mvSet = {};
    if (moves) for (var m = 0; m < moves.length; m++) mvSet[L.turn + ':' + moves[m].i] = 1;
    /* hitung isi tiap sel utk offset susun */
    var cellCount = {}, cellIdx = {};
    var infos = [];
    for (var ci = 0; ci < ORDER.length; ci++) {
      var color = ORDER[ci];
      var arr = L.toks[color];
      for (var i = 0; i < 4; i++) {
        var cell = cellFor(color, arr[i], i);
        if (!cell) continue;
        var key = cell[0] + ',' + cell[1];
        cellCount[key] = (cellCount[key] || 0) + 1;
        infos.push({ color: color, i: i, cell: cell, key: key });
      }
    }
    for (var k = 0; k < infos.length; k++) {
      (function(t) {
        var nkey = t.color + t.i;
        seen[nkey] = 1;
        var btn = L.nodes[nkey];
        if (!btn || !btn.isConnected) {
          btn = document.createElement('button');
          btn.className = 'lutok';
          btn.style.setProperty('--c', COLOR[t.color]);
          btn.onclick = function() { tapTok(t.color, t.i); };
          layer.appendChild(btn);
          L.nodes[nkey] = btn;
        }
        var n = cellCount[t.key];
        var g = (cellIdx[t.key] = (cellIdx[t.key] || 0) + 1) - 1;
        var ox = 0.5, oy = 0.5;
        if (n > 1) { ox = (g % 2 ? 0.72 : 0.28); oy = (g < 2 ? 0.28 : 0.72); }
        btn.style.left = ((t.cell[1] + ox) / 15 * 100) + '%';
        btn.style.top = ((t.cell[0] + oy) / 15 * 100) + '%';
        /* pin numpuk ala asli (tanpa angka) */
        /* di markas = kecil (kaya pion di kandang referensi) */
        if (L.toks[t.color][t.i] < 0) btn.classList.add('inyard');
        else btn.classList.remove('inyard');
        btn.classList.remove('vblink');
        if (mvSet[t.color + ':' + t.i]) btn.classList.add('canmove');
        else btn.classList.remove('canmove');
        if (L.winner === t.color) btn.classList.add('winglow');
        else btn.classList.remove('winglow');
      })(infos[k]);
    }
    /* buang node bidak finis */
    for (var nk in L.nodes) {
      if (!seen[nk] && L.nodes[nk].parentNode) L.nodes[nk].parentNode.removeChild(L.nodes[nk]);
      if (!seen[nk]) delete L.nodes[nk];
    }
    var aw = document.getElementById('luarrow');
    if (aw) {
      if (ORDER[L.turn] === 'G' && L.phase === 'roll' && !L.winner) aw.classList.remove('hide');
      else aw.classList.add('hide');
    }
    var tn = document.getElementById('luturn');
    if (tn) {
      var col = ORDER[L.turn];
      if (L.shownTurn !== L.turn) {
        L.shownTurn = L.turn;
        tn.classList.remove('swap');
        void tn.offsetWidth;
        tn.classList.add('swap');
      }
      tn.innerHTML = '<span class="ludot" style="background:' + COLOR[col] + '"></span> ' +
        (col === 'G' ? '<b style="color:' + COLOR[col] + '">Giliranmu!</b>' : 'Giliran <b style="color:' + COLOR[col] + '">' + NAME[col] + '</b>' + (L.thinking ? ' (mikir...)' : '...'));
    }
    setScore();
  }
  function start() {
    stop();
    var id = ++gest;
    L = newState();
    var b = document.getElementById('gbody');
    b.innerHTML = '<div class="luturn" id="luturn"></div>' +
      '<div class="luteams"><span class="tm"><span class="ludot" style="background:#8a8f98"></span>CPU</span>' +
      '<span class="tm">KAMU<span class="ludot" style="background:#2FBF71"></span></span></div>' +
      buildBoard() +
      '<div class="lutray" id="lutray"></div>' +
      '<details class="lurules"><summary>📖 Aturan singkat</summary>Butuh <b>6</b> keluar markas. Injak lawan (bukan ★) = makan. <b>6</b> / makan / finis = jalan lagi. Finis harus pas. Duluan 4 finis menang!<br>Contoh: kocok <b>6</b> → tap bidak hijau yang berdenyut → jalan!</details>' +
      '<div id="luarrow">▼</div>' +
      '<div class="lubarbottom"><span class="who"><span class="ludot" style="background:#2FBF71"></span>Kamu</span>' +
      '<button class="ludice" id="ludice">⚀</button>' +
      '<span class="who">CPU<span class="ludot" style="background:#8a8f98"></span></span></div>' +
      '<div class="lulog" id="lulog"></div>';
    document.getElementById('gtitle').textContent = 'Ludo';
    document.getElementById('ludice').onclick = function() { humanRoll(id); };
    render(null);
    log('Giliranmu! Ketuk dadu 🎲');
  }
  function shakeBoard() {
    var bo = document.querySelector('#gbody .luboard');
    if (!bo) return;
    bo.classList.remove('shake');
    void bo.offsetWidth;
    bo.classList.add('shake');
  }
  /* dadu pip custom — konsisten di semua HP (unicode ⚀ kecil di sebagian font) */
  var PIPMAP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function diceFaces(n, bounce) {
    var d = document.getElementById('ludice');
    if (!d) return;
    var h = '<span class="pips">';
    for (var i = 0; i < 9; i++) h += '<i class="' + (PIPMAP[n].indexOf(i) >= 0 ? 'on' : '') + '"></i>';
    d.innerHTML = h + '</span>';
    if (bounce) {
      d.classList.remove('bounce');
      void d.offsetWidth;
      d.classList.add('bounce');
    }
  }
  function diceShow(n) { diceFaces(n, true); }
  function diceAnim(id, done) {
    var d = document.getElementById('ludice');
    if (d) { d.disabled = true; d.classList.add('rolling'); }
    var n = 0;
    var iv = setInterval(function() {
      if (id !== gest) { clearInterval(iv); return; }
      diceFaces(1 + Math.floor(Math.random() * 6), false);
      if (++n >= 8) {
        clearInterval(iv);
        var dd = document.getElementById('ludice');
        if (dd) dd.classList.remove('rolling');
        done();
      }
    }, 80);
    timers.push(iv);
  }
  function humanRoll(id) {
    if (id !== gest || !L || L.winner || ORDER[L.turn] !== 'G' || L.phase !== 'roll') return;
    L.phase = 'anim';
    diceAnim(id, function() {
      L.dice = 1 + Math.floor(Math.random() * 6);
      var d = document.getElementById('ludice');
      diceShow(L.dice);
      if (L.dice === 6) shakeBoard();
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
  /* korban yang bakal dimakan — tanpa ubah state (buat blink dulu) */
  function findVictims(st, color, mv) {
    var out = [];
    if (mv.to < 0 || mv.to > 50) return out;
    var cell = cellFor(color, mv.to, mv.i);
    if (SAFE[cell[0] + ',' + cell[1]]) return out;
    for (var c in st.toks) {
      if (c === color) continue;
      var oa = st.toks[c];
      for (var j = 0; j < 4; j++) {
        var op = oa[j];
        if (op >= 0 && op <= 50) {
          var oc = cellFor(c, op, j);
          if (oc[0] === cell[0] && oc[1] === cell[1]) out.push({ c: c, j: j });
        }
      }
    }
    return out;
  }
  function doMove(id, color, mv) {
    if (id !== gest || !L || L.winner) return;
    clearThink();
    L.thinking = false;
    L.phase = 'hop';
    var from = L.toks[color][mv.i];
    var victims = findVictims(L, color, mv);
    /* korban kedip 3x sebelum dimakan */
    if (victims.length && L.nodes) {
      for (var v = 0; v < victims.length; v++) {
        var nd = L.nodes[victims[v].c + victims[v].j];
        if (nd && nd.isConnected) nd.classList.add('vblink');
      }
    }
    /* lompat per sel (bukan 1 garis lurus) khusus jalan ring multi-langkah.
       tempo santai ala papan asli: angkat 90ms → geser 140ms → jeda 70ms. */
    var hops = [];
    if (from >= 0 && mv.to <= 50 && mv.to - from > 1) {
      for (var s = from + 1; s <= mv.to; s++) hops.push(s);
    }
    var waitBlink = victims.length ? 480 : 0;
    /* keluar markas: arc spesial (angkat tinggi → melayang → debuk) */
    if (from < 0) {
      return exitHop(id, color, mv, function() {
        finalizeMove(id, color, mv);
      });
    }
    if (!hops.length) {
      var layer0 = document.getElementById('lutoks');
      if (layer0) layer0.style.setProperty('--lud', '0.3s');
      return later(function() { finalizeMove(id, color, mv); }, waitBlink, id);
    }
    var hi = 0;
    (function stepHop() {
      if (id !== gest || !L || L.winner) return;
      if (hi < hops.length) {
        L.toks[color][mv.i] = hops[hi];
        hopTo(color, mv.i, function() {
          hi++;
          var t = setTimeout(stepHop, 70);
          timers.push(t);
        });
      } else {
        L.toks[color][mv.i] = from; /* kembalikan, finalize yang resmi */
        finalizeMove(id, color, mv);
      }
    })();
    /* keluar markas: angkat TINGGI 180ms → melayang ke start 260ms → debuk */
    function exitHop(eid, ecolor, emv, done) {
      if (!L || !L.nodes) { done(); return; }
      var nd = L.nodes[ecolor + emv.i];
      var cell = cellFor(ecolor, 0, emv.i);
      if (!nd || !cell || !nd.isConnected) { done(); return; }
      nd.style.marginTop = 'calc(-3.2% - 26px)';
      var t1 = setTimeout(function() {
        if (eid !== gest || !nd.isConnected) { done(); return; }
        nd.style.left = ((cell[1] + 0.5) / 15 * 100) + '%';
        nd.style.top = ((cell[0] + 0.5) / 15 * 100) + '%';
        nd.style.marginTop = '';
        nd.classList.remove('land');
        void nd.offsetWidth;
        nd.classList.add('land');
        var t2 = setTimeout(done, 260);
        timers.push(t2);
      }, 180);
      timers.push(t1);
    }
    /* 1 lompatan: angkat 90ms → geser+turun 140ms → debuk */
    function hopTo(cc, ii, done) {
      if (!L || !L.nodes) { done(); return; }
      var nd = L.nodes[cc + ii];
      var cell = cellFor(cc, L.toks[cc][ii], ii);
      if (!nd || !cell || !nd.isConnected) { done(); return; }
      nd.style.marginTop = 'calc(-3.2% - 13px)';
      var t1 = setTimeout(function() {
        if (id !== gest || !nd.isConnected) { done(); return; }
        nd.style.left = ((cell[1] + 0.5) / 15 * 100) + '%';
        nd.style.top = ((cell[0] + 0.5) / 15 * 100) + '%';
        nd.style.marginTop = '';
        nd.classList.remove('land');
        void nd.offsetWidth;
        nd.classList.add('land');
        var t2 = setTimeout(done, 140);
        timers.push(t2);
      }, 90);
      timers.push(t1);
    }
  }
  function finalizeMove(id, color, mv) {
    if (id !== gest || !L || L.winner) return;
    var fromBase = L.toks[color][mv.i] < 0;
    var layer = document.getElementById('lutoks');
    if (layer) layer.style.setProperty('--lud', '0.3s');
    var res = applyMove(L, color, mv);
    render(null);
    if (res.captured && layer && mv.to >= 0 && mv.to <= 50) {
      (function() {
        var cell = cellFor(color, mv.to, mv.i);
        var boom = document.createElement('div');
        boom.className = 'luboom';
        boom.style.left = ((cell[1] + 0.5) / 15 * 100) + '%';
        boom.style.top = ((cell[0] + 0.5) / 15 * 100) + '%';
        layer.appendChild(boom);
        setTimeout(function() { if (boom.parentNode) boom.parentNode.removeChild(boom); }, 600);
      })();
    }
    var nm = NAME[color].split(' ')[0];
    if (res.captured) log('💥 ' + nm + ' makan lawan!', 'lg-eat');
    else if (res.homed) log('🏠 ' + nm + ' finis 1 bidak!', 'lg-home');
    else log(nm + ' jalan ' + L.dice + (fromBase ? ' (keluar markas!)' : '.'), L.dice === 6 ? 'lg-six' : '');
    if (allDone(L, color)) return win(id, color);
    var extra = (L.dice === 6 || res.captured || res.homed);
    var wait = color === 'G' ? 750 : 600;
    later(function() {
      if (extra) {
        log(nm + ' jalan lagi!');
        beginTurn(id, false);
      } else nextTurn(id);
    }, wait, id);
  }
  function clearThink() {
    var layer = document.getElementById('lutoks');
    if (!layer) return;
    var els = layer.querySelectorAll('.lutok.think');
    for (var i = 0; i < els.length; i++) els[i].classList.remove('think');
  }
  function beginTurn(id, advance) {
    if (id !== gest || !L || L.winner) return;
    var color = ORDER[L.turn];
    L.phase = 'roll';
    L.dice = 0;
    var d = document.getElementById('ludice');
    if (color === 'G') {
      if (d) { d.disabled = false; d.textContent = '🎲'; d.classList.add('ready'); }
      render(null);
      log('Giliranmu! Ketuk dadu 🎲');
    } else {
      if (d) { d.disabled = true; d.textContent = '🎲'; d.classList.remove('ready'); }
      render(null);
      later(function() { cpuTurn(id, color); }, 500, id);
    }
  }
  function cpuTurn(id, color) {
    if (id !== gest || !L || L.winner) return;
    L.phase = 'anim';
    L.thinking = true;
    render(null);
    /* bidak CPU denyut pas mikir */
    var layer = document.getElementById('lutoks');
    if (layer && L.nodes) {
      for (var k in L.nodes) {
        if (k.charAt(0) === color && L.nodes[k].isConnected) L.nodes[k].classList.add('think');
      }
    }
    diceAnim(id, function() {
      L.dice = 1 + Math.floor(Math.random() * 6);
      var d = document.getElementById('ludice');
      diceShow(L.dice);
      if (L.dice === 6) shakeBoard();
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
    if (d) { d.disabled = true; d.classList.remove('ready'); }
    var you = color === 'G';
    if (you) {
      var w = parseInt(gbestGet('g-ludo-wins', '0'), 10) || 0;
      gbestSet('g-ludo-wins', w + 1);
    }
    /* banner emas + hujan crown */
    var tn = document.getElementById('luturn');
    if (tn) {
      tn.classList.remove('swap');
      void tn.offsetWidth;
      tn.classList.add('winb');
      tn.innerHTML = (you ? '👑 <b>KAMU MENANG!</b> Hebat!' : '😅 ' + NAME[color] + ' menang.');
    }
    if (you) crownRain();
    var b = document.getElementById('gbody');
    var div = document.createElement('div');
    div.innerHTML = '<button class="gbtn ghost2" id="lu-menu">‹ Menu</button> <button class="gbtn" id="lu-again" style="margin-top:4px">Main Lagi</button>';
    b.appendChild(div);
    document.getElementById('lu-again').onclick = function() { start(); };
    document.getElementById('lu-menu').onclick = function() { showGMenu(); };
  }
  function crownRain() {
    for (var i = 0; i < 18; i++) {
      (function() {
        var c = document.createElement('div');
        c.className = 'crownfall';
        c.textContent = '👑';
        c.style.left = (Math.random() * 96) + 'vw';
        c.style.animationDelay = (Math.random() * 0.8) + 's';
        document.body.appendChild(c);
        setTimeout(function() { if (c.parentNode) c.parentNode.removeChild(c); }, 3400);
      })();
    }
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
