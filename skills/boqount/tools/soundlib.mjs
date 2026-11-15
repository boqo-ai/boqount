#!/usr/bin/env node
// The account's sound library, and a film's tonal set. `sound.md` says how the library is used; this file makes it.
//
//   node <skill>/tools/soundlib.mjs gen   [--films <dir>] [--only id,id] [--yes]   paid: ElevenLabs takes of each entry
//   node <skill>/tools/soundlib.mjs build [--films <dir>] [--only id,id]           trim, level, measure: the manifest
//   node <skill>/tools/soundlib.mjs drop  <id> <n> [--films <dir>]                  take n of a sound out (a person heard it)
//   node <skill>/tools/soundlib.mjs list  [--films <dir>]                           the manifest as a table
//   node <skill>/tools/soundlib.mjs audition [<audio-dir>] [--films <dir>]          a page with every take, for a person's ear
//   node <skill>/tools/soundlib.mjs tone  <audio-dir> <root> [minor|major]          the tonal set, synthesized, $0
//   node <skill>/tools/soundlib.mjs key   <music-file>                              the music's likely key, for `tone`, and its tempo
//
// <films> is the account's films folder (default ./films). The library is <films>/sounds/: `spec.json` (what is asked
// for: copied in by `film.mjs init`), `.raw/` (the takes as they came), `library/<group>/<name>-<n>.flac` and
// `library.json` (what the mixer reads). Both the takes and the library are git-ignored: ElevenLabs' terms forbid
// passing its sound effects on as files or as a library, so they stay on the machines that made them.
//
// `gen` is the only paid command. Without --yes it prints what it would ask for (calls, seconds) and asks nothing:
// the cost is read from `production.md` → the price table and reserved in the budget first, and --yes is given only on
// the person's word for that reservation. It calls `eleven.mjs sfx` once a take (the key is read there, never here), one
// call at a time; a take that comes back silent is thrown away and asked of the next model. A tiny one-shot (`"slice":
// true`: a tick, a click, a key) is asked as several seconds of the same thing and cut into single events by `build`.
//
// `build` keeps, per entry, up to `keep` takes that fit its measurable limits (`min`/`max` length in seconds,
// `minCentroid` brightness). Nobody hears a take here and no model listens: the person's listen through `audition`
// decides which stay (`drop` the ones they reject). A take that lives under 150 Hz gets harmonics at 200-1200 Hz, so
// a phone, which plays almost nothing under 200 Hz, still plays it.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ID, SR, biquad, decode, envelope, ffmpeg, filter, meanLevel, measure, mono, seeded, spectrum, writeAudio } from "./sound-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODELS = ["eleven_text_to_sound_v3", "eleven_text_to_sound_v2"];
const USAGE = "usage: soundlib.mjs gen|build|drop|list|audition|tone|key … (see the head of tools/soundlib.mjs)";

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const positional = (args) => args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--films", "--only"].includes(args[i - 1])));
function paths(args) {
  const films = resolve(flag(args, "films") ?? "films");
  const root = join(films, "sounds");
  return { root, spec: join(root, "spec.json"), raw: join(root, ".raw"), lib: join(root, "library"), man: join(root, "library.json") };
}
function readSpec(p, only) {
  if (!existsSync(p.spec)) throw new Error(`no ${p.spec}: run film.mjs init, or copy <skill>/films/sounds/spec.json there`);
  const entries = JSON.parse(readFileSync(p.spec, "utf8")).sounds;
  for (const s of entries) {
    if (!ID.test(s.id ?? "")) throw new Error(`spec entry ${JSON.stringify(s.id)}: an id is <group>/<name>, lower case`);
    if (!["hit", "swell", "bed"].includes(s.kind)) throw new Error(`${s.id}: kind is hit, swell or bed`);
  }
  const wanted = only ? new Set(only.split(",")) : null;
  return entries.filter((s) => !wanted || wanted.has(s.id) || wanted.has(s.id.split("/")[0]));
}
const flat = (id) => id.replace("/", "__");
const rawName = (p, s, k) => join(p.raw, `${flat(s.id)}${(s.rev ?? 1) === 1 ? "" : `.r${s.rev}`}-${k}.mp3`);
const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

// ---------------------------------------------------------------- gen (paid)

export function gen(args, { eleven = join(HERE, "eleven.mjs"), env = process.env } = {}) {
  const p = paths(args);
  const jobs = [];
  for (const s of readSpec(p, flag(args, "only"))) {
    for (let k = 0; k < (s.candidates ?? 3); k++) if (!existsSync(rawName(p, s, k))) jobs.push({ s, k, out: rawName(p, s, k) });
  }
  const seconds = jobs.reduce((t, j) => t + Math.max(0.5, j.s.seconds ?? 2), 0);
  const plan = `${jobs.length} takes to ask for, ${seconds.toFixed(1)} s of sound in all (each take is billed, kept or not; a silent one is asked again of the next model)`;
  if (!args.includes("--yes")) return `${plan}.\nNothing was asked. Price it from production.md → the price table, reserve it in the budget, and on the person's word run this again with --yes.`;
  mkdirSync(p.raw, { recursive: true });
  let made = 0;
  let calls = 0;
  const lines = [];
  for (const { s, k, out } of jobs) {
    let ok = false;
    for (const model of s.model ? [s.model] : MODELS) {
      const argv = [...process.execArgv, eleven, "sfx", s.prompt, out, "--seconds", String(Math.max(0.5, s.seconds ?? 2)), "--influence", String(s.influence ?? 0.6), "--model", model];
      if (s.loop) argv.push("--loop");
      const r = spawnSync(process.execPath, argv, { encoding: "utf8", env });
      calls++;
      if (r.status !== 0) {
        lines.push(`${s.id} #${k} ${model}: ${(r.stderr || "").trim().split("\n").at(-1)}`);
        if (/key|HTTP 4(01|02|03)/.test(r.stderr)) return [...lines, `stopped after ${calls} calls: ${made} takes made`].join("\n");
        continue;
      }
      if (peakOf(mono(decode(out))) < 1e-3) {
        rmSync(out, { force: true });
        lines.push(`${s.id} #${k} ${model}: silent, asking the next model`);
        continue;
      }
      ok = true;
      made++;
      lines.push(`${s.id} #${k} ${model}`);
      break;
    }
    if (!ok) lines.push(`${s.id} #${k}: no take`);
  }
  return [...lines, `${made} of ${jobs.length} takes from ${calls} paid calls; next: soundlib.mjs build`].join("\n");
}

// ---------------------------------------------------------------- build

/** The separate events of a take that holds several (a clock ticking): each from its onset to the silence after it. */
export function slices([L, R]) {
  const m = mono([L, R]);
  const e = envelope(m, 5);
  const top = peakOf(e);
  const idx = [];
  for (let i = 0; i < e.length; i++) if (e[i] > top * Math.pow(10, -28 / 20)) idx.push(i);
  if (!idx.length) return [];
  const gap = Math.round(0.12 * SR); // events closer than this stay together (a click is a press and a release)
  const cuts = [idx[0]];
  const ends = [];
  for (let i = 1; i < idx.length; i++) if (idx[i] - idx[i - 1] > gap) (ends.push(idx[i - 1]), cuts.push(idx[i]));
  ends.push(idx.at(-1));
  const pk = peakOf(m);
  const out = [];
  cuts.forEach((a, j) => {
    const next = cuts[j + 1] ?? L.length;
    const from = Math.max(0, a - Math.round(0.01 * SR));
    const to = Math.min(next - Math.round(0.005 * SR), ends[j] + Math.round(0.25 * SR));
    const seg = [L.slice(from, to), R.slice(from, to)];
    if (to - from > 0.03 * SR && peakOf(mono(seg)) > 0.25 * pk) out.push(seg);
  });
  return out.slice(0, 12);
}

/** Trims a take to its onset and its tail, fades both ends and levels it (`bed`: to -30 LKFS, else to a -3 dBFS peak). */
export function processTake([L, R], kind) {
  const m = mono([L, R]);
  const e = envelope(m);
  const emax = peakOf(e);
  const scale = (ch, g) => ch.map((c) => Float32Array.from(c, (v) => v * g));
  if (kind === "bed") {
    const a = Math.round(0.25 * SR);
    const y = [L.slice(a, L.length - a), R.slice(a, R.length - a)];
    return scale(y, Math.pow(10, (-30 - meanLevel(y)) / 20));
  }
  let a, fin;
  if (kind === "hit") {
    const pk = peakOf(m);
    a = Math.max(0, m.findIndex((v) => Math.abs(v) > pk * 0.1) - Math.round(0.003 * SR));
    fin = Math.round(0.0015 * SR);
  } else {
    a = Math.max(0, e.findIndex((v) => v > emax * Math.pow(10, -45 / 20)) - Math.round(0.01 * SR));
    fin = Math.round(0.01 * SR);
  }
  let last = e.length - 1;
  while (last > 0 && e[last] <= emax * Math.pow(10, -50 / 20)) last--;
  const b = Math.min(L.length, last + Math.round(0.04 * SR));
  const y = [L.slice(a, b), R.slice(a, b)];
  const fout = Math.min(Math.round(0.03 * SR), y[0].length >> 2);
  for (const c of y) {
    for (let i = 0; i < fin && i < c.length; i++) c[i] *= i / fin;
    for (let i = 0; i < fout; i++) c[c.length - 1 - i] *= i / fout;
  }
  return scale(y, Math.pow(10, -3 / 20) / (Math.max(peakOf(y[0]), peakOf(y[1])) + 1e-12));
}

/** Harmonics at 200-1200 Hz under a sound that lives below 150 Hz, so a phone plays it; the low end stays. */
export function body(y) {
  const pk = Math.max(peakOf(y[0]), peakOf(y[1])) + 1e-12;
  const out = y.map((c) => {
    const low = [biquad("lowpass", 220, 0.5412), biquad("lowpass", 220, 1.3066)].reduce((s, st) => filter(st, s), c);
    const driven = Float64Array.from(low, (v) => Math.tanh((8 * v) / pk));
    return [biquad("highpass", 200), biquad("lowpass", 1200)].reduce((s, st) => filter(st, s), driven);
  });
  const madePk = Math.max(peakOf(out[0]), peakOf(out[1])) + 1e-12;
  const g = (Math.pow(10, -7 / 20) * pk) / madePk;
  const sum = y.map((c, j) => Float32Array.from(c, (v, i) => v + out[j][i] * g));
  const sp = Math.max(peakOf(sum[0]), peakOf(sum[1])) + 1e-12;
  return sum.map((c) => Float32Array.from(c, (v) => (v * Math.pow(10, -3 / 20)) / sp));
}

export function build(args) {
  const p = paths(args);
  const all = readSpec(p);
  const man = existsSync(p.man) ? JSON.parse(readFileSync(p.man, "utf8")) : { _: "", sounds: {} };
  man._ =
    "Written by soundlib.mjs build. One entry per sound; its variants are takes of the same thing. `sync` is where a take peaks (s), `loud` its loudest 400 ms K-weighted (LKFS), `phone` the same with nothing under 200 Hz (what a phone's speaker plays), `peak` its sample peak (dBFS), `low` the share of its energy under 150 Hz, `voice` the share at 1-4 kHz, `body` true where harmonics were added so a phone plays it. Nobody has heard these files until a person listens through `audition`.";
  const lines = [];
  for (const s of readSpec(p, flag(args, "only"))) {
    const cands = [];
    for (let k = 0; k < (s.candidates ?? 3); k++) {
      const raw = rawName(p, s, k);
      if (!existsSync(raw)) continue;
      const x = decode(raw);
      if (x[0].length < 0.05 * SR || peakOf(mono(x)) < 1e-3) continue;
      (s.slice ? slices(x) : [x]).forEach((part, j) => {
        let y = processTake(part, s.kind);
        if (y[0].length < 0.02 * SR) return;
        let m = measure(y);
        const bodied = s.kind !== "bed" && m.low > 0.5;
        if (bodied) (y = body(y)), (m = measure(y));
        cands.push({ take: s.slice ? `${k}.${j}` : String(k), y, body: bodied, ...m });
      });
    }
    const fits = (c) => c.dur <= (s.max ?? 99) && c.dur >= (s.min ?? 0) && c.centroid >= (s.minCentroid ?? 0);
    // A one-shot that starts late (its first 40 ms far under its peak) goes after the ones that start on time.
    const kept = cands.filter(fits).sort((a, b) => (s.kind === "hit" ? (a.attack < -6) - (b.attack < -6) : 0)).slice(0, s.keep ?? 2);
    const group = join(p.lib, s.id.split("/")[0]);
    mkdirSync(group, { recursive: true });
    const base = s.id.split("/")[1];
    for (const old of readdirSync(group)) if (new RegExp(`^${base}-\\d+\\.flac$`).test(old)) rmSync(join(group, old));
    const variants = kept.map((c, n) => {
      const file = `${s.id}-${n + 1}.flac`;
      writeAudio(join(p.lib, file), c.y);
      const { y, ...rest } = c;
      return { file, ...rest };
    });
    man.sounds[s.id] = { kind: s.kind, is: s.is, use: s.use ?? "", ...(s.note ? { note: s.note } : {}), ...(s.repeat ? { repeat: true } : {}), source: `ElevenLabs sound effects, generated ${new Date().toISOString().slice(0, 10)}`, prompt: s.prompt, variants };
    lines.push(`${s.id.padEnd(22)} kept ${variants.length}/${cands.length}${variants.length < Math.min(2, s.keep ?? 2) ? "   <-- few" : ""}`);
    for (const v of variants) lines.push(`      ${v.dur}s  loud ${v.loud}  phone ${v.phone}  low ${v.low}${v.body ? "  (body added)" : ""}`);
  }
  // Entries that left the spec leave the manifest.
  for (const id of Object.keys(man.sounds)) if (!all.some((s) => s.id === id)) delete man.sounds[id];
  writeFileSync(p.man, JSON.stringify(man, null, 1) + "\n");
  return [...lines, `${p.man}: ${Object.keys(man.sounds).length} sounds. Nobody has heard them: soundlib.mjs audition, then the person's word.`].join("\n");
}

export function drop(args) {
  const p = paths(args);
  const [id, n] = positional(args);
  if (!ID.test(id ?? "") || !/^[1-9]\d*$/.test(n ?? "")) throw new Error("usage: soundlib.mjs drop <id> <n>");
  const man = JSON.parse(readFileSync(p.man, "utf8"));
  const s = man.sounds[id];
  const v = s?.variants.find((x) => x.file === `${id}-${n}.flac`);
  if (!v) throw new Error(`${id} has no take ${n}`);
  s.variants = s.variants.filter((x) => x !== v);
  rmSync(join(p.lib, v.file), { force: true });
  writeFileSync(p.man, JSON.stringify(man, null, 1) + "\n");
  return `${id}: take ${n} dropped, ${s.variants.length} left${s.variants.length ? "" : ": ask for new takes (gen --only, then build --only)"}`;
}

export function list(args) {
  const man = JSON.parse(readFileSync(paths(args).man, "utf8")).sounds;
  return Object.entries(man)
    .map(([id, s]) => `${id.padEnd(24)} ${s.kind.padEnd(6)} ${s.variants.length}  ${s.variants.map((v) => `${v.dur}s`).join(" ")}   ${s.use || s.is}${s.note ? `   (${s.note})` : ""}`)
    .join("\n");
}

export function audition(args) {
  const p = paths(args);
  const [audio] = positional(args);
  const esc = (t) => String(t ?? "").replace(/[&<>'"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const groups = {};
  const man = existsSync(p.man) ? JSON.parse(readFileSync(p.man, "utf8")).sounds : {};
  for (const [id, s] of Object.entries(man)) (groups[id.split("/")[0]] ??= []).push([id, s, "library/"]);
  if (audio && existsSync(join(audio, "tone/tone.json"))) {
    const rel = relative(p.root, join(resolve(audio), "tone")) + "/";
    for (const [id, s] of Object.entries(JSON.parse(readFileSync(join(audio, "tone/tone.json"), "utf8")).sounds)) (groups.tone ??= []).push([id, { ...s, use: "pitched, in the key of the film's music" }, rel]);
  }
  const rows = Object.entries(groups).flatMap(([g, items]) => [
    `<h2>${esc(g)}/</h2>`,
    ...items.map(([id, s, base]) => `<section><h3>${esc(id)}</h3><p>${esc(s.use || s.is)}${s.note ? ` · ${esc(s.note)}` : ""}</p>${s.variants.map((v, i) => `<div class=t><audio controls preload=none src="${esc(base + v.file)}"></audio><span>take ${i + 1} · ${v.dur} s</span></div>`).join("")}</section>`),
  ]);
  const count = Object.values(groups).reduce((t, x) => t + x.length, 0);
  const page =
    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Sound library</title><style>body{font:15px/1.45 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;background:#141414;color:#eee}h2{margin-top:36px}h3{margin:18px 0 2px;font-size:16px}p{margin:0 0 6px;color:#aaa}.t{display:flex;align-items:center;gap:12px;margin:4px 0;flex-wrap:wrap}audio{height:32px;width:260px}span{color:#a0a0a0;font-size:13px}</style>" +
    `<h1>Sound library: ${count} sounds</h1><p>Every take, as the mixer uses it. Nobody has heard these: listen, and say which takes go.</p>${rows.join("")}`;
  mkdirSync(p.root, { recursive: true });
  writeFileSync(join(p.root, "audition.html"), page);
  return join(p.root, "audition.html");
}

// ---------------------------------------------------------------- the tonal set ($0)

const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const PENTA = { minor: [0, 3, 5, 7, 10, 12], major: [0, 2, 4, 7, 9, 12] };
const TAU = Math.PI * 2;
const tt = (sec) => Float64Array.from({ length: Math.round(sec * SR) }, (_, i) => i / SR);
function fade(y, a = 0.002, r = 0.02) {
  const n = Math.round(a * SR), m = Math.round(r * SR);
  for (let i = 0; i < n && i < y.length; i++) y[i] *= i / n;
  for (let i = 0; i < m && i < y.length; i++) y[y.length - 1 - i] *= i / m;
  return y;
}
const pluck = (f, sec = 0.38) => fade(tt(sec).map((x) => Math.sin(TAU * f * x) * Math.exp(-x * 11) + 0.35 * Math.sin(TAU * 4 * f * x) * Math.exp(-x * 38) + 0.12 * Math.sin(TAU * 2 * f * x) * Math.exp(-x * 16)));
const blip = (f, sec = 0.07) => fade(tt(sec).map((x) => Math.sin(TAU * f * (1 + 0.04 * Math.exp(-x * 60)) * x) * Math.exp(-x * 30)), 0.003, 0.015);
const BELL = [[1, 1, 5], [2.0, 0.45, 7], [2.76, 0.3, 9], [5.4, 0.18, 14], [8.93, 0.08, 20]];
const bell = (f, sec = 0.9) => fade(tt(sec).map((x) => BELL.reduce((s, [k, a, d]) => s + a * Math.sin(TAU * f * k * x) * Math.exp(-x * d), 0)), 0.002, 0.08);
function seq(notes, gap, maker) {
  const parts = notes.map(maker);
  const n = Math.round(gap * SR);
  const y = new Float64Array(n * (parts.length - 1) + parts.at(-1).length);
  parts.forEach((p, i) => p.forEach((v, k) => (y[i * n + k] += v * (0.8 + (0.2 * i) / Math.max(1, parts.length - 1)))));
  return y;
}
function riser(f, sec) {
  const x = tt(sec);
  const rng = seeded(7);
  const noise = x.map(() => {
    const u = Math.max(1e-12, rng()), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  });
  const out = new Float64Array(x.length);
  let z = 0, ph1 = 0, ph2 = 0;
  const tone = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const k = x[i] / sec;
    z += (1 - Math.exp((-TAU * (300 * Math.pow(30, k))) / SR)) * (noise[i] - z); // the noise opens as it rises
    out[i] = z;
    const glide = f * Math.pow(2, k - 1);
    ph1 += (TAU * glide) / SR;
    ph2 += (TAU * glide * 2) / SR;
    tone[i] = Math.sin(ph1) + 0.4 * Math.sin(ph2);
  }
  const pk = peakOf(out) + 1e-9;
  const y = x.map((xi, i) => (0.5 * out[i] / pk + 0.5 * tone[i]) * Math.pow(xi / sec, 2.2));
  const n = Math.round(0.004 * SR);
  for (let i = 0; i < n; i++) y[y.length - 1 - i] *= i / n; // ends dead: `"align": "sync"` puts that end on the cue
  return y;
}
function sub(f) {
  let low = f;
  while (low > 110) low /= 2;
  const x = tt(0.8);
  let ph = 0;
  // The low note is for headphones; the drop also sounds two and four times higher, where a phone plays it.
  return fade(
    x.map((xi) => {
      ph += (TAU * low * (1 + 0.6 * Math.exp(-xi * 9))) / SR;
      return 0.6 * Math.tanh(2.5 * Math.sin(ph)) * Math.exp(-xi * 4.5) + 0.5 * Math.sin(2 * ph) * Math.exp(-xi * 6) + 0.5 * Math.sin(4 * ph) * Math.exp(-xi * 9) + Math.exp(-xi * 400) * Math.sin(TAU * 1400 * xi) * 0.3;
    }),
    0.001,
    0.08,
  );
}
const pad = (f) =>
  tt(3.0).map((x) => {
    const env = Math.pow(Math.sin((Math.PI * x) / 3), 1.5);
    return env * [[f / 2, 0], [(f / 2) * 1.003, 1], [f * 0.75, 2], [f * 0.75 * 0.998, 3], [f, 4]].reduce((s, [q, p]) => s + Math.sin(TAU * q * x + p), 0);
  });

/** The tonal set in a key: { name: [samples, kind] }. The same key gives the same samples. */
export function toneSet(root, mode = "minor") {
  if (!(root in NOTE)) throw new Error(`a root is one of ${Object.keys(NOTE).join(" ")}, got ${JSON.stringify(root)}`);
  if (!PENTA[mode]) throw new Error(`a mode is minor or major, got ${JSON.stringify(mode)}`);
  const base = 261.6256 * Math.pow(2, NOTE[root] / 12); // the root in the octave from middle C: in a phone's range
  const deg = PENTA[mode].map((s) => base * Math.pow(2, s / 12));
  const made = {};
  deg.forEach((f, i) => (made[`pluck-${i + 1}`] = [pluck(f * 2), "hit"]));
  [0, 4, 5].forEach((d, i) => (made[`blip-${i + 1}`] = [blip(deg[d] * 4), "hit"]));
  made["bell-1"] = [bell(deg[0] * 2), "hit"];
  made["bell-5"] = [bell(deg[mode === "major" ? 4 : 3] * 2), "hit"];
  const fifth = base * Math.pow(2, 7 / 12), fourth = base * Math.pow(2, 5 / 12);
  made.confirm = [seq([fifth * 2, base * 4], 0.09, (f) => pluck(f)), "hit"];
  made.resolve = [seq([fourth * 2, fifth * 2, base * 4], 0.1, (f) => pluck(f)), "hit"];
  made.deny = [seq([base * Math.pow(2, 1 / 12), base], 0.1, (f) => pluck(f, 0.22).map((v) => v * 0.9)), "hit"];
  made["riser-1"] = [riser(base * 2, 1.0), "swell"];
  made["riser-2"] = [riser(base * 2, 2.0), "swell"];
  made.fall = [fade(riser(base * 2, 1.2).reverse(), 0.004, 0.2), "swell"];
  made.shimmer = [seq([...deg.map((f) => f * 4), deg[1] * 8, deg[2] * 8], 0.045, (f) => bell(f, 0.5).map((v) => v * 0.7)), "swell"];
  made.sub = [sub(base), "hit"];
  made.pad = [pad(base), "swell"];
  return made;
}

export function tone(args) {
  const [audio, root, mode = "minor"] = positional(args);
  if (!audio || !root) throw new Error("usage: soundlib.mjs tone <audio-dir> <root> [minor|major]");
  const made = toneSet(root, mode);
  const out = join(resolve(audio), "tone");
  mkdirSync(out, { recursive: true });
  const man = { _: `Written by soundlib.mjs tone: the tonal set in ${root} ${mode}. Same fields as the library's manifest.`, key: `${root} ${mode}`, sounds: {} };
  for (const [name, [y, kind]] of Object.entries(made)) {
    const g = Math.pow(10, -3 / 20) / (peakOf(y) + 1e-9);
    const ch = Float32Array.from(y, (v) => v * g);
    writeAudio(join(out, `${name}.flac`), [ch, ch]);
    man.sounds[`tone/${name}`] = { kind, ...(name.startsWith("blip") ? { repeat: true } : {}), variants: [{ file: `${name}.flac`, ...measure([ch, ch]) }] };
  }
  writeFileSync(join(out, "tone.json"), JSON.stringify(man, null, 1) + "\n");
  return `${Object.keys(made).length} tonal sounds in ${root} ${mode} -> ${out}`;
}

// ---------------------------------------------------------------- the music's key

const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
// Krumhansl-Kessler key profiles.
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** The pitch classes' weight over a mono signal at `rate` (frames of 8192, 55 Hz to 2 kHz), normalised. */
export function chroma(m, rate) {
  const c = new Array(12).fill(0);
  const N = 8192;
  for (let s = 0; s + N <= m.length; s += N / 2) {
    const { power, freq } = spectrum(m.subarray(s, s + N), rate);
    for (let i = 1; i < power.length; i++) {
      if (freq[i] < 55 || freq[i] > 2000) continue;
      const pc = (((Math.round(12 * Math.log2(freq[i] / 261.6256)) % 12) + 12) % 12);
      c[pc] += Math.sqrt(power[i]);
    }
  }
  const tot = c.reduce((a, b) => a + b, 0) || 1;
  return c.map((v) => v / tot);
}
/** The keys that fit the chroma best, as [{ key, r }], best first. */
export function keysOf(c) {
  const corr = (a, b) => {
    const ma = a.reduce((x, y) => x + y, 0) / 12, mb = b.reduce((x, y) => x + y, 0) / 12;
    let s = 0, sa = 0, sb = 0;
    for (let i = 0; i < 12; i++) (s += (a[i] - ma) * (b[i] - mb)), (sa += (a[i] - ma) ** 2), (sb += (b[i] - mb) ** 2);
    return s / Math.sqrt(sa * sb);
  };
  const out = [];
  for (let r = 0; r < 12; r++) {
    for (const [p, mode] of [[MAJ, "major"], [MIN, "minor"]]) {
      const rolled = p.map((_, i) => p[(i - r + 12) % 12]);
      out.push({ key: `${NAMES[r]} ${mode}`, r: corr(rolled, c) });
    }
  }
  return out.sort((a, b) => b.r - a.r);
}
/** The music's tempo, in beats a minute, the way librosa's beat_track reads it (the private tool this replaces): the
 * onset envelope (the rise of 64 mel bands in dB, 23 ms hops), its tempogram, and the lag that scores best weighted
 * toward 120 bpm (a log-normal of one octave, how a listener's sense of the beat leans), read between whole lags.
 * On ten beds it agreed with librosa on eight; the two others were beatless drones. Returns { bpm, alt }: `alt`
 * is the half, double, two-thirds or three-halves tempo that scored next, since a beat can be felt at any of them. */
export function tempo(m, rate) {
  const N = 2048, HOP = 512, BANDS = 64;
  const frames = Math.floor((m.length - N) / HOP) + 1;
  if (frames < 64) return null;
  // 64 bands evenly spaced in mels from 30 Hz to 8 kHz, each band's power in dB, as an ear weighs the spectrum
  const mel = (f) => 2595 * Math.log10(1 + f / 700);
  const hz = (v) => 700 * (10 ** (v / 2595) - 1);
  const edges = Array.from({ length: BANDS + 1 }, (_, i) => hz(mel(30) + ((mel(8000) - mel(30)) * i) / BANDS));
  let prev = null;
  const flux = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    const { power, freq } = spectrum(m.subarray(f * HOP, f * HOP + N), rate);
    const band = new Float64Array(BANDS);
    let b = 0;
    for (let i = 1; i < power.length && b < BANDS; i++) {
      while (b < BANDS && freq[i] >= edges[b + 1]) b++;
      if (b < BANDS && freq[i] >= edges[b]) band[b] += power[i];
    }
    const db = band.map((p) => 10 * Math.log10(p + 1e-10));
    if (prev) {
      let s = 0;
      for (let i = 0; i < BANDS; i++) s += Math.max(0, db[i] - prev[i]);
      flux[f] = s / BANDS;
    }
    prev = db;
  }
  // a tempogram: the envelope's autocorrelation in 8.9 s windows (Hann), each scaled to its own peak, averaged over
  // the music; then the lag that scores best under the prior.
  const WIN = 384, STEP = 16;
  const hann = Float64Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN));
  const tg = new Float64Array(WIN);
  let windows = 0;
  for (let c = 0; c < frames; c += STEP) {
    const w = new Float64Array(WIN);
    for (let i = 0; i < WIN; i++) {
      const j = c - WIN / 2 + i;
      w[i] = j >= 0 && j < frames ? flux[j] * hann[i] : 0;
    }
    const ac = new Float64Array(WIN);
    for (let lag = 0; lag < WIN; lag++) {
      let s2 = 0;
      for (let i = 0; i + lag < WIN; i++) s2 += w[i] * w[i + lag];
      ac[lag] = s2;
    }
    const peak = Math.max(...ac);
    if (!(peak > 0)) continue;
    for (let lag = 0; lag < WIN; lag++) tg[lag] += ac[lag] / peak;
    windows++;
  }
  if (!windows) return null;
  const fps = rate / HOP;
  const scored = [];
  for (let lag = 1; lag < WIN; lag++) {
    const bpm = (60 * fps) / lag;
    if (bpm < 30 || bpm > 320) continue;
    scored.push({ bpm, s: (tg[lag] / windows) * Math.exp(-0.5 * Math.log2(bpm / 120) ** 2) });
  }
  const peaks = scored.filter((x, i) => (i === 0 || x.s >= scored[i - 1].s) && (i === scored.length - 1 || x.s >= scored[i + 1].s)).sort((a, b) => b.s - a.s);
  if (!peaks.length || !(peaks[0].s > 0)) return null;
  const r1 = (v) => Math.round(v * 10) / 10;
  // the peak between two whole lags (a parabola through the lag and its neighbours), so 120 is not read as 117.5
  const refine = (bpm) => {
    const lag = Math.round((60 * fps) / bpm);
    const [a, b, c] = [tg[lag - 1], tg[lag], tg[lag + 1]];
    const d = a - 2 * b + c;
    const off = d < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / d)) : 0;
    return (60 * fps) / (lag + off);
  };
  const best = refine(peaks[0].bpm);
  const alt = peaks.slice(1).find((p) => [best / 2, best * 2, (best * 2) / 3, (best * 3) / 2].some((t) => Math.abs(p.bpm - t) / t < 0.04))?.bpm;
  const altBpm = alt ? refine(alt) : null;
  return { bpm: r1(best), alt: altBpm ? r1(altBpm) : null };
}

export function key(args) {
  const [file] = positional(args);
  if (!file) throw new Error("usage: soundlib.mjs key <music-file>");
  const rate = 22050;
  const { stdout } = ffmpeg(["-v", "error", "-i", resolve(file), "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"]);
  const m = new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.length));
  const best = keysOf(chroma(m, rate)).slice(0, 3);
  const beat = tempo(m, rate);
  return `key: ${best.map((k) => `${k.key} (${k.r.toFixed(2)})`).join(", ")}   <- a major and the minor a third under it share notes: take the root the music's listing names, or the one that sounds like home\ntempo: ${beat ? `${beat.bpm} bpm${beat.alt ? ` (or ${beat.alt}: the same music counted ${beat.alt > beat.bpm ? "faster" : "slower"}; check against the bar length)` : ""}   <- where the music's listing names a tempo, its figure wins` : "not measured: the file is too short or has no beat"}`;
}

// ---------------------------------------------------------------- command line

const COMMANDS = { gen, build, drop, list, audition, tone, key };
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!COMMANDS[cmd]) {
    console.error(USAGE);
    process.exit(2);
  }
  try {
    console.log(COMMANDS[cmd](rest));
  } catch (e) {
    console.error(`soundlib.mjs: ${e.message}`);
    process.exit(1);
  }
}
