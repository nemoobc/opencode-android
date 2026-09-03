/**
 * init.test.js — unit tests for init.js functions
 * Test: DOM refs, follow, scrollEnd, killHello, greeting
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

loadScriptsInOrder(sandbox, ['utils.js', 'init.js']);

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

console.log('\n=== init.test.js ===\n');

// --- DOM refs ---
console.log('DOM refs:');
test('chat is defined', () => {
  assert.ok(sandbox.chat, 'chat should be defined');
  assert.equal(sandbox.chat.id, 'chat');
});
test('inp is defined', () => {
  assert.ok(sandbox.inp, 'inp should be defined');
  assert.equal(sandbox.inp.id, 'inp');
});
test('go is defined', () => {
  assert.ok(sandbox.go, 'go should be defined');
  assert.equal(sandbox.go.id, 'go');
});
test('battach is defined', () => {
  assert.ok(sandbox.battach, 'battach should be defined');
  assert.equal(sandbox.battach.id, 'battach');
});
test('dot is defined', () => {
  assert.ok(sandbox.dot, 'dot should be defined');
  assert.equal(sandbox.dot.id, 'dot');
});
test('ov is defined', () => {
  assert.ok(sandbox.ov, 'ov should be defined');
  assert.equal(sandbox.ov.id, 'ov');
});

// --- Variables ---
console.log('\nVariables:');
test('busy starts false', () => {
  assert.equal(sandbox.busy, false);
});
test('curModel is defined', () => {
  assert.ok(sandbox.curModel, 'curModel should be defined');
  assert.ok(sandbox.curModel.includes('/'), 'curModel should contain /');
});
test('msgCount starts 0', () => {
  assert.equal(sandbox.msgCount, 0);
});
test('_helloHTML is defined', () => {
  assert.ok(sandbox.window._helloHTML, '_helloHTML should be defined');
  assert.ok(sandbox.window._helloHTML.includes('hello'), '_helloHTML should contain hello');
});

// --- Greeting ---
console.log('\nGreeting:');
test('greeting element exists', () => {
  const greet = sandbox.document.getElementById('greet');
  assert.ok(greet, 'greet element should exist');
});
test('greeting text is not empty', () => {
  const greet = sandbox.document.getElementById('greet');
  assert.ok(greet.textContent.length > 0, 'greeting should have text');
});

// --- killHello ---
console.log('\nkillHello():');
test('killHello removes hello element', () => {
  // Ensure hello exists
  let hello = sandbox.document.getElementById('hello');
  if (!hello) {
    hello = sandbox.document.createElement('div');
    hello.id = 'hello';
    sandbox.chat.appendChild(hello);
  }
  sandbox.killHello();
  hello = sandbox.document.getElementById('hello');
  assert.equal(hello, null, 'hello should be removed');
});
test('killHello safe when no hello', () => {
  sandbox.killHello(); // should not throw
  assert.doesNotThrow(() => sandbox.killHello());
});

// --- follow ---
console.log('\nfollow():');
test('follow does not throw', () => {
  assert.doesNotThrow(() => sandbox.follow());
});

// --- scrollEnd ---
console.log('\nscrollEnd():');
test('scrollEnd does not throw', () => {
  assert.doesNotThrow(() => sandbox.scrollEnd());
});
test('scrollEnd resets userHold', () => {
  sandbox.userHold = true;
  sandbox.scrollEnd();
  assert.equal(sandbox.userHold, false);
});

// --- mname text ---
console.log('\nmname:');
test('mname shows model name', () => {
  const mname = sandbox.document.getElementById('mname');
  assert.ok(mname.textContent.length > 0, 'mname should show model name');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
