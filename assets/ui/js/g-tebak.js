/* ===== g-tebak.js — Tebak Kata ala Cak Lontong (warna-warni) =====
   20 teka-teki absurd. Ketik jawaban (fuzzy), Hint kurangi poin, Lewati nol.
   10 ronde per main. Skor best tersimpan. */
(function() {
  var BANK = [
    { q: 'Hewan apa yang paling kaya?', a: ['beruang'] },
    { q: 'Ada bebek 10, ditembak 1. Sisa berapa?', a: ['0', 'nol', 'tidak ada', 'kabur', 'habis'] },
    { q: 'Apa yang naik tapi tidak pernah turun?', a: ['umur', 'usia'] },
    { q: 'Makin diambil makin besar. Apa?', a: ['lubang', 'lobang'] },
    { q: 'Punya leher tapi tidak punya kepala. Apa?', a: ['botol'] },
    { q: 'Jalan terus tapi tidak pernah sampai. Apa?', a: ['jam', 'waktu', 'jarum jam'] },
    { q: 'Selalu datang tapi tidak pernah tiba. Apa?', a: ['besok', 'hari esok', 'esok'] },
    { q: 'Makanan apa yang paling dingin?', a: ['es krim', 'eskrim', 'es'] },
    { q: 'Burung apa yang tidak bisa terbang tapi jago berenang?', a: ['pinguin', 'penguin', 'pingwin'] },
    { q: 'Apa yang punya kunci tapi tidak bisa buka pintu?', a: ['piano', 'keyboard', 'kibor'] },
    { q: 'Dibuang saat dibutuhkan, diambil saat tidak dibutuhkan. Apa?', a: ['jangkar', 'sauh'] },
    { q: 'Apa yang basah saat mengeringkan?', a: ['handuk', 'towel'] },
    { q: 'Makin kamu ambil, makin banyak yang tertinggal di belakangmu?', a: ['langkah', 'jejak'] },
    { q: 'Aku punya kota tapi tidak punya rumah, punya gunung tapi tidak punya pohon. Apa aku?', a: ['peta'] },
    { q: 'Apa yang bisa menembus kaca tanpa memecahkannya?', a: ['cahaya', 'sinar', 'cahaya matahari', 'matahari'] },
    { q: 'Kunci apa yang tidak bisa membuka apa pun?', a: ['kunci jawaban', 'jawaban'] },
    { q: 'Apa yang selalu ada di depanmu tapi tidak bisa kamu lihat?', a: ['masa depan'] },
    { q: 'Benda apa yang makin dipukul makin bunyi?', a: ['gendang', 'drum', 'bedug', 'beduk'] },
    { q: 'Apa yang punya banyak gigi tapi tidak bisa makan?', a: ['gergaji', 'sisir'] },
    { q: 'Apa yang kalau diucapkan justru hilang?', a: ['hening', 'diam', 'sunyi', 'keheningan'] }
  ];
  var QUIPS = [
    'Jawab yang bener, jangan asal!',
    'Salah? Wajar. Saya juga sering.',
    'Pikir dulu... jangan buru-buru.',
    'Gampang ini, masa ga bisa.',
    'Tenang, mikir sambil ngopi.'
  ];
  var COLORS = ['#3DDC84', '#6EC6FF', '#E8D9A0', '#E08A7B', '#C9A227', '#9B7FE8'];
  var ROUNDS = 10;
  var timers = [], gest = 0;
  var G = null; /* {order, idx, score, correct, streak, wrong, hints, hintShown} */

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }
  /* cocok longgar: sama persis ATAU saling mengandung (min 3 char) */
  function match(input, accepted) {
    var ni = norm(input);
    if (!ni) return false;
    for (var i = 0; i < accepted.length; i++) {
      var na = norm(accepted[i]);
      if (!na) continue;
      if (ni === na) return true;
      if (na.length >= 3 && ni.indexOf(na) >= 0) return true;
      if (ni.length >= 3 && na.indexOf(ni) >= 0) return true;
    }
    return false;
  }
  function mask(ans, shown) {
    var clean = norm(ans).replace(/ /g, '');
    var out = '';
    for (var i = 0; i < clean.length; i++) {
      out += (i < shown ? clean[i] : '_') + ' ';
    }
    return out.trim() + '  (' + clean.length + ' huruf)';
  }
  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function setScore() {
    var e = document.getElementById('gscore');
    if (e) e.textContent = 'Skor ' + G.score;
  }
  function start() {
    stop();
    var id = ++gest;
    G = { order: shuffled(BANK.map(function(_, i) { return i; })).slice(0, ROUNDS),
      idx: 0, score: 0, correct: 0, streak: 0, wrong: 0, hints: 0, hintShown: 0 };
    render(id);
  }
  function render(id) {
    if (id !== gest || !G) return;
    if (G.idx >= G.order.length) return finish(id);
    var item = BANK[G.order[G.idx]];
    var col = COLORS[G.idx % COLORS.length];
    var b = document.getElementById('gbody');
    b.innerHTML =
      '<div class="qprog">Tebakan ' + (G.idx + 1) + ' / ' + G.order.length + '</div>' +
      '<div class="tkcard" style="border-color:' + col + '66">' +
      '<div class="tkq">' + escHtml(item.q) + '</div>' +
      '<div class="tkquip">' + QUIPS[Math.floor(Math.random() * QUIPS.length)] + '</div>' +
      '<div class="tkhint" id="tkhint">' + (G.hintShown > 0 ? mask(item.a[0], G.hintShown) : '') + '</div>' +
      '</div>' +
      '<input class="tkin" id="tkin" placeholder="Ketik jawaban..." autocomplete="off">' +
      '<div class="tkrow"><button class="gbtn" id="tk-go">Jawab</button>' +
      '<button class="gbtn ghost2" id="tk-hint">💡 Hint</button>' +
      '<button class="gbtn ghost2" id="tk-skip">Lewati</button></div>' +
      '<div class="qstreak" id="tk-msg"></div>';
    setScore('Skor ' + G.score);
    var inp = document.getElementById('tkin');
    try { inp.focus(); } catch (e) {}
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); answer(id); }
    });
    document.getElementById('tk-go').onclick = function() { answer(id); };
    document.getElementById('tk-hint').onclick = function() { hint(id); };
    document.getElementById('tk-skip').onclick = function() { skip(id); };
  }
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function msg(t, good) {
    var e = document.getElementById('tk-msg');
    if (!e) return;
    e.textContent = t;
    e.style.color = good ? '#7FCF9F' : '';
    e.classList.remove('hot');
    void e.offsetWidth;
    if (good) e.classList.add('hot');
  }
  function answer(id) {
    if (id !== gest || !G) return;
    var inp = document.getElementById('tkin');
    if (!inp) return;
    var item = BANK[G.order[G.idx]];
    if (match(inp.value, item.a)) {
      G.correct++;
      G.streak++;
      var pts = Math.max(10, 100 + (G.streak - 1) * 20 - G.hints * 20);
      G.score += pts;
      setScore('Skor ' + G.score);
      msg('✅ Bener! +' + pts + (G.streak > 1 ? ' 🔥×' + G.streak : ''), true);
      G.idx++; G.wrong = 0; G.hints = 0; G.hintShown = 0;
      var nid = id;
      timers.push(setTimeout(function() { render(nid); }, 900));
    } else {
      G.wrong++;
      G.streak = 0;
      inp.classList.remove('shakex');
      void inp.offsetWidth;
      inp.classList.add('shakex');
      if (G.wrong >= 3) {
        msg('❌ Jawabannya: ' + item.a[0].toUpperCase());
        G.idx++; G.wrong = 0; G.hints = 0; G.hintShown = 0;
        var nid2 = id;
        timers.push(setTimeout(function() { render(nid2); }, 1800));
      } else {
        msg('❌ Kurang tepat! (' + G.wrong + '/3)');
      }
    }
  }
  function hint(id) {
    if (id !== gest || !G) return;
    var item = BANK[G.order[G.idx]];
    var clean = norm(item.a[0]).replace(/ /g, '');
    if (G.hintShown >= clean.length) return;
    G.hintShown++;
    G.hints++;
    var e = document.getElementById('tkhint');
    if (e) e.textContent = mask(item.a[0], G.hintShown);
  }
  function skip(id) {
    if (id !== gest || !G) return;
    G.streak = 0;
    G.idx++; G.wrong = 0; G.hints = 0; G.hintShown = 0;
    render(id);
  }
  function finish(id) {
    if (id !== gest || !G) return;
    var max = G.order.length;
    var best = parseInt(gbestGet('g-tebak-best', '0'), 10) || 0;
    if (G.score > best) { best = G.score; gbestSet('g-tebak-best', best); }
    var b = document.getElementById('gbody');
    b.innerHTML = '<div class="gpanel"><div class="big">🎭 ' +
      (G.correct >= 8 ? 'S — Master!' : (G.correct >= 6 ? 'A — Hebat!' : (G.correct >= 4 ? 'B — Lumayan' : 'C — Latihan lagi'))) + '</div>' +
      '<div class="sub2">Benar <b>' + G.correct + '/' + max + '</b> • Skor <b>' + G.score + '</b> • Terbaik <b>' + best + '</b></div>' +
      '<button class="gbtn" id="tk-again">Main Lagi</button> <button class="gbtn ghost2" id="tk-menu">Menu</button></div>';
    document.getElementById('tk-again').onclick = function() { start(); };
    document.getElementById('tk-menu').onclick = function() { showGMenu(); };
  }
  function stop() {
    gest++;
    for (var i = 0; i < timers.length; i++) {
      try { clearTimeout(timers[i]); clearInterval(timers[i]); } catch (e) {}
    }
    timers = [];
    G = null;
  }
  window.Games.reg('tebak', { start: start, stop: stop });
  window.Games.TEBAK = { BANK: BANK, norm: norm, match: match, mask: mask };
})();
