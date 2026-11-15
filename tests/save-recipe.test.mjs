// SKILL.md → Rules, "Save, in full", run on real git. Two clones of one bare origin: "here" has film work in progress
// (an uncommitted change to a tracked film file) and a run's record, log entry and ledger row; "there" has meanwhile
// pushed a run with its own log entry and ledger row. Then "here" saves, by the steps SKILL.md writes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const skillMd = readFileSync(fileURLToPath(new URL("../skills/boqount/SKILL.md", import.meta.url)), "utf8");
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@localhost", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@localhost", GIT_EDITOR: "true" };
const git = (cwd, ...args) => execFileSync("git", ["-c", "init.defaultBranch=trunk", ...args], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const gitTry = (cwd, ...args) => spawnSync("git", args, { cwd, env, encoding: "utf8" });
const HEADER = "slug,status,posted_at\n";

function world() {
  const base = mkdtempSync(join(tmpdir(), "boqount-save-"));
  git(base, "init", "-q", "--bare", "origin.git");
  git(base, "clone", "-q", "origin.git", "seed");
  const seed = join(base, "seed");
  mkdirSync(join(seed, "films/x"), { recursive: true });
  mkdirSync(join(seed, "marketing"));
  writeFileSync(join(seed, "films/x/script.txt"), "One line.\n");
  writeFileSync(join(seed, "marketing/log.md"), "# log\n\n## 2026-01-05 07:00 UTC — here\n- first\n");
  writeFileSync(join(seed, "marketing/ledger.csv"), HEADER + "a,posted,2026-01-05T10:00:00Z\n");
  writeFileSync(join(seed, "marketing/notes.md"), "one\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-qm", "seed");
  git(seed, "push", "-q", "origin", "HEAD:trunk");
  git(base, "clone", "-q", "-b", "trunk", "origin.git", "here");
  git(base, "clone", "-q", "-b", "trunk", "origin.git", "there");
  const here = join(base, "here"), there = join(base, "there");
  appendFileSync(join(there, "marketing/log.md"), "\n## 2026-01-06 07:00 UTC — there\n- a run\n");
  appendFileSync(join(there, "marketing/ledger.csv"), "b,posted,2026-01-06T10:00:00Z\n");
  git(there, "commit", "-qam", "marketing: run");
  git(there, "push", "-q", "origin", "HEAD:trunk");
  appendFileSync(join(here, "films/x/script.txt"), "A line the person is still writing.\n");
  mkdirSync(join(here, "marketing/publications"));
  writeFileSync(join(here, "marketing/publications/2026-01-06-x.md"), "# x\n\n- Status: checked\n");
  appendFileSync(join(here, "marketing/log.md"), "\n## 2026-01-06 07:30 UTC — here\n- x checked\n");
  appendFileSync(join(here, "marketing/ledger.csv"), "x,checked,\n");
  return { base, here, there };
}

// Step 4: a log.md conflict keeps both entries; a ledger or budget conflict where both sides only added rows keeps
// every row of both; anything else aborts the rebase.
function resolve(cwd) {
  const conflicted = git(cwd, "diff", "--name-only", "--diff-filter=U").trim().split("\n").filter(Boolean);
  const keepBoth = ["marketing/log.md", "marketing/ledger.csv", "marketing/budget.csv"];
  if (conflicted.some((f) => !keepBoth.includes(f))) {
    git(cwd, "rebase", "--abort");
    return { aborted: conflicted };
  }
  for (const f of conflicted) {
    const text = readFileSync(join(cwd, f), "utf8").split("\n").filter((l) => !/^(<<<<<<< |=======$|>>>>>>> )/.test(l)).join("\n");
    writeFileSync(join(cwd, f), text);
    git(cwd, "add", f);
  }
  git(cwd, "-c", "core.editor=true", "rebase", "--continue");
  return { aborted: null };
}

function save(cwd, paths, message) {
  git(cwd, "add", ...paths);
  git(cwd, "commit", "-qm", message, "--", ...paths);
  if (gitTry(cwd, "pull", "-q", "--rebase", "--autostash").status !== 0) {
    const r = resolve(cwd);
    if (r.aborted) return r;
  }
  git(cwd, "push", "-q", "origin", "HEAD:trunk");
  return { aborted: null };
}

test("SKILL.md still writes the steps this test runs", () => {
  for (const step of ["`git commit -m \"marketing: <what>\" --", "never `-a`", "`git pull --rebase --autostash`", "keeps both entries in date order", "keeps every row of both", "`git rebase --abort`, stop, report", "never `--force`"]) {
    assert.ok(skillMd.includes(step), `SKILL.md → Save, in full: ${step}`);
  }
});

test("a plain pull --rebase refuses with film work in progress: the reason Save commits exact paths first", () => {
  const { here } = world();
  assert.notEqual(gitTry(here, "pull", "-q", "--rebase").status, 0);
});

test("Save, in full: the record reaches the remote, both log entries and every ledger row survive, film work stays", () => {
  const { here, there } = world();
  const r = save(here, ["marketing/publications/2026-01-06-x.md", "marketing/log.md", "marketing/ledger.csv"], "marketing: x checked");
  assert.equal(r.aborted, null);
  git(there, "pull", "-q", "--rebase");
  assert.ok(existsSync(join(there, "marketing/publications/2026-01-06-x.md")));
  const log = readFileSync(join(there, "marketing/log.md"), "utf8");
  assert.match(log, /07:00 UTC — there/);
  assert.match(log, /07:30 UTC — here/);
  assert.doesNotMatch(log, /^(<<<<<<<|=======|>>>>>>>)/m);
  const ledger = readFileSync(join(there, "marketing/ledger.csv"), "utf8").trim().split("\n");
  assert.deepEqual(ledger.map((l) => l.split(",")[0]).sort(), ["a", "b", "slug", "x"]);
  assert.match(readFileSync(join(here, "films/x/script.txt"), "utf8"), /still writing/);
  assert.notEqual(gitTry(here, "diff", "--quiet", "--", "films/x/script.txt").status, 0, "the film work is still uncommitted");
  assert.equal(git(here, "log", "origin/trunk", "--format=%H", "--", "films/x/script.txt").trim().split("\n").length, 1);
});

test("Save, in full: a conflict outside the log, ledger and budget aborts the rebase and pushes nothing", () => {
  const { here, there } = world();
  writeFileSync(join(there, "marketing/notes.md"), "two, there\n");
  git(there, "commit", "-qam", "notes there");
  git(there, "push", "-q", "origin", "HEAD:trunk");
  writeFileSync(join(here, "marketing/notes.md"), "two, here\n");
  const r = save(here, ["marketing/notes.md", "marketing/log.md"], "marketing: notes");
  assert.ok(r.aborted.includes("marketing/notes.md"));
  assert.equal(readFileSync(join(here, "marketing/notes.md"), "utf8"), "two, here\n");
  assert.equal(git(here, "status", "--porcelain", "--", "marketing/notes.md").trim(), "");
  assert.doesNotMatch(git(here, "log", "origin/trunk", "--format=%s"), /marketing: notes/);
});
