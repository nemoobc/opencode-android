package com.nemoobc.opencode;

import android.system.Os;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.zip.GZIPInputStream;

public final class TarExtractor {

    public interface Progress {
        void onEntry(int count);
        default void onBytes(long total) {}
    }

    public static void extractGz(InputStream raw, File dest, Progress p) throws IOException {
        // Auto-detect format payload: kalau tar POLOS (bukan gzip), jangan dibungkus
        // GZIPInputStream — itu bikin macet karena deflate tak pernah selesai. Magic gzip = 1f 8b.
        java.io.PushbackInputStream pb = new java.io.PushbackInputStream(raw, 512);
        int a = pb.read();
        int b = pb.read();
        pb.unread(new byte[]{(byte) a, (byte) b}, 0, 2);
        boolean gz = a == 0x1f && (b & 0xff) == 0x8b;
        extract(gz ? new GZIPInputStream(pb, 65536) : pb, dest, p);
    }

    public static void extract(InputStream in, File dest, Progress p) throws IOException {
        byte[] head = new byte[512];
        byte[] buf = new byte[65536];
        String longName = null;
        int count = 0;
        long bytesWritten = 0;
        long bytesReported = 0;

        while (true) {
            int got = readFull(in, head, 0, 512);
            if (got < 512) break;
            if (isZero(head)) continue;

            String name = longName != null ? longName : str(head, 0, 100);
            String prefix = str(head, 345, 155);
            if (prefix.length() > 0 && longName == null) name = prefix + "/" + name;
            longName = null;

            long size = oct(head, 124, 12);
            int mode = (int) oct(head, 100, 8);
            char type = (char) (head[156] == 0 ? '0' : head[156]);

            if (type == 'L') {
                byte[] nb = new byte[(int) size];
                readFull(in, nb, 0, nb.length);
                skipPad(in, size);
                String ln = new String(nb, 0, nb.length - 1).trim();
                longName = ln;
                count++;
                if (p != null) p.onEntry(count);
                continue;
            }
            if (type == 'x' || type == 'g' || type == 'K' || type == 'X') {
                skip(in, size);
                continue;
            }

            File out = new File(dest, name);
            if (name.contains("../") || name.startsWith("/") || !out.getCanonicalPath().startsWith(dest.getCanonicalPath())) continue;

            try {
                switch (type) {
                    case '5':
                        out.mkdirs();
                        break;
                    case '2': {
                        String link = str(head, 157, 100);
                        if (out.exists() || out.getCanonicalPath().equals(dest.getAbsolutePath()))
                            out.delete();
                        File parent = out.getParentFile();
                        if (parent != null) parent.mkdirs();
                        try { Os.symlink(link, out.getAbsolutePath()); }
                        catch (Exception e) {
                            if (link.startsWith("/") || link.contains("..")) {
                                copyTree(new File(dest, trimLead(link)), out);
                            } else {
                                copyTree(new File(out.getParentFile(), link), out);
                            }
                        }
                        break;
                    }
                    case '1': {
                        String link = str(head, 157, 100);
                        File src = new File(dest, trimLead(link));
                        if (out.exists()) out.delete();
                        File parent = out.getParentFile();
                        if (parent != null) parent.mkdirs();
                        try { Os.link(src.getAbsolutePath(), out.getAbsolutePath()); }
                        catch (Exception e) { copyTree(src, out); }
                        break;
                    }
                    default: {
                        File parent = out.getParentFile();
                        if (parent != null) parent.mkdirs();
                        if (out.isDirectory()) break;
                        try (java.io.FileOutputStream fo = new java.io.FileOutputStream(out)) {
                            long left = size;
                            while (left > 0) {
                                int chunk = (int) Math.min(buf.length, left);
                                int r = in.read(buf, 0, chunk);
                                if (r < 0) throw new IOException("EOF di tengah file " + name);
                                fo.write(buf, 0, r);
                                left -= r;
                                bytesWritten += r;
                                if (p != null && bytesWritten - bytesReported >= 262144) {
                                    bytesReported = bytesWritten;
                                    p.onBytes(bytesWritten);
                                }
                            }
                        }
                        skipPad(in, size);
                        applyMode(out, mode);
                        break;
                    }
                }
            } catch (Exception e) {
                // lanjut entry berikutnya; file bermasalah tidak fatal
            }

            count++;
            if (p != null) p.onEntry(count);
        }
        in.close();
    }

    private static String trimLead(String s) {
        while (s.startsWith("/")) s = s.substring(1);
        return s;
    }

    private static void copyTree(File src, File dst) throws IOException {
        if (!src.exists()) return;
        if (src.isDirectory()) {
            dst.mkdirs();
            File[] kids = src.listFiles();
            if (kids != null) for (File k : kids) {
                if (k.getCanonicalPath().equals(dst.getCanonicalPath())) continue;
                copyTree(k, new File(dst, k.getName()));
            }
        } else {
            dst.getParentFile().mkdirs();
            try (java.io.FileInputStream fi = new java.io.FileInputStream(src);
                 java.io.FileOutputStream fo = new java.io.FileOutputStream(dst)) {
                byte[] b = new byte[65536];
                int r;
                while ((r = fi.read(b)) > 0) fo.write(b, 0, r);
            }
            applyMode(dst, src.canExecute() ? 0755 : 0644);
        }
    }

    private static void applyMode(File f, int mode) {
        f.setReadable(true, false);
        f.setWritable((mode & 0200) != 0, false);
        f.setExecutable((mode & 0100) != 0, false);
    }

    private static int readFull(InputStream in, byte[] b, int off, int len) throws IOException {
        int done = 0;
        while (done < len) {
            int r = in.read(b, off + done, len - done);
            if (r < 0) return done > 0 ? done : -1;
            done += r;
        }
        return done;
    }

    private static void skipPad(InputStream in, long size) throws IOException {
        long pad = (512 - (size % 512)) % 512;
        while (pad > 0) {
            long s = in.skip(pad);
            if (s <= 0) { if (in.read() < 0) break; s = 1; }
            pad -= s;
        }
    }

    private static void skip(InputStream in, long size) throws IOException {
        long left = size + ((512 - (size % 512)) % 512);
        while (left > 0) {
            long s = in.skip(left);
            if (s <= 0) { if (in.read() < 0) break; s = 1; }
            left -= s;
        }
    }

    private static boolean isZero(byte[] b) {
        for (byte x : b) if (x != 0) return false;
        return true;
    }

    private static String str(byte[] b, int off, int len) {
        int end = off;
        int max = off + len;
        while (end < max && b[end] != 0) end++;
        return new String(b, off, end - off).trim();
    }

    private static long oct(byte[] b, int off, int len) {
        long v = 0;
        boolean started = false;
        for (int i = off; i < off + len; i++) {
            byte c = b[i];
            if (c == 0 || c == ' ') {
                if (started) break;
                continue;
            }
            if (c < '0' || c > '7') break;
            started = true;
            v = (v << 3) + (c - '0');
        }
        return v;
    }
}
