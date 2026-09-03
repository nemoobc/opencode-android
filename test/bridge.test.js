/**
 * bridge.test.js — unit tests for bridge.js web mode mock
 * Test: Android mock API, session creation, send, cancel, copyText, etc.
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

// Remove Android so bridge.js creates its web mock
delete sandbox.Android;
loadScriptsInOrder(sandbox, ['bridge.js']);

const Android = sandbox.window.Android;

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

console.log('\n=== bridge.test.js ===\n');

// --- Android mock exists ---
console.log('Android mock API:');
test('Android object exists', () => {
  assert.ok(Android, 'Android should exist');
});
test('Android.send is function', () => {
  assert.equal(typeof Android.send, 'function');
});
test('Android.cancel is function', () => {
  assert.equal(typeof Android.cancel, 'function');
});
test('Android.copyText is function', () => {
  assert.equal(typeof Android.copyText, 'function');
});
test('Android.openUrl is function', () => {
  assert.equal(typeof Android.openUrl, 'function');
});
test('Android.newChat is function', () => {
  assert.equal(typeof Android.newChat, 'function');
});
test('Android.checkUpdate is function', () => {
  assert.equal(typeof Android.checkUpdate, 'function');
});
test('Android.saveConfig is function', () => {
  assert.equal(typeof Android.saveConfig, 'function');
});
test('Android.readConfig is function', () => {
  assert.equal(typeof Android.readConfig, 'function');
});
test('Android.fetchModels is function', () => {
  assert.equal(typeof Android.fetchModels, 'function');
});
test('Android.pickFile is function', () => {
  assert.equal(typeof Android.pickFile, 'function');
});
test('Android.readImageDataUrl is function', () => {
  assert.equal(typeof Android.readImageDataUrl, 'function');
});
test('Android.appInfo is function', () => {
  assert.equal(typeof Android.appInfo, 'function');
});

// --- saveConfig / readConfig ---
console.log('\nsaveConfig/readConfig:');
test('saveConfig stores config in localStorage', () => {
  Android.saveConfig('openai', 'sk-test', 'gpt-4');
  const stored = sandbox.localStorage.getItem('oc-cfg');
  assert.ok(stored, 'should have stored config');
  const parsed = JSON.parse(stored);
  assert.equal(parsed.provider, 'openai');
  assert.equal(parsed.key, 'sk-test');
  assert.equal(parsed.model, 'gpt-4');
});
test('readConfig returns stored config', () => {
  Android.saveConfig('anthropic', 'key123', 'claude');
  const result = Android.readConfig();
  const parsed = JSON.parse(result);
  assert.equal(parsed.provider, 'anthropic');
  assert.equal(parsed.key, 'key123');
});
test('readConfig returns empty object when nothing stored', () => {
  sandbox.localStorage.removeItem('oc-cfg');
  const result = Android.readConfig();
  assert.equal(result, '{}');
});

// --- copyText ---
console.log('\ncopyText:');
test('copyText does not throw', () => {
  assert.doesNotThrow(() => Android.copyText('test'));
});

// --- openUrl ---
console.log('\nopenUrl:');
test('openUrl does not throw', () => {
  assert.doesNotThrow(() => Android.openUrl('https://example.com'));
});

// --- appInfo ---
console.log('\nappInfo:');
test('appInfo returns version string', () => {
  const info = Android.appInfo();
  assert.ok(typeof info === 'string', 'should return string');
  assert.ok(info.length > 0, 'should not be empty');
});

// --- readImageDataUrl ---
console.log('\nreadImageDataUrl:');
test('readImageDataUrl returns null', () => {
  assert.equal(Android.readImageDataUrl('/tmp/test.jpg'), null);
});

// --- newChat ---
console.log('\nnewChat:');
test('newChat does not throw', () => {
  assert.doesNotThrow(() => Android.newChat());
});

// --- checkUpdate ---
console.log('\ncheckUpdate:');
test('checkUpdate does not throw', () => {
  assert.doesNotThrow(() => Android.checkUpdate());
});

// --- fetchModels ---
console.log('\nfetchModels:');
test('fetchModels does not throw', () => {
  assert.doesNotThrow(() => Android.fetchModels());
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
