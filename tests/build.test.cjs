const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { crc32 } = require("../js/download.js");
const root = path.resolve(__dirname, "..");

test("Portable build contains complete, CRC-valid UTF-8 archive entries", () => {
  execFileSync(process.execPath, [path.join(root, "scripts/build-share.cjs")]);
  const bytes = fs.readFileSync(path.join(root, "dist/训练肌肉图谱.zip"));
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 6), 0x0800);
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const size = bytes.readUInt32LE(offset + 18);
    const length = bytes.readUInt16LE(offset + 26);
    const extra = bytes.readUInt16LE(offset + 28);
    const name = bytes
      .subarray(offset + 30, offset + 30 + length)
      .toString("utf8");
    const start = offset + 30 + length + extra;
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data), bytes.readUInt32LE(offset + 14));
    files.set(name, data);
    offset = start + size;
  }
  assert.deepEqual(
    [...files.keys()],
    ["训练肌肉图谱.html", "办公室碎片化运动方案.png"],
  );
  assert.deepEqual(
    files.get("训练肌肉图谱.html"),
    fs.readFileSync(path.join(root, "dist/训练肌肉图谱.html")),
  );
  assert.deepEqual(
    files.get("办公室碎片化运动方案.png"),
    fs.readFileSync(path.join(root, "assets/images/办公室碎片化运动方案.png")),
  );
  const html = files.get("训练肌肉图谱.html").toString("utf8");
  assert.equal(
    /<script[^>]+src=|<link[^>]+rel="stylesheet"|fetch\(|XMLHttpRequest/.test(
      html,
    ),
    false,
  );
  assert.equal((html.match(/data:image\/png;base64,/g) || []).length, 3);
  assert.ok(html.includes("设计人：Stanley"));
  assert.ok(html.includes("shareableSource"));
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
  assert.equal(bytes.readUInt16LE(bytes.length - 12), 2);
});
