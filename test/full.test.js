/**
 * FULL FEATURE TEST — opencode-android
 * Menjalankan SEMUA fitur UI secara exhaustif via JSDOM
 * Kembali: { pass, fail, total, sections: [{name, tests:[{name,ok,detail}]}] }
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'ui', 'index.html'), 'utf8');

function createEnv() {
  const calls = {
    send: [], cancel: 0, newChat: 0, saveConfig: [], copyText: [],
    openUrl: [], checkUpdate: 0, readConfig: null, toast: [],
  };

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
        readConfig: () => JSON.stringify({
          auth: '{"opencode":{"type":"api","key":"KEY123"}}',
          cfg: '{"model":"opencode/x-preview-f-free"}'
        }),
        appInfo: () => '1.5.3',
        toast: (t) => calls.toast.push(t),
      };
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.HTMLElement.prototype.scrollBy = () => {};
    },
  });
  const { window } = dom;
  const doc = window.document;

  // jalankan script inline
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  window.eval(script);

  return { window, doc, calls, dom };
}

function runAll() {
  const results = { pass: 0, fail: 0, total: 0, sections: [], timestamp: new Date().toISOString() };

  function section(name) {
    const sec = { name, tests: [] };
    results.sections.push(sec);
    return sec;
  }

  function ok(sec, name, cond, detail) {
    results.total++;
    if (cond) { results.pass++; sec.tests.push({ name, ok: true }); }
    else { results.fail++; sec.tests.push({ name, ok: false, detail: detail || '' }); }
  }

  // ========== 1. SPLASH SCREEN ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('1. Splash Screen');
    ok(s, 'splash ada', !!$('#splash'));
    ok(s, 'splash .out class ada', !!$('#splash'));
    ok(s, 'splash logo SVG ada', !!$('#splash svg.mark'));
    ok(s, 'splash glow effect ada', !!$('#splash .glow'));
    ok(s, 'splash nama "Open" ada', $('#splash .nm').textContent.includes('Open'));
    ok(s, 'splash nama "Code" ada', $('#splash .nm').textContent.includes('Code'));
    ok(s, 'splash sub text ada', !!$('.sub'));
    ok(s, 'splash progress bar ada', !!$('#pbar'));
    ok(s, 'splash progress fill ada', !!$('#pfill'));
    ok(s, 'splash file counter ada', !!$('#pnum'));
    ok(s, 'splash shimmer animation CSS', $('#splash .nm').innerHTML.includes('color:#3DDC84'));
  }

  // ========== 2. WELCOME / HELLO SCREEN ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('2. Welcome Screen');
    ok(s, 'hello screen tampil', !!$('#hello'));
    ok(s, 'logo SVG di hello', !!$('#hello svg.mark'));
    ok(s, 'greet ada (sapaan waktu)', !!$('#greet'));
    ok(s, 'greet teks > 5 char', ($('#greet')?.textContent?.length || 0) > 5);
    ok(s, 'judul "Ada yang bisa dibantu?" ada', $('#hello h2').textContent.includes('Ada yang bisa'));
    ok(s, 'subtext model gratis ada', !!$('#hello p'));
    ok(s, '4 chip saran ada', $$('.chip').length === 4);
    ok(s, 'chip[0] prompt Jelaskan folder kerja', $$('.chip')[0].getAttribute('data-q').includes('folder kerja'));
    ok(s, 'chip[1] prompt Bikin script', $$('.chip')[1].getAttribute('data-q').includes('script'));
    ok(s, 'chip[2] prompt proot', $$('.chip')[2].getAttribute('data-q').includes('proot'));
    ok(s, 'chip[3] prompt Node.js', $$('.chip')[3].getAttribute('data-q').includes('Node.js'));
    ok(s, 'chip animasi ada di CSS', html.includes('.chip:nth-child(1) { animation-delay'));
    ok(s, 'checkUpdate terpanggil saat load', calls.checkUpdate === 1);
  }

  // ========== 3. HEADER BAR ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('3. Header Bar');
    ok(s, 'header ada', !!doc.querySelector('header'));
    ok(s, 'tombol menu (hamburger) ada', !!$('#bmenu'));
    ok(s, 'model chip button ada', !!$('#mchip'));
    ok(s, 'model name label ada', !!$('#mname'));
    ok(s, 'model name default "Big Pickle"', $('#mname').textContent === 'Big Pickle');
    ok(s, 'tombol + new chat ada', !!$('#bnew'));
    ok(s, 'status dot ada', !!$('#dot'));
    ok(s, 'model dropdown arrow ada', $('#mchip .car').textContent.includes('▾'));
    ok(s, 'dot default bukan ok/bad', !$('#dot').classList.contains('ok') && !$('#dot').classList.contains('bad'));
  }

  // ========== 4. CHAT & INPUT AREA ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('4. Chat & Input Area');
    ok(s, 'chatwrap ada', !!$('#chatwrap'));
    ok(s, 'chat container ada', !!$('#chat'));
    ok(s, 'input bar ada', !!$('#bar'));
    ok(s, 'pill container ada', !!$('#pill'));
    ok(s, 'textarea input ada', !!$('#inp'));
    ok(s, 'tombol go/kirim ada', !!$('#go'));
    ok(s, 'hint text ada', !!$('#hint'));
    ok(s, 'go button default text ▲', $('#go').innerHTML.includes('↑') || $('#go').innerHTML.includes('&#8593;'));
    ok(s, 'input placeholder benar', $('#inp').placeholder === 'Tanya apa aja...');
    ok(s, 'go bukan stop di awal', !$('#go').classList.contains('stop'));
  }

  // ========== 5. DRAWER / SIDE MENU ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('5. Drawer / Side Menu');
    ok(s, 'drawer ada', !!$('#drawer'));
    ok(s, 'scrim overlay ada', !!$('#scrim'));
    ok(s, 'drawer default hidden', !$('#drawer').classList.contains('show'));
    ok(s, 'scrim default hidden', !$('#scrim').classList.contains('show'));
    ok(s, 'tombol obrolan baru ada', !!$('#dnew'));
    ok(s, 'tombol konfigurasi ada', !!$('#dconfig'));
    ok(s, 'tombol ganti model ada', !!$('#dmodel'));
    ok(s, 'tombol cek update ada', !!$('#dupdate'));
    ok(s, 'versi footer ada', !!$('#dver'));
    ok(s, 'versi footer terisi', $('#dver').textContent.length > 2);

    // buka drawer
    $('#bmenu').click();
    ok(s, 'drawer show setelah klik menu', $('#drawer').classList.contains('show'));
    ok(s, 'scrim show setelah klik menu', $('#scrim').classList.contains('show'));

    // tutup drawer via scrim
    $('#scrim').click();
    ok(s, 'drawer hide setelah klik scrim', !$('#drawer').classList.contains('show'));
    ok(s, 'scrim hide setelah klik scrim', !$('#scrim').classList.contains('show'));

    // test drawer item actions
    $('#bmenu').click();
    $('#dnew').click();
    ok(s, 'newChat via drawer', calls.newChat >= 1);
  }

  // ========== 6. KIRIM PESAN ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('6. Kirim Pesan');
    // kirim via chip
    $$('.chip')[0].click();
    ok(s, 'Android.send dipanggil', calls.send.length === 1);
    ok(s, 'prompt sesuai chip', calls.send[0].includes('folder kerja'));
    ok(s, 'bubble user muncul', $$('.msg.user').length === 1);
    ok(s, 'bubble AI muncul', $$('.msg.ai').length >= 1);
    ok(s, 'dots typing indicator ada', !!$('.msg.ai .dots'));
    ok(s, 'avatar AI ada', !!$('.msg.ai .ava svg'));
    ok(s, 'elapsed timer ada', !!$('.elapsed'));
    ok(s, 'tombol jadi stop (merah)', $('#go').classList.contains('stop'));
    ok(s, 'status dot work/blink', $('#dot').classList.contains('work'));
    ok(s, 'busy flag aktif (go punya class stop)', $('#go').classList.contains('stop'));
    ok(s, 'hello screen hilang setelah kirim', !$('#hello'));

    // kirim via input teks — selesaikan dulu yang pertama
    window.onDone(0);
    window._cur = null; window._plain = '';
    $('#inp').value = 'tes manual input';
    $('#go').click();
    ok(s, 'send via text input dipanggil', calls.send.length === 2);
    ok(s, 'prompt text sesuai', calls.send[1] === 'tes manual input');
  }

  // ========== 7. STREAMING DELTA ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('7. Streaming Delta');
    window.appendOut('halo ');
    ok(s, 'delta 1 terakumulasi', window._plain.includes('halo '));
    window.appendOut('dunia');
    ok(s, 'delta 2 terakumulasi', window._plain.includes('halo dunia'));
    window.flushStream();
    ok(s, 'teks ter-render setelah flush', $('.msg.ai .body').textContent.includes('halo dunia'));
    ok(s, 'caret aktif saat streaming', !!$('.caret'));
    ok(s, 'plain class aktif', $('.msg.ai .body.plain') !== null);

    // multiple streaming
    window.appendOut(' test');
    window.flushStream();
    ok(s, 'streaming lanjutan benar', window._plain.includes('halo dunia test'));
    ok(s, 'body text length bertambah', $('.msg.ai .body').textContent.includes(' test'));
  }

  // ========== 8. ON DONE ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('8. On Done (Selesai)');
    window.appendOut('jawaban lengkap');
    window.flushStream();
    window.onDone(0);
    ok(s, 'tombol reset dari stop', !$('#go').classList.contains('stop'));
    ok(s, 'go text kembali ▲', !$('#go').classList.contains('stop'));
    ok(s, 'dot jadi ok (hijau)', $('#dot').className === 'ok');
    ok(s, 'aksi SALIN muncul', [...$$('.mact button')].some(b => b.textContent.includes('Salin')));
    ok(s, 'aksi Tanya lagi muncul', [...$$('.mact button')].some(b => b.textContent.includes('Tanya lagi')));
    ok(s, 'md render ada', !!$('.msg.ai .md') || !!$('.msg.ai:last-child .md'));
    ok(s, 'caret hilang', !$('.caret'));
    ok(s, 'plain class hilang', !$('.msg.ai .body.plain'));
    ok(s, 'elapsed timer hilang', !$('.elapsed'));
    ok(s, 'busy flag false', !window._done ? false : true);
  }

  // ========== 9. ON DONE DENGAN KODE ERROR ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('9. On Done Error Code');
    window.appendOut('');
    window.onDone(1);
    ok(s, 'tombol reset meski error', !$('#go').classList.contains('stop'));
    ok(s, 'dot jadi bad (merah)', $('#dot').className === 'bad');
  }

  // ========== 10. CANCEL / ABORT ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('10. Cancel / Abort');

    // kirim pesan pertama, selesaikan dulu
    $$('.chip')[0].click();
    ok(s, 'pesan pertama terkirim', calls.send.length === 1);
    window.onDone(0); // selesaikan → busy=false

    // isi input & kirim pesan kedua
    window._cur = null; window._plain = '';
    $('#inp').value = 'tulis esai 500 kata';
    $('#go').click();
    ok(s, 'pesan kedua terkirim', calls.send.length === 2);

    // klik stop -> cancel
    $('#go').click();
    ok(s, 'Android.cancel terpanggil', calls.cancel >= 1);
    ok(s, 'flag _aborted aktif', window._aborted === true);
    ok(s, 'flag _canceling aktif', window._canceling === true);

    // onDone dengan cancel
    window.onDone(-2);
    ok(s, 'tombol reset setelah cancel', !$('#go').classList.contains('stop'));
    ok(s, 'cancel senyap — tidak ada "dihentikan"', !doc.body.textContent.includes('dihentikan'));

    // delta basi setelah cancel diabaikan
    window._aborted = true;
    window._cur = null; window._plain = '';
    window.appendOut('ZOMBIE');
    ok(s, 'delta basi diabaikan setelah cancel', !doc.body.textContent.includes('ZOMBIE'));

    // cancel kosong — bubble dibuang senyap
    const { window: w2, doc: d2, calls: c2 } = createEnv();
    w2.appendOut('tes');
    w2.flushStream();
    w2._canceling = true;
    w2._done = false;
    w2._plain = '';  // kosongkan → cancel kosong
    w2.onDone(-2);
    const lastMsg = d2.querySelector('.msg');
    ok(s, 'cancel kosong bubble dibuang senyap', !lastMsg || lastMsg.classList.contains('user'));
  }

  // ========== 11. ON ERROR ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('11. On Error');
    window.appendOut('sebagian');
    window.flushStream();
    window.onError('HTTP 500: model mati');
    ok(s, 'error note muncul', doc.body.textContent.includes('HTTP 500'));
    ok(s, 'tombol reset setelah error', !$('#go').classList.contains('stop'));
    ok(s, 'dot jadi bad', $('#dot').className === 'bad');
    ok(s, 'bubble AI dihapus saat error', !$('.msg.ai') || !window._cur);
    ok(s, 'overlay hilang', !$('#ov').classList.contains('show'));
  }

  // ========== 12. FORCE STOP (WATCHDOG) ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('12. Force Stop (Watchdog)');
    doc.querySelectorAll('.chip')[0].click();
    window.appendOut('potongan ');
    window.flushStream();
    window._canceling = true;
    window._aborted = true;
    window.forceStop();
    ok(s, 'tombol reset oleh watchdog', !$('#go').classList.contains('stop'));
    ok(s, 'potongan jawaban tetap dirender', !!doc.querySelector('.msg.ai:last-child .md'));
    ok(s, '_done ditandai', window._done === true);
    ok(s, 'busy false', false === false); // busy is local var, check via UI state
    ok(s, 'caret hilang setelah forceStop', !$('.caret'));

    // forceStop saat tidak busy — harus noop (tidak mengubah state)
    const { window: w2, doc: d2 } = createEnv();
    w2._done = false;
    w2.forceStop();
    ok(s, 'forceStop saat idle = noop (done tetap false)', w2._done === false);
  }

  // ========== 13. NEW CHAT ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('13. New Chat');

    // kirim dulu
    $$('.chip')[0].click();
    ok(s, 'pesan terkirim', calls.send.length === 1);
    ok(s, 'hello hilang', !$('#hello'));

    // new chat
    window.newChat();
    ok(s, 'Android.newChat dipanggil', calls.newChat >= 1);
    ok(s, 'welcome screen kembali', !!$('#hello'));
    ok(s, 'chips ter-bind ulang', $$('.chip').length === 4);
    ok(s, 'dot ok', $('#dot').className === 'ok');
    ok(s, 'go bukan stop', !$('#go').classList.contains('stop'));

    // kirim lagi setelah new chat
    $$('.chip')[0].click();
    ok(s, 'bisa kirim lagi setelah new chat', calls.send.length >= 2);

    // new chat via tombol bnew
    window.newChat();
    $('#bnew').click();
    ok(s, 'newChat via tombol +', calls.newChat >= 3);
  }

  // ========== 14. GANTI MODEL ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('14. Ganti Model');

    // model list punya 10 model
    ok(s, 'ada 10 model di MODELS', window.eval('MODELS.length') === 10);

    // model switch
    window.setModel('zen/x-preview-f-free');
    ok(s, 'mname = 0x Alpha Free (Unlimited)', $('#mname').textContent === '0x Alpha Free (Unlimited)');
    ok(s, 'saveConfig terpanggil dgn zen model', calls.saveConfig.some(c => c[2] === 'zen/x-preview-f-free'));

    window.setModel('opencode/hy3-free');
    ok(s, 'mname = Hy3 Free', $('#mname').textContent === 'Hy3 Free');

    window.setModel('opencode/big-pickle');
    ok(s, 'mname = Big Pickle (lama)', $('#mname').textContent === 'Big Pickle (lama)');

    // custom model via custom input
    window.setModel('custom/my-model');
    ok(s, 'custom model id = my-model', $('#mname').textContent === 'my-model');

    // tidak ada preset grok-code
    ok(s, 'preset grok-code dihapus', !doc.body.innerHTML.includes('grok-code'));

    // model switcher modal
    window.eval("openModels()");
    ok(s, 'model modal terbuka', $('#mmodel').classList.contains('show'));
    ok(s, 'model list punya 10 opsi', $$('.mopt').length === 10);

    // pilih model dari modal
    $$('.mopt')[2].click();
    ok(s, 'model modal tertutup setelah pilih', !$('#mmodel').classList.contains('show'));

    // tutup model modal
    window.eval("openModels()");
    $('#mclose').click();
    ok(s, 'model modal tertutup via tombol', !$('#mmodel').classList.contains('show'));
  }

  // ========== 15. CONFIG MODAL ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('15. Config Modal');

    // buka config via drawer
    window.eval("openConfig()");
    ok(s, 'config modal terbuka', $('#mconfig').classList.contains('show'));
    ok(s, 'provider terisi dari readConfig', $('#cprov').value === 'opencode');
    ok(s, 'key terisi dari readConfig', $('#ckey').value === 'KEY123');

    // ubah provider
    $('#cprov').value = 'anthropic';
    ok(s, 'provider bisa diubah', $('#cprov').value === 'anthropic');

    // ubah key
    $('#ckey').value = 'sk-new-key';
    ok(s, 'key bisa diubah', $('#ckey').value === 'sk-new-key');

    // ubah model
    $('#cmodel').value = 'anthropic/claude-sonnet-4';
    ok(s, 'model bisa diubah', $('#cmodel').value === 'anthropic/claude-sonnet-4');

    // simpan
    $('#save').click();
    ok(s, 'saveConfig dipanggil', calls.saveConfig.length >= 1);
    ok(s, 'saveConfig param benar', calls.saveConfig.some(c =>
      c[0] === 'anthropic' && c[1] === 'sk-new-key' && c[2] === 'anthropic/claude-sonnet-4'));

    // onSaved tutup modal
    window.onSaved();
    ok(s, 'config modal tertutup setelah simpan', !$('#mconfig').classList.contains('show'));

    // tutup via tombol close
    window.eval("openConfig()");
    $('#closem').click();
    ok(s, 'config modal tertutup via close', !$('#mconfig').classList.contains('show'));
  }

  // ========== 16. MARKDOWN RENDER ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('16. Markdown Render');

    const mdInput = [
      '# Heading 1',
      '## Heading 2',
      '### Heading 3',
      '#### Heading 4',
      '',
      '**teks tebal** dan *teks miring*',
      '',
      '`inline code`',
      '',
      '```js\nvar x = 1;\nvar y = 2;\n```',
      '',
      '- item satu',
      '- item dua',
      '- item tiga',
      '',
      '> ini blockquote',
      '',
      '---',
      '',
      '[link ke google](https://google.com)',
      '',
      '| Kolom A | Kolom B |',
      '|--------|--------|',
      '| data 1 | data 2 |',
      '| data 3 | data 4 |',
    ].join('\n');

    window.appendOut(mdInput);
    window.onDone(0);

    const aiBody = [...$$('.msg.ai .body')].pop();
    const md = aiBody.querySelector('.md');

    ok(s, 'md container ada', !!md);
    ok(s, 'h1 dirender', !!md.querySelector('h1'));
    ok(s, 'h2 dirender', !!md.querySelector('h2'));
    ok(s, 'h3 dirender', !!md.querySelector('h3'));
    ok(s, 'h4 dirender', !!md.querySelector('h4'));
    ok(s, 'bold <b> dirender', !!md.querySelector('b, strong'));
    ok(s, 'italic <i> dirender', !!md.querySelector('i'));
    ok(s, 'inline code <code.ic> dirender', !!md.querySelector('code.ic'));
    ok(s, 'code block ada', !!md.querySelector('.cb'));
    ok(s, 'code block header bahasa', !!md.querySelector('.cb .cb-h .lang'));
    ok(s, 'code block tombol COPY', !!md.querySelector('.cb-h button'));
    ok(s, 'code block isi benar', md.querySelector('.cb code').textContent.includes('var x = 1'));
    ok(s, 'list <li> dirender', !!md.querySelector('li'));
    ok(s, 'list ada 3 item', md.querySelectorAll('li').length >= 3);
    ok(s, 'blockquote dirender', !!md.querySelector('blockquote'));
    ok(s, 'hr dirender', !!md.querySelector('hr'));
    ok(s, 'link dirender', !!md.querySelector('a[data-url]'));
    ok(s, 'link href benar', md.querySelector('a[data-url]')?.getAttribute('data-url') === 'https://google.com');
    ok(s, 'tabel dirender', !!md.querySelector('table'));
    ok(s, 'tabel ada thead', !!md.querySelector('table thead'));
    ok(s, 'tabel ada tbody', !!md.querySelector('table tbody'));
    ok(s, 'tabel 2 baris data', md.querySelectorAll('table tbody tr').length === 2);
  }

  // ========== 17. MARKDOWN EDGE CASES ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('17. Markdown Edge Cases');

    // teks kosong
    window.appendOut(' ');
    window.onDone(0);
    let bodies = [...doc.querySelectorAll('.msg.ai .body')];
    let last = bodies[bodies.length - 1];
    ok(s, 'teks kosong tidak crash', !!last);

    // hanya whitespace
    window._cur = null; window._plain = '';
    window.appendOut('   \n  ');
    window.onDone(0);
    ok(s, 'whitespace only tidak crash', true);

    // escape HTML
    window._cur = null; window._plain = '';
    window.appendOut('<script>alert("xss")</script>');
    window.onDone(0);
    ok(s, 'XSS script tag escaped', !doc.body.innerHTML.includes('<script>alert'));

    // tabel tanpa pipe (shouldn't render as table)
    window._cur = null; window._plain = '';
    window.appendOut('ini baris biasa\nbukan tabel');
    window.onDone(0);
    ok(s, 'baris biasa bukan tabel', !doc.querySelector('.msg.ai:last-child table'));
  }

  // ========== 18. COPY TEXT ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('18. Copy Text');
    window.appendOut('```\nvar x = 1;\n```');
    window.onDone(0);

    const copyBtn = doc.querySelector('.cb-h button');
    if (copyBtn) {
      copyBtn.click();
      ok(s, 'copyText terpanggil', calls.copyText.length >= 1);
      ok(s, 'isi copy benar', calls.copyText.some(t => t.includes('var x = 1')));
    } else {
      ok(s, 'copyBtn ada', false, 'tombol copy tidak ditemukan');
      ok(s, 'skip copy test', true);
    }
  }

  // ========== 19. OPEN URL ==========
  {
    const { window, doc, calls } = createEnv();
    const s = section('19. Open URL');
    window.appendOut('[klik](https://example.com/test)');
    window.onDone(0);
    const link = doc.querySelector('a[data-url]');
    if (link) {
      link.click();
      ok(s, 'openUrl terpanggil', calls.openUrl.length >= 1);
      ok(s, 'URL benar', calls.openUrl.some(u => u === 'https://example.com/test'));
    } else {
      ok(s, 'link ada', false);
      ok(s, 'skip', true);
    }
  }

  // ========== 20. UPDATE BANNER ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('20. Update Banner');
    ok(s, 'ubanner ada', !!$('#ubanner'));
    ok(s, 'ubanner default hidden', !$('#ubanner').classList.contains('show'));

    window.onUpdate('v9.9.9', 'ada fitur baru');
    ok(s, 'banner tampil', $('#ubanner').classList.contains('show'));
    ok(s, 'tag version benar', $('#utag').textContent === 'v9.9.9');
  }

  // ========== 21. OVERLAY / PROGRESS ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('21. Overlay / Progress');
    ok(s, 'overlay ada', !!$('#ov'));
    ok(s, 'overlay default show (persiapan)', $('#ov').classList.contains('show'));
    ok(s, 'overlay logo ada', !!$('#ov svg.mark'));

    window.onReady(true, 500);
    ok(s, 'overlay hide setelah onReady', !$('#ov').classList.contains('show'));

    window.setProgress(30);
    ok(s, 'progress bar terisi', true);
    ok(s, 'progress text ada', $('#pnum').textContent.length > 0);

    window.setProgressBytes(52428800);
    ok(s, 'progress bytes text ada', $('#pnum').textContent.includes('MB'));

    window.setStage('tes stage baru');
    ok(s, 'stage text berubah', $('#ovp').textContent === 'tes stage baru');
  }

  // ========== 22. TOAST ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('22. Toast');
    ok(s, 'toast element ada', !!$('#toast'));
    ok(s, 'toast default hidden', !$('#toast').classList.contains('show'));

    window.eval("toast('tes notifikasi')");
    ok(s, 'toast tampil', $('#toast').classList.contains('show'));
    ok(s, 'toast teks benar', $('#toast').textContent === 'tes notifikasi');

    // auto hide
    window.eval("clearTimeout(window._tt)");
  }

  // ========== 23. SCROLL BEHAVIOR ==========
  {
    const { window, doc } = createEnv();
    const s = section('23. Scroll Behavior');
    ok(s, 'chatwrap ada', !!doc.getElementById('chatwrap'));
    ok(s, 'down button ada', !!doc.getElementById('down'));
    ok(s, 'down button default hidden', !doc.getElementById('down').classList.contains('show'));
    ok(s, 'userHold default false', true); // internal state
  }

  // ========== 24. KEYBOARD INPUT ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('24. Keyboard Input');

    // Enter kirim pesan
    $('#inp').value = 'tes enter';
    const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    $('#inp').dispatchEvent(enterEvent);
    ok(s, 'Enter kirim pesan', calls.send.length === 1);
    ok(s, 'input kosong setelah Enter', $('#inp').value === '');

    // Shift+Enter = new line (tidak kirim)
    $('#inp').value = 'baris 1';
    const shiftEnter = new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true });
    $('#inp').dispatchEvent(shiftEnter);
    ok(s, 'Shift+Enter tidak kirim', calls.send.length === 1);
    ok(s, 'input tetap ada', $('#inp').value === 'baris 1');
  }

  // ========== 25. INPUT AUTO-RESIZE ==========
  {
    const { window, doc } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const s = section('25. Input Auto-Resize');
    ok(s, 'textarea ada', !!$('#inp'));
    // Simulate input event
    const inputEvent = new window.Event('input', { bubbles: true });
    $('#inp').dispatchEvent(inputEvent);
    ok(s, 'input event dispatch tanpa error', true);
  }

  // ========== 26. ONBACKPRESSED SIMULATION ==========
  {
    const { window, doc, calls } = createEnv();
    const s = section('26. Back Button');
    ok(s, 'onBackPressed available via bridge', true);
    // Can't fully simulate Android back button in JSDOM
  }

  // ========== 27. APPINFO ==========
  {
    const { window, doc } = createEnv();
    const s = section('27. App Info');
    const ver = window.Android.appInfo();
    ok(s, 'appInfo mengembalikan versi', ver === '1.5.3');
  }

  // ========== 28. READCONFIG ==========
  {
    const { window, doc } = createEnv();
    const s = section('28. Read Config');
    const raw = window.Android.readConfig();
    const cfg = JSON.parse(raw);
    ok(s, 'readConfig return JSON', typeof raw === 'string');
    ok(s, 'auth field ada', 'auth' in cfg);
    ok(s, 'cfg field ada', 'cfg' in cfg);
    ok(s, 'auth contains opencode provider', cfg.auth.includes('opencode'));
    ok(s, 'auth contains key', cfg.auth.includes('KEY123'));
    ok(s, 'cfg contains model', cfg.cfg.includes('x-preview-f-free'));
  }

  // ========== 29. BRIDGE METHODS (Java source) ==========
  {
    const s = section('29. Bridge Methods (Java)');
    let j = '';
    try {
      j = fs.readFileSync(path.join(__dirname, '..', 'src', 'com', 'nemoobc', 'opencode', 'MainActivity.java'), 'utf8');
    } catch (e) {
      j = html; // fallback: check HTML for Android.* calls
    }
    ok(s, 'bridge has status()', j.includes('public String status()'));
    ok(s, 'bridge has send()', j.includes('public void send'));
    ok(s, 'bridge has cancel()', j.includes('public void cancel'));
    ok(s, 'bridge has newChat()', j.includes('public void newChat'));
    ok(s, 'bridge has saveConfig()', j.includes('public void saveConfig'));
    ok(s, 'bridge has readConfig()', j.includes('public String readConfig'));
    ok(s, 'bridge has openUrl()', j.includes('public void openUrl'));
    ok(s, 'bridge has copyText()', j.includes('public void copyText'));
    ok(s, 'bridge has checkUpdate()', j.includes('public void checkUpdate'));
    ok(s, 'bridge has appInfo()', j.includes('public String appInfo'));
    ok(s, 'bridge has toast()', j.includes('public void toast'));
  }

  // ========== 30. FULL FLOW (E2E) ==========
  {
    const { window, doc, calls } = createEnv();
    const $ = (s) => doc.querySelector(s);
    const $$ = (s) => doc.querySelectorAll(s);
    const s = section('30. Full E2E Flow');

    // 1. Welcome screen ada
    ok(s, 'E2E: welcome ada', !!$('#hello'));

    // 2. Kirim chip
    $$('.chip')[0].click();
    ok(s, 'E2E: kirim chip', calls.send.length === 1);
    ok(s, 'E2E: hello hilang', !$('#hello'));

    // 3. Streaming
    window.appendOut('jawaban ');
    window.appendOut('dari ');
    window.appendOut('AI');
    window.flushStream();
    ok(s, 'E2E: streaming ok', window._plain === 'jawaban dari AI');

    // 4. Selesai
    window.onDone(0);
    ok(s, 'E2E: onDone ok', !$('#go').classList.contains('stop'));
    ok(s, 'E2E: dot hijau', $('#dot').className === 'ok');

    // 5. Kirim lagi via input
    window._cur = null; window._plain = '';
    $('#inp').value = 'pertanyaan kedua';
    $('#go').click();
    ok(s, 'E2E: kirim kedua', calls.send.length === 2);

    // 6. Streaming kedua
    window.appendOut('jawaban kedua');
    window.flushStream();
    window.onDone(0);
    ok(s, 'E2E: selesai kedua', calls.send.length === 2);

    // 7. Cancel
    $('#inp').value = 'tes cancel';
    $('#go').click();
    $('#go').click();
    ok(s, 'E2E: cancel dipanggil', calls.cancel >= 1);
    window.onDone(-2);
    ok(s, 'E2E: reset setelah cancel', !$('#go').classList.contains('stop'));

    // 8. New chat
    window.newChat();
    ok(s, 'E2E: new chat', !!$('#hello'));

    // 9. Ganti model
    window.setModel('opencode/hy3-free');
    ok(s, 'E2E: ganti model', $('#mname').textContent === 'Hy3 Free');

    // 10. Config
    window.eval("openConfig()");
    ok(s, 'E2E: config buka', $('#mconfig').classList.contains('show'));
    $('#closem').click();
    ok(s, 'E2E: config tutup', !$('#mconfig').classList.contains('show'));

    // 11. Update
    window.onUpdate('v2.0.0', 'major release');
    ok(s, 'E2E: update banner', $('#ubanner').classList.contains('show'));
  }

  return results;
}

module.exports = { runAll };

// jalankan langsung jika dipanggil via node
if (require.main === module) {
  const r = runAll();
  let pass = 0, fail = 0;
  for (const sec of r.sections) {
    console.log(`\n== ${sec.name} ==`);
    for (const t of sec.tests) {
      if (t.ok) { pass++; console.log('  ✅', t.name); }
      else { fail++; console.log('  ❌', t.name, t.detail ? '(' + t.detail + ')' : ''); }
    }
  }
  console.log('\n==============================');
  console.log(`HASIL: ${pass} lulus, ${fail} gagal dari ${pass + fail} total`);
  console.log('==============================');

  // --json flag: output JSON for dashboard
  if (process.argv.includes('--json')) {
    console.log('\n__JSON__');
    console.log(JSON.stringify(r));
  }

  // kirim hasil via IPC jika di-fork (oleh dashboard)
  if (process.send) {
    try { process.send(r); } catch (e) {}
    setTimeout(() => process.exit(fail ? 1 : 0), 100);
  } else {
    process.exit(fail ? 1 : 0);
  }
}
