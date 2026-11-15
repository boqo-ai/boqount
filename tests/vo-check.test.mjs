// tools/vo-check.mjs: the voice measured where nobody hears it. The takes are tones made with ffmpeg, so the times
// are known. Needs ffmpeg; each test that reads audio skips cleanly without it. whisper-cli is never run here: `words`
// reads a whisper.cpp JSON file written by the test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { diffWords, dtwWords, normalise, saidTimes, scriptText, spell } from "../skills/boqount/tools/vo-check.mjs";

const tool = fileURLToPath(new URL("../skills/boqount/tools/vo-check.mjs", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = (name, fn) => test(name, { skip: !hasFfmpeg && "ffmpeg is not installed" }, fn);
const ff = (...args) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args]);
const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: "utf8" });
/** A tone sounding over each [a, b] span, `d` seconds long. */
const tone = (file, spans, d) => ff("-f", "lavfi", "-i", `aevalsrc='0.5*sin(2*PI*220*t)*(${spans.map(([a, b]) => `between(t,${a},${b})`).join("+")})':s=48000:d=${d}`, "-ac", "1", file);

function take() {
  const dir = mkdtempSync(join(tmpdir(), "vo-check-"));
  const lines = join(dir, "lines");
  mkdirSync(lines);
  // three words heard at 0.10, 0.65 and 1.20 s; a 50 ms burst at 1.85 s after a 250 ms gap
  tone(join(lines, "hook.mp3"), [[0.1, 0.5], [0.65, 1.0], [1.2, 1.6], [1.85, 1.9]], 2.4);
  // the alignment runs late on the later words, and the last word "ends" at the file's end
  const aligned = [{ word: "one", start: 0.1, end: 0.5 }, { word: "two", start: 0.85, end: 1.05 }, { word: "three.", start: 1.45, end: 2.4 }];
  writeFileSync(join(lines, "hook.words.json"), JSON.stringify(aligned));
  writeFileSync(join(dir, "vo-plan.json"), JSON.stringify({ voice: "x", lead: 0.4, lines: [{ id: "hook", text: "One, two, three.", gap: 0.3 }] }));
  return { dir, lines, plan: join(dir, "vo-plan.json"), aligned };
}

t("onsets proposes where each later word is heard and where the voice ends, burst aside; fix writes them and keeps the original", () => {
  const { lines, plan, aligned } = take();
  const r = run("onsets", plan, lines);
  assert.equal(r.status, 0, r.stderr);
  const { lines: table } = JSON.parse(readFileSync(join(lines, "onsets.json"), "utf8"));
  const [[k1, w1, h1], [k2, w2, h2]] = table.hook.words;
  assert.deepEqual([k1, w1, k2, w2], [1, "two", 2, "three."]);
  assert.deepEqual(table.hook.words.map((w) => w[4]), ["silence", "silence"]);
  assert.ok(Math.abs(h1 - 0.65) < 0.03, `two heard at ${h1}`);
  assert.ok(Math.abs(h2 - 1.2) < 0.03, `three heard at ${h2}`);
  assert.ok(Math.abs(table.hook.end[2] - 1.6) < 0.03, `voice ends at ${table.hook.end[2]}`);

  const f = run("fix", plan, lines);
  assert.equal(f.status, 0, f.stderr);
  const fixed = JSON.parse(readFileSync(join(lines, "hook.words.json"), "utf8"));
  assert.equal(fixed[0].start, 0.1, "the first word is never moved");
  assert.ok(fixed[1].start < 0.7 && fixed[2].start < 1.25);
  assert.ok(fixed[0].end <= fixed[1].start, "a word ends before the next starts");
  assert.ok(fixed[2].end < 1.65);
  assert.deepEqual(JSON.parse(readFileSync(join(lines, "aligned/hook.words.json"), "utf8")), aligned);
  // run again: it starts from the kept original, so the result is the same
  assert.equal(run("onsets", plan, lines).status, 0);
  assert.equal(run("fix", plan, lines).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(lines, "hook.words.json"), "utf8")), fixed);
});

t("tails flags a short burst after a gap and exits 1; a clean take passes", () => {
  const { lines } = take();
  const r = run("tails", lines);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /hook: .*BURST at 1\.8\d+ s .*re-take this line/);
  tone(join(lines, "hook.mp3"), [[0.1, 0.5], [0.65, 1.0], [1.2, 1.6]], 2.4);
  const ok = run("tails", lines, "hook");
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /ok$/m);
});

t("said: a word has been said where the voice falls silent after it, or where the next word starts", () => {
  const dir = mkdtempSync(join(tmpdir(), "vo-said-"));
  tone(join(dir, "vo.wav"), [[0.5, 1.0], [1.0, 1.4], [2.0, 2.5]], 3.0);
  const cues = { duration: 3, lines: [{ id: "a", text: "x y", start: 0.5, end: 1.9, words: [{ word: "x", start: 0.5, end: 1.0 }, { word: "y", start: 1.0, end: 1.9 }] }, { id: "b", text: "z", start: 2, end: 3, words: [{ word: "z", start: 2.0, end: 3.0 }] }] };
  writeFileSync(join(dir, "cues.json"), JSON.stringify(cues));
  const r = run("said", dir);
  assert.equal(r.status, 0, r.stderr);
  const said = JSON.parse(readFileSync(join(dir, "said.json"), "utf8"));
  assert.equal(said.a[0], 1.0, "x: the next word starts first");
  assert.ok(Math.abs(said.a[1] - 1.4) <= 0.02, `y said by ${said.a[1]}, its aligned end is 1.9`);
  assert.ok(Math.abs(said.b[0] - 2.5) <= 0.02);
  // the same rule as a function, on levels given directly
  const db = Array.from({ length: 300 }, (_, k) => (k >= 50 && k < 140 ? -10 : -90));
  assert.deepEqual(saidTimes(cues, db).a, [1, 1.4]);
});

t("seam: the pause from the voice's end to the film's end, plus its start", () => {
  const dir = mkdtempSync(join(tmpdir(), "vo-seam-"));
  tone(join(dir, "vo.wav"), [[0.4, 2.2]], 2.5);
  writeFileSync(join(dir, "cues.json"), JSON.stringify({ duration: 2.5, lines: [] }));
  const r = run("seam", dir);
  assert.equal(r.status, 0, r.stderr);
  const pause = Number(r.stdout.match(/seam pause ([\d.]+) s/)[1]);
  assert.ok(Math.abs(pause - 0.7) <= 0.03, `pause ${pause}`);
});

test("words: numbers, case and punctuation aside; one missing word is one difference", () => {
  assert.equal(spell(21), "twenty one");
  assert.equal(spell(1800), "one thousand eight hundred");
  assert.deepEqual(normalise("Twenty-one posts, 21 posts! 50%"), ["twenty", "one", "posts", "twenty", "one", "posts", "fifty", "percent"]);
  assert.deepEqual(normalise("Quilfern ships", { quilfern: "quillfern" }), ["quillfern", "ships"]);
  assert.deepEqual(diffWords(["a", "c", "d"], ["a", "b", "c", "d"]), ['script word 2 "b" not heard']);
  assert.deepEqual(diffWords(["a", "x", "c"], ["a", "b", "c"]), ['script word 2: heard "x", script "b"']);

  const dir = mkdtempSync(join(tmpdir(), "vo-words-"));
  writeFileSync(join(dir, "vo-plan.json"), JSON.stringify({ lines: [{ id: "a", text: "Ship it in 3 days." }, { id: "b", text: "Quillfern does the rest." }] }));
  writeFileSync(join(dir, "w.json"), JSON.stringify({ transcription: [{ text: " Ship it in three days. [Music]" }, { text: " Quilfern does the rest." }] }));
  const r = run("words", join(dir, "w.json"), join(dir, "vo-plan.json"), "--alias", "quillfern=quilfern");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /word for word the same/);
  writeFileSync(join(dir, "w2.json"), JSON.stringify({ transcription: [{ text: " Ship it in days. Quillfern does the rest." }] }));
  const bad = run("words", join(dir, "w2.json"), join(dir, "vo-plan.json"));
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /DIFFERENCES: script word 4 "three" not heard/);

  writeFileSync(join(dir, "script.md"), "# Script\n\n1. Ship it in 3 days.  [hook]\n2. Quillfern does the rest.\n");
  assert.equal(scriptText(join(dir, "script.md")).trim(), "Ship it in 3 days. Quillfern does the rest.");
});

test("dtw merges tokens into words with their DTW times; usage errors exit 2", () => {
  const json = { transcription: [{ tokens: [{ text: "[_BEG_]", t_dtw: 0 }, { text: " Hel", t_dtw: 12 }, { text: "lo", t_dtw: 20 }, { text: " there", t_dtw: 55 }] }] };
  assert.deepEqual(dtwWords(json), [{ word: "Hello", at: 0.12 }, { word: "there", at: 0.55 }]);
  assert.equal(run().status, 2);
  assert.equal(run("said").status, 2);
  assert.ok(!existsSync(join(tmpdir(), "nothing-written-here")));
});
