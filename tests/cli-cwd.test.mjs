// The CLI finds the account in the folder it is run from, wherever the skill itself is installed.
// The account here is built from the shipped templates, so a template the tool cannot read fails these tests too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const skill = fileURLToPath(new URL("../skills/boqount", import.meta.url));
const cli = join(skill, "tools/account-state.mjs");
const template = (name) => readFileSync(join(skill, "templates", name), "utf8");

const CONFIG = template("config.md")
  .replace(/^brand:.*$/m, "brand: demo")
  .replace(/^account_id:.*$/m, "account_id: a")
  .replace(/^timezone:.*$/m, "timezone: UTC")
  .replace(/^windows:.*$/m, "windows: 09:00-11:00");
const HEADER = template("ledger.csv").trim();

function row(values) {
  return HEADER.split(",").map((column) => values[column] ?? "").join(",");
}

function account(rows = []) {
  const dir = mkdtempSync(join(tmpdir(), "boqount-"));
  mkdirSync(join(dir, "marketing"));
  writeFileSync(join(dir, "marketing/config.md"), CONFIG);
  writeFileSync(join(dir, "marketing/ledger.csv"), [HEADER, ...rows.map(row)].join("\n") + "\n");
  return dir;
}

const mode = (args, cwd, bin = cli) => JSON.parse(execFileSync("node", [bin, "mode", ...args], { cwd, encoding: "utf8" }));
const APPROVED = { slug: "one", status: "posted", posted_at: "2026-01-01T10:00:00Z", type: "reach", approval: "human", boqo_post_id: "p1" };

test("mode reads the account in the current folder, not the skill's", () => {
  const dir = account([APPROVED]);
  assert.equal(mode([], dir).approved, 1);
  assert.deepEqual(mode([], dir), mode(["--dir", dir], tmpdir()));
});

test("--dir wins over the current folder", () => {
  const here = account();
  const there = account([APPROVED]);
  assert.equal(mode([], here).approved, 0);
  assert.equal(mode(["--dir", there], here).approved, 1);
});

test("the CLI runs through a symlinked skill folder", () => {
  const dir = account([APPROVED]);
  const link = join(mkdtempSync(join(tmpdir(), "boqount-skills-")), "boqount");
  symlinkSync(skill, link);
  assert.deepEqual(mode([], dir, join(link, "tools/account-state.mjs")), mode([], dir));
});
