#!/usr/bin/env node
// Assemble a film's voice-over from per-line takes (eleven.mjs tts-lines)
// and its plan's gaps and splits, into one WAV and one cue sheet.
//
//   node <skill>/tools/vo-assemble.mjs <vo-plan.json> <lines-dir> <out-dir>
//
// Writes <out-dir>/vo.wav (48 kHz mono s16) and <out-dir>/cues.json:
//   { duration, lines: [{ id, text, start, end, words: [{ word, start, end }] }] }   (seconds)
// Every scene in every renderer cues from cues.json, so a re-voiced line
// re-times the film without touching animation code.
//
// Sample-exact by construction: each segment is decoded to PCM and the
// timeline advances by its real sample count, not by the requested trim.
// Computing positions from the requested trims instead drifts (0.2 s over
// sixteen lines once atempo is applied).
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// ffmpeg and ffprobe are run with an argument array, never through a shell. The plan's values are checked before they
// reach a command or a file name: a line id is a bare name (letters, digits, _ and -), and the numbers are finite.
const [planArg, linesArg, outArg] = process.argv.slice(2);
if (!outArg) {
  console.error("usage: vo-assemble.mjs <vo-plan.json> <lines-dir> <out-dir>");
  process.exit(2);
}
// Absolute paths: a folder whose name starts with "-" is then never read by ffmpeg as an option.
const [planPath, linesDir, outDir] = [planArg, linesArg, outArg].map((p) => resolve(p));
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const finite = (v, field) => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${field} must be a finite number, got ${JSON.stringify(v)}`);
  return v;
};
for (const [i, line] of plan.lines.entries()) {
  if (typeof line.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(line.id)) throw new Error(`lines[${i}].id must be a bare name (letters, digits, _ and -), got ${JSON.stringify(line.id)}`);
  finite(line.gap, `lines[${i}].gap`);
  for (const [k, split] of (line.splits ?? []).entries()) finite(split.add, `lines[${i}].splits[${k}].add`);
}
if (plan.lead !== undefined) finite(plan.lead, "lead");
if (plan.tempo !== undefined && !(finite(plan.tempo, "tempo") > 0)) throw new Error(`tempo must be above 0, got ${plan.tempo}`);

const RATE = 48000;
const TEMPO = plan.tempo ?? 1; // pitch-preserving speed-up applied to every segment (ffmpeg atempo)
const HEAD = 0.04; // kept before a segment's first word
const TAIL = 0.16; // kept after its last word: the release of the final consonant

function decode(file, a, b) {
  const af = [`atrim=${a.toFixed(4)}:${b.toFixed(4)}`, "asetpts=PTS-STARTPTS", ...(TEMPO !== 1 ? [`atempo=${TEMPO}`] : [])];
  return execFileSync("ffmpeg", ["-v", "error", "-i", file, "-af", af.join(","), "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], {
    maxBuffer: 1 << 28,
  });
}
const silence = (sec) => Buffer.alloc(Math.round(sec * RATE) * 2);
// The whole line at the source rate, for finding real pauses and onsets.
// The word alignment the text-to-speech service returns puts a word's end/start
// about 50-100 ms LATE inside a line (the audio at the midpoint of a cut reads
// -18 to -29 dB: the next word has already begun), and pins every line's first word
// at 0 s even when the sound starts up to 120 ms later. Cuts and cue onsets
// therefore come from the waveform.
function envelope(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
  const x = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
  const hop = RATE / 200; // 5 ms
  const db = [];
  for (let i = 0; i + hop <= x.length; i += hop) {
    let e = 0;
    for (let j = i; j < i + hop; j++) e += (x[j] / 32768) ** 2;
    db.push(10 * Math.log10(e / hop + 1e-12));
  }
  return db; // index k covers [k*5 ms, (k+1)*5 ms)
}
// Centre of the quietest 20 ms in [t0, t1] (seconds).
function quietest(db, t0, t1) {
  let best = Infinity, at = (t0 + t1) / 2;
  for (let k = Math.max(0, Math.round(t0 * 200)); k + 4 <= Math.min(db.length, Math.round(t1 * 200)); k++) {
    const m = (db[k] + db[k + 1] + db[k + 2] + db[k + 3]) / 4;
    if (m < best) (best = m), (at = (k + 2) / 200);
  }
  return at;
}
// First sound at or after t (seconds), within `within`; null if none.
function onset(db, t, within = 0.4) {
  for (let k = Math.round(t * 200); k < Math.min(db.length, Math.round((t + within) * 200)); k++) if (db[k] > -40) return k / 200;
  return null;
}
const lenFile = (f) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

// Make a segment's edges inaudible without moving a sample. Each take carries
// 0.3-0.4 s of low-level tail after its speech (the alignment's last word "ends" at
// the file's end), often a -60 dB room floor that steps to digital zero at every cut,
// and sometimes a short noise burst (-38 to -48 dB in the last 20 ms); heard as "a
// break in the voice at the end of sentences". The length is kept, so the pacing is
// too: find the last speech (a run of >= 40 ms above -48 dBFS, which skips short
// bursts), let it decay for RELEASE, cosine-fade to zero over FADE_OUT, and zero the
// rest. A version that trimmed the tail shortened one film by 6.8 s.
const RELEASE = 0.06;
const FADE_IN = 0.02;
const FADE_OUT = 0.14;
function cleanEdges(pcm) {
  const s = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length));
  const bin = RATE / 100; // 10 ms
  const loud = [];
  for (let i = 0; i + bin <= s.length; i += bin) {
    let e = 0;
    for (let j = i; j < i + bin; j++) e += (s[j] / 32768) ** 2;
    loud.push(10 * Math.log10(e / bin + 1e-12) > -48);
  }
  let last = loud.length - 1;
  while (last >= 3 && !(loud[last] && loud[last - 1] && loud[last - 2] && loud[last - 3])) last--;
  // Never end on a hard edge: at least a 15 ms fade even when speech decays right up to the cut.
  const f0 = Math.min(s.length - Math.round(0.015 * RATE), Math.round(((last + 1) / 100 + RELEASE) * RATE));
  const fo = Math.round(FADE_OUT * RATE);
  for (let i = f0; i < s.length; i++) {
    const k = i - f0;
    s[i] = k < fo ? Math.round(s[i] * 0.5 * (1 + Math.cos((Math.PI * k) / fo))) : 0;
  }
  const fi = Math.min(s.length, Math.round(FADE_IN * RATE));
  for (let i = 0; i < fi; i++) s[i] = Math.round(s[i] * 0.5 * (1 - Math.cos((Math.PI * i) / fi)));
  return { pcm: Buffer.from(s.buffer), speechEnd: f0 / RATE };
}

const chunks = [];
let samples = 0;
const push = (buf) => (chunks.push(buf), (samples += buf.length / 2));
const now = () => samples / RATE;

push(silence(plan.lead ?? 0.5));
const cues = [];
const faded = [];
const shifts = [];
plan.lines.forEach((line, i) => {
  const file = `${linesDir}/${line.id}.mp3`;
  const words = JSON.parse(readFileSync(`${linesDir}/${line.id}.words.json`, "utf8"));
  const db = envelope(file);

  // Cut points: after each split word, halfway into the gap that follows it.
  const cuts = (line.splits ?? []).map((s) => {
    const k = words.findIndex((w) => w.word === s.after);
    if (k < 0 || k === words.length - 1) throw new Error(`line ${line.id}: split word "${s.after}" not found mid-line`);
    return { k, at: quietest(db, words[k].end - 0.25, words[k + 1].start + 0.02), add: s.add };
  });
  cuts.sort((x, y) => x.k - y.k);

  const bounds = [Math.max(0, words[0].start - HEAD), ...cuts.map((c) => c.at), Math.min(lenFile(file), words.at(-1).end + TAIL)];
  const lineStart = now();
  const lineWords = [];
  for (let s = 0; s < bounds.length - 1; s++) {
    const [a, b] = [bounds[s], bounds[s + 1]];
    const { pcm, speechEnd } = cleanEdges(decode(file, a, b));
    const t0 = now();
    const scale = pcm.length / 2 / RATE / (b - a); // real output seconds per source second
    faded.push({ line: line.id, seg: s, keptAfterSpeech: +(pcm.length / 2 / RATE - speechEnd).toFixed(3) });
    const segWords = words.filter((w, k) => (s === 0 || k > cuts[s - 1].k) && (s === cuts.length || k <= cuts[s].k));
    const heard = onset(db, a);
    const shift = heard !== null && Math.abs(heard - segWords[0].start) < 0.25 ? heard - segWords[0].start : 0;
    shifts.push(+shift.toFixed(3));
    for (const w of segWords)
      lineWords.push({ word: w.word, start: +(t0 + Math.max(0, w.start + shift - a) * scale).toFixed(3), end: +(t0 + (w.end + shift - a) * scale).toFixed(3) });
    push(pcm);
    if (s < cuts.length) push(silence(cuts[s].add));
  }
  cues.push({ id: line.id, text: line.display ?? line.text, start: +lineStart.toFixed(3), end: lineWords.at(-1).end, words: lineWords });
  push(silence(line.gap));
});

const data = Buffer.concat(chunks);
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(`${outDir}/vo.wav`, Buffer.concat([header, data]));
writeFileSync(`${outDir}/cues.json`, JSON.stringify({ duration: +now().toFixed(3), lines: cues }, null, 1));
console.log(`onset shifts (s): ${shifts.join(' ')}`);
console.log(faded.map((x) => `${x.line}/${x.seg}: faded ${x.keptAfterSpeech}s`).join('  '));
console.log(
  `vo.wav ${now().toFixed(3)} s, ${cues.length} lines, ${cues.reduce((n, c) => n + c.words.length, 0)} words; measured ${lenFile(`${outDir}/vo.wav`).toFixed(3)} s`,
);
