// tools/footage-120.mjs and the film project's sync serving its copies. The clips are made with ffmpeg; the tests use
// ffmpeg's interpolation (--fast), so they never need RIFE. Needs ffmpeg; each test skips cleanly without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { footage120, stale } from "../skills/boqount/tools/footage-120.mjs";

const tool = fileURLToPath(new URL("../skills/boqount/tools/footage-120.mjs", import.meta.url));
const project = fileURLToPath(new URL("../skills/boqount/films/project/", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = (name, fn) => test(name, { skip: !hasFfmpeg && "ffmpeg is not installed" }, fn);
const ff = (...args) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args]);
const probe = (file, entries, stream = "v:0") => execFileSync("ffprobe", ["-v", "error", "-select_streams", stream, "-count_frames", "-show_entries", entries, "-of", "csv=p=0", file]).toString().trim();

/** One second of a moving test pattern, a hard cut, one second of a moving colour field; 30 fps, with a tone. */
function clip(file) {
  ff("-f", "lavfi", "-i", "testsrc2=size=160x284:rate=30:duration=1", "-f", "lavfi", "-i", "mandelbrot=size=160x284:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-filter_complex", "[1:v]trim=duration=1,setpts=PTS-STARTPTS[b];[0:v][b]concat=n=2:v=1[v]", "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file);
}

t("one clip: each shot interpolated on its own to 120 fps, the same length, its sound kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "f120-"));
  clip(join(dir, "in.mp4"));
  const r = footage120(join(dir, "in.mp4"), join(dir, "out.mp4"), { fast: true });
  assert.equal(r.frames, 60);
  assert.equal(r.shots, 2, "the cut is found, so no frame blends the two shots");
  assert.equal(r.out, 240);
  assert.equal(r.fps, 120);
  assert.match(r.by, /minterpolate/);
  assert.equal(probe(join(dir, "out.mp4"), "stream=r_frame_rate"), "120/1");
  assert.equal(Number(probe(join(dir, "out.mp4"), "stream=nb_read_frames")), 240);
  assert.equal(probe(join(dir, "out.mp4"), "stream=codec_name", "a:0"), "aac", "the clip's own sound is kept");
  // a clip already at 120 is copied as it is
  const again = footage120(join(dir, "out.mp4"), join(dir, "copy.mp4"));
  assert.match(again.by, /copied/);
});

t("the folder form makes media-120/ for each clip that has no fresh copy; sync serves it and names the rest", () => {
  const acct = mkdtempSync(join(tmpdir(), "f120-acct-"));
  const films = join(acct, "films");
  mkdirSync(join(films, "demo/media/shots"), { recursive: true });
  clip(join(films, "demo/media/shots/pour.mp4"));
  clip(join(films, "demo/media/stir.mp4"));
  writeFileSync(join(films, "demo/media/pot.jpg"), "not a clip");
  assert.deepEqual(stale(join(films, "demo")), ["shots/pour.mp4", "stir.mp4"]);

  // the project's sync, in a copy of the project placed in this account
  cpSync(project, join(films, "project"), { recursive: true, filter: (p) => !/node_modules|\/public(\/|$)/.test(p) });
  const sync = () => spawnSync(process.execPath, [join(films, "project/scripts/sync-assets.mjs")], { encoding: "utf8" });
  let s = sync();
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /footage: 2 clips play at their own frame rate and step beside the motion \(media\/demo\/shots\/pour\.mp4, media\/demo\/stir\.mp4\)/);

  const r = spawnSync(process.execPath, [tool, join(films, "demo"), "--fast"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /shots\/pour\.mp4: 60 frames in 2 shots → 240 at 120 fps/);
  assert.deepEqual(stale(join(films, "demo")), []);
  assert.match(spawnSync(process.execPath, [tool, join(films, "demo")], { encoding: "utf8" }).stdout, /every clip has its 120 copy/);

  s = sync();
  assert.equal(s.status, 0, s.stderr);
  assert.doesNotMatch(s.stdout, /footage:/);
  const served = join(films, "project/public/media/demo/stir.mp4");
  assert.equal(probe(served, "stream=r_frame_rate"), "120/1", "the 120 copy is what the film plays");
  assert.equal(readFileSync(join(films, "project/public/media/demo/pot.jpg"), "utf8"), "not a clip");

  // a clip changed after its copy steps again until the copy is made again
  const later = new Date(Date.now() + 60_000);
  utimesSync(join(films, "demo/media/stir.mp4"), later, later);
  assert.deepEqual(stale(join(films, "demo")), ["stir.mp4"]);
  assert.match(sync().stdout, /footage: 1 clip plays at its own frame rate and steps beside the motion \(media\/demo\/stir\.mp4\)/);
});

test("wrong use exits 2 with the usage", () => {
  const r = spawnSync(process.execPath, [tool], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: footage-120\.mjs/);
});
