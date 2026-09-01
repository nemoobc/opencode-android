import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('assets/ui/index.html', 'utf8');

/* concat JS files */
const JS_DIR = 'assets/ui/js/';
const JS_FILES = ['bridge.js','websearch.js','init.js','utils.js','stream.js','send.js','history.js','models.js'];
const script = JS_FILES.map(f => fs.readFileSync(JS_DIR + f, 'utf8')).join('\n;\n');

const calls = { send: [] };
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://example.com/',
  beforeParse(window) {
    window.Android = {
      send: (t) => { calls.send.push(t); return 42; },
      cancel: () => {},
      newChat: () => {},
      saveConfig: () => {},
      copyText: () => {},
      openUrl: () => {},
      checkUpdate: () => {},
      fetchModels: () => {},
      readImageDataUrl: () => null,
      readConfig: () => JSON.stringify({ auth: '', cfg: '' }),
      appInfo: () => '1.6.1',
      toast: () => {},
      getLocalMode: () => false,
      setLocalMode: () => {},
      termExec: () => JSON.stringify({ code: 0, out: '' }),
    };
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.scrollBy = () => {};
    window._srvOk = true;
  },
});
const { window } = dom;
const doc = window.document;
window.eval(script);

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name); } }
const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => doc.querySelectorAll(sel);

console.log('== 1. AI KIRIM CEPAT (warm-up 1.5s, tidak 5s) ==');
// cek java file langsung
const java = fs.readFileSync('src/com/nemoobc/opencode/MainActivity.java', 'utf8');
ok('warmUp sleep 1500 (bukan 5000)', java.includes('Thread.sleep(1500)'));
ok('warmUp method pakai 1500', java.includes('warmUpModel()') && java.includes('Thread.sleep(1500)'));
ok('termExec timeout 120s (bukan 60)', java.includes('120000') && java.includes('timeout 120s'));
ok('apt alias ke apk', java.includes('apt ') && java.includes('apk'));
ok('fetchModels ambil big-pickle (gak -free)', java.includes('gratisNonFree') && java.includes('big-pickle'));
ok('fetchModels tetap ambil model -free', java.includes('id.endsWith("-free")'));
ok('dead code ensureWeb dihapus', !java.includes('private void ensureWeb()'));
ok('webInit dead variable dihapus', !java.includes('webInit'));
ok('elapsed dihapus via querySelector (bukan getElementById)', script.includes("querySelector('.elapsed')") && !script.includes("getElementById('elapsed')"));
ok('dead code dshare dihapus (tombol gak ada di HTML)', !html.includes('_dshare') && !script.includes('_dshare'));

console.log('== 2. STREAMING & SSE ==');
ok('saran cepat 25s (bukan 45)', script.includes('sec >= 25'));
ok('throttle 40ms ada', script.includes('40'));
ok('appendOut ada', typeof window.appendOut === 'function');
ok('onDone ada', typeof window.onDone === 'function');
ok('onError ada', typeof window.onError === 'function');

console.log('== 3. KIRIM & BUBBLE ==');
$('#inp').value = 'halo ai';
$('#go').click();
ok('send terpanggil', calls.send.length === 1);
ok('bubble user muncul', !!$('.msg.user'));
ok('bubble ai thinking', !!$('.msg.ai .thinking-svg'));
ok('go jadi stop', $('#go').classList.contains('stop'));

window.appendOut('halo ');
window.appendOut('dunia ');
ok('delta buffer', window._plain.includes('halo dunia'));
window.flushStream();
ok('render flush', $('.msg.ai .body').textContent.includes('halo dunia'));
window.onDone(0, 42);
ok('onDone reset', !$('#go').classList.contains('stop'));

console.log('== 4. MARKDOWN RAPI ==');
window._cur = null; window._plain = ''; window._done = false; window._aborted = false;
window.appendOut('# Judul\n\n**tebal** `kode`\n\n| a | b |\n|---|---|\n| 1 | 2 |');
window.onDone(0);
const body = doc.querySelectorAll('.msg.ai .body');
const last = body[body.length - 1];
ok('heading', !!last.querySelector('h1'));
ok('bold', !!last.querySelector('b,strong'));
ok('code', !!last.querySelector('code.ic'));
ok('tabel', !!last.querySelector('table'));

console.log('== 5. BAHASA & MODEL ==');
ok('MODELS ada', window.MODELS.length >= 6);
ok('spark ada (default)', window.MODELS.some(m => m.id.includes('muse-spark')));
ok('big-pickle tetap ada', window.MODELS.some(m => m.id.includes('big-pickle')));
ok('termExec mock', typeof window.Android.termExec === 'function');

console.log('\n==============================');
console.log(`HASIL AI: ${pass} lulus, ${fail} gagal`);
console.log('==============================');
process.exit(fail ? 1 : 0);
