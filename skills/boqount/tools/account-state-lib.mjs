// The state arithmetic of /boqount (skills/boqount): config, ledger, mode, budget, posting slots and
// queue depth, so the skill text never counts dates, dollars or slots by hand. The CLI is tools/account-state.mjs;
// the tests are tests/account-state.test.mjs.
//
// Every calendar fact here is read through Intl.DateTimeFormat with the account's IANA zone (`timezone` in
// marketing/config.md). Nothing uses Date's local-time getters, so the Mac's own zone (TZ) cannot change an answer;
// tests/account-state.test.mjs runs `slot` in child processes under three TZ values to pin that.
import { isAbsolute, join } from "node:path";

export const TYPES = ["reach", "awareness", "trust", "sale"];
const ENUMS = {
  status: ["planned", "checked", "approved", "uploading", "uploaded", "post_requested", "handed", "scheduled", "posted", "held", "skipped", "failed", "canceled", "abandoned", "legacy"],
  type: [...TYPES, "legacy"],
  type_source: ["human", "skill", "legacy"],
  // What the post is: a film made from scratch, clips cut from a long video, a finished file, a slideshow of stills,
  // a screen recording of the product at work. A story has no ledger row. The numbered values and `stock` are an
  // older ledger's tiers, still read.
  tier: ["film", "clips", "file", "slideshow", "recording", "1", "2", "3", "4", "stock"],
  // A post the person promotes with bought views (its record's `Ad: yes`). Its views are bought: kept out of every
  // norm, the reach-drop run and the reach and follower KPIs. A ledger without the column has no ad post.
  ad: ["yes", "no"], // `no` reads as empty: a record says "Ad: no", and that word gets copied here
  approval: ["human", "auto", "none"],
  data: ["full", "partial"],
  verdict: ["above", "within", "below", "no-data"],
};
// status and type are the two columns every ledger row must fill; the rest may be empty until the row reaches them.
const REQUIRED = new Set(["status", "type"]);
const AUTOPOST = ["calibration", "auto", "paused"];
// Enumerated config keys, with what an empty value means. The skill's text reads them; parseConfig only types them.
const CONFIG_ENUMS = {
  publish_via: { allowed: ["auto", "manual", "boqo-only"], empty: "auto" },
  git_push: { allowed: ["on", "off"], empty: "off" },
  signups_source: { allowed: ["manual", "command", "none"], empty: "none" },
};
const MIN_LEAD_MS = 60 * 60 * 1000;
const SEARCH_DAYS = 60;

// ---------------------------------------------------------------- zone arithmetic

const formatters = new Map();
function formatterFor(zone) {
  let f = formatters.get(zone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      throw new Error(`timezone ${JSON.stringify(zone)} is not an IANA zone`);
    }
    formatters.set(zone, f);
  }
  return f;
}
function requireZone(config) {
  if (!config.timezone) throw new Error("config timezone is empty: a day can't be counted on an unknown clock");
  formatterFor(config.timezone);
  return config.timezone;
}
/** The wall-clock reading of `date` in `zone`. */
function wall(date, zone) {
  const p = {};
  for (const { type, value } of formatterFor(zone).formatToParts(date)) p[type] = Number(value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}
const wallAsUtcMs = (w) => Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (date, zone) => {
  const w = wall(date, zone);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
};
/** Calendar-only arithmetic on a YYYY-MM-DD key (no zone is involved: the key is already the account's date). */
function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** The instant at which the account's clock reads `hhmm` on `dayStr`. Settles on the offset in force at that time. */
function zonedToUtc(dayStr, hhmm, zone) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)));
  let guess = target;
  for (let i = 0; i < 3; i++) guess = target - (wallAsUtcMs(wall(new Date(guess), zone)) - guess);
  return new Date(guess);
}

// ---------------------------------------------------------------- instants

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
/** A Date from an ISO instant that names its own offset (Z, +HH:MM or +HHMM). Throws otherwise: a bare string would be read in the Mac's zone. */
export function parseInstant(iso) {
  if (typeof iso !== "string" || !INSTANT.test(iso)) throw new Error(`${JSON.stringify(iso)} is not an ISO instant with Z or an offset`);
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) throw new Error(`${JSON.stringify(iso)} is not a valid instant`);
  return t;
}

// ---------------------------------------------------------------- config

const NUMBER_KEYS = ["max_posts_per_day", "budget_usd_day", "budget_usd_month", "credits_day", "calibration_posts", "research_every_weeks", "sales_goal_28d"];
const STRING_KEYS = ["brand", "account_id", "boqo_server", "timezone", "paused_by", "resumed_at", "seed_research", "caption_via_filename", "live_page", "tracker", "language", "issues_repo", "signups_command", "dm_command", "link_must_have", "link_must_not_have"];

/** The platforms an account can post to. A config's `channels` lists some of them; the first owns rows that name no channel. */
export const CHANNELS = ["instagram", "tiktok", "youtube"];
// The keys a channel may set for itself, as `<key>@<channel>: <value>` (channelConfig); every other key is the account's.
const PER_KEYS = ["account_id", "windows", "max_posts_per_day"];

function parseChannels(v) {
  if (v === "") return ["instagram"]; // a config written before channels: the one Instagram account
  const out = [];
  for (const part of v.split(",")) {
    const name = part.trim().toLowerCase();
    if (!CHANNELS.includes(name) || out.includes(name)) throw new Error(`config channels: ${JSON.stringify(name)} is not one of ${CHANNELS.join(", ")}`);
    out.push(name);
  }
  return out;
}
function postsPerDay(n, key, v) {
  if (n === null || n < 1 || n > 2 || !Number.isInteger(n)) throw new Error(`config ${key} must be 1 or 2 (at most 2 posts a day), got ${JSON.stringify(v ?? "")}`);
  return n;
}
function parseWindows(v, key = "windows") {
  if (v === "") return [];
  return v.split(",").map((part) => {
    const m = /^\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$/.exec(part);
    if (!m) throw new Error(`config ${key}: ${JSON.stringify(part.trim())} is not HH:MM-HH:MM`);
    const [, from, to] = m;
    for (const t of [from, to]) if (Number(t.slice(0, 2)) > 23 || Number(t.slice(3)) > 59) throw new Error(`config ${key}: ${t} is not a time`);
    if (minutesOf(from) >= minutesOf(to)) throw new Error(`config ${key}: ${from}-${to} ends before it starts`);
    return { from, to };
  }).sort((a, b) => minutesOf(a.from) - minutesOf(b.from));
}
function parseMix(v) {
  const mix = {};
  for (const part of v.split(",")) {
    const m = /^\s*([a-z]+)\s+(\d+(?:\.\d+)?)\s*$/.exec(part);
    if (!m || !TYPES.includes(m[1]) || m[1] in mix) throw new Error(`config mix: ${JSON.stringify(part.trim())} is not "<type> <number>" for a known type`);
    mix[m[1]] = Number(m[2]);
  }
  for (const t of TYPES) if (!(t in mix)) throw new Error(`config mix: ${t} is missing`);
  const sum = TYPES.reduce((s, t) => s + mix[t], 0);
  if (Math.abs(sum - 100) > 1e-9) throw new Error(`config mix sums to ${sum}, not 100`);
  return mix;
}
function parseBand(v) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/.exec(v);
  if (!m || Number(m[1]) > Number(m[2])) throw new Error(`config verdict_band: ${JSON.stringify(v)} is not "<low>-<high>"`);
  return [Number(m[1]), Number(m[2])];
}

/**
 * The ```config block of marketing/config.md as a typed object. An empty value is null (windows: []). A line starting
 * with # is a comment. `channels` is a list (empty: ["instagram"]); `per[channel]` holds what `<key>@<channel>` lines set.
 */
export function parseConfig(md) {
  const block = /^```config[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m.exec(String(md));
  if (!block) throw new Error("no ```config block in the config file");
  const raw = {};
  for (const line of block[1].split(/\r?\n/)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i < 1) throw new Error(`config block: ${JSON.stringify(line)} is not "key: value"`);
    raw[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const c = {};
  for (const k of STRING_KEYS) c[k] = raw[k] ? raw[k] : null;
  for (const k of NUMBER_KEYS) {
    if (!raw[k]) c[k] = null;
    else {
      const n = Number(raw[k]);
      if (!Number.isFinite(n) || n < 0) throw new Error(`config ${k}: ${JSON.stringify(raw[k])} is not a number`);
      c[k] = n;
    }
  }
  c.windows = parseWindows(raw.windows ?? "");
  c.mix = parseMix(raw.mix ?? "");
  c.verdict_band = raw.verdict_band ? parseBand(raw.verdict_band) : null;
  if (!raw.autopost) c.autopost = null;
  else if (!AUTOPOST.includes(raw.autopost)) throw new Error(`config autopost: ${JSON.stringify(raw.autopost)} is not one of ${AUTOPOST.join(", ")}`);
  else c.autopost = raw.autopost;
  postsPerDay(c.max_posts_per_day, "max_posts_per_day", raw.max_posts_per_day);
  for (const [k, { allowed, empty }] of Object.entries(CONFIG_ENUMS)) {
    const v = raw[k] ?? "";
    if (v !== "" && !allowed.includes(v)) throw new Error(`config ${k}: ${JSON.stringify(v)} is not one of ${allowed.join(", ")}`);
    c[k] = v === "" ? empty : v;
  }
  c.channels = parseChannels(raw.channels ?? "");
  c.per = Object.fromEntries(c.channels.map((ch) => [ch, {}]));
  for (const [k, v] of Object.entries(raw)) {
    const i = k.indexOf("@");
    if (i < 0) continue;
    const key = k.slice(0, i), ch = k.slice(i + 1).toLowerCase();
    if (!PER_KEYS.includes(key)) throw new Error(`config ${k}: only ${PER_KEYS.join(", ")} can be set per channel`);
    if (v === "") continue; // not set, whatever the channel: a listed one takes the plain key, an unlisted one is not read
    if (!c.channels.includes(ch)) throw new Error(`config ${k}: ${JSON.stringify(ch)} is not in channels (${c.channels.join(", ")})`);
    c.per[ch][key] = key === "windows" ? parseWindows(v, k) : key === "max_posts_per_day" ? postsPerDay(Number(v), k, v) : v;
  }
  return c;
}

/**
 * The config one channel works with: `channel` set, and account_id, windows and max_posts_per_day from its `@<channel>`
 * lines where it has them. windows and max_posts_per_day fall back to the plain key; account_id does so for the first
 * channel only: another channel with none has no boqo account (null), so its posts are handed over by hand.
 */
export function channelConfig(config, channel) {
  const own = channel === config.channels?.[0] ? {} : { account_id: null };
  return { ...config, channel, ...own, ...config.per?.[channel] };
}

/** The rows (ledger.csv, account.csv) of one channel. A row with no or an empty `channel` belongs to the first channel in the config. */
export function scopeRows(rows, config, channel) {
  const first = channel === config.channels[0];
  return rows.filter((r) => (r.channel ?? "") === channel || (first && (r.channel ?? "") === ""));
}

// ---------------------------------------------------------------- csv and ledger

/** Records of a CSV text with the 1-based physical line each starts on. Quoted fields may hold commas, quotes ("") and newlines. */
function csvRecords(text) {
  const out = [];
  let fields = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  let touched = false;
  const endField = () => { fields.push(field); field = ""; };
  const endRecord = () => {
    endField();
    if (touched || fields.length > 1 || fields[0] !== "") out.push({ line: start, fields });
    fields = [];
    touched = false;
  };
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") { quoted = true; touched = true; }
    else if (ch === ",") { endField(); touched = true; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      endRecord();
      line++;
      start = line;
    } else { field += ch; touched = true; }
  }
  if (quoted) throw new Error(`csv: a quoted field starting before line ${line} never closes`);
  endRecord();
  return out;
}
function recordsToObjects(records) {
  if (records.length === 0) return [];
  const header = records[0].fields.map((h) => h.trim());
  return records.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r.fields[i] ?? ""; });
    return Object.defineProperty(o, "__line", { value: r.line, enumerable: false });
  });
}
export function parseCsv(text) {
  return recordsToObjects(csvRecords(text));
}
const filled = (r, field) => String(r[field] ?? "").trim() !== "";
const isAd = (r) => String(r.ad ?? "").trim() === "yes";

/**
 * The rows of marketing/ledger.csv. Throws `ledger line <n>: <field> <value>` on a value outside the Fixed-names
 * enumerations, a `channel` outside `channels` (the config's), a `scheduled_at` that is not an instant with its own
 * offset or a `handed` row without one, and on a slug listed twice for one channel: a post is one row per channel it
 * goes to. An empty channel (or no column) is the first channel, so a row without one and a first-channel row for the
 * same slug are the same pair.
 */
export function ledgerRows(text, channels = CHANNELS) {
  const rows = parseCsv(text);
  const seen = new Set();
  for (const r of rows) {
    const n = r.__line;
    const ch = r.channel ?? "";
    if (ch !== "" && !channels.includes(ch)) throw new Error(`ledger line ${n}: channel ${ch}`);
    const owner = ch || channels[0];
    const key = `${r.slug}\u0000${owner}`;
    if (seen.has(key)) throw new Error(`ledger line ${n}: ${r.slug} is listed twice for ${owner}`);
    seen.add(key);
    if (filled(r, "scheduled_at")) {
      try { parseInstant(r.scheduled_at.trim()); } catch { throw new Error(`ledger line ${n}: scheduled_at ${r.scheduled_at}`); }
    } else if (r.status === "handed") throw new Error(`ledger line ${n}: a handed post needs scheduled_at`); // the slot it was handed is taken by it
    for (const [field, allowed] of Object.entries(ENUMS)) {
      if (!(field in r)) continue;
      const v = r[field];
      if (v === "" && !REQUIRED.has(field)) continue;
      if (!allowed.includes(v)) throw new Error(`ledger line ${n}: ${field} ${v}`);
    }
    if ("check" in r && r.check !== "" && r.check !== "pass" && r.check !== "none" && !/^caught:\S.*$/.test(r.check)) {
      throw new Error(`ledger line ${n}: check ${r.check}`);
    }
  }
  return rows;
}

// ---------------------------------------------------------------- mode

/**
 * How far the calibration run is: posts the human approved that went out (a boqo_post_id from boqo, or a permalink the
 * person confirmed for a post published by hand) and that are scheduled or posted, against calibration_posts. A
 * `handed` post, given to the person and not yet confirmed, never counts. A post is its slug, on every channel at once: it counts once when any of its rows does.
 */
export function calibration(rows, config) {
  // A failed, canceled or abandoned post never went out, so only scheduled and posted rows count.
  const approved = new Set(rows.filter((r) => r.approval === "human" && (filled(r, "boqo_post_id") || filled(r, "permalink")) && ["scheduled", "posted"].includes(r.status)).map((r) => r.slug)).size;
  const needed = config.calibration_posts ?? 10;
  const mode = config.autopost;
  return { approved, needed, mode, switchDue: mode === "calibration" && approved >= needed };
}

// ---------------------------------------------------------------- budget

const cents = (x) => Math.round(x * 100) / 100;
const DEFAULT_DAY_USD = 10; // until the human sets one

function spend(spent, cap) {
  return { spentUsd: cents(spent), capUsd: cents(cap), leftUsd: Math.max(0, cents(cap - spent)) };
}

/** Today's and this month's spend against the caps, on the account's clock. `rows` are marketing/budget.csv rows. */
export function budget(rows, config, now) {
  const zone = requireZone(config);
  const today = dayKey(now, zone);
  const month = today.slice(0, 7);
  const dayCap = config.budget_usd_day ?? DEFAULT_DAY_USD;
  const monthCap = config.budget_usd_month ?? daysInMonth(today) * dayCap;
  const creditCap = config.credits_day ?? 0;
  let dayUsd = 0, monthUsd = 0, dayCredits = 0;
  for (const r of rows) {
    const date = (r.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`budget line ${r.__line ?? "?"}: date ${JSON.stringify(r.date)}`);
    const usd = r.usd === "" || r.usd == null ? 0 : Number(r.usd);
    const credits = r.credits === "" || r.credits == null ? 0 : Number(r.credits);
    if (!Number.isFinite(usd) || !Number.isFinite(credits)) throw new Error(`budget line ${r.__line ?? "?"}: not a number`);
    if (date.slice(0, 7) === month) monthUsd += usd;
    if (date === today) { dayUsd += usd; dayCredits += credits; }
  }
  const day = spend(dayUsd, dayCap);
  const mon = spend(monthUsd, monthCap);
  const credits = { spent: dayCredits, cap: creditCap, left: Math.max(0, creditCap - dayCredits) };
  return { day, month: mon, credits, over: cents(dayUsd) > day.capUsd || cents(monthUsd) > mon.capUsd || dayCredits > creditCap };
}

// ---------------------------------------------------------------- slot and queue

function countsByDay(taken, zone) {
  const byDay = {};
  for (const iso of taken) {
    const t = parseInstant(iso);
    const k = dayKey(t, zone);
    byDay[k] = (byDay[k] ?? 0) + 1;
  }
  return byDay;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/**
 * The START of the first posting window whose day has fewer than max_posts_per_day posts, which holds no post itself,
 * and which starts at least 60 minutes after `now`. `taken` is ISO instants already scheduled. Never inside a window.
 * `fromDay` (YYYY-MM-DD on the account's clock, optional) starts the search on that day instead of today, so a post
 * planned for a later day takes that day's slot without anyone computing a UTC offset by hand. A day before today
 * starts today.
 */
export function slot(config, taken, now, fromDay) {
  const zone = requireZone(config);
  if (!config.windows?.length) throw new Error("config windows is empty: no window to post in");
  const perDay = countsByDay(taken, zone);
  const takenWall = taken.map((iso) => {
    const w = wall(parseInstant(iso), zone);
    return { day: `${w.y}-${pad(w.m)}-${pad(w.d)}`, min: w.h * 60 + w.mi };
  });
  const max = config.max_posts_per_day ?? 2;
  let day = dayKey(now, zone);
  if (fromDay !== undefined) {
    if (typeof fromDay !== "string" || !DAY.test(fromDay) || addDays(fromDay, 0) !== fromDay) throw new Error(`--day ${JSON.stringify(fromDay)} is not a YYYY-MM-DD date`);
    if (fromDay > day) day = fromDay;
  }
  for (let i = 0; i < SEARCH_DAYS; i++, day = addDays(day, 1)) {
    if ((perDay[day] ?? 0) >= max) continue;
    for (const w of config.windows) {
      const start = zonedToUtc(day, w.from, zone);
      if (start.getTime() - now.getTime() < MIN_LEAD_MS) continue;
      const holds = takenWall.some((t) => t.day === day && t.min >= minutesOf(w.from) && t.min <= minutesOf(w.to));
      if (holds) continue;
      return { date: day, time: w.from, at: start.toISOString(), zone };
    }
  }
  throw new Error(`no free window in the next ${SEARCH_DAYS} days`);
}

/** Posts per account day from today on, and how many consecutive days starting TOMORROW hold at least one. */
export function queueDepth(taken, config, now) {
  const zone = requireZone(config);
  const today = dayKey(now, zone);
  const all = countsByDay(taken, zone);
  const byDay = {};
  for (const k of Object.keys(all).sort()) if (k >= today) byDay[k] = all[k];
  let daysAhead = 0;
  for (let d = addDays(today, 1); byDay[d]; d = addDays(d, 1)) daysAhead++;
  return { daysAhead, byDay };
}

// ---------------------------------------------------------------- norms, due checkpoints, verdicts, streak, followers

const HOUR = 3600 * 1000;
const MIN_OWN = 5; // own posts needed before a norm stops falling back to the research benchmark
const NORM_WINDOW = 10; // the norm is the median of the newest 10 ready posts
const LATE_AFTER_HOURS = 24; // a checkpoint read more than this long after its moment is late
const DEFAULT_BAND = [0.8, 1.25];

/** The main metric of each type (Fixed names). Awareness is follows per 1,000 views at 7 d. */
export const MAIN_METRIC = { reach: "views_72h", awareness: "follows_per_1000_views_7d", trust: "comments_7d", sale: "signups_7d" };
// A benchmark row counts only in its type's main metric; a rate is not comparable with a count.
const BENCH_METRICS = {
  reach: ["views_72h"],
  awareness: ["follows_per_1000_views_7d", "follows_per_1000_views"],
  trust: ["comments_7d"],
  sale: ["signups_7d"],
};
// Every metric a norm can be taken over, with the age a post needs before its value is final.
// reach waits 72 h; the rest 7 d (the verdict windows).
const METRICS = {
  views_72h: { hours: 72 },
  follows_per_1000_views_7d: { hours: 168 },
  comments_7d: { hours: 168 },
  signups_7d: { hours: 168 },
  sends: { hours: 168 },
  saves: { hours: 168 },
  reach: { hours: 168 },
  skip_3s: { hours: 168 },
};
const r2 = (x) => Math.round(x * 100) / 100;

/** The ```benchmarks block of strategy.md: lines `type | metric | value | source | date`. A row that is not in its type's main metric, is free text, has no number, has no source, or has a date that is not YYYY-MM-DD is left out. */
export function benchmarks(strategyMd) {
  const block = /^```benchmarks[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m.exec(String(strategyMd ?? ""));
  const out = {};
  if (!block) return out;
  for (const line of block[1].split(/\r?\n/)) {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const [type, metric, value, source, date] = cells;
    if (!TYPES.includes(type) || !BENCH_METRICS[type].includes(metric)) continue;
    const n = value === "" ? NaN : Number(value);
    if (!Number.isFinite(n) || n < 0) continue;
    // A claim without a source and a number without a date are not used.
    if (source === "" || !DAY.test(date) || addDays(date, 0) !== date) continue;
    out[type] = { metric, value: n, source, date }; // a later row for the same type replaces an earlier one
  }
  return out;
}

function numField(r, field) {
  const v = String(r[field] ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`ledger line ${r.__line ?? "?"}: ${field} ${v}`);
  return n;
}
function postedAt(r) {
  const v = String(r.posted_at ?? "").trim();
  if (v === "") throw new Error(`ledger line ${r.__line ?? "?"}: posted_at is empty on a posted row`);
  try {
    return parseInstant(v);
  } catch (e) {
    throw new Error(`ledger line ${r.__line ?? "?"}: posted_at ${v}`);
  }
}

/**
 * A row `mode` would pass but `due`, `norms`, `stops` and `streak` would die on: a posted row with no
 * instant, or any row whose filled posted_at is not an instant with its own offset.
 */
export function checkPostedAt(rows) {
  for (const r of rows) if (r.status === "posted" || String(r.posted_at ?? "").trim() !== "") postedAt(r);
}

/**
 * Follower growth around a post, estimated from account.csv readings (`date,read_at,followers,gained_week,source`):
 * the last reading at or before the post (within `hours`) against the last one within `hours` after it.
 * An estimate: any other post inside the window shares the gain. Nothing is invented when a side is missing.
 */
export function followerGain(accountRows, postedAtInstant, views7d, hours = 48) {
  const at = postedAtInstant instanceof Date ? postedAtInstant : parseInstant(postedAtInstant);
  const readings = [];
  for (const r of accountRows ?? []) {
    const v = String(r.read_at ?? "").trim();
    const f = String(r.followers ?? "").trim();
    if (v === "" || f === "") continue;
    let t;
    try {
      t = parseInstant(v);
    } catch {
      throw new Error(`account line ${r.__line ?? "?"}: read_at ${v}`);
    }
    const followers = Number(f);
    if (!Number.isFinite(followers)) throw new Error(`account line ${r.__line ?? "?"}: followers ${f}`);
    readings.push({ t: t.getTime(), followers });
  }
  readings.sort((a, b) => a.t - b.t);
  const span = hours * HOUR;
  const before = readings.filter((x) => x.t <= at.getTime() && at.getTime() - x.t <= span).at(-1);
  const after = readings.filter((x) => x.t > at.getTime() && x.t - at.getTime() <= span).at(-1);
  const views = views7d == null || views7d === "" ? null : Number(views7d);
  const gain = before && after ? after.followers - before.followers : null;
  const perThousand = gain !== null && Number.isFinite(views) && views > 0 ? r2((gain / views) * 1000) : null;
  return { gain, perThousand, data: "partial", follows_source: "estimate" };
}

/** { value, estimate } of a row's metric, or null when it isn't there. Awareness falls back to the account.csv estimate when `follows` is empty. */
function metricValue(r, metric, accountRows) {
  if (metric === "follows_per_1000_views_7d") {
    const views = numField(r, "views_7d");
    if (views === null || views <= 0) return null;
    const follows = numField(r, "follows");
    if (follows !== null) return { value: r2((follows / views) * 1000), estimate: r.follows_source === "estimate" };
    if (!accountRows) return null;
    const g = followerGain(accountRows, postedAt(r), views);
    return g.perThousand === null ? null : { value: g.perThousand, estimate: true };
  }
  const v = numField(r, metric);
  return v === null ? null : { value: v, estimate: false };
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The posts of `rows` (already one type) whose window for `metric` has passed and whose value is there, newest first. */
function ready(rows, metric, now, accountRows) {
  const { hours } = METRICS[metric];
  const out = [];
  for (const r of rows) {
    if (r.status !== "posted") continue;
    const at = postedAt(r);
    if (now.getTime() - at.getTime() < hours * HOUR) continue;
    const m = metricValue(r, metric, accountRows);
    if (m === null) continue;
    out.push({ at: at.getTime(), slug: r.slug, value: m.value, type_source: r.type_source });
  }
  return out.sort((a, b) => b.at - a.at || (a.slug < b.slug ? -1 : 1));
}
const medianOfNewest = (list) => {
  const take = list.slice(0, NORM_WINDOW);
  return { value: take.length ? median(take.map((x) => x.value)) : null, n: take.length };
};

/**
 * The median of one metric over the newest 10 ready posts in `rows`, pooled and by source. Posts with no value for it
 * are left out. The caller must pre-filter `rows` by type: this does not look at `type`. The window is 168 h for every
 * metric but views_72h (72 h); the 168 h for sends, saves, reach and skip_3s is a choice made here.
 */
export function metricNorm(rows, metric, now, accountRows) {
  if (!(metric in METRICS)) throw new Error(`metric ${JSON.stringify(metric)} has no norm`);
  const list = ready(rows, metric, now, accountRows);
  return {
    metric,
    ...medianOfNewest(list),
    bySource: {
      human: medianOfNewest(list.filter((x) => x.type_source === "human")),
      skill: medianOfNewest(list.filter((x) => x.type_source === "skill")),
    },
  };
}

/**
 * The norm per type: the median of the newest 10 ready posts of that type once there are 5, else the research
 * benchmark in the type's main metric, else null. `bySource` keeps who-chose-the-type apart; the norm pools both.
 * `accountRows` (optional) lets awareness posts without a counted `follows` use the account.csv estimate.
 */
export function norms(rows, bench, now, accountRows) {
  rows = rows.filter((r) => !isAd(r)); // bought views are no type's norm
  const out = {};
  for (const type of TYPES) {
    const metric = MAIN_METRIC[type];
    const own = metricNorm(rows.filter((r) => r.type === type), metric, now, accountRows);
    const b = bench?.[type];
    const benchOk = b && BENCH_METRICS[type].includes(b.metric) && Number.isFinite(b.value);
    let value = null, source = null;
    if (own.n >= MIN_OWN) { value = own.value; source = "own"; }
    else if (benchOk) { value = b.value; source = "research"; }
    out[type] = { metric, value, n: own.n, source, bySource: own.bySource };
    if (source === "research") Object.assign(out[type], { benchSource: b.source, benchDate: b.date });
  }
  return out;
}

const CHECKPOINTS = [
  { name: "+24h", hours: 24, field: "views_24h" },
  { name: "+72h", hours: 72, field: "views_72h" },
  { name: "+7d", hours: 168, field: "views_7d" },
  { name: "+28d", hours: 672, field: "signups_28d" },
];
/**
 * Checkpoints of posted rows that have come due and are still unread, with the post's real age. A checkpoint behind
 * a later one that is already read is not listed (its moment is gone), nor one inside a window a written verdict closed. `late` is a read more than 24 h past its moment (exactly 24 h is not late).
 */
export function due(rows, now) {
  const out = [];
  for (const r of rows) {
    if (r.status !== "posted") continue;
    const at = postedAt(r);
    // A written verdict closes its type's window (reach 72 h, the rest 7 d): a main metric read late stays empty (measure.md).
    const closed = filled(r, "verdict_at") && TYPES.includes(r.type) ? (r.type === "reach" ? 1 : 2) : -1;
    // max, not the last filled index: a filled +24h must not reopen a window the verdict closed.
    const lastRead = CHECKPOINTS.reduce((acc, c, i) => (filled(r, c.field) ? Math.max(acc, i) : acc), closed);
    CHECKPOINTS.forEach((c, i) => {
      if (i <= lastRead) return;
      const dueAt = at.getTime() + c.hours * HOUR;
      if (dueAt > now.getTime()) return;
      out.push({
        slug: r.slug,
        checkpoint: c.name,
        dueAt: new Date(dueAt).toISOString(),
        ageHours: Math.round(((now.getTime() - at.getTime()) / HOUR) * 10) / 10,
        late: now.getTime() - dueAt > LATE_AFTER_HOURS * HOUR,
        _t: dueAt,
      });
    });
  }
  return out.sort((a, b) => a._t - b._t || (a.slug < b.slug ? -1 : 1)).map(({ _t, ...x }) => x);
}

/** The main-metric value of a row, for the CLI to show beside its verdict. */
export function mainValue(r, accountRows) {
  if (!TYPES.includes(r.type)) return null;
  return metricValue(r, MAIN_METRIC[r.type], accountRows);
}

/**
 * Where a post's main metric sits against its type's norm: `above` over band[1] x norm, `below` under band[0] x norm,
 * else `within`; `no-data` without a value or a norm. data is `partial` for an estimate (and for no-data), else `full`.
 * `accountRows` (optional) supplies the follower estimate for an awareness post without a counted `follows`.
 */
export function verdict(r, norm, band = DEFAULT_BAND, accountRows) {
  if (isAd(r)) return { verdict: "no-data", data: "partial", why: "an ad post: its views are bought" };
  const m = mainValue(r, accountRows);
  if (m === null || norm?.value == null) return { verdict: "no-data", data: "partial" };
  const [lo, hi] = band;
  const data = m.estimate ? "partial" : "full";
  if (norm.value === 0) return { verdict: m.value > 0 ? "above" : "within", data };
  const ratio = m.value / norm.value;
  return { verdict: ratio > hi ? "above" : ratio < lo ? "below" : "within", data };
}

/** Days from..to (inclusive, YYYY-MM-DD on the account's clock) and how many of them hold a posted post. */
export function streak(rows, from, to, zone) {
  for (const [name, v] of [["from", from], ["to", to]]) {
    if (typeof v !== "string" || !DAY.test(v) || addDays(v, 0) !== v) throw new Error(`streak ${name} ${JSON.stringify(v)} is not a YYYY-MM-DD date`);
  }
  if (from > to) throw new Error(`streak: to ${to} is before from ${from}`);
  formatterFor(zone);
  const postDays = new Set();
  for (const r of rows) if (r.status === "posted") postDays.add(dayKey(postedAt(r), zone));
  let days = 0, withPost = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days++;
    if (postDays.has(d)) withPost++;
  }
  return { days, withPost };
}

// ---------------------------------------------------------------- stops (auto mode's self-stop)

export const FUNNEL = ["green", "yellow", "red"];
const DROP_FACTOR = 0.5; // "reach under half the norm"
const DROP_RUN = 3; // "three posts in a row"
const DROP_MIN_BASE = 3; // earlier verdict-ready posts a views median needs (a choice made here)
// A check catch is a rule the check caught. `caught:funnel` is the funnel holding a sale post, not a catch.
// A hold that waits on the human (its reason ends in `owed`, as in `caught:AI label test owed`) is not one either.
const NOT_A_CATCH = /^caught:(funnel$|.* owed$)/;
const isCheck = (r) => r.check === "pass" || (/^caught:/.test(r.check ?? "") && !NOT_A_CATCH.test(r.check));

/**
 * The newest three verdict-ready posts (views_72h read, 72 h past; with `since`, only posts after it) and, for each,
 * its baseline: the views_72h median of its type's verdict-ready posts from before the run (the newest 10 not among
 * the three, so the drops never lower their own norm), or, with fewer than 3 of those, the pooled median of every
 * earlier verdict-ready post (`basis: "pooled"`). With fewer than 3 earlier posts in all, no baseline.
 * `drop` is true when all three are under half their baseline. The medians come from the rows.
 */
export function dropRun(rows, now, { since } = {}) {
  const readyByType = {};
  // An ad post's views are bought: it is neither in the run nor in a baseline.
  for (const type of TYPES) readyByType[type] = ready(rows.filter((r) => r.type === type && !isAd(r)), "views_72h", now).map((x) => ({ ...x, type }));
  const all = TYPES.flatMap((type) => readyByType[type]).sort((a, b) => b.at - a.at || (a.slug < b.slug ? -1 : 1));
  const candidates = since ? all.filter((x) => x.at > since.getTime()) : all;
  const newest = candidates.slice(0, DROP_RUN);
  const inRun = new Set(newest.map((x) => x.slug));
  const earlier = all.filter((x) => !inRun.has(x.slug));
  const run = newest.map((p) => {
    let base = earlier.filter((x) => x.type === p.type).slice(0, NORM_WINDOW);
    let basis = "type";
    if (base.length < DROP_MIN_BASE) { base = earlier.slice(0, NORM_WINDOW); basis = "pooled"; }
    const baseline = base.length >= DROP_MIN_BASE ? median(base.map((x) => x.value)) : null;
    return { slug: p.slug, type: p.type, views_72h: p.value, baseline, basis: baseline === null ? null : basis, drop: baseline !== null && p.value < DROP_FACTOR * baseline };
  });
  return { drop: run.length === DROP_RUN && run.every((x) => x.drop), run };
}

/**
 * Whether auto-posting stops itself, and why. The reasons, in this order: `funnel red` (only red: yellow
 * does not stop); `two caught in a row` (the newest two checked posts both `caught:*`, never `caught:funnel`; a caught
 * post is held and has no posted_at, so "in a row" is the order of planned_for, then posted_at, then the ledger line);
 * `reach under half the norm three in a row` (dropRun; `since`, the config's resumed_at, starts the run after a
 * resume); `<channel> restricted` (`channel`, the one asked about: instagram unless named). `state` is
 * { funnel: green|yellow|red, igRestricted: boolean }; igRestricted keeps its name for every channel.
 */
export function stops(rows, state, now, { since, channel = "instagram" } = {}) {
  const reasons = [];
  if (state?.funnel === "red") reasons.push("funnel red");

  const checked = rows
    .filter((r) => TYPES.includes(r.type) && isCheck(r))
    .map((r) => ({ r, day: String(r.planned_for ?? "").trim() || (filled(r, "posted_at") ? postedAt(r).toISOString().slice(0, 10) : ""), at: filled(r, "posted_at") ? postedAt(r).getTime() : Infinity, line: r.__line ?? 0 }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.at - b.at || a.line - b.line));
  const lastTwo = checked.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((x) => x.r.check.startsWith("caught:"))) reasons.push("two caught in a row");

  if (dropRun(rows, now, { since }).drop) reasons.push("reach under half the norm three in a row");

  if (state?.igRestricted === true) reasons.push(`${channel} restricted`);
  return { stop: reasons.length > 0, reasons };
}

// ---------------------------------------------------------------- KPI: the account's week against its targets

/**
 * The account's KPIs in funnel order (<skill>/kpi.md): per stage one volume and the rates that feed it.
 * The three rates after the sign-up are counted over 28 days (a week holds too few sign-ups); the rest over one week.
 */
export const KPIS = [
  { kpi: "views_week", stage: "reach", kind: "volume" },
  { kpi: "views_per_post", stage: "reach", kind: "rate" },
  { kpi: "followers_gained_week", stage: "followers", kind: "volume" },
  { kpi: "follows_per_1000_views", stage: "followers", kind: "rate" },
  { kpi: "signups_week", stage: "conversion", kind: "volume" },
  { kpi: "signups_per_1000_views", stage: "conversion", kind: "rate" },
  { kpi: "activation_pct_28d", stage: "conversion", kind: "rate" },
  { kpi: "buyers_28d", stage: "sales", kind: "volume" },
  { kpi: "buyer_pct_28d", stage: "sales", kind: "rate" },
];
const SALES_KPIS = new Set(["activation_pct_28d", "buyers_28d", "buyer_pct_28d"]); // the 28-day ones
// A rate over too little is noise: below these it keeps its value, gets no verdict and is never the constraint (a choice made here, as MIN_OWN).
const MIN_POSTS = 3; // posts with a view count, for views_per_post
const MIN_VIEWS = 1000; // views, for a per-1,000-views rate
const MIN_SIGNUPS = 5; // sign-ups, for a rate after the sign-up
const BASELINE_WEEKS = 4; // our own baseline is the median of up to this many weeks before the judged one
const BASELINE_MIN = 2; // one earlier week is not a baseline
const READING_SLACK_DAYS = 3; // a follower reading this many days off a week's edge still counts for it
const NOT_A_POST = new Set(["-", "funnel-probe"]); // the untagged bucket and funnel-check's own probes are never a post's sign-ups

/** The ```kpi block of strategy.md: lines `kpi | value | source | date`. A row for an unknown KPI, with no number, no source or no YYYY-MM-DD date is left out. */
export function kpiTargets(strategyMd) {
  const block = /^```kpi[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m.exec(String(strategyMd ?? ""));
  const out = {};
  if (!block) return out;
  for (const line of block[1].split(/\r?\n/)) {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    const [name, value, source, date] = cells;
    if (!KPIS.some((k) => k.kpi === name)) continue;
    const n = value === "" ? NaN : Number(value);
    if (!Number.isFinite(n) || n < 0) continue;
    // A claim without a source and a number without a date are not used.
    if (source === "" || !DAY.test(date) || addDays(date, 0) !== date) continue;
    out[name] = { value: n, source, date }; // a later row for the same KPI replaces an earlier one
  }
  return out;
}

/** The ISO week (YYYY-Www) that holds a YYYY-MM-DD key. */
function isoWeek(key) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3); // the week's Thursday names its year
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - jan4) / (24 * HOUR) - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

/** Why the saved campaigns reply can't answer for the window from..to, or null when it can. */
function campaignsGap(campaigns, from, to, zone, now) {
  if (campaigns == null) return "no campaigns reply (--campaigns)";
  if (typeof campaigns.byCampaign !== "object" || campaigns.byCampaign === null) return `the campaigns file has no byCampaign (${String(campaigns.unavailable ?? campaigns.error ?? "not a campaigns reply")})`;
  if (!Number.isFinite(campaigns.days)) return "the campaigns reply names no days";
  let readAt = now;
  if (typeof campaigns.readAt === "string") {
    try { readAt = parseInstant(campaigns.readAt); } catch { readAt = now; }
  }
  const covered = readAt.getTime() - campaigns.days * 24 * HOUR <= zonedToUtc(from, "00:00", zone).getTime();
  if (!covered) return `the campaigns reply covers ${campaigns.days} days, not back to ${from}`;
  // A sign-ups file typed by hand is known only up to its newest row: a day past it is not typed yet, not 0.
  if (campaigns.through != null && !(typeof campaigns.through === "string" && DAY.test(campaigns.through))) return `the campaigns reply's through ${JSON.stringify(campaigns.through)} is not a YYYY-MM-DD date`;
  if (campaigns.through != null && to > campaigns.through) return `the sign-ups file ends ${campaigns.through}`;
  return null;
}

/** Everything the account did in the days from..to (the account's clock): posts, views, followers, sign-ups, spend. */
function windowTotals({ ledger, readings, budgetRows, campaigns, zone, now }, from, to) {
  let posts = ledger
    .filter((r) => r.status === "posted")
    .map((r) => ({ r, at: postedAt(r) }))
    .filter(({ at }) => { const d = dayKey(at, zone); return d >= from && d <= to; })
    .sort((a, b) => b.at - a.at); // newest first: a campaign two posts share is the newest one's (measure.md, Attribution)
  // An ad post's views are bought: it adds no post and no views to the reach and follower stages, and its campaign's
  // sign-ups still count below.
  const all = posts;
  const adPosts = all.filter(({ r }) => isAd(r)).length;
  posts = all.filter(({ r }) => !isAd(r));
  const why = {};

  // Views: each post at its newest read. A post with no read adds nothing and is counted apart.
  let views = 0, withViews = 0, at7d = 0;
  const postViews = new Map();
  for (const { r } of posts) {
    const v7 = numField(r, "views_7d");
    const v = v7 ?? numField(r, "views_72h") ?? numField(r, "views_24h");
    if (v === null) continue;
    postViews.set(r, v);
    views += v;
    withViews++;
    if (v7 !== null) at7d++;
  }
  if (posts.length === 0) why.views = "no posts in the week";
  else if (withViews === 0) why.views = "no post in the week has a view count read";

  // Followers: the last reading on or before the week's last day against the last one before its first day.
  const lastUpTo = (day) => readings.filter((x) => x.day <= day).at(-1);
  const end = lastUpTo(to);
  const start = lastUpTo(addDays(from, -1));
  let gained = null;
  if (!end || end.day < addDays(to, -(READING_SLACK_DAYS - 1))) why.followers = `no follower reading within ${READING_SLACK_DAYS} days of ${to}`;
  else if (!start || start.day < addDays(from, -READING_SLACK_DAYS)) why.followers = `no follower reading within ${READING_SLACK_DAYS} days before ${from}`;
  else gained = end.followers - start.followers;

  // Sign-ups: only under the campaigns the window's own posts carry, each campaign once. A reply that names no campaign
  // but "-" (a sign-ups file typed without campaigns) ties no sign-up to a post: blind, not 0.
  const gap = campaignsGap(campaigns, from, to, zone, now);
  const untied = gap === null && !Object.keys(campaigns.byCampaign).some((c) => c !== "-");
  const seen = new Set();
  const paths = new Map();
  const sums = { signups: 0, activated: 0, buyers: 0 };
  for (const { r } of all) {
    const key = `${r.segment ?? ""}\u0000${r.rubric ?? ""}`;
    if (!paths.has(key)) paths.set(key, { segment: r.segment ?? "", rubric: r.rubric ?? "", posts: 0, views: 0, signups: 0, activated: 0, buyers: 0 });
    const p = paths.get(key);
    if (!isAd(r)) {
      p.posts++;
      p.views += postViews.get(r) ?? 0;
    }
    const c = String(r.utm_campaign ?? "").trim();
    if (c === "" || NOT_A_POST.has(c) || seen.has(c)) continue;
    seen.add(c);
    const got = gap === null ? campaigns.byCampaign[c] : null;
    if (!got) continue;
    for (const k of Object.keys(sums)) {
      // An entry without activated or buyers as a number leaves that stage blind (and its path's figure), never 0.
      const n = k === "signups" ? Number(got[k] ?? 0) : got[k];
      if (k !== "signups" && !Number.isFinite(n)) { why[k] ??= `the campaigns reply has no ${k} for ${c}`; p[k] = null; continue; }
      sums[k] += n;
      if (p[k] !== null) p[k] += n;
    }
  }
  if (gap !== null) why.signups = gap;
  else if (untied) why.signups = "the sign-ups file names no campaign";
  else if (all.length === 0) why.signups = "no posts in the week";
  else if (seen.size === 0) why.signups = "no post in the window carries a campaign";
  const blind = why.signups !== undefined;

  let signupsAll = null;
  if (gap === null && campaigns.byDay && typeof campaigns.byDay === "object") {
    signupsAll = 0;
    for (const [day, n] of Object.entries(campaigns.byDay)) if (day >= from && day <= to) signupsAll += Number(n);
  }
  let usd = 0, credits = 0;
  for (const b of budgetRows) {
    if (!(b.date >= from && b.date <= to)) continue;
    usd += Number(b.usd || 0);
    credits += Number(b.credits || 0);
  }
  return {
    from, to, posts: posts.length, adPosts, reads: { posts: posts.length, withViews, at7d },
    views: why.views ? null : views,
    followers: { start: start?.followers ?? null, end: end?.followers ?? null },
    gained,
    signups: blind ? null : sums.signups,
    activated: blind || why.activated ? null : sums.activated,
    buyers: blind || why.buyers ? null : sums.buyers,
    paths: [...paths.values()]
      .map((p) => (blind ? { ...p, signups: null, activated: null, buyers: null } : p))
      .sort((a, b) => (b.buyers ?? 0) - (a.buyers ?? 0) || (b.signups ?? 0) - (a.signups ?? 0) || b.views - a.views || (a.rubric < b.rubric ? -1 : 1)),
    signupsAll,
    spend: { usd: r2(usd), credits: r2(credits) },
    why,
  };
}

const perPost = (w) => (w.views === null ? null : r2(w.views / w.reads.withViews));
/**
 * One week's six KPI values, why a missing one is missing, and which rates stand on too little. `w` is the channel's
 * window (reach, followers); `s` is the whole account's (conversion), the same window when the account has one channel.
 */
function weekValues(w, s = w) {
  const noViews = (x) => x.why.views ?? (x.views === 0 ? "no views to divide by" : undefined);
  const values = {
    views_week: w.views,
    views_per_post: perPost(w),
    followers_gained_week: w.gained,
    follows_per_1000_views: w.gained === null || !w.views ? null : r2((w.gained / w.views) * 1000),
    signups_week: s.signups,
    signups_per_1000_views: s.signups === null || !s.views ? null : r2((s.signups / s.views) * 1000),
  };
  const why = {
    views_week: w.why.views,
    views_per_post: w.why.views,
    followers_gained_week: w.why.followers,
    follows_per_1000_views: w.why.followers ?? noViews(w),
    signups_week: s.why.signups,
    signups_per_1000_views: s.why.signups ?? noViews(s),
  };
  const fewPosts = w.reads.withViews < MIN_POSTS ? `thin: ${w.reads.withViews} posts with a view count, a rate needs ${MIN_POSTS}` : undefined;
  const fewViews = (x) => ((x.views ?? 0) < MIN_VIEWS ? `thin: ${x.views ?? 0} views, a rate needs ${MIN_VIEWS}` : undefined);
  const thin = { views_per_post: fewPosts, follows_per_1000_views: fewViews(w), signups_per_1000_views: fewViews(s) };
  return { values, why, thin };
}
/** The three KPIs of a 28-day window. A buyer is any sign-up that bought; the campaigns reply counts them, we do not tell one purchase from another. */
function salesValues(s) {
  const none = (k) => s.why.signups ?? s.why[k] ?? "no sign-up to convert";
  const few = (s.signups ?? 0) < MIN_SIGNUPS ? `thin: ${s.signups ?? 0} sign-ups, a rate needs ${MIN_SIGNUPS}` : undefined;
  return {
    values: {
      activation_pct_28d: !s.signups || s.activated === null ? null : r2((s.activated / s.signups) * 100),
      buyers_28d: s.buyers,
      buyer_pct_28d: !s.signups || s.buyers === null ? null : r2((s.buyers / s.signups) * 100),
    },
    why: { activation_pct_28d: none("activated"), buyers_28d: s.why.signups ?? s.why.buyers, buyer_pct_28d: none("buyers") },
    thin: { activation_pct_28d: few, buyer_pct_28d: few },
  };
}
/** A week in short: posts, views and followers from the channel's window `w`; sign-ups and spend from the account's `s`. */
const brief = (w, s = w) => ({
  week: isoWeek(w.from), from: w.from, to: w.to, posts: w.posts, adPosts: w.adPosts, reads: w.reads, views: w.views, viewsPerPost: perPost(w),
  followers: w.followers, followersGained: w.gained, signups: s.signups, activated: s.activated, buyers: s.buyers,
  signupsAll: s.signupsAll, spend: s.spend, costPerSignup: s.signups ? r2(s.spend.usd / s.signups) : null,
});

/**
 * The account's KPIs for a roll-up of the week from..to (the ISO week that ended, on the account's clock).
 * - `judged` is the week BEFORE it: every post there is at least 7 days old, so its windows have closed. Only it gets verdicts.
 * - `interim` is the week that ended: values only. An open window is never judged (measure.md).
 * - A KPI's target is the sourced standard from strategy.md's ```kpi block; without one, our own median of the earlier
 *   weeks; `buyers_28d` takes the human's `sales_goal_28d` when it is set. The verdict uses the config's band.
 * - `constraint` is the rate furthest below its target (the earlier stage on a tie), or null when no rate is below.
 * - A rate over too little (`thin`) keeps its value and gets no verdict; a KPI that could not be read (`blind`) is null, never 0.
 * - `sales` is the 28 days ending with the judged week: what sold, by which path, and what stays unattributed.
 * - The reach and follower stages are the channel's (`ledger`, `account`); the conversion and sales stages are the
 *   whole account's (`salesLedger`, every channel's rows; default `ledger`): a sign-up can't be tied to a channel, and a
 *   campaign two channels' posts carry counts once. The answer says so with `salesScope: "account"`.
 * - A row with `ad: yes` adds no post and no views (its views are bought), and is counted as `adPosts`; the sign-ups
 *   under its campaign count in the conversion and sales stages as any campaign's.
 * `campaigns` is a saved campaigns reply (or null); `account` and `budgetRows` are parsed CSV rows; `config` is the
 * account's (parseConfig's, not one channel's), so the back-plan's capacity is every channel's max_posts_per_day.
 */
export function kpi({ ledger, salesLedger = ledger, account, budgetRows, campaigns, targets, config, from, to, now }) {
  for (const [name, v] of [["from", from], ["to", to]]) {
    if (typeof v !== "string" || !DAY.test(v) || addDays(v, 0) !== v) throw new Error(`kpi ${name} ${JSON.stringify(v)} is not a YYYY-MM-DD date`);
  }
  if (addDays(from, 6) !== to) throw new Error(`kpi needs a 7-day window (the week that ended): ${from} to ${to} is not one`);
  const zone = requireZone(config);
  const band = config.verdict_band ?? DEFAULT_BAND;
  const readings = [];
  for (const r of account ?? []) {
    const v = String(r.read_at ?? "").trim();
    const f = String(r.followers ?? "").trim();
    if (v === "" || f === "" || !Number.isFinite(Number(f))) continue;
    let t;
    try { t = parseInstant(v); } catch { throw new Error(`account line ${r.__line ?? "?"}: read_at ${v}`); }
    readings.push({ t: t.getTime(), day: dayKey(t, zone), followers: Number(f) });
  }
  readings.sort((a, b) => a.t - b.t);
  const ctx = { ledger, readings, budgetRows: budgetRows ?? [], campaigns: campaigns ?? null, zone, now };
  const sctx = { ...ctx, ledger: salesLedger };
  const both = (a, b) => [windowTotals(ctx, a, b), windowTotals(sctx, a, b)]; // [the channel's, the account's]

  const interim = both(from, to);
  const jFrom = addDays(from, -7), jTo = addDays(to, -7);
  const judged = both(jFrom, jTo);
  const sFrom = addDays(jTo, -27);
  const sales = windowTotals(sctx, sFrom, jTo);
  const salesBefore = salesValues(windowTotals(sctx, addDays(sFrom, -28), addDays(jTo, -28))).values;
  const salesLastWeek = salesValues(windowTotals(sctx, addDays(sFrom, -7), addDays(jTo, -7))).values; // the same 28 days, one roll-up ago
  const earlier = [];
  for (let i = 1; i <= BASELINE_WEEKS; i++) earlier.push(weekValues(...both(addDays(jFrom, -7 * i), addDays(jTo, -7 * i))).values);

  const wk = weekValues(...judged), sl = salesValues(sales);
  const values = { ...wk.values, ...sl.values };
  const whys = { ...wk.why, ...sl.why };
  const thins = { ...wk.thin, ...sl.thin };
  const goal = config.sales_goal_28d ?? null;
  const place = (value, against) => {
    if (against === 0) return value > 0 ? "above" : "within";
    const ratio = value / against;
    return ratio > band[1] ? "above" : ratio < band[0] ? "below" : "within";
  };

  const kpis = KPIS.map(({ kpi: name, stage, kind }) => {
    const value = values[name];
    const isSales = SALES_KPIS.has(name);
    let baseline = null, baselineWeeks = 0;
    if (isSales) {
      if (salesBefore[name] !== null) { baseline = salesBefore[name]; baselineWeeks = 4; }
    } else {
      const xs = earlier.map((e) => e[name]).filter((x) => x !== null);
      baselineWeeks = xs.length;
      if (xs.length >= BASELINE_MIN) baseline = r2(median(xs));
    }
    let target = null, basis = null, source = null, date = null;
    if (name === "buyers_28d" && goal !== null) { target = goal; basis = "goal"; source = "config sales_goal_28d"; }
    else if (targets?.[name]) { ({ value: target, source, date } = targets[name]); basis = "standard"; }
    else if (baseline !== null) { target = baseline; basis = "own"; source = isSales ? "ours: the 28 days before" : `ours: median of ${baselineWeeks} earlier weeks`; }
    const prev = isSales ? salesLastWeek[name] : earlier[0][name];
    const out = { kpi: name, stage, kind, value, target, basis, source, date, ratio: null, verdict: "no-data", baseline, baselineWeeks, trend: "none", prev, belowRun: 0 };
    if (value === null) out.why = whys[name] ?? "not read";
    else if (thins[name]) out.why = thins[name]; // the value stands; a verdict on it would be noise
    else if (target === null) {
      out.why = isSales
        ? `no ${name === "buyers_28d" ? "goal (config sales_goal_28d), no " : ""}standard, and the 28 days before have no value`
        : `no standard, and fewer than ${BASELINE_MIN} earlier weeks have a value`;
    } else {
      out.ratio = target === 0 ? null : r2(value / target);
      out.verdict = place(value, target);
      // Below now, and below one roll-up ago against the same target: two running (measure.md, the research trigger).
      if (out.verdict === "below") out.belowRun = prev !== null && place(prev, target) === "below" ? 2 : 1;
    }
    if (value !== null && baseline !== null) out.trend = { above: "up", within: "flat", below: "down" }[place(value, baseline)];
    return out;
  });

  let constraint = null;
  for (const k of kpis) {
    if (k.kind !== "rate" || k.verdict !== "below" || k.ratio === null) continue;
    if (constraint === null || k.ratio < constraint.ratio) constraint = { kpi: k.kpi, stage: k.stage, ratio: k.ratio };
  }

  // What stays outside every post: the untagged bucket, and campaigns no ledger row carries.
  const counts = (c) => ({ signups: Number(c?.signups ?? 0), activated: Number(c?.activated ?? 0), buyers: Number(c?.buyers ?? 0) });
  let untagged = null, otherCampaigns = null;
  if (sales.why.signups === undefined || campaignsGap(ctx.campaigns, sFrom, jTo, zone, now) === null) {
    const ours = new Set(salesLedger.map((r) => String(r.utm_campaign ?? "").trim()).filter(Boolean));
    untagged = counts(ctx.campaigns.byCampaign["-"]);
    otherCampaigns = counts(null);
    for (const [name, c] of Object.entries(ctx.campaigns.byCampaign)) {
      if (NOT_A_POST.has(name) || ours.has(name)) continue;
      const x = counts(c);
      for (const k of Object.keys(otherCampaigns)) otherCampaigns[k] += x[k];
    }
  }

  let backplan = null;
  if (goal !== null) {
    const capacityPosts = 28 * config.channels.reduce((n, ch) => n + channelConfig(config, ch).max_posts_per_day, 0);
    const base = { goal, buyers: sales.buyers, needSignups: null, needViews: null, needPosts: null, capacityPosts, feasible: null };
    const eps = 1e-9;
    if (!sales.buyers || !sales.signups) backplan = { ...base, why: "buyer_pct_28d is 0 or unread: no sale to plan back from" };
    else if (!sales.views) backplan = { ...base, why: "signups_per_1000_views is unread over the 28 days: no views to plan back from" };
    else {
      const needSignups = Math.ceil((goal * sales.signups) / sales.buyers - eps);
      const needViews = Math.ceil((needSignups * sales.views) / sales.signups - eps);
      const needPosts = Math.ceil((needViews * sales.reads.withViews) / sales.views - eps);
      backplan = { ...base, needSignups, needViews, needPosts, feasible: needPosts <= capacityPosts };
    }
  }

  return {
    judged: brief(...judged),
    adPosts: judged[0].adPosts, // the judged week's ad posts on this channel: their views are bought, and the report names them
    interim: { ...brief(...interim), open: true },
    kpis,
    constraint,
    blind: kpis.filter((k) => k.value === null).map((k) => k.kpi),
    thin: kpis.filter((k) => k.value !== null && thins[k.kpi]).map((k) => k.kpi),
    sales: {
      from: sFrom, to: jTo, posts: sales.posts, adPosts: sales.adPosts, views: sales.views, signups: sales.signups, activated: sales.activated, buyers: sales.buyers,
      paths: sales.paths, untagged, otherCampaigns, spend: sales.spend,
      costPerBuyer: sales.buyers ? r2(sales.spend.usd / sales.buyers) : null,
    },
    backplan,
    band,
    salesScope: "account",
  };
}

// ---------------------------------------------------------------- sign-ups typed by hand

/**
 * The rows of marketing/signups.csv (date, campaign, signups, activated, buyers, note) as the campaigns reply `kpi`
 * reads: the last `days` days on the account's clock (today included) summed per campaign into `byCampaign` (a row
 * with no campaign is a total not tied to a post: it is summed under "-", the untagged bucket) and every row summed per
 * day into `byDay`. `through` is the newest date of any row, inside the window or not: how far the file is known.
 * Every row is checked, inside the window or not. Throws `signups line <n>: <field> <value>`, and
 * `signups line <n>: date <value> is after today` for a day the account's clock has not reached.
 */
export function campaignsFromSignups(rows, { days, now, zone }) {
  const today = dayKey(now, zone);
  const from = addDays(today, -(days - 1));
  const count = (r, field, emptyIs0) => {
    const v = String(r[field] ?? "").trim();
    if (v === "" && emptyIs0) return 0;
    if (!/^\d+$/.test(v)) throw new Error(`signups line ${r.__line}: ${field} ${v}`);
    return Number(v);
  };
  const byCampaign = {};
  const byDay = {};
  let through = null;
  for (const r of rows) {
    const date = String(r.date ?? "").trim();
    if (!DAY.test(date) || addDays(date, 0) !== date) throw new Error(`signups line ${r.__line}: date ${date}`);
    if (date > today) throw new Error(`signups line ${r.__line}: date ${date} is after today`);
    const n = { signups: count(r, "signups", false), activated: count(r, "activated", true), buyers: count(r, "buyers", true) };
    if (through === null || date > through) through = date;
    if (date < from) continue;
    byDay[date] = (byDay[date] ?? 0) + n.signups;
    const c = String(r.campaign ?? "").trim() || "-";
    const sum = (byCampaign[c] ??= { signups: 0, activated: 0, buyers: 0 });
    for (const k of Object.keys(sum)) sum[k] += n[k];
  }
  return { readAt: now.toISOString(), days, through, byCampaign, byDay };
}

// ---------------------------------------------------------------- files and the command line

/** The instants of a saved `list_schedule` reply that count: not canceled or failed, and (when the post names an account) this one. */
export function takenFromSchedule(reply, config) {
  const posts = Array.isArray(reply) ? reply : reply?.posts;
  if (!Array.isArray(posts)) throw new Error("the schedule file has no posts array");
  const out = [];
  for (const p of posts) {
    if (["canceled", "failed"].includes(p.status)) continue;
    const owner = p.accountId ?? p.socialAccountId ?? p.account_id;
    if (owner != null && config.account_id && String(owner) !== config.account_id) continue;
    if (!p.scheduledAt) continue;
    out.push(p.scheduledAt);
  }
  return out;
}

/** The rows of marketing/queue.md's table. */
export function queueRows(md) {
  const rows = [];
  for (const line of String(md).split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (cells[0] === "slug" && cells[1] === "stage") continue;
    const [slug, stage, type, rubric, tier, forDate, file, note] = cells;
    rows.push({ slug, stage, type, rubric, tier, for: forDate, file, note });
  }
  return rows;
}

const ok = (o) => ({ code: 0, line: JSON.stringify(o) });
const fail = (msg) => ({ code: 1, line: JSON.stringify({ error: String(msg) }) });
const USAGE = "usage: mode | budget | slot | queue | norms | due | verdict <slug> | streak --from <date> --to <date> | followers <slug> | stops --funnel <green|yellow|red> --restricted <yes|no> [--since <ISO>] | kpi --from <date> --to <date> [--campaigns <campaigns.json>] | campaigns [--days <1-3650>]  [--dir <repo>] [--now <ISO>] [--taken <list_schedule.json>] [--day <YYYY-MM-DD> (slot only)] [--channel <name> (all but mode and budget)]";
const COMMANDS = new Set(["mode", "budget", "slot", "queue", "norms", "due", "verdict", "streak", "followers", "stops", "kpi", "campaigns"]);
const NEEDS_SLUG = new Set(["verdict", "followers"]);
const FLAG_NAMES = ["--dir", "--now", "--taken", "--day", "--from", "--to", "--funnel", "--restricted", "--since", "--campaigns", "--channel", "--days"];

/** The channel a command works on: --channel, which may be left out only when the config lists one channel. */
function pickChannel(config, name) {
  if (name === undefined && config.channels.length === 1) return config.channels[0];
  if (!config.channels.includes(name)) throw new Error(`--channel wants one of: ${config.channels.join(", ")}`);
  return name;
}

function flags(args, command) {
  const out = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) { positional.push(a); continue; }
    if (!FLAG_NAMES.includes(a)) throw new Error(USAGE);
    if (args[i + 1] === undefined) throw new Error(`${a} needs a value`);
    out[a.slice(2)] = args[++i];
  }
  if (NEEDS_SLUG.has(command)) {
    if (positional.length !== 1) throw new Error(`${command} needs one <slug>`);
    out.slug = positional[0];
  } else if (positional.length) throw new Error(USAGE);
  return out;
}
async function readOptional(deps, path) {
  try {
    return await deps.readFile(path, "utf8");
  } catch (e) {
    if (e?.code === "ENOENT") return "";
    throw e;
  }
}

/**
 * norms, due, verdict, streak, followers, stops and kpi: all read marketing/ledger.csv; the estimate-aware ones also
 * read account.csv. Both are narrowed to `channels[0]` (`config` is already its channelConfig); only `due` without
 * --channel gets every channel in `channels` and walks them all, and `kpi` gets every channel's ledger rows too, for
 * its conversion and sales stages. An account.csv `channel` outside `channels` throws `account line <n>: channel <value>`.
 */
async function stateCommand(command, f, { deps, at, whole, config, channels, now }) {
  const all = ledgerRows(await readOptional(deps, at("ledger.csv")), whole.channels);
  const ledger = scopeRows(all, whole, channels[0]);
  if (command === "stops") {
    // Both are today's readings (the funnel step; the account-status screenshot and the human), so neither has a default.
    if (!FUNNEL.includes(f.funnel)) throw new Error(`stops needs --funnel green|yellow|red, got ${JSON.stringify(f.funnel ?? "")}`);
    if (!["yes", "no"].includes(f.restricted)) throw new Error(`stops needs --restricted yes|no, got ${JSON.stringify(f.restricted ?? "")}`);
    const state = { funnel: f.funnel, igRestricted: f.restricted === "yes" };
    // --since wins; else config.md's resumed_at (written by `config resume`), so a resume starts a new drop run.
    const sinceRaw = f.since ?? config.resumed_at ?? null;
    const since = sinceRaw === null ? null : parseInstant(sinceRaw);
    const res = stops(ledger, state, now, { since, channel: channels[0] });
    const { run } = dropRun(ledger, now, { since });
    return ok({ ...res, ...state, since: since ? since.toISOString() : null, run });
  }
  const accountAll = parseCsv(await readOptional(deps, at("account.csv")));
  for (const r of accountAll) if ((r.channel ?? "") !== "" && !whole.channels.includes(r.channel)) throw new Error(`account line ${r.__line}: channel ${r.channel}`);
  const account = scopeRows(accountAll, whole, channels[0]);
  if (command === "kpi") {
    if (f.from === undefined || f.to === undefined) throw new Error("kpi needs --from <date> and --to <date>: the week that ended");
    // The saved campaigns reply. Without it the conversion and sales KPIs are blind, never zero.
    const campaigns = f.campaigns ? JSON.parse(await deps.readFile(f.campaigns, "utf8")) : null;
    const budgetRows = parseCsv(await readOptional(deps, at("budget.csv")));
    const strategy = await readOptional(deps, at("strategy.md"));
    const targets = kpiTargets(strategy);
    // `block: false` means the research has not sourced the standards yet (measure.md, the research trigger).
    const standards = { block: /^```kpi[ \t]*$/m.test(strategy), rows: Object.keys(targets).length };
    return ok({ ...kpi({ ledger, salesLedger: all, account, budgetRows, campaigns, targets, config: whole, from: f.from, to: f.to, now }), standards });
  }
  if (command === "due") {
    // Each channel's list is in time order; the merge keeps that, and the config's channel order on a tie (a stable sort).
    const items = channels.flatMap((ch) => due(scopeRows(all, whole, ch), now).map((x) => ({ ...x, channel: ch })));
    return ok({ due: items.sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)) });
  }
  if (command === "streak") {
    if (f.from === undefined || f.to === undefined) throw new Error("streak needs --from <date> and --to <date>");
    return ok({ from: f.from, to: f.to, ...streak(ledger, f.from, f.to, requireZone(config)) });
  }
  const bench = benchmarks(await readOptional(deps, at("strategy.md")));
  if (command === "norms") return ok(norms(ledger, bench, now, account));
  const r = ledger.find((x) => x.slug === f.slug);
  if (!r) throw new Error(`no ledger row with slug ${JSON.stringify(f.slug)}`);
  if (command === "followers") {
    if (!r.posted_at) throw new Error(`${f.slug} has no posted_at`);
    return ok({ slug: r.slug, ...followerGain(account, parseInstant(r.posted_at), r.views_7d === "" ? null : Number(r.views_7d)) });
  }
  // The post is left out of its own norm, so it isn't judged against itself.
  const norm = norms(ledger.filter((x) => x.slug !== r.slug), bench, now, account)[r.type];
  const m = mainValue(r, account);
  const v = verdict(r, norm, config.verdict_band ?? DEFAULT_BAND, account);
  return ok({ slug: r.slug, type: r.type, metric: norm?.metric ?? null, value: m?.value ?? null, norm: norm ? { value: norm.value, n: norm.n, source: norm.source } : null, band: config.verdict_band ?? DEFAULT_BAND, ...v });
}

/** The command line. deps: { readFile, now, root? } where root is the default --dir. */
export async function run(argv, deps) {
  const [command, ...rest] = argv;
  if (!COMMANDS.has(command)) return fail(USAGE);
  try {
    const f = flags(rest, command);
    const dir = f.dir ?? deps.root;
    if (!dir) throw new Error("no --dir and no default repo root");
    const at = (name) => (isAbsolute(name) ? name : join(dir, "marketing", name));
    const now = f.now ? parseInstant(f.now) : deps.now();
    const whole = parseConfig(await deps.readFile(at("config.md"), "utf8"));
    // mode and budget count the account as a whole: a post is its slug, on whichever channels it went to.
    if (f.channel !== undefined && ["mode", "budget"].includes(command)) throw new Error("--channel does not apply to mode and budget: they count the whole account");
    if (f.channel !== undefined && command === "campaigns") throw new Error("--channel does not apply to campaigns: a campaign is a post's, on whichever channels it went to");
    if (f.days !== undefined && command !== "campaigns") throw new Error("--days applies to campaigns only");
    if (command === "campaigns") {
      const days = f.days === undefined ? 90 : /^\d+$/.test(f.days) ? Number(f.days) : NaN;
      if (!(days >= 1 && days <= 3650)) throw new Error(`--days wants a whole number from 1 to 3650, got ${JSON.stringify(f.days)}`);
      let text;
      try {
        text = await deps.readFile(at("signups.csv"), "utf8");
      } catch (e) {
        if (e?.code === "ENOENT") return ok({ unavailable: "no marketing/signups.csv" });
        throw e;
      }
      const rows = parseCsv(text);
      if (rows.length === 0) return ok({ unavailable: "marketing/signups.csv has no rows" }); // no rows is no data, not zero sign-ups
      return ok(campaignsFromSignups(rows, { days, now, zone: requireZone(whole) }));
    }
    if (command === "mode") {
      const rows = ledgerRows(await readOptional(deps, at("ledger.csv")), whole.channels);
      checkPostedAt(rows);
      return ok(calibration(rows, whole));
    }
    if (command === "budget") return ok(budget(parseCsv(await readOptional(deps, at("budget.csv"))), whole, now));
    if (f.day !== undefined && command !== "slot") throw new Error("--day applies to slot only");
    if ((f.from !== undefined || f.to !== undefined) && !["streak", "kpi"].includes(command)) throw new Error("--from and --to apply to streak and kpi only");
    if (f.campaigns !== undefined && command !== "kpi") throw new Error("--campaigns applies to kpi only");
    if ((f.funnel !== undefined || f.restricted !== undefined || f.since !== undefined) && command !== "stops") throw new Error("--funnel, --restricted and --since apply to stops only");
    // The rest work on one channel, resolved once here; due without --channel lists every channel's checkpoints.
    const channels = command === "due" && f.channel === undefined ? whole.channels : [pickChannel(whole, f.channel)];
    const config = channelConfig(whole, channels[0]);
    // The schedule holds every connected account's posts: the channel's account_id keeps only its own. With several
    // channels, one with no account_id has no boqo account (its posts are handed over), so the schedule has none of its posts.
    // Taken also holds what the person publishes by hand on this channel: scheduled_at of its `handed` rows, and
    // posted_at of its `posted` rows without a boqo_post_id (boqo's own posts are the schedule's to list).
    const takenFile = async () => {
      const scheduled = f.taken && !(whole.channels.length > 1 && !config.account_id) ? takenFromSchedule(JSON.parse(await deps.readFile(f.taken, "utf8")), config) : [];
      const rows = scopeRows(ledgerRows(await readOptional(deps, at("ledger.csv")), whole.channels), whole, config.channel);
      const handed = rows.filter((r) => r.status === "handed").map((r) => r.scheduled_at.trim());
      const byHand = rows.filter((r) => r.status === "posted" && !filled(r, "boqo_post_id")).map((r) => postedAt(r).toISOString());
      return [...scheduled, ...handed, ...byHand];
    };
    if (command === "slot") return ok(slot(config, await takenFile(), now, f.day));
    if (["norms", "due", "verdict", "streak", "followers", "stops", "kpi"].includes(command)) return await stateCommand(command, f, { deps, at, whole, config, channels, now });
    const stages = {};
    for (const r of queueRows(await readOptional(deps, at("queue.md")))) stages[r.stage] = (stages[r.stage] ?? 0) + 1;
    return ok({ ...queueDepth(await takenFile(), config, now), stages });
  } catch (e) {
    return fail(e?.message ?? e);
  }
}
