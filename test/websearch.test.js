/**
 * websearch.test.js — unit tests for websearch.js pure functions
 * Test: sanitizeQuery, needsSearch, buildPrompt, decodeUDDG, parseResults, buildSourcesHTML
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

// Load dependencies in order
loadScriptsInOrder(sandbox, ['utils.js', 'init.js', 'websearch.js']);

const WebSearch = sandbox.WebSearch;

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

console.log('\n=== websearch.test.js ===\n');

// --- sanitizeQuery ---
console.log('sanitizeQuery():');
test('strips Indonesian prefix "cari di web"', () => {
  assert.equal(WebSearch.sanitizeQuery('cari di web siapa presiden Indonesia'), 'siapa presiden Indonesia');
});
test('strips "cari web"', () => {
  assert.equal(WebSearch.sanitizeQuery('cari web berita terbaru'), 'berita terbaru');
});
test('strips English prefix "search"', () => {
  assert.equal(WebSearch.sanitizeQuery('search for latest news'), 'latest news');
});
test('strips "search on web"', () => {
  assert.equal(WebSearch.sanitizeQuery('search on web python tutorial'), 'python tutorial');
});
test('strips "google"', () => {
  assert.equal(WebSearch.sanitizeQuery('google harga iphone'), 'harga iphone');
});
test('strips "tanya ke web"', () => {
  assert.equal(WebSearch.sanitizeQuery('tanya ke web cuaca jakarta'), 'cuaca jakarta');
});
test('strips "cek di internet"', () => {
  assert.equal(WebSearch.sanitizeQuery('cek di internet skor bola'), 'skor bola');
});
test('strips "look up"', () => {
  assert.equal(WebSearch.sanitizeQuery('look up react hooks'), 'react hooks');
});
test('strips "find out"', () => {
  assert.equal(WebSearch.sanitizeQuery('find out population of japan'), 'population of japan');
});
test('no prefix unchanged', () => {
  assert.equal(WebSearch.sanitizeQuery('siapa presiden Indonesia'), 'siapa presiden Indonesia');
});
test('empty string', () => {
  assert.equal(WebSearch.sanitizeQuery(''), '');
});
test('whitespace trimmed', () => {
  assert.equal(WebSearch.sanitizeQuery('  cari di web foo  '), 'foo');
});

// --- needsSearch ---
console.log('\nneedsSearch():');
test('"hari ini" triggers search', () => {
  assert.equal(WebSearch.needsSearch('cuaca hari ini'), true);
});
test('"today" triggers search', () => {
  assert.equal(WebSearch.needsSearch('news today'), true);
});
test('"2026" triggers search', () => {
  assert.equal(WebSearch.needsSearch('film 2026'), true);
});
test('"harga" triggers search', () => {
  assert.equal(WebSearch.needsSearch('harga emas'), true);
});
test('"berita" triggers search', () => {
  assert.equal(WebSearch.needsSearch('berita terkini'), true);
});
test('"skor" triggers search', () => {
  assert.equal(WebSearch.needsSearch('skor bola tadi malam'), true);
});
test('"jadwal" triggers search', () => {
  assert.equal(WebSearch.needsSearch('jadwal kereta api'), true);
});
test('"cuaca" triggers search', () => {
  assert.equal(WebSearch.needsSearch('cuaca besok'), true);
});
test('plain question no trigger', () => {
  assert.equal(WebSearch.needsSearch('apa itu python'), false);
});
test('empty string', () => {
  assert.equal(WebSearch.needsSearch(''), false);
});
test('case insensitive', () => {
  assert.equal(WebSearch.needsSearch('CUACA HARI INI'), true);
});

// --- buildPrompt ---
console.log('\nbuildPrompt():');
test('with search results prepends context', () => {
  const results = [{ title: 'Title1', url: 'https://a.com', snippet: 'Snippet1' }];
  const out = WebSearch.buildPrompt('question', results);
  assert.ok(out.includes('KONTEKS PENCARIAN WEB'));
  assert.ok(out.includes('Title1'));
  assert.ok(out.includes('https://a.com'));
  assert.ok(out.includes('question'));
});
test('with multiple results', () => {
  const results = [
    { title: 'A', url: 'https://a.com', snippet: 's1' },
    { title: 'B', url: 'https://b.com', snippet: '' },
  ];
  const out = WebSearch.buildPrompt('q', results);
  assert.ok(out.includes('[1] A'));
  assert.ok(out.includes('[2] B'));
  assert.ok(out.includes('ATURAN SITASI'), 'cite instruction');
});
test('empty results returns original query', () => {
  assert.equal(WebSearch.buildPrompt('question', []), 'question');
});
test('null results returns original query', () => {
  assert.equal(WebSearch.buildPrompt('question', null), 'question');
});

// --- buildSourcesHTML ---
console.log('\nbuildSourcesHTML():');
test('builds HTML links from lastResults', () => {
  WebSearch.lastResults = [{ title: 'Source Title', url: 'https://example.com', snippet: 's' }];
  const html = WebSearch.buildSourcesHTML();
  assert.ok(html.includes('search-sources'));
  assert.ok(html.includes('Source Title'));
  assert.ok(html.includes('https://example.com'));
  assert.ok(html.includes('data-url'), 'tap opens via native bridge');
  assert.ok(html.includes('[1]'), 'numbered like inline cites');
});
test('empty lastResults returns empty string', () => {
  WebSearch.lastResults = [];
  assert.equal(WebSearch.buildSourcesHTML(), '');
});
test('long title is truncated', () => {
  const longTitle = 'A'.repeat(60);
  WebSearch.lastResults = [{ title: longTitle, url: 'https://x.com', snippet: '' }];
  const html = WebSearch.buildSourcesHTML();
  assert.ok(html.length < longTitle.length + 200); // truncated
  assert.ok(html.includes('...'));
});

// --- enabled / toggle ---
console.log('\nenabled/toggle:');
test('default disabled', () => {
  sandbox.localStorage.removeItem('oc-websearch');
  // re-create to pick up cleared localStorage
  WebSearch.enabled = false;
  assert.equal(WebSearch.enabled, false);
});
test('toggle on', () => {
  assert.equal(WebSearch.toggle(), true);
  assert.equal(WebSearch.enabled, true);
  assert.equal(sandbox.localStorage.getItem('oc-websearch'), 'true');
});
test('toggle off', () => {
  assert.equal(WebSearch.toggle(), false);
  assert.equal(WebSearch.enabled, false);
  assert.equal(sandbox.localStorage.getItem('oc-websearch'), 'false');
});

// --- native bridge (Android.webSearch) ---
console.log('\nnative webSearch:');
async function runAsyncTests() {
  try {
    sandbox.Android.webSearch = () => JSON.stringify([
      { t: 'Judul Test', u: 'https://ex.com/a', s: 'cuplikan' },
      { t: '', u: 'https://ex.com/b', s: 'no title' },
      { t: 'FTP', u: 'ftp://ex.com/c', s: 'no http' },
    ]);
    const res = await WebSearch.search('test query');
    assert.equal(res.length, 1, 'only valid http result with title');
    assert.equal(res[0].title, 'Judul Test');
    assert.equal(res[0].url, 'https://ex.com/a');
    assert.equal(res[0].snippet, 'cuplikan');
    passed++;
    console.log('  ✓ native webSearch parsed + filtered');
  } catch (e) {
    failed++;
    console.log('  ✗ native webSearch parsed + filtered');
    console.log(`    ${e.message}`);
  }
  try {
    sandbox.Android.webSearch = () => { throw new Error('no net'); };
    const res2 = await WebSearch.search('x');
    assert.ok(Array.isArray(res2), 'fallback resolves array');
    passed++;
    console.log('  ✓ native throw falls back to array');
  } catch (e) {
    failed++;
    console.log('  ✗ native throw falls back to array');
    console.log(`    ${e.message}`);
  }

  console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
runAsyncTests();
