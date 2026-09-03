/**
 * history.test.js — unit tests for history.js functions
 * Test: histAgo, histGet, histSave, histSaveCur, histRender, newChat
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

loadScriptsInOrder(sandbox, ['utils.js', 'init.js', 'websearch.js', 'stream.js', 'history.js']);

const histGet = sandbox.histGet;
const histSave = sandbox.histSave;
const histAgo = sandbox.histAgo;

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

console.log('\n=== history.test.js ===\n');

// --- histAgo ---
console.log('histAgo():');
test('just now (< 1 minute)', () => {
  assert.equal(histAgo(Date.now() - 10000), 'Baru saja');
});
test('minutes ago', () => {
  assert.equal(histAgo(Date.now() - 180000), '3 Menit Lalu');
});
test('hours ago', () => {
  assert.equal(histAgo(Date.now() - 7200000), '2 Jam Lalu');
});
test('days ago', () => {
  assert.equal(histAgo(Date.now() - 172800000), '2 Hari Lalu');
});
test('exactly 1 minute', () => {
  assert.equal(histAgo(Date.now() - 60000), '1 Menit Lalu');
});
test('exactly 1 hour', () => {
  assert.equal(histAgo(Date.now() - 3600000), '1 Jam Lalu');
});
test('exactly 1 day', () => {
  assert.equal(histAgo(Date.now() - 86400000), '1 Hari Lalu');
});

// --- histGet / histSave ---
console.log('\nhistGet/histSave():');
test('empty localStorage returns empty array', () => {
  sandbox.localStorage.removeItem('oc-hist');
  const result = histGet();
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});
test('save and retrieve', () => {
  const data = [{ id: 'c1', title: 'Test', ts: Date.now(), html: '<div>hi</div>' }];
  histSave(data);
  const result = histGet();
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'c1');
});
test('corrupted data returns empty array', () => {
  sandbox.localStorage.setItem('oc-hist', 'not-valid-json!!!');
  const result = histGet();
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});
test('save replaces previous', () => {
  histSave([{ id: 'c1' }, { id: 'c2' }]);
  histSave([{ id: 'c3' }]);
  assert.equal(histGet().length, 1);
  assert.equal(histGet()[0].id, 'c3');
});

// --- histSaveCur ---
console.log('\nhistSaveCur():');
test('saves current chat messages', () => {
  // Add a user message to chat
  const chat = sandbox.document.getElementById('chat');
  chat.innerHTML = '<div class="msg user"><div class="body">Hello test</div></div>';
  sandbox.window._chatId = 'test-session-1';
  sandbox.window.curModel = 'opencode/mimo-v2.5-free';

  sandbox.histSaveCur();
  const arr = histGet();
  assert.ok(arr.length >= 1, 'should have at least 1 entry');
  const entry = arr.find(e => e.id === 'test-session-1');
  assert.ok(entry, 'should find our entry');
  assert.ok(entry.title.includes('Hello test'), 'title should contain message text');
  assert.ok(entry.html.includes('msg user'), 'should save HTML');
});

// --- histRender ---
console.log('\nhistRender():');
test('empty history renders placeholder', () => {
  histSave([]);
  sandbox.histRender();
  const hlist = sandbox.document.getElementById('hlist');
  assert.ok(hlist.innerHTML.includes('h-empty'), 'should have empty placeholder');
});
test('renders history items', () => {
  histSave([
    { id: 'c1', title: 'Test Chat 1', ts: Date.now(), html: '<div>hi</div>', model: 'opencode/mimo-v2.5-free' },
    { id: 'c2', title: 'Test Chat 2', ts: Date.now() - 1000, html: '<div>hi2</div>', model: 'opencode/mimo-v2.5-free' },
  ]);
  sandbox.histRender();
  const hlist = sandbox.document.getElementById('hlist');
  assert.ok(hlist.innerHTML.includes('Test Chat 1'), 'should have first item');
  assert.ok(hlist.innerHTML.includes('Test Chat 2'), 'should have second item');
});
test('pinned items appear first', () => {
  histSave([
    { id: 'c1', title: 'Unpinned', ts: Date.now(), html: '', model: '', pinned: false },
    { id: 'c2', title: 'Pinned Item', ts: Date.now() - 1000, html: '', model: '', pinned: true },
  ]);
  sandbox.histRender();
  const hlist = sandbox.document.getElementById('hlist');
  const html = hlist.innerHTML;
  const pinIdx = html.indexOf('Pinned Item');
  const unpinnedIdx = html.indexOf('Unpinned');
  assert.ok(pinIdx < unpinnedIdx, 'pinned should appear before unpinned');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
