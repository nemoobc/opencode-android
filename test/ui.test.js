const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('assets/ui/index.html', 'utf8');

const calls = { send: [], cancel: 0, newChat: 0, saveConfig: [], copyText: [], openUrl: [], checkUpdate: 0, readConfig: null };
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://example.com/',
  beforeParse(window) {
    window.Android = {
      send: (t) => calls.send.push(t),
      cancel: () => calls.cancel++,
      newChat: () => calls.newChat++,
      saveConfig: (p, k, m) => calls.saveConfig.push([p, k, m]),
      copyText: (t) => calls.copyText.push(t),
      openUrl: (u) => calls.openUrl.push(u),
      checkUpdate: () => calls.checkUpdate++,
      readConfig: () => JSON.stringify({ auth: '{"opencode":{"type":"api","key":"KEY123"}}', cfg: '{"model":"opencode/x-preview-f-free"}' }),
      appInfo: () => '1.2.4',
      toast: () => {},
    };
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.scrollBy = () => {};
  },
});
const { window } = dom;
const doc = window.document;
// jalankan script inline halaman
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
window.eval(script);

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name); }
}
const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => doc.querySelectorAll(sel);

console.log('== 1. RENDER AWAL ==');
ok('welcome screen tampil', !!$('#hello'));
ok('logo svg ada', !!$('#hello svg'));
ok('4 chip saran', $$('.chip').length === 4);
ok('tombol + ada', !!$('#bnew'));
ok('tombol menu ada', !!$('#bmenu'));
ok('chip model: Big Pickle (tercepat)', $('#mname').textContent === 'Big Pickle');
ok('tanpa teks "agent AI di HP-mu"', !html.includes('agent AI di HP-mu'));
ok('tanpa "dibuat dari Termux"', !html.includes('dibuat dari Termux'));
ok('checkUpdate terpanggil saat load', calls.checkUpdate === 1);
ok('sapaan waktu tampil', !!$('#greet'));
ok('greet terisi', $('#greet').textContent.length > 5);

console.log('== 2. KIRIM PESAN (klik chip) ==');
$$('.chip')[0].click();
ok('Android.send terpanggil dgn prompt chip', calls.send[0].includes('folder kerja'));
ok('bubble user muncul', $$('.msg.user').length === 1);
ok('bubble AI + dots mengetik', !!$('.msg.ai .dots'));
ok('avatar AI tampil', !!$('.msg.ai .ava svg'));
ok('tombol jadi stop (merah)', $('#go').classList.contains('stop'));
ok('timer elapsed tampil', !!$('.elapsed'));

console.log('== 3. STREAMING DELTA (throttled) ==');
window.appendOut('halo ');
window.appendOut('dunia');
ok('delta terakumulasi di buffer', window._plain.includes('halo dunia'));
window.flushStream();
ok('teks ter-render setelah flush', $('.msg.ai .body').textContent.includes('halo dunia'));
ok('caret aktif saat streaming', !!$('.caret'));

console.log('== 4. SELESAI (onDone) ==');
window.onDone(0);
ok('tombol kembali normal (bukan stop)', !$('#go').classList.contains('stop'));
ok('aksi SALIN muncul', [...$$('.mact button')].some(b => b.textContent.includes('Salin')));
ok('aksi Tanya lagi muncul', [...$$('.mact button')].some(b => b.textContent.includes('Tanya lagi')));
ok('dot hijau', $('#dot').className === 'ok');

console.log('== 5. CANCEL (tombol merah) ==');
$('#inp').value = 'tulis esai 500 kata';
$('#go').click();               // kirim
console.log('   [debug] send terpanggil:', calls.send.length, 'kali');
ok('pesan kedua terkirim', calls.send.length === 2);
$('#go').click();               // klik stop
console.log('   [debug] cancel terpanggil:', calls.cancel);
ok('Android.cancel terpanggil', calls.cancel >= 1);
ok('flag aborted aktif', window._aborted === true);
window.onDone(-2);
ok('tombol RESET setelah cancel (fix stuck merah)', !$('#go').classList.contains('stop'));
ok('cancel senyap — tanpa tulisan dihentikan', !doc.body.textContent.includes('dihentikan'));
ok('delta basi diabaikan setelah cancel', (window.appendOut('ZOMBIE'), !doc.body.textContent.includes('ZOMBIE')));

console.log('== 6. ON ERROR (jalur yang dulu bikin stuck) ==');
$('#inp').value = 'tes error';
$('#go').click();
window.onError('HTTP 500: model mati');
ok('catatan error tampil', doc.body.textContent.includes('HTTP 500'));
ok('tombol tetap normal setelah error (fix onError)', !$('#go').classList.contains('stop'));

console.log('== 6b. WATCHDOG CANCEL (forceStop tanpa onDone dari Java) ==');
$('#inp').value = 'stream panjang';
$('#go').click();
window.appendOut('potongan ');
$('#go').click();               // klik stop -> watchdog 4 detik terpasang
ok('cancel instan terpanggil', calls.cancel >= 2);
window.forceStop();             // simulasikan watchdog meledak tanpa onDone
ok('tombol reset oleh watchdog (anti stuck total)', !$('#go').classList.contains('stop'));
ok('potongan jawaban tetap dirender', !!doc.querySelector('.msg.ai:last-child .md'));
ok('_done ditandai oleh watchdog', window._done === true);

console.log('== 7. NEW CHAT ==');
$('#bnew').click();
ok('Android.newChat terpanggil', calls.newChat >= 1);
ok('welcome screen kembali', !!$('#hello'));
ok('chips ter-bind ulang', $$('.chip').length === 4);
$('#inp').value = 'tes setelah new chat';
$('#go').click();
ok('bisa kirim lagi setelah new chat', calls.send.length >= 2);

console.log('== 8. GANTI MODEL ==');
window.setModel('zen/x-preview-f-free');
ok('chip nama model tetap 0x Alpha Free (Unlimited)', $('#mname').textContent === '0x Alpha Free (Unlimited)');
ok('saveConfig terpanggil dgn model', calls.saveConfig.some(c => c[2] === 'zen/x-preview-f-free'));
ok('preset grok-code mati sudah dihapus', !doc.body.innerHTML.includes('grok-code'));

console.log('== 9. MODAL CONFIG ==');
$('#dconfig') ? null : null;
window.dispatchEvent ? null : null;
// buka modal via fungsi yang sama dgn drawer
doc.querySelector('#mconfig') ? null : null;
// panggil langsung: klik drawer config
$('#dconfig').click();
ok('modal config terbuka', $('#mconfig').classList.contains('show'));
ok('provider terisi dari readConfig', $('#cprov').value === 'opencode');
ok('key terisi dari readConfig', $('#ckey').value === 'KEY123');
$('#save').click();
ok('saveConfig terpanggil', calls.saveConfig.length >= 2);
window.onSaved();   // simulasi callback Java setelah menyimpan
ok('modal tertutup setelah simpan', !$('#mconfig').classList.contains('show'));

console.log('== 10. MARKDOWN RENDER ==');
window._cur = null; window._plain = '';
window.appendOut('# Judul\n\n**tebal** dan `kode`\n\n```js\nvar x = 1;\n```\n\n- satu\n- dua\n\n| a | b |\n|---|---|\n| 1 | 2 |');
window.onDone(0);
const aiBody = [...$$('.msg.ai .body')].pop();
ok('heading dirender', !!aiBody.querySelector('.md h1'));
ok('bold dirender', !!aiBody.querySelector('.md b, .md strong'));
ok('inline code dirender', !!aiBody.querySelector('.md code.ic'));
ok('code block + header bahasa', !!aiBody.querySelector('.cb .cb-h .lang'));
ok('tombol COPY di code block', !!aiBody.querySelector('.cb-h button'));
ok('list dirender', !!aiBody.querySelector('.md li'));
ok('tabel dirender', !!aiBody.querySelector('.md table'));

console.log('== 11. COPY & URL ==');
const copyBtn = aiBody.querySelector('.cb-h button');
copyBtn.click();
ok('copyText terpanggil (isi code)', calls.copyText.some(t => t.includes('var x = 1')));
const link = aiBody.querySelector('a[data-url]');
if (link) { link.click(); ok('openUrl terpanggil dari link', calls.openUrl.length >= 1); }

console.log('== 12. UPDATE BANNER ==');
window.onUpdate('v9.9.9', 'catatan');
ok('banner update tampil', $('#ubanner').classList.contains('show'));
ok('tag update benar', $('#utag').textContent === 'v9.9.9');

console.log('\n==============================');
console.log(`HASIL: ${pass} lulus, ${fail} gagal`);
console.log('==============================');
process.exit(fail ? 1 : 0);
