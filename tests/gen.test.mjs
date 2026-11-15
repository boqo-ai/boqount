// tools/gen.mjs: the price read live, the estimate checked against the budget, --yes, the reservation and the ledger,
// and the key never shown. The network is a stand-in: no test here calls a paid service.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findKey, main, unitsOf, filesIn } from "../skills/boqount/tools/gen.mjs";

const SECRET = "fal-test-secret-quillfern";
const NOW = new Date("2026-03-10T15:00:00Z");

function account({ dayCap = 10, rows = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "boqount-gen-"));
  mkdirSync(join(dir, "marketing"), { recursive: true });
  const cfg = ["brand: quillfern", "channels: instagram", "timezone: America/Toronto", "windows: 09:00-11:00, 18:00-20:00", "max_posts_per_day: 2", `budget_usd_day: ${dayCap}`, "budget_usd_month:", "credits_day: 0", "calibration_posts: 10", "autopost: calibration", "mix: reach 70, awareness 20, sale 5, trust 5", "verdict_band: 0.8-1.25", "research_every_weeks: 4"];
  writeFileSync(join(dir, "marketing/config.md"), "```config\n" + cfg.join("\n") + "\n```\n");
  writeFileSync(join(dir, "marketing/budget.csv"), ["date,slug,service,usd,credits,note", ...rows].join("\n") + "\n");
  writeFileSync(join(dir, "key.json"), JSON.stringify({ prompt: "a fern at dawn", num_images: 2, image_url: "@file:ref.png" }));
  writeFileSync(join(dir, "ref.png"), Buffer.from([137, 80, 78, 71]));
  writeFileSync(join(dir, "seg.json"), JSON.stringify({ prompt: "the camera flies through the door", duration: "5" }));
  return dir;
}

/** A stand-in for fal: prices, the queue, a status that completes, a result with two files. Records every call. */
function fal({ prices = { "fal-ai/img/edit": [0.15, "images"], "fal-ai/vid/i2v": [0.14, "seconds"] }, status = "COMPLETED" } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body });
    const u = new URL(url);
    const reply = (obj) => ({ ok: true, status: 200, json: async () => obj, arrayBuffer: async () => new ArrayBuffer(4) });
    if (u.host === "api.fal.ai") {
      const id = u.searchParams.get("endpoint_id");
      const p = prices[id];
      return reply({ prices: p ? [{ endpoint_id: id, unit_price: p[0], unit: p[1], currency: "USD" }] : [] });
    }
    if (u.host === "queue.fal.run" && init.method === "POST") return reply({ request_id: "req-1", status_url: "https://queue.fal.run/x/requests/req-1/status", response_url: "https://queue.fal.run/x/requests/req-1" });
    if (u.pathname.endsWith("/status")) return reply({ status });
    if (u.host === "queue.fal.run") return reply({ images: [{ url: "https://cdn.example/a.png" }, { url: "https://cdn.example/b.png" }] });
    if (u.host === "cdn.example") return reply({});
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetch, calls };
}

const deps = (dir, f, extra = {}) => ({ env: { FAL_KEY: SECRET }, home: dir, fetch: f.fetch, now: () => NOW, clock: () => 0, sleep: async () => {}, cwd: dir, log: () => {}, ...extra });
const noSecret = (r) => assert.ok(!`${r.out}${r.err}`.includes(SECRET), "the key is never printed");

test("the key comes from FAL_KEY, then FAL_KEY_FILE, then ~/.config/boqount/fal.key; none is null", () => {
  const h = mkdtempSync(join(tmpdir(), "boqount-home-"));
  mkdirSync(join(h, ".config/boqount"), { recursive: true });
  writeFileSync(join(h, ".config/boqount/fal.key"), "from-home\n", { mode: 0o600 });
  writeFileSync(join(h, "other.key"), "from-file\n");
  assert.equal(findKey({ FAL_KEY: " from-env " }, h).key, "from-env");
  assert.equal(findKey({ FAL_KEY_FILE: join(h, "other.key") }, h).key, "from-file");
  assert.equal(findKey({}, h).key, "from-home");
  assert.equal(findKey({}, mkdtempSync(join(tmpdir(), "boqount-home-"))), null);
});

test("with no key every paid command stops, names the three places, and calls nothing", async () => {
  const dir = account();
  const f = fal();
  for (const argv of [["price", "fal-ai/img/edit"], ["run", "fal-ai/img/edit", join(dir, "key.json"), join(dir, "out"), "--slug", "dawn"]]) {
    const r = await main(argv, deps(dir, f, { env: {} }));
    assert.equal(r.code, 1);
    assert.match(r.err, /FAL_KEY/);
    assert.match(r.err, /FAL_KEY_FILE/);
    assert.match(r.err, /\.config\/boqount\/fal\.key/);
    assert.match(r.err, /not offered/);
  }
  assert.equal(f.calls.length, 0);
});

test("price reads the source now and says when; an unlisted endpoint is unverified", async () => {
  const dir = account();
  const f = fal();
  const r = await main(["price", "fal-ai/img/edit", "fal-ai/none"], deps(dir, f));
  assert.equal(r.code, 0);
  assert.match(r.out, /fal-ai\/img\/edit {2}0\.15 USD \/ images {3}\(read 2026-03-10/);
  assert.match(r.out, /fal-ai\/none {2}unverified/);
  assert.ok(f.calls.every((c) => c.headers.authorization === `Key ${SECRET}`));
  noSecret(r);
});

test("units come from num_images or duration; anything else needs --units", () => {
  assert.equal(unitsOf({ num_images: 2 }, "images"), 2);
  assert.equal(unitsOf({}, "image"), 1);
  assert.equal(unitsOf({ duration: "5" }, "seconds"), 5);
  assert.equal(unitsOf({}, "seconds"), null);
  assert.equal(unitsOf({}, "megapixels"), null);
});

test("run without --yes prints the plan and the estimate, reserves nothing and asks the queue nothing", async () => {
  const dir = account();
  const f = fal();
  const before = readFileSync(join(dir, "marketing/budget.csv"), "utf8");
  const r = await main(["run", "fal-ai/img/edit", join(dir, "key.json"), join(dir, "out"), "--slug", "dawn"], deps(dir, f));
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /2 × 0\.15 USD \/ images .* = \$0\.3/);
  assert.match(r.out, /Nothing was asked/);
  assert.match(r.out, /--yes/);
  assert.equal(readFileSync(join(dir, "marketing/budget.csv"), "utf8"), before);
  assert.ok(!f.calls.some((c) => c.url.startsWith("https://queue.fal.run")));
  assert.ok(!existsSync(join(dir, "out/ledger.jsonl")));
});

test("an estimate past what is left stops before anything is reserved or asked, even with --yes", async () => {
  const dir = account({ dayCap: 1, rows: ["2026-03-10,old,fal,0.9,0,fal earlier"] });
  const f = fal();
  const r = await main(["run", "fal-ai/vid/i2v", join(dir, "seg.json"), join(dir, "out"), "--slug", "dawn", "--yes"], deps(dir, f));
  assert.equal(r.code, 1);
  assert.match(r.err, /= \$0\.7; left in the budget: \$0\.1/);
  assert.match(r.err, /Over what is left/);
  assert.ok(!readFileSync(join(dir, "marketing/budget.csv"), "utf8").includes("dawn"));
  assert.ok(!f.calls.some((c) => c.url.startsWith("https://queue.fal.run")));
});

test("an unverified price is never called", async () => {
  const dir = account();
  const f = fal({ prices: {} });
  const r = await main(["run", "fal-ai/img/edit", join(dir, "key.json"), join(dir, "out"), "--slug", "dawn", "--yes"], deps(dir, f));
  assert.equal(r.code, 1);
  assert.match(r.err, /unverified/);
  assert.ok(!f.calls.some((c) => c.url.startsWith("https://queue.fal.run")));
});

test("run --yes reserves, calls, downloads, logs the request and rewrites only its own budget line", async () => {
  const dir = account({ rows: ["2026-03-09,old,elevenlabs,0.2,0,tts\r"] });
  const f = fal();
  const r = await main(["run", "fal-ai/img/edit", join(dir, "key.json"), join(dir, "out"), "--slug", "dawn", "--yes"], deps(dir, f));
  assert.equal(r.code, 0, r.err);
  noSecret(r);
  const csv = readFileSync(join(dir, "marketing/budget.csv"), "utf8").split("\n");
  assert.equal(csv[1], "2026-03-09,old,elevenlabs,0.2,0,tts\r", "another machine's line is left byte for byte");
  assert.equal(csv[2], "2026-03-10,dawn,fal,0.3,0,fal req-1 fal-ai/img/edit key 2 images");
  const led = readFileSync(join(dir, "out/ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(led.length, 1);
  assert.equal(led[0].request_id, "req-1");
  assert.equal(led[0].usd, 0.3);
  assert.equal(led[0].input.image_url, "@file:ref.png", "the ledger keeps the input as written, never a data URI");
  const sent = JSON.parse(f.calls.find((c) => c.url === "https://queue.fal.run/fal-ai/img/edit").body);
  assert.match(sent.image_url, /^data:image\/png;base64,/);
  assert.ok(existsSync(join(dir, "out/key-1.png")) && existsSync(join(dir, "out/key-2.png")) && existsSync(join(dir, "out/key.result.json")));
  const s = await main(["spent", join(dir, "out")], deps(dir, f));
  assert.match(s.out, /1 call\(s\), \$0\.3/);
});

test("a call the queue refuses leaves its line as an estimate, not called", async () => {
  const dir = account();
  const base = fal();
  const fetch = async (url, init = {}) => (url.startsWith("https://queue.fal.run") ? { ok: false, status: 403, json: async () => ({ detail: SECRET }) } : base.fetch(url, init));
  const r = await main(["run", "fal-ai/img/edit", join(dir, "key.json"), join(dir, "out"), "--slug", "dawn", "--yes"], deps(dir, { fetch }));
  assert.equal(r.code, 1);
  assert.match(r.err, /HTTP 403/);
  noSecret(r);
  assert.match(readFileSync(join(dir, "marketing/budget.csv"), "utf8"), /2026-03-10,dawn,fal,0\.3,0,estimate; not called: fal-ai\/img\/edit key/);
});

test("filesIn finds every url in a result, in order", () => {
  assert.deepEqual(filesIn({ video: { url: "https://a/v.mp4" }, images: [{ url: "https://a/1.png" }, { url: "data:x" }] }).map((x) => x.url), ["https://a/v.mp4", "https://a/1.png"]);
});
