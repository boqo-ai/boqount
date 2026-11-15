// keys.sh: the shared keys of a team, encrypted to each admin's GitHub SSH key. The round trip runs on real age and
// ssh-keygen in a temporary home, with the "GitHub" key list served from a file:// folder; it is skipped without age.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const tool = fileURLToPath(new URL("../skills/boqount/tools/keys.sh", import.meta.url));
const has = (bin) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0;
const skip = !(has("age") && has("ssh-keygen") && has("curl")) && "age, ssh-keygen or curl is not installed";

function admin(root, login) {
  const home = join(root, `home-${login}`);
  mkdirSync(join(home, ".ssh"), { recursive: true });
  execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", join(home, ".ssh/id_ed25519")]);
  writeFileSync(join(root, "github", `${login}.keys`), readFileSync(join(home, ".ssh/id_ed25519.pub")));
  return home;
}

function run(home, repo, ...args) {
  return spawnSync("bash", [tool, ...args, "--dir", repo], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, BOQOUNT_KEYS_DEST: join(home, ".config/boqount"), BOQOUNT_KEYS_URL: `file://${join(repo, "..", "github")}` },
  });
}

test("lock, unlock, check: an added admin decrypts the keys at mode 600, and no key is printed", { skip }, () => {
  const root = mkdtempSync(join(tmpdir(), "boqount-keys-"));
  mkdirSync(join(root, "github"));
  const repo = join(root, "account");
  mkdirSync(repo);
  const ann = admin(root, "ann");
  const bob = admin(root, "bob");
  mkdirSync(join(ann, ".config/boqount"), { recursive: true });
  writeFileSync(join(ann, ".config/boqount/eleven.key"), "sk-eleven-zq9x\n");
  writeFileSync(join(ann, ".config/boqount/fal.key"), "fal-zq9y\n");

  const first = run(ann, repo, "add", "ann");
  assert.equal(first.status, 0, first.stderr);
  const second = run(ann, repo, "add", "bob");
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /locked eleven\.key fal\.key for: ann bob/);
  assert.ok(existsSync(join(repo, "secrets/keys.age")));
  assert.match(readFileSync(join(repo, "secrets/recipients.txt"), "utf8"), /ssh-ed25519 .* bob/);

  const opened = run(bob, repo, "unlock");
  assert.equal(opened.status, 0, opened.stderr);
  assert.equal(readFileSync(join(bob, ".config/boqount/eleven.key"), "utf8"), "sk-eleven-zq9x\n");
  assert.equal(statSync(join(bob, ".config/boqount/fal.key")).mode & 0o777, 0o600);
  for (const out of [first, second, opened]) assert.doesNotMatch(out.stdout + out.stderr, /zq9/);

  const removed = run(ann, repo, "remove", "bob");
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(removed.stdout, /ROTATE: bob/);
  const shut = run(bob, repo, "unlock");
  assert.equal(shut.status, 3);
  assert.match(shut.stderr, /cannot decrypt/);
});

test("check names a missing key and lock refuses without it", { skip }, () => {
  const root = mkdtempSync(join(tmpdir(), "boqount-keys-"));
  mkdirSync(join(root, "github"));
  const repo = join(root, "account");
  mkdirSync(join(repo, "secrets"), { recursive: true });
  writeFileSync(join(repo, "secrets/keys.txt"), "# one per line\neleven.key\n");
  const ann = admin(root, "ann");
  const checked = run(ann, repo, "check");
  assert.match(checked.stdout, /^MISSING  .*eleven\.key$/m);
  assert.doesNotMatch(checked.stdout, /fal\.key/);
  const locked = run(ann, repo, "add", "ann");
  assert.equal(locked.status, 2);
  assert.match(locked.stderr, /eleven\.key is missing; run unlock first/);
});
