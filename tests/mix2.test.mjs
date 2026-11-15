// tools/mix2.mjs (a version-2 cue sheet, handed over by mix.mjs) and tools/soundcheck.mjs, on generated sounds.
// Each of the mixer's four lessons has its test here. Needs ffmpeg; each test skips cleanly without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decode, measure } from "../skills/boqount/tools/sound-lib.mjs";

const tools = fileURLToPath(new URL("../skills/boqount/tools/", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = (name, fn) => test(name, { skip: !hasFfmpeg && "ffmpeg is not installed" }, fn);
const ff = (...args) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args]);
const WORDS = ["Water", "it", "when", "the", "soil", "is", "dry"].map((word, i) => ({ word, start: +(0.2 + i * 0.3).toFixed(3), end: +(0.2 + i * 0.3 + 0.25).toFixed(3) }));

/**
 * An account with films/q/audio ready to mix: a speech-like voice (a tone whose level moves four times a second) of
 * `voice` seconds, or none; the kit; a library with `lib` entries ({ id: [file-maker, ...] }); the sheet.
 */
function account({ duration = 3, voice = duration, sheet, lib = {} }) {
  const acct = mkdtempSync(join(tmpdir(), "boqount-mix2-"));
  const audio = join(acct, "films/q/audio");
  mkdirSync(audio, { recursive: true });
  execFileSync("node", [join(tools, "sfx-kit.mjs"), "--out", join(acct, "films/sfx")]);
  if (voice) ff("-f", "lavfi", "-i", `sine=frequency=220:duration=${voice}:sample_rate=48000`, "-af", "volume=2,tremolo=f=4:d=0.6", "-ac", "1", join(audio, "vo.wav"));
  writeFileSync(join(audio, "cues.json"), JSON.stringify({ duration, lines: [{ id: "hook", text: "x", start: 0.2, end: 2.25, words: WORDS }] }));
  const manifest = { sounds: {} };
  for (const [id, makers] of Object.entries(lib)) {
    mkdirSync(join(acct, "films/sounds/library", id.split("/")[0]), { recursive: true });
    manifest.sounds[id] = {
      kind: id.startsWith("amb/") ? "bed" : "hit",
      variants: makers.map((make, n) => {
        const file = `${id}-${n + 1}.wav`;
        make(join(acct, "films/sounds/library", file));
        return { file, ...measure(decode(join(acct, "films/sounds/library", file))) };
      }),
    };
  }
  mkdirSync(join(acct, "films/sounds"), { recursive: true });
  writeFileSync(join(acct, "films/sounds/library.json"), JSON.stringify(manifest));
  writeFileSync(join(audio, "sfx-cues.json"), JSON.stringify({ version: 2, loop: false, hits: [], music: { segments: [] }, ...sheet }));
  return { acct, audio };
}
const sine = (hz, sec, vol = 0.5) => (file) => ff("-f", "lavfi", "-i", `sine=frequency=${hz}:duration=${sec}:sample_rate=48000`, "-af", `volume=${vol}`, file);
/** A build: a tone rising in level to its peak at `peak` s, then cut dead. */
const swell = (peak) => (file) => ff("-f", "lavfi", "-i", `sine=frequency=880:duration=${peak}:sample_rate=48000`, "-af", `volume='t/${peak}':eval=frame`, file);
const mix = (audio, timeout = 120_000) => spawnSync("node", [join(tools, "mix.mjs"), audio], { encoding: "utf8", timeout });
/** The first time a stem's level passes a tenth of its peak, and the time of its peak (seconds). */
function onsetAndPeak(file) {
  const [L] = decode(file);
  let pk = 0, at = 0;
  L.forEach((v, i) => Math.abs(v) > pk && ((pk = Math.abs(v)), (at = i)));
  return { onset: L.findIndex((v) => Math.abs(v) > pk / 10) / 48000, peak: at / 48000, level: pk };
}
const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));

t("mix.mjs hands a version-2 sheet to mix2: stems, played.json, and a voiced master at -14 LUFS, at most -1 dBTP", () => {
  const { audio } = account({ sheet: { hits: [{ sound: "kit/pop", at: "hook.0", under: 12, _: "a word rises" }] } });
  const r = mix(audio);
  assert.equal(r.status, 0, r.stderr);
  for (const k of ["vo", "music", "sfx", "beds"]) assert.ok(existsSync(join(audio, `stems/${k}.wav`)), k);
  const played = JSON.parse(readFileSync(join(audio, "stems/played.json"), "utf8"));
  assert.equal(played.hits[0].sound, "kit/pop");
  assert.equal(played.hits[0]._, "a word rises");
  const log = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-nostats", "-i", join(audio, "mix.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const tail = log.slice(log.lastIndexOf("Summary:"));
  assert.ok(Math.abs(Number(/I:\s+(-?[\d.]+)/.exec(tail)[1]) + 14) <= 0.5, tail);
  assert.ok(Number(/Peak:\s+(-?[\d.]+)/.exec(tail)[1]) <= -0.95, tail);
});

t("lesson 1: every sum starts at time zero, so a first hit trimmed with `from` stays where it was put", () => {
  const { audio } = account({ voice: 0, lib: { "hit/tone": [sine(1000, 1.5)] }, sheet: { hits: [{ sound: "hit/tone", at: 2.7, from: 0.5, gain: -12 }] } });
  const r = mix(audio);
  assert.equal(r.status, 0, r.stderr);
  const { onset } = onsetAndPeak(join(audio, "stems/sfx.wav"));
  assert.ok(Math.abs(onset - 2.7) < 0.02, `the hit starts at ${onset} s, not 2.7`);
});

t("lesson 2: music, a background and hits through every bus finish without a stall", () => {
  const { audio } = account({
    duration: 4,
    lib: { "amb/room": [(f) => ff("-f", "lavfi", "-i", "anoisesrc=color=pink:duration=2:sample_rate=48000:seed=3", "-af", "volume=0.05", f)], "hit/tone": [sine(800, 0.3)] },
    sheet: { music: { gain: -18, segments: [{ file: "bed.wav", at: 0, from: 0, to: 4 }] }, beds: [{ sound: "amb/room", at: 0.5, until: "end", under: 20 }], hits: [{ sound: "hit/tone", at: "hook.1", from: 0.05, under: 12 }, { sound: "hit/tone", at: "hook.3", under: 12, duck: false }] },
  });
  ff("-f", "lavfi", "-i", "sine=frequency=330:duration=4:sample_rate=48000", join(audio, "bed.wav"));
  const r = mix(audio, 60_000);
  assert.equal(r.error, undefined, "the mix stalled");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(rms(decode(join(audio, "stems/beds.wav"))[0]) > 0, "the background was mixed");
});

t("lesson 3: in a looping film the music goes on after the voice stops (the compressor's key outlasts the film)", () => {
  const { audio } = account({ duration: 3, voice: 1, sheet: { loop: true, music: { gain: -18, segments: [{ file: "bed.wav", at: 0, from: 0, to: 3 }] } } });
  ff("-f", "lavfi", "-i", "sine=frequency=330:duration=8:sample_rate=48000", join(audio, "bed.wav"));
  const r = mix(audio);
  assert.equal(r.status, 0, r.stderr);
  const [L] = decode(join(audio, "stems/music.wav"));
  assert.ok(L.length >= 2.99 * 48000, `the music stem is ${L.length / 48000} s`);
  assert.ok(rms(L.subarray(L.length - 24000)) > 0.001, "the music's last half second is silent");
});

t("lesson 4: a build placed by its peak counts its `from`, so the peak lands on the cue", () => {
  const { audio } = account({ voice: 0, lib: { "move/riser": [swell(1.0)] }, sheet: { hits: [{ sound: "move/riser", at: 2.0, from: 0.4, align: "sync", gain: -12 }] } });
  const r = mix(audio);
  assert.equal(r.status, 0, r.stderr);
  const { peak } = onsetAndPeak(join(audio, "stems/sfx.wav"));
  assert.ok(Math.abs(peak - 2.0) < 0.03, `the riser peaks at ${peak} s, not on the cue at 2.0`);
});

t("takes rotate, and `under` sets each take by its own phone loudness, so a quiet take and a loud one land alike", () => {
  const { audio } = account({ lib: { "hit/tap": [sine(900, 0.3, 0.6), sine(900, 0.3, 0.15)] }, sheet: { hits: [0, 1, 2].map((k) => ({ sound: "hit/tap", at: `hook.${2 * k}`, under: 14 })) } });
  const r = mix(audio);
  assert.equal(r.status, 0, r.stderr);
  const played = JSON.parse(readFileSync(join(audio, "stems/played.json"), "utf8"));
  assert.deepEqual(played.hits.map((h) => h.take), ["hit/tap-1.wav", "hit/tap-2.wav", "hit/tap-1.wav"]);
  const lib = JSON.parse(readFileSync(join(audio, "../../sounds/library.json"), "utf8")).sounds["hit/tap"].variants;
  const gap = played.hits[1].db - played.hits[0].db;
  assert.ok(Math.abs(gap - (lib[0].phone - lib[1].phone)) < 0.2, `gain gap ${gap} against phone gap ${lib[0].phone - lib[1].phone}`);
});

t("every missing sound is named in one error, and nothing is mixed", () => {
  const { audio } = account({ sheet: { hits: [{ sound: "ui/nothing", at: 0.5 }, { sound: "kit/none", at: 1 }, { sfx: "gone", at: 1.5 }] } });
  const r = mix(audio);
  assert.equal(r.status, 1);
  for (const name of ["ui/nothing", "kit/none", "gone"]) assert.match(r.stderr, new RegExp(name));
  assert.equal(existsSync(join(audio, "mix.wav")), false);
});

t("a sheet's names and numbers are checked before they reach a filter graph", () => {
  for (const hit of [{ sound: "../x", at: 1 }, { sound: "kit/pop", at: 1, gain: "-6;rm" }, { sound: "kit/pop", at: 1, align: "start" }, { sfx: "a/b", at: 1 }]) {
    const { audio } = account({ sheet: { hits: [hit] } });
    const r = mix(audio);
    assert.equal(r.status, 1, JSON.stringify(hit));
    assert.equal(existsSync(join(audio, "mix.wav")), false);
  }
});

t("a voice-free film is levelled against a nominal voice and kept under the ceiling, never crushed to reach the target", () => {
  const { audio } = account({ voice: 0, sheet: { hits: [{ sound: "kit/pop", at: 0.5, under: 8 }, { sound: "kit/tick", at: 1.5, under: 18 }] } });
  const r = mix(audio);
  assert.equal(r.status, 0, r.stderr);
  const played = JSON.parse(readFileSync(join(audio, "stems/played.json"), "utf8"));
  assert.equal(played.voice.nominal, true);
  assert.ok(played.after.TP <= -0.95, `true peak ${played.after.TP}`);
  const c = spawnSync("node", [join(tools, "soundcheck.mjs"), audio], { encoding: "utf8" });
  assert.match(c.stdout, /no voice/);
});

t("soundcheck: one line a rule, and a fail for the same file twice within a second", () => {
  const { audio } = account({ lib: { "hit/tap": [sine(900, 0.2)] }, sheet: { hits: [{ sound: "hit/tap", at: 1.0, under: 14 }, { sound: "hit/tap", at: 1.4, under: 14 }] } });
  assert.equal(mix(audio).status, 0);
  const r = spawnSync("node", [join(tools, "soundcheck.mjs"), audio], { encoding: "utf8" });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /FAIL {2}the same file twice within a second: 1/);
  assert.match(r.stdout, /ok {4}master -1[34]\.\d+ LUFS|ok {4}master -14 LUFS/);
  assert.match(r.stdout, /long sounds \(over 1 s\)/);
});

t("soundcheck passes a film whose hits keep to the rules", () => {
  const { audio } = account({ lib: { "hit/a": [sine(700, 0.2)], "hit/b": [sine(1100, 0.2)] }, sheet: { hits: [{ sound: "hit/a", at: "hook.0", under: 16 }, { sound: "hit/b", at: "hook.3", under: 16 }, { sound: "hit/a", at: "hook.6", under: 16 }] } });
  assert.equal(mix(audio).status, 0);
  const r = spawnSync("node", [join(tools, "soundcheck.mjs"), audio], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /all rules pass/);
});
