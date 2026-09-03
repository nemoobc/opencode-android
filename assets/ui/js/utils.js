/* ===== utils.js — esc, toast, mdRender, AVA_SVG, addMsg, addNote, addActions, encrypt/decrypt ===== */
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(t) {
  var el = document.getElementById('toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(window._tt); window._tt = setTimeout(function(){ el.classList.remove('show'); }, 2200);
}

/* ===== XOR encryption for backup ===== */
function xorEncrypt(text, password) {
  var out = '';
  for (var i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return btoa(unescape(encodeURIComponent(out)));
}
function xorDecrypt(b64, password) {
  try {
    var text = decodeURIComponent(escape(atob(b64)));
    var out = '';
    for (var i = 0; i < text.length; i++) {
      out += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
    }
    return out;
  } catch (e) { return null; }
}

/* ===== markdown mini renderer ===== */
function mdRender(src) {
  var blocks = [];
  var txt = esc(src);
  txt = txt.replace(/```(\w*)\n?([\s\S]*?)```/g, function(m, lang, code) {
    var i = blocks.length;
    blocks.push({lang: lang || 'code', code: code.replace(/\n$/, '')});
    return '\u0000B' + i + '\u0000';
  });
  txt = txt.replace(/`([^`\n]+)`/g, '<code class="ic">$1</code>');
  txt = txt.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  txt = txt.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  txt = txt.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  txt = txt.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  txt = txt.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  txt = txt.replace(/^---$/gm, '<hr>');
  txt = txt.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  txt = txt.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  txt = txt.replace(/!\[([^\]]*)\]\((https?:[^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%;border-radius:8px;margin:8px 0">');
  txt = txt.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="#" data-url="$2">$1</a>');
  txt = txt.replace(/^\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.*\|\n?)*)/gm, function(m, head, body) {
    var hs = head.split('|').map(function(x){return x.trim();});
    var rows = body.trim().split('\n').map(function(r){return r.split('|').slice(1, -1).map(function(x){return x.trim();});});
    return '<table><thead><tr>' + hs.map(function(h){return '<th>'+h+'</th>';}).join('') + '</tr></thead><tbody>' +
      rows.map(function(r){return '<tr>' + r.map(function(c){return '<td>'+c+'</td>';}).join('') + '</tr>';}).join('') + '</tbody></table>';
  });
  txt = txt.replace(/^\s*[-*] (.*)$/gm, '\u0000U<li>$1</li>');
  txt = txt.replace(/^\s*[\u2022\u25AA\u25E6\u00B7]\s+(.*)$/gm, '\u0000U<li>$1</li>');
  txt = txt.replace(/^\s*[-–—]\s+(.*)$/gm, '\u0000U<li>$1</li>');
  txt = txt.replace(/^\s*\d+\. (.*)$/gm, '\u0000O<li>$1</li>');
  txt = txt.replace(/((?:\u0000[UO]<li>[\s\S]*?<\/li>)(?:\n\u0000[UO]<li>[\s\S]*?<\/li>)*)/g, function(m) {
    var tag = m.charAt(1) === 'U' ? 'ul' : 'ol';
    return '<' + tag + '>' + m.replace(/\u0000[UO]/g, '') + '</' + tag + '>';
  });
  txt = txt.split(/\n{2,}/).map(function(p) {
    p = p.trim();
    if (!p) return '';
    if (/^\u0000B/.test(p)) return p;
    var parts = p.split(/\n(?=<(?:h\d|ul|ol|table|blockquote|hr|\u0000B))/);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;
      if (/^<(h\d|ul|ol|table|blockquote|hr|\u0000)/.test(part) || /^\u0000B/.test(part)) out += part;
      else out += '<p>' + part.replace(/\n/g, '<br>') + '</p>';
    }
    return out;
  }).join('');
  /* sitasi [1][2]: bungkus TAPI jangan di dalam tag HTML (atribut aman)
     dan JANGAN di code block (masih placeholder di titik ini, aman). */
  txt = txt.split(/(<[^>]+>)/g).map(function(part, ix) {
    if (ix % 2 === 1) return part;
    return part.replace(/\[(\d+)\]/g, '<b class="cite hl">[$1]</b>');
  }).join('');
  txt = txt.replace(/\u0000B(\d+)\u0000/g, function(m, i) {
    var b = blocks[+i];
    return '<div class="cb"><div class="cb-h"><span class="lang">' + esc(b.lang) +
      '</span><button data-copy="' + escAttr(b.code) + '">COPY</button></div><pre><code>' +
      b.code.replace(/\[/g,'&#91;') + '</code></pre></div>';
  });
  return txt;
}

var AVA_SVG = '<svg viewBox="0 0 432 432"><g fill="none" stroke="#3DDC84" stroke-width="30" stroke-linecap="round"><path d="M132 84 H300 Q316 84 316 100 V196"/><path d="M316 268 V300 Q316 316 300 316 H100 Q84 316 84 300 V100 Q84 84 100 84"/></g><rect x="244" y="244" width="118" height="118" rx="16" fill="#C9A227" transform="rotate(0 303 303)"/></svg>';
function addMsg(kind) {
  killHello();
  var m = document.createElement('div');
  m.className = 'msg ' + kind;
  if (kind === 'ai') {
    m.innerHTML = '<div class="ava">' + AVA_SVG + '</div><div class="bw"><div class="body"></div></div>';
  } else {
    m.innerHTML = '<div class="body"></div>';
  }
  chat.appendChild(m);
  scrollEnd();
  return m.querySelector('.body');
}
function addNote(txt, isErr, canRetry) {
  killHello();
  var d = document.createElement('div');
  d.className = 'sysnote' + (isErr ? ' err' : '');
  d.textContent = txt;
  if (isErr && canRetry) {
    var rb = document.createElement('button');
    rb.className = 'retry-btn';
    rb.textContent = 'Coba lagi';
    rb.onclick = function() {
      if (busy || !window._lastPrompt) return;
      /* hapus semua error note lama supaya tidak nimpa */
      var old = chat.querySelectorAll('.sysnote.err');
      for (var i = 0; i < old.length; i++) old[i].remove();
      send(window._lastPrompt);
    };
    d.appendChild(rb);
  }
  chat.appendChild(d);
  scrollEnd();
}
function addActions(body, plain) {
  /* don't add duplicate actions */
  if (body.parentNode && body.parentNode.querySelector('.mact')) return;
  var d = document.createElement('div');
  d.className = 'mact';
  var b = document.createElement('button');
  var _copySvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var _checkSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  b.innerHTML = _copySvg + ' Salin';
  b.onclick = function() {
    Android.copyText(plain);
    b.innerHTML = _checkSvg + ' Tersalin';
    b.style.color = '#3DDC84';
    b.style.borderColor = '#3DDC8466';
    setTimeout(function() { b.innerHTML = _copySvg + ' Salin'; b.style.color = ''; b.style.borderColor = ''; }, 2000);
  };
  var r = document.createElement('button');
  r.innerHTML = '&#8635; Tanya lagi';
  r.onclick = function() {
    if (busy || !window._lastPrompt) return;
    /* disable both buttons to prevent double-click stacking */
    r.disabled = true; r.style.opacity = '0.4';
    b.disabled = true; b.style.opacity = '0.4';
    send(window._lastPrompt, null, null, true);
  };
  d.appendChild(b); d.appendChild(r);
  body.parentNode.appendChild(d);
}
