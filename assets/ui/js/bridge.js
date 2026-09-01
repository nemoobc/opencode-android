/* ===== bridge.js — mock Android bridge (web mode) ===== */
if (typeof Android === 'undefined') {
  var OC_API = '';
  var _ocSession = null;
  var _ocRetries = 0;

  /* create session on load with retry */
  function createSession() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', OC_API + '/api/session', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { _ocSession = JSON.parse(xhr.responseText).data.id; } catch(e) {}
        console.log('[oc] session:', _ocSession);
        if (typeof window.onReady === 'function' && !_ocSession) window.onReady(false);
      } else {
        retrySession();
      }
    };
    xhr.onerror = function() { retrySession(); };
    xhr.send('{}');
  }
  function retrySession() {
    _ocRetries++;
    if (_ocRetries > 15) {
      console.error('[oc] server tidak terdeteksi di ' + OC_API);
      if (typeof window.onReady === 'function') window.onReady(false);
      return;
    }
    setTimeout(createSession, 2000);
  }
  createSession();

  window.Android = {
    send: function(t) {
      console.log('[web/send]', t);

      if (!_ocSession) {
        /* session belum ready, retry after delay */
        if (_ocRetries > 15) {
          if (typeof window.onDone === 'function') window.onDone(1);
          return 0;
        }
        setTimeout(function() { window.Android.send(t); }, 1500);
        return 0;
      }

      /* send to real OpenCode server */
      var xhr = new XMLHttpRequest();
      xhr.open('POST', OC_API + '/api/session/' + _ocSession + '/prompt', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status === 200) {
          /* poll for assistant response */
          pollMessages();
        } else {
          console.error('[oc] prompt error:', xhr.status);
          if (typeof window.onDone === 'function') window.onDone(1);
        }
      };
      xhr.onerror = function() {
        console.error('[oc] network error');
        if (typeof window.onDone === 'function') window.onDone(1);
      };
      xhr.send(JSON.stringify({ prompt: { text: t } }));

      function pollMessages() {
        var tries = 0;
        var interval = setInterval(function() {
          tries++;
          if (tries > 60) { clearInterval(interval); if (typeof window.onDone === 'function') window.onDone(1); return; }
          var mxhr = new XMLHttpRequest();
          mxhr.open('GET', OC_API + '/api/session/' + _ocSession + '/message', true);
          mxhr.onload = function() {
            if (mxhr.status === 200) {
              try {
                var msgs = JSON.parse(mxhr.responseText).data;
                var assistant = null;
                for (var i = msgs.length - 1; i >= 0; i--) {
                  if (msgs[i].type === 'assistant') { assistant = msgs[i]; break; }
                }
                if (assistant && assistant.content) {
                  clearInterval(interval);
                  var text = '';
                  for (var j = 0; j < assistant.content.length; j++) {
                    if (assistant.content[j].type === 'text') text += assistant.content[j].text;
                  }
                  if (text && typeof window.appendOut === 'function') {
                    /* stream word by word */
                    var words = text.split(' ');
                    var wi = 0;
                    var si = setInterval(function() {
                      if (wi < words.length) {
                        window.appendOut(words[wi] + ' ');
                        wi++;
                      } else {
                        clearInterval(si);
                        if (typeof window.onDone === 'function') window.onDone(0);
                      }
                    }, 20);
                  } else {
                    if (typeof window.onDone === 'function') window.onDone(0);
                  }
                }
              } catch(e) {}
            }
          };
          mxhr.send();
        }, 800);
      }

      return 0;
    },
    cancel: function() {
      if (_ocSession) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', OC_API + '/api/session/' + _ocSession + '/interrupt', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send('{}');
      }
    },
    copyText: function(t) { navigator.clipboard.writeText(t).catch(function(){}); },
    openUrl: function(u) { window.open(u, '_blank'); },
    newChat: function() {
      /* create fresh session */
      _ocSession = null;
      _ocRetries = 0;
      createSession();
    },
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
  /* simulate loading progress for web — 6s splash then overlay */
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
    /* wait 6 seconds for logo animation */
    setTimeout(function(){
      /* force splash gone — instant remove */
      var sp = document.getElementById('splash');
      if (sp) {
        sp.style.transition = 'none';
        sp.style.opacity = '0';
        sp.style.pointerEvents = 'none';
        sp.style.zIndex = '0';
        if (sp.parentNode) sp.parentNode.removeChild(sp);
      }
      /* show overlay immediately */
      ov.classList.add('show');
      var interval = setInterval(function(){
        var jump = Math.floor(Math.random()*8) + 4;
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
      }, 120);
    }, 6000);
  })();
}
