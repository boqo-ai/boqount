#!/usr/bin/env node
// The film pipeline's sound kit, synthesized here: sixteen short mono WAV files that tools/mix.mjs places on a film's
// cues. No recording is shipped and no download is made; every sound is sines, filtered noise and envelopes.
//
//   node <skill>/tools/sfx-kit.mjs --out <dir>
//
// Writes <dir>/<name>.wav (48 kHz, mono, 16-bit) for pop, pop_hi, tick, tap, blip, ding, whoosh, whoosh_big, rise,
// drop, stamp, typing, sparkle, error, lock and toggle. The same bytes every run: the noise comes from a small seeded
// generator, never Math.random. Each sound fades in over 1.5 ms and out over 8 ms (no click at either end) and is
// scaled to its own peak, below full scale, so the mixer's per-hit gains behave the same for every name.
// Prints one JSON line {"out", "files"} and exits 0, or exits 1 with {"error": …}.
// The sounds are clean and distinct rather than realistic. The tests are tests/sfx-kit.test.mjs.
import { mkdir, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 48000;
const TAU = Math.PI * 2;
const USAGE = "usage: sfx-kit.mjs --out <dir>";

// ---------------------------------------------------------------- building blocks

/** mulberry32: a 32-bit seeded generator returning floats in [0, 1). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (text) => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
const silence = (sec) => new Float64Array(Math.round(sec * RATE));
const white = (rng) => rng() * 2 - 1;
/** exp(-t / tau), the usual decay. */
const decay = (t, tau) => Math.exp(-t / tau);

/** Adds `partial(t)` (t in seconds since `start`) to `out` from `start` for `dur` seconds. */
function add(out, start, dur, partial) {
  const i0 = Math.round(start * RATE);
  const n = Math.round(dur * RATE);
  for (let k = 0; k < n && i0 + k < out.length; k++) out[i0 + k] += partial(k / RATE, k);
}
/** A sine whose frequency runs exponentially from f0 to f1 over `dur`, shaped by amp(t). */
function sweep(out, start, dur, f0, f1, amp) {
  let phase = 0;
  add(out, start, dur, (t) => {
    phase += (TAU * f0 * Math.pow(f1 / f0, t / dur)) / RATE;
    return Math.sin(phase) * amp(t);
  });
}
/** A sine at fixed frequency with a decaying envelope. */
const ping = (out, start, dur, f, tau, level = 1) => add(out, start, dur, (t) => Math.sin(TAU * f * t) * decay(t, tau) * level);
/** A short burst of white noise, one-pole high-passed (a click) when `hp` is set, low-passed when `lp` is set. */
function burst(out, rng, start, dur, tau, level, { hp, lp } = {}) {
  let low = 0;
  let lpState = 0;
  const kHp = hp ? 1 - Math.exp((-TAU * hp) / RATE) : 0;
  const kLp = lp ? 1 - Math.exp((-TAU * lp) / RATE) : 1;
  add(out, start, dur, (t) => {
    let x = white(rng);
    if (hp) {
      low += kHp * (x - low);
      x -= low;
    }
    lpState += kLp * (x - lpState);
    return lpState * decay(t, tau) * level;
  });
}
/** White noise through a band-pass whose centre runs along `centre(t)` (Hz), shaped by amp(t). */
function sweptNoise(out, rng, start, dur, centre, q, amp) {
  let low = 0;
  let band = 0;
  add(out, start, dur, (t) => {
    const f = 2 * Math.sin((Math.PI * Math.min(centre(t), 7000)) / RATE);
    low += f * band;
    const high = white(rng) - low - band / q;
    band += f * high;
    return band * amp(t);
  });
}
const bump = (t, dur) => Math.sin(Math.PI * Math.min(1, t / dur)) ** 2; // 0 → 1 → 0 over dur

// ---------------------------------------------------------------- the sixteen sounds
// Each entry: length in seconds, peak (fraction of full scale), and the synthesis.

const SOUNDS = {
  // Soft round pop: a sine dropping in pitch, gone in a few tens of milliseconds.
  pop: { sec: 0.09, peak: 0.85, make: (o) => sweep(o, 0, 0.07, 720, 190, (t) => decay(t, 0.02)) },
  pop_hi: { sec: 0.08, peak: 0.8, make: (o) => sweep(o, 0, 0.065, 1500, 520, (t) => decay(t, 0.017)) },
  // Tick and tap: the shortest clicks, one bright and dry, one low and padded.
  tick: {
    sec: 0.03,
    peak: 0.8,
    make: (o, rng) => {
      burst(o, rng, 0, 0.025, 0.0015, 0.9, { hp: 1800 });
      ping(o, 0, 0.025, 2600, 0.004, 0.6);
    },
  },
  tap: {
    sec: 0.045,
    peak: 0.85,
    make: (o, rng) => {
      ping(o, 0, 0.04, 190, 0.009);
      burst(o, rng, 0, 0.012, 0.003, 0.5, { lp: 1400 });
    },
  },
  // Two quick steps up in pitch.
  blip: {
    sec: 0.075,
    peak: 0.7,
    make: (o) => {
      add(o, 0, 0.035, (t) => Math.sin(TAU * 988 * t) * bump(t, 0.035));
      add(o, 0.035, 0.035, (t) => Math.sin(TAU * 1318 * t) * bump(t, 0.035));
    },
  },
  // Bell: a fundamental and two inharmonic partials, each fading at its own rate.
  ding: {
    sec: 0.95,
    peak: 0.8,
    make: (o) => {
      ping(o, 0, 0.95, 1320, 0.28, 1);
      ping(o, 0, 0.7, 1320 * 2.76, 0.12, 0.45);
      ping(o, 0, 0.4, 1320 * 5.4, 0.05, 0.2);
    },
  },
  // Air passing: band-passed noise whose centre rises and falls under a smooth swell.
  whoosh: {
    sec: 0.45,
    peak: 0.7,
    make: (o, rng) => sweptNoise(o, rng, 0, 0.45, (t) => 350 * Math.pow(8, Math.sin((Math.PI * t) / 0.45)), 2.5, (t) => bump(t, 0.45)),
  },
  whoosh_big: {
    sec: 0.68,
    peak: 0.8,
    make: (o, rng) => {
      sweptNoise(o, rng, 0, 0.68, (t) => 140 * Math.pow(14, Math.sin((Math.PI * t) / 0.68)), 1.6, (t) => bump(t, 0.68));
      sweep(o, 0, 0.68, 70, 130, (t) => 6 * bump(t, 0.68) * bump(t, 0.68));
    },
  },
  // Riser: a sweep climbing for about a second, noise over it, louder as it climbs.
  rise: {
    sec: 1.1,
    peak: 0.75,
    make: (o, rng) => {
      sweep(o, 0, 1.1, 220, 2400, (t) => 0.35 * Math.pow(t / 1.1, 1.5));
      sweptNoise(o, rng, 0, 1.1, (t) => 300 * Math.pow(18, t / 1.1), 3, (t) => 0.9 * Math.pow(t / 1.1, 1.8));
    },
  },
  // The opposite of a pop: a low sine sliding down.
  drop: { sec: 0.6, peak: 0.85, make: (o) => sweep(o, 0, 0.55, 640, 55, (t) => decay(t, 0.2)) },
  // A heavy thud: a deep sine and a short low-passed burst.
  stamp: {
    sec: 0.25,
    peak: 0.9,
    make: (o, rng) => {
      sweep(o, 0, 0.22, 120, 48, (t) => decay(t, 0.06));
      burst(o, rng, 0, 0.06, 0.012, 0.55, { lp: 1600 });
    },
  },
  // Five keystrokes at uneven spacing, each a tick of its own pitch.
  typing: {
    sec: 0.5,
    peak: 0.7,
    make: (o, rng) => {
      for (const t0 of [0.02, 0.11, 0.2, 0.34, 0.43]) {
        const f = 1500 + rng() * 1500;
        burst(o, rng, t0, 0.03, 0.002, 0.9, { hp: 1500 });
        ping(o, t0, 0.03, f, 0.005, 0.5);
      }
    },
  },
  // Six high pings scattered over half a second.
  sparkle: {
    sec: 0.7,
    peak: 0.65,
    make: (o, rng) => {
      for (const [i, f] of [3136, 4186, 5274, 3951, 6272, 4699].entries()) {
        const t0 = i * 0.075 + rng() * 0.03;
        ping(o, t0, 0.25, f, 0.06, 0.5 + rng() * 0.5);
        ping(o, t0, 0.15, f * 1.5, 0.03, 0.25);
      }
    },
  },
  // Two flat buzzes, the second lower.
  error: {
    sec: 0.35,
    peak: 0.75,
    make: (o) => {
      for (const [t0, f] of [[0, 240], [0.17, 180]]) {
        add(o, t0, 0.15, (t) => {
          const body = Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2 * f * t) + 0.3 * Math.sin(TAU * 3 * f * t);
          return body * Math.min(1, t / 0.01) * Math.min(1, (0.15 - t) / 0.02);
        });
      }
    },
  },
  // A latch: a click, then a deeper one a moment later.
  lock: {
    sec: 0.2,
    peak: 0.85,
    make: (o, rng) => {
      burst(o, rng, 0, 0.03, 0.003, 0.8, { hp: 1200 });
      ping(o, 0, 0.04, 1800, 0.006, 0.5);
      ping(o, 0.09, 0.1, 260, 0.02, 1);
      burst(o, rng, 0.09, 0.03, 0.004, 0.6, { lp: 2500 });
    },
  },
  // A switch: two tiny ticks, the second lower.
  toggle: {
    sec: 0.065,
    peak: 0.75,
    make: (o, rng) => {
      burst(o, rng, 0, 0.02, 0.0015, 0.8, { hp: 2200 });
      burst(o, rng, 0.03, 0.03, 0.002, 0.8, { hp: 900 });
      ping(o, 0.03, 0.03, 1400, 0.006, 0.4);
    },
  },
};
export const NAMES = Object.keys(SOUNDS);

// ---------------------------------------------------------------- rendering

const FADE_IN = 0.0015;
const FADE_OUT = 0.008;

/** The named sound as 16-bit samples. */
export function synthesize(name) {
  const sound = SOUNDS[name];
  if (!sound) throw new Error(`no sound called ${JSON.stringify(name)}`);
  const out = silence(sound.sec);
  sound.make(out, seeded(hash(name)));
  const n = out.length;
  const fi = Math.round(FADE_IN * RATE);
  const fo = Math.round(FADE_OUT * RATE);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    out[i] *= Math.min(1, i / fi) * Math.min(1, (n - 1 - i) / fo);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const gain = peak > 0 ? sound.peak / peak : 0;
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(out[i] * gain * 32767)));
  return pcm;
}

/** A mono 48 kHz 16-bit WAV file. */
export function wav(pcm) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
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
  return Buffer.concat([header, data]);
}

// ---------------------------------------------------------------- the command

const ok = (value) => ({ code: 0, line: JSON.stringify(value) });
const fail = (message) => ({ code: 1, line: JSON.stringify({ error: message }) });

/** `deps`: { mkdir, writeFile } (node:fs/promises). Returns { code, line }. */
export async function run(argv, deps) {
  let out;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1] !== undefined && out === undefined) out = argv[++i];
    else return fail(USAGE);
  }
  if (out === undefined) return fail(USAGE);
  try {
    const dir = resolve(out);
    await deps.mkdir(dir, { recursive: true });
    const files = [];
    for (const name of NAMES) {
      await deps.writeFile(join(dir, `${name}.wav`), wav(synthesize(name)));
      files.push(`${name}.wav`);
    }
    return ok({ out: dir, files });
  } catch (e) {
    return fail(e.message);
  }
}

// Run as a command, but stay importable for the tests (and for film.mjs).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const { code, line } = await run(process.argv.slice(2), { mkdir, writeFile });
  console.log(line);
  process.exit(code);
}
