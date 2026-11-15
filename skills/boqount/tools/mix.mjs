#!/usr/bin/env node
// Mix a film's soundtrack: voice-over + sound-effect hits at cue words + a music bed ducked under the voice.
//
//   node <skill>/tools/mix.mjs <audio-dir> [--sfx <dir>] [--library <dir>]
//
// A version-2 cue sheet (`"version": 2` in sfx-cues.json: every new film's) is handed to tools/mix2.mjs, with the
// same folder and flags: the library, levels set against the voice, four buses, -14 LUFS (`film.md` → Sound).
// What follows is the first sheet's mixer, kept so a film made with it mixes as it did.
//
// Reads <audio-dir>/vo.wav, cues.json, sfx-cues.json and the music files it names; writes <audio-dir>/mix.wav
// (48 kHz stereo s16). Its length is cues.json's duration rounded up to a whole number of 30 fps frames
// (at least one second): the same rounding as DURATION in the film's cues.ts, whether the film loops or not.
//
// A voiced mix is normalised to -16 LUFS integrated / -1 dBTP (two-pass loudnorm).
// A voice-free film (no vo.wav, or a silent one) is mixed over generated silence of the film's length and is not
// loudness-normalised: the hits keep the cue sheet's gains relative to each other, and the whole mix is then scaled
// as one, up or down, so its true peak is -3 dBFS.
//
// A hit's sound `<name>` is looked up as <name>.wav, then <name>.mp3, first in <audio-dir>/sfx/ (this film's own
// sounds), then in --sfx (default <audio-dir>/../../sfx, the kit that `film.mjs init` generates beside the films).
// A sound found nowhere is an error naming it: nothing is mixed.
//
// Nothing here goes through a shell: ffmpeg and ffprobe are run with an argument array, and their output is filtered
// in JavaScript. The names and numbers of the two cue files are checked before they reach a command or a filter graph:
// a sound or music file is a bare name (letters, digits, _ and -, with an optional .wav or .mp3), never a path, and every
// time, offset, gain and duration is a finite number. Music files are looked up as <audio-dir>/music/<name>, then
// <audio-dir>/<name>, in the same way as a sound (.wav, then .mp3, unless the name has its extension).
//
// `"loop": true` in sfx-cues.json makes the soundtrack circular, for a film that loops (the locked format):
// everything that sounds past the end (a pop on the last frame, a whoosh, a riser's tail) is
// folded back onto the head instead of cut. Without the fold, the loop would play a sound chopped mid-way, then the
// head (a pop chopped 33 ms in, then 20 ms of silence).
import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const USAGE = "usage: mix.mjs <audio-dir> [--sfx <dir>] [--library <dir>]";
const NAME = /^[A-Za-z0-9_-]+(\.(wav|mp3))?$/;
/** A voice quieter than this, in dBFS true peak, is no voice: a silent vo.wav made as a stand-in. */
const SILENT = -60;
/** A voice-free mix's true peak, dBFS (a hair under -3, for the rounding to 16 bits). */
const PEAK = -3.05;
const args = process.argv.slice(2);
const positional = [];
let sfxFlag;
let libFlag;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--sfx" && args[i + 1] !== undefined && sfxFlag === undefined) sfxFlag = args[++i];
  else if (args[i] === "--library" && args[i + 1] !== undefined && libFlag === undefined) libFlag = args[++i];
  else positional.push(args[i]);
}
if (positional.length !== 1 || positional[0].startsWith("--")) {
  console.error(USAGE);
  process.exit(2);
}
// Absolute paths: a folder whose name starts with "-" is then never read by ffmpeg as an option.
const dir = resolve(positional[0]);
const kitDir = sfxFlag === undefined ? resolve(dir, "../../sfx") : resolve(sfxFlag);
let sheet = null;
try {
  sheet = JSON.parse(readFileSync(join(dir, "sfx-cues.json"), "utf8"));
} catch {
  // main() reports the missing or broken sheet in its own words
}
try {
  if (sheet?.version === 2) {
    const { main: mix2 } = await import("./mix2.mjs");
    console.log(mix2([dir, ...(sfxFlag === undefined ? [] : ["--sfx", sfxFlag]), ...(libFlag === undefined ? [] : ["--library", libFlag])]));
  } else main();
} catch (e) {
  console.error(`mix.mjs: ${e.message}`);
  process.exit(1);
}

/** `value` as a finite number, else an error naming `field`. */
function num(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a finite number, got ${JSON.stringify(value)}`);
  return value;
}
/** `name` if it is a bare file name (never a path, never a quote), else an error naming the value. */
function safeName(name, field) {
  if (typeof name !== "string" || !NAME.test(name)) throw new Error(`${field} must be a bare name such as pop or bed.mp3 (letters, digits, _ and -), got ${JSON.stringify(name)}`);
  return name;
}
/** The first existing file for `name` in `folders`: the name as given when it has an extension, else <name>.wav, then <name>.mp3. */
function lookup(name, folders) {
  const files = /\.(wav|mp3)$/.test(name) ? [name] : [`${name}.wav`, `${name}.mp3`];
  for (const folder of folders) for (const file of files) if (existsSync(join(folder, file))) return join(folder, file);
  return null;
}
/** Runs ffmpeg with an argument array (no shell). Returns its stderr; throws with the tail of it on failure. */
function ffmpeg(argv) {
  const r = spawnSync("ffmpeg", ["-nostdin", ...argv], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.error) throw new Error(`could not run ffmpeg: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.trim().split("\n").slice(-6).join(" | ")}`);
  return r.stderr;
}

/** The true peak in dBFS that ffmpeg's ebur128 measures (-Infinity for silence), of `inputs` through `graph`. */
function truePeak(inputs, graph) {
  const af = graph ? ["-filter_complex", `${graph};[pre]ebur128=peak=true[o]`, "-map", "[o]"] : ["-af", "ebur128=peak=true"];
  const log = ffmpeg(["-hide_banner", "-nostats", ...inputs, ...af, "-f", "null", "-"]);
  const m = /True peak:\s*Peak:\s*(-?inf|-?[\d.]+)\s*dBFS/.exec(log.slice(log.lastIndexOf("Summary:")));
  if (!m) throw new Error("ffmpeg printed no true peak");
  return m[1].endsWith("inf") ? -Infinity : Number(m[1]);
}

function main() {
  const cues = JSON.parse(readFileSync(join(dir, "cues.json"), "utf8"));
  const plan = JSON.parse(readFileSync(join(dir, "sfx-cues.json"), "utf8"));
  const loop = plan.loop === true;
  const dur = Math.max(30, Math.ceil(num(cues.duration, "cues.json duration") * 30)) / 30;
  const TAIL = 4; // seconds rendered past the end and folded onto the head when looping
  const byId = Object.fromEntries(cues.lines.map((l) => [l.id, l]));
  if (!Array.isArray(plan.hits)) throw new Error("sfx-cues.json: hits must be a list");

  /** A time: seconds, 'end', or a cue 'line.word' (the word's start). */
  function at(spec, field) {
    if (typeof spec === "number") return num(spec, field);
    if (spec === "end") return dur;
    if (typeof spec !== "string") throw new Error(`${field} must be seconds, "end" or "line.word", got ${JSON.stringify(spec)}`);
    const [id, k] = spec.split(".");
    const w = byId[id]?.words[Number(k)];
    if (!w) throw new Error(`no cue ${spec} (${field})`);
    return num(w.start, `cue ${spec} start`);
  }
  /** An optional number: `fallback` when absent, else checked. */
  const opt = (value, fallback, field) => (value === undefined ? fallback : num(value, field));

  // No vo.wav: the voice is generated silence of the film's length, so the graph below is the same either way.
  const vo = join(dir, "vo.wav");
  const hasVo = existsSync(vo);
  const inputs = hasVo ? ["-i", vo] : ["-f", "lavfi", "-t", String(dur), "-i", "anullsrc=r=48000:cl=stereo"];
  const voiced = hasVo && truePeak(["-i", vo]) > SILENT;
  const f = [];
  f.push(`[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[vo][vokey]`);
  let n = 1;
  const layers = ["[vo]"];

  // Music: placed segments (file, at, from, to, fades, optional per-segment gain), summed into one bed,
  // then ducked under the voice with the VO as sidechain key. A segment whose file is not there is left out.
  const musicSegments = plan.music?.segments ?? [];
  const segs = [];
  musicSegments.forEach((s, i) => {
    const file = lookup(safeName(s.file, `music.segments[${i}].file`), [join(dir, "music"), dir]);
    if (file) segs.push({ s, i, file });
  });
  if (segs.length) {
    const labels = [];
    for (const { s, i, file } of segs) {
      const p = `music.segments[${i}]`;
      inputs.push("-i", file);
      // `at` may be seconds or a cue ('line.word' / 'end') plus `offset`; `until` (a cue or 'end'), when given,
      // sets the segment's length from the cues instead of `to`, so a re-timed film re-places its music.
      const from = num(s.from, `${p}.from`);
      const start = Math.max(0, at(s.at, `${p}.at`) + opt(s.offset, 0, `${p}.offset`));
      const to = s.until !== undefined ? from + (at(s.until, `${p}.until`) - start) : num(s.to, `${p}.to`);
      const len = to - from;
      const ms = Math.round(start * 1000);
      const gain = s.gain !== undefined ? num(s.gain, `${p}.gain`) : num(plan.music.gain, "music.gain");
      const fadeIn = opt(s.fadeIn, 0.02, `${p}.fadeIn`);
      const fadeOut = opt(s.fadeOut, 0.02, `${p}.fadeOut`);
      f.push(
        `[${n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=${from}:${to},asetpts=PTS-STARTPTS,` +
          `volume=${gain}dB,afade=t=in:d=${fadeIn},afade=t=out:st=${(len - fadeOut).toFixed(3)}:d=${fadeOut},` +
          `adelay=${ms}|${ms}[m${n}]`,
      );
      labels.push(`[m${n}]`);
      n++;
    }
    f.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=longest,apad,atrim=0:${loop ? dur + TAIL : dur}[mus]`);
    const ratio = Math.min(20, Math.pow(10, num(plan.music.duckDb, "music.duckDb") / 20) * 2).toFixed(2);
    f.push(`[mus][vokey]sidechaincompress=threshold=0.02:ratio=${ratio}:attack=20:release=${opt(plan.music.release, 700, "music.release")}:makeup=1[bed]`);
    layers.push("[bed]");
  } else {
    f.push(`[vokey]anullsink`);
    console.warn("no music segments found: no music in this mix");
  }

  // Look every sound up before mixing anything: one error names them all.
  const names = plan.hits.map((h, i) => safeName(h.sfx, `hits[${i}].sfx`));
  const files = new Map(names.map((name) => [name, lookup(name, [join(dir, "sfx"), kitDir])]));
  const unknown = [...files].filter(([, file]) => !file).map(([name]) => name);
  if (unknown.length) throw new Error(`sound not found: ${unknown.join(", ")} (looked for <name>.wav and <name>.mp3 in ${join(dir, "sfx")} and in ${kitDir})`);

  plan.hits.forEach((h, i) => {
    const p = `hits[${i}]`;
    const t = Math.max(0, at(h.at, `${p}.at`) + opt(h.offset, 0, `${p}.offset`));
    const ms = Math.round(t * 1000);
    inputs.push("-i", files.get(h.sfx));
    // `from` skips the file's first seconds (a thunder whose crack comes 0.6 s in); `until` (a cue, seconds or 'end')
    // ends the hit there, cut dead with a 12 ms fade unless `fade` asks for a longer one: a film that freezes stops
    // every sound on the frame it freezes, and a long boom can be faded out from under the words that follow it.
    const trim = [];
    const from = opt(h.from, 0, `${p}.from`);
    if (from) trim.push(`atrim=start=${from}`, "asetpts=PTS-STARTPTS");
    if (h.until !== undefined) {
      const len = Math.max(0.013, at(h.until, `${p}.until`) - t);
      const fd = Math.min(len, opt(h.fade, 0.012, `${p}.fade`));
      trim.push(`atrim=0:${len.toFixed(4)}`, `afade=t=out:st=${(len - fd).toFixed(4)}:d=${fd.toFixed(4)}`);
    }
    f.push(`[${n}:a]aresample=48000,aformat=channel_layouts=stereo,${trim.map((x) => `${x},`).join("")}volume=${opt(h.gain, -12, `${p}.gain`)}dB,adelay=${ms}|${ms}[h${n}]`);
    layers.push(`[h${n}]`);
    n++;
  });

  let ins = inputs;
  let fg = f;
  const long = join(dir, ".mix-long.wav");
  if (loop) {
    // The fold, in two steps. Folding inside one graph (asplit of the padded mix into a head and a tail, then mixing the
    // two back together) stalls ffmpeg at 100 % CPU, intermittently: the tail's first sample exists only after the whole
    // head has passed, so the graph depends on itself (stalls of ten minutes and more, with and without -nostdin, on a
    // cue sheet that otherwise finishes in seconds). So render the long stem, mix plus TAIL, to a file
    // first, then fold it from two independent reads of that file.
    ffmpeg(["-v", "error", "-y", ...inputs, "-filter_complex", [...f, `${layers.join("")}amix=inputs=${layers.length}:normalize=0:duration=longest,apad,atrim=0:${dur + TAIL}[long]`].join(";"), "-map", "[long]", "-c:a", "pcm_f32le", long]);
    ins = ["-i", long, "-i", long];
    fg = [`[0:a]atrim=0:${dur},asetpts=PTS-STARTPTS[head]`, `[1:a]atrim=${dur}:${dur + TAIL},asetpts=PTS-STARTPTS[tail]`, `[head][tail]amix=inputs=2:normalize=0:duration=first[pre]`];
  } else {
    f.push(`${layers.join("")}amix=inputs=${layers.length}:normalize=0:duration=longest,apad,atrim=0:${dur}[pre]`);
  }

  const graph = (tail) => [...fg, tail].join(";");
  try {
    if (!voiced) {
      // Voice-free: the cue sheet's gains relative to each other, the whole scaled as one to the target true peak.
      const peak = truePeak(ins, fg.join(";"));
      const gain = Number.isFinite(peak) ? PEAK - peak : 0;
      ffmpeg(["-v", "error", "-y", ...ins, "-filter_complex", graph(`[pre]volume=${gain.toFixed(3)}dB,aresample=48000[o]`), "-map", "[o]", "-c:a", "pcm_s16le", join(dir, "mix.wav")]);
      const after = truePeak(["-i", join(dir, "mix.wav")]);
      console.log(
        `mix.wav: ${layers.length - 1} layers, no voice (${hasVo ? "vo.wav is silent" : "no vo.wav"}): the cue sheet's relative gains, ` +
          `scaled ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB as a whole; true peak ${Number.isFinite(after) ? after.toFixed(1) : "-inf"} dBFS`,
      );
      return;
    }
    // Pass 1: measure (loudnorm prints its JSON on stderr). -nostdin keeps every ffmpeg here from reading the
    // terminal; it does not cure the stall above, which was the one-graph fold.
    const log = ffmpeg(["-hide_banner", "-nostats", ...ins, "-filter_complex", graph(`[pre]loudnorm=I=-16:TP=-1.0:LRA=9:print_format=json[o]`), "-map", "[o]", "-f", "null", "-"]);
    const j = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
    // The measured values go into the next filter graph: each must be a finite number (a silent mix measures -inf).
    for (const key of ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"]) {
      if (!Number.isFinite(Number(j[key]))) throw new Error(`the mix could not be measured (${key} is ${JSON.stringify(j[key])}): is it silent?`);
    }
    // Pass 2: apply with the measured values (linear normalisation).
    const ln = `loudnorm=I=-16:TP=-1.0:LRA=9:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    ffmpeg(["-v", "error", "-y", ...ins, "-filter_complex", graph(`[pre]${ln},aresample=48000[o]`), "-map", "[o]", "-c:a", "pcm_s16le", join(dir, "mix.wav")]);
    const stats = ffmpeg(["-hide_banner", "-nostats", "-i", join(dir, "mix.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"]);
    const check = stats.split("\n").filter((line) => /I:|Peak:/.test(line)).slice(-2).join("\n");
    console.log(`mix.wav: ${layers.length - 1} layers over VO; measured before ${j.input_i} LUFS\n${check.trim()}`);
  } finally {
    rmSync(long, { force: true });
  }
}
