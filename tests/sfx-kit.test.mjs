// The synthesized sound kit: sixteen small WAV files, the same bytes every run, none clipped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../skills/boqount/tools/sfx-kit.mjs";

const cli = fileURLToPath(new URL("../skills/boqount/tools/sfx-kit.mjs", import.meta.url));

const NAMES = ["pop", "pop_hi", "tick", "tap", "blip", "ding", "whoosh", "whoosh_big", "rise", "drop", "stamp", "typing", "sparkle", "error", "lock", "toggle"];
// Duration ranges in milliseconds, by what the name implies.
const RANGE = {
  pop: [30, 150], pop_hi: [30, 150], tick: [10, 150], tap: [10, 150], blip: [30, 150], toggle: [20, 150],
  ding: [400, 1500], whoosh: [250, 700], whoosh_big: [250, 700], rise: [600, 1500], drop: [300, 900],
  stamp: [100, 400], typing: [300, 900], sparkle: [300, 1000], error: [200, 600], lock: [100, 400],
};

/** Runs the tool against an in-memory folder: { files: Map(name → Buffer), result }. */
async function generate(argv = ["--out", "/kit"]) {
  const files = new Map();
  const deps = { mkdir: async () => {}, writeFile: async (path, data) => files.set(path.split("/").pop(), Buffer.from(data)) };
  const result = await run(argv, deps);
  return { files, result };
}
const samples = (buf) => new Int16Array(buf.buffer.slice(buf.byteOffset + 44, buf.byteOffset + buf.length));

test("every name is written, and the result lists them", async () => {
  const { files, result } = await generate();
  assert.equal(result.code, 0);
  assert.deepEqual([...files.keys()].sort(), NAMES.map((n) => `${n}.wav`).sort());
  const out = JSON.parse(result.line);
  assert.equal(out.out, "/kit");
  assert.deepEqual([...out.files].sort(), NAMES.map((n) => `${n}.wav`).sort());
});

test("each file has a valid 44-byte RIFF header for mono 48 kHz 16-bit", async () => {
  const { files } = await generate();
  for (const [name, buf] of files) {
    assert.equal(buf.toString("ascii", 0, 4), "RIFF", name);
    assert.equal(buf.readUInt32LE(4), buf.length - 8, `${name}: RIFF size`);
    assert.equal(buf.toString("ascii", 8, 16), "WAVEfmt ", name);
    assert.equal(buf.readUInt32LE(16), 16, name);
    assert.equal(buf.readUInt16LE(20), 1, `${name}: PCM`);
    assert.equal(buf.readUInt16LE(22), 1, `${name}: mono`);
    assert.equal(buf.readUInt32LE(24), 48000, `${name}: rate`);
    assert.equal(buf.readUInt32LE(28), 96000, `${name}: byte rate`);
    assert.equal(buf.readUInt16LE(32), 2, `${name}: block align`);
    assert.equal(buf.readUInt16LE(34), 16, `${name}: bits`);
    assert.equal(buf.toString("ascii", 36, 40), "data", name);
    assert.equal(buf.readUInt32LE(40), buf.length - 44, `${name}: data size`);
  }
});

test("durations are in the range the name implies", async () => {
  const { files } = await generate();
  for (const name of NAMES) {
    const ms = (samples(files.get(`${name}.wav`)).length / 48000) * 1000;
    const [lo, hi] = RANGE[name];
    assert.ok(ms >= lo && ms <= hi, `${name} lasts ${ms.toFixed(0)} ms, expected ${lo}-${hi}`);
  }
});

test("two runs give identical bytes", async () => {
  const a = await generate();
  const b = await generate();
  for (const name of NAMES) assert.ok(a.files.get(`${name}.wav`).equals(b.files.get(`${name}.wav`)), name);
});

test("no sample clips, every sound is audible, and none is a copy of another", async () => {
  const { files } = await generate();
  const seen = new Set();
  for (const name of NAMES) {
    const buf = files.get(`${name}.wav`);
    const s = samples(buf);
    let peak = 0;
    let sum = 0;
    for (const v of s) {
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
    assert.ok(peak <= 0.98 * 32767, `${name} peaks at ${peak}`);
    assert.ok(peak >= 0.25 * 32767, `${name} is too quiet: peak ${peak}`);
    assert.ok(Math.sqrt(sum / s.length) / 32768 > 0.01, `${name} is nearly silent`);
    seen.add(buf.toString("base64"));
  }
  assert.equal(seen.size, NAMES.length);
});

test("each sound starts and ends at silence, so it never clicks", async () => {
  const { files } = await generate();
  for (const name of NAMES) {
    const s = samples(files.get(`${name}.wav`));
    assert.ok(Math.abs(s[0]) <= 64, `${name} starts at ${s[0]}`);
    assert.ok(Math.abs(s.at(-1)) <= 64, `${name} ends at ${s.at(-1)}`);
  }
});

test("--out is required, and a stray argument is an error", async () => {
  for (const argv of [[], ["--out"], ["--out", "/kit", "extra"], ["--nope", "x"]]) {
    const { result } = await generate(argv);
    assert.equal(result.code, 1, JSON.stringify(argv));
    assert.ok(JSON.parse(result.line).error, JSON.stringify(argv));
  }
});

test("the CLI writes the files into a new folder and prints one JSON line", () => {
  const out = join(mkdtempSync(join(tmpdir(), "boqount-kit-")), "nested", "sfx");
  const line = execFileSync("node", [cli, "--out", out], { encoding: "utf8" });
  assert.equal(line.trim().split("\n").length, 1);
  assert.equal(JSON.parse(line).files.length, 16);
  assert.deepEqual(readdirSync(out).sort(), NAMES.map((n) => `${n}.wav`).sort());
  assert.equal(readFileSync(join(out, "pop.wav")).toString("ascii", 0, 4), "RIFF");
});
