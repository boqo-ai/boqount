// tools/reference.mjs and tools/platform-copy.mjs: a reference studied, and a platform's copy measured against ours.
// The videos are made here with ffmpeg (a test that reads media skips cleanly without it). whisper-cli and yt-dlp are
// never run: study takes --no-words, and the words' parsing reads a whisper.cpp JSON written by the test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beatsTable, parseCuts, parseEbur, sentences, sheetTimes, whisperWords } from "../skills/boqount/tools/reference.mjs";
import { bestLag, mad, startCheck } from "../skills/boqount/tools/platform-copy.mjs";

const refTool = fileURLToPath(new URL("../skills/boqount/tools/reference.mjs", import.meta.url));
const copyTool = fileURLToPath(new URL("../skills/boqount/tools/platform-copy.mjs", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = (name, fn) => test(name, { skip: !hasFfmpeg && "ffmpeg is not installed" }, fn);
const ff = (...args) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args]);
const node = (...args) => spawnSync(process.execPath, args, { encoding: "utf8" });

test("whisper's words come out with times, its own notes on the sound left out", () => {
  const seg = (text, from, to) => ({ text, offsets: { from, to } });
  const words = whisperWords({ transcription: [seg(" (upbeat", 0, 300), seg(" music)", 300, 600), seg(" Why", 700, 900), seg(" not?", 900, 1200), seg(" [MUSIC]", 1200, 1500), seg(" It", 1600, 1700), seg(" works.", 1700, 2100)] });
  assert.deepEqual(words.map((w) => w.word), ["Why", "not?", "It", "works."]);
  assert.equal(words[0].start, 0.7);
  const s = sentences(words);
  assert.deepEqual(s, [{ start: 0.7, end: 1.2, text: "Why not?" }, { start: 1.6, end: 2.1, text: "It works." }]);
});

test("cut times, loudness and sheet seconds are read as ffmpeg writes them", () => {
  assert.deepEqual(parseCuts("frame:60 pts:60 pts_time:2\nlavfi.scd.time=2\nframe:105\nlavfi.scd.time=3.5\n"), [2, 3.5]);
  const ebur = "[Parsed_ebur128_0 @ x] t: 1 M: -20\n[Parsed_ebur128_0 @ x] Summary:\n\n  Integrated loudness:\n    I:         -14.2 LUFS\n  Loudness range:\n    LRA:         3.1 LU\n  True peak:\n    Peak:       -1.3 dBFS\n";
  assert.deepEqual(parseEbur(ebur), { I: -14.2, LRA: 3.1, TP: -1.3 });
  assert.deepEqual(sheetTimes(5, 0.5, 6), [[0, 0.5, 1, 1.5, 2, 2.5], [3, 3.5, 4, 4.5]]);
});

test("the beat map has one row per sentence, its nearest still named, Picture and Device left to fill", () => {
  const md = beatsTable({ name: "ref.mp4", info: { duration: 5, width: 1080, height: 1920, fps: 30 }, cuts: [2], loud: { I: -14, TP: -1 }, wps: 2.5, sents: [{ start: 0.1, end: 1.9, text: "Why not?" }, { start: 2.1, end: 4, text: "It works." }], stills: [0, 2.05] });
  assert.match(md, /1 cut \(2\.00 s\)/);
  assert.match(md, /\| 1 \| 0\.10 s–1\.90 s \| Why not\? \| still-000000\.jpg: <what it shows> \| <device> \|/);
  assert.match(md, /\| 2 \| 2\.10 s–4\.00 s \| It works\. \| still-002050\.jpg/);
});

t("study counts a video's cuts and writes its sheets, stills, spectrum and beat map", () => {
  const dir = mkdtempSync(join(tmpdir(), "reference-"));
  const file = join(dir, "ref.mp4");
  // three shots, cut at 2 s and 3.5 s, over a tone
  ff("-f", "lavfi", "-i", "testsrc2=s=180x320:r=30:d=2", "-f", "lavfi", "-i", "color=c=red:s=180x320:r=30:d=1.5", "-f", "lavfi", "-i", "mandelbrot=s=180x320:r=30", "-f", "lavfi", "-i", "sine=f=440:d=5",
    "-filter_complex", "[2:v]trim=duration=1.5,setpts=PTS-STARTPTS[m];[0:v][1:v][m]concat=n=3:v=1[v]", "-map", "[v]", "-map", "3:a", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file);
  const out = join(dir, "study");
  const r = node(refTool, "study", file, "--out", out, "--no-words");
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(join(out, "study.json"), "utf8"));
  assert.equal(s.cuts, 2);
  assert.deepEqual(s.cutTimes, [2, 3.5]);
  assert.ok(s.loudness.I < -10 && s.loudness.I > -40, String(s.loudness.I));
  for (const f of ["sheet-01.jpg", "first-last.jpg", "spectrum.png", "still-000000.jpg", "still-002050.jpg", "still-003550.jpg", "beats.md", "sheets.md"]) assert.ok(existsSync(join(out, f)), f);
  assert.deepEqual(s.missing, ["words: --no-words"]);
  const sh = node(refTool, "sheet", file, "--every", "1", "--out", join(dir, "sheets"));
  assert.equal(sh.status, 0, sh.stderr);
  assert.ok(existsSync(join(dir, "sheets", "sheet-01.jpg")));
});

test("the start check names a doubled first frame, and lets a still start pass", () => {
  const f = (v) => new Uint8Array(16).fill(v);
  const ours = [0, 10, 20, 30, 40, 50, 60, 70].map(f);
  const good = startCheck([0, 20, 40, 60].map(f), ours, 30, 60);
  assert.ok(good.every((s) => s.ok));
  const doubled = startCheck([0, 0, 20, 40].map(f), ours, 30, 60);
  assert.deepEqual(doubled.map((s) => s.ok), [true, false, false, false]);
  const still = startCheck([5, 5, 5, 5].map(f), [5, 5, 5, 5, 5, 5, 5, 5].map(f), 30, 60);
  assert.ok(still.every((s) => s.ok && s.still));
  assert.equal(mad(f(0), f(4)), 4);
});

test("the sound's lag is found to the sample", () => {
  let seed = 7;
  const a = Float32Array.from({ length: 4000 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5);
  const late = new Float32Array(4000);
  late.set(a.subarray(0, 3920), 80); // 80 samples late
  assert.equal(bestLag(a, late, 200).lag, 80);
  assert.equal(bestLag(a, a, 200).lag, 0);
});

t("platform-copy passes a faithful copy and fails a doubled start, a late sound and a padded length", () => {
  const dir = mkdtempSync(join(tmpdir(), "platform-copy-"));
  const feed = join(dir, "feed.mp4");
  ff("-f", "lavfi", "-i", "testsrc2=s=180x320:r=60:d=3", "-f", "lavfi", "-i", "anoisesrc=d=3:c=pink:a=0.3", "-c:v", "libx264", "-bf", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", feed);
  const make = (name, vf, af) => {
    const f = join(dir, `${name}.mp4`);
    ff("-i", feed, "-vf", vf, ...(af ? ["-af", af] : []), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f);
    return f;
  };
  const run = (f) => {
    const r = node(copyTool, f, "--ours", feed);
    const lines = r.stdout.split("\n").filter((l) => /^(pass|FAIL) /.test(l));
    return { status: r.status, fails: lines.filter((l) => l.startsWith("FAIL")).map((l) => l.split(/\s+/)[1].replace(":", "")) };
  };
  assert.deepEqual(run(make("good", "fps=30")), { status: 0, fails: [] });
  assert.deepEqual(run(make("doubled", "fps=30,tpad=start=1:start_mode=clone,trim=end_frame=90")), { status: 1, fails: ["start"] });
  assert.deepEqual(run(make("late", "fps=30", "adelay=40,atrim=0:3")), { status: 1, fails: ["sound"] });
  assert.deepEqual(run(make("padded", "fps=30,tpad=stop=2:stop_mode=clone")), { status: 1, fails: ["length"] });
});
