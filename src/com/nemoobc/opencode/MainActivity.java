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

import org.json.JSONArray;
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
    /* token saat CANCEL dimulai — dipakai onDone(-2) dari doCancel. Beda dengan
       reqTok (token TERAKHIR): kalau user cancel lalu langsung kirim pesan baru,
       cancel lama memakai reqTok yang sudah naik → onDone(-2) yang tertunda
       dianggap milik kiriman baru dan menimpa jawaban "gagal (kode -2)".
       cancelTok di-freeze di awal doCancel sehingga callback cancel stale
       selalu lebih kecil dari token kiriman baru → ditolak JS. */
    private volatile int cancelTok = -1;
    private static final int PORT = 4096;
    private static final int REQ_PICK = 7001;
    /* marker ekstraksi rootfs SELESAI & valid — dicek biar app tidak
       ekstrak ulang tiap buka (keluar-masuk/update) dan tidak memakai
       rootfs parsial dari ekstraksi yang terputus */
    private static final String EXT_OK = ".oc-ok";
    /* log fase startup — ditulis ke filesDir/debug.txt DAN Download/opencode-debug.txt
       (via MediaStore, tanpa permission) supaya bisa dianalisis dari Termux ketika
       app mati terlalu cepat untuk terlihat di logcat. */
    private final StringBuilder debugBuf = new StringBuilder();
    /* TUNDA WebView sampai server siap (hemat RAM startup — perangkat sempit).
       push() di-queue dulu; dieksekusi setelah halaman selesai dimuat. */
    private final java.util.List<String> pendingJs = new java.util.ArrayList<>();
    private volatile boolean webLoaded;
    private volatile boolean webInit;
    private android.widget.TextView stageView;
    private android.widget.ProgressBar progView;

    private void debugLog(String msg) {
        try {
            /* pantauan via ADB logcat: semua jejak app diforward ke tag "OpenCode"
               supaya bisa dilihat dari app ADB / `adb logcat` di luar device */
            try { android.util.Log.d("OpenCode", msg); } catch (Throwable ignored) {}
            String line = new java.text.SimpleDateFormat("HH:mm:ss.SSS").format(new java.util.Date())
                    + " " + msg + "\n";
            synchronized (debugBuf) {
                debugBuf.append(line);
                if (debugBuf.length() > 40000) debugBuf.delete(0, debugBuf.length() - 40000);
            }
            /* HANYA tulis file internal (cepat). MediaStore dipindah ke thread
               terjadwal (mediaDump) — dulu nulis MediaStore di sini memblokir
               main thread 4,5 DETIK saat onCreate. */
            try {
                File f = new File(getFilesDir(), "debug.txt");
                try (FileOutputStream fo = new FileOutputStream(f, true)) {
                    fo.write(line.getBytes());
                }
            } catch (Exception ignored) {}
        } catch (Throwable ignored) {}
    }

    /* flush debugBuf ke Download/opencode-debug.txt DI BELAKANG (bukan main thread) —
       throttle tiap 2,5 detik biar startup tidak tersendat */
    private void startMediaDump() {
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                while (running) {
                    try { Thread.sleep(2500); } catch (InterruptedException e) { return; }
                    /* SALIN dulu isi buffer, LEPAS kunci, baru I/O MediaStore.
                       Sebelumnya kunci debugBuf dipegang selama openOutputStream —
                       MediaStore device ini sering gantung >detik → semua debugLog
                       (termasuk dari main thread via onPageFinished) ikut tersendat
                       → ANR → proses dibunuh diam-diam = "stuck di logo". */
                    String snap;
                    synchronized (debugBuf) { snap = debugBuf.toString(); }
                    try {
                        android.content.ContentValues cv = new android.content.ContentValues();
                        cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, "opencode-debug.txt");
                        cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "text/plain");
                        cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,
                                android.os.Environment.DIRECTORY_DOWNLOADS);
                        cv.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1);
                        android.net.Uri u = getContentResolver().insert(
                                android.provider.MediaStore.Downloads.getContentUri("external"), cv);
                        if (u != null) {
                            try (OutputStream os = getContentResolver().openOutputStream(u)) {
                                if (os != null) os.write(snap.getBytes());
                            }
                            cv = new android.content.ContentValues();
                            cv.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0);
                            getContentResolver().update(u, cv, null, null);
                        }
                    } catch (Exception ignored) {}
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        debugLog("onCreate: mulai");

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
                    debugLog("CRASH " + t.getName() + ": " + sw);
                    write(new File(getFilesDir(), "crash.txt"), s);
                    File ex = getExternalFilesDir(null);
                    if (ex != null) write(new File(ex, "crash.txt"), s);
                } catch (Exception ignored) {}
                android.os.Process.killProcess(android.os.Process.myPid());
            }
        });
        debugLog("crashHandler: terpasang");
        debugLog("memFree-kB: " + readMemFree());

        rootFs = new File(getFilesDir(), "rootfs");
        workDir = new File(getFilesDir(), "work");
        extWork = getExternalFilesDir(null);
        if (extWork == null) extWork = workDir;
        cacheDir = getCacheDir();
        natLib = new File(getFilesDir(), "native");

        if (!workDir.exists()) workDir.mkdirs();
        if (!extWork.exists()) extWork.mkdirs();
        /* JANGAN mkdir rootfs placeholder di sini: filesDir/rootfs yang ADA tapi
           KOSONG membuat readyOk() membuang waktu & mengganggu jalur backup
           (renameTo(rootfs→old) gagal karena rootfs placeholder menutupi old
           yang berisi sistem lama yang bisa dipulihkan). Dir config dibuat
           oleh saveConfig saat user menyimpan, dan oleh ekstraktor saat boot. */
        setupLibLinks();
        debugLog("dirs+libLinks: OK");

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

        /* BUAT WebView LANGSUNG seperti desain asli: splash logo tampil selama
           server boot, jadi UX tidak "beda/stuck". (Crash asli bukan karena RAM —
           itu karena MainActivity.class hilang dari APK.) */
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
                debugLog("web: onPageFinished");
                webLoaded = true;
                v.setVisibility(View.VISIBLE);
                flushPending();
                if (autotest) startAutoTest();
            }
        });
        setContentView(web);
        debugLog("webView: dibuat + setContentView");
        web.loadUrl("file:///android_asset/ui/index.html");
        debugLog("webView: loadUrl OK");

        new Thread(new Runnable() {
            @Override
            public void run() {
                try { ensureNativeLibs(); debugLog("bg: native siap"); } catch (Exception e) { debugLog("bg: ensureNativeLibs ERR " + e); push("window.onError(" + jq("Gagal siapkan binary: " + e) + ")"); requestWeb(); return; }
                boolean ready = readyOk();
                debugLog("bg: ready awalnya=" + ready);
                if (!ready) {
                    File old = new File(getFilesDir(), "rootfs.old");
                    File tmp = new File(getFilesDir(), "rootfs.tmp");
                    /* total byte payload ASLI (untuk % progress yang akurat) —
                       dulu hardcode 16332800 di Java & JS: begitu ukuran rootfs
                       berubah, progress overshoot >100%. */
                    long payloadLen = 0;
                    try { payloadLen = getAssets().openFd("payload/rootfs.bin").getLength(); }
                    catch (Exception ignored) {}
                    if (payloadLen > 0) {
                        final long pl = payloadLen;
                        push("window.PAYLOAD_TOTAL = " + pl + ";");
                        debugLog("bg: payload total=" + pl);
                    }
                    push("window.setStage(\"menyiapkan sistem — memeriksa...\")");
                    stageUi("Menyiapkan sistem — memeriksa...");
                    try {
                        if (tmp.exists()) {
                            push("window.setStage(\"menyiapkan sistem — membersihkan sisa...\")");
                            stageUi("Menyiapkan sistem — membersihkan sisa...");
                            debugLog("bg: bersihkan tmp");
                            delTree(tmp);
                        }
                        /* Sisa percobaan yang ditutup paksa: rootfs belum ada, .old ada.
                           Pulihkan dulu — PRIORITAS renameTo (instan), bukan menyalin
                           file satu-satu yang bikin "ekstrak ulang" & stuck lama. */
                        if (!rootFs.exists() && old.exists()) {
                            push("window.setStage(\"menyiapkan sistem — memulihkan sistem lama...\")");
                            stageUi("Menyiapkan sistem — memulihkan sistem lama...");
                            debugLog("bg: pulihkan old→rootfs");
                            moveDir(old, rootFs);
                        }
                        if (readyOk()) {
                            ready = true;
                        } else {
                            /* Kalau rootfs lama ada, BACKUP dulu — pakai renameTo instan */
                            if (rootFs.exists()) {
                                push("window.setStage(\"menyiapkan sistem — menyimpan sistem lama...\")");
                                stageUi("Menyiapkan sistem — menyimpan sistem lama...");
                                debugLog("bg: backup rootfs→old");
                                if (!rootFs.renameTo(old)) moveTree(rootFs, old);
                            }
                            push("window.setStage(\"menyiapkan sistem — mengekstrak...\")");
                            stageUi("Menyiapkan sistem — mengekstrak...");
                            debugLog("bg: mulai ekstrak");
                            tmp.mkdirs();
                            push("window.setProgress(1)");
                            progressUi(1);
                            InputStream raw = getAssets().open("payload/rootfs.bin");
                            TarExtractor.Progress cb = new TarExtractor.Progress() {
                                @Override
                                public void onEntry(int n) {
                                    if (n % 10 == 0) { push("window.setProgress(" + n + ")"); progressUi(n); }
                                }
                                @Override
                                public void onBytes(long b) {
                                    push("window.setProgressBytes(" + b + ")");
                                }
                            };
                            TarExtractor.extractGz(new BufferedInputStream(raw, 1 << 16), tmp, cb);
                            debugLog("bg: ekstrak selesai");
                            for (String p : new String[]{"usr/bin/oc"}) {
                                File f = new File(tmp, p);
                                if (f.exists()) f.setExecutable(true, false);
                            }
                            new File(tmp, EXT_OK).createNewFile();
                            if (!tmp.renameTo(rootFs)) moveTree(tmp, rootFs);
                            ready = readyOk();
                            debugLog("bg: ready setelah ekstrak=" + ready);
                            /* JANGAN langsung hapus old di sini: kalau app dibunuh saat
                               penghapusan berjalan, buka berikutnya harusnya GAMPANG
                               restore. Hapus old nanti, setelah server mulai hidup. */
                            if (ready && old.exists()) {
                                push("window.setProgress(555)");
                                progressUi(100);
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
                        debugLog("bg: EKSTRAKSI ERROR " + e);
                        if (!rootFs.exists() && old.exists()) moveDir(old, rootFs);
                        stageUi("Ekstraksi gagal — coba buka lagi");
                        push("window.onError(" + jq("Ekstraksi gagal: " + e) + ")");
                        requestWeb();
                        return;
                    }
                    push("window.setStage(\"menyalakan server AI...\")");
                    stageUi("Menyalakan server AI...");
                }
                if (!ready) {
                    String miss = "";
                    if (!new File(rootFs, "bin/busybox").exists() && !new File(rootFs, "usr/bin/busybox").exists()) miss += "busybox ";
                    if (findMusl(rootFs) == null) miss += "lib/ld-musl ";
                    if (!new File(rootFs, "usr/bin/oc").exists() && !new File(rootFs, "bin/oc").exists()) miss += "oc ";
                    debugLog("bg: payload kurang: " + miss);
                    stageUi("Payload tidak lengkap");
                    push("window.onError(" + jq("payload tidak lengkap, kurang: " + miss) + ")");
                    requestWeb();
                    return;
                }
                debugLog("bg: panggil startServer, mem=" + readMemFree());
                startServer();
                debugLog("bg: startServer kembali");
            }
        }).start();
        startMediaDump();
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

    private String readMemFree() {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(
                new FileInputStream("/proc/meminfo")))) {
            String ln;
            while ((ln = r.readLine()) != null) {
                if (ln.startsWith("MemAvailable:")) return ln.trim();
            }
        } catch (Exception ignored) {}
        return "?";
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

    /* cari loader musl/glibc pada rootfs (aarch64 ATAU x86_64, alpine ATAU debian).
       Dulu di-hardcode aarch64 sehingga rootfs x86_64 (emulator/PC) tidak pernah
       dikenali → server tidak pernah start → ConnectException 4096. */
    private String findMusl(File root) {
        for (String dirName : new String[]{"lib", "usr/lib"}) {
            File dir = new File(root, dirName);
            String[] names = dir.isDirectory() ? dir.list() : null;
            if (names == null) continue;
            for (String n : names) {
                if (n.startsWith("ld-musl-") || n.startsWith("ld-linux-")
                        || n.equals("ld-musl-aarch64.so.1") || n.equals("ld-musl-x86_64.so.1")) {
                    return dirName + "/" + n;
                }
            }
            for (String sub : names) {
                if (!sub.endsWith("-linux-gnu")) continue;
                File g = new File(dir, sub);
                String[] subNames = g.isDirectory() ? g.list() : null;
                if (subNames == null) continue;
                for (String n : subNames) {
                    if (n.startsWith("ld-linux-") || n.startsWith("ld-musl-")) {
                        return dirName + "/" + sub + "/" + n;
                    }
                }
            }
        }
        return null;
    }

    private boolean readyOk() {
        /* Tolak layout lama & varian: busybox bisa di bin/ atau usr/bin/, musl bisa
           di lib/ atau usr/lib/, oc pasti ada di usr/bin/. Kalau rootfs lama valid
           tapi belum ada marker → tandai sekarang, jangan sampai ekstrak ulang penuh
           (inilah yang bikin "stuck extract" saat update tanpa uninstall). */
        boolean bb = new File(rootFs, "bin/busybox").exists()
                || new File(rootFs, "usr/bin/busybox").exists();
        boolean musl = findMusl(rootFs) != null;
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
        /* SALIN file asli tiap boot (bukan symlink). Path install Android berubah
           tiap update (/data/app/~~SESSION==/pkg-XXX==), symlink lama mengacu path
           mati → linker CANNOT LINK: libtalloc.so.2 not found. Salin + REPLACE
           menghapus masalah staleness; ukuran lib ini puluhan KB jadi aman. */
        File d = new File(linkDir, dst);
        File nd = new File(getApplicationInfo().nativeLibraryDir, src);
        File srcFile = nd.exists() ? nd : new File(natLib, src);
        try {
            try (java.io.InputStream in = new java.io.FileInputStream(srcFile);
                 java.io.OutputStream out = new java.io.FileOutputStream(d)) {
                byte[] buf = new byte[65536];
                int r;
                while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
            }
        } catch (Exception e) {
            debugLog("mkLink " + src + "->" + dst + " ERR " + e);
        }
    }

    private void push(final String js) {
        if (web != null && webLoaded) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    try { web.evaluateJavascript(js, null); } catch (Exception ignored) {}
                }
            });
        } else {
            synchronized (pendingJs) { pendingJs.add(js); }
        }
    }

    private android.view.View buildProgressUi() {
        android.widget.LinearLayout ll = new android.widget.LinearLayout(this);
        ll.setOrientation(android.widget.LinearLayout.VERTICAL);
        ll.setGravity(android.view.Gravity.CENTER);
        ll.setBackgroundColor(0xFF0C100E);
        int pd = (int) (24 * getResources().getDisplayMetrics().density);
        ll.setPadding(pd, pd, pd, pd);
        stageView = new android.widget.TextView(this);
        stageView.setText("Menyalakan OpenCode...");
        stageView.setTextColor(0xFFE8EAED);
        stageView.setGravity(android.view.Gravity.CENTER);
        progView = new android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progView.setMax(100);
        android.widget.LinearLayout.LayoutParams lp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        ll.addView(stageView);
        ll.addView(progView, lp);
        return ll;
    }

    private void stageUi(final String s) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                if (stageView != null) stageView.setText(s);
            }
        });
    }

    private void progressUi(final int n) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                if (progView != null) progView.setProgress(n);
            }
        });
    }

    /* buat WebView di UI thread — dipanggil saat server sudah siap (atau saat
       error fatal, supaya pesan error tetap tampil) */
    private void requestWeb() {
        ui.post(new Runnable() {
            @Override
            public void run() {
                ensureWeb();
            }
        });
    }

    private void ensureWeb() {
        if (web != null) return;  /* WebView sudah dibuat langsung di onCreate */
        if (webInit) return;
        webInit = true;
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
                debugLog("web: onPageFinished");
                webLoaded = true;
                v.setVisibility(View.VISIBLE);
                flushPending();
                if (autotest) startAutoTest();
            }
        });
        setContentView(web);
        debugLog("webView: dibuat + setContentView");
        web.loadUrl("file:///android_asset/ui/index.html");
        debugLog("webView: loadUrl OK");
    }

    private void flushPending() {
        java.util.List<String> copy;
        synchronized (pendingJs) {
            copy = new java.util.ArrayList<>(pendingJs);
            pendingJs.clear();
        }
        for (String js : copy) {
            try { web.evaluateJavascript(js, null); } catch (Exception ignored) {}
        }
        debugLog("web: pending JS terkirim, n=" + copy.size());
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
        /* Daftar model diambil dari MODELS di halaman (sinkron dengan UI).
           CATATAN: jangan JSON.stringify di sini — evaluateJavascript sudah
           JSON-encode hasilnya, jadi string yang di-quote ganda akan membuat
           JSONArray() menolak ("String cannot be converted to JSONArray"). */
        String modelsRaw = evalSync("MODELS.map(function(m){return m.id})");
        JSONArray models = new JSONArray(modelsRaw);
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
                /* Salin ke extWork BUKAN files/work: proot meng-mount extWork -> /work,
                   jadi file ini yang terlihat model di sandbox. */
                if (extWork == null) extWork = getFilesDir();
                extWork.mkdirs();
                File dest = new File(extWork, name);
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
            int warm = httpCode("http://127.0.0.1:" + PORT + "/", 1200);
            debugLog("startServer: warm-check http=" + warm);
            if (warm > 0) {
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
            debugLog("startServer: proot spawn OK, mem=" + readMemFree());
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
                debugLog("startServer: GAGAL, tail=" + tail);
                if (autotest) Diagnostics.step("server-log", tail);
                /* probe: jalankan opencode --version lewat proot SEKALI, tangkap
                   output+exit code — membedakan kegagalan di proot vs opencode */
                try {
                    java.util.List<String> pr = new java.util.ArrayList<>(c.subList(0, c.size() - 3));
                    pr.add("--version");
                    ProcessBuilder pb2 = new ProcessBuilder(pr);
                    pb2.environment().clear();
                    pb2.environment().putAll(pb.environment());
                    pb2.redirectErrorStream(true);
                    Process p2 = pb2.start();
                    StringBuilder sb2 = new StringBuilder();
                    try (java.io.InputStream is = p2.getInputStream()) {
                        byte[] b2 = new byte[512];
                        int n;
                        long t0 = System.currentTimeMillis();
                        while ((n = is.read(b2)) > 0 && System.currentTimeMillis() - t0 < 8000) {
                            sb2.append(new String(b2, 0, n));
                        }
                    }
                    int ex2;
                    try { ex2 = p2.exitValue(); } catch (IllegalThreadStateException e) { p2.destroy(); ex2 = -999; }
                    String probe = "exit=" + ex2 + " out=" + sb2;
                    debugLog("startServer: probe " + probe);
                    if (autotest) Diagnostics.step("server-probe", probe);
                } catch (Exception pe) {
                    debugLog("startServer: probe EXCEPTION " + pe);
                    if (autotest) Diagnostics.step("server-probe", "EXCEPTION " + pe);
                }
                stageUi("Server gagal start");
                push("window.onError(" + jq("server gagal start: " + tail) + ")");
                requestWeb();
                return;
            }
            debugLog("startServer: serverUp, mem=" + readMemFree());
            requestWeb();
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
            debugLog("startServer: EXCEPTION " + e);
            stageUi("Server error");
            push("window.onError(" + jq("Server error: " + e) + ")");
            requestWeb();
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
                        debugLog("sse: terhubung");
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
        public int send(final String prompt) {
            synchronized (this) {
                if (msgConn != null) return 0;   /* masih ada HTTP aktif — jangan tumpuk */
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
            cancelTok = -1;               /* cancel berikutnya freeze token baru */
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
            return myTok;   /* sumber token tunggal: JS memakai nilai ini utk _reqTok */
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
        if (cancelTok < 0) cancelTok = reqTok;   /* freeze token KIRIMAN YANG DI-CANCEL */
        final int myTok = cancelTok;
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
                push("window.onDone(-2," + myTok + ")");
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
