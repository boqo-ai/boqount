// What the sound tools share: reading and writing audio through ffmpeg, the filters and measurements they are built
// on, and where a sound id's files are. No npm dependency: the numbers are worked out here, in JavaScript, and ffmpeg
// (run with an argument array, never through a shell) only decodes, encodes and mixes.
//
// The measurements (the same ones the library's manifest keeps for every take, `film.md` → Sound):
//   loud    its loudest 400 ms, K-weighted (ITU-R BS.1770), in LKFS
//   phone   the same with everything under 200 Hz removed: what a phone's speaker plays
//   sync    where its 10 ms envelope peaks, in seconds (the mixer can put that point on the cue)
//   dur     its length; attack: its first 40 ms against its peak (far under 0: it starts late)
//   low     the share of its energy under 150 Hz (a phone does not play it); voice: the share at 1-4 kHz
//   centroid  its brightness in Hz; corr: left against right (under 0 loses level on one speaker)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SR = 48000;
const TAU = Math.PI * 2;

/** A sound id: `<group>/<name>`, lower case. A bare name (the kit's, a film's own) is letters, digits, _ and -. */
export const ID = /^[a-z0-9_-]+\/[a-z0-9_-]+$/;
export const NAME = /^[A-Za-z0-9_-]+(\.(wav|mp3|flac))?$/;

/** Runs ffmpeg with an argument array. Returns { stdout, stderr }; throws with the tail of stderr on failure. */
export function ffmpeg(argv, { input, timeout } = {}) {
  const r = spawnSync("ffmpeg", ["-nostdin", ...argv], { input, maxBuffer: 1 << 30, timeout });
  if (r.error) throw new Error(r.error.code === "ETIMEDOUT" ? `ffmpeg did not finish in ${timeout / 1000} s` : `could not run ffmpeg: ${r.error.message}`);
  const stderr = r.stderr.toString("utf8");
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${stderr.trim().split("\n").slice(-6).join(" | ")}`);
  return { stdout: r.stdout, stderr };
}

/** A file as two Float32Array channels at 48 kHz. */
export function decode(path) {
  const { stdout } = ffmpeg(["-v", "error", "-i", path, "-ac", "2", "-ar", String(SR), "-f", "f32le", "-"]);
  const all = new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.length));
  const n = all.length / 2;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) (L[i] = all[2 * i]), (R[i] = all[2 * i + 1]);
  return [L, R];
}

/** Writes two channels (or one, doubled) to `path`: .flac, else 16-bit .wav. */
export function writeAudio(path, channels) {
  const [L, R = channels[0]] = channels;
  const buf = new Float32Array(L.length * 2);
  for (let i = 0; i < L.length; i++) (buf[2 * i] = L[i]), (buf[2 * i + 1] = R[i]);
  const codec = path.endsWith(".flac") ? ["-c:a", "flac", "-sample_fmt", "s16"] : ["-c:a", "pcm_s16le"];
  ffmpeg(["-v", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", "pipe:0", ...codec, path], { input: Buffer.from(buf.buffer) });
}

// ---------------------------------------------------------------- filters

/** A biquad (RBJ cookbook) as { b, a }, normalised so a[0] = 1. */
export function biquad(type, f, q = Math.SQRT1_2) {
  const w = (TAU * f) / SR;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b = type === "lowpass" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  return { b: b.map((x) => x / a0), a: [1, (-2 * cos) / a0, (1 - alpha) / a0] };
}
/** `x` through the filter { b, a } (direct form I), as a new Float64Array. */
export function filter({ b, a }, x) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    (x2 = x1), (x1 = x[i]), (y2 = y1), (y1 = v), (y[i] = v);
  }
  return y;
}
const chain = (stages, x) => stages.reduce((s, st) => filter(st, s), x);
/** The K-weighting of ITU-R BS.1770 at 48 kHz: the head's shelf, then the high-pass. */
const K = [
  { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] },
  { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] },
];
export const kweight = (x) => chain(K, x);
/** A fourth-order Butterworth high-pass at `f` (two biquads): what a phone's speaker leaves out under 200 Hz. */
export const highpass4 = (x, f = 200) => chain([biquad("highpass", f, 0.5412), biquad("highpass", f, 1.3066)], x);

// ---------------------------------------------------------------- measurements

/** The K-weighted level of every 400 ms window, one reading each `hop` seconds, in LKFS (both channels summed). */
export function windows400(channels, { hop = 0.1, phone = false } = {}) {
  const n = Math.round(0.4 * SR);
  const h = Math.round(hop * SR);
  const len = channels[0].length;
  const sq = new Float64Array(len);
  for (const c of channels) {
    const k = kweight(phone ? highpass4(c) : c);
    for (let i = 0; i < len; i++) sq[i] += k[i] * k[i];
  }
  const cum = new Float64Array(len + 1);
  for (let i = 0; i < len; i++) cum[i + 1] = cum[i] + sq[i];
  const out = [];
  for (let i = 0; i + n <= len; i += h) out.push(-0.691 + 10 * Math.log10((cum[i + n] - cum[i]) / n + 1e-12));
  if (!out.length) out.push(-0.691 + 10 * Math.log10(cum[len] / n + 1e-12)); // shorter than 400 ms: one window, padded
  return out;
}
/** The loudest 400 ms in LKFS. */
export const loud400 = (channels, opts) => Math.max(...windows400(channels, { hop: 0.01, ...opts }));
/** Ungated mean K-weighted level of the whole signal (LKFS). */
export function meanLevel(channels) {
  let s = 0;
  for (const c of channels) for (const v of kweight(c)) s += v * v;
  return -0.691 + 10 * Math.log10(s / channels[0].length + 1e-12);
}
/** A moving RMS envelope over `ms`. */
export function envelope(m, ms = 10) {
  const n = Math.max(1, Math.round((SR * ms) / 1000));
  const out = new Float64Array(m.length);
  let s = 0;
  for (let i = 0; i < m.length; i++) {
    s += m[i] * m[i];
    if (i >= n) s -= m[i - n] * m[i - n];
    out[Math.max(0, i - (n >> 1))] = Math.sqrt(Math.max(0, s) / n);
  }
  return out;
}
export const mono = ([L, R = L]) => Float64Array.from(L, (v, i) => (v + R[i]) / 2);
const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** In-place iterative radix-2 FFT of (re, im), whose length is a power of two. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j], re[i], im[j], im[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
        const tr = ar * wr - ai * wi, ti = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k] - tr;
        im[i + k + len / 2] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
    }
  }
}
/** The power spectrum of `m` (Hann-windowed, zero-padded to a power of two) and each bin's frequency. */
export function spectrum(m, rate = SR) {
  let n = 1;
  while (n < m.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < m.length; i++) re[i] = m[i] * (0.5 - 0.5 * Math.cos((TAU * i) / Math.max(1, m.length - 1)));
  fft(re, im);
  const power = new Float64Array(n / 2), freq = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) (power[i] = re[i] * re[i] + im[i] * im[i]), (freq[i] = (i * rate) / n);
  return { power, freq };
}

/** The manifest's numbers for one take (see the head of this file). */
export function measure(channels) {
  const m = mono(channels);
  const e = envelope(m);
  let at = 0;
  for (let i = 1; i < e.length; i++) if (e[i] > e[at]) at = i;
  const { power, freq } = spectrum(m);
  let tot = 1e-20, low = 0, voice = 0, cen = 0;
  for (let i = 0; i < power.length; i++) {
    tot += power[i];
    cen += power[i] * freq[i];
    if (freq[i] < 150) low += power[i];
    else if (freq[i] >= 1000 && freq[i] < 4000) voice += power[i];
  }
  const pk = peakOf(m) + 1e-9;
  const head = peakOf(m.subarray(0, Math.round(0.04 * SR))) + 1e-9;
  const [L, R = L] = channels;
  const corr = correlation(L, R);
  const r1 = (v) => Math.round(v * 10) / 10;
  const peak = Math.max(peakOf(L), peakOf(R));
  return {
    dur: +(m.length / SR).toFixed(3),
    peak: r1(20 * Math.log10(peak + 1e-9)),
    sync: +(at / SR).toFixed(3),
    loud: r1(loud400(channels)),
    phone: r1(loud400(channels, { phone: true })),
    low: +(low / tot).toFixed(3),
    voice: +(voice / tot).toFixed(3),
    centroid: Math.round(cen / tot),
    attack: r1(20 * Math.log10(head / pk)),
    corr: +corr.toFixed(2),
  };
}
function correlation(a, b) {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) (ma += a[i]), (mb += b[i]);
  ma /= a.length || 1;
  mb /= b.length || 1;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    (sab += x * y), (saa += x * x), (sbb += y * y);
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 1;
}

/** Integrated loudness, true peak and loudness range as ffmpeg's ebur128 measures them. */
export function ebur128(inputArgs, graph) {
  const af = graph ? ["-filter_complex", `${graph};[pre]ebur128=peak=true[o]`, "-map", "[o]"] : ["-af", "ebur128=peak=true"];
  const { stderr } = ffmpeg(["-hide_banner", "-nostats", ...inputArgs, ...af, "-f", "null", "-"]);
  const tail = stderr.slice(stderr.lastIndexOf("Summary:"));
  const read = (re) => {
    const v = re.exec(tail)?.[1];
    return v === "-inf" ? -Infinity : Number(v);
  };
  return { I: read(/I:\s+(-?[\d.]+|-inf) LUFS/), TP: read(/Peak:\s+(-?[\d.]+|-inf) dBFS/), LRA: read(/LRA:\s+(-?[\d.]+) LU/) };
}

/** mulberry32: a seeded generator of floats in [0, 1), so a synthesized sound is the same bytes every run. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- where a sound's files are

/**
 * A resolver for a film's sound ids. `audio` is the film's audio folder; `library` (default <audio>/../../sounds)
 * holds library.json and library/; `kit` (default <audio>/../../sfx) the synthesized kit.
 *   tone/<name>   the film's tonal set, <audio>/tone/tone.json (soundlib.mjs tone)
 *   kit/<name>    a kit sound, <kit>/<name>.wav: the no-key fallback, measured when first used
 *   <group>/<name> a library sound, by library.json
 * get(id) returns { kind, use, repeat, variants: [{ file (absolute), dur, sync, loud, phone, ... }] } or null.
 */
export function sounds({ audio, library = join(audio, "../../sounds"), kit = join(audio, "../../sfx") }) {
  const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
  const lib = readJson(join(library, "library.json"))?.sounds ?? {};
  const tone = readJson(join(audio, "tone/tone.json"))?.sounds ?? {};
  const cache = new Map();
  const absolute = (s, base) => ({ ...s, variants: (s.variants ?? []).map((v) => ({ ...v, file: join(base, v.file) })) });
  return {
    library,
    get(id) {
      if (cache.has(id)) return cache.get(id);
      let s = null;
      if (id.startsWith("tone/") && tone[id]) s = absolute(tone[id], join(audio, "tone"));
      else if (id.startsWith("kit/")) {
        const file = join(kit, `${id.slice(4)}.wav`);
        if (existsSync(file)) s = { kind: "hit", use: "the synthesized kit", repeat: ["tick", "typing"].includes(id.slice(4)), variants: [{ file, ...measure(decode(file)) }] };
      } else if (lib[id]) s = absolute(lib[id], join(library, "library"));
      cache.set(id, s);
      return s;
    },
    /** The numbers of any file (a film's own sound), measured once. */
    file(path) {
      if (!cache.has(path)) cache.set(path, { kind: "hit", variants: [{ file: path, ...measure(decode(path)) }] });
      return cache.get(path);
    },
  };
}
