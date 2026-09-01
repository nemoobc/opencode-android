/* ===== bridge.js — Android/Web bridge ===== */
(function() {
  'use strict';

  /* Android mode — native Bridge class provides window.Android */
  if (typeof Android !== 'undefined') {
    return; /* native bridge ready, do nothing */
  }

  /* Web mode — mock Android bridge for browser testing */
  var OC_API = '';
  var _ocSession = null;
  var _ocRetries = 0;

  function createSession() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', OC_API + '/api/session', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { _ocSession = JSON.parse(xhr.responseText).data.id; } catch(e) {}
        console.log('[oc] session:', _ocSession);
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
      console.error('[oc] server tidak terdeteksi');
      return;
    }
    setTimeout(createSession, 2000);
  }
  createSession();

  window.Android = {
    send: function(t) {
      if (!_ocSession) {
        if (_ocRetries > 15) { if (typeof window.onDone === 'function') window.onDone(1); return 0; }
        setTimeout(function() { window.Android.send(t); }, 1500);
        return 0;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', OC_API + '/api/session/' + _ocSession + '/prompt', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status === 200) { pollMessages(); }
        else { if (typeof window.onDone === 'function') window.onDone(1); }
      };
      xhr.onerror = function() { if (typeof window.onDone === 'function') window.onDone(1); };
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
                for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i].type === 'assistant') { assistant = msgs[i]; break; } }
                if (assistant && assistant.content) {
                  clearInterval(interval);
                  var text = '';
                  for (var j = 0; j < assistant.content.length; j++) { if (assistant.content[j].type === 'text') text += assistant.content[j].text; }
                  if (text && typeof window.appendOut === 'function') {
                    var words = text.split(' '), wi = 0;
                    var si = setInterval(function() { if (wi < words.length) { window.appendOut(words[wi] + ' '); wi++; } else { clearInterval(si); if (typeof window.onDone === 'function') window.onDone(0); } }, 20);
                  } else { if (typeof window.onDone === 'function') window.onDone(0); }
                }
              } catch(e) {}
            }
          };
          mxhr.send();
        }, 800);
      }
      return 0;
    },
    cancel: function() { if (_ocSession) { var xhr = new XMLHttpRequest(); xhr.open('POST', OC_API + '/api/session/' + _ocSession + '/interrupt', true); xhr.setRequestHeader('Content-Type', 'application/json'); xhr.send('{}'); } },
    copyText: function(t) { navigator.clipboard.writeText(t).catch(function(){}); },
    openUrl: function(u) { window.open(u, '_blank'); },
    newChat: function() { _ocSession = null; _ocRetries = 0; createSession(); },
    checkUpdate: function() {},
    saveConfig: function(p, k, m) { localStorage.setItem('oc-cfg', JSON.stringify({provider:p,key:k,model:m})); },
    readConfig: function() { return localStorage.getItem('oc-cfg') || '{}'; },
    fetchModels: function() {},
    pickFile: function() { var input = document.createElement('input'); input.type = 'file'; input.onchange = function() { var f = input.files[0]; if (f) window.onFileReady(f.name, f.name); }; input.click(); },
    readImageDataUrl: function(p) { return null; },
    appInfo: function() { return 'web-1.0'; }
  };

  /* web mode splash - simple 6s then fade */
  setTimeout(function() {
    var sp = document.getElementById('splash');
    if (sp) { sp.classList.add('out'); setTimeout(function() { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 500); }
    if (typeof window.onReady === 'function') window.onReady(true, true);
  }, 6000);
})();
