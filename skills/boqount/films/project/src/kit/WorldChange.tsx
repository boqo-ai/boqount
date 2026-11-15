// Worlds that change on a spoken word: the story format's scenes (film.md → The story format). Each world runs over
// [from, to) film frames; the change into it is a designed move of at most 0.4 s, or a hard cut on the word.
//
//   push  the old world grows toward the eye and goes as the new one settles in from slightly larger (a push through)
//   pull  the old world shrinks away and goes as the new one settles in from slightly larger (a pull-out into it)
//   cut   a hard cut on the word: the new world is simply there
//
// Neither move fades through black or white, and nothing washes the whole frame, so a change never flashes (motion.md
// → Nothing flashes). Inside a world the old rules hold: one camera, things carried and transformed, no jump.
//
//   const S = spans([0, cue('proof', 0) - 4, cue('catch', 0) - 4, DURATION]);   // where each world starts and ends
//   <World name="1 The number" span={S[0]} out="push"> … </World>
//   <World name="2 The proof" span={S[1]} inn="push" out="pull"> … </World>
import React from 'react';
import {EXIT, clamp01, mix, p} from '../lib/anim';
import {Scene, useF} from '../lib/scene';

export type Change = 'push' | 'pull' | 'cut';

/** Frames (BASE, 60 a second) a move takes on each side of its word: 0.2 s out of the old world, 0.23 s into the new. */
export const CHANGE = {out: 12, inn: 14} as const;

/** Each world's [from, to) from the frames its changes fall on (the first 0, the last DURATION): a world that arrives
 * by a move starts CHANGE.inn frames before its word, so for that long it draws over the world before. */
export const spans = (marks: number[], moves: Change[] = []): (readonly [number, number])[] =>
  marks.slice(0, -1).map((m, i) => {
    const inn = i > 0 && (moves[i - 1] ?? 'push') !== 'cut' ? CHANGE.inn : 0;
    return [Math.max(0, m - inn), marks[i + 1]] as const;
  });

/** How a world sits at film frame f: its scale and opacity, from the move that brings it in and the one that takes it
 * out. A world that is fully in returns null (drawn as it is). */
const pose = (f: number, from: number, to: number, inn: Change, out: Change) => {
  const tin = inn === 'cut' ? 1 : p(f, from, CHANGE.inn);
  const tout = out === 'cut' ? 0 : p(f, to - CHANGE.out, CHANGE.out, EXIT);
  if (tin >= 1 && tout <= 0) return null;
  // the new world comes up over the last two thirds of its move, so the old one is seen moving first
  const up = inn === 'cut' ? 1 : clamp01(((f - from) / CHANGE.inn - 0.3) / 0.6);
  const sIn = mix(1.12, 1, tin);
  const sOut = out === 'pull' ? mix(1, 0.78, tout) : mix(1, 1.45, tout);
  return {scale: sIn * sOut, opacity: up * (1 - tout)};
};

/** One world of a story film, over [span[0], span[1]) film frames, brought in by `inn` and taken out by `out`. Pass
 * the change that actually happens on each side: the first world has no `inn`, the last no `out`. */
export const World: React.FC<{name: string; span: readonly [number, number]; inn?: Change; out?: Change; children: React.ReactNode}> = ({name, span, inn = 'cut', out = 'cut', children}) => (
  <Scene name={name} from={span[0]} to={span[1]}>
    <Moved from={span[0]} to={span[1]} inn={inn} out={out}>
      {children}
    </Moved>
  </Scene>
);

const Moved: React.FC<{from: number; to: number; inn: Change; out: Change; children: React.ReactNode}> = ({from, to, inn, out, children}) => {
  const f = useF();
  const ps = pose(f, from, to, inn, out);
  if (!ps) return <div style={{position: 'absolute', inset: 0}}>{children}</div>;
  return <div style={{position: 'absolute', inset: 0, opacity: ps.opacity, scale: `${ps.scale}`, transformOrigin: '50% 34%'}}>{children}</div>;
};
