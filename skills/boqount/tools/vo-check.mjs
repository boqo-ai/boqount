#!/usr/bin/env node
// The voice, measured: where each word is heard, where it has been said, what the takes do after their last word, the
// pause across the loop, and the words the file says against the script. Nobody hears the voice in this pipeline
// (`film.md` → The voice); these are the measurements that stand in for an ear.
//
//   node <skill>/tools/vo-check.mjs onsets  <vo-plan.json> <lines-dir>          propose heard word starts → <lines-dir>/onsets.json
//   node <skill>/tools/vo-check.mjs fix     <vo-plan.json> <lines-dir> [onsets.json]   write them into the takes' words.json
//   node <skill>/tools/vo-check.mjs said    <audio-dir>                         said.json: when each word has been said
//   node <skill>/tools/vo-check.mjs tails   <lines-dir> [id …]                  late bursts after a take's last word
//   node <skill>/tools/vo-check.mjs seam    <audio-dir>                         the pause across the voice's loop
//   node <skill>/tools/vo-check.mjs words   <audio-or-whisper.json> <script> [--model <file>] [--alias name=a,b]
//   node <skill>/tools/vo-check.mjs dtw     <whisper.json>                      whisper.cpp's DTW word times
//   node <skill>/tools/vo-check.mjs contour <audio> [from] [to]                 the level every 10 ms, for reading a take
//
// Order after voicing: `onsets`, read its table (and `contour` where a value looks wrong), `fix`, then vo-assemble.mjs,
// then `said`, `tails`, `seam` (a looping film) and `words`. Exits 1 when a check finds something (a burst, a word
// that differs), 2 on wrong use.
//
// Why each one exists:
// - onsets/fix: the text-to-speech alignment runs LATE inside a line: 0.03 to 0.15 s on most words, 0.2 to 0.65 s on a
//   line's last words, whose aligned start can fall after the word has begun or even ended. A cue pinned to such a
//   word lands after it is heard. vo-assemble already corrects each segment's FIRST word from the waveform and adds that
//   one shift to every word of the segment; `onsets` proposes where each later word is heard and writes `heard - shift`,
//   so after vo-assemble adds the shift the word sits where it is heard. Each proposal says how it was found:
//   `silence` (the voice rises out of 40 ms or more of silence: sure), `dip` (out of a dip 15 dB deep in the 0.12 s
//   before the aligned start: likely), `typical` (no edge to read: the aligned start less the alignment's typical
//   0.06 s). Words run together in speech, so the level alone cannot always find the boundary: on one film's 46 words
//   measured by hand, these proposals came within 40 ms on 33, the aligned starts on 9. Read every `typical` and every
//   line's last word on `contour` (a word starts where the level climbs out of the dip before it), correct the table,
//   then `fix`. Whisper's DTW times (`dtw`) are no substitute: they fall 0.1 to 0.9 s after the word begins.
//   The aligned last word also "ends" at the file's end, silence included, which vo-assemble keeps as a pause:
//   the proposed end is where the voice is last heard (the last run above -45 dBFS that is not a burst). The first
//   word of every segment is never touched, so vo-assemble cuts and fades as before. `fix` keeps the alignments as the
//   service returned them in <lines-dir>/aligned/ and always starts from those, so it can be run again.
// - said: a headline leaves only after its last word has been said, and an aligned end cannot tell (a reused take's
//   last word "ends" up to 0.5 s after the voice stopped). A word has been said where the voice first falls silent
//   after it (0.1 s or more under -45 dBFS), or where the next word starts, whichever comes first. `npm run sync`
//   copies said.json beside the film's cues.json; `makeCues(cues, said)` gives `saidAt()`.
// - tails: a take can end with a separate short burst (a "tss" after the last consonant): a sound under 0.12 s after
//   a gap over 0.12 s. Such a line is re-taken.
// - seam: in a looping film, the pause from the voice's last sound to the end, plus from frame 0 to its first sound,
//   is the pause the viewer hears at the loop point.
// - words: the assembled voice transcribed (whisper-cli, when installed) and compared with the script word for word,
//   case, punctuation and the way numbers are written aside.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 48000;
const HEAD = 0.04; // vo-assemble keeps this before a segment's first word
const SILENT = -45; // dBFS: under this the voice is not heard
const USAGE = "usage: vo-check.mjs onsets|fix|said|tails|seam|words|dtw|contour … (see the head of tools/vo-check.mjs)";

const round = (v) => Math.round(v * 1000) / 1000;

/** A file's samples, mono at 48 kHz, as an Int16Array. */
export function pcm(file) {
  const r = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-i", resolve(file), "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], { maxBuffer: 1 << 30 });
  if (r.error) throw new Error(`could not run ffmpeg: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${r.stderr.toString().trim().split("\n").at(-1)}`);
  return new Int16Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 2);
}

/** The level in dBFS of each `ms`-long bin of x (index k covers [k·ms, (k+1)·ms)). */
export function levels(x, ms) {
  const hop = Math.round((RATE * ms) / 1000);
  const db = [];
  for (let i = 0; i + hop <= x.length; i += hop) {
    let e = 0;
    for (let j = i; j < i + hop; j++) e += (x[j] / 32768) ** 2;
    db.push(10 * Math.log10(e / hop + 1e-12));
  }
  return db;
}

// ---------------------------------------------------------------- the same cut points vo-assemble finds

/** Centre of the quietest 20 ms in [t0, t1] (5 ms bins), as vo-assemble cuts. */
function quietest(db, t0, t1) {
  let best = Infinity, at = (t0 + t1) / 2;
  for (let k = Math.max(0, Math.round(t0 * 200)); k + 4 <= Math.min(db.length, Math.round(t1 * 200)); k++) {
    const m = (db[k] + db[k + 1] + db[k + 2] + db[k + 3]) / 4;
    if (m < best) (best = m), (at = (k + 2) / 200);
  }
  return at;
}
/** First sound above -40 dBFS at or after t, within 0.4 s (5 ms bins), as vo-assemble reads a segment's onset. */
function firstSound(db, t, within = 0.4) {
  for (let k = Math.round(t * 200); k < Math.min(db.length, Math.round((t + within) * 200)); k++) if (db[k] > -40) return k / 200;
  return null;
}

/** The runs above -45 dBFS from `from` (seconds) on, 5 ms bins, merged across gaps under 30 ms; each flagged when it
 * is a burst (under 0.12 s, after a gap over 0.12 s). */
export function runsFrom(db, from) {
  const runs = [];
  let cur = null;
  for (let k = Math.max(0, Math.round(from * 200)); k < db.length; k++) {
    const on = db[k] > SILENT;
    if (on && !cur) cur = { a: k / 200, peak: db[k] };
    if (on && cur) cur.peak = Math.max(cur.peak, db[k]);
    if (!on && cur) (cur.b = k / 200), runs.push(cur), (cur = null);
  }
  if (cur) (cur.b = db.length / 200), runs.push(cur);
  const merged = [];
  for (const r of runs) {
    const m = merged.at(-1);
    if (m && r.a - m.b < 0.03) (m.b = r.b), (m.peak = Math.max(m.peak, r.peak));
    else merged.push({ ...r });
  }
  merged.forEach((r, i) => {
    r.burst = i > 0 && r.a - merged[i - 1].b > 0.12 && r.b - r.a < 0.12;
  });
  return merged;
}

const TYPICAL = 0.06; // seconds: how late the alignment usually puts a word inside a line

/** Where a word that the alignment puts at `aligned` (the word before it at `prevStart`) is heard to start, from the
 * take's 5 ms levels, and how that was found: { t, how: "silence" | "dip" | "typical" } (see the head of this file). */
export function heardStart(db, prevStart, aligned) {
  const sm = db.map((_, k) => (db[Math.max(0, k - 1)] + db[k] + db[Math.min(db.length - 1, k + 1)]) / 3);
  const lo = Math.max(0, Math.round((prevStart + 0.08) * 200));
  const hi = Math.min(db.length - 1, Math.round((aligned + 0.02) * 200));
  // 1. the latest rise out of 40 ms or more of silence
  for (let k = hi; k > lo + 8; k--) {
    if (db[k] > SILENT && db[k - 1] <= SILENT) {
      let n = 0;
      while (k - 1 - n >= lo && db[k - 1 - n] <= SILENT) n++;
      if (n >= 8) return { t: round(k / 200), how: "silence" };
    }
  }
  // 2. the latest dip 15 dB deep in the 0.12 s before the aligned start
  let best = null;
  for (let m = Math.max(lo, Math.round((aligned - 0.12) * 200)) + 1; m < hi; m++) {
    if (!(sm[m] <= sm[m - 1] && sm[m] < sm[m + 1])) continue;
    let peak = -Infinity;
    for (let j = m; j <= Math.min(sm.length - 1, m + 12); j++) peak = Math.max(peak, sm[j]);
    if (peak - sm[m] >= 15 && (m + 1) / 200 < aligned - 0.02) best = { t: round((m + 1) / 200), how: "dip" };
  }
  return best ?? { t: round(aligned - TYPICAL), how: "typical" };
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const planLines = (planPath) => {
  const plan = readJson(resolve(planPath));
  if (!Array.isArray(plan.lines)) throw new Error(`${planPath} has no lines`);
  for (const [i, l] of plan.lines.entries()) if (typeof l.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(l.id)) throw new Error(`lines[${i}].id must be a bare name`);
  return plan.lines;
};
/** The alignment as the service returned it: aligned/<id>.words.json once `fix` has run, else <id>.words.json. */
const original = (dir, id) => {
  const kept = join(dir, "aligned", `${id}.words.json`);
  return readJson(existsSync(kept) ? kept : join(dir, `${id}.words.json`));
};

export function onsets([planPath, linesArg, ...rest]) {
  if (!linesArg || rest.length) throw new Error("usage: vo-check.mjs onsets <vo-plan.json> <lines-dir>");
  const dir = resolve(linesArg);
  const table = {};
  const out = [];
  for (const line of planLines(planPath)) {
    const words = original(dir, line.id);
    const db = levels(pcm(join(dir, `${line.id}.mp3`)), 5);
    // the segments vo-assemble makes: cut after each split word, in the quietest 20 ms of the gap that follows it
    const cuts = (line.splits ?? []).map((s) => {
      const k = words.findIndex((w) => w.word === s.after);
      if (k < 0 || k === words.length - 1) throw new Error(`line ${line.id}: split word "${s.after}" not found mid-line`);
      return { k, at: quietest(db, words[k].end - 0.25, words[k + 1].start + 0.02) };
    }).sort((a, b) => a.k - b.k);
    const firsts = new Map([[0, Math.max(0, words[0].start - HEAD)], ...cuts.map((c) => [c.k + 1, c.at])]);
    let shift = 0;
    const fixes = [];
    const log = [];
    words.forEach((w, k) => {
      if (firsts.has(k)) {
        const heard = firstSound(db, firsts.get(k));
        shift = heard !== null && Math.abs(heard - w.start) < 0.25 ? heard - w.start : 0;
        return;
      }
      const { t: heard, how } = heardStart(db, words[k - 1].start, w.start);
      fixes.push([k, w.word, heard, round(shift), how]);
      log.push(`${w.word} ${w.start}→${round(heard - shift)} (${how})`);
    });
    const last = words.length - 1;
    const runs = runsFrom(db, Math.max(0, words[last].start - 0.1)).filter((r) => !r.burst);
    const end = runs.length ? round(runs.at(-1).b) : null;
    const entry = { words: fixes };
    if (end !== null && end < words[last].end - 0.02) {
      entry.end = [last, words[last].word, end];
      log.push(`${words[last].word} end ${words[last].end}→${end}`);
    }
    table[line.id] = entry;
    out.push(`${line.id}: ${log.length ? log.join("  ") : "nothing to move"}`);
  }
  const file = join(dir, "onsets.json");
  writeFileSync(file, JSON.stringify({ _: "Per line: words [index, word, heard start (seconds into the take), the shift vo-assemble adds, how it was found], and end [index, word, where the voice is last heard]. Proposed by vo-check.mjs onsets: read every typical one and each last word on contour, correct, then vo-check.mjs fix.", lines: table }, null, 1) + "\n");
  return [...out, `-> ${file}: read it, then \`vo-check.mjs fix ${planPath} ${linesArg}\``].join("\n");
}

export function fix([planPath, linesArg, tableArg, ...rest]) {
  if (!linesArg || rest.length) throw new Error("usage: vo-check.mjs fix <vo-plan.json> <lines-dir> [onsets.json]");
  const dir = resolve(linesArg);
  const { lines: table } = readJson(resolve(tableArg ?? join(dir, "onsets.json")));
  mkdirSync(join(dir, "aligned"), { recursive: true });
  const out = [];
  for (const line of planLines(planPath)) {
    const kept = join(dir, "aligned", `${line.id}.words.json`);
    if (!existsSync(kept)) copyFileSync(join(dir, `${line.id}.words.json`), kept);
    const words = readJson(kept);
    const entry = table[line.id];
    const log = [];
    for (const [k, word, heard, shift = 0] of entry?.words ?? []) {
      const w = words[k];
      if (!w || w.word !== word) throw new Error(`${line.id}: word ${k} is ${w?.word}, not ${word}`);
      const start = round(heard - shift);
      log.push(`${word} ${w.start}→${start}`);
      w.start = start;
      // a word never ends before it starts, nor after the next begins
      if (k > 0 && words[k - 1].end > start) words[k - 1].end = start;
      if (w.end < start + 0.02) w.end = round(start + 0.05);
    }
    if (entry?.end) {
      const [k, word, end] = entry.end;
      if (words[k]?.word !== word) throw new Error(`${line.id}: word ${k} is ${words[k]?.word}, not ${word}`);
      log.push(`${word} end ${words[k].end}→${end}`);
      words[k].end = end;
    }
    for (let k = 1; k < words.length; k++) if (words[k].start < words[k - 1].start) throw new Error(`${line.id}: word ${k} starts before word ${k - 1}`);
    writeFileSync(join(dir, `${line.id}.words.json`), JSON.stringify(words, null, 1));
    out.push(`${line.id}: ${log.length ? log.join("  ") : "unchanged"}`);
  }
  return [...out, `the alignments as returned are kept in ${join(dir, "aligned")}; now vo-assemble.mjs`].join("\n");
}

/** When each word of `cues` has been said, from the voice's 10 ms levels: {line id: [seconds, …]}. */
export function saidTimes(cues, db) {
  const quiet = db.map((v) => v < SILENT);
  const silentFrom = (t) => {
    for (let k = Math.round(t * 100); k < quiet.length; k++) {
      let n = 0;
      while (k + n < quiet.length && quiet[k + n]) n++;
      if (n >= 10) return k / 100;
      k += n;
    }
    return cues.duration;
  };
  const all = cues.lines.flatMap((l) => l.words.map((w) => ({ id: l.id, start: w.start })));
  const out = {};
  all.forEach((w, k) => {
    const next = all[k + 1]?.start ?? cues.duration;
    (out[w.id] ??= []).push(round(Math.min(next, silentFrom(w.start + 0.05))));
  });
  return out;
}

export function said([dirArg, ...rest]) {
  if (!dirArg || rest.length) throw new Error("usage: vo-check.mjs said <audio-dir>");
  const dir = resolve(dirArg);
  const cues = readJson(join(dir, "cues.json"));
  if (!existsSync(join(dir, "vo.wav"))) throw new Error(`no ${join(dir, "vo.wav")}: a voice-free film has no said times (its cue ends are its reading times)`);
  const out = saidTimes(cues, levels(pcm(join(dir, "vo.wav")), 10));
  writeFileSync(join(dir, "said.json"), JSON.stringify(out, null, 1) + "\n");
  return [
    ...cues.lines.map((l) => `${l.id.padEnd(12)} last word "${l.words.at(-1)?.word}" said by ${out[l.id]?.at(-1)} s (aligned end ${l.words.at(-1)?.end} s)`),
    `-> ${join(dir, "said.json")} (npm run sync copies it beside the film's cues.json)`,
  ].join("\n");
}

export function tails([linesArg, ...ids]) {
  if (!linesArg) throw new Error("usage: vo-check.mjs tails <lines-dir> [id …]");
  const dir = resolve(linesArg);
  const list = ids.length ? ids : readdirSync(dir).filter((f) => f.endsWith(".words.json")).map((f) => f.slice(0, -11)).sort();
  if (!list.length) throw new Error(`no takes in ${dir}`);
  let bursts = 0;
  const out = list.map((id) => {
    const x = pcm(join(dir, `${id}.mp3`));
    const db = levels(x, 5);
    const last = readJson(join(dir, `${id}.words.json`)).at(-1);
    const runs = runsFrom(db, Math.max(0, last.start - 0.1));
    const flags = runs.filter((r) => r.burst).map((r) => {
      const gap = r.a - runs[runs.indexOf(r) - 1].b;
      return `BURST at ${r.a.toFixed(3)} s (${((r.b - r.a) * 1000).toFixed(0)} ms, peak ${r.peak.toFixed(1)} dB) after a ${(gap * 1000).toFixed(0)} ms gap`;
    });
    bursts += flags.length;
    return `${id}: file ${(x.length / RATE).toFixed(3)} s; last word "${last.word}" ${last.start}-${last.end}; runs from there: ${runs.map((r) => `${r.a.toFixed(2)}-${r.b.toFixed(2)} (${r.peak.toFixed(0)} dB)`).join(", ") || "none"}${flags.length ? "  <<< " + flags.join("; ") + ": re-take this line" : "  ok"}`;
  });
  return { text: out.join("\n"), fail: bursts > 0 };
}

export function seam([dirArg, ...rest]) {
  if (!dirArg || rest.length) throw new Error("usage: vo-check.mjs seam <audio-dir>");
  const dir = resolve(dirArg);
  const x = pcm(join(dir, "vo.wav"));
  const db = levels(x, 10);
  const firstK = db.findIndex((v) => v > SILENT);
  if (firstK < 0) throw new Error(`${join(dir, "vo.wav")} is silent`);
  let last = db.length - 1;
  while (last > 0 && db[last] <= SILENT) last--;
  const end = (last + 1) / 100;
  const cues = readJson(join(dir, "cues.json"));
  // the film's length as lib/cues.ts and the mixer round it: a whole number of 30 fps frames, rounded up
  const film = Math.max(30, Math.ceil(cues.duration * 30)) / 30;
  const pause = film - end + firstK / 100;
  return `vo.wav ${(x.length / RATE).toFixed(3)} s; film ${film.toFixed(4)} s; voice ends ${end.toFixed(2)} s, starts again ${(firstK / 100).toFixed(2)} s into the loop: seam pause ${pause.toFixed(2)} s`;
}

// ---------------------------------------------------------------- the file's words against the script

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** A whole number as words ("21" → "twenty one"), so "21", "twenty-one" and "twenty one" compare equal. */
export function spell(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
  for (const [size, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [100, "hundred"]]) {
    if (n >= size) return `${spell(Math.floor(n / size))} ${name}${n % size ? ` ${spell(n % size)}` : ""}`;
  }
  return String(n);
}
/** Words for comparing: lower case, no punctuation, numbers spelled out, each alias read as its name. */
export function normalise(text, aliases = {}) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/(\d),(?=\d{3})/g, "$1")
    .replace(/\d+/g, (d) => ` ${d.length > 12 ? d : spell(Number(d))} `)
    .replace(/%/g, " percent ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
    .map((w) => aliases[w] ?? w);
}
/** The differences between what was heard and what the script says, word by word (an edit-distance alignment, so one
 * missing word is one difference, not a shift of every word after it). */
export function diffWords(heard, script) {
  const n = heard.length, m = script.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (heard[i - 1] === script[j - 1] ? 0 : 1));
  const out = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (heard[i - 1] === script[j - 1] ? 0 : 1)) {
      if (heard[i - 1] !== script[j - 1]) out.push(`script word ${j}: heard "${heard[i - 1]}", script "${script[j - 1]}"`);
      i--, j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) out.push(`script word ${j} "${script[j - 1]}" not heard`), j--;
    else out.push(`heard "${heard[i - 1]}" after script word ${j}, not in the script`), i--;
  }
  return out.reverse();
}
/** The script's spoken words: a vo-plan.json's lines, a cues.json's lines, or a text file (its numbered lines
 * "1. …" when it has them, each with a trailing "[…]" note dropped; else all of it). */
export function scriptText(file) {
  const raw = readFileSync(file, "utf8");
  if (file.endsWith(".json")) {
    const j = JSON.parse(raw);
    if (!Array.isArray(j.lines)) throw new Error(`${file} has no lines`);
    return j.lines.map((l) => l.text ?? (l.words ?? []).map((w) => w.word).join(" ")).join(" ");
  }
  const numbered = raw.split("\n").filter((l) => /^\s*\d+\.\s/.test(l));
  return (numbered.length ? numbered.map((l) => l.replace(/^\s*\d+\.\s/, "").replace(/\s{2,}\[.*$/, "")) : [raw]).join(" ");
}

/** A whisper.cpp model file: --model, $WHISPER_MODEL, or the first ggml-*.bin in the usual folders. */
export function whisperModel(flag) {
  if (flag) return flag;
  if (process.env.WHISPER_MODEL) return process.env.WHISPER_MODEL;
  const dirs = [join(homedir(), ".cache/whisper"), join(homedir(), ".cache/whisper.cpp"), join(homedir(), "whisper.cpp/models"), "/opt/homebrew/share/whisper-cpp", "/usr/local/share/whisper-cpp", "/usr/share/whisper-cpp"];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    const f = readdirSync(d).filter((x) => /^ggml-.*\.bin$/.test(x)).sort().find((x) => !/tiny|test/.test(x)) ?? readdirSync(d).find((x) => /^ggml-.*\.bin$/.test(x));
    if (f) return join(d, f);
  }
  return null;
}

function transcribe(audio, model) {
  if (spawnSync("whisper-cli", ["--help"]).error) throw new Error("whisper-cli is not installed: ask the person to confirm the file's words (production.md → The file's words), or install whisper.cpp");
  if (!model || !existsSync(model)) throw new Error("no whisper.cpp model file: pass --model <ggml-….bin> or set WHISPER_MODEL");
  const tmp = mkdtempSync(join(tmpdir(), "vo-check-"));
  try {
    execFileSync("ffmpeg", ["-nostdin", "-y", "-v", "error", "-i", resolve(audio), "-ar", "16000", "-ac", "1", join(tmp, "a.wav")]);
    execFileSync("whisper-cli", ["-m", model, "-l", "auto", "-f", join(tmp, "a.wav"), "-oj", "-of", join(tmp, "a")], { stdio: "ignore" });
    return readJson(join(tmp, "a.json"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function words(args) {
  const pos = [];
  const aliases = {};
  let model = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model") model = args[++i];
    else if (args[i] === "--alias") {
      const [name, list = ""] = (args[++i] ?? "").split("=");
      for (const v of list.split(",").filter(Boolean)) aliases[v.toLowerCase()] = name.toLowerCase();
    } else pos.push(args[i]);
  }
  const [input, scriptFile] = pos;
  if (!scriptFile || pos.length > 2) throw new Error("usage: vo-check.mjs words <audio-or-whisper.json> <script> [--model <file>] [--alias name=a,b]");
  const json = input.endsWith(".json") ? readJson(resolve(input)) : transcribe(input, whisperModel(model));
  const heardText = (json.transcription ?? []).map((x) => x.text).join("").replace(/\[[^\]]*\]|\([^)]*\)/g, " ");
  const spoken = scriptText(resolve(scriptFile));
  const a = normalise(heardText, aliases);
  const b = normalise(spoken, aliases);
  const diffs = diffWords(a, b);
  return {
    text: [`heard:  ${heardText.trim().replace(/\s+/g, " ")}`, `script: ${spoken.trim().replace(/\s+/g, " ")}`, `${a.length} words heard, ${b.length} in the script; ${diffs.length ? "DIFFERENCES: " + diffs.join("; ") : "word for word the same"}`].join("\n"),
    fail: diffs.length > 0,
  };
}

/** Words with whisper.cpp's DTW token times (t_dtw, centiseconds; about 0.1 s after the word begins). */
export function dtwWords(json) {
  const out = [];
  for (const seg of json.transcription ?? []) {
    for (const tk of seg.tokens ?? []) {
      const t = tk.text;
      if (!t || t.startsWith("[_")) continue;
      const at = tk.t_dtw >= 0 ? tk.t_dtw / 100 : null;
      if (t.startsWith(" ") || out.length === 0) out.push({ word: t.trim(), at });
      else out.at(-1).word += t;
    }
  }
  return out;
}
export function dtw([file, ...rest]) {
  if (!file || rest.length) throw new Error("usage: vo-check.mjs dtw <whisper.json>   (whisper-cli … -ojf -dtw <model name> -nfa)");
  const w = dtwWords(readJson(resolve(file)));
  if (!w.some((x) => x.at !== null)) return "no DTW times in this file: run whisper-cli with -ojf (the full JSON), -dtw <model name> (for example -dtw small.en) and -nfa";
  return w.map((x) => `${x.word}@${x.at}`).join(" ");
}

export function contour([file, from = "0", to, ...rest]) {
  if (!file || rest.length) throw new Error("usage: vo-check.mjs contour <audio> [from] [to]");
  const db = levels(pcm(file), 10);
  const a = Math.max(0, Math.round(Number(from) * 100));
  const b = Math.min(db.length, to === undefined ? db.length : Math.round(Number(to) * 100));
  const out = [];
  for (let k = a; k < b; k++) {
    const v = Math.max(-80, db[k]);
    out.push(`${(k / 100).toFixed(2)}  ${v.toFixed(1).padStart(6)}  ${"#".repeat(Math.max(0, Math.round((v + 80) / 2)))}`);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- command line

const COMMANDS = { onsets, fix, said, tails, seam, words, dtw, contour };
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!COMMANDS[cmd]) {
    console.error(USAGE);
    process.exit(2);
  }
  try {
    const r = COMMANDS[cmd](rest);
    console.log(typeof r === "string" ? r : r.text);
    process.exit(typeof r === "object" && r.fail ? 1 : 0);
  } catch (e) {
    console.error(`vo-check.mjs: ${e.message}`);
    process.exit(/^usage/.test(e.message) ? 2 : 1);
  }
}
