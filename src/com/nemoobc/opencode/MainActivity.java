package com.nemoobc.opencode;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
    private volatile boolean running = true;

    private File rootFs, extWork, cacheDir, natLib, linkDir, workDir;
    private Process serverProc;
    private volatile boolean serverUp = false;
    private volatile String sessionId = null;
    private volatile HttpURLConnection msgConn = null;
    private static final int PORT = 4096;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        rootFs = new File(getFilesDir(), "rootfs");
        workDir = new File(getFilesDir(), "work");
        extWork = getExternalFilesDir(null);
        if (extWork == null) extWork = workDir;
        cacheDir = getCacheDir();
        natLib = new File(getApplicationInfo().nativeLibraryDir);

        if (!workDir.exists()) workDir.mkdirs();
        if (!extWork.exists()) extWork.mkdirs();
        new File(rootFs, "root/.config/opencode").mkdirs();
        setupLibLinks();

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
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/ui/index.html");

        new Thread(new Runnable() {
            @Override
            public void run() {
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
                        ready = readyOk();
                        if (!ready) {
                            delTree(rootFs);
                            InputStream raw2 = getAssets().open("payload/rootfs.bin");
                            TarExtractor.extractGz(new BufferedInputStream(raw2, 1 << 16), rootFs, cb);
                            ready = readyOk();
                        }
                    } catch (Exception e) {
                        push("window.onError(" + jq("Ekstraksi gagal: " + e) + ")");
                        return;
                    }
                }
                if (!ready) {
                    String miss = "";
                    if (!new File(rootFs, "usr/bin/busybox").exists()) miss += "usr/bin/busybox ";
                    if (!new File(rootFs, "lib/ld-musl-aarch64.so.1").exists()) miss += "lib/ld-musl ";
                    push("window.onError(" + jq("payload tidak lengkap, kurang: " + miss) + ")");
                    return;
                }
                startServer();
            }
        }).start();
    }

    private boolean readyOk() {
        return new File(rootFs, "usr/bin/busybox").exists()
                && new File(rootFs, "lib/ld-musl-aarch64.so.1").exists();
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

    /* ================= server opencode ================= */

    private void startServer() {
        try {
            if (httpCode("http://127.0.0.1:" + PORT + "/", 1200) == 200) {
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
                        while (r.readLine() != null && running) { /* buang log */ }
                    } catch (Exception ignored) {}
                }
            }).start();

            int waited = 0;
            while (running && waited < 90000) {
                if (httpCode("http://127.0.0.1:" + PORT + "/", 1500) == 200) {
                    serverUp = true;
                    break;
                }
                Thread.sleep(1000);
                waited += 1000;
            }
            if (!serverUp) {
                push("window.onError(" + jq("server opencode gagal start") + ")");
                return;
            }
            long free = rootFs.getFreeSpace() / (1024 * 1024);
            push("window.onReady(true," + free + ")");
            startEventStream();
        } catch (Exception e) {
            push("window.onError(" + jq("Server error: " + e) + ")");
        }
    }

    private int httpCode(String url, int timeout) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(timeout);
            c.setReadTimeout(timeout);
            int code = c.getResponseCode();
            c.disconnect();
            return code;
        } catch (Exception e) {
            return -1;
        }
    }

    /* ================= event stream (SSE) ================= */

    private void startEventStream() {
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                while (running) {
                    try {
                        HttpURLConnection c = (HttpURLConnection)
                                new URL("http://127.0.0.1:" + PORT + "/event").openConnection();
                        c.setConnectTimeout(5000);
                        c.setReadTimeout(0);
                        BufferedReader r = new BufferedReader(
                                new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
                        String line;
                        while (running && (line = r.readLine()) != null) {
                            if (!line.startsWith("data: ")) continue;
                            handleEvent(line.substring(6).trim());
                        }
                        r.close();
                    } catch (Exception ignored) {}
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
                    if (delta.length() > 0) push("window.appendOut(" + jq(delta) + ")");
                }
            } else if ("session.idle".equals(type)) {
                if (busy) {
                    busy = false;
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
                        HttpURLConnection mc = (HttpURLConnection)
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
                        if (code >= 400) throw new Exception("HTTP " + code);
                        String res = sb2.toString();
                        if (res.length() == 0 || res.startsWith("<")) {
                            throw new Exception("respon server tidak valid");
                        }
                        // teks mengalir via SSE; session.idle yang menutup
                    } catch (Exception e) {
                        busy = false;
                        push("window.onError(" + jq("Error: " + e) + ")");
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void cancel() {
            if (sessionId == null) return;
            final String sid = sessionId;
            final HttpURLConnection cc = msgConn;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    if (cc != null) { try { cc.disconnect(); } catch (Exception ignored) {} }
                    try {
                        httpPost("http://127.0.0.1:" + PORT + "/api/session/" + sid + "/interrupt", "{}");
                    } catch (Exception ignored) {}
                    try {
                        httpPost("http://127.0.0.1:" + PORT + "/session/" + sid + "/abort", "{}");
                    } catch (Exception ignored) {}
                }
            }).start();
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try { Thread.sleep(6000); } catch (InterruptedException ignored) {}
                    busy = false;
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
                if (key != null && key.trim().length() > 0) {
                    JSONObject auth = new JSONObject();
                    JSONObject ent = new JSONObject();
                    ent.put("type", "api");
                    ent.put("key", key.trim());
                    auth.put(provider.trim(), ent);
                    write(new File(dir, "auth.json"), auth.toString());
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
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
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
        return "opencode/x-preview-f-free";
    }

    private void write(File f, String s) throws Exception {
        FileWriter w = new FileWriter(f);
        w.write(s);
        w.close();
    }

    private String read(File f) throws Exception {
        BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f)));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line).append("\n");
        r.close();
        return sb.toString();
    }

    @Override
    public void onBackPressed() {
        if (busy) {
            Bridge b = new Bridge();
            b.cancel();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        running = false;
        Process p = serverProc;
        if (p != null) p.destroy();
        super.onDestroy();
    }
}
