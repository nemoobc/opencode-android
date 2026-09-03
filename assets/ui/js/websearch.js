/* ===== websearch.js — DuckDuckGo HTML real-time search ===== */

var WebSearch = (function() {
  var DDG_URL = 'https://html.duckduckgo.com/html/';
  var MAX_RESULTS = 5;
  var _enabled = localStorage.getItem('oc-websearch') === 'true';
  var _lastResults = [];

  /**
   * Search DuckDuckGo HTML endpoint (no API key needed)
   * @param {string} query - search query
   * @returns {Promise<Array<{title:string, url:string, snippet:string}>>}
   */
  function searchDDG(query) {
    return new Promise(function(resolve) {
      /* native bridge (aplikasi Android): HTTP langsung via Java,
         tanpa CORS/proxy — file:// tidak punya origin valid. */
      try {
        if (typeof Android !== 'undefined' && Android && typeof Android.webSearch === 'function') {
          var arr = JSON.parse(Android.webSearch(query) || '[]');
          resolve(normalizeNative(arr));
          return;
        }
      } catch (e) { /* jatuh ke fallback */ }
      /* web-mode fallback: local proxy (browser testing) */
      try {
        var proxyUrl = location.origin + '/api/search';
        var body = 'q=' + encodeURIComponent(query);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', proxyUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.timeout = 10000;
        xhr.onload = function() {
          if (xhr.status === 200) {
            resolve(parseResults(xhr.responseText));
          } else {
            resolve([]);
          }
        };
        xhr.onerror = function() { resolve([]); };
        xhr.ontimeout = function() { resolve([]); };
        xhr.send(body);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Normalize hasil native Java [{t,u,s}] → [{title,url,snippet}]
   */
  function normalizeNative(arr) {
    var out = [];
    try {
      for (var i = 0; i < arr.length && out.length < MAX_RESULTS; i++) {
        var r = arr[i] || {};
        var title = String(r.t || '').trim();
        var url = String(r.u || '');
        if (title && url.indexOf('http') === 0) {
          out.push({ title: title, url: url, snippet: String(r.s || '') });
        }
      }
    } catch (e) { /* abaikan */ }
    return out;
  }

  /**
   * Parse DuckDuckGo HTML results
   * Results are in .result nodes with .result__a (link) and .result__snippet
   */
  function parseResults(html) {
    var results = [];
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var nodes = doc.querySelectorAll('.result');

      for (var i = 0; i < nodes.length && results.length < MAX_RESULTS; i++) {
        var linkEl = nodes[i].querySelector('.result__a');
        var snippetEl = nodes[i].querySelector('.result__snippet');
        if (!linkEl) continue;

        var title = (linkEl.textContent || '').trim();
        var href = linkEl.getAttribute('href') || '';
        var snippet = snippetEl ? (snippetEl.textContent || '').trim() : '';

        /* DDG wraps links as /l/?uddg=<encoded url> */
        var url = decodeUDDG(href);

        if (title && url && url.indexOf('http') === 0) {
          results.push({ title: title, url: url, snippet: snippet });
        }
      }
    } catch (e) {
      /* parse error — return empty */
    }
    return results;
  }

  /**
   * Decode DuckDuckGo redirect URL
   * /l/?uddg=https%3A%2F%2Fexample.com → https://example.com
   */
  function decodeUDDG(href) {
    if (!href) return '';
    try {
      if (href.indexOf('/l/?uddg=') >= 0) {
        var encoded = href.split('uddg=')[1];
        if (encoded) {
          /* remove trailing suffix like &rut=... */
          var ampIdx = encoded.indexOf('&');
          if (ampIdx > 0) encoded = encoded.substring(0, ampIdx);
          return decodeURIComponent(encoded);
        }
      }
      /* already absolute URL */
      if (href.indexOf('http') === 0) return href;
    } catch (e) {}
    return href;
  }

  /**
   * Sanitize search query — strip conversational prefixes
   * "cari di web siapa presiden Indonesia" → "presiden Indonesia"
   */
  function sanitizeQuery(text) {
    var q = String(text).trim();
    var prefixes = [
      /^(cari\s+(di\s+)?web\s+)/i,
      /^(search\s+(for\s+|on\s+web\s+|google\s+)?)/i,
      /^(google\s+)/i,
      /^(tanya\s+ke\s+web\s+)/i,
      /^(cek\s+di\s+internet\s+)/i,
      /^(look\s+up\s+)/i,
      /^(find\s+out\s+)/i
    ];
    for (var i = 0; i < prefixes.length; i++) {
      q = q.replace(prefixes[i], '');
    }
    return q.trim();
  }

  /**
   * Check if a query likely needs web search
   * Returns true for queries that mention current/recent things
   */
  function needsSearch(text) {
    var t = String(text).toLowerCase();
    var keywords = [
      'hari ini', 'today', 'now', 'sekarang', 'terbaru', 'latest',
      'terkini', 'current', 'baru saja', 'just released', '2024', '2025', '2026',
      'harga', 'price', 'kurs', 'exchange rate', 'cuaca', 'weather',
      'berita', 'news', 'terupdate', 'update', 'real-time', 'live',
      'siapa presiden', 'who is the president', 'pemenang', 'winner',
      'skor', 'score', 'hasil', 'result', 'jadwal', 'schedule'
    ];
    for (var i = 0; i < keywords.length; i++) {
      if (t.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  /**
   * Build enriched prompt with search context
   */
  function buildPrompt(originalQuery, searchResults) {
    if (!searchResults || !searchResults.length) return originalQuery;

    var ctx = '[KONTEKS PENCARIAN WEB — sumber terverifikasi]\n\n';
    for (var i = 0; i < searchResults.length; i++) {
      var r = searchResults[i];
      ctx += '[' + (i + 1) + '] ' + r.title + '\n';
      ctx += '   URL: ' + r.url + '\n';
      if (r.snippet) ctx += '   ' + r.snippet + '\n';
      ctx += '\n';
    }
    ctx += 'ATURAN SITASI: kalau memakai info dari sumber di atas, cantumkan nomornya seperti [1] atau [2] langsung di kalimat jawaban. Contoh: "Harga emas hari ini naik [1]."\n\n';
    ctx += 'Pertanyaan user: ' + originalQuery;
    return ctx;
  }

  /**
   * Build source footer for AI response
   */
  function buildSourcesHTML() {
    if (!_lastResults.length) return '';
    /* daftar bernomor vertikal — nomornya nyambung ke sitasi [1][2] di jawaban.
       data-url (bukan href) supaya tap dibuka via Android.openUrl. */
    var html = '<div class="search-sources"><div class="src-label">🌐 Sumber:</div>';
    for (var i = 0; i < _lastResults.length; i++) {
      var r = _lastResults[i];
      var shortTitle = r.title.length > 45 ? r.title.substring(0, 45) + '...' : r.title;
      html += '<a class="src-link" href="#" data-url="' + esc(r.url) + '"><b>[' + (i + 1) + ']</b> ' + esc(shortTitle) + '</a>';
    }
    html += '</div>';
    return html;
  }

  /* simple HTML escape */
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ===== Public API ===== */
  return {
    get enabled() { return _enabled; },
    set enabled(v) {
      _enabled = !!v;
      localStorage.setItem('oc-websearch', _enabled ? 'true' : 'false');
    },
    toggle: function() {
      _enabled = !_enabled;
      localStorage.setItem('oc-websearch', _enabled ? 'true' : 'false');
      return _enabled;
    },
    search: searchDDG,
    sanitizeQuery: sanitizeQuery,
    needsSearch: needsSearch,
    buildPrompt: buildPrompt,
    buildSourcesHTML: buildSourcesHTML,
    get lastResults() { return _lastResults; },
    set lastResults(v) { _lastResults = v || []; }
  };
})();
