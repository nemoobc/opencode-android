#!/usr/bin/env python3
# zipalign mini: resources.arsc + .so disimpan uncompressed + align 4-byte (wajib Android R+)
import zipfile, struct, zlib, sys, os

if len(sys.argv) < 3:
    print("usage: align.py <input.apk> <output.apk>"); sys.exit(1)
src, dst = sys.argv[1], sys.argv[2]
if not os.path.exists(src):
    print("error: input not found:", src); sys.exit(1)

zin = zipfile.ZipFile(src)
items = zin.infolist()
out = open(dst, 'wb')
offset = 0
central = []
try:
    for item in items:
        data = zin.read(item.filename)
        name = item.filename.encode('utf-8')
        # .arsc DAN .so harus stored uncompressed (wajib Android)
        stored = item.filename.endswith('.arsc') or item.filename.endswith('.so')
        if stored:
            method, cdata = 0, data
        else:
            method = 8
            co = zlib.compressobj(1, zlib.DEFLATED, -15)  # level 1 = faster build
            cdata = co.compress(data) + co.flush()
        crc = zlib.crc32(data) & 0xffffffff
        hdr = 30 + len(name)
        pad = (4 - ((offset + hdr) % 4)) % 4
        extra = b'\x00' * pad
        out.write(struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, 0, method, 0, 0, crc, len(cdata), len(data), len(name), len(extra)))
        out.write(name); out.write(extra); out.write(cdata)
        central.append((name, crc, len(cdata), len(data), offset, method))
        offset += hdr + pad + len(cdata)
    cd_start = offset
    for (name, crc, csz, usz, off, method) in central:
        out.write(struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, 0, method, 0, 0, crc, csz, usz, len(name), 0, 0, 0, 0, 0, off))
        out.write(name)
    cd_size = out.tell() - cd_start
    out.write(struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, len(central), len(central), cd_size, cd_start, 0))
finally:
    out.close()
    zin.close()
print('aligned:', dst, os.path.getsize(dst), 'byte')
