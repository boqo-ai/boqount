// tools/eleven.mjs: where the key is read from, and that it is never shown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findKey, wordsFromAlignment } from "../skills/boqount/tools/eleven.mjs";

const cli = fileURLToPath(new URL("../skills/boqount/tools/eleven.mjs", import.meta.url));
const SECRET = "xi-test-secret-quillfern";

function home({ key, mode = 0o600 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "boqount-home-"));
  if (key) {
    mkdirSync(join(dir, ".config/boqount"), { recursive: true });
    const file = join(dir, ".config/boqount/eleven.key");
    writeFileSync(file, `${key}\n`);
    chmodSync(file, mode);
  }
  return dir;
}

test("the key comes from ELEVENLABS_API_KEY first", () => {
  const h = home({ key: "from-home" });
  const file = join(h, "other.key");
  writeFileSync(file, "from-file");
  assert.equal(findKey({ ELEVENLABS_API_KEY: " from-env ", ELEVENLABS_KEY_FILE: file }, h).key, "from-env");
});

test("then from the file ELEVENLABS_KEY_FILE names, then from ~/.config/boqount/eleven.key", () => {
  const h = home({ key: "from-home" });
  const file = join(h, "other.key");
  writeFileSync(file, "from-file\n");
  assert.equal(findKey({ ELEVENLABS_KEY_FILE: file }, h).key, "from-file");
  assert.equal(findKey({}, h).key, "from-home");
  assert.equal(findKey({ ELEVENLABS_KEY_FILE: join(h, "missing.key") }, h).key, "from-home");
});

test("no key anywhere is null, and a key file readable by others is flagged", () => {
  assert.equal(findKey({}, home()), null);
  assert.equal(findKey({ ELEVENLABS_API_KEY: "  " }, home()), null);
  assert.equal(findKey({}, home({ key: "k", mode: 0o600 })).loose, false);
  assert.equal(findKey({}, home({ key: "k", mode: 0o644 })).loose, true);
});

test("with no key the CLI exits 1 and names the three places it looked", () => {
  const env = { PATH: process.env.PATH, HOME: home() };
  const script = join(env.HOME, "script.txt");
  writeFileSync(script, "Water it when the soil is dry.");
  for (const args of [["tts", script, join(env.HOME, "out")], ["sfx", "a pop", join(env.HOME, "pop.mp3")], ["music", "calm", join(env.HOME, "m.mp3")], ["tts-lines", script, env.HOME]]) {
    const r = spawnSync("node", [cli, ...args], { env, encoding: "utf8" });
    assert.equal(r.status, 1, args[0]);
    assert.match(r.stderr, /ELEVENLABS_API_KEY/);
    assert.match(r.stderr, /ELEVENLABS_KEY_FILE/);
    assert.match(r.stderr, /\.config\/boqount\/eleven\.key/);
  }
});

test("a key is never printed, not even when the key file is too open", () => {
  const h = home({ key: SECRET, mode: 0o644 });
  // An unknown command stops before any request; a known one with a bad script path stops before the network too.
  const r = spawnSync("node", [cli, "tts", join(h, "no-such-script.txt"), join(h, "out")], { env: { PATH: process.env.PATH, HOME: h }, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(SECRET));
  assert.match(r.stderr, /chmod 600/);
});

test("an unknown command is a usage error", () => {
  const r = spawnSync("node", [cli, "nope"], { env: { PATH: process.env.PATH, HOME: home() }, encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
});

test("words come from the character alignment", () => {
  const text = "Water it";
  const alignment = { characters: [...text], character_start_times_seconds: [...text].map((_, i) => i * 0.1), character_end_times_seconds: [...text].map((_, i) => i * 0.1 + 0.1) };
  assert.deepEqual(wordsFromAlignment(alignment), [
    { word: "Water", start: 0, end: 0.5 },
    { word: "it", start: 0.6, end: 0.8 },
  ]);
});

test("a voice id or a line id that is not a bare name is refused before any request", () => {
  const h = home();
  const env = { PATH: process.env.PATH, HOME: h, ELEVENLABS_API_KEY: SECRET };
  const script = join(h, "script.txt");
  writeFileSync(script, "Water it when the soil is dry.");
  const r = spawnSync("node", [cli, "tts", script, join(h, "out"), "--voice", "../v1/x?y=1"], { env, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /voice id/);
  const plan = join(h, "plan.json");
  writeFileSync(plan, JSON.stringify({ voice: "abc123", model: "m", lines: [{ id: "../escape", text: "Water it." }] }));
  const l = spawnSync("node", [cli, "tts-lines", plan, h, "--voice", "abc123"], { env, encoding: "utf8" });
  assert.equal(l.status, 1);
  assert.match(l.stderr, /line id.*\.\.\/escape/);
  assert.doesNotMatch(r.stdout + r.stderr + l.stdout + l.stderr, new RegExp(SECRET));
});

/** A module for `node --import` that replaces fetch, so a test never reaches the network. */
function fakeFetch(dir, body) {
  const file = join(dir, "fake-fetch.mjs");
  writeFileSync(file, `globalThis.fetch = async (url, init) => { ${body} };\n`);
  return file;
}

test("a key file with two lines is refused without printing either line", () => {
  const h = home();
  const file = join(h, "eleven.key");
  const LABEL = "label-quillfern-voice-account";
  writeFileSync(file, `${LABEL}\n${SECRET}\n`);
  chmodSync(file, 0o600);
  const script = join(h, "script.txt");
  writeFileSync(script, "Water it when the soil is dry.");
  const preload = fakeFetch(h, "throw new Error('the header value ' + init.headers['xi-api-key'] + ' is invalid');");
  const r = spawnSync("node", ["--import", preload, cli, "tts", script, join(h, "out"), "--voice", "abc123"], { env: { PATH: process.env.PATH, HOME: h, ELEVENLABS_KEY_FILE: file }, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(file), `names the file: ${r.stderr}`);
  assert.match(r.stderr, /not a single token/);
  assert.ok(!(r.stdout + r.stderr).includes(SECRET), "the key line is not printed");
  assert.ok(!(r.stdout + r.stderr).includes(LABEL), "the label line is not printed");
  // The environment variable is held to the same rule, and so is the default key file.
  assert.throws(() => findKey({ ELEVENLABS_API_KEY: "two words" }, h), (e) => /ELEVENLABS_API_KEY/.test(e.message) && /not a single token/.test(e.message) && !e.message.includes("two words"));
  const h2 = home({ key: `${LABEL}\n${SECRET}` });
  assert.throws(() => findKey({}, h2), (e) => /eleven\.key/.test(e.message) && !e.message.includes(SECRET) && !e.message.includes(LABEL));
  assert.equal(findKey({ ELEVENLABS_API_KEY: ` ${SECRET}\n` }, h).key, SECRET, "surrounding whitespace is trimmed");
});

test("a network error prints no header value", () => {
  const h = home();
  const env = { PATH: process.env.PATH, HOME: h, ELEVENLABS_API_KEY: SECRET };
  const script = join(h, "script.txt");
  writeFileSync(script, "Water it when the soil is dry.");
  const cases = [
    ["throw Object.assign(new TypeError('fetch failed: header xi-api-key: ' + init.headers['xi-api-key']), { cause: new Error(init.headers['xi-api-key']) });", /TypeError/],
    ["const e = new Error('connect ECONNREFUSED with ' + init.headers['xi-api-key']); e.code = 'ECONNREFUSED'; throw e;", /ECONNREFUSED/],
    ["return new Response('{\"detail\": \"invalid api key ' + init.headers['xi-api-key'] + '\"}', { status: 401 });", /401/],
  ];
  for (const [body, shown] of cases) {
    const preload = fakeFetch(h, body);
    for (const args of [["tts", script, join(h, "out"), "--voice", "abc123"], ["sfx", "a pop", join(h, "pop.mp3")]]) {
      const r = spawnSync("node", ["--import", preload, cli, ...args], { env, encoding: "utf8" });
      assert.equal(r.status, 1, `${args[0]}: ${body}`);
      assert.ok(!(r.stdout + r.stderr).includes(SECRET), `${args[0]} printed the key: ${r.stdout + r.stderr}`);
      assert.match(r.stderr, shown, `${args[0]}: ${r.stderr}`);
    }
  }
});

test("tts and tts-lines need --voice: there is no default voice", () => {
  const h = home();
  const env = { PATH: process.env.PATH, HOME: h, ELEVENLABS_API_KEY: SECRET };
  const preload = fakeFetch(h, "throw new Error('no request may be made');");
  const script = join(h, "script.txt");
  writeFileSync(script, "Water it when the soil is dry.");
  const plan = join(h, "plan.json");
  writeFileSync(plan, JSON.stringify({ model: "m", lines: [{ id: "one", text: "Water it." }] }));
  for (const args of [["tts", script, join(h, "out")], ["tts-lines", plan, h]]) {
    const r = spawnSync("node", ["--import", preload, cli, ...args], { env, encoding: "utf8" });
    assert.equal(r.status, 1, args[0]);
    assert.match(r.stderr, /--voice/, args[0]);
    assert.doesNotMatch(r.stderr, /no request may be made/, `${args[0]} made a request`);
  }
});

test("a 429 is asked again after a wait, and the line is voiced", () => {
  const h = home();
  const env = { PATH: process.env.PATH, HOME: h, ELEVENLABS_API_KEY: SECRET };
  const script = join(h, "script.txt");
  writeFileSync(script, "Water it");
  const alignment = { characters: [..."Water it"], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] };
  const ok = JSON.stringify({ audio_base64: Buffer.from("mp3").toString("base64"), alignment });
  const preload = fakeFetch(h, `globalThis.calls = (globalThis.calls ?? 0) + 1; return globalThis.calls === 1 ? new Response("busy", { status: 429 }) : new Response(${JSON.stringify(ok)}, { status: 200 });`);
  const r = spawnSync("node", ["--import", preload, cli, "tts", script, join(h, "out"), "--voice", "abc123"], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /429/);
  assert.deepEqual(JSON.parse(readFileSync(join(h, "out.words.json"), "utf8")).map((w) => w.word), ["Water", "it"]);
});

test("tts-lines takes the voice from the plan when no flag is given", () => {
  const h = home();
  const env = { PATH: process.env.PATH, HOME: h, ELEVENLABS_API_KEY: SECRET };
  const alignment = { characters: [..."Water it."], character_start_times_seconds: [...Array(9).keys()].map((i) => i * 0.1), character_end_times_seconds: [...Array(9).keys()].map((i) => i * 0.1 + 0.1) };
  const ok = JSON.stringify({ audio_base64: Buffer.from("mp3").toString("base64"), alignment });
  // The fake service writes down the URL it was asked for, so the test sees which voice was used.
  const urls = join(h, "urls.txt");
  const preload = fakeFetch(h, `(await import("node:fs")).appendFileSync(${JSON.stringify(urls)}, url + "\\n"); return new Response(${JSON.stringify(ok)}, { status: 200 });`);
  const plan = join(h, "plan.json");
  writeFileSync(plan, JSON.stringify({ voice: "planVoice42", model: "m", lines: [{ id: "one", text: "Water it." }] }));
  const r = spawnSync("node", ["--import", preload, cli, "tts-lines", plan, h], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(urls, "utf8"), /\/text-to-speech\/planVoice42\//);
  // The flag wins over the plan.
  const f = spawnSync("node", ["--import", preload, cli, "tts-lines", plan, h, "--voice", "flagVoice7"], { env, encoding: "utf8" });
  assert.equal(f.status, 0, f.stderr);
  assert.match(readFileSync(urls, "utf8").trim().split("\n").at(-1), /\/text-to-speech\/flagVoice7\//);
  // The plan's value is checked like the flag's, before any request.
  writeFileSync(urls, "");
  writeFileSync(plan, JSON.stringify({ voice: "../v1/x?y=1", model: "m", lines: [{ id: "one", text: "Water it." }] }));
  const bad = spawnSync("node", ["--import", preload, cli, "tts-lines", plan, h], { env, encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /voice id/);
  assert.equal(readFileSync(urls, "utf8"), "", "no request was made");
});
