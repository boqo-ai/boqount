// tools/vo-assemble.mjs: per-line takes into one voice-over and cue sheet, from a folder whose path holds a quote.
// Needs ffmpeg; each test skips cleanly without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../skills/boqount/tools/vo-assemble.mjs", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = (name, fn) => test(name, { skip: !hasFfmpeg && "ffmpeg is not installed" }, fn);

/** A folder named with a space and a quote, holding one take of "Water it" and a plan for it. */
function setup(lineId = "hook") {
  const root = mkdtempSync(join(tmpdir(), "boqount vo's; touch INJECTED; "));
  const lines = join(root, "lines");
  mkdirSync(lines);
  mkdirSync(join(root, "out"));
  const take = join(lines, `${lineId}.mp3`);
  try {
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=1.2", "-c:a", "libmp3lame", take]);
  } catch {
    // an unsafe id may not be a writable name; the plan is refused before the take is read
  }
  writeFileSync(join(lines, `${lineId}.words.json`), JSON.stringify([{ word: "Water", start: 0, end: 0.5 }, { word: "it", start: 0.55, end: 1 }]));
  const plan = join(root, "plan.json");
  writeFileSync(plan, JSON.stringify({ lead: 0.5, lines: [{ id: lineId, text: "Water it", gap: 0.3 }] }));
  return { root, lines, plan, out: join(root, "out") };
}

t("the voice-over and cue sheet come out of a folder whose path holds a space and a quote", () => {
  const s = setup();
  const scratch = mkdtempSync(join(tmpdir(), "boqount-cwd-"));
  const r = spawnSync("node", [cli, s.plan, s.lines, s.out], { encoding: "utf8", cwd: scratch });
  assert.equal(r.status, 0, r.stderr);
  const cues = JSON.parse(readFileSync(join(s.out, "cues.json"), "utf8"));
  assert.equal(cues.lines[0].id, "hook");
  assert.equal(cues.lines[0].words.length, 2);
  assert.ok(cues.duration > 1.5 && cues.duration < 2.5, `duration ${cues.duration}`);
  const wav = readFileSync(join(s.out, "vo.wav"));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 48000);
  assert.deepEqual(readdirSync(scratch), []);
  assert.equal(existsSync(join(s.root, "INJECTED")), false);
});

t("a line id that is a path, or a gap that is not a number, is refused", () => {
  const s = setup();
  for (const lines of [[{ id: "../escape", text: "x", gap: 0.3 }], [{ id: "a'b", text: "x", gap: 0.3 }], [{ id: "hook", text: "x", gap: "0.3" }], [{ id: "hook", text: "x", gap: 0.3, splits: [{ after: "Water", add: null }] }]]) {
    writeFileSync(s.plan, JSON.stringify({ lines }));
    const r = spawnSync("node", [cli, s.plan, s.lines, s.out], { encoding: "utf8" });
    assert.notEqual(r.status, 0, JSON.stringify(lines));
    assert.match(r.stderr, /lines\[0\]/);
    assert.equal(existsSync(join(s.out, "vo.wav")), false);
  }
});
