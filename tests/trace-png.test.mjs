// tools/trace-png.mjs: PNGs written here (no image files in the repository), traced, and the path read back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { decodePng, run, trace } from "../skills/boqount/tools/trace-png.mjs";

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
/** A PNG of w × h, colour type 6 (RGBA) or 2 (RGB), each row filtered with `filter`; px(x, y) → [r, g, b, a]. */
function png(w, h, px, { color = 6, filter = 0 } = {}) {
  const ch = color === 6 ? 4 : 3;
  const rows = [];
  let prev = Buffer.alloc(w * ch);
  for (let y = 0; y < h; y++) {
    const line = Buffer.alloc(w * ch);
    for (let x = 0; x < w; x++) px(x, y).slice(0, ch).forEach((v, c) => (line[x * ch + c] = v));
    const out = Buffer.alloc(w * ch);
    for (let i = 0; i < line.length; i++) out[i] = filter === 2 ? (line[i] - prev[i]) & 255 : line[i];
    rows.push(Buffer.from([filter]), out);
    prev = line;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = color;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

// a ring: a square with a square hole, on transparency
const ring = (x, y) => (x >= 2 && x < 14 && y >= 2 && y < 14 && !(x >= 6 && x < 10 && y >= 6 && y < 10) ? [200, 40, 40, 255] : [0, 0, 0, 0]);

test("decodes RGBA and RGB, with the Up filter", () => {
  const a = decodePng(png(16, 16, ring, { filter: 2 }));
  assert.equal(a.width, 16);
  assert.equal(a.alpha, true);
  assert.deepEqual([...a.rgba.subarray((3 * 16 + 3) * 4, (3 * 16 + 3) * 4 + 4)], [200, 40, 40, 255]);
  const b = decodePng(png(8, 4, (x) => (x < 4 ? [255, 255, 255, 255] : [10, 20, 30, 255]), { color: 2 }));
  assert.equal(b.alpha, false);
  assert.deepEqual([...b.rgba.subarray(5 * 4, 5 * 4 + 4)], [10, 20, 30, 255]);
});

test("a square with a hole is two outlines of four corners, the hole kept", () => {
  const t = trace(decodePng(png(16, 16, ring)));
  assert.equal(t.contours, 2);
  assert.equal(t.points, 8);
  assert.match(t.d, /^M[\d. L]+ZM[\d. L]+Z$/);
  for (const corner of ["2 2", "14 2", "14 14", "2 14", "6 6", "10 10"]) assert.ok(t.d.includes(corner), `${corner} in ${t.d}`);
});

test("with no transparency the mark is what differs from the corners' colour", () => {
  const disc = (x, y) => (Math.hypot(x - 20, y - 20) < 12 ? [20, 20, 20, 255] : [250, 250, 250, 255]);
  const t = trace(decodePng(png(40, 40, disc, { color: 2 })));
  assert.equal(t.contours, 1);
  assert.ok(t.points > 8 && t.points < 80, `a circle is simplified, got ${t.points} points`);
});

test("the command writes the SVG and the film's JSON, and refuses an empty image", () => {
  const dir = mkdtempSync(join(tmpdir(), "trace-"));
  writeFileSync(join(dir, "logo.png"), png(16, 16, ring));
  const r = run(["logo.png", "--out", "mark.svg", "--json", "mark.json"], dir);
  assert.equal(r.code, 0, r.line);
  const svg = readFileSync(join(dir, "mark.svg"), "utf8");
  assert.match(svg, /viewBox="0 0 16 16"/);
  assert.match(svg, /fill-rule="evenodd"/);
  const json = JSON.parse(readFileSync(join(dir, "mark.json"), "utf8"));
  assert.equal(json.width, 16);
  assert.ok(json.d.startsWith("M"));
  writeFileSync(join(dir, "empty.png"), png(4, 4, () => [0, 0, 0, 0]));
  const e = run(["empty.png"], dir);
  assert.equal(e.code, 1);
  assert.match(JSON.parse(e.line).error, /nothing to trace/);
  assert.equal(run(["nope.png"], dir).code, 1);
  assert.equal(existsSync(join(dir, "nope.svg")), false);
});
