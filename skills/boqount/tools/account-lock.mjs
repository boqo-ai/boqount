#!/usr/bin/env node
// Who runs the account right now, when several people run /boqount for one account from their own machines
// (SKILL.md → Rules → The lock).
//
//   node <skill>/tools/account-lock.mjs status              {"needed":true,"held":bool,"holder":..,"host":..,"since":..,"until":..,"stale":bool,"mine":bool}
//   node <skill>/tools/account-lock.mjs claim [--hours 6]   {"ok":true,...}, or exit 3 with {"ok":false,"holder":..,"host":..,"until":..}
//   node <skill>/tools/account-lock.mjs release [--force]   frees the lock if it is ours (--force: the human's step only)
//   node <skill>/tools/account-lock.mjs claim --soft --scope "<what>" [--hours 6]   a run alongside the holder, in its
//            own scope (exit 3 with {"ok":false,"clash":..} when someone else's fresh entry has the same scope)
//   node <skill>/tools/account-lock.mjs release --soft     frees our entry under "## Alongside"
//   options: --who <login> (default: `gh api user --jq .login`, else git user.name), --remote <name> and --branch <name>
//            (default: the current branch's upstream), --now <ISO> (tests)
//
// Run from the account's folder. With no git repository, no upstream, or `git_push` not `on` in marketing/config.md,
// every command prints {"ok":true,"needed":false,"why":..} and exits 0: nothing is shared, so nothing is locked.
// Exit 1 with {"ok":false,"error":..} when the remote cannot be read or written (unreachable, no rights).
// A claim by the same login on the same host renews it. A lock past its `until` is stale: a claim takes it over and
// its JSON names whose it was (`replaced`). The logic: tools/account-lock-lib.mjs.
import { run } from "./account-lock-lib.mjs";

let r;
try {
  r = run(process.argv.slice(2), { cwd: process.cwd() });
} catch (err) {
  r = { code: 1, out: { ok: false, error: String(err.stderr || err.message).trim().split("\n").pop() } };
}
console.log(JSON.stringify(r.out));
process.exit(r.code);
