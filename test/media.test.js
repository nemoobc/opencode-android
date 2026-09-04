/**
 * media.test.js — unit tests for media.js pure fns
 * Test: imgRequest, cleanImgPrompt, imgUrl, fileRequest, fileName, extractCode
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

loadScriptsInOrder(sandbox, ['utils.js', 'media.js']);

const Media = sandbox.Media;

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

console.log('\n=== media.test.js ===\n');

// --- imgRequest ---
console.log('imgRequest():');
test('detects Indonesian request', () => {
  assert.ok(Media.imgRequest('buatkan gambar kucing astronot'));
});
test('detects tolong + image', () => {
  assert.ok(Media.imgRequest('tolong buatin foto pemandangan'));
});
test('detects English draw', () => {
  assert.ok(Media.imgRequest('draw me a picture of a dragon'));
});
test('rejects question about image', () => {
  assert.equal(Media.imgRequest('gambar apa itu?'), null);
});
test('prefix image word triggers', () => {
  assert.ok(Media.imgRequest('gambar kucing tidur'));
  assert.ok(Media.imgRequest('foto senja di pantai'));
});
test('marker dong/ya triggers', () => {
  assert.ok(Media.imgRequest('minta gambar kucing dong'));
});
test('rejects plain chat', () => {
  assert.equal(Media.imgRequest('halo apa kabar'), null);
});
test('rejects empty', () => {
  assert.equal(Media.imgRequest(''), null);
});

// --- cleanImgPrompt ---
console.log('\ncleanImgPrompt():');
test('strips request words', () => {
  const out = Media.cleanImgPrompt('tolong buatkan gambar kucing astronot');
  assert.ok(!/tolong|buatkan/i.test(out), 'got: ' + out);
  assert.ok(out.includes('kucing'), 'got: ' + out);
});

// --- imgUrl ---
console.log('\nimgUrl():');
test('builds pollinations URL', () => {
  const u = Media.imgUrl('kucing', 42);
  assert.ok(u.startsWith('https://image.pollinations.ai/prompt/'), 'host');
  assert.ok(u.includes(encodeURIComponent('kucing')), 'prompt encoded');
  assert.ok(u.includes('seed=42'), 'seed');
});
test('random seed default', () => {
  const a = Media.imgUrl('x');
  const b = Media.imgUrl('x');
  assert.ok(/seed=\d+/.test(a), 'has seed');
});

// --- fileRequest ---
console.log('\nfileRequest():');
test('detects buatkan file', () => {
  assert.ok(Media.fileRequest('buatkan file kode python kalkulator'));
});
test('detects kirim sebagai file', () => {
  assert.ok(Media.fileRequest('kirim sebagai file ya'));
});
test('rejects normal question', () => {
  assert.equal(Media.fileRequest('jelaskan fotosintesis'), false);
});

// --- fileName ---
console.log('\nfileName():');
test('explicit name wins', () => {
  assert.equal(Media.fileName('simpan ke app.py ya', 'python'), 'app.py');
});
test('lang maps to ext', () => {
  assert.equal(Media.fileName('buatkan kode', 'python'), 'kode.py');
  assert.equal(Media.fileName('buatkan kode', 'javascript'), 'kode.js');
  assert.equal(Media.fileName('buatkan kode', ''), 'kode.txt');
});

// --- extractCode ---
console.log('\nextractCode():');
test('extracts fenced code', () => {
  const r = Media.extractCode('ini dia:\n```python\nprint(1)\n```\ndone');
  assert.equal(r.lang, 'python');
  assert.equal(r.code, 'print(1)');
});
test('plain text fallback', () => {
  const r = Media.extractCode('hello world');
  assert.equal(r.lang, '');
  assert.equal(r.code, 'hello world');
});

// --- cleanExpanded + userNegatives + ref (nurut user) ---
console.log('\nauto nurut:');
test('strips AI chatter label', () => {
  assert.equal(Media.cleanExpanded('Here is your prompt: a cute cat'), 'a cute cat');
});
test('jangan/tanpa jadi no-X', () => {
  assert.equal(Media.userNegatives('kucing tanpa teks'), ', no text (teks)');
  assert.equal(Media.userNegatives('kucing lucu'), '');
});
test('ref jaga rasio + gaya', () => {
  assert.ok(/768.*1024/.test(Media.imgUrl('EN certificate paper', 7, null, true, 'poster sertifikat')));
  assert.ok(/anime/i.test(Media.imgUrl('EN cat samurai', 7, null, true, 'gaya anime: kucing')));
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
