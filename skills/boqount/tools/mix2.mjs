#!/usr/bin/env node
// The mixer for a version-2 cue sheet (`"version": 2` in <audio-dir>/sfx-cues.json; tools/mix.mjs hands such a sheet
// over to it). `film.md` → Sound describes the sheet; `sound.md` says why each of these steps is here.
//
//   node <skill>/tools/mix2.mjs <audio-dir> [--sfx <dir>] [--library <dir>]
//
// Writes <audio-dir>/mix.wav (48 kHz stereo s16), <audio-dir>/stems/{vo,music,sfx,beds}.wav and stems/played.json
// (what was played, resolved: the input of soundcheck.mjs and of the director's list of long sounds).
//
// What it does, in order:
// - levels the voice lightly (2.5:1 over -20 dBFS, nothing else) and measures its typical level: the median of its
//   400 ms K-weighted windows while it speaks. A film with no voice is levelled against a nominal voice instead;
// - sets every hit and bed that says `"under": <dB>` that far under the voice's typical level, by the take's own
//   `phone` loudness, so every take of a sound lands alike; a hit with only `gain` keeps that gain;
// - rotates the takes of a library sound, and moves a take that comes round again a little in pitch;
// - puts a build (`"align": "sync"`) on its cue by its peak, not its start;
// - keeps four buses (voice, music, effects, backgrounds); the voice ducks the other three while it speaks;
//   the music can dip for a moment (`music.dips`); a hit with `"duck": false` is not ducked;
// - sums the stems, levels them to the target with one gain and limits, oversampled, the peaks that gain pushes over
//   the ceiling (default -14 LUFS integrated, -1 dBTP), with a voice or without one.
//
// Where a sound is: `"sound": "<group>/<name>"` from the account's library (<library>/library.json, default
// <audio-dir>/../../sounds), `"sound": "kit/<name>"` from the synthesized kit (--sfx, default <audio-dir>/../../sfx),
// `"sound": "tone/<name>"` from the film's tonal set (<audio-dir>/tone, made from the sheet's `"tone"` key when it is
// missing); `"sfx": "<name>"` is a film's own file, looked up as mix.mjs does (<audio-dir>/sfx, then the kit).
// Every sound missing anywhere is named in one error and nothing is mixed.
//
// Four lessons are built in, each with its test (tests/mix2.test.mjs):
// - every sum starts with a silence as long as the film: ffmpeg's amix takes its timeline from its first input, and
//   a first input trimmed with `from` moved its whole bus earlier by that sound's start time;
// - no `apad` where two inputs meet (a padded stream fed with another into amix or a compressor made ffmpeg spin at
//   full CPU now and then): every length comes from a generated silence, and each bus is its own ffmpeg run;
// - the compressor's key is the voice summed onto a silence one second longer than the film, so a looping film's
//   music does not stop where the voice stops;
// - a build placed by its peak counts its `from`: the head it skips brings the peak that much nearer.
//
// Nothing goes through a shell; every name and number in the sheet is checked before it reaches a filter graph.
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NAME, ID, SR, decode, ebur128, ffmpeg, sounds, windows400 } from "./sound-lib.mjs";
import { tone as makeTone } from "./soundlib.mjs";

const USAGE = "usage: mix2.mjs <audio-dir> [--sfx <dir>] [--library <dir>]";
/** A voice quieter than this, in dBFS true peak, is no voice: a silent vo.wav made as a stand-in. */
const SILENT = -60;
/** The nominal voice a voice-free film is levelled against (its typical level, its peak), dB. */
const NOMINAL = { typ: -20, peak: -12 };
/** The limiter runs at this rate, so a peak between two samples (a true peak) is caught, not let through. */
const OVERSAMPLE = 192000;
const TAIL = 4; // seconds rendered past the end and folded onto the head when looping
const STALL = 300_000; // ms: an ffmpeg run longer than this is a stall, reported as an error
const VARY = [0, 0.4, -0.3, 0.2, -0.5]; // semitones, by round: a take that comes round again is never the same pitch

export function main(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (["--sfx", "--library"].includes(argv[i]) && argv[i + 1] !== undefined) flags[argv[i].slice(2)] = argv[++i];
    else positional.push(argv[i]);
  }
  if (positional.length !== 1 || positional[0].startsWith("--")) throw new Usage();
  const dir = resolve(positional[0]);
  const kitDir = resolve(flags.sfx ?? join(dir, "../../sfx"));
  const cues = JSON.parse(readFileSync(join(dir, "cues.json"), "utf8"));
  const plan = JSON.parse(readFileSync(join(dir, "sfx-cues.json"), "utf8"));
  // `"tone": "<root> <minor|major>"`: the film's tonal set, synthesized here ($0, the same key always gives the same
  // sounds) when audio/tone/ has none yet, so a sheet that uses tone/<name> mixes on any machine without a step first.
  if (plan.tone !== undefined) {
    const [root, mode = "minor", ...rest] = String(plan.tone).trim().split(/\s+/);
    if (rest.length) throw new Error(`tone must be "<root> <minor|major>", got ${JSON.stringify(plan.tone)}`);
    const manifest = join(dir, "tone/tone.json");
    const key = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")).key : null;
    if (key !== `${root} ${mode}`) makeTone([dir, root, mode]);
  }
  const lib = sounds({ audio: dir, kit: kitDir, ...(flags.library ? { library: resolve(flags.library) } : {}) });
  if (plan.version !== 2) throw new Error("sfx-cues.json is not a version-2 sheet: mix it with mix.mjs");
  if (!Array.isArray(plan.hits)) throw new Error("sfx-cues.json: hits must be a list");
  const loop = plan.loop === true;
  const dur = Math.max(30, Math.ceil(num(cues.duration, "cues.json duration") * 30)) / 30;
  const full = loop ? dur + TAIL : dur;
  const byId = Object.fromEntries(cues.lines.map((l) => [l.id, l]));
  const target = { I: -14, TP: -1, ...(plan.target ?? {}) };
  num(target.I, "target.I");
  num(target.TP, "target.TP");

  /** A time: seconds, 'end', or a cue 'line.word' (the word's start). */
  const at = (spec, field) => {
    if (typeof spec === "number") return num(spec, field);
    if (spec === "end") return dur;
    if (typeof spec !== "string") throw new Error(`${field} must be seconds, "end" or "line.word", got ${JSON.stringify(spec)}`);
    const [id, k] = spec.split(".");
    const w = byId[id]?.words[Number(k)];
    if (!w) throw new Error(`no cue ${spec} (${field})`);
    return num(w.start, `cue ${spec} start`);
  };
  const opt = (value, fallback, field) => (value === undefined ? fallback : num(value, field));
  const run = (args) => ffmpeg(["-v", "error", "-y", ...args], { timeout: STALL });

  // ── the voice, levelled and measured
  const stems = join(dir, "stems");
  mkdirSync(stems, { recursive: true });
  const VO = join(stems, ".vo-level.wav");
  const voFile = join(dir, "vo.wav");
  const voiced = existsSync(voFile) && ebur128(["-i", voFile]).TP > SILENT;
  if (voiced) {
    const v = plan.voice;
    const lv = v === false ? "anull" : `acompressor=threshold=${Math.pow(10, opt(v?.threshold, -20, "voice.threshold") / 20).toFixed(4)}:ratio=${opt(v?.ratio, 2.5, "voice.ratio")}:attack=8:release=120:knee=4:makeup=1`;
    run(["-i", voFile, "-af", `aresample=${SR},aformat=channel_layouts=stereo,${lv}`, "-c:a", "pcm_f32le", VO]);
  } else {
    run(["-f", "lavfi", "-i", `anullsrc=r=${SR}:cl=stereo`, "-t", String(full), "-c:a", "pcm_f32le", VO]);
  }
  const voice = voiced ? measureVoice(VO) : { ...NOMINAL, nominal: true };

  /** The gain of one placed take, in dB: `under` the voice by the take's phone loudness, else its fixed `gain`. */
  const levelOf = (h, v, field) => {
    if (h.under === undefined) return opt(h.gain, -12, `${field}.gain`);
    const under = num(h.under, `${field}.under`);
    // A sound with most of its weight under 200 Hz reads far quieter to `phone` than on headphones, so it is also held
    // within 4 dB of its `under` by its full-range loudness; a short hit is also kept 4 dB under the voice's peak.
    return Math.min(voice.typ - under - (v.phone ?? v.loud), voice.typ - (under - 4) - v.loud, voice.peak - 4 - (v.peak ?? -3));
  };

  // ── resolve every hit: its file, start, pitch and gain. Every missing sound is named at once.
  const missing = new Set();
  const seen = {};
  const hits = plan.hits
    .map((h, i) => ({ ...h, i, t0: at(h.at, `hits[${i}].at`) + opt(h.offset, 0, `hits[${i}].offset`) }))
    .sort((a, b) => a.t0 - b.t0)
    .map((h) => {
      const p = `hits[${h.i}]`;
      checkHit(h, p);
      if (h.sfx !== undefined) {
        const file = lookup(safeName(h.sfx, `${p}.sfx`), [join(dir, "sfx"), kitDir]);
        if (!file) return missing.add(h.sfx), null;
        const v = lib.file(file).variants[0];
        return { ...h, file, sync: v.sync, len: v.dur, st: h.pitch ?? 0, db: levelOf(h, v, p), take: h.sfx };
      }
      if (typeof h.sound !== "string" || !ID.test(h.sound)) throw new Error(`${p}.sound must be an id such as ui/click or kit/pop, got ${JSON.stringify(h.sound)}`);
      const s = lib.get(h.sound);
      if (!s || !s.variants.length) return missing.add(h.sound), null;
      const n = (seen[h.sound] = (seen[h.sound] ?? -1) + 1);
      const v = s.variants[h.var ? num(h.var, `${p}.var`) - 1 : n % s.variants.length];
      if (!v) throw new Error(`${h.sound} has no take ${h.var} (${p}.var)`);
      const round = Math.floor(n / s.variants.length);
      const st = h.pitch ?? (h.var || s.kind !== "hit" ? 0 : VARY[round % VARY.length]);
      return { ...h, file: v.file, sync: v.sync, len: v.dur, st, db: levelOf(h, v, p), take: v.file.split(/[\\/]/).slice(-2).join("/") };
    });
  const beds = (plan.beds ?? []).map((b, i) => {
    const p = `beds[${i}]`;
    if (typeof b.sound !== "string" || !ID.test(b.sound)) throw new Error(`${p}.sound must be an id such as amb/room, got ${JSON.stringify(b.sound)}`);
    const s = lib.get(b.sound);
    if (!s) return missing.add(b.sound), null;
    const v = s.variants[opt(b.var, 1, `${p}.var`) - 1];
    if (!v) throw new Error(`${b.sound} has no take ${b.var} (${p}.var)`);
    const start = Math.max(0, at(b.at, `${p}.at`) + opt(b.offset, 0, `${p}.offset`));
    const end = Math.min(full, at(b.until ?? "end", `${p}.until`) + opt(b.untilOffset, 0, `${p}.untilOffset`));
    return { ...b, file: v.file, start, end, db: levelOf(b, v, p) };
  });
  const segs = (plan.music?.segments ?? []).flatMap((s, i) => {
    const file = lookup(safeName(s.file, `music.segments[${i}].file`), [join(dir, "music"), dir]);
    return file ? [{ s, i, file }] : [];
  });
  if (plan.music?.segments?.length && !segs.length) console.warn("no music segment's file was found: no music in this mix");
  if (missing.size) throw new Error(`sound not found: ${[...missing].join(", ")} (library ${lib.library}, kit ${kitDir}, tonal set ${join(dir, "tone")}, the film's own ${join(dir, "sfx")})`);

  // Every sum starts with a silence as long as the film (and a loop's tail): its length is the sum's length.
  let anchors = 0;
  const anchor = (f) => {
    const l = `[z${anchors++}]`;
    f.push(`anullsrc=r=${SR}:cl=stereo,atrim=0:${full}${l}`);
    return l;
  };
  const KEY = `anullsrc=r=${SR}:cl=stereo,atrim=0:${full + 1}[ksil];[0:a]aresample=${SR},aformat=channel_layouts=stereo[kv];[ksil][kv]amix=inputs=2:normalize=0:duration=first[key]`;
  const ratio = (db) => Math.min(20, Math.pow(10, db / 20) * 2).toFixed(2);
  const silentBus = (label) => [`anullsrc=r=${SR}:cl=stereo,atrim=0:${full}${label}`];

  // ── music: placed segments, dips, ducked under the voice
  const music = { inputs: ["-i", VO], f: [] };
  if (segs.length) {
    const labels = [];
    let n = 1;
    for (const { s, i, file } of segs) {
      const p = `music.segments[${i}]`;
      music.inputs.push("-i", file);
      const from = num(s.from, `${p}.from`);
      const start = Math.max(0, at(s.at, `${p}.at`) + opt(s.offset, 0, `${p}.offset`));
      const to = s.until !== undefined ? from + (at(s.until, `${p}.until`) - start) : num(s.to, `${p}.to`);
      const len = to - from;
      const ms = Math.round(start * 1000);
      const gain = s.gain !== undefined ? num(s.gain, `${p}.gain`) : num(plan.music.gain, "music.gain");
      const fi = opt(s.fadeIn, 0.02, `${p}.fadeIn`);
      const fo = opt(s.fadeOut, 0.02, `${p}.fadeOut`);
      music.f.push(`[${n}:a]aresample=${SR},aformat=channel_layouts=stereo,atrim=${from}:${to},asetpts=PTS-STARTPTS,volume=${gain}dB,afade=t=in:d=${fi},afade=t=out:st=${(len - fo).toFixed(3)}:d=${fo},adelay=${ms}|${ms}[m${n}]`);
      labels.push(`[m${n}]`);
      n++;
    }
    // A dip: the music drops by `db` for `len` seconds, `fade` in and out, so a hit or a word stands alone. It is
    // worked out once a frame, so the frames are made short first (256 samples, 5 ms), or its edge could sit 21 ms off.
    const dips = (plan.music.dips ?? []).map((d, i) => {
      const p = `music.dips[${i}]`;
      const a = at(d.at, `${p}.at`) + opt(d.offset, 0, `${p}.offset`);
      const fd = opt(d.fade, 0.06, `${p}.fade`);
      const k = (1 - Math.pow(10, -Math.abs(num(d.db, `${p}.db`)) / 20)).toFixed(4);
      return `(1-${k}*clip((t-${(a - fd).toFixed(3)})/${fd}\\,0\\,1)*clip((${(a + num(d.len, `${p}.len`) + fd).toFixed(3)}-t)/${fd}\\,0\\,1))`;
    });
    const dip = dips.length ? `,asetnsamples=n=256,volume=eval=frame:volume='${dips.join("*")}'` : "";
    music.f.push(`${anchor(music.f)}${labels.join("")}amix=inputs=${labels.length + 1}:normalize=0:duration=first${dip}[mus]`);
    music.f.push(KEY);
    music.f.push(`[mus][key]sidechaincompress=threshold=0.02:ratio=${ratio(opt(plan.music.duckDb, 4, "music.duckDb"))}:attack=20:release=${opt(plan.music.release, 700, "music.release")}:makeup=1[out]`);
  } else music.f.push(...silentBus("[out]"));

  // ── backgrounds: long sounds, looped to their length, each with its fades; under the voice they also give way at
  // 1-4 kHz, where speech is understood
  const bedBus = { inputs: ["-i", VO], f: [] };
  if (beds.length) {
    const labels = [];
    beds.forEach((b, j) => {
      const n = j + 1;
      const p = `beds[${j}]`;
      const len = b.end - b.start;
      const from = opt(b.from, 0, `${p}.from`);
      const fi = opt(b.fadeIn, 0.3, `${p}.fadeIn`);
      const fo = opt(b.fadeOut, 0.3, `${p}.fadeOut`);
      const ms = Math.round(b.start * 1000);
      // `pitch` (semitones) moves a pitched background, such as the tonal set's pad, to the chord of its world.
      const st = opt(b.pitch, 0, `${p}.pitch`);
      const shift = st ? `asetrate=${Math.round(SR * Math.pow(2, st / 12))},aresample=${SR},` : "";
      bedBus.inputs.push("-stream_loop", "-1", "-i", b.file);
      const eq = [b.hp !== undefined ? `highpass=f=${num(b.hp, `${p}.hp`)}` : "", b.lp !== undefined ? `lowpass=f=${num(b.lp, `${p}.lp`)}` : ""].filter(Boolean).map((x) => `${x},`).join("");
      bedBus.f.push(`[${n}:a]aresample=${SR},aformat=channel_layouts=stereo,${shift}atrim=${from}:${(from + len).toFixed(3)},asetpts=PTS-STARTPTS,${eq}volume=${b.db.toFixed(2)}dB,afade=t=in:d=${fi},afade=t=out:st=${(len - fo).toFixed(3)}:d=${fo},adelay=${ms}|${ms}[b${n}]`);
      labels.push(`[b${n}]`);
    });
    bedBus.f.push(`${anchor(bedBus.f)}${labels.join("")}amix=inputs=${labels.length + 1}:normalize=0:duration=first,equalizer=f=2200:t=o:w=1.6:g=-5[bedsum]`);
    bedBus.f.push(KEY);
    bedBus.f.push(`[bedsum][key]sidechaincompress=threshold=0.02:ratio=${ratio(opt(plan.bedDuck, 6, "bedDuck"))}:attack=15:release=400:makeup=1[out]`);
  } else bedBus.f.push(...silentBus("[out]"));

  // ── hits
  const sfxBus = { inputs: ["-i", VO], f: [] };
  const ducked = [];
  const free = [];
  hits.forEach((h, j) => {
    const n = j + 1;
    const p = `hits[${h.i}]`;
    const rate = Math.pow(2, h.st / 12);
    const from = opt(h.from, 0, `${p}.from`);
    // A build placed by its peak: the peak is `sync` into the file, `from` nearer, and pitch moves it by the rate.
    const lead = h.align === "sync" ? Math.max(0, h.sync - from) / rate : 0;
    const t = Math.max(0, h.t0 - lead);
    const ms = Math.round(t * 1000);
    sfxBus.inputs.push("-i", h.file);
    const c = [`aresample=${SR}`, "aformat=channel_layouts=stereo"];
    if (from) c.push(`atrim=start=${from}`, "asetpts=PTS-STARTPTS");
    if (h.st) c.push(`asetrate=${Math.round(SR * rate)}`, `aresample=${SR}`);
    if (h.hp !== undefined) c.push(`highpass=f=${h.hp}`);
    if (h.lp !== undefined) c.push(`lowpass=f=${h.lp}`);
    if (h.fadeIn) c.push(`afade=t=in:d=${h.fadeIn}`);
    if (h.until !== undefined) {
      const len = Math.max(0.013, at(h.until, `${p}.until`) + opt(h.untilOffset, 0, `${p}.untilOffset`) - t);
      const fd = Math.min(len, opt(h.fade, 0.012, `${p}.fade`));
      c.push(`atrim=0:${len.toFixed(4)}`, `afade=t=out:st=${(len - fd).toFixed(4)}:d=${fd.toFixed(4)}`);
      h.cut = len;
    }
    if (h.pan) {
      // Equal power, kept inside ±0.6 so a phone's one speaker loses nothing of it.
      const q = Math.max(-0.6, Math.min(0.6, h.pan));
      const a = ((q + 1) * Math.PI) / 4;
      c.push(`pan=stereo|c0=${(Math.cos(a) * Math.SQRT2).toFixed(3)}*c0|c1=${(Math.sin(a) * Math.SQRT2).toFixed(3)}*c1`);
    }
    c.push(`volume=${h.db.toFixed(2)}dB`, `adelay=${ms}|${ms}`);
    h.start = t;
    sfxBus.f.push(`[${n}:a]${c.join(",")}[h${n}]`);
    (h.duck === false ? free : ducked).push(`[h${n}]`);
  });
  sfxBus.f.push(`${ducked.length ? `${anchor(sfxBus.f)}${ducked.join("")}amix=inputs=${ducked.length + 1}:normalize=0:duration=first` : `anullsrc=r=${SR}:cl=stereo,atrim=0:${full}`}[hitsum]`);
  sfxBus.f.push(KEY);
  sfxBus.f.push(`[hitsum][key]sidechaincompress=threshold=0.02:ratio=${ratio(opt(plan.sfxDuck, 3, "sfxDuck"))}:attack=5:release=180:makeup=1[duck]`);
  if (free.length) {
    sfxBus.f.push(`${anchor(sfxBus.f)}${free.join("")}amix=inputs=${free.length + 1}:normalize=0:duration=first[freesum]`);
    sfxBus.f.push(`[duck][freesum]amix=inputs=2:normalize=0:duration=first[out]`);
  } else sfxBus.f.push(`[duck]anull[out]`);

  // ── stems: one ffmpeg run a bus (they share nothing, so none can wait on another), then each folded or cut
  try {
    run(["-i", VO, "-filter_complex", `anullsrc=r=${SR}:cl=stereo,atrim=0:${full}[s];[0:a]aresample=${SR},aformat=channel_layouts=stereo[v];[s][v]amix=inputs=2:normalize=0:duration=first[out]`, "-map", "[out]", "-c:a", "pcm_f32le", join(stems, ".vo.wav")]);
    for (const [k, bus] of Object.entries({ music, sfx: sfxBus, beds: bedBus })) {
      run([...bus.inputs, "-filter_complex", bus.f.join(";"), "-map", "[out]", "-c:a", "pcm_f32le", join(stems, `.${k}.wav`)]);
    }
    for (const k of ["vo", "music", "sfx", "beds"]) {
      const src = join(stems, `.${k}.wav`);
      const out = join(stems, `${k}.wav`);
      // A loop's soundtrack is circular: what sounds past the end is folded back onto the head instead of cut.
      if (loop) run(["-i", src, "-i", src, "-filter_complex", `[0:a]atrim=0:${dur},asetpts=PTS-STARTPTS[h];[1:a]atrim=${dur}:${dur + TAIL},asetpts=PTS-STARTPTS[t];[h][t]amix=inputs=2:normalize=0:duration=first[o]`, "-map", "[o]", "-c:a", "pcm_f32le", out]);
      else run(["-i", src, "-af", `atrim=0:${dur}`, "-c:a", "pcm_f32le", out]);
      rmSync(src);
    }
  } finally {
    rmSync(VO, { force: true });
  }

  // ── the master: one gain to the target; a limiter takes only the peaks that gain pushes past the ceiling
  const stemIn = ["vo", "music", "sfx", "beds"].flatMap((k) => ["-i", join(stems, `${k}.wav`)]);
  const sum = `[0:a][1:a][2:a][3:a]amix=inputs=4:normalize=0:duration=first`;
  const before = ebur128(stemIn, `${sum}[pre]`);
  if (!Number.isFinite(before.I)) throw new Error("the mix is silent: nothing to level");
  // Voiced or not, the master reaches the target: a voice-free film carries its loudness in its music and backgrounds,
  // and the limiter takes the peaks of the hits over them. The limiter works on an oversampled signal, so the true
  // peak is caught where it forms; if one still slips past the ceiling, the ceiling comes down, never the loudness.
  let ceiling = target.TP - 0.3;
  let gain = target.I - before.I;
  let chain = "";
  let after = before;
  for (let i = 0; i < 8; i++) {
    const lim = Math.pow(10, ceiling / 20).toFixed(4);
    chain = `volume=${gain.toFixed(2)}dB,aresample=${OVERSAMPLE},alimiter=level_in=1:level_out=1:limit=${lim}:attack=1:release=80:level=disabled,aresample=${SR}`;
    after = ebur128(stemIn, `${sum},${chain}[pre]`);
    const over = after.TP - target.TP;
    if (over > 0.05) ceiling -= over + 0.1;
    const short = target.I - after.I;
    if (over <= 0.05 && Math.abs(short) <= 0.15) break;
    gain += short;
  }
  const capped = after.I < target.I - 1;
  run([...stemIn, "-filter_complex", `${sum},${chain}[o]`, "-map", "[o]", "-c:a", "pcm_s16le", join(dir, "mix.wav")]);

  const r3 = (v) => +v.toFixed(3);
  const played = {
    voice: { typ: +voice.typ.toFixed(1), peak: +voice.peak.toFixed(1), ...(voice.nominal ? { nominal: true } : {}) },
    target,
    after: { I: after.I, TP: after.TP, ...(capped ? { capped: true } : {}) },
    dur,
    loop,
    hits: hits.map((h) => ({ t: r3(h.start), sound: h.sound ?? h.sfx, take: h.take, db: +h.db.toFixed(1), under: h.under, len: h.cut !== undefined ? r3(Math.min(h.len, h.cut)) : h.len, until: h.until, _: h._ })),
    beds: beds.map((b) => ({ sound: b.sound, from: r3(b.start), to: r3(b.end), under: b.under, _: b._ })),
    dips: plan.music?.dips ?? [],
  };
  writeFileSync(join(stems, "played.json"), JSON.stringify(played, null, 1) + "\n");
  const takes = new Set(hits.map((h) => h.take)).size;
  return (
    `mix.wav: ${hits.length} hits from ${takes} files, ${beds.length} backgrounds, ${segs.length} music segments; ` +
    `${voiced ? `voice typical ${voice.typ.toFixed(1)} LKFS` : "no voice (levelled against a nominal one)"}; ` +
    `before ${before.I} LUFS / ${before.TP} dBTP; after ${after.I} LUFS / ${after.TP} dBTP (target ${target.I} / ${target.TP})` +
    (capped ? "; still more than 1 LU under the target after eight passes: the limiter could not hold the ceiling at that loudness" : "")
  );
}

/** The voice's typical level (median of its 400 ms windows while it speaks) and its sample peak, in dB. */
function measureVoice(file) {
  const ch = decode(file);
  const moments = windows400(ch).filter((v) => v > -40).sort((a, b) => a - b);
  let pk = 0;
  for (const c of ch) for (const v of c) pk = Math.max(pk, Math.abs(v));
  if (!moments.length) return { ...NOMINAL, nominal: true };
  return { typ: moments[Math.floor(moments.length / 2)], peak: 20 * Math.log10(pk + 1e-9) };
}

function checkHit(h, p) {
  for (const k of ["pitch", "pan", "hp", "lp", "from", "fadeIn", "gain", "under", "var"]) if (h[k] !== undefined) num(h[k], `${p}.${k}`);
  if (h.align !== undefined && h.align !== "sync") throw new Error(`${p}.align is "sync" or absent, got ${JSON.stringify(h.align)}`);
  if (h.duck !== undefined && typeof h.duck !== "boolean") throw new Error(`${p}.duck is true or false`);
  if ((h.sfx === undefined) === (h.sound === undefined)) throw new Error(`${p} names one of "sound" (an id) or "sfx" (a film's own file)`);
}
function num(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a finite number, got ${JSON.stringify(value)}`);
  return value;
}
function safeName(name, field) {
  if (typeof name !== "string" || !NAME.test(name)) throw new Error(`${field} must be a bare name such as pop or bed.mp3 (letters, digits, _ and -), got ${JSON.stringify(name)}`);
  return name;
}
/** The first existing file for `name` in `folders`: as given when it has an extension, else .wav, .flac, .mp3. */
function lookup(name, folders) {
  const files = /\.(wav|mp3|flac)$/.test(name) ? [name] : [`${name}.wav`, `${name}.flac`, `${name}.mp3`];
  for (const folder of folders) for (const file of files) if (existsSync(join(folder, file))) return join(folder, file);
  return null;
}
class Usage extends Error {}

// Run as a command, but stay importable (mix.mjs hands a version-2 sheet over through main()).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (e) {
    console.error(e instanceof Usage ? USAGE : `mix2.mjs: ${e.message}`);
    process.exit(e instanceof Usage ? 2 : 1);
  }
}
