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

// --- dev gate (PIN) ---
console.log('\ndev gate:');
test('5 taps opens lock', () => {
  sandbox.document.getElementById('mdev').classList.remove('show');
  for (let i = 0; i < 5; i++) sandbox.Dev.armTap();
  assert.ok(sandbox.document.getElementById('mdev').classList.contains('show'));
  assert.notEqual(sandbox.document.getElementById('dev-lock').style.display, 'none');
  sandbox.document.getElementById('mdev').classList.remove('show');
});
test('correct PIN unlocks + panel', () => {
  sandbox.window._devOn = undefined;
  assert.equal(sandbox.Dev.unlock('112233'), true);
  assert.equal(sandbox.window._devOn, true);
  assert.notEqual(sandbox.document.getElementById('dev-panel').style.display, 'none', 'panel shown');
  sandbox.window._devOn = undefined;
  sandbox.document.getElementById('mdev').classList.remove('show');
  sandbox.document.getElementById('dev-lock').style.display = '';
  sandbox.document.getElementById('dev-panel').style.display = 'none';
});
test('wrong PIN stays locked', () => {
  sandbox.window._devOn = undefined;
  assert.equal(sandbox.Dev.unlock('000000'), false);
  assert.equal(sandbox.window._devOn, undefined);
  assert.ok(sandbox.document.getElementById('dev-msg').textContent.includes('salah'));
});
test('dev-go button unlocks', () => {
  sandbox.window._devOn = undefined;
  sandbox.document.getElementById('dev-pin').value = '112233';
  sandbox.document.getElementById('dev-go').click();
  assert.equal(sandbox.window._devOn, true);
  sandbox.window._devOn = undefined;
  sandbox.document.getElementById('mdev').classList.remove('show');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
