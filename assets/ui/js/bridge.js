/* ===== bridge.js — mock Android bridge (web mode) ===== */
if (typeof Android === 'undefined') {
  window.Android = {
    send: function(t) {
      console.log('[web/send]', t);
      /* simulate AI response after delay */
      setTimeout(function() {
        var snippets = [
          'Ini adalah contoh balasan dari **OpenCode Web Preview**.\n\nKarena ini versi web demo, AI asli tidak tersedia. Untuk fitur lengkap dengan AI real-time, gunakan versi Android APK.',
          '**Fitur Web Preview:**\n\n- ✅ UI lengkap seperti versi Android\n- ✅ Splash screen & loading animation\n- ✅ Drawer dengan riwayat obrolan\n- ✅ Model switcher (9 model gratis)\n- ✅ Toggle pencarian web\n- ❌ AI response (butuh server)\n\nUnduh APK untuk fitur lengkap!',
          'Halo! 👋\n\nSaya adalah **OpenCode**, asisten AI yang berjalan di Android.\n\nVersi web ini hanya untuk **preview UI**. Untuk pengalaman lengkap:\n\n1. Unduh APK dari GitHub Releases\n2. Install di Android\n3. Mulai chat dengan AI real-time\n\nApakah ada yang bisa saya bantu untuk versi UI ini?'
        ];
        var reply = snippets[Math.floor(Math.random() * snippets.length)];
        if (typeof window.appendOut === 'function') {
          /* simulate streaming */
          var words = reply.split(' ');
          var i = 0;
          var streamInterval = setInterval(function() {
            if (i < words.length) {
              window.appendOut(words[i] + ' ');
              i++;
            } else {
              clearInterval(streamInterval);
              if (typeof window.onDone === 'function') window.onDone(0);
            }
          }, 30);
        }
      }, 800);
      return 0;
    },
    cancel: function() { console.log('[web/cancel]'); },
    copyText: function(t) { navigator.clipboard.writeText(t).catch(function(){}); },
    openUrl: function(u) { window.open(u, '_blank'); },
    newChat: function() { console.log('[web/newChat]'); },
    checkUpdate: function() { console.log('[web/checkUpdate] no-op'); },
    saveConfig: function(p, k, m) { localStorage.setItem('oc-cfg', JSON.stringify({provider:p,key:k,model:m})); },
    readConfig: function() { return localStorage.getItem('oc-cfg') || '{}'; },
    fetchModels: function() { console.log('[web/fetchModels] no-op'); },
    pickFile: function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.onchange = function() {
        var f = input.files[0];
        if (f) window.onFileReady(f.name, f.name);
      };
      input.click();
    },
    readImageDataUrl: function(p) { return null; },
    appInfo: function() { return 'web-1.0'; }
  };
  /* simulate loading progress for web */
  (function(){
    var pfill = document.getElementById('pfill');
    var pnum = document.getElementById('pnum');
    var ov = document.getElementById('ov');
    var ovP = document.getElementById('ovp');
    if (!ov) return;
    var TOTAL_FILES = 555;
    var TOTAL_MB = 16;
    var TOTAL_BYTES = 16332800;
    var steps = [
      {t:'Memuat assets...'},
      {t:'Inisialisasi model...'},
      {t:'Menyiapkan workspace...'},
      {t:'Menghubungkan server...'},
      {t:'Hampir selesai...'},
      {t:'Siap!'}
    ];
    var fileI = 0;
    var bytes = 0;
    var stepI = 0;
    var interval = setInterval(function(){
      var jump = Math.floor(Math.random()*4) + 1;
      fileI = Math.min(TOTAL_FILES, fileI + jump);
      bytes = Math.min(TOTAL_BYTES, bytes + jump * (TOTAL_BYTES / TOTAL_FILES));
      var mb = bytes / 1048576;
      var pct = Math.round((bytes / TOTAL_BYTES) * 100);
      if (pfill) pfill.style.width = pct + '%';
      if (pnum) pnum.textContent = mb.toFixed(1) + ' / ' + TOTAL_MB + ' MB (' + pct + '%)';
      if (stepI < steps.length && pct >= (stepI + 1) * (100 / steps.length)) {
        if (ovP) ovP.textContent = steps[stepI].t;
        stepI++;
      }
      if (pct >= 100) {
        clearInterval(interval);
        if (ovP) ovP.textContent = 'Siap!';
        setTimeout(function(){
          ov.classList.remove('show');
          if (typeof window.onReady === 'function') window.onReady(true, true);
        }, 400);
      }
    }, 80);
  })();
}
