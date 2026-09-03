/**
 * send.test.js — unit tests for send.js functions
 * Test: send, doSend, forceStop, bindChips, go.onclick, chat click handlers
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

// Track Android.send calls
let lastSendPrompt = null;
let sendCallCount = 0;
sandbox.Android.send = function(prompt) {
  lastSendPrompt = prompt;
  sendCallCount++;
  return 1; // return token
};
sandbox.Android.cancel = function() {};
sandbox.Android.copyText = function() {};
sandbox.Android.openUrl = function() {};

loadScriptsInOrder(sandbox, [
  'utils.js', 'init.js', 'websearch.js', 'stream.js', 'history.js', 'send.js', 'models.js', 'media.js'
]);

const send = sandbox.send;
const forceStop = sandbox.window.forceStop;

function resetState() {
  sandbox.busy = false;
  sandbox.window._done = false;
  sandbox.window._aborted = false;
  sandbox.window._canceling = false;
  sandbox.window._warmingUp = false;
  sandbox.window._srvOk = true;
  sandbox.window._cur = null;
  sandbox.window._plain = '';
  sandbox.window._cur = null;
  sandbox.window._gotDelta = false;
  sandbox.window._flushAt = 0;
  sandbox.window._att = null;
  sandbox.window._lastPrompt = null;
  sandbox.window._lastCancelledPrompt = null;
  sandbox.chat.innerHTML = '';
  sandbox.document.getElementById('chat').innerHTML = '';
  sandbox.document.getElementById('hint').textContent = '';
  sandbox.document.getElementById('go').className = '';
  sandbox.document.getElementById('go').innerHTML = 'GO';
  sandbox.document.getElementById('dot').className = '';
  sandbox.document.getElementById('inp').value = '';
  lastSendPrompt = null;
  sendCallCount = 0;
  sandbox.Android.send = function(p) { lastSendPrompt = p; sendCallCount++; return 1; };
  sandbox.Android.cancel = function() {};
  sandbox.Android.copyText = function() {};
  sandbox.Android.openUrl = function() {};
  // CRITICAL: disable web search to avoid async path in send()
  sandbox.WebSearch.enabled = false;
  sandbox.WebSearch.lastResults = [];
}

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

console.log('\n=== send.test.js ===\n');

// --- send() ---
console.log('send():');
test('send blocked when busy', () => {
  resetState();
  sandbox.busy = true;
  send('hello');
  assert.equal(sendCallCount, 0, 'should not call Android.send');
});
test('send blocked when empty', () => {
  resetState();
  send('');
  assert.equal(sendCallCount, 0);
});
test('send blocked when null', () => {
  resetState();
  send(null);
  assert.equal(sendCallCount, 0);
});
test('send blocked when server not ready', () => {
  resetState();
  sandbox.window._srvOk = false;
  send('hello');
  assert.equal(sendCallCount, 0);
  const notes = sandbox.document.querySelectorAll('.sysnote');
  assert.ok(notes.length >= 1, 'should show server not ready note');
});
test('send calls Android.send when ready', () => {
  resetState();
  send('hello world');
  assert.equal(sendCallCount, 1, 'should call Android.send once');
  assert.ok(lastSendPrompt, 'should have prompt');
});
test('send sets busy true', () => {
  resetState();
  send('hello');
  assert.equal(sandbox.busy, true);
});
test('send sets dot to work', () => {
  resetState();
  send('hello');
  assert.equal(sandbox.document.getElementById('dot').className, 'work');
});
test('send adds user message', () => {
  resetState();
  send('hello');
  const userMsgs = sandbox.document.querySelectorAll('.msg.user');
  assert.equal(userMsgs.length, 1, 'should have 1 user message');
});
test('send adds AI message', () => {
  resetState();
  send('hello');
  const aiMsgs = sandbox.document.querySelectorAll('.msg.ai');
  assert.equal(aiMsgs.length, 1, 'should have 1 AI message');
});
test('send stores _lastPrompt', () => {
  resetState();
  send('my question');
  assert.equal(sandbox.window._lastPrompt, 'my question');
});
test('send with label uses label as user text', () => {
  resetState();
  send('actual prompt', 'Label Text');
  const userMsg = sandbox.document.querySelector('.msg.user .body');
  assert.equal(userMsg.textContent, 'Label Text');
});
test('send with imgPrev shows image', () => {
  resetState();
  send('describe', 'pic', 'data:image/png;base64,abc');
  const img = sandbox.document.querySelector('.msg.user .attimg');
  assert.ok(img, 'should have image');
  assert.equal(img.src, 'data:image/png;base64,abc');
});

// --- send with web search ---
console.log('\nsend() with web search:');
test('search enabled triggers search', () => {
  resetState();
  sandbox.WebSearch.enabled = true;
  // Override search to return results synchronously
  sandbox.WebSearch.search = function(q) {
    return Promise.resolve([{ title: 'Result', url: 'https://x.com', snippet: 's' }]);
  };
  sandbox.WebSearch.lastResults = [];
  send('search for something long enough');
  // After promise resolves, doSend is called
  return new Promise(r => setTimeout(() => {
    assert.ok(sandbox.WebSearch.lastResults.length > 0, 'should have search results');
    r();
  }, 50));
});
test('search disabled skips search', () => {
  resetState();
  sandbox.WebSearch.enabled = false;
  send('hello world');
  assert.equal(sendCallCount, 1);
  assert.ok(sandbox.WebSearch.lastResults.length === 0, 'should have no search results');
});
test('retryMode skips search', () => {
  resetState();
  sandbox.WebSearch.enabled = true;
  sandbox.WebSearch.search = function() { return Promise.resolve([]); };
  sandbox.WebSearch.lastResults = [];
  send('hello', null, null, true);
  assert.ok(sandbox.WebSearch.lastResults.length === 0, 'should have no search results');
});
test('search shows status bubble with query', () => {
  resetState();
  sandbox.WebSearch.enabled = true;
  sandbox.WebSearch.search = function() { return new Promise(function() {}); }; // never resolves
  send('search for something long enough here');
  const st = sandbox.document.querySelector('#chat .status');
  assert.ok(st, 'status bubble exists');
  assert.ok(st.textContent.includes('Mencari'), 'says searching');
  assert.ok(st.textContent.includes('something long enough'), 'shows sanitized query');
  clearInterval(sandbox.window._swTimer);
  st.remove();
});
test('search replaces old status bubble', () => {
  resetState();
  sandbox.WebSearch.enabled = true;
  sandbox.WebSearch.search = function() { return new Promise(function() {}); };
  send('first search query long enough');
  send('second search query long enough');
  assert.equal(sandbox.document.querySelectorAll('#chat .status').length, 1, 'only one bubble');
  clearInterval(sandbox.window._swTimer);
  sandbox.document.getElementById('chat').innerHTML = '';
});

// --- doSend internals (via send) ---
console.log('\ndoSend():');
test('doSend sets _done false', () => {
  resetState();
  sandbox.window._done = true;
  send('hello');
  assert.equal(sandbox.window._done, false);
});
test('doSend sets _aborted false', () => {
  resetState();
  sandbox.window._aborted = true;
  send('hello');
  assert.equal(sandbox.window._aborted, false);
});
test('doSend increments msgCount', () => {
  resetState();
  const before = sandbox.msgCount;
  send('hello');
  assert.equal(sandbox.msgCount, before + 1);
});
test('doSend AI body has thinking-svg', () => {
  resetState();
  send('hello');
  const aiBody = sandbox.document.querySelector('.msg.ai .body');
  assert.ok(aiBody.innerHTML.includes('thinking-svg'), 'should have thinking animation');
});
test('doSend sets go to stop', () => {
  resetState();
  send('hello');
  assert.ok(sandbox.document.getElementById('go').classList.contains('stop'));
});

// --- forceStop ---
console.log('\nforceStop():');
test('forceStop does nothing when not busy', () => {
  resetState();
  sandbox.busy = false;
  forceStop();
  assert.equal(sandbox.busy, false);
});
test('forceStop does nothing when _done', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._done = true;
  forceStop();
  assert.equal(sandbox.busy, true, 'should not change busy');
});
test('forceStop resets busy to false', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._cur = sandbox.document.querySelector('.msg.ai .body') || (() => {
    // create one
    const m = sandbox.document.createElement('div');
    m.className = 'msg ai';
    m.innerHTML = '<div class="body"></div>';
    sandbox.document.getElementById('chat').appendChild(m);
    return m.querySelector('.body');
  })();
  forceStop();
  assert.equal(sandbox.busy, false);
});
test('forceStop clears _cur', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._cur = sandbox.document.createElement('div');
  forceStop();
  assert.equal(sandbox.window._cur, null);
});
test('forceStop with partial text renders markdown', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._plain = '**bold text**';
  const body = sandbox.document.createElement('div');
  body.className = 'body plain';
  sandbox.window._cur = body;
  sandbox.document.getElementById('chat').appendChild(body.parentNode || body);
  forceStop();
  // body should now have .md div with rendered markdown
  assert.ok(body.innerHTML.includes('bold') || body.innerHTML.includes('md'), 'should render markdown');
});
test('forceStop with empty text shows cancelled', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._plain = '';
  const body = sandbox.document.createElement('div');
  body.className = 'body plain';
  sandbox.window._cur = body;
  forceStop();
  assert.ok(body.innerHTML.includes('Dibatalkan'), 'should show cancelled text');
});
test('forceStop restores go button', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._cur = sandbox.document.createElement('div');
  sandbox.window._cur.innerHTML = '<span class="elapsed">test</span>';
  forceStop();
  assert.ok(!sandbox.document.getElementById('go').classList.contains('stop'));
});
test('forceStop clears hint', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._cur = sandbox.document.createElement('div');
  sandbox.document.getElementById('hint').textContent = 'sending...';
  forceStop();
  assert.equal(sandbox.document.getElementById('hint').textContent, '');
});

// --- bindChips ---
console.log('\nbindChips():');
test('bindChips binds onclick to chips', () => {
  resetState();
  // restore a chip element
  const chip = sandbox.document.createElement('button');
  chip.className = 'chip';
  chip.setAttribute('data-q', 'test question');
  sandbox.document.getElementById('chat').appendChild(chip);
  sandbox.bindChips();
  assert.ok(chip.onclick, 'chip should have onclick');
});
test('chip click calls send', () => {
  resetState();
  const chip = sandbox.document.createElement('button');
  chip.className = 'chip';
  chip.setAttribute('data-q', 'test question');
  sandbox.document.getElementById('chat').appendChild(chip);
  sandbox.bindChips();
  chip.onclick();
  assert.equal(sendCallCount, 1, 'should call Android.send');
});

// --- go.onclick ---
console.log('\ngo.onclick():');
test('go.onclick when busy triggers cancel + forceStop', () => {
  resetState();
  sandbox.busy = true;
  sandbox.window._cur = sandbox.document.createElement('div');
  let cancelCalled = false;
  sandbox.Android.cancel = function() { cancelCalled = true; };
  sandbox.document.getElementById('go').onclick();
  assert.ok(cancelCalled, 'should call Android.cancel');
  assert.equal(sandbox.busy, false);
});
test('go.onclick with text sends', () => {
  resetState();
  sandbox.window._srvOk = true;
  sandbox.document.getElementById('inp').value = 'test message';
  sandbox.Android.send = function(p) { lastSendPrompt = p; sendCallCount++; return 1; };
  sandbox.document.getElementById('go').onclick();
  assert.equal(sendCallCount, 1, 'should call send once');
  assert.ok(lastSendPrompt.includes('test message'), 'should include message in prompt');
});
test('go.onclick with empty text does nothing', () => {
  resetState();
  sandbox.window._srvOk = true;
  sandbox.document.getElementById('inp').value = '';
  sandbox.Android.send = function(p) { lastSendPrompt = p; sendCallCount++; return 1; };
  sandbox.document.getElementById('go').onclick();
  assert.equal(sendCallCount, 0);
});
test('go.onclick with attachment sends attachment prompt', () => {
  resetState();
  sandbox.window._srvOk = true;
  sandbox.window._att = { name: 'test.txt', path: '/tmp/test.txt' };
  sandbox.document.getElementById('inp').value = 'look at this';
  sandbox.Android.readImageDataUrl = function() { return null; };
  sandbox.Android.send = function(p) { lastSendPrompt = p; sendCallCount++; return 1; };
  sandbox.document.getElementById('go').onclick();
  assert.equal(sendCallCount, 1);
  assert.ok(lastSendPrompt.includes('file dilampirkan'), 'should have attachment prompt');
  assert.ok(lastSendPrompt.includes('test.txt'), 'should include filename');
});
test('go.onclick with image attachment', () => {
  resetState();
  sandbox.window._srvOk = true;
  sandbox.window._att = { name: 'photo.jpg', path: '/tmp/photo.jpg' };
  sandbox.document.getElementById('inp').value = '';
  sandbox.Android.readImageDataUrl = function() { return 'data:image/jpeg;base64,abc'; };
  sandbox.Android.send = function(p) { lastSendPrompt = p; sendCallCount++; return 1; };
  sandbox.document.getElementById('go').onclick();
  assert.equal(sendCallCount, 1);
  assert.ok(lastSendPrompt.includes('gambar'), 'should mention image');
  assert.ok(lastSendPrompt.includes('photo.jpg'), 'should include filename');
});

// --- chat click handlers ---
console.log('\nchat click handlers:');
test('click on data-copy copies text', () => {
  resetState();
  let copiedText = null;
  sandbox.Android.copyText = function(t) { copiedText = t; };
  const btn = sandbox.document.createElement('button');
  btn.setAttribute('data-copy', 'hello world');
  btn.textContent = 'COPY';
  sandbox.document.getElementById('chat').appendChild(btn);
  btn.click();
  // The handler is on chat, need to dispatch event
  const evt = new sandbox.window.Event('click', { bubbles: true });
  btn.dispatchEvent(evt);
  assert.equal(copiedText, 'hello world');
});
test('click on data-url opens url', () => {
  resetState();
  let openedUrl = null;
  sandbox.Android.openUrl = function(u) { openedUrl = u; };
  const link = sandbox.document.createElement('a');
  link.setAttribute('data-url', 'https://example.com');
  link.textContent = 'click';
  sandbox.document.getElementById('chat').appendChild(link);
  const evt = new sandbox.window.Event('click', { bubbles: true });
  link.dispatchEvent(evt);
  assert.equal(openedUrl, 'https://example.com');
});

// --- input handlers ---
console.log('\ninput handlers:');
test('Enter key triggers send', () => {
  resetState();
  sandbox.document.getElementById('inp').value = 'test';
  const evt = new sandbox.window.KeyboardEvent('keydown', {
    key: 'Enter', shiftKey: false, bubbles: true, cancelable: true
  });
  sandbox.document.getElementById('inp').dispatchEvent(evt);
  assert.equal(sendCallCount, 1, 'Enter should trigger send');
});
test('Shift+Enter does not send', () => {
  resetState();
  sandbox.document.getElementById('inp').value = 'test';
  const evt = new sandbox.window.KeyboardEvent('keydown', {
    key: 'Enter', shiftKey: true, bubbles: true, cancelable: true
  });
  sandbox.document.getElementById('inp').dispatchEvent(evt);
  assert.equal(sendCallCount, 0, 'Shift+Enter should not send');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
