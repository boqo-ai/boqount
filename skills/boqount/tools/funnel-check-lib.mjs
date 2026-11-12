// Opens a brand's links the way a brand-new visitor does (no cookie, no sign-in, redirects followed by hand, at most 8
// hops) and says whether the way in is open. The tool knows no site: the person's config supplies the texts a page must
// have (`mustHave`) or must not have (`mustNotHave`), and each link is judged on the page its redirects end on.
// Per page: every mustHave text present (and mustHave not empty) is `open`; else any mustNotHave text present is
// `blocked`; else an empty mustHave is `open`; else `changed`. A blank text is no text (every page "holds" ""). A failed
// hop or a loop is `unread`.
// Verdict: `red` when any link is blocked; `yellow` when there are no links or any is unread or changed; else `green`.
// The CLI is tools/funnel-check.mjs; the tests are tests/funnel-check.test.mjs.

const MAX_HOPS = 8;
const USER_AGENT = "boqount-link-check/1";
const HOP_TIMEOUT_MS = 15000;

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const FLAGS = new Set(["--must-have", "--must-not-have", "--file"]);
const blank = (t) => String(t ?? "").trim() === "";

/**
 * GETs `url` and follows redirects by hand (`redirect: "manual"`), with no cookie, no credentials and no auth header.
 * Resolves `{ hops: [{url, status}], finalUrl, html }`. Throws an Error whose message names the hop
 * (`hop 503 <url>`, `more than 8 hops <url>`, `hop 302 <url> has no location`) and whose `.hops` lists the hops so far.
 */
export async function followChain(url, deps, maxHops = MAX_HOPS) {
  const hops = [];
  const fail = (message) => Object.assign(new Error(message), { hops });
  let current = url;
  for (;;) {
    if (hops.length >= maxHops) throw fail(`more than ${maxHops} hops ${current}`);
    const res = await deps.fetch(current, { redirect: "manual", credentials: "omit", headers: { "user-agent": USER_AGENT, accept: "text/html" }, signal: AbortSignal.timeout(HOP_TIMEOUT_MS) });
    hops.push({ url: current, status: res.status });
    if (REDIRECTS.has(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw fail(`hop ${res.status} ${current} has no location`);
      current = new URL(location, current).href;
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw fail(`hop ${res.status} ${current}`);
    return { hops, finalUrl: current, html: await res.text() };
  }
}

/**
 * The state of one page from its text, with `\"` read as `"` (a framework's payload carries its quotes escaped):
 * `open` when mustHave is not empty and every text is there; else `blocked` when any mustNotHave text is there;
 * else `open` when mustHave is empty; else `changed`. Blank texts are left out of both lists: "".includes is always true.
 */
export function pageState(html, { mustHave = [], mustNotHave = [] } = {}) {
  const text = String(html ?? "").replace(/\\"/g, '"');
  mustHave = mustHave.filter((t) => !blank(t));
  mustNotHave = mustNotHave.filter((t) => !blank(t));
  if (mustHave.length > 0 && mustHave.every((t) => text.includes(t))) return "open";
  if (mustNotHave.some((t) => text.includes(t))) return "blocked";
  return mustHave.length === 0 ? "open" : "changed";
}

/** red: any link is blocked. yellow: no links, or any link unread or changed. green: all open. */
export function funnelVerdict(results) {
  if (results.some((r) => r.state === "blocked")) return "red";
  if (results.length === 0 || results.some((r) => r.state !== "open")) return "yellow";
  return "green";
}

/** One link: `{url, state, hops, error?}`. A failed hop or a loop is an `error` and the state `unread`. `options`: `{mustHave, mustNotHave, maxHops}`. */
export async function checkLink(url, deps, { mustHave = [], mustNotHave = [], maxHops = MAX_HOPS } = {}) {
  try {
    const { hops, html } = await followChain(url, deps, maxHops);
    return { url, state: pageState(html, { mustHave, mustNotHave }), hops };
  } catch (e) {
    return { url, state: "unread", hops: e.hops ?? [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** `[--must-have <text>]… [--must-not-have <text>]… <url…>` or `--file <path>` (one URL per line, `#` comments). Resolves `{code, line}`; code 0 for every verdict, 1 only on a tool error. */
export async function run(argv, deps) {
  const urls = [];
  const options = { mustHave: [], mustNotHave: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--must-have" || argv[i] === "--must-not-have") {
      const text = argv[++i];
      // A blank text would match every page, and a flag in its place means the text was left out.
      if (text === undefined || blank(text) || FLAGS.has(text)) return { code: 1, line: JSON.stringify({ error: `${argv[i - 1]} needs a text` }) };
      (argv[i - 1] === "--must-have" ? options.mustHave : options.mustNotHave).push(text);
    } else if (argv[i] === "--file") {
      const path = argv[++i];
      if (!path) return { code: 1, line: JSON.stringify({ error: "--file needs a path" }) };
      let text;
      try {
        text = await deps.readFile(path, "utf8");
      } catch (e) {
        return { code: 1, line: JSON.stringify({ error: `cannot read ${path}: ${e?.code ?? "error"}` }) };
      }
      urls.push(...text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    } else urls.push(argv[i]);
  }
  if (urls.length === 0) return { code: 1, line: JSON.stringify({ error: "usage: funnel-check.mjs [--must-have <text>]… [--must-not-have <text>]… <url…> | --file <links.txt>" }) };
  const links = [];
  for (const url of urls) links.push(await checkLink(url, deps, options));
  const verdict = funnelVerdict(links);
  const readAt = (deps.now ? deps.now() : new Date()).toISOString();
  return { code: 0, line: JSON.stringify({ verdict, links, readAt }) };
}
