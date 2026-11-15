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
