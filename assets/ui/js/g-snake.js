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
    if (nh[0] < 0 || nh[1] < 0 || nh[0] >= COLS || nh[1] >= ROWS) return 'dead';
    var eat = (nh[0] === s.food[0] && nh[1] === s.food[1]);
    var lim = eat ? s.snake.length : s.snake.length - 1;
    for (var i = 0; i < lim; i++) {
      if (s.snake[i][0] === nh[0] && s.snake[i][1] === nh[1]) return 'dead';
    }
    s.snake.unshift(nh);
    if (eat) {
      s.score += 10;
      s.food = freeCell(s);
      return 'eat';
    }
    s.snake.pop();
    return 'move';
  }
  function speed() { return Math.max(70, 150 - S.score); }

  function lerpPos(prev, cur, t) {
    return [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
  }
  function draw(now) {
    now = (now === undefined) ? performance.now() : now;
    var cv = document.getElementById('snk');
    if (!cv || !S) return;
    var g = cv.getContext('2d');
    g.fillStyle = '#08110C';
    g.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    /* umpan pulse */
    var pr = CELL / 2 - 2 + Math.sin(now / 180) * 2;
    g.fillStyle = '#E85D5D';
    g.beginPath();
    g.arc(S.food[0] * CELL + CELL / 2, S.food[1] * CELL + CELL / 2, Math.max(2, pr), 0, 7);
    g.fill();
    g.fillStyle = '#E85D5D88';
    g.beginPath();
    g.arc(S.food[0] * CELL + CELL / 2, S.food[1] * CELL + CELL / 2, Math.max(3, pr + 3), 0, 7);
    g.fill();
    /* badan interpolasi: prev -> cur sesuai waktu antar langkah */
    var t = S.prev ? Math.min(1, (now - S.stepAt) / S.stepMs) : 1;
    var n = S.snake.length;
    for (var i = n - 1; i >= 0; i--) {
      var cur = S.snake[i];
      var pv = (S.prev && S.prev[i]) ? S.prev[i] : cur;
      /* segmen baru (makan): tumbuh dari ekor lama */
      if (!S.prev || !S.prev[i]) pv = S.prev ? S.prev[S.prev.length - 1] : cur;
      var xy = lerpPos(pv, cur, t);
      g.fillStyle = i === 0 ? '#3DDC84' : (i % 2 ? '#2BA866' : '#27945A');
      g.fillRect(xy[0] * CELL + 1, xy[1] * CELL + 1, CELL - 2, CELL - 2);
    }
    /* mata kepala */
    var hc = lerpPos((S.prev && S.prev[0]) ? S.prev[0] : S.snake[0], S.snake[0], t);
    g.fillStyle = '#0C100E';
    var ex = hc[0] * CELL + CELL / 2 + S.dir[0] * 3, ey = hc[1] * CELL + CELL / 2 + S.dir[1] * 3;
    g.fillRect(ex - 3, ey - 1, 2, 2);
    g.fillRect(ex + 1, ey - 1, 2, 2);
  }
  function frame(id, now) {
    if (id !== gest || !S) return;
    draw(now || performance.now());
    if (S.alive) requestAnimationFrame(function(t) { frame(id, t); });
  }
  function loop(id) {
    if (id !== gest || !S || !S.alive) return;
    S.prev = S.snake.map(function(p) { return [p[0], p[1]]; });
    S.stepMs = speed();
    S.stepAt = performance.now();
    var r = advance(S);
    if (r === 'dead') return gameOver(id);
    if (r === 'eat') scorePop();
    setScore('Skor ' + S.score);
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
    /* flash merah + goyang, panel muncul 650ms kemudian */
    var cv = document.getElementById('snk');
    if (cv) cv.classList.add('dead');
    setTimeout(function() {
      if (id !== gest) return;
      showOver();
    }, 650);
  }
  function showOver() {
    var best = parseInt(gbestGet('g-snake-best', '0'), 10) || 0;
    if (S.score > best) { best = S.score; gbestSet('g-snake-best', best); }
    var b = document.getElementById('gbody');
    b.innerHTML = '<div class="gpanel"><div class="big">💀 Kalah!</div>' +
      '<div class="sub2">Skor: <b>' + S.score + '</b> • Terbaik: <b>' + best + '</b></div>' +
      '<button class="gbtn" id="snk-again">Main Lagi</button></div>';
    document.getElementById('snk-again').onclick = function() { start(); };
  }
  function turn(dx, dy) {
    if (!S || !S.alive) return;
    var last = S.queue.length ? S.queue[S.queue.length - 1] : S.dir;
    if (S.queue.length < 3 && !(dx === -last[0] && dy === -last[1]) && !(dx === last[0] && dy === last[1])) {
      S.queue.push([dx, dy]);
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
    setScore('Skor 0');
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
