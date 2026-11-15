#!/usr/bin/env node
// Generated pictures and video for a film (gen.md): one model call through fal's queue, priced live, reserved in the
// account's budget before it is made, its files downloaded, and logged so a film's spend adds up from request ids.
//
//   node <skill>/tools/gen.mjs price  <endpoint> [<endpoint> …]
//   node <skill>/tools/gen.mjs run    <endpoint> <input.json> <out-dir> --slug <film> [--units N] [--label NAME]
//                                     [--dir <account>] [--yes]
//   node <skill>/tools/gen.mjs status <out-dir> <request-id>      fetch a request that outlived `run` (no new charge)
//   node <skill>/tools/gen.mjs spent  <out-dir>                    what the ledger in <out-dir> says was spent
//
// `run` is the only paid command. Without --yes it reads the price at its source now, works out the estimate, checks
// it against what is left of the budget (`account-state.mjs budget`), prints the plan and asks nothing. With --yes
// (given only on the person's word for that estimate) it checks again, writes the reservation into
// marketing/budget.csv (`<date>,<slug>,fal,<usd>,0,reserved …`), makes the call, downloads every file it returns as
// <out-dir>/<label>-<n>.<ext>, writes <label>.result.json, appends one line to <out-dir>/ledger.jsonl, and rewrites
// the reservation line (only that line) to the call's cost. A price that cannot be read is `unverified`: nothing is
// reserved and nothing is called. An estimate past what is left stops before anything is asked.
//
// Units: a price is per unit (an image, a second of video, …). `--units` says how many; without it, a per-second
// price takes the input's `duration`, a per-image price the input's `num_images` (else 1), and anything else stops.
//
// In input.json, a string "@file:<path>" (relative to the JSON file) is sent as a data URI, so local references need
// no hosting; "@upload:<path>" puts the file on fal's storage first and sends its URL (for an endpoint that refuses
// data URIs). The ledger keeps the input as written, never a data URI.
//
// The key is read from FAL_KEY, else from the file FAL_KEY_FILE names, else from ~/.config/boqount/fal.key (mode
// 600). It is never printed, logged or written anywhere, and no raw error text is printed (a service may echo a
// request back, key included): only an HTTP status, or an error's name and code. With no key, generated looks are
// not offered (gen.md → No key).
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { budget, parseConfig, parseCsv } from "./account-state-lib.mjs";

const QUEUE = "https://queue.fal.run";
const PRICING = "https://api.fal.ai/v1/models/pricing";
const UPLOAD = "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3";
const POLL_MS = 4000;
const GIVE_UP_MS = 20 * 60_000; // the request keeps running after this: `status` fetches it later

export const NO_KEY =
  "no fal key found. Looked in: the FAL_KEY environment variable; the file named by the FAL_KEY_FILE environment " +
  "variable; the file ~/.config/boqount/fal.key. Without one, generated looks are not offered (gen.md → No key).";

/** An error whose message this file wrote itself and which holds nothing secret. */
export class Plain extends Error {}

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".mov": "video/quicktime",
};

function checkKey(raw, where) {
  const key = raw.trim();
  if (!/^[\x21-\x7e]+$/.test(key)) throw new Plain(`the key in ${where} is not a single token (one line of printable ASCII with no spaces): put only the key there`);
  return key;
}

/** { key, file, loose } or null; the same three places, in order, as the head of this file says. */
export function findKey(env = process.env, home = homedir()) {
  if (env.FAL_KEY?.trim()) return { key: checkKey(env.FAL_KEY, "the FAL_KEY environment variable"), file: null, loose: false };
  for (const file of [env.FAL_KEY_FILE, join(home, ".config/boqount/fal.key")]) {
    if (!file) continue;
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (raw.trim()) return { key: checkKey(raw, `the file ${file}`), file, loose: (statSync(file).mode & 0o077) !== 0 };
  }
  return null;
}

const kind = (e) => [e?.name, e?.code ?? e?.cause?.code].filter((x) => typeof x === "string" && /^[A-Za-z0-9_]+$/.test(x)).join(" ") || "Error";
/** A URL for a message: its host and path, no query. */
const where = (url) => {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "the service";
  }
};

function client(ctx) {
  const { fetch, key } = ctx;
  async function req(url, init = {}, auth = true) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { ...(auth ? { authorization: `Key ${key}` } : {}), ...(init.body && !init.raw ? { "content-type": "application/json" } : {}), ...init.headers } });
    } catch (e) {
      throw new Plain(`${where(url)}: the request did not complete (${kind(e)}): check the network connection and try again`);
    }
    if (!res.ok) throw new Plain(`${where(url)}: the service answered HTTP ${res.status}${res.status === 401 ? " (the key was refused)" : res.status === 403 ? " (the key may not reach this model, or the account has no balance)" : ""}`);
    return res;
  }
  const json = async (url, init, auth) => (await req(url, init, auth)).json();
  return { req, json };
}

// ---------------------------------------------------------------- price and units

/** The live price of each endpoint: [{ endpoint, unitPrice, unit, currency }] (an endpoint the source does not list is left out). */
export async function readPrices(endpoints, ctx) {
  const { json } = client(ctx);
  const out = [];
  for (const [i, e] of endpoints.entries()) {
    const d = await json(`${PRICING}?endpoint_id=${encodeURIComponent(e)}`);
    for (const p of d.prices ?? []) {
      const unitPrice = Number(p.unit_price);
      if (Number.isFinite(unitPrice)) out.push({ endpoint: p.endpoint_id ?? e, unitPrice, unit: String(p.unit ?? ""), currency: String(p.currency ?? "USD") });
    }
    if (i < endpoints.length - 1) await ctx.sleep(1500); // the pricing source refuses a burst of five
  }
  return out;
}

/** How many units an input asks for, by the price's unit; null when it cannot be said without --units. */
export function unitsOf(input, unit) {
  if (/second/i.test(unit)) {
    const d = Number(input?.duration);
    return Number.isFinite(d) && d > 0 ? d : null;
  }
  if (/image/i.test(unit)) {
    const n = input?.num_images === undefined ? 1 : Number(input.num_images);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

const usd = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- inputs and outputs

function mimeOf(p) {
  const mime = MIME[extname(p).toLowerCase()];
  if (!mime) throw new Plain(`no MIME type for ${p}: use a .png, .jpg, .webp, .mp3, .wav, .mp4 or .mov`);
  return mime;
}

/** "@file:x" → data URI, "@upload:x" → a URL on fal's storage; every other value as it is. */
export async function inline(value, base, ctx) {
  if (typeof value === "string" && value.startsWith("@file:")) {
    const p = resolve(base, value.slice(6));
    return `data:${mimeOf(p)};base64,${readFileSync(p).toString("base64")}`;
  }
  if (typeof value === "string" && value.startsWith("@upload:")) {
    const p = resolve(base, value.slice(8));
    const content_type = mimeOf(p);
    const { req, json } = client(ctx);
    const { upload_url, file_url } = await json(UPLOAD, { method: "POST", body: JSON.stringify({ content_type, file_name: basename(p) }) });
    await req(upload_url, { method: "PUT", raw: true, headers: { "content-type": content_type }, body: readFileSync(p) }, false);
    return file_url;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => inline(v, base, ctx)));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await inline(v, base, ctx)])));
  return value;
}

/** Every { url } in a result, in order. */
export function filesIn(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => filesIn(v, out));
  else if (value && typeof value === "object") {
    if (typeof value.url === "string" && /^https?:/.test(value.url)) out.push(value);
    else Object.values(value).forEach((v) => filesIn(v, out));
  }
  return out;
}

async function download(result, outDir, label, ctx) {
  const { req } = client(ctx);
  writeFileSync(join(outDir, `${label}.result.json`), JSON.stringify(result, null, 2) + "\n");
  const paths = [];
  for (const [i, f] of filesIn(result).entries()) {
    let ext = ".bin";
    try {
      ext = extname(new URL(f.url).pathname) || ".bin";
    } catch {}
    const path = join(outDir, `${label}-${i + 1}${ext}`);
    const res = await req(f.url, {}, false);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    paths.push(path);
  }
  return paths;
}

// ---------------------------------------------------------------- the budget

/** The account's date (YYYY-MM-DD) on its own clock. */
function dayOn(zone, now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function readBudget(dir, now) {
  const cfgPath = join(dir, "marketing/config.md");
  if (!existsSync(cfgPath)) throw new Plain(`no ${cfgPath}: run from the account's folder or pass --dir <account>`);
  const csvPath = join(dir, "marketing/budget.csv");
  try {
    const config = parseConfig(readFileSync(cfgPath, "utf8"));
    const text = existsSync(csvPath) ? readFileSync(csvPath, "utf8") : "date,slug,service,usd,credits,note\n";
    const b = budget(parseCsv(text), config, now);
    return { config, csvPath, left: Math.min(b.day.leftUsd, b.month.leftUsd), b };
  } catch (e) {
    throw new Plain(`the budget cannot be read (${e.message}): nothing reserved, nothing called`);
  }
}

const csvSafe = (s) => String(s).replace(/[,\n\r"]/g, ";");

/** Replace one line of a file by its exact text, leaving every other line as it is (never re-serialized). */
function replaceLine(path, from, to) {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const i = lines.lastIndexOf(from);
  if (i < 0) throw new Plain(`${path}: the reservation line is gone; write the cost by hand: ${to}`);
  lines[i] = to;
  writeFileSync(path, lines.join("\n"));
}

// ---------------------------------------------------------------- commands

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  if (args[i + 1] === undefined || args[i + 1].startsWith("--")) throw new Plain(`--${name} needs a value`);
  return args[i + 1];
}
const positional = (args, valued) => args.filter((a, i) => !a.startsWith("--") && !(i > 0 && valued.includes(args[i - 1])));

async function price(args, ctx) {
  if (!args.length) throw new Plain("usage: gen.mjs price <endpoint> [<endpoint> …]");
  const read = dayOn("UTC", ctx.now());
  const prices = await readPrices(args, ctx);
  const lines = prices.map((p) => `${p.endpoint}  ${p.unitPrice} ${p.currency} / ${p.unit}   (read ${read}, from fal's pricing)`);
  for (const e of args) if (!prices.some((p) => p.endpoint === e)) lines.push(`${e}  unverified: the source lists no price, so nothing is called`);
  return lines.join("\n");
}

async function run(args, ctx) {
  const valued = ["--slug", "--units", "--label", "--dir"];
  const [endpoint, inputPath, outDir] = positional(args, valued);
  if (!endpoint || !inputPath || !outDir) throw new Plain("usage: gen.mjs run <endpoint> <input.json> <out-dir> --slug <film> [--units N] [--label NAME] [--dir <account>] [--yes]");
  const slug = flag(args, "slug");
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Plain("--slug <film> is required: the film the spend is for (lowercase words joined by -)");
  const label = flag(args, "label") ?? basename(inputPath, ".json");
  if (!/^[A-Za-z0-9_-]+$/.test(label)) throw new Plain(`a label is a bare name (letters, digits, _ and -), got ${JSON.stringify(label)}`);
  const dir = resolve(flag(args, "dir") ?? ctx.cwd);
  const yes = args.includes("--yes");
  let raw;
  try {
    raw = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (e) {
    throw new Plain(`cannot read ${inputPath} as JSON (${kind(e)})`);
  }

  const now = ctx.now();
  const [p] = (await readPrices([endpoint], ctx)).filter((x) => x.endpoint === endpoint);
  if (!p) throw new Plain(`${endpoint}: price unverified (the source lists none), so nothing is reserved and nothing is called`);
  const unitsFlag = flag(args, "units");
  const units = unitsFlag !== undefined ? Number(unitsFlag) : unitsOf(raw, p.unit);
  if (!(Number.isFinite(units) && units > 0)) throw new Plain(`${endpoint} is priced per ${p.unit}: say how many with --units N`);
  const estimate = usd(p.unitPrice * units);
  const { config, csvPath, left } = readBudget(dir, now);
  const read = dayOn(config.timezone, now);
  const plan = `${label}: ${endpoint}, ${units} × ${p.unitPrice} ${p.currency} / ${p.unit} (read ${read}) = $${estimate}; left in the budget: $${left}`;
  if (estimate > left) throw new Plain(`${plan}.\nOver what is left: nothing reserved, nothing called. A cheaper look, fewer units, or the person raises the budget.`);
  if (!yes) return `${plan}.\nNothing was asked. On the person's word for $${estimate}, run this again with --yes.`;

  // Reserve first, at the estimate.
  if (!existsSync(csvPath)) writeFileSync(csvPath, "date,slug,service,usd,credits,note\n");
  const before = readFileSync(csvPath, "utf8");
  if (before.length && !before.endsWith("\n")) appendFileSync(csvPath, "\n");
  const reserved = `${read},${slug},fal,${estimate},0,${csvSafe(`reserved: ${endpoint} ${label} ${units} ${p.unit} at ${p.unitPrice} read ${read}`)}`;
  appendFileSync(csvPath, reserved + "\n");

  mkdirSync(outDir, { recursive: true });
  const { json } = client(ctx);
  let queued;
  try {
    const input = await inline(raw, dirname(resolve(inputPath)), ctx);
    queued = await json(`${QUEUE}/${endpoint}`, { method: "POST", body: JSON.stringify(input) });
  } catch (e) {
    replaceLine(csvPath, reserved, `${read},${slug},fal,${estimate},0,${csvSafe(`estimate, not called: ${endpoint} ${label}`)}`);
    throw e;
  }
  const entry = { at: now.toISOString(), endpoint, label, slug, request_id: queued.request_id, status_url: queued.status_url, response_url: queued.response_url, units, unit: p.unit, unit_price: p.unitPrice, usd: estimate, input: raw };
  appendFileSync(join(outDir, "ledger.jsonl"), JSON.stringify(entry) + "\n");
  replaceLine(csvPath, reserved, `${read},${slug},fal,${estimate},0,${csvSafe(`fal ${queued.request_id} ${endpoint} ${label} ${units} ${p.unit}`)}`);
  ctx.log(`${label}: queued ${queued.request_id}`);

  const result = await waitFor(entry, ctx);
  if (!result) return `${label}: still running after ${GIVE_UP_MS / 60000} min; its cost is booked. Fetch it later with: gen.mjs status ${outDir} ${queued.request_id}`;
  const paths = await download(result, outDir, label, ctx);
  return [...paths, `${label}: ${paths.length} file(s), $${estimate} booked in marketing/budget.csv`].join("\n");
}

async function waitFor(entry, ctx) {
  const { json } = client(ctx);
  const started = ctx.clock();
  for (;;) {
    const s = await json(entry.status_url);
    if (s.status === "COMPLETED") return json(entry.response_url);
    if (s.status === "FAILED" || s.status === "ERROR") throw new Plain(`${entry.label}: the request ${entry.request_id} failed at the service`);
    if (ctx.clock() - started > GIVE_UP_MS) return null;
    await ctx.sleep(POLL_MS);
  }
}

function ledger(outDir) {
  const path = join(outDir, "ledger.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

async function status(args, ctx) {
  const [outDir, id] = args;
  if (!outDir || !id) throw new Plain("usage: gen.mjs status <out-dir> <request-id>");
  const entry = ledger(outDir).find((e) => e.request_id === id);
  if (!entry) throw new Plain(`${outDir}/ledger.jsonl has no request ${id}`);
  const { json } = client(ctx);
  const s = await json(entry.status_url);
  if (s.status !== "COMPLETED") return `${entry.label}: ${s.status ?? "unknown"}; ask again later (no new charge)`;
  const paths = await download(await json(entry.response_url), outDir, entry.label, ctx);
  return [...paths, `${entry.label}: ${paths.length} file(s)`].join("\n");
}

function spent(args) {
  const [outDir] = args;
  if (!outDir) throw new Plain("usage: gen.mjs spent <out-dir>");
  const rows = ledger(outDir);
  const total = usd(rows.reduce((s, e) => s + (Number(e.usd) || 0), 0));
  const byEndpoint = {};
  for (const e of rows) byEndpoint[e.endpoint] = usd((byEndpoint[e.endpoint] ?? 0) + (Number(e.usd) || 0));
  return [...Object.entries(byEndpoint).map(([e, u]) => `${e}  $${u}`), `${rows.length} call(s), $${total}`].join("\n");
}

const COMMANDS = { price, run, status, spent };
const USAGE = "usage: gen.mjs price|run|status|spent … (see the head of tools/gen.mjs)";

/** The CLI, with its world passed in so a test can stand in for the network. Returns { code, out, err }. */
export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const ctx = {
    fetch: deps.fetch ?? globalThis.fetch,
    now: deps.now ?? (() => new Date()),
    clock: deps.clock ?? (() => Date.now()),
    sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    cwd: deps.cwd ?? process.cwd(),
    log: deps.log ?? ((s) => console.error(s)),
    key: null,
  };
  const [cmd, ...rest] = argv;
  if (!COMMANDS[cmd]) return { code: 2, out: "", err: USAGE };
  try {
    if (cmd !== "spent") {
      const found = findKey(env, deps.home ?? homedir());
      if (!found) return { code: 1, out: "", err: NO_KEY };
      if (found.loose) ctx.log(`gen.mjs: ${found.file} is readable by others: chmod 600 it`);
      ctx.key = found.key;
    }
    return { code: 0, out: await COMMANDS[cmd](rest, ctx), err: "" };
  } catch (e) {
    return { code: 1, out: "", err: e instanceof Plain ? e.message : `gen.mjs: stopped (${kind(e)})` };
  }
}

const isMain = (() => {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? "");
  } catch {
    return false;
  }
})();
if (isMain) {
  const r = await main(process.argv.slice(2));
  if (r.out) console.log(r.out);
  if (r.err) console.error(r.code === 2 ? r.err : `gen.mjs: ${r.err}`);
  process.exit(r.code);
}
