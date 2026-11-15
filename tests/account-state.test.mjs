// node --test tests/account-state.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseConfig, parseCsv, ledgerRows, calibration, budget, slot, queueDepth, parseInstant, run, kpi, kpiTargets } from "../skills/boqount/tools/account-state-lib.mjs";

const LIB = fileURLToPath(new URL("../skills/boqount/tools/account-state-lib.mjs", import.meta.url));

const DEFAULTS = {
  brand: "quillfern",
  channels: "instagram",
  account_id: "",
  timezone: "America/Toronto",
  windows: "09:00-11:00, 18:00-20:00",
  max_posts_per_day: "2",
  budget_usd_day: "10",
  budget_usd_month: "",
  credits_day: "0",
  calibration_posts: "10",
  autopost: "calibration",
  paused_by: "",
  resumed_at: "",
  mix: "reach 50, awareness 30, sale 15, trust 5",
  verdict_band: "0.8-1.25",
  research_every_weeks: "4",
  seed_research: "/tmp/quillfern/reports/viral topics for café ☕ 東京.md, /tmp/quillfern/research_notes/viral topics/",
  caption_via_filename: "ask",
  live_page: "",
  tracker: "https://quillfern.example/tracker/41",
  sales_goal_28d: "",
};
const configMd = (patch = {}) => {
  const kv = { ...DEFAULTS, ...patch };
  const body = Object.entries(kv).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}:${v === "" ? "" : " " + v}`).join("\n");
  return `# Config\n\nSome prose.\n\n\`\`\`config\n${body}\n\`\`\`\n`;
};
const cfg = (patch) => parseConfig(configMd(patch));

const HEADER = "slug,status,planned_for,scheduled_at,posted_at,type,type_source,segment,rubric,tier,variable,expect_metric,expect_low,expect_high,norm_used,cost_usd,cost_credits,code_word,utm_campaign,upload_name,boqo_project_id,card_id,boqo_post_id,permalink,approval,check,views_24h,likes_24h,views_72h,likes_72h,views_7d,likes_7d,follows,follows_source,comments_7d,sends,saves,reach,skip_3s,visits,clicks,dm_codes,signups_7d,activated_7d,buyers_7d,signups_28d,buyers_28d,data,verdict,verdict_at,note".split(",");
const csvRow = (o) => HEADER.map((h) => o[h] ?? "").join(",");
const ledgerText = (rows) => [HEADER.join(","), ...rows.map(csvRow)].join("\n") + "\n";
const row = (o) => ({ slug: "s", status: "posted", type: "reach", type_source: "skill", tier: "1", approval: "human", check: "pass", ...o });

test("parseConfig ignores a key it does not know", () => {
  const md = configMd().replace("```\n", "some_old_key: 2026-01-01\n```\n");
  assert.ok(md.includes("some_old_key: 2026-01-01"));
  const c = parseConfig(md);
  assert.equal(c.brand, "quillfern");
  assert.equal(Object.hasOwn(c, "some_old_key"), false);
});

test("parseConfig reads the config block and its types", () => {
  const c = parseConfig(configMd());
  assert.deepEqual(c.windows, [{ from: "09:00", to: "11:00" }, { from: "18:00", to: "20:00" }]);
  assert.deepEqual(c.mix, { reach: 50, awareness: 30, sale: 15, trust: 5 });
  assert.deepEqual(c.verdict_band, [0.8, 1.25]);
  assert.equal(c.timezone, "America/Toronto");
  assert.equal(c.budget_usd_month, null);
  assert.equal(c.budget_usd_day, 10);
  assert.equal(c.max_posts_per_day, 2);
  assert.equal(c.account_id, null);
  assert.equal(c.autopost, "calibration");
  assert.equal(c.tracker, "https://quillfern.example/tracker/41");
  assert.ok(c.seed_research.includes("café ☕ 東京"));
  // The MCP server the skill may use is named in the config.
  assert.equal(c.boqo_server, null);
  assert.equal(cfg({ boqo_server: "claude.ai boqo" }).boqo_server, "claude.ai boqo");
});

test("parseConfig refuses a wrong mix or more than 2 posts a day", () => {
  assert.throws(() => cfg({ mix: "reach 60, awareness 30, sale 15, trust 5" }), /100/);
  assert.throws(() => cfg({ max_posts_per_day: "3" }), /2/);
  assert.throws(() => parseConfig("# no block here\n"), /config block/);
});

test("ledgerRows lets empty enum cells through (legacy and planned rows)", () => {
  const rows = ledgerRows(ledgerText([
    { slug: "old", status: "legacy", type: "legacy", type_source: "legacy" },
    { slug: "new", status: "planned", type: "reach" },
  ]));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].tier, "");
  assert.equal(rows[0].data, "");
  assert.equal(rows[0].verdict, "");
  // but status and type may not be empty
  assert.throws(() => ledgerRows(ledgerText([{ slug: "x", status: "planned" }])), /ledger line 2: type /);
});

test("ledgerRows refuses an unknown enum, and keeps legacy", () => {
  const bad = ledgerText([row({ slug: "a" }), row({ slug: "b", type: "viral" })]);
  assert.throws(() => ledgerRows(bad), /^Error: ledger line 3: type viral$/);
  const legacy = ledgerRows(ledgerText([row({ slug: "old", type: "legacy", type_source: "legacy", status: "legacy" })]));
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].type, "legacy");
  // check accepts caught:<rule>, and refuses a bare "caught"
  assert.equal(ledgerRows(ledgerText([row({ check: "caught:no-hook" })])).length, 1);
  assert.throws(() => ledgerRows(ledgerText([row({ check: "caught" })])), /ledger line 2: check caught/);
});

test("parseCsv handles quoted commas, quotes and newlines", () => {
  const rows = parseCsv('a,b,c\n1,"x, y","say ""hi"""\n2,"two\nlines",z\r\n');
  assert.deepEqual(rows, [
    { a: "1", b: "x, y", c: 'say "hi"' },
    { a: "2", b: "two\nlines", c: "z" },
  ]);
});

test("ledgerRows reports the physical line after a multi-line field", () => {
  const text = ledgerText([row({ slug: "a", note: '"two\nlines"' }), row({ slug: "b", tier: "9" })]);
  assert.throws(() => ledgerRows(text), /ledger line 4: tier 9/);
});

test("calibration ignores a post that never went out", () => {
  const human = (i, status) => row({ slug: `h${i}`, status, approval: "human", boqo_post_id: `p${i}` });
  const statuses = ["scheduled", "posted", "failed", "canceled", "abandoned", "held", "approved"];
  const parsed = ledgerRows(ledgerText(statuses.map((st, i) => human(i, st))));
  assert.equal(calibration(parsed, cfg()).approved, 2);
});

test("calibration counts approved posts boqo accepted", () => {
  const human = (i) => row({ slug: `h${i}`, approval: "human", boqo_post_id: `p${i}` });
  const rows = [...Array.from({ length: 9 }, (_, i) => human(i)), row({ slug: "nopost", approval: "human" }), row({ slug: "auto", approval: "auto", boqo_post_id: "pa" })];
  const parsed = ledgerRows(ledgerText(rows));
  assert.deepEqual(calibration(parsed, cfg()), { approved: 9, needed: 10, mode: "calibration", switchDue: false });
  const ten = ledgerRows(ledgerText([...rows, human(9)]));
  assert.equal(calibration(ten, cfg()).switchDue, true);
  assert.equal(calibration(ten, cfg()).approved, 10);
  const paused = calibration(ten, cfg({ autopost: "paused" }));
  assert.equal(paused.switchDue, false);
  assert.equal(paused.mode, "paused");
});

const BUDGET = "date,slug,service,usd,credits,note\n2026-11-10,a,elevenlabs,3.20,0,\n2026-11-10,b,fal,4.00,0,\n";

test("parseCsv accepts an empty last field, and a row that stops short of it", () => {
  assert.deepEqual(parseCsv(BUDGET)[0], { date: "2026-11-10", slug: "a", service: "elevenlabs", usd: "3.20", credits: "0", note: "" });
  assert.equal(parseCsv("date,slug,note\n2026-11-10,a\n")[0].note, "");
});

test("budget sums the day and the month on the account's clock", () => {
  const out = budget(parseCsv(BUDGET), cfg({ credits_day: "0" }), new Date("2026-11-11T03:30:00Z"));
  assert.equal(out.day.spentUsd, 7.2);
  assert.equal(out.day.capUsd, 10);
  assert.equal(out.day.leftUsd, 2.8);
  assert.equal(out.month.capUsd, 300);
  assert.equal(out.month.spentUsd, 7.2);
  assert.deepEqual(out.credits, { spent: 0, cap: 0, left: 0 });
  assert.equal(out.over, false);
});

test("budget counts the day by the account's date, not UTC's", () => {
  // 2026-11-11T03:30Z is 11-10 in Toronto; at 06:00Z it is 11-11 and the day's spend is empty.
  const out = budget(parseCsv(BUDGET), cfg(), new Date("2026-11-11T06:00:00Z"));
  assert.equal(out.day.spentUsd, 0);
  assert.equal(out.month.spentUsd, 7.2);
});

test("budget never reports a negative left", () => {
  const rows = parseCsv("date,slug,service,usd,credits,note\n2026-11-10,a,fal,12,0,\n");
  const out = budget(rows, cfg(), new Date("2026-11-11T03:30:00Z"));
  assert.equal(out.day.leftUsd, 0);
  assert.equal(out.over, true);
});

test("budget refuses without a time zone", () => {
  assert.throws(() => budget([], cfg({ timezone: "" }), new Date("2026-11-11T03:30:00Z")), /timezone/);
});

const iso = (s) => new Date(s);

test("slot picks the next window start on a day with room, in the account's zone", () => {
  const out = slot(cfg(), ["2026-11-10T23:00:00Z"], iso("2026-11-10T15:30:00Z"));
  assert.deepEqual(out, { date: "2026-11-11", time: "09:00", at: "2026-11-11T14:00:00.000Z", zone: "America/Toronto" });
});

test("slot never picks inside the next 60 minutes", () => {
  const c = cfg({ windows: "14:00-15:00, 18:00-20:00" });
  // 13:30 Toronto = 18:30Z
  const out = slot(c, [], iso("2026-11-10T18:30:00Z"));
  assert.equal(out.date, "2026-11-10");
  assert.equal(out.time, "18:00");
  assert.equal(out.at, "2026-11-10T23:00:00.000Z");
  // exactly 60 minutes ahead is allowed
  assert.equal(slot(c, [], iso("2026-11-10T18:00:00Z")).time, "14:00");
});

test("slot keeps one post per window and two per day", () => {
  const today = "2026-11-10T23:00:00Z"; // 18:00 Toronto on 11-10, so the rest of today is full too
  const taken = [today, "2026-11-11T14:00:00Z", "2026-11-11T23:00:00Z"];
  const out = slot(cfg(), taken, iso("2026-11-10T15:30:00Z"));
  assert.equal(out.date, "2026-11-12");
  assert.equal(out.time, "09:00");
  // a post inside the morning window (09:30) holds that window, so the evening one is next
  const out2 = slot(cfg({ max_posts_per_day: "2" }), [today, "2026-11-11T14:30:00Z"], iso("2026-11-10T15:30:00Z"));
  assert.equal(out2.date, "2026-11-11");
  assert.equal(out2.time, "18:00");
  // one post a day: a taken day is skipped whole
  const out3 = slot(cfg({ max_posts_per_day: "1" }), [today, "2026-11-11T14:30:00Z"], iso("2026-11-10T15:30:00Z"));
  assert.equal(out3.date, "2026-11-12");
});

test("slot honours the day cap on its own, with a free third window", () => {
  const c = cfg({ windows: "09:00-11:00, 13:00-15:00, 18:00-20:00", max_posts_per_day: "2" });
  // now 08:00 Toronto 11-10; 09:00 and 13:00 taken today, 18:00 is free but the day is full
  const out = slot(c, ["2026-11-10T14:00:00Z", "2026-11-10T18:00:00Z"], iso("2026-11-10T13:00:00Z"));
  assert.deepEqual(out, { date: "2026-11-11", time: "09:00", at: "2026-11-11T14:00:00.000Z", zone: "America/Toronto" });
  // with one post taken the free third window is used
  assert.equal(slot(c, ["2026-11-10T14:00:00Z"], iso("2026-11-10T13:00:00Z")).time, "13:00");
});

test("slot --day starts on that day on the account's clock, whatever the hour of now", () => {
  // 2026-11-10T12:30Z is 07:30 in Toronto; today's 09:00 window is free, but the post is planned for 11-12.
  const out = slot(cfg(), [], iso("2026-11-10T12:30:00Z"), "2026-11-12");
  assert.deepEqual([out.date, out.time, out.at], ["2026-11-12", "09:00", "2026-11-12T14:00:00.000Z"]);
  // late evening in Toronto is already the next UTC day: --day still names the account's date
  const late = slot(cfg(), [], iso("2026-11-11T03:30:00Z"), "2026-11-11");
  assert.deepEqual([late.date, late.time], ["2026-11-11", "09:00"]);
  // a full day moves on to the next one; a day in the past starts today
  const full = slot(cfg(), ["2026-11-12T14:00:00Z", "2026-11-12T23:00:00Z"], iso("2026-11-10T12:30:00Z"), "2026-11-12");
  assert.deepEqual([full.date, full.time], ["2026-11-13", "09:00"]);
  assert.equal(slot(cfg(), [], iso("2026-11-10T12:30:00Z"), "2026-11-01").at, "2026-11-10T14:00:00.000Z");
  // across the spring change the offset is the tool's job: 2027-03-15 09:00 EDT is 13:00Z
  assert.equal(slot(cfg(), [], iso("2027-03-12T12:30:00Z"), "2027-03-15").at, "2027-03-15T13:00:00.000Z");
  assert.throws(() => slot(cfg(), [], iso("2026-11-10T12:30:00Z"), "2026-11-31"), /YYYY-MM-DD/);
  assert.throws(() => slot(cfg(), [], iso("2026-11-10T12:30:00Z"), "11/12"), /YYYY-MM-DD/);
});

test("slot follows daylight saving in the account's zone", () => {
  // Toronto springs forward on 2027-03-14: 09:00 that day is 13:00Z, the day before it is 14:00Z.
  assert.equal(slot(cfg(), [], iso("2027-03-13T23:30:00Z")).at, "2027-03-14T13:00:00.000Z");
  assert.equal(slot(cfg(), [], iso("2027-03-12T23:30:00Z")).at, "2027-03-13T14:00:00.000Z");
});

test("slot is the same whatever the Mac's zone", () => {
  const script = `
    import { parseConfig, slot } from ${JSON.stringify(pathToFileURL(LIB).href)};
    const c = parseConfig(${JSON.stringify(configMd())});
    const s = slot(c, ["2026-11-10T23:00:00Z"], new Date("2026-11-10T15:30:00Z"));
    console.log(JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, s }));
  `;
  const outs = ["Europe/Berlin", "Asia/Tokyo", "America/Los_Angeles"].map((TZ) => {
    const line = execFileSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, TZ }, encoding: "utf8" }).trim();
    const parsed = JSON.parse(line);
    assert.equal(parsed.tz, TZ, "the child really ran in the zone it was given");
    return parsed.s;
  });
  assert.deepEqual(outs[0], outs[1]);
  assert.deepEqual(outs[0], outs[2]);
  assert.deepEqual(outs[0], { date: "2026-11-11", time: "09:00", at: "2026-11-11T14:00:00.000Z", zone: "America/Toronto" });
});

test("slot refuses without windows or a zone", () => {
  assert.throws(() => slot(cfg({ windows: "" }), [], iso("2026-11-10T15:30:00Z")), /windows/);
  assert.throws(() => slot(cfg({ timezone: "" }), [], iso("2026-11-10T15:30:00Z")), /timezone/);
});

test("queueDepth counts consecutive days ahead", () => {
  const now = iso("2026-11-10T15:30:00Z");
  const a = queueDepth(["2026-11-11T14:00:00Z", "2026-11-12T14:00:00Z"], cfg(), now);
  assert.equal(a.daysAhead, 2);
  assert.deepEqual(a.byDay, { "2026-11-11": 1, "2026-11-12": 1 });
  assert.equal(queueDepth(["2026-11-11T14:00:00Z", "2026-11-13T14:00:00Z"], cfg(), now).daysAhead, 1);
  // late evening Toronto is still the same account day
  assert.equal(queueDepth(["2026-11-12T03:30:00Z"], cfg(), now).byDay["2026-11-11"], 1);
});

test("parseInstant takes Z and numeric offsets, and refuses a bare time", () => {
  assert.equal(parseInstant("2026-11-10T15:30:00Z").toISOString(), "2026-11-10T15:30:00.000Z");
  assert.equal(parseInstant("2026-11-10T10:30:00-05:00").toISOString(), "2026-11-10T15:30:00.000Z");
  assert.equal(parseInstant("2026-11-10T10:30:00.250-0500").toISOString(), "2026-11-10T15:30:00.250Z");
  for (const bad of ["2026-11-10T10:30:00", "2026-11-10", "2026-11-10 10:30:00Z", "", "nonsense", "2026-13-40T10:30:00Z", null]) {
    assert.throws(() => parseInstant(bad), undefined, JSON.stringify(bad));
  }
  assert.throws(() => slot(cfg(), ["2026-11-11T09:00:00"], iso("2026-11-10T15:30:00Z")), /ISO instant/);
  assert.throws(() => queueDepth(["2026-11-11T09:00:00"], cfg(), iso("2026-11-10T15:30:00Z")), /ISO instant/);
});

test("run prints one JSON line and refuses an unknown command", async () => {
  const bad = await run(["paid"], {});
  assert.equal(bad.code, 1);
  assert.match(JSON.parse(bad.line).error, /^usage:/);
});

test("run mode, budget, slot and queue read their files under --dir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "acct-"));
  try {
    await mkdir(join(dir, "marketing"));
    await writeFile(join(dir, "marketing", "config.md"), configMd());
    await writeFile(join(dir, "marketing", "ledger.csv"), ledgerText([row({ approval: "human", boqo_post_id: "p1", posted_at: "2026-11-09T14:00:00Z" })]));
    await writeFile(join(dir, "marketing", "budget.csv"), BUDGET);
    await writeFile(join(dir, "marketing", "queue.md"), "| slug | stage | type | rubric | tier | for | file | note |\n|---|---|---|---|---|---|---|---|\n| a | ready | reach | r | 1 | 2026-11-11 | f | |\n| b | idea | sale | r | 2 | 2026-11-12 | | |\n");
    await writeFile(join(dir, "taken.json"), JSON.stringify({ posts: [
      { scheduledAt: "2026-11-10T23:00:00Z", status: "scheduled" },
      { scheduledAt: "2026-11-11T14:00:00Z", status: "canceled" },
      { scheduledAt: "2026-11-11T23:00:00Z", status: "failed" },
    ] }));
    const { readFile } = await import("node:fs/promises");
    const deps = { readFile, now: () => new Date("2026-11-10T15:30:00Z") };
    const base = ["--dir", dir];
    const mode = JSON.parse((await run(["mode", ...base], deps)).line);
    assert.deepEqual(mode, { approved: 1, needed: 10, mode: "calibration", switchDue: false });
    const b = JSON.parse((await run(["budget", ...base], deps)).line);
    assert.equal(b.day.spentUsd, 7.2);
    const s = JSON.parse((await run(["slot", ...base, "--taken", join(dir, "taken.json")], deps)).line);
    assert.equal(s.at, "2026-11-11T14:00:00.000Z");
    const s2 = JSON.parse((await run(["slot", ...base, "--now", "2026-11-11T20:00:00Z"], deps)).line);
    assert.equal(s2.date, "2026-11-11");
    assert.equal(s2.time, "18:00");
    const s3 = JSON.parse((await run(["slot", ...base, "--day", "2026-11-12"], deps)).line);
    assert.deepEqual([s3.date, s3.time], ["2026-11-12", "09:00"]);
    assert.equal((await run(["queue", ...base, "--day", "2026-11-12"], deps)).code, 1);
    const q = JSON.parse((await run(["queue", ...base, "--taken", join(dir, "taken.json")], deps)).line);
    assert.equal(q.daysAhead, 0);
    assert.deepEqual(q.byDay, { "2026-11-10": 1 });
    assert.deepEqual(q.stages, { ready: 1, idea: 1 });
    const bare = await run(["slot", ...base, "--now", "2026-11-10T10:30:00"], deps);
    assert.equal(bare.code, 1);
    assert.match(JSON.parse(bare.line).error, /ISO instant/);
    await writeFile(join(dir, "bare.json"), JSON.stringify({ posts: [{ scheduledAt: "2026-11-11T09:00:00", status: "scheduled" }] }));
    assert.equal((await run(["slot", ...base, "--taken", join(dir, "bare.json")], deps)).code, 1);
    const missing = await run(["mode", "--dir", join(dir, "nope")], deps);
    assert.equal(missing.code, 1);
  } finally {
    await rm(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------- norms, due, verdict, streak, followers

import { benchmarks, norms, metricNorm, due, verdict, streak, followerGain } from "../skills/boqount/tools/account-state-lib.mjs";

const H = 3600 * 1000;
const isoAt = (ms) => new Date(ms).toISOString();
const T0 = Date.parse("2026-10-20T14:00:00Z");
const DAY_MS = 24 * H;
const BENCH_MD = (lines) => `# Strategy\n\n\`\`\`benchmarks\n${lines.join("\n")}\n\`\`\`\n`;

test("norms uses the median of the last 10 ready posts of a type", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row({ slug: `r${i}`, type: "reach", posted_at: isoAt(T0 + i * DAY_MS), views_72h: String(100 * (i + 1)) }));
  const n = norms(rows, {}, new Date("2026-11-10T15:00:00Z"));
  assert.equal(n.reach.value, 750);
  assert.equal(n.reach.n, 10);
  assert.equal(n.reach.source, "own");
  assert.equal(n.reach.metric, "views_72h");
});

test("norms keeps human- and skill-typed posts apart", () => {
  const human = Array.from({ length: 6 }, (_, i) => row({ slug: `h${i}`, type_source: "human", posted_at: isoAt(T0 + i * DAY_MS), views_72h: String(100 * (i + 1)) }));
  const skill = Array.from({ length: 6 }, (_, i) => row({ slug: `k${i}`, type_source: "skill", posted_at: isoAt(T0 + (6 + i) * DAY_MS), views_72h: String(700 + 100 * i) }));
  const n = norms([...human, ...skill], {}, new Date("2026-11-10T15:00:00Z"));
  assert.deepEqual(n.reach.bySource.human, { value: 350, n: 6 });
  assert.deepEqual(n.reach.bySource.skill, { value: 950, n: 6 });
  assert.equal(n.reach.value, 750); // pooled: the median of the newest 10
  assert.equal(n.reach.n, 10);
});

test("norms falls back to the research benchmark under 5 posts", () => {
  const rows = Array.from({ length: 4 }, (_, i) => row({ slug: `a${i}`, type: "awareness", posted_at: isoAt(T0 + i * DAY_MS), views_7d: "1000", follows: "10" }));
  const bench = benchmarks(BENCH_MD(["awareness | follows_per_1000_views_7d | 4 | Social Insider 2025 | 2026-11-08"]));
  const n = norms(rows, bench, new Date("2026-11-10T15:00:00Z"));
  assert.equal(n.awareness.source, "research");
  assert.equal(n.awareness.value, 4);
  assert.equal(n.awareness.n, 4);
  assert.equal(n.awareness.benchSource, "Social Insider 2025");
  assert.equal(n.awareness.benchDate, "2026-11-08");
  // 5 own posts take over from the benchmark
  const five = [...rows, row({ slug: "a4", type: "awareness", posted_at: isoAt(T0 + 4 * DAY_MS), views_7d: "1000", follows: "10" })];
  const m = norms(five, bench, new Date("2026-11-10T15:00:00Z"));
  assert.equal(m.awareness.source, "own");
  assert.equal(m.awareness.value, 10);
  assert.equal("benchSource" in m.awareness, false);
});

test("a type with no benchmark row and fewer than 5 own posts gives value null, and its verdict is no-data", () => {
  const bench = benchmarks(BENCH_MD(["reach | views_72h | 1500 | Buffer 2025 | 2026-11-08"]));
  const rows = [row({ slug: "t0", type: "trust", posted_at: isoAt(T0), comments_7d: "3" })];
  const n = norms(rows, bench, new Date("2026-11-10T15:00:00Z"));
  assert.equal(n.trust.value, null);
  assert.equal(n.trust.source, null);
  assert.equal(n.trust.n, 1);
  assert.deepEqual(verdict(row({ type: "trust", comments_7d: "3" }), n.trust, [0.8, 1.25]), { verdict: "no-data", data: "partial" });
  // and with no benchmarks at all
  const none = norms([], {}, new Date("2026-11-10T15:00:00Z"));
  for (const t of ["reach", "awareness", "trust", "sale"]) assert.equal(none[t].value, null);
});

test("benchmarks keeps only rows in the type's main metric, and survives missing and free-text rows", () => {
  assert.deepEqual(benchmarks("# no block here"), {});
  assert.deepEqual(benchmarks(BENCH_MD([])), {});
  const b = benchmarks(BENCH_MD([
    "type | metric | value | source | date",
    "reach | views_72h | 1500 | Buffer 2025 | 2026-11-08",
    "awareness | follows_rate | 0.02 | Rival IQ | 2026-11-08",
    "trust | no benchmark in the seed research",
    "no benchmark in the seed research",
    "sale | signups_7d | not a number | x | 2026-11-08",
    "bogus | views_72h | 5 | x | 2026-11-08",
    "| sale | signups_7d | 2 | Internal 2026 | 2026-11-08 |",
  ]));
  assert.deepEqual(Object.keys(b).sort(), ["reach", "sale"]);
  assert.deepEqual(b.reach, { metric: "views_72h", value: 1500, source: "Buffer 2025", date: "2026-11-08" });
  assert.equal(b.sale.value, 2);
  // a claim without a source and a number without a date are not used
  const bad = benchmarks(BENCH_MD([
    "reach | views_72h | 1500 |  | 2026-11-08",
    "awareness | follows_per_1000_views_7d | 4 | Social Insider 2025 | ",
    "trust | comments_7d | 3 | Rival IQ | last spring",
    "sale | signups_7d | 2 | Internal 2026 | 2026-13-45",
  ]));
  assert.deepEqual(bad, {});
  // norms ignores a benchmark whose metric is not the main one even if handed one
  const n = norms([], { awareness: { metric: "follows_rate", value: 0.02, source: "x", date: "d" } }, new Date("2026-11-10T15:00:00Z"));
  assert.equal(n.awareness.value, null);
});

test("norms counts a post only once its type's window has passed", () => {
  const now = new Date("2026-11-10T14:00:00Z");
  const at = (h) => isoAt(now.getTime() - h * H);
  const reach = [
    row({ slug: "old", type: "reach", posted_at: at(80), views_72h: "100" }),
    row({ slug: "young", type: "reach", posted_at: at(48), views_72h: "900" }),
    row({ slug: "empty", type: "reach", posted_at: at(90) }),
    row({ slug: "unposted", status: "scheduled", type: "reach", posted_at: at(100), views_72h: "5" }),
  ];
  const seven = [
    row({ slug: "t-old", type: "trust", posted_at: at(8 * 24), comments_7d: "4" }),
    row({ slug: "t-young", type: "trust", posted_at: at(5 * 24), comments_7d: "40" }),
    row({ slug: "s-old", type: "sale", posted_at: at(8 * 24), signups_7d: "2" }),
    row({ slug: "s-young", type: "sale", posted_at: at(6 * 24), signups_7d: "20" }),
    row({ slug: "a-young", type: "awareness", posted_at: at(5 * 24), follows: "9", views_7d: "100" }),
  ];
  const n = norms([...reach, ...seven], {}, now);
  assert.equal(n.reach.n, 1);
  assert.equal(n.trust.n, 1);
  assert.equal(n.sale.n, 1);
  assert.equal(n.awareness.n, 0);
});

test("norms for screenshot-only metrics use only posts with screenshots", () => {
  const now = new Date("2026-11-20T14:00:00Z");
  const rows = [
    row({ slug: "a", posted_at: "2026-11-01T14:00:00Z", sends: "10" }),
    row({ slug: "b", posted_at: "2026-11-02T14:00:00Z", sends: "" }),
    row({ slug: "c", posted_at: "2026-11-03T14:00:00Z", sends: "30" }),
  ];
  const m = metricNorm(rows, "sends", now);
  assert.equal(m.n, 2);
  assert.equal(m.value, 20);
  assert.throws(() => metricNorm(rows, "nonsense", now), /metric/);
});

test("due lists late checkpoints with their real age", () => {
  const rows = [row({ slug: "p1", posted_at: "2026-11-10T14:00:00Z" })];
  const d = due(rows, new Date("2026-11-13T09:00:00Z"));
  assert.equal(d.length, 1);
  assert.deepEqual(d[0], { slug: "p1", checkpoint: "+24h", dueAt: "2026-11-11T14:00:00.000Z", ageHours: 67, late: true });
  const later = due(rows, new Date("2026-11-13T14:00:00Z"));
  assert.deepEqual(later.map((x) => x.checkpoint), ["+24h", "+72h"]);
  // +72 h due exactly now is listed, age 72, and is not late
  assert.deepEqual(later[1], { slug: "p1", checkpoint: "+72h", dueAt: "2026-11-13T14:00:00.000Z", ageHours: 72, late: false });
});

test("due calls a checkpoint late only when read more than 24 h past its moment", () => {
  const rows = [row({ slug: "p1", posted_at: "2026-11-10T14:00:00Z" })];
  const at = (iso) => due(rows, new Date(iso)).find((x) => x.checkpoint === "+24h");
  // +24h is due 2026-11-11T14:00Z
  assert.equal(at("2026-11-11T20:00:00Z").late, false); // 6 h past
  assert.equal(at("2026-11-12T14:00:00Z").late, false); // exactly 24 h past
  assert.equal(at("2026-11-12T14:00:01Z").late, true);
});

test("due skips filled checkpoints, checkpoints behind a filled later one, and unposted rows", () => {
  const now = new Date("2026-11-13T15:00:00Z");
  const rows = [
    row({ slug: "has24", posted_at: "2026-11-10T14:00:00Z", views_24h: "50" }),
    row({ slug: "has72", posted_at: "2026-11-10T14:00:00Z", views_72h: "90" }),
    row({ slug: "sched", status: "scheduled", posted_at: "2026-11-10T14:00:00Z" }),
  ];
  assert.deepEqual(due(rows, now).map((x) => `${x.slug} ${x.checkpoint}`), ["has24 +72h"]);
});

test("due closes the checkpoints up to the type's verdict window once a verdict is written", () => {
  // A main metric read late leaves its windowed column empty (measure.md); the written verdict closes the window.
  const now = new Date("2026-11-21T15:00:00Z");
  const rows = [
    row({ slug: "aw", type: "awareness", posted_at: "2026-11-10T14:00:00Z", verdict: "no-data", verdict_at: "2026-11-21" }),
    row({ slug: "re", type: "reach", posted_at: "2026-11-10T14:00:00Z", verdict: "no-data", verdict_at: "2026-11-21" }),
    row({ slug: "open", type: "awareness", posted_at: "2026-11-10T14:00:00Z" }),
  ];
  assert.deepEqual(due(rows, now).map((x) => `${x.slug} ${x.checkpoint}`), ["open +24h", "open +72h", "open +7d", "re +7d"]);
});

test("due keeps a verdict's window closed when an earlier checkpoint is filled", () => {
  // quill-before-after had +24h read, then a late +72h read wrote verdict no-data with views_72h
  // empty; due still listed +72h, because a filled +24h reset the closed index.
  const now = new Date("2026-11-18T12:30:00Z");
  const rows = [
    row({ slug: "qba", type: "reach", posted_at: "2026-11-11T23:00:00Z", views_24h: "410", verdict: "no-data", verdict_at: "2026-11-18" }),
    row({ slug: "aw", type: "awareness", posted_at: "2026-11-05T14:00:00Z", views_24h: "300", verdict: "no-data", verdict_at: "2026-11-13" }),
  ];
  assert.deepEqual(due(rows, now).map((x) => `${x.slug} ${x.checkpoint}`), []);
  // the next checkpoint after the window still comes due: qba +7d at 2026-11-18T23:00Z
  assert.deepEqual(due(rows, new Date("2026-11-19T00:00:00Z")).map((x) => `${x.slug} ${x.checkpoint}`), ["qba +7d"]);
});

test("verdict places the main metric in the band", () => {
  const norm = { metric: "views_72h", value: 1000, n: 10, source: "own" };
  const band = [0.8, 1.25];
  assert.deepEqual(verdict(row({ views_72h: "1300" }), norm, band), { verdict: "above", data: "full" });
  assert.equal(verdict(row({ views_72h: "1000" }), norm, band).verdict, "within");
  assert.equal(verdict(row({ views_72h: "1250" }), norm, band).verdict, "within");
  assert.equal(verdict(row({ views_72h: "800" }), norm, band).verdict, "within");
  assert.equal(verdict(row({ views_72h: "700" }), norm, band).verdict, "below");
  assert.equal(verdict(row({ views_72h: "" }), norm, band).verdict, "no-data");
  assert.equal(verdict(row({ views_72h: "700" }), { ...norm, value: null }, band).verdict, "no-data");
});

test("awareness is follows per 1,000 views, an estimate without a screenshot", () => {
  const acct = parseCsv("date,read_at,followers,gained_week,source\n2026-11-10,2026-11-10T13:00:00Z,38,,screen\n2026-11-12,2026-11-12T10:00:00Z,50,,screen\n");
  const g = followerGain(acct, "2026-11-10T14:00:00Z", 2400);
  assert.deepEqual(g, { gain: 12, perThousand: 5, data: "partial", follows_source: "estimate" });
  // no readings: nothing is invented
  assert.deepEqual(followerGain([], "2026-11-10T14:00:00Z", 2400), { gain: null, perThousand: null, data: "partial", follows_source: "estimate" });
  // a reading outside 48 h is not used
  const far = parseCsv("date,read_at,followers,gained_week,source\n2026-11-10,2026-11-10T13:00:00Z,38,,s\n2026-11-14,2026-11-14T10:00:00Z,50,,s\n");
  assert.equal(followerGain(far, "2026-11-10T14:00:00Z", 2400).gain, null);
  // the verdict reads the estimate and marks the data partial
  const r = row({ type: "awareness", posted_at: "2026-11-10T14:00:00Z", follows: "", views_7d: "2400" });
  const norm = { metric: "follows_per_1000_views_7d", value: 5, n: 5, source: "own" };
  assert.deepEqual(verdict(r, norm, [0.8, 1.25], acct), { verdict: "within", data: "partial" });
  assert.deepEqual(verdict(r, norm, [0.8, 1.25]), { verdict: "no-data", data: "partial" });
  // a counted follows value is a full measurement
  const counted = row({ type: "awareness", follows: "12", views_7d: "2400" });
  assert.deepEqual(verdict(counted, norm, [0.8, 1.25]), { verdict: "within", data: "full" });
});

test("streak counts days with a post on the account's clock", () => {
  const rows = [
    row({ slug: "a", posted_at: "2026-11-10T15:00:00Z" }),
    row({ slug: "b", posted_at: "2026-11-11T15:00:00Z" }),
    row({ slug: "c", posted_at: "2026-11-13T15:00:00Z" }),
  ];
  assert.deepEqual(streak(rows, "2026-11-10", "2026-11-13", "America/Toronto"), { days: 4, withPost: 3 });
  // 03:30Z on 11-11 is still 11-10 in Toronto; two posts on one day count once
  const late = [row({ slug: "x", posted_at: "2026-11-11T03:30:00Z" }), row({ slug: "y", posted_at: "2026-11-10T15:00:00Z" }), row({ slug: "z", status: "failed", posted_at: "2026-11-12T15:00:00Z" })];
  assert.deepEqual(streak(late, "2026-11-10", "2026-11-12", "America/Toronto"), { days: 3, withPost: 1 });
  assert.throws(() => streak(rows, "2026-11-13", "2026-11-10", "America/Toronto"), /before/);
  assert.throws(() => streak(rows, "11-10", "2026-11-13", "America/Toronto"), /date/);
});

test("run norms, due, verdict, streak and followers read their files, and work without a benchmarks block", async () => {
  const dir = await mkdtemp(join(tmpdir(), "acct22-"));
  try {
    await mkdir(join(dir, "marketing"));
    await writeFile(join(dir, "marketing", "config.md"), configMd());
    await writeFile(join(dir, "marketing", "strategy.md"), "# Strategy\n\nno benchmarks yet\n");
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row({ slug: `r${i}`, type: "reach", posted_at: isoAt(T0 + i * DAY_MS), views_72h: String(1000), verdict: "" })),
      row({ slug: "target", type: "reach", posted_at: isoAt(T0 + 6 * DAY_MS), views_72h: "1500" }),
      row({ slug: "aw", type: "awareness", posted_at: "2026-11-10T14:00:00Z", views_7d: "2400" }),
    ];
    await writeFile(join(dir, "marketing", "ledger.csv"), ledgerText(rows));
    await writeFile(join(dir, "marketing", "account.csv"), "date,read_at,followers,gained_week,source\n2026-11-10,2026-11-10T13:00:00Z,38,,screen\n2026-11-12,2026-11-12T10:00:00Z,50,,screen\n");
    const { readFile } = await import("node:fs/promises");
    const deps = { readFile, now: () => new Date("2026-11-20T15:00:00Z") };
    const base = ["--dir", dir];
    const n = JSON.parse((await run(["norms", ...base], deps)).line);
    assert.equal(n.reach.value, 1000); // the 7 reach posts: median of 1000 x6 and 1500
    assert.equal(n.reach.source, "own");
    assert.equal(n.trust.value, null);
    const d = JSON.parse((await run(["due", ...base, "--now", "2026-11-13T09:00:00Z"], deps)).line);
    assert.ok(Array.isArray(d.due));
    // the verdict leaves the post itself out of its own norm: 6 others at 1000, so 1500 is above
    const v = JSON.parse((await run(["verdict", "target", ...base], deps)).line);
    assert.equal(v.verdict, "above");
    assert.equal(v.norm.value, 1000);
    assert.equal(v.norm.n, 6);
    assert.equal((await run(["verdict", "nope", ...base], deps)).code, 1);
    assert.equal((await run(["verdict", ...base], deps)).code, 1);
    const f = JSON.parse((await run(["followers", "aw", ...base], deps)).line);
    assert.deepEqual([f.gain, f.perThousand, f.follows_source, f.data], [12, 5, "estimate", "partial"]);
    const s = JSON.parse((await run(["streak", "--from", "2026-11-10", "--to", "2026-11-13", ...base], deps)).line);
    assert.deepEqual([s.days, s.withPost], [4, 1]);
    assert.equal((await run(["streak", "--from", "2026-11-10", ...base], deps)).code, 1);
    assert.equal((await run(["norms", "extra", ...base], deps)).code, 1);
    // an awareness verdict reads account.csv for the estimate
    const va = JSON.parse((await run(["verdict", "aw", ...base], deps)).line);
    assert.equal(va.data, "partial");
    assert.equal(va.value, 5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- stops

import { stops, dropRun } from "../skills/boqount/tools/account-state-lib.mjs";

// stops takes each type's views_72h median from the rows itself (norms gives views only for reach).
// A post's median is over its type's verdict-ready posts from before the run (the newest 10 not among the three).
const NOW24 = new Date("2026-11-20T15:00:00Z");
const GREEN = { funnel: "green", igRestricted: false };
// Six reach posts at 1,000 views (11-01..11-06): every later reach post's median is 1,000, so "under half" is under 500.
const BASE6 = Array.from({ length: 6 }, (_, i) => row({ slug: `base${i}`, type: "reach", planned_for: `2026-11-0${i + 1}`, posted_at: `2026-11-0${i + 1}T14:00:00Z`, views_72h: "1000" }));
const posted = (slug, day, views, extra = {}) => row({ slug, type: "reach", planned_for: `2026-11-${day}`, posted_at: `2026-11-${day}T14:00:00Z`, views_72h: views, ...extra });

test("stops on a red funnel", () => {
  const rows = [...BASE6, posted("calm", "14", "950")];
  assert.deepEqual(stops(rows, { funnel: "red", igRestricted: false }, NOW24), { stop: true, reasons: ["funnel red"] });
  // only red stops: yellow and green do not
  assert.deepEqual(stops(rows, { funnel: "yellow", igRestricted: false }, NOW24), { stop: false, reasons: [] });
  assert.deepEqual(stops(rows, GREEN, NOW24), { stop: false, reasons: [] });
});

test("stops on two consecutive caught checks", () => {
  // A caught post is held and never posts, so "in a row" is the checked posts' order: planned_for, then posted_at, then the ledger line.
  const caught1 = row({ slug: "c1", status: "held", posted_at: "", planned_for: "2026-11-17", check: "caught:claims" });
  const caught2 = row({ slug: "c2", status: "held", posted_at: "", planned_for: "2026-11-18", check: "caught:faces" });
  const passed = posted("p1", "18", "", { check: "pass" });
  const later = row({ slug: "p2", status: "checked", posted_at: "", planned_for: "2026-11-19", check: "pass" });
  assert.deepEqual(stops([...BASE6, caught1, caught2], GREEN, NOW24), { stop: true, reasons: ["two caught in a row"] });
  // caught, then pass: no stop
  assert.deepEqual(stops([...BASE6, caught1, passed], GREEN, NOW24), { stop: false, reasons: [] });
  // caught, pass, caught: not in a row
  assert.deepEqual(stops([...BASE6, caught1, passed, row({ slug: "c3", status: "held", posted_at: "", planned_for: "2026-11-19", check: "caught:hook" })], GREEN, NOW24), { stop: false, reasons: [] });
  // two caught, then a pass planned after them: the newest two are not both caught
  assert.deepEqual(stops([...BASE6, caught1, caught2, later], GREEN, NOW24), { stop: false, reasons: [] });
  // rows with no check (legacy `none`, empty) are not checks and do not break or make a run
  const legacy = row({ slug: "old", status: "legacy", type: "legacy", type_source: "legacy", planned_for: "", posted_at: "2026-10-30T14:00:00Z", check: "none", approval: "none" });
  assert.deepEqual(stops([legacy, caught1, row({ slug: "x", status: "planned", posted_at: "", planned_for: "2026-11-18", check: "" }), caught2], GREEN, NOW24), { stop: true, reasons: ["two caught in a row"] });
});

test("stops on three reach drops", () => {
  // The newest three verdict-ready posts (views_72h read, 72 h past) at 300, 400 and 450 against a median of 1,000.
  const three = [posted("d1", "14", "300"), posted("d2", "15", "400"), posted("d3", "16", "450")];
  // a post younger than 72 h (11-19) and one with no views_72h are not verdict-ready, so they don't break the run
  const young = posted("young", "19", "5000");
  const empty = posted("empty", "17", "");
  assert.deepEqual(stops([...BASE6, ...three, young, empty], GREEN, NOW24), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // the median is over the newest 10 others: fifteen October posts at 100 views don't pull it down
  const october = Array.from({ length: 15 }, (_, i) => posted(`oct${i}`, "01", "100", { planned_for: `2026-10-${String(i + 1).padStart(2, "0")}`, posted_at: `2026-10-${String(i + 1).padStart(2, "0")}T14:00:00Z` }));
  const base10 = [...BASE6, ...["07", "08", "09", "10"].map((d) => posted(`base${d}`, d, "1000"))];
  assert.deepEqual(stops([...october, ...base10, ...three], GREEN, NOW24), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // the rule needs three in a row: 300, 600, 450 is not (600 is over 500)
  const broken = [posted("d1", "14", "300"), posted("d2", "15", "600"), posted("d3", "16", "450")];
  assert.deepEqual(stops([...BASE6, ...broken], GREEN, NOW24), { stop: false, reasons: [] });
  // two drops are not three
  assert.deepEqual(stops([...BASE6, posted("d2", "15", "400"), posted("d3", "16", "450")], GREEN, NOW24), { stop: false, reasons: [] });
  // each post against ITS type's views median: an awareness post at 450 views is a drop against awareness posts at 2,000,
  // though it would not be against reach's 1,000 x 0.5
  // (the awareness median is 2,000 over its three posts before the run, 2,000, 2,000 and 400: the post itself is left out, or it would be 1,450)
  const aw = ["2000", "2000", "400"].map((v, i) => row({ slug: `aw${i}`, type: "awareness", planned_for: `2026-11-0${i + 7}`, posted_at: `2026-11-0${i + 7}T14:00:00Z`, views_72h: v }));
  const mixed = [posted("d1", "14", "300"), row({ slug: "awd", type: "awareness", planned_for: "2026-11-15", posted_at: "2026-11-15T14:00:00Z", views_72h: "900" }), posted("d3", "16", "450")];
  assert.deepEqual(stops([...BASE6, ...aw, ...mixed], GREEN, NOW24), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // the drops never lower their own norm: reach posts at 1,000, 700 and 1,000 before a run of 300, 400, 450 give a
  // median of 1,000 (with the other two drops in it, d2's median would be 700, and 400 is not under 350)
  const three3 = ["1000", "700", "1000"].map((v, i) => posted(`h${i}`, `0${i + 1}`, v));
  assert.deepEqual(stops([...three3, ...three], GREEN, NOW24), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // a type with fewer than 3 verdict-ready posts before the run (here trust: two at 1,000) falls back to the
  // pooled views_72h median of every earlier post (BASE6 and the two trust posts: 1,000), so its 10 views is a drop
  const trust2 = ["10", "11"].map((d) => row({ slug: `t${d}`, type: "trust", planned_for: `2026-11-${d}`, posted_at: `2026-11-${d}T14:00:00Z`, views_72h: "1000" }));
  const thin = [...trust2, posted("d1", "14", "300"), row({ slug: "t1", type: "trust", planned_for: "2026-11-15", posted_at: "2026-11-15T14:00:00Z", views_72h: "10" }), posted("d3", "16", "450")];
  assert.deepEqual(stops([...BASE6, ...thin], GREEN, NOW24), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // and with fewer than 3 earlier posts in all, there is no baseline: no drop
  assert.deepEqual(stops([...BASE6.slice(0, 2), posted("d1", "14", "1"), posted("d2", "15", "1"), posted("d3", "16", "1")], GREEN, NOW24), { stop: false, reasons: [] });
});

test("stops falls back to the pooled median for a thin type", () => {
  // three posts at 10% of the norm, the middle one a sale post with a single earlier sale post: still a run of three
  const saleb = row({ slug: "saleb", type: "sale", planned_for: "2026-11-07", posted_at: "2026-11-07T14:00:00Z", views_72h: "1000" });
  const run3 = [posted("d1", "14", "100"), row({ slug: "d2", type: "sale", planned_for: "2026-11-15", posted_at: "2026-11-15T14:00:00Z", views_72h: "100" }), posted("d3", "16", "100")];
  assert.deepEqual(stops([...BASE6, saleb, ...run3], GREEN, NOW24), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // the detail names each post, its views and its baseline, and where the baseline came from
  assert.deepEqual(dropRun([...BASE6, saleb, ...run3], NOW24).run, [
    { slug: "d3", type: "reach", views_72h: 100, baseline: 1000, basis: "type", drop: true },
    { slug: "d2", type: "sale", views_72h: 100, baseline: 1000, basis: "pooled", drop: true },
    { slug: "d1", type: "reach", views_72h: 100, baseline: 1000, basis: "type", drop: true },
  ]);
});

test("stops does not count caught:funnel holds as check catches", () => {
  // two sale posts held by a red funnel, and the funnel green again: no stop
  const s1 = row({ slug: "sale1", type: "sale", status: "held", posted_at: "", planned_for: "2026-11-19", check: "caught:funnel" });
  const s2 = row({ slug: "sale2", type: "sale", status: "held", posted_at: "", planned_for: "2026-11-20", check: "caught:funnel" });
  assert.deepEqual(stops([...BASE6, s1, s2], GREEN, NOW24), { stop: false, reasons: [] });
  // and they do not break a run of two real catches around them
  const c1 = row({ slug: "c1", status: "held", posted_at: "", planned_for: "2026-11-17", check: "caught:claims" });
  const c2 = row({ slug: "c2", status: "held", posted_at: "", planned_for: "2026-11-18", check: "caught:faces" });
  assert.deepEqual(stops([...BASE6, c1, c2, s1, s2], GREEN, NOW24), { stop: true, reasons: ["two caught in a row"] });
});

test("ledgerRows accepts what the day makes (film, clips, file, slideshow, recording) and an older ledger's tiers", () => {
  for (const tier of ["film", "clips", "file", "slideshow", "recording", "1", "2", "3", "4", "stock"]) {
    assert.equal(ledgerRows(ledgerText([row({ slug: `kind-${tier}`, tier })])).length, 1, tier);
  }
  assert.throws(() => ledgerRows(ledgerText([row({ slug: "kind-bad", tier: "reel" })])), /ledger line 2: tier reel/);
  assert.throws(() => ledgerRows(ledgerText([row({ slug: "kind-story", tier: "story" })])), /ledger line 2: tier story/, "a story has no ledger row");
});

test("stops does not count a hold that waits on the human as a check catch", () => {
  const w1 = row({ slug: "w1", status: "held", posted_at: "", planned_for: "2026-11-19", check: "caught:AI label test owed" });
  const w2 = row({ slug: "w2", status: "held", posted_at: "", planned_for: "2026-11-20", check: "caught:AI label test owed" });
  assert.deepEqual(stops([...BASE6, w1, w2], GREEN, NOW24), { stop: false, reasons: [] });
  // a rule the check caught still counts, next to one
  const c1 = row({ slug: "c1", status: "held", posted_at: "", planned_for: "2026-11-17", check: "caught:claims" });
  const c2 = row({ slug: "c2", status: "held", posted_at: "", planned_for: "2026-11-18", check: "caught:faces" });
  assert.deepEqual(stops([...BASE6, c1, c2, w1, w2], GREEN, NOW24), { stop: true, reasons: ["two caught in a row"] });
});

test("stops --since counts a drop run only among posts after a resume", () => {
  const three = [posted("d1", "14", "300"), posted("d2", "15", "400"), posted("d3", "16", "450")];
  // resumed after the three: they no longer stop auto
  assert.deepEqual(stops([...BASE6, ...three], GREEN, NOW24, { since: new Date("2026-11-16T20:00:00Z") }), { stop: false, reasons: [] });
  // resumed between d1 and d2: two drops after it are not three
  assert.deepEqual(stops([...BASE6, ...three], GREEN, NOW24, { since: new Date("2026-11-14T20:00:00Z") }), { stop: false, reasons: [] });
  // resumed before the three: they stop it
  assert.deepEqual(stops([...BASE6, ...three], GREEN, NOW24, { since: new Date("2026-11-13T20:00:00Z") }), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // since never touches the other reasons
  assert.deepEqual(stops([...BASE6, ...three], { funnel: "red", igRestricted: true }, NOW24, { since: new Date("2026-11-19T00:00:00Z") }), { stop: true, reasons: ["funnel red", "instagram restricted"] });
});


test("stops when Instagram restricted the account", () => {
  const rows = [...BASE6, posted("calm", "14", "950")];
  assert.deepEqual(stops(rows, { funnel: "green", igRestricted: true }, NOW24), { stop: true, reasons: ["instagram restricted"] });
});

test("stops lists every reason that holds, in the fixed order", () => {
  const rows = [
    ...BASE6, posted("d1", "14", "300"), posted("d2", "15", "400"), posted("d3", "16", "450"),
    row({ slug: "c1", status: "held", posted_at: "", planned_for: "2026-11-17", check: "caught:claims" }),
    row({ slug: "c2", status: "held", posted_at: "", planned_for: "2026-11-18", check: "caught:faces" }),
  ];
  assert.deepEqual(stops(rows, { funnel: "red", igRestricted: true }, NOW24), {
    stop: true,
    reasons: ["funnel red", "two caught in a row", "reach under half the norm three in a row", "instagram restricted"],
  });
});

test("does not stop otherwise", () => {
  // Six reach posts at 1,000; the newest three at 900, 800 and 1,100 (none under 500); a caught post, then a pass;
  // a green funnel; the account not restricted.
  const rows = [
    ...BASE6,
    posted("n1", "14", "900"), posted("n2", "15", "800"),
    row({ slug: "held1", status: "held", posted_at: "", planned_for: "2026-11-16", check: "caught:claims" }),
    posted("n3", "16", "1100"),
  ];
  assert.deepEqual(stops(rows, { funnel: "green", igRestricted: false }, NOW24), { stop: false, reasons: [] });
});

test("run stops reads the ledger and takes --funnel and --restricted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "acct24-"));
  try {
    await mkdir(join(dir, "marketing"));
    await writeFile(join(dir, "marketing", "config.md"), configMd({ autopost: "auto" }));
    await writeFile(join(dir, "marketing", "ledger.csv"), ledgerText([...BASE6, posted("d1", "14", "300"), posted("d2", "15", "400"), posted("d3", "16", "450")]));
    const { readFile } = await import("node:fs/promises");
    const deps = { readFile, now: () => NOW24 };
    const base = ["--dir", dir];
    const r = await run(["stops", ...base, "--funnel", "green", "--restricted", "no"], deps);
    assert.equal(r.code, 0);
    const out = JSON.parse(r.line);
    assert.deepEqual([out.stop, out.reasons, out.funnel, out.igRestricted, out.since], [true, ["reach under half the norm three in a row"], "green", false, null]);
    // the run is printed with each post's views and baseline, for the stop message
    assert.deepEqual(out.run.map((x) => [x.slug, x.views_72h, x.baseline, x.basis]), [["d3", 450, 1000, "type"], ["d2", 400, 1000, "type"], ["d1", 300, 1000, "type"]]);
    // --since, and resumed_at in config.md, move the run's start
    const since = JSON.parse((await run(["stops", ...base, "--funnel", "green", "--restricted", "no", "--since", "2026-11-16T20:00:00Z"], deps)).line);
    assert.deepEqual([since.stop, since.since], [false, "2026-11-16T20:00:00.000Z"]);
    await writeFile(join(dir, "marketing", "config.md"), configMd({ autopost: "auto", resumed_at: "2026-11-16T20:00:00Z" }));
    const cfgSince = JSON.parse((await run(["stops", ...base, "--funnel", "green", "--restricted", "no"], deps)).line);
    assert.deepEqual([cfgSince.stop, cfgSince.since], [false, "2026-11-16T20:00:00.000Z"]);
    assert.equal((await run(["stops", ...base, "--funnel", "green", "--restricted", "no", "--since", "2026-11-16"], deps)).code, 1);
    await writeFile(join(dir, "marketing", "config.md"), configMd({ autopost: "auto" }));
    const red = JSON.parse((await run(["stops", ...base, "--funnel", "red", "--restricted", "yes"], deps)).line);
    assert.deepEqual(red.reasons, ["funnel red", "reach under half the norm three in a row", "instagram restricted"]);
    // --now moves the 72 h line: at 11-17 15:00Z d3 (11-16) is not verdict-ready, so only two drops count
    const early = JSON.parse((await run(["stops", ...base, "--funnel", "green", "--restricted", "no", "--now", "2026-11-17T15:00:00Z"], deps)).line);
    assert.deepEqual([early.stop, early.reasons], [false, []]);
    // both flags are required, and take only their values
    assert.equal((await run(["stops", ...base, "--restricted", "no"], deps)).code, 1);
    assert.equal((await run(["stops", ...base, "--funnel", "green"], deps)).code, 1);
    assert.equal((await run(["stops", ...base, "--funnel", "amber", "--restricted", "no"], deps)).code, 1);
    assert.equal((await run(["stops", ...base, "--funnel", "green", "--restricted", "maybe"], deps)).code, 1);
    // the flags belong to stops only
    assert.equal((await run(["due", ...base, "--funnel", "red"], deps)).code, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- hardening

test("run mode refuses a posted row without a usable posted_at", async () => {
  const files = {
    "/r/marketing/config.md": configMd(),
    "/r/marketing/ledger.csv": ledgerText([row({ slug: "a", status: "posted", posted_at: "" })]),
  };
  const deps = { readFile: async (p) => { if (p in files) return files[p]; const e = new Error("no"); e.code = "ENOENT"; throw e; }, now: () => new Date("2026-11-10T12:30:00Z"), root: "/r" };
  const empty = await run(["mode"], deps);
  assert.equal(empty.code, 1);
  assert.match(JSON.parse(empty.line).error, /ledger line 2: posted_at is empty on a posted row/);
  // A bare time would be read in the Mac's zone by anything downstream.
  files["/r/marketing/ledger.csv"] = ledgerText([row({ slug: "a", status: "posted", posted_at: "2026-11-09 09:00" })]);
  const bad = await run(["mode"], deps);
  assert.equal(bad.code, 1);
  assert.match(JSON.parse(bad.line).error, /ledger line 2: posted_at 2026-11-09 09:00/);
  // A bad instant is wrong on any row that fills it, a legacy one too.
  files["/r/marketing/ledger.csv"] = ledgerText([row({ slug: "a", status: "legacy", type: "legacy", posted_at: "yesterday" })]);
  assert.equal((await run(["mode"], deps)).code, 1);
  // A row that has not posted has no posted_at, and a posted row with one is fine.
  files["/r/marketing/ledger.csv"] = ledgerText([row({ slug: "a", status: "scheduled", posted_at: "" }), row({ slug: "b", status: "posted", posted_at: "2026-11-09T14:00:00Z" })]);
  assert.equal((await run(["mode"], deps)).code, 0);
});

test("stops does not count caught:G2 owed holds as check catches", () => {
  const g1 = row({ slug: "g1", status: "held", posted_at: "", planned_for: "2026-11-19", check: "caught:G2 owed (gate 2)" });
  const g2 = row({ slug: "g2", status: "held", posted_at: "", planned_for: "2026-11-20", check: "caught:G2 owed" });
  assert.deepEqual(stops([...BASE6, g1, g2], GREEN, NOW24), { stop: false, reasons: [] });
  // Neither does it hide a real pair of catches around it.
  const c1 = row({ slug: "c1", status: "held", posted_at: "", planned_for: "2026-11-18", check: "caught:claims" });
  const c2 = row({ slug: "c2", status: "held", posted_at: "", planned_for: "2026-11-21", check: "caught:hook" });
  assert.deepEqual(stops([...BASE6, c1, g1, c2], GREEN, NOW24), { stop: true, reasons: ["two caught in a row"] });
});

// ---------------------------------------------------------------- kpi (the account's week against its targets)

const KPI_NOW = new Date("2026-11-30T12:30:00Z");
const post = (slug, at, o = {}) => row({ slug, posted_at: at, segment: "creators", rubric: "clips-demo", ...o });
// Three weeks of posts: W46 (11-09..15), W47 (11-16..22, the judged week on a 11-30 roll-up) and W48 (11-23..29, interim).
const KPI_LEDGER = ledgerRows(ledgerText([
  post("a46", "2026-11-10T14:00:00Z", { views_7d: "400", utm_campaign: "clips-demo-20261110" }),
  post("b46", "2026-11-12T14:00:00Z", { views_7d: "600", type: "sale", rubric: "clips-offer", segment: "backlog", utm_campaign: "clips-offer-20261112" }),
  post("a47", "2026-11-17T14:00:00Z", { views_7d: "1000", utm_campaign: "clips-demo-20261117" }),
  post("b47", "2026-11-19T14:00:00Z", { views_72h: "500", type: "sale", rubric: "clips-offer", segment: "backlog", utm_campaign: "clips-offer-20261119" }),
  post("c47", "2026-11-21T14:00:00Z", { views_24h: "0" }),
  post("a48", "2026-11-24T14:00:00Z", { views_72h: "300", utm_campaign: "clips-demo-20261124" }),
  row({ slug: "queued", status: "scheduled", posted_at: "", utm_campaign: "clips-demo-20261201" }),
]));
const reading = (day, followers) => ({ date: day, read_at: `${day}T12:41:00Z`, followers: String(followers), gained_week: "", source: "get_analytics" });
const KPI_ACCOUNT = [reading("2026-11-08", 40), reading("2026-11-15", 44), reading("2026-11-22", 50), reading("2026-11-29", 57)];
const camp = (signups, activated, buyers) => ({ source: "instagram", medium: "dm", signups, activated, buyers });
const KPI_CAMPAIGNS = {
  days: 70,
  readAt: "2026-11-30T12:31:00.000Z",
  total: 20,
  byDay: { "2026-11-17": 2, "2026-11-20": 3, "2026-11-25": 1 },
  byCampaign: {
    "-": camp(9, 3, 1),
    "funnel-probe": camp(4, 0, 0),
    "clips-demo-20261110": camp(1, 1, 0),
    "clips-offer-20261112": camp(1, 0, 0),
    "clips-demo-20261117": camp(2, 1, 0),
    "clips-offer-20261119": camp(2, 1, 1),
    "clips-demo-20261124": camp(1, 0, 0),
    "old-link-20261001": camp(3, 1, 1),
  },
};
const KPI_BUDGET = [{ date: "2026-11-18", slug: "b47", service: "fal", usd: "3", credits: "0", note: "" }, { date: "2026-11-25", slug: "a48", service: "fal", usd: "9", credits: "0", note: "" }];
const kpiRun = (over = {}) => kpi({
  ledger: KPI_LEDGER, account: KPI_ACCOUNT, budgetRows: KPI_BUDGET, campaigns: KPI_CAMPAIGNS, targets: {}, config: cfg(),
  from: "2026-11-23", to: "2026-11-29", now: KPI_NOW, ...over,
});
const row9 = (out, name) => out.kpis.find((k) => k.kpi === name);

test("kpiTargets keeps only known KPIs with a number, a source and a date", () => {
  const md = [
    "```kpi",
    "views_per_post | 580 | Socialinsider 2026, 1K-5K brand accounts, average Reel views | 2026-02-20",
    "activation_pct | 40 | | 2026-01-01",
    "buyer_pct_28d | about 3 | a study | 2026-01-01",
    "likes_week | 10 | a study | 2026-01-01",
    "signups_week | 2 | ours | yesterday",
    "follows_per_1000_views | 5 | a study of small accounts | 2026-05-01",
    "```",
  ].join("\n");
  assert.deepEqual(kpiTargets(md), {
    views_per_post: { value: 580, source: "Socialinsider 2026, 1K-5K brand accounts, average Reel views", date: "2026-02-20" },
    follows_per_1000_views: { value: 5, source: "a study of small accounts", date: "2026-05-01" },
  });
  assert.deepEqual(kpiTargets("no block"), {});
});

test("parseConfig reads sales_goal_28d as a number, empty as null", () => {
  assert.equal(cfg().sales_goal_28d, null);
  assert.equal(cfg({ sales_goal_28d: "5" }).sales_goal_28d, 5);
  assert.throws(() => cfg({ sales_goal_28d: "five" }), /sales_goal_28d/);
});

test("kpi judges the week before the one that ended, and shows the ended week without verdicts", () => {
  const out = kpiRun();
  assert.equal(out.judged.week, "2026-W47");
  assert.deepEqual([out.judged.from, out.judged.to], ["2026-11-16", "2026-11-22"]);
  assert.equal(out.interim.week, "2026-W48");
  assert.equal(out.interim.views, 300);
  assert.equal(out.interim.posts, 1);
  assert.ok(!("verdict" in out.interim), "an open week gets no verdict");
  assert.equal(out.kpis.length, 9);
  assert.deepEqual(out.kpis.map((k) => k.stage), ["reach", "reach", "followers", "followers", "conversion", "conversion", "conversion", "sales", "sales"]);
});

test("kpi sums the judged week: views at each post's newest read, followers from account.csv, sign-ups under the week's own campaigns", () => {
  const out = kpiRun();
  assert.equal(row9(out, "views_week").value, 1500, "1000 at 7 d + 500 at 72 h + 0 at 24 h: each post at its newest read");
  assert.equal(row9(out, "views_per_post").value, 500, "over the three posts that have a read");
  assert.deepEqual(out.judged.reads, { posts: 3, withViews: 3, at7d: 1 });
  const unread = kpiRun({ ledger: KPI_LEDGER.map((r) => (r.slug === "c47" ? { ...r, views_24h: "" } : r)) });
  assert.deepEqual(unread.judged.reads, { posts: 3, withViews: 2, at7d: 1 }, "a post with no read adds nothing and is counted apart");
  assert.equal(row9(out, "followers_gained_week").value, 6, "50 on 11-22 against 44 on 11-15");
  assert.equal(row9(out, "follows_per_1000_views").value, 4);
  assert.equal(row9(out, "signups_week").value, 4, "2 + 2: never the untagged bucket, the probe or another week's campaign");
  assert.equal(row9(out, "signups_per_1000_views").value, 2.67);
  assert.equal(out.judged.signupsAll, 5, "byDay over the week's dates, every source");
  assert.deepEqual(out.judged.spend, { usd: 3, credits: 0 });
  assert.equal(out.judged.costPerSignup, 0.75);
});

test("kpi counts buyers over the 28 days that end with the judged week", () => {
  const out = kpiRun();
  assert.deepEqual([out.sales.from, out.sales.to], ["2026-10-26", "2026-11-22"]);
  assert.equal(row9(out, "buyers_28d").value, 1);
  assert.equal(row9(out, "buyer_pct_28d").value, 16.67, "1 buyer of 6 sign-ups under the window's four campaigns");
  assert.equal(row9(out, "activation_pct_28d").value, 50, "3 activated of the same 6 sign-ups");
  assert.deepEqual(out.sales.untagged, { signups: 9, activated: 3, buyers: 1 });
  assert.deepEqual(out.sales.otherCampaigns, { signups: 3, activated: 1, buyers: 1 }, "a campaign no ledger row carries; the probe is left out");
});

test("kpi groups what sold by path: the segment and rubric of the post that carried the campaign", () => {
  const out = kpiRun();
  assert.deepEqual(out.sales.paths, [
    { segment: "backlog", rubric: "clips-offer", posts: 2, views: 1100, signups: 3, activated: 1, buyers: 1 },
    { segment: "creators", rubric: "clips-demo", posts: 3, views: 1400, signups: 3, activated: 2, buyers: 0 },
  ]);
});

test("kpi takes a sourced standard as the target, else our own median of the weeks before", () => {
  const targets = { views_per_post: { value: 1000, source: "a study", date: "2026-02-20" } };
  const out = kpiRun({ targets });
  assert.deepEqual(
    (({ target, basis, source, date, ratio, verdict }) => ({ target, basis, source, date, ratio, verdict }))(row9(out, "views_per_post")),
    { target: 1000, basis: "standard", source: "a study", date: "2026-02-20", ratio: 0.5, verdict: "below" },
  );
  // One week before the judged one has values (W46): one week is not a baseline.
  assert.equal(row9(out, "views_week").target, null);
  assert.equal(row9(out, "views_week").verdict, "no-data");
  assert.match(row9(out, "views_week").why, /no standard.*fewer than 2 earlier weeks/);
});

test("kpi falls back to our own baseline once two earlier weeks have a value, and reads the trend against it", () => {
  const ledger = ledgerRows(ledgerText([
    post("a45", "2026-11-03T14:00:00Z", { views_7d: "200" }),
    post("a46", "2026-11-10T14:00:00Z", { views_7d: "400" }),
    post("a47", "2026-11-17T14:00:00Z", { views_7d: "1000" }),
  ]));
  const out = kpiRun({ ledger });
  const v = row9(out, "views_week");
  assert.deepEqual([v.value, v.baseline, v.baselineWeeks, v.target, v.basis, v.ratio, v.verdict, v.trend], [1000, 300, 2, 300, "own", 3.33, "above", "up"]);
  assert.deepEqual([v.prev, v.belowRun], [400, 0]);
});

test("kpi counts a second roll-up below the same target", () => {
  const t = (value) => ({ targets: { views_per_post: { value, source: "s", date: "2026-01-01" } } });
  // Judged W47 reads 500 a post; the week before it (W46) read 500 too.
  assert.deepEqual([row9(kpiRun(t(1000)), "views_per_post").prev, row9(kpiRun(t(1000)), "views_per_post").belowRun], [500, 2]);
  assert.equal(row9(kpiRun(t(600)), "views_per_post").belowRun, 0, "500 of 600 is within the band");
  assert.equal(row9(kpiRun(t(1000), ), "follows_per_1000_views").belowRun, 0, "no target, no run");
  const firstBelow = kpiRun({ ...t(1000), ledger: KPI_LEDGER.filter((r) => !r.slug.endsWith("46")) });
  assert.equal(row9(firstBelow, "views_per_post").belowRun, 1, "nothing to compare one roll-up ago");
});

test("kpi names the constraint: the rate furthest below its target, the earlier stage on a tie", () => {
  const targets = {
    views_per_post: { value: 1000, source: "s", date: "2026-01-01" }, // 500 / 1000 = 0.5
    follows_per_1000_views: { value: 8, source: "s", date: "2026-01-01" }, // 4 / 8 = 0.5
    signups_per_1000_views: { value: 2, source: "s", date: "2026-01-01" }, // 2.67 / 2 = above
    activation_pct_28d: { value: 60, source: "s", date: "2026-01-01" }, // 50 / 60 = 0.83, within
  };
  const out = kpiRun({ targets });
  assert.deepEqual(out.constraint, { kpi: "views_per_post", stage: "reach", ratio: 0.5 });
  const later = kpiRun({ targets: { ...targets, follows_per_1000_views: { value: 16, source: "s", date: "2026-01-01" } } });
  assert.deepEqual(later.constraint, { kpi: "follows_per_1000_views", stage: "followers", ratio: 0.25 }, "the lowest ratio wins, whatever its stage");
  const none = kpiRun({ targets: { views_per_post: { value: 500, source: "s", date: "2026-01-01" } } });
  assert.equal(none.constraint, null, "no rate below its target");
});

test("kpi leaves a KPI blind, with the reason, rather than writing a zero", () => {
  const out = kpiRun({ campaigns: null });
  for (const name of ["signups_week", "signups_per_1000_views", "activation_pct_28d", "buyers_28d", "buyer_pct_28d"]) {
    assert.equal(row9(out, name).value, null, name);
    assert.match(row9(out, name).why, /no campaigns reply/);
  }
  const short = kpiRun({ campaigns: { ...KPI_CAMPAIGNS, days: 10 } });
  assert.match(row9(short, "signups_week").why, /covers 10 days/);
  const noReading = kpiRun({ account: [reading("2026-11-01", 40), reading("2026-11-22", 50)] });
  assert.equal(row9(noReading, "followers_gained_week").value, null);
  assert.match(row9(noReading, "followers_gained_week").why, /no follower reading/);
  assert.ok(out.blind.includes("signups_week"));
});

test("kpi gives a rate over too little its value and no verdict, and never makes it the constraint", () => {
  const targets = { activation_pct_28d: { value: 90, source: "s", date: "2026-01-01" }, views_per_post: { value: 5000, source: "s", date: "2026-01-01" } };
  // Two sign-ups in 28 days, and one post with a read in the judged week.
  const out = kpiRun({
    targets,
    ledger: KPI_LEDGER.filter((r) => r.slug === "a47"),
    campaigns: { ...KPI_CAMPAIGNS, byCampaign: { "clips-demo-20261117": camp(2, 1, 0) } },
  });
  const fp = row9(out, "activation_pct_28d");
  assert.deepEqual([fp.value, fp.target, fp.verdict, fp.ratio], [50, 90, "no-data", null]);
  assert.match(fp.why, /thin: 2 sign-ups, a rate needs 5/);
  assert.match(row9(out, "views_per_post").why, /thin: 1 posts with a view count, a rate needs 3/);
  assert.deepEqual(out.thin, ["views_per_post", "activation_pct_28d", "buyer_pct_28d"]);
  assert.equal(out.constraint, null);
  assert.deepEqual(out.blind, [], "thin is not blind");
});

test("kpi takes the human's sales goal as the buyers target and plans back from it", () => {
  const out = kpiRun({ config: cfg({ sales_goal_28d: "3" }) });
  const b = row9(out, "buyers_28d");
  assert.deepEqual([b.target, b.basis, b.ratio, b.verdict], [3, "goal", 0.33, "below"]);
  // 28 days to 11-22: 1 buyer of 6 sign-ups, 6 sign-ups on 2500 views, 2500 views over 5 read posts.
  assert.deepEqual(out.backplan, { goal: 3, buyers: 1, needSignups: 18, needViews: 7500, needPosts: 15, capacityPosts: 56, feasible: true });
  assert.equal(kpiRun().backplan, null, "no goal, no plan back");
  const zero = kpiRun({ config: cfg({ sales_goal_28d: "3" }), campaigns: { ...KPI_CAMPAIGNS, byCampaign: { "-": camp(9, 3, 1) } } });
  assert.equal(zero.backplan.needSignups, null);
  assert.match(zero.backplan.why, /buyer_pct_28d/);
});

test("kpi needs a 7-day window on the account's clock", () => {
  assert.throws(() => kpiRun({ from: "2026-11-23", to: "2026-11-30" }), /7-day/);
  assert.throws(() => kpiRun({ from: "23-11-2026", to: "2026-11-29" }), /YYYY-MM-DD/);
});

test("run kpi reads its files and the saved campaigns reply", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kpi-"));
  try {
    await mkdir(join(dir, "marketing"), { recursive: true });
    await writeFile(join(dir, "marketing", "config.md"), configMd({ sales_goal_28d: "3" }));
    await writeFile(join(dir, "marketing", "ledger.csv"), ledgerText([post("a47", "2026-11-17T14:00:00Z", { views_7d: "1000", utm_campaign: "clips-demo-20261117" })]));
    await writeFile(join(dir, "marketing", "account.csv"), "date,read_at,followers,gained_week,source\n2026-11-15,2026-11-15T12:41:00Z,44,,get_analytics\n2026-11-22,2026-11-22T12:41:00Z,50,,get_analytics\n");
    await writeFile(join(dir, "marketing", "strategy.md"), "```kpi\nfollows_per_1000_views | 5 | a study | 2026-02-20\n```\n");
    await writeFile(join(dir, "campaigns.json"), JSON.stringify(KPI_CAMPAIGNS));
    const deps = { readFile: (p, e) => import("node:fs/promises").then((fs) => fs.readFile(p, e)), now: () => KPI_NOW, root: dir };
    const good = await run(["kpi", "--from", "2026-11-23", "--to", "2026-11-29", "--campaigns", join(dir, "campaigns.json")], deps);
    assert.equal(good.code, 0, good.line);
    const out = JSON.parse(good.line);
    assert.equal(out.judged.week, "2026-W47");
    assert.equal(out.kpis.find((k) => k.kpi === "follows_per_1000_views").verdict, "within", "6 follows on 1,000 views against 5");
    assert.equal(out.kpis.find((k) => k.kpi === "signups_week").value, 2);
    assert.deepEqual(out.standards, { block: true, rows: 1 });
    const bare = await run(["kpi", "--from", "2026-11-23", "--to", "2026-11-29"], deps);
    assert.equal(bare.code, 0, "no --campaigns: the conversion and sales KPIs are blind, not an error");
    assert.equal(JSON.parse(bare.line).kpis.find((k) => k.kpi === "signups_week").value, null);
    await writeFile(join(dir, "marketing", "strategy.md"), "# no standards yet\n");
    assert.deepEqual(JSON.parse((await run(["kpi", "--from", "2026-11-23", "--to", "2026-11-29"], deps)).line).standards, { block: false, rows: 0 });
    assert.equal((await run(["kpi"], deps)).code, 1, "kpi needs --from and --to");
    assert.equal((await run(["norms", "--campaigns", "x"], deps)).code, 1, "--campaigns applies to kpi only");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- channels

import { CHANNELS, channelConfig, scopeRows } from "../skills/boqount/tools/account-state-lib.mjs";

// The fictional brand Quillfern on three channels; the ledger has `channel` as its second column (the template's).
const QF = { brand: "quillfern", channels: "instagram, tiktok, youtube", account_id: "qf-ig", "account_id@tiktok": "qf-tt", timezone: "America/Toronto" };
const HEADER_CH = [HEADER[0], "channel", ...HEADER.slice(1)];
const ledgerTextCh = (rows) => [HEADER_CH.join(","), ...rows.map((o) => HEADER_CH.map((h) => o[h] ?? "").join(","))].join("\n") + "\n";
async function quillfern(config, files) {
  const dir = await mkdtemp(join(tmpdir(), "quillfern-"));
  await mkdir(join(dir, "marketing"));
  await writeFile(join(dir, "marketing", "config.md"), configMd(config));
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, "marketing", name), text);
  const { readFile } = await import("node:fs/promises");
  const call = async (...argv) => {
    const res = await run([...argv, "--dir", dir], { readFile, now: () => new Date("2026-11-10T15:30:00Z") });
    return { code: res.code, out: JSON.parse(res.line) };
  };
  return { dir, call, done: () => rm(dir, { recursive: true, force: true }) };
}

test("parseConfig reads channels in order and defaults to instagram", () => {
  assert.deepEqual(CHANNELS, ["instagram", "tiktok", "youtube"]);
  assert.deepEqual(cfg({ channels: "YouTube, tiktok, Instagram" }).channels, ["youtube", "tiktok", "instagram"]);
  assert.deepEqual(cfg({ channels: "tiktok" }).channels, ["tiktok"]);
  assert.deepEqual(cfg({ channels: "" }).channels, ["instagram"]);
  assert.deepEqual(parseConfig(configMd().replace(/^channels:.*\n/m, "")).channels, ["instagram"]);
});

test("parseConfig refuses an unknown or repeated channel", () => {
  assert.throws(() => cfg({ channels: "instagram, facebook" }), /^Error: config channels: "facebook" is not one of instagram, tiktok, youtube$/);
  assert.throws(() => cfg({ channels: "instagram, tiktok, Instagram" }), /^Error: config channels: "instagram" is not one of instagram, tiktok, youtube$/);
});

test("parseConfig reads account_id@tiktok, windows@youtube and max_posts_per_day@tiktok into per", () => {
  const c = cfg({ ...QF, "windows@youtube": "07:00-08:00, 12:00-13:00", "max_posts_per_day@tiktok": "1", "account_id@youtube": "", "# windows@tiktok": "a commented line is not read" });
  assert.deepEqual(c.channels, ["instagram", "tiktok", "youtube"]);
  assert.deepEqual(c.per, {
    instagram: {},
    tiktok: { account_id: "qf-tt", max_posts_per_day: 1 },
    youtube: { windows: [{ from: "07:00", to: "08:00" }, { from: "12:00", to: "13:00" }] },
  });
  // the plain keys stay as they were
  assert.equal(c.account_id, "qf-ig");
  assert.equal(c.max_posts_per_day, 2);
  assert.deepEqual(c.windows, [{ from: "09:00", to: "11:00" }, { from: "18:00", to: "20:00" }]);
});

test("parseConfig refuses key@channel for another key or an unlisted channel", () => {
  assert.throws(() => cfg({ ...QF, "timezone@tiktok": "Europe/Berlin" }), /^Error: config timezone@tiktok: /);
  assert.throws(() => cfg({ ...QF, channels: "instagram, tiktok", "windows@youtube": "07:00-08:00" }), /^Error: config windows@youtube: /);
  assert.throws(() => cfg({ ...QF, "windows@tiktok": "7 to 8" }), /^Error: config windows@tiktok: /);
  assert.throws(() => cfg({ ...QF, "max_posts_per_day@tiktok": "3" }), /^Error: config max_posts_per_day@tiktok /);
});

test("parseConfig ignores an empty key@channel line for a channel that is not listed", () => {
  const c = cfg({ ...QF, channels: "instagram", "account_id@tiktok": "", "account_id@youtube": "" });
  assert.deepEqual(c.channels, ["instagram"]);
  assert.deepEqual(c.per, { instagram: {} });
  assert.equal(c.account_id, "qf-ig");
  // a value for an unlisted channel is still refused
  assert.throws(() => cfg({ ...QF, channels: "instagram", "account_id@tiktok": "qf-tt" }), /^Error: config account_id@tiktok: "tiktok" is not in channels/);
});

test("channelConfig overrides only what the channel sets", () => {
  const c = cfg({ ...QF, "windows@youtube": "07:00-08:00", "max_posts_per_day@tiktok": "1" });
  const tt = channelConfig(c, "tiktok");
  assert.deepEqual([tt.channel, tt.account_id, tt.max_posts_per_day, tt.windows], ["tiktok", "qf-tt", 1, c.windows]);
  const yt = channelConfig(c, "youtube");
  // a later channel with no account_id@<channel> has no boqo account (null), not the first channel's
  assert.deepEqual([yt.channel, yt.account_id, yt.max_posts_per_day, yt.windows], ["youtube", null, 2, [{ from: "07:00", to: "08:00" }]]);
  const ig = channelConfig(c, "instagram");
  assert.deepEqual([ig.channel, ig.account_id, ig.max_posts_per_day, ig.windows], ["instagram", "qf-ig", 2, c.windows]);
  assert.equal(tt.timezone, "America/Toronto");
  assert.equal(c.channel, undefined, "the whole config is left as it was");
  assert.equal(c.account_id, "qf-ig");
});

test("scopeRows gives legacy rows to the first channel only", () => {
  const rows = [{ slug: "nib-empty", channel: "" }, { slug: "ink-tt", channel: "tiktok" }, { slug: "nib-none" }, { slug: "ink-ig", channel: "instagram" }];
  const slugs = (config, ch) => scopeRows(rows, config, ch).map((r) => r.slug);
  const igFirst = cfg({ channels: "instagram, tiktok" });
  assert.deepEqual(slugs(igFirst, "instagram"), ["nib-empty", "nib-none", "ink-ig"]);
  assert.deepEqual(slugs(igFirst, "tiktok"), ["ink-tt"]);
  const ttFirst = cfg({ channels: "tiktok, instagram" });
  assert.deepEqual(slugs(ttFirst, "tiktok"), ["nib-empty", "ink-tt", "nib-none"]);
  assert.deepEqual(slugs(ttFirst, "instagram"), ["ink-ig"]);
});

test("ledgerRows refuses a slug listed twice for one channel and allows it once per channel", () => {
  const each = ledgerRows(ledgerTextCh(["instagram", "tiktok", "youtube"].map((channel) => row({ slug: "fern-tip", channel }))));
  assert.deepEqual(each.map((r) => r.channel), ["instagram", "tiktok", "youtube"]);
  const twice = ledgerTextCh([row({ slug: "fern-tip", channel: "tiktok" }), row({ slug: "fern-tip", channel: "instagram" }), row({ slug: "fern-tip", channel: "tiktok" })]);
  assert.throws(() => ledgerRows(twice), /^Error: ledger line 4: fern-tip is listed twice for tiktok$/);
  // an empty channel is one value, with or without the column
  assert.throws(() => ledgerRows(ledgerTextCh([row({ slug: "fern-tip" }), row({ slug: "fern-tip" })])), /^Error: ledger line 3: fern-tip is listed twice for /);
  assert.throws(() => ledgerRows(ledgerText([row({ slug: "fern-tip" }), row({ slug: "fern-tip" })])), /^Error: ledger line 3: fern-tip is listed twice for /);
  // a channel the config does not list
  assert.throws(() => ledgerRows(ledgerTextCh([row({ slug: "fern-tip", channel: "facebook" })])), /^Error: ledger line 2: channel facebook$/);
  assert.throws(() => ledgerRows(ledgerTextCh([row({ slug: "fern-tip", channel: "youtube" })]), ["instagram", "tiktok"]), /^Error: ledger line 2: channel youtube$/);
});

test("run slot needs --channel when two channels are configured, and names them", async () => {
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledgerTextCh([]) });
  try {
    for (const argv of [["slot"], ["slot", "--channel", "youtube"], ["norms"], ["queue", "--channel", "TikTok"]]) {
      assert.deepEqual(await a.call(...argv), { code: 1, out: { error: "--channel wants one of: instagram, tiktok" } }, argv.join(" "));
    }
    assert.equal((await a.call("slot", "--channel", "tiktok")).code, 0);
    // mode and budget count the whole account
    assert.equal((await a.call("mode", "--channel", "tiktok")).code, 1);
    assert.equal((await a.call("budget", "--channel", "tiktok")).code, 1);
    assert.equal((await a.call("mode")).code, 0);
  } finally {
    await a.done();
  }
  const one = await quillfern({ ...QF, channels: "tiktok", "account_id@tiktok": "" }, {});
  try {
    assert.equal((await one.call("slot")).code, 0, "one channel: --channel is optional");
    assert.equal((await one.call("slot", "--channel", "tiktok")).code, 0);
    assert.deepEqual(await one.call("slot", "--channel", "instagram"), { code: 1, out: { error: "--channel wants one of: tiktok" } });
  } finally {
    await one.done();
  }
});

test("run slot --channel tiktok ignores instagram's scheduled times", async () => {
  // now is 10:30 on 2026-11-10 in Toronto (UTC-5); the windows are 09:00 (14:00Z) and 18:00 (23:00Z).
  const taken = { posts: [
    { accountId: "qf-ig", scheduledAt: "2026-11-10T23:00:00Z", status: "scheduled" },
    { accountId: "qf-ig", scheduledAt: "2026-11-11T14:00:00Z", status: "scheduled" },
    { accountId: "qf-tt", scheduledAt: "2026-11-10T23:00:00Z", status: "scheduled" },
  ] };
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "taken.json": JSON.stringify(taken) });
  try {
    const takenPath = join(a.dir, "marketing", "taken.json");
    const at = async (ch) => (await a.call("slot", "--channel", ch, "--taken", takenPath)).out.at;
    assert.equal(await at("tiktok"), "2026-11-11T14:00:00.000Z", "tiktok's own post took tonight; instagram's 09:00 tomorrow is not tiktok's");
    assert.equal(await at("instagram"), "2026-11-11T23:00:00.000Z");
    const q = (await a.call("queue", "--channel", "tiktok", "--taken", takenPath)).out;
    assert.deepEqual(q.byDay, { "2026-11-10": 1 });
  } finally {
    await a.done();
  }
});

test("run mode counts a post approved on three channels once", async () => {
  const approved = (slug, channel, extra = {}) => row({ slug, channel, approval: "human", boqo_post_id: `${slug}-${channel}`, posted_at: "2026-11-09T14:00:00Z", ...extra });
  const ledger = ledgerTextCh([
    ...CHANNELS.map((ch) => approved("quill-desk", ch)),
    approved("fern-walk", "instagram", { approval: "auto" }),
    approved("fern-walk", "tiktok"),
    approved("ink-blot", "youtube", { approval: "auto" }),
  ]);
  const a = await quillfern(QF, { "ledger.csv": ledger });
  try {
    assert.deepEqual(await a.call("mode"), { code: 0, out: { approved: 2, needed: 10, mode: "calibration", switchDue: false } });
  } finally {
    await a.done();
  }
});

test("run due lists both channels' checkpoints with their channel", async () => {
  const ledger = ledgerTextCh([
    row({ slug: "quill-desk", channel: "instagram", posted_at: "2026-11-10T14:00:00Z" }),
    row({ slug: "quill-desk", channel: "tiktok", posted_at: "2026-11-10T16:00:00Z" }),
    row({ slug: "fern-old", posted_at: "2026-11-10T15:00:00Z" }), // no channel: the first channel's
  ]);
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledger });
  try {
    const list = async (...argv) => (await a.call("due", "--now", "2026-11-11T17:00:00Z", ...argv)).out.due.map((x) => [x.slug, x.channel, x.checkpoint, x.dueAt]);
    assert.deepEqual(await list(), [
      ["quill-desk", "instagram", "+24h", "2026-11-11T14:00:00.000Z"],
      ["fern-old", "instagram", "+24h", "2026-11-11T15:00:00.000Z"],
      ["quill-desk", "tiktok", "+24h", "2026-11-11T16:00:00.000Z"],
    ]);
    assert.deepEqual(await list("--channel", "tiktok"), [["quill-desk", "tiktok", "+24h", "2026-11-11T16:00:00.000Z"]]);
    assert.equal((await a.call("due", "--channel", "youtube")).code, 1);
  } finally {
    await a.done();
  }
});

test("run verdict answers as before for a ledger without a channel column", async () => {
  // The legacy ledger (no channel column) and account.csv: every row is the first channel's.
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => row({ slug: `nib-${i}`, type: "reach", posted_at: isoAt(T0 + i * DAY_MS), views_72h: "1000" })),
    row({ slug: "nib-big", type: "reach", posted_at: isoAt(T0 + 6 * DAY_MS), views_72h: "1500" }),
  ];
  const files = { "ledger.csv": ledgerText(rows), "account.csv": "date,read_at,followers,gained_week,source\n" };
  const expected = { slug: "nib-big", type: "reach", metric: "views_72h", value: 1500, norm: { value: 1000, n: 6, source: "own" }, band: [0.8, 1.25], verdict: "above", data: "full" };
  const verdictOf = async (config, ...argv) => {
    const a = await quillfern(config, files);
    try {
      return await a.call("verdict", "nib-big", "--now", "2026-11-20T15:00:00Z", ...argv);
    } finally {
      await a.done();
    }
  };
  assert.deepEqual(await verdictOf({ brand: "quillfern" }), { code: 0, out: expected });
  assert.deepEqual(await verdictOf({ brand: "quillfern", channels: "" }), { code: 0, out: expected });
  assert.deepEqual(await verdictOf({ ...QF, channels: "instagram, tiktok" }, "--channel", "instagram"), { code: 0, out: expected });
  assert.deepEqual(await verdictOf({ ...QF, channels: "instagram, tiktok" }, "--channel", "tiktok"), { code: 1, out: { error: 'no ledger row with slug "nib-big"' } });
});

// ---------------------------------------------------------------- a post published by hand

test("calibration counts a hand-published post that has a permalink", () => {
  const rows = [
    row({ slug: "quill-desk", boqo_post_id: "", permalink: "https://quillfern.example/p/1" }),
    row({ slug: "fern-walk", status: "scheduled", boqo_post_id: "bp-2" }),
    row({ slug: "ink-blot", boqo_post_id: "", permalink: "" }), // nothing says it went out
  ];
  assert.equal(calibration(rows, cfg()).approved, 2);
});

test("calibration does not count a handed post", () => {
  const rows = [row({ slug: "quill-desk", status: "handed", boqo_post_id: "", permalink: "https://quillfern.example/p/1" }), row({ slug: "fern-walk", status: "handed", boqo_post_id: "bp-2" })];
  assert.equal(calibration(rows, cfg()).approved, 0);
});

test("parseConfig types publish_via, git_push and signups_source and refuses other values", () => {
  const empty = cfg();
  assert.deepEqual([empty.publish_via, empty.git_push, empty.issues_repo, empty.signups_source, empty.signups_command, empty.link_must_have, empty.link_must_not_have, empty.dm_command], ["auto", "off", null, "none", null, null, null, null]);
  const set = cfg({ publish_via: "boqo-only", git_push: "on", issues_repo: "quillfern/site", signups_source: "command", signups_command: "node ./signups.mjs --days 28", dm_command: "node ./dm.mjs set {code} {channel} {link}", link_must_have: "Start free", link_must_not_have: "Sign in to continue" });
  assert.deepEqual([set.publish_via, set.git_push, set.issues_repo, set.signups_source, set.signups_command, set.link_must_have, set.link_must_not_have, set.dm_command], ["boqo-only", "on", "quillfern/site", "command", "node ./signups.mjs --days 28", "Start free", "Sign in to continue", "node ./dm.mjs set {code} {channel} {link}"]);
  assert.equal(cfg({ publish_via: "manual" }).publish_via, "manual");
  assert.equal(cfg({ signups_source: "manual" }).signups_source, "manual");
  assert.throws(() => cfg({ publish_via: "carrier-pigeon" }), /^Error: config publish_via: "carrier-pigeon" is not one of auto, manual, boqo-only$/);
  assert.throws(() => cfg({ git_push: "yes" }), /^Error: config git_push: "yes" is not one of on, off$/);
  assert.throws(() => cfg({ signups_source: "spreadsheet" }), /^Error: config signups_source: "spreadsheet" is not one of manual, command, none$/);
});

test("ledgerRows accepts status handed", () => {
  const rows = ledgerRows(ledgerText([row({ slug: "quill-desk", status: "handed", scheduled_at: "2026-11-12T14:00:00Z", approval: "human" })]));
  assert.equal(rows[0].status, "handed");
});

test("ledgerRows refuses a scheduled_at that is not an instant", () => {
  for (const bad of ["tomorrow", "2026-11-12", "2026-11-12T14:00:00"]) {
    assert.throws(() => ledgerRows(ledgerText([row({ slug: "quill-desk", status: "handed", scheduled_at: bad })])), new RegExp(`^Error: ledger line 2: scheduled_at ${bad}$`), bad);
  }
  assert.equal(ledgerRows(ledgerText([row({ slug: "quill-desk", scheduled_at: "2026-11-12T09:00:00-05:00" })])).length, 1);
  assert.equal(ledgerRows(ledgerText([row({ slug: "quill-desk", scheduled_at: "" })])).length, 1, "empty is allowed");
});

test("due lists a hand-published post's checkpoints and none for a handed one", async () => {
  const ledger = ledgerTextCh([
    row({ slug: "quill-desk", channel: "tiktok", posted_at: "2026-11-10T14:00:00Z", permalink: "https://quillfern.example/p/1" }), // no boqo_post_id
    row({ slug: "fern-walk", channel: "tiktok", status: "handed", scheduled_at: "2026-11-09T14:00:00Z", posted_at: "" }),
  ]);
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledger });
  try {
    const res = await a.call("due", "--channel", "tiktok", "--now", "2026-11-11T17:00:00Z");
    assert.deepEqual(res.out.due.map((x) => [x.slug, x.checkpoint]), [["quill-desk", "+24h"]]);
  } finally {
    await a.done();
  }
});

// now is 10:30 on 2026-11-10 in Toronto (UTC-5); the windows are 09:00 (14:00Z) and 18:00 (23:00Z); two posts a day at most.
test("slot skips a time already handed over on this channel", async () => {
  const ledger = ledgerTextCh([row({ slug: "quill-desk", channel: "tiktok", status: "handed", scheduled_at: "2026-11-10T23:00:00Z", approval: "human" })]);
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledger });
  try {
    assert.equal((await a.call("slot", "--channel", "tiktok")).out.at, "2026-11-11T14:00:00.000Z");
    assert.deepEqual((await a.call("queue", "--channel", "tiktok")).out.byDay, { "2026-11-10": 1 });
  } finally {
    await a.done();
  }
});

test("slot ignores a time handed over on another channel", async () => {
  const ledger = ledgerTextCh([
    row({ slug: "quill-desk", channel: "instagram", status: "handed", scheduled_at: "2026-11-10T23:00:00Z" }),
    row({ slug: "fern-walk", status: "handed", scheduled_at: "2026-11-11T14:00:00Z" }), // no channel: the first's
    row({ slug: "ink-blot", channel: "tiktok", status: "posted", scheduled_at: "2026-11-10T23:00:00Z", posted_at: "2026-11-10T23:00:00Z", boqo_post_id: "bp-ink" }), // went out through boqo: the schedule's business
  ]);
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledger });
  try {
    assert.equal((await a.call("slot", "--channel", "tiktok")).out.at, "2026-11-10T23:00:00.000Z");
    assert.equal((await a.call("slot", "--channel", "instagram")).out.at, "2026-11-11T23:00:00.000Z", "the first channel owns the row with no channel: 11-10 evening and 11-11 morning are handed");
    assert.deepEqual((await a.call("queue", "--channel", "tiktok")).out.byDay, {});
  } finally {
    await a.done();
  }
});

test("channelConfig gives a later channel no account_id unless it sets its own", () => {
  const c = cfg({ ...QF, channels: "instagram, tiktok, youtube", "account_id@youtube": "qf-yt" });
  assert.equal(channelConfig(c, "instagram").account_id, "qf-ig");
  assert.equal(channelConfig(c, "tiktok").account_id, "qf-tt");
  assert.equal(channelConfig(c, "youtube").account_id, "qf-yt");
  assert.equal(channelConfig(cfg({ ...QF, "account_id@tiktok": "" }), "tiktok").account_id, null);
  // with the first channel moved, the plain account_id follows it
  const yt = cfg({ ...QF, channels: "youtube, instagram", "account_id@tiktok": undefined });
  assert.equal(channelConfig(yt, "youtube").account_id, "qf-ig");
  assert.equal(channelConfig(yt, "instagram").account_id, null);
});

test("slot for a channel with no account_id takes nothing from --taken", async () => {
  const taken = { posts: [
    { accountId: "qf-ig", scheduledAt: "2026-11-10T23:00:00Z", status: "scheduled" },
    { scheduledAt: "2026-11-10T14:00:00Z", status: "scheduled" }, // names no account: still not youtube's
  ] };
  const a = await quillfern({ ...QF, channels: "instagram, youtube", "account_id@tiktok": undefined }, { "taken.json": JSON.stringify(taken), "ledger.csv": ledgerTextCh([]) });
  try {
    const takenPath = join(a.dir, "marketing", "taken.json");
    assert.equal((await a.call("slot", "--channel", "youtube", "--taken", takenPath)).out.at, "2026-11-10T23:00:00.000Z");
    assert.deepEqual((await a.call("queue", "--channel", "youtube", "--taken", takenPath)).out.byDay, {});
    assert.equal((await a.call("slot", "--channel", "instagram", "--taken", takenPath)).out.at, "2026-11-11T14:00:00.000Z", "the first channel still reads its own account's posts");
  } finally {
    await a.done();
  }
  // one channel and no account_id: the schedule is that one account's, as before
  const one = await quillfern({ brand: "quillfern", account_id: "" }, { "taken.json": JSON.stringify(taken) });
  try {
    assert.equal((await one.call("slot", "--taken", join(one.dir, "marketing", "taken.json"))).out.at, "2026-11-11T14:00:00.000Z");
  } finally {
    await one.done();
  }
});

test("ledgerRows refuses a legacy row and a first-channel row for the same slug", () => {
  const legacy = row({ slug: "fern-tip" }), first = row({ slug: "fern-tip", channel: "instagram" });
  assert.throws(() => ledgerRows(ledgerTextCh([legacy, first])), /^Error: ledger line 3: fern-tip is listed twice for instagram$/);
  assert.throws(() => ledgerRows(ledgerTextCh([first, legacy])), /^Error: ledger line 3: fern-tip is listed twice for instagram$/);
  // the first channel is the config's first, not instagram
  assert.throws(() => ledgerRows(ledgerTextCh([legacy, row({ slug: "fern-tip", channel: "tiktok" })]), ["tiktok", "instagram"]), /^Error: ledger line 3: fern-tip is listed twice for tiktok$/);
  assert.equal(ledgerRows(ledgerTextCh([legacy, first]), ["tiktok", "instagram"]).length, 2);
});

// ---------------------------------------------------------------- sign-ups typed by hand

import { campaignsFromSignups } from "../skills/boqount/tools/account-state-lib.mjs";

const SIGNUPS_HEADER = "date,campaign,signups,activated,buyers,note";
const signupRows = (...lines) => parseCsv([SIGNUPS_HEADER, ...lines].join("\n") + "\n");
const SU_NOW = new Date("2026-11-30T12:30:00Z"); // 07:30 in Toronto: today is 2026-11-30

test("campaignsFromSignups sums per campaign and per day inside the window", () => {
  const rows = signupRows(
    "2026-11-17,quill-demo-20261117,2,1,0,from the DM",
    "2026-11-18,quill-demo-20261117,1,,,",
    "2026-11-18,quill-offer-20261118,3,2,1,",
    "2026-11-30,quill-offer-20261118,1,0,0,today counts",
    "2026-09-01,quill-old-20260901,5,1,1,before the window",
  );
  const out = campaignsFromSignups(rows, { days: 30, now: SU_NOW, zone: "America/Toronto" });
  assert.deepEqual(out, {
    readAt: "2026-11-30T12:30:00.000Z",
    days: 30,
    through: "2026-11-30",
    byCampaign: {
      "quill-demo-20261117": { signups: 3, activated: 1, buyers: 0 },
      "quill-offer-20261118": { signups: 4, activated: 2, buyers: 1 },
    },
    byDay: { "2026-11-17": 2, "2026-11-18": 4, "2026-11-30": 1 },
  });
  // The first day of 30 days ending today is 2026-11-01: the 31st day back is out.
  const edge = campaignsFromSignups(signupRows("2026-11-01,a,1,,,", "2026-10-31,b,1,,,"), { days: 30, now: SU_NOW, zone: "America/Toronto" });
  assert.deepEqual(Object.keys(edge.byCampaign), ["a"]);
});

test("campaignsFromSignups counts days on the account's clock, not UTC", () => {
  const late = new Date("2026-12-01T03:00:00Z"); // still 2026-11-30 in Toronto
  const out = campaignsFromSignups(signupRows("2026-11-30,a,1,,,", "2026-11-24,a,7,,,"), { days: 7, now: late, zone: "America/Toronto" });
  assert.deepEqual(out.byDay, { "2026-11-30": 1, "2026-11-24": 7 }, "the 7 days end on 11-30, the account's today (UTC's would start on 11-25)");
  assert.throws(() => campaignsFromSignups(signupRows("2026-12-01,a,7,,,"), { days: 7, now: late, zone: "America/Toronto" }), /date 2026-12-01 is after today/, "12-01 is tomorrow on the account's clock");
});

test('campaignsFromSignups sums rows with no campaign under "-"', () => {
  const out = campaignsFromSignups(signupRows("2026-11-20,,5,2,1,newsletter total", "2026-11-21, ,1,0,0,a blank campaign", "2026-11-20,quill-demo-20261117,1,,,"), { days: 90, now: SU_NOW, zone: "America/Toronto" });
  assert.deepEqual(out.byCampaign, { "-": { signups: 6, activated: 2, buyers: 1 }, "quill-demo-20261117": { signups: 1, activated: 0, buyers: 0 } });
  assert.deepEqual(out.byDay, { "2026-11-20": 6, "2026-11-21": 1 });
});

test("campaignsFromSignups refuses a date after today", () => {
  const read = (now, ...lines) => campaignsFromSignups(signupRows(...lines), { days: 90, now, zone: "America/Toronto" });
  assert.throws(() => read(SU_NOW, "2026-11-30,quill-demo-20261117,1,,,", "2026-12-01,quill-demo-20261117,4,0,0,typed a day early"), /^Error: signups line 3: date 2026-12-01 is after today$/);
  assert.throws(() => read(SU_NOW, "2027-01-15,quill-demo-20261117,1,,,"), /^Error: signups line 2: date 2027-01-15 is after today$/, "far past the window too");
  // on the account's clock: 03:00Z on 12-01 is still 11-30 in Toronto, 06:00Z is 12-01
  assert.throws(() => read(new Date("2026-12-01T03:00:00Z"), "2026-12-01,a,1,,,"), /date 2026-12-01 is after today/);
  assert.deepEqual(read(new Date("2026-12-01T06:00:00Z"), "2026-12-01,a,1,,,").byDay, { "2026-12-01": 1 });
});

test("campaignsFromSignups reads a quoted campaign name holding a comma", () => {
  const out = campaignsFromSignups(signupRows('2026-11-20,"quill, spring promo",2,1,0,"said ""hi"", twice"'), { days: 90, now: SU_NOW, zone: "America/Toronto" });
  assert.deepEqual(out.byCampaign, { "quill, spring promo": { signups: 2, activated: 1, buyers: 0 } });
});

test("campaignsFromSignups refuses a bad date or a negative number, naming the line", () => {
  const bad = (line, re) => assert.throws(() => campaignsFromSignups(signupRows("2026-11-20,a,1,,,", line), { days: 90, now: SU_NOW, zone: "America/Toronto" }), re);
  bad("2026-02-30,a,1,,,", /^Error: signups line 3: date 2026-02-30$/);
  bad("20 Nov,a,1,,,", /^Error: signups line 3: date 20 Nov$/);
  bad("2026-11-21,a,-1,,,", /^Error: signups line 3: signups -1$/);
  bad("2026-11-21,a,,,,", /^Error: signups line 3: signups $/);
  bad("2026-11-21,a,1,1.5,,", /^Error: signups line 3: activated 1.5$/);
  bad("2026-11-21,a,1,,two,", /^Error: signups line 3: buyers two$/);
  assert.throws(() => campaignsFromSignups(signupRows("2020-01-01,a,x,,,"), { days: 7, now: SU_NOW, zone: "America/Toronto" }), /signups line 2: signups x/, "a row outside the window is still checked");
});

test("run campaigns without the file prints unavailable and exits 0", async () => {
  const q = await quillfern({ brand: "quillfern", timezone: "America/Toronto" }, {});
  try {
    const res = await q.call("campaigns");
    assert.equal(res.code, 0);
    assert.deepEqual(res.out, { unavailable: "no marketing/signups.csv" });
  } finally { await q.done(); }
});

test("run campaigns reads marketing/signups.csv, defaults to 90 days and takes no --channel", async () => {
  const q = await quillfern({ brand: "quillfern", timezone: "America/Toronto" }, { "signups.csv": `${SIGNUPS_HEADER}\n2026-11-05,quill-demo-20261105,2,1,0,\n2026-07-01,quill-old,9,0,0,out of the 90 days\n` });
  try {
    const res = await q.call("campaigns");
    assert.equal(res.code, 0, JSON.stringify(res.out));
    assert.deepEqual(res.out, { readAt: "2026-11-10T15:30:00.000Z", days: 90, through: "2026-11-05", byCampaign: { "quill-demo-20261105": { signups: 2, activated: 1, buyers: 0 } }, byDay: { "2026-11-05": 2 } });
    const short = await q.call("campaigns", "--days", "3", "--now", "2026-11-06T12:00:00Z");
    assert.deepEqual(short.out.byDay, { "2026-11-05": 2 }, "three days ending 11-06 are 11-04..11-06: 11-05 is in");
    const tooShort = await q.call("campaigns", "--days", "1", "--now", "2026-11-06T12:00:00Z");
    assert.deepEqual(tooShort.out.byDay, {}, "one day is today only");
  } finally { await q.done(); }
});

test("run campaigns refuses --days 0, a non-number, a huge number, and --channel", async () => {
  const q = await quillfern({ brand: "quillfern", timezone: "America/Toronto" }, { "signups.csv": `${SIGNUPS_HEADER}\n` });
  try {
    for (const d of ["0", "-1", "3651", "1.5", "ten"]) assert.equal((await q.call("campaigns", "--days", d)).code, 1, `--days ${d}`);
    assert.equal((await q.call("campaigns", "--days", "3650")).code, 0);
    assert.equal((await q.call("campaigns", "--channel", "instagram")).code, 1, "campaigns is post-level");
    assert.equal((await q.call("norms", "--days", "7")).code, 1, "--days applies to campaigns only");
  } finally { await q.done(); }
});

test("kpi reads a reply made by campaignsFromSignups", () => {
  const rows = signupRows(
    "2026-11-17,clips-demo-20261117,2,1,0,",
    "2026-11-19,clips-offer-20261119,2,1,1,",
    "2026-11-20,,3,0,0,not tied to a post",
    "2026-11-29,,0,,,a week with no sign-ups still gets a row",
  );
  const campaigns = campaignsFromSignups(rows, { days: 90, now: KPI_NOW, zone: "America/Toronto" });
  const out = kpiRun({ campaigns });
  assert.equal(row9(out, "signups_week").value, 4, "the two campaigns the judged week's posts carry; the untied total is not theirs");
  assert.equal(out.judged.signupsAll, 7, "but every sign-up of the week is in byDay");
});

test("run campaigns answers unavailable for a header-only or empty signups.csv", async () => {
  for (const text of [`${SIGNUPS_HEADER}\n`, SIGNUPS_HEADER, ""]) {
    const q = await quillfern({ brand: "quillfern", timezone: "America/Toronto" }, { "signups.csv": text });
    try {
      assert.deepEqual(await q.call("campaigns"), { code: 0, out: { unavailable: "marketing/signups.csv has no rows" } }, JSON.stringify(text));
    } finally { await q.done(); }
  }
});

test("kpi is blind, not zero, when the sign-ups file names no campaign", () => {
  const campaigns = campaignsFromSignups(signupRows("2026-11-17,,2,1,0,", "2026-11-20,,3,1,1,", "2026-11-29,,0,0,0,"), { days: 90, now: KPI_NOW, zone: "America/Toronto" });
  const out = kpiRun({ campaigns, config: cfg({ sales_goal_28d: "3" }) });
  for (const name of ["signups_week", "signups_per_1000_views", "activation_pct_28d", "buyers_28d", "buyer_pct_28d"]) {
    assert.deepEqual([row9(out, name).value, row9(out, name).why], [null, "the sign-ups file names no campaign"], name);
  }
  assert.deepEqual([out.judged.signups, out.judged.activated, out.judged.buyers, out.sales.buyers], [null, null, null, null]);
  assert.ok(out.sales.paths.every((p) => p.signups === null && p.activated === null && p.buyers === null), "the paths are blind too");
  assert.deepEqual(out.sales.untagged, { signups: 5, activated: 2, buyers: 1 }, "the untagged total is still reported");
  assert.equal(out.judged.signupsAll, 5, "and every sign-up of the week is in byDay");
  assert.equal(out.backplan.needSignups, null);
});

test("kpi is blind for buyers when a reply entry has no buyers", () => {
  const { buyers, ...noBuyers } = camp(2, 1, 1);
  const out = kpiRun({ campaigns: { ...KPI_CAMPAIGNS, byCampaign: { ...KPI_CAMPAIGNS.byCampaign, "clips-offer-20261119": noBuyers } } });
  for (const name of ["buyers_28d", "buyer_pct_28d"]) {
    assert.deepEqual([row9(out, name).value, row9(out, name).why], [null, "the campaigns reply has no buyers for clips-offer-20261119"], name);
  }
  assert.equal(row9(out, "activation_pct_28d").value, 50, "the stage that needs only activated still stands");
  assert.equal(row9(out, "signups_week").value, 4);
  assert.equal(out.sales.buyers, null);
  assert.deepEqual(out.sales.paths.map((p) => [p.rubric, p.signups, p.buyers]), [["clips-demo", 3, 0], ["clips-offer", 3, null]], "the path that holds the entry is blind for buyers");
  const noActivated = kpiRun({ campaigns: { ...KPI_CAMPAIGNS, byCampaign: { ...KPI_CAMPAIGNS.byCampaign, "clips-demo-20261117": { ...camp(2, 1, 0), activated: null } } } });
  assert.deepEqual([row9(noActivated, "activation_pct_28d").value, row9(noActivated, "activation_pct_28d").why], [null, "the campaigns reply has no activated for clips-demo-20261117"]);
  assert.equal(row9(noActivated, "buyers_28d").value, 1);
});

test("campaignsFromSignups reports the newest date as through", () => {
  const rows = signupRows(
    "2026-11-25,quill-demo-20261124,2,1,0,",
    "2026-11-18,quill-offer-20261118,3,2,1,",
    "2026-09-01,quill-old-20260901,5,1,1,",
  );
  assert.equal(campaignsFromSignups(rows, { days: 90, now: SU_NOW, zone: "America/Toronto" }).through, "2026-11-25");
  const outside = campaignsFromSignups(rows, { days: 3, now: SU_NOW, zone: "America/Toronto" });
  assert.deepEqual([outside.through, outside.byDay], ["2026-11-25", {}], "every row counts, not only the window's");
  assert.equal(campaignsFromSignups(signupRows("2026-11-29,,0,,,a week with no sign-ups"), { days: 7, now: SU_NOW, zone: "America/Toronto" }).through, "2026-11-29");
});

test("kpi is blind, not zero, for a week the sign-ups file has not reached", () => {
  // The judged week is 11-16..11-22; the person typed rows up to 11-20.
  const rows = signupRows("2026-11-17,clips-demo-20261117,2,1,0,", "2026-11-19,clips-offer-20261119,2,1,1,", "2026-11-20,,3,0,0,");
  const out = kpiRun({ campaigns: campaignsFromSignups(rows, { days: 90, now: KPI_NOW, zone: "America/Toronto" }), config: cfg({ sales_goal_28d: "3" }) });
  for (const name of ["signups_week", "signups_per_1000_views", "activation_pct_28d", "buyers_28d", "buyer_pct_28d"]) {
    assert.deepEqual([row9(out, name).value, row9(out, name).why], [null, "the sign-ups file ends 2026-11-20"], name);
  }
  assert.deepEqual([out.judged.signups, out.judged.activated, out.judged.buyers, out.sales.buyers, out.judged.signupsAll], [null, null, null, null, null]);
  assert.equal(row9(out, "views_week").value, 1500, "reach is not the sign-ups file's");
  const reached = kpiRun({ campaigns: { ...KPI_CAMPAIGNS, through: "2026-11-22" } });
  assert.deepEqual([row9(reached, "signups_week").value, row9(reached, "buyers_28d").value], [4, 1], "a file that reaches the judged week's last day is read");
  assert.equal(reached.interim.signups, null, "the week that ended runs past it too");
});

test("kpi reads a reply with no through as before", () => {
  const before = kpiRun();
  assert.ok(!("through" in KPI_CAMPAIGNS));
  assert.deepEqual([row9(before, "signups_week").value, row9(before, "buyers_28d").value, before.interim.signups], [4, 1, 1]);
  assert.deepEqual(kpiRun({ campaigns: { ...KPI_CAMPAIGNS, through: "2026-11-29" } }), before, "a through every window has reached changes nothing");
});

// ---------------------------------------------------------------- slots taken by posts published by hand

test("slot does not offer a third time on a day two posts were published by hand", async () => {
  // now is 10:30 on 2026-11-10 in Toronto; the person confirmed two tiktok posts this morning (no boqo_post_id).
  const ledger = ledgerTextCh([
    row({ slug: "quill-desk", channel: "tiktok", status: "posted", scheduled_at: "2026-11-10T13:00:00Z", posted_at: "2026-11-10T13:05:00Z", permalink: "https://quillfern.example/p/1" }),
    row({ slug: "fern-walk", channel: "tiktok", status: "posted", scheduled_at: "2026-11-10T15:00:00Z", posted_at: "2026-11-10T15:10:00Z", permalink: "https://quillfern.example/p/2" }),
    row({ slug: "ink-blot", channel: "instagram", status: "posted", posted_at: "2026-11-10T13:05:00Z", permalink: "https://quillfern.example/p/3" }),
    row({ slug: "nib-tip", channel: "instagram", status: "posted", posted_at: "2026-11-10T15:10:00Z", boqo_post_id: "bp-nib" }), // boqo's: --taken counts it
  ]);
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledger });
  try {
    assert.equal((await a.call("slot", "--channel", "tiktok")).out.at, "2026-11-11T14:00:00.000Z", "two today: tonight's 18:00 is not offered");
    assert.deepEqual((await a.call("queue", "--channel", "tiktok")).out.byDay, { "2026-11-10": 2 });
    assert.equal((await a.call("slot", "--channel", "instagram")).out.at, "2026-11-10T23:00:00.000Z", "one by hand today; the boqo post is the schedule's to count");
  } finally {
    await a.done();
  }
});

test("ledgerRows refuses a handed post without scheduled_at", () => {
  for (const at of ["", "  "]) {
    assert.throws(() => ledgerRows(ledgerText([row({ slug: "fern-walk", status: "planned" }), row({ slug: "quill-desk", status: "handed", scheduled_at: at })])), /^Error: ledger line 3: a handed post needs scheduled_at$/, JSON.stringify(at));
  }
  assert.equal(ledgerRows(ledgerText([row({ slug: "quill-desk", status: "posted", scheduled_at: "" })])).length, 1, "only a handed post needs one");
});

// ---------------------------------------------------------------- sales are the whole account's

const KPI_ARGS = ["kpi", "--from", "2026-11-23", "--to", "2026-11-29", "--now", KPI_NOW.toISOString()];
const qfPost = (slug, channel, at, o = {}) => row({ slug, channel, posted_at: at, segment: "writers", rubric: "desk-tour", ...o });
async function kpiAnswers(config, ledger, campaigns, channels) {
  const a = await quillfern(config, { "ledger.csv": ledger, "campaigns.json": JSON.stringify(campaigns) });
  try {
    const out = {};
    for (const ch of channels) {
      const res = await a.call(...KPI_ARGS, "--campaigns", join(a.dir, "marketing", "campaigns.json"), ...(ch ? ["--channel", ch] : []));
      assert.equal(res.code, 0, JSON.stringify(res.out));
      out[ch ?? "-"] = res.out;
    }
    return out;
  } finally {
    await a.done();
  }
}

test("kpi --channel judges buyers against the goal on the whole account's numbers", async () => {
  const ledger = ledgerTextCh([
    qfPost("quill-desk", "instagram", "2026-11-17T14:00:00Z", { views_7d: "1000", utm_campaign: "quill-desk-20261117" }),
    qfPost("fern-walk", "tiktok", "2026-11-19T14:00:00Z", { views_7d: "3000", utm_campaign: "fern-walk-20261119", rubric: "walk" }),
  ]);
  const campaigns = { days: 70, readAt: "2026-11-30T12:31:00.000Z", byDay: { "2026-11-17": 5, "2026-11-19": 5 }, byCampaign: { "quill-desk-20261117": camp(5, 3, 2), "fern-walk-20261119": camp(5, 3, 2) } };
  const { instagram: ig, tiktok: tt } = await kpiAnswers({ ...QF, channels: "instagram, tiktok", sales_goal_28d: "4" }, ledger, campaigns, ["instagram", "tiktok"]);
  for (const [name, out] of [["instagram", ig], ["tiktok", tt]]) {
    const b = row9(out, "buyers_28d");
    assert.deepEqual([b.value, b.target, b.basis, b.verdict], [4, 4, "goal", "within"], name);
    assert.equal(row9(out, "signups_week").value, 10, name);
    assert.deepEqual(out.sales.otherCampaigns, { signups: 0, activated: 0, buyers: 0 }, `${name}: the other channel's campaign is the account's, not unattributed`);
    assert.equal(out.salesScope, "account");
  }
  // reach and followers stay the channel's own
  assert.deepEqual([row9(ig, "views_week").value, row9(tt, "views_week").value], [1000, 3000]);
  assert.deepEqual(ig.sales, tt.sales);
  assert.deepEqual(ig.backplan, tt.backplan);
  assert.equal(ig.backplan.capacityPosts, 112, "28 days of both channels' max_posts_per_day (2 + 2)");
});

test("kpi counts a campaign shared by two channels once", async () => {
  const ledger = ledgerTextCh([
    qfPost("quill-desk", "instagram", "2026-11-17T14:00:00Z", { views_7d: "1000", utm_campaign: "quill-desk-20261117" }),
    qfPost("quill-desk", "tiktok", "2026-11-18T14:00:00Z", { views_7d: "2000", utm_campaign: "quill-desk-20261117" }),
  ]);
  const campaigns = { days: 70, readAt: "2026-11-30T12:31:00.000Z", byDay: { "2026-11-17": 3 }, byCampaign: { "quill-desk-20261117": camp(3, 2, 1) } };
  const both = await kpiAnswers({ ...QF, channels: "instagram, tiktok" }, ledger, campaigns, ["instagram", "tiktok"]);
  for (const [name, out] of Object.entries(both)) {
    assert.deepEqual([row9(out, "signups_week").value, row9(out, "buyers_28d").value, out.sales.signups], [3, 1, 3], name);
    assert.equal(row9(out, "signups_per_1000_views").value, 1, `${name}: 3 sign-ups on the account's 3,000 views`);
    assert.deepEqual(out.sales.paths, [{ segment: "writers", rubric: "desk-tour", posts: 2, views: 3000, signups: 3, activated: 2, buyers: 1 }], name);
  }
});

test("kpi for a one-channel account answers as before, plus salesScope", async () => {
  // The kpi fixture as files, with a ledger and account.csv written before channels (no channel column).
  const config = { sales_goal_28d: "3" };
  const a = await quillfern(config, {
    "ledger.csv": ledgerText(KPI_LEDGER),
    "account.csv": ["date,read_at,followers,gained_week,source", ...KPI_ACCOUNT.map((r) => [r.date, r.read_at, r.followers, r.gained_week, r.source].join(","))].join("\n") + "\n",
    "budget.csv": ["date,slug,service,usd,credits,note", ...KPI_BUDGET.map((b) => [b.date, b.slug, b.service, b.usd, b.credits, b.note].join(","))].join("\n") + "\n",
    "campaigns.json": JSON.stringify(KPI_CAMPAIGNS),
  });
  try {
    const before = JSON.parse(JSON.stringify(kpiRun({ config: cfg(config) })));
    for (const extra of [[], ["--channel", "instagram"]]) {
      const res = await a.call(...KPI_ARGS, "--campaigns", join(a.dir, "marketing", "campaigns.json"), ...extra);
      assert.equal(res.code, 0, JSON.stringify(res.out));
      const { standards, ...out } = res.out;
      assert.deepEqual(out, before, extra.join(" "));
      assert.equal(out.salesScope, "account");
      // the numbers the kpi tests above pin for this fixture
      assert.deepEqual([row9(out, "signups_week").value, row9(out, "buyers_28d").value, out.sales.otherCampaigns.buyers], [4, 1, 1]);
      assert.deepEqual(out.backplan, { goal: 3, buyers: 1, needSignups: 18, needViews: 7500, needPosts: 15, capacityPosts: 56, feasible: true });
    }
  } finally {
    await a.done();
  }
});

// ---------------------------------------------------------------- smaller checks

test("calibration does not count a whitespace-only permalink or boqo_post_id", () => {
  const rows = [row({ slug: "quill-desk", boqo_post_id: "", permalink: "  " }), row({ slug: "fern-walk", boqo_post_id: " ", permalink: "" })];
  assert.equal(calibration(rows, cfg()).approved, 0);
});

test("run refuses an account.csv row whose channel is not in channels", async () => {
  const header = "date,channel,read_at,followers,gained_week,source";
  const good = `${header}\n2026-11-08,instagram,2026-11-08T12:41:00Z,40,,get_analytics\n2026-11-08,,2026-11-08T12:41:00Z,40,,get_analytics\n`;
  for (const [bad, error] of [["youtube", "account line 3: channel youtube"], ["facebook", "account line 3: channel facebook"]]) {
    const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledgerTextCh([]), "account.csv": `${header}\n2026-11-08,tiktok,2026-11-08T12:41:00Z,40,,get_analytics\n2026-11-08,${bad},2026-11-08T12:41:00Z,41,,get_analytics\n` });
    try {
      assert.deepEqual(await a.call("norms", "--channel", "instagram"), { code: 1, out: { error } });
    } finally { await a.done(); }
  }
  const ok = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledgerTextCh([]), "account.csv": good });
  try {
    assert.equal((await ok.call("norms", "--channel", "tiktok")).code, 0);
  } finally { await ok.done(); }
});

test("stops names the channel it is asked about when restricted", async () => {
  assert.deepEqual(stops(BASE6, { funnel: "green", igRestricted: true }, NOW24, { channel: "tiktok" }).reasons, ["tiktok restricted"]);
  assert.deepEqual(stops(BASE6, { funnel: "green", igRestricted: true }, NOW24).reasons, ["instagram restricted"], "an instagram account reads as before");
  const a = await quillfern({ ...QF, channels: "instagram, tiktok" }, { "ledger.csv": ledgerTextCh([]) });
  try {
    for (const ch of ["instagram", "tiktok"]) {
      assert.deepEqual((await a.call("stops", "--channel", ch, "--funnel", "green", "--restricted", "yes")).out.reasons, [`${ch} restricted`]);
    }
  } finally { await a.done(); }
});

// ---------------------------------------------------------------- ad posts (bought views): the ledger's `ad` column

// The template's ledger has `ad` right after `tier`; a ledger without it is an older one and answers as before.
const AD_AT = HEADER.indexOf("tier") + 1;
const HEADER_AD = [...HEADER.slice(0, AD_AT), "ad", ...HEADER.slice(AD_AT)];
const ledgerTextAd = (rows) => [HEADER_AD.join(","), ...rows.map((o) => HEADER_AD.map((h) => o[h] ?? "").join(","))].join("\n") + "\n";
const reachAt = (slug, day, views, extra = {}) => row({ slug, type: "reach", planned_for: `2026-11-${day}`, posted_at: `2026-11-${day}T14:00:00Z`, views_72h: views, ...extra });

test("ledgerRows accepts ad yes, no or empty and refuses another value", () => {
  const rows = ledgerRows(ledgerTextAd([reachAt("qf-fern-ad", "09", "9000", { ad: "yes" }), reachAt("qf-fern", "10", "900")]));
  assert.deepEqual(rows.map((r) => r.ad), ["yes", ""]);
  // A record says "Ad: no", and that word gets copied into the ledger: it reads as not an ad, and breaks nothing.
  assert.equal(ledgerRows(ledgerTextAd([reachAt("qf-fern-plain", "09", "900", { ad: "no" })])).length, 1);
  assert.throws(() => ledgerRows(ledgerTextAd([reachAt("qf-fern-ad", "09", "9000", { ad: "maybe" })])), /^Error: ledger line 2: ad maybe$/);
  assert.throws(() => ledgerRows(ledgerTextAd([reachAt("qf-fern-ad", "09", "9000", { ad: "Yes" })])), /^Error: ledger line 2: ad Yes$/);
});

test("norms count a post marked ad no like any organic post", () => {
  const plain = ["01", "02", "03", "04", "05"].map((d, i) => reachAt(`qf-${d}`, d, String(100 * (i + 1)), { ad: "no" }));
  const empty = ["01", "02", "03", "04", "05"].map((d, i) => reachAt(`qf-${d}`, d, String(100 * (i + 1))));
  const n = (rows) => norms(ledgerRows(ledgerTextAd(rows)), {}, new Date("2026-11-20T12:00:00Z"), []);
  assert.deepEqual(n(plain), n(empty));
});

test("norms leave an ad post out", () => {
  const organic = ["01", "02", "03", "04", "05"].map((d, i) => reachAt(`qf-${d}`, d, String(100 * (i + 1))));
  const ad = reachAt("qf-ad", "06", "50000", { ad: "yes" });
  const n = norms([...organic, ad], {}, NOW24);
  assert.deepEqual([n.reach.value, n.reach.n, n.reach.source], [300, 5, "own"]);
});

test("verdict gives an ad post no-data and says why", async () => {
  const norm = { metric: "views_72h", value: 1000, n: 10, source: "own" };
  assert.deepEqual(verdict(reachAt("qf-ad", "06", "5000", { ad: "yes" }), norm, [0.8, 1.25]), { verdict: "no-data", data: "partial", why: "an ad post: its views are bought" });
  // through the command line: the ad is no organic post's norm either
  const organic = ["01", "02", "03", "04", "05"].map((d, i) => reachAt(`qf-${d}`, d, String(100 * (i + 1))));
  const a = await quillfern({ ...QF, channels: "instagram", "account_id@tiktok": undefined }, { "ledger.csv": ledgerTextAd([...organic, reachAt("qf-ad", "06", "50000", { ad: "yes" }), reachAt("qf-07", "07", "300")]) });
  try {
    const v = (await a.call("verdict", "qf-07", "--now", NOW24.toISOString())).out;
    assert.deepEqual([v.verdict, v.norm.value, v.norm.n], ["within", 300, 5]);
    const ad = (await a.call("verdict", "qf-ad", "--now", NOW24.toISOString())).out;
    assert.deepEqual([ad.verdict, ad.why], ["no-data", "an ad post: its views are bought"]);
    const n = (await a.call("norms", "--now", NOW24.toISOString())).out;
    assert.deepEqual([n.reach.value, n.reach.n], [300, 6]);
  } finally { await a.done(); }
});

test("stops leave an ad post out of the reach-drop run and keep it in the catches", () => {
  // an ad in the middle of three drops: the run is the newest three organic posts, so no run of three
  const withAd = [reachAt("d1", "14", "300"), reachAt("dad", "15", "100", { ad: "yes" }), reachAt("d3", "16", "450")];
  assert.deepEqual(stops([...BASE6, ...withAd], GREEN, NOW24), { stop: false, reasons: [] });
  assert.ok(!dropRun([...BASE6, ...withAd], NOW24).run.some((x) => x.slug === "dad"));
  // a newer ad at bought views does not break an organic run of three
  const three = [reachAt("d1", "14", "300"), reachAt("d2", "15", "400"), reachAt("d3", "16", "450")];
  assert.deepEqual(stops([...BASE6, ...three, reachAt("dad", "17", "50000", { ad: "yes" })], GREEN, NOW24), { stop: true, reasons: ["reach under half the norm three in a row"] });
  // a check catch is a check catch
  const c1 = row({ slug: "c1", status: "held", posted_at: "", planned_for: "2026-11-17", check: "caught:cta", ad: "yes" });
  const c2 = row({ slug: "c2", status: "held", posted_at: "", planned_for: "2026-11-18", check: "caught:hook" });
  assert.deepEqual(stops([...BASE6, c1, c2], GREEN, NOW24), { stop: true, reasons: ["two caught in a row"] });
});

test("kpi keeps an ad post's views out of reach and its campaign's sign-ups in conversion", () => {
  const ad = post("qf-ad47", "2026-11-18T14:00:00Z", { views_7d: "9000", type: "sale", rubric: "clips-offer", segment: "backlog", ad: "yes", utm_campaign: "clips-offer-20261118" });
  const campaigns = { ...KPI_CAMPAIGNS, byCampaign: { ...KPI_CAMPAIGNS.byCampaign, "clips-offer-20261118": camp(3, 1, 1) } };
  const out = kpiRun({ ledger: [...KPI_LEDGER, ad], campaigns });
  assert.equal(row9(out, "views_week").value, 1500, "the ad's 9,000 bought views are not the week's");
  assert.equal(row9(out, "views_per_post").value, 500);
  assert.deepEqual(out.judged.reads, { posts: 3, withViews: 3, at7d: 1 });
  assert.equal(row9(out, "follows_per_1000_views").value, 4, "over organic views only");
  assert.equal(row9(out, "signups_week").value, 7, "2 + 2 + the ad campaign's 3");
  assert.equal(out.judged.adPosts, 1);
  assert.equal(out.interim.adPosts, 0);
  assert.equal(out.adPosts, 1);
  assert.equal(out.sales.adPosts, 1);
  assert.equal(out.sales.views, 2500, "the 28 days' organic views: 400 + 600 + 1000 + 500");
});

test("a ledger without an ad column answers as before", () => {
  const blank = KPI_LEDGER.map((r) => ({ ...r, ad: "" }));
  const before = kpiRun(), after = kpiRun({ ledger: blank });
  assert.deepEqual(after, before);
  assert.equal(before.adPosts, 0);
  const rows = ["01", "02", "03", "04", "05"].map((d, i) => reachAt(`qf-${d}`, d, String(100 * (i + 1))));
  assert.deepEqual(norms(rows.map((r) => ({ ...r, ad: "" })), {}, NOW24), norms(rows, {}, NOW24));
  assert.deepEqual(verdict(rows[0], { value: 100 }, [0.8, 1.25]), { verdict: "within", data: "full" });
});
