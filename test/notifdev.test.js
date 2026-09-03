/**
 * notifdev.test.js — unit tests for notif.js + dev.js + websearch favicon
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

loadScriptsInOrder(sandbox, ['utils.js', 'websearch.js', 'notif.js', 'dev.js']);

const Notif = sandbox.Notif;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log('\n=== notifdev.test.js ===\n');

// --- sha256 vectors ---
console.log('sha256hex():');
test('empty string vector', () => {
  assert.equal(sandbox.sha256hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
test('abc vector', () => {
  assert.equal(sandbox.sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('32-char key hashes 64 hex', () => {
  const h = sandbox.sha256hex('abcdefghijklmnopqrstuvwxyz012345');
  assert.ok(/^[0-9a-f]{64}$/.test(h), 'got: ' + h);
});

// --- Notif.parseList ---
console.log('\nparseList():');
test('valid json', () => {
  const l = Notif.parseList('{"announcements":[{"id":"a","title":"T"}]}');
  assert.equal(l.length, 1);
  assert.equal(l[0].id, 'a');
});
test('garbage returns empty', () => {
  assert.equal(JSON.stringify(Notif.parseList('xxx')), '[]');
  assert.equal(JSON.stringify(Notif.parseList('{}')), '[]');
  assert.equal(JSON.stringify(Notif.parseList(null)), '[]');
});

// --- Notif.unread ---
console.log('\nunread():');
test('counts unread', () => {
  sandbox.localStorage.setItem('oc-notif-read', JSON.stringify(['a']));
  assert.equal(Notif.unread([{ id: 'a' }, { id: 'b' }, { id: 'c' }]), 2);
  sandbox.localStorage.removeItem('oc-notif-read');
});
test('all read = 0', () => {
  sandbox.localStorage.setItem('oc-notif-read', JSON.stringify(['a', 'b']));
  assert.equal(Notif.unread([{ id: 'a' }, { id: 'b' }]), 0);
  sandbox.localStorage.removeItem('oc-notif-read');
});

// --- badge/modal ---
console.log('\nbadge/modal:');
test('badge shows count', () => {
  sandbox.localStorage.removeItem('oc-notif-read');
  sandbox.window._notifList = [{ id: 'x', title: 'T', body: 'B' }];
  Notif.open();
  assert.ok(sandbox.document.getElementById('mnotif').classList.contains('show'));
  assert.ok(sandbox.document.getElementById('nlist').textContent.includes('T'));
  sandbox.document.getElementById('mnotif').classList.remove('show');
});

// --- favicon in sources ---
console.log('\nfavicon():');
test('footer has auto logo', () => {
  sandbox.WebSearch.lastResults = [{ title: 'Judul Panjang Sekali Biar Kepotong Ya Kan', url: 'https://example.com/a/b', snippet: '' }];
  const html = sandbox.WebSearch.buildSourcesHTML();
  assert.ok(html.includes('google.com/s2/favicons'), 'favicon url');
  assert.ok(html.includes('example.com'), 'domain');
  assert.ok(html.includes('data-url'), 'tap works');
});

// --- dev gate ---
console.log('\ndev gate:');
test('5 taps opens lock', () => {
  sandbox.document.getElementById('mdev').classList.remove('show');
  for (let i = 0; i < 5; i++) sandbox.Dev.armTap();
  assert.ok(sandbox.document.getElementById('mdev').classList.contains('show'));
  assert.notEqual(sandbox.document.getElementById('dev-lock').style.display, 'none');
  sandbox.document.getElementById('mdev').classList.remove('show');
});
test('wrong key stays locked', () => {
  sandbox.Android.readTextFile = () => 'salah';
  sandbox.Dev.verifyFile('/x/license.key');
  assert.equal(sandbox.window._devOn, undefined);
});
test('DEVKEY embedded skips network', () => {
  sandbox.window.DEVKEY = 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791';
  sandbox.Android.readTextFile = () => 'demo123';
  sandbox.window._devOn = undefined;
  sandbox.Dev.verifyFile('/x/any.key');
  assert.equal(sandbox.window._devOn, true, 'unlocks via embedded hash');
  delete sandbox.window.DEVKEY;
});

// --- e2e dev unlock (server lokal + kunci bener) ---
console.log('\ndev e2e:');
async function runAsyncDev() {
  const http = await import('node:http');
  const crypto = await import('node:crypto');
  const KEY = 'kunci-rahasia-e2e';
  const HASH = crypto.createHash('sha256').update(KEY).digest('hex');
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/devkey.txt')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(HASH);
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise((res, rej) => {
    srv.on('error', rej);
    srv.listen(4096, '127.0.0.1', res);
  });
  try {
    // 1. kunci bener → kebuka + panel tampil
    sandbox.Android.readTextFile = () => KEY + '\n';
    sandbox.window._devOn = undefined;
    sandbox.Dev.verifyFile('/data/license.key');
    await new Promise((r) => setTimeout(r, 800));
    assert.equal(sandbox.window._devOn, true, 'dev unlocks');
    assert.notEqual(sandbox.document.getElementById('dev-panel').style.display, 'none', 'panel shown');
    passed++;
    console.log('  ✓ correct key unlocks + panel');
  } catch (e) {
    failed++;
    console.log('  ✗ correct key unlocks + panel');
    console.log(`    ${e.message}`);
  }
  try {
    // 2. hook onFileReady alihkan ke dev saat _devPick
    sandbox.window._devOn = undefined;
    sandbox.window._devPick = true;
    sandbox.Android.readTextFile = () => KEY;
    sandbox.window.onFileReady('license.key', '/x/license.key');
    await new Promise((r) => setTimeout(r, 800));
    assert.equal(sandbox.window._devOn, true, 'hook routes to dev');
    assert.equal(sandbox.window._devPick, false, 'flag consumed');
    passed++;
    console.log('  ✓ picker hook routes to dev');
  } catch (e) {
    failed++;
    console.log('  ✗ picker hook routes to dev');
    console.log(`    ${e.message}`);
  }
  srv.close();
  console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
runAsyncDev();
