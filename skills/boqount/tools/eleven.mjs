#!/usr/bin/env node
// ElevenLabs helper for a film's sound: voice-over with word timings, sound effects, and music.
// The key is read from the environment variable ELEVENLABS_API_KEY, else from the file named by
// ELEVENLABS_KEY_FILE, else from ~/.config/boqount/eleven.key (keep that file at mode 600), so it
// never lands on a command line. It is never printed, logged or written anywhere. A key is one token of printable
// ASCII (surrounding whitespace is trimmed); anything else (a label line, a second line) is refused, naming where it
// was read from and nothing of its value. No raw error text is printed either (an error from fetch, a response body):
// only an HTTP status, or an error's name and code, with a fixed sentence.
//
//   node <skill>/tools/eleven.mjs tts       <script.txt> <out-prefix> --voice ID [--model ID]
//   node <skill>/tools/eleven.mjs tts-lines <vo-plan.json> <lines-dir> [--voice ID] [--model ID] [--only id,id]
//
// There is no default voice: the brand chooses its own, and `--voice` names it (for tts-lines, else the plan's
// `voice`; both are checked the same way). `tts` sends no voice settings (the
// voice's own apply); `tts-lines` sends the plan's `voiceSettings` when it has them.
//   node <skill>/tools/eleven.mjs sfx       <"prompt"> <out.mp3> [--seconds N] [--influence 0-1] [--model ID] [--loop]
//   node <skill>/tools/eleven.mjs music     <"prompt"> <out.mp3> [--seconds N]
//
// `tts` writes <prefix>.mp3, <prefix>.alignment.json (the raw character
// alignment) and <prefix>.words.json ([{ word, start, end }] in seconds),
// which is what a film's scenes cue from. `tts-lines` writes <dir>/<id>.mp3 and <dir>/<id>.words.json
// per line of the plan, the input of vo-assemble.mjs.
import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.elevenlabs.io/v1";

const NO_KEY =
  "no ElevenLabs key found. Looked in: the ELEVENLABS_API_KEY environment variable; the file named by the " +
  "ELEVENLABS_KEY_FILE environment variable; the file ~/.config/boqount/eleven.key. Put the key in one of them " +
  "(a key file should be mode 600: chmod 600 <file>).";

/** An error whose message this file wrote itself and which holds nothing secret: it is printed as it is. */
class Plain extends Error {}

/** A key is one token of printable ASCII, no whitespace inside. `where` names the place, never the value. */
function checkKey(raw, where) {
  const key = raw.trim();
  if (!/^[\x21-\x7e]+$/.test(key)) throw new Plain(`the key in ${where} is not a single token (one line of printable ASCII with no spaces): put only the key there`);
  return key;
}

/**
 * The key and where it came from: { key, file, loose } (`file` is null for the environment variable, `loose` says a
 * key file is readable by group or others), or null when none of the three places has one. A file that is missing,
 * unreadable or empty counts as not there. A value that is not a single token throws, naming the place only.
 */
export function findKey(env = process.env, home = homedir()) {
  if (env.ELEVENLABS_API_KEY?.trim()) return { key: checkKey(env.ELEVENLABS_API_KEY, "the ELEVENLABS_API_KEY environment variable"), file: null, loose: false };
  for (const file of [env.ELEVENLABS_KEY_FILE, join(home, ".config/boqount/eleven.key")]) {
    if (!file) continue;
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue; // not here: try the next place
    }
    if (raw.trim()) return { key: checkKey(raw, `the file ${file}`), file, loose: (statSync(file).mode & 0o077) !== 0 };
  }
  return null;
}

/** A voice id goes into a URL path: letters and digits only. `where` says where else one may be given. */
function voiceId(v, where = "") {
  if (v === undefined) throw new Plain(`--voice <id> is required${where}: choose the brand's voice in your ElevenLabs voice library and pass its id`);
  if (typeof v !== "string" || !/^[A-Za-z0-9]+$/.test(v)) throw new Plain(`a voice id is letters and digits only, got ${JSON.stringify(v)}`);
  return v;
}
/** A line id becomes a file name: a bare name, never a path. */
function lineId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Plain(`a line id must be a bare name (letters, digits, _ and -), got ${JSON.stringify(id)}`);
  return id;
}

let KEY = null;
const apiKey = () => KEY;

function flag(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

/** A text file the command was given; an error names the path and the reason's code, not the system's text. */
function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new Plain(`cannot read ${path} (${kind(e)})`);
  }
}

/** An error's name and code, never its message: a message from fetch can hold a header value (the key). */
const kind = (e) => [e?.name, e?.code ?? e?.cause?.code].filter((x) => typeof x === "string" && /^[A-Za-z0-9_]+$/.test(x)).join(" ") || "Error";

/** The endpoint's name for a message: its path without the query, with any id left out. */
const endpoint = (path) => path.split("?")[0].replace(/\/text-to-speech\/[^/]+/, "/text-to-speech/<voice>");

const RETRIES = [1000, 3000, 9000]; // ms to wait after each 429 before asking again
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function post(path, body, accept = "application/json") {
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await request(path, body, accept);
    if (res.status !== 429 || attempt === RETRIES.length) break;
    console.error(`${endpoint(path)}: HTTP 429 (busy), asking again in ${RETRIES[attempt] / 1000} s`);
    await wait(RETRIES[attempt]);
  }
  // The body is not printed: a service may echo the request back, key included.
  if (!res.ok) throw new Plain(`${endpoint(path)}: the service answered HTTP ${res.status}${res.status === 401 ? " (the key was refused)" : ""}`);
  return res;
}

async function request(path, body, accept) {
  try {
    return await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "content-type": "application/json", accept },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Plain(`${endpoint(path)}: the request did not complete (${kind(e)}): check the network connection and try again`);
  }
}

// Characters → words. A word is a run of non-space characters; its start is
// its first character's start and its end its last character's end.
export function wordsFromAlignment(a) {
  const words = [];
  let cur = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur), (cur = null);
      return;
    }
    if (!cur) cur = { word: "", start: a.character_start_times_seconds[i], end: 0 };
    cur.word += ch;
    cur.end = a.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  return words.map((w) => ({ ...w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
}

async function tts(args) {
  const [scriptPath, prefix] = args;
  const voice = voiceId(flag(args, "voice"));
  const model = flag(args, "model", "eleven_multilingual_v2");
  const text = readText(scriptPath).trim();
  const res = await post(`/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_192`, { text, model_id: model });
  const d = await res.json();
  writeFileSync(`${prefix}.mp3`, Buffer.from(d.audio_base64, "base64"));
  const alignment = d.normalized_alignment ?? d.alignment;
  writeFileSync(`${prefix}.alignment.json`, JSON.stringify(d.alignment, null, 0));
  writeFileSync(`${prefix}.words.json`, JSON.stringify(wordsFromAlignment(d.alignment), null, 1));
  console.log(`${prefix}.mp3  (${alignment.characters.length} chars, model ${model}, voice ${voice})`);
}

// One request per line of a plan's `lines`, each told the text around it so
// the read carries across the cut. Writes <dir>/<id>.mp3 and <dir>/<id>.words.json —
// keyed by line id, so adding or removing a line never disturbs an approved take
// (use --only to voice just the new ones).
// The service may answer 429 when several requests run at once: lines are voiced one after another and retried.
async function ttsLines(args) {
  const [planPath, dir] = args;
  let plan;
  try {
    plan = JSON.parse(readText(planPath));
  } catch (e) {
    throw e instanceof Plain ? e : new Plain(`${planPath} is not valid JSON`);
  }
  const voice = voiceId(flag(args, "voice") ?? plan?.voice, ` (or a "voice" in ${planPath})`);
  for (const line of plan.lines) lineId(line.id);
  const model = flag(args, "model", plan.model);
  const only = flag(args, "only"); // comma-separated line ids, to redo single lines
  const texts = plan.lines.map((l) => l.text);
  for (const [i, line] of plan.lines.entries()) {
    if (only && !only.split(",").includes(line.id)) continue;
    const body = {
      text: line.text,
      model_id: model,
      voice_settings: plan.voiceSettings,
      // `prev`/`next` on a line override the neighbours: a looping film's last line is read into its first.
      previous_text: line.prev ?? (texts.slice(Math.max(0, i - 2), i).join(" ") || undefined),
      next_text: line.next ?? (texts.slice(i + 1, i + 3).join(" ") || undefined),
    };
    if (line.seed !== undefined) body.seed = line.seed;
    const res = await post(`/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_192`, body);
    const d = await res.json();
    writeFileSync(`${dir}/${line.id}.mp3`, Buffer.from(d.audio_base64, "base64"));
    writeFileSync(`${dir}/${line.id}.words.json`, JSON.stringify(wordsFromAlignment(d.alignment), null, 1));
    console.log(`${line.id}: ${line.text}`);
  }
}

// `soundlib.mjs gen` asks for the library's takes through this command, one call a take.
async function sfx(args) {
  const [prompt, out] = args;
  const seconds = flag(args, "seconds");
  const influence = Number(flag(args, "influence", "0.6"));
  if (!(influence >= 0 && influence <= 1)) throw new Plain("--influence is a number from 0 to 1");
  const model = flag(args, "model");
  if (model !== undefined && !/^[A-Za-z0-9_]+$/.test(model)) throw new Plain(`a model id is letters, digits and _, got ${JSON.stringify(model)}`);
  const body = { text: prompt, prompt_influence: influence };
  if (model) body.model_id = model;
  if (args.includes("--loop")) body.loop = true; // a background that is to be looped seamlessly
  if (seconds) body.duration_seconds = Math.max(0.5, Number(seconds)); // API minimum is 0.5 s
  const res = await post(`/sound-generation?output_format=mp3_44100_192`, body, "audio/mpeg");
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(out);
}

async function music(args) {
  const [prompt, out] = args;
  const seconds = Number(flag(args, "seconds", "60"));
  const res = await post(
    `/music?output_format=mp3_44100_192`,
    { prompt, music_length_ms: Math.round(seconds * 1000), force_instrumental: true },
    "audio/mpeg",
  );
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(out);
}

// Run as a command, but stay importable for the tests.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [cmd, ...rest] = process.argv.slice(2);
  const command = { tts, "tts-lines": ttsLines, sfx, music }[cmd];
  if (!command) {
    console.error("usage: eleven.mjs tts|tts-lines|sfx|music …");
    process.exit(2);
  }
  // Only this file's own messages are printed; any other error is shown by its name and code alone.
  const report = (e) => {
    console.error(`eleven.mjs: ${e instanceof Plain ? e.message : `stopped (${kind(e)}): a file could not be written, or the service's answer was not what was expected`}`);
    process.exit(1);
  };
  // The key is looked for before anything else, so a missing one fails at once, not after a script is read.
  let found;
  try {
    found = findKey();
  } catch (e) {
    report(e);
  }
  if (!found) {
    console.error(`eleven.mjs: ${NO_KEY}`);
    process.exit(1);
  }
  if (found.loose) console.error(`eleven.mjs: ${found.file} is readable by other users: chmod 600 it`);
  KEY = found.key;
  command(rest).catch(report);
}
