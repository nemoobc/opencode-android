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
import java.net.Proxy;
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
    /* token permintaan — dikirim ke JS bersama onDone/onError supaya callback
       lama (mis. onDone(-2) cancel yang tertunda 6 detik) tidak membajak UI
       permintaan yang lebih baru. */
    private volatile int reqTok = 0;
    private static final int PORT = 4096;
    private static final int REQ_PICK = 7001;
    /* marker ekstraksi rootfs SELESAI & valid — dicek biar app tidak
       ekstrak ulang tiap buka (keluar-masuk/update) dan tidak memakai
       rootfs parsial dari ekstraksi yang terputus */
    private static final String EXT_OK = ".oc-ok";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        /* Catat crash mentah ke file supaya bisa dianalisis (RAM sempit / GPU buruk
           sering bikin proses dibunuh sistem tanpa sempat masuk onError UI). */
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                try {
                    java.io.StringWriter sw = new java.io.StringWriter();
                    e.printStackTrace(new java.io.PrintWriter(sw));
                    String s = java.text.SimpleDateFormat.getDateTimeInstance()
                            .format(new java.util.Date()) + "\n" + t.getName() + ": " + sw;
                    write(new File(getFilesDir(), "crash.txt"), s);
                    File ex = getExternalFilesDir(null);
                    if (ex != null) write(new File(ex, "crash.txt"), s);
                } catch (Exception ignored) {}
                android.os.Process.killProcess(android.os.Process.myPid());
            }
        });

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
        /* hemat memori: cache mati + jangan pre-render offscreen (RAM perangkat sempit) */
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setOffscreenPreRaster(false);
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
                boolean ready = readyOk();
                if (!ready) {
                    File old = new File(getFilesDir(), "rootfs.old");
                    File tmp = new File(getFilesDir(), "rootfs.tmp");
                    push("window.setStage(\"menyiapkan sistem — memeriksa...\")");
                    try {
                        if (tmp.exists()) {
                            push("window.setStage(\"menyiapkan sistem — membersihkan sisa...\")");
                            delTree(tmp);
                        }
                        /* Sisa percobaan yang ditutup paksa: rootfs belum ada, .old ada.
                           Pulihkan dulu — PRIORITAS renameTo (instan), bukan menyalin
                           file satu-satu yang bikin "ekstrak ulang" & stuck lama. */
                        if (!rootFs.exists() && old.exists()) {
                            push("window.setStage(\"menyiapkan sistem — memulihkan sistem lama...\")");
                            moveDir(old, rootFs);
                        }
                        if (readyOk()) {
                            ready = true;
                        } else {
                            /* Kalau rootfs lama ada, BACKUP dulu — pakai renameTo instan */
                            if (rootFs.exists()) {
                                push("window.setStage(\"menyiapkan sistem — menyimpan sistem lama...\")");
                                if (!rootFs.renameTo(old)) moveTree(rootFs, old);
                            }
                            push("window.setStage(\"menyiapkan sistem — mengekstrak...\")");
                            tmp.mkdirs();
                            push("window.setProgress(1)");
                            InputStream raw = getAssets().open("payload/rootfs.bin");
                            TarExtractor.Progress cb = new TarExtractor.Progress() {
                                @Override
                                public void onEntry(int n) {
                                    if (n % 10 == 0) push("window.setProgress(" + n + ")");
                                }
                                @Override
                                public void onBytes(long b) {
                                    push("window.setProgressBytes(" + b + ")");
                                }
                            };
                            TarExtractor.extractGz(new BufferedInputStream(raw, 1 << 16), tmp, cb);
                            for (String p : new String[]{"usr/bin/oc"}) {
                                File f = new File(tmp, p);
                                if (f.exists()) f.setExecutable(true, false);
                            }
                            new File(tmp, EXT_OK).createNewFile();
                            if (!tmp.renameTo(rootFs)) moveTree(tmp, rootFs);
                            ready = readyOk();
                            /* JANGAN langsung hapus old di sini: kalau app dibunuh saat
                               penghapusan berjalan, buka berikutnya harusnya GAMPANG
                               restore. Hapus old nanti, setelah server mulai hidup. */
                            if (ready && old.exists()) {
                                push("window.setProgress(555)");
                                push("window.setProgressBytes(16332800)");
                                Thread bg = new Thread(new Runnable() {
                                    @Override
                                    public void run() {
                                        try { Thread.sleep(25000); } catch (InterruptedException ignored) {}
                                        if (old.exists()) delTree(old);
                                    }
                                });
                                bg.setDaemon(true);
                                bg.start();
                            }
                        }
                    } catch (Exception e) {
                        /* gagal/batal di tengah: kembalikan rootfs lama biar app tetap jalan */
                        if (!rootFs.exists() && old.exists()) moveDir(old, rootFs);
                        push("window.onError(" + jq("Ekstraksi gagal: " + e) + ")");
                        return;
                    }
                    push("window.setStage(\"menyalakan server AI...\")");
                }
                if (!ready) {
                    String miss = "";
                    if (!new File(rootFs, "bin/busybox").exists() && !new File(rootFs, "usr/bin/busybox").exists()) miss += "busybox ";
                    if (!new File(rootFs, "lib/ld-musl-aarch64.so.1").exists()
                            && !new File(rootFs, "usr/lib/ld-musl-aarch64.so.1").exists()) miss += "lib/ld-musl ";
                    if (!new File(rootFs, "usr/bin/oc").exists() && !new File(rootFs, "bin/oc").exists()) miss += "oc ";
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
        /* Tolak layout lama & varian: busybox bisa di bin/ atau usr/bin/, musl bisa
           di lib/ atau usr/lib/, oc pasti ada di usr/bin/. Kalau rootfs lama valid
           tapi belum ada marker → tandai sekarang, jangan sampai ekstrak ulang penuh
           (inilah yang bikin "stuck extract" saat update tanpa uninstall). */
        boolean bb = new File(rootFs, "bin/busybox").exists()
                || new File(rootFs, "usr/bin/busybox").exists();
        boolean musl = new File(rootFs, "lib/ld-musl-aarch64.so.1").exists()
                || new File(rootFs, "usr/lib/ld-musl-aarch64.so.1").exists()
                || new File(rootFs, "lib/aarch64-linux-gnu/ld-linux-aarch64.so.1").exists();
        boolean oc = new File(rootFs, "usr/bin/oc").exists()
                || new File(rootFs, "bin/oc").exists();
        boolean core = bb && musl && oc;
        if (core && !new File(rootFs, EXT_OK).exists()) {
            try { new File(rootFs, EXT_OK).createNewFile(); } catch (Exception ignored) {}
        }
        return core && new File(rootFs, EXT_OK).exists();
    }

    private void delTree(File f) {
        File[] k = f.listFiles();
        if (k != null) for (File x : k) delTree(x);
        f.delete();
    }

    /* pindahkan pohon direktori (fallback saat renameTo gagal) */
    private void moveTree(File src, File dst) {
        if (src.isDirectory()) {
            dst.mkdirs();
            File[] kids = src.listFiles();
            if (kids != null) for (File k : kids) moveTree(k, new File(dst, k.getName()));
            src.delete();
        } else {
            File p = dst.getParentFile();
            if (p != null) p.mkdirs();
            try (java.io.FileInputStream fi = new java.io.FileInputStream(src);
                 java.io.FileOutputStream fo = new java.io.FileOutputStream(dst)) {
                byte[] b = new byte[65536];
                int r;
                while ((r = fi.read(b)) > 0) fo.write(b, 0, r);
            } catch (Exception ignored) {}
            src.delete();
        }
    }

    /* pindah pohon direktori secara INSTAN via renameTo; kalau gagal baru salin.
       Beda dengan moveTree: restore .old → rootfs jadi seketika, tidak "ekstrak ulang". */
    private void moveDir(File src, File dst) {
        if (dst.exists()) { if (dst.isDirectory()) delTree(dst); else dst.delete(); }
        if (!src.renameTo(dst)) moveTree(src, dst);
    }

    private void setupLibLinks() {
        linkDir = new File(getFilesDir(), "lib");
        linkDir.mkdirs();
        mkLink("libtalloc.so", "libtalloc.so.2");
        mkLink("libshmem.so", "libandroid-shmem.so");
    }
    /* Jalur binary native yang PASTI bisa dieksekusi. extractNativeLibs=true
       membuat Android mengekstrak lib/*.so ke nativeLibraryDir saat install
       (dijamin executable oleh sistem) — lebih andal daripada ekstrak manual
       ke files/native yang bisa gagal setExecutable (error=13 Permission denied). */
    private String nativeExec(String name) {
        File f = new File(getApplicationInfo().nativeLibraryDir, name);
        if (f.exists()) return f.getAbsolutePath();
        return new File(natLib, name).getAbsolutePath();
    }

    private void mkLink(String src, String dst) {
        File d = new File(linkDir, dst);
        if (d.exists()) return;
        /* target: nativeLibraryDir (sudah diekstrak Android saat install) lebih dulu,
           fallback files/native (ekstrak manual). Symlink HARUS mengarah ke lokasi yang
           benar biar libtalloc.so.2 / libandroid-shmem.so resolve. */
        File nd = new File(getApplicationInfo().nativeLibraryDir, src);
        File srcFile = nd.exists() ? nd : new File(natLib, src);
        try {
            Os.symlink(srcFile.getAbsolutePath(), d.getAbsolutePath());
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
                    while (!sawIdle && wait < 40000) { Thread.sleep(2000); wait += 2000; }
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

                    // selalu dump output 'opencode serve' (termasuk error koneksi ke zen
                    // dari dalam rootfs proot) supaya akar respon lambat terlihat
                    synchronized (serverLog) {
                        String sl = serverLog.toString();
                        Diagnostics.extra("server-log", sl.length() > 3000 ? sl.substring(sl.length() - 3000) : sl);
                    }

                    testAllModels();

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

    /* ===== tes SEMUA model satu per satu =====
       Daftar model diambil dari MODELS di halaman (sinkron dengan UI).
       Tiap model: set → kirim "balas OK" → tunggu delta pertama / idle / error
       → catat waktu + status. Hasil disimpan sebagai tabel JSON di Diagnostics. */
    private void testAllModels() throws Exception {
        Diagnostics.step("model-all", "mulai tes semua model");
        String modelsJson = evalSync("JSON.stringify(MODELS.map(function(m){return m.id}))");
        JSONArray models = new JSONArray(modelsJson);
        JSONArray hasil = new JSONArray();

        /* model yang sudah terbukti cepat → timeout pendek; sisanya diberi 75 dtk
           (relay bisa mengantre lama). Yang butuh API key erorr cepat tanpa key. */
        java.util.Set<String> verified = new java.util.HashSet<>();
        verified.add("opencode/big-pickle");
        verified.add("opencode/hy3-free");

        for (int i = 0; i < models.length(); i++) {
            final String id = models.getString(i);
            Diagnostics.step("model-set", "ganti ke " + id);
            evalSync("setModel(" + jq(id) + "); true");
            Thread.sleep(800);

            /* bersihkan sisa tes sebelumnya (kalau ada bubble/hint/busy nyangkut) */
            evalSync("if (typeof forceStop==='function' && (busy||window._done)) { forceStop(); } true");
            evalSync("window._lastOnError=null; true");
            Thread.sleep(600);

            Diagnostics.step("model-kirim:" + id, "kirim 'balas OK'");
            evalSync("document.getElementById('inp').value='balas OK'; document.getElementById('go').click(); true");

            long timeoutMs = verified.contains(id) ? 30000 : 75000;
            long t0 = System.currentTimeMillis();
            while (System.currentTimeMillis() - t0 < timeoutMs) {
                Thread.sleep(700);
                if (sawIdle) break;                 /* jawaban selesai */
                if (!busy && deltaCount == 0) break; /* error senyap — bridge sudah lepas */
            }

            /* kalau masih nyangkut, cancel supaya model berikutnya bersih */
            if (busy) {
                Diagnostics.step("model-cancel:" + id, "timeout " + ((System.currentTimeMillis() - t0) / 1000) + "s, batalkan");
                evalSync("if (busy) { go.onclick(); } true");
                Thread.sleep(1500);
                evalSync("if (busy) { forceStop(); } true");
            }

            long first = firstDeltaMs;
            int d = deltaCount;
            boolean idle = sawIdle;
            String err = evalSync("(window._lastOnError||'').substring(0,100)");

            JSONObject r = new JSONObject();
            r.put("model", id);
            r.put("delta", d);
            r.put("firstMs", first < 0 ? "n/a" : String.valueOf(first));
            r.put("idle", idle);
            if (err.length() > 0) r.put("err", err);
            hasil.put(r);
            Diagnostics.step("model:" + id, "delta=" + d
                    + ", pertama=" + (first < 0 ? "n/a" : first + "ms")
                    + ", idle=" + idle
                    + (err.length() > 0 ? ", err=" + err.substring(0, Math.min(80, err.length())) : ""));
        }
        Diagnostics.extra("model-results", hasil.toString());
        Diagnostics.step("model-all", "selesai: " + models.length() + " model dites");
    }

    /* ================= server opencode ================= */

    /* ekstrak native libs dari APK ke filesDir/native — dipakai saat
       extractNativeLibs=false supaya install tetap instan */
    private void ensureNativeLibs() throws IOException {
        /* extractNativeLibs=true => Android SUDAH mengekstrak semua lib/*.so ke
           nativeLibraryDir saat install (termasuk libopencode 195MB). Ekstrak manual ke
           files/native = duplikasi yang bikin buka app LAMBAT. Karena itu, kalau
           nativeLibraryDir sudah lengkap, langsung anggap siap (cepat, tanpa progress 195MB). */
        File ndir = new File(getApplicationInfo().nativeLibraryDir);
        if (ndir.exists() && new File(ndir, "libproot.so").exists()
                && new File(ndir, "libopencode.so").exists()
                && new File(ndir, "libtalloc.so").exists()) {
            writeVersionMarker();
            return;
        }
        /* fallback (jarang): nativeLibraryDir kosong — ekstrak manual dari APK */
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
                out.setReadable(true, false);
                /* fallback: beberapa perangkat menolak setExecutable langsung — paksa via mod */
                if (!out.canExecute() && new File("/system/bin/chmod").exists()) {
                    try {
                        Runtime.getRuntime().exec(new String[]{"/system/bin/chmod", "755", out.getAbsolutePath()}).waitFor();
                    } catch (Exception ignored) {}
                }
            }
        }
        push("window.setProgressBytes(" + total + ")");
        writeVersionMarker();
    }

    private void writeVersionMarker() throws IOException {
        File verFile = new File(natLib, ".version");
        natLib.mkdirs();
        try (FileOutputStream fv = new FileOutputStream(verFile)) { fv.write(appInfoSafe().getBytes()); }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK && resultCode == RESULT_OK && data != null && data.getData() != null) {
            Uri u = data.getData();
            try {
                String name = queryDisplayName(u);
                if (name == null || name.isEmpty()) name = "file_" + System.currentTimeMillis();
                workDir.mkdirs();
                File dest = new File(workDir, name);
                try (InputStream in = getContentResolver().openInputStream(u);
                     OutputStream out = new FileOutputStream(dest)) {
                    byte[] buf = new byte[65536];
                    int r;
                    while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                }
                push("window.onFileReady(" + jq(name) + ", " + jq(dest.getAbsolutePath()) + ")");
            } catch (Exception e) {
                push("window.onFileError(" + jq(String.valueOf(e)) + ")");
            }
        }
    }

    private String queryDisplayName(Uri u) {
        try (android.database.Cursor c = getContentResolver().query(u, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) return c.getString(idx);
            }
        } catch (Exception ignored) {}
        return null;
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
            String proot = nativeExec("libproot.so");
            String loader = nativeExec("libproot_loader.so");

            java.util.List<String> c = new java.util.ArrayList<>();
            c.add(proot);
            c.add("--kill-on-exit");
            c.add("-0");
            c.add("-r"); c.add(rootFs.getAbsolutePath());
            c.add("-b"); c.add("/dev");
            c.add("-b"); c.add("/proc");
            c.add("-b"); c.add("/sys");
            c.add("-b"); c.add(nativeExec("libopencode.so") + ":/usr/bin/opencode");
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
            pb.environment().put("LD_LIBRARY_PATH", getApplicationInfo().nativeLibraryDir + ":" + linkDir.getAbsolutePath() + ":" + natLib.getAbsolutePath());
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
            /* Deteksi siap berbasis LOG + proses, bukan HTTP connect. Beberapa perangkat
               memblokir HttpURLConnection walaupun server lokal sudah live (proxy/loopback/
               ipv6), yang bikin "server gagal start" palsu. Selama proses opencode masih
               hidup dan sudah mencetak "listening", server dianggap siap. */
            while (running && waited < 120000) {
                boolean alive = true;
                try { serverProc.exitValue(); alive = false; } catch (IllegalThreadStateException e) { /* masih berjalan */ }
                String log;
                synchronized (serverLog) { log = serverLog.toString(); }
                if (!alive) break;                                 // proses mati = gagal
                if (log.contains("listening")) { serverUp = true; break; }  // siap
                /* fallback: proses hidup tapi belum "listening" lama — coba HTTP sekali saja
                   (best effort, jangan jadi blokir utama) */
                if (waited > 5000 && httpCode("http://127.0.0.1:" + PORT + "/", 800) > 0) {
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
            c = (HttpURLConnection) new URL(url).openConnection(Proxy.NO_PROXY);
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
                                new URL("http://127.0.0.1:" + PORT + "/event").openConnection(Proxy.NO_PROXY);
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

            /* Event error dari server (mis. model tidak diserve relay / gagal load):
               langsung kabari UI — jangan biarkan user nunggu timeout 180 detik. */
            boolean err = false;
            String errMsg = "";
            if (type.contains("error")) {
                err = true;
                errMsg = pr.optString("message", type);
                JSONObject part = ev.optJSONObject("part");
                if (part != null && errMsg.length() == 0) errMsg = part.optString("error", type);
            } else {
                JSONObject part = pr.optJSONObject("part");
                if (part != null && Boolean.parseBoolean(String.valueOf(part.opt("isError")))) {
                    err = true;
                    errMsg = part.optString("error", "model gagal merespons");
                }
            }
            if (err) {
                if (busy) {
                    busy = false;
                    wakeFree();
                    String clean = errMsg == null || errMsg.length() == 0 ? "model gagal merespons" : errMsg.trim();
                    if (clean.length() > 200) clean = clean.substring(0, 200);
                    push("window.onError(" + jq("Model error: " + clean) + "," + reqTok + ")");
                }
                return;
            }

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
                    push("window.onDone(0," + reqTok + ")");
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
            synchronized (this) {
                if (msgConn != null) return;   /* masih ada HTTP aktif — jangan tumpuk */
                if (busy) {
                    /* busy macet (mis. SSE putus sebelum session.idle datang).
                       Pulihkan dulu biar kirim kedua/berikutnya tidak ditolak senyap. */
                    busy = false;
                }
                busy = true;
            }
            wakeHold();
            sawIdle = false;
            deltaCount = 0;
            firstDeltaMs = -1;
            tSendMs = System.currentTimeMillis();
            final int myTok = ++reqTok;   /* callback SSE/cancel lama memakai token lama */
            /* watchdog: kalau session.idle tidak pernah datang (stream putus parah),
               reset UI otomatis agar tombol tidak nyangkut & pesan berikut tetap bisa dikirim */
            Thread wd = new Thread(new Runnable() {
                @Override
                public void run() {
                    try { Thread.sleep(180000); } catch (InterruptedException e) { return; }
                    if (busy && !sawIdle) {
                        busy = false;
                        wakeFree();
                        push("window.onDone(-1," + myTok + ")");
                    }
                }
            });
            wd.setDaemon(true);
            wd.start();
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
                        /* sanitasi: provider 'zen' tidak terdaftar di server opencode
                           => 500 'Model not found'. Alihkan ke provider 'opencode' yang valid. */
                        if ("zen".equalsIgnoreCase(prov)) prov = "opencode";
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
                                    + sessionId + "/message").openConnection(Proxy.NO_PROXY);
                            mc.setRequestMethod("POST");
                            mc.setConnectTimeout(8000);
                            mc.setReadTimeout(180000);
                            mc.setDoOutput(true);
                            mc.setRequestProperty("Content-Type", "application/json");
                            OutputStream os = mc.getOutputStream();
                            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                            os.close();
                            synchronized (MainActivity.this) { msgConn = mc; }
                            int code = mc.getResponseCode();
                            InputStream is = code >= 400 ? mc.getErrorStream() : mc.getInputStream();
                            BufferedReader rr = new BufferedReader(
                                    new InputStreamReader(is, StandardCharsets.UTF_8));
                            StringBuilder sb2 = new StringBuilder();
                            String l2;
                            while ((l2 = rr.readLine()) != null) sb2.append(l2);
                            rr.close();
                            synchronized (MainActivity.this) { msgConn = null; }
                            if (autotest) Diagnostics.step("post-selesai", "HTTP " + code + " panjang=" + sb2.length());
                            if (code >= 400) {
                                /* sesi mungkin rusak/abort — paksa sesi baru untuk kiriman berikut */
                                sessionId = null;
                                throw new Exception("HTTP " + code);
                            }
                            String res = sb2.toString();
                            if (res.length() == 0 || res.startsWith("<")) {
                                if (autotest) Diagnostics.step("post-aneh", res.substring(0, Math.min(80, res.length())));
                                throw new Exception("respon server tidak valid");
                            }
                            if (autotest) Diagnostics.step("post-ok", "pesan masuk antrian selesai");
                        } finally {
                            synchronized (MainActivity.this) { msgConn = null; }
                            if (mc != null) mc.disconnect();
                        }
                        // teks mengalir via SSE; session.idle yang menutup
                    } catch (Exception e) {
                        sessionId = null;   /* pastikan kiriman berikut buat sesi baru yang sehat */
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
            doCancel(sessionId, msgConn);
        }

        @JavascriptInterface
        public void newChat() {
            sessionId = null;
            /* warm-up sesi: buat sesi baru di background supaya kiriman pertama
               setelah "obrolan baru" langsung nyasar, tidak nunggu bikin sesi dulu */
            if (serverUp && !busy) {
                Thread t = new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            String r = httpPost("http://127.0.0.1:" + PORT + "/session",
                                    "{\"title\":\"obrolan\"}");
                            if (sessionId == null) {
                                sessionId = new JSONObject(r).optString("id", null);
                            }
                        } catch (Exception ignored) {}
                    }
                });
                t.setDaemon(true);
                t.start();
            }
        }

        @JavascriptInterface
        public void pickFile() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("*/*");
                        startActivityForResult(Intent.createChooser(i, "Lampirkan file"), REQ_PICK);
                    } catch (Exception e) {
                        push("window.onFileError(" + jq(String.valueOf(e)) + ")");
                    }
                }
            });
        }

        /* Baca file gambar sebagai data URL untuk PRIVIEW di bubble (bukan untuk dikirim
           ke model — model cukup dapat path, biar tidak lambat). Batasi 8MB & hanya gambar. */
        @JavascriptInterface
        public String readImageDataUrl(String path) {
            try {
                File f = new File(path);
                if (!f.exists() || f.length() > 8L * 1024 * 1024) return null;
                String n = f.getName().toLowerCase();
                String mime;
                if (n.endsWith(".jpg") || n.endsWith(".jpeg")) mime = "image/jpeg";
                else if (n.endsWith(".png")) mime = "image/png";
                else if (n.endsWith(".gif")) mime = "image/gif";
                else if (n.endsWith(".webp")) mime = "image/webp";
                else if (n.endsWith(".bmp")) mime = "image/bmp";
                else return null;
                byte[] b = new byte[(int) f.length()];
                try (java.io.FileInputStream fin = new java.io.FileInputStream(f)) {
                    int off = 0;
                    while (off < b.length) {
                        int r = fin.read(b, off, b.length - off);
                        if (r < 0) break;
                        off += r;
                    }
                }
                return "data:" + mime + ";base64," +
                        android.util.Base64.encodeToString(b, android.util.Base64.NO_WRAP);
            } catch (Exception e) {
                return null;
            }
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
                    java.net.HttpURLConnection cx = (java.net.HttpURLConnection) u.openConnection(Proxy.NO_PROXY);
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

        /* ambil daftar model gratis terkini dari relay resmi opencode
           (opencode.ai/zen/v1/models) → teruskan ke window.onModels([...]).
           Dipanggil tiap buka menu model; kalau ada model baru di katalog
           (mis. Ling 3.0) langsung muncul tanpa perlu update APK. */
        @JavascriptInterface
        public void fetchModels() {
            Thread t = new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        java.net.URL u = new java.net.URL("https://opencode.ai/zen/v1/models");
                        java.net.HttpURLConnection cx = (java.net.HttpURLConnection) u.openConnection(Proxy.NO_PROXY);
                        try {
                            cx.setConnectTimeout(8000); cx.setReadTimeout(8000);
                            cx.setRequestProperty("User-Agent", "opencode-android");
                            java.io.BufferedReader r = new java.io.BufferedReader(
                                new java.io.InputStreamReader(cx.getInputStream()));
                            StringBuilder sb = new StringBuilder(); String l;
                            while ((l = r.readLine()) != null) sb.append(l);
                            r.close();
                            org.json.JSONObject j = new org.json.JSONObject(sb.toString());
                            org.json.JSONArray data = j.optJSONArray("data");
                            org.json.JSONArray gratis = new org.json.JSONArray();
                            if (data != null) {
                                for (int i = 0; i < data.length(); i++) {
                                    String id = data.getJSONObject(i).optString("id", "");
                                    if (id.endsWith("-free")) gratis.put(id);
                                }
                            }
                            push("window.onModels(" + gratis.toString() + ")");
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
            c = (HttpURLConnection) new URL(urlStr).openConnection(Proxy.NO_PROXY);
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
        return "opencode/big-pickle";
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

    /* cancel bersama yang dipakai oleh Bridge.cancel() dan onBackPressed() —
       watchdog: sesi null pun UI harus selalu di-reset */
    private void doCancel(final String sid, final HttpURLConnection cc) {
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
                push("window.onDone(-2," + reqTok + ")");
            }
        }).start();
    }

    @Override
    public void onBackPressed() {
        if (busy) {
            /* cancel via bridge langsung — jangan buat Bridge() baru */
            doCancel(sessionId, msgConn);
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
