/* ===== g-quiz.js — quiz asah otak (bank soal ID + timer + streak) ===== */
(function() {
  var BANK = [
    { q: '2 + 3 × 4 = ?', opts: ['24', '14', '20', '18'], a: 1 },
    { q: 'Hewan mamalia yang bertelur?', opts: ['Kelelawar', 'Platipus', 'Paus', 'Kangguru'], a: 1 },
    { q: 'Ibukota Australia?', opts: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], a: 2 },
    { q: '1 lusin + 1 kodi = ?', opts: ['32', '24', '40', '30'], a: 0 },
    { q: 'Planet terdekat dari Matahari?', opts: ['Venus', 'Mars', 'Bumi', 'Merkurius'], a: 3 },
    { q: 'Semua kucing berekor. Tom adalah kucing. Maka...', opts: ['Tom tidak berekor', 'Tom berekor', 'Tom bukan hewan', 'Tidak bisa disimpulkan'], a: 1 },
    { q: 'Bahasa resmi negara Brasil?', opts: ['Spanyol', 'Portugis', 'Inggris', 'Prancis'], a: 1 },
    { q: '1000+40+1000+30+1000+20+1000+10 = ?', opts: ['5000', '4100', '4010', '4110'], a: 1 },
    { q: 'Unsur kimia dengan simbol O?', opts: ['Emas', 'Oksigen', 'Perak', 'Osmium'], a: 1 },
    { q: 'Indonesia merdeka tahun?', opts: ['1944', '1945', '1946', '1949'], a: 1 },
    { q: 'Lanjutan deret: 2, 4, 8, 16, ...?', opts: ['20', '24', '32', '30'], a: 2 },
    { q: 'Huruf ke-7 abjad A-Z?', opts: ['F', 'G', 'H', 'E'], a: 1 },
    { q: '7 × 8 = ?', opts: ['54', '56', '48', '64'], a: 1 },
    { q: 'Warna primer cahaya?', opts: ['Merah, kuning, biru', 'Merah, hijau, biru', 'Cyan, magenta, hitam', 'Putih, hitam, abu'], a: 1 },
    { q: 'Ada 3 apel, kamu ambil 2. Berapa apel yang kamu punya?', opts: ['1', '2', '3', '0'], a: 1 }
  ];
  var TIME = 15;
  var timer = null, gest = 0;
  var Q = null;

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function grade(score, max) {
    var r = max > 0 ? score / max : 0;
    if (r >= 0.85) return 'S — Jenius!';
    if (r >= 0.7) return 'A — Hebat!';
    if (r >= 0.5) return 'B — Lumayan';
    if (r >= 0.3) return 'C — Latihan lagi';
    return 'D — Coba lagi';
  }
  function start() {
    stop();
    var id = ++gest;
    var order = shuffled(BANK.map(function(_, i) { return i; }));
    Q = { order: order, idx: 0, score: 0, correct: 0, streak: 0, left: TIME, lock: false };
    renderQ(id);
  }
  function renderQ(id) {
    if (id !== gest || !Q) return;
    if (Q.idx >= Q.order.length) return finish(id);
    var item = BANK[Q.order[Q.idx]];
    var opts = shuffled(item.opts.map(function(t, i) { return { t: t, ok: i === item.a }; }));
    Q.cur = opts;
    Q.left = TIME;
    Q.lock = false;
    var b = document.getElementById('gbody');
    var html = '<div class="qprog">Soal ' + (Q.idx + 1) + ' / ' + Q.order.length + '</div>' +
      '<div class="qbar"><i id="qfill"></i></div>' +
      '<div class="qq">' + escHtml(item.q) + '</div>' +
      '<div class="qopts">' + opts.map(function(o, i) {
        return '<button class="qopt" data-i="' + i + '">' + escHtml(o.t) + '</button>';
      }).join('') + '</div>' +
      '<div class="qstreak" id="qstreak">' + (Q.streak > 1 ? '🔥 Streak ×' + Q.streak : '') + '</div>';
    b.innerHTML = html;
    setScore('Skor ' + Q.score);
    b.querySelectorAll('.qopt').forEach(function(btn) {
      btn.onclick = function() { answer(id, parseInt(btn.getAttribute('data-i'), 10)); };
    });
    clearInterval(timer);
    var t0 = Date.now();
    timer = setInterval(function() {
      if (id !== gest || !Q || Q.lock) return;
      Q.left = Math.max(0, TIME - (Date.now() - t0) / 1000);
      var f = document.getElementById('qfill');
      if (f) f.style.width = (Q.left / TIME * 100) + '%';
      if (Q.left <= 0) answer(id, -1);
    }, 100);
  }
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function setScore(t) {
    var e = document.getElementById('gscore');
    if (e) e.textContent = t;
  }
  function answer(id, i) {
    if (id !== gest || !Q || Q.lock) return;
    Q.lock = true;
    clearInterval(timer);
    var b = document.getElementById('gbody');
    var btns = b.querySelectorAll('.qopt');
    var good = i >= 0 && Q.cur[i] && Q.cur[i].ok;
    btns.forEach(function(btn, bi) {
      btn.disabled = true;
      if (Q.cur[bi].ok) btn.classList.add('right');
      else if (bi === i) btn.classList.add('wrong');
    });
    if (good) {
      Q.correct++;
      Q.streak++;
      Q.score += 100 + Math.round(Q.left) * 10 + (Q.streak - 1) * 25;
      setScore('Skor ' + Q.score);
    } else {
      Q.streak = 0;
    }
    Q.idx++;
    setTimeout(function() { renderQ(id); }, 1200);
  }
  function finish(id) {
    if (id !== gest || !Q) return;
    clearInterval(timer);
    var max = Q.order.length * (100 + 150 + 14 * 25);
    var best = parseInt(gbestGet('g-quiz-best', '0'), 10) || 0;
    if (Q.score > best) { best = Q.score; gbestSet('g-quiz-best', best); }
    var b = document.getElementById('gbody');
    b.innerHTML = '<div class="gpanel"><div class="big">🏁 ' + grade(Q.score, max) + '</div>' +
      '<div class="sub2">Benar <b>' + Q.correct + '/' + Q.order.length + '</b> • Skor <b>' + Q.score + '</b> • Terbaik <b>' + best + '</b></div>' +
      '<button class="gbtn" id="qz-again">Main Lagi</button></div>';
    document.getElementById('qz-again').onclick = function() { start(); };
  }
  function stop() {
    gest++;
    if (timer) { clearInterval(timer); timer = null; }
    Q = null;
  }
  window.Games.reg('quiz', { start: start, stop: stop });
  window.Games.QUIZ = { BANK: BANK, grade: grade };
})();
