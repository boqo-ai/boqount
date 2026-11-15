#!/usr/bin/env node
// Measures the platform's copy of a posted film against the file that was uploaded (measure.md → The platform's copy).
// A platform re-encodes every upload; what it does to the film is only visible in its copy, never in ours.
//
//   node <skill>/tools/platform-copy.mjs <copy-file-or-link> --ours films/<slug>/out/<slug>-feed.mp4 [--mix films/<slug>/audio/mix.wav] [--out <dir>]
//
// Three checks, each a line with pass or fail, then a JSON summary; exit 1 when one fails:
//   length   the copy's frame count over its frame rate equals our length, within half of one of its frames
//            (a length between two of its frames gets padded)
//   start    the copy's first frames are our frames at the same times: its frame 0 is our frame 0 and its frame 1 is
//            the one we show 1/its-rate s later (a dropped MP4 edit list doubles frame 0 and runs the picture late)
//   sound    the copy's sound lines up with ours (`--mix`, else the sound of `--ours`) at offset 0, within 5 ms
//            (cross-correlation of the first 8 s at 4 kHz)
// A link (the account's own post) is downloaded with yt-dlp, when installed, into --out (default: a temporary folder),
// in its H.264 format. Needs ffmpeg.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: platform-copy.mjs <copy-file-or-link> --ours <feed.mp4> [--mix <mix.wav>] [--out <dir>]";
const W = 72; // the frames are compared small and grey: enough to tell neighbours apart, cheap to read
const H = 128;
const RATE = 4000; // the sound is compared at 4 kHz, mono
const SPAN = 8; // over its first 8 s
export const MAX_LAG_MS = 5;
const START_FRAMES = 4; // the copy's frames 0 to 3 are checked

/** Frame count and rate of a file's video, and whether it has sound. */
export function videoInfo(file) {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_packets", "-print_format", "json", "-show_streams", file], { encoding: "utf8" }));
  const v = j.streams.find((s) => s.codec_type === "video");
  if (!v) throw new Error(`${file} has no video stream`);
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate).split("/").map(Number);
  return { frames: Number(v.nb_read_packets), fps: d ? n / d : n, audio: j.streams.some((s) => s.codec_type === "audio") };
}

/** The first `n` frames of a file, small and grey, each a Uint8Array of W × H. */
function frames(file, n) {
  const buf = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-frames:v", String(n), "-vf", `scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  const out = [];
  for (let i = 0; i + W * H <= buf.length; i += W * H) out.push(new Uint8Array(buf.buffer, buf.byteOffset + i, W * H));
  return out;
}

/** Mean absolute difference of two frames (0 to 255). */
export function mad(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/**
 * The start check: for each of the copy's frames k, the index of our frame that matches it best, against the one
 * expected (k × ours / theirs). A frame passes when the expected one is as good as the best, within `tol` (a still
 * start, where every frame matches, passes and says so).
 */
export function startCheck(copy, ours, copyFps, ourFps, tol = 0.5) {
  return copy.map((c, k) => {
    const expected = Math.round((k * ourFps) / copyFps);
    const d = ours.map((o) => mad(c, o));
    const best = d.indexOf(Math.min(...d));
    const still = Math.max(...d) - Math.min(...d) < tol;
    return { frame: k, expected, best, ok: d[expected] !== undefined && d[expected] <= d[best] + tol, still };
  });
}

/** The first SPAN s of a file's sound, mono at RATE, as Float32Array. */
function sound(file) {
  const buf = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-vn", "-t", String(SPAN), "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"], { maxBuffer: 1 << 26 });
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
}

/** The lag (in samples, + when `b` is late) at which `b` best matches `a`, searched within ±maxLag, and its score. */
export function bestLag(a, b, maxLag) {
  let best = { lag: 0, score: -Infinity };
  const n = Math.min(a.length, b.length);
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let s = 0;
    let ea = 0;
    let eb = 0;
    for (let i = Math.max(0, -lag); i < n && i + lag < n; i++) {
      const x = a[i];
      const y = b[i + lag];
      s += x * y;
      ea += x * x;
      eb += y * y;
    }
    const score = ea && eb ? s / Math.sqrt(ea * eb) : 0;
    if (score > best.score) best = { lag, score };
  }
  return best;
}

function parse(argv) {
  const opt = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (["--ours", "--mix", "--out"].includes(a)) {
      if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`);
      opt[a.slice(2)] = argv[++i];
    } else if (a.startsWith("--")) throw new Error(`unknown flag ${a}\n${USAGE}`);
    else pos.push(a);
  }
  if (pos.length !== 1 || !opt.ours) throw new Error(USAGE);
  return { input: pos[0], ...opt };
}

export function check({ input, ours, mix, out }) {
  if (spawnSync("ffmpeg", ["-version"]).error) throw new Error("ffmpeg is not installed: run node <skill>/tools/doctor.mjs");
  let copy = resolve(input);
  if (/^https?:\/\//.test(input)) {
    if (spawnSync("yt-dlp", ["--version"]).error) throw new Error("yt-dlp is not installed: ask the person to save the post's video, or install yt-dlp");
    const dir = resolve(out ?? mkdtempSync(join(tmpdir(), "platform-copy-")));
    execFileSync("yt-dlp", ["-f", "bv*[vcodec^=avc1]+ba/b[vcodec^=avc1]/b", "--merge-output-format", "mp4", "-o", join(dir, "copy.%(ext)s"), input], { stdio: "inherit" });
    copy = join(dir, "copy.mp4");
  }
  for (const f of [copy, resolve(ours), ...(mix ? [resolve(mix)] : [])]) if (!existsSync(f)) throw new Error(`no such file: ${f}`);
  const c = videoInfo(copy);
  const o = videoInfo(resolve(ours));
  const lines = [];
  // length
  const copyLen = c.frames / c.fps;
  const ourLen = o.frames / o.fps;
  const lengthOk = Math.abs(copyLen - ourLen) <= 0.5 / c.fps + 1e-9;
  lines.push({ check: "length", ok: lengthOk, says: `the copy is ${c.frames} frames at ${+c.fps.toFixed(3)} fps = ${copyLen.toFixed(3)} s; ours ${o.frames} at ${+o.fps.toFixed(3)} = ${ourLen.toFixed(3)} s` });
  // start
  const need = Math.ceil(((START_FRAMES - 1) * o.fps) / c.fps) + 4;
  const st = startCheck(frames(copy, START_FRAMES), frames(resolve(ours), need), c.fps, o.fps);
  const startOk = st.every((s) => s.ok);
  const still = st.every((s) => s.still);
  lines.push({
    check: "start",
    ok: startOk,
    says: still
      ? "the first frames do not move: the start cannot be told apart (passes; look at the copy's first second at full speed)"
      : st.map((s) => `copy ${s.frame} = our ${s.best}${s.ok ? "" : ` (expected ${s.expected})`}`).join("; "),
  });
  // sound
  let soundLine;
  if (!c.audio) soundLine = { check: "sound", ok: false, says: "the copy has no sound" };
  else {
    const ref = mix ? resolve(mix) : resolve(ours);
    const r = bestLag(sound(ref), sound(copy), Math.round(RATE * 0.3));
    const ms = (r.lag / RATE) * 1000;
    soundLine = { check: "sound", ok: Math.abs(ms) <= MAX_LAG_MS && r.score > 0.5, says: `the copy's sound is ${ms >= 0 ? "late" : "early"} by ${Math.abs(ms).toFixed(1)} ms (match ${r.score.toFixed(2)}; at most ${MAX_LAG_MS} ms)` };
  }
  lines.push(soundLine);
  return { copy, ours: resolve(ours), ok: lines.every((l) => l.ok), checks: lines, start: st.map(({ frame, expected, best, ok }) => ({ frame, expected, best, ok })) };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const r = check(parse(process.argv.slice(2)));
    for (const l of r.checks) console.log(`${l.ok ? "pass" : "FAIL"}  ${l.check}: ${l.says}`);
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
