/**
 * models.test.js — unit tests for models.js functions
 * Test: MODELS array, modelName, detectLang, langPromp, avatarEmoji, avatarName, avatarUrl
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

loadScriptsInOrder(sandbox, ['utils.js', 'init.js', 'websearch.js', 'stream.js', 'history.js', 'send.js', 'models.js', 'media.js']);

const MODELS = sandbox.MODELS;
const modelName = sandbox.modelName;
const detectLang = sandbox.detectLang;
const langPromp = sandbox.langPromp;
const avatarEmoji = sandbox.avatarEmoji;
const avatarName = sandbox.avatarName;
const avatarUrl = sandbox.avatarUrl;

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

console.log('\n=== models.test.js ===\n');

// --- MODELS array ---
console.log('MODELS array:');
test('has models', () => {
  assert.ok(Array.isArray(MODELS));
  assert.ok(MODELS.length >= 9, 'should have at least 9 models');
});
test('has free models', () => {
  const free = MODELS.filter(m => m.tag === 'GRATIS');
  assert.ok(free.length >= 7, 'should have at least 7 free models');
});
test('has pro models', () => {
  const pro = MODELS.filter(m => m.tag === 'PRO');
  assert.ok(pro.length >= 2, 'should have at least 2 pro models');
});
test('all models have required fields', () => {
  MODELS.forEach(m => {
    assert.ok(m.id, `model ${JSON.stringify(m)} missing id`);
    assert.ok(m.nm, `model ${JSON.stringify(m)} missing nm`);
    assert.ok(m.ds, `model ${JSON.stringify(m)} missing ds`);
    assert.ok(m.tag, `model ${JSON.stringify(m)} missing tag`);
  });
});
test('mimo-v2.5-free exists', () => {
  const mimo = MODELS.find(m => m.id.includes('mimo'));
  assert.ok(mimo, 'mimo model should exist');
});

// --- modelName ---
console.log('\nmodelName():');
test('returns name for known model', () => {
  assert.equal(modelName('opencode/mimo-v2.5-free'), 'Mimo 2.5 Free');
});
test('returns id suffix for unknown model', () => {
  assert.equal(modelName('openai/gpt-4.1'), 'GPT-4.1');
});
test('fallback for garbage', () => {
  const result = modelName('trash');
  assert.equal(result, 'trash');
});

// --- detectLang ---
console.log('\ndetectLang():');
test('detects Indonesian "halo"', () => {
  assert.equal(detectLang('halo apa kabar'), 'id');
});
test('detects Indonesian "apa"', () => {
  assert.equal(detectLang('apa itu python'), 'id');
});
test('detects Indonesian "tolong"', () => {
  assert.equal(detectLang('tolong bantu saya'), 'id');
});
test('detects English "hello"', () => {
  assert.equal(detectLang('hello how are you'), 'en');
});
test('detects English "what"', () => {
  assert.equal(detectLang('what is this'), 'en');
});
test('detects English "please"', () => {
  assert.equal(detectLang('please help me'), 'en');
});
test('neutral returns null', () => {
  assert.equal(detectLang('123'), null);
});
test('empty returns null', () => {
  assert.equal(detectLang(''), null);
});
test('mixed id wins', () => {
  assert.equal(detectLang('halo apa yang bisa saya buat untuk kamu hari ini'), 'id');
});
test('mixed en wins', () => {
  assert.equal(detectLang('hello what can you do for me today'), 'en');
});

// --- langPromp ---
console.log('\nlangPromp():');
test('auto + indonesian input → id prompt', () => {
  sandbox.curLang = 'auto';
  sandbox.window._langDetected = null;
  const result = langPromp('halo apa kabar');
  assert.ok(result.includes('bahasa Indonesia'), 'should contain id instruction');
  assert.ok(result.includes('halo apa kabar'), 'should contain original text');
});
test('force english → en prompt', () => {
  sandbox.curLang = 'en';
  const result = langPromp('hello');
  assert.ok(result.includes('English'), 'should contain en instruction');
  assert.ok(result.includes('hello'), 'should contain original text');
});
test('force indonesian → id prompt', () => {
  sandbox.curLang = 'id';
  const result = langPromp('hello');
  assert.ok(result.includes('bahasa Indonesia'), 'should contain id instruction');
  assert.ok(result.includes('hello'), 'should contain original text');
});
test('auto + english input → en prompt', () => {
  sandbox.curLang = 'auto';
  sandbox.window._langDetected = null;
  const result = langPromp('hello how are you');
  assert.ok(result.includes('English'), 'should contain en instruction');
});
test('cached detection reused', () => {
  sandbox.curLang = 'auto';
  sandbox.window._langDetected = 'id';
  const result = langPromp('anything');
  assert.ok(result.includes('bahasa Indonesia'), 'should use cached detection');
});

// --- avatarEmoji ---
console.log('\navatarEmoji():');
test('known avatar returns emoji', () => {
  assert.equal(avatarEmoji('miki-tikus'), '🐭');
});
test('another known avatar', () => {
  assert.equal(avatarEmoji('rubah-licik'), '🦊');
});
test('unknown returns default', () => {
  assert.equal(avatarEmoji('unknown'), '👤');
});
test('empty returns default', () => {
  assert.equal(avatarEmoji(''), '👤');
});

// --- avatarName ---
console.log('\navatarName():');
test('known avatar returns name', () => {
  assert.equal(avatarName('miki-tikus'), 'Miki Tikus');
});
test('unknown returns default', () => {
  assert.equal(avatarName('unknown'), 'User');
});

// --- avatarUrl ---
console.log('\navatarUrl():');
test('returns dicebear URL', () => {
  const url = avatarUrl('miki-tikus');
  assert.ok(url.includes('dicebear.com'), 'should be dicebear URL');
  assert.ok(url.includes('miki-tikus'), 'should contain seed');
});
test('default seed', () => {
  const url = avatarUrl('');
  assert.ok(url.includes('dicebear.com'));
});

// --- update icon auto ---
console.log('\nupdate icon:');
test('cmpVer compares semver', () => {
  const cmp = sandbox.cmpVer;
  assert.equal(cmp('1.6.1', 'v1.6.1'), 0);
  assert.equal(cmp('1.6.1', '1.6.2'), -1);
  assert.equal(cmp('1.6.10', '1.6.2'), 1);
  assert.equal(cmp('1.6.1', '1.6.10'), -1);
});
test('onUpToDate swaps complete icon', () => {
  sandbox.window.onUpToDate();
  const ic = sandbox.document.querySelector('#dupdate .ic');
  assert.ok(ic.innerHTML.includes('M16 30'), 'complete svg');
});
test('onUpdate swaps now icon', () => {
  sandbox.window.onUpdate('v9.9.9');
  const ic = sandbox.document.querySelector('#dupdate .ic');
  assert.ok(ic.innerHTML.includes('m27 25.586'), 'now svg');
  sandbox.document.getElementById('ubanner').classList.remove('show');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
