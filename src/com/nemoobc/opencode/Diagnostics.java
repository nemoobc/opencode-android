package com.nemoobc.opencode;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

public final class Diagnostics {

    private static final Object LOCK = new Object();
    private static final Map<String, byte[]> SHOTS = new LinkedHashMap<>();
    private static JSONArray STEPS = new JSONArray();
    private static JSONObject EXTRA = new JSONObject();
    private static long t0 = System.currentTimeMillis();

    private Diagnostics() {}

    public static void reset() {
        synchronized (LOCK) {
            SHOTS.clear();
            STEPS = new JSONArray();
            EXTRA = new JSONObject();
            t0 = System.currentTimeMillis();
        }
    }

    public static void step(String nama, String detail) {
        long ms = System.currentTimeMillis() - t0;
        synchronized (LOCK) {
            JSONObject o = new JSONObject();
            try {
                o.put("step", nama);
                o.put("detail", detail);
                o.put("ms", ms);
                STEPS.put(o);
            } catch (Exception ignored) {}
        }
    }

    public static void shot(String nama, byte[] png) {
        synchronized (LOCK) { SHOTS.put(nama, png); }
        step("screenshot:" + nama, png.length + " byte");
    }

    public static void extra(String k, String v) {
        synchronized (LOCK) { try { EXTRA.put(k, v); } catch (Exception ignored) {} }
    }

    public static void startServer(final int port) {
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                ServerSocket ss = null;
                try {
                    ss = new ServerSocket(port);
                    while (true) {
                        final Socket s = ss.accept();
                        new Thread(new Runnable() {
                            @Override
                            public void run() { handle(s); }
                        }).start();
                    }
                } catch (IOException ignored) {
                } finally {
                    if (ss != null) try { ss.close(); } catch (IOException ignored) {}
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    private static void handle(Socket s) {
        try {
            InputStream in = s.getInputStream();
            StringBuilder req = new StringBuilder();
            int c;
            while ((c = in.read()) != -1 && c != '\n') req.append((char) c);
            String path = "/";
            String line = req.toString();
            if (line.startsWith("GET ")) {
                String[] parts = line.split(" ");
                if (parts.length >= 2) path = parts[1];
            }
            s.getInputStream().read(new byte[4096]);

            if (path.startsWith("/shot/")) {
                String nama = path.substring("/shot/".length());
                byte[] png;
                synchronized (LOCK) { png = SHOTS.get(nama); }
                if (png != null) {
                    respond(s, 200, "image/png", png);
                } else {
                    respond(s, 404, "text/plain", "tidak ada".getBytes());
                }
            } else {
                JSONObject out;
                synchronized (LOCK) {
                    out = new JSONObject();
                    out.put("steps", STEPS);
                    out.put("extra", EXTRA);
                    java.util.List<String> names = new java.util.ArrayList<>(SHOTS.keySet());
                    out.put("shots", new JSONArray(names));
                    out.put("uptime_ms", System.currentTimeMillis() - t0);
                }
                respond(s, 200, "application/json", out.toString().getBytes());
            }
            s.close();
        } catch (Exception ignored) {
            try { s.close(); } catch (Exception ignored2) {}
        }
    }

    private static void respond(Socket s, int code, String type, byte[] body) throws IOException {
        String head = "HTTP/1.1 " + code + " OK\r\n"
                + "Content-Type: " + type + "\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Connection: close\r\n\r\n";
        OutputStream os = s.getOutputStream();
        os.write(head.getBytes());
        os.write(body);
        os.flush();
    }
}
