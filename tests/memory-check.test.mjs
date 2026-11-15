// Runs the commands memory.md gives, as written, on throwaway logs: each one is extracted from memory.md, so a change
// there is what gets tested. (The week trigger, the fold, the summary's placing and the comment body.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const md = readFileSync(fileURLToPath(new URL("../skills/boqount/memory.md", import.meta.url)), "utf8");
const lines = md.split("\n");

const weekLine = lines.find((l) => l.startsWith("W=$(node -e"));
const foldStart = lines.findIndex((l) => l === "   node -e '");
const foldEnd = lines.findIndex((l, i) => i > foldStart && l === "   ' <today>");
const place = lines.filter((l) => /^ {3}(touch marketing\/weekly|\{ cat \.boqo-upload\/week-summary)/.test(l)).map((l) => l.slice(3));
const body = lines.find((l) => l.startsWith("sed '/^## Log$/,$d'"));

const sh = (cwd, script, ...args) => execFileSync("bash", ["-c", script, "sh", ...args], { cwd, encoding: "utf8" });
const week = (today) => sh(tmpdir(), weekLine.replace(/^W=\$\(/, "").replace(/ <today>\)$/, ' "$1"'), today).trim();
const fold = (cwd, today) => sh(cwd, lines.slice(foldStart, foldEnd + 1).map((l) => l.replace(/^ {3}/, "")).join("\n").replace(/<today>$/, '"$1"'), today);
const placeIt = (cwd, w) => sh(cwd, place.join("\n").replaceAll("<week>", "$1"), w);
const bodyOf = (cwd, w) => sh(cwd, body.replaceAll("<week>", "$1"), w);

const entry = (heading, did) => `${heading}\n\n- Did: ${did}\n\n`;
const count = (file) => (existsSync(file) ? (readFileSync(file, "utf8").match(/^## 20/gm) || []).length : 0);
function fresh(log) {
  const dir = mkdtempSync(join(tmpdir(), "boqount-memory-"));
  mkdirSync(join(dir, "marketing"));
  mkdirSync(join(dir, ".boqo-upload"));
  writeFileSync(join(dir, "marketing/log.md"), log);
  return dir;
}

test("memory.md still holds the four commands", () => {
  assert.ok(weekLine, "the week one-liner");
  assert.ok(foldStart > 0 && foldEnd > foldStart, "the fold command");
  assert.equal(place.length, 2, "the summary's placing");
  assert.ok(body, "the comment body");
});

test("the last ISO week, for the trigger", () => {
  assert.equal(week("2027-01-04"), "2026-W53");
  assert.equal(week("2026-11-30"), "2026-W48");
  assert.equal(week("2026-12-01"), "2026-W48");
  assert.equal(week("2026-11-29"), "2026-W47");
});

test("the fold: no weekly folder yet, one pointer line, the new entry stays", () => {
  const dir = fresh("# log\n\n" + entry("## 2026-11-10 07:40 UTC — x", "a") + entry("## 2026-11-29 07:40 UTC — x", "b"));
  const out = JSON.parse(fold(dir, "2026-11-30"));
  assert.equal(out.week, "2026-W48");
  assert.deepEqual(out.folded, { "2026-W46": 1 });
  assert.equal(count(join(dir, "marketing/weekly/2026-W46.md")), 1);
  assert.equal(count(join(dir, "marketing/log.md")), 1);
  assert.match(readFileSync(join(dir, "marketing/log.md"), "utf8"), /^- 2026-W46: 1 entries/m);
});

test("the fold: no preamble, and a date-only heading is its own entry in its own week", () => {
  const a = fresh(entry("## 2026-11-10 07:40 UTC — x", "a") + entry("## 2026-11-29 07:40 UTC — x", "b"));
  fold(a, "2026-11-30");
  assert.equal(count(join(a, "marketing/weekly/2026-W46.md")), 1);
  assert.doesNotMatch(readFileSync(join(a, "marketing/log.md"), "utf8"), /^## 2026-11-10/m);
  const b = fresh("# log\n\n" + entry("## 2026-11-20 07:40 UTC — x", "a") + entry("## 2026-11-11", "b") + entry("## 2026-11-29", "c"));
  fold(b, "2026-11-30");
  assert.match(readFileSync(join(b, "marketing/weekly/2026-W46.md"), "utf8"), /^## 2026-11-11$/m);
  assert.doesNotMatch(readFileSync(join(b, "marketing/weekly/2026-W47.md"), "utf8"), /^## 2026-11-11$/m);
  assert.match(readFileSync(join(b, "marketing/log.md"), "utf8"), /^## 2026-11-29$/m);
});

test("the summary keeps the Log, sits above it, is replaced by a second one; the comment body has no Log; twice is safe", () => {
  const dir = fresh("# log\n\n" + entry("## 2026-11-23 07:40 UTC — x", "a") + entry("## 2026-11-24 07:40 UTC — x", "b"));
  mkdirSync(join(dir, "marketing/weekly"));
  fold(dir, "2026-12-01");
  const file = join(dir, "marketing/weekly/2026-W48.md");
  assert.equal(count(file), 1);
  assert.doesNotMatch(readFileSync(file, "utf8"), /^## Posts/m, "a Log only: the roll-up is still due");
  writeFileSync(join(dir, ".boqo-upload/week-summary.md"), "# Week 2026-W48\n\n## Posts\n\n- summary\n");
  placeIt(dir, "2026-W48");
  let text = readFileSync(file, "utf8");
  assert.equal(count(file), 1);
  assert.ok(text.indexOf("## Posts") < text.indexOf("## Log"));
  writeFileSync(join(dir, ".boqo-upload/week-summary.md"), "# Week 2026-W48\n\n## Posts\n\n- rewritten\n");
  placeIt(dir, "2026-W48");
  text = readFileSync(file, "utf8");
  assert.doesNotMatch(text, /^- summary$/m);
  assert.equal(count(file), 1);
  bodyOf(dir, "2026-W48");
  const comment = readFileSync(join(dir, ".boqo-upload/week-comment.md"), "utf8");
  assert.match(comment, /^- rewritten$/m);
  assert.doesNotMatch(comment, /^## (Log|20)/m);
  const before = readFileSync(join(dir, "marketing/log.md"), "utf8");
  assert.deepEqual(JSON.parse(fold(dir, "2026-12-01")).folded, {});
  assert.equal(readFileSync(join(dir, "marketing/log.md"), "utf8"), before);
});
