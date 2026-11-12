// tools/mix.mjs on generated tones: the soundtrack's length, where a hit lands, and where a sound file is looked up.
// Needs ffmpeg; each test skips cleanly without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const mix = fileURLToPath(new URL("../skills/boqount/tools/mix.mjs", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = (name, fn) => test(name, { skip: !hasFfmpeg && "ffmpeg is not installed" }, fn);

const ffmpeg = (...args) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args]);
const tone = (file, hz, sec, volume = 0.5) => ffmpeg("-f", "lavfi", "-i", `sine=frequency=${hz}:duration=${sec}:sample_rate=48000`, "-af", `volume=${volume}`, file);
const quiet = (file, sec) => ffmpeg("-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono`, "-t", String(sec), "-c:a", "pcm_s16le", file);

// Quillfern's one line, "Water it when the soil is dry", read at about three words a second.
const WORDS = ["Water", "it", "when", "the", "soil", "is", "dry"].map((word, i) => ({ word, start: +(0.2 + i * 0.3).toFixed(3), end: +(0.2 + i * 0.3 + 0.25).toFixed(3) }));

/** An account folder with films/quillfern/audio ready to mix: a silent voice, the cue sheet, the hit list. */
function film({ duration = 2.4, loop = false, hits = [], prefix = "boqount-mix-", vo = true } = {}) {
  const acct = mkdtempSync(join(tmpdir(), prefix));
  const audio = join(acct, "films/quillfern/audio");
  mkdirSync(join(audio, "sfx"), { recursive: true });
  mkdirSync(join(acct, "films/sfx"), { recursive: true });
  if (vo) quiet(join(audio, "vo.wav"), duration);
  writeFileSync(join(audio, "cues.json"), JSON.stringify({ duration, lines: [{ id: "hook", text: WORDS.map((w) => w.word).join(" "), start: 0.2, end: WORDS.at(-1).end, words: WORDS }] }));
  writeFileSync(join(audio, "sfx-cues.json"), JSON.stringify({ loop, hits, music: { segments: [] } }));
  return { acct, audio, kit: join(acct, "films/sfx") };
}
const runMix = (args, cwd) => spawnSync("node", [mix, ...args], { encoding: "utf8", cwd });
const probe = (file) => {
  const s = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], { encoding: "utf8" }));
  return { stream: s.streams[0], seconds: Number(s.format.duration) };
};
/** The mix as mono 16-bit samples at 48 kHz. */
function pcm(file) {
  const raw = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-ac", "1", "-ar", "48000", "-f", "s16le", "-"], { maxBuffer: 1 << 26 });
  return new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
}
/** Seconds at which the sound starts (first sample above a tenth of the peak), and its pitch from zero crossings over the next 50 ms. */
function onset(samples) {
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak > 500, "the mix is silent");
  const i = samples.findIndex((v) => Math.abs(v) > peak / 10);
  let crossings = 0;
  for (let k = i + 1; k < i + 2400; k++) if (samples[k - 1] < 0 !== samples[k] < 0) crossings++;
  return { at: i / 48000, hz: crossings / 2 / 0.05 };
}

t("the mix is 48 kHz stereo s16 and as long as the cue sheet says, rounded up to whole 30 fps frames when the film loops", () => {
  const looping = film({ duration: 2.4 + 0.01, loop: true, hits: [{ sfx: "tone", at: "hook.0", gain: -6 }] });
  tone(join(looping.audio, "sfx/tone.wav"), 1000, 0.2);
  const r = runMix([looping.audio]);
  assert.equal(r.status, 0, r.stderr);
  const { stream, seconds } = probe(join(looping.audio, "mix.wav"));
  assert.equal(stream.sample_rate, "48000");
  assert.equal(stream.channels, 2);
  assert.equal(stream.codec_name, "pcm_s16le");
  assert.ok(Math.abs(seconds - Math.ceil(2.41 * 30) / 30) < 0.002, `looping mix lasts ${seconds}`);

  const plain = film({ duration: 2.4, loop: false, hits: [{ sfx: "tone", at: "hook.0", gain: -6 }] });
  tone(join(plain.audio, "sfx/tone.wav"), 1000, 0.2);
  assert.equal(runMix([plain.audio]).status, 0);
  assert.ok(Math.abs(probe(join(plain.audio, "mix.wav")).seconds - 2.4) < 0.002);
  assert.equal(existsSync(join(looping.audio, ".mix-long.wav")), false, "the looping mix's scratch file is removed");
});

t("a hit placed by line.word lands at that word's start, and offset moves it", () => {
  const f = film({ hits: [{ sfx: "tone", at: "hook.3", gain: -6 }] });
  tone(join(f.audio, "sfx/tone.wav"), 1000, 0.2);
  assert.equal(runMix([f.audio]).status, 0);
  assert.ok(Math.abs(onset(pcm(join(f.audio, "mix.wav"))).at - WORDS[3].start) < 0.01);

  const g = film({ hits: [{ sfx: "tone", at: "hook.3", offset: 0.25, gain: -6 }] });
  tone(join(g.audio, "sfx/tone.wav"), 1000, 0.2);
  assert.equal(runMix([g.audio]).status, 0);
  assert.ok(Math.abs(onset(pcm(join(g.audio, "mix.wav"))).at - (WORDS[3].start + 0.25)) < 0.01);
});

t("a .wav kit file is found in --sfx, and so is an .mp3", () => {
  const f = film({ hits: [{ sfx: "ding", at: "hook.1", gain: -6 }] });
  const other = mkdtempSync(join(tmpdir(), "boqount-kit-"));
  tone(join(other, "ding.wav"), 1000, 0.2);
  assert.equal(runMix([f.audio, "--sfx", other]).status, 0);
  assert.ok(Math.abs(onset(pcm(join(f.audio, "mix.wav"))).at - WORDS[1].start) < 0.01);

  const g = film({ hits: [{ sfx: "ding", at: "hook.1", gain: -6 }] });
  const mp3s = mkdtempSync(join(tmpdir(), "boqount-kit-"));
  tone(join(mp3s, "ding.mp3"), 1000, 0.2);
  assert.equal(runMix([g.audio, "--sfx", mp3s]).status, 0);
  assert.ok(Math.abs(onset(pcm(join(g.audio, "mix.wav"))).at - WORDS[1].start) < 0.02);
});

t("without --sfx the kit is films/sfx, two folders above the audio folder", () => {
  const f = film({ hits: [{ sfx: "ding", at: "hook.1", gain: -6 }] });
  tone(join(f.kit, "ding.wav"), 1000, 0.2);
  assert.equal(runMix([f.audio]).status, 0);
  assert.ok(Math.abs(onset(pcm(join(f.audio, "mix.wav"))).at - WORDS[1].start) < 0.01);
});

t("the film's own audio/sfx wins over the kit, and a .wav is tried before an .mp3", () => {
  const f = film({ hits: [{ sfx: "ding", at: "hook.1", gain: -6 }] });
  tone(join(f.audio, "sfx/ding.wav"), 1000, 0.2);
  tone(join(f.kit, "ding.wav"), 250, 0.2);
  assert.equal(runMix([f.audio]).status, 0);
  const own = onset(pcm(join(f.audio, "mix.wav")));
  assert.ok(Math.abs(own.hz - 1000) < 100, `the film's file has 1000 Hz, the mix has ${own.hz}`);

  const g = film({ hits: [{ sfx: "ding", at: "hook.1", gain: -6 }] });
  tone(join(g.kit, "ding.wav"), 1000, 0.2);
  tone(join(g.kit, "ding.mp3"), 250, 0.2);
  assert.equal(runMix([g.audio]).status, 0);
  assert.ok(Math.abs(onset(pcm(join(g.audio, "mix.wav"))).hz - 1000) < 100);
});

t("a missing sound is an error naming it, and no mix is written", () => {
  const f = film({ hits: [{ sfx: "ding", at: "hook.1", gain: -6 }, { sfx: "chime", at: "hook.2", gain: -6 }] });
  tone(join(f.kit, "ding.wav"), 1000, 0.2);
  const r = runMix([f.audio]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /chime/);
  assert.equal(existsSync(join(f.audio, "mix.wav")), false);
});

t("no folder is a usage error", () => {
  const r = runMix([]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage/);
});

t("mix refuses a sound name that is a path or holds a quote", () => {
  const f = film({});
  const scratch = mkdtempSync(join(tmpdir(), "boqount-cwd-"));
  tone(join(f.kit, "ding.wav"), 1000, 0.2);
  for (const name of ["../ding", "sub/ding", "/etc/passwd", "ding'; touch INJECTED; '", 'ding" -y', "ding$(touch INJECTED)", "ding;touch INJECTED", "ding.flac", ""]) {
    writeFileSync(join(f.audio, "sfx-cues.json"), JSON.stringify({ loop: false, hits: [{ sfx: name, at: "hook.1", gain: -6 }], music: { segments: [] } }));
    const r = runMix([f.audio], scratch);
    assert.equal(r.status, 1, JSON.stringify(name));
    assert.ok(r.stderr.includes(JSON.stringify(name)), `the error names ${JSON.stringify(name)}: ${r.stderr}`);
    assert.equal(existsSync(join(f.audio, "mix.wav")), false);
  }
  assert.deepEqual(readdirSync(scratch), [], "nothing was created by an injected command");
  assert.equal(existsSync(join(f.audio, "INJECTED")), false);
  // A music file is a name as well.
  writeFileSync(join(f.audio, "sfx-cues.json"), JSON.stringify({ loop: false, hits: [], music: { gain: -18, duckDb: 6, segments: [{ file: "../bed.mp3", at: 0, from: 0, to: 1 }] } }));
  const m = runMix([f.audio], scratch);
  assert.equal(m.status, 1);
  assert.match(m.stderr, /\.\.\/bed\.mp3/);
});

t("mix refuses a gain that is not a number", () => {
  const f = film({});
  tone(join(f.kit, "ding.wav"), 1000, 0.2);
  const scratch = mkdtempSync(join(tmpdir(), "boqount-cwd-"));
  const hits = [
    [{ sfx: "ding", at: "hook.1", gain: "-6; touch INJECTED" }, /hits\[0\]\.gain/],
    [{ sfx: "ding", at: "hook.1", gain: null }, /hits\[0\]\.gain/],
    [{ sfx: "ding", at: "hook.1", gain: -6, offset: "0.1" }, /hits\[0\]\.offset/],
    [{ sfx: "ding", at: "hook.1", gain: -6, until: "hook.2", fade: "x" }, /hits\[0\]\.fade/],
    [{ sfx: "ding", at: "hook.1;touch INJECTED", gain: -6 }, /hits\[0\]\.at|no cue/],
    [{ sfx: "ding", at: { x: 1 }, gain: -6 }, /hits\[0\]\.at/],
  ];
  for (const [hit, pattern] of hits) {
    writeFileSync(join(f.audio, "sfx-cues.json"), JSON.stringify({ loop: false, hits: [hit], music: { segments: [] } }));
    const r = runMix([f.audio], scratch);
    assert.equal(r.status, 1, JSON.stringify(hit));
    assert.match(r.stderr, pattern, JSON.stringify(hit));
  }
  assert.deepEqual(readdirSync(scratch), []);
  assert.equal(existsSync(join(f.audio, "mix.wav")), false);
});

t("mix works from a folder whose path holds a space and a single quote", () => {
  const scratch = mkdtempSync(join(tmpdir(), "boqount-cwd-"));
  const f = film({ hits: [{ sfx: "ding", at: "hook.3", gain: -6 }], loop: true, prefix: "my film's \"audio\"; touch INJECTED; echo " });
  assert.match(f.audio, /my film's/);
  tone(join(f.kit, "ding.wav"), 1000, 0.2);
  const r = runMix([f.audio], scratch);
  assert.equal(r.status, 0, r.stderr);
  const { stream, seconds } = probe(join(f.audio, "mix.wav"));
  assert.equal(stream.channels, 2);
  assert.ok(Math.abs(seconds - Math.ceil(2.4 * 30) / 30) < 0.002, `lasts ${seconds}`);
  assert.ok(Math.abs(onset(pcm(join(f.audio, "mix.wav"))).at - WORDS[3].start) < 0.01);
  assert.deepEqual(readdirSync(scratch), [], "nothing was created by an injected command");
  assert.equal(existsSync(join(f.audio, "INJECTED")), false);
  assert.equal(existsSync(join(f.audio, ".mix-long.wav")), false);
});

/** The true peak of a file, dBFS, as ffmpeg's ebur128 measures it. */
function truePeak(file) {
  const stats = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return Number(/True peak:\s*Peak:\s*(-?[\d.]+)/.exec(stats.slice(stats.lastIndexOf("Summary:")))?.[1]);
}

/** The peak, in dBFS, of the samples in [from, to) seconds. */
function peakDb(samples, from, to) {
  let m = 0;
  for (let i = Math.round(from * 48000); i < Math.min(samples.length, Math.round(to * 48000)); i++) m = Math.max(m, Math.abs(samples[i]));
  return 20 * Math.log10(m / 32768);
}

t("mix builds a voice-free soundtrack with no vo.wav", () => {
  for (const loop of [false, true]) {
    const f = film({ vo: false, loop, hits: [{ sfx: "ding", at: "hook.2", gain: -6 }] });
    tone(join(f.kit, "ding.wav"), 1000, 0.2);
    const r = runMix([f.audio]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(join(f.audio, "vo.wav")), false, "no vo.wav is written");
    const { stream, seconds } = probe(join(f.audio, "mix.wav"));
    assert.equal(stream.sample_rate, "48000");
    assert.equal(stream.channels, 2);
    assert.ok(Math.abs(seconds - 2.4) < 0.002, `lasts ${seconds}`);
    assert.ok(Math.abs(onset(pcm(join(f.audio, "mix.wav"))).at - WORDS[2].start) < 0.01);
    // A quiet hit (a -18 dBFS tone at -6 dB) is brought up: the mix's true peak lands at -3 dBFS.
    const tp = truePeak(join(f.audio, "mix.wav"));
    assert.ok(Math.abs(tp - -3) <= 1, `true peak ${tp} dBFS`);
  }
});

t("a voice-free mix keeps the cue sheet's relative gains", () => {
  // Two hits of one sound at gains 1 and 0.5 (0 dB and -6 dB): no loudness normalisation pulls them together.
  for (const vo of [false, true]) {
    const f = film({ vo, hits: [{ sfx: "ding", at: "hook.0", gain: 0 }, { sfx: "ding", at: "hook.4", gain: -6 }] });
    tone(join(f.kit, "ding.wav"), 1000, 0.2, 0.25);
    const r = runMix([f.audio]);
    assert.equal(r.status, 0, r.stderr);
    const s = pcm(join(f.audio, "mix.wav"));
    const loud = peakDb(s, WORDS[0].start, WORDS[0].start + 0.2);
    const soft = peakDb(s, WORDS[4].start, WORDS[4].start + 0.2);
    assert.ok(Math.abs(loud - soft - 6) < 0.5, `${vo ? "silent vo.wav" : "no vo.wav"}: ${loud.toFixed(2)} and ${soft.toFixed(2)} dBFS`);
  }
});

t("a loud voice-free mix is brought down to a true peak of -3 dBFS as a whole", () => {
  // A -19 dBFS tone at +24 dB and +18 dB: well over full scale before the mix is brought down.
  const f = film({ vo: false, hits: [{ sfx: "ding", at: "hook.0", gain: 24 }, { sfx: "ding", at: "hook.4", gain: 18 }] });
  tone(join(f.kit, "ding.wav"), 1000, 0.2, 0.9);
  const r = runMix([f.audio]);
  assert.equal(r.status, 0, r.stderr);
  const tp = truePeak(join(f.audio, "mix.wav"));
  assert.ok(Math.abs(tp - -3) <= 1, `true peak ${tp} dBFS`);
  const s = pcm(join(f.audio, "mix.wav"));
  const loud = peakDb(s, WORDS[0].start, WORDS[0].start + 0.2);
  const soft = peakDb(s, WORDS[4].start, WORDS[4].start + 0.2);
  assert.ok(loud <= -3 + 0.05, `the loudest hit peaks at ${loud.toFixed(2)} dBFS`);
  assert.ok(Math.abs(loud - soft - 6) < 0.5, `the two hits stay 6 dB apart: ${loud.toFixed(2)} and ${soft.toFixed(2)}`);
});

t("a mix that does not loop is rounded up to whole 30 fps frames as well", () => {
  const f = film({ duration: 2.41, loop: false, hits: [{ sfx: "ding", at: "hook.1", gain: -6 }] });
  tone(join(f.kit, "ding.wav"), 1000, 0.2);
  assert.equal(runMix([f.audio]).status, 0);
  const { seconds } = probe(join(f.audio, "mix.wav"));
  assert.ok(Math.abs(seconds - Math.ceil(2.41 * 30) / 30) < 0.002, `lasts ${seconds}`);
});
