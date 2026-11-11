// ZIP (UTF-8 filenames, STORE method). No network request or third-party dependency.
(function (root) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const encoder = new TextEncoder(),
      parts = [],
      directory = [];
    let offset = 0,
      size = 0;
    const now = new Date(),
      time =
        (now.getHours() << 11) |
        (now.getMinutes() << 5) |
        (now.getSeconds() >> 1),
      date =
        ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
        ((now.getMonth() + 1) << 5) |
        now.getDate();
    for (const file of files) {
      const name = encoder.encode(file.name),
        data =
          typeof file.data === "string" ? encoder.encode(file.data) : file.data,
        crc = crc32(data);
      const h = new Uint8Array(30 + name.length),
        v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x0800, true);
      v.setUint16(10, time, true);
      v.setUint16(12, date, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true);
      v.setUint16(26, name.length, true);
      h.set(name, 30);
      parts.push(h, data);
      const c = new Uint8Array(46 + name.length),
        w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true);
      w.setUint16(4, 20, true);
      w.setUint16(6, 20, true);
      w.setUint16(8, 0x0800, true);
      w.setUint16(12, time, true);
      w.setUint16(14, date, true);
      w.setUint32(16, crc, true);
      w.setUint32(20, data.length, true);
      w.setUint32(24, data.length, true);
      w.setUint16(28, name.length, true);
      w.setUint32(42, offset, true);
      c.set(name, 46);
      directory.push(c);
      size += c.length;
      offset += h.length + data.length;
    }
    const end = new Uint8Array(22),
      v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, files.length, true);
    v.setUint16(10, files.length, true);
    v.setUint32(12, size, true);
    v.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, end], { type: "application/zip" });
  }
  root.AtlasDownload = { zip, crc32 };
  if (typeof module !== "undefined") module.exports = root.AtlasDownload;
})(typeof globalThis !== "undefined" ? globalThis : this);
