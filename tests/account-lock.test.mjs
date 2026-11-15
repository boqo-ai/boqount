// The lock: who runs a shared account right now (SKILL.md → Rules → The lock).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLock, formatLock, decideClaim, decideRelease, run } from "../skills/boqount/tools/account-lock-lib.mjs";

const cli = fileURLToPath(new URL("../skills/boqount/tools/account-lock.mjs", import.meta.url));
const HOST = hostname().replace(/\.local$/, "");
const NOW = new Date("2026-01-14T15:00:00Z");
const at = { now: NOW.toISOString() };
const me = { who: "anna", host: "mac-a" };

test("parse and format round-trip", () => {
  const lock = { holder: "anna", host: "mac-a", since: "2026-01-14T15:00:00.000Z", until: "2026-01-14T21:00:00.000Z" };
  assert.deepEqual(parseLock(formatLock(lock, "a note")), lock);
  assert.deepEqual(parseLock(formatLock({})), { holder: "", host: "", since: "", until: "" });
  assert.deepEqual(parseLock(""), { holder: "", host: "", since: "", until: "" });
});

test("a free lock is claimed for the given hours", () => {
  const d = decideClaim(parseLock(""), me, NOW, 6);
  assert.equal(d.ok, true);
  assert.equal(d.lock.until, "2026-01-14T21:00:00.000Z");
  assert.equal(d.replaced, null);
});

test("someone else's fresh lock refuses the claim", () => {
  const d = decideClaim({ holder: "boris", host: "mac-b", since: "x", until: "2026-01-14T16:00:00Z" }, me, NOW, 6);
  assert.deepEqual(d, { ok: false, holder: "boris", host: "mac-b", until: "2026-01-14T16:00:00Z" });
});

test("the same login on another host is someone else", () => {
  const d = decideClaim({ holder: "anna", host: "mac-b", since: "x", until: "2026-01-14T16:00:00Z" }, me, NOW, 6);
  assert.equal(d.ok, false);
});

test("a stale lock is taken over and named; an unreadable until is stale", () => {
  const d = decideClaim({ holder: "boris", host: "mac-b", since: "x", until: "2026-01-14T14:59:59Z" }, me, NOW, 6);
  assert.equal(d.ok, true);
  assert.deepEqual(d.replaced, { holder: "boris", host: "mac-b", until: "2026-01-14T14:59:59Z" });
  assert.equal(decideClaim({ holder: "boris", host: "mac-b", since: "", until: "soon" }, me, NOW, 6).ok, true);
});

test("our own lock renews and keeps its since", () => {
  const d = decideClaim({ holder: "anna", host: "mac-a", since: "2026-01-14T09:00:00Z", until: "2026-01-14T16:00:00Z" }, me, NOW, 6);
  assert.equal(d.renewed, true);
  assert.equal(d.lock.since, "2026-01-14T09:00:00Z");
  assert.equal(d.lock.until, "2026-01-14T21:00:00.000Z");
});

test("release frees only our own lock unless forced", () => {
  const theirs = { holder: "boris", host: "mac-b", since: "x", until: "2026-01-14T16:00:00Z" };
  assert.equal(decideRelease(theirs, me, NOW, false).ok, false);
  assert.equal(decideRelease(theirs, me, NOW, true).changed, true);
  assert.deepEqual(decideRelease(parseLock(""), me, NOW, false), { ok: true, changed: false });
  assert.equal(decideRelease({ ...theirs, holder: "anna", host: "mac-a" }, me, NOW, false).changed, true);
});

// Real git: one bare origin, two clones (two people). The account lives in a subfolder of the repository, so the lock
// file's path is found from where the run starts. The working tree and the local branch are never touched.
function g(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@localhost", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function repo({ push = "on" } = {}) {
  const base = mkdtempSync(join(tmpdir(), "account-lock-"));
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", join(base, "origin.git")]);
  g(base, "clone", "-q", join(base, "origin.git"), "a");
  const a = join(base, "a");
  g(a, "checkout", "-q", "-b", "main");
  mkdirSync(join(a, "acct/marketing"), { recursive: true });
  mkdirSync(join(a, "acct/films/x"), { recursive: true });
  writeFileSync(join(a, "acct/marketing/config.md"), `git_commit: on\ngit_push: ${push}\n`);
  writeFileSync(join(a, "acct/marketing/log.md"), "# log\n");
  writeFileSync(join(a, "acct/films/x/script.txt"), "1. One line.\n");
  g(a, "add", "-A"); g(a, "commit", "-qm", "seed"); g(a, "push", "-q", "-u", "origin", "main");
  g(base, "clone", "-q", "-b", "main", join(base, "origin.git"), "b");
  for (const d of [a, join(base, "b")]) { g(d, "config", "user.name", "t"); g(d, "config", "user.email", "t@localhost"); }
  return { base, a: join(a, "acct"), b: join(base, "b", "acct"), rootA: a, rootB: join(base, "b") };
}

test("two people: the second claim is refused, release lets it through, work in progress stays", () => {
  const { a, b, rootA } = repo();
  writeFileSync(join(a, "films/x/script.txt"), "1. One line.\n2. Work in progress.\n");
  const head = g(a, "rev-parse", "HEAD");

  const ca = run(["claim", "--who", "anna"], { cwd: a, ...at });
  assert.equal(ca.code, 0, JSON.stringify(ca.out));
  assert.equal(ca.out.needed, true);
  assert.equal(g(a, "rev-parse", "HEAD"), head, "the local branch is not moved");
  assert.match(readFileSync(join(a, "films/x/script.txt"), "utf8"), /Work in progress/);
  assert.equal(existsSync(join(a, "marketing/lock.md")), false, "the working tree is not touched");

  const cb = run(["claim", "--who", "boris"], { cwd: b, ...at });
  assert.equal(cb.code, 3);
  assert.equal(cb.out.holder, "anna");
  assert.equal(cb.out.host, HOST);

  assert.equal(run(["release", "--who", "boris"], { cwd: b, ...at }).code, 3, "boris cannot free anna's lock");
  assert.equal(run(["release", "--who", "anna"], { cwd: a, ...at }).code, 0);
  assert.equal(run(["claim", "--who", "boris"], { cwd: b, ...at }).code, 0);
  assert.equal(run(["status", "--who", "anna"], { cwd: a, ...at }).out.holder, "boris");

  // anna's pull brings the lock commits in on top of her branch, with her work kept.
  g(rootA, "pull", "-q", "--rebase", "--autostash");
  assert.match(readFileSync(join(a, "marketing/lock.md"), "utf8"), /holder: boris/);
  assert.match(readFileSync(join(a, "films/x/script.txt"), "utf8"), /Work in progress/);
});

test("a claim lands on top of what others pushed, never over it", () => {
  const { a, b, rootB } = repo();
  writeFileSync(join(b, "marketing/log.md"), "# log\n\n## a run\n");
  g(rootB, "commit", "-qam", "marketing: run"); g(rootB, "push", "-q");
  assert.equal(run(["claim", "--who", "anna"], { cwd: a, ...at }).code, 0);
  g(rootB, "pull", "-q", "--rebase");
  assert.match(readFileSync(join(b, "marketing/log.md"), "utf8"), /a run/);
  assert.match(readFileSync(join(b, "marketing/lock.md"), "utf8"), /holder: anna/);
});

test("a forced release by someone else is written into the lock file", () => {
  const { a, b, rootB } = repo();
  assert.equal(run(["claim", "--who", "anna"], { cwd: a, ...at }).code, 0);
  assert.equal(run(["release", "--who", "boris", "--force"], { cwd: b, ...at }).code, 0);
  g(rootB, "pull", "-q", "--rebase");
  assert.match(readFileSync(join(b, "marketing/lock.md"), "utf8"), /released .* by boris@.* \(--force\)/);
});

test("no lock is needed when the account is not shared", () => {
  const off = repo({ push: "off" });
  const r = run(["claim", "--who", "anna"], { cwd: off.a, ...at });
  assert.deepEqual([r.code, r.out.ok, r.out.needed], [0, true, false]);
  assert.match(r.out.why, /git_push/);

  const plain = mkdtempSync(join(tmpdir(), "account-lock-plain-"));
  mkdirSync(join(plain, "marketing"));
  writeFileSync(join(plain, "marketing/config.md"), "git_push: on\n");
  assert.match(run(["claim"], { cwd: plain, ...at }).out.why, /not a git repository/);

  const local = mkdtempSync(join(tmpdir(), "account-lock-local-"));
  execFileSync("git", ["init", "-q", "-b", "main", local]);
  mkdirSync(join(local, "marketing"));
  writeFileSync(join(local, "marketing/config.md"), "git_push: on\n");
  assert.match(run(["status"], { cwd: local, ...at }).out.why, /no upstream/);
});

test("an unreachable origin is an error, and the CLI exits 1", () => {
  const { a, rootA } = repo();
  g(rootA, "remote", "set-url", "origin", join(tmpdir(), "no-such-origin.git"));
  const r = spawnSync(process.execPath, [cli, "claim", "--who", "anna"], { cwd: a, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).ok, false);
});

test("the CLI prints one JSON line; a refused claim exits 3", () => {
  const { a, b } = repo();
  const ra = spawnSync(process.execPath, [cli, "claim", "--who", "anna"], { cwd: a, encoding: "utf8" });
  assert.equal(ra.status, 0, ra.stderr);
  assert.equal(JSON.parse(ra.stdout).ok, true);
  const rb = spawnSync(process.execPath, [cli, "claim", "--who", "boris"], { cwd: b, encoding: "utf8" });
  assert.equal(rb.status, 3);
  assert.equal(JSON.parse(rb.stdout).holder, "anna");
  assert.equal(spawnSync(process.execPath, [cli, "nonsense"], { cwd: a, encoding: "utf8" }).status, 2);
});
