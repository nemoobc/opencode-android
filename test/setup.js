/**
 * setup.js — shared JSDOM + vm sandbox setup for all tests
 * Provides all DOM elements, globals, and script loading for the app's JS files.
 */
import { JSDOM } from 'jsdom';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const ASSETS_DIR = path.resolve(new URL('../assets/ui', import.meta.url).pathname);
const JS_DIR = path.join(ASSETS_DIR, 'js');

// Full HTML skeleton matching index.html structure
const HTML = `<!DOCTYPE html>
<html><head></head><body>
  <div id="splash"><div class="stage"><div class="glow"></div><div class="mark"></div></div>
    <h2>OpenCode</h2><p>Memulai...</p>
    <div id="spbar"><div id="spfill"></div></div>
    <div id="spnum">0%</div></div>
  <div id="ov"><div class="stage"><div class="glow"></div><div class="mark"></div></div>
    <h2>OpenCode</h2><p>Memuat...</p>
    <div id="pring"></div><div id="ovready">Siap</div>
    <div id="pbar"><div id="pfill"></div></div>
    <div id="pnum">0%</div><p id="ovp"></p><p id="ovtime"></p>
    <div id="ovsteps"><span class="stp" id="st0"><i></i></span><span class="ln" id="ln0"></span><span class="stp" id="st1"><i></i></span><span class="ln" id="ln1"></span><span class="stp" id="st2"><i></i></span></div>
    <button id="ovretry">Coba</button></div>
  <header>
    <button class="hbtn" id="bmenu"></button>
    <button id="mchip"><div id="dot" class="ok"></div><span class="lbl" id="mname">Model</span><span class="car"></span></button>
    <div class="spacer"></div>
    <button class="hbtn" id="blang">🌐</button>
    <button class="hbtn" id="bnew">+</button>
  </header>
  <div id="ubanner"><span>Update </span><b id="utag"></b><button id="ubtn">Unduh</button></div>
  <div id="chatwrap"><div id="chat">
    <div id="hello">
      <div class="mark"></div>
      <h2>Open<span>Code</span></h2>
      <p>AI Assistant yang berjalan di perangkat Anda</p>
      <div class="ai-badge"><span class="dot"></span> <span id="abname">Model</span></div>
      <div id="chips">
        <div class="chip" data-q="test1"><b>C1</b>desc1</div>
        <div class="chip" data-q="test2"><b>C2</b>desc2</div>
        <div class="chip" data-q="test3"><b>C3</b>desc3</div>
        <div class="chip" data-q="test4"><b>C4</b>desc4</div>
      </div>
    </div>
  </div></div>
  <div id="bar">
    <div id="pill">
      <button id="battach"></button>
      <button id="bsearch"></button>
      <textarea id="inp" rows="1"></textarea>
      <button id="go"></button>
    </div>
    <div id="attachbar"><span id="att-name"></span><button id="att-x">✕</button><button id="att-send">➤</button></div>
    <div id="hint"></div>
  </div>
  <div id="down"></div>
  <div id="toast"></div>
  <div id="scrim"></div>
  <button id="bnotif">🔔<span id="ndot"></span></button>
  <div class="modal" id="mnotif"><div class="card"><div id="nlist"></div><button id="nclose">✕</button></div></div>
  <div class="modal" id="mdev"><div class="card">
    <div id="dev-lock"><p id="dev-msg"></p><input id="dev-pin" value=""><button id="dev-go">Buka</button><button id="dev-close">✕</button></div>
    <div id="dev-panel" style="display:none"><p id="dev-info"></p><p id="dev-notif"></p><button id="dev-refresh">R</button><button id="dev-close2">✕</button><p id="dev-nsec"></p><input id="dev-npin2" value=""><button id="dev-npinsave">Ganti</button><button id="dev-npinreset">Reset</button><button id="dev-nautolock">Auto</button></div>
  </div></div>
  <div id="drawer">
    <div class="d-head"><div class="mark"></div><div><b>OpenCode</b><span id="dver">v1.6.1</span></div></div>
    <div class="d-body">
      <button class="d-item primary" id="dnew">Mulai Baru</button>
      <button class="d-item" id="dmodel"><div class="ic">🤖</div>Ganti Model</button>
      <button class="d-item" id="dgame"><div class="ic">🎮</div>Game</button>
      <button class="d-item" id="dconfig"><div class="ic">⚙️</div>Konfigurasi API</button>
      <button class="d-item" id="dprivacy"><div class="ic">🎨</div>Tema & Privasi</button>
      <button class="d-item" id="dsource"><div class="ic">📜</div>Sumber Code</button>
      <button class="d-item" id="dupdate"><div class="ic">🔄</div>Cek Update</button>
      <div class="d-sep">RIWAYAT</div>
      <div id="hlist"></div>
    </div>
  </div>
  <!-- Model modal -->
  <div class="modal" id="mmodel">
    <div class="card">
      <button id="mclose">✕</button>
      <h3>Ganti Model</h3>
      <div id="mlist"></div>
      <input id="cmcustom" placeholder="Atau ketik model ID custom...">
    </div>
  </div>
  <!-- Language modal -->
  <div class="modal" id="mlang">
    <div class="card">
      <button id="lclose">✕</button>
      <h3>Bahasa Balasan</h3>
      <div id="llist"></div>
    </div>
  </div>
  <!-- Config modal -->
  <div class="modal" id="mconfig">
    <div class="card">
      <button id="closem">✕</button>
      <h3>Konfigurasi API</h3>
      <label>Provider</label><input id="cprov" value="">
      <label>API Key</label><input id="ckey" value="">
      <label>Model</label><input id="cmodel" value="">
      <div class="acts"><button class="ghost" id="cancelm">Batal</button><button class="bb" id="save">Simpan</button></div>
    </div>
  </div>
  <!-- Privacy modal -->
  <div class="modal" id="mprivacy">
    <div class="card">
      <button id="prclose">✕</button>
      <h3>Tema & Privasi</h3>
      <button class="d-item" id="btn-theme">🎨 Tema</button>
      <button class="d-item" id="btn-privacy">🔒 Privasi Data</button>
      <button class="d-item" id="pbackup">📥 Backup Riwayat</button>
      <button class="d-item" id="pimport">📤 Import Riwayat</button>
      <button class="d-item" id="pdelete">🗑️ Hapus Semua Riwayat</button>
    </div>
  </div>
  <!-- Theme modal -->
  <div class="modal" id="mtheme">
    <div class="card">
      <button id="thclose">✕</button>
      <h3>Pilih Tema</h3>
      <div id="thlist"></div>
    </div>
  </div>
  <!-- Privacy data modal -->
  <div class="modal" id="mprivdata">
    <div class="card">
      <button id="privclose">✕</button>
      <h3>Privasi Data</h3>
    </div>
  </div>
  <!-- Source modal -->
  <div class="modal" id="msource">
    <div class="card">
      <button id="sourceclose">✕</button>      <h3>Sumber Code</h3>
    </div>
  </div>
  <!-- History context menu -->
  <div class="hctx" id="hctx">
    <button class="hctx-item" id="hctx-pin">Sematkan</button>
    <button class="hctx-item" id="hctx-rename">Ubah Nama</button>
    <button class="hctx-item hctx-del" id="hctx-delete">Hapus</button>
  </div>
  <div class="hctx-scrim" id="hctx-scrim"></div>
  <!-- Rename modal -->
  <div class="modal" id="mrename">
    <div class="card">
      <button id="rnClose">✕</button>
      <h3>Ubah Nama Riwayat</h3>
      <input id="renameInput" value="">
      <div class="acts"><button class="bb" id="rnSave">Simpan</button></div>
    </div>
  </div>
  <!-- Games modal -->
  <div class="modal" id="mgames">
    <div class="card gcard">
      <div id="gmenu">
        <h3>GAME</h3>
        <div class="ggrid">
          <button class="gopt" data-g="tebak"><span class="gname">Tebak Kata</span><span class="gbest" id="gb-tebak"></span></button>
          <button class="gopt" data-g="quiz"><span class="gname">Quiz Otak</span><span class="gbest" id="gb-quiz"></span></button>
          <button class="gopt" data-g="puzzle"><span class="gname">Puzzle</span><span class="gbest" id="gb-puzzle"></span></button>
          <button class="gopt" data-g="ludo"><span class="gname">Ludo</span><span class="gbest" id="gb-ludo"></span></button>
          <button class="gopt" data-g="tic"><span class="gname">TicTac</span><span class="gbest" id="gb-tic"></span></button>
        </div>
        <div class="acts"><button class="bb ghost" id="gclose">Tutup</button></div>
      </div>
      <div id="gstage" style="display:none">
        <div class="ghead"><button class="bb ghost" id="gback">‹ Kembali</button><h3 id="gtitle">GAME</h3><div id="gscore"></div></div>
        <div id="gbody"></div>
      </div>
    </div>
  </div>
</body></html>`;

export function createSandbox() {
  const dom = new JSDOM(HTML, {
    url: 'http://localhost:4096',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // Mock localStorage — jsdom makes it read-only, so we create standalone
  const store = {};
  const mockLS = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };

  const sandbox = {
    window,
    document: window.document,
    localStorage: mockLS,
    DOMParser: window.DOMParser,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    escape: globalThis.escape,
    unescape: globalThis.unescape,
    XMLHttpRequest: window.XMLHttpRequest,
    Image: window.Image,
    console,
    Date,
    Math,
    Array,
    String,
    Number,
    Boolean,
    Object,
    JSON,
    RegExp,
    Error,
    TypeError,
    RangeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    Map,
    Set,
    Promise,
    Symbol,
    WeakMap,
    WeakSet,
    Proxy,
    Reflect,
    BigInt,
    BigInt64Array,
    BigUint64Array,
    FinalizationRegistry,
    WeakRef,
    AbortController,
    AbortSignal,
    TextEncoder: window.TextEncoder,
    TextDecoder: window.TextDecoder,
    URL: window.URL,
    URLSearchParams: window.URLSearchParams,
    Blob: window.Blob,
    File: window.File,
    FileReader: window.FileReader,
    FormData: window.FormData,
    Request: window.Request,
    Response: window.Response,
    Headers: window.Headers,
    fetch: window.fetch?.bind?.(window) || (() => Promise.resolve({ ok: false })),
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    visualViewport: null,
    innerWidth: 360,
    innerHeight: 640,
    matchMedia: () => ({ matches: false }),
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
  };

  // Mock Android bridge
  sandbox.Android = {
    send: () => 0,
    cancel: () => {},
    copyText: () => {},
    openUrl: () => {},
    newChat: () => {},
    checkUpdate: () => {},
    saveConfig: () => {},
    readConfig: () => '{}',
    fetchModels: () => {},
    pickFile: () => {},
    readImageDataUrl: () => null,
    appInfo: () => 'test-1.0',
  };

  vm.createContext(sandbox);
  return { dom, window: dom.window, sandbox };
}

export function loadScript(sandbox, filename) {
  const src = fs.readFileSync(path.join(JS_DIR, filename), 'utf8');
  vm.runInContext(src, sandbox);
}

export function loadScriptsInOrder(sandbox, filenames) {
  for (const f of filenames) {
    loadScript(sandbox, f);
  }
}
