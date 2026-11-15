#!/usr/bin/env node
// A film's sound, measured against `sound.md`. Nobody hears anything here: every line is a measurement, and the
// person's full-speed listen is still the only judgement of how the film sounds.
//
//   node <skill>/tools/soundcheck.mjs <audio-dir> [--library <dir>] [--sfx <dir>]
//
// Reads what mix2.mjs wrote (mix.wav, stems/*.wav, stems/played.json). Prints one line a rule, `ok` or `FAIL`, then
// the lists a director reads: the long sounds with their starts and ends (a sound ends when its thing leaves the
// frame), the planned silences. Exits 1 when a rule fails, 2 on wrong use.
//
// A film with no voice has nothing to set the levels against: the rules that read the voice say `--` and why.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SR, decode, ebur128, meanLevel, sounds, windows400 } from "./sound-lib.mjs";

export function check(dir, { library, kit } = {}) {
  dir = resolve(dir);
  const playedFile = join(dir, "stems/played.json");
  if (!existsSync(playedFile)) throw new Error(`no ${playedFile}: mix the film with a version-2 sheet first (mix.mjs)`);
  const P = JSON.parse(readFileSync(playedFile, "utf8"));
  const lines = [];
  const fails = [];
  const rule = (ok, text) => {
    lines.push(`${ok ? "ok    " : "FAIL  "}${text}`);
    if (!ok) fails.push(text);
  };
  const skip = (text) => lines.push(`--    ${text}`);
  const st = Object.fromEntries(["vo", "music", "sfx", "beds"].map((k) => [k, decode(join(dir, `stems/${k}.wav`))]));
  const n = Math.min(...Object.values(st).map((c) => c[0].length));
  for (const k of Object.keys(st)) st[k] = st[k].map((c) => c.subarray(0, n));
  const mix = decode(join(dir, "mix.wav")).map((c) => c.subarray(0, n));
  const dur = n / SR;
  const voiced = !P.voice?.nominal;
  const vo = windows400(st.vo);
  const speaking = vo.map((v) => v > -40);
  const spokenShare = speaking.filter(Boolean).length / Math.max(1, speaking.length);
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const typ = voiced ? median(vo.filter((_, i) => speaking[i])) : null;
  lines.push(voiced ? `voice: typical ${typ.toFixed(1)} LKFS (400 ms windows while it speaks), ${(spokenShare * 100).toFixed(0)} % of the film` : "voice: none (the levels were set against a nominal voice)");
  lines.push("");

  // 1 the master
  const m = ebur128(["-i", join(dir, "mix.wav")]);
  const tgt = P.target ?? { I: -14, TP: -1 };
  if (voiced) rule(Math.abs(m.I - tgt.I) <= 0.5 && m.TP <= tgt.TP + 0.05, `master ${m.I} LUFS integrated, ${m.TP} dBTP, range ${m.LRA} LU (target ${tgt.I} LUFS, at most ${tgt.TP} dBTP)`);
  else rule(m.I <= tgt.I + 0.5 && m.TP <= tgt.TP + 0.05, `master ${m.I} LUFS integrated, ${m.TP} dBTP (no voice: at most ${tgt.I} LUFS and ${tgt.TP} dBTP; quieter is allowed)`);
  // How hard the limiter works: the summed stems at the master's gain, against the ceiling, in 10 ms blocks.
  const pre = [0, 1].map((c) => Float64Array.from(st.vo[c], (v, i) => v + st.music[c][i] + st.sfx[c][i] + st.beds[c][i]));
  const g = Math.pow(10, (m.I - meanLevel(pre)) / 20);
  const ceil = Math.pow(10, (tgt.TP - 0.6) / 20);
  let overBlocks = 0, worst = -Infinity, blocks = 0;
  for (let b = 0; b + 480 <= n; b += 480, blocks++) {
    let pk = 0;
    for (let i = b; i < b + 480; i++) pk = Math.max(pk, Math.abs(pre[0][i]), Math.abs(pre[1][i]));
    const over = 20 * Math.log10((pk * g) / ceil + 1e-12);
    if (over > 0) overBlocks++;
    worst = Math.max(worst, over);
  }
  const share = (100 * overBlocks) / Math.max(1, blocks);
  rule(share < 5 && worst < 6, `the limiter: ${share.toFixed(1)} % of 10 ms blocks are over the ceiling before it, the worst by ${Math.max(0, worst).toFixed(1)} dB (under 5 % and under 6 dB, or the voice needs levelling first)`);
  let both = 0, one = 0;
  for (let i = 0; i < n; i++) {
    const s = (mix[0][i] + mix[1][i]) / 2;
    one += s * s;
    both += (mix[0][i] ** 2 + mix[1][i] ** 2) / 2;
  }
  const loss = 10 * Math.log10(one / (both + 1e-12) + 1e-12);
  rule(loss > -1, `mono fold-down loses ${Math.abs(loss).toFixed(2)} dB (at most 1 dB: a phone held upright is one speaker)`);

  // 2-4 the music, the effects and the backgrounds against the voice
  const hasMusic = windows400(st.music).some((v) => v > -70);
  const fx = windows400(st.sfx, { phone: true });
  const bd = windows400(st.beds, { phone: true });
  if (!voiced) skip("music, effects and backgrounds against the voice: there is no voice to read them against");
  else {
    if (hasMusic) {
      const mu = windows400(st.music);
      const under = median(vo.map((v, i) => v - mu[i]).filter((_, i) => speaking[i]));
      rule(under >= 15 && under <= 22, `music sits ${under.toFixed(1)} dB under the voice while it speaks (15 to 20; 22 at most)`);
    } else skip("music under the voice: the film has no music");
    let wi = 0;
    for (let i = 1; i < fx.length; i++) if (fx[i] > fx[wi]) wi = i;
    const loudest = fx[wi] - typ;
    rule(loudest <= -5, `the loudest 400 ms of effects is ${Math.abs(loudest).toFixed(1)} dB under the voice's typical level, at ${(wi * 0.1).toFixed(1)} s (5 dB at least; a hero hit sits 6 to 9 under)`);
    const underSpeech = fx.map((v) => v - typ).filter((_, i) => speaking[i]).sort((a, b) => a - b);
    const p90 = underSpeech.length ? underSpeech[Math.floor(0.9 * (underSpeech.length - 1))] : -99;
    rule(p90 <= -11, `under speech, nine tenths of the time the effects are at least ${Math.abs(p90).toFixed(1)} dB under the voice (11 at least)`);
    const bw = Math.max(...bd) - typ;
    rule(bw <= -12, `the loudest 400 ms of the backgrounds is ${Math.abs(bw).toFixed(1)} dB under the voice (12 at least: a long sound stays under the voice)`);
  }

  // 5 variety and density
  const hits = P.hits ?? [];
  const lib = sounds({ audio: dir, ...(library ? { library } : {}), ...(kit ? { kit } : {}) });
  if (hits.length) {
    const files = {};
    for (const h of hits) files[h.take] = (files[h.take] ?? 0) + 1;
    const [topFile, topCount] = Object.entries(files).sort((a, b) => b[1] - a[1])[0];
    // 8 % of the hits at most; in a film of fewer than 25 hits, twice (8 % of a dozen hits is less than one use).
    const most = Math.max(2, Math.floor(0.08 * hits.length));
    rule(topCount <= most, `${hits.length} hits from ${Object.keys(files).length} files in ${new Set(hits.map((h) => h.sound)).size} sounds; the most used file is ${topFile} with ${topCount} (${((100 * topCount) / hits.length).toFixed(0)} %; 8 % at most, or twice in a film of fewer than 25 hits)`);
    // A sound whose entry says `"repeat": true` (a counter, the quietest blip) is meant to run in a row.
    const repeats = (h) => typeof h.sound === "string" && h.sound.includes("/") && lib.get(h.sound)?.repeat;
    const rep = hits.filter((a, i) => hits[i + 1] && a.take === hits[i + 1].take && hits[i + 1].t - a.t < 1 && !repeats(a));
    rule(rep.length === 0, `the same file twice within a second: ${rep.length}${rep.length ? `: ${rep.slice(0, 6).map((h) => `${h.t.toFixed(1)}s ${h.take}`).join(", ")}` : ""}`);
    const per = new Array(Math.floor(dur) + 1).fill(0);
    for (const h of hits) per[Math.min(per.length - 1, Math.floor(h.t))]++;
    const dense = Math.max(...per);
    rule(dense <= 7, `the densest second has ${dense} hits (at ${per.indexOf(dense)} s; 7 at most), ${(hits.length / dur).toFixed(1)} a second on average; seconds with none: ${per.filter((x) => x === 0).length}`);
    const heroes = hits.filter((h) => (h.under ?? 99) <= 8);
    const allowed = Math.max(6, Math.round((6 * dur) / 60));
    rule(heroes.length <= allowed, `hero hits (8 dB under the voice or closer): ${heroes.length} (${allowed} at most: six a minute)${heroes.length ? `: ${heroes.map((h) => `${h.t.toFixed(1)}s ${h.sound}`).join(", ")}` : ""}`);
    // 6 the phone: a hero hit that loses more than 6 dB without its low end needs a second layer on the same moment
    const weak = heroes.filter((h) => {
      const s = typeof h.sound === "string" && h.sound.includes("/") ? lib.get(h.sound) : null;
      const v = s?.variants.find((x) => x.file.endsWith(h.take));
      return v && v.loud - (v.phone ?? v.loud) > 6 && !hits.some((o) => o !== h && Math.abs(o.t - h.t) < 0.05);
    });
    rule(!weak.length, `hero hits that lose more than 6 dB on a phone and have no second layer: ${weak.map((h) => `${h.t.toFixed(1)}s ${h.sound}`).join(", ") || "none"}`);
  } else skip("variety, density and hero hits: no hits");

  // the lists
  lines.push("", "long sounds (over 1 s): start, end, what it is the sound of");
  for (const b of P.beds ?? []) lines.push(`  ${b.from.toFixed(2).padStart(6)}–${b.to.toFixed(2).padStart(6)}  ${String(b.sound).padEnd(18)} ${b._ ?? ""}`);
  for (const h of hits) if ((h.len ?? 0) > 1) lines.push(`  ${h.t.toFixed(2).padStart(6)}–${(h.t + h.len).toFixed(2).padStart(6)}  ${String(h.sound).padEnd(18)} ${h._ ?? ""}${h.until !== undefined ? "  (cut at its `until`)" : ""}`);
  lines.push("planned silences (the music dips):");
  for (const d of P.dips ?? []) lines.push(`  ${d.at} ${d.offset >= 0 || d.offset === undefined ? "+" : ""}${(d.offset ?? 0).toFixed(2)} s for ${d.len} s by ${d.db} dB  ${d._ ?? ""}`);
  lines.push("", fails.length ? `${fails.length} rule(s) failed` : "all rules pass");
  return { ok: !fails.length, text: lines.join("\n") };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const flag = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
  const dir = args.find((a, i) => !a.startsWith("--") && !["--library", "--sfx"].includes(args[i - 1]));
  if (!dir) {
    console.error("usage: soundcheck.mjs <audio-dir> [--library <dir>] [--sfx <dir>]");
    process.exit(2);
  }
  try {
    const r = check(dir, { library: flag("library") && resolve(flag("library")), kit: flag("sfx") && resolve(flag("sfx")) });
    console.log(r.text);
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`soundcheck.mjs: ${e.message}`);
    process.exit(2);
  }
}
