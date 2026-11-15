// The logic of account-lock.mjs: who runs the account right now.
//
// Several people may run /boqount for one account from their own machines, sharing it through one git remote. Two
// runs at once would post twice and fight over marketing/. The lock is one file, marketing/lock.md, on the remote
// branch, taken by a compare-and-swap push: a commit is built on top of the remote tip with only lock.md changed (in a
// throwaway index, so the working tree, the local branch and any work in progress are never touched) and pushed
// without --force. If the remote moved meanwhile, the push is rejected, the tip is fetched again and the lock re-read.
// The local branch picks the lock commit up at the run's own `git pull --rebase --autostash`.
//
// No lock is needed, and none is taken, when the account is not shared: outside a git repository, with no upstream
// for the current branch, or when the config's `git_push` is not `on` (this machine alone writes the account).
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";

export const LOCK_FILE = "marketing/lock.md";
export const USAGE = "usage: account-lock.mjs <status|claim|release> [--hours 6] [--who <login>] [--force] [--remote <name>] [--branch <name>] [--now <ISO>]";

export function parseLock(text) {
  const out = { holder: "", host: "", since: "", until: "" };
  for (const line of (text ?? "").split("\n")) {
    const m = /^(holder|host|since|until):\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

export function formatLock({ holder, host, since, until }, note) {
  return [
    "# lock",
    "",
    "Who runs the account now. Written only by `node <skill>/tools/account-lock.mjs` (claim, release); never edit by hand.",
    note ? `\n${note}` : "",
    "",
    `holder: ${holder ?? ""}`,
    `host: ${host ?? ""}`,
    `since: ${since ?? ""}`,
    `until: ${until ?? ""}`,
    "",
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

export function lockState(lock, me, now) {
  const held = Boolean(lock.holder);
  const until = Date.parse(lock.until);
  const stale = held && (!Number.isFinite(until) || until <= now.getTime());
  const mine = held && lock.holder === me.who && lock.host === me.host;
  return { held, holder: lock.holder, host: lock.host, since: lock.since, until: lock.until, stale, mine };
}

// The decisions alone, so they can be tested without git.
export function decideClaim(lock, me, now, hours) {
  const s = lockState(lock, me, now);
  if (s.held && !s.stale && !s.mine) return { ok: false, holder: s.holder, host: s.host, until: s.until };
  const until = new Date(now.getTime() + hours * 3600_000).toISOString();
  const since = s.mine && !s.stale ? s.since : now.toISOString();
  return {
    ok: true,
    lock: { holder: me.who, host: me.host, since, until },
    replaced: s.held && !s.mine ? { holder: s.holder, host: s.host, until: s.until } : null,
    renewed: s.mine && !s.stale,
  };
}

export function decideRelease(lock, me, now, force) {
  const s = lockState(lock, me, now);
  if (!s.held) return { ok: true, changed: false };
  if (!s.mine && !force) return { ok: false, holder: s.holder, host: s.host, until: s.until };
  return { ok: true, changed: true, freed: { holder: s.holder, host: s.host } };
}

function git(cwd, args, opts = {}) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
}

function tryGit(cwd, args) {
  try { return git(cwd, args); } catch { return ""; }
}

// Whether this account is shared through a remote, and where. Returns { needed: false, why } or
// { needed: true, remote, branch, path }.
export function where(cwd, { remote, branch } = {}) {
  if (!tryGit(cwd, ["rev-parse", "--is-inside-work-tree"])) {
    return { needed: false, why: "not a git repository: this machine alone writes the account" };
  }
  let push = "";
  try {
    const m = /^git_push:[ \t]*(\S*)/m.exec(readFileSync(join(cwd, "marketing/config.md"), "utf8"));
    push = m ? m[1] : "";
  } catch { /* no config: the push is off */ }
  if (push !== "on") return { needed: false, why: "git_push is not on: this machine alone writes the account" };
  const current = tryGit(cwd, ["symbolic-ref", "--short", "-q", "HEAD"]);
  const r = remote ?? (current && tryGit(cwd, ["config", `branch.${current}.remote`]));
  const merge = current && tryGit(cwd, ["config", `branch.${current}.merge`]);
  const b = branch ?? (merge ? merge.replace(/^refs\/heads\//, "") : "");
  if (!r || !b) return { needed: false, why: "the current branch has no upstream: nothing is shared, so no lock" };
  const prefix = tryGit(cwd, ["rev-parse", "--show-prefix"]);
  return { needed: true, remote: r, branch: b, path: `${prefix}${LOCK_FILE}` };
}

function remoteLock(cwd, at) {
  git(cwd, ["fetch", "-q", at.remote, at.branch]);
  const tip = git(cwd, ["rev-parse", "FETCH_HEAD"]);
  let text = "";
  try { text = git(cwd, ["show", `${tip}:${at.path}`]); } catch { text = ""; }
  return { tip, lock: parseLock(text) };
}

// One commit on top of `tip` that changes only the lock file, pushed as a fast-forward. False when rejected.
function swap(cwd, at, tip, content, message) {
  const index = join(tmpdir(), `account-lock-${process.pid}-${Date.now()}.index`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    git(cwd, ["read-tree", tip], { env });
    const blob = git(cwd, ["hash-object", "-w", "--stdin"], { input: content });
    git(cwd, ["update-index", "--add", "--cacheinfo", `100644,${blob},${at.path}`], { env });
    const tree = git(cwd, ["write-tree"], { env });
    const commit = git(cwd, ["commit-tree", tree, "-p", tip, "-m", message]);
    try {
      git(cwd, ["push", "-q", at.remote, `${commit}:refs/heads/${at.branch}`]);
      return true;
    } catch {
      return false;
    }
  } finally {
    rmSync(index, { force: true });
  }
}

export function whoAmI(cwd) {
  try {
    const login = execFileSync("gh", ["api", "user", "--jq", ".login"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (login) return login;
  } catch { /* gh missing or logged out */ }
  return tryGit(cwd, ["config", "user.name"]) || "unknown";
}

// Returns { code, out }: 0 done (or no lock needed), 3 someone else holds it, 2 usage, 1 an error (origin unreachable).
export function run(argv, { cwd = process.cwd(), now: nowOverride } = {}) {
  const [cmd, ...rest] = argv;
  if (!["status", "claim", "release"].includes(cmd)) return { code: 2, out: { error: USAGE } };
  const opt = (name, dflt) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : dflt; };
  const hours = Number(opt("hours", "6"));
  if (!(hours > 0)) return { code: 2, out: { error: USAGE } };
  const now = new Date(opt("now", nowOverride ?? new Date().toISOString()));

  const at = where(cwd, { remote: opt("remote"), branch: opt("branch") });
  if (!at.needed) return { code: 0, out: { ok: true, needed: false, why: at.why } };

  const me = { who: opt("who") ?? whoAmI(cwd), host: hostname().replace(/\.local$/, "") };
  for (let attempt = 0; attempt < 5; attempt++) {
    const { tip, lock } = remoteLock(cwd, at);
    if (cmd === "status") return { code: 0, out: { needed: true, ...lockState(lock, me, now) } };
    if (cmd === "claim") {
      const d = decideClaim(lock, me, now, hours);
      if (!d.ok) return { code: 3, out: d };
      const msg = `marketing: lock ${me.who}@${me.host} until ${d.lock.until}`;
      const note = d.replaced ? `Took over a stale lock of ${d.replaced.holder}@${d.replaced.host} (until ${d.replaced.until}).` : "";
      if (swap(cwd, at, tip, formatLock(d.lock, note), msg)) {
        return { code: 0, out: { ok: true, needed: true, holder: me.who, host: me.host, until: d.lock.until, renewed: d.renewed, replaced: d.replaced } };
      }
      continue;
    }
    const d = decideRelease(lock, me, now, rest.includes("--force"));
    if (!d.ok) return { code: 3, out: d };
    if (!d.changed) return { code: 0, out: { ok: true, needed: true, changed: false } };
    const msg = `marketing: unlock ${d.freed.holder}@${d.freed.host}`;
    const by = d.freed.holder === me.who && d.freed.host === me.host ? "" : ` by ${me.who}@${me.host} (--force)`;
    const note = `Last held by ${d.freed.holder}@${d.freed.host}, released ${now.toISOString()}${by}.`;
    if (swap(cwd, at, tip, formatLock({}, note), msg)) return { code: 0, out: { ok: true, needed: true, changed: true } };
  }
  return { code: 1, out: { ok: false, error: "the remote kept moving: five pushes rejected in a row" } };
}
