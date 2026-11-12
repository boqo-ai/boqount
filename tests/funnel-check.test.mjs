// node --test tests/funnel-check.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { followChain, pageState, funnelVerdict, checkLink, run } from "../skills/boqount/tools/funnel-check-lib.mjs";

// Quillfern's pages are invented: a welcome page, a sign-in wall and a page that matches neither.
const WELCOME_HTML = "<h1>Welcome to Quillfern</h1><p>Pick a pen to start.</p>";
const WALL_HTML = "<h1>Sign in to Quillfern</h1><p>Use the email you signed up with.</p>";
const OTHER_HTML = "<html>a page nobody described</html>";

const resp = (status, headers = {}, body = "") => new Response(status === 204 || (status >= 300 && status < 400) ? null : body, { status, headers });

test("followChain follows redirects and sends no cookie (302 -> 302 -> 200 on a local server)", async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, headers: req.headers });
    if (req.url === "/a") res.writeHead(302, { location: "/b", "set-cookie": "sid=SECRET; Path=/" }).end();
    else if (req.url === "/b") res.writeHead(302, { location: `http://127.0.0.1:${server.address().port}/c?x=1` }).end();
    else res.writeHead(200, { "content-type": "text/html" }).end("<p>end</p>");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const out = await followChain(`${base}/a`, { fetch });
    assert.deepEqual(out.hops, [
      { url: `${base}/a`, status: 302 },
      { url: `${base}/b`, status: 302 },
      { url: `${base}/c?x=1`, status: 200 },
    ]);
    assert.equal(out.finalUrl, `${base}/c?x=1`);
    assert.equal(out.html, "<p>end</p>");
    assert.deepEqual(seen.map((s) => s.url), ["/a", "/b", "/c?x=1"]);
    for (const s of seen) {
      for (const h of ["cookie", "authorization", "proxy-authorization"]) assert.equal(s.headers[h], undefined, `${s.url} sent ${h}`);
    }
  } finally {
    server.close();
  }
});

test("followChain stops with a named error on a 503 hop and on more than maxHops", async () => {
  const f503 = async (u) => resp(u.endsWith("/start") ? 302 : 503, u.endsWith("/start") ? { location: "https://app.example/door" } : {});
  await assert.rejects(followChain("https://x.example/start", { fetch: f503 }), { message: "hop 503 https://app.example/door" });
  const loop = async (u) => resp(302, { location: u + "x" });
  await assert.rejects(followChain("https://x.example/", { fetch: loop }, 8), /^Error: more than 8 hops https:\/\/x\.example\//);
});

test("pageState is open when mustHave is not empty and every text is present, even beside a mustNotHave text", () => {
  assert.equal(pageState(WELCOME_HTML, { mustHave: ["Welcome to Quillfern"] }), "open");
  assert.equal(pageState(WELCOME_HTML, { mustHave: ["Welcome to", "Pick a pen"] }), "open");
  assert.equal(pageState(WELCOME_HTML + WALL_HTML, { mustHave: ["Welcome to Quillfern"], mustNotHave: ["Sign in to Quillfern"] }), "open");
});

test("pageState is blocked when a mustHave text is missing and a mustNotHave text is present", () => {
  assert.equal(pageState(WALL_HTML, { mustHave: ["Welcome to Quillfern"], mustNotHave: ["Sign in to Quillfern"] }), "blocked");
  assert.equal(pageState(WELCOME_HTML, { mustHave: ["Welcome to Quillfern", "Free pens"], mustNotHave: ["Pick a pen"] }), "blocked");
  assert.equal(pageState(WALL_HTML, { mustNotHave: ["Sign in to Quillfern"] }), "blocked");
});

test("pageState is open when mustHave is empty and no mustNotHave text is present", () => {
  assert.equal(pageState(OTHER_HTML, {}), "open");
  assert.equal(pageState(OTHER_HTML, { mustNotHave: ["Sign in to Quillfern"] }), "open");
  assert.equal(pageState(OTHER_HTML), "open");
});

test("pageState is changed when mustHave is not met and no mustNotHave text is present", () => {
  assert.equal(pageState(OTHER_HTML, { mustHave: ["Welcome to Quillfern"] }), "changed");
  assert.equal(pageState(OTHER_HTML, { mustHave: ["Welcome to Quillfern"], mustNotHave: ["Sign in to Quillfern"] }), "changed");
  assert.equal(pageState("", { mustHave: ["x"] }), "changed");
});

test("pageState reads escaped quotes", () => {
  const payload = '<script>self.__next_f.push([1,"..\\"hero\\":{\\"title\\":\\"Welcome\\"}"])</script>';
  assert.equal(pageState(payload, { mustHave: ['"title":"Welcome"'] }), "open");
  assert.equal(pageState(payload, { mustNotHave: ['"hero":{'] }), "blocked");
});

test("funnelVerdict is red on a blocked link, yellow on unread or changed or none, green when all open", () => {
  assert.equal(funnelVerdict([{ state: "open" }, { state: "open" }]), "green");
  assert.equal(funnelVerdict([{ state: "open" }, { state: "blocked" }]), "red");
  assert.equal(funnelVerdict([{ state: "unread", error: "hop 503 https://quillfern.example/" }, { state: "blocked" }]), "red", "red beats yellow");
  assert.equal(funnelVerdict([{ state: "open" }, { state: "unread", error: "hop 503 https://quillfern.example/" }]), "yellow");
  assert.equal(funnelVerdict([{ state: "open" }, { state: "changed" }]), "yellow");
  assert.equal(funnelVerdict([]), "yellow");
});

test("checkLink: a 503 hop gives error 'hop 503 <url>' and state unread, so the verdict is yellow", async () => {
  const fake = async (u) => (u === "https://quillfern.example/start" ? resp(302, { location: "https://shop.example.com/welcome" }) : resp(503));
  const r = await checkLink("https://quillfern.example/start", { fetch: fake }, { mustHave: ["Welcome"] });
  assert.deepEqual(Object.keys(r).sort(), ["error", "hops", "state", "url"]);
  assert.equal(r.error, "hop 503 https://shop.example.com/welcome");
  assert.equal(r.state, "unread");
  assert.deepEqual(r.hops, [
    { url: "https://quillfern.example/start", status: 302 },
    { url: "https://shop.example.com/welcome", status: 503 },
  ]);
  assert.equal(funnelVerdict([r]), "yellow");
});

test("a redirect to another host is followed and judged on the final page", async () => {
  const fake = async (u) =>
    u === "https://quillfern.example/start" ? resp(302, { location: "https://shop.example.com/welcome?from=dm" }) : resp(200, {}, u.startsWith("https://shop.example.com/") ? WELCOME_HTML : OTHER_HTML);
  const open = await checkLink("https://quillfern.example/start", { fetch: fake }, { mustHave: ["Welcome to Quillfern"] });
  assert.equal(open.state, "open");
  assert.deepEqual(open.hops, [
    { url: "https://quillfern.example/start", status: 302 },
    { url: "https://shop.example.com/welcome?from=dm", status: 200 },
  ]);
  assert.equal(open.error, undefined);
  // the start page itself would not pass: only the page the redirect ends on counts
  const changed = await checkLink("https://quillfern.example/start", { fetch: fake }, { mustHave: ["Free pens"] });
  assert.equal(changed.state, "changed");
});

test("run reports a ninth hop as unread", async () => {
  let n = 0;
  const loop = async () => resp(302, { location: `https://example.com/${++n}` });
  const { code, line } = await run(["https://example.com/0"], { fetch: loop, now: () => new Date(0) });
  assert.equal(code, 0);
  const out = JSON.parse(line);
  assert.equal(out.verdict, "yellow");
  assert.equal(out.links[0].state, "unread");
  assert.match(out.links[0].error, /^more than 8 hops https:\/\/example\.com\/8$/);
  assert.equal(out.links[0].hops.length, 8);
  assert.equal(n, 8, "the ninth request is never made");
});

test("a 302 without a location is unread", async () => {
  const r = await checkLink("https://example.com/a", { fetch: async () => resp(302) });
  assert.equal(r.state, "unread");
  assert.equal(r.error, "hop 302 https://example.com/a has no location");
});

test("run passes --must-have and --must-not-have to every link", async () => {
  const pages = { "https://quillfern.example/a": WELCOME_HTML, "https://quillfern.example/b": WALL_HTML, "https://quillfern.example/c": OTHER_HTML };
  const fake = async (u) => resp(200, {}, pages[u]);
  const argv = ["--must-have", "Welcome to Quillfern", "--must-not-have", "Sign in to Quillfern", ...Object.keys(pages)];
  const { code, line } = await run(argv, { fetch: fake, now: () => new Date("2026-11-11T08:00:00Z") });
  assert.equal(code, 0);
  const out = JSON.parse(line);
  assert.deepEqual(out.links.map((l) => l.state), ["open", "blocked", "changed"]);
  assert.equal(out.verdict, "red");
  // several texts of each kind all have to hold: both mustHave texts, and any one mustNotHave text blocks
  const two = await run(["--must-have", "Welcome", "--must-have", "Free pens", "https://quillfern.example/a"], { fetch: fake });
  assert.equal(JSON.parse(two.line).links[0].state, "changed");
  const any = await run(["--must-not-have", "Sign in to Quillfern", "--must-not-have", "Pick a pen", "https://quillfern.example/a"], { fetch: fake });
  assert.equal(JSON.parse(any.line).links[0].state, "blocked");
  // with no text at all every readable page is open
  const bare = await run(["https://quillfern.example/c"], { fetch: fake });
  assert.equal(JSON.parse(bare.line).links[0].state, "open");
  assert.equal(JSON.parse(bare.line).verdict, "green");
});

test("run needs a text after --must-have and --must-not-have, and gives {error} with a usage line", async () => {
  for (const flag of ["--must-have", "--must-not-have"]) {
    const r = await run(["https://example.com/", flag], { fetch: async () => resp(200) });
    assert.equal(r.code, 1);
    assert.equal(JSON.parse(r.line).error, `${flag} needs a text`);
  }
  const none = await run(["--must-have", "Welcome"], { fetch: async () => resp(200) });
  assert.equal(none.code, 1);
  assert.match(JSON.parse(none.line).error, /^usage: funnel-check\.mjs \[--must-have <text>\]… \[--must-not-have <text>\]… <url…> \| --file <links\.txt>$/);
});

test("run refuses an empty or blank --must-have text", async () => {
  let fetched = 0;
  const fake = async () => { fetched++; return resp(200, {}, WALL_HTML); };
  for (const flag of ["--must-have", "--must-not-have"]) {
    for (const text of ["", " ", "\t \n"]) {
      const r = await run([flag, text, "https://quillfern.example/start"], { fetch: fake });
      assert.deepEqual([r.code, JSON.parse(r.line)], [1, { error: `${flag} needs a text` }], `${flag} ${JSON.stringify(text)}`);
    }
  }
  // the case that read a sign-in wall as open: an empty must-have beside a must-not-have the page holds
  const wall = await run(["--must-have", "", "--must-not-have", "Sign in to", "https://quillfern.example/start"], { fetch: fake });
  assert.deepEqual([wall.code, JSON.parse(wall.line)], [1, { error: "--must-have needs a text" }]);
  assert.equal(fetched, 0, "no link is opened on a refused command line");
});

test("run refuses a flag given as another flag's text", async () => {
  const fake = async () => resp(200, {}, WALL_HTML);
  const cases = [
    [["--must-have", "--must-not-have", "Sign in to Quillfern", "https://quillfern.example/start"], "--must-have needs a text"],
    [["--must-not-have", "--must-have", "Welcome to Quillfern", "https://quillfern.example/start"], "--must-not-have needs a text"],
    [["--must-have", "--must-have", "Welcome to Quillfern", "https://quillfern.example/start"], "--must-have needs a text"],
    [["--must-not-have", "--file", "links.txt"], "--must-not-have needs a text"],
  ];
  for (const [argv, error] of cases) {
    const r = await run(argv, { fetch: fake, readFile: async () => "https://quillfern.example/start\n" });
    assert.deepEqual([r.code, JSON.parse(r.line)], [1, { error }], argv.join(" "));
  }
});

test("pageState ignores blank texts", () => {
  assert.equal(pageState(WALL_HTML, { mustHave: [""], mustNotHave: ["Sign in to Quillfern"] }), "blocked");
  assert.equal(pageState(WALL_HTML, { mustHave: [" "], mustNotHave: ["Sign in to Quillfern"] }), "blocked");
  assert.equal(pageState(WALL_HTML, { mustHave: ["Welcome to Quillfern", ""], mustNotHave: ["Sign in to Quillfern"] }), "blocked");
  assert.equal(pageState(WELCOME_HTML, { mustHave: ["Welcome to Quillfern"], mustNotHave: ["", "  "] }), "open", "a blank must-not-have blocks nothing");
  assert.equal(pageState(OTHER_HTML, { mustHave: ["", "\t"] }), "open", "only blank texts: as if none were given");
});

test("a link that redirects to a wall on another host is blocked", async () => {
  const fake = async (u) =>
    u === "https://quillfern.example/start?fn=pens" ? resp(302, { location: "https://accounts.inkwell.example/login?next=%2Fpens" }) : resp(200, {}, u.startsWith("https://accounts.inkwell.example/") ? WALL_HTML : WELCOME_HTML);
  const { code, line } = await run(["--must-have", "Welcome to Quillfern", "--must-not-have", "Sign in to Quillfern", "https://quillfern.example/start?fn=pens"], { fetch: fake, now: () => new Date("2026-11-11T08:00:00Z") });
  assert.equal(code, 0);
  const out = JSON.parse(line);
  assert.equal(out.links[0].state, "blocked");
  assert.deepEqual(out.links[0].hops, [
    { url: "https://quillfern.example/start?fn=pens", status: 302 },
    { url: "https://accounts.inkwell.example/login?next=%2Fpens", status: 200 },
  ]);
  assert.equal(out.verdict, "red");
});

test("run never prints a cookie or a header: the fake answers carry set-cookie, x-secret and authorization, the line has only verdict/links/readAt", async () => {
  const requests = [];
  const fake = async (u, init) => {
    requests.push({ u, init });
    const loud = { "set-cookie": "__session=COOKIE-VALUE-123; HttpOnly", "x-secret": "HEADER-VALUE-456", authorization: "Bearer TOKEN-789" };
    if (u === "https://quillfern.example/start?fn=pens") return resp(302, { ...loud, location: "https://shop.example.com/welcome?next=%2Fhome" });
    return resp(200, loud, WELCOME_HTML);
  };
  const { code, line } = await run(["--must-have", "Welcome to Quillfern", "https://quillfern.example/start?fn=pens"], { fetch: fake, now: () => new Date("2026-11-09T12:00:00Z") });
  assert.equal(code, 0);
  const out = JSON.parse(line);
  assert.deepEqual(Object.keys(out), ["verdict", "links", "readAt"]);
  assert.equal(out.verdict, "green");
  assert.equal(out.readAt, "2026-11-09T12:00:00.000Z");
  assert.equal(out.links.length, 1);
  assert.deepEqual(Object.keys(out.links[0]), ["url", "state", "hops"]);
  assert.deepEqual(out.links[0].hops, [
    { url: "https://quillfern.example/start?fn=pens", status: 302 },
    { url: "https://shop.example.com/welcome?next=%2Fhome", status: 200 },
  ]);
  for (const secret of ["COOKIE-VALUE-123", "HEADER-VALUE-456", "TOKEN-789", "__session", "x-secret"]) assert.ok(!line.includes(secret), secret);
  for (const { init } of requests) {
    assert.equal(init.redirect, "manual");
    assert.equal(init.credentials, "omit");
    assert.equal(init.headers["user-agent"], "boqount-link-check/1");
    const names = Object.keys(init.headers ?? {}).map((k) => k.toLowerCase());
    assert.ok(!names.includes("cookie") && !names.includes("authorization"), names.join());
  }
});

test("run exits 0 for red and yellow verdicts too, and 1 with {error} when no link is given", async () => {
  const opts = ["--must-have", "Welcome to Quillfern", "--must-not-have", "Sign in to Quillfern"];
  const red = await run([...opts, "https://quillfern.example/start"], { fetch: async () => resp(200, {}, WALL_HTML), now: () => new Date("2026-11-09T12:00:00Z") });
  assert.equal(red.code, 0);
  assert.equal(JSON.parse(red.line).verdict, "red");
  const changed = await run([...opts, "https://quillfern.example/start"], { fetch: async () => resp(200, {}, OTHER_HTML) });
  assert.equal(changed.code, 0);
  assert.equal(JSON.parse(changed.line).verdict, "yellow");
  const down = await run([...opts, "https://quillfern.example/start"], { fetch: async () => resp(503) });
  assert.equal(down.code, 0);
  assert.equal(JSON.parse(down.line).verdict, "yellow");
  const none = await run([], { fetch: async () => resp(200) });
  assert.equal(none.code, 1);
  assert.deepEqual(Object.keys(JSON.parse(none.line)), ["error"]);
});

test("run --file with an unreadable path prints {error} and exits 1, with no stack", async () => {
  const readFile = async () => { throw Object.assign(new Error("ENOENT: no such file, open '/nope/links.txt'"), { code: "ENOENT" }); };
  const r = await run(["--file", "/nope/links.txt"], { fetch: async () => resp(200), readFile });
  assert.equal(r.code, 1);
  const out = JSON.parse(r.line);
  assert.deepEqual(Object.keys(out), ["error"]);
  assert.equal(out.error, "cannot read /nope/links.txt: ENOENT");
  assert.ok(!r.line.includes("\n    at "));
  const ok = await run(["--file", "l.txt"], { fetch: async () => resp(200, {}, WELCOME_HTML), readFile: async () => "# probes\nhttps://quillfern.example/a\n\nhttps://quillfern.example/b\n", now: () => new Date(0) });
  assert.deepEqual(JSON.parse(ok.line).links.map((l) => l.url), ["https://quillfern.example/a", "https://quillfern.example/b"]);
  const noPath = await run(["--file"], { fetch: async () => resp(200), readFile });
  assert.equal(noPath.code, 1);
  assert.equal(JSON.parse(noPath.line).error, "--file needs a path");
});

test("every hop's fetch carries an abort signal, and a timeout lands as the link's error (yellow)", async () => {
  const signals = [];
  const slow = async (u, init) => { signals.push(init.signal); throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }); };
  const r = await checkLink("https://quillfern.example/start", { fetch: slow });
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(r.state, "unread");
  assert.match(r.error, /timeout/);
  assert.deepEqual(r.hops, []);
  assert.equal(funnelVerdict([r]), "yellow");
  const ok = async (u, init) => { signals.push(init.signal); return resp(200, {}, WELCOME_HTML); };
  await checkLink("https://quillfern.example/start", { fetch: ok });
  assert.ok(signals[1] instanceof AbortSignal);
});
