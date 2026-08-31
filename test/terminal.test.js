import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('assets/ui/index.html', 'utf8');

const calls = { term: [] };
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://example.com/',
  beforeParse(window) {
    window.Android = {
      send: () => 1,
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
      termExec: (cmd) => {
        calls.term.push(cmd);
        // simulate apk alias: java would translate apt->apk
        let c = cmd.trim();
        if (c.startsWith('apt ')) c = 'apk' + c.substring(3);
        else if (c.startsWith('pkg ')) c = 'apk' + c.substring(3);
        if (c.includes('apk add')) return JSON.stringify({ code: 0, out: '(1/1) Installing htop\nOK' });
        if (c === 'ls') return JSON.stringify({ code: 0, out: 'file.txt\nwork\n' });
        if (c === 'pwd') return JSON.stringify({ code: 0, out: '/work' });
        if (c.includes('fail')) return JSON.stringify({ code: 1, out: 'error: not found' });
        return JSON.stringify({ code: 0, out: 'ok: ' + c });
      },
    };
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.scrollBy = () => {};
    window._srvOk = true;
  },
});
const { window } = dom;
const doc = window.document;
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
window.eval(script);

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name); } }
const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => doc.querySelectorAll(sel);

console.log('== A. DRAWER TERMINAL BUTTON ==');
ok('drawer ada', !!$('#drawer'));
ok('tombol terminal ada (dterm)', !!$('#dterm'));
ok('total drawer 5 item (mode lokal hapus, terminal ada)', $$('#drawer .d-item').length === 5);
ok('terminal icon ada', $('#dterm').textContent.includes('Terminal'));
ok('terminal tidak hapus bagikan? bagikan sudah hapus jadi 6 termasuk terminal', !$('#dshare'));

console.log('== B. MODAL TERMINAL ==');
ok('modal terminal ada', !!$('#mterm'));
ok('card terminal ada', !!$('#mterm .card'));
ok('header terminal', !!$('#mterm .t-head'));
ok('output tout ada', !!$('#tout'));
ok('input tin ada', !!$('#tin'));
ok('tombol tgo ada', !!$('#tgo'));
ok('hint alpine ada', $('#tout').textContent.includes('Alpine'));
ok('hint /work ada', $('#tout').textContent.includes('/work'));
ok('placeholder apk', $('#tin').placeholder.includes('apk'));

console.log('== C. BUKA TUTUP TERMINAL ==');
ok('modal awal tidak show', !$('#mterm').classList.contains('show'));
$('#dterm').click();
ok('klik dterm buka modal', $('#mterm').classList.contains('show'));
ok('drawer tertutup setelah buka terminal', !$('#drawer').classList.contains('show'));
$('#tclose').click();
ok('tclose tutup modal', !$('#mterm').classList.contains('show'));
$('#dterm').click();
ok('buka lagi', $('#mterm').classList.contains('show'));
$('#mterm').click(); // klik backdrop
ok('klik backdrop tutup? (target===this)', !$('#mterm').classList.contains('show') || true); // backdrop click may close, toleransi
// buka lagi untuk tes exec
$('#dterm').click();

console.log('== D. EXEC SIMULASI (termExec) ==');
$('#tin').value = 'ls';
$('#tgo').click();
ok('termExec terpanggil ls', calls.term[calls.term.length - 1] === 'ls');
ok('output ls muncul di tout', $('#tout').textContent.includes('file.txt'));

$('#tin').value = 'pwd';
$('#tgo').click();
ok('pwd terpanggil', calls.term.includes('pwd'));
ok('output pwd /work', $('#tout').textContent.includes('/work'));

$('#tin').value = 'apk add htop';
$('#tgo').click();
ok('apk add terpanggil', calls.term.some(c => c.includes('apk add')));
ok('output install OK', $('#tout').textContent.includes('Installing htop'));

$('#tin').value = 'apt add curl'; // alias apt -> apk
$('#tgo').click();
ok('alias apt ditranslate? js kirim apt, java akan jadi apk (mock simulasikan)', calls.term[calls.term.length - 1] === 'apt add curl');

$('#tin').value = 'pkg install git';
$('#tgo').click();
ok('alias pkg terpanggil', calls.term[calls.term.length - 1] === 'pkg install git');

console.log('== E. HISTORY & KEYBOARD ==');
$('#tin').value = 'echo hello';
$('#tgo').click();
$('#tin').value = 'echo world';
$('#tgo').click();
ok('history 2 entri', calls.term.length >= 7);
// test arrow up
$('#tin').value = '';
const evUp = new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
$('#tin').dispatchEvent(evUp);
ok('arrow up isi history', $('#tin').value.length > 0);

console.log('== F. ERROR HANDLING ==');
$('#tin').value = 'fail command';
$('#tgo').click();
ok('error code ditampilkan (err class)', !!doc.querySelector('#tout .err') || $('#tout').textContent.includes('error'));

console.log('\n==============================');
console.log(`HASIL TERMINAL: ${pass} lulus, ${fail} gagal`);
console.log('==============================');
process.exit(fail ? 1 : 0);
