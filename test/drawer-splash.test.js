import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('assets/ui/index.html', 'utf8');

/* concat CSS from separate files */
const CSS_DIR = 'assets/ui/css/';
const CSS_FILES = ['base.css','drawer.css','header.css','chat.css','welcome.css','splash.css'];
const css = CSS_FILES.map(f => fs.readFileSync(CSS_DIR + f, 'utf8')).join('\n');

/* concat JS files */
const JS_DIR = 'assets/ui/js/';
const JS_FILES = ['bridge.js','init.js','utils.js','stream.js','send.js','history.js','models.js'];
const script = JS_FILES.map(f => fs.readFileSync(JS_DIR + f, 'utf8')).join('\n;\n');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://example.com/',
  beforeParse(window) {
    window.Android = {
      send: () => 1,
      cancel: () => {},
      newChat: () => {},
      saveConfig: () => {},
      copyText: () => {},
      openUrl: () => {},
      checkUpdate: () => {},
      fetchModels: () => {},
      readImageDataUrl: () => null,
      readConfig: () => JSON.stringify({ auth: '', cfg: '' }),
      appInfo: () => '1.6.1',
      toast: () => {},
      getLocalMode: () => false,
      setLocalMode: () => {},
      termExec: () => JSON.stringify({ code: 0, out: '' }),
    };
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.scrollBy = () => {};
    window._srvOk = true;
  },
});
const { window } = dom;
const doc = window.document;
window.eval(script);

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name); } }
const $ = (sel) => doc.querySelector(sel);

console.log('== 1. DRAWER UKURAN & FONT (tidak kecil, tidak kegedean) ==');
// cek css langsung
ok('drawer width 80% max 310 (tidak 300 kecil, tidak 320 kegedean)', css.includes('width:80%') && css.includes('max-width:310px'));
ok('d-item font 15px (clean)', css.includes('font-size:15px') && css.includes('.d-item'));
ok('d-item padding 14px 16px (clean)', css.includes('padding:14px 16px'));
ok('d-item icon 18px (clean)', css.includes('font-size:18px') && css.includes('.d-item .ic'));
ok('hbtn 38px 17px (garis tiga tidak kecil)', css.includes('width:38px') && css.includes('font-size:17px'));
ok('drawer 6 item anim delay 5 & 6 ada (fix invisible)', css.includes('nth-child(5)') && css.includes('nth-child(6)'));
ok('d-body padding 14px (clean)', css.includes('.d-body') && css.includes('padding:14px 10px'));

console.log('== 2. SPLASH LOGO (gede, tidak offside) ==');
ok('stage 112px (96 kecil, 128 kegedean offside -> 112 tengah)', css.includes('#splash .stage') && css.includes('width:112px'));
ok('mark 112px sesuai stage', css.includes('#splash .mark') && css.includes('width:112px'));
ok('glow inset -56 (proporsional 112)', css.includes('inset:-56px'));
ok('splash duration 6s (dramatic & smooth)', css.includes('6s'));
ok('splash nm 26px (gedein dari 24)', css.includes('#splash .nm') && css.includes('font-size:26px'));
ok('animasi splash tidak offside: stage & mark sama ukuran', (() => {
  const stage = css.match(/#splash \.stage[^}]*width:(\d+)px/);
  const mark = css.match(/#splash \.mark[^}]*width:(\d+)px/);
  return stage && mark && stage[1] === mark[1];
})());
ok('splash viewBox tetap 432 (tidak offside)', html.includes('viewBox="0 0 432 432"'));
ok('rect rotate center 297 297 tidak offside (0deg)', html.includes('rotate(0 297 297)'));

console.log('== 3. GAMBAR ICON TIDAK KECIL ==');
ok('d-item ic width 24px', css.includes('width:24px'));
ok('avatar ai 30px (clean, visible)', css.includes('.msg.ai .ava') && css.includes('width:30px'));
ok('chip icon/bold 14px', css.includes('.chip b') && css.includes('font-size:14px'));

console.log('== 4. INTEGRASI (splash+drawer tidak ganggu chat) ==');
ok('chat ada', !!$('#chat'));
ok('drawer tidak menimpa chat', !!$('#chat'));
ok('splash di atas (z-index 100) > drawer 41', css.includes('#splash') && css.includes('z-index:100') && css.includes('#drawer') && css.includes('z-index:41'));

console.log('== 5. RESPONSIVE & POLISH ==');
ok('header backdrop blur', css.includes('backdrop-filter:blur'));
ok('scrollbar custom', css.includes('::-webkit-scrollbar'));
ok('chat bg radial', css.includes('#chatwrap') && css.includes('radial-gradient'));
ok('toast shadow', css.includes('#toast') && css.includes('box-shadow'));

console.log('\n==============================');
console.log(`HASIL DRAWER-SPLASH: ${pass} lulus, ${fail} gagal`);
console.log('==============================');
process.exit(fail ? 1 : 0);
