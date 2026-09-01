/* ===== models.js — drawer, model switcher, language, config, avatar, update ===== */

/* ===== drawer ===== */
function openDrawer() { document.getElementById('drawer').classList.add('show'); document.getElementById('scrim').classList.add('show'); histRender(); }
function closeDrawer() { document.getElementById('drawer').classList.remove('show'); document.getElementById('scrim').classList.remove('show'); }
document.getElementById('bmenu').onclick = openDrawer;
document.getElementById('scrim').onclick = closeDrawer;

/* ===== model switcher ===== */
/* AUTO-MODELS-START */
var MODELS = [
  {id:'opencode/hy3-free',  nm:'Hy3 Free',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/big-pickle',  nm:'Big Pickle',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/deepseek-v4-flash-free',  nm:'DeepSeek V4 Flash',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/muse-spark-1.2-contributor-free',  nm:'Muse Spark 1.2',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/mimo-v2.5-free',  nm:'Mimo 2.5 Free',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/ling-3.0-flash-fin-free',  nm:'Ling 3.0 Flash',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/nemotron-3-ultra-free',  nm:'Nemotron 3 Ultra',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/nemotron-3.5-lightning-free',  nm:'Nemotron Lightning',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'opencode/laguna-s-2.1-free',  nm:'Laguna S 2.1',  ds:'Katalog Resmi Relay', tag:'GRATIS'},
  {id:'anthropic/claude-sonnet-4', nm:'Claude Sonnet 4', ds:'Butuh API Key Anthropic', tag:'PRO'},
  {id:'openai/gpt-4.1',            nm:'GPT-4.1',         ds:'Butuh API Key OpenAI',    tag:'PRO'}
];
/* AUTO-MODELS-END */
function openModels() {
  if (Date.now() - (window._modelsFetchedAt || 0) > 900000) {
    window._modelsFetchedAt = Date.now();
    try { Android.fetchModels(); } catch (e) {}
  }
  var l = document.getElementById('mlist');
  l.innerHTML = '';
  MODELS.forEach(function(m) {
    var b = document.createElement('button');
    b.className = 'mopt' + (m.id === curModel ? ' sel' : '');
    var spd = m.id.indexOf('muse-spark') >= 0 ? '~5s' : m.id.indexOf('hy3') >= 0 ? '~6s' : m.id.indexOf('lightning') >= 0 ? '~4s' : m.id.indexOf('flash') >= 0 ? '~7s' : '';
    b.innerHTML = '<div><div class="nm">' + m.nm + (spd ? '<span class="spd">' + spd + '</span>' : '') + '</div><div class="ds">' + m.id + ' \u2022 ' + m.ds + '</div></div>' +
      (m.tag === 'GRATIS' ? '<span class="tag">GRATIS</span>' : '');
    b.onclick = function() { setModel(m.id); };
    l.appendChild(b);
  });
  document.getElementById('mmodel').classList.add('show');
}
window.onModels = function(newIds) {
  var ada = {};
  MODELS.forEach(function(m) { ada[m.id] = true; });
  var tambah = 0;
  try {
    for (var i = 0; i < newIds.length; i++) {
      var id = String(newIds[i]).trim();
      if (!id) continue;
      var full = id.indexOf('/') >= 0 ? id : 'opencode/' + id;
      if (ada[full]) continue;
      if (full.indexOf('/') > 0 && full.split('/')[0] !== 'opencode') continue;
      var nm = id.replace(/-free$/, '').split('-').map(function(w) {
        return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
      }).join(' ');
      MODELS.push({ id: full, nm: nm, ds: 'Katalog Resmi Relay', tag: 'GRATIS' });
      ada[full] = true;
      tambah++;
    }
  } catch (e) {}
  if (tambah > 0 && document.getElementById('mmodel').classList.contains('show')) openModels();
};
function modelName(id) {
  for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i].nm;
  return id.split('/')[1] || id;
}
function setModel(id) {
  curModel = id;
  document.getElementById('mname').textContent = modelName(id);
  var badge = document.querySelector('.ai-badge');
  if (badge) badge.innerHTML = '<span class="dot"></span> ' + modelName(id) + ' — Aktif';
  Android.saveConfig('opencode', '', id);
  document.getElementById('mmodel').classList.remove('show');
}
document.getElementById('mchip').onclick = openModels;
document.getElementById('dmodel').onclick = function() { closeDrawer(); openModels(); };
document.getElementById('mclose').onclick = function() { document.getElementById('mmodel').classList.remove('show'); };
document.getElementById('cmcustom').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && this.value.trim()) { setModel(this.value.trim()); }
});

/* ===== language ===== */
var curLang = localStorage.getItem('oc-lang') || 'auto';
var LANGS = [
  {id:'auto', e:'\uD83C\uDF10', nm:'Auto (ikuti bahasa)', ds:'deteksi otomatis dari pertanyaan pertama'},
  {id:'id',   e:'\uD83C\uDDEE\uD83C\uDDE9', nm:'Indonesia',        ds:'balasan selalu bahasa Indonesia'},
  {id:'en',   e:'\uD83C\uDDEC\uD83C\uDDE7', nm:'English',          ds:'always reply in English'}
];
function langName(id) {
  for (var i = 0; i < LANGS.length; i++) if (LANGS[i].id === id) return LANGS[i];
  return LANGS[0];
}
function renderLangBtn() {
  var o = langName(curLang);
  document.getElementById('blang').title = 'Bahasa balasan: ' + o.nm;
}
function openLang() {
  var l = document.getElementById('llist');
  l.innerHTML = '';
  LANGS.forEach(function(m) {
    var b = document.createElement('button');
    b.className = 'mopt' + (m.id === curLang ? ' sel' : '');
    b.innerHTML = '<div style="font-size:18px">' + m.e + '</div><div><div class="nm">' + m.nm + '</div><div class="ds">' + m.ds + '</div></div>';
    b.onclick = function() { setLang(m.id); };
    l.appendChild(b);
  });
  document.getElementById('mlang').classList.add('show');
}
function setLang(id) {
  curLang = id;
  localStorage.setItem('oc-lang', id);
  renderLangBtn();
  window._langDetected = null;
  document.getElementById('mlang').classList.remove('show');
  toast('Bahasa Balasan: ' + langName(id).nm);
}
function detectLang(s) {
  s = String(s).toLowerCase();
  var idw = ['halo','hai','apa','tolong','saya','kamu','kapan','kenapa','gimana','tidak','banget','nya ','yang ','bisa','buat','dari','untuk','ini ','itu '];
  var enw = ['hello','hi','what','please','how','why','can you','you ','this','that','write a','make a','help','the ',' is ',' to ',' for '];
  var idHit = 0, enHit = 0;
  for (var i = 0; i < idw.length; i++) if (s.indexOf(idw[i]) >= 0) idHit++;
  for (var j = 0; j < enw.length; j++) if (s.indexOf(enw[j]) >= 0) enHit++;
  return idHit > enHit ? 'id' : (enHit > idHit ? 'en' : null);
}
function langPromp(t) {
  var lang = curLang;
  if (lang === 'auto') {
    if (window._langDetected) lang = window._langDetected;
    else { lang = detectLang(t) || 'auto'; window._langDetected = lang; }
  }
  if (lang === 'id') return '(instruksi sistem: jawab SELALU dengan bahasa Indonesia, apa pun bahasa pertanyaanku. gunakan bahasa Indonesia yang alami.)\n\n' + t;
  if (lang === 'en') return '(system instruction: ALWAYS reply in English, regardless of the question language.)\n\n' + t;
  return t;
}
document.getElementById('blang').onclick = openLang;
document.getElementById('lclose').onclick = function() { document.getElementById('mlang').classList.remove('show'); };
renderLangBtn();

/* ===== config ===== */
document.getElementById('dconfig').onclick = function() { closeDrawer(); openConfig(); };
function openConfig() {
  try {
    var c = JSON.parse(Android.readConfig());
    if (c.auth) {
      try {
        var a = JSON.parse(c.auth);
        for (var k in a) {
          document.getElementById('cprov').value = k;
          document.getElementById('ckey').value = a[k].key || '';
        }
      } catch (e) {}
    }
    if (c.cfg) {
      try {
        var m = JSON.parse(c.cfg);
        document.getElementById('cmodel').value = (m.model === 'opencode/mimo-v2.5-free') ? '' : (m.model || '');
      } catch (e) {}
    }
  } catch (e) {}
  document.getElementById('mconfig').classList.add('show');
}
document.getElementById('closem').onclick = function() { document.getElementById('mconfig').classList.remove('show'); };
document.getElementById('save').onclick = function() {
  var m = document.getElementById('cmodel').value.trim() || 'opencode/mimo-v2.5-free';
  curModel = m;
  document.getElementById('mname').textContent = modelName(m);
  Android.saveConfig(
    document.getElementById('cprov').value,
    document.getElementById('ckey').value,
    m
  );
};

/* ===== update ===== */
document.getElementById('dupdate').onclick = function() {
  closeDrawer();
  Android.checkUpdate();
  toast('Memeriksa update...');
};
document.getElementById('ubtn').onclick = function() {
  Android.openUrl('https://github.com/nemoobc/opencode-android/releases/tag/' + (window._upTag || 'latest'));
};
document.getElementById('dver').textContent = 'v' + (Android.appInfo ? Android.appInfo() : '?');

/* ===== attachment ===== */
document.getElementById('battach').onclick = function () {
  if (busy) { toast('Tunggu Balasan Selesai Dulu'); return; }
  if (typeof Android.pickFile === 'function') Android.pickFile();
  else toast('Upload File Belum Didukung Di Versi Ini');
};
function attHide() {
  window._att = null;
  document.getElementById('attachbar').classList.remove('show');
}
document.getElementById('att-x').onclick = function () {
  attHide();
  toast('Lampiran Dibatalkan');
};
document.getElementById('att-send').onclick = function () {
  if (busy) { toast('Tunggu Balasan Selesai Dulu'); return; }
  go.onclick();
};
window.onFileReady = function (name, path) {
  window._att = { name: name, path: path };
  document.getElementById('att-name').textContent = name;
  document.getElementById('attachbar').classList.add('show');
  toast('File Siap — Tulis Pesan Lalu Kirim');
  refocusInp();
};
window.onFileError = function (m) { var n = addNote('Gagal lampirkan file: ' + m, true); setTimeout(function(){ if(n&&n.parentNode)n.parentNode.removeChild(n); }, 6000); };

Android.checkUpdate();

/* ===== AVATAR ===== */
var AVATAR_URL = 'https://api.dicebear.com/7.x/adventurer/svg?backgroundColor=b6e3f4&radius=50&seed=';
var AVATARS = [
  { id:'miki-tikus', name:'Miki Tikus', desc:'Tikus ikonik dengan telinga besar', emoji:'🐭' },
  { id:'rubah-licik', name:'Rubah Licik', desc:'Rubah cerdik & menggemaskan', emoji:'🦊' },
  { id:'singa-berani', name:'Singa Berani', desc:'Raja hutan yang gagah', emoji:'🦁' },
  { id:'panda-lucu', name:'Panda Lucu', desc:'Panda hits putih & item', emoji:'🐼' },
  { id:'domba-domba', name:'Domba Domba', desc:'Domba fluffy & polos', emoji:'🐑' },
  { id:'unikornis-ajaib', name:'Unikornis', desc:'Kuda bertanduk ajaib', emoji:'🦄' },
  { id:'naga-bijak', name:'Naga Bijak', desc:'Naga tua yang berwisata', emoji:'🐲' },
  { id:'elang-mata', name:'Elang Mata', desc:'Elang dengan penglihatan tajam', emoji:'🦅' },
  { id:'serigala-malam', name:'Serigala Malam', desc:'Serigala misterius', emoji:'🐺' },
  { id:'penguin-lucu', name:'Penguin Lucu', desc:'Penguin kecil menggemaskan', emoji:'🐧' },
  { id:'burung-hantu', name:'Burung Hantu', desc:'Burung hantu bijaksana', emoji:'🦉' },
  { id:'kelinci-loncat', name:'Kelinci Loncat', desc:'Kelinci energik & ceria', emoji:'🐰' },
  { id:'kucing-suka', name:'Kucing Suka', desc:'Kucing yang suka dimanja', emoji:'🐱' },
  { id:'kodok-hijau', name:'Kodok Hijau', desc:'Kodok riang gembira', emoji:'🐸' },
  { id:'kupu-kupu', name:'Kupu-Kupu', desc:'Kupu-kupu warna-warni', emoji:'🦋' },
  { id:'kura-kura', name:'Kura-Kura', desc:'Kura-kura tenang & sabar', emoji:'🐢' },
  { id:'bintang-terang', name:'Bintang Terang', desc:'Bintang bersinar terang', emoji:'🌟' },
  { id:'bulan-sabit', name:'Bulan Sabit', desc:'Bulan di malam hari', emoji:'🌙' },
  { id:'kilat-cepat', name:'Kilat Cepat', desc:'Kilat yang tak terbendung', emoji:'⚡' },
  { id:'bola-kristal', name:'Bola Kristal', desc:'Kristal penuh misteri', emoji:'🔮' },
  { id:'topeng-seni', name:'Topeng Seni', desc:'Seni pertunjukan', emoji:'🎭' },
  { id:'sirkus-pesta', name:'Sirkus Pesta', desc:'Sirkus yang meriah', emoji:'🎪' },
  { id:'mahkota-raja', name:'Mahkota Raja', desc:'Ratu/Raja sejati', emoji:'👑' },
  { id:'istana-dongeng', name:'Istana Dongeng', desc:'Istana dari negeri dongeng', emoji:'🏰' }
];
function avatarUrl(id) { return AVATAR_URL + encodeURIComponent(id || 'default'); }
function avatarEmoji(id) {
  for (var i = 0; i < AVATARS.length; i++) { if (AVATARS[i].id === id) return AVATARS[i].emoji; }
  return '👤';
}
function avatarName(id) {
  for (var i = 0; i < AVATARS.length; i++) { if (AVATARS[i].id === id) return AVATARS[i].name; }
  return 'User';
}
var savedAvatar = localStorage.getItem('oc-avatar') || 'miki-tikus';
var selectedAvatar = savedAvatar;
