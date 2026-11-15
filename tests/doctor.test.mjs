// tools/doctor.mjs: what the machine has, looked at and never changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tool = fileURLToPath(new URL("../skills/boqount/tools/doctor.mjs", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

test("--json names every tool once, with whether the skill needs it", () => {
  const r = spawnSync(process.execPath, [tool, "--json"], { encoding: "utf8" });
  const list = JSON.parse(r.stdout);
  const names = list.map((c) => c.name);
  for (const n of ["node", "ffmpeg", "ffprobe", "git", "gh", "whisper-cli", "RIFE", "age", "@huggingface/transformers"]) assert.ok(names.includes(n), n);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(list.filter((c) => c.need).map((c) => c.name).sort(), ["ffmpeg", "ffprobe", "git", "node"]);
  for (const c of list) for (const k of ["for", "install", "detail"]) assert.equal(typeof c[k], "string", `${c.name}.${k}`);
});

test("with no ffmpeg on the PATH, it says ffmpeg is missing, how to get it, and exits 1", () => {
  // a PATH that holds only node
  const bin = mkdtempSync(join(tmpdir(), "doctor-"));
  symlinkSync(process.execPath, join(bin, "node"));
  const r = spawnSync(join(bin, "node"), [tool], { encoding: "utf8", env: { PATH: bin, HOME: bin } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^missing\s+ffmpeg\s+not found\n\s+for: films, sound, stills, every measurement; install: /m);
  assert.match(r.stdout, /needed tools are missing: ffmpeg, ffprobe, git/);
});

test("on a machine with ffmpeg and git, it exits 0", { skip: !hasFfmpeg && "ffmpeg is not installed" }, () => {
  const r = spawnSync(process.execPath, [tool], { encoding: "utf8", env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}` } });
  assert.match(r.stdout, /^ok\s+ffmpeg/m);
  if (spawnSync("git", ["--version"]).status === 0) assert.equal(r.status, 0, r.stdout);
});
