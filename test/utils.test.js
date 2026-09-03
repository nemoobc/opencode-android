/**
 * utils.test.js — unit tests untuk utils.js functions
 * Test: esc, escAttr, mdRender, xorEncrypt/xorDecrypt
 */
import { strict as assert } from 'node:assert';
import { JSDOM } from 'jsdom';
import vm from 'node:vm';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="chat"></div><div id="toast"></div></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
const { window } = dom;

// Create sandbox with window globals
const sandbox = {
  window: window,
  document: window.document,
  localStorage: { getItem: () => null, setItem: () => {} },
  DOMParser: window.DOMParser,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  escape: globalThis.escape,
  unescape: globalThis.unescape,
};

vm.createContext(sandbox);

// Load utils.js into sandbox
const fs = await import('node:fs');
const utilsSrc = fs.readFileSync(new URL('../assets/ui/js/utils.js', import.meta.url), 'utf8');
vm.runInContext(utilsSrc, sandbox);

const { esc, escAttr, mdRender, xorEncrypt, xorDecrypt } = sandbox;

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

console.log('\n=== utils.test.js ===\n');

// --- esc ---
console.log('esc():');
test('esc < > &', () => {
  // esc only escapes & < > (NOT quotes)
  assert.equal(esc('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
});
test('esc does NOT escape quotes', () => {
  // This is the actual behavior of esc() — it only does & < >
  assert.equal(esc('"hello"'), '"hello"');
});
test('esc empty string', () => {
  assert.equal(esc(''), '');
});
test('esc no special chars', () => {
  assert.equal(esc('hello world'), 'hello world');
});
test('esc double encode safe', () => {
  assert.equal(esc('&amp;'), '&amp;amp;');
});

// --- escAttr ---
console.log('\nescAttr():');
test('escAttr quotes', () => {
  assert.equal(escAttr('a "b" c\'d'), 'a &quot;b&quot; c&#39;d');
});
test('escAttr angle brackets', () => {
  assert.equal(escAttr('<img src=x>'), '&lt;img src=x&gt;');
});
test('escAttr empty string', () => {
  assert.equal(escAttr(''), '');
});

// --- mdRender ---
console.log('\nmdRender():');
test('mdRender bold', () => {
  assert.equal(mdRender('**bold**'), '<p><b>bold</b></p>');
});
test('mdRender italic', () => {
  assert.equal(mdRender('*italic*'), '<p><i>italic</i></p>');
});
test('mdRender heading 1', () => {
  assert.equal(mdRender('# Title'), '<h1>Title</h1>');
});
test('mdRender heading 2', () => {
  assert.equal(mdRender('## Sub'), '<h2>Sub</h2>');
});
test('mdRender heading 3', () => {
  assert.equal(mdRender('### H3'), '<h3>H3</h3>');
});
test('mdRender heading 4', () => {
  assert.equal(mdRender('#### H4'), '<h4>H4</h4>');
});
test('mdRender code block', () => {
  const result = mdRender('```js\nconsole.log("hi")\n```');
  assert.ok(result.includes('class="cb"'), 'should have code block class');
  assert.ok(result.includes('js'), 'should have language');
  assert.ok(result.includes('console.log'), 'should have code content');
});
test('mdRender code block no lang', () => {
  const result = mdRender('```\nfoo\n```');
  assert.ok(result.includes('class="cb"'), 'should have code block class');
});
test('mdRender inline code', () => {
  assert.equal(mdRender('use `var`'), '<p>use <code class="ic">var</code></p>');
});
test('mdRender blockquote', () => {
  // mdRender expects raw > (not HTML-escaped)
  assert.equal(mdRender('> quote'), '<blockquote>quote</blockquote>');
});
test('mdRender hr', () => {
  assert.equal(mdRender('---'), '<hr>');
});
test('mdRender unordered list', () => {
  const result = mdRender('- item1\n- item2');
  assert.ok(result.includes('<ul>'), 'should have ul');
  assert.ok(result.includes('item1'));
  assert.ok(result.includes('item2'));
});
test('mdRender ordered list', () => {
  const result = mdRender('1. first\n2. second');
  assert.ok(result.includes('<ol>'), 'should have ol');
});
test('mdRender bullet • list', () => {
  const result = mdRender('• apel\n• jeruk');
  assert.ok(result.includes('<ul>'), 'should have ul');
  assert.ok(result.includes('apel'));
});
test('mdRender en-dash list', () => {
  const result = mdRender('– satu\n– dua');
  assert.ok(result.includes('<ul>'), 'should have ul');
});
test('mdRender link', () => {
  const result = mdRender('[click](https://example.com)');
  assert.ok(result.includes('href="#"'), 'should have link');
  assert.ok(result.includes('data-url'), 'should have data-url');
});
test('mdRender image', () => {
  const result = mdRender('![alt](https://img.png)');
  assert.ok(result.includes('<img'), 'should have img tag');
});
test('mdRender table', () => {
  const result = mdRender('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.ok(result.includes('<table>'), 'should have table');
  assert.ok(result.includes('<th>A</th>'), 'should have header');
  assert.ok(result.includes('<td>1</td>'), 'should have cell');
});
test('mdRender plain text', () => {
  assert.equal(mdRender('hello'), '<p>hello</p>');
});
test('mdRender empty', () => {
  assert.equal(mdRender(''), '');
});
test('mdRender XSS in inline code', () => {
  const result = mdRender('`<script>`');
  assert.ok(!result.includes('<script>'), 'should escape script');
});
test('mdRender multiple paragraphs', () => {
  const result = mdRender('para1\n\npara2');
  assert.ok(result.includes('para1'));
  assert.ok(result.includes('para2'));
});

// --- xorEncrypt / xorDecrypt ---
console.log('\nxorEncrypt/xorDecrypt():');
test('roundtrip simple text', () => {
  const text = 'Hello, World!';
  const pass = 'secret';
  const encrypted = xorEncrypt(text, pass);
  const decrypted = xorDecrypt(encrypted, pass);
  assert.equal(decrypted, text);
});
test('roundtrip unicode', () => {
  const text = 'Halo Dunia! 🌍';
  const pass = 'kunci123';
  const encrypted = xorEncrypt(text, pass);
  const decrypted = xorDecrypt(encrypted, pass);
  assert.equal(decrypted, text);
});
test('encrypted is not plaintext', () => {
  const encrypted = xorEncrypt('secret', 'key');
  assert.notEqual(encrypted, 'secret');
  assert.ok(encrypted.length > 0);
});
test('wrong password gives garbled output (no HMAC)', () => {
  // xorDecrypt does NOT verify password — it's simple XOR obfuscation
  const encrypted = xorEncrypt('hello', 'pass1');
  const result = xorDecrypt(encrypted, 'pass2');
  // should NOT equal original when wrong password used
  assert.notEqual(result, 'hello');
  assert.ok(result !== null, 'does not return null — no password verification');
});
test('invalid base64 returns null', () => {
  assert.equal(xorDecrypt('not-valid-base64!!!', 'key'), null);
});
test('empty text', () => {
  const encrypted = xorEncrypt('', 'key');
  assert.equal(xorDecrypt(encrypted, 'key'), '');
});
test('long password', () => {
  const encrypted = xorEncrypt('hi', 'longpassword');
  assert.equal(xorDecrypt(encrypted, 'longpassword'), 'hi');
});
test('single char', () => {
  const encrypted = xorEncrypt('X', 'K');
  assert.equal(xorDecrypt(encrypted, 'K'), 'X');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
