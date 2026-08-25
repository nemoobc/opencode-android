#!/usr/bin/env node
/**
 * Cloud Live Dashboard — opencode-android auto-test
 */
const http = require('http');
const { execFile } = require('child_process');
const path = require('path');

const PORT = 8899;
let latestResult = null;
let runCount = 0;
const startTime = Date.now();

function runTests(cb) {
  runCount++;
  const t0 = Date.now();
  execFile('node', [path.join(__dirname, '..', 'test', 'full.test.js'), '--json'], { timeout: 120000 }, (err, stdout, stderr) => {
    const dur = Date.now() - t0;
    try {
      if (stdout.trim()) {
        // parse JSON from __JSON__ marker
        const marker = '__JSON__';
        const idx = stdout.indexOf(marker);
        if (idx >= 0) {
          const jsonStr = stdout.slice(idx + marker.length).trim();
          latestResult = JSON.parse(jsonStr);
        } else {
          latestResult = JSON.parse(stdout.trim());
        }
      } else {
        latestResult = { pass: 0, fail: 1, total: 1, sections: [{ name: 'ERROR', tests: [{ name: (err?.message || 'no output').slice(0, 100), ok: false }] }], timestamp: new Date().toISOString() };
      }
    } catch (e) {
      latestResult = { pass: 0, fail: 1, total: 1, sections: [{ name: 'PARSE ERROR', tests: [{ name: e.message, ok: false }] }], timestamp: new Date().toISOString() };
    }
    latestResult.runNumber = runCount;
    latestResult.durationMs = dur;
    latestResult.uptime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[RUN #${runCount}] ${latestResult.pass}/${latestResult.total} (${dur}ms)`);
    if (cb) cb();
  });
}

function dashboardHTML() {
  const r = latestResult;
  const sc = r && r.fail === 0 ? '#3DDC84' : '#E05545';
  const st = r && r.fail === 0 ? 'ALL GREEN ✅' : `${r?.fail || 0} FAILED ❌`;
  const up = r?.uptime || 0;
  const upStr = `${Math.floor(up / 60)}m ${up % 60}s`;

  let secHTML = '';
  if (r?.sections) {
    for (const sec of r.sections) {
      const sp = sec.tests.filter(t => t.ok).length;
      const sc2 = sp === sec.tests.length ? '#3DDC84' : '#C9A227';
      secHTML += `<div class="s"><div class="sh"><span class="sd" style="background:${sc2}"></span>${esc(sec.name)}<span class="sc">${sp}/${sec.tests.length}</span></div><div class="st">`;
      for (const t of sec.tests) {
        secHTML += `<div class="t ${t.ok ? 'p' : 'f'}">${t.ok ? '✅' : '❌'} ${esc(t.name)}</div>`;
      }
      secHTML += '</div></div>';
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>🧪 OpenCode Auto-Test</title><meta http-equiv="refresh" content="30"><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#0C100E;color:#ECEEEC;font-family:-apple-system,sans-serif;padding:16px;max-width:880px;margin:0 auto}
.h{display:flex;align-items:center;gap:12px;padding:14px;background:#141814;border:1px solid #232924;border-radius:14px;margin-bottom:18px;flex-wrap:wrap}
.h h1{font-size:18px;font-weight:600}.h h1 span{color:#3DDC84}
.sb{padding:5px 14px;border-radius:9px;font-size:13px;font-weight:700;background:${sc}22;color:${sc};border:1px solid ${sc}44}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:18px}
.s2{background:#141814;border:1px solid #232924;border-radius:12px;padding:12px;text-align:center}
.s2 .v{font-size:24px;font-weight:700;color:#3DDC84}.s2 .l{font-size:10px;color:#8AA396;margin-top:3px}
.ar{color:#C9A227;font-size:10px;text-align:right;margin-bottom:6px}
.s{background:#141814;border:1px solid #232924;border-radius:12px;margin-bottom:8px;overflow:hidden}
.sh{display:flex;align-items:center;gap:7px;padding:8px 12px;background:#111611;border-bottom:1px solid #232924;font-size:12px;font-weight:600}
.sd{width:8px;height:8px;border-radius:50%;flex:0 0 auto}.sc{margin-left:auto;font-size:10px;color:#8AA396;font-weight:400}
.st{padding:4px 8px}.t{padding:2px 3px;font-size:11px;border-bottom:1px solid #1a1f1a}.t:last-child{border-bottom:none}
.t.p{color:#8ACFAB}.t.f{color:#E08A7B;font-weight:600}
.ft{text-align:center;font-size:9px;color:#5E7568;margin-top:14px}
</style></head><body>
<div class="h">
<svg width="36" height="36" viewBox="0 0 432 432"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3DDC84"/><stop offset=".6" stop-color="#1FA063"/><stop offset="1" stop-color="#C9A227"/></linearGradient></defs><path d="M132 84 H300 Q316 84 316 100 V196" fill="none" stroke="#F2F2EC" stroke-width="26" stroke-linecap="round"/><path d="M316 268 V300 Q316 316 300 316 H100 Q84 316 84 300 V100 Q84 84 100 84" fill="none" stroke="#F2F2EC" stroke-width="26" stroke-linecap="round"/><rect x="232" y="232" width="130" height="130" rx="18" fill="url(#g)" transform="rotate(8 297 297)"/></svg>
<div><h1>🧪 <span>OpenCode</span> Auto-Test</h1><div style="font-size:10px;color:#8AA396">Cloud Live Monitor · v1.5.3</div></div>
<div style="margin-left:auto"><span class="sb">${st}</span></div></div>
<div class="g">
<div class="s2"><div class="v">${r?.pass || 0}/${r?.total || 0}</div><div class="l">Tests</div></div>
<div class="s2"><div class="v">${r?.sections?.length || 0}</div><div class="l">Sections</div></div>
<div class="s2"><div class="v">#${runCount}</div><div class="l">Runs</div></div>
<div class="s2"><div class="v">${r?.durationMs || 0}ms</div><div class="l">Duration</div></div>
<div class="s2"><div class="v">${upStr}</div><div class="l">Uptime</div></div>
</div>
<div class="ar">🔄 auto-refresh 30s · run #${runCount} · ${r?.timestamp || 'menunggu...'}</div>
${secHTML}
<div class="ft">opencode-android · Node ${process.version} · ${process.platform}</div>
</body></html>`;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const server = http.createServer((req, res) => {
  if (req.url === '/api/result') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(latestResult || { status: 'loading' }));
  } else if (req.url === '/api/run') {
    if (!latestResult?._running) {
      latestResult = { ...latestResult, _running: true };
      runTests();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboardHTML());
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🧪 Dashboard: http://localhost:${PORT}`);
  runTests();
});
