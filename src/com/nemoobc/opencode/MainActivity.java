package com.nemoobc.opencode;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class MainActivity extends Activity {

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private Process proc;
    private volatile boolean busy = false;

    private File rootFs, workDir, cacheDir, natLib;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        rootFs = new File(getFilesDir(), "rootfs");
        workDir = new File(getFilesDir(), "work");
        cacheDir = getCacheDir();
        natLib = new File(getApplicationInfo().nativeLibraryDir);

        if (!workDir.exists()) workDir.mkdirs();
        new File(rootFs, "root/.config/opencode").mkdirs();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.setBackgroundColor(0xFF0B0F0D);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/ui/index.html");

        Thread t0 = new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ready = new File(rootFs, "usr/bin/opencode").exists()
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
                        for (String p : new String[]{"usr/bin/opencode", "usr/bin/oc"}) {
                            File f = new File(rootFs, p);
                            if (f.exists()) f.setExecutable(true, false);
                        }
                        ready = new File(rootFs, "usr/bin/opencode").exists();
                    } catch (Exception e) {
                        push("window.onError(" + jq("Ekstraksi gagal: " + e) + ")");
                        return;
                    }
                }
                long free = rootFs.getFreeSpace() / (1024 * 1024);
                final boolean ok = ready;
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        web.evaluateJavascript("window.onReady(" + ok + "," + free + ")", null);
                    }
                });
            }
        });
        t0.start();
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

    private class Bridge {

        @JavascriptInterface
        public String status() {
            JSONObject o = new JSONObject();
            try {
                o.put("ready", new File(rootFs, "usr/bin/opencode").exists());
                o.put("busy", busy);
            } catch (Exception ignored) {}
            return o.toString();
        }

        @JavascriptInterface
        public void send(String prompt) {
            if (busy) return;
            busy = true;
            Thread t = new Thread(new Runnable() {
                @Override
                public void run() {
                    int code = runOc(prompt);
                    busy = false;
                    final int c = code;
                    ui.post(new Runnable() {
                        @Override
                        public void run() {
                            web.evaluateJavascript("window.onDone(" + c + ")", null);
                        }
                    });
                }
            });
            t.start();
        }

        @JavascriptInterface
        public void cancel() {
            Process p = proc;
            if (p != null) p.destroy();
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

    private int runOc(String prompt) {
        try {
            String proot = new File(natLib, "libproot.so").getAbsolutePath();
            String loader = new File(natLib, "libproot_loader.so").getAbsolutePath();

            String[] cmd = {
                proot,
                "--kill-on-exit",
                "-0",
                "-r", rootFs.getAbsolutePath(),
                "-b", "/dev",
                "-b", "/proc",
                "-b", "/sys",
                "-b", workDir.getAbsolutePath() + ":/work",
                "-w", "/work",
                "--",
                "/usr/bin/oc", "run", prompt
            };

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            pb.environment().clear();
            pb.environment().put("LD_LIBRARY_PATH", natLib.getAbsolutePath());
            pb.environment().put("PROOT_LOADER", loader);
            pb.environment().put("PROOT_TMP_DIR", cacheDir.getAbsolutePath());
            pb.environment().put("PROOT_NO_SECCOMP", "1");
            pb.environment().put("HOME", "/root");
            pb.environment().put("TMPDIR", "/tmp");
            pb.environment().put("PATH", "/usr/bin:/bin");
            pb.environment().put("XDG_CONFIG_HOME", "/root/.config");
            pb.environment().put("NO_COLOR", "1");

            proc = pb.start();
            BufferedReader r = new BufferedReader(new InputStreamReader(proc.getInputStream()), 16384);
            StringBuilder acc = new StringBuilder();
            long lastFlush = System.currentTimeMillis();

            int ch;
            char[] cbuf = new char[4096];
            while ((ch = r.read(cbuf)) >= 0) {
                acc.append(cbuf, 0, ch);
                long now = System.currentTimeMillis();
                if (acc.length() > 3000 || now - lastFlush > 350) {
                    flushOut(acc);
                    lastFlush = now;
                }
            }
            flushOut(acc);
            return proc.waitFor();
        } catch (Exception e) {
            push("window.onError(" + jq("Error: " + e) + ")");
            return -1;
        } finally {
            Process p = proc;
            if (p != null) p.destroy();
            proc = null;
        }
    }

    private void flushOut(StringBuilder acc) {
        if (acc.length() == 0) return;
        String txt = acc.toString();
        acc.setLength(0);
        txt = txt.replaceAll("\u001B\\[[0-9;?]*[ -/]*[@-~]", "")
                 .replaceAll("\u001B\\][^\u0007]*(\u0007|\u001B\\\\)", "")
                 .replace("\r\n", "\n").replace("\r", "\n");
        final String out = txt;
        push("window.appendOut(" + JSONObject.quote(out) + ")");
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
            Process p = proc;
            if (p != null) p.destroy();
            return;
        }
        super.onBackPressed();
    }
}
