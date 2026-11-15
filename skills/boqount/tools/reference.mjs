#!/usr/bin/env node
// Studies a reference video, every word and every frame, before a film borrows its skeleton (reference.md).
//
//   node <skill>/tools/reference.mjs study <file-or-link> [--out <dir>] [--model <ggml-….bin>] [--no-words]
//   node <skill>/tools/reference.mjs sheet <file> [--every <s>] [--out <dir>]
//
// study writes into --out (default: ./reference-<name>):
//   ref.mp4 + ref.info.json   only for a link: the download (yt-dlp, when installed), with the uploader, date and caption
//   sheet-NN.jpg              2 frames a second, 6 × 4 to a sheet; sheets.md says which second each cell is
//   still-0000.jpg, still-<cut>.jpg, first-last.jpg
//                             full-size frames: the first, one just after every cut, and the last beside the first
//                             (how it loops)
//   spectrum.png              the sound's spectrum: dark bands between the lines mean a voice with no bed under it
//   words.json                every word with its time (whisper-cli, when installed and a model is found)
//   study.json                the numbers: length, size, frame rate, cuts and their times, loudness, words a second
//   beats.md                  the beat map's skeleton: one row per sentence with its time, words and nearest still;
//                             the agent fills Picture and Device, and shows it to the person beside the script
// sheet writes sheet-NN.jpg at one frame every --every seconds (default 3), 6 × 5 to a sheet, for the creator's other
// videos when the look is the point.
//
// A link is downloaded only when it is the person's own find for this film, and only to study it: nothing from it is
// posted, re-cut or redrawn (reference.md → What it may take). Needs ffmpeg; yt-dlp and whisper-cli are optional and
// each missing one is named in study.json's `missing`.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { whisperModel } from "./vo-check.mjs";

const USAGE = "usage: reference.mjs study <file-or-link> [--out <dir>] [--model <file>] [--no-words] | sheet <file> [--every <s>] [--out <dir>]";
/** scdet's threshold: a real cut scores far above it, carried motion stays under it. */
export const CUT_THRESHOLD = 8;

const has = (bin, arg = "-version") => !spawnSync(bin, [arg]).error;
const ff = (args) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
/** ffmpeg's stderr for a filter that reports there (ebur128). */
const ffErr = (args) => spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 28 }).stderr ?? "";

/** Length, size and frame rate of a video file. */
export function probe(file) {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], { encoding: "utf8" }));
  const v = j.streams.find((s) => s.codec_type === "video");
  if (!v) throw new Error(`${file} has no video stream`);
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate).split("/").map(Number);
  return { duration: Number(j.format.duration), width: v.width, height: v.height, fps: d ? Math.round((n / d) * 1000) / 1000 : n, audio: j.streams.some((s) => s.codec_type === "audio") };
}

/** The cut times in `metadata=print` output of scdet (`lavfi.scd.time=<s>` lines). */
export function parseCuts(text) {
  return [...String(text).matchAll(/lavfi\.scd\.time=([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * 1000) / 1000);
}

/** Integrated loudness, range and true peak from ebur128's summary on stderr. */
export function parseEbur(text) {
  const s = String(text);
  const at = s.lastIndexOf("Summary:");
  const tail = at >= 0 ? s.slice(at) : s;
  const num = (re) => {
    const m = re.exec(tail);
    return m ? Number(m[1]) : null;
  };
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), LRA: num(/LRA:\s+(-?[\d.]+) LU/), TP: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

/** Words with times (s) from whisper.cpp's JSON (-ml 1 -sow -oj): one segment per word. */
export function whisperWords(json) {
  const out = [];
  let aside = null; // inside whisper's own note on the sound, "(upbeat music)" or "[MUSIC]": not a word anyone said
  for (const s of json.transcription ?? []) {
    const word = String(s.text ?? "").trim();
    if (!word) continue;
    if (aside === null && /^[([]/.test(word)) aside = word[0] === "(" ? ")" : "]";
    if (aside !== null) {
      if (word.endsWith(aside)) aside = null;
      continue;
    }
    out.push({ word, start: s.offsets.from / 1000, end: s.offsets.to / 1000 });
  }
  return out;
}

/** Words grouped into sentences, each with its start, end and text: a word ending in . ? or ! closes one. */
export function sentences(words) {
  const out = [];
  let cur = [];
  const close = () => {
    if (!cur.length) return;
    out.push({ start: cur[0].start, end: cur.at(-1).end, text: cur.map((w) => w.word).join(" ").replace(/\s+([,.?!])/g, "$1") });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    if (/[.?!]["')\]]*$/.test(w.word)) close();
  }
  close();
  return out;
}

/** Which second each cell of each sheet shows: sheet i, cell j → (i * perSheet + j) * every. */
export function sheetTimes(duration, every, perSheet) {
  const n = Math.max(1, Math.floor(duration / every + 1e-9) + (duration % every > 1e-6 ? 1 : 0));
  const sheets = [];
  for (let i = 0; i * perSheet < n; i++) sheets.push(Array.from({ length: Math.min(perSheet, n - i * perSheet) }, (_, j) => Math.round((i * perSheet + j) * every * 100) / 100));
  return sheets;
}

/** The still nearest a time, of the stills taken (their times). */
const nearest = (stills, t) => stills.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), stills[0]);
const stillName = (t) => `still-${String(Math.round(t * 1000)).padStart(6, "0")}.jpg`;
const fmt = (t) => `${t.toFixed(2)} s`;

/** The beat map's skeleton, as markdown. */
export function beatsTable({ name, info, cuts, loud, wps, sents, stills }) {
  const head = [
    `# Beat map: ${name}`,
    "",
    `${fmt(info.duration)}, ${info.width}×${info.height}, ${info.fps} fps; ${cuts.length} cut${cuts.length === 1 ? "" : "s"}${cuts.length ? ` (${cuts.map(fmt).join(", ")})` : ""}; ` +
      `${loud.I ?? "?"} LUFS integrated, true peak ${loud.TP ?? "?"} dBFS${wps ? `; ${wps} words a second` : ""}.`,
    "",
    "Device: question hook, reveal, \"including this one\", parts, proof number, payoff, loop, meme, or what it is.",
    "",
    "| # | Time | Words | Picture | Device |",
    "|---|---|---|---|---|",
  ];
  const rows = sents.length
    ? sents.map((s, i) => `| ${i + 1} | ${fmt(s.start)}–${fmt(s.end)} | ${s.text.replace(/\|/g, "\\|")} | ${stillName(nearest(stills, s.start))}: <what it shows> | <device> |`)
    : [`| 1 | 0.00 s–${fmt(info.duration)} | <no words read: fill from the sheets> | ${stillName(0)}: <what it shows> | <device> |`];
  return [...head, ...rows, ""].join("\n");
}

function args(rest, flags) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (flags.bool.includes(a)) opt[a.slice(2)] = true;
    else if (flags.val.includes(a)) {
      if (rest[i + 1] === undefined) throw new Error(`${a} needs a value`);
      opt[a.slice(2)] = rest[++i];
    } else if (a.startsWith("--")) throw new Error(`unknown flag ${a}\n${USAGE}`);
    else pos.push(a);
  }
  return { pos, opt };
}

/** Frame sheets of `file` at one frame every `every` s, cols × rows to a sheet, cells `w` px wide. */
function sheets(file, out, every, cols, rows, w = 180) {
  ff(["-v", "error", "-i", file, "-vf", `fps=1/${every},scale=${w}:-2,tile=${cols}x${rows}:padding=4:margin=4`, "-q:v", "3", join(out, "sheet-%02d.jpg")]);
  return readdirSync(out).filter((f) => /^sheet-\d+\.jpg$/.test(f)).sort();
}

function study(input, opt) {
  if (!has("ffmpeg")) throw new Error("ffmpeg is not installed: run node <skill>/tools/doctor.mjs");
  const isLink = /^https?:\/\//.test(input);
  const name = isLink ? "ref" : basename(input, extname(input));
  const out = resolve(opt.out ?? `reference-${name}`);
  mkdirSync(out, { recursive: true });
  const missing = [];
  let file = resolve(input);
  if (isLink) {
    if (!has("yt-dlp", "--version")) throw new Error("yt-dlp is not installed: ask the person for the file itself, or install yt-dlp");
    execFileSync("yt-dlp", ["-f", "bv*[vcodec^=avc1]+ba/bv*+ba/b", "--merge-output-format", "mp4", "--write-info-json", "-o", join(out, "ref.%(ext)s"), input], { stdio: "inherit" });
    file = join(out, "ref.mp4");
    if (!existsSync(file)) throw new Error("yt-dlp wrote no ref.mp4 (an image post has no video: screenshot it instead, reference.md)");
  } else if (!existsSync(file)) throw new Error(`no such file: ${input}`);

  const info = probe(file);
  // cuts
  const cutsFile = join(out, "cuts.txt");
  ff(["-v", "error", "-i", file, "-an", "-vf", `scdet=threshold=${CUT_THRESHOLD},metadata=print:key=lavfi.scd.time:file=${cutsFile.replace(/[\\:']/g, "\\$&")}`, "-f", "null", "-"]);
  const cuts = existsSync(cutsFile) ? parseCuts(readFileSync(cutsFile, "utf8")) : [];
  // sheets: 2 fps, 6 × 4
  const sheetFiles = sheets(file, out, 0.5, 6, 4);
  const times = sheetTimes(info.duration, 0.5, 24);
  writeFileSync(join(out, "sheets.md"), ["# Sheets: 2 frames a second, 6 across, 4 down, read left to right", "", ...sheetFiles.map((f, i) => `- ${f}: ${fmt(times[i]?.[0] ?? 0)} to ${fmt(times[i]?.at(-1) ?? 0)}`), ""].join("\n"));
  // stills: the first, one just after every cut, the last beside the first
  const last = Math.max(0, info.duration - 1 / (info.fps || 30));
  const stillTimes = [0, ...cuts.map((c) => Math.min(last, c + 0.05))];
  for (const t of stillTimes) ff(["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-q:v", "2", join(out, stillName(t))]);
  ff(["-v", "error", "-i", file, "-ss", String(last), "-i", file, "-filter_complex", "[0:v]trim=end_frame=1,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=1,setpts=PTS-STARTPTS[b];[b][a]hstack", "-frames:v", "1", "-q:v", "2", join(out, "first-last.jpg")]);
  // sound
  let loud = { I: null, LRA: null, TP: null };
  if (info.audio) {
    loud = parseEbur(ffErr(["-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]));
    ff(["-v", "error", "-i", file, "-vn", "-lavfi", "showspectrumpic=s=1024x512:legend=1", join(out, "spectrum.png")]);
  } else missing.push("sound: the file has none");
  // words
  let words = [];
  if (opt["no-words"]) missing.push("words: --no-words");
  else if (!info.audio) missing.push("words: no sound");
  else if (!has("whisper-cli", "--help")) missing.push("words: whisper-cli is not installed (read the words off the sheets, or install whisper.cpp)");
  else {
    const model = whisperModel(opt.model);
    if (!model || !existsSync(model)) missing.push("words: no whisper.cpp model (pass --model or set WHISPER_MODEL)");
    else {
      ff(["-v", "error", "-i", file, "-vn", "-ar", "16000", "-ac", "1", join(out, "words.wav")]);
      execFileSync("whisper-cli", ["-m", model, "-l", "auto", "-f", join(out, "words.wav"), "-ml", "1", "-sow", "-oj", "-of", join(out, "whisper")], { stdio: "ignore" });
      words = whisperWords(JSON.parse(readFileSync(join(out, "whisper.json"), "utf8")));
      rmSync(join(out, "words.wav"));
      writeFileSync(join(out, "words.json"), JSON.stringify(words, null, 1) + "\n");
    }
  }
  const sents = sentences(words);
  const spoken = words.length ? words.at(-1).end - words[0].start : 0;
  const wps = spoken > 0 ? Math.round((words.length / spoken) * 100) / 100 : null;
  const result = { file, ...info, cuts: cuts.length, cutTimes: cuts, loudness: loud, words: words.length, wordsPerSecond: wps, sentences: sents.length, sheets: sheetFiles, stills: stillTimes.map(stillName), missing };
  writeFileSync(join(out, "study.json"), JSON.stringify(result, null, 2) + "\n");
  writeFileSync(join(out, "beats.md"), beatsTable({ name: isLink ? input : basename(input), info, cuts, loud, wps, sents, stills: stillTimes }));
  return { out, ...result };
}

function sheet(input, opt) {
  if (!has("ffmpeg")) throw new Error("ffmpeg is not installed");
  const file = resolve(input);
  if (!existsSync(file)) throw new Error(`no such file: ${input}`);
  const every = Number(opt.every ?? 3);
  if (!(every > 0)) throw new Error("--every takes a number of seconds above 0");
  const out = resolve(opt.out ?? `sheets-${basename(input, extname(input))}`);
  mkdirSync(out, { recursive: true });
  const files = sheets(file, out, every, 6, 5);
  return { out, every, sheets: files };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const [cmd, ...rest] = process.argv.slice(2);
    let r;
    if (cmd === "study") {
      const { pos, opt } = args(rest, { bool: ["--no-words"], val: ["--out", "--model"] });
      if (pos.length !== 1) throw new Error(USAGE);
      r = study(pos[0], opt);
    } else if (cmd === "sheet") {
      const { pos, opt } = args(rest, { bool: [], val: ["--every", "--out"] });
      if (pos.length !== 1) throw new Error(USAGE);
      r = sheet(pos[0], opt);
    } else throw new Error(USAGE);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
