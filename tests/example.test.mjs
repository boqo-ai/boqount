// examples/quillfern is a real account folder: the tools read it as they read any account after onboarding and
// research. If a template changes shape and the example is not brought along, these tests fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfig, queueRows } from "../skills/boqount/tools/account-state-lib.mjs";

const example = fileURLToPath(new URL("../examples/quillfern", import.meta.url));
const tools = fileURLToPath(new URL("../skills/boqount/tools", import.meta.url));
const read = (path) => readFileSync(join(example, path), "utf8");

/** Runs a tool from a neutral folder; returns its exit code and its one JSON line. */
function tool(name, args) {
  const r = spawnSync("node", [join(tools, name), ...args], { cwd: tmpdir(), encoding: "utf8" });
  assert.equal(r.stderr, "", `${name} ${args[0]} wrote to stderr`);
  return { code: r.status, out: JSON.parse(r.stdout) };
}

test("example: parseConfig reads the config", () => {
  const c = parseConfig(read("marketing/config.md"));
  assert.equal(c.brand, "quillfern");
  assert.deepEqual(c.channels, ["instagram", "tiktok"]);
  assert.equal(c.account_id, null, "both channels go by hand");
  assert.equal(c.timezone, "Europe/Lisbon");
  assert.equal(c.windows.length, 2);
  assert.equal(c.autopost, "calibration");
  assert.equal(c.signups_source, "manual");
  assert.deepEqual(c.mix, { reach: 70, awareness: 20, sale: 5, trust: 5 });
  assert.match(read("marketing/config.md"), /^git_commit: off$/m);
});

test("example: the queue holds the first week, two niche episodes and one product post, with no call and no product in a niche row", () => {
  const rows = queueRows(read("marketing/queue.md"));
  assert.equal(rows.length, 3);
  for (const r of rows) assert.equal(r.stage, "idea");
  const layers = read("marketing/queue.md").split("\n").filter((l) => /^\| [a-z0-9-]+ \| idea \|/.test(l)).map((l) => l.split("|").at(-2).trim());
  assert.deepEqual(layers, ["niche, episode 1", "niche, episode 1", "product"]);
  const niche = rows.filter((_, i) => layers[i].startsWith("niche"));
  for (const r of niche) assert.doesNotMatch(r.note, /quillfern/i, `${r.slug} names the product`);
  for (const r of rows) assert.doesNotMatch(r.note, /link in bio|comment|follow us|sign up|download|tap the link/i, `${r.slug} asks for something`);
});

test("example: norms come back on every channel from the strategy's benchmarks", () => {
  for (const channel of ["instagram", "tiktok"]) {
    const { code, out } = tool("account-state.mjs", ["norms", "--channel", channel, "--dir", example, "--now", "2026-11-16T09:00:00Z"]);
    assert.equal(code, 0, JSON.stringify(out));
    for (const type of ["reach", "awareness", "trust"]) assert.equal(out[type].source, "research", `${channel} ${type}`);
    assert.equal(out.sale.value, null, "no sale benchmark");
  }
});

test("example: kpi judges a week with the campaigns reply made from signups.csv", () => {
  const now = "2026-11-09T09:00:00Z";
  const campaigns = tool("account-state.mjs", ["campaigns", "--days", "70", "--dir", example, "--now", now]);
  assert.equal(campaigns.code, 0, JSON.stringify(campaigns.out));
  assert.equal(campaigns.out.through, "2026-11-08");
  const reply = join(mkdtempSync(join(tmpdir(), "boqount-example-")), "campaigns.json");
  writeFileSync(reply, JSON.stringify(campaigns.out));
  for (const channel of ["instagram", "tiktok"]) {
    const { code, out } = tool("account-state.mjs", ["kpi", "--channel", channel, "--from", "2026-11-02", "--to", "2026-11-08", "--campaigns", reply, "--dir", example, "--now", now]);
    assert.equal(code, 0, JSON.stringify(out));
    assert.deepEqual(out.standards, { block: true, rows: 4 });
  }
});

test("example: film.mjs theme writes all eleven tokens from the example's style.md", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "boqount-example-")), "quillfern");
  cpSync(example, dir, { recursive: true });
  const DEFAULTS = { canvas: "#000000", panel: "#111111", ink: "#FFFFFF", muted: "#888888", accent: "#0000FF", accent2: "#FFFF00", danger: "#FF0000", font_display: "Serif", font_text: "Serif", radius: 0, motion: "snappy" };
  mkdirSync(join(dir, "films/project/src/lib"), { recursive: true });
  const tokensPath = join(dir, "films/project/src/lib/tokens.json");
  writeFileSync(tokensPath, JSON.stringify(DEFAULTS, null, 2) + "\n");

  const { code, out } = tool("film.mjs", ["theme", "--dir", dir]);
  assert.equal(code, 0, JSON.stringify(out));
  assert.deepEqual(out.set.sort(), Object.keys(DEFAULTS).sort());

  const block = /^```tokens\n([\s\S]*?)^```$/m.exec(read("brand/quillfern/style.md"))[1];
  const want = {};
  for (const line of block.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [key, value] = [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()];
    want[key] = key === "radius" ? Number(value) : value.startsWith("#") ? value.toUpperCase() : value;
  }
  assert.equal(Object.keys(want).length, 11);
  assert.deepEqual(JSON.parse(readFileSync(tokensPath, "utf8")), want);
});
