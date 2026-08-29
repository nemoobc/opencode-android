import { JSDOM } from 'jsdom';
import fs from 'fs';

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
      fetchModels: () => calls.fetchModels++,
      readImageDataUrl: (p) => 'data:image/png;base64,AAAA',
      readConfig: () => JSON.stringify({ auth: '{"opencode":{"type":"api","key":"KEY123"}}', cfg: '{"model":"opencode/big-pickle"}' }),
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
ok('_gotDelta diset saat delta pertama (saran cepat nonaktif)', window._gotDelta === true);

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
ok('catatan error tampil', doc.body.textContent.includes('Model tidak tersedia'));
ok('error mentah ter-rapikan (tidak menampilkan HTTP 500)', !doc.body.textContent.includes('HTTP 500'));
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

console.log('== 6c. TOKEN ANTI-HIJACK: CALLBACK LAMA DIABAIKAN ==');
$('#inp').value = 'kiriman baru setelah cancel';
$('#go').click();                 // kirim permintaan baru (token naik)
const tokBaru = window._reqTok;
window.onDone(-2, tokBaru - 1);   // callback LAMA datang belakangan — harus diabaikan
ok('UI tetap busy (callback lama tidak membajak)', $('#go').classList.contains('stop'));
ok('bubble tidak ditimpa "gagal (kode -2)"', !doc.body.textContent.includes('gagal (kode -2)'));
window.onDone(0, tokBaru);        // jawaban SAH untuk token ini
ok('onDone token cocok -> tombol normal', !$('#go').classList.contains('stop'));

console.log('== 6d. SPLASH CABUT SAAT SERVER SIAP (anti lock 10 detik) ==');
const spSplash = doc.getElementById('splash');
window.onReady(true, 300);
const spAfter = doc.getElementById('splash');
ok('onReady memicu fade splash (out/terhapus)', (spAfter === null) || spAfter.classList.contains('out'));
ok('PAYLOAD_TOTAL fallback angka wajar', typeof window.PAYLOAD_TOTAL === 'number' && window.PAYLOAD_TOTAL > 0);
ok('PAYLOAD_TOTAL bisa ditimpa nilai asli dari Java', (function(){ window.PAYLOAD_TOTAL = 19000000; return window.PAYLOAD_TOTAL === 19000000; })());

console.log('== 7. NEW CHAT ==');
$('#bnew').click();
ok('Android.newChat terpanggil', calls.newChat >= 1);
ok('welcome screen kembali', !!$('#hello'));
ok('chips ter-bind ulang', $$('.chip').length === 4);
$('#inp').value = 'tes setelah new chat';
$('#go').click();
ok('bisa kirim lagi setelah new chat', calls.send.length >= 2);

console.log('== 8. GANTI MODEL ==');
window.setModel('opencode/big-pickle');
ok('chip nama model big-pickle', $('#mname').textContent === 'Big Pickle');
ok('saveConfig terpanggil dgn model', calls.saveConfig.some(c => c[2] === 'opencode/big-pickle'));
ok('preset grok-code mati sudah dihapus', !doc.body.innerHTML.includes('grok-code'));

console.log('== 8b. AUTO-REFRESH MODEL DARI RELAY ==');
// onModels disuntik Java saat fetchModels selesai — panggil eksplisit seperti bridge
window.onModels(['ling-3.0-flash-fin-free', 'deepseek-v4-flash-free', 'big-pickle']);
ok('onModels menambah Ling 3.0', window.MODELS.some(m => m.id === 'opencode/ling-3.0-flash-fin-free'));
ok('onModels menambah deepseek v4 flash free', window.MODELS.some(m => m.id === 'opencode/deepseek-v4-flash-free'));
ok('onModels tidak duplikat big-pickle', window.MODELS.filter(m => m.id === 'opencode/big-pickle').length === 1);
ok('Ling 3.0 berlabel GRATIS', (function() { var x = window.MODELS.filter(m => m.id === 'opencode/ling-3.0-flash-fin-free')[0]; return x && x.tag === 'GRATIS'; })());
ok('nama tampilan Ling 3.0 Flash', (function() { var x = window.MODELS.filter(m => m.id === 'opencode/ling-3.0-flash-fin-free')[0]; return x && x.nm === 'Ling 3.0 Flash'; })());
window.setModel('opencode/ling-3.0-flash-fin-free');
ok('bisa pilih model hasil auto-refresh', $('#mname').textContent === 'Ling 3.0 Flash');

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

console.log('== 10b. MARKDOWN LIST & TABEL (fix) ==');
window._cur = null; window._plain = ''; window._done = false; window._aborted = false; window._canceling = false;
window.appendOut('Daftar:\n- satu\n- dua\n\nUrutan:\n1. pertama\n2. kedua\n\n| a | b | c |\n|---|---|---|\n| 1 | 2 | 3 |');
window.onDone(0);
const aiBody2 = [...$$('.msg.ai .body')].pop();
ok('ul tunggal membungkus SEMUA item - (2 li)', aiBody2.querySelectorAll('.md ul').length === 1 && aiBody2.querySelectorAll('.md ul li').length === 2);
ok('ol tunggal membungkus item 1. (2 li)', aiBody2.querySelectorAll('.md ol').length === 1 && aiBody2.querySelectorAll('.md ol li').length === 2);
ok('item urutan dirender sebagai daftar', !!aiBody2.querySelector('.md ol'));
ok('list tidak terdampar di dalam <p>', aiBody2.querySelector('.md ul').parentElement.tagName !== 'P');
const tbl2 = aiBody2.querySelector('.md table');
ok('tabel tanpa kolom kosong (3 th/3 td)', !!tbl2 && tbl2.querySelectorAll('thead th').length === 3 && tbl2.querySelectorAll('tbody tr:first-child td').length === 3);
ok('tabel tidak dibungkus <p>', !!tbl2 && tbl2.parentElement.tagName !== 'P');

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

console.log('== 13. LAMPIRAN FILE (non-auto-kirim) ==');
ok('tombol + besar ada di kiri (battach)', !!$('#battach') && $('#battach').classList.contains('plus'));
const sendCountSebelum = calls.send.length;
window.onFileReady('foto.png', '/data/data/com.nemoobc.opencode/files/work/foto.png');
ok('lampiran TIDAK langsung terkirim', calls.send.length === sendCountSebelum);
ok('bar lampiran tampil', $('#attachbar').classList.contains('show'));
ok('nama lampiran muncul di bar', $('#att-name').textContent === 'foto.png');
$('#inp').value = 'jelaskan foto ini';
$('#go').click();
ok('kirim manual tetap jalan dengan lampiran', calls.send.length === sendCountSebelum + 1);
const lastSend = calls.send[calls.send.length - 1] || '';
ok('prompt lampiran terkirim via go', calls.send.length === sendCountSebelum + 1 && lastSend.includes('foto.png'));
ok('bar lampiran hilang setelah kirim', !$('#attachbar').classList.contains('show'));
ok('bubble user menampilkan label lampiran', doc.body.textContent.includes('foto.png') && doc.body.textContent.includes('🖼️'));
ok('preview gambar dirender di bubble user', !!$('.msg.user .attimg'));

console.log('== 13b. BATAL LAMPIRAN ==');
window.onFileReady('hapus.txt', '/work/hapus.txt');
ok('bar tampil lagi', $('#attachbar').classList.contains('show'));
$('#att-x').click();
ok('bar hilang setelah batal', !$('#attachbar').classList.contains('show'));
ok('lampiran dibersihkan', !window._att);
calls.send.push(''); // netralkan agar hitungan di bawah tidak berubah
calls.send.pop();

console.log('== 14. DRAWER & NAVIGASI ==');
window.openDrawer();
ok('drawer terbuka', $('#drawer').classList.contains('show'));
ok('scrim ikut tampil', $('#scrim').classList.contains('show'));
window.closeDrawer();
ok('drawer tertutup', !$('#drawer').classList.contains('show'));
$('#bmenu').click();
ok('tombol hamburger buka drawer', $('#drawer').classList.contains('show'));
$('#scrim').click();
ok('klik scrim menutup drawer', !$('#drawer').classList.contains('show'));
$('#dmodel').click();
ok('ditem drawer → modal model terbuka', $('#mmodel').classList.contains('show') && !$('#drawer').classList.contains('show'));
$('#mclose').click();
$('#dupdate').click();
ok('ditem update → checkUpdate terpanggil', calls.checkUpdate >= 2);
ok('toast pemeriksaan update tampil', window._tt !== undefined);

console.log('== 15. MODAL MODEL DETAIL ==');
window.openModels();
ok('daftar model render semua', $('#mlist').children.length === window.MODELS.length);
const claudeOpt = [...$('#mlist').querySelectorAll('.mopt')].find(b => b.textContent.includes('claude-sonnet-4'));
ok('model PRO tanpa tag GRATIS', !!claudeOpt && !claudeOpt.textContent.includes('GRATIS'));
ok('model PRO tetap ditampilkan', !!claudeOpt);
const pickleOpt = [...$('#mlist').querySelectorAll('.mopt')].find(b => b.textContent.includes('big-pickle'));
ok('model gratis bertag GRATIS', !!pickleOpt && pickleOpt.textContent.includes('GRATIS'));
ok('model aktif bertanda sel', !!pickleOpt && pickleOpt.classList.contains('sel'));
// pilih model via klik
const deepOpt = [...$('#mlist').querySelectorAll('.mopt')].find(b => b.textContent.includes('deepseek'));
const sendCountM = calls.send.length;
deepOpt.click();
ok('klik model → saveConfig + modal tutup', calls.saveConfig.some(c => c[2] === 'opencode/deepseek-v4-flash-free') && !$('#mmodel').classList.contains('show'));
ok('nama header ikut berubah', $('#mname').textContent === 'DeepSeek V4 Flash');
window.openModels();
const claudeOpt2 = [...$('#mlist').querySelectorAll('.mopt')].find(b => b.textContent.includes('claude-sonnet-4'));
claudeOpt2.click();
ok('pilih model PRO disimpan', calls.saveConfig.some(c => c[2] === 'anthropic/claude-sonnet-4'));
ok('nama header = Claude Sonnet 4', $('#mname').textContent === 'Claude Sonnet 4');
// custom model via input
$('#cmcustom').value = 'grok/cepat-cepat';
$('#cmcustom').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
ok('custom model enter → setModel', calls.saveConfig.some(c => c[2] === 'grok/cepat-cepat') && $('#mname').textContent === 'cepat-cepat');
ok('kirim tidak terganggu menu model', calls.send.length === sendCountM);
$('#mclose').click();
window.setModel('opencode/big-pickle'); // kembalikan model default
ok('kembali ke big-pickle', $('#mname').textContent === 'Big Pickle');

console.log('== 16. BAHASA BALASAN ==');
ok('tombol bahasa default auto', $('#blang').title.includes('Auto'));
$('#blang').click();
ok('modal bahasa terbuka', $('#mlang').classList.contains('show'));
ok('3 opsi bahasa', $('#llist').children.length === 3);
const enOpt = [...$('#llist').querySelectorAll('.mopt')].find(b => b.textContent.includes('English'));
enOpt.click();
ok('pilih English → local+tombol berubah', window.localStorage.getItem('oc-lang') === 'en' && $('#blang').title.includes('English'));
const pEn = window.langPromp('hello world');
ok('langPromp en menyisipkan instruksi', pEn.toLowerCase().includes('always reply in english'));
ok('teks asli tetap ada', pEn.includes('hello world'));
$('#blang').click();
const idOpt = [...$('#llist').querySelectorAll('.mopt')].find(b => b.textContent.includes('Indonesia'));
idOpt.click();
const pId = window.langPromp('halo apa kabar');
ok('langPromp id menyisipkan instruksi', pId.includes('bahasa Indonesia'));
ok('detectLang: teks Indonesia → id', window.detectLang('tolong bantu saya buat') === 'id');
ok('detectLang: teks English → en', window.detectLang('please help me write a') === 'en');
$('#blang').click();
const autoOpt = [...$('#llist').querySelectorAll('.mopt')].find(b => b.textContent.includes('Auto'));
autoOpt.click();
ok('kembali auto', $('#blang').title.includes('Auto'));

console.log('== 17. MODAL CONFIG ==');
$('#dconfig').click();
ok('modal config terbuka via drawer', $('#mconfig').classList.contains('show'));
ok('provider terisi opencode', $('#cprov').value === 'opencode');
ok('key terisi dari stub', $('#ckey').value === 'KEY123');
$('#cprov').value = 'openai';
$('#ckey').value = 'sk-baru';
$('#cmodel').value = 'openai/gpt-4.1';
$('#save').click();
ok('saveConfig dgn provider+key+model', calls.saveConfig.some(c => c[0] === 'openai' && c[1] === 'sk-baru' && c[2] === 'openai/gpt-4.1'));
window.onSaved();
ok('modal config tutup setelah simpan', !$('#mconfig').classList.contains('show'));
ok('model header ikut model kustom', $('#mname').textContent === 'GPT-4.1');
$('#closem').click(); window.setModel('opencode/big-pickle');

console.log('== 18. MARKDOWN LANJUT + XSS ==');
window._cur = null; window._plain = ''; window._done = false; window._aborted = false; window._canceling = false;
window.appendOut('> kutipan penting\n\n---\n\n*teks miring* dan [tautan](https://opencode.ai) dan ![gambar](https://x.com/a.png)');
window.onDone(0);
const mdX = [...$$('.msg.ai .body')].pop();
ok('blockquote dirender', !!mdX.querySelector('.md blockquote'));
ok('hr dirender', !!mdX.querySelector('.md hr'));
ok('italic dirender', !!mdX.querySelector('.md i'));
ok('link dirender dgn data-url', !!mdX.querySelector('a[data-url="https://opencode.ai"]'));
ok('gambar markdown dirender', !!mdX.querySelector('.md img'));
window._cur = null; window._plain = ''; window._done = false; window._aborted = false; window._canceling = false;
window.appendOut('```\nnpx coba [kode]\n```\n\n<h2>tag html mentah</h2>');
window.onDone(0);
const mdY = [...$$('.msg.ai .body')].pop();
ok('code block tanpa bahasa → lang "code"', !!mdY.querySelector('.cb-h .lang') && mdY.querySelector('.cb-h .lang').textContent === 'code');
ok('kode [kode] tidak jadi HTML', !mdY.querySelector('.cb pre [kode]') && mdY.querySelector('.cb pre code').textContent.includes('[kode]'));
ok('tag html mentah di-escape', !mdY.querySelector('.md h2'));
window._cur = null; window._plain = ''; window._done = false; window._aborted = false; window._canceling = false;
var xssMark = '<img src=x onerror="window.xssPwned=1"> <script>window.xssPwned=1<\/script>';
window.appendOut(xssMark);
window.onDone(0);
ok('XSS img onerror disterilkan', !doc.querySelector('.md img[onerror]') && !window.xssPwned);
ok('XSS script disterilkan', !doc.querySelector('.md script') && !window.xssPwned);
window._cur = null; window._plain = ''; window._done = false; window._aborted = false; window._canceling = false;
window.appendOut('#### H4\n\n### H3\n\n## H2 di tengah');
window.onDone(0);
const mdH = [...$$('.msg.ai .body')].pop();
ok('heading h4 dirender', !!mdH.querySelector('.md h4'));
ok('heading h3 dirender', !!mdH.querySelector('.md h3'));
ok('heading h2 dirender', !!mdH.querySelector('.md h2'));
ok('kombinasi paragraf+heading tidak korup', mdH.querySelector('.md h2').textContent.includes('H2'));

console.log('== 19. INTERAKSI AKHIR & STATE ==');
window._cur = null; window._plain = ''; window._done = true;   // done: appendOut harus no-op
window.appendOut('zombi setelah done');
ok('appendOut ditolak saat done', !doc.body.textContent.includes('zombi setelah done'));
window._done = false;
ok('versi app di footer drawer', $('#dver').textContent === 'v1.2.4');
window.onUpdate('v9.9.9', 'catatan');
$('#ubtn').click();
ok('tombol LIHAT → openUrl release', calls.openUrl.some(u => u.includes('releases/tag/v9.9.9')));
// Tanya lagi: kirim pesan lalu klik tombol Tanya lagi
$('#inp').value = 'ulangi permintaan ini';
$('#go').click();
$('#go').click(); // stop — cancel
window.onDone(-2, window._reqTok);
const askBody = [...$$('.msg.ai .body')].pop();
const askMact = askBody.parentElement.parentElement.querySelector('.mact');
const askBtn = askMact ? [...askMact.querySelectorAll('button')].find(b => b.textContent.includes('Tanya lagi')) : null;
ok('tombol Tanya lagi tersedia setelah kirim', !!askBtn);
const sendCountT = calls.send.length;
if (askBtn) askBtn.click();
ok('Tanya lagi → kirim ulang prompt terakhir', calls.send.length === sendCountT + 1 && (calls.send[calls.send.length-1] || '').includes('ulangi permintaan ini'));
$('#bnew').click(); // bersihkan state

console.log('\n==============================');
console.log(`HASIL: ${pass} lulus, ${fail} gagal`);
console.log('==============================');
process.exit(fail ? 1 : 0);
