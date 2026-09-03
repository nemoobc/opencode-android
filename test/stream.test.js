/**
 * stream.test.js — unit tests for stream.js functions
 * Test: appendOut, flushStream, onDone, onError, friendlyErr, setProgress, setProgressBytes
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

loadScriptsInOrder(sandbox, ['utils.js', 'init.js', 'websearch.js', 'history.js', 'stream.js']);

const appendOut = sandbox.window.appendOut;
const flushStream = sandbox.window.flushStream;
const onDone = sandbox.window.onDone;
const onError = sandbox.window.onError;
const setProgress = sandbox.window.setProgress;
const setProgressBytes = sandbox.window.setProgressBytes;

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

console.log('\n=== stream.test.js ===\n');

// Helper to reset streaming state
function resetStream() {
  if (sandbox.window._typer) { clearInterval(sandbox.window._typer); sandbox.window._typer = null; }
  sandbox.window._cur = null;
  sandbox.window._plain = '';
  sandbox.window._rend = '';
  sandbox.window._done = false;
  sandbox.window._aborted = false;
  sandbox.window._warmingUp = false;
  sandbox.window._canceling = false;
  sandbox.window._gotDelta = false;
  sandbox.window._flushAt = 0;
  sandbox.window._fileN = 0;
  sandbox.busy = false;
  // Clear chat
  sandbox.document.getElementById('chat').innerHTML = '';
}

// --- appendOut ---
console.log('appendOut():');
test('creates AI message on first call', () => {
  resetStream();
  appendOut('Hello');
  const msgs = sandbox.document.querySelectorAll('.msg.ai');
  assert.equal(msgs.length, 1, 'should have 1 AI message');
});
test('appends text to existing message', () => {
  resetStream();
  appendOut('Hello');
  appendOut(' World');
  assert.ok(sandbox.window._plain.includes('Hello'), 'should contain Hello');
  assert.ok(sandbox.window._plain.includes('World'), 'should contain World');
});
test('suppresses when _warmingUp is true', () => {
  resetStream();
  sandbox.window._warmingUp = true;
  appendOut('Should not appear');
  assert.equal(sandbox.window._plain, '');
  assert.equal(sandbox.document.querySelectorAll('.msg.ai').length, 0);
});
test('suppresses when _aborted is true', () => {
  resetStream();
  sandbox.window._aborted = true;
  appendOut('Should not appear');
  assert.equal(sandbox.window._plain, '');
});
test('suppresses when _done is true', () => {
  resetStream();
  sandbox.window._done = true;
  appendOut('Should not appear');
  assert.equal(sandbox.window._plain, '');
});

// --- flushStream ---
console.log('\nflushStream():');
test('flushStream updates text content', () => {
  resetStream();
  appendOut('Hello');
  flushStream();
  const msg = sandbox.document.querySelector('.msg.ai .body');
  assert.ok(msg, 'should have body element');
  assert.ok(msg.textContent.includes('Hello'), 'should contain Hello');
});

// --- typewriter ---
console.log('\ntypewriter():');
test('appendOut starts typer, text revealed gradually', () => {
  resetStream();
  const long = 'kata '.repeat(100); // 500 chars
  appendOut(long);
  assert.ok(sandbox.window._typer, 'typer interval should run');
  sandbox.window._tickTyper();
  const shown = sandbox.window._cur.textContent.length;
  assert.ok(shown > 0 && shown < long.length, `should partially reveal, got ${shown}/${long.length}`);
});
test('flushStream stops typer and shows full text', () => {
  resetStream();
  appendOut('Hello World Test');
  flushStream();
  assert.equal(sandbox.window._typer, null, 'typer should stop');
  assert.equal(sandbox.window._cur.textContent, 'Hello World Test');
});
test('onDone stops typer', () => {
  resetStream();
  appendOut('Some text here');
  sandbox.window._done = false;
  onDone(0);
  drainTyper();
  assert.equal(sandbox.window._typer, null, 'typer should stop');
});

// --- setStage ---
console.log('\nsetStage():');
test('boot stage sets indeterminate bar', () => {
  sandbox.window.setStage('menyalakan server AI...');
  const bar = sandbox.document.getElementById('pbar');
  assert.ok(bar.classList.contains('indet'), 'pbar should have indet class');
  assert.equal(sandbox.document.getElementById('pnum').textContent, 'memuat server...');
  assert.ok(sandbox.document.getElementById('ov').classList.contains('boot'), 'ov boot mode');
  assert.ok(sandbox.document.getElementById('st1').classList.contains('on'), 'stepper server on');
  if (sandbox.window._ovTimer) { clearInterval(sandbox.window._ovTimer); sandbox.window._ovTimer = null; }
});
test('extract stage removes indeterminate bar', () => {
  sandbox.window.setStage('menyiapkan sistem — mengekstrak...');
  const bar = sandbox.document.getElementById('pbar');
  assert.ok(!bar.classList.contains('indet'), 'pbar should not have indet class');
});

// --- onDone ---
console.log('\nonDone():');
/* onDone dengan teks blm ke-reveal masuk mode fast-forward:
   render final terjadi setelah tick kejar — drain dulu baru assert */
function drainTyper() {
  for (var i = 0; i < 500 && sandbox.window._cur; i++) sandbox.window._tickTyper();
}
test('onDone code 0 sets dot ok', () => {
  resetStream();
  appendOut('Response text');
  sandbox.window._done = false;
  sandbox.window.curModel = 'opencode/mimo-v2.5-free';
  onDone(0);
  drainTyper();
  assert.equal(sandbox.document.getElementById('dot').className, 'ok');
});
test('onDone code non-zero sets dot bad', () => {
  resetStream();
  appendOut('Error text');
  sandbox.window._done = false;
  onDone(1);
  drainTyper();
  assert.equal(sandbox.document.getElementById('dot').className, 'bad');
});
test('onDone sets busy false', () => {
  resetStream();
  appendOut('text');
  sandbox.busy = true;
  sandbox.window._done = false;
  onDone(0);
  drainTyper();
  assert.equal(sandbox.busy, false);
});
test('onDone clears _cur', () => {
  resetStream();
  appendOut('text');
  sandbox.window._done = false;
  onDone(0);
  drainTyper();
  assert.equal(sandbox.window._cur, null);
});
test('onDone fast-forwards typing then renders markdown', () => {
  resetStream();
  appendOut('Hello **bold** world');
  sandbox.window._done = false;
  onDone(0);
  assert.ok(sandbox.window._ff, 'should enter ff mode when text unrevealed');
  drainTyper();
  const md = sandbox.document.querySelector('.msg.ai .md');
  assert.ok(md, 'markdown should render after ff');
  assert.ok(md.innerHTML.includes('<b>bold</b>'), 'bold rendered');
});

// --- onError ---
console.log('\nonError():');
test('onError sets busy false', () => {
  resetStream();
  appendOut('text');
  sandbox.busy = true;
  onError('test error');
  assert.equal(sandbox.busy, false);
});
test('onError sets dot bad', () => {
  resetStream();
  appendOut('text');
  onError('test error');
  assert.equal(sandbox.document.getElementById('dot').className, 'bad');
});
test('onError removes current message', () => {
  resetStream();
  appendOut('text');
  onError('test error');
  assert.equal(sandbox.window._cur, null);
});
test('onError shows error note', () => {
  resetStream();
  onError('test error message');
  const notes = sandbox.document.querySelectorAll('.sysnote.err');
  assert.ok(notes.length >= 1, 'should have error note');
});

// --- friendlyErr (internal, but we can test via onError) ---
console.log('\nfriendlyErr (via onError):');
test('HTTP 500 shows friendly message', () => {
  resetStream();
  onError('HTTP 500 error');
  const notes = sandbox.document.querySelectorAll('.sysnote.err');
  const text = notes[notes.length - 1]?.textContent || '';
  assert.ok(text.includes('Model tidak tersedia'), 'should show model unavailable message');
});
test('rate limit shows friendly message', () => {
  resetStream();
  onError('rate limit exceeded');
  const notes = sandbox.document.querySelectorAll('.sysnote.err');
  const text = notes[notes.length - 1]?.textContent || '';
  assert.ok(text.includes('Terlalu banyak'), 'should show rate limit message');
});
test('timeout shows friendly message', () => {
  resetStream();
  // Remove all old notes first
  sandbox.document.querySelectorAll('.sysnote').forEach(n => n.remove());
  onError('timed out connection');
  const notes = sandbox.document.querySelectorAll('.sysnote.err');
  assert.ok(notes.length >= 1, 'should have error note');
  const text = notes[notes.length - 1]?.textContent || '';
  assert.ok(text.includes('lambat') || text.includes('timeout'), 'should show timeout message, got: ' + text);
});

// --- setProgress ---
console.log('\nsetProgress():');
test('updates pnum text', () => {
  setProgress(42);
  assert.equal(sandbox.document.getElementById('pnum').textContent, '42 / 528 file • 8%');
});
test('mirrors percent to splash spnum/spfill', () => {
  setProgress(264); // 50% of 528
  assert.equal(sandbox.document.getElementById('spnum').textContent, '264 / 528 file • 50%');
  assert.equal(sandbox.document.getElementById('spfill').style.width, '50%');
});

// --- setProgressBytes ---
console.log('\nsetProgressBytes():');
test('updates pfill width and pnum text', () => {
  setProgressBytes(2419669); // 50% of 4839338
  const fill = sandbox.document.getElementById('pfill');
  const num = sandbox.document.getElementById('pnum');
  assert.equal(fill.style.width, '50%');
  assert.ok(num.textContent.includes('file • 50%'), 'single label count+pct, got: ' + num.textContent);
});
test('mirrors percent to splash', () => {
  setProgressBytes(4839338); // 100%
  assert.ok(sandbox.document.getElementById('spnum').textContent.includes('100%'));
  assert.equal(sandbox.document.getElementById('spfill').style.width, '100%');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
