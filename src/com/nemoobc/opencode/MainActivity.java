package com.nemoobc.opencode;

import android.app.Activity;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.PowerManager;
import android.view.View;
import android.system.Os;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile boolean busy = false;
    private static volatile boolean running = true;
    private static volatile boolean sseStarted = false;

    private File rootFs, extWork, cacheDir, natLib, linkDir, workDir;
    private Process serverProc;
    private volatile boolean serverUp = false;
    private final StringBuilder serverLog = new StringBuilder();
    private volatile String sessionId = null;
    private volatile HttpURLConnection msgConn = null;
    private boolean autotest = false;
    private static PowerManager.WakeLock wakeLock;
    private volatile int deltaCount = 0;
    private volatile long tSendMs = 0;
    private volatile long firstDeltaMs = -1;
    private volatile boolean sawIdle = false;
    private static final int PORT = 4096;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        rootFs = new File(getFilesDir(), "rootfs");
        workDir = new File(getFilesDir(), "work");
        extWork = getExternalFilesDir(null);
        if (extWork == null) extWork = workDir;
        cacheDir = getCacheDir();
        natLib = new File(getFilesDir(), "native");

        if (!workDir.exists()) workDir.mkdirs();
        if (!extWork.exists()) extWork.mkdirs();
        new File(rootFs, "root/.config/opencode").mkdirs();
        setupLibLinks();

        autotest = getIntent() != null && getIntent().getBooleanExtra("autotest", false);
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel("oc", "OpenCode", NotificationManager.IMPORTANCE_LOW));
        } catch (Exception ignored) {}
        if (autotest) {
            Diagnostics.reset();
            Diagnostics.startServer(4099);
            Diagnostics.extra("versi", appInfoSafe());
        }

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.setBackgroundColor(0xFF0C100E);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setVisibility(View.INVISIBLE);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String u) {
                v.setVisibility(View.VISIBLE);
                if (autotest) startAutoTest();
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/ui/index.html");

        new Thread(new Runnable() {
            @Override
            public void run() {
                try { ensureNativeLibs(); } catch (Exception e) { push("window.onError(" + jq("Gagal siapkan binary: " + e) + ")"); return; }
                boolean ready = new File(rootFs, "usr/bin/busybox").exists()
                        && new File(rootFs, "lib/ld-musl-aarch64.so.1").exists();
                if (!ready) {
                    try {
                        InputStream raw = getAssets().open("payload/rootfs.bin");
                        TarExtractor.Progress cb = new TarExtractor.Progress() {
                            @Override
                            public void onEntry(int n) {
                                if (n % 40 == 0) push("window.setProgress(" + n + ")");
                            }
                        };
                        TarExtractor.extractGz(new BufferedInputStream(raw, 1 << 16), rootFs, cb);
                        for (String p : new String[]{"usr/bin/oc"}) {
                            File f = new File(rootFs, p);
                            if (f.exists()) f.setExecutable(true, false);
                        }
                        push("window.setStage(\"menyalakan server AI...\")");
                        ready = readyOk();
                        if (!ready) {
                            delTree(rootFs);
                            InputStream raw2 = getAssets().open("payload/rootfs.bin");
                            TarExtractor.extractGz(new BufferedInputStream(raw2, 1 << 16), rootFs, cb);
                            push("window.setStage(\"menyalakan server AI...\")");
                        ready = readyOk();
                        }
                    } catch (Exception e) {
                        push("window.onError(" + jq("Ekstraksi gagal: " + e) + ")");
                        return;
                    }
                }
                if (!ready) {
                    String miss = "";
                    if (!new File(rootFs, "bin/busybox").exists() && !new File(rootFs, "usr/bin/busybox").exists()) miss += "busybox ";
                    if (!new File(rootFs, "lib/ld-musl-aarch64.so.1").exists()) miss += "lib/ld-musl ";
                    push("window.onError(" + jq("payload tidak lengkap, kurang: " + miss) + ")");
                    return;
                }
                startServer();
            }
        }).start();
    }

    private void wakeHold() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "opencode:generate");
                wakeLock.setReferenceCounted(false);
            }
            wakeLock.acquire(300000);
        } catch (Exception ignored) {}
    }

    private void wakeFree() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
    }

    private String appInfoSafe() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }

    private byte[] capture() throws Exception {
        final byte[][] out = new byte[1][];
        final java.util.concurrent.CountDownLatch latch =
                new java.util.concurrent.CountDownLatch(1);
        ui.post(new Runnable() {
            @Override
            public void run() {
                try {
                    View v = web;
                    android.graphics.Bitmap bm = android.graphics.Bitmap.createBitmap(
                            v.getWidth(), v.getHeight(), android.graphics.Bitmap.Config.ARGB_8888);
                    android.graphics.Canvas cn = new android.graphics.Canvas(bm);
                    v.draw(cn);
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                    bm.compress(android.graphics.Bitmap.CompressFormat.PNG, 55, bo);
                    out[0] = bo.toByteArray();
                } catch (Exception ignored) {}
                latch.countDown();
            }
        });
        latch.await(6, java.util.concurrent.TimeUnit.SECONDS);
        return out[0];
    }

    private String evalSync(final String expr) throws Exception {
        final String[] out = new String[1];
        final java.util.concurrent.CountDownLatch latch =
                new java.util.concurrent.CountDownLatch(1);
        ui.post(new Runnable() {
            @Override
            public void run() {
                web.evaluateJavascript(expr, new android.webkit.ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String v) {
                        out[0] = v;
                        latch.countDown();
                    }
                });
            }
        });
        latch.await(5, java.util.concurrent.TimeUnit.SECONDS);
        return out[0] == null ? "" : out[0];
    }

    private boolean readyOk() {
        boolean bb = new File(rootFs, "bin/busybox").exists()
                || new File(rootFs, "usr/bin/busybox").exists();
        boolean musl = new File(rootFs, "lib/ld-musl-aarch64.so.1").exists();
        return bb && musl;
    }

    private void delTree(File f) {
        File[] k = f.listFiles();
        if (k != null) for (File x : k) delTree(x);
        f.delete();
    }

    private void setupLibLinks() {
        linkDir = new File(getFilesDir(), "lib");
        linkDir.mkdirs();
        mkLink("libtalloc.so", "libtalloc.so.2");
        mkLink("libshmem.so", "libandroid-shmem.so");
    }

    private void mkLink(String src, String dst) {
        File d = new File(linkDir, dst);
        if (d.exists()) return;
        try {
            Os.symlink(new File(natLib, src).getAbsolutePath(), d.getAbsolutePath());
        } catch (Exception ignored) {}
    }

    private void push(final String js) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                web.evaluateJavascript(js, null);
            }
        });
    }

    private static String jq(String s) {
        return JSONObject.quote(s);
    }

    /* ================= autotest ================= */

    private void startAutoTest() {
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(1500);
                    Diagnostics.step("buka", "halaman + server siap");
                    Diagnostics.shot("1-buka", capture());

                    // kirim via chip pertama
                    evalSync("document.querySelectorAll('.chip')[0].click()");
                    Thread.sleep(2500);
                    Diagnostics.step("kirim", "delta: " + deltaCount + " (mengetik)");
                    Diagnostics.shot("2-kirim", capture());

                    // tunggu jawaban selesai
                    int wait = 0;
                    while (!sawIdle && wait < 150000) { Thread.sleep(2000); wait += 2000; }
                    String stopState = evalSync("document.getElementById('go').classList.contains('stop')");
                    Diagnostics.step("jawaban", "delta=" + deltaCount
                            + ", deltaPertama=" + firstDeltaMs + "ms"
                            + ", idle=" + sawIdle
                            + ", tombolMasihStop=" + stopState);
                    Thread.sleep(1200);
                    Diagnostics.shot("3-jawaban", capture());

                    // tes cancel: prompt panjang lalu stop
                    evalSync("document.getElementById('inp').value='tuliskan esai 1000 kata'");
                    evalSync("document.getElementById('go').click()");
                    Thread.sleep(5000);
                    int dSebelum = deltaCount;
                    evalSync("document.getElementById('go').click()");
                    Thread.sleep(7000);
                    String stopAfter = evalSync("document.getElementById('go').classList.contains('stop')");
                    String jsState = evalSync("JSON.stringify({done:window._done,aborted:window._aborted,canceling:window._canceling,lastOnDone:window._lastOnDone||'belum-ada',lastOnError:(window._lastOnError||'belum-ada').substring(0,60)})");
                    Diagnostics.step("cancel", "deltaSebelum=" + dSebelum
                            + " deltaSesudah=" + deltaCount
                            + " tombolMasihStop=" + stopAfter);
                    Diagnostics.step("cancel-js-state", jsState);
                    Diagnostics.shot("4-cancel", capture());

                    // tes new chat
                    evalSync("newChat()");
                    Thread.sleep(1500);
                    String hello = evalSync("!!document.getElementById('hello')");
                    Diagnostics.step("newchat", "welcomeKembali=" + hello);
                    Diagnostics.shot("5-newchat", capture());

                    Diagnostics.extra("selesai", "true");
                    Diagnostics.step("selesai", "semua tahap dijalankan");
                } catch (Exception e) {
                    Diagnostics.step("error", String.valueOf(e));
                    Diagnostics.extra("selesai", "error");
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    /* ================= server opencode ================= */

    /* ekstrak native libs dari APK ke filesDir/native — dipakai saat
       extractNativeLibs=false supaya install tetap instan */
    private void ensureNativeLibs() throws IOException {
        /* cek marker + versi APK — kalau APK update, ekstrak ulang */
        File marker = new File(natLib, "libopencode.so");
        String curVer = appInfoSafe();
        File verFile = new File(natLib, ".version");
        if (marker.exists() && marker.length() > 0 && verFile.exists()) {
            try {
                if (curVer.equals(new String(java.nio.file.Files.readAllBytes(verFile.toPath())).trim())) return;
            } catch (Exception ignored) {}
        }
        natLib.mkdirs();
        long total = 0, lastPush = 0;
        try (ZipInputStream z = new ZipInputStream(new BufferedInputStream(
                new FileInputStream(getApplicationInfo().sourceDir), 1 << 16))) {
            ZipEntry e;
            byte[] buf = new byte[1 << 16];
            while ((e = z.getNextEntry()) != null) {
                String n = e.getName();
                if (!n.startsWith("lib/arm64-v8a/") || !n.endsWith(".so")) continue;
                File out = new File(natLib, new File(n).getName());
                try (FileOutputStream fo = new FileOutputStream(out)) {
                    int r;
                    while ((r = z.read(buf)) > 0) {
                        fo.write(buf, 0, r);
                        total += r;
                        if (total - lastPush > 4194304) {
                            lastPush = total;
                            push("window.setProgressBytes(" + total + ")");
                        }
                    }
                }
                out.setExecutable(true, false);
            }
        }
        push("window.setProgressBytes(" + total + ")");
        /* tulis versi APK ke marker agar ekstrak ulang saat update */
        try (FileOutputStream fv = new FileOutputStream(verFile)) { fv.write(curVer.getBytes()); }
    }

    private void startServer() {
        try {
            /* server dianggap hidup jika ada respons HTTP apa pun (200/401/404...) —
               bukan hanya 200, karena opencode menjawab beda-beda di path / */
            if (httpCode("http://127.0.0.1:" + PORT + "/", 1200) > 0) {
                serverUp = true;
                long free = rootFs.getFreeSpace() / (1024 * 1024);
                push("window.onReady(true," + free + ")");
                startEventStream();
                return;
            }
            String proot = new File(natLib, "libproot.so").getAbsolutePath();
            String loader = new File(natLib, "libproot_loader.so").getAbsolutePath();

            java.util.List<String> c = new java.util.ArrayList<>();
            c.add(proot);
            c.add("--kill-on-exit");
            c.add("-0");
            c.add("-r"); c.add(rootFs.getAbsolutePath());
            c.add("-b"); c.add("/dev");
            c.add("-b"); c.add("/proc");
            c.add("-b"); c.add("/sys");
            c.add("-b"); c.add(new File(natLib, "libopencode.so").getAbsolutePath() + ":/usr/bin/opencode");
            c.add("-b"); c.add(cacheDir.getAbsolutePath() + ":/tmp");
            c.add("-b"); c.add(extWork.getAbsolutePath() + ":/work");
            c.add("-w"); c.add("/work");
            c.add("/usr/bin/opencode");
            c.add("serve");
            c.add("--port"); c.add(String.valueOf(PORT));
            c.add("--hostname"); c.add("127.0.0.1");

            ProcessBuilder pb = new ProcessBuilder(c);
            pb.redirectErrorStream(true);
            pb.environment().clear();
            pb.environment().put("LD_LIBRARY_PATH", linkDir.getAbsolutePath() + ":" + natLib.getAbsolutePath());
            pb.environment().put("PROOT_LOADER", loader);
            pb.environment().put("PROOT_TMP_DIR", cacheDir.getAbsolutePath());
            pb.environment().put("PROOT_NO_SECCOMP", "1");
            pb.environment().put("HOME", "/root");
            pb.environment().put("TMPDIR", "/tmp");
            pb.environment().put("PATH", "/usr/bin:/bin");
            pb.environment().put("XDG_CONFIG_HOME", "/root/.config");

            serverProc = pb.start();
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        BufferedReader r = new BufferedReader(
                                new InputStreamReader(serverProc.getInputStream()));
                        String ln;
                        while ((ln = r.readLine()) != null && running) {
                            synchronized (serverLog) {
                                serverLog.append(ln).append('\n');
                                if (serverLog.length() > 4000) serverLog.delete(0, serverLog.length() - 4000);
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }).start();

            int waited = 0;
            while (running && waited < 90000) {
                if (httpCode("http://127.0.0.1:" + PORT + "/", 1500) > 0) {
                    serverUp = true;
                    break;
                }
                Thread.sleep(1000);
                waited += 1000;
            }
            if (!serverUp) {
                String tail;
                synchronized (serverLog) { tail = serverLog.toString(); }
                if (tail.length() > 200) tail = tail.substring(tail.length() - 200);
                if (autotest) Diagnostics.step("server-log", tail);
                push("window.onError(" + jq("server gagal start: " + tail) + ")");
                return;
            }
            long free = rootFs.getFreeSpace() / (1024 * 1024);
            push("window.onReady(true," + free + ")");
            startEventStream();
            // sesi hangat: siapkan sebelum user minta
            try {
                String r0 = httpPost("http://127.0.0.1:" + PORT + "/session", "{\"title\":\"opencode\"}");
                sessionId = new JSONObject(r0).optString("id", null);
            } catch (Exception ignored) {}
            // keep-alive: ping tiap 4 menit biar semuanya tetap hangat
            Thread ka = new Thread(new Runnable() {
                @Override
                public void run() {
                    while (running) {
                        try { Thread.sleep(240000); } catch (InterruptedException ignored) {}
                        if (running && serverUp && !busy) {
                            try { httpCode("http://127.0.0.1:" + PORT + "/session", 4000); } catch (Exception ignored) {}
                        }
                    }
                }
            });
            ka.setDaemon(true);
            ka.start();
        } catch (Exception e) {
            push("window.onError(" + jq("Server error: " + e) + ")");
        }
    }

    private int httpCode(String url, int timeout) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(timeout);
            c.setReadTimeout(timeout);
            return c.getResponseCode();
        } catch (Exception e) {
            return -1;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /* ================= event stream (SSE) ================= */

    private void startEventStream() {
        if (sseStarted) return;
        sseStarted = true;
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                while (running) {
                    HttpURLConnection c = null;
                    try {
                        c = (HttpURLConnection)
                                new URL("http://127.0.0.1:" + PORT + "/event").openConnection();
                        c.setConnectTimeout(5000);
                        c.setReadTimeout(0);
                        if (autotest) Diagnostics.step("sse-connect", "terhubung");
                        BufferedReader r = new BufferedReader(
                                new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
                        String line;
                        while (running && (line = r.readLine()) != null) {
                            if (!line.startsWith("data: ")) continue;
                            handleEvent(line.substring(6).trim());
                        }
                        r.close();
                        if (autotest) Diagnostics.step("sse-putus", "stream berakhir");
                    } catch (Exception e) {
                        if (autotest) Diagnostics.step("sse-error", String.valueOf(e));
                    } finally {
                        if (c != null) c.disconnect();
                    }
                    if (running && serverUp) {
                        try { Thread.sleep(1500); } catch (InterruptedException ignored) {}
                    }
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    private void handleEvent(String json) {
        try {
            JSONObject ev = new JSONObject(json);
            String type = ev.optString("type", "");
            JSONObject pr = ev.optJSONObject("properties");
            if (pr == null) return;
            String sid = pr.optString("sessionID", "");
            if (sessionId != null && !sessionId.equals(sid)) return;

            if ("message.part.delta".equals(type)) {
                if ("text".equals(pr.optString("field", ""))) {
                    String delta = pr.optString("delta", "");
                    if (delta.length() > 0) {
                        deltaCount++;
                        if (autotest && firstDeltaMs < 0 && tSendMs > 0) {
                            firstDeltaMs = System.currentTimeMillis() - tSendMs;
                            Diagnostics.step("sse-delta-pertama", firstDeltaMs + "ms");
                        }
                        push("window.appendOut(" + jq(delta) + ")");
                    }
                }
            } else if ("session.idle".equals(type)) {
                sawIdle = true;
                if (autotest) Diagnostics.step("sse-idle", "session=" + sid);
                if (busy) {
                    busy = false;
                    wakeFree();
                    push("window.onDone(0)");
                }
            }
        } catch (Exception ignored) {}
    }

    /* ================= bridge ================= */

    private class Bridge {

        @JavascriptInterface
        public String status() {
            JSONObject o = new JSONObject();
            try {
                o.put("ready", serverUp && readyOk());
                o.put("busy", busy);
            } catch (Exception ignored) {}
            return o.toString();
        }

        @JavascriptInterface
        public void send(final String prompt) {
            if (busy || !serverUp) return;
            busy = true;
            wakeHold();
            sawIdle = false;
            deltaCount = 0;
            firstDeltaMs = -1;
            tSendMs = System.currentTimeMillis();
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (sessionId == null) {
                            String res = httpPost("http://127.0.0.1:" + PORT + "/session",
                                    "{\"title\":\"obrolan\"}");
                            sessionId = new JSONObject(res).optString("id", null);
                            if (sessionId == null) throw new Exception("gagal buat sesi");
                        }
                        String model = readModel();
                        int sl = model.indexOf('/');
                        String prov = sl > 0 ? model.substring(0, sl) : "opencode";
                        String mid = sl > 0 ? model.substring(sl + 1) : model;
                        JSONObject body = new JSONObject();
                        org.json.JSONArray parts = new org.json.JSONArray();
                        JSONObject tp = new JSONObject();
                        tp.put("type", "text");
                        tp.put("text", prompt);
                        parts.put(tp);
                        body.put("parts", parts);
                        JSONObject mm = new JSONObject();
                        mm.put("providerID", prov);
                        mm.put("modelID", mid);
                        body.put("model", mm);
                        HttpURLConnection mc = null;
                        try {
                            mc = (HttpURLConnection)
                                    new URL("http://127.0.0.1:" + PORT + "/session/"
                                    + sessionId + "/message").openConnection();
                            mc.setRequestMethod("POST");
                            mc.setConnectTimeout(8000);
                            mc.setReadTimeout(180000);
                            mc.setDoOutput(true);
                            mc.setRequestProperty("Content-Type", "application/json");
                            OutputStream os = mc.getOutputStream();
                            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                            os.close();
                            msgConn = mc;
                            int code = mc.getResponseCode();
                            InputStream is = code >= 400 ? mc.getErrorStream() : mc.getInputStream();
                            BufferedReader rr = new BufferedReader(
                                    new InputStreamReader(is, StandardCharsets.UTF_8));
                            StringBuilder sb2 = new StringBuilder();
                            String l2;
                            while ((l2 = rr.readLine()) != null) sb2.append(l2);
                            rr.close();
                            msgConn = null;
                            if (autotest) Diagnostics.step("post-selesai", "HTTP " + code + " panjang=" + sb2.length());
                            if (code >= 400) throw new Exception("HTTP " + code);
                            String res = sb2.toString();
                            if (res.length() == 0 || res.startsWith("<")) {
                                if (autotest) Diagnostics.step("post-aneh", res.substring(0, Math.min(80, res.length())));
                                throw new Exception("respon server tidak valid");
                            }
                            if (autotest) Diagnostics.step("post-ok", "pesan masuk antrian selesai");
                        } finally {
                            msgConn = null;
                            if (mc != null) mc.disconnect();
                        }
                        // teks mengalir via SSE; session.idle yang menutup
                    } catch (Exception e) {
                        busy = false;
                        wakeFree();
                        if (autotest) Diagnostics.step("post-error", String.valueOf(e));
                        push("window.onError(" + jq("Error: " + e) + ")");
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void cancel() {
            final String sid = sessionId;
            final HttpURLConnection cc = msgConn;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    if (cc != null) { try { cc.disconnect(); } catch (Exception ignored) {} }
                    if (sid != null) {
                        try {
                            httpPost("http://127.0.0.1:" + PORT + "/api/session/" + sid + "/interrupt", "{}");
                        } catch (Exception ignored) {}
                        try {
                            httpPost("http://127.0.0.1:" + PORT + "/session/" + sid + "/abort", "{}");
                        } catch (Exception ignored) {}
                    }
                    /* watchdog: sesi null pun UI harus selalu di-reset */
                    try { Thread.sleep(sid == null ? 1200 : 6000); } catch (InterruptedException ignored) {}
                    busy = false;
                    wakeFree();
                    push("window.onDone(-2)");
                }
            }).start();
        }

        @JavascriptInterface
        public void newChat() {
            sessionId = null;
        }

        @JavascriptInterface
        public void saveConfig(String provider, String key, String model) {
            try {
                File dir = new File(rootFs, "root/.config/opencode");
                dir.mkdirs();
                File dir2 = new File(rootFs, "root/.local/share/opencode");
                dir2.mkdirs();
                if (key != null && key.trim().length() > 0) {
                    JSONObject auth = new JSONObject();
                    JSONObject ent = new JSONObject();
                    ent.put("type", "api");
                    ent.put("key", key.trim());
                    auth.put(provider.trim(), ent);
                    write(new File(dir, "auth.json"), auth.toString());
                    write(new File(dir2, "auth.json"), auth.toString());
                }
                if (model != null && model.trim().length() > 0) {
                    JSONObject cfg = new JSONObject();
                    cfg.put("$schema", "https://opencode.ai/config.json");
                    cfg.put("model", model.trim());
                    write(new File(dir, "opencode.json"), cfg.toString());
                }
                push("window.onSaved()");
            } catch (Exception e) {
                push("window.onError(" + jq("Simpan config gagal: " + e) + ")");
            }
        }

        @JavascriptInterface
        public String readConfig() {
            try {
                File a = new File(rootFs, "root/.config/opencode/auth.json");
                File c = new File(rootFs, "root/.config/opencode/opencode.json");
                JSONObject o = new JSONObject();
                o.put("auth", a.exists() ? read(a) : "");
                o.put("cfg", c.exists() ? read(c) : "");
                return o.toString();
            } catch (Exception e) {
                return "{\"auth\":\"\",\"cfg\":\"\"}";
            }
        }

        @JavascriptInterface
        public void openUrl(String u) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void copyText(final String t) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        ClipboardManager cm =
                            (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                        cm.setPrimaryClip(ClipData.newPlainText("oc", t));
                        android.widget.Toast.makeText(MainActivity.this, "Tersalin", android.widget.Toast.LENGTH_SHORT).show();
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void checkUpdate() {
            Thread t = new Thread(new Runnable() {
                @Override
                public void run() {
                try {
                    java.net.URL u = new java.net.URL(
                        "https://api.github.com/repos/nemoobc/opencode-android/releases/latest");
                    java.net.HttpURLConnection cx = (java.net.HttpURLConnection) u.openConnection();
                    try {
                        cx.setConnectTimeout(8000); cx.setReadTimeout(8000);
                        cx.setRequestProperty("User-Agent", "opencode-android");
                        java.io.BufferedReader r = new java.io.BufferedReader(
                            new java.io.InputStreamReader(cx.getInputStream()));
                        StringBuilder sb = new StringBuilder(); String l;
                        while ((l = r.readLine()) != null) sb.append(l);
                        r.close();
                        org.json.JSONObject j = new org.json.JSONObject(sb.toString());
                        String tag = j.getString("tag_name");
                        String mine = getPackageManager()
                            .getPackageInfo(getPackageName(), 0).versionName;
                        if (!tag.contains(mine)) {
                            push("window.onUpdate(" + JSONObject.quote(tag) + ")");
                        }
                    } finally { cx.disconnect(); }
                } catch (Exception ignored) {}
                }
            });
            t.setDaemon(true);
            t.start();
        }

        @JavascriptInterface
        public String appInfo() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) { return "?"; }
        }

        @JavascriptInterface
        public void toast(String t) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    android.widget.Toast.makeText(
                            MainActivity.this, t, android.widget.Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    /* ================= http helper ================= */

    private String httpPost(String urlStr, String body) throws Exception {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(urlStr).openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(8000);
            c.setReadTimeout(120000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            OutputStream os = c.getOutputStream();
            os.write(body.getBytes(StandardCharsets.UTF_8));
            os.close();
            int code = c.getResponseCode();
            InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String l;
            while ((l = r.readLine()) != null) sb.append(l);
            r.close();
            if (code >= 400) throw new Exception("HTTP " + code + ": " + sb.substring(0, Math.min(120, sb.length())));
            return sb.toString();
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private String readModel() {
        try {
            File c = new File(rootFs, "root/.config/opencode/opencode.json");
            if (c.exists()) {
                JSONObject cfg = new JSONObject(read(c));
                String m = cfg.optString("model", "");
                if (m.length() > 0) return m;
            }
        } catch (Exception ignored) {}
        return "zen/big-pickle";
    }

    private void write(File f, String s) throws Exception {
        try (FileWriter w = new FileWriter(f)) {
            w.write(s);
        }
    }

    private String read(File f) throws Exception {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f)))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line).append("\n");
            return sb.toString();
        }
    }

    @Override
    public void onBackPressed() {
        if (busy) {
            /* cancel via bridge langsung — jangan buat Bridge() baru */
            final String sid = sessionId;
            final HttpURLConnection cc = msgConn;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    if (cc != null) { try { cc.disconnect(); } catch (Exception ignored) {} }
                    if (sid != null) {
                        try { httpPost("http://127.0.0.1:" + PORT + "/api/session/" + sid + "/interrupt", "{}"); } catch (Exception ignored) {}
                        try { httpPost("http://127.0.0.1:" + PORT + "/session/" + sid + "/abort", "{}"); } catch (Exception ignored) {}
                    }
                    try { Thread.sleep(sid == null ? 1200 : 6000); } catch (InterruptedException ignored) {}
                    busy = false;
                    wakeFree();
                    push("window.onDone(-2)");
                }
            }).start();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        wakeFree();
        if (serverProc != null) { try { serverProc.destroy(); } catch (Exception ignored) {} }
        super.onDestroy();
    }
}
