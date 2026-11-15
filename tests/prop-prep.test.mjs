// tools/prop-prep.mjs: a cut-out prop trimmed to what it shows, and a device's green screen keyed into a recorded hole.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepare } from "../skills/boqount/tools/prop-prep.mjs";

const cli = fileURLToPath(new URL("../skills/boqount/tools/prop-prep.mjs", import.meta.url));

/** A 40 × 30 image: transparent, with an opaque grey device at x 10–29, y 5–24 whose screen x 14–25, y 9–20 is green. */
function device() {
  const w = 40, h = 30, px = Buffer.alloc(w * h * 4);
  for (let y = 5; y < 25; y++)
    for (let x = 10; x < 30; x++) {
      const i = (y * w + x) * 4;
      const screen = x >= 14 && x < 26 && y >= 9 && y < 21;
      px.set(screen ? [0, 255, 0, 255] : [90, 120, 90, 255], i);
    }
  return { px, w, h };
}

test("a prop is trimmed to its opaque pixels plus the pad", () => {
  const { px, w, h } = device();
  const p = prepare(px, w, h, { pad: 2 });
  assert.deepEqual([p.w, p.h, p.screen], [24, 24, null]);
});

test("--screen keys the green into a hole, records its rectangle and takes the spill out of the edge", () => {
  const { px, w, h } = device();
  const p = prepare(px, w, h, { screen: true, pad: 0 });
  assert.deepEqual([p.w, p.h], [20, 20]);
  assert.deepEqual(p.screen, [4, 4, 16, 16]);
  const at = (x, y) => [...p.data.subarray((y * p.w + x) * 4, (y * p.w + x) * 4 + 4)];
  assert.equal(at(8, 8)[3], 0, "the screen is a hole");
  assert.deepEqual(at(1, 1), [90, 90, 90, 255], "the bezel's green tint is taken out");
});

test("no green with --screen, or nothing opaque, is an error that says what to do", () => {
  const w = 4, h = 4;
  assert.throws(() => prepare(Buffer.alloc(w * h * 4), w, h), /fully transparent/);
  const grey = Buffer.alloc(w * h * 4, 200);
  assert.throws(() => prepare(grey, w, h, { screen: true }), /flat #00FF00/);
});

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
test("the CLI writes the PNG and the prop's props.json entry", { skip: !ffmpeg && "ffmpeg is not installed" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "boqount-prop-"));
  const src = join(dir, "phone-cut.png");
  const { px, w, h } = device();
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-i", "-", "-frames:v", "1", src], { input: px });
  const r = spawnSync("node", [cli, src, join(dir, "props"), "--name", "phone", "--screen", "--pad", "0"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, "props/phone.png")));
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "props/props.json"), "utf8")), { phone: { w: 20, h: 20, screen: [4, 4, 16, 16] } });
});
