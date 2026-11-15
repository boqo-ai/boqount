// The behaviour scenarios' worlds (tests/scenarios): every fixture builds, its sims parse, its prompts exist, and the
// numbers its lines rely on are what account-state gives at the fixture's clock. No session runs here: run.sh is the
// paid part, and `npm test` never calls it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const scenarios = join(repo, "tests/scenarios");
const tool = join(repo, "skills/boqount/tools/account-state.mjs");
const templates = join(repo, "skills/boqount/templates");
const ids = readdirSync(join(scenarios, "fixtures")).filter((d) => existsSync(join(scenarios, "fixtures", d, "fixture.json"))).sort();
const doc = readFileSync(join(scenarios, "scenarios.md"), "utf8");
const fixture = (id) => JSON.parse(readFileSync(join(scenarios, "fixtures", id, "fixture.json"), "utf8"));

/** The world setup.sh builds, without the films (ffmpeg) and without git. */
function world(id) {
  const w = mkdtempSync(join(tmpdir(), `boqount-${id}-`));
  cpSync(join(repo, "examples/quillfern/marketing"), join(w, "marketing"), { recursive: true });
  cpSync(join(repo, "examples/quillfern/brand"), join(w, "brand"), { recursive: true });
  for (const f of ["ledger.csv", "account.csv", "budget.csv", "state.md", "playbook.md"]) {
    if (!existsSync(join(w, "marketing", f))) cpSync(join(templates, f), join(w, "marketing", f));
  }
  if (!existsSync(join(w, "marketing/log.md"))) writeFileSync(join(w, "marketing/log.md"), "# Log\n");
  const overlay = join(scenarios, "fixtures", id, "overlay");
  if (existsSync(overlay)) cpSync(overlay, w, { recursive: true });
  return w;
}

test("every scenario has its fixture.json, its turn-1 prompt and its heading in scenarios.md", () => {
  assert.ok(ids.length >= 12, `fixtures: ${ids.join(", ")}`);
  for (const id of ids) {
    assert.equal(fixture(id).id, id);
    assert.ok(existsSync(join(scenarios, "prompts", `${id.toLowerCase()}-t1.txt`)), `${id}: prompts/${id.toLowerCase()}-t1.txt`);
    assert.match(doc, new RegExp(`^### ${id}: `, "m"), `${id}: a heading in scenarios.md`);
  }
});

test("every prompt belongs to a scenario, and none names a path of this machine", () => {
  for (const f of readdirSync(join(scenarios, "prompts"))) {
    const m = f.match(/^([a-z0-9]+)-t(\d+)\.txt$/);
    assert.ok(m, f);
    assert.ok(ids.some((i) => i.toLowerCase() === m[1]), `${f}: no fixture for ${m[1]}`);
    assert.doesNotMatch(readFileSync(join(scenarios, "prompts", f), "utf8"), /\/Users\/|\/home\//);
  }
});

test("every simulated reply is JSON, and a world with sims gets the dry-run preamble", () => {
  for (const id of ids) {
    const sim = join(scenarios, "fixtures", id, "sim");
    if (!existsSync(sim)) continue;
    for (const f of readdirSync(sim)) assert.doesNotThrow(() => JSON.parse(readFileSync(join(sim, f), "utf8")), `${id}/sim/${f}`);
    assert.ok(fixture(id).now, `${id}: a world with sims has a clock`);
  }
  const preamble = readFileSync(join(scenarios, "preamble.md"), "utf8");
  assert.match(preamble, /\{\{NOW\}\}/);
  assert.match(preamble, /MESSAGE TO THE USER/);
});

for (const id of ids) {
  const f = fixture(id);
  if (!f.checks?.length) continue;
  test(`${id}: the tools read the world as its lines say (${f.about})`, () => {
    const w = world(id);
    for (const { args, expect } of f.checks) {
      const r = spawnSync("node", [tool, ...args, "--dir", w, "--now", f.now], { encoding: "utf8" });
      assert.equal(r.status, 0, `${id} ${args.join(" ")}: ${r.stdout}${r.stderr}`);
      let out = JSON.parse(r.stdout);
      if (args[0] === "due") out = { count: out.due.length, late: out.due.filter((d) => d.late).length };
      assert.deepEqual(out, expect, `${id} ${args.join(" ")}`);
    }
  });
}

test("the scenario scripts are executable and npm test never runs them", () => {
  for (const f of ["setup.sh", "run.sh", "shims/gh", "shims/git", "shims/npm"]) {
    assert.ok(statSync(join(scenarios, f)).mode & 0o111, `${f} is executable`);
  }
  const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
  assert.equal(pkg.scripts.test, "node --test tests/*.test.mjs", "the glob stays one level deep: tests/scenarios is not in it");
  assert.match(readFileSync(join(scenarios, "run.sh"), "utf8"), /PAID SESSION/);
});
