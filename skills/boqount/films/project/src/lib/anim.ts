// Motion helpers. Every value is a pure function of the frame: no CSS transitions, no keyframes, no Math.random().
import type {CSSProperties} from 'react';
import {Easing, interpolate, random} from 'remotion';
import {M} from './theme';

/** Fixed curves, for when a move must not follow the style's preset. */
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EXIT = Easing.bezier(0.7, 0, 0.84, 0);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
/** Falling under gravity: starts slow, keeps accelerating. */
export const GRAVITY = Easing.bezier(0.55, 0, 1, 0.45);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Clamped 0 → 1 progress over [start, start + dur] frames, eased (default: the style's entrance). */
export const p = (f: number, start: number, dur: number, easing: (t: number) => number = M.in) =>
  interpolate(f, [start, start + dur], [0, 1], {...clamp, easing});

/** Clamped interpolate with easing. */
export const lerp = (
  f: number,
  input: number[],
  output: number[],
  easing: ((t: number) => number) | ((t: number) => number)[] = M.in,
) => interpolate(f, input, output, {...clamp, easing});

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Seeded random in [lo, hi): the same value on every render. */
export const rnd = (seed: string | number, lo = 0, hi = 1) => lo + random(seed) * (hi - lo);

/** A short, decaying shake: [dx, dy] px, 0 outside [start, start + dur]. */
export const shake = (f: number, start: number, dur: number, amp: number, seed: string): [number, number] => {
  if (f < start || f > start + dur) return [0, 0];
  const k = 1 - (f - start) / dur;
  // Seeded on the whole BASE frame, so at 120 samples a second the jitter keeps a 60 Hz character.
  const n = Math.floor(f);
  return [rnd(`${seed}x${n}`, -1, 1) * amp * k, rnd(`${seed}y${n}`, -1, 1) * amp * k];
};

/** A scale bump 1 → 1 + amt → 1 over ~16 frames after `at`: "landed". */
export const bump = (f: number, at: number, amt = 0.08) => 1 + lerp(f, [at, at + 5, at + 16], [0, amt, 0], [EXPO, EXPO]);

/** A rectangle, and the helpers that carry one object's box into another's (the no-cuts handoff). */
export type R = {x: number; y: number; w: number; h: number};
export const mixR = (a: R, b: R, t: number): R => ({x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t)});
export const box = (r: R): CSSProperties => ({position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h});
