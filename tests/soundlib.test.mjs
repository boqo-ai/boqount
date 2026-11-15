// tools/soundlib.mjs (the library and the tonal set) and tools/flashes.mjs. No test reaches the network: `gen` runs
// eleven.mjs with fetch replaced. Needs ffmpeg; each test skips cleanly without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chroma, keysOf, tempo, toneSet } from "../skills/boqount/tools/soundlib.mjs";
import { changes } from "../skills/boqount/tools/flashes.mjs";
import { decode, spectrum, SR } from "../skills/boqount/tools/sound-lib.mjs";

const tools = fileURLToPath(new URL("../skills/boqount/tools/", import.meta.url));
const shippedSpec = fileURLToPath(new URL("../skills/boqount/films/sounds/spec.json", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = (name, fn) => test(name, { skip: !hasFfmpeg && "ffmpeg is not installed" }, fn);
const ff = (...args) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args]);
const lib = (args, opts = {}) => spawnSync(process.execPath, [...(opts.execArgv ?? []), join(tools, "soundlib.mjs"), ...args], { encoding: "utf8", cwd: opts.cwd, env: { ...process.env, ...opts.env } });

function account(spec) {
  const acct = mkdtempSync(join(tmpdir(), "boqount-lib-"));
  mkdirSync(join(acct, "films/sounds/.raw"), { recursive: true });
  writeFileSync(join(acct, "films/sounds/spec.json"), JSON.stringify({ sounds: spec }));
  return acct;
}

test("the shipped spec: every entry has an id, a kind, what it is, a prompt and a use", () => {
  const { sounds } = JSON.parse(readFileSync(shippedSpec, "utf8"));
  assert.ok(sounds.length >= 40);
  const ids = new Set();
  for (const s of sounds) {
    assert.match(s.id, /^[a-z0-9-]+\/[a-z0-9-]+$/);
    assert.ok(["hit", "swell", "bed"].includes(s.kind), s.id);
    for (const k of ["is", "prompt", "use"]) assert.ok(typeof s[k] === "string" && s[k].length > 3, `${s.id}.${k}`);
    assert.ok(!ids.has(s.id), `${s.id} twice`);
    ids.add(s.id);
  }
});

t("gen without --yes asks for nothing and says what it would cost", () => {
  const acct = account([{ id: "ui/pop", kind: "hit", is: "a pop", prompt: "a pop", use: "x", seconds: 0.5, candidates: 3 }]);
  const r = lib(["gen"], { cwd: acct, env: { ELEVENLABS_API_KEY: "" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /3 takes to ask for, 1\.5 s/);
  assert.match(r.stdout, /Nothing was asked/);
  assert.deepEqual(readdirSync(join(acct, "films/sounds/.raw")), []);
});

t("gen --yes asks eleven.mjs for each take; a silent take is asked again of the next model", () => {
  const acct = account([{ id: "hit/thud", kind: "hit", is: "a thud", prompt: "a thud", use: "x", seconds: 0.5, candidates: 1 }]);
  const tone = join(acct, "tone.mp3");
  const quiet = join(acct, "quiet.mp3");
  ff("-f", "lavfi", "-i", "sine=frequency=200:duration=0.5", "-f", "mp3", tone);
  ff("-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.5", "-f", "mp3", quiet);
  // The first model answers silence, the second a tone; the fake records each request's model.
  const log = join(acct, "calls.log");
  const fake = join(acct, "fake-fetch.mjs");
  writeFileSync(
    fake,
    `import { appendFileSync, readFileSync } from "node:fs";
globalThis.fetch = async (url, init) => { const b = JSON.parse(init.body); appendFileSync(${JSON.stringify(log)}, b.model_id + "\\n");
  const data = readFileSync(b.model_id.endsWith("v3") ? ${JSON.stringify(quiet)} : ${JSON.stringify(tone)});
  return { ok: true, status: 200, arrayBuffer: async () => data }; };\n`,
  );
  const r = lib(["gen", "--yes"], { cwd: acct, execArgv: ["--import", fake], env: { ELEVENLABS_API_KEY: "xi-test" } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), ["eleven_text_to_sound_v3", "eleven_text_to_sound_v2"]);
  assert.match(r.stdout, /silent, asking the next model/);
  assert.match(r.stdout, /1 of 1 takes from 2 paid calls/);
  assert.ok(existsSync(join(acct, "films/sounds/.raw/hit__thud-0.mp3")));
});

t("build: a sliced take becomes single events, a low one gets harmonics a phone plays, and the manifest has every number", () => {
  const acct = account([
    { id: "ui/tick", kind: "hit", is: "a tick", prompt: "ticks", use: "a count steps", seconds: 4, candidates: 1, keep: 3, slice: true, repeat: true },
    { id: "hit/thud", kind: "hit", is: "a thud", prompt: "a thud", use: "a thing lands", seconds: 0.5, candidates: 1, keep: 1 },
  ]);
  // Three short clicks half a second apart; one low thump.
  ff("-f", "lavfi", "-i", "sine=frequency=2000:duration=2", "-af", "volume='if(lt(mod(t\\,0.5)\\,0.02)\\,1\\,0)':eval=frame,asetnsamples=64", "-f", "mp3", join(acct, "films/sounds/.raw/ui__tick-0.mp3"));
  ff("-f", "lavfi", "-i", "sine=frequency=55:duration=0.5", "-af", "afade=t=out:st=0.05:d=0.45", "-f", "mp3", join(acct, "films/sounds/.raw/hit__thud-0.mp3"));
  const r = lib(["build"], { cwd: acct });
  assert.equal(r.status, 0, r.stderr);
  const man = JSON.parse(readFileSync(join(acct, "films/sounds/library.json"), "utf8")).sounds;
  assert.equal(man["ui/tick"].variants.length, 3);
  assert.equal(man["ui/tick"].repeat, true);
  for (const v of man["ui/tick"].variants) assert.ok(v.dur < 0.4, `a slice of ${v.dur} s`);
  const thud = man["hit/thud"].variants[0];
  assert.equal(thud.body, true);
  for (const k of ["dur", "sync", "loud", "phone", "peak", "low", "voice", "centroid", "attack", "corr"]) assert.equal(typeof thud[k], "number", k);
  assert.ok(existsSync(join(acct, "films/sounds/library/hit/thud-1.flac")));
  // A person heard take 2 of the tick and rejected it.
  const d = lib(["drop", "ui/tick", "2"], { cwd: acct });
  assert.equal(d.status, 0, d.stderr);
  assert.equal(JSON.parse(readFileSync(join(acct, "films/sounds/library.json"), "utf8")).sounds["ui/tick"].variants.length, 2);
  assert.equal(existsSync(join(acct, "films/sounds/library/ui/tick-2.flac")), false);
  assert.match(lib(["audition"], { cwd: acct }).stdout, /audition\.html/);
});

test("the tonal set: the same key gives the same samples, and the first pluck is the root an octave up", () => {
  const a = toneSet("A", "minor");
  const b = toneSet("A", "minor");
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  assert.equal(Object.keys(a).length, 20);
  for (const k of Object.keys(a)) assert.deepEqual(a[k][0], b[k][0], k);
  // A in the octave from middle C is 440 Hz; the pluck sounds it an octave up.
  const { power, freq } = spectrum(a["pluck-1"][0].subarray(0, 0.2 * SR));
  let top = 0;
  for (let i = 1; i < power.length; i++) if (power[i] > power[top]) top = i;
  assert.ok(Math.abs(freq[top] - 880) < 15, `pluck-1 peaks at ${freq[top]} Hz, not 880`);
  assert.throws(() => toneSet("H"), /root/);
});

t("tone writes the set and its manifest beside the film's audio", () => {
  const audio = mkdtempSync(join(tmpdir(), "boqount-tone-"));
  const r = lib(["tone", audio, "Eb", "major"]);
  assert.equal(r.status, 0, r.stderr);
  const man = JSON.parse(readFileSync(join(audio, "tone/tone.json"), "utf8"));
  assert.equal(man.key, "Eb major");
  assert.equal(man.sounds["tone/blip-1"].repeat, true);
  assert.ok(decode(join(audio, "tone/riser-1.flac"))[0].length > 0.9 * SR);
});

test("the key of a chord progression in A minor comes out A minor or its relative C major", () => {
  const rate = 22050;
  const notes = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [220, 261.63, 329.63], [164.81, 207.65, 246.94]];
  const m = new Float32Array(rate * notes.length);
  notes.forEach((chord, j) => {
    for (let i = 0; i < rate; i++) for (const f of chord) m[j * rate + i] += Math.sin((2 * Math.PI * f * i) / rate) / 3;
  });
  const best = keysOf(chroma(m, rate))[0].key;
  assert.ok(["A minor", "C major"].includes(best), best);
});

test("flashes: opposing changes of a tenth or more are counted, slow drifts are not", () => {
  assert.deepEqual(changes([0, 0.5, 0, 0.5, 0]), [1, 2, 3, 4]);
  assert.deepEqual(changes([0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12]), [5]);
  assert.deepEqual(changes([0.5, 0.45, 0.5, 0.45]), []);
});

t("flashes: a frame that swaps dark and bright five times a second fails; a slow fade passes; --loop reads across the end", () => {
  const dir = mkdtempSync(join(tmpdir(), "boqount-flash-"));
  const film = (name, lum) => (ff("-f", "lavfi", "-i", "color=c=black:s=108x192:d=2:r=30", "-vf", `geq=lum='${lum}':cb=128:cr=128`, "-pix_fmt", "yuv420p", join(dir, name)), join(dir, name));
  const run = (file, ...flags) => spawnSync("node", [join(tools, "flashes.mjs"), file, ...flags], { encoding: "utf8" });
  const flicker = run(film("flicker.mp4", "if(lt(mod(N\\,6)\\,3)\\,16\\,235)"));
  assert.equal(flicker.status, 1, flicker.stdout);
  assert.match(flicker.stdout, /FAIL/);
  const fade = run(film("fade.mp4", "16+N*3"));
  assert.equal(fade.status, 0, fade.stdout);
  // Dark for 1.8 s, then three quick swaps in the last 0.2 s: alone they pass, read round the loop into a dark head
  // they are still three flashes at most, but a film whose head swaps too fails with --loop.
  const ends = film("ends.mp4", "if(gt(N\\,53)\\,if(mod(N\\,2)\\,235\\,16)\\,if(lt(N\\,6)\\,if(mod(N\\,2)\\,16\\,235)\\,16))");
  assert.equal(run(ends).status, 0);
  assert.equal(run(ends, "--loop").status, 1);
});

test("tempo: a kick every beat reads as its tempo; too short a file has none", () => {
  const rate = 22050;
  const kicks = (bpm, seconds) => {
    const m = new Float32Array(rate * seconds);
    const period = (60 / bpm) * rate;
    for (let i = 0; i < m.length; i++) {
      const t = (i % period) / rate;
      m[i] = 0.8 * Math.sin(2 * Math.PI * 60 * (i / rate)) * Math.exp(-30 * t);
    }
    return m;
  };
  for (const bpm of [90, 120, 128]) {
    const r = tempo(kicks(bpm, 20), rate);
    assert.ok(Math.abs(r.bpm - bpm) / bpm < 0.02, `${bpm} read as ${r.bpm}`);
  }
  assert.equal(tempo(new Float32Array(rate), rate), null);
});

// Model listening (listen.mjs), with a fake pair of listeners: no package and no download in a test.
import { build } from "../skills/boqount/tools/soundlib.mjs";
import { passes, resample } from "../skills/boqount/tools/listen.mjs";

function fakeEars(heardAs, tagsFor) {
  // CLAP: each description is a unit vector on its own axis; a take points at the axis of what it is heard as.
  let labels = [];
  let n = 0;
  return {
    ear: {
      async texts(l) {
        labels = l;
        return l.map((_, i) => l.map((__, j) => (i === j ? 1 : 0)));
      },
      async audio() {
        const want = heardAs[n] ?? labels[0];
        return labels.map((x) => (x === want ? 1 : 0.1 * Math.random()));
      },
    },
    tagger: {
      async tags() {
        return tagsFor[n++] ?? [["Silence", 0.9]];
      },
    },
  };
}

t("build listens: a take heard as its own sound or tagged with one of its tags stays; music and a rejected label go", async () => {
  const acct = account([
    { id: "ui/pop", kind: "hit", is: "a bubble pop", prompt: "p", use: "x", seconds: 0.5, candidates: 4, keep: 4, tags: ["Burst, pop"], reject: ["Knock"] },
    { id: "hit/thud", kind: "hit", is: "a heavy thud", prompt: "t", use: "x", seconds: 0.5, candidates: 1 },
  ]);
  for (let k = 0; k < 4; k++) ff("-f", "lavfi", "-i", `sine=frequency=${800 + k * 100}:duration=0.3`, "-af", "afade=t=out:st=0.02:d=0.28", "-f", "mp3", join(acct, `films/sounds/.raw/ui__pop-${k}.mp3`));
  // Take 0: CLAP hears it as itself. Take 1: heard as a thud, but AST names a tag. Take 2: AST hears music first.
  // Take 3: heard as a thud, tagged with a rejected label.
  const ears = fakeEars(
    ["a bubble pop", "a heavy thud", "a bubble pop", "a heavy thud"],
    [[["Burst, pop", 0.4]], [["Burst, pop", 0.2], ["Tick", 0.1]], [["Music", 0.6], ["Burst, pop", 0.3]], [["Knock", 0.3], ["Tap", 0.2]]],
  );
  // Two entries: rank <= 5 always holds in a two-sound library, so a spec maxrank of 1 makes rank mean "heard first".
  const spec = JSON.parse(readFileSync(join(acct, "films/sounds/spec.json"), "utf8"));
  spec.sounds[0].maxrank = 1;
  writeFileSync(join(acct, "films/sounds/spec.json"), JSON.stringify(spec));
  const out = await build(["--films", join(acct, "films"), "--only", "ui/pop"], { listeners: ears });
  assert.match(out, /^listened: CLAP and AST/);
  const v = JSON.parse(readFileSync(join(acct, "films/sounds/library.json"), "utf8")).sounds["ui/pop"].variants;
  assert.deepEqual(v.map((x) => x.take).sort(), ["0", "1"]);
  assert.equal(v[0].take, "0", "the take heard as itself goes first");
  for (const x of v) for (const k of ["fit", "rank", "heard", "tags"]) assert.ok(x[k] !== undefined, k);
  assert.match(lib(["audition"], { cwd: acct }).stdout, /audition\.html/);
  assert.match(readFileSync(join(acct, "films/sounds/audition.html"), "utf8"), /heard as: Burst, pop/);
});

t("build without the package keeps by measurement and says it did not listen", async () => {
  const acct = account([{ id: "hit/thud", kind: "hit", is: "a thud", prompt: "t", use: "x", seconds: 0.5, candidates: 1 }]);
  ff("-f", "lavfi", "-i", "sine=frequency=300:duration=0.3", "-f", "mp3", join(acct, "films/sounds/.raw/hit__thud-0.mp3"));
  const out = await build(["--films", join(acct, "films")], { listeners: { missing: "not installed here" } });
  assert.match(out, /^not listened: not installed here/);
  const s = JSON.parse(readFileSync(join(acct, "films/sounds/library.json"), "utf8")).sounds["hit/thud"];
  assert.equal(s.listened, false);
  assert.equal(s.variants.length, 1);
  assert.equal(s.variants[0].heard, undefined);
});

test("passes: the private build's rules, one by one", () => {
  const base = { dur: 0.3, centroid: 2000, rank: 9, heard: "x", tags: [["Tick", 0.02]], tagged: 0 };
  const s = { kind: "hit", tags: ["Tick"] };
  assert.equal(passes(s, { ...base, rank: 5 }), true, "own description among the five nearest");
  assert.equal(passes(s, { ...base, rank: 6 }), false);
  assert.equal(passes({ ...s, maxrank: 8 }, { ...base, rank: 6 }), true);
  assert.equal(passes(s, { ...base, tagged: 0.05 }), true, "a tag at 0.05");
  assert.equal(passes(s, { ...base, heard: "a key" }, ["a key"]), true, "heard as an accepted entry");
  assert.equal(passes(s, { ...base, rank: 1, tags: [["Speech", 0.3]] }), false, "speech first");
  assert.equal(passes({ ...s, musical: true }, { ...base, rank: 1, tags: [["Music", 0.9]] }), true, "musical keeps music");
  assert.equal(passes({ ...s, kind: "bed" }, { ...base, rank: 1, tags: [["Speech", 0.9]] }), true, "a bed may sound like voices");
  assert.equal(passes({ ...s, reject: ["Knock"] }, { ...base, rank: 1, tags: [["Tick", 0.5], ["Knock", 0.1]] }), false, "a rejected label");
  assert.equal(passes({ ...s, max: 0.2 }, { ...base, rank: 1 }), false, "too long");
  assert.equal(passes({ ...s, minCentroid: 3000 }, { ...base, rank: 1 }), false, "too dark");
});

test("the shipped spec: listening fields have their shapes, and every accepted id is a sound or a known gap", () => {
  const { sounds } = JSON.parse(readFileSync(shippedSpec, "utf8"));
  const ids = new Set(sounds.map((s) => s.id));
  for (const s of sounds) {
    for (const k of ["tags", "reject", "accept"]) if (s[k] !== undefined) assert.ok(Array.isArray(s[k]) && s[k].every((x) => typeof x === "string"), `${s.id}.${k}`);
    if (s.musical !== undefined) assert.equal(typeof s.musical, "boolean", s.id);
    if (s.rev !== undefined) assert.ok(Number.isInteger(s.rev) && s.rev >= 2, s.id);
    for (const a of s.accept ?? []) assert.ok(ids.has(a) || a === "move/swish", `${s.id} accepts ${a}`);
  }
  assert.ok(sounds.length >= 65);
});

test("resample: a 48 kHz second becomes a 16 kHz second", () => {
  assert.equal(resample(new Float32Array(48000), 48000, 16000).length, 16000);
});
