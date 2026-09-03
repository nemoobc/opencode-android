/* ===== g-snake.js — mainan ular (canvas + swipe + dpad) ===== */
(function() {
  var COLS = 20, ROWS = 20, CELL = 15;
  var timer = null, gest = 0;
  var S = null; /* state */

  function newState() {
    var cy = Math.floor(ROWS / 2);
    return {
      snake: [[5, cy], [4, cy], [3, cy]],
      dir: [1, 0],
      queue: [],
      food: null,
      foodGold: false,
      meals: 0,
      died: null,
      score: 0,
      alive: true
    };
  }
  function freeCell(s) {
    for (var t = 0; t < 200; t++) {
      var x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS);
      var ok = true;
      for (var i = 0; i < s.snake.length; i++) {
        if (s.snake[i][0] === x && s.snake[i][1] === y) { ok = false; break; }
      }
      if (ok) return [x, y];
    }
    return [0, 0];
  }
  /* SATU langkah murni — testable. return 'move'|'eat'|'dead' */
  function advance(s) {
    if (s.queue.length) {
      var d = s.queue.shift();
      if (!(d[0] === -s.dir[0] && d[1] === -s.dir[1])) s.dir = d;
    }
    var h = s.snake[0];
    var nh = [h[0] + s.dir[0], h[1] + s.dir[1]];
    if (nh[0] < 0 || nh[1] < 0 || nh[0] >= COLS || nh[1] >= ROWS) { s.died = 'wall'; return 'dead'; }
    var eat = (nh[0] === s.food[0] && nh[1] === s.food[1]);
    var lim = eat ? s.snake.length : s.snake.length - 1;
    for (var i = 0; i < lim; i++) {
      if (s.snake[i][0] === nh[0] && s.snake[i][1] === nh[1]) { s.died = 'self'; return 'dead'; }
    }
    s.snake.unshift(nh);
    if (eat) {
      s.meals++;
      s.score += s.foodGold ? 50 : 10;
      s.food = freeCell(s);
      s.foodGold = (s.meals % 5 === 4);
      return 'eat';
    }
    s.snake.pop();
    return 'move';
  }
  function speed() { return Math.max(70, 150 - S.score); }
  function level() { return Math.floor(S.score / 50); }

  function nowMs() {
    try {
      if (typeof performance !== 'undefined' && performance.now) return performance.now();
    } catch (e) {}
    return Date.now();
  }
  function lerpPos(prev, cur, t) {
    return [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
  }
  function burst(x, y) {
    if (!S.parts) S.parts = [];
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
      S.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  }
  function floatTxt(x, y, txt, col) {
    if (!S.floats) S.floats = [];
    S.floats.push({ x: x, y: y, txt: txt, col: col || '#3DDC84', life: 1 });
  }
  function draw(now) {
    now = (now === undefined) ? nowMs() : now;
    var cv = document.getElementById('snk');
    if (!cv || !S) return;
    var g = cv.getContext('2d');
    g.fillStyle = '#08110C';
    g.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    /* grid gelombang dari kepala */
    var hx0 = S.snake[0][0], hy0 = S.snake[0][1];
    g.strokeStyle = 'rgba(61,220,132,.06)';
    g.lineWidth = 1;
    g.beginPath();
    for (var gi = 1; gi < COLS; gi++) { g.moveTo(gi * CELL + .5, 0); g.lineTo(gi * CELL + .5, ROWS * CELL); }
    for (var gj = 1; gj < ROWS; gj++) { g.moveTo(0, gj * CELL + .5); g.lineTo(COLS * CELL, gj * CELL + .5); }
    g.stroke();
    g.strokeStyle = 'rgba(61,220,132,.16)';
    g.beginPath();
    var gr = 4 + ((now / 240) % 3);
    g.arc(hx0 * CELL + CELL / 2, hy0 * CELL + CELL / 2, gr * CELL, 0, 7);
    g.stroke();
    /* umpan pulse (emas tiap ke-5, poin 50) */
    var fcol = S.foodGold ? '#E8D9A0' : '#E85D5D';
    var pr = CELL / 2 - 2 + Math.sin(now / 180) * 2;
    g.fillStyle = fcol;
    g.beginPath();
    g.arc(S.food[0] * CELL + CELL / 2, S.food[1] * CELL + CELL / 2, Math.max(2, pr), 0, 7);
    g.fill();
    g.fillStyle = S.foodGold ? 'rgba(232,217,160,.4)' : 'rgba(232,93,93,.35)';
    g.beginPath();
    g.arc(S.food[0] * CELL + CELL / 2, S.food[1] * CELL + CELL / 2, Math.max(3, pr + 3), 0, 7);
    g.fill();
    /* badan KAPSUL gradasi kepala→ekor (mulus, bukan bulet pisah) */
    var t = S.prev ? Math.min(1, (now - S.stepAt) / S.stepMs) : 1;
    var n = S.snake.length;
    var pts = [];
    for (var i = n - 1; i >= 0; i--) {
      var cur = S.snake[i];
      var pv = (S.prev && S.prev[i]) ? S.prev[i] : cur;
      if (!S.prev || !S.prev[i]) pv = S.prev ? S.prev[S.prev.length - 1] : cur;
      var xy = lerpPos(pv, cur, t);
      pts.unshift([xy[0] * CELL + CELL / 2, xy[1] * CELL + CELL / 2]);
    }
    var hp = pts[0], tp = pts[pts.length - 1];
    var grad = g.createLinearGradient(hp[0], hp[1], tp[0], tp[1]);
    grad.addColorStop(0, '#3DDC84');
    grad.addColorStop(1, '#1E7A4C');
    g.strokeStyle = grad;
    g.lineWidth = CELL - 3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(tp[0], tp[1]);
    for (var k = pts.length - 1; k >= 0; k--) g.lineTo(pts[k][0], pts[k][1]);
    g.stroke();
    /* kepala 20% lebih gede */
    g.fillStyle = '#3DDC84';
    g.beginPath();
    g.arc(hp[0], hp[1], CELL / 2, 0, 7);
    g.fill();
    /* mata beneran: putih + pupil */
    var hc = lerpPos((S.prev && S.prev[0]) ? S.prev[0] : S.snake[0], S.snake[0], t);
    var hcx = hc[0] * CELL + CELL / 2, hcy = hc[1] * CELL + CELL / 2;
    var px = -S.dir[1], py = S.dir[0];
    for (var e = -1; e <= 1; e += 2) {
      var exx = hcx + S.dir[0] * 3 + px * 3.4 * e, eyy = hcy + S.dir[1] * 3 + py * 3.4 * e;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(exx, eyy, 2.6, 0, 7); g.fill();
      g.fillStyle = '#0C100E';
      g.beginPath(); g.arc(exx + S.dir[0], eyy + S.dir[1], 1.3, 0, 7); g.fill();
    }
    if (Math.floor(now / 300) % 2 === 0) {
      g.strokeStyle = '#E85D5D';
      g.lineWidth = 2;
      g.beginPath();
      var tx = hcx + S.dir[0] * (CELL / 2 + 3), ty = hcy + S.dir[1] * (CELL / 2 + 3);
      g.moveTo(hcx + S.dir[0] * CELL / 2, hcy + S.dir[1] * CELL / 2);
      g.lineTo(tx, ty);
      g.stroke();
    }
    /* partikel pecah */
    if (S.parts) {
      for (var k = S.parts.length - 1; k >= 0; k--) {
        var pt = S.parts[k];
        pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.06;
        if (pt.life <= 0) { S.parts.splice(k, 1); continue; }
        g.fillStyle = S.foodGold ? 'rgba(232,217,160,' + pt.life.toFixed(2) + ')' : 'rgba(232,93,93,' + pt.life.toFixed(2) + ')';
        g.fillRect(pt.x * CELL, pt.y * CELL, 3, 3);
      }
    }
    /* teks skor melayang */
    if (S.floats) {
      g.textAlign = 'center';
      g.font = 'bold 13px sans-serif';
      for (var f = S.floats.length - 1; f >= 0; f--) {
        var fl = S.floats[f];
        fl.y -= 0.06; fl.life -= 0.03;
        if (fl.life <= 0) { S.floats.splice(f, 1); continue; }
        g.fillStyle = fl.col;
        g.globalAlpha = Math.max(0, fl.life);
        g.fillText(fl.txt, fl.x * CELL, fl.y * CELL);
        g.globalAlpha = 1;
      }
    }
    /* kilat naik level */
    if (now - (S.flashAt || 0) < 1000) {
      g.strokeStyle = 'rgba(61,220,132,.9)';
      g.lineWidth = 4;
      g.strokeRect(2, 2, COLS * CELL - 4, ROWS * CELL - 4);
      g.fillStyle = '#3DDC84';
      g.font = 'bold 16px sans-serif';
      g.textAlign = 'center';
      g.fillText('+CEPAT!', COLS * CELL / 2, 24);
    }
  }
  function frame(id, now) {
    if (id !== gest || !S) return;
    draw(now || nowMs());
    if (S.alive) requestAnimationFrame(function(t) { frame(id, t); });
  }
  function loop(id) {
    if (id !== gest || !S || !S.alive) return;
    /* slow-motion sekarat: 2 langkah pelan tanpa gerak, baru panel */
    if (S.dying > 0) {
      S.dying--;
      S.stepMs = 350;
      S.stepAt = nowMs();
      if (S.dying <= 0) return gameOver(id);
      timer = setTimeout(function() { loop(id); }, S.stepMs);
      return;
    }
    S.prev = S.snake.map(function(p) { return [p[0], p[1]]; });
    S.stepMs = speed();
    S.stepAt = nowMs();
    var lvBefore = level();
    var wasGold = S.foodGold;
    var r = advance(S);
    if (r === 'dead') { S.dying = 2; timer = setTimeout(function() { loop(id); }, 60); return; }
    if (r === 'eat') {
      scorePop();
      burst(S.snake[0][0] + 0.5, S.snake[0][1] + 0.5);
      floatTxt(S.snake[0][0] + 0.5, S.snake[0][1], wasGold ? '+50' : '+10', wasGold ? '#E8D9A0' : '#3DDC84');
      if (level() > lvBefore) S.flashAt = nowMs();
    }
    setScore('Skor ' + S.score + ' • ×' + S.snake.length);
    timer = setTimeout(function() { loop(id); }, S.stepMs);
  }
  function setScore(t) {
    var e = document.getElementById('gscore');
    if (e) e.textContent = t;
  }
  function scorePop() {
    var e = document.getElementById('gscore');
    if (!e) return;
    e.classList.remove('pop');
    void e.offsetWidth;
    e.classList.add('pop');
  }
  function gameOver(id) {
    if (id !== undefined && id !== gest) return;
    S.alive = false;
    /* zoom-in + flash merah + goyang, panel muncul kemudian */
    var cv = document.getElementById('snk');
    if (cv) { cv.classList.add('dead'); cv.classList.add('zoom'); }
    setTimeout(function() {
      if (id !== gest) return;
      showOver();
    }, 650);
  }
  function showOver() {
    var best = parseInt(gbestGet('g-snake-best', '0'), 10) || 0;
    if (S.score > best) { best = S.score; gbestSet('g-snake-best', best); }
    var b = document.getElementById('gbody');
    var why = S.died === 'self' ? 'Gigit diri sendiri!' : 'Nabrak tembok!';
    b.innerHTML = '<div class="gpanel"><div class="big">💀 Kalah!</div>' +
      '<div class="sub2">' + why + ' Skor: <b>' + S.score + '</b> • Terbaik: <b>' + best + '</b></div>' +
      '<button class="gbtn ghost2" id="snk-menu">‹ Menu</button> <button class="gbtn" id="snk-again">Main Lagi</button></div>';
    document.getElementById('snk-again').onclick = function() { start(); };
    document.getElementById('snk-menu').onclick = function() { showGMenu(); };
  }
  function flashPad(dx, dy) {
    var b = document.getElementById('gbody');
    if (!b) return;
    var btn = b.querySelector('.dpad button[data-d="' + dx + ',' + dy + '"]');
    if (!btn) return;
    btn.classList.remove('on');
    void btn.offsetWidth;
    btn.classList.add('on');
    setTimeout(function() { btn.classList.remove('on'); }, 220);
  }
  function turn(dx, dy) {
    if (!S || !S.alive) return;
    var last = S.queue.length ? S.queue[S.queue.length - 1] : S.dir;
    if (S.queue.length < 3 && !(dx === -last[0] && dy === -last[1]) && !(dx === last[0] && dy === last[1])) {
      S.queue.push([dx, dy]);
      flashPad(dx, dy);
    }
  }
  function start() {
    stop();
    var id = ++gest;
    S = newState();
    S.food = freeCell(S);
    var b = document.getElementById('gbody');
    b.innerHTML = '<canvas id="snk" width="' + (COLS * CELL) + '" height="' + (ROWS * CELL) + '"></canvas>' +
      '<div class="dpad"><button class="du" data-d="0,-1">▲</button>' +
      '<button class="dl" data-d="-1,0">◀</button><button class="dd" data-d="0,1">▼</button>' +
      '<button class="dr" data-d="1,0">▶</button></div>';
    setScore('Skor 0 • ×3');
    b.querySelectorAll('.dpad button').forEach(function(btn) {
      btn.onclick = function() {
        var d = btn.getAttribute('data-d').split(',');
        turn(parseInt(d[0], 10), parseInt(d[1], 10));
      };
    });
    var cv = document.getElementById('snk'), tx = 0, ty = 0;
    cv.addEventListener('touchstart', function(e) {
      var t = e.changedTouches[0];
      tx = t.clientX; ty = t.clientY;
    }, { passive: true });
    cv.addEventListener('touchend', function(e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - tx, dy = t.clientY - ty;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
      else turn(0, dy > 0 ? 1 : -1);
    }, { passive: true });
    draw();
    requestAnimationFrame(function(t) { frame(id, t); });
    timer = setTimeout(function() { loop(id); }, 400);
  }
  function stop() {
    gest++;
    if (timer) { clearTimeout(timer); timer = null; }
    S = null;
  }
  window.Games.reg('snake', { start: start, stop: stop });
  window.Games.SNAKE = { newState: newState, advance: advance, COLS: COLS, ROWS: ROWS };
})();
